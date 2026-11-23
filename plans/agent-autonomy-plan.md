# Plan: Agent autonomy

> Source PRD: [`plans/agent-autonomy-prd.md`](agent-autonomy-prd.md). User-story numbers (US) refer to it. Backlog items B-503 (default on silence) and B-506 (shared notice board), landed; B-518 (land without re-syncing). Topic `agent-autonomy`, rescoped 2026-11-22 against [test-gates](test-gates-prd.md). The follow-on topics: `agent-autonomy-2` (the context watch, [its own plan](agent-autonomy-2-plan.md)) and `agent-autonomy-3` (the skeptic).

## Status

| Slice | Wave | State         | Merge into `prd/agent-autonomy` (slice commits) |
| ----- | ---- | ------------- | ----------------------------------------------- |
| 1     | 1    | landed (opus) | 55275f08 (d759b24e)                             |
| 2     | 1    | landed (opus) | b3877be1 (142fa3d7)                             |
| 3     | 2    | —             | —                                               |
| 4     | 3    | —             | —                                               |

**Rescoped on 2026-11-22** (backlog session, the user's pick) against [test-gates](test-gates-prd.md): the old slices 3 to 10 (machine claim, local flake rule, carried full pass, `Checked:` trailer, landing hold) are dropped; B-518 is rebuilt as slices 3 and 4. The old plan is in git history at 887d44de. The registry row runs **after `test-gates`**, which lands its brake and rapid gate in `land.sh` first.

**Landing mode:** run everything through (started by the dispatcher, 2026-11-23): land each green wave, clean up, ask only real questions through `pnpm prd ask`.

**Now:** wave 1 landed in dev as 0e38a6e7 through PR #58 (2026-11-22). test-gates is done. Wave 2 (slice 3, opus) starting 2026-11-23; slice 3 alone changes no behaviour, so waves 2 and 3 may land together as one PR.

**Backlog:** B-503 and B-506 done with wave 1. Claim B-518 when slice 3 starts and `done` it when slice 4 merges. B-504, B-505 and B-517 are dropped; B-516 is landed (its after-notice is wave 1's landed notice; the rest was dropped with the local full check).

**At the rescope's landing** (plan branch): `pnpm backlog prd set agent-autonomy after=test-gates hot=…` (`scripts/loops/land`, `scripts/loops/lib.sh`, `scripts/loops/check-`, `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`); B-504, B-505, B-517 dropped and B-516 landed, each with a note; a note on B-512. The `hold` flag comes off when the user says so.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 2, [machinery](../docs/agents/machinery.md) (the module, in a line); wave 3, [orchestrator](../docs/agents/orchestrator.md) (_Landing a wave_, the landing step: the unsynced landing) and machinery (the landing report's unsynced line); [orchestration](../docs/orchestration.md) for `CARETOOK_UNSYNCED`. Trim at least what you fold in.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, its tests, prompts. No app code, no migration, no dependency.
- **Machine state lives in the main checkout's `.loops/`**, untracked, written atomically; nothing is written inside a worktree except the unsynced typecheck's temporary merge and its marker. Each store takes its directory from the caller or a `CARETOOK_…` variable, so tests use temporary directories.
- **Pure decision, thin command:** the default's settling, the notice store and the "what dev brought" module are functions tested alone; the shell parts only gather facts and act.
- **A user's answer always wins** over a default.
- **Nothing new can fail a command it decorates:** printing or posting a notice never changes another command's exit code.
- **A gate never loosens on a guess:** anything git can't answer is a refusal, and `land` falls back to today's drift refusal. Every new behaviour has an off switch (`CARETOOK_UNSYNCED=off`).
- **test-gates comes first in `land`:** the brake refusal and the mode are read before the drift decision; pre-deployment mode never lands unsynced.
- **Tests never touch** the real asks queue, leases, backlog or `origin`.

## How to run this plan

- **Waves:** 1: slices 1 and 2 (landed). 2: slice 3. 3: slice 4. Each wave lands something usable alone; slice 3 alone changes no behaviour, so waves 2 and 3 may land together as one PR.
- **Gate:** the diff is tooling and Markdown; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **Models:** opus for both slices (git edge cases, the land gate).
- **Other topics:** `test-gates` (must be done first), `inbox-agent`, `code-health` and `fixes-tooling` change the same directory; don't run beside them (the hot-file rule) and sync at each wave boundary.
- **Try it on itself:** this PRD's own landings are tooling only; the unsynced landing is first exercised by the next landing of another topic that drifts. Say so in the landing report.

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

**User stories:** US 7, 8.

**Build:** the PRD's _The notice board_. The notice store (create with an exclusive id, list live, withdraw, prune expired on every write and list); `pnpm prd notice`, `notices [--json]`, `notices --done`; the life (60 minutes by default, `--for`, 24 hours at most) and the 200-character line; other sessions' live notices printed to stderr, five lines at most, before `check`, `sync`, `slice`, `browser`, `pr`, `ready` and `land`; `pnpm prd status` prints them all; a code landing posts its "landed, sync at your next wave boundary" notice for six hours. This slice changes no prompt.

**Acceptance criteria:**

- Store unit tests: two creates never share an id; an expired notice isn't listed and its file is gone after the next list; a life over 24 hours is refused, and so is an empty or overlong line; withdrawing an unknown id is an error.
- Command tests: `notice` prints the id and `notices` lists it with its session, topic, age and time left; a gated command prints another session's notice and not its own, prints at most five, and exits with its own code when the notice directory is unreadable.
- Landing tests: a code landing posts the notice with the topic and commit; a Markdown-only or `plan/` landing posts none; a failure to post doesn't fail the landing.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 3: What dev brought since the last sync

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** the base of US 9.

**Build:** the PRD's _What dev brought_. The pure module: given a checkout, dev's ref and a tip, the branch's own files, dev's files since the merge base, the incoming dev commits (first parent), whether the sides share a file (backlog files excluded), and the risky files on dev's side, or a named refusal. The risky list: `check-plan.mjs`'s forced-full list exported once (test-gates keeps the list even where it stops escalating on it), plus the test setup directories, the Vite and TypeScript configs, `pnpm-workspace.yaml`, and the lint and format config (`eslint.config.js`, `scripts/eslint/`, the Prettier config and ignore file). Diffs with `--no-renames`. A small command-line entry for `land.sh` that prints the verdict as JSON. Nothing reads the verdict yet: slice 4 does.

**Acceptance criteria:**

- Module unit tests, over throwaway repositories in a temporary directory:
  - Dev changing other files only: no shared file, no risky file.
  - A shared file is named; a backlog-only shared file (`plans/backlog.md`, `plans/inbox.md`) doesn't count.
  - Each risky kind on dev's side is named: a migration, seeds, `sync-config.yaml`, the lockfile, a `package.json`, the Vitest config, a test setup file, `vite.config.ts`, a `tsconfig`, `pnpm-workspace.yaml`, `eslint.config.js`, a file under `scripts/eslint/`, the Prettier config.
  - Dev renaming a file the branch edits is a shared file.
  - A branch already synced (dev is an ancestor) reports no drift.
  - Several syncs: only dev's commits since the last merge base count.
  - Git failing (a missing ref) is a refusal with its reason.
- `check-plan.mjs`'s tests pass unchanged on the exported list.
- `pnpm test:tooling` passes.

**Blocked by:** test-gates done (the registry's `after`). **Blocks:** 4.

## Slice 4: Land on an unsynced tip

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 9, 10.

**Build:** the PRD's _Land on an unsynced tip_, on slice 3's module.

- **Where:** after test-gates' CI read and after `--recheck` (its lease released), before the merge and the throwaway seam's exit; a leftover marked merge is aborted before the uncommitted-changes refusal.
- **When land relaxes:** only on a green, file, flake or pending-after-green CI verdict (never on a brake, with or without `--fixes`, on `unknown`, or in pre-deployment mode), when dev has drifted, `land` asks the module and goes ahead when dev's files since the last sync share none with the branch and none is risky. Never in pre-deployment mode. Every other refusal stays.
- **The typecheck** runs in a check lease and is refused while the branch's worktree holds a check or browser lease. It makes a no-commit merge of dev in that worktree, runs `pnpm typegen` then `pnpm typecheck`, and puts the worktree back to the tip on every exit it can catch, with a marker the next `land` or `check` uses to abort a leftover merge.
- **When it's skipped or refused:** skipped when the branch's diff is Markdown only (`docs_only`), which needs no worktree. A branch that needs the typecheck with no worktree, or a dirty one, keeps today's drift refusal. A conflicting merge is aborted, refused and restored. `pnpm prd sync` also aborts a leftover marked merge.
- **Dev moving meanwhile:** dev is read again after the typecheck, and land judges once more, refusing rather than looping.
- **The record:** the unsynced line in the merge body (`--body` on the PR path, a second `-m` locally), the landing report and land's own line; `CARETOOK_UNSYNCED=off`. Prompt: the orchestrator's _Landing a wave_ landing step (as test-gates left it) says land may go in unsynced and the next wave syncs as usual.

**Acceptance criteria:**

- Landing tests (throwaway repositories, the PR seam, a stub `pnpm` whose typecheck passes or fails, short lease settings):
  - Drift on other files lands, prints the unsynced line, and the printed merge carries it in `--body`.
  - Drift on a shared file is refused as today.
  - Drift bringing a migration, `package.json` or a test setup file is refused, naming it.
  - A brake refuses before the drift decision (stub `pnpm prd ci`); a brake with `--fixes` and an `unknown` verdict keep the drift refusal; pre-deployment mode refuses all drift.
  - A temporary merge that conflicts is refused and the worktree restored.
  - A Markdown-only branch with no worktree lands unsynced.
  - The local path's merge commit carries the unsynced line (second `-m`).
  - The stub sees typegen before typecheck; a failing typecheck lands nothing.
  - The worktree is back at the tip with a clean status after a pass, a failure and an interrupt; a leftover marked merge is aborted by the next `land` and by `sync`.
  - A worktree holding a browser lease is refused.
  - Dev moving during the typecheck onto a shared file is refused (the test moves `origin/dev`, as the seam measures against it).
  - A Markdown-only branch lands unsynced with no typecheck.
  - `CARETOOK_UNSYNCED=off` refuses all drift.
  - The to-test file says it landed unsynced.
- Prompt tests cover the changed step.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** nothing.
