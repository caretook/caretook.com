import type { TimelineEntryKind } from "@caretook/data/schema";
import type { SyncDb } from "~/lib/sync";
import type { NoteDocParts } from "~/lib/sync/notes";
import type { EntryRow } from "~/lib/sync/timeline";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { data } from "react-router";
import { WHEN_PICK } from "~/lib/appUrls";
import { KIND_META } from "~/lib/entryDisplay";
import { localTimeZone } from "~/lib/format";
import { isLiveEntryKind, NEW_ENTRY } from "~/lib/liveEntry";
import { readRows, toTimelineEntry } from "~/lib/sync/timeline";
import { entryHeading } from "./entryPage";

/** The stored entry: live, in its group, not deleted. */
export const entrySql = "SELECT * FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL";

/** What the page starts from: a stored entry, or a draft with an id made here. */
export type EntryDraft = {
  id: string;
  kind: TimelineEntryKind;
  title: string | null;
  occurredAt: string;
  timeZone: string;
};

export type EntryPageData = {
  isNew: boolean;
  /** A draft opened as `?when=pick` (Add appointment, Add reminder): the time chip opens first. */
  pickDay: boolean;
  /** A new appointment's provider (`?provider=`, from their page), linked once it's saved; null for none. */
  withProvider: string | null;
  entry: EntryDraft;
  heading: string;
  hasDocument: boolean;
  initial: NoteDocParts;
  /** Starting rows for the live query (stable, so it doesn't reset each render). */
  entryRows: EntryRow[];
};

const notFound = () => data("Not found", { status: 404 });

/**
 * The entry, its document and pending updates, or a new draft
 * (`entryId` = `new`, `kind` from `?kind=`, `?when=pick` to ask for the
 * day first, and `?provider=` for an appointment with them). Anything not on the device, not
 * a note or event, or (for a draft) not allowed, is a 404.
 */
export async function loadEntry(
  db: SyncDb,
  {
    groupId,
    entryId,
    kind,
    when = null,
    withProvider = null,
    canWrite,
  }: {
    groupId: string;
    entryId: string;
    kind: string | null;
    when?: string | null;
    withProvider?: string | null;
    canWrite: boolean;
  },
): Promise<EntryPageData> {
  if (entryId === NEW_ENTRY) {
    if (!isLiveEntryKind(kind) || !canWrite) throw notFound();
    // Only a live provider in this group; anything else is dropped.
    const [provider] =
      kind === "event" && withProvider
        ? await readRows<{ id: string }>(db, {
            sql: "SELECT id FROM provider WHERE id = ? AND group_id = ? AND deleted_at IS NULL",
            params: [withProvider, groupId],
          })
        : [];
    return {
      isNew: true,
      pickDay: when === WHEN_PICK,
      withProvider: provider?.id ?? null,
      entry: {
        id: crypto.randomUUID(),
        kind,
        title: null,
        occurredAt: new Date().toISOString(),
        timeZone: localTimeZone(),
      },
      heading: entryHeading(KIND_META[kind].label, null, true),
      hasDocument: false,
      initial: { snapshot: null, updates: [] },
      entryRows: [],
    };
  }

  const entryRows = await readRows<EntryRow>(db, { sql: entrySql, params: [entryId, groupId] });
  const entry = entryRows[0] ? toTimelineEntry(entryRows[0]) : null;
  if (!entry || !canHaveNoteDocument(entry.kind)) throw notFound();

  const [doc] = await readRows<{ id: string; snapshot: string | null }>(db, {
    sql: "SELECT id, snapshot FROM note_document WHERE id = ?",
    params: [entryId],
  });
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [entryId],
      })
    : [];

  const { id, title, occurredAt, timeZone } = entry;
  return {
    isNew: false,
    pickDay: false,
    withProvider: null,
    entry: { id, kind: entry.kind, title, occurredAt, timeZone },
    heading: entryHeading(KIND_META[entry.kind].label, title, false),
    hasDocument: !!doc,
    initial: { snapshot: doc?.snapshot ?? null, updates },
    entryRows,
  };
}
