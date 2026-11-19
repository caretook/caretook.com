import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import { DEFAULT_EVENT_TITLE } from "./liveEntry";
import { fold } from "./providerDirectory";

// Provider suggestions for a note or event with no providers yet: one-tap
// chips in the entry header's With row. Pure (no database or React), so
// web:unit tests it; lib/sync/providerSuggestions.ts reads the rows.

/** At most this many chips. */
export const PROVIDER_SUGGESTION_LIMIT = 5;

/** A link counts half as much after this long, so this month's providers outrank last season's. */
export const PROVIDER_SUGGESTION_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

/** Shorter words never match a name ("Dr", "Li", "of"). */
export const MIN_WORD_LENGTH = 3;

/** Titles and credentials around a name, never matched on their own. */
export const HONORIFICS: ReadonlySet<string> = new Set([
  "dr",
  "doctor",
  "mr",
  "mrs",
  "ms",
  "mx",
  "miss",
  "prof",
  "professor",
  "md",
  "do",
  "np",
  "pa",
  "rn",
  "lpn",
  "phd",
  "dds",
  "dmd",
  "dpm",
  "pharmd",
  "jr",
  "sr",
]);

export type SuggestibleProvider = {
  id: string;
  type: ProviderType;
  name: string;
  status: ProviderStatus;
  deletedAt: string | null;
};

/** One link from the group's history: who was linked to which entry, with its title, and when. */
export type LinkUse = {
  providerId: string;
  entryId: string;
  title: string | null;
  /** When the link was made (ISO 8601). */
  linkedAt: string | null;
};

export type SuggestInput<P extends SuggestibleProvider> = {
  /** The entry's title as it is now (typed or saved). */
  title: string | null;
  /** The entry's document text. */
  text: string | null;
  /** The group's providers (deleted and past ones are left out here). */
  providers: readonly P[];
  /** The group's recent links. */
  history: readonly LinkUse[];
  /** Defaults to the current time. */
  now?: number;
  limit?: number;
  /** The entry itself: its own links never count as history. */
  entryId?: string;
  /** Providers not to suggest (linked already). */
  exclude?: Iterable<string>;
};

/** The words of a name or text, folded (case and accents), without honorifics. */
export const nameWords = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !HONORIFICS.has(w));

/** Whether a word is long enough to match on its own. */
const significant = (word: string | undefined) => !!word && word.length >= MIN_WORD_LENGTH;

/**
 * A title as a key for "the same title": folded, punctuation and spacing
 * ignored. Blank and the default "Event" are no title.
 */
export const titleKey = (title: string | null) => {
  const key = fold(title ?? "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(" ");
  return key && key !== DEFAULT_EVENT_TITLE.toLowerCase() ? key : null;
};

/** People are matched by last name too; practices and pharmacies by their whole name. */
const isPerson = (type: ProviderType) => type === "clinician" || type === "other";

/**
 * Where the provider's name is in `words` (an index), or null: the whole
 * name as consecutive words (with at least one word of 3 letters or more),
 * else (for a person) the last name as a word, if it has 3 letters or more.
 */
const matchAt = (name: readonly string[], person: boolean, words: readonly string[]) => {
  if (!name.some(significant)) return null;
  for (let i = 0; i + name.length <= words.length; i++) {
    if (name.every((w, j) => words[i + j] === w)) return { at: i, full: true };
  }
  if (person && significant(name.at(-1))) {
    const at = words.indexOf(name.at(-1)!);
    if (at >= 0) return { at, full: false };
  }
  return null;
};

const decay = (iso: string | null, now: number) => {
  const at = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(at)) return null;
  // A link "from the future" (clock skew) counts as now.
  return { at, weight: 0.5 ** (Math.max(0, now - at) / PROVIDER_SUGGESTION_HALF_LIFE_MS) };
};

/** Provider ids by their links' summed, decayed weight, best first (ties: the more recent). */
const rankLinks = (uses: readonly LinkUse[], now: number) => {
  const scores = new Map<string, { score: number; last: number }>();
  for (const use of uses) {
    const d = decay(use.linkedAt, now);
    if (!d) continue;
    const seen = scores.get(use.providerId);
    if (!seen) scores.set(use.providerId, { score: d.weight, last: d.at });
    else {
      seen.score += d.weight;
      seen.last = Math.max(seen.last, d.at);
    }
  }
  return [...scores.entries()]
    .sort(([a, x], [b, y]) => y.score - x.score || y.last - x.last || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id]) => id);
};

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * Up to `limit` providers to suggest for an entry, best first:
 *
 * 1. Providers named in the title, then in the text (case-insensitive whole
 *    words: a clinician's or other contact's full or last name, a practice's
 *    or pharmacy's full name), earliest mention first.
 * 2. Providers linked to earlier entries with the same title.
 * 3. Providers linked recently (a 14-day half-life, so often and lately wins).
 *
 * Only current, not deleted providers; each once.
 */
export function suggestProviders<P extends SuggestibleProvider>({
  title,
  text,
  providers,
  history,
  now = Date.now(),
  limit = PROVIDER_SUGGESTION_LIMIT,
  entryId,
  exclude = [],
}: SuggestInput<P>): P[] {
  const excluded = new Set(exclude);
  const eligible = new Map(
    providers
      .filter((p) => !p.deletedAt && p.status === "current" && !excluded.has(p.id))
      .map((p) => [p.id, p]),
  );
  const out: P[] = [];
  const add = (id: string) => {
    const p = eligible.get(id);
    if (!p) return;
    eligible.delete(id);
    out.push(p);
  };

  // 1. Named in the title or text.
  const key = titleKey(title);
  const titleWords = key ? nameWords(title ?? "") : [];
  const textWords = nameWords(text ?? "");
  const named = [...eligible.values()].flatMap((p) => {
    const name = nameWords(p.name);
    const person = isPerson(p.type);
    const inTitle = matchAt(name, person, titleWords);
    const found = inTitle ? { where: 0, ...inTitle } : { where: 1, ...matchAt(name, person, textWords) };
    return found.at === undefined ? [] : [{ p, where: found.where, at: found.at, full: found.full! }];
  });
  named
    .sort(
      (a, b) =>
        a.where - b.where ||
        a.at - b.at ||
        Number(b.full) - Number(a.full) ||
        collator.compare(a.p.name, b.p.name),
    )
    .forEach((m) => add(m.p.id));

  // 2. Linked to earlier entries with this title. 3. Linked recently.
  const earlier = history.filter((use) => use.entryId !== entryId);
  if (key)
    rankLinks(
      earlier.filter((use) => titleKey(use.title) === key),
      now,
    ).forEach(add);
  rankLinks(earlier, now).forEach(add);

  return out.slice(0, Math.max(0, limit));
}
