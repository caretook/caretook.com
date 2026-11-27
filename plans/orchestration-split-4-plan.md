# Plan: Orchestration split 4 (the core's tests stand alone)

> Source PRD: [`plans/orchestration-split-4-prd.md`](orchestration-split-4-prd.md). User-story numbers (US) refer to it. Backlog item B-929. Topic `orchestration-split-4`, after `orchestration-split-3`. Then the move runbook [`orchestration-split-move.md`](orchestration-split-move.md) (B-543 step 2), which waits for it.

## Status

Planned 2026-11-26 (dev 153d6b95). Started 2026-11-26 on prd/orchestration-split-4 (base d7472379).

**Landing mode: run everything through** (dispatcher start): start every ready slice, land each green wave, ask only real questions via `pnpm prd ask`.

Start: anchors fixed (new-file markers in slices 1-5), B-929 claimed. Wave 1 started: slices 1, 2, 3 worktrees made, agents spawned on opus.

| Slice | Wave | State   | Model | Merge into `prd/orchestration-split-4` |
| ----- | ---- | ------- | ----- | -------------------------------------- |
| 1     | 1    | working | opus  |                                        |
| 2     | 1    | working | opus  |                                        |
| 3     | 1    | working | opus  |                                        |
| 4     | 2    | planned |       |                                        |
| 5     | 3    | planned |       |                                        |
| 6     | 3    | planned |       |                                        |
| 7     | 4    | planned |       |                                        |

## Architectural decisions

- **No core test reads the checkout's `risa.json` or any file it names.** A core test runs on the sample project (`scripts/loops/sample-project/`) or the fixture project (`scripts/loops/fixture-project/`, new: today's names, its own data); the core setup file makes the fixture the default, and it lands last (slice 7), after every "this repo's" case has moved.
- **Checks of the project's own data are a command, not core tests** (PRD _Decisions_): `pnpm prd project-check` runs on the configured project, from `pnpm test:tooling`, the check's tooling step, and in GitHub CI through a Caretook test in `project:tooling`.
- **The standalone run is the measure.** Each slice runs it (`node scripts/loops/standalone.mjs --root <mode>`) and its acceptance names the files it takes off the failing list; the baseline is the planner's runs on dev 153d6b95 (PRD _Notes_).
- **No change in behaviour** for Caretook's commands, names or outputs (stage 1's rule). New core files get their `core` line in `scripts/loops/boundary.manifest` and new Caretook files their `project` line; the allowlist only shrinks.
- **No other worktree constraint:** nothing a running session reads changes meaning, so the dispatcher stays on. `lib.sh` and `lease.sh` are also hot files of `code-health` (planned) and `staging-ship` (held): recheck `pnpm backlog prd list` at start; neither runs today.

## How to run this plan

- **Wave 1:** slices 1, 2 and 3 at once (1 owns `standalone.mjs`, `lib.sh`, `lease.test.mjs`; 2 owns `project-check.mjs`, `prd.sh`, `tooling-tests.mjs`, `check-tooling.mjs` and the Caretook test; 3 owns the four throwaway-repo tests plus `check-run.test.mjs` and `ci-ids.test.mjs`). All three add manifest lines: a sorted-line merge, resolved by keeping both. **Wave 2:** slice 4 (the fixture project's data). **Wave 3:** slices 5 and 6 at once (5: doc, skeptics, boundary, prompt golden; 6: the CI-data and config cases). **Wave 4:** slice 7 (the flip) and the proof.
- **Gates:** each slice runs `pnpm test:tooling` and the standalone run for its files. **The last landing** runs the standalone run in all three modes (`sample`, `project`, `none`): each passes, nothing failed or hung; that is B-929's proof, recorded in _Status_.
- **Tiers:** waves 3 and 4 touch `scripts/ci/` tests or `vitest.config.ts`: whatever the check plan proposes; waves 1 and 2 are tooling only, but wave 1 adds a `scripts/project/` test and touches `scripts/ci/ci-ids.test.mjs`: take the plan's proposal.
- **Docs at the last landing:** the generic `scripts/loops/docs/project-config.md` (the sample project paragraph: the fixture project, the setup file, the standalone run, the project-data check and its subcommand) and Caretook's `docs/agents/project-config.md` (the Caretook test that runs the check in CI); `pnpm prd help` names `project-check`. The move runbook's _Before_ list already names the standalone run (this plan's branch).

## Slice 1: The standalone run and the no-config stop

Stack: no · Reads: scripts/loops/docs/project-config.md, docs/agents/project-config.md · Tests: unit

**User stories:** 2, 3.

**What to build**

- `scripts/loops/standalone.mjs` (new; PRD _Implementation decisions_, "The standalone run"): `--root sample|project|none`, `--keep`, a per-file time limit; its pure parts exported (`coreFiles(manifestText)`, `failedFrom(report)`); its CLI prints `<failed> <file>` lines, the total, and any hung file. Its Vitest config names `scripts/loops/test-setup.mjs` (new in slice 7) when that file exists.
- `scripts/loops/lib.sh`: the config line exits the sourcing script (`exit 1`) with its one line, instead of returning. First grep the tests that source `lib.sh` for one that expects to carry on after a config failure, and change it.
- `scripts/loops/lease.test.mjs`: `lease.sh take` with `RISA_CONFIG` pointing at a missing file exits 1 within seconds with the config line.
- `scripts/loops/standalone.test.mjs` (new): `coreFiles` keeps only `core` lines; `failedFrom` counts failed tests per file and names a file with no result as hung.
- `scripts/loops/boundary.manifest`: the two new files.

**Acceptance criteria**

- Unit: `standalone.test.mjs` (new) and the new `lease.test.mjs` case pass in `pnpm test:tooling`.
- `node scripts/loops/standalone.mjs --root none` finishes with no hang; `--root sample` and `--root project` report about the planner's 560 and 206 (the slice's report records the baseline).

**Blocked by:** none. **Blocks:** 7.

## Slice 2: The project-data check, in the tooling step and in CI

Stack: no · Reads: scripts/loops/docs/project-config.md, docs/agents/project-config.md · Tests: unit

**User stories:** 5.

**What to build**

- `scripts/loops/project-check.mjs` (new; PRD _Implementation decisions_, "The project-data check", all of it but the prompt golden, which is slice 5's): `projectProblems(project)` returns one line per problem; the CLI prints them and exits 1 on any. Uses the core's readers: `config.mjs`, `scripts/ci/tier-data.mjs` (`tierDataProblems`), `check-plan.mjs` (the rules loader), `scripts/ci/ci-lists.mjs`, `doc.mjs`'s role entries, `skeptics.mjs` (`readRules`), `time-gate.mjs`, `boundary.mjs` when the project has a manifest.
- `scripts/loops/project-check.test.mjs` (new): on a `makeRepo` sample project with what each line needs written in (`files`), it passes; with one thing broken each (a missing path, bad tier data, an unparsable list line, a docs file no role names, no never list) it prints that one line.
- `scripts/loops/prd.sh`: `project-check` runs it.
- `scripts/loops/tooling-tests.mjs` and `scripts/loops/check-tooling.mjs`: run it first; a failure fails the step with its lines.
- `scripts/project/project-data.test.mjs` (new, Caretook's, `project:tooling`): reads `tool.prd` from `risa.json` and runs `<it> project-check` in the checkout; it passes. It runs only under `CI` (skipped locally, where the tooling step already ran the check), so a local `pnpm test:tooling` runs the check once.
- `scripts/loops/boundary.manifest`: the three new files.

**Acceptance criteria**

- Unit: `project-check.test.mjs` (new) and `project-data.test.mjs` (new) pass. `pnpm prd project-check` passes on the checkout; on a scratch edit breaking `scripts/ci/tiers.json`, `pnpm test:tooling` fails naming it (shown in the slice's report, the edit reverted).

**Blocked by:** none. **Blocks:** 4, 5, 6.

## Slice 3: Throwaway repos copy the tier data the config names

Stack: no · Reads: scripts/loops/docs/project-config.md · Tests: unit

**User stories:** 1.

**What to build**

- The tests that copy `scripts/ci/tiers.json` by its literal path, or read it from `REPO`'s config, take the file the config in `RISA_CONFIG` names, relative to that config's folder (so they pass on Caretook's config now and on the fixture after slice 7): `scripts/loops/reclaim.test.mjs`, `scripts/loops/rotate.test.mjs`, `scripts/loops/stack.test.mjs`, `scripts/loops/tidy-cli.test.mjs`, `scripts/loops/check-run.test.mjs`, `scripts/ci/ci-ids.test.mjs`. If more than two need it, one new helper, `fixtureTierData()`, goes in `scripts/loops/config-fixture.mjs`.

**Acceptance criteria**

- `pnpm test:tooling` passes; standalone `--root project` no longer lists these six files.

**Blocked by:** none. **Blocks:** 7.

## Slice 4: The fixture project's data

Stack: no · Reads: scripts/loops/docs/project-config.md · Tests: unit

**User stories:** 1, 4.

**What to build**

- `scripts/loops/fixture-project/` (new): `risa.json` with today's names (trunk `dev`, `prd/` `slice/` `plan/` `hotfix/`, ids `B`, the `pnpm prd` and `pnpm backlog` command names, the same hooks shape as Caretook's on the sample stubs), its paths inside the folder: `tiers.json` (the tiers and gates the land and CI tests expect), `check-plan-rules.json`, `quarantine.txt`, `brake-list.txt`, `docs/preferences.md` (new: a never list) and `docs/planner.md` (one role's additions).
- `scripts/loops/project-check.test.mjs` (new in slice 2): a case that the fixture project passes the check.
- `scripts/loops/boundary.manifest`: the new files.

**Acceptance criteria**

- Unit: the new `project-check.test.mjs` (new in slice 2) case passes; `pnpm test:tooling` passes (nothing reads the fixture by default yet).
- **Measured before the flip:** `RISA_CONFIG=<the fixture's risa.json> pnpm test:tooling` runs, and the slice's report lists what still fails; the land tests (`land`, `land-gate`, `land-unsynced`, `land-force-resume`), `ci/gate` and `ci/outstanding` (about 161 of the 206) must pass on the fixture's tier data, so the fixture is fixed here, not in slice 7.

**Blocked by:** 2. **Blocks:** 5, 6, 7.

## Slice 5: The doc, skeptic, boundary and golden cases off the checkout

Stack: no · Reads: scripts/loops/docs/project-config.md · Tests: unit

**User stories:** 1, 5.

**What to build**

- `scripts/loops/doc.test.mjs`: the "this repo's roles" cases run on the fixture project's config and docs (its roles and additions); the "every doc in docs/agents is a role" case goes (the check covers it); the generic-doc cases read `scripts/loops/docs/` only.
- `scripts/loops/skeptics.test.mjs`: the brief's rules read from the fixture's preferences, not `REPO`'s.
- `scripts/loops/boundary.test.mjs`: the rule tests on made-up trees only; the lint of the real tree goes (the check runs it, and CI through slice 2's test).
- The prompt golden: the golden test's renderer moves into `scripts/loops/prompt-render.mjs` (new, a core module) that `prompt-golden.test.mjs` and `project-check.mjs` (new in slice 2) both use; the check gains the golden line (PRD _Implementation decisions_); `prompt-golden.test.mjs`'s "on this repo's own config" case goes; `project-check.test.mjs` (new in slice 2) gains a mismatched-golden case.
- `scripts/loops/boundary.manifest`: the new module.

**Acceptance criteria**

- Unit: `pnpm test:tooling` passes, with the new `project-check.test.mjs` (new in slice 2) case; `pnpm prd project-check` passes on the checkout (Caretook's golden matches). Standalone `--root project` no longer lists `doc`, `skeptics`, `boundary` or `prompt-golden`.

**Blocked by:** 2, 4. **Blocks:** 7.

## Slice 6: The CI-data and config cases off the checkout

Stack: no · Reads: scripts/loops/docs/project-config.md · Tests: unit

**User stories:** 1, 5.

**What to build**

- Each "this repo's" case runs on the fixture project's config and data, or goes where the check now covers it: `scripts/ci/ci-lists.test.mjs` ("reads the project's list"), `scripts/ci/tier-data.test.mjs` ("reads this repo's"), `scripts/loops/check-plan.test.mjs` ("change the answers from this repo's": its answers from the fixture's rules), `scripts/loops/config.test.mjs` ("accepts this repo's config, and every path in it exists"), `scripts/loops/time-gate.test.mjs` ("runs as a command on this repo's gates' data"), `scripts/loops/dev-brought.test.mjs` (its CLI case on a fixture repo).

**Acceptance criteria**

- Unit: `pnpm test:tooling` passes; standalone `--root project` no longer lists these six files.

**Blocked by:** 2, 4. **Blocks:** 7.

## Slice 7: The flip, and the proof

Stack: no · Reads: scripts/loops/docs/project-config.md, docs/agents/project-config.md · Tests: unit

**User stories:** 1, 4.

**What to build**

- `scripts/loops/test-setup.mjs` (new): `RISA_CONFIG ??=` the fixture project's config, `RISA_MACHINE_CONFIG ??= ""`.
- `scripts/loops/config-fixture.mjs`: `FIXTURE_CONFIG` is the fixture project's config; `stubHookConfig` and `sampleFoldersConfig` read their data from beside it.
- `vitest.config.ts`: `core:unit`, `tooling:unit` and `tooling:browser` name the setup file.
- Expected to clear with the flip: the land tests, `ci/gate`, `ci/outstanding` (slice 4 measured them) and the `scripts/backlog/` and other files that failed only on `--root sample` from the fallback. `project/browser-run.test.mjs` (Caretook's, in `tooling:browser`) gets the setup file too: confirm it reads `risa.json` by path and passes, else leave that project's setup list without it.
- Whatever the standalone run still lists after the flip, fixed in its test on the fixture (expected: none beyond a stray case; more than two files is a stop and a note to the orchestrator, not a bigger slice).
- `scripts/loops/boundary.manifest` (the setup file); `boundary.allowlist` lowered if a count drops.

**Acceptance criteria**

- `pnpm test:tooling` and `pnpm test:project` pass in the checkout.
- **B-929's proof:** `node scripts/loops/standalone.mjs` passes with `--root sample`, `--root project` and `--root none`, nothing failed or hung (the three totals in the slice's report and _Status_).

**Blocked by:** 1, 3, 5, 6. **Blocks:** none.
