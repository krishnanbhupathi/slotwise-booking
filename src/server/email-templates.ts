import { buildIcs } from "@/lib/ics";
import type { Email } from "@/lib/email";
import { cityName, formatDateTimeIn, formatTimeIn } from "@/lib/format";
import { FREE_CHANGE_CUTOFF_HOURS } from "@/lib/policy";
import { formatMoney } from "@/lib/validation";
import type { BookingContext } from "./booking-context";

// Pure functions: booking context in, email out. No I/O, so they're unit-tested directly.

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(heading: string, paragraphs: string[], action?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("");
  const button = action
    ? `<p style="margin:20px 0"><a href="${action.url}" style="background:#0f6b5c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">${esc(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;line-height:1.5;max-width:520px;margin:0 auto;padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>${body}${button}<p style="margin-top:32px;font-size:12px;color:#78716c">Sent by Slotwise</p></body></html>`;
}

/** The client's local time plus the provider's, e.g. "Mon 19 Oct, 9:30 pm (Kolkata time) — 5:00 pm for Alex". */
function whenForClient({ booking, provider }: BookingContext) {
  const zone = booking.clientTimezone ?? provider.timezone;
  const own = `${formatDateTimeIn(booking.startsAt, zone)} (${cityName(zone)} time)`;
  return zone === provider.timezone ? own : `${own} — ${formatTimeIn(booking.startsAt, provider.timezone)} for ${provider.name}`;
}

const whenForProvider = ({ booking, provider }: BookingContext) =>
  `${formatDateTimeIn(booking.startsAt, provider.timezone)} (${cityName(provider.timezone)} time)`;

const manageUrl = (ctx: BookingContext, baseUrl: string) => `${baseUrl}/booking/${ctx.booking.id}`;

function ics(ctx: BookingContext, baseUrl: string, now: Date, cancelled = false) {
  const { booking, service, provider } = ctx;
  return {
    filename: cancelled ? "cancelled.ics" : "booking.ics",
    contentType: `text/calendar; charset=utf-8; method=${cancelled ? "CANCEL" : "REQUEST"}`,
    content: buildIcs({
      uid: booking.id,
      sequence: booking.icsSequence,
      start: booking.startsAt,
      end: booking.endsAt,
      summary: `${service.name} with ${provider.name}`,
      description: `Manage your booking: ${manageUrl(ctx, baseUrl)}`,
      organizerName: provider.name,
      organizerEmail: provider.email,
      attendeeEmail: booking.clientEmail,
      url: manageUrl(ctx, baseUrl),
      cancelled,
      now,
    }),
  };
}

function depositLine({ service }: BookingContext) {
  if (service.depositCents === 0) return null;
  const rest = service.priceCents - service.depositCents;
  return `Deposit paid: ${formatMoney(service.depositCents, service.currency)}${rest > 0 ? `. Remaining ${formatMoney(rest, service.currency)} is due at the session.` : "."}`;
}

const policyLine = `You can cancel or reschedule free of charge until ${FREE_CHANGE_CUTOFF_HOURS} hours before the session.`;

export function confirmationEmail(ctx: BookingContext, baseUrl: string, now: Date): Email {
  const { booking, service, provider } = ctx;
  const when = whenForClient(ctx);
  const lines = [`${service.name} with ${provider.name}`, when, depositLine(ctx), policyLine].filter(Boolean) as string[];
  return {
    to: booking.clientEmail,
    subject: `Booked: ${service.name} with ${provider.name}`,
    text: `Hi ${booking.clientName},\n\nYou're booked.\n\n${lines.join("\n")}\n\nManage your booking: ${manageUrl(ctx, baseUrl)}\n\nThe attached calendar file adds it to your calendar.`,
    html: layout(
      "You're booked",
      [`Hi ${esc(booking.clientName)},`, ...lines.map(esc), "The attached calendar file adds the session to your calendar."],
      { label: "Manage booking", url: manageUrl(ctx, baseUrl) },
    ),
    attachments: [ics(ctx, baseUrl, now)],
  };
}

export function providerNewBookingEmail(ctx: BookingContext, baseUrl: string): Email {
  const { booking, service, provider } = ctx;
  const lines = [
    `${booking.clientName} (${booking.clientEmail}) booked ${service.name}.`,
    whenForProvider(ctx),
    ...(booking.note ? [`Note: ${booking.note}`] : []),
  ];
  return {
    to: provider.email,
    subject: `New booking: ${booking.clientName}, ${formatDateTimeIn(booking.startsAt, provider.timezone)}`,
    text: `${lines.join("\n")}\n\nDashboard: ${baseUrl}/dashboard`,
    html: layout("New booking", lines.map(esc), { label: "Open dashboard", url: `${baseUrl}/dashboard` }),
  };
}

export function reminderEmail(ctx: BookingContext, baseUrl: string): Email {
  const { booking, service, provider } = ctx;
  const when = whenForClient(ctx);
  return {
    to: booking.clientEmail,
    subject: `Tomorrow: ${service.name} with ${provider.name}`,
    text: `Hi ${booking.clientName},\n\nA reminder of your session:\n${service.name} with ${provider.name}\n${when}\n\nManage your booking: ${manageUrl(ctx, baseUrl)}`,
    html: layout(
      "See you tomorrow",
      [`Hi ${esc(booking.clientName)},`, `A reminder of your session: ${esc(service.name)} with ${esc(provider.name)}.`, esc(when)],
      { label: "View booking", url: manageUrl(ctx, baseUrl) },
    ),
  };
}

export function cancellationEmails(
  ctx: BookingContext,
  opts: { by: "client" | "provider"; refunded: boolean; baseUrl: string; now: Date },
): Email[] {
  const { booking, service, provider } = ctx;
  const { baseUrl } = opts;
  const deposit = service.depositCents > 0 ? formatMoney(service.depositCents, service.currency) : null;
  const money = deposit
    ? opts.refunded
      ? `Your ${deposit} deposit has been refunded. It can take 5–10 days to appear.`
      : `As the cancellation was within ${FREE_CHANGE_CUTOFF_HOURS} hours of the session, the ${deposit} deposit is not refunded.`
    : null;
  const who = opts.by === "provider" ? `${provider.name} cancelled your session` : "Your session is cancelled";

  const client: Email = {
    to: booking.clientEmail,
    subject: `Cancelled: ${service.name} with ${provider.name}`,
    text: `Hi ${booking.clientName},\n\n${who}: ${service.name}, ${whenForClient(ctx)}.\n${money ?? ""}\n\nBook another time: ${baseUrl}/book/${provider.handle}`,
    html: layout(
      "Session cancelled",
      [`Hi ${esc(booking.clientName)},`, `${esc(who)}: ${esc(service.name)}, ${esc(whenForClient(ctx))}.`, ...(money ? [esc(money)] : [])],
      { label: "Book another time", url: `${baseUrl}/book/${provider.handle}` },
    ),
    attachments: [ics(ctx, baseUrl, opts.now, true)],
  };
  if (opts.by === "provider") return [client];

  const notice = `${booking.clientName} cancelled ${service.name} on ${whenForProvider(ctx)}.${deposit ? (opts.refunded ? ` The ${deposit} deposit was refunded.` : ` The ${deposit} deposit is kept (late cancellation).`) : ""}`;
  return [
    client,
    {
      to: provider.email,
      subject: `Cancelled: ${booking.clientName}, ${formatDateTimeIn(booking.startsAt, provider.timezone)}`,
      text: notice,
      html: layout("Booking cancelled", [esc(notice)], { label: "Open dashboard", url: `${baseUrl}/dashboard` }),
    },
  ];
}

export function rescheduleEmails(ctx: BookingContext, opts: { previousStart: Date; baseUrl: string; now: Date }): Email[] {
  const { booking, service, provider } = ctx;
  const { baseUrl } = opts;
  const zone = booking.clientTimezone ?? provider.timezone;
  const was = formatDateTimeIn(opts.previousStart, zone);
  return [
    {
      to: booking.clientEmail,
      subject: `Rescheduled: ${service.name} with ${provider.name}`,
      text: `Hi ${booking.clientName},\n\nYour session has moved.\nNow: ${whenForClient(ctx)}\nWas: ${was}\n\nThe attached calendar file updates your calendar.\nManage your booking: ${manageUrl(ctx, baseUrl)}`,
      html: layout(
        "Session rescheduled",
        [`Hi ${esc(booking.clientName)},`, `Now: <strong>${esc(whenForClient(ctx))}</strong>`, `Was: ${esc(was)}`, "The attached calendar file updates your calendar."],
        { label: "Manage booking", url: manageUrl(ctx, baseUrl) },
      ),
      attachments: [ics(ctx, baseUrl, opts.now)],
    },
    {
      to: provider.email,
      subject: `Rescheduled: ${booking.clientName}, now ${formatDateTimeIn(booking.startsAt, provider.timezone)}`,
      text: `${booking.clientName} moved ${service.name} to ${whenForProvider(ctx)} (was ${formatDateTimeIn(opts.previousStart, provider.timezone)}).`,
      html: layout(
        "Booking rescheduled",
        [esc(`${booking.clientName} moved ${service.name} to ${whenForProvider(ctx)} (was ${formatDateTimeIn(opts.previousStart, provider.timezone)}).`)],
        { label: "Open dashboard", url: `${baseUrl}/dashboard` },
      ),
    },
  ];
}
