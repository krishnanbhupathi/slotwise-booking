// Vendored from formwise-builder/packages/renderer@8c004c0. Do not edit here: change Formwise, then run scripts/sync-formwise.mjs.
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Field, FormSchema } from "./schema";
import { fieldValidator, validateSubmission, visibleFieldIds, type FieldValue, type FormValues } from "./validation";

export type Theme = "auto" | "light" | "dark";

export type FormRendererProps = {
  form: FormSchema;
  /** Called with validated, normalised data (hidden fields removed). */
  onSubmit?: (data: Record<string, FieldValue>) => void | Promise<void>;
  initialValues?: FormValues;
  submitLabel?: string;
  /** Disables inputs and the submit button (e.g. while the host is saving). */
  disabled?: boolean;
  /** "auto" follows the OS colour scheme; hosts without a dark mode pass "light". */
  theme?: Theme;
  /** Extra content rendered above the submit button (e.g. a host's own fields). */
  children?: ReactNode;
};

/**
 * Renders a Formwise schema as an accessible HTML form. Errors show after a
 * field is left (blur) or on submit; conditional fields appear and disappear
 * as answers change.
 */
export function FormRenderer({ form, onSubmit, initialValues = {}, submitLabel = "Submit", disabled, theme = "auto", children }: FormRendererProps) {
  const uid = useId();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Live errors for fields the person has already left (or tried to submit).
  const errors: Record<string, string> = {};
  for (const field of form.fields) {
    if (!touched[field.id]) continue;
    const result = fieldValidator(field).safeParse(values[field.id]);
    if (!result.success) errors[field.id] = result.error.issues[0]?.message ?? "Invalid value";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateSubmission(form, values);
    if (!result.ok) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(result.errors).map((id) => [id, true])) }));
      const first = form.fields.find((f) => result.errors[f.id]);
      if (first) document.getElementById(`${uid}-${first.id}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit?.(result.data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="fw-root fw-form" data-theme={theme} onSubmit={handleSubmit} noValidate aria-label={form.title || "Form"}>
      {form.title && <h2 className="fw-title">{form.title}</h2>}
      {form.description && <p className="fw-description">{form.description}</p>}
      <FieldList
        form={form}
        idPrefix={uid}
        values={values}
        errors={errors}
        disabled={disabled || submitting}
        onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))}
        onBlur={(id) => setTouched((t) => (t[id] ? t : { ...t, [id]: true }))}
      />
      {children}
      <button type="submit" className="fw-submit" disabled={disabled || submitting}>
        {submitting ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}

export type FormFieldsProps = {
  form: FormSchema;
  values: FormValues;
  onChange: (fieldId: string, value: FieldValue) => void;
  /** Errors to show, keyed by field id (e.g. from the host's server-side validation). */
  errors?: Record<string, string>;
  onBlur?: (fieldId: string) => void;
  disabled?: boolean;
  theme?: Theme;
};

/**
 * Just the questions, without a <form> or submit button, so a host can put
 * them inside its own form (e.g. a booking form). The host owns the values
 * and should validate with `validateSubmission` (ideally on its server too).
 */
export function FormFields({ form, values, onChange, errors = {}, onBlur, disabled, theme = "auto" }: FormFieldsProps) {
  const uid = useId();
  return (
    <div className="fw-root fw-fields" data-theme={theme}>
      <FieldList form={form} idPrefix={uid} values={values} errors={errors} disabled={disabled} onChange={onChange} onBlur={onBlur ?? (() => {})} />
    </div>
  );
}

function FieldList(props: {
  form: FormSchema;
  idPrefix: string;
  values: FormValues;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (fieldId: string, value: FieldValue) => void;
  onBlur: (fieldId: string) => void;
}) {
  const visible = useMemo(() => visibleFieldIds(props.form, props.values), [props.form, props.values]);
  return (
    <>
      {props.form.fields.map((field) =>
        visible.has(field.id) ? (
          <FieldControl
            key={field.id}
            field={field}
            inputId={`${props.idPrefix}-${field.id}`}
            value={props.values[field.id]}
            error={props.errors[field.id]}
            disabled={props.disabled}
            onChange={(v) => props.onChange(field.id, v)}
            onBlur={() => props.onBlur(field.id)}
          />
        ) : null,
      )}
    </>
  );
}

type ControlProps = {
  field: Field;
  inputId: string;
  value: FieldValue | undefined;
  error?: string;
  disabled?: boolean;
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
};

function FieldControl({ field, inputId, value, error, disabled, onChange, onBlur }: ControlProps) {
  if (field.type === "heading") {
    return (
      <div className="fw-heading">
        <h3>{field.label}</h3>
        {field.helpText && <p className="fw-help">{field.helpText}</p>}
      </div>
    );
  }

  const helpId = field.helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const common = {
    id: inputId,
    name: field.id,
    disabled,
    onBlur,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [helpId, errorId].filter(Boolean).join(" ") || undefined,
    "aria-required": field.required || undefined,
  } as const;
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";

  let control: ReactNode;
  switch (field.type) {
    case "text":
    case "email":
      control = (
        <input {...common} type={field.type} className="fw-input" value={text} placeholder={field.placeholder}
          maxLength={field.type === "text" ? field.maxLength : undefined} autoComplete={field.type === "email" ? "email" : undefined}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "textarea":
      control = (
        <textarea {...common} className="fw-input fw-textarea" rows={4} value={text} placeholder={field.placeholder}
          maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "number":
      control = (
        <input {...common} type="number" inputMode={field.integer ? "numeric" : "decimal"} className="fw-input" value={text}
          placeholder={field.placeholder} min={field.min} max={field.max} step={field.integer ? 1 : "any"}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "date":
      control = (
        <input {...common} type="date" className="fw-input" value={text} min={field.min} max={field.max}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "select":
      control = (
        <select {...common} className="fw-input" value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o.id} value={o.label}>{o.label}</option>
          ))}
        </select>
      );
      break;
    case "file":
      control = (
        <input {...common} type="file" className="fw-input fw-file" accept={field.accept || undefined}
          onChange={(e) => {
            const f = e.target.files?.[0];
            onChange(f ? { name: f.name, size: f.size, type: f.type } : null);
            onBlur();
          }} />
      );
      break;
    case "checkbox":
      return (
        <div className="fw-field fw-field-checkbox">
          <label className="fw-check">
            <input {...common} type="checkbox" checked={value === true}
              onChange={(e) => { onChange(e.target.checked); onBlur(); }} />
            <span>{field.label}{field.required && <span className="fw-req" aria-hidden="true"> *</span>}</span>
          </label>
          {field.helpText && <p id={helpId} className="fw-help">{field.helpText}</p>}
          {error && <p id={errorId} className="fw-error" role="alert">{error}</p>}
        </div>
      );
  }

  return (
    <div className="fw-field">
      <label htmlFor={inputId} className="fw-label">
        {field.label || "Untitled question"}
        {field.required && <span className="fw-req" aria-hidden="true"> *</span>}
      </label>
      {field.helpText && <p id={helpId} className="fw-help">{field.helpText}</p>}
      {control}
      {error && <p id={errorId} className="fw-error" role="alert">{error}</p>}
    </div>
  );
}
