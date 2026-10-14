import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { availabilityRules, bookings, payments, reminders, services, type Booking, type Provider } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import { cancelBooking, rescheduleBooking, type RefundFn } from "./booking-changes";

let db: TestDb;
let provider: Provider;
let serviceId: string;
let refund: Mock<RefundFn>;

// Monday 19 Oct 2026, 16:00 BST. Weekly hours Mon & Tue 16:00–20:00.
const START = new Date("2026-10-19T15:00Z");
const TWO_DAYS_BEFORE = new Date("2026-10-17T15:00Z");
const TEN_HOURS_BEFORE = new Date("2026-10-19T05:00Z");

beforeAll(async () => {
  ({ db } = await createTestDb());
});

beforeEach(async () => {
  await resetTestDb(db);
  provider = await makeProvider(db);
  await db.insert(availabilityRules).values([
    { providerId: provider.id, weekday: 1, startTime: "16:00", endTime: "20:00" },
    { providerId: provider.id, weekday: 2, startTime: "16:00", endTime: "20:00" },
  ]);
  [{ id: serviceId }] = await db
    .insert(services)
    .values({ providerId: provider.id, slug: "maths", name: "Maths", durationMin: 60, priceCents: 4500, depositCents: 1000, bufferMin: 15 })
    .returning();
  refund = vi.fn<RefundFn>().mockResolvedValue(undefined);
});

async function confirmedBooking(opts: { start?: Date; paid?: boolean } = {}): Promise<Booking> {
  const start = opts.start ?? START;
  const [booking] = await db
    .insert(bookings)
    .values({
      providerId: provider.id,
      serviceId,
      clientName: "Sam",
      clientEmail: "sam@example.com",
      startsAt: start,
      endsAt: new Date(start.getTime() + 3_600_000),
      blocksUntil: new Date(start.getTime() + 75 * 60_000),
      status: "confirmed",
    })
    .returning();
  if (opts.paid !== false) {
    await db.insert(payments).values({
      bookingId: booking.id,
      stripeSessionId: `cs_${booking.id}`,
      stripePaymentIntentId: `pi_${booking.id}`,
      amountCents: 1000,
      currency: "usd",
      status: "paid",
    });
  }
  await db.insert(reminders).values({ bookingId: booking.id, sendAt: new Date(start.getTime() - 86_400_000) });
  return booking;
}

const get = async (id: string) => (await db.query.bookings.findFirst({ where: eq(bookings.id, id) }))!;

describe("cancelBooking", () => {
  it("client cancelling 24h+ ahead gets the deposit back", async () => {
    const booking = await confirmedBooking();
    expect(await cancelBooking(db, { bookingId: booking.id, by: "client", now: TWO_DAYS_BEFORE }, refund)).toEqual({
      ok: true,
      refunded: true,
    });
    expect(refund).toHaveBeenCalledExactlyOnceWith(`pi_${booking.id}`, booking.id);
    const after = await get(booking.id);
    expect(after).toMatchObject({ status: "refunded", cancelledBy: "client", icsSequence: 1 });
    expect(await db.select().from(reminders)).toHaveLength(0);
    const [payment] = await db.select().from(payments);
    expect(payment.status).toBe("refunded");
  });

  it("client cancelling inside 24h keeps the booking cancelled without a refund", async () => {
    const booking = await confirmedBooking();
    expect(await cancelBooking(db, { bookingId: booking.id, by: "client", now: TEN_HOURS_BEFORE }, refund)).toEqual({
      ok: true,
      refunded: false,
    });
    expect(refund).not.toHaveBeenCalled();
    expect((await get(booking.id)).status).toBe("cancelled");
  });

  it("provider cancelling always refunds, even inside 24h", async () => {
    const booking = await confirmedBooking();
    const result = await cancelBooking(
      db,
      { bookingId: booking.id, by: "provider", providerId: provider.id, now: TEN_HOURS_BEFORE },
      refund,
    );
    expect(result).toEqual({ ok: true, refunded: true });
    expect((await get(booking.id)).cancelledBy).toBe("provider");
  });

  it("a provider can't cancel another provider's booking", async () => {
    const booking = await confirmedBooking();
    const other = await makeProvider(db);
    expect(
      await cancelBooking(db, { bookingId: booking.id, by: "provider", providerId: other.id, now: TWO_DAYS_BEFORE }, refund),
    ).toEqual({ ok: false, reason: "not_found" });
    expect((await get(booking.id)).status).toBe("confirmed");
  });

  it("cancelling twice is refused and refunds once", async () => {
    const booking = await confirmedBooking();
    await cancelBooking(db, { bookingId: booking.id, by: "client", now: TWO_DAYS_BEFORE }, refund);
    expect(await cancelBooking(db, { bookingId: booking.id, by: "client", now: TWO_DAYS_BEFORE }, refund)).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(refund).toHaveBeenCalledOnce();
  });

  it("a free booking cancels without calling Stripe", async () => {
    const booking = await confirmedBooking({ paid: false });
    expect(await cancelBooking(db, { bookingId: booking.id, by: "client", now: TWO_DAYS_BEFORE }, refund)).toEqual({
      ok: true,
      refunded: false,
    });
    expect(refund).not.toHaveBeenCalled();
  });

  it("changes nothing if the Stripe refund fails", async () => {
    const booking = await confirmedBooking();
    refund.mockRejectedValueOnce(new Error("Stripe is down"));
    await expect(cancelBooking(db, { bookingId: booking.id, by: "client", now: TWO_DAYS_BEFORE }, refund)).rejects.toThrow();
    expect((await get(booking.id)).status).toBe("confirmed");
    expect(await db.select().from(reminders)).toHaveLength(1);
  });

  it("frees the slot for someone else", async () => {
    const booking = await confirmedBooking();
    await cancelBooking(db, { bookingId: booking.id, by: "client", now: TWO_DAYS_BEFORE }, refund);
    await expect(confirmedBooking({ paid: false })).resolves.toBeTruthy();
  });
});

describe("rescheduleBooking", () => {
  it("moves the booking, bumps the calendar sequence and moves the reminder", async () => {
    const booking = await confirmedBooking();
    const newStart = new Date("2026-10-20T15:00Z"); // Tue 16:00 BST
    expect(await rescheduleBooking(db, { bookingId: booking.id, newStart, now: TWO_DAYS_BEFORE })).toEqual({
      ok: true,
      previousStart: START,
    });
    const after = await get(booking.id);
    expect(after).toMatchObject({
      startsAt: newStart,
      endsAt: new Date("2026-10-20T16:00Z"),
      blocksUntil: new Date("2026-10-20T16:15Z"),
      icsSequence: 1,
    });
    const [reminder] = await db.select().from(reminders);
    expect(reminder.sendAt).toEqual(new Date("2026-10-19T15:00Z"));
  });

  it("can move to a time that overlaps the booking's own current slot", async () => {
    const booking = await confirmedBooking();
    const newStart = new Date("2026-10-19T15:30Z"); // 30 min later, overlaps itself
    expect((await rescheduleBooking(db, { bookingId: booking.id, newStart, now: TWO_DAYS_BEFORE })).ok).toBe(true);
  });

  it("refuses inside the 24h cut-off", async () => {
    const booking = await confirmedBooking();
    expect(
      await rescheduleBooking(db, { bookingId: booking.id, newStart: new Date("2026-10-20T15:00Z"), now: TEN_HOURS_BEFORE }),
    ).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("refuses a time that isn't offered or is someone else's", async () => {
    const booking = await confirmedBooking();
    await confirmedBooking({ start: new Date("2026-10-20T15:00Z"), paid: false });
    expect(
      await rescheduleBooking(db, { bookingId: booking.id, newStart: new Date("2026-10-20T15:00Z"), now: TWO_DAYS_BEFORE }),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(
      await rescheduleBooking(db, { bookingId: booking.id, newStart: new Date("2026-10-20T15:10Z"), now: TWO_DAYS_BEFORE }),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  it("refuses to reschedule a cancelled booking", async () => {
    const booking = await confirmedBooking();
    await cancelBooking(db, { bookingId: booking.id, by: "client", now: TWO_DAYS_BEFORE }, refund);
    expect(
      await rescheduleBooking(db, { bookingId: booking.id, newStart: new Date("2026-10-20T15:00Z"), now: TWO_DAYS_BEFORE }),
    ).toEqual({ ok: false, reason: "not_allowed" });
  });
});
