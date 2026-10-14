// Vendored from formwise-builder/packages/renderer@8c004c0. Do not edit here: change Formwise, then run scripts/sync-formwise.mjs.
import { z } from "zod";
import { isInputField, type Field, type FormSchema } from "./schema";

/** Metadata only: Formwise never uploads file contents. */
export type FileValue = { name: string; size: number; type: string };
export type FieldValue = string | number | boolean | FileValue | null;
export type FormValues = Record<string, FieldValue | undefined>;

// ---------------------------------------------------------------------------
// Conditional visibility
// ---------------------------------------------------------------------------

function conditionMet(target: Field, equals: string | boolean, value: FieldValue | undefined): boolean {
  switch (target.type) {
    case "select":
      return value === target.options.find((o) => o.id === equals)?.label;
    case "checkbox":
      return (value === true) === (equals === true);
    default:
      return String(value ?? "").trim().toLowerCase() === String(equals).trim().toLowerCase();
  }
}

/**
 * Ids of the fields that are currently shown. A field is visible when it has
 * no condition, or its condition's field is itself visible and has the
 * required value. Conditions only point backwards (enforced by the schema),
 * so one pass in order resolves chains.
 */
export function visibleFieldIds(form: FormSchema, values: FormValues): Set<string> {
  const visible = new Set<string>();
  const byId = new Map(form.fields.map((f) => [f.id, f]));
  for (const field of form.fields) {
    const rule = field.showIf;
    if (!rule) {
      visible.add(field.id);
      continue;
    }
    const target = byId.get(rule.fieldId);
    if (target && visible.has(target.id) && conditionMet(target, rule.equals, values[target.id])) visible.add(field.id);
  }
  return visible;
}

// ---------------------------------------------------------------------------
// Per-field validators (built from the schema)
// ---------------------------------------------------------------------------

const REQUIRED = "This field is required";

/** Empty strings, null and undefined all mean "no answer". */
const blankToNull = (v: unknown) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v);

/** Blank → null; null is then either allowed (optional) or reported as "required". */
function optionalOrRequired(schema: z.ZodType, required: boolean): z.ZodType {
  const inner = z.preprocess(blankToNull, schema.nullable());
  return required ? inner.refine((v) => v !== null, REQUIRED) : inner;
}

function textValidator(field: Extract<Field, { type: "text" | "textarea" }>) {
  let s = z.string().trim();
  if (field.minLength) s = s.min(field.minLength, `Use at least ${field.minLength} characters`);
  if (field.maxLength) s = s.max(field.maxLength, `Use at most ${field.maxLength} characters`);
  return s;
}

function numberValidator(field: Extract<Field, { type: "number" }>) {
  let n = z.coerce.number({ error: "Enter a number" }).refine(Number.isFinite, "Enter a number");
  if (field.integer) n = n.refine(Number.isInteger, "Enter a whole number");
  if (field.min !== undefined) n = n.refine((v) => v >= field.min!, `Must be at least ${field.min}`);
  if (field.max !== undefined) n = n.refine((v) => v <= field.max!, `Must be at most ${field.max}`);
  return n;
}

function dateValidator(field: Extract<Field, { type: "date" }>) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date")
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Enter a real date")
    .refine((d) => !field.min || d >= field.min, `Must be on or after ${field.min}`)
    .refine((d) => !field.max || d <= field.max, `Must be on or before ${field.max}`);
}

/** Matches a file against an accept list like ".pdf,image/*". */
export function fileMatchesAccept(file: FileValue, accept: string | undefined): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) =>
      rule.startsWith(".") ? name.endsWith(rule) : rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule,
    );
}

function fileValidator(field: Extract<Field, { type: "file" }>) {
  return z
    .object({ name: z.string().min(1), size: z.number().int().min(0), type: z.string() })
    .refine((f) => fileMatchesAccept(f, field.accept), `File type not allowed (${field.accept})`)
    .refine((f) => !field.maxSizeMb || f.size <= field.maxSizeMb * 1024 * 1024, `File must be under ${field.maxSizeMb} MB`);
}

/** The Zod validator for one input field's value. */
export function fieldValidator(field: Field): z.ZodType {
  switch (field.type) {
    case "text":
    case "textarea":
      return optionalOrRequired(textValidator(field), field.required);
    case "email":
      return optionalOrRequired(z.string().trim().pipe(z.email("Enter a valid email address")), field.required);
    case "number":
      return optionalOrRequired(numberValidator(field), field.required);
    case "select": {
      const labels = field.options.map((o) => o.label);
      return optionalOrRequired(z.string().refine((v) => labels.includes(v), "Choose one of the options"), field.required);
    }
    case "checkbox":
      return z.preprocess((v) => v === true, field.required ? z.literal(true, { error: REQUIRED }) : z.boolean());
    case "date":
      return optionalOrRequired(dateValidator(field), field.required);
    case "file":
      return optionalOrRequired(fileValidator(field), field.required);
    case "heading":
      return z.any();
  }
}

export type ValidationResult =
  | { ok: true; data: Record<string, FieldValue> }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a submission against the form. Hidden fields are skipped and
 * dropped from the result, so a hidden required field never blocks submit
 * and stale answers to hidden questions are never stored.
 */
export function validateSubmission(form: FormSchema, values: FormValues): ValidationResult {
  const visible = visibleFieldIds(form, values);
  const data: Record<string, FieldValue> = {};
  const errors: Record<string, string> = {};

  for (const field of form.fields) {
    if (!isInputField(field) || !visible.has(field.id)) continue;
    const result = fieldValidator(field).safeParse(values[field.id]);
    if (result.success) data[field.id] = (result.data ?? null) as FieldValue;
    else errors[field.id] = result.error.issues[0]?.message ?? "Invalid value";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
