/**
 * Creates (or resets) the demo account behind the "Try the demo" button:
 * a tutor with three services and weekday-evening hours. Safe to re-run.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const { users, providers, services, availabilityRules, dateOverrides } = schema;

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.DEMO_EMAIL;
  if (!url || !email) throw new Error("DATABASE_URL and DEMO_EMAIL must be set");

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, name: "Alex Morgan", emailVerified: new Date() })
      .onConflictDoUpdate({ target: users.email, set: { name: "Alex Morgan" } })
      .returning();

    const [provider] = await tx
      .insert(providers)
      .values({ userId: user.id, handle: "demo-tutor", name: "Alex Morgan", email, timezone: "Europe/London" })
      .onConflictDoUpdate({ target: providers.userId, set: { name: "Alex Morgan", timezone: "Europe/London" } })
      .returning();

    // Reset demo content. Services with bookings are archived by the app, so
    // only delete the ones without bookings here; the rest are re-activated.
    await tx.delete(availabilityRules).where(eq(availabilityRules.providerId, provider.id));
    await tx.delete(dateOverrides).where(eq(dateOverrides.providerId, provider.id));

    const demoServices = [
      { slug: "gcse-maths", name: "GCSE Maths – 1:1", description: "Exam-focused practice and past papers.", durationMin: 60, priceCents: 4500, depositCents: 1000, bufferMin: 15 },
      { slug: "a-level-physics", name: "A-level Physics – 1:1", description: "Mechanics, electricity and exam technique.", durationMin: 60, priceCents: 5500, depositCents: 1500, bufferMin: 15 },
      { slug: "intro-call", name: "Free intro call", description: "15 minutes to talk about goals and fit.", durationMin: 15, priceCents: 0, depositCents: 0, bufferMin: 5 },
    ];
    for (const s of demoServices) {
      await tx
        .insert(services)
        .values({ providerId: provider.id, ...s })
        .onConflictDoUpdate({ target: [services.providerId, services.slug], set: { ...s, active: true } });
    }

    const evenings = [1, 2, 3, 4, 5].map((weekday) => ({ providerId: provider.id, weekday, startTime: "16:00", endTime: "20:00" }));
    await tx.insert(availabilityRules).values([
      ...evenings,
      { providerId: provider.id, weekday: 6, startTime: "10:00", endTime: "14:00" },
    ]);
  });

  await client.end();
  console.log(`Demo account ready: ${email} → /book/demo-tutor`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
