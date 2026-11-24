# Plan: Recover by itself and land safely (self-recovery)

> Source PRD: [`plans/self-recovery-prd.md`](self-recovery-prd.md). User-story numbers (US) refer to it. Backlog items B-407, B-433 (its signal), B-462, B-463.

## Status

| Slice | Wave | State          | Merge into `prd/self-recovery` (slice commits)                                              |
| ----- | ---- | -------------- | ------------------------------------------------------------------------------------------- |
| 1     | 1    | merged (opus)  | 160c54d7 (c1fe984d)                                                                         |
| 2     | 1    | merged (opus)  | 997e1b2e (24ec786e); conflicts in inventory.mjs, its test, recover.sh resolved keeping both |
| 3     | 1    | merged (opus)  | 2221f009 (67595728)                                                                         |
| 4     | 2    | merged (opus)  | 6addf780 (0dbc6afb)                                                                         |
| 5     | 2    | merged (opus)  | 3591bb90 (68db32a5, 8e254a89)                                                               |
| 6     | 3    | working (opus) | —                                                                                           |

**Landing mode:** run everything through (started by the dispatcher, 2026-11-24): start every ready slice, land each green wave, ask only real questions via `pnpm prd ask`.

**Now (2026-11-24):** wave 2 landed in dev as 1825b781 (PR #171). **Wave 3 started:** boundary done (ingest: nothing new; sync: up to date with dev). Slice 6 worktree `self-recovery-6` made, agent spawned on opus with the notes below and B-786 (claimed, folded into slice 6). Watch running. Next: merge slice 6, CI tier from `pnpm prd tier` (tooling-only: `pnpm test:tooling`), PR, land; then `pnpm backlog done B-407 B-786`, `pnpm prd rm self-recovery`, `pnpm prd end`.

**Wave 2 docs:** folded into recovery.md (watchdog, autostart, `down --stay`, the drain) with a pointer in machinery.md's pick (at its budget, trimmed). **For slice 6:** `clearStalled` the `error: limited` marks after the reset, and claim those sessions before the ordinary reopen rule counts them as reopens. **Follow-ups:** slice 4's `limitedOf` could use slice 5's `readDrain`/`probeAllowed`; pre-existing `prd.sh help` prints `line 17: design: command not found`.

**Backlog:** claim B-407 when slice 1 starts, B-462 and B-463 when slice 2 starts, B-433 when slice 3 starts. `done` B-462 and B-463 when slice 2 merges, B-433 when slice 3 merges, B-407 when the last of slices 1, 2, 4, 5 and 6 merges.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, its tests and prompts. No app code, migration or dependency.
- **Pure decision, thin command:** landing resume, watchdog, usage parsing, drain and resume are functions tested alone.
- **Git wins:** a marker says where to look; git and GitHub say what happened.
- **Watching never hurts the work:** a failed reading or write never fails a session or a command.
- **A landing is never stopped** by the drain, the watchdog or a resume.
- **A deliberate stop wins:** paused, stay-down or a clean end means nothing restarts.
- **Tests never touch** the real LaunchAgents, logs, session records, asks or transcripts; all fixtures are fictional.

## How to run this plan

Starts after `test-gates`, `agent-autonomy` and `agent-autonomy-2` land. Wave 1 is slices 1, 2 and 3; wave 2 is slices 4 and 5; wave 3 is slice 6. Each landing runs `pnpm test:tooling` and `pnpm exec eslint scripts`.

**Who owns what:** slice 1 owns `land.sh`; slice 2 owns `recover.sh` and the inventory's actions (slice 1 adds only its landing fact); slice 3 owns the wrapper's settings; slice 5 owns the dispatcher's drain step, and slice 6 adds its resume step. New `prd.sh` commands are additive, at the end of the case.

**Hot files:** `scripts/loops/recover`, `land.sh`, `lib.sh`, `session`, `open-session`, `dispatch`, `prd.sh`, `inventory`, `down.sh`, `new.sh`, `status-extra`, `prompt.sh`.

Loops don't edit `docs/`: each hand-off gives the steps for [recovery](../docs/agents/recovery.md), [machinery](../docs/agents/machinery.md) and [orchestrator](../docs/agents/orchestrator.md), and the orchestrator folds them in at landing with a trim.

## Slice 1: A cut-off landing can be finished or undone

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/machinery.md, docs/agents/recovery.md · Tests: unit

**User stories:** US 10.

**Build:** the PRD's _landing journal_, its fact in the inventory, `pnpm prd land --resume <branch>`, and the resume prompts running it first.

**Acceptance criteria:**

- Unit tests: the resume decision for every step on the PR and local paths, including a PR merged with no dev sync, and an unknown state returning `ask`.
- Land tests (stub `gh`): a landing killed after each step resumes to one merge and a synced dev; an unmerged one is undone and must go through `land` again; `MERGE_HEAD` other than the recorded tip is never aborted.

**Blocked by:** none. **Blocks:** slices 5, 6.

## Slice 2: Recover is safe to run unattended

Stack: no · Reads: docs/agents/recovery.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 4, 5, 11.

**Build:** _Unattended recover_: the single-instance lock, `--unattended`, the gated dispatcher action (B-462), its persisted intent (B-463), the wait for its lock before the recovery agent opens; _The migrate marker_.

**Acceptance criteria:**

- Recover tests: a failed test-Postgres, stack or server step leaves the dispatcher closed with its intent kept; a failed reopen keeps the intent and the next run retries it; a second recover exits without acting; `--unattended` needs no terminal and files one report on failure; the agent opens only after the dispatcher holds its lock; a migrate marker left behind is reported and rerun.

**Blocked by:** none. **Blocks:** slice 4.

## Slice 3: The usage reading

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** US 6, 7.

**Build:** _The usage reader_, `pnpm prd usage` and the status line. First confirm the live status-line and `StopFailure` input against the installed Claude Code.

**Acceptance criteria:**

- Unit tests: the parser on full, partial, missing and malformed input; stale reads as unknown; an older reading never lowers a newer one for the same reset; a stalled mark takes the reset from the last reading when it has none.
- Script tests: the command exits 0 and writes atomically on bad input; status shows usage, unknown and the reset time.

**Blocked by:** none. **Blocks:** slices 4, 5.

## Slice 4: The machine brings itself back

Stack: no · Reads: docs/agents/recovery.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 1, 2, 3.

**Build:** _The watchdog_, `pnpm prd autostart install|remove|status`, `pnpm prd down --stay`.

**Acceptance criteria:**

- Unit tests: the watchdog decision for a reboot after a down record, a down record with no reboot yet, a crash, a clean `dispatch --stop`, ended sessions, paused, stay-down, recover running, limited, all healthy, and back-off.
- Script tests (stub `launchctl`, a temp LaunchAgents folder): install writes a valid plist that keeps child processes and has the full path, is idempotent, and remove leaves nothing behind; `status` names a tool that doesn't resolve.

**Blocked by:** slices 2, 3. **Blocks:** none.

## Slice 5: Drain before a limit

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 8.

**Build:** _The drain decision_ and _Past the plan limit_: the stop line, ending managed sessions, the report on hand-opened ones, no `claude -p` probe while limited.

**Acceptance criteria:**

- Unit tests: `normal`, `draining` and `limited` at the thresholds; unknown doesn't drain and files one report; no start, plan or reopen while draining.
- Dispatcher tests: a new slice worktree is refused while draining; a session in a landing is never stopped.
- Dispatcher tests (stub sessions): at the stop line or on overage, each managed session is ended and marked stalled, one in a landing only after it finishes; a hand-opened session is never ended and gets one report; nothing runs `claude -p` while limited.

**Blocked by:** slices 1, 3. **Blocks:** slice 6.

## Slice 6: Resume after a limit

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 9.

**Build:** _Resume after a limit_.

**Acceptance criteria:**

- Unit tests: the resume decision after the reset, one per tick, not counted toward the reopen limit.
- Dispatcher tests (stub opener): a stalled managed session reopens with `--continue` and the carry-on prompt; a session in a `pnpm prd` command or with a landing marker is left alone; a hand-opened session is only reported.

**Blocked by:** slices 1, 5. **Blocks:** none.
