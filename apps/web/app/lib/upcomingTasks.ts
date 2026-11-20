import type { TaskRuleFields } from "@caretook/data/schema";
import type { TimedEntry } from "./upcoming";
import type { UpcomingSection } from "./upcomingDays";
import type { UpcomingDose } from "./upcomingDoses";

import { localDate, taskState } from "@caretook/data/schema";
import { dayLabel } from "./format";
import { NOW_KEY } from "./upcomingDays";
import { isUpcomingDose } from "./upcomingDoses";
import { startOfDay, zonedInstant } from "./zonedDay";

// Open tasks with a due day in Upcoming, under their day among the
// appointments, reminders and due doses. Worked out, never written:
// completing a task drops it out. Due days and times are wall-clock in the
// recipient's zone (`taskState`); Upcoming's days are the viewer's, so a
// timed task is placed by the moment it falls, an all-day one by its own
// day (as all-day entries are). Pure; web:unit tests it.

/** One open dated task as an Upcoming item. */
export type UpcomingTask<T extends TaskRuleFields = TaskRuleFields> = {
  type: "dueTask";
  /** `task:<id>`: unique in the list. */
  key: string;
  task: T;
  state: "overdue" | "today" | "upcoming";
  /** The moment a timed task falls (ISO 8601), or null for an all-day one. */
  at: string | null;
};

/** Anything Upcoming lists with tasks merged in. */
export type WithTasks<T, K extends TaskRuleFields = TaskRuleFields> = T | UpcomingTask<K>;

export const isUpcomingTask = <T extends object>(item: T | UpcomingTask): item is UpcomingTask =>
  "type" in item && item.type === "dueTask";

/**
 * Open dated tasks as Upcoming items, in the order given (`taskOrder`).
 * Done and undated tasks are left out.
 */
export const upcomingTasks = <T extends TaskRuleFields>(
  tasks: readonly T[],
  now: Date | number,
  timeZone: string,
): UpcomingTask<T>[] =>
  tasks.flatMap((task) => {
    const state = taskState(task, now, timeZone);
    if (state === "done" || state === "undated" || !task.dueOn) return [];
    const at = task.dueTime ? zonedInstant(task.dueOn, task.dueTime, timeZone).toISOString() : null;
    return [{ type: "dueTask" as const, key: `task:${task.id}`, task, state, at }];
  });

/**
 * Whether tasks show with these filters: only unfiltered, like due doses
 * (a kind filter is a note or event kind, and an author filter is about who
 * wrote an entry).
 */
export const showsTasks = ({ kind, author }: { kind?: string | null; author?: string | null }) =>
  !kind && !author;

type Listed = TimedEntry | UpcomingDose | UpcomingTask;

/**
 * Where an item sits in its day: overdue tasks first, then all-day entries,
 * then all-day tasks, then timed items (doses, timed entries and tasks) by
 * the moment they fall.
 */
const rank = (item: Listed): { group: number; ms: number } => {
  if (isUpcomingTask(item)) {
    if (item.state === "overdue") return { group: 0, ms: 0 };
    return item.at ? { group: 3, ms: Date.parse(item.at) } : { group: 2, ms: 0 };
  }
  if (isUpcomingDose(item)) return { group: 3, ms: Date.parse(item.at) };
  return item.allDay ? { group: 1, ms: 0 } : { group: 3, ms: Date.parse(item.occurredAt) };
};

/** True when `item` goes after a task ranked `task` (on a tie the task comes after). */
const goesAfter = (task: { group: number; ms: number }, item: Listed) => {
  const other = rank(item);
  return other.group > task.group || (other.group === task.group && task.group === 3 && other.ms > task.ms);
};

/**
 * Upcoming's sections (`upcomingSections`, with due doses or not) with
 * `tasks` in them. An overdue task is listed under today, first; never under
 * "Now", which is for appointments in progress. A timed task goes under the
 * day it falls on where the viewer is, by its time; an all-day one under its
 * due day (today at the earliest), after the day's all-day entries. A day
 * with only tasks gets its own section, in day order. `tasks` come in
 * `taskOrder` and keep it among themselves.
 */
export function withDueTasks<T extends Listed, K extends TaskRuleFields>(
  sections: readonly UpcomingSection<T>[],
  tasks: readonly UpcomingTask<K>[],
  now: Date,
  viewerZone: string,
  taskZone: string,
  locale?: string,
): UpcomingSection<T | UpcomingTask<K>>[] {
  const out: UpcomingSection<T | UpcomingTask<K>>[] = sections.map((s) => ({ ...s, items: [...s.items] }));
  const today = localDate(now, viewerZone);
  const nowIso = now.toISOString();
  for (const task of tasks) {
    // The day's key, and a moment on it with the zone to label it in.
    let key: string;
    let on: [string, string];
    if (task.state === "overdue") {
      key = today;
      on = [nowIso, viewerZone];
    } else if (task.at) {
      key = localDate(task.at, viewerZone);
      on = [task.at, viewerZone];
    } else {
      const dueOn = task.task.dueOn!;
      key = dueOn > today ? dueOn : today;
      on = key === today ? [nowIso, viewerZone] : [startOfDay(key, taskZone).toISOString(), taskZone];
    }
    let section = out.find((s) => s.key === key);
    if (!section) {
      section = { key, label: dayLabel(on[0], on[1], now, locale), items: [] };
      const index = out.findIndex((s) => s.key !== NOW_KEY && s.key > key);
      if (index === -1) out.push(section);
      else out.splice(index, 0, section);
    }
    const placed = rank(task);
    const index = section.items.findIndex((item) => goesAfter(placed, item));
    if (index === -1) section.items.push(task);
    else section.items.splice(index, 0, task);
  }
  return out;
}
