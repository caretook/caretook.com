import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx } from "../../../../../test/fixtures";
import { frames, openTimeline, rows, TIMELINE_URL, waitUntil, world } from "./timelineWorld";

// The timeline's header on a phone and a desktop (quick-fixes slice 39): the
// + menu in place of the quick-add bar, the latest vitals only from `sm`,
// and the care period in each day's sticky header instead of the page's.

const ready = () => waitUntil(() => rows().length > 0, 8000, "the first rows");
const addButton = () => page.getByRole("button", { name: "Add to timeline" });
const menuItems = () => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')];
const pick = async (name: string) => {
  await userEvent.click(addButton());
  await expect.element(page.getByRole("menu")).toBeVisible();
  await userEvent.click(page.getByRole("menuitem", { name, exact: true }));
};

describe("the + menu", () => {
  test("a writer's + opens every add kind in the bar's order, with each vital type; there's no add bar", async () => {
    await openTimeline({ role: "caretaker" });
    await ready();
    expect(document.querySelector('[aria-label="Add to the timeline"]')).toBeNull();
    await userEvent.click(addButton());
    await expect.element(page.getByRole("menu", { name: "Add to timeline" })).toBeVisible();
    expect(menuItems().map((el) => el.textContent?.trim())).toEqual([
      "Note",
      "Event",
      "Dose",
      "Symptom",
      ...VITAL_TYPES.map((t) => VITALS[t].label),
    ]);
    await userEvent.keyboard("{Escape}");
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

  test("a viewer sees no + button", async () => {
    await openTimeline({ role: "viewer" });
    await ready();
    expect(page.getByRole("button", { name: "Add to timeline" }).query()).toBeNull();
    expect(page.getByRole("group", { name: "Layout" }).query()).not.toBeNull();
  });
});

describe("latest vitals", () => {
  const strip = () => document.querySelector<HTMLElement>('section[aria-labelledby="latest-vitals"]');
  const shown = () => {
    const s = strip();
    return !!s && s.getBoundingClientRect().height > 0 && getComputedStyle(s).display !== "none";
  };

  test("at 420 there's no latest-vitals strip; at 1280 it shows", async () => {
    await openTimeline({ width: 420 });
    await ready();
    expect(strip()).not.toBeNull();
    expect(shown()).toBe(false);
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
