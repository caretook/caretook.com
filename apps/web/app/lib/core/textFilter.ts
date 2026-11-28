import { foldSearchText } from "@caretook/data/domain";

// A list's quick text filter (the search box of `SearchFilterBar`): every
// word typed must appear somewhere in the item's text, case and accents
// ignored (`foldSearchText`), on the device, so it works offline. Pure, so
// web:unit tests it.

/** The words of what was typed, folded. Nothing typed is no words. */
export const textTokens = (q: string) => foldSearchText(q).split(/\s+/).filter(Boolean);

/** Whether every word appears in one of `fields` (no words match everything). */
export const matchesText = (tokens: readonly string[], ...fields: (string | null | undefined)[]) => {
  if (tokens.length === 0) return true;
  const haystack = foldSearchText(fields.filter(Boolean).join(" "));
  return tokens.every((token) => haystack.includes(token));
};

/** How a filtered empty list names the text: ` matching “…”`, or nothing without one. */
export const matchingText = (q: string) => (q.trim() ? ` matching “${q.trim()}”` : "");
