import type { MedicationContent } from "./medication";

import { describe, expect, it } from "vitest";
import {
  changeTimes,
  doseDetailsZSchema,
  medicationChange,
  medicationChangeDetailsZSchema,
  medicationChangeId,
  medicationContentZSchema,
  medicationFormContentZSchema,
  medicationScheduleZSchema,
  medicationUpdateZSchema,
  normalizeSchedule,
  ownTimes,
  parseMedicationSchedule,
  sameSchedule,
  schedulePassIds,
  slotAmount,
  toChangeTime,
} from "./medication";
import { timelineEntryContentZSchema, timelineEntryUpdateZSchema } from "../timeline/timelineEntry";

const MEDICATION_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9a1001";

const content = (overrides: Record<string, unknown> = {}) => ({
  name: "Lisinopril",
  strength: "10 mg",
  form: "tablet",
  dose: "1 tablet",
  schedule: { type: "scheduled", times: ["08:00"] },
  ...overrides,
});

const parsed = (overrides: Record<string, unknown> = {}): MedicationContent =>
  medicationContentZSchema.parse(content(overrides));

const issuePaths = (schema: { safeParse: (v: unknown) => unknown }, value: unknown) => {
  const res = schema.safeParse(value) as { success: boolean; error?: { issues: { path: PropertyKey[] }[] } };
  return res.success ? [] : (res.error?.issues ?? []).map((i) => i.path.join("."));
};

describe("medicationScheduleZSchema", () => {
  it("takes one to eight times of day, and stores them sorted", () => {
    expect(
      medicationScheduleZSchema.parse({ type: "scheduled", slots: [{ time: "20:00" }, { time: "08:00" }] }),
    ).toEqual({ type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] });
    const eight = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    expect(medicationScheduleZSchema.safeParse({ type: "scheduled", times: eight }).success).toBe(true);
    expect(
      medicationScheduleZSchema.safeParse({ type: "scheduled", times: [...eight, "22:00"] }).success,
    ).toBe(false);
    expect(medicationScheduleZSchema.safeParse({ type: "scheduled", times: [] }).success).toBe(false);
  });

  it("refuses a repeated time and anything that isn't HH:MM", () => {
    expect(
      medicationScheduleZSchema.safeParse({ type: "scheduled", times: ["08:00", "08:00"] }).success,
    ).toBe(false);
    for (const time of ["8:00", "24:00", "08:60", "8am", "08:00:00", ""]) {
      expect(medicationScheduleZSchema.safeParse({ type: "scheduled", times: [time] }).success).toBe(false);
    }
  });

  it("takes as needed, with an optional maximum of 1 to 24 a day", () => {
    expect(medicationScheduleZSchema.parse({ type: "asNeeded" })).toEqual({ type: "asNeeded" });
    expect(medicationScheduleZSchema.parse({ type: "asNeeded", maxPerDay: 4 })).toEqual({
      type: "asNeeded",
      maxPerDay: 4,
    });
    for (const maxPerDay of [0, 25, 1.5, "4"]) {
      expect(medicationScheduleZSchema.safeParse({ type: "asNeeded", maxPerDay }).success).toBe(false);
    }
  });

  it("refuses another type, and fields of the other type", () => {
    expect(medicationScheduleZSchema.safeParse({ type: "weekly", times: ["08:00"] }).success).toBe(false);
    expect(medicationScheduleZSchema.safeParse({ type: "asNeeded", times: ["08:00"] }).success).toBe(false);
    expect(
      medicationScheduleZSchema.safeParse({ type: "scheduled", times: ["08:00"], maxPerDay: 2 }).success,
    ).toBe(false);
  });

  it("reads a stored schedule from jsonb or JSON text, and gives null for a malformed one", () => {
    expect(parseMedicationSchedule({ type: "asNeeded", maxPerDay: 2 })).toEqual({
      type: "asNeeded",
      maxPerDay: 2,
    });
    expect(parseMedicationSchedule('{"type":"scheduled","slots":[{"time":"08:00"}]}')).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00" }],
    });
    expect(parseMedicationSchedule("{")).toBeNull();
    expect(parseMedicationSchedule(null)).toBeNull();
    expect(parseMedicationSchedule({ type: "everyOtherDay" })).toBeNull();
  });
});

describe("the schedule's slots", () => {
  const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
  const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";

  it("reads the old `times` shape (older builds) as time slots, from jsonb or JSON text", () => {
    expect(normalizeSchedule({ type: "scheduled", times: ["20:00", "08:00"] })).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00" }, { time: "20:00" }],
    });
    expect(normalizeSchedule('{"type":"scheduled","times":["08:00"]}')).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00" }],
    });
    // Through the content schema too: what the service and the device validate with.
    expect(parsed({ schedule: { type: "scheduled", times: ["08:00"] } }).schedule).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00" }],
    });
    // Its old rules still hold.
    expect(normalizeSchedule({ type: "scheduled", times: ["08:00", "08:00"] })).toBeNull();
    expect(normalizeSchedule({ type: "scheduled", times: [] })).toBeNull();
  });

  it("takes passes and times, each with an optional amount, passes first", () => {
    expect(
      normalizeSchedule({
        type: "scheduled",
        slots: [
          { time: "14:00", amount: " 500 mg " },
          { passId: EVENING, amount: "" },
          { passId: MORNING, amount: "1000 mg" },
        ],
      }),
    ).toEqual({
      type: "scheduled",
      slots: [
        { passId: MORNING, amount: "1000 mg" },
        { passId: EVENING },
        { time: "14:00", amount: "500 mg" },
      ],
    });
  });

  it("refuses a repeated pass or time, a slot with both or neither, and over eight", () => {
    const paths = (slots: unknown[]) => issuePaths(medicationScheduleZSchema, { type: "scheduled", slots });
    expect(paths([{ passId: MORNING }, { passId: MORNING }])).toEqual(["slots"]);
    expect(paths([{ time: "08:00" }, { time: "08:00", amount: "1" }])).toEqual(["slots"]);
    expect(paths([{ passId: MORNING, time: "08:00" }])).toEqual(["slots.0"]);
    expect(paths([{}])).toEqual(["slots.0"]);
    expect(paths([{ time: "25:00" }])).toEqual(["slots.0.time"]);
    expect(paths([{ passId: "not-an-id" }])).toEqual(["slots.0.passId"]);
    const nine = Array.from({ length: 9 }, (_, i) => ({ time: `${String(10 + i)}:00` }));
    expect(paths(nine)).toEqual(["slots"]);
    // A pass and a time at the same moment are two slots: the pass's time is the pass's.
    expect(paths([{ passId: MORNING }, { time: "08:00" }])).toEqual([]);
  });

  it("knows the same schedule in any order, and a changed amount as a change", () => {
    const read = (value: unknown) => {
      const schedule = normalizeSchedule(value);
      if (!schedule) throw new Error("not a schedule");
      return schedule;
    };
    const a = read({ type: "scheduled", slots: [{ passId: MORNING }, { time: "14:00" }] });
    const b = read({ type: "scheduled", slots: [{ time: "14:00" }, { passId: MORNING }] });
    expect(sameSchedule(a, b)).toBe(true);
    const c = read({ type: "scheduled", slots: [{ passId: MORNING, amount: "2" }, { time: "14:00" }] });
    expect(sameSchedule(a, c)).toBe(false);
    expect(sameSchedule(a, { type: "asNeeded" })).toBe(false);
    expect(
      ownTimes(
        read({ type: "scheduled", slots: [{ time: "20:00" }, { passId: MORNING }, { time: "14:00" }] }),
      ),
    ).toEqual(["14:00", "20:00"]);
    expect(schedulePassIds(a)).toEqual([MORNING]);
    expect(ownTimes({ type: "asNeeded" })).toEqual([]);
  });
});

describe("slotAmount", () => {
  it("is the slot's own amount, else the medication's dose, else none", () => {
    expect(slotAmount({ dose: "1 tablet" }, { amount: "2 tablets" })).toBe("2 tablets");
    expect(slotAmount({ dose: "1 tablet" }, { amount: "  " })).toBe("1 tablet");
    expect(slotAmount({ dose: " 1 tablet " }, {})).toBe("1 tablet");
    expect(slotAmount({ dose: "1 tablet" }, null)).toBe("1 tablet");
    expect(slotAmount({ dose: null }, { amount: null })).toBeNull();
    expect(slotAmount({ dose: "" }, undefined)).toBeNull();
  });
});

describe("medicationContentZSchema", () => {
  it("needs a name and a schedule; everything else is optional and empty text is none", () => {
    expect(
      medicationContentZSchema.parse({ name: " Aspirin ", schedule: { type: "asNeeded" }, reason: " " }),
    ).toEqual({
      name: "Aspirin",
      strength: null,
      form: null,
      dose: null,
      directions: null,
      reason: null,
      schedule: { type: "asNeeded" },
      status: "current",
      startedOn: null,
      stoppedOn: null,
      stopReason: null,
      stopNote: null,
      prescriberId: null,
      pharmacyId: null,
      lastFilledOn: null,
      quantity: null,
      refillsLeft: null,
      rxNumber: null,
      type: null,
    });
    expect(issuePaths(medicationContentZSchema, content({ name: "  " }))).toEqual(["name"]);
    expect(issuePaths(medicationContentZSchema, { name: "Aspirin" })).toEqual(["schedule"]);
  });

  it("takes a known type or none, and refuses another", () => {
    for (const type of ["prescription", "otc", "supplement", "other"])
      expect(parsed({ type }).type).toBe(type);
    expect(parsed({ type: null }).type).toBeNull();
    expect(parsed().type).toBeNull();
    expect(issuePaths(medicationContentZSchema, content({ type: "vitamin" }))).toEqual(["type"]);
  });

  it("as the medication form saves it, needs a type", () => {
    expect(medicationFormContentZSchema.parse(content({ type: "otc" })).type).toBe("otc");
    for (const type of [undefined, null, "vitamin"]) {
      const res = medicationFormContentZSchema.safeParse(content({ type }));
      expect(res.success).toBe(false);
      expect(res.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
        ["type", "Choose a type"],
      ]);
    }
  });

  it("checks the form, the dates and the refills", () => {
    expect(issuePaths(medicationContentZSchema, content({ form: "pill" }))).toEqual(["form"]);
    expect(issuePaths(medicationContentZSchema, content({ startedOn: "11/17/2026" }))).toEqual(["startedOn"]);
    expect(issuePaths(medicationContentZSchema, content({ lastFilledOn: "2026-02-30" }))).toEqual([
      "lastFilledOn",
    ]);
    expect(issuePaths(medicationContentZSchema, content({ refillsLeft: -1 }))).toEqual(["refillsLeft"]);
    expect(issuePaths(medicationContentZSchema, content({ refillsLeft: 1.5 }))).toEqual(["refillsLeft"]);
    expect(parsed({ refillsLeft: 0 }).refillsLeft).toBe(0);
  });

  it("needs a stop date for a completed medication, and a reason too for a discontinued one", () => {
    expect(issuePaths(medicationContentZSchema, content({ status: "completed" }))).toEqual(["stoppedOn"]);
    expect(issuePaths(medicationContentZSchema, content({ status: "discontinued" })).sort()).toEqual([
      "stopReason",
      "stoppedOn",
    ]);
    expect(
      issuePaths(medicationContentZSchema, content({ status: "discontinued", stoppedOn: "2026-11-10" })),
    ).toEqual(["stopReason"]);
    expect(
      parsed({
        status: "discontinued",
        stoppedOn: "2026-11-10",
        stopReason: "sideEffects",
        stopNote: "Rash",
      }),
    ).toMatchObject({
      status: "discontinued",
      stoppedOn: "2026-11-10",
      stopReason: "sideEffects",
      stopNote: "Rash",
    });
    expect(
      issuePaths(
        medicationContentZSchema,
        content({ status: "discontinued", stoppedOn: "2026-11-10", stopReason: "bored" }),
      ),
    ).toEqual(["stopReason"]);
  });

  it("refuses a stop date before the start date", () => {
    expect(
      issuePaths(
        medicationContentZSchema,
        content({ status: "completed", startedOn: "2026-11-10", stoppedOn: "2026-11-09" }),
      ),
    ).toEqual(["stoppedOn"]);
    expect(parsed({ status: "completed", startedOn: "2026-11-10", stoppedOn: "2026-11-10" }).stoppedOn).toBe(
      "2026-11-10",
    );
  });

  it("clears the stop fields of a current medication, and a completed one's reason", () => {
    expect(
      parsed({ status: "current", stoppedOn: "2026-11-10", stopReason: "other", stopNote: "Was stopped" }),
    ).toMatchObject({ status: "current", stoppedOn: null, stopReason: null, stopNote: null });
    expect(
      parsed({ status: "completed", stoppedOn: "2026-11-10", stopReason: "other", stopNote: "Course done" }),
    ).toMatchObject({
      status: "completed",
      stoppedOn: "2026-11-10",
      stopReason: null,
      stopNote: "Course done",
    });
  });

  it("takes any provider id: which types are allowed needs the database", () => {
    expect(issuePaths(medicationContentZSchema, content({ prescriberId: "dr-alvarez" }))).toEqual([
      "prescriberId",
    ]);
    expect(parsed({ pharmacyId: MEDICATION_ID }).pharmacyId).toBe(MEDICATION_ID);
  });
});

describe("medicationUpdateZSchema", () => {
  it("takes any content field, and nothing else", () => {
    expect(
      medicationUpdateZSchema.safeParse({ dose: "2 tablets", refillsLeft: 1, rxNumber: null }).success,
    ).toBe(true);
    expect(medicationUpdateZSchema.safeParse({}).success).toBe(true);
    expect(medicationUpdateZSchema.safeParse({ groupId: MEDICATION_ID }).success).toBe(false);
    expect(medicationUpdateZSchema.safeParse({ recipientId: MEDICATION_ID }).success).toBe(false);
    expect(medicationUpdateZSchema.safeParse({ deletedAt: null }).success).toBe(false);
  });
});

describe("dose and medication change entries", () => {
  const entry = (kind: string, details: unknown, more: Record<string, unknown> = {}) => ({
    kind,
    occurredAt: "2026-11-17T16:05:00.000Z",
    timeZone: "America/Los_Angeles",
    details,
    ...more,
  });

  it("takes a dose: a medication, given, skipped or refused, with an optional amount, slot and note", () => {
    expect(doseDetailsZSchema.safeParse({ medicationId: MEDICATION_ID, status: "given" }).success).toBe(true);
    expect(
      doseDetailsZSchema.safeParse({
        medicationId: MEDICATION_ID,
        status: "skipped",
        amount: "1 tablet",
        scheduledFor: "08:00",
        note: "Asleep",
      }).success,
    ).toBe(true);
    expect(issuePaths(doseDetailsZSchema, { medicationId: MEDICATION_ID, status: "missed" })).toEqual([
      "status",
    ]);
    expect(issuePaths(doseDetailsZSchema, { status: "given" })).toEqual(["medicationId"]);
    expect(
      issuePaths(doseDetailsZSchema, { medicationId: MEDICATION_ID, status: "given", scheduledFor: "8am" }),
    ).toEqual(["scheduledFor"]);
    expect(
      doseDetailsZSchema.safeParse({ medicationId: MEDICATION_ID, status: "given", extra: 1 }).success,
    ).toBe(false);
  });

  it("stores a dose as an entry with no title and no body", () => {
    const details = { medicationId: MEDICATION_ID, status: "given", amount: "1 tablet" };
    expect(timelineEntryContentZSchema.safeParse(entry("dose", details)).success).toBe(true);
    expect(issuePaths(timelineEntryContentZSchema, entry("dose", details, { title: "Lisinopril" }))).toEqual([
      "title",
    ]);
    expect(issuePaths(timelineEntryContentZSchema, entry("dose", details, { body: "Given" }))).toEqual([
      "body",
    ]);
    expect(issuePaths(timelineEntryContentZSchema, entry("dose", null))).toEqual(["details"]);
    // A dose's details can be edited; a medication change's can't.
    expect(timelineEntryUpdateZSchema.safeParse({ details }).success).toBe(true);
    expect(
      timelineEntryUpdateZSchema.safeParse({ details: { medicationId: MEDICATION_ID, change: "resumed" } })
        .success,
    ).toBe(false);
  });

  it("takes each medication change", () => {
    const changes = [
      { change: "started", after: { name: "Lisinopril", strength: "10 mg", schedule: { type: "asNeeded" } } },
      { change: "changed", fields: ["dose"], before: { dose: "1 tablet" }, after: { dose: "2 tablets" } },
      { change: "stopped", stopStatus: "discontinued", stopReason: "sideEffects", stopNote: "Rash" },
      { change: "stopped", stopStatus: "completed", stopReason: null, stopNote: null },
      { change: "resumed" },
    ];
    for (const change of changes) {
      const details = { medicationId: MEDICATION_ID, ...change };
      expect(medicationChangeDetailsZSchema.safeParse(details).success).toBe(true);
      expect(timelineEntryContentZSchema.safeParse(entry("medicationChange", details)).success).toBe(true);
    }
    expect(
      issuePaths(medicationChangeDetailsZSchema, { medicationId: MEDICATION_ID, change: "paused" }),
    ).toEqual(["change"]);
    expect(
      issuePaths(medicationChangeDetailsZSchema, {
        medicationId: MEDICATION_ID,
        change: "changed",
        fields: ["refillsLeft"],
      }),
    ).toEqual(["fields.0"]);
    expect(
      issuePaths(
        timelineEntryContentZSchema,
        entry("medicationChange", { medicationId: MEDICATION_ID, change: "resumed" }, { title: "Resumed" }),
      ),
    ).toEqual(["title"]);
  });
});

describe("medicationChange", () => {
  it("is 'started' for a new medication, with the tracked fields that are set", () => {
    expect(medicationChange(null, parsed({ directions: "With food", reason: "Blood pressure" }))).toEqual({
      change: "started",
      after: {
        name: "Lisinopril",
        strength: "10 mg",
        form: "tablet",
        dose: "1 tablet",
        directions: "With food",
        schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
      },
    });
    expect(medicationChange(null, parsed({ strength: null, form: null, dose: null }))).toEqual({
      change: "started",
      after: { name: "Lisinopril", schedule: { type: "scheduled", slots: [{ time: "08:00" }] } },
    });
  });

  it("records nothing for a change of type", () => {
    expect(medicationChange(parsed({ type: null }), parsed({ type: "supplement" }))).toBeNull();
    expect(medicationChange(parsed({ type: "otc" }), parsed({ type: "prescription" }))).toBeNull();
    expect(medicationChange(null, parsed({ type: "otc" }))?.after).not.toHaveProperty("type");
  });

  it("is 'changed' with each changed field's before and after", () => {
    expect(medicationChange(parsed(), parsed({ dose: "2 tablets" }))).toEqual({
      change: "changed",
      fields: ["dose"],
      before: { dose: "1 tablet" },
      after: { dose: "2 tablets" },
    });
    expect(
      medicationChange(
        parsed(),
        parsed({
          name: "Lisinopril HCTZ",
          strength: "20 mg",
          schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
        }),
      ),
    ).toEqual({
      change: "changed",
      fields: ["name", "strength", "schedule"],
      before: {
        name: "Lisinopril",
        strength: "10 mg",
        schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
      },
      after: {
        name: "Lisinopril HCTZ",
        strength: "20 mg",
        schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
      },
    });
  });

  it("records a field that was cleared or first set, and each tracked field", () => {
    expect(medicationChange(parsed(), parsed({ form: null }))).toEqual({
      change: "changed",
      fields: ["form"],
      before: { form: "tablet" },
      after: { form: null },
    });
    expect(medicationChange(parsed({ directions: null }), parsed({ directions: "With food" }))).toMatchObject(
      {
        fields: ["directions"],
        before: { directions: null },
        after: { directions: "With food" },
      },
    );
    expect(
      medicationChange(
        parsed({ schedule: { type: "asNeeded", maxPerDay: 6 } }),
        parsed({ schedule: { type: "asNeeded", maxPerDay: 4 } }),
      ),
    ).toMatchObject({ change: "changed", fields: ["schedule"] });
    expect(
      medicationChange(
        parsed({ schedule: { type: "asNeeded" } }),
        parsed({ schedule: { type: "scheduled", slots: [{ time: "08:00" }] } }),
      ),
    ).toMatchObject({ change: "changed", fields: ["schedule"] });
  });

  it("is null for edits the timeline doesn't record: refills, reason, providers, dates, the stop note", () => {
    const before = parsed();
    for (const untracked of [
      { refillsLeft: 2, quantity: "30 tablets", lastFilledOn: "2026-11-01", rxNumber: "RX 1" },
      { reason: "Blood pressure" },
      { prescriberId: MEDICATION_ID, pharmacyId: MEDICATION_ID },
      { startedOn: "2026-01-01" },
    ]) {
      expect(medicationChange(before, parsed(untracked))).toBeNull();
    }
    expect(medicationChange(before, parsed())).toBeNull();
    const stopped = { status: "discontinued", stoppedOn: "2026-11-10", stopReason: "other" };
    expect(medicationChange(parsed(stopped), parsed({ ...stopped, stopNote: "More detail" }))).toBeNull();
    // The same schedule written in another order is the same schedule.
    expect(
      medicationChange(
        parsed({ schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] } }),
        parsed({ schedule: { type: "scheduled", slots: [{ time: "20:00" }, { time: "08:00" }] } }),
      ),
    ).toBeNull();
  });

  it("is 'stopped' with how and why, for completed and for discontinued", () => {
    expect(medicationChange(parsed(), parsed({ status: "completed", stoppedOn: "2026-11-10" }))).toEqual({
      change: "stopped",
      stopStatus: "completed",
      stopReason: null,
      stopNote: null,
    });
    expect(
      medicationChange(
        parsed(),
        parsed({
          status: "discontinued",
          stoppedOn: "2026-11-10",
          stopReason: "sideEffects",
          stopNote: "Dizzy",
        }),
      ),
    ).toEqual({
      change: "stopped",
      stopStatus: "discontinued",
      stopReason: "sideEffects",
      stopNote: "Dizzy",
    });
    // Completed, then recorded as discontinued after all: stopped again.
    expect(
      medicationChange(
        parsed({ status: "completed", stoppedOn: "2026-11-10" }),
        parsed({ status: "discontinued", stoppedOn: "2026-11-10", stopReason: "ineffective" }),
      ),
    ).toMatchObject({ change: "stopped", stopStatus: "discontinued", stopReason: "ineffective" });
  });

  it("is 'resumed' when a stopped medication is current again, carrying edits saved with it", () => {
    const stopped = parsed({ status: "discontinued", stoppedOn: "2026-11-10", stopReason: "other" });
    expect(medicationChange(stopped, parsed())).toEqual({ change: "resumed" });
    expect(medicationChange(stopped, parsed({ dose: "half a tablet" }))).toEqual({
      change: "resumed",
      fields: ["dose"],
      before: { dose: "1 tablet" },
      after: { dose: "half a tablet" },
    });
  });

  it("always gives details the entry schema accepts", () => {
    const stopped = parsed({ status: "discontinued", stoppedOn: "2026-11-10", stopReason: "other" });
    for (const change of [
      medicationChange(null, parsed()),
      medicationChange(parsed(), parsed({ form: null, schedule: { type: "asNeeded" } })),
      medicationChange(parsed(), stopped),
      medicationChange(stopped, parsed({ name: "Other" })),
    ]) {
      expect(
        medicationChangeDetailsZSchema.safeParse({ medicationId: MEDICATION_ID, ...change }).success,
      ).toBe(true);
    }
  });
});

describe("medicationChangeId", () => {
  it("is the same for the same medication and time, however the time is written", () => {
    const id = medicationChangeId(MEDICATION_ID, "2026-11-17T21:45:25.229Z");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // A device's SQLite text, Postgres's text, a Date, another offset, an upper-case id.
    expect(medicationChangeId(MEDICATION_ID, "2026-11-17T21:45:25.229000Z")).toBe(id);
    expect(medicationChangeId(MEDICATION_ID, "2026-11-17 21:45:25.229+00")).toBe(id);
    expect(medicationChangeId(MEDICATION_ID, new Date("2026-11-17T21:45:25.229Z"))).toBe(id);
    expect(medicationChangeId(MEDICATION_ID, "2026-11-17T13:45:25.229-08:00")).toBe(id);
    expect(medicationChangeId(MEDICATION_ID.toUpperCase(), "2026-11-17T21:45:25.229Z")).toBe(id);
  });

  it("differs for another time or another medication, and refuses what isn't a time", () => {
    const id = medicationChangeId(MEDICATION_ID, "2026-11-17T21:45:25.229Z");
    expect(medicationChangeId(MEDICATION_ID, "2026-11-17T21:45:25.230Z")).not.toBe(id);
    expect(medicationChangeId("0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9a1002", "2026-11-17T21:45:25.229Z")).not.toBe(
      id,
    );
    expect(() => medicationChangeId(MEDICATION_ID, "yesterday")).toThrow();
  });

  it("normalises a change time to ISO milliseconds in UTC", () => {
    expect(toChangeTime("2026-11-17T21:45:25.229000Z")).toBe("2026-11-17T21:45:25.229Z");
    expect(toChangeTime("2026-11-17 21:45:25+00")).toBe("2026-11-17T21:45:25.000Z");
    expect(toChangeTime("2026-11-17T21:45:25")).toBe("2026-11-17T21:45:25.000Z");
    expect(toChangeTime("")).toBeNull();
    expect(toChangeTime("2026-13-40T99:00:00Z")).toBeNull();
  });
});

describe("changeTimes", () => {
  const now = new Date("2026-11-17T12:00:00.000Z");

  it("keys a time ahead by itself and dates it now", () => {
    expect(changeTimes("2026-11-18T12:00:00.123000Z", now)).toEqual({
      key: "2026-11-18T12:00:00.123Z",
      date: "2026-11-17T12:00:00.000Z",
    });
  });

  it("gives a time behind, or equal to now, for both", () => {
    expect(changeTimes("2026-11-16 08:30:00+00", now)).toEqual({
      key: "2026-11-16T08:30:00.000Z",
      date: "2026-11-16T08:30:00.000Z",
    });
    expect(changeTimes(now, now)).toEqual({ key: now.toISOString(), date: now.toISOString() });
  });

  it("gives now for both when the time is missing or unreadable", () => {
    const both = { key: now.toISOString(), date: now.toISOString() };
    expect(changeTimes(undefined, now)).toEqual(both);
    expect(changeTimes(null, now)).toEqual(both);
    expect(changeTimes("", now)).toEqual(both);
    expect(changeTimes("yesterday", now)).toEqual(both);
  });
});
