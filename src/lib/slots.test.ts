import { describe, expect, it } from "vitest";
import { generateSlots, groupByLocalDate, isAvailableStart, type SlotInput } from "./slots";

/** Slot starts as compact UTC strings, e.g. "2026-10-19T15:00Z". */
const starts = (input: SlotInput) => generateSlots(input).map((s) => s.start.toISOString().replace(":00.000Z", "Z"));

/** Slot starts as wall-clock "HH:MM" in a zone. */
const localTimes = (input: SlotInput, timeZone: string) =>
  generateSlots(input).map((s) =>
    s.start.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  );

function input(overrides: Partial<SlotInput>): SlotInput {
  return {
    timeZone: "Europe/London",
    weekly: [],
    overrides: [],
    durationMin: 60,
    bufferMin: 0,
    busy: [],
    now: new Date("2026-10-19T00:00Z"),
    minNoticeMin: 0,
    horizonDays: 1,
    ...overrides,
  };
}

const MONDAY_EVENINGS = [{ weekday: 1, start: "16:00", end: "20:00" }];

describe("generateSlots — basics", () => {
  it("puts starts every 30 minutes, ending by the window's end", () => {
    // Monday 19 Oct 2026, London is on BST (UTC+1).
    expect(starts(input({ weekly: MONDAY_EVENINGS }))).toEqual([
      "2026-10-19T15:00Z",
      "2026-10-19T15:30Z",
      "2026-10-19T16:00Z",
      "2026-10-19T16:30Z",
      "2026-10-19T17:00Z",
      "2026-10-19T17:30Z",
      "2026-10-19T18:00Z",
    ]);
  });

  it("snaps an off-grid window start to the next half hour", () => {
    const weekly = [{ weekday: 1, start: "16:15", end: "18:00" }];
    expect(localTimes(input({ weekly }), "Europe/London")).toEqual(["16:30", "17:00"]);
  });

  it("supports a window running to midnight", () => {
    const weekly = [{ weekday: 1, start: "22:00", end: "24:00" }];
    expect(localTimes(input({ weekly }), "Europe/London")).toEqual(["22:00", "22:30", "23:00"]);
  });

  it("handles several windows in one day", () => {
    const weekly = [
      { weekday: 1, start: "09:00", end: "10:00" },
      { weekday: 1, start: "18:00", end: "19:00" },
    ];
    expect(localTimes(input({ weekly }), "Europe/London")).toEqual(["09:00", "18:00"]);
  });
});

describe("generateSlots — time zones and daylight saving", () => {
  it("keeps the wall-clock time across the October change in London (UTC shifts)", () => {
    // Clocks go back on Sunday 25 Oct 2026: 16:00 is 15:00Z before, 16:00Z after.
    const weekly = [{ weekday: 1, start: "16:00", end: "17:00" }];
    expect(starts(input({ weekly, horizonDays: 8 }))).toEqual(["2026-10-19T15:00Z", "2026-10-26T16:00Z"]);
  });

  it("skips start times in the hour that doesn't exist when London springs forward", () => {
    // Sunday 29 Mar 2026: 01:00–02:00 GMT is skipped (clocks jump to 02:00 BST).
    const sunday = {
      weekly: [{ weekday: 7, start: "00:00", end: "04:00" }],
      now: new Date("2026-03-29T00:00Z"),
    };
    expect(localTimes(input(sunday), "Europe/London")).toEqual(["00:00", "00:30", "02:00", "02:30", "03:00"]);
    // The window 00:00–04:00 local is only 3 real hours, so the last 60-minute start is 03:00 BST (02:00Z).
    expect(starts(input(sunday))).toEqual([
      "2026-03-29T00:00Z",
      "2026-03-29T00:30Z",
      "2026-03-29T01:00Z",
      "2026-03-29T01:30Z",
      "2026-03-29T02:00Z",
    ]);
  });

  it("offers a repeated wall time once, at its first occurrence, when London falls back", () => {
    // Sunday 25 Oct 2026: 01:00–02:00 happens twice (BST then GMT). The window 00:00–03:00 is 4 real hours.
    const sunday = {
      weekly: [{ weekday: 7, start: "00:00", end: "03:00" }],
      now: new Date("2026-10-24T23:00Z"), // 00:00 BST on the 25th
    };
    expect(starts(input(sunday))).toEqual([
      "2026-10-24T23:00Z", // 00:00 BST
      "2026-10-24T23:30Z", // 00:30 BST
      "2026-10-25T00:00Z", // 01:00 BST (first 01:00)
      "2026-10-25T00:30Z", // 01:30 BST (first 01:30)
      "2026-10-25T02:00Z", // 02:00 GMT
    ]);
    // Durations are real time: the 01:30 BST session ends 60 minutes later, at 01:30 GMT.
    const slot = generateSlots(input(sunday))[3];
    expect(slot.end.getTime() - slot.start.getTime()).toBe(60 * 60_000);
  });

  it("handles the US change on a different date (New York, 8 Mar 2026)", () => {
    const weekly = [{ weekday: 1, start: "09:00", end: "10:00" }];
    expect(
      starts(input({ timeZone: "America/New_York", weekly, now: new Date("2026-03-01T12:00Z"), horizonDays: 9 })),
    ).toEqual(["2026-03-02T14:00Z", "2026-03-09T13:00Z"]);
  });

  it("is unaffected by other countries' changes in a zone with no DST (Kolkata, UTC+5:30)", () => {
    const weekly = [{ weekday: 1, start: "16:00", end: "17:00" }];
    expect(starts(input({ timeZone: "Asia/Kolkata", weekly, horizonDays: 8 }))).toEqual([
      "2026-10-19T10:30Z",
      "2026-10-26T10:30Z",
    ]);
  });

  it("handles a 45-minute offset (Kathmandu, UTC+5:45)", () => {
    const weekly = [{ weekday: 1, start: "16:00", end: "17:00" }];
    expect(starts(input({ timeZone: "Asia/Kathmandu", weekly }))).toEqual(["2026-10-19T10:15Z"]);
  });

  it("works out 'today' in the provider's zone, not UTC", () => {
    // 20:00Z on Sunday 18 Oct is already Monday 19 Oct 01:30 in Kolkata.
    const weekly = [{ weekday: 1, start: "09:00", end: "10:00" }];
    expect(
      starts(input({ timeZone: "Asia/Kolkata", weekly, now: new Date("2026-10-18T20:00Z") })),
    ).toEqual(["2026-10-19T03:30Z"]);
  });
});

describe("generateSlots — date overrides", () => {
  it("a closed date removes that day's slots", () => {
    const weekly = [{ weekday: 1, start: "16:00", end: "17:00" }];
    const overrides = [{ date: "2026-10-19", start: null, end: null }];
    expect(starts(input({ weekly, overrides, horizonDays: 8 }))).toEqual(["2026-10-26T16:00Z"]);
  });

  it("custom hours replace the weekly hours for that date only", () => {
    const overrides = [{ date: "2026-10-19", start: "10:00", end: "11:00" }];
    expect(localTimes(input({ weekly: MONDAY_EVENINGS, overrides }), "Europe/London")).toEqual(["10:00"]);
  });

  it("custom hours can open a day with no weekly hours", () => {
    const overrides = [{ date: "2026-10-20", start: "09:00", end: "10:00" }];
    expect(starts(input({ overrides, horizonDays: 2 }))).toEqual(["2026-10-20T08:00Z"]);
  });
});

describe("generateSlots — existing bookings, notice and horizon", () => {
  it("removes slots that would overlap a booking or its buffer, counting the new slot's buffer too", () => {
    // Existing: 16:00–17:00 BST with a 15-min buffer → blocks until 17:15 BST.
    const busy = [{ start: new Date("2026-10-19T15:00Z"), end: new Date("2026-10-19T16:15Z") }];
    const weekly = [{ weekday: 1, start: "14:00", end: "20:00" }];
    expect(localTimes(input({ weekly, busy, bufferMin: 15 }), "Europe/London")).toEqual([
      "14:00", // blocks until 15:15
      "14:30", // blocks until 15:45
      // 15:00 would block until 16:15, into the existing booking
      "17:30",
      "18:00",
      "18:30",
      "19:00",
    ]);
  });

  it("enforces minimum notice", () => {
    // Now is 05:00 BST; 12 hours' notice → nothing before 17:00 BST.
    const result = localTimes(
      input({ weekly: MONDAY_EVENINGS, now: new Date("2026-10-19T04:00Z"), minNoticeMin: 12 * 60 }),
      "Europe/London",
    );
    expect(result).toEqual(["17:00", "17:30", "18:00", "18:30", "19:00"]);
  });

  it("stops at the horizon", () => {
    const everyDay = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, start: "09:00", end: "10:00" }));
    const slots = generateSlots(input({ weekly: everyDay, now: new Date("2026-10-01T00:00Z"), horizonDays: 30 }));
    expect(slots).toHaveLength(30);
    // 30 Oct is after the clocks go back, so 09:00 London is 09:00Z (not 08:00Z as on 1 Oct).
    expect(slots[0].start.toISOString()).toBe("2026-10-01T08:00:00.000Z");
    expect(slots.at(-1)!.start.toISOString()).toBe("2026-10-30T09:00:00.000Z");
  });

  it("uses the default rules (12h notice, 30 days, 30-min grid) when none are given", () => {
    const everyDay = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, start: "09:00", end: "10:00" }));
    const { minNoticeMin: _n, horizonDays: _h, ...rest } = input({ weekly: everyDay, now: new Date("2026-10-19T00:00Z") });
    const slots = generateSlots(rest);
    // 09:00 BST today is only 8h away, so the first slot is tomorrow.
    expect(slots[0].start.toISOString()).toBe("2026-10-20T08:00:00.000Z");
    expect(slots).toHaveLength(29);
  });
});

describe("isAvailableStart", () => {
  it("accepts only exact generated starts", () => {
    const i = input({ weekly: MONDAY_EVENINGS });
    expect(isAvailableStart(new Date("2026-10-19T15:00Z"), i)).toBe(true);
    expect(isAvailableStart(new Date("2026-10-19T15:15Z"), i)).toBe(false);
    expect(isAvailableStart(new Date("2026-10-19T19:30Z"), i)).toBe(false); // would end after 20:00
  });
});

describe("groupByLocalDate", () => {
  it("groups by the viewer's date, which can differ from the provider's", () => {
    // 23:00 BST Monday in London is 03:30 Tuesday in Kolkata.
    const slot = new Date("2026-10-19T22:00Z");
    expect([...groupByLocalDate([slot], "Europe/London").keys()]).toEqual(["2026-10-19"]);
    expect([...groupByLocalDate([slot], "Asia/Kolkata").keys()]).toEqual(["2026-10-20"]);
  });
});
