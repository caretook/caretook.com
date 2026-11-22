import type { DeviceRoute } from "../../../../../../test/device";

import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../../test/found";
import { renderWithDevice } from "../../../../../../test/device";
import { fx } from "../../../../../../test/fixtures";
import * as medications from "../route";
import * as scheduleTab from "../schedule/route";
import {
  $,
  $$,
  dialogButton,
  EVENING,
  MEDS,
  menuItem,
  MORNING,
  OPEN_DIALOG,
  SCHEDULE,
} from "../medicationWorld";
import * as passesScreen from "./route";

// The Passes screen (medications.mjs's passes steps): the group's passes in
// order with the medications in each, from the list's Passes link; a writer
// adds one (a taken name refused, any case), retimes it (every medication
// moves with it, and one passMoved entry says so), moves it up, renames it
// and deletes it (a confirm saying the medications keep the time, which they
// do, with no change entries); a retime from another device shows without a
// reload; a viewer reads it with no controls. The device never connects, so
// every write here is the offline one too. The pass rules are
// medicationPass.test.ts's; the service's retime and delete are
// medicationPass.int.test.ts's and syncPasses.int.test.ts's.

const PASSES = `${MEDS}/passes`;
const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/medications",
    module: medications,
    children: [{ path: "/app/groups/:groupId/medications/schedule", module: scheduleTab }],
  },
  { path: "/app/groups/:groupId/medications/passes", module: passesScreen },
];

const LISINOPRIL = fx.medication({
  name: "Lisinopril",
  strength: "10 mg",
  schedule: { type: "scheduled", slots: [{ passId: MORNING.id }] },
});
const METFORMIN = fx.medication({
  name: "Metformin",
  strength: "500 mg",
  schedule: { type: "scheduled", slots: [{ passId: MORNING.id }, { passId: EVENING.id }] },
});

const open = (options: { role?: "caretaker" | "viewer"; url?: string; extra?: unknown[] } = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: options.url ?? PASSES,
    role: options.role ?? "caretaker",
    fixtures: [MORNING, EVENING, LISINOPRIL, METFORMIN, ...((options.extra ?? []) as [])],
  });

const rows = () => $$("main [data-passes] > li");
/** The screen's passes as "Name HH:MM", in order. */
const passList = () =>
  rows().map(
    (li) =>
      `${li.querySelector("[data-pass-name]")?.textContent} ${li.querySelector<HTMLTimeElement>("[data-pass-time]")?.dateTime}`,
  );
const row = (name: string) => rows().find((li) => li.querySelector("[data-pass-name]")?.textContent === name);
const medsIn = (name: string) =>
  [...(row(name)?.querySelectorAll("[data-pass-medication]") ?? [])].map((a) => a.textContent);
const FORM = () => $<HTMLFormElement>("[role=dialog] [data-pass-form]");
const input = (name: string) => FORM()!.querySelector<HTMLInputElement>(`[name="${name}"]`)!;

const fillForm = async ({ name, time }: { name?: string; time?: string }) => {
  await expect.poll(FORM).toBeTruthy();
  if (name !== undefined) await userEvent.fill(input("name"), name);
  if (time !== undefined) await userEvent.fill(input("time"), time);
  await userEvent.click(await found(() => FORM()?.querySelector('button[type="submit"]')));
};
const action = async (name: string, item: string) => {
  await userEvent.click(row(name)!.querySelector(`button[aria-label="Actions for ${name}"]`)!);
  await expect.poll(() => menuItem(item)).toBeTruthy();
  await userEvent.click(menuItem(item)!);
};
const stored = async (device: { query: <T>(sql: string, p?: unknown[]) => Promise<T[]> }, id: string) =>
  (
    await device.query<{ name: string; time: string; sort_order: number; deleted_at: string | null }>(
      "SELECT name, time, sort_order, deleted_at FROM medication_pass WHERE id = ?",
      [id],
    )
  )[0];

/** Add "Noon" at 12:00 with a medication in it; returns its id. */
const addNoon = async (device: Awaited<ReturnType<typeof open>>) => {
  await userEvent.click($("main [data-add-pass]")!);
  await fillForm({ name: "Noon", time: "12:00" });
  await expect.poll(() => row("Noon")).toBeTruthy();
  await expect.poll(FORM).toBeNull();
  const [noon] = await device.query<{ id: string }>("SELECT id FROM medication_pass WHERE name = 'Noon'");
  return noon!.id;
};

describe("the screen", () => {
  test("Schedule's Passes link opens the group's passes, Morning 08:00 then Evening 20:00, each with its medications; Back goes to Schedule", async () => {
    const device = await open({ url: SCHEDULE });
    await expect.poll(() => $("main [data-passes-link]"), { timeout: 3000 }).toBeTruthy();
    await userEvent.click($("main [data-passes-link]")!);
    await expect.poll(() => device.location()).toBe(PASSES);
    await expect.poll(passList).toEqual(["Morning 08:00", "Evening 20:00"]);
    expect(medsIn("Morning")).toEqual(["Lisinopril 10 mg", "Metformin 500 mg"]);
    expect(medsIn("Evening")).toEqual(["Metformin 500 mg"]);
    const back = $$("main a").find((a) => a.textContent?.trim() === "Medications");
    expect(back?.getAttribute("href")).toBe(SCHEDULE);
  });

  test("a viewer reads the passes and their medications, told so, with no controls", async () => {
    await open({ role: "viewer" });
    await expect.poll(passList).toEqual(["Morning 08:00", "Evening 20:00"]);
    expect($("main [data-add-pass]")).toBeNull();
    expect($$("main [data-passes] button")).toHaveLength(0);
    expect($("main header p")?.textContent).toContain("You can view the passes");
  });

  test("a retime from another device shows without a reload", async () => {
    const device = await open();
    await device.sync({ ...MORNING, row: { ...MORNING.row, time: "07:30" } });
    await device.settle();
    expect(passList()).toEqual(["Morning 07:30", "Evening 20:00"]);
  });
});

describe("a writer", () => {
  test("adds a pass, last in the list; a taken name (any case) is refused on its field", async () => {
    const device = await open();
    await userEvent.click($("main [data-add-pass]")!);
    await fillForm({ name: "morning", time: "07:00" });
    await expect.poll(() => input("name").getAttribute("aria-invalid")).toBe("true");
    const describedBy = input("name").getAttribute("aria-describedby")!.split(" ").pop()!;
    expect(document.getElementById(describedBy)?.textContent).toBe("Another pass already has that name");
    await fillForm({ name: "Noon", time: "12:00" });
    await expect.poll(passList).toEqual(["Morning 08:00", "Evening 20:00", "Noon 12:00"]);
    expect(row("Noon")!.querySelector("[data-pass-medications-none]")?.textContent).toBe(
      "No medications yet",
    );
    const [noon] = await device.query<{ time: string; deleted_at: string | null }>(
      "SELECT time, deleted_at FROM medication_pass WHERE name = 'Noon'",
    );
    expect(noon).toMatchObject({ time: "12:00", deleted_at: null });
    expect((await device.queued()).some((w) => w.type === "medication_pass")).toBe(true);
  });

  test("a retime moves its medications with it and writes one passMoved entry naming them; Move up puts it before Evening; a rename saves", async () => {
    const device = await open();
    const noon = await addNoon(device);
    const PASS_MED = fx.medication({
      name: "Pass med",
      strength: "5 mg",
      schedule: { type: "scheduled", slots: [{ passId: noon, amount: "2 tablets" }] },
    });
    await device.sync(PASS_MED);
    await device.settle();
    expect(medsIn("Noon")).toEqual(["Pass med 5 mg"]);

    await action("Noon", "Edit");
    await fillForm({ time: "12:30" });
    await expect
      .poll(() => row("Noon")?.querySelector<HTMLTimeElement>("[data-pass-time]")?.dateTime)
      .toBe("12:30");
    const moved = await device.query<{ details: string }>(
      "SELECT details FROM timeline_entry WHERE kind = 'medicationChange' AND json_extract(details, '$.passId') = ?",
      [noon],
    );
    expect(moved).toHaveLength(1);
    expect(JSON.parse(moved[0]!.details)).toMatchObject({
      change: "passMoved",
      beforeTime: "12:00",
      afterTime: "12:30",
      medicationIds: [PASS_MED.id],
    });
    expect(medsIn("Noon")).toEqual(["Pass med 5 mg"]);

    await action("Noon", "Move up");
    await expect.poll(passList).toEqual(["Morning 08:00", "Noon 12:30", "Evening 20:00"]);
    const order = await device.query<{ name: string }>(
      "SELECT name FROM medication_pass WHERE deleted_at IS NULL ORDER BY sort_order, time",
    );
    expect(order.map((p) => p.name)).toEqual(["Morning", "Noon", "Evening"]);

    await action("Noon", "Edit");
    await fillForm({ name: "Lunch" });
    await expect.poll(() => row("Lunch")).toBeTruthy();
    expect((await stored(device, noon))?.name).toBe("Lunch");
  });

  test("Delete asks first, saying the medications keep the time; they do, with their amount and no change entry", async () => {
    const device = await open();
    const noon = await addNoon(device);
    const PASS_MED = fx.medication({
      name: "Pass med",
      schedule: { type: "scheduled", slots: [{ passId: noon, amount: "2 tablets" }] },
    });
    await device.sync(PASS_MED);
    await device.settle();
    await action("Noon", "Delete");
    await expect.poll(() => OPEN_DIALOG()?.textContent ?? "").toContain("keep 12:00");
    await userEvent.click(dialogButton("Delete")!);
    await expect.poll(() => row("Noon")).toBeUndefined();
    expect((await stored(device, noon))?.deleted_at).not.toBeNull();
    const [med] = await device.query<{ schedule: string }>("SELECT schedule FROM medication WHERE id = ?", [
      PASS_MED.id,
    ]);
    expect(JSON.parse(med!.schedule)).toEqual({
      type: "scheduled",
      slots: [{ time: "12:00", amount: "2 tablets" }],
    });
    const changes = await device.query(
      "SELECT id FROM timeline_entry WHERE kind = 'medicationChange' AND json_extract(details, '$.medicationId') = ?",
      [PASS_MED.id],
    );
    expect(changes).toHaveLength(0);
  });
});
