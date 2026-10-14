import { and, eq } from "drizzle-orm";
import { services, type IntakeAnswers, type IntakeFormRef } from "@/db/schema";
import type { Database } from "@/db/types";
import { isInputField, parseFormSchema, validateSubmission, visibleFieldIds, type FormValues } from "@/vendor/formwise/core";

/**
 * Intake forms come from Formwise (the companion form builder). A tutor pastes
 * a Formwise share link; we fetch that published version once, validate it with
 * the same schema code Formwise uses, and keep our own copy on the service.
 * Bookings then never depend on Formwise being reachable.
 */

/** Only this origin is ever fetched, so a pasted link can't make the server request arbitrary URLs. */
export const formwiseOrigin = () => (process.env.FORMWISE_ORIGIN ?? "https://formwise-builder.vercel.app").replace(/\/$/, "");

export function parseShareLink(input: string, origin = formwiseOrigin()): { ok: true; formId: string; url: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, error: "Paste the form's full share link, e.g. " + `${origin}/f/abc123` };
  }
  const match = url.pathname.match(/^\/f\/([2-9a-z]{10})\/?$/);
  if (url.origin !== origin || !match) return { ok: false, error: `That isn't a Formwise share link. It should look like ${origin}/f/abc123.` };
  return { ok: true, formId: match[1]!, url: `${origin}/f/${match[1]}` };
}

export type FetchDeps = { fetch?: typeof fetch; origin?: string; now?: Date };

/** Fetches the currently published version of a Formwise form. */
export async function fetchPublishedForm(shareLink: string, deps: FetchDeps = {}): Promise<{ ok: true; ref: IntakeFormRef } | { ok: false; error: string }> {
  const origin = deps.origin ?? formwiseOrigin();
  const link = parseShareLink(shareLink, origin);
  if (!link.ok) return link;

  let res: Response;
  try {
    res = await (deps.fetch ?? fetch)(`${origin}/api/public/forms/${link.formId}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    return { ok: false, error: "Couldn't reach Formwise. Try again in a moment." };
  }
  if (res.status === 404) return { ok: false, error: "That form isn't published yet. Publish it in Formwise first." };
  if (!res.ok) return { ok: false, error: `Formwise returned an error (${res.status}). Try again in a moment.` };

  const body = (await res.json().catch(() => null)) as { form?: unknown; version?: unknown } | null;
  const parsed = parseFormSchema(body?.form);
  if (!parsed.ok || typeof body?.version !== "number") return { ok: false, error: "Formwise sent a form this version of Slotwise can't read." };
  if (!parsed.form.fields.some(isInputField)) return { ok: false, error: "That form has no questions." };

  return {
    ok: true,
    ref: { formId: link.formId, version: body.version, sourceUrl: link.url, fetchedAt: (deps.now ?? new Date()).toISOString(), schema: parsed.form },
  };
}

/** Attaches (or refreshes) a service's intake form. Scoped to the provider so one tutor can't edit another's service. */
export async function attachIntakeForm(db: Database, providerId: string, serviceId: string, shareLink: string, deps: FetchDeps = {}) {
  const result = await fetchPublishedForm(shareLink, deps);
  if (!result.ok) return result;
  const [row] = await db
    .update(services)
    .set({ intakeForm: result.ref })
    .where(and(eq(services.id, serviceId), eq(services.providerId, providerId)))
    .returning({ id: services.id });
  return row ? { ok: true as const, ref: result.ref } : { ok: false as const, error: "Service not found." };
}

export async function removeIntakeForm(db: Database, providerId: string, serviceId: string) {
  await db.update(services).set({ intakeForm: null }).where(and(eq(services.id, serviceId), eq(services.providerId, providerId)));
}

/**
 * Validates intake answers (sent from the browser as JSON) on the server with
 * Formwise's own validation. Hidden questions are dropped; the stored answers
 * carry their labels so they still read correctly if the form changes later.
 */
export function checkIntake(
  ref: IntakeFormRef | null,
  rawJson: string,
): { ok: true; intake: IntakeAnswers | null } | { ok: false; errors: Record<string, string>; values: FormValues } {
  if (!ref) return { ok: true, intake: null };
  let values: FormValues = {};
  try {
    const parsed = JSON.parse(rawJson || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) values = parsed as FormValues;
  } catch {
    // Treated as no answers: required questions will report themselves.
  }
  const result = validateSubmission(ref.schema, values);
  if (!result.ok) return { ok: false, errors: result.errors, values };
  const visible = visibleFieldIds(ref.schema, values);
  const answers = ref.schema.fields
    .filter((f) => isInputField(f) && visible.has(f.id) && f.id in result.data)
    .map((f) => ({ id: f.id, label: f.label || "Untitled question", value: result.data[f.id]! }));
  return { ok: true, intake: { formId: ref.formId, version: ref.version, title: ref.schema.title, answers } };
}
