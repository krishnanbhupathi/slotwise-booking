import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { bookings, providers, services } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { resetDemo } from "./demo";

let db: TestDb;
beforeAll(async () => {
  ({ db } = await createTestDb());
});

beforeEach(async () => {
  await resetTestDb(db);
});

const NOW = new Date("2026-10-15T12:00Z");

it("creates the demo tutor with three services and three future sample bookings", async () => {
  expect(await resetDemo(db, "demo@slotwise.dev", NOW)).toMatchObject({ sampleBookings: 3 });
  const rows = await db.select().from(bookings);
  expect(rows).toHaveLength(3);
  for (const b of rows) expect(b.startsAt.getTime()).toBeGreaterThan(NOW.getTime() + 2 * 86_400_000);
});

it("wipes visitors' changes on reset and is safe to run repeatedly", async () => {
  const { providerId } = await resetDemo(db, "demo@slotwise.dev", NOW);
  await db.insert(services).values({ providerId, slug: "vandal", name: "Vandal", durationMin: 30, priceCents: 0, depositCents: 0 });
  await db.update(providers).set({ name: "Renamed" }).where(eq(providers.id, providerId));

  await resetDemo(db, "demo@slotwise.dev", NOW);
  const names = (await db.select().from(services)).map((s) => s.slug).sort();
  expect(names).toEqual(["a-level-physics", "gcse-maths", "intro-call"]);
  expect((await db.query.providers.findFirst())?.name).toBe("Alex Morgan");
  expect(await db.select().from(bookings)).toHaveLength(3);
});
