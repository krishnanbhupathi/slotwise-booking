"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fieldErrors, serviceSchema } from "@/lib/validation";
import { createService, removeService, setServiceActive, updateService } from "@/server/services";
import { requireProvider } from "@/server/session";

export type ServiceFormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
} | null;

const FIELDS = ["name", "description", "durationMin", "price", "deposit", "bufferMin"] as const;

export async function saveService(
  serviceId: string | null,
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const provider = await requireProvider();
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));

  const parsed = serviceSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  if (serviceId) {
    const updated = await updateService(db, provider.id, serviceId, parsed.data);
    if (!updated) return { message: "That service no longer exists.", values };
  } else {
    await createService(db, provider.id, parsed.data);
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: serviceId ? "Saved" : "Service added" };
}

export async function deleteService(serviceId: string) {
  const provider = await requireProvider();
  const result = await removeService(db, provider.id, serviceId);
  revalidatePath("/dashboard", "layout");
  return result;
}

export async function setActive(serviceId: string, active: boolean) {
  const provider = await requireProvider();
  await setServiceActive(db, provider.id, serviceId, active);
  revalidatePath("/dashboard", "layout");
}
