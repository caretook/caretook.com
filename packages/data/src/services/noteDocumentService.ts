import type { z } from "zod";
import type {
  NoteDocument,
  NoteDocumentCreateInput,
  NoteDocumentSubject,
  NoteUpdateCreateInput,
  Tx,
} from "../db";
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
import {
  carePeriodModel,
  medicationModel,
  noteDocumentModel,
  noteUpdateModel,
  providerModel,
  careGroupMemberModel,
  todoModel,
  timelineEntryModel,
} from "../models";
import { isWriterRole } from "../constants";
import { isSystemUser, rejectError } from "../permissions";

// Live documents (collaborative notes) on note and event entries, on
// providers, medications, care periods and todos. Write documents and updates through here, not the models: this
// is where the owner's kind, group and deletion are checked.
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

/**
 * The document's owner (an entry, a provider, a medication, a care period or a todo), as the actor sees it.
 * Deleted owners are hidden, and so are their documents.
 */
const liveOwner = async (ctx: ServiceContext, tx: Tx, subject: NoteDocumentSubject, id: string) => {
  if (subject === "provider") {
    const provider = await providerModel.getById(id, { ...ctx, tx });
    if (isError(provider)) return provider;
    return provider
      ? { groupId: provider.groupId, kind: null }
      : newError({ code: "noteDocumentService:providerNotFound" });
  }
  if (subject === "medication") {
    const medication = await medicationModel.getById(id, { ...ctx, tx });
    if (isError(medication)) return medication;
    return medication
      ? { groupId: medication.groupId, kind: null }
      : newError({ code: "noteDocumentService:medicationNotFound" });
  }
  if (subject === "carePeriod") {
    const period = await carePeriodModel.getById(id, { ...ctx, tx });
    if (isError(period)) return period;
    return period
      ? { groupId: period.groupId, kind: null }
      : newError({ code: "noteDocumentService:carePeriodNotFound" });
  }
  if (subject === "todo") {
    const todo = await todoModel.getById(id, { ...ctx, tx });
    if (isError(todo)) return todo;
    return todo
      ? { groupId: todo.groupId, kind: null }
      : newError({ code: "noteDocumentService:todoNotFound" });
  }
  const entry = await timelineEntryModel.getById(id, { ...ctx, tx });
  if (isError(entry)) return entry;
  return entry
    ? { groupId: entry.groupId, kind: entry.kind }
    : newError({ code: "noteDocumentService:entryNotFound" });
};

/**
 * Whether the actor may write the document of this owner: a writer on any
 * owner; anyone else (an Easy helper, the one other role the tables let
 * write) only on an entry they may update, in SQL (`groupOwn`: one they
 * created), never on a provider's, medication's, care period's or todo's.
 */
const mayWriteOwner = async (
  ctx: ServiceContext,
  tx: Tx,
  subject: NoteDocumentSubject,
  id: string,
  groupId: string,
) => {
  if (!ctx.authUser || isSystemUser(ctx.authUser)) return true;
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  if (isWriterRole(role)) return true;
  if (subject !== "entry") return false;
  return timelineEntryModel.mayChange(id, "update", { ...ctx, tx });
};

/** The document, if the actor can see it and its owner isn't deleted. */
const visibleDocument = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const doc = await noteDocumentModel.getById(id, { ...ctx, tx });
  if (isError(doc)) return doc;
  if (!doc) return notFound();
  const owner = await liveOwner(ctx, tx, doc.subject, id);
  return isError(owner) ? notFound() : doc;
};

/** The owner columns for a document: exactly one is set, to the document's id. */
const ownerColumns = (
  subject: NoteDocumentSubject,
  id: string,
): Pick<NoteDocument, "subject" | "entryId" | "providerId" | "medicationId" | "carePeriodId" | "todoId"> => ({
  subject,
  entryId: subject === "entry" ? id : null,
  providerId: subject === "provider" ? id : null,
  medicationId: subject === "medication" ? id : null,
  carePeriodId: subject === "carePeriod" ? id : null,
  todoId: subject === "todo" ? id : null,
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** An entry's live document, or `noteDocumentService:notFound`. */
export const getById = (ctx: ServiceContext, id: string) =>
  withTransaction((tx) => visibleDocument({ ...ctx, tx }, tx, id), ctx);

/** The document as a Y.Doc: its snapshot plus updates not yet compacted (the caller destroys it). */
const buildCurrent = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const doc = await visibleDocument({ ...ctx, tx }, tx, id);
  if (isError(doc)) return doc;
  const updates = await noteUpdateModel.list({
    ...ctx,
    tx,
    filter: { documentId: { type: "eq", value: id } },
  });
  if (isError(updates)) return updates;
  return {
    doc,
    updates: updates.data.length,
    ydoc: buildNoteDoc(
      doc.snapshot,
      updates.data.map((u) => u.data),
    ),
  };
};

/** The document's current text, including updates not yet compacted (for AI and workers). */
export const currentText = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const current = await buildCurrent(ctx, tx, id);
    if (isError(current)) return current;
    const text = current.updates ? noteText(current.ydoc) : current.doc.text;
    current.ydoc.destroy();
    return text;
  }, ctx);

/**
 * The document's current state as a Y.Doc, including updates not yet
 * compacted: what a server-side edit (an assistant's append) builds its
 * update on. The caller destroys it.
 */
export const currentDoc = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const current = await buildCurrent(ctx, tx, id);
    return isError(current) ? current : current.ydoc;
  }, ctx);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add a live document to an entry, a provider, a medication or a care
 * period (`id` is the owner's id; `subject` defaults to an entry). Only
 * loggers who may write the owner (`mayWriteOwner`), only on a live note or
 * event, or a provider, medication or care period that isn't deleted, in
 * the owner's own group.
 *
 * Idempotent: if the entry already has one, that one is returned. That's
 * also PowerSync's replay, and two offline devices adding one at once.
 */
export const create = (ctx: ServiceContext, input: NoteDocumentCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = noteDocumentCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, subject } = parsed.data;

    const owner = await liveOwner(ctx, tx, subject, id);
    if (isError(owner)) return owner;
    if (owner.groupId !== groupId) return immutable();
    if (owner.kind !== null && !canHaveNoteDocument(owner.kind)) {
      return newError({ code: "noteDocumentService:wrongKind" });
    }

    const existing = await noteDocumentModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (existing) return existing.subject === subject ? existing : immutable();

    const may = await mayWriteOwner(ctx, tx, subject, id, groupId);
    if (isError(may)) return may;
    if (!may) return rejectError(ctx.authUser);

    return noteDocumentModel.create({ ...ctx, tx, data: { id, groupId, ...ownerColumns(subject, id) } });
  }, ctx);

/**
 * Append one Yjs update to a document: loggers (the model's create scope)
 * who may write its owner (`mayWriteOwner`), on a visible document in the
 * same group.
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

    const may = await mayWriteOwner(ctx, tx, doc.subject, documentId, doc.groupId);
    if (isError(may)) return may;
    if (!may) return rejectError(ctx.authUser);

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
