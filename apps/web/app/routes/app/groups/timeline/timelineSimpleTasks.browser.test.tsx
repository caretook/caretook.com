import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture, GroupRole } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, task, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTaskUndo } from "~/lib/tasks/taskUndo";
import * as timeline from "./route";
import { waitUntil } from "./timelineWorld";

// Simple mode's "My tasks" card (tasks slice 6), on the test device
// (offline): my open tasks, overdue and today first, at most five with "See
// all", big ticks with Undo, for writers and viewers; nothing when I have
// none; the simple view's other regions as they were.

const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/timeline", module: timeline }];
const URL = `/app/groups/${TEST_GROUP.id}/timeline`;

const today = localDate(new Date(), TEST_TIME_ZONE);
const day = (n: number) => addDays(today, n);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const mine = (title: string, v: Parameters<typeof task>[0] = {}) =>
  task({ title, assigneeId: TEST_USER.id, ...v });

/** Seven of mine (given out of order), one of Sam's and one of mine already done. */
const MANY = [
  SAM,
  mine("Sort the batteries", { createdAt: hoursAgo(5) }),
  mine("Fax the form", { dueOn: day(3) }),
  mine("Pick up the walker", { dueOn: today }),
  mine("Label the pill box", { createdAt: hoursAgo(2) }),
  mine("Call the pharmacy", { dueOn: day(-2) }),
  mine("Drive to physio", { dueOn: day(1) }),
  mine("Water the plants", { dueOn: day(-1) }),
  task({ title: "Book the eye exam", dueOn: day(-3), assigneeId: SAM_ID }),
  mine("Return the library book", { doneAt: at(new Date(Date.now() - 60_000)), doneBy: TEST_USER.id }),
];

const open = (role: GroupRole, fixtures: Fixture[]) =>
  renderWithDevice({
    route: ROUTES,
    url: URL,
    role: null,
    fixtures: [
      fx.member({ userId: TEST_USER.id, role, simpleMode: 1 }),
      fx.note({ occurredAt: at(new Date(Date.now() - 10 * 60_000)), text: "Slept well after lunch" }),
      ...fixtures,
    ],
  });

const card = () => document.querySelector<HTMLElement>("[data-simple-tasks]");
const titles = () =>
  [...(card()?.querySelectorAll("[data-simple-task] [data-task-title]") ?? [])].map((el) =>
    el.textContent?.trim(),
  );
const seeAll = () => card()?.querySelector<HTMLAnchorElement>("[data-simple-tasks-all]") ?? null;
const follows = (a: Element | null, b: Element | null) =>
  !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

afterEach(() => clearTaskUndo());

describe("My tasks in simple mode", () => {
  test("a writer: mine only, overdue and today first, five at most, See all to Mine; between Now and the tiles", async () => {
    await open("caretaker", MANY);
    await waitUntil(() => titles().length === 5, 4000, "the card's tasks");
    await expect.element(page.getByRole("region", { name: "My tasks" })).toBeVisible();
    expect(titles()).toEqual([
      "Call the pharmacy",
      "Water the plants",
      "Pick up the walker",
      "Drive to physio",
      "Fax the form",
    ]);
    const states = [...card()!.querySelectorAll<HTMLElement>("[data-simple-task]")].map(
      (li) => li.dataset.taskState,
    );
    expect(states).toEqual(["overdue", "overdue", "today", "upcoming", "upcoming"]);
    expect(card()!.querySelector("[data-task-due]")?.textContent).toBe("Overdue · 2 days");
    expect(seeAll()?.textContent).toBe("See all 7 tasks");
    expect(seeAll()?.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/tasks?who=mine`);
    // Big ticks, one per task.
    const ticks = card()!.querySelectorAll<HTMLInputElement>("[data-task-tick]");
    expect(ticks).toHaveLength(5);
    expect(ticks[0]!.classList.contains("checkbox-xl")).toBe(true);

    // The other regions are where they were: box, Now, then the card, the tiles, Remove, the rows.
    // They can render after the card on a loaded machine: wait for them first.
    const REGIONS = ["[data-quick-entry]", "[data-simple-now]", "[data-simple-tiles]", "[data-remove-last]"];
    await waitUntil(
      () => REGIONS.every((r) => !!document.querySelector(r)),
      4000,
      "the simple view's regions",
    );
    const box = document.querySelector("[data-quick-entry]");
    const now = document.querySelector("[data-simple-now]");
    const tiles = document.querySelector("[data-simple-tiles]");
    expect(follows(box, now)).toBe(true);
    expect(follows(now, card())).toBe(true);
    expect(follows(card(), tiles)).toBe(true);
    expect(follows(tiles, document.querySelector("[data-remove-last]"))).toBe(true);
    await expect.element(page.getByText("Slept well after lunch")).toBeVisible();
    // The card isn't a tile.
    expect(tiles!.contains(card())).toBe(false);
  });

  test("a writer: a tick completes it with Undo, even for the last one; Undo brings it back", async () => {
    const device = await open("owner", [mine("Pick up the walker", { dueOn: today })]);
    const tick = page.getByRole("checkbox", { name: "Mark “Pick up the walker” done" });
    await expect.element(tick).toBeInTheDocument();
    expect(seeAll()?.textContent).toBe("See all");
    await userEvent.click(tick);

    const status = page.getByRole("status").filter({ hasText: "Done: Pick up the walker" });
    await expect.element(status).toBeInTheDocument();
    await expect.poll(() => titles()).toEqual([]);
    // The card stays up while Undo is offered.
    expect(card()!.contains(document.querySelector("[data-task-undo]"))).toBe(true);
    const done = await device.query<{ done_by: string | null }>("SELECT done_by FROM task");
    expect(done).toEqual([{ done_by: TEST_USER.id }]);

    await userEvent.click(page.getByRole("button", { name: "Undo" }));
    await expect.poll(() => titles()).toEqual(["Pick up the walker"]);
    expect(document.querySelector("[data-task-undo]")).toBeNull();
  });

  test("a viewer: the card too, and ticking their own task is a done-only change", async () => {
    const device = await open("viewer", [
      SAM,
      mine("Pick up groceries", { dueOn: today }),
      task({ title: "Fax the form", dueOn: today, assigneeId: SAM_ID }),
    ]);
    await waitUntil(() => titles().length === 1, 4000, "the viewer's card");
    expect(titles()).toEqual(["Pick up groceries"]);
    // No box or tiles for viewers; the card is still there.
    expect(document.querySelector("[data-quick-entry]")).toBeNull();
    expect(document.querySelector("[data-simple-tiles]")).toBeNull();

    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Pick up groceries” done" }));
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Pick up groceries" }))
      .toBeInTheDocument();
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);
    await userEvent.click(page.getByRole("button", { name: "Undo" }));
    await expect.poll(() => titles()).toEqual(["Pick up groceries"]);
  });

  test("none of mine open: no card, and the rest of the view as before", async () => {
    await open("caretaker", [
      SAM,
      task({ title: "Fax the form", dueOn: today, assigneeId: SAM_ID }),
      task({ title: "Sort the batteries" }),
      mine("Return the library book", { doneAt: at(new Date(Date.now() - 60_000)), doneBy: TEST_USER.id }),
    ]);
    await waitUntil(() => !!document.querySelector("[data-simple-tiles]"), 4000, "the simple view");
    await expect.element(page.getByText("Slept well after lunch")).toBeVisible();
    expect(card()).toBeNull();
    expect(page.getByRole("region", { name: "My tasks" }).query()).toBeNull();
    expect(document.querySelector("[data-quick-entry]")).not.toBeNull();
    expect(document.querySelector("[data-remove-last]")).not.toBeNull();
  });
});
