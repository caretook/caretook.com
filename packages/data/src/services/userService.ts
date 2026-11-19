import type { ServiceContext, ServiceInsert, ServiceSelectArgs, ServiceUpdateArgs } from "./types";

import { DEFAULT_PAGE_SIZE } from "../constants";
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
