import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture, GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTodoUndo } from "~/lib/todos/todoUndo";
import * as timeline from "./route";
import { chooseEasyMode } from "./timelineWorld";
import { waitUntil } from "../../../../../test/found";
import { addDays, localDate } from "@caretook/data/domain";

// Easy mode's "My todos" card (todos slice 6), on the test device
// (offline): my open todos as trees in the shared row's easy look
// (todo-subtasks-3), overdue and today first, at most five with "See all",
// big ticks with Undo, for writers and viewers; a step of mine under its
// dimmed parent; nothing when I have none; the easy view's other regions as
// they were.

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

const open = (role: GroupRole, fixtures: Fixture[]) => {
  chooseEasyMode();
  return renderWithDevice({
    route: ROUTES,
    url: URL,
    role: null,
    fixtures: [
      fx.member({ userId: TEST_USER.id, role }),
      fx.note({ occurredAt: at(new Date(Date.now() - 10 * 60_000)), text: "Slept well after lunch" }),
      ...fixtures,
    ],
  });
};

const card = () => document.querySelector<HTMLElement>("[data-easy-todos]");
const titles = () =>
  [...(card()?.querySelectorAll("[data-todo-look=easy] [data-todo-title]") ?? [])].map((el) =>
    el.textContent?.trim(),
  );
const seeAll = () => card()?.querySelector<HTMLAnchorElement>("[data-easy-todos-all]") ?? null;
const follows = (a: Element | null, b: Element | null) =>
  !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

afterEach(() => clearTodoUndo());

describe("My todos in easy mode", () => {
  test("a writer: mine only, overdue and today first, five at most, See all to Mine; between Upcoming and the tiles", async () => {
    await open("caretaker", MANY);
    await waitUntil(() => titles().length === 5, "the card's todos");
    await expect.element(page.getByRole("region", { name: "My todos" })).toBeVisible();
    expect(titles()).toEqual([
      "Call the pharmacy",
      "Water the plants",
      "Pick up the walker",
      "Drive to physio",
      "Fax the form",
    ]);
    const states = [...card()!.querySelectorAll<HTMLElement>("[data-todo-look=easy]")].map(
      (li) => li.dataset.todoState,
    );
    expect(states).toEqual(["overdue", "overdue", "today", "upcoming", "upcoming"]);
    await expect.poll(() => card()?.querySelector("[data-todo-due]")?.textContent).toBe("Overdue · 2 days");
    expect(seeAll()?.textContent).toBe("See all 7 todos");
    expect(seeAll()?.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/todos?who=mine`);
    // Big ticks, one per todo.
    const ticks = card()!.querySelectorAll<HTMLInputElement>("[data-todo-tick]");
    expect(ticks).toHaveLength(5);
    expect(ticks[0]?.getBoundingClientRect().width ?? 0).toBeGreaterThanOrEqual(32);

    // The other regions are where they were: Upcoming, then the card, the tiles, Remove, the box, the rows.
    // They can render after the card on a loaded machine (the tiles replace their skeleton
    // when their own query answers): wait for all of them first.
    const REGIONS = ["[data-quick-entry]", "[data-easy-now]", "[data-easy-tiles]", "[data-remove-last]"];
    await waitUntil(() => REGIONS.every((r) => !!document.querySelector(r)), "the easy view's regions");
    const box = document.querySelector("[data-quick-entry]");
    const now = document.querySelector("[data-easy-now]");
    const tiles = document.querySelector("[data-easy-tiles]");
    expect(follows(now, card())).toBe(true);
    expect(follows(card(), tiles)).toBe(true);
    expect(follows(tiles, document.querySelector("[data-remove-last]"))).toBe(true);
    expect(follows(document.querySelector("[data-remove-last]"), box)).toBe(true);
    await expect.element(page.getByText("Slept well after lunch")).toBeVisible();
    // The card isn't a tile.
    expect(tiles?.contains(card())).toBe(false);
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
    expect(card()?.contains(document.querySelector("[data-todo-undo]"))).toBe(true);
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
    await waitUntil(() => titles().length === 2, "the card's todos");
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

  test.each(["viewer", "easy_viewer", "easy_helper"] as const)(
    "a %s: the card too, and ticking their own todo is a done-only change",
    async (role) => {
      const device = await open(role, [
        SAM,
        mine("Pick up groceries", { dueOn: today }),
        todo({ title: "Fax the form", dueOn: today, assigneeId: SAM_ID }),
      ]);
      await waitUntil(() => titles().length === 1, "the viewer's card");
      expect(titles()).toEqual(["Pick up groceries"]);
      // No box or tiles for viewers (an Easy helper has both); the card is still there.
      const inputs = role === "easy_helper";
      await expect.poll(() => !!document.querySelector("[data-quick-entry]")).toBe(inputs);
      await expect.poll(() => !!document.querySelector("[data-easy-tiles]")).toBe(inputs);

      await userEvent.click(page.getByRole("checkbox", { name: "Mark “Pick up groceries” done" }));
      await expect
        .element(page.getByRole("status").filter({ hasText: "Done: Pick up groceries" }))
        .toBeInTheDocument();
      const patch = (await device.queued()).find((w) => w.op === "PATCH");
      expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);
      // The card can still show the todo before its query catches up: wait for
      // it to go, so the title coming back below is the Undo's write landing
      // (and the test doesn't end, closing the database, mid-write: B-475).
      await expect.poll(() => titles()).toEqual([]);
      await userEvent.click(page.getByRole("button", { name: "Undo Pick up groceries" }));
      await expect.poll(() => titles()).toEqual(["Pick up groceries"]);
      // The undo's write lands before the test ends (the title shows before it does).
      await expect
        .poll(async () => {
          const [row] = await device.query<{ done_at: string | null }>(
            "SELECT done_at FROM todo WHERE title = 'Pick up groceries'",
          );
          return row?.done_at;
        })
        .toBeNull();
      await device.settle();
    },
  );

  test("an Easy helper: their assigned step under its dimmed parent with the big tick, and they tick it with Undo; their parent waits on its subtasks (todo-subtasks-3)", async () => {
    const BIRTHDAY = "5b2e8c10-4d7a-4f1e-9c3b-1a6f0e2e0001";
    const READY = "5b2e8c10-4d7a-4f1e-9c3b-1a6f0e2e0002";
    const device = await open("easy_helper", [
      SAM,
      todo({ id: BIRTHDAY, title: "Plan the birthday" }),
      mine("Order the cake", { parentId: BIRTHDAY }),
      todo({ title: "Send the invites", parentId: BIRTHDAY }),
      mine("Get ready for the hospital stay", { id: READY, dueOn: day(5) }),
      todo({ title: "Pack the bag", parentId: READY, assigneeId: SAM_ID }),
    ]);
    // Mine whole (its step that isn't mine too), then my step's branch; not my step's sibling.
    await waitUntil(() => titles().length === 3, "the helper's card");
    expect(titles()).toEqual(["Get ready for the hospital stay", "Pack the bag", "Order the cake"]);
    expect(card()?.textContent).not.toContain("Send the invites");

    const parent = card()!.querySelector<HTMLElement>(`[data-todo="${BIRTHDAY}"]`)!;
    expect(parent.dataset.todoLook).toBe("context");
    expect(parent.className).toContain("opacity-60");
    expect(parent.querySelector("input")).toBeNull();
    expect(parent.querySelector("a")?.getAttribute("href")).toBe(
      `/app/groups/${TEST_GROUP.id}/todos/${BIRTHDAY}`,
    );
    // The step sits under it, in its list item, with the big tick.
    const cakeTick = page.getByRole("checkbox", { name: "Mark “Order the cake” done" });
    await expect.element(cakeTick).toBeInTheDocument();
    expect(parent.closest("li")?.contains(cakeTick.element())).toBe(true);
    expect(cakeTick.element().getBoundingClientRect().width).toBeGreaterThanOrEqual(32);

    const readyRow = card()!.querySelector(`[data-todo="${READY}"]`);
    await expect.poll(() => readyRow?.querySelector("[data-todo-progress]")?.textContent).toBe("0 of 1 done");
    await expect
      .element(
        page.getByRole("checkbox", { name: "“Get ready for the hospital stay”: 0 of 1 subtasks done" }),
      )
      .toBeDisabled();

    await userEvent.click(cakeTick);
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Order the cake" }))
      .toBeInTheDocument();
    await expect.poll(() => titles()).toEqual(["Get ready for the hospital stay", "Pack the bag"]);
    expect(card()?.querySelector(`[data-todo="${BIRTHDAY}"]`)).toBeNull();
    const [cake] = await device.query<{ done_by: string | null }>(
      "SELECT done_by FROM todo WHERE title = 'Order the cake'",
    );
    expect(cake?.done_by).toBe(TEST_USER.id);

    await userEvent.click(page.getByRole("button", { name: "Undo Order the cake" }));
    await expect
      .poll(() => titles())
      .toEqual(["Get ready for the hospital stay", "Pack the bag", "Order the cake"]);
    await expect
      .poll(async () => {
        const [row] = await device.query<{ done_at: string | null }>(
          "SELECT done_at FROM todo WHERE title = 'Order the cake'",
        );
        return row?.done_at;
      })
      .toBeNull();
    await device.settle();
  });

  test("the cap counts my todos, not rows, and never cuts a tree", async () => {
    const TRIP = "5b2e8c10-4d7a-4f1e-9c3b-1a6f0e2e0003";
    await open("caretaker", [
      mine("Plan the trip", { id: TRIP, dueOn: day(-1) }),
      mine("Book the van", { parentId: TRIP }),
      mine("Pack the meds", { parentId: TRIP }),
      mine("Call the pharmacy", { dueOn: today }),
      mine("Fax the form", { dueOn: day(1) }),
      mine("Drive to physio", { dueOn: day(2) }),
    ]);
    // The trip's three, then two more: five of mine; the last waits for See all.
    await waitUntil(() => titles().length === 5, "the card's todos");
    // (The steps' own order is siblingOrder's, not this test's.)
    const shown = titles();
    expect(shown[0]).toBe("Plan the trip");
    expect(shown.slice(1, 3).sort()).toEqual(["Book the van", "Pack the meds"]);
    expect(shown.slice(3)).toEqual(["Call the pharmacy", "Fax the form"]);
    expect(seeAll()?.textContent).toBe("See all 6 todos");
  });

  test("none of mine open: no card, and the rest of the view as before", async () => {
    await open("caretaker", [
      SAM,
      todo({ title: "Fax the form", dueOn: today, assigneeId: SAM_ID }),
      todo({ title: "Sort the batteries" }),
      mine("Return the library book", { doneAt: at(new Date(Date.now() - 60_000)), doneBy: TEST_USER.id }),
    ]);
    await waitUntil(() => !!document.querySelector("[data-easy-tiles]"), "the easy view");
    await expect.element(page.getByText("Slept well after lunch")).toBeVisible();
    expect(card()).toBeNull();
    expect(page.getByRole("region", { name: "My todos" }).query()).toBeNull();
    expect(document.querySelector("[data-quick-entry]")).not.toBeNull();
    expect(document.querySelector("[data-remove-last]")).not.toBeNull();
  });
});
