import { and, asc, eq, gte } from "drizzle-orm";
import { availabilityRules, dateOverrides } from "@/db/schema";
import type { Database } from "@/db/types";
import type { DateOverrideInput, WeeklyAvailability } from "@/lib/validation";

/** Postgres returns "HH:MM:SS"; the app works in "HH:MM". */
const hhmm = (time: string) => time.slice(0, 5);

export async function getWeeklyAvailability(db: Database, providerId: string): Promise<WeeklyAvailability> {
  const rules = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.providerId, providerId))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));

  const byDay = new Map<number, { start: string; end: string }[]>();
  for (const rule of rules) {
    const ranges = byDay.get(rule.weekday) ?? [];
    ranges.push({ start: hhmm(rule.startTime), end: hhmm(rule.endTime) });
    byDay.set(rule.weekday, ranges);
  }
  return [...byDay].map(([weekday, ranges]) => ({ weekday, ranges }));
}

/** Replaces the whole week in one transaction, so a failed save never leaves half a schedule. */
export async function replaceWeeklyAvailability(db: Database, providerId: string, week: WeeklyAvailability) {
  const rows = week.flatMap((day) =>
    day.ranges.map((r) => ({ providerId, weekday: day.weekday, startTime: r.start, endTime: r.end })),
  );
  await db.transaction(async (tx) => {
    await tx.delete(availabilityRules).where(eq(availabilityRules.providerId, providerId));
    if (rows.length) await tx.insert(availabilityRules).values(rows);
  });
}

/** Overrides from `fromDate` (YYYY-MM-DD) onwards, soonest first. */
export async function listDateOverrides(db: Database, providerId: string, fromDate: string) {
  const rows = await db
    .select()
    .from(dateOverrides)
    .where(and(eq(dateOverrides.providerId, providerId), gte(dateOverrides.date, fromDate)))
    .orderBy(asc(dateOverrides.date));
  return rows.map((row) => ({
    ...row,
    startTime: row.startTime && hhmm(row.startTime),
    endTime: row.endTime && hhmm(row.endTime),
  }));
}

/** One override per date: saving a date that already has one replaces it. */
export async function upsertDateOverride(db: Database, providerId: string, input: DateOverrideInput) {
  const hours = input.closed ? { startTime: null, endTime: null } : { startTime: input.start, endTime: input.end };
  await db
    .insert(dateOverrides)
    .values({ providerId, date: input.date, ...hours })
    .onConflictDoUpdate({ target: [dateOverrides.providerId, dateOverrides.date], set: hours });
}

export async function deleteDateOverride(db: Database, providerId: string, id: string) {
  await db.delete(dateOverrides).where(and(eq(dateOverrides.id, id), eq(dateOverrides.providerId, providerId)));
}
