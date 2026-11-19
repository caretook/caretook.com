import type { PeriodSpan } from "@caretook/data/schema";
import type { PeriodWords } from "../../../../lib/periodDisplay";

import { dateText, periodName, startText } from "../../../../lib/periodDisplay";

// A care period's page, its pure parts: what deleting it does to the track
// (said in the confirm), and how the previous and next periods read. The
// wording builds on `lib/periodDisplay`. No React or database; web:unit
// tests it (so imports stay relative).

type Span = PeriodSpan<{
  id: string;
  startedAt: string;
  createdAt: string;
  deletedAt: string | null;
  type: string;
  label: string | null;
  dateOnly: boolean;
}>;

/**
 * The delete confirm's message: the period before it runs on to where this
 * one ended ("Rehab will continue until Nov 20, 09:00."), or becomes current
 * again; the first period's deletion makes the next one first.
 */
export const deleteConfirmText = (
  { previous, next }: { previous: Span | null; next: Span | null },
  timeZone: string,
  now: Date,
) => {
  if (previous && next)
    return `${periodName(previous.period)} will continue until ${startText(next.startsAt, next.period.dateOnly, timeZone, now)}.`;
  if (previous) return `${periodName(previous.period)} will be the current period again.`;
  if (next) return `${periodName(next.period)} will be the first period.`;
  return "There will be no care periods.";
};

/** A neighbour's dates: "Nov 2 – Nov 12", or "Nov 12, 14:20 – now" for the current one. */
export const spanDatesText = (span: Span, timeZone: string, now: Date) =>
  `${startText(span.startsAt, span.period.dateOnly, timeZone, now)} – ${span.endsAt ? dateText(span.endsAt, timeZone, now) : "now"}`;

/** How a neighbour's link reads to a screen reader: "Previous period: Rehab, Nov 2 – Nov 12". */
export const neighbourLabel = (
  which: "previous" | "next",
  span: Span & { period: PeriodWords },
  timeZone: string,
  now: Date,
) =>
  `${which === "previous" ? "Previous" : "Next"} period: ${periodName(span.period)}, ${spanDatesText(span, timeZone, now)}`;
