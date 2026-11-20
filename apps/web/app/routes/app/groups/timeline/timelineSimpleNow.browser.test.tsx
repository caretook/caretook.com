import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture, GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, medicationPass, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { dayInZone, timeInZone } from "~/lib/core/zonedDay";
import * as timeline from "./route";
import { waitUntil } from "./timelineWorld";

// Simple mode's Upcoming block (assistant slice 7), on the test device (offline):
// the pass due now as one big Given all with Undo, and the next appointment,
// for writers; the same as text for viewers. Times are relative to now in
// the recipient's zone, so the pass is due whatever the clock.

const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/timeline", module: timeline }];
const URL = `/app/groups/${TEST_GROUP.id}/timeline`;

/** Ten minutes ago by the recipient's clock (just after midnight, midnight itself). */
const dueTime = () => {
  const now = new Date();
  const earlier = new Date(now.getTime() - 10 * 60_000);
  return dayInZone(earlier, TEST_TIME_ZONE) === dayInZone(now, TEST_TIME_ZONE)
    ? timeInZone(earlier, TEST_TIME_ZONE)
    : "00:00";
};
const EVENING = medicationPass({ name: "Evening", time: dueTime() });
const inEvening = (name: string) =>
  fx.medication({ name, schedule: { type: "scheduled", slots: [{ passId: EVENING.id }] } });
const MEDS = [EVENING, inEvening("Lisinopril"), inEvening("Metformin")];
const VISIT = fx.event({
  title: "Visit with Dr. Lark",
  occurredAt: at(new Date(Date.now() + 26 * 3_600_000)),
});

const open = (role: GroupRole, fixtures: Fixture[] = [...MEDS, VISIT]) =>
  renderWithDevice({
    route: ROUTES,
    url: URL,
    role: null,
    fixtures: [fx.member({ userId: TEST_USER.id, role, simpleMode: 1 }), ...fixtures],
  });

const now = () => document.querySelector<HTMLElement>("[data-simple-now]");
const give = () => [...(now()?.querySelectorAll<HTMLButtonElement>("[data-simple-give]") ?? [])];
const undo = () => now()?.querySelector<HTMLButtonElement>("[data-pass-undo-button]") ?? null;
const doses = async (device: Awaited<ReturnType<typeof open>>) =>
  device.query<{ id: string }>("SELECT id FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL");

afterEach(() => clearUndo());

describe("the Upcoming block", () => {
  test("a writer: the due pass as one big Given all, with Undo there, and the next appointment", async () => {
    const device = await open("caretaker");
    await waitUntil(() => give().length === 1, 4000, "the due pass");
    const block = page.getByRole("region", { name: "Upcoming" });
    await expect.element(block).toBeVisible();
    await expect.element(block.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    expect(give()[0]!.textContent).toBe("Give evening meds (2)");
    expect(now()!.querySelector("[data-simple-next]")?.textContent).toMatch(/^Next: Visit with Dr\. Lark · /);
    // It comes before the quick-entry box.
    const box = document.querySelector("[data-quick-entry]")!;
    expect(now()!.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The box offers no due-pass chip of its own: Given all is here (passChips={false}).
    expect(box.querySelectorAll('[data-quick-row="due"] button')).toHaveLength(0);

    await userEvent.click(give()[0]!);
    await expect.poll(async () => (await doses(device)).length).toBe(2);
    await waitUntil(() => !!undo(), 4000, "Undo");
    expect(now()!.querySelector("[data-pass-undo-label]")?.textContent).toBe("Evening logged");
    await waitUntil(() => give().length === 0, 4000, "the pass to be done");

    await userEvent.click(undo()!);
    await expect.poll(async () => (await doses(device)).length).toBe(0);
    await waitUntil(() => give().length === 1, 4000, "the pass due again");
  });

  test("a viewer: the due pass and the next appointment as text, no buttons", async () => {
    await open("viewer");
    await waitUntil(() => !!now()?.querySelector("[data-simple-due]"), 4000, "the due pass");
    expect(now()!.querySelector("[data-simple-due]")!.textContent).toMatch(
      /^(Due now|Overdue): Evening · 2 medications$/,
    );
    expect(now()!.querySelector("[data-simple-next]")?.textContent).toMatch(/^Next: Visit with Dr\. Lark/);
    expect(now()!.querySelectorAll("button")).toHaveLength(0);
  });

  test("nothing due and nothing ahead: no Upcoming heading", async () => {
    await open("caretaker", []);
    await waitUntil(() => !!document.querySelector("[data-simple-timeline]"), 4000, "the simple view");
    expect(now()?.querySelector("h2") ?? null).toBeNull();
    expect(give()).toHaveLength(0);
  });
});
