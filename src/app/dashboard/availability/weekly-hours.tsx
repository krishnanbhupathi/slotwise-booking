"use client";

import { useState, useTransition } from "react";
import { Button, Card, FormMessage, Select } from "@/components/ui";
import { QUARTER_HOURS, WEEKDAYS, formatTime } from "@/lib/time-options";
import type { WeeklyAvailability } from "@/lib/validation";
import { saveWeeklyHours, type ActionResult } from "./actions";

type Range = { start: string; end: string };
type DayState = Record<number, Range[]>;

const DEFAULT_RANGE: Range = { start: "09:00", end: "17:00" };

export function WeeklyHours({ initial }: { initial: WeeklyAvailability }) {
  const [days, setDays] = useState<DayState>(() => Object.fromEntries(initial.map((d) => [d.weekday, d.ranges])));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (weekday: number, ranges: Range[]) => {
    setDays((prev) => ({ ...prev, [weekday]: ranges }));
    setResult(null);
  };

  const save = () => {
    const week = WEEKDAYS.filter((d) => days[d.iso]?.length).map((d) => ({ weekday: d.iso, ranges: days[d.iso] }));
    startTransition(async () => setResult(await saveWeeklyHours(week)));
  };

  // Errors are keyed by position in the submitted array; map them back to weekdays.
  const submitted = WEEKDAYS.filter((d) => days[d.iso]?.length);
  const errorFor = (iso: number) => {
    const index = submitted.findIndex((d) => d.iso === iso);
    if (index < 0 || !result?.errors) return undefined;
    return Object.entries(result.errors).find(([key]) => key.startsWith(`${index}.`))?.[1];
  };

  return (
    <Card className="divide-y divide-stone-100">
      {WEEKDAYS.map((day) => {
        const ranges = days[day.iso] ?? [];
        const error = errorFor(day.iso);
        return (
          <fieldset key={day.iso} className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4" aria-describedby={error ? `day-${day.iso}-error` : undefined}>
            <legend className="sr-only">{day.name}</legend>
            <label className="flex w-full items-center gap-2 pt-2 text-sm font-medium sm:w-36">
              <input
                type="checkbox"
                className="size-4 accent-brand-700"
                checked={ranges.length > 0}
                onChange={(e) => update(day.iso, e.target.checked ? [DEFAULT_RANGE] : [])}
              />
              {day.name}
            </label>
            <div className="flex-1 space-y-2">
              {ranges.length === 0 && <p className="pt-2 text-sm text-stone-500">Unavailable</p>}
              {ranges.map((range, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TimeSelect
                    label={`${day.name} range ${i + 1} start`}
                    value={range.start}
                    invalid={!!error}
                    onChange={(start) => update(day.iso, ranges.map((r, j) => (j === i ? { ...r, start } : r)))}
                    options={QUARTER_HOURS.slice(0, -1)}
                  />
                  <span className="text-sm text-stone-500">to</span>
                  <TimeSelect
                    label={`${day.name} range ${i + 1} end`}
                    value={range.end}
                    invalid={!!error}
                    onChange={(end) => update(day.iso, ranges.map((r, j) => (j === i ? { ...r, end } : r)))}
                    options={QUARTER_HOURS.slice(1)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove ${day.name} range ${i + 1}`}
                    onClick={() => update(day.iso, ranges.filter((_, j) => j !== i))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {error && (
                <p id={`day-${day.iso}-error`} className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>
            {ranges.length > 0 && ranges.length < 6 && (
              <Button
                type="button"
                variant="ghost"
                className="text-brand-700"
                onClick={() => update(day.iso, [...ranges, nextRange(ranges)])}
              >
                + Add hours
              </Button>
            )}
          </fieldset>
        );
      })}
      <div className="flex items-center gap-3 px-5 py-4">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save weekly hours"}
        </Button>
        <FormMessage state={result} />
      </div>
    </Card>
  );
}

/** A new range starting an hour after the last one ends, if there's room. */
function nextRange(ranges: Range[]): Range {
  const lastEnd = ranges.at(-1)?.end ?? "09:00";
  const startIdx = Math.min(QUARTER_HOURS.indexOf(lastEnd) + 4, 92);
  return { start: QUARTER_HOURS[startIdx], end: QUARTER_HOURS[Math.min(startIdx + 8, 96)] };
}

function TimeSelect({
  label,
  value,
  options,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      aria-invalid={invalid}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-28 sm:w-32"
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {formatTime(t)}
        </option>
      ))}
    </Select>
  );
}
