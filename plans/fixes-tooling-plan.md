# Plan: Fixes (tooling)

Small tooling fixes: scripts, checks, tests and flakes. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-tooling`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**Hand-off (2026-11-22, after the wave 1 landing; no slices in flight).** Wave 1 (slices 1–8, all opus) landed in dev through PR #61 (dev b0b9a31): full check passed on 80aa5175 (5709/5709, tooling 791/791; the first run failed only resetStaging B-466, passed alone 3/3), quick passed on 3b19210e after a conflict-free dev sync, browser `--changed` none needed. Codex reviewed fb529c4 clean; the docs fold and dev merge after it landed `--no-review` (said in the report). Report: ask a49; to-test `to-test/2026-11-22-1127-fixes-tooling.md`. Docs folded: backlog.md (`--archived`), machinery.md (tidy ownership and lsof, session `--if-pid`). B-458's archived-item fixes (B-205/B-206/B-208/B-88/B-222) are applied. B-460 done with slice 5; B-461 noted as likely the same cause (confirm under load). Follow-ups filed: B-527 (fixes-bug, Undo/Done writes uncaught), B-534 (tooling tests and the load gate).

**Wave 6 contents (the user, via the backlog session, 2026-11-24; replaces the old wave 6–8 order for these items).** In priority order: (1) agent efficiency, the user's top concern: B-595 (slice agents read only their section), B-596 (cap slice size at planning), B-597 (split ci.mjs and prompt.sh), B-598 (short plan Status); (2) B-696 (check-plan can hang forever); (3) test load: B-542 (cap unit-test workers), B-576 (local lint OOM at 4 GB), B-574 (ESLint exit 134); (4) B-586 (backlog session's phone notifications never arrive); (5) B-705 (minimumReleaseAge missing from pnpm-workspace.yaml); (6) B-464 and B-650 (a hold write drops standing or other flags). Split by hot files as usual; anything that clashes goes to wave 7 in the same order. Codex-review items wait (Codex is out of credits). Wave 5 is unchanged.

**Pause after wave 5: cancelled** (the user, via the backlog session, 2026-11-24: don't stop running work). Carry on run-through, waves as usual; slice 31's still-failing items get their fix slices as planned.

**Wave 5 (2026-11-24, this session, fixes-tooling-9d; run-through).** Reconciled: wave 4 landed (e2771ad), no slices in flight, prd/fixes-tooling up to date with dev. Inbox-agent is done, so `tidy*`/`session*` are free. Slices 31 (re-measure 25 under-load flakes after B-607; proposals, no code), 32 (B-740), 33 (B-741), 34 (B-742), 35 (B-744–B-747), 36 (B-461, B-732), 37 (B-731), 38 (B-638), 39 (B-739, added on the user's word via the backlog session), all opus; items claimed; hot set to stack, ask.test, lease, load-gate.test, tidy-cli.test, session-requests, notices, careGroupInvite.int.test. Not in this wave: B-375 (`vitest.config.ts`, test-health-2's), B-667 (fixture). Second half: a fix slice per item slice 31 finds still failing. Tier: integration (slice 38 is `packages/`), else none.

**Hand-off (2026-11-24, after the wave 4 landing; no slices in flight).** Wave 4 (slices 25–30, all opus) landed in dev as e2771ad through PR #150, tier integration; Codex out of credits, landed `--no-review` (said in the report). Gate: integration green on 3798b561 (run 45403247910) and synced b7a3373f (45404279183); dev then moved (symptom-catalog, migration 0043), resynced 20eed0bf: flake only in `load-gate.test.mjs` (dev's lane-cap file), land filed B-744–B-747; B-654's test left the quarantine. Report filed (asks); to-test `to-test/2026-11-24-0843-fixes-tooling.md`. Docs folded: loop.md (tests wait on state, few fake-clock steps, fake pid 99_999_999). Slice worktrees 25–30 removed. Filed in the wave: B-740 (stack.test gc timeout under load), B-741 (ask countdown test races the clock), B-742 (lease.sh TERM race). **Next: wave 5** (re-measure test flakes; items carry `This item: wave 5`); the deferred wave-4 kind (B-461/B-732 tidy-cli, B-731) waits while inbox-agent holds `tidy*`/`session*`; B-740–B-742 can join wave 5. Check hot files first (`pnpm backlog prd list`).

**Wave 4 (2026-11-24, this session, fixes-tooling-9c; run-through).** Reconciled: no slices in flight, prd/fixes-tooling up to date with dev. Slices 25 (B-418), 26 (B-573, B-446, B-704), 27 (B-582), 28 (B-642), 29 (B-723), 30 (B-654), all opus, all started (worktrees made, agents spawned). Hot set to recover, browser, mcp/readTools int tests, context, lease. Wave notes filed for the unassigned items (B-633…B-732: waves 5–8). Deferred: B-461/B-732 (inbox-agent's `tidy`), B-619 (waits for B-660), B-731 (inbox-agent's `session*`). Filed B-740 (stack.test gc timeout under load, seen in slices 25 and 29 checks). Doc to fold: a fake-clock wait loop keeps its step count small (each step costs process starts). All six merged (tip 6e8ba3f8); items marked done. Gate: CI integration green on 3798b561 (run 45403247910). Slice worktrees 25–30 removed. Dev synced as bdc7a4ef (no conflicts); integration CI green on synced b7a3373f (run 45404279183); dev moved (symptom-catalog, migration 0043), resynced as db3d2c3f; integration CI on 20eed0bf: flake (run 45405266792; only load-gate.test.mjs, dev's lane-cap file, not this branch). PR #150 opened; Codex review waiting. Docs folded: loop.md (tests wait on state, few fake-clock steps, fake pid 99_999_999; trimmed slots/env lines to stay in budget). Context past 160k: rotate after this landing, as planned.

**Hand-off (2026-11-24, after the wave 3 landing; no slices in flight).** Wave 3 (slices 17–24, all opus) landed in dev as 00894439 through PR #145, tier none (tooling and docs only); Codex out of credits, landed `--no-review` (said in the report). Gate: `pnpm test:tooling` passed on 5f8c6853 (1783) and on the synced tip 11de7bd2 (1830). Dev sync 9fd91277 conflicted with inbox-agent B-515 (an `inbox` session kind) in `context.mjs`/`dispatch-context.mjs`: inbox keeps one limit, hard = soft 160k, rotate unasked (`hardLimitFor("inbox")`, `inboxLimit` in `contextDecision`), said in the report. Report: ask a178; to-test `to-test/2026-11-24-0705-fixes-tooling.md`. Docs folded on dev's text (machinery, orchestrator, backlog; all within budget). Slice worktrees 17–24 removed. inbox-agent-67 told of the landing (its B-733 waited on it). **Next: wave 4** (the user's order: known flakes by cause), from the 74 triaged fixes-tooling items; check hot files first (`pnpm backlog prd list`: inbox-agent keeps `scripts/backlog/`, `lib.sh`, `prd.sh`, `prompt.sh`, `tidy`, `queue`, `session*`, `rotate`, `bye`; asks-relay and staging-ship are not running).

**Wave 3 (2026-11-24, this session; started run-through).** Test-gates is done, so the hold is over. Waves follow the user's order (see _Wave 3_). Slices 17 (B-468, open-session only), 18 (B-525), 19 (B-526), all opus. Inbox-agent-ec confirmed (2026-11-24) its slice 6 leaves `dispatch*.mjs`, `session-requests.mjs`, `context.mjs` alone and narrowed its hot list (keeps `session.sh`, `sessions.mjs`); it messages on landing. So also slices 20 (B-452, after 17), 21 (B-453), 22 (B-454), 23 (B-570), 24 (B-600), all opus. Docs to fold: machinery (a stale ask lock is taken over under `.<id>.takeover`; notices keep their high-water mark in `.seq.d/`; an opener failure is not a death: reopen uncounted, a fresh start or plan worktree removed with `rm.sh`, keep-alive entry restored; the opener falls back to the first window, else a new one; `.dispatch.lock` is taken over under a `<lock>.takeover` guard; a session request notice that cannot post shows in `pnpm prd session requests`). B-586 (phone pushes) needs the user on the real phone: not sliced. B-477 is `scripts/backlog/` (inbox-agent): later.

**Hand-off (2026-11-22, wave 2 landing).** Wave 2 (slices 9–16, all opus) merged; dev synced (brought the tedder family seed, switched to `seedPasswordHash` in 1399ff15). Full check passed on 1399ff15 (5722/5722, tooling 811/811). Docs folded (55b318af): machinery.md (`pnpm prd wait`, worker db names, load gate off in `tooling:unit`), data-layer.md (worker names, 10 s test connect, shared seed hash), orchestrator.md (tooling lint), runbook (`DATABASE_CONNECT_TIMEOUT_MS`); loop.md not touched (near budget; the prompts carry `pnpm prd wait check`). Browser: the lean set (the diff touches `package.json` and the pool config). Follow-ups filed: B-544 (fixes-nit, stale `vitest.config.ts:196` comment), B-545 (`rm.sh` reads prd list twice).

**B-547 (dev red, fixed here on the user's word, e0c21bbf):** React Aria hides a popover with inline styles until it is placed, and ui-kit-3's `motion-overlay` fade also ran on that hiding. React Aria cancels the fade when it reveals the panel, so an Escape in that window left the close waiting forever: an invisible calendar stayed in the DOM and took taps. `motion-overlay` now has no transition while that inline hiding is on (`[style*="clip-path"]`; a React Aria upgrade could change it, `overlayMotion.browser.test.tsx` guards it). sync-safety only shifted the timing (no single change pinned). Full check passed on e0c21bbf (5811, tooling 812; the first run failed only the print menu race, filed). The lean browser set passed before this fix (1b120e9c) and was not rerun.

**Later waves:** each item's notes carry its wave (`This item: wave <n>`). Run full checks on a quiet machine, under `caffeinate -i`; wait on a check with `pnpm prd wait check`; confirm any failure alone 3x before calling it a flake.

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need Node 24 first on PATH (`$HOME/.nvm/versions/node/v24.*/bin`).

| Slice | Item      | State                                                                                                                                      | Merge    |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1     | B-381     | merged (quick passed on slice)                                                                                                             | 3df76253 |
| 2     | B-394     | merged (quick passed; 20 s timeout kept, see note)                                                                                         | 26e83fa4 |
| 3     | B-411     | merged (tooling: rotate.test 20 s timeout at load 126, passes alone)                                                                       | 7ccc8ff8 |
| 4     | B-440     | merged (tooling; tidy-cli.test beforeAll 10 s timeout under load: B-460)                                                                   | 1a7ad440 |
| 5     | B-441     | merged (conflict with 4 in tidy-cli.mjs resolved; +B-460 fix: load gate off in tidy-cli.test)                                              | d971f6fa |
| 6     | B-458     | merged (tooling)                                                                                                                           | a8ab24cc |
| 7     | B-475     | merged (test race, not a timer; Undo catch: B-527 fixes-bug)                                                                               | cd8cc1f5 |
| 8     | B-484     | merged (quick passed on slice)                                                                                                             | af134b65 |
| 9     | B-451     | merged (full passed on slice: package.json; browser not run, no stack)                                                                     | 4adeb2da |
| 10    | B-445     | merged (quick passed on slice)                                                                                                             | da329245 |
| 11    | B-534     | merged (full passed on slice)                                                                                                              | 0d7e9205 |
| 12    | B-444     | merged (quick passed on slice)                                                                                                             | 9a1479e9 |
| 13    | B-405     | merged (quick passed on slice)                                                                                                             | 6f8d07be |
| 14    | B-388     | merged (quick: only resetStaging timed out (fixed by 16))                                                                                  | e962e40d |
| 15    | B-450     | merged (quick passed on slice)                                                                                                             | d0b0324b |
| 16    | B-466     | merged (full passed on slice)                                                                                                              | 3f739326 |
| 17    | B-468     | merged (opus; quick passed on rerun; first run only tidy-cli beforeAll, B-461)                                                             | 0e5c25aa |
| 18    | B-525     | merged (opus; quick passed on rerun; first run only tidy-cli beforeAll, B-461)                                                             | 8a805d94 |
| 19    | B-526     | merged (opus; quick passed; follow-up B-731)                                                                                               | cfa4e90f |
| 20    | B-452     | merged (opus; quick passed; adds `rm.sh --no-registry` for undo)                                                                           | 5c94e59e |
| 21    | B-453     | merged (opus; quick: only tidy-cli beforeAll at load 30, B-461; alone 3/3)                                                                 | 5f319e68 |
| 22    | B-454     | merged (opus; quick passed)                                                                                                                | e8bf7ebb |
| 23    | B-570     | merged (opus; quick passed)                                                                                                                | fd7c1cb4 |
| 24    | B-600     | merged (opus; quick passed; doc lines for orchestrator/machinery/backlog in hand-off)                                                      | 16f598e9 |
| 25    | B-418     | merged (opus; cause: 258 fake-clock 300 s steps; step now `CARETOOK_RECOVER_STEP_SECS`; quick red only in stack.test (B-740) and tidy-cli) | cd0e8eae |
| 26    | B-573     | merged (opus; quick passed; groups killed per test, cleanup kills children, kill cap 15 s; B-742 lease.sh TERM race filed)                 | fdac12d8 |
| 27    | B-582     | merged (opus; quick passed; ~2.5 s to ~0.8 s)                                                                                              | b213f458 |
| 28    | B-642     | merged (opus; quick passed; fixed 2030 clock, 00:05 case)                                                                                  | dd3e33f6 |
| 29    | B-723     | merged (opus; fixed pid 99999999; quick red only stack/backlog/tidy-cli under load)                                                        | 0ca671b6 |
| 30    | B-654     | merged (opus; holders wait on a go file; B-741 ask.test filed)                                                                             | 6e8ba3f8 |
| 31    | B-479 +24 | started (opus; re-measure only)                                                                                                            |          |
| 32    | B-740     | started (opus)                                                                                                                             |          |
| 33    | B-741     | started (opus)                                                                                                                             |          |
| 34    | B-742     | started (opus)                                                                                                                             |          |
| 35    | B-744     | started (opus; with B-745, B-746, B-747)                                                                                                   |          |
| 36    | B-461     | started (opus; with B-732)                                                                                                                 |          |
| 37    | B-731     | handed off c384b269 (opus; quick red only ask.test B-741 and tidy-cli B-461, fixed by 33/36; passed alone)                                 |          |
| 38    | B-638     | started (opus)                                                                                                                             |          |
| 39    | B-739     | started (opus; added on the user's word via the backlog session)                                                                           |          |

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

## Wave 5

The user's order: re-measure test flakes. Slice 31 re-measures the old under-load flakes after the harness fix B-607 (settle can return before the page mounts, landed by test-gates as fe82288c) and proposes closing what no longer fails; only what still fails gets a fix slice, in this wave's second half. Slices 32–38 fix flakes and races whose cause is already known or readable from the code, in files that inbox-agent no longer holds. Same rules as wave 4: **first show the cause**, then fix it; a longer timeout alone only when the work is genuinely large and the hand-off says so. Never touch a running topic's hot files (`pnpm backlog prd list`: test-health-2's `vitest.config.ts`, `apps/web/test/`, sync paths, `router.int.test.ts`, `roundtrip.spec.mjs`, `sync-matrix*`; symptom-catalog's timeline paths and `components/quick-entry/`). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain. Not in this wave: B-375 (touches `vitest.config.ts`, test-health-2's), B-667 (a seeded onboarding user: a fixture, not a flake; a later wave).

### Slice 31: re-measure the under-load flakes after B-607 (B-479, B-480, B-485, B-488, B-489, B-490, B-491, B-493, B-494, B-495, B-496, B-497, B-498, B-499, B-500, B-501, B-502, B-568, B-633, B-645, B-653, B-658, B-716, B-727, B-743)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/loop.md, docs/agents/machinery.md · Tests: none (measurement only)

Each item is a component, integration or browser-check test that failed under load and passed alone. Many may be gone since B-607 (the component harness's settle) and the tooling load fixes of waves 1–4.

- **Change no code or test.** For each item, run the test's file at check-like load: the named files together, at the Vitest project's usual workers, **at least 10 times**, while a second process keeps the machine busy (e.g. a concurrent `pnpm test:tooling` or the other files of the same project; no new dependencies). Quarantined tests (`scripts/ci/quarantine.txt`: B-568, B-633, B-645, B-653, B-658, B-743) run with `CARETOOK_QUARANTINE=run`. Record the load (`uptime`) for each round.
- B-716 (phase2) and B-727 (ui.spec) are browser checks: run `pnpm prd browser` for that one check 5 times under the same load, if the slice can take a browser lease; else say so and leave them unmeasured.
- B-479 and B-743 are the same test (calendarCron): measure once, report both.
- Hand-off: a table with Item | Test | Runs | Failures | Load | Failure message (first line) | Proposal (`close`: no failure in all runs; `fix`: failed, with the cause if the message shows it). Nothing is closed by the slice; the orchestrator files the proposals.

### Slice 32: stack.test.mjs's 'gc removes it only after a yes' holds under load (B-740)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/stack.test.mjs` 'flags a merged slice, not a fresh one, and gc removes it only after a yes' times out at 20 s at load ~60, passes alone 3/3 at load 18.

- Find where its time goes (git repos and worktrees made per test, node starts, `prd list` calls, the load gate, real sleeps) and show it; cut that cost (a shared fixture repo made once, fewer process starts, the load gate off in the test env) so it passes well inside its timeout at any load. Keep the assertions.
- Unit test: the same assertions, with before/after times in the hand-off.

### Slice 33: ask.test.mjs's countdown is read from a fixed now (B-741)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/ask.test.mjs` 'asks shows the countdown…' (~236) expects 'in 30m' and gets 'in 29m' for an ask 1 s old: the countdown rounds the real clock.

- Show the rounding race from the code (`asks` reads the real `Date.now()` after the ask is written); drive the listing from a fixed now (the clock override the ask tools already use, or one added the same way) so the countdown is exact; check the rounding the user sees (minutes up or down) is what the doc says.
- Unit test: the same assertion on a fixed clock, plus a case 1 s and 59 s past a minute boundary.

### Slice 34: lease.sh leaves no lease behind after a TERM mid-take (B-742)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/lease.sh`: a TERM between a lease's `mkdir` and the `lease_path=` assignment leaves the lease directory behind, since the trap only removes `$lease_path`.

- Close the window: set the path before the `mkdir` (the trap removes it only if this process made it, e.g. an owner file with its pid), or take the lease into a temporary name and rename; show the old order and the new in the hand-off.
- Unit test: a TERM delivered in that window (a test hook that pauses between the two steps, waited on by a marker, never a sleep) leaves no lease; the existing 'TERMed mid-check' test still passes.

### Slice 35: load-gate.test.mjs's 'the scripts that wait or warn' tests don't race (B-744, B-745, B-746, B-747)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

All four tests of `scripts/loops/load-gate.test.mjs`'s 'the scripts that wait or warn' block flaked together in one CI run (passed on the rerun); they're quarantined (`scripts/ci/quarantine.txt`).

- Find the shared cause from the code (a real load read, a real-time poll or sleep, the fake load file written while a script reads it, a shared temp dir across the block, the CI runner's own load) and show it; the tests wait on each script's state, never on a fixed sleep, and read only a fake load.
- Unit test: the four tests pass with `CARETOOK_QUARANTINE=run` 20 times in a row at load; the hand-off says whether their quarantine lines can go (the orchestrator removes them through `pnpm prd ci` when the items are done).

### Slice 36: tidy-cli.test.mjs's beforeAll holds under load (B-461, B-732)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

`scripts/loops/tidy-cli.test.mjs` 'tidy archives finished items' beforeAll times out at 10 s at load 30–40 (passes alone 12/12), after B-460 turned the load gate off in its setup.

- Measure where the beforeAll's time goes (repos, worktrees, `new.sh` runs, backlog writes, node starts) and show it; cut it (one fixture built once and copied, fewer process starts) so it stays well inside 10 s at load 40, or say why the work is genuinely large and set a timeout with a comment.
- Unit test: the same assertions, with before/after times in the hand-off.

### Slice 37: session requests raise their .seq only upward (B-731)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/session-requests.mjs` raises `.seq` check-then-rename, as `notices.mjs` did before B-526, so two concurrent requests can lower it and reuse an id.

- Apply B-526's fix (`notices.mjs`'s high-water mark as `.seq.d/` files that only move up), sharing its helper rather than copying it where that's simple; old `.seq` files still read.
- Unit test: concurrent requests never reuse an id or lower the mark (driven by a barrier, not sleeps), and an existing `.seq` is carried over.

### Slice 38: a waiting join request from an account with no current legal acceptance isn't asked again (B-638)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/care-groups.md · Tests: integration

`careGroupInviteService`'s `askWithLink` returns a waiting request before the legal check, but the test 'a waiting request isn't asked again' sends `legal: true` with a current row, so nothing pins that order.

- No code change unless the test shows a bug. Integration test in `packages/data/src/services/careGroupInvite.int.test.ts`: an account with a waiting request and no current legal acceptance asks again with the link and gets its waiting request back (no new row, no legal refusal); all data fictional.

### Slice 39: a slim, fast inbox session (B-739)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/inbox.md, docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

Added to wave 5 on the user's word (via the backlog session, 2026-11-24); inbox-agent is done, so its files are free. The goal is speed: the user talks at the phone to manage the inbox.

- **Sonnet at low effort:** the inbox session opens on Sonnet at low effort, set in the session's own settings file (`prd.sh`'s inbox default model; `--model` still overrides); fast mode stays off. It holds across `prd rotate`, a phone hand-off (`prd rotate --self`) and a keep-alive reopen, **with no dispatcher restart**: `open-session.mjs` reopens on the session's recorded model, so an old record saying opus must give way to the new default (or the rotation rewrites the record).
- **The prompt** (`prompt.sh`'s inbox prompt): only add, reword, move or remove unfiled lines on the user's word; never read the backlog, no separate `pnpm backlog similar` step before an add, no extra work. Dedupe and triage stay with ingest, the backlog session and the planner.
- **Keep `inbox add`'s look-alike stop** (exit 3, rerun with `--anyway` on the user's word); `backlog add` is unchanged.
- **New commands:** `pnpm backlog inbox edit` and `pnpm backlog inbox remove` for unfiled lines; they refuse filed lines, as `inbox move` does.
- Unit tests: a keep-alive reopen and a rotation of an inbox session recorded on opus come up on Sonnet low; `--model` still wins; the prompt names no backlog read or `similar` step; `inbox edit`/`remove` change an unfiled line and refuse a filed one; `inbox add` still stops on a look-alike.
