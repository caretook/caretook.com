# Todos

PRD: [`tasks-prd`](../../plans/tasks-prd.md) (B-55), [`tasks-2`](../../plans/tasks-2-plan.md) (B-222). A todo: a title, an optional assignee, due day and time, done or open, notes, up to one provider and one medication, and any number of linked notes and events. **Not entries:** completing one writes no timeline entry.

## The table and its rules

- **Table `todo`** (`0022_tasks` as `task`, renamed by `0032_todos`): `id` (UUID, device-made), `group_id`, `recipient_id` (composite FK to `care_recipient`), `title`, `assignee_id` (set null when the account is deleted), `assignee_name`, `due_on`, `due_time` (`HH:MM`), `done_at`, `done_by`, `provider_id`, `medication_id` (composite FKs, `NO ACTION`), `event_id` (legacy, below), `deleted_at`, timestamps, audits; unique `(group_id, id)`.
  - Checks: not both `assignee_id` and `assignee_name`; `due_time` needs `due_on`; `done_at` and `done_by` together.
  - **Two hand edits in the SQL, kept when regenerating:** `event_id`'s composite FK to `timeline_entry` is `ON DELETE SET NULL ("event_id")`, and the `ALTER PUBLICATION` adding the table.
  - `note_document.todo_id` (the `todo` subject; see [live-notes](live-notes.md)).
- **Due time is wall-clock in the recipient's zone.** `db/schema/todos/todoRules.ts` (pure, both sides) has `todoState`, `todoOrder` (overdue first, by day and time, undated last), `doneOrder`, `assigneeOf`, `localTime`, `TODO_WRITER_ROLES`/`isTodoWriter`, `canCompleteTodo` and `completionOnly`.
- **Permissions** (`PERMISSIONS.todo`): read any member; create and delete (soft) writers; update writers and viewers. **The service limits viewers and easy roles** to completing their own todos (`todoService:completionOnly`, 403). A free-text assignee's todo: writers only.
- **`todoService`** (`todoModel`): checks the assignee is a member and the links are in the group (`todoService:badLink`). `create`'s `via` is server-only ([connectors](connectors.md)).
  - **The leaver:** `releaseAssignee` (in `careGroupMemberService.remove`) turns a leaver's open todos into `assignee_name` = their name ("Former member" if none).
  - **A deleted event:** `releaseEvent` (in `timelineEntryService.remove`) clears only `event_id` on its todos (link rows stay). The FK's `SET NULL` only covers hard deletes.
- **Sync:** [sync](sync.md) (`care_groups`, soft-deleted included; `todoOp`).

## Entry links (planner-3, B-245)

- ✅ **`timeline_entry_todo`** links entries and todos many-to-many: id `entryTodoId` (UUID v5 of the pair, lowercased), cascading composite FKs, unique pair, hard-delete unlink; PUT/DELETE via `linkTable`. No kind check; screens show links on `NOTE_DOCUMENT_KINDS` (notes, events) only. Readers join live rows; soft deletes keep link rows. Who links: `WRITERS` ([care-groups](care-groups.md)).
- ✅ **`todo.event_id` is legacy**, until a contract migration drops it; new clients never write it (0045 backfilled links from it). Only these touch it: `todoService` create/update mirrors an old client's `eventId` into link rows (change swaps, clear removes, unchanged no-op); `releaseEvent`; `entryTodoService.unlink` clears it when it names that entry.
- ✅ **Touched:** a next occurrence with any link row counts as touched (server `isTouched`, device `reopenTodo`).
- ✅ **Device** (`lib/todos/entryTodos.sync.ts`): `linkTodo`, `unlinkTodo`, `entryTodoRow` (in your transaction); `entryTodosQuery`, `todoEntriesQuery`, `openTodoCountsQuery` (one group query), `linkableEntriesQuery`. `createTodo` writes the todo and its link rows in one transaction; `updateTodo` never carries `eventId`.

## Repeating todos (planner-2, B-248)

- **Columns** (`0033_todo_repeats`): `repeat_rule` (RRULE text, `appointment_series.rule`'s grammar), `repeat_starts_on` (the anchor) and `repeat_id` (the chain; the first todo's id). Checks: all three or none; a rule needs `due_on` (`REPEAT_NEEDS_DAY_ISSUE`). `repeatColumnsFor`: a new rule starts a chain; a changed rule or due day moves the anchor; no rule clears all three. `todoRepeatText` says the rule.
- **`todoRepeat`** (pure, `@caretook/data/series`, lazy on the device): `nextDueDay` (the first rule day after the due day and today, null once ended), `nextTodoId` (UUID v5 of chain and day), `nextOccurrence` (title, assignee, time, provider and medication, the repeat; not entry links, notes or done), `isUntouchedNext` (open, live and as the tick made it, by content; not the column).
- **A repeating todo is one open row.** The server writes the next: `complete` makes it as the system in its transaction ("today" is the tick's `doneAt` in the recipient's zone), unless a live row with its id exists (a soft-deleted one is restored). `reopen` soft-deletes an untouched next, else keeps both and the reopened todo stops repeating. `skip` (writers) soft-deletes and makes the next. Stop is the ordinary delete.
- **The screens:** `TodoRepeat` under the due day opens `RepeatSheet` (lazy, so rrule stays out of first load; disabled without a due day: "Choose a due day to repeat"). Clearing the due day clears the repeat; off posts an empty rule (`todoFormData`). `components/repeat` takes `kind: "todo"` (counts "times"). `TodoRepeatMark` ("Repeats") on every todo row and the Today card; `TodoDetails` shows `todoRepeatLine` (`@caretook/data/schema`, re-exported in `todoDisplay.ts`). `RepeatDeleteDialog` (`ChoiceDialog`: "Skip this one", "Delete and stop repeating", Cancel) only for an open repeating todo (`SKIP_INTENT`).
- **The device's next is a twin** with the same id, written in the tick's local transaction (`completeTodo`, `reopenTodo`, `skipTodo`). `todoOp`: a PUT whose `repeat_id` is another todo's goes to `upsertOccurrence` (an existing row counts as done for any role; another open todo in the chain makes it a stale no-op; else a writer's skip); a PATCH of `deleted_at` to null restores; one with `done_at` ignores `repeat_rule`. An Undo's delete of the next carries `UNDO_NEXT_METADATA`: `removeUndoneNext` checks the role, then applies it only if `reopen` would.
- Open edge cases (Codex): B-383, B-384, B-387.

## Subtasks (todo-subtasks, B-550)

- ✅ **A subtask is a todo with `parent_id`** (`0047_todo_subtasks`): composite FK `(group_id, parent_id)` to `todo` (`NO ACTION`; soft deletes only), index `(group_id, parent_id)`. Set on create and upsert only, never `update`.
- ✅ **Tree rules** (`todoTree.ts`, pure, both sides): `MAX_TODO_DEPTH` 3, `depthOf`, `canHaveSubtask` (live, not repeating, within depth), `rollupOf` (live children only; none left: no change), `subtaskProgress`, `listsOnItsOwn` (top-level, or dated or assigned).
- ✅ **Service:** a missing, deleted, other-group, repeating or too-deep parent is `todoService:badParent` (issue on `parentId`); a rule on a subtask or a todo with live subtasks is `todoService:repeatWithSubtasks`. `parentId` is in `completionOnly`'s fields.

## On the device (`lib/todos/todos.sync.ts`)

- `todosQuery`/`doneCountQuery`/`todoQuery` read; `createTodo` (over `plannedTodo`, quick entry's too), `updateTodo`, `completeTodo`, `reopenTodo`, `removeTodo` write. A done-only change is a PATCH of `done_at`/`done_by` that the server maps to `complete` or `reopen`.
- `dueTodosQuery`, `dueTodosThrough` and `useDueTodos` feed the Planner, the Today card and the easy view; `linkedTodosQuery`, `linkOf` and `TodoLink` serve provider and medication links.
- Wording in `todoDisplay.ts`; the filter and sections in `todoList.ts`; the tick's Undo in `todoUndo.ts`: newest first, each 10 s; `TodoUndoStatus` ("Undo <title>", not a `Notice`: it stays mounted). A failed tick or Undo says so.

## Screens

- **The Todos tab** (`routes/app/groups/todos/`, `appUrls.todos`; the Planner's): no Add button of its own. "Assigned to" (Everyone, Mine, Unassigned; `?who=`); sections Overdue, Today, by day, No date; Done newest first, 20 a page. Rows open the todo page.
- **Sheets:** `todos/new` (`appUrls.newTodo`) and `todos/:todoId/edit` (`TodoForm`; the event picker on create only). They close back through link state (`TODO_SHEET_STATE`, `lib/todos/todoSheetLink.ts`) to their opener; a save from the Planner's Add menu (`PLANNER_TODO_STATE`) lands on Todos (B-689). `todos/new` prefills (`TODO_PREFILL_PARAMS`): `providerId`, `medicationId`, `entryId` (old `eventId` works), `dueOn`; from quick entry `title`, `assigneeId`, `dueTime`, `repeatRule` (ignored if it doesn't parse).
- **The todo page** (`routes/app/groups/todo/`, `appUrls.todo`), banded ([ui-kit](ui-kit.md#bands)): `TodoHeader` (writers edit and delete), Details, Linked to (notes and events, newest first; a removed one reads "(removed)"; writers get Remove and "Link an entry", even empty), Status (`TodoCompletion`), Notes (`useTodoNotes`, live); missing or deleted is a 404.
- **The tick** (`TodoTick`, `useTodoTick`) on every todo surface.
- **Easy roles** reach only the Planner (read-only, no tabs or filters) and a todo's page (no edit or delete; [app-shell](app-shell.md)), and tick only their own todos.
- **Links and backlinks:** pickers (`todos/todoLinks.ts`). `LinkedTodos` lists open linked todos on a provider's and medication's page, with "Add todo" prefilled; hidden when empty, except a writer's lone "Add todo".
- **An entry's Todos** (`entry/EntryTodos.tsx`, notes and events): open todos (tick, Undo), done (newest 20, tick reopens); writers get Add todo (`?entryId=`), Link a todo (a ComboBox: open, unlinked, 20 at most) and Remove.
- Elsewhere: the Planner ([appointments](appointments.md)), the Today card and open-todo marks ([timeline](timeline.md)), [search](search.md), quick entry ([assistant](assistant.md)).

## Seeds and checks

- **Seeds** (`seeds/todos.ts`): open, overdue, done, unassigned and free-text todos for Dev Family; viewer@'s "Pick up groceries" (`roundtrip` ticks it); one linked to Cornerstone; weekly "Put the bins out" (the open one has id `nextTodoId`); "Get ready for the hospital stay" (subtasks; viewer@'s is the only open child).
- **Tests:** unit, integration, component. End to end: `roundtrip`'s `todo` and `timeline_entry_todo` matrix rows; viewer@ ticks their todo offline (a forced title change is refused) and a weekly one (the server ends with one next, the device's id).
