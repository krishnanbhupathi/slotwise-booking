import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { bookings, providers, services, users } from "./schema";

let db: TestDb;
let providerId: string;
let otherProviderId: string;
let serviceId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());

  const [u1, u2] = await db
    .insert(users)
    .values([{ email: "a@example.com" }, { email: "b@example.com" }])
    .returning();
  const [p1, p2] = await db
    .insert(providers)
    .values([
      { userId: u1.id, handle: "maya-tutor", name: "Maya", email: "a@example.com", timezone: "Europe/London" },
      { userId: u2.id, handle: "other-tutor", name: "Sam", email: "b@example.com", timezone: "Asia/Kolkata" },
    ])
    .returning();
  providerId = p1.id;
  otherProviderId = p2.id;

  const [s] = await db
    .insert(services)
    .values({ providerId, slug: "maths", name: "Maths", durationMin: 60, priceCents: 5000, depositCents: 1000 })
    .returning();
  serviceId = s.id;
});

beforeEach(async () => {
  await db.delete(bookings);
});

/** A booking for the test provider; times are UTC ISO strings. */
function booking(
  start: string,
  end: string,
  opts: { status?: "held" | "confirmed" | "cancelled" | "refunded" | "expired"; blocksUntil?: string; provider?: string } = {},
) {
  return {
    providerId: opts.provider ?? providerId,
    serviceId,
    clientName: "Client",
    clientEmail: "client@example.com",
    startsAt: new Date(start),
    endsAt: new Date(end),
    blocksUntil: new Date(opts.blocksUntil ?? end),
    status: opts.status ?? "confirmed",
  };
}

async function insertFails(row: ReturnType<typeof booking>) {
  // drizzle wraps driver errors; the Postgres error is on `cause`.
  const error = await db
    .insert(bookings)
    .values(row)
    .then(() => null, (e: { cause?: { code?: string } }) => e);
  return error?.cause?.code ?? null;
}

describe("bookings_no_overlap exclusion constraint", () => {
  it("rejects an overlapping booking for the same provider", async () => {
    await db.insert(bookings).values(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z"));
    expect(await insertFails(booking("2026-10-20T09:30Z", "2026-10-20T10:30Z"))).toBe("23P01");
  });

  it("rejects a booking that overlaps a live hold", async () => {
    await db.insert(bookings).values(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z", { status: "held" }));
    expect(await insertFails(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z"))).toBe("23P01");
  });

  it("allows back-to-back bookings (ranges are half-open)", async () => {
    await db.insert(bookings).values(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z"));
    expect(await insertFails(booking("2026-10-20T10:00Z", "2026-10-20T11:00Z"))).toBeNull();
  });

  it("counts the buffer: the next booking cannot start inside it", async () => {
    await db
      .insert(bookings)
      .values(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z", { blocksUntil: "2026-10-20T10:15Z" }));
    expect(await insertFails(booking("2026-10-20T10:00Z", "2026-10-20T11:00Z"))).toBe("23P01");
    expect(await insertFails(booking("2026-10-20T10:15Z", "2026-10-20T11:15Z"))).toBeNull();
  });

  it.each(["cancelled", "refunded", "expired"] as const)("ignores %s bookings", async (status) => {
    await db.insert(bookings).values(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z", { status }));
    expect(await insertFails(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z"))).toBeNull();
  });

  it("does not block other providers at the same time", async () => {
    await db.insert(bookings).values(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z"));
    expect(
      await insertFails(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z", { provider: otherProviderId })),
    ).toBeNull();
  });

  it("frees the slot once a hold is marked expired", async () => {
    const [held] = await db
      .insert(bookings)
      .values(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z", { status: "held" }))
      .returning();
    await db.update(bookings).set({ status: "expired" }).where(eq(bookings.id, held.id));
    expect(await insertFails(booking("2026-10-20T09:00Z", "2026-10-20T10:00Z"))).toBeNull();
  });
});

describe("check constraints", () => {
  it("rejects a deposit larger than the price", async () => {
    const error = await db
      .insert(services)
      .values({ providerId, slug: "bad", name: "Bad", durationMin: 30, priceCents: 1000, depositCents: 2000 })
      .then(() => null, (e: { cause?: { code?: string } }) => e.cause?.code);
    expect(error).toBe("23514");
  });

  it("rejects an invalid handle", async () => {
    const [u] = await db.insert(users).values({ email: "c@example.com" }).returning();
    const error = await db
      .insert(providers)
      .values({ userId: u.id, handle: "Bad Handle", name: "C", email: "c@example.com", timezone: "UTC" })
      .then(() => null, (e: { cause?: { code?: string } }) => e.cause?.code);
    expect(error).toBe("23514");
  });
});
