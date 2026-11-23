# Plan: Test gates 2, the staging and main gates

PRD: [test-gates-2-prd.md](test-gates-2-prd.md). Items B-532, B-533. Starts after `test-gates`.

## Status

| Slice                                          | Wave | State                     | Merge    |
| ---------------------------------------------- | ---- | ------------------------- | -------- |
| 1. The browser suite runs in CI                | 1    | landed 06309608 (PR #118) | e3169ce8 |
| 2. Browser results, reruns and flakes          | 2    | landed b55e4413 (PR #120) | 186a23c3 |
| 3. A release candidate                         | 3    | landed ce792df3 (PR #122) | 22dc1231 |
| 4. Promotion refuses what isn't passing        | 3    | landed ce792df3 (PR #122) | c9670a4c |
| 5. The release tier                            | 4    | landed 4160dee5 (PR #127) | 55abe5cd |
| 6. The required check on main and its override | 5    | started (opus)            |          |

**Landing mode:** run everything through (started run-through): start every ready slice, land each green wave, clean up, ask only real questions through `pnpm prd ask`.

**Now:** wave 4 landed in `dev` as 4160dee5 through PR #127 on the user's word, **without a Codex review (out of credits)**. `full` run 45237050708 green on e011122e. Slice 5's `release` run 45224003205 on ef58007e has a green verdict (11 of 11 browser checks, three times, 12 minutes); GitHub shows it red because the report-only zone jobs fail by design. Its 17 New York failures are filed: B-706 to B-715, and the other 7 files on B-372 (`roundtrip`, on the brake list, is among them). Local `phase2` was FLAKY at load 60 to 70 (B-716). Slice 5's worktree is removed and the runbook has the release tier. B-533 stays open for slice 6.

**Wave 5 (2026-11-23):** synced dev at 54194267; slice 6 worktree made, opus agent spawned, told to make **no real CI run, `release-gate` status, PR or override** until the orchestrator passes on the wave 5 CI approval (ask being filed). No staging to main PR is open, and none may be opened for this.

**Next:** get the wave 5 CI approval, then let slice 6 do its real run and status. The user's "skip rechecks after a clean sync" was for wave 4 only, so wave 5 rechecks after each sync unless they repeat it. A local browser check that repeats a CI browser run on the same code adds little: the user questioned it in wave 4, and the handbook rule is unchanged.

**For slice 6:** call `zone-file` from `pnpm prd ci release`; nothing calls it yet, and it has never run against the real backlog before this wave.

**Docs:** `docs/agents/machinery.md` is 10 bytes over budget already, so don't grow it. `docs/agents/orchestrator.md` has about 35 bytes left.

**Open from slice 4:** B-681 (promotion prints a passing flake's tests but doesn't file them) is proposed for this topic. `gh pr merge` can't pin the base, so staging moving between promote's ancestor check and its merge isn't caught. The real `gh pr merge` and `gh pr view` calls stay unexercised until the user's first real promotion.

**For slice 5:** reuse `runBrowserJob` and `summarizeBrowser` for repeat runs. **For slice 6:** reuse `releasePasses(v, tier, sha)` in `scripts/ci/gate.mjs`, which already refuses a `flake` with a brake-list test.

**CI approval:** each wave needs its own. a140 covered wave 2, and a144 (the user's yes) covered wave 3's runs and its one real candidate only. **Wave 4 is approved: a147 (skeptic s13), the user's yes**, for the slice's `release` run, reruns after a fix and the wave's gate run, each `release` run filing at most 10 `fixes-bug` items. It covers no real candidate or promotion, and **wave 5 needs its own ask**. Slice 5 must fit three suite runs past the `browser` job's 35-minute limit. The permission classifier denied agents' `pnpm prd ci run` until the user allowed it; never work around a denial.

**For slice 2 and later:** `pnpm prd ci blame` requests a run on `dev`, so it couldn't place a candidate failure until `dev` had the tier (it does now). The later roundtrip steps passed on Linux, but the refused-upload queue counts are timing-sensitive.

## Architectural decisions

- **CI checks, the Mac decides** (from test-gates). The workflow uploads a verdict. Branches, statuses, filings and PRs are written on the Mac by `pnpm prd ci`.
- **No new trigger.** `ci.yml` still runs only on a push to `ci/**`. No `pull_request`, no secret.
- **One tier list, one verdict format.** `candidate` and `release` extend both.
- **A gate reads a whole-tier verdict on the exact commit.** A narrowed run, a verdict for another commit or an expired artifact never passes.
- **Both gates pass on `green`, and on `flake` with nothing flaky on the brake list.**
- **All commands and their help sit under `pnpm prd ci`**, in `scripts/ci/`. Don't edit `scripts/loops/prd.sh`, `land*` or `lib.sh`.
- **One zone setting** is read by the component tests, the Playwright config, the fixtures and the server. CI's primary jobs use America/Los_Angeles.
- **No tool edits a GitHub ruleset.**
- All test data and env are fictional, generated in the workflow.

## How to run this plan

- **Waves:** 1: slice 1. 2: slice 2. 3: slice 3, then slice 4 on top of it. 4: slice 5. 5: slice 6.
- Each wave is proven by a real requested run from the slice's branch.
- **Hot files:** `.github/workflows/ci.yml`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `scripts/browser-checks/`, `scripts/loops/browser.sh`, `scripts/loops/serve.sh`, `vitest.config.ts`, `ops/runbook.md`.
- **The user's step after slice 6:** add `release-gate` to the main ruleset, once a real green status exists, with "require branches to be up to date" off.

## Slice 1: The browser suite runs in CI

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md, ops/runbook.md · Tests: unit

**User stories:** US 2.

**Build:**

- The `candidate` tier, including everything in `full`.
- A browser job with its own limit of about 30 minutes and a job-level result (a failed job already reads as `file`).
- The job starts the Docker stack from the existing compose file, generates the fictional env (PowerSync, mail, invite key and build variables, which the env script lacks), then migrates, seeds, builds and serves the app itself, because the runner's server start does nothing outside a loop worktree.
- The server listens where PowerSync's container can reach its JWKS: on Linux `host.docker.internal` is the bridge address, and the check server binds 127.0.0.1.
- The server and runner run in America/Los_Angeles.

**Acceptance criteria:**

- Unit tests cover the tier's jobs and the env script's new variables.
- `workflows.test.mjs` covers the job and still refuses a `pull_request` trigger or a secret in `ci.yml`.
- A requested `candidate` run of the slice's branch ends with a verdict. It is green, or each Linux-only failure is filed and linked in the hand-off, with the job's time.
- A requested `full` run starts no browser job.

**Blocked by:** test-gates. **Blocks:** 2.

## Slice 2: Browser results, reruns and flakes

Stack: no · Reads: docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 2, 7.

**Build:**

- Each check's result reaches the verdict by name.
- A failed check reruns once in the job. A pass on the rerun, or the runner's FLAKY, is a `flake`. Browser flakes are filed, never quarantined.
- The brake list learns check names, and lists `first-sync`, `roundtrip`, `layout-offline`, `session-end` and `live-notes`.

**Acceptance criteria:**

- Unit tests: a pass, a failure, a rerun pass, FLAKY, and a flake on and off the brake list.
- A requested run with a check forced to fail once and then pass reads as `flake`, linked in the hand-off.

**Blocked by:** 1. **Blocks:** 3, 5.

## Slice 3: A release candidate

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 1, 5.

**Build:**

- `pnpm prd ci candidate cut [<commit>]`: an `rc/<yyyymmdd-hhmm>` branch from a dev commit (dev's tip by default) with a `merge -s ours` of staging under a Conventional subject, pushed, with its PR into staging opened and its `candidate` run requested. One open candidate at a time.
- It refuses when staging holds a non-merge commit that isn't in dev, by patch or by its `cherry-picked from` trailer, and names the commit.
- `pnpm prd ci candidate fix <commit>`: `cherry-pick -x` of a `fix` commit already in dev (`-m 1` for a landing's merge commit), then a new run. Anything else is refused; a conflict aborts and refuses.
- `pnpm prd ci candidate status`: the candidate's commit, base and verdict.

**Acceptance criteria:**

- Unit tests on temp repositories: the cut's tree equals the dev commit; a staging holding a cherry-pick dev later changed still merges cleanly; the staging-only refusal; the second-candidate refusal; refusing a non-`fix` commit or one not in dev; a merge-commit fix; a conflicting fix.
- A real candidate is cut and its run linked in the hand-off, then its PR closed unmerged and the branch deleted.

**Blocked by:** 2. **Blocks:** 4.

## Slice 4: Promotion refuses what isn't passing

Stack: no · Reads: docs/agents/orchestrator.md, ops/runbook.md · Tests: unit

**User stories:** US 3, 4.

**Build:**

- `pnpm prd ci promote`: reads the verdict on the candidate's tip, refuses unless it passes, merges the PR with a merge commit and deletes the candidate.
- The hand-off lists the doc changes: the interim "request a `full` run" rule and orchestrator.md's _The backstop_ go; the runbook's "staging takes PRs from `dev`" lines change to candidates; the handbook says agents never merge a candidate any other way and that the user's hand merge is the override.

**Acceptance criteria:**

- Unit tests: a refusal for each verdict kind, a brake-list flake, a stale commit, a narrowed verdict, an expired artifact and an unreachable GitHub; a passing flake merges.
- No real merge into staging in this slice: the merge path is proven by fixtures and the first real promotion is the user's.

**Blocked by:** 3.

## Slice 5: The release tier

Stack: no · Reads: docs/agents/machinery.md, docs/domain/components.md · Tests: unit

**User stories:** US 7, 8.

**Build:**

- The `release` tier: the browser suite three times, and the component tests and suite in America/New_York through the one zone setting.
- Repeat results read by the verdict: failing in all runs blocks; failing in some is a flake.
- A committed second-zone setting, `report` (the default) or `block`. On `report`, failures can't fail the verdict and are filed one `fixes-bug` item per test file, at most 10 a run, with the rest as a note on B-372.

**Acceptance criteria:**

- Unit tests: repeat classification, a brake-list flake, second-zone `report` and `block`, one filing per file and the cap.
- A requested `release` run ends with a verdict; the hand-off links it and gives its time and second-zone failures.

**Blocked by:** 2. **Blocks:** 6.

## Slice 6: The required check on main and its override

Stack: no · Reads: docs/agents/orchestrator.md, ops/runbook.md · Tests: unit

**User stories:** US 6, 9.

**Build:**

- `pnpm prd ci release`: runs the `release` tier on the head of the open staging to main PR and writes the `release-gate` status from the verdict. With no open PR it refuses and says how to open one.
- `pnpm prd ci override <commit> --reason "…"`: refuses without a terminal or in a recorded agent session (`CARETOOK_SESSION_NAME`); needs the typed short commit; writes `release-gate` as passing with `OVERRIDE` in its description; leaves a PR comment and a notice. Its prompt warns that the reason is public.
- The hand-off lists the doc changes: the runbook's ruleset step (the check from any source, "require branches to be up to date" off) and the override; handbooks forbid agents from writing `release-gate` any other way.

**Acceptance criteria:**

- Unit tests: the status for each verdict kind, a verdict for another commit, no open PR, and each override refusal.
- A real `release-gate` status is written on a test commit, linked in the hand-off. No ruleset is changed.

**Blocked by:** 5.
