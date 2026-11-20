# PRD: Check migration (screens to component tests, a lean set that stays lean, Playwright Test)

> Topic `check-migration`. Backlog items B-114 to B-129 and B-131. Follows the `orchestration` PRD (done), whose _Browser check budget_ (docs/loops.md) this finishes.

## Problem Statement

The orchestration PRD split testing in two: screens get component tests, and cross-cutting flows get end-to-end checks. The split is only half done.

- **Twelve area checks** (`routing`, `settings-layout`, `providers`, `groups`, `medications`, `upcoming`, `search`, `profiles`, `profiles-contacts`, `care-periods`, `devices`, `admin`) are out of the lean set (`e2e no`), but they still run whenever `--changed` names them. Together they're about 14,900 lines of CDP code; `medications` alone is 4,374 lines and 163 s, and `upcoming` is 203 s. Most of their steps check what one device decides on its own, which is a component test's job.
- **Two lean checks** (`roundtrip`, `invites`) still carry screen steps (sheet validation, form states).
- **The lean set has no ceiling.** The manifest's usual seconds for `e2e yes` checks add up to 356 s, over the 5 minutes it was meant to take, and nothing stops a fold from growing it.
- **No lean check asserts an upload refused by permissions**, though the lean set is meant to cover it (B-128).
- **Component tests can flake under `pnpm check`'s load** (B-131): reads right after a stored write race the screen. There are ten component test files now, and this PRD will add dozens more.
- **The harness is our own CDP client** (`cdp.mjs`, `proxy.mjs`). Playwright Test does the same job, and we already ship `playwright` for the component tests (B-129).

## Solution

- **Steady component tests first:** a test-device helper that waits for the screen to settle after a database change, and the right `web:components` parallelism inside `pnpm check`.
- **A ratcheting budget:** the manifest records a lean ceiling (356 s at first). A unit test fails when the lean set's usual seconds exceed it. Slices that shrink the set lower it, and by the end it's ≤ 300 s.
- **One sync matrix step** in `roundtrip`: every synced table's row, written or seeded on one device, reaches a second device. Plus one refused-upload flow. With both in place, no area keeps its own "a second device sees X" step.
- **Every area check moves:** its screen steps become component tests beside the screens. Each deleted step is mapped to its test, or listed as kept or dropped with a reason. The few flows that exercise a mechanism no lean step covers fold into the lean check that owns the pattern, and the area check and its `check-areas` rules are deleted.
- **Admin's server-loaded pages** get `loaderData` support in the test device.
- **Last, the lean set moves to Playwright Test**, still run only through `pnpm prd browser` with its leases, limits, retry and check build. The CDP harness is deleted.

## User Stories

### Loops and orchestrators

1. As a loop agent, I want component tests that don't flake under load, so that a red `pnpm check` means a real failure.
2. As a loop agent, I want one helper that waits for the screen after a database change, so that I don't hand-roll waits in every test.
3. As a loop agent changing a screen, I want its behaviour covered by component tests beside it, so that `pnpm check` tells me what I broke without a stack.
4. As a loop agent, I want `pnpm prd browser --changed` to name no area check for screen changes, so that my hand-off doesn't wait on CDP runs.
5. As an orchestrator, I want the lean set to stay under 5 minutes, so that landings stay cheap.
6. As an orchestrator, I want the budget test to fail when a change grows the lean set past its ceiling, so that growth is a decision, not drift.
7. As an orchestrator, I want each move's hand-off to map every deleted step to a test, so that I can see nothing was lost.
8. As an orchestrator, I want moves that touch screens another PRD is changing to wait for that PRD's waves, so that I don't resolve the same file twice.
9. As the dev keeper, I want the lean set as the only end-to-end suite before a PR to `staging`, so that the backstop is fast and trusted.

### Coverage

10. As the dev keeper, I want every synced table checked once for reaching a second device, so that a broken stream or upload mapping is caught without a check per area.
11. As the dev keeper, I want a lean step where a demoted device's local write is refused and then restored from the server, so that permission enforcement on uploads is proven end to end.
12. As the dev keeper, I want area flows that use a mechanism of their own (a multi-row transaction, a service-written side effect, a stream's own permission rule, a server-only refusal) kept in a lean check, so that what only the server can prove stays proven.
13. As the dev keeper, I want plain row-sync steps dropped from area checks once the matrix covers their table, so that the lean set doesn't repeat itself.
14. As the dev keeper, I want admin screens tested from loader data, so that they're covered without a staff session in a browser.
15. As the dev keeper, I want admin's staff-only access, the audit log written by real actions and the announcement reaching `/app` kept end to end, so that the server rules stay proven.
16. As the dev keeper, I want each area's screens covered in component tests at the widths and themes the old checks used (420 and 1280, light and dark) where layout was the point, so that layout regressions are still caught.

### The harness

17. As a loop agent, I want the lean checks written as Playwright Test specs, so that waits, locators and traces are standard.
18. As an orchestrator, I want `pnpm prd browser` to stay the only way to run them, with the same leases, silence, cap and suite limits, one retry, FLAKY log and check build, so that nothing about running checks changes.
19. As the dev keeper, I want the CDP harness deleted once nothing uses it, so that there's one way to write a browser check.
20. As the dev keeper, I want `marketing-screenshots` kept working as a script that nothing runs, so that B-40 can use it later.

## Implementation Decisions

### The lean rule

- **A flow stays end to end only if it exercises a server or sync path no lean step already covers.** Examples: a multi-row transaction uploading as one, a service-written side effect (change entries, audit rows), a stream's own permission rule (a demotion losing fields), a server-only refusal, email, sign-in and the session. "A row reaches a second device" is the sync matrix's job, never an area step.
- **Folds go to the lean check that owns the pattern:** `roundtrip` (devices converging, offline then reconnect, refused uploads, the sync matrix), `app-shell` (roles, demotion, members across devices), `session-end` (a device signed out elsewhere), `invites` (join codes, emails), `layout-offline` (preferences following the account), `first-sync` (what a new device receives). A fold that needs a new lean check is a question for the user, not a loop's decision.
- **After a move,** the area check is deleted, along with its manifest line and `check-areas` rules. Its screens' files map to none (component tests), or to the lean check a fold went into.

### The budget

- The manifest (`scripts/loops/checks`) gains a `lean-ceiling <seconds>` line (356 at first). `checks.test.mjs` sums the usual seconds of the `e2e yes` checks and fails above the ceiling.
- A slice that changes a lean check updates its usual seconds from its run's log and, if the total dropped, lowers the ceiling to the new total. Nothing raises it without the user.
- Slice 18 brings it to ≤ 300. From then on the test also fails if the ceiling itself exceeds 300.

### The test device

- **Settling (B-131):** a helper on `renderWithDevice`'s result that waits until the device's pending live queries have rerun and the DOM has stopped changing for one frame, used after every stored write, `sync()` and `unsync()`. Existing tests that read the screen right after a write switch to it.
- **Parallelism:** `web:components` gets a worker count inside `pnpm check` that passes under the check lease's load (measured in slice 1, recorded in the components doc). The `browser` lease stays.
- **Loader data (slice 7):** `renderWithDevice` accepts `loaderData` (and an action result) for a route with a server `loader`, so web-only screens render from fixtures. Server loaders' queries are covered by integration tests through the services.
- **No new fixtures system:** moves add `fx` builders where an area lacks one (admin rows, audit entries), with fictional defaults.

### The sync matrix and refused uploads (slice 2)

- One `roundtrip` step that is table-driven from the device schema's synced tables. For each uploadable table, device A writes a row and device B sees it. For server-written tables, a seeded or service-made row is on both devices. The step fails naming the table. A new synced table adds one row to its table, enforced by a unit test that compares it with the device schema.
- One refused-upload flow: an owner lowers a member to viewer on the server, and the member's device, still holding writer state, writes locally. The upload is refused (4xx acknowledged, not retried forever), and the next sync restores the server's copy.

### Moves (one slice per check, medications in two)

- Each move writes `*.browser.test.tsx` beside the screens. It deletes each covered step and maps every deleted step to a component, unit or integration test, or to kept (folded, with where) or dropped (with why) in its hand-off.
- Unit and integration tests take steps that assert pure logic or server rules.
- The moves that touch screens `assistant` is changing wait for those assistant waves to land in `dev`: roundtrip's sheets after its slices 1 and 5, upcoming after 4, providers, groups and profiles-contacts after 4–6, and medications' doses and passes after 7.
- `B-113` (recheck `admin`, `app-shell` and `providers`) closes with the admin and providers moves.

### Playwright Test (slices 19–23, B-129)

- **New dev dependency, approved by the user (2026-11-19):** `@playwright/test` 1.65.1, pinned exactly to match `playwright`.
- Lean checks become specs under `scripts/browser-checks/`, one per manifest line, same names. `browser.sh` runs one spec per check through Playwright Test's CLI with one worker, and keeps the `browser` lease, the three limits (silence, cap, suite cap), the contention retry and FLAKY log, trimmed output, smoke mode (a tag or grep for core steps), load reporting and the check build.
- A shared fixture module replaces `cdp.mjs` and `proxy.mjs`: pages with their own `x-forwarded-for`, sign-in helpers, two-device contexts, offline through the browser context, the PowerSync teardown warning filter, and `PG_CONTAINER` for `psql`.
- When every lean check is ported, the CDP harness and its tests are deleted. `marketing-screenshots` becomes a Playwright script outside the manifest.

## Testing Decisions

- **Good tests check behaviour a user or a caller sees:** what's on the screen, what's in the database or the upload queue, and what the server returns. Never component internals. Times are fixed in America/Los_Angeles, as in the seeds.
- **Component tests** (prior art: `timelineFilters`, `entry`, `groupSettings` and `frame` browser tests, and the timeline's shared `timelineWorld`) on the test device, with `api` handlers for oRPC and `sync()` for another device's change.
- **Unit tests:** `checks.test.mjs` (the ceiling, the sync matrix's table list compared with the device schema), the harness's limits (`browser.test.mjs`), the settle helper (`device.browser.test.tsx`).
- **Integration tests** for admin's loader queries and any server rule a deleted step asserted.
- **End to end:** only the lean set, run once per landing (docs/loops.md). Each move runs its shrunk or folded checks once before hand-off.

## Out of Scope

- New product behaviour. A move that finds a bug files it (`pnpm backlog add`) rather than fixing it, unless the fix is a one-line test seam.
- Visual regression or screenshot diffs.
- Running checks in CI. They stay local, under leases.
- Changing the component test stack (Vitest browser mode stays).

## Further Notes

- The PRD can run beside feature PRDs. Its edits are test files, `scripts/browser-checks/`, `scripts/loops/` (the manifest, `check-areas`, `browser.sh`) and the test device. Its hot files are the manifest and `check-areas`, so edits stay additive.
- The waves are three wide to leave Docker room for the two running PRDs.
