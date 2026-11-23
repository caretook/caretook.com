import type { z } from "zod";
import type { GroupRoleName } from "../constants";
import type { MemberCalendarSetting, ReminderLead, ShareLevel, Tx } from "../db";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  calendarSettingsChangeZSchema,
  DEFAULT_REMINDER_LEADS,
  DETAILS_CONSENT_VERSION,
  hasDetailsConsent,
  shareLevel,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, careGroupModel, memberCalendarSettingModel } from "../models";
import { isSystemUser } from "../permissions";
import { readReminderUnsubscribeToken, reminderUnsubscribeToken } from "../utils/unsubscribeToken";
import { enqueue as enqueueCalendarPush } from "./calendarSyncService";

// A member's calendar settings for one care group (appointments-2): reminder
// emails, the details consent, and (slice 5) their feed. Every member,
// viewers included, reads and writes only their own, through the model's
// `owned` scope; this checks they're in the group, records the consent with
// its version, and refuses details the group's owners forbid. No row reads
// as the defaults (reminders off, the preset leads, generic).
//
// The owners' switch (`care_group.details_outside_allowed`) is here too:
// only owners change it. Turning it off makes everyone generic at once
// (shareLevel); members' recorded consent is kept for when it's back on.

export const serviceName = "calendarSetting";
export const schemaName = memberCalendarSettingModel.schemaName;

/** What the settings page, and later the feed, reminders and Google, read of a member's settings. */
export type CalendarSettingsView = {
  groupId: string;
  role: GroupRoleName;
  remindersOn: boolean;
  reminderLeads: ReminderLead[];
  detailsConsent: boolean;
  detailsConsentAt: string | null;
  detailsConsentVersion: string | null;
  /** They agreed, but to an older wording: `detailsConsent` is false until they agree again. */
  detailsConsentStale: boolean;
  /** The owners' switch: whether details may leave Caretook at all. */
  groupAllowsDetails: boolean;
  shareLevel: ShareLevel;
  /** The member's feed (slice 5): whether one is live, and when its URL was last made. */
  feed: { active: boolean; rotatedAt: string | null };
};

const invalid = (error: z.ZodError) =>
  newError({
    code: "calendarSettingService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notMember = () => newError({ code: "calendarSettingService:notMember" });

/** The actor's role in `groupId`, or the not-a-member error (staff included). */
const roleIn = async (ctx: ServiceContext, groupId: string, tx?: Tx) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  return role ?? notMember();
};

const ownRow = (ctx: ServiceContext, groupId: string, userId: string, tx?: Tx) =>
  memberCalendarSettingModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
  });

const groupAllows = async (ctx: ServiceContext, groupId: string, tx?: Tx) => {
  const group = await careGroupModel.getById(groupId, { ...ctx, tx });
  if (isError(group)) return group;
  if (!group) return notMember();
  return group.detailsOutsideAllowed;
};

const toView = (
  groupId: string,
  role: GroupRoleName,
  row: MemberCalendarSetting | null,
  groupAllowsDetails: boolean,
): CalendarSettingsView => {
  const detailsConsent = hasDetailsConsent({
    consentAt: row?.detailsConsentAt,
    consentVersion: row?.detailsConsentVersion,
  });
  return {
    groupId,
    role,
    remindersOn: row?.remindersOn ?? false,
    reminderLeads: row?.reminderLeads ?? [...DEFAULT_REMINDER_LEADS],
    detailsConsent,
    detailsConsentAt: row?.detailsConsentAt ?? null,
    detailsConsentVersion: row?.detailsConsentVersion ?? null,
    detailsConsentStale: !!row?.detailsConsentAt && !detailsConsent,
    groupAllowsDetails,
    shareLevel: shareLevel({ memberConsent: detailsConsent, groupAllowsDetails }),
    feed: { active: !!row?.feedTokenHash, rotatedAt: row?.feedRotatedAt ?? null },
  };
};

const read = async (ctx: ServiceContext, groupId: string, tx?: Tx) => {
  const role = await roleIn(ctx, groupId, tx);
  if (isError(role)) return role;
  const allows = await groupAllows(ctx, groupId, tx);
  if (isError(allows)) return allows;
  const row = await ownRow(ctx, groupId, ctx.authUser!.id, tx);
  if (isError(row)) return row;
  return toView(groupId, role, row, allows);
};

/** The actor's calendar settings for `groupId` (the defaults until they change one). Members only. */
export const get = (ctx: ServiceContext, groupId: string) => read(ctx, groupId);

/**
 * Change the actor's own settings for `groupId`. Fields left out keep their
 * value. Turning details on records the consent (when, and
 * DETAILS_CONSENT_VERSION), unless it's already on for the current wording;
 * off clears it. Details the owners forbid are refused (`detailsForbidden`).
 */
export const update = (
  ctx: ServiceContext,
  groupId: string,
  input: z.input<typeof calendarSettingsChangeZSchema>,
) =>
  withTransaction(async (tx) => {
    const parsed = calendarSettingsChangeZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const change = parsed.data;
    const role = await roleIn(ctx, groupId, tx);
    if (isError(role)) return role;
    const userId = ctx.authUser!.id;
    const allows = await groupAllows(ctx, groupId, tx);
    if (isError(allows)) return allows;
    if (change.detailsConsent && !allows)
      return newError({ code: "calendarSettingService:detailsForbidden" });

    const existing = await ownRow(ctx, groupId, userId, tx);
    if (isError(existing)) return existing;

    const data: Partial<MemberCalendarSetting> = {};
    if (change.remindersOn !== undefined) data.remindersOn = change.remindersOn;
    if (change.reminderLeads !== undefined) data.reminderLeads = change.reminderLeads;
    const agreed = hasDetailsConsent({
      consentAt: existing?.detailsConsentAt,
      consentVersion: existing?.detailsConsentVersion,
    });
    if (change.detailsConsent === true && !agreed) {
      data.detailsConsentAt = new Date().toISOString();
      data.detailsConsentVersion = DETAILS_CONSENT_VERSION;
    }
    if (change.detailsConsent === false) {
      data.detailsConsentAt = null;
      data.detailsConsentVersion = null;
    }

    let row: MemberCalendarSetting | null = existing;
    if (Object.keys(data).length) {
      if (existing) {
        const updated = await memberCalendarSettingModel.update({
          ...ctx,
          tx,
          filter: { id: { type: "eq", value: existing.id } },
          data,
        });
        if (isError(updated)) return updated;
        row = updated[0] ?? existing;
      } else {
        const created = await memberCalendarSettingModel.create({
          ...ctx,
          tx,
          data: { ...data, userId, groupId },
        });
        if (isError(created)) return created;
        row = created;
      }
    }
    // Turning details on or off rewrites what's in their Google calendar (appointments-2).
    if ("detailsConsentAt" in data) {
      const queued = await enqueueCalendarPush(tx, { memberId: userId, inGroup: groupId }, "consent");
      if (queued) return queued;
    }
    return toView(groupId, role, row, allows);
  }, ctx);

/**
 * The owners' switch: whether members may let details (titles, places,
 * providers) leave Caretook. Owners only (the system too); a non-member
 * gets `notMember`, anyone else `detailsOwnerOnly`.
 */
export const setDetailsAllowed = (ctx: ServiceContext, groupId: string, allowed: boolean) =>
  withTransaction(async (tx) => {
    if (!isSystemUser(ctx.authUser)) {
      const role = await roleIn(ctx, groupId, tx);
      if (isError(role)) return role;
      if (role !== "owner") return newError({ code: "calendarSettingService:detailsOwnerOnly" });
    }
    const updated = await careGroupModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: groupId } },
      data: { detailsOutsideAllowed: allowed },
    });
    if (isError(updated)) return updated;
    // Everyone's level may change: every Google calendar in the group is rewritten.
    const queued = await enqueueCalendarPush(tx, { groupId }, "consent");
    if (queued) return queued;
    return { groupId, detailsOutsideAllowed: updated[0]?.detailsOutsideAllowed ?? allowed };
  }, ctx);

/**
 * A member leaving or removed: their settings (the feed with them) and
 * reminder overrides in `groupId` go, in the removal's transaction.
 */
export const removeForMember = (tx: Tx, groupId: string, userId: string) =>
  memberCalendarSettingModel.removeForMember(tx, groupId, userId);

/**
 * The one-click unsubscribe token in a member's reminder emails for
 * `groupId` (slice 6): signed, never stored. Null where it can't be signed
 * (production without INVITE_LINK_KEY).
 */
export const unsubscribeToken = (userId: string, groupId: string) =>
  reminderUnsubscribeToken(userId, groupId);

/** Whether `token` is a reminder unsubscribe token of ours (the page asks before it's used). */
export const isUnsubscribeToken = (token: string) => readReminderUnsubscribeToken(token) !== null;

/**
 * A reminder email's unsubscribe link, used: turns reminders off for its
 * member in its group (as the system; no sign-in). Nothing to do for a
 * former member or reminders already off. `badUnsubscribe` for a token that
 * isn't ours.
 */
export const unsubscribeReminders = (token: string) =>
  withTransaction(async (tx) => {
    const target = readReminderUnsubscribeToken(token);
    if (!target) return newError({ code: "calendarSettingService:badUnsubscribe" });
    const ctx: ServiceContext = { authUser: SYSTEM_USER };
    const row = await ownRow(ctx, target.groupId, target.userId, tx);
    if (isError(row)) return row;
    if (row?.remindersOn) {
      const updated = await memberCalendarSettingModel.update({
        ...ctx,
        tx,
        filter: { id: { type: "eq", value: row.id } },
        data: { remindersOn: false },
      });
      if (isError(updated)) return updated;
    }
    return { groupId: target.groupId, remindersOn: false as const };
  });
