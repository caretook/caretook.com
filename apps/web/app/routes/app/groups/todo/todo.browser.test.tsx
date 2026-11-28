import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { getByCss } from "../../../../../test/locators";
import * as todoRoute from "./route";
import * as editSheet from "../todos/edit/route";
import * as todosRoute from "../todos/route";
import { renderWithDevice } from "../../../../../test/device";
import { found, waitUntil } from "../../../../../test/found";
import {
  at,
  fx,
  recordTag,
  tag,
  todo,
  TEST_GROUP,
  TEST_TIME_ZONE,
  TEST_USER,
} from "../../../../../test/fixtures";
import { addDays, localDate } from "@caretook/data/domain";

// The todo page (todos slice 2): what a writer, an assignee viewer and
// another viewer see and can press, the complete and reopen paths, the live
// notes (made on the first real change; read-only for viewers), Delete, and
// the 404s, and its tags (`QuickTags`, tags-2 slice 4) on the page and the
// edit sheet. The service's document rules are integration tests.

const BASE = "/app/groups/:groupId/todos";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: todosRoute, children: [{ path: `${BASE}/:todoId/edit`, module: editSheet }] },
  { path: `${BASE}/:todoId`, module: todoRoute },
];
const LIST = `/app/groups/${TEST_GROUP.id}/todos`;
const pageOf = (id: string) => `${LIST}/${id}`;

const today = localDate(new Date(), TEST_TIME_ZONE);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const MINE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c11",
  title: "Call the pharmacy",
  dueOn: addDays(today, -2),
  assigneeId: TEST_USER.id,
});
const SAMS = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c12",
  title: "Fax the form",
  dueOn: addDays(today, 3),
  dueTime: "17:00",
  assigneeId: SAM_ID,
});
const MAYS = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c13",
  title: "Drive to physio",
  assigneeName: "Aunt May",
});
const DONE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c14",
  title: "Book the eye exam",
  assigneeId: SAM_ID,
  doneAt: at(new Date(Date.now() - 60_000)),
  doneBy: SAM_ID,
});
const world = () => [SAM, MINE, SAMS, MAYS, DONE];

const open = (url: string, role: GroupRole = "owner", fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url, role, fixtures });

const EDITOR = () => getByCss(".ProseMirror");
const ACTIONS = () => getByCss('main header [data-region="actions"]');
const badge = () => document.querySelector("main header [data-todo-badge]")?.textContent?.trim() ?? null;
const ASSIGNEE = () => getByCss("[data-todo-assignee]");
const DUE = () => getByCss("[data-todo-due]");
const heading = (name: string) => page.getByRole("heading", { name, level: 1 });

describe("the todo page", () => {
  test("a writer sees the details, Edit and ⋯; marks it done and reopens it from the ⋯", async () => {
    const device = await open(pageOf(MINE.id));
    await expect.element(heading("Call the pharmacy")).toBeInTheDocument();
    expect(badge()).toBe("Overdue");
    await expect.element(ASSIGNEE()).toHaveTextContent("you");
    await expect.element(DUE()).toMatchTextContent(/Overdue · 2 days/);
    await expect.element(page.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Actions for Call the pharmacy" }))
      .toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Mark “Call the pharmacy” done" }));
    await expect.poll(badge).toBe("Done");
    await expect.element(page.getByText(/^Done by you · today at \d\d:\d\d$/)).toBeInTheDocument();
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Call the pharmacy" }))
      .toBeInTheDocument();
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);

    await userEvent.click(page.getByRole("button", { name: "Actions for Call the pharmacy" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Reopen" }));
    await expect.poll(badge).toBe("Overdue");
    await expect.element(getByCss("[data-todo-done-by]")).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Mark “Call the pharmacy” done" }))
      .toBeInTheDocument();
  });

  test("a typed-name todo, a member's and a done one read as they are; Edit opens the sheet and comes back", async () => {
    const device = await open(pageOf(MAYS.id));
    await expect.element(heading("Drive to physio")).toBeInTheDocument();
    await expect.element(ASSIGNEE()).toHaveTextContent("Aunt May (not in the group)");
    await expect.element(DUE()).toHaveTextContent("No due date");
    expect(badge()).toBeNull();

    await userEvent.click(page.getByRole("link", { name: "Edit" }));
    await expect.element(page.getByRole("dialog", { name: "Edit todo" })).toBeInTheDocument();
    expect(device.location()).toBe(`${pageOf(MAYS.id)}/edit`);
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => device.location()).toBe(pageOf(MAYS.id));
  });

  test("a done todo names who finished it, and writers may reopen it", async () => {
    await open(pageOf(DONE.id));
    await expect.element(heading("Book the eye exam")).toBeInTheDocument();
    expect(badge()).toBe("Done");
    await expect.element(page.getByText(/^Done by Sam Okafor · today at \d\d:\d\d$/)).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Reopen “Book the eye exam”" }));
    await expect.poll(badge).toBe(null);
    await expect.element(getByCss("[data-todo-done-by]")).not.toBeInTheDocument();
  });

  test("the first words in the notes make the todo's document", async () => {
    const device = await open(pageOf(SAMS.id));
    await expect.element(heading("Fax the form")).toBeInTheDocument();
    await expect.element(EDITOR()).toHaveAttribute("contenteditable", "true");
    expect(await device.query("SELECT id FROM note_document WHERE id = ?", [SAMS.id])).toEqual([]);
    (await EDITOR().findElement()).focus();
    await userEvent.keyboard("Pharmacy said Friday");
    await expect
      .poll(() =>
        device.query<{ subject: string; todo_id: string; group_id: string }>(
          "SELECT subject, todo_id, group_id FROM note_document WHERE id = ?",
          [SAMS.id],
        ),
      )
      .toEqual([{ subject: "todo", todo_id: SAMS.id, group_id: TEST_GROUP.id }]);
    await expect
      .poll(
        async () =>
          (await device.query("SELECT id FROM note_update WHERE document_id = ?", [SAMS.id])).length,
      )
      .toBeGreaterThan(0);
  });

  test("an assignee viewer can complete it, reads the notes, and has no Edit or ⋯", async () => {
    const notes = fx.document({ ownerId: MINE.id, subject: "todo", text: "Ask for the generic" });
    const device = await open(pageOf(MINE.id), "viewer", [...world(), notes]);
    await expect.element(heading("Call the pharmacy")).toBeInTheDocument();
    await expect.element(EDITOR()).toMatchTextContent(/Ask for the generic/);
    await expect.element(EDITOR()).toHaveAttribute("contenteditable", "false");
    await expect
      .element(page.getByText("Shared with the care group. You can view these notes."))
      .toBeInTheDocument();
    await expect.element(ACTIONS()).not.toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Mark “Call the pharmacy” done" }));
    await expect.poll(badge).toBe("Done");
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);
    await userEvent.click(page.getByRole("button", { name: "Reopen “Call the pharmacy”" }));
    await expect.poll(badge).toBe("Overdue");
  });

  test("another viewer has nothing to press", async () => {
    await open(pageOf(SAMS.id), "viewer");
    await expect.element(heading("Fax the form")).toBeInTheDocument();
    await expect.element(ASSIGNEE()).toHaveTextContent("Sam Okafor");
    await expect.element(EDITOR()).toHaveAttribute("contenteditable", "false");
    await expect.element(ACTIONS()).not.toBeInTheDocument();
    await expect.element(getByCss("[data-todo-complete], [data-todo-reopen]")).not.toBeInTheDocument();
    expect([...document.querySelectorAll("main button")].map((b) => b.textContent?.trim())).toEqual([]);
  });

  test("a viewer can't complete a typed-name todo", async () => {
    await open(pageOf(MAYS.id), "viewer");
    await expect.element(heading("Drive to physio")).toBeInTheDocument();
    await expect.element(getByCss("[data-todo-complete]")).not.toBeInTheDocument();
  });
});

describe("Delete and the 404s", () => {
  test("Delete confirms, soft-deletes and returns to the list with its chip", async () => {
    const device = await renderWithDevice({ route: ROUTES, url: `${LIST}?who=everyone`, fixtures: world() });
    await userEvent.click(page.getByRole("link", { name: "Fax the form" }));
    await expect.element(heading("Fax the form")).toBeInTheDocument();
    expect(device.location()).toBe(pageOf(SAMS.id));

    await userEvent.click(page.getByRole("button", { name: "Actions for Fax the form" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    await expect.element(page.getByRole("heading", { name: "Delete this todo?" })).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));

    await expect.poll(() => device.location()).toBe(`${LIST}?who=everyone`);
    const [row] = await device.query<{ deleted_at: string | null }>(
      "SELECT deleted_at FROM todo WHERE id = ?",
      [SAMS.id],
    );
    expect(row?.deleted_at).not.toBeNull();
    await expect.element(page.getByRole("link", { name: "Fax the form" })).not.toBeInTheDocument();
  });

  test("deleted on another device while open: the page says so", async () => {
    const device = await open(pageOf(SAMS.id), "viewer");
    await expect.element(heading("Fax the form")).toBeInTheDocument();
    await device.sync({ ...SAMS, row: { ...SAMS.row, deleted_at: at() } });
    await expect.element(page.getByText("This todo was deleted.")).toBeVisible();
  });

  const GONE = todo({ title: "Gone todo", deletedAt: at() });
  const THEIRS = todo({ title: "Their todo", groupId: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1bff" });
  test.each([
    ["missing", "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7cff"],
    ["deleted", GONE.id],
    ["other group's", THEIRS.id],
  ])("a %s todo is Not found, with no title", async (_, id) => {
    await open(pageOf(id), "owner", [...world(), GONE, THEIRS]);
    await expect.element(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    expect(document.body.textContent).not.toMatch(/Gone todo|Their todo/);
  });
});

describe("tags on the todo page and its edit sheet", () => {
  const URGENT = tag("Urgent");
  const PHARMACY = tag("Pharmacy");
  const tagged = () => [...world(), URGENT, PHARMACY, recordTag(URGENT.id, SAMS.id, "todoId")];
  const chips = (within: string) =>
    [...document.querySelectorAll(`${within} [data-tag-chip]`)].map((c) => c.textContent?.trim()).join(",");
  const linksOf = async (device: Awaited<ReturnType<typeof open>>) =>
    (
      await device.query<{ name: string }>(
        "SELECT t.name FROM record_tag r JOIN tag t ON t.id = r.tag_id WHERE r.todo_id = ? ORDER BY t.name_key",
        [SAMS.id],
      )
    ).map((r) => r.name);
  /** Add tag in `scope` (the edit sheet's, over the page's subtask rows), then the picker's toggle for `name`. */
  const pick = async (name: string, scope = "main header") => {
    await userEvent.click(page.getByCss(scope).getByRole("button", { name: "Add tag" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name }));
  };

  test("a writer untags with one tap and tags through Add tag on the page; ⋯ has no Tags", async () => {
    const device = await open(pageOf(SAMS.id), "caretaker", tagged());
    await expect.poll(() => chips("[data-todo-tags]")).toBe("Urgent");

    await userEvent.click(page.getByRole("button", { name: "Remove tag Urgent" }));
    await device.settle();
    await expect.poll(() => chips("[data-todo-tags]")).toBe("");
    expect(await linksOf(device)).toEqual([]);

    await pick("Pharmacy");
    await device.settle();
    await expect.poll(() => chips("[data-todo-tags]")).toBe("Pharmacy");
    expect(await linksOf(device)).toEqual(["Pharmacy"]);
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));

    await userEvent.click(page.getByRole("button", { name: "Actions for Fax the form" }));
    await waitUntil(() => document.querySelectorAll("[role=menuitem]").length > 0, "the menu");
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).toEqual([
      "Delete",
    ]);
  });

  test("the edit sheet tags and untags at once, never through Save", async () => {
    const device = await open(`${pageOf(SAMS.id)}/edit`, "caretaker", tagged());
    const sheet = "[data-todo-edit-tags]";
    await found(() => document.querySelector(sheet));
    await expect.poll(() => chips(sheet)).toBe("Urgent");

    await pick("Pharmacy", "[role=dialog]");
    await device.settle();
    await expect.poll(() => chips(sheet)).toBe("Pharmacy,Urgent");
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));
    await userEvent.click(page.getByCss("[role=dialog]").getByRole("button", { name: "Remove tag Urgent" }));
    await device.settle();
    await expect.poll(() => chips(sheet)).toBe("Pharmacy");
    expect(await linksOf(device)).toEqual(["Pharmacy"]);
    // Each tap its own write: nothing touched the todo, and the sheet is still open.
    expect((await device.queued()).filter((w) => w.type === "todo")).toEqual([]);
    await expect.element(page.getByRole("dialog", { name: "Edit todo" })).toBeInTheDocument();
  });

  test("a viewer sees the chips and nothing to press", async () => {
    await open(pageOf(SAMS.id), "viewer", tagged());
    await expect.poll(() => chips("[data-todo-tags]")).toBe("Urgent");
    expect(document.querySelectorAll("[data-todo-tags] button")).toHaveLength(0);
    await expect.element(ACTIONS()).not.toBeInTheDocument();
  });
});
