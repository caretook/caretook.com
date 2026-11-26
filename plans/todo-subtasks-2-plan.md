# Plan: Nested todos in the lists

> Source PRD: [`plans/todo-subtasks-prd.md`](todo-subtasks-prd.md) (_Implementation decisions_, "Lists"). User-story numbers (US) refer to it. Backlog item B-550. Topic `todo-subtasks-2`, the follow-on of [`todo-subtasks`](todo-subtasks-plan.md), cut off so each slice stays small.

## Status

**Where it stands (2026-11-26): wave 2 running (slice 2).** Landing mode: **run everything through** (started run-through; land each green wave, ask only real questions). Models: slices on opus. `todo-subtasks` is done (landed bacd6b65).

**Wave 1 (2026-11-26):** ingest: nothing new for this topic (B-914 flavor packs is unrelated). Sync: up to date with dev. B-550 is still owned by `prd/todo-subtasks` (a forced claim was blocked; that topic is done, so left as is). Worktree `.loops/todo-subtasks-2-1` made (no stack); slice 1 agent (opus) spawned with todo-subtasks' notes (`subtaskProgressQuery` + `progressByParent`, `TodoTick` `progress`, `TodoParentLink`). Watch running. Slice 1 handed off (6955c09e; quick check passed), merged at 9c2effa9. Notes for slice 2: `TodoProgressMark`, `TodoPartOf` (components/todos/TodoTreeMarks), `parentsById` + `progressByParent` from the one `subtaskProgressQuery` (now joins the parent's title), `TodosFilter.listed`, `TodoTick` `showCount`; list rows disable a waiting parent's tick. Docs to fold: todos.md ("Only the todo page feeds it yet" stale), components.md (the marks). Docs folded (d0ea9cd6; todos.md 10,231 B, components.md 10,229 B). Gate green: `components` run 45867409043 on c895b271. Slice 1 worktree removed. Sync: no merge needed. `prd browser --changed`: none needed. PR #228; Codex out of credits: landing `--no-review`.

**Wave 1 landed** in `dev` as 8e4bfba8 through PR #228, tier `components` (run 45867409043 on c895b271, green), **without Codex (out of credits)**; landed unsynced (dev's 2 commits shared no file). to-test `to-test/2026-11-26-1234-todo-subtasks-2.md`. Lean browser suite not run (standing rule: ask before `--suite`; `--changed` named none).
**Wave 2 (2026-11-26):** fresh session after rotation; no cut-off landing. Ingest: nothing new. Sync: no merge needed. Anchors ok. Worktree `.loops/todo-subtasks-2-2` made (no stack); slice 2 agent (opus) spawned with slice 1's notes. Watch running.

| Slice | Wave | State   | Merge into `prd/todo-subtasks-2` (slice commits) |
| ----- | ---- | ------- | ------------------------------------------------ |
| 1     | 1    | landed  | 9c2effa9 (6955c09e)                              |
| 2     | 2    | started |                                                  |

## Architectural decisions

- **No migration, no sync change:** `todo-subtasks` built the column, the tree rules (`listsOnItsOwn`, `subtaskProgress`) and the one group progress query; these slices only read them.
- **One live query per list, never one per row.**
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 → 2.
- **Gates:** screens only; the quick check.
- **Docs at landing:** wave 1 [todos](../docs/domain/todos.md); wave 2 [appointments](../docs/domain/appointments.md) (the Planner), [timeline](../docs/domain/timeline.md) (the Today card, the Easy view).
- **When it's done:** `pnpm prd rm todo-subtasks-2`.

---

## Slice 1: The Todos tab shows the tree

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-550. **User stories:** 7, 8.

**What to build:** the Todos tab filters with `listsOnItsOwn`, shows "n of m done" on a parent's row (from the one progress query) and "Part of <parent>" on a listed subtask's row; its done count and Done pages follow the same rule. The row marks are shared pieces slice 2 reuses. Search and an entry's Todos are unchanged.

**Acceptance criteria:**

- [ ] Unit: `todoList`'s sections drop an undated, unassigned subtask and keep a dated or assigned one.
- [ ] Component: the Todos tab shows a parent with "1 of 3 done", a dated subtask under its day with "Part of …", and no plain subtask; "Mine" shows viewer@'s assigned subtask.
- [ ] Integration: `listTodos` includes `parentId`.

**Blocked by:** `todo-subtasks` (all of it). **Blocks:** 2.

---

## Slice 2: The Planner, the Today card and the Easy view

Stack: no · Reads: docs/domain/todos.md, docs/domain/appointments.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-550. **User stories:** 7, 8.

**What to build:** the Planner's All and Todos, the Today card's todo strip and the Easy view's My todos filter with `listsOnItsOwn` and use slice 1's row marks ("n of m done", "Part of <parent>").

**Acceptance criteria:**

- [ ] Unit: `plannerTodos` and `todoStrip` drop an undated, unassigned subtask and keep a dated or assigned one.
- [ ] Component: the Planner's Todos shows a parent's progress and a dated subtask with "Part of …".
- [ ] Component: the Easy view lists an Easy helper's assigned subtask and they tick it.

**Blocked by:** 1. **Blocks:** none. Its merge runs `pnpm backlog done B-550`.
