import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, TEST_USER } from "../../../../../test/fixtures";
import {
  button,
  frames,
  openTimeline,
  rows,
  setView,
  tapAt,
  TIMELINE_URL,
  TODAY_COUNT,
  world,
} from "./timelineWorld";
import { stopsMoving, waitUntil } from "../../../../../test/found";

// Infinite scroll on the test device (from phase2.mjs: infiniteScroll and the
// first screen's "scrolling adds a page"): older pages load with no button,
// each announced once, down to the end; nothing on screen moves while one
// loads; a filter starts again with one page; entries arriving above keep
// your place. Every page comes from the device, which is offline here, so
// this is also phase2's "offline: every page loads from the device". The
// paging rules themselves are paging.test.ts's.

const END = "That's the beginning of the timeline";
const LOADING = "Loading older…";
const status = () => document.querySelector("[data-older-entries] [role=status]");
const sentinel = () => !!document.querySelector("[data-older-sentinel]");
/** Scroll to the end, a page at a time, until at least `count` rows are loaded. */
const loadRows = async (count: number) => {
  while (rows().length < count) {
    const loaded = rows().length;
    await waitUntil(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return rows().length > loaded;
    }, `the page after ${loaded} rows`);
  }
};

/** Watch the status line and, while each page loads, how far the last entry moves and whether a "with …" line goes. */
const record = () => {
  const log: string[] = [];
  const moves: { max: number; withs: number; minWith: number }[] = [];
  let last = status()?.textContent ?? "";
  let sampling: {
    el: Element;
    rowsAt: Element[];
    top: number;
    max: number;
    withs: number;
    minWith: number;
  } | null = null;
  const withs = (s: NonNullable<typeof sampling>) =>
    s.rowsAt.filter((li) => li.isConnected && li.querySelector("[data-with]")).length;
  const sample = () => {
    if (!sampling) return;
    sampling.max = Math.max(sampling.max, Math.abs(sampling.el.getBoundingClientRect().top - sampling.top));
    sampling.minWith = Math.min(sampling.minWith, withs(sampling));
    requestAnimationFrame(sample);
  };
  const observer = new MutationObserver(() => {
    const t = status()?.textContent ?? "";
    if (t === last) return;
    last = t;
    log.push(t);
    if (t === LOADING) {
      const rowsAt = rows();
      const el = rowsAt.at(-1)!;
      sampling = { el, rowsAt, top: el.getBoundingClientRect().top, max: 0, withs: 0, minWith: 0 };
      sampling.withs = sampling.minWith = withs(sampling);
      requestAnimationFrame(sample);
    } else if (sampling) {
      moves.push({ max: sampling.max, withs: sampling.withs, minWith: sampling.minWith });
      sampling = null;
    }
  });
  observer.observe(document.querySelector("main")!, { childList: true, subtree: true, characterData: true });
  return { log, moves, stop: () => observer.disconnect() };
};

/** Scroll to the end (never while a page loads) until the end message. */
const toTheBeginning = async () => {
  while (status()?.textContent !== END) {
    const loaded = rows().length;
    await waitUntil(() => {
      const t = status()?.textContent ?? "";
      if (t !== LOADING) window.scrollTo(0, document.documentElement.scrollHeight);
      return t === END || rows().length > loaded;
    }, `the page after ${loaded} rows`);
  }
  window.scrollTo(0, document.documentElement.scrollHeight);
  await frames();
};

describe("infinite scroll", () => {
  test.each(["Condensed", "Full"] as const)(
    "%s: a fresh load shows one page; scrolling loads every page with no button, each announced once, the end once, nothing moving",
    async (to) => {
      const older = 90;
      const total = TODAY_COUNT + older;
      await openTimeline({ fixtures: world(older) });
      await waitUntil(() => rows().length > 0);
      if (to === "Full") await setView("Full");
      expect(rows().length).toBe(30);
      const watched = record();
      await toTheBeginning();
      watched.stop();
      const r = status()!.getBoundingClientRect();
      expect({ rows: rows().length, text: status()?.textContent }).toEqual({ rows: total, text: END });
      expect(r.height > 0 && r.bottom <= window.innerHeight).toBe(true);
      expect(sentinel()).toBe(false);
      expect(button("Show older entries")).toBeUndefined();
      const pages = Math.ceil(total / 30) - 1;
      expect(watched.log.filter((t) => t === LOADING).length).toBe(pages);
      expect(watched.log.filter((t) => t === END).length).toBe(1);
      expect(watched.moves.length).toBe(pages);
      expect(watched.moves.every((m) => m.max <= 1 && m.minWith === m.withs)).toBe(true);
    },
  );

  test("a vital's icon tapped three pages down shows the newest vital first, with one page, from the top", async () => {
    const device = await openTimeline({ fixtures: world(120) });
    await waitUntil(() => rows().length > 0);
    await loadRows(90);
    expect(rows().length).toBeGreaterThanOrEqual(90);
    window.scrollTo(0, document.documentElement.scrollHeight - 2 * innerHeight);
    await frames();
    const vital = rows().find((li) => {
      const r = li.getBoundingClientRect();
      return (
        r.top > 100 &&
        r.bottom < innerHeight - 100 &&
        li.querySelector(".sr-only")?.textContent === "Vitals: "
      );
    })!;
    await tapAt(() => vital.querySelector('a[aria-label^="Show only"]:not([data-author])'));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital`);
    await waitUntil(
      () =>
        rows().length === 30 &&
        rows().every((li) => li.querySelector(".sr-only")?.textContent === "Vitals: "),
    );
    await frames();
    expect(
      Math.round(
        document.querySelector('section[aria-labelledby="timeline-heading"]')?.getBoundingClientRect().top ??
          Number.NaN,
      ),
    ).toBeGreaterThanOrEqual(-1);
    // The newest vital is today's blood pressure (world()).
    expect(rows()[0]?.textContent).toMatch(/BP \d+\/\d+/);
    expect(sentinel()).toBe(true);
  });

  test("fewer than a page of matches shows the end at once; an empty timeline its empty state, not the end", async () => {
    const device = await openTimeline({ query: "?kind=event" });
    await waitUntil(() => rows().length > 0);
    expect(rows().length).toBe(2);
    expect(status()?.textContent).toBe(END);
    expect(sentinel()).toBe(false);
    await device.screen.unmount();

    await openTimeline({ query: `?kind=symptom&author=${TEST_USER.id}` });
    await waitUntil(() => !!document.querySelector("[data-empty]"));
    expect(status()?.textContent).toBe("");
  });

  test("three pages down, an entry arriving at the top (another device's) and its deletion leave the screen where it is, and the pages loaded", async () => {
    const device = await openTimeline({ fixtures: world(130) });
    await waitUntil(() => rows().length > 0);
    await loadRows(120);
    const anchor = rows()[89]!;
    window.scrollTo(0, anchor.getBoundingClientRect().top + scrollY - 300);
    // The sentinel was in range when the fourth page landed, so a fifth may have started before the
    // scroll away (B-790): let it land before counting the pages, or it lands between the counts.
    await frames();
    await waitUntil(() => status()?.textContent !== LOADING, "any page still loading");
    await device.settle();
    await stopsMoving(() => anchor);
    const place = () => ({
      rows: rows().length,
      top: Math.round(anchor.getBoundingClientRect().top),
      connected: anchor.isConnected,
    });
    const before = place();

    const arriving = fx.symptom({ name: "Arrived from another device", occurredAt: at() });
    await device.sync(arriving);
    await waitUntil(
      () => !!document.querySelector("main")?.textContent?.includes("Arrived from another device"),
    );
    await device.settle();
    await stopsMoving(() => anchor);
    const after = place();
    expect(after.connected).toBe(true);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
    expect(after.rows).toBeGreaterThanOrEqual(before.rows);

    await device.sync({ ...arriving, row: { ...arriving.row, deleted_at: at() } });
    await waitUntil(
      () => !document.querySelector("main")?.textContent?.includes("Arrived from another device"),
    );
    await device.settle();
    await stopsMoving(() => anchor);
    const gone = place();
    expect(gone.connected).toBe(true);
    expect(Math.abs(gone.top - before.top)).toBeLessThanOrEqual(1);
    expect(gone.rows).toBe(before.rows);
  });
});

// Off-screen rows cost little (B-139, `offscreenRows.ts`): days before the
// newest page skip drawing their rows while off screen, every row remembers
// its size, and nothing about paging or coming back to the list changes.
describe("off-screen rows", () => {
  const threePages = async () => {
    const device = await openTimeline({ fixtures: world(130) });
    await waitUntil(() => rows().length > 0);
    await loadRows(90);
    await waitUntil(() => status()?.textContent !== LOADING, "the third page");
    await device.settle();
    expect(rows().length).toBeGreaterThanOrEqual(90);
    return device;
  };
  const cv = (li: Element) => getComputedStyle(li).contentVisibility;

  test("rows carry content-visibility: auto, except the days holding the newest page; every row remembers its size; all stay in the DOM and the accessibility tree", async () => {
    const device = await threePages();
    const all = rows();
    const lists = [
      ...document.querySelectorAll<HTMLOListElement>('section[aria-labelledby="timeline-heading"] ol'),
    ];
    const skipping = lists.filter((ol) => [...ol.children].every((li) => cv(li) === "auto"));
    const drawn = lists.filter((ol) => [...ol.children].every((li) => cv(li) === "visible"));
    // Every day is one or the other; the settled ones come first, the newest page's days last.
    expect(skipping.length + drawn.length).toBe(lists.length);
    expect(skipping.length).toBeGreaterThan(0);
    expect(lists.slice(0, skipping.length)).toEqual(skipping);
    const drawnRows = drawn.reduce((n, ol) => n + ol.children.length, 0);
    expect(drawnRows).toBeGreaterThanOrEqual(30);
    expect(all.every((li) => getComputedStyle(li).containIntrinsicSize.startsWith("auto"))).toBe(true);
    // The headers and the sentinel aren't contained.
    for (const el of [
      ...document.querySelectorAll("[data-day-header]"),
      document.querySelector("[data-older-entries]")!,
    ])
      expect(getComputedStyle(el).contentVisibility).toBe("visible");
    // A skipped row, far above the screen, is still there and still named.
    window.scrollTo(0, document.documentElement.scrollHeight);
    await frames();
    const far = skipping[0]!.querySelector<HTMLLIElement>(":scope > li:not([data-marker])")!;
    expect(far.getBoundingClientRect().bottom).toBeLessThan(-innerHeight);
    const link = far.querySelector<HTMLAnchorElement>('a[aria-label^="Show only"]:not([data-author])')!;
    await expect
      .element(device.screen.getByRole("link", { name: link.getAttribute("aria-label") ?? "" }).first())
      .toBeInTheDocument();
    expect(rows().length).toBe(all.length);
  });

  test("three pages down, a row's sheet and back: the same scroll position and pages, then the next page still loads", async () => {
    const device = await threePages();
    // A row of the third page, on screen.
    window.scrollTo(0, rows()[75]!.getBoundingClientRect().top + scrollY - 300);
    await frames();
    const row = rows().find((li) => {
      const r = li.getBoundingClientRect();
      return r.top > 80 && r.bottom < innerHeight - 80 && !!li.querySelector('a[aria-label^="Edit "]');
    })!;
    expect(row).toBeTruthy();
    const where = () => ({
      y: Math.round(scrollY),
      rows: rows().length,
      top: Math.round(row.getBoundingClientRect().top),
    });
    const before = where();
    await tapAt(() => row.querySelector("p"));
    await waitUntil(() => !!document.querySelector("[role=dialog] form"), "the edit sheet");
    expect(device.location()).toMatch(/\/timeline\/[0-9a-f-]{36}\/edit$/);
    const cancel = [...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find(
      (b) => b.textContent?.trim() === "Cancel",
    )!;
    await userEvent.click(cancel);
    await waitUntil(() => !document.querySelector("[role=dialog]"), "the sheet to close");
    await expect.poll(device.location).toBe(TIMELINE_URL);
    await frames();
    const after = where();
    expect(row.isConnected).toBe(true);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(2);
    expect(after.rows).toBe(before.rows);

    // The next page loads as the end comes near.
    window.scrollTo(0, document.documentElement.scrollHeight);
    await waitUntil(() => rows().length > before.rows, "the fourth page");
  });
});
