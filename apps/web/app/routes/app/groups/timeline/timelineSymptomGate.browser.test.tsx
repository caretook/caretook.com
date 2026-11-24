import type { Fixtures } from "../../../../../test/fixtures";

import { symptomTypeId } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { fx, symptomType, TEST_GROUP } from "../../../../../test/fixtures";
import { chooseEasyMode, rowWith, TIMELINE_URL as T, openTimeline } from "./timelineWorld";

// The check before a new symptom name joins the catalog (symptom-catalog
// slice 3), on the test device, offline (it never connects): an exact match
// saves with the catalog's spelling and no prompt; a similar name asks
// first ("Use <name>" or "Add new"), and each choice saves the right type; a
// new name adds its catalog row in the same local write as the entry. The
// Easy feelings form does the same, and saves "Feeling" with no prompt when
// nothing is typed. `similarSymptoms` itself is symptomCatalog.test.ts's;
// two devices converging on one row is roundtrip's.

type Device = Awaited<ReturnType<typeof openTimeline>>;

const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
const NAME = () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="symptomName"]');
const SUBMIT = () => SHEET()?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null;
const GATE = () => SHEET()?.querySelector<HTMLElement>("[data-symptom-gate]") ?? null;
const gateChoices = () =>
  [...(GATE()?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim() ?? "");

const CATALOG = [symptomType("Nausea"), symptomType("Knee pain"), symptomType("Fever")];

const typeId = (name: string) => symptomTypeId(TEST_GROUP.id, name);

/** The saved symptoms' names and pointers, A to Z by name. */
const savedSymptoms = (device: Device) =>
  device.query<{ name: string; symptom_type_id: string | null }>(
    `SELECT json_extract(details, '$.name') AS name, symptom_type_id FROM timeline_entry
      WHERE kind = 'symptom' AND deleted_at IS NULL ORDER BY name`,
  );
const catalogNames = async (device: Device) =>
  (await device.query<{ name: string }>("SELECT name FROM symptom_type ORDER BY name_key")).map(
    (r) => r.name,
  );
const queuedTypes = async (device: Device) =>
  (await device.queued()).filter((w) => w.type === "symptom_type").map((w) => [w.op, w.id, w.data?.name]);

const openAdd = async (fixtures: Fixtures = CATALOG) => {
  const device = await openTimeline({ url: `${T}/new/symptom?kind=symptom`, role: "caretaker", fixtures });
  await found(NAME);
  return device;
};

const typeAndSave = async (name: string) => {
  await userEvent.fill(await found(NAME), name);
  await userEvent.click(await found(SUBMIT));
};

describe("the symptom sheet's similar-name check", () => {
  test("an exact match saves with the catalog's spelling and no prompt", async () => {
    const device = await openAdd();
    await typeAndSave("  knee   PAIN ");
    await expect.poll(SHEET).toBeNull();
    expect(await savedSymptoms(device)).toEqual([
      { name: "Knee pain", symptom_type_id: typeId("Knee pain") },
    ]);
    expect(await catalogNames(device)).toEqual(["Fever", "Knee pain", "Nausea"]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test("a similar name asks first, and nothing is saved until a choice", async () => {
    const device = await openAdd();
    await typeAndSave("Nausia");
    await expect.poll(gateChoices).toEqual(["Use Nausea", "Add new"]);
    expect(GATE()?.textContent).toContain("“Nausia”");
    expect(document.activeElement?.textContent?.trim()).toBe("Use Nausea");
    expect(SHEET()).not.toBeNull();
    expect(await savedSymptoms(device)).toEqual([]);
    // Typing again closes it.
    await userEvent.type(await found(NAME), "x");
    await expect.poll(GATE).toBeNull();
  });

  test('"Use <name>" saves the existing type, and adds nothing', async () => {
    const device = await openAdd();
    await typeAndSave("pain knee");
    await userEvent.click(page.getByRole("button", { name: "Use Knee pain" }));
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => rowWith("Knee pain")).toBeTruthy();
    expect(await savedSymptoms(device)).toEqual([
      { name: "Knee pain", symptom_type_id: typeId("Knee pain") },
    ]);
    expect(await catalogNames(device)).toEqual(["Fever", "Knee pain", "Nausea"]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test('"Add new" saves the name as typed, its catalog row in the same write', async () => {
    const device = await openAdd();
    await typeAndSave("Left knee pain");
    await userEvent.click(page.getByRole("button", { name: "Add new" }));
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => rowWith("Left knee pain")).toBeTruthy();
    expect(await savedSymptoms(device)).toEqual([
      { name: "Left knee pain", symptom_type_id: typeId("Left knee pain") },
    ]);
    expect(await catalogNames(device)).toEqual(["Fever", "Knee pain", "Left knee pain", "Nausea"]);
    // Queued for upload (offline), as a PUT under the derived id.
    expect(await queuedTypes(device)).toEqual([["PUT", typeId("left knee pain"), "Left knee pain"]]);
  });

  test("a name like nothing in the catalog saves at once, adding its row", async () => {
    const device = await openAdd();
    await typeAndSave("Hiccups");
    await expect.poll(SHEET).toBeNull();
    expect(GATE()).toBeNull();
    expect(await catalogNames(device)).toEqual(["Fever", "Hiccups", "Knee pain", "Nausea"]);
    expect(await savedSymptoms(device)).toEqual([{ name: "Hiccups", symptom_type_id: typeId("Hiccups") }]);
  });

  test("an edit keeps its own name without asking", async () => {
    const knee = fx.symptom({ name: "Knee pains", severity: 2 });
    const device = await openTimeline({
      url: `${T}/${knee.id}/edit`,
      role: "caretaker",
      fixtures: [...CATALOG, knee],
    });
    await found(NAME);
    // Its stored name is close to "Knee pain", but it's already the entry's.
    await userEvent.click(await found(SUBMIT));
    await expect.poll(SHEET).toBeNull();
    expect(await queuedTypes(device)).toEqual([]);
  });

  test("a rename to a new name adds its catalog row", async () => {
    const knee = fx.symptom({ name: "Sore knee", severity: 2 });
    const device = await openTimeline({
      url: `${T}/${knee.id}/edit`,
      role: "caretaker",
      fixtures: [...CATALOG, knee],
    });
    await typeAndSave("Sore elbow");
    await expect.poll(SHEET).toBeNull();
    expect(await savedSymptoms(device)).toEqual([
      { name: "Sore elbow", symptom_type_id: typeId("Sore elbow") },
    ]);
    expect(await queuedTypes(device)).toEqual([["PUT", typeId("Sore elbow"), "Sore elbow"]]);
  });
});

describe("the Easy feelings form", () => {
  const openEasy = async () => {
    chooseEasyMode();
    const device = await openTimeline({ url: `${T}/new/symptom`, role: "caretaker", fixtures: CATALOG });
    await found(NAME);
    return device;
  };
  const pickFeeling = (n: string) =>
    userEvent.click(page.getByRole("radio", { name: new RegExp(`^${n},`) }), { force: true });

  test("suggests the catalog", async () => {
    await openEasy();
    const suggestions = () => {
      const id = NAME()?.getAttribute("list");
      const list = id ? document.getElementById(id) : null;
      return [...(list?.querySelectorAll("option") ?? [])].map((o) => o.value);
    };
    await expect.poll(suggestions).toEqual(["Fever", "Knee pain", "Nausea"]);
  });

  test("reuses an exact match", async () => {
    const device = await openEasy();
    await pickFeeling("3");
    await typeAndSave("fever");
    await expect.poll(SHEET).toBeNull();
    expect(await savedSymptoms(device)).toEqual([{ name: "Fever", symptom_type_id: typeId("Fever") }]);
  });

  test("asks about a similar name", async () => {
    const device = await openEasy();
    await pickFeeling("5");
    await typeAndSave("Feverr");
    await expect.poll(gateChoices).toEqual(["Use Fever", "Add new"]);
    await userEvent.click(page.getByRole("button", { name: "Use Fever" }));
    await expect.poll(SHEET).toBeNull();
    expect(await savedSymptoms(device)).toEqual([{ name: "Fever", symptom_type_id: typeId("Fever") }]);
  });

  test('saves "Feeling" with no prompt when nothing is typed', async () => {
    const device = await openEasy();
    await pickFeeling("4");
    await userEvent.click(await found(SUBMIT));
    await expect.poll(SHEET).toBeNull();
    expect(GATE()).toBeNull();
    expect(await savedSymptoms(device)).toEqual([{ name: "Feeling", symptom_type_id: typeId("Feeling") }]);
    // "Feeling" is an ordinary type, added on first use.
    expect(await catalogNames(device)).toContain("Feeling");
  });
});
