import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { fx, medicationPass } from "../../../../../test/fixtures";
import { fixClock, laTime, openPlanner } from "./plannerWorld";

// Passes in Upcoming (medications.mjs's Given all steps), at 10:00 in Los
// Angeles: an open pass is one row ("Round 2 · 1 medication") that opens the
// Dose sheet on that pass; a pass already given isn't listed; a viewer's row
// has no link. Times of their own are upcoming.browser.test.tsx's; which rows
// show is upcomingDoses.test.ts's.

const ROUNDS = medicationPass({ name: "Rounds", time: "09:53", sortOrder: 0 });
const ROUND_2 = medicationPass({ name: "Round 2", time: "09:56", sortOrder: 1 });
const XA = fx.medication({
  name: "Xa",
  strength: "5 mg",
  schedule: { type: "scheduled", slots: [{ passId: ROUNDS.id }] },
});
const WD = fx.medication({
  name: "Wd",
  strength: "5 mg",
  schedule: { type: "scheduled", slots: [{ passId: ROUND_2.id }] },
});
const passes = () => [
  ROUNDS,
  ROUND_2,
  XA,
  WD,
  // Rounds is given.
  fx.dose({ medicationId: XA.id, scheduledFor: "09:53", occurredAt: laTime(0, 9, 55) }),
];

const passRow = (passId: string) =>
  document.querySelector<HTMLElement>(`main [data-upcoming-dose="pass:${passId}"]`);

beforeEach(() => fixClock());
afterEach(() => {
  vi.useRealTimers();
});

describe("passes in the Planner", () => {
  test("an open pass is one row and a given one isn't listed; the row opens the Dose sheet on that pass", async () => {
    const device = await openPlanner({ extra: passes() });
    await expect.poll(() => passRow(ROUND_2.id)?.textContent ?? "").toContain("Round 2 · 1 medication");
    expect(passRow(ROUNDS.id)).toBeNull();
    await userEvent.click(passRow(ROUND_2.id)!.querySelector("a")!);
    await expect.poll(() => device.location()).toContain("/timeline/new/dose?");
    expect(new URLSearchParams(device.location().split("?")[1]).get("pass")).toBe(ROUND_2.id);
    await expect
      .poll(() => document.querySelector(`[role=dialog] [data-pass="pass:${ROUND_2.id}"] [data-given-all]`))
      .toBeTruthy();
  });

  test("a viewer sees the pass's row, with no link", async () => {
    await openPlanner({ extra: passes(), role: "viewer" });
    await expect.poll(() => passRow(ROUND_2.id)).toBeTruthy();
    expect(passRow(ROUND_2.id)!.querySelectorAll("a")).toHaveLength(0);
  });
});
