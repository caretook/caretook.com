import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "./timelineEntry";

const base = { occurredAt: "2026-11-17T12:00:00.000Z", timeZone: "America/Los_Angeles" };
const paths = (input: unknown) => {
  const parsed = timelineEntryContentZSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.path.join("."));
};

describe("note content", () => {
  it("needs no body or title: its text is its live document", () => {
    expect(paths({ ...base, kind: "note" })).toEqual([]);
    expect(paths({ ...base, kind: "note", body: null, title: null })).toEqual([]);
    expect(paths({ ...base, kind: "note", title: "Morning" })).toEqual([]);
  });

  it("rejects a body, even an empty one", () => {
    expect(paths({ ...base, kind: "note", body: "Ate lunch" })).toEqual(["body"]);
    expect(paths({ ...base, kind: "note", body: "" })).toEqual(["body"]);
  });
});

describe("event content", () => {
  it("needs a title", () => {
    expect(paths({ ...base, kind: "event", title: "Physical therapy" })).toEqual([]);
    expect(paths({ ...base, kind: "event", title: "Event", body: null })).toEqual([]);
    expect(paths({ ...base, kind: "event", title: " " })).toEqual(["title"]);
    expect(paths({ ...base, kind: "event" })).toEqual(["title"]);
  });

  it("rejects a body, even an empty one: its text is its live document", () => {
    expect(paths({ ...base, kind: "event", title: "Visit", body: "Dr. Lee" })).toEqual(["body"]);
    expect(paths({ ...base, kind: "event", title: "Visit", body: "" })).toEqual(["body"]);
  });
});

describe("appointment fields", () => {
  const event = { ...base, kind: "event", title: "Cardiology" };
  const later = "2026-11-17T13:00:00.000Z";
  const otherId = "2f8a4c1e-0000-4000-8000-000000000001";

  it("lets an event have an end, a place, all day and the cancel fields", () => {
    expect(paths({ ...event, endsAt: later, place: "12 Oak St" })).toEqual([]);
    expect(paths({ ...event, cancelledAt: later, cancelReason: "Doctor out sick" })).toEqual([]);
    expect(paths({ ...event, cancelledAt: later, rescheduledTo: otherId })).toEqual([]);
    expect(paths({ ...event, endsAt: null, place: null, cancelledAt: null, allDay: false })).toEqual([]);
  });

  it("needs an end after the start", () => {
    expect(paths({ ...event, endsAt: base.occurredAt })).toEqual(["endsAt"]);
    expect(paths({ ...event, endsAt: "2026-11-17T11:00:00.000Z" })).toEqual(["endsAt"]);
  });

  it("starts an all-day item at the start of its day in its zone, with no end", () => {
    // Midnight Nov 17 in Los Angeles is 08:00 UTC.
    const midnight = "2026-11-17T08:00:00.000Z";
    expect(paths({ ...event, occurredAt: midnight, allDay: true })).toEqual([]);
    expect(paths({ ...base, kind: "note", occurredAt: midnight, allDay: true })).toEqual([]);
    expect(paths({ ...event, allDay: true })).toEqual(["occurredAt"]);
    expect(paths({ ...event, occurredAt: midnight, allDay: true, endsAt: later })).toEqual(["endsAt"]);
  });

  it("only gives a cancelled event a reason or a replacement", () => {
    expect(paths({ ...event, cancelReason: "Moved" })).toEqual(["cancelReason"]);
    expect(paths({ ...event, rescheduledTo: otherId })).toEqual(["rescheduledTo"]);
  });

  it("limits the place and the reason", () => {
    expect(paths({ ...event, place: "x".repeat(201) })).toEqual(["place"]);
    expect(paths({ ...event, cancelledAt: later, cancelReason: "x".repeat(501) })).toEqual(["cancelReason"]);
  });

  it("refuses an end, a place or the cancel fields on a note", () => {
    const note = { ...base, kind: "note" };
    expect(paths({ ...note, endsAt: later })).toEqual(["endsAt"]);
    expect(paths({ ...note, place: "Home" })).toEqual(["place"]);
    expect(paths({ ...note, cancelledAt: later })).toEqual(["cancelledAt"]);
  });

  it("refuses all of them on symptoms, vitals and doses", () => {
    const symptom = { ...base, kind: "symptom", details: { name: "Pain" } };
    expect(paths({ ...symptom, allDay: true })).toEqual(["allDay"]);
    expect(paths({ ...symptom, cancelledAt: later })).toEqual(["cancelledAt"]);
    expect(paths({ ...symptom, allDay: false, endsAt: null })).toEqual([]);
    const vital = { ...base, kind: "vital", details: { readings: [{ type: "heartRate", value: 70 }] } };
    expect(paths({ ...vital, place: "Clinic" })).toEqual(["place"]);
    const dose = {
      ...base,
      kind: "dose",
      details: { medicationId: otherId, status: "given" },
    };
    expect(paths({ ...dose, endsAt: later })).toEqual(["endsAt"]);
  });
});
