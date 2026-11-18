import type { AppError, AuthUser, ProviderUpsertInput, TimelineEntryUpsertInput } from "@caretook/data";

import {
  entryProviderService,
  ERRORS,
  isError,
  newError,
  noteDocumentService,
  providerService,
  timelineEntryService,
} from "@caretook/data";
import { z } from "zod";
import { unwrap } from "./errors";
import { authedProcedure } from "./procedures";

// PowerSync's upload queue. A device writes to its local SQLite, PowerSync
// queues each change as a CRUD op, and the client posts them here in order.
// Every op goes through the services, so RBAC and validation apply exactly as
// they do for the timeline procedures.
//
// Outcomes:
// - applied: the change is in Postgres.
// - rejected: the services refused it (invalid, not allowed, not found…).
//   The op is still acknowledged. PowerSync then replaces the device's copy
//   with the server's, so a refused change disappears instead of blocking
//   the queue forever.
// - Anything else (the database is down) throws, and the client retries the
//   whole batch later. Ops are idempotent, so the ones already applied are
//   harmless to replay.

export const SYNC_BATCH_LIMIT = 100;

const crudOpZSchema = z.object({
  op: z.enum(["PUT", "PATCH", "DELETE"]),
  table: z.string().max(64),
  id: z.uuid(),
  // Column values as SQLite stores them (snake_case, JSON as text).
  data: z.record(z.string(), z.unknown()).nullish(),
});
export type CrudOp = z.infer<typeof crudOpZSchema>;

export type CrudResult =
  | { id: string; status: "applied" }
  | { id: string; status: "rejected"; code: string; issues?: { path: string; message: string }[] };

type Outcome = AppError | { ok: true };

const applied = { ok: true } as const;

/** 4xx service errors are the client's problem: acknowledge and move on. */
const isRejection = (error: AppError) => {
  const status = (ERRORS[error.code] as { statusCode?: number }).statusCode ?? 500;
  return status >= 400 && status < 500;
};

// ---------------------------------------------------------------------------
// Column mapping: SQLite row values → service input.
// ---------------------------------------------------------------------------

/** A text column. Other values become text the service will reject, rather than a crash here. */
const text = (value: unknown) =>
  typeof value === "string" ? value : value == null ? null : JSON.stringify(value);

/**
 * A device's timestamp text → ISO 8601. PowerSync writes ISO with
 * microseconds ("2026-11-17T10:00:00.000000Z"); a space instead of the T is
 * accepted too. Anything unexpected passes through for the service to reject.
 */
export const toIsoTimestamp = (value: unknown) => {
  const s = text(value);
  return s ? s.replace(" ", "T") : s;
};

/** jsonb arrives as JSON text. Unparseable text is passed on, and fails validation. */
const json = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Content columns a device may set. Ids, kind and audit columns are fixed.
const CONTENT_COLUMNS = {
  title: (v: unknown) => ["title", text(v)],
  body: (v: unknown) => ["body", text(v)],
  occurred_at: (v: unknown) => ["occurredAt", toIsoTimestamp(v)],
  time_zone: (v: unknown) => ["timeZone", text(v)],
  details: (v: unknown) => ["details", json(v)],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const FIXED_COLUMNS = ["group_id", "recipient_id", "kind"];

const contentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = CONTENT_COLUMNS[column as keyof typeof CONTENT_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

// ---------------------------------------------------------------------------
// timeline_entry
// ---------------------------------------------------------------------------

const timelineEntryOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};

  if (op.op === "PUT") {
    const input = {
      id: op.id,
      groupId: text(data.group_id),
      recipientId: text(data.recipient_id) ?? undefined,
      kind: text(data.kind),
      ...contentFrom(data),
    };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await timelineEntryService.upsert(ctx, input as unknown as TimelineEntryUpsertInput);
    if (isError(res)) return res;
    // Created and deleted before it was uploaded.
    if (data.deleted_at) return remove(ctx, op.id);
    return applied;
  }

  if (op.op === "DELETE") return remove(ctx, op.id);

  // PATCH: only the columns that changed.
  if (FIXED_COLUMNS.some((c) => c in data)) return immutable();
  if (data.deleted_at) return remove(ctx, op.id);
  const content = contentFrom(data);
  if (Object.keys(content).length === 0) return applied;
  const res = await timelineEntryService.update(ctx, op.id, content);
  if (isError(res)) return res;
  return res ? applied : notFound();
};

/** Soft delete. Deleting an entry that's already deleted is a replay: fine. */
const remove = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await timelineEntryService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "timelineEntryService:notFound") return res;
  const entry = await timelineEntryService.getById(ctx, id, { includeDeleted: true });
  if (isError(entry)) return entry;
  return entry?.deletedAt ? applied : res;
};

const immutable = () => newError({ code: "timelineEntryService:immutable" });
const notFound = () => newError({ code: "timelineEntryService:notFound" });

// ---------------------------------------------------------------------------
// Live documents. Devices create a document (its id is the entry's) and
// append Yjs updates; nothing else. Snapshots and text are the server's.
// ---------------------------------------------------------------------------

const readOnly = (table: string, op: CrudOp["op"]) =>
  newError({ code: "sync:readOnlyTable", meta: { table, op } });

const noteDocumentOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  if (op.op !== "PUT") return readOnly("note_document", op.op);
  const res = await noteDocumentService.create(ctx, {
    id: op.id,
    groupId: text(op.data?.group_id) ?? "",
    // An entry's, unless the device says otherwise (older devices never do).
    subject: (text(op.data?.subject) ?? undefined) as "entry" | "provider" | undefined,
  });
  return isError(res) ? res : applied;
};

const noteUpdateOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  if (op.op !== "PUT") return readOnly("note_update", op.op);
  const data = op.data ?? {};
  const res = await noteDocumentService.appendUpdate(ctx, {
    id: op.id,
    groupId: text(data.group_id) ?? "",
    documentId: text(data.document_id) ?? "",
    data: text(data.data) ?? "",
  });
  return isError(res) ? res : applied;
};

// ---------------------------------------------------------------------------
// provider: like timeline_entry. Soft deletes, and the group never changes.
// ---------------------------------------------------------------------------

/** SQLite has no boolean: PowerSync stores 1/0. */
const bool = (value: unknown) =>
  value === 1 || value === "1" || value === true
    ? true
    : value === 0 || value === "0" || value === false
      ? false
      : value;

const PROVIDER_COLUMNS = {
  type: (v: unknown) => ["type", text(v)],
  name: (v: unknown) => ["name", text(v)],
  specialty: (v: unknown) => ["specialty", text(v)],
  practice_id: (v: unknown) => ["practiceId", text(v)],
  phones: (v: unknown) => ["phones", json(v) ?? []],
  email: (v: unknown) => ["email", text(v)],
  address: (v: unknown) => ["address", text(v)],
  website: (v: unknown) => ["website", text(v)],
  status: (v: unknown) => ["status", text(v)],
  is_primary: (v: unknown) => ["isPrimary", bool(v)],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const providerContentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = PROVIDER_COLUMNS[column as keyof typeof PROVIDER_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

/** Soft delete. Deleting a provider that's already deleted is a replay: fine. */
const removeProvider = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await providerService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "providerService:notFound") return res;
  const provider = await providerService.getById(ctx, id, { includeDeleted: true });
  if (isError(provider)) return provider;
  return provider?.deletedAt ? applied : res;
};

const providerOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};

  if (op.op === "PUT") {
    const input = { id: op.id, groupId: text(data.group_id), ...providerContentFrom(data) };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await providerService.upsert(ctx, input as unknown as ProviderUpsertInput);
    if (isError(res)) return res;
    // Created and deleted before it was uploaded.
    if (data.deleted_at) return removeProvider(ctx, op.id);
    return applied;
  }

  if (op.op === "DELETE") return removeProvider(ctx, op.id);

  // PATCH: only the columns that changed.
  if ("group_id" in data) return newError({ code: "providerService:immutable" });
  if (data.deleted_at) return removeProvider(ctx, op.id);
  const content = providerContentFrom(data);
  if (Object.keys(content).length === 0) return applied;
  const res = await providerService.update(ctx, op.id, content);
  if (isError(res)) return res;
  return res ? applied : newError({ code: "providerService:notFound" });
};

// ---------------------------------------------------------------------------
// timeline_entry_provider: links are added (PUT) and removed (DELETE), never changed.
// ---------------------------------------------------------------------------

const entryProviderOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  if (op.op === "PATCH") return readOnly("timeline_entry_provider", op.op);
  if (op.op === "DELETE") {
    const res = await entryProviderService.unlink(ctx, op.id);
    return isError(res) ? res : applied;
  }
  const data = op.data ?? {};
  const res = await entryProviderService.link(ctx, {
    id: op.id,
    groupId: text(data.group_id) ?? "",
    entryId: text(data.entry_id) ?? "",
    providerId: text(data.provider_id) ?? "",
  });
  return isError(res) ? res : applied;
};

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

const HANDLERS: Record<string, (ctx: { authUser: AuthUser }, op: CrudOp) => Promise<Outcome>> = {
  timeline_entry: timelineEntryOp,
  note_document: noteDocumentOp,
  note_update: noteUpdateOp,
  provider: providerOp,
  timeline_entry_provider: entryProviderOp,
};

/**
 * Compact the documents this batch added updates to, when they're due.
 * Best effort: the updates are already stored, so a failure here only
 * delays compaction until the next upload.
 */
const compactTouched = async (ops: CrudOp[], results: CrudResult[]) => {
  const ids = new Set(
    ops.flatMap((op, i) =>
      op.table === "note_update" && results[i]?.status === "applied" ? [text(op.data?.document_id)] : [],
    ),
  );
  for (const id of ids) {
    if (!id) continue;
    const res = await noteDocumentService.compactIfDue(id);
    if (isError(res)) console.error("Live document compaction failed", { documentId: id, code: res.code });
  }
};

const toResult = (op: CrudOp, outcome: Outcome): CrudResult => {
  if (!isError(outcome)) return { id: op.id, status: "applied" };
  // Unexpected failures throw (as a 500): the client retries the batch.
  if (!isRejection(outcome)) unwrap(outcome);
  const issues = (outcome.meta as { issues?: { path: string; message: string }[] } | undefined)?.issues;
  return { id: op.id, status: "rejected", code: outcome.code, ...(issues ? { issues } : {}) };
};

export const sync = {
  /** Apply a device's queued changes, in order. See the notes at the top of this file. */
  upload: authedProcedure
    .input(z.object({ ops: z.array(crudOpZSchema).max(SYNC_BATCH_LIMIT) }))
    .handler(async ({ context, input }) => {
      const results: CrudResult[] = [];
      for (const op of input.ops) {
        const handler = HANDLERS[op.table];
        const outcome = handler
          ? await handler(context, op)
          : newError({ code: "sync:readOnlyTable", meta: { table: op.table } });
        results.push(toResult(op, outcome));
      }
      await compactTouched(input.ops, results);
      return { results };
    }),
};
