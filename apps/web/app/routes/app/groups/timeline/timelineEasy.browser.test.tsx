import type { DeviceRoute } from "../../../../../test/device";
import type { Fixtures, GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as entry from "~/routes/app/groups/entry/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import * as timelineSettings from "~/routes/app/settings/timeline/route";
import { DICTATION_HINT } from "~/components/quick-entry/QuickEntryBox";
import { cacheSettings } from "~/lib/app-shell/me";
import { apiCalls } from "../../../../../test/api";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../../../test/fixtures";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as timeline from "./route";
import { daysAgo } from "../periods/periodWorld";
import { pressEasyMode } from "./timelineWorld";

// Easy mode on the timeline, in the real /app frame on the test device: the
// easy view (large type, the box, the full timeline's search, filters, row
// menus and edit sheets) and the reduced header, who gets it (an easy role
// always; anyone else by their own setting, live, or this device's toggle;
// `resolveEasyMode` has every combination), an easy role arriving from
// another device, viewers, and the account setting. The easy roles' own
// timelines are timelineEasyLock.browser.test.tsx's.

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
const membership = (role: GroupRole) => fx.member({ id: MEMBERSHIP, userId: TEST_USER.id, role });

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const ENTRIES = [
  fx.note({ occurredAt: minutesAgo(10), text: "Slept well after lunch" }),
  fx.symptom({ name: "Sore knee", severity: 3, occurredAt: minutesAgo(20) }),
];

const SETTINGS_KEY = `caretook:settings:${TEST_USER.id}`;
const TOGGLE_KEY = `caretook:easyMode:${TEST_USER.id}:${TEST_GROUP.id}`;
const setOwnSetting = (easyMode: string) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ easyMode }));

/** The timeline as `role`; `easyMode` is your own setting saying Easy mode. */
const open = ({
  role = "caretaker",
  easyMode = false,
  url = TIMELINE_URL,
  api,
  extra = [],
}: {
  role?: GroupRole;
  easyMode?: boolean;
  url?: string;
  api?: Record<string, (input: unknown) => unknown>;
  extra?: Fixtures[];
} = {}) => {
  if (easyMode) setOwnSetting("easy");
  return renderWithDevice({
    route: ROUTES,
    url,
    role: null,
    frame: true,
    fixtures: [membership(role), ...ENTRIES, ...extra],
    api,
  });
};

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(`caretook:settings-pending:${TEST_USER.id}`);
  localStorage.removeItem(TOGGLE_KEY);
});

const easyView = () => document.querySelector("[data-easy-timeline]");
const isEasy = () => !!easyView();
const header = () => document.querySelector("body header")!;
const userButton = () => page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
const rows = () => [...document.querySelectorAll("[data-easy-list] ol > li")];
const menuItems = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((el) => el.textContent?.trim());

describe("the mic tip", () => {
  test("shows only where canDictate says so", async () => {
    // A phone: a coarse pointer and an Android user agent.
    const media = window.matchMedia.bind(window);
    const matchSpy = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((q) => (q.includes("pointer: coarse") ? { ...media(q), matches: true } : media(q)));
    const uaSpy = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
    try {
      await open({ easyMode: true });
      await waitUntil(isEasy, "the easy view");
      await expect.element(page.getByText(DICTATION_HINT)).toBeVisible();
      expect(document.querySelectorAll("[data-dictation-hint]")).toHaveLength(1);
    } finally {
      matchSpy.mockRestore();
      uaSpy.mockRestore();
    }
  });
});

describe("the easy view", () => {
  test("a caretaker who chose easy mode: their name and today, the box at the normal size, then the search and filters, then rows with every menu, a reduced header and Full app", async () => {
    await open({ easyMode: true });
    await waitUntil(isEasy, "the easy view");

    // The recipient and today.
    await expect
      .element(page.getByRole("heading", { level: 1, name: TEST_RECIPIENT.preferredName }))
      .toBeVisible();
    await expect.poll(() => easyView()?.textContent ?? "").toContain("Today · ");
    // The box at the normal size, then the search and Filter row, then the rows; no dictation tip on a desktop.
    const box = page.getByRole("textbox", { name: "What happened?" });
    await expect.element(box).toBeVisible();
    expect(getComputedStyle(box.element()).fontSize).toBe("16px");
    const section = document.querySelector("[data-quick-entry]")!;
    const list = document.querySelector("[data-easy-list]")!;
    expect(section.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const chips = section.parentElement!.nextElementSibling!;
    expect(chips.querySelector('button[aria-label="Search entries"]')).not.toBeNull();
    expect(chips.querySelector("button[data-filter-button]")?.getAttribute("aria-label")).toBe("Filter");
    // No View options in the easy view's toolbar (the full view's sits at its end).
    expect(chips.querySelector('button[aria-label="View options"]')).toBeNull();
    expect(chips.nextElementSibling).toBe(list);
    expect(document.querySelector("[data-dictation-hint]")).toBeNull();
    // No heading above the page title's size anywhere in easy mode.
    const headings = (await found(easyView)).querySelectorAll("h1, h2, h3");
    expect([...headings].every((h) => parseFloat(getComputedStyle(h).fontSize) <= 20)).toBe(true);

    // The rows, with the full timeline's ⋯ menus; the kind icon and initials aren't filters.
    await waitUntil(() => rows().length === 2, "the rows");
    // At the full timeline's scale: no zoom on the list or its day summaries.
    const easyList = await found(() => document.querySelector("[data-easy-list]"));
    expect(getComputedStyle(easyList).zoom).toBe("1");
    expect(
      document.querySelector("[data-easy-list] [style*='zoom'], [data-easy-list] [class*='zoom']"),
    ).toBeNull();
    expect(document.querySelectorAll("[data-easy-list] [data-easy]").length).toBe(2);
    expect(document.querySelectorAll('[data-easy-list] button[aria-label^="Actions"]')).toHaveLength(2);
    expect(page.getByRole("link", { name: /^Show only/ }).elements()).toHaveLength(0);
    // The note opens its page; the symptom its edit sheet.
    expect(document.querySelectorAll("[data-easy-list] a[href*='/entries/']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-easy-list] a[href*='/edit']")).toHaveLength(1);

    // Hidden: the + menu, View options (layout, summaries) and strips.
    expect(page.getByRole("button", { name: /^Add to / }).elements()).toHaveLength(0);
    expect(page.getByRole("button", { name: "View options" }).elements()).toHaveLength(0);
    expect(page.getByRole("navigation", { name: "Show entries" }).elements()).toHaveLength(0);

    // The header: the mark, search, the sync status and the user menu; no tab bar.
    expect(
      header().querySelector(`[data-region="search"] a[href="/app/groups/${TEST_GROUP.id}/search"]`),
    ).not.toBeNull();
    expect(header().querySelector('[data-region="sections"] nav')).toBeNull();
    expect(page.getByRole("button", { name: /switch care group$/ }).elements()).toHaveLength(0);
    expect(document.querySelector('nav[data-tab-bar][aria-label="Group sections"]')).toBeNull();
    await userEvent.click(userButton());
    await expect.poll(menuItems).toEqual(["Settings", "Full app", "Sign out"]);
    await userEvent.keyboard("{Escape}");
  });

  test("a day header names the care period: today's, a past day's, and none outside any period", async () => {
    const stay = fx.period({
      type: "hospital",
      startedAt: at(daysAgo(10, 9)),
    });
    const home = fx.period({ type: "home", startedAt: at(daysAgo(4, 9)) });
    await open({
      easyMode: true,
      extra: [
        stay,
        home,
        fx.note({ occurredAt: at(daysAgo(7, 12)), text: "In the ward" }),
        fx.note({ occurredAt: at(daysAgo(15, 12)), text: "Before any period" }),
      ],
    });
    await waitUntil(() => isEasy() && rows().length === 4, "the rows");
    const lines = () =>
      [...document.querySelectorAll("[data-easy-list] [data-day-header]")].map(
        (h) => h.querySelector<HTMLElement>("[data-period-line]")?.textContent?.trim() ?? null,
      );
    await waitUntil(() => lines().length === 3, "the day headers");
    expect(lines()).toEqual([expect.stringMatching(/^At home · day 5$/), "In hospital · day 4", null]);
    // Today's line links to its period; no Change, no + menu in easy mode.
    const link = document.querySelector<HTMLAnchorElement>("[data-easy-list] [data-period-current]")!;
    expect(link.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/periods/${home.id}`);
    expect(document.querySelector("[data-period-change]")).toBeNull();
  });

  test("still saves through the box, on the device", async () => {
    const device = await open({ easyMode: true });
    await waitUntil(isEasy, "the easy view");
    await userEvent.fill(page.getByRole("textbox", { name: "What happened?" }), "bp 130/85");
    await waitUntil(() => !!document.querySelector("[data-quick-card]"), "the card");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect
      .poll(async () => (await device.queued()).filter((op) => op.type === "timeline_entry").length)
      .toBe(1);
    await waitUntil(() => rows().length === 3, "the new row");
  });

  test("a viewer gets the bigger rows and no box", async () => {
    await open({ role: "viewer", easyMode: true });
    await waitUntil(() => isEasy() && rows().length === 2, "the easy view");
    expect(page.getByRole("textbox", { name: "What happened?" }).elements()).toHaveLength(0);
  });

  test("keeps a filter from the URL, with its chip, and clearing the chip shows everything", async () => {
    const device = await open({ easyMode: true, url: `${TIMELINE_URL}?kind=note` });
    await waitUntil(() => isEasy() && rows().length === 1, "the filtered rows");
    expect(device.location()).toBe(`${TIMELINE_URL}?kind=note`);
    const chip = document.querySelector<HTMLAnchorElement>('nav[aria-label="Filters on"] a')!;
    await userEvent.click(chip);
    await expect.poll(device.location).toBe(TIMELINE_URL);
    await waitUntil(() => rows().length === 2, "every row");
  });

  test("⋯ → Edit opens the full edit sheet over the easy view", async () => {
    const device = await open({ easyMode: true });
    await waitUntil(() => isEasy() && rows().length === 2, "the rows");
    const knee = rows().find((li) => li.textContent?.includes("Sore knee"))!;
    await userEvent.click(await found(() => knee.querySelector('button[aria-label^="Actions"]')));
    await userEvent.click(page.getByRole("menuitem", { name: "Edit" }));
    const name = () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="symptomName"]');
    await waitUntil(() => !!name(), "the edit sheet");
    await expect.poll(() => name()?.value).toBe("Sore knee");
    expect(device.location()).toMatch(/\/edit$/);
    expect(isEasy()).toBe(true);
  });
});

describe("who gets it", () => {
  test("the toggle switches this device between easy and full, from the timeline and the user menu", async () => {
    await open();
    await expect.element(page.getByRole("button", { name: "Add to Today" })).toBeVisible();
    expect(isEasy()).toBe(false);

    await pressEasyMode();
    await waitUntil(isEasy, "the easy view");
    expect(localStorage.getItem(TOGGLE_KEY)).toBe("easy");

    await userEvent.click(userButton());
    await userEvent.click(page.getByRole("menuitem", { name: "Full app" }));
    await waitUntil(() => !isEasy(), "the full timeline");
    expect(localStorage.getItem(TOGGLE_KEY)).toBe("full");
    // The full header is back.
    await expect.element(page.getByRole("button", { name: /switch care group$/ })).toBeVisible();

    await pressEasyMode();
    await waitUntil(isEasy, "the easy view again");
    await userEvent.click(page.getByRole("button", { name: "Full app" }));
    await waitUntil(() => !isEasy(), "the full timeline again");
  });

  test("an easy role arriving from another device switches the timeline without a reload, and back", async () => {
    const device = await open();
    await expect.element(page.getByRole("button", { name: "View options" })).toBeVisible();
    await device.sync(membership("easy_helper"));
    await waitUntil(isEasy, "the easy view");
    await waitUntil(() => !header().querySelector('[data-region="sections"] nav'), "the reduced header");

    await device.sync(membership("caretaker"));
    await waitUntil(() => !isEasy(), "the full timeline");
  });

  test("your own setting changed on another device switches the timeline and the header without a navigation, and back", async () => {
    setOwnSetting("full");
    await open();
    await expect.element(page.getByRole("button", { name: /switch care group$/ })).toBeVisible();
    expect(isEasy()).toBe(false);
    const sections = () => header().querySelector('[data-region="sections"] nav');
    expect(sections()).not.toBeNull();

    // A background refresh bringing the other device's change into the cache.
    cacheSettings(TEST_USER.id, { easyMode: "easy" });
    await waitUntil(isEasy, "the easy view");
    await waitUntil(() => !sections(), "the reduced header");
    expect(page.getByRole("button", { name: /switch care group$/ }).elements()).toHaveLength(0);

    cacheSettings(TEST_USER.id, { easyMode: "full" });
    await waitUntil(() => !isEasy(), "the full timeline");
    await waitUntil(() => !!sections(), "the full header");
  });

  test("the header alone follows that change too: no navigation and nothing else re-rendering it", async () => {
    setOwnSetting("full");
    // A still page at the timeline's URL, so only the header's own subscription can switch it.
    await renderWithDevice({
      element: <p>Still page</p>,
      url: TIMELINE_URL,
      role: null,
      frame: true,
      fixtures: [membership("caretaker")],
    });
    const sections = () => header().querySelector('[data-region="sections"] nav');
    await expect.element(page.getByRole("button", { name: /switch care group$/ })).toBeVisible();
    expect(sections()).not.toBeNull();

    cacheSettings(TEST_USER.id, { easyMode: "easy" });
    await waitUntil(() => !sections(), "the reduced header");
    expect(page.getByRole("button", { name: /switch care group$/ }).elements()).toHaveLength(0);

    cacheSettings(TEST_USER.id, { easyMode: "full" });
    await waitUntil(() => !!sections(), "the full header");
  });

  test("this device's toggle wins over your own setting", async () => {
    setOwnSetting("full");
    await open();
    await expect.element(page.getByRole("button", { name: "View options" })).toBeVisible();
    expect(isEasy()).toBe(false);
    await pressEasyMode();
    await waitUntil(isEasy, "the easy view");
  });

  test("your own setting of Always shows it", async () => {
    setOwnSetting("easy");
    await open();
    await waitUntil(isEasy, "the easy view");
  });

  test("an old Follow the group setting on this device reads as full", async () => {
    setOwnSetting("group");
    await open();
    await expect.element(page.getByRole("button", { name: "View options" })).toBeVisible();
    expect(isEasy()).toBe(false);
  });

  for (const role of ["easy_helper", "easy_viewer"] as const)
    test(`an ${role === "easy_helper" ? "Easy helper" : "Easy viewer"} gets it whatever they chose: no toggle, and no Full app`, async () => {
      setOwnSetting("full");
      localStorage.setItem(TOGGLE_KEY, "full");
      await open({ role });
      await waitUntil(isEasy, "the easy view");
      expect(page.getByRole("button", { name: "Full app" }).elements()).toHaveLength(0);
      await userEvent.click(userButton());
      await expect.poll(menuItems).toEqual(["Settings", "Sign out"]);
      await userEvent.keyboard("{Escape}");
    });
});

describe("the account setting", () => {
  test("Always or Never, with no Follow the group: saved through the settings, and it clears this device's toggles", async () => {
    const calls = apiCalls();
    localStorage.setItem(TOGGLE_KEY, "full");
    await open({
      url: "/app/settings/timeline",
      api: calls.record({
        "me.get": () => ({ units: {}, timelineView: "rows", easyMode: "full" }),
        "me.updatePreferences": () => null,
      }),
    });
    const group = page.getByRole("radiogroup", { name: "Easy mode" });
    await expect.element(group).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "Never" })).toBeChecked();
    expect(group.getByRole("radio").elements()).toHaveLength(2);
    await userEvent.click(page.getByRole("radio", { name: "Always" }));
    await expect.poll(() => calls.of("me.updatePreferences")).toEqual([{ easyMode: "easy" }]);
    await expect.element(page.getByText("Saved.")).toBeVisible();
    expect(localStorage.getItem(TOGGLE_KEY)).toBeNull();
  });
});
