import type { PlannerReturn } from "./plannerReturn";

import { describe, expect, it } from "vitest";
import { backIsHistoryStep, plannerReturnFrom, plannerReturnState, plannerReturnUrl } from "./plannerReturn";

const GROUP = "g1";
const UPCOMING = `/app/groups/${GROUP}/planner`;
const PAST = `/app/groups/${GROUP}/planner/past`;
const NOW = new Date("2026-11-18T18:00:00.000Z");
const LA = "America/Los_Angeles";
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const event = (from: number, to: number | null = null, allDay = false) => ({
  id: "e1",
  occurredAt: iso(from),
  endsAt: to === null ? null : iso(to),
  allDay,
  timeZone: LA,
});
const added: PlannerReturn = { from: `${PAST}?author=u1`, added: true, idx: 3 };
const opened: PlannerReturn = { from: `${UPCOMING}?kind=event`, added: false, idx: 3 };
const url = (ret: PlannerReturn, entry: ReturnType<typeof event>, stored = true) =>
  plannerReturnUrl(ret, { groupId: GROUP, entry, stored, now: NOW });

describe("plannerReturnFrom", () => {
  it("reads what plannerReturnState wrote, merged with other state", () => {
    const state = plannerReturnState(opened, { seriesScope: "only" });
    expect(state.seriesScope).toBe("only");
    expect(plannerReturnFrom(state)).toEqual(opened);
  });

  it("is null for any other state, and for a path that isn't this app's", () => {
    for (const state of [null, undefined, "x", {}, { seriesScope: "only" }, { plannerReturn: "x" }])
      expect(plannerReturnFrom(state)).toBeNull();
    for (const from of ["https://example.test/x", "//example.test/x", "planner", 3])
      expect(plannerReturnFrom({ plannerReturn: { from, added: false, idx: 1 } })).toBeNull();
  });

  it("takes a missing index as unknown and anything but true as not added", () => {
    expect(plannerReturnFrom({ plannerReturn: { from: UPCOMING, added: "yes" } })).toEqual({
      from: UPCOMING,
      added: false,
      idx: null,
    });
  });
});

describe("plannerReturnUrl", () => {
  it("sends a saved new event to the tab its time belongs on now", () => {
    expect(url(added, event(2 * HOUR))).toBe(UPCOMING);
    expect(url(added, event(-2 * HOUR))).toBe(PAST);
    // In progress, and today's all-day, count as Upcoming.
    expect(url(added, event(-HOUR, HOUR))).toBe(UPCOMING);
    expect(url(added, event(-HOUR, null, true))).toBe(UPCOMING);
    expect(url(added, event(-30 * HOUR, null, true))).toBe(PAST);
  });

  it("sends an unsaved draft back to the tab it came from, filters kept", () => {
    expect(url(added, event(2 * HOUR), false)).toBe(added.from);
  });

  it("sends an existing event back to its exact opener, whatever its time", () => {
    expect(url(opened, event(-48 * HOUR))).toBe(opened.from);
    expect(url(opened, event(48 * HOUR))).toBe(opened.from);
  });
});

describe("backIsHistoryStep", () => {
  it("is a step back only to the opener, from the entry right after it", () => {
    expect(backIsHistoryStep(opened, opened.from, 4)).toBe(true);
    expect(backIsHistoryStep(opened, opened.from, 5)).toBe(false);
    expect(backIsHistoryStep(opened, UPCOMING, 4)).toBe(false);
    expect(backIsHistoryStep({ ...opened, idx: null }, opened.from, 4)).toBe(false);
    expect(backIsHistoryStep(opened, opened.from, undefined)).toBe(false);
  });
});
