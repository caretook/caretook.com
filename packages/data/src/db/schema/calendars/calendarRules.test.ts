import { describe, expect, it } from "vitest";
import {
  calendarSettingsChangeZSchema,
  DEFAULT_REMINDER_LEADS,
  reminderLeadsZSchema,
  shareLevel,
} from "./calendarRules";

// The calendars area's shared rules (appointments-2).

describe("shareLevel", () => {
  it("is details only with the member's consent and the owners' allowance", () => {
    expect(shareLevel({ memberConsent: true, groupAllowsDetails: true })).toBe("details");
    expect(shareLevel({ memberConsent: true, groupAllowsDetails: false })).toBe("generic");
    expect(shareLevel({ memberConsent: false, groupAllowsDetails: true })).toBe("generic");
    expect(shareLevel({ memberConsent: false, groupAllowsDetails: false })).toBe("generic");
  });
});

describe("reminder leads", () => {
  it("preset the evening before and 1 h before", () => {
    expect(DEFAULT_REMINDER_LEADS).toEqual(["eveningBefore", 60]);
  });

  it("take up to three different leads, in a fixed order", () => {
    expect(reminderLeadsZSchema.parse([30, "morningOf"])).toEqual(["morningOf", 30]);
    expect(reminderLeadsZSchema.parse([])).toEqual([]);
    expect(reminderLeadsZSchema.safeParse(["eveningBefore", "morningOf", 120, 60]).success).toBe(false);
    expect(reminderLeadsZSchema.safeParse([60, 60]).success).toBe(false);
    expect(reminderLeadsZSchema.safeParse([45]).success).toBe(false);
    expect(reminderLeadsZSchema.safeParse(["120"]).success).toBe(false);
  });
});

describe("calendarSettingsChangeZSchema", () => {
  it("takes only the member's own fields", () => {
    expect(calendarSettingsChangeZSchema.parse({ detailsConsent: true })).toEqual({ detailsConsent: true });
    expect(calendarSettingsChangeZSchema.safeParse({ feedTokenHash: "x" }).success).toBe(false);
    expect(calendarSettingsChangeZSchema.safeParse({ detailsConsentAt: "2026-11-18" }).success).toBe(false);
  });
});
