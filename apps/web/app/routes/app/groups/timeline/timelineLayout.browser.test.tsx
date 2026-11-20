import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx } from "../../../../../test/fixtures";
import {
  authorOf,
  button,
  frames,
  openOf,
  openTimeline,
  rowOf,
  rows,
  SAM,
  setView,
  tapAt,
  TIMELINE_URL,
  view,
  waitUntil,
  world,
} from "./timelineWorld";

// The timeline's layout and taps on the test device (from phase2.mjs: the
// first screen, row taps by role, More and Less, the ⋯ menu, day headings,
// the wide layout and the author tooltip). Measured in real Chromium with
// the app's stylesheet, at the widths phase2 used. What a row opens per kind
// and role is entryOpen.test.ts's; the ⋯ items entryActionItems.test.ts's.

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
  test("the first entry is above the fold, rows are dense, no sideways scroll, and one page of 30", async () => {
    await openTimeline();
    await ready();
    expect(rows()[0]!.getBoundingClientRect().top).toBeLessThan(900);
    const heights = rows()
      .map((li) => li.getBoundingClientRect().height)
      .sort((a, b) => a - b);
    expect(heights[Math.floor(heights.length / 2)]).toBeLessThanOrEqual(72);
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
    // The next visit reads the device's settings copy (lib/me.ts): no server needed.
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
  const headingStyle = () => {
    const s = getComputedStyle(document.querySelector("section h3")!);
    return {
      size: s.fontSize,
      weight: s.fontWeight,
      transform: s.textTransform,
      full: s.color === getComputedStyle(document.body).color,
      position: s.position,
    };
  };

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

  test("16 px, semibold, normal case, full contrast and sticky in both themes; the colour follows the theme; 18 px at 1280", async () => {
    const colors: string[] = [];
    for (const theme of ["light", "dark"] as const) {
      const device = await openTimeline({ theme });
      await ready();
      expect(headingStyle()).toEqual({
        size: "16px",
        weight: "600",
        transform: "none",
        full: true,
        position: "sticky",
      });
      colors.push(getComputedStyle(document.querySelector("section h3")!).color);
      await device.screen.unmount();
    }
    expect(colors[0]).not.toBe(colors[1]);
    await openTimeline({ width: 1280 });
    await ready();
    expect(headingStyle().size).toBe("18px");
  });

  test.each(["Rows", "Cards"] as const)(
    "%s: a day heading stays stuck to the top while scrolling, with no row control above it",
    async (to) => {
      await openTimeline({ fixtures: world(60) });
      await ready();
      if (to === "Cards") await setView("Cards");
      const probe = () => {
        const hs = [...document.querySelectorAll("section h3")].map((h) => ({
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
        return { held: h.textContent, arriving, through, top: r.top };
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
  const measure = () => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: Math.round(r.top), width: r.width, height: r.height };
    };
    const days = [...document.querySelectorAll("section > ol")].map((ol) => ({
      list: box(ol),
      heading: box(ol.parentElement!.querySelector("h3")!),
      cards: [...ol.children].map(box),
    }));
    const lis = rows();
    const texts = lis
      .flatMap((li) => [...li.querySelectorAll("p.break-words")])
      .map((el) => {
        const s = getComputedStyle(el);
        return {
          width: el.getBoundingClientRect().width,
          cap: parseFloat(s.maxWidth),
          em: parseFloat(s.maxWidth) / parseFloat(s.fontSize),
        };
      });
    const ends = lis.map((li) => {
      const r = li.getBoundingClientRect();
      const time = li.querySelector("time")?.getBoundingClientRect();
      const last = (
        li.querySelector('button[aria-label^="Actions"]') ?? li.lastElementChild!
      ).getBoundingClientRect();
      return { start: time ? time.left - r.left : null, end: r.right - last.right };
    });
    const column = document.querySelector('[aria-labelledby="timeline-heading"]')!;
    return {
      main: box(document.querySelector("main")!),
      inner: document.documentElement.clientWidth,
      cap: parseFloat(getComputedStyle(column).maxWidth),
      days,
      texts,
      ends,
    };
  };
  type M = ReturnType<typeof measure>;
  const spans = (m: M) =>
    Math.abs(m.main.left) < 1 &&
    Math.abs(m.main.width - m.inner) < 1 &&
    Math.abs(m.cap - 1024) < 1 &&
    m.days.every(
      (d) =>
        Math.abs(d.list.left - (m.inner - d.list.width) / 2) < 1 &&
        Math.abs(d.list.width - Math.min(m.inner - 32, m.cap)) < 1,
    );
  const oneColumn = (m: M) =>
    m.days.every((d) =>
      d.cards.every(
        (c, i) =>
          Math.abs(c.width - d.list.width) < 1 &&
          Math.abs(c.left - d.list.left) < 1 &&
          (i === 0 || c.top >= d.cards[i - 1]!.top + d.cards[i - 1]!.height - 1),
      ),
    );
  const capped = (m: M) => m.texts.every((t) => t.width <= t.cap + 0.5 && t.em > 28 && t.em < 50);

  test("1280, rows: the page spans the window, the entries stop at 1024 px, text at about 75ch, time and ⋯ at the ends", async () => {
    await openTimeline({ width: 1280 });
    await ready();
    const m = measure();
    expect(spans(m)).toBe(true);
    const widest = Math.max(...m.texts.map((t) => t.width));
    const cap = Math.max(...m.texts.map((t) => t.cap));
    expect(capped(m)).toBe(true);
    expect(widest).toBeGreaterThanOrEqual(cap - 1);
    expect(widest).toBeLessThan(m.days[0]!.list.width - 200);
    expect(m.ends.every((e) => e.start !== null && e.start < 70 && e.end >= 0 && e.end <= 16)).toBe(true);
    expect(noHorizontalScroll()).toBe(true);
    // More and Less still work at this width.
    await waitUntil(() => !!button("More"), 4000, "More");
    await userEvent.click(button("More")!);
    await waitUntil(() => !!button("Less"));
    await userEvent.click(button("Less")!);
    await waitUntil(() => !button("Less"));
  });

  test("cards: one to a row in the 1024 px column at 1024, 1280 and 1536, text capped; at 420 the same boxes as before", async () => {
    await openTimeline({ width: 1280 });
    await ready();
    await setView("Cards");
    for (const w of [1280, 1536, 1024]) {
      await width(w);
      const m = measure();
      expect({
        w,
        spans: spans(m),
        one: oneColumn(m),
        capped: capped(m),
        scroll: noHorizontalScroll(),
      }).toEqual({
        w,
        spans: true,
        one: true,
        capped: true,
        scroll: true,
      });
      expect(m.days.some((d) => d.cards.length > 1)).toBe(true);
    }
    await width(420);
    const phone = measure();
    expect(
      phone.days.every((d) =>
        d.cards.every(
          (c, i) =>
            Math.abs(c.left - 16) < 0.5 &&
            Math.abs(c.width - 388) < 0.5 &&
            (i === 0 || Math.abs(c.top - (d.cards[i - 1]!.top + d.cards[i - 1]!.height + 8)) <= 1),
        ),
      ),
    ).toBe(true);
    expect(noHorizontalScroll()).toBe(true);
    await setView("Rows");
    const phoneRows = measure();
    expect(
      phoneRows.days.every((d) =>
        d.cards.every(
          (c, i) =>
            Math.abs(c.left - 17) < 0.5 &&
            Math.abs(c.width - 386) < 0.5 &&
            (i === 0 || Math.abs(c.top - (d.cards[i - 1]!.top + d.cards[i - 1]!.height)) <= 1),
        ),
      ),
    ).toBe(true);
  });

  test.each(["Rows", "Cards"] as const)("1280, %s: the day heading spans the list and sticks", async (to) => {
    await openTimeline({ width: 1280, fixtures: world(60) });
    await ready();
    if (to === "Cards") await setView("Cards");
    const m = measure();
    expect(m.days.every((d) => d.heading.left <= d.list.left && d.heading.right >= d.list.right)).toBe(true);
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
    const h = day.querySelector("h3")!.getBoundingClientRect();
    expect(Math.abs(h.top)).toBeLessThan(1);
    expect(h.top - day.getBoundingClientRect().top).toBeGreaterThan(20);
  });

  test("1280: the edit sheet and the delete confirm are centred modals, not stretched", async () => {
    await openTimeline({ width: 1280 });
    await ready();
    const centred = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const page = document.documentElement.clientWidth;
      return {
        centred: Math.abs(r.left + r.width / 2 - page / 2) <= 10,
        inside: r.left >= 0 && r.right <= page && r.top >= 0 && r.bottom <= window.innerHeight,
        narrow: r.width < 800,
      };
    };
    const ok = { centred: true, inside: true, narrow: true };
    await tapAt(rowOf("Symptom")!.querySelector("p")!);
    await waitUntil(() => !!dialog()?.textContent?.includes("Edit symptom"), 4000, "the sheet");
    await new Promise((r) => setTimeout(r, 400));
    expect(centred(dialog())).toEqual(ok);
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !dialog());

    await userEvent.click(actionsOf(rowOf("Note")!));
    await waitUntil(() => menuItems().length > 0);
    await userEvent.click(
      [...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent?.trim() === "Delete")!,
    );
    await waitUntil(() => !!document.querySelector("dialog[open]"));
    await new Promise((r) => setTimeout(r, 400));
    const open = document.querySelector("dialog[open]")!;
    expect(centred(open.firstElementChild ?? open)).toEqual(ok);
  });

  test("1280: the Live now banner is capped like the strips (1152 px, centred) in one line, Join at its end", async () => {
    // Sam is writing in a note: its document's editors say so, as a sync from Sam's device would.
    const note = fx.note({ createdBy: SAM.id, title: "Morning" });
    await openTimeline({
      width: 1280,
      fixtures: [
        world(),
        note,
        fx.document({ ownerId: note.id, text: "Ate well", editedBy: SAM.id, editedAt: at() }),
      ],
    });
    await waitUntil(() => !!document.querySelector("[data-live-banner]"), 4000, "the banner");
    const banner = document.querySelector("[data-live-banner]")!;
    const r = banner.getBoundingClientRect();
    const j = banner.querySelector("a")!.getBoundingClientRect();
    const page = document.documentElement.clientWidth;
    expect(Math.abs(r.width - 1152)).toBeLessThan(1);
    expect(Math.abs(r.left + r.right - page)).toBeLessThan(2);
    expect(r.height).toBeLessThan(60);
    expect(r.right - j.right).toBeGreaterThan(0);
    expect(r.right - j.right).toBeLessThan(20);
  });
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
    await userEvent.click(document.querySelector("section h3")!);
    await userEvent.hover(link);
    await waitUntil(() => !!TIP(), 3000, "the tooltip");
    const t = TIP()!;
    const r = t.getBoundingClientRect();
    const h = link.closest("section")!.querySelector("h3")!.getBoundingClientRect();
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
