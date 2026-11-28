import type { ServiceContext, ServiceSelectArgs } from "./types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import { careGroupConsentModel } from "../models";

export const schemaName = careGroupConsentModel.schemaName;

type K = typeof schemaName;

// Consent rows are written only by careGroupInviteService.accept (as the
// system). Reads are scoped: a group's owners and admins, and the member themselves.
export const get = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupConsentModel.get({ ...ctx, ...opts });

export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupConsentModel.list({
    ...ctx,
    ...opts,
    paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
  });
