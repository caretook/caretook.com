import type { ParsedSearch, SearchTerm } from "@caretook/data/domain";
import { foldSearchText, isEmptySearch } from "@caretook/data/domain";

// Search by tag name (tags-3), pure: which of the group's tags a search
// names. The tags stay out of the index (`search.sync.ts` joins the links
// at query time), so their names are matched here, by the parser's folding
// (case and accents) and the same word rules as the index's prefixes.

/** A name's words, as the parser reads text: folded runs of letters and digits. */
const nameWords = (name: string) => foldSearchText(name).match(/[\p{L}\p{N}]+/gu) ?? [];

/** The term's words at `start` in `words`, in order; a prefix term's last word may be the start of a longer one. */
const termAt = (words: readonly string[], term: SearchTerm, start: number) =>
  term.words.every((word, k) => {
    const name = words[start + k];
    if (name === undefined) return false;
    return term.prefix && k === term.words.length - 1 ? name.startsWith(word) : name === word;
  });

/** A word or phrase anywhere in the name's words. */
const hasTerm = (words: readonly string[], term: SearchTerm) =>
  words.some((_, start) => termAt(words, term, start));

/**
 * The ids of the tags a search names: every included term found in the
 * tag's name ("blood" and "press" both start a word of "Blood pressure", in
 * any order; "bloods" doesn't), and no excluded one. None for an empty or
 * exclusion-only search, which matches nothing.
 */
export const matchingTagIds = (tags: readonly { id: string; name: string }[], parsed: ParsedSearch) => {
  if (isEmptySearch(parsed)) return [];
  return tags.flatMap((tag) => {
    const words = nameWords(tag.name);
    const named =
      parsed.include.every((term) => hasTerm(words, term)) &&
      !parsed.exclude.some((term) => hasTerm(words, { ...term, prefix: false }));
    return named ? [tag.id] : [];
  });
};
