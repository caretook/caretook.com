# Plan: Subtasks you can see and add where you work

> Source PRD: [`plans/todo-subtasks-3-prd.md`](todo-subtasks-3-prd.md). User-story numbers (US) refer to it. Backlog items B-941, B-942, B-943. Topic `todo-subtasks-3`, after [`todo-subtasks-2`](todo-subtasks-2-plan.md).

## Status

**Planned 2026-11-27, revised the same day** at the user's approval: the same tree everywhere (the Todos page, the todo page, the Planner, the Easy view), no subtask on a row of its own; the Today card, one line, names the due step. Nine slices (three over the usual six: the calendars slice from s67, and the day views, split at s69's send-back); each is small.

**Landing mode: run everything through** (dispatcher start, 2026-11-27): start every ready slice, land each green wave, ask only real questions via `risa ask`.

**Wave 1 landed 2026-11-27** in dev as `6d975d86a` through PR #256 (Codex clean on 69a8c1f; CI green at components, run 46039151595; dev was up to date, no sync). Browser: `risa browser --changed` named none; the lean `--suite` was not run (the user's rule: ask before any suite; the permission check refused it). Docs folded (todos, components, calendars, connectors, timeline; each at or under dev's size). Worktrees 1-3 removed. B-941, B-942, B-943 stay in progress (later slices carry them).

**Wave 2 landed 2026-11-27** in dev as `9480f19` through PR #257 (slice 4, merged `c7e7f6035`; Codex clean on c719e42; CI green at components on the pre-sync tip, run 46041028561, and on the synced tip, run 46042026452). Worktree 4 removed. Docs folded (components: `TodoTree`; todos: `siblingOrder`, `todoTreeView.ts`); each at dev's size or under (todos is exactly at it: trim before adding).

**Wave 3 landed 2026-11-27** in dev as `6ab74942c` through PR #259 (slices 5 `ebdfb25e5`, 6 `fb2420fd9`; Codex clean on ebf8bd7; CI green at components on 62cb1d9a, run 46044540245; dev up to date, no sync; browser `--changed` named none). Worktrees 5, 6 removed. Docs folded (todos, under dev's size; components unchanged, over budget: trim before adding). Report a317 filed.

**Wave 4 started 2026-11-27** (fresh session after rotation): dev sync was a no-op; backlog ingest found nothing new for this topic. Slice 7 handed off (quick check green on 2e2cc4292) and merged as `605a0450b`; slice 8 handed off (quick check green on 4cf90fd5b) and merged as `d533ece9d` (14 files, over the hook's 12: note for the next plan). Wave 4 CI run at components requested on the merged tip. Slice 8 notes: easy trees use the easy look at every level (context ancestors in the context look); `TodoRow`'s `onTick` is optional now; `parentsById` removed; `useDueTodos`, `plannerTodos`, `isPlannerTodo` now unused outside tests (slice 9 removes them); Easy rows select by `[data-todo-look=easy]`, no `data-easy-todo`. Slice 7 notes: other Planner component tests (`planner`, `plannerSearch`, `plannerTags`, `plannerSeries`) not run by the slice: the wave run covers them; a tree due today with an overdue step shows twice under Today (overdue branch, then whole tree), as the plan says. Carried notes (passed to slice 7): `TodoRow` still requires `onTick`, `busy`, `nameOf`, `now`, `timeZone` on `context` rows; quick add never shows on a `context` row; a todo whose parent isn't in the list stands at the top level; `todoTreesQuery` (slice 5) and `todoDescendantsQuery` (slice 6) exist; `parentsById` still used by `useUpcomingData` and `useEasyTodos`; the todo page's tree rows show progress as "n of m done" in the row line. Docs at wave 4: appointments (Planner), timeline (Easy view), todos.

**Lessons:** my sed edits to the status table break its prettier alignment and every slice's check stops at format; run `pnpm exec prettier --write` on the plan before each commit.

| Slice | Wave | State         | Merge into `prd/todo-subtasks-3` (slice commits) |
| ----- | ---- | ------------- | ------------------------------------------------ |
| 1     | 1    | merged (opus) | 2ecc23241 (5ee22a7ad)                            |
| 2     | 1    | merged (opus) | 4d3ca3e7c (45a2ae69c, f24e0ea11)                 |
| 3     | 1    | merged (opus) | 09d9e0dd6 (fa0dd51db, bab5e4988)                 |
| 4     | 2    | merged (opus) | c7e7f6035 (b54b3ded0, c3ebbf8b0)                 |
| 5     | 3    | merged (opus) | ebdfb25e5 (90e2bbe57)                            |
| 6     | 3    | merged (opus) | fb2420fd9 (2bb0cc1c0)                            |
| 7     | 4    | merged (opus) | 605a0450b (0f09c13ab, 2e2cc4292)                 |
| 8     | 4    | merged (opus) | d533ece9d (c68a5e0cc, 4cf90fd5b)                 |
| 9     | 5    | —             |                                                  |

## Architectural decisions

- **No migration, no sync rule change, no API contract change.** `parent_id`, the tree rules and the group progress query exist (todo-subtasks); these slices change rules and screens.
- **The tree rules stay in the one pure module** (`packages/data/src/db/schema/todos/todoTree.ts`): the service, the calendars and the device call them; none re-derives a due limit, a listing rule or an order.
- **The server clamps, never refuses** the due rule, so an upload never fails on it; the device refuses only an edit that changes the due day.
- **Inherited dates land last** (slice 9, after the calendars leave subtasks out and the day views show trees), so nothing floods the Planner or anyone's calendar in between.
- **One display: trees everywhere.** Every list of todos shows a subtask only inside its tree, never on a row of its own; a branch shown away from its top-level todo keeps its ancestors as dimmed context rows. The one exception is the Today card (one line, no room for a tree): it names the due step itself, and its link opens the Todos page where the tree shows. The connectors' `upcoming` (text for a member's AI, not a screen) lists a subtask with its "part of" title when it's assigned or due before its parent.
- **One live query per list, never one per row.** Trees are built on the device from the list's rows; the tree lists share one query of the group's open todos and the trees' done children (slice 5).
- **One shared row, tree and quick add** (`components/todos`): `TodoRow`, `TodoTree`, `TodoQuickAdd`. Every todo list and todo-links' B-948 use them; an exception needs a reason written in its slice. The row varies only slightly per place, by `look`: `list` (the Todos and todo pages), `card` (a Planner tree's top row, laid out like an event), `easy` (the big tick and text), `context` (a dimmed ancestor). `PlannerTodoRow` and the Easy card's own row fold into it.
- **Hot files include the timeline folder** (the Easy view, the Today card): fixes-perf, which holds it now, lands before this topic runs (the user's word, 2026-11-27).
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 (slices 1, 2, 3) → 2 (slice 4) → 3 (slices 5, 6) → 4 (slices 7, then 8) → 5 (slice 9). Slices 5 and 6 both add a query to `lib/todos/todos.sync.ts`, with no `Blocked by` between them: merge 5 first (6 reuses its tree query when it fits); at worst a merge conflict. In wave 4, slice 8 starts only once slice 7 is merged (it uses `plannerDayTrees` and the row's looks, and removes the old `plannerTodos`).
- **Gates:** the quick check; integration tests in slices 2 and 9 (no stack needed).
- **Docs at landing:** [todos](../docs/domain/todos.md) every wave; [components](../docs/domain/components.md) at waves 1, 2 (the shared pieces); [calendars](../docs/domain/calendars.md), [connectors](../docs/domain/connectors.md) and [notifications](../docs/domain/notifications.md) (reminders unchanged for subtasks) and [timeline](../docs/domain/timeline.md) (the Today card) at wave 1; [appointments](../docs/domain/appointments.md) (the Planner) and timeline (the Easy view) at wave 4.
- **When it's done:** `pnpm prd rm todo-subtasks-3`.

---

## Slice 1: One shared row and quick add

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**Backlog:** B-942. **User stories:** 5, 7, 8.

**What to build:** `TodoRow` moves from `routes/app/groups/todos/TodoRow.tsx` to a new `components/todos/TodoRow.tsx` unchanged, exported from `components/todos/index.ts`; its importers follow (`routes/app/groups/todos/TodoSections.tsx`, `routes/app/groups/todos/DoneTodos.tsx`; about ten files in all, most of them import updates). It gains a `context` look (dimmed, no tick, still a link) for an ancestor shown only to place a branch. `components/todos/TodoQuickAdd.tsx` (new): over `createTodo` with a `parentId`; Enter adds and keeps the field focused; Escape closes; errors inline. Two forms: `compact` (an icon-only `ListPlus` "Add subtask to <title>" button with room from its neighbors, opening the field in place) and `full` (the field always shown). Writers only, when `canHaveSubtask`. `routes/app/groups/todo/TodoSubtasks.tsx` drops its `AddSubtask` for `TodoQuickAdd` (full).

**Acceptance criteria:**

- [ ] Component (new `components/todos/todoQuickAdd.browser.test.tsx`): compact opens on the button, Enter adds a child and keeps the field, Escape closes; nothing renders for a viewer, at max depth or on a repeating todo; a failed write says so.
- [ ] Component (`components/todos` row test): a `context` row is dimmed, has no tick and links to its todo.
- [ ] Component (`todo/todoSubtasks.browser.test.tsx`): the band adds through the shared control; existing Todos and Planner tests pass unchanged with the moved row.

**Blocked by:** none. **Blocks:** 4.

---

## Slice 2: No subtasks on calendars

Stack: no · Reads: docs/domain/todos.md, docs/domain/calendars.md, docs/domain/connectors.md, docs/domain/notifications.md · Tests: unit, integration

**Backlog:** B-943 (the user's word, 2026-11-27). **User stories:** 14.

**What to build:** `calendarItems` (`packages/data/src/db/schema/calendars/calendarItems.ts`) is left as it is: the reminder sweep (`packages/notifications/src/reminders.ts` `itemsOf`) calls it too, and an assigned subtask keeps its "todo due" email. Instead the feed (`calendarFeedService`) and the Google push (`calendarSyncService` `groupItems`) leave todos with a `parentId` out where they load their todos. No new delete code: the push's `planPush` already deletes a linked event whose item is gone, and the daily sweep queues a push, so held subtask events leave members' Google calendars within a day (`pullPlan` ignores Google's echo, the link row being gone). `listsOnItsOwn` (`todoTree.ts`) is left as it is: the Todos page, the Planner, the Today card and `LISTED_SQL` still call it until their slices (5, 7, 3) move to trees. A new pure `upcomingListsSubtask(todo, parentDueOn)` there: a subtask lists when assigned, or dated before the parent's day (an undated parent: any date counts). The connectors' `upcoming` tool (`packages/api/src/connectors/tools/upcoming.ts`) uses it with the parent's day, loaded with its todos, and names the parent ("part of …"). About nine files; the reminders test is under account-security's hot files, but that topic is on hold, not running.

**Acceptance criteria:**

- [ ] Unit (`todoTree.test.ts`): `upcomingListsSubtask`: a subtask on its parent's day doesn't list; one a day earlier does; an assigned one does; one under an undated parent with a date does.
- [ ] Integration (`calendarFeedService`, `googleCalendar.int.test.ts`): the feed leaves a dated subtask out and keeps its parent; a held Google event for a subtask is deleted at the next push, a top-level todo's kept.
- [ ] Unit or integration (`packages/notifications` reminders tests): an assigned, dated subtask still gets its "todo due" reminder.
- [ ] Integration (connectors read tools test): `upcoming` leaves out a subtask on its parent's day, keeps an assigned one with its parent's title.

**Blocked by:** none. **Blocks:** 9.

---

## Slice 3: The Today card names the due step

Stack: no · Reads: docs/domain/todos.md, docs/domain/timeline.md · Tests: unit, component

**Backlog:** B-941. **User stories:** 15.

**What to build:** `todoStrip` (`lib/todos/todoStrip.ts`) counts and names every open todo overdue or due today, a step included, and stops calling `listsOnItsOwn` (one line has no room for a tree, the one exception to trees everywhere; the link opens the Todos page, where the tree shows). `routes/app/groups/timeline/useTodoStrip.ts` and `useTodayCard.ts` read every open todo (not `listed: true`) if they filter today.

**Acceptance criteria:**

- [ ] Unit (`todoStrip.test.ts`): a step due today is named and counted; mine first as today.
- [ ] Component (the Today card's browser test): a step due today is named; its link opens the Todos page.

**Blocked by:** none. **Blocks:** 9.

---

## Slice 4: One shared tree, by section and by day

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-941. **User stories:** 1, 2, 3, 4, 12, 13.

**What to build:** pure `siblingOrder` in `todoTree.ts`: dated before undated; dated by day, then on one day timed ones by time before day-only ones; then by `createdAt`, `id` (in SQL: `due_on IS NULL, due_on, due_time IS NULL, due_time, created_at, id`). `lib/todos/todoTreeView.ts` (new, pure), from todos (open and done) and a match predicate:

- `todoTrees`: the trees in list order, each placed by its most urgent open todo (`todoOrder`), siblings by `siblingOrder`, matches kept with their ancestors, other branches dropped; a `rootId` option builds one todo's descendants.
- `todoDayTrees(trees, day)` for the day views: on the top-level todo's own day (or under Overdue when it's overdue) the whole tree; on any other day, or under Overdue for an overdue step, the branch of the open todos due then, their ancestors as `context` rows; an undated tree shows only its dated steps' branches. A day with nothing open due shows no tree.

`components/todos/TodoTree.tsx` (new, exported): nested `TodoRow`s in the row's look (`look`, passed down; slices 7 and 8 add theirs) indented per level (ancestors in the `context` look when marked), a list per level, and per row a `TodoQuickAdd` (compact) when `adding` is on.

**Acceptance criteria:**

- [ ] Unit (`todoTree.test.ts`): `siblingOrder` puts dated before undated, timed before day-only on one day, then by created.
- [ ] Unit (new `todoTreeView.test.ts`): three levels nest; an overdue child places its tree under Overdue; a match on a grandchild keeps its parent and grandparent and drops a non-matching sibling; done children stay in place; `rootId` gives one todo's descendants; `todoDayTrees` gives a Friday parent its whole tree on Friday and its Tuesday step's branch on Tuesday with the parent as context; an undated parent's dated step shows as a branch on its day.
- [ ] Component (new `components/todos/todoTree.browser.test.tsx`): levels indent, a done child is struck, a context row is dimmed, the + shows per row only with `adding` and only where a subtask may go.

**Blocked by:** 1. **Blocks:** 5, 6, 7, 8.

---

## Slice 5: The Todos page shows trees, with a + on every row

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-941, B-942. **User stories:** 1, 2, 3, 4, 5, 7.

**What to build:** a new live query in `todos.sync.ts`, the trees' rows: the group's open live todos and its live done subtasks whose top-level todo is open, ordered by `siblingOrder`'s SQL; its initial rows in `routes/app/groups/todos/route.tsx`'s loader. `useTodoList.ts` builds the trees; slice 4's `todoTrees` takes the filters (who, tag, text) as the match; `todoList.ts` `todoSections` sections trees, not rows; `TodoSections.tsx` renders the trees; slice 4's `TodoTree` with `adding` for writers. "Part of" rows go from this page. The Done list (`todosQuery` `done: true`, `doneCountQuery`, through `LISTED_SQL`) stays flat: top-level todos and done subtasks whose top-level todo is done; it leaves out a done subtask whose top-level todo is open, since it shows struck in that tree. The new rule is for done queries only (a `doneListed` filter); the open `listed: true` read that the Easy view's My todos uses keeps the old rule until slice 8; `todoList.ts` stops calling `listsOnItsOwn` (`LISTED_SQL` reaches the top-level todo through a correlated subquery, never a join: `whoCondition`'s columns are unqualified).

**Acceptance criteria:**

- [ ] Unit (`todoList.test.ts`): sections of trees; a subtask never sections alone.
- [ ] Component (`todos.sync.browser.test.tsx`): the trees' query holds a done subtask of an open parent; that subtask is not in the Done list or its count; one whose top-level todo is done is.
- [ ] Component (`todos/todoTree.browser.test.tsx`): the seeded "Get ready for the hospital stay" shows its children indented, a done one struck; Mine shows viewer@'s subtask under its parent; a writer adds two children from a row with Enter, in order; a viewer sees no +; no "Part of" row.

**Blocked by:** 4. **Blocks:** 7, 8, 9.

---

## Slice 6: The todo page's tree replaces the Subtasks list

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: component

**Backlog:** B-941, B-942. **User stories:** 2, 6, 7.

**What to build:** the todo page's band (`routes/app/groups/todo/TodoSubtasks.tsx`, `useTodoSubtasks.ts`) renders `TodoTree` of the todo's descendants (`todoTrees` `rootId`, from one live query of the group's live todos under it, in `todos.sync.ts`; no query per row) with `adding` for writers, under "n of m done", and keeps `TodoQuickAdd` (full) for new children. The band's own list goes. Tick, Undo (`TodoUndoStatus` `todoIds` = the shown descendants) and the "Part of" up-link work as today.

**Acceptance criteria:**

- [ ] Component (`todo/todoSubtasks.browser.test.tsx`): children and grandchildren nested; a writer adds a grandchild from a child's row and a child from the field; a viewer sees neither; ticking the last open child shows the parent done.

**Blocked by:** 4. **Blocks:** 9.

---

## Slice 7: The Planner shows trees by day

Stack: no · Reads: docs/domain/todos.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-941. **User stories:** 13.

**What to build:** a new export `plannerDayTrees` (`lib/todos/plannerTodos.ts`): one Planner item per day tree (`todoDayTrees`) instead of one per todo, ranked in its day by its top row's state and time as todos are today. `plannerTodos` stays, unchanged, for the Easy view's Upcoming until slice 8. The Planner reads the trees' query (slice 5) in `routes/app/groups/planner/useUpcomingData.ts` (and `past/route.tsx` where it lists todos). `UpcomingList.tsx` renders each item's tree; slice 4's `TodoTree` with `adding` for writers. **One row, two looks:** `PlannerTodoRow.tsx` folds into the shared row; slice 1's `TodoRow` gains it as its `card` look (the event-card layout of B-636, so a tree's top row lines up with the day's events), moved to `components/todos`; the steps under it are the list look, indented. About eight files.

**Acceptance criteria:**

- [ ] Unit (`plannerTodos.test.ts`): a Friday parent with a Tuesday step gives a whole tree on Friday and a branch on Tuesday; an overdue step's branch sits with the overdue items; an undated tree with no dated step gives nothing; `plannerTodos` is unchanged.
- [ ] Component (Planner browser test): a day shows a tree, its top row as an event card and its steps indented; an earlier step's day shows it under a dimmed parent; a writer adds a step from a row; a viewer sees no +.

**Blocked by:** 4, 5. **Blocks:** 8, 9.

---

## Slice 8: The Easy view shows trees

Stack: no · Reads: docs/domain/todos.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-941. **User stories:** 16.

**What to build:** **one row, its easy look:** the big tick and large title of `EasyTodos.tsx`'s own row become the shared `TodoRow`'s `easy` look, and the card renders `TodoTree` in it. Easy mode's "My todos" (`routes/app/groups/timeline/useEasyTodos.ts`) builds `todoTrees` with "mine" as the match from the trees' query: my todos, each assigned step under its ancestors as `context` rows; the cap of five counts my todos, not rows, and a tree is never cut midway (it shows whole, the next one waits for "See all"). Its Upcoming (`useEasyUpcoming.ts`, `EasyNext.tsx`) moves to `plannerDayTrees` and renders `TodoTree` in the easy look with no ticks, as its todo items have today; My todos stops reading `listed: true`. The + shows only where the card already lets this viewer add todos (none added if it has no add today). About nine files (the removals wait for slice 9).

**Acceptance criteria:**

- [ ] Unit (the Easy todos helpers' test): my step shows under its parent as context; a sibling not mine is left out; five of mine cap the card by todos.
- [ ] Component (`timelineEasyTodos.browser.test.tsx`, `timelineEasy.browser.test.tsx`): my assigned step shows under its dimmed parent with the big tick; its tick works and Undo is offered as today; Upcoming shows a parent's tree on its day.

**Blocked by:** 4, 5, 7. **Blocks:** 9.

---

## Slice 9: Subtask due dates: inherit, never after the parent

Stack: no · Reads: docs/domain/todos.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: unit, integration, component

**Backlog:** B-943. **User stories:** 9, 10, 11.

**What to build:** pure rules in `todoTree.ts` (new): `inheritedDue`, `clampDue` (capped at the parent's day, taking its time when capped). `todoService` `create` (also through `upsert`'s first write; an upload's edit is a PATCH to `update`): no due given and a parent → the parent's day and time; then clamp. `update`: a subtask's day after its parent's is clamped; a parent given any new day (moved, or a first day) clamps its open live descendants, all levels, in the transaction, each through the service's own update write (so each queues its calendar push); clearing the day changes none. Device (`todos.sync.ts`): `createTodo` inherits; `updateTodo` refuses only a patch that changes a subtask's `dueOn` to after its parent's (`todos:dueAfterParent`, shown by `TodoForm` on the due field), clamps any other edit of a late subtask, and writes the descendants' clamps in the parent's transaction; `subtasksQuery` orders by `siblingOrder`'s SQL exactly (slice 4). **The clamp runs for writers only**, after `update`'s `completionOnly` check (`todoService.ts`), and the device's clamp of a late subtask applies only to a writer's edit, so a completer's upload never picks up a `dueOn` and is never refused. **Tidy:** `plannerTodos` (unused since slice 8), `listsOnItsOwn` and the old `listed: true` rule go (`upcomingListsSubtask` stays).

**Acceptance criteria:**

- [ ] Unit (`todoTree.test.ts`): `clampDue` caps and takes the time; same day kept; undated parent no cap; `inheritedDue` of an undated parent is none.
- [ ] Integration (`todoService` tests): create inherits; create (and upsert's first write) and update past the parent are clamped, not refused; a parent moved earlier, and an undated parent given a day, clamp open descendants two levels down and leave done ones; clearing the parent's day changes nothing.
- [ ] Integration (`todoService` tests): a completer's edit of a late subtask is not clamped and not refused.
- [ ] Component (`todoSubtasks.sync.browser.test.tsx`): the device inherits; refuses a due change past the parent with the issue; a title-only edit of an already-late subtask saves (clamped); the cascade is one transaction.

**Blocked by:** 2, 3, 5, 6, 7, 8. **Blocks:** none.
