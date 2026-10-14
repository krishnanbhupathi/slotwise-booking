import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HANDLE_PATTERN, "3–32 characters: lowercase letters, numbers and hyphens, not at the start or end");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().refine(isValidTimeZone, "Unknown time zone");

/** "HH:MM", 24-hour. "24:00" is allowed as an end-of-day boundary. */
export const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Use HH:MM");

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Parses a money string such as "45", "45.5" or "45.50" into integer cents. */
export const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,6}(?:\.\d{1,2})?$/, "Enter an amount like 45 or 45.50")
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  });

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "service"
  );
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  handle: handleSchema,
  timezone: timeZoneSchema,
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const serviceSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(80),
    description: z
      .string()
      .trim()
      .max(500)
      .transform((v) => v || null),
    durationMin: z.coerce.number().int().min(5, "At least 5 minutes").max(480, "At most 8 hours"),
    price: moneySchema,
    deposit: moneySchema,
    bufferMin: z.coerce.number().int().min(0).max(120, "At most 120 minutes"),
  })
  .refine((s) => s.deposit <= s.price, { path: ["deposit"], message: "Deposit can't be more than the price" });

export type ServiceInput = z.output<typeof serviceSchema>;

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

const rangeSchema = z
  .object({ start: timeSchema, end: timeSchema })
  .refine((r) => toMinutes(r.end) > toMinutes(r.start), { message: "End must be after start" });

/** Weekly hours: ISO weekday (1 = Monday) → list of ranges. Missing days are closed. */
export const weeklyAvailabilitySchema = z
  .array(z.object({ weekday: z.number().int().min(1).max(7), ranges: z.array(rangeSchema).max(6) }))
  .superRefine((days, ctx) => {
    const seen = new Set<number>();
    days.forEach((day, i) => {
      if (seen.has(day.weekday)) {
        ctx.addIssue({ code: "custom", path: [i, "weekday"], message: "Day listed twice" });
      }
      seen.add(day.weekday);

      const sorted = [...day.ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      for (let j = 1; j < sorted.length; j++) {
        if (toMinutes(sorted[j].start) < toMinutes(sorted[j - 1].end)) {
          ctx.addIssue({ code: "custom", path: [i, "ranges"], message: "Time ranges overlap" });
          break;
        }
      }
    });
  });

export type WeeklyAvailability = z.output<typeof weeklyAvailabilitySchema>;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((d) => {
    const date = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(d);
  }, "Not a real date");

export const dateOverrideSchema = z.discriminatedUnion("closed", [
  z.object({ date: isoDateSchema, closed: z.literal(true) }),
  z.object({ date: isoDateSchema, closed: z.literal(false), start: timeSchema, end: timeSchema }).refine(
    (o) => toMinutes(o.end) > toMinutes(o.start),
    { path: ["end"], message: "End must be after start" },
  ),
]);

export type DateOverrideInput = z.output<typeof dateOverrideSchema>;

/** Field → first error message, for showing next to form inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Booking (client details)
// ---------------------------------------------------------------------------

export const bookingDetailsSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  note: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .transform((v) => v || null),
  timezone: z
    .string()
    .transform((v) => (v && isValidTimeZone(v) ? v : null)),
});
