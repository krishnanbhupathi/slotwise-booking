import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { providers, services } from "@/db/schema";
import { formatMoney } from "@/lib/validation";

const getProvider = cache((handle: string) =>
  db.query.providers.findFirst({ where: eq(providers.handle, handle.toLowerCase()) }),
);

export async function generateMetadata({ params }: PageProps<"/book/[handle]">): Promise<Metadata> {
  const provider = await getProvider((await params).handle);
  return { title: provider ? `Book ${provider.name}` : "Not found" };
}

export default async function BookingPage({ params }: PageProps<"/book/[handle]">) {
  const provider = await getProvider((await params).handle);
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
              <Card className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{service.name}</h3>
                  <span className="text-sm text-stone-700">{service.priceCents ? formatMoney(service.priceCents, service.currency) : "Free"}</span>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  {service.durationMin} min
                  {service.depositCents > 0 && ` · ${formatMoney(service.depositCents, service.currency)} deposit to book`}
                </p>
                {service.description && <p className="mt-2 text-sm text-stone-500">{service.description}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm text-stone-500">Online booking opens here soon.</p>
    </main>
  );
}
