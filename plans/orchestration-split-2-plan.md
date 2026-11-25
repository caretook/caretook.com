# Plan: Orchestration split 2 (stage 1b, the stack, test DB, lease and role docs)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split-2`, after `orchestration-split`. Next: [`orchestration-split-3-plan.md`](orchestration-split-3-plan.md), then the runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**On hold** (registry row `orchestration-split-2`, flag `hold`, after `orchestration-split`): the user lifts it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Slice 3 is the same swap in about ten scripts: a sonnet candidate once slice 2 has set the pattern. The doc splits (6 to 8) need judgement on what is generic: opus.

| Slice | Wave | State   | Merge into `prd/orchestration-split-2` |
| ----- | ---- | ------- | -------------------------------------- |
| 1     | 1    | planned |                                        |
| 4     | 1    | planned |                                        |
| 5     | 1    | planned |                                        |
| 2     | 2    | planned |                                        |
| 6     | 2    | planned |                                        |
| 3     | 3    | planned |                                        |
| 7     | 3    | planned |                                        |
| 8     | 4    | planned |                                        |

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
- **Wave 1:** slices 1, 4 and 5 (1 owns `test-db.sh` and the data package's test setup; 4 owns the lease CLI, `lease.sh`, `lease.mjs` and `apps/web/test/`; 5 owns `prd.sh`, the doc command, the prompts, `skeptics.mjs` and AGENTS.md). **Wave 2:** slices 2 and 6 (2 owns `stack-lib.sh`, `stack.sh`, `serve.sh` and `lib.sh`'s stack functions; 6 owns the loop, hotfix and recovery docs). **Wave 3:** slices 3 and 7 (3 owns the inventory, reclaim, recover, tidy and worktree scripts; 7 owns the orchestrator, planner, backlog and inbox docs). **Wave 4:** slice 8 (the machinery doc and `docs/orchestration.md`).
- **Tiers** (what the check plan proposes, once at landing): wave 1 touches `packages/data/` and `apps/web/test/`: `components`; wave 2 edits `serve.sh` and `lib.sh`, which the browser harness test covers: `integration`; waves 3 and 4 are tooling and docs only. Waves 2 and 3 also need a stack: one `pnpm prd stack up` and down each. Every wave runs `pnpm test:tooling`.
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
- The core's tests stop importing app code: `stack.test.mjs` and `tidy.test.mjs` take the test-database name from the hook's facts or the sample project, not from `packages/data/`.

**Acceptance criteria**

- `pnpm prd status`, `pnpm prd tidy --dry-run` and `pnpm prd recover --dry-run` print the same before and after, captured together with nothing landing between; their tests pass on a stubbed hook; no core test imports from `apps/` or `packages/`; the touched files leave the allowlist.

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
- In this slice every role is a **replacement**: the config points each role at today's file in `docs/agents/` (and `docs/orchestration.md`), and no text moves.
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

**Acceptance criteria**

- As slice 6; every role in the config is now generic plus additions, none a replacement.

**Blocked by:** 7. **Blocks:** `orchestration-split-3`.
