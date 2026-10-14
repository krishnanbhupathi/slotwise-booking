"use client";

import { useActionState, useEffect } from "react";
import { Button, Field, FormMessage, Input, Textarea } from "@/components/ui";
import type { Service } from "@/db/schema";
import { saveService } from "./actions";

const centsToInput = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

export function ServiceForm({ service, onDone }: { service?: Service; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveService.bind(null, service?.id ?? null), null);
  const errors = state?.errors ?? {};
  const v = state?.values;
  const idp = service?.id ?? "new";

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  const input = (name: string) => ({
    id: `${idp}-${name}`,
    name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${idp}-${name}-error` : undefined,
  });

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6" noValidate>
      <div className="sm:col-span-6">
        <Field label="Name" htmlFor={`${idp}-name`} error={errors.name}>
          <Input {...input("name")} required defaultValue={v?.name ?? service?.name} placeholder="GCSE Maths – 1:1" />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Description" htmlFor={`${idp}-description`} error={errors.description} hint="Optional. Shown to clients.">
          <Textarea {...input("description")} rows={2} defaultValue={v?.description ?? service?.description ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Duration (minutes)" htmlFor={`${idp}-durationMin`} error={errors.durationMin}>
          <Input {...input("durationMin")} type="number" inputMode="numeric" min={5} max={480} step={5} required defaultValue={v?.durationMin ?? service?.durationMin ?? 60} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Price (USD)" htmlFor={`${idp}-price`} error={errors.price}>
          <Input {...input("price")} inputMode="decimal" required defaultValue={v?.price ?? (service ? centsToInput(service.priceCents) : "")} placeholder="45" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Deposit (USD)" htmlFor={`${idp}-deposit`} error={errors.deposit} hint="Paid when booking.">
          <Input {...input("deposit")} inputMode="decimal" required defaultValue={v?.deposit ?? (service ? centsToInput(service.depositCents) : "")} placeholder="10" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Buffer after (minutes)" htmlFor={`${idp}-bufferMin`} error={errors.bufferMin} hint="Gap before the next booking.">
          <Input {...input("bufferMin")} type="number" inputMode="numeric" min={0} max={120} step={5} required defaultValue={v?.bufferMin ?? service?.bufferMin ?? 0} />
        </Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : service ? "Save changes" : "Add service"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
