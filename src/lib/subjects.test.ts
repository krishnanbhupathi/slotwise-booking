import { describe, expect, it } from "vitest";
import { SUBJECT_COUNT, subjectClass, subjectIndex } from "./subjects";

describe("subject colours", () => {
  it("assigns colours in creation order and wraps around", () => {
    const ids = Array.from({ length: SUBJECT_COUNT + 1 }, (_, i) => `s${i}`);
    const map = subjectIndex(ids);
    expect(map.get("s0")).toBe(0);
    expect(map.get("s2")).toBe(2);
    expect(map.get(`s${SUBJECT_COUNT}`)).toBe(0);
  });

  it("builds a valid class for any index", () => {
    expect(subjectClass(1)).toBe("subject-1");
    expect(subjectClass(SUBJECT_COUNT + 2)).toBe("subject-2");
    expect(subjectClass(-1)).toBe(`subject-${SUBJECT_COUNT - 1}`);
  });
});
