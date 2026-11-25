# Plan: Sync safety 2: a device write lands whole, and stale copies change nothing

> Source PRD: [`plans/sync-safety-2-prd.md`](sync-safety-2-prd.md). User-story numbers (US) refer to it. Backlog items B-294, B-295, B-296, B-383, B-384, B-387, B-730. Topic `sync-safety-2`.

## Status

| Slice | Wave | State   | Merge into `prd/sync-safety-2` (slice commits) |
| ----- | ---- | ------- | ---------------------------------------------- |
| 1     | 1    | planned |                                                |
| 2     | 2    | planned |                                                |
| 3     | 1    | planned |                                                |
| 4     | 1    | planned |                                                |
| 5     | 2    | planned |                                                |
| 6     | 1    | planned |                                                |

## Durable decisions

- **A device write is the unit.** Ops carry their device transaction's id; the server applies consecutive ops of one write in one database transaction, which every handler and service joins through its context (never a transaction of its own beside it). A refusal rolls the whole write back: the refused op keeps its code, the others answer `sync:writeRefused`. A failure answers `failed` for the write's first op and stops. Results stay one per op.
- **Requests hold whole writes:** up to 100 ops, or one write alone of up to 1,000.
- **A change's time has two parts:** the key (the device's time, for the entry's derived id) and the date (no later than the server's now).
- **A todo row is locked before a tick, reopen, skip, Undo or restore reads it.** A chain's successor is found by when it was made, never by its due day. A tick's next occurrence is flagged on the upload and never creates a row.
- **A pending sign-out names its session**, and finishes only that one.
- No migration, no sync-config change, no new dependency, no seed change. Edits to shared registries are additive ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)).

## How to run this plan

- **Wave 1: slices 1, 3, 4 and 6** together. They share no file. Slice 1 owns the upload procedure (`sync.ts`), the upload registry's transaction plumbing, the uploader module, the try counter, the `unsaved_change` column and new upload test files. Slice 3 owns the medication, medication pass and condition services' change times, the shared change-time helper beside `toChangeTime`, and new data-package test files. Slice 4 owns `todoService` (and the todo model's lock), the device's `reopenTodo` successor rule, and new todo test files. Slice 6 owns `lib/auth/` (the session module, the pending sign-out), the sign-in route's guard, and `lib/sync/index.ts`'s `openSync`.
- **Wave 2: slices 2 and 5**, after wave 1 lands. Slice 2 owns the not-saved page and `unsavedChanges.sync.ts`. Slice 5 owns the todo upload hook in the registry, `upsertOccurrence`, the device tick's twin and the todo rules' metadata constants. They share no file.
- **Gates:** `pnpm prd check` per slice as [loop](../docs/agents/loop.md) says. Browser checks run once per wave on the integration branch, the ones `check-areas` maps for the changed files (expect `roundtrip`, `session-end`, `sign-in`, `first-sync`). This topic adds no browser step: the lean set is at its ceiling.
- **Start conditions:** `symptom-catalog` (running) and `planner-3`/`tags` (planned) share the upload registry, the device schema, `todoService` and the device's todo module. `pnpm prd sync` before each wave; whichever lands second syncs first.

**Backlog:** claim each slice's items when it starts; `done` them when it merges. Slice 1: B-294 (with slice 2). Slice 3: B-295. Slice 4: B-383, B-384. Slice 5: B-387. Slice 6: B-296, B-730.

Fold into the area docs at landing:

- **Slices 1, 2:** [sync](../docs/domain/sync.md) _Upload_ (writes as units, `sync:writeRefused`, the request limits, the uploader's batching, the write id in `unsaved_change`); [app-shell](../docs/domain/app-shell.md) for the page's lines; [api](../docs/domain/api.md) if it lists `sync.upload`'s input.
- **Slice 3:** [medications](../docs/domain/medications.md) (change entries' dates); [sync](../docs/domain/sync.md) one line on `changedAt`.
- **Slices 4, 5:** [todos](../docs/domain/todos.md) (the lock, the successor rule, the tick flag); [sync](../docs/domain/sync.md)'s `todo` hooks line.
- **Slice 6:** [auth](../docs/domain/auth.md) (replace the B-730 ⚠ line); [sync](../docs/domain/sync.md) _Session_ (the session id, the stale-tab handover).

## Slice 1: A device write lands whole

Stack: no · Reads: docs/domain/sync.md, docs/domain/api.md, docs/domain/data-layer.md, docs/domain/appointments.md, docs/domain/todos.md · Tests: unit, integration

Covers B-294 (the server and the uploader). US 1, 3.

**What to build.** As the PRD's _A device write as one unit_. The request's op gains the optional write id (PowerSync's transaction id); the schema allows 100 ops, or 1,000 when all share one write id. The procedure groups consecutive ops of one write and runs each group in one database transaction that every handler joins (the registry's soft-delete PUT and any other `withTransaction` there pass the context's transaction; check each service the registry calls joins it). At the first refusal in a group: roll back, answer the refused op with its own code, the group's other ops `sync:writeRefused` (a new error in the sync errors part, its meta naming the refused op's id), and carry on with the next group. A throw or non-4xx: roll back, probe as today, answer `failed` for the group's first op and stop. Compaction only for committed note updates. On the device, the uploader fills a request with whole writes up to 100 ops (one write over 100 goes alone; never split one), counts a failed write's try against its first entry, sets the whole write aside at the existing limit, and records the write id in each `unsaved_change` record (a new local-only column). The one-by-one resend after a 400 sends one write per request. **Audit** every multi-row device write (the device modules' local transactions): list them in the hand-off with whether any op in one is routinely refused while the rest should land; split any such write on the device into two, and name it.

**Acceptance criteria**

- [ ] Integration (API package, a new file): a write of three ops whose second is refused leaves none of them in Postgres; the second is `rejected` with its code and issues, the first and third `sync:writeRefused` naming it; a following single-op write in the same request is `applied`.
- [ ] Integration: a write whose second op throws is rolled back, answered `failed` at its first op with nothing after; with the probe failing too, the request is a 5xx.
- [ ] Integration: a series split's ops, as the device writes them, uploaded as one write of more than 100 ops land whole; with the new series' insert refused (a viewer, say), none of its rows land.
- [ ] Integration: ops without a write id behave exactly as today (every existing `sync*.int.test.ts` passes unchanged); 101 ops of mixed writes, and 1,001 of one, are refused by the schema.
- [ ] Device tests (the uploader with a stubbed server): batches never split a write; a 150-op write goes alone; a failed write counts one try and is acknowledged only up to its start; at the limit the whole write is set aside and recorded with its write id; refused writes are recorded with their write id.
- [ ] The hand-off lists the audited device writes and any split.

**Blocked by:** nothing. **Blocks:** slices 2 and 5.

## Slice 2: Not saved, one line per write

Stack: no · Reads: docs/domain/sync.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: component, unit

Covers B-294 (the list). US 2, 3.

**What to build.** On Settings → "Changes not saved": records sharing a write id are one line, labelled by the first of its rows with a label and given the reason of the op that caused the refusal (not `sync:writeRefused`); Dismiss removes the whole write's records. "Try again" on a set-aside write resends all its records in one request, as one write (one write id) in their recorded order: `applied` for all removes the line, anything else keeps it with the new reason. Records with no write id show as today.

**Acceptance criteria**

- [ ] Unit or device tests for the grouping: three records of one write make one line with the refused op's reason and the first label; two writes make two lines; records with no write id are a line each per row, as today.
- [ ] Component tests: the line's wording; Dismiss removes all of a write's records; "Try again" sends one request with the write's ops sharing one id, removes the line when all are `applied`, and keeps it with the new reason otherwise.

**Blocked by:** slice 1 (the write id in the records, the request field). **Blocks:** nothing.

## Slice 3: Change entries never sit in the future

Stack: no · Reads: docs/domain/medications.md, docs/domain/sync.md, docs/domain/data-layer.md, docs/domain/timeline.md · Tests: unit, integration

Covers B-295. US 4, 5.

**What to build.** As the PRD's _Change entries' time_: one pure rule beside `toChangeTime` that gives a change's key (the device's time) and date (the earlier of it and now; both now without a `changedAt`). The medication, medication pass and condition services use the key for the derived entry id and the date for `occurredAt`, as does the condition manager unlink's time. A device's timeline entry PUT of a system change kind that creates the row (it arrived before its save) is clamped the same way; check what order the device writes them in and say so in the hand-off.

**Acceptance criteria**

- [ ] Unit tests for the rule: a time ahead gives now as the date and itself as the key; a time behind gives itself for both; unreadable or missing gives now for both.
- [ ] Integration (data package, new files): a medication stopped with a `changedAt` a day ahead writes its "Stopped" entry dated no later than now, with the id of the device's time; the same save replayed writes no second entry. The same for a pass moved and a condition changed.
- [ ] Integration: a device's copy of the change entry, uploaded before or after its save, leaves one entry, dated no later than now.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 4: A repeating todo's tick and reopen hold under races

Stack: no · Reads: docs/domain/todos.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: unit, integration

Covers B-384 (concurrent completions), B-383 (the successor rule). US 6, 7.

**What to build.** The todo model gains a locked read (`for update`, as the other models' locked reads); `complete`, `reopen`, `skip`, `removeUndoneNext` and `restoreOccurrence` take it first and decide from the locked row. The successor lookup (the server's `laterInChain` and the device's in `reopenTodo`) becomes: the live row of the chain other than this one, made at or after this todo's `done_at`, earliest first (then id), whatever its due day. `removeUndoneNext`'s before-lookup keeps its rule unless the same bug shows there (say so in the hand-off).

**Acceptance criteria**

- [ ] Integration (data package, a new file): two `complete` calls on one todo run at once on two connections with `doneAt` on different recipient days make exactly one next occurrence, and `done_by` is the first's.
- [ ] Integration: reopening a todo whose untouched successor was rescheduled to the same day, and to an earlier day, takes the successor away; a touched one (rescheduled is touched by `isUntouchedNext`) stays and the reopened one stops repeating; an older ticked todo (A, B done, C open) still finds B, not C.
- [ ] Device tests: `reopenTodo` finds the same successor in the same cases.
- [ ] Every existing todo test passes unchanged.

**Blocked by:** nothing. **Blocks:** slice 5.

## Slice 5: A stale tick never revives a stopped chain

Stack: no · Reads: docs/domain/todos.md, docs/domain/sync.md · Tests: unit, integration

Covers B-387. US 8.

**What to build.** As the PRD's _Repeating todos_: a new metadata constant in the todo rules for a tick's next occurrence. The device's `completeTodo` writes its twin with it (`_metadata`, as `reopenTodo`'s Undo delete does). The registry's todo PUT hook passes the flag to `upsertOccurrence`: flagged, it never creates (it's satisfied by an existing row, or by nothing); unflagged (a skip's), today's rule. With slice 1, the tick and its twin are one write: check that a viewer's tick of their own repeating todo still lands whole.

**Acceptance criteria**

- [ ] Integration (API package, a new file): A ticks a repeating todo online; B deletes its successor ("stop repeating"); C's stale offline tick of the original and its flagged twin upload as one write: the chain stays stopped (no open row), and the write is `applied`.
- [ ] Integration: a skip's unflagged occurrence, with no open row in the chain, still creates it; a flagged twin whose row the server's tick made is `applied` and changes nothing; a viewer's own tick with its twin lands whole.
- [ ] Device test: `completeTodo` writes the twin with the flag; `skipTodo` without it.

**Blocked by:** slice 1 (the registry, the write), slice 4 (`todoService`, the device's todo module). **Blocks:** nothing.

## Slice 6: Sign-ins and tabs don't undo each other

Stack: no · Reads: docs/domain/auth.md, docs/domain/sync.md · Tests: unit

Covers B-730, B-296. US 9, 10.

**What to build.** As the PRD's _Sessions and tabs_. Each confirmed session check records the session's id beside its confirmation; an offline sign-out writes it into the pending marker. `finishPendingSignOut` asks whose session the cookie holds: the same id is signed out, a different one keeps the session and drops the marker, none drops the marker, offline stays pending; a marker with no id behaves as today. The sign-in page's loader and action keep using it. In `openSync`, another user's session closes the tab's handle without clearing (in-memory caches forgotten as `closeSync` does) and opens for the new user, leaving the wipe decision to `open`'s owner rule.

**Acceptance criteria**

- [ ] Unit or device tests (stubbed auth client, prior art `session.test.ts`): a pending marker for session S with the cookie holding S signs out and returns signed out; holding T (a magic-link or invite sign-in) keeps T, drops the marker and returns T's user; no session drops the marker; offline stays pending; a marker with no id signs out as today.
- [ ] Device test (prior art `index.test.ts`): `openSync` for user Y while the tab holds X's database doesn't clear when the device's owner is already Y, and clears through the owner rule when it is still X.

**Blocked by:** nothing. **Blocks:** nothing.
