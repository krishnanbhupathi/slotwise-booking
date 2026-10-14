import { and, eq, notInArray } from "drizzle-orm";
import { availabilityRules, bookings, dateOverrides, payments, providers, reminders, services, users } from "@/db/schema";
import type { Database } from "@/db/types";
import { generateSlots } from "@/lib/slots";
import { loadSlotInput } from "./bookings";
import { DEMO_INTAKE_ANSWERS, DEMO_INTAKE_FORM } from "./demo-intake";

const DEMO_SERVICES = [
  { slug: "gcse-maths", name: "GCSE Maths – 1:1", description: "Exam-focused practice and past papers.", durationMin: 60, priceCents: 4500, depositCents: 1000, bufferMin: 15 },
  { slug: "a-level-physics", name: "A-level Physics – 1:1", description: "Mechanics, electricity and exam technique.", durationMin: 60, priceCents: 5500, depositCents: 1500, bufferMin: 15 },
  { slug: "intro-call", name: "Free intro call", description: "15 minutes to talk about goals and fit.", durationMin: 15, priceCents: 0, depositCents: 0, bufferMin: 5 },
];

/** Sample students for the demo dashboard (fictional). */
const SAMPLE_CLIENTS = [
  { name: "Priya S.", email: "priya.demo@example.com", timezone: "Asia/Kolkata", note: "Struggling with quadratics." },
  { name: "Tom H.", email: "tom.demo@example.com", timezone: "Europe/London", note: null },
  { name: "Lena K.", email: "lena.demo@example.com", timezone: "Europe/Berlin", note: "Mock exam next week." },
];

/**
 * Restores the shared demo account (a tutor, three services, weekday-evening
 * hours) and replaces its bookings with three sample ones. Visitors' changes
 * are wiped. Used by `npm run db:seed` and the nightly cron.
 */
export async function resetDemo(db: Database, email: string, now: Date) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, name: "Alex Morgan", emailVerified: now })
      .onConflictDoUpdate({ target: users.email, set: { name: "Alex Morgan" } })
      .returning();
    const [provider] = await tx
      .insert(providers)
      .values({ userId: user.id, handle: "demo-tutor", name: "Alex Morgan", email, timezone: "Europe/London" })
      .onConflictDoUpdate({ target: providers.userId, set: { handle: "demo-tutor", name: "Alex Morgan", timezone: "Europe/London" } })
      .returning();

    // Bookings cascade to their payments and reminders.
    await tx.delete(bookings).where(eq(bookings.providerId, provider.id));
    await tx.delete(dateOverrides).where(eq(dateOverrides.providerId, provider.id));
    await tx.delete(availabilityRules).where(eq(availabilityRules.providerId, provider.id));
    await tx
      .delete(services)
      .where(and(eq(services.providerId, provider.id), notInArray(services.slug, DEMO_SERVICES.map((s) => s.slug))));

    const rows = [];
    for (const [i, s] of DEMO_SERVICES.entries()) {
      // Distinct creation times keep the subject colours in list order (Maths blue, Physics orange, intro green).
      const createdAt = new Date(now.getTime() - (DEMO_SERVICES.length - i) * 1000);
      const [row] = await tx
        .insert(services)
        .values({ providerId: provider.id, ...s, createdAt })
        .onConflictDoUpdate({ target: [services.providerId, services.slug], set: { ...s, createdAt, active: true, intakeForm: null } })
        .returning();
      rows.push(row);
    }
    // Physics asks a few intake questions (a form built in Formwise) to show the integration.
    const physics = rows[1];
    await tx.update(services).set({ intakeForm: { ...DEMO_INTAKE_FORM, fetchedAt: now.toISOString() } }).where(eq(services.id, physics.id));
    await tx.insert(availabilityRules).values([
      ...[1, 2, 3, 4, 5].map((weekday) => ({ providerId: provider.id, weekday, startTime: "16:00", endTime: "20:00" })),
      { providerId: provider.id, weekday: 6, startTime: "10:00", endTime: "14:00" },
    ]);

    // Three sample bookings on different days, at least two days out.
    const maths = rows[0];
    const slots = generateSlots(await loadSlotInput(tx, provider, maths, now)).filter(
      (s) => s.start.getTime() > now.getTime() + 2 * 86_400_000,
    );
    const picks = [slots[0], slots.find((s) => s.start.getTime() > slots[0].start.getTime() + 86_400_000), slots.at(-5)];
    for (const [i, slot] of picks.entries()) {
      if (!slot) continue;
      const client = SAMPLE_CLIENTS[i];
      // The last sample is a Physics booking with intake answers.
      const service = i === 2 ? physics : maths;
      const [booking] = await tx
        .insert(bookings)
        .values({
          providerId: provider.id,
          serviceId: service.id,
          clientName: client.name,
          clientEmail: client.email,
          clientTimezone: client.timezone,
          note: client.note,
          intake: i === 2 ? DEMO_INTAKE_ANSWERS : null,
          startsAt: slot.start,
          endsAt: slot.end,
          blocksUntil: new Date(slot.end.getTime() + service.bufferMin * 60_000),
          status: "confirmed",
        })
        .returning();
      await tx.insert(payments).values({
        bookingId: booking.id,
        stripeSessionId: `cs_demo_${booking.id}`,
        stripePaymentIntentId: `pi_demo_${booking.id}`,
        amountCents: service.depositCents,
        currency: service.currency,
        status: "paid",
      });
      await tx.insert(reminders).values({ bookingId: booking.id, sendAt: new Date(slot.start.getTime() - 86_400_000) });
    }
    return { providerId: provider.id, sampleBookings: picks.filter(Boolean).length };
  });
}
