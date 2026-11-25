# Plan: Orchestration split (stage 1a, the seams)

> Source PRD: [`plans/orchestration-split-prd.md`](orchestration-split-prd.md). User-story numbers (US) refer to it. Backlog item B-543. Topic `orchestration-split`. Next: [`orchestration-split-2-plan.md`](orchestration-split-2-plan.md), [`orchestration-split-3-plan.md`](orchestration-split-3-plan.md), then the hand runbook [`orchestration-split-move.md`](orchestration-split-move.md).

## Status

**Running** since 2026-11-25, opened by the user by hand (the registry row still carries `hold`, which keeps the dispatcher off it). **Landing mode: run everything through** (the user, 2026-11-25): land each green wave and clean up, asking only real questions. **Slices to start: every ready slice from here** (the user, 2026-11-25, after wave 1 landed): wave 2 (slices 2 and 6) next, then each later wave as its blockers land, without asking again. **Wave 2's slices run on opus** (the user's choice); later waves at the orchestrator's judgement, as below. The user approves the big choices on this topic; an orchestrator asks before changing an `asked` row of the PRD's _Decisions_ or making a new choice of that size. **Models** (PRD _Decisions_): this orchestrator runs on Fable; each slice gets the lowest tier that is enough (sonnet with no logic to work out, opus for real logic), Fable only when the orchestrator judges it needs it, with the reason noted here. Likely Fable candidates: slice 1 (the lint's rules decide what every later slice must clear) and slice 11 (the check's body and what surrounds it part ways). Sonnet candidates: slice 9 (moves) once slice 6 has landed.

| Slice | Wave | State   | Merge into `prd/orchestration-split` |
| ----- | ---- | ------- | ------------------------------------ |
| 1     | 1    | merged  | e90f5f02                             |
| 2     | 2    | merged  | fd5aa70e                             |
| 6     | 2    | merged  | bd866a13                             |
| 3     | 3    | merged  | af99df64                             |
| 9     | 3    | merged  | 744e5d07                             |
| 4     | 4    | merged  | a893c395                             |
| 5     | 4    | merged  | d11cc8ae                             |
| 10    | 5    | merged  | f5d40957                             |
| 13    | 5    | merged  | eccbfca4                             |
| 7     | 6    | merged  | 7e1901e8                             |
| 8     | 6    | merged  | f12aefa2                             |
| 11    | 6    | merged  | 4da423cf                             |
| 12    | 7    | merged  | e0e556f2                             |
| 14    | 7    | merged  | 617e2561                             |
| 15    | 8    | planned |                                      |

**Backlog:** B-543 closes with the move (the runbook's last step).

**Landed:** wave 1 as 1029b791 (PR #185), wave 2 as b50c288 (PR #186), wave 3 as 98d62d3e (PR #187), **wave 4 as 53d76eb4** (PR #188, `full` green on run 45650887484, `pnpm test:tooling` passed, Codex out of credits so not reviewed; the Fable skeptic said go). **Wave 5 as 3f50c51** (PR #189; slices 10 as f5d40957 and 13 as eccbfca4; `full` green on run 45658603314, `pnpm test:tooling` passed 98 files, Codex out of credits so not reviewed; the Fable skeptic said go, its differential of the old check-plan engine against the new found 0 differences; follow-ups B-834; landed on an unsynced tip, dev's 3 commits shared no file). Slice worktrees 10 and 13 are removed. Hand-offs, skeptics and fixes are in [the history](orchestration-split-history.md). Slice worktrees 4 and 5 are removed. **Before `pnpm prd rotate`, message `backlog - split-ops` (the session `caretook-com-f7` since 2026-11-25; find it with ListAgents if it changed again) and wait for its go.** **Until the weekly reset (Sat 2026-11-28 12:00), make every slice worktree with `CARETOOK_USAGE_WATCH=off pnpm prd slice …`** (relayed by split-ops as the user's word, 2026-11-25: run up to the weekly limit; at 100% sessions stop and wait; the dispatcher is off on purpose). The user wants a Fable skeptic on each wave's decisions and code before it lands (split-ops, 2026-11-25); `skeptic record` takes no such verdict, so it goes in _Status_ and the landing report.

**Wave 6 landed as 9d1408bd** (PR #191; slices 7 as 7e1901e8, 8 as f12aefa2, 11 as 4da423cf, all on opus; `full` green on 097d43b6, run 45667187773; the `components` recheck of the dev sync green on 52177640, run 45669428648; `pnpm test:tooling` passed 102 files; Codex out of credits so not reviewed; the Fable skeptic said go, no blocker, follow-ups B-835; landed on an unsynced tip, dev's 1 commit shared no file; the user's go, relayed by split-ops, covered the open docs-only `plan-marketing-2` worktree). Slice worktrees 7, 8 and 11 are removed. The report is filed; the hand-offs are in the history.

**Wave 7 is running** (a fresh session, 2026-11-25): git matched _Status_ at the takeover (no slice worktree, no unlanded merge, no landing journal); `pnpm prd sync` needed no merge (dev at 68387469); slice 12 started on opus in `.loops/orchestration-split-12` (made with `CARETOOK_USAGE_WATCH=off`), the watch is running. **The late-slice proposal went to split-ops** (`caretook-com-f7`) before slice 12 started: slice 14 (B-821, B-822, B-823: backlog ids and branch prefixes) beside slice 12 in wave 7 or after it, and slice 15 (B-825, B-826, B-827, B-832, B-834, B-835: the skeptics' code follow-ups) as wave 8; **the user said yes** (relayed by split-ops, 2026-11-25): slice 14 in wave 7 beside slice 12, slice 15 alone as wave 8, both on opus, tier `full` plus `pnpm test:tooling`; ask split-ops for each rotate go. **Slice 12 handed off (9f1da932, slice check green) and merged as e0e556f2**; its worktree stays until the wave is green. Its notes: the verdict file is a contract (`VERDICT_VERSION` on each side; a shape change regenerates `scripts/ci/verdict.fixtures/` from `buildVerdict`); the no-core proof was by hand (7 of 8 Caretook CI test files pass; `tiers.test.mjs` passes once the removal commit drops its two-readers half and the `tier-data.mjs` import); `browser.test.mjs` (core) still imports `scripts/ci/browser-job.mjs`, and `land.test.mjs` and `tidy-cli.mjs` name `scripts/ci/quarantine.txt` (for `orchestration-split-3` and the runbook). **Slice 14 handed off (ed3c2856, slice check green) and merged as 617e2561** (B-821, B-822, B-823 done); its worktree stays until the wave is green. Its notes: `backlog.formerIdPrefix` is the key the runbook's step 3 sets to `B` for Risa (Risa's counter starting above Caretook's highest id is not built); `branchKinds()` in `config.mjs` is Node's reader of the prefixes, `loadConfigOrExit(who)` the one-line failure; `is_protected` and `tidy.mjs`'s `PROTECTED_BRANCHES` are gone (`protectedBranches()` from the config); the sample project's prefixes are `topic/`, `part/`, `draft/`, `quick/`. For slice 15: `scripts/ci/outstanding.mjs:66` (`isTopicRun`) assumes `prd-<topic>` and `slice-<topic>-<n>` ref names; `ls.sh` greps the CI output for the configured prefix; `prd.sh`'s help text still says `prd/` and the rest. **The Fable skeptic on wave 7 said go** (no blocker; it compared the old branch regexes with the new code on 8,457 names, rebuilt all ten verdict fixtures from `buildVerdict` deep-equal, and counted one Node start for `lib.sh`); its follow-ups are B-838, for slice 15 where they fit. **Out now on 62d096d3: the wave's `full` CI run and `pnpm test:tooling`; then the PR and the landing (hold it and message split-ops if another PRD, plan or hotfix worktree is open).** **The wave as planned:** slice 12 (the CI verdict as a file, and the proof), tier `full`, on opus unless the orchestrator judges otherwise. **First, before slice 12 starts, send split-ops (`caretook-com-f7`) a proposal for a late slice** covering the open follow-ups with no slice (B-821, B-822, B-823, B-825, B-826, B-827, B-832, B-834, B-835); it puts it to the user (split-ops, 2026-11-25). For slice 12: the core still imports `verdict.mjs` in `ci-runs.mjs`, `blame.test.mjs`, `ci.test.mjs` and `promote.test.mjs`; the check's body still names `core:unit` and the `!tooling:*` exclusions (`pnpm test`'s set, until the move). The check hook: `check-hook.sh MODE BASE TOOLING [OWN…]` runs `hooks.check` through `run_hook` (in `lib.sh`), then `check-tooling.mjs`. **Before wave 7 lands** (split-ops, 2026-11-25): check `pnpm prd status` for any other PRD, plan or hotfix worktree, and if one is open hold the landing and message split-ops instead. **From wave 5, for later slices:** slices 7 and 8: `check-plan.mjs`'s `CORE_HARNESS` and `CORE_TOOLING` hardcode `scripts/loops` and `scripts/backlog`, and the rules' harness paths name `scripts/loops/serve.sh`, `checks` and `check-areas.d`: change them in the same commit as any file move, or the harness tier drops silently. Slice 11: decide whether `tooling-tests.mjs` throwing on an unset `testProjects.tooling` is right. Slice 12 and the move runbook: re-home `check-plan-rules.test.mjs` to run through the `risa` CLI, never just drop it (it is the only guard on the landing gate's data). Slice 8: `release.mjs:52`'s browser-check path and `blame.mjs`'s `lists.mjs` import are left for it. Slice 12: `ci-runs.mjs`'s `verdict.mjs` import. Tell slice agents: prepend nvm's Node 24 to PATH; unset `CARETOOK_USAGE_WATCH` for the slice check until B-818 lands; a test that copies `scripts/backlog/*.mjs` or `scripts/loops` into a throwaway repo must copy `config.mjs`, and `scripts/project` when it reaches the doc budget. Open for this topic, none with a slice yet: B-821 (a moved `B-n` read as `RISA-n`, needed before the move), B-822, B-823, B-825, B-826, B-827, B-832 (the wave 4 skeptic's code follow-ups), B-834 (wave 5's), B-835 (wave 6's): propose a late slice for them to the user before wave 7.

**From wave 4, for later slices:** the core tier reader is `scripts/ci/tier-data.mjs` (`tierData().X`, no `planOutputs`) on Caretook's `scripts/ci/tiers.json` (`paths.tierData`; kept in `scripts/ci/` so a change still asks for `full`). Slice 13: the `planOutputs` tests in `ci.test.mjs` and `release.test.mjs` move to a Caretook test; the four fixture tests already copy `tiers.json`. Slices 10 and 11: the sample project is `scripts/loops/sample-project/` (`risa.json`, `repo.mjs`'s `makeRepo(main, { config, files })`, the core golden); it has no tier data file yet, and a config fixture needs one at its root wherever the check plan loads (`land.test.mjs`'s `sample()` copies one). B-823's rest keeps the sample from varying branch prefixes. Caretook's golden is `scripts/project/prompt-golden.txt` (`vitest -u`). Allowlisted until `orchestration-split-3` slice 4's `RISA_` rename: `prompts/backlog.sh project-env 4`, the sample golden's 2. `risa.json` has a `roles` group of six replacements (noted in `orchestration-split-2` slice 5).

**From wave 3, for later slices:** the boundary lint reads CI's two lists (`paths.brakeList`, `paths.quarantine`) as data (94feb95d; the move runbook drops their core-test lines). Slice 7 deletes the three forwarders in `scripts/loops/` (`check-areas.mjs`, `doc-budget.mjs`, `doc-budget.config.mjs`) and points `browser.sh` and `land.sh` at `scripts/project/`. `commands.quickCheck` and `projectTests` are unset until slice 11. `scripts/project/risa.mjs` is Caretook's plain read of `risa.json`.

**Docs to fold at the last landing**, from wave 6: machinery (`run_hook`; the hooks' contracts: `checkAreas` is `resolve --root --areas --base [--head]` with files on stdin, `docBudget` is `land <trunk> --head <branch> --repo <main>`, `check` is in `check-hook.sh`'s header; `check-tooling.mjs`; `ci-lists.mjs`, `release-jobs.mjs`, `backlog.zoneOverflowItem`); the move runbook counts `browser.test.mjs`'s copy of `scripts/project` (paths built from pieces, unseen by the lint). From wave 5: machinery (`paths.checkPlanRules` and the rules file's shape, in `check-plan.mjs`'s header; `checkPlanFor(project)`; `testProjects`; the CI callers on `tierData()`). From wave 4: machinery (`paths.promptGolden`, `commands.toolingTests`, `log`, `docBudget`, `stack.portEnv`, `role_doc`, `in_main`, the sample project, the tier data and its two readers). From wave 3: `docs/agents/loop.md` (the check-areas and sync-matrix test paths, now `scripts/project/`), machinery (`find_repo`, `run_project`, `tool_command`, `commands.hooksInstall`, the lint's data lists). From wave 2: `docs/agents/loop.md` _Tests_ (`scripts:unit` is now `core:unit` + `project:unit`, plus `project:tooling`; `pnpm test:project` runs both project ones); machinery: `paths.tooling`, `backlog.idPrefix`, `backlogIds()`. Slice 10's `testProjects.tooling` = `tooling:unit`, `core:unit`, `project:unit`, `project:tooling`; harness `tooling:browser`.

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
- **Wave 1:** slice 1. **Wave 2:** slices 2 and 6 (2 owns `scripts/backlog/` and `lib.sh`; 6 owns `package.json`, `vitest.config.ts`, `check-plan.mjs`'s tooling pattern, `tooling-lint.mjs`, the `_global` area map and AGENTS.md). **Wave 3:** slices 3 and 9 (3 owns `lib.sh`, `prd.sh`, `unsynced.sh`, `land.sh`, `new.sh` and `ready.sh`; 9 owns the moved files, `package.json`'s `log` and `docs:budget` lines, `ci.yml`, `serve.sh`'s preview line, `check-body.sh`'s check-areas line, `check-plan.mjs`'s harness pattern and the deploy workflow test). **Wave 4:** slices 4 and 5 (4 owns the prompts and goldens; 5 owns the tier data, its two readers, `tiers.mjs` and `check-plan.mjs`'s tier import). **Wave 5:** slices 10 and 13 (10 owns `check-plan.mjs`, `dev-brought.mjs`, `tooling-lint.mjs` and `tooling-tests.mjs`; 13 owns the eight `scripts/ci/` callers of the tier data and the tests that copy `tiers.mjs`). **Wave 6:** slices 7, 8 and 11 (7 owns `land.sh` and `browser.sh`; 8 owns `scripts/ci/`'s lists and release code; 11 owns `check-body.sh`, `check-run.sh`, `check-failed.mjs`, `prd.sh`'s check case and their tests). **Wave 7:** slices 12 and 14 (12 owns `scripts/ci/ci-runs.mjs`, `verdict.mjs` and the CI tests that cross the line; 14 owns `scripts/backlog/`, the loader's id keys and the scripts that still hardcode a branch prefix, and no file in `scripts/ci/`). **Wave 8:** slice 15 (the follow-ups in `lib.sh`, the prompts, `check-plan.mjs`, `tier-data.mjs`, `land.sh`, `ready.sh`, `prd.sh`'s check case, `release.mjs`, `blame.mjs`, `check-tooling.mjs`, `scripts/project/doc-budget.mjs`, `fixes-plans.test.mjs` and `vitest.config.ts`).
- **Tiers** (what the check plan proposes, once at landing): wave 1 edits the `_global` area map, which the browser harness test covers: `integration`; waves 2 to 8 touch `package.json`, `vitest.config.ts`, `.github/` or `scripts/ci/`: `full`. Every wave also runs `pnpm test:tooling`.
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

- The tables in `check-plan.mjs` (PRD _Decisions_, asked) move to a data file in `scripts/project/` named in the config: what only the whole suite vouches for, the tier by path, what is tooling, the own-test pattern, and what the browser harness test covers. CI's two list paths stay in the config (`paths.brakeList`, `paths.quarantine`), which the engine reads (slice 10, kept in one place). The engine stays core and reads it.
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

## Slice 14: Backlog ids and branch prefixes, finished

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** 1, 2. Added 2026-11-25 on the user's word, from the wave 2 and 3 skeptics' follow-ups. Backlog: B-821, B-822, B-823 (their notes name the lines).

**What to build**

- **B-821:** an optional config key for a former id prefix. A project that sets it reads an id with the former prefix as its own (Risa: `B-772` is `RISA-772`) in every lookup; new ids, headings and tags keep the current prefix. Caretook leaves it unset, so `B-n` behaves as today.
- **B-822:** the look-alike sort takes an id's number through the id helper, not `id.slice(2)`; the loader checks the config's item-type pattern against `idPrefix` (a prefix the one allows, the other allows); a broken `risa.json` gives the backlog one clear `backlog:` line, not a Node stack at import.
- **B-823:** every core script that still hardcodes a branch prefix (`prd/`, `slice/`, `plan/`, `hotfix/`) outside the six files slice 3 took (`rm.sh` and the rest) reads it through `lib.sh`'s helpers; `is_protected` gets its callers or goes. Touch no file under `scripts/ci/` (slice 12's, in this wave); name any prefix left there in the hand-off for slice 15.

**Acceptance criteria**

- Unit tests: under a sample config with prefix `RISA` and former prefix `B`, `B-772` finds `RISA-772` and a new item is `RISA-n`; with no former prefix, today's tests pass unchanged; the look-alike sort orders `RISA-` ids by number; a prefix the id helper allows passes the loader and one it refuses fails with a clear line; a broken config prints one `backlog:` line and exits non-zero.
- The sample project runs with different branch prefixes: a test shows the touched scripts honour them; the touched files leave the allowlist where they were on it.

**Blocked by:** 2, 3, 4. **Blocks:** the move.

## Slice 15: The skeptics' code follow-ups

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** 2, 3, 6. Added 2026-11-25 on the user's word, from the wave 3 to 6 skeptics' follow-ups. Backlog: B-825, B-826, B-827, B-832, B-834, B-835 (their notes name the lines; read each with `pnpm backlog show`).

**What to build**

- **B-825:** a test ties `scripts/project/doc-budget.mjs`'s copy of the registry table header to the registry's, so a new column fails a test instead of printing 'plan status: skipped'.
- **B-826:** `run_project` runs a config command in a subshell, so a `cd` or `exit` in it can't change the caller.
- **B-827:** `fixes-plans.test.mjs` uses Caretook's copy of `status-trim.mjs` (`pnpm test:project` passes without the core); the 'what to try' text and the migration, seed and sync notes in `land.sh` and `ready.sh` come from the config or a project file; the stale comment in `scripts/browser-checks/sync-matrix.mjs` names the test's new path.
- **B-832:** quote the `role_doc` fallback in the five prompts, with a test on the fallback; the tier data is read when first asked for, not at `check-plan.mjs`'s import, and a broken file gives a clear line; `groupOf` answers as the old code did for a file name with a newline; the sample repo copies only what its tests need.
- **B-834:** the check plan's `under()` no longer proposes `none` for a path equal to a folder's name; `prd.sh`'s check case dies when the mode it reads is empty; a bad tier file gives the CI commands a clear line, not a bare stack.
- **B-835:** `land.sh` tells a `docBudget` hook that failed to run from a budget breach, and a mistyped `hooks` key is an error, not a silent skip; a test joins a built release verdict to `releasePasses` at the release tier; `prd fixes-bug` in `release.mjs` and `blame.mjs` becomes a config value; the stale `loops/check-body` entry in `vitest.config.ts` and the stale comment in `check-plan.mjs` go; `check-tooling.mjs` and `tooling-tests.mjs` agree on an unset `testProjects.tooling`. The check's body keeps naming `core:unit` until the move (`pnpm test`'s set must not change).
- Any branch prefix slice 14's hand-off names in `scripts/ci/`.

**Acceptance criteria**

- Each item has a test that fails before its fix; `pnpm test`, `test:tooling` and `test:browser-harness` list the same test files as before but for the new ones; the check plan's table of sample diffs gives the same answers as before; `pnpm test:project` passes in a temporary copy without the core's files; the allowlist only shrinks.

**Blocked by:** 12, 14. **Blocks:** `orchestration-split-2`.
