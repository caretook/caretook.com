import type { TimelineEntryKind } from "@caretook/data/schema";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { appUrls } from "../../../../lib/app-shell/appUrls";
import { setDay } from "../../../../lib/timeline/timelineFilters";
import { dayKeyIn } from "./timelineDays";

// The paths the timeline copies (a day header's copy-link button, an entry's
// ⋯ Copy link; `useCopyLink` makes them absolute). Pure, so web:unit tests it.

/** A day on the timeline: the plain `?day=` jump, with no filters. */
export const dayLinkPath = (groupId: string, dayKey: string) => appUrls.timeline(groupId, setDay("", dayKey));

/**
 * An entry's page: a note's or event's `/entries/:id`. Symptoms, vitals and
 * the rest have no page (their sheet is only for writers), so theirs is its
 * day on the timeline, as `timeZone` (the viewer's) dates it.
 */
export const entryLinkPath = (
  entry: { id: string; groupId: string; kind: TimelineEntryKind; occurredAt: string },
  timeZone: string,
) =>
  canHaveNoteDocument(entry.kind)
    ? appUrls.entry(entry.groupId, entry.id)
    : dayLinkPath(entry.groupId, dayKeyIn(entry.occurredAt, timeZone));
