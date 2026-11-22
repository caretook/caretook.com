# Plan: Test gates

The [PRD](test-gates-prd.md) covers:

- slices check only their own tests, and local checks say why they failed;
- CI runs only on request, in tiers the orchestrator picks;
- a run's failures are sorted by kind, and flakes are quarantined;
- a landing waits for the tier its orchestrator declared.

Items B-553, B-554, B-341, B-528, B-529, B-530, B-555, B-556. B-531 (modes) is dropped pending the user's word. B-532 and B-533 go to `test-gates-2`.

## Status

| Slice | Wave | State | Merge into `prd/test-gates` (slice commits) |
| ----- | ---- | ----- | ------------------------------------------- |
| 1     | 1    | —     | —                                           |
| 2     | 1    | —     | —                                           |
| 3     | 2    | —     | —                                           |
| 4     | 3    | —     | —                                           |
| 5     | 4    | —     | —                                           |
| 6     | 4    | —     | —                                           |

**Backlog:**

| Item  | Claim          | `done`         |
| ----- | -------------- | -------------- |
| B-555 | slice 1 starts | slice 1 merges |
| B-556 | slice 1 starts | slice 1 merges |
| B-341 | slice 2 starts | slice 2 merges |
| B-554 | slice 2 starts | slice 5 merges |
| B-529 | slice 3 starts | slice 4 merges |
| B-530 | slice 3 starts | slice 4 merges |
| B-528 | slice 5 starts | slice 5 merges |
| B-553 | slice 6 starts | slice 6 merges |

## Architectural decisions

- **CI checks, the Mac decides.** The workflow only runs checks and uploads a verdict file. Every write happens on the Mac, through `pnpm prd ci` and `pnpm backlog`: backlog items, quarantine entries, commit statuses. CI reads no GitHub secret.
- **Nothing runs unless asked.** The workflow's only trigger is a push to a `ci/**` ref, made by `pnpm prd ci run`. No `pull_request`, no push to dev, staging or main, no schedule.
- **One verdict format**, versioned (`version: 1`): the commit, the run id, the tier, the kind (`green`, `brake`, `file`, `flake`, `infra`), and the failing jobs, files and tests before and after the rerun. The verdict module is pure; the workflow and `pnpm prd ci` share it.
- **Tiers include the ones before:** `static`, `unit`, `integration`, `components`, `full`. One list of them, read by the workflow, the check plan and the gate.
- **Committed lists** sit beside the workflow under `scripts/ci/`: the brake list and the quarantine. Each has a comment header saying who writes it.
- **One new action:** `actions/upload-artifact`, pinned to a commit SHA. No other new action or dependency (no `actionlint`). The setup reuses `.github/actions/setup`.
- The test env in CI is fictional and generated in the workflow (AGENTS.md, _Working rules_).

## How to run this plan

- **Waves:**
  1. slices 1 and 2 (1 touches the local check runner; 2 adds the workflow and the request)
  2. slice 3
  3. slice 4
  4. slices 5 and 6 (5 touches the landing gate and the check plan; 6 the prompts and the handbooks)
- Each wave lands on its own, under today's gate until slice 5 lands, and the declared tier after that.
- **Proving a workflow change:** a slice pushes its own commit to a `ci/` ref (`pnpm prd ci run`, or `git push origin HEAD:refs/heads/ci/<tier>/<name>` before the command exists), links the runs in its hand-off and deletes the refs. A pushed ref runs the workflow of that commit, so nothing needs to be in dev or staging first.
- **Hot files:** `.github/workflows/`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `vitest.config.ts`, `scripts/loops/land`, `scripts/loops/check-plan`, `scripts/loops/check-body`, `scripts/loops/check-run`, `scripts/loops/check-times`, `scripts/loops/lib.sh`, `scripts/loops/prd.sh`, `scripts/loops/pr.sh`, `scripts/loops/prompt.sh`. These overlap:
  - fixes-tooling's scripts items: held until this topic lands (its wave 2 is in dev);
  - agent-autonomy (B-518) waits for this topic.
- Before slice 5 lands, confirm with the user that the modes (B-531) are dropped.

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

**Blocked by:** nothing. **Blocks:** 5.

## Slice 2: A requested CI run

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md, ops/runbook.md · Tests: unit

**User stories:** US 3, 9.

**Build:**

- `ci.yml`, triggered only by a push to `ci/**`. The ref is `ci/<tier>/<name>`; the tier picks the jobs.
  - Setup: `.github/actions/setup`, a Postgres service container on the test port with `DATABASE_URL` pointing at it (so the integration `globalSetup` never falls back to docker compose), `playwright install --with-deps chromium` for the components job only, `CARETOOK_LEASES=off`, a git identity for the tooling tests, and a fictional env generated by a small script under `scripts/ci/`.
  - Jobs: static (format, lint, typecheck; the docs budget as a warning); unit (the six small Vitest projects, `tooling:unit` included); integration; components; build (the build budget, `build:native`, B-341's grep of the built client for `caretookSync`). Each test job uses the JSON reporter; a job past 10 minutes is sharded.
  - A run narrowed to named files (a list in the pushed commit's message trailer or a second ref segment: the slice picks one and says why) runs only those files' jobs.
  - The last job writes `green` or `file` (the other kinds come in slice 3) and uploads it as the `verdict` artifact, kept 7 days.
  - A newer run for the same ref cancels the older one.
- `pnpm prd ci run <tier> [--ref <branch>] [--files …] [--wait [min]]`: pushes the commit to its `ci/` ref; with `--wait`, blocks until the verdict, prints it and deletes the ref (exit 0 green, 1 not green, 75 at the timeout). `pnpm prd ci [<branch>]` prints the latest verdict for the branch's tip.
- `pnpm prd tidy` lists `ci/` refs older than a day as safe to delete.
- `scripts/deploy/workflows.test.mjs` and its YAML reader learn the workflow and its shapes (services, matrix, concurrency), and refuse any trigger on it but the `ci/**` push.
- `ops/runbook.md` says what CI runs, that only a request starts it, and that it reads no secrets.

**Acceptance criteria:**

- The env script's unit test: every variable the test projects and the builds read is set, and every value is generated and marked fictional.
- `workflows.test.mjs` passes with `ci.yml` in its list, reading no `secrets.*` and triggered by nothing but a `ci/**` push.
- Unit tests with `gh` fixtures for the command: the ref name for each tier, the wait's exit codes, the ref deleted after a verdict and after a timeout, an unreachable GitHub read as unknown.
- A requested `full` run of the slice's branch is green and uploads a `green` verdict. The hand-off links it with each job's time and any shard it needed.
- A requested `unit` run starts no integration, components or build job. The hand-off links it.
- A throwaway commit with a failing test, requested and never merged, fails its job and uploads `file`. The hand-off links it.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 3.

## Slice 3: The rerun, the verdict's kinds and the quarantine

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** US 4, 7, 11.

**Build:**

- **The verdict module** (the PRD's _The verdict module_): the five kinds, for any tier.
- **The rerun:** a test job that fails reruns its failed files once, in the same job.
- **The brake list:** globs and named files for the sync and offline tests, the role-by-action matrices and permissions tests, the privacy and connector-leak tests, and the migration and seed tests.
- **The quarantine list,** starting empty.
- **A Vitest setup** that skips quarantined tests unless `CARETOOK_QUARANTINE=run`. A run's quarantine step sets it and can't fail the run; its results go into the verdict as `quarantined`.
- `pnpm prd ci run --wait` exits by kind: 0 green, 1 brake, 2 file, 3 flake, 4 infra, 5 unknown, 75 timeout.

**Acceptance criteria:**

- Verdict unit tests:
  - a failed static or build job is a brake;
  - a job that failed before any test ran is infra;
  - a failing test on the brake list is a brake, even when another failure is file;
  - a failure that passes on the rerun is a flake, and a mix of flake and file is file;
  - a quarantined failure leaves the verdict green;
  - a tier's verdict names the tier, and a `unit` run with no integration job is not infra;
  - every failing file and test is named.
- The quarantine setup's test: a listed test is skipped by default and runs under `CARETOOK_QUARANTINE=run`. A local slice check skips it too.
- A requested run with a test forced to fail once and then pass uploads `flake`. The hand-off links it.
- `pnpm test:tooling` passes.

**Blocked by:** 2. **Blocks:** 4.

## Slice 4: Whose failure it is, and what gets filed

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 5, 7, 11.

**Build:**

- `pnpm prd ci blame [<branch>]`: for a `file` verdict, requests a run of only the failed files on dev's tip and splits them: failing on dev too is dev's, passing there is the branch's. It prints both lists with, for the branch's, the slices whose merges changed files in the failing test's area.
- **Filing on a transition**, by the reader:
  - a dev failure gets one `fixes-bug` item per test, with the run link and the branch that found it; while that item is open, later finds only add a note;
  - a flake gets a `fixes-tooling` item and a quarantine entry, written as one locked commit onto dev and pushed; a flake on the brake list is filed and not quarantined;
  - an entry whose item is done is removed by the next write, and by `pnpm prd tidy`.
- An infra verdict is rerun once (`gh run rerun --failed`) and reported if it fails again.
- **`pnpm prd status`** prints each live branch's latest verdict and tier.
- The tool writes a commit status on the run's commit naming the tier and the kind.

**Acceptance criteria:**

- Unit tests with `gh` fixtures:
  - the split, for failures that are all the branch's, all dev's and mixed;
  - a dev failure files once and notes on the second find;
  - a flake files and quarantines in one commit followed by a push, and one on the brake list files without an entry;
  - a done item's entry leaves;
  - an infra run is rerun once and never twice;
  - unknown is never green.
- Docs fold: machinery.md (the verdict, blame and filing).
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 5, 6.

## Slice 5: A landing waits for the tier its orchestrator declared

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/loop.md, docs/agents/hotfix.md · Tests: unit

**User stories:** US 3, 8.

**Build:**

- The check plan proposes a minimum tier from the diff: docs and tooling only, none (the tooling tests, as today); app code, `components`; server code without app code, `integration`; a migration, seeds, the sync config, the lockfile, a `package.json`, the Vitest config or the workflow, `full`. It no longer turns a quick check into a full one.
- `pnpm prd pr` and `pnpm prd land` take `--tier <t>` and, for a tier below the proposal, `--why "<reason>"`; the PR body and the landing report name the tier, the proposal and the reason.
- `land` needs a verdict for that tier or higher on the tip, and requests the run itself when there is none:
  - green lands;
  - flake lands, and the flake is filed;
  - file lands when `blame` gives every failure to dev, and otherwise refuses, naming the branch's failing tests;
  - brake refuses, naming the tests;
  - infra and unknown refuse with how to retry.
- A local full pass is no longer asked for. `pnpm prd check` with no flag still runs it. A tip that only docs and tooling changed since its verdict keeps it, as today's rule for a check pass.
- A hotfix lands the same way: the proposal, or the user's word.
- The orchestrator handbook's _The check gate_ and _Landing a wave_, and the hotfix handbook, state the new gate.

**Acceptance criteria:**

- `check-plan.test.mjs`: the proposal for each kind of diff above, and a quick check on a migration diff stays quick.
- `land.test.mjs`:
  - each kind lands or refuses as listed, with the tests named in a refusal;
  - a tier below the proposal without `--why` refuses, and with it lands and prints the reason;
  - a verdict for a lower tier than declared refuses; one for a higher tier lands;
  - a tip with docs-only commits since its verdict lands.
- Docs fold: orchestrator.md, hotfix.md and loop.md state the new gate, and the doc budget passes.
- `pnpm test:tooling` passes.

**Blocked by:** 1, 4. **Blocks:** 6, test-gates-2.

## Slice 6: The orchestrator sends failures back to the slice that caused them

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 2, 6.

**Build:**

- The orchestrator's prompt and handbook:
  - on each slice merge and each dev sync, the quick check locally, then carry on;
  - at the wave gate, `pnpm prd ci run <tier> --wait` in the background, with the tier the check plan proposes unless it has a reason;
  - on a verdict that isn't green, `pnpm prd ci blame`, then each of the branch's failures goes to the agent whose slice it names (SendMessage), with the failing tests and the run link; a failure no one slice explains, or an agent idle past an hour, gets a fresh fix agent;
  - no rotation while a wave's run is out or a fix is in flight.
- The slice's prompt and handbook: after the hand-off the agent releases its stack and waits; a fix request is the slice check again on its own files, a new hand-off line, and nothing else.
- A slice's hand-off releases its stack (`pnpm prd stack down`), and `pnpm prd stack up` takes it again for a fix. `pnpm prd rotate` refuses while a requested run for the topic has no verdict (`--mid-wave` overrides, as today).
- `pnpm prd status` shows, for each slice in a wave, handed off, waiting for the run, or fixing.

**Acceptance criteria:**

- Prompt tests (`prompt.test.mjs`): the orchestrator's prompt names the merge check, the requested tier, blame, the send-back and the rotation rule; the slice's prompt names its own tests only, the stack release and the wait.
- Tooling tests: `rotate` refuses with a run outstanding and names it, and passes with `--mid-wave`; a hand-off leaves no stack up.
- Docs fold: orchestrator.md, loop.md and machinery.md, within the doc budget.
- `pnpm test:tooling` passes.

**Blocked by:** 4, 5. **Blocks:** nothing.
