import type { LocalTodo } from "~/lib/todos/todos.sync";

import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { TEST_GROUP, TEST_RECIPIENT, TEST_TIME_ZONE, TEST_USER } from "../../../test/fixtures";
import { getByCss } from "../../../test/locators";
import { TodoRow } from "./TodoRow";

// The shared row's looks (todo-subtasks-3 slice 1): `context`, an ancestor
// shown only to place a branch, is dimmed, has no tick and links to its
// todo. The `list` look is the Todos tests' (routes/app/groups/todos).

const ID = "5d3f8b29-0e4c-4a72-9f16-3b8cad2e0001";
const at = new Date().toISOString();
const MOVE: LocalTodo = {
  id: ID,
  groupId: TEST_GROUP.id,
  recipientId: TEST_RECIPIENT.id,
  title: "Get ready for the move",
  assigneeId: TEST_USER.id,
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
};

const show = (look: "list" | "context") =>
  renderWithDevice({
    element: (
      <ul>
        <TodoRow
          todo={MOVE}
          look={look}
          nameOf={() => "Sam Okafor"}
          now={Date.now()}
          timeZone={TEST_TIME_ZONE}
          onTick={() => undefined}
          busy={false}
        />
      </ul>
    ),
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    role: "caretaker",
  });

describe("a todo row", () => {
  test("in the context look is dimmed, has no tick and links to its todo", async () => {
    await show("context");
    const row = getByCss(`[data-todo="${ID}"]`);
    await expect.element(row).toHaveAttribute("data-todo-look", "context");
    await expect.element(row).toHaveClass("opacity-60");
    expect(row.getByRole("checkbox").all()).toHaveLength(0);
    await expect
      .element(row.getByRole("link", { name: MOVE.title }))
      .toHaveAttribute("href", `/app/groups/${TEST_GROUP.id}/todos/${ID}`);
  });

  test("in the list look has its tick, not dimmed", async () => {
    await show("list");
    const row = getByCss(`[data-todo="${ID}"]`);
    await expect
      .element(row.getByRole("checkbox", { name: `Mark “${MOVE.title}” done` }))
      .toBeInTheDocument();
    await expect.element(row).not.toHaveClass("opacity-60");
  });
});
