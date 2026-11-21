import type { PickableProvider } from "../../../../lib/providers/providerPicker";

import { isPharmacyType, isPrescriberType } from "@caretook/data/schema";
import { canAddPicked, PICKER_LIMIT, pickerOptions } from "../../../../lib/providers/providerPicker";

// The medication form's prescriber and pharmacy pickers, their pure parts:
// which of the group's providers each offers for the typed text, and when to
// offer adding the typed name as a new one. No React or database; web:unit
// tests it (so imports stay relative). The shared picker rules are
// lib/providers/providerPicker.ts.

export type ProviderRole = "prescriber" | "pharmacy";
export type { PickableProvider } from "../../../../lib/providers/providerPicker";
export { chosenLabel, PICKER_LIMIT } from "../../../../lib/providers/providerPicker";

/** Whether a provider can fill the role: a clinician or practice prescribes, a pharmacy fills. */
export const fitsRole = (role: ProviderRole, type: string) =>
  role === "prescriber" ? isPrescriberType(type) : isPharmacyType(type);

/**
 * The picker's choices for `text`: the group's providers that fit the role
 * and aren't deleted, matching every typed word (name, specialty or
 * practice), in display order.
 */
export const providerOptions = (
  providers: readonly PickableProvider[],
  role: ProviderRole,
  text: string,
  limit = PICKER_LIMIT,
) => pickerOptions(providers, (type) => fitsRole(role, type), text, { limit });

/**
 * Whether to offer adding the typed name as a new prescriber or pharmacy:
 * there's text, and no live provider that fits the role has that name
 * already (case and accents ignored).
 */
export const canAddProvider = (providers: readonly PickableProvider[], role: ProviderRole, text: string) =>
  canAddPicked(providers, (type) => fitsRole(role, type), text);
