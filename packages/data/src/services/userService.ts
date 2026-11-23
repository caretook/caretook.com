import type { UserPreferences } from "../db/schema";
import type { ServiceContext, ServiceInsert, ServiceSelectArgs, ServiceUpdateArgs } from "./types";

import { eq } from "drizzle-orm";
import { DEFAULT_PAGE_SIZE } from "../constants";
import { dbMayFail, withTransaction } from "../db";
import { mergeSetupDismissed, userSchema } from "../db/schema";
import { isError } from "../errors";
import { userModel } from "../models";

export const serviceName = "user";
export const schemaName = userModel.schemaName;

type K = typeof schemaName;

const page = (opts: ServiceSelectArgs<K>) => ({
  ...opts,
  paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
});

// Reads return a co-member's public profile (id, name, image) or a whole row
// (yourself, staff, the system). The `…Whole` reads refuse a partial row.
export const get = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  userModel.get({ ...ctx, ...opts });
export const getById = (ctx: ServiceContext, id: string) => userModel.getById(id, ctx);
export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  userModel.list({ ...ctx, ...page(opts) });

export const getWhole = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  userModel.getWhole({ ...ctx, ...opts });
export const getWholeById = (ctx: ServiceContext, id: string) => userModel.getWholeById(id, ctx);
export const listWhole = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  userModel.listWhole({ ...ctx, ...page(opts) });

export const create = (ctx: ServiceContext, data: ServiceInsert<K>) => userModel.create({ ...ctx, data });
export const update = (ctx: ServiceContext, opts: ServiceUpdateArgs<K>) =>
  userModel.update({ ...ctx, ...opts });
export const upsert = (ctx: ServiceContext, data: ServiceInsert<K>) => userModel.upsert({ ...ctx, data });
export const remove = (ctx: ServiceContext, opts: ServiceSelectArgs<K>) =>
  userModel.remove({ ...ctx, ...opts });

export const getByEmail = (ctx: ServiceContext, email: string) => userModel.getByEmail(email, ctx);

/**
 * Change your own settings; fields left out keep their value. The row stays
 * locked from read to write, so two saves at once both count. Null when the
 * account is gone.
 */
export const updateOwnPreferences = async (ctx: ServiceContext, change: UserPreferences) => {
  const id = ctx.authUser?.id;
  if (!id) return null;
  return withTransaction(
    async (tx) => {
      const locked = await dbMayFail(
        () => tx.select({ id: userSchema.id }).from(userSchema).where(eq(userSchema.id, id)).for("update"),
        "db:transaction",
      );
      if (isError(locked)) return locked;
      if (!locked[0]) return null;

      const txCtx = { ...ctx, tx };
      const user = await userModel.getWholeById(id, txCtx);
      if (isError(user)) return user;
      if (!user) return null;
      const preferences: UserPreferences = {
        ...user.preferences,
        ...change,
        units: { ...user.preferences.units, ...change.units },
        // Added to, never replaced: another device may have dismissed a different group.
        ...(change.setupDismissed && {
          setupDismissed: mergeSetupDismissed(user.preferences.setupDismissed, change.setupDismissed),
        }),
      };
      const updated = await userModel.update({
        ...txCtx,
        filter: { id: { type: "eq", value: id } },
        data: { preferences },
      });
      return isError(updated) ? updated : preferences;
    },
    { tx: ctx.tx },
  );
};
