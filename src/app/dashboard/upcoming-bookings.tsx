"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import type { IntakeAnswers } from "@/db/schema";
import { cityName, formatDayIn, formatTimeIn } from "@/lib/format";
import { formatIntakeValue } from "@/lib/intake";
import { subjectClass } from "@/lib/subjects";
import { formatMoney } from "@/lib/validation";
import { cancelAsProvider } from "./booking-actions";

export type UpcomingBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  clientEmail: string;
  clientTimezone: string | null;
  note: string | null;
  intake: IntakeAnswers | null;
  serviceId: string;
  serviceName: string;
  depositCents: number | null;
  currency: string | null;
};

export function UpcomingBookings({ bookings, timeZone, subjects }: { bookings: UpcomingBooking[]; timeZone: string; subjects: Record<string, number> }) {
  if (bookings.length === 0) {
    return <Card className="p-6 text-sm text-stone-600">No upcoming bookings yet. Share your booking page to get some.</Card>;
  }

  // Group by day in the provider's zone.
  const groups = new Map<string, UpcomingBooking[]>();
  for (const b of bookings) {
    const day = formatDayIn(new Date(b.startsAt), timeZone);
    groups.set(day, [...(groups.get(day) ?? []), b]);
  }

  return (
    <div className="space-y-6">
      {[...groups].map(([day, rows]) => (
        <section key={day} aria-label={day}>
          <h3 className="mb-2 font-display text-sm font-bold text-stone-600">{day}</h3>
          <Card className="divide-y divide-stone-100">
            {rows.map((b) => (
              <BookingRow key={b.id} booking={b} timeZone={timeZone} subject={subjects[b.serviceId] ?? 0} />
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

function BookingRow({ booking: b, timeZone, subject }: { booking: UpcomingBooking; timeZone: string; subject: number }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const start = new Date(b.startsAt);

  return (
    <div className={`${subjectClass(subject)} flex flex-wrap items-start justify-between gap-4 py-4 pr-5 pl-6 shadow-[inset_6px_0_0_var(--subject)]`}>
      <div className="min-w-0">
        <p className="font-display font-bold">
          {formatTimeIn(start, timeZone)}–{formatTimeIn(new Date(b.endsAt), timeZone)} · {b.clientName}
        </p>
        <p className="text-sm text-stone-600">
          {b.serviceName}
          {b.depositCents ? ` · ${formatMoney(b.depositCents, b.currency ?? "usd")} deposit paid` : ""}
          {b.clientTimezone && b.clientTimezone !== timeZone && ` · ${formatTimeIn(start, b.clientTimezone)} in ${cityName(b.clientTimezone)}`}
        </p>
        <p className="text-sm text-stone-500">
          <a href={`mailto:${b.clientEmail}`} className="hover:underline">
            {b.clientEmail}
          </a>
        </p>
        {b.note && <p className="mt-1 text-sm text-stone-700">“{b.note}”</p>}
        {b.intake && b.intake.answers.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-stone-600 hover:text-stone-900">
              {b.intake.title || "Intake answers"} ({b.intake.answers.length})
            </summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,12rem)_1fr]">
              {b.intake.answers.map((a) => (
                <div key={a.id} className="contents">
                  <dt className="text-stone-500">{a.label}</dt>
                  <dd className="break-words whitespace-pre-wrap text-stone-800">{formatIntakeValue(a.value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      {confirming ? (
        <div className="flex items-center gap-1">
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelAsProvider(b.id);
                if (result) setError(result.message);
                setConfirming(false);
              })
            }
          >
            {pending ? "Cancelling…" : b.depositCents ? "Confirm cancel & refund" : "Confirm cancel"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Cancel{b.depositCents ? " & refund" : ""}
        </Button>
      )}
    </div>
  );
}
