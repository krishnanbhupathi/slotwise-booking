import { eq } from "drizzle-orm";
import { bookings, providers, services, type Booking, type Provider, type Service } from "@/db/schema";
import type { Database } from "@/db/types";

export type BookingContext = { booking: Booking; service: Service; provider: Provider };

/** A booking with its service and provider, or null. */
export async function loadBookingContext(db: Database, bookingId: string): Promise<BookingContext | null> {
  const [row] = await db
    .select({ booking: bookings, service: services, provider: providers })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .where(eq(bookings.id, bookingId));
  return row ?? null;
}
