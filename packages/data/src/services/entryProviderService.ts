import type { z } from "zod";
import type { EntryProviderLinkInput, Tx } from "../db";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { canLinkProviders, entryProviderId, entryProviderLinkZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { providerModel, timelineEntryModel, timelineEntryProviderModel } from "../models";
import { rejectError } from "../permissions";

// Links between an event or note and the providers it was with. Write
// through here: this is where both ends are checked (a live note or event,
// a provider that isn't deleted, both in the link's group).
//
// A link's id is derived from its pair (`entryProviderId`), so linking is
// idempotent everywhere: a replay, or two devices linking the same provider.

export const serviceName = "entryProvider";
export const schemaName = timelineEntryProviderModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "entryProviderService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const entryNotFound = () => newError({ code: "entryProviderService:entryNotFound" });
const providerNotFound = () => newError({ code: "entryProviderService:providerNotFound" });

/**
 * A live entry the actor can see, or the right refusal: `unauthorized` when
 * it's in a group they can't see, `entryNotFound` when it doesn't exist or
 * is deleted.
 */
const visibleEntry = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const entry = await timelineEntryModel.getById(id, { ...ctx, tx });
  if (isError(entry) || entry) return entry;
  const any = await timelineEntryModel.getById(id, { authUser: SYSTEM_USER, tx });
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : entryNotFound();
};

/** The same for a provider that isn't deleted. */
const visibleProvider = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const provider = await providerModel.getById(id, { ...ctx, tx });
  if (isError(provider) || provider) return provider;
  const any = await providerModel.getById(id, { authUser: SYSTEM_USER, tx });
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : providerNotFound();
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** An entry's links, oldest first. */
export const listForEntry = (ctx: ServiceContext, entryId: string) =>
  timelineEntryProviderModel.list({
    ...ctx,
    filter: { entryId: { type: "eq", value: entryId } },
    orderBy: [{ field: "createdAt", direction: "asc" }],
  });

/** A provider's links, newest first. */
export const listForProvider = (ctx: ServiceContext, providerId: string) =>
  timelineEntryProviderModel.list({
    ...ctx,
    filter: { providerId: { type: "eq", value: providerId } },
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Link a provider to an event or note. Writers only. The entry must be a
 * live note or event and the provider not deleted, both in `groupId`.
 * Linking a pair that's already linked returns the existing link.
 */
export const link = (ctx: ServiceContext, input: EntryProviderLinkInput) =>
  withTransaction(async (tx) => {
    const parsed = entryProviderLinkZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { groupId, entryId, providerId } = parsed.data;
    const id = entryProviderId(entryId, providerId);

    const entry = await visibleEntry(ctx, tx, entryId);
    if (isError(entry)) return entry;
    const provider = await visibleProvider(ctx, tx, providerId);
    if (isError(provider)) return provider;

    if (entry.groupId !== groupId || provider.groupId !== groupId) {
      return newError({ code: "entryProviderService:immutable" });
    }
    if (!canLinkProviders(entry.kind)) return newError({ code: "entryProviderService:wrongKind" });

    const existing = await timelineEntryProviderModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (existing) return existing;

    return timelineEntryProviderModel.create({ ...ctx, tx, data: { id, groupId, entryId, providerId } });
  }, ctx);

/**
 * Remove a link (a hard delete). Writers only. Removing a link that's
 * already gone is fine (a replay); one the actor can see but not remove is
 * refused.
 */
export const unlink = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await timelineEntryProviderModel.remove({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
    });
    if (!isError(res)) return res;
    if (res.code !== "baseModel:remove:nothingRemoved") return res;
    const any = await timelineEntryProviderModel.getById(id, { authUser: SYSTEM_USER, tx });
    if (isError(any)) return any;
    return any ? rejectError(ctx.authUser) : { ids: [] as string[] };
  }, ctx);

/** `unlink` by the pair. */
export const unlinkPair = (ctx: ServiceContext, entryId: string, providerId: string) =>
  unlink(ctx, entryProviderId(entryId, providerId));
