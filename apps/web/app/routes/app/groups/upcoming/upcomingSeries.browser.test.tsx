import type { Device } from "../../../../../test/device";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { fx, series } from "../../../../../test/fixtures";
import {
  dialogButton,
  entryUrl,
  fixClock,
  itemEl,
  laTime,
  menuItem,
  menuItems,
  openUpcoming,
  TIMELINE_URL,
} from "./upcomingWorld";

// Editing a series on the test device (appointments-2, slice 2): the
// SeriesScopeDialog before Edit, Cancel, Reschedule and Delete on a series
// visit's ⋯ (Upcoming, the timeline and the entry page), and before an edit
// typed on a visit's page; both choices of each; the series sheet for "This
// and later". Every write is local. The plans themselves are
// seriesEdit.test.ts's; the upload of a split is syncSeriesEdit.int.test.ts's.
// The clock is Upcoming's: Wed 2026-11-18, 10:00 AM in Los Angeles.

const ACTIONS = 'button[aria-label^="Actions for"]';
const ENTRY_MENU = 'main header [data-region="actions"] button[aria-label^="Actions for"]';
const SCOPE = () => document.querySelector<HTMLDialogElement>("dialog[open][data-series-scope]");
const SHEET = () => document.querySelector<HTMLFormElement>("[data-series-edit]");
const TITLE = () => document.querySelector<HTMLInputElement>("main header input");

/** Dialysis, Mon Wed Fri 6:00 for 4 h, since Mon 16 Nov, with its visits through Fri 27 Nov. */
const DIALYSIS = series({ startsOn: "2026-11-16", title: "Dialysis" });
const visit = (days: number, day: string) =>
  fx.event({
    title: "Dialysis",
    occurredAt: laTime(days, 6),
    endsAt: laTime(days, 10),
    seriesId: DIALYSIS.id,
    seriesDay: day,
    text: "",
  });
const MON_16 = visit(-2, "2026-11-16");
const WED_18 = visit(0, "2026-11-18"); // 6:00 today: already started.
const FRI_20 = visit(2, "2026-11-20");
const MON_23 = visit(5, "2026-11-23");
const WED_25 = visit(7, "2026-11-25");
const FRI_27 = visit(9, "2026-11-27");
const SERIES = [DIALYSIS, MON_16, WED_18, FRI_20, MON_23, WED_25, FRI_27];

type Row = {
  id: string;
  title: string | null;
  occurred_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  series_id: string | null;
  series_day: string | null;
  series_detached: number | null;
  deleted_at: string | null;
};
const entry = async (device: Device, id: string) =>
  (await device.query<Row>("SELECT * FROM timeline_entry WHERE id = ?", [id]))[0]!;
const ruleOf = async (device: Device, id: string) =>
  (
    await device.query<{ rule: string; deleted_at: string | null }>(
      "SELECT rule, deleted_at FROM appointment_series WHERE id = ?",
      [id],
    )
  )[0]!;
const seriesCount = async (device: Device) =>
  (await device.query<{ n: number }>("SELECT COUNT(*) AS n FROM appointment_series"))[0]!.n;

const openMenu = async (button: Element | null | undefined) => {
  await userEvent.click(button!);
  await expect.poll(() => menuItems().length).toBeGreaterThan(0);
  return menuItems();
};
const rowMenu = async (id: string) => openMenu(await found(() => itemEl(id)?.querySelector(ACTIONS) ?? null));
/** Pick a menu item, then a choice in the scope dialog. */
const pick = async (item: string, choice: "Only this visit" | "This and later visits" | "Cancel") => {
  await userEvent.click(menuItem(item)!);
  await found(SCOPE);
  await userEvent.click(dialogButton(choice)!);
  await expect.poll(SCOPE).toBeNull();
};
const confirmReason = async (reason: string) => {
  const input = await found(() =>
    document.querySelector<HTMLInputElement>("dialog[open] [data-cancel-reason]"),
  );
  await userEvent.fill(input, reason);
  await userEvent.click(dialogButton("Cancel event")!);
  await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
};

beforeEach(() => fixClock());
afterEach(() => vi.useRealTimers());

describe("the scope dialog in Upcoming", () => {
  test("a series visit's ⋯ starts with Edit; a viewer's has neither Edit nor a dialog", async () => {
    const device = await openUpcoming({ extra: SERIES });
    expect(await rowMenu(FRI_20.id)).toEqual([
      "Edit",
      "Prepare for this visit",
      "Reschedule",
      "Cancel event",
      "Print",
      "Delete",
    ]);
    await userEvent.keyboard("{Escape}");
    await device.screen.unmount();

    await openUpcoming({ extra: SERIES, role: "viewer" });
    expect(await rowMenu(FRI_20.id)).toEqual(["Print"]);
    expect(SCOPE()).toBeNull();
  });

  test("Cancel in the dialog changes nothing", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(FRI_20.id);
    await pick("Delete", "Cancel");
    expect((await entry(device, FRI_20.id)).deleted_at).toBeNull();
    expect(await device.queued()).toEqual([]);
  });

  test("Delete, only this visit: that visit goes at once (the dialog was the confirm), the rest stay", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(FRI_20.id);
    await pick("Delete", "Only this visit");
    await device.settle();
    await expect.poll(() => itemEl(FRI_20.id)).toBeNull();
    expect(itemEl(MON_23.id)).not.toBeNull();
    expect((await ruleOf(device, DIALYSIS.id)).rule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR");
    expect(document.querySelector("dialog[open]")).toBeNull();
  });

  test("Delete, this and later: the series ends the day before, and this and later visits go", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(MON_23.id);
    await pick("Delete", "This and later visits");
    await device.settle();
    await expect
      .poll(async () => (await ruleOf(device, DIALYSIS.id)).rule)
      .toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261122");
    for (const v of [MON_23, WED_25, FRI_27]) expect((await entry(device, v.id)).deleted_at).not.toBeNull();
    expect((await entry(device, FRI_20.id)).deleted_at).toBeNull();
    await expect.poll(() => itemEl(WED_25.id)).toBeNull();
    expect(itemEl(FRI_20.id)).not.toBeNull();
  });

  test("Cancel, only this visit: the reason, then that visit cancelled and detached", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(FRI_20.id);
    await pick("Cancel event", "Only this visit");
    await confirmReason("Clinic closed");
    await device.settle();
    expect(await entry(device, FRI_20.id)).toMatchObject({
      cancel_reason: "Clinic closed",
      series_detached: 1,
      series_id: DIALYSIS.id,
    });
    expect((await entry(device, MON_23.id)).cancelled_at).toBeNull();
  });

  test("Cancel, this and later: this visit cancelled, later ones gone, the series ended", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(WED_25.id);
    await pick("Cancel event", "This and later visits");
    await confirmReason("PT finished");
    await device.settle();
    await expect
      .poll(async () => (await ruleOf(device, DIALYSIS.id)).rule)
      .toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261124");
    expect(await entry(device, WED_25.id)).toMatchObject({
      cancel_reason: "PT finished",
      series_detached: 1,
    });
    expect((await entry(device, FRI_27.id)).deleted_at).not.toBeNull();
    expect((await entry(device, MON_23.id)).cancelled_at).toBeNull();
  });

  test("Reschedule: only this visit opens the reschedule sheet, this and later the series sheet", async () => {
    await openUpcoming({ extra: SERIES });
    await rowMenu(FRI_20.id);
    await pick("Reschedule", "Only this visit");
    await expect
      .poll(() => document.querySelector("[data-reschedule-sheet]"), { timeout: 5000 })
      .not.toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector("[data-reschedule-sheet]")).toBeNull();

    await rowMenu(FRI_20.id);
    await pick("Reschedule", "This and later visits");
    await found(SHEET);
  });

  test("Reschedule, only this visit, just moving it: that visit moves a day and is detached; the rest stay", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(FRI_20.id);
    await pick("Reschedule", "Only this visit");
    const sheet = await found(() => document.querySelector<HTMLFormElement>("[data-reschedule-sheet]"), {
      timeout: 5000,
    });
    sheet.querySelector<HTMLElement>('[data-type="day"]')!.focus();
    await userEvent.keyboard("{ArrowUp}");
    const keep = sheet.querySelector<HTMLInputElement>("[data-keep-old]")!;
    if (keep.checked) await userEvent.click(keep);
    await userEvent.click(sheet.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await expect.poll(() => document.querySelector("[data-reschedule-sheet]"), { timeout: 5000 }).toBeNull();
    await device.settle();
    const moved = await entry(device, FRI_20.id);
    expect(moved).toMatchObject({ series_id: DIALYSIS.id, series_day: "2026-11-20", series_detached: 1 });
    expect(moved.occurred_at).toMatch(/^2026-11-21/);
    expect((await entry(device, MON_23.id)).series_detached).not.toBe(1);
  });

  test("Edit, this and later: the sheet prefilled; a new time moves this and later visits onto a new series", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(FRI_20.id);
    await pick("Edit", "This and later visits");
    const sheet = await found(SHEET);
    const field = (name: string) => sheet.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    expect(field("title").value).toBe("Dialysis");
    expect(field("startTime").value).toBe("06:00");
    expect(field("endTime").value).toBe("10:00");
    expect(sheet.querySelector<HTMLSelectElement>('select[name="repeat"]')!.value).toBe("weekly");
    expect(sheet.querySelector("[data-repeat-text]")?.textContent).toBe("Every Mon, Wed, Fri at 6:00");

    await userEvent.fill(field("startTime"), "07:00");
    await userEvent.fill(field("endTime"), "11:00");
    await userEvent.click([...sheet.querySelectorAll("button")].find((b) => b.textContent === "Save")!);
    await expect.poll(SHEET, { timeout: 5000 }).toBeNull();
    await device.settle();

    expect(await seriesCount(device)).toBe(2);
    expect((await ruleOf(device, DIALYSIS.id)).rule).toBe(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261119",
    );
    const moved = await entry(device, FRI_20.id);
    expect(moved.series_id).not.toBe(DIALYSIS.id);
    expect(moved.series_day).toBe("2026-11-20");
    // 7:00 in Los Angeles is 15:00 UTC.
    expect(moved.occurred_at).toMatch(/^2026-11-20[T ]15:00/);
    expect((await entry(device, MON_23.id)).series_id).toBe(moved.series_id);
    // Past visits stay on the old series, as they were.
    expect(await entry(device, WED_18.id)).toMatchObject({ series_id: DIALYSIS.id });
    expect((await entry(device, WED_18.id)).occurred_at).toMatch(/^2026-11-18[T ]14:00/);
    await expect
      .poll(() => itemEl(MON_23.id)?.querySelector("[data-when]")?.textContent ?? "")
      .toMatch(/7:00/);
  });
});

describe("on the timeline", () => {
  test("an upcoming visit's ⋯ asks; one that has started doesn't (the plain confirm)", async () => {
    await openUpcoming({ url: TIMELINE_URL, extra: SERIES });
    const rowOf = (id: string) =>
      [...document.querySelectorAll<HTMLElement>("main li")].find((li) =>
        li.querySelector(`a[href$="/entries/${id}"]`),
      ) ?? null;
    await openMenu(await found(() => rowOf(WED_18.id)?.querySelector(ACTIONS) ?? null));
    expect(menuItems()).not.toContain("Edit");
    await userEvent.click(menuItem("Delete")!);
    await expect
      .poll(() => document.querySelector("dialog[open]")?.textContent ?? "")
      .toContain("Delete this entry?");
    expect(SCOPE()).toBeNull();
  });
});

describe("on a visit's page", () => {
  test("renaming asks: Cancel puts the title back, only this visit renames it alone and detaches it", async () => {
    const device = await openUpcoming({ url: entryUrl(FRI_20.id), extra: SERIES });
    const title = await found(TITLE);
    await userEvent.fill(title, "Dialysis, chair 4");
    await userEvent.keyboard("{Enter}");
    await found(SCOPE);
    expect(SCOPE()!.textContent).toContain("Change a repeating appointment");
    await userEvent.click(dialogButton("Cancel")!);
    await expect.poll(() => TITLE()?.value).toBe("Dialysis");
    expect(await device.queued()).toEqual([]);

    await userEvent.fill(TITLE()!, "Dialysis, chair 4");
    await userEvent.keyboard("{Enter}");
    await found(SCOPE);
    await userEvent.click(dialogButton("Only this visit")!);
    await device.settle();
    await expect
      .poll(async () => entry(device, FRI_20.id))
      .toMatchObject({ title: "Dialysis, chair 4", series_detached: 1 });
    expect((await entry(device, MON_23.id)).title).toBe("Dialysis");

    // Detached, its own edits don't ask again.
    await userEvent.fill(TITLE()!, "Dialysis, chair 5");
    await userEvent.keyboard("{Enter}");
    await expect.poll(async () => (await entry(device, FRI_20.id)).title).toBe("Dialysis, chair 5");
    expect(SCOPE()).toBeNull();
  });

  test("renaming, this and later: later visits take the new title, earlier ones keep theirs", async () => {
    const device = await openUpcoming({ url: entryUrl(MON_23.id), extra: SERIES });
    await userEvent.fill(await found(TITLE), "Dialysis, chair 4");
    await userEvent.keyboard("{Enter}");
    await found(SCOPE);
    await userEvent.click(dialogButton("This and later visits")!);
    await device.settle();
    await expect.poll(async () => (await entry(device, FRI_27.id)).title).toBe("Dialysis, chair 4");
    expect(await entry(device, MON_23.id)).toMatchObject({ title: "Dialysis, chair 4", series_detached: 0 });
    expect((await entry(device, FRI_20.id)).title).toBe("Dialysis");
  });

  test("Edit, only this visit from a row: the page opens and its edits don't ask", async () => {
    const device = await openUpcoming({ extra: SERIES });
    await rowMenu(FRI_20.id);
    await pick("Edit", "Only this visit");
    await expect.poll(() => device.location()).toBe(entryUrl(FRI_20.id));
    await userEvent.fill(await found(TITLE), "Dialysis (late chair)");
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(async () => entry(device, FRI_20.id))
      .toMatchObject({ title: "Dialysis (late chair)", series_detached: 1 });
    expect(SCOPE()).toBeNull();
  });

  test("the page's ⋯: Delete, this and later ends the series and goes back to the timeline", async () => {
    const device = await openUpcoming({ url: entryUrl(WED_25.id), extra: SERIES });
    await openMenu(await found(() => document.querySelector(ENTRY_MENU)));
    await pick("Delete", "This and later visits");
    await expect.poll(() => device.location(), { timeout: 5000 }).toBe(TIMELINE_URL);
    expect((await ruleOf(device, DIALYSIS.id)).rule).toBe(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261124",
    );
    expect((await entry(device, FRI_27.id)).deleted_at).not.toBeNull();
  });

  test("a viewer's page asks nothing and offers no Edit", async () => {
    await openUpcoming({ url: entryUrl(FRI_20.id), extra: SERIES, role: "viewer" });
    expect(await openMenu(await found(() => document.querySelector(ENTRY_MENU)))).toEqual(["Print"]);
  });
});
