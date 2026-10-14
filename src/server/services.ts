import { and, asc, desc, eq, like } from "drizzle-orm";
import { bookings, services } from "@/db/schema";
import type { Database } from "@/db/types";
import { slugify, type ServiceInput } from "@/lib/validation";

function toRow(input: ServiceInput) {
  return {
    name: input.name,
    description: input.description,
    durationMin: input.durationMin,
    priceCents: input.price,
    depositCents: input.deposit,
    bufferMin: input.bufferMin,
  };
}

export function listServices(db: Database, providerId: string) {
  return db
    .select()
    .from(services)
    .where(eq(services.providerId, providerId))
    .orderBy(desc(services.active), asc(services.createdAt));
}

/** Picks "<slug>", or "<slug>-2", "<slug>-3"… if the provider already uses it. */
async function uniqueSlug(db: Database, providerId: string, name: string) {
  const base = slugify(name);
  const taken = new Set(
    (
      await db
        .select({ slug: services.slug })
        .from(services)
        .where(and(eq(services.providerId, providerId), like(services.slug, `${base}%`)))
    ).map((r) => r.slug),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function createService(db: Database, providerId: string, input: ServiceInput) {
  const slug = await uniqueSlug(db, providerId, input.name);
  const [row] = await db
    .insert(services)
    .values({ providerId, slug, ...toRow(input) })
    .returning();
  return row;
}

/**
 * Every write is scoped by provider_id as well as id, so a provider can never
 * change another provider's service even with a forged id. The slug is kept
 * on rename so shared booking links don't break.
 */
export async function updateService(db: Database, providerId: string, id: string, input: ServiceInput) {
  const [row] = await db
    .update(services)
    .set(toRow(input))
    .where(and(eq(services.id, id), eq(services.providerId, providerId)))
    .returning();
  return row ?? null;
}

export async function setServiceActive(db: Database, providerId: string, id: string, active: boolean) {
  const [row] = await db
    .update(services)
    .set({ active })
    .where(and(eq(services.id, id), eq(services.providerId, providerId)))
    .returning();
  return row ?? null;
}

/** Deletes a service with no bookings; archives it otherwise so booking history survives. */
export async function removeService(
  db: Database,
  providerId: string,
  id: string,
): Promise<"deleted" | "archived" | "not_found"> {
  const hasBookings = await db.query.bookings.findFirst({
    columns: { id: true },
    where: eq(bookings.serviceId, id),
  });
  if (hasBookings) {
    return (await setServiceActive(db, providerId, id, false)) ? "archived" : "not_found";
  }
  const deleted = await db
    .delete(services)
    .where(and(eq(services.id, id), eq(services.providerId, providerId)))
    .returning({ id: services.id });
  return deleted.length ? "deleted" : "not_found";
}
