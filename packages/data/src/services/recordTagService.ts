import type { z } from "zod";
import type { RecordTagLinkInput, TagTarget, Tx } from "../db";
import type { AppError } from "../errors";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { TAG_TARGET_FIELDS, canTagRecord, recordTagId, recordTagLinkZSchema, targetOf } from "../db/schema";
import { isError, newError } from "../errors";
import {
  careGroupMemberModel,
  medicationModel,
  providerModel,
  recordTagModel,
  tagModel,
  timelineEntryModel,
  todoModel,
} from "../models";
import { isSystemUser, rejectError } from "../permissions";

// Which records carry which tags (tags PRD). Write through here: this is
// where both ends are checked (a tag and a live record, both in the link's
// group) and the tagging rule applied (`canTagRecord`: writers on any
// record, an Easy helper only on a timeline entry they created, read from
// the database, whoever added the tag). Tagging never borrows the record's
// update permission: viewers may tick todos, never tag them.
//
// A link's id is derived from its tag and record (`recordTagId`), so linking
// is idempotent everywhere: a replay, or two devices tagging one record.

export const serviceName = "recordTag";
export const schemaName = recordTagModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "recordTagService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

type TargetRow = { groupId: string; createdBy: string };

/** A target's row by id, as the actor or the system; `includeDeleted` for an unlink's rule. */
const readTarget = (
  target: TagTarget,
  id: string,
  args: { authUser: ServiceContext["authUser"]; tx: Tx; includeDeleted?: boolean },
): Promise<AppError | TargetRow | null> => {
  switch (target) {
    case "entry":
      return timelineEntryModel.getById(id, args);
    case "todo":
      return todoModel.getById(id, args);
    case "provider":
      return providerModel.getById(id, args);
    case "medication":
      return medicationModel.getById(id, args);
  }
};

/**
 * A live record the actor can see, or the right refusal: `unauthorized` when
 * it's in a group they can't see, `recordNotFound` when it doesn't exist or
 * is deleted.
 */
const visibleRecord = async (ctx: ServiceContext, tx: Tx, target: TagTarget, id: string) => {
  const row = await readTarget(target, id, { ...ctx, tx });
  if (isError(row) || row) return row;
  const any = await readTarget(target, id, system(tx));
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : newError({ code: "recordTagService:recordNotFound" });
};

/** The same for a tag. */
const visibleTag = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const tag = await tagModel.getById(id, { ...ctx, tx });
  if (isError(tag) || tag) return tag;
  const any = await tagModel.getById(id, system(tx));
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : newError({ code: "recordTagService:tagNotFound" });
};

/** Null when the actor may tag the record, else the refusal. */
const mayTag = async (ctx: ServiceContext, tx: Tx, groupId: string, target: TagTarget, record: TargetRow) => {
  if (!ctx.authUser) return rejectError(null);
  if (isSystemUser(ctx.authUser)) return null;
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  return canTagRecord(role, { target, createdBy: record.createdBy }, ctx.authUser.id)
    ? null
    : rejectError(ctx.authUser);
};

// ---------------------------------------------------------------------------
// Reads (link rows; a reader joins live records)
// ---------------------------------------------------------------------------

/** A group's links, oldest first. */
export const listForGroup = (ctx: ServiceContext, groupId: string) =>
  recordTagModel.list({
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId } },
    orderBy: [
      { field: "createdAt", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
  });

/** A record's links, oldest first. */
export const listForRecord = (ctx: ServiceContext, target: TagTarget, recordId: string) =>
  recordTagModel.list({
    ...ctx,
    filter: { [TAG_TARGET_FIELDS[target]]: { type: "eq", value: recordId } },
    orderBy: [
      { field: "createdAt", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
  });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Put a tag on a record: exactly one target, live, in `groupId` with the
 * tag. Tagging a record that already carries the tag returns the link.
 */
export const link = (ctx: ServiceContext, input: RecordTagLinkInput) =>
  withTransaction(async (tx) => {
    const parsed = recordTagLinkZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { groupId, tagId } = parsed.data;
    const { target, recordId } = targetOf(parsed.data)!;
    const id = recordTagId(tagId, recordId);

    const tag = await visibleTag(ctx, tx, tagId);
    if (isError(tag)) return tag;
    const record = await visibleRecord(ctx, tx, target, recordId);
    if (isError(record)) return record;
    if (tag.groupId !== groupId || record.groupId !== groupId)
      return newError({ code: "recordTagService:immutable" });

    const refused = await mayTag(ctx, tx, groupId, target, record);
    if (refused) return refused;

    const existing = await recordTagModel.getById(id, { ...ctx, tx });
    if (isError(existing) || existing) return existing;

    return recordTagModel.create({
      ...ctx,
      tx,
      data: { id, groupId, tagId, [TAG_TARGET_FIELDS[target]]: recordId },
    });
  }, ctx);

/**
 * Take a tag off a record (a hard delete), under the same rule as `link`
 * on the link's record, whoever put the tag there. Removing a link that's
 * already gone is fine (a replay); one the actor can see but may not remove
 * is refused.
 */
export const unlink = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const row = await recordTagModel.getById(id, { ...ctx, tx });
    if (isError(row)) return row;
    if (!row) {
      const any = await recordTagModel.getById(id, system(tx));
      if (isError(any)) return any;
      return any ? rejectError(ctx.authUser) : { ids: [] as string[] };
    }

    const found = targetOf(row);
    if (!found) return newError({ code: "recordTagService:invalid" });
    const record = await readTarget(found.target, found.recordId, { ...system(tx), includeDeleted: true });
    if (isError(record)) return record;
    if (!record) return newError({ code: "recordTagService:recordNotFound" });
    const refused = await mayTag(ctx, tx, row.groupId, found.target, record);
    if (refused) return refused;

    return recordTagModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
  }, ctx);

/** `unlink` by the tag and the record. */
export const unlinkPair = (ctx: ServiceContext, tagId: string, recordId: string) =>
  unlink(ctx, recordTagId(tagId, recordId));
