import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as todosRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTodoUndo } from "~/lib/todos/todoUndo";

// The Todos tab shows the tree (todo-subtasks-2 slice 1): a parent with
// "n of m done" and a tick that waits on its subtasks, a subtask with its own
// due day or assignee listed with "Part of <parent>", and the rest only on
// the parent's page, in the open sections and Done alike.

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

afterEach(() => clearTodoUndo());

describe("the Todos tab's tree", () => {
  test("a parent reads “1 of 3 done” and waits on its subtasks; a dated subtask is under its day with “Part of”; a plain one isn't listed", async () => {
    await open();
    await expect.element(page.getByText("1 of 3 done")).toBeVisible();

    expect(rowOf(PARENT)?.querySelector("[data-todo-progress]")?.textContent).toBe("1 of 3 done");
    const parentTick = page.getByRole("checkbox", {
      name: "“Get ready for the hospital stay”: 1 of 3 subtasks done",
    });
    await expect.element(parentTick).toBeDisabled();
    // The row's mark says it; the tick shows no second count.
    expect(rowOf(PARENT)?.querySelector("[data-tick-progress]")).toBeNull();

    expect(titles(`[data-todo-section="${tomorrow}"]`)).toEqual(["Arrange the dog sitter"]);
    const partOf = rowOf(id(3))?.querySelector("[data-todo-part-of]");
    expect(partOf?.textContent).toBe("Part of Get ready for the hospital stay");
    expect(partOf?.querySelector("a")?.getAttribute("href")).toBe(`${LIST}/${PARENT}`);
    expect(rowOf(PARENT)?.querySelector("[data-todo-part-of]")).toBeNull();

    expect(rowOf(id(2))).toBeNull();
    // Done follows the same rule: the plain done subtask isn't there, the top-level one is.
    expect(titles('[data-todo-section="done"]')).toEqual(["Book the eye exam"]);
    expect(document.querySelector('[data-todo-section="done"] [data-done-more]')).toBeNull();
  });

  test("Mine shows viewer@'s assigned subtask with “Part of”, and they may tick it", async () => {
    await open("viewer", `${LIST}?who=mine`);
    await expect.element(page.getByText("Order the cake")).toBeVisible();

    expect(titles("[data-todo-section]:not([data-todo-section=done])")).toEqual(["Order the cake"]);
    expect(rowOf(id(7))?.querySelector("[data-todo-part-of]")?.textContent).toBe("Part of Plan the birthday");
    await expect.element(page.getByRole("checkbox", { name: "Mark “Order the cake” done" })).toBeEnabled();
  });
});
