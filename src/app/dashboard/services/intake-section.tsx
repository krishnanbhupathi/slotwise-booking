"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import type { Service } from "@/db/schema";
import { attachIntake, detachIntake } from "./actions";

const FORMWISE_URL = "https://formwise-builder.vercel.app";

/** Attach a Formwise form whose questions clients answer when booking this service. */
export function IntakeSection({ service }: { service: Pick<Service, "id" | "name" | "intakeForm"> }) {
  const ref = service.intakeForm;
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const questions = ref ? ref.schema.fields.filter((f) => f.type !== "heading").length : 0;

  const run = (shareLink: string) =>
    start(async () => {
      const result = await attachIntake(service.id, shareLink);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setLink("");
    });

  return (
    <div className="mt-4 border-t border-stone-200 pt-4">
      <h3 className="text-sm font-medium">Intake form</h3>
      {ref ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-stone-700">
            <a href={ref.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600">
              {ref.schema.title || "Untitled form"}
            </a>{" "}
            · {questions} question{questions === 1 ? "" : "s"} · version {ref.version}
          </span>
          <Button variant="ghost" disabled={pending} onClick={() => run(ref.sourceUrl)} aria-label={`Refresh the intake form for ${service.name}`}>
            {pending ? "Refreshing…" : "Refresh"}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => start(() => detachIntake(service.id).then(() => setMessage(null)))}>
            Remove
          </Button>
        </div>
      ) : (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(link);
          }}
        >
          <Input
            aria-label={`Formwise share link for ${service.name}`}
            placeholder={`${FORMWISE_URL}/f/…`}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="secondary" disabled={pending || !link.trim()}>
            {pending ? "Attaching…" : "Attach"}
          </Button>
        </form>
      )}
      <p className="mt-1 text-xs text-stone-500">
        {ref
          ? "Clients answer these questions when they book. Refresh after publishing changes in Formwise."
          : <>Ask clients extra questions when they book: build and publish a form in <a href={FORMWISE_URL} target="_blank" rel="noreferrer" className="underline">Formwise</a>, then paste its share link.</>}
      </p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-1 text-sm ${message.ok ? "text-brand-700" : "text-red-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
