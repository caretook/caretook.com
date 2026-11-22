# PRD: Run metrics and stuck workers (worker-watch)

Backlog items B-434 (run metrics in one summary command) and B-408 (stuck workers handled by the orchestrator). Tooling only: no app code, migration or dependency.

## Decisions

| Decision                                                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                                | Source                            | Cost to change later                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| A stuck orchestrator is caught by the dispatcher's tick, which files a question that never defaults ("rotate it now" or "leave it"); it rotates only on an answer                                                                                                                                                                                                          | An orchestrator can't watch itself (B-408's open point). A restart burns usage, and the dispatcher's reopen question already waits for that reason | assumed                           | medium: the question could default later |
| Restart once means: mark it, stop the slice agent, confirm it stopped, then spawn a `--continue` agent in the same worktree. The worktree is never reset, cleaned or removed. If the stop can't be confirmed, it goes to the skeptic                                                                                                                                       | B-408's "once"; uncommitted work stays on disk, and two agents never share a worktree                                                              | item B-408; the mechanism assumed | medium                                   |
| Only a silent agent is restarted. An agent still making tool calls without progress, a second stall, uncommitted changes, a changed migration or a running landing step goes to a fresh skeptic, which picks restart, leave or ask. Only "ask", or a step on the never list, reaches the user                                                                              | B-408's judgement call; a long debugging session is not a hang                                                                                     | item B-408; the split assumed     | low                                      |
| Comes after `test-gates`, `agent-autonomy-2` and `agent-autonomy-3`                                                                                                                                                                                                                                                                                                        | It builds on their check limit, tool-call hook and skeptic record, and shares their hot files                                                      | assumed                           | low: one registry row                    |
| Activity is a tool-call heartbeat from the `agent-autonomy-2` hook, with each call's start and end; progress is a commit or a change to a tracked or unignored file. If the hook can't identify a slice agent, the watch falls back to commits and files, shows the agent as unknown and never restarts it                                                                 | Slice agents have no process of their own. A hook is a supported signal; transcript paths are not. Caches and logs are not progress                | assumed                           | medium                                   |
| Thresholds: quiet 20 minutes, restart 10 minutes after an unanswered nudge, no progress 45 minutes, a stuck orchestrator 30 minutes. Each is a setting                                                                                                                                                                                                                     | B-408 left them open; a running command never counts as quiet                                                                                      | assumed                           | low: settings                            |
| A check's budget is the larger of twice the median and the slowest passing run plus 20%, over the last 20 passing runs of its mode and branch kind, scaled up for load, between 10 minutes and test-gates' hard limit. With under five samples the hard limit applies. The silence limit is a setting whose default comes from the longest silent stretch slice 2 measures | B-408's "budget from its usual time". Passing quick checks have run from 3 to 28 minutes, so twice the median alone would stop healthy ones        | assumed                           | low: settings                            |
| Only `pnpm prd check` gains a budget. Status shows every lease holder and `pnpm prd` command with its age, so the others are visible. Browser checks keep their limits, review waits and leases are bounded, and a landing is never killed                                                                                                                                 | Killing a landing or a sync mid-merge is worse than waiting                                                                                        | assumed                           | low                                      |
| Metrics start from a new append-only run log. Check and browser-flake history is read from its existing logs; slice, landing and Codex numbers start empty                                                                                                                                                                                                                 | Reconstructing old runs from git would be guesswork                                                                                                | assumed                           | low                                      |
| Being past the usual time alone never restarts a worker: it shows in status and gets one nudge                                                                                                                                                                                                                                                                             | A big slice is legitimately slow                                                                                                                   | assumed                           | low                                      |

Nothing was asked: no item here touches scope, permissions, user data, compliance, a dependency or product direction.

**The skeptic pass** (Fable) changed: how a running command is known; restart only for a silent agent; the budget's formula and measured silence limit; the stuck-orchestrator test; usage-limit and sleep guards in the dispatcher; handed-off slices never acted on; marks for a skeptic's verdict; all-quiet defined; confirmed stops; only tracked and unignored files as progress; status covering every command; the `stall` ask accepted by `pnpm prd ask`; the handbook edit moved to landing; the full hot-file list. Its split of the watch slice was taken, and the two metrics slices were merged to stay at six. Declined: nothing.

## Problem

Unsticking workers is manual work the user does often. Browser checks have limits, but a hung `pnpm prd check`, a slice agent gone quiet and a stalled orchestrator are noticed only when someone looks. The dispatcher handles dead sessions, not live stuck ones.

Nor is there a usual time to judge against. Only check times are recorded, so nobody can see how long slices and landings take, how flaky the checks are, or how often Codex finds something.

## Solution

`pnpm prd metrics` shows slice and landing durations, check times, flake rate and Codex's find rate in one summary. Those usual times feed a watch: checks stop at a budget with their last output, `pnpm prd status` shows each worker's age against its usual time, and an orchestrator is woken when a slice agent stalls. It nudges the agent, restarts a silent one once, and takes anything riskier to a skeptic, then the user. The dispatcher catches a stuck orchestrator.

## User stories

1. As the user, I want one command that summarises slice and landing durations, so that I can see how runs are going. (B-434)
2. As the user, I want the flake rate in that summary, so that I know whether checks can be trusted. (B-434)
3. As the user, I want to see how often Codex finds something, so that I can judge what its review is worth. (B-434)
4. As an orchestrator, I want a check that hangs to stop at a budget based on its usual time and report its last output, so that a hang costs minutes and can be diagnosed. (B-408)
5. As the user, I want `pnpm prd status` to show each running command's and agent's age against its usual time, so that I can spot a stuck one at a glance. (B-408)
6. As an orchestrator, I want to be woken when one of my slice agents goes quiet or stops making progress, so that I don't have to poll. (B-408)
7. As an orchestrator, I want to nudge a stalled agent and then restart it once with its work intact, so that the user doesn't have to. (B-408)
8. As an orchestrator, I want a judgement call to go to a fresh skeptic first and to the user only if that doesn't settle it, so that the user sees only real questions. (B-408)
9. As the user, I want a stuck orchestrator caught by the dispatcher and put to me as a question, so that a stalled run doesn't sit unnoticed. (B-408)

## Implementation decisions

- **The run log** is one append-only JSON-lines file in the main checkout's `.loops/`. Each event has a time, kind, topic and fields of its own: slice started and ended, landing started and ended, a browser check's result, a Codex verdict. Writing is one small module, and a failed write never fails or delays the command that made it.
- **Where events come from:** creating and removing a slice worktree, `land`, the browser runner, and `review`. A Codex verdict counts once per PR and head, however often it is polled. Out-of-credits verdicts are counted apart and never as clean.
- **The metrics module** is pure: it takes the run log, the check log and the flake log and returns a summary (`--since`, `--json`). It also answers "what's the usual time for this kind of work", which the budget and the watch use. Malformed lines are counted and skipped.
- **The check budget** wraps the check inside `check-run`, using test-gates' limit and child cleanup. A breach exits non-zero with its own reason in the check log and prints the step and last 30 lines. It is not a test failure or a flake. A machine sleep during a check doesn't count against either limit.
- **The heartbeat** extends the `agent-autonomy-2` hook: each tool call records the agent, its worktree, and its start and end, so started-but-unfinished is a running command; a subagent's stop records that it stopped. A live process whose working directory is the worktree counts as a running background command. It follows that hook's rule: never block, never fail. The slice reads the current hook documentation first.
- **The watch decision** is a pure function over facts (workers, start, last activity, last progress, usual time, a command or lease under way, the plan's _Status_ state, dirty tree, risky step, marks so far) that returns each worker's state (`ok`, `slow`, `quiet`, `no-progress`, `stopped`, `unknown`) and the next action (`none`, `nudge`, `restart`, `skeptic`).
- **Never acted on:** a worker running a command or holding or queuing for a lease; a slice _Status_ marks handed off or merged; a `stopped` slice not marked handed off, which is shown only; an `unknown` agent; a slice with an open ask or a "left" mark before its recheck time. **Machine sleep:** a gap between watch readings resets the clocks. **All quiet at once:** when two or more agents of a session, or an agent and its orchestrator, go quiet in the same window (a usage limit, a network loss), one finding is raised and nothing is restarted.
- **`pnpm prd watch`** prints the decision for a topic (`--json`). `--wait` blocks until there's an action to take and exits with it, so the orchestrator runs it in the background during a wave. `--mark <slice> nudged|replied|restarted|left|asked` records what happened in a per-topic file that survives a rotation; `restarted` is marked before acting, and `left` carries a recheck time.
- **The orchestrator's steps** (prompt, folded into the handbook at landing): nudge by SendMessage and mark a reply; on `restart`, mark, stop the agent, wait for its stop record, then spawn `pnpm prd prompt slice <topic> <n> --continue`; on `skeptic`, use `agent-autonomy-3`'s brief with a new `stall` kind and the evidence (ages, last output, git state). `pnpm prd ask` accepts a `stall` verdict of "ask". The question defaults unless it is on the never list.
- **The dispatcher's part** is one more pure decision in its tick. A live, managed, run-through orchestrator is stuck when it has had no heartbeat for the limit, has no agent with a recent heartbeat, runs no command other than `watch --wait` and has no open question; or when a watch action has gone unhandled for the limit. It gets one question per stall. "Rotate it now" uses the existing mid-wave rotation and its guards; a refused rotation files one report. A session that never had a heartbeat is unknown and left alone. A tick gap resets its clocks, and several orchestrators going quiet together raise one report and no question.
- **`pnpm prd status`** adds every lease holder, `pnpm prd` command under a session and slice agent, with age, usual time and state.

### Docs at landing

[machinery](../docs/agents/machinery.md): the run log, `metrics`, the budget, the heartbeat, `watch`, the dispatcher's part. [orchestrator](../docs/agents/orchestrator.md): the steps for a stalled agent; it is at its byte budget, so trim at least what is folded in. [orchestration](../docs/orchestration.md): the two commands.

## Testing decisions

- Tooling unit tests beside the code, with temporary directories, stub binaries and fictional fixtures. Prior art: `check-times`, `check-run`, `dispatch-pick`, `status-extra` and `prompt` tests.
- Pure modules alone: the metrics summary, the budget, the watch decision, the dispatcher's stuck decision.
- As commands: a stub check that hangs, a hook given fixture input, `watch --wait` exiting on a fixture stall.
- No app code changes, so no component, integration or browser checks. Each landing runs `pnpm test:tooling` and `pnpm exec eslint scripts`.

## Out of scope

- Budgets for commands other than `pnpm prd check` (slice creation, `serve`, `sync`): status shows their age.
- Helper subagents an orchestrator or loop spawns for a small task.
- A usage-limit signal, cost records and headless sessions (`self-recovery`).
- Charts or a dashboard for the metrics.
- Stalls in planner, backlog and hotfix sessions.

## Notes

- **test-gates' limit:** its slice 1 stops a slice or quick check at 20 minutes. Past passing quick checks ran up to 28 minutes under load, so that limit, which this budget can't exceed, may stop a healthy check until its speedups land. It is overridable.
- **Other topics in the same files:** `test-gates`, `agent-autonomy`, `agent-autonomy-2`, `agent-autonomy-3`, `self-recovery`, `staging-ship`, `fixes-tooling`. The registry's hot files keep them apart.
