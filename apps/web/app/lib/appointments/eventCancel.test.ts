import { describe, expect, it } from "vitest";
import { cancelledByLine, cancelPatch, cancelReasonOf, UNCANCEL_PATCH } from "./eventCancel";

const where = { locale: "en-US", timeZone: "America/Los_Angeles" };
const now = new Date("2026-11-19T20:00:00Z"); // 12:00 PM in Los Angeles

describe("cancelPatch", () => {
  it("cancels now, with the reason trimmed", () => {
    expect(cancelPatch("  Office called, doctor out sick ", now)).toEqual({
      cancelledAt: "2026-11-19T20:00:00.000Z",
      cancelReason: "Office called, doctor out sick",
    });
  });

  it("records no reason for an empty or missing one", () => {
    expect(cancelPatch("   ", now).cancelReason).toBeNull();
    expect(cancelPatch(undefined, now).cancelReason).toBeNull();
  });

  it("caps a long reason at the column's limit", () => {
    expect(cancelReasonOf("x".repeat(600))).toHaveLength(500);
  });
});

describe("UNCANCEL_PATCH", () => {
  it("clears the cancel, its reason and any replacement", () => {
    expect(UNCANCEL_PATCH).toEqual({ cancelledAt: null, cancelReason: null, rescheduledTo: null });
  });
});

describe("cancelledByLine", () => {
  it("names who and when", () => {
    expect(cancelledByLine({ cancelledAt: "2026-11-19T18:15:00Z", byName: "Maria Lopez" }, now, where)).toBe(
      "Cancelled by Maria Lopez · Today, 10:15 AM",
    );
    expect(cancelledByLine({ cancelledAt: "2026-11-18T18:15:00Z", byName: "Maria Lopez" }, now, where)).toBe(
      "Cancelled by Maria Lopez · Yesterday, 10:15 AM",
    );
  });

  it("leaves out what isn't known", () => {
    expect(cancelledByLine({ cancelledAt: null, byName: null }, now, where)).toBe("Cancelled");
    expect(cancelledByLine({ cancelledAt: "2026-11-19T18:15:00Z", byName: null }, now, where)).toBe(
      "Cancelled · Today, 10:15 AM",
    );
  });
});
