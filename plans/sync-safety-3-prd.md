# PRD: Sync safety 3: a device write lands whole

> Topic `sync-safety-3`. Backlog item B-294. After `sync-safety-2`. Plan: [`plans/sync-safety-3-plan.md`](sync-safety-3-plan.md). Started from the earlier planner's notes (`plans/sync-safety-3-notes.md`, deleted with this plan: what still holds is here).

## Decisions

| Decision                                                                                                                                                                                                                                                                                                 | Why                                                                                                                                                                                            | Source  | Cost to change later                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------- |
| A write is the device's local transaction (PowerSync's transaction id); every op of it carries that id, and the server applies consecutive ops of one write in one Postgres transaction                                                                                                                  | the item's own fix ("upload by device transaction and apply it atomically"); the device already makes its multi-row saves in one local transaction                                             | assumed | high: the wire format and both halves |
| At the first refusal the whole write rolls back: the refused op keeps its code and issues, every other op of the write answers `sync:writeRefused` naming it                                                                                                                                             | a half-saved write is the bug; the next sync restores the server's copy of every row, as a refusal does today                                                                                  | assumed | medium                                |
| A throw or non-4xx error rolls the write back and answers `failed` at the write's first op, then stops; the probe and 5xx rule stay as they are                                                                                                                                                          | one write is one unit for retrying, as an op is today                                                                                                                                          | assumed | medium                                |
| A nested `withTransaction` (one given a `tx`) runs in a savepoint: its own AppError or throw rolls back only its writes, and `afterCommit` work waits for the outermost commit                                                                                                                           | today a joined call never rolls back its own writes, and a caught SQL error would poison the shared transaction; savepoints keep each service call as it behaves today inside the bigger write | assumed | medium: one function, every service   |
| The earlier notes said the services never join a caller's transaction; they do (nearly every service call passes `ctx`, so `ctx.tx` is reused). The first slice is the savepoint rule plus the few calls that still open their own (the registry's PUT, `getDb()` reads in a service the upload reaches) | checked against the code, 2026-11-28                                                                                                                                                           | assumed | low                                   |
| One request holds whole writes: up to 100 ops, or one write alone up to a write limit of 1000 ops, pinned against the largest device write (a daily series split) in a test                                                                                                                              | the notes' estimate for that split is 450–550 ops; a limit with room, checked                                                                                                                  | assumed | low: one constant                     |
| A device write over the limit is sent as today, op by op with no write id                                                                                                                                                                                                                                | never a stuck queue; such a write doesn't exist today, and the pin test says when one would                                                                                                    | assumed | low                                   |
| A failed write counts one try against its first op and is set aside whole after the same 5 tries over ≥ 2 minutes                                                                                                                                                                                        | the existing rule, applied to the write                                                                                                                                                        | assumed | low                                   |
| "Changes not saved" shows a write as one line: its first op's label and the refusing op's reason; Try again resends it as one write                                                                                                                                                                      | one save, one line; the page already groups by line                                                                                                                                            | assumed | low: one slice                        |
| A deadlock or serialization failure (Postgres 40P01, 40001) retries the write once on the server before it answers `failed`                                                                                                                                                                              | longer transactions now hold the todo row lock (`sync-safety-2`) for the whole write; two devices' writes over the same rows can deadlock, and that is nobody's fault                          | assumed | low                                   |
| A save the device makes as several local transactions becomes one (an audit of the device's multi-row writes), so it uploads as one write                                                                                                                                                                | without it, the server can't know the rows belong together                                                                                                                                     | assumed | low                                   |
| `removePass` resending every medication's schedule from the device's copy stays out; filed as B-1006 (fixes-bug)                                                                                                                                                                                         | it's a stale overwrite (last write wins), not a half-applied write: the server already rewrites the schedules itself                                                                           | assumed | low                                   |
| Old `unsaved_change` rows (no write id) each stay their own line                                                                                                                                                                                                                                         | no change to what existing records mean                                                                                                                                                        | assumed | none                                  |

The skeptic (s87, 2026-11-28) said go. Taken: the limit goes in a new `domain/sync/` part; the deadlock is read from the pg code in the error's cause; the savepoint cost and request size are noted under _Notes_, and slice 2 times a 500-op write. Declined: nothing.

## Problem

A caretaker saves something that changes several rows at once: a medication stopped with its timeline change, a repeating event split at "this and later", a condition with its managers. Offline, the device saves all of it locally in one go. When it uploads, the server applies each row separately. If one row is refused (a permission changed meanwhile, a row someone else deleted, a value the server won't take), the others are still saved. The record ends up half changed on every device: an event series cut off with no new series after it, a visit moved with no new visit, a schedule naming a time that no longer exists. Nothing tells the caretaker which half survived.

## Solution

A save made on a device lands whole or not at all. The device sends each save as one unit, and the server applies a save's changes together, in one transaction. If any one is refused, none of them are saved. Every device goes back to the last good version, and "Changes not saved" in Settings shows the save as one line with the reason. If the server can't process the save at all (an error, not a refusal), the device retries the whole save, and after a few tries it sets the save aside whole, where Try again resends it as one unit.

## User stories

1. As a caretaker splitting a repeating event offline, I want the split to land whole when I'm back online, so that the series is never cut off without its new half.
2. As a caretaker whose save is refused, I want none of it applied, so that every device shows the record as it was, not a mix.
3. As a caretaker, I want "Changes not saved" to show a refused save as one line saying why, so that I know what to redo.
4. As a caretaker, I want Try again on a set-aside save to send it whole, so that retrying can't half-apply it either.
5. As a caretaker with a save the server couldn't process, I want it retried and set aside as one unit, so that one bad row never leaves the rest of its save applied.
6. As a member writing at the same time as another member, I want our overlapping saves to both go through, one after the other, so that a clash between them isn't reported as my save failing.

## Implementation decisions

### Nested transactions

- `withTransaction(fn, { tx })` keeps its signature. Given a `tx`, it runs `fn` in a savepoint of that transaction (drizzle's nested `transaction`): an AppError result or a throw rolls back to the savepoint and returns the error, and the outer transaction stays usable. With no `tx` it is a top-level transaction, as now.
- `afterCommit(tx, fn)` called inside a savepoint queues `fn` on the outermost transaction: it runs after that commits and never when the savepoint or the outer transaction rolls back.
- Every service call the upload registry makes joins `ctx.tx`. The registry's PUT transaction passes the context, and a service on the upload path that reads through `getDb()` reads through the context's transaction instead. Background work that must see committed rows (live-note compaction, Google pushes) stays after the commit.

### The server: one write, one transaction

- An upload op gains an optional `write` (the device's transaction id, a non-negative integer). Consecutive ops with the same `write` are one write. An op with no `write` is a write of its own, as today.
- The request schema allows up to 100 ops, or more (up to the write limit) only when every op shares one `write`. The limit is a client-safe constant in a new `sync` part of the data package's domain, shared by the server and the device.
- Each write runs in one `withTransaction`, and the context passed to every handler carries its `tx`. Results stay one per op, in order.
  - All applied: commit; each op `applied`.
  - The first refusal (a 4xx): roll back. The refused op answers `rejected` with its code and issues; every other op of the write answers `rejected` with `sync:writeRefused` (409, new in the sync error part) and `refusedId`, the refused op's id. The loop goes on with the next write.
  - A throw or non-4xx error: roll back, probe the database (5xx when the probe fails, as now), answer `failed` at the write's first op and stop. A deadlock or serialization failure first retries the write once.
- Live-note compaction runs only for updates whose write committed.
- A NUL in any op refuses that op before the transaction opens, and so its whole write.

### The device: whole writes up and back

- The uploader reads the queue in whole writes: a batch never ends partway through a local transaction, and holds either up to 100 ops or one write up to the limit. Each op carries its entry's transaction id as `write`. A write over the limit is sent with no `write`, op by op, as now.
- Refusals: every op of a refused write is recorded in `unsaved_change` with its write id (a new column in that local-only table). The whole batch is acknowledged, as now.
- A failed write: the ops before its first op are acknowledged; the try counts against the write's first entry; after the existing rule it is set aside whole (every op recorded, then acknowledged).
- A whole-request 400 resends the batch write by write rather than op by op. A write refused alone with a 400 is recorded whole as refused.
- **The write audit:** each device save that writes several rows does so in one local transaction. The audit lists them in the sync area doc and wraps any that write in separate steps.

### Changes not saved

- `unsavedLines` groups a write's records into one line: the first op's label and kind, and the reason of the op the server refused (the one not answering `sync:writeRefused`). Records with no write id group as now.
- Try again sends a line's set-aside records as one write, with their write id, and updates every record from the results, as now.

## Testing decisions

- **Nested transactions** (data package, integration, new file): a service write inside an outer transaction rolls back with it; a nested call returning an AppError rolls back only its own writes and the outer one commits the rest; a caught SQL error in a nested call leaves the outer transaction usable; `afterCommit` inside a nested call runs once after the outer commit, never after a rollback. Prior art: `client.int.test.ts`.
- **The server's writes** (api package, integration, new file, through `testing.ts`'s `upload`/`putOp`/`patchOp`): a three-op write with a refused middle op saves nothing and answers the refused code plus two `sync:writeRefused`; a write with a throwing op answers `failed` at its first op and saves nothing; ops with no `write` keep today's per-op results; a write over 100 ops alone is accepted and two writes over 100 together are a 400; a forced deadlock retries once. Prior art: `syncFailures.int.test.ts`, `syncReplay.int.test.ts`.
- **The uploader** (device browser test with a stubbed server, the existing file): a batch ends at a whole write; every op carries its write; a refused write is recorded whole; a failed write counts one try and is set aside whole; a 400 resends write by write. Prior art: `uploader.browser.test.tsx`.
- **The audit** (device browser test, new file): the series split over the full window queues one transaction, with its op count at or under the write limit; each save the audit wrapped queues one transaction.
- **Changes not saved** (component test, the existing file): a refused write shows one line with the refusing op's reason; Try again sends one write.
- No new browser-check step: the per-wave checks for `lib/sync/` (`roundtrip`) cover the path end to end.

## Out of scope

- `removePass` resending every medication's schedule from the device's copy (a stale overwrite): filed as B-1006 (fixes-bug).
- Atomic server-made writes (connectors, quick entry): each is already one service transaction.
- Field-level merge, or a write that partly applies by choice.
- Background upload (B-805: no).

## Notes

- Longer transactions hold locks longer: the todo row lock (`sync-safety-2`) and the member rows a role check reads are held until the write commits. A 500-op write runs in one function call; the series split is the only write near that size.
- Savepoints add a SAVEPOINT and RELEASE round trip to every nested service call, app-wide, not only on uploads; slice 2's hand-off times a 500-op write. If it's slow, the follow-up is fewer nested calls on the upload path, not dropping the savepoints.
- The write limit pins the op count, not the request's bytes; the series split's request is well under the platform's body limit.
- PowerSync's `CrudEntry.transactionId` is set for every op written in one `writeTransaction` (the drizzle driver's `transaction`), so the device needs no write id of its own.
