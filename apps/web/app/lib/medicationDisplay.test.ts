import { describe, expect, it } from "vitest";
import {
  asNeededCountText,
  changeText,
  doseWarningText,
  dueSlotLabel,
  missedText,
  slotStateText,
  clockTime,
  doseSlotText,
  doseText,
  formatDate,
  listText,
  medicationSummaryLine,
  medicationTitle,
  scheduleChangeParts,
  scheduleText,
  scheduleZoneNote,
  stoppedText,
  givenAllLabel,
  medicationCountText,
  passLoggedLabel,
  passLoggedText,
  passStateText,
  passTitle,
} from "./medicationDisplay";

const MED = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";
const NOON = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1003";
const GONE = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1004";
// Evening first in sort order, to show passes read in the passes' order, not by time.
const PASSES = [
  { id: EVENING, name: "Evening", time: "20:00", sortOrder: 2 },
  { id: MORNING, name: "Morning", time: "08:00", sortOrder: 0 },
  { id: NOON, name: "Lunch", time: "12:00", sortOrder: 1 },
];

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
    expect(scheduleText({ type: "scheduled", slots: [{ time: "08:00" }] })).toBe("8:00");
    expect(scheduleText({ type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] })).toBe(
      "8:00 and 20:00",
    );
    expect(
      scheduleText({ type: "scheduled", slots: [{ time: "08:00" }, { time: "14:00" }, { time: "21:00" }] }),
    ).toBe("8:00, 14:00 and 21:00");
  });
  it("reads passes by name in the passes' order, then times of their own", () => {
    const schedule = {
      type: "scheduled" as const,
      slots: [{ time: "21:00" }, { passId: EVENING }, { time: "14:00" }, { passId: MORNING }],
    };
    expect(scheduleText(schedule, PASSES)).toBe("Morning, Evening, 14:00 and 21:00");
    expect(
      scheduleText({ type: "scheduled", slots: [{ passId: MORNING }, { passId: EVENING }] }, PASSES),
    ).toBe("Morning and Evening");
  });
  it("shows a slot's amount only when it differs from the usual dose", () => {
    const schedule = {
      type: "scheduled" as const,
      slots: [
        { passId: MORNING, amount: "1000 mg" },
        { passId: EVENING, amount: "500 mg" },
        { time: "14:00", amount: "2 tablets" },
      ],
    };
    expect(scheduleText(schedule, PASSES, "500 mg")).toBe("Morning (1000 mg), Evening and 14:00 (2 tablets)");
    expect(scheduleText(schedule, PASSES)).toBe("Morning (1000 mg), Evening (500 mg) and 14:00 (2 tablets)");
  });
  it("leaves out a pass this device doesn't know", () => {
    expect(scheduleText({ type: "scheduled", slots: [{ passId: GONE }, { time: "14:00" }] }, PASSES)).toBe(
      "14:00",
    );
    expect(scheduleText({ type: "scheduled", slots: [{ passId: GONE }] }, PASSES)).toBe("Every day");
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
        schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
      }),
    ).toBe("Tablet · 1 tablet · 8:00 and 20:00");
    expect(
      medicationSummaryLine(
        {
          form: "tablet",
          dose: "1 tablet",
          schedule: {
            type: "scheduled",
            slots: [{ passId: MORNING, amount: "2 tablets" }, { passId: EVENING }],
          },
        },
        PASSES,
      ),
    ).toBe("Tablet · 1 tablet · Morning (2 tablets) and Evening");
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
          schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
          form: "tablet",
          directions: null,
        },
        after: {
          dose: "2 tablets",
          schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
          form: "capsule",
          directions: "With food",
        },
      }),
    ).toBe(
      "Changed dose 1 tablet → 2 tablets, form tablet → capsule, directions none → With food; added 20:00",
    );
  });
  it("names the passes a schedule edit added and removed, and amounts that changed", () => {
    const at = (...slots: ({ passId: string; amount?: string } | { time: string; amount?: string })[]) => ({
      type: "scheduled" as const,
      slots,
    });
    const scheduleChange = (before: ReturnType<typeof at>, after: ReturnType<typeof at>) =>
      changeText(
        {
          medicationId: MED,
          change: "changed",
          fields: ["schedule"],
          before: { schedule: before },
          after: { schedule: after },
        },
        PASSES,
      );
    expect(scheduleChange(at({ passId: MORNING }), at({ passId: MORNING }, { passId: EVENING }))).toBe(
      "Added to Evening",
    );
    expect(
      scheduleChange(
        at({ passId: MORNING, amount: "500 mg" }, { time: "21:00" }),
        at({ passId: MORNING, amount: "1000 mg" }, { passId: EVENING, amount: "500 mg" }, { passId: NOON }),
      ),
    ).toBe("Added to Lunch and Evening (500 mg); removed 21:00; Morning amount 500 mg → 1000 mg");
    expect(scheduleChange(at({ passId: MORNING }, { passId: EVENING }), at({ time: "08:00" }))).toBe(
      "Added 8:00; removed from Morning and Evening",
    );
    expect(scheduleChange(at({ time: "14:00", amount: "2 tablets" }), at({ time: "14:00" }))).toBe(
      "14:00 amount 2 tablets → usual dose",
    );
    expect(scheduleChange(at({ passId: GONE }), at({ passId: MORNING }))).toBe(
      "Added to Morning; removed from a pass",
    );
    // A switch to as needed reads as the whole schedule, before and after.
    expect(
      changeText(
        {
          medicationId: MED,
          change: "changed",
          fields: ["schedule"],
          before: { schedule: at({ passId: MORNING }, { passId: EVENING }) },
          after: { schedule: { type: "asNeeded", maxPerDay: 2 } },
        },
        PASSES,
      ),
    ).toBe("Changed schedule Morning and Evening → As needed, up to 2 a day");
    expect(scheduleChangeParts({ type: "asNeeded" }, at({ passId: MORNING }))).toBeNull();
  });
  it("adds a schedule edit to a restart", () => {
    expect(
      changeText(
        {
          medicationId: MED,
          change: "resumed",
          fields: ["schedule"],
          before: { schedule: { type: "scheduled", slots: [{ passId: MORNING }] } },
          after: { schedule: { type: "scheduled", slots: [{ passId: EVENING }] } },
        },
        PASSES,
      ),
    ).toBe("Resumed; added to Evening; removed from Morning");
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

describe("Today wording", () => {
  const medication = { name: "Metformin", strength: "500 mg" };
  const LA = "America/Los_Angeles";

  it("says a slot's state, with the time a dose was given in the recipient's zone", () => {
    expect(slotStateText({ state: "due", dose: null }, LA)).toBe("Due");
    expect(slotStateText({ state: "overdue", dose: null }, LA)).toBe("Overdue");
    expect(slotStateText({ state: "upcoming", dose: null }, LA)).toBe("Later");
    expect(slotStateText({ state: "missed", dose: null }, LA)).toBe("Missed");
    const dose = {
      id: "d",
      occurredAt: "2026-11-19T16:05:00Z",
      details: { medicationId: "m", status: "given" as const },
    };
    expect(slotStateText({ state: "given", dose }, LA)).toBe("Given 8:05");
    expect(slotStateText({ state: "given", dose }, "America/New_York")).toBe("Given 11:05");
    expect(slotStateText({ state: "refused", dose }, LA)).toBe("Refused");
  });

  it("counts as-needed doses", () => {
    expect(asNeededCountText({ count: 2, max: 4 })).toBe("2 of 4 today");
    expect(asNeededCountText({ count: 1, max: null })).toBe("1 today");
    expect(asNeededCountText({ count: 0, max: null })).toBe("None today");
  });

  it("puts yesterday's missed doses on one line", () => {
    expect(missedText([])).toBeNull();
    expect(
      missedText([
        { medication, time: "08:00" },
        { medication: { name: "Lisinopril", strength: "10 mg" }, time: "20:00" },
      ]),
    ).toBe("Missed yesterday: Metformin 500 mg at 8:00 and Lisinopril 10 mg at 20:00");
  });

  it("words the warnings and due slots", () => {
    expect(
      doseWarningText({ type: "alreadyGiven", time: "08:00", givenAt: "2026-11-19T16:05:00Z" }, LA),
    ).toBe("The 8:00 dose was already given at 8:05.");
    expect(doseWarningText({ type: "overMax", count: 4, max: 4 }, LA)).toBe(
      "4 of 4 already given today, the most a day.",
    );
    expect(dueSlotLabel({ medication, time: "20:00", state: "due" })).toBe("Metformin 500 mg · 20:00 dose");
    expect(dueSlotLabel({ medication, time: "08:00", state: "overdue" })).toBe(
      "Metformin 500 mg · 8:00 dose, overdue",
    );
  });
});

describe("pass wording", () => {
  const slots = [
    { medication: { name: "Metformin", strength: "500 mg" } },
    { medication: { name: "Lisinopril" } },
  ];
  const pass = {
    name: "Morning",
    time: "08:00",
    slots,
    open: [slots[1]],
    state: "due" as const,
    partly: true,
  };

  it("names a pass, or a time of its own by its medication", () => {
    expect(passTitle(pass)).toBe("Morning");
    expect(passTitle({ name: null, slots: slots.slice(0, 1) })).toBe("Metformin 500 mg");
    expect(passLoggedLabel(pass)).toBe("Morning logged");
    expect(givenAllLabel(pass)).toBe("Given all: Morning, 8:00");
  });

  it("says a pass's state, and what's left while it's partly done", () => {
    expect(passStateText(pass)).toBe("Due · 1 left");
    expect(passStateText({ ...pass, partly: false, state: "overdue" })).toBe("Overdue");
    expect(passStateText({ ...pass, partly: false, state: "upcoming" })).toBe("Later");
    expect(passStateText({ ...pass, partly: false, state: "done", open: [] })).toBe("Done");
  });

  it("says who logged it", () => {
    const names: Record<string, string> = { ann: "Ann", me: "you" };
    const nameOf = (id: string) => names[id] ?? "Former member";
    expect(passLoggedText({ ...pass, loggedBy: [] }, nameOf)).toBeNull();
    expect(passLoggedText({ ...pass, loggedBy: [{ userId: "ann" }] }, nameOf)).toBe("Ann logged 1 of 2");
    expect(
      passLoggedText({ ...pass, open: [], loggedBy: [{ userId: "ann" }, { userId: "me" }] }, nameOf),
    ).toBe("Ann and you logged 2 of 2");
    expect(medicationCountText(1)).toBe("1 medication");
    expect(medicationCountText(3)).toBe("3 medications");
  });
});
