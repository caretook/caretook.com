import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as todosRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { appUrls } from "~/lib/app-shell/appUrls";
import { clearTodoUndo } from "~/lib/todos/todoUndo";
import { addDays, localDate } from "@caretook/data/domain";

// The Todos tab shows trees (todo-subtasks-3 slice 5): a subtask only inside
// its tree, indented, a done one struck in place (and not in Done); a parent
// with "n of m done" and a tick that waits on its subtasks; a filter's match
// under its parent as a context row; a writer's quick add on every row, a
// viewer's none; no "Part of" row. Done is trees too (B-1016), paged by tree. The seed's "Get ready for the hospital
// stay", in fictional form.

const LIST = `/app/groups/${TEST_GROUP.id}/todos`;
const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/todos", module: todosRoute }];

const today = localDate(new Date(), TEST_TIME_ZONE);
const tomorrow = addDays(today, 1);

const id = (n: number) => `5b2e8c10-4d7a-4f1e-9c3b-1a6f0e2d${String(n).padStart(4, "0")}`;
const PARENT = id(1);

const world = () => [
  todo({ id: PARENT, title: "Get ready for the hospital stay", dueOn: addDays(today, 5) }),
  todo({ id: id(2), title: "Pack the bag", parentId: PARENT }),
  todo({ id: id(3), title: "Arrange the dog sitter", parentId: PARENT, dueOn: tomorrow }),
  todo({
    id: id(4),
    title: "Print the medication list",
    parentId: PARENT,
    doneAt: at(new Date(Date.now() - 60_000)),
    doneBy: TEST_USER.id,
  }),
  todo({
    id: id(5),
    title: "Book the eye exam",
    createdAt: hoursAgo(1),
    doneAt: at(new Date(Date.now() - 120_000)),
    doneBy: TEST_USER.id,
  }),
  todo({ id: id(6), title: "Plan the birthday" }),
  todo({ id: id(7), title: "Order the cake", parentId: id(6), assigneeId: TEST_USER.id }),
];

const open = (role: GroupRole = "owner", url = LIST) =>
  renderWithDevice({ route: ROUTES, url, role, fixtures: world() });

const titles = (selector: string) =>
  [...document.querySelectorAll(`${selector} [data-todo-title]`)].map((el) => el.textContent?.trim());
const rowOf = (todoId: string) => document.querySelector(`[data-todo="${todoId}"]`);
const titleOf = (todoId: string) => rowOf(todoId)?.querySelector("[data-todo-title]");
const left = (todoId: string) => titleOf(todoId)?.getBoundingClientRect().left ?? Number.NaN;
const OPEN_SECTIONS = "[data-todo-section]:not([data-todo-section=done])";

afterEach(() => clearTodoUndo());

describe("the Todos tab's trees", () => {
  test("a tree shows its children indented under it, a done one struck, under its most urgent step's day; no subtask on a row of its own", async () => {
    await open();
    await expect.element(page.getByText("1 of 3 done")).toBeVisible();

    // The tree goes under its dated step's day (tomorrow), children in siblingOrder.
    expect(titles(`[data-todo-section="${tomorrow}"]`)).toEqual([
      "Get ready for the hospital stay",
      "Arrange the dog sitter",
      "Pack the bag",
      "Print the medication list",
    ]);
    expect(titles('[data-todo-section="undated"]')).toEqual(["Plan the birthday", "Order the cake"]);
    for (const child of [id(2), id(3), id(4)]) expect(left(child)).toBeGreaterThan(left(PARENT));
    expect(left(id(7))).toBeGreaterThan(left(id(6)));
    expect(titleOf(id(4))?.classList.contains("line-through")).toBe(true);
    expect(titleOf(id(2))?.classList.contains("line-through")).toBe(false);
    // Each todo is there once, and no row says "Part of".
    expect(document.querySelectorAll(`[data-todo="${id(3)}"]`)).toHaveLength(1);
    expect(document.querySelector("[data-todo-part-of]")).toBeNull();

    expect(rowOf(PARENT)?.querySelector("[data-todo-progress]")?.textContent).toBe("1 of 3 done");
    const parentTick = page.getByRole("checkbox", {
      name: "“Get ready for the hospital stay”: 1 of 3 subtasks done",
    });
    await expect.element(parentTick).toBeDisabled();
    // The row's mark says it; the tick shows no second count.
    expect(rowOf(PARENT)?.querySelector("[data-tick-progress]")).toBeNull();

    // The done subtask of an open tree is struck in its tree, not in Done.
    expect(titles('[data-todo-section="done"]')).toEqual(["Book the eye exam"]);
    expect(document.querySelector('[data-todo-section="done"] [data-done-more]')).toBeNull();
  });

  test("Mine shows viewer@'s subtask under its parent, a dimmed context row; they may tick it, and see no +", async () => {
    await open("viewer", `${LIST}?who=mine`);
    await expect.element(page.getByText("Order the cake")).toBeVisible();

    expect(titles(OPEN_SECTIONS)).toEqual(["Plan the birthday", "Order the cake"]);
    expect(rowOf(id(6))?.getAttribute("data-todo-look")).toBe("context");
    expect(rowOf(id(7))?.getAttribute("data-todo-look")).toBe("list");
    expect(left(id(7))).toBeGreaterThan(left(id(6)));
    expect(document.querySelector("[data-todo-part-of]")).toBeNull();
    await expect.element(page.getByRole("checkbox", { name: "Mark “Order the cake” done" })).toBeEnabled();
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
  });

  test("a viewer sees no + on any row", async () => {
    await open("viewer");
    await expect.element(page.getByText("Get ready for the hospital stay")).toBeVisible();
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
    await expect.element(page.getByRole("button", { name: /^Add subtask to/ })).not.toBeInTheDocument();
  });

  test("a writer adds two children from a row with Enter; they land in its tree, in order", async () => {
    await open();
    const opener = page.getByRole("button", { name: "Add subtask to Plan the birthday" });
    await expect.element(opener).toBeVisible();
    // Every open row of a writer's list has its own quick add.
    expect(
      page.getByRole("button", { name: "Add subtask to Get ready for the hospital stay" }).elements(),
    ).toHaveLength(1);

    await userEvent.click(opener);
    const field = page.getByRole("textbox", { name: "New subtask" });
    await expect.element(field).toHaveFocus();
    await userEvent.keyboard("Buy the candles{Enter}");
    await expect.element(page.getByRole("link", { name: "Buy the candles" })).toBeVisible();
    await expect.element(field).toHaveFocus();
    await userEvent.keyboard("Send the invites{Enter}");
    await expect.element(page.getByRole("link", { name: "Send the invites" })).toBeVisible();

    expect(titles('[data-todo-section="undated"]')).toEqual([
      "Plan the birthday",
      "Order the cake",
      "Buy the candles",
      "Send the invites",
    ]);
  });
});

describe("the Todos tab's Done trees", () => {
  const MOVE = id(20);
  const ago = (minutes: number) => at(new Date(Date.now() - minutes * 60_000));
  const doneWorld = () => [
    ...world(),
    todo({ id: MOVE, title: "Move into the new room", doneAt: ago(10), doneBy: TEST_USER.id }),
    todo({ id: id(21), title: "Pack the books", parentId: MOVE, doneAt: ago(20), doneBy: TEST_USER.id }),
    todo({ id: id(22), title: "Label the boxes", parentId: MOVE, doneAt: ago(15), doneBy: TEST_USER.id }),
    todo({ id: id(23), title: "Tape the lids", parentId: id(22), doneAt: ago(16), doneBy: TEST_USER.id }),
    // Twenty older done todos: with the two trees above, Done has a second page.
    ...Array.from({ length: 20 }, (_, n) =>
      todo({ id: id(30 + n), title: `Old chore ${n + 1}`, doneAt: ago(60 + n), doneBy: TEST_USER.id }),
    ),
  ];
  const DONE = '[data-todo-section="done"]';
  const doneTops = () =>
    [...document.querySelectorAll(`${DONE} > [data-todo-tree] > li`)].map((li) =>
      li.querySelector("[data-todo]")?.getAttribute("data-todo"),
    );
  /** A row's `<li>`: its subtasks' list is inside it, after the row. */
  const itemOf = (todoId: string) => rowOf(todoId)?.closest("li");

  test("a done parent shows its done subtasks nested under it, the open tree's markup; Show more adds the next trees", async () => {
    await renderWithDevice({ route: ROUTES, url: LIST, role: "owner", fixtures: doneWorld() });
    await expect.element(page.getByText("Move into the new room")).toBeVisible();

    // One tree: the subtasks are rows inside the parent's row, a level down, indented.
    const move = itemOf(MOVE);
    expect(move?.closest(DONE)).not.toBeNull();
    expect(move?.querySelector(`:scope [data-todo-level="2"] [data-todo="${id(21)}"]`)).not.toBeNull();
    expect(move?.querySelector(`:scope [data-todo-level="2"] [data-todo="${id(22)}"]`)).not.toBeNull();
    expect(
      itemOf(id(22))?.querySelector(`:scope [data-todo-level="3"] [data-todo="${id(23)}"]`),
    ).not.toBeNull();
    for (const child of [id(21), id(22)]) expect(left(child)).toBeGreaterThan(left(MOVE));
    expect(left(id(23))).toBeGreaterThan(left(id(22)));
    expect(rowOf(MOVE)?.getAttribute("data-todo-look")).toBe("list");
    for (const child of [id(21), id(22), id(23)]) {
      expect(document.querySelectorAll(`[data-todo="${child}"]`)).toHaveLength(1);
      expect(titleOf(child)?.classList.contains("line-through")).toBe(true);
    }
    // Unticking reopens, as on any done row.
    await expect.element(page.getByRole("checkbox", { name: "Reopen “Pack the books”" })).toBeEnabled();

    // Newest completion first, a page of 20 whole trees.
    const first = doneTops();
    expect(first.slice(0, 2)).toEqual([id(5), MOVE]);
    expect(first).toHaveLength(20);
    expect(first).not.toContain(id(48));

    await userEvent.click(page.getByRole("button", { name: "Show more" }));
    await expect.poll(() => doneTops()).toHaveLength(22);
    expect(doneTops().slice(-2)).toEqual([id(48), id(49)]);
    await expect.element(page.getByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });
});

// Subtasks on their own (todo-links-2 slice 1): `?subtasks=own` lists each
// open todo as its own row under its own due, with "Part of" linking up, and
// a done step of an open tree in Done.
describe("the Todos tab with subtasks on their own", () => {
  const filterButton = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
  const chips = () =>
    [...document.querySelectorAll('main nav[aria-label="Filters on"] a')].map((a) => a.textContent?.trim());

  test("a subtask is its own row in its own section, Part of its parent; its tick works with Undo; a done step is in Done", async () => {
    await open("owner", `${LIST}?subtasks=own`);
    await expect.element(page.getByText("Arrange the dog sitter")).toBeVisible();

    expect(titles(`[data-todo-section="${tomorrow}"]`)).toEqual(["Arrange the dog sitter"]);
    expect(titles(`[data-todo-section="${addDays(today, 5)}"]`)).toEqual(["Get ready for the hospital stay"]);
    // Undated ones go newest first (`todoOrder`); the world's are made the same moment.
    expect(titles('[data-todo-section="undated"]').sort()).toEqual([
      "Order the cake",
      "Pack the bag",
      "Plan the birthday",
    ]);
    // No tree: every row is the top level, none indented under another.
    expect(document.querySelector('[data-todo-level="2"]')).toBeNull();
    expect(left(id(3))).toBe(left(PARENT));

    const partOf = rowOf(id(3))?.querySelector("[data-todo-part-of]");
    expect(partOf?.textContent).toBe("Part of Get ready for the hospital stay");
    expect(partOf?.querySelector("a")?.getAttribute("href")).toBe(appUrls.todo(TEST_GROUP.id, PARENT));
    expect(rowOf(PARENT)?.querySelector("[data-todo-part-of]")).toBeNull();
    // The parent keeps its progress and its waiting tick.
    expect(rowOf(PARENT)?.querySelector("[data-todo-progress]")?.textContent).toBe("1 of 3 done");

    // Done lists the done step of the open tree too, with its Part of.
    expect(titles('[data-todo-section="done"]')).toEqual(["Print the medication list", "Book the eye exam"]);
    expect(rowOf(id(4))?.querySelector("[data-todo-part-of]")?.textContent).toBe(
      "Part of Get ready for the hospital stay",
    );

    // The chip says the view is on.
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    await expect.poll(() => chips()).toEqual(["Subtasks on their own"]);

    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Arrange the dog sitter” done" }));
    await expect.poll(() => titles(`[data-todo-section="${tomorrow}"]`)).toEqual([]);
    await expect.poll(() => titles('[data-todo-section="done"]')).toContain("Arrange the dog sitter");
    await userEvent.click(page.getByRole("button", { name: "Undo Arrange the dog sitter" }));
    await expect.poll(() => titles(`[data-todo-section="${tomorrow}"]`)).toEqual(["Arrange the dog sitter"]);
  });

  test("choosing On their own in the Filter menu splits the trees; In their tree puts them back", async () => {
    const device = await open();
    await expect.element(filterButton()).toBeVisible();
    await userEvent.click(filterButton());
    await userEvent.click(page.getByRole("menuitemradio", { name: "On their own", exact: true }));
    await expect.poll(() => device.location()).toBe(`${LIST}?subtasks=own`);
    await expect.poll(() => titles(`[data-todo-section="${tomorrow}"]`)).toEqual(["Arrange the dog sitter"]);

    await userEvent.click(filterButton());
    await userEvent.click(page.getByRole("menuitemradio", { name: "In their tree", exact: true }));
    await expect.poll(() => device.location()).toBe(LIST);
    await expect
      .poll(() => titles(`[data-todo-section="${tomorrow}"]`))
      .toEqual([
        "Get ready for the hospital stay",
        "Arrange the dog sitter",
        "Pack the bag",
        "Print the medication list",
      ]);
  });
});
