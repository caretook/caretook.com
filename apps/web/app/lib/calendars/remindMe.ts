import type { ReminderLead } from "@caretook/data/schema";
import type { ApiOutputs } from "../core/rpc";
import type { TimedEntry } from "../appointments/upcoming";

import { REMINDER_LEADS, reminderLeadLabel } from "@caretook/data/schema";
import { isUpcoming } from "../appointments/upcoming";

// The "Remind me" sheet's pure parts (appointments-2 slice 8): when an entry
// offers it, and the line that says what will be sent. The server stays the
// authority (`reminderOverrideService`, `planReminders`).

export type RemindChoice = ApiOutputs["calendars"]["overrides"]["get"];

/** The member's own settings the summary reads. */
export type RemindSettings = { remindersOn: boolean; reminderLeads: readonly ReminderLead[] };

export const REMIND_OFFLINE = "Needs a connection to change your reminders for this one.";

/** Events that are still to come and not cancelled or moved on (a note is never offered). */
export const canRemind = (entry: TimedEntry & { kind: string; rescheduledTo?: string | null }, now: Date) =>
  entry.kind === "event" && !entry.cancelledAt && !entry.rescheduledTo && isUpcoming(entry, now);

const list = (leads: readonly ReminderLead[]) => leads.map(reminderLeadLabel).join(" · ");

/** The leads that will send: the member's own plus an extra, in lead order, none when reminders are off. */
export const effectiveLeads = (choice: RemindChoice, settings: RemindSettings): ReminderLead[] => {
  if (!settings.remindersOn || choice.mode === "mute") return [];
  const extra = choice.mode === "extra" ? choice.leads : [];
  return REMINDER_LEADS.filter((lead) => settings.reminderLeads.includes(lead) || extra.includes(lead));
};

/** What this choice sends, in words ("Email: The evening before, at 18:00 · 1 h before"). */
export const remindSummary = (choice: RemindChoice, settings: RemindSettings): string => {
  if (choice.mode === "mute") return "No reminders for this one.";
  if (!settings.remindersOn)
    return "Your reminder emails are off, so nothing is sent for this one. Turn them on in Calendar & reminders.";
  const leads = effectiveLeads(choice, settings);
  if (!leads.length) return "Nothing is sent: pick at least one time.";
  return `Email: ${list(leads)}`;
};
