# PRD: Check speed (fewer full runs, shorter full runs, and a record of both)

> Topic `check-speed`. Backlog: B-271, B-272, B-273, B-278 (moved here from `test-health`). Plan: [`plans/check-speed-plan.md`](check-speed-plan.md).

## Problem Statement

Testing takes most of the wall time of every slice and every landing. The numbers below come from the session transcripts of five PRDs run on 2026-11-20 and 2026-11-21 (`planner-2`, `list-filters`, `quick-entry`, `tasks-2`, `quick-fixes`) and from timing each Vitest project alone on 2026-11-21 at a load of 11 to 25 on 10 cores.

- **A full test run takes about 11 minutes** (median 665 to 680 s over 522 files; the slowest took 48 minutes). The 294 unit files take about 30 s of it. The 27 tooling files take 53 s. The 86 integration files, run one at a time, take 212 s. The 115 component files take the rest, about 6 minutes (inferred, not measured alone).
- **It runs far more often than once per landing.** The five PRDs made 39 separate full runs, 501 minutes in all. `planner-2`'s first wave, two slices, took 8 full runs and 90 minutes. Each slice runs a bare `pnpm check` before hand-off, often twice, and the orchestrator runs it again at the gate and after each sync.
- **Most full runs fail.** 24 of the 39 had at least one failing file. Some failures were real, from work in progress. The repeat offenders were not: the tooling test `scripts/loops/browser.test.mjs` failed in 10 sessions, and the connector's MCP integration tests failed 14 times.
- **Bare checks bypass the lease.** `pnpm prd check` holds one of three check leases; a loop's `pnpm check` holds none, so a wave of loops finishing together runs every suite at once. The 5-minute load stayed between 18 and 23 for a whole afternoon with two PRDs running.
- **Nothing records how long a check took.** These numbers had to be dug out of transcripts.

The `test-health` PRD already proposed four fixes for this (B-271, B-272, B-273, B-278) inside a 19-slice plan built from a static review. They are small, unblocked and pay back on every later slice, so they move here to run first, changed where the measurements disagree with that plan.

## Solution

- **Every check goes through the check lease**, loops included, and **two run at once**, not three.
- **No load gate.** `test-health` planned to hold a check while the 5-minute load is 16 or more. The load was above that all afternoon, so every check would have waited out its timer and then run anyway. This PRD limits how many checks run instead, and records the load of each so the question can be asked again with data.
- **Every check is timed and logged**: when, which worktree, quick or full and why, seconds, the load at start and end, pass or fail.
- **Quick at hand-off, full once per landing.** A loop hands off on a quick check (typecheck, lint, format and the tests related to its diff). The tooling forces a full check when the diff touches a migration, seeds, the sync config, the lockfile, a `package.json` or the Vitest config. A quick check always adds the tests that read files by path.
- **A quick check that isn't quick says so.** When the tests related to the diff are more than half of all test files, the check prints that and the count, so a shared-file change is visible in the log.
- **Agent-tooling tests leave `pnpm check`** for their own Vitest project, which `pnpm prd check` adds when the diff touches the tooling.
- **Integration tests run on three workers**, each with its own database.

## User Stories

1. As the dev keeper, I want every check on the machine to take a check lease, so that a wave of loops finishing together doesn't run every suite at once.
2. As a loop, I want my hand-off check to queue for a lease by itself, so that I don't need to know what else is running.
3. As the dev keeper, I want two checks at once by default, changeable by an environment variable, so that the limit can follow the hardware.
4. As the dev keeper, I want every check's duration, mode, reason, load and result appended to one log, so that I can see what testing costs without reading transcripts.
5. As the dev keeper, I want `pnpm prd check --times` to summarise that log (runs, median and total minutes, failures, by mode and by PRD), so that I can tell whether a change helped.
6. As a loop, I want to hand off on a quick check, so that my slice doesn't pay for the full suite.
7. As an orchestrator, I want wave gates to be quick checks and the full check to run once per landing, so that a wave runs the full suite once.
8. As an orchestrator, I want the tooling to force a full check when the diff touches a migration, seeds, the sync config, the lockfile, a `package.json` or the Vitest config, and to say why, so that I can't choose quick by mistake.
9. As the dev keeper, I want a quick check to always run the tests that read files by path, the check-areas lint and the docs budget, so that "related to the diff" has no blind spot.
10. As the dev keeper, I want a quick check to print how many test files it ran out of how many, and to warn when that is more than half, so that I know when quick isn't.
11. As the dev keeper, I want the decision of what a check runs to live in one pure, tested module, so that the rules can't drift between scripts.
12. As a loop working on app code, I want the agent-tooling tests out of my check, so that I don't wait for, or fail on, tests of scripts I didn't touch.
13. As a loop working on tooling, I want `pnpm prd check` to add the tooling tests when my diff touches the tooling, so that I can't skip them.
14. As the dev keeper, I want `pnpm test:tooling`, so that I can run the tooling tests on `dev` after a small tooling change.
15. As the dev keeper, I want the sync matrix, check-areas, deploy and build tests to stay in the default run, so that app changes are still guarded by them.
16. As a loop, I want integration files to run on three workers, so that the integration project takes less than half the time.
17. As a test author, I want each worker to have its own database, so that a test that wipes a table can't break a file running beside it.
18. As the dev keeper, I want a worktree's worker databases dropped when the worktree is removed, so that the shared test Postgres doesn't fill up.
19. As the dev keeper, I want one worker to behave as today, so that I can rule parallelism out when debugging.

## Implementation Decisions

**The lease and the log**

- A loop's check is `pnpm prd check`; the slice prompt and the handbooks say so. `CARETOOK_CHECK_SLOTS` defaults to 2.
- `prd.sh check` appends one tab-separated line per run to `.loops/.check-times.log`, pass or fail: start time, worktree, branch, mode, reason, seconds, load at start, load at end, exit code, and for a quick check the test files run and the total. The log is machine-local and untracked, like `.browser-flakes.log`.
- `pnpm prd check --times [--since <date>]` prints the summary. The parsing and the summary are a pure module with tests.
- No load gate. The log's load columns are the evidence for adding one later.

**Check plan (new, pure module behind `pnpm prd check`)**

- Input: the changed files against the base, and the mode asked for. Output: the mode to run (quick, or full with the reason), the always-run list, and whether the tooling project joins.
- Forced full: a migration, seeds, `powersync/sync-config.yaml`, the lockfile, any `package.json`, `vitest.config.ts`.
- Always-run on a quick check: the tests that read files by path (the sync matrix, the layout tests, the security-header test, the error-registry tests), the check-areas lint and the docs budget. The build budget stays in the full check.
- The tooling project joins a quick or full check when the diff touches `scripts/loops/`, `scripts/backlog/` or `.githooks/`.
- A loop's hand-off check is `pnpm prd check --quick "<why>"`. The check still needs a clean tree, so a loop commits, checks, and fixes in further commits.
- **Full once per landing:** the orchestrator runs the full check on the wave's tip before its PR. That is the handbook's rule, not enforced by the tooling. The existing rules that call for a full check (a conflict resolved in code, both sides changing a hot file, or when unsure) stay.

**Vitest projects**

- `tooling:unit` holds the loop, backlog and hook tests, with the 20 s timeout. `scripts:unit` keeps the sync matrix, check-areas, the manifest test, the deploy and build tests, and this PRD's new pure-module tests.
- `pnpm test` (and so `pnpm check`) leaves `tooling:unit` out; `pnpm test:tooling` runs it.

**Worker databases**

- The integration project runs files in parallel on `CARETOOK_INT_WORKERS` workers (default 3); `1` gives today's order.
- Each worker's database is `<worktree database>_w<n>`. The global setup clears and migrates one and makes the others from it as a template where Postgres allows, else migrates each.
- The guard that refuses any database but a local test one accepts the worktree's own suffixed names and nothing else. Removing a worktree drops all of its databases.
- No test file changes.

## Testing Decisions

- A good test here checks what the tooling decides or does, through its command or its pure module, not how the script is written.
- **Pure modules get unit tests** in `scripts:unit`: the check plan (each forced-full trigger, the always-run list, when tooling joins, an empty diff, that every always-run path exists) and the times summary.
- **The lease and the gate get tooling tests** beside `check-gate.test.mjs` and the lease tests, in `tooling:unit`: two slots by default, a quick check on a migration diff records `full`, a failed check still writes its log line.
- **The worker databases get a resolver unit test and one tooling test** (a removed worktree drops them all), and the proof is the integration project passing twice with three workers and once with one.
- **Each slice's hand-off gives before and after times** for what it changed, taken from the new log where it exists.

## Out of Scope

- **The component tests' own time**, the largest part of a full run. Their harness, cuts and migration stay in `test-health`. If the log shows quick checks still running most component files, that is a new item.
- **A load gate.** Decided against until the log says otherwise.
- **The rest of `test-health`:** the harness, the lint rules, the cuts, the browser-check bookkeeping.
- **The repeat flakes** (the MCP integration tests' dropped connections, `todoRename.int.test.ts`): `quick-fixes` items. `browser.test.mjs` leaves the app check with the tooling project; fixing it is a follow-up.
- **Codex review.** A round takes about five minutes and four of six PRD pull requests had no findings: not a time problem.

## Further Notes

- The measurements were taken on a loaded machine and by reading transcripts: a failing run may be real work in progress, and the component project's time is inferred. The log this PRD adds replaces them.
- `test-health` keeps its other slices; its slice 11 waits for this PRD's worker databases to be in `dev`.
