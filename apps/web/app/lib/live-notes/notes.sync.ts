import type { SyncDb } from "../sync/index";

import { buildNoteDoc, fromBase64, noteText, toBase64 } from "@caretook/data/schema";
import * as Y from "yjs";
import { noteUpdates } from "../sync/schema";
import { toLocalTimestamp } from "../timeline/timeline.sync";

// Live documents on this device. A document's state is its snapshot plus
// every pending update row; both arrive through sync, so the editor works
// offline and merges with everyone else's edits (Yjs).
//
// Devices only insert: a note_document row (with its entry, on the first
// change: see liveEntry.ts) and note_update rows (bursts of typing). The
// server compacts updates into the snapshot and writes the plain text.

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type NoteDocRow = { id: string; snapshot: string | null; text: string | null; updates: string };

/** A group's live documents with their pending updates (as a JSON array of base64), for previews. */
export const groupDocumentsQuery = (groupId: string) => ({
  sql: `SELECT d.id, d.snapshot, d.text,
               (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
        FROM note_document d WHERE d.group_id = ?`,
  params: [groupId],
});

/** One document with its pending updates, like `groupDocumentsQuery`'s rows (for its preview text). */
export const documentPreviewQuery = (id: string) => ({
  sql: `SELECT d.id, d.snapshot, d.text,
               (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
        FROM note_document d WHERE d.id = ?`,
  params: [id],
});

const pendingUpdates = (row: NoteDocRow) => {
  try {
    return (JSON.parse(row.updates) as (string | null)[]).filter((u): u is string => !!u);
  } catch {
    return [];
  }
};

/**
 * The document's plain text. The server's copy when nothing is pending;
 * otherwise rebuilt here, so previews show edits that haven't been compacted
 * (or uploaded) yet.
 */
export const previewText = (row: NoteDocRow) => {
  const updates = pendingUpdates(row);
  if (!updates.length) return row.text ?? "";
  try {
    const doc = buildNoteDoc(row.snapshot, updates);
    const text = noteText(doc);
    doc.destroy();
    return text;
  } catch {
    return row.text ?? "";
  }
};

/** Document id → preview text, for the timeline. */
export const toPreviews = (rows: NoteDocRow[]) => new Map(rows.map((row) => [row.id, previewText(row)]));

// ---------------------------------------------------------------------------
// The editor's Y.Doc, bound to local SQLite
// ---------------------------------------------------------------------------

/** Marks changes that came from the database, so they aren't written back. */
const FROM_DB = Symbol("caretook:fromDb");

/** Write a burst of typing this long after the last keystroke… */
const FLUSH_IDLE_MS = 250;
/** …and at least this often while typing continues. */
const FLUSH_MAX_MS = 1000;

export type NoteDocParts = { snapshot: string | null; updates: { id: string; data: string | null }[] };

const applyPart = (doc: Y.Doc, data: string | null) => {
  if (!data) return;
  try {
    Y.applyUpdate(doc, fromBase64(data), FROM_DB);
  } catch (e) {
    console.warn("Skipped an unreadable live notes update", e);
  }
};

/**
 * A Y.Doc holding what the loader read, so the editor opens with content.
 * Pure: `bindNoteDoc` connects it to the database.
 */
export const createNoteDoc = ({ snapshot, updates }: NoteDocParts) => {
  const doc = new Y.Doc();
  applyPart(doc, snapshot);
  for (const u of updates) applyPart(doc, u.data);
  return doc;
};

export type BindNoteDocOptions = {
  db: SyncDb;
  documentId: string;
  groupId: string;
  /** Viewers watch: their (editor-internal) changes are never written. */
  canWrite: boolean;
  /**
   * For a draft that isn't saved yet: saves its entry and document when the
   * doc holds a real change, and resolves true once they exist. Until then,
   * local changes wait in memory, and leaving drops them. Called on every
   * local change until it returns true.
   */
  ensureSaved?: (doc: Y.Doc) => Promise<boolean>;
};

/**
 * Keep `doc` in step with the local database: rows that arrive (other
 * people's edits, a new snapshot after compaction) are applied to it, and
 * its own changes are written as note_update rows, which PowerSync uploads.
 * Applying a row twice is harmless (Yjs ignores what it already has).
 *
 * Returns `flush` (write pending changes now) and `unbind`, which also flushes.
 */
export const bindNoteDoc = (
  doc: Y.Doc,
  { db, documentId, groupId, canWrite, ensureSaved }: BindNoteDocOptions,
) => {
  const seen = new Set<string>();
  let lastSnapshot: string | null = null;

  // Local changes → note_update rows, one per burst of typing.
  let pending: Uint8Array[] = [];
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;

  // A draft's changes are held until its entry and document exist.
  let saved = !ensureSaved;
  let saving: Promise<boolean> | null = null;
  const trySave = (): Promise<boolean> => {
    if (saved || !ensureSaved) return Promise.resolve(true);
    saving ??= ensureSaved(doc)
      .catch((e: unknown) => {
        console.error("Couldn't save the entry", e);
        return false;
      })
      .then((ok) => {
        saving = null;
        if (ok) saved = true;
        return ok;
      });
    return saving;
  };

  const flush = async (): Promise<void> => {
    clearTimeout(idleTimer);
    clearTimeout(maxTimer);
    idleTimer = maxTimer = undefined;
    if (!pending.length) return;
    if (!(await trySave()) || !pending.length) return;
    const update = Y.mergeUpdates(pending);
    pending = [];
    const id = crypto.randomUUID();
    seen.add(id);
    return db.drizzle
      .insert(noteUpdates)
      .values({
        id,
        groupId,
        documentId,
        data: toBase64(update),
        createdAt: toLocalTimestamp(new Date()),
        createdBy: db.userId,
      })
      .then(() => undefined)
      .catch((e: unknown) => console.error("Couldn't save live notes", e));
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === FROM_DB || !canWrite) return;
    pending.push(update);
    // A draft's first real change saves it at once (the URL then becomes
    // the entry's), and its waiting changes follow straight after.
    if (!saved) {
      void trySave().then((ok) => {
        if (ok) void flush();
      });
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void flush(), FLUSH_IDLE_MS);
    maxTimer ??= setTimeout(() => void flush(), FLUSH_MAX_MS);
  };
  doc.on("update", onUpdate);

  // Database → doc.
  const controller = new AbortController();
  const watch = <T>(sql: string, onRows: (rows: T[]) => void) =>
    db.powersync.watch(
      sql,
      [documentId],
      {
        onResult: (result) => onRows((result.rows?._array ?? []) as T[]),
        onError: (error) => console.error("Live notes query failed", error),
      },
      { signal: controller.signal, throttleMs: 0 },
    );
  void watch<{ snapshot: string | null }>("SELECT snapshot FROM note_document WHERE id = ?", (rows) => {
    const snapshot = rows[0]?.snapshot ?? null;
    if (!snapshot || snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    applyPart(doc, snapshot);
  });
  void watch<{ id: string; data: string | null }>(
    "SELECT id, data FROM note_update WHERE document_id = ?",
    (rows) => {
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        applyPart(doc, row.data);
      }
    },
  );

  return {
    flush,
    unbind: () => {
      controller.abort();
      doc.off("update", onUpdate);
      void flush();
    },
  };
};
