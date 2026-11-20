# Tasks

The tasks area's rules and decisions. An orchestrator folds a landing's lasting decisions for this area in here.

PRD: [`plans/tasks-prd.md`](../../plans/tasks-prd.md) (B-55). A task is a to-do for the group: a title, an optional assignee, an optional due day and time, done or open, optional notes, and up to one link each to a provider, a medication and an appointment. **Never written as entries:** completing a task writes no timeline entry, and tasks in Upcoming, the strip and the simple view are worked out like due doses.

## The table and its rules

- **Table `task`** (migration `0022_tasks`, every column in one migration): `id` (UUID, device-made), `group_id`, `recipient_id` (composite FK to `care_recipient`), `title`, `assignee_id` (user, nullable, set null when the account is deleted), `assignee_name` (text, nullable), `due_on` (date), `due_time` (`HH:MM`), `done_at`, `done_by`, `provider_id`, `medication_id` (composite FKs, `NO ACTION`), `event_id`, `deleted_at` (soft delete), timestamps and audits; unique `(group_id, id)`.
  - Three DB checks: never both `assignee_id` and `assignee_name`; `due_time` only with `due_on`; `done_at` and `done_by` both or neither.
  - **Two hand edits in the SQL, kept when regenerating:** `event_id`'s composite FK to `timeline_entry` is `ON DELETE SET NULL ("event_id")` (like `rescheduled_to`), and the `ALTER PUBLICATION` adding `task`.
  - The same migration adds `note_document.task_id` (the `task` subject; see [live-notes](live-notes.md)).
- **The due time is wall-clock in the recipient's zone**, like medication slots. State and order are worked out, never stored: `db/schema/taskRules.ts` (pure, tested, used on both sides) has `taskState` (done, overdue, today, upcoming, undated), `taskOrder` (overdue first, then by day and time, undated last), `doneOrder` (newest first), `assigneeOf`, `localTime`, `TASK_WRITER_ROLES`/`isTaskWriter`, `canCompleteTask` and `completionOnly`.
- **Permissions** (`PERMISSIONS.task`): read any member; create writers; update writers and viewers; delete writers (soft). **The service limits viewers** to `completionOnly` changes on tasks assigned to them (`taskService:viewerCompletionOnly`, 403). A free-text assignee's task is completed by writers only.
- **`taskService`** (`getById`, `list`, `create`, `update`, `complete`, `reopen`, `upsert`, `remove`): checks the assignee is a member (when set or changed) and the links are in the group (`taskService:badLink`).
  - **The leaver:** `releaseAssignee`, from `careGroupMemberService.remove` in the same transaction, turns a removed or leaving member's open tasks into `assignee_name` = their display name ("Former member" if none) with `assignee_id` null.
  - **A deleted appointment:** `releaseEvent`, from `timelineEntryService.remove` (now one transaction), clears `event_id` on its tasks, done ones included. Entries are soft-deleted, so the FK's `SET NULL` only covers hard deletes. The device's `removeEntry` does the same locally.
- **Sync:** see [sync](sync.md) (`task` in the `care_groups` stream, soft-deleted rows included; `taskOp`).

## On the device (`lib/sync/tasks.ts`)

- `toTask`/`tasksQuery`/`doneCountQuery`/`taskQuery` read; `createTask` (over `plannedTask`, which quick entry uses too), `updateTask`, `completeTask`, `reopenTask`, `removeTask` write. A done-only change is a PATCH of `done_at`/`done_by` that the server maps to `complete` or `reopen`.
- `createTaskDocument` makes a task's notes document; `dueTasksQuery`, `dueTasksThrough` and `useDueTasks` (ticking every `DUE_TASKS_TICK_MS`) feed Upcoming, the strip and the simple view; `linkedTasksQuery`, `taskEventChoicesQuery`, `linkedEventQuery`, `linkOf` and `TaskLink` serve links.
- Wording in `lib/taskDisplay.ts` (`dueText`, `doneText` "Done by … · today", `assigneeLabel`, `linkLabel` "(removed)"); the chips and sections in `lib/taskList.ts`; the tick's 10-second Undo in `lib/taskUndo.ts`, shown by `TaskUndoStatus`.

## Screens

- **The Tasks section** (`routes/app/groups/tasks/`, `appUrls.tasks`, a `GROUP_SECTIONS` entry after Upcoming, lucide `ListTodo`): chips `?who=mine|unassigned|everyone`, the default fixed when the list opens (mine if any, else everyone); sections Overdue, Today, then by day, then No date; Done follows the chip, newest first, paged by 20; unticking reopens. Rows open the task page for everyone.
- **Sheets:** `tasks/new` and `tasks/:taskId/edit` (`TaskForm` with native date and time inputs, `AssigneeField`, `TaskLinkFields`). They close back through link state (`TASK_SHEET_STATE`, `openedFromApp` in `lib/taskSheetLink.ts`); deep links close to the list. Guards and list-search carrying are in `lib/taskSheets.ts`. `tasks/new` takes prefills (`TASK_PREFILL_PARAMS`): `providerId`, `medicationId`, `eventId`, `dueOn`, and from quick entry `title`, `assigneeId`, `dueTime`.
- **The task page** (`routes/app/groups/task/`, `tasks/:taskId`): `TaskHeader`, `TaskCompletion`, `TaskDetails`, "Linked to" rows (`TaskLinks`, a removed link reads "(removed)"), `TaskActions` (edit, delete for writers), and notes (`useTaskNotes`, the live-notes editor); a missing or deleted task is a 404. Going back carries the list's chip (`taskPageState`, `listSearchFromState`).
- **The tick** (`components/tasks/TaskTick`, `useTaskTick`; `large` in the simple view) is shared by the list, the page, Upcoming, the strip and the simple view.
- **Links and backlinks:** pickers (`tasks/taskLinks.ts`, `LinkPickerField`) choose one provider, one medication and one appointment. `LinkedTasks`/`useLinkedTasks` (`components/tasks`) list open linked tasks on an event's entry page, a provider's page (after visit prep) and a medication's page (after refills), with "Add task" prefilled with the link. Hidden when empty, except writers keep a lone "Add task".
- Elsewhere: tasks in Upcoming ([appointments](appointments.md)), the task strip and the simple view's My tasks ([timeline](timeline.md)), the search results' Tasks section ([search](search.md)), and `addTask` in quick entry ([assistant](assistant.md)).

## Seeds and checks

- **Seeds** (`seeds/tasks.ts`, own ids `…3f1d2be0…` and `…3f1d2be1…`; linked ones `…3f1d2be01010–12`): open, overdue, done, unassigned and free-text tasks for Dev Family, one viewer@'s own ("Pick up groceries"), which `roundtrip` ticks and restores.
- **Tests:** unit (`taskRules`, `taskDisplay`, `taskList`, `taskStrip`, `upcomingTasks`, `taskSheets`, pickers), integration (`taskService`, the leaver, `releaseEvent`), component (the list, sheets, page, links, LinkedTasks, the simple card). The only end-to-end step is `roundtrip`'s: the `task` matrix row, and viewer@ ticking their task offline (member@ sees "Done by …") with a forced title change refused and restored.
