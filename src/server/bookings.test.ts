import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { availabilityRules, bookings, services, type Provider, type Service } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import { placeHold, releaseHold, type HoldRequest } from "./bookings";

let db: TestDb;
let provider: Provider;
let paid: Service;
let free: Service;

// Sunday 18 Oct 2026, 00:00Z. Monday 19th 16:00 BST (15:00Z) is >12h away.
const NOW = new Date("2026-10-18T00:00Z");
const MONDAY_4PM = new Date("2026-10-19T15:00Z");

beforeAll(async () => {
  ({ db } = await createTestDb());
});

beforeEach(async () => {
  await resetTestDb(db);
  provider = await makeProvider(db);
  await db.insert(availabilityRules).values({ providerId: provider.id, weekday: 1, startTime: "16:00", endTime: "20:00" });
  [paid, free] = await db
    .insert(services)
    .values([
      { providerId: provider.id, slug: "maths", name: "Maths", durationMin: 60, priceCents: 4500, depositCents: 1000, bufferMin: 15 },
      { providerId: provider.id, slug: "intro", name: "Intro", durationMin: 15, priceCents: 0, depositCents: 0, bufferMin: 0 },
    ])
    .returning();
});

function request(overrides: Partial<HoldRequest> = {}): HoldRequest {
  return {
    provider,
    service: paid,
    startsAt: MONDAY_4PM,
    clientName: "Sam Student",
    clientEmail: "sam@example.com",
    clientTimezone: "Asia/Kolkata",
    note: null,
    now: NOW,
    ...overrides,
  };
}

describe("placeHold", () => {
  it("holds a paid slot for 10 minutes and blocks the buffer", async () => {
    const result = await placeHold(db, request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.status).toBe("held");
    expect(result.booking.holdExpiresAt).toEqual(new Date("2026-10-18T00:10Z"));
    expect(result.booking.endsAt).toEqual(new Date("2026-10-19T16:00Z"));
    expect(result.booking.blocksUntil).toEqual(new Date("2026-10-19T16:15Z"));
  });

  it("confirms a free service immediately, with no hold", async () => {
    const result = await placeHold(db, request({ service: free }));
    expect(result.ok && result.booking.status).toBe("confirmed");
    expect(result.ok && result.booking.holdExpiresAt).toBeNull();
  });

  it("rejects a start that isn't an offered slot", async () => {
    expect(await placeHold(db, request({ startsAt: new Date("2026-10-19T15:15Z") }))).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("rejects a slot inside the 12-hour notice period", async () => {
    expect(await placeHold(db, request({ now: new Date("2026-10-19T04:00Z") }))).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("rejects a slot already held by someone else", async () => {
    await placeHold(db, request());
    expect(await placeHold(db, request({ clientEmail: "other@example.com" }))).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("lets the database decide when two requests race past the availability check", async () => {
    // Both requests read availability before either inserts; the exclusion
    // constraint rejects the second insert.
    const results = await Promise.all([
      placeHold(db, request({ clientEmail: "a@example.com" })),
      placeHold(db, request({ clientEmail: "b@example.com" })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, reason: "taken" });
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  it("frees a slot whose hold has lapsed and retires the old hold", async () => {
    const first = await placeHold(db, request());
    const later = new Date(NOW.getTime() + 11 * 60_000);
    const second = await placeHold(db, request({ clientEmail: "late@example.com", now: later }));

    expect(second.ok).toBe(true);
    if (!first.ok) throw new Error("setup");
    const old = await db.query.bookings.findFirst({ where: eq(bookings.id, first.booking.id) });
    expect(old?.status).toBe("expired");
  });

  it("frees a slot when its hold is released", async () => {
    const first = await placeHold(db, request());
    if (!first.ok) throw new Error("setup");
    expect(await releaseHold(db, first.booking.id)).toBe(true);
    expect((await placeHold(db, request({ clientEmail: "next@example.com" }))).ok).toBe(true);
  });

  it("never releases a confirmed booking", async () => {
    const booked = await placeHold(db, request({ service: free }));
    if (!booked.ok) throw new Error("setup");
    expect(await releaseHold(db, booked.booking.id)).toBe(false);
  });
});
