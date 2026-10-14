import "server-only";
import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { providers, services } from "@/db/schema";

/** Data for the public booking pages. Cached per request so metadata and page share one query. */
export const getPublicProvider = cache((handle: string) =>
  db.query.providers.findFirst({ where: eq(providers.handle, handle.toLowerCase()) }),
);

export const getPublicService = cache((providerId: string, slug: string) =>
  db.query.services.findFirst({
    where: and(eq(services.providerId, providerId), eq(services.slug, slug), eq(services.active, true)),
  }),
);
