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

/** What an empty timeline says, with or without a kind filter. */
export const emptyTimelineText = (kind: TimelineEntryKind | null) =>
  kind ? `No ${KIND_META[kind].plural.toLowerCase()} on the timeline yet.` : "Nothing on the timeline yet.";
