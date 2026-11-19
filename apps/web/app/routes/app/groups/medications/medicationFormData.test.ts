import { medicationContentZSchema } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { isFieldIssue, issuesForTimeRows, medicationFromForm } from "./medicationFormData";

const form = (fields: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of fields) data.append(key, value);
  return data;
};

const issuesOf = (input: unknown) => {
  const parsed = medicationContentZSchema.safeParse(input);
  return parsed.success
    ? []
    : parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
};

describe("medicationFromForm", () => {
  it("reads a scheduled medication, dropping blank time rows", () => {
    const { input, timeRows, newProviders } = medicationFromForm(
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
      schedule: { type: "scheduled", times: ["20:00", "08:00"] },
      startedOn: "2026-11-01",
      prescriberId: "p1",
      pharmacyId: null,
      lastFilledOn: null,
      refillsLeft: 2,
    });
    expect(timeRows).toEqual([0, 2]);
    expect(newProviders).toEqual({});
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

describe("issuesForTimeRows", () => {
  it("moves a sent time's issue to its row in the form", () => {
    expect(
      issuesForTimeRows(
        [
          { path: "schedule.times.1", message: "Use a time like 08:00" },
          { path: "name", message: "Enter a name" },
        ],
        [0, 2],
      ),
    ).toEqual([
      { path: "schedule.times.2", message: "Use a time like 08:00" },
      { path: "name", message: "Enter a name" },
    ]);
  });
});

describe("isFieldIssue", () => {
  it("knows the fields the form shows", () => {
    expect(isFieldIssue("name")).toBe(true);
    expect(isFieldIssue("schedule.times.3")).toBe(true);
    expect(isFieldIssue("schedule.maxPerDay")).toBe(true);
    expect(isFieldIssue("stoppedOn")).toBe(false);
  });
});
