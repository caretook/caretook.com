import type { AppError, AuthUser, ErrorCode, Tx, Upserted } from "@caretook/data";
import type { CrudOp } from "./sync";

import {
  appointmentSeriesService,
  carePeriodService,
  entryProviderService,
  isError,
  medicationConditionService,
  medicationPassService,
  medicationService,
  newError,
  noteDocumentService,
  OWN_DOSE_COPY_METADATA,
  providerService,
  recipientAllergyService,
  recipientConditionService,
  timelineEntryService,
  todoService,
  UNDO_NEXT_METADATA,
  withTransaction,
} from "@caretook/data";

// The upload registry: which device tables `sync.upload` writes, and how each
// op maps onto the services (never the models, so RBAC and validation apply
// as everywhere). The procedure's loop is in sync.ts.
//
// A soft-delete table is a spec: its content columns, its fixed columns, its
// service and whether it passes the device's `updated_at` as `changedAt`. One
// generic handler (`softDelete`) turns it into PUT (`upsert`), PATCH
// (`update`, or `remove` when it sets `deleted_at`) and DELETE (`remove`),
// with one answer per situation on every table: a member who can read but
// not write is `permissions:unauthorized`, a missing row the table's
// `notFound`, a changed fixed column its `immutable`, a delete of a deleted
// row `applied`, a PATCH naming a column in no list `sync:unknownColumn`.
// A service's more specific reason wins (a todo's `completionOnly`). Link
// tables, live notes and `care_recipient` are small handlers beside them.
//
// Every column of an uploadable device table is in one of its lists
// (`UploadColumns`): syncRegistry.test.ts checks them against the device
// schema and powersync/sync-config.yaml.

/** The uploader; `tx` while a PUT and its follow-ups run as one transaction. */
type Ctx = { authUser: AuthUser; tx?: Tx };
export type Outcome = AppError | { ok: true };
type Handler = (ctx: Ctx, op: CrudOp) => Promise<Outcome>;

/** A table's columns as the upload sees them. */
export type UploadColumns = {
  /** Content a device may set (the service's field is the column in camelCase). */
  content: readonly string[];
  /** Set on create only: a PATCH naming one is refused (`immutable`, or read-only). */
  fixed: readonly string[];
  /** Read by the table's own rules (a todo's tick, a series' first top-up). */
  handled: readonly string[];
  /** Set by the server, or read-only on the device: ids, audits, `deleted_at`, `via`… */
  serverSet: readonly string[];
};

export type UploadEntry = { columns: UploadColumns; handle: Handler };

const applied = { ok: true } as const;
const outcome = (res: unknown): Outcome => (isError(res) ? res : applied);
const readOnly = (table: string, op: CrudOp["op"]) =>
  newError({ code: "sync:readOnlyTable", meta: { table, op } });
const unauthorized = () => newError({ code: "permissions:unauthorized" });

// ---------------------------------------------------------------------------
// Values: SQLite row values → service input.
// ---------------------------------------------------------------------------

/** A text column. Other values become text the service will reject, rather than a crash here. */
export const text = (value: unknown) =>
  typeof value === "string" ? value : value == null ? null : JSON.stringify(value);

/**
 * A device's timestamp text → ISO 8601. PowerSync writes ISO with
 * microseconds ("2026-11-17T10:00:00.000000Z"); a space instead of the T is
 * accepted too. Anything unexpected passes through for the service to reject.
 */
const timestamp = (value: unknown) => text(value)?.replace(" ", "T") ?? null;

/** jsonb arrives as JSON text. Unparseable text is passed on, and fails validation. */
const json = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
const jsonList = (value: unknown) => json(value) ?? [];

/** SQLite has no boolean: PowerSync stores 1/0. */
const bool = (value: unknown) =>
  value === 1 || value === "1" || value === true
    ? true
    : value === 0 || value === "0" || value === false
      ? false
      : value;
const flag = (value: unknown) => bool(value) ?? false;

/** An integer column. Other values pass through for the service to reject. */
const int = (value: unknown) =>
  typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : (value ?? null);

/** Device column → its value mapper. */
type ColumnMap = Readonly<Record<string, (value: unknown) => unknown>>;

const words = (columns: string) => columns.split(" ");

/** Space-separated columns that all map one way. */
const each = (columns: string, map: (value: unknown) => unknown): ColumnMap =>
  Object.fromEntries(words(columns).map((c) => [c, map]));

const camel = (column: string) => column.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());

const mapped = (map: ColumnMap, data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).flatMap(([column, value]) => {
      const to = Object.hasOwn(map, column) ? map[column] : undefined;
      return to ? [[camel(column), to(value)]] : [];
    }),
  );

const columnsOf = (columns: Partial<UploadColumns>): UploadColumns => ({
  content: columns.content ?? [],
  fixed: columns.fixed ?? [],
  handled: columns.handled ?? [],
  serverSet: ["id", "created_at", "updated_at", "created_by", "updated_by", ...(columns.serverSet ?? [])],
});

// ---------------------------------------------------------------------------
// Soft-delete tables
// ---------------------------------------------------------------------------

/** `{ changedAt }`, passed only to the services that take it (`changedAt: true`). */
type Opts = object;

/** What the generic handler calls. Method syntax, so each service's own input types fit. */
type SoftDeleteService = {
  /** Create-if-absent: an existing row is left as it was (`created: false`). */
  upsert(ctx: Ctx, input: Record<string, unknown>, opts?: Opts): Promise<AppError | Upserted<unknown>>;
  update(ctx: Ctx, id: string, content: Record<string, unknown>, opts?: Opts): Promise<unknown>;
  remove(ctx: Ctx, id: string): Promise<unknown>;
  getById(
    ctx: Ctx,
    id: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<AppError | { deletedAt?: string | null } | null>;
};

/** The generic writes, for a spec's own rules. */
type Writes = {
  remove: (ctx: Ctx, id: string) => Promise<Outcome>;
  update: (ctx: Ctx, op: CrudOp, content: Record<string, unknown>) => Promise<Outcome>;
};

type SoftDeleteSpec = {
  service: SoftDeleteService;
  /** The service's error prefix: `<errors>:immutable` and `<errors>:notFound`. */
  errors: string;
  content: ColumnMap;
  fixed: ColumnMap;
  /** Set on create only, and ignored on a PATCH (a series' `topped_up_through`). */
  createOnly?: ColumnMap;
  /** Columns `put`/`patch` read. */
  handled?: readonly string[];
  serverSet?: readonly string[];
  /** Pass the device's `updated_at` as `changedAt` (the timeline change entry's time and id). */
  changedAt?: boolean;
  /** A PUT's write, in place of `upsert`; null: nothing to do. */
  put?: (
    ctx: Ctx,
    op: CrudOp,
    input: Record<string, unknown>,
  ) => Promise<AppError | Upserted<unknown> | null>;
  /** A PUT's follow-up after the create (only when this PUT created the row). */
  afterPut?: (ctx: Ctx, op: CrudOp) => Promise<Outcome>;
  /** A PATCH, after the column checks, in place of the generic one. */
  patch?: (ctx: Ctx, op: CrudOp, writes: Writes) => Promise<Outcome>;
};

const softDelete = (spec: SoftDeleteSpec): UploadEntry => {
  const { service } = spec;
  const code = (suffix: "immutable" | "notFound") => `${spec.errors}:${suffix}` as ErrorCode;
  const opts = (op: CrudOp) => (spec.changedAt ? { changedAt: text(op.data?.updated_at) } : undefined);
  const columns = columnsOf({
    content: Object.keys(spec.content),
    fixed: Object.keys(spec.fixed),
    handled: [...Object.keys(spec.createOnly ?? {}), ...(spec.handled ?? [])],
    serverSet: ["deleted_at", ...(spec.serverSet ?? [])],
  });
  const known = new Set(Object.values(columns).flat());

  /** Soft delete. Deleting a deleted row is a replay: fine. One more read tells a reader from no row. */
  const remove = async (ctx: Ctx, id: string): Promise<Outcome> => {
    const res = await service.remove(ctx, id);
    if (!isError(res)) return applied;
    if (res.code !== code("notFound")) return res;
    const row = await service.getById(ctx, id, { includeDeleted: true });
    if (isError(row)) return row;
    return !row ? res : row.deletedAt ? applied : unauthorized();
  };

  /** Nothing updated: a member who can read but not write, or no row. */
  const update = async (ctx: Ctx, op: CrudOp, content: Record<string, unknown>): Promise<Outcome> => {
    const res = await service.update(ctx, op.id, content, opts(op));
    if (isError(res) && res.code !== "baseModel:update:nothingUpdated") return res;
    if (!isError(res) && res) return applied;
    const row = await service.getById(ctx, op.id);
    if (isError(row)) return row;
    return row ? unauthorized() : newError({ code: code("notFound") });
  };

  const handle: Handler = async (ctx, op) => {
    const data = op.data ?? {};
    if (op.op === "DELETE") return remove(ctx, op.id);

    // PUT: a create, replayed at most (B-288). Its follow-ups (created and
    // deleted, or ticked, before it was uploaded) belong to the create: they
    // run only when this PUT made the row, in its transaction, so a replay
    // never re-deletes or re-ticks what someone changed since.
    if (op.op === "PUT") {
      const input = { id: op.id, ...mapped({ ...spec.fixed, ...spec.content, ...spec.createOnly }, data) };
      return withTransaction(async (tx): Promise<Outcome> => {
        const inTx = { ...ctx, tx };
        // Unchecked here on purpose: the service validates the whole shape.
        const res = spec.put ? await spec.put(inTx, op, input) : await service.upsert(inTx, input, opts(op));
        if (isError(res)) return res;
        // A stale twin (todo), or a row that was already there: nothing more to do.
        if (res === null || !res.created) return applied;
        if (data.deleted_at) return remove(inTx, op.id);
        return spec.afterPut ? spec.afterPut(inTx, op) : applied;
      });
    }

    // PATCH: only the columns that changed.
    const unknown = Object.keys(data).filter((c) => !known.has(c));
    if (unknown.length > 0)
      return newError({ code: "sync:unknownColumn", meta: { table: op.table, columns: unknown } });
    if (Object.keys(spec.fixed).some((c) => c in data)) return newError({ code: code("immutable") });
    if (spec.patch) return spec.patch(ctx, op, { remove, update });
    if (data.deleted_at) return remove(ctx, op.id);
    const content = mapped(spec.content, data);
    return Object.keys(content).length === 0 ? applied : update(ctx, op, content);
  };

  return { columns, handle };
};

/** `recipient_id` left out is the group's recipient. */
const GROUP_RECIPIENT = { group_id: text, recipient_id: (v: unknown) => text(v) ?? undefined };

const TIMELINE_CONTENT: ColumnMap = {
  ...each("title body time_zone place cancel_reason rescheduled_to series_id series_day", text),
  ...each("occurred_at ends_at cancelled_at", timestamp),
  ...each("all_day series_detached", flag),
  details: json,
};

const timelineEntry = softDelete({
  service: timelineEntryService,
  errors: "timelineEntryService",
  fixed: { ...GROUP_RECIPIENT, kind: text },
  content: TIMELINE_CONTENT,
  // The service sets `cancelled_by`, like the audit columns. `via` syncs down only (connectors).
  // `symptom_type_id`: the service derives it from the name (symptom-catalog); the device's is ignored.
  serverSet: ["cancelled_by", "via", "symptom_type_id"],
  // A dose logged and undone before it uploaded, onto another member's row:
  // their dose stands, live or deleted (B-614).
  put: async (ctx, op, input) => {
    if (op.data?.deleted_at) {
      const theirs = await timelineEntryService.anotherMembersDose(ctx, op.id);
      if (isError(theirs)) return theirs;
      if (theirs?.groupId === input.groupId) return null;
    }
    return timelineEntryService.upsert(ctx, input as never);
  },
  patch: async (ctx, op, { remove, update }) => {
    const data = op.data ?? {};
    // The device's edit or Undo of its own copy, whose PUT was a duplicate (B-614).
    if (op.metadata === OWN_DOSE_COPY_METADATA) {
      const theirs = await timelineEntryService.anotherMembersDose(ctx, op.id);
      if (isError(theirs)) return theirs;
      if (theirs) return applied;
    }
    if (data.deleted_at) return remove(ctx, op.id);
    const content = mapped(TIMELINE_CONTENT, data);
    return Object.keys(content).length === 0 ? applied : update(ctx, op, content);
  },
});

const provider = softDelete({
  service: providerService,
  errors: "providerService",
  fixed: { group_id: text },
  content: {
    ...each("type name specialty practice_id email address website status", text),
    phones: jsonList,
    is_primary: bool,
  },
});

// The service writes the timeline's change entry with each save, with an id
// derived from the medication and the device's `updated_at`, so the copy of
// that entry the device uploads next lands on the same row.
const medication = softDelete({
  service: medicationService,
  errors: "medicationService",
  fixed: GROUP_RECIPIENT,
  changedAt: true,
  content: {
    ...each("name strength form dose directions reason status started_on stopped_on stop_reason", text),
    ...each("stop_note prescriber_id pharmacy_id last_filled_on quantity rx_number type", text),
    schedule: json,
    refills_left: int,
  },
});

// A retime writes its `passMoved` entry (id from the pass and the device's
// `updated_at`), and a delete rewrites every schedule naming the pass, so the
// device's own copies of both, uploaded next, change nothing.
const medicationPass = softDelete({
  service: medicationPassService,
  errors: "medicationPassService",
  fixed: GROUP_RECIPIENT,
  changedAt: true,
  content: { ...each("name time", text), sort_order: int },
});

const recipientAllergy = softDelete({
  service: recipientAllergyService,
  errors: "recipientAllergyService",
  fixed: GROUP_RECIPIENT,
  content: each("substance reaction severity", text),
});

const carePeriod = softDelete({
  service: carePeriodService,
  errors: "carePeriodService",
  fixed: GROUP_RECIPIENT,
  content: {
    ...each("type label place_provider_id place_detail", text),
    started_at: timestamp,
    date_only: flag,
  },
});

// A status PATCH (resolve, reactivate) is an update. Each write records its
// `conditionChange` entry (id from the condition and the device's
// `updated_at`), so the device's own copy, uploaded next, changes nothing.
const recipientCondition = softDelete({
  service: recipientConditionService,
  errors: "recipientConditionService",
  fixed: GROUP_RECIPIENT,
  changedAt: true,
  content: { ...each("name status note diagnosed_by_id", text), ...each("since_year since_month", int) },
});

// A series PUT comes before its visits' entry PUTs, which carry `series_id`.
// `topped_up_through` is set on create only: after that, the server tops up.
const appointmentSeries = softDelete({
  service: appointmentSeriesService,
  errors: "appointmentSeriesService",
  fixed: { ...GROUP_RECIPIENT, kind: text },
  createOnly: { topped_up_through: text },
  content: {
    ...each("rule starts_on start_time time_zone title place", text),
    all_day: flag,
    duration_minutes: int,
    provider_ids: jsonList,
  },
});

// todo: the done fields map to complete and reopen, so a viewer's offline
// tick uploads; the server sets `done_by` to the uploader. The anchor and
// chain (`repeat_starts_on`, `repeat_id`) follow the rule and due day on the
// server (`repeatColumnsFor`), as on the device.
const TODO_CONTENT = each(
  "title assignee_id assignee_name due_on due_time provider_id medication_id event_id repeat_rule",
  text,
);

/** `done_at` set → complete (at that time), cleared → reopen. */
const setTodoDone = async (ctx: Ctx, id: string, doneAt: unknown): Promise<Outcome> => {
  const at = timestamp(doneAt);
  return outcome(
    at ? await todoService.complete(ctx, id, { doneAt: at }) : await todoService.reopen(ctx, id),
  );
};

const todo = softDelete({
  service: todoService,
  errors: "todoService",
  fixed: GROUP_RECIPIENT,
  content: TODO_CONTENT,
  handled: ["done_at", "repeat_id", "repeat_starts_on"],
  serverSet: ["done_by", "via"],
  // A repeating todo's later occurrence (its chain is another todo's): the
  // twin of the row the server makes on the tick, or a device's skip.
  put: (ctx, op, input) => {
    const repeatId = text(op.data?.repeat_id);
    if (!repeatId || repeatId === op.id) return todoService.upsert(ctx, input as never);
    const occurrence = { ...input, repeatId, repeatStartsOn: text(op.data?.repeat_starts_on) };
    return todoService.upsertOccurrence(ctx, occurrence as never);
  },
  afterPut: async (ctx, op) => (op.data?.done_at ? setTodoDone(ctx, op.id, op.data.done_at) : applied),
  patch: async (ctx, op, { remove, update }) => {
    const data = op.data ?? {};
    // An Undo's soft delete of the next occurrence: only an untouched one goes (B-382).
    if (data.deleted_at && op.metadata === UNDO_NEXT_METADATA)
      return outcome(await todoService.removeUndoneNext(ctx, op.id));
    if (data.deleted_at) return remove(ctx, op.id);
    // A repeating todo's later occurrence brought back (a tick or skip remade
    // one an Undo took away); its content follows as an ordinary edit.
    if ("deleted_at" in data) {
      const res = await todoService.restoreOccurrence(ctx, op.id);
      if (isError(res)) return res;
    }
    const content = mapped(TODO_CONTENT, data);
    // A tick or reopen decides the repeat on the server (a reopen whose next
    // was edited stops repeating there too), so a device's copy of it is ignored.
    if ("done_at" in data) delete content.repeatRule;
    if (Object.keys(content).length > 0) {
      const res = await update(ctx, op, content);
      if (isError(res)) return res;
    }
    // A done-only PATCH (a tick or a reopen) is a complete or reopen.
    return "done_at" in data ? setTodoDone(ctx, op.id, data.done_at) : applied;
  },
});

// ---------------------------------------------------------------------------
// Small handlers
// ---------------------------------------------------------------------------

/** What a link table calls. Method syntax, so each service's own input types fit. */
type LinkService = {
  link(ctx: Ctx, input: Record<string, string>): Promise<unknown>;
  unlink(ctx: Ctx, id: string): Promise<unknown>;
};

/** Links are added (PUT) and removed (DELETE), never changed. */
const linkTable = (table: string, ends: string, service: LinkService): UploadEntry => {
  const fixed = ["group_id", ...words(ends)];
  return {
    columns: columnsOf({ fixed }),
    handle: async (ctx, op) => {
      if (op.op === "PATCH") return readOnly(table, op.op);
      if (op.op === "DELETE") return outcome(await service.unlink(ctx, op.id));
      const ids = fixed.map((c): [string, string] => [camel(c), text(op.data?.[c]) ?? ""]);
      return outcome(await service.link(ctx, { id: op.id, ...Object.fromEntries(ids) }));
    },
  };
};

const entryProvider = linkTable("timeline_entry_provider", "entry_id provider_id", entryProviderService);
// What a medication is for.
const medicationCondition = linkTable(
  "medication_condition",
  "medication_id condition_id",
  medicationConditionService,
);

// Live documents. Devices create a document (its id is the entry's) and
// append Yjs updates; nothing else. Snapshots and text are the server's.
const noteDocument: UploadEntry = {
  columns: columnsOf({
    fixed: ["group_id", "subject"],
    serverSet: words("snapshot text editors entry_id provider_id medication_id care_period_id todo_id"),
  }),
  handle: async (ctx, op) => {
    if (op.op !== "PUT") return readOnly("note_document", op.op);
    const res = await noteDocumentService.create(ctx, {
      id: op.id,
      groupId: text(op.data?.group_id) ?? "",
      // An entry's, unless the device says otherwise (older devices never do).
      subject: (text(op.data?.subject) ?? undefined) as
        "entry" | "provider" | "medication" | "carePeriod" | "todo" | undefined,
    });
    return outcome(res);
  },
};

const noteUpdate: UploadEntry = {
  columns: columnsOf({ fixed: ["group_id", "document_id", "data"] }),
  handle: async (ctx, op) => {
    if (op.op !== "PUT") return readOnly("note_update", op.op);
    const of = (column: string) => text(op.data?.[column]) ?? "";
    const update = { id: op.id, groupId: of("group_id"), documentId: of("document_id"), data: of("data") };
    return outcome(await noteDocumentService.appendUpdate(ctx, update));
  },
};

// care_recipient: read-only, except "No known allergies" and "No known
// conditions": a PATCH of only one of them sets or clears it.
const NO_KNOWN = {
  no_known_allergies_at: recipientAllergyService.setNoKnownAllergies,
  no_known_conditions_at: recipientConditionService.setNoKnownConditions,
} as const;

const careRecipient: UploadEntry = {
  columns: columnsOf({
    content: Object.keys(NO_KNOWN),
    serverSet: words(
      "group_id name preferred_name time_zone date_of_birth code_status blood_type primary_language pronouns notes",
    ),
  }),
  handle: async (ctx, op) => {
    const [column, ...rest] = Object.keys(op.data ?? {});
    if (op.op !== "PATCH" || rest.length > 0 || !column || !Object.hasOwn(NO_KNOWN, column))
      return readOnly(op.table, op.op);
    const set = NO_KNOWN[column as keyof typeof NO_KNOWN];
    return outcome(await set(ctx, op.id, timestamp(op.data?.[column])));
  },
};

// condition_manager: who manages a condition. Each link and unlink is
// recorded in the change entry of its save's time (the device's
// `updated_at`), so one save's links are one entry. A DELETE carries no data,
// so the device first PATCHes the link's `updated_at` to the save's time:
// that PATCH is the unlink, and the DELETE after it a replay.
const UNLINK_STAMP_COLUMNS = new Set(["updated_at", "updated_by"]);

const conditionManager: UploadEntry = {
  columns: columnsOf({ fixed: ["group_id", "condition_id", "provider_id"] }),
  handle: async (ctx, op) => {
    const data = op.data ?? {};
    const changedAt = text(data.updated_at);
    if (op.op === "PATCH") {
      const columns = Object.keys(data);
      if (!columns.includes("updated_at") || !columns.every((c) => UNLINK_STAMP_COLUMNS.has(c)))
        return readOnly("condition_manager", op.op);
      return outcome(await recipientConditionService.unlinkManager(ctx, op.id, { changedAt }));
    }
    if (op.op === "DELETE") return outcome(await recipientConditionService.unlinkManager(ctx, op.id));
    const of = (column: string) => text(data[column]) ?? "";
    const link = {
      id: op.id,
      groupId: of("group_id"),
      conditionId: of("condition_id"),
      providerId: of("provider_id"),
    };
    return outcome(
      await recipientConditionService.linkManager(ctx, link, {
        changedAt: changedAt ?? text(data.created_at),
      }),
    );
  },
};

// ---------------------------------------------------------------------------
// The registry. A Map, so only its own keys are tables: `constructor`,
// `__proto__` and any other name are refused as read-only.
// ---------------------------------------------------------------------------

export const UPLOAD_REGISTRY: ReadonlyMap<string, UploadEntry> = new Map([
  ["timeline_entry", timelineEntry],
  ["note_document", noteDocument],
  ["note_update", noteUpdate],
  ["provider", provider],
  ["timeline_entry_provider", entryProvider],
  ["medication", medication],
  ["medication_pass", medicationPass],
  ["recipient_allergy", recipientAllergy],
  ["care_recipient", careRecipient],
  ["care_period", carePeriod],
  ["todo", todo],
  ["recipient_condition", recipientCondition],
  ["medication_condition", medicationCondition],
  ["condition_manager", conditionManager],
  ["appointment_series", appointmentSeries],
]);

/** One op through its table's handler; any other table is read-only. */
export const applyOp = (ctx: Ctx, op: CrudOp): Promise<Outcome> =>
  UPLOAD_REGISTRY.get(op.table)?.handle(ctx, op) ?? Promise.resolve(readOnly(op.table, op.op));
