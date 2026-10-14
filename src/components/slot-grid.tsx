"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { cityName, formatDayIn, formatTimeIn } from "@/lib/format";
import { groupByLocalDate } from "@/lib/slots";
import { Card, Select, cx } from "./ui";

export type ZoneOption = { value: string; label: string };

const noopSubscribe = () => () => {};

/**
 * The viewer's display zone: their browser's zone by default, changeable.
 * Null during server render (the browser zone isn't known there).
 * `timeZones` is built on the server; a browser alias it lacks is added.
 */
export function useViewerZone(timeZones: ZoneOption[]) {
  const browserZone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const zoneOptions =
    browserZone && !timeZones.some((z) => z.value === browserZone)
      ? [{ value: browserZone, label: browserZone.replaceAll("_", " ") }, ...timeZones]
      : timeZones;
  return { zone: chosen ?? browserZone, setZone: setChosen, zoneOptions };
}

/** Zone selector, date strip and time buttons. Selection state lives in the parent. */
export function SlotGrid({
  slots,
  zone,
  onZoneChange,
  zoneOptions,
  picked,
  onPick,
  providerName,
  providerTimeZone,
}: {
  slots: string[];
  zone: string;
  onZoneChange: (zone: string) => void;
  zoneOptions: ZoneOption[];
  picked: string | null;
  onPick: (iso: string | null) => void;
  providerName: string;
  providerTimeZone: string;
}) {
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const days = useMemo(() => [...groupByLocalDate(slots.map((s) => new Date(s)), zone)], [slots, zone]);
  const activeDate = days.some(([d]) => d === pickedDate) ? pickedDate : (days[0]?.[0] ?? null);
  const times = days.find(([d]) => d === activeDate)?.[1] ?? [];

  if (days.length === 0) {
    return <Card className="p-6 text-sm text-stone-600">No times are available in the next 30 days. Check back later.</Card>;
  }

  return (
    <section aria-labelledby="pick-heading" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pick-heading" className="font-medium">
          Choose a time
        </h2>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Times in
          <Select
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
            className="w-56 py-1.5"
            aria-label="Time zone for displayed times"
          >
            {zoneOptions.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div role="tablist" aria-label="Dates" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map(([date, starts]) => {
          const selected = date === activeDate;
          const [weekday, ...rest] = formatDayIn(starts[0], zone).split(" ");
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setPickedDate(date);
                onPick(null);
              }}
              className={cx(
                "flex min-w-20 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm",
                selected ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-200 bg-white hover:border-stone-400",
              )}
            >
              <span className="font-medium">{weekday}</span>
              <span>{rest.join(" ")}</span>
              <span className={cx("mt-0.5 text-xs", selected ? "text-stone-700" : "text-stone-500")}>{starts.length} times</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label="Times">
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {times.map((start) => {
            const iso = start.toISOString();
            const selected = iso === picked;
            return (
              <li key={iso}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPick(iso)}
                  className={cx(
                    "w-full rounded-md border px-2 py-2 text-sm font-medium",
                    selected
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-stone-200 bg-white text-stone-800 hover:border-brand-600",
                  )}
                >
                  {formatTimeIn(start, zone)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {zone !== providerTimeZone && (
        <p className="mt-3 text-xs text-stone-500">
          {providerName} is in {cityName(providerTimeZone)}; times are converted for you.
        </p>
      )}
    </section>
  );
}

export function SlotGridSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-stone-100" aria-label="Loading available times" />;
}
