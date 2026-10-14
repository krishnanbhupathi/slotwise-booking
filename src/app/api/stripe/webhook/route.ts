import type Stripe from "stripe";
import { db } from "@/db";
import { getStripe } from "@/server/stripe";
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

  const outcome = await handleStripeEvent(db, event, {
    now: () => new Date(),
    async refund(paymentIntentId, bookingId) {
      await stripe.refunds.create(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `refund-${bookingId}` },
      );
    },
  });
  console.info(`[stripe] ${event.type} ${event.id} → ${outcome}`);
  // Any thrown error becomes a 500 and Stripe retries the delivery.
  return Response.json({ received: true, outcome });
}
