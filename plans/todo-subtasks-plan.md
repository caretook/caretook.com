# Plan: Nested todos (subtasks)

> Source PRD: [`plans/todo-subtasks-prd.md`](todo-subtasks-prd.md). User-story numbers (US) refer to it. Backlog item B-550. Topic `todo-subtasks`.

## Status

**Where it stands (2026-11-25): planned.** Runs after `tags`.

| Slice | Wave | State   | Merge into `prd/todo-subtasks` (slice commits) |
| ----- | ---- | ------- | ---------------------------------------------- |
| 1     | 1    | planned |                                                |
| 2     | 2    | planned |                                                |
| 3     | 3    | planned |                                                |
| 4     | 4    | planned |                                                |
| 5     | 5    | planned |                                                |
| 6     | 6    | planned |                                                |

**Backlog:** claim B-550 when slice 1 starts; `pnpm backlog done B-550` when slice 6 merges.

## Architectural decisions

- **One migration, in slice 1:** `todo.parent_id` with its composite FK and index. No new dependency, route or table.
- **A subtask is a todo.** Links, notes, search, permissions and sync are unchanged; only the tree is new.
- **The tree rules are pure and shared** (beside `todoRules`): depth, `rollupOf`, progress, `listsOnItsOwn`. The service and the device both call them; neither re-derives them.
- **The rollup depends only on the children's final state** and climbs to the top, as the system with the actor as `done_by`. A device's parent write is flagged and the server recomputes it from its own rows; it never goes through `complete` or `reopen`.
- **The parent is set on create only.** `update` never takes `parentId`.
- **One live query per list, never one per row:** progress is one group query.
- **Registries are composed from area parts** ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)); additive edits only, at the end of the group, in `sync-config.yaml`, the device schema and the upload switch. Seeds append.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 → 2 → 3 → 4 → 5 → 6, one slice each: each builds on the last (server, device, the page's band, the parent's tick, the Todos tab, the other lists).
- **Gates:** slice 1 adds a migration, so wave 1 runs the full check; slice 2 adds a sync column and changes the upload switch, so wave 2 runs the full check and `roundtrip`.
- **The migration:** when a sync brings another topic's migration, keep `dev`'s and regenerate this one on top, then reread its SQL (the FK and index only; no hand edits).
- **Other topics' hot files:** `tags` (todoService, the todo page, todo rows, the device schema) runs first; sync after its landing. `sync-safety-2` (held) lists `lib/todos/` and `services/`: keep edits there small.
- **Docs at landing:** wave 1 [todos](../docs/domain/todos.md), [connectors](../docs/domain/connectors.md); wave 2 [todos](../docs/domain/todos.md), [sync](../docs/domain/sync.md); waves 3 to 5 [todos](../docs/domain/todos.md); wave 6 [appointments](../docs/domain/appointments.md) (the Planner), [timeline](../docs/domain/timeline.md) (the Today card, the Easy view).
- **When it's done:** `pnpm prd rm todo-subtasks`.

---

## Slice 1: `parent_id`, the tree rules and the server rollup

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/todos.md, docs/domain/care-groups.md, docs/domain/connectors.md · Tests: unit, integration

**Backlog:** B-550. **User stories:** 1, 2, 3, 4, 5, 6, 10, 12.

**What to build:** adds a migration: `todo.parent_id`, the composite FK to `todo` in the same group, an index on `(group_id, parent_id)`. The pure tree rules (_Implementation decisions_, "The tree rules"). `todoService`: `parentId` on create and upsert with `todoService:badParent`, `todoService:repeatWithSubtasks` both ways, `todoService:openSubtasks` on `complete`, `rollUp` after create, complete, reopen and remove (a subtask never repeats, so skip needs none), and the cascading soft delete; `update` stays without `parentId`. `rollUp` is exported for slice 2's upload switch. The connector tool `listTodos` returns `parentId`. Seeds append the hospital-stay todo and its subtasks (PRD _Notes_): viewer@'s subtask is the parent's only open child, so slice 2's `roundtrip` step finishes it.

**Acceptance criteria:**

- [ ] Unit: `rollupOf` for none, some and all children done, with deleted children ignored and a lone deleted child doing nothing; `depthOf`/`canHaveSubtask` at depths 1 to 4 and on a repeating parent; `subtaskProgress`; `listsOnItsOwn` for top-level, dated, assigned and plain subtasks.
- [ ] Integration: a writer adds a subtask and a sub-subtask; a fourth level, a cross-group parent, a deleted parent and a repeating parent are refused with `badParent`; a repeat on a subtask or on a todo with subtasks is refused.
- [ ] Integration: ticking the last open sub-subtask completes its parent and grandparent with the actor as `done_by`; reopening it reopens both; adding an open subtask to a done parent reopens it; deleting the last open subtask with done siblings completes the parent.
- [ ] Integration: a viewer ticks their own last subtask of a parent assigned to someone else, and the parent is done; a viewer's `complete` of a parent with open subtasks is `openSubtasks`.
- [ ] Integration: deleting a parent soft-deletes every live descendant in one transaction; a non-member reads and writes nothing.
- [ ] Integration: `listTodos` includes `parentId`.

**Blocked by:** none (the `tags` topic lands first). **Blocks:** 2.

---

## Slice 2: The device writes subtasks offline

Stack: yes · Reads: docs/domain/sync.md, docs/domain/todos.md · Tests: unit, integration, e2e:roundtrip

**Backlog:** B-550. **User stories:** 3, 4, 6, 10, 11, 12.

**What to build:** `parent_id` joins the `todo` sync stream and the device schema. In `todos.sync`, `createTodo` takes `parentId` and checks the tree rules against the local copy; `completeTodo`, `reopenTodo`, `removeTodo` and a subtask's create write the parent chain's rollup in their local transaction, each parent write flagged with a rollup `_metadata`; `removeTodo` soft-deletes the descendants. The upload switch sends a flagged parent write to `todoService.rollUp` (a member check; the server decides from its rows). `subtasksQuery(todoId)` and one group query of subtask progress per parent. Old unflagged done PATCHes keep their meaning. The "Not saved" page gets a reason sentence for `badParent`, `openSubtasks` and `repeatWithSubtasks`.

**Acceptance criteria:**

- [ ] Integration: an uploaded flagged parent write from a viewer recomputes the parent and never returns `completionOnly`; uploaded after a server-side change that reopened the parent, it leaves the server's answer (as `syncTodos.int.test.ts`).
- [ ] Integration: two devices' offline changes (one ticks the last subtask, one adds an open subtask) end with the parent open on the server in either upload order; a late flagged write re-completes a parent someone unticked by hand while every child is done (the children decide, as the PRD says).
- [ ] Unit or device test: `completeTodo` on the last open subtask marks the chain done in one local transaction; `reopenTodo` reopens it; `createTodo` past the depth limit or under a repeating parent is refused locally; `removeTodo` takes the descendants (prior art: `todos.sync.browser.test.tsx`).
- [ ] e2e `roundtrip`: add `todo` matrix rows: viewer@ offline ticks their seeded last open subtask, the parent is done on the device at once and on the server after upload.

**Blocked by:** 1. **Blocks:** 3.

---

## Slice 3: The todo page's Subtasks band

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**Backlog:** B-550. **User stories:** 1, 2, 5, 6, 9.

**What to build:** on the todo page (`appUrls.todo`), a Subtasks band under Details: each live subtask with its tick (with Undo as other surfaces), its title opening its page, a "n of m done" line, and writers' inline "Add subtask" (a title field writing `createTodo` with `parentId`), hidden at the depth limit and on a repeating todo. A subtask's page shows "Part of <parent>" linking up.

**Acceptance criteria:**

- [ ] Component: a writer adds a subtask inline and it shows in the band; at the third level the add is gone; a viewer sees the band and ticks only their own subtask.
- [ ] Component: ticking the last open subtask shows the parent done on the page.
- [ ] Component: a subtask's page links to its parent; a deleted parent's subtask is a 404 like any deleted todo.

**Blocked by:** 2. **Blocks:** 4.

---

## Slice 4: The parent's tick, delete and form

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: component

**Backlog:** B-550. **User stories:** 3, 7, 10.

**What to build:** the shared tick (every todo surface) takes optional progress: on a parent with open subtasks it is disabled and reads "n of m". The todo page's delete confirmation names how many subtasks go with it. `TodoForm` (the edit sheet) hides Repeat for a subtask or a todo with subtasks.

**Acceptance criteria:**

- [ ] Component: the parent's tick is disabled with "2 of 3" while one subtask is open, and enabled once all are done; a tick given no progress is as before.
- [ ] Component: the delete dialog names the subtask count; the edit form shows no Repeat on a subtask or a parent, and does on a plain todo.

**Blocked by:** 3. **Blocks:** 5.

---

## Slice 5: The Todos tab shows the tree

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-550. **User stories:** 7, 8.

**What to build:** the Todos tab filters with `listsOnItsOwn`, shows "n of m done" on a parent's row (from the one progress query) and "Part of <parent>" on a listed subtask's row; its done count and Done pages follow the same rule. The row marks are shared pieces slice 6 reuses. Search and an entry's Todos are unchanged.

**Acceptance criteria:**

- [ ] Unit: `todoList`'s sections drop an undated, unassigned subtask and keep a dated or assigned one.
- [ ] Component: the Todos tab shows a parent with "1 of 3 done", a dated subtask under its day with "Part of …", and no plain subtask; "Mine" shows viewer@'s assigned subtask.
- [ ] Integration: `listTodos` includes `parentId`.

**Blocked by:** 4. **Blocks:** 6.

---

## Slice 6: The Planner, the Today card and the Easy view

Stack: no · Reads: docs/domain/todos.md, docs/domain/appointments.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-550. **User stories:** 7, 8.

**What to build:** the Planner's All and Todos, the Today card's todo strip and the Easy view's My todos filter with `listsOnItsOwn` and use slice 5's row marks ("n of m done", "Part of <parent>").

**Acceptance criteria:**

- [ ] Unit: `plannerTodos` and `todoStrip` drop an undated, unassigned subtask and keep a dated or assigned one.
- [ ] Component: the Planner's Todos shows a parent's progress and a dated subtask with "Part of …".
- [ ] Component: the Easy view lists an Easy helper's assigned subtask and they tick it.

**Blocked by:** 5. **Blocks:** none.
