import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { listServices } from "@/server/services";
import { requireProvider } from "@/server/session";
import { ServiceList } from "./service-list";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const provider = await requireProvider();
  const services = await listServices(db, provider.id);
  return (
    <>
      <PageHeader title="Services" description="What clients can book, how long it takes, and the deposit they pay up front." />
      <ServiceList services={services} />
    </>
  );
}
