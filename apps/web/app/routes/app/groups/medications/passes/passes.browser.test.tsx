import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found } from "../../../../../../test/found";
import { renderWithDevice } from "../../../../../../test/device";
import { fx, medicationPass } from "../../../../../../test/fixtures";
import { pickTime } from "../../../../../../test/timeSelect";
import { currentHourTime } from "~/lib/core/timeOfDay";
import {
  dialogButton,
  EVENING,
  MEDICATION_ROUTES,
  menuItem,
  MORNING,
  OPEN_DIALOG,
  PASSES,
} from "../medicationWorld";

// The Passes tab (B-424; medications.mjs's passes steps): the group's passes
// in order with the medications in each, under the Medications header; a
// writer adds one through the header's `+` (Pass, the add-pass sheet; a
// taken name refused, any case), retimes it (every medication moves with it,
// and one passMoved entry says so; the list stays by time, then name, with
// no Move up or Move down, B-701), renames it and deletes it (a
// confirm saying the medications keep the time, which they do, with no
// change entries); a retime from another device shows without a reload; a
// viewer reads it with no controls, and the add-pass sheet's URL sends a
// viewer or a full group to the tab. The device never connects, so every
// write here is the offline one too. The pass rules are
// medicationPass.test.ts's; the service's retime and delete are
// medicationPass.int.test.ts's and syncPasses.int.test.ts's. The tabs and
// the `+` menu from each tab are tabs.browser.test.tsx's.

const NEW_PASS = `${PASSES}/new`;

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
    route: MEDICATION_ROUTES,
    url: options.url ?? PASSES,
    role: options.role ?? "caretaker",
    fixtures: [MORNING, EVENING, LISINOPRIL, METFORMIN, ...((options.extra ?? []) as [])],
  });

/** Six more passes: with Morning and Evening, the group's 8. */
const SIX_MORE = ["Noon", "Afternoon", "Supper", "Bedtime", "Night", "Late"].map((name, i) =>
  medicationPass({ name, time: `${String(9 + i).padStart(2, "0")}:30`, sortOrder: 2 + i }),
);

const rows = () => [...document.querySelectorAll<HTMLElement>("main [data-passes] > li")];
/** The screen's passes as "Name HH:MM", in order. */
const passList = () =>
  rows().map(
    (li) =>
      `${li.querySelector("[data-pass-name]")?.textContent} ${li.querySelector<HTMLTimeElement>("[data-pass-time]")?.dateTime}`,
  );
const row = (name: string) => rows().find((li) => li.querySelector("[data-pass-name]")?.textContent === name);
const medsIn = (name: string) =>
  [...(row(name)?.querySelectorAll("[data-pass-medication]") ?? [])].map((a) => a.textContent);
const FORM = () => document.querySelector<HTMLFormElement>("[role=dialog] [data-pass-form]");
const input = (name: string) => FORM()!.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
const description = () =>
  document.querySelector<HTMLElement>("main [data-passes-description]")?.textContent ?? null;

const fillForm = async ({ name, time }: { name?: string; time?: string }) => {
  await expect.poll(FORM).toBeTruthy();
  if (name !== undefined) await userEvent.fill(input("name"), name);
  if (time !== undefined) await pickTime(() => input("time"), time);
  await userEvent.click(await found(() => FORM()?.querySelector('button[type="submit"]')));
};
/** The header's `+`, then Pass: the add-pass sheet. */
const addPass = async () => {
  await userEvent.click(page.getByRole("button", { name: "Add", exact: true }));
  await userEvent.click(await found(() => menuItem("Pass")));
};
const action = async (name: string, item: string) => {
  await userEvent.click(
    await found(() => row(name)?.querySelector(`button[aria-label="Actions for ${name}"]`)),
  );
  await userEvent.click(await found(() => menuItem(item)));
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
  await addPass();
  await fillForm({ name: "Noon", time: "12:00" });
  await expect.poll(() => row("Noon")).toBeTruthy();
  await expect.poll(FORM).toBeNull();
  const [noon] = await device.query<{ id: string }>("SELECT id FROM medication_pass WHERE name = 'Noon'");
  return noon!.id;
};

describe("the tab", () => {
  test("lists the group's passes, Morning 08:00 then Evening 20:00, each with its medications, under its one line", async () => {
    await open();
    await expect.poll(passList).toEqual(["Morning 08:00", "Evening 20:00"]);
    expect(medsIn("Morning")).toEqual(["Lisinopril 10 mg", "Metformin 500 mg"]);
    expect(medsIn("Evening")).toEqual(["Metformin 500 mg"]);
    expect(description()).toContain("The rounds medications are given in, each day.");
    expect(description()).not.toContain("You can view");
  });

  test("passes show by time, then name, whatever their sort orders say; the menu has no Move up or Move down", async () => {
    const late = medicationPass({ name: "Late", time: "22:00", sortOrder: 0 });
    const brunch = medicationPass({ name: "brunch", time: "08:00", sortOrder: 7 });
    await open({ extra: [late, brunch] });
    await expect.poll(passList).toEqual(["brunch 08:00", "Morning 08:00", "Evening 20:00", "Late 22:00"]);
    await userEvent.click(
      await found(() => row("Morning")?.querySelector('button[aria-label="Actions for Morning"]')),
    );
    await found(() => menuItem("Edit"));
    const items = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].map((m) =>
      m.textContent?.trim(),
    );
    expect(items).toEqual(["Edit", "Delete"]);
  });

  test("a viewer reads the passes and their medications, told so, with no controls", async () => {
    await open({ role: "viewer" });
    await expect.poll(passList).toEqual(["Morning 08:00", "Evening 20:00"]);
    expect(document.querySelector<HTMLElement>("main header [data-add-medication]")).toBeNull();
    expect([...document.querySelectorAll<HTMLElement>("main [data-passes] button")]).toHaveLength(0);
    expect(description()).toContain("You can view the passes");
  });

  test("a new pass starts at the current hour in the recipient's zone, not the device's", async () => {
    await open({ url: NEW_PASS, extra: [fx.recipient({ timeZone: "Asia/Tokyo" })] });
    await expect.poll(() => FORM()).toBeTruthy();
    expect(input("time").value).toBe(currentHourTime("Asia/Tokyo"));
  });

  test("a saved 08:10 pass keeps its time through a rename", async () => {
    const offGrid = medicationPass({ name: "Breakfast", time: "08:10", sortOrder: 5 });
    const device = await open({ extra: [offGrid] });
    await action("Breakfast", "Edit");
    await expect.poll(() => FORM()).toBeTruthy();
    expect(input("time").value).toBe("08:10");
    await fillForm({ name: "First thing" });
    await expect.poll(() => row("First thing")).toBeTruthy();
    expect((await stored(device, offGrid.row.id))?.time).toBe("08:10");
  });

  test("a retime from another device shows without a reload", async () => {
    const device = await open();
    await device.sync({ ...MORNING, row: { ...MORNING.row, time: "07:30" } });
    await device.settle();
    expect(passList()).toEqual(["Morning 07:30", "Evening 20:00"]);
  });
});

describe("the add-pass sheet's URL", () => {
  test.each([
    ["a viewer", { role: "viewer" as const }],
    ["a writer in a group with 8 passes", { extra: SIX_MORE }],
  ])("sends %s to the Passes tab, with no sheet", async (_, options) => {
    const device = await open({ ...options, url: NEW_PASS });
    await expect.poll(() => device.location()).toBe(PASSES);
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    expect(document.querySelector<HTMLElement>("[role=dialog]")).toBeNull();
  });

  test("opened directly by a writer, it shows over the tab and Cancel replaces it with the tab", async () => {
    const device = await open({ url: NEW_PASS });
    await expect.poll(FORM).toBeTruthy();
    expect(passList()).toEqual(["Morning 08:00", "Evening 20:00"]);
    const cancel = [...FORM()!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel");
    await userEvent.click(await found(() => cancel));
    await expect.poll(() => !FORM() && device.location()).toBe(PASSES);
  });
});

describe("a writer", () => {
  test("adds a pass, in its place by time, and the sheet closes back to the tab; a taken name (any case) is refused on its field", async () => {
    const device = await open();
    await addPass();
    await expect.poll(() => device.location()).toBe(NEW_PASS);
    await fillForm({ name: "morning", time: "07:00" });
    await expect.poll(() => input("name").getAttribute("aria-invalid")).toBe("true");
    const describedBy = input("name").getAttribute("aria-describedby")!.split(" ").pop()!;
    await expect
      .poll(() => document.getElementById(describedBy)?.textContent)
      .toBe("Another pass already has that name");
    await fillForm({ name: "Noon", time: "12:00" });
    await expect.poll(passList).toEqual(["Morning 08:00", "Noon 12:00", "Evening 20:00"]);
    await expect.poll(() => !FORM() && device.location()).toBe(PASSES);
    await expect
      .poll(() => row("Noon")?.querySelector("[data-pass-medications-none]")?.textContent)
      .toBe("No medications yet");
    const [noon] = await device.query<{ time: string; deleted_at: string | null }>(
      "SELECT time, deleted_at FROM medication_pass WHERE name = 'Noon'",
    );
    expect(noon).toMatchObject({ time: "12:00", deleted_at: null });
    expect((await device.queued()).some((w) => w.type === "medication_pass")).toBe(true);
  });

  test("a retime moves its medications with it and writes one passMoved entry naming them; the list stays by time; a rename saves", async () => {
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
    expect(JSON.parse(moved[0]?.details ?? "null")).toMatchObject({
      change: "passMoved",
      beforeTime: "12:00",
      afterTime: "12:30",
      medicationIds: [PASS_MED.id],
    });
    expect(medsIn("Noon")).toEqual(["Pass med 5 mg"]);

    expect(passList()).toEqual(["Morning 08:00", "Noon 12:30", "Evening 20:00"]);

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
    await userEvent.click(await found(() => dialogButton("Delete")));
    await expect.poll(() => row("Noon")).toBeUndefined();
    expect((await stored(device, noon))?.deleted_at).not.toBeNull();
    const [med] = await device.query<{ schedule: string }>("SELECT schedule FROM medication WHERE id = ?", [
      PASS_MED.id,
    ]);
    expect(JSON.parse(med?.schedule ?? "null")).toEqual({
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
