import { describe, expect, it } from "vitest";
import {
  ageOn,
  ageText,
  basicLines,
  birthdayText,
  bloodTypeLabel,
  bloodTypeSpoken,
  codeStatusLabel,
} from "./recipientDisplay";

describe("ageOn", () => {
  it("counts whole years, turning over on the birthday", () => {
    expect(ageOn("1941-03-14", "2026-03-13")).toBe(84);
    expect(ageOn("1941-03-14", "2026-03-14")).toBe(85);
    expect(ageOn("1941-03-14", "2026-12-31")).toBe(85);
  });
  it("turns a Feb 29 birthday over on Mar 1 in other years, and on Feb 29 in leap years", () => {
    expect(ageOn("2000-02-29", "2027-02-28")).toBe(26);
    expect(ageOn("2000-02-29", "2027-03-01")).toBe(27);
    expect(ageOn("2000-02-29", "2028-02-29")).toBe(28);
  });
  it("is null for a birthday after the day, or one that isn't a date", () => {
    expect(ageOn("2030-01-01", "2026-11-19")).toBeNull();
    expect(ageOn("1941-02-30", "2026-11-19")).toBeNull();
    expect(ageOn("03/14/1941", "2026-11-19")).toBeNull();
  });
  it("is 0 on the day of birth", () => {
    expect(ageOn("2026-11-19", "2026-11-19")).toBe(0);
  });
});

describe("ageText", () => {
  // 2026-03-14 06:30 UTC: still Mar 13 in Los Angeles, already Mar 14 in Tokyo and London.
  const now = new Date("2026-03-14T06:30:00Z");
  it("counts on the recipient's day in their zone", () => {
    expect(ageText("1941-03-14", "America/Los_Angeles", now)).toBe("Age 84");
    expect(ageText("1941-03-14", "Asia/Tokyo", now)).toBe("Age 85");
    expect(ageText("1941-03-14", "Europe/London", now)).toBe("Age 85");
  });
  it("is null without a birthday, or with one in the future", () => {
    expect(ageText(null, "UTC", now)).toBeNull();
    expect(ageText("", "UTC", now)).toBeNull();
    expect(ageText("2027-01-01", "UTC", now)).toBeNull();
  });
  it("falls back to UTC for a missing or unknown zone", () => {
    expect(ageText("1941-03-14", null, now)).toBe("Age 85");
    expect(ageText("1941-03-14", "Not/AZone", now)).toBe("Age 85");
  });
});

describe("birthdayText", () => {
  it("shows the stored day whatever the device's zone", () => {
    expect(birthdayText("1941-03-09", "en-US")).toBe("March 9, 1941");
  });
  it("falls back to the stored text", () => {
    expect(birthdayText("unknown")).toBe("unknown");
  });
});

describe("labels", () => {
  it("names each code status", () => {
    expect(codeStatusLabel("fullCode")).toBe("Full code");
    expect(codeStatusLabel("dnr")).toBe("DNR");
    expect(codeStatusLabel("dnrPolst")).toBe("DNR/POLST");
    expect(codeStatusLabel(null)).toBeNull();
    expect(codeStatusLabel("later")).toBe("later");
  });
  it("writes blood types with a real minus, and says them in words", () => {
    expect(bloodTypeLabel("AB+")).toBe("AB+");
    expect(bloodTypeLabel("O-")).toBe("O−");
    expect(bloodTypeLabel(null)).toBeNull();
    expect(bloodTypeSpoken("A+")).toBe("A positive");
    expect(bloodTypeSpoken("O-")).toBe("O negative");
  });
});

describe("basicLines", () => {
  const none = { codeStatus: null, bloodType: null, primaryLanguage: null, pronouns: null };
  it("lists only what's set, in order", () => {
    expect(basicLines(none)).toEqual([]);
    expect(basicLines({ ...none, pronouns: "she/her", codeStatus: "dnr" })).toEqual([
      { id: "codeStatus", label: "Code status", value: "DNR" },
      { id: "pronouns", label: "Pronouns", value: "she/her" },
    ]);
    expect(
      basicLines({ codeStatus: "fullCode", bloodType: "B-", primaryLanguage: " Spanish ", pronouns: "  " }),
    ).toEqual([
      { id: "codeStatus", label: "Code status", value: "Full code" },
      { id: "bloodType", label: "Blood type", value: "B−", spoken: "B negative" },
      { id: "primaryLanguage", label: "Primary language", value: "Spanish" },
    ]);
  });
});
