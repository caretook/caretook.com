import type { TodoRuleFields } from "@caretook/data/schema";
import type { TimedEntry } from "../appointments/upcoming";
import type { UpcomingSection } from "../appointments/upcomingDays";

import { listsOnItsOwn, localDate, todoState } from "@caretook/data/schema";
import { dayLabel } from "../core/format";
import { NOW_KEY } from "../appointments/upcomingDays";
import { startOfDay, zonedInstant } from "../core/zonedDay";

// Open todos with a due day in the Planner, under their day among the
// appointments. Worked out, never written:
// completing a todo drops it out. Due days and times are wall-clock in the
// recipient's zone (`todoState`); the Planner's days are the viewer's, so a
// timed todo is placed by the moment it falls, an all-day one by its own
// day (as all-day entries are). Pure; web:unit tests it.

/** One open dated todo as a Planner item. */
export type PlannerTodo<T extends TodoRuleFields = TodoRuleFields> = {
  type: "dueTodo";
  /** `todo:<id>`: unique in the list. */
  key: string;
  todo: T;
  state: "overdue" | "today" | "upcoming";
  /** The moment a timed todo falls (ISO 8601), or null for an all-day one. */
  at: string | null;
};

/** Anything the Planner lists with todos merged in. */
export type WithTodos<T, K extends TodoRuleFields = TodoRuleFields> = T | PlannerTodo<K>;

export const isPlannerTodo = <T extends object>(item: T | PlannerTodo): item is PlannerTodo =>
  "type" in item && item.type === "dueTodo";

/**
 * Open dated todos as Planner items, in the order given (`todoOrder`).
 * Done and undated todos are left out, and a subtask that doesn't list on
 * its own (`listsOnItsOwn`; todo-subtasks-2), which shows on its parent's page.
 */
export const plannerTodos = <T extends TodoRuleFields & { parentId?: string | null }>(
  todos: readonly T[],
  now: Date | number,
  timeZone: string,
): PlannerTodo<T>[] =>
  todos.flatMap((todo) => {
    const state = todoState(todo, now, timeZone);
    if (state === "done" || state === "undated" || !todo.dueOn || !listsOnItsOwn(todo)) return [];
    const at = todo.dueTime ? zonedInstant(todo.dueOn, todo.dueTime, timeZone).toISOString() : null;
    return [{ type: "dueTodo" as const, key: `todo:${todo.id}`, todo, state, at }];
  });

/**
 * Whether todos show with these filters: only unfiltered (a kind filter is
 * an event kind, and an author filter is about who
 * wrote an entry).
 */
export const showsTodos = ({ kind, author }: { kind?: string | null; author?: string | null }) =>
  !kind && !author;

type Listed = TimedEntry | PlannerTodo;

/**
 * Where an item sits in its day: overdue todos first, then all-day entries,
 * then all-day todos, then timed items (timed entries and todos) by
 * the moment they fall.
 */
const rank = (item: Listed): { group: number; ms: number } => {
  if (isPlannerTodo(item)) {
    if (item.state === "overdue") return { group: 0, ms: 0 };
    return item.at ? { group: 3, ms: Date.parse(item.at) } : { group: 2, ms: 0 };
  }
  return item.allDay ? { group: 1, ms: 0 } : { group: 3, ms: Date.parse(item.occurredAt) };
};

/** True when `item` goes after a todo ranked `todo` (on a tie the todo comes after). */
const goesAfter = (todo: { group: number; ms: number }, item: Listed) => {
  const other = rank(item);
  return other.group > todo.group || (other.group === todo.group && todo.group === 3 && other.ms > todo.ms);
};

/**
 * The Planner's sections (`upcomingSections`) with
 * `todos` in them. An overdue todo is listed under today, first; never under
 * "Now", which is for appointments in progress. A timed todo goes under the
 * day it falls on where the viewer is, by its time; an all-day one under its
 * due day (today at the earliest), after the day's all-day entries. A day
 * with only todos gets its own section, in day order. `todos` come in
 * `todoOrder` and keep it among themselves.
 */
export function withDueTodos<T extends Listed, K extends TodoRuleFields>(
  sections: readonly UpcomingSection<T>[],
  todos: readonly PlannerTodo<K>[],
  now: Date,
  viewerZone: string,
  todoZone: string,
  locale?: string,
): UpcomingSection<T | PlannerTodo<K>>[] {
  const out: UpcomingSection<T | PlannerTodo<K>>[] = sections.map((s) => ({ ...s, items: [...s.items] }));
  const today = localDate(now, viewerZone);
  const nowIso = now.toISOString();
  for (const todo of todos) {
    // The day's key, and a moment on it with the zone to label it in.
    let key: string;
    let on: [string, string];
    if (todo.state === "overdue") {
      key = today;
      on = [nowIso, viewerZone];
    } else if (todo.at) {
      key = localDate(todo.at, viewerZone);
      on = [todo.at, viewerZone];
    } else {
      const dueOn = todo.todo.dueOn!;
      key = dueOn > today ? dueOn : today;
      on = key === today ? [nowIso, viewerZone] : [startOfDay(key, todoZone).toISOString(), todoZone];
    }
    let section = out.find((s) => s.key === key);
    if (!section) {
      section = { key, label: dayLabel(on[0], on[1], now, locale), items: [] };
      const index = out.findIndex((s) => s.key !== NOW_KEY && s.key > key);
      if (index === -1) out.push(section);
      else out.splice(index, 0, section);
    }
    const placed = rank(todo);
    const index = section.items.findIndex((item) => goesAfter(placed, item));
    if (index === -1) section.items.push(todo);
    else section.items.splice(index, 0, todo);
  }
  return out;
}
