import { Temporal } from "temporal-polyfill";
import { toMinutes } from "./validation";

/**
 * Slot generation.
 *
 * Availability is stored as wall-clock times in the provider's time zone
 * ("Mondays 16:00–20:00, Europe/London"). Bookings are stored as UTC instants.
 * This module turns the first into the second for a date range, then removes
 * anything too soon, too far ahead, or overlapping an existing booking.
 *
 * Daylight-saving rules (wall-clock grid):
 * - Start times sit on a fixed wall-clock grid (every 30 minutes from
 *   midnight), so "16:00" means 16:00 local before and after a DST change.
 * - A start time that doesn't exist (the skipped hour when clocks go forward)
 *   is not offered.
 * - A start time that happens twice (the repeated hour when clocks go back)
 *   is offered once, at its first occurrence.
 * - Session length is real elapsed time: a 60-minute session that crosses a
 *   DST change still lasts 60 minutes, and must end by the window's end.
 */

export type WeeklyRule = { weekday: number; start: string; end: string };
export type DateOverrideRule = { date: string; start: string | null; end: string | null };
export type Interval = { start: Date; end: Date };

export type SlotInput = {
  /** Provider's IANA time zone. */
  timeZone: string;
  weekly: WeeklyRule[];
  overrides: DateOverrideRule[];
  durationMin: number;
  bufferMin: number;
  /** Existing live bookings: [starts_at, blocks_until). */
  busy: Interval[];
  now: Date;
  minNoticeMin?: number;
  horizonDays?: number;
  stepMin?: number;
};

export const BOOKING_RULES = {
  /** Earliest bookable start: 12 hours from now. */
  minNoticeMin: 12 * 60,
  /** Furthest bookable date: 30 days from today, in the provider's zone. */
  horizonDays: 30,
  /** Start times every 30 minutes on the wall clock. */
  stepMin: 30,
  /** How long a slot is held while the client pays. */
  holdMin: 10,
} as const;

const MINUTES_PER_DAY = 24 * 60;

/**
 * Local date + minutes past midnight (1440 = next midnight) → zoned time.
 * "compatible" resolves a skipped time forward and a repeated time to its first occurrence.
 */
function toZoned(date: Temporal.PlainDate, minutes: number, timeZone: string) {
  const day = minutes >= MINUTES_PER_DAY ? date.add({ days: 1 }) : date;
  const m = minutes % MINUTES_PER_DAY;
  const wall = day.toPlainDateTime({ hour: Math.floor(m / 60), minute: m % 60 });
  return { wall, zoned: wall.toZonedDateTime(timeZone, { disambiguation: "compatible" }) };
}

/** Epoch ms of a start time, or null if that wall time doesn't exist (skipped by a DST change). */
function startInstant(date: Temporal.PlainDate, minutes: number, timeZone: string): number | null {
  const { wall, zoned } = toZoned(date, minutes, timeZone);
  return zoned.toPlainDateTime().equals(wall) ? zoned.epochMilliseconds : null;
}

/** Wall-clock windows (minutes from midnight) for one local date: an override replaces the weekly rule. */
function windowsFor(date: Temporal.PlainDate, input: SlotInput): { start: number; end: number }[] {
  const iso = date.toString();
  const override = input.overrides.find((o) => o.date === iso);
  if (override) {
    return override.start && override.end ? [{ start: toMinutes(override.start), end: toMinutes(override.end) }] : [];
  }
  return input.weekly
    .filter((r) => r.weekday === date.dayOfWeek)
    .map((r) => ({ start: toMinutes(r.start), end: toMinutes(r.end) }));
}

const overlaps = (aStart: number, aEnd: number, b: Interval) => aStart < b.end.getTime() && aEnd > b.start.getTime();

export function generateSlots(input: SlotInput): Interval[] {
  const {
    timeZone,
    durationMin,
    bufferMin,
    busy,
    now,
    minNoticeMin = BOOKING_RULES.minNoticeMin,
    horizonDays = BOOKING_RULES.horizonDays,
    stepMin = BOOKING_RULES.stepMin,
  } = input;

  const earliest = now.getTime() + minNoticeMin * 60_000;
  const durationMs = durationMin * 60_000;
  const blockMs = (durationMin + bufferMin) * 60_000;
  const today = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone).toPlainDate();

  const slots: Interval[] = [];
  for (let d = 0; d < horizonDays; d++) {
    const date = today.add({ days: d });
    for (const window of windowsFor(date, input)) {
      // A window ending in a skipped hour ends where the clocks jump to; one
      // ending in a repeated hour ends at its first occurrence.
      const windowEndMs = toZoned(date, window.end, timeZone).zoned.epochMilliseconds;

      for (let m = Math.ceil(window.start / stepMin) * stepMin; m < window.end; m += stepMin) {
        const startMs = startInstant(date, m, timeZone);
        if (startMs === null) continue;
        if (startMs + durationMs > windowEndMs) break;
        if (startMs < earliest) continue;
        if (busy.some((b) => overlaps(startMs, startMs + blockMs, b))) continue;
        slots.push({ start: new Date(startMs), end: new Date(startMs + durationMs) });
      }
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** True if `start` is exactly one of the generated slot starts. */
export function isAvailableStart(start: Date, input: SlotInput): boolean {
  return generateSlots(input).some((s) => s.start.getTime() === start.getTime());
}

/** Groups slot starts by calendar date in the viewer's zone: { "2026-10-19": [Date, …] }. */
export function groupByLocalDate(starts: Date[], timeZone: string): Map<string, Date[]> {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const groups = new Map<string, Date[]>();
  for (const start of starts) {
    const key = fmt.format(start);
    const list = groups.get(key) ?? [];
    list.push(start);
    groups.set(key, list);
  }
  return groups;
}
