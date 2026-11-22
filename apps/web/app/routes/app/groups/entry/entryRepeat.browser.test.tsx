import type { Device } from "../../../../../test/device";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { fixClock, found } from "../../../../../test/found";
import { fx, series, TEST_GROUP } from "../../../../../test/fixtures";
import { laTime, NOW, PLANNER_ROUTES } from "../planner/plannerWorld";
import { renderWithDevice } from "../../../../../test/device";

// Repeating appointments on the test device (appointments-2,
// slice 1): the repeat field and its preview in a new appointment's sheet,
// saving a draft as a series offline (the series and every visit in one
// local transaction, queued for upload), no Repeat on a note, the repeat text
// on a visit's page (viewers too), and the repeat mark in the Planner, the
// timeline and the Today card. The rules themselves are repeatRule.test.ts's
// and seriesVisits.test.ts's; the upload is syncAppointmentSeries.int.test.ts's.
// The clock is the Planner tests': Wed 2026-11-18, 10:00 AM in Los Angeles.

const GROUP = TEST_GROUP.id;
const NEW_EVENT = `/app/groups/${GROUP}/entries/new?kind=event`;
const NEW_NOTE = `/app/groups/${GROUP}/entries/new?kind=note`;
const PLANNER = `/app/groups/${GROUP}/planner`;
const TIMELINE = `/app/groups/${GROUP}/timeline`;
const entryPath = (id: string) => `/app/groups/${GROUP}/entries/${id}`;
const ON_ENTRY = /\/entries\/([0-9a-f-]{36})$/;

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const REPEAT_BUTTON = () => $<HTMLButtonElement>("main [data-repeat-button]");
const FIELD = () => $("[data-repeat-field]");
const PRESET = () => $<HTMLSelectElement>('[data-repeat-field] select[name="repeat"]');
const PREVIEW_TEXT = () => $("[data-repeat-preview] [data-repeat-text]")?.textContent ?? null;
const PREVIEW_NEXT = () =>
  [...document.querySelectorAll("[data-repeat-next] li")].map((li) => li.textContent);
const PROBLEM = () => $("[data-repeat-problem]")?.textContent ?? null;
const sheetButton = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find(
    (b) => b.textContent?.trim() === text,
  );
const dayChip = (day: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("[data-repeat-field] button[aria-pressed]")].find(
    (b) => b.textContent === day,
  );
const pressedDays = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-repeat-field] button[aria-pressed="true"]')].map(
    (b) => b.textContent,
  );
const radio = (label: string) =>
  $<HTMLInputElement>(`[data-repeat-field] input[type=radio][aria-label="${label}"]`);
const TITLE = () => $<HTMLInputElement>("main header input");
const ENTRY_REPEAT_TEXT = () => $("main header [data-repeat-text]")?.textContent ?? null;

const open = (url: string, options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({ route: PLANNER_ROUTES, url, ...options });

const openRepeat = async () => {
  await userEvent.click(await found(REPEAT_BUTTON));
  await found(FIELD);
};

const choose = async (preset: string) => {
  await userEvent.selectOptions(await found(PRESET), preset);
};

const seriesRows = (device: Device) =>
  device.query(
    "SELECT id, kind, rule, starts_on, start_time, all_day, time_zone, title, topped_up_through FROM appointment_series",
  );
type VisitRow = { id: string; kind: string; title: string; ends_at: string | null; series_day: string };
const visitRows = (device: Device, seriesId: string) =>
  device.query<VisitRow>(
    "SELECT id, kind, title, occurred_at, ends_at, all_day, series_day, series_detached FROM timeline_entry WHERE series_id = ? ORDER BY series_day",
    [seriesId],
  );

beforeEach(() => fixClock(NOW));
afterEach(() => vi.useRealTimers());

describe("the repeat field", () => {
  test("previews each choice in words with the next three visits, and refuses a week with no days", async () => {
    const device = await open(NEW_EVENT);
    expect(REPEAT_BUTTON()!.getAttribute("aria-label")).toBe("Repeat: Doesn't repeat");
    await openRepeat();
    await expect.poll(() => PRESET()?.value).toBe("none");
    expect($("[data-repeat-preview]")).toBeNull();

    await choose("weekly");
    expect(pressedDays()).toEqual(["Wed"]);
    expect(PREVIEW_TEXT()).toBe("Every Wed at 10:00");
    expect(PREVIEW_NEXT()).toEqual([
      "Wed, Nov 18, 10:00 AM",
      "Wed, Nov 25, 10:00 AM",
      "Wed, Dec 2, 10:00 AM",
    ]);

    await userEvent.click(dayChip("Mon")!);
    await userEvent.click(dayChip("Fri")!);
    expect(PREVIEW_TEXT()).toBe("Every Mon, Wed, Fri at 10:00");
    expect(PREVIEW_NEXT()).toEqual([
      "Wed, Nov 18, 10:00 AM",
      "Fri, Nov 20, 10:00 AM",
      "Mon, Nov 23, 10:00 AM",
    ]);

    for (const day of ["Mon", "Wed", "Fri"]) await userEvent.click(dayChip(day)!);
    expect(PROBLEM()).toBe("Choose at least one day");
    expect(sheetButton("Done")!.getAttribute("aria-disabled")).toBe("true");

    await choose("monthly");
    expect(radio("On the 18th")!.checked).toBe(true);
    await userEvent.click(radio("On the 3rd Wednesday")!);
    expect(PREVIEW_TEXT()).toBe("Monthly on the 3rd Wednesday at 10:00");
    expect(PREVIEW_NEXT()).toEqual([
      "Wed, Nov 18, 10:00 AM",
      "Wed, Dec 16, 10:00 AM",
      "Wed, Jan 20, 10:00 AM",
    ]);

    await choose("custom");
    await userEvent.selectOptions($<HTMLSelectElement>('[data-repeat-field] select[name="unit"]')!, "daily");
    await userEvent.fill($<HTMLInputElement>('[data-repeat-field] input[name="interval"]')!, "3");
    await userEvent.click(radio("After a number of visits")!);
    await userEvent.fill($<HTMLInputElement>('[data-repeat-field] input[name="count"]')!, "12");
    expect(PREVIEW_TEXT()).toBe("Every 3 days at 10:00 · 12 visits");
    expect(PREVIEW_NEXT()).toEqual([
      "Wed, Nov 18, 10:00 AM",
      "Sat, Nov 21, 10:00 AM",
      "Tue, Nov 24, 10:00 AM",
    ]);

    await userEvent.click(radio("On a date")!);
    await userEvent.fill($<HTMLInputElement>('[data-repeat-field] input[name="until"]')!, "2026-11-30");
    expect(PREVIEW_TEXT()).toBe("Every 3 days at 10:00 · until 30 Nov");

    // Cancel keeps the draft as it was: nothing chosen, nothing written.
    await userEvent.click(sheetButton("Cancel")!);
    await expect.poll(() => FIELD()).toBeNull();
    expect(REPEAT_BUTTON()!.getAttribute("aria-label")).toBe("Repeat: Doesn't repeat");
    expect(await device.queued()).toEqual([]);
  });
});

describe("saving a series", () => {
  test("offline: the series and every visit through 90 days in one transaction, the draft its first visit, shown in the Planner with the mark", async () => {
    const device = await open(NEW_EVENT);
    await openRepeat();
    await choose("weekly");
    await userEvent.click(dayChip("Mon")!);
    await userEvent.click(dayChip("Fri")!);
    await userEvent.click(sheetButton("Done")!);
    await expect
      .poll(() => REPEAT_BUTTON()?.getAttribute("aria-label"))
      .toBe("Repeat: Every Mon, Wed, Fri at 10:00");
    // A repeat alone saves nothing, like a picked time.
    expect(await seriesRows(device)).toEqual([]);

    (await found(TITLE)).focus();
    await userEvent.keyboard("Dialysis{Enter}");
    await expect.poll(() => device.location(), { timeout: 5000 }).toMatch(ON_ENTRY);
    const entryId = ON_ENTRY.exec(device.location())![1]!;

    await expect.poll(async () => (await seriesRows(device)).length, { timeout: 5000 }).toBe(1);
    const [stored] = (await seriesRows(device)) as Record<string, unknown>[];
    expect(stored).toMatchObject({
      kind: "event",
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      starts_on: "2026-11-18",
      start_time: "10:00",
      all_day: 0,
      time_zone: "America/Los_Angeles",
      title: "Dialysis",
      topped_up_through: "2027-02-16",
    });
    const visits = await visitRows(device, stored!.id as string);
    expect(visits).toHaveLength(39);
    expect(visits[0]).toMatchObject({ id: entryId, series_day: "2026-11-18", title: "Dialysis" });
    expect(visits.map((v) => v.series_day).slice(1, 4)).toEqual(["2026-11-20", "2026-11-23", "2026-11-25"]);
    expect(visits.at(-1)!.series_day).toBe("2027-02-15");
    const docs = await device.query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM note_document WHERE id IN (SELECT id FROM timeline_entry WHERE series_id = ?)",
      [stored!.id],
    );
    expect(docs[0]!.n).toBe(39);

    // The upload queue has the series before its visits.
    const queued = await device.queued();
    const tables = queued.map((op) => op.type);
    expect(tables[0]).toBe("appointment_series");
    expect(tables.filter((t) => t === "timeline_entry")).toHaveLength(39);

    // The page is the first visit now, and says how it repeats.
    await expect.poll(ENTRY_REPEAT_TEXT).toBe("RepeatsEvery Mon, Wed, Fri at 10:00");
    expect(REPEAT_BUTTON()).toBeNull();

    // Back to the timeline, whose Today card has this series' next visit; then on to the Planner.
    const shown = (sel: string) => () =>
      [...document.querySelectorAll<HTMLElement>(sel)].find((el) => el.offsetParent) ?? null;
    const link = (href: string) => shown(`main a[href="${href}"]`);
    await userEvent.click(await found(link(TIMELINE)));
    // The card starts collapsed on every load: open it to reach its rows.
    await userEvent.click(await found(() => $('main [data-today-toggle][aria-expanded="false"]')));
    const next = await found(shown("main [data-next]"));
    expect(next.parentElement!.querySelector("[data-repeat-mark]")).not.toBeNull();
    await userEvent.click(await found(link(PLANNER)));
    await expect.poll(() => device.location()).toBe(PLANNER);
    await expect
      .poll(() => document.querySelectorAll("main [data-upcoming-item] [data-repeat-mark]").length, {
        timeout: 5000,
      })
      .toBeGreaterThan(10);
    const fridayRow = $(`main [data-upcoming-item="${visits[1]!.id}"]`)!;
    expect(fridayRow.textContent).toContain("Dialysis");
    expect(fridayRow.querySelector("[data-repeat-mark]")).not.toBeNull();
  });

  test("a note has no Repeat (a reminder is a todo)", async () => {
    await open(NEW_NOTE);
    await found(() => $('main header button[aria-label="Change when it happened"]'));
    await new Promise((r) => setTimeout(r, 300));
    expect(REPEAT_BUTTON()).toBeNull();
  });
});

describe("a series visit", () => {
  const DIALYSIS = series({ title: "Dialysis" });
  const visit = (days: number, day: string) =>
    fx.event({
      title: "Dialysis",
      occurredAt: laTime(days, 6),
      endsAt: laTime(days, 10),
      seriesId: DIALYSIS.id,
      seriesDay: day,
      text: "",
    });
  const FRIDAY = visit(2, "2026-11-20");
  const MONDAY = visit(5, "2026-11-23");
  const ONE_OFF = fx.event({ title: "Eye doctor", occurredAt: laTime(1, 13) });
  const world = () => [DIALYSIS, FRIDAY, MONDAY, ONE_OFF];

  test("its page says how it repeats; a one-off's doesn't, and a stored entry offers no Repeat", async () => {
    await open(entryPath(FRIDAY.id), { fixtures: world() });
    await expect.poll(ENTRY_REPEAT_TEXT).toBe("RepeatsEvery Mon, Wed, Fri at 6:00");
    expect(REPEAT_BUTTON()).toBeNull();
  });

  test("a viewer sees the repeat text and the marks, and no Repeat field", async () => {
    await open(entryPath(FRIDAY.id), { fixtures: world(), role: "viewer" });
    await expect.poll(ENTRY_REPEAT_TEXT).toBe("RepeatsEvery Mon, Wed, Fri at 6:00");
    expect(REPEAT_BUTTON()).toBeNull();
    expect(FIELD()).toBeNull();
  });

  test("a writer's stored one-off has no Repeat button", async () => {
    await open(entryPath(ONE_OFF.id), { fixtures: world() });
    await found(TITLE);
    expect(ENTRY_REPEAT_TEXT()).toBeNull();
    expect(REPEAT_BUTTON()).toBeNull();
  });

  test("carries the mark in the Planner and the Today card; a one-off doesn't", async () => {
    await open(PLANNER, { fixtures: world() });
    const row = (id: string) => $(`main [data-upcoming-item="${id}"]`);
    await found(() => row(FRIDAY.id));
    expect(row(FRIDAY.id)!.querySelector("[data-repeat-mark]")).not.toBeNull();
    expect(row(MONDAY.id)!.querySelector("[data-repeat-mark]")).not.toBeNull();
    expect(row(ONE_OFF.id)!.querySelector("[data-repeat-mark]")).toBeNull();
    expect(row(FRIDAY.id)!.querySelector("[data-repeat-mark]")!.textContent).toBe("Repeats");
  });

  test("carries the mark on a timeline row and in the Today card's next appointment", async () => {
    // Earlier today, so it's in the history; the next appointment is Friday's visit.
    const EARLIER = fx.event({
      title: "Dialysis",
      occurredAt: laTime(0, 6),
      endsAt: laTime(0, 9),
      seriesId: DIALYSIS.id,
      seriesDay: "2026-11-18",
      text: "",
    });
    await open(TIMELINE, { fixtures: [DIALYSIS, EARLIER, FRIDAY] });
    const timelineRow = await found(
      () =>
        [...document.querySelectorAll<HTMLElement>("main li")].find((li) =>
          li.querySelector(`a[href$="/entries/${EARLIER.id}"]`),
        ) ?? null,
    );
    expect(timelineRow.querySelector("[data-repeat-mark]")).not.toBeNull();
    const next = await found(() => $(`main [data-next="${FRIDAY.id}"]`));
    expect(next.parentElement!.querySelector("[data-repeat-mark]")).not.toBeNull();
  });
});
