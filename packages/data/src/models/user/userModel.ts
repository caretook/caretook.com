import type { GroupRoleName } from "../../constants/roles";
import type { User } from "../../db";
import type { AppError } from "../../errors";
import type { PermissionRoleName } from "../../permissions";
import type {
  QueryCommonArgs,
  QueryCreateArgs,
  QuerySelectArgs,
  QueryUpdateArgs,
} from "../base/queryHelpers";

import { eq, sql } from "drizzle-orm";
import { dbMayFail, getDb } from "../../db";
import { careGroupMemberSchema, userSchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "userSchema";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** What a co-member reads of another member's row (PUBLIC_PROFILE_FIELDS). */
export type UserPublicRow = Pick<User, "id" | "name" | "image" | "avatarColor" | "avatarIcon">;

/**
 * A whole row (yourself, staff, the system) or a co-member's public profile
 * (`publicOnly`). Narrow with `isWholeUser`, or read through the `…Whole`
 * functions, before using email, role or preferences.
 */
export const dbToModel = (row: User | UserPublicRow) =>
  "email" in row
    ? {
        ...row,
        publicOnly: false as const,
        roleNames: [row.role] as PermissionRoleName[],
        isAdmin: row.role === "admin",
      }
    : {
        id: row.id,
        name: row.name,
        image: row.image,
        avatarColor: row.avatarColor,
        avatarIcon: row.avatarIcon,
        publicOnly: true as const,
      };

type Model = ReturnType<typeof dbToModel>;
type WholeModel = Extract<Model, { publicOnly: false }>;

export const isWholeUser = (user: Model): user is WholeModel => !user.publicOnly;

const base = baseModel.getFunctions<typeof schemaName, Model, User | UserPublicRow>({
  schemaName,
  dbToModel,
});

export const { get, getById, list, remove } = base;

const whole = (user: Model): WholeModel | AppError =>
  isWholeUser(user) ? user : newError({ code: "userModel:notWhole" });

const wholeOrNull = (user: Model | null | AppError) => (user && !isError(user) ? whole(user) : user);

/**
 * Reads for callers that need email, role or preferences: as yourself, staff
 * or the system. A row the actor may only see in part is an error, never a
 * partial user. Services that email a co-member read as the system.
 */
export const getWhole = async (args: QuerySelectArgs<typeof schemaName>) => wholeOrNull(await get(args));

export const getWholeById = async (id: string, args: Omit<QuerySelectArgs<typeof schemaName>, "filter">) =>
  wholeOrNull(await getById(id, args));

export const listWhole = async (args: QuerySelectArgs<typeof schemaName>) => {
  const res = await list(args);
  if (isError(res)) return res;
  const data: WholeModel[] = [];
  for (const user of res.data) {
    const checked = whole(user);
    if (isError(checked)) return checked;
    data.push(checked);
  }
  return { count: res.count, data };
};

// Writes are only allowed to the user and staff, who read the row back whole.
// Emails are stored lowercased; the unique constraint relies on it.
export const create = async (args: QueryCreateArgs<typeof schemaName>) =>
  wholeOrNull(await base.create({ ...args, data: { ...args.data, email: normalizeEmail(args.data.email) } }));

export const update = async (args: QueryUpdateArgs<typeof schemaName>) => {
  const res = await base.update({
    ...args,
    data: args.data.email ? { ...args.data, email: normalizeEmail(args.data.email) } : args.data,
  });
  if (isError(res)) return res;
  const data: WholeModel[] = [];
  for (const user of res) {
    const checked = whole(user);
    if (isError(checked)) return checked;
    data.push(checked);
  }
  return data;
};

export const upsert = async (args: QueryCreateArgs<typeof schemaName>) =>
  wholeOrNull(await base.upsert({ ...args, data: { ...args.data, email: normalizeEmail(args.data.email) } }));

/** By email. A filter on email only ever matches rows the actor may see whole. */
export const getByEmail = async (email: string, args: QueryCommonArgs) => {
  const user = await getWhole({
    ...args,
    filter: { email: { type: "eq", value: normalizeEmail(email) } },
  });
  if (isError(user)) return user;
  if (!user) return newError({ code: "userModel:notFound" });
  return user;
};

/** What a session's AuthUser is built from: the account's role and state, and its group roles. */
export type AuthFacts = {
  id: string;
  roleNames: PermissionRoleName[];
  disabledAt: string | null;
  groupRoles: Record<string, GroupRoleName>;
};

/**
 * The account and its memberships in one query (B-140), for resolving a
 * session's AuthUser on every authed /rpc call; null when there's no such
 * user. Unscoped: only the auth package calls it, for the session's own user.
 */
export const getAuthFacts = async (id: string): Promise<AuthFacts | null | AppError> => {
  const res = await dbMayFail(
    () =>
      getDb()
        .select({
          id: userSchema.id,
          role: userSchema.role,
          disabledAt: userSchema.disabledAt,
          groupRoles: sql<Record<string, GroupRoleName>>`coalesce(
            jsonb_object_agg(${careGroupMemberSchema.groupId}, ${careGroupMemberSchema.role})
              filter (where ${careGroupMemberSchema.id} is not null),
            '{}'::jsonb)`,
        })
        .from(userSchema)
        .leftJoin(careGroupMemberSchema, eq(careGroupMemberSchema.userId, userSchema.id))
        .where(eq(userSchema.id, id))
        .groupBy(userSchema.id),
    "userModel:getAuthFacts",
  );
  if (isError(res)) return res;
  const row = res[0];
  if (!row) return null;
  return { id: row.id, roleNames: [row.role], disabledAt: row.disabledAt, groupRoles: row.groupRoles };
};
