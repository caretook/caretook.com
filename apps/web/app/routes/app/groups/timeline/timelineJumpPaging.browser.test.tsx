import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, TEST_GROUP } from "../../../../../test/fixtures";
import { found, stopsMoving, waitUntil } from "../../../../../test/found";
import { historyQuery, newerEdgeQuery } from "~/lib/timeline/timeline.sync";
import { jumpBound } from "~/lib/timeline/timelineJump";
import { dayKeyIn } from "./timelineDays";
import { button, frames, openTimeline, rows, rowWith, tapAt, TIMELINE_URL, world } from "./timelineWorld";

// Paging newer from a jumped-to day: the newer-edge query on a real local
// database, the scroll held by measurement, reaching today, the oldest day
// under the notice, Back after loading newer, and the reader's own scroll
// winning once the jump has landed.

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const daysAgo = (d: number, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return t;
};
const key = (d: number) => dayKeyIn(daysAgo(d).toISOString(), zone);
const headingIds = () => [...document.querySelectorAll("[data-day-header] h3")].map((h) => h.id);
const notice = () => document.querySelector("[data-jump-notice]");
const probe = () => document.querySelector("h1")?.textContent?.startsWith("Entry page") ?? false;
const NONE = { kind: null, author: null };
/**
 * The button over a landed day sits just above the screen: a DOM click, as a
 * pointer click would first scroll up to it, and scrolling up loads by itself.
 */
const newerButton = () => document.querySelector<HTMLElement>("[data-load-newer]");

/** Three notes a day, on each of the last `count` days before today. */
const history = (count: number) =>
  Array.from({ length: count }, (_, d) =>
    [9, 12, 15].map((hour) =>
      fx.note({ occurredAt: at(daysAgo(d + 1, hour)), text: `Day ${d + 1} at ${hour}` }),
    ),
  ).flat();

/** Scroll up in small steps until `done`, as a finger would. */
const scrollUpUntil = async (done: () => boolean, message: string) =>
  waitUntil(() => {
    if (done()) return true;
    window.scrollBy(0, -12);
    return false;
  }, message);

describe("the newer-edge query", () => {
  test("respects the filters and cutoff, and a tie at the bound is neither lost nor repeated", async () => {
    const before = jumpBound(key(10), zone, new Date())!;
    const edge = new Date(before);
    const below = fx.note({ occurredAt: at(new Date(edge.getTime() - 1)), text: "Below" });
    const tieA = fx.note({ occurredAt: at(edge), text: "Tie A" });
    const tieB = fx.note({ occurredAt: at(edge), text: "Tie B" });
    const symptom = fx.symptom({ occurredAt: at(new Date(edge.getTime() + 1000)), name: "Other kind" });
    const ahead = fx.event({ title: "Ahead", occurredAt: at(new Date(Date.now() + 86_400_000)) });
    const device = await openTimeline({ fixtures: [below, tieA, tieB, symptom, ahead] });
    const cutoff = new Date().toISOString();
    const read = async (filters: Parameters<typeof newerEdgeQuery>[1]) => {
      const q = newerEdgeQuery(TEST_GROUP.id, filters, before, cutoff, 10);
      return device.query<{ occurred_at: string }>(q.sql, q.params);
    };
    const window = historyQuery(TEST_GROUP.id, NONE, 10, cutoff, before);
    const under = await device.query<{ id: string }>(window.sql, window.params);
    expect(under.map((r) => r.id)).toEqual([below.id]);
    // Both ties are above the bound, once each; the future event is past the cutoff.
    expect(await read(NONE)).toHaveLength(3);
    expect(await read({ kind: "symptom", author: null })).toHaveLength(1);
    const rowsAbove = await read(NONE);
    expect(rowsAbove.map((r) => r.occurred_at)).toEqual([...rowsAbove.map((r) => r.occurred_at)].sort());
  });
});

describe("scrolling newer from a day", () => {
  test("scrolling up adds newer days and the row on screen stays within a pixel", async () => {
    await openTimeline({ fixtures: history(40), query: `?day=${key(30)}` });
    const landed = await found(() => document.getElementById(`day-${key(30)}`));
    await stopsMoving(() => landed);
    const list = document.querySelector("section[aria-labelledby='timeline-heading']")!;
    expect(getComputedStyle(list).overflowAnchor).toBe("none");
    expect(headingIds()[0]).toBe(`day-${key(30)}`);

    const row = rowWith("Day 30 at 15")!;
    window.scrollBy(0, 40);
    await frames();
    const top = row.getBoundingClientRect().top;
    window.scrollBy(0, -4);
    await waitUntil(() => headingIds()[0] !== `day-${key(30)}`, "newer days");
    await frames();
    expect(row.isConnected).toBe(true);
    expect(Math.abs(row.getBoundingClientRect().top - (top + 4))).toBeLessThanOrEqual(1);
    // A page, not everything: far from today, and whole days: the top day has all three of its notes.
    const newest = headingIds()[0]!.replace("day-", "");
    const d = Array.from({ length: 40 }, (_, i) => i + 1).find((n) => key(n) === newest)!;
    expect(d).toBeGreaterThan(1);
    for (const hour of [9, 12, 15]) expect(rowWith(`Day ${d} at ${hour}`)).toBeTruthy();
  });

  test("the landing's hold moving the page up as a card above goes loads nothing newer", async () => {
    await openTimeline({ fixtures: history(40), query: `?day=${key(20)}` });
    const landed = await found(() => document.getElementById(`day-${key(20)}`));
    const invite = await found(() => document.querySelector<HTMLElement>("[data-invite-card]"));
    await stopsMoving(() => landed);
    expect(Math.round(landed.getBoundingClientRect().top)).toBeLessThan(40);
    const y = scrollY;
    // The page above the day shrinks (a card going as its query answers): the hold scrolls up after it.
    invite.style.display = "none";
    await expect.poll(() => scrollY).toBeLessThan(y - 100);
    await frames(3);
    expect(headingIds()[0]).toBe(`day-${key(20)}`);
    expect(document.querySelector("[data-newer-entries] [role=status]")?.textContent).toBe("");
    expect(Math.round(landed.getBoundingClientRect().top)).toBeLessThan(40);
  });

  test("after a jump from the picker, scrolling on while newer rows load isn't pulled back to the day", async () => {
    await openTimeline({ fixtures: history(60) });
    await waitUntil(() => rows().length > 0, "the timeline");
    await userEvent.click(
      await found(() => document.querySelector<HTMLElement>('button[aria-label="Go to a day"]')),
    );
    await userEvent.fill(await found(() => document.querySelector<HTMLElement>("input[name=day]")), key(20));
    await userEvent.click(
      await found(() => document.querySelector<HTMLElement>("[data-day-picker] button[type=submit]")),
    );
    const landed = await found(() => document.getElementById(`day-${key(20)}`));
    await waitUntil(() => headingIds()[0] === `day-${key(20)}`, "the day's window");
    await stopsMoving(() => landed);
    expect(Math.round(landed.getBoundingClientRect().top)).toBeLessThan(40);

    const row = rowWith("Day 20 at 15")!;
    window.scrollBy(0, 40);
    await frames();
    const top = row.getBoundingClientRect().top;
    // Up a little starts the load; the finger keeps going while it reads.
    window.scrollBy(0, -4);
    await waitUntil(
      () => document.querySelector("[data-newer-entries] [role=status]")?.textContent,
      "the load",
    );
    window.scrollBy(0, -120);
    await waitUntil(() => headingIds()[0] !== `day-${key(20)}`, "newer days");
    await frames(3);
    expect(row.isConnected).toBe(true);
    expect(Math.abs(row.getBoundingClientRect().top - (top + 124))).toBeLessThanOrEqual(1);
  });

  test("a direct load lands on the day once: scrolling down and loading older stays where it's scrolled", async () => {
    // Today's entries too, so the cards above the list are settled when it lands (world's).
    const device = await openTimeline({ fixtures: [...world(0), ...history(60)], query: `?day=${key(20)}` });
    const landed = await found(() => document.getElementById(`day-${key(20)}`));
    await stopsMoving(() => landed);
    expect(Math.round(landed.getBoundingClientRect().top)).toBeLessThan(40);
    expect(landed.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);

    const scrolls = vi.spyOn(window, "scrollTo");
    const count = rows().length;
    await waitUntil(() => {
      if (rows().length > count) return true;
      window.scrollBy(0, 200);
      return false;
    }, "older rows");
    await device.settle();
    await frames(3);
    const y = Math.round(scrollY);
    window.scrollBy(0, -300);
    await frames(3);
    expect(scrolls).not.toHaveBeenCalled();
    scrolls.mockRestore();
    expect(Math.abs(Math.round(scrollY) - (y - 300))).toBeLessThanOrEqual(2);
    expect(landed.getBoundingClientRect().top).toBeLessThan(0);
  });

  test("reaching today brings the Today heading back", async () => {
    const fixtures = [
      ...history(12),
      fx.note({ occurredAt: at(new Date(Date.now() - 60_000)), text: "Now" }),
    ];
    await openTimeline({ fixtures, query: `?day=${key(10)}` });
    await found(() => document.getElementById(`day-${key(10)}`));
    expect(document.getElementById(`day-${key(0)}`)).toBeNull();
    (await found(newerButton)).click();
    await waitUntil(() => !!document.getElementById(`day-${key(0)}`), "today's heading");
    expect(rowWith("Now")).toBeTruthy();
    expect(document.querySelector("[data-newer-entries]")).toBeNull();
    const list = document.querySelector("section[aria-labelledby='timeline-heading']")!;
    await expect.poll(() => getComputedStyle(list).overflowAnchor).toBe("auto");
  });

  test("a day before the first entry shows the oldest day under its notice", async () => {
    await openTimeline({ fixtures: history(40), query: `?day=${key(400)}` });
    const oldest = await found(() => document.getElementById(`day-${key(40)}`));
    const shown = await found(notice);
    expect(shown.textContent).toMatch(/^No entries on or before /);
    expect(shown.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // On screen, at the notice (the page's end may stop it short of the top), not left at the page's top.
    await expect.poll(() => scrollY).toBeGreaterThan(0);
    await expect.poll(() => shown.getBoundingClientRect().top).toBeLessThan(innerHeight);
    expect(shown.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    expect(document.getElementById(`day-${key(0)}`)).toBeNull();
  });

  test("Back from an entry after loading newer restores the window", async () => {
    const device = await openTimeline({ fixtures: history(40), query: `?day=${key(20)}` });
    const landed = await found(() => document.getElementById(`day-${key(20)}`));
    await stopsMoving(() => landed);
    window.scrollBy(0, 30);
    await frames();
    await scrollUpUntil(() => headingIds()[0] !== `day-${key(20)}`, "newer days");
    await device.settle();
    const first = headingIds()[0];
    const count = rows().length;
    const row = rowWith("Day 20 at 12")!;

    await tapAt(() => row.querySelector('a[aria-label^="Open "]'));
    await waitUntil(probe, "the entry page");
    await userEvent.click(await found(() => button("Go back")));
    await waitUntil(() => rows().length >= count, "the timeline");
    await device.settle();
    expect(device.location()).toBe(`${TIMELINE_URL}?day=${key(20)}`);
    expect(headingIds()[0]).toBe(first);
    expect(rows()).toHaveLength(count);
  });

  describe("an edit sheet over a day's window", () => {
    // Under a page below the day: nothing loads older after the jump, which would save the reset by itself.
    const withSymptom = () => [
      ...history(25),
      fx.symptom({ occurredAt: at(daysAgo(20, 11)), name: "Sheet symptom" }),
    ];
    const loadNewer = async () => {
      (await found(newerButton)).click();
      await waitUntil(() => headingIds()[0] !== `day-${key(20)}`, "newer days");
    };
    const openSheet = async () => {
      await tapAt(() => rowWith("Sheet symptom")?.querySelector('a[aria-label^="Edit "]'));
      await waitUntil(() => !!document.querySelector("[role=dialog] form"), "the edit sheet");
    };

    test("a repeated jump's reset survives the sheet: the window and scroll stay put", async () => {
      const device = await openTimeline({ fixtures: withSymptom(), query: `?day=${key(20)}` });
      await stopsMoving(() => document.getElementById(`day-${key(20)}`));
      await loadNewer();
      await device.settle();

      // The same day again, from the picker (it opens on the current day).
      await userEvent.click(
        await found(() => document.querySelector<HTMLElement>('button[aria-label="Go to another day"]')),
      );
      await userEvent.click(
        await found(() => document.querySelector<HTMLElement>("[data-day-picker] button[type=submit]")),
      );
      await waitUntil(() => headingIds()[0] === `day-${key(20)}`, "the day's window again");
      await device.settle();
      const landed = document.getElementById(`day-${key(20)}`)!;
      await stopsMoving(() => landed);
      const count = rows().length;
      const y = Math.round(scrollY);

      await openSheet();
      await device.settle();
      await frames(3);
      expect(device.location()).toContain(`day=${key(20)}`);
      expect(headingIds()[0]).toBe(`day-${key(20)}`);
      expect(rows()).toHaveLength(count);
      expect(Math.abs(Math.round(scrollY) - y)).toBeLessThanOrEqual(2);
    });

    test("without a repeat, the sheet keeps the window paged newer", async () => {
      const device = await openTimeline({ fixtures: withSymptom(), query: `?day=${key(20)}` });
      await stopsMoving(() => document.getElementById(`day-${key(20)}`));
      await loadNewer();
      await device.settle();
      const first = headingIds()[0];
      const count = rows().length;

      await openSheet();
      await device.settle();
      expect(headingIds()[0]).toBe(first);
      expect(rows()).toHaveLength(count);
    });
  });
});
