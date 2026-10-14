"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import type { Service } from "@/db/schema";
import { formatMoney } from "@/lib/validation";
import { deleteService, setActive } from "./actions";
import { IntakeSection } from "./intake-section";
import { ServiceForm } from "./service-form";

export function ServiceList({ services }: { services: Service[] }) {
  const [adding, setAdding] = useState(services.length === 0);
  return (
    <div className="space-y-4">
      {services.map((service) => (
        <ServiceRow key={service.id} service={service} />
      ))}
      {adding ? (
        <Card className="p-5">
          <h2 className="mb-4 font-medium">New service</h2>
          <ServiceForm onDone={services.length ? () => setAdding(false) : undefined} />
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Add a service
        </Button>
      )}
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <Card className="p-5">
        <h2 className="mb-4 font-medium">Edit {service.name}</h2>
        <ServiceForm service={service} onDone={() => setEditing(false)} />
      </Card>
    );
  }

  return (
    <Card className={service.active ? "p-5" : "bg-stone-50 p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-medium">
            {service.name}
            {!service.active && (
              <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs font-normal text-stone-600">Archived</span>
            )}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {service.durationMin} min ·{" "}
            {service.priceCents === 0
              ? "Free"
              : `${formatMoney(service.priceCents, service.currency)} · ${service.depositCents ? `${formatMoney(service.depositCents, service.currency)} deposit` : "no deposit"}`}
            {service.bufferMin > 0 && ` · ${service.bufferMin} min buffer`}
          </p>
          {service.description && <p className="mt-2 text-sm text-stone-500">{service.description}</p>}
          {notice && <p role="status" className="mt-2 text-sm text-stone-600">{notice}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {!service.active ? (
            <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => setActive(service.id, true))}>
              Restore
            </Button>
          ) : confirming ? (
            <>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteService(service.id);
                    setConfirming(false);
                    if (result === "archived") setNotice("This service has bookings, so it was archived instead of deleted.");
                  })
                }
              >
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>
      {service.active && <IntakeSection service={service} />}
    </Card>
  );
}
