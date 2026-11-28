# Plan: Subtasks on their own, a view option

> Source PRD: [`plans/todo-links-2-prd.md`](todo-links-2-prd.md). User-story numbers (US) refer to it. Backlog item B-964. Topic `todo-links-2`, after [`todo-links`](todo-links-plan.md).

## Status

**Planned 2026-11-27** by the dispatcher's planner. Two slices, two waves; nothing asked. Skeptic s81's go: slice 2 gained the Planner's `route.tsx` (the loader's view, trees for easy roles), slice 1's `parentOf` reads done rows too, a revalidation note, the counts fixed.

**Landing mode: run everything through** (dispatcher start, 2026-11-27).

**Wave 1 landed 2026-11-27** in dev as 3ca78f4d7 through PR #294 (tier components, green run 46088122493 on cd47f4b32; landed on an unsynced tip, dev's one newer commit shared no file). Slice 1 on opus. One CI miss was slice 1's (`todos.browser.test.tsx` expected one menu section; fixed e3a89259a). Codex: one P2 (a split row at the depth limit offers Add subtask that fails), filed as B-994 (claimed) and folded into slice 2; thread replied and resolved. `docs/domain/todos.md` _Lists_ folded (view option), trimmed under dev's size. Browser: `--changed` needs none; `--suite` not run (user asks first). Report filed.

**Next (session 2): wave 2** — `risa slice todo-links-2 2`, agent on opus (it has real logic: the filters, the day trees, B-994's depth). Then its CI (components), sync, PR, Codex, land; then mark B-964 and B-994 done and `risa rm todo-links-2`. Slice 1's worktree `.loops/todo-links-2-1` removed after wave 1's green verdict.

| Slice | Wave | Model | State   | Merge into `prd/todo-links-2` (slice commits)   |
| ----- | ---- | ----- | ------- | ----------------------------------------------- |
| 1     | 1    | opus  | landed  | 7d93c761d, fix 6158c3121 (33290c34f, e3a89259a) |
| 2     | 2    | opus  | planned |                                                 |

## Architectural decisions

- **No migration, no sync rule, API or permission change.** The split is a view of the rows the device already reads.
- **One view module** (`lib/todos/todoView.ts`, new, pure): the `?subtasks=` parameter (none: in their tree, the default; `own`: on their own), its parse and set, and the one Filter menu section both tabs show. No screen reads the parameter itself.
- **The split has `todoTrees`' shape** (`splitTrees` in `lib/todos/todoTreeView.ts`): single-node trees, each its own lead, so `todoSections`, `plannerDayTrees` and `TodoTree` take it unchanged.
- **"Part of" is `TodoRow`'s existing `parentOf`**; the split lists pass it, the tree views don't.
- **Easy mode, the Today card and the todo page's Subtasks band are untouched** (`easyUpcoming.ts`, `easyTodoTrees.ts`, `TodoSubtasks.tsx`).
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds [todos](../docs/domain/todos.md) at landing (the view option under _Lists_).

## How to run this plan

- **Waves:** 1 (slice 1) → 2 (slice 2). Slice 2 uses slice 1's view module and `splitTrees`.
- **What each owns:** 1 the view module, `splitTrees`, the Todos tab and its sheets' return search; 2 Upcoming and the Planner's tab links.
- **Gates:** the quick check. No integration or end-to-end tests (no server or sync change).
- **When it's done:** `risa rm todo-links-2`.

---

## Slice 1: Subtasks on their own, on the Todos tab

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component · Blocked by: none

**Backlog:** B-964. **User stories:** 1, 2, 3, 4, 5, 8.

Size: six code files (one new) and five tests (four are additions to existing files); nothing another slice runs beside it touches.

**What to build:**

- `apps/web/app/lib/todos/todoView.ts` (new, pure): `SUBTASKS_PARAM` (`"subtasks"`), `TodoView` (`"tree" | "own"`), `todoViewOf(search)` (anything but `own` reads as `tree`), `setTodoView(search, view)` (`tree` drops the parameter, the rest kept), `todoViewSection(search, view)`: a `FilterSection` (`components/ui/filterModel`) titled "Subtasks", options "In their tree" (default) and "On their own", with a chip label when on. Relative imports only, so `web:unit` tests it.
- `apps/web/app/lib/todos/todoTreeView.ts` `splitTrees(todos, { now, timeZone, matches })` (new export): every live, open todo that matches as a `TodoTree` with no children, `context: false`, `lead` itself, in `todoOrder`. Done and deleted rows dropped; no ancestors kept.
- `apps/web/app/lib/todos/todoSheets.ts` `listSearch`: keeps `SUBTASKS_PARAM` with `who` and the tag, so the tab links from the Planner and a sheet's close keep the view.
- `apps/web/app/routes/app/groups/todos/TodoFilters.tsx` `todoFilterMenu`: adds `todoViewSection` after Assigned to and the tag; Clear filters drops `?subtasks=` too (back to the defaults, as for every section).
- `apps/web/app/routes/app/groups/todos/useTodoList.ts` `useTodoList`: reads `todoViewOf(search)`; on `own` builds the open list with `splitTrees` (the same match) and returns a `parentOf` from the open and done rows together (a parent in neither shows no line); the Done query and `doneCountQuery` drop `doneListed`. Returns `view`. `shouldRevalidate` stays as it is: a view change on the same path doesn't rerun the loader, the live Done and count queries follow it.
- `apps/web/app/routes/app/groups/todos/route.tsx`: the loader's Done query follows the view; passes `parentOf` in the row props (to `TodoSections` and `DoneTodos`) and `view` to the bar.

**Acceptance criteria:**

- [ ] With no `?subtasks=`, the Todos tab is unchanged (the existing `todoTree.browser.test.tsx` cases pass as they are).
- [ ] `todoView.test.ts` (new, unit): parse (none, `own`, an unknown value), set (both ways, other params kept), the section's options and default.
- [ ] `todoTreeView.test.ts` (unit): `splitTrees` places a subtask by its own due (an overdue step under Overdue while its parent is next week), drops done ones, keeps a match without its ancestors (under Mine, a parent assigned to you lists alone, its others' subtasks don't), orders by `todoOrder`.
- [ ] `todoFilters.test.ts` (unit): the menu has the Subtasks section; `listSearch` (in `todoSheets.test.ts`) keeps `?subtasks=own`.
- [ ] `routes/app/groups/todos/todoTree.browser.test.tsx` (component): on `?subtasks=own` a seeded subtask is its own row in its own section with "Part of <parent>" linking to the parent, its tick works with Undo, and a done step of an open tree is in Done.

**Blocked by:** none. **Blocks:** slice 2.

---

## Slice 2: Subtasks on their own, on Upcoming

Stack: no · Reads: docs/domain/todos.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, component · Blocked by: 1

**Backlog:** B-964, B-994 (Codex on PR #294). **User stories:** 6, 7, 8.

Size: five code files and three tests.

**What to build:**

- `apps/web/app/routes/app/groups/planner/upcomingFilters.ts`: `parseUpcomingFilters` returns `view` (`todoViewOf`); `upcomingFilterSections(search, show, tags, view)` (a new argument) adds `todoViewSection` after Show (and the tag); `tabSearch` carries `SUBTASKS_PARAM` to Upcoming and Past alike (Past shows no section, but going back keeps the view).
- `apps/web/app/routes/app/groups/planner/route.tsx`: the loader's parsed `view` (`parseUpcomingFilters` reads `""` for easy roles, so they stay on trees) goes into `useUpcomingData`'s filters and `upcomingFilterBar`. `useUpcomingData` never reads `?subtasks=` itself.
- `apps/web/app/routes/app/groups/planner/useUpcomingData.ts`. When the view it is passed is `own`, it builds `plannerDayTrees(splitTrees(...))` instead of `todoTrees`, and a `parentOf` from the tree rows in the returned data.
- `apps/web/app/routes/app/groups/planner/UpcomingList.tsx`. It passes the data's new `parentOf` to `TodoTree` (a split row is a top row in the `card` look, with its "Part of" line).
- **B-994 (both tabs):** a split row's quick add knows its real depth: `TodoTree` (or the split lists) give `TodoQuickAdd` the row's real ancestor chain from the rows read, so a todo at `MAX_TODO_DEPTH` offers no Add subtask on the split view (Todos too, landed in wave 1). A unit or component test: on `?subtasks=own` a third-level todo shows no quick add.
- `apps/web/app/routes/app/groups/planner/plannerFilters.tsx` `upcomingFilterBar`: takes `view` and passes it to `upcomingFilterSections`; Clear filters drops `?subtasks=` too, as on the Todos menu.

**Acceptance criteria:**

- [ ] With no `?subtasks=`, Upcoming is unchanged (the existing `plannerTodos.browser.test.tsx` cases pass as they are).
- [ ] `upcomingFilters.test.ts` (unit): the Subtasks section on Upcoming; `tabSearch` carries `?subtasks=own` to both tabs.
- [ ] `plannerTodos.test.ts` (unit): `plannerDayTrees` over `splitTrees` gives a step due on another day than its parent its own item on its day, led by itself.
- [ ] `planner/plannerTodos.browser.test.tsx` (component): on `?subtasks=own` a seeded step is its own row on its day with "Part of <parent>", and the Todos tab link carries the view.

**Blocked by:** slice 1. **Blocks:** none.
