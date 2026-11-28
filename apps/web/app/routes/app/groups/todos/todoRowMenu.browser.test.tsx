import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as editSheet from "./edit/route";
import * as todosRoute from "./route";
import * as plannerRoute from "../planner/route";
import * as todoPage from "../todo/route";
import { renderWithDevice } from "../../../../../test/device";
import { getByCss } from "../../../../../test/locators";
import { at, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTodoUndo } from "~/lib/todos/todoUndo";
import { addDays, localDate } from "@caretook/data/domain";

// A todo row's ⋯ (B-1022): the shared `TodoMenu` (Edit, Reopen once done,
// Delete) right of the add-subtask button, on the Planner's Todos tab (open
// trees and Done) for writers only. Edit opens the edit sheet over the list
// and comes back to it, not to the todo's page; Delete asks the page's own
// confirm and the row leaves while the list stays. The page's own ⋯ is
// todo.browser.test.tsx's.

const BASE = "/app/groups/:groupId/todos";
const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/planner", module: plannerRoute },
  { path: BASE, module: todosRoute, children: [{ path: `${BASE}/:todoId/edit`, module: editSheet }] },
  { path: `${BASE}/:todoId`, module: todoPage },
];
const PLANNER = `/app/groups/${TEST_GROUP.id}/planner`;
const LIST = `/app/groups/${TEST_GROUP.id}/todos`;
const MINE = `${LIST}?who=mine`;

const today = localDate(new Date(), TEST_TIME_ZONE);
/** The first Monday after today (as todoRepeat.browser.test.tsx's). */
const monday = (() => {
  for (let n = 1; ; n++) {
    const day = addDays(today, n);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 1) return day;
  }
})();

const PARTY = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e01",
  title: "Plan the party",
  dueOn: today,
  assigneeId: TEST_USER.id,
});
const INVITES = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e02",
  title: "Send the invites",
  dueOn: today,
  parentId: PARTY.id,
  assigneeId: TEST_USER.id,
});
const STAMPS = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e03",
  title: "Buy stamps",
  dueOn: today,
  parentId: INVITES.id,
  assigneeId: TEST_USER.id,
});
const BATTERIES = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e04",
  title: "Sort the batteries",
  assigneeId: TEST_USER.id,
});
const EYES = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e05",
  title: "Book the eye exam",
  assigneeId: TEST_USER.id,
  doneAt: at(new Date(Date.now() - 60_000)),
  doneBy: TEST_USER.id,
});
const BINS = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e06",
  title: "Put the bins out",
  dueOn: today,
  assigneeId: TEST_USER.id,
  repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
  repeatStartsOn: addDays(monday, -7),
  repeatId: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e06",
});
const world = () => [PARTY, INVITES, STAMPS, BATTERIES, EYES, BINS];

const open = (url = MINE, role: GroupRole = "owner") =>
  renderWithDevice({ route: ROUTES, url, role, fixtures: world() });

const rowOf = (id: string) => getByCss(`main [data-todo="${id}"]`);
const menuOf = (title: string) => page.getByRole("button", { name: `Actions for ${title}`, exact: true });
const items = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const openMenu = async (title: string) => {
  await userEvent.click(menuOf(title));
  await expect.element(page.getByRole("menu")).toBeVisible();
};
const live = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
  (await device.query<{ id: string }>("SELECT id FROM todo WHERE id = ? AND deleted_at IS NULL", [id]))
    .length;

afterEach(() => clearTodoUndo());

describe("a todo row's ⋯", () => {
  test("a writer's row has ⋯ right of add subtask: Edit and Delete, and Reopen once done", async () => {
    await open();
    await expect.element(menuOf("Plan the party")).toBeVisible();
    // Right of the add-subtask button, the last control on the row's line, with the row's gap between.
    const row = rowOf(PARTY.id).element();
    const add = row.querySelector<HTMLElement>('button[aria-label="Add subtask to Plan the party"]');
    const menu = row.querySelector<HTMLElement>(
      '[data-todo-actions] button[aria-label="Actions for Plan the party"]',
    );
    expect(add && menu).toBeTruthy();
    const gap = menu!.getBoundingClientRect().left - add!.getBoundingClientRect().right;
    expect(gap).toBeGreaterThanOrEqual(8);

    await openMenu("Plan the party");
    expect(items()).toEqual(["Edit", "Delete"]);
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();

    // A subtask row has its own; a Done row adds Reopen, and it reopens.
    await expect.element(menuOf("Buy stamps")).toBeVisible();
    await openMenu("Book the eye exam");
    expect(items()).toEqual(["Edit", "Reopen", "Delete"]);
    await userEvent.click(page.getByRole("menuitem", { name: "Reopen" }));
    await expect
      .poll(() => document.querySelector(`[data-todo-section=done] [data-todo="${EYES.id}"]`))
      .toBeNull();
    await expect.element(rowOf(EYES.id)).not.toHaveAttribute("data-todo-state", "done");
  });

  test("a reader's rows have none", async () => {
    await open(`${LIST}?who=everyone`, "viewer");
    await expect.element(rowOf(PARTY.id)).toBeInTheDocument();
    await expect.element(rowOf(EYES.id)).toBeInTheDocument();
    expect(document.querySelectorAll('main button[aria-label^="Actions for"]')).toHaveLength(0);
    expect(document.querySelectorAll("main [data-todo-actions]")).toHaveLength(0);
  });
});

describe("Edit from a row", () => {
  test("on the Planner's Todos tab: the sheet opens over the tab, and Cancel comes back to it", async () => {
    const device = await open(PLANNER);
    await userEvent.click(
      page.getByRole("navigation", { name: "Upcoming, past or todos" }).getByRole("link", { name: "Todos" }),
    );
    await expect.element(menuOf("Sort the batteries")).toBeVisible();
    const tab = device.location();
    await openMenu("Sort the batteries");
    await userEvent.click(page.getByRole("menuitem", { name: "Edit" }));
    await expect.element(page.getByRole("dialog", { name: "Edit todo" })).toBeInTheDocument();
    expect(device.location()).toMatch(new RegExp(`^${LIST}/${BATTERIES.id}/edit`));
    // The list stays under the sheet.
    await expect.element(rowOf(PARTY.id)).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => device.location()).toBe(tab);
    await expect.element(page.getByRole("dialog", { name: "Edit todo" })).not.toBeInTheDocument();
    await expect.element(rowOf(BATTERIES.id)).toBeInTheDocument();
  });

  test("on the Todos list with a chip: a save comes back to the list with its chip, not the todo's page", async () => {
    const device = await open(MINE);
    await openMenu("Sort the batteries");
    await userEvent.click(page.getByRole("menuitem", { name: "Edit" }));
    const dialog = page.getByRole("dialog", { name: "Edit todo" });
    await expect.element(dialog).toBeInTheDocument();
    // The sheet carries the list's chip, so the list under it keeps its filter.
    expect(device.location()).toBe(`${LIST}/${BATTERIES.id}/edit?who=mine`);
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Sort the spare batteries");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect.poll(() => device.location()).toBe(MINE);
    await expect
      .element(getByCss(`main [data-todo="${BATTERIES.id}"] [data-todo-title]`))
      .toHaveTextContent("Sort the spare batteries");
    expect(document.querySelector("[data-todo-page]")).toBeNull();
  });
});

describe("Delete from a row", () => {
  test("names every subtask that goes with it; the tree leaves and the list stays", async () => {
    const device = await open();
    await openMenu("Plan the party");
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    const dialog = page.getByRole("dialog", { name: "Delete this todo?" });
    await expect.element(dialog).toBeVisible();
    expect(document.querySelector("dialog[open]")?.textContent).toContain("its 2 subtasks");
    await userEvent.click(dialog.getByRole("button", { name: "Delete", exact: true }));
    await expect.element(rowOf(PARTY.id)).not.toBeInTheDocument();
    await expect.element(rowOf(STAMPS.id)).not.toBeInTheDocument();
    expect(await live(device, PARTY.id)).toBe(0);
    expect(await live(device, STAMPS.id)).toBe(0);
    expect(device.location()).toBe(MINE);
    await expect.element(rowOf(BATTERIES.id)).toBeInTheDocument();
  });

  test("a todo with no subtasks names none; Cancel keeps it", async () => {
    const device = await open();
    await openMenu("Sort the batteries");
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    const dialog = page.getByRole("dialog", { name: "Delete this todo?" });
    await expect.element(dialog).toBeVisible();
    expect(document.querySelector("dialog[open]")?.textContent).not.toContain("subtask");
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
    expect(await live(device, BATTERIES.id)).toBe(1);
  });

  test("an open repeating one asks skip or stop; Skip this one moves it on and the list stays", async () => {
    const device = await open();
    await openMenu("Put the bins out");
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    await expect.element(page.getByRole("dialog", { name: "Delete this repeating todo?" })).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Skip this one" }));
    await expect.element(rowOf(BINS.id)).not.toBeInTheDocument();
    expect(await live(device, BINS.id)).toBe(0);
    // The next one comes, under its own day.
    await expect
      .poll(
        async () =>
          (
            await device.query<{ id: string }>(
              "SELECT id FROM todo WHERE repeat_id = ? AND deleted_at IS NULL",
              [BINS.id],
            )
          ).length,
      )
      .toBe(1);
    expect(device.location()).toBe(MINE);
  });
});
