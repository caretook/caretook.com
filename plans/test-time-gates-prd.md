# PRD: test-time-gates

Time limit gates for the unit tests, the component tests and the local quick check, and the trims that bring each under them (B-837, B-772, B-781, B-370).

## Decisions

| Decision                                                                                                                                                                                                                   | Why                                                                                                                                          | Source                        | Cost to change later                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| The gates include the tool's own tests: CI's unit job is measured whole (`tooling:unit` is about 11 of its 14 summed minutes; `land.test.mjs` alone 232 s), and a quick check's tooling step counts toward the quick check | the user measured "the unit tests alone are over 6 minutes", true only with them in; leaving them out would make the gate pass by definition | assumed                       | medium: one measure's scope in the gate's data, but slice 5's split would be wasted          |
| A breach past the cutoff fails what it measures: the CI job's verdict (a `time` failure, never blamed as a flake) and the local check (exit non-zero, kind `time`)                                                         | B-837: "fail past 6"                                                                                                                         | assumed (from the item)       | medium: the verdict and the check both carry the kind; turning a fail into a warning is data |
| Each gate's fail is **armed** only by the slice that brings its measure under the aim; until then it warns past 5 minutes and logs                                                                                         | all three are over 6 minutes today: armed at once, every landing would stop                                                                  | assumed                       | low: one switch per measure in the gate's data                                               |
| The local gate judges only quick and slice checks that start and end on a quiet machine (5-minute load at most the core count); others are logged "not judged"                                                             | B-837: "measure on a quiet machine, not under load"                                                                                          | assumed                       | low: one threshold in the data                                                               |
| The unit and component gates are CI's: the unit job's test step and **each** component shard's test step, on its own                                                                                                       | CI is where all of them run; shards run side by side, so one slow shard is the wall clock                                                    | assumed                       | low                                                                                          |
| A loop whose check fails only on time reports it to its orchestrator and doesn't trim others' tests                                                                                                                        | a loop owns only its slice; the slowest-files list goes in the report                                                                        | assumed                       | low: one line in the loop doc                                                                |
| Component shards balance by past file durations from a committed table refreshed from CI's reports (fallback: by file count)                                                                                               | B-772 asks for a duration-balanced sequencer; a committed table keeps a shard's files reproducible                                           | assumed                       | low: the sequencer's input                                                                   |
| The New York zone run keeps only the zone-sensitive files on every components run; the rest of its 53 files run in the release tier's zone-components jobs                                                                 | B-772's first option; keeps the second zone's daily value for its screens                                                                    | assumed (from the item)       | low: one list in the Vitest config                                                           |
| `tooling:unit`'s slowest files (`land.test.mjs` first) split into several files; CI's unit job is sharded in two only if that isn't enough                                                                                 | one file is one worker's critical path; sharding adds a CI job to the tier data                                                              | assumed                       | low                                                                                          |
| B-370 is already met (both guards sit in projects every quick check runs: `rolesSql.test.ts` in `data:unit`, `sync-matrix.test.mjs` in `project:unit`); this topic adds a test that keeps it so, and closes it             | verified in `vitest.config.ts` and `check-body.sh` on 710c7971                                                                               | assumed                       | low                                                                                          |
| The limits: aim 300 s, warn past 300 s, fail past 360 s, the same for all three                                                                                                                                            | B-837                                                                                                                                        | preference (the item's words) | low: data                                                                                    |
| The topic runs after `orchestration-split-2`, which holds `scripts/loops/` and `scripts/project/`                                                                                                                          | the rules across PRDs: one hot prefix, one topic at a time                                                                                   | assumed                       | low: row order                                                                               |

Nothing was asked: no decision falls under the planner's _What to ask_ (no scope dropped, no data, permission, compliance, dependency or money).

The first skeptic (s41) sent the plan back: the first slice was past the file limit and missed the tooling step's times, and the component slice had no fallback if balancing leaves a shard over 5 minutes (B-772 itself expected 6 to 7). The gate and its data are now their own slice, the tooling step is timed, and the component fallback and the quick check's trim moved to `test-time-gates-2`.

## Problem

The checks that tell an agent or the user "this is fine" have grown slow, and nothing notices until someone waits. The local quick check now takes over 8 minutes on a quiet machine; CI's unit job runs 5 to 6 minutes; the component shards run 6.5 to 12 minutes, one shard holding most of the slow timeline and planner files twice (both zones). The check log mixes the times a check was stopped for hanging with plain test failures, so the numbers that would show the growth are muddled. When a breach does happen, nobody can tell which part grew.

## Solution

Three gates, each on its own: the unit tests, the component tests and the local quick check. Each aims at 5 minutes, warns past 5 and fails past 6, and a breach names which one grew and its slowest files. The local gate judges only a quiet machine's runs. The check log and `pnpm prd metrics` keep budget stops, silence stops and time breaches apart from test failures. Then the topic brings each measure under the aim (balanced component shards, a narrower second-zone run, the tool's slowest test files split, the quick check's steps trimmed) and arms each gate's fail as its measure gets under.

## User stories

1. As the user, I want CI's unit job to warn past 5 minutes and fail past 6, so that the unit tests can't quietly grow past what I'll wait for (B-837).
2. As the user, I want each component shard's test step gated the same way, so that the component tests stay near 5 minutes per shard (B-837).
3. As the user, I want the local quick check gated the same way, judged only on a quiet machine, so that load never reads as growth (B-837).
4. As an orchestrator, I want a breach to name the gate, the seconds, and the slowest files (or steps), so that the fix is obvious (B-837).
5. As the user, I want the component shards balanced by past durations and the second zone's every-run set narrowed to its zone-sensitive files, so that no shard runs 10 to 12 minutes (B-772).
6. As the user, I want CI's unit job under 5 minutes, so that its gate can be armed (B-837).
7. As the user, I want the local quick check under 5 minutes on a quiet machine, so that its gate can be armed (B-837; built in `test-time-gates-2`, from the step times this topic records).
8. As the user, I want `pnpm prd check --times` and `pnpm prd metrics` to count budget stops, silence stops and time breaches apart from test failures, so that slowness and breakage read separately (B-781).
9. As a reviewer, I want a test that fails when a guard that reads source by path (`sync-matrix.test.mjs`, `rolesSql.test.ts`) leaves the projects every quick check runs, so that a new synced table can't pass a quick check with its guard unrun (B-370).

## Implementation decisions

- **The time gate** (a deep, pure module beside the check budget): in, a measure's name, its seconds, the load at start and end (local only), and the measure's limits; out, a verdict (`ok`, `warn`, `fail`, `unjudged`) and the lines to print: the measure, the seconds against the aim and the cutoff, and the slowest files or steps it was given (ten at most). A `fail` on an unarmed measure comes back as `warn` with "not armed" said.
- **The gates' data:** the three measures (`unit`, `components`, `quick`), each with its aim, cutoff and armed switch, and the quiet load threshold, in the project's config where the core already reads its tier data. The local measure covers the `quick` and `slice` check modes.
- **The check body** writes each step's seconds and, for the test steps, the slowest files from Vitest's JSON report into the check's state directory, next to `step`, `failed` and `flaky`.
- **The check runner** applies the gate to a finished quick or slice check, prints its lines, exits non-zero on an armed `fail` (kind `time`), and logs two more fields: the gate's verdict, and the step times. The log stays readable with its older lines.
- **CI's test-job wrapper** times its Vitest run (the step, not the install), reads the slowest files from its own report, writes the gate's result beside the report, prints it in the job summary, and fails the job on an armed `fail`. The verdict reads that file: a `time` failure is its own kind in the verdict, never a flake and never blamed on a commit as a test failure.
- **The check log's summary and metrics** split their failures into test failures, budget stops, silence stops and time breaches, by mode and by PRD.
- **Component shards:** a custom Vitest sequencer whose shard step balances files by past durations from a committed table, falling back to file count for a file with none; a command refreshes the table from a CI run's component reports. The second zone's every-run list shrinks to the files that test zone-dependent behaviour; the release tier's zone-component jobs still run the second zone over every component file.
- **The tool's slow test files** split along their existing `describe` groups so Vitest's workers can spread them; no test changes what it asserts.
- **The quick check's trim** (in `test-time-gates-2`) follows the step times the log now holds; the expected wins are the tooling step (from the split) and running the integration step beside the unit tests.
- **The guard test:** reads the Vitest projects and the quick check's project list, and fails when either guard isn't in a project every quick check runs.

## Testing decisions

- The time gate: unit tests over its pure function (each verdict, the quiet rule, unarmed fails, the slowest-files lines), as `check-budget.test.mjs` does for the budget.
- The check runner and the check body: their existing script tests (`check-run.test.mjs`, `check-body.test.mjs`) with a stubbed clock and a stubbed command, for the new fields, the printed lines and the exit code.
- The check log summary and metrics: their existing unit tests with log lines of each kind.
- The test-job wrapper and the verdict: their unit tests and the verdict fixtures, for a `time` failure's kind and its summary.
- The sequencer: unit tests over its shard split (balance by durations, the fallback, a stable result for the same input).
- The split tool tests and the trimmed steps prove themselves by the measured times, recorded in the plan's _Status_, and by the same test counts before and after.
- No browser check: nothing here crosses the server and sync.

## Out of scope

- Per-test time limits (Vitest's `testTimeout` stays as it is).
- Gating the integration job, the browser checks or the full check.
- Moving the tool's tests out of this repo (the Risa split, B-543).
- Integration test speed beyond what the quick check's trim needs.
- **Moved to `test-time-gates-2`** (after this topic, to keep this one at six slices): the component shards' fallback if balancing leaves a shard over the aim (a fourth shard, or trims of the slowest timeline and planner files), the quick check's trim, and arming `components` and `quick`.

## Notes

- Measured on 710c7971: CI's unit test step 297 to 355 s (Vitest: 354 s, 450 files); `tooling:unit` files sum to 666 s, `land.test.mjs` 232 s, `recover` 54, `rotate` 48, `dispatch` 40; the other unit projects together about 50 s. Component shards on one run: 389, 502 and 470 s; B-772 records 10 to 12 minutes for shard 2 on others. Local quick checks on `prd/` branches: 500 to 714 s at loads 17 to 30 (none quiet).
- B-772's runner-speed note (about 30% between runners) is why the gates warn a minute before they fail.
