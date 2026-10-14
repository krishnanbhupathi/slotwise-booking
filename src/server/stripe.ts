import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** The Stripe client, or null when payments aren't configured (no secret key). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith("sk_test_") && process.env.ALLOW_LIVE_STRIPE !== "true") {
    // A portfolio demo must never take real money.
    throw new Error("Refusing to use a live Stripe key. Use a test-mode key (sk_test_…).");
  }
  client ??= new Stripe(key);
  return client;
}

/** Stripe's minimum lifetime for a Checkout session is 30 minutes. */
const CHECKOUT_LIFETIME_S = 30 * 60 + 60;

export async function createDepositCheckout(
  stripe: Stripe,
  args: {
    bookingId: string;
    amountCents: number;
    currency: string;
    serviceName: string;
    providerName: string;
    whenLabel: string;
    clientEmail: string;
    successUrl: string;
    cancelUrl: string;
    now: Date;
  },
) {
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: args.clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: args.currency,
            unit_amount: args.amountCents,
            product_data: {
              name: `Deposit: ${args.serviceName} with ${args.providerName}`,
              description: args.whenLabel,
            },
          },
        },
      ],
      metadata: { booking_id: args.bookingId },
      payment_intent_data: { metadata: { booking_id: args.bookingId } },
      expires_at: Math.floor(args.now.getTime() / 1000) + CHECKOUT_LIFETIME_S,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    },
    // Retrying the same booking never opens a second session.
    { idempotencyKey: `checkout-${args.bookingId}` },
  );
}
