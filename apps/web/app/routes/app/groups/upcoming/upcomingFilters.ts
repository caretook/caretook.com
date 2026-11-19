import type { TimelineEntryKind } from "@caretook/data/schema";
import type { TimelineFilters } from "../../../../lib/timelineFilters";

import { AUTHOR_PARAM, KIND_PARAM, parseFilters } from "../../../../lib/timelineFilters";

// Upcoming's filters: the timeline's `?kind=` and `?author=` (read and
// changed through `lib/timelineFilters`), narrowed to what Upcoming lists.
// Pure, so web:unit tests it.

/** The kinds Upcoming lists: appointments (events) and reminders (notes). */
export const UPCOMING_KINDS = ["event", "note"] as const satisfies readonly TimelineEntryKind[];
export type UpcomingKind = (typeof UPCOMING_KINDS)[number];

/** What Upcoming calls each kind. */
export const UPCOMING_KIND_LABELS: Record<UpcomingKind, string> = {
  event: "Appointments",
  note: "Reminders",
};

const isUpcomingKind = (kind: TimelineEntryKind | null): kind is UpcomingKind =>
  (UPCOMING_KINDS as readonly (string | null)[]).includes(kind);

/** Upcoming's filters: a kind Upcoming doesn't list (`?kind=vital`) reads as none. */
export const parseUpcomingFilters = (search: string): TimelineFilters & { kind: UpcomingKind | null } => {
  const { kind, author } = parseFilters(search);
  return { kind: isUpcomingKind(kind) ? kind : null, author };
};

/** The Past tab's filters: past events only, so just the author. */
export const parsePastFilters = (search: string): TimelineFilters => ({
  kind: null,
  author: parseFilters(search).author,
});

/**
 * The search a tab's link carries: the filters that tab reads (Upcoming:
 * kind and author; Past: the author), never anything else.
 */
export const tabSearch = (search: string, tab: "upcoming" | "past") => {
  const { kind, author } = parseUpcomingFilters(search);
  return { [KIND_PARAM]: tab === "upcoming" ? kind : null, [AUTHOR_PARAM]: author };
};

/** What an empty Upcoming says, naming the filters that are on. */
export const emptyUpcomingText = (kind: UpcomingKind | null, authorName?: string | null) => {
  const what = kind ? UPCOMING_KIND_LABELS[kind].toLowerCase() : "appointments or reminders";
  return authorName ? `No upcoming ${what} by ${authorName}.` : `No upcoming ${what}.`;
};

/** What an empty Past tab says. */
export const emptyPastText = (authorName?: string | null) =>
  authorName ? `No past events by ${authorName}.` : "No past events yet.";

/** The Past tab's end, once there's nothing older. */
export const PAST_END_TEXT = "That's the first event";
