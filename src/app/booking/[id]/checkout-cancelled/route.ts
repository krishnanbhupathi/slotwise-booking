import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bookings, payments, providers, services } from "@/db/schema";
import { releaseHold } from "@/server/bookings";
import { getStripe } from "@/server/stripe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stripe's cancel_url. Expires the Checkout session (so it can't be paid
 * later) and releases the hold right away instead of waiting 10 minutes.
 */
export async function GET(_request: Request, { params }: RouteContext<"/booking/[id]/checkout-cancelled">) {
  const { id } = await params;
  if (!UUID.test(id)) redirect("/");

  const [row] = await db
    .select({ handle: providers.handle, slug: services.slug, status: bookings.status })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .where(eq(bookings.id, id));
  if (!row) redirect("/");

  if (row.status === "held") {
    const pending = await db.query.payments.findFirst({
      where: and(eq(payments.bookingId, id), eq(payments.status, "pending")),
    });
    const stripe = getStripe();
    if (pending && stripe) {
      // If it was paid in the meantime, Stripe refuses and the webhook confirms the booking.
      const expired = await stripe.checkout.sessions.expire(pending.stripeSessionId).then(
        () => true,
        () => false,
      );
      if (expired) await releaseHold(db, id);
    } else {
      await releaseHold(db, id);
    }
  }
  redirect(`/book/${row.handle}/${row.slug}?cancelled=1`);
}
