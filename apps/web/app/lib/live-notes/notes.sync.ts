import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";
import type { NoteBlock } from "./noteRichText";

import { buildNoteDoc, fromBase64, noteText, toBase64 } from "@caretook/data/schema";
import * as Y from "yjs";
import { noteUpdates } from "../sync/schema";
import { toLocalTimestamp } from "../timeline/timeline.sync";
import { noteRichText } from "./noteRichText";

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

/**
 * The live documents of the entries a list shows, with their pending updates
 * (as a JSON array of base64), for their previews. `window` is the list's
 * `FROM timeline_entry …` clause (`historyWindow`, `upcomingWindow`,
 * `pastEventsFrom`): a document's id is its entry's, so only the documents of
 * the entries in it are read, never the whole group's (B-313).
 */
export const windowDocumentsQuery = (groupId: string, window: LocalQuery): LocalQuery => ({
  sql: `SELECT d.id, d.snapshot, d.text,
               (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
        FROM note_document d WHERE d.group_id = ? AND d.id IN (SELECT id ${window.sql})`,
  params: [groupId, ...window.params],
});

/** One document with its pending updates, like `windowDocumentsQuery`'s rows (for its preview text). */
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

/**
 * The document's formatted blocks (`noteRichText`), from its snapshot and
 * pending updates, like `previewText`. Null when it can't be read (the plain
 * preview stands in).
 */
export const previewRichText = (row: NoteDocRow): NoteBlock[] | null => {
  try {
    const doc = buildNoteDoc(row.snapshot, pendingUpdates(row));
    const blocks = noteRichText(doc);
    doc.destroy();
    return blocks;
  } catch {
    return null;
  }
};

// The last blocks read per document, so a card decodes its document once per
// version, not on every render. Bounded: past the cap it starts again.
const RICH_CACHE_CAP = 500;
const richCache = new Map<string, { snapshot: string | null; updates: string; blocks: NoteBlock[] | null }>();

/** `previewRichText`, remembered per document until its snapshot or pending updates change. */
export const cachedRichText = (row: NoteDocRow) => {
  const hit = richCache.get(row.id);
  if (hit && hit.snapshot === row.snapshot && hit.updates === row.updates) return hit.blocks;
  if (richCache.size >= RICH_CACHE_CAP) richCache.clear();
  const blocks = previewRichText(row);
  richCache.set(row.id, { snapshot: row.snapshot, updates: row.updates, blocks });
  return blocks;
};

// The last preview text read per document, like the blocks above: a list's
// rows arrive again on every change to the tables they read (another
// member's typing in any document), and only a changed document is rebuilt.
const textCache = new Map<
  string,
  { snapshot: string | null; text: string | null; updates: string; preview: string }
>();

/** `previewText`, remembered per document until its snapshot, text or pending updates change. */
export const cachedPreviewText = (row: NoteDocRow) => {
  const hit = textCache.get(row.id);
  if (hit && hit.snapshot === row.snapshot && hit.text === row.text && hit.updates === row.updates)
    return hit.preview;
  if (textCache.size >= RICH_CACHE_CAP) textCache.clear();
  const preview = previewText(row);
  textCache.set(row.id, { snapshot: row.snapshot, text: row.text, updates: row.updates, preview });
  return preview;
};

/** Document id → preview text, for the timeline. */
export const toPreviews = (rows: NoteDocRow[]) =>
  new Map(rows.map((row) => [row.id, cachedPreviewText(row)]));

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
    // Take this burst; typing during the insert starts the next one.
    const batch = pending;
    pending = [];
    const id = crypto.randomUUID();
    seen.add(id);
    return db.drizzle
      .insert(noteUpdates)
      .values({
        id,
        groupId,
        documentId,
        data: toBase64(Y.mergeUpdates(batch)),
        createdAt: toLocalTimestamp(new Date()),
        createdBy: db.userId,
      })
      .then(() => undefined)
      .catch((e: unknown) => {
        // Nothing went in: put the burst back, ahead of newer typing, so the
        // next flush writes it (a failed insert must not lose the session's text).
        seen.delete(id);
        pending = [...batch, ...pending];
        console.error("Couldn't save live notes", e);
      });
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
