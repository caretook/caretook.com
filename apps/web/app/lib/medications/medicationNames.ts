import { suggestNames } from "../core/nameSuggestions";
import { MEDICATION_NAMES } from "./medicationNameList";

// Name suggestions for the medication name field (`NameField`): names the
// group has used before (any status, most recently saved first, as
// `medicationNamesQuery` reads them), so a restart is quick and spelled the
// same, then the curated list. Through the shared matcher (`suggestNames`).
// Pure: web:unit tests it.

/** How many names are suggested at most. */
export const MEDICATION_SUGGESTION_LIMIT = 20;

/** Up to `limit` medication names for what's typed: the group's first, then the curated list. */
export const medicationNameSuggestions = (
  query: string,
  groupMedications: readonly { name: string }[],
  { names = MEDICATION_NAMES, limit = MEDICATION_SUGGESTION_LIMIT } = {},
): string[] =>
  suggestNames(
    query,
    groupMedications.map((m) => m.name),
    names,
    limit,
  );
