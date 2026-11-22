import { describe, expect, test } from "vitest";
import { changedColumns, sameJson } from "./changedColumns";

// The text Postgres sends a jsonb column down in, against JSON.stringify's.
const PG_SCHEDULE = '{"type": "scheduled", "slots": [{"time": "08:00"}, {"passId": "p-1"}]}';
const COMPACT_SCHEDULE = JSON.stringify({ slots: [{ time: "08:00" }, { passId: "p-1" }], type: "scheduled" });

describe("sameJson", () => {
  test("equal JSON in different text forms is unchanged", () => {
    expect(sameJson(PG_SCHEDULE, COMPACT_SCHEDULE)).toBe(true);
    expect(
      sameJson('[{"label": "Office", "number": "555-0100"}]', '[{"number":"555-0100","label":"Office"}]'),
    ).toBe(true);
    expect(sameJson("[]", "[ ]")).toBe(true);
    expect(sameJson(null, null)).toBe(true);
  });

  test("a changed key, a changed array order and null against missing are changed", () => {
    expect(sameJson(PG_SCHEDULE, '{"type":"scheduled","slots":[{"time":"09:00"},{"passId":"p-1"}]}')).toBe(
      false,
    );
    expect(sameJson(PG_SCHEDULE, '{"type":"scheduled","slots":[{"passId":"p-1"},{"time":"08:00"}]}')).toBe(
      false,
    );
    expect(sameJson('{"type": "asNeeded", "maxPerDay": null}', '{"type":"asNeeded"}')).toBe(false);
    expect(sameJson('{"type": "asNeeded"}', '{"type":"asNeeded","maxPerDay":4}')).toBe(false);
    expect(sameJson("[]", null)).toBe(false);
    expect(sameJson("{}", "[]")).toBe(false);
    expect(sameJson('{"n": 1}', '{"n": "1"}')).toBe(false);
  });
});

describe("changedColumns", () => {
  const stored = { name: "Lisinopril", refillsLeft: 3, schedule: PG_SCHEDULE };

  test("only the columns whose value changed, JSON columns by value", () => {
    expect(
      changedColumns(stored, { name: "Lisinopril", refillsLeft: 2, schedule: COMPACT_SCHEDULE }, [
        "schedule",
      ]),
    ).toEqual({ refillsLeft: 2 });
  });

  test("a changed JSON column is kept, in the new text", () => {
    const schedule = '{"type":"asNeeded","maxPerDay":4}';
    expect(changedColumns(stored, { ...stored, schedule }, ["schedule"])).toEqual({ schedule });
  });

  test("nothing changed is nothing to write", () => {
    expect(changedColumns(stored, { ...stored, schedule: COMPACT_SCHEDULE }, ["schedule"])).toEqual({});
  });

  test("a column not named JSON is compared as text, and null against a value is a change", () => {
    expect(changedColumns(stored, { ...stored, schedule: COMPACT_SCHEDULE })).toEqual({
      schedule: COMPACT_SCHEDULE,
    });
    expect(changedColumns({ note: null }, { note: "" })).toEqual({ note: "" });
  });
});
