import type { DeviceOptions } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_USER } from "../../../../../test/fixtures";
import {
  closeFilters,
  filterButton,
  openFilters,
  TIMELINE_ROUTES,
  TIMELINE_URL,
  frames,
  setView,
  world,
} from "./timelineWorld";

// The timeline's search on the test device (from search.mjs, slices 2 and 4
// and care-periods 6): the magnifier's field narrowing the list as you type,
// `?q=` through a reload and Back, with the kind filter, the Matching chip's
// ✕, the empty state and the announcement, the Today card's appointment
// showing only a match, paging to the oldest match and a new search
// starting from one page, cards at 1280, a viewer, a search used there
// joining the recent searches; marks and snippets in rows and cards, with
// contrast in light and dark; and the Filter sheet's care period with its
// During chip. The device is
// offline throughout, so every test is also "search works offline". The
// states and announcements are timelineSearch.test.ts's, the URL rules
// timelineFilters.test.ts's.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const DAY = 86_400_000;

/** Three symptoms with the tag word, and an appointment two days ahead. */
const tagged = {
  alpha: fx.symptom({ name: "Quince alpha", severity: 2, occurredAt: minutesAgo(2) }),
  beta: fx.symptom({ name: "Quince beta", severity: 2, occurredAt: minutesAgo(3) }),
  gamma: fx.symptom({ name: "Quince gamma", severity: 2, occurredAt: minutesAgo(4) }),
  visit: fx.event({ title: "Quince visit", occurredAt: at(new Date(Date.now() + 2 * DAY)) }),
};
/** 35 matches for "paged", older than the tagged ones. */
const paged = Array.from({ length: 35 }, (_, i) =>
  fx.symptom({ name: `Paged ${i}`, severity: 1, occurredAt: minutesAgo(10 + i) }),
);

const open = (query = "", options: Partial<DeviceOptions> = {}) =>
  renderWithDevice({
    route: TIMELINE_ROUTES,
    url: `${TIMELINE_URL}${query}`,
    fixtures: [world(), Object.values(tagged)],
    search: true,
    ...options,
  });

// --- DOM helpers (search.mjs's selectors) ------------------------------------

const rows = () => [...document.querySelectorAll<HTMLLIElement>("[data-view] > li:not([data-marker])")];
const texts = () => rows().map((li) => li.textContent ?? "");
const rowWith = (text: string) => rows().find((li) => li.textContent?.includes(text));
const field = () => document.querySelector<HTMLInputElement>("[data-search-field]");
const magnifier = () => document.querySelector<HTMLButtonElement>('button[aria-label="Search entries"]')!;
/** A removable chip under the Filter button (the row is there only with a filter on). */
const chipStarting = (text: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Filters on"] a')].find((a) =>
    (a.getAttribute("aria-label") ?? a.textContent ?? "").startsWith(text),
  );
const statusText = () => document.querySelector("[data-search-status]")?.textContent ?? "";
const params = (location: string) => new URLSearchParams(location.split("?")[1] ?? "");
const vitals = () => document.querySelector('[data-today-row="vitals"]')?.textContent ?? "";

/** Open the field with the magnifier (once the screen is up: the loader can still be reading). */
const openField = async () => {
  await expect.poll(() => !!document.querySelector('button[aria-label="Search entries"]')).toBe(true);
  await userEvent.click(magnifier());
  await expect.poll(() => document.activeElement === field()).toBe(true);
};

// --- The field ---------------------------------------------------------------

describe("searching the timeline", () => {
  test("the magnifier opens a focused field beside the Filter button; typing narrows the list, carries q in the URL, is announced, and keeps narrowing; the Today card's appointment and vitals", async () => {
    const device = await open();
    await expect.poll(vitals).toMatch(/Latest vitals: /);
    await device.settle();
    const vitalsBefore = vitals();
    await openField();
    expect(filterButton().checkVisibility()).toBe(true);

    await userEvent.type(field()!, "quince");
    await expect.poll(() => texts().length).toBe(3);
    expect(texts().every((t) => t.includes("Quince"))).toBe(true);
    expect(params(device.location()).get("q")).toBe("quince");
    await expect.poll(statusText).toMatch(/^3 entries match/);

    await userEvent.type(field()!, " alpha");
    await expect.poll(texts).toEqual([expect.stringContaining("Quince alpha")]);
    // The appointment doesn't match "alpha": no appointment row.
    expect(document.querySelector("[data-next]")).toBeNull();
    expect(vitals()).toBe(vitalsBefore);
  });

  test("a reload keeps the search with the kind filter; the Matching chip shows it; the empty state names it; the chip's ✕ clears only the search", async () => {
    const device = await open("?kind=symptom&q=quince");
    await expect.poll(() => texts().length).toBe(3);
    expect(chipStarting("Matching")).toBeDefined();
    await device.screen.unmount();

    const empty = await open("?kind=vital&q=quince");
    await expect
      .poll(() => document.querySelector("[data-empty]")?.textContent)
      .toBe("No vitals match “quince”.");
    await userEvent.click(chipStarting("Matching")!);
    await expect.poll(() => params(empty.location()).has("q")).toBe(false);
    expect(params(empty.location()).get("kind")).toBe("vital");
  });

  test("the Today card's appointment row names the matching appointment", async () => {
    await open("?q=quince");
    await expect
      .poll(() => document.querySelector<HTMLElement>("[data-next]")?.dataset.next)
      .toBe(tagged.visit.id);
  });

  test("Back after opening a match comes back to the search", async () => {
    const device = await open("?q=quince%20beta");
    await expect.poll(() => texts().length).toBe(1);
    await userEvent.click(rows()[0]!.querySelector("a[aria-label^='Edit']")!);
    await expect.poll(() => device.location()).toMatch(/\/edit/);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => device.location()).not.toMatch(/\/edit/);
    expect(params(device.location()).get("q")).toBe("quince beta");
    await expect.poll(() => texts().length).toBe(1);
  });

  test("35 matches show one page first, announced 30+; scrolling reaches the oldest, then says so; a new search starts again from one page", async () => {
    await open("?q=paged", { fixtures: [world(), Object.values(tagged), paged] });
    await expect.poll(() => texts().length).toBe(30);
    expect(statusText()).toMatch(/^30\+ entries match/);
    for (let i = 0; i < 40 && texts().length < 35; i++) {
      document.querySelector("[data-older-entries]")?.scrollIntoView({ block: "end" });
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(texts().length).toBe(35);
    await expect
      .poll(() => document.querySelector("[data-older-entries]")?.textContent)
      .toContain("every match");

    // A changed search (still more than a page of matches) starts from one page.
    await openField();
    await userEvent.fill(field()!, "paged");
    await userEvent.type(field()!, " -quince");
    await expect.poll(() => texts().length).toBe(30);
  });

  test("cards at 1280 show the matches, and the field sits beside the Filter button", async () => {
    await open("?q=quince", { width: 1280 });
    await expect.poll(() => texts().length).toBe(3);
    await found(() => document.querySelector('button[aria-label="View options"]'));
    await setView("Cards");
    await expect.poll(() => document.querySelector<HTMLElement>("[data-view]")?.dataset.view).toBe("cards");
    expect(texts().length).toBe(3);
    await openField();
    const [box, button] = [field()!, filterButton()].map((el) => el.getBoundingClientRect());
    expect(button!.left).toBeGreaterThan(box!.right);
    expect(Math.abs(button!.top + button!.height / 2 - (box!.top + box!.height / 2))).toBeLessThan(2);
  });

  test("a viewer's timeline searches too", async () => {
    await open("?q=quince", { role: "viewer" });
    await expect.poll(() => texts().length).toBe(3);
    expect(texts().every((t) => t.includes("Quince"))).toBe(true);
  });

  test("a search used in the field (Enter) joins the recent searches the search page lists", async () => {
    await open();
    await openField();
    await userEvent.type(field()!, "metformin{Enter}");
    expect(JSON.parse(localStorage.getItem(`caretook:recentSearches:${TEST_USER.id}`) ?? "[]")).toEqual([
      "metformin",
    ]);
  });
});

// --- Highlights and snippets -------------------------------------------------

describe("highlights and snippets", () => {
  const LONG = `${"A long quiet morning with tea and the radio. ".repeat(4)}Then the plumber came by to fix the step.`;
  const deepNote = fx.note({ occurredAt: minutesAgo(3), title: "Visit note", text: LONG });
  const sore = fx.symptom({ name: "Plumber sore knee", severity: 3, occurredAt: minutesAgo(4) });
  const marked: Fixture[] = [deepNote, sore];

  /** Each mark in `li`: its text, and whether it's a whole word (no letter or digit right before or after). */
  const marksIn = (li: Element | undefined) =>
    [...(li?.querySelectorAll("mark") ?? [])].map((m) => {
      const block = m.closest("p, li")!;
      const r = document.createRange();
      r.setStart(block, 0);
      r.setEndBefore(m);
      const before = block.textContent[r.toString().length - 1] ?? " ";
      const after = block.textContent[r.toString().length + m.textContent.length] ?? " ";
      return { text: m.textContent, whole: !/[\p{L}\p{N}]/u.test(before + after) };
    });

  /** The contrast of a mark's text on its background (canvas turns any CSS colour into RGB). */
  const contrast = (m: Element) => {
    const cs = getComputedStyle(m);
    const rgb = (c: string) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const x = cv.getContext("2d")!;
      x.fillStyle = "#fff";
      x.fillRect(0, 0, 1, 1);
      x.fillStyle = c;
      x.fillRect(0, 0, 1, 1);
      return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const lum = (c: number[]) =>
      c
        .map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const [a, b] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  };

  afterEach(async () => {
    await commands.colorScheme(null);
  });

  test("rows mark whole matched words, and a note matched deep in its text gets a snippet line around it", async () => {
    await open("?q=plumber", { fixtures: [world(), marked] });
    await expect.poll(() => !!rowWith("Visit note") && !!rowWith("Plumber sore knee")).toBe(true);
    expect(marksIn(rowWith("Plumber sore knee"))).toEqual([{ text: "Plumber", whole: true }]);
    const snippet = rowWith("Visit note")!.querySelector("[data-snippet]")!;
    expect(snippet.querySelector("mark")?.textContent).toBe("plumber");
    expect(snippet.textContent.startsWith("…")).toBe(true);
    expect(snippet.textContent.length).toBeLessThanOrEqual(125);
    const marks = marksIn(rowWith("Visit note"));
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks.every((m) => m.text === "plumber" && m.whole)).toBe(true);
  });

  test.each(["light", "dark"] as const)("marks keep 4.5:1 contrast in %s", async (theme) => {
    await commands.colorScheme(theme);
    await open("?q=plumber", { fixtures: [world(), marked], theme });
    await expect.poll(() => !!rowWith("Plumber sore knee")?.querySelector("mark")).toBe(true);
    expect(contrast(rowWith("Plumber sore knee")!.querySelector("mark")!)).toBeGreaterThanOrEqual(4.5);
  });

  test("cards at 1280 mark matches with no snippet (all the text shows); without a search nothing is marked", async () => {
    const device = await open("?q=plumber", { fixtures: [world(), marked], width: 1280 });
    await expect.poll(() => !!rowWith("Visit note")).toBe(true);
    await found(() => document.querySelector('button[aria-label="View options"]'));
    await setView("Cards");
    await expect.poll(() => document.querySelector<HTMLElement>("[data-view]")?.dataset.view).toBe("cards");
    await frames();
    const card = rowWith("Visit note")!;
    expect(card.querySelectorAll("mark").length).toBeGreaterThanOrEqual(1);
    expect(card.querySelector("[data-snippet]")).toBeNull();
    await device.screen.unmount();

    await open("?kind=symptom", { fixtures: [world(), marked] });
    await expect.poll(() => !!rowWith("Plumber sore knee")).toBe(true);
    expect(marksIn(rowWith("Plumber sore knee"))).toEqual([]);
  });
});

// --- Within a care period ----------------------------------------------------

describe("within a care period", () => {
  const place = fx.provider({ name: "Oak Hills Rehab", type: "practice", specialty: null });
  const rehabStart = Date.now() - 20 * DAY;
  const homeStart = Date.now() - 10 * DAY;
  const hospital = fx.period({ type: "hospital", startedAt: at(new Date(Date.now() - 30 * DAY)) });
  const rehab = fx.period({ type: "rehab", startedAt: at(new Date(rehabStart)), placeProviderId: place.id });
  const home = fx.period({ type: "home", startedAt: at(new Date(homeStart)) });
  const ankles = {
    before: fx.symptom({ name: "Ankle before", occurredAt: at(new Date(rehabStart - 2 * 60_000)) }),
    inrehab: fx.symptom({ name: "Ankle inrehab", occurredAt: at(new Date(rehabStart + 2 * DAY)) }),
    edge: fx.symptom({ name: "Ankle edge", occurredAt: at(new Date(homeStart)) }),
    now: fx.symptom({ name: "Ankle now", occurredAt: minutesAgo(3) }),
    visit: fx.event({ title: "Ankle visit", occurredAt: at(new Date(Date.now() + 2 * DAY)) }),
  };
  const fixtures = [world(), place, hospital, rehab, home, Object.values(ankles)];
  const names = () =>
    texts()
      .map((t) => /Ankle (\w+)/.exec(t)?.[1])
      .filter(Boolean)
      .sort()
      .join(",");
  const during = () => chipStarting("During ");

  test("a period in the Filter sheet narrows the matches, with a During chip, kept in the URL, through a reload and Back; its ✕ clears only the period", async () => {
    const device = await open("?q=ankle", { fixtures });
    await expect.poll(names).toBe("before,edge,inrehab,now");
    await openFilters();
    const periods = device.screen.getByRole("navigation", { name: "Search within a care period" });
    await userEvent.click(periods.getByRole("link", { name: /Oak Hills Rehab/ }));
    await expect.poll(names).toBe("inrehab");
    await closeFilters();
    expect(params(device.location()).get("period")).toBe(rehab.id);
    await expect.poll(() => during()?.textContent).toBe("During Rehab at Oak Hills Rehab");
    expect(during()!.getAttribute("aria-label")).toMatch(/: search every date$/);

    // Away (a match's edit sheet) and Back.
    await userEvent.click(rowWith("Ankle inrehab")!.querySelector("a[aria-label^='Edit']")!);
    await expect.poll(() => device.location()).toMatch(/\/edit/);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => device.location()).not.toMatch(/\/edit/);
    await expect.poll(names).toBe("inrehab");
    expect(params(device.location()).get("period")).toBe(rehab.id);
    await device.screen.unmount();
    const again = await open(`?q=ankle&period=${rehab.id}`, { fixtures });
    await expect.poll(names).toBe("inrehab");
    expect(during()).toBeDefined();

    await userEvent.click(during()!);
    await expect.poll(names).toBe("before,edge,inrehab,now");
    expect(params(again.location()).get("period")).toBeNull();
    expect(params(again.location()).get("q")).toBe("ankle");
  });

  test("the current period's matches run up to now; clearing the search clears the period and keeps the kind; ?period= alone changes nothing", async () => {
    const device = await open(`?kind=symptom&q=ankle&period=${home.id}`, { fixtures });
    await expect.poll(names).toBe("edge,now");
    await userEvent.click(chipStarting("Matching")!);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    await device.screen.unmount();

    const plainDevice = await open("", { fixtures });
    await expect.poll(() => texts().length).toBeGreaterThan(8);
    await plainDevice.settle();
    const plain = texts().slice(0, 8);
    await plainDevice.screen.unmount();
    const withPeriod = await open(`?period=${rehab.id}`, { fixtures });
    await expect.poll(() => texts().length).toBeGreaterThan(8);
    await withPeriod.settle();
    expect(texts().slice(0, 8)).toEqual(plain);
    expect(during()).toBeUndefined();
  });
});
