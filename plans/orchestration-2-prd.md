# PRD: Orchestration 2 (a PRD registry, one orchestrator session per wave, one place for questions, fixes by category)

> Topic `orchestration-2`. Backlog: B-389, B-390, B-391, B-395. Plan: [`plans/orchestration-2-plan.md`](orchestration-2-plan.md). From the 2026-11-21 review of the orchestration flow. **The dispatcher (B-392) moved to the follow-on topic `orchestration-3`** (_Follow-on_, below): this topic builds what it stands on, and each part is useful without it.

## Decisions

| Decision                                                                                                                                                                                                                                                                                                     | Why                                                                                                                   | Source                                                                                 | Cost to change later                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **The topic is cut in two.** Here: the registry, recorded sessions, the asks queue, rotation, unattended orchestrator prompts and the fix categories (six slices). `orchestration-3`: the pick, unattended planners, the dispatcher, and `queue`, recovery and status (B-392)                                | the user's rule: about six slices, so the next planner or the user can reorder                                        | preference                                                                             | low until `orchestration-3` is planned                                               |
| **`quick-fixes` becomes five standing topics**, `fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug` and `fixes-nit`, each with its own plan file, branch, waves and landings. An item's category **is its topic** (`prd=fixes-bug`), not a note. `quick-fixes` finishes its current wave and is then done | a topic per category makes "never mixed in one landing" true by construction, and needs no new field in the tracker   | assumed (the item allows "a plan or topic per category")                               | medium: 25 items move, five plan files, the prompts' wording                         |
| **No order of priority between the five.** Their rows go where `quick-fixes` sits today, in the order the item lists them; the user reorders them before anything reads the order (the dispatcher, `orchestration-3`)                                                                                        | the user will set it later                                                                                            | preference                                                                             | low: `pnpm backlog prd move`                                                         |
| The 25 waiting fixes get the categories in the plan's table (slice 6). The rule: wrong behaviour or data is `bug`; look, layout, wording and flow are `ui`; speed and load are `perf`; scripts, checks, tests and flakes are `tooling`; a small tidy with no behaviour change is `nit`                       | each item needs one before the split                                                                                  | assumed                                                                                | low: `pnpm backlog set B-<n> prd=…`                                                  |
| The PRD table becomes a **registry**: row order is the priority, and it stores only what git can't say (`hold`, `done`, `standing`, `alone`, the topics it comes after, hot files as path prefixes). To write, planned and running are **worked out** (a plan file on `dev`; a PRD worktree)                 | stored states go stale when a session dies between two steps or is run by hand                                        | assumed                                                                                | medium: every planner and orchestrator touches this table                            |
| **A question reaches the phone from the session that asks it:** right after `pnpm prd ask` the session sends a PushNotification (Remote Control), and `pnpm prd ask` prints that reminder. No push service is added. `CARETOOK_ASK_NOTIFY` may name a command of the user's that `pnpm prd ask` also runs    | nothing a script can call reaches the phone without a new service (checked: the `claude` CLI has no notify command)   | preference (phone), assumed (how)                                                      | low. Asks with no session behind them (the dispatcher's own) are `orchestration-3`'s |
| An orchestrator **drains, then rotates** after each landing: it starts no new slice, merges what is in flight, then a fresh session opens from _Status_                                                                                                                                                      | _Status_ makes resume lossless; a rotation with slices in flight would kill their agents                              | assumed                                                                                | low: a prompt line                                                                   |
| **Rotation runs in the new tab**, not in a helper of the old session: `pnpm prd rotate` opens a background iTerm2 tab whose command ends the old session, waits for it to go and starts the fresh one. Without iTerm2 it prints that command and changes nothing                                             | the earlier draft's detached helper was unproven (would it outlive its session?); a tab is iTerm2's child, so it does | assumed                                                                                | low                                                                                  |
| Run-through (`--auto`) orchestrators ask through **`pnpm prd ask`** (a machine-local queue) and wait in the background, never AskUserQuestion; each landing files a report there. A session the user opened by hand keeps AskUserQuestion                                                                    | one place to answer; `pnpm prd queue` already opens such sessions today                                               | assumed                                                                                | low                                                                                  |
| Sessions stay **interactive iTerm2 tabs with Remote Control**, started through a wrapper that records them; a tab opened by tooling **doesn't take focus**                                                                                                                                                   | the user can watch and steer any of them, and isn't typed over                                                        | assumed                                                                                | medium                                                                               |
| These start on `hold`: `documents` (waits on file storage), `encryption` (a review, not a run), `assistant-2` (needs an AI vendor and a dependency the user approves). `hosting` and `marketing` are `done` with their leftover items the user's. `i18n` is `alone`                                          | each waits on the user today                                                                                          | assumed                                                                                | low: `pnpm backlog prd set`                                                          |
| `pnpm prd queue` **keeps today's meaning** in this topic (wait for a slot, open a run-through orchestrator). It becomes "move to the front" with the dispatcher                                                                                                                                              | nothing replaces the waiting until `orchestration-3`                                                                  | assumed                                                                                | low                                                                                  |
| **Carried to `orchestration-3`, already answered:** the dispatcher starts **everything**, in the registry's row order; a green wave **lands in `dev` before the user tries it**                                                                                                                              | the user's calls                                                                                                      | asked: recommended a run list the user orders, chose everything; asked: as recommended | high once it runs; nothing here acts on them                                         |

**The skeptic pass** is recorded at the end of this file (_Skeptic pass_).

## Problem Statement

The project is five days old and has 3,042 commits on `dev`. The flow that produced them works, but the dev keeper is its scheduler, and the machine and the keeper are now the limits, not the agents.

- **The PRD table can't be read by a tool.** What a topic depends on and which files it shares are sentences, so only a session that reads the whole table can decide what may run. Three topics have waiting items and no row.
- **Orchestrator sessions live as long as their PRD.** `quick-fixes` is 45 commits ahead of `dev` in one session line; the handbook's answer is "start a fresh session when it gets slow or confused", by hand.
- **Questions arrive in whichever tab asked them.** With three orchestrators, a planner and a backlog session, the keeper polls tabs to find who is waiting, and a question asked while they are away reaches nothing they carry.
- **Small fixes land as one mixed bag.** A `quick-fixes` wave mixes a layout tweak, a sync bug and a flaky test, so one slow fix holds the rest, the keeper can't try "the UI ones" alone, and nothing can be prioritised by kind.
- **Every PRD still takes five or more manual steps.** That is the dispatcher's problem (`orchestration-3`); it needs the four things above first.

## Solution

- **A PRD registry.** The PRD table keeps its order (the priority) and a few stored facts; whether a topic is to write, planned or running is worked out from the plan files and worktrees. `pnpm backlog prd` reads and edits it.
- **Recorded sessions, one per wave.** Sessions start through a wrapper that records them. After a landing the orchestrator drains its slices, commits _Status_ and runs `pnpm prd rotate`, which opens a fresh session with the resume prompt and ends the old one.
- **One asks queue.** `pnpm prd ask` files a question (options and a recommendation) or a report (a landed wave and what to try); `pnpm prd asks` lists them; `pnpm prd answer` answers one and wakes the session that asked. The asking session pushes it to the keeper's phone.
- **Fixes by category.** Five standing topics replace `quick-fixes`. Triage puts a small fix in one by its kind; each lands on its own.

## User Stories

1. As the dev keeper, I want the row order of the PRD table to be the priority, so that I can see and change it in one place.
2. As a planner or orchestrator, I want to set a topic's order, flags, dependencies and hot files with `pnpm backlog prd`, so that I never hand-edit the table.
3. As any session, I want `pnpm backlog prd list` to say each topic's state (to write, planned, running, hold, done) worked out from git, so that it is never stale.
4. As the dev keeper, I want to put a topic on `hold`, so that everyone can see it waits on me.
5. As the dev keeper, I want `pnpm backlog doctor` to flag a topic that comes after an unknown topic, a cycle, waiting items with no row, or waiting items on a done topic, so that the registry stays true.
6. As an orchestrator, I want my session replaced after each landing once my slices have drained, so that each wave starts with a small context.
7. As the dev keeper, I want `pnpm prd rotate --mid-wave` for a session that has gone slow, knowing its slice agents restart from their worktrees.
8. As the dev keeper, I want a rotated session to keep its name, so that Remote Control still reaches `prd-<topic>`.
9. As the dev keeper, I want tabs that tooling opens not to take focus, so that I'm not typed over.
10. As a finished orchestrator or planner, I want to end my own session, so that tabs and records don't pile up.
11. As the dev keeper, I want every question from a run-through session in one list with its options and recommendation, so that I answer in one place.
12. As the dev keeper, I want each new question on my phone, so that I can answer while away.
13. As an orchestrator, I want to be woken when my question is answered, so that I don't poll.
14. As the dev keeper, I want a landed wave's report (what it addresses, what to try, the link) in the same list, so that I can read it when I like.
15. As the dev keeper, I want a session with an open question to carry on with whatever doesn't depend on it.
16. As the dev keeper, I want `pnpm prd status` to show each session and the open asks, so that one screen says what is going on.
17. As the backlog session, I want the asks and the registry in my overview, so that I report what waits on the user.
18. As the dev keeper, I want small fixes sorted into UI, tooling, speed, bugs and nits, each landing separately, so that I can try and prioritise one kind at a time.
19. As a triaging session, I want one rule for which category a fix belongs to, so that I don't guess.
20. As the dev keeper, I want a fixes topic to run only while it has waiting items and never be marked done, so that it is always there for the next fix.

## Implementation Decisions

**The PRD registry (`scripts/backlog/`)**

- The PRD table's columns become: `PRD`, `Flags`, `After`, `Hot files`, `Doc and notes`. `Flags` holds any of `hold`, `done`, `standing`, `alone`, or `—`. `After` is topics, comma-separated, or `—`. `Hot files` is repo path prefixes, comma-separated, or `—`.
- **The state is worked out**, by one pure function, from the row and the facts: `hold` and `done` from the flag; `running` when a `prd/<topic>` worktree exists; `planned` when `plans/<topic>-plan.md` is on `dev`; else `to-write`. A `standing` topic is `planned` only while it has triaged items.
- `done` is set by `pnpm prd rm <topic>` when it removes a PRD worktree whose branch is merged and whose plan _Status_ has no slice left to run (never for a `standing` topic).
- `pnpm backlog prd list [--json]` (with the worked-out state), `prd add <topic>`, `prd set <topic> flags=… after=… hot=… notes=…`, `prd move <topic> --first|--last|--before <topic>|--after <topic>`. Writes follow the backlog tool's rules (the lock, one commit on `dev`, the trailer).
- A one-time `pnpm backlog prd migrate` rewrites today's table. Every hot file named in prose becomes a path prefix (the loop finds the paths); a dependency on a whole topic becomes `After`; a slice-level one stays in the notes for that topic's orchestrator.
- `doctor` gains the registry findings of story 5.

**Sessions (`scripts/loops/`)**

- `session.sh <name> [--auto] -- <claude args>` runs `claude` as its child and keeps `.loops/.sessions/<name>.json`: pid, kind, topic, started, the command, `auto`, and, when it exits, ended and the exit code. The record stays until the worktree is removed, so "no live session" is a pid check. `pnpm prd start`'s printed command, `queue`, `open` and `plan --open` all start sessions through it.
- The tab opener gains `--background`: it creates the tab without activating iTerm2 and writes to the tab it made, not the current session.
- `pnpm prd end`: a finished session ends itself (its last step, after `pnpm prd rm`).

**Rotation**

- `pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`: refuses an uncommitted plan file, a topic with no session record, or slice worktrees of the topic unless `--mid-wave`. It then opens a background tab running `rotate-into.sh <name>`, which ends the recorded session (TERM, then KILL after a wait), waits for the pid to go, and starts `prompt.sh orchestrator <topic> --resume` (plus `--auto` when the record or _Status_ says run-through) through `session.sh`: always fresh, never `--continue`, the same name. Without iTerm2 it prints that command for the user and ends nothing.
- `--mid-wave` kills the live slice agents with their orchestrator; the resumed one respawns them with `--continue`.
- The orchestrator prompt and handbook: after a landing and its docs, start no new slice; when the slices in flight are merged, commit _Status_ and rotate. With nothing in flight, rotate at once.

**Asks**

- A pure store over `.loops/.asks/<id>.json` (machine-local, untracked, created exclusively so two sessions can't take one id): kind (`question` or `report`), the session, topic, text, options, recommended, asked at, answer, answered at.
- `pnpm prd ask --topic <t> --question <text> --option <a> … --recommend <a>`, `pnpm prd ask --topic <t> --report <text>`, `pnpm prd ask --wait <id>` (exit 0 with the answer; 75 on timeout), `pnpm prd asks [--json]`, `pnpm prd answer <id> <option or text>`, `pnpm prd asks --done <id>`.
- **Telling the keeper:** `pnpm prd ask` shows a macOS notification, runs `$CARETOOK_ASK_NOTIFY <id> <kind> <topic> <text>` when that is set (its failure is ignored), and prints "Now send a PushNotification: …" with a one-line text. The `--auto` prompt makes the push a rule for every question, and for a report only when a wave landed or something failed.
- A keeper who answers in the session itself (through Remote Control) is answering the ask: the session records it with `pnpm prd answer`.
- Run-through sessions ask this way and carry on with whatever doesn't depend on the answer. A session the user opened by hand keeps AskUserQuestion.

**Fix categories**

- Five topics, flagged `standing`: `fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`. Each has `plans/fixes-<cat>-plan.md` (no PRD: the plan is the whole spec, as `prompt.sh` already handles), with a _Status_ table and slices appended one per item by its orchestrator at a wave boundary. The rules every fix slice follows move from the `quick-fixes` plan's header to one file, `plans/fixes-rules.md`, which each fix slice's `Reads` names.
- The category rule (the _Decisions_ table) goes into the planner and backlog handbooks and the backlog session's and orchestrators' triage lines. An item that fits two takes the first that applies in this order, which is a tie-break and not a priority: `bug`, `perf`, `ui`, `tooling`, `nit`.
- **The split is the orchestrator's step** (the backlog is written only on `dev`): add the five rows, move each waiting unclaimed `quick-fixes` item to its topic with a note, and clear `standing` on `quick-fixes` so that `pnpm prd rm quick-fixes` marks it done when its current wave has landed. Claimed items finish in `quick-fixes`.
- `doctor` flags a waiting item whose topic is `done` (so a fix triaged to `quick-fixes` after the split is caught).
- A fixes topic's branch and worktree are made when it has items to run and removed when its wave has landed, like any PRD; the row stays.

**Status and the backlog session**

- `pnpm prd status` adds each recorded session (live or ended, age, run-through or not) and the open asks (the count and the oldest).
- The backlog session's prompt reads `pnpm prd asks` and `pnpm backlog prd list` for its overview. Both planner prompts set the topic's row with `pnpm backlog prd` (`after=`, `hot=`), never a hand edit.

## Testing Decisions

- A good test checks what the tooling decides or does, through its command or its pure module.
- **Pure modules get unit tests:** the registry parser and writer (a round trip, each command, the doctor findings), the worked-out state and the asks store.
- **Scripts get tooling tests with a stub `claude`:** the session record through start, exit and removal; `rotate` prints or opens the right command, and that command ends the old pid, starts the new session and keeps the name; `ask --wait` returns on an answer and times out; the notify hook runs and its failure is ignored; the prompts' wording.
- No app code, no stack, no browser checks. One thing only a person's machine can show, and slice 4's hand-off must: a real rotation of a throwaway interactive session.

## Out of Scope

- **The dispatcher, the pick, unattended planners, and `queue`, recovery and status for them** (B-392): `orchestration-3`.
- **An order of priority between the fix categories.** The user's, later.
- **A push service** (ntfy, Pushover, a text message). `CARETOOK_ASK_NOTIFY` is the socket for one if the user wants it.
- **Rewriting the `quick-fixes` plan's history.** Its 62 slices stay as they are.
- **Merging the PRD and plan into one file**, a manager agent, headless sessions, a load gate: as the earlier draft said, later topics if needed.

## Follow-on: `orchestration-3` (B-392)

To plan once this topic is in `dev`, against the code it leaves. The earlier draft's design is in git (`git show da6db5db:plans/orchestration-2-prd.md`, its slices 5, 7 and 8); what is settled:

- `pnpm prd dispatch`: a script, one instance, at most one action a tick (start, plan, reopen, ask), chosen by a pure pick from the registry, the session records and the open asks. It starts everything in row order (the user's call), lands green waves before the user tries them (the user's call), never runs two topics that share a hot-file prefix, plans one topic at a time, and manages only sessions it started.
- `pnpm prd queue <topic>` becomes "move to the front"; recovery restarts the dispatcher; the backlog session stops printing start commands.
- **Still open for its planner:** how an ask with no session behind it (a session that died twice, a usage limit) reaches the phone, which needs a service the user approves; whether the five fix topics share the cap of three or take one slot between them; a hold between a planner landing and its topic starting.

## Skeptic pass

(Filled in before landing.)
