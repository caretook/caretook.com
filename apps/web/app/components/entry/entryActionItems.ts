import type { TimelineEntryKind } from "@caretook/data/schema";

import { canHaveNoteDocument, isSystemWrittenKind } from "@caretook/data/schema";

export type EntryAction = "edit" | "delete";

/**
 * The entry ⋯ menu's items, in order, wherever it shows (rows, cards, the
 * entry page): Edit for symptoms, vitals and doses when there's an edit sheet
 * to open, then Delete. Notes and events are edited on their own page, and a
 * medication change is written with its medication (deleting one is a
 * correction), so they never get Edit.
 */
export function entryActionItems(kind: TimelineEntryKind, { canEdit }: { canEdit: boolean }): EntryAction[] {
  return canEdit && !canHaveNoteDocument(kind) && !isSystemWrittenKind(kind)
    ? ["edit", "delete"]
    : ["delete"];
}
