# Progress

Spec: "Case Study Build Plan" (Claude Doc). Timeline: Day 1 Fri 16 Oct → Day 7 Thu 22 Oct 2026.

## Status — end of session 3 (Day 3 scope)

**The booking tool is feature-complete, tested, and green in CI (unit + e2e). Real Stripe (sandbox) payments are now verified locally. It has never been deployed:** this is waiting on Vercel/Neon/Resend (see "Blocked on Krishna"). This is the top risk for the week.

**Stripe sandbox check (15 Oct, local production build + `stripe listen`):**
- Paid $10 deposit with card 4242 → `checkout.session.completed` → booking confirmed, payment paid, reminder created.
- `stripe events resend` of the same event → handler logged `duplicate`; still 1 reminder and 1 stored event.
- Client cancel 2+ days ahead → real Stripe refund (`succeeded`, 1000 usd); booking and payment `refunded`.
- Left Checkout via the back link → session expired in Stripe, hold `expired`, payment `failed`; `checkout.session.expired` webhook → `released`.
- Indian sandbox account: Checkout offered INR conversion by default (USD selectable); no address-collection error.

### Done
**Day 1:** scaffold, CI, schema plus the exclusion constraint, Auth.js (magic link + demo), onboarding, services, weekly hours, date overrides.

**Day 2:** slot engine (Temporal, DST-tested), holds with race protection, Stripe Checkout deposit, idempotent webhook with late-payment refund, booking UI.

**Day 3**
- Emails (`src/server/email-templates.ts`, pure): confirmation + `.ics`, tutor notice, 24h reminder, cancellation (client/tutor), reschedule (updated `.ics`), late-payment refund. Sent via `after()` once the change has committed; HTML-escaped.
- `.ics` generator (`src/lib/ics.ts`): stable UID, SEQUENCE bumped on each change, METHOD:CANCEL, escaping and 75-octet line folding.
- Policy (`src/lib/policy.ts`): free cancel/reschedule until 24h before; a late client cancel keeps the deposit; the tutor always refunds.
- `cancelBooking` (row lock, refund before commit, idempotent refund key) and `rescheduleBooking` (re-checks the slot ignoring its own time, moves the reminder).
- Client `/booking/<id>`: Cancel (states the refund outcome first) and Reschedule (`/booking/<id>/reschedule`, shared `SlotGrid`).
- Dashboard: upcoming bookings by day with the client's local time and "Cancel & refund"; `/dashboard/payments` table.
- Cron: `/api/cron/reminders` (atomic claim, retry on failure, expires lapsed holds) and `/api/cron/reset-demo`, both protected by a bearer `CRON_SECRET`, triggered by `.github/workflows/cron.yml` (hourly / 03:17 UTC daily).
- Demo reset (`src/server/demo.ts`) shared by `db:seed` and the cron: restores services and hours and adds 3 sample bookings (fictional students, `pi_demo_` payment ids that skip Stripe on refund).
- Playwright e2e (`e2e/`), desktop + Pixel 7, against a production build: book → reschedule → cancel; 24h rule hides reschedule; a booked slot disappears; a paid booking without Stripe fails safely; dashboard, payments, form validation. CI job with Postgres 16.
- Mobile check via Playwright screenshots: picker and dashboard OK; weekly-hours editor fixed for phones.
- Tests: **131 unit/integration (Vitest) + 14 e2e (Playwright)**, all passing locally and in CI.

### Next
1. **Unblock deploy** (Krishna's accounts), then deploy, seed production, set the cron secrets, and run a real Stripe test payment both locally (Stripe CLI) and on Vercel. Fix whatever breaks first.
2. Day 4 (Mon 19 Oct): form builder: schema, palette, drag-and-drop canvas, properties panel, live preview (new repo).

### Decisions
| Date | Decision | Why |
|---|---|---|
| 15 Oct | Name Slotwise; demo provider = tutor; repo `slotwise-booking` | Krishna |
| 15 Oct | Magic link (Resend) + one-click demo login | Krishna; demo login needs JWT sessions |
| 15 Oct | No Stripe Connect in v1 | Krishna; saves ~½ day; column reserved |
| 15 Oct | Neon + postgres.js (`prepare: false`) | Works with the Neon pooler and local Postgres |
| 15 Oct | PGlite for DB tests | Real constraints with no DB service |
| 15 Oct | Cache Components off | Every page is per-user or live data |
| 15 Oct | Migrations in the Vercel build command | Simple; previews need their own DB branch |
| 15 Oct | Buffer after a booking; `blocks_until = ends_at + buffer` | Lets the constraint include the buffer |
| 15 Oct | Prices in USD for the demo | Assumption; `services.currency` allows change |
| Day 2 | Slots every 30 min; 12h notice; 30-day horizon | Krishna |
| Day 2 | No-deposit services confirm instantly | Krishna |
| Day 2 | Booking form: name, email, optional note | Krishna |
| Day 2 | Temporal polyfill (server only) | Explicit DST handling |
| Day 2 | Late payment: confirm if free, else refund | Checkout sessions last ≥30 min |
| Day 3 | Free cancel until 24h; later cancels keep the deposit; tutor cancels always refund | Krishna |
| Day 3 | Keep the reschedule link (same 24h cut-off, deposit carries over) | Krishna |
| Day 3 | Reminders via GitHub Actions hourly | Krishna; Vercel Hobby crons are daily |
| Day 3 | Nightly demo reset with sample bookings | Krishna |
| Day 3 | The booking UUID is the client's access key (no tokens/accounts) | Random v4 UUID, only sent to the client; simplest. Next step: signed, expiring links |
| Day 3 | Emails best-effort after commit (no outbox) | Time; noted as "what I'd do next" |
| Day 3 | E2E runs against `next build` + `next start` | Tests what users get; avoids dev-only hydration timing |
| Day 3 | Stripe sandbox (no business verification) | Stripe India is invite-only for live accounts; test mode needs none |

### Blocked on Krishna
- ~~Stripe test account~~: done (sandbox; India accounts are invite-only for live mode, but test mode works). Keys are in `.env.local`; add the same to Vercel. **Roll the secret key** after the project (it was pasted in chat).
- Vercel project (import the repo), Neon via Vercel → Storage, Resend API key + verify `bhupathi.dev`.
- Vercel env: `DATABASE_URL` (pooled), `AUTH_SECRET`, `AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `DEMO_EMAIL=demo@slotwise.dev`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`.
- GitHub repo secrets for the cron workflow: `APP_URL`, `CRON_SECRET`.
- Stripe dashboard webhook → `https://<domain>/api/stripe/webhook` (events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`).

### Known issues
- Not deployed. Stripe verified locally only; the production webhook endpoint still needs creating after deploy.
- Browser automation (Claude in Chrome) sometimes loses the first click on a freshly loaded page; Playwright (which clicks immediately) passes, so treated as a tooling artefact, not an app bug.
- Picker copy "the rest is paid to the tutor directly" still needs Krishna's OK.
- The e2e test "rescheduling isn't offered inside 24 hours" skips itself if the earliest slot happens to be more than 24h away at that time of day.
- In `next dev`, a click before the page finishes loading can be lost (seen with the demo button); the production build is fine (e2e).
- No rate limit on holds; no email outbox/retry; a provider can't change their time zone after onboarding.
- Auth.js v5 is a beta release (pinned to `5.0.0-beta.32`).
