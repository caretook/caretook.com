import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture, GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { localDate } from "@caretook/data/schema";
import { renderWithDevice } from "../../../../../test/device";
import {
  at,
  fx,
  medicationPass,
  task,
  TEST_GROUP,
  TEST_TIME_ZONE,
  TEST_USER,
} from "../../../../../test/fixtures";
import { appUrls } from "~/lib/app-shell/appUrls";
import { clearUndo } from "~/lib/medications/passUndo";
import { dayInZone, timeInZone } from "~/lib/core/zonedDay";
import * as timeline from "./route";
import { waitUntil } from "./timelineWorld";

// Simple mode's Upcoming block (assistant slice 7), on the test device (offline):
// the pass due now as one big Given all with Undo, and the next appointment,
// for writers; the same as text for viewers. Times are relative to now in
// the recipient's zone, so the pass is due whatever the clock. The next
// appointment opens the next five upcoming items (B-191).

/** Stands in for a page the list links to: says where it is. */
const probe = (name: string) => ({ default: () => <h1>{name} page</h1> });
const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/timeline", module: timeline },
  { path: "/app/groups/:groupId/entries/:entryId", module: probe("Entry") },
  { path: "/app/groups/:groupId/tasks/:taskId", module: probe("Task") },
  { path: "/app/groups/:groupId/upcoming", module: probe("Upcoming") },
];
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
const hoursAhead = (h: number) => at(new Date(Date.now() + h * 3_600_000));
const VISIT = fx.event({ title: "Visit with Dr. Lark", occurredAt: hoursAhead(26) });

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

  test("a viewer: the due pass and the next appointment as text, no Given all", async () => {
    await open("viewer");
    await waitUntil(() => !!now()?.querySelector("[data-simple-due]"), 4000, "the due pass");
    expect(now()!.querySelector("[data-simple-due]")!.textContent).toMatch(
      /^(Due now|Overdue): Evening · 2 medications$/,
    );
    expect(now()!.querySelector("[data-simple-next]")?.textContent).toMatch(/^Next: Visit with Dr\. Lark/);
    // No Given all: the one button is the next appointment's, which opens the list (B-191).
    expect([...now()!.querySelectorAll("button")].map((b) => b.getAttribute("aria-expanded"))).toEqual([
      "false",
    ]);
  });

  test("nothing due and nothing ahead: no Upcoming heading", async () => {
    await open("caretaker", []);
    await waitUntil(() => !!document.querySelector("[data-simple-timeline]"), 4000, "the simple view");
    expect(now()?.querySelector("h2") ?? null).toBeNull();
    expect(give()).toHaveLength(0);
  });
});

describe("the next appointment opens the next five upcoming items", () => {
  // Seven upcoming items. Upcoming's order: the all-day task due today
  // first (before today's timed items, or in today's section before
  // tomorrow's), then the rest by time; the last two are past the five.
  const FAX = task({ title: "Fax the form", dueOn: localDate(new Date(), TEST_TIME_ZONE) });
  const CALL = fx.note({ title: "Call about the walker", occurredAt: hoursAhead(3) });
  const THERAPY = fx.event({ title: "Physical therapy", occurredAt: hoursAhead(50) });
  const EYE = fx.event({ title: "Eye exam", occurredAt: hoursAhead(74) });
  const DENTAL = fx.event({ title: "Dental cleaning", occurredAt: hoursAhead(98) });
  const HEARING = fx.event({ title: "Hearing check", occurredAt: hoursAhead(122) });
  // Given out of order.
  const SEVEN = [HEARING, EYE, VISIT, FAX, DENTAL, THERAPY, CALL];

  const toggle = () => page.getByRole("button", { name: /^Next: / });
  const list = () => document.querySelector<HTMLElement>("[data-simple-upcoming]");
  const items = () => [...(list()?.querySelectorAll<HTMLLIElement>("[data-simple-upcoming-item]") ?? [])];
  const titles = () => items().map((li) => li.querySelector("span")?.textContent);
  const itemLink = (title: string) =>
    items()
      .find((li) => li.querySelector("span")?.textContent === title)!
      .querySelector("a")!;

  test("a tap opens the next five in Upcoming's order without navigating; See all; a second tap closes it", async () => {
    const device = await open("caretaker", SEVEN);
    await expect.element(toggle()).toBeVisible();
    // The next appointment or reminder: the reminder note, the soonest timed entry.
    expect(toggle().element().textContent).toMatch(/^Next: Call about the walker · .* · \+5 more$/);
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(list()!.hidden).toBe(true);
    expect(items()).toHaveLength(0);

    await userEvent.click(toggle());
    expect(device.location()).toBe(URL);
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle().element().getAttribute("aria-controls")).toBe(list()!.id);
    await waitUntil(() => items().length > 0, 4000, "the list");
    expect(list()!.hidden).toBe(false);
    expect(titles()).toEqual([
      "Fax the form",
      "Call about the walker",
      "Visit with Dr. Lark",
      "Physical therapy",
      "Eye exam",
    ]);
    // Each says when.
    expect(items()[0]!.textContent).toContain("Due today");
    expect(items()[2]!.textContent).toMatch(/^Visit with Dr\. Lark.+\d:\d\d [AP]M$/);

    // A second tap closes it.
    await userEvent.click(toggle());
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(list()!.hidden).toBe(true);
    expect(items()).toHaveLength(0);

    // Open again: See all goes to Upcoming.
    await userEvent.click(toggle());
    await waitUntil(() => items().length === 5, 4000, "the list again");
    await userEvent.click(page.getByRole("link", { name: "See all" }).last());
    await expect.element(page.getByRole("heading", { name: "Upcoming page" })).toBeVisible();
    expect(device.location()).toBe(appUrls.upcoming(TEST_GROUP.id));
  });

  test("a tap on an item opens its page: an entry's, or a task's", async () => {
    const device = await open("caretaker", SEVEN);
    await userEvent.click(toggle());
    await waitUntil(() => items().length === 5, 4000, "the list");
    await userEvent.click(itemLink("Visit with Dr. Lark"));
    await expect.element(page.getByRole("heading", { name: "Entry page" })).toBeVisible();
    expect(device.location()).toBe(appUrls.entry(TEST_GROUP.id, VISIT.id));
  });

  test("a task in the list opens the task's page", async () => {
    const device = await open("viewer", SEVEN);
    await userEvent.click(toggle());
    await waitUntil(() => items().length === 5, 4000, "the list");
    await userEvent.click(itemLink("Fax the form"));
    await expect.element(page.getByRole("heading", { name: "Task page" })).toBeVisible();
    expect(device.location()).toBe(appUrls.task(TEST_GROUP.id, FAX.id));
  });

  test("with one upcoming item: that item, then See all", async () => {
    await open("caretaker", [VISIT]);
    await userEvent.click(toggle());
    await waitUntil(() => items().length > 0, 4000, "the list");
    expect(titles()).toEqual(["Visit with Dr. Lark"]);
    expect(list()!.querySelector("[data-simple-upcoming-all]")?.textContent).toBe("See all");
  });
});
