import type { z } from "zod";
import type { TagCreateInput, Tx } from "../db";
import type { ServiceContext } from "./types";

import { sql } from "drizzle-orm";
import { SYSTEM_USER } from "../constants";
import { dbMayFail, withTransaction } from "../db";
import { canCreateTag, nextTagId, tagCreateZSchema, tagKey, tagRow } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, tagModel } from "../models";
import { isSystemUser, rejectError } from "../permissions";

// A care group's shared tag list (tags PRD). Write through here: the key is
// derived from the name (`tagKey`) and the id from the group, the key and a
// counter (`tagId`), so a device's offline create, its replay and another
// device's create of the same name land on one tag.
//
// Rename and delete come with slice 3.

export const serviceName = "tag";
export const schemaName = tagModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "tagService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

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
 * without one, the next free counter. Creates in one group wait for each
 * other (an advisory lock on the group), so two at once never collide.
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

    const lock = await dbMayFail(
      () => tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`tag:${groupId}`}, 0))`),
      "baseModel:create",
      { schemaName },
    );
    if (isError(lock)) return lock;

    let id = parsed.data.id?.toLowerCase();
    if (!id) {
      const tags = await tagModel.list({
        ...system(tx),
        filter: { groupId: { type: "eq", value: groupId } },
      });
      if (isError(tags)) return tags;
      id = nextTagId(groupId, name, new Set(tags.data.map((t) => t.id))) ?? undefined;
      if (!id) return newError({ code: "tagService:nameTaken" });
    }

    const existing = await tagModel.getById(id, system(tx));
    if (isError(existing)) return existing;
    if (existing) return existing.groupId === groupId ? existing : newError({ code: "tagService:immutable" });

    const holder = await getByName(system(tx), groupId, name);
    if (isError(holder)) return holder;
    if (holder) return newError({ code: "tagService:nameTaken", meta: { tagId: holder.id } });

    return tagModel.create({ ...ctx, tx, data: tagRow(id, groupId, name) });
  }, ctx);
