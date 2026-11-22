# Plan: Test health

> Source PRD: [`plans/test-health-prd.md`](test-health-prd.md). User-story numbers (US) refer to it. Backlog items B-271 to B-283. Topic `test-health`.

## Status

**Landing mode: run everything through** (started run-through, 2026-11-21): start every ready slice, land each green wave through its PR + Codex, clean up; ask only real questions via `pnpm prd ask`.

**Where it stands:** **wave 3 running** (session started 2026-11-22): slice 11 merged (f759f646; its full integration run had one calendarCron 5 s timeout, B-479, passing alone); slice 12 started (worktree test-health-12 slot 6, opus); B-283 claimed. Backlog ingest/doctor/list at the boundary: nothing new for test-health. Wave 3's landing runs `caffeinate -i pnpm prd browser --suite` once (the specs change). Codex: ask the user again at the PR whether to wait or land `--no-review` (it was out of credits on 2026-11-22; per memory, review exit 4 "out of credits" lands --no-review unasked). Earlier: wave 2 landed via PR #49 (dev 43d53bf), wave 1 via PR #47 (dev 69e9c6e).

Notes for later slices: B-475 flake (fixes-tooling, timelineSimpleTodos undo timer after teardown). Slice 3: a world's own fixed clock must sit on the test clock's day (2027-06-09); plannerWorld's NOW still has its own base. Slice 4 for slice 12: the lib/search/ default and search's rules point at signout-wipe. Slice 10 for slice 12: `page.clock.install()` before `goto` then `fastForward` replaces form-time waits; it didn't touch fixtures.mjs; vitest 5 `toHaveTextContent` matched only whole text, so use scoped `getByText`. Slice 8 for wave 6: 1,323 warnings (slice 15 timeline+entry 678, slice 16 378, slice 17 129, slice 18 137, incl. `groups/new` 1); rules are `caretook/*` in scripts/eslint/plugin.mjs, disable with `// eslint-disable-next-line caretook/<rule> -- <reason>`; `no-non-null-in-expect` also flags non-DOM `!` (use `?.`). Slice 11 for slice 13: `createWorld` (packages/data/test/fixtures.ts, header documents it) moved 23 data files; the api files still use createUser/createGroup and their own clientFor; easyMode.int.test.ts stays off it (second owner). Slice 9: admin's deviceLabel is now lib/auth's ("macOS"; no "Caretook app" WebView label); groupRoleLabel lives only in @caretook/data/permissions. **Slices 1, 2, 6 and 7 moved to [`check-speed`](check-speed-plan.md)**: skip them. Nothing outside this PRD blocks any wave; the pause after wave 4 isn't needed.

**Models:** slices 3, 4, 5, 8, 9, 10, 11, 12 on opus.

**Unplanned items triaged to test-health** (notes added 2026-11-22: B-371 to B-374 are new coverage, out of this PRD's scope, proposed for a follow-up PRD; B-370 may already be covered by check-speed's always-run list) (not in any slice yet; to fold into later waves or a follow-up at a wave boundary): B-370 quick check always-run guards, B-371 device-to-server round trip per table, B-372 a second time zone in tests, B-373 role coverage gaps, B-374 uploadData error test, B-375 small test fixes (its `retry: 2` part is slice 15's), B-405 worker database name collision, B-418 recover.test.mjs flake under load.

| Slice | Wave | State          | Merge into `prd/test-health` (slice commits) |
| ----- | ---- | -------------- | -------------------------------------------- |
| 1     | 1    | moved          |                                              |
| 2     | 1    | moved          |                                              |
| 3     | 1    | landed (opus)  | 91beec28 (a3d6ad9f)                          |
| 4     | 1    | landed (opus)  | 2d4f6678 (19d73291)                          |
| 5     | 1    | landed (opus)  | 09bc4bd5 (60f17a4f)                          |
| 6     | 2    | moved          |                                              |
| 7     | 2    | moved          |                                              |
| 8     | 2    | landed (opus)  | b8a023cf (6c7284a4)                          |
| 9     | 2    | landed (opus)  | efd71cca (c9fd4f50)                          |
| 10    | 2    | landed (opus)  | 2b3b3046 (15ebe405)                          |
| 11    | 3    | merged (opus)  | f759f646 (be8b1ed0)                          |
| 12    | 3    | started (opus) |                                              |
| 13    | 4    | not started    |                                              |
| 14    | 5    | waiting        |                                              |
| 15    | 6    | waiting        |                                              |
| 16    | 6    | waiting        |                                              |
| 17    | 6    | waiting        |                                              |
| 18    | 6    | waiting        |                                              |
| 19    | 7    | waiting        |                                              |

**Backlog:** which slices close each item (run `pnpm backlog done` on an item when its last slice merges).

| Item                                       | Slices          |
| ------------------------------------------ | --------------- |
| B-274 one test clock, one `fixClock`       | 3, 15 to 18, 19 |
| B-275 one `waitUntil`, one timeout         | 3, 15 to 18, 19 |
| B-276 `getByCss`, locators, the lint rules | 8, 15 to 18, 19 |
| B-277 browser-check bookkeeping            | 4               |
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
- **How checks run is `check-speed`'s** (the lease, the check log, the check plan, the `tooling:unit` project, worker databases): follow its plan's decisions. Use `pnpm prd check` once its wave 1 is in `dev`, and hand off on `pnpm prd check --quick "<why>"` once its wave 2 is.
- **The test clock:** a fixed base date at 12:00 America/Los_Angeles on a weekday away from daylight-saving changes and month ends (2027-06-09), set before the test file's imports, reset before each test, ticking. `VITE_TEST_CLOCK` still moves the time of day. Harness deadlines use `performance.now()`.
- **The harness API** lives in `apps/web/test/` (`found.ts` and beside it): `found`, `waitUntil`, `stopsMoving`, `getByCss`, `fixClock`, one timeout constant. Tests and world files import from there and define no copies.
- **Lint rules** are local ESLint rules in the repo, scoped to `*.browser.test.tsx`, `apps/web/test/` and `*World.tsx`: warnings until slice 19. A real exception carries `// eslint-disable-next-line <rule> -- <reason>`.
- **Component test files are hot.** Slices 1 to 13 don't edit `*.browser.test.tsx` or `*World.tsx` files beyond what a harness change breaks (slice 3), and list each such edit in the hand-off. The sweeps are slices 14 to 19.
- **Loops never edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing (below).

## How to run this plan

- **Waves:** (3, 4, 5) → (8, 9, 10) → (11, 12) → 13 → _pause_ → 14 → (15, 16, 17, 18) → 19. Slices 1, 2, 6 and 7 are `check-speed`'s.
- **Land each wave** through its PR as it goes green. After wave 4, pause: stop the orchestrator and restart it (`pnpm prd start test-health`) once `list-filters`, `planner-2` and `ui-kit` are in `dev`. Wave 5's first step is `pnpm prd sync`.
- **Gates:** until `check-speed` lands, the gate rules in the orchestrator handbook apply as written. Once it has, wave gates are quick checks (the check plan forces a full one where needed) and wave 7's gate is the full check. A wave whose diff is tooling and Markdown only needs the tooling tests and prettier, as now.
- **Browser checks:** slices 10 and 12 run the checks they edit (`pnpm prd browser <check>`); slice 4 runs `pnpm prd browser --changed --list` to show the resolver still answers. The orchestrator runs `--suite` once at wave 3's landing (the specs changed) and once at wave 7's.
- **Shared files inside a wave:**
  - Wave 2: slice 8 adds tests to `scripts:unit`; `check-speed` owns `vitest.config.ts`'s project blocks.
  - Wave 6: each slice owns its directories and its own `*World.tsx`; nobody edits `apps/web/test/`. A harness gap found in wave 6 goes to the orchestrator, who fixes it on `prd/test-health` and tells the four loops to merge it.
- **Ownership:**
  - Slice 3: `apps/web/test/setup.ts`, `found.ts`.
  - Slice 4: `scripts/loops/checks`, `checks.mjs`, `checks.test.mjs`, `browser.sh`'s manifest reading, `check-areas.mjs`, `check-areas.d/`.
  - Slice 8: the locator in `apps/web/test/`, the rules and `eslint.config.js`.
- **Docs at landing (the orchestrator):**
  - Wave 1: `docs/agents/loop.md` (the manifest and ceiling paragraphs; directory defaults in _Which checks a file needs_), `docs/agents/orchestrator.md` (the registries line no longer says each composed result is frozen in a test), `docs/domain/components.md` (the clock, `waitUntil`).
  - Wave 2: `components.md` (`getByCss`, the lint rules).
  - Waves 3 and 4: `loop.md` (the check list: `signout-wipe` gone, what `marketing` and `ui` still own), `data-layer.md` (`createWorld` and the helpers), `docs/domain/marketing.md` if its tests are named there.
  - Wave 7: `components.md` (the rules are errors; the probe route).

---

## Slice 1: Loops check through the lease; the lease waits for load

Moved to [`check-speed`](check-speed-plan.md) as its slice 1. Nothing to build here.

## Slice 2: Tooling tests in their own Vitest project

Moved to [`check-speed`](check-speed-plan.md) as its slice 2. Nothing to build here.

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

Moved to [`check-speed`](check-speed-plan.md) as its slice 3. Nothing to build here.

## Slice 7: Integration: a database per worker

Moved to [`check-speed`](check-speed-plan.md) as its slice 4. Nothing to build here.

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

**Blocked by:** `check-speed` in `dev` (its slice 4, worker databases). **Blocks:** 13.

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
