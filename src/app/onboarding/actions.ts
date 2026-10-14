"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { pgErrorCode, UNIQUE_VIOLATION } from "@/lib/db-errors";
import { fieldErrors, onboardingSchema } from "@/lib/validation";
import { requireUser } from "@/server/session";

export type OnboardingState = { errors?: Record<string, string>; values?: Record<string, string> } | null;

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await requireUser();
  const values = Object.fromEntries(["name", "handle", "timezone"].map((k) => [k, String(formData.get(k) ?? "")]));

  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  try {
    await db.insert(providers).values({ userId: user.id, email: user.email!, ...parsed.data });
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
      return { errors: { handle: "That handle is taken. Try another." }, values };
    }
    throw error;
  }
  redirect("/dashboard");
}
