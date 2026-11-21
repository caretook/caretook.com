# Plan: Orchestration 2

> Source PRD: [`plans/orchestration-2-prd.md`](orchestration-2-prd.md). User-story numbers (US) refer to it. Backlog items B-389, B-390, B-391, B-392. Topic `orchestration-2`.

## Status

**Where it stands:** planned (2026-11-21), not started. Runs after `check-speed` is in `dev` (shared `prd.sh`, `prompt.sh`) and before `test-health`, never beside it.

| Slice | Wave | State       | Merge into `prd/orchestration-2` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------------------ |
| 1     | 1    | not started |                                                  |
| 2     | 1    | not started |                                                  |
| 3     | 1    | not started |                                                  |
| 4     | 2    | not started |                                                  |
| 5     | 2    | not started |                                                  |
| 6     | 2    | not started |                                                  |
| 7     | 3    | not started |                                                  |
| 8     | 4    | not started |                                                  |

**Backlog:** B-389 (the registry) closes with slice 1, B-390 (one session per wave) with slice 4, B-391 (the asks queue) with slice 6, B-392 (the dispatcher) with slice 8 (`pnpm backlog done` when each merges).

## Architectural decisions

- **No new dependencies, no migration, no app-code change.** `scripts/loops/`, `scripts/backlog/` and the PRD table in `plans/backlog.md` only.
- **Pure modules decide, scripts act.** The registry parser, the worked-out state, the asks store and the pick are `.mjs` modules handed their facts; `backlog.mjs`, `prd.sh` and the dispatcher loop call them.
- **The registry** is the PRD table: columns `PRD`, `Flags`, `After`, `Hot files`, `Doc and notes`. Flags: `hold`, `done`, `standing`, `alone`, or `—`. `After`: topics. `Hot files`: repo path prefixes. Row order is the priority. All writes go through `pnpm backlog prd`.
- **A topic's state is worked out, never stored:** `hold` or `done` from the flag; `running` when a `prd/<topic>` worktree exists; `planned` when `plans/<topic>-plan.md` is on `dev` (a `standing` topic only while it has triaged items); else `to-write`.
- **Session records:** `.loops/.sessions/<name>.json` (`pid`, `kind`, `topic`, `started`, `command`, `managed`, `auto`, `ended`, `exit`), written by `session.sh`, kept after the session exits, removed by `rm.sh` with the worktree. Names stay `prd-<topic>` and `plan-<topic>`. Nothing is written inside a worktree (an untracked file there blocks `land` and `rm`).
- **Asks:** `.loops/.asks/<id>.json`, machine-local, created exclusively. Ids are `a<n>`.
- **The dispatcher** does at most one action per tick. One instance, by a pid lock in `.loops/.dispatch.lock`; pause is `.loops/.dispatch.paused` (its content is the reason); counts and the last reason live in `.loops/.dispatch.json`; the log is `.loops/.dispatch.log`.
- **Tests never start a real `claude`** or open a tab: `CARETOOK_CLAUDE_BIN` names a stub, and `CARETOOK_ITERM_APP` points nowhere so the opener prints its command.
- **Loops never edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing (below).

## How to run this plan

- **Waves:** (1, 2, 3) → (4, 5, 6) → 7 → 8. Land each wave through its PR as it goes green.
- **Gates:** every slice is tooling, so the check gate needs no app check: run the tooling tests (`pnpm test:tooling`) and prettier on the changed files. No browser checks.
- **Shared files:** wave 1: slice 1 owns `scripts/backlog/`, slice 2 `session.sh`, `open-session.*`, `queue.sh` and `prd.sh`'s `start`, `open` and `plan` commands, slice 3 the asks files. Wave 2: slice 4 owns the rotate script and `prompt.sh`'s orchestrator text; slice 5 the pick module; slice 6 `prompt.sh`'s plan text and both `--auto` blocks. Slices 4 and 6 both touch the orchestrator prompt: slice 4 edits the shared bullet list, slice 6 only the `--auto` block; merge 4 first. Every slice that adds a command adds it at the end of its group in `prd.sh`'s usage.
- **Migrating the table (the orchestrator, once, after wave 1 lands):** the backlog tool writes `dev` in the main checkout, so no slice can do it. Run `pnpm backlog prd migrate`, check `pnpm backlog prd list` and `pnpm backlog doctor`, then tell the running orchestrators and planners at their next wave boundary that the table is edited only with `pnpm backlog prd`. Until the migration, `prd list` says to run it and every other backlog command works as before.
- **Trying it:** after wave 3, the report includes `pnpm prd dispatch --dry-run` on the real machine. After wave 4, the keeper reads the registry's order, then starts `pnpm prd dispatch`.
- **Docs at landing (the orchestrator).** `docs/agents/orchestrator.md` is 200 bytes under its budget, so wave 1 first **moves** its _Worktrees and leases_ section to a new `docs/agents/machinery.md` (with an _Area index_ entry: about 40 bytes of the core's 340 spare), and sessions, asks and the dispatcher go there too.
  - Wave 1: `docs/agents/machinery.md` (sessions), `docs/agents/backlog.md` (the registry, `pnpm backlog prd`, row order as priority, the worked-out states), `docs/orchestration.md` (asks; trim as much as it adds).
  - Wave 2: `orchestrator.md` (drain, then rotate; unattended sessions ask with `pnpm prd ask`; `done` is set by `pnpm prd rm`), `planner.md` (the row through `pnpm backlog prd`).
  - Wave 4: `docs/orchestration.md` (the short version becomes: inbox, `pnpm prd dispatch`, `pnpm prd asks`; cut the starting and queueing steps), `docs/agents/backlog.md` (_Deciding what's next_), `docs/agents/recovery.md`, `machinery.md` (the dispatcher).

---

## Slice 1: The PRD registry

Stack: no · Reads: docs/agents/backlog.md · Tests: unit

**Backlog:** B-389. **User stories:** 5, 7, 8, 9.

**What to build**

- A pure module in `scripts/backlog/` that parses the `## PRDs` table into rows (`topic`, `flags`, `after`, `hot`, `notes`) and writes it back, keeping row order. It recognises today's five-column prose table and reports "not migrated" for it.
- A pure `stateOf(row, facts)` with the rule in _Architectural decisions_; `facts` are the plan files on `dev`, the `prd/` worktrees and the count of triaged items per topic.
- `pnpm backlog prd list [--json]` (rows with their state), `prd add <topic>`, `prd set <topic> flags=… after=… hot=… notes=…`, `prd move <topic> --first|--last|--before <topic>|--after <topic>`. Each write is one locked backlog commit with the tool's trailer.
- `pnpm backlog prd migrate` (removed in slice 8): rewrites today's table. Finished rows get `done`; the four holds, `alone` for `i18n` and `standing` for `quick-fixes` as the PRD lists them; new rows for `code-health`, `calendars-2` and `assistant-2`. A dependency on a whole topic goes to `After`; a slice-level one stays in the notes. Every hot file the prose names becomes a path prefix you verified exists; list in the hand-off any you couldn't resolve. Order: topics with a PRD worktree, then those with a plan, then those to write in the handbook's standing priorities (`sync-safety`, `dose-accuracy`, `data-rights`, `account-security` first), then holds, then done.
- `doctor`: an `After` topic with no row, a cycle, a topic with waiting items and no row, an unknown flag, a hot-file prefix that doesn't exist.

**Acceptance criteria**

- [ ] Unit tests: a round trip of a migrated fixture; each command; `move` in all four forms; `stateOf` for every state and for `standing` with and without items; each doctor finding.
- [ ] The migration, run on a copy of `dev`'s table, leaves `doctor` clean; the hand-off shows the resulting `prd list` and the unresolved hot files.
- [ ] `pnpm backlog list`, the summary table and every existing backlog test are unchanged.

**Blocked by:** nothing. **Blocks:** 5, 6.

## Slice 2: Recorded sessions

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/recovery.md · Tests: unit

**User stories:** 15, 19, 26.

**What to build**

- `scripts/loops/session.sh <name> [--kind prd|plan] [--topic <t>] [--managed] [--auto] -- <claude args…>`: runs `${CARETOOK_CLAUDE_BIN:-claude}` as a child, writes the record at start, adds `ended` and `exit` when it exits, passes the exit code on.
- A pure helper that reads the records and says which are live (the pid exists and is that session).
- `open-session.mjs` wraps the command it chooses in `session.sh` and carries a record's `managed` and `auto` over to the new one; `pnpm prd start`'s printed command, `queue.sh` and `prd.sh plan --open` start through it too.
- The opener gains `--background`: a new tab without activating iTerm2, writing to the tab it created.
- `pnpm prd end [<name>]`: ends the recorded session of this worktree (for a session's own last step); `rm.sh` removes the worktree's record.

**Acceptance criteria**

- [ ] Tooling tests with a stub `claude`: the record at start and after exit; liveness for a live, an ended and a reused pid; `end`; `rm.sh` removes the record.
- [ ] The existing `open-session` and prompt tests pass with the wrapper in the command; a test shows `managed` and `auto` carried over.
- [ ] The hand-off shows a tab opened with `--background` while another app was in front (or says it couldn't be tried).

**Blocked by:** nothing. **Blocks:** 4, 6, 7.

## Slice 3: The asks queue

Stack: no · Reads: docs/agents/orchestrator.md · Tests: unit

**User stories:** 16, 17, 18, 19.

**What to build**

- A pure store module in `scripts/loops/` over a directory of ask files: create (exclusive, retrying the next id), list open, answer, dismiss.
- `pnpm prd ask --topic <t> --question <text> --option <a>… --recommend <a>` (prints the id; a macOS notification when `osascript` exists), `pnpm prd ask --topic <t> --report <text>`, `pnpm prd ask --wait <id> [--timeout <seconds>]` (prints the answer, exit 0; exit 75 on timeout), `pnpm prd asks [--json]`, `pnpm prd answer <id> <option number or text>`, `pnpm prd asks --done <id>`.
- `pnpm prd asks` prints each open ask with its topic, age, options numbered and the recommended one marked.

**Acceptance criteria**

- [ ] Unit tests of the store: ids, two creates at once get different ids, an answer by number and by text, an unknown id, answering twice refused, a report can't be answered, dismiss.
- [ ] A tooling test: `ask --wait` returns when another process answers, and exits 75 at its timeout.
- [ ] The commands are in `pnpm prd help`.

**Blocked by:** nothing. **Blocks:** 6, 7.

## Slice 4: Rotation

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/recovery.md · Tests: unit

**Backlog:** B-390. **User stories:** 13, 14, 15.

**What to build**

- `pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`: the topic defaults to the worktree's. Refuses when `plans/<topic>-plan.md` has uncommitted changes, when the topic has no session record, or when slice worktrees of the topic exist and `--mid-wave` wasn't given. Then starts a detached helper that ends the recorded session, waits for the pid to go, and opens `prompt.sh orchestrator <topic> --resume` (plus `--auto` when the record or _Status_ says run-through) through `session.sh` in a background tab, always fresh, never `--continue`, keeping `managed`.
- `prompt.sh orchestrator` (the shared bullets, so every orchestrator): after a landing and its docs, start no new slice; when the slices in flight are merged, commit _Status_ and run `pnpm prd rotate`; with none in flight, rotate at once. `--mid-wave` only on the user's word or the dispatcher's. After the last landing: `pnpm prd rm`, then `pnpm prd end`.
- `rm.sh`: removing a PRD worktree whose branch is merged and whose plan _Status_ has no slice left to run sets the `done` flag (`pnpm backlog prd set`), except for a `standing` topic; it says what it did. Before the table is migrated it skips this.

**Acceptance criteria**

- [ ] Tooling tests with a stub `claude`: `rotate` ends the stub, the opened command is the fresh resume prompt with the same name, `--auto` and `managed` follow the record; the three refusals; `rm.sh` sets `done` only in the case above.
- [ ] The orchestrator prompt's tests show the drain-then-rotate line with and without `--auto`.
- [ ] **The hand-off shows one real rotation**: a throwaway interactive session runs `pnpm prd rotate` from its own shell, and the helper outlives it and opens the new one. If the helper dies with the session, say so and stop: the fallback (a rotate request the dispatcher acts on) is the orchestrator's to plan.

**Blocked by:** 2. **Blocks:** 7.

## Slice 5: The pick

Stack: no · Reads: docs/agents/backlog.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 10, 11, 12, 20, 21.

**What to build**

- A pure module in `scripts/loops/`: `pick({ rows, sessions, openQuestions, cap, paused, reopens, planHoldMinutes, now })` returns `{ action, topic?, session?, reasons }`, with the PRD's rules in the PRD's order. `rows` carry their worked-out state and, for a planned topic, when its plan landed. `reasons` has one line per topic passed over.
- Hot-file collision: two topics collide when a prefix of one equals, or is a parent path of, a prefix of the other.

**Acceptance criteria**

- [ ] Unit tests, one per rule and one per ordering: paused; a managed worktree with no live session reopened, the third time an `ask`, then skipped while that ask is open; an unmanaged worktree only reported; a start beats a plan; row order within each; the cap; `After` not done; a hot-file collision with a running topic; `alone` both ways; a `standing` topic with and without items; an open question skips only its topic; one planner at a time; the plan hold; `hold` and `done` never picked; nothing to do.
- [ ] Every skipped topic has a reason a person can read ("waits for planner-2", "shares scripts/loops/prompt.sh with check-speed", "opened by hand").

**Blocked by:** 1. **Blocks:** 7.

## Slice 6: Unattended prompts and the planner's row

Stack: no · Reads: docs/agents/planner.md, docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-391. **User stories:** 8, 16, 17, 18, 20.

**What to build**

- `prompt.sh plan` (both forms): the topic's row is added and set with `pnpm backlog prd add` and `prd set … after=… hot=…` (path prefixes), never a hand edit and `pnpm backlog commit`.
- `prompt.sh plan <topic> --auto`: its one round of questions is filed through `pnpm prd ask` (one ask per question) and awaited with `--wait` in the background while it explores; after landing it files a report with the assumed decisions, runs `pnpm prd rm plan-<topic>` and `pnpm prd end`.
- `prompt.sh orchestrator <topic> --auto` (the `--auto` block only): real questions go through `pnpm prd ask`; each landing files a report (the `pnpm prd ready` summary, the link, what to try by hand).
- `open-session.mjs`: a fresh planner session gets `--auto` when its record says so.

**Acceptance criteria**

- [ ] Prompt tests: each `--auto` prompt names `pnpm prd ask` and not AskUserQuestion; the plain orchestrator prompt differs from before only by slice 4's lines; both planner prompts name `pnpm backlog prd`.
- [ ] A test: `open-session.mjs` reopens an `auto` planner with `--auto`.

**Blocked by:** 1, 2, 3. **Blocks:** 7.

## Slice 7: The dispatcher

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/recovery.md, docs/agents/backlog.md · Tests: unit

**User stories:** 1, 2, 3, 4, 21, 22.

**What to build**

- `pnpm prd dispatch [--every <seconds>] [--once] [--dry-run] [--pause|--resume|--stop]`. It gathers the facts (`pnpm backlog prd list --json`, the session records and liveness, open asks, the pause file, `.loops/.dispatch.json`), calls the pick and acts:
  - `plan`: `new.sh plan <topic>`, then `session.sh --managed --auto` with `prompt.sh plan <topic> --auto` and the topic's waiting item ids, in a background tab;
  - `start`: `new.sh prd <topic>`, then a managed session with `prompt.sh orchestrator <topic> --auto`;
  - `reopen`: `open-session.sh <name> --background`, and count it;
  - `ask`: a question with the options "reopen again" and "hold the topic", acted on when answered.
- `--dry-run` prints the action and every reason and changes nothing. `--once` runs one tick. It refuses to run before the table is migrated.
- **The usage limit:** probe `${CARETOOK_CLAUDE_BIN:-claude} -p ok` before any action and every 10 minutes while paused for it. A failed probe pauses with the reason and records which managed sessions were live. When the probe passes, rotate each of those (`pnpm prd rotate <topic> --mid-wave`, a planner by ending and reopening it), one per tick, then clear the pause.
- `CARETOOK_DISPATCH_PLAN_HOLD` (minutes, default 0) is passed to the pick.

**Acceptance criteria**

- [ ] Tooling tests against a temporary `.loops` with stubs for `claude`, `new.sh` and the backlog command: one tick per action does exactly that action; `--dry-run` writes nothing; a second instance refuses; `--pause` stops new actions and `--resume` restores them; a failing probe pauses, a passing one rotates the recorded sessions and resumes; the answer to a reopen ask is acted on.
- [ ] The hand-off shows `pnpm prd dispatch --dry-run` on the real machine.

**Blocked by:** 2, 3, 4, 5, 6. **Blocks:** 8.

## Slice 8: Queue, recovery, status and the backlog session

Stack: no · Reads: docs/agents/recovery.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-392. **User stories:** 6, 23, 24, 25.

**What to build**

- `pnpm prd queue <topic>`: `pnpm backlog prd move <topic> --first` and one line saying the dispatcher will take it (or that it isn't running). Remove the waiting loop, `--manual`, `.loops/.queue/` and the start lock's queue use, from `queue.sh`, the inventory and `recover.sh`. Remove `pnpm backlog prd migrate`.
- `pnpm prd down` records whether the dispatcher was running; `pnpm prd recover` clears its lock when the pid is gone (add it to the stale-lock list), reopens it in a tab when it was running, and the recovery prompt leaves managed sessions to it.
- `pnpm prd status`: the dispatcher's state and last log line, each session (managed or by hand, age, live or ended), the open asks (count and the oldest).
- `prompt.sh backlog`: the overview reads `pnpm prd asks` and `pnpm backlog prd list`; "decide what to run next" is reordering and holding; it no longer lists `.loops/.queue` or prints start commands when the dispatcher runs.

**Acceptance criteria**

- [ ] Tooling tests: `queue` reorders and returns; the inventory and recovery tests pass without queue tickets; `recover --dry-run` names the dispatcher; `status` prints the three new parts.
- [ ] The backlog prompt's test shows the new overview sources.
- [ ] No file refers to `.loops/.queue`.

**Blocked by:** 7. **Blocks:** nothing.
