# Plan: Code health

> Source PRD: [`plans/code-health-prd.md`](code-health-prd.md). User-story numbers (US) refer to it. Backlog items B-361, B-365, B-366, B-367. Topic `code-health`. Follow-ons, not planned yet: `code-health-2` (B-362, B-363), `code-health-3` (B-364, B-368, B-369).

## Status

**Where it stands:** planned (2026-11-21), not started. Wave 1 can start now. Slice 6 also waits for `simple-mode` to land in `dev` (it renames files across the web app, and lands only when all its slices are merged).

| Slice | Wave | State       | Merge into `prd/code-health` (slice commits) |
| ----- | ---- | ----------- | -------------------------------------------- |
| 1     | 1    | not started |                                              |
| 2     | 1    | not started |                                              |
| 3     | 1    | not started |                                              |
| 4     | 2    | not started |                                              |
| 5     | 1    | not started |                                              |
| 6     | 3    | not started |                                              |

**Backlog:** claim a slice's item when it starts; run `pnpm backlog done` on an item when its last slice merges.

| Item                                                        | Slices |
| ----------------------------------------------------------- | ------ |
| B-366 exact pins                                            | 1      |
| B-365 dead exports (the two role-name guards go with B-363) | 2      |
| B-367 the backlog lock, merge-path tests                    | 3, 4   |
| B-361 the `@caretook/data/domain` export                    | 5, 6   |

## Architectural decisions

Durable decisions every slice follows:

- **No behaviour change, no migration, no new dependency, no version change.** Nothing a screen, a service or a sync stream does differs after any slice. A slice that finds it must change behaviour stops and tells the orchestrator.
- **The review isn't in the repo, and its counts are a reviewer's reading.** Each slice works from its backlog note (`pnpm backlog show B-<n>`) and the PRD's _Notes_, re-derives the exact list from the code on its own base, and puts the list in its hand-off. A count that differs is reported, not chased.
- **Remove only what has no reader.** A name is dead when a search of the whole repository (source, tests, scripts, browser checks) finds no read of it. A name with a reader stays and is reported.
- **The domain export:** `@caretook/data/domain`, client-safe, a folder per area mirroring the schema folder (the `docs/domain/` names plus `core`). A module moves when it defines no table, relation, row type or Zod schema; files move whole, with their tests, keeping their names. The schema may import values from the domain; the domain imports only types from the schema, and never `drizzle-orm` or `pg`. `/series` keeps its export name.
- **One import path per name.** After slice 6 a moved name is importable only from `/domain`.
- **Other PRDs' files:** when a sync brings a pure module another PRD added under the schema folder, or an import of a moved name from `/schema`, move it or fix the path in the merge; never restore a re-export.
- **Comments say what the code does.** No slice here adds a comment naming a slice, a PRD or this plan (B-368 is `code-health-3`'s; don't sweep existing ones).
- **Loops don't edit AGENTS.md or existing docs.** The orchestrator folds the docs at each landing (below). The one exception is slice 3's new knobs page, which is its deliverable.

## How to run this plan

- **Waves:** (1, 2, 3, 5) → 4 → 6.
- **Land each wave** through its PR as it goes green. Wave 1 and wave 2 may land together if wave 2 is green first.
- **Wave 3 runs alone and lands at once.** Start slice 6 only when `simple-mode` has landed in `dev`; `pnpm prd sync` first; open its PR as soon as it's green and land on a clean verdict, so the window in which other branches can add old-path imports stays short. If a later sync conflicts on import lines, take `dev`'s side and rerun the slice's rewrite (its hand-off has the steps), never a hand merge.
- **Gates:** waves 1 and 2 are quick checks where the check plan allows (slices 3 and 4 are tooling only: the tooling tests and prettier). Wave 3's gate is the full check and `pnpm build:budget`; the orchestrator runs the browser checks the check plan asks for on `prd/code-health` before landing it.
- **Shared files inside wave 1:**
  - `packages/data/package.json`: slice 1 owns the dependency groups, slice 5 the `exports` map.
  - `packages/data/src/services/`: slice 2 only (one deleted line per service, the registry block at the end of the index). `fixes-bug` and `sync-safety` edit the same files' bodies: keep slice 2's edits to those lines.
  - `scripts/loops/lib.sh`: slice 3 owns the lock helper; slice 4 (wave 2) adds tests and touches a script only to fix a defect a test exposes.
- **Files other topics have hot:**
  - `dose-accuracy` (planned; the due doses and due passes modules) and `fixes-bug` (running; the todo repeat module, `app/lib/todos/`): slice 5 moves those modules whole and slice 6 deletes or trims their web shims. Git follows a moved file, so their edits merge into the new place; at each `pnpm prd sync` check that a module they edited didn't reappear under the schema folder, and move it if it did. If one of them is mid-wave on a module when slice 5 would start, tell its orchestrator first.
  - `inbox-agent` (planned; `scripts/backlog/`, `lib.sh`) and `test-health` (running; `package.json`, `vitest.config.ts`, `scripts/loops/`): slice 3 changes only the two lock functions and `lease.sh`'s old-directory code, slice 4 adds test files, slice 1 changes only dependency specifiers and adds no script. No slice edits `vitest.config.ts`.
- **Ownership:**
  - Slice 1: every workspace `package.json`'s dependency groups, the lockfile, the pins test.
  - Slice 2: the services' `serviceName` lines and the registry, the database client's `initClient`, the four web names.
  - Slice 3: the lock helper in `lib.sh`, the lock in the backlog CLI, `lease.sh`'s old-directory code, the knobs page and its test.
  - Slice 4: new test files beside `pr.sh`, `ready.sh`, `review.sh`, and additions to `land.test.mjs`.
  - Slice 5: the schema folder's pure modules, the new domain folder, the data package's `exports`, and the `check-areas.d` rules that name a moved file.
  - Slice 6: import lines everywhere, the schema and domain indexes and their frozen lists, the shims, the layout test.
- **Also fixed here:** B-242 (`fixes-tooling`: the lock's `stat` on Linux) is the same function slice 3 rewrites. If it's still unclaimed when slice 3 starts, the orchestrator claims it for the slice and marks it done with it; if `fixes-tooling` got there first, slice 3 builds on that fix.
- **Docs at landing (the orchestrator):**
  - Wave 1: AGENTS.md (the stack line's pin rule names the test; the _Area index_ gains the knobs page beside machinery); `docs/agents/machinery.md` (the lock's takeover; drop the knobs it now only repeats); `docs/domain/data-layer.md` (the registry and `serviceName` gone).
  - Wave 3: AGENTS.md (_Architecture_, Data: `/domain` joins the client-safe exports); `docs/domain/data-layer.md` (what lives in schema and what in domain, the direction rule, the two frozen lists, the recipe for a new pure module); `docs/layout.md`; `docs/agents/orchestrator.md` (_Rules across PRDs_: the registries line names `domain/<area>/`).
- **When it's done:** set `code-health` done, and check `code-health-2`'s row still names what it waits on.

---

## Slice 1: Every dependency pinned exactly

Stack: no · Reads: none · Tests: unit

**Backlog:** B-366. **User stories:** 1, 2.

**What to build**

- In the root, `apps/web` and every `packages/*` manifest, each `^` or `~` specifier in every dependency group becomes the exact version the lockfile resolves for that importer today. `workspace:` specifiers stay.
- Refresh the lockfile so its specifiers match. No resolved version, integrity or package set may change: if one would, stop and report it.
- A tooling test under `scripts/build/` (the `scripts:unit` project already includes that folder, so it runs in `pnpm test` with no `vitest.config.ts` edit): it reads `pnpm-workspace.yaml`'s packages, then every manifest, and fails on any specifier that isn't an exact version or `workspace:`, naming the file and package. A second case feeds it a fixture manifest with a caret, a tilde, a dist-tag and `*` and expects each refused.

**Acceptance criteria**

- [ ] The pins test passes on the repository and its fixture case rejects all four range forms.
- [ ] `pnpm install --frozen-lockfile` succeeds; the lockfile's diff shows specifier lines only (the hand-off quotes `git diff --stat` and says so).
- [ ] The hand-off lists each package with its old range and its pin.
- [ ] `pnpm prd check` passes.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 2: Unused exports removed

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/api.md · Tests: unit, integration

**Backlog:** B-365. **User stories:** 3, 4.

**What to build**

- Remove, each after a repository-wide search finds no reader: `serviceName` from every service; the `services` registry at the end of the services index with its `getService`, `isServiceName`, and the `ServiceName`, `ServiceType`, `ServiceTypeMap` and `ServiceSchemaName` types; `initClient`; `primaryContactName`; `hasContact`; `CALENDAR_CARDS`; `COMING_SOON`.
- Keep the base service's own `getService` (in use). Keep `isUserRoleName` and `isGroupRoleName` (`code-health-2` removes them after `simple-mode`). Keep the oRPC procedures the API doc keeps for later and the connector test helpers.
- A test that only exercises a removed name goes with it; a test that reads one for another purpose means the name has a reader: keep it and report.
- In each service file, delete only the `serviceName` line (and an import it leaves unused).

**Acceptance criteria**

- [ ] The hand-off has a table: each name, where it was, the search that found no reader, removed or kept and why.
- [ ] No new tests; typecheck, lint and the existing unit, integration and component suites pass (`pnpm prd check`).
- [ ] `git diff --stat` shows no service file changed by more than a few lines.

**Blocked by:** nothing. **Blocks:** 6 (both edit files under `app/lib`).

## Slice 3: The backlog lock is held once; knobs documented

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-367 (the lock, the lease path, the knobs). **User stories:** 5, 7.

**What to build**

- **The lock.** In both implementations (the shell helper in `lib.sh` and the backlog CLI's own), a waiter that finds the lock stale takes a second, short-lived takeover lock, reads the age again, clears the lock only if it's still stale, and releases the takeover lock; then it goes back to taking the lock the normal way. A takeover lock left by a dead process is itself cleared after a few seconds. The age is read one way that works with BSD and GNU `stat` (in the shell helper, ask Node or test the output is a number). The 30-second staleness, the 20-second deadline and the lock's path don't change.
- **The lease path.** Remove `lease.sh`'s handling of the old browser-lease directory and the comments about the move, after checking nothing else reads that path.
- **Knobs.** A new page, `docs/agents/knobs.md`: one table row per `CARETOOK_*` variable that anything under `scripts/` or `.githooks/` reads (name, read by, default, what it changes), with patterned families (`CARETOOK_<KIND>_SLOTS`, `_WAIT`) as one row each and test-only seams marked. A tooling test collects the names from the scripts and from the page and fails on a name in one and not the other. Keep the page inside the `docs/agents/` byte budget (`pnpm docs:budget`).

**Acceptance criteria**

- [ ] Tooling test, shell helper: eight waiters started against a lock made stale each append a start and an end line to one file; no two critical sections overlap, and all eight ran. The same for the backlog CLI's lock (drive its lock function, or eight `pnpm backlog note` writes against a throwaway repository).
- [ ] Tooling test: a fresh lock held for a second is not removed by a waiter; the waiter runs after it.
- [ ] Tooling test: the age helper returns a number for a GNU-style and a BSD-style `stat` (stubbed on the path), or no longer calls `stat`.
- [ ] The knobs test passes, and fails when a name is deleted from the page (shown once in the hand-off).
- [ ] `pnpm test:tooling`, `pnpm docs:budget` and `pnpm exec prettier --check` on the changed files pass.

**Blocked by:** nothing. **Blocks:** 4.

## Slice 4: Tests on the merge path

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-367 (the tests). **User stories:** 6.

**What to build**

- First a short table in the hand-off: for `pr.sh`, `ready.sh`, `review.sh` and `land.sh`, each branch the script can take and whether a test reaches it today (`land.test.mjs` covers the PR path's verdict rule, `--recheck` and the to-test file).
- Then tooling tests in `land.test.mjs`'s style (a throwaway repository, a stub `gh` on the path that answers from fixtures; reuse its helpers, moving them to a shared file if two test files need them):
  - **`pr.sh`:** refuses a plan branch; refuses a branch not synced with `dev`; pushes `dev` fast-forward only and stops when the remote diverged; opens a PR with the landing subject as its title, and updates the open one on a rerun.
  - **`ready.sh`:** exits 0 for a synced, committed branch with a check pass on its tip; exits 1, naming the reason, for each blocker the script has (nothing ahead of `dev`, drift from `dev`, uncommitted changes, no check pass, no worktree); the report's "Pull request" section names the open PR and Codex's verdict, or says there is none, without changing the exit status (today's behaviour: pin it, and file it if the orchestrator handbook expects otherwise).
  - **`review.sh`:** exit 0 clean, 1 findings, 2 waiting, 75 when `--wait` runs out (with the poll interval knob at zero), 3 with no open PR; `--resolve` calls the resolve mutation with the thread id.
  - **`land.sh`, what's missing:** a slice branch merged into its `prd/` branch; a plan branch landed with `-m`; a non-conventional subject refused; a merge conflict leaves `dev` and the worktree untouched; the backlog items a landing marks.
- About 25 cases in all, sharing one repository setup per group: each case spawns git, and this suite already times out under load.
- A known bug filed elsewhere (B-239, B-240, B-241) gets one `it.fails` case named with its id, if it's still open, so its fix turns the case over. A new defect a test exposes: fix it here when it's a few lines, else `pnpm backlog add bug …` and an `it.fails` case.

**Acceptance criteria**

- [ ] Each script has at least one test per exit status its header documents, and the hand-off's table shows every listed branch reached or says why not.
- [ ] `pnpm test:tooling` passes three times in a row, and the new files add under 30 seconds to it (the hand-off gives the before and after).
- [ ] `pnpm exec prettier --check` on the changed files passes.

**Blocked by:** 3. **Blocks:** nothing.

## Slice 5: Pure logic moves to `@caretook/data/domain`

Stack: no · Reads: docs/domain/data-layer.md, docs/layout.md · Tests: unit

**Backlog:** B-361 (the move). **User stories:** 8.

**What to build**

- List every non-test module under the schema folder and sort it: defines a table, relation, row type or Zod schema, or is a column helper tables are built from (stays); pure (moves); pure but needs a schema value (stays, with the reason). The list goes in the hand-off. The PRD's _Notes_ has the planner's count (48 files, the quick entry parser, due doses, medication display, vitals and series edits the largest).
- Move each pure module, with its test, to the same area folder under a new domain folder, with `git mv` so history follows. Each area gets an index; the domain gets a top index. Add the `./domain` export to the data package; `/series` keeps its name and points at the file's new home.
- Make the direction hold: where a moved module imported a value from the schema, either the value moves too (a constant list) or the module stays. The domain imports schema types with `import type` only.
- The schema's area indexes re-export what moved out of them, so `@caretook/data/schema` exports exactly the names it did and no importer changes. Don't edit an importer outside the data package in this slice.
- `check-areas.d` rules that name a moved file by path (the planner's skeptic found vitals, the staff rules, the public form rules and the two live-note modules; search for more) are repointed at the new path, keeping the same checks, so no rule goes dead and no moved file loses a browser check to the data package's catch-all.
- Don't split, rename or rewrite a moved module.

**Acceptance criteria**

- [ ] The schema's frozen export list test passes unchanged (no name lost or added).
- [ ] A new frozen list test for the domain index names every export of `@caretook/data/domain`.
- [ ] A unit test over the domain folder's files fails on an import of `drizzle-orm`, `pg`, or a non-type import from the schema folder.
- [ ] The moved modules' unit tests pass from their new place; `git diff --stat -M` shows them as renames.
- [ ] `git diff --stat` shows no file outside `packages/data` and `scripts/loops/check-areas.d/` changed; the check-areas test passes, and the hand-off shows `pnpm prd browser --changed --list` naming the same checks for a moved file as before the move.
- [ ] `pnpm prd check` passes.

**Blocked by:** nothing. **Blocks:** 6.

## Slice 6: One import path: importers switch, the re-export and shims go

Stack: no · Reads: docs/domain/data-layer.md, docs/layout.md, docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-361 (the rest). **User stories:** 9, 10.

**What to build**

- Rewrite every import of a moved name, in the web app, the API, auth and notifications packages, scripts and browser checks, from `@caretook/data/schema` to `@caretook/data/domain`, by a script (split an import that mixes moved and unmoved names; keep `import type` where it was). Put the script's steps in the hand-off so the rewrite can be rerun after a sync; don't commit the script.
- Inside the data package, importers use the domain's files directly.
- Remove the schema indexes' re-exports of the domain. Split the frozen lists: the schema's loses the moved names, the domain's (slice 5) already has them; no name is in both.
- Remove the "keeps the old import path" shims under `app/lib` and point their importers at `/domain`. Six are known: quick entry preview, zoned day, due doses, due passes and medication display are whole-file shims and are deleted; todo display is partly real code, so only its re-exports go and the file stays. Search for more.
- The layout test, beside the schema's frozen list: every non-test module under the schema folder defines a table, relation, row type or Zod schema, is a column helper, or is on a short allow-list with a reason. It joins slice 5's direction test.
- Nothing else changes in a touched file: import lines only (and the re-export lines of a partial shim).

**Acceptance criteria**

- [ ] No import of a moved name from `@caretook/data/schema` remains (typecheck proves it once the re-export is gone); no whole-file shim remains and no file under `app/lib` re-exports a domain name.
- [ ] The two frozen lists pass and share no name; the layout test passes, and fails when a pure module is copied back under the schema folder (shown once in the hand-off).
- [ ] `git diff` outside the data package shows import lines and deleted shims only (the hand-off says how that was checked).
- [ ] `pnpm build:budget` passes, with the first-load figures before and after in the hand-off (not larger).
- [ ] The full `pnpm prd check` passes.

**Blocked by:** 5, 2; `simple-mode` landed in `dev`. **Blocks:** nothing.
