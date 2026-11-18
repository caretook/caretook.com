import type { TimelineEntryKind } from "@caretook/data/schema";

import { canHaveNoteDocument } from "@caretook/data/schema";

export type EntryAction = "edit" | "delete";

/**
 * The entry ⋯ menu's items, in order, wherever it shows (rows, cards, the
 * entry page): Edit for symptoms and vitals when there's an edit sheet to
 * open, then Delete. Notes and events are edited on their own page, so they
 * never get Edit.
 */
export function entryActionItems(kind: TimelineEntryKind, { canEdit }: { canEdit: boolean }): EntryAction[] {
  return canEdit && !canHaveNoteDocument(kind) ? ["edit", "delete"] : ["delete"];
}
