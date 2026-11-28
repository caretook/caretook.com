import type { MedicationPassContentInput, PassLike } from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { LocalMedication, MedicationRow, RecipientRow } from "./medications.sync";
import type { LocalQuery } from "../timeline/timeline.sync";

import {
  canAddPass,
  medicationPassContentZSchema,
  medicationsInPass,
  medicationUpdateZSchema,
  nextSortOrder,
  PASS_NAME_TAKEN_ISSUE,
  passMoved,
  passMovedId,
  passNameTaken,
  PASS_REWRITE_METADATA,
  scheduleHasPass,
  sortPasses,
  TOO_MANY_PASSES_MESSAGE,
  withoutPass,
} from "@caretook/data/schema";
import { eq, sql } from "drizzle-orm";
import { useMemo } from "react";
import { useLiveQuery } from "../sync/index";
import { recipientQuery, toMedications } from "./medications.sync";
import { medicationPasses, medications, timelineEntries } from "../sync/schema";
import {
  forbidden,
  fromLocalTimestamp,
  groupFor,
  nowTimestamp,
  readRows,
  WRITER_ROLES,
} from "../timeline/timeline.sync";

// The group's medication passes (Morning, Evening…) on this device: local
// queries for `useLiveQuery` and loaders, and local writes that check the
// role and the pass rules (medicationPass.ts), like medications.ts. Each
// write is one local transaction, uploaded in order, where
// medicationPassService repeats it idempotently:
// - a retime writes its `passMoved` timeline entry (same id as the server's);
// - a delete turns the pass into a time of its own in every schedule naming
//   it (no change entries), each rewrite flagged (`PASS_REWRITE_METADATA`) so
//   the server keeps its own rewrite over this device's possibly stale copy.

export type PassRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  name: string | null;
  time: string | null;
  sort_order: number | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type LocalPass = PassLike & {
  groupId: string;
  recipientId: string;
  /** ISO 8601, or null. A deleted pass still gives schedules naming it their time. */
  deletedAt: string | null;
};

/** A local row as a pass, or null for a half-synced one. */
export const toPass = (row: PassRow): LocalPass | null => {
  if (!row.group_id || !row.name || !row.time) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id ?? "",
    name: row.name,
    time: row.time,
    sortOrder: row.sort_order ?? 0,
    deletedAt: row.deleted_at ? fromLocalTimestamp(row.deleted_at) : null,
  };
};

/** Rows as passes in the day's order (`sortPasses`). */
export const toPasses = (rows: PassRow[]) =>
  sortPasses(rows.map(toPass).filter((p): p is LocalPass => p !== null));

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** A group's passes, live ones unless `includeDeleted` (schedules naming a deleted pass need its time). */
export const passesQuery = (groupId: string, { includeDeleted = false } = {}): LocalQuery => ({
  sql: `SELECT * FROM medication_pass
        WHERE group_id = ? ${includeDeleted ? "" : "AND deleted_at IS NULL"}
        ORDER BY time, name COLLATE NOCASE, id`,
  params: [groupId],
});

/** One pass, deleted or not. */
export const passQuery = (id: string): LocalQuery => ({
  sql: "SELECT * FROM medication_pass WHERE id = ?",
  params: [id],
});

/** The group's live medications, any status: whose schedules a pass's change touches. */
export const groupMedicationsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT * FROM medication WHERE group_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE, id`,
  params: [groupId],
});

/** Each pass with the current medications in it (by name), for the Passes screen. */
export const passesWithMedications = (passes: readonly LocalPass[], meds: readonly LocalMedication[]) =>
  passes.map((pass) => ({ pass, medications: medicationsInPass(meds, pass.id) }));

const NO_PASS_ROWS: PassRow[] = [];

/** A loader's read of the group's passes (deleted ones too), for `useSchedulePasses`. */
export const loadSchedulePasses = (db: SyncDb, groupId: string) =>
  readRows<PassRow>(db, passesQuery(groupId, { includeDeleted: true }));

/**
 * The group's passes as schedules need them, live: deleted ones too (a
 * schedule naming one still reads its name and time), in the day's order.
 * `initial` is a loader's `loadSchedulePasses`.
 */
export function useSchedulePasses(groupId: string, initial: PassRow[] = NO_PASS_ROWS) {
  const query = passesQuery(groupId, { includeDeleted: true });
  const rows = useLiveQuery<PassRow>(query.sql, query.params, initial);
  return useMemo(() => toPasses(rows), [rows]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type PassWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });
const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): Refusal =>
  refuse(
    "The med time is invalid",
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );
const nameTaken = refuse(PASS_NAME_TAKEN_ISSUE.message, [{ ...PASS_NAME_TAKEN_ISSUE }]);
const passMissing = refuse("That med time is gone. It may have been deleted.");

const canWrite = async (db: SyncDb, groupId: string) => {
  const group = await groupFor(db, groupId);
  return !!group?.role && WRITER_ROLES.includes(group.role);
};

const groupPasses = async (db: SyncDb, groupId: string) =>
  toPasses(await readRows<PassRow>(db, passesQuery(groupId)));

const livePass = async (db: SyncDb, id: string) => {
  const [row] = await readRows<PassRow>(db, passQuery(id));
  const pass = row ? toPass(row) : null;
  return pass && !pass.deletedAt ? pass : null;
};

/** Add a pass (a name and a time) at the end of the list. Writers only; the name must be free. */
export const createPass = async (
  db: SyncDb,
  groupId: string,
  input: Pick<MedicationPassContentInput, "name" | "time">,
): Promise<PassWriteResult> => {
  if (!(await canWrite(db, groupId))) return forbidden as Refusal;
  const [recipient] = await readRows<RecipientRow>(db, recipientQuery(groupId));
  if (!recipient) return refuse("This care group has no care recipient yet");
  const passes = await groupPasses(db, groupId);
  const parsed = medicationPassContentZSchema.safeParse({ ...input, sortOrder: nextSortOrder(passes) });
  if (!parsed.success) return invalid(parsed.error);
  if (passNameTaken(passes, parsed.data.name)) return nameTaken;
  if (!canAddPass(passes)) return refuse(TOO_MANY_PASSES_MESSAGE);

  const id = crypto.randomUUID();
  const now = nowTimestamp();
  await db.drizzle.insert(medicationPasses).values({
    id,
    groupId,
    recipientId: recipient.id,
    ...parsed.data,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true, id };
};

/**
 * Rename or retime a pass. A new time moves every medication in it (they
 * name the pass) and writes one `passMoved` entry on the timeline, in the
 * same transaction, with the id the server derives for the same save.
 */
export const updatePass = async (
  db: SyncDb,
  id: string,
  patch: Partial<Pick<MedicationPassContentInput, "name" | "time">>,
): Promise<PassWriteResult> => {
  const existing = await livePass(db, id);
  if (!existing) return passMissing;
  if (!(await canWrite(db, existing.groupId))) return forbidden as Refusal;
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const merged = medicationPassContentZSchema.safeParse({ ...existing, ...defined });
  if (!merged.success) return invalid(merged.error);
  const passes = await groupPasses(db, existing.groupId);
  if (passNameTaken(passes, merged.data.name, id)) return nameTaken;

  const now = nowTimestamp();
  const meds = toMedications(await readRows<MedicationRow>(db, groupMedicationsQuery(existing.groupId)));
  const moved = passMoved(
    existing,
    { ...merged.data, id },
    medicationsInPass(meds, id).map((m) => m.id),
  );
  const [recipient] = moved ? await readRows<RecipientRow>(db, recipientQuery(existing.groupId)) : [];
  await db.drizzle.transaction(async (tx) => {
    await tx
      .update(medicationPasses)
      .set({ name: merged.data.name, time: merged.data.time, updatedAt: now, updatedBy: db.userId })
      .where(eq(medicationPasses.id, id));
    if (moved)
      await tx.insert(timelineEntries).values({
        id: passMovedId(id, now),
        groupId: existing.groupId,
        recipientId: existing.recipientId,
        kind: "medicationChange",
        occurredAt: now,
        timeZone: recipient?.time_zone ?? "UTC",
        title: null,
        body: null,
        details: JSON.stringify(moved),
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        createdBy: db.userId,
        updatedBy: db.userId,
      });
  });
  return { ok: true, id };
};

/**
 * Soft delete a pass. Every live medication in it keeps the pass's time as a
 * time of its own (its amount kept), in the same transaction, with no change
 * entries: the pass's deletion is the change. The rewrites keep screens right
 * until sync; their uploads are flagged, and the server drops their schedule
 * (its delete rewrites the schedules it holds, B-1006).
 */
export const removePass = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await livePass(db, id);
  if (!existing) return { ok: true };
  if (!(await canWrite(db, existing.groupId))) return forbidden;
  const meds = toMedications(await readRows<MedicationRow>(db, groupMedicationsQuery(existing.groupId)));
  const rewrites = meds
    .filter((m) => scheduleHasPass(m.schedule, id))
    .map((m) => ({ id: m.id, schedule: withoutPass(m.schedule, existing) }))
    // The same check the medication's own save runs.
    .filter((m) => medicationUpdateZSchema.safeParse({ schedule: m.schedule }).success);
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    await tx
      .update(medicationPasses)
      .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
      .where(eq(medicationPasses.id, id));
    // `_metadata` is PowerSync's, outside the Drizzle table (as a todo's flags).
    for (const m of rewrites)
      await tx.run(
        sql`UPDATE ${medications} SET schedule = ${JSON.stringify(m.schedule)}, updated_at = ${now},
              updated_by = ${db.userId}, _metadata = ${PASS_REWRITE_METADATA} WHERE id = ${m.id}`,
      );
  });
  return { ok: true };
};
