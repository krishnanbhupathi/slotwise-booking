/**
 * Client change policy (Krishna, Day 3): free cancellation until 24 hours
 * before the session. Later than that, the client can still cancel but the
 * deposit is kept, and rescheduling is no longer offered.
 */
export const FREE_CHANGE_CUTOFF_HOURS = 24;

export function isBeforeCutoff(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() >= FREE_CHANGE_CUTOFF_HOURS * 3_600_000;
}

export type ClientCancelTerms = { allowed: false } | { allowed: true; refundDeposit: boolean };

export function clientCancelTerms(booking: { status: string; startsAt: Date }, now: Date): ClientCancelTerms {
  if (booking.status !== "confirmed" || booking.startsAt <= now) return { allowed: false };
  return { allowed: true, refundDeposit: isBeforeCutoff(booking.startsAt, now) };
}

export function canClientReschedule(booking: { status: string; startsAt: Date }, now: Date): boolean {
  return booking.status === "confirmed" && isBeforeCutoff(booking.startsAt, now);
}
