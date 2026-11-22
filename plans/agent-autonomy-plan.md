# Plan: Agent autonomy

> Source PRD: [`plans/agent-autonomy-prd.md`](agent-autonomy-prd.md). User-story numbers (US) refer to it. Backlog items B-503 (default on silence), B-504 (quiet-machine landing check), B-505 (the flake rule), B-506 (shared notice board), B-516 (landing notices before and after), B-517 (a check carries over a dev sync), B-518 (land without re-syncing). Topic `agent-autonomy`. The follow-on topic `agent-autonomy-2` (the context watch) has [its own plan](agent-autonomy-2-plan.md).

## Status

| Slice | Wave | State         | Merge into `prd/agent-autonomy` (slice commits) |
| ----- | ---- | ------------- | ----------------------------------------------- |
| 1     | 1    | merged (opus) | 55275f08 (d759b24e)                             |
| 2     | 1    | merged (opus) | b3877be1 (142fa3d7)                             |
| 3     | 2    | —             | —                                               |
| 4     | 3    | —             | —                                               |
| 5     | 3    | —             | —                                               |
| 6     | 4    | —             | —                                               |
| 7     | 5    | —             | —                                               |
| 8     | 6    | —             | —                                               |
| 9     | 6    | —             | —                                               |
| 10    | 6    | —             | —                                               |

**Landing mode:** run everything through (started by the dispatcher, 2026-11-22): start every ready slice, land each green wave, clean up; ask only real questions via `pnpm prd ask`. test-health runs beside this PRD: waves 3 to 6 land only between its waves (see _Other topics_).

**Now:** wave 1 merged and synced; `pnpm test:tooling` (778 passed, after one rerun past the known flaky tidy test B-461) and `pnpm exec eslint scripts` clean; docs folded; PR #58 open, Codex review pending; then land, then drain and rotate.

**Backlog:** claim B-503 when slice 1 starts and `done` it when slice 1 merges; B-506 with slice 2; B-504 when slice 3 starts, `done` when slice 4 merges; B-505 when slice 5 starts, `done` when slice 6 merges; B-517 when slice 7 starts, `done` when slice 8 merges; B-518 with slice 9; B-516 with slice 10.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (the asks' defaults, the notice board), [orchestrator](../docs/agents/orchestrator.md) (which questions default; the landing notice replaces the SendMessage round at step 7; when to post a notice), [planner](../docs/agents/planner.md) (a planner's questions default too: `--defaults`, `--waits` for the never list), [preferences](../docs/agents/preferences.md) (the default-on-silence rule and its never list); wave 2, machinery (the machine claim) and orchestrator (_Capacity_); wave 3, machinery (who else waits; the flake retry and the ledger) and orchestrator (_Landing a wave_, _The check gate_: the flake rule); wave 4, orchestrator and [backlog](../docs/agents/backlog.md) (flakes filed by the check); wave 5, machinery (the `Checked:` trailer); wave 6, orchestrator (_The check gate_: the carried full pass replaces the "quick is enough on top of a full pass" paragraph; _Landing a wave_: the hold's exit at step 1, the unsynced landing at step 6) and machinery (the carried line in the landing report, landing notices, the unsynced landing); every wave, [orchestration](../docs/orchestration.md) for new commands. Trim at least what you fold in.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, its tests, prompts. No app code, no migration, no dependency.
- **Machine state lives in the main checkout's `.loops/`**, untracked, one small file or lock directory per thing (asks, notices, the claim and its tickets, the flake ledger), written atomically; nothing is written inside a worktree. Each store takes its directory from the caller or a `CARETOOK_…` variable, so tests use temporary directories.
- **Pure decision, thin command:** the default's settling, the notice store, the claim queue's order, the flake decision and the item match are functions tested alone; the shell and command-line parts only gather facts and act.
- **A user's answer always wins** over a default: settling and answering share one exclusive step per ask, and reading the list never settles.
- **Nothing new can fail a command it decorates:** printing notices, posting one, filing a flake or reading the claim never changes another command's exit code.
- **Every wait is bounded by the waiter's own time** and says what it waited for and why it stopped; every new behaviour has an off switch (`CARETOOK_QUIET=off`, `CARETOOK_FLAKE_RULE=off`; `CARETOOK_LEASES=off` turns the claim off too).
- **The check record stays readable by older readers:** a flaky pass is still a `full` record; the flaky files ride beside it.
- **Tests never touch** the real asks queue, leases, backlog, check log or `origin`.
- **One verdict on what dev brought** (slice 7's module) serves the carried check, the unsynced landing and the hold, with one list of carry-risky files (`check-plan.mjs`'s forced-full list plus the test setup and build config that reach tests without an import) and one plain-merge test shared with the Codex carry. A gate never loosens on a guess: anything git or Vitest can't answer is a refusal, and the caller falls back to today's behaviour.
- **How a landing was checked lives in dev's history** (the merge commit's `Checked:` trailer), never only in `.loops/`.

## How to run this plan

- **Waves:** 1: slices 1 and 2. 2: slice 3. 3: slices 4 and 5. 4: slice 6. 5: slice 7. 6: slices 8, 9 and 10. Each wave lands something usable alone.
- **Who owns what in a shared wave.** Wave 1: slice 1 owns the asks store and command, the dispatcher's use of them, the prompts, and the asks lines of `pnpm prd status`; slice 2 owns the new notice store and command, the lines the front door prints before gated commands, the notices lines of `status` and the landing's notice. Both add commands to the front door: additive, merged by the orchestrator. Wave 3: slice 4 owns the browser check's and slice creation's waits, the dispatcher and `status`; slice 5 owns the check's body and runner and the ledger. Neither touches the other's. Wave 6: slice 8 owns `pnpm prd check`'s quick path (the carried body, the record, keeping the full record on a failure), `pnpm prd sync`'s verdict line, `checked_ok`/`checked_how` and the landing report's carried line; slice 9 owns `land`'s drift refusal, its typecheck, the ` unsynced` trailer and its report line; slice 10 owns the notice fields, the landing notice and the hold in the full check's path before the claim, and land's withdraw-and-post around the merge. Slices 9 and 10 both edit `land.sh`, and 8 and 10 both edit the `check` case, in separate places: the orchestrator merges them.
- **Gate:** the diff is tooling and Markdown, so the check gate needs nothing; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **Models:** every slice is opus or stronger (locks, races, the check gate).
- **Other topics:** `test-health`, `inbox-agent`, `code-health` and `fixes-tooling` change the same directory; don't run beside them (the hot-file rule) and sync at each wave boundary. **While test-health runs** (its word, 2026-11-22): land no change to what quick or full means (`check-plan.mjs`, `lib.sh` `checked_ok`) or what land accepts in the middle of a test-health landing, only between its waves; never touch `scripts/eslint/` or `eslint.config.js`. That binds waves 3 to 6.
- **Try each wave on itself:** this PRD's own landings are tooling only and run no full check, so the claim, the flake rule, the carry, the unsynced landing and the hold are first exercised by the next code landing of another topic. Say so in each landing report.

## Slice 1: A question that takes its recommendation after 30 minutes

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/planner.md · Tests: unit

**User stories:** US 1, 2, 3, 4, 5, 6.

**Build:** the PRD's _Asks that default_. The ask record's default fields; `--defaults` and `--waits` on filing, with the refusal when a recommended question has neither; the settling function and the exclusive step it shares with answering; settling called by `--wait` and by the dispatcher's tick, never by the listing; `--wait`'s extra line; the push line's "takes `<option>` at `<time>` unless answered"; the listing's countdown ("due" once past) and its "decided for you" part; `answer` refused on a defaulted ask; the two predicates, with the dispatcher's pick on "awaits an answer"; `CARETOOK_ASK_DEFAULT_MIN` (30). Prompts: the run-through orchestrator's asking paragraph (which flag when, the never-default classes, the tool defaults and never the agent), the unattended planner's line (the same rule as the orchestrator's: `--defaults` with a recommendation, `--waits` for the never list; the user's note on B-503), and the dispatcher's own question filed as waiting. `pnpm prd status`'s asks line counts questions awaiting an answer and defaulted ones apart.

**Acceptance criteria:**

- Store unit tests: a defaulting ask settles to its recommendation once due and not before; settling an answered or dismissed ask changes nothing; an answer and a settle racing for one ask leave exactly one of them, and the loser reports it (the exclusive step, tested by holding it); a waiting ask never settles; a defaulted ask is listed until dismissed and doesn't await an answer; `--defaults` needs a recommendation.
- Command tests: a recommended question with neither flag exits non-zero, files nothing and names both flags and the never-default classes; `--wait` on a due ask prints the option, says it was defaulted and exits 0; `--wait` returns a user's answer given before the default; `asks` shows the countdown, shows a due ask as due without settling it (it can still be answered), and shows the defaulted part; `--json` carries the fields; `answer` on a defaulted ask is refused.
- Dispatcher tests: a topic whose only ask was defaulted is no longer skipped for an open question; a tick settles a due ask of a dead session; the reopen ask is filed as waiting and never settles.
- Prompt tests cover the three changed prompt texts; the unattended planner's says `--defaults` with a recommendation and names the never list.
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

## Slice 3: A landing's full check takes the machine, and other checks wait

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 7, 9, and US 8 for checks.

**Build:** the PRD's _The machine claim_, between checks. The claim (one slot, dead holders taken over) and its arrival-order queue of tickets; a full check in a `prd/` or `hotfix/` worktree queues before taking its check lease, takes the claim, then its lease, waits for quiet (no other check or browser lease held, the 1-minute load at or under `CARETOOK_QUIET_LOAD`, at most `CARETOOK_QUIET_SETTLE`) in place of the load gate's wait, posts the claim's notice, runs, and releases on every exit; every other `pnpm prd check` waits, before taking a check lease, while another worktree holds the claim or queues for it, until none does or it has itself waited `CARETOOK_QUIET_MAX`; the check-times line's two new fields and the summary's reading of them; `CARETOOK_QUIET=off`. One reusable "wait for the claim" entry point, with the bound passed in, for slice 4's callers.

**Acceptance criteria:**

- Queue unit tests: three waiters take the claim in arrival order; a dead waiter's ticket is skipped and removed; a dead holder is taken over by the oldest live waiter.
- Check tests (stub check body, a stand-in load file, short settings): a full check in a `prd/` worktree takes the claim and releases it on a pass, a failure and a kill; a quick check, and a full check in a slice worktree, take none; the claimer waits while another check lease is held and runs at the settle limit, saying the machine wasn't quiet; a queued claimer holds no check lease while it queues; a second worktree's quick check waits for the claim and starts on release; with the claim handed from one landing to the next, a waiter still starts once its own limit passes; the holder's own worktree doesn't wait on itself; the claim's notice is posted and withdrawn; the log line has the two fields.
- With `CARETOOK_QUIET=off` or `CARETOOK_LEASES=off` nothing is claimed and nothing waits.
- `pnpm test:tooling` passes.

**Blocked by:** 2. **Blocks:** 4, 5, 9, 10.

## Slice 4: Browser checks, slice starts and the dispatcher wait for the claim

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 8, 10.

**Build:** the rest of _The machine claim_, on slice 3's entry point. A browser check waits before its browser lease (bound `CARETOOK_QUIET_MAX`), except in the worktree that holds the claim; a slice worktree's creation waits at most the load gate's `CARETOOK_LOAD_WAIT`, as one wait with the load gate, not two in a row; the dispatcher's facts gain "claimed" (held or queued), which stops starts and plans with its own reason while reopens still happen; `pnpm prd status` shows the holder, its age, its notice's end time and the queue.

**Acceptance criteria:**

- Browser-check and slice-creation tests: each waits on another worktree's claim and proceeds on release or at its own limit, saying which; slice creation never waits longer than the load gate's limit in all; the claim's own worktree runs its browser checks without waiting.
- Dispatcher pick tests: claimed stops starts and plans, reopens still happen, and the passed-over reason reads as the claim; not claimed changes nothing.
- Status tests: no claim prints nothing; a holder and two waiters print in order.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** nothing.

## Slice 5: A full check retries tests that fail under load

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 11.

**Build:** the PRD's _The flake rule_, up to the record and the ledger. The full check runs its steps one by one, the same steps as the root `check` script, and its test step (and the tooling tests) leaves a machine-readable result; the pure decision (real, with its reason, or retry these files); the retry (wait for quiet again, each failed file alone three times, then together once), then the check's remaining steps; a flaky pass recorded as full with its flaky files beside it; one ledger line per flaky file; the check's last lines always say whether the rule ran and what it decided; the check-times line marks a flaky pass; `CARETOOK_FLAKE_RULE=off`; `CARETOOK_FLAKE_MAX` (8). For every full check in a `prd/` or `hotfix/` worktree, with or without the claim.

**Acceptance criteria:**

- Decision unit tests: a failed format, lint, typecheck, build-budget or docs-budget step is real; no result file is real; a failed test step naming no failed file is real; nine failed files are real; two failed files are a retry of exactly those; the rule off is real; each real answer carries its reason.
- Check tests with a stub test step: two files fail, pass alone 3/3 and together, and the check exits 0, records full with both files and writes two ledger lines; a file failing once alone fails the check, names it and records nothing; passing alone but failing together fails and says so; a full check in a slice worktree fails as today without retrying, and says the rule didn't run; a check that never got the claim still retries; the steps after the tests still run after a flaky pass, and their failure fails the check.
- A test that the full check's steps match the root `check` script's, so the two can't drift.
- An existing reader of the check record still reads a flaky pass as full (the gate's tests pass unchanged).
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 6.

## Slice 6: A flaky pass lands, is reported, and is filed

Stack: no · Reads: docs/agents/backlog.md, docs/agents/orchestrator.md, docs/agents/machinery.md, plans/fixes-rules.md · Tests: unit

**User stories:** US 12, 13.

**Build:** the rest of _The flake rule_. The gate's line ("full, N flaky test files rerun") in `land` and `ready`, and the landing report's list under what wasn't checked; `pnpm prd flakes` lists the ledger; the pure match of a ledger line to an open `fixes-tooling` item that names the test file (by its path or file name, in the title or a note); after a flaky pass the check files each unfiled ledger line through `pnpm backlog` (a note on the match, else a new triaged bug in `fixes-tooling` with the PRD's title), marks the line filed with the item's id, and prints the ids; `pnpm prd flakes --file` files what's left; filing never fails the check. The orchestrator prompt's landing paragraph: the check has already tried the rule and says so, so never ask about flakes, never `--force` for them and never file them by hand; a real failure goes back to its loop with the rule's last lines; the same tip failing for real twice with nothing a loop can fix is asked as any real failure.

**Acceptance criteria:**

- Gate and landing tests: a flaky full record is accepted, the line says how many files, and the landing report lists them; a later exempt-only commit keeps the pass as today.
- Match unit tests: an open item naming the file matches; a landed or dropped one doesn't; another file with the same test name doesn't; two lines for one file in one check make one item.
- Filing tests against a stub `pnpm backlog`: a new flaky file adds one bug with `prd=fixes-tooling`, triaged, the file and test in its title; a known one adds one note with the date, branch and load; a second run files nothing; a backlog command that fails leaves the line unfiled, warns, and the check still exits 0; `flakes --file` then files it.
- The flaky items filed by hand on 2026-11-22 (B-484 to B-502 and their like) are matched by a test over a copy of their titles, so the first real run adds notes, not duplicates.
- Prompt tests cover the changed paragraph.
- `pnpm test:tooling` passes.

**Blocked by:** 5. **Blocks:** 7.

## Slice 7: What dev brought, and every landing says how it was checked

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 17, and the base of US 16, 18, 21.

**Build:** the PRD's _What dev brought_.

- **The module:** given a checkout, dev's ref, a checked commit and a tip, it returns both sides' files, the incoming dev commits (first parent) and how each landed, the carry-risky files on each side, whether every merge of dev since is plain, and the carry verdict or a refusal with its reason. Its pure overlap test, "would a landing of these files stop this pass carrying over?", is what slice 10 calls.
- **The plain-merge test** moves out of the Codex carry, so both use one.
- **The carry-risky list:** `check-plan.mjs`'s forced-full list (exported once), plus the test setup and build config.
- **The trailer:** every landing's merge commit, on both paths, gets its `Checked:` trailer (including slice 6's flaky count), and a reader says whether a commit landed through a full check.

Nothing reads the verdict yet: slices 8 to 10 do.

**Acceptance criteria:**

- **Module unit tests**, over throwaway repositories in a temporary directory:
  - A sync merge of two full-checked landings on other files carries.
  - Each refusal is named: a shared file; a migration, the lockfile, a test setup file or `vite.config.ts` on dev's side; a carry-risky file on the branch's side; a conflict resolved in the merge; a code commit after the full pass; an incoming commit with no trailer; one whose trailer is quick or unsynced.
  - A backlog-only, Markdown-only or tooling-only incoming commit with no trailer doesn't stop it.
  - A chain of two syncs carries twice.
  - Git failing is a refusal.
  - The overlap test is true for a shared file or a carry-risky file on either side, and false otherwise.
- **Trailer unit tests:** each kind, ` unsynced` included, is written and read back; a commit with no trailer, or one ending in ` unsynced`, reads as not full.
- **Landing tests**, through the `CARETOOK_PR_THROWAWAY` seam: the printed merge carries `--body` with the trailer, and a local landing's commit has it.
- The Codex carry's tests pass unchanged on the shared plain-merge test.
- `pnpm test:tooling` passes.

**Blocked by:** 6. **Blocks:** 8, 9, 10.

## Slice 8: A full pass carries over a dev sync

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 16.

**Build:** the PRD's _A full pass carries over a dev sync_, on slice 7's module.

- **The carried check:** `pnpm prd check --quick` (and so `land --recheck`) runs it when the verdict is carry. It runs typecheck, lint, the tests related to both sides from Vitest's module graph, the always-run list, the check-areas lint, the docs budget, and the tooling tests when both sides touch the tooling. It falls back to today's quick, saying why, when the related files can't be worked out.
- **The record:** `<tip> full carried <F> <why>`, with a failed carried check leaving the full record in place. `checked_ok` and `checked_how` accept it and describe it.
- **Around it:** the landing report's carried line, the check-times mode `carry`, the verdict line `pnpm prd sync` prints after its merge, and `CARETOOK_CARRY=off`. A plain `pnpm prd check` stays full.

**Acceptance criteria:**

- **Related-files unit tests**, over a stub module graph:
  - A test depending on files from both sides is chosen.
  - A test depending on one side only isn't.
  - A test changed on one side that depends on the other is chosen.
  - A graph that can't be read means the fallback.
- **Check tests** (a stub check body):
  - `--quick` after a carrying sync runs the carried body and writes the carried record.
  - `--quick` after a refusing sync runs today's quick and prints the reason.
  - A failed carried check leaves the full record, so the next `--quick` carries again.
  - A plain `check` runs full.
  - `CARETOOK_CARRY=off` never carries.
  - The gate reads a carried record as full, and `checked_how` names both commits.
- **Output tests:** `sync` prints the verdict after a merge, and the to-test file has the carried line.
- `pnpm test:tooling` passes.

**Blocked by:** 7. **Blocks:** nothing.

## Slice 9: Land on an unsynced tip

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 18, 19.

**Build:** the PRD's _Land on an unsynced tip_, on slice 7's module and slice 3's claim wait.

- **When land relaxes:** when dev has drifted, `land` asks the module and goes ahead when dev's files since the last sync share none with the branch and none is carry-risky. Every other refusal stays.
- **The typecheck** runs in a check lease, after waiting for another worktree's claim. It refuses while the branch's worktree holds a check or browser lease. It makes a no-commit merge of dev in that worktree, runs `pnpm typegen` then `pnpm typecheck`, and puts the worktree back to the tip on every exit it can catch. A marker beside the merge lets the next `land` or `check` there abort a merge a kill left behind. A failure lands nothing and says to sync.
- **When it's skipped or refused:** the typecheck is skipped when the branch's diff is Markdown only (`docs_only`), whatever its kind. A branch with no worktree, or a dirty one, is refused.
- **Dev moving meanwhile:** dev is read again after the typecheck, and land judges once more, refusing rather than looping.
- **The record:** the ` unsynced` trailer, the landing report and land's own line, and `CARETOOK_UNSYNCED=off`.

**Acceptance criteria:**

- **Landing tests** (throwaway repositories, the PR seam, a stub `pnpm` whose typecheck passes or fails, short lease settings):
  - Drift on other files lands, prints the unsynced line, and the printed merge's trailer ends in ` unsynced`.
  - Drift on a shared file is refused as today.
  - Drift bringing a migration, `package.json` or a test setup file is refused, naming it.
  - The stub sees typegen before typecheck.
  - A failing typecheck lands nothing.
  - The worktree is back at the tip with a clean status after a pass, a failure and an interrupt.
  - A leftover marked merge is aborted by the next `land`.
  - The typecheck waits for another worktree's claim and holds a check lease while it runs.
  - A worktree holding a browser lease is refused.
  - Dev moving during the typecheck onto a shared file is refused.
  - A Markdown-only branch lands unsynced with no typecheck.
  - `CARETOOK_UNSYNCED=off` refuses all drift.
  - The to-test file says it landed unsynced.
- `pnpm test:tooling` passes.

**Blocked by:** 7 (and 3, through 7). **Blocks:** nothing.

## Slice 10: Landing notices before and after, and a full check that waits for an overlapping landing

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 20, 21.

**Build:** the PRD's _Landing notices and the hold_, on slices 2, 3 and 7.

- **The notice store:** notices gain a kind and fields, kept and shown by `--json` and readable by other commands.
- **The landing notice:** every full check in a `prd/` or `hotfix/` worktree posts it when it starts, before it queues for the claim and whether or not there is a claim. It replaces that topic's earlier landing notice and holds the checked tip. Its fields are the topic, the expected end (the check log's median full check), the areas (from `check-areas.mjs`), the other topics' hot prefixes it touches (the PRD table), its files and its carry-risky flag.
- **When it ends:** it is withdrawn on a failure. Readers treat it as ended once its branch's tip has a code commit past the checked tip, or the branch is gone. At the merge, `land` withdraws it and posts the landed one with the same fields.
- **The hold:** the check waits on any other topic's live landing notice posted before its own that slice 7's overlap test says would stop its pass carrying over. It reads them when it starts and again when it gets the claim. It waits at most `CARETOOK_LANDING_HOLD`, and says which landing. If that landing merges, the check stops with its own exit code, records nothing (keeping the earlier record), and says to sync and check. On an end without a merge, an expiry or the limit it runs, saying which. `CARETOOK_QUIET=off` turns the hold off.
- **The prompt:** the run-through orchestrator's landing paragraph says what that exit means.

**Acceptance criteria:**

- **Store unit tests:**
  - Fields round-trip.
  - A notice without fields lists as before.
  - An overlong file list reads as touching everything.
  - A second landing notice for a topic replaces the first.
- **Check tests** (stub body, short settings):
  - A full check posts the landing notice with its areas and hot prefixes, with `CARETOOK_QUIET=off` too. It stays on a pass and is gone on a failure.
  - Another worktree's later full check sharing a file waits, then on a landed notice stops with the exit code, leaving its earlier record.
  - The earlier check never waits on the later one, so two overlapping landings can't wait on each other.
  - A check queued behind a third landing re-reads the notices on getting the claim, and waits then.
  - A notice whose branch gained a code commit past its tip no longer holds anyone.
  - One whose files don't overlap doesn't wait.
  - A quick check never waits.
  - The limit lets it run and it says so.
- **Landing tests:** the merge withdraws the landing notice and posts the landed one with the sha and the areas, and a failure to post doesn't fail the landing.
- Prompt tests cover the changed paragraph.
- `pnpm test:tooling` passes.

**Blocked by:** 3, 7. **Blocks:** nothing.
