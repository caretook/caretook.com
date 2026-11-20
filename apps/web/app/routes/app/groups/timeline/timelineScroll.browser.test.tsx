import { describe, expect, test } from "vitest";
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
  waitUntil,
  world,
} from "./timelineWorld";

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
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    const t = status()?.textContent ?? "";
    if (t === END) break;
    if (t !== LOADING) window.scrollTo(0, document.documentElement.scrollHeight);
    await pause(100);
  }
  window.scrollTo(0, document.documentElement.scrollHeight);
  await frames();
};

describe("infinite scroll", () => {
  test.each(["Rows", "Cards"] as const)(
    "%s: a fresh load shows one page; scrolling loads every page with no button, each announced once, the end once, nothing moving",
    async (to) => {
      const older = 90;
      const total = TODAY_COUNT + older;
      await openTimeline({ fixtures: world(older) });
      await waitUntil(() => rows().length > 0);
      if (to === "Cards") await setView("Cards");
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
    for (let i = 0; i < 40 && rows().length < 90; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await pause(100);
    }
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
    await tapAt(vital.querySelector('a[aria-label^="Show only"]:not([data-author])')!);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital`);
    await waitUntil(
      () =>
        rows().length === 30 &&
        rows().every((li) => li.querySelector(".sr-only")?.textContent === "Vitals: "),
    );
    await frames();
    expect(
      Math.round(
        document.querySelector('section[aria-labelledby="timeline-heading"]')!.getBoundingClientRect().top,
      ),
    ).toBeGreaterThanOrEqual(-1);
    // The newest vital is today's blood pressure (world()).
    expect(rows()[0]!.textContent).toMatch(/BP \d+\/\d+/);
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

  // retry: B-133, the minute turn briefly unmounts the last loaded page. Remove once that's fixed.
  test(
    "three pages down, an entry arriving at the top (another device's) and its deletion leave the screen where it is, and the pages loaded",
    { retry: 2 },
    async () => {
      const device = await openTimeline({ fixtures: world(130) });
      await waitUntil(() => rows().length > 0);
      for (let i = 0; i < 40 && rows().length < 120; i++) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await pause(100);
      }
      const anchor = rows()[89]!;
      window.scrollTo(0, anchor.getBoundingClientRect().top + scrollY - 300);
      await pause(300);
      const place = () => ({
        rows: rows().length,
        top: Math.round(anchor.getBoundingClientRect().top),
        connected: anchor.isConnected,
      });
      const before = place();

      const arriving = fx.symptom({ name: "Arrived from another device", occurredAt: at() });
      await device.sync(arriving);
      await waitUntil(
        () => !!document.querySelector("main")!.textContent?.includes("Arrived from another device"),
      );
      await pause(300);
      const after = place();
      expect(after.connected).toBe(true);
      expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
      expect(after.rows).toBeGreaterThanOrEqual(before.rows);

      await device.sync({ ...arriving, row: { ...arriving.row, deleted_at: at() } });
      await waitUntil(
        () => !document.querySelector("main")!.textContent?.includes("Arrived from another device"),
      );
      await pause(300);
      const gone = place();
      expect(gone.connected).toBe(true);
      expect(Math.abs(gone.top - before.top)).toBeLessThanOrEqual(1);
      expect(gone.rows).toBe(before.rows);
    },
  );
});
