import type {
  ConditionChangeSource,
  ConditionProviderRef,
  ConditionStatus,
  RecipientConditionContentInput,
} from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { ConditionLike, ConditionState } from "./conditions";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import {
  CONDITION_STATUSES,
  conditionChange,
  conditionChangeId,
  conditionManagerId,
  recipientConditionContentZSchema,
  recipientConditionUpdateZSchema,
} from "@caretook/data/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { useMemo } from "react";
import { conditionState } from "./conditions";
import { newProviderRow } from "../providers/providers.sync";
import { useLiveQuery } from "../sync/index";
import {
  careRecipients,
  conditionManagers,
  providers as providerTable,
  recipientConditions,
  timelineEntries,
} from "../sync/schema";
import { forbidden, groupFor, nowTimestamp, readRows, WRITER_ROLES } from "../timeline/timeline.sync";

// The recipient's conditions on this device (conditions PRD): local queries
// for `useLiveQuery` and loaders, and local writes that validate with the
// shared Zod schemas and check the role, like allergies.sync.ts. Writes queue
// for upload (sync.upload), where recipientConditionService checks them
// again. Each write is one local transaction, so what a change also writes
// (its timeline entry, its links) can go in beside it.
//
// "No known conditions" is the recipient's `no_known_conditions_at`. Adding a
// condition clears it in the same local transaction (the server does the same).
//
// Adding, editing, resolving and reactivating write the condition's
// `conditionChange` timeline entry in the same transaction, after it (so it
// uploads after it), with the id the service derives for the same save
// (`conditionChangeId` of the condition and its new `updated_at`): the two
// are one row. Deleting writes none.
//
// Who diagnosed it (`diagnosed_by_id`) and who manages it (`condition_manager`
// links, slice 3) are written in the same transaction, after any provider
// added from the pickers (so they upload first). Unlinking a manager first
// stamps the link's `updated_at` with the save's time, then deletes it: the
// server reads that stamp (a DELETE carries no data), so every link of one
// save lands in the save's one change entry.

export type ConditionRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  name: string | null;
  status: string | null;
  since_year: number | null;
  since_month: number | null;
  note: string | null;
  diagnosed_by_id: string | null;
  deleted_at: string | null;
};

export type LocalCondition = ConditionLike & {
  groupId: string;
  recipientId: string;
  /** Who diagnosed it: a provider in the group (perhaps deleted since), or null. */
  diagnosedById: string | null;
};

/** The recipient's id and "No known conditions". */
export type ConditionStatusRow = { id: string; no_known_conditions_at: string | null };

const isStatus = (value: string | null): value is ConditionStatus =>
  (CONDITION_STATUSES as readonly (string | null)[]).includes(value);

const intOrNull = (value: unknown) => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
};

/** A local row as a condition, or null for a half-synced or deleted one. */
export const toCondition = (row: ConditionRow): LocalCondition | null => {
  if (!row.group_id || !row.name || row.deleted_at) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id ?? "",
    name: row.name,
    status: isStatus(row.status) ? row.status : "active",
    sinceYear: intOrNull(row.since_year),
    sinceMonth: intOrNull(row.since_month),
    note: row.note || null,
    diagnosedById: row.diagnosed_by_id || null,
  };
};

export const toConditions = (rows: readonly ConditionRow[]) =>
  rows.map(toCondition).filter((c): c is LocalCondition => c !== null);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The group's live conditions (screens order them: `sortConditions`). */
export const conditionsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT * FROM recipient_condition
        WHERE group_id = ? AND deleted_at IS NULL
        ORDER BY name COLLATE NOCASE, id`,
  params: [groupId],
});

/** One condition in the group, deleted or not (`toCondition` drops a deleted one). */
export const conditionQuery = (groupId: string, conditionId: string): LocalQuery => ({
  sql: "SELECT * FROM recipient_condition WHERE group_id = ? AND id = ?",
  params: [groupId, conditionId],
});

/** The group's recipient: its id and "No known conditions". */
export const conditionStatusQuery = (groupId: string): LocalQuery => ({
  sql: "SELECT id, no_known_conditions_at FROM care_recipient WHERE group_id = ?",
  params: [groupId],
});

/** The names the group already uses (live conditions, active or resolved), for the name field's suggestions. */
export const conditionNamesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT DISTINCT name FROM recipient_condition
        WHERE group_id = ? AND deleted_at IS NULL AND name IS NOT NULL
        ORDER BY name COLLATE NOCASE`,
  params: [groupId],
});

export type ConditionRows = { conditionRows: ConditionRow[]; statusRows: ConditionStatusRow[] };

/** A loader's first read, so the card renders complete before the live queries take over. */
export async function loadConditions(db: SyncDb, groupId: string): Promise<ConditionRows> {
  const [conditionRows, statusRows] = await Promise.all([
    readRows<ConditionRow>(db, conditionsQuery(groupId)),
    readRows<ConditionStatusRow>(db, conditionStatusQuery(groupId)),
  ]);
  return { conditionRows, statusRows };
}

/** The group's conditions and their state, live (other members' changes, offline edits). */
export function useConditions(
  groupId: string,
  initial: ConditionRows,
): { conditions: LocalCondition[]; state: ConditionState<LocalCondition> } {
  const c = conditionsQuery(groupId);
  const conditionRows = useLiveQuery<ConditionRow>(c.sql, c.params, initial.conditionRows);
  const s = conditionStatusQuery(groupId);
  const statusRows = useLiveQuery<ConditionStatusRow>(s.sql, s.params, initial.statusRows);
  return useMemo(() => {
    const conditions = toConditions(conditionRows);
    return {
      conditions,
      state: conditionState(conditions, statusRows[0]?.no_known_conditions_at ?? null),
    };
  }, [conditionRows, statusRows]);
}

/** A loader's read of one condition: its row, or none. */
export const loadConditionRows = (db: SyncDb, groupId: string, conditionId: string) =>
  readRows<ConditionRow>(db, conditionQuery(groupId, conditionId));

/** One condition, live: null once it's deleted (here or on another device). */
export function useCondition(
  groupId: string,
  conditionId: string,
  initial: ConditionRow[],
): LocalCondition | null {
  const q = useMemo(() => conditionQuery(groupId, conditionId), [groupId, conditionId]);
  const rows = useLiveQuery<ConditionRow>(q.sql, q.params, initial);
  const row = rows[0];
  return useMemo(() => (row ? toCondition(row) : null), [row]);
}

/** A loader's read of the group's names. */
export const loadConditionNames = (db: SyncDb, groupId: string) =>
  readRows<{ name: string }>(db, conditionNamesQuery(groupId));

/** The group's names, live. */
export function useConditionNames(groupId: string, initial: { name: string }[]): string[] {
  const q = useMemo(() => conditionNamesQuery(groupId), [groupId]);
  const rows = useLiveQuery<{ name: string }>(q.sql, q.params, initial);
  return useMemo(() => rows.map((r) => r.name), [rows]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type ConditionWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });
const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): Refusal =>
  refuse(
    "Check the condition and try again",
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );
const conditionMissing = refuse("That condition is gone. It may have been deleted.");
export const HAS_CONDITIONS_MESSAGE = "Remove the conditions on file before recording No known conditions.";

const canWrite = async (db: SyncDb, groupId: string) => {
  const group = await groupFor(db, groupId);
  return !!group?.role && WRITER_ROLES.includes(group.role);
};

const recipientOf = async (db: SyncDb, groupId: string) => {
  const [row] = await readRows<ConditionStatusRow>(db, conditionStatusQuery(groupId));
  return row ?? null;
};

const liveCondition = async (db: SyncDb, id: string) => {
  const [row] = await readRows<ConditionRow>(db, {
    sql: "SELECT * FROM recipient_condition WHERE id = ?",
    params: [id],
  });
  return row ? toCondition(row) : null;
};

/** The recipient's time zone: a change entry's. */
const recipientZone = async (db: SyncDb, groupId: string) => {
  const [row] = await readRows<{ time_zone: string | null }>(db, {
    sql: "SELECT time_zone FROM care_recipient WHERE group_id = ?",
    params: [groupId],
  });
  return row?.time_zone || "UTC";
};

type ChangeSource = Parameters<typeof conditionChange>[1];

/**
 * The timeline row for what a save did, or null when it records nothing.
 * `now` is the condition's new `updated_at`: the entry's time, and with the
 * condition's id, its id.
 */
const changeEntryRow = (
  db: SyncDb,
  condition: { id: string; groupId: string; recipientId: string },
  before: ChangeSource | null,
  after: ChangeSource,
  now: string,
  timeZone: string,
) => {
  const change = conditionChange(before, after);
  if (!change) return null;
  return {
    id: conditionChangeId(condition.id, now),
    groupId: condition.groupId,
    recipientId: condition.recipientId,
    kind: "conditionChange",
    occurredAt: now,
    timeZone,
    title: null,
    body: null,
    details: JSON.stringify({ conditionId: condition.id, ...change }),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  };
};

// --- Who diagnosed it and who manages it -------------------------------------

/** Providers to add with a save, by name (the pickers' "Add "<typed>" as a provider"), and who manages it. */
export type ConditionProviders = {
  /** Who manages it, exactly; left out keeps the current managers. */
  managerIds?: readonly string[];
  /** A new clinician who diagnosed it. */
  newDiagnosedBy?: string;
  /** New clinicians who manage it (beside `managerIds`). */
  newManagers?: readonly string[];
};

export const BAD_CONDITION_PROVIDER_MESSAGE = "Choose a provider in this care group";
const PROVIDER_GONE_MESSAGE = "That provider is gone. It may have been deleted.";
const providerRefusal = (path: string, message: string) => refuse(message, [{ path, message }]);

type ProviderRowToAdd = Exclude<Awaited<ReturnType<typeof newProviderRow>>, Refusal>;
type LocalProviderRef = ConditionProviderRef & { groupId: string | null; deletedAt: string | null };

/** Providers on this device by id (deleted ones too: a change records names). */
const providerRefs = async (db: SyncDb, ids: readonly string[]) => {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, LocalProviderRef>();
  const rows = await readRows<{
    id: string;
    group_id: string | null;
    name: string | null;
    deleted_at: string | null;
  }>(db, {
    sql: `SELECT id, group_id, name, deleted_at FROM provider WHERE id IN (${unique.map(() => "?").join(", ")})`,
    params: unique,
  });
  return new Map(
    rows.map((r) => [r.id, { id: r.id, name: r.name ?? "", groupId: r.group_id, deletedAt: r.deleted_at }]),
  );
};

/** The live providers chosen for `path` must be in the group (see recipientConditionService's checkProvider). */
const checkChosen = (
  known: Map<string, LocalProviderRef>,
  groupId: string,
  ids: readonly string[],
  path: string,
): Refusal | null => {
  for (const id of ids) {
    const p = known.get(id);
    if (!p || p.groupId !== groupId) return providerRefusal(path, BAD_CONDITION_PROVIDER_MESSAGE);
    if (p.deletedAt) return providerRefusal(path, PROVIDER_GONE_MESSAGE);
  }
  return null;
};

/** The new providers' rows (clinicians), validated; or the refusal, on its field. */
const newProviderRows = async (db: SyncDb, groupId: string, chosen: ConditionProviders) => {
  const rows: ProviderRowToAdd[] = [];
  const add = async (name: string, path: string) => {
    const row = await newProviderRow(db, groupId, { type: "clinician", name });
    if ("ok" in row) {
      if (!row.issues.length) return row;
      return providerRefusal(path, row.issues[0]?.message ?? "Check the provider's name");
    }
    rows.push(row);
    return row.id;
  };
  let diagnosedById: string | undefined;
  if (chosen.newDiagnosedBy?.trim()) {
    const id = await add(chosen.newDiagnosedBy, "diagnosedById");
    if (typeof id !== "string") return id;
    diagnosedById = id;
  }
  const managerIds: string[] = [];
  for (const name of chosen.newManagers ?? []) {
    if (!name.trim()) continue;
    const id = await add(name, "managedBy");
    if (typeof id !== "string") return id;
    managerIds.push(id);
  }
  return { rows, diagnosedById, managerIds };
};

/** A condition's manager links on this device. */
const currentManagers = (db: SyncDb, conditionId: string) =>
  readRows<{ id: string; provider_id: string }>(db, {
    sql: "SELECT id, provider_id FROM condition_manager WHERE condition_id = ?",
    params: [conditionId],
  });

const refsOf = (known: Map<string, ConditionProviderRef>, ids: readonly string[]) =>
  ids.map((id) => known.get(id) ?? { id, name: "" });

/**
 * What a save asks of the providers: the new rows, who diagnosed it, and
 * the managers before and after, checked. A provider chosen anew must be a
 * live one in the group; one already on the condition may be deleted since.
 */
const planProviders = async (
  db: SyncDb,
  groupId: string,
  conditionId: string | null,
  diagnosed: { before: string | null; after: string | null },
  chosen: ConditionProviders,
) => {
  const added = await newProviderRows(db, groupId, chosen);
  if ("ok" in added) return added;
  const diagnosedById = added.diagnosedById ?? diagnosed.after;
  const links = conditionId ? await currentManagers(db, conditionId) : [];
  const before = links.map((l) => l.provider_id);
  const wanted = [...new Set([...(chosen.managerIds ?? before), ...added.managerIds])];
  const newIds = new Set<string>(added.rows.map((r) => r.id));

  const known = await providerRefs(
    db,
    [...before, ...wanted, diagnosed.before, diagnosedById].filter((v): v is string => !!v),
  );
  for (const row of added.rows) known.set(row.id, { id: row.id, name: row.name, groupId, deletedAt: null });
  const diagnosedRefusal =
    diagnosedById && diagnosedById !== diagnosed.before && !newIds.has(diagnosedById)
      ? checkChosen(known, groupId, [diagnosedById], "diagnosedById")
      : null;
  if (diagnosedRefusal) return diagnosedRefusal;
  const linking = wanted.filter((id) => !before.includes(id));
  const managersRefusal = checkChosen(
    known,
    groupId,
    linking.filter((id) => !newIds.has(id)),
    "managedBy",
  );
  if (managersRefusal) return managersRefusal;

  const ref = (id: string | null) => (id ? (known.get(id) ?? { id, name: "" }) : null);
  return {
    rows: added.rows,
    diagnosedById: diagnosedById ?? null,
    unlink: links.filter((l) => !wanted.includes(l.provider_id)).map((l) => l.id),
    link: linking,
    source: {
      before: { diagnosedBy: ref(diagnosed.before), managedBy: refsOf(known, before) },
      after: { diagnosedBy: ref(diagnosedById ?? null), managedBy: refsOf(known, wanted) },
    } satisfies Record<string, Pick<ConditionChangeSource, "diagnosedBy" | "managedBy">>,
  };
};

type ProviderPlan = Exclude<Awaited<ReturnType<typeof planProviders>>, Refusal>;
type WriteTx = Parameters<Parameters<SyncDb["drizzle"]["transaction"]>[0]>[0];

/** Write a plan's links: each unlink stamped with the save's time, then deleted; each link inserted. */
const writeManagerLinks = async (
  db: SyncDb,
  tx: WriteTx,
  condition: { id: string; groupId: string },
  plan: ProviderPlan,
  now: string,
) => {
  if (plan.unlink.length) {
    await tx
      .update(conditionManagers)
      .set({ updatedAt: now, updatedBy: db.userId })
      .where(inArray(conditionManagers.id, plan.unlink));
    await tx.delete(conditionManagers).where(inArray(conditionManagers.id, plan.unlink));
  }
  for (const providerId of plan.link)
    await tx.insert(conditionManagers).values({
      id: conditionManagerId(condition.id, providerId),
      groupId: condition.groupId,
      conditionId: condition.id,
      providerId,
      createdAt: now,
      updatedAt: now,
      createdBy: db.userId,
      updatedBy: db.userId,
    });
};

/**
 * Add a condition (writers), with its "added" entry, who diagnosed it and
 * who manages it. Clears "No known conditions" in the same transaction.
 */
export const addCondition = async (
  db: SyncDb,
  groupId: string,
  input: RecipientConditionContentInput,
  chosen: ConditionProviders = {},
): Promise<ConditionWriteResult> => {
  if (!(await canWrite(db, groupId))) return forbidden as Refusal;
  const recipient = await recipientOf(db, groupId);
  if (!recipient) return refuse("This care group has no care recipient yet");
  const parsed = recipientConditionContentZSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const id = crypto.randomUUID();
  const plan = await planProviders(
    db,
    groupId,
    null,
    { before: null, after: parsed.data.diagnosedById },
    chosen,
  );
  if ("ok" in plan) return plan;
  const content = { ...parsed.data, diagnosedById: plan.diagnosedById };
  const now = nowTimestamp();
  const entry = changeEntryRow(
    db,
    { id, groupId, recipientId: recipient.id },
    null,
    { ...content, ...plan.source.after },
    now,
    await recipientZone(db, groupId),
  );
  await db.drizzle.transaction(async (tx) => {
    if (plan.rows.length) await tx.insert(providerTable).values(plan.rows);
    await tx.insert(recipientConditions).values({
      id,
      groupId,
      recipientId: recipient.id,
      ...content,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: db.userId,
      updatedBy: db.userId,
    });
    if (recipient.no_known_conditions_at)
      await tx
        .update(careRecipients)
        .set({ noKnownConditionsAt: null })
        .where(and(eq(careRecipients.id, recipient.id), isNotNull(careRecipients.noKnownConditionsAt)));
    await writeManagerLinks(db, tx, { id, groupId }, plan, now);
    if (entry) await tx.insert(timelineEntries).values(entry);
  });
  return { ok: true, id };
};

export type ConditionPatch = {
  name?: string;
  status?: ConditionStatus;
  sinceYear?: number | null;
  sinceMonth?: number | null;
  note?: string | null;
  diagnosedById?: string | null;
};

/**
 * Change a condition (writers): what's left out keeps its value; the merged
 * condition must be valid. Only the columns that changed are written, so an
 * edit that changes nothing queues nothing. Who manages it changes only
 * when `chosen` says. What changed is recorded on the timeline in the same
 * transaction.
 */
export const updateCondition = async (
  db: SyncDb,
  id: string,
  patch: ConditionPatch,
  chosen: ConditionProviders = {},
): Promise<ConditionWriteResult> => {
  const existing = await liveCondition(db, id);
  if (!existing) return conditionMissing;
  if (!(await canWrite(db, existing.groupId))) return forbidden as Refusal;
  const checked = recipientConditionUpdateZSchema.safeParse(patch);
  if (!checked.success) return invalid(checked.error);
  const defined = Object.fromEntries(Object.entries(checked.data).filter(([, v]) => v !== undefined));
  const merged = recipientConditionContentZSchema.safeParse({ ...existing, ...defined });
  if (!merged.success) return invalid(merged.error);

  const plan = await planProviders(
    db,
    existing.groupId,
    id,
    { before: existing.diagnosedById, after: merged.data.diagnosedById },
    chosen,
  );
  if ("ok" in plan) return plan;
  const content = { ...merged.data, diagnosedById: plan.diagnosedById };
  const changed = Object.fromEntries(
    Object.entries(content).filter(([key, value]) => existing[key as keyof LocalCondition] !== value),
  );
  if (!Object.keys(changed).length && !plan.link.length && !plan.unlink.length) return { ok: true, id };
  const now = nowTimestamp();
  const entry = changeEntryRow(
    db,
    existing,
    { ...existing, ...plan.source.before },
    { ...content, ...plan.source.after },
    now,
    await recipientZone(db, existing.groupId),
  );
  await db.drizzle.transaction(async (tx) => {
    if (plan.rows.length) await tx.insert(providerTable).values(plan.rows);
    if (Object.keys(changed).length)
      await tx
        .update(recipientConditions)
        .set({ ...changed, updatedAt: now, updatedBy: db.userId })
        .where(eq(recipientConditions.id, id));
    await writeManagerLinks(db, tx, existing, plan, now);
    if (entry) await tx.insert(timelineEntries).values(entry);
  });
  return { ok: true, id };
};

/** Mark a condition resolved: it moves to Past (writers). */
export const resolveCondition = (db: SyncDb, id: string) => updateCondition(db, id, { status: "resolved" });

/** Mark a resolved condition active again (writers). */
export const reactivateCondition = (db: SyncDb, id: string) => updateCondition(db, id, { status: "active" });

/** Soft delete (writers), for a mistake. A condition already gone is fine. */
export const removeCondition = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await liveCondition(db, id);
  if (!existing) return { ok: true };
  if (!(await canWrite(db, existing.groupId))) return forbidden;
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    await tx
      .update(recipientConditions)
      .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
      .where(eq(recipientConditions.id, id));
  });
  return { ok: true };
};

/**
 * Record "No known conditions" (`on`) or clear it (writers). Recording it
 * while conditions are on file is refused: remove them first.
 */
export const setNoKnownConditions = async (
  db: SyncDb,
  groupId: string,
  on: boolean,
): Promise<ActionResult> => {
  if (!(await canWrite(db, groupId))) return forbidden;
  const recipient = await recipientOf(db, groupId);
  if (!recipient) return refuse("This care group has no care recipient yet");
  if (on === !!recipient.no_known_conditions_at) return { ok: true };
  if (on) {
    const [live] = await readRows<ConditionRow>(db, conditionsQuery(groupId));
    if (live) return refuse(HAS_CONDITIONS_MESSAGE);
  }
  await db.drizzle
    .update(careRecipients)
    .set({ noKnownConditionsAt: on ? nowTimestamp() : null })
    .where(eq(careRecipients.id, recipient.id));
  return { ok: true };
};
