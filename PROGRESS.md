# Progress

Spec: "Case Study Build Plan" (Claude Doc). Timeline: Day 1 Fri 16 Oct → Day 7 Thu 22 Oct 2026.

## Status — end of session 2 (Day 2 scope)

**Days 1 and 2 are built, tested and pushed. Neither is deployed:** this is waiting on Vercel, Neon, Resend and Stripe accounts (see "Blocked on Krishna"). A real Stripe test payment has not been clicked through yet, because there are no keys.

### Done
**Day 1**
- Next.js 16 app, Tailwind v4, ESLint, Vitest, GitHub Actions CI (lint, typecheck, tests, build): green on `main`.
- Drizzle schema plus migrations; the `bookings_no_overlap` exclusion constraint (GiST, `btree_gist`) covers held and confirmed bookings, buffer included.
- Auth.js v5: Resend magic link (printed to the console outside production when there's no key) plus a demo login; JWT sessions.
- Onboarding, dashboard, services CRUD (archive once booked), weekly hours, date overrides.
- Demo seed: `demo@slotwise.dev` → `/book/demo-tutor`.

**Day 2**
- Slot engine `src/lib/slots.ts` (Temporal polyfill): 30-minute wall-clock grid, 12h notice, 30-day horizon, overrides, busy bookings plus buffers. DST rules: skipped times dropped, repeated times at first occurrence, durations in real time.
- `placeHold`: re-checks the slot, retires lapsed holds and inserts in one transaction; the exclusion constraint settles races (reported as "taken").
- Stripe Checkout deposit (test-key guard, per-booking idempotency key); `/api/stripe/webhook` verifies the signature, and `handleStripeEvent` records event ids transactionally. Late payment: confirm if the slot is free, else auto-refund. The expired session releases the hold. A reminder row is created on confirmation (24h before).
- Booking UI: `/book/[handle]` → `/book/[handle]/[service]` (date strip + times in the viewer's zone, switchable; details form) → Stripe or instant confirmation → `/booking/[id]` status page (polls while the webhook arrives). Cancelling checkout expires the session and releases the hold.
- Tests: 96 passing. Slot engine 20 (London spring/autumn, New York, Kolkata, Kathmandu, overrides, buffers, notice, horizon), holds 9 (including a concurrent race), webhook 12 (idempotency, rollback, late-payment refund), plus validation and the Day 1 suites.
- Clicked through locally: free intro call booked end to end; the slot disappears and neighbouring 60-min slots are removed by the buffer; a paid booking without Stripe keys shows a clear error and releases the hold.

### Next (Day 3, Sun 18 Oct)
1. **First:** deploy once accounts exist, and run a real Stripe test payment through the Stripe CLI and on Vercel.
2. Emails via Resend: confirmation with `.ics`, reminder 24h before; restore "confirmation sent" copy on `/booking/[id]`.
3. Reminder cron route `/api/cron/reminders` (decide the Hobby-plan schedule).
4. Cancel/refund: provider cancels with refund from the dashboard; client cancel link with a cut-off rule.
5. Dashboard: upcoming bookings, payments list.
6. Playwright end-to-end tests; demo data reset; mobile check of all pages.

### Decisions
| Date | Decision | Why |
|---|---|---|
| 15 Oct | Name Slotwise; demo provider = tutor; repo `slotwise-booking` | Krishna |
| 15 Oct | Magic link (Resend) + one-click demo login | Krishna; demo login needs JWT sessions |
| 15 Oct | No Stripe Connect in v1; deposits to the platform account | Krishna; saves ~½ day; column reserved |
| 15 Oct | Neon + postgres.js driver (`prepare: false` for the pooler) | Works with the Neon pooler and local Postgres alike |
| 15 Oct | PGlite for DB tests | Real constraints in CI with no DB service |
| 15 Oct | Cache Components off | Every page is per-user or live data |
| 15 Oct | Migrations run in the Vercel build command | Simple; previews need their own DB branch |
| 15 Oct | Buffer applies after a booking; `blocks_until = ends_at + buffer` | Lets the exclusion constraint include the buffer |
| 15 Oct | Prices in USD for the demo | Assumption; `services.currency` allows change |
| Day 2 | Slots every 30 min on the wall clock | Krishna |
| Day 2 | 12h minimum notice, 30-day horizon | Krishna |
| Day 2 | No-deposit services confirm instantly, no Stripe | Krishna |
| Day 2 | Booking form: name, email, optional note | Krishna; the form-builder intake replaces/extends it on Day 6 |
| Day 2 | Temporal polyfill for zone math (server only) | Explicit DST disambiguation; ~20 kB, not shipped to the browser |
| Day 2 | Late payment after hold expiry: confirm if free, else refund | Checkout sessions can't expire in under 30 min |
| Day 2 | Booking page URL `/booking/<uuid>` acts as the client's access link | No client accounts; a random v4 UUID is unguessable. Cancel links on Day 3 need a signed token or the same UUID; decide then |

### Blocked on Krishna
- Vercel project (import the GitHub repo), Neon database (through Vercel → Storage), Resend API key + verify `bhupathi.dev`.
- Stripe test mode: `STRIPE_SECRET_KEY` (sk_test_…), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local` and Vercel; `brew install stripe/stripe-cli/stripe && stripe login` for local webhooks; after deploy, a dashboard webhook endpoint → `STRIPE_WEBHOOK_SECRET` in Vercel.
- Vercel env vars: `DATABASE_URL` (pooled), `AUTH_SECRET`, `AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `DEMO_EMAIL=demo@slotwise.dev`, plus the Stripe vars.
- After the first deploy: `npm run db:seed` once against production.

### Known issues
- The demo account is shared; visitors can change its services and hours. Reset planned for Day 3.
- Anyone can create many 10-minute holds (no rate limit). Acceptable for a demo; note it in the write-up as "what I'd do next".
- Copy on the picker says "the rest is paid to the tutor directly": assumed, needs Krishna's OK.
- Phone-width layout of the picker is not visually checked yet (window resize failed); do it on Day 3.
- Production magic links fail until `RESEND_API_KEY` is set.
- A provider can't change their time zone after onboarding.
- Vercel Hobby crons run at most daily; decide the reminders approach on Day 3.
- Auth.js v5 is a beta release (pinned to `5.0.0-beta.32`).
