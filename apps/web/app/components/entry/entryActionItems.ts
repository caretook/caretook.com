import type { TimelineEntryKind } from "@caretook/data/schema";

import { canHaveNoteDocument, isSystemWrittenKind } from "@caretook/data/schema";

export type EntryAction = "edit" | "reschedule" | "cancel" | "uncancel" | "delete" | "prepare" | "print";

/**
 * The entry ⋯ menu's items, in order, wherever it shows (rows, cards,
 * Upcoming and the entry page): Edit for symptoms, vitals and doses when
 * there's an edit sheet to open; Cancel for an event (Undo cancel once it's
 * cancelled) when the caller can cancel; then Delete. Notes and events are
 * edited on their own page, and a medication change is written with its
 * medication (deleting one is a correction), so they never get Edit.
 * Reschedule comes before Cancel for an event the caller can reschedule (one
 * already rescheduled to another isn't offered: follow its link instead).
 * Prepare (visit prep) comes after Edit for an upcoming event the caller can
 * prepare, and Print before Delete for every note and event the caller can
 * print, viewers included: with `canDelete` false (a viewer) Print is the
 * only item.
 */
export function entryActionItems(
  kind: TimelineEntryKind,
  {
    canEdit,
    canCancel = false,
    cancelled = false,
    canReschedule = false,
    canPrepare = false,
    canPrint = false,
    canDelete = true,
  }: {
    canEdit: boolean;
    canCancel?: boolean;
    cancelled?: boolean;
    canReschedule?: boolean;
    canPrepare?: boolean;
    canPrint?: boolean;
    canDelete?: boolean;
  },
): EntryAction[] {
  const items: EntryAction[] = [];
  if (canEdit && !canHaveNoteDocument(kind) && !isSystemWrittenKind(kind)) items.push("edit");
  if (canPrepare && kind === "event") items.push("prepare");
  if (canReschedule && kind === "event") items.push("reschedule");
  if (canCancel && kind === "event") items.push(cancelled ? "uncancel" : "cancel");
  if (canPrint && canHaveNoteDocument(kind)) items.push("print");
  if (canDelete) items.push("delete");
  return items;
}
