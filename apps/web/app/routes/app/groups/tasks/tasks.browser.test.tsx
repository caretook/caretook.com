import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as tasksRoute from "./route";
import * as taskPage from "../task/route";
import { renderWithDevice } from "../../../../../test/device";
import { pageHeader } from "../../../../../test/pageHeader";
import { at, fx, hoursAgo, task, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearTaskUndo } from "~/lib/tasks/taskUndo";

// The Tasks section (tasks slice 1): the list's chips, sections, ticks with
// Undo, Done with Reopen, what viewers see, and the add and edit sheets with
// their guards. The service's own rules are integration tests.

const BASE = "/app/groups/:groupId/tasks";
const ROUTES: DeviceRoute[] = [
  {
    path: BASE,
    module: tasksRoute,
    children: [
      { path: `${BASE}/new`, module: newSheet },
      { path: `${BASE}/:taskId/edit`, module: editSheet },
    ],
  },
  { path: `${BASE}/:taskId`, module: taskPage },
];
const LIST = `/app/groups/${TEST_GROUP.id}/tasks`;

const today = localDate(new Date(), TEST_TIME_ZONE);
const day = (n: number) => addDays(today, n);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });

const world = () => [
  SAM,
  task({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b01",
    title: "Call the pharmacy",
    dueOn: day(-2),
    assigneeId: TEST_USER.id,
  }),
  task({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b02",
    title: "Pick up the walker",
    dueOn: today,
    assigneeId: TEST_USER.id,
  }),
  task({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b03",
    title: "Fax the form",
    dueOn: day(3),
    assigneeId: SAM_ID,
  }),
  task({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b04",
    title: "Drive to physio",
    dueOn: day(1),
    assigneeName: "Aunt May",
  }),
  task({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b05", title: "Sort the batteries" }),
  task({
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

const titles = (section: string) =>
  [...document.querySelectorAll(`[data-task-section="${section}"] [data-task-title]`)].map((el) =>
    el.textContent?.trim(),
  );
const ticks = () => [...document.querySelectorAll<HTMLInputElement>("main [data-task-tick]")];
const chip = (name: string) =>
  page.getByRole("navigation", { name: "Show tasks" }).getByRole("link", { name });

afterEach(() => clearTaskUndo());

describe("the task list", () => {
  test("opens on Mine when I have open tasks, in sections; Everyone shows the rest, typed names too", async () => {
    const device = await open();
    await expect.element(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeInTheDocument();
    expect(pageHeader()).toEqual({ h1: "Tasks", namesRecipient: false, viewerNote: false });
    await expect.element(chip("Mine")).toHaveAttribute("aria-current", "true");
    expect(titles("overdue")).toEqual(["Call the pharmacy"]);
    expect(titles("today")).toEqual(["Pick up the walker"]);
    expect(document.querySelector('[data-task-section="undated"]')).toBeNull();
    await expect.element(page.getByText("Overdue · 2 days")).toBeInTheDocument();

    await userEvent.click(chip("Everyone"));
    await expect.poll(() => titles(day(1))).toEqual(["Drive to physio"]);
    expect(device.location()).toContain("who=everyone");
    expect(titles(day(3))).toEqual(["Fax the form"]);
    expect(titles("undated")).toEqual(["Sort the batteries"]);
    const typed = document.querySelector('[data-task-section] [data-task-assignee="name"]');
    expect(typed?.textContent).toContain("Aunt May");

    // Unassigned: nobody's, so not Aunt May's.
    await userEvent.click(chip("Unassigned"));
    await expect
      .poll(() => [...document.querySelectorAll("[data-task-section] [data-task-title]")].length)
      .toBe(1);
    expect(titles("undated")).toEqual(["Sort the batteries"]);
    expect(titles("done")).toEqual([]);
  });

  test("opens on Everyone when nothing open is mine", async () => {
    await open("owner", LIST, [SAM, task({ title: "Fax the form", assigneeId: SAM_ID })]);
    await expect.element(chip("Everyone")).toHaveAttribute("aria-current", "true");
    expect(titles("undated")).toEqual(["Fax the form"]);
  });

  test("a tick completes the task, with one Undo in a polite status; the upload is done-only", async () => {
    const device = await open();
    await expect
      .element(page.getByRole("checkbox", { name: "Mark “Pick up the walker” done" }))
      .toBeInTheDocument();
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Pick up the walker” done" }));

    const status = page.getByRole("status").filter({ hasText: "Done: Pick up the walker" });
    await expect.element(status).toBeInTheDocument();
    await expect.poll(() => titles("today")).toEqual([]);
    expect(titles("done")).toContain("Pick up the walker");
    await expect.element(page.getByText("Done by you · today")).toBeInTheDocument();
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);

    await userEvent.click(page.getByRole("button", { name: "Undo Pick up the walker" }));
    await expect.poll(() => titles("today")).toEqual(["Pick up the walker"]);
    expect(document.querySelector("[data-task-undo]")).toBeNull();
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
      [...document.querySelectorAll("[data-task-undo] [data-task-undo-label]")].map((el) => el.textContent);
    await expect.poll(lines).toEqual(["Done: Pick up the walker", "Done: Call the pharmacy"]);
    // Both lines sit in the one status region.
    expect(document.querySelectorAll('[role="status"] [data-task-undo-line]')).toHaveLength(2);
    await expect.element(page.getByRole("button", { name: "Undo Pick up the walker" })).toBeVisible();

    await userEvent.click(page.getByRole("button", { name: "Undo Call the pharmacy" }));
    await expect.poll(() => titles("overdue")).toEqual(["Call the pharmacy"]);
    await expect.poll(lines).toEqual(["Done: Pick up the walker"]);
    // Each list is its own query, so the done list can still be catching up.
    await expect.poll(() => titles("today")).toEqual([]);
    await expect.poll(() => titles("done")).toContain("Pick up the walker");
    await expect.poll(() => titles("done")).not.toContain("Call the pharmacy");
    const rows = await device.query<{ title: string; done: number }>(
      "SELECT title, done_at IS NOT NULL AS done FROM task WHERE title IN ('Call the pharmacy', 'Pick up the walker') ORDER BY title",
    );
    expect(rows).toEqual([
      { title: "Call the pharmacy", done: 0 },
      { title: "Pick up the walker", done: 1 },
    ]);
  });

  test("Done lists finished tasks newest first; unticking one reopens it", async () => {
    await open("owner", `${LIST}?who=everyone`);
    await expect.poll(() => titles("done")).toEqual(["Book the eye exam"]);
    await expect.element(page.getByText("Done by Sam Okafor · today")).toBeInTheDocument();
    await userEvent.click(page.getByRole("checkbox", { name: "Reopen “Book the eye exam”" }));
    await expect.poll(() => titles("undated")).toEqual(["Book the eye exam", "Sort the batteries"]);
    expect(titles("done")).toEqual([]);
  });

  test("a viewer sees ticks only on their own tasks and no Add, under the same header", async () => {
    const mine = task({
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
    expect(document.querySelector("[data-add-task]")).toBeNull();
    expect(pageHeader()).toEqual({ h1: "Tasks", namesRecipient: false, viewerNote: false });
  });

  test("a row opens the task's page, for viewers too; its way back keeps the chip", async () => {
    const device = await open("viewer", `${LIST}?who=everyone`);
    await userEvent.click(page.getByRole("link", { name: "Fax the form" }));
    await expect.element(page.getByRole("heading", { name: "Fax the form", level: 1 })).toBeInTheDocument();
    expect(device.location()).toBe(`${LIST}/7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b03`);
    await userEvent.click(page.getByRole("link", { name: "Tasks" }));
    await expect.poll(() => device.location()).toBe(`${LIST}?who=everyone`);
  });
});

describe("the task sheets", () => {
  test("adds a task for someone outside the group, due on a day at a time", async () => {
    const device = await open("owner", `${LIST}?who=everyone`);
    await userEvent.click(page.getByRole("link", { name: "Add task" }));
    const dialog = page.getByRole("dialog", { name: "Add a task" });
    await expect.element(dialog).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Task" }), "Water the plants");
    await userEvent.click(dialog.getByRole("combobox", { name: "Assign to" }));
    await userEvent.keyboard("Aunt May");
    await userEvent.click(page.getByRole("option", { name: 'Assign to "Aunt May" (not in the group)' }));
    await expect.element(dialog.getByText("Aunt May (not in the group)")).toBeInTheDocument();
    await userEvent.fill(dialog.getByLabelText("Due (optional)"), day(2));
    await userEvent.fill(dialog.getByLabelText("Time (optional)"), "17:30");
    await userEvent.click(dialog.getByRole("button", { name: "Add task" }));

    await expect.poll(() => titles(day(2))).toEqual(["Water the plants"]);
    const [row] = await device.query<{ assignee_name: string; assignee_id: string | null; due_time: string }>(
      "SELECT assignee_name, assignee_id, due_time FROM task WHERE title = 'Water the plants'",
    );
    expect(row).toEqual({ assignee_name: "Aunt May", assignee_id: null, due_time: "17:30" });
  });

  test("adds a task for a member, due on a day without a time; a blank title is refused", async () => {
    const device = await open("owner", `${LIST}?who=everyone`);
    await userEvent.click(page.getByRole("link", { name: "Add task" }));
    const dialog = page.getByRole("dialog", { name: "Add a task" });
    await userEvent.click(dialog.getByRole("button", { name: "Add task" }));
    await expect
      .element(dialog.getByRole("textbox", { name: "Task" }))
      .toHaveAttribute("aria-invalid", "true");

    await userEvent.fill(dialog.getByRole("textbox", { name: "Task" }), "Renew the bus pass");
    await userEvent.click(dialog.getByRole("combobox", { name: "Assign to" }));
    await userEvent.click(page.getByRole("option", { name: "Sam Okafor" }));
    await userEvent.fill(dialog.getByLabelText("Due (optional)"), day(4));
    await userEvent.click(dialog.getByRole("button", { name: "Add task" }));

    await expect.poll(() => titles(day(4))).toEqual(["Renew the bus pass"]);
    const [row] = await device.query<{ assignee_id: string; due_time: string | null }>(
      "SELECT assignee_id, due_time FROM task WHERE title = 'Renew the bus pass'",
    );
    expect(row).toEqual({ assignee_id: SAM_ID, due_time: null });
  });

  test("guards: a viewer's add sheet and a missing task's edit sheet go to the list", async () => {
    const viewer = await open("viewer", `${LIST}/new?who=mine`);
    await expect.poll(() => viewer.location()).toBe(`${LIST}?who=mine`);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test("guards: a missing task's edit sheet goes to the list", async () => {
    const device = await open("owner", `${LIST}/7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7bff/edit`);
    await expect.poll(() => device.location()).toBe(LIST);
  });
});
