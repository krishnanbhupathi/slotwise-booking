import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { bookings, providers, services } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { parseFormSchema } from "@/vendor/formwise/core";
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

it("gives the Physics service the Formwise intake form, and one sample booking its answers", async () => {
  await resetDemo(db, "demo@slotwise.dev", NOW);
  const physics = await db.query.services.findFirst({ where: eq(services.slug, "a-level-physics") });
  expect(physics!.intakeForm).toMatchObject({ version: 1, fetchedAt: NOW.toISOString(), schema: { title: "Before your first lesson" } });
  expect(parseFormSchema(physics!.intakeForm!.schema).ok).toBe(true);

  const withIntake = (await db.select().from(bookings)).filter((b) => b.intake);
  expect(withIntake).toHaveLength(1);
  expect(withIntake[0]!.serviceId).toBe(physics!.id);

  // A visitor removing the form is undone by the next reset.
  await db.update(services).set({ intakeForm: null }).where(eq(services.id, physics!.id));
  await resetDemo(db, "demo@slotwise.dev", NOW);
  expect((await db.query.services.findFirst({ where: eq(services.slug, "a-level-physics") }))!.intakeForm).not.toBeNull();
});
