import type { DeviceRoute } from "../../../../../test/device";

import { addDays, localDate } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { runActions } from "~/lib/assistant/quickEntry.sync";
import * as newTodo from "../todos/new/route";
import * as timeline from "./route";
import { rowWith, TIMELINE_URL, waitUntil } from "./timelineWorld";

// Quick entry adds todos (todos slice 7), on the test device (offline): a
// `todo:` line previews as a todo card ("Todo · Due tomorrow 17:00", its
// title and assignee), saves through the runner with the rest of the line,
// Undo takes it back, and Edit opens the add-todo sheet filled in. The
// parser's phrases are rows in quickEntry.test.ts.

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });

/** Stands in for the entry page. */
function EntryProbe() {
  return <h1>Entry page</h1>;
}

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/timeline", module: timeline },
  { path: "/app/groups/:groupId/todos/new", module: newTodo },
  { path: "/app/groups/:groupId/entries/:entryId", module: { default: EntryProbe } },
];

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: TIMELINE_URL,
    fixtures: [SAM, fx.note({ occurredAt: at(new Date(Date.now() - 3_600_000)), text: "Older note" })],
    ...options,
  });

const tomorrow = addDays(localDate(new Date(), TEST_TIME_ZONE), 1);

const box = () => page.getByRole("textbox", { name: "What happened?" });
const cards = () => [...document.querySelectorAll<HTMLElement>("[data-quick-card]")];
const cardKinds = () => cards().map((c) => c.dataset.quickCard);
const saveButton = () => document.querySelector<HTMLButtonElement>("[data-quick-entry] button[type=submit]");
const status = () =>
  document.querySelector("[data-quick-entry] [data-pass-undo-label]")?.textContent ||
  (document.querySelector("[data-quick-status]")?.textContent ?? "");
/** Type a line and wait until its cards read as `kinds` (members load a moment after the box). */
const type = async (text: string, kinds: string[], also: () => boolean = () => true) => {
  await userEvent.fill(box(), text);
  await waitUntil(() => cardKinds().join() === kinds.join() && also(), 4000, "the cards");
};
/** The todo card names its assignee (members load a moment after the box). */
const samNamed = () =>
  cards()
    .find((c) => c.dataset.quickCard === "todo")
    ?.querySelector("[data-quick-detail]")?.textContent === "Sam Okafor";

type TodoDbRow = {
  id: string;
  title: string;
  assignee_id: string | null;
  due_on: string | null;
  due_time: string | null;
  created_by: string;
  deleted_at: string | null;
};

afterEach(() => clearUndo());

describe("quick entry adds todos", () => {
  test("a todo line previews as a todo card and saves it, queued for upload; Undo takes it back", async () => {
    const device = await open();
    await expect.element(box()).toBeVisible();
    await type("todo: call pharmacy tomorrow 5pm for Sam", ["todo"], samNamed);
    const card = cards()[0]!;
    expect(card.querySelector("p")?.textContent).toBe("Todo · Due tomorrow 17:00");
    expect(card.querySelector("[data-quick-title]")?.textContent).toBe("Call pharmacy");
    expect(card.querySelector("[data-quick-detail]")?.textContent).toBe("Sam Okafor");
    expect(
      page
        .getByRole("list", { name: 'Other ways to save "call pharmacy tomorrow 5pm for Sam"' })
        .getByRole("button", { name: "Note instead" })
        .query(),
    ).toBeTruthy();

    await userEvent.click(saveButton()!);
    await expect.poll(status).toBe("Saved 1 todo");
    expect(cards()).toEqual([]);

    const [saved] = await device.query<TodoDbRow>("SELECT * FROM todo");
    expect(saved).toMatchObject({
      title: "Call pharmacy",
      assignee_id: SAM_ID,
      due_on: tomorrow,
      due_time: "17:00",
      created_by: TEST_USER.id,
      deleted_at: null,
    });
    // A todo isn't a timeline entry.
    expect(
      await device.query("SELECT id FROM timeline_entry WHERE created_at > ?", [
        at(new Date(Date.now() - 60_000)),
      ]),
    ).toEqual([]);
    expect((await device.queued()).map((w) => `${w.type} ${w.op}`)).toEqual(["todo PUT"]);

    await userEvent.click(page.getByRole("button", { name: "Undo" }));
    await expect
      .poll(async () => (await device.query<TodoDbRow>("SELECT * FROM todo"))[0]?.deleted_at)
      .toBeTruthy();
  });

  test("a todo beside other parts: one Save writes them all", async () => {
    const device = await open();
    await type("bp 120/80, todo: fax the insurance form, n: called the office", ["vital", "todo", "note"]);
    expect(cards()[1]!.querySelector("p")?.textContent).toBe("Todo · No due date");
    await userEvent.click(saveButton()!);
    await expect.poll(status).toBe("Saved 2 entries and 1 todo");
    const todos = await device.query<TodoDbRow>("SELECT * FROM todo");
    expect(todos.map((t) => [t.title, t.assignee_id, t.due_on])).toEqual([
      ["Fax the insurance form", null, null],
    ]);
    await waitUntil(() => !!rowWith("called the office"), 4000, "the note on the timeline");
  });

  test("Note instead saves the same words as a note", async () => {
    const device = await open();
    await type("todo: ask about the ramp", ["todo"]);
    await userEvent.click(page.getByRole("button", { name: "Note instead" }));
    await waitUntil(() => cardKinds().join() === "note");
    await userEvent.click(saveButton()!);
    // A lone note opens on its page.
    await expect.poll(() => device.location()).toMatch(/\/entries\//);
    expect(await device.query("SELECT id FROM todo")).toEqual([]);
  });

  test("Edit opens the add-todo sheet filled in", async () => {
    const device = await open();
    await type("t: pick up the walker tomorrow 3pm @sam", ["todo"], samNamed);
    await userEvent.click(page.getByRole("button", { name: 'Edit "pick up the walker tomorrow 3pm @sam"' }));
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog).toBeVisible();
    expect(device.location()).toContain(`/app/groups/${TEST_GROUP.id}/todos/new?`);
    await expect.element(dialog.getByRole("textbox", { name: "Todo" })).toHaveValue("Pick up the walker");
    await expect.element(dialog.getByText("Sam Okafor")).toBeVisible();
    expect(dialog.getByLabelText("Due (optional)").element()).toHaveProperty("value", tomorrow);
    expect(dialog.getByLabelText("Time (optional)").element()).toHaveProperty("value", "15:00");
    expect(await device.query("SELECT id FROM todo")).toEqual([]);
  });

  test("a viewer gets no box, and the runner refuses their todo", async () => {
    const device = await open({ role: "viewer" });
    await waitUntil(() => !!rowWith("Older note"), 4000, "the timeline");
    expect(document.querySelector("[data-quick-entry]")).toBeNull();
    const result = await runActions(device.db, TEST_GROUP.id, [{ type: "addTask", title: "Call pharmacy" }]);
    expect(result).toMatchObject({ ok: false, index: null });
  });

  test("the runner refuses an assignee who isn't a member, leaving the rest of the batch unwritten", async () => {
    const device = await open();
    const result = await runActions(device.db, TEST_GROUP.id, [
      { type: "addNote", text: "Hello", occurredAt: new Date().toISOString() },
      { type: "addTask", title: "Call pharmacy", assigneeId: crypto.randomUUID() },
    ]);
    expect(result).toMatchObject({
      ok: false,
      index: 1,
      issues: [{ path: "assigneeId", message: "Choose someone in this care group" }],
    });
    expect(await device.query("SELECT id FROM todo")).toEqual([]);
    expect(await device.queued()).toEqual([]);
  });
});
