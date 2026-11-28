import type { ReminderLead } from "@caretook/data/schema";

import { MAX_REMINDER_LEADS } from "@caretook/data/schema";
import { REMINDER_LEADS, reminderLeadLabel } from "@caretook/data/domain";

// The Reminders card's pure parts (calendars, appointments-2 slice 6): the
// lead choices with the three-lead cap, and the wording. The server checks
// the same cap (reminderLeadsZSchema).

export const REMINDERS_EXPLAINED = "Emails before events and todos in this group, at the times you pick.";

export const TODOS_NOTE =
  "Todos assigned to you remind you the morning they're due, or 1 h before a due time.";

export const LEADS_CAP_NOTE = `Pick up to ${MAX_REMINDER_LEADS}.`;

export type LeadChoice = { lead: ReminderLead; label: string; checked: boolean; disabled: boolean };

/** Each lead as a checkbox: once three are picked, the others wait. */
export const leadChoices = (leads: readonly ReminderLead[]): LeadChoice[] => {
  const full = leads.length >= MAX_REMINDER_LEADS;
  return REMINDER_LEADS.map((lead) => {
    const checked = leads.includes(lead);
    return { lead, label: reminderLeadLabel(lead), checked, disabled: !checked && full };
  });
};

/** The leads after ticking or unticking one, in `REMINDER_LEADS` order, never more than three. */
export const withLead = (leads: readonly ReminderLead[], lead: ReminderLead, on: boolean): ReminderLead[] => {
  const next = on ? [...new Set([...leads, lead])] : leads.filter((l) => l !== lead);
  if (next.length > MAX_REMINDER_LEADS) return [...leads];
  return REMINDER_LEADS.filter((l) => next.includes(l));
};
