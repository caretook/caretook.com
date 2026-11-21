import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture, GroupRole } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTodoUndo } from "~/lib/todos/todoUndo";
import * as timeline from "./route";
import { waitUntil } from "./timelineWorld";

// Simple mode's "My todos" card (todos slice 6), on the test device
// (offline): my open todos, overdue and today first, at most five with "See
// all", big ticks with Undo, for writers and viewers; nothing when I have
// none; the simple view's other regions as they were.

const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/timeline", module: timeline }];
const URL = `/app/groups/${TEST_GROUP.id}/timeline`;

const today = localDate(new Date(), TEST_TIME_ZONE);
const day = (n: number) => addDays(today, n);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const mine = (title: string, v: Parameters<typeof todo>[0] = {}) =>
  todo({ title, assigneeId: TEST_USER.id, ...v });

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
  todo({ title: "Book the eye exam", dueOn: day(-3), assigneeId: SAM_ID }),
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

const card = () => document.querySelector<HTMLElement>("[data-simple-todos]");
const titles = () =>
  [...(card()?.querySelectorAll("[data-simple-todo] [data-todo-title]") ?? [])].map((el) =>
    el.textContent?.trim(),
  );
const seeAll = () => card()?.querySelector<HTMLAnchorElement>("[data-simple-todos-all]") ?? null;
const follows = (a: Element | null, b: Element | null) =>
  !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

afterEach(() => clearTodoUndo());

describe("My todos in simple mode", () => {
  test("a writer: mine only, overdue and today first, five at most, See all to Mine; between Upcoming and the tiles", async () => {
    await open("caretaker", MANY);
    await waitUntil(() => titles().length === 5, 4000, "the card's todos");
    await expect.element(page.getByRole("region", { name: "My todos" })).toBeVisible();
    expect(titles()).toEqual([
      "Call the pharmacy",
      "Water the plants",
      "Pick up the walker",
      "Drive to physio",
      "Fax the form",
    ]);
    const states = [...card()!.querySelectorAll<HTMLElement>("[data-simple-todo]")].map(
      (li) => li.dataset.todoState,
    );
    expect(states).toEqual(["overdue", "overdue", "today", "upcoming", "upcoming"]);
    await expect.poll(() => card()?.querySelector("[data-todo-due]")?.textContent).toBe("Overdue · 2 days");
    expect(seeAll()?.textContent).toBe("See all 7 todos");
    expect(seeAll()?.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/todos?who=mine`);
    // Big ticks, one per todo.
    const ticks = card()!.querySelectorAll<HTMLInputElement>("[data-todo-tick]");
    expect(ticks).toHaveLength(5);
    expect(ticks[0]!.classList.contains("checkbox-xl")).toBe(true);

    // The other regions are where they were: Upcoming, then the card, the tiles, Remove, the box, the rows.
    // They can render after the card on a loaded machine (the tiles replace their skeleton
    // when their own query answers): wait for all of them first.
    const REGIONS = ["[data-quick-entry]", "[data-simple-now]", "[data-simple-tiles]", "[data-remove-last]"];
    await waitUntil(
      () => REGIONS.every((r) => !!document.querySelector(r)),
      4000,
      "the simple view's regions",
    );
    const box = document.querySelector("[data-quick-entry]");
    const now = document.querySelector("[data-simple-now]");
    const tiles = document.querySelector("[data-simple-tiles]");
    expect(follows(now, card())).toBe(true);
    expect(follows(card(), tiles)).toBe(true);
    expect(follows(tiles, document.querySelector("[data-remove-last]"))).toBe(true);
    expect(follows(document.querySelector("[data-remove-last]"), box)).toBe(true);
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
    expect(card()!.contains(document.querySelector("[data-todo-undo]"))).toBe(true);
    const done = await device.query<{ done_by: string | null }>("SELECT done_by FROM todo");
    expect(done).toEqual([{ done_by: TEST_USER.id }]);

    await userEvent.click(page.getByRole("button", { name: "Undo Pick up the walker" }));
    await expect.poll(() => titles()).toEqual(["Pick up the walker"]);
    expect(document.querySelector("[data-todo-undo]")).toBeNull();
  });

  test("two ticks each keep their own Undo; undoing the first reopens only it", async () => {
    const device = await open("caretaker", [
      mine("Pick up the walker", { dueOn: today }),
      mine("Water the plants", { dueOn: day(-1) }),
    ]);
    await waitUntil(() => titles().length === 2, 4000, "the card's todos");
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Water the plants” done" }));
    await expect.poll(() => titles()).toEqual(["Pick up the walker"]);
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Pick up the walker” done" }));
    await expect.poll(() => titles()).toEqual([]);

    const lines = () =>
      [...(card()?.querySelectorAll("[data-todo-undo] [data-todo-undo-label]") ?? [])].map(
        (el) => el.textContent,
      );
    await expect.poll(lines).toEqual(["Done: Pick up the walker", "Done: Water the plants"]);
    await expect.element(page.getByRole("button", { name: "Undo Pick up the walker" })).toBeVisible();

    await userEvent.click(page.getByRole("button", { name: "Undo Water the plants" }));
    await expect.poll(() => titles()).toEqual(["Water the plants"]);
    await expect.poll(lines).toEqual(["Done: Pick up the walker"]);
    const rows = await device.query<{ title: string; done: number }>(
      "SELECT title, done_at IS NOT NULL AS done FROM todo ORDER BY title",
    );
    expect(rows).toEqual([
      { title: "Pick up the walker", done: 1 },
      { title: "Water the plants", done: 0 },
    ]);
  });

  test("a viewer: the card too, and ticking their own todo is a done-only change", async () => {
    const device = await open("viewer", [
      SAM,
      mine("Pick up groceries", { dueOn: today }),
      todo({ title: "Fax the form", dueOn: today, assigneeId: SAM_ID }),
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
    await userEvent.click(page.getByRole("button", { name: "Undo Pick up groceries" }));
    await expect.poll(() => titles()).toEqual(["Pick up groceries"]);
  });

  test("none of mine open: no card, and the rest of the view as before", async () => {
    await open("caretaker", [
      SAM,
      todo({ title: "Fax the form", dueOn: today, assigneeId: SAM_ID }),
      todo({ title: "Sort the batteries" }),
      mine("Return the library book", { doneAt: at(new Date(Date.now() - 60_000)), doneBy: TEST_USER.id }),
    ]);
    await waitUntil(() => !!document.querySelector("[data-simple-tiles]"), 4000, "the simple view");
    await expect.element(page.getByText("Slept well after lunch")).toBeVisible();
    expect(card()).toBeNull();
    expect(page.getByRole("region", { name: "My todos" }).query()).toBeNull();
    expect(document.querySelector("[data-quick-entry]")).not.toBeNull();
    expect(document.querySelector("[data-remove-last]")).not.toBeNull();
  });
});
