"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";

export type LoginState = { ok?: boolean; message?: string; email?: string } | null;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { message: "Enter a valid email address", email: String(formData.get("email") ?? "") };

  try {
    // Throws a redirect to /login/check-email on success.
    await signIn("resend", { email: email.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return { message: "We couldn't send the link. Try again.", email: email.data };
    throw error;
  }
  return null;
}

export async function demoLogin() {
  await signIn("demo", { redirectTo: "/dashboard" });
}
