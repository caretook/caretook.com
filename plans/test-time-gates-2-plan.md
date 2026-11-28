# Plan: Test time gates, part 2

PRD: [test-time-gates-2-prd.md](test-time-gates-2-prd.md). Items B-859, B-837, B-772. Starts after `test-time-gates` (done). The numbers it starts from are in the PRD's _Notes_ and [test-time-gates' _Status_](test-time-gates-plan.md#status).

## Status

**From the user:** none yet in this topic.

**Landing mode:** run everything through (started run-through by the dispatcher, 2026-11-28).

**Plan fix (2026-11-28):** the plan predates the Risa move; `ci`, `recover`, `rotate`, `dispatch`, `time-gate` and `tier-data` tests now live in ~/git/risa. Slice 1 drops `ci.test.mjs`. Slice 2 narrowed and slice 3's criterion moved to `pnpm test:tooling`, the backlog session agreeing (2026-11-28). The quiet rule (loops/time-gate.mjs:77 needs a quiet start and end) was sent to Risa's backlog (Admiral Marcus) : filed as RISA-1065 (time gate judges the local measure on its start load only, fixes-bug); the test split is RISA-1066 (fixes-tooling). Risa's backlog notifies backlog (caretook) when RISA-1065 ships in a tag.

**Models:** slice 1 opus.

**Slice 1 (merged cd093268c, 2026-11-28):** requested `components` run 46162250609 on b176b461 (`flake`: the brake-listed `search.sync` perf test and `resetStaging.int.test.ts`, neither ours). Test-step seconds: shard 1 323 (warn), 2 305 (warn), 3 199, 4 208; 262 files, 2580 tests. The three-shard count from 45760650119 (220 files, 2198 tests) is 2009 commits old; the nearest three-shard run, free-limits' 46160525942 on 25aab0f1, had 260 files and 2571 tests (5 files differ). Slice 3 refreshes the table from 46162250609. Its quick check was judged under today's rule (125 s, ok), with no `tooling` step. Note: slice shells inherit `RISA_CONFIG`/`RISA_SESSION_*` from this session; unset them in slice prompts.

**Slice 2 (merged 340667590, 2026-11-28):** the measuring quick check on 134128d4c (window a403, "now", decided for you, skeptic s91): judged `ok`, 142 s; loads 3.09 start, 5.41 end on 10 cores; steps typegen 1, static 80, count 2, unit 37, lint 1, docs 0, tooling 12. `quick` armed (8c1e1f5fa); `pnpm test:tooling` passes (605 tests). It didn't need RISA-1065.

**Wave 1 gate:** `full` run 46163542256 on 79689c45: green. Test steps: components-1 231 s, -2 208, -3 223, -4 234; unit-1 47, unit-2 65. Synced with dev (9ac370aa9, brought migration 0050); the `full` recheck on the synced tip is running.

| Slice                                        | Wave | State   | Merge     |
| -------------------------------------------- | ---- | ------- | --------- |
| 1. Four component shards                     | 1    | merged  | cd093268c |
| 2. The quick gate armed                      | 1    | merged  | 340667590 |
| 3. The durations refreshed; components armed | 2    | planned | —         |

## Architectural decisions

- **The limits stay:** aim 300 s, warn past 300, fail past 360, for every measure. This topic only brings measures under and arms them.
- **Armed by data, on a measured run:** a slice arms its measure (`armed: true` in the gates' data) only after a run it records in _Status_ shows the measure at most 275 s. That leaves room for a runner about 30% slower to stay under the 360 s cutoff. Over 275 s, it records the times, leaves the measure unarmed and files the rest in `fixes-perf`.
- **Quiet start only, locally:** after slice 2, the gate judges a local check whose start load is quiet (the user's call, a255: the end load counts the check's own work). A quick check counts only when the gate judged it (`ok`, `warn` or `fail`, never `unjudged`) and its step times show a `tooling` field.
- **No test changes what it asserts:** a shard change or a file split keeps the same test count, checked before and after.

## How to run this plan

- **Wave 1:** slices 1 and 2, side by side. Slice 1 owns the workflow's component jobs, the tier data's job list, the tier plan's outputs and the test fixtures naming the shards. Slice 2 owns the gates' `quick` line.
- **Slice 2's quiet window:** its measuring run waits until slice 1 has handed off, so slice 1's own checks don't load the machine. Then the orchestrator asks the user for a quiet window (`pnpm prd ask --defaults`, recommending "now": `pnpm prd dispatch --pause` stops new starts, but running sessions still load the machine, so the user picks the time). Once it's quiet, the loop runs its quick check. That check's diff touches the tooling, so the tooling step runs. If the gate didn't judge it (a busy start), or its step times have no `tooling` field, the run doesn't count: ask once more, and after a second miss record the times, leave `quick` unarmed and file a `fixes-perf` item.
- **Wave 2:** slice 3, on `prd/test-time-gates-2` after slice 1 merged. It reads the four-shard run slice 1 recorded, refreshes the table, and makes the arming run.
- **Wave gates:** a requested `full` CI run on `prd/test-time-gates-2` each wave. Its shard times and unit times go in _Status_; with `components` armed, a shard past 360 s fails it as `time`.
- **Items at landing:** B-859, B-837 and B-772 close when both measures are armed. An unarmed measure stays open in `fixes-perf` as a new item naming its last times, and B-837 closes with a note pointing to it.
- **Doc folds at landing:** the components doc (four shards; the table refreshed from run N) and the runbook's shard line; the machinery doc's gates line (which measures are armed, and the quiet rule's start load only).

## Slice 1: Four component shards

Stack: no · Reads: docs/domain/components.md, docs/agents/machinery.md · Tests: unit

User stories 1.

**What to build:** CI's components tier runs a fourth shard (PRD _Implementation decisions_, "Component shards"): the workflow's job (a copy of the third, `--shard=N/4` on every shard), the jobs the final gate waits on, the tier data's job list, and the tier plan's outputs (the narrowed first shard alone, the rest together). The verdict takes its required jobs from the tier data, so the verdict's and the browser job's fixtures name four shards. Release's zone-component jobs keep two shards. About 8 files: the workflow, the tier data, the tier plan, and the tests over them. The durations table and the docs aren't this slice's.

**Acceptance criteria:**

- `tiers.test.mjs` and the workflows' test pass with four component jobs: a `components` tier plans all four, and a narrowed one only the first.
- `verdict.test.mjs` and `browser-job.test.mjs` pass with fixtures naming `components-1` to `-4`.
- `shards.test.mjs`: a four-shard split from a durations table differs by at most the largest file, and the same input gives the same shards.
- One requested `components` run from the branch: every shard's test-step seconds and its run id in _Status_ (slice 3 refreshes from it), and the component test count across the four shards equals the three-shard count from test-time-gates' last `full` run (both numbers in the hand-off).

**Blocked by:** none. **Blocks:** 3.

## Slice 2: The quick gate armed

Stack: no · Reads: docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

User stories 3, 4, 5.

**What to build:** (narrowed 2026-11-28, the backlog session agreeing: the quiet rule and the tooling test split are Risa's now, filed with Risa's backlog; the time gate and those tests live in ~/git/risa.) One quick check is measured in a quiet window (PRD _Implementation decisions_, "The quick check's measurement"; _How to run this plan_ for when and the bounded retry), with a diff that touches the tooling so the tooling step runs. Then `quick` is armed in `scripts/ci/tiers.json`'s gates. A further speed-up goes to `fixes-perf`.

**Acceptance criteria:**

- The quiet quick check's total and step times (from the check log) in _Status_: judged (not `unjudged`), with a `tooling` field.
- `pnpm test:tooling` (its project check) passes with `quick` armed.
- `quick` armed only if the judged run is at most 275 s; otherwise the times recorded, left unarmed and a `fixes-perf` item filed naming the slowest steps and files.

**Blocked by:** slice 1's hand-off (for the measuring run), and a pinned Risa release carrying the quiet rule, unless a quiet run is judged under today's rule (a quiet start and end): then it arms without waiting. **Blocks:** none.

## Slice 3: The durations refreshed; components armed

Stack: no · Reads: docs/domain/components.md · Tests: unit

User stories 1, 2, 5.

**What to build:** the durations table refreshed from slice 1's four-shard run with the balancer's refresh command (PRD _Implementation decisions_, "The durations table"). Then one requested `components` run on the refreshed table arms `components` if its slowest shard is at most 275 s (PRD _Implementation decisions_, "Arming").

**Acceptance criteria:**

- The refreshed table holds `web:components:ny` entries only for the six files the New York project runs, and `shards.test.mjs` still passes.
- `pnpm test:tooling` (its project check) passes with `components` armed (when it is).
- One requested `components` run on the refreshed table: every shard's test-step seconds in _Status_. `components` is armed if the slowest is at most 275 s; otherwise the times are recorded, the gate left unarmed and a `fixes-perf` item filed naming the slowest files.

**Blocked by:** 1. **Blocks:** none.
