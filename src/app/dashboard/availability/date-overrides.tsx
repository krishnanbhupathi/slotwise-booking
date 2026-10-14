"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, Field, FormMessage, Input, Select } from "@/components/ui";
import { QUARTER_HOURS, formatTime } from "@/lib/time-options";
import { removeDateOverride, saveDateOverride } from "./actions";

type Override = { id: string; date: string; startTime: string | null; endTime: string | null };

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function DateOverrides({ overrides, today }: { overrides: Override[]; today: string }) {
  const [state, action, pending] = useActionState(saveDateOverride, null);
  const [mode, setMode] = useState<"closed" | "hours">("closed");
  const [removing, startRemove] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const errors = state?.errors ?? {};

  return (
    <Card className="p-5">
      <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3" noValidate>
        <Field label="Date" htmlFor="override-date" error={errors.date}>
          <Input id="override-date" name="date" type="date" min={today} required className="w-44" />
        </Field>
        <Field label="Availability" htmlFor="override-mode">
          <Select id="override-mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as "closed" | "hours")} className="w-44">
            <option value="closed">Day off</option>
            <option value="hours">Custom hours</option>
          </Select>
        </Field>
        {mode === "hours" && (
          <>
            <Field label="From" htmlFor="override-start">
              <Select id="override-start" name="start" defaultValue="09:00" className="w-32">
                {QUARTER_HOURS.slice(0, -1).map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </Select>
            </Field>
            <Field label="To" htmlFor="override-end" error={errors.end}>
              <Select id="override-end" name="end" defaultValue="13:00" className="w-32">
                {QUARTER_HOURS.slice(1).map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Add date"}
        </Button>
      </form>
      <div className="mt-2 min-h-5">
        <FormMessage state={state} />
      </div>

      {overrides.length > 0 ? (
        <ul className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span>
                <span className="font-medium">{formatDate(o.date)}</span>
                <span className="ml-3 text-stone-600">
                  {o.startTime && o.endTime ? `${formatTime(o.startTime)} – ${formatTime(o.endTime)}` : "Day off"}
                </span>
              </span>
              <Button
                variant="ghost"
                disabled={removing}
                aria-label={`Remove ${formatDate(o.date)}`}
                onClick={() => startRemove(() => removeDateOverride(o.id))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-stone-500">No upcoming date changes.</p>
      )}
    </Card>
  );
}
