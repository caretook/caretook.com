import type { AdminAuditLog, AdminAuditLogInsert, AuditFilter, Tx } from "../../db";
import type { Paginate, QueryCommonArgs } from "../base/queryHelpers";

import { and, count, desc, eq, gte, ilike, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { dbMayFail, txOrDb } from "../../db";
import { adminAuditLogSchema, careGroupSchema, userSchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import { generateQueryWhere, paginate } from "../base/queryHelpers";

export const schemaName = "adminAuditLogSchema";

export const dbToModel = (row: AdminAuditLog) => row;

// The staff audit log (admin PRD). Append-only: this model has no update or
// remove, and PERMISSIONS gives nobody either. Rows are written only by
// adminAuditService.record, as the system, inside the action's transaction.

const t = adminAuditLogSchema;
const actor = alias(userSchema, "audit_actor");
const targetUser = alias(userSchema, "audit_target_user");

/**
 * Append one entry, inside the caller's transaction (so the action and its
 * record commit or roll back together). Unscoped: only
 * adminAuditService.record calls it, after the action's own checks.
 */
export const insert = async (tx: Tx | undefined, data: Omit<AdminAuditLogInsert, "id" | "createdAt">) => {
  const res = await dbMayFail(
    () => txOrDb(tx).insert(t).values(data).returning(),
    "adminAuditLogModel:insert",
  );
  if (isError(res)) return res;
  const [row] = res;
  return row ? dbToModel(row) : newError({ code: "baseModel:create:nothingCreated" });
};

/** `value` as a literal ILIKE pattern: its `%`, `_` and backslash match only themselves. */
const containsPattern = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The start of `day` (YYYY-MM-DD, UTC) plus `addDays`, as ISO 8601. */
const dayStart = (day: string, addDays = 0) => {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + addDays);
  return at.toISOString();
};

/**
 * The SQL for the log's filters. A target that's an id matches the target
 * user or group; anything else matches part of the target user's email or
 * name, or the target group's name.
 */
const filterSql = (filter: Partial<AuditFilter>) => {
  const target = filter.target?.trim();
  const targetSql = !target
    ? undefined
    : UUID.test(target)
      ? or(eq(t.targetUserId, target), eq(t.targetGroupId, target))
      : or(
          ilike(targetUser.email, containsPattern(target)),
          ilike(targetUser.name, containsPattern(target)),
          ilike(careGroupSchema.name, containsPattern(target)),
        );
  return and(
    filter.actorId ? eq(t.actorId, filter.actorId) : undefined,
    filter.action ? eq(t.action, filter.action) : undefined,
    filter.from ? gte(t.createdAt, dayStart(filter.from)) : undefined,
    filter.to ? lt(t.createdAt, dayStart(filter.to, 1)) : undefined,
    targetSql,
  );
};

const searchColumns = {
  entry: t,
  actorName: actor.name,
  actorEmail: actor.email,
  targetUserName: targetUser.name,
  targetUserEmail: targetUser.email,
  targetGroupName: careGroupSchema.name,
};

type SearchRow = {
  entry: AdminAuditLog;
  actorName: string | null;
  actorEmail: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  targetGroupName: string | null;
};

/** One entry with who acted and on whom, by name (the group's name only: never its care data). */
export const searchRowToEntry = (row: SearchRow) => ({
  ...dbToModel(row.entry),
  actor: row.entry.actorId ? { id: row.entry.actorId, name: row.actorName, email: row.actorEmail } : null,
  targetUser: row.entry.targetUserId
    ? { id: row.entry.targetUserId, name: row.targetUserName, email: row.targetUserEmail }
    : null,
  targetGroup: row.entry.targetGroupId ? { id: row.entry.targetGroupId, name: row.targetGroupName } : null,
});

/**
 * Staff: the entries matching `filter`, newest first, with their count. In
 * the actor's list scope (staff only), like every read.
 */
export const search = async (
  args: QueryCommonArgs & { filter?: Partial<AuditFilter>; paginate?: Paginate },
) => {
  const scope = generateQueryWhere(schemaName, "list", { authUser: args.authUser });
  if (isError(scope)) return scope;
  const where = and(scope, filterSql(args.filter ?? {}));

  const from = () =>
    txOrDb(args.tx)
      .select(searchColumns)
      .from(t)
      .leftJoin(actor, eq(actor.id, t.actorId))
      .leftJoin(targetUser, eq(targetUser.id, t.targetUserId))
      .leftJoin(careGroupSchema, eq(careGroupSchema.id, t.targetGroupId));

  const rows = await dbMayFail(() => {
    const query = from().where(where).orderBy(desc(t.createdAt), desc(t.id));
    const page = paginate(args);
    return page.limit === undefined ? query : query.limit(page.limit).offset(page.offset);
  }, "adminAuditLogModel:search");
  if (isError(rows)) return rows;

  const total = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .select({ count: count() })
        .from(t)
        .leftJoin(targetUser, eq(targetUser.id, t.targetUserId))
        .leftJoin(careGroupSchema, eq(careGroupSchema.id, t.targetGroupId))
        .where(where),
    "adminAuditLogModel:search",
  );
  if (isError(total)) return total;

  return { count: total[0]?.count ?? 0, data: rows.map(searchRowToEntry) };
};

/** Staff: everyone who has an entry in the log, by name (the actor filter's choices). */
export const actors = async (args: QueryCommonArgs) => {
  const scope = generateQueryWhere(schemaName, "list", { authUser: args.authUser });
  if (isError(scope)) return scope;
  const rows = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .selectDistinct({ id: actor.id, name: actor.name, email: actor.email })
        .from(t)
        .innerJoin(actor, eq(actor.id, t.actorId))
        .where(scope),
    "adminAuditLogModel:actors",
  );
  if (isError(rows)) return rows;
  const label = (a: { name: string | null; email: string }) => (a.name || a.email).toLowerCase();
  return rows.sort((a, b) => label(a).localeCompare(label(b)) || a.email.localeCompare(b.email));
};
