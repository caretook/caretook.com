import { describe, expect, it } from "vitest";
import {
  changeText,
  doseText,
  entryMedication,
  medicationEntryText,
  medicationIdOf,
  medicationLabel,
  scheduleText,
  withMedication,
} from "./medicationEntries";

const M = "11111111-2222-4333-8444-555555555555";
const LISINOPRIL = { id: M, name: "Lisinopril", strength: "10 mg", deletedAt: null };

describe("medicationLabel", () => {
  it("names the medication with its strength", () => {
    expect(medicationLabel(LISINOPRIL)).toBe("Lisinopril 10 mg");
    expect(medicationLabel({ name: "Acetaminophen", strength: null })).toBe("Acetaminophen");
    expect(medicationLabel({ name: "Acetaminophen", strength: "  " })).toBe("Acetaminophen");
  });

  it("says Medication when it isn't on the device", () => {
    expect(medicationLabel(null)).toBe("Medication");
    expect(medicationLabel(undefined)).toBe("Medication");
  });
});

describe("doseText", () => {
  it("says the amount of a dose that was given", () => {
    expect(doseText({ status: "given", amount: "1 tablet" })).toBe("Given 1 tablet");
    expect(doseText({ status: "given", amount: null })).toBe("Given");
  });

  it("says skipped or refused, without the amount", () => {
    expect(doseText({ status: "skipped", amount: "1 tablet" })).toBe("Skipped");
    expect(doseText({ status: "refused" })).toBe("Refused");
  });
});

describe("scheduleText", () => {
  it("lists times without leading zeros", () => {
    expect(scheduleText({ type: "scheduled", slots: [{ time: "08:00" }] })).toBe("8:00");
    expect(scheduleText({ type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] })).toBe(
      "8:00 and 20:00",
    );
    expect(
      scheduleText({ type: "scheduled", slots: [{ time: "08:00" }, { time: "14:00" }, { time: "20:00" }] }),
    ).toBe("8:00, 14:00 and 20:00");
  });

  it("says as needed, with the maximum", () => {
    expect(scheduleText({ type: "asNeeded" })).toBe("As needed");
    expect(scheduleText({ type: "asNeeded", maxPerDay: 4 })).toBe("As needed, up to 4 a day");
  });
});

describe("changeText", () => {
  const base = { medicationId: M };
  it("says started and resumed", () => {
    expect(changeText({ ...base, change: "started", after: { name: "Lisinopril" } })).toBe("Started");
    expect(changeText({ ...base, change: "resumed" })).toBe("Resumed");
  });

  it("says what changed, before and after", () => {
    expect(
      changeText({
        ...base,
        change: "changed",
        fields: ["dose"],
        before: { dose: "1 tablet" },
        after: { dose: "2 tablets" },
      }),
    ).toBe("Changed dose 1 tablet → 2 tablets");
    expect(
      changeText({
        ...base,
        change: "changed",
        fields: ["strength", "schedule"],
        before: { strength: "5 mg", schedule: { type: "scheduled", slots: [{ time: "08:00" }] } },
        after: { strength: null, schedule: { type: "asNeeded", maxPerDay: 2 } },
      }),
    ).toBe("Changed strength 5 mg → none, schedule 8:00 → As needed, up to 2 a day");
  });

  it("says why it was stopped", () => {
    expect(
      changeText({ ...base, change: "stopped", stopStatus: "discontinued", stopReason: "sideEffects" }),
    ).toBe("Discontinued: side effects");
    expect(changeText({ ...base, change: "stopped", stopStatus: "discontinued" })).toBe("Discontinued");
    expect(changeText({ ...base, change: "stopped", stopStatus: "completed", stopReason: null })).toBe(
      "Completed",
    );
  });

  it("says the edits saved with a stop or a restart", () => {
    expect(
      changeText({
        ...base,
        change: "resumed",
        fields: ["dose"],
        before: { dose: "1 tablet" },
        after: { dose: "2 tablets" },
      }),
    ).toBe("Resumed; changed dose 1 tablet → 2 tablets");
  });
});

describe("medicationEntryText", () => {
  it("gives a dose's words and its note", () => {
    expect(
      medicationEntryText({
        kind: "dose",
        details: { medicationId: M, status: "skipped", note: " Asleep " },
      }),
    ).toEqual({ what: "Skipped", note: "Asleep" });
  });

  it("gives a stop's note", () => {
    expect(
      medicationEntryText({
        kind: "medicationChange",
        details: {
          medicationId: M,
          change: "stopped",
          stopStatus: "discontinued",
          stopReason: "other",
          stopNote: "Too drowsy",
        },
      }),
    ).toEqual({ what: "Discontinued: other reason", note: "Too drowsy" });
  });

  it("gives a pass's move as a whole line, with no medication", () => {
    const details = {
      change: "passMoved" as const,
      passId: M,
      passName: "Morning",
      beforeTime: "08:00",
      afterTime: "08:30",
      medicationIds: [M],
    };
    expect(medicationEntryText({ kind: "medicationChange", details })).toEqual({
      what: "Morning moved 8:00 → 8:30",
      note: null,
      standalone: true,
    });
    expect(medicationIdOf({ kind: "medicationChange", details })).toBeNull();
  });

  it("is null for other kinds", () => {
    expect(medicationEntryText({ kind: "symptom", details: { name: "Pain", severity: 3 } })).toBeNull();
  });
});

describe("withMedication", () => {
  const dose = { kind: "dose" as const, details: { medicationId: M, status: "given" as const } };
  it("attaches a dose's or change's medication", () => {
    const found = withMedication(dose, (id) => (id === M ? LISINOPRIL : undefined));
    expect(entryMedication(found)).toEqual(LISINOPRIL);
    expect(medicationIdOf(dose)).toBe(M);
  });

  it("attaches null when the medication isn't on the device", () => {
    expect(entryMedication(withMedication(dose, () => undefined))).toBeNull();
  });

  it("leaves other entries as they are", () => {
    const note = { kind: "note" as const, details: null };
    expect(withMedication(note, () => LISINOPRIL)).toBe(note);
    expect(entryMedication(note)).toBeUndefined();
    expect(medicationIdOf(note)).toBeNull();
  });
});
