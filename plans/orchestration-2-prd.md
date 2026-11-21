# PRD: Orchestration 2 (a dispatcher, one orchestrator session per wave, one place for questions)

> Topic `orchestration-2`. Backlog: B-389, B-390, B-391, B-392. Plan: [`plans/orchestration-2-plan.md`](orchestration-2-plan.md). From the 2026-11-21 review of the orchestration flow.

## Decisions

| Decision                                                                                                                                                                                                                                                                                     | Why                                                                                      | Source                                                                              | Cost to change later                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| The dispatcher starts **everything**, in the PRD table's row order: it plans every topic with no plan and runs every planned one                                                                                                                                                             | the user's call                                                                          | asked: recommended a run list the user orders, chose everything by backlog priority | high: unprioritised work gets built and landed; `hold` and `--pause` are the brakes |
| **No veto window:** a topic the dispatcher planned may start on its next tick, before the user reads its assumed decisions (`CARETOOK_DISPATCH_PLAN_HOLD=<minutes>` adds one)                                                                                                                | follows from "everything" and "land, then report"                                        | assumed                                                                             | high once a wave lands; low to switch on                                            |
| A green wave (checks passed, Codex clean) **lands in `dev` before the user tries it**; the try-it notes go to the asks queue; the PR to `staging` stays the gate                                                                                                                             | as `pnpm prd queue` does today                                                           | asked: as recommended                                                               | medium: a prompt line                                                               |
| `pnpm prd queue <topic>` **changes meaning**: it moves the topic to the front and returns; `--manual` and the per-topic waiting terminal go (`pnpm prd start` stays for a hand-run PRD)                                                                                                      | the dispatcher does the waiting                                                          | assumed                                                                             | low                                                                                 |
| The dispatcher is a **script**, not an agent: a pure function picks, a loop launches                                                                                                                                                                                                         | scheduling is deterministic; a model adds cost and variance                              | assumed                                                                             | medium                                                                              |
| The PRD table becomes a **registry**: row order is the priority, and it stores only what git can't say (`hold`, `done`, `standing`, `alone`, the topics it comes after, hot files as path prefixes). To write, planned and running are **worked out** (a plan file on `dev`; a PRD worktree) | stored states go stale when a session dies between two steps or is run by hand           | assumed                                                                             | medium: every planner and orchestrator touches this table                           |
| Two topics that share a hot-file prefix **never run at once**; a topic is planned or run only when every topic it comes after is done                                                                                                                                                        | simple and safe; a slice-level wait stays the orchestrator's (_Waiting on another PRD_)  | assumed                                                                             | low: one rule                                                                       |
| These start on `hold`: `hosting` (going live is the user's), `documents` (waits on file storage), `marketing` (waits on the user), `encryption` (a review, not a run). `i18n` is `alone`; `quick-fixes` is `standing` (it runs whenever it has waiting items)                                | each waits on the user today                                                             | assumed                                                                             | low: `pnpm backlog prd set`                                                         |
| An orchestrator **drains, then rotates** after each landing: it starts no new slice, merges what is in flight, then a fresh session opens from _Status_                                                                                                                                      | _Status_ makes resume lossless; a rotation with slices in flight would kill their agents | assumed                                                                             | low: a prompt line                                                                  |
| Dispatcher-run sessions ask through **`pnpm prd ask`** (a machine-local queue) and wait in the background, never AskUserQuestion; a topic with an open question holds only itself                                                                                                            | one place to answer, and nothing blocks the rest                                         | assumed                                                                             | low                                                                                 |
| **One planner at a time**; the cap of three running PRDs stays; **no load gate**                                                                                                                                                                                                             | planners edit the same table; `check-speed` found the load is always above any gate      | assumed                                                                             | low: environment variables                                                          |
| The dispatcher manages **only sessions it started**; a worktree opened by hand is reported and left alone                                                                                                                                                                                    | it can't know what a hand-run session was told                                           | assumed                                                                             | low                                                                                 |
| Sessions stay **interactive iTerm2 tabs with Remote Control**, started through a wrapper that records them; a new tab opens **without taking focus**                                                                                                                                         | the user can watch and steer any of them, and isn't typed over                           | assumed                                                                             | medium                                                                              |
| A managed worktree with no live session is reopened **twice**, then the topic waits on an ask. On a usage limit the dispatcher pauses, and when it lifts it replaces each managed session with a fresh one                                                                                   | a stalled session can't be nudged by a script; a fresh one resumes from _Status_         | assumed                                                                             | low                                                                                 |
| PRD and plan stay **two files**                                                                                                                                                                                                                                                              | merging them touches every prompt; not needed here                                       | assumed                                                                             | low                                                                                 |

**The skeptic pass** (one fresh agent, 2026-11-21) changed: states are worked out, not stored; the reopen rule (records now outlive their session); the usage-limit handling; drain-then-rotate; the auto marker moved out of the worktree; `alone` and `standing`; sessions end themselves; slice 2 split in two; the docs trim. **Declined:** asking the user about the four holds (each already waits on them) and about `queue` changing meaning (it is what they asked the dispatcher for); both are in the table above for a veto.

## Problem Statement

The project is five days old and has 3,042 commits on `dev`. The flow that produced them works, but the dev keeper is its scheduler, and the machine and the keeper are now the limits, not the agents.

- **Every PRD takes five or more manual steps:** a terminal for the planner, one for `pnpm prd start`, pasting the orchestrator command into another, choosing a landing mode, saying "land it", and `pnpm prd rm`. `pnpm prd queue` removes some of them but holds a terminal per topic and only knows the cap of three, not dependencies or hot files.
- **Planning is serial on the keeper.** Ten topics wait for a PRD, and three more have waiting items and no row in the PRD table. Nothing plans one until the keeper opens a planner.
- **The PRD table can't be read by a tool.** What a topic depends on and which files it shares are sentences, so only a session that reads the whole table can decide what may run.
- **Orchestrator sessions live as long as their PRD.** `quick-fixes` is 43 commits ahead of `dev` in one session line; the handbook's answer is "start a fresh session when it gets slow or confused", by hand.
- **Questions arrive in whichever tab asked them.** With three orchestrators, a planner and a backlog session, the keeper polls tabs to find who is waiting.

## Solution

- **A dispatcher** (`pnpm prd dispatch`, one terminal, started once). Every minute it reads the registry, the worktrees, the session records and the asks, and does at most one thing: start the first planned topic that may run, open a planner for the first topic that needs a PRD, reopen a managed session that died, or nothing. It prints why.
- **A PRD registry.** The PRD table keeps its order (the priority) and a few stored facts; whether a topic is to write, planned or running is worked out from the plan files and worktrees. `pnpm backlog prd` edits it; `pnpm prd queue <topic>` moves a topic to the front.
- **One orchestrator session per wave.** After a landing the orchestrator drains its slices, commits _Status_ and runs `pnpm prd rotate`, which ends its session and opens a fresh one with the resume prompt.
- **One asks queue.** `pnpm prd ask` files a question (options and a recommendation) or a report (a landed wave and what to try); `pnpm prd asks` lists them; `pnpm prd answer` answers one and wakes the session that asked. A notification says a new one arrived.
- **The keeper's day:** write in the inbox, read `pnpm prd asks`, open the PRs to `staging` and `main`. `--pause`, `hold` and `--stop` are the brakes.

## User Stories

1. As the dev keeper, I want one command, run once, to keep planners and orchestrators running, so that I don't start each one by hand.
2. As the dev keeper, I want the dispatcher to print what it did and why it did nothing (no slot, waiting on a topic, a shared hot file, an open question, opened by hand), so that I can trust it.
3. As the dev keeper, I want `pnpm prd dispatch --dry-run` to show what it would do next, so that I can check before I leave it running.
4. As the dev keeper, I want `--pause`, `--resume` and `--stop`, so that I can halt new starts without touching running work.
5. As the dev keeper, I want to put a topic on `hold`, so that it never starts on its own.
6. As the dev keeper, I want `pnpm prd queue <topic>` to move a topic to the front and return, so that priority is one command and no terminal is held.
7. As the dev keeper, I want the row order of the PRD table to be the priority, so that I can see and change it in one place.
8. As a planner or orchestrator, I want to set a topic's order, dependencies and hot files with `pnpm backlog prd`, so that I never hand-edit the table.
9. As the dev keeper, I want `pnpm backlog doctor` to flag a topic that comes after an unknown topic, a cycle, or waiting items with no row, so that the registry stays true.
10. As the dev keeper, I want two topics that share a hot file never to run at once, so that their landings don't collide.
11. As the dev keeper, I want a topic planned only after the topics it comes after are done, so that its plan is written against the code it will change.
12. As the dev keeper, I want at most one planner at a time, so that planners don't edit the registry over each other.
13. As an orchestrator, I want my session replaced after each landing once my slices have drained, so that each wave starts with a small context.
14. As the dev keeper, I want `pnpm prd rotate --mid-wave` for a session that has gone slow, knowing its slice agents restart from their worktrees.
15. As the dev keeper, I want a rotated session to keep its name, so that Remote Control still reaches `prd-<topic>`.
16. As the dev keeper, I want every question from an unattended session in one list with its options and recommendation, so that I answer in one place.
17. As a planner or orchestrator, I want to be woken when my question is answered, so that I don't poll.
18. As the dev keeper, I want a landed wave's report (what it addresses, what to try, the link) and a planner's assumed decisions in the same list, so that I can read them when I like.
19. As the dev keeper, I want a notification when a new ask arrives, and new tabs that don't take focus, so that I'm told without being interrupted.
20. As the dev keeper, I want a topic with an open question to hold only itself, so that the rest carries on.
21. As the dev keeper, I want a managed worktree whose session died to be reopened, at most twice, and then an ask, so that a failing session doesn't loop.
22. As the dev keeper, I want the dispatcher to pause on a usage limit and, when it lifts, replace the stalled sessions, so that work carries on without me.
23. As the dev keeper, I want `pnpm prd recover` to restart the dispatcher and tidy session records, so that a restart needs one command.
24. As the dev keeper, I want `pnpm prd status` to show the dispatcher's state, each session and the open asks, so that one screen says what is going on.
25. As the backlog session, I want the asks and the registry in my overview, so that I report what waits on the user and stop printing start commands.
26. As a finished orchestrator or planner, I want to end my own session, so that tabs and records don't pile up.

## Implementation Decisions

**The PRD registry (`scripts/backlog/`)**

- The PRD table's columns become: `PRD`, `Flags`, `After`, `Hot files`, `Doc and notes`. `Flags` holds any of `hold`, `done`, `standing`, `alone`, or `—`. `After` is topics, comma-separated, or `—`. `Hot files` is repo path prefixes, comma-separated, or `—`.
- **The state is worked out**, by one pure function, from the row and the facts: `hold` and `done` from the flag; `running` when a `prd/<topic>` worktree exists; `planned` when `plans/<topic>-plan.md` is on `dev`; else `to-write`. A `standing` topic is `planned` only while it has triaged items.
- `done` is set by `pnpm prd rm <topic>` when it removes a PRD worktree whose branch is merged and whose plan _Status_ has no slice left to run (never for a `standing` topic). So a hand-run PRD closes the same way as a dispatched one.
- `pnpm backlog prd list [--json]` (with the worked-out state), `prd add <topic>`, `prd set <topic> flags=… after=… hot=… notes=…`, `prd move <topic> --first|--last|--before <topic>|--after <topic>`. Writes follow the backlog tool's rules (the lock, one commit on `dev`, the trailer).
- A one-time migration rewrites today's table. Every hot file named in prose becomes a path prefix (the loop finds the paths); a dependency on a whole topic becomes `After`; a slice-level one stays in the notes for that topic's orchestrator.
- `doctor` gains the registry findings of story 9.

**Sessions (`scripts/loops/`)**

- `session.sh <name> [--managed] [--auto] -- <claude args>` runs `claude` as its child and keeps `.loops/.sessions/<name>.json`: pid, kind, topic, started, the command, `managed`, `auto`, and, when it exits, ended and the exit code. The record stays until the worktree is removed, so "no live session" is a pid check. `pnpm prd start`'s printed command, `open`, `plan --open` and the dispatcher all start sessions through it.
- The tab opener gains a mode that creates the tab without activating iTerm2 and writes to the tab it made, not the current session.
- `pnpm prd end`: a finished session ends itself (its last step, after `pnpm prd rm`).

**Rotation**

- `pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`: refuses an uncommitted plan file, or slice worktrees of the topic unless `--mid-wave`. A detached helper then ends the recorded session, waits for it to go, and opens a fresh one in a new tab with `prompt.sh orchestrator <topic> --resume` (plus `--auto` when the record or _Status_ says run-through). `--mid-wave` kills the live slice agents; the resumed orchestrator respawns them with `--continue`.
- The orchestrator prompt and handbook: after a landing and its docs, start no new slice; when the slices in flight are merged, commit _Status_ and rotate. With nothing in flight, rotate at once.

**Asks**

- A pure store over `.loops/.asks/<id>.json` (machine-local, untracked, created exclusively so two sessions can't take one id): kind (`question` or `report`), the session, topic, text, options, recommended, asked at, answer, answered at.
- `pnpm prd ask --topic <t> --question <text> --option <a> … --recommend <a>`, `pnpm prd ask --topic <t> --report <text>`, `pnpm prd ask --wait <id>` (exit 0 with the answer; 75 on timeout), `pnpm prd asks [--json]`, `pnpm prd answer <id> <option or text>`, `pnpm prd asks --done <id>`.
- Unattended (`--auto`) sessions ask this way and carry on with whatever doesn't depend on the answer. A session the user opened by hand keeps AskUserQuestion.

**The pick (a pure module)**

- Input: the registry rows with their worked-out states, the session records with liveness, open questions by topic, the cap, the pause flag, the reopen counts, the plan-hold minutes. Output: one action (`start`, `plan`, `reopen`, `ask`, `none`) and a reason per topic passed over.
- Rules, in order: paused → none. A `prd/` or `plan/` worktree whose record is `managed` and has no live session → `reopen` (twice per worktree, then an `ask`, and the topic is skipped until it is answered); an unmanaged one is only reported. A `planned` topic may start when a slot is free, every `After` topic is done, no running topic shares a hot-file prefix, no `alone` topic is running (and nothing runs when it is the `alone` one), it has no open question, and the plan hold has passed. A `to-write` topic may be planned when no planner worktree exists and every `After` topic is done. Starts come before plans; within each, row order.

**The dispatcher**

- `pnpm prd dispatch [--every 60] [--once] [--dry-run] [--pause|--resume|--stop]`. One instance (a pid lock). Each tick: gather the facts, call the pick, do the action, log to `.loops/.dispatch.log`.
- `plan`: `new.sh plan`, then a managed session with `prompt.sh plan <topic> --auto` and the topic's waiting item ids. `start`: `new.sh prd`, then a managed session with `prompt.sh orchestrator <topic> --auto`.
- **A usage limit:** before any action, and every 10 minutes while paused for it, the dispatcher probes `claude -p ok` (as `recover --wait` does). When the probe fails it pauses with the reason. When it passes again it rotates each managed session that was running (`--mid-wave`), one per tick, then carries on.
- `pnpm prd queue <topic>` becomes `pnpm backlog prd move <topic> --first`; the waiting loop and `.loops/.queue/` go.

**Recovery, status and the backlog session**

- `pnpm prd down` records whether the dispatcher was running; `pnpm prd recover` restarts it in a tab, and its stale-lock list learns the dispatcher's lock and forgets the queue's. The recovery agent leaves managed sessions to the dispatcher when it runs.
- `pnpm prd status` adds the dispatcher (running, paused or stopped, its last line), each session (managed or by hand, age) and the open asks.
- The backlog session's prompt reads `pnpm prd asks` and `pnpm backlog prd list` for its overview, and "decide what to run next" becomes reordering and holding topics.
- Both planner prompts set the topic's row with `pnpm backlog prd` (`after=`, `hot=`), never a hand edit.

## Testing Decisions

- A good test checks what the tooling decides or does, through its command or its pure module.
- **Pure modules get unit tests:** the registry parser and writer (a round trip, each command, the doctor findings), the worked-out state, the asks store, and the pick (each rule, the order of rules, row order, the hot-file prefix match, `alone`, `standing`, the reopen limit, pause, the plan hold).
- **Scripts get tooling tests with a stub `claude`:** the session record through start, exit and removal; `rotate` ends the old pid, opens the new command and keeps the name; `ask --wait` returns on an answer and times out; one dispatcher tick per action against a temporary `.loops`; the probe failing and recovering; `queue` reorders and returns.
- No app code, no stack, no browser checks.

## Out of Scope

- **Merging the PRD and plan into one file**, and tiers of spec. A later topic, once the dispatcher shows which planning steps still cost time.
- **A manager agent** that chooses what to run. The pick is a function; if its rules prove too blunt, that is a new item.
- **Running sessions headless** (`claude -p`) or in the cloud. Tabs with Remote Control stay.
- **Adopting sessions opened by hand.** They finish as today; a topic reopened with `pnpm prd open` stays the user's.
- **A load gate**, and any change to checks: `check-speed` and `test-health`.
- **Slice agents.** They stay background agents of their orchestrator, one per slice.
- **Opening the PRs to `staging` and `main`.** The keeper's.

## Further Notes

- **The risk the user accepted:** with "everything by priority" and no veto window, the dispatcher will plan and land topics nobody looked at that week. Row order, `hold`, `--pause` and `CARETOOK_DISPATCH_PLAN_HOLD` are the brakes, so the keeper should read the registry's order before the first `pnpm prd dispatch`.
- **It depends on iTerm2 tabs.** Without them `session.sh`'s opener prints the command and the dispatcher can't run unattended.
- **Unproven until slice 4:** that a helper started from a session's shell outlives that session being ended. Slice 4's hand-off must show it on a real session; if it can't, rotation moves into the dispatcher (the session files a rotate request and the dispatcher acts on it).
- **Hot files:** this PRD edits `prompt.sh`, `prd.sh`, `queue.sh`, `recover.sh`, `rm.sh` and the PRD table, which `check-speed` and `test-health` also touch: it runs after `check-speed` and before `test-health`, not beside it.
