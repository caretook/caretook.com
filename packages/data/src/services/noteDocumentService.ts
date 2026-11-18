import type { z } from "zod";
import type { NoteDocumentCreateInput, NoteUpdateCreateInput, Tx } from "../db";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  buildNoteDoc,
  canHaveNoteDocument,
  encodeNoteDoc,
  mergeEditors,
  noteDocumentCreateZSchema,
  noteText,
  noteUpdateCreateZSchema,
  parseNoteEditors,
} from "../db/schema";
import { isError, newError } from "../errors";
import { noteDocumentModel, noteUpdateModel, timelineEntryModel } from "../models";
import { rejectError } from "../permissions";

// Live documents (collaborative notes) on note and event entries. Write
// documents and updates through here, not the models: this is where the
// entry's kind, group and deletion are checked.
//
// A document's state is its snapshot plus its pending updates. Devices only
// ever append updates; `compact` folds them into the snapshot and refreshes
// the plain text.

export const serviceName = "noteDocument";
export const schemaName = noteDocumentModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "noteDocumentService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "noteDocumentService:notFound" });
const immutable = () => newError({ code: "noteDocumentService:immutable" });

/** Compact once this many updates are waiting… */
export const COMPACT_AFTER_UPDATES = 20;
/** …or once the oldest has waited this long (seconds), so active editing compacts every minute or so. */
export const COMPACT_AFTER_SECONDS = 60;

/** The entry, as the actor sees it. Deleted entries are hidden, and so are their documents. */
const liveEntry = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const entry = await timelineEntryModel.getById(id, { ...ctx, tx });
  if (isError(entry)) return entry;
  return entry ?? newError({ code: "noteDocumentService:entryNotFound" });
};

/** The document, if the actor can see it and its entry isn't deleted. */
const visibleDocument = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const doc = await noteDocumentModel.getById(id, { ...ctx, tx });
  if (isError(doc)) return doc;
  if (!doc) return notFound();
  const entry = await timelineEntryModel.getById(id, { ...ctx, tx });
  if (isError(entry)) return entry;
  return entry ? doc : notFound();
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** An entry's live document, or `noteDocumentService:notFound`. */
export const getById = (ctx: ServiceContext, id: string) =>
  withTransaction((tx) => visibleDocument({ ...ctx, tx }, tx, id), ctx);

/** The document's current text, including updates not yet compacted (for AI and workers). */
export const currentText = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const doc = await visibleDocument({ ...ctx, tx }, tx, id);
    if (isError(doc)) return doc;
    const updates = await noteUpdateModel.list({
      ...ctx,
      tx,
      filter: { documentId: { type: "eq", value: id } },
    });
    if (isError(updates)) return updates;
    if (!updates.data.length) return doc.text;
    return noteText(
      buildNoteDoc(
        doc.snapshot,
        updates.data.map((u) => u.data),
      ),
    );
  }, ctx);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add a live document to an entry (`id` is the entry's id). Only writers,
 * only on a live note or event, in the entry's own group.
 *
 * Idempotent: if the entry already has one, that one is returned. That's
 * also PowerSync's replay, and two offline devices adding one at once.
 */
export const create = (ctx: ServiceContext, input: NoteDocumentCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = noteDocumentCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId } = parsed.data;

    const entry = await liveEntry(ctx, tx, id);
    if (isError(entry)) return entry;
    if (entry.groupId !== groupId) return immutable();
    if (!canHaveNoteDocument(entry.kind)) return newError({ code: "noteDocumentService:wrongKind" });

    const existing = await noteDocumentModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (existing) return existing;

    return noteDocumentModel.create({ ...ctx, tx, data: { id, groupId } });
  }, ctx);

/**
 * Append one Yjs update to a document. Writers only (the model's create
 * scope), on a visible document in the same group.
 *
 * Idempotent on `id`: a replay of an update already stored (or already
 * compacted away) changes nothing. Applying an update twice is harmless in
 * Yjs anyway, but this keeps the table free of duplicates.
 */
export const appendUpdate = (ctx: ServiceContext, input: NoteUpdateCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = noteUpdateCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, documentId, data } = parsed.data;

    const doc = await visibleDocument(ctx, tx, documentId);
    if (isError(doc)) return doc;
    if (doc.groupId !== groupId) return immutable();

    // Existence is checked as the system, so a taken id is refused cleanly.
    // A replay that arrives after compaction deleted the row is stored again:
    // harmless, since applying an update twice changes nothing.
    const existing = await noteUpdateModel.getById(id, { authUser: SYSTEM_USER, tx });
    if (isError(existing)) return existing;
    if (existing) {
      if (existing.documentId !== documentId) return rejectError(ctx.authUser);
      return { id, documentId, replay: true as const };
    }

    const created = await noteUpdateModel.create({ ...ctx, tx, data: { id, groupId, documentId, data } });
    if (isError(created)) return created;
    return { id, documentId, replay: false as const };
  }, ctx);

/**
 * Fold a document's pending updates into its snapshot, refresh its plain
 * text, merge their authors into `editors` (the latest time per user), and
 * delete those updates. Runs as the system: callers decide when
 * (see `compactIfDue`). The row lock makes concurrent compactions take
 * turns; an update that arrives meanwhile simply waits for the next one.
 */
export const compact = (documentId: string, opts: { tx?: Tx } = {}) =>
  withTransaction(async (tx) => {
    const system = { authUser: SYSTEM_USER, tx };
    const doc = await noteDocumentModel.lockForCompaction(documentId, tx);
    if (isError(doc)) return doc;
    if (!doc) return notFound();

    const updates = await noteUpdateModel.list({
      ...system,
      filter: { documentId: { type: "eq", value: documentId } },
    });
    if (isError(updates)) return updates;
    if (!updates.data.length) return { compacted: 0 };

    const ydoc = buildNoteDoc(
      doc.snapshot,
      updates.data.map((u) => u.data),
    );
    const updated = await noteDocumentModel.update({
      ...system,
      filter: { id: { type: "eq", value: documentId } },
      data: {
        snapshot: encodeNoteDoc(ydoc),
        text: noteText(ydoc),
        editors: mergeEditors(parseNoteEditors(doc.editors), updates.data),
      },
    });
    if (isError(updated)) return updated;
    ydoc.destroy();

    const removed = await noteUpdateModel.remove({
      ...system,
      filter: { id: { type: "inArray", value: updates.data.map((u) => u.id) } },
    });
    if (isError(removed)) return removed;
    return { compacted: removed.ids.length };
  }, opts);

/** Compact when enough updates have piled up, or the oldest has waited long enough. */
export const compactIfDue = async (documentId: string) => {
  const pending = await noteDocumentModel.pendingUpdates(documentId);
  if (isError(pending)) return pending;
  const due =
    pending.count >= COMPACT_AFTER_UPDATES ||
    (pending.count > 0 && (pending.oldestAgeSeconds ?? 0) >= COMPACT_AFTER_SECONDS);
  return due ? compact(documentId) : { compacted: 0 };
};
