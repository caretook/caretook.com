import type { Route } from "./+types/route";
import type { DeviceRoute } from "../../../../../test/device";

import { useLayoutEffect } from "react";
import { useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createCarePeriod, removeCarePeriod, updateCarePeriod } from "~/lib/care-periods/carePeriods.sync";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx } from "../../../../../test/fixtures";
import * as periods from "./route";
import {
  daysAgo,
  ER,
  errorOf,
  field,
  FORM,
  formButton,
  GROUP,
  HOME_FIRST,
  HOME_NOW,
  HOSPITAL,
  listRows,
  PERIOD_ROUTES,
  PERIODS_URL,
  pickerChip,
  pickPlace,
  REHAB,
  SHEET,
  submit,
  track,
  TRACK_SQL,
  typeRadio,
  waitUntil,
} from "./periodWorld";

// The periods page and its add sheet (care-periods.mjs's list, add, earlier,
// offline, tie and viewer steps): the track newest first with Now, adding
// with a new place typed in the picker (one local transaction), Other's
// label, the URL's prefills, a date-only start slotting into the track, the
// device refusing a future start and a viewer's writes, two periods with one
// start, and a viewer's list and sheet URL. The device is offline
// throughout, so every write here is an offline write. Another device
// receiving a period is roundtrip.mjs's sync matrix (6b); the server's rules
// are carePeriod.int.test.ts's and syncCarePeriods.int.test.ts's.

/** Back (history −1), as the browser's button does. */
let back = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => void navigate(-1);
  }, [navigate]);
  return null;
}
function PeriodsWithBack(props: Route.ComponentProps) {
  const Periods = periods.default;
  return (
    <>
      <BackProbe />
      <Periods {...props} />
    </>
  );
}
const ROUTES: DeviceRoute[] = [
  { ...PERIOD_ROUTES[0]!, module: { ...periods, default: PeriodsWithBack } },
  ...PERIOD_ROUTES.slice(1),
];

const open = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: ROUTES, url: PERIODS_URL, fixtures: track(), ...options });

const ADD = () => document.querySelector<HTMLAnchorElement>("main a[data-add-period]");
const listed = (text: string) => listRows().find((r) => r.title?.includes(text));
const LA = "America/Los_Angeles";
const dayOf = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: LA, month: "short", day: "numeric" }).format(d);

describe("the periods page", () => {
  test("lists the track newest first: only the latest is Now; the hospital shows its place and room, until its end; a date-only start has no time", async () => {
    await open();
    await expect.poll(() => listRows().length).toBe(5);
    const rows = listRows();
    expect(rows.map((r) => r.title)).toEqual([
      "Home",
      "Rehab · Oak Hills Rehab",
      "Hospital · Cardiac unit (4 West)",
      "Emergency room · Riverside ER",
      "Home",
    ]);
    expect(rows.map((r) => r.current)).toEqual([true, false, false, false, false]);
    expect(rows[0]!.dates).toMatch(/– now · day \d+$/);
    const hospital = rows.find((r) => r.id === HOSPITAL.id)!;
    expect(hospital.place).toBe("Riverside General Hospital, Room 412, bed B");
    expect(hospital.dates).toMatch(/^\w{3} \d+, 03:15 – until \w{3} \d+ · 7 days$/);
    const first = rows.at(-1)!;
    expect(first.id).toBe(HOME_FIRST.id);
    expect(first.dates).toMatch(/^\w{3} \d+(, \d{4})? – until/);
    expect(first.dates.split("–")[0]).not.toMatch(/\d:\d/);
    // Each row opens its period.
    const link = document.querySelector(`[data-period="${HOSPITAL.id}"] a`)!;
    expect(link.getAttribute("href")).toBe(`${PERIODS_URL}/${HOSPITAL.id}`);
  });

  test("a group with no periods says so, and a writer gets Add period", async () => {
    await open({ fixtures: [] });
    await expect.element(page.getByText(/^No care periods yet\. Add where care is now/)).toBeVisible();
    expect(ADD()).not.toBeNull();
  });
});

describe("adding a period", () => {
  test("Add period opens the sheet over the list; Other needs a label; a new place from the picker; saving lists it first as Now with its place and room, ends the one before, and writes the place with it in one transaction", async () => {
    const device = await open();
    await userEvent.click(ADD()!);
    await waitUntil(() => !!FORM(), 4000, "the add sheet");
    expect(device.location()).toBe(`${PERIODS_URL}/new`);
    expect(document.querySelector("main [data-period-list]")).not.toBeNull();

    // Other with no label: the field says so.
    await userEvent.click(typeRadio("Other")!);
    await userEvent.click(submit());
    await expect.poll(() => errorOf("label")).toBe("Say what this is");

    await userEvent.click(typeRadio("Hospital")!);
    await userEvent.fill(field("label")!, "Ward 7");
    await pickPlace("Lakeview Medical", 'Add "Lakeview Medical" as a new place');
    await expect.poll(pickerChip).toBe("Lakeview Medical (new)");
    await userEvent.fill(field("placeDetail")!, "Room 7");
    await userEvent.click(submit());

    await expect.poll(() => !SHEET() && device.location()).toBe(PERIODS_URL);
    await device.settle();
    const [top, previous] = listRows();
    expect(top).toMatchObject({
      title: "Hospital · Ward 7",
      current: true,
      place: "Lakeview Medical, Room 7",
    });
    expect(top!.dates).toMatch(/– now · day 1$/);
    expect(previous).toMatchObject({ id: HOME_NOW.id, current: false });
    expect(previous!.dates).toMatch(/until/);

    // The place is a practice in the directory, written first, in the period's transaction.
    const crud = await device.query<{ tx_id: number; data: string }>(
      "SELECT tx_id, data FROM ps_crud ORDER BY id",
    );
    const ops = crud.map((r) => ({
      tx: r.tx_id,
      ...(JSON.parse(r.data) as { type: string; id: string; data: Record<string, unknown> }),
    }));
    expect(ops.map((o) => o.type)).toEqual(["provider", "care_period"]);
    expect(ops[0]!.tx).toBe(ops[1]!.tx);
    expect(ops[0]!.data).toMatchObject({ type: "practice", name: "Lakeview Medical" });
    expect(ops[1]!.data).toMatchObject({
      type: "hospital",
      label: "Ward 7",
      place_detail: "Room 7",
      place_provider_id: ops[0]!.id,
    });
  });

  test("Cancel, Escape and Back each close it onto the list, writing nothing", async () => {
    const device = await open();
    const closes: [string, () => Promise<void>][] = [
      ["Cancel", () => userEvent.click(formButton("Cancel"))],
      ["Escape", () => userEvent.keyboard("{Escape}")],
      ["Back", () => Promise.resolve(back())],
    ];
    for (const [how, close] of closes) {
      // The list (and Add) can render after open(), or after a close, on a loaded machine.
      await waitUntil(() => !!ADD(), 4000, `Add before ${how}`);
      await userEvent.click(ADD()!);
      await waitUntil(() => !!FORM(), 4000, `the sheet before ${how}`);
      await close();
      await expect.poll(() => !SHEET() && device.location(), { message: how }).toBe(PERIODS_URL);
    }
    expect(await device.queued()).toEqual([]);
  });

  test("the URL's type and date-only prefills fill the sheet; an earlier date-only period slots into the track by its start, with no time, and the period before it ends that day; a deep link closes to the list", async () => {
    // A week back: between the rehab stay (12 days back) and the current Home (5 days back).
    const start = daysAgo(7);
    const device = await open({
      url: `${PERIODS_URL}/new?type=rehab&startedAt=${encodeURIComponent(start.toISOString())}&dateOnly=1`,
    });
    await waitUntil(() => !!FORM(), 4000, "the add sheet");
    expect(typeRadio("Rehab or skilled nursing")!.checked).toBe(true);
    expect(field("dateOnly")!.checked).toBe(true);
    await userEvent.fill(field("label")!, "Short stay");
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(PERIODS_URL);
    await device.settle();

    const rows = listRows();
    const i = rows.findIndex((r) => r.title === "Rehab · Short stay");
    expect(i).toBe(1);
    expect(rows[i]!.current).toBe(false);
    expect(rows[i]!.dates.split("–")[0]).not.toMatch(/\d:\d/);
    expect(rows[0]).toMatchObject({ id: HOME_NOW.id, current: true });
    const [stored] = await device.query<{ date_only: number; started_at: string }>(
      "SELECT date_only, started_at FROM care_period WHERE label = 'Short stay'",
    );
    expect(stored!.date_only).toBe(1);
    expect(new Date(stored!.started_at).getTime()).toBe(start.getTime());
    // The rehab stay before it now ends that day.
    expect(rows[i + 1]!.id).toBe(REHAB.id);
    expect(rows[i + 1]!.dates).toContain(`until ${dayOf(start)}`);
  });

  test("an earlier dated period between two others: the one before it now ends at its start", async () => {
    const device = await open({
      url: `${PERIODS_URL}/new?type=other&startedAt=${encodeURIComponent(daysAgo(15, 9).toISOString())}`,
    });
    await waitUntil(() => !!FORM(), 4000, "the add sheet");
    await userEvent.fill(field("label")!, "Daughter's house");
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(PERIODS_URL);
    await device.settle();
    const ids = listRows().map((r) => r.id);
    const mine = listRows().find((r) => r.title === "Daughter's house")!;
    // Between the rehab stay (12 days back) and the hospital (19 days back).
    expect(ids.indexOf(mine.id)).toBe(ids.indexOf(REHAB.id) + 1);
    expect(ids.indexOf(HOSPITAL.id)).toBe(ids.indexOf(mine.id) + 1);
    expect(listRows().find((r) => r.id === HOSPITAL.id)!.dates).toContain(`until ${dayOf(daysAgo(15))}`);
  });

  test("two periods with one start (one from another device) both stay, in (started_at, created_at, id) order", async () => {
    const start = at(daysAgo(1));
    const fromThere = fx.period({
      type: "emergency",
      label: "Tie B",
      startedAt: start,
      dateOnly: 1,
      createdAt: at(new Date(Date.now() + 60_000)),
    });
    const device = await open({
      url: `${PERIODS_URL}/new?type=home&startedAt=${encodeURIComponent(daysAgo(1).toISOString())}&dateOnly=1`,
    });
    await waitUntil(() => !!FORM(), 4000, "the add sheet");
    await userEvent.fill(field("label")!, "Tie A");
    await userEvent.click(submit());
    await expect.poll(() => listed("Tie A") && !SHEET()).toBeTruthy();
    await device.sync(fromThere);
    await device.settle();

    // Newest first on the page: B (created later) above A.
    const shown = listRows()
      .filter((r) => r.title?.includes("Tie"))
      .map((r) => r.title);
    expect(shown).toEqual(["Emergency room · Tie B", "Home · Tie A"]);
    const local = await device.query<{ label: string }>(TRACK_SQL, [GROUP]);
    expect(local.map((r) => r.label).filter((l) => l?.startsWith("Tie"))).toEqual(["Tie A", "Tie B"]);
    // The earlier-created one has zero length and still shows.
    expect(listRows().find((r) => r.title === "Home · Tie A")!.dates).toMatch(/Less than a day$/);
  });
});

describe("the device's writes", () => {
  test("refuses a future start, on startedAt", async () => {
    const device = await open();
    const future = await createCarePeriod(device.db, GROUP, {
      type: "home",
      startedAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(future).toMatchObject({
      ok: false,
      issues: [{ path: "startedAt", message: "Can't be in the future" }],
    });
    expect(await device.queued()).toEqual([]);
  });

  test("a viewer's device refuses every write", async () => {
    const device = await open({ role: "viewer" });
    const results = [
      await createCarePeriod(device.db, GROUP, { type: "home", startedAt: new Date().toISOString() }),
      await updateCarePeriod(device.db, HOSPITAL.id, { label: "Nope" }),
      await removeCarePeriod(device.db, HOSPITAL.id),
    ];
    expect(results.map((r) => r.ok)).toEqual([false, false, false]);
    expect(await device.queued()).toEqual([]);
  });
});

describe("a viewer", () => {
  test("sees the list without Add period", async () => {
    await open({ role: "viewer" });
    expect(listRows()).toHaveLength(5);
    expect(ADD()).toBeNull();
    await expect.element(page.getByText(/You can view this list/)).toBeVisible();
  });

  test.each([
    ["periods/new", `${PERIODS_URL}/new`],
    ["a period's edit URL", `${PERIODS_URL}/${ER.id}/edit`],
  ])("%s sends them to the list", async (_, url) => {
    const device = await open({ role: "viewer", url });
    await expect.poll(device.location).toBe(PERIODS_URL);
    expect(SHEET()).toBeNull();
  });
});

describe("the edit sheet's URL", () => {
  const OTHER_GROUP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b09";
  const gone = fx.period({
    type: "rehab",
    label: "Gone",
    startedAt: at(daysAgo(2)),
    deletedAt: at(daysAgo(1)),
  });
  const elsewhere = fx.period({ groupId: OTHER_GROUP, type: "home", startedAt: at(daysAgo(2)) });

  test.each([
    ["a deleted period", gone.id],
    ["another group's period", elsewhere.id],
    ["a missing period", "7e1c9a40-2b6d-4f3e-8a15-000000000000"],
  ])("%s sends a writer to the list", async (_, id) => {
    const device = await open({ url: `${PERIODS_URL}/${id}/edit`, fixtures: [...track(), gone, elsewhere] });
    await expect.poll(device.location).toBe(PERIODS_URL);
    expect(SHEET()).toBeNull();
  });

  test("a period deleted on another device while its sheet is open closes the sheet onto the list", async () => {
    const device = await open({ url: `${PERIODS_URL}/${REHAB.id}/edit` });
    await waitUntil(() => !!FORM(), 4000, "the edit sheet");
    await device.sync(fx.period({ ...rowOf(REHAB), deletedAt: at() }));
    await expect.poll(() => !SHEET() && device.location()).toBe(PERIODS_URL);
  });
});

/** A fixture's row back as builder values (camelCase), to sync a changed copy. */
const rowOf = (f: ReturnType<typeof fx.period>) => {
  const r = f.row as Record<string, unknown>;
  return {
    id: f.id,
    groupId: r.group_id as string,
    recipientId: r.recipient_id as string,
    type: r.type as "rehab",
    label: r.label as string | null,
    startedAt: r.started_at as string,
    dateOnly: r.date_only as number,
    createdAt: r.created_at as string,
  };
};
