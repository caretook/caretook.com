import type { MedicationType } from "./medication";

import { MEDICATION_TYPES } from "./medication";

// How a medication's type reads: the form's choice, the list's badge, the
// medication page, the printed list's groups, search and the connector all
// take their words from here. A type that isn't set (medications added
// before types existed) reads "Type not set" and has no badge. Pure.

/** The type's name: the form's choice, the medication page, search and the connector. */
export const MEDICATION_TYPE_LABELS: Record<MedicationType, string> = {
  prescription: "Prescription",
  otc: "Over the counter",
  supplement: "Supplement",
  other: "Other",
};

/** The list's badge. */
export const MEDICATION_TYPE_BADGES: Record<MedicationType, string> = {
  prescription: "Rx",
  otc: "OTC",
  supplement: "Supplement",
  other: "Other",
};

/** What a medication with no type says. */
export const TYPE_NOT_SET = "Type not set";

/** The type's label, or "Type not set". */
export const medicationTypeLabel = (type: MedicationType | null | undefined) =>
  type ? MEDICATION_TYPE_LABELS[type] : TYPE_NOT_SET;

/** The list's badge, or null when the type isn't set (the list claims nothing it doesn't know). */
export const medicationTypeBadge = (type: MedicationType | null | undefined) =>
  type ? MEDICATION_TYPE_BADGES[type] : null;

/** The medication page's Type row: "Over the counter", or "not set" (after "Type: "). */
export const medicationTypeDetail = (type: MedicationType | null | undefined) =>
  type ? MEDICATION_TYPE_LABELS[type] : "not set";

/** The printed list's groups, in order: each type, then the medications with none. */
export const MEDICATION_TYPE_GROUPS: readonly (MedicationType | null)[] = [...MEDICATION_TYPES, null];

const GROUP_HEADINGS: Record<MedicationType, string> = {
  prescription: "Prescriptions",
  otc: "Over the counter",
  supplement: "Supplements",
  other: "Other",
};

/** A printed group's heading. */
export const medicationTypeGroupHeading = (type: MedicationType | null) =>
  type ? GROUP_HEADINGS[type] : TYPE_NOT_SET;
