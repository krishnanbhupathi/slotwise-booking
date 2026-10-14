import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { bookings, providers, services } from "@/db/schema";
import { cityName, formatDateTimeIn, formatTimeIn } from "@/lib/format";
import { formatMoney } from "@/lib/validation";
import { RefreshWhilePending } from "./refresh-while-pending";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookingStatusPage({ params, searchParams }: PageProps<"/booking/[id]">) {
  const { id } = await params;
  const { paid } = await searchParams;
  if (!UUID.test(id)) notFound();

  const [row] = await db
    .select({ booking: bookings, service: services, provider: providers })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .where(eq(bookings.id, id));
  if (!row) notFound();

  const { booking, service, provider } = row;
  const zone = booking.clientTimezone ?? provider.timezone;
  const waitingForPayment = booking.status === "held" && paid === "1";

  const headline = {
    confirmed: "You're booked",
    held: waitingForPayment ? "Confirming your payment…" : "Waiting for payment",
    expired: "This reservation expired",
    cancelled: "This booking was cancelled",
    refunded: "This booking was refunded",
  }[booking.status];

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      {waitingForPayment && <RefreshWhilePending />}
      <Card className="p-6">
        <p className="text-sm text-stone-500">{provider.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight" aria-live="polite">
          {headline}
        </h1>

        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-stone-500">Session</dt>
            <dd className="font-medium">
              {service.name} · {service.durationMin} min
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">When</dt>
            <dd className="font-medium">
              {formatDateTimeIn(booking.startsAt, zone)} ({cityName(zone)} time)
              {zone !== provider.timezone && (
                <span className="block font-normal text-stone-500">
                  {formatTimeIn(booking.startsAt, provider.timezone)} for {provider.name}
                </span>
              )}
            </dd>
          </div>
          {service.depositCents > 0 && booking.status === "confirmed" && (
            <div>
              <dt className="text-stone-500">Paid</dt>
              <dd className="font-medium">
                {formatMoney(service.depositCents, service.currency)} deposit
                {service.priceCents > service.depositCents &&
                  ` · ${formatMoney(service.priceCents - service.depositCents, service.currency)} due at the session`}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-6 text-sm text-stone-600">
          {booking.status === "confirmed" && "Bookmark this page: it always shows your booking's latest status."}
          {booking.status === "held" &&
            (waitingForPayment
              ? "This usually takes a few seconds. You can leave this page; we'll email you."
              : "Your time is held for a few minutes while payment completes.")}
          {booking.status === "expired" && "The time was released because payment didn't complete. Nothing was charged."}
          {booking.status === "refunded" &&
            "Your payment arrived after the time had been taken by someone else, so we refunded the deposit in full."}
        </p>

        {booking.status !== "confirmed" && booking.status !== "held" && (
          <Link
            href={`/book/${provider.handle}/${service.slug}`}
            className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Choose another time →
          </Link>
        )}
      </Card>
    </main>
  );
}
