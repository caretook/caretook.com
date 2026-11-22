# PRD: Agent autonomy

Backlog items B-503 (default on silence), B-504 (quiet-machine landing check), B-505 (the flake rule replaces asking), B-506 (shared notice board). The context watch (B-507, B-508, B-509), filed into this topic while it was planned, is the follow-on topic [`agent-autonomy-2`](agent-autonomy-2-prd.md). Topic `agent-autonomy`. Tooling only: `scripts/loops/`, its tests, the agent docs.

## Decisions

| Decision                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                             | Source                          | Cost to change later                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A full check whose only failures are test files that each pass alone 3/3, and then pass together once, counts as a full pass at the landing gate, with no question and no `--force`                                                                                    | B-505's words; it replaces the overnight ask (a33)                                                                                                                                                              | item B-505                      | medium: flaky code may already be in `dev`; the rule itself is one setting (`CARETOOK_FLAKE_RULE=off`) |
| The flake rule gives up, as a real failure, when more than 8 test files fail in one check, when the failure isn't a test (format, lint, typecheck, build budget, docs budget), when the test run left no result, or when it failed and named no failing file           | Many failures at once, or a crash, are a broken branch, not load                                                                                                                                                | assumed                         | low: one setting                                                                                       |
| The flake rule has no exception for a test the branch itself added or changed                                                                                                                                                                                          | The item names none; such a test still has to pass alone 3/3 and together once, and is filed like any other                                                                                                     | assumed                         | low: one condition                                                                                     |
| A question defaults only when its asker says it may (`--defaults`); a question with a recommendation must say `--defaults` or `--waits`, and one filed with neither is refused with a line that teaches the rule                                                       | A forgotten flag must never let a destructive step default; refusing makes the asker choose                                                                                                                     | assumed                         | low: one check in the ask command                                                                      |
| Never defaulted (`--waits`): money (a paid service too), data loss or a change to existing data, a live deploy (staging or production), a destructive step (deleting unmerged work, a forced push or landing), and compliance                                          | The item's four, plus compliance, which AGENTS.md treats as the user's alone                                                                                                                                    | item B-503; compliance assumed  | low: one prompt line                                                                                   |
| A planner's questions always wait. **This narrows B-503**, which says any question with a recommendation defaults: a planner the dispatcher started can still wait overnight (only that topic waits; a second planner may run meanwhile)                               | The handbook only lets a planner ask what is costly to undo or the user's alone, and the user's rule of 2026-11-21 is to wait for those however long it takes; the overnight stalls were orchestrator questions | assumed                         | low: one prompt line                                                                                   |
| The dispatcher's own "reopen again or hold the topic" question waits                                                                                                                                                                                                   | A session that died three times burns usage each reopen: money                                                                                                                                                  | assumed                         | low                                                                                                    |
| The wait is 30 minutes for every defaulting question, one setting (`CARETOOK_ASK_DEFAULT_MIN`), day and night                                                                                                                                                          | "about 30 min"; the stall to fix was overnight                                                                                                                                                                  | item B-503                      | low                                                                                                    |
| A defaulted question stays listed for the user ("decided for you") until dismissed, and can't be answered afterwards. Only a waiting session or the dispatcher applies a default; reading the list never does, so a due question nobody waits on can still be answered | The session has already acted; the user reads it and tells a session if they disagree                                                                                                                           | assumed                         | low                                                                                                    |
| The machine claim is taken by every full check in a `prd/` or `hotfix/` worktree, and by nothing else; the flake rule runs for the same checks                                                                                                                         | "A landing's full check": wave gates and hand-offs are quick, and the one full check per landing runs there                                                                                                     | assumed                         | low: one condition                                                                                     |
| While the claim is held: other `pnpm prd check` runs, browser checks and new slice worktrees wait; the dispatcher starts and plans nothing. Work already running is left alone                                                                                         | B-504's words; stopping running agents would lose work                                                                                                                                                          | item B-504                      | low                                                                                                    |
| A waiting check or browser check stops waiting after 45 minutes of its own waiting (`CARETOOK_QUIET_MAX`), a slice start after 10; the claimer waits at most 10 minutes for the machine to go quiet (`CARETOOK_QUIET_SETTLE`), then runs anyway and says so            | A full check averages 14 minutes; a stuck landing, or a queue of them, must not hold the machine                                                                                                                | assumed                         | low: settings                                                                                          |
| Waiting landings take turns in arrival order                                                                                                                                                                                                                           | "take turns"                                                                                                                                                                                                    | item B-504                      | low                                                                                                    |
| Flaky tests are filed by the check itself as `fixes-tooling` bugs; a test file that already has an open item gets a note on it                                                                                                                                         | B-505's words; a33 filed 20 near-identical items by hand                                                                                                                                                        | item B-505; the note is assumed | low                                                                                                    |
| The notice board is one-way and advisory: tools print other sessions' live notices before each gated command; nothing blocks on a notice                                                                                                                               | "no waiting on replies"; blocking is the claim's and the leases' job                                                                                                                                            | item B-506                      | low                                                                                                    |
| A notice lives 60 minutes unless given a life, 24 hours at most                                                                                                                                                                                                        | "entries expire"                                                                                                                                                                                                | assumed                         | low                                                                                                    |
| A code landing posts its own "landed, sync at your next wave boundary" notice                                                                                                                                                                                          | It replaces the SendMessage round at landing step 7                                                                                                                                                             | assumed                         | low                                                                                                    |

Nothing was asked: the items state the rules, and every remaining choice is a setting or a prompt line.

**The skeptic pass:** see _Notes_.

## Problem

The user starts a dispatcher and leaves. Overnight on 2026-11-22 two run-through orchestrators stopped for hours:

- test-health asked whether to land on passes it already had (a31) and waited six hours for the answer it had recommended.
- fixes-bug and ui-kit-2 ran full checks at the same time on ten cores (load over 20), failed each other on load flakes seven times, and then asked (a33). Every failing test passed alone.

Agents also can't tell each other "I'm landing, hold your full check" or "I'm changing this hot file" without a message and a reply.

## Solution

The user comes back to landed work and a short list of what was decided without them.

- A routine question takes its recommended answer after 30 minutes of silence. The list of asks shows what was decided that way. Questions about money, data, a live deploy, a destructive step or compliance still wait.
- A landing's full check gets the machine to itself: other checks and new slices wait their turn, for a bounded time.
- A full check that fails only on tests that pass alone lands anyway, and each flaky test is filed as a bug.
- Sessions leave short, expiring heads-ups on a shared board that the tools print for everyone.

## User stories

1. As the user, I want a routine question to take its recommended answer after about 30 minutes without me, so that a run doesn't stall overnight on an answer I would have given. (B-503)
2. As the user, I want every defaulted question listed with what was chosen and when, so that I can see what was decided without me. (B-503)
3. As the user, I want questions about money, data loss, a live deploy, a destructive step or compliance to wait for me however long it takes, so that nothing costly happens by default. (B-503)
4. As the user, I want the push for a defaulting question to say when it will default and to what, so that I know how long I have. (B-503)
5. As an orchestrator, I want `pnpm prd ask --wait` to return the default like any answer, so that I carry on the same way. (B-503)
6. As a planner, I want my questions to keep waiting, so that a PRD is never built on a guess the user had to make. (B-503)
7. As an orchestrator, I want my landing's full check to run on a quiet machine, so that it doesn't fail on load. (B-504)
8. As an orchestrator, I want other sessions' checks, browser checks and slice starts to wait while a landing check runs, and to stop waiting after a time limit, so that one stuck landing doesn't hold everyone. (B-504)
9. As an orchestrator, I want waiting landings to go in arrival order, so that none starves. (B-504)
10. As the user, I want `pnpm prd status` to show who holds the machine and until when. (B-504)
11. As an orchestrator, I want a full check that fails only on flaky tests to rerun them and pass, so that I land without asking or forcing. (B-505)
12. As the user, I want each flaky test filed as a `fixes-tooling` bug, once, with later sightings as notes, so that flakes get fixed and the backlog isn't flooded. (B-505)
13. As the user, I want the landing report to name the flaky tests a landing passed over. (B-505)
14. As an orchestrator, I want to post a short heads-up that expires, and to see other sessions' heads-ups before each step without asking for them. (B-506)
15. As an orchestrator, I want a landing to tell the others to sync by itself. (B-506)

## Implementation decisions

### Asks that default (stories 1 to 6)

- **The ask record** gains: whether it may default, when it would (`askedAt` plus the wait at filing), and, once settled that way, that it was defaulted. A defaulted ask has an answer (the recommendation) and an answer time like any other.
- **Filing:** `pnpm prd ask --question … --recommend <a>` takes `--defaults` or `--waits`. With a recommendation and neither flag it files nothing and exits non-zero, naming the two flags and the never-default classes. `--defaults` without a recommendation is refused. A question with no recommendation waits. A report is unchanged.
- **Settling** is one store function, "apply this ask's default if it is due": it writes the default only when the ask is still unanswered and not dismissed. Settling and answering share one exclusive step per ask (a lock taken atomically, as creating an ask takes its id), so neither can overwrite the other and a user's answer that got there first always stands. `--wait` and the dispatcher's tick call it, so a question whose session died still settles while the dispatcher runs, and its reopened session finds the answer. Reading the list never settles: with no session waiting and no dispatcher, a due question stays open and answerable.
- **`--wait`** prints the answer as today; for a default it adds one line saying it was defaulted after the wait.
- **The filing output:** the push line a defaulting question prints ends with the time it defaults and the option it takes. A waiting question's line is unchanged.
- **Listing:** `pnpm prd asks` shows, for an open defaulting question, how long until it defaults (or that it is due); and lists defaulted questions under their own heading until dismissed (`--done`). `pnpm prd answer` on a defaulted ask is refused and says why.
- **Two predicates, not one:** "awaits an answer" (an open question, not defaulted) and "still listed" (also defaulted-and-undismissed, and reports). The dispatcher's "a topic with an open question" uses the first.
- **Prompts:** the run-through orchestrator's asking paragraph says to pass `--defaults` on every question with a recommendation except the never-default classes, which take `--waits`, and that the tool, never the agent, puts the recommendation in place of an answer. The unattended planner's line says `--waits` on every question. The dispatcher files its own question as waiting.

### The notice board (stories 14, 15)

- **A notice** is one small file in the main checkout's `.loops/`: an id, the posting session and topic, one line of text (200 characters at most), when it was posted and when it expires.
- **Commands:** `pnpm prd notice "<text>" [--for <minutes>] [--topic <t>]` prints the id; `pnpm prd notices [--json]` lists the live ones, oldest first; `pnpm prd notices --done <id>` withdraws one. Every write and list deletes expired files. Life: 60 minutes by default, 24 hours at most.
- **Shown without asking:** `pnpm prd status` prints the live notices; `check`, `sync`, `slice`, `browser`, `pr`, `ready` and `land` print other sessions' live notices first (at most five lines, to stderr, never failing the command).
- **Posted by tools:** a code landing (`prd/` or `hotfix/`, not Markdown only) posts "landed `<topic>` in dev (`<sha>`): sync at your next wave boundary", living six hours. The machine claim posts its own (below). A failure to post never fails the command.
- **When an agent posts** (the orchestrator handbook): before changing a file another running topic lists as hot ("sync first"), and for anything the leases, the claim and the load gate can't say. Never to ask a question: nothing reads replies.

### The machine claim (stories 7 to 10)

- **One claim, machine-wide**, a lease of its own kind with one slot, taken over from a dead holder like any lease. Claimers queue in arrival order: each waiter leaves a ticket, and the oldest live ticket takes the claim when it frees.
- **Who claims:** a full check (after the check plan has decided the mode) in a `prd/` or `hotfix/` worktree. `CARETOOK_QUIET=off` turns the claim and the waits off, as does `CARETOOK_LEASES=off`.
- **The claimer**, holding the claim, waits until no other check or browser lease is held and the 1-minute load is at or under the core count (`CARETOOK_QUIET_LOAD`), for at most `CARETOOK_QUIET_SETTLE` (600 s), then runs and says whether the machine was quiet. This replaces the load gate's wait for that check. It posts a notice for the claim's life: "`<session>`: landing check until `<time>`: checks, browser checks and slice starts wait".
- **Everyone else:** `pnpm prd check` (before taking a check lease), a browser check (before its browser lease) and a slice worktree's creation wait while another worktree holds the claim or queues for it, until none does or the waiter itself has waited `CARETOOK_QUIET_MAX` (2700 s; a slice's creation at most the load gate's `CARETOOK_LOAD_WAIT`, 600 s, since orchestrators run it in the foreground), then go ahead and say which. The bound is the waiter's own time, so a queue of landings can't hold it longer. A queued claimer also waits before taking its check lease, so the holder's wait for quiet never waits on it. The dispatcher's facts gain "claimed", which stops starts and plans like "busy" with its own reason. Running agents, quick edits and single test files run by hand are not held.
- **The check-times log** gains two fields at the end: the seconds waited for the claim or for quiet, and whether the check ran quiet. `pnpm prd status` prints the holder, its age and the queue.

### The flake rule (stories 11 to 13)

- **The full check's test step leaves a machine-readable result** (Vitest's JSON reporter beside the usual output; no new dependency): the test files that failed and the failing test names. A test keeps the full check's steps the same as `pnpm check`'s.
- **The rule** is a pure decision over that result: "real" when a non-test step failed, when there is no result, when the test step failed with no failed file named (a crash, an unhandled error, a teardown timeout), when more than `CARETOOK_FLAKE_MAX` (8) files failed; else "retry these files". It runs for every full check in a `prd/` or `hotfix/` worktree, whether or not the check got the claim; `CARETOOK_FLAKE_RULE=off` disables it. A failed check's last lines always say whether the rule ran and what it decided, or why it didn't run.
- **The retry** first waits for quiet again (the claimer's test, at most `CARETOOK_QUIET_SETTLE`; no wait with `CARETOOK_QUIET=off`) and says whether it got it, so a check that started loaded still retries on the quietest machine it can get. Then each failed file alone, three times, in its own project; any failure makes the check fail as today, naming the file. Then the failed files together, once. All passing, the remaining steps of the check run (the build budget, the tooling tests), and the tip is recorded as a full pass that names its flaky files. The tooling tests' failures follow the same rule.
- **The gate** (`pnpm prd land`, `ready`) accepts that record as full and says "full, N flaky test files rerun". The landing report lists them under what wasn't checked.
- **The flake ledger:** one line per flaky file per check in the main checkout's `.loops/` (time, branch, commit, file, failing test names, load).
- **Filing:** after a flaky pass the check files each ledger line not yet filed: when an open item (not landed or dropped) in `fixes-tooling` names the test file, a note on it ("seen again `<date>` on `<branch>`, load `<n>`"); else a new bug, "Flaky under load: `<file>` '`<test>`' fails in a full check; passes alone 3/3", `prd=fixes-tooling`, triaged. Filing goes through `pnpm backlog` and never fails the check; `pnpm prd flakes` lists the ledger and `pnpm prd flakes --file` files what's left.
- **The rules that change:** the orchestrator handbook's "never `--force` unless the user says so" stays; the flake rule needs no force. A check the rule called real goes back to the loop that caused it, as today, with the rule's last lines: a file that failed alone is a broken test; files that pass alone and fail together are an order or shared-state bug. Asking about flakes stops. The one question left: the same tip failing for real twice with nothing a loop can fix is asked as any real failure is.

### Docs at landing

[machinery](../docs/agents/machinery.md): the asks queue's defaults, the notice board, the machine claim. [orchestrator](../docs/agents/orchestrator.md): which questions default, the flake rule in _Landing a wave_ and _The check gate_, the notice at step 7, the capacity paragraph. [planner](../docs/agents/planner.md): a planner's questions wait (`--waits`). [orchestration](../docs/orchestration.md): the new commands. [preferences](../docs/agents/preferences.md): the default-on-silence rule and its never list. Trim at least what is folded in (the byte budgets).

## Testing decisions

- Everything is tooling, tested as unit tests in the tooling project beside the code, against temporary directories, a stand-in load file and stub binaries; never the real asks queue, leases, backlog or `origin`. Prior art: the asks store and command tests, the lease tests, the load-gate tests, the check-run and check-gate tests, the dispatcher pick tests, the landing tests.
- Pure parts tested alone: the default's due time and settling, the notice store, the claim queue's order, the dispatcher pick with "claimed", the flake decision, the match of a flaky file to an open item.
- Commands tested through their command line with a fake clock or short settings: an ask that defaults under `--wait`; a check that waits for a claim and one that gives up at the limit; a full check with a stub test step that fails then passes alone.
- Prompt tests cover the changed prompt lines.
- No app code changes, so no component, integration or browser checks. The gate needs none; each landing runs `pnpm test:tooling` and `pnpm exec eslint scripts`.

## Out of scope

- The backlog session as go-between for questions, and asks hygiene (stale reports, archiving answered asks): `asks-relay` (B-467, B-429).
- Fixing the flaky tests themselves: `fixes-tooling`, one item each.
- Browser-check (Playwright) flakes: they already retry once and log.
- Stuck workers and run metrics (`worker-watch`), recovery (`self-recovery`).
- Changing how many check or browser leases there are, or the load gate's threshold.
- Defaulting a planner's questions.
- The context watch: `agent-autonomy-2` (B-507, B-508, B-509).

## Notes

- **Other topics in the same files:** `test-health` (running, lists all of `scripts/loops/`), `inbox-agent`, `code-health`, `fixes-tooling`, and the held `asks-relay`, `staging-ship`, `worker-watch`, `self-recovery`. The dispatcher won't run this beside a topic whose hot files collide; sync at each wave boundary.
- **`inbox-agent` slice 2** makes `pnpm backlog add` stop on a look-alike unless `--anyway`. The flake filing does its own match first; whichever lands second passes `--anyway` there.
- **Sessions started before a landing** carry old prompts: an old orchestrator's ask with a recommendation and neither flag is refused with the teaching line, and it refiles.
- **The skeptic pass** changed:
  - Cut the context watch (B-507 to B-509) into `agent-autonomy-2`, and split the claim and the flake rule into two slices each: nine slices became six here and two there.
  - Settling and answering an ask share a lock; reading the list no longer applies a default.
  - A test step that fails with no failing file named is a real failure, not an empty retry that passes.
  - The flake rule no longer depends on holding the claim; a failed check says whether the rule ran; the retry waits for quiet itself.
  - A waiter's bound is its own waiting time, a slice start waits at most ten minutes, and a queued claimer waits before taking a check lease.
  - The planner row says plainly that it narrows B-503.
  - In `agent-autonomy-2`: the dispatcher rotates a session only after its nudge was delivered and while it runs no `pnpm prd` command; its context question has its own marker, apart from the reopen question; status says which sessions have no size.
  - Declined: nothing.
