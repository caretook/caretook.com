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
