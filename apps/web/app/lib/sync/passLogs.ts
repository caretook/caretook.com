import type { ActionResult } from "../api";
import type { SyncDb } from "./index";
import type { DosePatch, MedicationWriteResult } from "./medications";
import type { EntryRow, LocalQuery } from "./timeline";

import { timelineEntryContentZSchema } from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { isDoseEntry, logDose, removeDoses, toMedicationEntry } from "./medications";
import { timelineEntries } from "./schema";
import { forbidden, groupFor, nowTimestamp, readRows, toLocalTimestamp, WRITER_ROLES } from "./timeline";

// A pass log on this device: the doses logged in one round (one
// `passLogId`), as the timeline's pass sheet reads and corrects them. Writes
// go through the same dose rules as `medications.ts` (`updateDose`,
// `logDose`, `removeDoses`), and upload like any dose.

type Refusal = Extract<ActionResult, { ok: false }>;

/** A dose in a log, with its medication's name (deleted or not) for the sheet. */
export type PassLogDoseRow = EntryRow & {
  medication_name: string | null;
  medication_strength: string | null;
  medication_deleted_at: string | null;
};

/**
 * One log's doses in a group, earliest first, then by medication. Deleted
 * doses only with `includeDeleted` (the sheet's guard tells a deleted log
 * from a missing one).
 */
export const passLogDosesQuery = (
  groupId: string,
  passLogId: string,
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
): LocalQuery => ({
  sql: `SELECT e.*, m.name AS medication_name, m.strength AS medication_strength,
               m.deleted_at AS medication_deleted_at
        FROM timeline_entry e
        LEFT JOIN medication m ON m.id = json_extract(e.details, '$.medicationId')
        WHERE e.group_id = ? AND e.kind = 'dose' AND json_extract(e.details, '$.passLogId') = ?
          ${includeDeleted ? "" : "AND e.deleted_at IS NULL"}
        ORDER BY e.occurred_at, m.name COLLATE NOCASE, e.id`,
  params: [groupId, passLogId],
});

const canWrite = async (db: SyncDb, groupId: string) => {
  const group = await groupFor(db, groupId);
  return !!group?.role && WRITER_ROLES.includes(group.role);
};

const goneMessage = "That entry is gone. It may have been deleted.";

/**
 * Correct several doses of a log at once (the pass sheet's Save), in one
 * local transaction: every patch is checked first, and nothing is written
 * unless all of them pass. Issues come back under the dose's id
 * (`<id>.details.amount`, `<id>.occurredAt`). A dose's medication is fixed.
 */
export const updateDoses = async (
  db: SyncDb,
  patches: readonly { id: string; patch: DosePatch }[],
): Promise<ActionResult> => {
  const writes: { id: string; occurredAt: string; details: string }[] = [];
  const issues: Refusal["issues"] = [];
  for (const { id, patch } of patches) {
    const [row] = await readRows<EntryRow>(db, {
      sql: "SELECT * FROM timeline_entry WHERE id = ? AND deleted_at IS NULL",
      params: [id],
    });
    const entry = row ? toMedicationEntry(row) : null;
    if (!entry || !isDoseEntry(entry)) return { ok: false, error: goneMessage, issues: [] };
    if (!(await canWrite(db, entry.groupId))) return forbidden;
    const { occurredAt, ...details } = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as DosePatch;
    const parsed = timelineEntryContentZSchema.safeParse({
      kind: "dose",
      occurredAt: occurredAt ?? entry.occurredAt,
      timeZone: entry.timeZone,
      details: { ...entry.details, ...details },
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        issues.push({ path: [id, ...issue.path.map(String)].join("."), message: issue.message });
      continue;
    }
    writes.push({
      id,
      occurredAt: toLocalTimestamp(parsed.data.occurredAt),
      details: JSON.stringify(parsed.data.details),
    });
  }
  if (issues.length) return { ok: false, error: "A dose is invalid", issues };
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    for (const write of writes)
      await tx
        .update(timelineEntries)
        .set({ occurredAt: write.occurredAt, details: write.details, updatedAt: now, updatedBy: db.userId })
        .where(eq(timelineEntries.id, write.id));
  });
  return { ok: true };
};

/** What a dose added to a log takes from it: its round, pass and slot time, and when. */
export type PassLogJoin = {
  passLogId: string;
  passId: string | null;
  scheduledFor: string | null;
  /** When (ISO 8601): the log's earliest dose's time. */
  occurredAt: string;
};

/** Add a forgotten medication to a log: a given dose in the same round. */
export const addToPassLog = (
  db: SyncDb,
  groupId: string,
  log: PassLogJoin,
  { medicationId, amount }: { medicationId: string; amount: string | null },
): Promise<MedicationWriteResult> =>
  logDose(db, groupId, {
    medicationId,
    status: "given",
    amount,
    passLogId: log.passLogId,
    passId: log.passId,
    scheduledFor: log.scheduledFor,
    occurredAt: log.occurredAt,
  });

/** Delete a whole log (soft): every dose in it that's still there, in one transaction. */
export const removePassLog = async (db: SyncDb, groupId: string, passLogId: string) => {
  const rows = await readRows<EntryRow>(db, passLogDosesQuery(groupId, passLogId));
  return removeDoses(
    db,
    rows.map((r) => r.id),
  );
};
