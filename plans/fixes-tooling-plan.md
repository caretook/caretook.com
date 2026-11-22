# Plan: Fixes (tooling)

Small tooling fixes: scripts, checks, tests and flakes. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-tooling`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**Wave 1 (2026-11-22): slices 1–8, all on opus.** 56 items wait; this wave takes eight that stay clear of the running topics' hot files (agent-autonomy: most of `scripts/loops/` incl. `lib.sh`, `land*`, `codex-review*`, `prompt.sh`, `prd.sh`, `dispatch*`, `lease*`; test-health: `vitest.config.ts`, `eslint.config.js`, `scripts/eslint/`, `apps/web/test/`). Later waves: the review/codex/land/lib.sh/dispatcher items once agent-autonomy lands; the rest of the load flakes.

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need Node 24 first on PATH (`$HOME/.nvm/versions/node/v24.*/bin`).

| Slice | Item  | State                                                                                     | Merge    |
| ----- | ----- | ----------------------------------------------------------------------------------------- | -------- |
| 1     | B-381 | merged (quick passed on slice)                                                            | 3df76253 |
| 2     | B-394 | merged (quick passed; 20 s timeout kept, see note)                                        | 26e83fa4 |
| 3     | B-411 | merged (tooling: rotate.test 20 s timeout at load 126, passes alone)                      | 7ccc8ff8 |
| 4     | B-440 | started (opus agent)                                                                      |          |
| 5     | B-441 | started (opus agent)                                                                      |          |
| 6     | B-458 | handed off 5418eb80 (tooling: tidy-cli/rotate/browser.test failed under load, pass alone) |          |
| 7     | B-475 | handed off fd4f9f27 (test race, not a timer; Undo catch filed for fixes-bug)              |          |
| 8     | B-484 | started (opus agent)                                                                      |          |

## Wave 1

Each item's backlog notes (`pnpm backlog show B-<n>`) carry the details. For a flake, **first show the cause** (a test that fails deterministically, or a reasoned reading of the race) and fix that cause; a longer timeout alone is acceptable only when the work is genuinely large and the hand-off says so. Never touch `vitest.config.ts`, `eslint.config.js`, `scripts/eslint/` or `apps/web/test/` (test-health's hot files), nor `scripts/loops/lib.sh`, `land*`, `prompt.sh`, `prd.sh`, `dispatch*`, `lease*`, `codex-review*` (agent-autonomy's).

### Slice 1: the connector privacy test asserts on fields, not a substring (B-381)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md · Tests: integration

`packages/api/src/connectors/readTools.int.test.ts` 'nothing private leaves' fails when a random UUID contains the birth year (e.g. `…072194195bed` matches `1941`).

- The test checks that no private value (the birth date and the other private values it guards) appears among the output's field values, not by a substring search over the whole serialized output; it still fails if a private value leaks.
- Integration test: the rewritten assertion; show in the hand-off that a leaked private value still fails it and a UUID containing the year doesn't.

### Slice 2: the list_timeline connector test survives load (B-394)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md · Tests: integration

`packages/api/src/connectors/mcp.int.test.ts` 'list_timeline: … paged at 50' times out at Vitest's 5 s default under load.

- Make the test's world cheaper (bulk insert the 50+ entries rather than one service call each, while still crossing the page boundary) so it runs well under the limit; an explicit per-test timeout only if the work still needs it, with a comment saying why.
- Integration test: the same assertions as today, faster (before/after time in the hand-off).

### Slice 3: a session's end is recorded only by its own wrapper (B-411)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/session.sh` writes `ended` and `exit` unconditionally when its session exits, so a second session opened under the same name gets marked ended when the first exits.

- At exit, `session.sh` records the end only when the record's `pid` is still its own (a compare-and-set in `sessions.mjs`, e.g. a `--if-pid <pid>` guard that no-ops when the pid differs); otherwise it leaves the record and says so on stderr.
- Unit test (`sessions.test.mjs`): ending with a stale pid leaves the newer record live; ending with the matching pid marks it ended.

### Slice 4: tidy keeps a topic's database whose name ends -w<n> (B-440)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`pnpm prd tidy --yes`: the worker-copy label from `test-db.sh list` overrides the known owner, so a database for a topic ending `-w1`..`-w16` reads as an orphan worker copy and is dropped (`tidy-cli.mjs` ~158).

- Match database names against known worktree bases (and their worker names) first; only a name matching no known owner can be an orphan worker copy. Keep the logic in `tidy.mjs` (pure) where it can be.
- Unit test (`tidy.test.mjs`): a live topic `foo-w2` keeps its database and its workers' copies; a worker copy of a gone topic is still an orphan.

### Slice 5: tidy treats a failed lsof as unknown, not idle (B-441)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`pnpm prd tidy`: a missing or failing `lsof` reads as "no process in any worktree" (`tidy-cli.mjs` ~52), so `--yes` can remove an active one.

- An unavailable or failed process inspection is "unknown": tidy keeps every worktree it would have removed for being idle, and says why. lsof's "nothing found" exit still means none.
- Unit test: an inspection that fails keeps worktrees and reports it; an empty successful one still allows removal.
- Slice 4 also edits `tidy-cli.mjs`/`tidy.mjs`: keep the change local to the process inspection.

### Slice 6: backlog set and note can change archived items (B-458)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/backlog.md · Tests: unit

`pnpm backlog set` and `note` refuse an archived item ("is archived; it can't be changed here"), so hygiene fixes to B-206, B-208, B-88, B-222 can't be made.

- Add an `--archived` flag to `set` and `note` that changes an archived item in place, keeping it archived; without the flag the refusal stays and names the flag. Document it in the script's help.
- Unit test: `set --archived` and `note --archived` change an archived item and leave it archived; without the flag they still refuse.
- Don't apply the B-206/B-208/B-88/B-222 changes themselves (the orchestrator does after landing).

### Slice 7: the undo timer no longer fires after a test's database closes (B-475)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md, docs/domain/components.md · Tests: component

`timelineSimpleTodos` 'a viewer… done-only change' leaves an undo timer (`useTodoTick` → `reopenTodo` → `liveTodo`) that fires after the test's database closes: Unhandled Rejection 'Client has already been closed'.

- The pending undo timeout is cleared on unmount (an unmounted screen shouldn't write later), not a harness change (`apps/web/test/` is another topic's).
- Component test: unmounting with an undo pending runs no write afterwards (timers advanced past the undo window, no rejection).

### Slice 8: the staff banner test doesn't race its 2 s window (B-484)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/admin.md, docs/domain/components.md · Tests: component

`apps/web/app/routes/app/layout/staff.browser.test.tsx` 'offline, the cached banner shows; it goes at its end time without a reload' sets `endsAt` to now + 2 s, so a render over 2 s sees the banner already gone.

- Drive the end time with a controlled clock (fake timers for the end-time timer only, never a stepped `Date`), or set `endsAt` from after the first render is confirmed, so render time can't eat the window.
- Component test: the banner shows, then goes at its end time, independent of render duration.
