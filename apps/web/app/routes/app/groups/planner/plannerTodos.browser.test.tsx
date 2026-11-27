import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { useParams } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as plannerRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";

// Todos on the Planner tab (todos slice 4): open dated todos under their day
// (overdue first under Today), a tick for whoever may complete them, a link
// to the todo, and none under a kind or author filter. Placement and order
// are lib/todos/plannerTodos.ts's unit tests; this is what's on the screen.

const PLANNER = `/app/groups/${TEST_GROUP.id}/planner`;

/** Stands in for the todo page (slice 2's). */
function TodoProbe() {
  const { todoId } = useParams();
  return (
    <main>
      <h1>Todo page {todoId}</h1>
    </main>
  );
}

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/planner", module: plannerRoute },
  { path: "/app/groups/:groupId/todos/:todoId", module: { default: TodoProbe } },
];

const today = localDate(new Date(), TEST_TIME_ZONE);
const day = (n: number) => addDays(today, n);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });

const LATE = todo({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c11", title: "Call the pharmacy", dueOn: day(-2) });
const MINE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c12",
  title: "Pick up the walker",
  dueOn: today,
  assigneeId: TEST_USER.id,
});
const SAMS = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c13",
  title: "Fax the form",
  dueOn: day(3),
  dueTime: "15:30",
  assigneeId: SAM_ID,
});

const world = () => [
  SAM,
  LATE,
  MINE,
  SAMS,
  todo({ title: "Sort the batteries" }),
  todo({
    title: "Book the eye exam",
    dueOn: today,
    doneAt: at(new Date(Date.now() - 60_000)),
    doneBy: SAM_ID,
  }),
  todo({ title: "Deleted errand", dueOn: today, deletedAt: at(new Date(Date.now() - 60_000)) }),
  fx.event({ title: "Cardiology follow-up", occurredAt: at(new Date(Date.now() + 3 * 86_400_000)) }),
];

const open = (role: GroupRole = "owner", query = "") =>
  renderWithDevice({ route: ROUTES, url: `${PLANNER}${query}`, role, fixtures: world() });

/** The todo rows' titles in a day's section, in order. */
const todoTitles = (key: string) =>
  [...document.querySelectorAll(`[data-day="${key}"] [data-planner-todo] [data-todo-title]`)].map((el) =>
    el.textContent?.trim(),
  );
const allTodos = () => [...document.querySelectorAll<HTMLElement>("[data-planner-todo]")];
const ticks = () => [...document.querySelectorAll<HTMLInputElement>("[data-planner-todo] [data-todo-tick]")];
const rowOf = (t: { id: string }) => document.querySelector<HTMLElement>(`[data-planner-todo="${t.id}"]`);

describe("todos on the Planner tab", () => {
  test("a writer sees open dated todos under their day, overdue first under Today, each with a tick and a link", async () => {
    await open();
    await expect.poll(() => todoTitles(today)).toEqual(["Call the pharmacy", "Pick up the walker"]);
    expect(todoTitles(day(3))).toEqual(["Fax the form"]);
    // Undated, done and deleted todos aren't upcoming.
    expect(allTodos()).toHaveLength(3);
    expect(document.querySelector('[data-day="now"] [data-planner-todo]')).toBeNull();
    // The day of an appointment holds both.
    const fri = document.querySelector(`[data-day="${day(3)}"]`)!;
    expect(fri.querySelector("[data-upcoming-item]")).toBeTruthy();

    const late = rowOf(LATE)!;
    expect(late.dataset.todoState).toBe("overdue");
    expect(late.querySelector("[data-when]")?.textContent).toBe("Overdue");
    expect(late.querySelector("[data-todo-due]")?.textContent).toBe("Overdue · 2 days");
    expect(late.querySelector("[data-todo-assignee]")?.textContent).toBe("Unassigned");
    expect(rowOf(MINE)?.querySelector("[data-when]")?.textContent).toBe("All day");
    expect(rowOf(MINE)?.querySelector("[data-todo-assignee]")?.textContent).toBe("you");
    expect(rowOf(SAMS)?.querySelector("[data-todo-assignee]")?.textContent).toBe("Sam Okafor");
    expect(ticks()).toHaveLength(3);

    const link = late.querySelector<HTMLAnchorElement>("a[data-planner-todo-open]")!;
    expect(link.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/todos/${LATE.id}`);
    expect(link.getAttribute("aria-label")).toBe("Open todo Call the pharmacy, Overdue · 2 days");
    await userEvent.click(link, { force: true });
    await expect.element(page.getByRole("heading", { name: `Todo page ${LATE.id}` })).toBeInTheDocument();
  });

  test("a todo row is laid out like an event card: its due time above the title, the assignee on the right (B-636)", async () => {
    await open();
    await expect.poll(() => rowOf(SAMS)?.querySelector("[data-when]")?.textContent).toBe("15:30");
    const row = rowOf(SAMS)!;
    // No side column of times: the time and the title share one column, time first.
    expect(row.querySelector("[data-when-column]")).toBeNull();
    const box = (sel: string) => row.querySelector(sel)!.getBoundingClientRect();
    const time = box("[data-when]");
    const title = box("[data-todo-title]");
    const tick = box("[data-todo-tick]");
    const pill = box("[data-todo-assignee]");
    expect(time.bottom).toBeLessThanOrEqual(title.top + 1);
    expect(Math.abs(time.left - title.left)).toBeLessThan(1);
    expect(tick.right).toBeLessThan(title.left);
    // The assignee pill sits where an event card has its author: right of the title.
    expect(pill.left).toBeGreaterThanOrEqual(title.right - 1);

    // Its left edge matches the event card's on the same day.
    const event = document.querySelector(`[data-day="${day(3)}"] [data-upcoming-item]`)!;
    const eventTime = event.querySelector("[data-when]")!.getBoundingClientRect();
    expect(Math.abs(eventTime.left - time.left)).toBeLessThan(1);

    // And the checkbox still completes it.
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Fax the form” done" }));
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Fax the form" }))
      .toBeInTheDocument();
    await expect.poll(() => rowOf(SAMS)).toBeNull();
  });

  test("ticking a todo completes it (a done-only upload); it leaves the Planner tab, and Undo brings it back", async () => {
    const device = await open();
    const tick = page.getByRole("checkbox", { name: "Mark “Call the pharmacy” done" });
    await expect.element(tick).toBeInTheDocument();
    await userEvent.click(tick);

    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Call the pharmacy" }))
      .toBeInTheDocument();
    await expect.poll(() => todoTitles(today)).toEqual(["Pick up the walker"]);
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);

    await userEvent.click(page.getByRole("button", { name: "Undo Call the pharmacy" }));
    await expect.poll(() => todoTitles(today)).toEqual(["Call the pharmacy", "Pick up the walker"]);
  });

  test("a viewer gets a tick only on the todo assigned to them", async () => {
    await open("viewer");
    await expect.poll(() => allTodos().length).toBe(3);
    expect(ticks().map((t) => t.getAttribute("aria-label"))).toEqual(["Mark “Pick up the walker” done"]);
    // The others still link to their page.
    expect(rowOf(SAMS)?.querySelector("a[data-planner-todo-open]")).toBeTruthy();
  });

  test("a viewer with nothing assigned sees the todos without ticks", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: PLANNER,
      role: "viewer",
      fixtures: [SAM, LATE, SAMS, todo({ title: "Pick up the walker", dueOn: today, assigneeId: SAM_ID })],
    });
    await expect.poll(() => allTodos().length).toBe(3);
    expect(ticks()).toEqual([]);
  });

  test("a kind or author filter hides the todos", async () => {
    await open("owner", "?kind=event");
    await expect.element(page.getByText("Cardiology follow-up")).toBeInTheDocument();
    expect(allTodos()).toEqual([]);
  });

  test("an author filter hides them too", async () => {
    await open("owner", `?author=${TEST_USER.id}`);
    await expect.element(page.getByText("Cardiology follow-up")).toBeInTheDocument();
    expect(allTodos()).toEqual([]);
  });
});

describe("trees by day on the Planner tab (todo-subtasks-3)", () => {
  const PARENT = "5b2e8c10-4d7a-4f1e-9c3b-1a6f0e2f0001";
  const STEP = "5b2e8c10-4d7a-4f1e-9c3b-1a6f0e2f0002";
  const PACK = "5b2e8c10-4d7a-4f1e-9c3b-1a6f0e2f0003";
  const PARENT_TITLE = "Get ready for the hospital stay";
  const tree = () => [
    todo({ id: PARENT, title: PARENT_TITLE, dueOn: day(2) }),
    todo({ id: STEP, title: "Arrange the dog sitter", parentId: PARENT, dueOn: day(1) }),
    todo({ id: PACK, title: "Pack the bag", parentId: PARENT }),
    todo({
      title: "Print the medication list",
      parentId: PARENT,
      doneAt: at(new Date(Date.now() - 60_000)),
      doneBy: TEST_USER.id,
    }),
  ];
  const openTree = (role: GroupRole = "owner") =>
    renderWithDevice({ route: ROUTES, url: `${PLANNER}?show=todos`, role, fixtures: tree() });
  /** The rows of a day's trees, as `id:look`, in order. */
  const rowsOn = (key: string) =>
    [
      ...document.querySelectorAll<HTMLElement>(`[data-day="${key}"] [data-planner-tree] [data-todo-look]`),
    ].map((r) => `${r.dataset.todo}:${r.dataset.todoLook}`);
  const titleIn = (key: string, id: string) =>
    document
      .querySelector(`[data-day="${key}"] [data-todo="${id}"] [data-todo-title]`)!
      .getBoundingClientRect();

  test("a day shows the tree, its top row as an event card and its steps indented; an earlier step's day shows it under a dimmed parent", async () => {
    await openTree();
    // The card first, then its three steps (their sibling order is the tree's unit tests').
    await expect.poll(() => rowsOn(day(2)).length).toBe(4);
    const [top, ...steps] = rowsOn(day(2));
    expect(top).toBe(`${PARENT}:card`);
    expect(steps).toEqual(
      expect.arrayContaining([`${STEP}:list`, `${PACK}:list`, expect.stringMatching(/:list$/)]),
    );
    expect(steps.every((r) => r.endsWith(":list"))).toBe(true);
    const card = rowOf({ id: PARENT })!;
    expect(card.querySelector("[data-when]")?.textContent).toBe("All day");
    expect(card.querySelector("[data-todo-progress]")?.textContent).toBe("1 of 3 done");
    // The steps sit under the card's text, not under its tick.
    expect(titleIn(day(2), STEP).left).toBeGreaterThanOrEqual(titleIn(day(2), PARENT).left - 1);
    // Only the top row is a card: a step is never a Planner row of its own.
    expect(allTodos()).toHaveLength(1);

    // Tomorrow: the step, under its parent dimmed (no tick, still its link).
    expect(rowsOn(day(1))).toEqual([`${PARENT}:context`, `${STEP}:list`]);
    const context = document.querySelector<HTMLElement>(`[data-day="${day(1)}"] [data-todo="${PARENT}"]`)!;
    expect(context.querySelector("[data-todo-tick]")).toBeNull();
    expect(context.querySelector("a")?.getAttribute("href")).toBe(
      `/app/groups/${TEST_GROUP.id}/todos/${PARENT}`,
    );
    expect(titleIn(day(1), STEP).left).toBeGreaterThan(titleIn(day(1), PARENT).left);
    expect(
      document.querySelector(`[data-day="${day(1)}"] [data-todo="${STEP}"] [data-todo-tick]`),
    ).toBeTruthy();
    // The undated step shows only in the whole tree.
    expect(document.querySelectorAll(`[data-todo="${PACK}"]`)).toHaveLength(1);
  });

  test("a writer adds a step from a row; it shows in the tree", async () => {
    await openTree();
    const add = page.getByRole("button", { name: `Add subtask to ${PARENT_TITLE}` });
    await expect.element(add).toBeInTheDocument();
    // The dimmed parent on the step's day has no quick add: only the card does.
    expect(
      document.querySelectorAll(`[data-day="${day(1)}"] [data-todo="${PARENT}"] [data-todo-quick-add]`),
    ).toHaveLength(0);
    await userEvent.click(add);
    await userEvent.type(page.getByRole("textbox", { name: "New subtask" }), "Call the vet{Enter}");
    await expect
      .poll(() =>
        [...document.querySelectorAll(`[data-day="${day(2)}"] [data-planner-tree] [data-todo-title]`)].map(
          (t) => t.textContent?.trim(),
        ),
      )
      .toContain("Call the vet");
  });

  test("a viewer sees no add-a-step control", async () => {
    await openTree("viewer");
    await expect.poll(() => rowsOn(day(2)).length).toBe(4);
    expect(document.querySelectorAll("[data-todo-quick-add]")).toHaveLength(0);
    expect(page.getByRole("button", { name: /^Add subtask to / }).query()).toBeNull();
  });
});
