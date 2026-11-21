# Plan: Check speed

> Source PRD: [`plans/check-speed-prd.md`](check-speed-prd.md). User-story numbers (US) refer to it. Backlog items B-271, B-272, B-273, B-278. Topic `check-speed`.

## Status

**Where it stands:** planned (2026-11-21), not started. Nothing blocks it.

| Slice | Wave | State       | Merge into `prd/check-speed` (slice commits) |
| ----- | ---- | ----------- | -------------------------------------------- |
| 1     | 1    | not started |                                              |
| 2     | 1    | not started |                                              |
| 3     | 2    | not started |                                              |
| 4     | 2    | not started |                                              |

**Backlog:** B-271 closes with slice 1, B-273 with slice 2, B-272 with slice 3, B-278 with slice 4 (`pnpm backlog done` when each merges).

## Architectural decisions

- **No new dependencies, no migration, no app-code change.** Tooling, `vitest.config.ts`, `package.json` scripts and `packages/data/test/` only.
- **Checks through the lease.** From slice 1 on, every check is `pnpm prd check`, never a bare `pnpm check`. From slice 3 on, a loop hands off on `pnpm prd check --quick "<why>"`.
- **Two check leases** (`CARETOOK_CHECK_SLOTS`, default 2). **No load gate.**
- **The check log:** `.loops/.check-times.log`, one tab-separated line per run, written by `prd.sh check` whether it passes or fails: start time, worktree, branch, mode, reason, seconds, load at start, load at end, exit code, test files run, test files in all (the last two empty for a full run). Untracked and machine-local.
- **Check plan** is a pure `.mjs` module in `scripts/loops/` that `prd.sh check` calls: changed files and the asked mode in; the mode to run with its reason, the always-run list and "tooling joins" out. Forced full: a migration, seeds, `powersync/sync-config.yaml`, the lockfile, any `package.json`, `vitest.config.ts`.
- **Vitest projects:** `tooling:unit` (the `scripts/loops`, `scripts/backlog` and hooks tests) is outside `pnpm test`; `scripts:unit` keeps `sync-matrix`, `check-areas`, `checks`, `scripts/deploy`, `scripts/build` and this plan's pure-module tests.
- **Worker databases:** `<worktree database>_w<n>`, three workers by default (`CARETOOK_INT_WORKERS`; `1` runs files in order as today).
- **Loops never edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing (below).

## How to run this plan

- **Waves:** (1, 2) → (3, 4). Land each wave through its PR as it goes green.
- **Gates:** both waves change `vitest.config.ts` or `package.json`, so each gate is a full `pnpm prd check`, plus `pnpm test:tooling` once slice 2 is in. No browser checks: nothing here changes a screen, a flow or a spec (`pnpm prd browser --changed --base dev --list` should name none; run what it names if it does).
- **Shared files:** in wave 1, slice 1 owns `prd.sh`'s `check` and slice 2 owns `vitest.config.ts` and `package.json`; they share no file. In wave 2, slice 3 owns `prd.sh`'s `check` and `prompt.sh`'s check lines, slice 4 the `integration` block of `vitest.config.ts`, `packages/data/test/`, `testDatabase.ts`, `test-db.sh` and `rm.sh`.
- **Other PRDs:** when wave 1 lands, tell the running orchestrators at their next wave boundary that loops check with `pnpm prd check`; when wave 2 lands, that hand-offs are quick checks. A slice already running keeps its prompt.
- **Docs at landing (the orchestrator):**
  - Wave 1: `docs/agents/loop.md` (checks through `pnpm prd check`; the project list and `pnpm test:tooling`), `docs/agents/orchestrator.md` (two check leases in _Machine leases_ and _Capacity_; the check log and `--times`), the core's _Checks_ rule (the tooling's own tests are `pnpm test:tooling`).
  - Wave 2: `loop.md` (hand-off on a quick check; the worker databases), `orchestrator.md` (_The check gate_: quick wave gates, the full check once per landing, the forced list is the tooling's), `docs/domain/data-layer.md` (worker databases).
- **When it's done:** `test-health`'s slice 11 is unblocked; note it in that plan's _Status_.

---

## Slice 1: Loops check through the lease; two leases; every check is logged

Stack: no · Reads: docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-271. **User stories:** 1 to 5.

**What to build**

- `prompt.sh`: the slice prompt's `pnpm check` lines say `pnpm prd check` (the stackless line, the hand-off line, the `--continue` line).
- `CARETOOK_CHECK_SLOTS` defaults to 2 (`lease.sh`, `lease.mjs`, wherever the default lives).
- `prd.sh check` appends a line to `.loops/.check-times.log` when the run ends, pass or fail (the fields are in _Architectural decisions_; the two test-file fields stay empty until slice 3). Don't change what a check runs.
- A pure module in `scripts/loops/` that parses the log and summarises it: runs, median and total minutes and failures, by mode and by worktree's PRD. `pnpm prd check --times [--since <date>]` prints it and runs no check. Add it to `pnpm prd help`.
- No load gate.

**Acceptance criteria**

- [ ] Unit tests of the summary module: an empty log, a mixed log, `--since`, a malformed line skipped and counted.
- [ ] A tooling test: a passing and a failing check (a stub command) each append one line with the right mode and exit code; the default slot count is 2 and the environment variable changes it.
- [ ] The slice prompt's test shows a loop is told `pnpm prd check`.
- [ ] The tooling tests pass (`pnpm exec vitest run --project scripts:unit scripts/loops`) and prettier is clean on the changed files; the hand-off shows `pnpm prd check --times` after one real check.

**Blocked by:** nothing. **Blocks:** 3.

## Slice 2: Tooling tests in their own Vitest project

Stack: no · Reads: none · Tests: unit

**Backlog:** B-273. **User stories:** 12, 14, 15.

**What to build**

- A `tooling:unit` project in `vitest.config.ts`: the tests under `scripts/loops/` and `scripts/backlog/` and `scripts/hooks.test.mjs`, except the ones the default run keeps. Keep the 20 s timeout there.
- `scripts:unit` keeps `scripts/loops/sync-matrix.test.mjs`, `check-areas.test.mjs`, `checks.test.mjs`, `scripts/deploy/` and `scripts/build/`.
- `pnpm test` leaves `tooling:unit` out; a new `pnpm test:tooling` runs it. (Slice 3 makes `pnpm prd check` add it by diff.)
- Don't fix the tests themselves. `browser.test.mjs` failed in 10 recent sessions: say in the hand-off what you see of why, as a follow-up.

**Acceptance criteria**

- [ ] `pnpm exec vitest list --project scripts:unit` names only the kept files; `--project tooling:unit` names the rest; no test file is in neither.
- [ ] `pnpm test` runs no `tooling:unit` test; `pnpm test:tooling` runs them all and passes.
- [ ] `pnpm prd check` passes; the hand-off gives the test counts of both projects and the wall time of `scripts:unit` before and after (53 s for 27 files on 2026-11-21).

**Blocked by:** nothing. **Blocks:** 3.

## Slice 3: Check plan: quick at hand-off, forced full, the always-run list

Stack: no · Reads: docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-272; completes B-273's "run only when tooling changes". **User stories:** 6 to 11, 13.

**What to build**

- A pure check-plan module in `scripts/loops/`: `(changed files, asked mode) → { mode, reason, alwaysRun, tooling }`.
  - Forced full, with the reason naming the file: a migration, seeds, `powersync/sync-config.yaml`, the lockfile, any `package.json`, `vitest.config.ts`.
  - `alwaysRun` on a quick check: `scripts/loops/sync-matrix.test.mjs`, `apps/web/app/libLayout.test.ts`, the security-header test, the error-registry tests (and any other test you find that reads source files by path: list them), the check-areas lint and the docs budget.
  - `tooling` is true when a changed file is under `scripts/loops/`, `scripts/backlog/` or `.githooks/` (or is `scripts/hooks.test.mjs`).
- `prd.sh check`: compute the diff against the quick base (as today; a slice's base is its `BASE_BRANCH`), ask the module, print the mode and reason, and run it inside the lease. A quick check runs typecheck, lint, format, `vitest run --changed <base>` without `tooling:unit`, then the always-run list, then `tooling:unit` when asked. A full check runs `pnpm check`, `pnpm build:budget`, and `tooling:unit` when asked. The record file still says `quick` or `full`.
- **How quick it was:** a quick check prints the test files it ran out of the total, writes both to the check log, and prints a warning when it ran more than half.
- `prompt.sh`: a loop hands off on `pnpm prd check --quick "slice hand-off"`; the orchestrator lines say wave gates are quick and the full check runs once, on the wave's tip before its PR.

**Acceptance criteria**

- [ ] Unit tests of the module (in `scripts:unit`): each forced-full trigger with its reason; a plain app diff stays quick; the always-run list is returned for quick and not duplicated for full; tooling joins for each tooling path and not for an app path; an empty diff.
- [ ] A test that every path in the always-run list exists (so a rename can't empty it silently).
- [ ] `check-gate.test.mjs` (or beside it): a quick check asked on a diff with a migration records `full`; landing still accepts both records.
- [ ] `pnpm test:tooling` and `pnpm prd check` pass; the hand-off shows the output of one quick run (with its file counts and seconds) and one forced-full run, and the quick run's counts for a diff that touches one screen and for one that touches a shared `ui/` component.

**Blocked by:** 1, 2. **Blocks:** nothing.

## Slice 4: Integration: a database per worker

Stack: no · Reads: docs/domain/data-layer.md · Tests: integration

**Backlog:** B-278. **User stories:** 16 to 19.

**What to build**

- `vitest.config.ts`, `integration`: files in parallel on `CARETOOK_INT_WORKERS` workers (default 3); `1` keeps today's one-at-a-time order.
- `packages/data/test/globalSetup.ts`: make, clear and migrate `<database>_w<n>` for each worker (migrate one and create the others from it as a template where that works, else migrate each). Both the shared test Postgres and the main checkout's test database.
- The test database resolver (`packages/data/src/db/testDatabase.ts`) and `packages/data/test/setup.ts`: a worker connects to its own database, picked from Vitest's worker id; the guard accepts only the worktree's own suffixed names.
- `scripts/loops/test-db.sh` and `rm.sh`: `drop` and worktree removal drop every database of the worktree; `list` and `status` still read well.
- No `*.int.test.ts` changes. If a file fails only in parallel, it shares state outside the database: fix that or report it; don't serialise the whole project. The MCP tests' "Connection terminated" failures are a known flake (14 in recent sessions): report whether three workers make them more or less frequent.

**Acceptance criteria**

- [ ] `pnpm test:integration` passes with 3 workers twice in a row, and with `CARETOOK_INT_WORKERS=1`.
- [ ] A unit test of the resolver: worker ids map to distinct names; a name outside the worktree's own is refused; the production and dev databases are still refused.
- [ ] A tooling test (in `stack.test.mjs` or beside `test-db.sh`'s tests): removing a worktree drops all of its worker databases.
- [ ] The hand-off gives the integration project's wall time before and after (212 s for 86 files on 2026-11-21), and the setup time; `pnpm prd check` passes.

**Blocked by:** 2 (it follows slice 2's `vitest.config.ts` edit). **Blocks:** `test-health` slice 11.
