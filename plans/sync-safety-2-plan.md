# Plan: Sync safety 2: stale clocks, copies and tabs change nothing

> Source PRD: [`plans/sync-safety-2-prd.md`](sync-safety-2-prd.md). User-story numbers (US) refer to it. Backlog items B-295, B-296, B-383, B-384, B-387, B-730, B-805. Topic `sync-safety-2`. B-294 (atomic device writes) moved to `sync-safety-3` ([notes](sync-safety-3-notes.md)).

## Status

| Slice | Wave | State  | Merge into `prd/sync-safety-2` (slice commits) |
| ----- | ---- | ------ | ---------------------------------------------- |
| 1     | 1    | merged | 4d070348b (9f4435a03)                          |
| 2     | 1    | merged | 24b9272c5 (f8581109c..938e9e941)               |
| 3     | 2    | merged | 8cb04b6f4 (b830e7afd)                          |
| 4     | 1    | merged | 786118c26 (db392b14f, 64e2ce076)               |

- **Landing mode: run everything through** (dispatcher start, 2026-11-27).
- **Wave 1 landed** in dev 2026-11-27 through PR #308 (merge on GitHub, dev at d532090), tier components (CI run 46109445348 green on afc67f18c), Codex clean after three rounds: 959b11b28 (successor also made after the reopened row), df938bf03 (`todoModel.stampMadeAfter`: a next at least 1 ms after its predecessor), round 3 filed as B-1002 (fixes-bug, legacy rows). Items done: B-295, B-383, B-384, B-730, B-296; B-805 archived (answered in sync.md). Docs folded (medications, profiles, sync, todos, auth). Report filed. Slice models: all opus; docs fold sonnet.
- **Wave 2 under way:** dev synced (up to date) at 87c1eef24; B-387 claimed; slice 3 worktree made and one opus agent spawned (2026-11-28) with the wave-1 notes (successor rule `created_at >= done_at`, `stampMadeAfter`, `lockVisible`). Slice 3 merged as 8cb04b6f4 (B-387 done); its gap (the PATCH restore path) filed as B-1003 (fixes-bug). CI components run 46110688455 on c4fa8698f: flake only (linkToBox, todo-links' test, passed on retry). PR #311 opened; Codex review waiting. Next: CI gate (`risa tier`), PR, Codex, land, docs fold (todos, sync), then `risa rm sync-safety-2` (last wave). Nothing new to propose from the backlog.

## Durable decisions

- **A change's time has two parts:** the key (the device's time, for the entry's derived id) and the date (no later than the server's now).
- **A todo row is locked before a tick, reopen, skip, Undo or restore reads it.** A chain's successor is found by when it was made, never by its due day. A tick's next occurrence is flagged on the upload and never creates a row.
- **A pending sign-out names its session**, and finishes only that one. A stale tab closes without wiping; the device's owner rule decides.
- No migration, no sync-config change, no new dependency, no seed change, no device schema change. Edits to shared registries are additive ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)).

## How to run this plan

- **Wave 1: slices 1, 2 and 4** together. They share no file.
  - Slice 1 owns the medication, medication pass and condition services' change times, the shared change-time helper beside `toChangeTime` (the medications schema part), the timeline entry service's create-if-absent of a system change kind, and new data-package test files.
  - Slice 2 owns `todoService`, the todo model's locked read, the device's `reopenTodo` successor rule (the device's todo module) and new todo test files.
  - Slice 4 owns `lib/auth/` (the session module, the pending sign-out), the sign-in route's guard, and `lib/sync/index.ts`'s `openSync`.
- **Wave 2: slice 3**, after wave 1 lands. It owns the registry's todo PUT hook, `upsertOccurrence`, the device tick's twin and the todo rules' metadata constants.
- **Gates:** `pnpm prd check` per slice as [loop](../docs/agents/loop.md) says. Browser checks run once per wave on the integration branch, the ones `check-areas` maps for the changed files (expect `roundtrip`, `session-end`, `sign-in`). This topic adds no browser step: the lean set is at its ceiling.
- **Start conditions:** `tags` and `todo-subtasks` (planned) share the upload registry, `todoService` and the device's todo module; `push-notifications` (held) holds `lib/auth/session`. `pnpm prd sync` before each wave; whichever lands second syncs first.

**Backlog:** claim each slice's items when it starts; `done` them when it merges. Slice 1: B-295. Slice 2: B-383, B-384. Slice 3: B-387. Slice 4: B-296, B-730. B-805 (a question) is answered in the sync doc by this plan's landing, and marked done then.

Fold into the area docs at landing:

- **Slice 1:** [medications](../docs/domain/medications.md) (change entries' dates); [sync](../docs/domain/sync.md) one line on `changedAt`.
- **Slices 2, 3:** [todos](../docs/domain/todos.md) (the lock, the successor rule and its reliance on `complete`'s clamp, the tick flag); [sync](../docs/domain/sync.md)'s `todo` hooks line.
- **Slice 4:** [auth](../docs/domain/auth.md) (replace the B-730 ⚠ line); [sync](../docs/domain/sync.md) _Session_ (the session id, the stale-tab handover).

## Slice 1: Change entries never sit in the future

Stack: no · Reads: docs/domain/medications.md, docs/domain/sync.md, docs/domain/data-layer.md, docs/domain/timeline.md · Tests: unit, integration

Covers B-295. US 1, 2.

**What to build.** As the PRD's _Change entries' time_: one pure rule beside `toChangeTime` that gives a change's key (the device's time) and date (the earlier of it and now; both now without a `changedAt`). The medication, medication pass and condition services use the key for the derived entry id and the date for `occurredAt`, as does the condition manager unlink's time. A device's timeline entry PUT of a system change kind that creates the row (it arrived before its save) is clamped the same way, in the timeline entry service's `upsert` (not the registry); check what order the device writes them in and say so in the hand-off.

**Acceptance criteria**

- [ ] Unit tests for the rule: a time ahead gives now as the date and itself as the key; a time behind gives itself for both; unreadable or missing gives now for both.
- [ ] Integration (data package, new files): a medication stopped with a `changedAt` a day ahead writes its "Stopped" entry dated no later than now, with the id of the device's time; the same save replayed writes no second entry. The same for a pass moved and a condition changed.
- [ ] Integration: a device's copy of the change entry, uploaded before or after its save, leaves one entry, dated no later than now.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 2: A repeating todo's tick and reopen hold under races

Stack: no · Reads: docs/domain/todos.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: unit, integration

Covers B-384 (concurrent completions), B-383 (the successor rule). US 3, 4.

**What to build.** The todo model gains a locked read (`for update`, as the other models' locked reads); `complete`, `reopen`, `skip`, `removeUndoneNext` and `restoreOccurrence` take it first, inside their own transaction, and decide from the locked row. The successor lookup (the server's `laterInChain` and the device's in `reopenTodo`) becomes: the live row of the chain other than this one, made at or after this todo's `done_at`, earliest first (then id), whatever its due day. This comparison relies on `complete` clamping `done_at` to at most now (on the device, both times come from its clock): say so in a comment beside the clamp. `removeUndoneNext`'s before-lookup keeps its rule unless the same bug shows there (say so in the hand-off).

**Acceptance criteria**

- [ ] Integration (data package, a new file): two `complete` calls on one todo run at once on two connections with `doneAt` on different recipient days make exactly one next occurrence, and `done_by` is the first's.
- [ ] Integration: reopening a todo whose untouched successor was rescheduled to the same day, and to an earlier day, takes the successor away; a touched one stays and the reopened one stops repeating; an older ticked todo (A, B done, C open) still finds B, not C.
- [ ] Device tests: `reopenTodo` finds the same successor in the same cases.
- [ ] Every existing todo test passes unchanged.

**Blocked by:** nothing. **Blocks:** slice 3.

## Slice 3: A stale tick never revives a stopped chain

Stack: no · Reads: docs/domain/todos.md, docs/domain/sync.md · Tests: unit, integration

Covers B-387. US 5.

**What to build.** As the PRD's _Repeating todos_: a new metadata constant in the todo rules for a tick's next occurrence. The device's `completeTodo` writes its twin with it (`_metadata`, as `reopenTodo`'s Undo delete does). The registry's todo PUT hook passes the flag to `upsertOccurrence`: flagged, it never creates (it's satisfied by an existing row, or by nothing); unflagged (a skip's), today's rule.

**Acceptance criteria**

- [ ] Integration (API package, a new file): A ticks a repeating todo online; B deletes its successor ("stop repeating"); C's stale offline tick of the original and its flagged twin upload: the chain stays stopped (no open row), and both ops are `applied`.
- [ ] Integration: a skip's unflagged occurrence, with no open row in the chain, still creates it; a flagged twin whose row the server's tick made is `applied` and changes nothing; a viewer's own tick with its twin is `applied` for both.
- [ ] Device test: `completeTodo` writes the twin with the flag; `skipTodo` without it.

**Blocked by:** slice 2 (`todoService`, the device's todo module). **Blocks:** nothing.

## Slice 4: Sign-ins and tabs don't undo each other

Stack: no · Reads: docs/domain/auth.md, docs/domain/sync.md · Tests: unit

Covers B-730, B-296. US 6, 7.

**What to build.** As the PRD's _Sessions and tabs_. Each confirmed session check records the session's id beside its confirmation; an offline sign-out writes it into the pending marker. `finishPendingSignOut` asks whose session the cookie holds: the same id is signed out, a different one keeps the session and drops the marker, none drops the marker, offline stays pending; a marker with no id behaves as today. The sign-in page's loader and action keep using it. In `openSync`, another user's session closes the tab's handle without clearing (in-memory caches forgotten as `closeSync` does) and opens for the new user, leaving the wipe decision to `open`'s owner rule.

**Acceptance criteria**

- [ ] Unit or device tests (stubbed auth client, prior art `session.test.ts`): a pending marker for session S with the cookie holding S signs out and returns signed out; holding T (a magic-link or invite sign-in) keeps T, drops the marker and returns T's user; no session drops the marker; offline stays pending; a marker with no id signs out as today.
- [ ] Device test (prior art `index.test.ts`): `openSync` for user Y while the tab holds X's database doesn't clear when the device's owner is already Y, and clears through the owner rule when it is still X.

**Blocked by:** nothing. **Blocks:** nothing.
