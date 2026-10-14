# Progress

Spec: "Case Study Build Plan" (Claude Doc). Timeline: Day 1 Fri 16 Oct → Day 7 Thu 22 Oct 2026.

## Status — end of session 1 (15 Oct 2026)

**Day 1 scope is built and works locally. It is not deployed yet:** this is waiting on Vercel, Neon and Resend accounts (see "Blocked on Krishna").

### Done
- Next.js 16 app scaffolded; Tailwind v4; ESLint; Vitest; GitHub Actions CI (lint, typecheck, tests, build).
- Drizzle schema for all 7 domain tables plus Auth.js tables; migrations in `drizzle/`.
- `bookings_no_overlap` exclusion constraint (GiST, `btree_gist`) covering held and confirmed bookings, buffer included.
- Auth.js v5: Resend magic link (printed to the console without a key, outside production) plus demo credentials login; JWT sessions.
- Onboarding (name, handle, time zone); dashboard shell; services CRUD (delete becomes archive once booked); weekly hours editor; date overrides; placeholder `/book/[handle]`.
- Demo seed: `demo@slotwise.dev` → `/book/demo-tutor` (Alex Morgan, Europe/London, 3 services, Mon–Fri 16:00–20:00, Sat 10:00–14:00).
- Tests: 53 passing (constraints, validation, services and availability data layer), run on PGlite.
- Clicked through locally in Chrome: demo login, add/validate/delete a service, overlap error and save on weekly hours, add/remove a day off, magic-link sign-up → onboarding (taken handle rejected) → dashboard, public page.

### Next (Day 2, Sat 17 Oct)
1. Slot engine: weekly rules + overrides → UTC slots in the provider's zone, minus existing bookings and buffers; tests across zones and DST (London Mar/Oct, US Mar/Nov, Asia/Kolkata with no DST, a 30-minute-offset zone).
2. Slot picker page `/book/[handle]/[service]`, shown in the client's zone.
3. Booking flow: details → insert `held` booking (expire stale holds in the same transaction) → Stripe Checkout (deposit) → webhook confirms.
4. Idempotent webhook: `stripe_events` table keyed by event id; same event twice → one confirmation. Tests.

### Decisions
| Date | Decision | Why |
|---|---|---|
| 15 Oct | Name Slotwise; demo provider = tutor; repo `slotwise-booking` | Krishna |
| 15 Oct | Magic link (Resend) + one-click demo login | Krishna; demo login needs JWT sessions |
| 15 Oct | No Stripe Connect in v1; deposits to platform account | Krishna; saves ~½ day; column reserved |
| 15 Oct | Neon + postgres.js driver (`prepare: false` for the pooler) | Works with Neon pooler and local Postgres alike |
| 15 Oct | PGlite for DB tests | Real constraints in CI with no DB service |
| 15 Oct | Cache Components off | Every page is per-user or live data; Auth.js cookie reads would need Suspense everywhere |
| 15 Oct | Migrations run in the Vercel build command | Simple; preview deploys need their own DB branch (Neon integration does this) |
| 15 Oct | Buffer applies after a booking; `blocks_until = ends_at + buffer` | Lets the exclusion constraint include the buffer |
| 15 Oct | Prices in USD for the demo | Assumption; `services.currency` column allows change |

### Blocked on Krishna
- Vercel project (import the GitHub repo), Neon database (through Vercel → Storage is easiest), Resend API key + verify `bhupathi.dev`.
- Vercel env vars: `DATABASE_URL` (pooled), `AUTH_SECRET`, `AUTH_URL` (the production URL), `RESEND_API_KEY`, `EMAIL_FROM`, `DEMO_EMAIL=demo@slotwise.dev`.
- After the first deploy: run `npm run db:seed` once against the production database.

### Known issues
- The demo account is shared; visitors can change its services and hours. Plan: reset with `db:seed` (cron or on demo login) on Day 3.
- Production magic links fail until `RESEND_API_KEY` is set (the login page says sign-in is unavailable). Until `bhupathi.dev` is verified, Resend only delivers to the account owner's address.
- A provider can't change their time zone after onboarding yet (no settings page).
- Vercel Hobby crons run at most daily, so 24-hour-ahead reminders need Pro, an external scheduler, or a daily batch. Decide on Day 3.
- Auth.js v5 is still a beta release (pinned to `5.0.0-beta.32`).
