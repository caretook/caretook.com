import type { Search } from "../core/urls";

import { groupHome, searchString, segment } from "../core/urls";

export const medicationUrls = {
  /** A group's medication list, with its search and status filter (`?q=`, `?status=`) carried through. */
  medications: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/medications${searchString(search)}`,
  /** A medication's page: details, schedule, providers, refills, its live notes and its history. */
  medication: (groupId: string, medicationId: string) =>
    `${groupHome(groupId)}/medications/${segment(medicationId)}`,
  /** The printable medication sheet: current and recently stopped medications, and who to call. */
  medicationsPrint: (groupId: string) => `${groupHome(groupId)}/medications/print`,
  /** The add sheet over the medication list, carrying the list's search and status filter. */
  newMedication: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/medications/new${searchString(search)}`,
  /** The edit sheet for one medication, over the list, carrying the list's search and status filter. */
  editMedication: (groupId: string, medicationId: string, search?: Search) =>
    `${groupHome(groupId)}/medications/${segment(medicationId)}/edit${searchString(search)}`,
  /** The group's medication passes (Morning, Evening…), with the medications in each. */
  medicationPasses: (groupId: string) => `${groupHome(groupId)}/medications/passes`,
  /** The allergies sheet over the medication list (writers), carrying the list's search and status filter. */
  medicationAllergies: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/medications/allergies${searchString(search)}`,
  /** The weekly bedside sheet, starting on `start` ("YYYY-MM-DD"; none is this week). */
  medicationsPrintWeek: (groupId: string, start?: string | null) =>
    `${groupHome(groupId)}/medications/print/week${searchString({ start })}`,
} as const;
