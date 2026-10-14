import { beforeAll, expect, it } from "vitest";
import { bookings, payments, services } from "@/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import { listPayments, listUpcomingBookings } from "./dashboard";

let db: TestDb;
const NOW = new Date("2026-10-18T12:00Z");

beforeAll(async () => {
  ({ db } = await createTestDb());
});

async function bookingFor(providerId: string, start: string, status: "confirmed" | "cancelled" = "confirmed") {
  const [service] = await db
    .insert(services)
    .values({ providerId, slug: `s-${start}-${status}`, name: "Maths", durationMin: 60, priceCents: 4500, depositCents: 1000 })
    .returning();
  const startsAt = new Date(start);
  const [booking] = await db
    .insert(bookings)
    .values({
      providerId,
      serviceId: service.id,
      clientName: "C",
      clientEmail: "c@example.com",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3_600_000),
      blocksUntil: new Date(startsAt.getTime() + 3_600_000),
      status,
    })
    .returning();
  await db.insert(payments).values({
    bookingId: booking.id,
    stripeSessionId: `cs_${booking.id}`,
    amountCents: 1000,
    currency: "usd",
    status: "paid",
  });
  return booking;
}

it("lists only this provider's confirmed, not-yet-finished bookings, soonest first", async () => {
  const me = await makeProvider(db);
  const other = await makeProvider(db);
  const later = await bookingFor(me.id, "2026-10-21T15:00Z");
  const sooner = await bookingFor(me.id, "2026-10-19T15:00Z");
  await bookingFor(me.id, "2026-10-17T15:00Z"); // past
  await bookingFor(me.id, "2026-10-20T15:00Z", "cancelled");
  await bookingFor(other.id, "2026-10-19T09:00Z");

  const rows = await listUpcomingBookings(db, me.id, NOW);
  expect(rows.map((r) => r.id)).toEqual([sooner.id, later.id]);
  expect(rows[0].depositCents).toBe(1000);
});

it("lists only this provider's payments", async () => {
  const me = await makeProvider(db);
  const other = await makeProvider(db);
  await bookingFor(me.id, "2026-10-22T15:00Z");
  await bookingFor(other.id, "2026-10-22T15:00Z");
  expect(await listPayments(db, me.id)).toHaveLength(1);
});
