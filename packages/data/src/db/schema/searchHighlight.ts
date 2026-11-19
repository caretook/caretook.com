// Why a result matched: the words of shown text that a search found, and a
// short snippet around the first of them. Pure and client-safe; the device
// renders the ranges as <mark>. It follows the parser's rules (`./search`):
// case and accents folded, every typed word a prefix (with `prefixForms`),
// quoted phrases in order, exclusions never marked, plus a light English
// stemmer standing in for the tokenizers' (so "walked" marks "walking").

import type { ParsedSearch, SearchTerm } from "./search";

import { foldSearchText, prefixForms } from "./search";

/** A matched stretch of text: `text.slice(start, end)`. Always whole words. */
export type HighlightRange = { start: number; end: number };

export type Snippet = {
  /** About `length` characters on word boundaries, whitespace collapsed, "…" where it was cut. */
  text: string;
  /** The matches within `text`. */
  ranges: HighlightRange[];
};

/** About this many characters of text around a match. */
export const SNIPPET_LENGTH = 120;
/** How much of the snippet comes before the match (the rest follows it). */
const LEAD = 0.3;

type Token = { start: number; end: number; word: string; stem: string };

const VOWEL = /[aeiouy]/;

/**
 * A word without its common English endings: "walking", "walked" and
 * "walks" are all "walk"; "hoping" and "hope" are both "hop". Rough on
 * purpose: both sides of a comparison go through it, so it only has to be
 * consistent, and close to what Porter folds together.
 */
export const wordStem = (word: string): string => {
  let w = word;
  if (w.length <= 3) return w;
  if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  for (const ending of ["ness", "ment", "ly", "ing", "ed"]) {
    const rest = w.slice(0, -ending.length);
    if (w.endsWith(ending) && rest.length >= 3 && VOWEL.test(rest)) {
      w = rest;
      // "hopping" → "hopp" → "hop" (not "ll", "ss" or "zz": "falling" → "fall").
      if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0, -1);
      break;
    }
  }
  if (w.endsWith("y") && w.length > 3) w = `${w.slice(0, -1)}i`;
  if (w.endsWith("e") && w.length > 3) w = w.slice(0, -1);
  return w;
};

/** The words of `text` where they stand: runs of letters, digits and their accents. */
const tokensOf = (text: string): Token[] => {
  const tokens: Token[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)) {
    const word = (foldSearchText(m[0]).match(/[\p{L}\p{N}]+/gu) ?? []).join("");
    if (!word) continue;
    tokens.push({ start: m.index, end: m.index + m[0].length, word, stem: wordStem(word) });
  }
  return tokens;
};

/** Does one shown word match one searched-for word? */
const wordMatches = (token: Token, word: string, prefix: boolean) => {
  if (token.word === word || token.stem === wordStem(word)) return true;
  return prefix && prefixForms(word).some((form) => token.word.startsWith(form));
};

/** Where `term` matches: one word, or its words on consecutive tokens. */
const termRanges = (tokens: Token[], term: SearchTerm): HighlightRange[] => {
  const ranges: HighlightRange[] = [];
  const last = term.words.length - 1;
  for (let i = 0; i + last < tokens.length; i++) {
    const all = term.words.every((word, k) => wordMatches(tokens[i + k]!, word, term.prefix && k === last));
    if (all) ranges.push({ start: tokens[i]!.start, end: tokens[i + last]!.end });
  }
  return ranges;
};

/**
 * The stretches of `text` the search's included words and phrases match, in
 * order, overlaps merged. Whole words only, so a screen reader never hears a
 * word split by a mark. Empty for no match (or no search).
 */
export const highlightRanges = (text: string | null | undefined, parsed: ParsedSearch): HighlightRange[] => {
  if (!text || parsed.include.length === 0) return [];
  const tokens = tokensOf(text);
  const found = parsed.include.flatMap((term) => termRanges(tokens, term)).sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const r of found) {
    const prev = merged.at(-1);
    if (prev && r.start <= prev.end) prev.end = Math.max(prev.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
};

/** Split `text` into plain and matched parts, for rendering. */
export const highlightParts = (text: string, ranges: readonly HighlightRange[]) => {
  const parts: { text: string; match: boolean }[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) parts.push({ text: text.slice(at, r.start), match: false });
    parts.push({ text: text.slice(r.start, r.end), match: true });
    at = r.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), match: false });
  return parts;
};

const SPACE = /\s/;

/**
 * About `length` characters of `text` around its first match, cut on word
 * boundaries with "…" at a cut, on one line, with its matches. Null when
 * nothing in the text matches.
 */
export const searchSnippet = (
  text: string | null | undefined,
  parsed: ParsedSearch,
  length = SNIPPET_LENGTH,
): Snippet | null => {
  if (!text) return null;
  const first = highlightRanges(text, parsed)[0];
  if (!first) return null;

  // Start a little before the match, at the start of a word.
  let start = Math.max(0, first.start - Math.round(length * LEAD));
  if (start > 0) {
    while (start < first.start && !SPACE.test(text[start - 1]!)) start++;
  }
  // End about `length` later (never before the match ends), at the end of a word.
  let end = Math.min(text.length, Math.max(start + length, first.end));
  if (end < text.length) {
    let cut = end;
    while (cut > first.end && !SPACE.test(text[cut]!)) cut--;
    end = cut > first.end ? cut : end;
    // A match too long for the window still ends at a word's end.
    while (end < text.length && !SPACE.test(text[end]!)) end++;
  }

  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  const snippet = `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
  return { text: snippet, ranges: highlightRanges(snippet, parsed) };
};

/** What a two-line clamp shows for sure on a phone: about this many characters, and two lines. */
export const CLAMP_VISIBLE = { chars: 80, lines: 2 };

/**
 * A snippet for text that's shown cut short (the timeline's two-line
 * clamp), when its first match is past what's shown: null when the text
 * has no match, or the match is already in view.
 */
export const snippetIfHidden = (
  text: string | null | undefined,
  parsed: ParsedSearch,
  visible: { chars: number; lines: number } = CLAMP_VISIBLE,
): Snippet | null => {
  if (!text) return null;
  const first = highlightRanges(text, parsed)[0];
  if (!first) return null;
  const linesBefore = text.slice(0, first.start).split("\n").length;
  if (first.end <= visible.chars && linesBefore <= visible.lines) return null;
  return searchSnippet(text, parsed);
};

/**
 * A snippet from a provider's or medication's notes when they're why it
 * matched: some searched-for word or phrase is in the notes but in none of
 * the `shown` texts (its name and details line). Null otherwise.
 */
export const notesSnippet = (
  shown: readonly (string | null | undefined)[],
  notes: string | null | undefined,
  parsed: ParsedSearch,
): Snippet | null => {
  if (!notes) return null;
  const visible = shown.filter(Boolean).join("\n");
  const onlyInNotes = parsed.include.some((term) => {
    const one = { include: [term], exclude: [] };
    return highlightRanges(visible, one).length === 0 && highlightRanges(notes, one).length > 0;
  });
  return onlyInNotes ? searchSnippet(notes, parsed) : null;
};
