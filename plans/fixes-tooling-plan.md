# Plan: Fixes (tooling)

Small tooling fixes: scripts, checks, tests and flakes. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-tooling`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**Hand-off (2026-11-22, after the wave 1 landing; no slices in flight).** Wave 1 (slices 1–8, all opus) landed in dev through PR #61 (dev b0b9a31): full check passed on 80aa5175 (5709/5709, tooling 791/791; the first run failed only resetStaging B-466, passed alone 3/3), quick passed on 3b19210e after a conflict-free dev sync, browser `--changed` none needed. Codex reviewed fb529c4 clean; the docs fold and dev merge after it landed `--no-review` (said in the report). Report: ask a49; to-test `to-test/2026-11-22-1127-fixes-tooling.md`. Docs folded: backlog.md (`--archived`), machinery.md (tidy ownership and lsof, session `--if-pid`). B-458's archived-item fixes (B-205/B-206/B-208/B-88/B-222) are applied. B-460 done with slice 5; B-461 noted as likely the same cause (confirm under load). Follow-ups filed: B-527 (fixes-bug, Undo/Done writes uncaught), B-534 (tooling tests and the load gate).

**Held for test-gates after wave 2 (backlog session, 2026-11-22; row flagged standing,hold).** Finish and land wave 2 as usual, start nothing more, then write the hand-off here, `pnpm prd rm fixes-tooling` (frees the slot and the `scripts/loops/`, `scripts/backlog/` hot files) and `pnpm prd end` from the main checkout, **without rotating**. The row is released after test-gates lands.

**Wave 2 (started 2026-11-22, slices 9–16, all opus):** all eight worktrees made and agents spawned (opus). dev synced into prd/fixes-tooling first (backlog-only, conflict-free). Chosen clear of ui-kit-3's and sync-safety's hot files; agent-autonomy and test-health aren't running, so `scripts/loops/` is free. Remaining waiting items (the app-test load flakes B-479, B-480, B-485–B-502; B-239–B-244 codex-review; dispatcher B-452–B-454, B-462–B-465; B-418, B-431, B-432, B-442, B-443, B-446, B-447, B-459, B-461, B-468, B-477, B-525, B-526, B-370, B-375, B-539) wait for wave 3. B-489–B-491 touch ui-kit-3's `components/ui/`: not before it ends.

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need Node 24 first on PATH (`$HOME/.nvm/versions/node/v24.*/bin`).

| Slice | Item  | State                                                                                                                                               | Merge    |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1     | B-381 | merged (quick passed on slice)                                                                                                                      | 3df76253 |
| 2     | B-394 | merged (quick passed; 20 s timeout kept, see note)                                                                                                  | 26e83fa4 |
| 3     | B-411 | merged (tooling: rotate.test 20 s timeout at load 126, passes alone)                                                                                | 7ccc8ff8 |
| 4     | B-440 | merged (tooling; tidy-cli.test beforeAll 10 s timeout under load: B-460)                                                                            | 1a7ad440 |
| 5     | B-441 | merged (conflict with 4 in tidy-cli.mjs resolved; +B-460 fix: load gate off in tidy-cli.test)                                                       | d971f6fa |
| 6     | B-458 | merged (tooling)                                                                                                                                    | a8ab24cc |
| 7     | B-475 | merged (test race, not a timer; Undo catch: B-527 fixes-bug)                                                                                        | cd8cc1f5 |
| 8     | B-484 | merged (quick passed on slice)                                                                                                                      | af134b65 |
| 9     | B-451 | merged (full passed on slice: package.json; browser not run, no stack)                                                                              | 4adeb2da |
| 10    | B-445 | started (opus agent spawned)                                                                                                                        | —        |
| 11    | B-534 | handed off 4074a56e (full passed: vitest.config.ts; fold: machinery load gate; rm.sh reads prd list twice)                                          | —        |
| 12    | B-444 | handed off 3baa63c0 (quick passed)                                                                                                                  | —        |
| 13    | B-405 | handed off 70cc7d85 (quick passed; fold: vitest.config.ts:192 comment, data-layer.md, machinery.md)                                                 | —        |
| 14    | B-388 | handed off ad35cd5b (quick: only resetStaging B-466 timed out, 3/3 alone; browser not run, client.ts maps to @suite; fold: runbook connect timeout) | —        |
| 15    | B-450 | handed off 0dc5a9a2 (quick passed; summary 2.5 s→ms per role, stopgap removed)                                                                      | —        |
| 16    | B-466 | handed off 14db2807 (full passed: seeds; app-shell FLAKY on first PowerSync start, known gotcha; fold: data-layer seeds hash once)                  | —        |

## Wave 1

Each item's backlog notes (`pnpm backlog show B-<n>`) carry the details. For a flake, **first show the cause** (a test that fails deterministically, or a reasoned reading of the race) and fix that cause; a longer timeout alone is acceptable only when the work is genuinely large and the hand-off says so. Never touch `vitest.config.ts`, `eslint.config.js`, `scripts/eslint/` or `apps/web/test/` (test-health's hot files), nor `scripts/loops/lib.sh`, `land*`, `prompt.sh`, `prd.sh`, `dispatch*`, `lease*`, `codex-review*` (agent-autonomy's).

### Slice 1: the connector privacy test asserts on fields, not a substring (B-381)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md · Tests: integration

`packages/api/src/connectors/readTools.int.test.ts` 'nothing private leaves' fails when a random UUID contains the birth year (e.g. `…072194195bed` matches `1941`).

- The test checks that no private value (the birth date and the other private values it guards) appears among the output's field values, not by a substring search over the whole serialized output; it still fails if a private value leaks.
- Integration test: the rewritten assertion; show in the hand-off that a leaked private value still fails it and a UUID containing the year doesn't.

### Slice 2: the list_timeline connector test survives load (B-394)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md · Tests: integration

`packages/api/src/connectors/mcp.int.test.ts` 'list_timeline: … paged at 50' times out at Vitest's 5 s default under load.

- Make the test's world cheaper (bulk insert the 50+ entries rather than one service call each, while still crossing the page boundary) so it runs well under the limit; an explicit per-test timeout only if the work still needs it, with a comment saying why.
- Integration test: the same assertions as today, faster (before/after time in the hand-off).

### Slice 3: a session's end is recorded only by its own wrapper (B-411)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/session.sh` writes `ended` and `exit` unconditionally when its session exits, so a second session opened under the same name gets marked ended when the first exits.

- At exit, `session.sh` records the end only when the record's `pid` is still its own (a compare-and-set in `sessions.mjs`, e.g. a `--if-pid <pid>` guard that no-ops when the pid differs); otherwise it leaves the record and says so on stderr.
- Unit test (`sessions.test.mjs`): ending with a stale pid leaves the newer record live; ending with the matching pid marks it ended.

### Slice 4: tidy keeps a topic's database whose name ends -w<n> (B-440)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`pnpm prd tidy --yes`: the worker-copy label from `test-db.sh list` overrides the known owner, so a database for a topic ending `-w1`..`-w16` reads as an orphan worker copy and is dropped (`tidy-cli.mjs` ~158).

- Match database names against known worktree bases (and their worker names) first; only a name matching no known owner can be an orphan worker copy. Keep the logic in `tidy.mjs` (pure) where it can be.
- Unit test (`tidy.test.mjs`): a live topic `foo-w2` keeps its database and its workers' copies; a worker copy of a gone topic is still an orphan.

### Slice 5: tidy treats a failed lsof as unknown, not idle (B-441)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`pnpm prd tidy`: a missing or failing `lsof` reads as "no process in any worktree" (`tidy-cli.mjs` ~52), so `--yes` can remove an active one.

- An unavailable or failed process inspection is "unknown": tidy keeps every worktree it would have removed for being idle, and says why. lsof's "nothing found" exit still means none.
- Unit test: an inspection that fails keeps worktrees and reports it; an empty successful one still allows removal.
- Slice 4 also edits `tidy-cli.mjs`/`tidy.mjs`: keep the change local to the process inspection.

### Slice 6: backlog set and note can change archived items (B-458)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/backlog.md · Tests: unit

`pnpm backlog set` and `note` refuse an archived item ("is archived; it can't be changed here"), so hygiene fixes to B-206, B-208, B-88, B-222 can't be made.

- Add an `--archived` flag to `set` and `note` that changes an archived item in place, keeping it archived; without the flag the refusal stays and names the flag. Document it in the script's help.
- Unit test: `set --archived` and `note --archived` change an archived item and leave it archived; without the flag they still refuse.
- Don't apply the B-206/B-208/B-88/B-222 changes themselves (the orchestrator does after landing).

### Slice 7: the undo timer no longer fires after a test's database closes (B-475)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md, docs/domain/components.md · Tests: component

`timelineSimpleTodos` 'a viewer… done-only change' leaves an undo timer (`useTodoTick` → `reopenTodo` → `liveTodo`) that fires after the test's database closes: Unhandled Rejection 'Client has already been closed'.

- The pending undo timeout is cleared on unmount (an unmounted screen shouldn't write later), not a harness change (`apps/web/test/` is another topic's).
- Component test: unmounting with an undo pending runs no write afterwards (timers advanced past the undo window, no rejection).

### Slice 8: the staff banner test doesn't race its 2 s window (B-484)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/admin.md, docs/domain/components.md · Tests: component

`apps/web/app/routes/app/layout/staff.browser.test.tsx` 'offline, the cached banner shows; it goes at its end time without a reload' sets `endsAt` to now + 2 s, so a render over 2 s sees the banner already gone.

- Drive the end time with a controlled clock (fake timers for the end-time timer only, never a stepped `Date`), or set `endsAt` from after the first render is confirmed, so render time can't eat the window.
- Component test: the banner shows, then goes at its end time, independent of render duration.

## Wave 2

Same rules as wave 1: for a flake, **first show the cause**, then fix it; a longer timeout alone only when the work is genuinely large and the hand-off says so. Never touch a running topic's hot files (`pnpm backlog prd list`: ui-kit-3's `components/ui/`, `lib/app-shell/`; sync-safety's `packages/api/src/sync`, `apps/web/app/lib/sync/`, `packages/data/src/services/`). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain and the orchestrator folds it in.

### Slice 9: tooling-only landings still lint what they change (B-451)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md, docs/agents/machinery.md · Tests: unit

The check gate's "none needed" (every changed file is Markdown, `scripts/loops/`, `scripts/backlog/` or `.githooks/`) runs no eslint, so a lint error in a tooling `.mjs` reached dev (B-451's note).

- `pnpm test:tooling` (or the step the gate requires for "none needed") also runs eslint and prettier on the changed tooling files (`dev...HEAD`), and fails on an error; keep it fast (only the changed files).
- Unit test: the planner (`check-plan.mjs` or its neighbour) puts the lint step on a tooling-only diff and leaves it off a Markdown-only one.
- Slice 12 edits `lib.sh`'s `docs_only`: keep this change out of that function.

### Slice 10: a wait on the check lease that ends (B-445)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

Agents wait on checks with `until ! pgrep -f "prd check"`, which never exits (it matches its own shell and any session whose prompt mentions the command).

- Add a command that blocks until this worktree's check (or a named lease kind's holder for this worktree) is gone, with a timeout and exit 75 on it, e.g. `pnpm prd wait check [--timeout S]`, built on `lease.sh holders`; list it in `pnpm prd help`.
- Point the slice and orchestrator prompts (`prompt.sh`'s text) at it wherever they tell an agent to wait on a check, and say "never `pgrep -f`". The hand-off names the doc line for loop.md.
- Unit test: the wait returns once the lease is released, and exits 75 at its timeout while it's held.

### Slice 11: tooling tests don't wait on the real load gate (B-534)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

Tooling tests that run `new.sh` without `CARETOOK_LOAD_GATE=off` poll the real machine's load (15 s, up to 600 s) and time out under load.

- Every tooling test env that runs `new.sh` (or anything that gates on load) sets `CARETOOK_LOAD_GATE=off`; prefer one shared test-env helper over per-file lines. Find them all (grep), list them in the hand-off.
- Look at `registry.cli.test.mjs` 'doctor reports…' and `rotate.test.mjs` 'sets done only for a merged branch…' (20 s timeouts once under load): show the cause and fix it, or say why the time is genuine.
- Unit test: a test asserting the gate is off in the shared env (or that `new.sh` under it doesn't poll).

### Slice 12: a code file renamed to .md isn't docs only (B-444)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md · Tests: unit

`docs_only` in `lib.sh` uses `git diff --name-only`, which shows only a rename's destination, so a `.sh`→`.md` rename counts as docs only.

- Use `--no-renames` (both sides listed) in `docs_only` and the other name-only diffs in `lib.sh` that decide a gate (the exempt check at ~136); keep each change to the diff flags.
- Unit test (the tooling test that covers `docs_only`): a rename from `.sh` to `.md` is not docs only; a Markdown-only change still is.

### Slice 13: worker databases live in their own namespace (B-405)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

Worker copies are `<base cut to 59>_w<n>`: two long topics share copies, and worktree `foo`'s worker 1 is the base database of a worktree `foo-w1`.

- Give worker copies a name no worktree base can produce and that keeps a short hash of the full base when shortened (within Postgres's 63 bytes); update `testDatabase.ts` (`isOwnDatabase`), `globalSetup.ts`, `test-db.sh` (`list`, `drop`) and tidy's matching (`tidy.mjs`) together. Old-style copies left on the shared Postgres are still recognised by tidy as orphans (or dropped once); say which.
- Unit tests (`testDatabase.test.ts`, `tidy.test.mjs`): two long bases get distinct worker names; `foo`'s worker can't equal `foo-w1`'s base; a worker of a gone topic is still an orphan.

### Slice 14: the connector integration tests survive 'Connection terminated' (B-388)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/data-layer.md · Tests: integration

`mcpWrites`, `mcp`, `readTools` `.int.test.ts` and `todoRename.int.test.ts` fail under load with 'Connection terminated' (passes alone).

- First find the cause from the code (pool settings, idle or connect timeouts, a client closed while a request is in flight, a test ending before the server's work does, Postgres `max_connections` with 16 workers) and show it, ideally by reproducing it (e.g. a constrained pool or a deliberate slow query). Fix that cause in the test harness or the pool config the tests use (not `vitest.config.ts` without saying why).
- Integration test: the reproduction passes after the fix; the hand-off shows before/after.

### Slice 15: roles.int.test.ts's summary query is fast (B-450)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/data-layer.md · Tests: integration

`rolesSummary` (`packages/data/src/db/roles/applyRoles.ts`) runs a correlated `NOT EXISTS` between `information_schema.column_privileges` and `role_table_grants` (~2.2 s per role), past the 10 s hook timeout; fixes-bug put a 60 s stopgap in the test.

- Rewrite the summary on `pg_catalog` (or without the correlation) so it returns the same result well under a second per role; then remove the 60 s stopgap if the test runs well inside the defaults.
- Integration test: the same assertions, with before/after times in the hand-off; any `db:roles`/`db:access` output that uses the summary is unchanged.

### Slice 16: resetStaging's test is fast under load (B-466)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/data-layer.md, ops/runbook.md · Tests: integration

`resetStaging.int.test.ts` 'wipes everything but real sign-ins, reseeds' times out at 30 s under load (3–10 s alone).

- Find where the time goes (time the wipe and each seed step) and cut it: a lighter world for the test (a small seed through the same reset path), batching, or one transaction; the reset's behaviour on staging doesn't change.
- Integration test: the same assertions, well under the limit (before/after in the hand-off).
