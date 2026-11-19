// The search query language, shared by the device (SQLite FTS5) and the
// server (Postgres full-text search). Pure and client-safe.
//
//   words        every word must match, each as a prefix ("pres" finds "pressure")
//   "a phrase"   the words in order
//   -word        leaves out entries with that word (or -"a phrase")
//
// Anything else (operators, punctuation, an unbalanced quote) is plain text,
// never syntax that can fail. Case and accents are folded here; stemming
// ("walked" finds "walking") is the tokenizer's (FTS5 `porter`, Postgres
// `english`). This module is the only place a match string is built.

/** Longest query text read; the rest is ignored. */
export const SEARCH_MAX_LENGTH = 200;
/** Most terms (included and excluded) read; more are ignored, keeping the match expression small. */
export const SEARCH_MAX_TERMS = 12;

/**
 * One searched-for thing: a word, or several words that must be adjacent and
 * in order (a quoted phrase, or a typed word with punctuation inside, such
 * as "O'Brien" or "x-ray", which the tokenizers split too). `prefix`: the
 * last word may be the start of a longer one.
 */
export type SearchTerm = { words: string[]; prefix: boolean };

export type ParsedSearch = { include: SearchTerm[]; exclude: SearchTerm[] };

/** Lowercase, without accents (NFKD, combining marks dropped). */
export const foldSearchText = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

/** The words of a piece of text, as the tokenizers see them: runs of letters and digits. */
const wordsOf = (text: string) => foldSearchText(text).match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Read what the user typed. Never fails: text it can't read as syntax is
 * read as words.
 */
export const parseSearch = (text: string): ParsedSearch => {
  const input = text.slice(0, SEARCH_MAX_LENGTH);
  const include: SearchTerm[] = [];
  const exclude: SearchTerm[] = [];
  const add = (words: string[], { exclude: excluded, prefix }: { exclude: boolean; prefix: boolean }) => {
    if (!words.length || include.length + exclude.length >= SEARCH_MAX_TERMS) return;
    // An excluded word is excluded as typed (with its word forms), never as a prefix.
    (excluded ? exclude : include).push({ words, prefix: prefix && !excluded });
  };

  // A quoted phrase (with an optional leading "-"), or a run of anything but
  // spaces and quotes. A quote with no closing partner falls through to the
  // second branch, so its words are read as plain words.
  const token = /(-?)"([^"]*)"|[^\s"]+/gu;
  for (const m of input.matchAll(token)) {
    if (m[2] !== undefined) {
      add(wordsOf(m[2]), { exclude: m[1] === "-", prefix: false });
      continue;
    }
    const raw = m[0];
    const excluded = raw.length > 1 && raw.startsWith("-") && /[\p{L}\p{N}]/u.test(raw[1] ?? "");
    const words = wordsOf(excluded ? raw.slice(1) : raw);
    // Several words from one typed token ("o'brien") stay together, as the tokenizers keep them adjacent.
    add(words, { exclude: excluded, prefix: true });
  }
  return { include, exclude };
};

/** Nothing to look for: no words, or only exclusions. Such a search matches nothing. */
export const isEmptySearch = (parsed: ParsedSearch) => parsed.include.length === 0;

/**
 * Endings a partly typed word may be on its way to. A stemming tokenizer
 * indexes "walking" as "walk", so the prefix "walki" matches nothing;
 * completing it to "walking" (which the tokenizer then stems) finds it.
 */
const ENDINGS = ["ing", "ed", "ies", "ation", "ness", "ment", "ly"];
const MIN_STEM = 3;

/**
 * A prefix word and the words it may be the start of whose stems it runs
 * past: "walki" → ["walki", "walking", "walkies"]. The tokenizer stems each
 * one, so together they match what the typed prefix alone would miss.
 */
export const prefixForms = (word: string): string[] => {
  const forms = new Set([word]);
  for (const ending of ENDINGS) {
    for (let k = ending.length - 1; k >= 1; k--) {
      const typed = ending.slice(0, k);
      if (word.endsWith(typed) && word.length - k >= MIN_STEM) forms.add(word + ending.slice(k));
    }
  }
  return [...forms];
};

// ---------------------------------------------------------------------------
// SQLite FTS5
// ---------------------------------------------------------------------------

/** Words are letters and digits only, but quote them anyway: FTS5 reads bare AND, OR, NOT and NEAR as operators. */
const ftsString = (words: string[]) => `"${words.join(" ").replace(/"/g, '""')}"`;

const ftsTerm = (term: SearchTerm) => {
  if (!term.prefix) return ftsString(term.words);
  if (term.words.length > 1) return `${ftsString(term.words)}*`;
  const forms = prefixForms(term.words[0]!);
  const alternatives = forms.map((form) => `${ftsString([form])}*`);
  return alternatives.join(" OR ");
};

export type FtsMatchOptions = {
  /** Match the included terms in these columns only (exclusions still apply to every column). */
  columns?: string[];
};

/**
 * The FTS5 MATCH expression for a search, or null for an empty search
 * (which matches nothing: don't query). Pass it as a bound parameter.
 */
export const toFtsMatch = (parsed: ParsedSearch, { columns }: FtsMatchOptions = {}): string | null => {
  if (isEmptySearch(parsed)) return null;
  let match = parsed.include.map((term) => `(${ftsTerm(term)})`).join(" AND ");
  if (columns?.length) match = `({${columns.join(" ")}} : (${match}))`;
  else if (parsed.include.length > 1) match = `(${match})`;
  for (const term of parsed.exclude) match += ` NOT (${ftsString(term.words)})`;
  return match;
};

// ---------------------------------------------------------------------------
// Postgres tsquery
// ---------------------------------------------------------------------------

/** A quoted lexeme. Words are letters and digits only; quotes are doubled anyway. */
const tsLexeme = (word: string, prefix = false) => `'${word.replace(/'/g, "''")}'${prefix ? ":*" : ""}`;

const tsTerm = (term: SearchTerm) => {
  if (term.words.length > 1) {
    const last = term.words.length - 1;
    return `(${term.words.map((w, i) => tsLexeme(w, term.prefix && i === last)).join(" <-> ")})`;
  }
  if (!term.prefix) return tsLexeme(term.words[0]!);
  const forms = prefixForms(term.words[0]!).map((form) => tsLexeme(form, true));
  return forms.length === 1 ? forms[0]! : `(${forms.join(" | ")})`;
};

/**
 * The text for `to_tsquery('english', …)` (over the same `unaccent` as the
 * indexed text), or null for an empty search. Pass it as a bound parameter.
 */
export const toTsQuery = (parsed: ParsedSearch): string | null => {
  if (isEmptySearch(parsed)) return null;
  const parts = parsed.include.map(tsTerm);
  for (const term of parsed.exclude) parts.push(`!${tsTerm({ ...term, prefix: false })}`);
  return parts.join(" & ");
};
