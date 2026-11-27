# Plan: Subtasks you can see and add where you work

> Source PRD: [`plans/todo-subtasks-3-prd.md`](todo-subtasks-3-prd.md). User-story numbers (US) refer to it. Backlog items B-941, B-942, B-943. Topic `todo-subtasks-3`, after [`todo-subtasks-2`](todo-subtasks-2-plan.md).

## Status

**Planned 2026-11-27.** Not started. Seven slices (one over the usual six: the skeptic's send-back s67 split the tree slice and added the calendars one; each is small).

| Slice | Wave | State | Merge into `prd/todo-subtasks-3` (slice commits) |
| ----- | ---- | ----- | ------------------------------------------------ |
| 1     | 1    | —     |                                                  |
| 2     | 2    | —     |                                                  |
| 3     | 3    | —     |                                                  |
| 4     | 1    | —     |                                                  |
| 5     | 2    | —     |                                                  |
| 6     | 3    | —     |                                                  |
| 7     | 4    | —     |                                                  |

## Architectural decisions

- **No migration, no sync rule change, no API contract change.** `parent_id`, the tree rules and the group progress query exist (todo-subtasks); these slices change rules and screens.
- **The tree rules stay in the one pure module** (`packages/data/src/db/schema/todos/todoTree.ts`): the service, the calendars and the device call them; none re-derives a due limit, a listing rule or an order.
- **The server clamps, never refuses** the due rule, so an upload never fails on it; the device refuses only an edit that changes the due day.
- **Inherited dates land only after the listing rule and the calendars ignore them** (slices 1 and 2 before 3), so nothing floods the Planner, the Today card or anyone's calendar in between.
- **One live query per list, never one per row.** Trees are built on the device from the list's rows.
- **One shared row, tree and quick add** (`components/todos`): `TodoRow`, `TodoTree`, `TodoQuickAdd`. The todo page, the Todos page, the Planner and todo-links' B-948 use them; an exception needs a reason written in its slice.
- **fixes-perf's hot folders stay untouched:** the Easy view (`routes/app/groups/timeline/useEasyTodos.ts`) and the Today card pick up the listing rule through `listed: true` and `todoStrip`; no slice edits `routes/app/groups/timeline/` or `lib/sync/`.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 (slices 1, 4) → 2 (slices 2, 5) → 3 (slices 3, 6) → 4 (slice 7). Slices 3 and 6 both touch `lib/todos/todos.sync.ts` in different functions (3: `createTodo`, `updateTodo`, `subtasksQuery`; 6: a new query); merge 3 first.
- **Gates:** the quick check; integration tests in slices 2 and 3 (no stack needed).
- **Docs at landing:** [todos](../docs/domain/todos.md) every wave; [components](../docs/domain/components.md) at waves 1, 2 (the shared pieces); [appointments](../docs/domain/appointments.md) and [timeline](../docs/domain/timeline.md) at wave 1 (the listing rule); [calendars](../docs/domain/calendars.md), [connectors](../docs/domain/connectors.md) and [notifications](../docs/domain/notifications.md) (reminders unchanged for subtasks) at wave 2.
- **When it's done:** `pnpm prd rm todo-subtasks-3`.

---

## Slice 1: A subtask lists on its own only when assigned or due before its parent

Stack: no · Reads: docs/domain/todos.md, docs/domain/appointments.md, docs/domain/timeline.md · Tests: unit, component

**Backlog:** B-943 (prep). **User stories:** 12, 13.

**What to build:** `listsOnItsOwn` (`todoTree.ts`) takes the parent's due day: a subtask lists on its own when assigned, or dated before the parent's day (an undated parent: any date counts). New pure `siblingOrder` there too: dated before undated; dated by day, then on one day timed ones by time before day-only ones; then by `createdAt`, `id` (in SQL: `due_on IS NULL, due_on, due_time IS NULL, due_time, created_at, id`). The device's queries carry the parent's day as a correlated subquery, `(SELECT p.due_on FROM todo p WHERE p.id = todo.parent_id) AS parent_due_on` (never a join: `whoCondition`'s columns are unqualified), in `todos.sync.ts` `todosQuery`, `dueTodosQuery` and `LISTED_SQL` (which `doneCountQuery` uses); `LISTED_SQL` spells the undated parent out: `parent_id IS NULL OR` assigned `OR (due_on IS NOT NULL AND (parent_due_on IS NULL OR due_on < parent_due_on))`. `toTodo` maps it to `parentDueOn`. `plannerTodos` and `todoStrip` pass it. **The Todos page's open list keeps the old rule** until slice 6 replaces it with trees: `todoList.ts` `todoSections` calls `listsOnItsOwn` without the parent's day (the old rule), so no subtask vanishes from that page between waves.

**Acceptance criteria:**

- [ ] Unit (`todoTree.test.ts`): a subtask on its parent's day doesn't list; one a day earlier does; an assigned one does; one under an undated parent with a date does; `siblingOrder` puts dated before undated, then by created.
- [ ] Unit (`plannerTodos.test.ts`, `todoStrip.test.ts`): a child on its parent's day is left out.
- [ ] Unit (`todoList.test.ts`): the Todos page still sections a subtask due on its parent's day (old rule).
- [ ] Component (`todos.sync.browser.test.tsx`): `todosQuery` rows carry `parentDueOn`; the Done list's `listed` and `doneCountQuery` follow the new rule, a dated subtask under an undated parent included.

**Blocked by:** none. **Blocks:** 2, 3.

---

## Slice 2: No subtasks on calendars

Stack: no · Reads: docs/domain/todos.md, docs/domain/calendars.md, docs/domain/connectors.md, docs/domain/notifications.md · Tests: unit, integration

**Backlog:** B-943 (the user's word, 2026-11-27). **User stories:** 14.

**What to build:** `calendarItems` (`packages/data/src/db/schema/calendars/calendarItems.ts`) is left as it is: the reminder sweep (`packages/notifications/src/reminders.ts` `itemsOf`) calls it too, and an assigned subtask keeps its "todo due" email. Instead the feed (`calendarFeedService`) and the Google push (`calendarSyncService` `groupItems`) leave todos with a `parentId` out where they load their todos. No new delete code: the push's `planPush` already deletes a linked event whose item is gone, and the daily sweep queues a push, so held subtask events leave members' Google calendars within a day (`pullPlan` ignores Google's echo, the link row being gone). The connectors' `upcoming` tool (`packages/api/src/connectors/tools/upcoming.ts`) uses `listsOnItsOwn` with the parent's day.

**Acceptance criteria:**

- [ ] Integration (`calendarFeedService`, `googleCalendar.int.test.ts`): the feed leaves a dated subtask out and keeps its parent; a held Google event for a subtask is deleted at the next push, a top-level todo's kept.
- [ ] Unit or integration (`packages/notifications` reminders tests): an assigned, dated subtask still gets its "todo due" reminder.
- [ ] Integration (connectors read tools test): `upcoming` leaves out a subtask on its parent's day, keeps an assigned one.

**Blocked by:** 1. **Blocks:** 3.

---

## Slice 3: Subtask due dates: inherit, never after the parent, sorted

Stack: no · Reads: docs/domain/todos.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: unit, integration, component

**Backlog:** B-943. **User stories:** 9, 10, 11, 12.

**What to build:** pure rules in `todoTree.ts` (new): `inheritedDue`, `clampDue` (capped at the parent's day, taking its time when capped). `todoService` `create` (also through `upsert`'s first write; an upload's edit is a PATCH to `update`): no due given and a parent → the parent's day and time; then clamp. `update`: a subtask's day after its parent's is clamped; a parent given any new day (moved, or a first day) clamps its open live descendants, all levels, in the transaction, each through the service's own update write (so each queues its calendar push); clearing the day changes none. Device (`todos.sync.ts`): `createTodo` inherits; `updateTodo` refuses only a patch that changes a subtask's `dueOn` to after its parent's (`todos:dueAfterParent`, shown by `TodoForm` on the due field), clamps any other edit of a late subtask, and writes the descendants' clamps in the parent's transaction; `subtasksQuery` orders by `siblingOrder`'s SQL exactly (slice 1).

**Acceptance criteria:**

- [ ] Unit (`todoTree.test.ts`): `clampDue` caps and takes the time; same day kept; undated parent no cap; `inheritedDue` of an undated parent is none.
- [ ] Integration (`todoService` tests): create inherits; create (and upsert's first write) and update past the parent are clamped, not refused; a parent moved earlier, and an undated parent given a day, clamp open descendants two levels down and leave done ones; clearing the parent's day changes nothing.
- [ ] Component (`todoSubtasks.sync.browser.test.tsx`): the device inherits; refuses a due change past the parent with the issue; a title-only edit of an already-late subtask saves (clamped); the cascade is one transaction.

**Blocked by:** 1, 2. **Blocks:** 6, 7.

---

## Slice 4: One shared row and quick add

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**Backlog:** B-942. **User stories:** 5, 7, 8.

**What to build:** `TodoRow` moves from `routes/app/groups/todos/TodoRow.tsx` to `components/todos/TodoRow.tsx` unchanged, exported from `components/todos/index.ts`; its importers follow (`routes/app/groups/todos/TodoSections.tsx`, `routes/app/groups/todos/DoneTodos.tsx`, `routes/app/groups/planner/UpcomingList.tsx`). `components/todos/TodoQuickAdd.tsx` (new): over `createTodo` with a `parentId`; Enter adds and keeps the field focused; Escape closes; errors inline. Two forms: `compact` (an icon-only `ListPlus` "Add subtask to <title>" button with room from its neighbors, opening the field in place) and `full` (the field always shown). Writers only, when `canHaveSubtask`. `routes/app/groups/todo/TodoSubtasks.tsx` drops its `AddSubtask` for `TodoQuickAdd` (full).

**Acceptance criteria:**

- [ ] Component (new `components/todos/todoQuickAdd.browser.test.tsx`): compact opens on the button, Enter adds a child and keeps the field, Escape closes; nothing renders for a viewer, at max depth or on a repeating todo; a failed write says so.
- [ ] Component (`todo/todoSubtasks.browser.test.tsx`): the band adds through the shared control; existing Todos and Planner tests pass unchanged with the moved row.

**Blocked by:** none. **Blocks:** 5.

---

## Slice 5: One shared tree

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-941. **User stories:** 1, 2, 3, 4.

**What to build:** `lib/todos/todoTreeView.ts` (new, pure): from todos (open and done) and a match predicate, the trees in list order: each placed by its most urgent open todo (`todoOrder`), siblings by `siblingOrder`, matches kept with their ancestors, other branches dropped; a `rootId` option builds one todo's descendants. `components/todos/TodoTree.tsx` (new, exported): nested `TodoRow`s indented per level, a list per level, and per row a `TodoQuickAdd` (compact) when `adding` is on.

**Acceptance criteria:**

- [ ] Unit (new `todoTreeView.test.ts`): three levels nest; an overdue child places its tree under Overdue; a match on a grandchild keeps its parent and grandparent and drops a non-matching sibling; done children stay in place; `rootId` gives one todo's descendants.
- [ ] Component (new `components/todos/todoTree.browser.test.tsx`): levels indent, a done child is struck, the + shows per row only with `adding` and only where a subtask may go.

**Blocked by:** 1, 4. **Blocks:** 6, 7.

---

## Slice 6: The Todos page shows trees, with a + on every row

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-941, B-942. **User stories:** 1, 2, 3, 4, 5, 7.

**What to build:** a new live query in `todos.sync.ts` for the group's live done subtasks whose top-level todo is open (the trees' done children), with its initial rows in `routes/app/groups/todos/route.tsx`'s loader. `useTodoList.ts` builds the trees with `todoTreeView` and the filters (who, tag, text) as the match; `todoList.ts` `todoSections` sections trees, not rows; `TodoSections.tsx` renders `TodoTree` with `adding` for writers. "Part of" rows go from this page. The Done list (`todosQuery` `done: true`, `doneCountQuery`) leaves out a done subtask whose top-level todo is open, since it shows struck in that tree.

**Acceptance criteria:**

- [ ] Unit (`todoList.test.ts`): sections of trees; a subtask never sections alone.
- [ ] Component (`todos.sync.browser.test.tsx`): a done assigned subtask of an open parent is not in the Done list or its count; one whose top-level todo is done is.
- [ ] Component (`todos/todoTree.browser.test.tsx`): the seeded "Get ready for the hospital stay" shows its children indented, a done one struck; Mine shows viewer@'s subtask under its parent; a writer adds two children from a row with Enter, in order; a viewer sees no +; no "Part of" row.

**Blocked by:** 3, 5. **Blocks:** 7.

---

## Slice 7: The todo page's tree replaces the Subtasks list

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: component

**Backlog:** B-941, B-942. **User stories:** 2, 6, 7.

**What to build:** the todo page's band (`routes/app/groups/todo/TodoSubtasks.tsx`, `useTodoSubtasks.ts`) renders `TodoTree` of the todo's descendants (`todoTreeView` `rootId`, from one live query of the group's live todos under it, in `todos.sync.ts`; no query per row) with `adding` for writers, under "n of m done", and keeps `TodoQuickAdd` (full) for new children. The band's own list goes. Tick, Undo (`TodoUndoStatus` `todoIds` = the shown descendants) and the "Part of" up-link work as today.

**Acceptance criteria:**

- [ ] Component (`todo/todoSubtasks.browser.test.tsx`): children and grandchildren nested; a writer adds a grandchild from a child's row and a child from the field; a viewer sees neither; ticking the last open child shows the parent done.

**Blocked by:** 3, 5, 6. **Blocks:** none.
