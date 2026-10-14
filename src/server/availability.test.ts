import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import {
  deleteDateOverride,
  getWeeklyAvailability,
  listDateOverrides,
  replaceWeeklyAvailability,
  upsertDateOverride,
} from "./availability";

let db: TestDb;
beforeAll(async () => {
  ({ db } = await createTestDb());
});

describe("weekly availability", () => {
  it("round-trips a week grouped by day, ranges in order", async () => {
    const provider = await makeProvider(db);
    await replaceWeeklyAvailability(db, provider.id, [
      { weekday: 1, ranges: [{ start: "14:00", end: "18:00" }, { start: "09:00", end: "12:00" }] },
      { weekday: 5, ranges: [{ start: "18:00", end: "24:00" }] },
    ]);
    expect(await getWeeklyAvailability(db, provider.id)).toEqual([
      { weekday: 1, ranges: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
      { weekday: 5, ranges: [{ start: "18:00", end: "24:00" }] },
    ]);
  });

  it("replaces the previous week entirely", async () => {
    const provider = await makeProvider(db);
    await replaceWeeklyAvailability(db, provider.id, [{ weekday: 1, ranges: [{ start: "09:00", end: "17:00" }] }]);
    await replaceWeeklyAvailability(db, provider.id, [{ weekday: 3, ranges: [{ start: "10:00", end: "11:00" }] }]);
    expect(await getWeeklyAvailability(db, provider.id)).toEqual([
      { weekday: 3, ranges: [{ start: "10:00", end: "11:00" }] },
    ]);
  });

  it("does not touch other providers' hours", async () => {
    const a = await makeProvider(db);
    const b = await makeProvider(db);
    await replaceWeeklyAvailability(db, a.id, [{ weekday: 2, ranges: [{ start: "09:00", end: "10:00" }] }]);
    await replaceWeeklyAvailability(db, b.id, []);
    expect(await getWeeklyAvailability(db, a.id)).toHaveLength(1);
  });
});

describe("date overrides", () => {
  it("upserts one override per date and lists upcoming ones", async () => {
    const provider = await makeProvider(db);
    await upsertDateOverride(db, provider.id, { date: "2026-12-24", closed: false, start: "09:00", end: "12:00" });
    await upsertDateOverride(db, provider.id, { date: "2026-12-24", closed: true });
    await upsertDateOverride(db, provider.id, { date: "2026-01-01", closed: true });

    const upcoming = await listDateOverrides(db, provider.id, "2026-10-16");
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({ date: "2026-12-24", startTime: null, endTime: null });
  });

  it("only deletes the caller's own overrides", async () => {
    const owner = await makeProvider(db);
    const intruder = await makeProvider(db);
    await upsertDateOverride(db, owner.id, { date: "2026-12-25", closed: true });
    const [override] = await listDateOverrides(db, owner.id, "2026-01-01");

    await deleteDateOverride(db, intruder.id, override.id);
    expect(await listDateOverrides(db, owner.id, "2026-01-01")).toHaveLength(1);
    await deleteDateOverride(db, owner.id, override.id);
    expect(await listDateOverrides(db, owner.id, "2026-01-01")).toHaveLength(0);
  });
});
