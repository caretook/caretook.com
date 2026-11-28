import type { GroupRoleName } from "../constants";
import type { AuthUser } from "../permissions";
import type { CalendarItem, ShareLevel, TimelineEntry, TimelineEntryKind, Tx } from "../db";
import type { ServiceContext } from "./types";

import { randomBytes } from "node:crypto";
import { MAX_PAGE_SIZE, SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { calendarItems, calendarWindow, hasDetailsConsent, shareLevel } from "../db/schema";
import { isError, newError } from "../errors";
import {
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  memberCalendarSettingModel,
  providerModel,
  todoModel,
  timelineEntryModel,
  timelineEntryProviderModel,
  userModel,
} from "../models";
import { hashFeedToken } from "../models/memberCalendarSetting/memberCalendarSettingModel";

// A member's calendar feed for one care group (appointments-2, slice 5): a
// secret URL that Apple, Google or Outlook calendars subscribe to. The token
// is 32 random bytes; only its SHA-256 is stored (`member_calendar_setting`),
// so it's shown once, when made, and can't be read back. `create` and
// `rotate` return it; `revoke` drops it. Anyone holding the token can read
// the feed (that's how subscribing works), so `resolve` rechecks on every
// request that the member is still in the group and their account is on,
// and the feed is read as that member (RBAC in SQL) at their share level.

export const schemaName = memberCalendarSettingModel.schemaName;

/** A token is 32 bytes in base64url: 43 characters. Anything else can't be one. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const notMember = () => newError({ code: "calendarFeedService:notMember" });

/** A token's fingerprint for rate-limit keys: its hash, never the token. */
export const fingerprint = (token: string) => hashFeedToken(token);

const newToken = () => randomBytes(32).toString("base64url");

const system = (tx?: Tx) => ({ authUser: SYSTEM_USER, tx });

const roleIn = async (ctx: ServiceContext, groupId: string, tx: Tx) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  return role ?? notMember();
};

const ownRow = (groupId: string, userId: string, tx: Tx) =>
  memberCalendarSettingModel.get({
    ...system(tx),
    filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
  });

/** Store a new token's hash on the actor's row (made if there's none yet). Returns the token. */
const store = async (ctx: ServiceContext, groupId: string, mode: "create" | "rotate") =>
  withTransaction(async (tx) => {
    const role = await roleIn(ctx, groupId, tx);
    if (isError(role)) return role;
    const userId = ctx.authUser!.id;
    const existing = await ownRow(groupId, userId, tx);
    if (isError(existing)) return existing;
    if (mode === "create" && existing?.feedTokenHash) return newError({ code: "calendarFeedService:exists" });

    const token = newToken();
    const data = { feedTokenHash: hashFeedToken(token), feedRotatedAt: new Date().toISOString() };
    const saved = existing
      ? await memberCalendarSettingModel.update({
          ...system(tx),
          filter: { id: { type: "eq", value: existing.id } },
          data,
        })
      : await memberCalendarSettingModel.create({ ...system(tx), data: { ...data, userId, groupId } });
    if (isError(saved)) return saved;
    return { token };
  }, ctx);

/** Make the actor's feed for `groupId` (any member, viewers too). Returns its token, once. */
export const create = (ctx: ServiceContext, groupId: string) => store(ctx, groupId, "create");

/** Replace the actor's feed token (or make one): the old link stops working. Returns the new token, once. */
export const rotate = (ctx: ServiceContext, groupId: string) => store(ctx, groupId, "rotate");

/** Stop the actor's feed: its link answers 404 from now on. Nothing happens without one. */
export const revoke = (ctx: ServiceContext, groupId: string) =>
  withTransaction(async (tx) => {
    const role = await roleIn(ctx, groupId, tx);
    if (isError(role)) return role;
    const existing = await ownRow(groupId, ctx.authUser!.id, tx);
    if (isError(existing)) return existing;
    if (!existing?.feedTokenHash) return { revoked: false };
    const saved = await memberCalendarSettingModel.update({
      ...system(tx),
      filter: { id: { type: "eq", value: existing.id } },
      data: { feedTokenHash: null, feedRotatedAt: null },
    });
    return isError(saved) ? saved : { revoked: true };
  }, ctx);

/** Whose feed a token is. */
export type ResolvedFeed = {
  userId: string;
  groupId: string;
  role: GroupRoleName;
  /** The member, as the feed reads (their role in this group only). */
  authUser: AuthUser;
  level: ShareLevel;
};

/**
 * The member and group a token belongs to, or null for an unknown or revoked
 * token, a former member, or a disabled account. The token is never logged
 * or returned.
 */
export const resolve = async (token: string) => {
  if (!TOKEN_SHAPE.test(token)) return null;
  const row = await memberCalendarSettingModel.get({
    ...system(),
    filter: { feedTokenHash: { type: "eq", value: hashFeedToken(token) } },
  });
  if (isError(row) || !row) return row;
  const role = await careGroupMemberModel.getRole(row.groupId, row.userId);
  if (isError(role) || !role) return role;
  const user = await userModel.getWholeById(row.userId, system());
  if (isError(user) || !user || user.disabledAt) return isError(user) ? user : null;
  const group = await careGroupModel.getById(row.groupId, system());
  if (isError(group) || !group) return group;
  return {
    userId: row.userId,
    groupId: row.groupId,
    role,
    authUser: { id: row.userId, roleNames: ["member"], groupRoles: { [row.groupId]: role } },
    level: shareLevel({
      memberConsent: hasDetailsConsent({
        consentAt: row.detailsConsentAt,
        consentVersion: row.detailsConsentVersion,
      }),
      groupAllowsDetails: group.detailsOutsideAllowed,
    }),
  } satisfies ResolvedFeed;
};

/** What a feed holds: its calendar's name, the share level it's rendered at, and the items. */
export type CalendarFeed = { calendarName: string; level: ShareLevel; items: CalendarItem[] };

const DAY_MS = 86_400_000;

/**
 * The feed behind `token` at `now`: the group's appointments and
 * top-level open todos with a due day, 90 days back to 90 days ahead (`calendarItems`),
 * read as the member. Provider names are read only at the details level.
 * Null when the token resolves to no one.
 */
export const load = async (token: string, { now, appUrl }: { now: Date; appUrl: string }) => {
  const feed = await resolve(token);
  if (isError(feed) || !feed) return feed;
  const { authUser, groupId } = feed;
  const ctx = { authUser };

  const recipient = await careRecipientModel.get({
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient) || !recipient) return recipient;

  const window = calendarWindow(now);
  // An all-day entry's instant is its day's start: a day either side keeps the edges.
  const filter = {
    groupId: { type: "eq" as const, value: groupId },
    kind: { type: "inArray" as const, value: ["event"] as TimelineEntryKind[] },
    occurredAt: {
      type: "and" as const,
      value: [
        { type: "gte" as const, value: new Date(window.from.getTime() - DAY_MS).toISOString() },
        { type: "lt" as const, value: new Date(window.to.getTime() + DAY_MS).toISOString() },
      ],
    },
  };
  const entries: { data: TimelineEntry[] } = { data: [] };
  let cursor: string | null = null;
  do {
    const page = await timelineEntryModel.listPage({ ...ctx, filter, cursor, limit: MAX_PAGE_SIZE });
    if (isError(page)) return page;
    entries.data.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);

  // Top-level todos only (todo-subtasks-3): a subtask shows in its tree in the app, never on a calendar.
  const todos = await todoModel.list({
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId }, parentId: { type: "isNull" } },
  });
  if (isError(todos)) return todos;

  let providers = new Map<string, string[]>();
  if (feed.level === "details" && entries.data.length) {
    const names = await providerModel.list({ ...ctx, filter: { groupId: { type: "eq", value: groupId } } });
    if (isError(names)) return names;
    const links = await timelineEntryProviderModel.list({
      ...ctx,
      filter: { entryId: { type: "inArray", value: entries.data.map((entry) => entry.id) } },
      orderBy: [{ field: "createdAt", direction: "asc" }],
    });
    if (isError(links)) return links;
    const nameOf = new Map(names.data.map((provider) => [provider.id, provider.name]));
    providers = new Map();
    for (const link of links.data) {
      const name = nameOf.get(link.providerId);
      if (name) providers.set(link.entryId, [...(providers.get(link.entryId) ?? []), name]);
    }
  }

  const items = calendarItems({
    entries: entries.data.map((entry) => ({ ...entry, providers: providers.get(entry.id) ?? [] })),
    todos: todos.data,
    recipient: { displayName: recipient.displayName, timeZone: recipient.timeZone },
    from: window.from,
    to: window.to,
    appUrl,
  });
  return {
    calendarName: `Caretook: ${recipient.displayName}`,
    level: feed.level,
    items,
  } satisfies CalendarFeed;
};
