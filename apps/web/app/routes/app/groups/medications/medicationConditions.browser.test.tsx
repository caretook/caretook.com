import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { at, condition, medicationCondition } from "../../../../../test/fixtures";
import { openProfile, PROFILE_URL } from "../profile/profileWorld";
import {
  AMOXICILLIN,
  ELM,
  EVENING,
  field,
  FORM,
  LARK,
  LATANOPROST,
  LISINOPRIL,
  LIST,
  MEDICATION_ROUTES,
  medicationUrl,
  medPage,
  METFORMIN,
  MORNING,
  option,
  SHEET,
  submit,
} from "./medicationWorld";

// What a medication is for (conditions slice 4): the medication form's For
// field picks several of the recipient's conditions and keeps the free-text
// reason; the medication page says "For: …", each linking the condition's
// sheet; a condition's sheet lists its current medications; and a deleted
// condition disappears from all of them. Every write is local (the device is
// offline). What the server decides is medicationCondition.int.test.ts's and
// syncMedicationConditions.int.test.ts's; a link reaching another device is
// roundtrip's sync matrix (6b).

const HBP = condition({ name: "High blood pressure", sinceYear: 2012 });
const DIABETES = condition({ name: "Type 2 diabetes", sinceYear: 2016, sinceMonth: 3 });
const GLAUCOMA = condition({ name: "Glaucoma", sinceYear: 2019 });
const PNEUMONIA = condition({ name: "Pneumonia", status: "resolved", sinceYear: 2025 });
const GOUT = condition({ name: "Gout", deletedAt: at() });

/** Grandma June's medications (no recipient: the profile world has hers) and conditions. */
const FIXTURES = [
  MORNING,
  EVENING,
  LARK,
  ELM,
  LISINOPRIL,
  METFORMIN,
  LATANOPROST,
  AMOXICILLIN,
  HBP,
  DIABETES,
  GLAUCOMA,
  PNEUMONIA,
  GOUT,
  medicationCondition(METFORMIN.id, DIABETES.id),
  medicationCondition(METFORMIN.id, GOUT.id),
  medicationCondition(LISINOPRIL.id, HBP.id),
  // Stopped: not a current medication for it.
  medicationCondition(AMOXICILLIN.id, PNEUMONIA.id),
];

const open = (url: string, fixtures = FIXTURES) =>
  openProfile({ role: "caretaker", connected: false, url, routes: MEDICATION_ROUTES, fixtures });
/** The fixtures with `row` in place of the one with its id. */
const withRow = (row: (typeof FIXTURES)[number]) => [...FIXTURES.filter((f) => f.id !== row.id), row];

const conditionUrl = (id: string) => `${PROFILE_URL}/conditions/${id}`;
const editUrl = (id: string) => `${LIST}/${id}/edit`;
const picker = () => FORM()?.querySelector<HTMLElement>("[data-conditions-picker]") ?? null;
const chips = () =>
  [...(picker()?.querySelectorAll("li[data-chip]") ?? [])].map((li) => li.textContent?.trim() ?? "");
const pickerInput = () => picker()?.querySelector<HTMLInputElement>('input[role="combobox"]') ?? null;
const options = () =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
    (o) => o.firstElementChild?.textContent ?? "",
  );
const pickCondition = async (name: string) => {
  // The list opens on focus (unless it's open already).
  if (!option(name)) await userEvent.click(await found(pickerInput));
  await waitUntil(() => !!option(name), `the option ${name}`);
  await userEvent.click(await found(() => option(name)));
};
/** The medication page's For row: each condition's name and where it links. */
const forRow = () =>
  [...document.querySelectorAll<HTMLElement>("main [data-detail=for] a[data-medication-condition]")].map(
    (a) => [a.textContent?.trim(), a.getAttribute("href")],
  );
const linksOf = async (device: Awaited<ReturnType<typeof open>>, medicationId: string) =>
  (
    await device.query<{ name: string }>(
      "SELECT c.name FROM medication_condition mc JOIN recipient_condition c ON c.id = mc.condition_id WHERE mc.medication_id = ? ORDER BY c.name",
      [medicationId],
    )
  ).map((r) => r.name);
const sheetMedications = () =>
  [...(SHEET()?.querySelectorAll("[data-condition-medications] a[data-condition-medication]") ?? [])].map(
    (a) => [a.textContent?.trim(), a.getAttribute("href")],
  );

describe("the medication page", () => {
  test("says what it's for before the reason, each condition a link to its sheet; Done comes back", async () => {
    const device = await open(medicationUrl(METFORMIN.id));
    await waitUntil(() => forRow().length > 0, "the For row");
    // The deleted condition's link isn't shown.
    expect(forRow()).toEqual([["Type 2 diabetes", conditionUrl(DIABETES.id)]]);
    const rows = Object.keys(medPage().rows);
    expect(rows.indexOf("for")).toBe(rows.indexOf("reason") - 1);
    expect(medPage().rows.reason).toBe("Type 2 diabetes");

    await userEvent.click(getByCss("main [data-detail=for] a"));
    await expect.poll(device.location).toBe(conditionUrl(DIABETES.id));
    await userEvent.click(await found(() => SHEET()?.querySelector("[data-condition-done]")));
    await expect.poll(device.location).toBe(medicationUrl(METFORMIN.id));
  });

  test("a medication for nothing has no For row", async () => {
    await open(medicationUrl(LATANOPROST.id));
    await waitUntil(
      () => !!document.querySelector<HTMLElement>("main [data-detail=schedule]"),
      "the details",
    );
    expect(document.querySelector<HTMLElement>("main [data-detail=for]")).toBeNull();
  });
});

describe("the For field", () => {
  test("editing shows what it's for, offers the other active conditions, and saves several, keeping the reason", async () => {
    const device = await open(editUrl(METFORMIN.id));
    await waitUntil(() => chips().length > 0, "the For chips");
    expect(chips()).toEqual(["Type 2 diabetes"]);
    await userEvent.click(await found(pickerInput));
    // Active ones not chosen, most recent since first; no resolved or deleted one.
    await waitUntil(() => options().length > 0, "the options");
    expect(options()).toEqual(["Glaucoma", "High blood pressure"]);

    await pickCondition("High blood pressure");
    await pickCondition("Glaucoma");
    await expect.poll(chips).toEqual(["Type 2 diabetes", "High blood pressure", "Glaucoma"]);
    // Remove one again.
    await userEvent.click(
      await found(() => picker()?.querySelector<HTMLElement>('button[aria-label="Remove Glaucoma"]')),
    );
    await expect.poll(chips).toEqual(["Type 2 diabetes", "High blood pressure"]);
    expect(field("reason")?.value).toBe("Type 2 diabetes");

    const before = (await device.queued()).length;
    await userEvent.click(submit());
    await expect.poll(() => !SHEET()).toBe(true);
    await device.settle();
    expect(await linksOf(device, METFORMIN.id)).toEqual(["Gout", "High blood pressure", "Type 2 diabetes"]);
    const queued = (await device.queued()).slice(before).map((w) => `${w.op} ${w.type}`);
    expect(queued.filter((w) => w.endsWith("medication_condition"))).toEqual(["PUT medication_condition"]);
  });

  test("dropping every condition unlinks them, and the page's For row goes", async () => {
    const device = await open(editUrl(LISINOPRIL.id));
    await waitUntil(() => chips().length > 0, "the For chips");
    await userEvent.click(
      await found(() =>
        picker()?.querySelector<HTMLElement>('button[aria-label="Remove High blood pressure"]'),
      ),
    );
    await userEvent.click(submit());
    await expect.poll(() => !SHEET()).toBe(true);
    await device.settle();
    expect(await linksOf(device, LISINOPRIL.id)).toEqual([]);
    expect((await device.queued()).map((w) => `${w.op} ${w.type}`)).toContain("DELETE medication_condition");
  });

  test("a resolved condition stays on a medication already for it", async () => {
    await open(editUrl(AMOXICILLIN.id));
    await waitUntil(() => chips().length > 0, "the For chips");
    expect(chips()).toEqual(["Pneumonia"]);
  });

  test("a resolved condition isn't offered to another medication", async () => {
    await open(editUrl(LATANOPROST.id));
    await userEvent.click(await found(pickerInput));
    await waitUntil(() => options().length > 0, "the options");
    expect(options()).toEqual(["Glaucoma", "Type 2 diabetes", "High blood pressure"]);
  });

  test("adding a medication saves it with its conditions, the links queued after it", async () => {
    const device = await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.fill(await found(() => field("name")), "Amlodipine");
    await userEvent.click(
      await found(() =>
        FORM()?.querySelector<HTMLInputElement>('input[name="scheduleType"][value="asNeeded"]'),
      ),
    );
    await userEvent.fill(await found(() => field("reason")), "Swelling too");
    await pickCondition("High blood pressure");
    await pickCondition("Glaucoma");
    const before = (await device.queued()).length;
    await userEvent.click(submit());
    await expect
      .poll(() => device.query("SELECT id FROM medication WHERE name = 'Amlodipine'"))
      .toHaveLength(1);
    const [made] = await device.query<{ id: string; reason: string }>(
      "SELECT id, reason FROM medication WHERE name = 'Amlodipine'",
    );
    // The save opens its page in the sheet's place.
    await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(made!.id));
    await device.settle();
    expect(made?.reason).toBe("Swelling too");
    expect(await linksOf(device, made?.id ?? "")).toEqual(["Glaucoma", "High blood pressure"]);
    const queued = (await device.queued()).slice(before).map((w) => `${w.op} ${w.type}`);
    expect(queued).toEqual([
      "PUT medication",
      "PUT timeline_entry",
      "PUT medication_condition",
      "PUT medication_condition",
    ]);
  });
});

describe("the condition's sheet", () => {
  test("lists its current medications, each a link to its page", async () => {
    const device = await open(conditionUrl(DIABETES.id));
    await waitUntil(() => sheetMedications().length > 0, "the medications");
    expect(sheetMedications()).toEqual([["Metformin 500 mg", medicationUrl(METFORMIN.id)]]);
    await userEvent.click(
      await found(() => SHEET()?.querySelector<HTMLElement>("a[data-condition-medication]")),
    );
    await expect.poll(device.location).toBe(medicationUrl(METFORMIN.id));
  });

  test("a stopped medication isn't listed, and none means no section", async () => {
    await open(conditionUrl(PNEUMONIA.id));
    await waitUntil(() => !!SHEET()?.querySelector("[data-condition-view]"), "the sheet");
    expect(SHEET()?.querySelector("[data-condition-medications]")).toBeNull();
  });
});

describe("a deleted condition or medication", () => {
  test("a condition deleted on another device leaves the medication page", async () => {
    const device = await open(medicationUrl(METFORMIN.id));
    await waitUntil(() => forRow().length > 0, "the For row");
    await device.sync(
      condition({ id: DIABETES.id, name: "Type 2 diabetes", sinceYear: 2016, deletedAt: at() }),
    );
    await device.settle();
    await expect.poll(() => document.querySelector<HTMLElement>("main [data-detail=for]")).toBeNull();
  });

  test("a deleted condition isn't on the form", async () => {
    await open(
      editUrl(LISINOPRIL.id),
      withRow(condition({ id: HBP.id, name: "High blood pressure", deletedAt: at() })),
    );
    await waitUntil(() => !!picker(), "the For field");
    expect(chips()).toEqual([]);
  });

  test("a medication deleted on another device leaves the condition's sheet", async () => {
    const device = await open(conditionUrl(HBP.id));
    await waitUntil(() => sheetMedications().length > 0, "the medications");
    await device.sync({ ...LISINOPRIL, row: { ...LISINOPRIL.row, deleted_at: at() } });
    await device.settle();
    await expect.poll(() => SHEET()?.querySelector("[data-condition-medications]") ?? null).toBeNull();
  });
});
