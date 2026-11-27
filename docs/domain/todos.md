# Todos

PRD: [`tasks-prd`](../../plans/tasks-prd.md) (B-55). A todo: title, assignee, due day and time, done or open, notes, provider, medication, linked notes and events. **Not entries:** completing one writes none.

## The table and its rules

- **Table `todo`**: `id` (UUID, device-made), `group_id`, `recipient_id` (composite FK), `title`, `assignee_id` (null when the account is deleted), `assignee_name`, `due_on`, `due_time` (`HH:MM`), `done_at`, `done_by`, `provider_id`, `medication_id` (composite FKs, `NO ACTION`), `event_id` (legacy, below), `deleted_at`, timestamps, audits; unique `(group_id, id)`.
  - Checks: not both `assignee_id` and `assignee_name`; `due_time` needs `due_on`; `done_at` and `done_by` together.
  - **Two hand edits in the SQL:** `event_id`'s FK `ON DELETE SET NULL ("event_id")`; the `ALTER PUBLICATION`.
  - `note_document.todo_id` (the `todo` subject; see [live-notes](live-notes.md)).
- **Due time is wall-clock in the recipient's zone.** `db/schema/todos/todoRules.ts` (pure, both sides) has `todoState`, `todoOrder` (overdue first, undated last), `doneOrder`, `assigneeOf`, `TODO_WRITER_ROLES`/`isTodoWriter`, `canCompleteTodo` and `completionOnly`.
- **Permissions** (`PERMISSIONS.todo`): read any member; create, delete (soft) writers; update writers, viewers. **The service limits viewers and easy roles** to completing their own todos (`completionOnly`, 403). Free-text assignee: writers only.
- **`todoService`** (`todoModel`): checks assignee and links are in the group (`todoService:badLink`). `via` is server-only ([connectors](connectors.md)).
  - **The leaver:** `releaseAssignee` (`careGroupMemberService.remove`) sets their open todos' `assignee_name` to their name ("Former member" if none).
  - **A deleted event:** `releaseEvent` (in `timelineEntryService.remove`) clears only `event_id` on its todos (link rows stay).
- **Sync:** [sync](sync.md) (`care_groups`, soft-deleted too; `todoOp`).

## Entry links

- ✅ **`timeline_entry_todo`** links entries and todos many-to-many: id `entryTodoId` (UUID v5 of the pair), cascading composite FKs, unique pair, hard-delete unlink; PUT/DELETE via `linkTable`. Only notes and events (`NOTE_DOCUMENT_KINDS`). Soft deletes keep link rows. Who links: `WRITERS`.
- ✅ **`todo.event_id` is legacy**, until a contract migration drops it; new clients never write it. Only these touch it: `todoService` create/update mirrors an old client's `eventId` into link rows; `releaseEvent`; `entryTodoService.unlink` clears it when it names that entry.
- ✅ **Touched:** a next with any link row is touched (`isTouched`, `reopenTodo`).
- ✅ **Device** (`lib/todos/entryTodos.sync.ts`): `linkTodo`, `unlinkTodo`, `entryTodoRow` (in your transaction); `entryTodosQuery`, `todoEntriesQuery`, `openTodoCountsQuery` (one group query). `createTodo`, `updateTodo` write link rows in their transaction; never `eventId`.

## Repeating todos

- **Columns** (`0033_todo_repeats`): `repeat_rule` (RRULE text, `appointment_series.rule`'s grammar), `repeat_starts_on` (the anchor) and `repeat_id` (the chain; the first todo's id). Checks: all three or none; a rule needs `due_on` (`REPEAT_NEEDS_DAY_ISSUE`). `repeatColumnsFor`: a new rule starts a chain; a changed rule or due day moves the anchor; no rule clears all three. `todoRepeatText` says the rule.
- **`todoRepeat`** (pure, `@caretook/data/series`, lazy on the device): `nextDueDay` (first rule day after the due day and today; null once ended), `nextTodoId` (UUID v5 of chain and day), `nextOccurrence` (not entry links, notes or done), `isUntouchedNext` (open, live, as the tick made it).
- **A repeating todo is one open row.** `complete` makes the next as the system in its transaction ("today": the tick's `doneAt` in the recipient's zone), unless a live row has its id (a soft-deleted one is restored). `reopen` soft-deletes an untouched next, else keeps both and the reopened one stops repeating. `skip` (writers) soft-deletes, makes the next. Stop is a plain delete.
- **The screens:** `TodoRepeat` under the due day opens `RepeatSheet` (lazy; disabled without a due day). Clearing the due day or off clears it (`todoFormData`). `TodoRepeatMark` ("Repeats") on every todo row, the Today card; `TodoDetails`: `todoRepeatLine`. `RepeatDeleteDialog` (Skip this one, Delete and stop repeating) for an open repeating todo only (`SKIP_INTENT`).
- **The device's next is a twin** with the same id, written in the tick's local transaction (`completeTodo`, `reopenTodo`, `skipTodo`). `todoOp`: a PUT whose `repeat_id` is another todo's goes to `upsertOccurrence` (an existing row counts as done for any role; another open todo in the chain makes it a stale no-op; else a writer's skip); a PATCH of `deleted_at` to null restores; one with `done_at` ignores `repeat_rule`. An Undo's delete of the next carries `UNDO_NEXT_METADATA`: `removeUndoneNext` checks the role, then applies it only if `reopen` would.

## Subtasks

- ✅ **A subtask is a todo with `parent_id`** (`0047_todo_subtasks`; FK, index `(group_id, parent_id)`), set on create and upsert only.
- ✅ **Tree rules** (`todoTree.ts`, both sides): `MAX_TODO_DEPTH` 3, `depthOf`, `canHaveSubtask`, `rollupOf` (live children; none: no change), `subtaskProgress`, `inheritedDue`, `clampDue`, `upcomingListsSubtask` (connectors), `siblingOrder` (by day, time, created). Trees: `todoTreeView.ts` (`todoTrees`, `todoDayTrees`).
- ✅ **Due:** a new subtask takes its parent's; never after the direct parent's day. The server clamps a writer's edit (a parent's new day clamps open descendants); the device refuses a moved day (`todos:dueAfterParent`).
- ✅ **Service:** a bad parent (missing, deleted, other group, repeating, too deep) is `todoService:badParent`; a rule on a subtask or a parent is `todoService:repeatWithSubtasks`. `parentId` is in `completionOnly`'s fields.
- ✅ **Rollup** (`todoService.rollUp(tx, parentId, actorId, at?)`): after a child's create, complete, reopen or remove, to the top, as the system (`done_by` the actor; a viewer's last subtask can). A hand reopen reopens just that todo. `complete` with an open subtask: `todoService:openSubtasks`. `remove` cascades to live descendants, then rolls up; returns `{ ids }`.
- ✅ **Device:** `parentId` in the device schema; `createTodo` checks `canHaveSubtask` locally, `updateTodo` refuses a new repeat or a late day; `removeTodo` takes live descendants along. `subtasksQuery`, `subtaskProgressQuery(groupId)` (one query), `progressByParent`. Rollup: `planRollup` writes the chain in the change's transaction, flagged `ROLLUP_METADATA`; `todoOp` sends it to `rollUpUploaded` (any member; server rows decide).
- ✅ **The page:** the Subtasks band (`TodoSubtasks`): "n of m done" (children), the descendants' `TodoTree` (`todoDescendantsQuery`, `rootId`), `TodoQuickAdd` (full); "Part of" links up.
- ✅ **The parent's tick:** `TodoTick`'s `progress` (`waitsOnSubtasks`): open subtasks disable it, "n of m" (server-enforced); Mark done too. Delete counts descendants; `TodoForm`'s `repeatable` hides Repeat on a tree.
- ✅ **Lists:** the Todos page sections trees (`todoTreesQuery`: open todos, open trees' done steps; filters match, ancestors as context). Done stays flat (`doneListed`). Planner, easy view: day trees ([appointments](appointments.md)).

## On the device (`lib/todos/todos.sync.ts`)

- `todosQuery`/`doneCountQuery`/`todoQuery` read; `createTodo`, `updateTodo`, `completeTodo`, `reopenTodo`, `removeTodo` write. An unflagged done PATCH maps to `complete` or `reopen`.
- `dueTodosQuery`, `dueTodosThrough` feed the Today card; `linkedTodosQuery`, `linkOf` and `TodoLink` serve provider and medication links.
- Wording: `todoDisplay.ts`; filter and sections: `todoList.ts`; the tick's Undo: `todoUndo.ts`; `TodoUndoStatus` (stays mounted, not a `Notice`).

## Screens

- **The Todos tab** (`routes/app/groups/todos/`, `appUrls.todos`; the Planner's): no Add button. "Assigned to" (Everyone, Mine, Unassigned; `?who=`); sections Overdue, Today, by day, No date; Done newest first, 20 a page.
- **Sheets:** `todos/new` (`appUrls.newTodo`), `todos/:todoId/edit` (`TodoForm`; `TodoLinkFields`: a `LinkToBox`, chips; posts `providerId`, `medicationId`, new `entryIds`; edit only its own `addEntryIds`, `removeEntryIds`). They close to their opener via link state (`TODO_SHEET_STATE`); a save from the Planner's Add menu (`PLANNER_TODO_STATE`) lands on Todos. `todos/new` prefills from `TODO_PREFILL_PARAMS`: link ids (`eventId`/`entryId` become `entryIds`), `dueOn`, quick entry's fields.
- **The todo page** (`routes/app/groups/todo/`, `appUrls.todo`), banded ([ui-kit](ui-kit.md#bands)): `TodoHeader` (writers edit and delete), Details, Linked to (provider, medication, notes and events; writers' `LinkToBox`, Remove), Status (`TodoCompletion`), Notes (`useTodoNotes`, live); missing or deleted: 404.
- **The tick** (`TodoTick`, `useTodoTick`) everywhere. **Easy roles:** the Planner (read-only), a todo's page (no edit or delete); they tick their own only.
- **Links and backlinks:** **Link to box** (`LinkToBox`; `searchLinkables` in `lib/todos/linkSearch.sync.ts`; pure `linkOptions.ts`): site search's device index; providers, medications, live notes and events, `compareHits` order, linked ones out; type chips and a first or last type word (`linkTypeWord`; finding nothing, the whole text, chip off). Empty or a type word: `linkSuggestions` (came-from, next 3 events, last 5 viewed). `LinkedTodos` (provider, medication pages): open linked todos; writers' full `TodoQuickAdd` with the link (band titled even empty) and a compact one per open row.
- **An entry's Todos** (`entry/EntryTodos.tsx`): open (tick, Undo), done (newest 20); writers' `TodoQuickAdd` (as `LinkedTodos`), Link a todo (ComboBox: open, unlinked, at most 20), Remove.

## Seeds and checks

- **Seeds** (`seeds/todos.ts`): open, overdue, done, unassigned; viewer@'s "Pick up groceries"; one linked to Cornerstone; weekly "Put the bins out"; "Get ready for the hospital stay" (subtasks; viewer@'s is the only open child).
- **Tests:** unit, integration, component; `roundtrip` (`todo`, `timeline_entry_todo`): viewer@ ticks offline (a forced title change refused) and a weekly one.
