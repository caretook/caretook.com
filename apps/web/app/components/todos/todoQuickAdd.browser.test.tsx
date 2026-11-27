import type { GroupRole } from "../../../test/fixtures";
import type { QuickAddParent } from "./TodoQuickAdd";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { TEST_GROUP, todo } from "../../../test/fixtures";
import { getSync } from "~/lib/sync";
import { TodoQuickAdd } from "./TodoQuickAdd";

// The shared quick add (todo-subtasks-3 slice 1): the compact button opens
// the field in place, Enter adds a child and keeps the field, Escape closes;
// nothing for a viewer, at the depth limit or on a repeating todo; a failed
// write says so. The full form on the todo page: todo/todoSubtasks.

const id = (n: number) => `4c2e7a18-9d3b-4f61-8e05-2a7b9c1d${String(n).padStart(4, "0")}`;
const TOP: QuickAddParent = { id: id(1), title: "Get ready for the move", deletedAt: null, repeatRule: null };
const WEEKLY: QuickAddParent = { ...TOP, id: id(2), title: "Put the bins out", repeatRule: "FREQ=WEEKLY" };
const fixtures = () => [todo({ id: TOP.id, title: TOP.title })];

type Options = { parent?: QuickAddParent; ancestors?: readonly unknown[]; role?: GroupRole };

const show = ({ parent = TOP, ancestors = [], role = "caretaker" }: Options = {}) =>
  renderWithDevice({
    element: <TodoQuickAdd parent={parent} ancestors={ancestors} form="compact" />,
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    role,
    fixtures: fixtures(),
  });

const OPENER = () => page.getByRole("button", { name: `Add subtask to ${TOP.title}` });
const FIELD = () => page.getByRole("textbox", { name: "New subtask" });
const childrenOf = async (device: Awaited<ReturnType<typeof show>>) =>
  (
    await device.query<{ title: string }>("SELECT title FROM todo WHERE parent_id = ? ORDER BY title", [
      TOP.id,
    ])
  ).map((r) => r.title);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the compact quick add", () => {
  test("opens on its button, adds on Enter and keeps the field, and closes on Escape", async () => {
    const device = await show();
    await expect.element(OPENER()).toHaveAttribute("aria-expanded", "false");
    await expect.element(FIELD()).not.toBeInTheDocument();

    await userEvent.click(OPENER());
    await expect.element(FIELD()).toHaveFocus();
    await expect.element(OPENER()).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("Book the van{Enter}");
    await expect.poll(() => childrenOf(device)).toEqual(["Book the van"]);
    await expect.element(FIELD()).toHaveValue("");
    await expect.element(FIELD()).toHaveFocus();

    await userEvent.keyboard("Pack the kitchen{Enter}");
    await expect.poll(() => childrenOf(device)).toEqual(["Book the van", "Pack the kitchen"]);

    await userEvent.keyboard("{Escape}");
    await expect.element(FIELD()).not.toBeInTheDocument();
    await expect.element(OPENER()).toHaveFocus();
  });

  test("shows nothing for a viewer", async () => {
    await show({ role: "viewer" });
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
    await expect.element(OPENER()).not.toBeInTheDocument();
  });

  test("shows nothing at the depth limit", async () => {
    // The parent is already a third-level todo: its parent and grandparent above it.
    await show({ ancestors: [id(8), id(9)] });
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
  });

  test("shows nothing on a repeating todo", async () => {
    await show({ parent: WEEKLY });
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
  });

  test("a refused write says so and keeps what was typed", async () => {
    // A parent the device doesn't have: the local rules refuse it.
    const GONE: QuickAddParent = { ...TOP, id: id(3), title: "Someone else's todo" };
    await show({ parent: GONE });
    await userEvent.click(page.getByRole("button", { name: `Add subtask to ${GONE.title}` }));
    await userEvent.keyboard("Book the van{Enter}");
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Choose a todo in this care group that can have subtasks");
    await expect.element(FIELD()).toHaveValue("Book the van");
  });

  test("a write that throws says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const device = await show();
    vi.spyOn(getSync().drizzle, "transaction").mockRejectedValueOnce(new Error("disk I/O error"));
    await userEvent.click(OPENER());
    await userEvent.keyboard("Book the van{Enter}");
    await expect.element(page.getByRole("alert")).toHaveTextContent("Couldn't save that. Try again.");
    expect(await childrenOf(device)).toEqual([]);
  });
});
