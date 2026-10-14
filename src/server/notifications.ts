import type { Database } from "@/db/types";
import { appUrl, sendEmail, type Email } from "@/lib/email";
import { loadBookingContext, type BookingContext } from "./booking-context";
import {
  cancellationEmails,
  confirmationEmail,
  latePaymentRefundEmail,
  providerNewBookingEmail,
  rescheduleEmails,
} from "./email-templates";

/**
 * Booking emails are sent after the database change has committed, and a
 * failed send is logged rather than undoing the booking. Trade-off: an email
 * that fails is not retried; a durable outbox table would fix that.
 */
async function send(kind: string, bookingId: string, build: (ctx: BookingContext) => Email[], db: Database) {
  try {
    const ctx = await loadBookingContext(db, bookingId);
    if (!ctx) return;
    await Promise.all(build(ctx).map(sendEmail));
  } catch (error) {
    console.error(`[email] ${kind} for booking ${bookingId} failed`, error);
  }
}

export const notifyConfirmed = (db: Database, bookingId: string) =>
  send("confirmation", bookingId, (ctx) => [confirmationEmail(ctx, appUrl(), new Date()), providerNewBookingEmail(ctx, appUrl())], db);

export const notifyCancelled = (db: Database, bookingId: string, opts: { by: "client" | "provider"; refunded: boolean }) =>
  send("cancellation", bookingId, (ctx) => cancellationEmails(ctx, { ...opts, baseUrl: appUrl(), now: new Date() }), db);

export const notifyRescheduled = (db: Database, bookingId: string, previousStart: Date) =>
  send("reschedule", bookingId, (ctx) => rescheduleEmails(ctx, { previousStart, baseUrl: appUrl(), now: new Date() }), db);

export const notifyLatePaymentRefunded = (db: Database, bookingId: string) =>
  send("late-payment refund", bookingId, (ctx) => [latePaymentRefundEmail(ctx, appUrl())], db);
