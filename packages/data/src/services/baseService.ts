import type { DbSchemaName } from "../db";
import type { BaseModel } from "../models/base";
import type { ServiceContext, ServiceInsert, ServiceSelectArgs, ServiceUpdateArgs } from "./types";

import { DEFAULT_PAGE_SIZE } from "../constants";

/**
 * Standard service functions on top of a model. Services are where business
 * rules, side effects (notifications, audit entries, jobs) and multi-model
 * transactions go. Permissions are enforced below, in the model layer.
 *
 * Takes the model itself (rather than looking it up by schema name) so the
 * return types flow through without casts.
 */
export const getService = <K extends DbSchemaName, TModel, TRow>(model: BaseModel<K, TModel, TRow>) => ({
  create: (ctx: ServiceContext, data: ServiceInsert<K>) => model.create({ ...ctx, data }),

  get: (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) => model.get({ ...ctx, ...opts }),

  getById: (ctx: ServiceContext, id: string) => model.getById(id, ctx),

  list: (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
    model.list({
      ...ctx,
      ...opts,
      paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
    }),

  remove: (ctx: ServiceContext, opts: ServiceSelectArgs<K>) => model.remove({ ...ctx, ...opts }),

  update: (ctx: ServiceContext, opts: ServiceUpdateArgs<K>) => model.update({ ...ctx, ...opts }),

  upsert: (ctx: ServiceContext, data: ServiceInsert<K>) => model.upsert({ ...ctx, data }),
});
