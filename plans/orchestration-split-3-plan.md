# Plan: Orchestration split 3 (stage 1c, the browser runner, the host layer and the renames)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split-3`, after `orchestration-split-2`. Then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**On hold** (registry row `orchestration-split-3`, flag `hold`, after `orchestration-split-2`): the user lifts it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Slices 4 and 5 are scripted renames and slice 6 is moves: sonnet candidates once the script is written and reviewed. Slice 1 splits a 600-line gate: the likely Fable candidate.

| Slice | Wave | State   | Merge into `prd/orchestration-split-3` |
| ----- | ---- | ------- | -------------------------------------- |
| 1     | 1    | planned |                                        |
| 2     | 1    | planned |                                        |
| 3     | 2    | planned |                                        |
| 6     | 2    | planned |                                        |
| 7     | 3    | planned |                                        |
| 4     | 4    | planned |                                        |
| 5     | 5    | planned |                                        |

## Architectural decisions

As in [`orchestration-split-plan.md`](orchestration-split-plan.md), plus:

- **The browser runner splits** (asked): Caretook owns a plain runner in `scripts/project/` (run these named checks with Playwright, write the results); the core owns the gate around it (load wait, caps, retries, hang watchdog, lease) and calls the runner through the config's browser hook. GitHub CI calls the plain runner with no lease, as today.
- **Scripted renames are one change each**, checked by the lint, not split by file count.
- **Names shared between worktrees keep their values.** The backlog lock, the checked and inbox-merged markers, the launchd label and the commit-status context are built from the config's project name and stay exactly what they are today (`caretook-…`, `com.caretook.prd-watchdog`, `caretook-ci`), so an unsynced worktree, the watchdog and the statuses already on GitHub all still match.
- **Caretook's own scripts never use the core's helpers.** Where one prints a hint that names a tool command, it reads the command name from `risa.json` itself (a few lines), or the hint names no command.

## How to run this plan

- **Start only when** `orchestration-split-2` has landed and the tooling is quiet. **Slice 6 moves `scripts/loops/check-areas.d/` and the checks manifest,** which PRDs add to (_Rules across PRDs_; 84 and 45 commits in two weeks): it starts only when no running PRD or fixes wave has an unlanded change to either, and its landing updates that rule in the orchestrator doc.
- **Wave 1:** slices 1 and 2 (1 owns `browser.sh`, `scripts/ci/browser-job.mjs`, the browser tests and the places that name the harness test's path; 2 owns `open-session.sh`, `autostart.mjs`, `ask.mjs` and the dispatcher's tab and notification calls). **Wave 2:** slices 3 and 6 (3 owns the callers of `claude`, `codex`, `gh` and Node; 6 owns the checks manifest and its parser, `check-areas.d/`, the check plan's rules file, `ci.yml`'s lint step and the deploy workflow test). **Wave 3:** slice 7 (Claude Code's files). **Wave 4:** slice 4. **Wave 5:** slice 5.
- **Waves 4 and 5 run with the dispatcher paused** (`pnpm prd dispatch --pause`) and no other worktree of any kind open: they rename what running sessions read. The orchestrator resumes it after each.
- **Tiers** (what the check plan proposes, once at landing): waves 1, 2, 4 and 5 touch `scripts/ci/`, `.github/` or `vitest.config.ts` (the sweep rewrites hints in the core's CI code): `full`; wave 3 is tooling only. Every wave runs `pnpm test:tooling`.
- **Other worktrees** (PRD _Decisions_): wave 1 moves the browser runner; it lands only when no other PRD, plan or hotfix worktree is open.
- **Docs at the last landing:** the machinery doc (the browser hook, the host layer, `RISA_*`, the command names, the residual list), the orchestrator, loop and hotfix docs, the human guide, `pnpm prd help`; each edit in the generic doc or Caretook's additions, whichever it belongs to.

## Slice 1: The browser runner split

Stack: yes · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 3, 6.

**What to build**

- `browser.sh` splits (_Architectural decisions_); Caretook's CI browser job calls the plain runner.
- The browser-check tests move with the runner; the gate's tests use the sample project. Where the harness test splits or moves, every place that names its path changes with it: the Vitest project in `vitest.config.ts`, the tier data's file groups, the check plan's harness set (which also gains the runner's new path, so a change to it still asks for `integration`), `tooling-tests.mjs`'s configured project and the deploy workflow test.
- The check data's move is slice 6.

**Acceptance criteria**

- `pnpm prd browser --changed --list` gives the same answer as before on a sample diff; one check passes through the gate on a stack; the plain runner runs one check with no `.loops/`; the CI browser job spawns only the plain runner; `pnpm test:browser-harness` and CI's harness step run the same tests as before; a change to the plain runner proposes `integration`; the touched files leave the allowlist.

**Blocked by:** `orchestration-split-2`. **Blocks:** 4, 6.

## Slice 2: The host layer, part 1: tabs, autostart, notifications

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5.

**What to build**

- One core host module for opening tabs (iTerm2, osascript), autostart (launchd) and notifications; the session opener, autostart, asks and the dispatcher (its helper session and its tab checks) call it. Today `osascript` and `launchctl` are called from `ask.mjs`, `autostart.mjs`, `dispatch.mjs` and `open-session.sh`.

**Acceptance criteria**

- The session, autostart, ask and dispatch tests pass unchanged; a lint rule: no other core file calls `osascript` or `launchctl`.

**Blocked by:** `orchestration-split-2`. **Blocks:** 3.

## Slice 3: The host layer, part 2: the CLIs and Node

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5.

**What to build**

- The host module gains running `claude`, `codex` and `gh` and choosing Node (nvm). Its callers: `lib.sh`, `prd.sh`, `pr.sh`, `ready.sh`, `recover.sh`, `review.sh`, `land.sh`, `dispatch.mjs`, `sessions.mjs`, `codex-review.mjs`, and the core's CI code (`ci-io.mjs`, `outstanding.mjs`). Each change is the same swap from a direct call to the host module's; the slice lists the callers it found by grep in its hand-off.

**Acceptance criteria**

- The dispatch, review, landing, recover and CI tests pass unchanged; the lint rule extends: no other core file calls the three CLIs directly.

**Blocked by:** 2. **Blocks:** 4, 7.

## Slice 4: `RISA_*` and the other names

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 4.

**What to build**

- A scripted rename of every tool knob from `CARETOOK_*` to `RISA_*`, no fallback, in the core, Caretook's code that reads them (`LEASES`, `LOAD_GATE`, and the check's `CHECK_STATE` and `CHECK_COUNTS`, which the core sets for the body), `vitest.config.ts`, CI and the docs. The variables Caretook owns (the PRD's _Decisions_ list) keep their names.
- The other Caretook names in the core come from the config's project name, their values unchanged (_Architectural decisions_): `caretook-checked` and `caretook-inbox-merged` (`lib.sh`), `caretook-backlog.lock` (`lib.sh`, `backlog.mjs`, `inventory-facts.mjs`, `recover.sh`), the launchd label (`autostart.mjs`), the commit-status context `caretook-ci` (`ci-runs.mjs`) and the literal in `tidy-cli.mjs`.
- Generic tests' Caretook-like sample paths become neutral ones.
- The inbox folder outside the repo, `~/.caretook/inbox`, becomes `~/.risa/inbox` (PRD _Decisions_): the slice moves the default; the orchestrator asks the user to move the folder and to tell Claude Code once to trust the new one, before the dispatcher resumes.

**Acceptance criteria**

- No `CARETOOK_`, `caretook` or `.caretook` remains in a core file outside the sample of Caretook's own config; the lock, the markers, the label and the status context have the same values as before (a test on Caretook's config); `pnpm test:tooling` passes; the `full` tier passes once at landing; after the resume, the inbox session reopens in the new folder and the watchdog still runs under its label.

**Blocked by:** 1, 3, 6, 7. **Blocks:** 5.

## Slice 5: The command-name sweep and the residual list

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 2, 8.

**What to build**

- A scripted sweep: every printed `pnpm prd` and `pnpm backlog` in the core (about 640 outside tests: prompts, hints, help, errors, worktree creation, readiness; the generic role docs too) goes through the command-name helper. The generic docs carry a placeholder the doc command fills in.
- Caretook's own scripts' hints (in `scripts/project/`, `packages/data/test/globalSetup.ts`) follow _Architectural decisions_.
- The allowlist ends as the PRD's **named residual list** only: each remaining line with the file, the line and why it waits for the move (`package.json` scripts, the Vitest tooling projects, `ci.yml`'s tooling jobs, the tier data's tooling file group, the deploy workflow test, the generic docs' budget line). The core's tests run on the sample project.

**Acceptance criteria**

- The lint passes with only the residual list, and gains a rule: no core file outside tests holds the literal `pnpm prd` or `pnpm backlog`. With the command names set to `risa` in the sample project, its golden and `doc <role>` name only `risa`; both goldens pass; with them set to `risa` in a copy of Caretook's config, Caretook's own hints name `risa` too.

**Blocked by:** 4. **Blocks:** the move.

## Slice 6: The check data moves

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 3, 6.

**What to build**

- The checks manifest, its parser and guard (`checks.mjs`, `checks.test.mjs`) and `check-areas.d/` move to `scripts/project/`; their config paths change, and so do the check plan's rules that name them, `ci.yml`'s check-areas lint step, the browser job's manifest path, the gate's reads in `browser.sh`, the Vitest project lines that list `checks.test.mjs` by name, the comment in `scripts/ci/brake-list.txt` and the deploy workflow test. Each is a rename plus its callers' paths.
- _Rules across PRDs_ in the orchestrator doc names the new folder.

**Acceptance criteria**

- `pnpm prd browser --changed --list` and the check plan give the same answers as before on a sample diff; the check-areas lint passes in CI's form; every `node scripts/…` and `--import` line in `ci.yml` resolves to a Caretook-owned file outside the residual list; the touched files leave the allowlist.

**Blocked by:** 1 (the runner reads the manifest). **Blocks:** 4.

## Slice 7: The host layer, part 3: Claude Code's files

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5.

**What to build**

- Where Claude Code keeps its own files is the host module's: its config folder, the project transcripts, and the session settings files (`context-settings.json`, `inbox-settings.json`) whose status line and hooks feed `usage.mjs` and `context.mjs`. The shape Claude Code hands a status line and a `StopFailure` hook is read in one place.
- Its callers today: `session.sh`, `sessions.mjs`, `open-session.mjs`, `open-session.sh`, `heartbeat.mjs`, `resume.mjs`, `dispatch.mjs`, `autostart.mjs`, `bye.mjs`, `usage.mjs` and `context.mjs`; the slice lists what it found by grep in its hand-off.

**Acceptance criteria**

- The session, usage, context, drain, resume and heartbeat tests pass unchanged; the lint rule extends: no other core file names Claude Code's folders or parses its hook input.

**Blocked by:** 3 (`dispatch.mjs`, `sessions.mjs`). **Blocks:** 4.
