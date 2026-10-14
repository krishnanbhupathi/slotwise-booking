# Slotwise

Booking and deposits for solo tutors. A tutor shares one link. Students pick a time shown in their own time zone, pay a deposit, and get a confirmation. That means no back-and-forth, and fewer no-shows.

> **Status:** in active development (16–22 Oct 2026). See [PROGRESS.md](./PROGRESS.md) for what's done and what's next.

## Features

| | Feature |
|---|---|
| ✅ | Passwordless sign-in (email magic link) and a one-click demo account |
| ✅ | Onboarding: booking-page handle and time zone |
| ✅ | Services: duration, price, deposit, buffer between bookings; archive instead of delete once booked |
| ✅ | Weekly hours (several ranges per day) and date changes (days off, custom hours) |
| ✅ | Double-booking prevention enforced by Postgres (see below) |
| ⏳ | Slot picker across time zones and daylight-saving changes |
| ⏳ | Stripe Checkout deposit, 10-minute hold, idempotent webhooks |
| ⏳ | Confirmation email with `.ics`, 24-hour reminder, cancel and refund |
| ⏳ | Provider dashboard: upcoming bookings and payments |

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Postgres (Neon) with Drizzle ORM · Auth.js v5 · Stripe Checkout · Resend · Tailwind CSS · Vitest + PGlite · Vercel.

## Run it locally

You need Node 20.9+ and a Postgres database (a free Neon project or a local Postgres).

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL and AUTH_SECRET (npx auth secret)
npm run db:migrate && npm run db:seed && npm run dev
```

Open http://localhost:3000 and click **Try the demo**. Without a `RESEND_API_KEY`, sign-in links are printed to the terminal rather than emailed.

```bash
npm test            # unit + database tests (no database server needed)
npm run typecheck
npm run lint
```

## Design decisions

**The database prevents double-booking.** A GiST exclusion constraint rejects any two live bookings for the same provider whose `[starts_at, blocks_until)` ranges overlap. It covers held and confirmed bookings, and `blocks_until` includes the service's buffer. If two students race for the same slot, the second insert fails inside Postgres, whatever the application code does. The constraint is in [`drizzle/0001_no_double_booking.sql`](./drizzle/0001_no_double_booking.sql) and tested in [`src/db/constraints.test.ts`](./src/db/constraints.test.ts). *Trade-off:* it needs the `btree_gist` extension and a hand-written migration, because Drizzle can't express `EXCLUDE`.

**Tests run on real Postgres, with no database server.** Database tests use [PGlite](https://pglite.dev), Postgres compiled to WebAssembly and running in-process. They exercise the real constraints, checks and foreign keys, and CI needs nothing but Node. *Trade-off:* PGlite is Postgres 17 in a single connection, so it can't test behaviour that needs concurrent connections.

**Money is integer cents.** Prices are parsed from strings straight into cents (`"45.50"` → `4550`), so the code never does floating-point arithmetic on money.

**Sessions are signed JWT cookies.** Auth.js's credentials provider, which powers the demo button, requires them, and they save a database read per request. *Trade-off:* a session can't be revoked server-side before it expires.

**Writes are scoped by owner.** Every update and delete filters on `provider_id` as well as the row `id`, so a forged id can't touch another provider's data. Tests cover this.

**Deposits go to one platform Stripe account (no Connect).** This keeps v1 small. The `providers.stripe_account` column is reserved for moving to Stripe Connect later.

## Data model

| Table | Purpose |
|---|---|
| `providers` | Tutor profile: handle, name, IANA time zone |
| `services` | Name, duration, price and deposit (cents), buffer, active flag |
| `availability_rules` | Weekly hours: ISO weekday + start/end wall-clock time in the provider's zone |
| `date_overrides` | One per date: closed, or custom hours replacing the weekly rule |
| `bookings` | Client details, `starts_at`/`ends_at`/`blocks_until`, status (`held`, `confirmed`, `cancelled`, `refunded`, `expired`), hold expiry |
| `payments` | Stripe Checkout session, amount, status |
| `reminders` | When to send, when sent |
| `users`, `accounts`, `verification_tokens` | Auth.js |

## Deploying

Vercel runs `npm run db:migrate && npm run build` (see `vercel.json`). Set the variables from `.env.example` in the Vercel project. Use Neon's **pooled** connection string for `DATABASE_URL`.
