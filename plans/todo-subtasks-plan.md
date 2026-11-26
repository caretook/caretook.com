# Plan: Nested todos (subtasks)

> Source PRD: [`plans/todo-subtasks-prd.md`](todo-subtasks-prd.md). User-story numbers (US) refer to it. Backlog item B-550. Topic `todo-subtasks`.

## Status

**Where it stands (2026-11-26): wave 3 running.** Landing mode: **run everything through** (started run-through by the dispatcher; land each green wave, ask only real questions). Models: slices on opus. The lists are the follow-on topic [`todo-subtasks-2`](todo-subtasks-2-plan.md).

**Wave 3 (2026-11-26):** resumed on the backlog session's word (the pause is lifted; ask a266 dismissed). Ingest: nothing new for this topic. Dev synced at ebf957fb (no migrations; schema tidy only). Worktree `.loops/todo-subtasks-3` (slot 3) made; slice 3 agent (opus) spawned, told to add the `openSubtasks`/`badParent`/`repeatWithSubtasks` wording on the "Not saved" page. Slice 3 handed off (181f873c; quick check passed), merged at 12fd15ff. Gate: `full` CI (tier tool said `components`; the plan's `full` for the device schema and upload registry), run pending. Slice 3 notes: `subtaskProgressQuery(groupId)` + `progressByParent`, `subtasksQuery`; `removeTodo` returns `{ ok }`; `updateTodo` also refuses a repeat on a subtask or parent; `createOnly: { parent_id }` in syncRegistry.

**Wave 2 landed** in `dev` as 588c2017 through PR #217, tier `integration` (run 45811545080 on 2a6745f8: file, only boundary.test, dev's B-865/B-866), **without Codex (out of credits)**; a live dev brake (B-868) needed `prd sync --force` (2a6745f8) and a quick check (passed). Report a264; to-test `to-test/2026-11-26-0639-todo-subtasks.md`. Slice 2 worktree removed.

**Wave 1 landed** in `dev` as 1b34ce24 through PR #214, tier `full` (run 45797912432 on 39c49a52: brake, every failure dev's: boundary.test B-865/B-866, build budget B-868, landed `--fixes B-868`), **without Codex (out of credits)**. Slice 1 merged ffdfad37 plus fix 12904700 (todoRename's exact index list). Migration `0047_todo_subtasks`; `parent_id` already in the `todo` stream (rolesSql needs it; device schema is slice 3). Browser lean set 10/11; session-end fails on dev too: filed B-869. to-test `to-test/2026-11-26-0600-todo-subtasks.md`. Docs: todos.md _Subtasks_ (trimmed to stay under budget). Slice 1 worktree removed.

**Wave 2 (2026-11-26):** dev synced at 1924784c (CI lists only, no recheck). Worktree `.loops/todo-subtasks-2` (slot 3) made; slice 2 agent (opus) handed off (c3801a41, 646fe7f9, a5df9a8c; quick check passed), merged at 305bd996. Gate: `integration` run 45809410424 on d84b706d: file, only boundary.test (dev's by blame, B-865/B-866) — **green for the branch**. Sync: no merge needed. PR #217 open; Codex out of credits (exit 4): land `--tier integration --no-review`. Docs folded (todos.md rollup and cascade; connectors.md `parentId`; trimmed under budget). Notes for later slices: `rollUp(tx, parentId, actorId, at?)` exported (slice 4 passes the device's tick time); `remove` returns `{ ids }`; no `openSubtasks` wording in `unsavedChanges.ts` yet (slice 3); connector descriptions can't say "task" (say "step"). Backlog ingest: nothing new for this topic.

| Slice | Wave | State          | Merge into `prd/todo-subtasks` (slice commits) |
| ----- | ---- | -------------- | ---------------------------------------------- |
| 1     | 1    | landed (opus)  | ffdfad37 (c6274c06, 6aaf82f4)                  |
| 2     | 2    | landed (opus)  | 305bd996 (c3801a41, 646fe7f9, a5df9a8c)        |
| 3     | 3    | running (opus) |                                                |
| 4     | 4    | planned        |                                                |
| 5     | 5    | planned        |                                                |
| 6     | 6    | planned        |                                                |

**Wave 1 (2026-11-26):** worktree `.loops/todo-subtasks-1` (slot 3) made, slice 1 (opus) handed off and merged at ffdfad37; migration 0047_todo_subtasks. `parent_id` already streamed in `sync-config.yaml` (rolesSql needs every column; device schema still slice 3). Wave gate: `full` CI run 45792344179 on 447e9d6e: **brake** — todoRename.int.test.ts (exact index list, new index) fixed by slice 1 (f27f0c14), merged again at 12904700; dev synced at 89a10d65 (no migrations or seeds); full rerun 45797912432 on 39c49a52: brake, all dev's by blame (boundary.test B-865/B-866, build budget B-868; timelineBack flaky, quarantined) — **wave 1 green for the branch**; land needs `--fixes B-868`. PR #214 open; Codex out of credits (exit 4): land `--no-review`. Docs folded (todos.md, 53901766). Browser lean set: 10/11 pass; session-end fails on dev too (2/2 at load ~11 on dev 0005f796): filed B-869 (fixes-tooling), not this branch's. Landing: `--tier full --no-review --fixes B-868`; the app bundle 163 B over budget is dev's (blame; B-868, dev a84d6611 brakes on it too, so landing needs `--fixes B-868` or its fix in dev); a format warn on this plan file, fixed at 6265dad3.

**Backlog:** B-550 claimed by prd/todo-subtasks (only item for this topic); it stays open for `todo-subtasks-2`, whose last slice runs `pnpm backlog done B-550`.

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

- **Waves:** 1 → 2 → 3 → 4 → 5 → 6, one slice each: each builds on the last (server tree, server rollup, device sync, device rollup, the page's band, the parent's tick).
- **Gates:** slice 1 adds a migration, so wave 1 runs the full check; slice 3 adds a sync column, so wave 3 runs the full check; slice 4 changes the upload switch, so wave 4 runs `roundtrip`.
- **The migration:** when a sync brings another topic's migration, keep `dev`'s and regenerate this one on top, then reread its SQL (the FK and index only; no hand edits).
- **Other topics' hot files:** `tags` (todoService, the todo page, todo rows, the device schema) runs first; sync after its landing. `sync-safety-2` (held) lists `lib/todos/` and `services/`: keep edits there small.
- **Docs at landing:** waves 1 and 2 [todos](../docs/domain/todos.md), wave 2 also [connectors](../docs/domain/connectors.md); waves 3 and 4 [todos](../docs/domain/todos.md), [sync](../docs/domain/sync.md); waves 5 and 6 [todos](../docs/domain/todos.md).
- **When it's done:** `pnpm prd rm todo-subtasks`; `todo-subtasks-2` can start.

---

## Slice 1: `parent_id`, the tree rules and subtasks on the server

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/todos.md, docs/domain/care-groups.md · Tests: unit, integration

**Backlog:** B-550. **User stories:** 1, 2, 5, 12.

**What to build:** adds a migration: `todo.parent_id`, the composite FK to `todo` in the same group, an index on `(group_id, parent_id)`. The pure tree rules in one file (_Implementation decisions_, "The tree rules"). `todoService`: `parentId` on create and upsert with `todoService:badParent`, and `todoService:repeatWithSubtasks` both ways; `update` stays without `parentId`. Seeds append the hospital-stay todo and its subtasks (PRD _Notes_): viewer@'s subtask is the parent's only open child, so slice 4's `roundtrip` step finishes it. No rollup yet.

**Acceptance criteria:**

- [ ] Unit: `rollupOf` for none, some and all children done, with deleted children ignored and a lone deleted child doing nothing; `depthOf`/`canHaveSubtask` at depths 1 to 4 and on a repeating parent; `subtaskProgress`; `listsOnItsOwn` for top-level, dated, assigned and plain subtasks.
- [ ] Integration: a writer adds a subtask and a sub-subtask; a fourth level, a cross-group parent, a deleted parent and a repeating parent are refused with `badParent`; a repeat on a subtask or on a todo with subtasks is refused; a viewer can't add one; a non-member reads and writes nothing.

**Blocked by:** none (the `tags` topic lands first). **Blocks:** 2.

---

## Slice 2: The server rollup and cascading delete

Stack: yes · Reads: docs/domain/todos.md, docs/domain/care-groups.md, docs/domain/connectors.md · Tests: integration

**Backlog:** B-550. **User stories:** 3, 4, 6, 10.

**What to build:** in `todoService`, `rollUp(tx, parentId, actor)` after create, complete, reopen and remove of a child (a subtask never repeats, so skip needs none), climbing to the top as the system with the actor as `done_by`; `todoService:openSubtasks` on `complete` of a parent with open live subtasks; `remove` soft-deletes the live descendants first. `rollUp` is exported for slice 4's upload switch. The connector tool `listTodos` returns `parentId`.

**Acceptance criteria:**

- [ ] Integration: ticking the last open sub-subtask completes its parent and grandparent with the actor as `done_by`; reopening it reopens both; adding an open subtask to a done parent reopens it; deleting the last open subtask with done siblings completes the parent.
- [ ] Integration: a viewer ticks their own last subtask of a parent assigned to someone else, and the parent is done; a viewer's `complete` of a parent with open subtasks is `openSubtasks`.
- [ ] Integration: deleting a parent soft-deletes every live descendant in one transaction.
- [ ] Integration: `listTodos` includes `parentId`.

**Blocked by:** 1. **Blocks:** 3.

---

## Slice 3: Subtasks reach the device

Stack: yes · Reads: docs/domain/sync.md, docs/domain/todos.md · Tests: unit, integration

**Backlog:** B-550. **User stories:** 1, 2, 10, 11, 12.

**What to build:** `parent_id` joins the `todo` sync stream and the device schema. In `todos.sync`, `createTodo` takes `parentId` and checks the tree rules against the local copy; `removeTodo` soft-deletes the descendants in its transaction. `subtasksQuery(todoId)` and one group query of subtask progress per parent. The "Not saved" page gets a reason sentence for `badParent`, `openSubtasks` and `repeatWithSubtasks`. No device rollup yet.

**Acceptance criteria:**

- [ ] Integration: a device's uploaded subtask create lands with its parent; one past the depth limit or under a deleted parent is refused with `badParent` (as `syncTodos.int.test.ts`).
- [ ] Unit or device test: `createTodo` past the depth limit or under a repeating parent is refused locally; `removeTodo` takes the descendants; the progress query counts per parent (prior art: `todos.sync.browser.test.tsx`).

**Blocked by:** 2. **Blocks:** 4.

---

## Slice 4: The device's rollup, offline

Stack: yes · Reads: docs/domain/sync.md, docs/domain/todos.md · Tests: unit, integration, e2e:roundtrip

**Backlog:** B-550. **User stories:** 3, 4, 6, 11.

**What to build:** `completeTodo`, `reopenTodo`, `removeTodo` and a subtask's create write the parent chain's rollup in their local transaction, each parent write flagged with a rollup `_metadata` (as `UNDO_NEXT_METADATA`). The upload switch sends a flagged parent write to `todoService.rollUp` (a member check; the server decides from its rows). Old unflagged done PATCHes keep their meaning.

**Acceptance criteria:**

- [ ] Integration: an uploaded flagged parent write from a viewer recomputes the parent and never returns `completionOnly`; uploaded after a server-side change that reopened the parent, it leaves the server's answer (as `syncTodos.int.test.ts`).
- [ ] Integration: two devices' offline changes (one ticks the last subtask, one adds an open subtask) end with the parent open on the server in either upload order; a late flagged write re-completes a parent someone unticked by hand while every child is done (the children decide, as the PRD says).
- [ ] Unit or device test: `completeTodo` on the last open subtask marks the chain done in one local transaction; `reopenTodo` reopens it.
- [ ] e2e `roundtrip`: add `todo` matrix rows: viewer@ offline ticks their seeded last open subtask, the parent is done on the device at once and on the server after upload.

**Blocked by:** 3. **Blocks:** 5.

---

## Slice 5: The todo page's Subtasks band

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**Backlog:** B-550. **User stories:** 1, 2, 5, 6, 9.

**What to build:** on the todo page (`appUrls.todo`), a Subtasks band under Details: each live subtask with its tick (with Undo as other surfaces), its title opening its page, a "n of m done" line, and writers' inline "Add subtask" (a title field writing `createTodo` with `parentId`), hidden at the depth limit and on a repeating todo. A subtask's page shows "Part of <parent>" linking up.

**Acceptance criteria:**

- [ ] Component: a writer adds a subtask inline and it shows in the band; at the third level the add is gone; a viewer sees the band and ticks only their own subtask.
- [ ] Component: ticking the last open subtask shows the parent done on the page.
- [ ] Component: a subtask's page links to its parent; a deleted parent's subtask is a 404 like any deleted todo.

**Blocked by:** 4. **Blocks:** 6.

---

## Slice 6: The parent's tick, delete and form

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: component

**Backlog:** B-550. **User stories:** 3, 7, 10.

**What to build:** the shared tick (every todo surface) takes optional progress: on a parent with open subtasks it is disabled and reads "n of m". The todo page's delete confirmation names how many subtasks go with it. `TodoForm` (the edit sheet) hides Repeat for a subtask or a todo with subtasks.

**Acceptance criteria:**

- [ ] Component: the parent's tick is disabled with "2 of 3" while one subtask is open, and enabled once all are done; a tick given no progress is as before.
- [ ] Component: the delete dialog names the subtask count; the edit form shows no Repeat on a subtask or a parent, and does on a plain todo.

**Blocked by:** 5. **Blocks:** `todo-subtasks-2` (the lists).
