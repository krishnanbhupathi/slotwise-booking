// Vendored from formwise-builder/packages/renderer@8c004c0. Do not edit here: change Formwise, then run scripts/sync-formwise.mjs.
import { z } from "zod";

/**
 * The Formwise form schema: the single source of truth that the builder,
 * live preview, renderer and JSON export all read.
 *
 * Exported JSON carries `version`. `parseFormSchema` migrates older versions
 * forward before validating, so forms exported today keep loading after the
 * schema changes.
 */

export const SCHEMA_VERSION = 1;

export const FIELD_TYPES = ["text", "textarea", "email", "number", "select", "checkbox", "date", "file", "heading"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Show this field only when another (earlier) field has a given value. */
const showIfSchema = z.object({
  fieldId: z.string().min(1),
  /** Option id for selects, true/false for checkboxes, plain text otherwise. */
  equals: z.union([z.string(), z.boolean()]),
});
export type ShowIf = z.infer<typeof showIfSchema>;

const base = {
  id: z.string().min(1),
  label: z.string().max(200),
  required: z.boolean().default(false),
  helpText: z.string().max(500).optional(),
  showIf: showIfSchema.optional(),
};

const lengthLimits = {
  placeholder: z.string().max(200).optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
};

const optionSchema = z.object({ id: z.string().min(1), label: z.string().min(1).max(200) });
export type SelectOption = z.infer<typeof optionSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const fieldSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("text"), ...lengthLimits }),
  z.object({ ...base, type: z.literal("textarea"), ...lengthLimits }),
  z.object({ ...base, type: z.literal("email"), placeholder: lengthLimits.placeholder }),
  z.object({
    ...base,
    type: z.literal("number"),
    placeholder: lengthLimits.placeholder,
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal("select"), options: z.array(optionSchema).min(1).max(100) }),
  z.object({ ...base, type: z.literal("checkbox") }),
  z.object({ ...base, type: z.literal("date"), min: isoDate.optional(), max: isoDate.optional() }),
  z.object({
    ...base,
    type: z.literal("file"),
    /** e.g. ".pdf,image/*". Only file metadata is captured, never the bytes. */
    accept: z.string().max(200).optional(),
    maxSizeMb: z.number().positive().max(100).optional(),
  }),
  z.object({ ...base, type: z.literal("heading") }),
]);

export type Field = z.infer<typeof fieldSchema>;
export type FieldOf<T extends FieldType> = Extract<Field, { type: T }>;

/** Fields that collect a value (everything except section headings). */
export const isInputField = (field: Field) => field.type !== "heading";
/** Fields another field's showIf may depend on. */
export const canBeCondition = (field: Field) => field.type === "select" || field.type === "checkbox" || field.type === "text";

export const formSchema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    id: z.string().min(1),
    title: z.string().max(200),
    description: z.string().max(1000).optional(),
    fields: z.array(fieldSchema).max(500),
  })
  .superRefine((form, ctx) => {
    const seen = new Map<string, number>();
    form.fields.forEach((field, index) => {
      const path = ["fields", index];
      if (seen.has(field.id)) ctx.addIssue({ code: "custom", path: [...path, "id"], message: `Duplicate field id "${field.id}"` });
      seen.set(field.id, index);

      if ("minLength" in field && field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) {
        ctx.addIssue({ code: "custom", path: [...path, "maxLength"], message: "Maximum length is below the minimum" });
      }
      if (field.type === "number" && field.min !== undefined && field.max !== undefined && field.min > field.max) {
        ctx.addIssue({ code: "custom", path: [...path, "max"], message: "Maximum is below the minimum" });
      }
      if (field.type === "date" && field.min && field.max && field.min > field.max) {
        ctx.addIssue({ code: "custom", path: [...path, "max"], message: "Latest date is before the earliest" });
      }
      if (field.type === "select" && new Set(field.options.map((o) => o.id)).size !== field.options.length) {
        ctx.addIssue({ code: "custom", path: [...path, "options"], message: "Duplicate option id" });
      }

      // A condition may only point at an earlier, condition-capable field.
      // Requiring "earlier" rules out cycles by construction.
      if (field.showIf) {
        const targetIndex = seen.get(field.showIf.fieldId);
        const target = targetIndex === undefined ? undefined : form.fields[targetIndex];
        if (!target || targetIndex === index) {
          ctx.addIssue({ code: "custom", path: [...path, "showIf"], message: "Condition must refer to a field above this one" });
        } else if (!canBeCondition(target)) {
          ctx.addIssue({ code: "custom", path: [...path, "showIf"], message: `A ${target.type} field can't be used as a condition` });
        } else if (target.type === "select" && !target.options.some((o) => o.id === field.showIf!.equals)) {
          ctx.addIssue({ code: "custom", path: [...path, "showIf"], message: "Condition refers to an option that doesn't exist" });
        }
      }
    });
  });

export type FormSchema = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Versioned parsing
// ---------------------------------------------------------------------------

/** version N → version N+1. Add an entry whenever SCHEMA_VERSION goes up. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, Migration> = {};

export type ParseResult = { ok: true; form: FormSchema } | { ok: false; errors: string[] };

/** Parses untrusted JSON (an import, an API body) into a current-version form. */
export function parseFormSchema(input: unknown, migrations: Record<number, Migration> = MIGRATIONS): ParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["Not a form: expected a JSON object"] };
  }
  let doc = input as Record<string, unknown>;
  const version = doc.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, errors: ['Missing or invalid "version"'] };
  }
  if (version > SCHEMA_VERSION) {
    return { ok: false, errors: [`This form uses schema version ${version}; this app supports up to ${SCHEMA_VERSION}`] };
  }
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const migrate = migrations[v];
    if (!migrate) return { ok: false, errors: [`No migration from schema version ${v}`] };
    doc = { ...migrate(doc), version: v + 1 };
  }

  const result = formSchema.safeParse(doc);
  if (result.success) return { ok: true, form: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
  };
}
