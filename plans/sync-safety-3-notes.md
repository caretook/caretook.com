# Notes for sync-safety-3: a device write lands whole (B-294)

Cut from `sync-safety-2` by its planner on 2026-11-25, on the user's word (ask a237: split it). These are notes for `sync-safety-3`'s planner. They aren't a PRD: check every claim against the code.

## What was wrong with the first design

Two skeptics sent it back (s43, s44):

- **The services don't join a caller's transaction.** `withTransaction` (data package, `db/client.ts`) reuses only an explicit `opts.tx`, and nothing like AsyncLocalStorage carries it. The 12 services the upload registry calls make about 62 `withTransaction(fn)` calls, none with a `tx`, so each opens its own top-level transaction. Today's registry PUT `inTx` doesn't really hold its follow-ups either. **Threading the context's transaction through those services comes first,** as its own slice with nothing beside it in `packages/data/src/services/`, and with a test that a service write rolls back with an outer transaction.
- **The rest is too big for one slice.** Split it into the server half (grouping, the transaction, `sync:writeRefused` in `packages/data/src/errors/sync.ts`, the request caps), the device half (the uploader reads whole PowerSync transactions, not `getCrudBatch(100)`; the try counter; a write id column in the local-only `unsaved_change`; an audit of the device's ~30 multi-row writes), and the not-saved page (one line per write).
- **The write cap:** the largest device write is a daily series split (`series.sync.ts`): per visit over the window, an entry, a note document and a row per provider, plus deletes and the `rescheduledTo`/todo `eventId` updates. That's an estimated 450–550 ops. Count it and pin it in a test.
- **Locks:** `sync-safety-2` adds a `for update` lock on the todo row inside `todoService`. Once the services join an outer upload transaction, check how it nests: no deadlock against another connection holding rows of the same write.

## The design both skeptics accepted otherwise

- Each op carries its device transaction's id (optional; with no id, an op is its own write, as today). Requests hold whole writes: up to 100 ops, or one write alone up to the cap.
- The server applies consecutive ops of one write in one transaction. At the first refusal it rolls back: the refused op keeps its code and issues, and the write's others answer `sync:writeRefused` naming it. A throw or non-4xx rolls back and answers `failed` at the write's first op, then stops (the probe and 5xx rule unchanged). Results stay one per op. Compaction only for committed note updates.
- The device never splits a write. A failed write counts one try against its first entry and is set aside whole. "Changes not saved" shows a write as one line (the first label, the refusing op's reason). "Try again" resends it as one write.
- Out of scope then too: atomic server-made writes (connectors, quick entry: already one service transaction), field-level merge.
- With it: `removePass` resends every medication's schedule from the device's copy (`medicationPasses.sync.ts`, B-294's related note). Decide whether it belongs here.
