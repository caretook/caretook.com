import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as todosRoute from "./route";
import * as todoPage from "../todo/route";
import { renderWithDevice } from "../../../../../test/device";
import { pageHeader } from "../../../../../test/pageHeader";
import { at, fx, hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTodoUndo } from "~/lib/todos/todoUndo";

// The Planner's Todos tab (todos slice 1; tasks-2 put it under the Planner header): the list's Filter menu, sections, ticks with
// Undo, Done with Reopen, what viewers see, and the add and edit sheets with
// their guards. The service's own rules are integration tests.

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

const today = localDate(new Date(), TEST_TIME_ZONE);
const day = (n: number) => addDays(today, n);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });

const world = () => [
  SAM,
  todo({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b01",
    title: "Call the pharmacy",
    dueOn: day(-2),
    assigneeId: TEST_USER.id,
  }),
  todo({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b02",
    title: "Pick up the walker",
    dueOn: today,
    assigneeId: TEST_USER.id,
  }),
  todo({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b03",
    title: "Fax the form",
    dueOn: day(3),
    assigneeId: SAM_ID,
  }),
  todo({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b04",
    title: "Drive to physio",
    dueOn: day(1),
    assigneeName: "Aunt May",
  }),
  todo({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b05", title: "Sort the batteries" }),
  todo({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b06",
    title: "Book the eye exam",
    assigneeId: SAM_ID,
    createdAt: hoursAgo(1),
    doneAt: at(new Date(Date.now() - 60_000)),
    doneBy: SAM_ID,
  }),
];

const open = (role: GroupRole = "owner", url = LIST, fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url, role, fixtures });

/** The header's Add menu, then Todo: the add sheet. */
const addTodo = async () => {
  await userEvent.click(page.getByRole("button", { name: "Add", exact: true }));
  await userEvent.click(page.getByRole("menuitem", { name: "Todo" }));
};

const titles = (section: string) =>
  [...document.querySelectorAll(`[data-todo-section="${section}"] [data-todo-title]`)].map((el) =>
    el.textContent?.trim(),
  );
const ticks = () => [...document.querySelectorAll<HTMLInputElement>("main [data-todo-tick]")];
/** The Filter button, by its exact name: the menu ("Filter todos") and the chips ("Filters on") are named alike. */
const filterButton = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
const openFilters = async () => {
  await expect.element(filterButton()).toBeVisible();
  await userEvent.click(filterButton());
};
/** Opens the Filter menu and chooses an option (the menu closes). */
const choose = async (option: string) => {
  await openFilters();
  await userEvent.click(page.getByRole("menuitemradio", { name: option, exact: true }));
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
};
/** The labels of the "Filters on" chips (without their ✕). */
const chips = () =>
  [...document.querySelectorAll('main nav[aria-label="Filters on"] a')].map((a) => a.textContent?.trim());
const openTitles = () =>
  [...document.querySelectorAll("[data-todo-section]:not([data-todo-section=done]) [data-todo-title]")].map(
    (el) => el.textContent?.trim(),
  );

afterEach(() => clearTodoUndo());

describe("the todo list", () => {
  test("opens on Everyone even with open todos of my own, in sections, with no count and no chip", async () => {
    const device = await open();
    await expect.element(page.getByRole("heading", { name: "Planner", level: 1 })).toBeInTheDocument();
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });
    await expect
      .element(
        page.getByRole("navigation", { name: "Upcoming, past or todos" }).getByRole("link", { name: "Todos" }),
      )
      .toHaveAttribute("aria-current", "page");
    await expect.poll(() => titles("undated")).toEqual(["Sort the batteries"]);
    await expect.poll(() => titles("overdue")).toEqual(["Call the pharmacy"]);
    await expect.poll(() => titles("today")).toEqual(["Pick up the walker"]);
    await expect.poll(() => titles(day(1))).toEqual(["Drive to physio"]);
    await expect.poll(() => titles(day(3))).toEqual(["Fax the form"]);
    await expect.element(page.getByText("Overdue · 2 days")).toBeInTheDocument();
    const typed = document.querySelector('[data-todo-section] [data-todo-assignee="name"]');
    expect(typed?.textContent).toContain("Aunt May");

    await expect.element(filterButton()).toHaveAccessibleName("Filter");
    expect(document.querySelector("[data-filter-count]")).toBeNull();
    expect(document.querySelector('main nav[aria-label="Filters on"]')).toBeNull();
    expect(device.location()).toBe(LIST);

    // One section, Everyone first and checked.
    await openFilters();
    const menu = page.getByRole("menu", { name: "Filter todos" });
    await expect.element(menu).toBeVisible();
    const sections = [...menu.element().querySelectorAll('[role="group"]')].map((group) => [
      group.getAttribute("aria-label") ??
        document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent,
      [...group.querySelectorAll('[role="menuitemradio"]')].map((item) => item.textContent?.trim()),
    ]);
    expect(sections).toEqual([["Assigned to", ["Everyone", "Mine", "Unassigned"]]]);
    await expect.element(page.getByRole("menuitemradio", { name: "Everyone" })).toBeChecked();
    expect(page.getByRole("menuitem", { name: "Clear filters" }).query()).toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(filterButton()).toHaveFocus();
  });

  test("Mine narrows to mine, shows its chip and the count; its ✕ returns to Everyone; Unassigned isn't a typed name's", async () => {
    const device = await open();
    await expect.poll(() => titles(day(1))).toEqual(["Drive to physio"]);

    await choose("Mine");
    await expect.poll(openTitles).toEqual(["Call the pharmacy", "Pick up the walker"]);
    expect(device.location()).toBe(`${LIST}?who=mine`);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    expect(document.querySelector("[data-filter-count]")?.textContent).toBe("1");
    await expect.poll(() => chips()).toEqual(["Mine"]);

    await userEvent.click(page.getByRole("link", { name: "Mine: clear this filter" }));
    await expect.poll(() => titles(day(1))).toEqual(["Drive to physio"]);
    expect(device.location()).toBe(LIST);
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
    await expect.poll(() => chips()).toEqual([]);

    // Unassigned: nobody's, so not Aunt May's.
    await choose("Unassigned");
    await expect.poll(openTitles).toEqual(["Sort the batteries"]);
    await expect.poll(() => chips()).toEqual(["Unassigned"]);
    await expect.poll(() => titles("done")).toEqual([]);

    // Clear filters goes back to Everyone too.
    await openFilters();
    await userEvent.click(page.getByRole("menuitem", { name: "Clear filters" }));
    await expect.poll(() => titles(day(3))).toEqual(["Fax the form"]);
    expect(device.location()).toBe(LIST);
  });

  test("the choice survives a reload (?who=) and the add sheet opening and closing", async () => {
    const device = await open("owner", `${LIST}?who=mine`);
    await expect.poll(openTitles).toEqual(["Call the pharmacy", "Pick up the walker"]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    await expect.poll(() => chips()).toEqual(["Mine"]);
    await openFilters();
    await expect.element(page.getByRole("menuitemradio", { name: "Mine" })).toBeChecked();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();

    await addTodo();
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog).toBeInTheDocument();
    expect(device.location()).toBe(`${LIST}/new?who=mine`);
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.poll(() => device.location()).toBe(`${LIST}?who=mine`);
    await expect.poll(() => openTitles()).toEqual(["Call the pharmacy", "Pick up the walker"]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    await expect.poll(() => chips()).toEqual(["Mine"]);
  });

  test("a tick completes the todo, with one Undo in a polite status; the upload is done-only", async () => {
    const device = await open();
    await expect
      .element(page.getByRole("checkbox", { name: "Mark “Pick up the walker” done" }))
      .toBeInTheDocument();
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Pick up the walker” done" }));

    const status = page.getByRole("status").filter({ hasText: "Done: Pick up the walker" });
    await expect.element(status).toBeInTheDocument();
    await expect.poll(() => titles("today")).toEqual([]);
    await expect.poll(() => titles("done")).toContain("Pick up the walker");
    await expect.element(page.getByText("Done by you · today")).toBeInTheDocument();
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);

    await userEvent.click(page.getByRole("button", { name: "Undo Pick up the walker" }));
    await expect.poll(() => titles("today")).toEqual(["Pick up the walker"]);
    expect(document.querySelector("[data-todo-undo]")).toBeNull();
  });

  test("two ticks each keep their own Undo; undoing the first reopens only it", async () => {
    const device = await open();
    const pharmacy = page.getByRole("checkbox", { name: "Mark “Call the pharmacy” done" });
    await expect.element(pharmacy).toBeInTheDocument();
    await userEvent.click(pharmacy);
    await expect.poll(() => titles("overdue")).toEqual([]);
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Pick up the walker” done" }));
    await expect.poll(() => titles("today")).toEqual([]);

    // One status region, newest first, each line with its own Undo.
    const lines = () =>
      [...document.querySelectorAll("[data-todo-undo] [data-todo-undo-label]")].map((el) => el.textContent);
    await expect.poll(lines).toEqual(["Done: Pick up the walker", "Done: Call the pharmacy"]);
    // Both lines sit in the one status region.
    expect(document.querySelectorAll('[role="status"] [data-todo-undo-line]')).toHaveLength(2);
    await expect.element(page.getByRole("button", { name: "Undo Pick up the walker" })).toBeVisible();

    await userEvent.click(page.getByRole("button", { name: "Undo Call the pharmacy" }));
    await expect.poll(() => titles("overdue")).toEqual(["Call the pharmacy"]);
    await expect.poll(lines).toEqual(["Done: Pick up the walker"]);
    // Each list is its own query, so the done list can still be catching up.
    await expect.poll(() => titles("today")).toEqual([]);
    await expect.poll(() => titles("done")).toContain("Pick up the walker");
    await expect.poll(() => titles("done")).not.toContain("Call the pharmacy");
    const rows = await device.query<{ title: string; done: number }>(
      "SELECT title, done_at IS NOT NULL AS done FROM todo WHERE title IN ('Call the pharmacy', 'Pick up the walker') ORDER BY title",
    );
    expect(rows).toEqual([
      { title: "Call the pharmacy", done: 0 },
      { title: "Pick up the walker", done: 1 },
    ]);
  });

  test("Done lists finished todos newest first; unticking one reopens it", async () => {
    await open("owner", `${LIST}?who=everyone`);
    await expect.poll(() => titles("done")).toEqual(["Book the eye exam"]);
    await expect.element(page.getByText("Done by Sam Okafor · today")).toBeInTheDocument();
    await userEvent.click(page.getByRole("checkbox", { name: "Reopen “Book the eye exam”" }));
    await expect.poll(() => titles("undated")).toEqual(["Book the eye exam", "Sort the batteries"]);
    // The Done list is its own query, so it can still be catching up.
    await expect.poll(() => titles("done")).toEqual([]);
  });

  test("a viewer sees ticks only on their own todos and no Add, under the same header", async () => {
    const mine = todo({
      title: "Pick up groceries",
      dueOn: today,
      assigneeId: TEST_USER.id,
      createdAt: hoursAgo(1),
    });
    await open("viewer", `${LIST}?who=everyone`, [...world(), mine]);
    await expect.poll(() => titles("today")).toEqual(["Pick up the walker", "Pick up groceries"]);
    expect(ticks().map((t) => t.getAttribute("aria-label"))).toEqual([
      "Mark “Call the pharmacy” done",
      "Mark “Pick up the walker” done",
      "Mark “Pick up groceries” done",
    ]);
    expect(page.getByRole("button", { name: "Add", exact: true }).query()).toBeNull();
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });
  });

  test("a row opens the todo's page, for viewers too; its way back keeps the chip", async () => {
    const device = await open("viewer", `${LIST}?who=everyone`);
    await userEvent.click(page.getByRole("link", { name: "Fax the form" }));
    await expect.element(page.getByRole("heading", { name: "Fax the form", level: 1 })).toBeInTheDocument();
    expect(device.location()).toBe(`${LIST}/7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b03`);
    await userEvent.click(page.getByRole("link", { name: "Todos" }));
    await expect.poll(() => device.location()).toBe(`${LIST}?who=everyone`);
  });
});

describe("the todo sheets", () => {
  test("adds a todo for someone outside the group, due on a day at a time", async () => {
    const device = await open("owner", `${LIST}?who=everyone`);
    await addTodo();
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Water the plants");
    await userEvent.click(dialog.getByRole("combobox", { name: "Assign to" }));
    await userEvent.keyboard("Aunt May");
    await userEvent.click(page.getByRole("option", { name: 'Assign to "Aunt May" (not in the group)' }));
    await expect.element(dialog.getByText("Aunt May (not in the group)")).toBeInTheDocument();
    await userEvent.fill(dialog.getByLabelText("Due (optional)"), day(2));
    await userEvent.fill(dialog.getByLabelText("Time (optional)"), "17:30");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));

    await expect.poll(() => titles(day(2))).toEqual(["Water the plants"]);
    const [row] = await device.query<{ assignee_name: string; assignee_id: string | null; due_time: string }>(
      "SELECT assignee_name, assignee_id, due_time FROM todo WHERE title = 'Water the plants'",
    );
    expect(row).toEqual({ assignee_name: "Aunt May", assignee_id: null, due_time: "17:30" });
  });

  test("adds a todo for a member, due on a day without a time; a blank title is refused", async () => {
    const device = await open("owner", `${LIST}?who=everyone`);
    await addTodo();
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect
      .element(dialog.getByRole("textbox", { name: "Todo" }))
      .toHaveAttribute("aria-invalid", "true");

    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Renew the bus pass");
    await userEvent.click(dialog.getByRole("combobox", { name: "Assign to" }));
    await userEvent.click(page.getByRole("option", { name: "Sam Okafor" }));
    await userEvent.fill(dialog.getByLabelText("Due (optional)"), day(4));
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));

    await expect.poll(() => titles(day(4))).toEqual(["Renew the bus pass"]);
    const [row] = await device.query<{ assignee_id: string; due_time: string | null }>(
      "SELECT assignee_id, due_time FROM todo WHERE title = 'Renew the bus pass'",
    );
    expect(row).toEqual({ assignee_id: SAM_ID, due_time: null });
  });

  test("guards: a viewer's add sheet and a missing todo's edit sheet go to the list", async () => {
    const viewer = await open("viewer", `${LIST}/new?who=mine`);
    await expect.poll(() => viewer.location()).toBe(`${LIST}?who=mine`);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test("guards: a missing todo's edit sheet goes to the list", async () => {
    const device = await open("owner", `${LIST}/7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7bff/edit`);
    await expect.poll(() => device.location()).toBe(LIST);
  });
});
