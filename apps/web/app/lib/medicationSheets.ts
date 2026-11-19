import { appUrls } from "./appUrls";

// The medication list's sheet routes (`medications/new`,
// `medications/:medicationId/edit`): which sheet a URL opens, or where it
// goes instead, and the history state that lets a sheet go back to where it
// was opened from (the list, or a medication's page). Pure, so web:unit tests
// it; the routes apply it. Like the directory's `providerSheetGuard`. It lives
// in lib/ because the medication page opens the edit sheet too.

/** History state on a link that opens a medication sheet (from the list or a medication's page). */
export const MEDICATION_SHEET_STATE = { medicationSheet: true } as const;

/** Whether a sheet was opened by one of this app's links (so closing it can go back). */
export const openedFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "medicationSheet" in state;

/** What a sheet URL shows: its sheet, or a redirect (the list, with its search kept). */
export type MedicationSheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

/** `medications/new`: the add sheet, for writers; a viewer gets the list. */
export const newMedicationGuard = ({
  groupId,
  search,
  canWrite,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
}): MedicationSheetDecision<true> =>
  canWrite ? { sheet: true } : { redirect: appUrls.medications(groupId, search) };

/** `medications/allergies`: the allergies sheet, for writers; a viewer gets the list. */
export const allergiesSheetGuard = newMedicationGuard;

/**
 * `medications/:medicationId/edit`: a live medication in this group, for a
 * writer. A viewer, and a medication that's missing, deleted or in another
 * group, get the list (with no names: they all look the same).
 */
export const editMedicationGuard = <M extends { groupId: string; deletedAt: string | null }>({
  groupId,
  search,
  canWrite,
  medication,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
  medication: M | null;
}): MedicationSheetDecision<M> => {
  if (!canWrite || !medication || medication.groupId !== groupId || medication.deletedAt)
    return { redirect: appUrls.medications(groupId, search) };
  return { sheet: medication };
};

/** The list, or one of its sheets: `medications`, `medications/new`, `medications/allergies`, `medications/<id>/edit`. */
const isListOrSheet = (groupId: string, pathname: string) => {
  const base = appUrls.medications(groupId);
  if (pathname === base || pathname === `${base}/new` || pathname === appUrls.medicationAllergies(groupId))
    return true;
  if (!pathname.startsWith(`${base}/`)) return false;
  const rest = pathname.slice(base.length + 1).split("/");
  return rest.length === 2 && rest[0] !== "" && rest[1] === "edit";
};

/**
 * True when a navigation only opens or closes a sheet over the list: both
 * ends are this group's list or a sheet over it. The list keeps what it
 * loaded (its live query follows every change anyway).
 */
export const onlyMedicationSheetChanged = (groupId: string, current: URL, next: URL) =>
  current.pathname !== next.pathname &&
  isListOrSheet(groupId, current.pathname) &&
  isListOrSheet(groupId, next.pathname);
