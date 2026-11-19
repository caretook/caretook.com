import { describe, expect, it } from "vitest";
import {
  editMedicationGuard,
  MEDICATION_SHEET_STATE,
  newMedicationGuard,
  onlyMedicationSheetChanged,
  openedFromApp,
} from "./medicationSheets";

const G = "g1";
const LIST = `/app/groups/${G}/medications`;
const url = (path: string) => new URL(`http://x${path}`);

describe("newMedicationGuard", () => {
  it("opens the add sheet for a writer", () => {
    expect(newMedicationGuard({ groupId: G, search: "", canWrite: true })).toEqual({ sheet: true });
  });
  it("sends a viewer to the list, search kept", () => {
    expect(newMedicationGuard({ groupId: G, search: "?q=lis", canWrite: false })).toEqual({
      redirect: `${LIST}?q=lis`,
    });
  });
});

describe("editMedicationGuard", () => {
  const live = { id: "m1", groupId: G, deletedAt: null };
  it("opens a live medication in this group for a writer", () => {
    expect(editMedicationGuard({ groupId: G, search: "", canWrite: true, medication: live })).toEqual({
      sheet: live,
    });
  });
  it("sends a viewer, a missing, a deleted and another group's medication to the list", () => {
    const list = { redirect: `${LIST}?status=current` };
    const search = "?status=current";
    expect(editMedicationGuard({ groupId: G, search, canWrite: false, medication: live })).toEqual(list);
    expect(editMedicationGuard({ groupId: G, search, canWrite: true, medication: null })).toEqual(list);
    expect(
      editMedicationGuard({ groupId: G, search, canWrite: true, medication: { ...live, deletedAt: "x" } }),
    ).toEqual(list);
    expect(
      editMedicationGuard({ groupId: G, search, canWrite: true, medication: { ...live, groupId: "g2" } }),
    ).toEqual(list);
  });
});

describe("onlyMedicationSheetChanged", () => {
  it("is true between the list and its sheets", () => {
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${LIST}/new`))).toBe(true);
    expect(onlyMedicationSheetChanged(G, url(`${LIST}/m1/edit`), url(`${LIST}?q=a`))).toBe(true);
    expect(onlyMedicationSheetChanged(G, url(`${LIST}/new`), url(`${LIST}/m1/edit`))).toBe(true);
  });
  it("is false for a medication's page, the print sheet, another group or the same path", () => {
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${LIST}/m1`))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`${LIST}/print`))).toBe(false);
    expect(onlyMedicationSheetChanged(G, url(LIST), url(`/app/groups/g2/medications/new`))).toBe(false);
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
