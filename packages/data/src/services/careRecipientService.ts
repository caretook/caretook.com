import type { z } from "zod";
import type { CareRecipientInsert } from "../db";
import type { ServiceContext, ServiceUpdateArgs } from "./types";

import { withTransaction } from "../db";
import { careRecipientProfileZSchema, isTimeZone } from "../db/schema";
import { isError, newError } from "../errors";
import { careRecipientModel } from "../models";
import { rejectError } from "../permissions";
import { getService } from "./baseService";

export const serviceName = "careRecipient";
export const schemaName = careRecipientModel.schemaName;

type K = typeof schemaName;

const base = getService(careRecipientModel);

export const { get, getById, list, remove } = base;

// A recipient's time zone is where they live, and their medications'
// schedule times are in it, so it must be one the runtime knows.
const badTimeZone = (timeZone: unknown) =>
  timeZone !== undefined && (typeof timeZone !== "string" || !isTimeZone(timeZone));

const invalidTimeZone = () => Promise.resolve(newError({ code: "careRecipientService:invalidTimeZone" }));

export const create = (ctx: ServiceContext, data: CareRecipientInsert) =>
  badTimeZone(data.timeZone) ? invalidTimeZone() : base.create(ctx, data);

export const update = (ctx: ServiceContext, opts: ServiceUpdateArgs<K>) =>
  badTimeZone(opts.data.timeZone) ? invalidTimeZone() : base.update(ctx, opts);

export const upsert = (ctx: ServiceContext, data: CareRecipientInsert) =>
  badTimeZone(data.timeZone) ? invalidTimeZone() : base.upsert(ctx, data);

const invalid = (error: z.ZodError) =>
  newError({
    code: "careRecipientService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

/**
 * Edit the recipient's profile: the name, preferred name and birthday, the
 * medical basics and the note for helpers (owners, admins and caretakers).
 * Fields left out keep their value; empty text clears. A non-member gets
 * not-found; a viewer `permissions:unauthorized`.
 */
export const updateProfile = (
  ctx: ServiceContext,
  groupId: string,
  input: z.input<typeof careRecipientProfileZSchema>,
) =>
  withTransaction(async (tx) => {
    const parsed = careRecipientProfileZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const recipient = await careRecipientModel.get({
      ...ctx,
      tx,
      filter: { groupId: { type: "eq", value: groupId } },
    });
    if (isError(recipient)) return recipient;
    if (!recipient) return newError({ code: "careRecipientService:notFound" });

    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    if (!Object.keys(data).length) return recipient;

    const updated = await careRecipientModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: recipient.id } },
      data,
    });
    // Visible but not writable: a viewer.
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    return updated[0] ?? recipient;
  }, ctx);
