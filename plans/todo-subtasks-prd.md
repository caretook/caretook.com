# PRD: Nested todos (subtasks)

> Topic `todo-subtasks`. Backlog item B-550. Plan: [`todo-subtasks-plan.md`](todo-subtasks-plan.md). Area: [todos](../docs/domain/todos.md).

## Decisions

| Decision                                                                                                                                                                                                                                                          | Why                                                                                                        | Source                        | Cost to change later                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| A subtask is a `todo` row with a `parent_id` (composite FK to `todo` in the same group); any depth in the schema                                                                                                                                                  | the item: "any depth in the model"; one table keeps sync, links, notes, search and permissions as they are | the item                      | high: a migration and every reader    |
| The parent is set on create only; no moving a todo under another parent                                                                                                                                                                                           | no cycles to guard against, and no reparenting conflicts offline; nothing asks for it                      | assumed                       | low: allow `parentId` on update later |
| Three levels at most: a todo, its subtasks, and theirs (`MAX_TODO_DEPTH = 3`), checked by the service and the device                                                                                                                                              | the item's "up to 3 levels deep", read as three levels counting the top                                    | assumed                       | low: one constant                     |
| The parent's done state follows its children: when a change to a child (tick, reopen, add, delete) leaves every live child done, the parent is done (`done_by` the actor whose change finished it); when one is open, a done parent reopens. It climbs to the top | the item: "a parent completes when its last subtask is done"; the reverse keeps the list honest            | the item, the reverse assumed | medium: service and device rules      |
| The rollup runs as the system: a viewer or Easy role who ticks their own last subtask completes a parent assigned to someone else                                                                                                                                 | the tick is theirs to make; the parent only follows it                                                     | assumed                       | low                                   |
| A parent with open subtasks can't be ticked by hand (server refuses, its tick is disabled and shows "2 of 5"); unticking a done parent reopens only the parent                                                                                                    | ticking a parent is the subtasks' job; no permission puzzle over others' subtasks                          | assumed                       | low: no migration                     |
| Deleting a todo soft-deletes its subtasks with it, all levels, in one transaction                                                                                                                                                                                 | no orphans under a deleted parent                                                                          | assumed                       | low                                   |
| A subtask can't repeat, and a repeating todo can't have subtasks (server refuses, form hides the repeat)                                                                                                                                                          | a repeating checklist needs its subtasks copied to each occurrence: its own feature                        | assumed                       | medium: occurrence copying            |
| Lists (Todos tab, Planner, Today card, Easy view) show top-level todos with an "n of m done" mark, plus any subtask with its own due day or assignee, with a "Part of <parent>" line; the rest live on the parent's page                                          | a checklist doesn't flood "No date", and nobody misses a dated or assigned subtask                         | assumed                       | low: one pure rule                    |
| Subtasks are added inline on the parent's page (a title, then open it for details)                                                                                                                                                                                | the smallest add that fits the existing page                                                               | assumed                       | low                                   |
| Same permissions as todos: writers add, edit and delete subtasks; viewers and Easy roles tick their own                                                                                                                                                           | a subtask is a todo                                                                                        | assumed                       | low                                   |
| An offline subtask whose parent was deleted, or is past the depth limit, is refused on upload (`todoService:badParent`)                                                                                                                                           | as a link to a deleted provider is refused                                                                 | assumed                       | low                                   |
| Runs after `tags`                                                                                                                                                                                                                                                 | both change `todoService`, the todo page, todo rows and the device schema; `tags` is ahead in the table    | assumed                       | low: row order                        |

## Problem

A caretaker's todo is often several steps: "Get ready for the hospital stay" is pack the bag, arrange the dog sitter, print the medication list. Today each step is a separate todo with nothing tying them together, so the family can't see how far along the big one is, and someone has to remember to tick the big one when the last step is done.

## Solution

Any todo can have subtasks, and subtasks can have their own, three levels deep. A subtask is a full todo: it can have an assignee, a due day, links and notes, and it syncs and works offline like any todo. The todo's page lists its subtasks, where writers add them by typing a title. When the last open subtask is ticked, the parent ticks itself, and up the chain; reopening a subtask reopens it. The lists show each parent with how many of its subtasks are done, and a subtask shows up there on its own only when it has its own due day or assignee.

## User stories

1. As a caretaker, I want to add subtasks to a todo, so that a big job is broken into steps.
2. As a caretaker, I want to add subtasks to a subtask, up to three levels, so that a step can have its own steps.
3. As a caretaker, I want a todo to be done when its last subtask is, so that nobody has to tick it by hand.
4. As a caretaker, I want a done todo to reopen when one of its subtasks reopens or a new one is added, so that a done todo never hides open work.
5. As a caretaker, I want each subtask to be a full todo (assignee, due day, links, notes), so that I can hand one step to my brother.
6. As a viewer assigned a subtask, I want to tick it, and see its parent finish when mine was the last, so that my part counts.
7. As a caretaker, I want the lists to show "2 of 5 done" on a todo with subtasks, so that I can see progress at a glance.
8. As a caretaker, I want a subtask with its own due day or assignee to show in the Planner and the Todos tab with "Part of <parent>", so that I don't miss it.
9. As a caretaker, I want a subtask's page to link back to its parent, so that I can see the whole job.
10. As a caretaker, I want deleting a todo to delete its subtasks, so that no orphans are left.
11. As a caretaker offline, I want to add and tick subtasks and see the parent finish, so that it works in a waiting room with no signal.
12. As a member, I want subtasks someone else added to reach my device, so that we share one list.

## Implementation decisions

- **Schema.** `todo` gains `parent_id` (nullable), with a composite FK `(group_id, parent_id)` to `todo(group_id, id)` (NO ACTION: soft deletes only), and an index on `(group_id, parent_id)`. Additive; existing todos are top-level. The column joins the `todo` sync stream and the device schema.
- **The tree rules** (pure, both sides, beside `todoRules`): `MAX_TODO_DEPTH`; `depthOf` (from an ancestor chain); `canHaveSubtask(parent chain, parent)` (depth, not repeating, live); `rollupOf(parent, liveChildren)` returning `complete`, `reopen` or nothing; `subtaskProgress(children)` (`{ done, total }`); `listsOnItsOwn(todo)` (top-level, or a subtask with a due day or an assignee). Small inputs, a table of unit tests.
- **`todoService`.** `create` and `upsert` take `parentId`: the parent must be live, in the group, within depth and not repeating (`todoService:badParent`, a field issue on `parentId`); a subtask's `repeatRule` is refused, as is a rule on a todo with live subtasks (`todoService:repeatWithSubtasks`). `update` never takes `parentId`. `complete` refuses a todo with open live subtasks (`todoService:openSubtasks`). After `create`, `complete`, `reopen` and `remove` of a child, `rollUp(tx, parentId, actor)` recomputes the parent with `rollupOf` and climbs, writing as the system with the actor as `done_by`. `remove` soft-deletes the live descendants first. The rollup is idempotent and decided by the children's state, so two devices' offline changes to children land in either order on the same answer; the one edge is a parent unticked by hand while every child is done, which a late rollup completes again (the children decide).
- **The device** (`todos.sync`). `createTodo` takes `parentId` and checks the same rules from the local copy; `completeTodo`, `reopenTodo`, `removeTodo` and a subtask's create write the parent chain's rollup in the same local transaction, each parent write flagged with a rollup `_metadata` (as `UNDO_NEXT_METADATA`). The upload switch sends a flagged parent write to the service's `rollUp` for that row (a member check only: the server decides from its own rows), not to `complete` or `reopen`, so a viewer's tick never trips `completionOnly` on a parent. `removeTodo` soft-deletes the descendants in its transaction. New queries: `subtasksQuery(todoId)` and one group query of subtask progress per parent (never one per row).
- **The todo page.** A Subtasks band under Details: each live subtask with its tick, a progress line, and writers' inline "Add subtask" (hidden at the depth limit and on a repeating todo); a subtask's page shows "Part of <parent>" linking up. The tick of a parent with open subtasks is disabled and reads "n of m". The delete confirmation names the subtasks it takes. The form hides Repeat for a subtask or a todo with subtasks.
- **Lists.** The Todos tab, the Planner's All and Todos, the Today card and the Easy view filter with `listsOnItsOwn`, show `subtaskProgress` on parents and "Part of <parent>" on listed subtasks. Search and entry links are unchanged (a subtask is a todo there).
- **Connectors.** `listTodos` returns `parentId` so a member's AI sees the tree. Quick entry's `addTodo` makes top-level todos as today.
- **Old clients** ignore `parent_id`: they see every subtask as a todo, and their ticks still roll up on the server.

## Testing decisions

- **Unit:** the tree rules (depth, `rollupOf` for every mix of done, open and deleted children, progress, `listsOnItsOwn`), as `todoRules.test.ts`.
- **Integration:** `todoService` (prior art: its repeat and `releaseEvent` tests): depth, cross-group and deleted parents refused; rollup up two levels and back; a viewer's last tick completes a parent assigned to someone else; adding an open subtask reopens a done parent; delete cascades; repeat refused both ways; the device's flagged rollup upload is a no-op or the same answer in either order (as `syncTodos.int.test.ts`).
- **Component:** the Subtasks band, the disabled parent tick, the "Part of" link, list marks and the listing rule (prior art: `todo.browser.test.tsx`, `todos.browser.test.tsx`).
- **End to end:** `roundtrip`'s `todo` matrix: a viewer offline ticks the last subtask of a parent, the parent is done on the device at once and on the server after upload. No new check.

## Out of scope

- Moving a todo under another parent, or promoting a subtask to top level.
- Repeating todos with subtasks (a checklist copied to each occurrence): file as a follow-up if asked.
- Reordering subtasks by hand (they sort as todos do: `todoOrder`, then done).
- Quick entry making subtasks.

## Notes

- Seeds: append a Dev Family "Get ready for the hospital stay" with three subtasks: one done; one done by rollup, with its own done subtask; and one assigned to viewer@, the only open child, so `roundtrip`'s tick completes the parent. All fictional.
- The rollup writes as the system but records the actor as `done_by`, so "Done by" shows who finished the job.
