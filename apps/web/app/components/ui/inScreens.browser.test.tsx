import type { DeviceRoute } from "../../../test/device";

import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as entry from "~/routes/app/groups/entry/route";
import * as providerEdit from "~/routes/app/groups/providers/edit/route";
import * as providerNew from "~/routes/app/groups/providers/new/route";
import * as providers from "~/routes/app/groups/providers/route";
import * as editSheet from "~/routes/app/groups/timeline/edit/route";
import * as newDose from "~/routes/app/groups/timeline/new-dose/route";
import * as newSheet from "~/routes/app/groups/timeline/new/route";
import * as timeline from "~/routes/app/groups/timeline/route";
import { renderWithDevice } from "../../../test/device";
import { found } from "../../../test/found";
import { fx, hoursAgo, TEST_GROUP, TEST_USER } from "../../../test/fixtures";

// The ui/ primitives where the screens use them (ui.mjs's steps): every menu,
// sheet, popover and confirm on the timeline, the entry page and the
// providers directory, by tap and by keyboard, named, focus in on open and
// back on the opener after Escape, on the theme's surface; sheets full screen
// on phones and centred from `sm`; the chip groups, the field's error, the
// tooltip on a row's initials, and the date field on narrow phones. The
// primitives' own contracts are primitives.browser.test.tsx's.

const T = "/app/groups/:groupId/timeline";
const P = "/app/groups/:groupId/providers";
const ROUTES: DeviceRoute[] = [
  {
    path: T,
    module: timeline,
    children: [
      { path: `${T}/new/dose`, module: newDose },
      { path: `${T}/new/:kind`, module: newSheet },
      { path: `${T}/:entryId/edit`, module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: entry },
  {
    path: P,
    module: providers,
    children: [
      { path: `${P}/new`, module: providerNew },
      { path: `${P}/:providerId/edit`, module: providerEdit },
    ],
  },
];
const TIMELINE = `/app/groups/${TEST_GROUP.id}/timeline`;
const PROVIDERS = `/app/groups/${TEST_GROUP.id}/providers`;

const NOTE = fx.note({ text: "Slept well", occurredAt: hoursAgo(2) });
const SYMPTOM = fx.symptom({ name: "Sore knee", occurredAt: hoursAgo(1) });
const EVENT = fx.event({ title: "Physical therapy", occurredAt: hoursAgo(5) });
const CLINIC = fx.provider({ name: "Lakeside Clinic", type: "practice" });
const FIXTURES = [
  NOTE,
  SYMPTOM,
  EVENT,
  fx.event({ title: "Eye exam", occurredAt: hoursAgo(30) }),
  CLINIC,
  fx.medication(),
];

const open = (url: string, layout: { width: number; theme: "light" | "dark" }, frame = true) =>
  renderWithDevice({ route: ROUTES, url, fixtures: FIXTURES, frame, ...layout });

// ---- What the checks read ---------------------------------------------------

const active = () => document.activeElement;
const q = <E extends Element = HTMLElement>(selector: string) => document.querySelector<E>(selector);
const must = <E extends Element = HTMLElement>(selector: string) => {
  const el = q<E>(selector);
  if (!el) throw new Error(`nothing matches ${selector}`);
  return el;
};

/** An element's accessible name as ui.mjs read it: aria-label, else what labels it. */
const nameOf = (el: Element | null | undefined) =>
  !el
    ? ""
    : el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby") ?? "")
        .split(" ")
        .map((id) => {
          const by = document.getElementById(id);
          return by?.getAttribute("aria-label") || by?.textContent?.trim() || "";
        })
        .join(" ")
        .trim();

/** The theme's `base-100` (menus, popovers and sheets sit on it). */
const base100 = () => {
  const probe = document.createElement("div");
  probe.className = "bg-base-100";
  document.body.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
};

/** The first opaque background at or above `el`. */
const surface = (el: Element | null) => {
  for (let at = el; at; at = at.parentElement) {
    const bg = getComputedStyle(at).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(.*, 0\)$/.test(bg)) return at as HTMLElement;
  }
  return null;
};

const MENU = '[role="menu"]';
const ITEMS = '[role="menu"] [role^="menuitem"]';
const OVERLAYS = '[role="dialog"], dialog[open]';
const overlays = () => [...document.querySelectorAll(OVERLAYS)];
const top = () => overlays().at(-1) ?? null;

/**
 * One menu, by tap then by keyboard: named, its items (or how many), on the
 * theme's surface; Escape closes it and focus returns; Enter opens it with
 * focus on an item, and an arrow moves it.
 */
async function menu(
  trigger: () => HTMLElement,
  want: { name: string | RegExp; items?: string; count?: number },
) {
  await expect.poll(() => q(MENU)).toBeNull();
  await userEvent.click(trigger());
  await expect.poll(() => q(MENU)).not.toBeNull();
  const m = must(MENU);
  if (typeof want.name === "string") expect(nameOf(m)).toBe(want.name);
  else expect(nameOf(m)).toMatch(want.name);
  const texts = [...document.querySelectorAll(ITEMS)].map((el) => el.textContent?.trim());
  if (want.items !== undefined) expect(texts.join(",")).toBe(want.items);
  if (want.count !== undefined) expect(texts).toHaveLength(want.count);
  expect(getComputedStyle(surface(m)!).backgroundColor).toBe(base100());
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => q(MENU)).toBeNull();
  await expect.poll(active).toBe(trigger());

  trigger().focus();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => active()?.getAttribute("role") ?? "").toMatch(/^menuitem/);
  const first = active();
  if (texts.length > 1) {
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(active).not.toBe(first);
    expect(must(MENU).contains(active())).toBe(true);
  }
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => q(MENU)).toBeNull();
  await expect.poll(active).toBe(trigger());
}

/**
 * A sheet, popover or dialog opened from `trigger`, by tap then by keyboard
 * (focus, Enter): named, focus inside, on the theme's surface; a sheet fills
 * the screen below `sm` (scrolling inside, above the tab bar) and is a
 * centred dialog from `sm`, with a Close button. Escape closes only it, and
 * focus returns to the opener.
 */
async function overlay(trigger: () => HTMLElement, want: { name: string | RegExp; sheet?: boolean }) {
  for (const how of ["tap", "keyboard"] as const) {
    const before = overlays().length;
    if (how === "tap") await userEvent.click(trigger());
    else {
      trigger().focus();
      await userEvent.keyboard("{Enter}");
    }
    await expect.poll(() => overlays().length).toBe(before + 1);
    const box = top()!;
    if (typeof want.name === "string") await expect.poll(() => nameOf(top())).toBe(want.name);
    else await expect.poll(() => nameOf(top())).toMatch(want.name);
    await expect.poll(() => box.contains(active())).toBe(true);
    if (how === "tap") {
      const panel = surface(box)!;
      expect(getComputedStyle(panel).backgroundColor).toBe(base100());
      if (want.sheet) {
        await Promise.all(panel.getAnimations().map((a) => a.finished.catch(() => undefined)));
        const r = panel.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const onTop = panel.contains(
          document.elementFromPoint(r.left + r.width / 2, Math.min(r.bottom, innerHeight) - 4),
        );
        if (vw < 640) {
          expect([Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)]).toEqual([
            0,
            0,
            vw,
            innerHeight,
          ]);
          expect(getComputedStyle(panel).overflowY).toBe("auto");
        } else {
          expect(r.bottom).toBeLessThan(innerHeight);
          expect(Math.abs(r.left * 2 + r.width - vw)).toBeLessThanOrEqual(2);
        }
        expect(onTop).toBe(true);
        expect(box.querySelector('button[aria-label="Close"]')).not.toBeNull();
      }
    }
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => overlays().length).toBe(before);
    await expect.poll(active).toBe(trigger());
  }
}

const rowActions = (kind: string) => () => must(`main ol > li button[aria-label^="Actions for ${kind} at"]`);
const addButton = () => must('main [data-day-header] button[aria-label="Add to Today"]');
/** Pick `label` from today's + menu. */
const quickAdd = async (label: string) => {
  await userEvent.click(addButton());
  await expect.poll(() => q(MENU)).not.toBeNull();
  await userEvent.click(
    [...document.querySelectorAll<HTMLElement>(ITEMS)].find((el) => el.textContent?.trim() === label)!,
  );
};
const inSheet = (label: string) => () =>
  [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find((b) =>
    b.textContent?.trim().startsWith(label),
  )!;
const TIME_CHIP = () => must('main header button[aria-label="Change when it happened"]');
const PICK = () =>
  [...document.querySelectorAll<HTMLElement>('[role="dialog"] [aria-label="Pick a date"]')].at(-1)!;
const rows = () => document.querySelectorAll("main ol > li:not([data-marker])").length;

// ---- The screens, at a phone's width in light and a desktop's in dark ------

describe.each([
  { width: 420, theme: "light" },
  { width: 1280, theme: "dark" },
] as const)("at $width, $theme", (layout) => {
  test("the timeline's menus: the user and group menus, each row's ⋯, and the + menu (which stays on the timeline)", async () => {
    const device = await open(TIMELINE, layout);
    await expect.poll(rows).toBe(4);
    await menu(() => page.getByRole("button", { name: /^Account menu for/ }).element() as HTMLElement, {
      name: "Account",
      items: "Settings,System,Light,Dark,Sign out",
    });
    await menu(() => page.getByRole("button", { name: /switch care group$/ }).element() as HTMLElement, {
      name: "Care groups",
    });
    await menu(rowActions("note"), { name: /^Actions for note at /, items: "Print,Delete" });
    await menu(rowActions("symptom"), { name: /^Actions for symptom at /, items: "Edit,Delete" });
    await menu(addButton, { name: "Add to Today", count: 5 });
    expect(device.location()).toBe(TIMELINE);
  });

  test("the + menu's Vitals: a group that expands in place to the vital types, the menu staying open; Blood pressure opens the vital sheet for it", async () => {
    const device = await open(TIMELINE, layout);
    await expect.poll(rows).toBe(4);
    await userEvent.click(addButton());
    const vitals = page.getByRole("menuitem", { name: "Vitals" });
    await expect.element(vitals).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(vitals);
    await expect.element(vitals).toHaveAttribute("aria-expanded", "true");
    expect(q(MENU)).not.toBeNull();
    const types = [...document.querySelectorAll(`${ITEMS}[data-menu-group-item]`)].map((el) =>
      el.textContent?.trim(),
    );
    expect(types).toEqual(VITAL_TYPES.map((t) => VITALS[t].label));
    await userEvent.click(page.getByRole("menuitem", { name: "Blood pressure" }));
    await expect.poll(() => q(MENU)).toBeNull();
    await expect.poll(device.location).toBe(`${TIMELINE}/new/vital?type=bloodPressure`);
    await expect.poll(() => nameOf(top())).toBe("Add to the timeline");
  });

  test("the timeline's chips and toggles: Filter opens a sheet whose kind filter is a nav with All current, a tap filters; Done returns focus; View options a named menu with the layouts, one checked", async () => {
    const device = await open(TIMELINE, layout);
    const filter = page.getByRole("button", { name: "Filter", exact: true });
    await userEvent.click(filter);
    await expect.element(page.getByRole("dialog", { name: "Filter entries" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Show entries" });
    await expect
      .element(nav.getByRole("link", { name: "All", exact: true }))
      .toHaveAttribute("aria-current", "true");
    expect(nav.element().tagName).toBe("NAV");
    await userEvent.click(nav.getByRole("link", { name: "Symptoms" }));
    await expect.poll(device.location).toBe(`${TIMELINE}?kind=symptom`);
    await expect.element(nav.getByRole("link", { name: "Symptoms" })).toHaveAttribute("aria-current", "true");
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("Filter, 1 on");
    const viewOptions = () => page.getByRole("button", { name: "View options" }).element() as HTMLElement;
    await menu(viewOptions, { name: "View options" });
    await userEvent.click(viewOptions());
    await expect.poll(() => q(MENU)).not.toBeNull();
    const layouts = [...document.querySelectorAll('[role="menuitemradio"]')].slice(0, 2);
    expect(layouts.map((r) => r.textContent?.trim())).toEqual(["Rows", "Cards"]);
    expect(layouts.filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
  });

  test("the add and edit sheets; the field's error; the calendar inside a sheet (Escape closes only it); the kind picker's and Add a reading's menus", async () => {
    await open(TIMELINE, layout);
    await expect.poll(rows).toBe(4);
    await overlay(() => must('main ol > li a[aria-label^="Edit symptom"]'), {
      name: "Edit symptom",
      sheet: true,
    });

    // A symptom with no name: labelled, invalid, described by its error.
    await quickAdd("Symptom");
    await expect.poll(() => nameOf(top())).toBe("Add to the timeline");
    await expect.poll(() => q('[role="dialog"] input[name="symptomName"]')).not.toBeNull();
    await userEvent.click(must('[role="dialog"] button[type="submit"]'));
    const input = must<HTMLInputElement>('[role="dialog"] input[name="symptomName"]');
    await expect.poll(() => input.getAttribute("aria-invalid")).toBe("true");
    expect(q(`label[for="${input.id}"]`)?.textContent?.trim()).toBe("Symptom");
    expect(
      (input.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .join(" "),
    ).toBe("Name the symptom.");
    await overlay(PICK, { name: /\S/ });
    expect(q('[role="dialog"]')).not.toBeNull();

    // The kind picker's Vitals menu; Enter on a type makes it a vitals form, whose Add a reading menu closes alone.
    await menu(inSheet("Vitals"), { name: "Vital type", count: 10 });
    inSheet("Vitals")().focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => q(MENU)).not.toBeNull();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => !q(MENU) && !!inSheet("+ Add a reading")()).toBe(true);
    await menu(inSheet("+ Add a reading"), { name: "Vital type", count: 9 });
    expect(q('[role="dialog"]')).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => q('[role="dialog"]')).toBeNull();
  });

  test("the timeline's Delete confirm, from a symptom's ⋯ by tap and by keyboard: named, focus inside, themed; Escape returns focus to the ⋯", async () => {
    await open(TIMELINE, layout);
    await expect.poll(rows).toBe(4);
    const trigger = rowActions("symptom");
    for (const how of ["tap", "keyboard"] as const) {
      if (how === "tap") {
        await userEvent.click(trigger());
        await expect.poll(() => q(MENU)).not.toBeNull();
        await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
      } else {
        trigger().focus();
        await userEvent.keyboard("{Enter}");
        await expect.poll(() => q(MENU)).not.toBeNull();
        await userEvent.keyboard("{ArrowDown}");
        await userEvent.keyboard("{Enter}");
      }
      await expect.poll(() => q("dialog[open]")).not.toBeNull();
      const dialog = must("dialog[open]");
      await expect.poll(() => nameOf(dialog)).toBe("Delete this entry?");
      await expect.poll(() => dialog.contains(active())).toBe(true);
      expect(getComputedStyle(surface(dialog.querySelector(".modal-box"))!).backgroundColor).toBe(base100());
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => q("dialog[open]")).toBeNull();
      await expect.poll(active).toBe(trigger());
    }
  });

  test("the entry page: its ⋯ has the row's items; the time chip's popover and the calendar inside it (Escape closes only the calendar)", async () => {
    await open(`/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`, layout);
    const pageActions = () =>
      must('main header [data-region="actions"] button[aria-label^="Actions for this"]');
    await expect
      .poll(() => q('main header [data-region="actions"] button[aria-label^="Actions for this"]'))
      .not.toBeNull();
    await menu(pageActions, { name: "Actions for this note", items: "Print,Delete" });
    await overlay(TIME_CHIP, { name: "When it happened" });
    await userEvent.click(TIME_CHIP());
    await expect.poll(() => q('[role="dialog"] [aria-label="Pick a date"]')).not.toBeNull();
    await overlay(PICK, { name: /\S/ });
    expect(q('[role="dialog"] [aria-label="Pick a date"]')).not.toBeNull();
    await userEvent.keyboard("{Escape}");
  });

  test("an event's page ⋯: Reschedule, Cancel event, Delete", async () => {
    await open(`/app/groups/${TEST_GROUP.id}/entries/${EVENT.id}`, layout);
    await expect
      .poll(() => q('main header [data-region="actions"] button[aria-label^="Actions for this"]'))
      .not.toBeNull();
    await menu(() => must('main header [data-region="actions"] button[aria-label^="Actions for this"]'), {
      name: "Actions for this event",
      items: "Reschedule,Cancel event,Print,Delete",
    });
  });

  test("a new event's title suggestions: a list of buttons, none current or pressed", async () => {
    await open(`/app/groups/${TEST_GROUP.id}/entries/new?kind=event`, layout);
    const list = page.getByRole("list", { name: "Suggested titles" });
    await expect.element(list).toBeVisible();
    expect(list.element().tagName).toBe("UL");
    const chips = [...list.element().querySelectorAll("li > button")];
    expect(chips.map((c) => c.textContent?.trim())).toEqual(
      expect.arrayContaining(["Physical therapy", "Eye exam"]),
    );
    expect(chips.filter((c) => c.hasAttribute("aria-current") || c.hasAttribute("aria-pressed"))).toEqual([]);
  });

  test("providers: the Filter menu's Type section with All checked; the add sheet; the edit sheet's Delete confirm (Escape closes only it)", async () => {
    await open(PROVIDERS, layout);
    await userEvent.click(page.getByRole("button", { name: /^Filter(, \d+ on)?$/ }));
    await expect.element(page.getByRole("menuitemradio", { name: "All", exact: true })).toBeChecked();
    await userEvent.keyboard("{Escape}");
    await overlay(() => must("main a[data-add-provider]"), { name: "Add a provider", sheet: true });
  });

  test("the provider edit sheet's Delete confirm: named, Escape closes only it, focus back on Delete provider", async () => {
    await open(`${PROVIDERS}/${CLINIC.id}/edit`, layout);
    const del = () =>
      [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find(
        (b) => b.textContent?.trim() === "Delete provider",
      )!;
    await expect.poll(() => !!del()).toBe(true);
    expect(nameOf(q('[role="dialog"]'))).toMatch(/^Edit /);
    await userEvent.click(del());
    await expect.poll(() => q("dialog[open]")).not.toBeNull();
    await expect.poll(() => nameOf(q("dialog[open]"))).toMatch(/^Delete .+\?$/);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => q("dialog[open]")).toBeNull();
    expect(q('[role="dialog"]')).not.toBeNull();
    await expect.poll(active).toBe(del());
  });

  // Hover is the primitive's (primitives.browser.test.tsx's Tooltip test, the
  // same Tooltip around a link): on the timeline a test's hover lands on the
  // link (it matches :hover) but React Aria doesn't always see it begin, so it
  // can't be asserted reliably here.
  test("the tooltip on a row's initials: keyboard focus shows it as the link's description (never its name), on the surface, inside the window; Escape hides it, focus stays", async () => {
    await open(TIMELINE, layout);
    await expect.poll(rows).toBe(4);
    const initials = () =>
      page
        .getByRole("link", { name: `Show only ${TEST_USER.name}'s entries` })
        .first()
        .element() as HTMLElement;
    const tooltip = () => q('[role="tooltip"]');
    // Tab from the row's kind icon reaches the initials.
    initials()
      .closest("li")!
      .querySelector<HTMLElement>('a[aria-label^="Show only"]:not([data-author])')!
      .focus();
    for (let i = 0; i < 3 && active() !== initials(); i++) await userEvent.keyboard("{Tab}");
    expect(active()).toBe(initials());
    await expect.poll(tooltip).not.toBeNull();
    const t = tooltip()!;
    expect(initials().getAttribute("aria-label")).toBe(`Show only ${TEST_USER.name}'s entries`);
    expect((initials().getAttribute("aria-describedby") ?? "").split(" ")).toContain(t.id);
    expect(initials().hasAttribute("title")).toBe(false);
    expect(t.textContent?.trim().endsWith(TEST_USER.name)).toBe(true);
    const r = t.getBoundingClientRect();
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(innerWidth);
    expect(getComputedStyle(surface(t)!).backgroundColor).toBe(base100());
    await userEvent.keyboard("{Escape}");
    await expect.poll(tooltip).toBeNull();
    expect(active()).toBe(initials());
  });
});

// ---- The date field on narrow phones (B-71) ---------------------------------

/** The last "Pick a date" field: fits its container, its dialog and the window; nothing clipped; a 44 px tap; its calendar inside the window. */
async function dateFieldFits() {
  // Measured once the sheet or popover has finished opening.
  await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  const vw = document.documentElement.clientWidth;
  const button = PICK();
  const group = button.closest('[role="group"]')!;
  const box = (el: Element) => el.getBoundingClientRect();
  const [g, f, d] = [box(group), box(group.parentElement!), box(button.closest('[role="dialog"]')!)];
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(vw);
  expect(g.left).toBeGreaterThanOrEqual(f.left - 0.5);
  expect(g.right).toBeLessThanOrEqual(f.right + 0.5);
  expect(g.left).toBeGreaterThanOrEqual(d.left - 0.5);
  expect(g.right).toBeLessThanOrEqual(d.right + 0.5);
  expect(g.left).toBeGreaterThanOrEqual(0);
  expect(g.right).toBeLessThanOrEqual(vw);
  expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
  // A 44 px tap around it (polled: the sheet's choices can still be moving it as they load).
  const taps = () => {
    const r = button.getBoundingClientRect();
    const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
    return [
      [-21, 0],
      [0, -21],
      [0, 21],
    ].map(([dx, dy]) => button.contains(document.elementFromPoint(cx + dx!, cy + dy!)));
  };
  await expect.poll(taps).toEqual([true, true, true]);

  await userEvent.click(button);
  await expect.poll(() => q('[role="grid"]')).not.toBeNull();
  const pop = must('[role="grid"]').closest('[role="dialog"]')!.parentElement!.getBoundingClientRect();
  expect(pop.left).toBeGreaterThanOrEqual(0);
  expect(pop.right).toBeLessThanOrEqual(vw);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(vw);
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => q('[role="grid"]')).toBeNull();
}

describe.each([360, 390, 420, 1280])("the date field at %i", (width) => {
  test.each(["symptom", "dose"])("in the %s sheet", async (kind) => {
    await renderWithDevice({
      route: ROUTES,
      url: `${TIMELINE}/new/${kind}`,
      fixtures: FIXTURES,
      width,
      height: 800,
    });
    await expect.poll(() => q('[role="dialog"] [aria-label="Pick a date"]')).not.toBeNull();
    await dateFieldFits();
  });

  test("in the entry page's time chip", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: `/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`,
      fixtures: FIXTURES,
      width,
      height: 800,
    });
    await expect.poll(() => q('main header button[aria-label="Change when it happened"]')).not.toBeNull();
    await userEvent.click(TIME_CHIP());
    await expect.poll(() => q('[role="dialog"] [aria-label="Pick a date"]')).not.toBeNull();
    await dateFieldFits();
  });
});

describe.each([420, 1280])("the page header at %i", (width) => {
  test.each([{ url: PROVIDERS, title: "Providers", action: "Add provider" }])(
    "$title: the title is the h1, its action beside it on the right",
    async ({ url, title, action }) => {
      await renderWithDevice({ route: ROUTES, url, fixtures: FIXTURES, width });
      const header = await found(() => q("main header"));
      const h1 = header.querySelector("h1")!;
      expect(h1.textContent).toBe(title);
      const control = [...header.querySelectorAll<HTMLElement>("a, button")].find(
        (el) => (el.getAttribute("aria-label") ?? el.textContent?.trim()) === action,
      )!;
      expect(control).toBeDefined();
      const [a, b] = [h1.getBoundingClientRect(), control.getBoundingClientRect()];
      // On the same row, the action at the right.
      expect(b.left).toBeGreaterThan(a.right);
      expect(b.top).toBeLessThan(a.bottom);
      expect(Math.round(header.getBoundingClientRect().right - b.right)).toBeLessThanOrEqual(1);
    },
  );

  test("Timeline: the title is the h1, with no actions (View options is in the filter row)", async () => {
    await renderWithDevice({ route: ROUTES, url: TIMELINE, fixtures: FIXTURES, width });
    const header = await found(() => q("main header"));
    expect(header.querySelector("h1")!.textContent).toBe("Timeline");
    expect(header.querySelectorAll("a, button")).toHaveLength(0);
    await found(() => q('[data-timeline-filters] button[aria-label="View options"]'));
  });
});
