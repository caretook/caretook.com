# Plan: Sync safety: no change is lost without a word

> Source PRD: [`plans/sync-safety-prd.md`](sync-safety-prd.md). User-story numbers (US) refer to it. Backlog items B-285 to B-293. Topic `sync-safety`. Follow-on: `sync-safety-2` (B-294, B-295, B-296, B-382, B-383, B-384, B-387), not planned yet.

## Status

| Slice | Wave | State         | Merge into `prd/sync-safety` (slice commits)      |
| ----- | ---- | ------------- | ------------------------------------------------- |
| 1     | 1    | landed (opus) | 5a140ed9 (8cc4d866, 2e34d947)                     |
| 2     | 1    | landed (opus) | 385a1ba8 (a67973a0)                               |
| 3     | 2    | merged (opus) | 8f433310 (62ba5822, 22c41a57, bbc3c85c)           |
| 4     | 2    | merged (opus) | 8e5032d4 (a6c85065)                               |
| 5     | 2    | merged (opus) | b005e91a (4656d227, 466903be, 6bb52d5a, 5595ba83) |
| 6     | 1    | landed (opus) | f4c6ad13 (a822dcba, 625bf09a)                     |

**Landing mode:** run everything through (started run-through, 2026-11-22): start every ready slice, land each green wave, clean up; ask only real questions via `pnpm prd ask`.

**Wave 2 under way** (restarted 2026-11-24, run-through): worktrees `sync-safety-3`, `-4`, `-5` made from prd/sync-safety at 23666d2e (dev's tip), one opus agent each; items claimed. Slice 3 was told to wait for word that slice 5 is merged, then merge prd/sync-safety and recheck before its hand-off. Backlog ingest at the boundary: nothing new for this topic. Slice 4 merged; its hand-off gap (magic-link or invite sign-in with a pending sign-out) filed as B-730 for sync-safety-2. Slice 5 merged; its agent was told to merge prd and recheck (slice 5 changed `upsert`'s return to `Upserted<T>`). Fold for slice 5: sync (a PUT is create-if-absent, follow-ups only with the create in one transaction), data-layer (`Upserted`), live-notes (a taken document id is a 403), appointments (`seriesVisitFallbackId`; a member's own dose replayed no longer updates). Slice 3 merged after its pre-hand-off merge of prd. Fold for slice 3: sync (`failed`, the probe, the tries in `caretook:upload-tries`, setting aside, Try again, NUL refused as `sync:invalid`), api (`sync.upload`'s results). **Wave 2 green:** `components` run 45378922670 on 4a3a9550. Slice worktrees removed. `pnpm prd sync` skipped (dev shares no file; B-729, a dev brake in syncMedications, was a test-clock fix already in dev). Served at :6273; `browser --changed --base dev` running (roundtrip, live-notes, app-shell, sign-in, first-sync, session-end, invites). PR #143 open. Browser checks 7/7 passed. Codex out of credits (review exit 4): landing with `--no-review`, tier `components`. Wave 2 docs folded into sync, auth, api, data-layer, live-notes, appointments (trimmed to budget). After landing: `pnpm prd rm sync-safety`, then `pnpm prd end` from the main checkout (the last wave). Not tested: a follow-up failing and rolling back its create; the device still writes series visits under `seriesVisitId` (a taken id lands in not saved, the server tops up under the fallback). Fold for slice 4: sync _Session_ (kept copy, 30-day expiry, `endSession`, `closeSync({ keep })`, `countWaiting`, the test seam), auth (pending sign-out, sign-in loader and action guard); `signout-wipe` was already folded into `session-end`, so its steps went there (adds about 2 s to the lean set).

**Wave 2: slices 3, 4 and 5.** Claimed B-286 (slice 3), B-290 (slice 4), B-288 and B-289 (slice 5). Merge order: 5 before 3 (slice 3 syncs before its handoff). Notes from wave 1's hand-offs:

- **Slice 5:** the PUT branch is the `op.op === "PUT"` block of `softDelete` in `packages/api/src/syncRegistry.ts`; its follow-ups (`deleted_at` → `remove`, then `afterPut`, todo's tick) are where "only when created, in one transaction" goes; todo's twin is the spec's `put` hook. Roundtrip's `unsaved_change` held only the two forced refusals (device B's timeline PATCH, device C's todo title PATCH): no twins to cover.
- **Slice 3:** the loop is the one `applyOp` line in `packages/api/src/sync.ts`; new errors go in `packages/data/src/errors/sync.ts`. Set-aside records go in `unsaved_change` with `outcome = 'set_aside'`; the page renders every line through `unsavedSentence` and ignores `outcome` so far. `useSyncState().uploadFailed` exists for "Can't sync, retrying".
- **Slice 4:** `useSyncState().waiting` is the count waiting to upload.
- Wave 1 facts: the timeline remove's viewer 404 wasn't reproduced (it already answered 403); a PATCH naming any unknown column is now `sync:unknownColumn`; slice 6 also fixed `updateEntry` and `updateDose`, and device fixtures seed JSON via `pgJson()` (`apps/web/test/fixtures.ts`). Docs folded at the wave-1 landing: sync, app-shell, layout (medications and providers needed nothing beyond sync's "only changed columns").
- Wave 1's browser checks ran as `--changed` (the classifier refused `--suite`; memory: ask before `--suite`).

**Start conditions:** no other topic has an unlanded change to the upload procedure's file (`packages/api/src/sync.ts`) when slice 1 starts: this plan rewrites it wholesale, where the [rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds) otherwise allow only additive edits. The service layer and `lib/auth/` are `fixes-bug`'s hot files, the browser checks `test-health`'s, and `powersync/sync-config.yaml` is `simple-mode`'s (this plan only reads it): `pnpm prd sync` before each wave, and whichever lands second syncs first.

**Landing:** no migration, no sync-config change, no new dependency, no seed change. The device gains one local-only table (slice 2), so nothing needs `pnpm datastore:reset`.

**The lean ceiling:** the lean browser set sums to 256 s against a `lean-ceiling` of 257, and slices 2, 4 and 5 add steps to `roundtrip`, `signout-wipe` and `session-end`. Each keeps its steps as short as it can (reuse a signed-in device and an existing offline window; no new sign-in where one exists). Only the user raises the ceiling: when `checks.test.mjs` fails on it, the orchestrator asks (the seconds added, and by which step) and doesn't trim another topic's check to make room.

**Backlog:** claim each slice's items when it starts; `done` them when it merges. Slice 1: B-291, B-292, B-293. Slice 2: B-285. Slice 3: B-286. Slice 4: B-290. Slice 5: B-288, B-289. Slice 6: B-287.

Fold into the area docs at landing:

- **Slice 1:** [sync](../docs/domain/sync.md): the _Upload_ bullets (the registry, one answer per situation, the agreement test and its ignore list); [layout](../docs/layout.md) for the new module.
- **Slice 2:** [sync](../docs/domain/sync.md): the local-only table, the uploader's module and what it records, `useSyncState`'s new fields; [app-shell](../docs/domain/app-shell.md): the settings page and the indicator.
- **Slice 3:** [sync](../docs/domain/sync.md): `failed`, the probe, the tries, setting aside and "Try again"; [api](../docs/domain/api.md) if it lists `sync.upload`'s results.
- **Slice 4:** [sync](../docs/domain/sync.md) _Session_ and the device bullets (one user's data per device, sign-out, the kept copy and its expiry); [auth](../docs/domain/auth.md): the pending sign-out.
- **Slice 5:** [sync](../docs/domain/sync.md) (a PUT is create-if-absent, follow-ups with the create), [data-layer](../docs/domain/data-layer.md) (`upsert`), [live-notes](../docs/domain/live-notes.md), [appointments](../docs/domain/appointments.md) (the fallback visit id).
- **Slice 6:** [sync](../docs/domain/sync.md) (device writes send only what changed), [medications](../docs/domain/medications.md), [providers](../docs/domain/providers.md).

## Architectural decisions

- **Reproduce first.** The findings come from a reviewer's reading and weren't re-verified. Each slice starts with a failing test for its bug; if a bug can't be reproduced, say so in the handoff with the evidence and leave that part out (a `pnpm backlog note` on the item).
- **Write through the services; RBAC stays in SQL.** The upload procedure maps ops onto services and never touches models.
- **The upload's results are `applied`, `rejected`, `failed`.** `rejected` is a 4xx the device records and moves past. `failed` (slice 3) is this one change failing on the server: the server stops there and answers 200. Only an outage is a 5xx.
- **Two modules on the server:** the table registry with its generic soft-delete handler (slice 1 makes it; slice 5 changes its PUT branch), and the procedure's loop and results (slice 3's). The registry is a `Map`, and its column maps are exported and tested against the device schema and `sync-config.yaml`.
- **Two modules on the device:** the uploader in a module of its own, drivable with a stubbed server (slice 2 makes it; slice 3 extends it), and the device client's `open` and `clear` (slice 4's).
- **A PUT never changes an existing row**, and its follow-ups (a delete, a tick) happen only with the create, in one transaction (slice 5).
- **One local-only device table** holds what didn't save (refused or set aside). It is never synced or uploaded and is cleared with the local copy. It has no sync-matrix row and no stream; the agreement test and the sync matrix skip local-only tables by an explicit rule.
- **Nothing is deleted without a record or a question:** a refused or set-aside change is kept with its data; an explicit sign-out with changes waiting asks first.
- **No migration, no sync-config change, no dependency.** A slice that finds it needs one stops and asks its orchestrator.
- **Registries are composed from area parts** ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)): a new error goes in the sync area's errors part, the new route and URL in the settings area's parts, with their frozen-list tests.
- **Wording** (assumed; the user may change it): the page is "Changes not saved"; the indicator says "N not saved", "Offline · N waiting", "Can't sync, retrying · N waiting"; a set-aside change reads "The server couldn't save this" with "Try again"; the sign-out dialog says "N changes haven't reached the server. Sign out and lose them?" with "Stay signed in" and "Sign out anyway".

## How to run this plan

- **Wave 1: slices 1, 2 and 6** together. They share no file: slice 1 owns the API package's upload files (the procedure, the new registry module, the `sync*.int.test.ts` files) and the new agreement test; slice 2 owns the device client's upload half (moved to the new uploader module), the device schema's new table, the sync entry module's `useSyncState`, the sync indicator, the new settings page, the sync matrix's skip rule and `roundtrip`; slice 6 owns the medication and provider device modules, the shared "what changed" helper and their tests (and adds no browser step).
- **Wave 2: slices 3, 4 and 5**, after wave 1 lands. Slice 3 owns the procedure's loop and results, the uploader module and the page's set-aside rows. Slice 4 owns the session module, the session rules, the sign-out route, the user menu, the device client's `open` and `clear`, the sync entry module's `closeSync`, and the `signout-wipe` and `session-end` checks. Slice 5 owns the service layer, the registry's PUT branch, and `roundtrip`'s last step. Slices 3 and 5 both add cases to the API package's sync tests (new cases in new `describe` blocks or files, never edits to each other's); merge slice 5 first, and slice 3 syncs before its handoff.
- **Gates:** `pnpm prd check` per slice as [loop](../docs/agents/loop.md) says. Browser checks run once per wave on the integration branch, the ones `check-areas` maps for the wave's changed files: expect `roundtrip`, `live-notes`, `phase2`, `first-sync`, `sign-in`, `signout-wipe` and `session-end` in both waves (the upload procedure, the device schema, the sync entry module and the device client all change).

## Slice 1: One upload registry

Stack: no · Reads: docs/domain/sync.md, docs/domain/api.md, docs/domain/data-layer.md, docs/domain/todos.md · Tests: unit, integration

Covers B-293 (one generic soft-delete handler), B-291 (the table lookup accepts `constructor` and `__proto__`), B-292 (a test that the three column lists agree). US 16, 17, 18, 19.

**What to build.** Replace the nine copied soft-delete handlers in the `sync.upload` procedure with a table registry and one generic handler, in a module of its own apart from the procedure's loop, as the PRD's _The upload registry_ describes: a spec per table (column map, fixed columns, service, whether `updated_at` is passed as `changedAt`), hooks for `todo`'s and `timeline_entry`'s extra rules, and the small handlers (links, live notes, `care_recipient`) registered beside them. The registry is a `Map`. Make the answers the same on every table: a member who can read but not write gets `permissions:unauthorized` on PUT, PATCH and DELETE (today only a timeline PATCH maps `baseModel:update:nothingUpdated`, and the timeline and series removes answer a viewer 404). Do that in the handler, with one more read to tell a viewer from a missing row; don't change a service (slice 5's). Todos keep their own answers: `viewerCompletionOnly`, and a viewer's tick of their own todo is still `applied`. Export the column maps and add the agreement test, which skips device tables marked local-only (slice 2 adds the first). Don't change the procedure's loop or result shape (slice 3's).

**Acceptance criteria**

- [ ] Every existing `sync*.int.test.ts` in the API package passes, changed only where a viewer's answer becomes 403 on purpose; each such change is listed in the handoff.
- [ ] A table-driven integration test runs a viewer's PUT (a new id), PATCH and DELETE against every soft-delete table and gets `rejected` with `permissions:unauthorized` each time (for `todo`: `viewerCompletionOnly` on a content PATCH, and `applied` for the viewer's own tick), and nothing else changes in Postgres.
- [ ] An integration test uploads ops for tables `constructor`, `__proto__`, `toString` and an unknown name: each is `rejected` with `sync:readOnlyTable`, none throws, none is `applied`.
- [ ] A unit test (no database) fails when a column of a synced table is in the device schema but in neither its stream in `sync-config.yaml` nor an explicit ignore list, or is in the device schema of an uploadable table but in neither the registry's map, its fixed columns nor an explicit "server-set" list (ids, audits, `deleted_at`, `via` and the like). Its failure message names the three places to edit. It skips a device table marked local-only. Removing a column from one list in a scratch edit makes it fail (say so in the handoff; don't commit the edit).
- [ ] A PATCH naming only server-set columns is still `applied`; one naming only a column in no list is `rejected` (a new `sync:` error in the sync errors part if none fits).
- [ ] The procedure's file and the registry module together are at least 300 lines shorter than the procedure's file was, and no table has its own copy of the remove-with-replay check.

**Blocked by:** nothing. **Blocks:** slices 3 and 5.

## Slice 2: Changes that didn't save are kept and shown

Stack: yes · Reads: docs/domain/sync.md, docs/domain/components.md, docs/domain/app-shell.md, docs/domain/ui-kit.md · Tests: unit, component, e2e:roundtrip

Covers B-285 (refused sync changes vanish). US 1, 2, 3.

**What to build.** First move the uploader out of the device client into a module of its own that takes the database and the server call as arguments, so a device test can drive it (the client keeps `open`, `clear` and the connector that calls it). Then the local-only device table and everything that reads and writes it, end to end: the uploader records each `rejected` result (the op's data, the server's code and issues, and a plain label of what the row was, read from the op's data or the local row before the server's copy replaces it; none when neither has it) before it acknowledges the batch; a pure module turns a record into a sentence; `useSyncState` gains the count waiting to upload, the count not saved and whether the last upload failed; Settings gets a "Changes not saved" page (newest first, one line per row with a count when a row has several records, a note's document and its updates as one line, Dismiss per line, Dismiss all, an empty state) with its route and URL in the settings area's parts; the header's indicator shows "N not saved" linking to it, and "Offline · N waiting" when offline with changes queued. Confirm the PowerSync Drizzle schema can mark a table local-only; if it can't, declare that one table with PowerSync's own table type beside the Drizzle ones.

Also look at which refusals are routine: run the app's ordinary flows (the `roundtrip` steps) and read what gets recorded. A device's own copy of a row the server already wrote (a twin) must not end up listed; name any you see in the handoff (slice 5 makes a replayed create `applied` and asserts the list stays empty) and don't special-case them here.

**Acceptance criteria**

- [ ] Unit tests for the sentence module: each code the upload can return for an ordinary cause (not allowed, not found, immutable, invalid with issues, read-only table) gives a sentence naming the kind of thing and its label; a record with no label names the kind alone; an unknown code gives the fallback with the issue messages.
- [ ] A device test (the local test database) drives the uploader with a stubbed server answer holding one `applied` and one `rejected` result: the record exists with the op's data, code, issues and label, and the whole batch is acknowledged. A refused DELETE is recorded without a label.
- [ ] Component tests: the page lists lines newest first; three records for one row are one line with "3 changes"; a refused note document and its updates are one line; Dismiss removes a line's records, Dismiss all empties it, the empty state shows; the indicator shows "2 not saved" as a link to the page, "Offline · 3 waiting" when offline with a queue, and nothing new when all is well.
- [ ] The records are gone after the device is wiped (a device test through the sign-out path's clear).
- [ ] `roundtrip`: its existing refused-upload step (the viewer's forced title change) also finds the refusal on the "Changes not saved" page with a reason. No new check, no new sign-in.
- [ ] The frozen route and URL lists (`routes.test.ts`, `appUrls.test.ts`) have the new page, and `sync-matrix.test.mjs` skips local-only tables by an explicit rule.

**Blocked by:** nothing. **Blocks:** slices 3 and 4 (the uploader module, the table, the counts).

## Slice 3: A failing change can't block the queue

Stack: no · Reads: docs/domain/sync.md, docs/domain/api.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: unit, integration, component

Covers B-286 (a repeatable 5xx blocks a device's upload queue forever). US 4, 5, 6, 7.

**What to build.** On the server: run each op in its own try; an unexpected error (a throw or a non-4xx service error) is logged and answered as `failed` for that op, the server stops there and returns the results so far with a 200. Before calling it `failed`, probe the database; if the probe fails too, answer the whole request 5xx. Reject a NUL character anywhere in an op's data (text, JSON text, a note update) up front as invalid. On the device, in the uploader module: after a `failed` at index n, acknowledge only the n ops before it by reading a second batch of n from the queue and completing that one (the batch in hand always completes through its last op; nothing is acknowledged when n is 0), count the try against that op (a small pure counter keyed by the queue entry, stored on the device so it survives a reload), and throw so PowerSync reports the error and retries. After 5 failed tries of the same op spread over at least 2 minutes, record it in slice 2's table as set aside (with its data), acknowledge it and carry on. A request that fails as a whole never counts. The indicator shows "Can't sync, retrying · N waiting"; the page labels a set-aside change "The server couldn't save this" and gives it "Try again", which sends that one kept op to `sync.upload`: `applied` removes it from the list, anything else leaves it with the new reason.

**Acceptance criteria**

- [ ] Integration (API package): a batch of three ops whose second makes Postgres fail returns `applied`, `failed` and nothing for the third, with a 200; the first is in Postgres, the third isn't. With the database probe failing, the same batch is a 5xx.
- [ ] Integration: an op with a NUL character in a text column, in a JSON column (`details`), and in a note update's data is `rejected` as invalid each time, and the ops after it are processed.
- [ ] Unit tests for the try counter: 4 tries don't set aside; 5 within a minute don't; 5 over 2 minutes do; a different op or a whole-request failure starts no count and adds none; the count clears when the op is acknowledged; a count written, then read back by a fresh instance, carries on.
- [ ] A device test drives the uploader through stubbed answers: after a `failed` at index 1 only the first op leaves the queue and the uploader throws; after a `failed` at index 0 nothing leaves; once the counter says so, the op is recorded as set aside with its data, leaves the queue, and the next op uploads.
- [ ] Component tests: the indicator's failing state with its waiting count; a set-aside line's wording; "Try again" removes the line on `applied` and keeps it, with the new reason, otherwise.
- [ ] `sync.upload`'s result type and the device's handling agree by type (no cast), and the API's frozen procedure list is unchanged.

**Blocked by:** slice 1 (the procedure's file), slice 2 (the uploader module, the table, the page, the counts). **Blocks:** nothing.

## Slice 4: Sign-out and a session's end protect unsent changes

Stack: yes · Reads: docs/domain/sync.md, docs/domain/auth.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: unit, component, e2e:signout-wipe, e2e:session-end

Covers B-290 (sign-out and a lapsed session wipe unsent changes). US 8, 9, 10, 11.

**What to build.** As the PRD's _Sign-out and a session's end_: a pure rule beside the session rules answering wipe, ask first or keep for the owner, from the reason, the waiting count and how long a kept copy has waited; the user menu's Sign out opens a native `<dialog>` when changes are waiting; the sign-out route wipes, then calls the server, and on a network failure leaves a "sign-out pending" marker that the app clears by finishing the sign-out the next time it reaches the server, before any session check, landing on sign-in either way (no root error page); a session the server ended keeps the local database closed and uncleared for its owner when changes are waiting (keeping the owner mark, the time it was kept and that user's pending settings changes, forgetting the rest), and wipes as today otherwise; a kept copy past its limit is wiped the next time the app opens on the device, the sign-in page included.

**The rules are the user's answers** in the PRD's _Decisions_ table: keep the copy only when it holds unsent changes (a11), and wipe it 30 days after the session ended (a12).

**Acceptance criteria**

- [ ] Unit tests for the rule: every pair of reason (explicit, ended by the server, another user) and count (none, some), and a kept copy just under and just over its limit.
- [ ] Component tests: Sign out with nothing waiting posts at once; with changes waiting it opens the dialog with the count, "Stay signed in" does nothing, "Sign out anyway" posts.
- [ ] A device test: after a session-ended keep, the queue still holds the change and nothing cached about the user is readable; opening for the same user keeps the queue; opening for another user clears it first; a kept copy past its limit is cleared without anyone signing in.
- [ ] Unit or device test: with the "sign-out pending" marker set, the next session check calls the server's sign-out first and returns signed out, and clears the marker only when that call succeeds.
- [ ] `signout-wipe`: an offline sign-out ends on sign-in with the local copy gone, and back online the old session no longer opens the app.
- [ ] `session-end`: a device with an unsent change, signed out from another device, lands on sign-in; after signing in again as the same person the change reaches the server.

**Blocked by:** slice 2 (the waiting count). **Blocks:** nothing.

## Slice 5: Replayed creates and reused ids change nothing

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/live-notes.md, docs/domain/appointments.md, docs/domain/todos.md, docs/domain/medications.md, docs/domain/providers.md, docs/domain/profiles.md, docs/domain/care-periods.md · Tests: integration, e2e:roundtrip

Covers B-288 (a replayed PUT reverts newer edits) and B-289 (client-chosen ids can be squatted across groups). US 14, 15.

**What to build.** Every soft-delete service's `upsert` becomes create-if-absent and says whether it created: for an existing row the actor can see, `immutable` for a changed group, recipient or kind, otherwise the row untouched, whatever the actor's role now; an invisible one refused as today. The existing data-package tests that expect `upsert` to update change with it. In the registry's PUT branch (slice 1's module), the follow-ups a PUT carries (`deleted_at` → remove; a todo's `done_at` → complete) run only when this PUT created the row, in the same transaction as the create (pass the transaction through the service context, as the services already do for each other), so a failure between them can't leave a row created but not ticked. The todo twin's path (`upsertOccurrence`) keeps its own rules. Separately: creating a live-note document checks its id across all groups as the system and refuses a taken one with a 4xx; a series' "this day has its visit" counts only a row of the same group and series, and when the computed visit id is taken by any other row the visit is written under a second id derived from the series, the day and a fixed salt.

**Acceptance criteria**

- [ ] Integration, one case per soft-delete service: `upsert` twice with different content for the same id leaves the first content; after an `update` by another member, a replayed `upsert` with the original values leaves that update in place; a changed group is `immutable`.
- [ ] Integration (medications): a replayed `upsert` writes no second change entry and doesn't touch the first.
- [ ] Integration (API package): a `timeline_entry` PUT replayed after its uploader was demoted to viewer is `applied` and changes nothing (B-286's first trigger).
- [ ] Integration (API package): a todo PUT carrying `done_at`, replayed after a co-member reopened the todo, leaves it open and makes no next occurrence; a first-time PUT carrying `done_at` creates it done; a first-time PUT carrying `deleted_at` creates it deleted; a replayed PUT carrying `deleted_at` for a row someone restored or edited since leaves it alone. A todo's twin PUT still answers `applied`.
- [ ] Integration (live notes): with a document of the same id in another group, create is a 4xx (not a 500) and the other group's document is untouched.
- [ ] Integration (series): with the computed visit id held by a row of another group, top-up still writes that day's visit, once, and a second top-up doesn't write it again.
- [ ] `roundtrip`: its last step finds the "not saved" table holding only the forced refusal from the refused-upload step (one read of the local table, no new page visit). Any twin slice 2's handoff named is covered by an integration case here.

**Blocked by:** slice 1 (the registry module), slice 2 (the table, for the `roundtrip` step). **Blocks:** nothing.

## Slice 6: Offline edits send only what changed

Stack: yes · Reads: docs/domain/sync.md, docs/domain/medications.md, docs/domain/providers.md, docs/domain/appointments.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

Covers B-287 (offline medication and provider edits re-send unchanged JSON columns). US 12, 13.

**What to build.** First confirm the cause on the running stack: edit a synced medication's refill fields and read the device's upload queue; say in the handoff whether `schedule` was in the PATCH (the stack is for this, not for a browser step). Then make the medication and provider edit paths write only the columns whose value differs from the stored row (JSON columns compared by value, not as text), as the conditions path already does, through one shared helper. Seed the device tests' JSON columns in the text form Postgres sends down. Run the same check on the other device tables with a JSON column (an entry's `details`, a series' `provider_ids`): fix one that has the same one-line cause; file anything bigger with `pnpm backlog add` and name it in the handoff.

**Acceptance criteria**

- [ ] Unit tests for the helper: equal JSON in different text forms is "unchanged"; a changed key, a changed array order and null against missing are "changed" as the service would see them.
- [ ] Device tests (the local test database, rows seeded with Postgres-form JSON): a refill edit queues a PATCH without `schedule`; a provider's name edit queues one without `phones`; an edit that changes the schedule or the phones does send it; a save with nothing changed queues nothing.
- [ ] The same queue check, one case each, for an entry's `details` and a series' `provider_ids`.
- [ ] The handoff states what the real upload queue held before and after the fix for one refill edit.

**Blocked by:** nothing. **Blocks:** nothing.
