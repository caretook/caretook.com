import { describe, expect, it } from "vitest";
import { asksScope, asksScopeOnEdit, openedForOnlyThisVisit, scopeQuestion } from "./seriesScope";

// The appointments area's clock: Wed 2026-11-18 10:00 in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00Z");
const LA = "America/Los_Angeles";

const visit = (over: Record<string, unknown> = {}) => ({
  id: "v",
  kind: "event",
  occurredAt: "2026-11-20T14:00:00.000Z",
  timeZone: LA,
  seriesId: "s",
  seriesDetached: false,
  ...over,
});

describe("asksScope", () => {
  it("asks for an upcoming visit of a series, not a one-off or a past visit", () => {
    expect(asksScope(visit(), NOW)).toBe(true);
    expect(asksScope(visit({ seriesId: null }), NOW)).toBe(false);
    expect(asksScope(visit({ occurredAt: "2026-11-18T14:00:00.000Z" }), NOW)).toBe(false);
    // An all-day visit today hasn't ended yet.
    expect(asksScope(visit({ occurredAt: "2026-11-18T08:00:00.000Z", allDay: true }), NOW)).toBe(true);
  });

  it("an edit on the page doesn't ask once the visit is detached", () => {
    expect(asksScopeOnEdit(visit(), NOW)).toBe(true);
    expect(asksScopeOnEdit(visit({ seriesDetached: true }), NOW)).toBe(false);
    expect(asksScope(visit({ seriesDetached: true }), NOW)).toBe(true);
  });
});

describe("scopeQuestion", () => {
  it("names the action and the kind", () => {
    expect(scopeQuestion("delete", "event").title).toBe("Delete a repeating appointment");
    expect(scopeQuestion("edit", "note").title).toBe("Change a repeating reminder");
    expect(scopeQuestion("cancel", "event").message).toContain("The series ends here");
    expect(scopeQuestion("reschedule", "event").message).toContain("Past visits stay as they were");
  });
});

describe("openedForOnlyThisVisit", () => {
  it("reads the link state", () => {
    expect(openedForOnlyThisVisit({ seriesScope: "only" })).toBe(true);
    expect(openedForOnlyThisVisit(null)).toBe(false);
    expect(openedForOnlyThisVisit({ from: "timeline" })).toBe(false);
  });
});
