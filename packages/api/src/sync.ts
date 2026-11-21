import type {
  AppError,
  AuthUser,
  MedicationPassUpsertInput,
  CarePeriodUpsertInput,
  MedicationUpsertInput,
  ProviderUpsertInput,
  RecipientAllergyUpsertInput,
  RecipientConditionUpsertInput,
  TaskUpsertInput,
  TimelineEntryUpsertInput,
} from "@caretook/data";

import {
  entryProviderService,
  ERRORS,
  isError,
  logError,
  medicationConditionService,
  medicationPassService,
  carePeriodService,
  medicationService,
  newError,
  noteDocumentService,
  providerService,
  recipientAllergyService,
  recipientConditionService,
  taskService,
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

/** SQLite has no boolean: PowerSync stores 1/0. */
const bool = (value: unknown) =>
  value === 1 || value === "1" || value === true
    ? true
    : value === 0 || value === "0" || value === false
      ? false
      : value;

// Content columns a device may set. Ids, kind and audit columns are fixed.
const CONTENT_COLUMNS = {
  title: (v: unknown) => ["title", text(v)],
  body: (v: unknown) => ["body", text(v)],
  occurred_at: (v: unknown) => ["occurredAt", toIsoTimestamp(v)],
  time_zone: (v: unknown) => ["timeZone", text(v)],
  details: (v: unknown) => ["details", json(v)],
  // Appointments. `cancelled_by` isn't here: the service sets it, like the audit columns.
  ends_at: (v: unknown) => ["endsAt", toIsoTimestamp(v)],
  all_day: (v: unknown) => ["allDay", bool(v) ?? false],
  place: (v: unknown) => ["place", text(v)],
  cancelled_at: (v: unknown) => ["cancelledAt", toIsoTimestamp(v)],
  cancel_reason: (v: unknown) => ["cancelReason", text(v)],
  rescheduled_to: (v: unknown) => ["rescheduledTo", text(v)],
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
  // A member who can read but not write (a viewer): refused, not retried.
  if (isError(res) && res.code === "baseModel:update:nothingUpdated")
    return newError({ code: "permissions:unauthorized" });
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
    subject: (text(op.data?.subject) ?? undefined) as
      "entry" | "provider" | "medication" | "carePeriod" | "task" | undefined,
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
// medication: like provider. Soft deletes, and the group and recipient never
// change. The service writes the timeline's change entry with each save,
// with an id derived from the medication and the device's `updated_at`, so
// the copy of that entry the device uploads next lands on the same row.
// ---------------------------------------------------------------------------

/** An integer column. Other values pass through for the service to reject. */
const int = (value: unknown) =>
  typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : (value ?? null);

const MEDICATION_COLUMNS = {
  name: (v: unknown) => ["name", text(v)],
  strength: (v: unknown) => ["strength", text(v)],
  form: (v: unknown) => ["form", text(v)],
  dose: (v: unknown) => ["dose", text(v)],
  directions: (v: unknown) => ["directions", text(v)],
  reason: (v: unknown) => ["reason", text(v)],
  schedule: (v: unknown) => ["schedule", json(v)],
  status: (v: unknown) => ["status", text(v)],
  started_on: (v: unknown) => ["startedOn", text(v)],
  stopped_on: (v: unknown) => ["stoppedOn", text(v)],
  stop_reason: (v: unknown) => ["stopReason", text(v)],
  stop_note: (v: unknown) => ["stopNote", text(v)],
  prescriber_id: (v: unknown) => ["prescriberId", text(v)],
  pharmacy_id: (v: unknown) => ["pharmacyId", text(v)],
  last_filled_on: (v: unknown) => ["lastFilledOn", text(v)],
  quantity: (v: unknown) => ["quantity", text(v)],
  refills_left: (v: unknown) => ["refillsLeft", int(v)],
  rx_number: (v: unknown) => ["rxNumber", text(v)],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const medicationContentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = MEDICATION_COLUMNS[column as keyof typeof MEDICATION_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

/** Soft delete. Deleting a medication that's already deleted is a replay: fine. */
const removeMedication = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await medicationService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "medicationService:notFound") return res;
  const medication = await medicationService.getById(ctx, id, { includeDeleted: true });
  if (isError(medication)) return medication;
  return medication?.deletedAt ? applied : res;
};

const medicationOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};
  // When the device saved it: the change entry's time, and half of its id.
  const opts = { changedAt: text(data.updated_at) };

  if (op.op === "PUT") {
    const input = {
      id: op.id,
      groupId: text(data.group_id),
      recipientId: text(data.recipient_id) ?? undefined,
      ...medicationContentFrom(data),
    };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await medicationService.upsert(ctx, input as unknown as MedicationUpsertInput, opts);
    if (isError(res)) return res;
    // Created and deleted before it was uploaded.
    if (data.deleted_at) return removeMedication(ctx, op.id);
    return applied;
  }

  if (op.op === "DELETE") return removeMedication(ctx, op.id);

  // PATCH: only the columns that changed.
  if ("group_id" in data || "recipient_id" in data) return newError({ code: "medicationService:immutable" });
  if (data.deleted_at) return removeMedication(ctx, op.id);
  const content = medicationContentFrom(data);
  if (Object.keys(content).length === 0) return applied;
  const res = await medicationService.update(ctx, op.id, content, opts);
  if (isError(res)) return res;
  return res ? applied : newError({ code: "medicationService:notFound" });
};

// ---------------------------------------------------------------------------
// medication_pass: like medication. A retime writes its `passMoved` entry
// (id from the pass and the device's `updated_at`, like a medication's
// change), and a delete rewrites every schedule naming the pass, so the
// device's own copies of both, uploaded next, change nothing.
// ---------------------------------------------------------------------------

const PASS_COLUMNS = {
  name: (v: unknown) => ["name", text(v)],
  time: (v: unknown) => ["time", text(v)],
  sort_order: (v: unknown) => ["sortOrder", int(v)],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const passContentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = PASS_COLUMNS[column as keyof typeof PASS_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

/** Soft delete. Deleting a pass that's already deleted is a replay: fine. */
const removePass = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await medicationPassService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "medicationPassService:notFound") return res;
  const pass = await medicationPassService.getById(ctx, id, { includeDeleted: true });
  if (isError(pass)) return pass;
  return pass?.deletedAt ? applied : res;
};

const medicationPassOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};
  const opts = { changedAt: text(data.updated_at) };

  if (op.op === "PUT") {
    const input = {
      id: op.id,
      groupId: text(data.group_id),
      recipientId: text(data.recipient_id) ?? undefined,
      ...passContentFrom(data),
    };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await medicationPassService.upsert(ctx, input as unknown as MedicationPassUpsertInput, opts);
    if (isError(res)) return res;
    if (data.deleted_at) return removePass(ctx, op.id);
    return applied;
  }

  if (op.op === "DELETE") return removePass(ctx, op.id);

  if ("group_id" in data || "recipient_id" in data)
    return newError({ code: "medicationPassService:immutable" });
  if (data.deleted_at) return removePass(ctx, op.id);
  const content = passContentFrom(data);
  if (Object.keys(content).length === 0) return applied;
  const res = await medicationPassService.update(ctx, op.id, content, opts);
  if (isError(res)) return res;
  return res ? applied : newError({ code: "medicationPassService:notFound" });
};

// ---------------------------------------------------------------------------
// recipient_allergy: like provider. Soft deletes; the group and recipient never change.
// ---------------------------------------------------------------------------

const ALLERGY_COLUMNS = {
  substance: (v: unknown) => ["substance", text(v)],
  reaction: (v: unknown) => ["reaction", text(v)],
  severity: (v: unknown) => ["severity", text(v)],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const allergyContentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = ALLERGY_COLUMNS[column as keyof typeof ALLERGY_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

/** Soft delete. Deleting an allergy that's already deleted is a replay: fine. */
const removeAllergy = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await recipientAllergyService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "recipientAllergyService:notFound") return res;
  const allergy = await recipientAllergyService.getById(ctx, id, { includeDeleted: true });
  if (isError(allergy)) return allergy;
  return allergy?.deletedAt ? applied : res;
};

const recipientAllergyOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};

  if (op.op === "PUT") {
    const input = {
      id: op.id,
      groupId: text(data.group_id),
      recipientId: text(data.recipient_id) ?? undefined,
      ...allergyContentFrom(data),
    };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await recipientAllergyService.upsert(ctx, input as unknown as RecipientAllergyUpsertInput);
    if (isError(res)) return res;
    if (data.deleted_at) return removeAllergy(ctx, op.id);
    return applied;
  }

  if (op.op === "DELETE") return removeAllergy(ctx, op.id);

  if ("group_id" in data || "recipient_id" in data)
    return newError({ code: "recipientAllergyService:immutable" });
  if (data.deleted_at) return removeAllergy(ctx, op.id);
  const content = allergyContentFrom(data);
  if (Object.keys(content).length === 0) return applied;
  const res = await recipientAllergyService.update(ctx, op.id, content);
  if (isError(res)) return res;
  return res ? applied : newError({ code: "recipientAllergyService:notFound" });
};

// ---------------------------------------------------------------------------
// care_recipient: read-only, except "No known allergies" and "No known
// conditions". A PATCH touching only `no_known_allergies_at` or only
// `no_known_conditions_at` sets or clears it (care_recipient's update rule);
// anything else is refused as before.
// ---------------------------------------------------------------------------

const careRecipientOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};
  const columns = Object.keys(data);
  if (op.op !== "PATCH" || columns.length !== 1) return readOnly(op.table, op.op);
  if (columns[0] === "no_known_conditions_at") {
    const res = await recipientConditionService.setNoKnownConditions(
      ctx,
      op.id,
      toIsoTimestamp(data.no_known_conditions_at),
    );
    return isError(res) ? res : applied;
  }
  if (columns[0] !== "no_known_allergies_at") return readOnly(op.table, op.op);
  const res = await recipientAllergyService.setNoKnownAllergies(
    ctx,
    op.id,
    toIsoTimestamp(data.no_known_allergies_at),
  );
  return isError(res) ? res : applied;
};

// ---------------------------------------------------------------------------
// care_period: like medication. Soft deletes, and the group and recipient
// never change. `date_only` arrives as 1/0.
// ---------------------------------------------------------------------------

const CARE_PERIOD_COLUMNS = {
  type: (v: unknown) => ["type", text(v)],
  label: (v: unknown) => ["label", text(v)],
  place_provider_id: (v: unknown) => ["placeProviderId", text(v)],
  place_detail: (v: unknown) => ["placeDetail", text(v)],
  started_at: (v: unknown) => ["startedAt", toIsoTimestamp(v)],
  date_only: (v: unknown) => ["dateOnly", bool(v) ?? false],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const carePeriodContentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = CARE_PERIOD_COLUMNS[column as keyof typeof CARE_PERIOD_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

/** Soft delete. Deleting a period that's already deleted is a replay: fine. */
const removeCarePeriod = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await carePeriodService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "carePeriodService:notFound") return res;
  const period = await carePeriodService.getById(ctx, id, { includeDeleted: true });
  if (isError(period)) return period;
  return period?.deletedAt ? applied : res;
};

const carePeriodOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};

  if (op.op === "PUT") {
    const input = {
      id: op.id,
      groupId: text(data.group_id),
      recipientId: text(data.recipient_id) ?? undefined,
      ...carePeriodContentFrom(data),
    };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await carePeriodService.upsert(ctx, input as unknown as CarePeriodUpsertInput);
    if (isError(res)) return res;
    // Created and deleted before it was uploaded.
    if (data.deleted_at) return removeCarePeriod(ctx, op.id);
    return applied;
  }

  if (op.op === "DELETE") return removeCarePeriod(ctx, op.id);

  // PATCH: only the columns that changed.
  if ("group_id" in data || "recipient_id" in data) return newError({ code: "carePeriodService:immutable" });
  if (data.deleted_at) return removeCarePeriod(ctx, op.id);
  const content = carePeriodContentFrom(data);
  if (Object.keys(content).length === 0) return applied;
  const res = await carePeriodService.update(ctx, op.id, content);
  if (isError(res)) return res;
  return res ? applied : newError({ code: "carePeriodService:notFound" });
};

// ---------------------------------------------------------------------------
// task: like care_period (soft deletes; the group and recipient never
// change). The done fields map to complete and reopen, so a viewer's
// offline tick uploads; the server sets `done_by` to the uploader.
// ---------------------------------------------------------------------------

const TASK_COLUMNS = {
  title: (v: unknown) => ["title", text(v)],
  assignee_id: (v: unknown) => ["assigneeId", text(v)],
  assignee_name: (v: unknown) => ["assigneeName", text(v)],
  due_on: (v: unknown) => ["dueOn", text(v)],
  due_time: (v: unknown) => ["dueTime", text(v)],
  provider_id: (v: unknown) => ["providerId", text(v)],
  medication_id: (v: unknown) => ["medicationId", text(v)],
  event_id: (v: unknown) => ["eventId", text(v)],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const taskContentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = TASK_COLUMNS[column as keyof typeof TASK_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

/** Soft delete. Deleting a task that's already deleted is a replay: fine. */
const removeTask = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await taskService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "taskService:notFound") return res;
  const task = await taskService.getById(ctx, id, { includeDeleted: true });
  if (isError(task)) return task;
  return task?.deletedAt ? applied : res;
};

/** `done_at` set → complete (at that time), cleared → reopen. */
const setTaskDone = async (ctx: { authUser: AuthUser }, id: string, doneAt: unknown): Promise<Outcome> => {
  const at = toIsoTimestamp(doneAt);
  const res = at ? await taskService.complete(ctx, id, { doneAt: at }) : await taskService.reopen(ctx, id);
  return isError(res) ? res : applied;
};

const taskOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};

  if (op.op === "PUT") {
    const input = {
      id: op.id,
      groupId: text(data.group_id),
      recipientId: text(data.recipient_id) ?? undefined,
      ...taskContentFrom(data),
    };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await taskService.upsert(ctx, input as unknown as TaskUpsertInput);
    if (isError(res)) return res;
    // Created and deleted (or ticked) before it was uploaded.
    if (data.deleted_at) return removeTask(ctx, op.id);
    if (data.done_at) return setTaskDone(ctx, op.id, data.done_at);
    return applied;
  }

  if (op.op === "DELETE") return removeTask(ctx, op.id);

  // PATCH: only the columns that changed.
  if ("group_id" in data || "recipient_id" in data) return newError({ code: "taskService:immutable" });
  if (data.deleted_at) return removeTask(ctx, op.id);
  const content = taskContentFrom(data);
  if (Object.keys(content).length > 0) {
    const res = await taskService.update(ctx, op.id, content);
    if (isError(res)) return res;
    if (!res) return newError({ code: "taskService:notFound" });
  }
  // A done-only PATCH (a tick or a reopen) is a complete or reopen.
  if ("done_at" in data) return setTaskDone(ctx, op.id, data.done_at);
  return applied;
};

// ---------------------------------------------------------------------------
// recipient_condition: like recipient_allergy. Soft deletes; the group and
// recipient never change. A status PATCH (resolve, reactivate) is an update.
// Each write records its `conditionChange` entry (id from the condition and
// the device's `updated_at`, like a medication's change), so the device's own
// copy, uploaded next, changes nothing.
// ---------------------------------------------------------------------------

const CONDITION_COLUMNS = {
  name: (v: unknown) => ["name", text(v)],
  status: (v: unknown) => ["status", text(v)],
  since_year: (v: unknown) => ["sinceYear", int(v)],
  since_month: (v: unknown) => ["sinceMonth", int(v)],
  note: (v: unknown) => ["note", text(v)],
  diagnosed_by_id: (v: unknown) => ["diagnosedById", text(v)],
} as const satisfies Record<string, (v: unknown) => [string, unknown]>;

const conditionContentFrom = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const map = CONDITION_COLUMNS[column as keyof typeof CONDITION_COLUMNS];
      return map ? [map(value)] : [];
    }),
  );

/** Soft delete. Deleting a condition that's already deleted is a replay: fine. */
const removeCondition = async (ctx: { authUser: AuthUser }, id: string): Promise<Outcome> => {
  const res = await recipientConditionService.remove(ctx, id);
  if (!isError(res)) return applied;
  if (res.code !== "recipientConditionService:notFound") return res;
  const condition = await recipientConditionService.getById(ctx, id, { includeDeleted: true });
  if (isError(condition)) return condition;
  return condition?.deletedAt ? applied : res;
};

const recipientConditionOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};
  const opts = { changedAt: text(data.updated_at) };

  if (op.op === "PUT") {
    const input = {
      id: op.id,
      groupId: text(data.group_id),
      recipientId: text(data.recipient_id) ?? undefined,
      ...conditionContentFrom(data),
    };
    // Unchecked here on purpose: the service validates the whole shape.
    const res = await recipientConditionService.upsert(
      ctx,
      input as unknown as RecipientConditionUpsertInput,
      opts,
    );
    if (isError(res)) return res;
    if (data.deleted_at) return removeCondition(ctx, op.id);
    return applied;
  }

  if (op.op === "DELETE") return removeCondition(ctx, op.id);

  if ("group_id" in data || "recipient_id" in data)
    return newError({ code: "recipientConditionService:immutable" });
  if (data.deleted_at) return removeCondition(ctx, op.id);
  const content = conditionContentFrom(data);
  if (Object.keys(content).length === 0) return applied;
  const res = await recipientConditionService.update(ctx, op.id, content, opts);
  if (isError(res)) return res;
  return res ? applied : newError({ code: "recipientConditionService:notFound" });
};

// ---------------------------------------------------------------------------
// medication_condition: what a medication is for (conditions slice 4). Like
// timeline_entry_provider: links are added (PUT) and removed (DELETE), never changed.
// ---------------------------------------------------------------------------

const medicationConditionOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  if (op.op === "PATCH") return readOnly("medication_condition", op.op);
  if (op.op === "DELETE") {
    const res = await medicationConditionService.unlink(ctx, op.id);
    return isError(res) ? res : applied;
  }
  const data = op.data ?? {};
  const res = await medicationConditionService.link(ctx, {
    id: op.id,
    groupId: text(data.group_id) ?? "",
    medicationId: text(data.medication_id) ?? "",
    conditionId: text(data.condition_id) ?? "",
  });
  return isError(res) ? res : applied;
};

// ---------------------------------------------------------------------------
// condition_manager: who manages a condition (conditions slice 3). Links are
// added (PUT) and removed, never changed. Each link and unlink is recorded in
// the change entry of its save's time (the device's `updated_at`), so one
// save's links are one entry. A DELETE carries no data, so the device first
// PATCHes the link's `updated_at` to the save's time: that PATCH is the
// unlink, and the DELETE after it a replay.
// ---------------------------------------------------------------------------

const UNLINK_STAMP_COLUMNS = new Set(["updated_at", "updated_by"]);

const conditionManagerOp = async (ctx: { authUser: AuthUser }, op: CrudOp): Promise<Outcome> => {
  const data = op.data ?? {};
  if (op.op === "PATCH") {
    const columns = Object.keys(data);
    if (!columns.includes("updated_at") || !columns.every((c) => UNLINK_STAMP_COLUMNS.has(c)))
      return readOnly("condition_manager", op.op);
    const res = await recipientConditionService.unlinkManager(ctx, op.id, {
      changedAt: text(data.updated_at),
    });
    return isError(res) ? res : applied;
  }
  if (op.op === "DELETE") {
    const res = await recipientConditionService.unlinkManager(ctx, op.id);
    return isError(res) ? res : applied;
  }
  const res = await recipientConditionService.linkManager(
    ctx,
    {
      id: op.id,
      groupId: text(data.group_id) ?? "",
      conditionId: text(data.condition_id) ?? "",
      providerId: text(data.provider_id) ?? "",
    },
    { changedAt: text(data.updated_at) ?? text(data.created_at) },
  );
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
  medication: medicationOp,
  medication_pass: medicationPassOp,
  recipient_allergy: recipientAllergyOp,
  care_recipient: careRecipientOp,
  care_period: carePeriodOp,
  task: taskOp,
  recipient_condition: recipientConditionOp,
  medication_condition: medicationConditionOp,
  condition_manager: conditionManagerOp,
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
    if (isError(res)) logError("sync: live document compaction failed", res, { recordId: id });
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
