import { describe, expect, it } from "vitest";
import { canClientReschedule, clientCancelTerms } from "./policy";

const start = new Date("2026-10-20T15:00Z");
const hoursBefore = (h: number) => new Date(start.getTime() - h * 3_600_000);
const confirmed = { status: "confirmed", startsAt: start };

describe("client change policy", () => {
  it("refunds the deposit when cancelling 24h or more before", () => {
    expect(clientCancelTerms(confirmed, hoursBefore(24))).toEqual({ allowed: true, refundDeposit: true });
    expect(clientCancelTerms(confirmed, hoursBefore(48))).toEqual({ allowed: true, refundDeposit: true });
  });

  it("keeps the deposit when cancelling inside 24h", () => {
    expect(clientCancelTerms(confirmed, hoursBefore(23.9))).toEqual({ allowed: true, refundDeposit: false });
  });

  it("does not allow cancelling after the start or a booking that isn't confirmed", () => {
    expect(clientCancelTerms(confirmed, hoursBefore(0))).toEqual({ allowed: false });
    expect(clientCancelTerms({ ...confirmed, status: "held" }, hoursBefore(48))).toEqual({ allowed: false });
    expect(clientCancelTerms({ ...confirmed, status: "cancelled" }, hoursBefore(48))).toEqual({ allowed: false });
  });

  it("allows rescheduling only before the cut-off", () => {
    expect(canClientReschedule(confirmed, hoursBefore(24))).toBe(true);
    expect(canClientReschedule(confirmed, hoursBefore(23))).toBe(false);
    expect(canClientReschedule({ ...confirmed, status: "held" }, hoursBefore(48))).toBe(false);
  });
});
