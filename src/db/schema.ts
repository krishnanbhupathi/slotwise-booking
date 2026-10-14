import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Auth.js tables (shape required by @auth/drizzle-adapter).
// Sessions live in a signed JWT cookie, so there is no sessions table.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    handle: text("handle").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** IANA zone, e.g. "Europe/London". All availability is interpreted in it. */
    timezone: text("timezone").notNull(),
    /** Reserved for Stripe Connect; v1 takes deposits on the platform account. */
    stripeAccount: text("stripe_account"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("providers_handle_format", sql`${t.handle} ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'`)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    durationMin: integer("duration_min").notNull(),
    /** Money is stored as integer minor units (cents) to avoid float rounding. */
    priceCents: integer("price_cents").notNull(),
    depositCents: integer("deposit_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    bufferMin: integer("buffer_min").notNull().default(0),
    /** Archived services keep their bookings but disappear from the booking page. */
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("services_provider_slug").on(t.providerId, t.slug),
    check("services_duration_positive", sql`${t.durationMin} > 0`),
    check("services_buffer_nonneg", sql`${t.bufferMin} >= 0`),
    check("services_price_nonneg", sql`${t.priceCents} >= 0`),
    check(
      "services_deposit_range",
      sql`${t.depositCents} >= 0 AND ${t.depositCents} <= ${t.priceCents}`,
    ),
  ],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    /** ISO weekday: 1 = Monday … 7 = Sunday. */
    weekday: smallint("weekday").notNull(),
    /** Wall-clock times in the provider's time zone. */
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    index("availability_rules_provider").on(t.providerId),
    check("availability_rules_weekday", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("availability_rules_order", sql`${t.endTime} > ${t.startTime}`),
  ],
);

export const dateOverrides = pgTable(
  "date_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** Both null = closed all day; both set = custom hours that replace the weekly rule. */
    startTime: time("start_time"),
    endTime: time("end_time"),
  },
  (t) => [
    unique("date_overrides_provider_date").on(t.providerId, t.date),
    check(
      "date_overrides_hours",
      sql`(${t.startTime} IS NULL AND ${t.endTime} IS NULL) OR (${t.startTime} IS NOT NULL AND ${t.endTime} IS NOT NULL AND ${t.endTime} > ${t.startTime})`,
    ),
  ],
);

export const bookingStatus = pgEnum("booking_status", [
  "held",
  "confirmed",
  "cancelled",
  "refunded",
  "expired",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Denormalised from the service so the exclusion constraint can see it. */
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    clientTimezone: text("client_timezone"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** ends_at + the service buffer. The overlap check runs on [starts_at, blocks_until). */
    blocksUntil: timestamp("blocks_until", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("held"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    /** Answers from the intake form (form builder renderer). */
    intake: jsonb("intake"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_provider_starts").on(t.providerId, t.startsAt),
    check("bookings_time_order", sql`${t.endsAt} > ${t.startsAt} AND ${t.blocksUntil} >= ${t.endsAt}`),
    // The no-double-booking EXCLUDE constraint is added in a hand-written
    // migration (drizzle-kit cannot express it): see drizzle/0001_*.sql.
  ],
);

export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "refunded", "failed"]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("reminders_due").on(t.sendAt).where(sql`${t.sentAt} IS NULL`)],
);

export type Provider = typeof providers.$inferSelect;
export type Service = typeof services.$inferSelect;
export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type DateOverride = typeof dateOverrides.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
