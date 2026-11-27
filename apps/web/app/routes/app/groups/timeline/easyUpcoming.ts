import type { TimedEntry } from "../../../../lib/appointments/upcoming";
import type { PlannerTree } from "../../../../lib/todos/plannerTodos";
import type { TreeTodo } from "../../../../lib/todos/todoTreeView";
import type { EntryFilters, LocalQuery } from "../../../../lib/timeline/timeline.sync";

import { upcomingSections } from "../../../../lib/appointments/upcomingDays";
import { plannerDayTrees, withDueTodos } from "../../../../lib/todos/plannerTodos";
import { todoTrees } from "../../../../lib/todos/todoTreeView";
import { inUpcomingHorizon, upcomingQueries } from "../planner/upcomingQueries";

// Easy mode's opened Upcoming list (`useEasyUpcoming`), pure so web:unit tests it.

/** How many items easy mode's Upcoming block lists when opened; "See all" opens the rest. */
export const EASY_UPCOMING_CAP = 5;

const NO_FILTERS: EntryFilters = { kind: null, author: null };

/**
 * The list's local query: the Planner's Upcoming entries, unfiltered
 * (`upcomingQueries`, built from the start of `now`'s UTC day), so it
 * changes once a day, never on the clock's tick (B-963), and is the same
 * watch as an open Planner's.
 */
export const easyUpcomingQuery = (groupId: string, now: Date | number): LocalQuery =>
  upcomingQueries(groupId, NO_FILTERS, now).entries;

/**
 * The first `EASY_UPCOMING_CAP` items in Upcoming's order at `now`: the
 * query's rows split by the live clock (what has passed leaves, what is past
 * the horizon waits), its sections with the todos merged in as the
 * Planner's day trees (`plannerDayTrees`; todo-subtasks-3): `todos` are the
 * trees' rows (`todoTreesQuery`), cut per day through `through` (the
 * horizon's last day, "YYYY-MM-DD"); a parent's tree on its day, a step's
 * branch under its ancestors on the step's.
 */
export const easyUpcomingItems = <E extends TimedEntry, K extends TreeTodo>(
  entries: readonly E[],
  todos: readonly K[],
  now: Date,
  viewerZone: string,
  todoZone: string,
  through?: string,
): (E | PlannerTree<K>)[] => {
  const sections = upcomingSections(
    entries.filter((e) => inUpcomingHorizon(e, now)),
    now,
    viewerZone,
  );
  const trees = plannerDayTrees(todoTrees(todos, { now, timeZone: todoZone }), now, todoZone, { through });
  return withDueTodos(sections, trees, now, viewerZone, todoZone)
    .flatMap((section) => section.items)
    .slice(0, EASY_UPCOMING_CAP);
};
