import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, medicationPass } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { clockAt, clockMoment, DOSES_SQL, fixClock } from "../medications/medicationWorld";
import * as newDose from "./new-dose/route";
import * as timeline from "./route";
import { TIMELINE_URL } from "./timelineWorld";

// The timeline's medication strip on a fixed clock (medications.mjs's strip
// steps): 10:00 in Los Angeles, with a pass 65 minutes back (overdue), one 3
// minutes back (due) and one 30 minutes ahead. The overdue pass takes the
// line, with +1 more; Given all from the strip logs it and offers Undo, and
// Undo brings it back; the due pass reads its name, time and count, and its
// name opens the Dose sheet on it; once it's logged the strip shows the next
// pass, quiet. One line at 420; a viewer's text has no link or button; a
// group without scheduled medications has no strip. The device never
// connects, so every write here is the offline one too. Which pass and its
// wording are medicationStrip.test.ts's; 1280's width is
// timelineStrips.browser.test.tsx's.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [{ path: "/app/groups/:groupId/timeline/new/dose", module: newDose }],
  },
];

const LATE = medicationPass({ name: "Late", time: clockAt(-65), sortOrder: 0 });
const NOW = medicationPass({ name: "Now", time: clockAt(-3), sortOrder: 1 });
const LATER = medicationPass({ name: "Later", time: clockAt(30), sortOrder: 2 });
const med = (name: string, passId: string) =>
  fx.medication({ name, strength: "5 mg", schedule: { type: "scheduled", slots: [{ passId }] } });
const SA = med("Sa", LATE.id);
const SB = med("Sb", NOW.id);
const SC = med("Sc", NOW.id);
const SD = med("Sd", LATER.id);
const PASSES: Fixture[] = [LATE, NOW, LATER, SA, SB, SC, SD];

const STRIP = () => document.querySelector<HTMLElement>("main [data-med-strip]");
const state = () => [STRIP()?.dataset.stripState ?? null, STRIP()?.dataset.stripPass ?? null];
const text = () => STRIP()?.textContent ?? "";
const UNDO = () => document.querySelector("[data-pass-undo-label]")?.textContent?.trim() ?? null;
const givenAll = () => STRIP()!.querySelector<HTMLElement>("[data-strip-given-all]")!;

const open = async (role: "caretaker" | "viewer" = "caretaker", fixtures: Fixture[] = PASSES) => {
  const device = await renderWithDevice({ route: ROUTES, url: TIMELINE_URL, role, fixtures });
  await expect.poll(STRIP).toBeTruthy();
  return device;
};

beforeEach(() => {
  fixClock();
});
afterEach(() => {
  clearUndo();
  vi.useRealTimers();
});

describe("the medication strip", () => {
  test("an overdue pass takes the place of a due one, on one line at 420, with Given all; Given all logs it and offers Undo, and Undo brings it back", async () => {
    const device = await open();
    expect(state()).toEqual(["overdue", `pass:${LATE.id}`]);
    expect(text()).toContain("Overdue: Late · 8:55 · 1 med · +1 more");
    const height = STRIP()!.getBoundingClientRect().height;
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(40);

    await userEvent.click(givenAll());
    await expect.poll(state, { timeout: 5000 }).toEqual(["due", `pass:${NOW.id}`]);
    await expect.poll(UNDO).toBe("Late logged");
    expect(await device.query(DOSES_SQL)).toMatchObject([
      { medicationId: SA.id, scheduledFor: clockAt(-65) },
    ]);

    await userEvent.click(document.querySelector<HTMLElement>("[data-pass-undo-button]")!);
    await expect.poll(state, { timeout: 5000 }).toEqual(["overdue", `pass:${LATE.id}`]);
    expect(await device.query(DOSES_SQL)).toHaveLength(0);
  });

  test("a due pass reads its name, time and how many; its name opens the Dose sheet on that pass; once logged, the strip shows the next pass with no Given all", async () => {
    // The overdue pass already given.
    const given = fx.dose({ medicationId: SA.id, scheduledFor: clockAt(-65), occurredAt: clockMoment(-60) });
    const device = await open("caretaker", [...PASSES, given]);
    await expect.poll(state).toEqual(["due", `pass:${NOW.id}`]);
    expect(text()).toContain("Due: Now · 9:57 · 2 meds");
    expect(text()).not.toContain("more");

    await userEvent.click(STRIP()!.querySelector<HTMLElement>("[data-strip-open]")!);
    await expect.poll(() => device.location()).toContain(`/timeline/new/dose?`);
    expect(new URLSearchParams(device.location().split("?")[1]).get("pass")).toBe(NOW.id);
    await expect
      .poll(() => document.querySelector(`[role=dialog] [data-pass="pass:${NOW.id}"]`))
      .toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector("[role=dialog]")).toBeNull();

    await userEvent.click(givenAll());
    await expect.poll(state, { timeout: 5000 }).toEqual(["next", `pass:${LATER.id}`]);
    expect(text()).toContain("Next: Later · 10:30 · 1 med");
    expect(STRIP()!.querySelector("[data-strip-given-all]")).toBeNull();
  });

  test("a viewer sees the strip as text, with no link or Given all, on one line", async () => {
    await open("viewer");
    expect(state()).toEqual(["overdue", `pass:${LATE.id}`]);
    expect(STRIP()!.querySelectorAll("a, button")).toHaveLength(0);
    expect(STRIP()!.getBoundingClientRect().height).toBeLessThanOrEqual(40);
  });

  test("a group without scheduled medications shows no strip", async () => {
    const device = await open();
    await device.unsync([SA, SB, SC, SD]);
    await device.settle();
    expect(STRIP()).toBeNull();
    expect(document.querySelector("main")).toBeTruthy();
  });
});
