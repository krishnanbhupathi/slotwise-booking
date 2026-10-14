import { describe, expect, it } from "vitest";
import { buildIcs, type IcsEvent } from "./ics";

const base: IcsEvent = {
  uid: "7a7bcbe2-4553-4fca-9324-decc6024e2b0",
  sequence: 0,
  start: new Date("2026-10-19T15:00:00Z"),
  end: new Date("2026-10-19T16:00:00Z"),
  summary: "GCSE Maths – 1:1 with Alex Morgan",
  description: "Booked via Slotwise",
  organizerName: "Alex Morgan",
  organizerEmail: "alex@example.com",
  attendeeEmail: "sam@example.com",
  now: new Date("2026-10-18T09:30:15.123Z"),
};

const lines = (ics: string) => ics.split("\r\n");

describe("buildIcs", () => {
  it("produces a CRLF-delimited VCALENDAR with UTC times", () => {
    const ics = buildIcs(base);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(lines(ics)).toEqual(
      expect.arrayContaining([
        "BEGIN:VCALENDAR",
        "METHOD:REQUEST",
        "UID:7a7bcbe2-4553-4fca-9324-decc6024e2b0@slotwise",
        "SEQUENCE:0",
        "DTSTAMP:20261018T093015Z",
        "DTSTART:20261019T150000Z",
        "DTEND:20261019T160000Z",
        "STATUS:CONFIRMED",
        "END:VCALENDAR",
      ]),
    );
  });

  it("marks a cancellation so calendars remove the event", () => {
    const ics = buildIcs({ ...base, sequence: 2, cancelled: true });
    expect(lines(ics)).toEqual(expect.arrayContaining(["METHOD:CANCEL", "SEQUENCE:2", "STATUS:CANCELLED"]));
  });

  it("escapes commas, semicolons, backslashes and newlines in text", () => {
    const ics = buildIcs({ ...base, description: "Topics: algebra, graphs; a\\b\nLine 2" });
    expect(ics).toContain("DESCRIPTION:Topics: algebra\\, graphs\\; a\\\\b\\nLine 2");
  });

  it("folds long lines at 75 octets without splitting multi-byte characters", () => {
    const ics = buildIcs({ ...base, description: "é".repeat(100) });
    const encoder = new TextEncoder();
    for (const line of lines(ics)) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    // Unfolding (remove CRLF + space) restores the original value.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`DESCRIPTION:${"é".repeat(100)}`);
  });
});
