import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bookings, payments, reminders, services, stripeEvents, type Booking } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import { handleStripeEvent, type WebhookDeps } from "./stripe-webhook";

let db: TestDb;
let providerId: string;
let serviceId: string;
let deps: WebhookDeps & { refund: ReturnType<typeof vi.fn> };

const NOW = new Date("2026-10-18T00:00Z");
const START = new Date("2026-10-19T15:00Z");

beforeAll(async () => {
  ({ db } = await createTestDb());
});

beforeEach(async () => {
  await resetTestDb(db);
  providerId = (await makeProvider(db)).id;
  [{ id: serviceId }] = await db
    .insert(services)
    .values({ providerId, slug: "maths", name: "Maths", durationMin: 60, priceCents: 4500, depositCents: 1000 })
    .returning();
  deps = { refund: vi.fn().mockResolvedValue(undefined), now: () => NOW };
});

/** A booking plus its pending payment for Checkout session `sessionId`. */
async function heldBooking(sessionId: string, status: Booking["status"] = "held", start = START) {
  const [booking] = await db
    .insert(bookings)
    .values({
      providerId,
      serviceId,
      clientName: "Sam",
      clientEmail: "sam@example.com",
      startsAt: start,
      endsAt: new Date(start.getTime() + 3_600_000),
      blocksUntil: new Date(start.getTime() + 3_600_000),
      status,
      holdExpiresAt: new Date(NOW.getTime() + 600_000),
    })
    .returning();
  await db.insert(payments).values({ bookingId: booking.id, stripeSessionId: sessionId, amountCents: 1000, currency: "usd" });
  return booking;
}

function checkoutEvent(
  id: string,
  type: "checkout.session.completed" | "checkout.session.async_payment_succeeded" | "checkout.session.expired",
  session: { id: string; bookingId: string; paymentStatus?: "paid" | "unpaid" },
): Stripe.Event {
  return {
    id,
    object: "event",
    type,
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        payment_status: session.paymentStatus ?? "paid",
        payment_intent: `pi_${session.id}`,
        metadata: { booking_id: session.bookingId },
      },
    },
  } as unknown as Stripe.Event;
}

const bookingStatus = async (id: string) => (await db.query.bookings.findFirst({ where: eq(bookings.id, id) }))?.status;
const paymentStatus = async (sessionId: string) =>
  (await db.query.payments.findFirst({ where: eq(payments.stripeSessionId, sessionId) }))?.status;

describe("checkout.session.completed", () => {
  it("confirms the booking, marks the payment paid and schedules a reminder 24h before", async () => {
    const booking = await heldBooking("cs_1");
    expect(await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_1", bookingId: booking.id }), deps)).toBe("confirmed");

    expect(await bookingStatus(booking.id)).toBe("confirmed");
    const payment = await db.query.payments.findFirst({ where: eq(payments.stripeSessionId, "cs_1") });
    expect(payment).toMatchObject({ status: "paid", stripePaymentIntentId: "pi_cs_1" });
    const [reminder] = await db.select().from(reminders);
    expect(reminder.sendAt).toEqual(new Date("2026-10-18T15:00Z"));
  });

  it("is idempotent: the same event delivered twice confirms once", async () => {
    const booking = await heldBooking("cs_1");
    const event = checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_1", bookingId: booking.id });

    expect(await handleStripeEvent(db, event, deps)).toBe("confirmed");
    expect(await handleStripeEvent(db, event, deps)).toBe("duplicate");
    expect(await db.select().from(reminders)).toHaveLength(1);
    expect(await db.select().from(stripeEvents)).toHaveLength(1);
  });

  it("treats a second, different event for an already-confirmed booking as a no-op", async () => {
    const booking = await heldBooking("cs_1");
    await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_1", bookingId: booking.id }), deps);
    expect(
      await handleStripeEvent(db, checkoutEvent("evt_2", "checkout.session.async_payment_succeeded", { id: "cs_1", bookingId: booking.id }), deps),
    ).toBe("already_confirmed");
    expect(await db.select().from(reminders)).toHaveLength(1);
    expect(deps.refund).not.toHaveBeenCalled();
  });

  it("ignores a completed session that isn't paid yet (delayed payment methods)", async () => {
    const booking = await heldBooking("cs_1");
    expect(
      await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_1", bookingId: booking.id, paymentStatus: "unpaid" }), deps),
    ).toBe("ignored");
    expect(await bookingStatus(booking.id)).toBe("held");
  });

  it("confirms a late payment when the hold expired but the slot is still free", async () => {
    const booking = await heldBooking("cs_1", "expired");
    expect(await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_1", bookingId: booking.id }), deps)).toBe("confirmed");
    expect(await bookingStatus(booking.id)).toBe("confirmed");
  });

  it("refunds a late payment when someone else took the slot meanwhile", async () => {
    const late = await heldBooking("cs_late", "expired");
    const winner = await heldBooking("cs_winner", "confirmed");

    expect(await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_late", bookingId: late.id }), deps)).toBe(
      "refunded_slot_taken",
    );
    expect(deps.refund).toHaveBeenCalledExactlyOnceWith("pi_cs_late", late.id);
    expect(await bookingStatus(late.id)).toBe("refunded");
    expect(await paymentStatus("cs_late")).toBe("refunded");
    expect(await bookingStatus(winner.id)).toBe("confirmed");
    expect(await db.select().from(reminders)).toHaveLength(0);
  });

  it("refunds a payment for a booking that was cancelled", async () => {
    const booking = await heldBooking("cs_1", "cancelled");
    expect(await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_1", bookingId: booking.id }), deps)).toBe(
      "refunded_not_bookable",
    );
    expect(deps.refund).toHaveBeenCalledOnce();
  });

  it("rolls back everything if processing fails, so Stripe's retry starts clean", async () => {
    const late = await heldBooking("cs_late", "expired");
    await heldBooking("cs_winner", "confirmed");
    const event = checkoutEvent("evt_1", "checkout.session.completed", { id: "cs_late", bookingId: late.id });

    deps.refund.mockRejectedValueOnce(new Error("Stripe is down"));
    await expect(handleStripeEvent(db, event, deps)).rejects.toThrow("Stripe is down");
    expect(await db.select().from(stripeEvents)).toHaveLength(0);
    expect(await paymentStatus("cs_late")).toBe("pending");

    expect(await handleStripeEvent(db, event, deps)).toBe("refunded_slot_taken");
  });
});

describe("checkout.session.expired", () => {
  it("releases the hold and marks the payment failed", async () => {
    const booking = await heldBooking("cs_1");
    expect(await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.expired", { id: "cs_1", bookingId: booking.id }), deps)).toBe("released");
    expect(await bookingStatus(booking.id)).toBe("expired");
    expect(await paymentStatus("cs_1")).toBe("failed");
  });

  it("never touches a confirmed booking", async () => {
    const booking = await heldBooking("cs_1", "confirmed");
    await handleStripeEvent(db, checkoutEvent("evt_1", "checkout.session.expired", { id: "cs_1", bookingId: booking.id }), deps);
    expect(await bookingStatus(booking.id)).toBe("confirmed");
  });
});

it("records and ignores event types it doesn't handle", async () => {
  const event = { id: "evt_x", object: "event", type: "customer.created", data: { object: {} } } as unknown as Stripe.Event;
  expect(await handleStripeEvent(db, event, deps)).toBe("ignored");
  expect(await handleStripeEvent(db, event, deps)).toBe("duplicate");
});
