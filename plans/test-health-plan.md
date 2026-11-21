# Plan: Test health

> Source PRD: [`plans/test-health-prd.md`](test-health-prd.md). User-story numbers (US) refer to it. Backlog items B-271 to B-283. Topic `test-health`.

## Status

**Where it stands:** planned (2026-11-21), not started. Waves 1 to 4 can start now. Waves 5 to 7 wait until `list-filters`, `planner-2` and `ui-kit` have all landed in `dev`.

| Slice | Wave | State       | Merge into `prd/test-health` (slice commits) |
| ----- | ---- | ----------- | -------------------------------------------- |
| 1     | 1    | not started |                                              |
| 2     | 1    | not started |                                              |
| 3     | 1    | not started |                                              |
| 4     | 1    | not started |                                              |
| 5     | 1    | not started |                                              |
| 6     | 2    | not started |                                              |
| 7     | 2    | not started |                                              |
| 8     | 2    | not started |                                              |
| 9     | 2    | not started |                                              |
| 10    | 2    | not started |                                              |
| 11    | 3    | not started |                                              |
| 12    | 3    | not started |                                              |
| 13    | 4    | not started |                                              |
| 14    | 5    | waiting     |                                              |
| 15    | 6    | waiting     |                                              |
| 16    | 6    | waiting     |                                              |
| 17    | 6    | waiting     |                                              |
| 18    | 6    | waiting     |                                              |
| 19    | 7    | waiting     |                                              |

**Backlog:** which slices close each item (run `pnpm backlog done` on an item when its last slice merges).

| Item                                       | Slices          |
| ------------------------------------------ | --------------- |
| B-271 loops through the lease, load gate   | 1               |
| B-272 quick at hand-off, full at landing   | 6               |
| B-273 tooling tests in their own project   | 2               |
| B-274 one test clock, one `fixClock`       | 3, 15 to 18, 19 |
| B-275 one `waitUntil`, one timeout         | 3, 15 to 18, 19 |
| B-276 `getByCss`, locators, the lint rules | 8, 15 to 18, 19 |
| B-277 browser-check bookkeeping            | 4               |
| B-278 a database per worker                | 7               |
| B-279 frozen lists                         | 5               |
| B-280 change detectors                     | 9               |
| B-281 component cuts, probe route          | 14              |
| B-282 Playwright specs                     | 10, 12          |
| B-283 server tests                         | 11, 13          |

## Architectural decisions

Durable decisions every slice follows:

- **No new dependencies, no migration, no schema change.** The only app-code change is slice 9's merge of the duplicate label definitions.
- **The review isn't in the repo.** A cut slice (5, 9 to 14) works from its backlog note (`pnpm backlog show B-<n>`), re-derives the exact list from the code, and its hand-off has a table: what was deleted or moved, and the test that still covers it. A count that differs from the note is reported, not chased.
- **Cut, don't rewrite.** A cut slice deletes or moves tests; it changes app code only where this plan says so. If a deletion would leave a rule with no test, keep the test and say so.
- **Checks through the lease.** From slice 1 on, every check is `pnpm prd check` (never a bare `pnpm check`). From slice 6 on, a loop hands off on `pnpm prd check --quick "<why>"`.
- **Load gate:** kind `check`, the 5-minute load average, threshold 16 (`CARETOOK_CHECK_MAX_LOAD`; `off` disables). When the wait runs out because of load alone, run with a warning that prints the load.
- **Check plan** is a pure `.mjs` module in `scripts/loops/` that `prd.sh check` calls: changed files and the asked mode in; the mode to run with its reason, the always-run list and "tooling joins" out. Forced full: a migration, seeds, `sync-config.yaml`, the lockfile, any `package.json`, `vitest.config.ts`.
- **Vitest projects:** `tooling:unit` (the `scripts/loops`, `scripts/backlog` and hooks tests) is outside `pnpm test`; `scripts:unit` keeps `sync-matrix`, `check-areas`, `checks`, `scripts/deploy`, `scripts/build` and the new rule and check-plan tests.
- **Worker databases:** `<worktree database>_w<n>`, three workers by default (`CARETOOK_INT_WORKERS`; `1` runs files in order as today).
- **The test clock:** a fixed base date at 12:00 America/Los_Angeles on a weekday away from daylight-saving changes and month ends (2027-06-09), set before the test file's imports, reset before each test, ticking. `VITE_TEST_CLOCK` still moves the time of day. Harness deadlines use `performance.now()`.
- **The harness API** lives in `apps/web/test/` (`found.ts` and beside it): `found`, `waitUntil`, `stopsMoving`, `getByCss`, `fixClock`, one timeout constant. Tests and world files import from there and define no copies.
- **Lint rules** are local ESLint rules in the repo, scoped to `*.browser.test.tsx`, `apps/web/test/` and `*World.tsx`: warnings until slice 19. A real exception carries `// eslint-disable-next-line <rule> -- <reason>`.
- **Component test files are hot.** Slices 1 to 13 don't edit `*.browser.test.tsx` or `*World.tsx` files beyond what a harness change breaks (slice 3), and list each such edit in the hand-off. The sweeps are slices 14 to 19.
- **Loops never edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing (below).

## How to run this plan

- **Waves:** (1, 2, 3, 4, 5) → (6, 7, 8, 9, 10) → (11, 12) → 13 → _pause_ → 14 → (15, 16, 17, 18) → 19.
- **Land each wave** through its PR as it goes green. After wave 4, pause: stop the orchestrator and restart it (`pnpm prd start test-health`) once `list-filters`, `planner-2` and `ui-kit` are in `dev`. Wave 5's first step is `pnpm prd sync`.
- **Gates:** until slice 6 lands, the gate rules in the orchestrator handbook apply as written. From wave 2's landing on, wave gates are quick checks (the check plan forces a full one where needed) and wave 7's gate is the full check. A wave whose diff is tooling and Markdown only needs the tooling tests and prettier, as now.
- **Browser checks:** slices 10 and 12 run the checks they edit (`pnpm prd browser <check>`); slice 4 runs `pnpm prd browser --changed --list` to show the resolver still answers. The orchestrator runs `--suite` once at wave 3's landing (the specs changed) and once at wave 7's.
- **Shared files inside a wave:**
  - Wave 2: slices 6 and 7 both edit `vitest.config.ts` only if slice 6 needs it (it shouldn't); slice 7 owns the `integration` block. Slices 6 and 8 both add tests to `scripts:unit`.
  - Wave 6: each slice owns its directories and its own `*World.tsx`; nobody edits `apps/web/test/`. A harness gap found in wave 6 goes to the orchestrator, who fixes it on `prd/test-health` and tells the four loops to merge it.
- **Ownership:**
  - Slice 1: `lease.sh`, `lease.mjs`, their tests, the loop lines of `prompt.sh`.
  - Slice 2: the `scripts:unit` and `tooling:unit` blocks of `vitest.config.ts`, the `test` scripts in `package.json`.
  - Slice 3: `apps/web/test/setup.ts`, `found.ts`.
  - Slice 4: `scripts/loops/checks`, `checks.mjs`, `checks.test.mjs`, `browser.sh`'s manifest reading, `check-areas.mjs`, `check-areas.d/`.
  - Slice 6: `prd.sh`'s `check`, the check-plan module, `prompt.sh`'s check lines.
  - Slice 7: `packages/data/test/`, `testDatabase.ts`, `test-db.sh`, `rm.sh`, the `integration` block.
  - Slice 8: the locator in `apps/web/test/`, the rules and `eslint.config.js`.
- **Docs at landing (the orchestrator):**
  - Wave 1: `docs/agents/loop.md` (checks through `pnpm prd check`; the manifest and ceiling paragraphs; directory defaults in _Which checks a file needs_), `docs/agents/orchestrator.md` (the load gate in _Machine leases_; the registries line no longer says each composed result is frozen in a test), the core's _Checks_ rule and `loop.md`'s project list (`pnpm test:tooling`), `docs/domain/components.md` (the clock, `waitUntil`).
  - Wave 2: `loop.md` (hand-off on a quick check, the worker databases), `orchestrator.md` (_The check gate_: quick gates, full on the last wave, the forced list is the tooling's), `components.md` (`getByCss`, the lint rules), `docs/domain/data-layer.md` (worker databases).
  - Waves 3 and 4: `loop.md` (the check list: `signout-wipe` gone, what `marketing` and `ui` still own), `data-layer.md` (`createWorld` and the helpers), `docs/domain/marketing.md` if its tests are named there.
  - Wave 7: `components.md` (the rules are errors; the probe route).

---

## Slice 1: Loops check through the lease; the lease waits for load

Stack: no · Reads: docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-271. **User stories:** 1 to 6.

**What to build**

- A load gate in the lease library (`lease.sh`, and `lease.mjs` if it takes `check` leases): for kind `check`, after a slot is taken and before the command runs, wait while the 5-minute load average is at or above `CARETOOK_CHECK_MAX_LOAD` (default 16; `off` disables). The wait counts against the lease's wait. When it runs out because of load alone, run the command and print one warning line with the load. Print the load when the command starts.
- The load reading comes through one function that a test can replace (an environment variable naming a stub command is enough).
- `prompt.sh`: the slice prompt's two `pnpm check` lines say `pnpm prd check`.

**Acceptance criteria**

- [ ] Tooling tests beside the lease tests, with a stubbed load and a short wait: the command doesn't start while the load is high; it starts when the load drops; it runs with a warning naming the load when the wait runs out; `off` skips the gate; a kind other than `check` isn't gated; a slot that never frees still exits 75.
- [ ] `prompt.test.mjs` (or the slice prompt's own test) shows a loop is told `pnpm prd check`.
- [ ] The tooling tests pass (`pnpm exec vitest run --project scripts:unit scripts/loops`) and prettier is clean on the changed files.

**Blocked by:** nothing. **Blocks:** 6.

## Slice 2: Tooling tests in their own Vitest project

Stack: no · Reads: none · Tests: unit

**Backlog:** B-273. **User stories:** 13, 15, 16.

**What to build**

- A `tooling:unit` project in `vitest.config.ts`: the tests under `scripts/loops/` and `scripts/backlog/` and `scripts/hooks.test.mjs`, except the ones the default run keeps. Keep the 20 s timeout there.
- `scripts:unit` keeps `scripts/loops/sync-matrix.test.mjs`, `check-areas.test.mjs`, `checks.test.mjs`, `scripts/deploy/` and `scripts/build/`.
- `pnpm test` leaves `tooling:unit` out; a new `pnpm test:tooling` runs it. (Slice 6 makes `pnpm prd check` add it by diff.)
- Don't fix the tests themselves (the per-test git repo in `check-gate.test.mjs`, the prompt phrases): note them in the hand-off as follow-ups.

**Acceptance criteria**

- [ ] `pnpm exec vitest list --project scripts:unit` names only the kept files; `--project tooling:unit` names the rest; no test file is in neither.
- [ ] `pnpm test` runs no `tooling:unit` test; `pnpm test:tooling` runs them all and passes.
- [ ] `pnpm prd check` passes; the hand-off gives the test counts of both projects and the wall time of `scripts:unit` before and after.

**Blocked by:** nothing. **Blocks:** 6.

## Slice 3: Harness: one test clock and one `waitUntil`

Stack: no · Reads: docs/domain/components.md · Tests: component

**Backlog:** B-274, B-275 (the harness part). **User stories:** 25 to 29.

**What to build**

- `apps/web/test/setup.ts`: the clock starts at the fixed base date (see _Architectural decisions_) before the test file's imports, is reset to it before each test, and ticks. `VITE_TEST_CLOCK` still sets the time of day.
- `apps/web/test/found.ts`: `found` and `stopsMoving` take their deadlines from `performance.now()`; one exported timeout constant; one exported `waitUntil(read, message?)` on that constant; one exported `fixClock` on the clock's base, restoring to the test clock.
- `vitest.config.ts`'s `expect.poll` timeout reads the same value (a literal with a comment naming the constant is fine if the config can't import it).
- Don't remove the copies of `waitUntil` and `fixClock` in tests and world files (slices 15 to 19 do). Fix only tests that fail on the fixed date, with the smallest edit, and list each in the hand-off.

**Acceptance criteria**

- [ ] The component suite passes at the default time and with `VITE_TEST_CLOCK=00:30` and `VITE_TEST_CLOCK=23:45` (`pnpm test:components`, each once).
- [ ] No new harness test file (the user's choice); `apps/web/test/device.browser.test.tsx` still passes.
- [ ] The hand-off lists every test file edited and why, and any test that still needs the wall clock.
- [ ] `pnpm prd check` passes.

**Blocked by:** nothing. **Blocks:** 8.

## Slice 4: Browser-check bookkeeping

Stack: no · Reads: docs/agents/loop.md · Tests: unit

**Backlog:** B-277. **User stories:** 21 to 24.

**What to build**

- `scripts/loops/checks`: drop the `usual` column and the `lean-ceiling` line; keep the name, cap, never-exits and e2e columns. Update `checks.mjs`, `browser.sh` (it reads the cap and never-exits by column) and anything else that parses the file.
- `checks.test.mjs`: drop the ceiling tests; keep "one spec per manifest line" and "the manifest and `check-areas.d/` agree".
- `check-areas.mjs`: an area file can declare a default for a directory, used by any file under it that no other rule matches. The most specific rule still wins. Lint still fails on a rule that matches nothing, a tie, a glob in two files, and a tracked file under no rule and no default.
- `check-areas.d/`: give each area's directories a default and delete the per-file rules it makes redundant (same answer as before for every tracked file, except where a rule was only there to satisfy the lint).

**Acceptance criteria**

- [ ] `check-areas.test.mjs`: a file under a directory default resolves to it; a more specific rule beats the default; a file under no rule and no default fails the lint; a dead rule and a tie still fail.
- [ ] A test or a script in the hand-off shows every tracked file resolves to the same checks before and after, listing any intended difference.
- [ ] `browser.test.mjs` covers the new column positions (the cap and never-exits are still read correctly).
- [ ] `pnpm prd browser --changed --list` runs; the tooling tests and `pnpm prd check` pass.

**Blocked by:** nothing. **Blocks:** 12.

## Slice 5: Unit: frozen lists out, native-build invariants in

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/api.md · Tests: unit

**Backlog:** B-279. **User stories:** 34, 35.

**What to build**

- Delete the frozen lists: the export list in `packages/data/src/db/schema/index.test.ts`, the `KEYS` list in `apps/web/app/lib/app-shell/appUrls.test.ts`, the path list in `packages/api/src/routerPaths.test.ts`. Keep any test in those files that states a rule (not a list); delete a file left empty.
- `apps/web/app/routes.test.ts`: replace the frozen route list with invariants: route ids and paths are unique; the native build has no `/api`, `/rpc`, `/admin`, `/dev`, connector or marketing route; every native route is also a web route.

**Acceptance criteria**

- [ ] Unit tests in `routes.test.ts` for each invariant, each shown to fail in the hand-off by a one-line local change (not committed).
- [ ] The hand-off table: each deleted list, and what catches a removal now (the typecheck, a typed client, an invariant).
- [ ] `pnpm prd check` passes.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 6: Check plan: quick at hand-off, forced full, the always-run list

Stack: no · Reads: docs/agents/orchestrator.md · Tests: unit

**Backlog:** B-272; completes B-273's "run only when tooling changes". **User stories:** 7 to 12, 14.

**What to build**

- A pure check-plan module in `scripts/loops/`: `(changed files, asked mode) → { mode, reason, alwaysRun, tooling }`.
  - Forced full, with the reason naming the file: a migration, seeds, `powersync/sync-config.yaml`, the lockfile, any `package.json`, `vitest.config.ts`.
  - `alwaysRun` on a quick check: `scripts/loops/sync-matrix.test.mjs`, `apps/web/app/libLayout.test.ts`, the security-header test, the error-registry tests (and any other test you find that reads source files by path: list them), the check-areas lint and the docs budget.
  - `tooling` is true when a changed file is under `scripts/loops/`, `scripts/backlog/` or `.githooks/` (or is `scripts/hooks.test.mjs`).
- `prd.sh check`: compute the diff against the quick base (as today; a slice's base is its `BASE_BRANCH`), ask the module, print the mode and reason, and run it inside the lease. A quick check runs typecheck, lint, format, `vitest run --changed <base>` without `tooling:unit`, then the always-run list, then `tooling:unit` when asked. A full check runs `pnpm check`, `pnpm build:budget`, and `tooling:unit` when asked. The record file still says `quick` or `full`.
- `prompt.sh`: a loop hands off on `pnpm prd check --quick "slice hand-off"`; the orchestrator lines say wave gates are quick and the last wave's is full.

**Acceptance criteria**

- [ ] Unit tests of the module (in `scripts:unit`): each forced-full trigger with its reason; a plain app diff stays quick; the always-run list is returned for quick and not duplicated for full; tooling joins for each tooling path and not for an app path; an empty diff.
- [ ] A test that every path in the always-run list exists (so a rename can't empty it silently).
- [ ] `check-gate.test.mjs` (or beside it): a quick check asked on a diff with a migration records `full`; landing still accepts both records.
- [ ] `pnpm test:tooling` and `pnpm prd check` pass; the hand-off shows the output of one quick and one forced-full run.

**Blocked by:** 1, 2. **Blocks:** nothing.

## Slice 7: Integration: a database per worker

Stack: no · Reads: docs/domain/data-layer.md · Tests: integration

**Backlog:** B-278. **User stories:** 17 to 20.

**What to build**

- `vitest.config.ts`, `integration`: files in parallel on `CARETOOK_INT_WORKERS` workers (default 3); `1` keeps today's one-at-a-time order.
- `packages/data/test/globalSetup.ts`: make, clear and migrate `<database>_w<n>` for each worker (migrate one and create the others from it as a template where that works, else migrate each). Both the shared test Postgres and the main checkout's test database.
- The test database resolver (`packages/data/src/db/testDatabase.ts`) and `packages/data/test/setup.ts`: a worker connects to its own database, picked from Vitest's worker id; the guard accepts only the worktree's own suffixed names.
- `scripts/loops/test-db.sh` and `rm.sh`: `drop` and worktree removal drop every database of the worktree; `list` and `status` still read well.
- No `*.int.test.ts` changes. If a file fails only in parallel, it shares state outside the database: fix that or report it; don't serialise the whole project.

**Acceptance criteria**

- [ ] `pnpm test:integration` passes with 3 workers twice in a row, and with `CARETOOK_INT_WORKERS=1`.
- [ ] A unit test of the resolver: worker ids map to distinct names; a name outside the worktree's own is refused; the production and dev databases are still refused.
- [ ] A tooling test (in `stack.test.mjs` or beside `test-db.sh`'s tests): removing a worktree drops all of its worker databases.
- [ ] The hand-off gives the integration project's wall time before and after, and the setup time; `pnpm prd check` passes.

**Blocked by:** nothing (wave 2 so it follows slice 2's `vitest.config.ts` edit). **Blocks:** 11.

## Slice 8: Harness: a retrying `getByCss` and the lint rules

Stack: no · Reads: docs/domain/components.md · Tests: unit, component

**Backlog:** B-276 (the harness part), B-275 (its rule). **User stories:** 30, 32, 33.

**What to build**

- `getByCss(selector, { within? })` in `apps/web/test/`: a retrying locator for a CSS selector (the `data-` hooks), usable with `expect.element` and `userEvent`, strict by default with `.first()`, `.nth()` and `.all()` as Vitest's locators have.
- Four local ESLint rules (no new dependency), wired in `eslint.config.js` as **warnings** for `apps/web/**/*.browser.test.tsx`, `apps/web/test/**` and `apps/web/**/*World.tsx`:
  - no per-call milliseconds on `found`, `waitUntil`, `stopsMoving`, `expect.poll` and `expect.element`;
  - no non-null (`!`) argument to a `userEvent` call;
  - no non-null read inside `expect(…)`;
  - no fixed sleep (`setTimeout` in a promise, or a `sleep`/`wait(ms)` helper).
- Migrate `apps/web/test/` itself to zero warnings. Don't touch tests or world files outside it.

**Acceptance criteria**

- [ ] Rule tests with ESLint's rule tester (in `scripts:unit`): for each rule, passing and failing snippets, including the disable-comment exception and the look-alikes it must not flag (a `timeout` on a network helper, `!` outside `expect`).
- [ ] `getByCss` is used by at least one existing test in `apps/web/test/device.browser.test.tsx` in place of a `$` read, and that file passes.
- [ ] `pnpm lint` exits 0 (warnings only); the hand-off gives the warning count per rule and per area directory, which sizes slices 15 to 18.
- [ ] `pnpm prd check` passes.

**Blocked by:** 3. **Blocks:** 15 to 18.

## Slice 9: Unit: trim change detectors

Stack: no · Reads: docs/domain/marketing.md, docs/domain/data-layer.md · Tests: unit

**Backlog:** B-280. **User stories:** 36, 37.

**What to build**

- URL tests (`lib/<area>/urls.test.ts`): delete assertions that restate a template; keep encoding, fallbacks and parameter rules. `lib/calendars/urls.test.ts` is deleted.
- Marketing tests: delete copy assertions; keep ids, icons, hrefs, JSON-LD and the legal compliance regexes.
- Seed tests: delete exact counts and names; keep schema validity, ids and references.
- Label maps: `medicationTypeDisplay.test.ts` becomes one test; other label-map tests likewise.
- Merge the two definitions of `deviceLabel` into one and the two of `groupRoleLabel` into one, with one test each; callers import the survivor.

**Acceptance criteria**

- [ ] The hand-off table: per file, what was deleted and what was kept, with line counts before and after.
- [ ] One unit test each for the merged `deviceLabel` and `groupRoleLabel`; the typecheck shows no caller of a deleted definition.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 10: Playwright: marketing's no-browser steps move out

Stack: yes · Reads: docs/domain/marketing.md, docs/agents/loop.md · Tests: unit, component, e2e:marketing

**Backlog:** B-282 (marketing). **User stories:** 40 to 42.

**What to build**

- `scripts/browser-checks/marketing.spec.mjs`: for each of its tests, decide whether it needs a browser, the built site or real headers. Those stay. A step a unit test already covers is deleted; a step that needs no browser becomes a unit test (or a component test for one page's behaviour) beside the marketing code.
- Replace the minimum-form-time waits with a way to submit a form that the server accepts without sleeping (a check-build or test-only seam the spec can use), or keep one such wait in one test and say why.

**Acceptance criteria**

- [ ] The hand-off maps every removed step to the unit or component test that covers it (new or existing, named).
- [ ] `pnpm prd browser marketing` passes; its run time before and after is in the hand-off.
- [ ] No fixed sleep is left in `marketing.spec.mjs`, or the one that stays has a comment with the reason.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** nothing. **Blocks:** 12 (both may touch `fixtures.mjs`).

## Slice 11: Server: the member matrix and condition refusals move to the data layer

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/care-groups.md, docs/domain/connectors.md · Tests: integration

**Backlog:** B-283 (first half). **User stories:** 43, 44.

**What to build**

- `createWorld` in `packages/data/test/fixtures.ts`: one call builds the group, its members by role and the usual rows that 13 data test files rebuild by hand. Move those files onto it.
- Data-layer integration tests for the member role matrix (today owned only by `packages/api/src/router.int.test.ts`) and for the `conditionDeleted` and `conditionNotFound` refusals (today reached only through `mcpWrites.int.test.ts`), against the services.
- Then trim the router and connector copies to one test per entry point that proves the refusal is passed through.

**Acceptance criteria**

- [ ] Integration tests at the data layer: every role against every member action in the matrix; both condition refusals.
- [ ] The router and connector files keep one pass-through test each for those rules; the hand-off maps every deleted test to its data-layer replacement.
- [ ] `pnpm test:integration` passes on 3 workers; `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 7. **Blocks:** 13.

## Slice 12: Playwright: the other specs, the sleeps, `signout-wipe` into `session-end`

Stack: yes · Reads: docs/agents/loop.md, docs/domain/sync.md, docs/domain/live-notes.md · Tests: component, e2e:session-end, e2e:live-notes, e2e:invites, e2e:app-shell, e2e:phase2, e2e:first-sync, e2e:sign-in, e2e:layout-offline, e2e:ui

**Backlog:** B-282 (the rest). **User stories:** 40 to 42.

**What to build**

- `invites`, `app-shell`, `phase2`, `first-sync`, `sign-in`, `layout-offline`: delete each one-device step an existing component test covers; write the component test first where none does. Flows across the server and sync stay.
- `ui.spec.mjs` keeps only production CSS and the CSP.
- `live-notes.spec.mjs` and `fixtures.mjs` (the one-second sleep in `signIn`): every fixed sleep becomes a wait on the thing.
- Merge `signout-wipe` into `session-end`: move its flow, delete its spec, its manifest line and its `check-areas.d/` rules (pointing them at `session-end`).

**Acceptance criteria**

- [ ] The hand-off maps every removed step to its component test, and lists every sleep removed and what replaced it.
- [ ] Each edited check passes once through `pnpm prd browser <check>`; run times before and after are in the hand-off.
- [ ] `checks.test.mjs` and the check-areas lint pass with `signout-wipe` gone.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 4, 10. **Blocks:** nothing.

## Slice 13: Server: sync and MCP helpers; trim the re-tested rules

Stack: no · Reads: docs/domain/sync.md, docs/domain/connectors.md, docs/domain/api.md · Tests: integration

**Backlog:** B-283 (second half). **User stories:** 43, 45.

**What to build**

- One `clientFor` (copied in 34 files today), a sync upload helper and an MCP call helper in the server test helpers; move the files onto them.
- Trim rules that the data layer already tests and that are re-tested through sync upload and the connector, down to each entry point's own branches. **Keep:** the immutable PATCH, the read-only table refusal, the `done_at` mapping, the connector's `mcp:invalidArguments`, and `syncTodos.int.test.ts` lines 99 to 126 (the test named in the backlog note).

**Acceptance criteria**

- [ ] The hand-off table: each trimmed test, the data-layer test that owns its rule, and the entry-point branches kept per file.
- [ ] No local copy of `clientFor` is left (a grep in the hand-off).
- [ ] `pnpm test:integration` passes on 3 workers; `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 11. **Blocks:** nothing.

## Slice 14: Component cuts and the probe route

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md, docs/domain/app-shell.md · Tests: component

**Backlog:** B-281. **User stories:** 38, 39. **Starts only after `list-filters`, `planner-2` and `ui-kit` are in `dev`.**

**What to build**

- A probe route in the test device (`apps/web/test/`): a minimal screen inside the `/app` frame for tests of the frame, the harness and the primitives.
- Move onto it: `apps/web/test/device.browser.test.tsx` (down to about 180 lines), the frame tests in `routes/app/layout/`, and the parts of `components/ui/inScreens.browser.test.tsx` that aren't about a specific screen.
- Timeline: delete pixel and class assertions (`timelineLayout`, `todayCard`), the repeats of "Given all" and Undo across four files, and `todayCard` and summary tests that repeat unit tests.
- Elsewhere: the section-current and settings-frame copies become one table-driven test; print tests that repeat unit tests go.

**Acceptance criteria**

- [ ] Component tests on the probe route for the frame and the primitives that used the timeline; no frame, harness or primitive test imports a timeline world.
- [ ] The hand-off table: each deleted test or assertion and what still covers it; lines before and after per file.
- [ ] `pnpm test:components` passes; `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** `list-filters`, `planner-2`, `ui-kit` landed; 8. **Blocks:** 15 to 18.

## Slice 15: Migrate timeline and entry tests to the harness

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md · Tests: component

**Backlog:** B-274, B-275, B-276 (timeline). **User stories:** 28 to 31.

**What to build**

- In `routes/app/groups/timeline/` and `entry/` (tests and `timelineWorld.tsx`): remove local `waitUntil`, `$`, `$$` and `fixClock` copies; world helpers return locators; fix every warning of the four rules; drop per-call milliseconds; replace sleeps with waits.
- Remove `retry: 2` in `timelineScroll.browser.test.tsx` and the wall-clock tolerance asserts (`entry`, `timelineHeader`) now that the clock is fixed. `timelineStrips`' real timeout keeps a disable comment with its reason.

**Acceptance criteria**

- [ ] `pnpm exec eslint apps/web/app/routes/app/groups/timeline apps/web/app/routes/app/groups/entry` reports no warning from the four rules.
- [ ] Those directories' component tests pass three times in a row (`pnpm test:components <dirs>`), once with `VITE_TEST_CLOCK=00:30`.
- [ ] The hand-off lists each disable comment left and why; `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 8, 14. **Blocks:** 19.

## Slice 16: Migrate medications, providers and care periods

Stack: no · Reads: docs/domain/components.md, docs/domain/medications.md · Tests: component

**Backlog:** B-274, B-275, B-276 (these areas). **User stories:** 28 to 31.

**What to build**

- The same migration as slice 15 in `routes/app/groups/medications/`, `medication/`, `providers/`, `provider/`, `periods/`, `period/` and `lib/medications/`, with `medicationWorld.tsx`, `providerWorld.tsx` and `periodWorld.tsx`. `medicationWorld`'s `fixClock` goes; its tests use the shared one.

**Acceptance criteria**

- [ ] ESLint reports no warning from the four rules in those directories.
- [ ] Their component tests pass three times in a row, once with `VITE_TEST_CLOCK=00:30`.
- [ ] The hand-off lists each disable comment left and why; `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 8, 14. **Blocks:** 19.

## Slice 17: Migrate planner, todos, search and profile

Stack: no · Reads: docs/domain/components.md, docs/domain/todos.md · Tests: component

**Backlog:** B-274, B-275, B-276 (these areas). **User stories:** 28 to 31.

**What to build**

- The same migration in `routes/app/groups/planner/`, `todos/`, `todo/`, `search/`, `profile/`, `components/todos/`, `components/visitPrep/` and `lib/search/`, with `plannerWorld.tsx` and `profileWorld.tsx`. `plannerWorld`'s `fixClock` goes.

**Acceptance criteria**

- [ ] ESLint reports no warning from the four rules in those directories.
- [ ] Their component tests pass three times in a row, once with `VITE_TEST_CLOCK=00:30`.
- [ ] The hand-off lists each disable comment left and why; `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 8, 14. **Blocks:** 19.

## Slice 18: Migrate settings, admin, account, layout and shared components

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/domain/admin.md · Tests: component

**Backlog:** B-274, B-275, B-276 (the rest). **User stories:** 28 to 31.

**What to build**

- The same migration everywhere slices 15 to 17 don't own: `routes/app/groups/settings/`, `layout/`, `new/`, `routes/app/layout/`, `routes/app/settings/`, `routes/admin/` (with `adminWorld.tsx`), `routes/account/`, `routes/connectors/`, `routes/sign-in`, `components/settings/` and `components/ui/`.

**Acceptance criteria**

- [ ] ESLint reports no warning from the four rules in those directories.
- [ ] Their component tests pass three times in a row, once with `VITE_TEST_CLOCK=00:30`.
- [ ] The hand-off lists each disable comment left and why; `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 8, 14. **Blocks:** 19.

## Slice 19: The lint rules become errors

Stack: no · Reads: docs/domain/components.md · Tests: unit, component

**Backlog:** closes B-274, B-275, B-276. **User stories:** 32.

**What to build**

- `eslint.config.js`: the four rules are errors.
- Sweep what's left: any `waitUntil`, `$`, `$$` or `fixClock` defined outside `apps/web/test/`, and any warning the wave-6 slices missed or that arrived from `dev` since.
- Lower the remaining `timeout:` literals that only restate the central value.

**Acceptance criteria**

- [ ] `pnpm lint` passes with the rules as errors.
- [ ] A grep in the hand-off shows one definition each of `waitUntil`, `fixClock` and the CSS locator, all under `apps/web/test/`.
- [ ] The rule tests still pass; the full component suite passes with `VITE_TEST_CLOCK=00:30` and at the default time.
- [ ] `pnpm prd check` (the full check: this is the last wave) passes; the hand-off gives its wall time beside wave 1's.

**Blocked by:** 15, 16, 17, 18. **Blocks:** nothing.
