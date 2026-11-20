import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { TEST_USER } from "../../../../../test/fixtures";
import {
  ER,
  field,
  FORM,
  HOME_FIRST,
  HOME_NOW,
  HOSPITAL,
  PERIOD_ROUTES,
  periodUrl,
  REHAB,
  SHEET,
  submit,
  track,
  typeRadio,
} from "../periods/periodWorld";
import { rows, setView, TIMELINE_ROUTES, TIMELINE_URL, waitUntil, world } from "./timelineWorld";

// The care period on the timeline (care-periods.mjs's timeline steps):
// today's header line with Change (writers), the add sheet from it and back
// to the same filtered timeline, the markers among the rows (under kind and
// author filters, in cards, for a viewer), the line and a marker opening the
// period, no line on a group without periods, and markers while scrolling
// back to the beginning. A day header's period is timelineHeader's; which
// markers a window shows is periodMarkers.test.ts's.

const ROUTES: DeviceRoute[] = [
  ...TIMELINE_ROUTES.filter((r) => !r.path.endsWith("/entries/:entryId")),
  ...PERIOD_ROUTES,
];

/** Ten older entries: the first page reaches the beginning, so every marker is in it. */
const open = (query = "", options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: `${TIMELINE_URL}${query}`,
    fixtures: [...world(10), ...track()],
    ...options,
  });

/** Today's header comes first. */
const lineText = () =>
  document.querySelector("main [data-day-header] [data-period-current]")?.textContent?.trim() ?? null;
const CHANGE = () => document.querySelector<HTMLAnchorElement>("main [data-period-change]");
const markerLi = (id: string) => document.querySelector<HTMLLIElement>(`main ol > li[data-marker="${id}"]`);

/** Every row of the history in DOM order: entries by their time, markers by their start. */
const listOrder = () =>
  [
    ...document.querySelectorAll<HTMLLIElement>('main section[aria-labelledby="timeline-heading"] ol > li'),
  ].map((li) => ({
    marker: li.dataset.marker ?? null,
    at: li.dataset.at ?? li.querySelector("time")?.dateTime ?? null,
    text: li.dataset.marker ? li.textContent?.trim() : null,
    label: li.dataset.marker ? li.querySelector("a")?.getAttribute("aria-label") : null,
    day: li.closest("section")?.querySelector("h3")?.textContent?.trim() ?? null,
  }));
/** Newest first all the way down: no row is newer than the one above it. */
const inOrder = (list: ReturnType<typeof listOrder>) =>
  list.every((r, i) => i === 0 || !r.at || !list[i - 1]!.at || new Date(r.at) <= new Date(list[i - 1]!.at!));

const ready = () => waitUntil(() => rows().length > 0, 8000, "the first rows");

describe("today's line", () => {
  test("names the current period with its day, links to it, and gives a writer Change; Change opens the add sheet, and saving comes back to the filtered timeline with the line and a marker for it under Today, read as one sentence", async () => {
    const device = await open("?kind=symptom");
    await ready();
    expect(lineText()).toMatch(/^At home · day \d+$/);
    expect(document.querySelector("main [data-period-current]")!.getAttribute("href")).toBe(
      periodUrl(HOME_NOW.id),
    );
    expect(CHANGE()).not.toBeNull();

    await userEvent.click(CHANGE()!);
    await waitUntil(() => !!FORM(), 4000, "the add sheet");
    expect(device.location()).toMatch(/\/periods\/new$/);
    await userEvent.click(typeRadio("Rehab or skilled nursing")!);
    await userEvent.fill(field("label")!, "Line stay");
    await userEvent.click(submit());

    await waitUntil(() => !SHEET() && lineText() === "In rehab · Line stay · day 1", 6000, "the new line");
    expect(device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    await device.settle();
    const [saved] = await device.query<{ id: string }>(
      "SELECT id FROM care_period WHERE label = 'Line stay'",
    );
    const id = saved!.id;
    await waitUntil(() => !!markerLi(id), 4000, "the new marker");
    const list = listOrder();
    const mine = list.find((r) => r.marker === id)!;
    expect(mine.day).toBe("Today");
    expect(mine.text).toMatch(/^Home → Rehab · Line stay · \d\d:\d\d$/);
    expect(mine.label).toMatch(/^Moved from Home to Rehab, Line stay, at \d\d:\d\d$/);
    expect(inOrder(list)).toBe(true);
  });

  test("the line opens its period", async () => {
    const device = await open();
    await ready();
    await userEvent.click(document.querySelector("main [data-period-current]")!);
    await expect.poll(device.location).toBe(periodUrl(HOME_NOW.id));
    await waitUntil(() => !!document.querySelector("main[data-period-page]"), 4000, "the period page");
  });

  test("a marker opens its period", async () => {
    const device = await open();
    await ready();
    await waitUntil(() => !!markerLi(HOME_NOW.id), 4000, "the marker");
    await userEvent.click(markerLi(HOME_NOW.id)!.querySelector("a")!);
    await expect.poll(device.location).toBe(periodUrl(HOME_NOW.id));
    await waitUntil(() => !!document.querySelector("main[data-period-page]"), 4000, "the period page");
  });
});

describe("the markers", () => {
  test("show under an author filter (a kind filter: above)", async () => {
    await open(`?author=${TEST_USER.id}`);
    await ready();
    await waitUntil(() => !!markerLi(HOME_NOW.id), 4000, "the marker under the author filter");
    expect(markerLi(HOME_NOW.id)!.textContent?.trim()).toMatch(/^Rehab → Home · 15:30$/);
  });

  test("show in cards", async () => {
    await open();
    await ready();
    await setView("Cards");
    await waitUntil(
      () => !!document.querySelector(`main ol[data-view="cards"] > li[data-marker="${HOME_NOW.id}"]`),
      4000,
      "the marker in cards",
    );
  });

  test("a viewer sees the line, with no Change, and the marker", async () => {
    await open("", { role: "viewer" });
    await ready();
    expect(lineText()).toMatch(/^At home · day \d+$/);
    expect(CHANGE()).toBeNull();
    expect(markerLi(HOME_NOW.id)).not.toBeNull();
  });
});

describe("a group with no periods", () => {
  test.each(["caretaker", "viewer"] as const)("a %s sees no period line and no markers", async (role) => {
    const device = await renderWithDevice({ route: ROUTES, url: TIMELINE_URL, fixtures: world(), role });
    await ready();
    await device.settle();
    expect(document.querySelector("main [data-period-line]")).toBeNull();
    expect(document.querySelector("main ol > li[data-marker]")).toBeNull();
  });
});

describe("scrolling back", () => {
  const END = "That's the beginning of the timeline";
  const LOADING = "Loading older…";
  const status = () => document.querySelector("[data-older-entries] [role=status]")?.textContent ?? "";

  test('the first page shows only markers at or after its oldest entry; scrolling back never shows one out of place; at the beginning every one shows, the first "Started: Home", the hospital\'s with its place and room', async () => {
    // Twenty days of entries: the first page ends inside the rehab stay.
    await open("", { fixtures: [...world(120), ...track()] });
    await ready();
    const first = listOrder();
    const oldest = first.filter((r) => !r.marker).at(-1)!.at!;
    expect(first.filter((r) => r.marker).every((r) => new Date(r.at!) >= new Date(oldest))).toBe(true);
    expect(first.some((r) => r.marker === HOME_FIRST.id)).toBe(false);
    expect(inOrder(first)).toBe(true);

    let outOfPlace: unknown = null;
    let samples = 0;
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const t = status();
      if (t !== LOADING) window.scrollTo(0, document.documentElement.scrollHeight);
      const list = listOrder();
      samples++;
      const low = list.filter((r) => !r.marker).at(-1)?.at;
      if (
        !outOfPlace &&
        (!inOrder(list) ||
          (t !== END && list.some((r) => r.marker && low && new Date(r.at!) < new Date(low))))
      )
        outOfPlace = { t, rows: list.length, low };
      if (t === END) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(status()).toBe(END);
    expect(outOfPlace).toBeNull();
    expect(samples).toBeGreaterThan(1);

    const all = listOrder().filter((r) => r.marker);
    expect(all.map((r) => r.marker)).toEqual([HOME_NOW.id, REHAB.id, HOSPITAL.id, ER.id, HOME_FIRST.id]);
    expect(all.at(-1)!.text).toBe("Started: Home");
    expect(all.find((r) => r.marker === HOSPITAL.id)!.text).toBe(
      "Emergency room → Hospital · Riverside General Hospital, room 412, bed B · 03:15",
    );
    expect(inOrder(listOrder())).toBe(true);
    await expect.element(page.getByText(END)).toBeVisible();
  });
});
