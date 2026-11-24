import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { todo } from "../../../../../test/fixtures";
import { fixClock } from "../../../../../test/found";
import { LIST, MEDICATION_ROUTES } from "../medications/medicationWorld";
import { PROVIDER_ROUTES, PROVIDERS_URL } from "../providers/providerWorld";
import {
  listed,
  NOW,
  openPlanner,
  PAST_URL,
  PLANNER_URL,
  PODIATRY,
  SAM,
  THERAPY,
  TODOS_URL,
} from "./plannerWorld";

// Every list page's search and filter bar (B-680): the same bar on
// medications, providers, the Planner's tabs and Todos; on the Planner it acts
// on the open tab only, and typed text doesn't carry to another tab. Past's
// text is matched over every past event, not only the loaded page.

const BAR = "main [data-search-filter-bar]";
const box = () => document.querySelector<HTMLInputElement>(`${BAR} input[type="search"]`);
const filterButton = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
const TABS = 'main nav[aria-label="Upcoming, past or todos"]';
const tab = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>(`${TABS} a`)].find(
    (a) => a.textContent?.trim() === label,
  )!;
const type = async (text: string) => {
  await userEvent.clear(page.getByRole("searchbox"));
  await userEvent.type(page.getByRole("searchbox"), text);
};

/** How the bar is built: one search form filling a row with the Filter button at its end. */
const barShape = () => {
  const bars = document.querySelectorAll(BAR);
  const bar = bars[0]!;
  const row = bar.firstElementChild!;
  return {
    bars: bars.length,
    row: [...row.children].map((c) => c.tagName + (c.getAttribute("role") ?? "")),
    placeholder: box()?.placeholder,
    rowClass: row.className,
    formClass: row.firstElementChild?.className,
    filterLast: row.lastElementChild?.hasAttribute("data-filter-button"),
  };
};

beforeEach(() => fixClock(NOW));
afterEach(() => {
  vi.useRealTimers();
});

describe("one search and filter bar", () => {
  test("the same bar renders on medications, providers, the Planner's three tabs and Todos", async () => {
    const shapes = [];
    for (const [route, url] of [
      [MEDICATION_ROUTES, LIST],
      [PROVIDER_ROUTES, PROVIDERS_URL],
    ] as const) {
      const device = await renderWithDevice({ route, url, fixtures: [] });
      await expect.element(filterButton()).toBeVisible();
      shapes.push(barShape());
      await device.screen.unmount();
    }
    for (const url of [PLANNER_URL, PAST_URL, TODOS_URL]) {
      const device = await openPlanner({ url });
      await expect.element(filterButton()).toBeVisible();
      // Below the tabs.
      const tabs = document.querySelector(TABS)!.getBoundingClientRect();
      const barTop = document.querySelector(BAR)?.getBoundingClientRect().top ?? -1;
      expect(barTop).toBeGreaterThanOrEqual(tabs.bottom);
      shapes.push(barShape());
      await device.screen.unmount();
    }
    expect(shapes).toHaveLength(5);
    for (const shape of shapes) expect(shape).toEqual(shapes[0]);
    expect(shapes[0]).toMatchObject({
      bars: 1,
      row: ["FORMsearch", "BUTTON"],
      placeholder: "Type to search",
    });
    expect(shapes[0]?.filterLast).toBe(true);
  });
});

describe("the Planner's text", () => {
  test("Past's text finds an event older than the loaded page, case and accents ignored, and its author filter works", async () => {
    const device = await openPlanner({ url: PAST_URL });
    expect(listed().some((r) => r.text.includes("Older visit 29"))).toBe(false);
    await type("OLDER VÍSIT 29");
    await expect.poll(() => listed().map((r) => r.text.includes("Older visit 29"))).toEqual([true]);
    expect(new URL(device.location(), "https://x.test").searchParams.get("q")).toBe("OLDER VÍSIT 29");

    // By Sam: the text still on, nothing of Sam's matches; the empty state names both.
    await userEvent.click(filterButton());
    await userEvent.click(page.getByRole("menuitemradio", { name: "Sam Okafor", exact: true }));
    await expect.poll(() => device.location()).toContain(`author=${SAM.id}`);
    await expect
      .element(page.getByText("No past events by Sam Okafor matching “OLDER VÍSIT 29”."))
      .toBeVisible();
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");

    await userEvent.clear(page.getByRole("searchbox"));
    await expect.poll(() => listed().map((r) => r.id)).toEqual([PODIATRY.id]);
    await userEvent.click(page.getByRole("link", { name: "By Sam Okafor: clear this filter" }));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.poll(() => listed().length).toBeGreaterThan(3);
  });

  test("Upcoming filters its events and todos; switching tabs clears the text; a filtered empty list says so", async () => {
    const device = await openPlanner({
      extra: [todo({ title: "Fax the therapy form", dueOn: "2026-11-19" })],
    });
    await type("therapy");
    await expect.poll(() => listed().map((r) => r.id)).toEqual([THERAPY.id]);
    await expect.poll(() => document.querySelectorAll("main [data-planner-todo]").length).toBe(1);

    await type("zzz");
    await expect.element(page.getByText("No upcoming events or todos matching “zzz”.")).toBeVisible();

    await userEvent.click(tab("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.poll(() => box()?.value).toBe("");
    await expect.poll(() => listed().length).toBeGreaterThan(3);

    await type("hearing");
    await userEvent.click(tab("Todos"));
    await expect.poll(() => device.location()).toBe(TODOS_URL);
    await expect.poll(() => box()?.value).toBe("");
    await expect.element(page.getByText("Fax the therapy form")).toBeVisible();

    await type("nothing like it");
    await expect.element(page.getByText("No open todos matching “nothing like it”.")).toBeVisible();
    await userEvent.click(tab("Upcoming"));
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await expect.poll(() => box()?.value).toBe("");
  });
});
