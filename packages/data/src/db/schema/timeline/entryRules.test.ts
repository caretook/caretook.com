import { describe, expect, it } from "vitest";
import { canChangeEntry, canLogEntry } from "./entryRules";

describe("canLogEntry", () => {
  it("lets writers log any kind, with appointment setup", () => {
    for (const role of ["owner", "admin", "caretaker"])
      expect(canLogEntry(role, "medicationChange", { seriesId: "s1" })).toBe(true);
  });

  it("lets an Easy helper log notes, events, symptoms, vitals and doses only", () => {
    for (const kind of ["note", "event", "symptom", "vital", "dose"])
      expect(canLogEntry("easy_helper", kind)).toBe(true);
    for (const kind of ["medicationChange", "conditionChange"])
      expect(canLogEntry("easy_helper", kind)).toBe(false);
  });

  it("refuses an Easy helper's appointment setup: a series, a reschedule, a cancellation", () => {
    expect(canLogEntry("easy_helper", "event", { seriesId: "s1" })).toBe(false);
    expect(canLogEntry("easy_helper", "event", { rescheduledTo: "e2" })).toBe(false);
    expect(canLogEntry("easy_helper", "event", { cancelledAt: "2026-11-21T10:00:00Z" })).toBe(false);
    expect(canLogEntry("easy_helper", "event", { seriesId: null, cancelledAt: null })).toBe(true);
  });

  it("refuses an Easy helper's update that clears a writer's cancellation or reschedule", () => {
    const cancelled = { cancelledAt: "2026-11-21T10:00:00Z", cancelReason: "Sick", rescheduledTo: "e2" };
    const clear = { cancelledAt: null, cancelReason: null, rescheduledTo: null };
    expect(canLogEntry("easy_helper", "event", clear, cancelled)).toBe(false);
    expect(canLogEntry("easy_helper", "event", { rescheduledTo: null }, cancelled)).toBe(false);
    expect(canLogEntry("easy_helper", "event", { cancelReason: null }, cancelled)).toBe(false);
    expect(canLogEntry("easy_helper", "event", { cancelledAt: "2026-11-22T10:00:00Z" }, {})).toBe(false);
    // Left out, or already empty: unchanged, so an ordinary edit passes.
    expect(canLogEntry("easy_helper", "event", {}, cancelled)).toBe(true);
    expect(canLogEntry("easy_helper", "event", clear, { cancelledAt: null, seriesId: null })).toBe(true);
    expect(canLogEntry("caretaker", "event", clear, cancelled)).toBe(true);
  });

  it("refuses viewers, the Easy viewer and non-members", () => {
    for (const role of ["viewer", "easy_viewer", null]) expect(canLogEntry(role, "note")).toBe(false);
  });
});

describe("canChangeEntry", () => {
  const mine = { createdBy: "u1" };
  const theirs = { createdBy: "u2" };

  it("lets writers change anyone's entry", () => {
    expect(canChangeEntry({ role: "caretaker", userId: "u1", entry: theirs })).toBe(true);
  });

  it("lets an Easy helper change only their own", () => {
    expect(canChangeEntry({ role: "easy_helper", userId: "u1", entry: mine })).toBe(true);
    expect(canChangeEntry({ role: "easy_helper", userId: "u1", entry: theirs })).toBe(false);
    expect(canChangeEntry({ role: "easy_helper", userId: null, entry: { createdBy: null } })).toBe(false);
  });

  it("lets nobody else change one, even their own", () => {
    for (const role of ["viewer", "easy_viewer", null])
      expect(canChangeEntry({ role, userId: "u1", entry: mine })).toBe(false);
  });
});
