<!-- The whole handbook: `risa doc loop`. -->

- Work only inside your worktree. Run `source ~/.nvm/nvm.sh && nvm use` in every shell (Node 24).
- Your stack is your own: `pnpm datastore:reset`, `pnpm test`, `docker compose …` and `pnpm dev` use your ports. Never touch the main checkout, other worktrees or other Compose projects.
- Serve with `risa serve` (`WEB_PORT` pins the port; `--restart` after merges). After editing `powersync/sync-config.yaml`: `docker compose restart powersync`.
- Keep shared-file edits small. Don't edit AGENTS.md or `docs/` (the orchestrator folds at landing), and change the backlog only through `risa backlog note`.
- **Commit on your branch**, then check (`risa check` refuses a dirty tree; fix in more commits): Conventional Commits scoped to the topic, with the attribution line. Don't merge, rebase or push any other branch (but a fix's merge, above); never set `CARETOOK_ALLOW_PROTECTED`. Delete scratch scripts first.

## Your worktree and stack

- A slice gets a stack only for `Stack: yes`. Stackless, a check still runs everything: integration tests use your own database, `caretook_test_<name>`, on the shared test Postgres (:5436, `risa test-db`), created on first use. **Never run `pnpm datastore:*:test` stackless**: with no root `.env` it hits the main checkout's test project. `risa stack up` adds a stack, `stack down` removes it; tell your orchestrator.
- **Slots and ports.** A stack leases the lowest free slot (1–19): slot N in 1–9 has web 6N73, Postgres 6N34, test Postgres 6N35, PowerSync 6N80 (10–19: 7(N−10) for 6N); Compose projects `caretook-loopN`.
- **Env files** (gitignored, by `new.sh`): the root `.env`, `packages/data/.env` and `.env.test.local`, `apps/web/.env`, and `.env.loop` (`SLOT`, `BASE_BRANCH`, `BASE`, `CDP_PORT_OFFSET`, `PG_CONTAINER`, `SEED_USER_PASSWORD`).
- Every port, Compose name and the PowerSync audience come from env; a new service, port or container name is configurable the same way, never fixed.

## Tests

- **Vitest 5 projects** (root `vitest.config.ts`): `data:unit` (`*.test.ts`, no database); `project:unit`, `core:unit` (sync matrix, check-areas, deploy, build; check-times, CI); `tooling:unit` and `project:tooling` (loops, backlog; hooks; 20 s; `pnpm test:tooling`); unit projects: `CARETOOK_UNIT_WORKERS` (cores/2, max 4); `tooling:browser` (`pnpm test:browser-harness`; `test:tooling` adds it only for a change to its paths); `integration` (every `*.int.test.ts` on the test Postgres; migrated once per run, other hosts or ports refused, a database copy per worker ([data-layer](../domain/data-layer.md)); fixtures: `packages/data/test/fixtures.ts`); `web:unit` (apps/web's pure `app/**/*.test.ts`; relative imports, not `~/`); `web:components` (`*.browser.test.tsx` in headless Chromium on the test device, under a `browser` lease: [components](../domain/components.md#component-tests)).
- **Screens get component tests; cross-cutting flows get end-to-end checks.** What one device decides alone (layout, menus, filters, sheets, role rules, focus, keyboard, widths, themes, local writes and the live queries they update) is a component test beside the screen. What needs the real server, sync or a production build is a Playwright check: sign-in and the session, first sync, the sign-out wipe, two devices converging, offline then reconnect, refused uploads, invites and email, the CSP and the check build.
- A browser step that asserts pure logic or one device's screen goes once a unit or component test covers it.
- **Tests don't race the machine:** wait on state, not a sleep; fake clocks take few steps (`RISA_CLOCK_FILE`); fake pids are 99_999_999; a polled fake file is renamed in; a slow integration file shares a world per describe.
- **Only your own tests.** While building: the test files you add or edit, plus `risa browser <check>` only for a spec you add or edit. **Before hand-off:** `risa check --quick "slice hand-off"` (static, every unit test, your own integration and component files). Never `--changed` or `--suite`. Never rerun a passed check or run two at once.

## Browser checks

`scripts/browser-checks/`: one Playwright Test spec per check (`<check>.spec.mjs`; `checks.test.mjs` wants one per manifest line). `marketing-screenshots.mjs` is outside the manifest, run by hand against `risa serve --built` (B-40). The flows each owns:

- `sign-in` (one sign-in on a double click); `first-sync` (a sheet URL as a full page, a slow first sync, a new group syncing in); `session-end` (another device signing this one out; recent searches and the search index gone); `layout-offline` (an offline layout change reaching the server, another browser's layout winning, sheets offline, and a real reload offline served by the service worker).
- `roundtrip` (sheet entries converging across two devices, offline then reconnect, the viewer, reschedule, a series and its split, the sync matrix, removal, refused uploads, a connector write via `/mcp` with its tag); `phase2` (the timeline by sync, a server-linked provider, offline filtering); `live-notes` (documents across devices: typing, concurrent edits, offline, shared links).
- `app-shell` (theme before first paint, sign-out, rename and members across devices, the details stream, `/admin`'s 404s and an audited banner); `invites` (account emails, email and link invites, join requests, access codes, through `/dev/mail.json`); `ui` (production CSS and the CSP: menu and sheet surfaces on a check build); `marketing` (the public site and headers).

- **Run them only through `risa browser <check> [args…]`** (`browser.sh`). It holds the machine-wide `browser` lease and logs to the git dir.
- **`--changed`** runs what the diff needs; `--base REF` (default `BASE_BRANCH`, else `origin/dev`), `--head REF`, `--list`. **`--suite`** is the lean set. `--timeout <s>`; `--smoke` (`@smoke` tests only); `--verbose`; `--dev` (the dev server).
- **It runs on a check build:** a production build with `VITE_CHECK_BUILD=1` (keeps `window.caretookSync` and `window.caretookModules`; CI greps both out of production), started, swapped in for a dev server, and rebuilt when the app, `public/`, `.env`, a `package.json` or the lockfile is newer. `NODE_ENV=production` turns Better Auth's rate limits on (about 3 sign-ins per 10 s per client IP); each fixture device has its own `x-forwarded-for`.
- **Limits, each a TIMEOUT:** silence (`RISA_BROWSER_SILENCE`, 90 s); the cap (`--timeout`, else the manifest's, else 600 s); and for `--suite`/`--changed` the suite cap (`RISA_BROWSER_SUITE_CAP`), past which the rest are `NOT-RUN`.
- **One automatic retry** when a failure looks like contention (load over 40, a timeout, a 401 or PSYNC_S2101), after waiting up to 5 minutes for the load to drop. A pass on the retry is **FLAKY** (passing, logged in `.loops/.browser-flakes.log`); a FLAKY lean-set step is a bug to file. Anything else is real: no rerun by hand.
- **Output is trimmed** to the ▶ and ■ lines, failures, FLAKY lines and the table; the ■ line names the full log.

### Which checks a file needs

`scripts/project/check-areas.d/` maps files to checks (one file per area, plus `_global`); `check-areas.mjs` resolves them (`node scripts/project/check-areas.mjs resolve <file>…`).

- A line is a bash-style glob (`*` also matches `/`), then checks as words, or `-` (none), `@suite` (the lean set) or `@self` (the check file itself; `- (deleted)` when deleted). `#` comments. Neither the file a rule sits in nor its order matters: put it in the area that owns the path.
- **The most specific rule wins** across all files: the longest literal prefix before the first wildcard, then fewer wildcards, then the longer glob; a remaining tie is an error.
- **Directory defaults:** a path ending in `/`, no wildcards (`apps/web/app/lib/todos/  -`), answers for any file under it that no rule matches; it ranks below every rule and the unit-tested fallback, and the deepest default wins. `lib/core/` has none on purpose, so a new shared module needs a rule.
- **Built-ins:** every `*.test.ts`, `*.test.tsx` and `*.test.mjs` needs none; after the rules, a lib module with a sibling `.test.ts` needs none (`- (unit-tested)`) unless it's a `*.sync.ts` or under `lib/sync/`. Anything unmapped runs `sign-in`, `phase2` and `roundtrip` with a warning.
- **Usual shapes:** an area's directories have defaults; its device queries share `apps/web/app/lib/<area>/*.sync.ts <checks>`; screens with component tests map to none or to the flows they reach; docs, plans, tests and tooling to none; build config, dependencies, sync rules and migrations to the lean set; `routes.ts` parts have rules in `check-areas.d/app-shell`.
- **The lint** (`check-areas.mjs lint`, in `pnpm check`) fails when a tracked file maps to nothing, a rule or default matches nothing, a glob is in two files, or a tie remains. **A slice that adds, moves or deletes a screen, check or shared module changes the rules in the same commit.**

### The manifest and the lean set

- `scripts/project/checks` lists every check in suite order: cap, never-exits, and `e2e yes` (in the lean set, which is `--suite`). `checks.test.mjs` keeps it and `check-areas.d/` in step, so a new check adds a line to both.
- **The sync matrix** (`roundtrip` 6b, `sync-matrix.mjs`): a row per device-schema table, each uploadable one by its app writer (`sync-writers.mjs`; a link table names its parent's) with uploads held, every streamed column compared on the other device (server-set ones named); `sync-matrix.test.mjs` fails on a table with no row or writer.
- **Moving a check's screen steps to component tests:** write them, delete each covered step; `e2e yes` if a flow is left, else delete the check and its `check-areas.d/` rules.

### Writing a check

- **Specs:** import `test` and `expect` from `fixtures.mjs`, never `@playwright/test`. `device(label, opts)`: a context with its own `x-forwarded-for` (420×900, America/Los_Angeles; twice for two devices). `d.errors` fails on console errors and CSP violations; helpers: `signIn`, `signOut`, `openDevFamily`, `psql`, `DEV_FAMILY`, `waitFor` (awaits), `localCopyHolds`, `assetsSettled`. One worker, no retries; only `Timeout Nms` counts as contention. Tag the core path `@smoke`. Extra args to `risa browser` are file filters, no `-g`.
- **Offline:** `device(label, { offlineable: true })` and `d.offline(on)`, through the device's own proxy (`context.setOffline` alone leaves PowerSync connected; add it when the page reads `navigator.onLine`); `d.proxy.hold(port)` and `release()` hold one port's requests. On a check build, `await assetsSettled(page)` before going offline: prefetching route chunks cut mid-fetch reloads into chrome-error.
- **Order-independent:** tag what the run makes, assert on your own entries (never global state or seed order), soft-delete what you made, restore seeds in `beforeAll`/`afterAll`. **member@ has two groups:** `signIn` goes on to Dev Family (`{ home: true }` stays put); use caretaker@ or viewer@ for a one-group user.
- **Waits:** wait on the thing, never a fixed sleep; locators are strict (`.first()` when several match). `locator.click()` waits for the navigation it starts: for a click meant to land offline, `evaluate((el) => el.click())`. A tap on a closing menu can be swallowed: retry once (`live-notes`). Auth queues mail after responding, so "no mail" or "one email" needs a quiet window (`invites`' `mailSettled`), never "the outbox is empty now".
- The fixtures ignore PowerSync's `Sync aborted` warning (a closed page's teardown).

## Gotchas

- Failed only on time (exit 125): report it, don't trim others' tests.
- The first check after a PowerSync restart can fail on a slow first sync: rerun once.
- On the dev server (`--dev`), a first visit can re-optimize deps and reload mid-check, and a long-running server can serve stale deps ("Invalid hook call"): rerun once on a fresh server.
- After a merge or sync that changes seeds or migrations, `pnpm datastore:reset`. Two branches' migrations conflict in drizzle's `meta/`: keep the target's, regenerate yours (`pnpm datastore:generate`), recheck its SQL order.
- Docker runs out of networks at about 21 ("all predefined address pools have been fully subnetted"), and several `new.sh` at once can fail at migrate: rerun `pnpm datastore:start` in the worktree once there's room. Never prune other projects' networks.
- **The dev server on another port:** Better Auth trusts only `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS`, so set both to its URL (`… pnpm --filter @caretook/web dev --port 5176 --strictPort`), and `PS_JWKS_URL` to match.
- Type-aware lint needs React Router's generated route types, so `pnpm lint` runs `pnpm typegen` first (`pnpm build:native` overwrites the web ones). A bare `pnpm exec eslint <files>` doesn't: if it reports `no-unsafe-*` in route files, run `pnpm typegen`.
- `/app` has its own `ErrorBoundary` (keeps the frame). Route discovery is `initial` (`react-router.config.ts`): lazy discovery asks the server for `/__manifest` first and fails offline.
