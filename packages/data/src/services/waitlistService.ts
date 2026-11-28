import type { SpamVerdict, WaitlistFilter, WaitlistJoinInput } from "../db/schema";
import type { WaitlistEntryModel } from "../models";
import type { ServiceContext, ServiceSelectArgs } from "./types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import { spamVerdict, waitlistJoinZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { waitlistEntryModel } from "../models";

export const schemaName = waitlistEntryModel.schemaName;

type K = typeof schemaName;

// The waitlist (marketing slice 4). Anyone may join from the public form;
// staff (global admin) read the list. Joining again with the same address
// (any case) updates the entry, and the answer is the same either way, so the
// form never says who's already on the list.

export type JoinResult =
  { stored: true; entry: WaitlistEntryModel } | { stored: false; verdict: Exclude<SpamVerdict, "ok"> };

/**
 * Join the waitlist from the public form, as the system. A submission that
 * trips a spam rule (the honeypot, or too fast) stores nothing; the caller
 * thanks it all the same.
 */
export const join = async (input: WaitlistJoinInput) => {
  const parsed = waitlistJoinZSchema.safeParse(input);
  if (!parsed.success) {
    return newError({
      code: "publicForms:invalid",
      meta: { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    });
  }
  const { website, elapsedMs, ...fields } = parsed.data;
  const verdict = spamVerdict({ website, elapsedMs });
  if (verdict !== "ok") return { stored: false, verdict } satisfies JoinResult;

  const source = fields.source && Object.values(fields.source).some(Boolean) ? fields.source : null;
  const entry = await waitlistEntryModel.upsertByEmail({
    email: fields.email,
    firstName: fields.firstName ?? null,
    caringFor: fields.caringFor ?? null,
    heardFrom: fields.heardFrom ?? null,
    source,
  });
  if (isError(entry)) return entry;
  return { stored: true, entry } satisfies JoinResult;
};

/** Staff: entries, scoped by the permission map (global admin only). */
export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  waitlistEntryModel.list({
    ...ctx,
    ...opts,
    paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
  });

export const getById = (ctx: ServiceContext, id: string) => waitlistEntryModel.getById(id, ctx);

/** Staff: one page of the entries matching `filter`, newest first, with the matching count. */
export const search = (
  ctx: ServiceContext,
  filter: Partial<WaitlistFilter> = {},
  page: { page?: number; limit?: number } = {},
) =>
  waitlistEntryModel.search({
    ...ctx,
    filter,
    paginate: { page: page.page ?? 1, limit: page.limit ?? DEFAULT_PAGE_SIZE },
  });

/**
 * Staff: every entry matching `filter`, newest first, in one query (for the
 * CSV export, so it holds exactly what the filtered list counted).
 */
export const exportAll = async (ctx: ServiceContext, filter: Partial<WaitlistFilter> = {}) => {
  const res = await waitlistEntryModel.search({ ...ctx, filter });
  return isError(res) ? res : res.data;
};
