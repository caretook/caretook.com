import type { ReminderGroupInputs } from "@caretook/data";
import type { ShareLevel } from "@caretook/data/schema";
import type { ReminderEmailData } from "./templates/reminders";
import type { Sender } from "./senders";

import {
  calendarReminderService,
  calendarSettingService,
  isError,
  logError,
  newError,
  withTransaction,
} from "@caretook/data";
import { shareLevel } from "@caretook/data/schema";
import { deliverSoon, notify } from "./outbox";
import { reminderUnsubscribePath } from "./templates/reminders";
import type { ReminderItem, ReminderSend } from "@caretook/data/domain";
import { calendarItems, calendarText, planReminders } from "@caretook/data/domain";

// The reminder sweep (appointments-2 slice 6), the calendar cron's first
// step. Each run, in one transaction: lock `calendars.lastReminderRunAt`,
// read every group where a member has reminders on, plan the sends due
// since the last run (`planReminders`: at most 6 h back), queue each through
// `notify` (its key makes a repeat run queue nothing), and record this run.
// Delivery starts after the commit. Members have no zone of their own yet,
// so the recipient's zone is theirs.

/** How far ahead items are read: an evening-before reminder can be 31 h ahead of its item. */
export const REMINDER_LOOKAHEAD_MS = 48 * 60 * 60_000;

export type ReminderSweepResult = {
  groups: number;
  planned: number;
  queued: number;
  /** Sends whose data didn't render (logged, skipped). */
  failed: number;
  /** This run's queued outbox rows (delivered after the commit unless `deliver: false`). */
  ids: string[];
};

/** A send's email: generic or detailed per `level`, its times in the member's zone. */
export const reminderEmailData = (
  send: Pick<ReminderSend, "item" | "timeZone">,
  level: ShareLevel,
  unsubscribePath: string,
): ReminderEmailData => {
  const text = calendarText(send.item, level, send.timeZone);
  return {
    summary: text.summary,
    when: text.when,
    location: text.location,
    providers: level === "details" ? [...send.item.providers] : [],
    recipientName: send.item.recipientName,
    itemPath: send.item.appUrl,
    unsubscribePath,
  };
};

/** One group's items in the window, as the planner reads them (links as app paths). */
const itemsOf = (group: ReminderGroupInputs, from: Date, to: Date): ReminderItem[] => {
  const made = new Map<string, string>();
  for (const e of group.entries) made.set(`entry:${e.id}`, e.createdAt);
  for (const t of group.todos) made.set(`todo:${t.id}`, t.createdAt);
  return calendarItems({
    entries: group.entries,
    todos: group.todos,
    recipient: group.recipient,
    from,
    to,
    appUrl: "",
  }).map((item) => ({ ...item, createdAt: made.get(item.uid) ?? item.start }));
};

/**
 * One run: plan and queue the reminders due in `(lastRun, now]`. Returns
 * what it did, or an error when the reads or the outbox fail (nothing is
 * recorded then, so the next run catches up).
 */
export const sweepReminders = async (
  now: Date = new Date(),
  { deliver = true, sender }: { deliver?: boolean; sender?: Sender } = {},
) => {
  const result = await withTransaction(
    async (tx): Promise<ReminderSweepResult | ReturnType<typeof newError>> => {
      const lastRun = await calendarReminderService.lockLastRun(tx);
      if (isError(lastRun)) return lastRun;
      const summary: ReminderSweepResult = { groups: 0, planned: 0, queued: 0, failed: 0, ids: [] };
      // A run that arrives after a later one has nothing left to do.
      if (lastRun && lastRun >= now) return summary;

      const to = new Date(now.getTime() + REMINDER_LOOKAHEAD_MS);
      const groups = await calendarReminderService.reminderInputs({ from: now, to, tx });
      if (isError(groups)) return groups;

      for (const group of groups) {
        summary.groups++;
        const members = new Map(group.members.map((m) => [m.userId, m]));
        const sends = planReminders({
          items: itemsOf(group, now, to),
          settings: group.members.map((m) => ({
            userId: m.userId,
            remindersOn: true,
            leads: m.leads,
            timeZone: group.recipient.timeZone,
          })),
          overrides: group.overrides,
          assignees: Object.fromEntries(group.todos.map((t) => [t.id, t.assigneeId])),
          now,
          lastRun,
        });
        summary.planned += sends.length;

        for (const send of sends) {
          const member = members.get(send.userId);
          if (!member) continue;
          const unsubscribe = reminderUnsubscribePath(send.userId, send.groupId);
          if (!unsubscribe) return newError({ code: "calendarReminderService:noKey" });
          const level = shareLevel({
            memberConsent: member.detailsConsent,
            groupAllowsDetails: group.groupAllowsDetails,
          });
          const queued = await notify(send.item.kind === "todo" ? "todoDue" : "appointmentReminder", {
            to: member.email,
            data: reminderEmailData(send, level, unsubscribe),
            idempotencyKey: send.key,
            expiresAt: send.expiresAt,
            tx,
          });
          if (isError(queued)) {
            // A failed write leaves the transaction unusable: stop, and the next run retries.
            if (queued.code === "notify:enqueue") return queued;
            summary.failed++;
            logError("reminders: a reminder didn't render", queued, { recordId: send.item.source.id });
            continue;
          }
          if (queued.created) {
            summary.queued++;
            summary.ids.push(queued.id);
          }
        }
      }

      const recorded = await calendarReminderService.setLastRun(tx, now);
      return isError(recorded) ? recorded : summary;
    },
  );
  if (!isError(result) && deliver) deliverSoon(result.ids, { sender });
  return result;
};

// ---------------------------------------------------------------------------
// The unsubscribe link (web only: /api/reminders/unsubscribe/:token)
// ---------------------------------------------------------------------------

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Caretook</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.25rem">${title}</h1>${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

const notValid = () =>
  page(
    "This link isn't valid",
    "<p>Turn reminder emails off in Caretook, under Calendar &amp; reminders.</p>",
    404,
  );

/**
 * GET shows a button (so a mail scanner opening the link changes nothing);
 * POST turns the member's reminders off in that group, from that button or
 * a mail app's one-click unsubscribe (RFC 8058). No sign-in: the signed
 * token is the proof. Group ids are UUIDs, so nothing here needs escaping.
 */
export const handleReminderUnsubscribe = async (request: Request, token: string) => {
  if (request.method === "GET" || request.method === "HEAD") {
    if (!calendarSettingService.isUnsubscribeToken(token)) return notValid();
    return page(
      "Turn off reminder emails?",
      `<p>You'll stop getting reminder emails for this care group. You can turn them on again in Caretook, under Calendar &amp; reminders.</p><form method="post"><button type="submit" style="font:inherit;padding:.5rem 1rem">Turn off reminder emails</button></form>`,
    );
  }
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  const done = await calendarSettingService.unsubscribeReminders(token);
  if (isError(done)) {
    if (done.code === "calendarSettingService:badUnsubscribe") return notValid();
    logError("reminders: unsubscribe failed", done);
    return page("Something went wrong", "<p>Try the link again in a minute.</p>", 500);
  }
  const settings = `/app/groups/${done.groupId}/settings/calendar`;
  return page(
    "Reminder emails are off",
    `<p>You won't get reminder emails for this care group. <a href="${settings}">Turn them on again</a> under Calendar &amp; reminders.</p>`,
  );
};
