# Progress

Spec: "Case Study Build Plan" (Claude Doc). Timeline: Day 1 Fri 16 Oct → Day 7 Thu 22 Oct 2026.

## Status: Day 7 (measure, polish, ship)

- **Live:** https://slotwise-booking-xi.vercel.app. Deposits work end to end in Stripe test mode, and emails send from `mail.bhupathi.dev`.
- **Restyle:** Visual identity changed to a school timetable (Krishna chose option C from three mockups): week grid booking page (days across, times down, closed days hatched; one day at a time on phones), one colour per subject assigned by service creation order (`lib/subjects.ts`), Gabarito for headings/times/prices and Lexend for text (Atkinson Hyperlegible was planned, but its slashed zero made prices read as "$1θ.θθ"). A combined multi-subject week was out of MVP scope: each service still has its own timetable. Taken slots aren't shown (the server only sends open times).
- **Measured** (production, median of 3 Lighthouse runs, `docs/measurements/lighthouse-2026-10-14-timetable`): mobile performance 98 / 99 / 98 (home / tutor / booking), accessibility 100 everywhere, mobile LCP 2.0 / 2.0 / 2.3 s; desktop 100 across the board.
- **Tests:** 156 Vitest + 18 Playwright runs, green in CI. E2E picks times through `e2e/slots.ts`, which works in both the week and day views.
- **README:** live link, screenshot, measurements, design, known limitations.
- **Next:** the ~90 s video (Playwright recording, Deepgram Aura-2 "Thalia" voiceover, captions), case-study page on bhupathi.dev.

## Earlier status: Day 6 (intake forms from Formwise)

**Day 6 (15 Oct): clients now answer a tutor's Formwise form when booking.** Deployed and smoke-tested on production; CI green.
- **Attaching a form:** a tutor pastes a Formwise share link on a service (`src/app/dashboard/services/intake-section.tsx`).
  - The server fetches the published version, only ever from the Formwise origin (`FORMWISE_ORIGIN`), validates it with Formwise's `parseFormSchema`, and stores its own copy on `services.intake_form`.
  - **Refresh** pulls the latest version; **Remove** detaches it.
- **Booking page:** shows the questions with the vendored `<FormFields>` inside Slotwise's form.
  - The server action validates answers with `validateSubmission` *before* any hold or Stripe session.
  - Answers are stored with their labels on `bookings.intake`.
  - Shown in the dashboard and in the tutor's new-booking email.
- **Renderer** vendored in `src/vendor/formwise`, via `node scripts/sync-formwise.mjs` (records the source commit and rewrites `.js` specifiers for Next's bundler). Decision: no npm publish (Krishna).
- **Demo:** A-level Physics has a real published Formwise form (`/f/jmdpq5gycd`); one sample booking carries answers. Its edit link is in `.env.local` as `FORMWISE_DEMO_EDIT_URL`.
- **Production smoke (15 Oct):**
  - Refresh fetched the live Formwise form;
  - an empty intake was rejected server-side and created no booking;
  - the dashboard shows the sample answers;
  - no page errors.
- **Tests:** **151 Vitest** (+20: link parsing incl. SSRF cases, fetch errors, provider scoping, server validation, hold storage, email, demo) + **18 Playwright** (desktop + Pixel 7), all passing locally and in CI.

## Earlier status: end of session 3 (Day 3 scope)

**The booking tool is feature-complete, tested, and green in CI (unit + e2e). Real Stripe (sandbox) payments are verified locally.**

**Deployed (15 Oct): https://slotwise-booking-xi.vercel.app** (`slotwise-booking.vercel.app` belongs to someone else; a custom domain such as `slotwise.bhupathi.dev` is the planned fix).
- Neon database `slotwise`, in the same Neon project as Formwise (aws-us-east-2); functions pinned to `cle1`.
- Pushes to `main` deploy; migrations run in the build. Production seeded with the demo account.
- Smoke-tested on production:
  - pages return 200;
  - the demo login reaches the dashboard with the seeded bookings and no page errors;
  - `/api/cron/*` returns 401 without the secret;
  - the webhook returns 400 for unsigned events;
  - the GitHub cron workflow ran against production and returned `{"sent":0,"failed":0,"expiredHolds":0}`.
- Stripe test-mode webhook endpoint `we_1UQa2OPu6A3W7fflYOFQUc03` points at the live URL, for the three checkout events.
- **Real test payment on production (15 Oct, Krishna):** booking `confirmed`, $15.00 deposit `paid`, one `checkout.session.completed` stored. No reminder row because the lesson was <24h away, by design.
- **Email:** Resend domain `mail.bhupathi.dev` verified (DKIM + SPF via Cloudflare Domain Connect, region us-east-1). The Resend key has sending access to that domain only. Sender: `Slotwise <bookings@mail.bhupathi.dev>`. A magic-link email to Krishna's Gmail showed "Delivered" in Resend.

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

### Next (as of Day 3; done since)
1. ~~Unblock deploy~~: deployed, seeded, cron secrets set, live Stripe test payment confirmed.
2. ~~Day 4: form builder~~: built as Formwise.

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
| 15 Oct | One Neon project (us-east-2) for both apps, one database each; Vercel functions in `cle1` | Krishna's existing Neon project; function and database in the same metro |
| 15 Oct | Production secrets generated fresh and piped CLI→Vercel | Never shown in chat or committed |
| Day 6 | Tutors attach a Formwise share link; Slotwise keeps a copy (with Refresh) | Krishna; bookings never depend on Formwise being up |
| Day 6 | Renderer vendored, not installed from npm | Krishna; sync script keeps it identical to Formwise |
| Day 6 | Intake answers validated in the server action before the hold | Invalid answers never create holds or Stripe sessions |
| 15 Oct | Send from the subdomain `mail.bhupathi.dev` | Krishna; keeps sending reputation and DNS separate from the portfolio domain |
| 15 Oct | Booking-page copy "The rest is paid to {tutor} directly" | Krishna approved |

### Blocked on Krishna
- Optional: a custom domain (e.g. `slotwise.bhupathi.dev`). If added, update `AUTH_URL`, the GitHub `APP_URL` secret and the Stripe webhook URL.
- ~~Roll the Stripe secret key~~ Done 15 Oct: Krishna rotated it (old key expired); Vercel production and `.env.local` updated, live Checkout verified.

### Known issues
- Preview deployments have no database (migrations skipped); production only for now.
- An attached intake form is a copy: changes published in Formwise appear only after the tutor clicks Refresh (by design, so bookings don't depend on Formwise being up).
- Intake conditions only support "equals one value" (a Formwise limitation).
- Browser automation (Claude in Chrome) sometimes loses the first click on a freshly loaded page; Playwright (which clicks immediately) passes, so treated as a tooling artefact, not an app bug.
- Taken times aren't shown on the timetable (only open times come from the server).
- The e2e test "rescheduling isn't offered inside 24 hours" skips itself if the earliest slot happens to be more than 24h away at that time of day.
- In `next dev`, a click before the page finishes loading can be lost (seen with the demo button); the production build is fine (e2e).
- No rate limit on holds; no email outbox/retry; a provider can't change their time zone after onboarding.
- Auth.js v5 is a beta release (pinned to `5.0.0-beta.32`).
