import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { addDays, entryTodoId, localDate } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { found, waitUntil } from "../../../../../test/found";
import { at, entryTodo, fx, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import * as newTodoSheet from "../todos/new/route";
import * as todosRoute from "../todos/route";
import * as entryRoute from "./route";

// The entry page's Todos (planner-3, slice 3) on a stored note and event:
// open todos in list order with ticks and Undo, done ones with who and
// when; writers' Add todo (the sheet, linked on save), Link a todo (the
// picker) and Remove; a viewer ticks only their own and gets no actions;
// no section on a vital, symptom or dose; one todo on two entries. The
// device is offline throughout, so every write here is the offline one
// (queued for upload). The picker's options are entryTodoPicker.test.ts's.

const G = "/app/groups/:groupId";
const ROUTES: DeviceRoute[] = [
  { path: `${G}/entries/:entryId`, module: entryRoute },
  { path: `${G}/todos`, module: todosRoute, children: [{ path: `${G}/todos/new`, module: newTodoSheet }] },
];
const url = (path: string) => `/app/groups/${TEST_GROUP.id}/${path}`;

const today = localDate(new Date(), TEST_TIME_ZONE);
const DAY = 86_400_000;
const id = (n: number) => `7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb${String(n).padStart(3, "0")}`;

const SAM_ID = id(1);
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const VISIT = fx.event({
  id: id(10),
  title: "Cardiology follow-up",
  occurredAt: at(new Date(Date.now() + 2 * DAY)),
});
const NOTE = fx.note({ id: id(11), title: "Call with the pharmacy", text: "They're out until Thursday." });
const EMPTY_NOTE = fx.note({ id: id(12), title: "Slept well", text: "Fine night." });

const t = (n: number, v: Parameters<typeof todo>[0]) => todo({ id: id(100 + n), ...v });
const LATER = t(1, { title: "Ask about the stress test", dueOn: addDays(today, 3), assigneeId: SAM_ID });
const MINE = t(2, { title: "Call the pharmacy back", dueOn: addDays(today, -1), assigneeId: TEST_USER.id });
const DONE = t(3, { title: "Fax the referral", doneAt: at(), doneBy: SAM_ID });
const GONE = t(4, { title: "Deleted one", deletedAt: at() });
const LOOSE = t(5, { title: "Book the ride", dueOn: addDays(today, 1) });
const OTHER = t(6, { title: "Renew the parking permit" });

const world = () => [
  SAM,
  VISIT,
  NOTE,
  EMPTY_NOTE,
  LATER,
  MINE,
  DONE,
  GONE,
  LOOSE,
  OTHER,
  // The visit: two open, a done one, a deleted one (its link row stays).
  entryTodo(VISIT.id, LATER.id),
  entryTodo(VISIT.id, MINE.id),
  entryTodo(VISIT.id, DONE.id),
  entryTodo(VISIT.id, GONE.id),
  // The note: one of the visit's todos too.
  entryTodo(NOTE.id, MINE.id),
];

const open = (path: string, role: GroupRole = "owner", fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url: url(path), role, fixtures });

const SECTION = () => document.querySelector<HTMLElement>("[data-entry-todos]");
const region = () => page.getByRole("region", { name: "Todos" });
const titlesIn = (label: string) =>
  [...(SECTION()?.querySelectorAll(`ul[aria-label="${label}"] [data-todo-title]`) ?? [])].map((el) =>
    el.textContent?.trim(),
  );
const openTitles = () => titlesIn("Open todos");
const doneTitles = () => titlesIn("Done todos");
const ticks = () =>
  [...(SECTION()?.querySelectorAll<HTMLInputElement>("[data-todo-tick]") ?? [])].map((el) =>
    el.getAttribute("aria-label"),
  );
const option = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (o) => o.firstElementChild?.textContent === text,
  );
const linkedTo = async (device: Awaited<ReturnType<typeof open>>, entryId: string) =>
  (
    await device.query<{ todo_id: string }>(
      "SELECT todo_id FROM timeline_entry_todo WHERE entry_id = ? ORDER BY todo_id",
      [entryId],
    )
  ).map((r) => r.todo_id);

describe("an entry's Todos", () => {
  test("an event lists open todos (overdue first) then done ones with who did them; tick and Undo", async () => {
    const device = await open(`entries/${VISIT.id}`);
    await expect.element(region()).toBeInTheDocument();
    await waitUntil(() => openTitles().length === 2, "the open todos");
    expect(openTitles()).toEqual(["Call the pharmacy back", "Ask about the stress test"]);
    expect(doneTitles()).toEqual(["Fax the referral"]);
    expect(SECTION()?.querySelector('[data-todo-state="done"] [data-todo-due]')?.textContent).toMatch(
      /^Done by Sam Okafor · /,
    );
    await expect
      .element(region().getByRole("link", { name: "Ask about the stress test" }))
      .toHaveAttribute("href", url(`todos/${LATER.id}`));

    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Ask about the stress test” done" }));
    await expect.poll(openTitles).toEqual(["Call the pharmacy back"]);
    // Done stays on the entry, newest first, by me.
    await expect.poll(doneTitles).toEqual(["Ask about the stress test", "Fax the referral"]);
    expect(SECTION()?.querySelector(`[data-todo="${LATER.id}"] [data-todo-due]`)?.textContent).toMatch(
      /^Done by you · /,
    );
    await userEvent.click(page.getByRole("button", { name: "Undo Ask about the stress test" }));
    await expect.poll(openTitles).toEqual(["Call the pharmacy back", "Ask about the stress test"]);
    const [row] = await device.query<{ done_at: string | null }>("SELECT done_at FROM todo WHERE id = ?", [
      LATER.id,
    ]);
    expect(row?.done_at).toBeNull();
  });

  test("a note lists its todo too: one todo shows on two entries; unticking a done one reopens it", async () => {
    const device = await open(`entries/${NOTE.id}`, "owner", [...world(), entryTodo(NOTE.id, DONE.id)]);
    await waitUntil(() => openTitles().length === 1, "the note's todo");
    expect(openTitles()).toEqual(["Call the pharmacy back"]);
    expect(doneTitles()).toEqual(["Fax the referral"]);
    await userEvent.click(page.getByRole("checkbox", { name: "Reopen “Fax the referral”" }));
    await expect.poll(openTitles).toEqual(["Call the pharmacy back", "Fax the referral"]);
    await expect.poll(doneTitles).toEqual([]);
    const [row] = await device.query<{ done_at: string | null }>("SELECT done_at FROM todo WHERE id = ?", [
      DONE.id,
    ]);
    expect(row?.done_at).toBeNull();
  });

  test("Add todo on a note opens the sheet with the note's link; saving links the new todo and comes back", async () => {
    const device = await open(`entries/${NOTE.id}`);
    const add = region().getByRole("link", { name: "Add todo" });
    await expect.element(add).toHaveAttribute("href", url(`todos/new?entryId=${NOTE.id}`));
    await userEvent.click(add);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Pick up the refill Thursday");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.poll(() => device.location()).toBe(url(`entries/${NOTE.id}`));
    await expect.poll(openTitles).toContain("Pick up the refill Thursday");
    const [made] = await device.query<{ id: string }>("SELECT id FROM todo WHERE title = ?", [
      "Pick up the refill Thursday",
    ]);
    expect(await linkedTo(device, NOTE.id)).toEqual([made!.id, MINE.id].sort());
    // Offline: the todo and its link wait for upload, the todo first.
    const queued = (await device.queued()).map((w) => `${w.op} ${w.type} ${w.id}`);
    expect(queued).toEqual([
      `PUT todo ${made!.id}`,
      `PUT timeline_entry_todo ${entryTodoId(NOTE.id, made!.id)}`,
    ]);
  });

  test("Add todo on an event opens the sheet with the event chosen", async () => {
    const device = await open(`entries/${VISIT.id}`);
    const add = region().getByRole("link", { name: "Add todo" });
    await expect.element(add).toHaveAttribute("href", url(`todos/new?entryId=${VISIT.id}`));
    await userEvent.click(add);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog.getByText(/^Cardiology follow-up · /)).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Bring the insurance card");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.poll(() => device.location()).toBe(url(`entries/${VISIT.id}`));
    await expect.poll(openTitles).toContain("Bring the insurance card");
  });

  test("Link a todo: the picker offers open todos not linked here; picking links it (queued), focus back", async () => {
    const device = await open(`entries/${NOTE.id}`);
    await waitUntil(() => openTitles().length === 1, "the note's todo");
    const linkButton = await found(() =>
      SECTION()?.querySelector<HTMLButtonElement>("[data-entry-todos-link]"),
    );
    await userEvent.click(linkButton);
    const picker = page.getByRole("combobox", { name: "Find a todo to link" });
    await expect.element(picker).toHaveFocus();
    await device.settle();
    // Linked (MINE), done (DONE) and deleted (GONE) ones aren't offered.
    const names = () =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
        (o) => o.firstElementChild?.textContent,
      );
    await waitUntil(() => names().length === 3, "the options");
    expect(names()).toEqual(["Book the ride", "Ask about the stress test", "Renew the parking permit"]);
    await userEvent.keyboard("ride");
    await userEvent.click(await found(() => option("Book the ride")));
    await expect.poll(openTitles).toEqual(["Call the pharmacy back", "Book the ride"]);
    expect(await linkedTo(device, NOTE.id)).toEqual([MINE.id, LOOSE.id].sort());
    expect((await device.queued()).map((w) => `${w.op} ${w.type} ${w.id}`)).toEqual([
      `PUT timeline_entry_todo ${entryTodoId(NOTE.id, LOOSE.id)}`,
    ]);
    await expect.poll(() => document.activeElement === linkButton).toBe(true);
  });

  test("Remove takes the link away, not the todo (queued as a DELETE); the other entry keeps it", async () => {
    const device = await open(`entries/${NOTE.id}`);
    await userEvent.click(
      page.getByRole("button", { name: "Remove “Call the pharmacy back” from this note" }),
    );
    await expect.poll(openTitles).toEqual([]);
    expect(await linkedTo(device, NOTE.id)).toEqual([]);
    expect(await linkedTo(device, VISIT.id)).toContain(MINE.id);
    const [kept] = await device.query<{ deleted_at: string | null }>(
      "SELECT deleted_at FROM todo WHERE id = ?",
      [MINE.id],
    );
    expect(kept).toEqual({ deleted_at: null });
    expect((await device.queued()).map((w) => `${w.op} ${w.type} ${w.id}`)).toEqual([
      `DELETE timeline_entry_todo ${entryTodoId(NOTE.id, MINE.id)}`,
    ]);
    // A writer keeps the section, to add or link again.
    await expect.element(region().getByRole("link", { name: "Add todo" })).toBeInTheDocument();
  });

  test("a writer sees the section on a note with none, with its actions", async () => {
    await open(`entries/${EMPTY_NOTE.id}`);
    await expect.element(region().getByText("No todos linked to this note.")).toBeInTheDocument();
    await expect.element(region().getByRole("button", { name: "Link a todo" })).toBeInTheDocument();
    await expect.element(region().getByRole("link", { name: "Add todo" })).toBeInTheDocument();
  });

  test("a viewer ticks only their own todo and gets no Add, Link or Remove", async () => {
    const device = await open(`entries/${VISIT.id}`, "viewer");
    await waitUntil(() => openTitles().length === 2, "the open todos");
    expect(ticks()).toEqual(["Mark “Call the pharmacy back” done"]);
    expect(
      SECTION()?.querySelector("[data-entry-todos-add], [data-entry-todos-link], [data-entry-todo-remove]"),
    ).toBeNull();
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Call the pharmacy back” done" }));
    await expect.poll(doneTitles).toEqual(["Call the pharmacy back", "Fax the referral"]);
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);
  });

  test("a viewer sees no section on a note with nothing linked", async () => {
    await open(`entries/${EMPTY_NOTE.id}`, "viewer");
    await expect.poll(() => document.querySelector(".ProseMirror")?.textContent).toContain("Fine night.");
    expect(SECTION()).toBeNull();
  });

  test.each([
    ["vital", () => fx.vital({ id: id(20) })],
    ["symptom", () => fx.symptom({ id: id(20) })],
    ["dose", () => fx.dose({ id: id(20), medicationId: id(30) })],
  ])("a %s has no entry page and no Todos, even with a link row", async (_kind, entry) => {
    const medication = fx.medication({ id: id(30), name: "Metformin" });
    const device = await open(`entries/${id(20)}`, "owner", [
      ...world(),
      medication,
      entry(),
      entryTodo(id(20), OTHER.id),
    ]);
    await expect.element(device.screen.getByRole("heading", { name: "Not found" })).toBeVisible();
    expect(SECTION()).toBeNull();
  });
});
