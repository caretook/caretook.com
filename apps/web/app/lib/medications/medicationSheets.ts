import type { MedicationsPageTab, MedicationTab } from "./urls";

import { appUrls } from "../app-shell/appUrls";

// The sheet routes over the Medications tabs (`medications/<tab>/new`,
// `medications/<tab>/:medicationId/edit`, `medications/<tab>/allergies`, for
// the Schedule and list tabs; `medications/passes/new` over Passes): which tab a URL is on, which sheet it opens or
// where it goes instead, and the history state that lets a sheet go back to
// where it was opened from (a tab, or a medication's page). Pure, so web:unit tests
// it; the routes apply it. Like the directory's `providerSheetGuard`. It lives
// in lib/ because the medication page opens the edit sheet too.

/** History state on a link that opens a medication sheet (from a tab or a medication's page). */
export const MEDICATION_SHEET_STATE = { medicationSheet: true } as const;

/** Whether a sheet was opened by one of this app's links (so closing it can go back). */
export const openedFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "medicationSheet" in state;

/** What a sheet URL shows: its sheet, or a redirect (the tab underneath, with its search kept). */
export type MedicationSheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

const TABS: readonly MedicationsPageTab[] = ["schedule", "list", "passes"];

/** A tab's own path. */
const tabBase = (groupId: string, tab: MedicationsPageTab) =>
  tab === "passes" ? appUrls.medicationPasses(groupId) : appUrls.medicationTab(groupId, tab);

/**
 * The tab a pathname is on, or under (a sheet over it): `medications/schedule…`,
 * `medications/list…` or `medications/passes…`. Null elsewhere (a medication's page, print).
 */
export const medicationTabOf = (groupId: string, pathname: string): MedicationsPageTab | null => {
  for (const tab of TABS) {
    const base = tabBase(groupId, tab);
    if (pathname === base || pathname.startsWith(`${base}/`)) return tab;
  }
  return null;
};

/** The tab a medication sheet's URL opens over: its own tab, else (Passes, elsewhere) the list. */
export const sheetTab = (groupId: string, pathname: string): MedicationTab => {
  const tab = medicationTabOf(groupId, pathname);
  return tab === "schedule" || tab === "list" ? tab : "list";
};

/** `medications/<tab>/new`: the add sheet, for writers; a viewer gets the tab. */
export const newMedicationGuard = ({
  groupId,
  tab,
  search,
  canWrite,
}: {
  groupId: string;
  tab: MedicationTab;
  search: string;
  canWrite: boolean;
}): MedicationSheetDecision<true> =>
  canWrite ? { sheet: true } : { redirect: appUrls.medicationTab(groupId, tab, search) };

/** `medications/<tab>/allergies`: the allergies sheet, for writers; a viewer gets the tab. */
export const allergiesSheetGuard = newMedicationGuard;

/**
 * `medications/<tab>/:medicationId/edit`: a live medication in this group,
 * for a writer. A viewer, and a medication that's missing, deleted or in
 * another group, get the tab (with no names: they all look the same).
 */
export const editMedicationGuard = <M extends { groupId: string; deletedAt: string | null }>({
  groupId,
  tab,
  search,
  canWrite,
  medication,
}: {
  groupId: string;
  tab: MedicationTab;
  search: string;
  canWrite: boolean;
  medication: M | null;
}): MedicationSheetDecision<M> => {
  if (!canWrite || !medication || medication.groupId !== groupId || medication.deletedAt)
    return { redirect: appUrls.medicationTab(groupId, tab, search) };
  return { sheet: medication };
};

/**
 * The tab whose page, or one of whose sheets (`new`, `allergies`, `<id>/edit`;
 * Passes: `new`), `pathname` is; else null.
 */
const tabOrSheet = (groupId: string, pathname: string): MedicationsPageTab | null => {
  const tab = medicationTabOf(groupId, pathname);
  if (!tab) return null;
  const base = tabBase(groupId, tab);
  if (pathname === base) return tab;
  const rest = pathname.slice(base.length + 1).split("/");
  if (tab === "passes") return rest.length === 1 && rest[0] === "new" ? tab : null;
  if (rest.length === 1 && (rest[0] === "new" || rest[0] === "allergies")) return tab;
  return rest.length === 2 && rest[0] !== "" && rest[1] === "edit" ? tab : null;
};

/**
 * True when a navigation only opens or closes a sheet over a tab: both ends
 * are the same tab of this group, or a sheet over it. The tab keeps what it
 * loaded (its live queries follow every change anyway). A switch between
 * tabs isn't: the other tab loads.
 */
export const onlyMedicationSheetChanged = (groupId: string, current: URL, next: URL) => {
  if (current.pathname === next.pathname) return false;
  const tab = tabOrSheet(groupId, current.pathname);
  return tab !== null && tab === tabOrSheet(groupId, next.pathname);
};

/** History state on the Passes tab's own links to the add-pass sheet (so closing it goes back there). */
export const PASS_SHEET_STATE = { passSheet: true } as const;

/** Whether the add-pass sheet was opened from the Passes tab (closing goes back; else it replaces with the tab). */
export const openedFromPasses = (state: unknown) =>
  typeof state === "object" && state !== null && "passSheet" in state;

/**
 * `medications/passes/new`: the add-pass sheet, for a writer while the group
 * has room for another pass; a viewer, or a full group, gets the Passes tab.
 */
export const newPassGuard = ({
  groupId,
  canWrite,
  canAdd,
}: {
  groupId: string;
  canWrite: boolean;
  canAdd: boolean;
}): MedicationSheetDecision<true> =>
  canWrite && canAdd ? { sheet: true } : { redirect: appUrls.medicationPasses(groupId) };
