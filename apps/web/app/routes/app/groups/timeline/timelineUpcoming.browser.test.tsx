import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { TEST_GROUP } from "../../../../../test/fixtures";
import { materializeLiveEntry } from "~/lib/sync/liveEntry";
import {
  fixClock,
  ME,
  NOW,
  NURSE,
  openUpcoming,
  REFILL,
  THERAPY,
  TIMELINE_URL,
  UPCOMING_URL,
} from "../upcoming/upcomingWorld";

// The timeline's Next strip and Upcoming block on the test device, on
// Upcoming's fictional world and fixed clock (from upcoming.mjs's timeline
// steps): an event saved for later today showing in the strip at once,
// Show upcoming and its block (above the history, five at most, the
// filters, See all, rows and cards, 1280), an item crossing into the
// history as its minute passes, and the viewer. The strip's first state is
// timelineStrips.browser.test.tsx's; the wording is upcomingLabels.test.ts's.

const MINUTE = 60_000;
const STRIP = () => document.querySelector<HTMLElement>("main [data-next-strip]");
const NEXT = () => STRIP()?.querySelector<HTMLElement>("[data-next]") ?? null;
const TOGGLE = () => STRIP()!.querySelector<HTMLAnchorElement>("[data-upcoming-toggle]")!;
const BLOCK = () => document.querySelector<HTMLElement>("main [data-upcoming-block]");
const HISTORY = () => document.querySelector('main section[aria-labelledby="timeline-heading"]');
const blockIds = () =>
  [...(BLOCK()?.querySelectorAll("ol > li") ?? [])].map(
    (li) => li.querySelector("a.absolute")?.getAttribute("href")?.split("/").pop() ?? null,
  );
const inHistory = (id: string) => !!HISTORY()?.querySelector(`a.absolute[href$="/entries/${id}"]`);
const seeAll = () => BLOCK()?.querySelector("[data-see-all]")?.getAttribute("href");

beforeEach(() => fixClock());
afterEach(() => {
  vi.useRealTimers();
});

/** The timeline on the world, without the visit in progress (so what's next is still to come). */
const openTimeline = async (query = "", options: Parameters<typeof openUpcoming>[0] = {}) => {
  const device = await openUpcoming({ url: `${TIMELINE_URL}${query}`, ...options });
  await device.unsync([NURSE]);
  await device.settle();
  await expect.poll(NEXT).not.toBeNull();
  return device;
};
/** Save an event `inMs` from the fixed now, as the entry page does. */
const saveEvent = async (db: Parameters<typeof materializeLiveEntry>[0], title: string, inMs: number) => {
  const id = crypto.randomUUID();
  const res = await materializeLiveEntry(db, {
    id,
    groupId: TEST_GROUP.id,
    kind: "event",
    title,
    occurredAt: new Date(NOW.getTime() + inMs).toISOString(),
    timeZone: "America/Los_Angeles",
  });
  expect(res.ok).toBe(true);
  return id;
};

describe("the Next strip", () => {
  test("an event saved for later today is soonest: the strip names it at once, one more in the count, and it's not in the history", async () => {
    const device = await openTimeline();
    expect(NEXT()!.dataset.next).toBe(THERAPY.id);
    expect(NEXT()!.textContent).toBe("Next: Physical therapy · Today 2:00 PM · +5 more");
    const id = await saveEvent(device.db, "Pharmacy pickup", 90 * MINUTE);
    await device.settle();
    await expect.poll(() => NEXT()?.dataset.next).toBe(id);
    expect(NEXT()!.textContent).toBe("Next: Pharmacy pickup · Today 11:30 AM · +6 more");
    expect(inHistory(id)).toBe(false);
  });
});

describe("the Upcoming block", () => {
  test("Show upcoming adds it above the history: five at most, soonest first, in rows, then See all in Upcoming; Hide upcoming takes it away", async () => {
    const device = await openTimeline();
    expect(TOGGLE().textContent?.trim()).toBe("Show upcoming");
    await userEvent.click(TOGGLE());
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?upcoming=1`);
    await expect.poll(BLOCK).not.toBeNull();
    expect(BLOCK()!.compareDocumentPosition(HISTORY()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(blockIds()).toHaveLength(5);
    expect(blockIds()[0]).toBe(THERAPY.id);
    expect([
      ...new Set([...BLOCK()!.querySelectorAll<HTMLElement>("ol")].map((ol) => ol.dataset.blockView)),
    ]).toEqual(["rows"]);
    expect(seeAll()).toBe(UPCOMING_URL);
    expect(TOGGLE().textContent?.trim()).toBe("Hide upcoming");
    await userEvent.click(TOGGLE());
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await expect.poll(BLOCK).toBeNull();
  });

  test("opened with it on (a reload): the Notes chip keeps it and shows notes only; an author's initials add the author; See all carries both, and opens Upcoming with them", async () => {
    const device = await openTimeline("?upcoming=1");
    await expect.poll(BLOCK).not.toBeNull();
    const notes = [
      ...document.querySelectorAll<HTMLAnchorElement>('main nav[aria-label="Show entries"] a'),
    ].find((a) => a.textContent?.trim() === "Notes")!;
    await userEvent.click(notes);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=note&upcoming=1`);
    await expect.poll(blockIds).toEqual([REFILL.id]);
    expect(seeAll()).toBe(`${UPCOMING_URL}?kind=note`);

    await userEvent.click(BLOCK()!.querySelector<HTMLElement>(`[data-author="${ME}"]`)!);
    await expect.poll(() => device.location()).toContain(`author=${ME}`);
    expect(device.location()).toContain("upcoming=1");
    await expect.poll(seeAll).toBe(`${UPCOMING_URL}?kind=note&author=${ME}`);
    expect(blockIds()).toEqual([REFILL.id]);
    await userEvent.click(BLOCK()!.querySelector<HTMLElement>("[data-see-all]")!);
    await expect.poll(() => device.location()).toBe(`${UPCOMING_URL}?kind=note&author=${ME}`);
    await expect.element(page.getByText("Call the pharmacy about the refill")).toBeInTheDocument();
  });

  test("it follows the timeline's view (cards), and keeps to the entries' column at 1280, with the strip", async () => {
    await openTimeline("?upcoming=1");
    await expect.poll(BLOCK).not.toBeNull();
    await userEvent.click(document.querySelector('[aria-label="Cards"]')!);
    await expect.poll(() => BLOCK()?.querySelector<HTMLElement>("ol")?.dataset.blockView).toBe("cards");
    expect(blockIds()).toHaveLength(5);
    await page.viewport(1280, 900);
    await expect.poll(() => BLOCK()!.getBoundingClientRect().width).toBeGreaterThan(420);
    expect(BLOCK()!.getBoundingClientRect().width).toBeLessThanOrEqual(1024);
    expect(NEXT()).not.toBeNull();
  });

  test("an item whose time passes moves from the block and the strip into the history, without a reload", async () => {
    const device = await openTimeline("?upcoming=1");
    // 10:01:20: after the history's end (the end of this minute), so still to come.
    const id = await saveEvent(device.db, "Ride to the lab", MINUTE + 20_000);
    await device.settle();
    await expect.poll(blockIds).toContain(id);
    expect(NEXT()!.dataset.next).toBe(id);
    expect(inHistory(id)).toBe(false);
    const mounted = document.querySelector("main");
    // Two minutes on, the history ends after it.
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    await device.settle();
    await expect.poll(() => inHistory(id)).toBe(true);
    expect(blockIds()).not.toContain(id);
    expect(NEXT()?.dataset.next).not.toBe(id);
    expect(document.querySelector("main")).toBe(mounted);
  });

  test("a viewer sees the Next strip and the block", async () => {
    await openTimeline("?upcoming=1", { role: "viewer" });
    await expect.poll(BLOCK).not.toBeNull();
    expect(NEXT()).not.toBeNull();
    expect(blockIds().length).toBeGreaterThan(0);
  });
});
