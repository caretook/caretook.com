import { medicationContentZSchema } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { isFieldIssue, issuesForSlotRows, medicationFromForm, passAmountField } from "./medicationFormData";

const form = (fields: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of fields) data.append(key, value);
  return data;
};

const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";

/** The schema's issues as the form shows them (`issuesForSlotRows`, as the routes do). */
const issuesOf = (input: unknown) => {
  const parsed = medicationContentZSchema.safeParse(input);
  return parsed.success
    ? []
    : issuesForSlotRows(
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        [],
      );
};

describe("medicationFromForm", () => {
  it("reads a scheduled medication, dropping blank time rows", () => {
    const { input, slotRows, newProviders } = medicationFromForm(
      form([
        ["name", "Sertraline"],
        ["strength", "50 mg"],
        ["form", "tablet"],
        ["dose", "1 tablet"],
        ["scheduleType", "scheduled"],
        ["time", "20:00"],
        ["time", ""],
        ["time", "08:00"],
        ["maxPerDay", "4"],
        ["startedOn", "2026-11-01"],
        ["prescriberId", "p1"],
        ["pharmacyId", ""],
        ["refillsLeft", "2"],
      ]),
    );
    expect(input).toMatchObject({
      name: "Sertraline",
      strength: "50 mg",
      form: "tablet",
      dose: "1 tablet",
      schedule: { type: "scheduled", slots: [{ time: "20:00" }, { time: "08:00" }] },
      startedOn: "2026-11-01",
      prescriberId: "p1",
      pharmacyId: null,
      lastFilledOn: null,
      refillsLeft: 2,
    });
    expect(slotRows).toEqual([{ time: 0 }, { time: 2 }]);
    expect(newProviders).toEqual({});
  });

  it("reads ticked passes with their amounts, then times with theirs", () => {
    const { input, slotRows } = medicationFromForm(
      form([
        ["scheduleType", "scheduled"],
        ["passId", EVENING],
        ["passId", MORNING],
        [passAmountField(MORNING), " 1000 mg "],
        [passAmountField(EVENING), ""],
        // An unticked pass's amount is ignored.
        [passAmountField("0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1003"), "3 mg"],
        ["time", ""],
        ["timeAmount", "ignored"],
        ["time", "14:00"],
        ["timeAmount", "2 tablets"],
        ["time", "21:00"],
        ["timeAmount", " "],
      ]),
    );
    expect(input.schedule).toEqual({
      type: "scheduled",
      slots: [
        { passId: EVENING },
        { passId: MORNING, amount: "1000 mg" },
        { time: "14:00", amount: "2 tablets" },
        { time: "21:00" },
      ],
    });
    expect(slotRows).toEqual([{ pass: EVENING }, { pass: MORNING }, { time: 1 }, { time: 2 }]);
    // The shared schema takes it as it is (stored passes first).
    expect(medicationContentZSchema.parse({ name: "A", schedule: input.schedule }).schedule).toEqual({
      type: "scheduled",
      slots: [
        { passId: MORNING, amount: "1000 mg" },
        { passId: EVENING },
        { time: "14:00", amount: "2 tablets" },
        { time: "21:00" },
      ],
    });
  });

  it("reads as needed, with or without a maximum, ignoring any times", () => {
    const read = (max: string) =>
      medicationFromForm(
        form([
          ["scheduleType", "asNeeded"],
          ["time", "08:00"],
          ["maxPerDay", max],
        ]),
      ).input.schedule;
    expect(read("4")).toEqual({ type: "asNeeded", maxPerDay: 4 });
    expect(read("")).toEqual({ type: "asNeeded" });
  });

  it("reads an unknown or empty form as none, and an empty refill count as none", () => {
    const { input } = medicationFromForm(form([["form", "lozenge"]]));
    expect(input.form).toBeNull();
    expect(input.refillsLeft).toBeNull();
  });

  it("reads the chosen type, and none chosen or an unknown one as none", () => {
    expect(medicationFromForm(form([["type", "supplement"]])).input.type).toBe("supplement");
    expect(medicationFromForm(form([["type", "vitamin"]])).input.type).toBeNull();
    expect(medicationFromForm(form([])).input.type).toBeNull();
  });

  it("reads a new prescriber or pharmacy by name, in place of a chosen one", () => {
    const { input, newProviders } = medicationFromForm(
      form([
        ["prescriberId", "p1"],
        ["newPrescriber", "  Dr. Ada Moss "],
        ["pharmacyId", "ph1"],
        ["newPharmacy", ""],
      ]),
    );
    expect(newProviders).toEqual({ prescriber: "Dr. Ada Moss" });
    expect(input.prescriberId).toBeNull();
    expect(input.pharmacyId).toBe("ph1");
  });

  it("reads the conditions it's for, each once, and none when none are chosen", () => {
    const { conditionIds } = medicationFromForm(
      form([
        ["conditionId", "c1"],
        ["conditionId", ""],
        ["conditionId", "c2"],
        ["conditionId", "c1"],
      ]),
    );
    expect(conditionIds).toEqual(["c1", "c2"]);
    expect(medicationFromForm(form([["name", "A"]])).conditionIds).toEqual([]);
  });

  it("gives the shared schema what it needs for the form's messages", () => {
    const blank = medicationFromForm(form([["scheduleType", "scheduled"]])).input;
    expect(issuesOf(blank)).toEqual(
      expect.arrayContaining([
        { path: "name", message: "Enter a name" },
        { path: "schedule.times", message: "Add at least one time" },
      ]),
    );
    const twice = medicationFromForm(
      form([
        ["name", "A"],
        ["time", "08:00"],
        ["time", "08:00"],
      ]),
    ).input;
    expect(issuesOf(twice)).toEqual([{ path: "schedule.times", message: "List each time once" }]);
    const tooMany = medicationFromForm(
      form([
        ["name", "A"],
        ["scheduleType", "asNeeded"],
        ["maxPerDay", "30"],
      ]),
    ).input;
    expect(issuesOf(tooMany)).toEqual([{ path: "schedule.maxPerDay", message: "At most 24 a day" }]);
  });
});

describe("issuesForSlotRows", () => {
  it("moves the schedule's slot issues to the form's time rows and passes", () => {
    const rows = [{ pass: MORNING }, { time: 0 }, { time: 2 }];
    expect(
      issuesForSlotRows(
        [
          { path: "schedule.slots.2.time", message: "Use a time like 08:00" },
          { path: "schedule.slots.1", message: "Choose a med time or a time of day" },
          { path: "schedule.slots.1.amount", message: "Too long" },
          { path: "schedule.slots.0.amount", message: "Too long" },
          { path: "schedule.slots.0.passId", message: "Choose a med time" },
          { path: "schedule.slots", message: "List each time once" },
          { path: "name", message: "Enter a name" },
        ],
        rows,
      ),
    ).toEqual([
      { path: "schedule.times.2", message: "Use a time like 08:00" },
      { path: "schedule.times.0", message: "Choose a med time or a time of day" },
      { path: "schedule.times.0.amount", message: "Too long" },
      { path: `schedule.passes.${MORNING}.amount`, message: "Too long" },
      { path: "schedule.passes", message: "Choose a med time" },
      { path: "schedule.times", message: "List each time once" },
      { path: "name", message: "Enter a name" },
    ]);
  });

  it("leaves an issue on a slot it doesn't know as it is", () => {
    expect(issuesForSlotRows([{ path: "schedule.slots.5", message: "?" }], [{ time: 0 }])).toEqual([
      { path: "schedule.slots.5", message: "?" },
    ]);
  });
});

describe("isFieldIssue", () => {
  it("knows the fields the form shows", () => {
    expect(isFieldIssue("name")).toBe(true);
    expect(isFieldIssue("type")).toBe(true);
    expect(isFieldIssue("schedule.times.3")).toBe(true);
    expect(isFieldIssue("schedule.times.3.amount")).toBe(true);
    expect(isFieldIssue("schedule.passes")).toBe(true);
    expect(isFieldIssue(`schedule.passes.${MORNING}.amount`)).toBe(true);
    expect(isFieldIssue("schedule.maxPerDay")).toBe(true);
    expect(isFieldIssue("conditionIds")).toBe(true);
    expect(isFieldIssue("stoppedOn")).toBe(false);
  });
});
