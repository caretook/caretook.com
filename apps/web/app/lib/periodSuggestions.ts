import type { CarePeriodType, PeriodSpan, ProviderType, TrackPeriod } from "@caretook/data/schema";

import { periodAt } from "@caretook/data/schema";
import { fold } from "./providerDirectory";

// Period suggestions: an event whose title says the recipient moved
// ("Admitted to Mercy General", "Discharged home", "Hospice intake") offers
// to start that care period, prefilled. Pure (no database or React), so
// web:unit tests it; lib/sync/periodSuggestions.ts reads the rows.
//
// The rules, on the title's words (case, accents and punctuation ignored;
// "the", "a" and "an" skipped; whole words only):
// - Each type has phrases. A phrase inside a longer matching phrase doesn't
//   count ("hospice" inside "hospice house").
// - A phrase right after "from", "not", "no" or "outpatient" doesn't count:
//   that's where they left, or somewhere they didn't go.
// - A place ("rehab", "the ER", "discharged home") beats a bare move
//   ("admitted", "hospitalized"), so "Rehab admission" is rehab; among
//   equals the last one wins ("Admitted to rehab", "ER, then to hospital").
// - No suggestion when the period at the event's time already has that type,
//   for a future event (a period can't start in the future), or for Other.

type Rule = { type: CarePeriodType; phrases: readonly string[] };

/** Places: where the recipient is going. */
const PLACE_RULES: readonly Rule[] = [
  {
    type: "home",
    phrases: [
      "discharged home",
      "discharged to home",
      "discharge home",
      "discharge to home",
      "back home",
      "home from",
      "came home",
      "come home",
      "coming home",
      "went home",
      "going home",
      "returned home",
      "return home",
      "moved home",
      "home again",
    ],
  },
  {
    type: "emergency",
    phrases: ["er", "emergency room", "emergency department", "observation"],
  },
  {
    type: "hospital",
    phrases: ["to hospital", "into hospital", "in hospital", "hospital stay", "hospital admission"],
  },
  {
    type: "rehab",
    phrases: ["rehab", "rehabilitation", "skilled nursing", "snf"],
  },
  { type: "assistedLiving", phrases: ["assisted living"] },
  { type: "memoryCare", phrases: ["memory care"] },
  { type: "nursingHome", phrases: ["nursing home", "long term care"] },
  { type: "hospiceHome", phrases: ["hospice", "home hospice", "hospice at home"] },
  {
    type: "hospiceFacility",
    phrases: [
      "hospice facility",
      "hospice house",
      "hospice center",
      "hospice centre",
      "hospice unit",
      "inpatient hospice",
    ],
  },
];

/** Moves that say where without naming it: an admission is to hospital. */
const MOVE_RULES: readonly Rule[] = [
  {
    type: "hospital",
    phrases: ["admitted", "readmitted", "admission", "hospitalized", "hospitalised", "inpatient"],
  },
];

/** Skipped between words, so "to the hospital" is "to hospital". */
const ARTICLES: ReadonlySet<string> = new Set(["the", "a", "an"]);

/** A phrase right after one of these doesn't count. */
const BLOCKERS: ReadonlySet<string> = new Set(["from", "not", "no", "outpatient"]);

/** A title's words: folded, split on anything but letters and digits, articles dropped. */
export const suggestionWords = (title: string) =>
  fold(title)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !ARTICLES.has(w));

type Match = { type: CarePeriodType; start: number; end: number; place: boolean };

const matches = (words: readonly string[], rules: readonly Rule[], place: boolean): Match[] => {
  const found: Match[] = [];
  for (const rule of rules) {
    for (const phrase of rule.phrases) {
      const parts = phrase.split(" ");
      for (let i = 0; i + parts.length <= words.length; i++) {
        if (parts.every((p, j) => words[i + j] === p)) {
          found.push({ type: rule.type, start: i, end: i + parts.length, place });
        }
      }
    }
  }
  return found;
};

/** The period type an event's title suggests, or null. */
export const suggestedType = (title: string | null): CarePeriodType | null => {
  const words = suggestionWords(title ?? "");
  if (words.length === 0) return null;
  const all = [...matches(words, PLACE_RULES, true), ...matches(words, MOVE_RULES, false)];
  const outermost = all.filter(
    (m) =>
      !all.some((o) => o !== m && o.start <= m.start && o.end >= m.end && o.end - o.start > m.end - m.start),
  );
  const counted = outermost.filter((m) => !BLOCKERS.has(words[m.start - 1] ?? ""));
  if (counted.length === 0) return null;
  const tier = counted.some((m) => m.place) ? counted.filter((m) => m.place) : counted;
  // The last one wins; at the same start, the longer.
  const best = tier.reduce((a, b) => (b.start > a.start || (b.start === a.start && b.end > a.end) ? b : a));
  return best.type;
};

/** Types whose place is the recipient's home: a linked practice isn't where they are. */
const AT_HOME: ReadonlySet<CarePeriodType> = new Set(["home", "hospiceHome"]);

export type SuggestionProvider = { id: string; type: ProviderType; deletedAt: string | null };

export type PeriodSuggestion = {
  type: CarePeriodType;
  /** The event's start (ISO 8601): the period's start. */
  startsAt: string;
  /** An all-day event starts a date-only period. */
  dateOnly: boolean;
  /** The event's first linked practice, for a type away from home; else null. */
  placeProviderId: string | null;
};

/**
 * The period an event suggests starting, or null: from its title, unless
 * the period at the event's time already has that type, or the event is
 * still to come. `providers` are the event's linked providers, in link order.
 */
export const suggestPeriod = <P extends TrackPeriod & { type: string }>({
  title,
  occurredAt,
  allDay = false,
  spans,
  providers,
  now = Date.now(),
}: {
  title: string | null;
  occurredAt: string;
  allDay?: boolean;
  spans: readonly PeriodSpan<P>[];
  providers: readonly SuggestionProvider[];
  now?: number;
}): PeriodSuggestion | null => {
  const type = suggestedType(title);
  if (!type) return null;
  const at = Date.parse(occurredAt);
  if (!Number.isFinite(at) || at > now) return null;
  if (periodAt(spans, occurredAt)?.period.type === type) return null;
  const practice = AT_HOME.has(type)
    ? undefined
    : providers.find((p) => p.type === "practice" && !p.deletedAt);
  return {
    type,
    startsAt: new Date(at).toISOString(),
    dateOnly: allDay,
    placeProviderId: practice?.id ?? null,
  };
};
