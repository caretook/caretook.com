import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx, TEST_RECIPIENT } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import { frames, openTimeline, rows, TIMELINE_URL, waitUntil, world } from "./timelineWorld";

// The timeline's header on a phone and a desktop (quick-fixes slice 39): the
// latest vitals only from `sm`, and the care period in each day's sticky
// header instead of the page's. The + menu is on each day's heading
// (quick-fixes slice 44): today's adds start at now, another day's at 12:00.

const ready = () => waitUntil(() => rows().length > 0, 8000, "the first rows");
const addButton = () => page.getByRole("button", { name: "Add to Today" });
const menuItems = () => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')];
const dayHeaders = () => [...document.querySelectorAll<HTMLElement>("[data-day-header]")];
const plusOf = (header: Element) => header.querySelector<HTMLElement>('button[aria-label^="Add to "]');
/** The day header two days back (the filler's): a past day other than Yesterday. */
const pastDay = () => {
  const t = new Date();
  t.setDate(t.getDate() - 2);
  const key = t.toLocaleDateString("en-CA");
  return { key, header: document.getElementById(`day-${key}`)!.closest<HTMLElement>("[data-day-header]")! };
};
/** The sheet's When, as the local "YYYY-MM-DDTHH:mm" it shows, and as a moment. */
const when = () => {
  const value = document.querySelector<HTMLInputElement>('[role=dialog] input[name="occurredAt"]')!.value;
  return { local: value.slice(0, 16), at: new Date(value.replace(/\[.*\]$/, "")).getTime() };
};
const VITAL_LABELS = new Set<string>(VITAL_TYPES.map((t) => VITALS[t].label));
/** + → `name`, expanding Vitals first for a vital type. */
const pick = async (name: string, button: Parameters<typeof userEvent.click>[0] = addButton()) => {
  await userEvent.click(button);
  await expect.element(page.getByRole("menu")).toBeVisible();
  if (VITAL_LABELS.has(name)) await userEvent.click(page.getByRole("menuitem", { name: "Vitals" }));
  await userEvent.click(page.getByRole("menuitem", { name, exact: true }));
};

describe("the heading", () => {
  test("is a plain “Timeline” h1, with no recipient card or profile link in main, and View options still opens", async () => {
    await openTimeline();
    await ready();
    const main = page.getByRole("main");
    await expect
      .element(main.getByRole("heading", { level: 1, name: "Timeline", exact: true }))
      .toBeVisible();
    expect([...document.querySelectorAll("main h1")].map((h) => h.textContent)).toEqual(["Timeline"]);
    expect(main.getByRole("link", { name: /profile/i }).query()).toBeNull();
    expect(document.querySelector("main header")?.textContent).not.toContain(TEST_RECIPIENT.preferredName);
    await userEvent.click(page.getByRole("button", { name: "View options" }));
    await expect.element(page.getByRole("menu")).toBeVisible();
    await userEvent.keyboard("{Escape}");
  });
});

describe("the toolbar", () => {
  test("View options sits at the right end of the filter row, after Filter, one circle like it; none in the page header", async () => {
    await openTimeline({ width: 420 });
    await ready();
    const eye = await found(() => document.querySelector<HTMLElement>('button[aria-label="View options"]'));
    const toolbar = document.querySelector<HTMLElement>("[data-timeline-filters]")!;
    expect(toolbar.contains(eye)).toBe(true);
    expect(document.querySelector('main header button[aria-label="View options"]')).toBeNull();
    const filter = toolbar.querySelector<HTMLElement>("button[data-filter-button]")!;
    expect(filter.compareDocumentPosition(eye) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const [f, v] = [filter, eye].map((el) => el.getBoundingClientRect());
    expect([v!.width, v!.height]).toEqual([f!.width, f!.height]);
    expect(Math.abs(v!.right - filter.parentElement!.getBoundingClientRect().right)).toBeLessThan(1);
    await userEvent.click(eye);
    await expect.element(page.getByRole("menu", { name: "View options" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
  });
});

describe("the + menu", () => {
  test("a writer's + opens every add kind in the bar's order, Vitals expanding to each vital type; there's no add bar", async () => {
    await openTimeline({ role: "caretaker" });
    await ready();
    expect(document.querySelector('[aria-label="Add to the timeline"]')).toBeNull();
    await userEvent.click(addButton());
    await expect.element(page.getByRole("menu", { name: "Add to Today" })).toBeVisible();
    expect(menuItems().map((el) => el.textContent?.trim())).toEqual([
      "Note",
      "Event",
      "Dose",
      "Symptom",
      "Vitals",
    ]);
    await userEvent.click(page.getByRole("menuitem", { name: "Vitals" }));
    await expect
      .poll(() => menuItems().map((el) => el.textContent?.trim()))
      .toEqual(["Note", "Event", "Dose", "Symptom", "Vitals", ...VITAL_TYPES.map((t) => VITALS[t].label)]);
    await userEvent.keyboard("{Escape}");
  });

  test("every day heading has its own +, named for the day, beside its heading; the timeline header has none", async () => {
    await openTimeline();
    await ready();
    const headers = dayHeaders();
    expect(headers.length).toBeGreaterThan(2);
    for (const header of headers) {
      const label = header.querySelector("h3")!.textContent;
      expect(plusOf(header)?.getAttribute("aria-label")).toBe(`Add to ${label}`);
      // Beside the heading, in the sticky header.
      expect(plusOf(header)!.parentElement).toBe(header.querySelector("h3")!.parentElement);
    }
    expect(plusOf(headers[0]!)!.getAttribute("aria-label")).toBe("Add to Today");
    expect(plusOf(headers[1]!)!.getAttribute("aria-label")).toBe("Add to Yesterday");
    expect(document.querySelector('main > header button[aria-label^="Add to "]')).toBeNull();
  });

  test("Symptom opens the add sheet over the timeline; a vital type opens it with that type; Note opens the new note page", async () => {
    const device = await openTimeline();
    await ready();
    await pick("Symptom");
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(device.location()).toBe(`${TIMELINE_URL}/new/symptom`);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    await pick("Heart rate");
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(device.location()).toBe(`${TIMELINE_URL}/new/vital?type=heartRate`);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    await pick("Note");
    await expect.element(page.getByRole("heading", { name: /^Entry page new/ })).toBeVisible();
    expect(device.location()).toMatch(/\/entries\/new\?kind=note$/);
  });

  test("today's + starts the sheet at now; a past day's + at 12:00 that day", async () => {
    const device = await openTimeline();
    await ready();
    await pick("Symptom");
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(Math.abs(when().at - Date.now())).toBeLessThan(60_000);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    const { key, header } = pastDay();
    await pick("Symptom", plusOf(header)!);
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(device.location()).toMatch(new RegExp(`^${TIMELINE_URL}/new/symptom\\?at=`));
    expect(when().local).toBe(`${key}T12:00`);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    // A vital from that day too.
    await pick("Heart rate", plusOf(pastDay().header)!);
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(when().local).toBe(`${key}T12:00`);
  });

  test("a viewer sees no + button", async () => {
    await openTimeline({ role: "viewer" });
    await ready();
    expect(page.getByRole("button", { name: /^Add to / }).query()).toBeNull();
    expect(dayHeaders().length).toBeGreaterThan(2);
    expect(dayHeaders().some(plusOf)).toBe(false);
    expect(page.getByRole("button", { name: "View options" }).query()).not.toBeNull();
  });

  test("a writer's timeline with nothing today still has Today's +", async () => {
    await openTimeline({ fixtures: [fx.symptom({ name: "Sore knee", occurredAt: at(pastNoon(3)) })] });
    await waitUntil(() => rows().length === 1, 8000, "the row");
    const headers = dayHeaders();
    expect(headers.map((h) => h.querySelector("h3")!.textContent)[0]).toBe("Today");
    expect(headers).toHaveLength(2);
    expect(plusOf(headers[0]!)!.getAttribute("aria-label")).toBe("Add to Today");
  });
});

/** `d` days back at 12:00 local. */
const pastNoon = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(12, 0, 0, 0);
  return t;
};

describe("the Today card's vitals", () => {
  const vitals = () =>
    document.querySelector<HTMLElement>('main [data-today-card] [data-today-row="vitals"]');
  const shown = () => {
    const s = vitals();
    return !!s && s.getBoundingClientRect().height > 0 && s.checkVisibility();
  };

  test("show at every width: 420 and 1280 (opened: the card starts collapsed)", async () => {
    await openTimeline({ width: 420 });
    await ready();
    const toggle = await found(() =>
      document.querySelector<HTMLElement>("main [data-today-card][data-collapsed] [data-today-toggle]"),
    );
    await userEvent.click(toggle);
    await waitUntil(shown, 4000, "the vitals row");
    await page.viewport(1280, 900);
    await frames();
    expect(shown()).toBe(true);
  });
});

describe("the care period in the day headers", () => {
  const daysAgo = (d: number, hour: number) => {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(hour, 0, 0, 0);
    return t;
  };
  const key = (d: Date) => d.toLocaleDateString("en-CA");
  /** In hospital from noon three days ago: the filler's days before that are outside any period. */
  const hospital = fx.period({ type: "hospital", startedAt: at(daysAgo(3, 12)) });
  const header = (day: Date) => document.getElementById(`day-${key(day)}`)?.closest("[data-day-header]");

  test("a day inside the period shows it in its sticky header; a day before it doesn't; the main header doesn't", async () => {
    await openTimeline({ fixtures: [...world(), hospital] });
    await ready();
    await waitUntil(
      () => !!header(daysAgo(0, 12))?.querySelector("[data-period-line]"),
      4000,
      "today's period",
    );

    for (const d of [0, 1, 3]) {
      const line = header(daysAgo(d, 12))!.querySelector<HTMLElement>("[data-period-line]");
      expect(line?.dataset.periodLine, `${d} days ago`).toBe(hospital.id);
      expect(line?.textContent).toMatch(/^In hospital · day \d+/);
    }
    expect(header(daysAgo(0, 12))!.querySelector("h3")!.textContent).toBe("Today");
    expect(getComputedStyle(header(daysAgo(0, 12))!).position).toBe("sticky");
    // Only today's header offers Change.
    expect(document.querySelectorAll("[data-period-change]")).toHaveLength(1);
    expect(header(daysAgo(0, 12))!.querySelector("[data-period-change]")).not.toBeNull();

    expect(header(daysAgo(4, 12))).toBeTruthy();
    expect(header(daysAgo(4, 12))!.querySelector("[data-period-line]")).toBeNull();

    // Nothing about the period above the list any more.
    expect(document.querySelectorAll("main [data-period-line]")).toHaveLength(
      document.querySelectorAll("[data-day-header] [data-period-line]").length,
    );
    expect(document.querySelector("main > header")!.textContent).not.toMatch(/hospital/i);
    expect(document.querySelector('[data-period-line="empty"]')).toBeNull();
  });
});
