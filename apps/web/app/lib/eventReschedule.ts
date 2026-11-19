import type { Schedule } from "./entrySchedule";
import type { TimedEntry } from "./upcoming";

import { withStart } from "./entrySchedule";
import { isUpcoming } from "./upcoming";

// Rescheduling an event: the sheet's rules. Pure; unit-tested in web:unit.
// The write itself is `rescheduleEvent` in lib/sync/appointments.ts.

const ms = (iso: string) => new Date(iso).getTime();

/** An event's schedule, as the reschedule sheet starts it. */
export const scheduleOf = (entry: { occurredAt: string; endsAt?: string | null; allDay?: boolean }) => ({
  occurredAt: entry.occurredAt,
  endsAt: entry.allDay ? null : (entry.endsAt ?? null),
  allDay: !!entry.allDay,
});

/**
 * A new start that keeps the event's length: its end moves with it (a
 * 45-minute visit stays 45 minutes). An all-day event keeps to the start of
 * the day picked, in the entry's zone.
 */
export const withMovedStart = (schedule: Schedule, occurredAt: string, timeZone: string): Schedule => {
  const moved = withStart(schedule, occurredAt, timeZone);
  if (!schedule.endsAt || schedule.allDay) return moved;
  const length = ms(schedule.endsAt) - ms(schedule.occurredAt);
  return { ...moved, endsAt: new Date(ms(moved.occurredAt) + length).toISOString() };
};

/**
 * Whether "Keep the old one as cancelled" starts on: for an event still to
 * come (or under way), and for one already cancelled (moving a cancelled
 * event's time alone would leave it cancelled). Off for a past event, whose
 * new time is usually a correction.
 */
export const keepOldByDefault = (entry: TimedEntry, now: Date) =>
  !!entry.cancelledAt || isUpcoming(entry, now);

/** Whether an entry can be rescheduled: an event not already rescheduled to another. */
export const canReschedule = (entry: { kind: string; rescheduledTo?: string | null }) =>
  entry.kind === "event" && !entry.rescheduledTo;
