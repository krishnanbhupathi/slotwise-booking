"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { completeOnboarding } from "./actions";

const noopSubscribe = () => () => {};

type ZoneOption = { value: string; label: string };

export function OnboardingForm({
  suggestedHandle,
  suggestedName,
  timeZones,
}: {
  suggestedHandle: string;
  suggestedName: string;
  /** Built on the server: Node and browsers ship different zone lists, so a client-built list breaks hydration. */
  timeZones: ZoneOption[];
}) {
  const [state, action, pending] = useActionState(completeOnboarding, null);
  // The browser's zone is only known on the client; the server renders "".
  const browserZone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  const errors = state?.errors ?? {};
  const values = state?.values;
  // A browser may report a legacy alias (Asia/Calcutta) the server list spells differently.
  const options =
    browserZone && !timeZones.some((z) => z.value === browserZone)
      ? [{ value: browserZone, label: browserZone.replaceAll("_", " ") }, ...timeZones]
      : timeZones;

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Your name" htmlFor="name" error={errors.name} hint="Shown on your booking page.">
        <Input id="name" name="name" required defaultValue={values?.name ?? suggestedName} aria-invalid={!!errors.name} />
      </Field>
      <Field
        label="Booking page address"
        htmlFor="handle"
        error={errors.handle}
        hint="Lowercase letters, numbers and hyphens."
      >
        <div className="flex items-center rounded-md border border-stone-300 bg-white focus-within:border-brand-600">
          <span className="pl-3 text-sm text-stone-500 select-none">/book/</span>
          <input
            id="handle"
            name="handle"
            required
            defaultValue={values?.handle ?? suggestedHandle}
            aria-invalid={!!errors.handle}
            className="w-full rounded-r-md bg-transparent py-2 pr-3 text-sm outline-none"
          />
        </div>
      </Field>
      <Field
        label="Your time zone"
        htmlFor="timezone"
        error={errors.timezone}
        hint="Your weekly hours are set in this zone. Clients see times in theirs."
      >
        <Select
          id="timezone"
          name="timezone"
          key={browserZone}
          defaultValue={values?.timezone ?? browserZone}
          required
          aria-invalid={!!errors.timezone}
        >
          <option value="" disabled>
            Choose a time zone
          </option>
          {options.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Create my booking page"}
      </Button>
    </form>
  );
}
