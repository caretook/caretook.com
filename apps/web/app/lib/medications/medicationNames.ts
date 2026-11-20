import { fold } from "../providers/providerDirectory";

// Name suggestions for the medication form: names the group has used
// before (any status), so a restart is quick and spelled the same. Pure; the
// form reads the names with `medicationNamesQuery` (most recently saved
// first) and web:unit tests this.

/** How many names are suggested at most. */
export const NAME_SUGGESTION_LIMIT = 5;

/**
 * The group's names that match what's typed, case and accents ignored:
 * names that start with it first, then names with a later word that starts
 * with it ("acid" finds "Folic acid"), each group in the order given. Each
 * name once (whatever its case); nothing for empty text, and nothing that's
 * already exactly what's typed.
 */
export const suggestMedicationNames = (
  typed: string,
  groupMedications: readonly { name: string }[],
  limit = NAME_SUGGESTION_LIMIT,
): string[] => {
  const text = fold(typed.trim());
  if (!text) return [];
  const seen = new Set<string>();
  const prefix: string[] = [];
  const word: string[] = [];
  for (const { name } of groupMedications) {
    const trimmed = name.trim();
    const folded = fold(trimmed);
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    if (folded === text) continue;
    if (folded.startsWith(text)) prefix.push(trimmed);
    else if (folded.split(/[\s\-/(]+/).some((w, i) => i > 0 && w.startsWith(text))) word.push(trimmed);
  }
  return [...prefix, ...word].slice(0, limit);
};
