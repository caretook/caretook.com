import { describe, expect, it } from "vitest";
import {
  changeText,
  clockTime,
  doseSlotText,
  doseText,
  formatDate,
  listText,
  medicationSummaryLine,
  medicationTitle,
  scheduleText,
  scheduleZoneNote,
  stoppedText,
} from "./medicationDisplay";

const MED = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("schedule wording", () => {
  it("reads times without a leading zero, 24-hour", () => {
    expect(clockTime("08:00")).toBe("8:00");
    expect(clockTime("20:30")).toBe("20:30");
    expect(clockTime("00:15")).toBe("0:15");
  });
  it("joins times with commas and a last 'and'", () => {
    expect(listText([])).toBe("");
    expect(listText(["a"])).toBe("a");
    expect(listText(["a", "b", "c"])).toBe("a, b and c");
    expect(scheduleText({ type: "scheduled", times: ["08:00"] })).toBe("8:00");
    expect(scheduleText({ type: "scheduled", times: ["08:00", "20:00"] })).toBe("8:00 and 20:00");
    expect(scheduleText({ type: "scheduled", times: ["08:00", "14:00", "21:00"] })).toBe(
      "8:00, 14:00 and 21:00",
    );
  });
  it("says as needed, with the maximum when there is one", () => {
    expect(scheduleText({ type: "asNeeded", maxPerDay: 4 })).toBe("As needed, up to 4 a day");
    expect(scheduleText({ type: "asNeeded" })).toBe("As needed");
  });
  it("notes the recipient's zone only when the device is elsewhere", () => {
    expect(scheduleZoneNote("America/Los_Angeles", "America/Los_Angeles")).toBeNull();
    expect(scheduleZoneNote(null, "America/Los_Angeles")).toBeNull();
    expect(scheduleZoneNote("America/New_York", "America/Los_Angeles")).toBe("Times are New York time");
  });
});

describe("medication wording", () => {
  it("puts the strength after the name", () => {
    expect(medicationTitle({ name: "Lisinopril", strength: "10 mg" })).toBe("Lisinopril 10 mg");
    expect(medicationTitle({ name: "Lisinopril", strength: " " })).toBe("Lisinopril");
    expect(medicationTitle({ name: "Lisinopril", strength: null })).toBe("Lisinopril");
  });
  it("summarises form, dose and schedule, leaving out what's missing", () => {
    expect(
      medicationSummaryLine({
        form: "tablet",
        dose: "1 tablet",
        schedule: { type: "scheduled", times: ["08:00", "20:00"] },
      }),
    ).toBe("Tablet · 1 tablet · 8:00 and 20:00");
    expect(
      medicationSummaryLine({ form: null, dose: "", schedule: { type: "asNeeded", maxPerDay: 4 } }),
    ).toBe("As needed, up to 4 a day");
  });
  it("formats a calendar day without shifting it", () => {
    expect(formatDate("2026-11-10", "en-US")).toBe("Nov 10, 2026");
    expect(formatDate("2026-01-01", "en-US")).toBe("Jan 1, 2026");
    expect(formatDate("not a day", "en-US")).toBe("not a day");
  });
  it("says when and why a medication stopped", () => {
    expect(stoppedText({ status: "current", stoppedOn: null, stopReason: null })).toBeNull();
    expect(stoppedText({ status: "completed", stoppedOn: "2026-11-10", stopReason: null }, "en-US")).toBe(
      "Completed Nov 10, 2026",
    );
    expect(
      stoppedText({ status: "discontinued", stoppedOn: "2026-11-02", stopReason: "sideEffects" }, "en-US"),
    ).toBe("Discontinued Nov 2, 2026 · Side effects");
    expect(stoppedText({ status: "discontinued", stoppedOn: null, stopReason: null })).toBe("Discontinued");
  });
});

describe("dose wording", () => {
  it("says what happened, with the amount given", () => {
    expect(doseText({ status: "given", amount: "1 tablet" })).toBe("Given 1 tablet");
    expect(doseText({ status: "given", amount: null })).toBe("Given");
    expect(doseText({ status: "skipped", amount: "1 tablet" })).toBe("Skipped");
    expect(doseText({ status: "refused" })).toBe("Refused");
  });
  it("names the slot a dose answers", () => {
    expect(doseSlotText({ scheduledFor: "08:00" })).toBe("8:00 dose");
    expect(doseSlotText({ scheduledFor: null })).toBeNull();
  });
});

describe("change wording", () => {
  it("says started and resumed", () => {
    expect(changeText({ medicationId: MED, change: "started", after: { name: "Lisinopril" } })).toBe(
      "Started",
    );
    expect(changeText({ medicationId: MED, change: "resumed" })).toBe("Resumed");
  });
  it("says what changed, before and after", () => {
    expect(
      changeText({
        medicationId: MED,
        change: "changed",
        fields: ["strength"],
        before: { strength: "5 mg" },
        after: { strength: "10 mg" },
      }),
    ).toBe("Changed strength 5 mg → 10 mg");
    expect(
      changeText({
        medicationId: MED,
        change: "changed",
        fields: ["dose", "schedule", "form", "directions"],
        before: {
          dose: "1 tablet",
          schedule: { type: "scheduled", times: ["08:00"] },
          form: "tablet",
          directions: null,
        },
        after: {
          dose: "2 tablets",
          schedule: { type: "scheduled", times: ["08:00", "20:00"] },
          form: "capsule",
          directions: "With food",
        },
      }),
    ).toBe(
      "Changed dose 1 tablet → 2 tablets, schedule 8:00 → 8:00 and 20:00, form tablet → capsule, directions none → With food",
    );
  });
  it("says how it stopped, with the reason for a discontinue", () => {
    expect(
      changeText({
        medicationId: MED,
        change: "stopped",
        stopStatus: "discontinued",
        stopReason: "sideEffects",
      }),
    ).toBe("Discontinued: side effects");
    expect(changeText({ medicationId: MED, change: "stopped", stopStatus: "completed" })).toBe("Completed");
    expect(
      changeText({
        medicationId: MED,
        change: "stopped",
        stopStatus: "discontinued",
        stopReason: "ineffective",
        fields: ["dose"],
        before: { dose: "1 tablet" },
        after: { dose: "2 tablets" },
      }),
    ).toBe("Discontinued: not working; changed dose 1 tablet → 2 tablets");
  });
});
