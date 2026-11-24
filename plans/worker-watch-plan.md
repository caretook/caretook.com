# Plan: Run metrics and stuck workers (worker-watch)

> Source PRD: [`plans/worker-watch-prd.md`](worker-watch-prd.md). User-story numbers (US) refer to it. Backlog items B-434 and B-408.

## Status

| Slice | Wave | State          | Merge into `prd/worker-watch` (slice commits) |
| ----- | ---- | -------------- | --------------------------------------------- |
| 1     | 1    | merged         | 0d93242f (6023a2b1, e397e1d5, e90ae361)       |
| 2     | 2    | merged (opus)  | 5310ab85 (893c22ff)                           |
| 3     | 2    | merged (opus)  | ac7b0b0c (d4819e33, b06de0b6)                 |
| 4     | 3    | started (opus) | —                                             |
| 5     | 4    | —              | —                                             |
| 6     | 4    | —              | —                                             |

**Landing mode:** run everything through (started by the dispatcher): start every ready slice, land each green wave, ask only real questions via `pnpm prd ask`.

**Wave 1 landed** in dev as cd94065 through PR #163 (2026-11-24; tier `integration`; Codex out of credits, `--no-review`; report a196).

**Wave 2 landed** in dev as a62226f5 through PR #165 (2026-11-24; tier none; gate `pnpm test:tooling` 85 files / 2051 tests and `eslint scripts` clean on 9b04ab45; Codex out of credits, `--no-review`; report a197; to-test `2026-11-24-1554-worker-watch.md`). Docs folded into machinery (check limits, 16 fields, the heartbeat, WORKERS), trimmed to 15,360 B, its budget exactly: the next fold must trim as much. Slice worktrees 2 and 3 removed. Follow-up filed: B-781 (count budget and silence stops apart in `--times` and `metrics`), `fixes-tooling`, triaged.

**Wave 3 under way** (slice 4, the watch; opus): boundary done 2026-11-24 (ingest: nothing new; no new worker-watch items; sync: up to date); worktree worker-watch-4 made and agent spawned. Notes for slice 4: the reader is `workers.mjs` (`factsOf` pure, `workerFacts` gathers; `unknown` when no heartbeat names a slice worktree, which the watch never acts on); heartbeats live in `.loops/.heartbeat/<session>/<agent>.json` and exist only for sessions started after a62226f5; check breaches log a 16th field (`budget`/`silence`); `usualTime(data, {kind, mode, branchKind, last})` in `metrics.mjs`; tests whose throwaway repo doesn't ignore `.loops/` set `CARETOOK_RUN_LOG`; `pnpm prd watch` is still the old `status-watch` alias (slice 4 replaces it); a throwaway-repo test that copies `context.mjs` must copy `heartbeat.mjs` too. Slice 3 was 13 files (the hook warns past 12): keep slice 4 tighter.

**Backlog:** claim B-434 when slice 1 starts and B-408 when slice 2 starts; `done` B-434 when slice 1 merges and B-408 when the last of slices 5 and 6 merges.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, its tests and prompts. No app code, migration or dependency.
- **Pure decision, thin command:** the metrics summary, the budget, the watch decision and the dispatcher's stuck decision are functions tested alone.
- **Watching never hurts the work:** a failed log write or heartbeat never fails a command or a tool call.
- **Nothing here resets, cleans or removes a worktree.** A restart keeps every file, and two agents never share a worktree.
- **A landing is never stopped** by a budget, the watch or the dispatcher.
- **When in doubt, don't restart:** an unknown, handed-off or still-active agent is never restarted automatically.
- **Tests never touch** the real logs, session records, asks or sessions; all fixtures are fictional.

## How to run this plan

Starts after `test-gates`, `agent-autonomy-2` and `agent-autonomy-3` land. Wave 1 is slice 1, wave 2 is slices 2 and 3, wave 3 is slice 4, and wave 4 is slices 5 and 6. Each landing runs `pnpm test:tooling` and `pnpm exec eslint scripts`.

**Hot files:** `scripts/loops/prompt.sh`, `prd.sh`, `check-times`, `check-run`, `check-body`, `land.sh`, `review.sh`, `browser.sh`, `new.sh`, `rm.sh`, `status-extra`, `dispatch`, `context`, `skeptic`, `ask`.

Loops don't edit `docs/`: slice 5's hand-off gives the handbook steps, and the orchestrator folds them in at landing with a trim.

## Slice 1: The run log and `pnpm prd metrics`

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 1, 2, 3.

**Build:**

- The append-only run log and its writer.
- Events: slice started and ended (creating and removing a slice worktree), landing started and ended (`land`), a browser check's result, and a Codex verdict from `review`, once per PR and head.
- `pnpm prd metrics [--since <date>] [--json]`: slice and landing durations (count, median, slowest), check times, flake rate by check and overall (check flakes from test-gates' log fields), and how many reviewed heads had findings. Out-of-credits verdicts are shown apart.
- The usual-time lookup the later slices use, by mode and branch kind.

**Acceptance criteria:**

- `metrics.test.mjs`: the summary, flake rate, find rate and usual time from fixtures, including old flake lines; malformed lines counted and skipped; `--since` honoured.
- `run-log.test.mjs`: events append; a failed write leaves the caller's exit unchanged.
- `land.test.mjs`: a landing records start and end, and a failed one records its failure.
- A review test: polling one head several times records one verdict.
- `browser.test.mjs`: a pass, a flaky pass and a failure each record their result.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 2, 3.

## Slice 2: A check stops at its budget

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** US 4.

**Build:**

- Measure the longest silent stretch of a full check first, and give it in the hand-off; it sets the silence limit's default.
- The budget from the usual time, scaled for load, between the floor and test-gates' hard limit.
- A silence limit on the check's output, scaled the same way.
- A breach stops the check and its children, logs its own reason and prints the step and last 30 lines. A machine sleep doesn't count against either limit.

**Acceptance criteria:**

- `check-budget.test.mjs`: the median, the slowest passing run, branch kinds, load scaling, floor, ceiling and too-few-samples cases.
- `check-run.test.mjs`: a stub that hangs is stopped at its silence limit and at its budget, leaves no child running, and logs the reason; a slow check that keeps printing and stays inside its budget passes; a simulated sleep gap doesn't breach.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.

## Slice 3: The heartbeat and status

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 5.

**Build:**

- Read the current Claude Code hook documentation, then extend the context hook: a tool call records the agent, worktree, start and end; a subagent's stop records that it stopped. If a slice agent can't be identified, say so in the hand-off; the watch then treats it as unknown.
- A reader that gathers each worker's facts: heartbeat, running commands (including a live process in the worktree), leases, commits and tracked or unignored file changes.
- `pnpm prd status` shows every lease holder, `pnpm prd` command under a session and slice agent, with age, usual time and state.

**Acceptance criteria:**

- A hook test with fixture input: start, end and stop are written, and bad input exits 0 silently.
- A reader test: a change to an ignored file is not progress; a started, unfinished call is a running command; a live process in the worktree counts.
- `status-extra.test.mjs`: the new lines, and nothing when no worker is running.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** 4.

## Slice 4: The watch

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 6.

**Build:**

- The pure watch decision, including every never-acted-on case, the sleep gap and all quiet at once.
- `pnpm prd watch [<topic>] [--json] [--wait] [--mark <slice> nudged|replied|restarted|left|asked]`, with the per-topic marks.

**Acceptance criteria:**

- `watch.test.mjs`: every state and action, including a stopped agent, an unknown agent, a handed-off slice, a running command, a lease wait, a sleep gap, one quiet agent (acted on), two quiet agents (one finding, no restart), a dirty tree, an agent active without progress (`skeptic`), a replied nudge (no restart) and a second stall.
- Marks survive a new process; a "left" slice is rechecked at its time; an open ask means no action.
- `watch --wait` exits with the action on a fixture stall.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 5, 6.

## Slice 5: The orchestrator nudges, restarts once and asks a skeptic

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/machinery.md, docs/agents/preferences.md · Tests: unit

**User stories:** US 7, 8.

**Build:**

- The orchestrator prompt: run `watch --wait` in the background during a wave, then follow its action, marking first and confirming a stop before spawning the `--continue` agent. The handbook wording goes in the hand-off.
- A `stall` kind for the skeptic's brief and record, with the evidence and the verdicts restart, leave or ask. A never-list step can only be "ask".
- `pnpm prd ask` accepts a `stall` "ask" verdict.
- A second restart of a slice is refused.

**Acceptance criteria:**

- `prompt.test.mjs`: the orchestrator prompt carries the steps, and the resume prompt restarts the watch.
- A skeptic test: the `stall` brief and record, "restart" refused on a never-list step, and the `stall` "ask" accepted by `pnpm prd ask`.
- `watch.test.mjs`: a second restart becomes `skeptic`; an unconfirmed stop becomes `skeptic`.
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** nothing.

## Slice 6: The dispatcher catches a stuck orchestrator

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** US 9.

**Build:**

- The pure stuck-orchestrator decision in the dispatcher's tick, with the tick-gap reset and the several-quiet-at-once report.
- Its own question, which never defaults, with its own marker and state entry, apart from the reopen and context questions.
- "Rotate it now" through the existing mid-wave rotation and its guards; "leave it" leaves that stall alone; a refused rotation files one report.

**Acceptance criteria:**

- `dispatch.test.mjs`: a stuck session gets one question, including one whose only command is `watch --wait`, one whose slice agent is hung and one with a watch action unhandled; a session with a recent agent heartbeat, a running command or an open question gets none; a session with no heartbeat ever is left alone; a session opened by hand is ignored; a tick gap resets the clocks; several going quiet raise one report; each answer does what it says; a paused dispatcher does nothing.
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** nothing.
