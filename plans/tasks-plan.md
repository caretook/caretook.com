# Plan: Tasks

> Source PRD: [`plans/tasks-prd.md`](tasks-prd.md). User-story numbers (US) refer to it. Backlog item B-55. Topic `tasks`.

## Status

| Slice | Wave | State                                               | Merge into `prd/tasks` (slice commits) |
| ----- | ---- | --------------------------------------------------- | -------------------------------------- |
| 1     | 1    | merged                                              | eccc68f (314ec1a, 7e0a210, 5d41650)    |
| 2     | 2    | merged                                              | 897bc7d (b46f601, bc19797)             |
| 3     | 3    | merged                                              | 95f4c12 (bd0a951)                      |
| 4     | 2    | merged (conflict in `lib/sync/tasks.ts`, both kept) | 80018b2 (d859ea0)                      |
| 5     | 3    | merged                                              | 0d22486 (56b8721)                      |
| 6     | 2    | merged                                              | e7d622a (4708991)                      |
| 7     | 2    | merged (fixed `lib/taskSheets.ts` re-export path)   | 38a3c7a (b3da051)                      |
| 8     | 2    | merged 5a5eadf (138f2ce)                            |                                        |

**Landing:** land each wave as soon as it's green. **Landing mode: run everything through** (queued with `pnpm prd queue tasks`, 2026-11-19): start every ready slice, land each green wave without asking, clean up; ask only real questions.

**External blockers (2026-11-19):** `assistant` wave A (slices 1–5) is in `dev` (a38609b); its slice 6 landed in `dev` as 9ae6b0d (sync it at the wave-1 boundary, not mid-wave); slice 7 (running: `assistantActions` givePass, quick-entry suggestions, `SimpleTimeline`'s Now block, `visitPrep`) is not. Decision: slices 3 and 4 count as unblocked once slice 1 is merged and `dev` synced (slice 7 doesn't touch Upcoming, the strip, or the provider and medication pages); slices 6 (simple view) and 7 (`assistantActions`) wait for assistant slice 7 in `dev`. **Update:** assistant slice 7 landed in `dev` as 7f3ec10 (plus c17c121, a GroupMenu fix), so the whole `assistant` PRD is in `dev`: slices 3, 4, 6 and 7 are all ready once slice 1 is merged and `dev` is synced. For slices 6 and 7 (from assistant's hand-off): `givePass` in `assistantActions`, `context.passes` in the parser, `runActions` returns `{ ids, byAction }`, new `removeEntries`, quick-entry Undo through `lib/passUndo.ts` (`undoFor(groupId, { now, place })`), the simple view's Now block `timeline/SimpleNow.tsx` after the box, `doseSlotsBetween` in `lib/dueDoses.ts`; see docs/domain/assistant.md. `check-migration` slice 2 is merged on `prd/check-migration` (120db6e) but not in `dev`, so slice 8 waits. B-55 claimed by `prd/tasks`.

**Heads-up from check-migration (2026-11-19):** its wave 1 lands in `dev` within the hour. It adds `SYNC_MATRIX` (`scripts/browser-checks/sync-matrix.mjs`), and `scripts/loops/sync-matrix.test.mjs` fails for any device-schema table or `HANDLERS` key without a row. So the first `pnpm prd sync` after slice 1 merges will fail `pnpm check` until `task` has a row: add a cheap one at that sync (or run slice 8 straight away, since its blocker is then in `dev`). Lean ceiling is 357 s (`lean-ceiling` in `scripts/loops/checks`), raisable only by the user.

**Progress:** slice 1 merged as eccc68f; `dev` synced in as 3a3d27b (assistant complete; conflicts in `appUrls.ts`, `appUrls.test.ts`, `check-areas` were additive, both kept; typecheck clean). Migration is `0022_tasks.sql` on top of `dev`'s 0021. Slices 2, 4, 6 and 7 started together (stackless), since all of assistant is in `dev`. Slice 3 and 5 start when 2 merges.

**When to land:** this PRD has a migration, so (the user's standing preference for migration PRDs, 2026-11-19) hold landing until every slice is merged, then run checks once at the end. Never `--suite` without asking the user first.

**Slice 1's docs to fold at landing:** new `docs/domain/tasks.md` (table, 3 DB checks, hand-edited event FK and publication in 0022, `assignee_id` set null on account deletion; the due rule; `taskRules` exports; `taskService` and the viewer rule; the leaver via `releaseAssignee` from `careGroupMemberService.remove`; the device module and done-only PATCH; `taskDisplay`, `taskList`, `taskUndo`; the list: chips with default fixed at open, sections, Done paged by 20 and filtered by the chip; sheets: `TaskForm`, `AssigneeField`, `taskSheets` guards, `TASK_SHEET_STATE`; `components/tasks`; seeds with id prefixes `…3f1d2be0…`/`…3f1d2be1…`) and its _Area index_ row; `care-groups.md` permission row (`task`: read any member, create writers, update writers and viewers (viewers completion on their own tasks only), delete writers soft) and the leaver rule; `sync.md` (stream incl. soft-deleted rows, `note_document.task_id`, publication, `taskOp`, the `task` subject); `app-shell.md` (`GROUP_SECTIONS` ends with Tasks, `ListTodo`; `appUrls` `tasks`/`task`/`newTask`/`editTask`/`TASK_PREFILL_PARAMS`); `data-layer.md` (migrations 0000–0022); `components.md` (`components/tasks/`, the fixture `task` builder). Choices to note: Done follows the chip; native date/time inputs; the leaver's name falls back to "Former member". Slice 1 also fixed `upcoming.mjs` for a fifth section.

**Slice 6's hand-off (4708991):** `timeline/SimpleTasks.tsx` + `useSimpleTasks.ts` after `SimpleNow`, before the tiles; `TaskTick` gained an optional `large` prop; `check-areas` two rules. `--changed --list`: no checks. `pnpm check` 3310/3311: `test/device.browser.test.tsx` timed out under load, passed alone 9/9. Docs: `timeline.md` simple-view bullet for My tasks (order box, Now, My tasks, tiles, Remove last, rows; cap `SIMPLE_TASKS_CAP` 5; See all → `tasks?who=mine`; stays up while its Undo is offered; component test `timelineSimpleTasks.browser.test.tsx`); `tasks.md`: `TaskTick large`.

**Slice 4's hand-off (d859ea0):** `lib/upcomingTasks.ts` (`withDueTasks`, `showsTasks`), `upcoming/UpcomingTaskRow.tsx`, `useUpcomingData` merges after `withDueDoses` (90-day horizon), `TaskUndoStatus` on Upcoming; `lib/taskStrip.ts`, `timeline/TaskStrip.tsx` + `useTaskStrip.ts`, two lines in `timeline/route.tsx` after `MedicationStrip`; appended `dueTasksQuery`/`dueTasksThrough`/`useDueTasks` to `lib/sync/tasks.ts` with **its own imports inside the appended block** (dedupe `useMemo` etc. if another slice imports at the top); `check-areas` rule `upcoming/UpcomingTaskRow.tsx -` above `upcoming/*`. Strip link `?who=mine` or `?who=everyone`. `pnpm check` passed (3339). `--changed --list` names **roundtrip, upcoming, search** for landing. Docs: `appointments.md` "Tasks in Upcoming" after due doses; `timeline.md` task strip after the medication strip (red/amber, mine first, +N more, viewers see it, hidden in simple mode); `tasks.md` the three device additions.

**Slice 2's hand-off:** task page `routes/app/groups/task/` (`TaskHeader`, `TaskActions`, `TaskDetails`, `TaskCompletion`, `loadTask`, `useTaskPage`, `useTaskNotes`, `taskPage.ts`), `noteDocumentService.liveOwner` task lookup, `createTaskDocument`, `taskSheets` moved to `lib/taskSheets.ts` (+ `taskPageState`, `listSearchFromState`), list rows open the page for everyone. `--changed --list`: **routing**. Docs: `live-notes.md` (`task` subject, `taskNotFound`, `createTaskDocument`); `tasks.md` the page (regions, 404s, delete, chip carried back, taskSheets in lib/); components/layout: `task/` beside `tasks/`.
**Slice 7's hand-off:** `addTask` in `assistantActionZSchema` (no id, **no `occurredAt`**, kind `task`), parser prefixes `t:`/`task:`/`todo:`/`to-do:`, `context.members` matching, due read forward; runner via `plannedTask` (split out of `createTask`), `removeEntries` removes tasks; "Saved N entries and M tasks"; Edit → `tasks/new` with prefills `title`/`assigneeId`/`dueTime` (`TaskForm` `prefill`); `lib/taskSheetLink.ts` holds `TASK_SHEET_STATE`/`openedFromApp`. `--changed --list`: none. Docs: `assistant.md` (all of that, fix the "every action has occurredAt" line); `tasks.md` (`plannedTask`, prefills, taskSheetLink, quick entry as a way in).
**Fixed (48c7f9a):** `entry.browser.test.tsx` › "who's writing" failed every run on `dev` too (reproduced at 8dd6ead and dev's tip, so time-dependent): the avatar drew before the members query resolved the name. The test now waits for the name. Told the assistant and check-migration orchestrators.
**Checks needed at landing so far:** routing, upcoming, roundtrip, search (by name / from `--changed --base dev`), plus the lean set (migration) — ask the user before `--suite`.

**Slice 5's hand-off (56b8721):** `taskSearchDocument` in `searchDocument.ts`, `task` appended to `SEARCH_ITEM_TYPES`, new `SERVER_SEARCH_ITEM_TYPES` (server search and `search.query` scopes exclude tasks; edits in `searchService.ts` and `packages/api/src/search.ts`); device triggers via `searchTables.ts`, `readTasks`, `SEARCH_INDEX_VERSION` 2; search page Tasks section after medications (`TaskResultItem`, Done badge, notes snippet, `?all=task`), placeholder mentions tasks. `--changed --list`: **sign-in, signout-wipe, search**. Docs: `search.md` (all the above; server search doesn't cover tasks); `tasks.md` a pointer to search.md.

**Slice 3's hand-off (bd0a951):** `taskService.releaseEvent` called from `timelineEntryService.remove` (now in a transaction; soft deletes don't fire the FK), device `removeEntry` clears `event_id` too; pickers (`taskLinks.ts`, `LinkPickerField`, `TaskLinkFields`, link prefills); task page "Linked to" (`TaskLinks.tsx`); `LinkedTasks`/`useLinkedTasks` in `components/tasks` on the entry page (events), provider page (after visit prep), medication page (after refills) — writers keep a lone "Add task" when empty; seeds +3 linked tasks (`…3f1d2be01010–12`), `appointmentIdIn` in `seeds/appointments.ts`. `--changed --list`: **phase2, roundtrip, providers, medications, upcoming, search**. Docs: `tasks.md` (links, pickers, page rows, LinkedTasks, device queries, the deleted-event rule, linked seeds); one line each in `appointments.md`, `providers.md`, `medications.md`.

**Wave 3 merged** (3 then 5); typecheck clean. Only slice 8 left (waiting on check-migration's wave 1; asked its ETA, else run 8 as a plain roundtrip step).

**Synced `dev` (d2bf131, 2026-11-20):** check-migration waves 1–2 are in `dev` (2040ed3): `SYNC_MATRIX`, and the routing, search and settings-layout checks became component tests. The entry who's-writing conflict took `dev`'s `device.settle()` over 48c7f9a. Typecheck clean; `sync-matrix.test.mjs` fails only for the missing `task` row. Lean ceiling is now 350 s and the lean total is exactly 350, so slice 8 must fit or report the overage for the user. Slice 8 started.

**Slice 8 merged (5a5eadf, 2026-11-20):** the `task` matrix row and step 6d in `roundtrip` (sharing 6c's offline window): roundtrip passed 53/53 in 29 s (usual 31 left in the manifest; lean total stays 350/350). B-55 `done` at 5a5eadf; tasks-8 removed. Its `pnpm check` hit two base failures, fixed here in 52ef672: `visitPrep` › "the start can move back" (fails on `dev` too whenever the last visit is on a 31st: a month back is 9/31, which React Aria commits only on blur) and `linkedTasks` › "a note's page has none" (the entry's hidden print view repeats the text). `dev` synced again (B-133 timeline fix, check tooling). Docs folded: new `docs/domain/tasks.md` and its _Area index_ row; care-groups, sync, app-shell, data-layer, components, layout, live-notes, appointments, providers, medications, timeline, search, assistant. `docs/loops.md` unchanged (the lean set's flows didn't change).

**Landing checks (a61f277, 2026-11-20):** `pnpm prd check` passed (3518 tests). `--suite` (the user approved it) all pass; first-sync flaky (failed at load 10–17, passed on the retry). By name: providers, medications, upcoming, care-periods pass. Landing.

**Landing checks to run (once, on the synced tip):** the lean set (`--suite`, migration + sync-config: **ask the user first**) plus by name the `e2e no` ones the diff names: providers, medications, upcoming (search and routing are component tests now), and whatever `--changed --base dev --list` adds.

**Browser checks run so far:** slice 1's `--changed` ran the whole lean set plus routing, providers, care-periods, upcoming on slice 1's tip: all pass (upcoming after its fix).

**Backlog:** claim B-55 when slice 1 starts; `done` after slice 8 and slice 7 have both merged (the last of the PRD).

Fold into the area docs at each landing (AGENTS.md, _Area index_; only rules and pointers into AGENTS.md itself):

- **Slice 1:** a new `docs/domain/tasks.md` (the table, the due rule, `taskRules`, the service, the viewer completion rule, the leaver, the device module, the list and sheets, seeds) and its _Area index_ row; the `task` row in `docs/domain/care-groups.md`'s permission table and the leaver in its membership rules; the stream, publication and `taskOp` in `docs/domain/sync.md`; the section in `docs/domain/app-shell.md`.
- **Slice 2:** the `task` subject in `docs/domain/live-notes.md`; the page in `tasks.md`.
- **Slice 3:** links and `LinkedTasks` in `tasks.md`, plus one line each in `appointments.md`, `providers.md` and `medications.md`.
- **Slice 4:** task rows in `appointments.md` (Upcoming); the strip in `timeline.md`.
- **Slice 5:** `taskSearchDocument` and the result type in `search.md`.
- **Slice 6:** the card in `timeline.md` (the simple view).
- **Slice 7:** `addTask` in `assistant.md`.
- **Slice 8:** the roundtrip step in `docs/loops.md` if the lean set's list of flows changes.

## Architectural decisions

- **Table `task`** (one migration for the PRD, added by slice 1 with **every column**, so later slices never regenerate it): `id` (UUID, device-made), `group_id`, `recipient_id` (composite FK to `care_recipient`), `title`, `assignee_id` (user, nullable; a member when set or changed), `assignee_name` (text, nullable; a DB check: never both with `assignee_id`), `due_on` (date, nullable), `due_time` (`HH:MM`, nullable, only with `due_on`), `done_at`, `done_by` (both or neither), `provider_id`, `medication_id` (composite FKs, `NO ACTION`), `event_id` (composite FK to `timeline_entry`, `ON DELETE SET NULL ("event_id")`, **hand-edited** in the SQL like `rescheduled_to`), `deleted_at`, timestamps and audits; unique `(group_id, id)`; the hand-written `ALTER PUBLICATION`. Keep both hand edits when regenerating.
- **`note_document` subject `task`** (`task_id`, cascading composite FK on the exactly-one-owner check) is in slice 1's migration too, used from slice 2.
- **The due time is wall-clock in the recipient's zone**, like medication slots. Overdue, today, upcoming and ordering are worked out by `taskRules`, never stored.
- **Permissions:** `PERMISSIONS.task`: read any member; create writers; update writers and viewers; delete writers (soft). **The service limits viewers** to `completionOnly` changes on tasks whose `assignee_id` is them (`taskService:viewerCompletionOnly`, 403). A free-text assignee's task is completed by writers only.
- **The leaver:** removing or leaving a membership turns that user's open tasks in the group into `assignee_name` = their display name, `assignee_id` null, in the same transaction.
- **Sync:** `task` in the `care_groups` stream (soft-deleted rows included), the device schema and the upload switch (`taskOp`: PUT upsert, PATCH update / complete / reopen / soft remove, DELETE soft remove; a changed group or recipient → `immutable`; a done-only PATCH maps to `complete`/`reopen`).
- **Routes** (children of the group route, through `appUrls`): `tasks` (a `GROUP_SECTIONS` entry after Upcoming, lucide `ListTodo`, `?who=mine|unassigned|everyone`), `tasks/new` (prefills `providerId`, `medicationId`, `eventId`, `dueOn`), `tasks/:taskId`, `tasks/:taskId/edit`. Sheets close back through link state; deep links close to the list.
- **Never written as entries:** completing a task writes no timeline entry; tasks in Upcoming and the strip are worked out like due doses.
- **Registries take additive entries at the end of their group:** `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, the upload switch, `routes.ts`, `GROUP_SECTIONS`, `appUrls`, `assistantActionZSchema`, `scripts/loops/check-areas`.

## How to run this plan

- **Wave 1: slice 1** (the tracer bullet; it owns the migration and every registry entry).
- **Wave 2: slices 2, 4 and 8.** 2 owns the task page; 4 owns Upcoming and the timeline strip; 8 owns `roundtrip`. 4 needs `assistant` in `dev` and 8 needs `check-migration` slice 2 in `dev`: if either isn't there yet, start the others and run it when it is (8 can instead add a plain `roundtrip` step and leave the matrix row to `check-migration`; say so in the hand-off).
- **Wave 3: slices 3, 5 and 6.** 3 owns the pickers and `LinkedTasks` (entry, provider and medication pages); 5 owns search; 6 owns the simple view card. 3 and 6 need `assistant` in `dev`.
- **Wave 4: slice 7** (quick entry), after `assistant` slice 7 is in `dev`.
- Merge in number order within a wave, with no checks between merges.
- **Stacks:** only slices 1 (the seeds on a fresh device) and 8 (`roundtrip`) need one; the others are stackless (integration tests on the shared test Postgres, component tests on the test device). A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing.
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/tasks`. Only slice 8 adds an end-to-end step; every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **Running beside other PRDs:**
  - `assistant`: hot on the timeline route folder, Upcoming, the entry page, the provider page, the simple view and `assistantActions`. Slices 3, 4, 6 and 7 wait for it in `dev`; sync `dev` into `prd/tasks` before starting them. If its migration lands first, regenerate on top.
  - `check-migration`: moves area checks to component tests and owns `roundtrip`'s matrix; slice 8 follows its lean rule. Additive edits to `check-areas`.
  - `hosting`: one migration each (regenerate on top of whichever lands first); `routes.ts` additive. No other overlap.
  - `loop-recovery`: no overlap.
- Every slice ends with a hand-off (AGENTS.md, _Loop rules_), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: The task list end to end

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/care-groups.md, docs/domain/components.md, docs/domain/app-shell.md, docs/domain/medications.md, docs/layout.md · Tests: unit, integration, component

**User stories:** 1–13, 16–21, 32–37, 44, 48, 49.

**What to build:**

- **The migration** with the whole `task` table and the `note_document` `task` subject (see _Architectural decisions_), `PERMISSIONS.task`, and the schema exports.
- **`taskRules`** (pure, client-safe): the create and update schemas and cross-field rules (time needs a day; done fields together; member xor typed name), `assigneeOf`, `taskState(task, now, timeZone)`, `taskOrder`, `doneOrder`, `canCompleteTask`, `completionOnly`.
- **`taskService`:** create (idempotent on id), update (merged-row validation; assignee membership when it changes; link columns accepted but checked as live and in the group, the event an event), complete and reopen (server sets `done_by`), remove (soft), and the viewer rule. **The leaver** in `careGroupMemberService`'s removal and leave paths.
- **Sync:** stream, publication, device schema, upload `taskOp`.
- **Device** (`lib/sync/tasks.ts`): `tasksQuery`, `taskQuery`, the local writes with local role checks, and the pure `lib/taskDisplay.ts` and `lib/taskList.ts`.
- **The Tasks section:** the `GROUP_SECTIONS` entry and route; chips (default mine when I have open tasks, else everyone; typed-name tasks under Everyone); sections (Overdue, Today, a day per later day, No due date); rows with a tick (shown only to those who may complete), due text and assignee chip; one shared 10 s Undo with a polite status; Done below, paged, with Reopen. "Add task" for writers.
- **The sheets** (`tasks/new`, `tasks/:taskId/edit`): `TaskForm` with title, the assignee `ComboBox` (members, "Unassigned", and "Assign to "<typed>" (not in the group)"), due `DateField` and optional time; guards for viewers and missing tasks. Until slice 2, a row opens the edit sheet for writers and nothing for viewers.
- **Seeds** (`seeds/tasks.ts`, own ids, by days ahead): about eight for Dev Family (member@, caretaker@, viewer@, one typed name "Aunt May", unassigned; overdue, today, later, undated; two done), one for Dev Family 2. Link columns stay empty until slice 3 adds linked seeds (appended).
- **`check-areas`** rules for the new screens and modules.

**Acceptance criteria:**

- [ ] Unit (`taskRules`): validation, `taskState` across midnight, a DST change and two zones, `taskOrder`/`doneOrder`, `canCompleteTask` for each role and for a typed-name task, `completionOnly`, `assigneeOf`.
- [ ] Unit: `taskDisplay` wording and `taskList` sections and chip defaults.
- [ ] Integration (`taskService`): every role against `task` (read, create, update, delete); a viewer completes and reopens their own task, is refused (`viewerCompletionOnly`) on another's, on a typed-name task and on a title change; member xor typed name; assignee must be a member; idempotent create; soft delete; the leaver turns open tasks into a typed name and leaves done tasks alone.
- [ ] Integration (upload): `taskOp` PUT, PATCH (edit, done-only from a viewer, soft remove), DELETE, and `immutable` on a changed group.
- [ ] Component: the list (chips, sections, tick and Undo, Done and Reopen, viewer sees ticks only on their own tasks and no Add), the sheet (typed name, due with and without time, guards).
- [ ] `pnpm datastore:reset` seeds the tasks; the list shows them on a fresh device.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** none. **Blocks:** 2, 4, 6, 7, 8.

---

## Slice 2: The task page and live notes

Stack: no · Reads: docs/domain/live-notes.md, docs/domain/components.md, docs/domain/medications.md · Tests: unit, integration, component

**User stories:** 12, 13, 15, 22, 35.

**What to build:**

- **`tasks/:taskId`**: header regions (title, a Done or Overdue badge, Edit and a ⋯ with Reopen and Delete for writers), assignee (a member or a typed name), due, the done-by line, and the complete/reopen button for whoever may complete. Missing, deleted and other-group tasks are the 404. Rows on the list now open the page.
- **Live notes:** `noteDocumentService.create` accepts a live task; `createTaskDocument` on the device; the document is created on the first real change; read-only for viewers (including an assignee viewer).
- **Delete** confirms, soft-deletes, and returns to the list.

**Acceptance criteria:**

- [ ] Integration: a `task` document is created for a live task and refused for a deleted one or another group's.
- [ ] Component: the page for a writer, an assignee viewer (complete button, read-only notes, no Edit) and another viewer (nothing to press); the 404s; Delete.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported (expect `live-notes` if the editor's subject list changed).

**Blocked by:** 1. **Blocks:** 3, 5.

---

## Slice 3: Links and backlinks

Stack: no · Reads: docs/domain/providers.md, docs/domain/appointments.md, docs/domain/medications.md, docs/domain/live-notes.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 14, 23–28, 45–47.

**What to build:**

- **Pickers in `TaskForm`:** a provider (`ProviderPickerField`), an appointment (upcoming and the last 30 days' events, soonest first), a current medication. Prefills from `tasks/new?providerId=…&eventId=…&medicationId=…`.
- **On the task page:** link rows: the provider with `ContactActions`, the appointment with its time (struck through when cancelled), the medication; a deleted provider or medication greyed "(removed)"; a deleted event's link is gone (the FK and the device's `removeEntry` clear `event_id`).
- **`LinkedTasks`** (`components/tasks`): a region on the event entry page, the provider page and the medication page listing open linked tasks with ticks, hidden when empty, and "Add task" (writers) prefilled with the link.
- **Seeds:** append linked tasks (a provider, an upcoming appointment, a medication).

**Acceptance criteria:**

- [ ] Integration: links must be live and in the group, the event an event; a link to a soft-deleted provider stays readable; deleting an event sets `event_id` null.
- [ ] Unit: the event picker's choices and order.
- [ ] Component: the pickers and prefills; the page's link rows including "(removed)" and cancelled; `LinkedTasks` on all three pages for a writer and a viewer, hidden when empty.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 2 and `assistant` in `dev`. **Blocks:** none.

---

## Slice 4: Upcoming and the task strip

Stack: no · Reads: docs/domain/appointments.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**User stories:** 29–31.

**What to build:**

- **Upcoming:** `withDueTasks` (pure) merges open dated tasks under their day (overdue under Today, never "Now"), rendered by `UpcomingTaskRow` with a tick for those who may complete and a link to the task; hidden under a kind or author filter. `dueTasksQuery` and `useDueTasks` (once-a-minute clock).
- **The task strip** on the timeline, after the medication strip (`STRIP_CLASS`): shown while there are overdue or due-today tasks; "Overdue: Call pharmacy · +2 more" (red) or "Today: Pick up walker" (amber), mine first in the wording; links to the Tasks list (`?who=` set to mine when the named task is mine).

**Acceptance criteria:**

- [ ] Unit: `withDueTasks` placement (overdue, today, later, all-day before timed) and the strip's pick and wording.
- [ ] Component: Upcoming with task rows (writer, assignee viewer, other viewer, a kind filter hiding them); the strip's states and its link; nothing shown when no task is due.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 1 and `assistant` in `dev`. **Blocks:** none.

---

## Slice 5: Search

Stack: no · Reads: docs/domain/search.md, docs/domain/components.md · Tests: unit, component

**User stories:** 38.

**What to build:**

- `taskSearchDocument` (title weighted, notes text as body; deleted rows none) in the shared builder; device index triggers for `task`; a `SEARCH_INDEX_VERSION` bump.
- A `task` result type on the search page after medications (done tasks marked), opening the task page; `?all=task`.

**Acceptance criteria:**

- [ ] Unit: `taskSearchDocument` (title, notes, deleted).
- [ ] Component: the search page lists a matching task by title and by notes text, marks a done one, and opens it.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported (expect `search` if it's still an area check).

**Blocked by:** 2. **Blocks:** none.

---

## Slice 6: My tasks in simple mode

Stack: no · Reads: docs/domain/timeline.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: component

**User stories:** 39, 40.

**What to build:**

- A "My tasks" card in the simple view: open tasks assigned to me, overdue and today first, at most five with "See all" to the list, large tick buttons with Undo; shown to viewers too; hidden when I have none. Not one of the four tiles.

**Acceptance criteria:**

- [ ] Component: the card for a writer and a viewer (tick, Undo), its order and cap, hidden when empty, and the simple view's other regions unchanged.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 1 and `assistant` in `dev`. **Blocks:** none.

---

## Slice 7: Quick entry adds tasks

Stack: no · Reads: docs/domain/assistant.md, docs/domain/timeline.md · Tests: unit, component

**User stories:** 41–43, 49.

**What to build:**

- `addTask` appended to `assistantActionZSchema` (`title`, `assigneeId?`, `dueOn?`, `dueTime?`, link ids optional; no task id).
- The parser: `t:` forces a task; `todo:` and `task:` prefixes; "for <name>" and "@<name>" against **members' names only** (no match stays in the title); due phrases through the time parser (day and optional time, future allowed); members join the parser's context.
- The runner writes `addTask` in the batch through the device's task writes; the preview card reads "Task: Call pharmacy · Fri · Sam", with "Note instead" as the alternative.

**Acceptance criteria:**

- [ ] Unit: rows in `quickEntry.test.ts` for each prefix, member and non-member names, due phrases, and a task beside other parts in one line.
- [ ] Component: the box previews and saves a task; Edit opens the task sheet filled in; a viewer gets no box (as today).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 1 and `assistant` in `dev` (its slice 7). **Blocks:** none.

---

## Slice 8: Tasks across devices (the roundtrip step)

Stack: yes · Reads: docs/loops.md, docs/domain/sync.md · Tests: e2e:roundtrip

**User stories:** 36, 37, 48.

**What to build:**

- `task` joins `roundtrip`'s sync matrix (device A writes, device B sees), and its table list's unit test.
- One step: viewer@ ticks their seeded task offline, reconnects, and member@'s device shows it done with the done-by line; viewer@'s title change (forced through the device) is refused and restored on the next sync. Tagged rows, cleaned up.
- `roundtrip`'s usual seconds updated; the lean ceiling holds.

**Acceptance criteria:**

- [ ] `pnpm prd browser roundtrip` passes with the new step; its ■ lines in the hand-off.
- [ ] The matrix's unit test lists `task`.
- [ ] The lean budget still fits (or the hand-off says by how much it doesn't, for the user).
- [ ] `pnpm check` passes.

**Blocked by:** 1 and `check-migration` slice 2 in `dev`. **Blocks:** none.
