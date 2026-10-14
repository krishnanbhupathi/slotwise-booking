import { and, eq, isNull } from "drizzle-orm";
import { bookings, payments, reminders } from "@/db/schema";
import type { Database } from "@/db/types";
import { EXCLUSION_VIOLATION, pgErrorCode } from "@/lib/db-errors";
import { canClientReschedule, clientCancelTerms } from "@/lib/policy";
import { isAvailableStart } from "@/lib/slots";
import { loadBookingContext } from "./booking-context";
import { loadSlotInput } from "./bookings";

export type RefundFn = (paymentIntentId: string, bookingId: string) => Promise<void>;

const REMINDER_LEAD_MS = 24 * 60 * 60_000;

export type CancelResult =
  | { ok: true; refunded: boolean }
  | { ok: false; reason: "not_found" | "not_allowed" };

/**
 * Cancels a confirmed booking.
 * - Provider: always allowed before the start, deposit always refunded.
 * - Client: allowed before the start; deposit refunded only 24h+ ahead.
 *
 * The row is locked for the whole change, and the Stripe refund (idempotent
 * per booking) happens before commit: if Stripe fails, nothing changes.
 */
export async function cancelBooking(
  db: Database,
  args: { bookingId: string; by: "client" | "provider"; providerId?: string; now: Date },
  refund: RefundFn,
): Promise<CancelResult> {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, args.bookingId)).for("update");
    if (!booking) return { ok: false, reason: "not_found" };
    if (args.by === "provider" && booking.providerId !== args.providerId) return { ok: false, reason: "not_found" };

    const terms =
      args.by === "client"
        ? clientCancelTerms(booking, args.now)
        : booking.status === "confirmed" && booking.startsAt > args.now
          ? { allowed: true as const, refundDeposit: true }
          : { allowed: false as const };
    if (!terms.allowed) return { ok: false, reason: "not_allowed" };

    const paid = await tx.query.payments.findFirst({
      where: and(eq(payments.bookingId, booking.id), eq(payments.status, "paid")),
    });
    const refunded = Boolean(terms.refundDeposit && paid?.stripePaymentIntentId);
    if (refunded) {
      await refund(paid!.stripePaymentIntentId!, booking.id);
      await tx.update(payments).set({ status: "refunded" }).where(eq(payments.id, paid!.id));
    }

    await tx
      .update(bookings)
      .set({
        status: refunded ? "refunded" : "cancelled",
        cancelledAt: args.now,
        cancelledBy: args.by,
        icsSequence: booking.icsSequence + 1,
      })
      .where(eq(bookings.id, booking.id));
    await tx.delete(reminders).where(and(eq(reminders.bookingId, booking.id), isNull(reminders.sentAt)));
    return { ok: true, refunded };
  });
}

export type RescheduleResult =
  | { ok: true; previousStart: Date }
  | { ok: false; reason: "not_found" | "not_allowed" | "unavailable" | "taken" };

/** Moves a confirmed booking to another offered slot (client, 24h+ ahead). The deposit carries over. */
export async function rescheduleBooking(
  db: Database,
  args: { bookingId: string; newStart: Date; now: Date },
): Promise<RescheduleResult> {
  const ctx = await loadBookingContext(db, args.bookingId);
  if (!ctx) return { ok: false, reason: "not_found" };
  const { booking, service, provider } = ctx;
  if (!canClientReschedule(booking, args.now)) return { ok: false, reason: "not_allowed" };

  const slotInput = await loadSlotInput(db, provider, service, args.now, booking.id);
  if (!isAvailableStart(args.newStart, slotInput)) return { ok: false, reason: "unavailable" };

  const endsAt = new Date(args.newStart.getTime() + service.durationMin * 60_000);
  const blocksUntil = new Date(endsAt.getTime() + service.bufferMin * 60_000);
  try {
    return await db.transaction(async (tx) => {
      const [moved] = await tx
        .update(bookings)
        .set({ startsAt: args.newStart, endsAt, blocksUntil, icsSequence: booking.icsSequence + 1 })
        .where(and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed"), eq(bookings.startsAt, booking.startsAt)))
        .returning({ id: bookings.id });
      // Changed underneath us (cancelled, or moved by a concurrent request).
      if (!moved) return { ok: false as const, reason: "not_allowed" as const };

      await tx.delete(reminders).where(and(eq(reminders.bookingId, booking.id), isNull(reminders.sentAt)));
      const sendAt = new Date(args.newStart.getTime() - REMINDER_LEAD_MS);
      if (sendAt > args.now) await tx.insert(reminders).values({ bookingId: booking.id, sendAt });
      return { ok: true as const, previousStart: booking.startsAt };
    });
  } catch (error) {
    if (pgErrorCode(error) === EXCLUSION_VIOLATION) return { ok: false, reason: "taken" };
    throw error;
  }
}
