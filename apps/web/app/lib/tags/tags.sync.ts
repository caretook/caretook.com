import type { TagTarget } from "@caretook/data/schema";
import type { ActionResult, CreateResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import {
  TAG_TARGET_COLUMNS,
  TAG_TARGET_FIELDS,
  canCreateTag,
  canTagRecord,
  nextTagId,
  recordTagId,
  tagKey,
  tagNameZSchema,
} from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { recordTags, tags } from "../sync/schema";
import { forbidden, groupFor, nowTimestamp, readRows } from "../timeline/timeline.sync";

// A group's tags on this device (tags PRD): the shared list (`tag`) and which
// records carry them (`record_tag`). Writes queue for upload, where
// tagService and recordTagService check them again. Ids are derived
// (`nextTagId`, `recordTagId`), never random, so two devices adding the same
// tag to one record offline converge on one tag and one link.
//
// Soft-deleting a record keeps its links; every read here joins live
// records only. One live query per list, never one per row.

/** A record's table and its `record_tag` column, by target. */
const TARGET_TABLES = {
  entry: "timeline_entry",
  todo: "todo",
  provider: "provider",
  medication: "medication",
} as const satisfies Record<TagTarget, string>;

export type TagRow = { id: string; group_id: string; name: string; name_key: string; created_by: string };

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The group's tags, A to Z. */
export const tagsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT id, group_id, name, name_key, created_by FROM tag WHERE group_id = ? ORDER BY name_key, id`,
  params: [groupId],
});

/** A live record's tags, A to Z (none when the record is deleted or missing). */
export const recordTagsQuery = (target: TagTarget, recordId: string): LocalQuery => {
  const column = TAG_TARGET_COLUMNS[target];
  return {
    sql: `SELECT t.id, t.group_id, t.name, t.name_key, t.created_by FROM record_tag l
          JOIN tag t ON t.id = l.tag_id AND t.group_id = l.group_id
          JOIN ${TARGET_TABLES[target]} r ON r.id = l.${column} AND r.group_id = l.group_id
          WHERE l.${column} = ? AND r.deleted_at IS NULL
          ORDER BY t.name_key, t.id`,
    params: [recordId],
  };
};

export type GroupTagRow = { record_id: string; id: string; name: string; name_key: string };

/** Every live record's tags of one type in the group, for a list (sort or group by `record_id`). */
export const groupRecordTagsQuery = (groupId: string, target: TagTarget): LocalQuery => {
  const column = TAG_TARGET_COLUMNS[target];
  return {
    sql: `SELECT l.${column} AS record_id, t.id, t.name, t.name_key FROM record_tag l
          JOIN tag t ON t.id = l.tag_id AND t.group_id = l.group_id
          JOIN ${TARGET_TABLES[target]} r ON r.id = l.${column} AND r.group_id = l.group_id
          WHERE l.group_id = ? AND r.deleted_at IS NULL
          ORDER BY t.name_key, t.id`,
    params: [groupId],
  };
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
const refuse = (error: string): Refusal => ({ ok: false, error, issues: [] });
const recordMissing = refuse("That record is gone. It may have been deleted.");
const tagMissing = refuse("That tag is gone. It may have been deleted.");
const notAllowed = forbidden as Refusal;

/** A live record's group and creator, or null. */
const liveRecord = async (db: SyncDb, target: TagTarget, id: string) => {
  const [row] = await readRows<{ group_id: string | null; created_by: string | null }>(db, {
    sql: `SELECT group_id, created_by FROM ${TARGET_TABLES[target]} WHERE id = ? AND deleted_at IS NULL`,
    params: [id],
  });
  return row?.group_id ? { groupId: row.group_id, createdBy: row.created_by } : null;
};

const mayTag = async (db: SyncDb, groupId: string, target: TagTarget, createdBy: string | null) =>
  canTagRecord((await groupFor(db, groupId))?.role, { target, createdBy }, db.userId);

/**
 * Add a tag to the group's list (anyone who may log). A name the group
 * already has, in any case or spacing, returns that tag; a new one takes the
 * next free counter among every tag on the device (`nextTagId`), so a name
 * freed by a rename is used again under a new id.
 */
export const createTag = async (db: SyncDb, groupId: string, name: string): Promise<CreateResult> => {
  const parsed = tagNameZSchema.safeParse(name);
  if (!parsed.success)
    return {
      ok: false,
      error: "The tag is invalid",
      issues: parsed.error.issues.map(({ message }) => ({ path: "name", message })),
    };
  if (!canCreateTag((await groupFor(db, groupId))?.role)) return notAllowed;

  const known = await readRows<{ id: string; name_key: string | null }>(db, {
    sql: "SELECT id, name_key FROM tag WHERE group_id = ?",
    params: [groupId],
  });
  const key = tagKey(parsed.data);
  const same = known.find((t) => t.name_key === key);
  if (same) return { ok: true, id: same.id };

  const id = nextTagId(groupId, key, new Set(known.map((t) => t.id)));
  if (!id) return refuse("This group has too many tags with that name.");
  const now = nowTimestamp();
  await db.drizzle.insert(tags).values({
    id,
    groupId,
    name: parsed.data,
    nameKey: key,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true, id };
};

/** The row a link inserts (also for writers that tag inside their own transaction). */
export const recordTagRow = (
  db: SyncDb,
  groupId: string,
  tagId: string,
  target: TagTarget,
  recordId: string,
) => {
  const now = nowTimestamp();
  return {
    id: recordTagId(tagId, recordId),
    groupId,
    tagId,
    entryId: null,
    todoId: null,
    providerId: null,
    medicationId: null,
    [TAG_TARGET_FIELDS[target]]: recordId,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  };
};

/**
 * Put a tag on a record (`canTagRecord`: writers any, an Easy helper their
 * own entries). Both must be live, in one group. Idempotent: tagging a
 * record that has the tag changes nothing.
 */
export const tagRecord = async (
  db: SyncDb,
  tagId: string,
  target: TagTarget,
  recordId: string,
): Promise<ActionResult> => {
  const record = await liveRecord(db, target, recordId);
  if (!record) return recordMissing;
  const [tag] = await readRows<{ group_id: string | null }>(db, {
    sql: "SELECT group_id FROM tag WHERE id = ?",
    params: [tagId],
  });
  if (tag?.group_id !== record.groupId) return tagMissing;
  if (!(await mayTag(db, record.groupId, target, record.createdBy))) return forbidden;

  const row = recordTagRow(db, record.groupId, tagId, target, recordId);
  const [linked] = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM record_tag WHERE id = ?",
    params: [row.id],
  });
  if (!linked) await db.drizzle.insert(recordTags).values(row);
  return { ok: true };
};

/** Take a tag off a record (the same rule; a hard delete, so it uploads as a DELETE). Untagging what isn't tagged is fine. */
export const untagRecord = async (
  db: SyncDb,
  tagId: string,
  target: TagTarget,
  recordId: string,
): Promise<ActionResult> => {
  const id = recordTagId(tagId, recordId);
  const [link] = await readRows<{ group_id: string | null }>(db, {
    sql: "SELECT group_id FROM record_tag WHERE id = ?",
    params: [id],
  });
  if (!link) return { ok: true };
  const [record] = await readRows<{ created_by: string | null }>(db, {
    sql: `SELECT created_by FROM ${TARGET_TABLES[target]} WHERE id = ?`,
    params: [recordId],
  });
  if (!link.group_id || !(await mayTag(db, link.group_id, target, record?.created_by ?? null)))
    return forbidden;
  await db.drizzle.delete(recordTags).where(eq(recordTags.id, id));
  return { ok: true };
};
