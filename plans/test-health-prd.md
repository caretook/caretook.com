# PRD: Test health (faster checks, a steadier harness, fewer tests that only detect change)

> Topic `test-health`. Backlog: B-274 to B-277, B-279 to B-283. **How checks run (B-271, B-272, B-273, B-278: the lease, quick at hand-off, the tooling project, worker databases; user stories 1 to 20) moved to [`check-speed`](check-speed-prd.md) on 2026-11-21**, where the load gate was dropped; those parts below are kept for the record. Plan: [`plans/test-health-plan.md`](test-health-plan.md).

## Problem Statement

The 2026-11-21 test review (static: nothing was run, and its counts are estimates) found that the test suite costs more than it protects, in three ways.

- **Checks run too often and all at once.** Slice loops run a bare `pnpm check`, outside the check lease, so a wave of loops finishing together runs every full suite at the same time. Nothing waits for the machine to calm down: 38 of 53 logged browser flakes happened at a load above 30. A three-slice wave runs three full suites plus one to five gate checks. About 240 of the 306 tooling tests guard the agent workflow, spawn processes and sleep for real, yet run in every check. Integration files run one at a time on one database.
- **The component harness invites races.** The test clock restarts at noon per file and keeps moving, so minutes turn mid-test; `fixClock` exists twice on different bases. There are seven copies of `waitUntil`, and 431 of 584 calls pass their own milliseconds, most below the central timeout. There is no retrying way to reach a `data-` hook, so tests read `X()!` synchronously in about 300 `userEvent` calls and 200 to 250 `expect` calls, and about 45 tests sleep for a fixed time. Each of these has been swept by hand before (B-176, B-178, B-180, B-228) and has grown back.
- **Many tests only detect change.** Frozen lists (schema exports, URL keys, procedure paths, the route list) are edited in almost every feature commit and catch nothing the typecheck doesn't. Other tests restate a URL template, assert marketing copy or exact seed counts, repeat a unit test in a component test, repeat a component test in Playwright, or re-test a data-layer rule through sync upload and the connector.

The dev keeper wants checks that finish sooner, fail only for real reasons, and don't need editing when nothing meaningful changed.

## Solution

**How checks run**

- **Every check goes through the check lease**, loops included: a loop's hand-off check is `pnpm prd check`, never a bare `pnpm check`.
- **The lease waits for a calm machine.** A check starts only when the 5-minute load average is below 16. If the load stays high for the whole wait, the check runs anyway and prints a warning with the load.
- **Quick by default, full at the end.** A loop hands off on a quick check (typecheck, lint, format, and the tests related to its diff). Wave gates are quick too. The full check runs once, on the PRD's last wave. The tooling itself forces a full run when the diff touches a migration, seeds, the sync config, the lockfile, a `package.json` or the Vitest config. A quick check always adds a short always-run list: the tests that read files by path, which "tests related to the diff" can't see.
- **Agent-tooling tests live in their own Vitest project**, outside `pnpm check`. `pnpm prd check` adds them when the diff touches the tooling; `pnpm test:tooling` runs them by hand.
- **Integration tests run in parallel**, three workers by default, each on its own database.
- **Less bookkeeping for browser checks.** The manifest keeps each check's cap and drops its usual seconds and the lean ceiling. Each area declares a default for its directories, so a new file needs no rule.

**The component harness**

- **One test clock:** a fixed base date at noon, reset before every test, still ticking. Harness deadlines use `performance.now()`, so a test that fakes `Date` can't break a wait. One shared `fixClock`.
- **One `waitUntil` and one timeout**, in the harness. Tests don't pass milliseconds.
- **A retrying `getByCss` locator**, and world helpers that return locators.
- **Four lint rules** keep it that way: no per-call milliseconds, no non-null argument to `userEvent`, no non-null read inside `expect`, no fixed sleep. They start as warnings, every area's tests are migrated, then they become errors.

**The cuts**

- **Unit:** the frozen lists go; the route list is replaced by invariants about the native build. Tests that restate a template, marketing copy, exact seed counts or a label map are trimmed to what they protect.
- **Component:** duplicates and pixel or class assertions go; frame, harness and primitive tests use a small probe route, not the timeline.
- **Playwright:** steps that need no browser or only one device move down to unit and component tests (marketing first); fixed sleeps go; `signout-wipe` merges into `session-end`.
- **Server:** the member role matrix and the condition refusals move down to the data layer; shared fixtures replace the copies; rules re-tested through sync upload and the connector are trimmed to each entry point's own branches.

## User Stories

1. As the dev keeper, I want every check on the machine to take a check lease, so that a wave of loops finishing together doesn't run every suite at once.
2. As a loop, I want my hand-off check to queue for a lease by itself, so that I don't need to know what else is running.
3. As the dev keeper, I want a check to wait while the 5-minute load is 16 or more, so that tests don't time out for reasons that aren't bugs.
4. As a loop, I want a check that has waited its full time to run anyway with a warning, so that a busy machine never stalls my slice.
5. As an orchestrator, I want that warning to print the load, so that I can discount a timeout seen under it.
6. As the dev keeper, I want to change or switch off the load threshold with an environment variable, so that it can follow the hardware.
7. As a loop, I want to hand off on a quick check, so that my slice doesn't pay for the full suite.
8. As an orchestrator, I want wave gates to be quick checks and the full check to run once on the last wave, so that a PRD runs the full suite once.
9. As an orchestrator, I want the tooling to force a full check when the diff touches a migration, seeds, the sync config, the lockfile, a `package.json` or the Vitest config, so that I can't choose quick by mistake.
10. As an orchestrator, I want the check to say why it went full, so that the reason is on the record.
11. As the dev keeper, I want a quick check to always run the tests that read files by path (the sync matrix, the layout, security-header and error-registry tests, the check-areas lint and the docs budget), so that "related to the diff" has no blind spot.
12. As the dev keeper, I want the decision of what a check runs to live in one pure, tested module, so that the rules are readable and can't drift between scripts.
13. As a loop working on app code, I want the agent-tooling tests out of my check, so that I don't wait for tests of scripts I didn't touch.
14. As a loop working on tooling, I want `pnpm prd check` to add the tooling tests when my diff touches the tooling, so that I can't skip them.
15. As the dev keeper, I want `pnpm test:tooling`, so that I can run the tooling tests on `dev` after a small tooling change.
16. As the dev keeper, I want the sync matrix, check-areas, deploy, workflow and build tests to stay in the default run, so that app changes are still guarded by them.
17. As a loop, I want integration files to run on three workers, so that the integration project takes about a third of the time.
18. As a test author, I want each worker to have its own database, so that a test that wipes a global table can't break a file running beside it.
19. As the dev keeper, I want a worktree's worker databases dropped when the worktree is removed, so that the shared test Postgres doesn't fill up.
20. As the dev keeper, I want one worker to behave as today, so that I can rule parallelism out when debugging.
21. As a loop, I want to change a browser check without editing its usual seconds or a ceiling, so that bookkeeping doesn't ride along with every change.
22. As the dev keeper, I want each check's cap and the suite cap kept, so that a runaway check still stops.
23. As a loop, I want a new file in an area's directory to take that area's default checks, so that adding a file needs no rule.
24. As the dev keeper, I want the check-areas lint to still fail on a dead rule, a tie and a file outside every area, so that defaults don't hide mistakes.
25. As a test author, I want every component test to start at the same fixed date and time, so that a test passes at any hour and on any day.
26. As a test author, I want the clock reset before each test and still ticking, so that ids built from timestamps stay unique and one test's time can't leak into the next.
27. As a test author, I want harness waits to keep working when my test fakes `Date`, so that a frozen clock can't hang a wait.
28. As a test author, I want one `fixClock`, so that medications and the Planner fix time the same way.
29. As a test author, I want one `waitUntil` with one timeout, so that a slow machine is handled in one place.
30. As a test author, I want a retrying `getByCss` locator, so that I can click or assert on a `data-` hook without reading it too early.
31. As a test author, I want world helpers to return locators, so that the retry comes for free.
32. As the dev keeper, I want lint to refuse per-call milliseconds, non-null reads in `expect` and `userEvent` calls, and fixed sleeps, so that the races don't grow back after the sweep.
33. As a loop on another PRD, I want those rules to be warnings until every area is migrated, so that my slice isn't blocked by old tests.
34. As a feature loop, I want to add a table, a URL, a route or a procedure without editing a frozen list, so that my diff is the feature.
35. As the dev keeper, I want the native build guarded by invariants (unique routes; no `/api`, `/rpc`, `/admin`, `/dev`, connector or marketing route in native; every native route also in web), so that the guard states the rule and not the list.
36. As a feature loop, I want to change a seed, a label or marketing copy without fixing tests that restate it, so that tests fail only when behaviour breaks.
37. As the dev keeper, I want the URL tests to keep encoding, fallbacks and parameter rules, the marketing tests to keep ids, icons, links, JSON-LD and the legal compliance patterns, and the seed tests to keep schema validity, ids and references, so that the trims lose no protection.
38. As a feature loop, I want frame, harness and primitive tests to use a probe route, so that a timeline change doesn't break tests that aren't about the timeline.
39. As the dev keeper, I want component tests free of pixel and class assertions and of copies of unit tests, so that a restyle doesn't break them.
40. As an orchestrator, I want the Playwright suite to hold only flows that need the server, sync or a production build, so that the lean set is short and steady.
41. As the dev keeper, I want every Playwright step that is removed mapped to the test that covers it, so that I can see nothing was dropped.
42. As the dev keeper, I want fixed sleeps out of the Playwright specs and fixtures, so that the suite is as fast as the app.
43. As a test author, I want `createWorld`, a sync upload helper and an MCP helper in the server tests, so that a new test doesn't copy fifty lines of setup.
44. As the dev keeper, I want the member role matrix and the condition refusals tested at the data layer, so that each rule has one owner.
45. As the dev keeper, I want every entry-point branch kept (the immutable PATCH, the read-only table, the `done_at` mapping, the connector's invalid-arguments answer), so that the trims remove only repeats.
46. As the dev keeper, I want each cut slice's hand-off to list what it deleted and what still covers it, so that I can review the cuts without the original review.
47. As an orchestrator, I want the component cuts and migrations to wait until `list-filters`, `planner-2` and `ui-kit` have landed, so that two PRDs don't rewrite the same test files.

## Implementation Decisions

**Check plan (new, pure module behind `pnpm prd check`)**

- Input: the list of changed files against the base, and the mode asked for. Output: the mode to run (quick, or full with the reason), the always-run list, and whether the tooling project joins.
- Forced full: a migration, seeds, the sync config, the lockfile, any `package.json`, the Vitest config.
- Always-run on a quick check: the tests that read files by path (the sync matrix, the layout tests, the security-header test, the error-registry tests), the check-areas lint and the docs budget. The build budget stays in the full check.
- Deleted files are covered by the typecheck plus the always-run list.
- The tooling project joins a quick or full check when the diff touches the loop scripts, the backlog scripts or the git hooks.
- A loop's hand-off check is `pnpm prd check --quick "<why>"`. The check still needs a clean tree, so a loop commits, checks, and fixes in further commits.
- Which gate is the last wave's is the orchestrator's rule (in its handbook), not enforced by the tooling. The existing rules that call for a full check (a conflict resolved in code, both sides changing a hot file, or when unsure) stay.

**Load gate (in the lease library)**

- Applies to the `check` kind. Before the command starts, the holder waits while the 5-minute load average is at or above the threshold (default 16; an environment variable changes it or turns it off).
- The load wait counts against the lease's own wait. When it runs out because of load alone, the check runs and prints a warning with the load. A lease slot that never frees still exits 75, as now.
- The loop prompt tells loops to use `pnpm prd check`; the handbooks follow at landing.

**Vitest projects**

- The tooling project holds the loop, backlog and hook tests. The default scripts project keeps the sync matrix, check-areas, the manifest test, deploy and workflow tests and the build tests.
- `pnpm test` (and so `pnpm check`) leaves the tooling project out; `pnpm test:tooling` runs it.

**Worker databases**

- The integration project runs files in parallel, three workers by default, set by an environment variable; one worker gives today's order.
- Each worker has its own database, named from the worktree's database plus the worker number. The global setup clears and migrates one and makes the others from it where Postgres allows, else migrates each.
- The guard that refuses any database but a local test one accepts the suffixed names and nothing else. Removing a worktree drops all of its databases.
- No test file changes.

**Component harness**

- The clock: a fixed base date at 12:00 in the test zone, on a weekday away from daylight-saving changes and month ends; set before the test file's imports and reset before each test; it ticks with real time. The existing time-of-day override stays.
- Deadlines in the harness (`found`, `waitUntil`, `stopsMoving`) use `performance.now()`.
- One `waitUntil` and one timeout constant, with `expect.poll`'s timeout matching it. The few real exceptions carry a lint-disable comment with the reason.
- `getByCss` is a retrying locator usable in `expect.element` and `userEvent`.
- One `fixClock` in the harness, on the same base as the clock.
- The harness changes land first. The copies in world files and tests are removed by the area migrations, because those files are being edited by other PRDs now.

**Lint rules**

- Four local ESLint rules (no new dependency), applied to component tests and world files: no per-call milliseconds on harness waits; no non-null argument to `userEvent`; no non-null read inside `expect`; no fixed sleep.
- Warnings first. The area migrations bring each area to zero warnings; the last slice makes them errors.

**check-areas and the manifest**

- The manifest keeps the name, the cap, never-exits and the lean-set flag. The usual seconds, the lean ceiling and the test that sums them go. The per-check caps and the suite cap stay.
- An area can declare a default for a directory. The most specific rule still wins. The lint still fails on a rule that matches nothing, a tie, a glob in two files and a file outside every area.

**The cuts**

- The review's per-file keep-lists aren't in the repo. Each cut slice works from the backlog notes, re-derives the exact list from the code, and lists every deletion with what still covers it in its hand-off.
- Frozen lists: delete the schema export list, the URL key list and the procedure path list. The route test keeps uniqueness and gains the native-build invariants.
- Change detectors: the trims in user story 37; the calendar URL test is deleted; the medication type display test becomes one test; the two definitions each of the device label and the group role label merge into one (the only app-code change in this PRD).
- Component: the timeline's pixel and class assertions, repeats of "Given all" and Undo, and repeats of unit tests go. The cross-screen test keeps only its screen-specific parts. Section-current and settings-frame copies become one table. A probe route in the test device serves frame, harness and primitive tests.
- Playwright: marketing keeps what needs a browser, the built site or headers. The primitives check keeps production CSS and the CSP. One-device steps a component test already covers go. The sign-in fixture's one-second sleep and the other fixed sleeps become waits on the thing. `signout-wipe` becomes part of `session-end`.
- Server: the member role matrix and the two condition refusals get data-layer tests first, then their entry-point copies are trimmed. `createWorld`, a client helper, a sync upload helper and an MCP helper replace the copies. The todo sync test named in the backlog note stays.

**Order**

- How checks run, the harness itself and the unit, server and Playwright cuts start now, with nothing ahead of them.
- Every slice that rewrites component test files (the component cuts, the four area migrations, the rules becoming errors) waits for `list-filters`, `planner-2` and `ui-kit` to land. The PRD lands wave by wave and pauses in between.
- No migration, no schema change, no new dependency.

## Testing Decisions

A good test here states a rule and fails only when the rule breaks: it tests behaviour through a module's public interface, never a list or a string the code already states.

- **Check plan:** unit tests of the pure module: which diffs force a full run and with what reason, the always-run list, when the tooling project joins. Prior art: the slice-fields and check-areas tests.
- **Load gate:** tooling tests beside the lease tests, with a stubbed load reading and a short wait: it waits while high, starts when it drops, and runs with a warning when the wait runs out. Prior art: the lease tests.
- **Lint rules:** rule tests with passing and failing snippets for each of the four rules, using ESLint's own rule tester.
- **The harness** (clock, `waitUntil`, `getByCss`) gets no tests of its own (the user's choice): the component suite passing at any time of day is its test.
- **Worker databases** are proven by the integration suite passing on three workers and on one.
- **The cuts and migrations** are verified by the suites they edit and by the hand-off's step-to-test map.

## Out of Scope

- New coverage: the standing priority "every role against every table" is separate work.
- Changing what the browser checks cover beyond moving steps down a layer; a path guard for procedures (to revisit when the native app ships).
- CI: checks stay local, as now.
- The component migrations for areas while `list-filters`, `planner-2` and `ui-kit` are still running.
- Measuring: the review ran nothing. This PRD records times before and after in its hand-offs but sets no target numbers.

## Further Notes

- The review's counts are estimates; a slice that finds a different number says so in its hand-off and carries on.
- This supersedes site-by-site sweeps like B-176, B-178, B-180 and B-228: the lint rules are the lasting fix.
- Docs to fold at landing: the loop handbook (tests, hand-off, the manifest, check-areas), the orchestrator handbook (the check gate, leases, the registries line about frozen lists), components (the harness), data-layer (server fixtures, worker databases), and the core's checks rule (`pnpm test:tooling`).
