import { describe, expect, it } from "vitest";
import {
  CARE_PERIOD_TYPES,
  carePeriodContentOf,
  carePeriodContentZSchema,
  carePeriodStartIssue,
  carePeriodUpdateZSchema,
  DATE_ONLY_ISSUE,
  FUTURE_START_ISSUE,
  isCarePeriodType,
} from "./carePeriod";
import { DEVICE_FUTURE_SKEW_MS, SERVER_FUTURE_SKEW_MS } from "../../../domain/core/entryTiming";

const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-17T20:00:00.000Z");

const issues = (input: unknown) => {
  const parsed = carePeriodContentZSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((i) => [i.path.join("."), i.message]);
};

describe("care period content", () => {
  const base = { type: "hospital", startedAt: "2026-11-15T09:00:00.000Z" };

  it("takes the fixed types, in order, and refuses others", () => {
    expect(CARE_PERIOD_TYPES[0]).toBe("home");
    expect(CARE_PERIOD_TYPES.at(-1)).toBe("other");
    expect(isCarePeriodType("rehab")).toBe(true);
    expect(isCarePeriodType("spa")).toBe(false);
    expect(issues({ ...base, type: "spa" })).toEqual([["type", "Choose where care is"]]);
  });

  it("trims optional text and stores empty as none, with dateOnly false by default", () => {
    expect(carePeriodContentZSchema.parse({ ...base, label: "  ", placeDetail: " Room 4 " })).toEqual({
      type: "hospital",
      label: null,
      placeProviderId: null,
      placeDetail: "Room 4",
      startedAt: base.startedAt,
      dateOnly: false,
    });
  });

  it("needs a label for Other", () => {
    expect(issues({ ...base, type: "other" })).toEqual([["label", "Say what this is"]]);
    expect(issues({ ...base, type: "other", label: "  " })).toEqual([["label", "Say what this is"]]);
    expect(issues({ ...base, type: "other", label: "Daughter's house" })).toEqual([]);
  });

  it("needs a valid start, and caps the text", () => {
    expect(issues({ type: "home" })).toEqual([["startedAt", "Enter when it started"]]);
    expect(issues({ ...base, startedAt: "yesterday" })).toEqual([["startedAt", "Enter when it started"]]);
    expect(issues({ ...base, label: "x".repeat(121) })).toEqual([["label", "At most 120 characters"]]);
    expect(issues({ ...base, placeProviderId: "not-an-id" }).map(([p]) => p)).toEqual(["placeProviderId"]);
  });

  it("refuses a group or recipient in an update", () => {
    expect(carePeriodUpdateZSchema.safeParse({ groupId: "x" }).success).toBe(false);
    expect(carePeriodUpdateZSchema.safeParse({ label: "Ward 3" }).success).toBe(true);
  });

  it("reads a stored row's start back as ISO", () => {
    expect(
      carePeriodContentOf({
        type: "home",
        label: null,
        placeProviderId: null,
        placeDetail: null,
        startedAt: "2026-11-15 09:00:00.000+00",
        dateOnly: false,
      }).startedAt,
    ).toBe("2026-11-15T09:00:00.000Z");
  });
});

describe("carePeriodStartIssue", () => {
  const device = { now: NOW, skewMs: DEVICE_FUTURE_SKEW_MS, timeZone: LA };

  it("refuses a start past now plus the skew, and allows exactly that", () => {
    const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
    expect(
      carePeriodStartIssue({ startedAt: at(DEVICE_FUTURE_SKEW_MS), dateOnly: false }, device),
    ).toBeNull();
    expect(carePeriodStartIssue({ startedAt: at(DEVICE_FUTURE_SKEW_MS + 1), dateOnly: false }, device)).toBe(
      FUTURE_START_ISSUE,
    );
    // The server allows an hour, for a device whose clock runs fast.
    expect(
      carePeriodStartIssue(
        { startedAt: at(30 * 60_000), dateOnly: false },
        { ...device, skewMs: SERVER_FUTURE_SKEW_MS },
      ),
    ).toBeNull();
    expect(
      carePeriodStartIssue({ startedAt: "2020-01-01T00:00:00.000Z", dateOnly: false }, device),
    ).toBeNull();
  });

  it("wants a date-only start at the start of its day in the recipient's zone", () => {
    // Midnight Nov 15 in Los Angeles.
    expect(
      carePeriodStartIssue({ startedAt: "2026-11-15T08:00:00.000Z", dateOnly: true }, device),
    ).toBeNull();
    expect(carePeriodStartIssue({ startedAt: "2026-11-15T00:00:00.000Z", dateOnly: true }, device)).toBe(
      DATE_ONLY_ISSUE,
    );
    expect(
      carePeriodStartIssue(
        { startedAt: "2026-11-15T00:00:00.000Z", dateOnly: true },
        { ...device, timeZone: "UTC" },
      ),
    ).toBeNull();
  });

  it("refuses a date-only start for a day ahead of today", () => {
    expect(carePeriodStartIssue({ startedAt: "2026-11-19T08:00:00.000Z", dateOnly: true }, device)).toBe(
      FUTURE_START_ISSUE,
    );
  });
});
