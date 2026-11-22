# Plan: Orchestration 3

> Source PRD: [`plans/orchestration-3-prd.md`](orchestration-3-prd.md). User-story numbers (US) refer to it. Backlog items B-392, B-426, B-427, B-428, B-439. Topic `orchestration-3`.

## Status

Not started.

| Slice | Wave | State       | Merge into `prd/orchestration-3` |
| ----- | ---- | ----------- | -------------------------------- |
| 1     | 1    | not started |                                  |
| 2     | 1    | not started |                                  |
| 3     | 1    | not started |                                  |
| 4     | 2    | not started |                                  |
| 5     | 2    | not started |                                  |
| 6     | 3    | not started |                                  |

**Backlog:** B-427 closes with slice 4; B-426, B-428 and B-439 with slice 5 (slices 1, 2 and 3 build their first halves, the dispatcher the rest); B-392 with slice 6.

## Architectural decisions

- **No new dependencies, no migration, no app-code change.** `scripts/loops/`, `scripts/backlog/`, the prompts, `plans/fixes-rules.md` and the docs only.
- **Pure modules decide, scripts act.** The pick and the load gate are `.mjs` modules handed their facts (prior art: `inventory.mjs` with `inventory-facts.mjs`, `tidy.mjs` with `tidy-cli.mjs`); the dispatcher script gathers facts, calls the pick and acts.
- **The registry is read through `pnpm backlog prd list --json`** and written only through `pnpm backlog prd`. States stay worked out, never stored.
- **Sessions start only through the session wrapper and the opener**, in background tabs. A record's `managed` says the dispatcher started it; nothing else manages a session.
- **Dispatcher files live in the main checkout's `.loops/`:** `.dispatch.lock` (pid), `.dispatch.json` (state), `.dispatch.log`. Nothing is written in a worktree.
- **Tests never start a real `claude`, tab or GitHub call:** `CARETOOK_CLAUDE_BIN`, a temporary `.loops`, `CARETOOK_CLOCK_FILE`, stubs for the worktree and backlog commands.
- **The names:** `pnpm prd dispatch`; `--managed`; `pnpm prd land --recheck "<why>"`; `CARETOOK_LOAD_BUSY`, `CARETOOK_LOAD_WAIT`, `CARETOOK_LOAD_GATE`; `CARETOOK_FIXES_MIN` (3), `CARETOOK_MAX_PLANNERS` (1, plus one waiting on an ask).

## How to run this plan

- **Before wave 1 (the orchestrator, through `pnpm backlog prd set`):** flag `orchestration-2` and `check-speed` `done` if their work is in `dev` and their rows still aren't (check with `pnpm backlog prd list`; ask the user if either still has a worktree with unmerged work).
- **Wave 1:** slices 1, 2 and 3 at once (the pick; the prompts and session record; the load gate). They share no file.
- **Wave 2:** slices 4 and 5 at once. Slice 4 edits the prompts after slice 2; slice 5 needs 1, 2 and 3.
- **Wave 3:** slice 6.
- Every wave is tooling and docs only, so the check gate asks for none: run `pnpm test:tooling` and `pnpm exec prettier --check` on what changed. No browser checks.
- **Don't run beside** `test-health`, `code-health` or a `fixes-tooling` wave (they share `scripts/loops/`).
- **Trying it** (the orchestrator, after wave 2 and again after wave 3, reported to the user): `pnpm prd dispatch --dry-run` against the live registry, with its output in the report; after wave 3, with the user's word, one `pnpm prd dispatch --once` that opens a real session, and one ask filed by the dispatcher to see whether the helper's push reaches the phone. The dispatcher is never left running by this topic's orchestrator: the user starts it.
- **Docs at the last landing:** [machinery](../docs/agents/machinery.md) (the dispatcher, `managed`, the load gate), [orchestrator](../docs/agents/orchestrator.md) (starting and queueing, `--recheck`, capacity), [recovery](../docs/agents/recovery.md), [backlog](../docs/agents/backlog.md) (`standing` and `hold`; deciding what's next), [planner](../docs/agents/planner.md), [orchestration](../docs/orchestration.md), and `pnpm prd help`.

## Slice 1: The pick

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-439 (closes with slice 5). **User stories:** 2, 3, 4, 9, 10, 11, 12, 13.

**What to build**

- A pure module: the pick takes `{ rows, worktrees, sessions, asks, reopens, busy, paused, caps, now }` and returns `{ action, topic?, session?, reasons }`, with the PRD's rules in the PRD's order (_The pick_). `rows` carry the worked-out state, flags, `After`, hot files, and the waiting count. Session records carry `managed`, liveness and `rotating` with its time.
- The hot-file collision function: two topics collide when a prefix of one starts with a prefix of the other, as plain text (live rows such as `scripts/loops/session` and `scripts/loops/open-session.` rely on it).
- No hold: a topic whose plan just landed is `planned` like any other.

**Acceptance criteria**

- [ ] Unit tests, one per rule and one per ordering: paused; a managed worktree with no live session is reopened, the third time an `ask`, then skipped while that ask is open; a record marked `rotating` in the last five minutes isn't reopened, an older one is; an unmanaged worktree is only reported and still takes a slot and its hot files; busy stops starts and plans but not reopens; a start beats a plan; row order within each; the cap; an `After` topic not done; a hot-file collision with a running topic; `alone` both ways; an open question skips only its topic; `hold` and `done` never picked; a `to-write` topic with no waiting items isn't planned; one planner at a time, a second only when the first's topic has an open question; nothing to do.
- [ ] Unit tests for the fixes rule: a second fixes topic waits while one runs; fewer than three waiting waits while another topic may start, and starts when none may; three waiting starts in row order; `idle` never starts.
- [ ] Unit test: a topic planned a minute ago starts on the next pick (no hold).
- [ ] Unit test: every passed-over topic has a reason a person can read ("waits for planner-2", "shares scripts/loops/prompt.sh with check-speed", "opened by hand", "the machine is busy").

**Blocked by:** nothing. **Blocks:** 5.

## Slice 2: Unattended planners and the fixes rules

Stack: no · Reads: docs/agents/planner.md, docs/agents/orchestrator.md, docs/agents/machinery.md, plans/fixes-rules.md · Tests: unit

**Backlog:** B-428 (closes with slice 5). **User stories:** 7, 8, 12, 14, 15, 19.

**What to build**

- The session record's `managed`: the wrapper takes `--managed`; the opener and rotation carry it over as they do `auto`; `pnpm prd status` marks each session managed or by hand.
- `prompt.sh plan <topic> --auto`: questions through `pnpm prd ask` (one each, a PushNotification after each, `--wait` in the background, no timeout, never its own recommendation in place of an answer); after landing, a report ask with the assumed decisions and how to veto; then `pnpm prd rm` and `pnpm prd end`. The opener reopens an `auto` planner with `--auto`.
- Both planner prompts and the planner handbook: land with plain `pnpm prd land plan/<topic> -m …`; set the row when it exists, add it when it doesn't.
- The fixes orchestrator's prompt line and `plans/fixes-rules.md`: set the row's hot files after writing a wave's slices; leave a fix that collides with a running topic's hot files for a later wave. Removing a `standing` topic's worktree clears its row's hot files.
- The backlog handbook says once that `standing` and `hold` are separate.

**Acceptance criteria**

- [ ] Tooling tests (the prompt tests): the `--auto` planner prompt names `pnpm prd ask` and PushNotification and not AskUserQuestion; neither planner prompt contains `--force`; the plain planner prompt is otherwise unchanged; the fixes line names `pnpm backlog prd set … hot=`.
- [ ] Tooling tests (the session and opener tests): `--managed` is recorded, survives a reopen and a rotation; an `auto` planner reopens with `--auto`.
- [ ] Tooling test: removing a `standing` topic's worktree clears its hot files and leaves its flags; a non-standing topic's hot files are untouched.
- [ ] `plans/fixes-rules.md` and the backlog handbook carry the two rules; `pnpm exec prettier --check` passes on them.

**Blocked by:** nothing. **Blocks:** 4, 5.

## Slice 3: The load gate

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-426 (closes with slice 5). **User stories:** 16, 17.

**What to build**

- A pure function: busy from the load averages, the core count and the settings (`CARETOOK_LOAD_BUSY`, default twice the cores, against the 5-minute load; `CARETOOK_LOAD_GATE=off`), plus a small command that prints busy or not with the numbers (the dispatcher and the shell scripts call it).
- A check (the check lease's take in `pnpm prd check`) and a slice worktree's creation wait while busy, polling, at most `CARETOOK_LOAD_WAIT` (600 s), then proceed and print that they gave up. The check-times log line records the seconds waited.
- `pnpm prd start` warns when busy and carries on. `pnpm prd status` prints the load against the threshold.

**Acceptance criteria**

- [ ] Unit tests: busy above the threshold and not at it; the default follows the core count; the setting overrides; `off` is never busy; unreadable load is not busy.
- [ ] Tooling tests with a stubbed load (a file the tests write): a check waits while busy and starts when the load drops; it proceeds after the bounded wait and says so; the wait is in the check-times line; a slice start waits the same way; `start` only warns; `CARETOOK_LEASES=off` and `CARETOOK_LOAD_GATE=off` wait for nothing.
- [ ] The existing lease, check-run and check-times tests pass unchanged apart from the new field.

**Blocked by:** nothing. **Blocks:** 5.

## Slice 4: A landing for a stale check

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/machinery.md · Tests: unit

**Backlog:** B-427. **User stories:** 18.

**What to build**

- `pnpm prd land <topic|hotfix/name> --recheck "<why>"`: when the check gate would refuse the tip, run the check the gate's plan asks for (quick, or full where it says full) on the tip by calling `pnpm prd check` in the branch's worktree (the check's logic stays where it is, so this slice doesn't edit the `pnpm prd` front door beyond its help text), and land only on a pass. A hotfix branch with no worktree is refused with that reason. No effect when the gate already accepts the tip. Every other refusal stands. The reason is printed, and the landing report says the tip was rechecked at landing and why.
- Land's refusal names `--recheck`, not `--force`. `--force` is unchanged.
- The orchestrator's run-through prompt and the handbook's _Landing a wave_ use `--recheck` when the gate refuses; "never `--force` unless the user says so" stays.

**Acceptance criteria**

- [ ] Tooling tests (the land tests, throwaway seam): a stale tip with `--recheck` runs the check and reaches the merge; a failing recheck refuses and merges nothing; a full-plan diff (a migration) runs the full check; an accepted tip runs no check; `--recheck` without a reason is refused; an unsynced branch is still refused with `--recheck`; a hotfix with no worktree is refused; the refusal text names `--recheck`.
- [ ] Tooling test: the landing report carries the recheck line.
- [ ] Prompt test: the run-through orchestrator prompt names `--recheck` and not `--force`.

**Blocked by:** 2 (both edit the prompts). **Blocks:** nothing.

## Slice 5: The dispatcher

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/recovery.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-426, B-428, B-439; B-392 (finished by slice 6). **User stories:** 1, 4, 5, 6, 9, 10, 13, 17, 24.

**What to build**

- `pnpm prd dispatch [--every <seconds>] [--once] [--dry-run] [--pause|--resume|--stop]`: the lock, the state file, the log; each tick gathers the facts (the registry as JSON, worktrees, session records and liveness, open asks, the load gate, the state file), calls the pick and acts as the PRD's _The dispatcher_ says (`plan`, `start`, `reopen`, `ask`).
- The answer to a reopen ask is acted on in a later tick: "reopen again" resets the count; "hold the topic" sets the row's `hold`.
- Its own asks: file the ask, then open the one-shot helper session that sends the PushNotification and ends; a helper that can't start is ignored.
- No usage-limit handling (`self-recovery`): `--pause` and `--resume` are the user's. It passes no item ids to a planner.
- `pnpm prd tidy --yes` every six hours on an idle tick.
- It refuses to run without iTerm2 unless `--dry-run`.

**Acceptance criteria**

- [ ] Tooling tests against a temporary `.loops` with stubs for `claude`, the worktree command, the opener and the backlog command: one tick per action does exactly that action and logs it with the reasons; `--dry-run` writes and opens nothing; a second instance refuses and a dead lock is taken over; `--pause` stops actions and `--resume` restores them; `--stop` ends the running instance.
- [ ] Tooling test: with the load gate busy a tick starts and plans nothing and logs why; a fixes topic and a freshly planned topic start as the pick says.
- [ ] Tooling tests: the third death files one ask and no fourth reopen; each answer is acted on; the helper session is started with the ask's line and its failure changes nothing.
- [ ] Tooling test: tidy runs once the six hours have passed and not before, and never on a tick that acted.
- [ ] The hand-off shows `pnpm prd dispatch --dry-run` on the real machine.

**Blocked by:** 1, 2, 3. **Blocks:** 6.

## Slice 6: Queue, recovery, status and the backlog session

Stack: no · Reads: docs/agents/recovery.md, docs/agents/backlog.md, docs/agents/machinery.md · Tests: unit

**Backlog:** B-392. **User stories:** 20, 21, 22, 23.

**What to build**

- `pnpm prd queue <topic>`: move the row first, print one line (the dispatcher will take it, or it isn't running). Remove the waiting loop, `--manual`, the queue tickets and the start lock from the queue script, the inventory, recovery and tidy. Remove `pnpm backlog prd migrate`.
- `pnpm prd down` records whether the dispatcher ran and stops it; `pnpm prd recover` clears its lock when the pid is gone, reopens it in a tab when it was running, and the recovery prompt leaves managed sessions to the dispatcher then.
- `pnpm prd status`: the dispatcher's state (running, paused and why, stopped) and its last log line.
- The backlog session's prompt: with the dispatcher running, deciding what runs next is moving and holding rows, and it prints no start commands; without it, as today.
- `pnpm prd help` for all of the topic's commands.

**Acceptance criteria**

- [ ] Tooling tests: `queue` reorders and returns at once, with each of its two lines; the inventory, recovery and tidy tests pass with no queue tickets or start lock; `down` records and stops the dispatcher; `recover --dry-run` names it and a real run reopens it only when it was running; a stale dispatcher lock is cleared and a live one isn't.
- [ ] Tooling test: `status` prints the dispatcher's three states.
- [ ] Prompt tests: the backlog prompt in both cases; the recovery prompt's line about managed sessions.
- [ ] No file refers to `.loops/.queue`, the start lock or `prd migrate`.

**Blocked by:** 5. **Blocks:** nothing.
