"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/db";
import { cancelBooking, rescheduleBooking } from "@/server/booking-changes";
import { notifyCancelled, notifyRescheduled } from "@/server/notifications";
import { refundDeposit } from "@/server/stripe";

// The booking id (a random v4 UUID, only ever sent to the client) is the
// client's access key: there are no client accounts.

export type ChangeState = { message: string } | null;

export async function cancelAsClient(bookingId: string): Promise<ChangeState> {
  const result = await cancelBooking(db, { bookingId, by: "client", now: new Date() }, refundDeposit).catch((error) => {
    console.error("[booking] client cancel failed", error);
    return null;
  });
  if (!result) return { message: "We couldn't cancel right now. Please try again in a minute." };
  if (!result.ok) return { message: "This booking can't be cancelled any more." };

  after(() => notifyCancelled(db, bookingId, { by: "client", refunded: result.refunded }));
  revalidatePath(`/booking/${bookingId}`);
  return null;
}

export async function rescheduleAsClient(bookingId: string, _prev: ChangeState, formData: FormData): Promise<ChangeState> {
  const newStart = new Date(String(formData.get("startsAt") ?? ""));
  if (Number.isNaN(newStart.getTime())) return { message: "Pick a new time first." };

  const result = await rescheduleBooking(db, { bookingId, newStart, now: new Date() });
  if (!result.ok) {
    return {
      message: {
        not_found: "We couldn't find this booking.",
        not_allowed: "This booking can no longer be rescheduled online.",
        unavailable: "That time is no longer available. Please pick another.",
        taken: "Someone booked that time a moment ago. Please pick another.",
      }[result.reason],
    };
  }
  after(() => notifyRescheduled(db, bookingId, result.previousStart));
  redirect(`/booking/${bookingId}?rescheduled=1`);
}
