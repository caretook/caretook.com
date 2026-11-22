# PRD: Test gates

Backlog items B-341 (CI on PRs into dev), B-528 (the rapid-mode landing gate), B-529 (dev red, by kind), B-530 (flake quarantine), B-531 (test-gate modes). B-532 (the staging candidate) and B-533 (the staging to main gate) are the follow-on topic `test-gates-2`. Planned inline by the backlog session on 2026-11-22, from the user's tiers-and-modes idea.

## Decisions

| Decision                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                                                                                                                      | Source                                                        | Cost to change later                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| In rapid mode a landing into dev needs only the quick check, plus the changed browser checks and Codex. There's no local full check, and the quick check stops escalating to full for migrations, seeds, sync config, the lockfile, a `package.json` or the Vitest config. This switches on only once dev's CI verdict is read and can brake (slice 5, after slice 3)                                 | 35% of local checks failed since 2026-11-21, nearly all load flakes; CI on dev catches the rest minutes after the merge                                                                  | asked: recommended quick + escalation, chose quick only       | medium: one rule in the check plan and the orchestrator doc |
| CI runs the full check on GitHub Actions on every push to dev and every PR into dev, staging and main. That's `pnpm check`, the tooling tests, the build budget, `build:native`, and B-341's grep of the built client for `caretookSync`. A push whose files are all Markdown or backlog files is skipped (`paths-ignore`)                                                                            | the repo is public, so standard runners cost nothing; clean runners don't flake from three orchestrators sharing a machine; 148 of 826 dev commits since 2026-11-21 were backlog commits | assumed                                                       | low                                                         |
| The verdict travels as a run artifact (`actions/upload-artifact`, pinned to a commit SHA), the one new third-party action                                                                                                                                                                                                                                                                             | the Mac needs the verdict as data, not log text                                                                                                                                          | asked: as recommended                                         | low: swap for a check-run summary                           |
| The PR run is advisory in rapid mode and runs only static and unit; in pre-deployment mode it runs the full check and is required. The dev push run decides dev red                                                                                                                                                                                                                                   | rapid mode keeps the Codex wait as the only wait, and halves CI use                                                                                                                      | asked: as recommended (2026-11-22, for the concurrency limit) | low                                                         |
| GitHub Free allows 20 concurrent jobs for the whole org (extra jobs queue). A run is about 5 jobs: static, unit (the six small Vitest projects together), integration, components and build, with the verdict as the build job's last step; shard only a job past 10 minutes. A newer dev push replaces one still queued, never a running one. Artifacts are kept 7 days                              | three orchestrators landing at once would otherwise queue and delay the verdict that brakes dev; 500 MB of artifact storage                                                              | asked: as recommended (2026-11-22)                            | low                                                         |
| Dev red is decided by kind, after one rerun of the failed test files. **Brake:** format, lint, typecheck, build, or a failing test on the brake list. **File:** a real failure anywhere else. **Flake:** the rerun passes. **Infra:** a job failed before any test ran (install, service container, runner). Infra never brakes: the failed jobs get one automatic rerun, and the failure is reported | a brake breaks every topic that syncs dev; an area failure doesn't; a flake or an outage shouldn't stop anyone                                                                           | asked: as proposed (the skeptic added infra)                  | low                                                         |
| The brake list is globs plus named test files: the sync and offline tests, the role-by-action matrices and permissions tests, the privacy and connector-leak tests, and the migration and seed tests. An area's own RBAC test outside the list counts as **file**                                                                                                                                     | RBAC tests are spread through 93 integration files; only the matrices cover it whole                                                                                                     | assumed                                                       | low: a list                                                 |
| Attribution: a dev run names the landings since the last finished dev run (dev's first-parent merges between that run's commit and this one), so a run that replaced a queued push still names every landing. With one landing in the range, that's the culprit; with several, all of them are named                                                                                                  | `land` pushes dev (with backlog and local-landing commits) and then merges on GitHub, and queued pushes are combined, so one run isn't always one landing                                | assumed                                                       | low                                                         |
| Filing happens only on a transition: a test that newly fails gets one item; while it keeps failing, later runs add a note to that open item, never a new one. Filing lives in the CI reader (`pnpm prd ci`), so `land` and the dispatcher's tick both trigger it and a brake always has its item                                                                                                      | otherwise a red dev files an item per push, blamed on the wrong landing                                                                                                                  | assumed                                                       | low                                                         |
| A brake makes `pnpm prd land` refuse every landing except one that names the brake's item (`--fixes B-<n>`). A revert of the culprit landing counts as its fix. `--force` works on the user's word, as today                                                                                                                                                                                          | only the fix should land on a broken dev                                                                                                                                                 | asked: as proposed                                            | low                                                         |
| What each verdict files. A file verdict: a `fixes-bug` item against the culprit landing. A flake: a `fixes-tooling` item and a quarantine entry. A brake: a `fixes-bug` item marked as the brake. A flake on the brake list is filed but never quarantined                                                                                                                                            | the user's rule ("file", "quarantined, filed"); a quarantined sync race would fail silently                                                                                              | asked: as proposed                                            | low                                                         |
| Quarantine is a committed list of test file, test name and item. Vitest skips listed tests locally and in CI's main run; CI runs them in a separate step that can't fail the run. The tick adds entries and prunes those whose item is done, and pushes dev after each such commit                                                                                                                    | flakes keep their signal without blocking local quick checks or CI; a commit nothing pushes never reaches CI                                                                             | assumed                                                       | low                                                         |
| The mode is a committed one-line file on dev (`rapid` or `pre-deployment`), written and pushed by `pnpm prd mode <mode>`; CI and every tool read it                                                                                                                                                                                                                                                   | CI can read a file; a commit records who switched and when                                                                                                                               | assumed                                                       | low                                                         |
| Pre-deployment mode: the dispatcher starts and plans only rows flagged `launch` (a new registry flag). A landing waits for its PR's CI to pass **and** for dev's latest verdict to be green (B-531's "dev green"). The escalation to full comes back                                                                                                                                                  | the user's "reduce work to getting production deployed with green checks"                                                                                                                | assumed                                                       | low                                                         |
| No manual "dev test mode" where agents stop pushing dev. Instead, test-gates-2's candidate branch tests a fixed commit, and a brake stops landings when dev is really broken                                                                                                                                                                                                                          | a freeze idles three orchestrators to protect one PR                                                                                                                                     | asked: recommended a candidate branch, chose it               | low                                                         |
| B-532 (the staging candidate) and B-533 (the staging to main gate) move to the follow-on topic `test-gates-2`, after this one                                                                                                                                                                                                                                                                         | six slices is the size limit; tiers 3 and 4 need tier 2's verdict                                                                                                                        | assumed                                                       | low: registry order                                         |
| Required status checks: staging to main always; dev to staging only in pre-deployment mode. test-gates-2 sets them with `gh api`, with the user approving each change                                                                                                                                                                                                                                 | the user's pick; a branch-protection change is outward-facing                                                                                                                            | asked: as recommended                                         | low                                                         |
| CI's test env is fictional and generated in the workflow: a Postgres service container on the test port, generated secrets, `CARETOOK_LEASES=off`, and a git identity for the tooling tests. The check workflow reads no GitHub secret                                                                                                                                                                | no real data, and fork PRs can't read secrets anyway                                                                                                                                     | assumed                                                       | low                                                         |
| agent-autonomy is held after its wave 1 (the defaulting questions, the notice board); its waves 2 to 6 are rescoped against this plan before they run                                                                                                                                                                                                                                                 | most of what they optimise is the local full check this topic removes                                                                                                                    | asked: as recommended                                         | —                                                           |

**The skeptic pass (Fable)** found these, all fixed above and in the plan, none declined:

- A dispatched run can't prove a slice: GitHub's default branch is `staging`, where `ci.yml` won't exist yet.
- A push isn't always one landing.
- Filing once per run repeats while dev stays red.
- Commits that nothing pushes never reach CI.
- The rapid gate came before the brake.
- An outage would brake everything.
- RBAC has no directory to match.
- `workflows.test.mjs` and the integration setup constrain the workflow.
- The reader slice was too big.

## Problem

Landings wait on the local gate, not on review. A full check takes about 11 minutes and a quick one about 7.5, but 52 of 148 local checks since 2026-11-21 failed. Nearly every failure was a test flaking because three orchestrators, their slices and their browser checks share one 10-core machine, and one wave needed five full runs to land. Meanwhile nothing runs in CI at all: PRs into dev, staging and main have no checks, and the only backstop is the dev keeper's local browser suite.

## Solution

Move the long checks off the Mac and onto GitHub Actions, in tiers that get slower and stricter towards production:

| Tier | When                                            | What                                                              | Where             |
| ---- | ----------------------------------------------- | ----------------------------------------------------------------- | ----------------- |
| 0    | a slice hands off                               | quick check                                                       | local             |
| 1    | a landing into dev                              | quick check, the changed browser checks, Codex                    | local             |
| 2    | every push to dev (and, advisory, PRs into dev) | the full check, a rerun of failed files, the verdict              | CI (this topic)   |
| 3    | a candidate into staging                        | the lean browser suite on the Docker stack against a fixed commit | CI (test-gates-2) |
| 4    | staging into main                               | the full browser suite, a second time zone, repeat runs           | CI (test-gates-2) |

There are two modes:

- **Rapid**, the default: tier 1 is the only thing a landing waits for.
- **Pre-deployment**: launch work only, landings wait for green CI, the escalation to full returns, and staging requires green.

**Dev red** turns on by itself whenever tier 2 brakes, and stops every landing that isn't the fix.

## User stories

1. As the user, I want a landing to wait only for the quick check and Codex, so that topics land in minutes, not hours.
2. As the user, I want the full check to run in CI on every push to dev, so that a break is caught right after the landing that caused it.
3. As the user, I want PRs into dev to show a CI result, so that I and Codex can see it while reviewing (B-341).
4. As an orchestrator, I want a broken build or core failure on dev to stop other landings until it's fixed, so that I don't sync someone else's break into my branch.
5. As an orchestrator, I want an area failure on dev filed against the landing that caused it, without stopping me, so that it gets fixed without a freeze.
6. As the user, I want a test that passes on a rerun quarantined and filed, so that flakes stop blocking anyone but still get fixed.
7. As the fixes-tooling orchestrator, I want each quarantine entry to name its item and leave when the item is done, so that the list doesn't grow forever.
8. As the user, I want one command to switch between rapid and pre-deployment mode, so that the whole system tightens before a production deploy.
9. As the user, in pre-deployment mode, I want the dispatcher to run only launch topics and landings to wait for green CI, so that the work narrows to shipping.
10. As an orchestrator, I want `land` to tell me why it refuses during a brake and how to land the fix, so that I never need to ask.
11. As the user, I want a GitHub outage to report itself and retry, not freeze every landing.

## Implementation decisions

- **The CI workflow** (`ci.yml`) runs on push to dev and on pull requests into dev, staging and main.
  - Setup: the repo's setup action (Node 24 and pnpm from its pins), a Postgres service container on the test port, Playwright's Chromium with its system dependencies, and the fictional env.
  - Jobs:
    - static: format, lint, typecheck; the docs budget stays a warning.
    - unit: the six small Vitest projects (`tooling:unit` included) in one job; integration; components. Each uses the JSON reporter; a job past 10 minutes is sharded.
    - build: the build budget, `build:native`, and the `caretookSync` grep of the built client, then the verdict step, which writes and uploads the verdict file (kept 7 days).
  - In rapid mode a PR run has only static and unit. A newer PR run cancels the older one; a newer dev push replaces one still queued and never cancels a running one.
  - `scripts/deploy/workflows.test.mjs` and its YAML reader learn the new workflow's shapes (services, matrix, concurrency).
- **The verdict module** is pure and unit-tested. In: the jobs' results, the test results before and after the rerun, the brake list, the quarantine and the push range. Out: one verdict, `green`, `brake`, `file`, `flake` or `infra`, with the failing files and tests, the commit, the culprit landings and why.
  - A failed static or build job is a brake.
  - A job that failed before any test ran is infra.
  - A failing test on the brake list is a brake.
  - A test that fails and then passes on its one rerun is a flake.
  - Any other failure is file.
- **The rerun:** a test job that fails reruns only its failed files once, in the same job, and records both results.
- **The brake list and the quarantine** are committed lists next to the workflow, each with a comment header saying who writes it. The brake list is globs and named files (Decisions table). A Vitest setup skips quarantined tests unless CI's quarantine step asks for them.
- **Reading dev's CI** (`pnpm prd ci [--json]`): the latest dev push run's state, verdict and culprit landings, read through `gh`.
  - A run still going reads as `pending`, and the previous verdict holds.
  - When `gh` can't be reached, it reads as unknown, never green.
  - On a transition it files the items (Decisions table).
  - `land`, the dispatcher's tick and `pnpm prd status` all call it.
- **The dispatcher's tick** also:
  - adds quarantine entries for new flakes, and prunes entries whose item is done, pushing dev after each commit;
  - reruns an infra run's failed jobs once;
  - posts a brake's notice on the board (B-506).
- **The landing gate:** `land` reads `pnpm prd ci` first; on a brake it refuses unless `--fixes B-<n>` names the brake's item.
  - In rapid mode, `checked_ok` accepts a quick pass as today, the check plan no longer escalates, and the orchestrator doc drops "the full check runs once per landing".
  - In pre-deployment mode, `land` also waits for the PR's CI and needs dev green (exit 75 on its timeout), and the escalation returns.
- **The mode:** a one-line committed file, set with `pnpm prd mode [rapid|pre-deployment]` (with no argument it prints the mode). Writing it works like a backlog write (lock, one commit onto dev, then a push). The registry gains a `launch` flag, and in pre-deployment mode the dispatcher's pick skips rows without it.

## Testing decisions

- Unit tests cover:
  - the verdict module: every kind, the rerun, quarantine, infra and attribution;
  - the mode file's reader and writer;
  - the dispatcher pick's mode rule;
  - the filing's transitions: a test that keeps failing files once, then only adds notes.
- Prior art for those: `check-plan.test.mjs`, `dispatch-pick.test.mjs`, and `codex-review.test.mjs` (fixtures of `gh` output).
- `land.test.mjs` cases for the brake refusal and `--fixes`, and for pre-deployment's wait.
- The workflow is proven by runs on a draft PR from the slice branch into dev, then on the wave's PR and on the push that lands it. A `pull_request` run uses the head branch's workflow; a dispatched run can't, since the default branch is `staging`. `actionlint` isn't added.

## Out of scope

- The staging candidate, CI browser suites, the staging to main gate and required status checks: `test-gates-2` (B-532, B-533).
- Rescoping agent-autonomy's waves 2 to 6: its next planning session, against this plan.
- Fixing the flakes themselves: fixes-tooling.

## Notes

- The notice board is agent-autonomy wave 1 (PR #58). Slice 4 needs it in dev; if it isn't there, slice 4 waits.
- With quick only, a migration lands checked only by its related tests, and CI's full run on the dev push is its first full pass. Staging runs the migration only through the candidate in test-gates-2.
- The quarantine's Vitest setup touches `vitest.config.ts`, a test-health hot file; the registry's hot files keep the two apart.
