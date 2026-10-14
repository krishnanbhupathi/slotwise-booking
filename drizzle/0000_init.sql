CREATE TYPE "public"."booking_status" AS ENUM('held', 'confirmed', 'cancelled', 'refunded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "availability_rules_weekday" CHECK ("availability_rules"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "availability_rules_order" CHECK ("availability_rules"."end_time" > "availability_rules"."start_time")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"client_timezone" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"blocks_until" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'held' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"intake" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_time_order" CHECK ("bookings"."ends_at" > "bookings"."starts_at" AND "bookings"."blocks_until" >= "bookings"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	CONSTRAINT "date_overrides_provider_date" UNIQUE("provider_id","date"),
	CONSTRAINT "date_overrides_hours" CHECK (("date_overrides"."start_time" IS NULL AND "date_overrides"."end_time" IS NULL) OR ("date_overrides"."start_time" IS NOT NULL AND "date_overrides"."end_time" IS NOT NULL AND "date_overrides"."end_time" > "date_overrides"."start_time"))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"stripe_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"timezone" text NOT NULL,
	"stripe_account" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "providers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "providers_handle_unique" UNIQUE("handle"),
	CONSTRAINT "providers_handle_format" CHECK ("providers"."handle" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_min" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"deposit_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"buffer_min" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_provider_slug" UNIQUE("provider_id","slug"),
	CONSTRAINT "services_duration_positive" CHECK ("services"."duration_min" > 0),
	CONSTRAINT "services_buffer_nonneg" CHECK ("services"."buffer_min" >= 0),
	CONSTRAINT "services_price_nonneg" CHECK ("services"."price_cents" >= 0),
	CONSTRAINT "services_deposit_range" CHECK ("services"."deposit_cents" >= 0 AND "services"."deposit_cents" <= "services"."price_cents")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_rules_provider" ON "availability_rules" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "bookings_provider_starts" ON "bookings" USING btree ("provider_id","starts_at");--> statement-breakpoint
CREATE INDEX "reminders_due" ON "reminders" USING btree ("send_at") WHERE "reminders"."sent_at" IS NULL;