import type { z } from "zod";
import type { EntryProviderLinkInput, TimelineEntryProvider, Tx } from "../db";
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
 * `link` for every pair of `entryIds` and `providerIds` in one INSERT (a
 * series' visits: B-755), with link's checks on each: a live note or event
 * and a provider that isn't deleted, as the actor sees them, both in
 * `groupId`. Pairs already linked keep their link. All or nothing. Returns
 * the links entry by entry, in `providerIds`' order.
 */
export const linkMany = (
  ctx: ServiceContext,
  input: { groupId: string; entryIds: readonly string[]; providerIds: readonly string[] },
) =>
  withTransaction(async (tx) => {
    const pairs = [];
    for (const entryId of input.entryIds)
      for (const providerId of input.providerIds) {
        const parsed = entryProviderLinkZSchema.safeParse({ groupId: input.groupId, entryId, providerId });
        if (!parsed.success) return invalid(parsed.error);
        pairs.push({ ...parsed.data, id: entryProviderId(entryId, providerId) });
      }
    if (!pairs.length) return [] as TimelineEntryProvider[];
    const { groupId } = input;

    const entries = await timelineEntryModel.list({
      ...ctx,
      tx,
      filter: { id: { type: "inArray", value: [...input.entryIds] } },
    });
    if (isError(entries)) return entries;
    const entryOf = new Map(entries.data.map((entry) => [entry.id, entry]));
    for (const id of input.entryIds) {
      if (entryOf.has(id)) continue;
      // Not visible: the right refusal, as link gives it.
      const entry = await visibleEntry(ctx, tx, id);
      if (isError(entry)) return entry;
      entryOf.set(id, entry);
    }
    const providers = [];
    for (const id of input.providerIds) {
      const provider = await visibleProvider(ctx, tx, id);
      if (isError(provider)) return provider;
      providers.push(provider);
    }
    for (const entry of entryOf.values()) {
      if (entry.groupId !== groupId) return newError({ code: "entryProviderService:immutable" });
      if (!canLinkProviders(entry.kind)) return newError({ code: "entryProviderService:wrongKind" });
    }
    if (providers.some((provider) => provider.groupId !== groupId))
      return newError({ code: "entryProviderService:immutable" });

    const existing = await timelineEntryProviderModel.list({
      ...ctx,
      tx,
      filter: { id: { type: "inArray", value: pairs.map((p) => p.id) } },
    });
    if (isError(existing)) return existing;
    const links = new Map(existing.data.map((link) => [link.id, link]));
    const created = await timelineEntryProviderModel.createMany({
      ...ctx,
      tx,
      data: pairs.filter((p) => !links.has(p.id)),
    });
    if (isError(created)) return created;
    for (const link of created) links.set(link.id, link);
    return pairs.flatMap((p) => links.get(p.id) ?? []);
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
