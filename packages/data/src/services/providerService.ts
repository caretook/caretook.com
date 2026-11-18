import type { z } from "zod";
import type { ProviderCreateInput, ProviderUpdateInput, ProviderUpsertInput, Tx } from "../db";
import type { IncludeDeleted } from "../models/provider";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  isPracticeType,
  providerContentZSchema,
  providerCreateZSchema,
  providerUpdateZSchema,
  providerUpsertZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupModel, providerModel } from "../models";
import { rejectError } from "../permissions";

// A care group's provider directory. Write through here, not the model:
// this is where content is validated and the practice is checked (a
// practice or pharmacy in the same group, not deleted).

export const serviceName = "provider";
export const schemaName = providerModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "providerService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "providerService:notFound" });
const badPractice = () =>
  newError({
    code: "providerService:badPractice",
    meta: {
      issues: [{ path: "practiceId", message: "Choose a practice or pharmacy in this care group" }],
    },
  });

/** The practice must be a live practice or pharmacy in the group, and not the provider itself. */
const checkPractice = async (
  ctx: ServiceContext,
  tx: Tx,
  { id, groupId, practiceId }: { id?: string; groupId: string; practiceId: string | null },
) => {
  if (!practiceId) return null;
  if (practiceId === id) return badPractice();
  const practice = await providerModel.getById(practiceId, { ...ctx, tx });
  if (isError(practice)) return practice;
  if (!practice || practice.groupId !== groupId || !isPracticeType(practice.type)) return badPractice();
  return null;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One provider, if the actor can see it. Deleted ones only with `includeDeleted`. */
export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  providerModel.getById(id, { ...ctx, ...opts });

/** A group's providers in display order: primary, then current, then past, by name. */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  providerModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Add a provider. `id` may come from an offline device. Writers only. */
export const create = (ctx: ServiceContext, input: ProviderCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = providerCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const data = parsed.data;

    // A non-member learns nothing about the group.
    const group = await careGroupModel.getById(data.groupId, { ...ctx, tx });
    if (isError(group)) return group;
    if (!group) return rejectError(ctx.authUser);

    const practice = await checkPractice(ctx, tx, data);
    if (practice) return practice;

    return providerModel.create({ ...ctx, tx, data });
  }, ctx);

/**
 * Edit a provider. The group is fixed. The merged provider must be valid
 * (a practice can't gain a practice), and a changed practice is checked.
 */
export const update = (ctx: ServiceContext, id: string, input: ProviderUpdateInput) =>
  withTransaction(async (tx) => {
    const parsed = providerUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await providerModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const merged = providerContentZSchema.safeParse({
      type: existing.type,
      name: existing.name,
      specialty: existing.specialty,
      practiceId: existing.practiceId,
      phones: existing.phones,
      email: existing.email,
      address: existing.address,
      website: existing.website,
      status: existing.status,
      isPrimary: existing.isPrimary,
      ...patch,
    });
    if (!merged.success) return invalid(merged.error);

    if (merged.data.practiceId !== existing.practiceId) {
      const practice = await checkPractice(ctx, tx, { id, groupId: existing.groupId, ...merged.data });
      if (practice) return practice;
    }

    const updated = await providerModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: merged.data,
    });
    // Visible but not writable: a viewer.
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  }, ctx);

/**
 * Create the provider with this id, or bring the existing one up to date:
 * what PowerSync's upload queue sends for a row a device created. Safe to
 * replay. The group never changes, a deleted provider stays deleted, and an
 * id the actor can't see is refused without saying whether it exists.
 */
export const upsert = (ctx: ServiceContext, input: ProviderUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = providerUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, ...content } = parsed.data;

    const existing = await providerModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
    if (isError(existing)) return existing;
    if (!existing) return create({ ...ctx, tx }, parsed.data);

    const visible = await providerModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId) return newError({ code: "providerService:immutable" });
    if (visible.deletedAt) return visible;

    return update({ ...ctx, tx }, id, content);
  }, ctx);

/** Soft delete. The provider leaves the directory but syncs as deleted; links stay. */
export const remove = async (ctx: ServiceContext, id: string) => {
  const res = await providerModel.remove({ ...ctx, filter: { id: { type: "eq", value: id } } });
  if (!isError(res) || res.code !== "baseModel:remove:nothingRemoved") return res;
  // Visible but not removable: a viewer. Otherwise gone, or never theirs.
  const visible = await providerModel.getById(id, ctx);
  if (isError(visible)) return visible;
  return visible ? rejectError(ctx.authUser) : notFound();
};
