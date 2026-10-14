"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { SlotGrid, SlotGridSkeleton, useViewerZone, type ZoneOption } from "@/components/slot-grid";
import { Button, Card, Field, FormMessage, Input, Textarea } from "@/components/ui";
import { formatDayIn, formatTimeIn } from "@/lib/format";
import { subjectClass } from "@/lib/subjects";
import { FormFields } from "@/vendor/formwise/FormRenderer";
import type { FormSchema, FormValues } from "@/vendor/formwise/core";
import "@/vendor/formwise/styles.css";
import { createBooking } from "./actions";

export function SlotPicker({
  handle,
  slug,
  slots,
  providerName,
  providerTimeZone,
  depositLabel,
  timeZones,
  intakeForm,
  subject,
  serviceName,
  durationMin,
}: {
  handle: string;
  slug: string;
  /** Slot starts as ISO strings. */
  slots: string[];
  providerName: string;
  providerTimeZone: string;
  depositLabel: string | null;
  timeZones: ZoneOption[];
  /** The service's Formwise intake form, if the tutor attached one. */
  intakeForm: FormSchema | null;
  /** Timetable colour of this service. */
  subject: number;
  serviceName: string;
  durationMin: number;
}) {
  const router = useRouter();
  const { zone, setZone, zoneOptions } = useViewerZone(timeZones);
  const [state, action, pending] = useActionState(createBooking.bind(null, handle, slug), null);
  const [picked, setPicked] = useState<string | null>(null);
  const [intake, setIntake] = useState<FormValues>({});
  // Server errors stay until the person edits that answer.
  const [intakeErrors, setIntakeErrors] = useState<Record<string, string>>({});

  // The chosen time was taken while the form was open: clear the choice and reload slots.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.slotGone) setPicked(null);
    setIntakeErrors(state?.intakeErrors ?? {});
  }
  useEffect(() => {
    if (state?.slotGone) router.refresh();
  }, [state, router]);

  if (!zone) return <div className="mt-8"><SlotGridSkeleton /></div>;

  const pickedStart = picked ? new Date(picked) : null;
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <SlotGrid
        slots={slots}
        zone={zone}
        onZoneChange={setZone}
        zoneOptions={zoneOptions}
        picked={picked}
        onPick={setPicked}
        providerName={providerName}
        providerTimeZone={providerTimeZone}
        subject={subject}
      />
      <section aria-labelledby="details-heading" className="lg:sticky lg:top-6 lg:self-start">
        <Card className="overflow-hidden">
          {/* The lesson slip: what you're booking, in the subject's colour. */}
          <div className={`${subjectClass(subject)} lesson px-5 py-4`}>
            <p className="font-display text-xs font-bold tracking-wider uppercase">
              {pickedStart ? formatDayIn(pickedStart, zone) : "No time picked"} · {serviceName}
            </p>
            <p className="font-display text-4xl font-black tracking-tight text-stone-900">
              {pickedStart ? formatTimeIn(pickedStart, zone) : "–:––"}
            </p>
            <p className="text-sm">
              {durationMin} min
              {pickedStart && zone !== providerTimeZone && ` · ${formatTimeIn(pickedStart, providerTimeZone)} for ${providerName}`}
            </p>
            {depositLabel && (
              <p className="mt-3 flex items-baseline justify-between border-t-2 border-current/20 pt-2 text-sm">
                Deposit today <span className="font-display text-2xl font-black text-stone-900">{depositLabel}</span>
              </p>
            )}
          </div>
          <div className="p-5">
          <h2 id="details-heading" className="font-display text-lg font-bold">
            Your details
          </h2>
          {!pickedStart && <p className="mt-1 text-sm text-stone-600">Pick a time in the timetable first.</p>}
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
            {intakeForm && (
              <fieldset className="space-y-3 border-t-2 border-stone-200 pt-4">
                <legend className="pt-4 font-display text-sm font-bold">{intakeForm.title || "A few questions"}</legend>
                {intakeForm.description && <p className="text-xs text-stone-600">{intakeForm.description}</p>}
                <input type="hidden" name="intake" value={JSON.stringify(intake)} />
                <div className="slotwise-intake">
                  <FormFields
                    form={intakeForm}
                    values={intake}
                    errors={intakeErrors}
                    theme="light"
                    onChange={(id, value) => {
                      setIntake((v) => ({ ...v, [id]: value }));
                      setIntakeErrors((errors) => {
                        const next = { ...errors };
                        delete next[id];
                        return next;
                      });
                    }}
                  />
                </div>
              </fieldset>
            )}
            <Button type="submit" className="w-full" disabled={!picked || pending}>
              {pending ? "Reserving…" : depositLabel ? `Continue to pay ${depositLabel} deposit` : "Confirm booking"}
            </Button>
            {depositLabel && (
              <p className="text-xs text-stone-600">
                We hold this time for 10 minutes while you pay. The rest is paid to {providerName} directly.
              </p>
            )}
            <FormMessage state={state?.message ? { ok: false, message: state.message } : null} />
          </form>
          </div>
        </Card>
      </section>
    </div>
  );
}
