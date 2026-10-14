"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import { sendMagicLink } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={state?.message}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          aria-invalid={Boolean(state?.message)}
          aria-describedby={state?.message ? "email-error" : undefined}
          placeholder="you@example.com"
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      <FormMessage state={state?.ok ? state : null} />
    </form>
  );
}
