import { foldSearchText } from "@caretook/data/domain";

// The shared matcher behind every free-text name field with suggestions (a
// condition, a medication, an allergy's substance and reaction): the group's
// own names first (so a second "Diabetes type 2" isn't made beside "Type 2
// diabetes"), then a curated list. Pure: web:unit tests it. Free text is
// always allowed; this only offers names.

/** How many names a field suggests unless it says otherwise. */
export const NAME_SUGGESTION_LIMIT = 20;

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
 * Up to `limit` names for what's typed: `groupNames`, then `curated`, each
 * in its own order, de-duplicated case- and accent-insensitively (the
 * group's spelling wins), blanks dropped. Every typed word must start a word
 * of the name, in any order. With nothing typed, the first of them.
 */
export const suggestNames = (
  query: string,
  groupNames: readonly string[],
  curated: readonly string[],
  limit = NAME_SUGGESTION_LIMIT,
): string[] => {
  const typed = words(query);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...groupNames, ...curated]) {
    if (out.length >= limit) break;
    const trimmed = name.trim();
    const key = foldSearchText(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    if (matches(typed, trimmed)) out.push(trimmed);
  }
  return out;
};
