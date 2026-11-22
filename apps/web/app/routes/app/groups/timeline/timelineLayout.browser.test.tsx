import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, stopsMoving } from "../../../../../test/found";
import {
  authorOf,
  button,
  frames,
  openOf,
  openTimeline,
  rowOf,
  rows,
  setView,
  tapAt,
  TIMELINE_URL,
  view,
  waitUntil,
  world,
} from "./timelineWorld";

// The timeline's layout and taps on the test device (from phase2.mjs: the
// first screen, row taps by role, More and Less, the ⋯ menu, day headings,
// the wide layout and the author tooltip), in real Chromium with the app's
// stylesheet, at the widths phase2 used: behaviour, not pixels or classes.
// What a row opens per kind and role is entryOpen.test.ts's; the ⋯ items
// entryActionItems.test.ts's; sheets' and confirms' size by width the
// probe's (ui/inScreens.browser.test.tsx); the Live now banner
// timelineStrips.browser.test.tsx's.

const width = async (w: number) => {
  await page.viewport(w, 900);
  await frames();
};
const noHorizontalScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;
const ready = () => waitUntil(() => rows().length > 0, 4000, "rows");
const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const actionsOf = (li: Element) => li.querySelector<HTMLButtonElement>('button[aria-label^="Actions"]')!;

describe("the first screen", () => {
  test("the first entry is above the fold, no sideways scroll, and one page of 30", async () => {
    await openTimeline();
    await ready();
    expect(rows()[0]!.getBoundingClientRect().top).toBeLessThan(900);
    expect(noHorizontalScroll()).toBe(true);
    expect(rows().length).toBe(30);
    expect(/live notes/i.test(document.body.innerText)).toBe(false);
  });

  test("the view toggle: cards, and the choice comes back on the next visit", async () => {
    const device = await openTimeline();
    await ready();
    expect(view()).toBe("rows");
    await setView("Cards");
    await device.screen.unmount();
    // The next visit reads the device's settings copy (lib/app-shell/me.ts): no server needed.
    await openTimeline();
    await waitUntil(() => view() === "cards", 4000, "cards on the next visit");
  });
});

describe("row taps", () => {
  test("writer, rows: a note and an event open their page; a symptom its edit sheet; Escape closes it", async () => {
    const device = await openTimeline();
    await ready();
    for (const kind of ["Note", "Event"]) {
      await tapAt(rowOf(kind)!.querySelector("p")!);
      await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
      await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
      await expect.poll(() => device.location()).toBe(TIMELINE_URL);
      await ready();
    }
    await tapAt(rowOf("Symptom")!.querySelector("p")!);
    await waitUntil(() => !!dialog()?.textContent?.includes("Edit symptom"), 4000, "the edit sheet");
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !dialog(), 4000, "the sheet to close");
    expect(device.location()).toBe(TIMELINE_URL);
  });

  test("keyboard: a note row's open link is named; Enter opens the entry", async () => {
    const device = await openTimeline();
    await ready();
    const link = rowOf("Note")!.querySelector<HTMLAnchorElement>("a")!;
    expect(link.getAttribute("aria-label")).toMatch(/^Open .+ at /);
    link.focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
  });

  test("writer, cards: a note opens its page; a vital's reading opens its edit sheet", async () => {
    const device = await openTimeline();
    await ready();
    await setView("Cards");
    await tapAt(rowOf("Note")!.querySelector("p")!);
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
    await ready();
    await tapAt(rowOf("Vitals")!.querySelector("li")!);
    await waitUntil(() => !!dialog()?.textContent?.includes("Edit vitals"), 4000, "the vitals sheet");
  });

  test("viewer: a note opens; a symptom does nothing and has no ⋯; a note's ⋯ is Print", async () => {
    const device = await openTimeline({ role: "viewer" });
    await ready();
    await tapAt(rowOf("Note")!.querySelector("p")!);
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
    await ready();
    expect(openOf(rowOf("Symptom")!)).toBeNull();
    await tapAt(rowOf("Symptom")!.querySelector("p")!);
    await new Promise((r) => setTimeout(r, 300));
    expect(dialog()).toBeNull();
    expect(device.location()).toBe(TIMELINE_URL);
    expect(rowOf("Symptom")!.querySelector('button[aria-label^="Actions"]')).toBeNull();
    // After Go back the quick-entry chips land late and push the rows down: click ⋯ once it stops moving.
    await stopsMoving(() => actionsOf(rowOf("Note")!));
    await userEvent.click(actionsOf(rowOf("Note")!));
    await waitUntil(() => menuItems().length > 0, 4000, "the menu");
    expect(menuItems()).toEqual(["Print"]);
    await userEvent.keyboard("{Escape}");
  });

  test("More and Less toggle long text without opening it; ⋯ on a note is Print and Delete", async () => {
    const device = await openTimeline();
    await ready();
    await waitUntil(() => !!button("More"), 4000, "More");
    await userEvent.click(button("More")!);
    await waitUntil(() => !!button("Less"));
    expect(device.location()).toBe(TIMELINE_URL);
    await userEvent.click(button("Less")!);
    await waitUntil(() => !button("Less"));
    expect(device.location()).toBe(TIMELINE_URL);

    await userEvent.click(actionsOf(rowOf("Note")!));
    await waitUntil(() => menuItems().length > 0, 4000, "the menu");
    expect(menuItems()).toEqual(["Print", "Delete"]);
    expect(device.location()).toBe(TIMELINE_URL);
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !document.querySelector("[role=menu]"));
  });
});

describe("day headings", () => {
  test('the newest day reads "Today" (or "Yesterday" before today has entries), in the browser\'s zone', async () => {
    await openTimeline();
    await ready();
    const key = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toLocaleDateString("en-CA");
    };
    const newest = document.querySelector("section h3")!;
    const day = newest.id.replace("day-", "");
    expect(day === key(0) ? newest.textContent : day === key(1) ? newest.textContent : "?").toBe(
      day === key(0) ? "Today" : "Yesterday",
    );
  });

  test.each(["Rows", "Cards"] as const)(
    "%s: a day heading stays stuck to the top while scrolling, with no row control above it",
    async (to) => {
      await openTimeline({ fixtures: world(60) });
      await ready();
      if (to === "Cards") await setView("Cards");
      const probe = () => {
        const hs = [...document.querySelectorAll("section [data-day-header]")].map((h) => ({
          h,
          r: h.getBoundingClientRect(),
          s: h.parentElement!.getBoundingClientRect(),
        }));
        const held = hs.find(({ r, s }) => r.top - s.top > 1 && r.bottom > 0);
        const arriving = hs.some(({ r }) => r.top >= 0 && r.top < 60);
        if (!held) return { held: null, arriving, through: [] as string[], top: NaN };
        const { h, r } = held;
        const top = Math.max(r.top, 0);
        const xs = [r.left + 12, r.left + r.width / 2, r.right - 20, r.right - 4];
        const ys = r.bottom - top < 6 ? [] : [top + 2, (top + r.bottom) / 2, r.bottom - 2];
        const through = xs
          .flatMap((x) => ys.map((y) => document.elementFromPoint(x, y)))
          .filter((el) => el && !h.contains(el))
          .map((el) => `${el!.tagName}.${el!.className}`);
        return { held: h.querySelector("h3")!.textContent, arriving, through, top: r.top };
      };
      const end = document.documentElement.scrollHeight - window.innerHeight;
      const seen = new Set<string>();
      const gaps: number[] = [];
      const above: string[] = [];
      let atTop = 0;
      for (let y = 500; y < Math.min(end, 6000); y += 130) {
        window.scrollTo(0, y);
        await frames();
        const at = probe();
        if (at.held) seen.add(at.held);
        if (at.held && Math.abs(at.top) < 1) atTop += 1;
        if (!at.held && !at.arriving) gaps.push(y);
        above.push(...at.through);
      }
      expect({ gaps, many: atTop > 3, days: seen.size > 1 }).toEqual({ gaps: [], many: true, days: true });
      expect(above).toEqual([]);
    },
  );
});

describe("the wide layout", () => {
  test("rows and cards at 1024, 1280 and 1536, and back at 420: nothing scrolls sideways", async () => {
    await openTimeline({ width: 1280 });
    await ready();
    for (const to of ["Rows", "Cards"] as const) {
      if (to === "Cards") await setView("Cards");
      for (const w of [1024, 1280, 1536, 420]) {
        await width(w);
        expect({ to, w, scroll: noHorizontalScroll() }).toEqual({ to, w, scroll: true });
      }
    }
  });

  test.each(["Rows", "Cards"] as const)("1280, %s: the day heading spans the list and sticks", async (to) => {
    await openTimeline({ width: 1280, fixtures: world(60) });
    await ready();
    if (to === "Cards") await setView("Cards");
    const box = (el: Element) => el.getBoundingClientRect();
    for (const ol of document.querySelectorAll("section > ol")) {
      const [h, list] = [box(ol.parentElement!.querySelector("[data-day-header]")!), box(ol)];
      expect(h.left <= list.left && h.right >= list.right).toBe(true);
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const day = [...document.querySelectorAll("section > ol")]
      .map((ol) => ol.parentElement!)
      .find(
        (s) =>
          s.getBoundingClientRect().height > 120 &&
          s.getBoundingClientRect().top + window.scrollY + 30 <= max,
      )!;
    window.scrollTo(0, day.getBoundingClientRect().top + window.scrollY + 30);
    await frames();
    const h = day.querySelector("[data-day-header]")!.getBoundingClientRect();
    expect(Math.abs(h.top)).toBeLessThan(1);
    expect(h.top - day.getBoundingClientRect().top).toBeGreaterThan(20);
  });
});

describe("the author chip", () => {
  test.each(["caretaker", "viewer"] as const)(
    "%s: in the row's last column, after the ⋯ menu, and still the author filter",
    async (role) => {
      await openTimeline({ role });
      await ready();
      const li = rowOf("Note")!;
      const aside = li.querySelector<HTMLElement>(":scope > [data-entry-aside]")!;
      const menu = aside.querySelector<HTMLElement>('button[aria-label^="Actions"]')!;
      const chip = aside.querySelector<HTMLElement>("a[data-author]")!;
      expect(menu.compareDocumentPosition(chip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      // The column is the row's last thing.
      expect(li.lastElementChild).toBe(aside);
      // Still the filter, with its name.
      expect(chip.getAttribute("aria-label")).toMatch(/^Show only .+'s entries$/);
    },
  );
});

describe("the author tooltip", () => {
  const TIP = () => document.querySelector<HTMLElement>('[role="tooltip"]');
  const firstLink = () =>
    document.querySelector<HTMLAnchorElement>("section > ol > li:not([data-marker]) a[data-author]")!;

  test("hover shows the avatar and full name as the link's description, above the sticky heading; moving away hides it", async () => {
    await openTimeline({ width: 1280 });
    await ready();
    const link = firstLink();
    const name = link.getAttribute("aria-label")!.replace(/^Show only (.+)'s entries$/, "$1");
    expect([link, ...link.querySelectorAll("*")].filter((el) => el.hasAttribute("title")).length).toBe(0);
    expect(link.getAttribute("aria-describedby")).toBeNull();
    // A pointer press first: after keys (an earlier test's), React Aria shows tooltips on hover only once the pointer is used again.
    await userEvent.click(await found(() => document.querySelector("section h3")));
    // The quick-entry suggestions (their chips depend on the time of day) land after the rows and push the list down: hover once the link has stopped moving.
    await stopsMoving(() => link);
    // The initials sit under the ⋯ menu: scroll the day just under its stuck header, so the tooltip opens over it.
    const day = link.closest("section")!;
    window.scrollTo(0, day.getBoundingClientRect().top + scrollY + 25);
    await frames();
    await userEvent.hover(link);
    await waitUntil(() => !!TIP(), 3000, "the tooltip");
    const t = TIP()!;
    const r = t.getBoundingClientRect();
    const h = day.querySelector("[data-day-header]")!.getBoundingClientRect();
    expect(t.textContent?.trim().endsWith(name)).toBe(true);
    expect(t.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect((link.getAttribute("aria-describedby") ?? "").split(" ")).toContain(t.id);
    expect(link.getAttribute("aria-label")).toBe(`Show only ${name}'s entries`);
    expect(r.bottom > h.top && r.top < h.bottom).toBe(true);
    expect(t.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))).toBe(true);
    expect(t.closest("ol")).toBeNull();
    await userEvent.unhover(link);
    await waitUntil(() => !TIP(), 3000, "the tooltip to hide");
  });

  test("keyboard: Tab reaches the initials and shows it; Escape hides it, keeping focus and the URL; Tab away hides it", async () => {
    const device = await openTimeline({ width: 1280 });
    await ready();
    const link = firstLink();
    const fromIcon = async () => {
      link
        .closest("li")!
        .querySelector<HTMLElement>('a[aria-label^="Show only"]:not([data-author])')!
        .focus();
      for (let i = 0; i < 3 && document.activeElement !== link; i++) await userEvent.keyboard("{Tab}");
      expect(document.activeElement).toBe(link);
    };
    await fromIcon();
    await waitUntil(() => !!TIP(), 3000, "the tooltip");
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !TIP(), 3000, "Escape to hide it");
    expect(document.activeElement).toBe(link);
    expect(device.location()).toBe(TIMELINE_URL);
    await fromIcon();
    await waitUntil(() => !!TIP(), 3000, "the tooltip again");
    await userEvent.keyboard("{Tab}");
    await waitUntil(() => !TIP(), 3000, "Tab away to hide it");
  });

  test("a touch tap filters by the author, and shows no tooltip", async () => {
    const device = await openTimeline({ width: 1280 });
    await ready();
    const link = firstLink();
    const id = authorOf(link.closest("li")!).dataset.author;
    let seen = false;
    const watch = new MutationObserver(() => (seen ||= !!TIP()));
    watch.observe(document.body, { childList: true, subtree: true });
    const touch = { pointerType: "touch", bubbles: true, isPrimary: true, pointerId: 7 } as const;
    for (const type of ["pointerover", "pointerenter", "pointerdown", "pointerup"])
      link.dispatchEvent(new PointerEvent(type, touch));
    link.click();
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${id}`);
    await new Promise((r) => setTimeout(r, 800));
    watch.disconnect();
    expect(seen).toBe(false);
  });
});
