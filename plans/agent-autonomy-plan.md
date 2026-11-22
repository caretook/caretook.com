# Plan: Agent autonomy

> Source PRD: [`plans/agent-autonomy-prd.md`](agent-autonomy-prd.md). User-story numbers (US) refer to it. Backlog items B-503 (default on silence), B-504 (quiet-machine landing check), B-505 (the flake rule), B-506 (shared notice board), B-507 (a context hook), B-508 (context size in status, the dispatcher's nudge), B-509 (the rule: rotate past 160k). Topic `agent-autonomy`.

## Status

| Slice | Wave | State | Merge into `prd/agent-autonomy` (slice commits) |
| ----- | ---- | ----- | ----------------------------------------------- |
| 1     | 1    | —     | —                                               |
| 2     | 1    | —     | —                                               |
| 3     | 2    | —     | —                                               |
| 4     | 3    | —     | —                                               |
| 5     | 4    | —     | —                                               |
| 6     | 1    | —     | —                                               |
| 7     | 2    | —     | —                                               |

**Backlog:** claim B-503 when slice 1 starts and `done` it when slice 1 merges; B-506 with slice 2; B-504 with slice 3; B-505 when slice 4 starts, `done` when slice 5 merges; B-507 and B-509 with slice 6; B-508 when slice 6 starts, `done` when slice 7 merges.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (the asks' defaults, the notice board), [orchestrator](../docs/agents/orchestrator.md) (which questions default; the landing notice replaces the SendMessage round at step 7; when to post a notice), [planner](../docs/agents/planner.md) (`--waits`), [preferences](../docs/agents/preferences.md) (the default-on-silence rule and its never list); wave 1 also, machinery and orchestrator (the context hook, the size record, `pnpm prd context`, the rotation rule: reword the 160k line already on `dev`) and [loop](../docs/agents/loop.md) (the loop's reminder); wave 2, machinery (the machine claim, the dispatcher's context follow-up) and orchestrator (_Capacity_); wave 3, orchestrator (_Landing a wave_, _The check gate_: the flake rule) and machinery (the ledger); wave 4, orchestrator and [backlog](../docs/agents/backlog.md) (flakes filed by the check); every wave, [orchestration](../docs/orchestration.md) for new commands. Trim at least what you fold in.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, its tests, prompts. No app code, no migration, no dependency.
- **Machine state lives in the main checkout's `.loops/`**, untracked, one small file or lock directory per thing (asks, notices, the claim and its tickets, the flake ledger), written atomically; nothing is written inside a worktree. Each store takes its directory from the caller or a `CARETOOK_…` variable, so tests use temporary directories.
- **Pure decision, thin command:** the default's settling, the notice store, the claim queue's order, the flake decision and the item match are functions tested alone; the shell and command-line parts only gather facts and act.
- **A user's answer always wins** over a default: settling rereads and writes only an unanswered, undismissed ask.
- **Nothing new can fail a command it decorates:** printing notices, posting one, filing a flake or reading the claim never changes another command's exit code.
- **Every wait is bounded** and says what it waited for and why it stopped; every new behaviour has an off switch (`CARETOOK_QUIET=off`, `CARETOOK_FLAKE_RULE=off`; `CARETOOK_LEASES=off` turns the claim off too).
- **The check record stays readable by older readers:** a flaky pass is still a `full` record; the flaky files ride beside it.
- **Tests never touch** the real asks queue, leases, backlog, check log or `origin`.

## How to run this plan

- **Waves:** 1: slices 1, 2 and 6 (6 owns the session wrapper, the new hook and size record, and one paragraph of the orchestrator prompt, a different one from slice 1's; 1 owns the asks store and command, the dispatcher's use of them and the prompts; 2 owns the new notice store and command, the lines `prd.sh` prints before gated commands, `status` and the landing's notice; both add commands to the front door, additive edits the orchestrator merges). 2: slices 3 and 7 (both add one fact to the dispatcher's tick, in separate decisions; additive). 3: slice 4. 4: slice 5. Each wave lands something usable alone.
- **Gate:** the diff is tooling and Markdown, so the check gate needs nothing; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **Models:** every slice is opus or stronger (locks, races, the check gate).
- **Other topics:** `test-health`, `inbox-agent`, `code-health` and `fixes-tooling` change the same directory; don't run beside them (the hot-file rule) and sync at each wave boundary.
- **Try each wave on itself:** from wave 2 this PRD's own landings are tooling only and run no full check, so the claim and the flake rule are first exercised by the next code landing of another topic. Say so in each landing report. The context hook reaches a session only when it is next started through the wrapper: this PRD's own orchestrator gets it at its first rotation after wave 1.

## Slice 1: A question that takes its recommendation after 30 minutes

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/planner.md · Tests: unit

**User stories:** US 1, 2, 3, 4, 5, 6.

**Build:** the PRD's _Asks that default_. The ask record's default fields; `--defaults` and `--waits` on filing, with the refusal when a recommended question has neither; the settling function, called by `--wait`, by `pnpm prd asks` and by the dispatcher's tick; `--wait`'s extra line; the push line's "takes `<option>` at `<time>` unless answered"; the listing's countdown and its "decided for you" part; `answer` refused on a defaulted ask; the two predicates, with the dispatcher's pick on "awaits an answer"; `CARETOOK_ASK_DEFAULT_MIN` (30). Prompts: the run-through orchestrator's asking paragraph (which flag when, the never-default classes, the tool defaults and never the agent), the unattended planner's line (`--waits` always), and the dispatcher's own question filed as waiting. `pnpm prd status`'s asks line counts questions awaiting an answer and defaulted ones apart.

**Acceptance criteria:**

- Store unit tests: a defaulting ask settles to its recommendation once due and not before; settling an answered or dismissed ask changes nothing; an answer written between the read and the write survives (the reread); a waiting ask never settles; a defaulted ask is listed until dismissed and doesn't await an answer; `--defaults` needs a recommendation.
- Command tests: a recommended question with neither flag exits non-zero, files nothing and names both flags and the never-default classes; `--wait` on a due ask prints the option, says it was defaulted and exits 0; `--wait` returns a user's answer given before the default; `asks` shows the countdown and the defaulted part, and `--json` carries the fields; `answer` on a defaulted ask is refused.
- Dispatcher tests: a topic whose only ask was defaulted is no longer skipped for an open question; a tick settles a due ask of a dead session; the reopen ask is filed as waiting.
- Prompt tests cover the three changed prompt texts.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 2: A notice board the tools print

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 14, 15.

**Build:** the PRD's _The notice board_. The notice store (create with an exclusive id, list live, withdraw, prune expired on every write and list); `pnpm prd notice`, `notices [--json]`, `notices --done`; the life (60 minutes by default, `--for`, 24 hours at most) and the 200-character line; other sessions' live notices printed to stderr, five lines at most, before `check`, `sync`, `slice`, `browser`, `pr`, `ready` and `land`; `pnpm prd status` prints them all; a code landing posts its "landed, sync at your next wave boundary" notice for six hours. This slice changes no prompt.

**Acceptance criteria:**

- Store unit tests: two creates never share an id; an expired notice isn't listed and its file is gone after the next list; a life over 24 hours is refused, and so is an empty or overlong line; withdrawing an unknown id is an error.
- Command tests: `notice` prints the id and `notices` lists it with its session, topic, age and time left; a gated command prints another session's notice and not its own, prints at most five, and exits with its own code when the notice directory is unreadable.
- Landing tests: a code landing posts the notice with the topic and commit; a Markdown-only or `plan/` landing posts none; a failure to post doesn't fail the landing.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 3.

## Slice 3: A landing's full check gets the machine

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 7, 8, 9, 10.

**Build:** the PRD's _The machine claim_. The claim (one slot, dead holders taken over) and its arrival-order queue of tickets; a full check in a `prd/` or `hotfix/` worktree takes it, waits for quiet (no other check or browser lease held, the 1-minute load at or under `CARETOOK_QUIET_LOAD`, at most `CARETOOK_QUIET_SETTLE`) in place of the load gate's wait, posts the claim's notice, runs, and releases on every exit; every other `pnpm prd check`, browser check and slice worktree creation waits while another worktree holds it, until release or `CARETOOK_QUIET_MAX` since it was taken; the dispatcher's facts gain "claimed", which stops starts and plans with its own reason; the check-times line's two new fields and the summary's reading of them; `pnpm prd status` shows the holder, its age and the queue; `CARETOOK_QUIET=off`.

**Acceptance criteria:**

- Queue unit tests: three waiters take the claim in arrival order; a dead waiter's ticket is skipped and removed; a dead holder is taken over by the oldest live waiter.
- Check tests (stub check body, a stand-in load file, short settings): a full check in a `prd/` worktree takes the claim and releases it on a pass, a failure and a kill; a quick check, and a full check in a slice worktree, take none; the claimer waits while another check lease is held and runs at the settle limit, saying the machine wasn't quiet; a second worktree's check waits for the claim and starts on release, and starts at the time limit when the holder never releases; the holder's own worktree doesn't wait on itself; the log line has the two fields.
- Slice-creation and browser-check tests: each waits on another worktree's claim and proceeds on release or at the limit.
- Dispatcher pick tests: claimed stops starts and plans, reopens still happen, and the reason reads as the claim.
- With `CARETOOK_QUIET=off` or `CARETOOK_LEASES=off` nothing is claimed and nothing waits.
- `pnpm test:tooling` passes.

**Blocked by:** 2. **Blocks:** 4.

## Slice 4: A full check that passes over flaky tests

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 11, 13.

**Build:** the PRD's _The flake rule_, up to the ledger. The full check's test step (and the tooling tests) leaves a machine-readable result; the pure decision (real, or retry these files); the retry inside the claim (each failed file alone three times, then together once), then the check's remaining steps; a flaky pass recorded as full with its flaky files beside it; the gate's line ("full, N flaky test files rerun") in `land` and `ready`; the landing report's list; the ledger line per flaky file; `pnpm prd flakes` lists the ledger; the check-times line marks a flaky pass; `CARETOOK_FLAKE_RULE=off`; `CARETOOK_FLAKE_MAX` (8). The orchestrator prompt's landing paragraph: a failed full check has already tried the rule, so never ask about flakes and never `--force` for them; a real failure goes back to its loop.

**Acceptance criteria:**

- Decision unit tests: a failed format, lint, typecheck, build-budget or docs-budget step is real; no result file is real; nine failed files are real; two failed files are a retry of exactly those; the rule off is real.
- Check tests with a stub test step: two files fail, pass alone 3/3 and together, and the check exits 0, records full with both files and writes two ledger lines; a file failing once alone fails the check, names it and records nothing; passing alone but failing together fails; a full check that doesn't hold the claim fails as today without retrying; the steps after the tests still run after a flaky pass, and their failure fails the check.
- A test that the full check's steps match the root `check` script's, so the two can't drift.
- Gate and landing tests: a flaky full record is accepted, the line says how many files, and the landing report lists them; a later exempt-only commit keeps the pass as today.
- Prompt tests cover the changed paragraph.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 5.

## Slice 5: Flaky tests filed by the check

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md, plans/fixes-rules.md · Tests: unit

**User stories:** US 12.

**Build:** the PRD's filing. The pure match of a ledger line to an open `fixes-tooling` item that names the test file (by its path or file name, in the title or a note); after a flaky pass the check files each unfiled ledger line through `pnpm backlog` (a note on the match, else a new triaged bug in `fixes-tooling` with the PRD's title), marks the line filed with the item's id, and prints the ids; `pnpm prd flakes --file` files what's left; filing never fails the check. The orchestrator prompt drops any instruction to file flakes by hand.

**Acceptance criteria:**

- Match unit tests: an open item naming the file matches; a landed or dropped one doesn't; another file with the same test name doesn't; two lines for one file in one check make one item.
- Filing tests against a stub `pnpm backlog`: a new flaky file adds one bug with `prd=fixes-tooling`, triaged, the file and test in its title; a known one adds one note with the date, branch and load; a second run files nothing; a backlog command that fails leaves the line unfiled, warns, and the check still exits 0; `flakes --file` then files it.
- The 20 flaky items a33 filed by hand (B-484 to B-502 and their like) are matched by a test over a copy of their titles, so the first real run adds notes, not duplicates.
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** nothing.

## Slice 6: A session past 160k is told to hand off

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 16, 17, 18, 19, 20.

**Build:** the PRD's _The context watch_, without the dispatcher's part. The pure size read from transcript text; the hook (after each tool call; writes the size record; silent under `CARETOOK_CONTEXT_LIMIT`; the reminder at the first crossing and then every `CARETOOK_CONTEXT_REMIND_MIN`; delivers a waiting nudge; silent while kept; never blocks or fails a tool call); the session wrapper gives it to `prd` sessions through a settings file passed to `claude`, leaving the repo's settings file and planner sessions alone; the orchestrator's and the loop's reminder words; the size record; `pnpm prd context`, `--keep "<why>"`, `--all [--json]`; `pnpm prd status` shows each live session's size, the over-limit mark and the keep reason. The orchestrator prompt's rotation line: past the limit rotate at the next safe point, mid-wave included, without asking; a step that can't resume from _Status_ finishes first with `--keep` and the reason in _Status_. **First, read the current Claude Code hook documentation** (the hook's input, how context is added for the agent, how a subagent's tool call is told apart and where its transcript is, how `claude` takes an extra settings file): build to what it says, and if a subagent's size can't be read, give loops no reminder and report it in the hand-off.

**Acceptance criteria:**

- Size unit tests on fictional transcript text: the last assistant usage wins; input, cache read and cache creation are summed; lines without usage, a half-written last line and an empty transcript give no size.
- Hook command tests (a temporary transcript and record directory, the hook input on stdin): under the limit it prints nothing and writes the size; at the first crossing it prints the orchestrator's reminder with the size and the limit; a second call inside the repeat time is silent and one after it reminds again; a waiting nudge is delivered once; a keep silences it until it expires; a subagent's call gets the loop's words from its own transcript and doesn't change the session's size (or, if the documentation gives no way, a test that such a call is ignored); a missing transcript, bad input or an unwritable record directory exits 0 with no output.
- Wrapper tests (the stub `claude`): a `prd` session is started with the settings file that names the hook; a `plan` session isn't; the repo's settings file is unchanged.
- Command tests: `context` prints the caller's size; `--keep` without a reason is refused, with one it sets the expiry; `--all --json` lists live sessions only and ignores a record whose pid isn't the live session's. `status` shows the size, the mark and the keep reason.
- Prompt tests cover the rotation line.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 7.

## Slice 7: The dispatcher follows up on a session that stays large

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 21.

**Build:** the PRD's dispatcher part of _The context watch_. The pure context decision over the size records, session records and asks: for a live managed orchestrator over the limit with no keep, a nudge `CARETOOK_CONTEXT_NUDGE_MIN` after the first reminder; the same wait after the nudge, a defaulting question ("rotate it now", recommended, or "leave it"), one per session; on "rotate it now" the mid-wave rotation for that topic, and a report when rotation refuses; on "leave it" nothing more for that session; everything cleared when the session drops under the limit or ends. The tick gathers the facts and acts; `--dry-run` shows what it would do; `CARETOOK_CONTEXT_WATCH=off`. It never touches a session opened by hand, a planner, or a paused dispatcher's sessions.

**Acceptance criteria:**

- Decision unit tests: under the limit, nothing; over the limit before the wait, nothing; after it, a nudge, once; after the second wait, the question, once; a keep, a hand-opened session, a planner, a stale record and a paused dispatcher give nothing; the answer "rotate it now" (given or defaulted) gives a rotate, "leave it" nothing for that session again; a new session of the same name starts clean.
- Tick tests (stub rotate and ask): the nudge is written to the size record; the question is filed as defaulting with the push helper started; the rotation is called with the topic, mid-wave and a reason; a refusing rotation files a report and isn't retried every tick; `--dry-run` writes nothing.
- `pnpm test:tooling` passes.

**Blocked by:** 1, 6. **Blocks:** nothing.
