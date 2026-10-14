import { providers, users } from "@/db/schema";
import type { TestDb } from "./db";

let counter = 0;

/** Inserts a user + provider profile and returns the provider. */
export async function makeProvider(db: TestDb, overrides: Partial<typeof providers.$inferInsert> = {}) {
  counter += 1;
  const email = `provider${counter}@example.com`;
  const [user] = await db.insert(users).values({ email }).returning();
  const [provider] = await db
    .insert(providers)
    .values({ userId: user.id, handle: `tutor-${counter}`, name: `Tutor ${counter}`, email, timezone: "Europe/London", ...overrides })
    .returning();
  return provider;
}
