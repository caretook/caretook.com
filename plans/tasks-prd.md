# Tasks PRD (B-55)

Status: planned (2026-11-19). Plan: [`tasks-plan.md`](tasks-plan.md).

## Problem Statement

A care group shares far more than appointments and doses: someone has to call the pharmacy, pick up the walker, fax the insurance form, ask the neurologist about the new tremor, bring the insurance card to Tuesday's visit. Today those live in a group text, on a fridge note or in one person's head. Caretook's only stand-in is a future note (a "reminder" in Upcoming), which has no owner, can't be ticked off, and disappears into the timeline once its time passes. Caretakers can't see what's still open, who is doing it, or what's overdue, and helpers who only watch (viewers: a neighbour, a grandchild) can't say "done" for the errand they took on.

## Solution

A **Tasks** section in every care group: a shared todo list where each task has a title, at most one assignee (a group member, a name typed in for someone outside the group such as "Aunt May", or nobody, meaning anyone), an optional due day with an optional time in the recipient's time zone, and a done state with who finished it and when. A task can carry live notes and can link to one provider, one appointment and one medication.

- The list shows open tasks by due (overdue, today, later days, then no due date), filtered by Mine / Unassigned / Everyone, with a Done list below. Ticking a task completes it, with Undo.
- Writers (owner, admin, caretaker) create, edit, assign, complete, reopen and delete. **Viewers can complete and reopen tasks assigned to them**, and nothing else.
- Open tasks with a due day show in **Upcoming** under their day, and a **task strip** on the timeline says what's overdue or due today. Event, provider and medication pages list their open tasks with an "Add task" prefilled with the link.
- Tasks are in **search**, have a **"My tasks" card in simple mode** (tick to complete, for viewers too), and can be added from **quick entry** (`todo: call pharmacy friday`), through a new `addTask` action that `connectors` will reuse.
- Everything works offline and syncs like the rest of the group's data. Completing a task leaves no timeline entry; the record stays on the task.

## User Stories

1. As a caretaker, I want a Tasks section in my care group, so that the group's errands live in one place instead of a group text.
2. As a caretaker, I want to add a task with just a title, so that writing one down takes seconds.
3. As a caretaker, I want to assign a task to one member of the group, so that everyone knows who is doing it.
4. As a caretaker, I want to leave a task unassigned, so that anyone can pick it up.
5. As a caretaker, I want to assign a task to someone who isn't in the group by typing their name ("Aunt May", "the neighbour"), so that errands handled by outside helpers are tracked too.
6. As a caretaker, I want to give a task a due day, so that it's clear when it has to be done.
7. As a caretaker, I want to add an optional time to the due day, so that "call before the office closes at 5" is exact.
8. As a caretaker, I want due days and times to be in the recipient's time zone, so that a sibling in another state sees the same deadline.
9. As a caretaker, I want a task with no due day, so that "someday" errands can still be tracked.
10. As a caretaker, I want to tick a task done from the list, so that finishing it is one tap.
11. As a caretaker, I want an Undo after ticking a task, so that a mis-tap costs nothing.
12. As a caretaker, I want to see who completed a task and when, so that I don't redo it.
13. As a caretaker, I want to reopen a done task, so that something that turned out not to be finished comes back.
14. As a caretaker, I want to edit a task's title, assignee, due and links, so that it stays accurate as plans change.
15. As a caretaker, I want to delete a task, so that mistakes and cancelled errands go away.
16. As a caretaker, I want my open tasks shown first by default, so that I see what's mine when I open the list.
17. As a caretaker, I want to switch between Mine, Unassigned and Everyone, so that I can see the whole group's load or what's up for grabs.
18. As a caretaker, I want overdue tasks at the top and marked as overdue, so that nothing slips.
19. As a caretaker, I want open tasks grouped by Today and the following days, so that I can plan the week.
20. As a caretaker, I want tasks without a due day after the dated ones, newest first, so that they don't bury urgent ones.
21. As a caretaker, I want a Done list, newest first, so that I can look back at what was handled.
22. As a caretaker, I want live notes on a task, so that I can record what the pharmacy said, together with others, in real time.
23. As a caretaker, I want to link a task to a provider, so that "Call Dr Lee's office" has the call button right there.
24. As a caretaker, I want to link a task to an appointment, so that "Bring insurance card" sits with Tuesday's visit.
25. As a caretaker, I want to link a task to a medication, so that "Refill Metformin" opens the medication.
26. As a caretaker on an appointment's page, I want to see its open tasks and add one prefilled with that appointment, so that visit prep includes the errands.
27. As a caretaker on a provider's page, I want to see open tasks linked to that provider, so that I know what's pending with that office.
28. As a caretaker on a medication's page, I want to see open tasks linked to that medication, so that refills and questions are visible where I look.
29. As a caretaker, I want open tasks with a due day in Upcoming under their day, so that errands and appointments are in one schedule.
30. As a caretaker, I want a strip on the timeline saying what's overdue or due today, so that I notice without opening Tasks.
31. As a caretaker, I want to tap the strip to go to the tasks it names, so that acting on it is quick.
32. As a viewer assigned a task, I want to tick it done, so that the group knows the groceries were picked up.
33. As a viewer, I want to reopen a task I completed by mistake, so that I can fix it myself.
34. As a viewer, I want to see the group's tasks but not change them, so that I can help without disturbing the plan.
35. As a viewer, I don't want controls I can't use, so that the screen isn't confusing.
36. As a member, I want tasks to work offline, so that I can tick one done in a hospital basement.
37. As a member, I want a task completed on another device to show as done on mine without reloading, so that we don't double up.
38. As a member, I want tasks in search, so that "insurance form" finds the task and its notes.
39. As a simple mode user, I want a "My tasks" card with big tick buttons, so that I can finish my errands without learning the full app.
40. As a viewer in simple mode, I want the "My tasks" card too, so that I can complete what I was given.
41. As a caretaker, I want to type "todo: call pharmacy friday" in quick entry, so that adding a task is as fast as logging a vital.
42. As a caretaker, I want quick entry to understand "for Sam" or "@Sam" as the assignee, so that I can assign as I type.
43. As a caretaker, I want quick entry's preview card to show the task before it saves, so that I can fix a misread.
44. As an owner, when a member leaves or is removed, I want their open tasks to keep their name as a typed-in assignee, so that the group still knows who had them and can reassign.
45. As a member, I want a task linked to a deleted provider or medication to still show the link greyed "(removed)", so that context isn't lost.
46. As a member, I want a task linked to an appointment that's deleted to lose the link quietly, so that it doesn't point at nothing.
47. As a member, I want a cancelled appointment's tasks to stay open and still show the link, so that I can decide what to do with them.
48. As an owner, I want the same permissions enforced on the server, so that a modified client can't let a viewer rewrite tasks.
49. As a future connector user, I want my own assistant to add tasks through the same action shape, so that tasks work from Claude or ChatGPT later.

## Implementation Decisions

**Data model** (a new `task` table, one migration):

- Columns: `group_id`, `recipient_id` (composite FK to `care_recipient`, like medications and care periods), `title` (required, trimmed, capped like other titles), `assignee_id` (a user, nullable; must be a member of the group when set or changed), `assignee_name` (free text for someone outside the group, trimmed, capped like a name; nullable; **never both** with `assignee_id`, a DB check), `due_on` (a date, nullable), `due_time` (`HH:MM`, nullable, only with `due_on`), `done_at` and `done_by` (both set or both null), `provider_id` and `medication_id` (composite FKs, `NO ACTION`: both are only soft-deleted, so the link greys "(removed)"), `event_id` (composite FK to `timeline_entry`, `ON DELETE SET NULL ("event_id")`, hand-edited in the SQL like `rescheduled_to`; must be an event when set or changed), `deleted_at`, plus the usual timestamps and audits. Unique `(group_id, id)`.
- **The due time is a wall-clock time in the recipient's zone**, not an instant, like medication slots: a deadline stays "Friday 17:00" across DST and when the recipient's zone changes. "Overdue", "today" and ordering are worked out from `due_on`, `due_time`, now and the zone, never stored.
- `note_document` gets the subject `task` (`task_id`, a cascading composite FK on the exactly-one-owner check). The document is created on the first real change, as for medications.
- Keep the hand-written `ALTER PUBLICATION` and the event FK when regenerating the migration.

**Pure rules** (`taskRules`, client-safe in `packages/data`'s schema exports; the deep module everything else leans on):

- The Zod schemas for create and update, and the cross-field rules (time needs a day; done fields together).
- `taskState(task, now, timeZone)` → `done | overdue | today | upcoming | undated`. An undated time-less task due today is "today" until the day ends in the recipient's zone; one with a time is overdue once the time passes.
- `taskOrder` (overdue first by due, then today, then later days, all-day before timed within a day; then undated newest first) and `doneOrder` (newest `done_at` first).
- `canCompleteTask({ role, userId, task })`: writers always; viewers only when `assignee_id` is them (never a free-text assignee's task).
- `assigneeOf(task)` → `{ type: "member", userId } | { type: "name", name } | { type: "none" }`, the one reader of the two columns.
- `completionOnly(before, after)`: true when only `done_at`/`done_by` differ. A viewer's update must pass it.

**Permissions** (`PERMISSIONS.task`, appended): read any member; create writers; update writers and viewers (viewers limited by the service to completion on their own tasks); delete writers (soft). RBAC stays in SQL; the viewer rule is the service's.

**Service** (`taskService`, write through it): `create` (idempotent on id), `update` (validates the merged row; checks links only when they change: live, in the group, the event an event; the assignee a member when it changes), `complete` and `reopen` (set or clear `done_at`/`done_by`; the server sets `done_by` to the actor), `remove` (soft). A viewer's update that isn't `completionOnly`, or isn't on their own task, is refused (`taskService:viewerCompletionOnly`, 403). **Leaving a group:** `careGroupMemberService`'s removal turns that user's open tasks in the group into free-text assignees with their display name at that moment (`assignee_id` null, `assignee_name` set) in the same transaction; done tasks keep `done_by`.

**Sync:** `task` in the `care_groups` stream (soft-deleted rows included) and the publication; the device schema; an upload `taskOp` like `care_period` (PUT upsert, PATCH update, complete/reopen or soft remove, DELETE soft remove; a changed group or recipient → `immutable`). A PATCH that only touches the done fields maps to `complete`/`reopen`, so a viewer's offline tick uploads.

**Device** (`lib/sync/tasks.ts`): `tasksQuery(groupId, filter)`, `taskQuery`, `linkedTasksQuery({ providerId | medicationId | eventId })`, `dueTasksQuery(groupId, from, to)`; local writes `createTask`, `updateTask`, `completeTask`, `reopenTask`, `removeTask`, `createTaskDocument`, each checking `canCompleteTask` or the writer role locally. A live hook `useDueTasks(groupId, timeZone)` re-evaluates on a once-a-minute clock.

**Wording and lists** (pure, tested, one home each): `lib/taskDisplay.ts` (`dueText`: "Due today", "Due Fri 14:00", "Overdue · 2 days", "No due date"; `doneText`: "Done by Sam · Tue"; assignee labels (a member's name, a typed name with a person-outline icon and no link, "Unassigned"), the "(removed)" link labels) and `lib/taskList.ts` (sections: Overdue, Today, a day per later day, No due date; the `?who=mine|unassigned|everyone` chip, defaulting to mine when I have open tasks, else everyone; free-text tasks show under Everyone, not Unassigned).

**Screens** (`components/tasks/` for shared pieces, through its `index.ts`; routes compose only):

- **The Tasks section**: a `GROUP_SECTIONS` entry after Upcoming (lucide `ListTodo`), `appUrls.tasks`, `task`, `newTask(groupId, { providerId?, medicationId?, eventId?, dueOn? })`, `editTask`. The list: chips, sections, a row per task (tick box, title, due text, assignee chip, link icons), tick → `completeTask` with one shared 10 s Undo and a polite status line; Done below, paged, with Reopen. Writers get "Add task".
- **The task page** (`tasks/:taskId`): header regions (title, a Done or Overdue badge, Edit and a ⋯ with Reopen and Delete for writers), assignee, due, done-by line, the three links as rows (the provider with `ContactActions`, the appointment with its time, the medication), then live notes (read-only for viewers). Viewers who are the assignee get the complete/reopen button. Missing, deleted or other-group tasks are the 404.
- **The sheets** (`tasks/new`, `tasks/:taskId/edit`, writers): `TaskForm` with the title, an assignee picker (a `ComboBox` over members plus "Unassigned", with "Assign to "<typed>" (not in the group)" for a free-text name), a due `DateField` with an optional time, and three optional pickers (provider, upcoming or recent event, current medication). Prefills come from the URL; closing returns to where it opened (sheet link state), a deep link closes to the list. Guards send viewers and missing tasks to the list.
- **Upcoming**: `withDueTasks` merges open dated tasks under their day (overdue under Today, never "Now"), as `UpcomingTaskRow` with a tick for those allowed to complete; hidden under a kind or author filter, like due doses. Never written as entries.
- **The task strip** (timeline, after the medication strip, `STRIP_CLASS`): shown while the group has overdue or due-today tasks: "Overdue: Call pharmacy · +2 more" (red) or "Today: Pick up walker" (amber), linking to the Tasks list. It counts the whole group's open tasks, mine first in the wording.
- **Backlinks**: a `LinkedTasks` region on the event entry page, the provider page and the medication page, hidden when empty, listing open tasks with ticks, and "Add task" (writers) through `appUrls.newTask` with the link prefilled.
- **Search**: `taskSearchDocument` (title weighted, notes text as body; deleted rows none), a `task` result type on the search page (after medications), opening the task page; a `SEARCH_INDEX_VERSION` bump. Server search is out of scope.
- **Simple mode**: a "My tasks" card in the simple view (open tasks assigned to me, overdue and today first, at most five, big tick buttons and Undo), for viewers too. It isn't one of the four tiles (those open entry forms).
- **Quick entry**: `addTask` appended to `assistantActionZSchema` (`title`, `assigneeId?`, `dueOn?`, `dueTime?`, links optional; no ids for the task itself), the parser's `t:` and "todo:"/"task:" prefixes, "for <name>" or "@<name>" against members' names only (a name that matches no member stays in the title; free-text assignees are set in the sheet), and due phrases through the existing time parser (a day and optional time, future allowed). The runner writes it with the batch; the preview card reads "Task: Call pharmacy · Fri · Sam".
- **Seeds** (`seeds/tasks.ts`, own ids, placed by days ahead): about eight tasks for Dev Family (assigned to member@, caretaker@ and viewer@; overdue, today, later, undated; linked to a provider, an upcoming appointment and a medication; two done; one with notes) and one for Dev Family 2.

**Hot files and order:** the timeline route folder (strip), Upcoming, the entry page, provider and medication pages, the simple view and `assistantActions` are all touched by `assistant` slices 6 and 7. Slices that touch them wait for `assistant` to land in `dev`. Registries (`db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, the upload switch, `routes.ts`, `GROUP_SECTIONS`, `appUrls`) take additive entries at the end of their group.

## Testing Decisions

Good tests check what a user or caller sees (the rows a query returns, the outcome of an upload, the text and controls on screen), never internal calls or private state.

- **Unit (table-driven):** `taskRules` (validation, `taskState` across midnight, DST and zones, ordering, `canCompleteTask` per role, `completionOnly`), `taskDisplay`, `taskList` (sections and chip defaults), `taskSearchDocument`, and rows in `quickEntry.test.ts` for every `addTask` phrase. Prior art: `dueDoses`, `carePeriodTrack`, `medicationDisplay`, `quickEntry.test.ts`.
- **Integration:** `taskService` against the test Postgres with its own fixtures: every role against the `task` table, viewer completion only on their own task (and refused otherwise), links in the group and live, the event-only rule, assignee membership, idempotent create, soft delete, free-text assignees (exclusive with a member, never completable by a viewer), the leaver becoming a typed name, and the upload switch's `taskOp` (including a viewer's done-only PATCH). Prior art: the care-period and medication-pass service tests, the sync upload tests.
- **Component (test device):** the Tasks list (chips, sections, tick and Undo, Done and Reopen, viewer controls), the task page, the sheets and their guards, Upcoming task rows, the task strip, the three `LinkedTasks` regions, the search result type, the simple mode card and quick entry's task cards. Prior art: the medications Today tests, `timelineQuickEntry.browser.test.tsx`.
- **End to end (one step, no new check):** in `roundtrip`, `task` joins the sync matrix (device A writes, device B sees), and a viewer ticks their assigned task offline on one device, reconnects, and a writer's device shows it done; a viewer's title change is refused and restored. Added to `roundtrip` because it owns devices converging, offline and refused uploads (check-migration's lean rule).

## Out of Scope

- Recurring tasks (with recurring appointments, B-60).
- Email or push: assignment emails, due reminders and digests (they need hosting's cron and notification preferences).
- Several assignees, claiming ("Take it"), priorities, subtasks, checklists inside a task, tags.
- A cross-group "my tasks" on `/app` home.
- A timeline entry for completed tasks.
- Server search (`searchService`) over tasks.
- Linking a task to more than one of each kind, or to care periods, notes or symptoms.
- Calendar feeds of tasks (with B-62, B-63).

## Further Notes

- `connectors` (B-104) gets `addTask` for free once it carries out assistant actions through the services; a later `completeTask` action can follow the same shape.
- Due reminders, when they come, should reuse `taskState` on the server.
- The sync matrix step depends on `check-migration` slice 2 being in `dev`; if it isn't when the e2e slice runs, that slice adds its step to `roundtrip` as a plain step and the matrix picks the table up later.
