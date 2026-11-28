import type { DeviceRoute } from "../../../../../test/device";
import type { Fixtures, GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as planner from "../planner/route";
import * as search from "../search/route";
import * as timeline from "../timeline/route";
import * as todoPage from "../todo/route";
import { renderWithDevice } from "../../../../../test/device";
import { at, condition, fx, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { addDays, localDate } from "@caretook/data/domain";

// The pages the easy roles (Easy helper, Easy viewer) reach beyond the
// timeline (simple-mode slice 4), in the real /app frame on the test device:
// Upcoming's "See all" opens the Planner, read-only; a todo's link opens its
// page, with the tick only on their own; search is in the header, finds
// every type, and opens a provider, medication or condition as a read-only
// sheet over itself; and a typed URL for a page they can't use goes to the
// timeline. The route rule itself is lib/assistant/easyModeLock.test.ts.

/** Stand-ins for the sections the easy roles can't use. */
const probe = (name: string) => ({ default: () => <h1>{name}</h1> });

const GROUP = "/app/groups/:groupId";
const ROUTES: DeviceRoute[] = [
  { path: `${GROUP}/timeline`, module: timeline },
  { path: `${GROUP}/planner`, module: planner },
  { path: `${GROUP}/planner/past`, module: probe("Past") },
  { path: `${GROUP}/todos`, module: probe("Todos") },
  { path: `${GROUP}/todos/:todoId`, module: todoPage },
  { path: `${GROUP}/search`, module: search },
  { path: `${GROUP}/medications`, module: probe("Medications") },
  { path: `${GROUP}/providers/:providerId`, module: probe("Provider page") },
  { path: `${GROUP}/medications/:medicationId`, module: probe("Medication page") },
];
const base = `/app/groups/${TEST_GROUP.id}`;
const TIMELINE = `${base}/timeline`;
const EASY_ROLES = ["easy_helper", "easy_viewer"] as const;

const today = localDate(new Date(), TEST_TIME_ZONE);
const SAM = fx.person({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8a01", name: "Sam Okafor", role: "caretaker" });
const VISIT = fx.event({
  title: "Visit with Dr. Lark",
  occurredAt: at(new Date(Date.now() + 26 * 3_600_000)),
  createdBy: SAM.id,
});
const MINE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8b01",
  title: "Water the plants",
  assigneeId: TEST_USER.id,
  dueOn: addDays(today, 1),
});
const SAMS = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8b02",
  title: "Book the hearing test",
  assigneeId: SAM.id,
  dueOn: addDays(today, 2),
});

const open = (role: GroupRole, url: string, fixtures: Fixtures = [], withSearch = false) =>
  renderWithDevice({
    route: ROUTES,
    url,
    role,
    frame: true,
    search: withSearch,
    fixtures: [SAM, fixtures],
  });

const isEasy = () => !!document.querySelector("[data-easy-timeline]");
/** Links in the main content that lead to a section the easy roles can't use. */
const deadLinks = () =>
  [...document.querySelectorAll<HTMLAnchorElement>("main a[href^='/app/groups/']")]
    .map((a) => new URL(a.href).pathname)
    .filter((path) =>
      /\/(providers|medications|profile|settings|periods|planner\/past)(\/|$)|\/todos\/?$/.test(path),
    );

describe("the easy roles' Planner", () => {
  test.each(EASY_ROLES)("%s: Upcoming's See all opens it, the list alone and read-only", async (role) => {
    const device = await open(role, TIMELINE, [VISIT, MINE]);
    await waitUntil(isEasy, "the easy view");
    await userEvent.click(
      await found(() => document.querySelector<HTMLButtonElement>("[data-easy-next] button")),
    );
    await waitUntil(() => !!document.querySelector("[data-easy-upcoming-all]"), "See all");
    await userEvent.click(page.getByRole("link", { name: "See all", exact: true }));

    await expect.poll(device.location).toBe(`${base}/planner`);
    await expect.element(page.getByRole("heading", { name: "Planner", level: 1 })).toBeVisible();
    await waitUntil(() => !!document.querySelector(`[data-upcoming-item="${VISIT.id}"]`), "the visit");
    // Still the reduced header: no group menu or tab bar.
    expect(document.querySelector("nav[data-tab-bar]")).toBeNull();
    // No Add, tabs, filters or row menus, and no filter links on the rows.
    expect(page.getByRole("button", { name: "Add" }).elements()).toHaveLength(0);
    expect(page.getByRole("navigation", { name: "Upcoming, past or todos" }).elements()).toHaveLength(0);
    expect(page.getByRole("button", { name: /^Filter/ }).elements()).toHaveLength(0);
    expect(document.querySelectorAll('main button[aria-label^="Actions for"]')).toHaveLength(0);
    expect(document.querySelectorAll('main a[aria-label^="Show only"]')).toHaveLength(0);
    expect(deadLinks()).toEqual([]);
  });

  test("a typed filter is ignored", async () => {
    await open("easy_viewer", `${base}/planner?show=todos`, [VISIT, MINE]);
    await waitUntil(() => !!document.querySelector(`[data-upcoming-item="${VISIT.id}"]`), "the visit");
  });
});

describe("the easy roles' todo pages", () => {
  test.each(EASY_ROLES)("%s: a todo link opens its page, and they tick their own", async (role) => {
    const device = await open(role, TIMELINE, [MINE]);
    await waitUntil(isEasy, "the easy view");
    await waitUntil(() => !!document.querySelector("[data-easy-todos]"), "My todos");
    // No Todos list to see all in.
    expect(document.querySelector("[data-easy-todos-all]")).toBeNull();
    await userEvent.click(page.getByRole("link", { name: "Water the plants" }));

    await expect.poll(device.location).toBe(`${base}/todos/${MINE.id}`);
    await expect.element(page.getByRole("heading", { name: "Water the plants" })).toBeVisible();
    // Back goes to the timeline, not the Todos list; no edit or delete.
    expect(page.getByRole("link", { name: /Timeline/ }).elements().length).toBeGreaterThan(0);
    expect(document.querySelector("[data-edit-todo]")).toBeNull();
    expect(deadLinks()).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "Mark “Water the plants” done" }));
    await expect
      .poll(async () => (await device.queued()).filter((w) => w.id === MINE.id && !!w.data?.done_at).length)
      .toBe(1);
  });

  test.each(EASY_ROLES)("%s: another member's todo has no tick", async (role) => {
    await open(role, `${base}/todos/${SAMS.id}`, [SAMS]);
    await expect.element(page.getByRole("heading", { name: "Book the hearing test" })).toBeVisible();
    expect(document.querySelector("[data-todo-complete]")).toBeNull();
    expect(document.querySelector("[data-todo-reopen]")).toBeNull();
  });

  test("its linked provider and medication are names, not links", async () => {
    const lark = fx.provider({ name: "Dr. Mira Lark" });
    const pills = fx.medication({ name: "Lisinopril" });
    const linked = todo({
      title: "Ask about the refill",
      assigneeId: TEST_USER.id,
      providerId: lark.id,
      medicationId: pills.id,
    });
    await open("easy_helper", `${base}/todos/${linked.id}`, [lark, pills, linked]);
    await waitUntil(() => document.querySelectorAll("[data-todo-link]").length === 2, "the links");
    expect(deadLinks()).toEqual([]);
    expect(document.querySelector('[data-todo-link="provider"] [data-todo-link-name]')?.textContent).toBe(
      "Dr. Mira Lark",
    );
  });
});

describe("the easy roles' search", () => {
  const LARK = fx.provider({
    name: "Dr. Mira Lark",
    address: "12 Elm Street, Springfield",
    phones: [{ label: "Office", number: "555-0100" }],
  });
  const PILLS = fx.medication({ name: "Larkspur drops", dose: "2 drops" });
  const KNEE = condition({ name: "Lark knee", note: "Worse on stairs" });
  const ASK = todo({ title: "Ask Dr. Lark about the knee", assigneeId: TEST_USER.id });
  const NOTE = fx.note({ text: "Dr. Lark called back" });
  const world = [LARK, PILLS, KNEE, ASK, NOTE];
  const sectionOrder = () =>
    [...document.querySelectorAll<HTMLElement>("[data-section]")].map((s) => s.dataset.section);
  const nameButton = (type: string) =>
    document.querySelector<HTMLButtonElement>(`[data-result="${type}"] button[data-opens-sheet]`);
  const sheet = () => document.querySelector<HTMLElement>("[role=dialog] [data-easy-sheet]");

  test("is in the reduced header", async () => {
    const device = await open("easy_viewer", TIMELINE);
    await waitUntil(isEasy, "the easy view");
    await userEvent.click(page.getByRole("link", { name: "Search this care group" }));
    await expect.poll(device.location).toBe(`${base}/search`);
    expect(page.getByRole("button", { name: /switch care group$/ }).elements()).toHaveLength(0);
  });

  test.each(EASY_ROLES)("%s: finds every type, and opens the three read-only sheets here", async (role) => {
    const device = await open(role, `${base}/search?q=lark`, world, true);
    await expect.poll(sectionOrder).toEqual(["provider", "medication", "condition", "todo", "entry"]);
    expect(document.querySelector("[data-see-timeline]")).toBeNull();
    expect(deadLinks()).toEqual([]);
    const url = device.location();

    await userEvent.click(await found(() => nameButton("provider")));
    await waitUntil(() => sheet()?.dataset.easySheet === "provider", "the provider's sheet");
    const dialog = () => document.querySelector<HTMLElement>("[role=dialog]")!;
    expect(dialog().textContent).toContain("Dr. Mira Lark");
    expect(dialog().textContent).toContain("Family medicine");
    expect(dialog().querySelector('a[data-action="call"]')?.getAttribute("href")).toMatch(/^tel:/);
    expect(dialog().querySelector('a[data-action="map"]')).not.toBeNull();
    // Nothing onward but calling and directions.
    expect(
      [...dialog().querySelectorAll("a")].filter((a) => a.getAttribute("href")?.startsWith("/")),
    ).toEqual([]);
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await waitUntil(() => !sheet(), "the sheet closing");
    expect(device.location()).toBe(url);

    await userEvent.click(await found(() => nameButton("medication")));
    await waitUntil(() => sheet()?.dataset.easySheet === "medication", "the medication's sheet");
    expect(sheet()?.querySelector('[data-easy-fact="schedule"]')?.textContent).toContain("2 drops");
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await waitUntil(() => !sheet(), "the sheet closing");

    await userEvent.click(await found(() => nameButton("condition")));
    await waitUntil(() => sheet()?.dataset.easySheet === "condition", "the condition's sheet");
    expect(sheet()?.querySelector('[data-easy-fact="status"]')?.textContent).toContain("Active");
    expect(sheet()?.querySelector('[data-easy-fact="note"]')?.textContent).toContain("Worse on stairs");
    expect(sheet()?.querySelector("a")).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !sheet(), "the sheet closing");
    expect(device.location()).toBe(url);

    // A todo opens its page.
    await userEvent.click(page.getByRole("link", { name: "Ask Dr. Lark about the knee" }));
    await expect.poll(device.location).toBe(`${base}/todos/${ASK.id}`);
  });

  test("a regular role's results still open their pages", async () => {
    await open("viewer", `${base}/search?q=lark`, world, true);
    await expect.poll(sectionOrder).toEqual(["provider", "medication", "condition", "todo", "entry"]);
    expect(nameButton("provider")).toBeNull();
    expect(document.querySelector('[data-result="provider"] a')).not.toBeNull();
    expect(document.querySelector("[data-see-timeline]")).not.toBeNull();
  });
});

describe("a typed URL for a page the easy roles can't use", () => {
  test.each([
    ["easy_helper", `${base}/medications`],
    ["easy_viewer", `${base}/medications`],
    ["easy_helper", `${base}/todos`],
    ["easy_viewer", `${base}/planner/past`],
  ] as const)("%s at %s goes to the timeline", async (role, url) => {
    const device = await open(role, url);
    await expect.poll(device.location).toBe(TIMELINE);
    await waitUntil(isEasy, "the easy view");
  });
});
