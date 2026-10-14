"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { cancelBooking } from "@/server/booking-changes";
import { notifyCancelled } from "@/server/notifications";
import { requireProvider } from "@/server/session";
import { refundDeposit } from "@/server/stripe";

export async function cancelAsProvider(bookingId: string): Promise<{ message: string } | null> {
  const provider = await requireProvider();
  const result = await cancelBooking(
    db,
    { bookingId, by: "provider", providerId: provider.id, now: new Date() },
    refundDeposit,
  ).catch((error) => {
    console.error("[dashboard] cancel failed", error);
    return null;
  });
  if (!result) return { message: "The refund couldn't be processed, so nothing was cancelled. Try again." };
  if (!result.ok) return { message: "This booking can't be cancelled." };

  after(() => notifyCancelled(db, bookingId, { by: "provider", refunded: result.refunded }));
  revalidatePath("/dashboard", "layout");
  return null;
}
