import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, todo, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { getByCss } from "../../../../../test/locators";
import { completeTodo, removeTodo } from "~/lib/todos/todos.sync";
import * as todoRoute from "./route";
import * as editSheet from "../todos/edit/route";
import * as todosRoute from "../todos/route";

// The todo page's Subtasks band (todo-subtasks slice 5): the live subtasks
// with their ticks and progress, writers' inline add (gone at the depth
// limit and on a repeating todo), the rollup showing on the parent's page,
// and a subtask's "Part of" link up; a parent's tick and Mark done waiting
// on its subtasks, the delete confirm's count and the edit form's Repeat
// (slice 6). The tree rules themselves are
// todoSubtasks.sync's and todoTree's tests.

const BASE = "/app/groups/:groupId/todos";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: todosRoute },
  { path: `${BASE}/:todoId`, module: todoRoute },
];
const pageOf = (id: string) => `/app/groups/${TEST_GROUP.id}/todos/${id}`;
const id = (n: number) => `6b1d8f32-0e4c-4d7a-9f23-8c5e4d3b${String(n).padStart(4, "0")}`;

const SAM_ID = id(1);
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const TOP_FIELDS = { id: id(10), title: "Get ready for the move" };
const PACK_FIELDS = {
  id: id(11),
  title: "Pack the kitchen",
  parentId: id(10),
  assigneeId: SAM_ID,
  createdAt: hoursAgo(30),
};
const LABEL_FIELDS = {
  id: id(12),
  title: "Label the boxes",
  parentId: id(10),
  assigneeId: TEST_USER.id,
  createdAt: hoursAgo(20),
};
const TOP = todo(TOP_FIELDS);
const PACK = todo(PACK_FIELDS);
const LABEL = todo(LABEL_FIELDS);
const TAPE = todo({ id: id(13), title: "Buy tape", parentId: PACK_FIELDS.id });
const WEEKLY_ID = id(14);
const WEEKLY = todo({
  id: WEEKLY_ID,
  title: "Put the bins out",
  dueOn: "2027-06-14",
  repeatRule: "FREQ=WEEKLY",
  repeatStartsOn: "2027-06-14",
  repeatId: WEEKLY_ID,
});
const world = () => [SAM, TOP, PACK, LABEL, TAPE, WEEKLY];

const open = (todoId: string, role: GroupRole = "caretaker", fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url: pageOf(todoId), role, fixtures });

const heading = (name: string) => page.getByRole("heading", { name, level: 1 });
const band = () => page.getByRole("region", { name: "Subtasks" });
const subtasks = (title: string) => page.getByRole("list", { name: `Subtasks of ${title}` });
const ADD = () => page.getByRole("button", { name: "Add subtask" });
const PROGRESS = () => getByCss("[data-subtask-progress]");
const badge = () => document.querySelector("main header [data-todo-badge]")?.textContent?.trim() ?? null;

describe("the Subtasks band", () => {
  test("a writer adds a subtask inline and it shows in the band", async () => {
    const device = await open(TOP_FIELDS.id);
    await expect.element(heading("Get ready for the move")).toBeInTheDocument();
    await expect.element(PROGRESS()).toHaveTextContent("0 of 2 done");

    await userEvent.fill(page.getByRole("textbox", { name: "New subtask" }), "Book the van");
    await userEvent.click(ADD());
    await expect
      .element(subtasks("Get ready for the move").getByRole("link", { name: "Book the van" }))
      .toBeInTheDocument();
    await expect.element(PROGRESS()).toHaveTextContent("0 of 3 done");
    await expect.element(page.getByRole("textbox", { name: "New subtask" })).toHaveValue("");
    const [row] = await device.query<{ parent_id: string }>("SELECT parent_id FROM todo WHERE title = ?", [
      "Book the van",
    ]);
    expect(row?.parent_id).toBe(TOP.id);
  });

  test("the add is gone at the third level and on a repeating todo", async () => {
    await open(PACK_FIELDS.id);
    await expect.element(heading("Pack the kitchen")).toBeInTheDocument();
    await expect.element(ADD()).toBeInTheDocument();

    await userEvent.click(subtasks("Pack the kitchen").getByRole("link", { name: "Buy tape" }));
    await expect.element(heading("Buy tape")).toBeInTheDocument();
    await expect.element(ADD()).not.toBeInTheDocument();
    // No subtasks and no add: no band.
    await expect.element(band()).not.toBeInTheDocument();
  });

  test("a repeating todo takes no subtasks: no band", async () => {
    await open(WEEKLY_ID);
    await expect.element(heading("Put the bins out")).toBeInTheDocument();
    await expect.element(band()).not.toBeInTheDocument();
  });

  test("a viewer sees the band and ticks only their own subtask", async () => {
    await open(TOP_FIELDS.id, "viewer");
    await expect.element(heading("Get ready for the move")).toBeInTheDocument();
    const list = subtasks("Get ready for the move");
    await expect.element(list.getByRole("link", { name: "Pack the kitchen" })).toBeInTheDocument();
    await expect.element(list.getByRole("link", { name: "Label the boxes" })).toBeInTheDocument();
    expect(list.getByRole("checkbox").all()).toHaveLength(1);
    await expect.element(ADD()).not.toBeInTheDocument();

    await userEvent.click(list.getByRole("checkbox", { name: "Mark “Label the boxes” done" }));
    await expect.element(PROGRESS()).toHaveTextContent("1 of 2 done");
    await expect.element(band().getByRole("button", { name: "Undo Label the boxes" })).toBeInTheDocument();
  });

  test("ticking the last open subtask shows the parent done", async () => {
    const packed = todo({ ...PACK_FIELDS, doneAt: hoursAgo(1), doneBy: SAM_ID });
    await open(TOP_FIELDS.id, "caretaker", [SAM, TOP, packed, LABEL]);
    await expect.element(PROGRESS()).toHaveTextContent("1 of 2 done");
    expect(badge()).toBeNull();

    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Label the boxes” done" }));
    await expect.element(PROGRESS()).toHaveTextContent("2 of 2 done");
    await expect.poll(badge).toBe("Done");
    await expect.element(page.getByRole("button", { name: "Reopen “Get ready for the move”" })).toBeVisible();
  });
});

describe("a subtask's page", () => {
  test("links to its parent", async () => {
    const device = await open(LABEL_FIELDS.id, "viewer");
    await expect.element(heading("Label the boxes")).toBeInTheDocument();
    const up = getByCss("[data-todo-parent]");
    await expect.element(up).toHaveTextContent("Part of Get ready for the move");
    await userEvent.click(up.getByRole("link", { name: "Get ready for the move" }));
    await expect.element(heading("Get ready for the move")).toBeInTheDocument();
    expect(device.location()).toBe(pageOf(TOP_FIELDS.id));
    await expect.element(getByCss("[data-todo-parent]")).not.toBeInTheDocument();
  });

  test("its parent deleted while it's open: the page says it's deleted", async () => {
    const device = await open(LABEL_FIELDS.id);
    await expect.element(heading("Label the boxes")).toBeInTheDocument();
    expect((await removeTodo(device.db, TOP_FIELDS.id)).ok).toBe(true);
    await device.settle();
    await expect.element(page.getByText("This todo was deleted.")).toBeVisible();
  });

  test("a deleted parent's subtask is a 404 like any deleted todo", async () => {
    await open(LABEL_FIELDS.id, "caretaker", [
      todo({ ...TOP_FIELDS, deletedAt: at() }),
      todo({ ...LABEL_FIELDS, deletedAt: at() }),
    ]);
    await expect.element(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    expect(document.body.textContent).not.toMatch(/Label the boxes/);
  });
});

// A party to plan: "Send the invites" has two of three done; "Book the hall" has none of its own.
const PARTY = todo({ id: id(20), title: "Plan the party" });
const INVITES = todo({ id: id(21), title: "Send the invites", parentId: id(20), createdAt: hoursAgo(30) });
const HALL = todo({ id: id(22), title: "Book the hall", parentId: id(20), createdAt: hoursAgo(20) });
const card = (n: number, title: string, done: boolean) =>
  todo({
    id: id(22 + n),
    title,
    parentId: id(21),
    createdAt: hoursAgo(10 - n),
    ...(done ? { doneAt: hoursAgo(2), doneBy: TEST_USER.id } : {}),
  });
const LAST_CARD = card(3, "Post the last card", false);
const CAKE = todo({ id: id(30), title: "Order the cake" });
const party = () => [
  PARTY,
  INVITES,
  HALL,
  card(1, "Write the cards", true),
  card(2, "Buy stamps", true),
  LAST_CARD,
  CAKE,
];

const openParty = (todoId: string) =>
  renderWithDevice({ route: ROUTES, url: pageOf(todoId), role: "caretaker", fixtures: party() });

describe("a parent's tick", () => {
  test("waits on an open subtask with its n of m, and turns once all are done; a plain tick is as before", async () => {
    const device = await openParty(PARTY.id);
    await expect.element(heading("Plan the party")).toBeInTheDocument();
    const list = subtasks("Plan the party");
    const invites = list.getByRole("checkbox", { name: "“Send the invites”: 2 of 3 subtasks done" });
    await expect.element(invites).toBeDisabled();
    await expect
      .element(getByCss(`[data-subtask="${INVITES.id}"] [data-tick-progress]`))
      .toHaveTextContent("2 of 3");

    const hall = list.getByRole("checkbox", { name: "Mark “Book the hall” done" });
    await expect.element(hall).toBeEnabled();
    expect(document.querySelector(`[data-subtask="${HALL.id}"] [data-tick-progress]`)).toBeNull();

    expect((await completeTodo(device.db, LAST_CARD.id)).ok).toBe(true);
    await device.settle();
    const done = list.getByRole("checkbox", { name: "Reopen “Send the invites”" });
    await expect.element(done).toBeEnabled();
    await expect.element(done).toBeChecked();
    expect(document.querySelector(`[data-subtask="${INVITES.id}"] [data-tick-progress]`)).toBeNull();
  });

  test("the page's Mark done waits too, and its last subtask's tick completes it", async () => {
    await openParty(INVITES.id);
    await expect.element(heading("Send the invites")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Mark “Send the invites” done" })).toBeDisabled();
    await expect
      .poll(() => document.querySelector("[data-completion-progress]")?.textContent)
      .toContain("2 of 3");

    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Post the last card” done" }));
    await expect.element(page.getByRole("button", { name: "Reopen “Send the invites”" })).toBeEnabled();
    await expect.element(getByCss("[data-completion-progress]")).not.toBeInTheDocument();
  });
});

describe("deleting a parent", () => {
  /** The open confirm's words, once Delete is asked from the page's ⋯. */
  const askDelete = async (title: string) => {
    await expect.element(heading(title)).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: `Actions for ${title}` }));
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    await expect.element(page.getByRole("dialog", { name: "Delete this todo?" })).toBeVisible();
    return document.querySelector("dialog[open]")?.textContent ?? "";
  };

  test("the confirm names every subtask that goes with it", async () => {
    await openParty(PARTY.id);
    // Its two subtasks and the invites' three.
    expect(await askDelete("Plan the party")).toContain("its 5 subtasks");
  });

  test("a subtask with its own counts its own", async () => {
    await openParty(INVITES.id);
    expect(await askDelete("Send the invites")).toContain("its 3 subtasks");
  });

  test("a todo with no subtasks names none", async () => {
    await openParty(HALL.id);
    expect(await askDelete("Book the hall")).not.toContain("subtask");
  });
});

describe("the edit form's Repeat", () => {
  const EDIT_ROUTES: DeviceRoute[] = [
    { path: BASE, module: todosRoute, children: [{ path: `${BASE}/:todoId/edit`, module: editSheet }] },
  ];
  const repeatOf = async (todoId: string) => {
    await renderWithDevice({
      route: EDIT_ROUTES,
      url: `${pageOf(todoId)}/edit`,
      role: "caretaker",
      fixtures: party(),
    });
    await expect.element(page.getByRole("textbox", { name: "Todo" })).toBeVisible();
    return document.querySelector("[data-todo-form] [data-todo-repeat]");
  };

  test("is gone on a subtask", async () => {
    expect(await repeatOf(LAST_CARD.id)).toBeNull();
  });

  test("is gone on a todo with subtasks", async () => {
    expect(await repeatOf(PARTY.id)).toBeNull();
  });

  test("shows on a plain todo", async () => {
    expect(await repeatOf(CAKE.id)).not.toBeNull();
  });
});
