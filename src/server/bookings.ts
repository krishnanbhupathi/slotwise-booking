import { and, eq, gt, inArray, lte, ne, or } from "drizzle-orm";
import { availabilityRules, bookings, dateOverrides, type IntakeAnswers, type Provider, type Service } from "@/db/schema";
import type { Database } from "@/db/types";
import { EXCLUSION_VIOLATION, pgErrorCode } from "@/lib/db-errors";
import { BOOKING_RULES, isAvailableStart, type SlotInput } from "@/lib/slots";

const hhmm = (time: string) => time.slice(0, 5);

/** Everything the slot engine needs for one provider + service, read from the database. */
export async function loadSlotInput(
  db: Database,
  provider: Pick<Provider, "id" | "timezone">,
  service: Pick<Service, "durationMin" | "bufferMin">,
  now: Date,
  /** When rescheduling, the booking being moved mustn't block its own new time. */
  excludeBookingId?: string,
): Promise<SlotInput> {
  const [rules, overrides, live] = await Promise.all([
    db.select().from(availabilityRules).where(eq(availabilityRules.providerId, provider.id)),
    db.select().from(dateOverrides).where(eq(dateOverrides.providerId, provider.id)),
    db
      .select({ start: bookings.startsAt, end: bookings.blocksUntil })
      .from(bookings)
      .where(
        and(
          eq(bookings.providerId, provider.id),
          gt(bookings.blocksUntil, now),
          excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined,
          or(
            eq(bookings.status, "confirmed"),
            and(eq(bookings.status, "held"), gt(bookings.holdExpiresAt, now)),
          ),
        ),
      ),
  ]);

  return {
    timeZone: provider.timezone,
    weekly: rules.map((r) => ({ weekday: r.weekday, start: hhmm(r.startTime), end: hhmm(r.endTime) })),
    overrides: overrides.map((o) => ({
      date: o.date,
      start: o.startTime && hhmm(o.startTime),
      end: o.endTime && hhmm(o.endTime),
    })),
    durationMin: service.durationMin,
    bufferMin: service.bufferMin,
    busy: live,
    now,
  };
}

export type HoldRequest = {
  provider: Pick<Provider, "id" | "timezone">;
  service: Pick<Service, "id" | "durationMin" | "bufferMin" | "depositCents">;
  startsAt: Date;
  clientName: string;
  clientEmail: string;
  clientTimezone: string | null;
  note: string | null;
  /** Answers to the service's intake form, already validated (see checkIntake). */
  intake?: IntakeAnswers | null;
  now: Date;
};

export type HoldResult =
  | { ok: true; booking: typeof bookings.$inferSelect }
  | { ok: false; reason: "unavailable" | "taken" };

/**
 * Reserves a slot. Services with a deposit get a `held` booking that expires
 * after 10 minutes unless paid; free services are confirmed straight away.
 *
 * Two layers stop double-booking:
 * 1. The requested start must be a slot the engine would offer right now.
 * 2. The insert runs against the `bookings_no_overlap` exclusion constraint,
 *    so if two requests race past step 1, Postgres rejects the second.
 */
export async function placeHold(db: Database, req: HoldRequest): Promise<HoldResult> {
  const slotInput = await loadSlotInput(db, req.provider, req.service, req.now);
  if (!isAvailableStart(req.startsAt, slotInput)) return { ok: false, reason: "unavailable" };

  const endsAt = new Date(req.startsAt.getTime() + req.service.durationMin * 60_000);
  const blocksUntil = new Date(endsAt.getTime() + req.service.bufferMin * 60_000);
  const needsPayment = req.service.depositCents > 0;

  try {
    const booking = await db.transaction(async (tx) => {
      // Lapsed holds still say "held", so the constraint would count them.
      // Retire them first, in the same transaction as the insert.
      await tx
        .update(bookings)
        .set({ status: "expired" })
        .where(
          and(
            eq(bookings.providerId, req.provider.id),
            eq(bookings.status, "held"),
            lte(bookings.holdExpiresAt, req.now),
          ),
        );

      const [row] = await tx
        .insert(bookings)
        .values({
          providerId: req.provider.id,
          serviceId: req.service.id,
          clientName: req.clientName,
          clientEmail: req.clientEmail,
          clientTimezone: req.clientTimezone,
          note: req.note,
          intake: req.intake ?? null,
          startsAt: req.startsAt,
          endsAt,
          blocksUntil,
          status: needsPayment ? "held" : "confirmed",
          holdExpiresAt: needsPayment ? new Date(req.now.getTime() + BOOKING_RULES.holdMin * 60_000) : null,
        })
        .returning();
      return row;
    });
    return { ok: true, booking };
  } catch (error) {
    if (pgErrorCode(error) === EXCLUSION_VIOLATION) return { ok: false, reason: "taken" };
    throw error;
  }
}

/** Gives up an unpaid hold (checkout cancelled or expired). Paid or confirmed bookings are untouched. */
export async function releaseHold(db: Database, bookingId: string) {
  const [row] = await db
    .update(bookings)
    .set({ status: "expired" })
    .where(and(eq(bookings.id, bookingId), inArray(bookings.status, ["held"])))
    .returning({ id: bookings.id });
  return Boolean(row);
}
