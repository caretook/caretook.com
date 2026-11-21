# Plan: Orchestration 2

> Source PRD: [`plans/orchestration-2-prd.md`](orchestration-2-prd.md). User-story numbers (US) refer to it. Backlog items B-389, B-390, B-391, B-395, B-403 (slice 7, added at the wave 1 boundary). Topic `orchestration-2`. The dispatcher (B-392) is the follow-on topic `orchestration-3`.

## Status

**Where it stands:** **wave 1 landed** in `dev` (77c79ca, PR #26, Codex clean after one fix, 0bc6ff1c; 2026-11-21). After it: the table is migrated and set (flags, `After`, `Hot files`; `doctor` leaves 6 findings for the user: B-196 on done connectors-2, B-239–B-242 and B-244 on done github-review); check-speed and quick-fixes were told to edit it only with `pnpm backlog prd`. The opener try: `--background` kept the selected tab (same session id before and after) but first failed to write the command (an AppleScript variable named `title`); fixed in 86afe808 (goes out with the next PR), and the retry ran the command and the tab closed. **Next:** slices 4–6 wait for check-speed's wave 2 (B-272, B-278) in `dev`; `check-speed-28` will message, and a background check watches `dev`. For slice 4: find the pid to end with `node scripts/loops/sessions.mjs self`, set `rotating` with `sessions.mjs set <name> rotating=true`, open the tab with `open-session.sh --command <line> --title <t> --background`.

**B-403** (the cleanup run) is slice 7 (wave 5, after 6), added at the wave 1 boundary; scheduling past `/loop` stays with `orchestration-3`.

**Landing mode: run everything through** (queued with `pnpm prd queue orchestration-2`): start every ready slice, land each green wave through its PR (Codex-reviewed), clean up; ask only real questions.

**Models:** slices 1, 2, 3 opus (new modules and design), 4 opus, 5 sonnet, 6 sonnet (mechanical) — the plan gives no model, these are the handbook's _Models_.

| Slice | Wave | State         | Merge into `prd/orchestration-2` (slice commits) |
| ----- | ---- | ------------- | ------------------------------------------------ |
| 1     | 1    | merged (opus) | 3ba1e77b (9e722505)                              |
| 2     | 1    | merged (opus) | a0e66284 (c99d30c2)                              |
| 3     | 1    | merged (opus) | dda72b54 (84cdb649)                              |
| 4     | 2    | not started   |                                                  |
| 5     | 3    | not started   |                                                  |
| 6     | 4    | not started   |                                                  |

**Backlog:** B-389 (the registry) closes with slice 1, B-390 (one session per wave) with slice 4, B-391 (the asks queue) with slice 5, B-395 (fix categories) with slice 6 and the split after it (`pnpm backlog done` when each merges).

## Architectural decisions

- **No new dependencies, no migration, no app-code change.** `scripts/loops/`, `scripts/backlog/`, plan files and the PRD table in `plans/backlog.md` only.
- **Pure modules decide, scripts act.** The registry parser, the worked-out state and the asks store are `.mjs` modules handed their facts; `backlog.mjs` and `prd.sh` call them.
- **The registry** is the PRD table: columns `PRD`, `Flags`, `After`, `Hot files`, `Doc and notes`. Flags: `hold` (waits on the user), `done`, `standing` (never finishes; runs while it has waiting items), `alone` (nothing should run beside it), or `—`. `After`: topics. `Hot files`: repo path prefixes, which may name files not made yet. Row order is the priority. All writes go through `pnpm backlog prd`.
- **A topic's state is worked out, never stored:** `hold` or `done` from the flag; `running` when a `prd/<topic>` worktree exists; a `standing` topic is `planned` while it has triaged items and `idle` otherwise; any other is `planned` when `plans/<topic>-plan.md` is on `dev`, else `to-write`.
- **Session records:** `.loops/.sessions/<name>.json` (`pid`, `kind`, `topic`, `started`, `command`, `auto`, `rotating`, `ended`, `exit`), written by `session.sh`, kept after the session exits, removed by `rm.sh` with the worktree. Names stay `prd-<topic>` and `plan-<topic>`. Nothing is written inside a worktree (an untracked file there blocks `land` and `rm`).
- **A session with no record** (started before the wrapper) is, for `rotate` and `end` called from its own shell, that shell's ancestor `claude` process. One helper finds it; with neither a record nor such an ancestor they refuse.
- **Asks:** `.loops/.asks/<id>.json`, machine-local, created exclusively. Ids are `a<n>`.
- **Fix topics:** `fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`. An item's category is its `prd` field. No order of priority between them is decided: nothing in this plan may order them for running.
- **Tests never start a real `claude`** or open a tab: `CARETOOK_CLAUDE_BIN` names a stub, and `CARETOOK_ITERM_APP` points nowhere so the opener prints its command.
- **Loops never edit AGENTS.md, `docs/` or the backlog files.** The orchestrator folds the docs at each landing and does the backlog steps (below).

## How to run this plan

- **Waves:** (1, 2, 3) → 4 → 5 → 6 → 7. Slices 4, 5 and 6 each edit `prompt.sh`, its tests and `prd.sh`, so they run one after another, each from a branch that has the one before. Land after wave 1, after slice 5 (waves 2 and 3 together), after slice 6 and after slice 7. Slice 7 edits `prd.sh` and `prompt.sh` too, so it runs after 6.
- **Gates:** every slice is tooling, so the check gate needs no app check: run the tooling tests (`pnpm test:tooling`) and prettier on the changed files. No browser checks.
- **Shared files in wave 1:** slice 1 owns `scripts/backlog/`; slice 2 `session.sh`, `open-session.*`, `queue.sh`, `rm.sh` and `prd.sh`'s `start`, `open`, `plan` and `end` commands; slice 3 the asks files and a new "asks" group in `prd.sh`'s usage with its own `case` lines. Slices 2 and 3 each add lines to `prd.sh`: the orchestrator resolves that conflict at the merge (both sides are kept).
- **Migrating the table (the orchestrator, once, after wave 1 lands):** the backlog tool writes `dev` in the main checkout, so no slice can do it.
  1. `pnpm backlog prd migrate` (mechanical: the same rows and order).
  2. For each row that isn't `done`, set `after=`, `hot=` and its flag with `pnpm backlog prd set`, reading the prose the migration kept in the notes (a haiku helper proposes, you check; a whole-topic dependency goes to `After`, a slice-level one stays in the notes). Flags as the PRD's _Decisions_: `hold` for `documents`, `encryption`, `assistant-2`, `hosting` and `marketing`; `alone` for `i18n`; `standing` for `quick-fixes`.
  3. Add the `orchestration-3` row (`after=orchestration-2`, B-392's notes) after this topic's.
  4. `pnpm backlog doctor` and `pnpm backlog prd list`; fix what they find. Don't reorder rows: the order is the user's.
  5. Tell the running orchestrators and planners at their next wave boundary that the table is edited only with `pnpm backlog prd`.
     Until the migration, `prd list` says to run it and every other backlog command works as before.
- **The split (the orchestrator, once, after slice 6 lands):** slice 6's _The split_ lists the steps and the category of each waiting item.
- **Trying it (the orchestrator, on the real machine):**
  - After wave 1 lands: open a throwaway tab with the opener's `--background` while iTerm2 is in front and another tab is selected; say in the report whether the selected tab stayed.
  - After slice 5 lands: **rotate yourself** (`pnpm prd rotate`). This is the first real rotation, and you were started before the wrapper, so it also tries the no-record path. Before it, write in _Status_ that a rotation is being tried. If the fresh session opens, it records the result in _Status_. If it doesn't (you are still running a minute later, or the user finds no new tab), say what happened and ask the user before slice 6.
  - If you are a run-through session, your reports from slice 5 on go through `pnpm prd ask` with a PushNotification.
- **Docs at landing (the orchestrator).** `docs/orchestration.md` is over its budget and `docs/agents/orchestrator.md` is about 550 bytes under, so the first landing **moves** the orchestrator handbook's _Worktrees and leases_ section to a new `docs/agents/machinery.md` (with an _Area index_ entry: about 40 of the core's 340 spare bytes), and sessions and asks go there too.
  - After wave 1: `docs/agents/machinery.md` (sessions, asks), `docs/agents/backlog.md` (the registry, `pnpm backlog prd`, row order as priority, the worked-out states), `docs/orchestration.md` (asks; trim more than it adds).
  - After slice 5: `orchestrator.md` (drain, then rotate; run-through sessions ask with `pnpm prd ask` and push; `done` is set by `pnpm prd rm`), `planner.md` (the row through `pnpm backlog prd`), `recovery.md` (a `rotating` record reopens fresh).
  - After slice 6: `planner.md` (_The plan's shape_: the two fixes bullets become the five topics, the category rule and `plans/fixes-rules.md`), `backlog.md` (triage by category), AGENTS.md (_Working rules_: "a PRD or `quick-fixes` slice" becomes "a PRD or fixes slice"), `docs/orchestration.md` where it names `quick-fixes`.

---

## Slice 1: The PRD registry

Stack: no · Reads: docs/agents/backlog.md · Tests: unit

**Backlog:** B-389. **User stories:** 1, 2, 3, 4, 5.

**What to build**

- A pure module in `scripts/backlog/` that parses the `## PRDs` table into rows (`topic`, `flags`, `after`, `hot`, `notes`) and writes it back, keeping row order. It recognises today's four-column prose table and reports "not migrated" for it.
- A pure `stateOf(row, facts)` with the rule in _Architectural decisions_; `facts` are the plan files on `dev`, the `prd/` worktrees and the count of triaged items per topic.
- `pnpm backlog prd list [--json]` (rows with their state), `prd add <topic> [--before <topic>|--after <topic>] [flags=… after=… hot=… notes=…]`, `prd set <topic> flags=… after=… hot=… notes=…`, `prd move <topic> --first|--last|--before <topic>|--after <topic>`. Each write is one locked backlog commit with the tool's trailer.
- `pnpm backlog prd migrate`: mechanical, and "already migrated" after that. The same rows in the same order. `Flags` is `done` when the old doc cell says `**done**` and nothing else, else `—`; `After` and `Hot files` are `—`; the notes are the old doc cell followed by "Depends on: …" and "Hot files: …" with the old prose, when it said more than `—` or "none now". It judges nothing else.
- `doctor`: an `After` topic with no row, a cycle, a topic with waiting items and no row, a waiting item whose topic is `done`, an unknown flag. Each as a finding in doctor's existing form; none is touched by `--fix`.

**Acceptance criteria**

- [ ] Unit tests: a round trip of a migrated fixture; the migration of a fixture in today's shape (a done row, a "done except" row that stays `—`, a to-write row with prose, row order kept); each command; `move` in all four forms; `stateOf` for every state, with `standing` giving `planned` with items and `idle` without; each doctor finding.
- [ ] The hand-off shows `prd migrate` then `prd list` run on a copy of `dev`'s table (a temporary repo, not the main checkout).
- [ ] `pnpm backlog list`, the summary table and every existing backlog test are unchanged.

**Blocked by:** nothing. **Blocks:** 4, 5, 6.

## Slice 2: Recorded sessions

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/recovery.md · Tests: unit

**User stories:** 8, 9, 10.

**What to build**

- `scripts/loops/session.sh <name> [--kind prd|plan] [--topic <t>] [--auto] -- <claude args…>`: runs `${CARETOOK_CLAUDE_BIN:-claude}` as a child, writes the record at start (clearing `rotating`), adds `ended` and `exit` when it exits, passes the exit code on.
- A pure helper that reads the records and says which are live (the pid exists and is that session's: compare the recorded start with the process's), and a helper that finds the calling shell's ancestor `claude` process (walking parent pids; the stub's name in tests).
- `open-session.mjs` wraps the command it chooses in `session.sh`, carries a record's `auto` over to the new one, and chooses a fresh session, never `--continue`, when the record says `rotating`. `pnpm prd start`'s printed command, `queue.sh` and `prd.sh plan --open` start through `session.sh` too.
- The opener gains `--background`: a new tab without activating iTerm2, the previously selected tab selected again, writing to the tab it created (not "current session of current window"). A tab the opener makes runs `exec <command>`, so it closes when the session ends.
- `pnpm prd end [<name>]`: ends the named recorded session, or with no name the calling shell's own (its record when the worktree has one, else its ancestor `claude`), so it works after `pnpm prd rm`. `rm.sh` removes the worktree's record.

**Acceptance criteria**

- [ ] Tooling tests with a stub `claude`: the record at start and after exit; liveness for a live, an ended and a reused pid; the ancestor helper from a shell under the stub and from one that isn't; `end` with a record, with no record under the stub, and refusing with neither; `rm.sh` removes the record.
- [ ] The existing `open-session` and prompt tests pass with the wrapper in the command; tests show `auto` carried over and `rotating` choosing fresh over a saved conversation.
- [ ] A test of the AppleScript text the opener would run with `--background`: no `activate`, it reselects the earlier tab, it writes to the created tab. (The real try is the orchestrator's: _Trying it_.)

**Blocked by:** nothing. **Blocks:** 4, 5.

## Slice 3: The asks queue

Stack: no · Reads: docs/agents/orchestrator.md · Tests: unit

**User stories:** 11, 12, 13, 14.

**What to build**

- A pure store module in `scripts/loops/` over a directory of ask files: create (exclusive, retrying the next id), list open, answer, dismiss.
- `pnpm prd ask --topic <t> --question <text> --option <a>… --recommend <a>` and `pnpm prd ask --topic <t> --report <text>`: each prints the id, then one line "Now send a PushNotification: <topic>: <the text, shortened>". It also shows a macOS notification when `osascript` exists, and runs `$CARETOOK_ASK_NOTIFY <id> <kind> <topic> <text>` when set, ignoring its failure and bounding its time.
- `pnpm prd ask --wait <id> [--timeout <seconds>]` (prints the answer, exit 0; exit 75 on timeout), `pnpm prd asks [--json]`, `pnpm prd answer <id> <option number or text>`, `pnpm prd asks --done <id>`.
- `pnpm prd asks` prints each open ask with its topic, age, options numbered and the recommended one marked.

**Acceptance criteria**

- [ ] Unit tests of the store: ids, two creates at once get different ids, an answer by number and by text, an unknown id, answering twice refused, a report can't be answered, dismiss.
- [ ] Tooling tests: `ask --wait` returns when another process answers, and exits 75 at its timeout; `ask` prints the PushNotification line; the notify hook gets its four arguments, and a failing or hanging hook doesn't fail `ask`.
- [ ] The commands are in `pnpm prd help` under their own group.

**Blocked by:** nothing. **Blocks:** 5.

## Slice 4: Rotation

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/recovery.md · Tests: unit

**Backlog:** B-390. **User stories:** 6, 7, 8.

**What to build**

- `scripts/loops/rotate-into.sh <name> <old pid>`: writes `rotating` into the record (making one when there is none), ends the old pid (TERM; KILL after `CARETOOK_ROTATE_WAIT`, default 20 seconds), waits for it to go, then `exec`s `session.sh` with `prompt.sh orchestrator <topic> --resume` (plus `--auto` when the record or _Status_ says run-through): always fresh, never `--continue`, the same name.
- `pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`: the topic defaults to the worktree's. The old pid is the record's live one, else the calling shell's ancestor `claude` (slice 2's helper). Refuses when `plans/<topic>-plan.md` has uncommitted changes, when it finds no such pid, or when slice worktrees of the topic exist and `--mid-wave` wasn't given. Then opens `rotate-into.sh` in a background tab (slice 2's opener) and returns at once, so the calling session can say its last line. Without iTerm2 it prints the command for the user to run and ends nothing.
- `prompt.sh orchestrator` (the shared bullets, so every orchestrator): after a landing and its docs, start no new slice; when the slices in flight are merged, commit _Status_ and run `pnpm prd rotate`; with none in flight, rotate at once. `--mid-wave` only on the user's word. After the last landing: `pnpm prd rm`, then `pnpm prd end`.
- `rm.sh`: removing a PRD worktree whose branch is merged and whose plan _Status_ has no slice left to run sets the `done` flag (`pnpm backlog prd set`), except for a `standing` topic; it says what it did. Before the table is migrated it skips this.

**Acceptance criteria**

- [ ] Tooling tests with a stub `claude`: `rotate` prints the `rotate-into.sh` command when there is no iTerm2, with the record's pid, and with the ancestor's when there is no record; running that command ends the stub, starts the fresh resume prompt under the same name, `--auto` follows the record, and `rotating` is set before the kill and cleared by the new session; a stub that ignores TERM is killed after the wait; the three refusals; `rm.sh` sets `done` only in the case above.
- [ ] The orchestrator prompt's tests show the drain-then-rotate line with and without `--auto`.

**Blocked by:** 1, 2. **Blocks:** 5.

## Slice 5: Run-through prompts, the planner's row and status

Stack: no · Reads: docs/agents/planner.md, docs/agents/orchestrator.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-391. **User stories:** 2, 10, 11, 12, 13, 14, 15, 16, 17.

**What to build**

- `prompt.sh orchestrator <topic> --auto` (the `--auto` block only): a real question goes through `pnpm prd ask`, followed at once by a PushNotification with the line `ask` printed, then `pnpm prd ask --wait <id>` in the background while the session carries on with whatever doesn't depend on it; never AskUserQuestion. Each landing files a report (the `pnpm prd ready` summary, the link, what to try by hand) and pushes it; other reports are pushed only when something failed. An answer the user gives in the session itself is recorded with `pnpm prd answer`.
- `prompt.sh plan`: the topic's row is added and set with `pnpm backlog prd add` and `prd set … after=… hot=…` (path prefixes), never a hand edit and `pnpm backlog commit`; its last step, after `pnpm prd rm plan-<topic>` and the report, is `pnpm prd end`.
- `prompt.sh backlog`: the overview reads `pnpm prd asks` and `pnpm backlog prd list`, and names what waits on the user first.
- `pnpm prd status`: each recorded session (name, live or ended, age, run-through or not) and the open asks (the count and the oldest, with its age).

**Acceptance criteria**

- [ ] Prompt tests: the `--auto` prompt names `pnpm prd ask`, PushNotification and `--wait`, and not AskUserQuestion; without `--auto` the orchestrator prompt is unchanged from slice 4's; the planner prompt names `pnpm backlog prd` and `pnpm prd end`; the backlog prompt names both new sources.
- [ ] A tooling test: `status` prints the sessions and asks parts from a temporary `.loops`, and prints neither heading when there are none.

**Blocked by:** 1, 2, 3, 4. **Blocks:** 6.

## Slice 6: Fix categories

Stack: no · Reads: docs/agents/planner.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-395. **User stories:** 18, 19, 20.

**What to build**

- `plans/fixes-rules.md`: the rules every fix slice follows, copied from the `quick-fixes` plan's _Writing and running new slices_ (don't edit that plan: its orchestrator is writing it), plus: one slice and one backlog item per fix; the orchestrator appends a slice per waiting item at a wave boundary; each fix slice's `Reads` names this file; the category rule and its tie-break (the PRD, _Fix categories_), said to be for triage only.
- Five plan files, `plans/fixes-ui-plan.md`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`: a title, one line saying what belongs here and that there is no PRD, a link to the rules, and an empty _Status_ table (`Slice`, `Item`, `State`, `Merge`).
- `prompt.sh`: the backlog session's and the orchestrator's triage lines name the five topics and the rule (a small fix is `prd=fixes-<cat>`, never `quick-fixes`); an orchestrator whose topic starts with `fixes-` is told to append a slice per waiting item before its first wave and that its plan is the whole spec. The comment at `prompt.sh`'s no-PRD branch names the fix topics.
- A test that the five plan files and the rules file exist and that each plan's _Status_ parses (so a rename is caught).

**The split (the orchestrator, after this slice has landed)**

1. `pnpm backlog prd add` the five topics with `flags=standing,hold` and the note "waits on the user's order between the fix categories", after the `quick-fixes` row. Their order there means nothing while they are on `hold`; don't describe it as a priority.
2. Move every `quick-fixes` item that is `triaged` and unclaimed to its topic, with a note "category: <cat> (orchestration-2 split)". Items filed after 2026-11-21 get a category by the rule. The planner's proposal for those waiting on 2026-11-21:

| Topic           | Items                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `fixes-ui`      | B-229, B-231, B-256, B-316, B-319, B-325                                    |
| `fixes-tooling` | B-381, B-388, B-394                                                         |
| `fixes-perf`    | B-311, B-313                                                                |
| `fixes-bug`     | B-310, B-312, B-314, B-315, B-317, B-318, B-320, B-321, B-322, B-323, B-324 |
| `fixes-nit`     | B-326, B-379 (it adds a migration: run it alone), B-380                     |

3. `pnpm backlog prd set quick-fixes flags=—`, so that `pnpm prd rm quick-fixes` marks it done once its claimed items have landed. If no `prd/quick-fixes` worktree is left, set `flags=done` now.
4. `pnpm backlog doctor`; then report (an ask report and a PushNotification when run-through): the five topics, where each item went, that each runs by hand with `pnpm prd start fixes-<cat>` and takes a PRD slot while it does, and that the order between them is the user's to set (`pnpm backlog prd move`, then clear `hold`).

**Acceptance criteria**

- [ ] The test above; prompt tests: the backlog and orchestrator prompts name the five topics and not "`prd=quick-fixes`"; a `fixes-` orchestrator prompt has the append line and the no-PRD wording.
- [ ] `plans/quick-fixes-plan.md` is unchanged.
- [ ] No script orders the categories for running (the triage tie-break is the only list).

**Blocked by:** 1, 5. **Blocks:** nothing.

## Slice 7: A cleanup run (`pnpm prd tidy`)

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-403 (its note lists what the hand sweep found). **User stories:** 21.

**What to build**

- A pure module in `scripts/loops/` that takes the facts (worktrees with branch, merged-into-parent and dirty flags; session records with liveness; local and remote branches; lease, queue and slot tickets with their pids; test databases; Docker volumes; `.loops/.browser-hangs` logs and their age; backlog items that are archivable; registry rows) and sorts each finding into **safe** (remove without asking) or **ask** (report only), with the reason.
  - Safe: a slice worktree merged into its `prd/` branch and clean, with no live agent; a `plan/<topic>` worktree level with `dev`, clean, with no live session; lease, queue and slot tickets whose pid is dead; test databases with no worktree; stale remote-tracking refs (`git fetch --prune`); dangling `caretook` Docker volumes; browser-hang logs older than a week; ended session records with no worktree.
  - Ask: a live session whose worktree is gone or whose branch is in `dev` (looks finished); a local branch with no worktree (merged ones are named for deletion, unmerged ones never deleted); items to archive; registry rows that look done (`pnpm prd rm` normally sets `done`).
  - Never: a dirty worktree, a live worktree's build or Vite caches (unlike `reclaim --yes`), the main checkout, an unmerged branch, a session.
- `pnpm prd tidy [--yes] [--json]`: prints both lists; `--yes` does the safe ones (through `rm.sh`, `test-db`, `git fetch --prune`, `docker volume rm`) and files the ask list as one `pnpm prd ask --report` (none when it is empty), printing the PushNotification line.
- `prompt.sh tidy`: a short brief for a cheap session (haiku): run `pnpm prd tidy --yes`; for each live session that looks finished, ask it over SendMessage whether it is done and add its answer to the report; never close a session, delete a branch or archive items itself. The brief says how to repeat it every few hours with `/loop` while PRDs run; the dispatcher (`orchestration-3`) takes this over.

**Acceptance criteria**

- [ ] Unit tests of the sorter: each safe, ask and never case above, with a dirty or live case beside each safe one.
- [ ] Tooling tests in a temporary repo and `.loops`: `tidy` lists without changing anything; `tidy --yes` removes a merged slice worktree and a dead lease ticket, keeps a dirty worktree and an unmerged branch, and files one report ask (none when nothing is left to ask); no Docker or real `claude` is touched (stubs).
- [ ] The prompt test: `prompt.sh tidy` names `pnpm prd tidy --yes`, SendMessage and `/loop`, and says never to close sessions or delete unmerged work.

**Blocked by:** 2, 3, 6 (`prd.sh`, `prompt.sh`). **Blocks:** nothing.
