# Plan: Orchestration split (stage 1a, the seams)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split`. Next: [`orchestration-split-2-plan.md`](orchestration-split-2-plan.md), [`orchestration-split-3-plan.md`](orchestration-split-3-plan.md), then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**On hold** (registry row `orchestration-split`, flag `hold`): the user lifts it. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Likely Fable candidates: slice 1 (the lint's rules decide what every later slice must clear) and slice 5 (the tier data has nine core readers).

| Slice | Wave | State   | Merge into `prd/orchestration-split` |
| ----- | ---- | ------- | ------------------------------------ |
| 1     | 1    | planned |                                      |
| 2     | 2    | planned |                                      |
| 6     | 2    | planned |                                      |
| 3     | 3    | planned |                                      |
| 4     | 4    | planned |                                      |
| 5     | 4    | planned |                                      |
| 7     | 5    | planned |                                      |
| 8     | 5    | planned |                                      |

**Backlog:** B-543 closes with the move (the runbook's last step).

## Architectural decisions

- **No behaviour change.** No new dependencies, no migration, no app-code change.
- **The names every slice uses:** the project config is `risa.json` at Caretook's root (JSON), read by the core loader in Node and by `config get` in bash; the project folder is `scripts/project/`; Caretook's tooling tests run with `pnpm test:project`; the tool is Risa, and until the move its commands stay `pnpm prd` and `pnpm backlog`, named through the config.
- **The core manifest is data:** every file under `scripts/loops`, `scripts/backlog`, `scripts/ci`, `scripts/project` and `.githooks` with its owner (core or Caretook), tests included, one line per file, sorted. The lint and the move's `filter-repo` read it.
- **The boundary lint** is its own module, run as a test in the `tooling:unit` project (so `pnpm test:tooling` and GitHub CI's unit job both run it). It is not `tooling-lint.mjs`, which is eslint and prettier on changed tooling files. It works both ways and in every form (import, spawn, path string, `--import`): no Caretook name, app path or `CARETOOK_` variable in a core file; no core file reaching a Caretook file; no Caretook file anywhere in the repo reaching a core file. Minus an allowlist, one line per entry, that each slice shrinks; stage 1 ends with only the PRD's named residual list.
- **A slice edits only its own lines** of the manifest and the allowlist, so two slices in a wave never edit the same line.
- **`pnpm check` runs the same tests until the move:** `pnpm test`, `test:tooling` and `test:browser-harness` keep today's sets, whatever the Vitest projects are renamed to. `pnpm test:tooling` stays the core's runner (`tooling-lint.mjs`, then `tooling-tests.mjs`); `pnpm test:project` is plain `vitest run` on Caretook's tooling project and needs no core file.
- **`scripts/project/` is tooling** to the check plan, the tooling lint and the check-area map from the first file that moves there (slice 6); without that a moved file asks for the `full` tier as "a file no rule covers".
- **Other worktrees** (PRD _Decisions_): a wave that moves a script other worktrees call lands only when none is open, or each is synced with `dev` right after.
- **Pure modules decide, scripts act** (prior art: `inventory.mjs` with `inventory-facts.mjs`). Tests never start a real `claude`, tab, Docker or GitHub call.

## How to run this plan

- **Start only when the tooling is quiet:** no `fixes-tooling` wave or other topic with `scripts/loops/`, `scripts/backlog/`, `scripts/ci/` or `.githooks/` hot. The three stage-1 topics run one after another, never side by side.
- **Wave 1:** slice 1. **Wave 2:** slices 2 and 6 (2 owns `scripts/backlog/` and `lib.sh`; 6 owns `package.json`, `vitest.config.ts`, `.github/workflows/`, `host-headers.mjs`, `log.sh` and the moves of the check-areas and doc-budget engines). **Wave 3:** slice 3 (it edits `lib.sh` after slice 2). **Wave 4:** slices 4 and 5 (4 owns the prompts and goldens; 5 owns `scripts/ci/` and the core files that import it). **Wave 5:** slices 7 and 8 (7 edits `land.sh`, `check-body.sh`, `prd.sh` and `browser.sh` after slices 3 and 5; 8 owns `scripts/ci/` after slice 5).
- **Tiers** (what the check plan proposes, once at landing): wave 1 adds `risa.json` at the root, a file no rule covers yet: `full`; waves 2, 4 and 5 touch `package.json`, `vitest.config.ts`, `.github/` or `scripts/ci/`: `full`; wave 3 edits `lib.sh`, which the browser harness test covers: `integration`. Every wave also runs `pnpm test:tooling`.
- **Docs at the last landing:** [machinery](../docs/agents/machinery.md) (the config, the manifest, the lint, the CI split, the check plan's rules, `pnpm test:project`), [orchestrator](../docs/agents/orchestrator.md), [loop](../docs/agents/loop.md), [orchestration](../docs/orchestration.md), `pnpm prd help`.

## Slice 1: The config, the manifest and the boundary lint

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 1, 2.

**What to build**

- `risa.json` at Caretook's root, its shape as in the PRD's _Implementation decisions_, filled with today's values; the core loader that validates it with a clear error per missing or wrong field; `config get <key>` for bash, used by one bash caller in this slice (`lib.sh`'s trunk name) so the bash side is real from the start. Bash reads the config once per process.
- The core manifest, each file with its owner as the PRD's _Decisions_ assign them.
- The boundary lint over it, a test in `tooling:unit`, starting with an allowlist of today's offenders.

**Acceptance criteria**

- Unit tests: the loader accepts Caretook's config and rejects each malformed field; `config get` returns the same values as the loader; the lint fails on a planted offender for each rule and form and passes the allowlist; every tracked file under the folders is in the manifest; sourcing `lib.sh` starts Node at most once for the config (a test counts the starts on a stubbed `node`).

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
- **The check plan's rules become Caretook's data** (PRD _Decisions_, asked): the tables in `check-plan.mjs` (what only the whole suite vouches for, the tier by path, what is tooling, the own-test pattern, what the browser harness test covers) move to a data file in `scripts/project/` named in the config, with `risa.json` itself listed as tooling. The engine stays core and reads it; `dev-brought.mjs`, `tooling-lint.mjs` and `tooling-tests.mjs` keep asking the engine.

**Acceptance criteria**

- A sample config with different commands changes what the tests see run; the helper returns the configured names; the repo finder gives today's answer from a main checkout and from a worktree; the check plan gives the same mode, tier and reason as before for a table of sample diffs (one per rule), and a sample project's rules change the answers; `check-plan.mjs` names no app path; the touched files leave the allowlist.

**Blocked by:** 1, 2 (`lib.sh`), 6 (`scripts/project/` exists). **Blocks:** 4, 5, 7.

## Slice 4: Prompts through the config, and the sample project

Stack: no · Reads: docs/agents/machinery.md, docs/agents/planner.md · Tests: unit

**User stories:** 1, 8.

**What to build**

- The prompts read the agents doc, role docs and plans paths and the command names from the config (the role docs become a command in `orchestration-split-2` slice 5).
- A sample project (a `risa.json` and a small fixture repo) for the core's tests.
- The prompt golden splits: a core golden rendered from the sample project, and Caretook's.

**Acceptance criteria**

- Both goldens pass; the sample project's paths and command names show in its golden; the prompts leave the allowlist.

**Blocked by:** 2, 3. **Blocks:** `orchestration-split-2`.

## Slice 5: The CI split, part 1: the tier data and the lists

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 6.

**What to build**

- `scripts/ci/` gets its owners in the manifest as the PRD's _Implementation decisions_ list them (folders change at the move).
- The tier names, their order and each tier's jobs become a data file Caretook owns, named in the config. Caretook's `tiers.mjs` (the workflow's plan job, on the bare runner's Node) and the core's nine readers (`ci-args`, `ci-commits`, `ci-runs`, `ci-status`, `gate`, `outstanding`, `promote`, `blame` and `check-plan.mjs`) each read the file; no core file imports `tiers.mjs`.
- The lists parser is copied (PRD _Decisions_): Caretook's `lists.mjs` for `vitest.config.ts`, `test-job`, `verdict` and `quarantine-setup`; the core's copy for `blame`, `filing` and `release`. The two lists stay where they are, at their config paths.

**Acceptance criteria**

- The lint reports no core import of `tiers.mjs` or of Caretook's `lists.mjs`; the CI tests and `pnpm prd ci` tests pass; `node scripts/ci/tiers.mjs <ref>` prints the same lines as before for one ref per tier, with Node's own modules only.

**Blocked by:** 1, 3 (`check-plan.mjs`). **Blocks:** 7, 8.

## Slice 6: Caretook's runners call nothing in the core

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 6.

**What to build**

- The check-areas and doc-budget engines (with their own copies of `package-diff.mjs` and `status-trim.mjs`), the doc-budget data (`doc-budget.config.mjs`, beside its engine), `host-headers.mjs`, `log.sh` and `sync-matrix.test.mjs` move to `scripts/project/`. The check-areas engine reads its areas folder from a config path, so the folder's later move is one line; `.github/workflows/ci.yml`, `pnpm check`'s doc budget and `pnpm log` reach only them. The core's callers keep working through a forwarding path until slice 7.
- The Vitest projects split by folder: Caretook's tooling tests (hooks, CI jobs, `scripts/project/**`) and the core's; `pnpm test`, `test:tooling` and `test:browser-harness` keep exactly today's test sets; `pnpm test:project` runs Caretook's alone. Later slices that move tests into `scripts/project/` need no Vitest change. `pnpm test:project` is plain `vitest run` on that project, with no core runner.
- `scripts/project/` becomes tooling: the check plan's tooling pattern, the tooling lint, a `_global` row in the check-area map, and the rule in AGENTS.md's _Checks_.

**Acceptance criteria**

- Each of `pnpm test`, `test:tooling` and `test:browser-harness` lists the same test files before and after (the hand-off shows both `vitest list` outputs, equal but for the moved paths); a lasting test: every tooling test is in exactly one owner's project.
- A change to a file in `scripts/project/` alone proposes the tier `none` and is linted by `pnpm test:tooling`.
- In a temporary copy without the core files, `pnpm check`'s doc budget, the check-areas lint and `pnpm test:project` run.

**Blocked by:** 1. **Blocks:** 3, 7.

## Slice 7: The core calls Caretook's engines through hooks

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 2, 3.

**What to build**

- The core's callers of the check-areas and doc-budget engines (the landing's budget check, the check body, the front door, the browser gate) call them through the config's check-areas and doc-budget hooks; the forwarding path from slice 6 goes.

**Acceptance criteria**

- The landing's budget check and the check plan give the same answers as before on a sample diff; the lint finds no core spawn or path string reaching `scripts/project/`; the touched files leave the allowlist.

**Blocked by:** 3, 5, 6. **Blocks:** `orchestration-split-2`.

## Slice 8: The CI split, part 2: the verdict, the release code and the proof

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 6.

**What to build**

- The remaining references across the line are cut: the core's `ci-runs.mjs` reads a verdict as a file with its own reader instead of importing `verdict.mjs`; `verdict.mjs` stops importing the release code. The browser job's call to `browser.sh` and its path to the checks manifest are `orchestration-split-3` slice 1's (the runner split) and stay allowlisted until then.

**Acceptance criteria**

- The lint reports no reference across the line for `scripts/ci/` except the allowlisted runner call and manifest path; the CI tests and `pnpm prd ci` tests pass; in a temporary copy without the core's files, the test job, verdict, zones, env and tiers modules load and their tests pass.

**Blocked by:** 5. **Blocks:** `orchestration-split-2`.
