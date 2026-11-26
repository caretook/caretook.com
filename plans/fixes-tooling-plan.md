# Plan: Fixes (tooling)

Small tooling fixes: scripts, checks, tests and flakes. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-tooling`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**History:** earlier hand-offs and landed waves' rows are in [`plans/fixes-tooling-history.md`](fixes-tooling-history.md) (`pnpm prd status-trim`).

**Wave 8 (2026-11-26, run-through; resumed after the wave 7 rotation).** Reconciled: no landing cut off, no slices in flight; `prd sync` needed no merge. Slices 61–68 written (landing, Codex, cleanup: B-239, B-240, B-244, B-867, B-442, B-443, B-447, B-639, B-649, B-738, B-545), items claimed, hot files set. Running about 5 at once (wave 7's lesson): first 61, 63, 64, 66, 67 (all opus); then 62, 65 (opus) and 68 (sonnet). 65 waits for 66 (both `land.sh`).

- **Resumed 2026-11-26 (new session):** no landing journal; all 61–68 merged, tip aa853dcc; gate run 2 green (aa853dcc, run 45808562744). `prd sync` merged dev (a5a1895c); full CI on the synced tip out; PR #216 open; Codex out of credits (exit 4): land `--no-review`. Synced-tip run 45809807786 braked on the build budget (app 406448 B over the old 406187 ceiling: the first sync missed dev's raise 1315ffa6, B-868); `sync --force` merged it (25a4f066), full CI rerun out.
- **Hand-over (rotating at the context limit, 161k):** all slices 61–68 merged; tip b3f78e46. Next: `pnpm prd ci run full --wait` (gate run 2, tier full for `scripts/ci/ci-gate.mjs`); on `file`, `pnpm prd ci blame` (expected dev's: the search rebuild timing test on the brake list; boundary should now pass) and send a branch failure to a `--continue` agent in that slice's worktree. Then the landing steps: `pnpm prd sync`, `pnpm test:tooling` if it merged, `pnpm prd pr fixes-tooling`, `pnpm prd review fixes-tooling --wait` (exit 4: `--no-review`), `pnpm prd ready`, land `--tier full`, report, `pnpm prd rm fixes-tooling-<n>` for 61–68, fold the docs (doc lines below), status-trim, rotate.
- **Doc lines for the landing:** orchestrator.md _The check gate_ _What counts_ (slice 67): an ancestor verdict carries only when it's green or a flake outside the branch's files; a failing one asks for a fresh run on the tip. _Landing a wave_ step 4 (slice 62): `--resolve` each declined or current thread; an outdated one stops blocking once Codex's state on the head says `has_unresolved_findings: false`. `--force` rules (slice 66): a skeptic's `--force` refuses when dev's brake state can't be read (GitHub, the origin/dev fetch, the board); `--by-user` is the way through; the brake is read on origin/dev's tip too. Machinery, leases (63, 64): `name` is linked in from a per-writer temp file, a losing taker backs off; a takeover skips a lease that vanished mid-read; the `write:<marker>` test hook; tidy removes a dead lease only through `lease_take_over`. Machinery, landing reports (65): a docs-and-tooling-only landing's _What to try_ lists commands, not the dev URL. review.sh's `REVIEW_TAKE_UP` (61). B-824's quarantine line can go now that B-867 is in (slice 63).
- **Slice 65 fix merged** (7ac4318d): boundary ok. **Gate run 1:** full on 992169b6 (run 45805573421): `file`. boundary.test.mjs fails on the branch too: slice 65's to-test tests add two `apps/web/` paths (land.test.mjs app-path 24 against 22); fix request sent to slice 65. The search rebuild timing test is on the brake list (dev's, B-619/B-839). B-865/B-866 (the branch-prefixes test naming `$CARETOOK_INBOX_DIR`, from wave 7) fixed in d2133f4e. `land-gate.test.mjs`'s dev-brake test timed out under load ~60 in two slice checks (passes alone): file it if CI shows it.
- **Waiting triaged items for later waves:** B-375, B-431, B-432, B-459, B-465, B-477, B-608, B-609, B-619, B-653, B-660, B-667, B-681, B-720, B-721, B-722, B-749, B-751, B-753, B-757, B-776, B-778, B-780, B-782, B-785, B-790, B-791, B-802, B-808, B-809, B-810, B-813, B-839, B-845, B-851, B-852, B-862, B-864 (their `This item: wave` notes are from the 2026-11-23 numbering; ignore the number).
- **Follow-ups for later:** B-542's cap is 4 (a half-the-cores proposal is noted on the item). The quarantine lines for B-633 and B-769 can go once `pnpm prd ci` drops them; B-824's once slice 63 (B-867) lands.

**Later waves:** each item's notes carry its wave (`This item: wave <n>`). Run full checks on a quiet machine, under `caffeinate -i`; wait on a check with `pnpm prd wait check`; confirm any failure alone 3x before calling it a flake.

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need Node 24 first on PATH (`$HOME/.nvm/versions/node/v24.*/bin`).

| Slice | Item         | State                        | Merge    |
| ----- | ------------ | ---------------------------- | -------- |
| 61    | B-239, B-240 | merged (opus)                | 1699763a |
| 62    | B-244        | merged (opus)                | 35e43036 |
| 63    | B-867        | merged (opus)                | 69bcc9c1 |
| 64    | B-442        | merged (opus)                | 3c48b294 |
| 65    | B-443, B-447 | merged (opus)                | ee34a22e |
| 66    | B-639, B-649 | merged (opus), in 65's merge | ee34a22e |
| 67    | B-738        | merged (opus)                | a6ade197 |
| 68    | B-545        | merged (sonnet)              | 7b608d23 |

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

## Wave 2

Same rules as wave 1: for a flake, **first show the cause**, then fix it; a longer timeout alone only when the work is genuinely large and the hand-off says so. Never touch a running topic's hot files (`pnpm backlog prd list`: ui-kit-3's `components/ui/`, `lib/app-shell/`; sync-safety's `packages/api/src/sync`, `apps/web/app/lib/sync/`, `packages/data/src/services/`). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain and the orchestrator folds it in.

### Slice 9: tooling-only landings still lint what they change (B-451)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md, docs/agents/machinery.md · Tests: unit

The check gate's "none needed" (every changed file is Markdown, `scripts/loops/`, `scripts/backlog/` or `.githooks/`) runs no eslint, so a lint error in a tooling `.mjs` reached dev (B-451's note).

- `pnpm test:tooling` (or the step the gate requires for "none needed") also runs eslint and prettier on the changed tooling files (`dev...HEAD`), and fails on an error; keep it fast (only the changed files).
- Unit test: the planner (`check-plan.mjs` or its neighbour) puts the lint step on a tooling-only diff and leaves it off a Markdown-only one.
- Slice 12 edits `lib.sh`'s `docs_only`: keep this change out of that function.

### Slice 10: a wait on the check lease that ends (B-445)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/loop.md, docs/agents/machinery.md · Tests: unit

Agents wait on checks with `until ! pgrep -f "prd check"`, which never exits (it matches its own shell and any session whose prompt mentions the command).

- Add a command that blocks until this worktree's check (or a named lease kind's holder for this worktree) is gone, with a timeout and exit 75 on it, e.g. `pnpm prd wait check [--timeout S]`, built on `lease.sh holders`; list it in `pnpm prd help`.
- Point the slice and orchestrator prompts (`prompt.sh`'s text) at it wherever they tell an agent to wait on a check, and say "never `pgrep -f`". The hand-off names the doc line for loop.md.
- Unit test: the wait returns once the lease is released, and exits 75 at its timeout while it's held.

### Slice 11: tooling tests don't wait on the real load gate (B-534)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

Tooling tests that run `new.sh` without `CARETOOK_LOAD_GATE=off` poll the real machine's load (15 s, up to 600 s) and time out under load.

- Every tooling test env that runs `new.sh` (or anything that gates on load) sets `CARETOOK_LOAD_GATE=off`; prefer one shared test-env helper over per-file lines. Find them all (grep), list them in the hand-off.
- Look at `registry.cli.test.mjs` 'doctor reports…' and `rotate.test.mjs` 'sets done only for a merged branch…' (20 s timeouts once under load): show the cause and fix it, or say why the time is genuine.
- Unit test: a test asserting the gate is off in the shared env (or that `new.sh` under it doesn't poll).

### Slice 12: a code file renamed to .md isn't docs only (B-444)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md · Tests: unit

`docs_only` in `lib.sh` uses `git diff --name-only`, which shows only a rename's destination, so a `.sh`→`.md` rename counts as docs only.

- Use `--no-renames` (both sides listed) in `docs_only` and the other name-only diffs in `lib.sh` that decide a gate (the exempt check at ~136); keep each change to the diff flags.
- Unit test (the tooling test that covers `docs_only`): a rename from `.sh` to `.md` is not docs only; a Markdown-only change still is.

### Slice 13: worker databases live in their own namespace (B-405)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

Worker copies are `<base cut to 59>_w<n>`: two long topics share copies, and worktree `foo`'s worker 1 is the base database of a worktree `foo-w1`.

- Give worker copies a name no worktree base can produce and that keeps a short hash of the full base when shortened (within Postgres's 63 bytes); update `testDatabase.ts` (`isOwnDatabase`), `globalSetup.ts`, `test-db.sh` (`list`, `drop`) and tidy's matching (`tidy.mjs`) together. Old-style copies left on the shared Postgres are still recognised by tidy as orphans (or dropped once); say which.
- Unit tests (`testDatabase.test.ts`, `tidy.test.mjs`): two long bases get distinct worker names; `foo`'s worker can't equal `foo-w1`'s base; a worker of a gone topic is still an orphan.

### Slice 14: the connector integration tests survive 'Connection terminated' (B-388)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/data-layer.md · Tests: integration

`mcpWrites`, `mcp`, `readTools` `.int.test.ts` and `todoRename.int.test.ts` fail under load with 'Connection terminated' (passes alone).

- First find the cause from the code (pool settings, idle or connect timeouts, a client closed while a request is in flight, a test ending before the server's work does, Postgres `max_connections` with 16 workers) and show it, ideally by reproducing it (e.g. a constrained pool or a deliberate slow query). Fix that cause in the test harness or the pool config the tests use (not `vitest.config.ts` without saying why).
- Integration test: the reproduction passes after the fix; the hand-off shows before/after.

### Slice 15: roles.int.test.ts's summary query is fast (B-450)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/data-layer.md · Tests: integration

`rolesSummary` (`packages/data/src/db/roles/applyRoles.ts`) runs a correlated `NOT EXISTS` between `information_schema.column_privileges` and `role_table_grants` (~2.2 s per role), past the 10 s hook timeout; fixes-bug put a 60 s stopgap in the test.

- Rewrite the summary on `pg_catalog` (or without the correlation) so it returns the same result well under a second per role; then remove the 60 s stopgap if the test runs well inside the defaults.
- Integration test: the same assertions, with before/after times in the hand-off; any `db:roles`/`db:access` output that uses the summary is unchanged.

### Slice 16: resetStaging's test is fast under load (B-466)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/data-layer.md, ops/runbook.md · Tests: integration

`resetStaging.int.test.ts` 'wipes everything but real sign-ins, reseeds' times out at 30 s under load (3–10 s alone).

- Find where the time goes (time the wipe and each seed step) and cut it: a lighter world for the test (a small seed through the same reset path), batching, or one transaction; the reset's behaviour on staging doesn't change.
- Integration test: the same assertions, well under the limit (before/after in the hand-off).

## Wave 3

The user's wave order (2026-11-23): 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. Same rules as waves 1 and 2. Never touch a running topic's hot files (`pnpm backlog prd list`: inbox-agent's `scripts/backlog/`, `scripts/loops/lib.sh`, `prd.sh`, `prompt.sh`, `dispatch*`, `tidy*`, `queue*`, `session*`, `rotate*`; sync-safety's sync paths). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain.

### Slice 17: open-session.sh opens a tab when iTerm2 has no current window (B-468)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/open-session.sh` (~79) takes `current window` when `(count of windows) > 0`; with iTerm2 hidden, minimised or without a key window that is `missing value`, and osascript exits 1 ("Can't get current tab of missing value (-1728)").

- When `current window` is missing value, fall back to the first window, or create a window when there is none usable; the tab then opens as usual. Keep the change inside the AppleScript and its shell wrapper.
- The dispatcher tells "the tab never opened" (the opener exited non-zero) from "the session died": an open failure adds no reopen count, leaves no worktree that blocks other planners or starts, logs one line and retries at a later tick (`dispatch.mjs`; inbox-agent confirmed 2026-11-24 its last slice leaves it alone).
- Unit tests: the generated AppleScript handles a missing current window (falls back, never addresses `current tab of missing value`); a dispatcher tick whose opener fails records no death and no reopen.
- Slices 20–22 also edit `dispatch.mjs`: keep this change to the open path.

### Slice 18: an ask lock's takeover is atomic (B-525)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`withAskLock` (`scripts/loops/asks.mjs` ~227–261): two processes that both see a dead holder's lock as stale both `rmSync` it, so one can delete the other's fresh lock, and an answer and a default overlap.

- Take over a stale lock atomically: rename-then-verify, or a short takeover mutex like `lease.sh`'s `.takeover`, so only one taker wins and a fresh lock is never removed. A live holder's lock is never removed.
- Unit test (`asks.test.mjs`): two takers racing over one stale lock end with exactly one holder, and a lock taken fresh after the stale check is not deleted (drive the interleaving deterministically, e.g. by a hook between the stale check and the removal).

### Slice 19: notice ids never go back (B-526)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`createNotice` (`scripts/loops/notices.mjs` ~109–152): the `.seq` high-water mark is updated check-then-rename, so two concurrent posts can lower it; once both notices expire an id is reused, and a late `notices --done` withdraws a newer notice.

- Serialise the seq update (a lock) or raise it so it can only move up (e.g. re-read and retry until the stored value is at least n), so an id is never handed out twice.
- Unit test (`notices.test.mjs`): the n1/n2 interleaving Codex reproduced (the lower write landing last) leaves `.seq` at the higher id, and a later post gets a new id.

### Slice 20: a failed new.sh in a dispatcher start leaves no orphan worktree (B-452)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`dispatch.mjs` (~408): `writeRecord` comes after the `new.sh` break, so a start or plan whose `new.sh` fails after making the worktree leaves it with no managed record; later ticks treat it as opened by hand and it holds a slot for good.

- Write the managed record (a setup state) before `new.sh`, or remove the partial worktree on failure; either way a failed setup frees its slot and is retried or reported, never counted as a hand-opened session.
- Unit test (`dispatch.test.mjs`): a `new.sh` that fails after creating the worktree leaves no slot held at the next tick.
- Blocked by slice 17 (both change the start path of `dispatch.mjs`); slices 21–22 edit other functions there. Slice 17 already removes a worktree `new.sh` made this tick when the opener then fails (`rm.sh <name>`, the `fresh` flag): reuse that for a failed `new.sh`.

### Slice 21: a 'hold the topic' answer is consumed only once the hold is written (B-453)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`dispatch.mjs` (~353): `updateState` deletes `asked` and `reopens` whatever the backlog write's `r.ok`, so a failed hold write lets the same tick reopen the session.

- Consume the answer and clear the count only after the hold is written; on a failed write keep both, skip the topic this tick, log one line, and retry next tick.
- Unit test: a failing hold write leaves the answer and the count, and the topic isn't reopened that tick; a succeeding one consumes them.

### Slice 22: the dispatcher lock's takeover is atomic (B-454)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`dispatch.mjs` `takeLock` (~200) unlinks a dead holder's lock from an earlier pid read, so two dispatchers starting together can both take it (Codex reproduced 6/30).

- Make the takeover atomic (rename a temp lock over it and re-read, or a mkdir lock): exactly one of two racing starters holds it. If slice 18 lands a shared helper for stale-lock takeover first, reuse it; otherwise keep it local.
- Unit test: two takers racing over a stale lock (deterministic interleaving) end with one holder; a live holder's lock is never taken.

### Slice 23: session request notices fit the notice board (B-570)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`requestNotice` in `scripts/loops/session-requests.mjs` has no length bound: with 40-character names a refusal reaches 201 characters, `createNotice` rejects it, and the requester hears nothing.

- Bound the text to the board's `MAX_TEXT`, keeping the request id and its outcome (cut the variable parts, e.g. names or the opener's error, with an ellipsis); if a post still fails, the request step logs it where the requester can see it.
- Unit test (`session-requests.test.mjs`): long names and a long opener error give a notice within `MAX_TEXT` that still carries the id and outcome.

### Slice 24: soft and hard context limits for orchestrators and the backlog session (B-600)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

Slice agents already have soft 175k / hard 300k (`context.mjs`, hotfix 86447987). Orchestrators and the backlog session still share one 160k limit (`limitOf`), and a backlog session is told to hand off unasked while the dispatcher's question (`dispatch-context.mjs`) defaults to rotating. The user (2026-11-22, 2026-11-23): orchestrators and backlog soft 160k, hard 225k; **a backlog session's limit is soft and never a forced close**: past it the session tells the user and lets them choose (hand off or keep going); no answer means keep going.

- Orchestrators: the soft reminder at 160k (judge, as slice agents do), the hard one at 225k (rotate at the next safe point, as today's text says); `CARETOOK_CONTEXT_LIMIT` keeps overriding the soft value; the dispatcher's rotation question waits for the hard limit.
- Backlog session: a soft reminder only (tell the user its size and ask, hand off or keep going); no hard hand-off; the dispatcher's question for a backlog session defaults to "leave it" (keep going), never rotating.
- Keep `pnpm prd context` and `liveSizes` output right for both limits.
- Unit tests (`context.test.mjs`, `dispatch-context.test.mjs`): the orchestrator's soft and hard thresholds; the backlog session's reminder never says to hand off unasked; the dispatcher's backlog question defaults to keep going.
- Hand-off: the lines loop.md, machinery.md and orchestrator.md should change (they state 160k).

## Wave 4

The user's order: known flakes by cause. Same rules as waves 1–3: **first show the cause** (a deterministic failure, or a reasoned reading of the race from the code), then fix that cause; a longer timeout alone only when the work is genuinely large and the hand-off says so. Never touch a running topic's hot files (`pnpm backlog prd list`: inbox-agent's `scripts/backlog/`, `lib.sh`, `prd.sh`, `prompt.sh`, `tidy*`, `queue*`, `session*`, `rotate*`, `bye*`, `dispatch*`, `keep-alive*`, `open-session*`; test-health-2's `vitest.config.ts`, `apps/web/test/`, sync paths, `sync-matrix*`; symptom-catalog's timeline paths). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain. Not in this wave: B-461/B-732 (`tidy-cli.test.mjs`, inbox-agent's hot `tidy`), B-619 (search speed: not reproduced in 24 runs; waits for CI failure messages, B-660).

### Slice 25: recover's '--at a time that has passed' test doesn't depend on the machine (B-418)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/recovery.md · Tests: unit

`scripts/loops/recover.test.mjs` (~597) '--at a time that has passed waits until tomorrow' fails in a full `pnpm test:tooling` run under load and passes alone; the assertion output was never captured.

- Find the cause from the code (`recover.sh`/`recover-lib.mjs`'s clock: the fake `CARETOOK_CLOCK_FILE`, any real `date` read, the local time zone the `--at` time is read in, the fake `sleep` and the test's timeout) and show it; fix that cause so the test passes at any load, time zone and time of day.
- Unit test: the same assertions, plus a case that pins the cause (e.g. a non-UTC `TZ`, or a real-clock read that must not happen).

### Slice 26: the browser harness tests don't count load-wait lines, and leave no process group behind (B-573, B-446, B-704)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/browser.test.mjs`: 'passes a clean spec' (~182) gets a third output line under load where it expects two (likely `browser.sh`'s `load_gate_wait` line, not confirmed); 'kills a spec at its cap, worker and all, and retries it once' failed at load 47 ("expected false to be true" after 9.7 s, real-time sleeps); and an interrupted run left its silent fixture's process group alive for days (B-704).

- Confirm what the extra line is (run the test's harness with the load gate busy) and fix the cause: the tests run `browser.sh` with the load gate off (`CARETOOK_LOAD_GATE=off`, the shared test env from B-534) or assert on the lines that matter, not a count.
- The kill test waits on the event (the process gone, the retry's marker), not on a fixed sleep; keep its deadline generous and say why.
- The fixtures' process groups are killed when a test fails, times out or the run is interrupted (an `afterEach`/`afterAll` that kills every group it started, and a fixture that can't outlive its parent, e.g. a parent-death check); show how B-704's group outlived its run.
- Unit tests: a busy load gate doesn't change the clean spec's output; the kill test passes with the machine's clock slowed (or the waits driven by events); a test that throws mid-run leaves no fixture group alive.

### Slice 27: the MCP rate-limit test survives load (B-582)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md · Tests: integration

`packages/api/src/connectors/mcp.int.test.ts` (~392) 'allows 60 calls a minute per connection, then 429 with Retry-After' times out at 5 s under load (passes alone).

- Find where the time goes (61 sequential calls through the full MCP stack, each with its database work) and cut it as B-394 did for list_timeline: a cheaper call, a cheaper world, or the limiter tested with an injected clock and count; the limiter's behaviour (60 a minute, then 429 with `Retry-After`) is still asserted end to end at least once. An explicit timeout only if the work still needs it, with a comment saying why.
- Integration test: the same assertions, with before/after times in the hand-off.

### Slice 28: the todays_doses connector test holds at any time of day (B-642)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/medications.md · Tests: integration

`packages/api/src/connectors/readTools.int.test.ts` (~372, ~385) places a given dose 10 (and 5) minutes before now, so from 00:00 to 00:10 Los Angeles it lands on yesterday and the assertion (~438) finds no given slot today.

- Run the test on a fixed clock (a fixed `now` for the handler, `handlerAt` or its equivalent, and for the entries it writes), chosen mid-day in the recipient's zone; no other test in the file changes behaviour.
- Integration test: the same assertions on the fixed clock, plus a case at 00:05 in the recipient's zone that passed only by luck before (show it failing on the old code in the hand-off).

### Slice 29: context.test.mjs '--all --json lists live sessions only' is not load-sensitive (B-723)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/context.test.mjs` '--all --json lists live sessions only' failed its first-row size assertion (~388) in a quick check at load about 25; passed 3/3 alone; the value wasn't captured.

- Read the test and `context.mjs`'s `--all --json` path for what can change the first row's size or order under load (a real clock, mtime ordering, a transcript still being written, a real session record leaking in from the machine) and show the cause; fix it so the row and its size are deterministic.
- Unit test: the same assertion, plus one that pins the cause (e.g. equal mtimes, or a live machine record that must not appear).

### Slice 30: lease.test.mjs's 'beyond the default limit of two' doesn't race (B-654)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/lease.test.mjs` (~263) 'makes the runs beyond the default limit of two wait, and holders shows who holds what' flaked in CI (passed on its rerun; ci-key ab40db666b8d).

- Find the race from the code (holders started in parallel and checked before they hold, a real-time wait, the load gate, `lease.sh`'s poll interval) and show it; the test waits on each holder's state (a marker or `holders` output), never on a fixed sleep.
- Unit test: the same assertions, deterministic under a slowed holder (e.g. a holder delayed before it takes the lease).

## Wave 5

The user's order: re-measure test flakes. Slice 31 re-measures the old under-load flakes after the harness fix B-607 (settle can return before the page mounts, landed by test-gates as fe82288c) and proposes closing what no longer fails; only what still fails gets a fix slice, in this wave's second half. Slices 32–38 fix flakes and races whose cause is already known or readable from the code, in files that inbox-agent no longer holds. Same rules as wave 4: **first show the cause**, then fix it; a longer timeout alone only when the work is genuinely large and the hand-off says so. Never touch a running topic's hot files (`pnpm backlog prd list`: test-health-2's `vitest.config.ts`, `apps/web/test/`, sync paths, `router.int.test.ts`, `roundtrip.spec.mjs`, `sync-matrix*`; symptom-catalog's timeline paths and `components/quick-entry/`). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain. Not in this wave: B-375 (touches `vitest.config.ts`, test-health-2's), B-667 (a seeded onboarding user: a fixture, not a flake; a later wave).

### Slice 31: re-measure the under-load flakes after B-607 (B-479, B-480, B-485, B-488, B-489, B-490, B-491, B-493, B-494, B-495, B-496, B-497, B-498, B-499, B-500, B-501, B-502, B-568, B-633, B-645, B-653, B-658, B-716, B-727, B-743)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/loop.md, docs/agents/machinery.md · Tests: none (measurement only)

Each item is a component, integration or browser-check test that failed under load and passed alone. Many may be gone since B-607 (the component harness's settle) and the tooling load fixes of waves 1–4.

- **Change no code or test.** For each item, run the test's file at check-like load: the named files together, at the Vitest project's usual workers, **at least 10 times**, while a second process keeps the machine busy (e.g. a concurrent `pnpm test:tooling` or the other files of the same project; no new dependencies). Quarantined tests (`scripts/ci/quarantine.txt`: B-568, B-633, B-645, B-653, B-658, B-743) run with `CARETOOK_QUARANTINE=run`. Record the load (`uptime`) for each round.
- B-716 (phase2) and B-727 (ui.spec) are browser checks: run `pnpm prd browser` for that one check 5 times under the same load, if the slice can take a browser lease; else say so and leave them unmeasured.
- B-479 and B-743 are the same test (calendarCron): measure once, report both.
- Hand-off: a table with Item | Test | Runs | Failures | Load | Failure message (first line) | Proposal (`close`: no failure in all runs; `fix`: failed, with the cause if the message shows it). Nothing is closed by the slice; the orchestrator files the proposals.

### Slice 32: stack.test.mjs's 'gc removes it only after a yes' holds under load (B-740)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/stack.test.mjs` 'flags a merged slice, not a fresh one, and gc removes it only after a yes' times out at 20 s at load ~60, passes alone 3/3 at load 18.

- Find where its time goes (git repos and worktrees made per test, node starts, `prd list` calls, the load gate, real sleeps) and show it; cut that cost (a shared fixture repo made once, fewer process starts, the load gate off in the test env) so it passes well inside its timeout at any load. Keep the assertions.
- Unit test: the same assertions, with before/after times in the hand-off.

### Slice 33: ask.test.mjs's countdown is read from a fixed now (B-741)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/ask.test.mjs` 'asks shows the countdown…' (~236) expects 'in 30m' and gets 'in 29m' for an ask 1 s old: the countdown rounds the real clock.

- Show the rounding race from the code (`asks` reads the real `Date.now()` after the ask is written); drive the listing from a fixed now (the clock override the ask tools already use, or one added the same way) so the countdown is exact; check the rounding the user sees (minutes up or down) is what the doc says.
- Unit test: the same assertion on a fixed clock, plus a case 1 s and 59 s past a minute boundary.

### Slice 34: lease.sh leaves no lease behind after a TERM mid-take (B-742)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/lease.sh`: a TERM between a lease's `mkdir` and the `lease_path=` assignment leaves the lease directory behind, since the trap only removes `$lease_path`.

- Close the window: set the path before the `mkdir` (the trap removes it only if this process made it, e.g. an owner file with its pid), or take the lease into a temporary name and rename; show the old order and the new in the hand-off.
- Unit test: a TERM delivered in that window (a test hook that pauses between the two steps, waited on by a marker, never a sleep) leaves no lease; the existing 'TERMed mid-check' test still passes.

### Slice 35: load-gate.test.mjs's 'the scripts that wait or warn' tests don't race (B-744, B-745, B-746, B-747)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

All four tests of `scripts/loops/load-gate.test.mjs`'s 'the scripts that wait or warn' block flaked together in one CI run (passed on the rerun); they're quarantined (`scripts/ci/quarantine.txt`).

- Find the shared cause from the code (a real load read, a real-time poll or sleep, the fake load file written while a script reads it, a shared temp dir across the block, the CI runner's own load) and show it; the tests wait on each script's state, never on a fixed sleep, and read only a fake load.
- Unit test: the four tests pass with `CARETOOK_QUARANTINE=run` 20 times in a row at load; the hand-off says whether their quarantine lines can go (the orchestrator removes them through `pnpm prd ci` when the items are done).

### Slice 36: tidy-cli.test.mjs's beforeAll holds under load (B-461, B-732)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

`scripts/loops/tidy-cli.test.mjs` 'tidy archives finished items' beforeAll times out at 10 s at load 30–40 (passes alone 12/12), after B-460 turned the load gate off in its setup.

- Measure where the beforeAll's time goes (repos, worktrees, `new.sh` runs, backlog writes, node starts) and show it; cut it (one fixture built once and copied, fewer process starts) so it stays well inside 10 s at load 40, or say why the work is genuinely large and set a timeout with a comment.
- Unit test: the same assertions, with before/after times in the hand-off.

### Slice 37: session requests raise their .seq only upward (B-731)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/session-requests.mjs` raises `.seq` check-then-rename, as `notices.mjs` did before B-526, so two concurrent requests can lower it and reuse an id.

- Apply B-526's fix (`notices.mjs`'s high-water mark as `.seq.d/` files that only move up), sharing its helper rather than copying it where that's simple; old `.seq` files still read.
- Unit test: concurrent requests never reuse an id or lower the mark (driven by a barrier, not sleeps), and an existing `.seq` is carried over.

### Slice 38: a waiting join request from an account with no current legal acceptance isn't asked again (B-638)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/care-groups.md · Tests: integration

`careGroupInviteService`'s `askWithLink` returns a waiting request before the legal check, but the test 'a waiting request isn't asked again' sends `legal: true` with a current row, so nothing pins that order.

- No code change unless the test shows a bug. Integration test in `packages/data/src/services/careGroupInvite.int.test.ts`: an account with a waiting request and no current legal acceptance asks again with the link and gets its waiting request back (no new row, no legal refusal); all data fictional.

### Slice 39: a slim, fast inbox session (B-739)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/inbox.md, docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

Added to wave 5 on the user's word (via the backlog session, 2026-11-24); inbox-agent is done, so its files are free. The goal is speed: the user talks at the phone to manage the inbox.

- **Sonnet at low effort:** the inbox session opens on Sonnet at low effort, set in the session's own settings file (`prd.sh`'s inbox default model; `--model` still overrides); fast mode stays off. It holds across `prd rotate`, a phone hand-off (`prd rotate --self`) and a keep-alive reopen, **with no dispatcher restart**: `open-session.mjs` reopens on the session's recorded model, so an old record saying opus must give way to the new default (or the rotation rewrites the record).
- **The prompt** (`prompt.sh`'s inbox prompt): only add, reword, move or remove unfiled lines on the user's word; never read the backlog, no separate `pnpm backlog similar` step before an add, no extra work. Dedupe and triage stay with ingest, the backlog session and the planner.
- **Keep `inbox add`'s look-alike stop** (exit 3, rerun with `--anyway` on the user's word); `backlog add` is unchanged.
- **New commands:** `pnpm backlog inbox edit` and `pnpm backlog inbox remove` for unfiled lines; they refuse filed lines, as `inbox move` does.
- Unit tests: a keep-alive reopen and a rotation of an inbox session recorded on opus come up on Sonnet low; `--model` still wins; the prompt names no backlog read or `similar` step; `inbox edit`/`remove` change an unfiled line and refuse a filed one; `inbox add` still stops on a look-alike.

### Slice 40: appointmentSeries.int.test.ts holds under load (B-500)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/appointments.md, docs/domain/data-layer.md · Tests: integration

Slice 31 re-measured it: 'writes visits through today + 90 for a series without them: links, documents, ids' timed out at 5 s in 6 of 42 runs, mostly at load above 80. It takes 1.3–2.7 s at load ~20 and 3.9–5.1 s at 80–100. Each test builds a full world (`createWorld` with outsider and staff, users made one by one), then writes 39 visits with their links and documents. Seven other tests in the file's `appointmentSeriesService.topUp` block also timed out once or twice in 32 runs.

- Measure where the file's time goes and cut it for the whole file: a world built once per describe where tests don't change it, only the parts a test needs, batched inserts in the fixture; keep every assertion. An explicit timeout only if the work still needs it, with a comment saying why. Don't touch the shared test fixtures test-health-2 holds (`apps/web/test/`); `packages/data` fixtures are fine.
- Integration test: the same assertions, with before/after times at load in the hand-off.

## Wave 6

The user's contents and order (via the backlog session, 2026-11-24): agent efficiency first (B-597, B-595, B-596, B-598), then the check flow (B-696), test load (B-576, B-574; B-542 waits), phone pushes (B-586), the release-age wait (B-705), and the hold flags (B-464, B-650). **Slice 41 goes first:** it splits `prompt.sh` and `ci.mjs`, which 42–46 then edit in their own parts; 47–49 run beside it. Never touch a running topic's hot files (`pnpm backlog prd list`: test-health-2's `vitest.config.ts`, `apps/web/test/`, sync paths, `router.int.test.ts`, `roundtrip.spec.mjs`, `sync-matrix*`; symptom-catalog's timeline paths). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain, and the orchestrator folds it. Not in this wave: B-542 (the unit-test worker cap lives in `vitest.config.ts`, test-health-2's; wave 7, which the user said not to run before the pause).

### Slice 41: split ci.mjs and prompt.sh so an agent reads only the part it needs (B-597)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/ci/ci.mjs` (47 KB) and `scripts/loops/prompt.sh` (51 KB) are each read whole by agents changing one part.

- **A refactor, no behaviour change.** `prompt.sh` becomes a thin dispatcher plus one file per prompt kind (orchestrator, plan, slice, the backlog/inbox/skeptic kinds, shared helpers such as `bye_line`), e.g. `scripts/loops/prompts/<kind>.sh` sourced by it; `pnpm prd prompt …` prints byte-identical text for every kind and flag. `ci.mjs` keeps its CLI and splits its subcommands into modules beside the existing `scripts/ci/*.mjs` (no file over about 15 KB); what other modules import from it stays importable.
- A header comment in each says which part lives where, so an agent can open just that file.
- Unit tests: the existing `prompt.test.mjs` and `ci.test.mjs` pass unchanged (move tests only if they follow the code); a new test compares every prompt kind's output before and after on a fixed plan (a golden file made from the pre-split script). Hand-off: the old and new file sizes, and the lines `machinery.md` should gain.

### Slice 42: slice agents read only their slice's section and the decisions it cites (B-595)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/loop.md · Tests: unit · Blocked by: 41

A slice agent's startup reads about 110 KB (the whole plan, the PRD, the role docs) while its own section is about 3 KB.

- The slice prompt (`pnpm prd prompt slice`, its part after slice 41) embeds the slice's own section of the plan and the PRD's _Decisions_ rows or sections it names, instead of telling the agent to read the whole plan and PRD; it still names the section's `Reads` docs and `loop.md`. A plan with no PRD (a fixes topic) embeds only the section and the wave's intro paragraph.
- `--continue` does the same.
- Unit tests: a slice prompt on a fixture plan holds its own section and the wave intro, not another slice's text; a cited PRD decision is embedded and an uncited one isn't. Hand-off: the startup bytes before and after for one real slice of this plan, and the lines `loop.md` should change.

### Slice 43: cap slice size at planning (B-596)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/planner.md · Tests: unit · Blocked by: 41

test-gates slice 6 touched 15 files and took three Opus agents.

- The planner prompt (and the plan skeptic's brief) gains the rule: a slice that would touch more than about 8 files, or more than one running topic's hot file, is split into slices that each land on their own.
- `pnpm prd slice`'s merge side: when a slice's branch changes more than 12 files, the orchestrator's merge line (or `pnpm prd status`) warns once, so the next planning learns from it; no refusal.
- Unit tests: the planner and plan-skeptic prompts carry the rule; the warning shows for a 13-file fixture branch and not for 8. Hand-off: the lines `planner.md` should gain.

### Slice 44: a plan's Status stays short (B-598)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md · Tests: unit · Blocked by: 41

This plan's Status is 57 KB; every fresh orchestrator reads it.

- Finished-wave history moves to `plans/<topic>-history.md`: a `pnpm prd status-trim <topic>` (or a name that fits `pnpm prd help`) moves every hand-off paragraph but the latest, and for a fixes plan the Status table's rows of slices whose wave has landed, into the history file (appended, newest first), leaving a one-line pointer. `fixes-plans.test.mjs`'s table rule keeps holding (allow the trimmed table; next slice number still comes from the highest slice in plan plus history).
- The orchestrator prompt tells it to run the trim after each landing; `pnpm docs:budget` (or the plan check) warns when a plan's Status passes about 6 KB.
- Unit tests: the trim on a fixture plan keeps the latest hand-off, the open rows and the landing mode, and moves the rest; a rerun changes nothing; the next-slice number survives a trim. Hand-off: the lines `orchestrator.md` should gain.

### Slice 45: check-plan never hangs and never reports no changes by mistake (B-696)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md · Tests: unit · Blocked by: 41

On 2026-11-23 two orchestrators waited hours on `node scripts/loops/check-plan.mjs --base dev`: the CLI reads stdin to EOF before its flags (check-plan.mjs:150), and with empty stdin `--propose` prints "none / no changes".

- Validate the arguments before reading stdin: require `--mode` or `--propose`, refuse unknown flags (exit 2 with usage).
- With `--propose` and `--base`/`--head`, compute the diff itself (`git diff --name-only <base>...<head>`); read stdin only when no base is given.
- One command prints the proposed tier for the branch (e.g. `pnpm prd tier [--base dev]`), named in the orchestrator prompt where it now says "the tier the check plan proposes".
- Unit tests: `--base dev` alone exits 2 at once with stdin left open; `--propose --base` on a fixture repo with changes doesn't print "no changes"; stdin still works for `propose_tier`. Hand-off: the orchestrator rule for `orchestrator.md` (don't chain a lookup ahead of a long check; confirm a check holds a lease in `pnpm prd status` before reporting it running).

### Slice 46: a hold keeps a row's other flags (B-464, B-650)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/backlog.md · Tests: unit · Blocked by: 41

`pnpm backlog prd set <topic> flags=hold` replaces the flag list, so a hold drops `standing`, `alone` or `design`. The prompts (backlog run line, the planner report's veto line) and `dispatch.mjs` write it that way.

- `prd set` gains an add and a remove form (e.g. `flags+=hold`, `flags-=hold`), keeping the others; plain `flags=` still replaces.
- Every prompt line and `dispatch.mjs` call that holds or releases uses it.
- Unit tests: `flags+=hold` on a `standing` row leaves `standing,hold`; `flags-=hold` leaves `standing`; adding a present flag changes nothing; the prompts' and dispatcher's hold lines use the add form. Hand-off: the line `backlog.md` should change.

### Slice 47: confirm local lint no longer runs out of memory (B-576, B-574)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: none (measurement only)

test-gates wave 4 (2991461a) gave local lint 6 GB; both items say to confirm no recurrence, then close.

- Change nothing at first. Search the check logs and check-times records since 2991461a (all worktrees) for a lint step exiting 134 or a heap-limit message; then run `pnpm lint` 5 times at check-like load (a concurrent `pnpm test:tooling`), recording peak memory if the shell can show it (`/usr/bin/time -l`).
- If none fails, hand off proposing close for both. If one does, show the cause and fix it in the lint script or ESLint config (not `vitest.config.ts`), with a unit test where one fits.
- Hand-off: the logs searched, the runs, load, peak memory and the proposal.

### Slice 48: the one-day wait on new packages is enforced (B-705)

Stack: no · Reads: plans/fixes-rules.md · Tests: unit

AGENTS.md says to keep `minimumReleaseAge`, but `pnpm-workspace.yaml` has none.

- Add `minimumReleaseAge: 1440` (minutes) to `pnpm-workspace.yaml`; confirm pnpm 12.21.0 accepts the key (unknown keys fail) and `pnpm install --frozen-lockfile` still passes; no lockfile change.
- A tooling unit test reads `pnpm-workspace.yaml` and fails without the key at 1440 or more.

### Slice 49: why the backlog session's phone pushes don't arrive (B-586)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md, docs/agents/backlog.md · Tests: none (investigation only)

The item says: test with the user on the real phone before planning a fix or calling it fixed. Run-through can't do that, so this slice does the part that needs no phone and readies the test.

- Change no code. Compare how each session kind is started (`--remote-control`, settings files such as `inbox-settings.json`, `context-settings.json`, `agentPushNotifEnabled`), what `pnpm prd ask` does for a push (`CARETOOK_ASK_NOTIFY`), and what differs between the backlog session and a managed `prd-` session or the dispatcher helper.
- Hand-off: the differences found, the likely causes ranked, and a short phone test for the user (which session sends what, what to look for), which the orchestrator files as a question. No fix and no close.

## Wave 7

Resumed 2026-11-26 after the post-wave-6 pause (row no longer held). Contents: the help and backlog-tool bugs (B-766, B-767, B-768), the unit worker cap that waited for `vitest.config.ts` (B-542), the tooling step's phantom "unhandled error" (B-623, B-860), the fixes-plans Status header (B-807), three load flakes in tooling tests (B-754, B-824), two app flakes (B-769, B-633) and the orchestrator's last step (B-812). For a flake, **first show the cause**, then fix it; a longer timeout alone only when the work is genuinely large and the hand-off says so. Never touch a running topic's hot files (`pnpm backlog prd list`: tags' timeline filter/row files, `routes/app/groups/{entry,todo,todos,planner,providers,medications,search}/`, `lib/tags/`, `lib/sync/schema.ts`, `syncRegistry.ts`, `sync-config.yaml`, `sync-matrix.mjs`). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain. Not in this wave (tags' hot files): B-653, B-776 (planner), B-619, B-839 (search), B-845 (entry), B-864 (tag fixture, tags' area).

### Slice 50: pnpm prd help prints no 'command not found' (B-766)

Stack: no · Reads: plans/fixes-rules.md · Tests: unit

`pnpm prd help` prints `design: command not found`: backticks inside `scripts/loops/prd.sh`'s unquoted help heredoc (about line 17) run as commands.

- Quote the heredoc delimiter (or escape the backticks) so the help prints its text verbatim; any `$var` the help really needs expanded stays expanded (check before quoting).
- Unit test: `prd.sh help` exits 0, prints nothing on stderr and its output contains the backticked words literally.

### Slice 51: a backlog amend keeps one Backlog-Tool trailer (B-767)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/backlog.md · Tests: unit

Amending a `pnpm backlog` commit appends a second `Backlog-Tool` trailer instead of keeping one.

- When the backlog tool amends its own commit, the message keeps exactly one `Backlog-Tool` trailer (replace or dedupe, keeping the other trailers in order).
- Unit test: two writes that amend the same commit leave one trailer.

### Slice 52: slice-fields knows Blocked by (B-768)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/planner.md · Tests: unit

`scripts/loops/slice-fields.mjs` warns on a valid `Blocked by` on a slice's fields line.

- `Blocked by` is a known field (in whatever form the planner doc gives it, e.g. `Blocked by: slice 3`); an unknown field still warns.
- Unit test (`slice-fields.test.mjs`): a fields line with `Blocked by` draws no warning and its value is parsed; an unknown field still warns.

### Slice 53: cap the unit-test workers (B-542)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/loop.md · Tests: unit

The unit Vitest projects run at Vitest's default workers (cores − 1); two overlapping checks run ~18 test processes on 10 cores. Component, integration, Playwright and check slots are already capped; only the unit group isn't.

- Cap the unit group's workers in `vitest.config.ts` (about 4, or half the cores, whichever is smaller; follow how the other groups cap theirs), env-overridable like them if they are.
- Time it: the unit group's wall time before and after on this machine (`.loops/.check-times.log` or a timed run), in the hand-off. If the cap slows the unit group by more than ~30% alone, say so and propose the number.
- Unit test: the config's unit projects carry the cap (beside any existing test of the other caps).

### Slice 54: the tooling step's rerun isn't skipped by a test's title (B-623, B-860)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/check-tooling.mjs` (the step printing "tooling: an unhandled error, so no rerun", about line 168) matches `/Unhandled (Error|Rejection)|unhandled error/` anywhere in the output, and a passing test's title ("doesn't rerun after an unhandled error") matches, so every tooling failure skips its one rerun. Also check `check-body.sh` (~line 69) for the same grep. B-860 is the same bug, seen again.

- Detect a real unhandled error only from the runner's own report (Node test runner / Vitest summary lines, not test titles), anchored so a title can't match.
- Unit test: output whose only match is a passing test's title reruns; real unhandled-error output still doesn't.

### Slice 55: an idle fixes plan keeps its Status table header (B-807)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/fixes-plans.test.mjs` 'fix topics fixes-ui has a plan with a parsing Status table' failed on dev after fixes-ui's idle hand-over (92177808) dropped the `Slice | Item | State | Merge` header (symptom fixed on dev, a563f62f). Fix the cause.

- `pnpm prd status-trim` (and whatever writes an idle hand-over) always leaves the Status table's header and separator, even when it moves every row out.
- Unit test (`status-trim.test.mjs`): trimming a plan whose rows all move out keeps the header; `fixes-plans.test.mjs` unchanged.

### Slice 56: backlog.test.mjs's beforeAll holds under load (B-754)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/backlog.md · Tests: unit

`scripts/backlog/backlog.test.mjs`'s beforeAll errored in slice checks at load ~30–44 (error text not kept). Likely a slow fixture setup like tidy-cli's (B-461, slice 36).

- Measure the setup (time it, under `stress` or beside a check), show what is slow, and cut it (share or build fixtures once, fewer git or node spawns); a longer hook timeout only if the work is genuinely large, said in the hand-off.
- Unit test: the same tests pass; before/after setup time in the hand-off. Slice 51 also edits `scripts/backlog/`: keep this to the test file and its fixtures.

### Slice 57: lease.test.mjs's 'beyond the default limit of two' doesn't flake (B-824)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/lease.test.mjs` 'pnpm prd check's check lease makes the runs beyond the default limit of two wait' flaked on CI (passed on rerun), after slice 30 (B-654) fixed an earlier race in it.

- Find the remaining race (read slice 30's fix in plans/fixes-tooling-history.md and the test) and fix the cause: wait on a state the test can observe, never a sleep.
- Unit test: the test passes 20 runs in a row under load (`stress` or beside a check); hand-off says the cause.

### Slice 58: the New care group sheet test doesn't flake (B-769)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: component

`apps/web/app/routes/app/groups/new/newGroup.browser.test.tsx` 'the New care group sheet the group menu's New c…' flaked on CI (passed on rerun, symptom-catalog).

- Find the cause (run it alone and under load; read for a read-before-render or an unawaited open) and fix it in the test or, if the screen races, in the screen. Never `apps/web/test/`'s harness beyond what the fix needs.
- Component test: the same assertions hold 10 runs in a row under load; the cause in the hand-off.

### Slice 59: timelineBack's Back tests settle (B-633)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

`apps/web/app/routes/app/groups/timeline/timelineBack.browser.test.tsx` 'back from the entry page three pages d…' and its sibling 'Back, then the filter that's on picked again': settle timeout after Back with care_period/care_group_member/medication_pass/document queries pending, on both time zones, first run and retry; 3/3 alone (symptom-catalog run 45433991590). So it fails deterministically somewhere.

- Reproduce, show why those queries never settle after Back, and fix the cause. Don't edit tags' hot timeline files (`TimelineEntryRow.tsx`, `TimelineFilters.tsx`, `FilterSheet.tsx`, `timelineFilters.ts`, `timeline.sync.ts`); if the fix needs one, stop and say so in the hand-off.
- Component test: both tests pass 10 runs in a row, in both zones.

### Slice 60: the orchestrator's last step ends its session (B-812)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md, docs/agents/machinery.md · Tests: unit

An orchestrator's finishing step runs `pnpm prd rm <topic>` from inside its own worktree, so the next step (`cd <main> && pnpm prd end`) never runs: the harness refuses a command whose cwd was deleted.

- `pnpm prd rm <topic>` run from inside that topic's integration worktree by its own orchestrator session ends that session itself after removing (as `prd end` would), or, if that can't be done safely, refuses with the exact one-line command to run instead (`cd <main> && pnpm prd rm <topic> && pnpm prd end`). Update the orchestrator prompt's last-step line (in `scripts/loops/prompts/` or `prompt.sh`) to match.
- Unit test: rm from inside its worktree takes the new path; rm from the main checkout behaves as today. Hand-off: the lines `orchestrator.md`'s last-landing order should change to.

## Wave 8

Started 2026-11-26. Contents: the rest of the landing, Codex and cleanup group: the review tooling (B-239, B-240, B-244), the lease race and tidy's lease delete (B-867, B-442), the to-test file (B-443, B-447), the unsynced brake read (B-639, B-649), the gate's carried failing verdict (B-738) and rm.sh's double registry read (B-545). Each item's backlog notes (`pnpm backlog show B-<n>`) carry the details. Never touch a running topic's hot files (`pnpm backlog prd list`: todo-subtasks' `lib/todos/`, `components/todos/`, `routes/app/groups/{todo,todos}/`, `syncRegistry.ts`, `sync-config.yaml`, `lib/sync/schema.ts`, `sync-matrix.mjs`). Loops never edit `docs/` or AGENTS.md: say in the hand-off what a doc should gain. Slices 63 and 64 both touch the lease code, and 65 and 66 both touch `land.sh`: keep each change local to its own functions.

### Slice 61: pnpm prd review's --json is valid JSON, and --again --wait times out honestly (B-239, B-240)

Stack: no · Reads: plans/fixes-rules.md · Tests: unit

`scripts/loops/review.sh`: with `--json`, progress lines (asked Codex…, waiting) go to stdout, so the output isn't valid JSON; with `--again --wait`, when Codex never takes up the re-review, it falls through to the old verdict instead of exiting 75.

- With `--json`, stdout carries only the JSON verdict; every progress line goes to stderr.
- `--again --wait`: when Codex's summary for the head never changes from the one before the re-review was asked, it exits 75 at the timeout (saying so on stderr) rather than reporting the old verdict.
- Unit tests (`review.test.mjs`, with its fixtures): `--json --wait` stdout parses as JSON; `--again --wait` with an unchanged summary exits 75.

### Slice 62: outdated Codex threads stop blocking once Codex's state on the head is clean (B-244)

Stack: no · Reads: plans/fixes-rules.md · Tests: unit

The user's decision (2026-11-21): trust Codex's summary for the head.

- `openFindings` in `scripts/loops/codex-review.mjs`: an outdated Codex thread no longer counts as open when Codex's `codex-review-state` on the head says `has_unresolved_findings: false`. A thread that isn't outdated, or one on a head whose state still has unresolved findings, still needs a reply and a resolve.
- Update the orchestrator prompt's review line (`scripts/loops/prompt.sh` or `scripts/loops/prompts/`, with `prompt.test.mjs`) to say only declined and current threads need `--resolve`.
- Unit test (`codex-review.test.mjs`, the `outdated.json` fixture): an outdated thread with a clean head state is not open; the same thread with unresolved findings on the head is. Hand-off: the lines `docs/agents/orchestrator.md` (_Landing a wave_ step 4) and `docs/orchestration.md` should change to.

### Slice 63: two takers can't hold one check slot (B-867)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`scripts/loops/lease.sh`: on CI two takers both wrote `check/<n>/name.tmp`, one `mv` took the other's file, and a run went ahead with no lease (evidence in the item's note).

- Each writer uses its own temp name (e.g. `name.tmp.$$`); after the `mv`, the taker confirms the slot's recorded pid is its own, else it backs off and tries again (or waits) as if the slot were taken.
- Unit test (`lease.test.mjs`): two takers racing one slot never both hold it (a deterministic interleaving, e.g. a hook between write and mv, rather than a timing loop); the lone-taker path is unchanged. Hand-off: whether B-824's quarantine line can go.

### Slice 64: tidy deletes a dead lease only through lease.sh's takeover (B-442)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

`pnpm prd tidy --yes` (`scripts/loops/tidy-cli.mjs` ~445) `rmSync`s dead leases from its earlier snapshot, so a lease retaken in between is deleted.

- Tidy removes a lease only through lease.sh's takeover protocol (its `.takeover` mutex and a fresh liveness check at delete time), never by a plain delete of a path from its snapshot. Keep the change in tidy's lease path; don't change `lease.sh`'s take path (slice 63's).
- Unit test (`tidy-cli.test.mjs` or `tidy.test.mjs`): a lease that was dead at the snapshot but live at delete time survives; a still-dead one is removed.

### Slice 65: the to-test file lists the landed items and fits a tooling landing (B-443, B-447)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/machinery.md · Tests: unit

The `to-test/` file `pnpm prd land` writes lists no items after a local landing (they read landed, not ready, once dev has the merge); its _What wasn't checked_ repeats the quick-check line, and a tooling-only landing still gets the app's dev URL and seed sign-ins under _What to try_.

- Capture the ready items before the merge (both the PR and the `--local` paths) and use them in the file.
- _What wasn't checked_ carries no repeated line.
- A diff that is only `scripts/`, tooling and docs gets the commands to try instead of the app URL and seed sign-ins.
- Unit tests (`land.test.mjs` or the report module's): a local landing lists its items; a tooling-only diff gets commands, not the URL; no duplicate line.

### Slice 66: an unsynced landing reads origin/dev's brake, and fails closed when it can't (B-639, B-649)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md · Tests: unit

`unsynced_dev_brake` (`scripts/loops/unsynced.sh`) reads the verdict for local dev's tip, so a brake on a newer `origin/dev` is missed; and with GitHub unreadable it reports no known brake, which a skeptic's `--force` then trusts.

- Judge the brake on `origin/dev`'s tip (after a fetch) as well as local dev's.
- When the brake state can't be read, say so distinctly; `land --force` with a skeptic's go refuses on an unreadable state (naming `--by-user` as the way through) instead of treating it as no brake.
- Unit tests (`land-unsynced.test.mjs`, `land-force-resume.test.mjs` or the skeptic's): a brake only on origin/dev's newer tip is seen; an unreadable state refuses a skeptic `--force`.

### Slice 67: the land gate never carries a failing verdict across a tooling change (B-738)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/orchestrator.md · Tests: unit

The gate counts a verdict on a first-parent ancestor when only docs or tooling changed since; that carries a failing verdict too, so a tooling fix commit is refused on the old failure (hotfix/lane-cap, 2026-11-24).

- A carried ancestor verdict counts only when it is green (or a flake the branch's files don't touch, as today's rules allow); a failing one makes the gate request a fresh run on the tip (and say why), not refuse.
- Unit test (`land-gate.test.mjs` or `check-gate.test.mjs` / the gate module's): a failing ancestor verdict plus a tooling-only commit asks for a new run; a green one still carries. Hand-off: the line _The check gate_'s _What counts_ should change to.

### Slice 68: rm.sh reads the registry once (B-545)

Stack: no · Reads: plans/fixes-rules.md · Tests: unit

`scripts/loops/rm.sh` runs `backlog.mjs prd list --json` twice (~line 90 and ~104).

- Reuse the first read's rows for the hot-files step; behaviour, messages and exits stay the same, including when the first read failed.
- Unit test: the existing rm tests pass; one asserts a single registry read per rm (e.g. through a stub that counts calls).
