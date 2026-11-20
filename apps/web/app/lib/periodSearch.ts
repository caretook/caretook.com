import type { PeriodSpan, TrackPeriod } from "@caretook/data/schema";
import type { PeriodWords } from "./periodDisplay";

import { periodRange } from "@caretook/data/schema";
import { dateText, periodName, periodTitle } from "./periodDisplay";

// Searching within one care period: the period choices the search page and
// the timeline's search offer, how a choice reads, and the time range a
// search is narrowed to. The range comes from the track (`periodRange`), so
// it follows edits to the periods. Pure (no React or database); web:unit
// tests it. Days are in the recipient's zone.

/** What a choice needs from a period: the track's fields, its words, and its place's name. */
export type SearchablePeriod = TrackPeriod & PeriodWords & { placeName?: string | null };

export type PeriodChoice = {
  id: string;
  /** "Rehab at Oak Hills", "Home", or Other's label. */
  name: string;
  /** "Nov 3 – Nov 12", or "Nov 13 – now" for the current period. */
  dates: string;
  /** ISO 8601; `to` is exclusive, and null while the period is current. */
  range: { from: string; to: string | null };
};

/** A period's name in a choice: its short type at its place ("Hospital at Mercy General"), else its title. */
export const periodWhere = (period: SearchablePeriod) =>
  period.placeName ? `${periodName(period)} at ${period.placeName}` : periodTitle(period);

/** "Nov 3 – Nov 12", or "Nov 13 – now" while it's current. */
export const periodDates = (span: PeriodSpan, timeZone: string, now: Date) =>
  `${dateText(span.startsAt, timeZone, now)} – ${span.endsAt ? dateText(span.endsAt, timeZone, now) : "now"}`;

/** The group's periods as search choices, newest first. */
export const periodChoices = (
  spans: readonly PeriodSpan<SearchablePeriod>[],
  timeZone: string,
  now: Date,
): PeriodChoice[] =>
  spans
    .map((span) => ({
      id: span.period.id,
      name: periodWhere(span.period),
      dates: periodDates(span, timeZone, now),
      range: periodRange(spans, span.period.id)!,
    }))
    .reverse();

/** The choice for `id`, or null when it isn't on the track (deleted, another group's, unknown). */
export const findPeriodChoice = (choices: readonly PeriodChoice[], id: string | null) =>
  (id && choices.find((c) => c.id === id)) || null;

/** A choice in a list: "Rehab at Oak Hills · Nov 3 – Nov 12". */
export const choiceText = (choice: PeriodChoice) => `${choice.name} · ${choice.dates}`;

/** The timeline's period chip: "During Rehab at Oak Hills". */
export const duringText = (choice: PeriodChoice) => `During ${choice.name}`;

/** The chip's accessible name, with the dates and what it does. */
export const duringChipName = (choice: PeriodChoice) =>
  `During ${choice.name}, ${choice.dates}: search every date`;

/** A range with an end: the current period's runs up to `now`. */
export const rangeUntilNow = (range: PeriodChoice["range"], now: Date) => ({
  from: range.from,
  to: range.to ?? now.toISOString(),
});
