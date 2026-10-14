import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, reminders, services } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import { claimDueReminders, expireLapsedHolds, releaseReminder } from "./reminders";

let db: TestDb;
let providerId: string;
let serviceId: string;
const NOW = new Date("2026-10-18T15:00Z");
let hour = 0;

beforeAll(async () => {
  ({ db } = await createTestDb());
});

beforeEach(async () => {
  await resetTestDb(db);
  providerId = (await makeProvider(db)).id;
  [{ id: serviceId }] = await db
    .insert(services)
    .values({ providerId, slug: "s", name: "S", durationMin: 60, priceCents: 0, depositCents: 0 })
    .returning();
});

/** A booking (each at a distinct hour) with a reminder due at `sendAt`. */
async function withReminder(sendAt: Date, status: "confirmed" | "cancelled" | "held" = "confirmed", startsAt?: Date) {
  const start = startsAt ?? new Date(Date.UTC(2026, 9, 19, hour++));
  const [b] = await db
    .insert(bookings)
    .values({
      providerId,
      serviceId,
      clientName: "C",
      clientEmail: "c@example.com",
      startsAt: start,
      endsAt: new Date(start.getTime() + 3_600_000),
      blocksUntil: new Date(start.getTime() + 3_600_000),
      status,
      holdExpiresAt: status === "held" ? new Date(NOW.getTime() - 60_000) : null,
    })
    .returning();
  const [r] = await db.insert(reminders).values({ bookingId: b.id, sendAt }).returning();
  return { booking: b, reminder: r };
}

describe("claimDueReminders", () => {
  it("claims due reminders for confirmed upcoming bookings only", async () => {
    const due = await withReminder(new Date(NOW.getTime() - 1));
    await withReminder(new Date(NOW.getTime() + 3_600_000)); // not due yet
    await withReminder(new Date(NOW.getTime() - 1), "cancelled");
    await withReminder(new Date(NOW.getTime() - 1), "confirmed", new Date(NOW.getTime() - 60_000)); // already started

    const claimed = await claimDueReminders(db, NOW);
    expect(claimed).toEqual([{ id: due.reminder.id, bookingId: due.booking.id }]);
  });

  it("never claims the same reminder twice, even from overlapping runs", async () => {
    await withReminder(new Date(NOW.getTime() - 1));
    const [first, second] = await Promise.all([claimDueReminders(db, NOW), claimDueReminders(db, NOW)]);
    expect(first.length + second.length).toBe(1);
    expect(await claimDueReminders(db, NOW)).toEqual([]);
  });

  it("re-offers a reminder after its claim is released", async () => {
    await withReminder(new Date(NOW.getTime() - 1));
    const [claimed] = await claimDueReminders(db, NOW);
    await releaseReminder(db, claimed.id);
    expect(await claimDueReminders(db, NOW)).toHaveLength(1);
  });
});

it("expireLapsedHolds marks only lapsed holds", async () => {
  await withReminder(NOW, "held");
  await withReminder(NOW, "confirmed");
  expect(await expireLapsedHolds(db, NOW)).toBe(1);
});
