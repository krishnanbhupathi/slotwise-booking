"use client";

import { useActionState, useState } from "react";
import { SlotGrid, SlotGridSkeleton, useViewerZone, type ZoneOption } from "@/components/slot-grid";
import { Button, Card } from "@/components/ui";
import { formatDateTimeIn, formatTimeIn } from "@/lib/format";
import { rescheduleAsClient } from "../actions";

export function ReschedulePicker({
  bookingId,
  slots,
  providerName,
  providerTimeZone,
  timeZones,
}: {
  bookingId: string;
  slots: string[];
  providerName: string;
  providerTimeZone: string;
  timeZones: ZoneOption[];
}) {
  const { zone, setZone, zoneOptions } = useViewerZone(timeZones);
  const [picked, setPicked] = useState<string | null>(null);
  const [state, action, pending] = useActionState(rescheduleAsClient.bind(null, bookingId), null);

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
      <Card className="h-fit p-5">
        <h2 className="font-medium">New time</h2>
        <p className="mt-1 text-sm text-stone-700">
          {pickedStart ? formatDateTimeIn(pickedStart, zone) : <span className="text-stone-500">Pick a time first.</span>}
          {pickedStart && zone !== providerTimeZone && (
            <span className="block text-xs text-stone-500">
              {formatTimeIn(pickedStart, providerTimeZone)} for {providerName}
            </span>
          )}
        </p>
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="startsAt" value={picked ?? ""} />
          <Button type="submit" className="w-full" disabled={!picked || pending}>
            {pending ? "Moving…" : "Move my booking"}
          </Button>
          {state && (
            <p role="alert" className="text-sm text-red-700">
              {state.message}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
