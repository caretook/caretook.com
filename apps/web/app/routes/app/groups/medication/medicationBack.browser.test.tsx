import type { DeviceOptions, DeviceRoute } from "../../../../../test/device";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fixClock, found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { fx } from "../../../../../test/fixtures";
import * as search from "../search/route";
import {
  CLOCK,
  clockAt,
  GROUP,
  LIST,
  LISINOPRIL,
  MEDICATION_ROUTES,
  medicationUrl,
  SCHEDULE,
  SHEET,
  world,
} from "../medications/medicationWorld";

// The medication page's Back (B-699): it names the screen the page was
// opened from and goes back there, filters and search kept, even after a
// sheet opened over the page and closed; a direct load goes to the list.
// Which screens count and the state's checks are medicationOrigin.test.ts's.

/** Due a few minutes back on the fixed clock, so Schedule lists it with a link of its own. */
const DUE = fx.medication({
  name: "Donepezil",
  strength: "5 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ time: clockAt(-5) }] },
});

const ROUTES: DeviceRoute[] = [...MEDICATION_ROUTES, { path: "/app/groups/:groupId/search", module: search }];
const open = (url: string, options: Partial<DeviceOptions> = {}) =>
  renderWithDevice({ route: ROUTES, url, fixtures: [world(), DUE], search: true, ...options });

/** The page is up: its title and history. */
const onPage = () =>
  !!document.querySelector<HTMLElement>("main h1")?.textContent &&
  !!document.querySelector<HTMLElement>("main [data-medication-history]");
/** The page's Back link (the first link on it): its label and where it goes. */
const back = () => {
  const link = document.querySelector<HTMLAnchorElement>("main a");
  return link ? { label: link.textContent?.trim(), href: link.getAttribute("href") } : null;
};

beforeEach(() => {
  fixClock(CLOCK);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Back on a medication's page", () => {
  test("opened from Schedule, it says Schedule and returns there, after the edit sheet too", async () => {
    const device = await open(SCHEDULE);
    await userEvent.click(getByCss(`main [data-slot^="${DUE.id}@"] a`));
    await expect.poll(device.location).toBe(medicationUrl(DUE.id));
    await waitUntil(onPage, "the page");
    expect(back()).toEqual({ label: "Schedule", href: SCHEDULE });

    // A sheet over the page, closed again: Back still knows.
    await userEvent.click(getByCss("main [data-edit-medication]"));
    await found(SHEET);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(medicationUrl(DUE.id));
    await waitUntil(onPage, "the page again");
    await expect.poll(back).toEqual({ label: "Schedule", href: SCHEDULE });

    await userEvent.click(page.getByRole("link", { name: "Schedule", exact: true }));
    await expect.poll(device.location).toBe(SCHEDULE);
    await found(() => document.querySelector<HTMLElement>(`main [data-slot^="${DUE.id}@"]`));
  });

  test("opened from search, it says Search and returns to the same search", async () => {
    const results = `/app/groups/${GROUP}/search?q=Lisinopril`;
    const device = await open(results);
    const link = await found(() =>
      document.querySelector<HTMLAnchorElement>(
        `[data-result="medication"][data-result-id="${LISINOPRIL.id}"] a`,
      ),
    );
    await userEvent.click(link);
    await expect.poll(device.location).toBe(medicationUrl(LISINOPRIL.id));
    await waitUntil(onPage, "the page");
    expect(back()).toEqual({ label: "Search", href: results });

    await userEvent.click(page.getByRole("link", { name: "Search", exact: true }));
    await expect.poll(device.location).toBe(results);
    await found(() =>
      document.querySelector<HTMLElement>(`[data-result="medication"][data-result-id="${LISINOPRIL.id}"]`),
    );
  });

  test("opened from the filtered list, it says Medications and keeps the filter", async () => {
    const filtered = `${LIST}?status=current`;
    const device = await open(filtered);
    await userEvent.click(getByCss(`main [data-medication-id="${LISINOPRIL.id}"] a[data-medication-name]`));
    await expect.poll(device.location).toBe(medicationUrl(LISINOPRIL.id));
    await waitUntil(onPage, "the page");
    expect(back()).toEqual({ label: "Medications", href: filtered });
  });

  test("a direct load says Medications and goes to the list", async () => {
    const device = await open(medicationUrl(LISINOPRIL.id));
    await waitUntil(onPage, "the page");
    expect(back()).toEqual({ label: "Medications", href: LIST });
    await userEvent.click(page.getByRole("link", { name: "Medications", exact: true }));
    await expect.poll(device.location).toBe(LIST);
  });
});
