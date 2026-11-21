import { describe, expect, it } from "vitest";
import {
  editMedicationGuard,
  MEDICATION_SHEET_STATE,
  medicationTabOf,
  newMedicationGuard,
  onlyMedicationSheetChanged,
  openedFromApp,
  sheetTab,
} from "./medicationSheets";

const G = "g1";
const MEDS = `/app/groups/${G}/medications`;
const LIST = `${MEDS}/list`;
const SCHEDULE = `${MEDS}/schedule`;
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
});
