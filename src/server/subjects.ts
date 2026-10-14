import { asc, eq } from "drizzle-orm";
import { services } from "@/db/schema";
import type { Database } from "@/db/types";
import { subjectIndex } from "@/lib/subjects";

/** Colour index for each of a provider's services (all of them, so hiding one doesn't recolour the rest). */
export async function loadSubjectIndex(db: Database, providerId: string) {
  const rows = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.providerId, providerId))
    .orderBy(asc(services.createdAt), asc(services.id));
  return subjectIndex(rows.map((r) => r.id));
}
