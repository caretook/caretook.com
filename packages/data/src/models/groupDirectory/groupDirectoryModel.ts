import type { Tx } from "../../db";

import { and, asc, count, desc, eq, exists, ilike, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { dbMayFail, txOrDb } from "../../db";
import {
  careGroupMemberSchema,
  careGroupSchema,
  carePeriodSchema,
  careRecipientSchema,
  medicationSchema,
  noteDocumentSchema,
  providerSchema,
  timelineEntrySchema,
  userSchema,
} from "../../db/schema";
import { isError } from "../../errors";

export const schemaName = "careGroupSchema";

// Care groups as Caretook staff see them (admin slice 4): names, members,
// counts and dates, never care data. Unscoped (staff aren't members, so the
// permission map would show them nothing): only groupAdminService calls
// these, after its capability check. Every query names its columns; counts
// come from count(*), never from reading rows.

const g = careGroupSchema;
const r = careRecipientSchema;
const m = careGroupMemberSchema;
const member = alias(userSchema, "directory_member");
const inviter = alias(userSchema, "directory_inviter");

/** `value` as a literal ILIKE pattern: its `%`, `_` and backslash match only themselves. */
const containsPattern = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type GroupDirectoryFilter = {
  /** Part of the group's name, or of its recipient's name or preferred name. */
  q?: string;
  /** Only groups with no owner. */
  noOwner?: boolean;
};

const filterSql = (tx: Tx | undefined, filter: GroupDirectoryFilter) => {
  const q = filter.q?.trim();
  const ownerRow = () =>
    txOrDb(tx)
      .select({ one: sql`1` })
      .from(m)
      .where(and(eq(m.groupId, g.id), eq(m.role, "owner")));
  return and(
    q
      ? or(
          ilike(g.name, containsPattern(q)),
          exists(
            txOrDb(tx)
              .select({ one: sql`1` })
              .from(r)
              .where(
                and(
                  eq(r.groupId, g.id),
                  or(ilike(r.name, containsPattern(q)), ilike(r.preferredName, containsPattern(q))),
                ),
              ),
          ),
        )
      : undefined,
    filter.noOwner ? notExists(ownerRow()) : undefined,
  );
};

/** One page of groups matching `filter`, newest first, with members' count and owners, and the total. */
export const search = async (args: {
  tx?: Tx;
  filter: GroupDirectoryFilter;
  page: { limit: number; offset: number };
}) => {
  const where = filterSql(args.tx, args.filter);
  const rows = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .select({
          id: g.id,
          name: g.name,
          createdAt: g.createdAt,
          recipientName: r.name,
          recipientPreferredName: r.preferredName,
          memberCount: sql<number>`(select count(*)::int from ${m} where ${m.groupId} = ${g.id})`,
        })
        .from(g)
        .leftJoin(r, eq(r.groupId, g.id))
        .where(where)
        .orderBy(desc(g.createdAt), desc(g.id))
        .limit(args.page.limit)
        .offset(args.page.offset),
    "groupDirectoryModel:search",
  );
  if (isError(rows)) return rows;

  const total = await dbMayFail(
    () => txOrDb(args.tx).select({ count: count() }).from(g).where(where),
    "groupDirectoryModel:search",
  );
  if (isError(total)) return total;

  const owners = await ownersOf(
    args.tx,
    rows.map((row) => row.id),
  );
  if (isError(owners)) return owners;

  return {
    count: total[0]?.count ?? 0,
    data: rows.map((row) => ({ ...row, owners: owners.get(row.id) ?? [] })),
  };
};

/** Each group's owners (id, name, email), longest-standing first. */
const ownersOf = async (tx: Tx | undefined, groupIds: string[]) => {
  const byGroup = new Map<string, { id: string; name: string | null; email: string }[]>();
  if (!groupIds.length) return byGroup;
  const rows = await dbMayFail(
    () =>
      txOrDb(tx)
        .select({ groupId: m.groupId, id: member.id, name: member.name, email: member.email })
        .from(m)
        .innerJoin(member, eq(member.id, m.userId))
        .where(and(inArray(m.groupId, groupIds), eq(m.role, "owner")))
        .orderBy(asc(m.createdAt), asc(m.id)),
    "groupDirectoryModel:owners",
  );
  if (isError(rows)) return rows;
  for (const { groupId, ...owner } of rows) byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), owner]);
  return byGroup;
};

/** The group's name and created date, and its recipient's name; null when there's no such group. */
export const getGroup = async (groupId: string, tx?: Tx) => {
  const rows = await dbMayFail(
    () =>
      txOrDb(tx)
        .select({
          id: g.id,
          name: g.name,
          createdAt: g.createdAt,
          recipientName: r.name,
          recipientPreferredName: r.preferredName,
        })
        .from(g)
        .leftJoin(r, eq(r.groupId, g.id))
        .where(eq(g.id, groupId))
        .limit(1),
    "groupDirectoryModel:get",
  );
  if (isError(rows)) return rows;
  return rows[0] ?? null;
};

/** Every member: their account's name and email, role, who invited them and when they joined. */
export const members = async (groupId: string, tx?: Tx) =>
  dbMayFail(
    () =>
      txOrDb(tx)
        .select({
          membershipId: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.createdAt,
          name: member.name,
          email: member.email,
          inviterId: inviter.id,
          inviterName: inviter.name,
          inviterEmail: inviter.email,
        })
        .from(m)
        .innerJoin(member, eq(member.id, m.userId))
        .leftJoin(inviter, eq(inviter.id, m.invitedBy))
        .where(eq(m.groupId, groupId))
        .orderBy(asc(m.createdAt), asc(m.id)),
    "groupDirectoryModel:members",
  );

const countLive = (
  table: typeof timelineEntrySchema | typeof providerSchema | typeof medicationSchema,
  groupId: string,
) =>
  sql<number>`(select count(*)::int from ${table} where ${table.groupId} = ${groupId} and ${isNull(table.deletedAt)})`;

const latest = (
  table:
    | typeof timelineEntrySchema
    | typeof providerSchema
    | typeof medicationSchema
    | typeof carePeriodSchema
    | typeof noteDocumentSchema,
  groupId: string,
) => sql`(select max(${table.updatedAt}) from ${table} where ${table.groupId} = ${groupId})`;

/**
 * How much the group holds (live entries, providers and medications, by
 * count) and its last activity: the latest change to any of its entries,
 * documents, providers, medications or care periods, or a member joining.
 * Never a row's content.
 */
export const activity = async (groupId: string, tx?: Tx) => {
  const rows = await dbMayFail(
    () =>
      txOrDb(tx)
        .select({
          entries: countLive(timelineEntrySchema, groupId),
          providers: countLive(providerSchema, groupId),
          medications: countLive(medicationSchema, groupId),
          lastActivityAt: sql<string | null>`greatest(
            ${latest(timelineEntrySchema, groupId)},
            ${latest(noteDocumentSchema, groupId)},
            ${latest(providerSchema, groupId)},
            ${latest(medicationSchema, groupId)},
            ${latest(carePeriodSchema, groupId)},
            (select max(${m.createdAt}) from ${m} where ${m.groupId} = ${groupId})
          )::text`,
        })
        .from(sql`(select 1) as one`),
    "groupDirectoryModel:activity",
  );
  if (isError(rows)) return rows;
  const row = rows[0];
  return {
    counts: {
      entries: row?.entries ?? 0,
      providers: row?.providers ?? 0,
      medications: row?.medications ?? 0,
    },
    lastActivityAt: row?.lastActivityAt ?? null,
  };
};
