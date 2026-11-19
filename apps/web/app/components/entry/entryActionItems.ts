import type { TimelineEntryKind } from "@caretook/data/schema";

import { canHaveNoteDocument, isSystemWrittenKind } from "@caretook/data/schema";

export type EntryAction = "edit" | "cancel" | "uncancel" | "delete";

/**
 * The entry ⋯ menu's items, in order, wherever it shows (rows, cards,
 * Upcoming and the entry page): Edit for symptoms, vitals and doses when
 * there's an edit sheet to open; Cancel for an event (Undo cancel once it's
 * cancelled) when the caller can cancel; then Delete. Notes and events are
 * edited on their own page, and a medication change is written with its
 * medication (deleting one is a correction), so they never get Edit. The menu
 * is for writers only.
 */
export function entryActionItems(
  kind: TimelineEntryKind,
  {
    canEdit,
    canCancel = false,
    cancelled = false,
  }: { canEdit: boolean; canCancel?: boolean; cancelled?: boolean },
): EntryAction[] {
  const items: EntryAction[] = [];
  if (canEdit && !canHaveNoteDocument(kind) && !isSystemWrittenKind(kind)) items.push("edit");
  if (canCancel && kind === "event") items.push(cancelled ? "uncancel" : "cancel");
  items.push("delete");
  return items;
}
