# Plan: Fixes (tooling)

Small tooling fixes: scripts, checks, tests and flakes. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-tooling`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**Hand-off (2026-11-22, after the wave 1 landing; no slices in flight).** Wave 1 (slices 1–8, all opus) landed in dev through PR #61 (dev b0b9a31): full check passed on 80aa5175 (5709/5709, tooling 791/791; the first run failed only resetStaging B-466, passed alone 3/3), quick passed on 3b19210e after a conflict-free dev sync, browser `--changed` none needed. Codex reviewed fb529c4 clean; the docs fold and dev merge after it landed `--no-review` (said in the report). Report: ask a49; to-test `to-test/2026-11-22-1127-fixes-tooling.md`. Docs folded: backlog.md (`--archived`), machinery.md (tidy ownership and lsof, session `--if-pid`). B-458's archived-item fixes (B-205/B-206/B-208/B-88/B-222) are applied. B-460 done with slice 5; B-461 noted as likely the same cause (confirm under load). Follow-ups filed: B-527 (fixes-bug, Undo/Done writes uncaught), B-534 (tooling tests and the load gate).

**Wave 4 (2026-11-24, this session, fixes-tooling-9c; run-through).** Reconciled: no slices in flight, prd/fixes-tooling up to date with dev. Slices 25 (B-418), 26 (B-573, B-446, B-704), 27 (B-582), 28 (B-642), 29 (B-723), 30 (B-654), all opus, all started (worktrees made, agents spawned). Hot set to recover, browser, mcp/readTools int tests, context, lease. Wave notes filed for the unassigned items (B-633…B-732: waves 5–8). Deferred: B-461/B-732 (inbox-agent's `tidy`), B-619 (waits for B-660), B-731 (inbox-agent's `session*`). Filed B-740 (stack.test gc timeout under load, seen in slices 25 and 29 checks). Doc to fold: a fake-clock wait loop keeps its step count small (each step costs process starts). Gate: a tier the check plan proposes (27/28 touch `packages/`: integration).

**Hand-off (2026-11-24, after the wave 3 landing; no slices in flight).** Wave 3 (slices 17–24, all opus) landed in dev as 00894439 through PR #145, tier none (tooling and docs only); Codex out of credits, landed `--no-review` (said in the report). Gate: `pnpm test:tooling` passed on 5f8c6853 (1783) and on the synced tip 11de7bd2 (1830). Dev sync 9fd91277 conflicted with inbox-agent B-515 (an `inbox` session kind) in `context.mjs`/`dispatch-context.mjs`: inbox keeps one limit, hard = soft 160k, rotate unasked (`hardLimitFor("inbox")`, `inboxLimit` in `contextDecision`), said in the report. Report: ask a178; to-test `to-test/2026-11-24-0705-fixes-tooling.md`. Docs folded on dev's text (machinery, orchestrator, backlog; all within budget). Slice worktrees 17–24 removed. inbox-agent-67 told of the landing (its B-733 waited on it). **Next: wave 4** (the user's order: known flakes by cause), from the 74 triaged fixes-tooling items; check hot files first (`pnpm backlog prd list`: inbox-agent keeps `scripts/backlog/`, `lib.sh`, `prd.sh`, `prompt.sh`, `tidy`, `queue`, `session*`, `rotate`, `bye`; asks-relay and staging-ship are not running).

**Wave 3 (2026-11-24, this session; started run-through).** Test-gates is done, so the hold is over. Waves follow the user's order (see _Wave 3_). Slices 17 (B-468, open-session only), 18 (B-525), 19 (B-526), all opus. Inbox-agent-ec confirmed (2026-11-24) its slice 6 leaves `dispatch*.mjs`, `session-requests.mjs`, `context.mjs` alone and narrowed its hot list (keeps `session.sh`, `sessions.mjs`); it messages on landing. So also slices 20 (B-452, after 17), 21 (B-453), 22 (B-454), 23 (B-570), 24 (B-600), all opus. Docs to fold: machinery (a stale ask lock is taken over under `.<id>.takeover`; notices keep their high-water mark in `.seq.d/`; an opener failure is not a death: reopen uncounted, a fresh start or plan worktree removed with `rm.sh`, keep-alive entry restored; the opener falls back to the first window, else a new one; `.dispatch.lock` is taken over under a `<lock>.takeover` guard; a session request notice that cannot post shows in `pnpm prd session requests`). B-586 (phone pushes) needs the user on the real phone: not sliced. B-477 is `scripts/backlog/` (inbox-agent): later.

**Hand-off (2026-11-22, wave 2 landing).** Wave 2 (slices 9–16, all opus) merged; dev synced (brought the tedder family seed, switched to `seedPasswordHash` in 1399ff15). Full check passed on 1399ff15 (5722/5722, tooling 811/811). Docs folded (55b318af): machinery.md (`pnpm prd wait`, worker db names, load gate off in `tooling:unit`), data-layer.md (worker names, 10 s test connect, shared seed hash), orchestrator.md (tooling lint), runbook (`DATABASE_CONNECT_TIMEOUT_MS`); loop.md not touched (near budget; the prompts carry `pnpm prd wait check`). Browser: the lean set (the diff touches `package.json` and the pool config). Follow-ups filed: B-544 (fixes-nit, stale `vitest.config.ts:196` comment), B-545 (`rm.sh` reads prd list twice).

**B-547 (dev red, fixed here on the user's word, e0c21bbf):** React Aria hides a popover with inline styles until it is placed, and ui-kit-3's `motion-overlay` fade also ran on that hiding. React Aria cancels the fade when it reveals the panel, so an Escape in that window left the close waiting forever: an invisible calendar stayed in the DOM and took taps. `motion-overlay` now has no transition while that inline hiding is on (`[style*="clip-path"]`; a React Aria upgrade could change it, `overlayMotion.browser.test.tsx` guards it). sync-safety only shifted the timing (no single change pinned). Full check passed on e0c21bbf (5811, tooling 812; the first run failed only the print menu race, filed). The lean browser set passed before this fix (1b120e9c) and was not rerun.

**Later waves:** each item's notes carry its wave (`This item: wave <n>`). Run full checks on a quiet machine, under `caffeinate -i`; wait on a check with `pnpm prd wait check`; confirm any failure alone 3x before calling it a flake.

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need Node 24 first on PATH (`$HOME/.nvm/versions/node/v24.*/bin`).

| Slice | Item  | State                                                                                                                                      | Merge    |
| ----- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1     | B-381 | merged (quick passed on slice)                                                                                                             | 3df76253 |
| 2     | B-394 | merged (quick passed; 20 s timeout kept, see note)                                                                                         | 26e83fa4 |
| 3     | B-411 | merged (tooling: rotate.test 20 s timeout at load 126, passes alone)                                                                       | 7ccc8ff8 |
| 4     | B-440 | merged (tooling; tidy-cli.test beforeAll 10 s timeout under load: B-460)                                                                   | 1a7ad440 |
| 5     | B-441 | merged (conflict with 4 in tidy-cli.mjs resolved; +B-460 fix: load gate off in tidy-cli.test)                                              | d971f6fa |
| 6     | B-458 | merged (tooling)                                                                                                                           | a8ab24cc |
| 7     | B-475 | merged (test race, not a timer; Undo catch: B-527 fixes-bug)                                                                               | cd8cc1f5 |
| 8     | B-484 | merged (quick passed on slice)                                                                                                             | af134b65 |
| 9     | B-451 | merged (full passed on slice: package.json; browser not run, no stack)                                                                     | 4adeb2da |
| 10    | B-445 | merged (quick passed on slice)                                                                                                             | da329245 |
| 11    | B-534 | merged (full passed on slice)                                                                                                              | 0d7e9205 |
| 12    | B-444 | merged (quick passed on slice)                                                                                                             | 9a1479e9 |
| 13    | B-405 | merged (quick passed on slice)                                                                                                             | 6f8d07be |
| 14    | B-388 | merged (quick: only resetStaging timed out (fixed by 16))                                                                                  | e962e40d |
| 15    | B-450 | merged (quick passed on slice)                                                                                                             | d0b0324b |
| 16    | B-466 | merged (full passed on slice)                                                                                                              | 3f739326 |
| 17    | B-468 | merged (opus; quick passed on rerun; first run only tidy-cli beforeAll, B-461)                                                             | 0e5c25aa |
| 18    | B-525 | merged (opus; quick passed on rerun; first run only tidy-cli beforeAll, B-461)                                                             | 8a805d94 |
| 19    | B-526 | merged (opus; quick passed; follow-up B-731)                                                                                               | cfa4e90f |
| 20    | B-452 | merged (opus; quick passed; adds `rm.sh --no-registry` for undo)                                                                           | 5c94e59e |
| 21    | B-453 | merged (opus; quick: only tidy-cli beforeAll at load 30, B-461; alone 3/3)                                                                 | 5f319e68 |
| 22    | B-454 | merged (opus; quick passed)                                                                                                                | e8bf7ebb |
| 23    | B-570 | merged (opus; quick passed)                                                                                                                | fd7c1cb4 |
| 24    | B-600 | merged (opus; quick passed; doc lines for orchestrator/machinery/backlog in hand-off)                                                      | 16f598e9 |
| 25    | B-418 | merged (opus; cause: 258 fake-clock 300 s steps; step now `CARETOOK_RECOVER_STEP_SECS`; quick red only in stack.test (B-740) and tidy-cli) | cd0e8eae |
| 26    | B-573 | started (opus; also B-446, B-704)                                                                                                          |          |
| 27    | B-582 | started (opus)                                                                                                                             |          |
| 28    | B-642 | started (opus)                                                                                                                             |          |
| 29    | B-723 | handed off 4e1f251d (opus; quick red only in untouched files under load: stack, backlog, tidy-cli)                                         |          |
| 30    | B-654 | started (opus)                                                                                                                             |          |

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

## Wave 3

The user's wave order (2026-11-23): 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. Same rules as waves 1 and 2. Never touch a running topic's hot files (`pnpm backlog prd list`: inbox-agent's `scripts/backlog/`, `scripts/loops/lib.sh`, `prd.sh`, `prompt.sh`, `dispatch*`, `tidy*`, `queue*`, `session*`, `rotate*`; sync-safety's sync paths). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain.

### Slice 17: open-session.sh opens a tab when iTerm2 has no current window (B-468)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/open-session.sh` (~79) takes `current window` when `(count of windows) > 0`; with iTerm2 hidden, minimised or without a key window that is `missing value`, and osascript exits 1 ("Can't get current tab of missing value (-1728)").

- When `current window` is missing value, fall back to the first window, or create a window when there is none usable; the tab then opens as usual. Keep the change inside the AppleScript and its shell wrapper.
- The dispatcher tells "the tab never opened" (the opener exited non-zero) from "the session died": an open failure adds no reopen count, leaves no worktree that blocks other planners or starts, logs one line and retries at a later tick (`dispatch.mjs`; inbox-agent confirmed 2026-11-24 its last slice leaves it alone).
- Unit tests: the generated AppleScript handles a missing current window (falls back, never addresses `current tab of missing value`); a dispatcher tick whose opener fails records no death and no reopen.
- Slices 20–22 also edit `dispatch.mjs`: keep this change to the open path.

### Slice 18: an ask lock's takeover is atomic (B-525)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`withAskLock` (`scripts/loops/asks.mjs` ~227–261): two processes that both see a dead holder's lock as stale both `rmSync` it, so one can delete the other's fresh lock, and an answer and a default overlap.

- Take over a stale lock atomically: rename-then-verify, or a short takeover mutex like `lease.sh`'s `.takeover`, so only one taker wins and a fresh lock is never removed. A live holder's lock is never removed.
- Unit test (`asks.test.mjs`): two takers racing over one stale lock end with exactly one holder, and a lock taken fresh after the stale check is not deleted (drive the interleaving deterministically, e.g. by a hook between the stale check and the removal).

### Slice 19: notice ids never go back (B-526)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`createNotice` (`scripts/loops/notices.mjs` ~109–152): the `.seq` high-water mark is updated check-then-rename, so two concurrent posts can lower it; once both notices expire an id is reused, and a late `notices --done` withdraws a newer notice.

- Serialise the seq update (a lock) or raise it so it can only move up (e.g. re-read and retry until the stored value is at least n), so an id is never handed out twice.
- Unit test (`notices.test.mjs`): the n1/n2 interleaving Codex reproduced (the lower write landing last) leaves `.seq` at the higher id, and a later post gets a new id.

### Slice 20: a failed new.sh in a dispatcher start leaves no orphan worktree (B-452)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`dispatch.mjs` (~408): `writeRecord` comes after the `new.sh` break, so a start or plan whose `new.sh` fails after making the worktree leaves it with no managed record; later ticks treat it as opened by hand and it holds a slot for good.

- Write the managed record (a setup state) before `new.sh`, or remove the partial worktree on failure; either way a failed setup frees its slot and is retried or reported, never counted as a hand-opened session.
- Unit test (`dispatch.test.mjs`): a `new.sh` that fails after creating the worktree leaves no slot held at the next tick.
- Blocked by slice 17 (both change the start path of `dispatch.mjs`); slices 21–22 edit other functions there. Slice 17 already removes a worktree `new.sh` made this tick when the opener then fails (`rm.sh <name>`, the `fresh` flag): reuse that for a failed `new.sh`.

### Slice 21: a 'hold the topic' answer is consumed only once the hold is written (B-453)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`dispatch.mjs` (~353): `updateState` deletes `asked` and `reopens` whatever the backlog write's `r.ok`, so a failed hold write lets the same tick reopen the session.

- Consume the answer and clear the count only after the hold is written; on a failed write keep both, skip the topic this tick, log one line, and retry next tick.
- Unit test: a failing hold write leaves the answer and the count, and the topic isn't reopened that tick; a succeeding one consumes them.

### Slice 22: the dispatcher lock's takeover is atomic (B-454)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`dispatch.mjs` `takeLock` (~200) unlinks a dead holder's lock from an earlier pid read, so two dispatchers starting together can both take it (Codex reproduced 6/30).

- Make the takeover atomic (rename a temp lock over it and re-read, or a mkdir lock): exactly one of two racing starters holds it. If slice 18 lands a shared helper for stale-lock takeover first, reuse it; otherwise keep it local.
- Unit test: two takers racing over a stale lock (deterministic interleaving) end with one holder; a live holder's lock is never taken.

### Slice 23: session request notices fit the notice board (B-570)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`requestNotice` in `scripts/loops/session-requests.mjs` has no length bound: with 40-character names a refusal reaches 201 characters, `createNotice` rejects it, and the requester hears nothing.

- Bound the text to the board's `MAX_TEXT`, keeping the request id and its outcome (cut the variable parts, e.g. names or the opener's error, with an ellipsis); if a post still fails, the request step logs it where the requester can see it.
- Unit test (`session-requests.test.mjs`): long names and a long opener error give a notice within `MAX_TEXT` that still carries the id and outcome.

### Slice 24: soft and hard context limits for orchestrators and the backlog session (B-600)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

Slice agents already have soft 175k / hard 300k (`context.mjs`, hotfix 86447987). Orchestrators and the backlog session still share one 160k limit (`limitOf`), and a backlog session is told to hand off unasked while the dispatcher's question (`dispatch-context.mjs`) defaults to rotating. The user (2026-11-22, 2026-11-23): orchestrators and backlog soft 160k, hard 225k; **a backlog session's limit is soft and never a forced close**: past it the session tells the user and lets them choose (hand off or keep going); no answer means keep going.

- Orchestrators: the soft reminder at 160k (judge, as slice agents do), the hard one at 225k (rotate at the next safe point, as today's text says); `CARETOOK_CONTEXT_LIMIT` keeps overriding the soft value; the dispatcher's rotation question waits for the hard limit.
- Backlog session: a soft reminder only (tell the user its size and ask, hand off or keep going); no hard hand-off; the dispatcher's question for a backlog session defaults to "leave it" (keep going), never rotating.
- Keep `pnpm prd context` and `liveSizes` output right for both limits.
- Unit tests (`context.test.mjs`, `dispatch-context.test.mjs`): the orchestrator's soft and hard thresholds; the backlog session's reminder never says to hand off unasked; the dispatcher's backlog question defaults to keep going.
- Hand-off: the lines loop.md, machinery.md and orchestrator.md should change (they state 160k).

## Wave 4

The user's order: known flakes by cause. Same rules as waves 1–3: **first show the cause** (a deterministic failure, or a reasoned reading of the race from the code), then fix that cause; a longer timeout alone only when the work is genuinely large and the hand-off says so. Never touch a running topic's hot files (`pnpm backlog prd list`: inbox-agent's `scripts/backlog/`, `lib.sh`, `prd.sh`, `prompt.sh`, `tidy*`, `queue*`, `session*`, `rotate*`, `bye*`, `dispatch*`, `keep-alive*`, `open-session*`; test-health-2's `vitest.config.ts`, `apps/web/test/`, sync paths, `sync-matrix*`; symptom-catalog's timeline paths). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain. Not in this wave: B-461/B-732 (`tidy-cli.test.mjs`, inbox-agent's hot `tidy`), B-619 (search speed: not reproduced in 24 runs; waits for CI failure messages, B-660).

### Slice 25: recover's '--at a time that has passed' test doesn't depend on the machine (B-418)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/recovery.md · Tests: unit

`scripts/loops/recover.test.mjs` (~597) '--at a time that has passed waits until tomorrow' fails in a full `pnpm test:tooling` run under load and passes alone; the assertion output was never captured.

- Find the cause from the code (`recover.sh`/`recover-lib.mjs`'s clock: the fake `CARETOOK_CLOCK_FILE`, any real `date` read, the local time zone the `--at` time is read in, the fake `sleep` and the test's timeout) and show it; fix that cause so the test passes at any load, time zone and time of day.
- Unit test: the same assertions, plus a case that pins the cause (e.g. a non-UTC `TZ`, or a real-clock read that must not happen).

### Slice 26: the browser harness tests don't count load-wait lines, and leave no process group behind (B-573, B-446, B-704)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/browser.test.mjs`: 'passes a clean spec' (~182) gets a third output line under load where it expects two (likely `browser.sh`'s `load_gate_wait` line, not confirmed); 'kills a spec at its cap, worker and all, and retries it once' failed at load 47 ("expected false to be true" after 9.7 s, real-time sleeps); and an interrupted run left its silent fixture's process group alive for days (B-704).

- Confirm what the extra line is (run the test's harness with the load gate busy) and fix the cause: the tests run `browser.sh` with the load gate off (`CARETOOK_LOAD_GATE=off`, the shared test env from B-534) or assert on the lines that matter, not a count.
- The kill test waits on the event (the process gone, the retry's marker), not on a fixed sleep; keep its deadline generous and say why.
- The fixtures' process groups are killed when a test fails, times out or the run is interrupted (an `afterEach`/`afterAll` that kills every group it started, and a fixture that can't outlive its parent, e.g. a parent-death check); show how B-704's group outlived its run.
- Unit tests: a busy load gate doesn't change the clean spec's output; the kill test passes with the machine's clock slowed (or the waits driven by events); a test that throws mid-run leaves no fixture group alive.

### Slice 27: the MCP rate-limit test survives load (B-582)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md · Tests: integration

`packages/api/src/connectors/mcp.int.test.ts` (~392) 'allows 60 calls a minute per connection, then 429 with Retry-After' times out at 5 s under load (passes alone).

- Find where the time goes (61 sequential calls through the full MCP stack, each with its database work) and cut it as B-394 did for list_timeline: a cheaper call, a cheaper world, or the limiter tested with an injected clock and count; the limiter's behaviour (60 a minute, then 429 with `Retry-After`) is still asserted end to end at least once. An explicit timeout only if the work still needs it, with a comment saying why.
- Integration test: the same assertions, with before/after times in the hand-off.

### Slice 28: the todays_doses connector test holds at any time of day (B-642)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/medications.md · Tests: integration

`packages/api/src/connectors/readTools.int.test.ts` (~372, ~385) places a given dose 10 (and 5) minutes before now, so from 00:00 to 00:10 Los Angeles it lands on yesterday and the assertion (~438) finds no given slot today.

- Run the test on a fixed clock (a fixed `now` for the handler, `handlerAt` or its equivalent, and for the entries it writes), chosen mid-day in the recipient's zone; no other test in the file changes behaviour.
- Integration test: the same assertions on the fixed clock, plus a case at 00:05 in the recipient's zone that passed only by luck before (show it failing on the old code in the hand-off).

### Slice 29: context.test.mjs '--all --json lists live sessions only' is not load-sensitive (B-723)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/context.test.mjs` '--all --json lists live sessions only' failed its first-row size assertion (~388) in a quick check at load about 25; passed 3/3 alone; the value wasn't captured.

- Read the test and `context.mjs`'s `--all --json` path for what can change the first row's size or order under load (a real clock, mtime ordering, a transcript still being written, a real session record leaking in from the machine) and show the cause; fix it so the row and its size are deterministic.
- Unit test: the same assertion, plus one that pins the cause (e.g. equal mtimes, or a live machine record that must not appear).

### Slice 30: lease.test.mjs's 'beyond the default limit of two' doesn't race (B-654)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/lease.test.mjs` (~263) 'makes the runs beyond the default limit of two wait, and holders shows who holds what' flaked in CI (passed on its rerun; ci-key ab40db666b8d).

- Find the race from the code (holders started in parallel and checked before they hold, a real-time wait, the load gate, `lease.sh`'s poll interval) and show it; the test waits on each holder's state (a marker or `holders` output), never on a fixed sleep.
- Unit test: the same assertions, deterministic under a slowed holder (e.g. a holder delayed before it takes the lease).
