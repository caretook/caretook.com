import type { GroupRole } from "../../../../../test/fixtures";
import type { Fixtures } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { useLocation } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx, task, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { renderWithDevice } from "../../../../../test/device";
import { TIMELINE_ROUTES, TIMELINE_URL, waitUntil } from "./timelineWorld";

// The task strip above the timeline (tasks slice 4): shown while the group
// has open tasks overdue or due today, red or amber, naming mine first, and
// linking to the Tasks list. Which task and the words are lib/taskStrip.ts's
// unit tests; this is what's on the screen.

const today = localDate(new Date(), TEST_TIME_ZONE);
const day = (n: number) => addDays(today, n);

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });

/** Stands in for the Tasks list: says which chip it was opened on. */
function TasksProbe() {
  const { search } = useLocation();
  return (
    <main>
      <h1>Tasks list {search}</h1>
    </main>
  );
}

const ROUTES = [...TIMELINE_ROUTES, { path: "/app/groups/:groupId/tasks", module: { default: TasksProbe } }];

const open = (fixtures: Fixtures, role: GroupRole = "owner") =>
  renderWithDevice({
    route: ROUTES,
    url: TIMELINE_URL,
    role,
    fixtures: [SAM, fx.note({ text: "A day" }), fixtures],
  });

const strip = () => document.querySelector<HTMLElement>("main [data-task-strip]");
const stripLink = () => strip()!.querySelector<HTMLAnchorElement>("a[data-task-strip-open]")!;

describe("the task strip", () => {
  test("isn't there while nothing is overdue or due today", async () => {
    await open([
      task({ title: "Fax the form", dueOn: day(2) }),
      task({ title: "Sort the batteries" }),
      task({ title: "Done already", dueOn: day(-1), doneAt: at(), doneBy: TEST_USER.id }),
      task({ title: "Deleted", dueOn: day(-1), deletedAt: at() }),
    ]);
    await expect.element(page.getByText("A day")).toBeInTheDocument();
    // Its query has answered by the time the list has.
    await new Promise((r) => setTimeout(r, 200));
    expect(strip()).toBeNull();
  });

  test("overdue: red, the first late task, +N more counting today's; opens Everyone when it isn't mine", async () => {
    await open([
      task({ title: "Pick up the walker", dueOn: today }),
      task({ title: "Call the pharmacy", dueOn: day(-2), assigneeId: SAM.id }),
      task({ title: "Refill the pill box", dueOn: day(-1) }),
      task({ title: "Fax the form", dueOn: day(3) }),
    ]);
    await waitUntil(() => !!strip(), 4000, "the task strip");
    const s = strip()!;
    expect(s.dataset.stripState).toBe("overdue");
    expect(s.className).toContain("border-error/50");
    expect(s.getAttribute("aria-label")).toBe("Tasks");
    expect(s.textContent).toBe("Overdue: Call the pharmacy · +2 more");
    expect(stripLink().getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/tasks?who=everyone`);

    // It sits above the list.
    expect(
      s.compareDocumentPosition(document.querySelector("main ol")!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await userEvent.click(stripLink());
    await expect.element(page.getByRole("heading", { name: "Tasks list ?who=everyone" })).toBeInTheDocument();
  });

  test("names my late task first and opens Mine", async () => {
    await open([
      task({ title: "Call the pharmacy", dueOn: day(-3), assigneeId: SAM.id }),
      task({ title: "Refill the pill box", dueOn: day(-1), assigneeId: TEST_USER.id }),
    ]);
    await waitUntil(() => !!strip(), 4000, "the task strip");
    expect(strip()!.textContent).toBe("Overdue: Refill the pill box · +1 more");
    expect(stripLink().getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/tasks?who=mine`);
  });

  test("today: amber when nothing is late; viewers see it too", async () => {
    await open(
      [task({ title: "Pick up the walker", dueOn: today }), task({ title: "Later", dueOn: day(1) })],
      "viewer",
    );
    await waitUntil(() => !!strip(), 4000, "the task strip");
    const s = strip()!;
    expect(s.dataset.stripState).toBe("today");
    expect(s.className).toContain("border-warning/50");
    expect(s.textContent).toBe("Today: Pick up the walker");
    expect(s.querySelector("[data-strip-rest]")).toBeNull();
  });

  test("goes away when the last due task is done on another device", async () => {
    const walker = task({ title: "Pick up the walker", dueOn: today });
    const device = await open([walker]);
    await waitUntil(() => !!strip(), 4000, "the task strip");
    await device.sync(
      task({ id: walker.id, title: "Pick up the walker", dueOn: today, doneAt: at(), doneBy: SAM.id }),
    );
    await waitUntil(() => !strip(), 4000, "the strip to go");
  });
});
