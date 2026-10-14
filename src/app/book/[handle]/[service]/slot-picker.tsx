"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button, Card, Field, FormMessage, Input, Select, Textarea, cx } from "@/components/ui";
import { cityName, formatDateTimeIn, formatDayIn, formatTimeIn } from "@/lib/format";
import { groupByLocalDate } from "@/lib/slots";
import { createBooking } from "./actions";

type ZoneOption = { value: string; label: string };

const noopSubscribe = () => () => {};

export function SlotPicker({
  handle,
  slug,
  slots,
  providerName,
  providerTimeZone,
  depositLabel,
  timeZones,
}: {
  handle: string;
  slug: string;
  /** Slot starts as ISO strings. */
  slots: string[];
  providerName: string;
  providerTimeZone: string;
  depositLabel: string | null;
  timeZones: ZoneOption[];
}) {
  const router = useRouter();
  const browserZone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const zone = chosenZone ?? browserZone;

  const [state, action, pending] = useActionState(createBooking.bind(null, handle, slug), null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const days = useMemo(
    () => (zone ? [...groupByLocalDate(slots.map((s) => new Date(s)), zone)] : []),
    [slots, zone],
  );
  const activeDate = days.some(([d]) => d === pickedDate) ? pickedDate : (days[0]?.[0] ?? null);
  const times = days.find(([d]) => d === activeDate)?.[1] ?? [];

  // The chosen time was taken while the form was open: clear the choice and reload slots.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.slotGone) setPicked(null);
  }
  useEffect(() => {
    if (state?.slotGone) router.refresh();
  }, [state, router]);

  const zoneOptions =
    browserZone && !timeZones.some((z) => z.value === browserZone)
      ? [{ value: browserZone, label: browserZone.replaceAll("_", " ") }, ...timeZones]
      : timeZones;

  if (!zone) {
    return <div className="mt-8 h-64 animate-pulse rounded-lg bg-stone-100" aria-label="Loading available times" />;
  }

  if (days.length === 0) {
    return (
      <Card className="mt-8 p-6 text-sm text-stone-600">
        No times are available in the next 30 days. Check back later.
      </Card>
    );
  }

  const pickedStart = picked ? new Date(picked) : null;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="pick-heading" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pick-heading" className="font-medium">
            Choose a time
          </h2>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            Times in
            <Select
              value={zone}
              onChange={(e) => setChosenZone(e.target.value)}
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
            return (
              <button
                key={date}
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setPickedDate(date);
                  setPicked(null);
                }}
                className={cx(
                  "flex min-w-20 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm",
                  selected
                    ? "border-brand-700 bg-brand-50 text-brand-800"
                    : "border-stone-200 bg-white hover:border-stone-400",
                )}
              >
                <span className="font-medium">{formatDayIn(starts[0], zone).split(" ")[0]}</span>
                <span>{formatDayIn(starts[0], zone).split(" ").slice(1).join(" ")}</span>
                <span className="mt-0.5 text-xs text-stone-500">{starts.length} times</span>
              </button>
            );
          })}
        </div>

        <ul role="tabpanel" aria-label="Times" className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {times.map((start) => {
            const iso = start.toISOString();
            const selected = iso === picked;
            return (
              <li key={iso}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPicked(iso)}
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
        {zone !== providerTimeZone && (
          <p className="mt-3 text-xs text-stone-500">
            {providerName} is in {cityName(providerTimeZone)}; times are converted for you.
          </p>
        )}
      </section>

      <section aria-labelledby="details-heading">
        <Card className="p-5">
          <h2 id="details-heading" className="font-medium">
            Your details
          </h2>
          {pickedStart ? (
            <p className="mt-1 text-sm text-stone-700">
              {formatDateTimeIn(pickedStart, zone)}
              {zone !== providerTimeZone && (
                <span className="block text-xs text-stone-500">
                  {formatTimeIn(pickedStart, providerTimeZone)} for {providerName}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-stone-500">Pick a time first.</p>
          )}
          <form action={action} className="mt-4 space-y-4" noValidate>
            <input type="hidden" name="startsAt" value={picked ?? ""} />
            <input type="hidden" name="timezone" value={zone} />
            <Field label="Name" htmlFor="name" error={state?.errors?.name}>
              <Input id="name" name="name" autoComplete="name" required defaultValue={state?.values?.name} aria-invalid={!!state?.errors?.name} />
            </Field>
            <Field label="Email" htmlFor="email" error={state?.errors?.email} hint="Your confirmation goes here.">
              <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} aria-invalid={!!state?.errors?.email} />
            </Field>
            <Field label="Anything to share? (optional)" htmlFor="note" error={state?.errors?.note}>
              <Textarea id="note" name="note" rows={3} defaultValue={state?.values?.note} placeholder="Topics, exam board, goals…" />
            </Field>
            <Button type="submit" className="w-full" disabled={!picked || pending}>
              {pending ? "Reserving…" : depositLabel ? `Continue to pay ${depositLabel} deposit` : "Confirm booking"}
            </Button>
            {depositLabel && (
              <p className="text-xs text-stone-500">
                We hold this time for 10 minutes while you pay. The rest is paid to {providerName} directly.
              </p>
            )}
            <FormMessage state={state?.message ? { ok: false, message: state.message } : null} />
          </form>
        </Card>
      </section>
    </div>
  );
}
