import { describe, expect, it } from "vitest";
import { addDays, buildTimetable, mondayOf, timeKey } from "./timetable";

describe("timetable", () => {
  it("does calendar arithmetic on date strings", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(mondayOf("2026-10-22")).toBe("2026-10-19"); // Thursday
    expect(mondayOf("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // Sunday
  });

  it("groups starts into Monday-first weeks with shared time rows", () => {
    const starts = [
      new Date("2026-10-22T15:15:00Z"), // Thu 16:15 London (BST)
      new Date("2026-10-22T16:30:00Z"), // Thu 17:30
      new Date("2026-10-20T16:30:00Z"), // Tue 17:30
      new Date("2026-10-27T10:00:00Z"), // next Tue 10:00 (GMT after 25 Oct)
    ];
    const weeks = buildTimetable(starts, "Europe/London");
    expect(weeks.map((w) => w.monday)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(weeks[0]!.days).toHaveLength(7);
    expect(weeks[0]!.times).toEqual(["16:15", "17:30"]);
    expect(weeks[0]!.cells.get("2026-10-20")?.has("16:15")).toBe(false);
    expect(weeks[0]!.cells.get("2026-10-22")?.get("17:30")?.toISOString()).toBe("2026-10-22T16:30:00.000Z");
    expect(weeks[1]!.times).toEqual(["10:00"]);
  });

  it("uses the viewer's zone for days and rows", () => {
    // 23:30 UTC Thursday is Friday 05:00 in Kolkata.
    const [week] = buildTimetable([new Date("2026-10-22T23:30:00Z")], "Asia/Kolkata");
    expect(week!.cells.get("2026-10-23")?.has("05:00")).toBe(true);
    expect(timeKey(new Date("2026-10-22T23:30:00Z"), "Asia/Kolkata")).toBe("05:00");
  });
});
