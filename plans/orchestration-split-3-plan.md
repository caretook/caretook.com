# Plan: Orchestration split 3 (stage 1c, the browser runner, the host layer and the renames)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split-3`, after `orchestration-split-2`. Then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**Released 2026-11-26 by the user** (registry row `orchestration-split-3`, after `orchestration-split-2`, queued after fixes-ui and fixes-nit); the dispatcher opens it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Opus (the user, 2026-11-26; Fable before); each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Slices 4 and 5 are scripted renames and slice 6 is moves: sonnet candidates once the script is written and reviewed. Slice 1 splits a 600-line gate: the likely Fable candidate.

**Landing mode: run everything through** (dispatcher start, 2026-11-26): start every ready slice, land each green wave, ask only real questions via `pnpm prd ask`.

**2026-11-26, wave 1 started** (orchestrator on Opus): B-543 claimed for prd/orchestration-split-3. Worktrees `orchestration-split-3-1` (stack, slot 3) and `orchestration-split-3-2` (no stack) made; both slices spawned on **opus** (slice 1 judged opus-enough, not Fable: the gate split is mechanical extraction with tests to hold it). Wave 1 lands only when no other PRD, plan or hotfix worktree is open (open now: todo-subtasks-2, plan/self-recovery-2, plan/symptom-catalog-2).

**Wave 1 merged** (slice 1 at dd630c96 → 41fa52cf; slice 2 at 3ee6fbb1 → 8338ca66). The wave's gate is a `full` CI run (ci.yml changed). Open: slice 1 didn't send a real check through the gate on a stack: run `pnpm prd browser sign-in` at the landing. Slice 1's agent ended at about 285k context, so any fix goes to a fresh `--continue` agent. Slice 1 chose `SHARED_PROJECTS = ["tooling:browser"]` in `scripts/project/test-projects.mjs` (the harness project holds both owners' tests until the move); reviewed, kept. Hook contract for the docs at the last landing: `hooks.browser list` prints `<check>\t<file>`; `run --output DIR <check> -- [args…]`; `serve … --fresh`.

**Wave 1 green** (2026-11-26): full CI run 45874687474 on ca26aaf4 = flake (search.sync and timelineTags component tests, not this branch's files). `prd sync`: no merge needed. `prd browser sign-in` passes through the new gate on the stack (slice 1's open criterion, met). PR #230 open; Codex out of credits (exit 4): land `--no-review`, say so in the report. Slice worktrees removed. **Holding the landing** under _How to run this plan_ (no other PRD/plan/hotfix worktree open): fixes-ui (8 slices) and plan/self-recovery-2 are open; a background loop waits on `git worktree list`. **The user's word, via the backlog session (caretook-com-20):** coordinate, don't wait: the others park at a resync point; land on the backlog session's go, then tell it the landing is on dev so it releases them. Then: `pnpm prd land orchestration-split-3 --tier full --no-review -m "feat(orchestration-split-3): …"` (resync first if dev moved), docs, report, rotate.

| Slice | Wave | State   | Merge into `prd/orchestration-split-3` |
| ----- | ---- | ------- | -------------------------------------- |
| 1     | 1    | merged  | 41fa52cf                               |
| 2     | 1    | merged  | 8338ca66                               |
| 3     | 2    | planned |                                        |
| 6     | 2    | planned |                                        |
| 8     | 3    | planned |                                        |
| 7     | 3    | planned |                                        |
| 4     | 4    | planned |                                        |
| 5     | 5    | planned |                                        |

## Architectural decisions

As in [`orchestration-split-plan.md`](orchestration-split-plan.md), plus:

- **The browser runner splits** (asked): Caretook owns a plain runner in `scripts/project/` (run these named checks with Playwright, write the results); the core owns the gate around it (load wait, caps, retries, hang watchdog, lease) and calls the runner through the config's browser hook. GitHub CI calls the plain runner with no lease, as today.
- **Scripted renames are one change each**, checked by the lint, not split by file count.
- **Names shared between worktrees keep their values.** The backlog lock, the checked and inbox-merged markers, the launchd label and the commit-status context are built from the config's project name and stay exactly what they are today (`caretook-…`, `com.caretook.prd-watchdog`, `caretook-ci`), so an unsynced worktree, the watchdog and the statuses already on GitHub all still match.
- **The machine config, and Risa's own backlog off by default** (asked, the user 2026-11-26; slice 8): a machine config outside every repo lists the repos Risa works in, each with a switch for whether the dispatcher and the start commands may work on it. The switch is off by default for Risa's own repo, so after the move this machine keeps spending nothing on Risa's backlog; the user turns it on permanently in the machine config on their work machine, or for one shell or session here with an environment variable. Reads (status, backlog list, asks) work either way.
- **A Claude config folder per project or role** (asked, the user 2026-11-26, nice to have; slice 7): every `claude` the core starts gets `CLAUDE_CONFIG_DIR` from the host module, so one machine can run one project, or only its orchestrators, on another Claude account.
- **Caretook's own scripts never use the core's helpers.** Where one prints a hint that names a tool command, it reads the command name from `risa.json` itself (a few lines), or the hint names no command.

## How to run this plan

- **Start only when** `orchestration-split-2` has landed and the tooling is quiet. **Slice 6 moves `scripts/loops/check-areas.d/` and the checks manifest,** which PRDs add to (_Rules across PRDs_; 84 and 45 commits in two weeks): it starts only when no running PRD or fixes wave has an unlanded change to either, and its landing updates that rule in the orchestrator doc.
- **Wave 1:** slices 1 and 2 (1 owns `browser.sh`, `scripts/ci/browser-job.mjs`, the browser tests and the places that name the harness test's path; 2 owns `open-session.sh`, `autostart.mjs`, `ask.mjs` and the dispatcher's tab and notification calls). **Wave 2:** slices 3 and 6 (3 owns the callers of `claude`, `codex`, `gh` and Node; 6 owns the checks manifest and its parser, `check-areas.d/`, the check plan's rules file, `ci.yml`'s lint step and the deploy workflow test). **Wave 3:** slice 8 (the machine config), then slice 7 (Claude Code's files) on top of it; both touch `dispatch.mjs`, so one after the other. **Wave 4:** slice 4. **Wave 5:** slice 5.
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
- **Which Claude config folder** (the user, 2026-11-26, nice to have): the host module sets `CLAUDE_CONFIG_DIR` on every `claude` it starts. Where it comes from, first found wins: `RISA_CLAUDE_CONFIG_DIR` in the environment, the machine config's entry for the repo (slice 8; per role if given, e.g. only orchestrators), `risa.json`'s project value, else Claude Code's default. Usage and context readings follow the folder, so each account's usage is read from its own files.
- Its callers today: `session.sh`, `sessions.mjs`, `open-session.mjs`, `open-session.sh`, `heartbeat.mjs`, `resume.mjs`, `dispatch.mjs`, `autostart.mjs`, `bye.mjs`, `usage.mjs` and `context.mjs`; the slice lists what it found by grep in its hand-off.

**Acceptance criteria**

- Tests: with a config folder set, every `claude` the host module starts gets it as `CLAUDE_CONFIG_DIR`, and the usage and context readings read that folder's account; with none set, nothing changes.
- The session, usage, context, drain, resume and heartbeat tests pass unchanged; the lint rule extends: no other core file names Claude Code's folders or parses its hook input.

**Blocked by:** 8 (the machine config; `dispatch.mjs`, `sessions.mjs`). **Blocks:** 4.

## Slice 8: The machine config and the work switch

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 5 (added on the user's word, 2026-11-26).

**What to build**

- The machine config: one JSON file in the user's home (under `~/.risa/`, beside the releases), validated by a core loader, listing the repos Risa works in (path, and per repo a `work` switch and an optional `claudeConfigDir` for slice 7). Missing file: today's behaviour, the main checkout alone, switch on. The repo-finding function in `lib.sh` (stage 1a left it ready) reads it.
- The `work` switch: when off for a repo, the dispatcher starts, plans and queues nothing there, and `start`, `queue`, `plan` and `slice` refuse with one line naming the switch and the variable. Off by default only for the tool's own repo (its `risa.json` says it is the tool); on for every other. An environment variable (`RISA_WORK_SELF=1`, named with the slice 4 prefix from the start) turns it on for the process that has it, so a dispatcher or session started with it works on Risa's backlog here, temporarily.
- Reads stay open with the switch off: status, the backlog commands, asks, notices, doc.

**Acceptance criteria**

- Tests: no machine config behaves as today; a repo with `work: false` gets no start from the dispatcher's dry run (its row's reason names the switch) and `start` refuses; the variable lifts it for that process only; the tool's own repo defaults off, others on; a bad file fails with the loader's message.
- The move runbook's step 4 writes this machine's config with Risa's switch off; the user sets it on in the work machine's config.

**Blocked by:** 3 (`dispatch.mjs`). **Blocks:** 7.
