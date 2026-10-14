import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { cityName, formatDateTimeIn } from "@/lib/format";
import { canClientReschedule, FREE_CHANGE_CUTOFF_HOURS } from "@/lib/policy";
import { generateSlots } from "@/lib/slots";
import { TIME_ZONES, timeZoneLabel } from "@/lib/timezones";
import { loadBookingContext } from "@/server/booking-context";
import { loadSlotInput } from "@/server/bookings";
import { ReschedulePicker } from "./reschedule-picker";

export const metadata: Metadata = { title: "Reschedule", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReschedulePage({ params }: PageProps<"/booking/[id]/reschedule">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await loadBookingContext(db, id);
  if (!ctx) notFound();

  const { booking, service, provider } = ctx;
  const now = new Date();
  const zone = booking.clientTimezone ?? provider.timezone;
  const back = (
    <Link href={`/booking/${id}`} className="text-sm text-stone-500 hover:text-stone-800">
      ← Back to your booking
    </Link>
  );

  if (!canClientReschedule(booking, now)) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
        {back}
        <Card className="mt-3 p-6 text-sm text-stone-700">
          This booking can&apos;t be rescheduled online: sessions can be moved until {FREE_CHANGE_CUTOFF_HOURS} hours
          before they start. Please contact {provider.name} directly.
        </Card>
      </main>
    );
  }

  const slots = generateSlots(await loadSlotInput(db, provider, service, now, booking.id))
    .filter((s) => s.start.getTime() !== booking.startsAt.getTime())
    .map((s) => s.start.toISOString());

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      {back}
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Reschedule {service.name}</h1>
      <p className="mt-1 text-sm text-stone-600">
        Currently {formatDateTimeIn(booking.startsAt, zone)} ({cityName(zone)} time). Your deposit carries over.
      </p>
      <ReschedulePicker
        bookingId={booking.id}
        slots={slots}
        providerName={provider.name}
        providerTimeZone={provider.timezone}
        timeZones={TIME_ZONES.map((tz) => ({ value: tz, label: timeZoneLabel(tz) }))}
      />
    </main>
  );
}
