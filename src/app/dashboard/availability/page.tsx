import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { timeZoneLabel } from "@/lib/timezones";
import { getWeeklyAvailability, listDateOverrides } from "@/server/availability";
import { requireProvider } from "@/server/session";
import { DateOverrides } from "./date-overrides";
import { WeeklyHours } from "./weekly-hours";

export const metadata: Metadata = { title: "Availability" };

/** Today's date (YYYY-MM-DD) in the given zone. */
function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function AvailabilityPage() {
  const provider = await requireProvider();
  const today = todayIn(provider.timezone);
  const [week, overrides] = await Promise.all([
    getWeeklyAvailability(db, provider.id),
    listDateOverrides(db, provider.id, today),
  ]);

  return (
    <>
      <PageHeader
        title="Availability"
        description={`Hours are in your time zone, ${timeZoneLabel(provider.timezone)}. Clients see them converted to theirs.`}
      />
      <section aria-labelledby="weekly-heading" className="space-y-3">
        <h2 id="weekly-heading" className="font-display text-lg font-bold">
          Weekly hours
        </h2>
        <WeeklyHours initial={week} />
      </section>
      <section aria-labelledby="dates-heading" className="mt-10 space-y-3">
        <div>
          <h2 id="dates-heading" className="font-display text-lg font-bold">
            Date changes
          </h2>
          <p className="text-sm text-stone-600">Days off or different hours on a specific date. These replace your weekly hours for that day.</p>
        </div>
        <DateOverrides overrides={overrides} today={today} />
      </section>
    </>
  );
}
