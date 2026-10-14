import { describe, expect, it } from "vitest";
import type { Booking, Provider, Service } from "@/db/schema";
import type { BookingContext } from "./booking-context";
import { cancellationEmails, confirmationEmail, providerNewBookingEmail, reminderEmail, rescheduleEmails } from "./email-templates";

const NOW = new Date("2026-10-18T09:00Z");
const BASE = "https://slotwise.example";

const ctx: BookingContext = {
  provider: { id: "p1", handle: "demo-tutor", name: "Alex Morgan", email: "alex@example.com", timezone: "Europe/London" } as Provider,
  service: { name: "GCSE Maths", durationMin: 60, priceCents: 4500, depositCents: 1000, currency: "usd" } as Service,
  booking: {
    id: "b1",
    clientName: "Sam <script>",
    clientEmail: "sam@example.com",
    clientTimezone: "Asia/Kolkata",
    note: null,
    startsAt: new Date("2026-10-19T15:00Z"),
    endsAt: new Date("2026-10-19T16:00Z"),
    icsSequence: 0,
  } as Booking,
};

describe("email templates", () => {
  it("confirmation shows the client's time and the provider's, the deposit, and attaches an .ics", () => {
    const email = confirmationEmail(ctx, BASE, NOW);
    expect(email.to).toBe("sam@example.com");
    expect(email.text).toContain("Mon 19 Oct, 8:30 pm (Kolkata time) — 4:00 pm for Alex Morgan");
    expect(email.text).toContain("Deposit paid: $10.00. Remaining $35.00 is due at the session.");
    expect(email.text).toContain(`${BASE}/booking/b1`);
    expect(email.attachments?.[0]).toMatchObject({ filename: "booking.ics" });
    expect(email.attachments?.[0].content).toContain("DTSTART:20261019T150000Z");
  });

  it("escapes user-supplied text in HTML", () => {
    const { html } = confirmationEmail(ctx, BASE, NOW);
    expect(html).toContain("Sam &lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("reminder links to the booking", () => {
    expect(reminderEmail(ctx, BASE).text).toContain(`${BASE}/booking/b1`);
  });

  it("client cancellation emails both sides and says whether the deposit is refunded", () => {
    const [client, provider] = cancellationEmails(ctx, { by: "client", refunded: true, baseUrl: BASE, now: NOW });
    expect(client.text).toContain("$10.00 deposit has been refunded");
    expect(client.attachments?.[0].content).toContain("METHOD:CANCEL");
    expect(provider.to).toBe("alex@example.com");

    const [late] = cancellationEmails(ctx, { by: "client", refunded: false, baseUrl: BASE, now: NOW });
    expect(late.text).toContain("is not refunded");
  });

  it("provider cancellation emails only the client", () => {
    const emails = cancellationEmails(ctx, { by: "provider", refunded: true, baseUrl: BASE, now: NOW });
    expect(emails).toHaveLength(1);
    expect(emails[0].text).toContain("Alex Morgan cancelled your session");
  });

  it("reschedule shows the new and old times and bumps the calendar sequence", () => {
    const moved = { ...ctx, booking: { ...ctx.booking, startsAt: new Date("2026-10-20T15:00Z"), icsSequence: 1 } };
    const [client] = rescheduleEmails(moved, { previousStart: new Date("2026-10-19T15:00Z"), baseUrl: BASE, now: NOW });
    expect(client.text).toContain("Now: Tue 20 Oct, 8:30 pm");
    expect(client.text).toContain("Was: Mon 19 Oct, 8:30 pm");
    expect(client.attachments?.[0].content).toContain("SEQUENCE:1");
  });

  it("includes intake answers in the tutor's new-booking email, escaped", () => {
    const withIntake = {
      ...ctx,
      booking: {
        ...ctx.booking,
        intake: {
          formId: "f",
          version: 1,
          title: "Student intake",
          answers: [
            { id: "year", label: "School year", value: "Year 11" },
            { id: "consent", label: "Parent consents", value: true },
            { id: "goals", label: "Goals", value: "<b>pass</b>" },
          ],
        },
      } as Booking,
    };
    const email = providerNewBookingEmail(withIntake, BASE);
    expect(email.text).toContain("Student intake:\nSchool year: Year 11\nParent consents: Yes\nGoals: <b>pass</b>");
    expect(email.html).toContain("Goals: &lt;b&gt;pass&lt;/b&gt;");
    expect(providerNewBookingEmail(ctx, BASE).text).not.toContain("intake");
  });
});
