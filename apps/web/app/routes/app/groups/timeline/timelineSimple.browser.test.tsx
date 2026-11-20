import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as entry from "~/routes/app/groups/entry/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import * as timelineSettings from "~/routes/app/settings/timeline/route";
import { DICTATION_HINT } from "~/components/quick-entry/QuickEntryBox";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../../../test/fixtures";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as timeline from "./route";
import { waitUntil } from "./timelineWorld";

// Simple mode on the timeline (assistant slice 5), in the real /app frame on
// the test device: the simple view (large type, the box, bigger rows with no
// menus or filters) and the reduced header, who gets it (the managers'
// default, your own setting, this device's toggle; `resolveSimpleMode` has
// every combination), a default arriving from another device, viewers, and
// the account setting. The owner's switch reaching a real second device is
// app-shell.mjs's.

const TIMELINE = "/app/groups/:groupId/timeline";
const ROUTES: DeviceRoute[] = [
  {
    path: TIMELINE,
    module: timeline,
    children: [
      { path: `${TIMELINE}/new/:kind`, module: newSheet },
      { path: `${TIMELINE}/:entryId/edit`, module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: entry },
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: "/app/settings/timeline", module: timelineSettings }],
  },
];
const TIMELINE_URL = `/app/groups/${TEST_GROUP.id}/timeline`;

/** Your membership, with a known id so another device's change can replace it. */
const MEMBERSHIP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f5a01";
const membership = (role: GroupRole, simpleMode = 0, simpleModeLocked = 0) =>
  fx.member({ id: MEMBERSHIP, userId: TEST_USER.id, role, simpleMode, simpleModeLocked });

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const ENTRIES = [
  fx.note({ occurredAt: minutesAgo(10), text: "Slept well after lunch" }),
  fx.symptom({ name: "Sore knee", severity: 3, occurredAt: minutesAgo(20) }),
];

const open = ({
  role = "caretaker",
  simpleMode = 0,
  locked = 0,
  url = TIMELINE_URL,
  api,
}: {
  role?: GroupRole;
  simpleMode?: number;
  locked?: number;
  url?: string;
  api?: Record<string, (input: unknown) => unknown>;
} = {}) =>
  renderWithDevice({
    route: ROUTES,
    url,
    role: null,
    frame: true,
    fixtures: [membership(role, simpleMode, locked), ...ENTRIES],
    api,
  });

const SETTINGS_KEY = `caretook:settings:${TEST_USER.id}`;
const TOGGLE_KEY = `caretook:simpleMode:${TEST_USER.id}:${TEST_GROUP.id}`;
const setOwnSetting = (simpleMode: string) =>
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ simpleMode }));

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(`caretook:settings-pending:${TEST_USER.id}`);
  localStorage.removeItem(TOGGLE_KEY);
});

const simpleView = () => document.querySelector("[data-simple-timeline]");
const isSimple = () => !!simpleView();
const header = () => document.querySelector("body header")!;
const userButton = () => page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
const rows = () => [...document.querySelectorAll("[data-simple-list] ol > li")];
const menuItems = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((el) => el.textContent?.trim());

describe("the simple view", () => {
  test("a member whose owner chose simple mode: their name and today, the big box with a dictation hint, bigger rows without menus or filters, and a reduced header", async () => {
    await open({ simpleMode: 1 });
    await waitUntil(isSimple, 4000, "the simple view");

    // The recipient and today.
    await expect
      .element(page.getByRole("heading", { level: 1, name: TEST_RECIPIENT.preferredName }))
      .toBeVisible();
    expect(simpleView()!.textContent).toContain("Today · ");
    // The box in large type, labelled, with the hint to dictate.
    const box = page.getByRole("textbox", { name: "What happened?" });
    await expect.element(box).toBeVisible();
    expect(box.element().className).toContain("text-xl");
    await expect.element(page.getByText(DICTATION_HINT)).toBeVisible();

    // The rows, larger, with nothing to change or filter.
    await waitUntil(() => rows().length === 2, 4000, "the rows");
    expect(getComputedStyle(document.querySelector("[data-simple-list]")!).zoom).toBe("1.25");
    expect(document.querySelectorAll("[data-simple-list] [data-simple]").length).toBe(2);
    expect(page.getByRole("button", { name: /^Actions for/ }).elements()).toHaveLength(0);
    expect(page.getByRole("link", { name: /^Show only/ }).elements()).toHaveLength(0);
    // The note still opens; the symptom opens nothing.
    expect(document.querySelectorAll("[data-simple-list] a[href*='/entries/']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-simple-list] a[href*='/edit']")).toHaveLength(0);

    // Hidden: the + menu, layout switch, filter chips, strips and the period line.
    expect(page.getByRole("button", { name: /^Add to / }).elements()).toHaveLength(0);
    expect(page.getByRole("group", { name: "Layout" }).elements()).toHaveLength(0);
    expect(page.getByRole("navigation", { name: "Show entries" }).elements()).toHaveLength(0);
    expect(document.querySelector("[data-period-line]")).toBeNull();

    // The header: the mark, the sync status and the user menu only; no tab bar.
    expect(header().querySelector('[data-region="search"]')).toBeNull();
    expect(header().querySelector('[data-region="sections"] nav')).toBeNull();
    expect(page.getByRole("button", { name: /switch care group$/ }).elements()).toHaveLength(0);
    expect(document.querySelector('nav.dock[aria-label="Group sections"]')).toBeNull();
    await userEvent.click(userButton());
    await expect.poll(menuItems).toEqual(["Settings", "Full app", "Sign out"]);
    await userEvent.keyboard("{Escape}");
  });

  test("still saves through the box, on the device", async () => {
    const device = await open({ simpleMode: 1 });
    await waitUntil(isSimple, 4000, "the simple view");
    await userEvent.fill(page.getByRole("textbox", { name: "What happened?" }), "bp 130/85");
    await waitUntil(() => !!document.querySelector("[data-quick-card]"), 4000, "the card");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect
      .poll(async () => (await device.queued()).filter((op) => op.type === "timeline_entry").length)
      .toBe(1);
    await waitUntil(() => rows().length === 3, 4000, "the new row");
  });

  test("a viewer gets the bigger rows and no box", async () => {
    await open({ role: "viewer", simpleMode: 1 });
    await waitUntil(() => isSimple() && rows().length === 2, 4000, "the simple view");
    expect(page.getByRole("textbox", { name: "What happened?" }).elements()).toHaveLength(0);
  });

  test("drops filters from the URL", async () => {
    const device = await open({ simpleMode: 1, url: `${TIMELINE_URL}?kind=note` });
    await waitUntil(isSimple, 4000, "the simple view");
    await expect.poll(device.location).toBe(TIMELINE_URL);
  });
});

describe("who gets it", () => {
  test("the toggle switches this device between simple and full, from the timeline and the user menu", async () => {
    await open();
    await expect.element(page.getByRole("button", { name: "Add to Today" })).toBeVisible();
    expect(isSimple()).toBe(false);

    await userEvent.click(page.getByRole("button", { name: "Simple view" }));
    await waitUntil(isSimple, 4000, "the simple view");
    expect(localStorage.getItem(TOGGLE_KEY)).toBe("simple");

    await userEvent.click(userButton());
    await userEvent.click(page.getByRole("menuitem", { name: "Full app" }));
    await waitUntil(() => !isSimple(), 4000, "the full timeline");
    expect(localStorage.getItem(TOGGLE_KEY)).toBe("full");
    // The full header is back.
    await expect.element(page.getByRole("button", { name: /switch care group$/ })).toBeVisible();

    await userEvent.click(page.getByRole("button", { name: "Simple view" }));
    await waitUntil(isSimple, 4000, "the simple view again");
    await userEvent.click(page.getByRole("button", { name: "Full app" }));
    await waitUntil(() => !isSimple(), 4000, "the full timeline again");
  });

  test("the owner's default arriving from another device switches the timeline without a reload, unless your own setting says otherwise", async () => {
    const device = await open();
    await expect.element(page.getByRole("button", { name: "Simple view" })).toBeVisible();
    await device.sync(membership("caretaker", 1));
    await waitUntil(isSimple, 4000, "the simple view");
    await waitUntil(() => !header().querySelector('[data-region="search"]'), 4000, "the reduced header");

    await device.sync(membership("caretaker", 0));
    await waitUntil(() => !isSimple(), 4000, "the full timeline");
  });

  test("your own setting wins over the owner's default; the toggle wins over both", async () => {
    setOwnSetting("full");
    await open({ simpleMode: 1 });
    await expect.element(page.getByRole("button", { name: "Simple view" })).toBeVisible();
    expect(isSimple()).toBe(false);
    await userEvent.click(page.getByRole("button", { name: "Simple view" }));
    await waitUntil(isSimple, 4000, "the simple view");
  });

  test("your own setting of Always shows it with no default", async () => {
    setOwnSetting("simple");
    await open();
    await waitUntil(isSimple, 4000, "the simple view");
  });

  test("a locked member has no toggle, and the user menu has no Full app", async () => {
    localStorage.setItem(TOGGLE_KEY, "full");
    await open({ simpleMode: 1, locked: 1 });
    await waitUntil(isSimple, 4000, "the simple view");
    expect(page.getByRole("button", { name: "Full app" }).elements()).toHaveLength(0);
    await userEvent.click(userButton());
    await expect.poll(menuItems).toEqual(["Settings", "Sign out"]);
    await userEvent.keyboard("{Escape}");
  });
});

describe("the account setting", () => {
  test("Follow the group, Always or Never: saved through the settings, and it clears this device's toggles", async () => {
    const calls = apiCalls();
    localStorage.setItem(TOGGLE_KEY, "full");
    await open({
      url: "/app/settings/timeline",
      api: calls.record({
        "me.get": () => ({ units: {}, timelineView: "rows", simpleMode: "group" }),
        "me.updatePreferences": () => null,
      }),
    });
    const group = page.getByRole("radiogroup", { name: "Simple mode" });
    await expect.element(group).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "Follow the group" })).toBeChecked();
    await userEvent.click(page.getByRole("radio", { name: "Always" }));
    await expect.poll(() => calls.of("me.updatePreferences")).toEqual([{ simpleMode: "simple" }]);
    await expect.element(page.getByText("Saved.")).toBeVisible();
    expect(localStorage.getItem(TOGGLE_KEY)).toBeNull();
  });
});
