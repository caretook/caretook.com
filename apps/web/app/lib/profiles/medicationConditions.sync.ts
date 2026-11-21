import type { ActionResult } from "../core/api";
import type { LocalMedication, MedicationRow } from "../medications/medications.sync";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";
import type { ConditionRow, LocalCondition } from "./conditions.sync";

import { medicationConditionId } from "@caretook/data/schema";
import { inArray } from "drizzle-orm";
import { useMemo } from "react";
import { medicationQuery, toMedication, toMedications } from "../medications/medications.sync";
import { useLiveQuery } from "../sync/index";
import { medicationConditions } from "../sync/schema";
import { forbidden, groupFor, nowTimestamp, readRows, WRITER_ROLES } from "../timeline/timeline.sync";
import { toConditions } from "./conditions.sync";

// What a medication is for, on this device (conditions slice 4): the
// medication ↔ condition links (`medication_condition`), read by the
// medication page and form and by a condition's sheet, and written by the
// medication form. Writes queue for upload, where medicationConditionService
// checks them again. A link's id comes from its pair
// (`medicationConditionId`), so the server lands on the same row.
//
// A deleted condition's links stay in place and every read here leaves them
// out (and a deleted medication's).

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The live conditions a medication is for, by name. */
export const medicationConditionsQuery = (medicationId: string): LocalQuery => ({
  sql: `SELECT c.* FROM medication_condition mc
        JOIN recipient_condition c ON c.id = mc.condition_id AND c.group_id = mc.group_id
        WHERE mc.medication_id = ? AND c.deleted_at IS NULL
        ORDER BY c.name COLLATE NOCASE, c.id`,
  params: [medicationId],
});

/** The current, live medications for a condition, by name. */
export const conditionMedicationsQuery = (conditionId: string): LocalQuery => ({
  sql: `SELECT m.* FROM medication_condition mc
        JOIN medication m ON m.id = mc.medication_id AND m.group_id = mc.group_id
        WHERE mc.condition_id = ? AND m.deleted_at IS NULL AND m.status = 'current'
        ORDER BY m.name COLLATE NOCASE, m.id`,
  params: [conditionId],
});

/** A loader's read of a medication's conditions. */
export const loadMedicationConditions = (db: SyncDb, medicationId: string) =>
  readRows<ConditionRow>(db, medicationConditionsQuery(medicationId));

/** A medication's conditions, live (a condition renamed, resolved or deleted anywhere). */
export function useMedicationConditions(medicationId: string, initial: ConditionRow[]): LocalCondition[] {
  const q = useMemo(() => medicationConditionsQuery(medicationId), [medicationId]);
  const rows = useLiveQuery<ConditionRow>(q.sql, q.params, initial);
  return useMemo(() => toConditions(rows), [rows]);
}

/** A loader's read of a condition's current medications. */
export const loadConditionMedications = (db: SyncDb, conditionId: string) =>
  readRows<MedicationRow>(db, conditionMedicationsQuery(conditionId));

/** A condition's current medications, live. */
export function useConditionMedications(conditionId: string, initial: MedicationRow[]): LocalMedication[] {
  const q = useMemo(() => conditionMedicationsQuery(conditionId), [conditionId]);
  const rows = useLiveQuery<MedicationRow>(q.sql, q.params, initial);
  return useMemo(() => toMedications(rows).filter((m) => !m.deletedAt), [rows]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;

/** Where the medication form shows a refusal about its conditions. */
export const CONDITION_IDS_PATH = "conditionIds";

const BAD_CONDITIONS_MESSAGE = "Choose conditions on this care recipient's profile";
const badConditions: Refusal = {
  ok: false,
  error: BAD_CONDITIONS_MESSAGE,
  issues: [{ path: CONDITION_IDS_PATH, message: BAD_CONDITIONS_MESSAGE }],
};
const medicationMissing: Refusal = {
  ok: false,
  error: "That medication is gone. It may have been deleted.",
  issues: [],
};

const unique = (ids: readonly string[]) => [...new Set(ids.filter(Boolean))];

/**
 * Whether every id is a live condition in the group (on this device): what
 * the form checks before it writes the medication, so a refusal leaves
 * nothing half-saved.
 */
export const checkMedicationConditions = async (
  db: SyncDb,
  groupId: string,
  conditionIds: readonly string[],
): Promise<Refusal | null> => {
  const ids = unique(conditionIds);
  if (!ids.length) return null;
  const rows = await readRows<{ id: string }>(db, {
    sql: `SELECT id FROM recipient_condition
          WHERE group_id = ? AND deleted_at IS NULL AND id IN (${ids.map(() => "?").join(", ")})`,
    params: [groupId, ...ids],
  });
  return rows.length === ids.length ? null : badConditions;
};

/**
 * Make a medication's conditions exactly `conditionIds` (writers): link the
 * new ones and unlink the rest, in one local transaction. Each must be a
 * live condition in the medication's group. A deleted condition's link is
 * left alone (nothing shows it). Choosing what's already linked writes
 * nothing.
 */
export const setMedicationConditions = async (
  db: SyncDb,
  medicationId: string,
  conditionIds: readonly string[],
): Promise<ActionResult> => {
  const [row] = await readRows<MedicationRow>(db, medicationQuery(medicationId));
  const medication = row ? toMedication(row) : null;
  if (!medication || medication.deletedAt) return medicationMissing;
  const group = await groupFor(db, medication.groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden;
  const wanted = unique(conditionIds);
  const bad = await checkMedicationConditions(db, medication.groupId, wanted);
  if (bad) return bad;

  const current = await readRows<{ id: string; condition_id: string }>(db, {
    sql: `SELECT mc.id, mc.condition_id FROM medication_condition mc
          JOIN recipient_condition c ON c.id = mc.condition_id
          WHERE mc.medication_id = ? AND c.deleted_at IS NULL`,
    params: [medicationId],
  });
  const have = new Set(current.map((l) => l.condition_id));
  const removed = current.filter((l) => !wanted.includes(l.condition_id)).map((l) => l.id);
  const added = wanted.filter((id) => !have.has(id));
  if (!removed.length && !added.length) return { ok: true };

  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    if (removed.length)
      await tx.delete(medicationConditions).where(inArray(medicationConditions.id, removed));
    for (const conditionId of added)
      await tx.insert(medicationConditions).values({
        id: medicationConditionId(medicationId, conditionId),
        groupId: medication.groupId,
        medicationId,
        conditionId,
        createdAt: now,
        updatedAt: now,
        createdBy: db.userId,
        updatedBy: db.userId,
      });
  });
  return { ok: true };
};
