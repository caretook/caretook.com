import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { button, openTimeline, rows, TIMELINE_URL, waitUntil, world } from "./timelineWorld";

// Back from a page outside the timeline (B-174): the entry page isn't one of
// the timeline's child routes, so going to it unmounts the timeline, and Back
// mounts it again. It starts from the window it left (`timelinePaging.ts`),
// rows and all, so the scroll position has somewhere to come back to; a new
// navigation to the timeline starts at one page (timelinePaging.test.ts).
// Sheets, which keep it mounted, are timelineScroll.browser.test.tsx's.

const LOADING = "Loading older…";
const status = () => document.querySelector("[data-older-entries] [role=status]");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const probe = () => document.querySelector("h1")?.textContent?.startsWith("Entry page") ?? false;
const ids = () =>
  rows().map(
    (li) =>
      li.querySelector<HTMLAnchorElement>('a[aria-label^="Open "], a[aria-label^="Edit "]')?.href ??
      li.textContent,
  );

/** Scroll down until at least `count` rows are loaded and no page is loading. */
const scrollTo = async (count: number) => {
  for (let i = 0; i < 40 && rows().length < count; i++) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await pause(100);
  }
  await waitUntil(() => status()?.textContent !== LOADING, 8000, "the page to load");
  expect(rows().length).toBeGreaterThanOrEqual(count);
};

/** Tap a note of the loaded pages' last one (its entry page), and wait for the page. */
const openLastNote = async () => {
  const note = rows()
    .slice(60)
    .find((li) => li.querySelector('a[aria-label^="Open "]'))!;
  expect(note).toBeTruthy();
  note.scrollIntoView({ block: "center" });
  await userEvent.click(note.querySelector('a[aria-label^="Open "]')!, { force: true });
  await waitUntil(probe, 4000, "the entry page");
};

describe("back from the entry page", () => {
  test("three pages down, an entry's page and Back: all three pages' rows are there at once, and the next page still loads", async () => {
    const device = await openTimeline({ fixtures: world(130) });
    await waitUntil(() => rows().length > 0);
    await scrollTo(90);
    await device.settle();
    const before = ids();

    await openLastNote();
    expect(device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    // The first rows the timeline shows on its way back, before any watch answers.
    let first: number | null = null;
    const observer = new MutationObserver(() => {
      if (first === null && rows().length > 0) first = rows().length;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await userEvent.click(button("Go back")!);
    await waitUntil(() => rows().length > 0, 4000, "the timeline");
    observer.disconnect();
    await expect.poll(device.location).toBe(TIMELINE_URL);
    expect(first).toBe(before.length);
    await device.settle();
    expect(ids()).toEqual(before);

    // The next page loads as the end comes near.
    window.scrollTo(0, document.documentElement.scrollHeight);
    await waitUntil(() => rows().length > before.length, 8000, "the fourth page");
  });
});
