import type { ReminderLead } from "../db/schema";
import type { Tx } from "../db";

import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../db";
import {
  careGroupMemberSchema,
  careGroupSchema,
  careRecipientSchema,
  hasDetailsConsent,
  memberCalendarSettingSchema,
  providerSchema,
  reminderOverrideSchema,
  todoSchema,
  timelineEntryProviderSchema,
  timelineEntrySchema,
  userSchema,
} from "../db/schema";
import { isError } from "../errors";
import { appSettingModel } from "../models";
import type { CalendarEntryInput, CalendarTodoInput } from "../domain/calendars/calendarItems";
import type { ReminderOverrideRule } from "../domain/calendars/reminderPlan";

// What the reminder sweep reads (appointments-2 slice 6), as the system: for
// every group where a current member has reminders on, its recipient, those
// members (address, leads, consent), the appointments and their
// assignees' open todos starting in a window, and those members' overrides.
// Not a model service: one sweep reads across groups with direct queries,
// like the outbox's. The sweep itself (planning, notify) is
// @caretook/notifications' `sweepReminders`.
//
// `calendars.lastReminderRunAt` is an app setting row the sweep keeps (not
// in the staff registry, APP_SETTINGS): locked for the sweep's transaction,
// so two runs at once queue up.

export const LAST_RUN_KEY = "calendars.lastReminderRunAt";

export type ReminderRecipientMember = {
  userId: string;
  email: string;
  leads: ReminderLead[];
  detailsConsent: boolean;
};

export type ReminderTodoInput = CalendarTodoInput & { assigneeId: string | null; createdAt: string };

export type ReminderGroupInputs = {
  groupId: string;
  recipient: { displayName: string; timeZone: string };
  groupAllowsDetails: boolean;
  members: ReminderRecipientMember[];
  entries: CalendarEntryInput[];
  todos: ReminderTodoInput[];
  overrides: ReminderOverrideRule[];
};

const query = <T>(fn: () => Promise<T>) => dbMayFail(fn, "calendarReminderService:query");

/** The last sweep's `now`, locked until `tx` ends; null before the first. */
export const lockLastRun = async (tx: Tx) => {
  const row = await appSettingModel.getForUpdate(tx, LAST_RUN_KEY);
  if (isError(row)) return row;
  const value = typeof row?.value === "string" ? Date.parse(row.value) : NaN;
  return Number.isFinite(value) ? new Date(value) : null;
};

/** Record this sweep's `now`. */
export const setLastRun = async (tx: Tx, now: Date) => {
  const put = await appSettingModel.put(tx, LAST_RUN_KEY, now.toISOString(), null);
  return isError(put) ? put : null;
};

const DAY_MS = 86_400_000;

/**
 * Every group with a member who has reminders on, and what its reminders
 * need, for items starting in `[from, to)` (all-day ones and todos by
 * their day, a day either side). Disabled accounts and former members are
 * left out (a member's settings also go when they leave).
 */
export const reminderInputs = async ({ from, to, tx }: { from: Date; to: Date; tx?: Tx }) => {
  const db = txOrDb(tx);
  const setting = memberCalendarSettingSchema;
  const members = await query(() =>
    db
      .select({
        groupId: setting.groupId,
        userId: setting.userId,
        email: userSchema.email,
        leads: setting.reminderLeads,
        consentAt: setting.detailsConsentAt,
        consentVersion: setting.detailsConsentVersion,
      })
      .from(setting)
      .innerJoin(
        careGroupMemberSchema,
        and(
          eq(careGroupMemberSchema.groupId, setting.groupId),
          eq(careGroupMemberSchema.userId, setting.userId),
        ),
      )
      .innerJoin(userSchema, eq(userSchema.id, setting.userId))
      .where(and(eq(setting.remindersOn, true), isNull(userSchema.disabledAt))),
  );
  if (isError(members)) return members;
  if (!members.length) return [] as ReminderGroupInputs[];

  const groupIds = [...new Set(members.map((m) => m.groupId))];
  const userIds = [...new Set(members.map((m) => m.userId))];
  const fromIso = new Date(from.getTime() - DAY_MS).toISOString();
  const toIso = to.toISOString();
  const fromDay = fromIso.slice(0, 10);
  const toDay = new Date(to.getTime() + DAY_MS).toISOString().slice(0, 10);

  const groups = await query(() =>
    db
      .select({
        groupId: careGroupSchema.id,
        allows: careGroupSchema.detailsOutsideAllowed,
        name: careRecipientSchema.name,
        preferredName: careRecipientSchema.preferredName,
        timeZone: careRecipientSchema.timeZone,
      })
      .from(careGroupSchema)
      .innerJoin(careRecipientSchema, eq(careRecipientSchema.groupId, careGroupSchema.id))
      .where(inArray(careGroupSchema.id, groupIds)),
  );
  if (isError(groups)) return groups;

  const entries = await query(() =>
    db
      .select()
      .from(timelineEntrySchema)
      .where(
        and(
          inArray(timelineEntrySchema.groupId, groupIds),
          eq(timelineEntrySchema.kind, "event"),
          isNull(timelineEntrySchema.deletedAt),
          gte(timelineEntrySchema.occurredAt, fromIso),
          lt(timelineEntrySchema.occurredAt, toIso),
        ),
      ),
  );
  if (isError(entries)) return entries;

  const entryIds = entries.map((e) => e.id);
  const providers = entryIds.length
    ? await query(() =>
        db
          .select({ entryId: timelineEntryProviderSchema.entryId, name: providerSchema.name })
          .from(timelineEntryProviderSchema)
          .innerJoin(
            providerSchema,
            and(
              eq(providerSchema.groupId, timelineEntryProviderSchema.groupId),
              eq(providerSchema.id, timelineEntryProviderSchema.providerId),
            ),
          )
          .where(
            and(inArray(timelineEntryProviderSchema.entryId, entryIds), isNull(providerSchema.deletedAt)),
          )
          .orderBy(providerSchema.name),
      )
    : [];
  if (isError(providers)) return providers;

  const todos = await query(() =>
    db
      .select()
      .from(todoSchema)
      .where(
        and(
          inArray(todoSchema.groupId, groupIds),
          inArray(todoSchema.assigneeId, userIds),
          isNull(todoSchema.deletedAt),
          isNull(todoSchema.doneAt),
          sql`${todoSchema.dueOn} BETWEEN ${fromDay} AND ${toDay}`,
        ),
      ),
  );
  if (isError(todos)) return todos;

  const overrides = await query(() =>
    db
      .select()
      .from(reminderOverrideSchema)
      .where(
        and(
          inArray(reminderOverrideSchema.groupId, groupIds),
          inArray(reminderOverrideSchema.userId, userIds),
        ),
      ),
  );
  if (isError(overrides)) return overrides;

  const namesOf = new Map<string, string[]>();
  for (const p of providers) namesOf.set(p.entryId, [...(namesOf.get(p.entryId) ?? []), p.name]);

  return groups.map((g): ReminderGroupInputs => ({
    groupId: g.groupId,
    recipient: { displayName: g.preferredName || g.name, timeZone: g.timeZone },
    groupAllowsDetails: g.allows,
    members: members
      .filter((m) => m.groupId === g.groupId)
      .map((m) => ({
        userId: m.userId,
        email: m.email,
        leads: m.leads,
        detailsConsent: hasDetailsConsent(m),
      })),
    entries: entries
      .filter((e) => e.groupId === g.groupId)
      .map((e) => ({ ...e, providers: namesOf.get(e.id) ?? [] })),
    todos: todos.filter((t) => t.groupId === g.groupId),
    overrides: overrides
      .filter((o) => o.groupId === g.groupId)
      .map((o) => ({ userId: o.userId, entryId: o.entryId, mode: o.mode, leads: o.leads })),
  }));
};
