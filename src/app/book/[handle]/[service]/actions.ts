"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { cityName, formatDateTimeIn } from "@/lib/format";
import { bookingDetailsSchema, fieldErrors } from "@/lib/validation";
import { getBaseUrl } from "@/server/base-url";
import { placeHold, releaseHold } from "@/server/bookings";
import { checkIntake } from "@/server/intake";
import { notifyConfirmed } from "@/server/notifications";
import { getPublicProvider, getPublicService } from "@/server/public";
import { createDepositCheckout, getStripe } from "@/server/stripe";

export type BookingFormState = {
  errors?: Record<string, string>;
  message?: string;
  /** The chosen time is gone; the picker should refresh its slots. */
  slotGone?: boolean;
  values?: Record<string, string>;
  /** Intake answers that failed server-side validation, keyed by question id. */
  intakeErrors?: Record<string, string>;
} | null;

const FIELDS = ["startsAt", "name", "email", "note", "timezone", "intake"] as const;

export async function createBooking(
  handle: string,
  slug: string,
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const provider = await getPublicProvider(handle);
  const service = provider && (await getPublicService(provider.id, slug));
  if (!provider || !service) return { message: "This service is no longer available.", values };

  const parsed = bookingDetailsSchema.safeParse(values);
  // Intake answers are checked with Formwise's validation here, on the server, before any hold or payment.
  const intake = checkIntake(service.intakeForm, values.intake ?? "");
  if (!parsed.success || !intake.ok) {
    return {
      errors: parsed.success ? undefined : fieldErrors(parsed.error),
      intakeErrors: intake.ok ? undefined : intake.errors,
      message: intake.ok ? undefined : "Some answers need attention.",
      values,
    };
  }
  const details = parsed.data;
  const now = new Date();

  const hold = await placeHold(db, {
    provider,
    service,
    startsAt: details.startsAt,
    clientName: details.name,
    clientEmail: details.email,
    clientTimezone: details.timezone,
    note: details.note,
    intake: intake.intake,
    now,
  });
  if (!hold.ok) {
    return {
      slotGone: true,
      values,
      message:
        hold.reason === "taken"
          ? "Someone booked that time a moment ago. Please pick another."
          : "That time is no longer available. Please pick another.",
    };
  }

  const booking = hold.booking;
  if (booking.status === "confirmed") {
    after(() => notifyConfirmed(db, booking.id));
    redirect(`/booking/${booking.id}`);
  }

  const stripe = getStripe();
  if (!stripe) {
    await releaseHold(db, booking.id);
    return { message: "Online payment isn't set up yet, so this time can't be booked.", values };
  }

  const base = await getBaseUrl();
  const zone = details.timezone ?? provider.timezone;
  let checkoutUrl: string;
  try {
    const session = await createDepositCheckout(stripe, {
      bookingId: booking.id,
      amountCents: service.depositCents,
      currency: service.currency,
      serviceName: service.name,
      providerName: provider.name,
      whenLabel: `${formatDateTimeIn(booking.startsAt, zone)} (${cityName(zone)} time)`,
      clientEmail: details.email,
      successUrl: `${base}/booking/${booking.id}?paid=1`,
      cancelUrl: `${base}/booking/${booking.id}/checkout-cancelled`,
      now,
    });
    await db.insert(payments).values({
      bookingId: booking.id,
      stripeSessionId: session.id,
      amountCents: service.depositCents,
      currency: service.currency,
    });
    checkoutUrl = session.url!;
  } catch (error) {
    console.error("[booking] checkout failed", error);
    await releaseHold(db, booking.id);
    return { message: "We couldn't start the payment. Your time wasn't booked; please try again.", values };
  }
  redirect(checkoutUrl);
}
