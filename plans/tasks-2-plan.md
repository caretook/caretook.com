# Plan: Tasks 2 (todos, and the Planner)

> Source PRD: [`plans/tasks-2-prd.md`](tasks-2-prd.md). User-story numbers (US) refer to it. Backlog item B-222 (tasks become todos, folded into a renamed Upcoming). Topic `tasks-2`.

## Status

| Slice | Wave | State | Merge into `prd/tasks-2` (slice commits) |
| ----- | ---- | ----- | ---------------------------------------- |
| 1     | 1    | —     |                                          |
| 2     | 2    | —     |                                          |
| 3     | 3    | —     |                                          |
| 4     | 3    | —     |                                          |

**Start conditions:** **`timeline-ux-2`** in `dev` (its `PageHeader` and the Upcoming and Tasks headers; last item B-224). `connectors-2` (the tools, `assistantActionService`, the MCP prompts) is already in `dev` (017a9b29). Run `pnpm prd sync` before slice 1 if `dev` moved.

**Landing:** one migration (slice 1); no new dependencies. Land when every slice is merged; run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking.

**Deploy note:** the migration and the sync config change together (a one-step rename). Staging's deploy runs both; a device that was offline loses queued `task` uploads (accepted: production isn't live).

**Backlog:** claim B-222 when slice 1 starts; `done B-222` after the last slice merges.

Fold into the area docs at landing (the orchestrator):

- `docs/domain/tasks.md` → `docs/domain/todos.md` (every name, the table, the Planner's Todos tab), and the core's _Area index_ entry.
- `appointments.md`: Upcoming becomes the Planner (the tab, `PlannerHeader`, the + menu, `plannerTodos`).
- `app-shell.md`: four sections; Planner's double match (`/planner`, `/todos`) as the one exception to "append only".
- `calendars.md` (`todo:` uids, "Todo for", `TODO_LEADS`, `calendar_sync_job.reason`), `connectors.md` (`add_todo`, `list_todos`, `todo.via`), `search.md`, `assistant.md` (the prefixes), `timeline.md` (My todos, the Today card), `live-notes.md` (the `todo` subject), `sync.md`, `data-layer.md`.
- `ops/runbook.md`: the one-step rename's deploy.

## Architectural decisions

- **One word, all the way down:** the table `todo`, `note_document.todo_id` and subject `todo`, `PERMISSIONS.todo`, `todoService` and `todoModel`, errors `todoService:*`, the search type `todo`, the calendar uid `todo:<id>` and kind `todo`, the device table `todo`, `lib/todos/`, `components/todos/`. Wording: "Todo" and "Todos".
- **One-step migration** (the user's exception to the additive rule, production not live). It renames the table and column, rewrites the stored values (the subject, the `calendar_sync_job.reason`, every stored `task:` uid), keeps `event_id`'s `SET NULL ("event_id")` and the `powersync` publication, and leaves a snapshot that regenerates to nothing. The upload switch refuses `task`.
- **Routes:**
  - `/app/groups/:groupId/planner` (the Planner tab) and `/planner/past` (Past);
  - `/todos` (the Todos tab) with `new` and `:todoId/edit` sheets as children;
  - `/todos/:todoId` (the page).
  - No `/upcoming` or `/tasks` and no redirects. `appUrls`: `planner`, `plannerPast`, `newPlannerEntry`, `todos`, `todo`, `newTodo`, `editTodo`.
- **Sections:** four in `GROUP_SECTIONS`: Timeline, Providers, Medications, Planner (`CalendarCheck`). Planner matches `/planner…` and `/todos…`.
- **`PlannerHeader`** on all three tabs: a `PageHeader` "Planner" with, for writers, one + `Menu` named "Add" (Appointment, Reminder, Todo), and the tab nav (Planner, Todos, Past) with `aria-current="page"`. A todo sheet opened from any tab closes back to it.
- **Quick entry** keeps `t:`, `task:`, `todo:`, `to-do:`, `to do:` and a bare `todo`.
- **Connector tools:** `add_todo`, `list_todos` (action kind `addTodo`).
- **Time words stay:** "upcoming" in `lib/appointments/upcoming*` and the Next strip describes time, not the section.

## How to run this plan

- **The rename crosses nearly every todo file, so it runs in order:**
  - Wave 1 is slice 1 (data and sync).
  - Wave 2 is slice 2 (the app's names and wording).
  - Wave 3 is slices 3 and 4 together.
- **Ownership:**
  - Slice 1 owns the migration, `packages/data` (schema, model, service, permissions, errors, seeds, search and calendar text), `packages/notifications`, `powersync/sync-config.yaml`, the device schema, the upload switch, the table and column names inside the device queries, the sync matrix and `roundtrip`'s table names. It leaves the app's file and identifier names, and the connector's tool names, for slices 2 and 4. It changes only the imports in `packages/api/src/connectors/`.
  - Slice 2 owns `lib/todos/`, `components/todos/`, the `todos/` and `todo/` route folders, `appUrls`' todo builders, all app wording, quick entry's preview, `actionPreview`, the connector's `links.ts` (kept equal to `appUrls`), the privacy pages, `check-areas.d/todos`, and the `phase2` and `live-notes` checks' paths and selectors.
  - Slice 3 owns the `planner/` route folder (today's `upcoming/`), `PlannerHeader`, `GROUP_SECTIONS`, the Planner builders in `appUrls`, and the Todos page's header.
  - Slice 4 owns `packages/api/src/connectors/tools/` (the two tools), `assistantActionService`'s action kind, the MCP prompts and instructions, and their integration tests.
  - Slices 3 and 4 share no files. Slice 4's answers reuse `actionPreview`, which slice 2 already changed.
- **Stacks:** slice 1 needs one (a migration, sync config, `roundtrip`). Slices 2 to 4 are stackless. A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing.
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/tasks-2`. Every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **Running beside other PRDs:**
  - `quick-entry` (B-220, to write) touches quick entry's parser: if it runs at the same time, slice 2's prefix and preview lines go first.
  - `simple-mode` (B-221) touches `SimpleTimeline`: slice 2 renames `SimpleTasks` beside it, so check its open slices first.
  - `quick-fixes`: check its open slices for task or Upcoming files before slices 2 and 3.
- **Grep before hand-off:** each slice runs a case-insensitive search for `task` over what it owns. What's left must be deliberate: the quick-entry aliases, "Tasks" in old migrations, the git history, the unrelated word "task" in tooling, and in slices 1 and 2 the names a later slice owns. The hand-off lists the leftovers.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: Data and sync say todo (tracer bullet)

Stack: yes · Reads: docs/domain/tasks.md, docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/calendars.md, docs/domain/live-notes.md, docs/domain/search.md · Tests: unit, integration, e2e:roundtrip

**User stories:** 16, 17, 18, 20, 22.

**What to build.**

- **The migration** (adds a migration):
  - Rename table `task` to `todo`, with its constraints and indexes.
  - Rename `note_document.task_id` to `todo_id`, and rewrite subject `task` to `todo` with its check.
  - Rewrite `calendar_sync_job.reason` `task` to `todo` with its check.
  - Rewrite every stored calendar uid `task:<id>` to `todo:<id>`: `google_event_link.item_uid`, and any reminder send record keyed by uid (find them).
  - Confirm that `event_id`'s `ON DELETE SET NULL ("event_id")` and the `powersync` publication survive.
  - Update the Drizzle snapshot so a later `generate` makes nothing.
- **`packages/data`:**
  - `db/schema/todos/` (`todo`, `todoRules`, `todoDisplay`) with renamed exports;
  - `todoModel`, `todoService` (the same methods), `PERMISSIONS.todo`, the `todoService:*` errors;
  - `seeds/todos.ts` (same ids);
  - search's `todo` type and `todoSearchDocument`;
  - `NOTE_DOCUMENT_SUBJECTS`' `todo` and `todoId`;
  - calendars' `todo:` uid, the `todo` kind, "Todo for Pat" and `TODO_LEADS`;
  - the services that call it (`careGroupMemberService`, `timelineEntryService`, `assistantActionService`'s imports, the calendar services).
- **`packages/notifications`:** reminder wording says todo.
- **Sync:**
  - the sync config's query reads `FROM todo`;
  - the device schema has table `todo` and `note_document.todo_id`;
  - the upload switch accepts `todo` and refuses `task`;
  - the device queries' SQL uses the new names (the files keep their names until slice 2);
  - the sync matrix row is `todo`.
- **`roundtrip`:** its table and column names, and its matrix row.

**Acceptance criteria.**

- [ ] Integration test (a new `todoRename.int.test.ts`, or in `task.int.test.ts` renamed `todo.int.test.ts`). Before the migration, a database has a task with a notes document, a calendar job, a Google link and a reminder send. After it: the same row in `todo`, a `todo` subject with `todo_id`, the `todo` reason and `todo:` uids. Hard-deleting the linked entry still clears `event_id`.
- [ ] Integration test (`syncTodos.int.test.ts`, renamed): `todo` PUT, PATCH (a done-only PATCH maps to `complete` and `reopen`) and DELETE upload; a `task` op is refused.
- [ ] The renamed service, leaver, `releaseEvent`, search, feed, push, pull and reminder integration tests pass, with `todo:` uids. The golden `.ics` files are updated.
- [ ] Unit tests: `todoRules`, `todoDisplay`, `calendarItems`, `reminderPlan` and `calendarText` ("Todo for Pat") with the new names.
- [ ] `pnpm datastore:reset` seeds cleanly, and `pnpm generate` makes no new migration.
- [ ] `roundtrip` passes with the `todo` row (viewer@ ticking their todo offline).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none (the start conditions). **Blocks:** 2, 3, 4.

---

## Slice 2: The app says todo

Stack: no · Reads: docs/domain/tasks.md, docs/domain/components.md, docs/domain/timeline.md, docs/domain/assistant.md, docs/domain/search.md, docs/domain/app-shell.md · Tests: unit, component, e2e:phase2, e2e:live-notes

**User stories:** 1, 12, 13, 14, 15, 21.

**What to build.**

- **Moves:**
  - `lib/tasks/` → `lib/todos/` (`todos.sync.ts`, `todoDisplay`, `todoList`, `todoStrip`, `todoUndo`, `todoSheets`, `todoSheetLink`, and `upcomingTasks` → `plannerTodos`);
  - `components/tasks/` → `components/todos/` (`TodoTick`, `useTodoTick`, `TodoUndoStatus`, `LinkedTodos`, `useLinkedTodos`);
  - `routes/app/groups/tasks/` → `todos/`, and `task/` → `todo/`;
  - `SimpleTasks` → `SimpleTodos`, `useSimpleTasks` → `useSimpleTodos`, `useTaskStrip` → `useTodoStrip`;
  - Upcoming's `UpcomingTaskRow` → `UpcomingTodoRow` (slice 3 moves the folder).
- **URLs:** the routes are `todos`, `todos/new`, `todos/:todoId/edit` and `todos/:todoId`. `appUrls`: `todos`, `todo`, `newTodo`, `editTodo`, with the prefill params unchanged. Tasks' `GROUP_SECTIONS` entry points at `/todos` until slice 3 replaces it. The connector's `links.ts` follows, with its equality test.
- **Wording:**
  - "Todo" and "Todos" on the list (title, "Add todo", empty states), the page, the sheets, the tick and Undo, LinkedTodos ("Add todo"), the Today card, the simple view's "My todos", search's "Todos" section, and the section label "Todos" until slice 3;
  - quick entry's preview card ("Todo · …"), its rules text and `actionPreview` ("Todo added …");
  - the privacy and health-data-privacy pages.
- **Quick entry:** the prefixes stay, all of them, and the help and examples show `todo:`.
- `check-areas.d/tasks` → `check-areas.d/todos`, with its paths.
- The `phase2` and `live-notes` checks: their paths and selectors (data attributes renamed `data-add-todo` and so on).

**Acceptance criteria.**

- [ ] Unit tests (renamed): `todoList`, `todoStrip`, `todoSheets`, `todoUndo`, `plannerTodos`, the pickers, `taskFormData` → `todoFormData`, and `quickEntry` (the `t:` and `task:` aliases still parse as todos; previews say "Todo").
- [ ] Component tests (renamed, wording asserted): `todos.browser.test.tsx` (the list's "Todos" heading, chips, "Add todo", "No open todos."), `todo.browser.test.tsx`, `todoLinks`, `todoVia`, `linkedTodos`, `searchTodos` ("Todos" section), `timelineSimpleTodos` ("My todos"), `timelineQuickEntryTodos` (`todo:` and `task:` lines preview as "Todo"), `upcomingTodos`.
- [ ] No user-facing "task" or "Tasks" is left in the app, the emails or the privacy pages (the grep's leftovers are listed in the hand-off).
- [ ] `phase2` and `live-notes` pass with the new paths, or are reported for landing.
- [ ] `pnpm check` passes; `pnpm test:components --changed prd/tasks-2`; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** 3, 4.

---

## Slice 3: The Planner section

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/appointments.md, docs/domain/tasks.md, docs/domain/components.md · Tests: unit, component

**User stories:** 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 23.

**What to build.**

- **Routes:** `routes/app/groups/upcoming/` → `planner/`, with paths `planner` and `planner/past` and no `upcoming` routes. `appUrls`: `planner`, `plannerPast`, `newPlannerEntry` (today's `upcoming`, `pastEvents`, `newUpcomingEntry`), with every caller moved over.
- **`GROUP_SECTIONS`:** remove Upcoming and Tasks, and add one Planner entry in Upcoming's place (id `planner`, "Planner", `CalendarCheck`) that matches `/planner…` and `/todos…`. Update the registry comment: this is a deliberate exception to "append only".
- **`PlannerHeader`** (beside the planner route; used by the Planner, Past and Todos pages):
  - timeline-ux-2's `PageHeader` with "Planner", and no subtitle;
  - for writers, the actions slot holds a `ui/Menu` + button named "Add" with Appointment and Reminder (the `?when=pick` drafts) and Todo (`appUrls.newTodo` with the sheet's link state, so it closes back to the tab it came from);
  - the tab nav "Planner, todos or past": Planner and Past carry their filters as `tabSearch` does today, and Todos carries `?who=`;
  - it replaces `UpcomingHeader`. The filter chips stay below it on Planner and Past.
- **The Todos page** uses `PlannerHeader` (tab `todos`) in place of its own header and "Add todo" button. The chips, sections, Done and the sheets' outlet are unchanged.
- Page titles: "Planner · Caretook", "Todos · Caretook", "Past · Caretook".
- Wherever the app links to or names the section as "Upcoming" (the Today card's or simple view's link to the section, empty-state text), it now says "Planner". The time words stay.

**Acceptance criteria.**

- [ ] Unit tests (`groupSections.test.ts`): four sections in order; Planner matches `/planner`, `/planner/past`, `/todos`, `/todos/new` and `/todos/<id>`; nothing matches `/upcoming` or `/tasks`; `sectionCurrent` is `page` on `/planner` and `true` on `/todos`.
- [ ] Component tests (`planner/planner.browser.test.tsx`, on `upcomingWorld.tsx`'s fixed clock, renamed `plannerWorld.tsx`):
  - On each tab the `h1` is "Planner" and the current tab link is that tab. The tabs go to `/planner`, `/todos` and `/planner/past`.
  - A writer's "Add" menu has Appointment, Reminder and Todo. Todo opens the sheet, and Cancel returns to the tab it came from (on Planner and on Past).
  - A viewer has no "Add" menu.
- [ ] Component test (`frame.browser.test.tsx`): the tab bar and `SectionNav` show four sections, and Planner is current on `/planner`, `/todos` and a todo's page.
- [ ] The renamed Upcoming tests (`planner.browser.test.tsx` for today's `upcoming.browser.test.tsx`, `plannerEvents`, `plannerSeries`, `plannerRemind`, `plannerPasses`, `plannerTodos`) and `timelineUpcoming` pass on the new routes.
- [ ] `pnpm check` passes; `pnpm test:components --changed prd/tasks-2`; `pnpm prd browser --changed` once (report anything it names).

**Blocked by:** 2. **Blocks:** none.

---

## Slice 4: The connector says todo

Stack: no · Reads: docs/domain/connectors.md, docs/domain/assistant.md · Tests: integration

**User stories:** 19.

**What to build.**

- The tools `add_task` → `add_todo` and `list_tasks` → `list_todos`: their files, names and descriptions ("todos", the assignee by name, `mine`). `tools/index.ts` keeps its order.
- `assistantActionService`'s action kind becomes `addTodo` (and quick entry's `runActions` twin if they share the kind). Answers use `actionPreview`'s "Todo" wording and slice 2's links.
- connectors-2's MCP prompts and server instructions say todos wherever they say tasks.

**Acceptance criteria.**

- [ ] Integration tests (`mcpWrites.int.test.ts`, `readTools.int.test.ts`, `mcp.int.test.ts`, `assistantAction.int.test.ts`): `tools/list` lists `add_todo` and `list_todos` and no task tool; `add_todo` creates a todo with its via tag and answers with "Todo" and a `/todos/<id>` link; `list_todos` keeps its open, done and `mine` behaviour; a call to `add_task` is an unknown tool.
- [ ] The prompts' text has no "task" (a test over `prompts/list` or the instructions string).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once (`roundtrip`'s `/mcp` write, if it names a task tool, is updated and reported).

**Blocked by:** 2. **Blocks:** none.
