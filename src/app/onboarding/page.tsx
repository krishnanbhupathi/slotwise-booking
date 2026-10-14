import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { TIME_ZONES, timeZoneLabel } from "@/lib/timezones";
import { slugify } from "@/lib/validation";
import { requireUser } from "@/server/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your booking page" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (existing) redirect("/dashboard");

  const local = user.email?.split("@")[0] ?? "";
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Card className="p-6">
        <h1 className="font-display text-2xl font-black tracking-tight">Set up your booking page</h1>
        <p className="mt-1 mb-6 text-sm text-stone-600">You can add services and hours next.</p>
        <OnboardingForm
          suggestedHandle={slugify(local).slice(0, 32)}
          suggestedName={user.name ?? ""}
          timeZones={TIME_ZONES.map((tz) => ({ value: tz, label: timeZoneLabel(tz) }))}
        />
      </Card>
    </main>
  );
}
