import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { bookings, reminders } from "@/db/schema";
import type { Database } from "@/db/types";

/**
 * Claims due reminders by stamping sent_at in a single UPDATE … RETURNING.
 * Two overlapping cron runs can't both claim the same row, so a reminder is
 * sent at most once. Only confirmed, still-upcoming bookings qualify.
 */
export async function claimDueReminders(db: Database, now: Date, limit = 50) {
  const due = db
    .select({ id: reminders.id })
    .from(reminders)
    .innerJoin(bookings, eq(bookings.id, reminders.bookingId))
    .where(
      and(
        isNull(reminders.sentAt),
        lte(reminders.sendAt, now),
        eq(bookings.status, "confirmed"),
        gt(bookings.startsAt, now),
      ),
    )
    .limit(limit);

  return db
    .update(reminders)
    .set({ sentAt: now })
    .where(and(inArray(reminders.id, due), isNull(reminders.sentAt)))
    .returning({ id: reminders.id, bookingId: reminders.bookingId });
}

/** Un-claims a reminder whose email failed, so the next run retries it. */
export async function releaseReminder(db: Database, reminderId: string) {
  await db.update(reminders).set({ sentAt: null }).where(eq(reminders.id, reminderId));
}

/** Marks lapsed holds expired (housekeeping; correctness never depends on it). */
export async function expireLapsedHolds(db: Database, now: Date) {
  const rows = await db
    .update(bookings)
    .set({ status: "expired" })
    .where(and(eq(bookings.status, "held"), lte(bookings.holdExpiresAt, now)))
    .returning({ id: bookings.id });
  return rows.length;
}

