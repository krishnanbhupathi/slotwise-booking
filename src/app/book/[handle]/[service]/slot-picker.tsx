"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { SlotGrid, SlotGridSkeleton, useViewerZone, type ZoneOption } from "@/components/slot-grid";
import { Button, Card, Field, FormMessage, Input, Textarea } from "@/components/ui";
import { formatDateTimeIn, formatTimeIn } from "@/lib/format";
import { createBooking } from "./actions";

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
  const { zone, setZone, zoneOptions } = useViewerZone(timeZones);
  const [state, action, pending] = useActionState(createBooking.bind(null, handle, slug), null);
  const [picked, setPicked] = useState<string | null>(null);

  // The chosen time was taken while the form was open: clear the choice and reload slots.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.slotGone) setPicked(null);
  }
  useEffect(() => {
    if (state?.slotGone) router.refresh();
  }, [state, router]);

  if (!zone) return <div className="mt-8"><SlotGridSkeleton /></div>;

  const pickedStart = picked ? new Date(picked) : null;
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <SlotGrid
        slots={slots}
        zone={zone}
        onZoneChange={setZone}
        zoneOptions={zoneOptions}
        picked={picked}
        onPick={setPicked}
        providerName={providerName}
        providerTimeZone={providerTimeZone}
      />
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
