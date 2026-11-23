import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, TEST_GROUP } from "../../../../../test/fixtures";
import { found, stopsMoving, waitUntil } from "../../../../../test/found";
import { historyQuery, newerEdgeQuery } from "~/lib/timeline/timeline.sync";
import { jumpBound } from "~/lib/timeline/timelineJump";
import { dayKeyIn } from "./timelineDays";
import { button, frames, openTimeline, rows, rowWith, tapAt, TIMELINE_URL } from "./timelineWorld";

// Paging newer from a jumped-to day: the newer-edge query on a real local
// database, the scroll held by measurement, reaching today, the oldest day
// under the notice, and Back after loading newer.

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
    await openTimeline({ fixtures: history(40), query: `?day=${key(20)}` });
    const landed = await found(() => document.getElementById(`day-${key(20)}`));
    await stopsMoving(() => landed);
    const list = document.querySelector("section[aria-labelledby='timeline-heading']")!;
    expect(getComputedStyle(list).overflowAnchor).toBe("none");
    expect(headingIds()[0]).toBe(`day-${key(20)}`);

    const row = rowWith("Day 20 at 15")!;
    window.scrollBy(0, 40);
    await frames();
    const top = row.getBoundingClientRect().top;
    window.scrollBy(0, -4);
    await waitUntil(() => headingIds()[0] !== `day-${key(20)}`, "newer days");
    await frames();
    expect(row.isConnected).toBe(true);
    expect(Math.abs(row.getBoundingClientRect().top - (top + 4))).toBeLessThanOrEqual(1);
    // Whole days: the top day has all three of its notes.
    const newest = headingIds()[0]!.replace("day-", "");
    const d = Array.from({ length: 40 }, (_, i) => i + 1).find((n) => key(n) === newest)!;
    for (const hour of [9, 12, 15]) expect(rowWith(`Day ${d} at ${hour}`)).toBeTruthy();
  });

  test("reaching today brings the Today heading back", async () => {
    const fixtures = [
      ...history(12),
      fx.note({ occurredAt: at(new Date(Date.now() - 60_000)), text: "Now" }),
    ];
    await openTimeline({ fixtures, query: `?day=${key(10)}` });
    await found(() => document.getElementById(`day-${key(10)}`));
    expect(document.getElementById(`day-${key(0)}`)).toBeNull();
    await userEvent.click(await found(() => document.querySelector<HTMLElement>("[data-load-newer]")));
    await waitUntil(() => !!document.getElementById(`day-${key(0)}`), "today's heading");
    expect(rowWith("Now")).toBeTruthy();
    expect(document.querySelector("[data-newer-entries]")).toBeNull();
    const list = document.querySelector("section[aria-labelledby='timeline-heading']")!;
    await expect.poll(() => getComputedStyle(list).overflowAnchor).toBe("auto");
  });

  test("a day before the first entry shows the oldest day under its notice", async () => {
    await openTimeline({ fixtures: history(40), query: `?day=${key(400)}` });
    const oldest = await found(() => document.getElementById(`day-${key(40)}`));
    expect(notice()?.textContent).toMatch(/^No entries on or before /);
    expect(notice()!.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // On screen, at the notice: not left at the top of the page.
    await expect.poll(() => Math.abs(notice()!.getBoundingClientRect().top)).toBeLessThan(120);
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
});
