import type { CareRecipientInsert } from "../db";
import type { ServiceContext, ServiceUpdateArgs } from "./types";

import { isTimeZone } from "../db/schema";
import { newError } from "../errors";
import { careRecipientModel } from "../models";
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
