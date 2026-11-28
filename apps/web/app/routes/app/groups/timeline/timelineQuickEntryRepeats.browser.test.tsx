import type { DeviceRoute } from "../../../../../test/device";

import { entryTodoId } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { runActions } from "~/lib/assistant/quickEntry.sync";
import * as newTodo from "../todos/new/route";
import * as timeline from "./route";
import { TIMELINE_URL } from "./timelineWorld";
import { found, waitUntil } from "../../../../../test/found";
import { addDays, localDate } from "@caretook/data/domain";

// Quick entry makes a repeating todo (planner-3, B-254), on the test device
// (offline): the item's line "bins out every monday" previews as "Todo · Due
// Mon · Repeats weekly on Monday", Save writes one repeating todo, Undo takes
// it back, and Edit opens the add-todo sheet with the repeat filled in,
// writing nothing until its own Save. A repeat that doesn't parse opens the
// sheet with none. And a todo naming an event writes a link row, never
// `todo.event_id` (B-245). The parser's phrases are rows in quickEntry.test.ts.

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/timeline", module: timeline },
  { path: "/app/groups/:groupId/todos/new", module: newTodo },
];

const VISIT_ID = "5b0e9d2c-6a41-4f7e-9c3d-2e8f1a7b4c01";
const VISIT = fx.event({ id: VISIT_ID, title: "Follow-up visit" });

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({ route: ROUTES, url: TIMELINE_URL, fixtures: [VISIT], ...options });

const WEEKLY_MONDAY = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
const today = localDate(new Date(), TEST_TIME_ZONE);
/** The first Monday from today (the test clock's day is a Wednesday). */
const monday = [0, 1, 2, 3, 4, 5, 6]
  .map((n) => addDays(today, n))
  .find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 1)!;

const box = () => page.getByRole("textbox", { name: "What happened?" });
const cards = () => [...document.querySelectorAll<HTMLElement>("[data-quick-card]")];
const cardKinds = () => cards().map((c) => c.dataset.quickCard);
const headingOf = (card: HTMLElement | undefined) =>
  card ? document.getElementById(card.getAttribute("aria-labelledby") ?? "") : null;
const saveButton = () => document.querySelector<HTMLButtonElement>("[data-quick-entry] button[type=submit]");
const status = () =>
  document.querySelector("[data-quick-entry] [data-pass-undo-label]")?.textContent ||
  (document.querySelector("[data-quick-status]")?.textContent ?? "");
const type = async (text: string, kinds: string[]) => {
  await userEvent.fill(box(), text);
  await waitUntil(() => cardKinds().join() === kinds.join(), "the cards");
};

type TodoDbRow = {
  id: string;
  title: string;
  due_on: string | null;
  event_id: string | null;
  repeat_rule: string | null;
  repeat_starts_on: string | null;
  repeat_id: string | null;
  deleted_at: string | null;
};
const SELECT_TODOS = "SELECT * FROM todo";

afterEach(() => clearUndo());

describe("quick entry makes a repeating todo", () => {
  test("the item's line shows the card; Save makes one repeating todo, and Undo removes it", async () => {
    const device = await open();
    await expect.element(box()).toBeVisible();
    await type("bins out every monday", ["todo"]);
    const card = cards()[0]!;
    expect(headingOf(card)?.textContent).toBe("Todo · Due Mon · Repeats weekly on Monday");
    expect(card.querySelector("[data-quick-title]")?.textContent).toBe("Bins out");

    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 1 todo");
    const saved = await device.query<TodoDbRow>(SELECT_TODOS);
    expect(saved).toEqual([
      expect.objectContaining({
        title: "Bins out",
        due_on: monday,
        repeat_rule: WEEKLY_MONDAY,
        repeat_starts_on: monday,
        repeat_id: saved[0]?.id,
        deleted_at: null,
      }),
    ]);
    expect((await device.queued()).map((w) => `${w.type} ${w.op}`)).toEqual(["todo PUT"]);

    await userEvent.click(page.getByRole("button", { name: "Undo" }));
    await expect.poll(async () => (await device.query<TodoDbRow>(SELECT_TODOS))[0]?.deleted_at).toBeTruthy();
    expect(await device.query<TodoDbRow>(SELECT_TODOS)).toHaveLength(1);
  });

  test("Edit opens the sheet with the repeat filled in, and saves nothing until its Save", async () => {
    const device = await open();
    await type("bins out every monday", ["todo"]);
    await userEvent.click(page.getByRole("button", { name: 'Edit "bins out every monday"' }));
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole("textbox", { name: "Todo" })).toHaveValue("Bins out");
    expect(dialog.getByLabelText("Due", { exact: true }).element()).toHaveProperty("value", monday);
    await expect
      .element(dialog.getByRole("button", { name: "Repeat: Repeats weekly on Monday" }))
      .toBeInTheDocument();
    expect(await device.query(SELECT_TODOS)).toEqual([]);
    expect(await device.queued()).toEqual([]);

    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.poll(async () => (await device.query<TodoDbRow>(SELECT_TODOS)).length).toBe(1);
    const [saved] = await device.query<TodoDbRow>(SELECT_TODOS);
    expect(saved).toMatchObject({
      title: "Bins out",
      due_on: monday,
      repeat_rule: WEEKLY_MONDAY,
      repeat_starts_on: monday,
      repeat_id: saved?.id,
    });
  });

  test("a repeatRule that doesn't parse opens the form with no repeat", async () => {
    const url = `/app/groups/${TEST_GROUP.id}/todos/new?${new URLSearchParams({
      title: "Bins out",
      dueOn: addDays(today, 5),
      repeatRule: "FREQ=YEARLY;BYMONTH=13",
    })}`;
    await open({ url });
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog.getByRole("textbox", { name: "Todo" })).toHaveValue("Bins out");
    await expect.element(dialog.getByRole("button", { name: "Repeat: Doesn't repeat" })).toBeEnabled();
  });
});

describe("a todo naming an entry (planner-3)", () => {
  test("the runner writes a link row and no event_id, in the batch's one write", async () => {
    const device = await open();
    const result = await runActions(device.db, TEST_GROUP.id, [
      { type: "addTodo", title: "Book a ride", eventId: VISIT_ID },
    ]);
    if (!result.ok) throw new Error(result.error);
    const [todoId] = result.byAction[0]!;
    expect(await device.query<TodoDbRow>(SELECT_TODOS)).toEqual([
      expect.objectContaining({ id: todoId, title: "Book a ride", event_id: null }),
    ]);
    expect(await device.query("SELECT id, entry_id, todo_id, created_by FROM timeline_entry_todo")).toEqual([
      {
        id: entryTodoId(VISIT_ID, todoId ?? ""),
        entry_id: VISIT_ID,
        todo_id: todoId,
        created_by: TEST_USER.id,
      },
    ]);
    const queued = await device.queued();
    expect(queued.map((w) => `${w.type} ${w.op}`)).toEqual(["todo PUT", "timeline_entry_todo PUT"]);
    expect(queued[0]?.data?.event_id ?? null).toBeNull();
  });

  test("the runner refuses an entry that's gone, writing nothing", async () => {
    const device = await open();
    const result = await runActions(device.db, TEST_GROUP.id, [
      { type: "addTodo", title: "Book a ride", eventId: crypto.randomUUID() },
    ]);
    expect(result).toMatchObject({ ok: false, index: 0, issues: [{ path: "eventId" }] });
    expect(await device.query(SELECT_TODOS)).toEqual([]);
    expect(await device.queued()).toEqual([]);
  });
});
