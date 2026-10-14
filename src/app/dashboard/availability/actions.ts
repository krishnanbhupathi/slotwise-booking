"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dateOverrideSchema, fieldErrors, weeklyAvailabilitySchema } from "@/lib/validation";
import { deleteDateOverride, replaceWeeklyAvailability, upsertDateOverride } from "@/server/availability";
import { requireProvider } from "@/server/session";

export type ActionResult = { ok: boolean; message: string; errors?: Record<string, string> };

export async function saveWeeklyHours(week: unknown): Promise<ActionResult> {
  const provider = await requireProvider();
  const parsed = weeklyAvailabilitySchema.safeParse(week);
  if (!parsed.success) return { ok: false, message: "Fix the highlighted days.", errors: fieldErrors(parsed.error) };

  await replaceWeeklyAvailability(db, provider.id, parsed.data);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Weekly hours saved" };
}

export async function saveDateOverride(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const provider = await requireProvider();
  const closed = formData.get("mode") !== "hours";
  const parsed = dateOverrideSchema.safeParse({
    date: formData.get("date"),
    closed,
    ...(closed ? {} : { start: formData.get("start"), end: formData.get("end") }),
  });
  if (!parsed.success) return { ok: false, message: "Check the date and hours.", errors: fieldErrors(parsed.error) };

  await upsertDateOverride(db, provider.id, parsed.data);
  revalidatePath("/dashboard/availability");
  return { ok: true, message: "Date saved" };
}

export async function removeDateOverride(id: string) {
  const provider = await requireProvider();
  await deleteDateOverride(db, provider.id, id);
  revalidatePath("/dashboard/availability");
}
