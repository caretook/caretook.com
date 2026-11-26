# Plan: Orchestration split 2 (stage 1b, the stack, test DB, lease and role docs)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split-2`, after `orchestration-split`. Next: [`orchestration-split-3-plan.md`](orchestration-split-3-plan.md), then the runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**Running by hand** (2026-11-25): the user opening this session lifted the hold for this run. The registry row `orchestration-split-2` keeps its `hold` flag on purpose, so the dispatcher can't start it on Opus. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Slice 3 is the same swap in about ten scripts: a sonnet candidate once slice 2 has set the pattern. The doc splits (6 to 8) need judgement on what is generic: opus.

**Session 4 (on Opus, 2026-11-25): wave 4 running, the last wave.** The orchestrator, slices and skeptics run on Opus (the user's word via split-ops; it replaces rule 3's "Fable"). **Landing mode: ask before each landing**, through the backlog split-ops session (`caretook-com-42` since 2026-11-25, was `caretook-com-d6`; record `backlog-split-ops`; ListAgents). Synced with `dev` at 50137bc6 (marketing-2's d2d851b7). Old slice 9 split in two (the user allowed it): **9** takes B-838 and B-842, **10** takes B-844, B-846 and B-847 (but B-847 point 7, `orchestration-split-3`); slice 8 takes the doc points (B-846's `loop.md` pointer, B-847 points 9 and 10). **Wave 4 started 2026-11-25:** the classifier blocked the usage-watch override; then split-ops (new session `caretook-com-42`) reported the weekly reading at 67% after the reset, and plain `pnpm prd slice` made worktrees 8, 9 and 10. One background agent each, **all on opus**; the watch runs. Items claimed. Tier `full` (`scripts/ci/`). The stack is down; wave 4 needs none (bring it up for `serve` at landing if wanted). After the landing: fold the docs, then ask split-ops before `pnpm prd rm` and `end` (rule 6). Older hand-offs: [`orchestration-split-2-history.md`](orchestration-split-2-history.md).

**Wave 3 landed 2026-11-25 as 625d104** (PR #198, tier `integration` since slice 3 edits `browser.sh`, `--no-review`: Codex was out of credits, so it didn't review this wave). Slices 3 (721935db, fix 45bc9da3) and 7 (70449b6f), all agents on opus. CI: green on 35a42732 (run 45722359111) after a first run failed 8 tests of `scripts/project/stack.test.mjs` on Linux (a BSD-first `stat` in `stack-facts.sh`, fixed in b450e496). The Fable skeptic (rule 3): go at 9bea8d9c, no blocker; its follow-ups are B-847. One stack down and up through the new hooks: fine. No other worktree was open (rule 4). No docs folded (the last landing folds them). Slices 3 and 7's worktrees and branches are removed.

- **For slice 8 (the machinery doc), the contract as it now is:** hooks `stackUp`, `stackDown`, `stackStatus`, `stackReady`, `stackStop` (keeps data), `stackStart` (migrates, never seeds), `stackEngine` (`running=`, `name=`), `stackLeftovers` (repeated `volume=`, `image=`, `kept=` lines; `remove volume|image ID`), `serve`, `testDb` (`facts` with `running=`, `orphans` with `orphan=` lines, `use` with `database=`, `port=`, `summary=`); `stopped_secs=` in `ready`; the core's `hooks.mjs` (`runHook`, `fact`, `factList`); the sample project's stub hook and `stubHookConfig` for tests. Behaviour: `rm.sh` dies on a failed `stackDown`; recover keeps the migrate marker when the start fails. An additions file can continue only the generic doc's last section, so a section mixing generic and `dev` lines stays whole in Caretook's half. Ten roles, not nine (`orchestration` is `docs/orchestration.md`); the machinery doc still says Node callers use `lease.mjs`. The orchestrator doc's halves have 4 bytes of room each.
- **Left for later:** `inventory.mjs`, `recover.sh` and `prd.sh`'s help keep "Docker" words (orchestration-split-3); `browser.test.mjs` and `fixes-plans.test.mjs` still copy or import `scripts/project`.

**Waves 1 and 2 landed 2026-11-25** as eaba1e81 and 47fb5414 (the history file has both reports).

**This week's rules** (the user's word, relayed by split-ops; they lapse at the reset unless renewed):

1. Before every `pnpm prd rotate`, message split-ops and wait for its go (it checks the session record says model fable).
2. Start every slice worktree with `CARETOOK_USAGE_WATCH=off pnpm prd slice …` (the dispatcher is off on purpose; at 100% usage sessions stop and wait, and split-ops clears the stalls after the reset).
3. Before each wave lands, a Fable skeptic reviews its decisions and code; its verdict goes here and in the landing report (`skeptic record` takes no such verdict).
4. Waves 1 to 3 land only when no other PRD, plan or hotfix worktree is open; if one is, hold and message split-ops.
5. Big choices (an `asked` PRD decision, or a new one of that size) go to the user one at a time through split-ops.
6. Ask split-ops before each landing and before `pnpm prd rm` / `end`.

**Backlog:** B-543 (the split, the topic's item). Slice 9 (wave 4) takes B-838 and B-842 (the stage 1a wave 7 and 8 skeptics' follow-ups), B-844 (wave 1's; its point 2 is done, slice 2) and B-846 (wave 2's) but its point 3, which is slice 3's (done), and B-847 (wave 3's): all on the user's word, relayed by split-ops 2026-11-25.

| Slice | Wave | State   | Merge into `prd/orchestration-split-2` |
| ----- | ---- | ------- | -------------------------------------- |
| 1     | 1    | landed  | ad60a316                               |
| 4     | 1    | landed  | a4c667dd                               |
| 5     | 1    | landed  | 73331f09                               |
| 2     | 2    | landed  | 5b690d58                               |
| 6     | 2    | landed  | 89ef0dda                               |
| 3     | 3    | landed  | 721935db                               |
| 7     | 3    | landed  | 70449b6f                               |
| 8     | 4    | started |                                        |
| 9     | 4    | started |                                        |
| 10    | 4    | started |                                        |

## Architectural decisions

As in [`orchestration-split-plan.md`](orchestration-split-plan.md) (the names, the manifest, the lint, the own-lines rule, the test sets, other worktrees), plus:

- **The stack hook contract:** the core calls `stack up|down|status|ready` and `test-db` through the config; each prints facts as `key=value` lines (slot, ports, container names, URLs) and exits non-zero on failure. The core parses only those lines and knows no Docker, Postgres or PowerSync detail.
- **Leases keep their folder** (`.loops/.lease/<kind>/`) and their one implementation, the core's.
- **Other worktrees:** waves 1 to 3 move or re-route scripts the main checkout's commands call on other worktrees (the test DB, the stack, serve). Each lands only when no other PRD, plan or hotfix worktree is open.
- **The role docs** (PRD _Decisions_, asked): one generic doc per role, the core's, in `scripts/loops/docs/<role>.md` until the move; a project adds one additions file per role or replaces the role whole, through the config; `pnpm prd doc <role>` prints the merged text.
- **The role docs change about ten times a day** (151 commits in two weeks). So the command lands first with every role as a replacement (today's file, no text moved), and the docs then split in three small groups, one a wave. Before each doc slice lands, its orchestrator diffs `dev`'s copy of that group's docs since the slice branched and re-applies each edit to the half it now belongs in.
- **The doc budget** is a figure per half: each split slice sets one for the generic doc and one for Caretook's additions, the two adding up to today's figure for that role, so the merged text stays within it and neither side has to read the other. Until the move Caretook's budget engine checks the generic docs too (a residual-list line in its config); after it, Risa's copy does.

## How to run this plan

- **Start only when** `orchestration-split` has landed and the tooling is quiet.
- **Wave 1:** slices 1, 4 and 5 (1 owns `test-db.sh` and the data package's test setup; 4 owns the lease CLI, `lease.sh`, `lease.mjs` and `apps/web/test/`; 5 owns `prd.sh`, the doc command, the prompts, `skeptics.mjs` and AGENTS.md). **Wave 2:** slices 2 and 6 (2 owns `stack-lib.sh`, `stack.sh`, `serve.sh` and `lib.sh`'s stack functions; 6 owns the loop, hotfix and recovery docs). **Wave 3:** slices 3 and 7 (3 owns the inventory, reclaim, recover, tidy and worktree scripts; 7 owns the orchestrator, planner, backlog and inbox docs). **Wave 4:** slices 8, 9 and 10 (8 owns the machinery doc, `docs/orchestration.md` and the doc points of B-846 and B-847; 9 owns the `scripts/ci/`, `scripts/backlog/` and config files B-838 and B-842 name, and their lines in `prd.sh`, `land.sh`, `ls.sh`, `pr.sh` and `tidy-cli.mjs`; 10 owns the stack, test-DB, lease, hook, tidy, new and recover files B-844, B-846 and B-847 name).
- **Tiers** (what the check plan proposes, once at landing): wave 1 touches `packages/data/` and `apps/web/test/`: `components`; wave 2 edits `serve.sh` and `lib.sh`, which the browser harness test covers: `integration`; waves 3 and 4 are tooling and docs only, except that slice 9 edits `scripts/ci/`, which proposes `full` for wave 4. Waves 2 and 3 also need a stack: one `pnpm prd stack up` and down each. Every wave runs `pnpm test:tooling`.
- **Docs at the last landing:** the machinery doc (the stack hooks and their contract, the lease command, the doc command and how a project adds to a role), the loop and hotfix docs.

## Slice 1: The test DB as Caretook's

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit, integration

**User stories:** 3, 6.

**What to build**

- `test-db.sh` moves to `scripts/project/` and stops sourcing `stack-lib.sh` and `lib.sh`: it defines the few values it needs itself (the shared port, the compose project, the database name: all Caretook facts) and uses no core helper, since the integration tests run it with no Risa present; the data package's test setup (`packages/data/test/globalSetup.ts`) calls it there. The config gains the `test-db` hook.
- The core's callers (`prd.sh`, `down.sh`, `ls.sh`, `recover.sh`, `rm.sh`, `tidy-cli.mjs`) keep working through a forwarding path at the old place; slice 3 swaps them to the hook and removes it.

**Acceptance criteria**

- `pnpm prd check` passes (integration tests on the shared test Postgres); the test-DB tests pass from their new home; the lint finds no core path in the data package's test setup; `test-db.sh` runs with no core file present.

**Blocked by:** `orchestration-split`. **Blocks:** 2.

## Slice 2: Stack up, down and serve as Caretook's

Stack: yes · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 3.

**What to build**

- `stack-lib.sh` splits: the stack facts (compose projects, ports, env files, containers, images) move to `scripts/project/` behind `stack up|down|status|ready`; the core logic in it (slice state, held and merged slices, gc ages, the outstanding-runs call) stays core. `stack.sh` and `serve.sh` move with the stack facts.
- Eight core scripts still source `stack-lib.sh` for the moved facts until slice 3 (`new.sh`, `recover.sh`, `gc.sh`, `down.sh`, `ls.sh`, `reclaim.sh`, `rm.sh`, and `prd.sh`, `browser.sh` call `stack.sh` or `serve.sh` by path): the old function names stay in `stack-lib.sh` as thin calls to the hook, and the old script paths forward, until slice 3 removes both.
- The check plan's rules (Caretook's data) name `serve.sh`'s new path in the browser harness set, so a change to it still asks for `integration`.

**Acceptance criteria**

- `pnpm prd stack up`, `status` and `down` on the slice's own stack print the same facts as a capture taken before the change; the stack tests pass on a stubbed `docker`; a change to the moved `serve.sh` proposes `integration`; the touched core files leave the allowlist.

**Blocked by:** 1. **Blocks:** 3.

## Slice 3: The core reads stack facts only through the hooks

Stack: yes · Reads: docs/agents/machinery.md, docs/agents/recovery.md · Tests: unit

**User stories:** 3.

**What to build**

- The inventory, reclaim, recover, tidy, gc, down, ls, new and rm scripts stop knowing Docker, compose, ports and `caretook_test_*` names: they read the stack hook's `status` facts and call its `down` and the `test-db` hook; the forwarding paths and thin functions from slices 1 and 2 go.
- About 10 scripts and their tests; each change is the same swap from a direct Docker, port or `test-db.sh` call to the hook.
- **B-846 point 3** (the wave 2 skeptic's, on the user's word): the hook contract gains what these callers need and slice 2 left out: a stop that keeps the data (`down.sh`), a stopped-since fact (`stack_stopped_secs`, which still calls Docker), and an up that migrates without seeding (`recover.sh`).
- The core's tests stop importing app code: `stack.test.mjs` and `tidy.test.mjs` take the test-database name from the hook's facts or the sample project, not from `packages/data/`.

**Acceptance criteria**

- `pnpm prd status`, `pnpm prd tidy --dry-run` and `pnpm prd recover --dry-run` print the same before and after, captured together with nothing landing between; their tests pass on a stubbed hook; no core test imports from `apps/` or `packages/`, and the fixture copies of `scripts/project` in `recover.test.mjs`, `tidy-cli.test.mjs` and `stack.test.mjs` (slice 1's, for the forwarder) are gone; the touched files leave the allowlist.

**Blocked by:** 2. **Blocks:** `orchestration-split-3`.

## Slice 4: The lease command

Stack: no · Reads: docs/agents/machinery.md, docs/domain/components.md · Tests: unit, component

**User stories:** 6.

**What to build**

- The lease command in the config is the core's existing `lease.sh hold` (take, wait, hold for a pid, release), with a stable CLI.
- The app's browser test helper finds `.loops/` from the main checkout (not the current directory: worktrees sit inside it); when it exists it holds a browser lease for the Vitest process's life through the command and **fails loudly** if the command can't run; with no `.loops/` it takes none. It no longer imports the core.

**Acceptance criteria**

- A unit test: the helper's lease and a core check's lease on the same kind exclude each other, the Vitest process's exit releases it, a dead holder is taken over as today, and a missing command fails the run; with no `.loops/`, the helper runs with no lease. The component tests pass.

**Blocked by:** `orchestration-split`. **Blocks:** `orchestration-split-3`.

## Slice 5: The doc command

Stack: no · Reads: docs/agents/machinery.md, docs/agents/planner.md · Tests: unit

**User stories:** 8, 9.

**What to build**

- `pnpm prd doc <role> [section]` (core): prints the role's generic doc, then the project's additions file when the config names one; or the project's replacement alone when the config names that instead. With a section, only that heading's text from the merged doc. An unknown role or section, or a named file that is missing, is a clear error.
- In this slice every role is a **replacement**: the config points each role at today's file in `docs/agents/` (and `docs/orchestration.md`), and no text moves. `risa.json` already has the `roles` group for six of them (backlog, hotfix, loop, orchestrator, planner, recovery: `orchestration-split` slice 4, for the prompts); this slice adds the rest.
- Everything that reads or names a role doc goes through the command: the six prompts that name one, `slice-fields.mjs`, `prd.sh`'s help, `new.sh`, `skeptics.mjs` (which reads two planner sections by heading, and `preferences.md` at its config path), the hotfix prompt's "write new rules into the hotfix doc" line, and AGENTS.md's _Area index_.
- The conventions that name a role doc's path keep working and are restated: a slice's `Reads: docs/agents/<role>.md` means "run the doc command for that role" (the slice prompt says so; the 26 existing plans aren't rewritten), and AGENTS.md's _At landing_ rule says a process rule goes to the generic doc when any repo would need it, else to Caretook's additions.

**Acceptance criteria**

- Unit tests on the sample project: generic alone, generic plus additions (additions last), a replacement alone, one section, and each error. Both prompt goldens pass and name the command; `pnpm prd doc <role>` prints each of today's nine docs byte for byte; no core file outside tests names a `docs/agents/` path.

**Blocked by:** `orchestration-split`. **Blocks:** 6, 7, 8.

## Slice 6: The role docs split, group 1: loop, hotfix, recovery

Stack: no · Reads: docs/agents/loop.md, docs/agents/hotfix.md, docs/agents/recovery.md · Tests: unit

**User stories:** 9.

**What to build**

- Each of the three docs splits: the generic text becomes `scripts/loops/docs/<role>.md` (core, in the manifest); what only Caretook needs (its stack, commands, areas, checks, rules that name app files) stays in `docs/agents/<role>.md` as the additions file; the config changes the role from a replacement to additions. Lines move; none is reworded beyond a broken cross-reference.

**Acceptance criteria**

- For each doc, a line-level diff of `pnpm prd doc <role>` against the doc before the split shows moved lines only (the hand-off shows it, with each reworded cross-reference listed); the lint finds no Caretook name or app path in a generic doc; each half has its budget figure, the two adding up to the role's figure today, and `pnpm docs:budget` passes; edits made on `dev` to these docs since the slice branched are re-applied.

**Blocked by:** 5. **Blocks:** 7.

## Slice 7: The role docs split, group 2: orchestrator, planner, backlog, inbox

Stack: no · Reads: docs/agents/orchestrator.md, docs/agents/planner.md, docs/agents/backlog.md, docs/agents/inbox.md · Tests: unit

**User stories:** 9.

**What to build**

- As slice 6, for these four docs. The planner sections `skeptics.mjs` reads by heading stay findable in the merged text.

**Acceptance criteria**

- As slice 6; the skeptic brief (`pnpm prd prompt skeptic plan`) prints the same rules as before.

**Blocked by:** 6. **Blocks:** 8.

## Slice 8: The role docs split, group 3: machinery and the human guide

Stack: no · Reads: docs/agents/machinery.md, docs/orchestration.md · Tests: unit

**User stories:** 9.

**What to build**

- As slice 6, for the machinery doc and `docs/orchestration.md`. `preferences.md` and `docs/layout.md` are Caretook's and don't split.
- This PRD's own last-landing doc updates go into the right halves.
- The doc points of the skeptics' follow-ups: `docs/agents/loop.md` opens with a pointer to `pnpm prd doc loop` (B-846); the merged docs read in order (B-847 point 9: a generic one-line intro per role, or an additions file that can prepend; the orchestrator and planner intros mid-document, the generic backlog doc opening with _Deciding what's next_); the orchestrator halves' budgets get room (B-847 point 10), the two still adding up to the role's figure.

**Acceptance criteria**

- As slice 6; every role in the config is now generic plus additions, none a replacement.

**Blocked by:** 7. **Blocks:** `orchestration-split-3`.

## Slice 9: The stage 1a skeptics' follow-ups: prefixes, config and CI

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** 3, 6. Backlog items B-838 and B-842 (added 2026-11-25 on the user's word; `pnpm backlog show` has each numbered point with its file and line). Wave 4 split the old slice 9 in two (the user allowed it): this one and slice 10.

**What to build**

- **B-838:** a test ties the verdict fixtures and the one `VERDICT_VERSION` to `buildVerdict`; a former id prefix, when set, is read everywhere the current one is matched (the inbox tags, `land.sh --fixes`, `prd.sh`, the plan prompt, the CI args, lists and blame), with a test of an ingest under a new prefix; `tidy-cli.mjs` and `pr.sh` take a slice's topic and the branch prefixes through the one helper; `ls.sh` escapes the prefix in its pattern; a broken `risa.json` gives each importer of `registry.mjs` and `format.mjs` its own clear error; `outstanding.mjs` and `prd.sh`'s help take the branch prefixes from the config.
- **B-842:** `doc-budget.mjs` exits 2 on any error that isn't a breach; the eight `scripts/ci` modules read the tier data when first used, not at import; `proposedTiers` and `tierRank` load the config once; an unset `ciFailureTopic` refuses to file; `prd.sh`'s check case tells a failed `git diff` from a failed check plan; `isFolder` stats under `--repo`; the core's `nextSlice` has its own test; `landing.mjs` reads the reset command from the config and `land.sh`'s next-steps line drops "after landing"; the `vitest.config.ts` comment; `check-areas.test` and `test-projects.test` pass without the core or join the PRD's residual list.
- Not here: Risa's id counter starting above Caretook's highest id (the move runbook's step 3). A point that turns out to need a choice of the PRD's _Decisions_ size is left, with a note on its item. Slice 10 edits `tidy-cli.mjs`, `ls.sh` and `prd.sh` too, on other lines: keep each change to the lines its point names.

**Acceptance criteria**

- Each numbered point of the two items is fixed with a test, or named in the hand-off with why it was left; `pnpm test:tooling` passes; no behaviour of Caretook's commands changes (the prompt goldens and the CI verdict fixtures pass unchanged).

**Blocked by:** 3, 7 (they change the same scripts and docs). **Blocks:** `orchestration-split-3`.

## Slice 10: The stage 1b skeptics' follow-ups: stack, test DB, lease and hooks

Stack: no · Reads: docs/agents/machinery.md, docs/agents/recovery.md · Tests: unit

**User stories:** 3, 6. Backlog items B-844, B-846 and B-847 (on the user's word, relayed by split-ops 2026-11-25; `pnpm backlog show` has each numbered point with its file and line).

**What to build**

- **B-844** (but point 2, slice 2's): the browser lease test finds the tool in CI after the move; the lease spawn's exec takes more than a simple command, or refuses one clearly; `sectionOf`'s fence and heading edge cases; `test-db.sh` gives a clear error outside git.
- **B-846** (but point 3, slice 3's, and the `docs/agents/loop.md` pointer, slice 8's): `stack_facts` takes the project from `.env`'s `CARETOOK_STACK` as teardown does, and a SLOT outside 1 to 19 is an error; `--env-only` writes the `--base` given; the `cd … && pwd` under `CDPATH`. `stack_hook` needing the project root after the move goes to the move runbook as a note.
- **B-847** points 1 to 6, 8, 11 and 12: tidy and `readyFacts` tell a failed `stackReady` from no stack (skip volume findings when a hook failed, with a `tidy-cli` test); `ready` tells not-ready from a failed hook (a distinct exit code or an always-printed fact, read by `gc.sh`, `ls.sh` and `inventory-facts.mjs`); tidy's plain read uses the cheap dangling-volume listing; `new.sh` writes the env file before install (a failed install leaves no second slot lease); `recover.sh` writes the migrate marker only around the migrate, with the dropped marker test back through the stub's `SAMPLE_STACK_MARK`; `hooks.mjs` gets its own unit test, and no `stackEngine` hook means no engine (recover doesn't die); `packages/notifications/src/config.ts`'s comment names `scripts/project/serve.sh`; slice 3's touched files leave the allowlist where the swap allows; `test-db.sh use`'s human line. Not here: point 7 (Docker words, `orchestration-split-3`), points 9 and 10 (the docs, slice 8).
- A point that turns out to need a choice of the PRD's _Decisions_ size is left, with a note on its item. Slice 9 edits `tidy-cli.mjs`, `ls.sh` and `prd.sh` too, on other lines: keep each change to the lines its point names.

**Acceptance criteria**

- Each point named above is fixed with a test, or named in the hand-off with why it was left; `pnpm test:tooling` passes; no behaviour of Caretook's commands changes (the prompt goldens pass unchanged).

**Blocked by:** 3, 7. **Blocks:** `orchestration-split-3`.
