import type { z } from "zod";
import type { TagCreateInput, Tx } from "../db";
import type { ServiceContext } from "./types";

import { sql } from "drizzle-orm";
import { SYSTEM_USER } from "../constants";
import { dbMayFail, withTransaction } from "../db";
import {
  canCreateTag,
  nextTagId,
  pickTagColor,
  tagColorZSchema,
  tagCreateZSchema,
  tagKey,
  tagNameZSchema,
  tagRow,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, tagModel } from "../models";
import { isSystemUser, rejectError } from "../permissions";

// A care group's shared tag list (tags PRD). Write through here: the key is
// derived from the name (`tagKey`) and the id from the group, the key and a
// counter (`tagId`), so a device's offline create, its replay and another
// device's create of the same name land on one tag. A rename keeps the id
// (links stay put) and derives the new key; a recolor is rename's update
// of the same row; a delete is hard, and the links cascade while the
// records stay.

export const serviceName = "tag";
export const schemaName = tagModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "tagService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

const notFound = () => newError({ code: "tagService:notFound" });

/** Creates and renames in one group wait for each other, so a name check holds until commit. */
const lockGroup = (tx: Tx, groupId: string) =>
  dbMayFail(
    () => tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`tag:${groupId}`}, 0))`),
    "baseModel:update",
    { schemaName },
  );

/** Nothing written: `unauthorized` when the tag exists (in a group the actor may not change), else `notFound`. */
const refusedOrGone = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const any = await tagModel.getById(id, system(tx));
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : notFound();
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** A group's tags, A to Z. Any member; nobody else sees a row. */
export const list = (ctx: ServiceContext, { groupId }: { groupId: string }) =>
  tagModel.list({ ...ctx, filter: { groupId: { type: "eq", value: groupId } } });

export const getById = (ctx: ServiceContext, id: string) => tagModel.getById(id, ctx);

/** The group's tag for `name` (any case or spacing), or null. */
export const getByName = (ctx: ServiceContext, groupId: string, name: string) =>
  tagModel.get({
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId }, nameKey: { type: "eq", value: tagKey(name) } },
  });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add a tag to the group's list. Anyone who may log (`LOGGERS`); a viewer's
 * or Easy viewer's create is refused, even of a tag that exists.
 *
 * Idempotent on the id: a create whose id exists returns that tag, even if
 * it's been renamed since (a replay, or a device that didn't see the
 * rename). A create whose name another tag holds is `tagService:nameTaken`.
 * The id, when given, must be one derived from the group and the name;
 * without one, the next free counter. The color, when given, is kept;
 * without one, a color no group tag has (`pickTagColor`, any once all ten
 * are used). Creates in one group wait for each other (an advisory lock on
 * the group), so two at once never collide or pick one color.
 */
export const create = (ctx: ServiceContext, input: TagCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = tagCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { groupId, name } = parsed.data;

    if (!ctx.authUser) return rejectError(null);
    if (!isSystemUser(ctx.authUser)) {
      const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
      if (isError(role)) return role;
      if (!canCreateTag(role)) return rejectError(ctx.authUser);
    }

    const lock = await lockGroup(tx, groupId);
    if (isError(lock)) return lock;

    let id = parsed.data.id?.toLowerCase();
    let color = parsed.data.color ?? null;
    if (!id || !color) {
      const tags = await tagModel.list({
        ...system(tx),
        filter: { groupId: { type: "eq", value: groupId } },
      });
      if (isError(tags)) return tags;
      color ??= pickTagColor(tags.data.map((t) => t.color));
      id ??= nextTagId(groupId, name, new Set(tags.data.map((t) => t.id))) ?? undefined;
      if (!id) return newError({ code: "tagService:nameTaken" });
    }

    const existing = await tagModel.getById(id, system(tx));
    if (isError(existing)) return existing;
    if (existing) return existing.groupId === groupId ? existing : newError({ code: "tagService:immutable" });

    const holder = await getByName(system(tx), groupId, name);
    if (isError(holder)) return holder;
    if (holder) return newError({ code: "tagService:nameTaken", meta: { tagId: holder.id } });

    return tagModel.create({ ...ctx, tx, data: tagRow(id, groupId, name, color) });
  }, ctx);

/**
 * Rename a tag: every record that carries it shows the new name. Owners,
 * admins and caretakers rename any tag, an Easy helper only one they created
 * (`groupOwn` on `created_by`, in SQL); anyone else who can see it is
 * `permissions:unauthorized`. The key is derived from the name, never taken
 * from a caller. A name another tag holds is `tagService:nameTaken` (there's
 * no merge); a new spelling of the tag's own name is fine.
 */
export const rename = (ctx: ServiceContext, id: string, name: string) =>
  withTransaction(async (tx) => {
    const parsed = tagNameZSchema.safeParse(name);
    if (!parsed.success) return invalid(parsed.error);
    if (!ctx.authUser) return rejectError(null);

    const tag = await tagModel.getById(id, { ...ctx, tx });
    if (isError(tag)) return tag;
    if (!tag) return refusedOrGone(ctx, tx, id);

    const lock = await lockGroup(tx, tag.groupId);
    if (isError(lock)) return lock;
    const holder = await getByName(system(tx), tag.groupId, parsed.data);
    if (isError(holder)) return holder;
    if (holder && holder.id !== tag.id)
      return newError({ code: "tagService:nameTaken", meta: { tagId: holder.id } });

    // The key is the system's field; the actor's write of the name comes
    // last, so the SQL decides who may rename (a refusal rolls the key
    // back) and `updated_by` is the actor.
    const filter = { id: { type: "eq" as const, value: tag.id } };
    const keyed = await tagModel.update({ ...system(tx), filter, data: { nameKey: tagKey(parsed.data) } });
    if (isError(keyed)) return keyed;
    const renamed = await tagModel.update({ ...ctx, tx, filter, data: { name: parsed.data } });
    if (isError(renamed))
      return renamed.code === "baseModel:update:nothingUpdated" ? refusedOrGone(ctx, tx, tag.id) : renamed;
    return renamed[0] ?? notFound();
  }, ctx);

/**
 * Recolor a tag: a palette id (`TAG_COLORS`), anything else is
 * `tagService:invalid`. Rename's rule, from the same update scope in SQL:
 * owners, admins and caretakers recolor any tag, an Easy helper only one
 * they created; anyone else who can see it is `permissions:unauthorized`,
 * and a missing tag `tagService:notFound`.
 */
export const recolor = (ctx: ServiceContext, id: string, color: string) =>
  withTransaction(async (tx) => {
    const parsed = tagColorZSchema.safeParse(color);
    if (!parsed.success) return invalid(parsed.error);
    if (!ctx.authUser) return rejectError(null);

    const filter = { id: { type: "eq" as const, value: id.toLowerCase() } };
    const recolored = await tagModel.update({ ...ctx, tx, filter, data: { color: parsed.data } });
    if (isError(recolored))
      return recolored.code === "baseModel:update:nothingUpdated" ? refusedOrGone(ctx, tx, id) : recolored;
    return recolored[0] ?? notFound();
  }, ctx);

/**
 * Delete a tag: it comes off every record (the links cascade) and the
 * records stay. Owners only; anyone else who can see it is
 * `permissions:unauthorized`, and a missing tag `tagService:notFound`.
 */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    if (!ctx.authUser) return rejectError(null);
    const res = await tagModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (!isError(res) || res.code !== "baseModel:remove:nothingRemoved") return res;
    return refusedOrGone(ctx, tx, id);
  }, ctx);
