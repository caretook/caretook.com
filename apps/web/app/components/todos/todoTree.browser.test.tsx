import type { GroupRole } from "../../../test/fixtures";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { TEST_GROUP, TEST_RECIPIENT, TEST_TIME_ZONE, TEST_USER } from "../../../test/fixtures";
import { getByCss } from "../../../test/locators";
import { TodoTree } from "./TodoTree";
import { todoTrees } from "~/lib/todos/todoTreeView";

// The shared tree (todo-subtasks-3 slice 4): nested rows, a level per list
// indented to the row's text, done children struck in place, context
// ancestors dimmed, and with `adding` a quick add on each row that may take
// a subtask. Fictional todos.

const id = (n: number) => `6a1c9e42-3b7d-4e5f-8a20-7c4d1f3b${String(n).padStart(4, "0")}`;
const MOVE = id(1);
const PACK = id(2);
const TAPE = id(3);
const LABELS = id(4);
const MOVERS = id(5);
const at = new Date().toISOString();

const todo = (todoId: string, title: string, v: Partial<LocalTodo> = {}): LocalTodo => ({
  id: todoId,
  groupId: TEST_GROUP.id,
  recipientId: TEST_RECIPIENT.id,
  title,
  assigneeId: null,
  assigneeName: null,
  dueOn: null,
  dueTime: null,
  doneAt: null,
  doneBy: null,
  providerId: null,
  medicationId: null,
  eventId: null,
  deletedAt: null,
  createdAt: at,
  updatedAt: at,
  createdBy: TEST_USER.id,
  updatedBy: TEST_USER.id,
  via: null,
  repeatRule: null,
  repeatStartsOn: null,
  repeatId: null,
  parentId: null,
  ...v,
});

const TODOS = [
  todo(MOVE, "Get ready for the move"),
  todo(PACK, "Pack the kitchen", { parentId: MOVE }),
  todo(TAPE, "Buy packing tape", { parentId: PACK }),
  todo(LABELS, "Print box labels", { parentId: PACK, doneAt: at, doneBy: TEST_USER.id }),
  todo(MOVERS, "Book the movers", { parentId: MOVE }),
];

type Options = { adding?: boolean; role?: GroupRole; matches?: (t: LocalTodo) => boolean };
const show = ({ adding = false, role = "caretaker", matches }: Options = {}) =>
  renderWithDevice({
    element: (
      <TodoTree
        trees={todoTrees(TODOS, { now: Date.now(), timeZone: TEST_TIME_ZONE, matches })}
        adding={adding}
        nameOf={() => "Sam Okafor"}
        now={Date.now()}
        timeZone={TEST_TIME_ZONE}
        onTick={() => undefined}
        busy={false}
      />
    ),
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    role,
  });

const rowOf = (todoId: string) => getByCss(`[data-todo="${todoId}"]`);
const left = (todoId: string) =>
  rowOf(todoId).element().querySelector("[data-todo-title]")!.getBoundingClientRect().left;
const addButtons = () => [...document.querySelectorAll("[data-todo-quick-add] button")];

describe("the todo tree", () => {
  test("indents each level, strikes a done child in place, and adds nothing without adding", async () => {
    await show();
    await expect.element(rowOf(TAPE)).toBeInTheDocument();
    expect(left(MOVE)).toBeLessThan(left(PACK));
    expect(left(PACK)).toBeLessThan(left(TAPE));
    expect(left(TAPE)).toBe(left(LABELS));
    expect(left(PACK)).toBe(left(MOVERS));
    await expect
      .element(rowOf(LABELS).getByRole("link", { name: "Print box labels" }))
      .toHaveClass("line-through");
    await expect
      .element(rowOf(TAPE).getByRole("link", { name: "Buy packing tape" }))
      .not.toHaveClass("line-through");
    expect(addButtons()).toHaveLength(0);
  });

  test("dims a context ancestor but not the match under it", async () => {
    await show({ matches: (t) => t.id === TAPE });
    await expect.element(rowOf(TAPE)).toHaveAttribute("data-todo-look", "list");
    await expect.element(rowOf(TAPE)).not.toHaveClass("opacity-60");
    for (const ancestor of [MOVE, PACK]) {
      await expect.element(rowOf(ancestor)).toHaveAttribute("data-todo-look", "context");
      await expect.element(rowOf(ancestor)).toHaveClass("opacity-60");
    }
    expect(document.querySelector(`[data-todo="${MOVERS}"]`)).toBeNull();
    expect(document.querySelector(`[data-todo="${LABELS}"]`)).toBeNull();
  });

  test("with adding, a writer gets the quick add on each row that may take a subtask", async () => {
    await show({ adding: true });
    await expect
      .element(rowOf(MOVE).getByRole("button", { name: "Add subtask to Get ready for the move" }))
      .toBeVisible();
    await expect
      .element(rowOf(PACK).getByRole("button", { name: "Add subtask to Pack the kitchen" }))
      .toBeVisible();
    await expect
      .element(rowOf(MOVERS).getByRole("button", { name: "Add subtask to Book the movers" }))
      .toBeVisible();
    // The third level is the deepest: no subtask goes under it.
    expect(rowOf(TAPE).element().querySelector("[data-todo-quick-add]")).toBeNull();
    expect(rowOf(LABELS).element().querySelector("[data-todo-quick-add]")).toBeNull();
    expect(addButtons()).toHaveLength(3);
  });

  test("with adding, a context row gets none", async () => {
    await show({ adding: true, matches: (t) => t.id === PACK });
    await expect
      .element(rowOf(PACK).getByRole("button", { name: "Add subtask to Pack the kitchen" }))
      .toBeVisible();
    expect(rowOf(MOVE).element().querySelector("[data-todo-quick-add]")).toBeNull();
    expect(addButtons()).toHaveLength(1);
  });

  test("with adding, a viewer gets no quick add", async () => {
    await show({ adding: true, role: "viewer" });
    await expect.element(rowOf(MOVE)).toBeInTheDocument();
    expect(addButtons()).toHaveLength(0);
  });
});
