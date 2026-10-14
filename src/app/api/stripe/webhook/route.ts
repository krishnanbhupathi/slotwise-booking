import { after } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import { notifyConfirmed, notifyLatePaymentRefunded } from "@/server/notifications";
import { getStripe, refundDeposit } from "@/server/stripe";
import { handleStripeEvent } from "@/server/stripe-webhook";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe is not configured", { status: 503 });

  // The signature covers the raw body, so read it as text before parsing.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const outcome = await handleStripeEvent(db, event, { now: () => new Date(), refund: refundDeposit });
  console.info(`[stripe] ${event.type} ${event.id} → ${outcome}`);

  // Emails go out after the response, once the transaction has committed.
  const bookingId = (event.data.object as { metadata?: Record<string, string> }).metadata?.booking_id;
  if (bookingId && outcome === "confirmed") after(() => notifyConfirmed(db, bookingId));
  if (bookingId && outcome === "refunded_slot_taken") after(() => notifyLatePaymentRefunded(db, bookingId));
  // Any thrown error becomes a 500 and Stripe retries the delivery.
  return Response.json({ received: true, outcome });
}
