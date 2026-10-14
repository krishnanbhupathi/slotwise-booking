import type { IntakeAnswers } from "@/db/schema";

/** Human-readable intake answer, for the dashboard and emails (safe to use in client components). */
export function formatIntakeValue(value: IntakeAnswers["answers"][number]["value"]): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return `${value.name} (${Math.max(1, Math.round(value.size / 1024))} KB)`;
  return String(value);
}
