import { z } from "zod";
import { isOwnRowLogger, isLoggerRole, isWriterRole } from "../../../constants/roles";
import { uuidV5 } from "../core/uuidV5";

// The tags' pure rules (tags PRD), client-safe: the one place that folds a
// tag name, derives a tag's or a link's id, says who may tag what, and reads
// and writes `?tag=`. The device and the server both call these, so two
// devices adding "Urgent" offline land on one tag and one link.

/** The namespace for tag ids (a fixed, random UUID; never change it). */
export const TAG_NAMESPACE = "19faa300-620b-4ca1-b150-6e6d3826303c";
/** The namespace for link ids (a fixed, random UUID; never change it). */
export const RECORD_TAG_NAMESPACE = "37bf062e-a4b6-42b1-a4ce-d687ffdcfc7a";

/** The longest name: chips stay short. */
export const TAG_NAME_MAX = 40;

/**
 * How far a tag's counter goes. A counter past 0 only follows a rename that
 * freed a name, so this is never reached in practice; the server checks a
 * device's id against counters below it.
 */
export const TAG_COUNTER_LIMIT = 1000;

/** A name as stored and shown: trimmed, with runs of spaces made one. */
export const tagName = (name: string) => name.trim().replace(/\s+/g, " ");

/** What makes two names one tag: case and spaces only ("urgent" and "Urgent " are one). */
export const tagKey = (name: string) => tagName(name).toLocaleLowerCase("en-US");

/**
 * A tag's id: the version 5 UUID of its group, its key and a counter. The
 * counter is 0 unless that id is already taken (a renamed tag holds it), so
 * a name freed by a rename can be used again. Case-insensitive in the group
 * id; `key` is folded again, so a name works too.
 */
export const tagId = (groupId: string, key: string, counter = 0) =>
  uuidV5(`${groupId.toLowerCase()}:${counter}:${tagKey(key)}`, TAG_NAMESPACE);

/**
 * The id a new tag named `name` takes: the first counter whose id isn't in
 * `taken` (every tag id the device or server knows in the group, renamed
 * ones included). Null past `TAG_COUNTER_LIMIT`.
 */
export const nextTagId = (groupId: string, name: string, taken: ReadonlySet<string>) => {
  for (let counter = 0; counter < TAG_COUNTER_LIMIT; counter++) {
    const id = tagId(groupId, name, counter);
    if (!taken.has(id)) return id;
  }
  return null;
};

/** Whether `id` is one a tag named `name` in `groupId` could have (any counter below the limit). */
export const isTagIdFor = (groupId: string, name: string, id: string) => {
  const wanted = id.toLowerCase();
  for (let counter = 0; counter < TAG_COUNTER_LIMIT; counter++)
    if (tagId(groupId, name, counter) === wanted) return true;
  return false;
};

/** A link's id: the version 5 UUID of its tag and record. Case-insensitive in its inputs. */
export const recordTagId = (tagId: string, recordId: string) =>
  uuidV5(`${tagId.toLowerCase()}:${recordId.toLowerCase()}`, RECORD_TAG_NAMESPACE);

/** A tag's name: trimmed, single spaces, 1 to `TAG_NAME_MAX` characters. */
export const tagNameZSchema = z
  .string()
  .transform(tagName)
  .pipe(
    z
      .string()
      .min(1, { error: "Enter a tag" })
      .max(TAG_NAME_MAX, { error: `Keep a tag to ${TAG_NAME_MAX} characters` }),
  );

// ---------------------------------------------------------------------------
// What can be tagged, and by whom
// ---------------------------------------------------------------------------

/** The record types a tag goes on (conditions, allergies and care periods aren't tagged). */
export const TAG_TARGETS = ["entry", "todo", "provider", "medication"] as const;
export type TagTarget = (typeof TAG_TARGETS)[number];

/** Each target's column on `record_tag`, as Drizzle names it. */
export const TAG_TARGET_FIELDS = {
  entry: "entryId",
  todo: "todoId",
  provider: "providerId",
  medication: "medicationId",
} as const satisfies Record<TagTarget, string>;

/** Each target's column on `record_tag`, as SQL (and the device) names it. */
export const TAG_TARGET_COLUMNS = {
  entry: "entry_id",
  todo: "todo_id",
  provider: "provider_id",
  medication: "medication_id",
} as const satisfies Record<TagTarget, string>;

/** A link's target fields: exactly one is set. */
export type TagTargetIds = {
  entryId?: string | null;
  todoId?: string | null;
  providerId?: string | null;
  medicationId?: string | null;
};

/** The one target a link names, or null when it names none or more than one. */
export const targetOf = (ids: TagTargetIds): { target: TagTarget; recordId: string } | null => {
  const set = TAG_TARGETS.flatMap((target) => {
    const recordId = ids[TAG_TARGET_FIELDS[target]];
    return recordId ? [{ target, recordId }] : [];
  });
  return set.length === 1 ? set[0]! : null;
};

/** Who may add a tag to the group's list: anyone who may log (writers, an Easy helper). */
export const canCreateTag = (role: string | null | undefined) => isLoggerRole(role);

/**
 * Who may put a tag on a record, or take one off: owners, admins and
 * caretakers on any target; an Easy helper only on a timeline entry they
 * created, whoever added the tag. Viewers and Easy viewers never. Tagging
 * never borrows a record's update permission (viewers may tick todos).
 */
export const canTagRecord = (
  role: string | null | undefined,
  record: { target: TagTarget; createdBy: string | null | undefined },
  userId: string | null | undefined,
) => {
  if (isWriterRole(role)) return true;
  return isOwnRowLogger(role) && record.target === "entry" && !!userId && record.createdBy === userId;
};

// ---------------------------------------------------------------------------
// `?tag=`: a list's tag filter, one tag at a time
// ---------------------------------------------------------------------------

export const TAG_PARAM = "tag";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The tag a list filters by, or null (none, or not an id). Whether it still exists is the screen's to check. */
export const tagFromParams = (params: URLSearchParams) => {
  const value = params.get(TAG_PARAM)?.trim() ?? "";
  return UUID.test(value) ? value.toLowerCase() : null;
};

/** `params` with the tag filter set to `tagId`, or cleared (null). A new object; the rest stays. */
export const withTagParam = (params: URLSearchParams, tagId: string | null) => {
  const next = new URLSearchParams(params);
  if (tagId) next.set(TAG_PARAM, tagId);
  else next.delete(TAG_PARAM);
  return next;
};

/** The filter's tag if it's one of the group's `tags`, else null: an unknown or deleted tag is no filter. */
export const activeTag = <T extends { id: string }>(tagId: string | null, tags: readonly T[]) =>
  (tagId && tags.find((t) => t.id.toLowerCase() === tagId)) || null;
