# Plan: Orchestration split 3 (stage 1c, the browser runner, the host layer and the renames)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split-3`, after `orchestration-split-2`. Then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**On hold** (registry row `orchestration-split-3`, flag `hold`, after `orchestration-split-2`): the user lifts it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size.

| Slice | Wave | State   | Merge into `prd/orchestration-split-3` |
| ----- | ---- | ------- | -------------------------------------- |
| 1     | 1    | planned |                                        |
| 2     | 1    | planned |                                        |
| 3     | 2    | planned |                                        |
| 4     | 3    | planned |                                        |
| 5     | 4    | planned |                                        |

## Architectural decisions

As in [`orchestration-split-plan.md`](orchestration-split-plan.md), plus:

- **The browser runner splits** (asked): Caretook owns a plain runner in `scripts/project/` (run these named checks with Playwright, write the results); the core owns the gate around it (load wait, caps, retries, hang watchdog, lease) and calls the runner through the config's browser hook. GitHub CI calls the plain runner with no lease, as today.
- **Scripted renames are one change each**, checked by the lint, not split by file count.

## How to run this plan

- **Start only when** `orchestration-split-2` has landed and the tooling is quiet. **Slice 1 moves `scripts/loops/check-areas.d/`,** which every PRD adds to (_Rules across PRDs_): it starts only when no running PRD or fixes wave has an unlanded `check-areas.d` change, and its landing updates that rule in [orchestrator](../docs/agents/orchestrator.md).
- **Wave 1:** slices 1 and 2 (1 owns `browser.sh`, the checks manifest, `check-areas.d/`, the budgets data, `scripts/ci/browser-job.mjs` and `tiers.mjs`; 2 owns the session opener, autostart, notifications and asks). **Wave 2:** slice 3 (the CLIs and Node; `lib.sh`, the dispatcher, review, landing). **Wave 3:** slice 4. **Wave 4:** slice 5.
- **Waves 3 and 4 run with the dispatcher paused** (`pnpm prd dispatch --pause`) and no other slice or PRD running: they rename what running sessions read. The orchestrator resumes it after each.
- **Tiers** (the gate's, once at landing): wave 1 touches `scripts/ci/` (`full`); wave 2 tooling only; waves 3 and 4 touch `vitest.config.ts` and `.github/` (`full`).
- **Docs at the last landing:** [machinery](../docs/agents/machinery.md) (the browser hook, the host layer, `RISA_*`, the command names, the residual list), [orchestrator](../docs/agents/orchestrator.md), [loop](../docs/agents/loop.md), [hotfix](../docs/agents/hotfix.md), [orchestration](../docs/orchestration.md), `pnpm prd help`.

## Slice 1: The browser runner split and the check data

Stack: yes · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 3, 6.

**What to build**

- `browser.sh` splits (_Architectural decisions_); Caretook's CI browser job calls the plain runner.
- The checks manifest, `check-areas.d/` and doc budgets data move to `scripts/project/`; the core's gates read them through the config. The browser-check tests move with the runner; the gate's tests use the sample project.

**Acceptance criteria**

- `pnpm prd browser --changed --list` and the check plan give the same answers as before on a sample diff; one check passes through the gate on a stack; the plain runner runs one check with no `.loops/`; every `node scripts/…` and `--import` line in `ci.yml` resolves to a Caretook-owned file outside the residual list; the touched files leave the allowlist.

**Blocked by:** `orchestration-split-2`. **Blocks:** 4.

## Slice 2: The host layer, part 1: tabs, autostart, notifications

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5.

**What to build**

- One core host module for opening tabs (iTerm2, osascript), autostart (launchd) and notifications; the session opener, autostart and asks call it.

**Acceptance criteria**

- The session, autostart and ask tests pass unchanged; a lint rule: no other core file calls `osascript` or `launchctl`.

**Blocked by:** `orchestration-split-2`. **Blocks:** 3.

## Slice 3: The host layer, part 2: the CLIs and Node

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5.

**What to build**

- The host module gains running `claude`, `codex` and `gh` and choosing Node (nvm); the dispatcher, review, landing and `lib.sh` call it.

**Acceptance criteria**

- The dispatch, review and landing tests pass unchanged; the lint rule extends: no other core file calls the three CLIs directly.

**Blocked by:** 2. **Blocks:** 4.

## Slice 4: `RISA_*`

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 4.

**What to build**

- A scripted rename of every tool knob from `CARETOOK_*` to `RISA_*`, no fallback, in the core, Caretook's code that reads them (`LEASES`, `LOAD_GATE`, `NOTICES_DIR`, `SESSION_NAME`), `vitest.config.ts`, CI and the docs. The variables Caretook owns (the PRD's _Decisions_ list) keep their names.
- Generic tests' Caretook-like sample paths become neutral ones.

**Acceptance criteria**

- No `CARETOOK_` remains in a core file; `pnpm test:tooling` passes; the `full` tier passes once at landing.

**Blocked by:** 1, 3. **Blocks:** 5.

## Slice 5: The command-name sweep and the residual list

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 2, 8.

**What to build**

- A scripted sweep: every printed `pnpm prd` and `pnpm backlog` in the core (about 700 outside tests: prompts, hints, help, errors, worktree creation, readiness) goes through the command-name helper.
- The allowlist ends as the PRD's **named residual list** only: each remaining line with the file, the line and why it waits for the move (`package.json` scripts, the Vitest tooling projects, `ci.yml`'s tooling jobs, `tiers.mjs`, the deploy workflow test). The core's tests run on the sample project.

**Acceptance criteria**

- The lint passes with only the residual list; with the command names set to `risa` in a test config, no core output names `pnpm prd` or `pnpm backlog`; both goldens pass.

**Blocked by:** 4. **Blocks:** the move.
