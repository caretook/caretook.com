import type { ScrubRule, ScrubTable } from "./scrub";
import type { PgTable } from "drizzle-orm/pg-core";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  appointmentSeriesSchema,
  carePeriodSchema,
  conditionChangeDetailsZSchema,
  doseDetailsZSchema,
  medicationChangeEntryDetailsZSchema,
  medicationPassSchema,
  medicationScheduleZSchema,
  medicationSchema,
  providerSchema,
  recipientAllergySchema,
  recipientConditionSchema,
  timelineEntrySchema,
  todoSchema,
} from "../../db/schema";
import { SCRUB_SPECS, SCRUB_TABLES, scrubEntryDetails, scrubbedColumns, scrubValue } from "./scrub";

// What a delete leaves meets the table: no NULL in a NOT NULL column, no
// value an enum CHECK refuses, and the todo and series checks that tie
// columns together. The database's own CHECKs are exercised by
// scrub.int.test.ts; this fails first, without one.

const TABLES: Record<ScrubTable, PgTable> = {
  timeline_entry: timelineEntrySchema,
  provider: providerSchema,
  medication: medicationSchema,
  medication_pass: medicationPassSchema,
  recipient_allergy: recipientAllergySchema,
  recipient_condition: recipientConditionSchema,
  care_period: carePeriodSchema,
  todo: todoSchema,
  appointment_series: appointmentSeriesSchema,
};

const MED = "11111111-1111-4111-8111-111111111111";
const PASS = "22222222-2222-4222-8222-222222222222";
const COND = "33333333-3333-4333-8333-333333333333";

describe("SCRUB_SPECS", () => {
  it("leaves every NOT NULL column set and every enum column in its values", () => {
    for (const table of SCRUB_TABLES) {
      const columns = new Map(getTableConfig(TABLES[table]).columns.map((c) => [c.name, c]));
      for (const [name, rule] of Object.entries(SCRUB_SPECS[table].columns) as [string, ScrubRule][]) {
        const column = columns.get(name);
        expect(column, `${table}.${name}`).toBeDefined();
        const value = scrubValue(rule);
        if (value === undefined) continue;
        if (column!.notNull) expect(value, `${table}.${name} is NOT NULL`).not.toBeNull();
        const values = column!.enumValues;
        if (values?.length && value !== null) expect(values, `${table}.${name}`).toContain(value);
      }
    }
  });

  it("keeps a todo's repeat with its day, and a series' start time with all-day", () => {
    const todo = SCRUB_SPECS.todo.columns;
    // todo_repeat_check, todo_repeat_due_check, todo_due_time_check.
    expect([todo.repeat_rule, todo.due_on, todo.due_time]).toEqual(["keep", "keep", "keep"]);
    // todo_assignee_check: never both.
    expect(scrubbedColumns("todo")).toMatchObject({ assignee_id: null, assignee_name: null });
    // appointment_series_time_check.
    const series = SCRUB_SPECS.appointment_series.columns;
    expect([series.all_day, series.start_time]).toEqual(["keep", "keep"]);
  });

  it("gives a medication a schedule the schema accepts", () => {
    expect(medicationScheduleZSchema.safeParse(scrubbedColumns("medication").schedule).success).toBe(true);
  });
});

describe("scrubEntryDetails", () => {
  const dose = {
    medicationId: MED,
    status: "given",
    amount: "500 mg",
    scheduledFor: "08:00",
    note: "With breakfast",
    passId: PASS,
    passLogId: null,
  };
  const change = {
    medicationId: MED,
    change: "changed",
    fields: ["name", "schedule"],
    before: { name: "Old", schedule: { type: "asNeeded" }, dose: null },
    after: { name: "New", strength: "5 mg", schedule: { type: "asNeeded", maxPerDay: 2 } },
    stopNote: "Felt dizzy",
  };

  it("clears symptoms, vitals and anything not an object", () => {
    const live = { medicationLive: true };
    expect(scrubEntryDetails("symptom", { name: "Headache", severity: 4 }, live)).toBeNull();
    expect(scrubEntryDetails("vital", { readings: [] }, live)).toBeNull();
    expect(scrubEntryDetails("dose", null, live)).toBeNull();
    expect(scrubEntryDetails("dose", [dose], live)).toBeNull();
  });

  it("keeps a live medication's dose slot, and only the medication once it's deleted", () => {
    const kept = scrubEntryDetails("dose", dose, { medicationLive: true });
    expect(kept).toEqual({
      medicationId: MED,
      status: "given",
      scheduledFor: "08:00",
      passId: PASS,
      passLogId: null,
    });
    expect(doseDetailsZSchema.safeParse(kept).success).toBe(true);
    expect(scrubEntryDetails("dose", dose, { medicationLive: false })).toEqual({
      medicationId: MED,
      status: "given",
    });
  });

  it("keeps a live medication's change schedule and dose, and only the change once it's deleted", () => {
    const kept = scrubEntryDetails("medicationChange", change, { medicationLive: true });
    expect(kept).toEqual({
      medicationId: MED,
      change: "changed",
      before: { schedule: { type: "asNeeded" }, dose: null },
      after: { schedule: { type: "asNeeded", maxPerDay: 2 } },
    });
    expect(medicationChangeEntryDetailsZSchema.safeParse(kept).success).toBe(true);
    expect(scrubEntryDetails("medicationChange", change, { medicationLive: false })).toEqual({
      medicationId: MED,
      change: "changed",
    });
  });

  it("keeps a pass's move without its name, and a condition change without its summary", () => {
    const moved = {
      change: "passMoved",
      passId: PASS,
      passName: "Morning",
      beforeTime: "08:00",
      afterTime: "08:30",
      medicationIds: [MED],
    };
    expect(scrubEntryDetails("medicationChange", moved, { medicationLive: false })).toEqual({
      ...moved,
      passName: "",
    });
    const condition = {
      conditionId: COND,
      conditionName: "Asthma",
      change: "added",
      after: { name: "Asthma", note: "Since childhood" },
    };
    const scrubbed = scrubEntryDetails("conditionChange", condition, { medicationLive: true });
    expect(scrubbed).toEqual({ conditionId: COND, change: "added", conditionName: "" });
    expect(conditionChangeDetailsZSchema.safeParse(scrubbed).success).toBe(true);
  });
});
