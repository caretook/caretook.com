# PRD: Orchestration 3 (a dispatcher that plans and starts PRDs by itself)

> Topic `orchestration-3`. Backlog: B-392, B-426, B-427, B-428, B-439. Plan: [`plans/orchestration-3-plan.md`](orchestration-3-plan.md). It builds on `orchestration-2` (the registry, recorded sessions, the asks queue, rotation, the fix topics). Thirteen more items were triaged here; they moved to four follow-on topics (_Follow-on topics_, below) so this one stays at six slices.

## Decisions

| Decision                                                                                                                                                                                                                                                                                                                                                                                               | Why                                                                                                                                                                  | Source                                                     | Cost to change later                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| **No hold between a planner landing and its topic starting** (B-439). A topic the dispatcher planned may start on the next tick, before the user reads its assumed decisions. The brakes are the `hold` flag, row order and `pnpm prd dispatch --pause`                                                                                                                                                | the user's call                                                                                                                                                      | asked: recommended wait for release, chose no hold         | high once a wave lands (a revert or a fix slice); low before |
| **The dispatcher starts everything, in the registry's row order,** and a green wave lands in `dev` before the user tries it                                                                                                                                                                                                                                                                            | the user's calls, carried from `orchestration-2`                                                                                                                     | preference                                                 | high once it runs                                            |
| **The topic is cut in five.** Here: the pick, unattended planners, the fixes rules, the load gate, a landing for a stale check, the dispatcher, and `queue`, recovery and status for it. Follow-ons, in this row order after it: `staging-ship` (B-404, B-430, B-436), `worker-watch` (B-408, B-434), `self-recovery` (B-407, B-433, B-437, B-438), `inbox-agent` (B-406, B-425, B-429, B-435)         | about six slices a PRD; each follow-on lands something usable alone                                                                                                  | preference (the cut), assumed (the grouping and the order) | low: `pnpm backlog set`, `prd move`                          |
| **Priority stays the registry's row order** until `inbox-agent` (B-406, the "Next up" list). `pnpm prd queue <topic>` becomes "move to the front"                                                                                                                                                                                                                                                      | the dispatcher needs one order today, and the table has it                                                                                                           | assumed                                                    | low                                                          |
| **An unattended planner waits for the answer to a real question, with no timeout.** It never takes its own recommendation on a _What to ask_ matter (permissions, existing data, compliance, a dependency). While it waits, one more planner may run                                                                                                                                                   | those are the costly guesses; "no hold" covers assumed decisions, not asked ones                                                                                     | assumed                                                    | low: a prompt line                                           |
| **Fixes topics:** `standing` means dispatchable while it has waiting items, and `hold` is only the user's brake (one answer: the two are separate). At most **one** fixes topic runs at a time and it takes one of the three slots. It starts with three or more waiting items (`CARETOOK_FIXES_MIN`), or with fewer when no other topic could take the slot                                           | the machine is the limit; a worktree, stack, PR and Codex round for one small fix is waste while PRDs wait, and an idle slot is worse                                | assumed                                                    | low: a setting                                               |
| **A fixes wave's hot files are set by its orchestrator** when it writes the wave's slices (`pnpm backlog prd set fixes-<cat> hot=…`) and cleared when its worktree is removed. A fix that would touch a running topic's hot file waits for a later wave                                                                                                                                                | items carry no paths, so nothing can know before the slices are written                                                                                              | assumed                                                    | low                                                          |
| **The load gate is bounded for work in flight and unbounded for new work.** A check or a slice start waits while the machine is busy, at most 10 minutes, then goes ahead and says so. The dispatcher starts no new topic or planner while it is busy. Busy: the 5-minute load is over twice the core count (`CARETOOK_LOAD_BUSY`)                                                                     | `check-speed` found the load is often above any gate, so an unbounded wait inside a wave could stall it for good; not starting new work is what brings the load down | assumed                                                    | low: settings                                                |
| **A sanctioned landing for a stale check** (B-427): `pnpm prd land <topic> --recheck "<why>"` runs the check the gate asks for on the tip, in a check lease, and lands on a pass. `--force` stays the user's alone. Plan branches never needed `--force`; the prompts and handbook stop saying so                                                                                                      | agents are blocked from `--force`, and "check, then land" leaves a window for the tip to move                                                                        | assumed                                                    | low                                                          |
| The dispatcher is a **script** in its own terminal tab, one instance, at most one action a tick, chosen by a **pure pick**. It manages only sessions it started (`managed` in the record); a worktree opened by hand counts for slots and hot files and is otherwise left alone. **Two topics share a hot file when one's prefix starts with the other's** (plain text, as the rows are written today) | scheduling is deterministic; a model adds cost and variance; it can't know what a hand-run session was told                                                          | assumed                                                    | medium                                                       |
| **No push service.** An ask the dispatcher files itself is pushed by a one-shot helper session (Remote Control, haiku) that sends the notification and ends. When `claude` can't run (a usage limit), only the macOS notification and `CARETOOK_ASK_NOTIFY` fire                                                                                                                                       | the user didn't pick a push service (B-407's note); a script can't push                                                                                              | preference (no service), assumed (the helper)              | low. The rest of B-429 is `inbox-agent`'s                    |
| A managed session that dies is reopened **twice**, then the topic waits on an ask. A session being rotated isn't dead. **A usage limit isn't handled here:** stalled sessions stay alive, so nothing reopens in a loop; the user pauses and resumes by hand until `self-recovery`                                                                                                                      | a script can't nudge a stalled session; detecting and draining for a limit is B-407 and B-433's whole subject                                                        | assumed                                                    | low                                                          |
| **One planner at a time** (two when the first waits on an ask); the cap of three running PRDs stays                                                                                                                                                                                                                                                                                                    | planners write the same table; the user reads one report at a time                                                                                                   | assumed                                                    | low: settings                                                |
| The dispatcher runs `pnpm prd tidy --yes` every six hours                                                                                                                                                                                                                                                                                                                                              | `orchestration-2` left the cleanup run's schedule to it                                                                                                              | assumed                                                    | low                                                          |

**The skeptic pass** (one fresh agent, 2026-11-21) changed: the usage-limit handling moved to `self-recovery` (the dispatcher slice was too big, and replacing stalled sessions needed `rotate --mid-wave`, which is the user's word only and refuses an uncommitted _Status_); the fixes rule no longer needs an item's age, which the tracker doesn't record (fewer than three waiting start only when the slot would sit idle); hot files match as plain text prefixes, since live rows such as `scripts/loops/session` rely on that; a session being rotated is never reopened; `--recheck` runs `pnpm prd check` in the branch's worktree and is refused for a hotfix without one; the dispatcher passes no item ids to a planner (the prompt reads the topic's items, so a reopen loses nothing); B-426, B-428 and B-439 close with the dispatcher slice, not their first halves. **Declined:** nothing.

## Problem Statement

`orchestration-2` gave the tooling a registry it can read, sessions it can see and one place for questions. The dev keeper is still the scheduler:

- **Every PRD takes several manual steps:** a terminal for the planner, one for `pnpm prd start` or `queue`, and a look at the table to see what may run beside what. `pnpm prd queue` holds a terminal per topic and knows only the cap of three, not dependencies or hot files.
- **Planning is serial on the keeper.** A dozen topics wait for a PRD; nothing plans one until the keeper opens a planner, though they accept nearly every recommendation.
- **A session that dies stays dead** until the keeper notices and runs `pnpm prd open`.
- **The fix topics have no rules.** Nothing says whether a fixes wave takes a slot, and nothing stops one colliding with a running PRD's files.
- **The machine is overloaded.** Load reached 46 on 10 cores with three PRDs running, and tests time out under it. Only browser checks wait on load.
- **Unattended landings hit a wall.** When the last check is stale, the only way through is `--force`, which agents are blocked from.

## Solution

- **`pnpm prd dispatch`**, started once and left in a tab. Every minute it reads the registry, the worktrees, the session records, the asks and the load, and does at most one thing: start the first planned topic that may run, open a planner for the first topic that needs a PRD, reopen a managed session that died, or nothing. It prints why. `--dry-run` shows what it would do.
- **Unattended planners.** A planner the dispatcher opens files its questions and its report (the assumed decisions) in the asks queue, lands its plan and ends.
- **Rules for the fix topics** in the same pick.
- **A load gate:** checks and slice starts wait a bounded time when the machine is busy, and the dispatcher starts nothing new until it isn't.
- **`pnpm prd land --recheck`:** one command that rechecks a stale tip and lands.
- **`queue`, recovery and status know the dispatcher:** `queue` moves a topic to the front; `recover` brings the dispatcher back; `status` shows its state.

## User Stories

1. As the dev keeper, I want one command, run once, to keep planners and orchestrators running, so that I don't start each one by hand (B-392).
2. As the dev keeper, I want topics started in the registry's row order, so that the table is the one place I set priority.
3. As the dev keeper, I want the dispatcher never to run a topic before the topics it comes after are done, beside a topic that shares a hot file, or beside an `alone` topic, so that runs don't collide.
4. As the dev keeper, I want it to print what it did and why it passed each topic over (no slot, waits for a topic, a shared hot file, an open question, opened by hand, the machine is busy), so that I can trust it.
5. As the dev keeper, I want `pnpm prd dispatch --dry-run` to show the next action and every reason, so that I can check before I leave it running.
6. As the dev keeper, I want `--pause`, `--resume` and `--stop`, and the `hold` flag on a row, so that I have brakes.
7. As the dev keeper, I want a topic with waiting items and no plan to get a planner by itself, one at a time, so that planning doesn't wait on me.
8. As the dev keeper, I want an unattended planner's real questions in the asks queue and on my phone, and its assumed decisions as a report there, so that I can answer and veto from one place.
9. As the dev keeper, I want a newly planned topic to start without waiting for me, so that a run never stalls on my reading (B-439).
10. As the dev keeper, I want a managed session that died reopened, and after two tries a question instead of a third, so that a crash loop doesn't burn the machine.
11. As the dev keeper, I want a session that is being rotated never reopened as dead, so that a rotation doesn't leave two sessions.
12. As the dev keeper, I want a session I opened by hand left alone but counted, so that the dispatcher never fights me.
13. As the dev keeper, I want one fixes topic at a time, in a normal slot, started only when it has enough waiting or the slot would sit idle, so that small fixes land without crowding the PRDs (B-428).
14. As a fixes orchestrator, I want to record my wave's hot files and skip a fix that collides with a running topic, so that two branches don't change the same file (B-428).
15. As the dev keeper, I want `standing` and `hold` to mean two different things, said once in the docs, so that a report never calls a fixes topic "on hold" when it isn't (B-428).
16. As a loop or an orchestrator, I want a check or a slice start to wait a few minutes when the machine is busy, so that tests don't time out under load (B-426).
17. As the dev keeper, I want the dispatcher to start nothing new while the machine is busy, so that the load comes down (B-426).
18. As a run-through orchestrator, I want one landing command that rechecks a stale tip and lands, so that I never need `--force` (B-427).
19. As a planner, I want my prompt and handbook to land a plan branch without `--force`, so that the permission classifier doesn't stop me (B-427).
20. As the dev keeper, I want `pnpm prd queue <topic>` to move a topic to the front and return, so that no terminal waits per topic.
21. As the dev keeper, I want `pnpm prd down` and `recover` to stop and bring back the dispatcher, so that a restart needs one command.
22. As the dev keeper, I want `pnpm prd status` to show the dispatcher (running, paused, stopped, its last line) and which sessions it manages, so that one screen says what is going on.
23. As the backlog session, I want to offer reordering and holding instead of printing start commands when the dispatcher runs, so that I don't tell the user to do its job.
24. As the dev keeper, I want leftovers tidied every few hours without a session of its own, so that they don't pile up.

## Implementation Decisions

**The pick (a pure module)**

- One function takes the facts and returns one action with its reasons: the registry rows with their worked-out state and waiting count, the worktrees (`prd/` and `plan/`), the session records with liveness and `managed`, the open asks, the reopen counts, whether the machine is busy, whether the dispatcher is paused, the caps and the time. Actions: `start`, `plan`, `reopen`, `ask`, `none`. Every topic passed over gets one line a person can read.
- Rules, in order:
  1. Paused: nothing.
  2. A `prd/` or `plan/` worktree whose record is `managed` with no live session, and not marked `rotating` within the last five minutes: `reopen`. After two reopens of that worktree: an `ask` ("reopen again" or "hold the topic"), and the topic is skipped while that ask is open. An unmanaged worktree is only reported.
  3. Busy: no start and no plan (reopens still happen).
  4. A `planned` topic may `start` when a slot is free, every `After` topic is `done`, no running topic shares a hot-file prefix with it, no `alone` topic is running (and nothing else runs when it is the `alone` one), and it has no open question.
  5. A fixes topic (`standing`) may start under rule 4 when also no other fixes topic is running, and it has at least three waiting items, or fewer when no other topic may start this tick.
  6. A `to-write` topic with waiting items may be `plan`ned when every `After` topic is `done`, and no planner worktree exists other than one whose topic has an open question (at most two planners).
  7. Starts come before plans; within each, row order. `hold` and `done` rows are never picked.
- Hot-file collision: two topics collide when a prefix of one starts with a prefix of the other, as plain text. A running topic with no hot files collides with nothing.

**Unattended sessions**

- The session record gains `managed` (set by the wrapper's `--managed`); the opener and rotation carry it over as they carry `auto`.
- `prompt.sh plan <topic> --auto`: the one round of questions goes through `pnpm prd ask` (one ask per question, a PushNotification after each, `--wait` in the background while it explores, no timeout, never its own recommendation instead of an answer); after landing it files a report with the _Decisions_ table's assumed rows and how to veto, then `pnpm prd rm plan-<topic>` and `pnpm prd end`.
- Both planner prompts and the handbook land with plain `pnpm prd land plan/<topic> -m …` (no `--force`), and tell the planner to set the row when it already exists rather than add it.
- **The fixes rules in the prompts and `plans/fixes-rules.md`:** a fixes orchestrator, after appending a wave's slices, sets its row's hot files to the path prefixes those slices will touch, and leaves for a later wave any fix that collides with a running topic's hot files (`pnpm backlog prd list`). Removing a `standing` topic's worktree clears its hot files.
- The docs say once (backlog handbook) that `standing` and `hold` are separate, and a `standing` row is never described as on hold unless it carries the flag.

**The load gate**

- A pure function: busy when the 5-minute load is above `CARETOOK_LOAD_BUSY` (default: twice the core count). `CARETOOK_LOAD_GATE=off` disables it.
- A check lease and a slice worktree's creation wait while busy, polling, for at most `CARETOOK_LOAD_WAIT` (600 s), then proceed and print that they gave up waiting. The check-times log records the wait.
- `pnpm prd status` prints the load against the threshold. The dispatcher passes "busy" to the pick. A PRD started by hand (`pnpm prd start`) only warns.

**Landing with a stale check**

- `pnpm prd land <topic|hotfix/name> --recheck "<why>"`: when the check gate would refuse the tip, land runs the check the gate's plan asks for (quick, or full where the plan says full) on the tip by running `pnpm prd check` in the branch's worktree (so in a check lease, timed like any check), and carries on only on a pass. A hotfix branch with no worktree is refused with that reason. When the gate already accepts the tip it changes nothing. Every other refusal stands (not synced, the PR's head, Codex's verdict, the doc budget). The reason is printed and goes into the landing report.
- Land's refusal message names `--recheck`, not `--force`. `--force` stays, on the user's word only. The orchestrator handbook and the run-through prompt use `--recheck`.

**The dispatcher**

- `pnpm prd dispatch [--every 60] [--once] [--dry-run] [--pause|--resume|--stop]`. One instance (a pid lock in `.loops/`). State (paused and why, reopen counts, the last tidy) in `.loops/.dispatch.json`; a log in `.loops/.dispatch.log`.
- Each tick: gather the facts, call the pick, act, log the action and the reasons.
  - `plan`: make the plan worktree, then open a managed, run-through planner session in a background tab. It passes no item ids: the prompt reads the topic's items from the backlog, so a reopened planner loses nothing.
  - `start`: make the PRD worktree, then open a managed, run-through orchestrator session in a background tab.
  - `reopen`: the opener, in the background, and count it.
  - `ask`: file the question; act on its answer in a later tick (reset the count, or set the row's `hold`).
- **Its own asks reach the phone** through a one-shot helper session (haiku, Remote Control) whose whole prompt is "send this PushNotification, then end". If `claude` can't start, the macOS notification and the notify hook are all there is.
- **A usage limit** isn't detected (`self-recovery`): the user runs `--pause`, and `--resume` when it lifts.
- Every six hours, on a tick with no other action: `pnpm prd tidy --yes`.
- Without iTerm2 it refuses to run (it can't open sessions); `--dry-run` and `--once --dry-run` work anywhere.

**Queue, recovery, status, the backlog session**

- `pnpm prd queue <topic>`: moves the row first and prints one line (the dispatcher will take it, or it isn't running: start it or use `pnpm prd start`). The waiting loop, `--manual`, the queue tickets and the start lock go, from the queue script, the inventory, recovery and tidy. `pnpm backlog prd migrate` goes.
- `pnpm prd down` records whether the dispatcher ran and stops it; `pnpm prd recover` clears its lock when the pid is gone and reopens it in a tab when it was running; the recovery agent leaves managed sessions to it then.
- `pnpm prd status`: the dispatcher's state and last log line; each session marked managed or by hand.
- The backlog session's prompt: when the dispatcher runs, "decide what to run next" is `pnpm backlog prd move` and `flags=hold`, and it prints no start commands.

## Testing Decisions

- A good test checks what the tooling decides or does, through its command or its pure module, not how it is written.
- **Pure modules get unit tests** (prior art: `registry.test.mjs`, `inventory.test.mjs`, `tidy.test.mjs`): the pick (one test per rule and per ordering, the reasons) and the load gate.
- **Scripts get tooling tests with a stub `claude`, a temporary `.loops` and a clock file** (prior art: `recover.test.mjs`, `rotate.test.mjs`, `land.test.mjs`, `prompt.test.mjs`): one dispatcher tick per action; the lock; pause and resume; `land --recheck`; `queue`; the prompts' wording.
- All of it runs in `pnpm test:tooling`. No app code, no stack, no browser checks.
- Three things only the real machine can show, and the orchestrator does (the plan, _Trying it_): `pnpm prd dispatch --dry-run` against the live registry; one real planner and one real start opened in background tabs; a push from the one-shot helper reaching the phone.

## Out of Scope

- **Shipping `dev` to staging, Codex findings filed by tool, a staging to-test report** (B-404, B-430, B-436): `staging-ship`.
- **Stuck workers and run metrics** (B-408, B-434): `worker-watch`. The dispatcher only handles dead sessions, not live ones that have stalled.
- **launchd, a signal before a usage limit, step-in-progress markers, cost records, records for backlog, hotfix and recovery sessions, headless sessions** (B-407, B-433, B-437, B-438): `self-recovery`. Here the dispatcher does nothing about a usage limit: the user pauses it.
- **The "Next up" inbox list, the inbox agent, duplicate checks and automatic archiving, asks expiry and archive** (B-406, B-425, B-435, B-429): `inbox-agent`.
- **A push service.** `CARETOOK_ASK_NOTIFY` stays the socket for one.
- **A manager agent** that chooses what to run. The pick is a function.

## Follow-on topics

Each has a row after this one, in this order (the user reorders with `pnpm backlog prd move`); each needs its own PRD.

- **`staging-ship`** (B-404, B-430, B-436): one command to ship `dev` to staging; Codex findings become backlog items by tool, shared between the staging PR and PRD PRs; a to-test report for the ship. Doesn't need the dispatcher.
- **`worker-watch`** (B-408, B-434): run metrics (slice and landing durations, flake rate, Codex findings) in one summary, then stuck workers handled against those usual times.
- **`self-recovery`** (B-407, B-433, B-437, B-438): recovery at login by launchd, draining before a usage limit, step-in-progress markers for landings, cost records, records for every kind of session, headless sessions. Likely more than six slices: its planner cuts headless sessions out if so.
- **`inbox-agent`** (B-406, B-425, B-429, B-435): priority set from a "Next up" list in the inbox, an inbox agent that writes to `origin/dev`, duplicate checks and automatic archiving, asks hygiene.

## Notes

- **The risk the user accepted:** with "everything, in row order" and no hold, the dispatcher will plan, build and land topics nobody looked at that week. Read the registry's order, and set `hold` where needed, before the first `pnpm prd dispatch`.
- **Registry rows to fix before it can run:** `orchestration-2` and `check-speed` have landed but their rows aren't flagged `done`, so everything "after" them would wait. The first orchestrator sets them (the plan, _How to run this plan_).
- **`test-health`, `code-health` and `fixes-tooling` share `scripts/loops/` with this topic.** By hand, don't run them beside it; the pick's hot-file rule does that once it exists.
- **It depends on iTerm2 tabs** to open sessions, like rotation. Headless sessions are `self-recovery`'s.
- **Unproven until tried:** that a one-shot helper session's PushNotification reaches the phone. If it doesn't, the dispatcher's own asks rely on the notify hook until `inbox-agent` (B-429).
