import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, recordTag, symptomType, tag, TEST_USER } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import * as home from "../../home/route";
import {
  frames,
  openTimeline,
  rows,
  rowWith,
  SAM,
  tapAt,
  TIMELINE_ROUTES,
  TIMELINE_URL,
  world,
} from "./timelineWorld";

// B-1046: an alpha tester saw the timeline paint only its Today header (and
// sometimes the vitals line) until a scroll or a reload: after resuming the
// app, under several filters at once, and after the logo's way back to Today.
// Each path the report suspects, on the test device: the entries show as soon
// as they're in the local database, with no scroll. None of them leaves the
// list empty here (Chromium). The last test pins the state a WebKit paint of
// `content-visibility: auto` rows (`offscreenRows.ts`) would have to get right.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const texts = () => rows().map((li) => li.textContent ?? "");
const logo = () => document.querySelector<HTMLAnchorElement>("header a[href='/app']");
/** The rows on screen, and whether each is drawn (not skipped by `content-visibility: auto`). */
const onScreen = () =>
  rows()
    .filter((li) => {
      const r = li.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    })
    .map((li) => li.checkVisibility({ contentVisibilityAuto: true }));

describe("entries arriving after the first read", () => {
  test("a timeline whose first read was empty lists the entries that sync in, without a scroll", async () => {
    const device = await openTimeline({ fixtures: [SAM] });
    expect(rows()).toHaveLength(0);
    const scrollY = window.scrollY;

    await device.sync(world(10));
    await device.settle();
    await expect.poll(() => rows().length).toBe(15);
    expect(rowWith("Picked up the refill.")).toBeTruthy();
    expect(window.scrollY).toBe(scrollY);
  });

  test("so does a filtered one", async () => {
    const device = await openTimeline({ fixtures: [SAM], query: "?kind=note" });
    expect(rows()).toHaveLength(0);

    await device.sync([fx.note({ occurredAt: minutesAgo(5), text: "Synced in after the first read" })]);
    await device.settle();
    await expect.poll(texts).toEqual([expect.stringContaining("Synced in after the first read")]);
  });
});

describe("several filter categories at once", () => {
  const NAUSEA = symptomType("Nausea");
  const FALL = symptomType("Fall");
  const KNEE = symptomType("Knee pain");
  const URGENT = tag("Urgent");
  const samNausea = fx.symptom({ name: "Nausea", occurredAt: minutesAgo(5), createdBy: SAM.id });
  const samFall = fx.symptom({ name: "Fall", occurredAt: minutesAgo(10), createdBy: SAM.id });
  const samKnee = fx.symptom({ name: "Knee pain", occurredAt: minutesAgo(15), createdBy: SAM.id });
  const myNausea = fx.symptom({ name: "Nausea", occurredAt: minutesAgo(20), createdBy: TEST_USER.id });
  const untagged = fx.symptom({ name: "Fall", occurredAt: minutesAgo(25), createdBy: SAM.id });
  const fixtures = [
    SAM,
    NAUSEA,
    FALL,
    KNEE,
    URGENT,
    samNausea,
    samFall,
    samKnee,
    myNausea,
    untagged,
    fx.note({ occurredAt: minutesAgo(30), createdBy: SAM.id, text: "A note of Sam's" }),
    ...[samNausea, samFall, samKnee, myNausea].map((e) => recordTag(URGENT.id, e.id)),
  ];
  const query = `?kind=symptom&author=${SAM.id}&symptom=${NAUSEA.id}&symptom=${FALL.id}&tag=${URGENT.id}`;

  test("a kind, its types, an author and a tag together list the entries matching them all", async () => {
    const device = await openTimeline({ fixtures, query });
    await expect.poll(() => rows().length).toBe(2);
    expect(texts()[0]).toContain("Nausea");
    expect(texts()[1]).toContain("Fall");

    // One more that matches them all, synced in later, joins them at once.
    const later = fx.symptom({ name: "Fall", occurredAt: minutesAgo(1), createdBy: SAM.id });
    await device.sync([later, recordTag(URGENT.id, later.id)]);
    await device.settle();
    await expect.poll(() => rows().length).toBe(3);
  });
});

describe("back to Today from another page of the group", () => {
  const ROUTES = [...TIMELINE_ROUTES, { path: "/app", id: "home", module: home }];

  test("the logo (home, then the group's timeline) lists its entries", async () => {
    const device = await openTimeline({ route: ROUTES, frame: true });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    const before = rows().length;

    // An entry's page, then the logo.
    await tapAt(() => rowWith("Picked up the refill.")?.querySelector("a[aria-label^='Open ']"));
    await expect.poll(() => device.location()).toMatch(/\/entries\//);
    await userEvent.click(await found(logo));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await expect.poll(() => rows().length).toBe(before);
    expect(rowWith("Picked up the refill.")).toBeTruthy();
  });

  test("the logo on the timeline itself keeps listing its entries", async () => {
    const device = await openTimeline({ route: ROUTES, frame: true });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    const before = rows().length;

    await userEvent.click(await found(logo));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await device.settle();
    await expect.poll(() => rows().length).toBe(before);
  });

  test("three pages down, the logo: Today's rows, now skipped off screen (`offscreenRows`), are drawn on screen", async () => {
    await openTimeline({ route: ROUTES, frame: true, fixtures: world(100) });
    while (rows().length < 90) {
      const loaded = rows().length;
      await waitUntil(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return rows().length > loaded;
      }, `the page after ${loaded} rows`);
    }

    await userEvent.click(await found(logo));
    await waitUntil(() => window.scrollY === 0 && rows().length >= 90, "the top of the same window");
    await frames();
    // Today's day is settled now (its rows may skip rendering off screen), and on screen they're drawn.
    expect(getComputedStyle(rowWith("Picked up the refill.")!).contentVisibility).toBe("auto");
    const drawn = onScreen();
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every(Boolean)).toBe(true);
  });
});
