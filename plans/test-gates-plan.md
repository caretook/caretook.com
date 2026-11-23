# Plan: Test gates

The [PRD](test-gates-prd.md) covers:

- slices check only their own tests, and local checks say why they failed;
- CI runs only on request, in tiers the orchestrator picks;
- a run's failures are sorted by kind, and flakes are quarantined;
- a landing waits for the tier its orchestrator declared.

Items B-553, B-554, B-341, B-528, B-529, B-530, B-555, B-556, B-559, B-242, B-566, B-567, B-568, B-572, B-587, B-588, B-589, B-607, B-612. B-531 (modes) is dropped. B-532 and B-533 go to `test-gates-2`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions through `pnpm prd ask`).

**Done:** waves 1 to 6 are in dev (adce90ee PR #71, 5b724350 PR #74, da93fcfa PR #76, 2991461a PR #81, 3b09844b PR #90, d0fe52d8 PR #93). Wave 6 landed at tier `components` on run 45117253571 (`flake`, filed as B-619, likely a duplicate of B-492), Codex clean. Its docs are folded, its report is filed and worktree `test-gates-12` is gone.

**Now: wave 7 (slice 13, B-612, the default PRD cap from 3 to 4), the last wave. Slice 13 merged as 411fb7a9, B-612 marked done, docs folded; next the dev sync, the quick check, the requested run and the PR. Keep worktree `test-gates-13` until the verdict is green.** The backlog session asked for it on the user's word on 2026-11-23. The diff touches `lib.sh`, a browser-harness trigger path, so expect a proposal of tier `integration`, not `none`. fixes-tooling is held until this wave lands. Its landing report must say the running dispatcher keeps the old default until the user restarts it; never restart it. After it: `pnpm prd rm test-gates`, then `cd` to the main checkout and `pnpm prd end`.

**Open issues:**

- Filed in fixes-tooling: B-609 (stale check-gate text: `prd.sh` help, the hotfix prompt, the PR body and `ready`, dead `checked_ok`), B-610 (`resetStaging` flake, quarantined), B-568 (six quarantined tests), B-571, B-573, the context-limit items B-595 to B-598, B-623 (the check's "unhandled error" grep matches a passing test's title, so tooling failures never rerun) and B-624 (`browser.test.mjs` "passes a clean spec" fails under load; passed alone 3 of 3).
- `ci blame`'s file, status and infra-rerun paths have run mostly against fakes. The `ci/` ref deletion in `pnpm prd tidy` has not run against a real old ref.
- Slice 7 limits: "no rotation during a fix" and "a hand-off leaves no stack up" are prompt-only; a leftover `ci/` ref with no run blocks `rotate` until removed or `--mid-wave`; `gc`'s run-out hold has no `gc`-level test; `pnpm prd rm` doesn't check the hold.
- A flake verdict's GitHub run shows `success`: read the verdict, not the colour.
- `pnpm prd ci <branch>` reads only the exact tip, so it says unknown after a docs commit even though `land` keeps the verdict.

| Slice | Wave | State         | Merge into `prd/test-gates` (slice commits) |
| ----- | ---- | ------------- | ------------------------------------------- |
| 1     | 1    | merged (opus) | 98a36dd4 (5eb596a9)                         |
| 2     | 1    | merged (opus) | 34b157fb (80a35650)                         |
| 3     | 2    | merged (opus) | 39f87cf0 (f0645753)                         |
| 4     | 3    | merged (opus) | 6396b470 (be81f850, e68f8866)               |
| 5     | 4    | merged (opus) | 009275c5 (3a0324bc … 54c05411)              |
| 6     | 5    | merged (opus) | e82dc279 (64569315 … 68016f5c)              |
| 7     | 5    | merged (opus) | 490eb14a (e033b8f1, 0da30aed, 6dc62462)     |
| 8     | 2    | merged (opus) | ff6ac3c3 (7bd82c6f)                         |
| 9     | 3    | merged (opus) | f285f1a5 (3b4428f0, 3b752d2e, 21533389)     |
| 10    | 3    | merged (opus) | 7484100e (b5c9c6c6)                         |
| 11    | 5    | merged (opus) | e7cfad86 (d64c4d14, 105a9f38)               |
| 12    | 6    | merged (opus) | 6f01c446 (05f8c6ce)                         |
| 13    | 7    | merged (opus) | 411fb7a9 (3a435254)                         |

**Backlog:**

| Item  | Claim           | `done`          |
| ----- | --------------- | --------------- |
| B-555 | slice 1 starts  | slice 1 merges  |
| B-556 | slice 1 starts  | slice 1 merges  |
| B-341 | slice 2 starts  | slice 3 merges  |
| B-554 | slice 2 starts  | slice 6 merges  |
| B-529 | slice 4 starts  | slice 5 merges  |
| B-530 | slice 4 starts  | slice 5 merges  |
| B-528 | slice 6 starts  | slice 6 merges  |
| B-553 | slice 7 starts  | slice 7 merges  |
| B-559 | slice 8 starts  | slice 8 merges  |
| B-242 | slice 8 starts  | slice 8 merges  |
| B-566 | slice 9 starts  | slice 9 merges  |
| B-567 | slice 9 starts  | slice 9 merges  |
| B-568 | slice 9 starts  | slice 9 merges  |
| B-572 | slice 10 starts | slice 10 merges |
| B-587 | slice 11 starts | slice 11 merges |
| B-588 | slice 11 starts | slice 11 merges |
| B-589 | slice 11 starts | slice 11 merges |
| B-590 | slice 11 fix    | slice 11 merges |
| B-607 | slice 12 starts | slice 12 merges |
| B-612 | claimed         | slice 13 merges |

## Architectural decisions

- **CI checks, the Mac decides.** The workflow only runs checks and uploads a verdict file. Every write happens on the Mac, through `pnpm prd ci` and `pnpm backlog`: backlog items, quarantine entries, commit statuses. CI reads no GitHub secret.
- **Nothing runs unless asked.** The workflow's only trigger is a push to a `ci/**` ref, made by `pnpm prd ci run`. No `pull_request`, no push to dev, staging or main, no schedule.
- **One verdict format**, versioned (`version: 1`): the commit, the target commit, the run id, the tier, whether the run was narrowed and to which files, the kind (`green`, `brake`, `file`, `flake`, `infra`), and the failing jobs, files and tests before and after the rerun. The verdict module is pure; the workflow and `pnpm prd ci` share it.
- **A narrowed run never passes a gate.** It is a throwaway commit on top of the target that adds the file list, pushed to its own `ci/` ref; its verdict names the target and is marked narrowed. The gate, `pnpm prd status` and the commit status read only whole-tier verdicts.
- **Tiers include the ones before:** `static`, `unit`, `integration`, `components`, `full`. One list of them, read by the workflow, the check plan and the gate.
- **Committed lists** sit beside the workflow under `scripts/ci/`: the brake list and the quarantine. Each has a comment header saying who writes it. A commit that changes only those two lists is not dev drift and keeps a verdict, like a backlog commit.
- **`scripts/ci/` is tested and gated:** its tests join the `scripts:unit` project, and a diff touching `scripts/ci/` or the workflow proposes `full`. It is not "docs and tooling only".
- **One new action:** `actions/upload-artifact`, pinned to a commit SHA. No other new action or dependency (no `actionlint`). The setup reuses `.github/actions/setup`.
- **Slices list their doc changes in the hand-off; the orchestrator folds them at each landing** and trims what the fold replaces (`orchestrator.md` and `loop.md` have no room: under 400 bytes between them).
- The test env in CI is fictional and generated in the workflow (AGENTS.md, _Working rules_).

## How to run this plan

- **Waves:**
  1. slices 1 and 2 (1 touches the local check runner; 2 adds the workflow and the request; they share only additive `prd.sh` cases)
  2. slice 3, then slice 8 on top of it (both edit `ci.yml` and `vitest.config.ts`)
  3. slices 4 and 10 side by side, then slice 9 on top of 4 (9 needs the quarantine list)
  4. slice 5
  5. slice 11, then slice 6 on top of it, then slice 7, landed together
  6. slice 12 (the harness race, B-607), after wave 5 has landed
  7. slice 13 (the default PRD cap, B-612), after wave 6 has landed
- Waves 1 to 4 land under today's gate. **Wave 5 lands under its own new gate**, with a real `--tier full` run as the proof, and its landing notice tells the other orchestrators that the gate changed at their next sync.
- **Proving a workflow change:** a slice pushes its own commit to a `ci/` ref (`pnpm prd ci run`, or `git push origin HEAD:refs/heads/ci/<tier>/<name>` before the command exists), links the runs in its hand-off and deletes the refs. A pushed ref runs the workflow of that commit, so nothing needs to be in dev or staging first.
- **Hot files:** `.github/workflows/`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `packages/data/src/db/roles/syncConfig.ts` (the YAML reader the workflow tests use), `vitest.config.ts`, `scripts/loops/land`, `scripts/loops/check-plan`, `scripts/loops/check-body`, `scripts/loops/check-run`, `scripts/loops/check-times`, `scripts/loops/lib.sh`, `scripts/loops/prd.sh`, `scripts/loops/pr.sh`, `scripts/loops/prompt.sh`, `scripts/loops/tidy`, `scripts/loops/rotate`, `scripts/loops/browser.sh`, `scripts/loops/lease.sh`, `scripts/loops/stack-lib.sh`, `package.json`. These overlap:
  - fixes-tooling's scripts items: held until this topic lands (its wave 2 is in dev);
  - agent-autonomy (B-518) waits for this topic.
- Eight slices: the skeptic pass split the workflow slice in two, and the user added slice 8 (the Linux fix) on 2026-11-22 so the CI tiers can go green before landing. Slice 1 stays here, not in fixes-tooling, because it shares the check plan and check body with slice 6 and fixes-tooling is held for this topic.

## Slice 1: A local check says why it failed, stops at a limit and reruns a flake

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 1, 10.

**Build:**

- The check log gains two fields: the step that failed (typecheck, lint, format, unit, integration, components, tooling, build) and the failed test files. `pnpm prd check --times` adds failures by step and the ten test files that failed most.
- A check stops at a time limit (20 minutes for a slice or quick check, 40 for a full one, each overridable), kills its children and logs the step it was in.
- A test step that fails reruns only its failed files once, alone. A pass on the rerun passes the check and logs the files as flakes.
- The static steps get faster. Measure first (typegen runs in both lint and typecheck; three whole-repo passes run in series), then take what is safe: one typegen, and steps side by side where they share no output. No ESLint cache (unsafe with type-aware rules).
- A test that the quick check's base is where the branch left dev when no full pass is recorded, and a slice's is where it left its PRD branch.

**Acceptance criteria:**

- `check-run.test.mjs`: the log line carries the failed step and files; a check past its limit exits non-zero, leaves no child running and logs the step; old lines without the new fields still parse.
- `check-body.test.mjs`: a failed test file that passes alone passes the check and is reported as a flake; one that fails twice fails it; the rerun names only the failed files.
- `check-times.test.mjs`: failures by step and the most-failed files, from a fixture log.
- The hand-off gives the slice check's time on a quiet machine before and after, and says which static change was taken and which was left and why.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 6.

## Slice 2: A requested CI run, up to the integration tier

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md, ops/runbook.md · Tests: unit

**User stories:** US 3, 9.

**Build:**

- `ci.yml`, triggered only by a push to `ci/**`. The ref is `ci/<tier>/<name>`; the tier picks the jobs. This slice builds `static`, `unit` and `integration`; a higher tier runs those three and says the rest is not built yet.
  - Setup: `.github/actions/setup`, a Postgres service container on the test port with `DATABASE_URL` pointing at it (so the integration `globalSetup` never falls back to docker compose), `CARETOOK_LEASES=off`, a git identity for the tooling tests, and a fictional env generated by a small script under `scripts/ci/`.
  - Jobs: static (format, lint, typecheck; the docs budget as a warning); unit (the six small Vitest projects, `tooling:unit` without `scripts/loops/browser.test.mjs`); integration (with that file). Each test job uses the JSON reporter and checks out by the pushed SHA, never the ref name.
  - The last job writes `green` or `file` (the other kinds come in slice 4) and uploads it as the `verdict` artifact, kept 7 days.
  - A newer run for the same ref cancels the older one.
  - Keep the workflow inside the YAML shapes `scripts/deploy/workflows.test.mjs`'s reader already parses where that is possible; name any reader change in the hand-off.
- `pnpm prd ci run <tier> [--ref <branch>] [--wait [min]]`:
  - pushes the commit to its `ci/` ref; when the ref already points at that commit, it reuses a live run or deletes and pushes again (a push of the same commit starts nothing);
  - with `--wait`, blocks until the verdict and prints it (exit 0 green, 1 not green, 75 at the timeout);
  - deletes the ref only after a final verdict; at a timeout it leaves the ref for `pnpm prd tidy`;
  - reads a cancelled run, or one with no verdict artifact, as `unknown`.
- `pnpm prd ci [<branch>]` prints the latest whole-tier verdict for the branch's tip.
- `pnpm prd tidy` lists `ci/` refs older than a day with no run going as safe to delete.
- `vitest.config.ts`: `scripts/ci/**/*.test.mjs` joins `scripts:unit`.
- `scripts/deploy/workflows.test.mjs` learns the workflow, and refuses any trigger on it but the `ci/**` push.
- The hand-off lists the `ops/runbook.md` change: what CI runs, that only a request starts it, and that it reads no secrets.

**Acceptance criteria:**

- The env script's unit test: every variable the test projects read is set, and every value is generated and marked fictional.
- `workflows.test.mjs` passes with `ci.yml` in its list, reading no `secrets.*` and triggered by nothing but a `ci/**` push.
- Unit tests with `gh` fixtures for the command: the ref name for each tier; the wait's exit codes; a ref already at the commit is reused or re-pushed; the ref is deleted after a verdict and kept at a timeout; a cancelled run and an unreachable GitHub read as unknown.
- A requested `integration` run of the slice's branch finishes with a verdict. It is green, or each Linux-only failure is filed in the backlog and listed in the hand-off with its run link. The hand-off gives each job's time.
- A requested `unit` run starts no integration job. The hand-off links it.
- A throwaway commit with a failing unit test, requested and never merged, fails its job and uploads `file`. The hand-off links it.
- `pnpm test:tooling` passes, and it runs the `scripts/ci/` tests.

**Blocked by:** nothing. **Blocks:** 3, 4.

## Slice 3: The components and full tiers

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md, docs/domain/components.md · Tests: unit

**User stories:** US 3.

**Build:**

- The components job: `playwright install --with-deps chromium`, the `web:components` project with the JSON reporter, sharded when it runs past 10 minutes.
- The build job, for `full`: the build budget, `build:native`, and B-341's grep of the built client for `caretookSync`. The env script gains what the builds read.
- The verdict job waits for whichever jobs the tier ran.
- About 5 jobs for a `full` run: GitHub Free allows 20 concurrent jobs for the org.

**Acceptance criteria:**

- The env script's test covers every variable the builds read.
- A requested `full` run of the slice's branch finishes with a verdict. It is green, or each Linux-only failure is filed and listed in the hand-off with its run link. The hand-off gives each job's time and any shard it needed.
- A requested `components` run starts no build job. The hand-off links it.
- `pnpm test:tooling` passes.

**Blocked by:** 2. **Blocks:** 4, 8.

## Slice 4: The rerun, the verdict's kinds and the quarantine

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** US 4, 7, 11.

**Build:**

- **The verdict module** (the PRD's _The verdict module_): the five kinds, for any tier, with the narrowed flag and the file list. It reads `ci-results/browser-tooling.json` too, and the rerun and narrowed runs cover the browser harness.
- **The rerun:** a test job that fails reruns its failed files once, in the same job.
- **The brake list:** globs and named files for the sync and offline tests, the role-by-action matrices and permissions tests, the privacy and connector-leak tests, and the migration and seed tests.
- **The quarantine list,** starting empty.
- **A Vitest setup** that skips quarantined tests unless `CARETOOK_QUARANTINE=run`. A run's quarantine step sets it and can't fail the run; its results go into the verdict as `quarantined`.
- **Narrowed runs:** `pnpm prd ci run <tier> --files …` makes the throwaway commit, pushes it to its own ref and marks the verdict.
- `pnpm prd ci run --wait` exits by kind: 0 green, 1 brake, 2 file, 3 flake, 4 infra, 5 unknown, 75 timeout.

**Acceptance criteria:**

- Verdict unit tests:
  - a failed static or build job is a brake;
  - a job that failed before any test ran is infra;
  - a failing test on the brake list is a brake, even when another failure is file;
  - a failure that passes on the rerun is a flake, and a mix of flake and file is file;
  - a quarantined failure leaves the verdict green;
  - a tier's verdict names the tier, and a `unit` run with no integration job is not infra;
  - a narrowed run's verdict is marked narrowed and names its files and its target;
  - every failing file and test is named.
- The quarantine setup's test: a listed test is skipped by default and runs under `CARETOOK_QUARANTINE=run`. A local slice check skips it too.
- `pnpm prd ci <branch>` does not print a narrowed verdict as the branch's.
- A requested run with a test forced to fail once and then pass uploads `flake`. A narrowed run of two files starts only their jobs. The hand-off links both.
- `pnpm test:tooling` passes.

**Blocked by:** 2, 3, 8. **Blocks:** 5, 9.

## Slice 5: Whose failure it is, and what gets filed

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 5, 7, 11.

**Build:**

- `pnpm prd ci blame [<branch>]`, for a `file` or a `brake` verdict: requests a narrowed run of the failed files (for a failed static or build job, that tier) on dev's tip and splits the failures. It reads `ci-results/browser-tooling.json` as well.
  - Failing on dev too is dev's; passing there is the branch's; a test file dev doesn't have is the branch's.
  - It prints both lists with, for the branch's, the slices whose merges changed files in the failing test's area.
- **Filing on a transition**, by the reader:
  - a dev failure gets one `fixes-bug` item per test, with the run link and the branch that found it; while that item is open, later finds only add a note;
  - a dev brake also posts a notice on the board naming the item, withdrawn when a later blame run passes;
  - a flake in a test file the branch didn't touch gets a `fixes-tooling` item and a quarantine entry, written as one locked commit onto dev and pushed; a flake on the brake list is filed and not quarantined;
  - a flake in a test file the branch added or edited is the branch's, like a `file` failure, and is not quarantined;
  - an entry whose item is done is removed by the next write, and by `pnpm prd tidy`.
- `trunk_drift` and the "keeps its check" rule ignore a commit that changes only the brake list or the quarantine.
- An infra verdict is rerun once (`gh run rerun --failed`) and reported if it fails again.
- **`pnpm prd status`** prints each live branch's latest whole-tier verdict and tier.
- The tool writes a commit status on a whole-tier run's commit naming the tier and the kind; a narrowed run gets none.

**Acceptance criteria:**

- Unit tests with `gh` fixtures:
  - the split, for failures that are all the branch's, all dev's and mixed, for a brake as for a file, and for a test file absent on dev;
  - a dev failure files once and notes on the second find; a dev brake posts one notice and a pass withdraws it;
  - a flake in an untouched file files and quarantines in one commit followed by a push; one on the brake list files without an entry; one in a file the branch edited is listed as the branch's;
  - a done item's entry leaves;
  - an infra run is rerun once and never twice;
  - unknown is never green.
- `land.test.mjs`: a dev commit that changes only the quarantine is not drift and keeps a recorded pass.
- A real rerun of a failed job after its `ci/` ref was deleted works. The hand-off links it.
- The hand-off lists the machinery.md changes (the verdict, blame and filing).
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** 6, 7.

## Slice 6: A landing waits for the tier its orchestrator declared

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/loop.md, docs/agents/hotfix.md · Tests: unit

**User stories:** US 3, 8.

**Build:**

- The check plan proposes a minimum tier from the diff: docs and tooling only, none (the tooling tests, as today), except a diff touching the browser harness's trigger paths (slice 8), `integration`; app code, `components`; server code without app code, `integration`; a migration, seeds, the sync config, the lockfile, a `package.json` change beyond its `scripts` field (slice 10's rule), the Vitest config, the workflow or `scripts/ci/`, `full`. It no longer turns a quick check into a full one.
- `pnpm prd pr` and `pnpm prd land` take `--tier <t>` and, for a tier below the proposal, `--why "<reason>"`; the PR body and the landing report name the tier, the proposal and the reason.
- `land` needs a whole-tier verdict for that tier or higher on the tip, read from the verdict's `ranTier` (a `full` request before slice 3 records `ranTier: integration` and `notBuilt`), and requests the run itself when there is none:
  - green lands;
  - flake lands when every flake is in a file the branch didn't touch, and files them after the merge;
  - file lands when `blame` gives every failure to dev, and otherwise refuses, naming the branch's failing tests;
  - brake refuses, naming the tests and, when `blame` gives it to dev, dev's item; a landing that names that item (`--fixes B-<n>`) lands;
  - infra and unknown refuse with how to retry.
- A local full pass is no longer asked for. `pnpm prd check` with no flag still runs it. A tip that only docs and tooling changed since its verdict keeps it, as today's rule for a check pass.
- A hotfix lands the same way: the proposal, or the user's word.
- The hand-off lists the doc changes: orchestrator.md's _The check gate_ and _Landing a wave_ (replacing the old gate's text), hotfix.md and loop.md. They include one interim rule until `test-gates-2`: before a dev to staging PR, `pnpm prd ci run full --ref dev --wait`, with the user's override.

**Acceptance criteria:**

- `check-plan.test.mjs`: the proposal for each kind of diff above, and a quick check on a migration diff stays quick.
- `land.test.mjs`:
  - each kind lands or refuses as listed, with the tests named in a refusal;
  - a flake lands and is filed only after the merge;
  - a narrowed verdict on the tip does not satisfy the gate;
  - a tier below the proposal without `--why` refuses, and with it lands and prints the reason;
  - a verdict for a lower tier than declared refuses; one for a higher tier lands;
  - a dev brake refuses naming its item, and `--fixes` with that item lands;
  - a tip with docs-only commits since its verdict lands.
- `pnpm test:tooling` passes.

**Blocked by:** 1, 5, 10, 11. **Blocks:** 7, test-gates-2.

## Slice 7: The orchestrator sends failures back to the slice that caused them

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 2, 6.

**Build:**

- **Slice worktrees outlive the merge.** A merged slice's worktree and branch stay until the wave's verdict is green: the orchestrator runs `pnpm prd rm <topic>-<n>` then, not at the merge. `pnpm prd tidy` and `gc` keep a merged slice worktree while its topic has a run without a final verdict or a wave not yet landed.
- **A fix** is a new commit on the slice's branch (after merging the PRD branch into it), the slice check on its own files, a new hand-off line, and a second merge into the PRD branch.
- The orchestrator's prompt:
  - on each slice merge and each dev sync, the quick check locally, then carry on;
  - at the wave gate, `pnpm prd ci run <tier> --wait` in the background, with the tier the check plan proposes unless it has a reason;
  - on a verdict that isn't green, `pnpm prd ci blame`, then each of the branch's failures goes to the agent whose slice it names (SendMessage), with the failing tests and the run link; a failure no one slice explains, or an agent idle past an hour, gets a fresh fix agent in that slice's worktree;
  - no rotation while a wave's run is out or a fix is in flight.
- The slice's prompt: after the hand-off the agent releases its stack and waits; a fix request is the steps above and nothing else.
- A slice's hand-off releases its stack (`pnpm prd stack down`), and `pnpm prd stack up` takes it again for a fix. `pnpm prd rotate` refuses while a requested run for the topic has no verdict (`--mid-wave` overrides, as today).
- `pnpm prd status` shows, for each slice in a wave, handed off, waiting for the run, or fixing.
- The hand-off lists the doc changes: orchestrator.md (_Running a wave_: the merge check, the requested tier, blame, the send-back, when `rm` runs, the rotation rule), loop.md and machinery.md.

**Acceptance criteria:**

- Prompt tests (`prompt.test.mjs`): the orchestrator's prompt names the merge check, the requested tier, blame, the send-back, the late `rm` and the rotation rule; the slice's prompt names its own tests only, the stack release, the wait and the fix steps.
- Tooling tests:
  - `tidy` and `gc` keep a merged, clean slice worktree while its topic's run has no verdict, and list it as safe once the wave has landed;
  - `rotate` refuses with a run outstanding and names it, and passes with `--mid-wave`;
  - a hand-off leaves no stack up.
- `pnpm test:tooling` passes.

**Blocked by:** 5, 6. **Blocks:** nothing.

## Slice 8: The tooling scripts work on Linux

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** US 3, 10. Added on the user's decision, 2026-11-22.

**Build:**

- One shared mtime helper that tries GNU `stat -c %Y` first, used at every `stat -f %m` site: `browser.sh`, `stack-lib.sh`, `lease.sh` and `lib.sh` (`with_backlog_lock`, B-242). On Linux, `stat -f %m` prints a `File:` block to stdout before failing, so the existing `||` fallbacks capture junk.
- `load_avg` in `lib.sh` prints a stray blank line on Linux, which breaks `browser.test.mjs`'s `cap 30s` line match. It prints one clean line on both systems.
- Trace the lease failures rather than assuming `stat` explains them, and fix what the tooling gets wrong on Linux. "The check lease makes runs beyond the limit of two wait" passes in some runs and fails in others: recheck it once `stat` is fixed, and file it if it still fails.
- **`browser.test.mjs` gets its own Vitest project and script** (the user's decision, 2026-11-22; something like `pnpm test:browser-harness`), removed from `tooling:unit`, because it launches Playwright and waits on deliberately hanging specs. This replaces slice 2's interim exclusion from the CI unit job.
  - CI: it always runs in the `integration` tier's job.
  - Locally: `pnpm test:tooling` runs it only when the change touches `scripts/loops/browser.sh`, `scripts/loops/lib.sh`, `scripts/loops/lease.sh`, `scripts/loops/checks`, the area map, `scripts/browser-checks/` or the test file. It reuses the check plan's base, and runs the harness when the base can't be determined. Check that list against what `browser.sh` actually sources, and name any addition in the hand-off.
  - `pnpm test` and `check-body.sh` select `--project '!tooling:unit'`, so a new project would join every `pnpm test` and skew the counts: update both to leave it out.
  - The hand-off lists any AGENTS.md or `docs/agents/loop.md` wording about what `test:tooling` covers; the orchestrator folds it.
- Watch `check-run`'s empty branch name on a detached HEAD: it failed in one CI run and passed in the next. If it recurs, fix it; if not, say so in the hand-off.

**Acceptance criteria:**

- A unit test of the helper: a numeric mtime when the first `stat` form prints junk, and on the system it runs on.
- No `stat -f %m` is left outside the helper.
- The 11 failures from slice 2's CI unit run (browser 6, lease 2, stack, disk, load-gate) are green on the Linux runner, in a requested run of the slice's branch linked in the hand-off.
- A test of the selection: `pnpm test:tooling` picks the browser project for a change to each listed path and skips it for any other tooling change.
- A requested `integration` run includes the browser project, and a `unit` run does not.
- `pnpm test:tooling` passes on the Mac.

**Blocked by:** 2, 3. **Blocks:** 4.

## Slice 9: The components tier goes green on Linux

Stack: no · Reads: docs/agents/loop.md, docs/domain/components.md · Tests: component

**User stories:** US 3, 7. Added for B-566, B-567 and B-568, which the user moved to this topic on 2026-11-22.

**Build:**

- B-566 (the user's decision, 2026-11-22): in `apps/web/app/routes/admin/access-codes/accessCodes.browser.test.tsx`, drop the image, canvas and `BarcodeDetector` steps and the `BarcodeDetectorCtor` type. The test only checks that a QR code is created (an svg renders in `[data-access-code-qr]`). No new dependency and no comparison with an expected code.
- B-567: the inScreens first probe test waits for the first render instead of reading the Probe actions button once.
- B-568: each test named in the item that still fails intermittently goes into the quarantine with B-568 as its item, unless it is on the brake list. A brake-list test is reported in the hand-off and not quarantined. Don't fix these flakes here.

**Acceptance criteria:**

- The QR and first probe tests pass locally and on the Linux runner.
- A requested `components` run of the slice's branch is green, or each remaining failure is named in the hand-off with its run link. The hand-off links the run and lists the quarantine entries.
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** 5.

## Slice 10: A scripts-only package.json change forces nothing

Stack: no · Reads: docs/agents/loop.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 1. Added for B-572, the user's decision of 2026-11-22.

**Build:**

- Compare each changed `package.json` with its base, ignoring the `scripts` field. If only scripts differ (added, edited or removed, in any package, lifecycle hooks included), it does not force a full check or the browser `@suite`.
- Any other field, or an added, deleted or unparseable `package.json`, still forces them. The lockfile rule stays. The user accepted that a script edit that breaks the build, typecheck or the check itself gets only a quick check.
- Two places: `FORCED` in `scripts/loops/check-plan.mjs` (`planCheck` only gets paths today, so give it the base's contents or a prefilter, and keep it pure) and the `package.json` `@suite` rules in `scripts/loops/check-areas.d/_global`.
- Update the rule's wording in `scripts/loops/prd.sh`. The hand-off lists the `docs/agents/orchestrator.md` wording for the orchestrator to fold.

**Acceptance criteria:**

- `check-plan.test.mjs`: a scripts-only change (added, edited, removed, a lifecycle hook, a nested package) stays quick; a change to another field, an added, a deleted and an unparseable `package.json` each force full; a scripts-only change beside a lockfile change still forces full.
- A test that the browser selection leaves out `@suite` for a scripts-only change and keeps it for any other `package.json` change.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 6.

## Slice 11: Blame never clears a failure it didn't compare

Stack: no · Reads: docs/agents/loop.md, ops/runbook.md (the CI section) · Tests: unit

**User stories:** US 5. Added for Codex's findings on PR #81 (B-587, B-588, B-589).

**Build,** in `scripts/ci/blame.mjs` and, for B-587, the narrowed path in `scripts/ci/test-job.mjs`:

- B-587: a test skipped as quarantined in dev's comparison run has not passed there. Run it, or leave it unknown.
- B-588: a flake doesn't explain a failed job. A `file` verdict whose failure no remaining test explains is partial, so blame exits 5 instead of 0.
- B-589: a named failure against a dev result that lists only its file (a load failure) stays unknown, not dev's.

**Acceptance criteria:**

- `blame.test.mjs` has a failing-first case for each of the three, built through `buildVerdict()` where the bug depends on its shape.
- None of the three can make `blameExit` return 0.
- `pnpm test:tooling` passes.

**Blocked by:** 5. **Blocks:** 6.

## Slice 12: A rendered page has mounted before a test reads it

Stack: no · Reads: docs/agents/loop.md, docs/domain/components.md · Tests: component

**User stories:** US 2, 7. Added for B-607, the user's decision of 2026-11-22, after `entryRepeat.browser.test.tsx` failed in CI runs 45108684442 and 45109646741.

**Build:**

- `renderWithDevice` (`apps/web/test/device.tsx`) settles before returning, but `settle` can go quiet while a route's loaders are still reading the device, so the page hasn't mounted. Confirm that with a failing-first test.
- Make the default first settle wait for the route to mount, in the harness, so a test can read straight after `open`. `plannerWorld.tsx` already waits for `main` by hand: drop that wait if the harness now covers it.
- A render that never mounts, or a screen with no `main` (the harness also renders admin, marketing and sign-in screens), must not hang or start failing. A test passing `settle: false` keeps today's behaviour.
- Don't fix other flakes here, and don't remove quarantine entries: B-568 stays with fixes-tooling.
- The hand-off lists the `docs/domain/components.md` wording on _Settle_.

**Acceptance criteria:**

- A test of the harness fails before the change and passes after it: a route whose loader resolves late is mounted when `renderWithDevice` returns.
- A requested `components` run of the slice's branch is green or `flake`, with any failure named in the hand-off with its run link. This harness is used by about 110 files, so own files alone don't prove it.
- `pnpm test:tooling` passes.

**Blocked by:** 7. **Blocks:** nothing.

## Slice 13: The default PRD cap is 4

Stack: no · Reads: docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

**User stories:** none; B-612, the user's decision of 2026-11-23, because testing has moved to CI.

**Build:**

- Change the default from 3 to 4 in `scripts/loops/lib.sh` (`max_prds`), `scripts/loops/dispatch.mjs` (the cap and its _Env_ comment) and `scripts/loops/dispatch-pick.mjs` (`DEFAULT_CAPS`). `CARETOOK_MAX_PRDS` stays the override.
- Update the tests that assume 3, and the "slots used of three" wording in the backlog prompt in `scripts/loops/prompt.sh`.
- Leave the check and browser leases at 2 and the load gate as it is.
- The hand-off lists the doc wording for the orchestrator to fold: `docs/orchestration.md` (_At most three PRDs_), `docs/agents/machinery.md`, `docs/agents/orchestrator.md` and `docs/agents/backlog.md`.

**Acceptance criteria:**

- With no env var, `pnpm prd start`, `pnpm prd status` and the dispatcher all use 4. A test covers each default, and `CARETOOK_MAX_PRDS` still overrides it.
- No default of 3 for the PRD cap is left in `scripts/loops/`.
- The lease limits and the load gate are unchanged.
- `pnpm test:tooling` passes.

**Blocked by:** wave 6 landing. **Blocks:** nothing.
