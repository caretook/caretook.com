import type { z } from "zod";
import type {
  TimelineEntry,
  TimelineEntryCreateInput,
  TimelineEntryKind,
  TimelineEntryUpdateInput,
  TimelineEntryUpsertInput,
  Tx,
} from "../db";
import type { Filter } from "../models";
import type { IncludeDeleted } from "../models/timelineEntry";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  canHaveNoteDocument,
  timelineEntryContentZSchema,
  timelineEntryCreateZSchema,
  timelineEntryUpdateZSchema,
  timelineEntryUpsertZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupModel, careRecipientModel, noteDocumentModel, timelineEntryModel } from "../models";
import { rejectError } from "../permissions";

export const serviceName = "timelineEntry";
export const schemaName = timelineEntryModel.schemaName;

type K = typeof schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "timelineEntryService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "timelineEntryService:notFound" });

/** Postgres timestamptz text → ISO 8601, so stored rows re-validate. */
const toIso = (value: string) => new Date(value).toISOString();

/**
 * The recipient an entry is about: `recipientId` when given (it must be in
 * the group), else the group's only recipient. Reads are scoped to the
 * actor, so a non-member learns nothing about the group.
 */
const resolveRecipient = async (ctx: ServiceContext, tx: Tx, groupId: string, recipientId?: string) => {
  const group = await careGroupModel.getById(groupId, { ...ctx, tx });
  if (isError(group)) return group;
  if (!group) return rejectError(ctx.authUser);

  if (recipientId) {
    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (recipient?.groupId !== groupId) return newError({ code: "timelineEntryService:recipientNotInGroup" });
    return recipient.id;
  }

  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  if (!recipient) return newError({ code: "timelineEntryService:noRecipient" });
  return recipient.id;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * A note's or event's text is its live document, so its stored `body` is
 * null. Reads fill `body` from the document's compacted text, so API, AI
 * and worker callers keep one text field. Pending (uncompacted) updates
 * aren't included; `noteDocumentService.currentText` has those.
 *
 * - No document yet (its upload is still pending), or an empty one: the
 *   stored body (null for notes).
 * - A soft-deleted entry never gets its document's text.
 * - Documents are read in the actor's scope, like the entries.
 */
export const withDocumentText = async <T extends TimelineEntry>(ctx: ServiceContext, entries: T[]) => {
  const ids = new Set(entries.filter((e) => canHaveNoteDocument(e.kind) && !e.deletedAt).map((e) => e.id));
  if (!ids.size) return entries;

  const docs = await noteDocumentModel.list({ ...ctx, filter: { id: { type: "inArray", value: [...ids] } } });
  if (isError(docs)) return docs;
  const text = new Map(docs.data.map((d) => [d.id, d.text]));

  return entries.map((entry) => {
    const docText = ids.has(entry.id) ? text.get(entry.id) : undefined;
    return docText ? { ...entry, body: docText } : entry;
  });
};

const withDocumentTextOne = async <T extends TimelineEntry>(ctx: ServiceContext, entry: T | null) => {
  if (!entry) return entry;
  const res = await withDocumentText(ctx, [entry]);
  return isError(res) ? res : (res[0] ?? null);
};

/** One entry, with a note's or event's `body` from its document (see `withDocumentText`). */
export const getById = async (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) => {
  const entry = await timelineEntryModel.getById(id, { ...ctx, ...opts });
  return isError(entry) ? entry : withDocumentTextOne(ctx, entry);
};

export type TimelineListOptions = IncludeDeleted & {
  groupId: string;
  kinds?: TimelineEntryKind[];
  /** Inclusive lower bound on occurredAt (ISO 8601). */
  from?: string;
  /** Exclusive upper bound on occurredAt (ISO 8601). */
  to?: string;
  cursor?: string | null;
  limit?: number;
};

/**
 * One group's timeline, newest first, with notes' and events' `body` from
 * their documents (see `withDocumentText`). Pass `nextCursor` back for the
 * next page.
 */
export const list = async (
  ctx: ServiceContext,
  { groupId, kinds, from, to, ...opts }: TimelineListOptions,
) => {
  const range = [
    ...(from ? [{ type: "gte" as const, value: from }] : []),
    ...(to ? [{ type: "lt" as const, value: to }] : []),
  ];
  const filter: Filter<K> = {
    groupId: { type: "eq", value: groupId },
    ...(kinds?.length ? { kind: { type: "inArray", value: kinds } } : {}),
    ...(range.length ? { occurredAt: { type: "and", value: range } } : {}),
  };
  const page = await timelineEntryModel.listPage({ ...ctx, ...opts, filter });
  if (isError(page)) return page;
  const data = await withDocumentText(ctx, page.data);
  return isError(data) ? data : { ...page, data };
};

/** The newest reading of each vital type in a group, with the entry it came from. */
export const latestVitals = (ctx: ServiceContext, { groupId }: { groupId: string }) =>
  timelineEntryModel.latestReadings({ ...ctx, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Add an entry. Content is validated per kind; `id` may come from an offline client. */
export const create = (ctx: ServiceContext, input: TimelineEntryCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = timelineEntryCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, details, ...data } = parsed.data;

    const resolved = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(resolved)) return resolved;

    return timelineEntryModel.create({
      ...ctx,
      tx,
      data: { ...data, recipientId: resolved, details: details ?? null },
    });
  }, ctx);

/**
 * Edit an entry's content. Group, recipient and kind are fixed. The merged
 * entry must still be valid for its kind (a note can't lose its body).
 */
export const update = (ctx: ServiceContext, id: string, input: TimelineEntryUpdateInput) =>
  withTransaction(async (tx) => {
    const parsed = timelineEntryUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await timelineEntryModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const merged = timelineEntryContentZSchema.safeParse({
      kind: existing.kind,
      title: existing.title,
      body: existing.body,
      occurredAt: toIso(existing.occurredAt),
      timeZone: existing.timeZone,
      details: existing.details,
      ...patch,
    });
    if (!merged.success) return invalid(merged.error);
    const { kind: _kind, ...content } = merged.data;

    const updated = await timelineEntryModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: { ...content, details: content.details ?? null },
    });
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  }, ctx);

/**
 * Create the entry with this id, or bring the existing one up to date: what
 * PowerSync's upload queue sends for a row a device created. Safe to replay:
 * a second identical call changes nothing but `updatedAt`.
 *
 * - A new id is a `create` (same validation and group check).
 * - An existing id is an `update` of its content, by the same rules. Its
 *   group, recipient and kind must match: they never change.
 * - A deleted entry stays deleted (a delete wins over a late edit).
 * - An id that exists but the actor can't see is refused, without saying
 *   whether it exists.
 */
export const upsert = (ctx: ServiceContext, input: TimelineEntryUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = timelineEntryUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, kind, title, body, occurredAt, timeZone, details } = parsed.data;

    // Existence is checked as the system, so a taken id is refused cleanly
    // rather than failing on the primary key.
    const existing = await timelineEntryModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) return create({ ...ctx, tx }, parsed.data);

    const visible = await timelineEntryModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);

    if (
      visible.groupId !== groupId ||
      visible.kind !== kind ||
      (recipientId !== undefined && visible.recipientId !== recipientId)
    )
      return newError({ code: "timelineEntryService:immutable" });
    if (visible.deletedAt) return visible;

    return update({ ...ctx, tx }, id, { title, body, occurredAt, timeZone, details: details ?? null });
  }, ctx);

/** Soft delete. The entry disappears from the timeline but syncs as deleted. */
export const remove = async (ctx: ServiceContext, id: string) => {
  const res = await timelineEntryModel.remove({ ...ctx, filter: { id: { type: "eq", value: id } } });
  if (isError(res) && res.code === "baseModel:remove:nothingRemoved") return notFound();
  return res;
};
