import { foldSearchText } from "@caretook/data/schema";
import { CONDITION_NAMES } from "./conditionNames";

// The condition name field's suggestions: the group's own names first (so a
// second "Diabetes type 2" isn't made beside "Type 2 diabetes"), then the
// curated list. Pure: web:unit tests it. Free text is always allowed; this
// only offers names.

export const CONDITION_SUGGESTION_LIMIT = 20;

const words = (text: string) =>
  foldSearchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Every typed word starts a word of the name ("diab" and "2" both find "Type 2 diabetes"). */
const matches = (typed: readonly string[], name: string) => {
  const nameWords = words(name);
  return typed.every((t) => nameWords.some((w) => w.startsWith(t)));
};

/**
 * Up to `limit` names for what's typed: the group's names, then the list,
 * each in its own order, de-duplicated case- and accent-insensitively (the
 * group's spelling wins). With nothing typed, the first of them.
 */
export const conditionSuggestions = (
  query: string,
  groupNames: readonly string[],
  { names = CONDITION_NAMES, limit = CONDITION_SUGGESTION_LIMIT } = {},
): string[] => {
  const typed = words(query);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...groupNames, ...names]) {
    if (out.length >= limit) break;
    const trimmed = name.trim();
    const key = foldSearchText(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    if (matches(typed, trimmed)) out.push(trimmed);
  }
  return out;
};
