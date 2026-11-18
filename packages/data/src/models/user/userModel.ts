import type { User } from "../../db";
import type { PermissionRoleName } from "../../permissions";
import type { QueryCommonArgs, QueryCreateArgs, QueryUpdateArgs } from "../base/queryHelpers";

import { isError, newError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "userSchema";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const dbToModel = (row: User) => ({
  ...row,
  roleNames: [row.role] as PermissionRoleName[],
  isAdmin: row.role === "admin",
});

const base = baseModel.getFunctions({ schemaName, dbToModel });

export const { get, getById, list, remove } = base;

// Emails are stored lowercased; the unique constraint relies on it.
export const create = (args: QueryCreateArgs<typeof schemaName>) =>
  base.create({ ...args, data: { ...args.data, email: normalizeEmail(args.data.email) } });

export const update = (args: QueryUpdateArgs<typeof schemaName>) =>
  base.update({
    ...args,
    data: args.data.email ? { ...args.data, email: normalizeEmail(args.data.email) } : args.data,
  });

export const upsert = (args: QueryCreateArgs<typeof schemaName>) =>
  base.upsert({ ...args, data: { ...args.data, email: normalizeEmail(args.data.email) } });

export const getByEmail = async (email: string, args: QueryCommonArgs) => {
  const user = await get({
    ...args,
    filter: { email: { type: "eq", value: normalizeEmail(email) } },
  });
  if (isError(user)) return user;
  if (!user) return newError({ code: "userModel:notFound" });
  return user;
};
