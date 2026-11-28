# Plan: Sync safety 3: a device write lands whole

> Source PRD: [`plans/sync-safety-3-prd.md`](sync-safety-3-prd.md). User-story numbers (US) refer to it. Backlog item B-294. Topic `sync-safety-3`.

## Status

| Slice | Wave | State         | Merge into `prd/sync-safety-3` (slice commits) |
| ----- | ---- | ------------- | ---------------------------------------------- |
| 1     | 1    | merged (opus) | 98f9114db (e46c7c7c7, 96dc47533)               |
| 2     | 2    | planned       |                                                |
| 3     | 3    | planned       |                                                |
| 4     | 1    | merged (opus) | 95b947f22 (0aa0e004d, fe68fed3e)               |
| 5     | 4    | planned       |                                                |

**Landing mode: run everything through** (dispatcher start, 2026-11-28): start every ready slice, land each green wave, ask only real questions.

- 2026-11-28: wave 1 started. B-294 claimed. Worktrees `sync-safety-3-1` and `sync-safety-3-4` made from prd at the plan's anchor fix; one opus agent each. Start conditions clear (onboarding-2 and code-health-2 not running).

- Slice 1 handed off (quick check green on 96dc47533), merged 98f9114db. No upload-path service needed changing; only the registry's softDelete PUT now passes `ctx`. For slice 2: PATCH/DELETE paths in the registry (softDelete remove/update, timeline_entry and todo PATCH) run without `tx` today; slice 2's whole-PUT `tx` makes them join. A nested throw now returns `db:transaction` instead of propagating. B-294 stays open until slice 5.

- Slice 4 handed off (quick check green on fe68fed3e), merged 95b947f22. `SYNC_WRITE_LIMIT = 1000` in `@caretook/data/domain`. Audit: every multi-row `*.sync.ts` save already uses one `db.drizzle.transaction`; nothing wrapped. Largest write measured: the series split, 437 ops (pinned). Screens chaining several single-row saves were out of scope. Audit list for the sync doc at landing is in the slice's hand-off (multi-row saves: appointments, series, visitPrep, quickEntry, medicationPasses, passLogs, medications, allergies, liveEntry, providers, tags, carePeriods, todos, conditions, medicationConditions, timeline, symptomTypes).
- Wave 1 gate: `risa ci run components` on 95b947f22 (requested).

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
