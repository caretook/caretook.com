# Plan: Sync safety 3: a device write lands whole

> Source PRD: [`plans/sync-safety-3-prd.md`](sync-safety-3-prd.md). User-story numbers (US) refer to it. Backlog item B-294. Topic `sync-safety-3`.

## Status

| Slice | Wave | State          | Merge into `prd/sync-safety-3` (slice commits) |
| ----- | ---- | -------------- | ---------------------------------------------- |
| 1     | 1    | landed (opus)  | 98f9114db (e46c7c7c7, 96dc47533)               |
| 2     | 2    | landed (opus)  | c3121383a (a0b109cfe)                          |
| 3     | 3    | landed (opus)  | b7155cd89 (54aed68c0)                          |
| 4     | 1    | landed (opus)  | 95b947f22 (0aa0e004d, fe68fed3e)               |
| 5     | 4    | started (opus) |                                                |

**Landing mode: run everything through** (dispatcher start, 2026-11-28): start every ready slice, land each green wave, ask only real questions.

- **Waves 1-3 landed** in dev 2026-11-28: wave 1 (slices 1, 4) PR #322, dev 26eb8f0; wave 2 (slice 2) PR #325, dev cefab09; wave 3 (slice 3, merged b7155cd89) PR #326, dev 4b2a7f5, tier components, run 46150457904 green, Codex clean on 76c31fe, browser 3/3. To-test files `2026-11-28-0803`, `-0825`, `-0901-sync-safety-3.md`. Sync and data-layer docs folded per wave. Codex's 2 P2s on #326 are slice 5's work, noted on B-294 and replied.
- Slice 3's uploader: `nextBatch` reads one past the batch; a first write over 100 is read alone up to `SYNC_WRITE_LIMIT`; over it, 100 go without `write`. A 400 resends write by write (`uploadWriteByWrite`).
- **Wave 4 started 2026-11-28:** sync skipped (dev shares no file), B-294 claimed, worktree `sync-safety-3-5` made, one opus agent spawned with the brief below.
- **Slice 5 merged** 49e1d41ca; B-294 done. It added a local-only `write_seq` column on `unsaved_change` (a write's op order; `uploader.ts` `recordUnsaved` sets it, one `recorded_at` per recording) — fold into sync _Device_ at landing. Wave run 46153418825 green (components); slice worktree removed; `risa sync` merged dev (no migration or seed); browser 3/3 (phase2, roundtrip, live-notes); sync doc folded (_Device_: `write_seq`, one line per write). Recheck on the synced tip d33f099d: run 46154094746 green. PR #328 open; Codex review pending.
- **Wave 4 brief:** `risa backlog ingest` and `list`, `risa sync`, then `risa slice sync-safety-3 5` and one opus agent on `risa prompt slice sync-safety-3 5`. Tell it: group by `line_key` (single-op writes carry `write_id` but keep their row's key; multi-op writes share `write:<id>`); `unsavedLines` takes code/issues from the record not answering `sync:writeRefused` (never the newest: `recorded_at` within a write is arbitrary); `retryUnsaved` sends a line's records as one write with their stored `write_id` (else a 101-1000-op set-aside write is over the 100-op cap and unretryable). Both are Codex findings on PR #326. When slice 5 merges, `risa backlog done B-294`. At landing, fold sync _Device_ ("Changes not saved": one line per write). Last wave: `risa rm sync-safety-3` at the end.

## Durable decisions

- **A write is a device transaction:** the op's `write` is PowerSync's transaction id; consecutive ops with the same one are applied together or not at all. An op with no `write` is its own write.
- **A nested `withTransaction` is a savepoint;** `afterCommit` waits for the outermost commit.
- **Results stay one per op, in order.** A refused write's other ops answer `sync:writeRefused` with `refusedId`.
- **The write limit** is one client-safe constant in a new `domain/sync/` part of the data package (slice 4 adds it), shared by the server and the device.
- No migration, no sync-config change, no new dependency, no seed change. The device schema gains one column in the local-only `unsaved_change`. Edits to shared registries are additive ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)).

## How to run this plan

- **Wave 1: slices 1 and 4** together. They share no file.
  - Slice 1 owns `withTransaction`/`afterCommit` and the data package's services that the upload reaches (only where they don't join `ctx.tx`).
  - Slice 4 owns the device's `lib/<area>/*.sync.ts` writes and the write-limit constant.
- **Wave 2: slice 2** (the server). Owns `packages/api/src/sync.ts`, the registry's PUT transaction, the sync error part and `testing.ts`'s op helpers.
- **Wave 3: slice 3** (the uploader). Owns `lib/sync/uploader.ts` and the device schema's `unsaved_change`.
- **Wave 4: slice 5** (the page). Owns `lib/app-shell/unsavedChanges*` and the not-saved route.
- **Gates:** `pnpm prd check` per slice as [loop](../docs/agents/loop.md) says. Browser checks run once per wave on the integration branch, the ones `check-areas` maps for the changed files (expect `roundtrip`). This topic adds no browser step.
- **Start conditions:** `onboarding-2` (running) holds `apps/web/test/device.tsx`: device tests here use it but never edit it. `code-health-2` (held) holds `packages/data/src/services/`: slice 1 waits if it is running then. `pnpm prd sync` before each wave.

**Backlog:** claim B-294 when slice 1 starts; `done` it when slice 5 merges. The earlier notes (`plans/sync-safety-3-notes.md`) were folded into the PRD and deleted.

Fold into the area docs at landing:

- **Slice 1:** [data-layer](../docs/domain/data-layer.md)'s `withTransaction` line (the savepoint, `afterCommit` at the outermost commit).
- **Slices 2, 3, 5:** [sync](../docs/domain/sync.md) _Upload_ (writes, `sync:writeRefused`, the limit, the retry on a deadlock) and _Device_ (`uploader.ts`: whole writes; "Changes not saved": one line per write).
- **Slice 4:** [sync](../docs/domain/sync.md) _Device_: one save, one local transaction (the audit's list).

## Slice 1: A nested transaction rolls back only its own writes

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/sync.md · Tests: integration · Check: packages/data/src/db/nestedTransaction.int.test.ts

Covers B-294 (the base). US 2, 5.

**What to build.** As the PRD's _Nested transactions_: `withTransaction` (`packages/data/src/db/client.ts`) given a `tx` runs `fn` in a savepoint (drizzle's nested `tx.transaction`), rolling back to it on an AppError result or a throw and returning the error; `afterCommit` inside it queues on the outermost transaction's hooks (moved there when the savepoint releases, dropped when it rolls back). Then check every service the upload registry calls for writes or reads that don't go through `ctx.tx`: `symptomTypeService`'s `getDb()` calls on the upload path, and any `withTransaction` there without the context. Make them join; leave non-upload services alone. Say in the hand-off which ones you changed.

**Acceptance criteria**

- [ ] Integration (new `packages/data/src/db/nestedTransaction.int.test.ts`): a service write (one upload service, as `SYSTEM_USER` or a `createWorld` member) inside an outer `withTransaction` that then returns an AppError leaves no row.
- [ ] Integration: a nested call returning an AppError rolls back only its writes; the outer commits the rest.
- [ ] Integration: a nested call whose query throws (a unique violation) leaves the outer transaction usable; its next query and commit succeed.
- [ ] Integration: `afterCommit` inside a nested call runs once, after the outer commit; never after the nested or the outer rollback.
- [ ] The existing data and api integration suites pass unchanged (`pnpm prd check`).

**Blocked by:** nothing. **Blocks:** 2.

## Slice 2: The server applies a write whole

Stack: no · Reads: docs/domain/sync.md, docs/domain/api.md, docs/domain/data-layer.md · Tests: integration · Blocked by: 1, 4 · Check: packages/api/src/syncWrites.int.test.ts

Covers B-294. US 1, 2, 5, 6.

**What to build.** As the PRD's _The server: one write, one transaction_. In `packages/api/src/sync.ts`: the op's optional `write`; the request schema (100 ops, or one write up to the limit from slice 4's constant); `upload` groups consecutive ops into writes and runs each in one `withTransaction`, passing `{ ...context, tx }` to `applyOp`; the refusal, failure and retry rules (a deadlock or serialization failure is read from the pg code, `40P01`/`40001`, in the AppError's cause chain); `compactTouched` only for committed writes. `sync:writeRefused` (409) in `packages/data/src/errors/sync.ts`; the rejected result gains an optional `refusedId`. `softDelete`'s PUT transaction in `packages/api/src/syncRegistry.ts` passes the context so it joins. `packages/api/src/testing.ts`'s `putOp`/`patchOp`/`deleteOp` take an optional `write`.

**Acceptance criteria**

- [ ] Integration (new `packages/api/src/syncWrites.int.test.ts`): a three-op write (a series PUT, an entry PUT, a refused PATCH of another group's row) saves nothing; results: two `sync:writeRefused` with the refused op's id as `refusedId`, and the refused op's own code. The next write in the same request applies.
- [ ] Integration: a write whose second op throws answers `failed` at the write's first op, saves nothing, and has no results after it.
- [ ] Integration: ops with no `write` keep today's results (one refused, the next applied).
- [ ] Integration: one write of 101 ops is accepted; 101 ops over two writes is a 400. The hand-off names how long a 500-op write took locally (savepoint cost).
- [ ] Integration: a write that hits a deadlock (forced with a second connection holding a lock both need) retries once and applies.
- [ ] Integration: a note update in a refused write isn't compacted.

**Blocked by:** 1, 4. **Blocks:** 3.

## Slice 3: The device uploads whole writes

Stack: no · Reads: docs/domain/sync.md, docs/domain/components.md · Tests: component · Blocked by: 2 · Check: apps/web/app/lib/sync/uploader.browser.test.tsx

Covers B-294. US 1, 2, 5.

**What to build.** As the PRD's _The device: whole writes up and back_, in `apps/web/app/lib/sync/uploader.ts` (`uploadQueued`, `uploadOneByOne`, `recordUnsaved`, `toOp`): batches end at a whole write (read one entry past the batch to tell a cut write); each op carries `write` from `CrudEntry.transactionId`; a write over the limit goes without `write`. A refused write's ops are all recorded; a failed write counts one try on its first entry and is set aside whole; a whole-request 400 resends write by write. `unsaved_change` gains `write_id` (`apps/web/app/lib/sync/schema.ts`), and a multi-op write's records share a `line_key` of the write. Uses `apps/web/test/device.tsx` without editing it.

**Acceptance criteria**

- [ ] Component (`apps/web/app/lib/sync/uploader.browser.test.tsx`): a queue of a 60-op write then a 60-op write sends two requests, each whole, every op with its write.
- [ ] Component: a refused write records every op in `unsaved_change` with its write id and acknowledges the batch.
- [ ] Component: a failed write acknowledges what came before it, counts one try, and after the set-aside rule records and acknowledges the whole write.
- [ ] Component: a 400 for the whole request resends write by write; a write refused alone is recorded whole.
- [ ] Component: a write over the limit is sent with no write id.

**Blocked by:** 2. **Blocks:** 5.

## Slice 4: One save, one local transaction

Stack: no · Reads: docs/domain/sync.md, docs/domain/appointments.md · Tests: component · Check: apps/web/app/lib/sync/deviceWrites.browser.test.tsx

Covers B-294 (the device's half of what a write is). US 1.

**What to build.** As the PRD's _The write audit_: go through the device's `lib/<area>/*.sync.ts` saves that write more than one row and list each, with whether it already writes in one `db.drizzle.transaction`. Wrap the ones that don't. Add the write limit (1000) as a client-safe constant in a new `domain/sync/` part (`packages/data/src/domain/sync/` (new), exported from the domain index and `DOMAIN_EXPORTS`). The list goes in the hand-off and, at landing, the sync doc. If more than about six files need wrapping, wrap the riskiest (those that touch two tables) and file the rest as one fixes-bug item.

**Acceptance criteria**

- [ ] Component (new `apps/web/app/lib/sync/deviceWrites.browser.test.tsx`): `applySeriesEdit` (this and later, a daily series over the full window with providers and notes) queues one transaction, and its op count is at or under the write limit (the count pinned in the test).
- [ ] Component: each save the audit wrapped queues its rows in one transaction.

**Blocked by:** nothing. **Blocks:** 2.

## Slice 5: "Changes not saved" shows a write as one line

Stack: no · Reads: docs/domain/sync.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component · Blocked by: 3 · Check: apps/web/app/routes/app/settings/not-saved/notSaved.browser.test.tsx

Covers B-294. US 3, 4.

**What to build.** As the PRD's _Changes not saved_: `unsavedLines` (`apps/web/app/lib/app-shell/unsavedChanges.ts`) groups a write's records into one line (the first op's label and kind; the reason of the op not answering `sync:writeRefused`); `retryUnsaved` (`apps/web/app/lib/app-shell/unsavedChanges.sync.ts`) sends a line's set-aside records as one write with their write id. Records without a write id group as now. The page (`apps/web/app/routes/app/settings/not-saved/route.tsx`) changes only if the line shape needs it.

**Acceptance criteria**

- [ ] Component (`notSaved.browser.test.tsx`): a refused three-op write shows one line, with the refusing op's reason.
- [ ] Component: Try again on a set-aside write sends one request with every op and the write id, and clears the line when all apply.
- [ ] Component: records without a write id show as today.

**Blocked by:** 3. **Blocks:** nothing.
