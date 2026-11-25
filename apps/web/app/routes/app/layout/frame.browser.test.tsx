import type { DeviceRoute } from "../../../../test/device";

import { afterEach, describe, expect, test } from "vitest";
import { cdp, commands, page, userEvent } from "vitest/browser";
import { toast } from "~/components/ui";
import { THEME_KEY } from "~/lib/app-shell/theme";
import * as groupSettingsIndex from "~/routes/app/groups/settings/index/route";
import * as groupSettingsLayout from "~/routes/app/groups/settings/layout/route";
import * as home from "~/routes/app/home/route";
import * as settingsIndex from "~/routes/app/settings/index/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import * as units from "~/routes/app/settings/units/route";
import { over, ratio, rgba, surfaceContrast, surfaceOf, textContrast } from "../../../../test/contrast";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { fx, hoursAgo, TEST_GROUP, TEST_USER } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";

// The /app frame (app-shell.mjs's screen steps): the header's regions, the
// user menu, the theme, the group menu and the last group, the tab bar and
// the header's section links, which section is current where. The real
// layout (`frame: true`) around the probe route (test/probe.tsx) at every
// group path, so no screen's change breaks it; home and the settings pages
// are real. What needs a server or a real page load stays in app-shell.mjs:
// sign-out, the theme before first paint, and changes reaching another device.

const timelineUrl = (groupId: string = TEST_GROUP.id) => `/app/groups/${groupId}/timeline`;

const ROUTES: DeviceRoute[] = [
  { path: "/app", id: "home", module: home },
  PROBE,
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
const TAB_BAR = 'nav[data-tab-bar][aria-label="Group sections"]';
/** A section link's accessible name: the bar's icons carry it in `aria-label`, the header's in their text. */
const nameOf = (a: Element) => a.getAttribute("aria-label") ?? a.textContent?.trim();
const HEADER_NAV = '[data-region="sections"] nav[aria-label="Group sections"]';
const shown = (el: Element | null) =>
  !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;

/** Chrome DevTools, for reduced-motion emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };

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
    await expect.element(page.getByText("Stiff back")).toBeVisible();
    await expect.element(groupButton()).toHaveTextContent("Grandpa Lou");
    await expect.poll(lastGroup).toBe(LOU.id);

    await userEvent.click(groupButton());
    await expect.element(page.getByRole("menuitemradio", { name: /Grandpa Lou/ })).toBeChecked();
    await expect.element(page.getByRole("menuitemradio", { name: /Grandma June/ })).not.toBeChecked();
    await userEvent.keyboard("{Escape}");

    // The Caretook link goes to /app, which opens the last group.
    await userEvent.click(page.getByRole("link", { name: "Caretook" }));
    await expect.poll(device.location).toBe(timelineUrl(LOU.id));
    await expect.element(page.getByText("Stiff back")).toBeVisible();
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
  const G = `/app/groups/${TEST_GROUP.id}`;
  const SECTIONS = ["Timeline", "Providers", "Medications", "Planner"];
  /** Each section's own page, where its link goes. */
  const PAGE: Record<string, string> = {
    Timeline: `${G}/timeline`,
    Providers: `${G}/providers`,
    Medications: `${G}/medications/schedule`,
    Planner: `${G}/planner`,
  };
  const current = (nav: string) =>
    [...document.querySelectorAll(`${nav} a[aria-current]`)].map((a) => [
      nameOf(a),
      a.getAttribute("aria-current"),
      a.getAttribute("href"),
    ]);
  const ENTRY = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1e01";

  // One table for the sections' current link (sectionCurrent's rule is groupSections.test.ts's):
  // its section's own page is "page", a page inside it "true"; an entry's page has no tab bar.
  test.each([
    ["/timeline", "Timeline", "page"],
    [`/entries/${ENTRY}`, "Timeline", "true"],
    ["/entries/new?kind=note", "Timeline", "true"],
    ["/providers", "Providers", "page"],
    [`/providers/${ENTRY}`, "Providers", "true"],
    ["/medications/schedule", "Medications", "page"],
    ["/medications/list", "Medications", "true"],
    ["/planner", "Planner", "page"],
    ["/planner/past", "Planner", "true"],
    ["/todos?who=everyone", "Planner", "true"],
    [`/todos/${ENTRY}`, "Planner", "true"],
  ])("%s: %s is current (%s), in the tab bar at 420 and the header at 1280", async (path, section, value) => {
    for (const width of [420, 1280]) {
      const device = await open({ url: `${G}${path}`, width });
      await expect.element(page.getByRole("heading", { name: "Probe", level: 1 })).toBeVisible();
      const bar = width === 420 && !path.startsWith("/entries");
      expect(shown(document.querySelector(TAB_BAR)), `the tab bar at ${width}`).toBe(bar);
      expect(shown(document.querySelector("[data-tab-bar-spacer]")), `the spacer at ${width}`).toBe(bar);
      expect(shown(document.querySelector(HEADER_NAV)), `the header's links at ${width}`).toBe(
        width === 1280,
      );
      const nav = bar ? TAB_BAR : HEADER_NAV;
      expect([...document.querySelectorAll(`${nav} a`)].map(nameOf)).toEqual(SECTIONS);
      expect(current(nav), `at ${width}`).toEqual([[section, value, PAGE[section]]]);
      await device.screen.unmount();
    }
  });

  test("at 420: the end of a long page clears the tab bar", async () => {
    await open({
      fixtures: Array.from({ length: 40 }, (_, i) =>
        fx.note({ text: `Note ${i}`, occurredAt: hoursAgo(i + 1) }),
      ),
    });
    await expect.element(page.getByText("Note 39")).toBeInTheDocument();
    const bar = document.querySelector(TAB_BAR)!;
    // It floats: clear of the window's bottom edge.
    expect(innerHeight - bar.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(8);
    window.scrollTo(0, document.documentElement.scrollHeight);
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    const end = document.querySelector("[data-probe-end]")!;
    const r = end.getBoundingClientRect();
    expect(r.bottom).toBeLessThanOrEqual(bar.getBoundingClientRect().top);
    expect(end.contains(document.elementFromPoint(r.left + r.width / 2, r.bottom - 4))).toBe(true);
  });

  test("at 420: an open sheet is over the tab bar, its Save button not hidden", async () => {
    await open();
    await userEvent.click(page.getByRole("button", { name: "Probe actions" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Open the sheet" }));
    const dialog = page.getByRole("dialog", { name: "Probe sheet" });
    await expect.element(dialog).toBeVisible();
    const submit = dialog.getByRole("button", { name: "Save" }).element();
    submit.scrollIntoView({ block: "end" });
    const s = submit.getBoundingClientRect();
    const bar = await found(() => document.querySelector(TAB_BAR));
    const b = bar.getBoundingClientRect();
    expect(
      dialog.element().contains(document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2)),
    ).toBe(true);
    expect(bar.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2))).toBe(false);
  });
});

describe("the floating tab bar", () => {
  const bar = () => document.querySelector<HTMLElement>(TAB_BAR)!;
  const barLinks = () => [...bar().querySelectorAll<HTMLAnchorElement>("a")];
  const indicator = () => bar().querySelector<HTMLElement>("[data-tab-bar-indicator]")!;

  test("at 420: icon links named by their sections (with the same title), each at least 44 px, the bar clear of the window's edges", async () => {
    await open();
    await expect.element(page.getByText("Slept well")).toBeVisible();
    const links = barLinks();
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
      "Timeline",
      "Providers",
      "Medications",
      "Planner",
    ]);
    for (const a of links) {
      expect(a.getAttribute("title")).toBe(a.getAttribute("aria-label"));
      expect(a.textContent?.trim()).toBe("");
      await expect
        .element(page.getByRole("link", { name: a.getAttribute("aria-label") ?? "" }).first())
        .toBeVisible();
      const r = a.getBoundingClientRect();
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
    const b = bar().getBoundingClientRect();
    expect(b.left).toBeGreaterThanOrEqual(16);
    expect(innerWidth - b.right).toBeGreaterThanOrEqual(16);
    expect(innerHeight - b.bottom).toBeGreaterThanOrEqual(8);
    // The spacer reserves the bar, its gap below and some room above it.
    const spacer = document.querySelector("[data-tab-bar-spacer]")!.getBoundingClientRect();
    expect(spacer.height).toBeGreaterThanOrEqual(innerHeight - b.top);
  });

  test("at 420: the links split the bar into equal full-height sections inside its 2px edge, the current one on a full-height pill with the bar's radius, the focus ring inside it", async () => {
    await open();
    await expect.element(page.getByText("Slept well")).toBeVisible();
    const b = bar().getBoundingClientRect();
    const links = barLinks();
    const rects = links.map((a) => a.getBoundingClientRect());
    const widths = rects.map((r) => r.width);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    expect(widths.reduce((sum, w) => sum + w, 0)).toBeGreaterThan(b.width - 5);
    expect(Math.min(...rects.map((r) => r.left)) - b.left).toBeLessThan(3);
    expect(b.right - Math.max(...rects.map((r) => r.right))).toBeLessThan(3);
    for (const r of rects) {
      expect(r.height).toBeGreaterThanOrEqual(44);
      expect(r.top - b.top).toBeLessThan(3);
      expect(b.bottom - r.bottom).toBeLessThan(3);
    }
    const current = links.filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.getAttribute("aria-label"))).toEqual(["Timeline"]);
    // The pill covers the current link's slot, full height, rounded like the bar.
    await expect.poll(() => indicator().getBoundingClientRect().left - rects[0]!.left).toBeCloseTo(0, 0);
    const pill = indicator().getBoundingClientRect();
    expect(pill.width).toBeCloseTo(rects[0]!.width, 0);
    expect(pill.top).toBeCloseTo(rects[0]!.top, 0);
    expect(pill.height).toBeCloseTo(rects[0]!.height, 0);
    expect(getComputedStyle(indicator()).borderTopLeftRadius).toBe(
      getComputedStyle(bar()).borderTopLeftRadius,
    );
    // Links have no fill of their own; they round like the pill, so the ring follows it.
    const middle = links[1]!;
    expect(rgba(getComputedStyle(middle).backgroundColor)[3]).toBe(0);
    expect(getComputedStyle(middle).borderTopLeftRadius).toBe(getComputedStyle(bar()).borderTopLeftRadius);
    expect(getComputedStyle(bar()).overflow).toBe("hidden");
    // Keyboard focus draws the ring inside the link, in the bar's content colour.
    links[0]!.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(middle);
    const ring = getComputedStyle(middle);
    expect(ring.outlineStyle).toBe("solid");
    expect(parseFloat(ring.outlineOffset)).toBeLessThan(0);
    expect(ring.outlineColor).toBe(getComputedStyle(bar()).color);
  });

  test("at 420: the bar is thin (48px, was 56) and translucent over a backdrop blur; the pill slides to a tapped section", async () => {
    await open();
    await expect.element(page.getByText("Slept well")).toBeVisible();
    expect(bar().getBoundingClientRect().height).toBeCloseTo(48, 0);
    const style = getComputedStyle(bar());
    expect(style.backdropFilter).toMatch(/blur\(/);
    const surface = rgba(style.backgroundColor)[3];
    expect(surface).toBeGreaterThan(0.6);
    expect(surface).toBeLessThan(1);
    // The pill moves by transform, on --motion.
    const motion = getComputedStyle(indicator());
    expect(motion.transitionProperty).toContain("transform");
    expect(parseFloat(motion.transitionDuration)).toBeGreaterThan(0.1);
    expect(parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(0.3);
    const planner = barLinks()[3]!;
    await userEvent.click(planner);
    await expect.poll(() => planner.getAttribute("aria-current")).toBe("page");
    await expect
      .poll(() => indicator().getBoundingClientRect().left - planner.getBoundingClientRect().left)
      .toBeCloseTo(0, 0);
  });

  test("at 420 with reduced motion: the pill has no transition", async () => {
    await devtools().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    try {
      await open();
      await expect.element(page.getByText("Slept well")).toBeVisible();
      const motion = getComputedStyle(indicator());
      expect(motion.transitionDuration.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
    } finally {
      await devtools().send("Emulation.setEmulatedMedia", { features: [] });
    }
  });

  test("at 420: a toast sits above the bar, and drops to the edge while the keyboard hides the bar", async () => {
    await open();
    await expect.element(page.getByText("Slept well")).toBeVisible();
    toast({ message: "A new version is ready", timeout: null });
    const shown = page.getByRole("alertdialog", { name: "A new version is ready" });
    await expect.element(shown).toBeVisible();
    expect(shown.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(
      bar().getBoundingClientRect().top,
    );
    // The bar slides away while typing (B-664): the toast no longer clears it.
    bar().dataset.keyboardOpen = "";
    await expect
      .poll(() => innerHeight - shown.element().getBoundingClientRect().bottom)
      .toBeLessThan(bar().getBoundingClientRect().height);
  });

  // Headless Chromium has no safe area, so the inset is simulated through
  // `--tab-bar-inset` (app.css reads `env(safe-area-inset-bottom)` into it).
  test.each([
    ["no inset", null, 12],
    ["a 34px inset (an iPhone's home indicator)", "34px", 34],
  ] as const)(
    "at 420 with %s: the bar sits just above it, the spacer following",
    async (_, inset, expected) => {
      if (inset) document.documentElement.style.setProperty("--tab-bar-inset", inset);
      try {
        await open();
        await expect.element(page.getByText("Slept well")).toBeVisible();
        const b = bar().getBoundingClientRect();
        const offset = innerHeight - b.bottom;
        if (inset) {
          // The inset plus at most 8px, not the full gap on top of it.
          expect(offset).toBeGreaterThanOrEqual(expected);
          expect(offset).toBeLessThanOrEqual(expected + 8);
        } else {
          // Today's 12px gap.
          expect(offset).toBeCloseTo(expected, 0);
        }
        // The spacer reserves the bar, its offset and the gap above it.
        const spacer = document.querySelector("[data-tab-bar-spacer]")!.getBoundingClientRect();
        expect(spacer.height).toBeCloseTo(innerHeight - b.top + 12, 0);
      } finally {
        document.documentElement.style.removeProperty("--tab-bar-inset");
      }
    },
  );

  test.each(["light", "dark"] as const)(
    "in %s: the bar's surface stands off the page and from a card in dark, matches the page in light; resting icons clear 4.5:1 and the current one 3:1 on its solid pill",
    async (theme) => {
      await open({ theme });
      await expect.element(page.getByText("Slept well")).toBeVisible();
      const probe = document.createElement("div");
      probe.className = "bg-base-100";
      document.body.append(probe);
      const onPage = surfaceContrast(bar(), document.body);
      const fromCard = surfaceContrast(bar(), probe);
      probe.remove();
      const links = barLinks();
      const current = links.find((a) => a.getAttribute("aria-current") === "page")!;
      const resting = links.find((a) => !a.hasAttribute("aria-current"))!;
      const icon = (a: Element) => textContrast(a.querySelector("svg")!);
      const pill = indicator();
      const onPill = ratio(
        over(rgba(getComputedStyle(current.querySelector("svg")!).color), surfaceOf(pill)),
        surfaceOf(pill),
      );
      if (theme === "dark") {
        expect(onPage).toBeGreaterThanOrEqual(1.4);
        expect(fromCard).toBeGreaterThan(1.2);
      } else {
        // Light matches the page (B-817): a light bar, raised by its shadow.
        expect(onPage).toBeLessThan(1.2);
        expect(getComputedStyle(bar()).boxShadow).not.toBe("none");
      }
      expect(icon(resting)).toBeGreaterThanOrEqual(4.5);
      expect(onPill).toBeGreaterThanOrEqual(3);
      expect(rgba(getComputedStyle(pill).backgroundColor)[3]).toBe(1);
    },
  );

  // B-817: light mode's bar was near-black `neutral`; dark's glass was 85% surface.
  const luminance = ([r, g, b]: readonly number[]) => (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;

  test("in light: the bar is light, not near-black, and its labels clear 4.5:1 on it", async () => {
    await open({ theme: "light" });
    await expect.element(page.getByText("Slept well")).toBeVisible();
    expect(luminance(surfaceOf(bar()))).toBeGreaterThan(0.85);
    expect(textContrast(bar())).toBeGreaterThanOrEqual(4.5);
    const icons = barLinks()
      .filter((link) => !link.hasAttribute("aria-current"))
      .map((link) => link.querySelector("svg"))
      .filter((svg) => svg !== null);
    expect(icons.length).toBe(3);
    for (const svg of icons) expect(textContrast(svg)).toBeGreaterThanOrEqual(4.5);
  });

  test("in dark: the bar's glass is more translucent than before (alpha below 0.85 over the blur), its labels still 4.5:1", async () => {
    await open({ theme: "dark" });
    await expect.element(page.getByText("Slept well")).toBeVisible();
    const style = getComputedStyle(bar());
    expect(style.backdropFilter).toMatch(/blur\(/);
    const alpha = rgba(style.backgroundColor)[3];
    expect(alpha).toBeLessThan(0.85);
    expect(alpha).toBeGreaterThan(0.5);
    expect(textContrast(bar())).toBeGreaterThanOrEqual(4.5);
  });
});
