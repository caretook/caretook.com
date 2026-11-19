import type { TimelineEntryKind } from "@caretook/data/schema";

import { KIND_META } from "../../../../lib/entryDisplay";
import { formatTime } from "../../../../lib/format";

// The timeline's words for entries: link and menu names, and the empty list.
// Pure, so web:unit tests it.

type Labelled = { kind: TimelineEntryKind; title: string | null; occurredAt: string };

/** A short name for the entry: its title, else its kind, and its time ("PT visit at 9:30 AM"). */
export const entryLabel = (entry: Labelled) =>
  `${entry.title || KIND_META[entry.kind].label.toLowerCase()} at ${formatTime(entry.occurredAt)}`;

/** The name of a row's open link: "Open note at 9:30 AM", or "Edit …" for an edit sheet. */
export const openLabel = (entry: Labelled, sheet: boolean) =>
  `${sheet ? "Edit" : "Open"} ${entryLabel(entry)}`;

/** The name of an entry's ⋯ menu: "Actions for symptom at 9:30 AM". */
export const actionsLabel = (entry: Labelled) =>
  `Actions for ${KIND_META[entry.kind].label.toLowerCase()} at ${formatTime(entry.occurredAt)}`;

/**
 * What an empty timeline says, naming the filters that are on: "No symptoms
 * by Alex Rivera yet." (`authorName` is the author filter's name.) With a
 * search (`q`): "No symptoms by Alex Rivera match “fall”."
 */
export const emptyTimelineText = (
  kind: TimelineEntryKind | null,
  authorName?: string | null,
  q?: string | null,
) => {
  if (q) {
    const what = kind ? KIND_META[kind].plural.toLowerCase() : "entries";
    return `No ${what}${authorName ? ` by ${authorName}` : ""} match “${q}”.`;
  }
  if (!kind && !authorName) return "Nothing on the timeline yet.";
  const what = kind ? KIND_META[kind].plural.toLowerCase() : "entries";
  return authorName ? `No ${what} by ${authorName} yet.` : `No ${what} on the timeline yet.`;
};
