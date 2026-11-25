# Plan: Orchestration split (stage 1a, the seams)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split`. Next: [`orchestration-split-2-plan.md`](orchestration-split-2-plan.md), [`orchestration-split-3-plan.md`](orchestration-split-3-plan.md), then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**Running** since 2026-11-25, opened by the user by hand (the registry row still carries `hold`, which keeps the dispatcher off it). **Landing mode: run everything through** (the user, 2026-11-25): land each green wave and clean up, asking only real questions. **Slices to start: every ready slice from here** (the user, 2026-11-25, after wave 1 landed): wave 2 (slices 2 and 6) next, then each later wave as its blockers land, without asking again. **Wave 2's slices run on opus** (the user's choice); later waves at the orchestrator's judgement, as below. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Likely Fable candidates: slice 1 (the lint's rules decide what every later slice must clear) and slice 11 (the check's body and what surrounds it part ways). Sonnet candidates: slice 9 (moves) once slice 6 has landed.

| Slice | Wave | State   | Merge into `prd/orchestration-split` |
| ----- | ---- | ------- | ------------------------------------ |
| 1     | 1    | merged  | e90f5f02                             |
| 2     | 2    | started |                                      |
| 6     | 2    | started |                                      |
| 3     | 3    | planned |                                      |
| 9     | 3    | planned |                                      |
| 4     | 4    | planned |                                      |
| 5     | 4    | planned |                                      |
| 10    | 5    | planned |                                      |
| 13    | 5    | planned |                                      |
| 7     | 6    | planned |                                      |
| 8     | 6    | planned |                                      |
| 11    | 6    | planned |                                      |
| 12    | 7    | planned |                                      |

**Backlog:** B-543 closes with the move (the runbook's last step).

**Wave 1** (tier `integration`, plus `pnpm test:tooling`):

- 2026-11-25: slice 1 started: worktree `.loops/orchestration-split-1` on `slice/orchestration-split/1` (from 85c7d058), one background agent on **Fable** (the user's choice: its lint rules and config shape decide what every later slice must clear). The stall watch runs beside it.
- 2026-11-25: slice 1 handed off (f85fa596, slice check green with `CARETOOK_USAGE_WATCH` unset: B-818 filed in `fixes-tooling` for the test that reads it) and merged as e90f5f02. Its worktree stays until the wave is green. The wave's CI run (`pnpm prd ci run integration --wait`) is out.
- 2026-11-25: **wave 1 landed in `dev` as 1029b791** through PR #185, at tier `integration` (CI green on e90f5f02, run 45626511160; the dev sync was a skip). Codex was out of credits, so it landed `--no-review` with no review. Slice 1's worktree and branch are removed. Docs wait for the last landing, as _How to run this plan_ says; the notes below are what to fold. **Next (a fresh session): start wave 2**: `pnpm backlog ingest` and `list`, `pnpm prd sync`, then `pnpm prd slice orchestration-split 2` and `6`, one opus agent each, the stall watch beside them; the wave's tier is `full`. Tell slice agents to unset `CARETOOK_USAGE_WATCH` for their slice check until B-818 lands.

**Wave 2** (tier `full`, plus `pnpm test:tooling`):

- 2026-11-25: the backlog id prefix decision recorded (82234d46, from the backlog session on the user's word): slice 2 does `scripts/backlog/`'s sites; the other `B-` sites go to slices 3, 4, 8 and 13, which own those files.
- 2026-11-25: dev sync was a skip (up to date). Slices 2 and 6 started: worktrees `.loops/orchestration-split-2` and `-6` (from 82234d46), one background **opus** agent each (the user's choice), told to unset `CARETOOK_USAGE_WATCH` for the slice check. The stall watch runs beside them.

**What slice 1 set, for later slices** (fold into machinery at the last landing):

- The config: `risa.json`; the loader `scripts/loops/config.mjs` (`get`, `dump`, `check`; an unknown key is an error); bash `config_get KEY` in `lib.sh`, loaded once at source. `RISA_CONFIG` overrides the path (the throwaway-repo tests set it through `config-fixture.mjs`, until slice 4's sample project). A new optional key `boundary.appPaths` holds the app paths the lint refuses.
- The manifest `scripts/loops/boundary.manifest`: `<path> core|project`, sorted; a new file under the folders needs its line.
- The lint `scripts/loops/boundary.mjs`: rules `project-env`, `project-name`, `app-path`, `core-to-project`, `project-to-core`; the allowlist `boundary.allowlist` is `<path> <rule> <count> [# why]`, exact counts (1,900 findings today), shrunk with `--write`, never grown. Blind spots: paths built from pieces, bare names with no extension, paths inside a regex group.
- Ownership beyond the PRD's lists (one manifest line each to change): the project's are `lint-heap.test.mjs`, `workspace-config.test.mjs`, `fixes-plans.test.mjs`, `check-body.test.mjs`, `check-failed.mjs` and the prompt golden; core for now are `stack-lib.sh`, `stack.test.mjs`, `browser.sh`, `browser.test.mjs`, `ci.test.mjs`, `release.mjs`.
- Left for slice 2: `lib.sh`'s `exempt_re` doesn't name `risa.json` yet.

## Architectural decisions

- **No behaviour change.** No new dependencies, no migration, no app-code change.
- **The names every slice uses:** the project config is `risa.json` at Caretook's root (JSON), read by the core loader in Node and by `config get` in bash; the project folder is `scripts/project/`; the generic role docs live in `scripts/loops/docs/<role>.md` until the move; Caretook's tooling tests run with `pnpm test:project`; the tool is Risa, and until the move its commands stay `pnpm prd` and `pnpm backlog`, named through the config.
- **The core manifest is data:** every file under `scripts/loops`, `scripts/backlog`, `scripts/ci`, `scripts/project` and `.githooks` with its owner (core or Caretook), tests included, one line per file, sorted. The lint and the move's `filter-repo` read it.
- **The boundary lint** is its own module, run as a test in the `tooling:unit` project (so `pnpm test:tooling` and GitHub CI's unit job both run it). It is not `tooling-lint.mjs`, which is eslint and prettier on changed tooling files. It works both ways and in every form (import, spawn, path string, `--import`): no Caretook name, app path or `CARETOOK_` variable in a core file; no core file reaching a Caretook file; no Caretook file anywhere in the repo reaching a core file. Minus an allowlist, one line per entry, that each slice shrinks; stage 1 ends with only the PRD's named residual list.
- **A slice edits only its own lines** of the manifest, the allowlist, `risa.json` and the loader's schema, so two slices in a wave never edit the same line. Slice 1 writes the config's whole shape, with the keys later slices fill in as optional.
- **`pnpm check` runs the same tests until the move:** `pnpm test`, `test:tooling` and `test:browser-harness` keep today's sets, whatever the Vitest projects are renamed to. `pnpm test:tooling` stays the core's runner (`tooling-lint.mjs`, then `tooling-tests.mjs`); `pnpm test:project` is plain `vitest run` on Caretook's tooling project and needs no core file.
- **`scripts/project/` is tooling** to the check plan, the tooling lint and the check-area map before the first file moves there (slice 6, then slice 9's moves); without that a moved file asks for the `full` tier as "a file no rule covers".
- **Other worktrees** (PRD _Decisions_): a worktree runs its own copy of the tooling and keeps working on the old layout until it syncs. The risk is the commands run from the main checkout on another worktree (`status`, `rm`, `gc`, `tidy`, `recover`, the dispatcher). A wave that moves a script those commands call lands only when no other PRD, plan or hotfix worktree is open.
- **Pure modules decide, scripts act** (prior art: `inventory.mjs` with `inventory-facts.mjs`). Tests never start a real `claude`, tab, Docker or GitHub call.

## How to run this plan

- **Start only when the tooling is quiet:** no `fixes-tooling` wave or other topic with `scripts/loops/`, `scripts/backlog/`, `scripts/ci/` or `.githooks/` hot. The three stage-1 topics run one after another, never side by side.
- **Wave 1:** slice 1. **Wave 2:** slices 2 and 6 (2 owns `scripts/backlog/` and `lib.sh`; 6 owns `package.json`, `vitest.config.ts`, `check-plan.mjs`'s tooling pattern, `tooling-lint.mjs`, the `_global` area map and AGENTS.md). **Wave 3:** slices 3 and 9 (3 owns `lib.sh`, `prd.sh`, `unsynced.sh`, `land.sh`, `new.sh` and `ready.sh`; 9 owns the moved files, `package.json`'s `log` and `docs:budget` lines, `ci.yml`, `serve.sh`'s preview line, `check-body.sh`'s check-areas line, `check-plan.mjs`'s harness pattern and the deploy workflow test). **Wave 4:** slices 4 and 5 (4 owns the prompts and goldens; 5 owns the tier data, its two readers, `tiers.mjs` and `check-plan.mjs`'s tier import). **Wave 5:** slices 10 and 13 (10 owns `check-plan.mjs`, `dev-brought.mjs`, `tooling-lint.mjs` and `tooling-tests.mjs`; 13 owns the eight `scripts/ci/` callers of the tier data and the tests that copy `tiers.mjs`). **Wave 6:** slices 7, 8 and 11 (7 owns `land.sh` and `browser.sh`; 8 owns `scripts/ci/`'s lists and release code; 11 owns `check-body.sh`, `check-run.sh`, `check-failed.mjs`, `prd.sh`'s check case and their tests). **Wave 7:** slice 12 (`scripts/ci/ci-runs.mjs`, `verdict.mjs` and the CI tests that cross the line).
- **Tiers** (what the check plan proposes, once at landing): wave 1 edits the `_global` area map, which the browser harness test covers: `integration`; waves 2 to 7 touch `package.json`, `vitest.config.ts`, `.github/` or `scripts/ci/`: `full`. Every wave also runs `pnpm test:tooling`.
- **Docs at the last landing:** [machinery](../docs/agents/machinery.md) (the config, the manifest, the lint, the CI split, the check plan's rules, the check hook, `pnpm test:project`), [orchestrator](../docs/agents/orchestrator.md), [loop](../docs/agents/loop.md), [orchestration](../docs/orchestration.md), `pnpm prd help`.

## Slice 1: The config, the manifest and the boundary lint

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 1, 2.

**What to build**

- `risa.json` at Caretook's root, its whole shape as in the PRD's _Implementation decisions_ (the keys later slices fill in are optional), filled with today's values; the core loader that validates it with a clear error per missing or wrong field; `config get <key>` for bash, used by one bash caller in this slice (`lib.sh`'s trunk name) so the bash side is real from the start. Bash reads the config once per process.
- `risa.json` gets its row in the `_global` area map and counts as tooling to the check plan, so it passes the check-areas lint and asks for no tier of its own.
- The core manifest, each file with its owner as the PRD's _Decisions_ and _Implementation decisions_ assign them.
- The boundary lint over it, a test in `tooling:unit`, starting with an allowlist of today's offenders. The path rules read code and strings, not comments; a comment in a Caretook file that names a core path is corrected at the move (the runbook's step 5).

**Acceptance criteria**

- Unit tests: the loader accepts Caretook's config and rejects each malformed field; `config get` returns the same values as the loader; the lint fails on a planted offender for each rule and form and passes the allowlist; every tracked file under the folders is in the manifest; sourcing `lib.sh` starts Node at most once for the config (a test counts the starts on a stubbed `node`); the check-areas lint passes with `risa.json` tracked.

**Blocked by:** none. **Blocks:** every other slice.

## Slice 2: Backlog, registry and branches through the config

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** 1, 2.

**What to build**

- The backlog and registry read the backlog, inbox and archive paths and the PRDs table heading from the loader; `lib.sh`'s exempt paths and branch names (trunk, protected, prefixes) come from `config get`.
- The hooks keep their protected-branch constant (PRD _Decisions_); a Caretook test checks it matches the config.
- The backlog id prefix and pattern come from the config (PRD _Decisions_: Risa `RISA-n`, Caretook `B-n`): one helper in the loader, used by `scripts/backlog/` (`backlog.mjs`, `format.mjs`, `inbox-edit.mjs`, `inbox-merge.mjs`). The other files that hardcode `B-` swap to the helper in the slice that owns them: `prd.sh` and `land.sh` in slice 3, `prompts/plan.sh` and `slice-brief.mjs` in slice 4, `ci-args.mjs` and `blame.mjs` in slice 13, `lists.mjs` in slice 8.

**Acceptance criteria**

- The backlog, registry and hook tests pass unchanged; a test drives the backlog with a sample config's paths and a different id prefix (new ids, headings, tags and lookups use it); the touched files leave the allowlist.

**Blocked by:** 1. **Blocks:** 3, 4.

## Slice 3: Commands through the config

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 1, 8.

**What to build**

- Every project command the core **runs** (install, check, quick check, project tests, typecheck, typegen, datastore start, reset and seed) comes from the config, in the front door, the unsynced check, the landing, the worktree maker and the readiness check (`prd.sh`, `unsynced.sh`, `land.sh`, `new.sh`, `ready.sh`).
- The core's own command names (`pnpm prd`, `pnpm backlog`) become one config value with a helper; this slice builds the helper only. Every printed hint is `orchestration-split-3`'s scripted sweep.
- How a command finds its repo and `.loops/` is one function in `lib.sh` (the main checkout, as today), ready for `risa`'s machine config.

**Acceptance criteria**

- A sample config with different commands changes what the tests see run; the helper returns the configured names; the repo finder gives today's answer from a main checkout and from a worktree; the touched files leave the allowlist.

**Blocked by:** 1, 2 (`lib.sh`). **Blocks:** 4, 7, 11.

## Slice 4: Prompts through the config, and the sample project

Stack: no · Reads: docs/agents/machinery.md, docs/agents/planner.md · Tests: unit

**User stories:** 1, 8.

**What to build**

- The prompts read the agents doc, role docs and plans paths and the command names from the config (the role docs become a command in `orchestration-split-2` slice 5).
- A sample project (a `risa.json` and a small fixture repo) for the core's tests.
- The prompt golden splits: a core golden rendered from the sample project, and Caretook's.

**Acceptance criteria**

- Both goldens pass; the sample project's paths and command names show in its golden; the prompts leave the allowlist.

**Blocked by:** 2, 3. **Blocks:** 10, `orchestration-split-2`.

## Slice 5: The CI split, part 1: the tier data and its readers

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 6.

**What to build**

- `scripts/ci/` gets its owners in the manifest as the PRD's _Implementation decisions_ list them (folders change at the move).
- Everything the core takes from `tiers.mjs` becomes a data file Caretook owns, named in the config: the tier names and order, each tier's jobs, the file groups with their patterns and tiers, the browser-check path pattern, the two marker file names (the narrowed-run and forced-flake files) and the `ci/` ref prefix.
- Each side has a small reader of it. Caretook's `tiers.mjs` (the workflow's plan job, on the bare runner's Node) reads the file at a fixed path with `node:fs`, not through the core loader; a Caretook test checks that path matches the config, as for the hooks. The core's reader is built and tested here and used by `check-plan.mjs`; the eight CI callers swap to it in slice 13.

**Acceptance criteria**

- The two readers give the same answers on Caretook's data file for every symbol the core takes today (a test compares them); `check-plan.mjs` no longer imports `tiers.mjs`; the CI tests and `pnpm prd ci` tests pass; `node scripts/ci/tiers.mjs <ref>` prints the same lines as before for one ref per tier and for a narrowed commit, with Node's own modules only.

**Blocked by:** 1. **Blocks:** 10, 13.

## Slice 6: `scripts/project/` as tooling, and the test projects

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 6.

**What to build**

- `scripts/project/` becomes tooling: the check plan's tooling pattern, the tooling lint, a `_global` row in the check-area map, and the rule in AGENTS.md's _Checks_.
- The Vitest projects split by owner: Caretook's tooling tests (hooks, Caretook's CI jobs, `scripts/project/**`, and the tests the manifest gives Caretook that still sit in `scripts/loops/`) and the core's. `pnpm test`, `test:tooling` and `test:browser-harness` keep exactly today's test sets; `pnpm test:project` is plain `vitest run` on Caretook's project, with no core runner. A later slice that moves a test into `scripts/project/` needs no Vitest change, except the browser harness test, whose path is named in several places (`orchestration-split-3` slice 1).

**Acceptance criteria**

- Each of `pnpm test`, `test:tooling` and `test:browser-harness` lists the same test files before and after (the hand-off shows both `vitest list` outputs, equal); a lasting test: every tooling test is in exactly one owner's project.
- A change to a file in `scripts/project/` alone proposes the tier `none`, passes the check-areas lint and is linted by `pnpm test:tooling`.

**Blocked by:** 1. **Blocks:** 9.

## Slice 7: The core calls Caretook's engines through hooks

Stack: no · Reads: docs/agents/machinery.md · Tests: unit

**User stories:** 2, 3.

**What to build**

- The core's remaining callers of the check-areas and doc-budget engines (the landing's budget check in `land.sh`, the browser gate in `browser.sh`) call them through the config's check-areas and doc-budget hooks; the forwarding paths from slice 9 go. The check's body calls them directly: it is Caretook's after slice 11.

**Acceptance criteria**

- The landing's budget check and `pnpm prd browser --changed --list` give the same answers as before on a sample diff; the lint finds no core spawn or path string reaching `scripts/project/`; the touched files leave the allowlist.

**Blocked by:** 3, 9. **Blocks:** `orchestration-split-2`.

## Slice 8: The CI split, part 2: the lists parser and the release code

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 6.

**What to build**

- The lists parser is copied (PRD _Decisions_): Caretook's `lists.mjs` for `vitest.config.ts`, `test-job`, `verdict` and `quarantine-setup`; the core's copy for `blame`, `filing` and `release`. The two lists stay where they are, at their config paths.
- `release.mjs` splits by who uses it: the job-name constants and the two summarizers that `verdict.mjs` runs on the GitHub runner (`BROWSER_RUNS`, `ZONE_JOBS`, `combineRepeats`, `summarizeZone`) become a Caretook module beside `verdict.mjs`; the core keeps `zoneFindings` for `ci-file`. The backlog id in it (`ZONE_OVERFLOW_ITEM`) becomes a config value.

**Acceptance criteria**

- `release.test.mjs` splits with the module, each half beside its owner.
- The lint reports no core import of Caretook's `lists.mjs`, no import from `verdict.mjs` into the core's release code, and no backlog id in a core CI file; the CI tests and `pnpm prd ci` tests pass.

**Blocked by:** 13 (`blame.mjs`). **Blocks:** 12.

## Slice 9: Caretook's engines and scripts move

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 6.

**What to build**

- These move to `scripts/project/` with their tests: the check-areas and doc-budget engines (with their own copies of `package-diff.mjs` and `status-trim.mjs`), the doc-budget data (`doc-budget.config.mjs`, beside its engine), `host-headers.mjs`, `log.sh` and `sync-matrix.test.mjs`. The check-areas engine reads its areas folder from a config path, so the folder's later move is one line.
- `.github/workflows/ci.yml`, `pnpm check`'s doc budget, `pnpm log`, `serve.sh`'s preview line and the deploy workflow test name the new paths. The core's callers keep working through a forwarding path until slice 7, except `check-body.sh`, whose check-areas lint line names the new path at once (allowlisted until slice 11 moves the body).
- The check plan's browser harness set names the check-areas engine's new path, so a change to it still asks for `integration`.
- Each move is a rename plus its callers' paths; no logic changes.

**Acceptance criteria**

- `pnpm test`, `test:tooling` and `test:browser-harness` list the same tests as before but for the moved paths; `pnpm docs:budget`, `pnpm log` and the check-areas lint print the same as before; a change to the moved check-areas engine proposes `integration`.
- In a temporary copy without the core's files, `pnpm check`'s doc budget, the check-areas lint and `pnpm test:project` run.

**Blocked by:** 6. **Blocks:** 7, 11.

## Slice 10: The check plan's rules as Caretook's data

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 1, 3.

**What to build**

- The tables in `check-plan.mjs` (PRD _Decisions_, asked) move to a data file in `scripts/project/` named in the config: what only the whole suite vouches for, the tier by path, what is tooling, the own-test pattern, what the browser harness test covers, and CI's two list paths. The engine stays core and reads it.
- `dev-brought.mjs`, which imports two of those tables today, asks the engine instead; `tooling-lint.mjs` and `tooling-tests.mjs` keep asking the engine, and the Vitest project names `tooling-tests.mjs` runs come from the config. The sample project brings its own rules.

**Acceptance criteria**

- The check plan gives the same mode, tier and reason as before for a table of sample diffs (one per rule), and the sample project's rules change the answers; `check-plan.mjs` and `dev-brought.mjs` name no app path; the touched files leave the allowlist.

**Blocked by:** 4 (the sample project), 5 (`check-plan.mjs`), 6. **Blocks:** 11.

## Slice 11: The check's body as Caretook's

Stack: no · Reads: docs/agents/machinery.md, docs/agents/loop.md · Tests: unit

**User stories:** 3, 6.

**What to build**

- `check-body.sh` (PRD _Decisions_, asked) moves to `scripts/project/` as Caretook's check script: the format, lint and typecheck steps, the Vitest projects each mode runs, the budgets. Its failure reader (`check-failed.mjs`) moves with it. The core calls it through the config's `check` hook, from `prd.sh`'s check case, which also stops printing the step list itself.
- **The hook's contract, as the code has it:** the mode, the base and the own tests go in as arguments; the body reports through its exit code and through the state files (the current step, the failed and the flaky tests) and the counts file, whose paths the core hands it in the environment.
- The body's last step today runs the core's own tooling tests. That step leaves the body: after the hook returns, the core runs them through `tooling-tests.mjs`, so the body takes no tooling argument and names no core project.
- The core keeps what surrounds it in `check-run.sh`: the lease, the load gate, the log, the timings, the rerun rules and the check plan. The hook's contract (arguments, exit codes, the state and counts files) is written in [machinery](../docs/agents/machinery.md) and tested from both sides.
- The sample project brings a two-line check script.

**Acceptance criteria**

- `pnpm prd check --quick` on a small sample change runs the same steps in the same order as before (the hand-off shows both logs); the check tests pass on the sample project's script; `check-run.sh` and `prd.sh`'s check case name no Vitest project, app path or budget; the tests that read the body's path or the call's text (`check-body.test.mjs`, `lint-heap.test.mjs`, `lease.test.mjs`) pass; the body runs alone with no `.loops/` and no core file (it is what a repo with no Risa would run); the touched files leave the allowlist.

**Blocked by:** 3, 9, 10. **Blocks:** `orchestration-split-2`.

## Slice 12: The CI split, part 3: the verdict as a file, and the proof

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 6.

**What to build**

- The core's `ci-runs.mjs` reads a verdict as a file with its own reader instead of importing `verdict.mjs`.
- The core's CI tests that import `verdict.mjs` to build one (`blame.test.mjs`, `promote.test.mjs`, `release.test.mjs`, `ci.test.mjs`) use verdict fixtures as files; `ci.test.mjs`, which tests both sides, splits by owner.
- The browser job's call to `browser.sh` and its path to the checks manifest are `orchestration-split-3`'s (slices 1 and 6) and stay allowlisted until then.

**Acceptance criteria**

- The lint reports no reference across the line for `scripts/ci/` except the allowlisted runner call and manifest path; the CI tests and `pnpm prd ci` tests pass; in a temporary copy without the core's files, the test job, verdict, zones, env and tiers modules load and their tests pass.

**Blocked by:** 8. **Blocks:** `orchestration-split-2`.

## Slice 13: The CI split, part 1b: the core's callers of the tier data

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 6.

**What to build**

- The eight CI callers (`ci-args`, `ci-commits`, `ci-runs`, `ci-status`, `gate`, `outstanding`, `promote`, `blame`) swap from an import of `tiers.mjs` to slice 5's core reader: the same swap in each.
- The tests follow: the core tests that import `tiers.mjs` (`ci.test.mjs`, `release.test.mjs`, `promote.test.mjs`) use the reader, and the four that copy `tiers.mjs` into a fixture because `outstanding.mjs` imported it (`reclaim.test.mjs`, `stack.test.mjs`, `rotate.test.mjs`, `tidy-cli.test.mjs`) copy the data file and the reader instead.

**Acceptance criteria**

- The lint reports no core import of `tiers.mjs` and no file-group pattern in a core file; the CI tests, the four fixture tests and `pnpm prd ci` tests pass.

**Blocked by:** 5. **Blocks:** 8.
