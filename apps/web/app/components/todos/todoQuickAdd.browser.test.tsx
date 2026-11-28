import type { GroupRole } from "../../../test/fixtures";
import type { ReactElement } from "react";
import type { QuickAddParent } from "./TodoQuickAdd";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { fx, TEST_GROUP, todo } from "../../../test/fixtures";
import { getSync } from "~/lib/sync";
import { TodoQuickAdd } from "./TodoQuickAdd";

// The shared quick add (todo-subtasks-3 slice 1): the compact button opens
// the field in place, Enter adds a child and keeps the field, Escape closes;
// nothing for a viewer, at the depth limit or on a repeating todo; a failed
// write says so. The full form on the todo page: todo/todoSubtasks. With a
// link (todo-links-6): a top-level todo linked there, or a linked subtask.

const id = (n: number) => `4c2e7a18-9d3b-4f61-8e05-2a7b9c1d${String(n).padStart(4, "0")}`;
const TOP: QuickAddParent = { id: id(1), title: "Get ready for the move", deletedAt: null, repeatRule: null };
const WEEKLY: QuickAddParent = { ...TOP, id: id(2), title: "Put the bins out", repeatRule: "FREQ=WEEKLY" };
const LARK = fx.provider({ id: id(20), name: "Dr. Mira Lark" });
const fixtures = () => [todo({ id: TOP.id, title: TOP.title }), LARK];

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

describe("the quick add with a link", () => {
  type Row = { title: string; parent_id: string | null; provider_id: string | null };
  const rows = async (device: Awaited<ReturnType<typeof renderWithDevice>>) =>
    device.query<Row>("SELECT title, parent_id, provider_id FROM todo WHERE title != ? ORDER BY title", [
      TOP.title,
    ]);
  const showLinked = (element: ReactElement, role: GroupRole = "caretaker") =>
    renderWithDevice({ element, url: `/app/groups/${TEST_GROUP.id}/todos`, role, fixtures: fixtures() });

  test("with a link and no parent, adds a top-level todo with the link and keeps the field", async () => {
    const device = await showLinked(<TodoQuickAdd link={{ providerId: LARK.id }} form="full" />);
    const field = page.getByRole("textbox", { name: "New todo" });
    await expect.element(field).toHaveAttribute("placeholder", "Add a todo");
    await userEvent.click(field);
    await userEvent.keyboard("Call to confirm{Enter}");
    await expect
      .poll(() => rows(device))
      .toEqual([{ title: "Call to confirm", parent_id: null, provider_id: LARK.id }]);
    await expect.element(field).toHaveValue("");
    await expect.element(field).toHaveFocus();
    await userEvent.fill(field, "Ask for the lab results");
    await userEvent.click(page.getByRole("button", { name: "Add todo" }));
    await expect
      .poll(async () => (await rows(device)).map((r) => r.title))
      .toEqual(["Ask for the lab results", "Call to confirm"]);
  });

  test("with a parent and a link, adds a linked subtask", async () => {
    const device = await showLinked(
      <TodoQuickAdd parent={TOP} link={{ providerId: LARK.id }} form="compact" />,
    );
    await userEvent.click(OPENER());
    await userEvent.keyboard("Book the van{Enter}");
    await expect
      .poll(() => rows(device))
      .toEqual([{ title: "Book the van", parent_id: TOP.id, provider_id: LARK.id }]);
  });

  test("shows nothing for a reader", async () => {
    await showLinked(<TodoQuickAdd link={{ providerId: LARK.id }} form="full" />, "viewer");
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
  });
});
