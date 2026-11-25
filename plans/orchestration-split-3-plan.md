# Plan: Orchestration split 3 (stage 1c, the browser runner, the host layer and the renames)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split-3`, after `orchestration-split-2`. Then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**On hold** (registry row `orchestration-split-3`, flag `hold`, after `orchestration-split-2`): the user lifts it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Slices 4 and 5 are scripted renames: sonnet candidates once the script is written and reviewed. Slice 1 splits a 600-line gate: the likely Fable candidate.

| Slice | Wave | State   | Merge into `prd/orchestration-split-3` |
| ----- | ---- | ------- | -------------------------------------- |
| 1     | 1    | planned |                                        |
| 2     | 1    | planned |                                        |
| 3     | 2    | planned |                                        |
| 4     | 3    | planned |                                        |
| 5     | 4    | planned |                                        |
| 6     | 2    | planned |                                        |

## Architectural decisions

As in [`orchestration-split-plan.md`](orchestration-split-plan.md), plus:

- **The browser runner splits** (asked): Caretook owns a plain runner in `scripts/project/` (run these named checks with Playwright, write the results); the core owns the gate around it (load wait, caps, retries, hang watchdog, lease) and calls the runner through the config's browser hook. GitHub CI calls the plain runner with no lease, as today.
- **Scripted renames are one change each**, checked by the lint, not split by file count.

## How to run this plan

- **Start only when** `orchestration-split-2` has landed and the tooling is quiet. **Slice 6 moves `scripts/loops/check-areas.d/` and the checks manifest,** which PRDs add to (_Rules across PRDs_; 84 and 45 commits in two weeks): it starts only when no running PRD or fixes wave has an unlanded change to either, and its landing updates that rule in [orchestrator](../docs/agents/orchestrator.md).
- **Wave 1:** slices 1 and 2 (1 owns `browser.sh`, `serve.sh`'s built mode, `scripts/ci/browser-job.mjs` and the browser tests; 2 owns the session opener, autostart, notifications, asks and the dispatcher's host calls). **Wave 2:** slices 3 and 6 (3: the CLIs, Node and Claude Code's files; `lib.sh`, the dispatcher, review, landing, `session.sh`, `usage.mjs`, `context.mjs`. 6: the checks manifest, `check-areas.d/`, the check plan's rules file, `ci.yml`'s lint step and the deploy workflow test). **Wave 3:** slice 4. **Wave 4:** slice 5.
- **Waves 3 and 4 run with the dispatcher paused** (`pnpm prd dispatch --pause`) and no other slice or PRD running: they rename what running sessions read. The orchestrator resumes it after each.
- **Tiers** (what the check plan proposes, once at landing): wave 1 touches `scripts/ci/`: `full`; wave 2 touches `.github/`: `full`; waves 3 and 4 touch `vitest.config.ts` and `.github/`: `full`. Every wave runs `pnpm test:tooling`.
- **Other worktrees** (PRD _Decisions_): wave 1 moves the browser runner every worktree calls; it lands only when no other worktree is open, or each is synced with `dev` right after.
- **Docs at the last landing:** [machinery](../docs/agents/machinery.md) (the browser hook, the host layer, `RISA_*`, the command names, the residual list), [orchestrator](../docs/agents/orchestrator.md), [loop](../docs/agents/loop.md), [hotfix](../docs/agents/hotfix.md), [orchestration](../docs/orchestration.md), `pnpm prd help`.

## Slice 1: The browser runner split

Stack: yes · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 3, 6.

**What to build**

- `browser.sh` splits (_Architectural decisions_); Caretook's CI browser job calls the plain runner.
- The browser-check tests move with the runner; the gate's tests use the sample project. The check data's move is slice 6.

**Acceptance criteria**

- `pnpm prd browser --changed --list` gives the same answer as before on a sample diff; one check passes through the gate on a stack; the plain runner runs one check with no `.loops/`; the CI browser job spawns only the plain runner; the touched files leave the allowlist.

**Blocked by:** `orchestration-split-2`. **Blocks:** 4, 6.

## Slice 2: The host layer, part 1: tabs, autostart, notifications

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5.

**What to build**

- One core host module for opening tabs (iTerm2, osascript), autostart (launchd) and notifications; the session opener, autostart, asks and the dispatcher (its helper session and its tab checks) call it. Today `osascript` and `launchctl` are called from `ask.mjs`, `autostart.mjs`, `dispatch.mjs` and `open-session.sh`.

**Acceptance criteria**

- The session, autostart, ask and dispatch tests pass unchanged; a lint rule: no other core file calls `osascript` or `launchctl`.

**Blocked by:** `orchestration-split-2`. **Blocks:** 3.

## Slice 3: The host layer, part 2: the CLIs, Node and Claude Code's files

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5.

**What to build**

- The host module gains running `claude`, `codex` and `gh` and choosing Node (nvm); the dispatcher, review, landing and `lib.sh` call it.
- Where Claude Code keeps its own files is the host module's too: its config folder, the project transcripts, and the session settings files (`context-settings.json`, `inbox-settings.json`) whose status line and hooks feed `usage.mjs` and `context.mjs`. The shape Claude Code hands a status line and a `StopFailure` hook is read in one place.

**Acceptance criteria**

- The dispatch, review and landing tests pass unchanged; the usage, context and drain tests pass unchanged; the lint rule extends: no other core file calls the three CLIs directly or names Claude Code's folders.

**Blocked by:** 2. **Blocks:** 4.

## Slice 4: `RISA_*`

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 4.

**What to build**

- A scripted rename of every tool knob from `CARETOOK_*` to `RISA_*`, no fallback, in the core, Caretook's code that reads them (`LEASES`, `LOAD_GATE`, `NOTICES_DIR`, `SESSION_NAME`), `vitest.config.ts`, CI and the docs. The variables Caretook owns (the PRD's _Decisions_ list) keep their names.
- Generic tests' Caretook-like sample paths become neutral ones.
- The inbox folder outside the repo, `~/.caretook/inbox`, becomes `~/.risa/inbox` (PRD _Decisions_): the slice moves the default; the orchestrator asks the user to move the folder and to tell Claude Code once to trust the new one, before the dispatcher resumes.

**Acceptance criteria**

- No `CARETOOK_` and no `.caretook` remain in a core file; `pnpm test:tooling` passes; the `full` tier passes once at landing; after the resume, the inbox session reopens in the new folder.

**Blocked by:** 1, 3, 6. **Blocks:** 5.

## Slice 5: The command-name sweep and the residual list

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 2, 8.

**What to build**

- A scripted sweep: every printed `pnpm prd` and `pnpm backlog` in the core (about 640 outside tests: prompts, hints, help, errors, worktree creation, readiness; the generic role docs too) goes through the command-name helper.
- The allowlist ends as the PRD's **named residual list** only: each remaining line with the file, the line and why it waits for the move (`package.json` scripts, the Vitest tooling projects, `ci.yml`'s tooling jobs, `tiers.mjs`, the deploy workflow test). The core's tests run on the sample project.

**Acceptance criteria**

- The lint passes with only the residual list, and gains a rule: no core file outside tests holds the literal `pnpm prd` or `pnpm backlog`. With the command names set to `risa` in the sample project, its golden and `doc <role>` name only `risa`; both goldens pass.

**Blocked by:** 4. **Blocks:** the move.

## Slice 6: The check data moves

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 3, 6.

**What to build**

- The checks manifest and `check-areas.d/` move to `scripts/project/`; their config paths change, and so do the check plan's rules that name them, `ci.yml`'s check-areas lint step, the browser job's manifest path and the deploy workflow test.
- _Rules across PRDs_ in [orchestrator](../docs/agents/orchestrator.md) names the new folder.

**Acceptance criteria**

- `pnpm prd browser --changed --list` and the check plan give the same answers as before on a sample diff; the check-areas lint passes in CI's form; every `node scripts/…` and `--import` line in `ci.yml` resolves to a Caretook-owned file outside the residual list; the touched files leave the allowlist.

**Blocked by:** 1 (the runner reads the manifest). **Blocks:** 4.
