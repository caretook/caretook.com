import type { DeviceRoute } from "../../../../test/device";

import { afterEach, describe, expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { THEME_KEY } from "~/lib/app-shell/theme";
import * as entry from "~/routes/app/groups/entry/route";
import * as groupSettingsIndex from "~/routes/app/groups/settings/index/route";
import * as groupSettingsLayout from "~/routes/app/groups/settings/layout/route";
import * as timeline from "~/routes/app/groups/timeline/route";
import * as newSheet from "~/routes/app/groups/timeline/new/route";
import * as home from "~/routes/app/home/route";
import * as settingsIndex from "~/routes/app/settings/index/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import * as units from "~/routes/app/settings/units/route";
import { renderWithDevice } from "../../../../test/device";
import { fx, hoursAgo, TEST_GROUP, TEST_USER } from "../../../../test/fixtures";

// The /app frame (app-shell.mjs's screen steps): the header's regions, the
// user menu, the theme, the group menu and the last group, the tab bar and
// the header's section links. The real layout (`frame: true`) around real
// routes, on the test device. What needs a server or a real page load stays
// in app-shell.mjs: sign-out, the theme before first paint, and changes
// reaching another device.

const TIMELINE_PATH = "/app/groups/:groupId/timeline";
const timelineUrl = (groupId: string = TEST_GROUP.id) => `/app/groups/${groupId}/timeline`;

const ROUTES: DeviceRoute[] = [
  { path: "/app", id: "home", module: home },
  {
    path: TIMELINE_PATH,
    module: timeline,
    children: [{ path: `${TIMELINE_PATH}/new/:kind`, module: newSheet }],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: entry },
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [
      { path: "/app/settings", id: "settings-index", module: settingsIndex },
      { path: "/app/settings/units", module: units },
    ],
  },
  {
    path: "/app/groups/:groupId/settings",
    module: groupSettingsLayout,
    children: [
      { path: "/app/groups/:groupId/settings", id: "group-settings-index", module: groupSettingsIndex },
    ],
  },
];

/** A second group the user owns: Grandpa Lou's. */
const LOU = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b02", recipient: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c02" };
const louGroup = [
  fx.group({ id: LOU.id, name: "Moreno Family 2" }),
  fx.recipient({ id: LOU.recipient, groupId: LOU.id, name: "Lou Moreno", preferredName: "Grandpa Lou" }),
  fx.member({ userId: TEST_USER.id, groupId: LOU.id, role: "owner" }),
  // (A symptom: `fx.note`'s document stays in the default group.)
  fx.symptom({ groupId: LOU.id, recipientId: LOU.recipient, name: "Stiff back" }),
];

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: timelineUrl(),
    frame: true,
    fixtures: [fx.note({ text: "Slept well" }), fx.symptom({ name: "Sore knee" })],
    ...options,
  });

const active = () => document.activeElement;
const header = () => document.querySelector("body header")!;
const userButton = () => page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
const groupButton = () => page.getByRole("button", { name: /switch care group$/ });
const TAB_BAR = 'nav.dock[aria-label="Group sections"]';
const HEADER_NAV = '[data-region="sections"] nav[aria-label="Group sections"]';
const shown = (el: Element | null) =>
  !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;

afterEach(async () => {
  await commands.colorScheme(null);
});

describe("the header", () => {
  test("at 420: Caretook, sync status and the avatar on one row, nothing overflowing, the regions in order", async () => {
    await open();
    await expect.element(userButton()).toBeVisible();
    const brand = header().querySelector('[data-region="group"] a')!;
    const avatar = userButton().element();
    const mid = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    };
    expect(brand.textContent?.trim()).toBe("Caretook");
    expect(Math.abs(mid(brand) - mid(avatar))).toBeLessThan(4);
    expect(header().getBoundingClientRect().height).toBeLessThanOrEqual(72);
    await expect.poll(() => header().querySelector('[data-region="status"] [role="status"]')).not.toBeNull();
    expect(avatar.getBoundingClientRect().right).toBeLessThanOrEqual(document.documentElement.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    expect(
      [...header().querySelectorAll<HTMLElement>("[data-region]")].map((el) => el.dataset.region),
    ).toEqual(["group", "sections", "search", "status", "user"]);
    // No loose Settings or Sign out: they're in the menu.
    const loose = [...header().querySelectorAll("a, button")].map((el) => el.textContent?.trim());
    expect(loose).not.toContain("Settings");
    expect(loose).not.toContain("Sign out");
  });

  test("the avatar: the user's initials, and an accessible name", async () => {
    await open();
    await expect.element(userButton()).toHaveTextContent("AM");
  });
});

describe("the user menu", () => {
  test("by keyboard: Enter opens it on Settings, arrows move, the name and email aren't an item, Escape returns focus", async () => {
    await open();
    await expect.element(userButton()).toBeVisible();
    (userButton().element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    const menu = page.getByRole("menu");
    await expect.element(menu).toBeVisible();
    await expect.element(menu).toHaveAttribute("aria-label", "Account");
    await expect.element(page.getByText(TEST_USER.email)).toBeVisible();
    await expect.poll(() => active()?.textContent?.trim()).toBe("Settings");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => active()?.textContent?.trim()).toBe("System");
    const items = [...menu.element().querySelectorAll('[role^="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    );
    expect(items).toEqual(["Settings", "System", "Light", "Dark", "Sign out"]);
    expect(items.some((t) => t?.includes(TEST_USER.email))).toBe(false);
    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    await expect.poll(active).toBe(userButton().element());
  });

  test("a tap on Settings opens /app/settings, which keeps the header and has no group menu", async () => {
    const device = await open();
    await userEvent.click(userButton());
    await userEvent.click(page.getByRole("menuitem", { name: "Settings" }));
    await expect.poll(device.location).toBe("/app/settings");
    await expect.element(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect.element(userButton()).toBeVisible();
    expect(groupButton().query()).toBeNull();
    expect(header().querySelector('[data-region="group"]')?.textContent?.trim()).toBe("Caretook");
    expect(document.querySelector(TAB_BAR)).toBeNull();
  });
});

describe("the theme", () => {
  const state = () => ({
    attr: document.documentElement.dataset.theme ?? null,
    scheme: getComputedStyle(document.documentElement).colorScheme,
    saved: localStorage.getItem(THEME_KEY),
  });
  const choose = async (label: string) => {
    await userEvent.click(userButton());
    await userEvent.click(page.getByRole("menuitemradio", { name: label }));
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
  };

  test("System, Light and Dark radios; Dark applies at once, is saved on the device, and isn't sent anywhere", async () => {
    await commands.colorScheme("light");
    const device = await open();
    await userEvent.click(userButton());
    const radios = page.getByRole("menuitemradio");
    expect(radios.elements().map((el) => el.textContent?.trim())).toEqual(["System", "Light", "Dark"]);
    await expect.element(page.getByRole("menuitemradio", { name: "System" })).toBeChecked();
    await userEvent.keyboard("{Escape}");

    const sentBefore = performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes("/rpc/")).length;
    await choose("Dark");
    expect(state()).toEqual({ attr: "dark", scheme: "dark", saved: "dark" });
    expect(performance.getEntriesByType("resource").filter((e) => e.name.includes("/rpc/")).length).toBe(
      sentBefore,
    );
    expect(await device.queued()).toEqual([]);

    // Opened again (as after a reload), the menu reads the saved choice.
    await device.screen.unmount();
    await open();
    await userEvent.click(userButton());
    await expect.element(page.getByRole("menuitemradio", { name: "Dark" })).toBeChecked();
  });

  test("Light overrides a dark device; System removes the attribute and follows the device both ways", async () => {
    await commands.colorScheme("dark");
    await open();
    await choose("Light");
    expect(state()).toEqual({ attr: "light", scheme: "light", saved: "light" });

    await choose("System");
    expect(state()).toEqual({ attr: null, scheme: "dark", saved: null });
    await commands.colorScheme("light");
    await expect.poll(() => state().scheme).toBe("light");
    expect(state().attr).toBeNull();
  });

  test("storage that throws: the frame still renders in System, and a choice applies for the visit", async () => {
    await commands.colorScheme("dark");
    const real = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      await open();
      await expect.element(userButton()).toBeVisible();
      await expect.element(page.getByText("Slept well")).toBeVisible();
      expect(document.documentElement.dataset.theme).toBeUndefined();
      expect(getComputedStyle(document.documentElement).colorScheme).toBe("dark");
      await choose("Light");
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(getComputedStyle(document.documentElement).colorScheme).toBe("light");
    } finally {
      Object.defineProperty(window, "localStorage", real);
    }
  });
});

describe("the group menu and the last group", () => {
  const lastGroup = () => localStorage.getItem(`caretook:lastGroup:${TEST_USER.id}`);

  test("is in the header from the first paint: never a header without it while the group list loads", async () => {
    // Watch every frame from before the screen renders until its rows show.
    const seen: boolean[] = [];
    let watching = true;
    const watch = () => {
      if (document.querySelector("body header") && document.querySelector("main ol > li"))
        seen.push(!!document.querySelector('body header [aria-label$="switch care group"]'));
      if (watching) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    await open();
    await expect.poll(() => seen.length).toBeGreaterThan(3);
    watching = false;
    expect(seen.every(Boolean)).toBe(true);
  });

  test("two groups and none remembered: /app is the list", async () => {
    const device = await open({ url: "/app", fixtures: louGroup });
    await expect.element(page.getByRole("heading", { name: "Your care groups" })).toBeVisible();
    expect(
      page
        .getByRole("main")
        .getByRole("link", { name: /Grandma June|Grandpa Lou/ })
        .elements(),
    ).toHaveLength(2);
    expect(device.location()).toBe("/app");
  });

  test("names the current group, lists both with it checked, and one tap switches (and is remembered)", async () => {
    const device = await open({ fixtures: [fx.note({ text: "Slept well" }), louGroup] });
    await expect.element(groupButton()).toHaveTextContent("Grandma June");
    await userEvent.click(groupButton());
    await expect.element(page.getByRole("menu")).toHaveAttribute("aria-label", "Care groups");
    await expect.element(page.getByRole("menuitemradio", { name: /Grandma June/ })).toBeChecked();
    await expect.element(page.getByRole("menuitemradio", { name: /Grandpa Lou/ })).not.toBeChecked();
    await userEvent.click(page.getByRole("menuitemradio", { name: /Grandpa Lou/ }));
    await expect.poll(device.location).toBe(timelineUrl(LOU.id));
    await expect.element(page.getByText(/Stiff back · 3/)).toBeVisible();
    await expect.element(groupButton()).toHaveTextContent("Grandpa Lou");
    await expect.poll(lastGroup).toBe(LOU.id);

    await userEvent.click(groupButton());
    await expect.element(page.getByRole("menuitemradio", { name: /Grandpa Lou/ })).toBeChecked();
    await expect.element(page.getByRole("menuitemradio", { name: /Grandma June/ })).not.toBeChecked();
    await userEvent.keyboard("{Escape}");

    // The Caretook link goes to /app, which opens the last group.
    await userEvent.click(page.getByRole("link", { name: "Caretook" }));
    await expect.poll(device.location).toBe(timelineUrl(LOU.id));
    await expect.element(page.getByText(/Stiff back · 3/)).toBeVisible();
  });

  test("opened at /app (as after a reload), the remembered group opens", async () => {
    localStorage.setItem(`caretook:lastGroup:${TEST_USER.id}`, LOU.id);
    const device = await open({ url: "/app", fixtures: louGroup });
    await expect.poll(device.location).toBe(timelineUrl(LOU.id));
    await expect.element(groupButton()).toHaveTextContent("Grandpa Lou");
  });

  test("has New care group after the groups, then a separator, the recipient's profile, Care periods and Group settings last; Group settings opens the group's settings", async () => {
    const device = await open();
    await userEvent.click(groupButton());
    await expect.element(page.getByRole("menu")).toBeVisible();
    const menu = page.getByRole("menu").element();
    const tail = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="separator"]')]
      .slice(-5)
      .map((el) => `${el.getAttribute("role")}:${el.textContent?.trim()}`);
    expect(tail).toEqual([
      "menuitem:New care group",
      "separator:",
      "menuitem:Grandma June's profile",
      "menuitem:Care periods",
      "menuitem:Group settings",
    ]);
    await userEvent.click(page.getByRole("menuitem", { name: "Group settings" }));
    await expect.poll(device.location).toBe(`/app/groups/${TEST_GROUP.id}/settings`);
    await expect.element(page.getByRole("heading", { name: "Group settings", level: 1 })).toBeVisible();
    // Not a section: the tab bar shows, with nothing current.
    const bar = document.querySelector(TAB_BAR)!;
    expect(shown(bar)).toBe(true);
    expect(bar.querySelectorAll("a[aria-current]")).toHaveLength(0);
  });
});

describe("the sections", () => {
  // Enough entries that the page scrolls under the tab bar.
  const many = Array.from({ length: 12 }, (_, i) =>
    fx.note({ text: `Note ${i}`, occurredAt: hoursAgo(i + 1) }),
  );

  test("at 420: a bottom tab bar, Timeline current; the header's links hidden; the quick-add bar and the end of the page clear it", async () => {
    await open({ fixtures: many });
    await expect.element(page.getByText("Note 11")).toBeInTheDocument();
    const bar = document.querySelector(TAB_BAR)!;
    const links = [...bar.querySelectorAll("a")];
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      "Timeline",
      "Providers",
      "Medications",
      "Upcoming",
      "Todos",
    ]);
    expect(
      links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent?.trim()),
    ).toEqual(["Timeline"]);
    expect(links[0]?.getAttribute("href")).toBe(timelineUrl());
    expect(Math.abs(bar.getBoundingClientRect().bottom - innerHeight)).toBeLessThan(2);
    expect(shown(document.querySelector(HEADER_NAV))).toBe(false);

    const quick = page.getByRole("button", { name: "Add to Today" }).element().getBoundingClientRect();
    expect(quick.bottom).toBeLessThanOrEqual(bar.getBoundingClientRect().top);

    const end = () => document.querySelector("[data-older-entries] [role=status]");
    await expect.poll(() => end()?.textContent).toBe("That's the beginning of the timeline");
    window.scrollTo(0, document.documentElement.scrollHeight);
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    const top = bar.getBoundingClientRect().top;
    const last = [...document.querySelectorAll("main ol > li")].at(-1)!.getBoundingClientRect().bottom;
    const r = end()!.getBoundingClientRect();
    expect(last).toBeLessThanOrEqual(top);
    expect(r.bottom).toBeLessThanOrEqual(top);
    expect(end()!.contains(document.elementFromPoint(r.left + r.width / 2, r.bottom - 4))).toBe(true);
  });

  test("at 420: an open add sheet is over the tab bar, its Save button not hidden", async () => {
    await open();
    await userEvent.click(page.getByRole("button", { name: "Add to Today" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Symptom" }));
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    const submit = dialog.element().querySelector<HTMLElement>('button[type="submit"]')!;
    submit.scrollIntoView({ block: "end" });
    const s = submit.getBoundingClientRect();
    const bar = document.querySelector(TAB_BAR)!;
    const b = bar.getBoundingClientRect();
    expect(
      dialog.element().contains(document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2)),
    ).toBe(true);
    expect(bar.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2))).toBe(false);
  });

  test("the entry page and a new entry: no tab bar and no spacer; the header link says it's inside Timeline", async () => {
    const note = fx.note({ text: "Slept well" });
    const device = await open({ url: `/app/groups/${TEST_GROUP.id}/entries/${note.id}`, fixtures: [note] });
    await expect.element(page.getByRole("textbox").first()).toBeInTheDocument();
    expect(document.querySelector(TAB_BAR)).toBeNull();
    expect(document.querySelector("[data-tab-bar-spacer]")).toBeNull();
    expect(document.querySelector(`${HEADER_NAV} a`)?.getAttribute("aria-current")).toBe("true");
    await device.screen.unmount();

    await open({ url: `/app/groups/${TEST_GROUP.id}/entries/new?kind=note` });
    await expect.element(page.getByRole("textbox").first()).toBeInTheDocument();
    expect(document.querySelector(TAB_BAR)).toBeNull();
  });

  test("at 1280: no tab bar or spacer; the header's links, Timeline current", async () => {
    await open({ width: 1280 });
    await expect.element(page.getByText("Slept well")).toBeVisible();
    expect(shown(document.querySelector(TAB_BAR))).toBe(false);
    expect(shown(document.querySelector("[data-tab-bar-spacer]"))).toBe(false);
    const nav = document.querySelector(HEADER_NAV)!;
    expect(shown(nav)).toBe(true);
    const links = [...nav.querySelectorAll("a")];
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      "Timeline",
      "Providers",
      "Medications",
      "Upcoming",
      "Todos",
    ]);
    expect(
      links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent?.trim()),
    ).toEqual(["Timeline"]);
  });
});
