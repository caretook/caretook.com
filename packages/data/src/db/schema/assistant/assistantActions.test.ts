import { describe, expect, test } from "vitest";
import { ACTION_KINDS, assistantActionZSchema } from "./assistantActions";

// The action shapes: the same limits as the content schemas, and nothing
// more (no ids, nothing device-only).

const at = "2026-11-19T16:00:00.000Z";
const MED = "11111111-1111-4111-8111-111111111111";
const ok = (input: unknown) => assistantActionZSchema.safeParse(input).success;
const issues = (input: unknown) => {
  const r = assistantActionZSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("logVital", () => {
  const vital = (readings: unknown[], extra = {}) => ({
    type: "logVital",
    readings,
    occurredAt: at,
    ...extra,
  });
  test("valid readings, with an optional note", () => {
    expect(ok(vital([{ type: "bloodPressure", systolic: 130, diastolic: 85 }]))).toBe(true);
    expect(ok(vital([{ type: "heartRate", value: 72 }], { note: "after a walk" }))).toBe(true);
  });
  test("the vitals spec's limits and rules apply", () => {
    expect(issues(vital([{ type: "bloodPressure", systolic: 1300, diastolic: 85 }]))).toEqual([
      "readings.0.systolic",
    ]);
    expect(issues(vital([{ type: "bloodPressure", systolic: 90, diastolic: 120 }]))).toEqual([
      "readings.0.diastolic",
    ]);
    expect(issues(vital([]))).toEqual(["readings"]);
  });
  test("each type once", () => {
    const hr = { type: "heartRate", value: 72 };
    expect(issues(vital([hr, hr]))).toEqual(["readings"]);
  });
});

describe("logSymptom", () => {
  test("a name, and a severity 0–10", () => {
    expect(ok({ type: "logSymptom", name: "Pain", severity: 6, note: "left knee", occurredAt: at })).toBe(
      true,
    );
    expect(ok({ type: "logSymptom", name: "Dizzy", occurredAt: at })).toBe(true);
    expect(issues({ type: "logSymptom", name: "Pain", severity: 11, occurredAt: at })).toEqual(["severity"]);
    expect(issues({ type: "logSymptom", name: " ", occurredAt: at })).toEqual(["name"]);
  });
});

describe("logDose", () => {
  test("a medication and a status", () => {
    expect(
      ok({ type: "logDose", medicationId: MED, status: "given", amount: "1 tablet", occurredAt: at }),
    ).toBe(true);
    expect(issues({ type: "logDose", medicationId: "metformin", status: "given", occurredAt: at })).toEqual([
      "medicationId",
    ]);
    expect(issues({ type: "logDose", medicationId: MED, status: "lost", occurredAt: at })).toEqual([
      "status",
    ]);
  });
});

describe("givePass", () => {
  test("a pass and a time; nothing else (the medications are worked out where it's carried out)", () => {
    expect(ok({ type: "givePass", passId: MED, occurredAt: at })).toBe(true);
    expect(issues({ type: "givePass", passId: "evening", occurredAt: at })).toEqual(["passId"]);
    expect(issues({ type: "givePass", passId: MED, occurredAt: at, medicationIds: [MED] })).toEqual([""]);
    expect(issues({ type: "givePass", passId: MED })).toEqual(["occurredAt"]);
  });
});

describe("addTodo", () => {
  test("a title, and optionally a member, a due day with a time, and links; no todo id, no occurredAt", () => {
    expect(ok({ type: "addTodo", title: "Call pharmacy" })).toBe(true);
    expect(
      ok({ type: "addTodo", title: "Call pharmacy", assigneeId: MED, dueOn: "2026-11-20", dueTime: "17:00" }),
    ).toBe(true);
    expect(ok({ type: "addTodo", title: "Refill", providerId: MED, medicationId: MED, eventId: MED })).toBe(
      true,
    );
    expect(issues({ type: "addTodo", title: "  " })).toEqual(["title"]);
    expect(issues({ type: "addTodo", title: "Call", dueTime: "17:00" })).toEqual(["dueTime"]);
    expect(issues({ type: "addTodo", title: "Call", dueOn: "friday" })).toEqual(["dueOn"]);
    expect(issues({ type: "addTodo", title: "Call", assigneeName: "Aunt May" })).toEqual([""]);
    expect(issues({ type: "addTodo", title: "Call", id: MED })).toEqual([""]);
  });

  test("a repeat is a rule todos take, and needs a due day (B-254)", () => {
    const weekly = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
    expect(ok({ type: "addTodo", title: "Bins out", dueOn: "2026-11-23", repeatRule: weekly })).toBe(true);
    expect(ok({ type: "addTodo", title: "Bins out", repeatRule: null })).toBe(true);
    expect(issues({ type: "addTodo", title: "Bins out", repeatRule: weekly })).toEqual(["repeatRule"]);
    expect(
      issues({ type: "addTodo", title: "Bins out", dueOn: "2026-11-23", repeatRule: "FREQ=YEARLY" }),
    ).toEqual(["repeatRule"]);
    expect(
      issues({ type: "addTodo", title: "Bins out", dueOn: "2026-11-23", repeatRule: "every monday" }),
    ).toEqual(["repeatRule"]);
  });
});

describe("addNote and addEvent", () => {
  test("a note needs text", () => {
    expect(ok({ type: "addNote", text: "Good day", occurredAt: at })).toBe(true);
    expect(issues({ type: "addNote", text: "  ", occurredAt: at })).toEqual(["text"]);
  });
  test("an event needs a title and a zone; providers default to none", () => {
    const r = assistantActionZSchema.parse({
      type: "addEvent",
      title: "Dialysis",
      occurredAt: at,
      timeZone: "America/Los_Angeles",
    });
    expect(r).toMatchObject({ providerIds: [] });
    expect(issues({ type: "addEvent", title: "", occurredAt: at, timeZone: "Mars/Base" })).toEqual([
      "title",
      "timeZone",
    ]);
  });
});

test("actions carry no ids or other fields of their own", () => {
  expect(issues({ type: "addNote", id: MED, text: "Hi", occurredAt: at })).toEqual([""]);
  expect(issues({ type: "deleteEverything", occurredAt: at })).toEqual(["type"]);
});

test("every action names the kind it writes", () => {
  expect(ACTION_KINDS).toEqual({
    logVital: "vital",
    logSymptom: "symptom",
    logDose: "dose",
    addNote: "note",
    addEvent: "event",
    givePass: "dose",
    addTodo: "todo",
  });
});
