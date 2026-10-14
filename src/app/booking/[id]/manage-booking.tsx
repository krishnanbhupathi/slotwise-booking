"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { cancelAsClient, type ChangeState } from "./actions";

export function ManageBooking({
  bookingId,
  canReschedule,
  cancelWarning,
}: {
  bookingId: string;
  canReschedule: boolean;
  /** What happens to the deposit, shown before the client confirms. */
  cancelWarning: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<ChangeState>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6 border-t border-stone-100 pt-5">
      {confirming ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-700">{cancelWarning}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              className="border border-red-200"
              disabled={pending}
              onClick={() => startTransition(async () => setState(await cancelAsClient(bookingId)))}
            >
              {pending ? "Cancelling…" : "Yes, cancel"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep booking
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canReschedule && (
            <Link
              href={`/booking/${bookingId}/reschedule`}
              className="inline-flex items-center rounded-md border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-stone-100"
            >
              Reschedule
            </Link>
          )}
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Cancel booking
          </Button>
        </div>
      )}
      {state && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
    </div>
  );
}
