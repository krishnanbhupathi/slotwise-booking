import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { bookings, payments, reminders, stripeEvents } from "@/db/schema";
import type { Database } from "@/db/types";
import { EXCLUSION_VIOLATION, pgErrorCode } from "@/lib/db-errors";

export type WebhookDeps = {
  /** Refunds a payment. Must be idempotent per booking (Stripe idempotency key). */
  refund(paymentIntentId: string, bookingId: string): Promise<void>;
  now(): Date;
};

export type WebhookOutcome =
  | "duplicate"
  | "ignored"
  | "confirmed"
  | "already_confirmed"
  | "refunded_slot_taken"
  | "refunded_not_bookable"
  | "released";

const REMINDER_LEAD_MS = 24 * 60 * 60_000;

/**
 * Applies one Stripe event. Recording the event id and applying its effects
 * happen in one transaction: a redelivered event finds its id already stored
 * and does nothing, and a failure part-way rolls back both so Stripe's retry
 * starts clean.
 */
export async function handleStripeEvent(db: Database, event: Stripe.Event, deps: WebhookDeps): Promise<WebhookOutcome> {
  return db.transaction(async (tx) => {
    const fresh = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (fresh.length === 0) return "duplicate";

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const checkout = event.data.object;
        // Delayed payment methods complete the session before the money arrives.
        if (checkout.payment_status !== "paid") return "ignored";
        return confirmPaidBooking(tx, checkout, deps);
      }
      case "checkout.session.expired": {
        const checkout = event.data.object;
        const bookingId = checkout.metadata?.booking_id;
        if (!bookingId) return "ignored";
        await tx.update(payments).set({ status: "failed" }).where(eq(payments.stripeSessionId, checkout.id));
        await tx
          .update(bookings)
          .set({ status: "expired" })
          .where(and(eq(bookings.id, bookingId), eq(bookings.status, "held")));
        return "released";
      }
      default:
        return "ignored";
    }
  });
}

async function confirmPaidBooking(
  tx: Database,
  checkout: Stripe.Checkout.Session,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  const bookingId = checkout.metadata?.booking_id;
  if (!bookingId) return "ignored";
  const paymentIntentId = typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent?.id;

  await tx
    .update(payments)
    .set({ status: "paid", stripePaymentIntentId: paymentIntentId ?? null })
    .where(eq(payments.stripeSessionId, checkout.id));

  const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!booking) return "ignored";
  if (booking.status === "confirmed") return "already_confirmed";

  const refund = async (outcome: "refunded_slot_taken" | "refunded_not_bookable") => {
    if (paymentIntentId) await deps.refund(paymentIntentId, booking.id);
    await tx.update(payments).set({ status: "refunded" }).where(eq(payments.stripeSessionId, checkout.id));
    await tx.update(bookings).set({ status: "refunded" }).where(eq(bookings.id, booking.id));
    return outcome;
  };

  // Paid after being cancelled or refunded: nothing to confirm.
  if (booking.status !== "held" && booking.status !== "expired") return refund("refunded_not_bookable");

  // A held booking confirms normally. An expired one (paid after its 10
  // minutes ran out; Checkout sessions last at least 30) confirms only if the
  // slot is still free: the savepoint lets the exclusion constraint decide.
  try {
    await tx.transaction(async (sp) => {
      await sp
        .update(bookings)
        .set({ status: "confirmed", holdExpiresAt: null })
        .where(eq(bookings.id, booking.id));
    });
  } catch (error) {
    if (pgErrorCode(error) === EXCLUSION_VIOLATION) return refund("refunded_slot_taken");
    throw error;
  }

  const sendAt = new Date(booking.startsAt.getTime() - REMINDER_LEAD_MS);
  if (sendAt > deps.now()) await tx.insert(reminders).values({ bookingId: booking.id, sendAt });
  return "confirmed";
}
