import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { services } from "@/db/schema";
import { subjectClass } from "@/lib/subjects";
import { formatMoney } from "@/lib/validation";
import { loadSubjectIndex } from "@/server/subjects";
import { getPublicProvider } from "@/server/public";

export async function generateMetadata({ params }: PageProps<"/book/[handle]">): Promise<Metadata> {
  const provider = await getPublicProvider((await params).handle);
  return { title: provider ? `Book ${provider.name}` : "Not found" };
}

export default async function BookingPage({ params }: PageProps<"/book/[handle]">) {
  const provider = await getPublicProvider((await params).handle);
  if (!provider) notFound();

  const [offered, subjects] = await Promise.all([
    db
      .select()
      .from(services)
      .where(and(eq(services.providerId, provider.id), eq(services.active, true)))
      .orderBy(asc(services.createdAt)),
    loadSubjectIndex(db, provider.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-600">Book a session with</p>
      <h1 className="font-display text-4xl font-black tracking-tight">{provider.name}</h1>

      <h2 className="mt-10 mb-3 font-display text-lg font-bold">Choose a subject</h2>
      {offered.length === 0 ? (
        <p className="text-sm text-stone-600">No services are open for booking yet.</p>
      ) : (
        <ul className="space-y-3">
          {offered.map((service) => (
            <li key={service.id}>
              <Link
                href={`/book/${provider.handle}/${service.slug}`}
                className={`${subjectClass(subjects.get(service.id) ?? 0)} lesson group block rounded-lg p-5 outline-stone-900 transition-[outline] hover:outline-2 focus-visible:outline-2`}
              >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-stone-900">{service.name}</h3>
                    <span className="font-display font-bold text-stone-900">
                      {service.priceCents ? formatMoney(service.priceCents, service.currency) : "Free"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">
                    {service.durationMin} min
                    {service.depositCents > 0 &&
                      ` · ${formatMoney(service.depositCents, service.currency)} deposit to book`}
                  </p>
                  {service.description && <p className="mt-2 text-sm text-stone-700">{service.description}</p>}
                  <span className="mt-3 inline-block font-display text-sm font-bold text-stone-900 group-hover:underline">See the timetable →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
