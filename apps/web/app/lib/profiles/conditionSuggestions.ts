import { suggestNames } from "../core/nameSuggestions";
import { CONDITION_NAMES } from "./conditionNames";

// The condition name field's suggestions: the group's own names first, then
// the curated list, through the shared matcher (`suggestNames`). Pure:
// web:unit tests it.

export const CONDITION_SUGGESTION_LIMIT = 20;

/** Up to `limit` condition names for what's typed (see `suggestNames`). */
export const conditionSuggestions = (
  query: string,
  groupNames: readonly string[],
  { names = CONDITION_NAMES, limit = CONDITION_SUGGESTION_LIMIT } = {},
): string[] => suggestNames(query, groupNames, names, limit);
