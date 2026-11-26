# Plan: Test time gates

PRD: [test-time-gates-prd.md](test-time-gates-prd.md). Items B-837, B-772, B-781, B-370. Starts after `orchestration-split-2` (it holds `scripts/loops/` and `scripts/project/`). Follow-on: `test-time-gates-2` (component shards' fallback and the quick check's trim, then arming those two gates).

## Status

| Slice                                        | Wave | State   | Merge    |
| -------------------------------------------- | ---- | ------- | -------- |
| 1. The time gate and its data                | 1    | landed  | 3f65aebf |
| 2. The quick check's times and its gate      | 2    | planned | —        |
| 3. Stops and breaches apart; the guards stay | 3    | planned | —        |
| 4. CI's unit and component gates             | 2    | planned | —        |
| 5. Component shards balanced                 | 3    | planned | —        |
| 6. The unit job under the aim                | 3    | planned | —        |

- **Landing mode: run everything through** (dispatcher start, 2026-11-25): start every ready slice, land each green wave, ask only real questions via `pnpm prd ask`.
- 2026-11-25: base 0a76460a (orchestration-split-2 landed). Backlog: B-837 (time gates, claimed), B-772, B-781, B-370; nothing new to propose.
- **Wave 1 landed** 2026-11-25 as 1a0c1f98 (PR #202, tier full, --no-review: Codex out of credits; report filed). **Next: wave 2, slices 2 and 4 (both opus), ready now.**
- Wave 1: slice 1 (opus) handed off 58cf4ef5 (slice check passed), merged 3f65aebf. `time-gate.mjs` + `gates` in `scripts/ci/tiers.json` (read in `tier-data.mjs`), all unarmed; arm a measure with `armed: true`. Gate: requested `full` CI run (tier: scripts/ci). CI full run 45746430590 on ed22fc7a: `flake` (components-2 search.sync perf test, not ours; lands). Sync: no merge needed. Slice 1 worktree removed. PR #202 open; Codex review out. project-config doc folded (36cc5a26).

## Architectural decisions

- **One gate, three measures:** `unit` (CI's unit job's test step), `components` (each component shard's test step, on its own) and `quick` (a local `quick` or `slice` check, its tooling step included). Each: aim 300 s, warn past 300, fail past 360. One pure module decides for all three; CI and the check runner only feed it.
- **Armed by data:** each measure's fail is off until the slice that brings it under the aim switches it on, with the measured times in this plan's _Status_. Unarmed, a breach warns and says "not armed".
- **Quiet only, locally:** the local gate judges a check that started and ended at a 5-minute load at most the core count; any other run is logged "not judged".
- **A time breach is its own kind** everywhere it lands: the check log, `--times`, metrics and the CI verdict. Never a test failure, never a flake, never blamed on a commit as one.
- **A breach names its measure, its seconds and its ten slowest files** (or, for the quick check, its steps and their slowest files).
- **No test changes what it asserts** in a trim: splits and shard moves keep the same test count, checked before and after.

## How to run this plan

- **Waves:** 1: slice 1. 2: slices 2 and 4 (2 owns the check body, the tooling-test runner, the check runner and the check log's parser; 4 owns CI's test-job wrapper, the verdict and the workflow's summary lines). 3: slices 3, 5 and 6 (3 owns the check log's summary, metrics and the guard test; 5 owns the Vitest config's component projects, the sequencer and its durations table; 6 owns the tool's slow test files and, if needed, the unit job's shards in the workflow and the tier data). Slices 5 and 6 both may touch the workflow: 5 only the components jobs' lines, 6 only the unit job's; the second to merge rebases.
- Slice 6 arms `unit` in the gates' data: one line at the end of its entry.
- Each CI-touching slice is proven by one requested run from its branch at the tier its diff proposes; the measured seconds go in _Status_.
- **`test-time-gates-2`** (after this topic) gets every component shard under the aim (a fourth shard, or trims of the slowest timeline and planner files, whichever slice 5's measured shards call for) and the quick check under it (the trim the step times from slice 2 name), and arms `components` and `quick`. Its planner reads this plan's _Status_ for the numbers. The quick check's measurement needs a quiet machine: its orchestrator asks the user for a quiet window through `pnpm prd ask` rather than waiting on load.
- **Items at landing:** B-781 and B-370 close; B-837 and B-772 stay open, moved to `test-time-gates-2`, until it arms `components` and `quick`.
- **Paths:** `orchestration-split-2` lands first and may move files this plan names (the config, the tier data, the check scripts); each slice works on the paths it left, by their role.
- **Doc folds at landing:** the loop doc (a check failed only on time: report it, don't trim others' tests), the machinery doc's check-log fields, and the components doc's shard and zone notes.

## Slice 1: The time gate and its data

Stack: no · Reads: docs/agents/machinery.md, docs/agents/project-config.md · Tests: unit

User stories 4.

**What to build:** the time gate module (PRD _Implementation decisions_, "The time gate") and the gates' data (PRD _Implementation decisions_, "The gates' data"): the three measures, all unarmed, and the quiet threshold, read through the config the core already loads. A small CLI the check runner and the test-job wrapper can call: measure, seconds, loads and a slowest-files list in, the verdict and its lines out. Nothing calls it yet.

**Acceptance criteria:**

- The gate's unit tests: `ok` at the aim, `warn` past it, `fail` past the cutoff when armed, `warn` with "not armed" when not, `unjudged` for a busy start or end (local measure only); the lines name the measure, the seconds and at most ten slowest files.
- The config's unit tests: the gates' data loads with its defaults, and a bad entry (an aim above its cutoff, an unknown measure) fails with the field named.

**Blocked by:** none. **Blocks:** 2, 4.

## Slice 2: The quick check's times and its gate

Stack: no · Reads: docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

User stories 3, 4.

**What to build:** the check body writes each step's seconds and its test steps' slowest files into the check's state directory; the tooling-test runner (the step the check hook runs after the project's check) does the same for the `tooling` step. The check runner applies the gate to a finished quick or slice check, prints its lines, exits non-zero on an armed `fail`, and logs two more fields (the verdict, the step times); the check log's parser reads them and keeps older lines (PRD _Implementation decisions_, "The check body", "The check runner").

**Acceptance criteria:**

- `check-body.test.mjs`: a quick and a slice run write the step times and the slowest files.
- The tooling runner's test: a `tooling` step writes its seconds and slowest files to the same state directory.
- `check-run.test.mjs`, on a stubbed clock and load: a quiet 400 s quick check that passed logs `fail` and exits non-zero with `quick` armed in a fixture config, and `warn` with exit 0 unarmed; a busy one logs `unjudged`; a full check isn't judged; the tooling step's seconds count.
- `check-times.test.mjs`: the new fields parse; a sixteen-field line still parses.

**Blocked by:** 1. **Blocks:** 3.

## Slice 3: Stops and breaches apart; the guards stay

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

User stories 8, 9.

**What to build:** `pnpm prd check --times` and `pnpm prd metrics` count test failures, budget stops, silence stops and time breaches apart, overall, by mode and by PRD (PRD _Implementation decisions_, "The check log's summary and metrics"). A guard test (PRD _Implementation decisions_, "The guard test") that fails when `sync-matrix.test.mjs` or `rolesSql.test.ts` leaves the projects every quick check runs. B-370 closes with it.

**Acceptance criteria:**

- `check-times.test.mjs` and `metrics.test.mjs`: a log with one run of each kind shows one under each column; a budget stop and a time breach aren't in the test failures; the failures-by-step list counts only test failures.
- The guard test passes on the tree, and fails on a fixture project list without `project:unit`.

**Blocked by:** 2. **Blocks:** none.

## Slice 4: CI's unit and component gates

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

User stories 1, 2, 4.

**What to build:** the test-job wrapper times its Vitest run (not the rerun), reads the slowest files from its own report, runs the gate for `unit` or `components` (its step group), writes the result beside the report, adds it to the job summary, and fails the job on an armed `fail`. The verdict reads the result: a `time` failure is its own kind, never a flake and never blamed (PRD _Implementation decisions_, "CI's test-job wrapper"). The land gate and `pnpm prd ci` already print a verdict's kinds: reuse that path, and touch the land script only if it can't name the new kind. Both measures stay unarmed. If it would pass about 8 files, the job summary line moves to `fixes-tooling`.

**Acceptance criteria:**

- `test-job.test.mjs` on a stubbed run and clock: a passing 330 s components step writes `warn` with its slowest files and exits 0; armed in a fixture config at 400 s it exits non-zero with `time`; a failing step's rerun time isn't counted.
- `verdict.test.mjs` with a new fixture: a job failed on time gives the `time` kind, not `file` or `flake`, and the gate refuses it with that reason.
- One requested `components` run from the branch: each shard's summary shows its seconds and verdict (recorded in _Status_).

**Blocked by:** 1. **Blocks:** 5, 6.

## Slice 5: Component shards balanced

Stack: no · Reads: docs/domain/components.md · Tests: unit, component

User stories 2, 5.

**What to build:** a custom Vitest sequencer whose shard step balances files by past durations from a committed table, falling back to file count; a command that refreshes the table from a CI run's component reports. The second zone's every-run list shrinks to the zone-sensitive component files; the release tier's zone-component jobs still run every file in the second zone (PRD _Implementation decisions_, "Component shards"). Arm `components` only if every shard is under 300 s; otherwise record the shard times for `test-time-gates-2`.

**Acceptance criteria:**

- The sequencer's unit tests: three shards from a durations table differ by at most the largest file; a file with no duration goes by count; the same input gives the same shards.
- `zones.test.mjs` (or its successor) still holds: the release tier runs every component file in the second zone.
- The same component test count before and after across the three shards plus the zone jobs.
- One requested `components` run: every shard's test-step seconds in _Status_, with the spread between shards under a minute.

**Blocked by:** 4. **Blocks:** none (`test-time-gates-2`).

## Slice 6: The unit job under the aim

Stack: no · Reads: docs/agents/loop.md · Tests: unit

User stories 6.

**What to build:** the slowest `tooling:unit` files split along their `describe` groups, `land.test.mjs` first, then `recover`, `rotate` and `dispatch` as needed, so Vitest's workers spread them (PRD _Implementation decisions_, "The tool's slow test files"). If one requested `unit` run is still over 300 s, CI's unit job splits into two shards (the workflow's unit job and the tier data). Then `unit` is armed. Keep it under about 8 files; a further split goes to `fixes-perf`.

**Acceptance criteria:**

- `pnpm test:tooling` passes with the same test count before and after (both numbers in the hand-off).
- One requested `unit` run: the test step under 300 s (seconds in _Status_), then `unit` armed.
- If the job was sharded: `tiers.test.mjs` and `release-jobs.test.mjs` pass with the new job names.

**Blocked by:** 4. **Blocks:** none (`test-time-gates-2`).
