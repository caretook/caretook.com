import { HONORIFICS } from "@caretook/data/schema";
import { fold } from "../providers/providerDirectory";

// Quick entry's name autocomplete: while the last word typed is the start of
// one of the group's medication, pass or provider names, offer the name; picking
// it completes the word (with any title or first name typed before it).
// Matching folds case and accents and skips honorifics, as the medication
// and provider suggestions do. Pure; web:unit tests it.

/** The last word must be at least this long to match. */
export const COMPLETION_MIN_LENGTH = 2;
/** At most this many names are offered. */
export const COMPLETION_LIMIT = 4;

export type CompletionName = { id: string; name: string; kind: "medication" | "pass" | "provider" };

/** Medications first, then passes, then providers. */
const KIND_ORDER: Record<CompletionName["kind"], number> = { medication: 0, pass: 1, provider: 2 };

/** A name to offer, and the line with it completed (ending in a space, ready for the rest). */
export type Completion = CompletionName & { text: string };

const core = (word: string) => fold(word).replace(/[^\p{L}\p{N}]/gu, "");
const wordsOf = (name: string) =>
  fold(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * The names that the word being typed at the end of `text` starts (a word
 * of the name, never a title like "Dr"), best first: names whose first word
 * it starts, then a later word ("acid" finds "Folic acid", "le" finds
 * "Dr. Sandra Lee"); medications, then passes, then providers. Nothing while the line
 * is blank or ends in a space, and nothing already typed in full. The
 * completed text replaces that word, and the words just before it that are
 * part of the name or a title ("dr san" becomes "Dr. Sandra Lee ").
 */
export function completeName(
  text: string,
  names: readonly CompletionName[],
  limit = COMPLETION_LIMIT,
): Completion[] {
  if (!text || /\s$/.test(text)) return [];
  // Only the part being typed: after the last comma, semicolon or line break.
  const partStart = Math.max(text.lastIndexOf(","), text.lastIndexOf(";"), text.lastIndexOf("\n")) + 1;
  const tokens = [...text.slice(partStart).matchAll(/\S+/g)].map((m) => ({
    word: core(m[0]),
    at: partStart + m.index,
  }));
  const last = tokens.at(-1);
  if (!last || last.word.length < COMPLETION_MIN_LENGTH) return [];

  const seen = new Set<string>();
  const found: { completion: Completion; rank: number }[] = [];
  for (const candidate of names) {
    const words = wordsOf(candidate.name);
    const key = words.join(" ");
    if (!key || seen.has(key)) continue;
    const significant = words.map((w) => !HONORIFICS.has(w));
    const index = words.findIndex((w, i) => significant[i] && w.startsWith(last.word));
    if (index < 0) continue;

    // Take in the words typed just before it that are titles or earlier words of the name.
    let start = tokens.length - 1;
    while (start > 0) {
      const prev = tokens[start - 1]!.word;
      const inName = words.slice(0, index).some((w) => prev && w.startsWith(prev));
      if (!prev || !(HONORIFICS.has(prev) || inName)) break;
      start -= 1;
    }
    const typed = tokens
      .slice(start)
      .map((t) => t.word)
      .join(" ");
    const fullName = words.filter((_, i) => significant[i]).join(" ");
    if (typed === key || typed === fullName) continue;

    seen.add(key);
    const first = significant.indexOf(true);
    found.push({
      completion: { ...candidate, text: `${text.slice(0, tokens[start]!.at)}${candidate.name.trim()} ` },
      rank: index === first ? 0 : 1,
    });
  }
  return found
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        KIND_ORDER[a.completion.kind] - KIND_ORDER[b.completion.kind] ||
        collator.compare(a.completion.name, b.completion.name),
    )
    .slice(0, Math.max(0, limit))
    .map((f) => f.completion);
}
