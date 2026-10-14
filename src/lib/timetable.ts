import { groupByLocalDate } from "./slots";

/**
 * Lays slot starts out as school-timetable weeks in the viewer's zone:
 * Monday-first columns, one row per start time that occurs that week.
 * Pure, so the booking page renders the same grid on server and client.
 */
export type TimetableDay = { date: string; starts: Date[] };
export type TimetableWeek = {
  /** "2026-10-19": the Monday. */
  monday: string;
  days: TimetableDay[];
  /** Row keys "HH:MM" (24-hour, viewer's zone), earliest first. */
  times: string[];
  /** date → time key → start. */
  cells: Map<string, Map<string, Date>>;
};

const DAY_MS = 86_400_000;

/** Calendar arithmetic on "YYYY-MM-DD" strings (no time zones involved). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export function timeKey(start: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(start);
}

export function buildTimetable(starts: Date[], timeZone: string): TimetableWeek[] {
  const byDate = groupByLocalDate(starts, timeZone);
  const weeks = new Map<string, TimetableWeek>();
  for (const [date, dayStarts] of byDate) {
    const monday = mondayOf(date);
    let week = weeks.get(monday);
    if (!week) {
      week = {
        monday,
        days: Array.from({ length: 7 }, (_, i) => ({ date: addDays(monday, i), starts: [] })),
        times: [],
        cells: new Map(),
      };
      weeks.set(monday, week);
    }
    const day = week.days.find((d) => d.date === date)!;
    day.starts.push(...dayStarts);
    const row = new Map<string, Date>();
    for (const start of dayStarts) row.set(timeKey(start, timeZone), start);
    week.cells.set(date, row);
  }
  for (const week of weeks.values()) {
    week.times = [...new Set([...week.cells.values()].flatMap((row) => [...row.keys()]))].sort();
  }
  return [...weeks.values()].sort((a, b) => a.monday.localeCompare(b.monday));
}
