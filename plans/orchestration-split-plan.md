# Plan: Orchestration split (stage 1a, the seams)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split`. Next: [`orchestration-split-2-plan.md`](orchestration-split-2-plan.md), [`orchestration-split-3-plan.md`](orchestration-split-3-plan.md), then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**On hold** (registry row `orchestration-split`, flag `hold`): the user lifts it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size.

| Slice | Wave | State   | Merge into `prd/orchestration-split` |
| ----- | ---- | ------- | ------------------------------------ |
| 1     | 1    | planned |                                      |
| 2     | 2    | planned |                                      |
| 6     | 2    | planned |                                      |
| 3     | 3    | planned |                                      |
| 4     | 4    | planned |                                      |
| 5     | 4    | planned |                                      |
| 7     | 5    | planned |                                      |

**Backlog:** B-543 closes with the move (the runbook's last step).

## Architectural decisions

- **No behaviour change.** No new dependencies, no migration, no app-code change.
- **The names every slice uses:** the project config is `risa.json` at Caretook's root (JSON), read by the core loader in Node and by `config get` in bash; the project folder is `scripts/project/`; Caretook's tooling tests run with `pnpm test:project`; the tool is Risa, and until the move its commands stay `pnpm prd` and `pnpm backlog`, named through the config.
- **The core manifest is data:** every file under `scripts/loops`, `scripts/backlog`, `scripts/ci`, `scripts/project` and `.githooks` with its owner (core or Caretook), tests included, one line per file, sorted. The lint and the move's `filter-repo` read it.
- **The boundary lint** runs in `pnpm test:tooling`, both ways and in every form (import, spawn, path string, `--import`): no Caretook name, app path or `CARETOOK_` variable in a core file; no core file reaching a Caretook file; no Caretook file anywhere in the repo reaching a core file. Minus an allowlist, one line per entry, that each slice shrinks; stage 1 ends with only the PRD's named residual list.
- **A slice edits only its own lines** of the manifest and the allowlist, so two slices in a wave never edit the same line.
- **`pnpm check` runs the same tests until the move:** `pnpm test`, `test:tooling` and `test:browser-harness` keep today's sets, whatever the Vitest projects are renamed to.
- **Pure modules decide, scripts act** (prior art: `inventory.mjs` with `inventory-facts.mjs`). Tests never start a real `claude`, tab, Docker or GitHub call.

## How to run this plan

- **Start only when the tooling is quiet:** no `fixes-tooling` wave or other topic with `scripts/loops/`, `scripts/backlog/`, `scripts/ci/` or `.githooks/` hot. The three stage-1 topics run one after another, never side by side.
- **Wave 1:** slice 1. **Wave 2:** slices 2 and 6 (2 owns `scripts/backlog/` and `lib.sh`; 6 owns `package.json`, `vitest.config.ts`, `.github/workflows/`, `host-headers.mjs`, `log.sh` and the moves of the check-areas and doc-budget engines). **Wave 3:** slice 3 (it edits `lib.sh` after slice 2). **Wave 4:** slices 4 and 5 (4 owns the prompts and goldens; 5 owns `scripts/ci/` and the core files that import it). **Wave 5:** slice 7 (it edits `land.sh`, `check-body.sh`, `prd.sh` and `browser.sh` after slices 3 and 5).
- **Tiers** (the gate's, once at landing): wave 1 adds `risa.json` at the root (lint and prettier see it); waves 2 and 4 touch `package.json`, `vitest.config.ts`, `.github/` or `scripts/ci/`: `full`; waves 3 and 5 are tooling only (`pnpm test:tooling`, prettier on what changed).
- **Docs at the last landing:** [machinery](../docs/agents/machinery.md) (the config, the manifest, the lint, the CI split, `pnpm test:project`), [orchestrator](../docs/agents/orchestrator.md), [loop](../docs/agents/loop.md), [orchestration](../docs/orchestration.md), `pnpm prd help`.

## Slice 1: The config, the manifest and the boundary lint

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 1, 2.

**What to build**

- `risa.json` at Caretook's root, its shape as in the PRD's _Implementation decisions_, filled with today's values; the core loader that validates it with a clear error per missing or wrong field; `config get <key>` for bash, used by one bash caller in this slice (`lib.sh`'s trunk name) so the bash side is real from the start.
- The core manifest, each file with its owner as the PRD's _Decisions_ assign them.
- The boundary lint over it, wired into `pnpm test:tooling`, starting with an allowlist of today's offenders.

**Acceptance criteria**

- Unit tests: the loader accepts Caretook's config and rejects each malformed field; `config get` returns the same values as the loader; the lint fails on a planted offender for each rule and form and passes the allowlist; every tracked file under the folders is in the manifest.

**Blocked by:** none. **Blocks:** 2, 3, 4, 5, 6, 7.

## Slice 2: Backlog, registry and branches through the config

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** 1, 2.

**What to build**

- The backlog and registry read the backlog, inbox and archive paths and the PRDs table heading from the loader; `lib.sh`'s exempt paths and branch names (trunk, protected, prefixes) come from `config get`.
- The hooks keep their protected-branch constant (PRD _Decisions_); a Caretook test checks it matches the config.

**Acceptance criteria**

- The backlog, registry and hook tests pass unchanged; a test drives the backlog with a sample config's paths; the touched files leave the allowlist.

**Blocked by:** 1. **Blocks:** 3, 4.

## Slice 3: Commands through the config

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 1, 8.

**What to build**

- Every command the core **runs** (check, quick check, project tests, typecheck, typegen, datastore start, reset and seed) comes from the config, in the front door, the unsynced check and the landing (`prd.sh`, `unsynced.sh`, `land.sh`).
- The core's own command names (`pnpm prd`, `pnpm backlog`) become one config value with a helper; this slice builds the helper only. Every printed hint is `orchestration-split-3`'s scripted sweep.
- How a command finds its repo and `.loops/` is one function in `lib.sh` (the main checkout, as today), ready for `risa`'s machine config.

**Acceptance criteria**

- A sample config with different commands changes what the tests see run; the helper returns the configured names; the repo finder gives today's answer from a main checkout and from a worktree; the touched files leave the allowlist.

**Blocked by:** 1, 2 (`lib.sh`). **Blocks:** 4, 7.

## Slice 4: Prompts through the config, and the sample project

Stack: no · Reads: docs/agents/machinery.md, docs/agents/planner.md · Tests: unit

**User stories:** 1, 8.

**What to build**

- The prompts read the agents doc, role docs and plans paths and the command names from the config.
- A sample project (a `risa.json` and a small fixture repo) for the core's tests.
- The prompt golden splits: a core golden rendered from the sample project, and Caretook's.

**Acceptance criteria**

- Both goldens pass; the sample project's paths and command names show in its golden; the prompts leave the allowlist.

**Blocked by:** 2, 3. **Blocks:** `orchestration-split-2`.

## Slice 5: The CI split

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 6.

**What to build**

- `scripts/ci/` splits as the PRD's _Decisions_ say: Caretook keeps the GitHub CI jobs (browser job, test job, zones, env, verdict) and the tier data; the gate, candidate, promote, outstanding and filing logic is core (manifest owners change; folders change at the move).
- Every reference across the line is cut: the gate reads the check plan's output and the tier data as files, the CI jobs write notices as files, `verdict.mjs` stops importing the release code, `browser.test.mjs` stops importing the browser job. The browser job's call to `browser.sh` is `orchestration-split-3` slice 1's (the runner split) and stays allowlisted until then.

**Acceptance criteria**

- The lint reports no reference across the line for `scripts/ci/` except the allowlisted runner call; the CI tests and `pnpm prd ci` tests pass; in a temporary copy without the core folders, the test job, verdict and zones modules load and their tests pass.

**Blocked by:** 1. **Blocks:** 7.

## Slice 6: Caretook's runners call nothing in the core

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 6.

**What to build**

- The check-areas and doc-budget engines (with their own copies of `package-diff.mjs` and `status-trim.mjs`), `host-headers.mjs` and `log.sh` move to `scripts/project/`; `.github/workflows/ci.yml`, `pnpm check`'s doc budget and `pnpm log` reach only them. The core's callers keep working through a forwarding path until slice 7.
- The Vitest projects split by folder: Caretook's tooling tests (hooks, CI jobs, `scripts/project/**`) and the core's; `pnpm test`, `test:tooling` and `test:browser-harness` keep exactly today's test sets; `pnpm test:project` runs Caretook's alone. Later slices that move tests into `scripts/project/` need no Vitest change.

**Acceptance criteria**

- Each of `pnpm test`, `test:tooling` and `test:browser-harness` lists the same test files before and after (a test compares the lists); every tooling test is in exactly one owner's project.
- In a temporary copy without the core files, `pnpm check`'s doc budget, the check-areas lint and `pnpm test:project` run.

**Blocked by:** 1. **Blocks:** 7.

## Slice 7: The core calls Caretook's engines through hooks

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 2, 3.

**What to build**

- The core's callers of the check-areas and doc-budget engines (the landing's budget check, the check body, the front door, the browser gate) call them through the config's check-areas and doc-budget hooks; the forwarding path from slice 6 goes.

**Acceptance criteria**

- The landing's budget check and the check plan give the same answers as before on a sample diff; the lint finds no core spawn or path string reaching `scripts/project/`; the touched files leave the allowlist.

**Blocked by:** 3, 5, 6. **Blocks:** `orchestration-split-2`.
