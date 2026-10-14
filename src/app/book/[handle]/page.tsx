import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { services } from "@/db/schema";
import { formatMoney } from "@/lib/validation";
import { getPublicProvider } from "@/server/public";

export async function generateMetadata({ params }: PageProps<"/book/[handle]">): Promise<Metadata> {
  const provider = await getPublicProvider((await params).handle);
  return { title: provider ? `Book ${provider.name}` : "Not found" };
}

export default async function BookingPage({ params }: PageProps<"/book/[handle]">) {
  const provider = await getPublicProvider((await params).handle);
  if (!provider) notFound();

  const offered = await db
    .select()
    .from(services)
    .where(and(eq(services.providerId, provider.id), eq(services.active, true)))
    .orderBy(asc(services.createdAt));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-500">Book a session with</p>
      <h1 className="text-3xl font-semibold tracking-tight">{provider.name}</h1>

      <h2 className="mt-10 mb-3 font-medium">Choose a service</h2>
      {offered.length === 0 ? (
        <p className="text-sm text-stone-600">No services are open for booking yet.</p>
      ) : (
        <ul className="space-y-3">
          {offered.map((service) => (
            <li key={service.id}>
              <Link href={`/book/${provider.handle}/${service.slug}`} className="group block">
                <Card className="p-5 transition-colors group-hover:border-brand-600">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{service.name}</h3>
                    <span className="text-sm text-stone-700">
                      {service.priceCents ? formatMoney(service.priceCents, service.currency) : "Free"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    {service.durationMin} min
                    {service.depositCents > 0 &&
                      ` · ${formatMoney(service.depositCents, service.currency)} deposit to book`}
                  </p>
                  {service.description && <p className="mt-2 text-sm text-stone-500">{service.description}</p>}
                  <span className="mt-3 inline-block text-sm font-medium text-brand-700">See times →</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
