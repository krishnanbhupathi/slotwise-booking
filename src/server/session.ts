import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { providers } from "@/db/schema";

/** The signed-in user, or a redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
});

/** The signed-in user's provider profile, or a redirect to onboarding. */
export const requireProvider = cache(async () => {
  const user = await requireUser();
  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) redirect("/onboarding");
  return provider;
});
