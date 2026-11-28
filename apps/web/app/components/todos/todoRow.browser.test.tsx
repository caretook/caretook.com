import type { LocalTodo } from "~/lib/todos/todos.sync";

import type { TodoRowLook } from "./TodoRow";
import type { ReactNode } from "react";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { TEST_GROUP, TEST_RECIPIENT, TEST_TIME_ZONE, TEST_USER } from "../../../test/fixtures";
import { getByCss } from "../../../test/locators";
import { TodoQuickAdd } from "./TodoQuickAdd";
import { TodoRow } from "./TodoRow";

// The shared row's looks (todo-subtasks-3 slice 1): `context`, an ancestor
// shown only to place a branch, is dimmed, has no tick and links to its
// todo. The `list` look is the Todos tests' (routes/app/groups/todos). A
// tree's add-subtask button sits at the end of the title's line (B-980).

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

const show = (look: TodoRowLook, addSubtask?: ReactNode, todo: LocalTodo = MOVE) =>
  renderWithDevice({
    element: (
      <ul>
        <TodoRow
          todo={todo}
          look={look}
          addSubtask={addSubtask}
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

  const LONG: LocalTodo = {
    ...MOVE,
    title: "Get ready for the move to the new flat across town, with the boxes, the van and the keys",
  };
  const quickAdd = (todo: LocalTodo) => <TodoQuickAdd parent={todo} form="compact" inline className="mt-1" />;
  const opener = (todo: LocalTodo) => `Add subtask to ${todo.title}`;
  const must = <T,>(el: T | null | undefined, what: string): T => {
    if (!el) throw new Error(`No ${what}`);
    return el;
  };

  for (const look of ["list", "card", "easy"] as const) {
    test(`in the ${look} look puts the add-subtask button at the end of the title's line`, async () => {
      await show(look, quickAdd(LONG), LONG);
      const row = getByCss(`[data-todo="${ID}"]`);
      const button = row.getByRole("button", { name: opener(LONG) });
      await expect.element(button).toBeVisible();
      const line = must(button.element().closest("[data-todo-title-line]"), "title line");
      const title = must(line.querySelector("[data-todo-title]"), "title");
      expect(title.textContent).toBe(LONG.title);
      // The same line as the title, after it.
      expect(title.parentElement).toBe(line);
      expect(title.compareDocumentPosition(button.element()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Right-aligned, beside the title (which wraps before it), at its first line's height.
      const box = button.element().getBoundingClientRect();
      const text = title.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(text.right);
      expect(Math.round(box.right)).toBe(Math.round(line.getBoundingClientRect().right));
      expect(box.top).toBeLessThan(text.top + 16);
      expect(text.height).toBeGreaterThan(box.height);
      // Opened, its field takes the line below, the row's text width.
      await userEvent.click(button);
      const field = page.getByRole("textbox", { name: "New subtask" });
      await expect.element(field).toHaveFocus();
      const form = must(field.element().closest("form"), "form");
      expect(form.parentElement?.parentElement).toBe(line);
      expect(form.getBoundingClientRect().top).toBeGreaterThanOrEqual(text.bottom);
      expect(Math.round(form.getBoundingClientRect().width)).toBe(
        Math.round(line.getBoundingClientRect().width),
      );
    });
  }

  test("without addSubtask keeps the title on its own, with no title line", async () => {
    await show("list");
    const row = getByCss(`[data-todo="${ID}"]`);
    await expect.element(row.getByRole("link", { name: MOVE.title })).toBeVisible();
    expect(row.element().querySelector("[data-todo-title-line]")).toBeNull();
    expect(row.element().querySelector("[data-todo-quick-add]")).toBeNull();
    // The title sits straight in the row's text column, over the due line.
    const title = must(row.element().querySelector("[data-todo-title]"), "title");
    expect(title.parentElement?.parentElement).toBe(row.element());
    expect(title.nextElementSibling?.tagName).toBe("P");
  });
});
