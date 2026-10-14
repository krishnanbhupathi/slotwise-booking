import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { availabilityRules, services } from "@/db/schema";
import { timeZoneLabel } from "@/lib/timezones";
import { requireProvider } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const provider = await requireProvider();
  const [[serviceCount], [ruleCount]] = await Promise.all([
    db.select({ n: count() }).from(services).where(eq(services.providerId, provider.id)),
    db.select({ n: count() }).from(availabilityRules).where(eq(availabilityRules.providerId, provider.id)),
  ]);

  const steps = [
    { done: serviceCount.n > 0, label: "Add a service", href: "/dashboard/services" },
    { done: ruleCount.n > 0, label: "Set your weekly hours", href: "/dashboard/availability" },
    { done: false, label: "Share your booking page", href: `/book/${provider.handle}` },
  ];

  return (
    <>
      <PageHeader
        title={`Hi, ${provider.name.split(" ")[0]}`}
        description={`Times are shown in ${timeZoneLabel(provider.timezone)}.`}
      />
      <Card className="p-6">
        <h2 className="font-medium">Get ready to take bookings</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={
                  step.done
                    ? "grid size-6 place-items-center rounded-full bg-brand-700 text-xs text-white"
                    : "grid size-6 place-items-center rounded-full border border-stone-300 text-xs text-stone-500"
                }
              >
                {step.done ? "✓" : i + 1}
              </span>
              <Link href={step.href} className={step.done ? "text-stone-500 line-through" : "font-medium hover:underline"}>
                {step.label}
              </Link>
              {step.done && <span className="sr-only">(done)</span>}
            </li>
          ))}
        </ol>
      </Card>
      <p className="mt-6 text-sm text-stone-500">Upcoming bookings and payments will appear here.</p>
    </>
  );
}
