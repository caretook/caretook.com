import type { CalendarItem } from "./calendarItems";
import type { ReminderLead, ReminderOverrideMode } from "../../db/schema/calendars/calendarRules";

import { addDays, dayStart, localDate } from "../core/entryTiming";
import { zonedInstant } from "../core/zonedDay";

// Reminder planning (appointments-2, B-61): which reminder sends are due
// between the last run and now. Pure and client-safe, so the "Remind me"
// sheet can say what will be sent. The calendar cron's `sweepReminders`
// feeds it a group's items and members' settings and notifies each send.
//
// - Appointments go to members with reminders on, at their
//   leads plus an override's extras, minus a mute.
// - A todo goes to its assignee (a member with reminders on) only: the
//   morning of its due day, or 1 h before its due time.
// - Leads are worked out in the member's zone: the evening before is 18:00
//   the day before, the morning of 7:00. All-day items take only those two;
//   a timed lead on one falls back to the evening before.
// - Nothing for cancelled items, items that have started, sends that were
//   already past when the item was made, or anyone not in `settings`
//   (former members).
// - The key is (recipient, item uid, lead, start), so a moved visit sends
//   again and a repeated run sends nothing.

/**
 * When a reminder goes, before an item starts: the evening before (18:00),
 * the morning of (7:00), or 120, 60 or 30 minutes before. Worked out in the
 * member's own zone.
 */
export const REMINDER_LEADS = ["eveningBefore", "morningOf", 120, 60, 30] as const;

/** How far back a late run catches up. Sends older than this are dropped. */
export const REMINDER_CATCH_UP_MS = 6 * 60 * 60_000;

/** Every send names its channel, so push can be added beside email later. */
export const REMINDER_CHANNELS = ["email"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

/** The lead a todo's reminder uses: the morning of its due day, or 1 h before its time. */
export const TODO_LEADS = { allDay: "morningOf", timed: 60 } as const satisfies Record<string, ReminderLead>;

const LEAD_LABELS: Record<string, string> = {
  eveningBefore: "The evening before, at 18:00",
  morningOf: "The morning of, at 7:00",
  120: "2 h before",
  60: "1 h before",
  30: "30 min before",
};

/** A lead as the settings say it: "The evening before, at 18:00", "1 h before". */
export const reminderLeadLabel = (lead: ReminderLead) => LEAD_LABELS[String(lead)] ?? String(lead);

/** A member as the planner sees them: only current members are passed. */
export type ReminderMember = {
  userId: string;
  remindersOn: boolean;
  leads: readonly ReminderLead[];
  /** The zone the evening before and the morning of are read in. */
  timeZone: string;
};

/** A member's choice for one appointment or reminder (the "Remind me" sheet). */
export type ReminderOverrideRule = {
  userId: string;
  entryId: string;
  mode: ReminderOverrideMode;
  leads: readonly ReminderLead[] | null;
};

/** A calendar item and when it was made (a send already past then is never sent). */
export type ReminderItem = CalendarItem & { createdAt: string };

export type PlanRemindersArgs = {
  items: readonly ReminderItem[];
  settings: readonly ReminderMember[];
  overrides: readonly ReminderOverrideRule[];
  /** Each todo's assignee (a user id), by todo id. Free-text and unassigned todos have none. */
  assignees: Readonly<Record<string, string | null | undefined>>;
  now: Date;
  /** The previous run's `now`; none (the first run) catches up the full 6 h. */
  lastRun: Date | null;
};

export type ReminderSend = {
  /** The idempotency key: `reminder:<user>:<group>:<item uid>:<lead>:<start>`. */
  key: string;
  channel: ReminderChannel;
  userId: string;
  groupId: string;
  item: ReminderItem;
  /** The lead used (after the all-day fallback). */
  lead: ReminderLead;
  /** When it's due, ISO. */
  sendAt: string;
  /** When it's no use any more, ISO: it must not be delivered from then on. */
  expiresAt: string;
  /** The member's zone, for the times in the message. */
  timeZone: string;
};

/**
 * The idempotency key of one send: recipient, group, item, lead and the
 * item's start, so a moved item has a new key.
 */
export const reminderKey = (send: {
  userId: string;
  groupId: string;
  uid: string;
  lead: ReminderLead;
  start: string;
}) => `reminder:${send.userId}:${send.groupId}:${send.uid}:${send.lead}:${send.start}`;

/** The recipient and group a reminder key names, or null when it isn't one. */
export const readReminderKey = (key: string) => {
  const [kind, userId, groupId] = key.split(":");
  return kind === "reminder" && userId && groupId ? { userId, groupId } : null;
};

/** When a reminder is no use any more: a timed item's start, or the end of an all-day item's first day. */
const tooLateAt = (item: ReminderItem) =>
  item.allDay ? dayStart(addDays(item.start, 1), item.timeZone) : Date.parse(item.start);

/** A lead on this item: all-day items take only the evening before and the morning of. */
const leadFor = (item: ReminderItem, lead: ReminderLead): ReminderLead =>
  item.allDay && typeof lead === "number" ? "eveningBefore" : lead;

/**
 * When `lead` falls for `item` in `timeZone`, as epoch ms, or null when it
 * would be too late (at or after a timed item's start, or after an all-day
 * item's first day).
 */
export const reminderSendAt = (item: ReminderItem, lead: ReminderLead, timeZone: string) => {
  const used = leadFor(item, lead);
  const day = item.allDay ? item.start : localDate(item.start, timeZone);
  let at: number;
  if (used === "eveningBefore") at = zonedInstant(addDays(day, -1), "18:00", timeZone).getTime();
  else if (used === "morningOf") at = zonedInstant(day, "07:00", timeZone).getTime();
  else at = Date.parse(item.start) - used * 60_000;
  return at < tooLateAt(item) ? at : null;
};

const inLeadOrder = (leads: Iterable<ReminderLead>) => {
  const set = new Set(leads);
  return REMINDER_LEADS.filter((lead) => set.has(lead));
};

/** The sends due in `(lastRun, now]` (no further back than 6 h), soonest first. */
export const planReminders = ({
  items,
  settings,
  overrides,
  assignees,
  now,
  lastRun,
}: PlanRemindersArgs): ReminderSend[] => {
  const nowMs = now.getTime();
  const from = Math.max(lastRun?.getTime() ?? -Infinity, nowMs - REMINDER_CATCH_UP_MS);
  const members = new Map(settings.filter((m) => m.remindersOn).map((m) => [m.userId, m]));
  const rules = new Map(overrides.map((o) => [`${o.userId}:${o.entryId}`, o]));
  const sends: ReminderSend[] = [];

  const add = (item: ReminderItem, member: ReminderMember, leads: Iterable<ReminderLead>) => {
    // Nothing for an item that has started (all-day: once its first day is over).
    if (tooLateAt(item) <= nowMs) return;
    const made = Date.parse(item.createdAt);
    const used = new Set<ReminderLead>();
    for (const lead of inLeadOrder(leads)) {
      const effective = leadFor(item, lead);
      if (used.has(effective)) continue;
      used.add(effective);
      const at = reminderSendAt(item, effective, member.timeZone);
      if (at === null || at <= from || at > nowMs || at < made) continue;
      sends.push({
        key: reminderKey({
          userId: member.userId,
          groupId: item.groupId,
          uid: item.uid,
          lead: effective,
          start: item.start,
        }),
        channel: "email",
        userId: member.userId,
        groupId: item.groupId,
        item,
        lead: effective,
        sendAt: new Date(at).toISOString(),
        expiresAt: new Date(tooLateAt(item)).toISOString(),
        timeZone: member.timeZone,
      });
    }
  };

  for (const item of items) {
    if (item.status === "cancelled") continue;
    if (item.kind === "todo") {
      const assignee = assignees[item.source.id];
      const member = assignee ? members.get(assignee) : undefined;
      if (member) add(item, member, [item.allDay ? TODO_LEADS.allDay : TODO_LEADS.timed]);
      continue;
    }
    for (const member of members.values()) {
      const rule = rules.get(`${member.userId}:${item.source.id}`);
      if (rule?.mode === "mute") continue;
      const extra = rule?.mode === "extra" ? (rule.leads ?? []) : [];
      add(item, member, [...member.leads, ...extra]);
    }
  }

  return sends.sort((a, b) => a.sendAt.localeCompare(b.sendAt) || a.key.localeCompare(b.key));
};
