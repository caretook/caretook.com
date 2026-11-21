import type { DeviceRoute } from "../../../../../test/device";

import { addDays, localDate } from "@caretook/data/schema";
import { nextOccurrence } from "@caretook/data/series";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as todosRoute from "./route";
import * as todoPage from "../todo/route";
import { renderWithDevice } from "../../../../../test/device";
import { found } from "../../../../../test/found";
import { todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTodoUndo } from "~/lib/todos/todoUndo";

// Repeating todos on the screens (planner-2): the form's Repeat (off without
// a due day, saved and reopened as chosen, turned off), the row's mark and
// the page's wording, a tick bringing the next one and Undo taking it away,
// and Delete's Skip this one / Delete and stop repeating. The writes'
// own rules are the device and integration tests.

const BASE = "/app/groups/:groupId/todos";
const ROUTES: DeviceRoute[] = [
  {
    path: BASE,
    module: todosRoute,
    children: [
      { path: `${BASE}/new`, module: newSheet },
      { path: `${BASE}/:todoId/edit`, module: editSheet },
    ],
  },
  { path: `${BASE}/:todoId`, module: todoPage },
];
const LIST = `/app/groups/${TEST_GROUP.id}/todos`;
const EVERYONE = `${LIST}?who=everyone`;

const today = localDate(new Date(), TEST_TIME_ZONE);
/** The first Monday after today. */
const monday = (() => {
  for (let n = 1; ; n++) {
    const day = addDays(today, n);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 1) return day;
  }
})();

const WEEKLY_MONDAY = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
const BINS_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d01";
// Due today (a Monday rule anchored a week before it), so a tick brings next Monday's.
const BINS = todo({
  id: BINS_ID,
  title: "Put the bins out",
  dueOn: today,
  assigneeId: TEST_USER.id,
  repeatRule: WEEKLY_MONDAY,
  repeatStartsOn: addDays(monday, -7),
  repeatId: BINS_ID,
});
const PLAIN = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d02",
  title: "Fax the form",
  dueOn: addDays(today, 1),
  assigneeId: TEST_USER.id,
});
const NEXT = nextOccurrence(
  {
    groupId: TEST_GROUP.id,
    recipientId: "",
    title: "Put the bins out",
    assigneeId: TEST_USER.id,
    assigneeName: null,
    dueOn: today,
    dueTime: null,
    providerId: null,
    medicationId: null,
    repeatRule: WEEKLY_MONDAY,
    repeatStartsOn: addDays(monday, -7),
    repeatId: BINS_ID,
  },
  today,
)!;

const open = (url = EVERYONE, fixtures = [BINS, PLAIN]) =>
  renderWithDevice({ route: ROUTES, url, role: "owner", fixtures });

const row = (id: string) => document.querySelector(`main [data-todo="${id}"]`);
const titles = (section: string) =>
  [...document.querySelectorAll(`[data-todo-section="${section}"] [data-todo-title]`)].map((el) =>
    el.textContent?.trim(),
  );
type RepeatRow = {
  repeat_rule: string | null;
  repeat_starts_on: string | null;
  repeat_id: string | null;
};
const repeatOf = async (device: Awaited<ReturnType<typeof open>>, title: string) =>
  (
    await device.query<RepeatRow & { id: string }>(
      "SELECT id, repeat_rule, repeat_starts_on, repeat_id FROM todo WHERE title = ? AND deleted_at IS NULL",
      [title],
    )
  )[0];

afterEach(() => clearTodoUndo());

describe("the form's Repeat", () => {
  test("is off without a due day; a weekly rule saves, reopens as chosen, and turns off", async () => {
    const device = await open();
    await userEvent.click(page.getByRole("button", { name: "Add", exact: true }));
    await userEvent.click(page.getByRole("menuitem", { name: "Todo" }));
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Water the plants");
    const repeat = dialog.getByRole("button", { name: "Repeat: Doesn't repeat" });
    await expect.element(repeat).toBeDisabled();
    await expect.element(dialog.getByText("Choose a due day to repeat")).toBeInTheDocument();

    await userEvent.fill(dialog.getByLabelText("Due (optional)"), monday);
    await expect.element(repeat).toBeEnabled();
    await userEvent.click(repeat);
    const sheet = page.getByRole("dialog", { name: "Repeat" });
    await userEvent.selectOptions(sheet.getByRole("combobox", { name: "Repeat" }), "weekly");
    await expect.element(sheet.getByText("Every Mon", { exact: true })).toBeInTheDocument();
    await userEvent.click(sheet.getByRole("button", { name: "Done" }));
    await expect.element(sheet).not.toBeInTheDocument();
    await expect
      .element(dialog.getByRole("button", { name: "Repeat: Repeats weekly on Monday" }))
      .toBeInTheDocument();

    // Clearing the day clears the repeat; setting it again starts from none.
    await userEvent.clear(dialog.getByLabelText("Due (optional)"));
    await expect.element(dialog.getByRole("button", { name: "Repeat: Doesn't repeat" })).toBeDisabled();
    await userEvent.fill(dialog.getByLabelText("Due (optional)"), monday);
    await userEvent.click(dialog.getByRole("button", { name: "Repeat: Doesn't repeat" }));
    await userEvent.selectOptions(sheet.getByRole("combobox", { name: "Repeat" }), "weekly");
    await userEvent.click(sheet.getByRole("button", { name: "Done" }));
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));

    await expect.poll(() => titles(monday)).toContain("Water the plants");
    const saved = await repeatOf(device, "Water the plants");
    expect(saved).toEqual({
      id: saved!.id,
      repeat_rule: WEEKLY_MONDAY,
      repeat_starts_on: monday,
      repeat_id: saved!.id,
    });
    await found(() => row(saved!.id)?.querySelector("[data-repeat-mark]"));
  });

  test("the edit sheet reopens the repeat as chosen; Doesn't repeat makes an ordinary todo", async () => {
    const device = await open(`${LIST}/${BINS_ID}/edit?who=everyone`);
    const dialog = page.getByRole("dialog", { name: "Edit todo" });
    const repeat = dialog.getByRole("button", { name: "Repeat: Repeats weekly on Monday" });
    await expect.element(repeat).toBeEnabled();
    await userEvent.click(repeat);
    const sheet = page.getByRole("dialog", { name: "Repeat" });
    await expect.element(sheet.getByRole("combobox", { name: "Repeat" })).toHaveValue("weekly");
    await expect.element(sheet.getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.selectOptions(sheet.getByRole("combobox", { name: "Repeat" }), "none");
    await userEvent.click(sheet.getByRole("button", { name: "Done" }));
    await expect.element(dialog.getByRole("button", { name: "Repeat: Doesn't repeat" })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));

    await expect.poll(() => device.location()).toBe(EVERYONE);
    await expect
      .poll(() => repeatOf(device, "Put the bins out"))
      .toEqual({
        id: BINS_ID,
        repeat_rule: null,
        repeat_starts_on: null,
        repeat_id: null,
      });
    await expect.poll(() => row(BINS_ID)?.querySelector("[data-repeat-mark]") ?? null).toBeNull();
  });
});

describe("a repeating todo in the list and on its page", () => {
  test("has the mark, named for screen readers; its page says the repeat in words", async () => {
    await open();
    const bins = await found(() => row(BINS_ID));
    const mark = bins.querySelector("[data-repeat-mark]");
    expect(mark?.textContent).toBe("Repeats");
    expect(row(PLAIN.id)?.querySelector("[data-repeat-mark]")).toBeNull();

    await userEvent.click(page.getByRole("link", { name: "Put the bins out" }));
    await expect
      .element(page.getByRole("heading", { name: "Put the bins out", level: 1 }))
      .toBeInTheDocument();
    await expect.element(page.getByText("Repeats weekly on Monday")).toBeVisible();
  });

  test("a tick moves it to Done and brings the next under its day; Undo takes the next away", async () => {
    const device = await open();
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Put the bins out” done" }));
    await expect.poll(() => titles("done")).toContain("Put the bins out");
    await expect.poll(() => titles(NEXT.dueOn)).toEqual(["Put the bins out"]);
    expect(titles("today")).toEqual([]);
    const next = await found(() => row(NEXT.id));
    expect(next.querySelector("[data-repeat-mark]")).not.toBeNull();

    await userEvent.click(page.getByRole("button", { name: "Undo Put the bins out" }));
    await expect.poll(() => titles("today")).toEqual(["Put the bins out"]);
    await expect.poll(() => titles(NEXT.dueOn)).toEqual([]);
    // Each list is its own query, so Done can still be catching up.
    await expect.poll(() => titles("done")).toEqual([]);
    const rows = await device.query<{ id: string; done: number; deleted: number }>(
      "SELECT id, done_at IS NOT NULL AS done, deleted_at IS NOT NULL AS deleted FROM todo WHERE repeat_id = ? ORDER BY due_on",
      [BINS_ID],
    );
    expect(rows).toEqual([
      { id: BINS_ID, done: 0, deleted: 0 },
      { id: NEXT.id, done: 0, deleted: 1 },
    ]);
  });
});

describe("Delete on a repeating todo", () => {
  const askDelete = async (title: string) => {
    await userEvent.click(page.getByRole("link", { name: title }));
    await expect.element(page.getByRole("heading", { name: title, level: 1 })).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: `Actions for ${title}` }));
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
  };
  const live = async (device: Awaited<ReturnType<typeof open>>) =>
    (
      await device.query<{ id: string }>(
        "SELECT id FROM todo WHERE repeat_id = ? AND deleted_at IS NULL ORDER BY due_on",
        [BINS_ID],
      )
    ).map((r) => r.id);

  test("asks Skip this one, Delete and stop repeating, or Cancel; Cancel keeps it", async () => {
    const device = await open();
    await askDelete("Put the bins out");
    const dialog = page.getByRole("dialog", { name: "Delete this repeating todo?" });
    await expect.element(dialog).toBeVisible();
    expect([...document.querySelectorAll("dialog[open] button")].map((b) => b.textContent?.trim())).toEqual([
      "Skip this one",
      "Delete and stop repeating",
      "Cancel",
    ]);
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
    expect(await live(device)).toEqual([BINS_ID]);
  });

  test("Skip this one removes it and the next one shows in the list", async () => {
    const device = await open();
    await askDelete("Put the bins out");
    await userEvent.click(page.getByRole("button", { name: "Skip this one" }));
    await expect.poll(() => device.location()).toBe(EVERYONE);
    await expect.poll(() => live(device)).toEqual([NEXT.id]);
    await expect.poll(() => titles(NEXT.dueOn)).toEqual(["Put the bins out"]);
    expect(titles("today")).toEqual([]);
  });

  test("Delete and stop repeating removes it with no next", async () => {
    const device = await open();
    await askDelete("Put the bins out");
    await userEvent.click(page.getByRole("button", { name: "Delete and stop repeating" }));
    await expect.poll(() => device.location()).toBe(EVERYONE);
    await expect.poll(() => live(device)).toEqual([]);
    await expect.poll(() => row(BINS_ID)).toBeNull();
    expect(document.querySelector(`main [data-todo="${NEXT.id}"]`)).toBeNull();
  });

  test("an ordinary todo keeps its one confirm", async () => {
    await open();
    await askDelete("Fax the form");
    await expect.element(page.getByRole("heading", { name: "Delete this todo?" })).toBeVisible();
    expect(page.getByRole("button", { name: "Skip this one" }).query()).toBeNull();
  });
});
