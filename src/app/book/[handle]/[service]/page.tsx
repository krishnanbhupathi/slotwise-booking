import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { generateSlots } from "@/lib/slots";
import { TIME_ZONES, timeZoneLabel } from "@/lib/timezones";
import { formatMoney } from "@/lib/validation";
import { loadSlotInput } from "@/server/bookings";
import { getPublicProvider, getPublicService } from "@/server/public";
import { loadSubjectIndex } from "@/server/subjects";
import { subjectClass } from "@/lib/subjects";
import { SlotPicker } from "./slot-picker";

type Props = PageProps<"/book/[handle]/[service]">;

async function load(params: Props["params"]) {
  const { handle, service: slug } = await params;
  const provider = await getPublicProvider(handle);
  const service = provider && (await getPublicService(provider.id, slug));
  if (!provider || !service) notFound();
  return { provider, service };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider, service } = await load(params);
  return { title: `${service.name} with ${provider.name}` };
}

export default async function ServiceBookingPage({ params, searchParams }: Props) {
  const { provider, service } = await load(params);
  const { cancelled } = await searchParams;
  const [slots, subjects] = await Promise.all([
    loadSlotInput(db, provider, service, new Date()).then(generateSlots),
    loadSubjectIndex(db, provider.id),
  ]);
  const subject = subjects.get(service.id) ?? 0;

  const price = service.priceCents ? formatMoney(service.priceCents, service.currency) : "Free";
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Link href={`/book/${provider.handle}`} className="text-sm text-stone-600 hover:text-stone-900">
        ← {provider.name}
      </Link>
      <div className={`${subjectClass(subject)} mt-3 flex items-center gap-3`}>
        <span aria-hidden="true" className="lesson size-9 shrink-0 rounded-md" />
        <h1 className="font-display text-3xl font-black tracking-tight">{service.name}</h1>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        {service.durationMin} min · {price}
        {service.depositCents > 0 && ` · ${formatMoney(service.depositCents, service.currency)} deposit to book`}
      </p>
      {cancelled && (
        <p role="status" className="mt-4 rounded-md border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Payment cancelled. Nothing was charged and the time was released.
        </p>
      )}
      <SlotPicker
        handle={provider.handle}
        slug={service.slug}
        slots={slots.map((s) => s.start.toISOString())}
        providerName={provider.name}
        providerTimeZone={provider.timezone}
        depositLabel={service.depositCents > 0 ? formatMoney(service.depositCents, service.currency) : null}
        timeZones={TIME_ZONES.map((tz) => ({ value: tz, label: timeZoneLabel(tz) }))}
        intakeForm={service.intakeForm?.schema ?? null}
        subject={subject}
        serviceName={service.name}
        durationMin={service.durationMin}
      />
    </main>
  );
}
