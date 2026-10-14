"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { cityName, formatDateTimeIn, formatDayIn, formatTimeIn } from "@/lib/format";
import { subjectClass } from "@/lib/subjects";
import { buildTimetable, type TimetableWeek } from "@/lib/timetable";
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

type GridProps = {
  slots: string[];
  zone: string;
  onZoneChange: (zone: string) => void;
  zoneOptions: ZoneOption[];
  picked: string | null;
  onPick: (iso: string | null) => void;
  providerName: string;
  providerTimeZone: string;
  /** Timetable colour of the service (see lib/subjects). */
  subject?: number;
};

/** "Thu 22 Oct" for a "2026-10-22" key: noon UTC is the same calendar day in every zone we label it in. */
const dayLabel = (date: string) => formatDayIn(new Date(`${date}T12:00:00Z`), "UTC");

/**
 * Zone selector and the available times as a school timetable: a week grid on
 * wider screens (days across, times down, closed days hatched), one day at a
 * time on phones. Selection state lives in the parent.
 */
export function SlotGrid(props: GridProps) {
  const { slots, zone, onZoneChange, zoneOptions, providerName, providerTimeZone, subject = 0 } = props;
  const weeks = useMemo(() => buildTimetable(slots.map((s) => new Date(s)), zone), [slots, zone]);

  if (weeks.length === 0) {
    return <Card className="p-6 text-sm text-stone-600">No times are available in the next 30 days. Check back later.</Card>;
  }

  return (
    <section aria-labelledby="pick-heading" className={cx("min-w-0", subjectClass(subject))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pick-heading" className="font-display text-xl font-bold">
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

      <div className="mt-4 hidden sm:block">
        <WeekView weeks={weeks} {...props} />
      </div>
      <div className="mt-4 sm:hidden">
        <DayView weeks={weeks} {...props} />
      </div>

      {zone !== providerTimeZone && (
        <p className="mt-3 text-xs text-stone-600">
          {providerName} is in {cityName(providerTimeZone)}; times are converted for you.
        </p>
      )}
    </section>
  );
}

function WeekView({ weeks, zone, picked, onPick }: GridProps & { weeks: TimetableWeek[] }) {
  const [chosenWeek, setChosenWeek] = useState(0);
  // Clamped: changing the zone can change how many weeks there are.
  const index = Math.min(chosenWeek, weeks.length - 1);
  const week = weeks[index]!;
  const first = week.days[0]!.date;
  const last = week.days[6]!.date;
  const range = `${dayLabel(first).split(" ").slice(1).join(" ")} – ${dayLabel(last).split(" ").slice(1).join(" ")}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <WeekButton label="Previous week" disabled={index === 0} onClick={() => setChosenWeek(index - 1)}>
          ‹
        </WeekButton>
        <p className="font-display text-sm font-bold" aria-live="polite">
          Week of {range}
        </p>
        <WeekButton label="Next week" disabled={index === weeks.length - 1} onClick={() => setChosenWeek(index + 1)}>
          ›
        </WeekButton>
      </div>
      <div className="overflow-hidden rounded-lg border-2 border-stone-900 bg-white">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Available times, week of {range}. Hatched days have no times.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16">
                <span className="sr-only">Time</span>
              </th>
              {week.days.map((day) => {
                const [weekday, date] = dayLabel(day.date).split(" ");
                return (
                  <th
                    key={day.date}
                    scope="col"
                    className={cx(
                      "border-l border-stone-200 px-1 py-2 text-center font-display text-sm",
                      day.starts.length ? "font-bold text-stone-900" : "font-medium text-stone-500",
                    )}
                  >
                    {weekday} {date}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {week.times.map((time) => {
              const sample = week.days.map((d) => week.cells.get(d.date)?.get(time)).find(Boolean)!;
              return (
                <tr key={time} className="border-t border-stone-200">
                  <th scope="row" className="px-1 py-1 text-center font-display text-xs font-bold whitespace-nowrap text-stone-600">
                    {formatTimeIn(sample, zone)}
                  </th>
                  {week.days.map((day) => {
                    const start = week.cells.get(day.date)?.get(time);
                    const closed = day.starts.length === 0;
                    return (
                      <td key={day.date} className={cx("h-11 border-l border-stone-200 p-1", closed && "hatched")}>
                        {start && <SlotButton start={start} zone={zone} picked={picked} onPick={onPick} />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayView({ weeks, zone, picked, onPick }: GridProps & { weeks: TimetableWeek[] }) {
  const days = weeks.flatMap((w) => w.days).filter((d) => d.starts.length > 0);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const activeDate = days.some((d) => d.date === pickedDate) ? pickedDate : (days[0]?.date ?? null);
  const starts = days.find((d) => d.date === activeDate)?.starts ?? [];

  return (
    <>
      <div role="tablist" aria-label="Dates" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((day) => {
          const selected = day.date === activeDate;
          const [weekday, ...rest] = dayLabel(day.date).split(" ");
          return (
            <button
              key={day.date}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setPickedDate(day.date);
                onPick(null);
              }}
              className={cx(
                "flex min-w-18 shrink-0 flex-col items-center rounded-md border-2 px-3 py-2 text-sm",
                selected ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white hover:border-stone-900",
              )}
            >
              <span className="font-display font-bold">{weekday}</span>
              <span>{rest.join(" ")}</span>
              <span className={cx("mt-0.5 text-xs", selected ? "text-stone-200" : "text-stone-600")}>{day.starts.length} times</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" aria-label="Times">
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {starts.map((start) => (
            <li key={start.toISOString()}>
              <SlotButton start={start} zone={zone} picked={picked} onPick={onPick} showTime />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** One open time: a lesson block in the subject colour. Picking it outlines it in ink. */
function SlotButton({ start, zone, picked, onPick, showTime }: { start: Date; zone: string; picked: string | null; onPick: (iso: string) => void; showTime?: boolean }) {
  const iso = start.toISOString();
  const selected = iso === picked;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Book ${formatDateTimeIn(start, zone)}`}
      data-start={iso}
      onClick={() => onPick(iso)}
      className={cx(
        "lesson block h-full min-h-9 w-full rounded-md px-1.5 py-1.5 font-display text-sm font-bold transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900",
        selected && "outline-[3px] outline-offset-1 outline-stone-900",
      )}
    >
      {showTime ? formatTimeIn(start, zone) : selected ? "Picked" : "Open"}
    </button>
  );
}

function WeekButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-md border-2 border-stone-900 bg-white font-display text-lg font-bold hover:bg-stone-100 disabled:border-stone-200 disabled:text-stone-400"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

export function SlotGridSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-stone-100" aria-label="Loading available times" />;
}
