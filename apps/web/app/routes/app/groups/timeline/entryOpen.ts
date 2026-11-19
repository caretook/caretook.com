import type { TimelineEntryKind } from "@caretook/data/schema";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { appUrls } from "../../../../lib/appUrls";

// What tapping a timeline entry does, by kind and role. Pure, so web:unit tests it.

/**
 * - `page`: a note or event opens its page, for everyone (viewers read it there);
 * - `editSheet`: a symptom or vital opens its edit sheet, for writers;
 * - `null`: nothing (a viewer's symptom or vital).
 */
export type OpenRule = "page" | "editSheet" | null;

export const openRule = (kind: TimelineEntryKind, canWrite: boolean): OpenRule =>
  canHaveNoteDocument(kind) ? "page" : canWrite ? "editSheet" : null;

/** A row's open link: the entry's page, or (`sheet`) its edit sheet over the timeline. */
export type EntryOpen = { to: string; sheet: boolean };

/** The link a row or card opens, or none. The edit sheet's URL carries the timeline's filters (`search`). */
export const entryOpen = ({
  groupId,
  entry,
  canWrite,
  search,
}: {
  groupId: string;
  entry: { id: string; kind: TimelineEntryKind };
  canWrite: boolean;
  search: string;
}): EntryOpen | undefined => {
  const rule = openRule(entry.kind, canWrite);
  if (rule === "page") return { to: appUrls.entry(groupId, entry.id), sheet: false };
  if (rule === "editSheet") return { to: appUrls.editSheet(groupId, entry.id, { search }), sheet: true };
  return undefined;
};
