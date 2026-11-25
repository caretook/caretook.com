- Work only inside your worktree. Run `source ~/.nvm/nvm.sh && nvm use` in every shell (Node 24).
- Your stack is your own: `pnpm datastore:reset`, `pnpm test`, `docker compose …` and `pnpm dev` use your ports. Never touch the main checkout, other worktrees or other Compose projects.
- Serve with `pnpm prd serve` (`WEB_PORT` pins the port; `--restart` after merges). After editing `powersync/sync-config.yaml`, `docker compose restart powersync`.
- Keep shared-file edits small. Don't edit AGENTS.md or `docs/` (the orchestrator folds at landing), and change the backlog only through `pnpm backlog note`.
- **Commit on your branch**, then check (`pnpm prd check` refuses a dirty tree; fix in more commits): Conventional Commits scoped to the topic, with the attribution line. Don't merge, rebase or push any other branch (but a fix's merge, above); never set `CARETOOK_ALLOW_PROTECTED`. Delete scratch scripts first.

## Your worktree and stack

- A slice gets a stack only for `Stack: yes`. Stackless, a check still runs everything: integration tests use your own database, `caretook_test_<name>`, on the shared test Postgres (:5436, `pnpm prd test-db`), created on first use. **Never run `pnpm datastore:*:test` stackless**: with no root `.env` it hits the main checkout's test project. `pnpm prd stack up` adds a stack, `stack down` removes it; tell your orchestrator.
- **Slots and ports.** A stack leases the lowest free slot (1–19): slot N in 1–9 has web 6N73, Postgres 6N34, test Postgres 6N35, PowerSync 6N80 (10–19: 7(N−10) for 6N); Compose projects `caretook-loopN`.
- **Env files** (gitignored, by `new.sh`): the root `.env`, `packages/data/.env` and `.env.test.local`, `apps/web/.env`, and `.env.loop` (`SLOT`, `BASE_BRANCH`, `BASE`, `CDP_PORT_OFFSET`, `PG_CONTAINER`, `SEED_USER_PASSWORD`).
- Every port, Compose name and the PowerSync audience come from env. A new service, port or container name is configurable the same way; never a fixed name or port.

## Tests

- **Vitest 5 projects** (root `vitest.config.ts`): `data:unit` (`*.test.ts`, no database); `project:unit`, `core:unit` (sync matrix, check-areas, deploy, build; check-times, CI); `tooling:unit` and `project:tooling` (loops, backlog; hooks; 20 s; `pnpm test:tooling`); `tooling:browser` (browser harness: `pnpm test:browser-harness`; `test:tooling` adds it only for a change to its paths); `integration` (every `*.int.test.ts` on the test Postgres; its globalSetup migrates once per run, refuses other hosts or ports, copies the database per worker ([data-layer](../domain/data-layer.md)); tests build their own fixtures, `packages/data/test/fixtures.ts`); `web:unit` (apps/web's pure `app/**/*.test.ts`; no vite.config, so relative imports, not `~/`); `web:components` (`*.browser.test.tsx` in headless Chromium on the test device, under a `browser` lease: [components](../domain/components.md#component-tests)).
- **Screens get component tests; cross-cutting flows get end-to-end checks.** What one device decides alone (layout, menus, filters, sheets, role rules, focus, keyboard, widths, themes, local writes and the live queries they update) is a component test beside the screen. What needs the real server, sync or a production build is a Playwright check: sign-in and the session, first sync, the sign-out wipe, two devices converging, offline then reconnect, refused uploads, invites and email, the CSP and the check build.
- A browser step that asserts pure logic goes once a unit test covers it, and one that asserts one device's screen once a component test does.
- **Tests don't race the machine:** wait on state, not a sleep; fake clocks take few steps (`CARETOOK_CLOCK_FILE`); fake pids are 99_999_999; a polled fake file is renamed in; a slow integration file shares a world per describe, cleaned per test.
- **Only your own tests.** While building: the test files you add or edit, plus `pnpm prd browser <check>` only for a spec you add or edit. **Before hand-off:** `pnpm prd check --quick "slice hand-off"` (the slice check: static, every unit test, your own integration and component files; never full). Never `--changed` or `--suite`. Never rerun a passed check or run two at once.

## Browser checks

`scripts/browser-checks/`: one Playwright Test spec per check (`<check>.spec.mjs`; `checks.test.mjs` wants one per manifest line). `marketing-screenshots.mjs` is outside the manifest, run by hand (`BASE`, `PG_CONTAINER`) against `pnpm prd serve --built` (B-40). The flows each owns (their screens are component tests):

- `sign-in` (one sign-in on a double click); `first-sync` (a sheet URL as a full page, a slow first sync's state, a new group syncing in); `session-end` (another device signing this one out; recent searches and the search index gone); `layout-offline` (an offline layout change reaching the server, another browser's layout winning, sheets offline, and a real reload offline served by the service worker).
- `roundtrip` (sheet entries converging across two devices, offline then reconnect, the viewer, reschedule, a series and its split, the sync matrix, removal, refused uploads, a connector write via `/mcp` with its tag); `phase2` (the timeline by sync, a server-linked provider, offline filtering); `live-notes` (documents across devices: typing, concurrent edits, offline, shared links).
- `app-shell` (theme before first paint, sign-out, rename and members across devices, the details stream, `/admin`'s 404s and an audited banner); `invites` (account emails, email and link invites, join requests, access codes, through `/dev/mail.json`); `ui` (production CSS and the CSP: menu and sheet surfaces on a check build); `marketing` (the public site and headers).

- **Run them only through `pnpm prd browser <check> [args…]`** (`browser.sh`). It holds a machine-wide `browser` lease (two at once; waits up to `CARETOOK_BROWSER_WAIT`), logs to the worktree's git dir. Run long ones under `caffeinate -i`.
- **`--changed`** runs what the diff needs; `--base REF` (default `BASE_BRANCH`, else `origin/dev`), `--head REF`, `--list` (show only). **`--suite`** is the lean set. `--timeout <s>`; `--smoke` (only tests tagged `@smoke`); `--verbose`; `--dev` (against the dev server).
- **It runs on a check build:** a production build with `VITE_CHECK_BUILD=1` (keeps `window.caretookSync` and `window.caretookModules`, the app writers; CI greps both out of production), started, swapped in for a dev server, and rebuilt when the app, `public/`, `.env`, a `package.json` or the lockfile is newer. `NODE_ENV=production`, so Better Auth's rate limits are on (about 3 sign-ins per 10 s per client IP); each fixture device has its own `x-forwarded-for`, so the limits apply per device.
- **Limits, each a TIMEOUT:** silence (`CARETOOK_BROWSER_SILENCE`, 90 s); the cap (`--timeout`, else the manifest's, else 600 s); and for `--suite`/`--changed` the suite cap (`CARETOOK_BROWSER_SUITE_CAP`), past which the rest are `NOT-RUN`.
- **One automatic retry** when a failure looks like contention (load over 40, a timeout, a 401 or PSYNC_S2101), after waiting up to 5 minutes for the load to drop. A pass on the retry is **FLAKY** (passing, logged in `.loops/.browser-flakes.log`); a FLAKY lean-set step is a bug to file. Anything else is a real failure: debug it, and don't rerun by hand on top.
- **Output is trimmed** to the ▶ and ■ lines, failures with their diagnostics, FLAKY lines and the table; the full log is named on the ■ line.

### Which checks a file needs

`scripts/loops/check-areas.d/` maps files to checks (one file per area, plus `_global`); `check-areas.mjs` resolves them (`node scripts/project/check-areas.mjs resolve <file>…`).

- A line is a bash-style glob (`*` also matches `/`), then checks as words, or `-` (none), `@suite` (the lean set) or `@self` (the check file itself; `- (deleted)` when deleted). `#` comments. The file a rule sits in, and its order, never matter: put it in the area that owns the path.
- **The most specific rule wins** across all files: the longest literal prefix before the first wildcard, then fewer wildcards, then the longer glob; a remaining tie is an error.
- **Directory defaults:** a path ending in `/`, no wildcards (`apps/web/app/lib/todos/  -`), answers for any file under it that no rule matches; it ranks below every rule and the unit-tested fallback, and the deepest default wins. `lib/core/` has none on purpose, so a new shared module needs a rule.
- **Built-ins:** every `*.test.ts`, `*.test.tsx` and `*.test.mjs` needs none; after the rules, a lib module with a sibling `.test.ts` needs none (`- (unit-tested)`) unless it's a `*.sync.ts` or under `lib/sync/`. Anything unmapped runs `sign-in`, `phase2` and `roundtrip` with a warning.
- **Usual shapes:** an area's directories have defaults; its device queries share `apps/web/app/lib/<area>/*.sync.ts <checks>`; screens with component tests map to none or to the flows they reach; docs, plans, tests and tooling to none; build config, dependencies, sync rules and migrations to the lean set. Each `routes.ts` part has its rule in `check-areas.d/app-shell`.
- **The lint** (`check-areas.mjs lint`, in `pnpm check`) fails when a tracked file maps to nothing, a rule or default matches nothing, a glob is in two files, or a tie remains. **A slice that adds, moves or deletes a screen, check or shared module changes the rules in the same commit.**

### The manifest and the lean set

- `scripts/loops/checks` lists every check in suite order: cap, never-exits, and `e2e yes` (in the lean set, which is `--suite`). `checks.test.mjs` keeps it and `check-areas.d/` in step, so a new check adds a line to both.
- **The sync matrix** (`roundtrip` 6b, `sync-matrix.mjs`): a row per device-schema table, each uploadable one by its app writer (`sync-writers.mjs`; a link table names its parent's) with uploads held, every streamed column compared on the other device (server-set ones named); `sync-matrix.test.mjs` fails on a table with no row or writer. Area checks don't assert "a second device sees X".
- **Moving a check's screen steps to component tests:** write the tests, delete each covered step, keep only the flows; set it `e2e yes` if a flow is left, else delete it and its `check-areas.d/` rules.

### Writing a check

- **Specs:** import `test` and `expect` from `fixtures.mjs`, never `@playwright/test`. `device(label, opts)`: a context with its own `x-forwarded-for` (420×900, America/Los_Angeles; twice for two devices). `d.errors` fails on console errors and CSP violations; helpers: `signIn` (retries once on a token 401), `signOut`, `openDevFamily`, `psql`, `DEV_FAMILY`, `waitFor` (awaits), `localCopyHolds`, `assetsSettled`. One worker, no retries, traces of failures in the git dir; `reporter.mjs` prints the lines `browser.sh` reads; only `Timeout Nms` counts as contention. Tag the core path `@smoke`. Extra args to `pnpm prd browser` are file filters (no `-g`).
- **Offline:** `device(label, { offlineable: true })` and `d.offline(on)`, through the device's own proxy (`context.setOffline` alone leaves PowerSync connected; add it when the page reads `navigator.onLine`); `d.proxy.hold(port)` and `release()` hold one port's requests. On a check build, `await assetsSettled(page)` before going offline: prefetching route chunks cut mid-fetch reloads into chrome-error.
- **Order-independent:** tag what the run makes, assert on your own entries (never global state or seed order), soft-delete what you made, restore seeds in `beforeAll`/`afterAll`. **member@ has two groups:** `signIn` goes on to Dev Family (`{ home: true }` stays put); use caretaker@ or viewer@ for a one-group user.
- **Waits:** wait on the thing, never a fixed sleep; locators are strict (`.first()` when several match). `locator.click()` waits for the navigation it starts: for a click meant to land offline, `evaluate((el) => el.click())`. A tap while a menu is closing can be swallowed: retry the tap once (`live-notes`). Auth queues mail after responding, so "no mail" or "one email" needs a quiet window (`invites`' `mailSettled`), never "the outbox is empty now".
- PowerSync's `[PowerSync]: Sync aborted` is a closed page's sync-worker teardown; the fixtures ignore exactly that warning.

## Gotchas

- The first check after a PowerSync restart can fail on a slow first sync: rerun once before debugging.
- On the dev server (`--dev`), a first visit can re-optimize deps and reload mid-check, and a long-running server can serve stale deps after merges ("Invalid hook call"): rerun once, against a fresh server.
- After a merge or sync that changes seeds or migrations, `pnpm datastore:reset`. Two branches' migrations conflict in drizzle's `meta/`: keep the target's, regenerate yours (`pnpm datastore:generate`), recheck its SQL order.
- Docker runs out of networks at about 21 ("all predefined address pools have been fully subnetted"), and several `new.sh` at once can fail at migrate: once there's room, rerun `pnpm datastore:start` in the worktree. Never prune other projects' networks.
- **The dev server on another port:** Better Auth trusts only `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS`, so set both to its URL (`… pnpm --filter @caretook/web dev --port 5176 --strictPort`), and `PS_JWKS_URL` to match.
- Type-aware lint needs React Router's generated route types, so `pnpm lint` runs `pnpm typegen` first (a fresh worktree has none; `pnpm build:native` overwrites the web ones). A bare `pnpm exec eslint <files>` doesn't: run `pnpm typegen` first if it reports `no-unsafe-*` in route files.
- `/app` has its own `ErrorBoundary` (keeps the frame, avoids the root boundary's "script tag" warning). Route discovery is `initial` (`react-router.config.ts`): lazy discovery asks the server for `/__manifest` first and fails offline.
