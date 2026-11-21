import type { Search } from "../core/urls";

import { groupHome, searchString, segment } from "../core/urls";

/** The Medications page's tabs: Schedule (today's doses) and the list. A sheet opens over one of them. */
export type MedicationTab = "schedule" | "list";

const medicationsBase = (groupId: string) => `${groupHome(groupId)}/medications`;

export const medicationUrls = {
  /** The Schedule tab: today's doses, by pass. Where the Medications section opens. */
  medicationSchedule: (groupId: string) => `${medicationsBase(groupId)}/schedule`,
  /** The list tab, with its search and filters (`?q=`, `?status=`, `?type=`) carried through. */
  medicationList: (groupId: string, search?: Search) =>
    `${medicationsBase(groupId)}/list${searchString(search)}`,
  /** One of the two tabs, with a search carried through (what a sheet over it closes to). */
  medicationTab: (groupId: string, tab: MedicationTab, search?: Search) =>
    `${medicationsBase(groupId)}/${tab}${searchString(search)}`,
  /** A medication's page: details, schedule, providers, refills, its live notes and its history. */
  medication: (groupId: string, medicationId: string) =>
    `${medicationsBase(groupId)}/${segment(medicationId)}`,
  /** The printable medication sheet: current and recently stopped medications, and who to call. */
  medicationsPrint: (groupId: string) => `${medicationsBase(groupId)}/print`,
  /** The add sheet over a tab, carrying the tab's search. */
  newMedication: (groupId: string, tab: MedicationTab, search?: Search) =>
    `${medicationsBase(groupId)}/${tab}/new${searchString(search)}`,
  /** The edit sheet for one medication, over a tab, carrying the tab's search. */
  editMedication: (groupId: string, medicationId: string, tab: MedicationTab, search?: Search) =>
    `${medicationsBase(groupId)}/${tab}/${segment(medicationId)}/edit${searchString(search)}`,
  /** The group's medication passes (Morning, Evening…), with the medications in each. */
  medicationPasses: (groupId: string) => `${medicationsBase(groupId)}/passes`,
  /** The allergies sheet over a tab (writers), carrying the tab's search. */
  medicationAllergies: (groupId: string, tab: MedicationTab, search?: Search) =>
    `${medicationsBase(groupId)}/${tab}/allergies${searchString(search)}`,
  /** The weekly bedside sheet, starting on `start` ("YYYY-MM-DD"; none is this week). */
  medicationsPrintWeek: (groupId: string, start?: string | null) =>
    `${medicationsBase(groupId)}/print/week${searchString({ start })}`,
} as const;
