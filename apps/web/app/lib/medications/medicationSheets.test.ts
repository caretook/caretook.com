import { describe, expect, it } from "vitest";
import {
  doseSheetHome,
  editMedicationGuard,
  MEDICATION_SHEET_STATE,
  medicationTabOf,
  newMedicationGuard,
  newPassGuard,
  onlyMedicationSheetChanged,
  openedFromApp,
  openedFromPasses,
  PASS_SHEET_STATE,
  sheetTab,
} from "./medicationSheets";

const G = "g1";
const MEDS = `/app/groups/${G}/medications`;
const LIST = `${MEDS}/list`;
const SCHEDULE = `${MEDS}/schedule`;
const PASSES = `${MEDS}/passes`;
const url = (path: string) => new URL(`http://x${path}`);

describe("newMedicationGuard", () => {
  it("opens the add sheet for a writer", () => {
    expect(newMedicationGuard({ groupId: G, tab: "list", search: "", canWrite: true })).toEqual({
      sheet: true,
    });
  });
  it("sends a viewer to the tab underneath, search kept", () => {
    expect(newMedicationGuard({ groupId: G, tab: "list", search: "?q=lis", canWrite: false })).toEqual({
      redirect: `${LIST}?q=lis`,
    });
    expect(newMedicationGuard({ groupId: G, tab: "schedule", search: "", canWrite: false })).toEqual({
      redirect: SCHEDULE,
    });
  });
});

describe("editMedicationGuard", () => {
  const live = { id: "m1", groupId: G, deletedAt: null };
  it("opens a live medication in this group for a writer", () => {
    expect(
      editMedicationGuard({ groupId: G, tab: "list", search: "", canWrite: true, medication: live }),
    ).toEqual({ sheet: live });
  });
  it("sends a viewer, a missing, a deleted and another group's medication to the tab underneath", () => {
    const list = { redirect: `${LIST}?status=current` };
    const at = { groupId: G, tab: "list" as const, search: "?status=current" };
    expect(editMedicationGuard({ ...at, canWrite: false, medication: live })).toEqual(list);
    expect(editMedicationGuard({ ...at, canWrite: true, medication: null })).toEqual(list);
    expect(editMedicationGuard({ ...at, canWrite: true, medication: { ...live, deletedAt: "x" } })).toEqual(
      list,
    );
    expect(editMedicationGuard({ ...at, canWrite: true, medication: { ...live, groupId: "g2" } })).toEqual(
      list,
    );
    expect(
      editMedicationGuard({ groupId: G, tab: "schedule", search: "", canWrite: false, medication: live }),
    ).toEqual({ redirect: SCHEDULE });
  });
});

describe("medicationTabOf and sheetTab", () => {
  it("is the tab a path is on or under, else null (sheetTab: else the list)", () => {
    expect(medicationTabOf(G, SCHEDULE)).toBe("schedule");
    expect(medicationTabOf(G, `${SCHEDULE}/new`)).toBe("schedule");
    expect(medicationTabOf(G, LIST)).toBe("list");
    expect(medicationTabOf(G, `${LIST}/m1/edit`)).toBe("list");
    expect(medicationTabOf(G, `${MEDS}/m1`)).toBeNull();
    expect(medicationTabOf(G, `${MEDS}/listx`)).toBeNull();
    expect(medicationTabOf(G, MEDS)).toBeNull();
    expect(medicationTabOf(G, `/app/groups/g2/medications/list`)).toBeNull();
    expect(sheetTab(G, `${SCHEDULE}/allergies`)).toBe("schedule");
    expect(sheetTab(G, `${MEDS}/m1`)).toBe("list");
  });
  it("is passes on the Passes tab and its add-pass sheet; a medication sheet from there opens over the list", () => {
    expect(medicationTabOf(G, PASSES)).toBe("passes");
    expect(medicationTabOf(G, `${PASSES}/new`)).toBe("passes");
    expect(medicationTabOf(G, `${MEDS}/passesx`)).toBeNull();
    expect(sheetTab(G, PASSES)).toBe("list");
  });
});

describe("newPassGuard", () => {
  it("opens the add-pass sheet for a writer with room for a pass", () => {
    expect(newPassGuard({ groupId: G, canWrite: true, canAdd: true })).toEqual({ sheet: true });
  });
  it("sends a viewer, and a writer in a full group, to the Passes tab", () => {
    expect(newPassGuard({ groupId: G, canWrite: false, canAdd: true })).toEqual({ redirect: PASSES });
    expect(newPassGuard({ groupId: G, canWrite: true, canAdd: false })).toEqual({ redirect: PASSES });
  });
});

describe("onlyMedicationSheetChanged", () => {
  it.each([
    ["the list", LIST],
    ["Schedule", SCHEDULE],
  ])("is true between %s and each of its sheets, opening and closing", (_, tab) => {
    for (const sheet of [`${tab}/new`, `${tab}/allergies`, `${tab}/m1/edit`]) {
      expect(onlyMedicationSheetChanged(G, url(tab), url(sheet))).toBe(true);
      expect(onlyMedicationSheetChanged(G, url(`${sheet}?q=a`), url(`${tab}?q=a`))).toBe(true);
    }
    expect(onlyMedicationSheetChanged(G, url(`${tab}/new`), url(`${tab}/m1/edit`))).toBe(true);
  });
  it("is true between the list and its Dose sheet, which only the list has", () => {
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${LIST}/dose?medication=m1`))).toBe(true);
    expect(onlyMedicationSheetChanged(G, url(`${LIST}/dose?q=a`), url(`${LIST}?q=a`))).toBe(true);
    expect(onlyMedicationSheetChanged(G, url(SCHEDULE), url(`${SCHEDULE}/dose`))).toBe(false);
  });
  it("is true between Passes and its add-pass sheet, and only that sheet", () => {
    expect(onlyMedicationSheetChanged(G, url(PASSES), url(`${PASSES}/new`))).toBe(true);
    expect(onlyMedicationSheetChanged(G, url(`${PASSES}/new`), url(PASSES))).toBe(true);
    expect(onlyMedicationSheetChanged(G, url(PASSES), url(`${PASSES}/allergies`))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(PASSES), url(`${LIST}/new`))).toBe(false);
  });
  it("is false between the tabs, for a medication's page, print, another group or the same path", () => {
    expect(onlyMedicationSheetChanged(G, url(LIST), url(SCHEDULE))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(`${SCHEDULE}/new`), url(LIST))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${MEDS}/m1`))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${LIST}/m1`))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${MEDS}/print`))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`/app/groups/g2/medications/list/new`))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${LIST}?q=a`))).toBe(false);
  });
});

describe("openedFromApp", () => {
  it("recognizes the sheet links' history state, and nothing else", () => {
    expect(openedFromApp(MEDICATION_SHEET_STATE)).toBe(true);
    expect(openedFromApp(null)).toBe(false);
    expect(openedFromApp({ other: true })).toBe(false);
  });
  it("tells the Passes tab's add-pass links apart from the medication sheets'", () => {
    expect(openedFromPasses(PASS_SHEET_STATE)).toBe(true);
    expect(openedFromPasses(MEDICATION_SHEET_STATE)).toBe(false);
    expect(openedFromPasses(undefined)).toBe(false);
  });
});

describe("doseSheetHome", () => {
  it("is the list, search kept and the sheet's own parameters dropped, for the Dose sheet over it", () => {
    expect(doseSheetHome(G, `${LIST}/dose`, "?q=lis&medication=m1&slot=08:00")).toBe(`${LIST}?q=lis`);
    expect(doseSheetHome(G, `${LIST}/dose`, "")).toBe(LIST);
  });
  it("is undefined over the timeline (and anywhere else)", () => {
    expect(doseSheetHome(G, `/app/groups/${G}/timeline/new/dose`, "?medication=m1")).toBeUndefined();
    expect(doseSheetHome(G, `${SCHEDULE}/new`, "")).toBeUndefined();
  });
});
