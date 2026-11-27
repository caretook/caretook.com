import type { TodoRuleFields } from "@caretook/data/schema";
import type { TimedEntry } from "../appointments/upcoming";
import type { UpcomingSection } from "../appointments/upcomingDays";
import type { TodoTree, TodoTreeNode, TreeTodo } from "./todoTreeView";

import { listsOnItsOwn, localDate, todoOrder, todoState } from "@caretook/data/schema";
import { dayLabel } from "../core/format";
import { NOW_KEY } from "../appointments/upcomingDays";
import { startOfDay, zonedInstant } from "../core/zonedDay";
import { todoDayOf, todoDayTrees } from "./todoTreeView";

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

/**
 * One day's tree as a Planner item (todo-subtasks-3; `plannerDayTrees`):
 * `todo`, `state` and `at` are its lead's, the open todo the day is about
 * (the top-level todo on its own day, else the most urgent step due then),
 * so it's placed and ranked as that todo would be.
 */
export type PlannerTree<T extends TodoRuleFields = TodoRuleFields> = Omit<PlannerTodo<T>, "type"> & {
  type: "dueTree";
  /** "YYYY-MM-DD", or "overdue": the day view it was cut for (`todoDayTrees`). */
  day: string;
  tree: TodoTree<T>;
};

/** Anything the Planner lists with todos merged in. */
export type WithTodos<T, K extends TodoRuleFields = TodoRuleFields> = T | PlannerTodo<K>;

/** Anything the Planner lists with day trees merged in. */
export type WithTrees<T, K extends TodoRuleFields = TodoRuleFields> = T | PlannerTree<K>;

export const isPlannerTodo = <T extends object>(item: T | PlannerTodo): item is PlannerTodo =>
  "type" in item && item.type === "dueTodo";

export const isPlannerTree = <T extends object, K extends TodoRuleFields>(
  item: T | PlannerTree<K>,
): item is PlannerTree<K> => "type" in item && item.type === "dueTree";

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
 * The Planner's todos as trees (todo-subtasks-3): one item per day tree
 * (`todoDayTrees`) instead of one per todo, in `todoOrder` of their leads.
 * `trees` are `todoTrees`' (a match predicate's context rows never place a
 * tree). A tree goes under each day one of its open shown todos is due
 * (`todoDayOf`): on the top-level todo's own day the whole tree, on a step's
 * day that step's branch under its dimmed ancestors, and overdue steps'
 * branches with the overdue items. An undated tree with no dated step gives
 * nothing. `through` ("YYYY-MM-DD") drops the days after it (the Planner's
 * horizon); overdue is always kept.
 */
export const plannerDayTrees = <T extends TreeTodo>(
  trees: readonly TodoTree<T>[],
  now: Date | number,
  timeZone: string,
  { through }: { through?: string } = {},
): PlannerTree<T>[] => {
  const items = trees.flatMap((tree) => {
    const days = new Set<string>();
    const visit = (node: TodoTreeNode<T>) => {
      const day = node.context ? null : todoDayOf(node.todo, now, timeZone);
      if (day && (day === "overdue" || !through || day <= through)) days.add(day);
      node.children.forEach(visit);
    };
    visit(tree);
    return [...days].flatMap((day) =>
      todoDayTrees([tree], day, now, timeZone).flatMap((cut) => {
        const lead = cut.lead;
        const state = lead && todoState(lead, now, timeZone);
        if (!lead?.dueOn || (state !== "overdue" && state !== "today" && state !== "upcoming")) return [];
        const at = lead.dueTime ? zonedInstant(lead.dueOn, lead.dueTime, timeZone).toISOString() : null;
        const key = `tree:${tree.todo.id}:${day}`;
        return [{ type: "dueTree" as const, key, day, tree: cut, todo: lead, state, at }];
      }),
    );
  });
  const byLead = new Map(items.map((item) => [item.todo.id, item]));
  return todoOrder(
    items.map((item) => item.todo),
    now,
    timeZone,
  ).map((lead) => byLead.get(lead.id)!);
};

/**
 * Whether todos show with these filters: only unfiltered (a kind filter is
 * an event kind, and an author filter is about who
 * wrote an entry).
 */
export const showsTodos = ({ kind, author }: { kind?: string | null; author?: string | null }) =>
  !kind && !author;

/** A todo or a day tree, merged into the Planner's days. */
type Due = PlannerTodo | PlannerTree;
type Listed = TimedEntry | Due;

const isDue = (item: Listed): item is Due =>
  "type" in item && (item.type === "dueTodo" || item.type === "dueTree");

/**
 * Where an item sits in its day: overdue todos first, then all-day entries,
 * then all-day todos, then timed items (timed entries and todos) by
 * the moment they fall.
 */
const rank = (item: Listed): { group: number; ms: number } => {
  if (isDue(item)) {
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
 * `todoOrder` and keep it among themselves. Day trees (`plannerDayTrees`)
 * are placed the same way, by their lead.
 */
export function withDueTodos<T extends Listed, D extends Due>(
  sections: readonly UpcomingSection<T>[],
  todos: readonly D[],
  now: Date,
  viewerZone: string,
  todoZone: string,
  locale?: string,
): UpcomingSection<T | D>[] {
  const out: UpcomingSection<T | D>[] = sections.map((s) => ({ ...s, items: [...s.items] }));
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
