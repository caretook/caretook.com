import type { DeviceRoute } from "../../../test/device";
import type { GroupRole } from "../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { at, fx, task, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../test/fixtures";
import * as entryRoute from "../../routes/app/groups/entry/route";
import * as medicationRoute from "../../routes/app/groups/medication/route";
import * as providerRoute from "../../routes/app/groups/provider/route";
import * as newTaskSheet from "../../routes/app/groups/tasks/new/route";
import * as tasksRoute from "../../routes/app/groups/tasks/route";

// `LinkedTasks` (tasks slice 3) on the three pages that have it: an event's
// entry page, a provider's page and a medication's page. Open linked tasks
// in list order with ticks (for whoever may complete them) and Undo; hidden
// when there are none, apart from writers' "Add task", which opens the add
// sheet with the link filled in and comes back when it closes.

const G = "/app/groups/:groupId";
const ROUTES: DeviceRoute[] = [
  { path: `${G}/entries/:entryId`, module: entryRoute },
  { path: `${G}/providers/:providerId`, module: providerRoute },
  { path: `${G}/medications/:medicationId`, module: medicationRoute },
  { path: `${G}/tasks`, module: tasksRoute, children: [{ path: `${G}/tasks/new`, module: newTaskSheet }] },
];
const url = (path: string) => `/app/groups/${TEST_GROUP.id}/${path}`;

const today = localDate(new Date(), TEST_TIME_ZONE);
const DAY = 86_400_000;

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa002";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const VIEWER_ID = TEST_USER.id;

const LARK = fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa101", name: "Dr. Mira Lark" });
const VISIT = fx.event({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa201",
  title: "Cardiology follow-up",
  occurredAt: at(new Date(Date.now() + 2 * DAY)),
});
const METFORMIN = fx.medication({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa301", name: "Metformin" });
const OTHER = fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa102", name: "Corner Pharmacy" });

const linked = (n: number, v: Parameters<typeof task>[0]) =>
  task({ id: `7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa4${String(n).padStart(2, "0")}`, ...v });

const world = () => [
  SAM,
  LARK,
  OTHER,
  VISIT,
  METFORMIN,
  // The provider's: a later one, an overdue one of mine, a done one, a deleted one.
  linked(1, {
    title: "Ask about the stress test",
    providerId: LARK.id,
    dueOn: addDays(today, 3),
    assigneeId: SAM_ID,
  }),
  linked(2, {
    title: "Call Dr. Lark's office",
    providerId: LARK.id,
    dueOn: addDays(today, -1),
    assigneeId: VIEWER_ID,
  }),
  linked(3, { title: "Fax the referral", providerId: LARK.id, doneAt: at(), doneBy: SAM_ID }),
  linked(4, { title: "Deleted one", providerId: LARK.id, deletedAt: at() }),
  // The event's and the medication's.
  linked(5, { title: "Bring the insurance card", eventId: VISIT.id, assigneeName: "Aunt May" }),
  linked(6, { title: "Refill Metformin", medicationId: METFORMIN.id, dueOn: today, assigneeId: VIEWER_ID }),
];

const open = (path: string, role: GroupRole = "owner", fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url: url(path), role, fixtures });

const region = () => page.getByRole("region", { name: "Tasks" });
const titles = () =>
  [...document.querySelectorAll("[data-linked-tasks] [data-task-title]")].map((el) => el.textContent?.trim());
const ticks = () => [...document.querySelectorAll<HTMLInputElement>("[data-linked-tasks] [data-task-tick]")];

describe("LinkedTasks", () => {
  test("a provider's page lists its open tasks, overdue first, with ticks and Undo for a writer", async () => {
    const device = await open(`providers/${LARK.id}`);
    await expect.element(region()).toBeInTheDocument();
    expect(titles()).toEqual(["Call Dr. Lark's office", "Ask about the stress test"]);
    expect(
      document.querySelector('[data-linked-tasks] [data-task-state="overdue"] [data-task-due]')?.textContent,
    ).toBe("Overdue · 1 day");
    expect(ticks()).toHaveLength(2);
    await expect
      .element(region().getByRole("link", { name: "Call Dr. Lark's office" }))
      .toHaveAttribute("href", url(`tasks/${linked(2, {}).id}`));

    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Ask about the stress test” done" }));
    await expect.poll(titles).toEqual(["Call Dr. Lark's office"]);
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Ask about the stress test" }))
      .toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Undo Ask about the stress test" }));
    await expect.poll(titles).toEqual(["Call Dr. Lark's office", "Ask about the stress test"]);
    const [row] = await device.query<{ done_at: string | null }>("SELECT done_at FROM task WHERE id = ?", [
      linked(1, {}).id,
    ]);
    expect(row?.done_at).toBeNull();
  });

  test("a writer's Add task opens the sheet with the provider filled in, and closing comes back", async () => {
    const device = await open(`providers/${LARK.id}`);
    await userEvent.click(region().getByRole("link", { name: "Add task" }));
    const dialog = page.getByRole("dialog", { name: "Add a task" });
    await expect.element(dialog.getByText("Dr. Mira Lark", { exact: true })).toBeInTheDocument();
    expect(device.location()).toContain(`providerId=${LARK.id}`);
    await userEvent.fill(dialog.getByRole("textbox", { name: "Task" }), "Ask for the lab results");
    await userEvent.click(dialog.getByRole("button", { name: "Add task" }));
    await expect.poll(() => device.location()).toBe(url(`providers/${LARK.id}`));
    await expect.poll(titles).toContain("Ask for the lab results");
  });

  test("a viewer sees the list with ticks only on their own tasks, and no Add task", async () => {
    await open(`providers/${LARK.id}`, "viewer");
    await expect.element(region()).toBeInTheDocument();
    expect(titles()).toEqual(["Call Dr. Lark's office", "Ask about the stress test"]);
    expect(ticks().map((t) => t.getAttribute("aria-label"))).toEqual(["Mark “Call Dr. Lark's office” done"]);
    expect(document.querySelector("[data-linked-tasks-add]")).toBeNull();
  });

  test("an event's page lists its tasks, typed-name assignees too", async () => {
    await open(`entries/${VISIT.id}`);
    await expect.element(region()).toBeInTheDocument();
    expect(titles()).toEqual(["Bring the insurance card"]);
    expect(document.querySelector('[data-linked-tasks] [data-task-assignee="name"]')?.textContent).toBe(
      "Aunt May",
    );
    await expect
      .element(region().getByRole("link", { name: "Add task" }))
      .toHaveAttribute("href", url(`tasks/new?eventId=${VISIT.id}`));
  });

  test("a medication's page lists its tasks; a viewer assigned one can tick it", async () => {
    const device = await open(`medications/${METFORMIN.id}`, "viewer");
    await expect.element(region()).toBeInTheDocument();
    expect(titles()).toEqual(["Refill Metformin"]);
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Refill Metformin” done" }));
    // Ticking the last one keeps the region up while Undo is offered.
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Refill Metformin" }))
      .toBeInTheDocument();
    await expect.poll(titles).toEqual([]);
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);
  });

  test("hidden when there are none: nothing for a viewer, only Add task for a writer", async () => {
    await open(`providers/${OTHER.id}`, "viewer");
    await expect
      .element(page.getByRole("heading", { name: "Corner Pharmacy", level: 1 }))
      .toBeInTheDocument();
    expect(document.querySelector("[data-linked-tasks]")).toBeNull();
    expect(document.querySelector("[data-linked-tasks-add]")).toBeNull();
  });

  test("hidden when there are none for a writer too, apart from Add task", async () => {
    await open(`providers/${OTHER.id}`);
    await expect
      .element(page.getByRole("link", { name: "Add task" }))
      .toHaveAttribute("href", url(`tasks/new?providerId=${OTHER.id}`));
    expect(document.querySelector("[data-linked-tasks]")).toBeNull();
  });

  test("a note's page has none", async () => {
    const note = fx.note({
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa501",
      title: "Slept well",
      text: "Fine night.",
    });
    await open(`entries/${note.id}`, "owner", [...world(), note]);
    // The editor's copy (the hidden print view has one too).
    await expect.poll(() => document.querySelector(".ProseMirror")?.textContent).toContain("Fine night.");
    expect(document.querySelector("[data-linked-tasks-add]")).toBeNull();
  });
});
