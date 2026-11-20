import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { useParams } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as upcomingRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, task, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";

// Tasks in Upcoming (tasks slice 4): open dated tasks under their day
// (overdue first under Today), a tick for whoever may complete them, a link
// to the task, and none under a kind or author filter. Placement and order
// are lib/upcomingTasks.ts's unit tests; this is what's on the screen.

const UPCOMING = `/app/groups/${TEST_GROUP.id}/upcoming`;

/** Stands in for the task page (slice 2's). */
function TaskProbe() {
  const { taskId } = useParams();
  return (
    <main>
      <h1>Task page {taskId}</h1>
    </main>
  );
}

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/upcoming", module: upcomingRoute },
  { path: "/app/groups/:groupId/tasks/:taskId", module: { default: TaskProbe } },
];

const today = localDate(new Date(), TEST_TIME_ZONE);
const day = (n: number) => addDays(today, n);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });

const LATE = task({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c11", title: "Call the pharmacy", dueOn: day(-2) });
const MINE = task({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c12",
  title: "Pick up the walker",
  dueOn: today,
  assigneeId: TEST_USER.id,
});
const SAMS = task({
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
  task({ title: "Sort the batteries" }),
  task({
    title: "Book the eye exam",
    dueOn: today,
    doneAt: at(new Date(Date.now() - 60_000)),
    doneBy: SAM_ID,
  }),
  task({ title: "Deleted errand", dueOn: today, deletedAt: at(new Date(Date.now() - 60_000)) }),
  fx.event({ title: "Cardiology follow-up", occurredAt: at(new Date(Date.now() + 3 * 86_400_000)) }),
];

const open = (role: GroupRole = "owner", query = "") =>
  renderWithDevice({ route: ROUTES, url: `${UPCOMING}${query}`, role, fixtures: world() });

/** The task rows' titles in a day's section, in order. */
const taskTitles = (key: string) =>
  [...document.querySelectorAll(`[data-day="${key}"] [data-upcoming-task] [data-task-title]`)].map((el) =>
    el.textContent?.trim(),
  );
const allTasks = () => [...document.querySelectorAll<HTMLElement>("[data-upcoming-task]")];
const ticks = () => [...document.querySelectorAll<HTMLInputElement>("[data-upcoming-task] [data-task-tick]")];
const rowOf = (t: { id: string }) => document.querySelector<HTMLElement>(`[data-upcoming-task="${t.id}"]`);

describe("tasks in Upcoming", () => {
  test("a writer sees open dated tasks under their day, overdue first under Today, each with a tick and a link", async () => {
    await open();
    await expect.poll(() => taskTitles(today)).toEqual(["Call the pharmacy", "Pick up the walker"]);
    expect(taskTitles(day(3))).toEqual(["Fax the form"]);
    // Undated, done and deleted tasks aren't upcoming.
    expect(allTasks()).toHaveLength(3);
    expect(document.querySelector('[data-day="now"] [data-upcoming-task]')).toBeNull();
    // The day of an appointment holds both.
    const fri = document.querySelector(`[data-day="${day(3)}"]`)!;
    expect(fri.querySelector("[data-upcoming-item]")).toBeTruthy();

    const late = rowOf(LATE)!;
    expect(late.dataset.taskState).toBe("overdue");
    expect(late.querySelector("[data-when]")?.textContent).toBe("Overdue");
    expect(late.querySelector("[data-task-due]")?.textContent).toBe("Overdue · 2 days");
    expect(late.querySelector("[data-task-assignee]")?.textContent).toBe("Unassigned");
    expect(rowOf(MINE)!.querySelector("[data-when]")?.textContent).toBe("All day");
    expect(rowOf(MINE)!.querySelector("[data-task-assignee]")?.textContent).toBe("you");
    expect(rowOf(SAMS)!.querySelector("[data-task-assignee]")?.textContent).toBe("Sam Okafor");
    expect(ticks()).toHaveLength(3);

    const link = late.querySelector<HTMLAnchorElement>("a[data-upcoming-task-open]")!;
    expect(link.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/tasks/${LATE.id}`);
    expect(link.getAttribute("aria-label")).toBe("Open task Call the pharmacy, Overdue · 2 days");
    await userEvent.click(link, { force: true });
    await expect.element(page.getByRole("heading", { name: `Task page ${LATE.id}` })).toBeInTheDocument();
  });

  test("ticking a task completes it (a done-only upload); it leaves Upcoming, and Undo brings it back", async () => {
    const device = await open();
    const tick = page.getByRole("checkbox", { name: "Mark “Call the pharmacy” done" });
    await expect.element(tick).toBeInTheDocument();
    await userEvent.click(tick);

    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Call the pharmacy" }))
      .toBeInTheDocument();
    await expect.poll(() => taskTitles(today)).toEqual(["Pick up the walker"]);
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);

    await userEvent.click(page.getByRole("button", { name: "Undo" }));
    await expect.poll(() => taskTitles(today)).toEqual(["Call the pharmacy", "Pick up the walker"]);
  });

  test("a viewer gets a tick only on the task assigned to them", async () => {
    await open("viewer");
    await expect.poll(() => allTasks().length).toBe(3);
    expect(ticks().map((t) => t.getAttribute("aria-label"))).toEqual(["Mark “Pick up the walker” done"]);
    // The others still link to their page.
    expect(rowOf(SAMS)!.querySelector("a[data-upcoming-task-open]")).toBeTruthy();
  });

  test("a viewer with nothing assigned sees the tasks without ticks", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: UPCOMING,
      role: "viewer",
      fixtures: [SAM, LATE, SAMS, task({ title: "Pick up the walker", dueOn: today, assigneeId: SAM_ID })],
    });
    await expect.poll(() => allTasks().length).toBe(3);
    expect(ticks()).toEqual([]);
  });

  test("a kind or author filter hides the tasks", async () => {
    await open("owner", "?kind=event");
    await expect.element(page.getByText("Cardiology follow-up")).toBeInTheDocument();
    expect(allTasks()).toEqual([]);
  });

  test("an author filter hides them too", async () => {
    await open("owner", `?author=${TEST_USER.id}`);
    await expect.element(page.getByText("Cardiology follow-up")).toBeInTheDocument();
    expect(allTasks()).toEqual([]);
  });
});
