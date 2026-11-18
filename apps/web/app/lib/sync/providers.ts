import type {
  ProviderContent,
  ProviderContentInput,
  ProviderPhone,
  ProviderStatus,
  ProviderType,
  ProviderUpdateInput,
} from "@caretook/data/schema";
import type { ActionResult } from "../api";
import type { SyncDb } from "./index";
import type { LocalQuery } from "./timeline";

import {
  canLinkProviders,
  entryProviderId,
  isPracticeType,
  leavesPracticeTypes,
  parseProviderPhones,
  PRACTICE_HAS_PROVIDERS_MESSAGE,
  PRACTICE_IN_USE_ISSUE,
  PROVIDER_STATUSES,
  PROVIDER_TYPES,
  providerContentZSchema,
  providerUpdateZSchema,
} from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { noteDocuments, providers, timelineEntryProviders } from "./schema";
import { forbidden, fromLocalTimestamp, groupFor, nowTimestamp, readRows, WRITER_ROLES } from "./timeline";

// The provider directory and entry links on this device: local queries for
// `useLiveQuery` and loaders, and local writes that validate with the shared
// Zod schemas and check the role, like timeline.ts. Writes queue for upload
// (sync.upload), where providerService and entryProviderService check them
// again.

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type ProviderRow = {
  id: string;
  group_id: string | null;
  type: string | null;
  name: string | null;
  specialty: string | null;
  practice_id: string | null;
  phones: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  status: string | null;
  is_primary: number | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type LocalProvider = {
  id: string;
  groupId: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  phones: ProviderPhone[];
  email: string | null;
  address: string | null;
  website: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  /** ISO 8601, or null. Deleted providers only reach screens through links. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

const isProviderType = (value: string | null): value is ProviderType =>
  (PROVIDER_TYPES as readonly (string | null)[]).includes(value);

/** A local row as a provider, or null for one this build can't show (a newer type, a half-synced row). */
export const toProvider = (row: ProviderRow): LocalProvider | null => {
  if (!isProviderType(row.type) || !row.group_id || !row.name) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    type: row.type,
    name: row.name,
    specialty: row.specialty,
    practiceId: row.practice_id,
    phones: parseProviderPhones(row.phones),
    email: row.email,
    address: row.address,
    website: row.website,
    status: (PROVIDER_STATUSES as readonly (string | null)[]).includes(row.status)
      ? (row.status as ProviderStatus)
      : "current",
    isPrimary: !!row.is_primary,
    deletedAt: row.deleted_at ? fromLocalTimestamp(row.deleted_at) : null,
    createdAt: row.created_at ? fromLocalTimestamp(row.created_at) : "",
    updatedAt: row.updated_at ? fromLocalTimestamp(row.updated_at) : "",
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by ?? "",
  };
};

export const toProviders = (rows: ProviderRow[]) =>
  rows.map(toProvider).filter((p): p is LocalProvider => p !== null);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The display order: primary first, then current, then past, each by name. */
const DISPLAY_ORDER = `is_primary DESC, status = 'past', name COLLATE NOCASE, id`;

/** A group's providers in display order. Deleted ones are left out unless asked for. */
export const providersQuery = (groupId: string, opts: { includeDeleted?: boolean } = {}): LocalQuery => ({
  sql: `SELECT * FROM provider WHERE group_id = ? ${opts.includeDeleted ? "" : "AND deleted_at IS NULL"}
        ORDER BY ${DISPLAY_ORDER}`,
  params: [groupId],
});

/** One provider, deleted or not (screens decide: a deleted one's page is a 404). */
export const providerQuery = (id: string): LocalQuery => ({
  sql: "SELECT * FROM provider WHERE id = ?",
  params: [id],
});

/**
 * An entry's providers, in the order they were linked. Deleted providers are
 * included, so the entry can show their name greyed.
 */
export const entryProvidersQuery = (entryId: string): LocalQuery => ({
  sql: `SELECT p.* FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id
        WHERE l.entry_id = ? ORDER BY l.created_at, l.id`,
  params: [entryId],
});

/** The ids of a provider's linked events and notes (not deleted), newest first. */
export const providerEntriesQuery = (providerId: string): LocalQuery => ({
  sql: `SELECT e.* FROM timeline_entry_provider l JOIN timeline_entry e ON e.id = l.entry_id
        WHERE l.provider_id = ? AND e.deleted_at IS NULL
        ORDER BY e.occurred_at DESC, e.id DESC`,
  params: [providerId],
});

export type LinkHistoryRow = {
  provider_id: string;
  entry_id: string;
  title: string | null;
  occurred_at: string | null;
  linked_at: string | null;
};

/** Enough recent links to rank suggestions from; older ones would weigh almost nothing. */
const RECENT_LINKS = 500;

/**
 * The group's recent links with their entry's title and time, newest first,
 * for suggestions ("who was linked to an entry with this title", "who was
 * linked recently"). Deleted entries and providers are left out.
 */
export const linkHistoryQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT l.provider_id, l.entry_id, e.title, e.occurred_at, l.created_at AS linked_at
        FROM timeline_entry_provider l
        JOIN timeline_entry e ON e.id = l.entry_id
        JOIN provider p ON p.id = l.provider_id
        WHERE l.group_id = ? AND e.deleted_at IS NULL AND p.deleted_at IS NULL
        ORDER BY l.created_at DESC
        LIMIT ${RECENT_LINKS}`,
  params: [groupId],
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type ProviderWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });

const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): Refusal =>
  refuse(
    "The provider is invalid",
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );

const providerMissing = refuse("That provider is gone. They may have been deleted.");
const entryMissing = refuse("That entry is gone. It may have been deleted.");
const badPractice = refuse("The practice must be a practice or pharmacy in this care group", [
  { path: "practiceId", message: "Choose a practice or pharmacy in this care group" },
]);

/**
 * A practice or pharmacy can't stop being one while live providers name it
 * as their practice (the server refuses it too, as providerService:practiceInUse).
 * `dependents` is how many live providers in the group point at it.
 */
export const practiceInUseRefusal = (from: ProviderType, to: ProviderType, dependents: number) =>
  leavesPracticeTypes(from, to) && dependents > 0
    ? refuse("Clinicians are linked to this practice. Move them to another practice first.", [
        { ...PRACTICE_IN_USE_ISSUE },
      ])
    : null;

/**
 * A practice or pharmacy can't be deleted while live providers name it as
 * their practice (the server refuses it too, as providerService:practiceHasProviders).
 */
export const practiceHasProvidersRefusal = (dependents: number) =>
  dependents > 0 ? refuse(PRACTICE_HAS_PROVIDERS_MESSAGE) : null;

/** What the delete dialog says instead of letting you delete it, or null when it can go. */
export const deleteBlockedNote = (type: ProviderType, dependents: number) =>
  isPracticeType(type) && dependents > 0
    ? `${dependents} ${dependents === 1 ? "provider is" : "providers are"} linked to this ${type}. Move them to another practice, or delete them, first.`
    : null;

/** How many live providers in the group name this one as their practice. */
export const practiceDependentsQuery = (groupId: string, practiceId: string): LocalQuery => ({
  sql: `SELECT COUNT(*) AS n FROM provider WHERE group_id = ? AND practice_id = ? AND deleted_at IS NULL`,
  params: [groupId, practiceId],
});

const canWrite = async (db: SyncDb, groupId: string) => {
  const group = await groupFor(db, groupId);
  return !!group?.role && WRITER_ROLES.includes(group.role);
};

const liveProvider = async (db: SyncDb, id: string) => {
  const [row] = await readRows<ProviderRow>(db, providerQuery(id));
  const provider = row ? toProvider(row) : null;
  return provider && !provider.deletedAt ? provider : null;
};

/** The practice must be a live practice or pharmacy in the group, and not the provider itself. */
const practiceOk = async (db: SyncDb, groupId: string, id: string, practiceId: string | null) => {
  if (!practiceId) return true;
  if (practiceId === id) return false;
  const practice = await liveProvider(db, practiceId);
  return !!practice && practice.groupId === groupId && isPracticeType(practice.type);
};

const contentColumns = (content: ProviderContent) => ({
  type: content.type,
  name: content.name,
  specialty: content.specialty,
  practiceId: content.practiceId,
  phones: JSON.stringify(content.phones),
  email: content.email,
  address: content.address,
  website: content.website,
  status: content.status,
  isPrimary: content.isPrimary ? 1 : 0,
});

/** A provider's row, validated: shared by `createProvider` and `createAndLinkProvider`. */
const newProviderRow = async (db: SyncDb, groupId: string, input: ProviderContentInput) => {
  if (!(await canWrite(db, groupId))) return forbidden as Refusal;
  const parsed = providerContentZSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const id = crypto.randomUUID();
  if (!(await practiceOk(db, groupId, id, parsed.data.practiceId))) return badPractice;
  const now = nowTimestamp();
  return {
    id,
    groupId,
    ...contentColumns(parsed.data),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  };
};

/** Add a provider on this device. It syncs when the device is online. */
export const createProvider = async (
  db: SyncDb,
  groupId: string,
  input: ProviderContentInput,
): Promise<ProviderWriteResult> => {
  const row = await newProviderRow(db, groupId, input);
  if ("ok" in row) return row;
  await db.drizzle.insert(providers).values(row);
  return { ok: true, id: row.id };
};

/** Edit a provider. The group is fixed; the merged provider must be valid. */
export const updateProvider = async (
  db: SyncDb,
  id: string,
  patch: ProviderUpdateInput,
): Promise<ProviderWriteResult> => {
  const existing = await liveProvider(db, id);
  if (!existing) return providerMissing;
  if (!(await canWrite(db, existing.groupId))) return forbidden as Refusal;

  const shape = providerUpdateZSchema.safeParse(patch);
  if (!shape.success) return invalid(shape.error);
  const defined = Object.fromEntries(Object.entries(shape.data).filter(([, v]) => v !== undefined));
  const merged = providerContentZSchema.safeParse({
    type: existing.type,
    name: existing.name,
    specialty: existing.specialty,
    practiceId: existing.practiceId,
    phones: existing.phones,
    email: existing.email,
    address: existing.address,
    website: existing.website,
    status: existing.status,
    isPrimary: existing.isPrimary,
    ...defined,
  });
  if (!merged.success) return invalid(merged.error);
  if (leavesPracticeTypes(existing.type, merged.data.type)) {
    const [count] = await readRows<{ n: number }>(db, practiceDependentsQuery(existing.groupId, id));
    const inUse = practiceInUseRefusal(existing.type, merged.data.type, count?.n ?? 0);
    if (inUse) return inUse;
  }
  if (
    merged.data.practiceId !== existing.practiceId &&
    !(await practiceOk(db, existing.groupId, id, merged.data.practiceId))
  ) {
    return badPractice;
  }

  await db.drizzle
    .update(providers)
    .set({ ...contentColumns(merged.data), updatedAt: nowTimestamp(), updatedBy: db.userId })
    .where(eq(providers.id, id));
  return { ok: true, id };
};

/**
 * Soft delete, so the deletion syncs and linked entries keep the name. A
 * practice that live providers name is refused here, not left for the upload
 * to reject (which would bring it back on the next sync with no reason given).
 */
export const removeProvider = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await liveProvider(db, id);
  if (!existing) return { ok: true };
  if (!(await canWrite(db, existing.groupId))) return forbidden;
  const [count] = await readRows<{ n: number }>(db, practiceDependentsQuery(existing.groupId, id));
  const inUse = practiceHasProvidersRefusal(count?.n ?? 0);
  if (inUse) return inUse;
  const now = nowTimestamp();
  await db.drizzle
    .update(providers)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(providers.id, id));
  return { ok: true };
};

type EntryRow = { id: string; group_id: string | null; kind: string | null };

/** A live note or event, or the refusal. */
const linkableEntry = async (db: SyncDb, entryId: string) => {
  const [entry] = await readRows<EntryRow>(db, {
    sql: "SELECT id, group_id, kind FROM timeline_entry WHERE id = ? AND deleted_at IS NULL",
    params: [entryId],
  });
  if (!entry?.group_id) return entryMissing;
  if (!canLinkProviders(entry.kind ?? "")) return refuse("Only notes and events can be linked to providers");
  return { id: entry.id, groupId: entry.group_id };
};

const linkRow = (groupId: string, entryId: string, providerId: string, db: SyncDb) => {
  const now = nowTimestamp();
  return {
    id: entryProviderId(entryId, providerId),
    groupId,
    entryId,
    providerId,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  };
};

const isLinked = async (db: SyncDb, id: string) =>
  (
    await readRows<{ id: string }>(db, {
      sql: "SELECT id FROM timeline_entry_provider WHERE id = ?",
      params: [id],
    })
  ).length > 0;

/**
 * Link a provider to an event or note. Idempotent: linking a pair that's
 * already linked changes nothing (the id comes from the pair).
 */
export const linkProvider = async (
  db: SyncDb,
  entryId: string,
  providerId: string,
): Promise<ActionResult> => {
  const entry = await linkableEntry(db, entryId);
  if ("ok" in entry) return entry;
  const provider = await liveProvider(db, providerId);
  if (!provider || provider.groupId !== entry.groupId) return providerMissing;
  if (!(await canWrite(db, entry.groupId))) return forbidden;

  const row = linkRow(entry.groupId, entryId, providerId, db);
  if (await isLinked(db, row.id)) return { ok: true };
  await db.drizzle.insert(timelineEntryProviders).values(row);
  return { ok: true };
};

/** Remove a link (a hard delete, so it uploads as a DELETE). Unlinking what isn't linked is fine. */
export const unlinkProvider = async (
  db: SyncDb,
  entryId: string,
  providerId: string,
): Promise<ActionResult> => {
  const id = entryProviderId(entryId, providerId);
  const [link] = await readRows<{ group_id: string | null }>(db, {
    sql: "SELECT group_id FROM timeline_entry_provider WHERE id = ?",
    params: [id],
  });
  if (!link) return { ok: true };
  if (!link.group_id || !(await canWrite(db, link.group_id))) return forbidden;
  await db.drizzle.delete(timelineEntryProviders).where(eq(timelineEntryProviders.id, id));
  return { ok: true };
};

/**
 * Add a provider and link it to an event or note in one local transaction
 * (the picker's "Add … as a provider"), so the upload queue has the
 * provider's PUT before the link's.
 */
export const createAndLinkProvider = async (
  db: SyncDb,
  entryId: string,
  input: ProviderContentInput,
): Promise<ProviderWriteResult> => {
  const entry = await linkableEntry(db, entryId);
  if ("ok" in entry) return entry;
  const row = await newProviderRow(db, entry.groupId, input);
  if ("ok" in row) return row;
  const link = linkRow(entry.groupId, entryId, row.id, db);
  await db.drizzle.transaction(async (tx) => {
    await tx.insert(providers).values(row);
    await tx.insert(timelineEntryProviders).values(link);
  });
  return { ok: true, id: row.id };
};

/**
 * Give a provider their shared live notes: the provider's document (its id
 * is the provider's). Written on the first real change on their page, as a
 * draft entry's is. Idempotent: a document that's already here (made on
 * another device, or a moment ago) is left alone, and the server merges two
 * devices' creates into one row.
 */
export const createProviderDocument = async (db: SyncDb, providerId: string): Promise<ActionResult> => {
  const provider = await liveProvider(db, providerId);
  if (!provider) return providerMissing;
  if (!(await canWrite(db, provider.groupId))) return forbidden;
  const existing = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM note_document WHERE id = ?",
    params: [providerId],
  });
  if (existing.length) return { ok: true };
  const now = nowTimestamp();
  await db.drizzle.insert(noteDocuments).values({
    id: providerId,
    groupId: provider.groupId,
    subject: "provider",
    entryId: null,
    providerId,
    snapshot: null,
    text: "",
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true };
};
