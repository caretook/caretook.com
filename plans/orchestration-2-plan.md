# Plan: Orchestration 2

> Source PRD: [`plans/orchestration-2-prd.md`](orchestration-2-prd.md). User-story numbers (US) refer to it. Backlog items B-389, B-390, B-391, B-395. Topic `orchestration-2`. The dispatcher (B-392) is the follow-on topic `orchestration-3`.

## Status

**Where it stands:** planned (2026-11-21), not started. Runs after `check-speed` is in `dev` (shared `prd.sh`, `prompt.sh`) and before `test-health`, never beside it.

| Slice | Wave | State       | Merge into `prd/orchestration-2` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------------------ |
| 1     | 1    | not started |                                                  |
| 2     | 1    | not started |                                                  |
| 3     | 1    | not started |                                                  |
| 4     | 2    | not started |                                                  |
| 5     | 2    | not started |                                                  |
| 6     | 3    | not started |                                                  |

**Backlog:** B-389 (the registry) closes with slice 1, B-390 (one session per wave) with slice 4, B-391 (the asks queue) with slice 5, B-395 (fix categories) with slice 6 and the split after it (`pnpm backlog done` when each merges).

## Architectural decisions

- **No new dependencies, no migration, no app-code change.** `scripts/loops/`, `scripts/backlog/`, plan files and the PRD table in `plans/backlog.md` only.
- **Pure modules decide, scripts act.** The registry parser, the worked-out state and the asks store are `.mjs` modules handed their facts; `backlog.mjs` and `prd.sh` call them.
- **The registry** is the PRD table: columns `PRD`, `Flags`, `After`, `Hot files`, `Doc and notes`. Flags: `hold`, `done`, `standing`, `alone`, or `—`. `After`: topics. `Hot files`: repo path prefixes. Row order is the priority. All writes go through `pnpm backlog prd`.
- **A topic's state is worked out, never stored:** `hold` or `done` from the flag; `running` when a `prd/<topic>` worktree exists; `planned` when `plans/<topic>-plan.md` is on `dev` (a `standing` topic only while it has triaged items); else `to-write`.
- **Session records:** `.loops/.sessions/<name>.json` (`pid`, `kind`, `topic`, `started`, `command`, `auto`, `ended`, `exit`), written by `session.sh`, kept after the session exits, removed by `rm.sh` with the worktree. Names stay `prd-<topic>` and `plan-<topic>`. Nothing is written inside a worktree (an untracked file there blocks `land` and `rm`).
- **Asks:** `.loops/.asks/<id>.json`, machine-local, created exclusively. Ids are `a<n>`.
- **Fix topics:** `fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`. An item's category is its `prd` field. No order of priority between them is decided: nothing in this plan may assume one.
- **Tests never start a real `claude`** or open a tab: `CARETOOK_CLAUDE_BIN` names a stub, and `CARETOOK_ITERM_APP` points nowhere so the opener prints its command.
- **Loops never edit AGENTS.md, `docs/` or the backlog files.** The orchestrator folds the docs at each landing and does the backlog steps (below).

## How to run this plan

- **Waves:** (1, 2, 3) → (4, 5) → 6. Land each wave through its PR as it goes green.
- **Gates:** every slice is tooling, so the check gate needs no app check: run the tooling tests (`pnpm test:tooling`) and prettier on the changed files. No browser checks.
- **Shared files:** wave 1: slice 1 owns `scripts/backlog/`, slice 2 `session.sh`, `open-session.*`, `queue.sh` and `prd.sh`'s `start`, `open` and `plan` commands, slice 3 the asks files. Wave 2: slice 4 owns the rotate scripts, `rm.sh` and `prompt.sh`'s shared orchestrator bullets; slice 5 the `--auto` block, the plan and backlog prompts and the status listing. Merge 4 before 5. Every slice that adds a command adds it at the end of its group in `prd.sh`'s usage.
- **Migrating the table (the orchestrator, once, after wave 1 lands):** the backlog tool writes `dev` in the main checkout, so no slice can do it. Run `pnpm backlog prd migrate`, check `pnpm backlog prd list` and `pnpm backlog doctor`, add the `orchestration-3` row (`after=orchestration-2`, B-392), then tell the running orchestrators and planners at their next wave boundary that the table is edited only with `pnpm backlog prd`. Until the migration, `prd list` says to run it and every other backlog command works as before.
- **The split (the orchestrator, once, after wave 3 lands):** slice 6's _The split_ lists the steps and the category of each waiting item. Report it through `pnpm prd ask --report` (or to the user directly), naming the five topics and that their order is the user's to set.
- **Trying it:** this PRD's own orchestrator rotates after wave 2 lands (the first real drain-then-rotate); if it was queued, its wave-2 and wave-3 reports go through `pnpm prd ask`.
- **Docs at landing (the orchestrator).** `docs/orchestration.md` is over its budget and `docs/agents/orchestrator.md` is about 550 bytes under, so wave 1 first **moves** the orchestrator handbook's _Worktrees and leases_ section to a new `docs/agents/machinery.md` (with an _Area index_ entry: about 40 of the core's 340 spare bytes), and sessions and asks go there too.
  - Wave 1: `docs/agents/machinery.md` (sessions, asks), `docs/agents/backlog.md` (the registry, `pnpm backlog prd`, row order as priority, the worked-out states), `docs/orchestration.md` (asks; trim more than it adds).
  - Wave 2: `orchestrator.md` (drain, then rotate; run-through sessions ask with `pnpm prd ask` and push; `done` is set by `pnpm prd rm`), `planner.md` (the row through `pnpm backlog prd`).
  - Wave 3: `planner.md` (_The plan's shape_: the two fixes bullets become the five topics, the category rule and `plans/fixes-rules.md`), `backlog.md` (triage by category), AGENTS.md (_Working rules_: "a PRD or `quick-fixes` slice" becomes "a PRD or fixes slice"), `docs/orchestration.md` where it names `quick-fixes`.

---

## Slice 1: The PRD registry

Stack: no · Reads: docs/agents/backlog.md · Tests: unit

**Backlog:** B-389. **User stories:** 1, 2, 3, 4, 5.

**What to build**

- A pure module in `scripts/backlog/` that parses the `## PRDs` table into rows (`topic`, `flags`, `after`, `hot`, `notes`) and writes it back, keeping row order. It recognises today's four-column prose table and reports "not migrated" for it.
- A pure `stateOf(row, facts)` with the rule in _Architectural decisions_; `facts` are the plan files on `dev`, the `prd/` worktrees and the count of triaged items per topic.
- `pnpm backlog prd list [--json]` (rows with their state), `prd add <topic>`, `prd set <topic> flags=… after=… hot=… notes=…`, `prd move <topic> --first|--last|--before <topic>|--after <topic>`. Each write is one locked backlog commit with the tool's trailer.
- `pnpm backlog prd migrate`: rewrites today's table, and says "already migrated" after that. Finished rows get `done` (`hosting` and `marketing` too, their leftover items named in the notes); `hold` for `documents`, `encryption` and `assistant-2`; `alone` for `i18n`; `standing` for `quick-fixes`. A dependency on a whole topic goes to `After`; a slice-level one stays in the notes. Every hot file the prose names becomes a path prefix you verified exists; list in the hand-off any you couldn't resolve. Order: topics with a PRD worktree, then those with a plan, then those to write in the order the table has them, then holds, then done.
- `doctor`: an `After` topic with no row, a cycle, a topic with waiting items and no row, a waiting item whose topic is `done`, an unknown flag, a hot-file prefix that doesn't exist.

**Acceptance criteria**

- [ ] Unit tests: a round trip of a migrated fixture; each command; `move` in all four forms; `stateOf` for every state and for `standing` with and without items; each doctor finding.
- [ ] The migration, run on a copy of `dev`'s table, leaves `doctor` with no registry finding it could have fixed; the hand-off shows the resulting `prd list`, the unresolved hot files and any finding left.
- [ ] `pnpm backlog list`, the summary table and every existing backlog test are unchanged.

**Blocked by:** nothing. **Blocks:** 4, 5, 6.

## Slice 2: Recorded sessions

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/recovery.md · Tests: unit

**User stories:** 8, 9, 10.

**What to build**

- `scripts/loops/session.sh <name> [--kind prd|plan] [--topic <t>] [--auto] -- <claude args…>`: runs `${CARETOOK_CLAUDE_BIN:-claude}` as a child, writes the record at start, adds `ended` and `exit` when it exits, passes the exit code on.
- A pure helper that reads the records and says which are live (the pid exists and is that session's: compare the recorded start with the process's).
- `open-session.mjs` wraps the command it chooses in `session.sh` and carries a record's `auto` over to the new one; `pnpm prd start`'s printed command, `queue.sh` and `prd.sh plan --open` start through it too.
- The opener gains `--background`: a new tab without activating iTerm2, writing to the tab it created (not "current session of current window").
- `pnpm prd end [<name>]`: ends the recorded session of this worktree (for a session's own last step); `rm.sh` removes the worktree's record.

**Acceptance criteria**

- [ ] Tooling tests with a stub `claude`: the record at start and after exit; liveness for a live, an ended and a reused pid; `end`; `rm.sh` removes the record.
- [ ] The existing `open-session` and prompt tests pass with the wrapper in the command; a test shows `auto` carried over.
- [ ] The hand-off shows a tab opened with `--background` while another app was in front (or says it couldn't be tried).

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
- [ ] The commands are in `pnpm prd help`.

**Blocked by:** nothing. **Blocks:** 5.

## Slice 4: Rotation

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/recovery.md · Tests: unit

**Backlog:** B-390. **User stories:** 6, 7, 8.

**What to build**

- `scripts/loops/rotate-into.sh <name>`: ends the recorded session (TERM; KILL after `CARETOOK_ROTATE_WAIT`, default 20 seconds), waits for the pid to go, then `exec`s `session.sh` with `prompt.sh orchestrator <topic> --resume` (plus `--auto` when the record or _Status_ says run-through): always fresh, never `--continue`, the same name.
- `pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`: the topic defaults to the worktree's. Refuses when `plans/<topic>-plan.md` has uncommitted changes, when the topic has no session record, or when slice worktrees of the topic exist and `--mid-wave` wasn't given. Then opens `rotate-into.sh` in a background tab (slice 2's opener) and returns at once, so the calling session can say its last line. Without iTerm2 it prints the command for the user to run and ends nothing.
- `prompt.sh orchestrator` (the shared bullets, so every orchestrator): after a landing and its docs, start no new slice; when the slices in flight are merged, commit _Status_ and run `pnpm prd rotate`; with none in flight, rotate at once. `--mid-wave` only on the user's word. After the last landing: `pnpm prd rm`, then `pnpm prd end`.
- `rm.sh`: removing a PRD worktree whose branch is merged and whose plan _Status_ has no slice left to run sets the `done` flag (`pnpm backlog prd set`), except for a `standing` topic; it says what it did. Before the table is migrated it skips this.

**Acceptance criteria**

- [ ] Tooling tests with a stub `claude`: `rotate` prints the `rotate-into.sh` command when there is no iTerm2; running that command ends the stub, starts the fresh resume prompt under the same name, and `--auto` follows the record; a stub that ignores TERM is killed after the wait; the three refusals; `rm.sh` sets `done` only in the case above.
- [ ] The orchestrator prompt's tests show the drain-then-rotate line with and without `--auto`.
- [ ] **The hand-off shows one real rotation**: a throwaway interactive session in a scratch worktree runs `pnpm prd rotate` from its own shell; the new tab ends it and the fresh session starts. If it can't be shown, say exactly what happened: the orchestrator decides with the user before wave 2 lands.

**Blocked by:** 1, 2. **Blocks:** 5 (merge order only).

## Slice 5: Run-through prompts, the planner's row and status

Stack: no · Reads: docs/agents/planner.md, docs/agents/orchestrator.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-391. **User stories:** 2, 11, 12, 13, 14, 15, 16, 17.

**What to build**

- `prompt.sh orchestrator <topic> --auto` (the `--auto` block only): a real question goes through `pnpm prd ask`, followed at once by a PushNotification with the line `ask` printed, then `pnpm prd ask --wait <id>` in the background while the session carries on with whatever doesn't depend on it; never AskUserQuestion. Each landing files a report (the `pnpm prd ready` summary, the link, what to try by hand) and pushes it; other reports are pushed only when something failed. An answer the user gives in the session itself is recorded with `pnpm prd answer`.
- `prompt.sh plan`: the topic's row is added and set with `pnpm backlog prd add` and `prd set … after=… hot=…` (path prefixes), never a hand edit and `pnpm backlog commit`.
- `prompt.sh backlog`: the overview reads `pnpm prd asks` and `pnpm backlog prd list`, and names what waits on the user first.
- `pnpm prd status`: each recorded session (name, live or ended, age, run-through or not) and the open asks (the count and the oldest, with its age).

**Acceptance criteria**

- [ ] Prompt tests: the `--auto` prompt names `pnpm prd ask`, PushNotification and `--wait`, and not AskUserQuestion; the plain orchestrator prompt differs from before only by slice 4's lines; the planner prompt names `pnpm backlog prd`; the backlog prompt names both new sources.
- [ ] A tooling test: `status` prints the sessions and asks parts from a temporary `.loops`, and prints neither heading when there are none.

**Blocked by:** 1, 2, 3; merges after 4. **Blocks:** 6.

## Slice 6: Fix categories

Stack: no · Reads: docs/agents/planner.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-395. **User stories:** 18, 19, 20.

**What to build**

- `plans/fixes-rules.md`: the rules every fix slice follows, moved from the `quick-fixes` plan's _Writing and running new slices_ (which keeps one line pointing to it), plus: one slice and one backlog item per fix; the orchestrator appends a slice per waiting item at a wave boundary; each fix slice's `Reads` names this file; the category rule and its tie-break (the PRD, _Fix categories_).
- Five plan files, `plans/fixes-ui-plan.md`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`: a title, one line saying what belongs here and that there is no PRD, a link to the rules, and an empty _Status_ table (`Slice`, `Item`, `State`, `Merge`).
- `prompt.sh`: the backlog session's and the orchestrator's triage lines name the five topics and the rule (a small fix is `prd=fixes-<cat>`, never `quick-fixes`); an orchestrator whose topic starts with `fixes-` is told to append a slice per waiting item before its first wave and that its plan is the whole spec. The comment at `prompt.sh`'s no-PRD branch names the fix topics.
- A test that the five plan files and the rules file exist and that each plan's _Status_ parses (so a rename is caught).

**The split (the orchestrator, after this slice has landed)**

1. `pnpm backlog prd add` the five topics with `flags=standing`, placed where `quick-fixes` sits, in this order (the item's own listing, **not a priority**): `fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`.
2. Move every `quick-fixes` item that is `triaged` and unclaimed to its topic, with a note "category: <cat> (orchestration-2 split)". Items filed after 2026-11-21 get a category by the rule. The planner's proposal for those waiting on 2026-11-21:

| Topic           | Items                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `fixes-ui`      | B-229, B-231, B-256, B-316, B-319, B-325                                    |
| `fixes-tooling` | B-381, B-388, B-394                                                         |
| `fixes-perf`    | B-311, B-313                                                                |
| `fixes-bug`     | B-310, B-312, B-314, B-315, B-317, B-318, B-320, B-321, B-322, B-323, B-324 |
| `fixes-nit`     | B-326, B-379, B-380                                                         |

3. `pnpm backlog prd set quick-fixes flags=—`, so that `pnpm prd rm quick-fixes` marks it done once its claimed items have landed. If no `prd/quick-fixes` worktree is left, set `flags=done` now.
4. `pnpm backlog doctor`; then report the five topics, where each item went and that the order between them is the user's to set.

**Acceptance criteria**

- [ ] The test above; prompt tests: the backlog and orchestrator prompts name the five topics and not "`prd=quick-fixes`"; a `fixes-` orchestrator prompt has the append line and the no-PRD wording.
- [ ] `plans/quick-fixes-plan.md` changes only in its rules section.
- [ ] No script names a category order.

**Blocked by:** 1, 5 (the same prompt lines). **Blocks:** nothing.
