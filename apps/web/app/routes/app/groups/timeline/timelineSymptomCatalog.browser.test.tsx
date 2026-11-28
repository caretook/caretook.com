import type { Fixtures } from "../../../../../test/fixtures";

import { symptomTypeId } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { fx, hoursAgo, newId, symptomType, TEST_GROUP } from "../../../../../test/fixtures";
import { chooseEasyMode, rowWith, TIMELINE_URL as T, openTimeline } from "./timelineWorld";

// The symptom sheet's name field suggests the group's catalog (symptom-catalog
// slice 1): a native `datalist` read from the local copy, so it works
// offline and follows what sync brings. Any other name can still be typed.
// An archived name (symptom-catalog-2 slice 4) leaves the suggestions and the
// similar-name check, but its exact name still saves to its row; a tombstone
// (merged away) is gone from both. A deleted name (a tombstone) typed in the
// sheet or quick entry saves as its replacement (symptom-catalog-3), and the
// timeline shows that name at once.

const NAME = () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="symptomName"]');
const SUBMIT = () => document.querySelector<HTMLButtonElement>('[role=dialog] button[type="submit"]');
const suggestions = () => {
  const id = NAME()?.getAttribute("list");
  const list = id ? document.getElementById(id) : null;
  return list ? [...list.querySelectorAll("option")].map((o) => o.value) : [];
};

const OTHER_GROUP = newId();

const openAdd = (fixtures: Fixtures) =>
  openTimeline({ url: `${T}/new/symptom?kind=symptom`, role: "caretaker", fixtures });

describe("the symptom sheet's suggestions", () => {
  test("lists the group's catalog A to Z, and no other group's", async () => {
    await openAdd([
      symptomType("Nausea"),
      symptomType("Fall"),
      symptomType("Knee pain"),
      fx.group({ id: OTHER_GROUP, name: "Another family" }),
      symptomType("Hiccups", { groupId: OTHER_GROUP }),
    ]);
    const name = await found(NAME);
    expect(name.tagName).toBe("INPUT");
    await expect.poll(suggestions).toEqual(["Fall", "Knee pain", "Nausea"]);
  });

  test("follows a type that arrives by sync", async () => {
    const device = await openAdd([symptomType("Nausea")]);
    await expect.poll(suggestions).toEqual(["Nausea"]);
    await device.sync(symptomType("Dizziness"));
    await expect.poll(suggestions).toEqual(["Dizziness", "Nausea"]);
  });

  test("still saves a name that isn't in the catalog", async () => {
    await openAdd([symptomType("Nausea")]);
    await userEvent.fill(await found(NAME), "Sore elbow");
    await userEvent.click(await found(SUBMIT));
    await expect.poll(() => rowWith("Sore elbow")).toBeTruthy();
  });
});

describe("archived symptoms", () => {
  type Device = Awaited<ReturnType<typeof openTimeline>>;
  const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
  const GATE = () => SHEET()?.querySelector<HTMLElement>("[data-symptom-gate]") ?? null;
  const typeId = (name: string) => symptomTypeId(TEST_GROUP.id, name);
  const CATALOG = () => [
    symptomType("Nausea"),
    symptomType("Knee pain", { archivedAt: hoursAgo(2) }),
    symptomType("Fever"),
    symptomType("Feverr", { replacedById: typeId("Fever") }),
  ];
  const savedSymptoms = (device: Device) =>
    device.query<{ name: string; symptom_type_id: string | null }>(
      `SELECT json_extract(details, '$.name') AS name, symptom_type_id FROM timeline_entry
        WHERE kind = 'symptom' AND deleted_at IS NULL ORDER BY name`,
    );
  const queuedTypes = async (device: Device) =>
    (await device.queued()).filter((w) => w.type === "symptom_type").map((w) => [w.op, w.id]);
  const typeAndSave = async (name: string) => {
    await userEvent.fill(await found(NAME), name);
    await userEvent.click(await found(SUBMIT));
  };

  test("the sheet leaves an archived symptom and a tombstone out of its suggestions", async () => {
    await openAdd(CATALOG());
    await found(NAME);
    await expect.poll(suggestions).toEqual(["Fever", "Nausea"]);
  });

  test("the Easy form leaves them out too", async () => {
    chooseEasyMode();
    await openTimeline({ url: `${T}/new/symptom`, role: "caretaker", fixtures: CATALOG() });
    await found(NAME);
    await expect.poll(suggestions).toEqual(["Fever", "Nausea"]);
  });

  test("an archived name typed exactly saves with no prompt, pointing at its row", async () => {
    const device = await openAdd(CATALOG());
    await typeAndSave("knee PAIN");
    await expect.poll(SHEET).toBeNull();
    expect(GATE()).toBeNull();
    expect(await savedSymptoms(device)).toEqual([
      { name: "Knee pain", symptom_type_id: typeId("Knee pain") },
    ]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test("a name only like an archived one asks nothing", async () => {
    const device = await openAdd(CATALOG());
    await typeAndSave("Pain knee");
    await expect.poll(SHEET).toBeNull();
    expect(GATE()).toBeNull();
    expect(await savedSymptoms(device)).toEqual([
      { name: "Pain knee", symptom_type_id: typeId("Pain knee") },
    ]);
  });
});

describe("a deleted symptom (symptom-catalog-3)", () => {
  type Device = Awaited<ReturnType<typeof openTimeline>>;
  const typeId = (name: string) => symptomTypeId(TEST_GROUP.id, name);
  const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
  const TOMBSTONE = () => symptomType("Upset tummy", { replacedById: typeId("Nausea") });
  const savedSymptoms = (device: Device) =>
    device.query<{ name: string; symptom_type_id: string | null }>(
      `SELECT json_extract(details, '$.name') AS name, symptom_type_id FROM timeline_entry
        WHERE kind = 'symptom' AND deleted_at IS NULL`,
    );
  const queuedTypes = async (device: Device) =>
    (await device.queued()).filter((w) => w.type === "symptom_type").map((w) => [w.op, w.id]);
  /** The device has "Nausea", then the tombstone "Upset tummy" arrives by sync. */
  const openSynced = async (options: Parameters<typeof openTimeline>[0]) => {
    const device = await openTimeline({ role: "caretaker", ...options });
    await device.sync(TOMBSTONE());
    return device;
  };
  const saveName = async (name: string) => {
    await userEvent.fill(await found(NAME), name);
    await userEvent.click(await found(SUBMIT));
    await expect.poll(SHEET).toBeNull();
  };

  test("the sheet saves the deleted name as its replacement, and the timeline shows it", async () => {
    const device = await openSynced({
      url: `${T}/new/symptom?kind=symptom`,
      fixtures: [symptomType("Nausea")],
    });
    await saveName("upset TUMMY");
    await expect.poll(() => rowWith("Nausea")).toBeTruthy();
    expect(rowWith("Upset tummy")).toBeUndefined();
    expect(await savedSymptoms(device)).toEqual([{ name: "Nausea", symptom_type_id: typeId("Nausea") }]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test("renaming an entry to the deleted name saves the replacement", async () => {
    const entry = newId();
    const device = await openSynced({
      url: `${T}/${entry}/edit`,
      fixtures: [
        symptomType("Nausea"),
        symptomType("Knee pain"),
        fx.symptom({ id: entry, name: "Knee pain" }),
      ],
    });
    await saveName("Upset tummy");
    await expect.poll(() => rowWith("Nausea")).toBeTruthy();
    expect(await savedSymptoms(device)).toEqual([{ name: "Nausea", symptom_type_id: typeId("Nausea") }]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test("quick entry saves the deleted name as its replacement, and the timeline shows it", async () => {
    const device = await openSynced({ url: T, fixtures: [symptomType("Nausea")] });
    await userEvent.fill(page.getByRole("textbox", { name: "What happened?" }), "upset tummy 2");
    await waitUntil(() => document.querySelector("[data-quick-card=symptom]"), "the card");
    await userEvent.click(
      await found(() => document.querySelector<HTMLButtonElement>("[data-quick-entry] button[type=submit]")),
    );
    await expect.poll(() => rowWith("Nausea")).toBeTruthy();
    expect(rowWith("Upset tummy")).toBeUndefined();
    expect(await savedSymptoms(device)).toEqual([{ name: "Nausea", symptom_type_id: typeId("Nausea") }]);
    expect(await queuedTypes(device)).toEqual([]);
  });
});
