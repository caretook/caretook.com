import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx } from "../../../../../test/fixtures";
import { dayKeyIn } from "./timelineDays";
import { button, frames, openTimeline, rows, rowWith, tapAt, TIMELINE_URL, world } from "./timelineWorld";
import { found, stopsMoving, waitUntil } from "../../../../../test/found";

// Opening the timeline on a day (`?day=`): the bounded window, its notice,
// Back to today, and what keeps the scroll. Paging newer is
// timelineJumpPaging's.

const daysAgo = (d: number, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return t;
};
const key = (d: number) =>
  dayKeyIn(daysAgo(d).toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone);
const headings = () => [...document.querySelectorAll("[data-day-header] h3")].map((h) => h.textContent);
const headingIds = () => [...document.querySelectorAll("[data-day-header] h3")].map((h) => h.id);
const notice = () => document.querySelector("[data-jump-notice]")?.textContent ?? null;
const backToToday = () => document.querySelector<HTMLAnchorElement>("a[data-back-to-today]");
const probe = () => document.querySelector("h1")?.textContent?.startsWith("Entry page") ?? false;

/** A note on each of a few far days, and a symptom alone on one of them. */
const farWorld = () => [
  ...world(10),
  fx.note({ occurredAt: at(daysAgo(40, 9)), text: "Forty days back" }),
  fx.note({ occurredAt: at(daysAgo(50, 9)), text: "Fifty days back" }),
  fx.symptom({ occurredAt: at(daysAgo(45, 9)), name: "Forty-five days back" }),
];

describe("opening the timeline on a day", () => {
  test("a far day comes first, with no newer rows, no Today heading, and no notice", async () => {
    await openTimeline({ fixtures: farWorld(), query: `?day=${key(40)}` });
    await waitUntil(() => rows().length > 0);
    expect(headingIds()[0]).toBe(`day-${key(40)}`);
    expect(headings()).not.toContain("Today");
    expect(rows()[0]?.textContent).toContain("Forty days back");
    expect(rowWith("Pharmacy pickup")).toBeUndefined();
    expect(notice()).toBeNull();
    expect(backToToday()).toBeTruthy();
  });

  test("a fresh load of the URL scrolls the day's heading to the top of the screen", async () => {
    const fixtures = [...world(60), fx.note({ occurredAt: at(daysAgo(5, 23)), text: "The day to land on" })];
    await openTimeline({ fixtures, query: `?day=${key(5)}` });
    const heading = await found(() => document.getElementById(`day-${key(5)}`));
    await expect.poll(() => Math.round(heading.getBoundingClientRect().top)).toBeLessThan(40);
    expect(heading.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    expect(scrollY).toBeGreaterThan(0);
  });

  test("an empty day says which day is shown", async () => {
    await openTimeline({ fixtures: farWorld(), query: `?day=${key(42)}` });
    await waitUntil(() => !!notice());
    expect(notice()).toMatch(/^No entries on .*Showing .*the nearest earlier day\.$/);
    expect(headingIds()[0]).toBe(`day-${key(45)}`);
  });

  test("a kind filter changes which day is nearest", async () => {
    await openTimeline({ fixtures: farWorld(), query: `?kind=note&day=${key(42)}` });
    await waitUntil(() => !!notice());
    expect(notice()).toMatch(/^No matching entries on /);
    expect(headingIds()[0]).toBe(`day-${key(50)}`);
  });

  test("nothing on or before the day says so, with Back to today", async () => {
    await openTimeline({ fixtures: farWorld(), query: `?day=${key(400)}` });
    await waitUntil(() => !!notice());
    expect(notice()).toMatch(/^No entries on or before /);
    expect(rows()).toHaveLength(0);
    expect(headings()).not.toContain("Today");
    expect(document.querySelector("[data-empty-today]")).toBeNull();
    expect(backToToday()).toBeTruthy();
  });

  test("an invalid or future day is the ordinary timeline", async () => {
    const device = await openTimeline({ fixtures: farWorld(), query: "?day=2027-02-30" });
    await waitUntil(() => rows().length > 0);
    expect(headings()[0]).toBe("Today");
    expect(backToToday()).toBeNull();
    await device.screen.unmount();
    await openTimeline({ fixtures: farWorld(), query: `?day=${key(-1)}` });
    await waitUntil(() => rows().length > 0);
    expect(headings()[0]).toBe("Today");
    expect(backToToday()).toBeNull();
  });

  test("Back to today returns to the newest, keeping a filter", async () => {
    const device = await openTimeline({ fixtures: farWorld(), query: `?kind=note&day=${key(40)}` });
    await userEvent.click(await found(backToToday));
    await expect.poll(device.location).toBe(`${TIMELINE_URL}?kind=note`);
    await waitUntil(() => !!rowWith("Slept from ten"), "the newest note");
    expect(backToToday()).toBeNull();
    expect(notice()).toBeNull();
  });

  test("Back from an entry restores the day and the scroll position", async () => {
    const fixtures = [
      ...farWorld(),
      ...Array.from({ length: 28 }, (_, i) =>
        fx.note({ occurredAt: at(daysAgo(60 + i, 9)), text: `Far note ${i}` }),
      ),
    ];
    const device = await openTimeline({ fixtures, query: `?day=${key(40)}` });
    await waitUntil(() => rows().length > 20);
    const note = rowWith("Far note 12")!;
    window.scrollTo(0, note.getBoundingClientRect().top + scrollY - 300);
    await stopsMoving(() => note);
    const y = Math.round(scrollY);

    await tapAt(() => note.querySelector('a[aria-label^="Open "]'));
    await waitUntil(probe, "the entry page");
    const scrolls = vi.spyOn(window, "scrollTo");
    await userEvent.click(await found(() => button("Go back")));
    await waitUntil(() => rows().length > 20, "the timeline");
    await device.settle();
    await frames(3);
    expect(device.location()).toBe(`${TIMELINE_URL}?day=${key(40)}`);
    expect(headingIds()[0]).toBe(`day-${key(40)}`);
    // No landing scroll: the position is scroll restoration's (the app's root has it, this harness doesn't),
    // and the window is back, tall enough for it to land where it was.
    expect(scrolls).not.toHaveBeenCalled();
    scrolls.mockRestore();
    window.scrollTo(0, y);
    await frames();
    expect(Math.abs(Math.round(scrollY) - y)).toBeLessThanOrEqual(2);
  });

  test("opening and closing a sheet on ?day= leaves the scroll where it was", async () => {
    const fixtures = [
      ...farWorld(),
      ...Array.from({ length: 28 }, (_, i) =>
        fx.symptom({ occurredAt: at(daysAgo(60 + i, 9)), name: `Far symptom ${i}` }),
      ),
    ];
    const device = await openTimeline({ fixtures, query: `?day=${key(40)}` });
    await waitUntil(() => rows().length > 20);
    const row = rowWith("Far symptom 8")!;
    window.scrollTo(0, row.getBoundingClientRect().top + scrollY - 300);
    await stopsMoving(() => row);
    const before = Math.round(scrollY);

    await tapAt(() => row.querySelector('a[aria-label^="Edit "]'));
    await waitUntil(() => !!document.querySelector("[role=dialog] form"), "the edit sheet");
    expect(device.location()).toContain(`day=${key(40)}`);
    await userEvent.click(
      await found(() =>
        [...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find(
          (b) => b.textContent?.trim() === "Cancel",
        ),
      ),
    );
    await waitUntil(() => !document.querySelector("[role=dialog]"), "the sheet to close");
    await expect.poll(device.location).toBe(`${TIMELINE_URL}?day=${key(40)}`);
    await frames(3);
    expect(Math.abs(Math.round(scrollY) - before)).toBeLessThanOrEqual(2);
    expect(row.isConnected).toBe(true);
  });
});
