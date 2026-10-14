import { describe, expect, it } from "vitest";
import {
  bookingDetailsSchema,
  dateOverrideSchema,
  fieldErrors,
  formatMoney,
  handleSchema,
  moneySchema,
  onboardingSchema,
  serviceSchema,
  slugify,
  weeklyAvailabilitySchema,
} from "./validation";

describe("moneySchema", () => {
  it.each([
    ["45", 4500],
    ["45.5", 4550],
    ["45.50", 4550],
    ["0.07", 7],
    ["0", 0],
  ])("parses %s to %i cents without float error", (input, cents) => {
    expect(moneySchema.parse(input)).toBe(cents);
  });

  it.each(["", "-5", "4.555", "abc", "1,000"])("rejects %j", (input) => {
    expect(moneySchema.safeParse(input).success).toBe(false);
  });

  it("formats cents for display", () => {
    expect(formatMoney(4550, "usd")).toBe("$45.50");
  });
});

describe("handleSchema", () => {
  it("lowercases and trims", () => {
    expect(handleSchema.parse("  Maya-Tutor ")).toBe("maya-tutor");
  });

  it.each(["ab", "-maya", "maya-", "maya tutor", "maya_tutor", "a".repeat(33)])("rejects %j", (h) => {
    expect(handleSchema.safeParse(h).success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  it("accepts IANA time zones and rejects unknown ones", () => {
    const base = { name: "Maya", handle: "maya" };
    expect(onboardingSchema.safeParse({ ...base, timezone: "Asia/Kolkata" }).success).toBe(true);
    expect(onboardingSchema.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("serviceSchema", () => {
  const valid = { name: "GCSE Maths", description: "", durationMin: "60", price: "45", deposit: "10", bufferMin: "15" };

  it("coerces form strings into typed values", () => {
    expect(serviceSchema.parse(valid)).toEqual({
      name: "GCSE Maths",
      description: null,
      durationMin: 60,
      price: 4500,
      deposit: 1000,
      bufferMin: 15,
    });
  });

  it("rejects a deposit above the price, reported on the deposit field", () => {
    const result = serviceSchema.safeParse({ ...valid, deposit: "50" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)).toHaveProperty("deposit");
  });

  it("rejects durations outside 5–480 minutes", () => {
    expect(serviceSchema.safeParse({ ...valid, durationMin: "0" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...valid, durationMin: "600" }).success).toBe(false);
  });
});

describe("weeklyAvailabilitySchema", () => {
  it("accepts split days and back-to-back ranges", () => {
    const week = [
      { weekday: 1, ranges: [{ start: "09:00", end: "12:00" }, { start: "12:00", end: "17:00" }] },
      { weekday: 6, ranges: [{ start: "10:00", end: "14:00" }] },
    ];
    expect(weeklyAvailabilitySchema.safeParse(week).success).toBe(true);
  });

  it("accepts a range that runs to midnight", () => {
    expect(weeklyAvailabilitySchema.safeParse([{ weekday: 5, ranges: [{ start: "18:00", end: "24:00" }] }]).success).toBe(true);
  });

  it("rejects overlapping ranges on the same day, whatever their order", () => {
    const week = [{ weekday: 2, ranges: [{ start: "13:00", end: "17:00" }, { start: "09:00", end: "13:30" }] }];
    const result = weeklyAvailabilitySchema.safeParse(week);
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)["0.ranges"]).toBe("Time ranges overlap");
  });

  it("rejects a range that ends before it starts", () => {
    expect(weeklyAvailabilitySchema.safeParse([{ weekday: 3, ranges: [{ start: "17:00", end: "09:00" }] }]).success).toBe(false);
  });

  it("rejects the same weekday twice", () => {
    const week = [
      { weekday: 1, ranges: [] },
      { weekday: 1, ranges: [] },
    ];
    expect(weeklyAvailabilitySchema.safeParse(week).success).toBe(false);
  });
});

describe("dateOverrideSchema", () => {
  it("accepts a closed day and a custom-hours day", () => {
    expect(dateOverrideSchema.safeParse({ date: "2026-12-25", closed: true }).success).toBe(true);
    expect(
      dateOverrideSchema.safeParse({ date: "2026-12-24", closed: false, start: "09:00", end: "12:00" }).success,
    ).toBe(true);
  });

  it("rejects impossible dates", () => {
    expect(dateOverrideSchema.safeParse({ date: "2026-02-30", closed: true }).success).toBe(false);
  });

  it("requires hours when the day is not closed", () => {
    expect(dateOverrideSchema.safeParse({ date: "2026-12-24", closed: false }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("GCSE Maths — 1:1 Session!")).toBe("gcse-maths-1-1-session");
    expect(slugify("Café Français")).toBe("cafe-francais");
    expect(slugify("!!!")).toBe("service");
  });
});

describe("bookingDetailsSchema", () => {
  const valid = { startsAt: "2026-10-19T15:00:00.000Z", name: "Sam", email: " Sam@Example.com ", note: "", timezone: "Asia/Kolkata" };

  it("normalises the email, empty note and start time", () => {
    expect(bookingDetailsSchema.parse(valid)).toEqual({
      startsAt: new Date("2026-10-19T15:00Z"),
      name: "Sam",
      email: "sam@example.com",
      note: null,
      timezone: "Asia/Kolkata",
    });
  });

  it("drops an unknown time zone rather than failing the booking", () => {
    expect(bookingDetailsSchema.parse({ ...valid, timezone: "Nowhere/Land" }).timezone).toBeNull();
  });

  it("rejects a malformed start time or email", () => {
    expect(bookingDetailsSchema.safeParse({ ...valid, startsAt: "next monday" }).success).toBe(false);
    expect(bookingDetailsSchema.safeParse({ ...valid, email: "sam" }).success).toBe(false);
  });
});
