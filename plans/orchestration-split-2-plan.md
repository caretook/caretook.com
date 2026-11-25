# Plan: Orchestration split 2 (stage 1b, the stack, test DB, lease and role docs)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split-2`, after `orchestration-split`. Next: [`orchestration-split-3-plan.md`](orchestration-split-3-plan.md), then the runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**On hold** (registry row `orchestration-split-2`, flag `hold`, after `orchestration-split`): the user lifts it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Slice 3 is the same swap in about ten scripts: a sonnet candidate once slice 2 has set the pattern.

| Slice | Wave | State   | Merge into `prd/orchestration-split-2` |
| ----- | ---- | ------- | -------------------------------------- |
| 1     | 1    | planned |                                        |
| 4     | 1    | planned |                                        |
| 5     | 1    | planned |                                        |
| 2     | 2    | planned |                                        |
| 3     | 3    | planned |                                        |

## Architectural decisions

As in [`orchestration-split-plan.md`](orchestration-split-plan.md) (the names, the manifest, the lint, the test sets), plus:

- **The stack hook contract:** the core calls `stack up|down|status|ready` and `test-db` through the config; each prints facts as `key=value` lines (slot, ports, container names, URLs) and exits non-zero on failure. The core parses only those lines and knows no Docker, Postgres or PowerSync detail.
- **Leases keep their folder** (`.loops/.lease/<kind>/`) and their one implementation, the core's.
- **Other worktrees** (PRD _Decisions_): waves 1 and 2 move scripts every worktree calls (the test DB, the stack, serve). Each lands only when no other PRD, plan or hotfix worktree is open, or each is synced with `dev` right after.
- **The role docs** (PRD _Decisions_, asked): one generic doc per role, the core's; a project adds one additions file per role or replaces the role whole, through the config; `pnpm prd doc <role>` prints the merged text.

## How to run this plan

- **Start only when** `orchestration-split` has landed and the tooling is quiet.
- **Wave 1:** slices 1, 4 and 5 (1 owns `test-db.sh`, the data package's test setup and its PowerSync script; 4 owns the lease CLI, `lease.sh`, `lease.mjs` and `apps/web/test/`; 5 owns `docs/agents/`, `docs/orchestration.md`, the prompts and the new doc command). **Wave 2:** slice 2 (`stack-lib.sh`, `stack.sh`, `serve.sh`, `lib.sh`'s stack functions). **Wave 3:** slice 3 (the inventory, reclaim, recover, tidy and worktree scripts).
- **Tiers** (what the check plan proposes, once at landing): wave 1 touches `packages/data/` and `apps/web/test/`: `components`; wave 2 edits `serve.sh` and `lib.sh`, which the browser harness test covers: `integration`; wave 3 is tooling only. Waves 2 and 3 also need a stack: one `pnpm prd stack up` and down each. Every wave runs `pnpm test:tooling`.
- **Docs at the last landing:** [machinery](../docs/agents/machinery.md) (the stack hooks and their contract, the lease command, the doc command and how a project adds to a role), [loop](../docs/agents/loop.md), [hotfix](../docs/agents/hotfix.md).

## Slice 1: The test DB as Caretook's

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit, integration

**User stories:** 3, 6.

**What to build**

- `test-db.sh` moves to `scripts/project/` and stops sourcing `stack-lib.sh` (it gets the few values it needs from `config get`); the data package's test setup and PowerSync script call it there. The core calls it through the `test-db` hook.

**Acceptance criteria**

- `pnpm prd check` passes (integration tests on the shared test Postgres); the test-DB tests pass from their new home; the lint finds no core path in the data package's test setup; a worktree made before this slice still runs its integration tests after one dev sync.

**Blocked by:** `orchestration-split`. **Blocks:** 2.

## Slice 2: Stack up, down and serve as Caretook's

Stack: yes · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 3.

**What to build**

- `stack-lib.sh` splits: the stack facts (compose projects, ports, env files, containers, images) move to `scripts/project/` behind `stack up|down|status|ready`; the core logic in it (slice state, held and merged slices, gc ages, the outstanding-runs call) stays core. `stack.sh` and `serve.sh` move with the stack facts.

**Acceptance criteria**

- `pnpm prd stack up`, `status` and `down` on the slice's own stack print the same facts as a capture taken before the change; the stack tests pass on a stubbed `docker`; the touched core files leave the allowlist.

**Blocked by:** 1. **Blocks:** 3.

## Slice 3: The core reads stack facts only through the hooks

Stack: yes · Reads: docs/agents/machinery.md, docs/agents/recovery.md · Tests: unit

**User stories:** 3.

**What to build**

- The inventory, reclaim, recover, tidy, gc, down, new and rm scripts stop knowing Docker, compose, ports and `caretook_test_*` names: they read the stack hook's `status` facts and call its `down`.
- About 10 scripts and their tests; each change is the same swap from a direct Docker or port read to the hook.
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

## Slice 5: The role docs split and the doc command

Stack: no · Reads: docs/agents/machinery.md, docs/agents/planner.md · Tests: unit

**User stories:** 8, 9.

**What to build**

- `pnpm prd doc <role>` (core): prints the role's generic doc, then the project's additions file when the config names one; or the project's replacement alone when the config names that instead. An unknown role or a named file that is missing is a clear error.
- Each role doc (`loop`, `orchestrator`, `planner`, `backlog`, `inbox`, `hotfix`, `recovery`, `machinery`) and `docs/orchestration.md` splits in place: the generic text becomes the core's doc (in the manifest as core, beside the prompts); what only Caretook needs (its stack, commands, areas, checks, the rules across PRDs that name app files) stays in `docs/agents/<role>.md` as the additions file. `preferences.md` and `docs/layout.md` are Caretook's and don't split. No rule is lost or reworded beyond what the cut needs.
- The prompts, AGENTS.md's _Area index_ and the slice `Reads` convention name the command for a role; area docs keep their paths.
- Caretook's doc budget covers its additions; the generic docs get the same per-file budget in the core's own list.

**Acceptance criteria**

- Unit tests on the sample project: generic alone, generic plus additions (additions last), a replacement alone, and both errors. Both prompt goldens pass and name the command.
- For each role, `pnpm prd doc <role>` holds every heading the doc had before the split (the hand-off lists them, before and after); the lint finds no Caretook name or app path in a generic doc; `pnpm docs:budget` passes.

**Blocked by:** `orchestration-split`. **Blocks:** `orchestration-split-3`.
