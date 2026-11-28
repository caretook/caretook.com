import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { formatTime } from "~/lib/core/format";
import { renderWithDevice } from "../../../../../test/device";
import { found } from "../../../../../test/found";
import { at, fx, todo, TEST_GROUP, TEST_TIME_ZONE } from "../../../../../test/fixtures";
import { TIMELINE_ROUTES } from "../timeline/timelineWorld";
import * as todoRoute from "../todo/route";
import * as searchRoute from "./route";
import { addDays, localDate } from "@caretook/data/domain";

// Search's entries and todos are the shared rows (shared-displays slice 5):
// an entry is the timeline's row (`TimelineEntryRow`, `elsewhere`): kind
// icon, day over time, the author's avatar, a ⋯ with Copy link and no
// Delete, opening as on the timeline; a todo is the Todos page's row
// (`TodoRow`, `list`, no tick): due line, assignee chip, repeat mark, its
// title's match marked and a line from its notes.

const G = TEST_GROUP.id;
const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/search", module: searchRoute },
  ...TIMELINE_ROUTES,
  { path: "/app/groups/:groupId/todos/:todoId", module: todoRoute },
];
const searchUrl = (q: string) => `/app/groups/${G}/search?q=${encodeURIComponent(q)}`;

// The test clock's day is Wednesday 2027-06-09 (Los Angeles).
const YESTERDAY_AT = "2027-06-08T17:30:00.000Z";
const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
const WRIST = fx.symptom({ name: "Wrist pain", occurredAt: at(new Date(YESTERDAY_AT)), createdBy: SAM.id });
const BRACE = fx.note({
  occurredAt: at(new Date(YESTERDAY_AT)),
  text: "Wrist brace fitted",
  createdBy: SAM.id,
});

const today = localDate(new Date(), TEST_TIME_ZONE);
const FORM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d11";
const FORM = todo({
  id: FORM_ID,
  title: "Insurance form",
  dueOn: addDays(today, 1),
  assigneeId: SAM.id,
  repeatRule: "FREQ=WEEKLY;INTERVAL=1",
  repeatStartsOn: addDays(today, 1),
  repeatId: FORM_ID,
});
const FORM_NOTES = fx.document({
  ownerId: FORM.id,
  subject: "todo",
  text: "Ask the front desk for the claim number.",
});

const open = (q: string, role: GroupRole = "owner") =>
  renderWithDevice({
    route: ROUTES,
    url: searchUrl(q),
    role,
    fixtures: [SAM, WRIST, BRACE, FORM, FORM_NOTES],
    search: true,
  });

const row = (id: string) => document.querySelector<HTMLLIElement>(`[data-result-id="${id}"]`);
const openLink = (id: string) => row(id)?.querySelector<HTMLAnchorElement>("a[aria-label]");

describe("search's entry rows are the timeline's", () => {
  test("kind icon, day over time, the author's avatar, no filter links; the ⋯ has Copy link and no Delete", async () => {
    await open("wrist");
    const wrist = await found(() => row(WRIST.id));
    expect(wrist.dataset.result).toBe("entry");
    expect(wrist.querySelector("[data-icon-chip]")).not.toBeNull();
    expect(wrist.querySelector("[data-row-day]")?.textContent).toBe("Yesterday");
    expect(wrist.querySelector("time")?.textContent).toBe(`Yesterday${formatTime(YESTERDAY_AT)}`);
    const author = wrist.querySelector(`[data-entry-aside] [data-author="${SAM.id}"]`);
    expect(author?.textContent).toContain("By Sam Okafor");
    expect(wrist.querySelector('a[aria-label^="Show only"]')).toBeNull();
    // Its match is marked, as on the timeline.
    expect(wrist.querySelector("mark")?.textContent).toBe("Wrist");

    await userEvent.click(await found(() => wrist.querySelector('button[aria-label^="Actions for"]')));
    await expect.element(page.getByRole("menuitem", { name: "Copy link" })).toBeVisible();
    const items = [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
    expect(items).not.toContain("Delete");
    expect(items).not.toContain("Edit");
  });

  test("a writer's symptom opens its edit sheet", async () => {
    const device = await open("wrist");
    const wrist = await found(() => row(WRIST.id));
    expect(wrist.dataset.opens).toBe("sheet");
    await userEvent.click(await found(() => openLink(WRIST.id)));
    await expect.poll(() => device.location()).toMatch(new RegExp(`/timeline/${WRIST.id}/edit`));
    await expect.element(device.screen.getByRole("dialog")).toBeVisible();
  });

  test("a viewer's note opens its page; their symptom opens nothing", async () => {
    const device = await open("wrist", "viewer");
    await found(() => row(BRACE.id));
    expect(row(WRIST.id)?.dataset.opens).toBe("none");
    expect(row(WRIST.id)?.querySelector("a")).toBeNull();
    expect(row(BRACE.id)?.dataset.opens).toBe("page");
    await userEvent.click(await found(() => openLink(BRACE.id)));
    await expect.poll(() => device.location()).toBe(`/app/groups/${G}/entries/${BRACE.id}`);
  });
});

describe("search's todo rows are the Todos page's", () => {
  test("due line, assignee chip, repeat mark, its title's match marked, and no tick", async () => {
    await open("insurance");
    const form = await found(() => row(FORM.id));
    expect(form.dataset.result).toBe("todo");
    expect(form.querySelector("[data-todo-look]")?.getAttribute("data-todo-look")).toBe("list");
    expect(form.querySelector("[data-todo-due]")?.textContent).toBe("Due tomorrow");
    expect(form.querySelector("[data-todo-assignee]")?.textContent).toContain("Sam Okafor");
    expect(form.querySelector("[data-repeat-mark]")).not.toBeNull();
    expect(form.querySelector("[data-todo-title] mark")?.textContent).toBe("Insurance");
    expect(form.querySelector("[data-snippet]")).toBeNull();
    expect(form.querySelector("input, [role=checkbox]")).toBeNull();
  });

  test("a match only in its notes shows a line from them, under the due line", async () => {
    await open("claim");
    const form = await found(() => row(FORM.id));
    const snippet = form.querySelector("[data-snippet]");
    expect(snippet?.querySelector("mark")?.textContent).toBe("claim");
    const due = form.querySelector("[data-todo-due]");
    expect(
      due && snippet && due.compareDocumentPosition(snippet) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
