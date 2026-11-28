import type { TagTarget } from "@caretook/data/schema";
import type { ActionResult, CreateResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import {
  TAG_TARGET_COLUMNS,
  TAG_TARGET_FIELDS,
  canCreateTag,
  canDeleteTag,
  canRenameTag,
  canTagRecord,
  nextTagId,
  pickTagColor,
  recordTagId,
  tagColorZSchema,
  tagKey,
  tagNameZSchema,
} from "@caretook/data/schema";
import { and, eq } from "drizzle-orm";
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

/** `color` is a palette id (`TAG_COLORS`), or null or unknown for the neutral chip. */
export type TagRow = {
  id: string;
  group_id: string;
  name: string;
  name_key: string;
  created_by: string;
  color: string | null;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The group's tags, A to Z. */
export const tagsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT id, group_id, name, name_key, created_by, color FROM tag WHERE group_id = ? ORDER BY name_key, id`,
  params: [groupId],
});

/** A live record's tags, A to Z (none when the record is deleted or missing). */
export const recordTagsQuery = (target: TagTarget, recordId: string): LocalQuery => {
  const column = TAG_TARGET_COLUMNS[target];
  return {
    sql: `SELECT t.id, t.group_id, t.name, t.name_key, t.created_by, t.color FROM record_tag l
          JOIN tag t ON t.id = l.tag_id AND t.group_id = l.group_id
          JOIN ${TARGET_TABLES[target]} r ON r.id = l.${column} AND r.group_id = l.group_id
          WHERE l.${column} = ? AND r.deleted_at IS NULL
          ORDER BY t.name_key, t.id`,
    params: [recordId],
  };
};

export type GroupTagRow = {
  record_id: string;
  id: string;
  name: string;
  name_key: string;
  color: string | null;
};

/** Every live record's tags of one type in the group, for a list (sort or group by `record_id`). */
export const groupRecordTagsQuery = (groupId: string, target: TagTarget): LocalQuery => {
  const column = TAG_TARGET_COLUMNS[target];
  return {
    sql: `SELECT l.${column} AS record_id, t.id, t.name, t.name_key, t.color FROM record_tag l
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
 * freed by a rename is used again under a new id, and a color no group tag on
 * the device has (`pickTagColor`), written locally so the server keeps it.
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

  const known = await readRows<{ id: string; name_key: string | null; color: string | null }>(db, {
    sql: "SELECT id, name_key, color FROM tag WHERE group_id = ?",
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
    color: pickTagColor(known.map((t) => t.color)),
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

/** How many live records carry a tag (what Delete's confirmation names). */
export const tagUsesQuery = (tagId: string): LocalQuery => ({
  sql: `SELECT count(*) AS uses FROM record_tag l
        LEFT JOIN timeline_entry e ON e.id = l.entry_id AND e.group_id = l.group_id
        LEFT JOIN todo t ON t.id = l.todo_id AND t.group_id = l.group_id
        LEFT JOIN provider p ON p.id = l.provider_id AND p.group_id = l.group_id
        LEFT JOIN medication m ON m.id = l.medication_id AND m.group_id = l.group_id
        WHERE l.tag_id = ?
          AND COALESCE(e.deleted_at, t.deleted_at, p.deleted_at, m.deleted_at) IS NULL
          AND COALESCE(e.id, t.id, p.id, m.id) IS NOT NULL`,
  params: [tagId],
});

export type TagUseRow = { tag_id: string; uses: number };

/**
 * How many live records carry each of the group's tags, in one query for the
 * Tags page (`tagUsesQuery`'s count, by tag); a tag on none has no row.
 */
export const groupTagUsesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT l.tag_id, count(*) AS uses FROM record_tag l
        LEFT JOIN timeline_entry e ON e.id = l.entry_id AND e.group_id = l.group_id
        LEFT JOIN todo t ON t.id = l.todo_id AND t.group_id = l.group_id
        LEFT JOIN provider p ON p.id = l.provider_id AND p.group_id = l.group_id
        LEFT JOIN medication m ON m.id = l.medication_id AND m.group_id = l.group_id
        WHERE l.group_id = ?
          AND COALESCE(e.deleted_at, t.deleted_at, p.deleted_at, m.deleted_at) IS NULL
          AND COALESCE(e.id, t.id, p.id, m.id) IS NOT NULL
        GROUP BY l.tag_id`,
  params: [groupId],
});

const tagRow = async (db: SyncDb, tagId: string) => {
  const [row] = await readRows<{ group_id: string | null; created_by: string | null }>(db, {
    sql: "SELECT group_id, created_by FROM tag WHERE id = ?",
    params: [tagId],
  });
  return row?.group_id ? { groupId: row.group_id, createdBy: row.created_by } : null;
};

/**
 * Rename a tag (`canRenameTag`: writers any, an Easy helper one they
 * created); every record carrying it shows the new name. A name another tag
 * holds, in any case or spacing, is refused (`mergeTags` joins two). The key is
 * the device's copy: the server derives its own.
 */
export const renameTag = async (db: SyncDb, tagId: string, name: string): Promise<ActionResult> => {
  const parsed = tagNameZSchema.safeParse(name);
  if (!parsed.success)
    return {
      ok: false,
      error: "The tag is invalid",
      issues: parsed.error.issues.map(({ message }) => ({ path: "name", message })),
    };
  const tag = await tagRow(db, tagId);
  if (!tag) return tagMissing;
  if (!canRenameTag((await groupFor(db, tag.groupId))?.role, tag, db.userId)) return notAllowed;

  const key = tagKey(parsed.data);
  const [holder] = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM tag WHERE group_id = ? AND name_key = ? AND id != ?",
    params: [tag.groupId, key, tagId],
  });
  if (holder) return refuse("The group already has a tag with that name.");
  await db.drizzle
    .update(tags)
    .set({ name: parsed.data, nameKey: key, updatedAt: nowTimestamp(), updatedBy: db.userId })
    .where(and(eq(tags.id, tagId), eq(tags.groupId, tag.groupId)));
  return { ok: true };
};

/**
 * Recolor a tag (rename's rule, `canRenameTag`): a palette id
 * (`TAG_COLORS`); every record carrying it shows the new color.
 */
export const recolorTag = async (db: SyncDb, tagId: string, color: string): Promise<ActionResult> => {
  const parsed = tagColorZSchema.safeParse(color);
  if (!parsed.success) return refuse("Choose one of the tag colors.");
  const tag = await tagRow(db, tagId);
  if (!tag) return tagMissing;
  if (!canRenameTag((await groupFor(db, tag.groupId))?.role, tag, db.userId)) return notAllowed;
  await db.drizzle
    .update(tags)
    .set({ color: parsed.data, updatedAt: nowTimestamp(), updatedBy: db.userId })
    .where(and(eq(tags.id, tagId), eq(tags.groupId, tag.groupId)));
  return { ok: true };
};

/**
 * Delete a tag (owners only): its links and the tag go in one local
 * transaction, so it comes off every record at once; the records stay.
 */
export const deleteTag = async (db: SyncDb, tagId: string): Promise<ActionResult> => {
  const tag = await tagRow(db, tagId);
  if (!tag) return { ok: true };
  if (!canDeleteTag((await groupFor(db, tag.groupId))?.role)) return notAllowed;
  await db.drizzle.transaction(async (tx) => {
    await tx.delete(recordTags).where(eq(recordTags.tagId, tagId));
    await tx.delete(tags).where(eq(tags.id, tagId));
  });
  return { ok: true };
};

type FromLink = {
  entry_id: string | null;
  todo_id: string | null;
  provider_id: string | null;
  medication_id: string | null;
};

/**
 * Merge one tag into another (owners only, `canDeleteTag`; both in one
 * group): every live record carrying `from` gets `into` (under its derived
 * link id, so a record that had both keeps one link), then `from` and its
 * links go, all in one local transaction. Uploads are the ordinary
 * `record_tag` PUTs and the `tag` DELETE, so the server checks each again.
 */
export const mergeTags = async (db: SyncDb, fromId: string, intoId: string): Promise<ActionResult> => {
  if (fromId === intoId) return refuse("Choose another tag to merge into.");
  const [from, into] = await Promise.all([tagRow(db, fromId), tagRow(db, intoId)]);
  if (!from || !into || from.groupId !== into.groupId) return tagMissing;
  if (!canDeleteTag((await groupFor(db, from.groupId))?.role)) return notAllowed;

  const links = await readRows<FromLink>(db, {
    sql: `SELECT l.entry_id, l.todo_id, l.provider_id, l.medication_id FROM record_tag l
          LEFT JOIN timeline_entry e ON e.id = l.entry_id AND e.group_id = l.group_id
          LEFT JOIN todo t ON t.id = l.todo_id AND t.group_id = l.group_id
          LEFT JOIN provider p ON p.id = l.provider_id AND p.group_id = l.group_id
          LEFT JOIN medication m ON m.id = l.medication_id AND m.group_id = l.group_id
          WHERE l.tag_id = ? AND l.group_id = ?
            AND COALESCE(e.deleted_at, t.deleted_at, p.deleted_at, m.deleted_at) IS NULL
            AND COALESCE(e.id, t.id, p.id, m.id) IS NOT NULL`,
    params: [fromId, from.groupId],
  });
  const existing = new Set(
    (
      await readRows<{ id: string }>(db, {
        sql: "SELECT id FROM record_tag WHERE tag_id = ?",
        params: [intoId],
      })
    ).map((r) => r.id),
  );
  const rows = links.flatMap((link) =>
    (Object.keys(TARGET_TABLES) as TagTarget[]).flatMap((target) => {
      const recordId = link[TAG_TARGET_COLUMNS[target]];
      if (!recordId || existing.has(recordTagId(intoId, recordId))) return [];
      return [recordTagRow(db, from.groupId, intoId, target, recordId)];
    }),
  );

  await db.drizzle.transaction(async (tx) => {
    if (rows.length) await tx.insert(recordTags).values(rows);
    await tx.delete(recordTags).where(eq(recordTags.tagId, fromId));
    await tx.delete(tags).where(eq(tags.id, fromId));
  });
  return { ok: true };
};
