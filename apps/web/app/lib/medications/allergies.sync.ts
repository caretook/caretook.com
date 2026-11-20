import type { AllergySeverity, RecipientAllergyContentInput } from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { AllergyLike, AllergyState } from "./allergies";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import {
  ALLERGY_SEVERITIES,
  recipientAllergyContentZSchema,
  recipientAllergyUpdateZSchema,
} from "@caretook/data/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { useMemo } from "react";
import { allergyState } from "./allergies";
import { useLiveQuery } from "../sync/index";
import { careRecipients, recipientAllergies } from "../sync/schema";
import { forbidden, groupFor, nowTimestamp, readRows, WRITER_ROLES } from "../timeline/timeline.sync";

// The recipient's allergies on this device: local queries for `useLiveQuery`
// and loaders, and local writes that validate with the shared Zod schemas and
// check the role, like medications.ts. Writes queue for upload
// (sync.upload), where recipientAllergyService checks them again.
//
// "No known allergies" is the recipient's `no_known_allergies_at`: the one
// care_recipient column a device writes. Adding an allergy clears it in the
// same local transaction (the server does the same).

export type AllergyRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  substance: string | null;
  reaction: string | null;
  severity: string | null;
  deleted_at: string | null;
};

export type LocalAllergy = AllergyLike & { groupId: string; recipientId: string };

/** The recipient's id and "No known allergies". */
export type AllergyStatusRow = { id: string; no_known_allergies_at: string | null };

/** A local row as an allergy, or null for a half-synced or deleted one. */
export const toAllergy = (row: AllergyRow): LocalAllergy | null => {
  if (!row.group_id || !row.substance || row.deleted_at) return null;
  const severity = (ALLERGY_SEVERITIES as readonly (string | null)[]).includes(row.severity)
    ? (row.severity as AllergySeverity)
    : "unknown";
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id ?? "",
    substance: row.substance,
    reaction: row.reaction,
    severity,
  };
};

export const toAllergies = (rows: readonly AllergyRow[]) =>
  rows.map(toAllergy).filter((a): a is LocalAllergy => a !== null);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The group's live allergies, by substance. */
export const allergiesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT * FROM recipient_allergy
        WHERE group_id = ? AND deleted_at IS NULL
        ORDER BY substance COLLATE NOCASE, id`,
  params: [groupId],
});

/** The group's recipient: its id and "No known allergies". */
export const allergyStatusQuery = (groupId: string): LocalQuery => ({
  sql: "SELECT id, no_known_allergies_at FROM care_recipient WHERE group_id = ?",
  params: [groupId],
});

export type AllergyRows = { allergyRows: AllergyRow[]; statusRows: AllergyStatusRow[] };

/** A loader's first read, so the region renders complete before the live queries take over. */
export async function loadAllergies(db: SyncDb, groupId: string): Promise<AllergyRows> {
  const [allergyRows, statusRows] = await Promise.all([
    readRows<AllergyRow>(db, allergiesQuery(groupId)),
    readRows<AllergyStatusRow>(db, allergyStatusQuery(groupId)),
  ]);
  return { allergyRows, statusRows };
}

/** The group's allergies and their state, live (other members' changes, offline edits). */
export function useAllergies(
  groupId: string,
  initial: AllergyRows,
): { allergies: LocalAllergy[]; state: AllergyState<LocalAllergy> } {
  const a = allergiesQuery(groupId);
  const allergyRows = useLiveQuery<AllergyRow>(a.sql, a.params, initial.allergyRows);
  const s = allergyStatusQuery(groupId);
  const statusRows = useLiveQuery<AllergyStatusRow>(s.sql, s.params, initial.statusRows);
  return useMemo(() => {
    const allergies = toAllergies(allergyRows);
    return {
      allergies,
      state: allergyState(allergies, statusRows[0]?.no_known_allergies_at ?? null),
    };
  }, [allergyRows, statusRows]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type AllergyWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });
const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): Refusal =>
  refuse(
    "The allergy is invalid",
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );
const allergyMissing = refuse("That allergy is gone. It may have been deleted.");
export const HAS_ALLERGIES_MESSAGE = "Remove the allergies on file before recording No known allergies.";

const canWrite = async (db: SyncDb, groupId: string) => {
  const group = await groupFor(db, groupId);
  return !!group?.role && WRITER_ROLES.includes(group.role);
};

const recipientOf = async (db: SyncDb, groupId: string) => {
  const [row] = await readRows<AllergyStatusRow>(db, allergyStatusQuery(groupId));
  return row ?? null;
};

const liveAllergy = async (db: SyncDb, id: string) => {
  const [row] = await readRows<AllergyRow>(db, {
    sql: "SELECT * FROM recipient_allergy WHERE id = ?",
    params: [id],
  });
  return row ? toAllergy(row) : null;
};

/** Add an allergy (writers). Clears "No known allergies" in the same transaction. */
export const addAllergy = async (
  db: SyncDb,
  groupId: string,
  input: RecipientAllergyContentInput,
): Promise<AllergyWriteResult> => {
  if (!(await canWrite(db, groupId))) return forbidden as Refusal;
  const recipient = await recipientOf(db, groupId);
  if (!recipient) return refuse("This care group has no care recipient yet");
  const parsed = recipientAllergyContentZSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const id = crypto.randomUUID();
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    await tx.insert(recipientAllergies).values({
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
    if (recipient.no_known_allergies_at)
      await tx
        .update(careRecipients)
        .set({ noKnownAllergiesAt: null })
        .where(and(eq(careRecipients.id, recipient.id), isNotNull(careRecipients.noKnownAllergiesAt)));
  });
  return { ok: true, id };
};

/** Change an allergy's substance, reaction or severity (writers). The merged allergy must be valid. */
export const updateAllergy = async (
  db: SyncDb,
  id: string,
  patch: { substance?: string; reaction?: string | null; severity?: AllergySeverity },
): Promise<AllergyWriteResult> => {
  const existing = await liveAllergy(db, id);
  if (!existing) return allergyMissing;
  if (!(await canWrite(db, existing.groupId))) return forbidden as Refusal;
  const checked = recipientAllergyUpdateZSchema.safeParse(patch);
  if (!checked.success) return invalid(checked.error);
  const defined = Object.fromEntries(Object.entries(checked.data).filter(([, v]) => v !== undefined));
  const merged = recipientAllergyContentZSchema.safeParse({ ...existing, ...defined });
  if (!merged.success) return invalid(merged.error);
  await db.drizzle
    .update(recipientAllergies)
    .set({ ...merged.data, updatedAt: nowTimestamp(), updatedBy: db.userId })
    .where(eq(recipientAllergies.id, id));
  return { ok: true, id };
};

/** Soft delete (writers). An allergy already gone is fine. */
export const removeAllergy = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await liveAllergy(db, id);
  if (!existing) return { ok: true };
  if (!(await canWrite(db, existing.groupId))) return forbidden;
  const now = nowTimestamp();
  await db.drizzle
    .update(recipientAllergies)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(recipientAllergies.id, id));
  return { ok: true };
};

/**
 * Record "No known allergies" (`on`) or clear it (writers). Recording it
 * while allergies are on file is refused: remove them first.
 */
export const setNoKnownAllergies = async (
  db: SyncDb,
  groupId: string,
  on: boolean,
): Promise<ActionResult> => {
  if (!(await canWrite(db, groupId))) return forbidden;
  const recipient = await recipientOf(db, groupId);
  if (!recipient) return refuse("This care group has no care recipient yet");
  if (on === !!recipient.no_known_allergies_at) return { ok: true };
  if (on) {
    const [live] = await readRows<AllergyRow>(db, allergiesQuery(groupId));
    if (live) return refuse(HAS_ALLERGIES_MESSAGE);
  }
  await db.drizzle
    .update(careRecipients)
    .set({ noKnownAllergiesAt: on ? nowTimestamp() : null })
    .where(eq(careRecipients.id, recipient.id));
  return { ok: true };
};
