import { and, asc, desc, eq, gte } from "drizzle-orm";
import { bookings, payments, services } from "@/db/schema";
import type { Database } from "@/db/types";

/** Confirmed bookings from now on, soonest first, with the deposit (if any) that secured them. */
export function listUpcomingBookings(db: Database, providerId: string, now: Date) {
  return db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      clientName: bookings.clientName,
      clientEmail: bookings.clientEmail,
      clientTimezone: bookings.clientTimezone,
      note: bookings.note,
      intake: bookings.intake,
      serviceName: services.name,
      depositCents: payments.amountCents,
      currency: payments.currency,
    })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .leftJoin(payments, and(eq(payments.bookingId, bookings.id), eq(payments.status, "paid")))
    .where(and(eq(bookings.providerId, providerId), eq(bookings.status, "confirmed"), gte(bookings.endsAt, now)))
    .orderBy(asc(bookings.startsAt))
    .limit(100);
}

/** Every payment attempt except abandoned ones, newest first. */
export function listPayments(db: Database, providerId: string) {
  return db
    .select({
      id: payments.id,
      createdAt: payments.createdAt,
      amountCents: payments.amountCents,
      currency: payments.currency,
      status: payments.status,
      clientName: bookings.clientName,
      bookingId: bookings.id,
      startsAt: bookings.startsAt,
      serviceName: services.name,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .where(eq(bookings.providerId, providerId))
    .orderBy(desc(payments.createdAt))
    .limit(200);
}
