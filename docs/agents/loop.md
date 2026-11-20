# Loop handbook

For a slice agent (a loop): one background agent working one slice of a PRD in `.loops/<topic>-<n>`, on `slice/<topic>/<n>`, run by the PRD's [orchestrator](orchestrator.md). The [rules across PRDs](orchestrator.md#rules-across-prds) (migrations, seeds, registries, hot files) bind you too.

## Loop rules

- Work only inside your worktree. Run `source ~/.nvm/nvm.sh && nvm use` in every shell (Node 24; browser checks need its global `WebSocket`).
- Read the docs your slice's `Reads` field names. A missing field means no stack and nothing extra to read ([fields](planner.md#slice-fields)).
- Your stack is your own: `pnpm datastore:reset`, `pnpm test`, `docker compose …` and `pnpm dev` use your ports. Never touch the main checkout, other worktrees or other Compose projects.
- Run the dev server with `pnpm prd serve` (background; `WEB_PORT` pins the port; `--restart` after merges). After editing `powersync/sync-config.yaml`, `docker compose restart powersync`.
- Edits to shared files stay small and are listed in the hand-off. Don't edit AGENTS.md or `docs/` (the orchestrator folds at landing), and change the backlog only through `pnpm backlog note`.
- No new dependencies. All data stays fictional.
- When `pnpm check` and the slice's browser checks pass, **commit on your branch**: coherent Conventional Commits scoped to the topic, ending with the attribution line. Don't merge, rebase or push any other branch; never set `CARETOOK_ALLOW_PROTECTED`. Delete scratch scripts first.

## Hand-off

Your final message:

- what was built, grouped by area, with every shared-file edit called out;
- each acceptance criterion, met or not, with evidence;
- the `pnpm check` output, and `pnpm prd browser --changed`'s ■ lines and table;
- anything skipped or surprising that later slices need;
- the commit SHAs.

## Your worktree and stack

- A slice gets a stack only for `Stack: yes`. Stackless, `pnpm check` still runs everything: integration tests use your own database, `caretook_test_<name>`, on the shared test Postgres (:5436, `pnpm prd test-db`), created on first use. **Never run `pnpm datastore:*:test` stackless**: with no root `.env` it hits the main checkout's test project. `pnpm prd stack up` adds a stack and `stack down` removes it (containers, data, env files, slot); tell your orchestrator.
- **Slots and ports.** A stack leases the lowest free slot (1–19). Slot N in 1–9: web 6N73, Postgres 6N34, test Postgres 6N35, PowerSync 6N80; slots 10–19 use 7(N−10) for 6N. CDP and proxy ports shift by N×1000. Compose projects are `caretook-loopN`. The main checkout keeps 5173, 5434, 5435, 8080.
- **Env files** (gitignored, written by `new.sh`): the root `.env` (Compose project and ports), `packages/data/.env` and `.env.test.local`, `apps/web/.env` (`WEB_PORT`, auth and PowerSync URLs), and `.env.loop` (`SLOT`, `BASE_BRANCH`, `BASE`, `CDP_PORT_OFFSET`, `PG_CONTAINER`, `SEED_USER_PASSWORD`).
- Every port, Compose name and the PowerSync audience come from env. A new service, port or container name is configurable the same way; never a fixed name or port.

## Tests

- **Vitest 5 projects** (root `vitest.config.ts`): `data:unit` (`*.test.ts`, no database); `scripts:unit` (the tooling, 20 s timeout: they spawn git and shells); `integration` (every `*.int.test.ts` on the test Postgres; its globalSetup clears and migrates once per run, refuses any other host or port, and runs files one at a time; tests build their own fixtures, `packages/data/test/fixtures.ts`); `web:unit` (apps/web's pure `app/**/*.test.ts`; no vite.config, so relative imports, not `~/`); `web:components` (`*.browser.test.tsx` in headless Chromium on the test device, under a `browser` lease: [components](../domain/components.md#component-tests)).
- **Screens get component tests; cross-cutting flows get end-to-end checks.** What one device decides alone (layout, menus, filters, sheets, role rules, focus, keyboard, widths, themes, local writes and the live queries they update) is a component test beside the screen, run by `pnpm check`. What needs the real server, sync or a production build is a CDP check: sign-in and the session, first sync, the sign-out wipe, two devices converging, offline then reconnect, refused uploads, invites and email, the CSP and the check build. A new screen gets component tests; a new check is only for a new flow.
- A browser step that asserts pure logic goes once a unit test covers it, and one that asserts one device's screen once a component test does.
- **While building:** `pnpm test:components --changed <base>`, plus `pnpm prd browser <check>` only for a flow you touch. **Before hand-off:** `pnpm check`, then `pnpm prd browser --changed` once. Never `--suite` (the orchestrator runs it at landing). Never rerun a check that passed, and never run two at once in one worktree.

## Browser checks

`scripts/browser-checks/`: Playwright Test specs (`<check>.spec.mjs`, which win over a `.mjs`) or, until B-129's slice 23, CDP scripts (`<check>.mjs`); `checks.test.mjs` wants exactly one per check. Specs so far: `sign-in`, `ui`, `marketing`. The flows each owns (their screens are component tests):

- `sign-in` (one sign-in on a double click); `first-sync` (a sheet URL as a full page, a slow first sync's state, a new group syncing in); `signout-wipe` (recent searches and the search index gone at sign-out); `session-end` (another device signing this one out); `layout-offline` (an offline layout change reaching the server, another browser's layout winning, sheets offline).
- `roundtrip` (sheet entries converging across two devices, offline then reconnect, the viewer, reschedule, the sync matrix, refused uploads, a connector write via `/mcp` with its tag); `phase2` (the timeline by sync, a server-linked provider, offline filtering); `live-notes` (documents across devices: typing, concurrent edits, offline, shared links).
- `app-shell` (theme before first paint, sign-out, rename and members across devices, the details stream, `/admin`'s 404s and an audited banner); `invites` (account emails, email and link invites, join requests, access codes, through `/dev/mail.json`); `ui` (the primitives on a check build under the CSP); `marketing` (the public site and headers).

- **Run them only through `pnpm prd browser <check> [args…]`** (`browser.sh`), never `node <check>.mjs`. It holds a machine-wide `browser` lease (four at once; waits up to `CARETOOK_BROWSER_WAIT`), uses `.nvmrc`'s Node and the worktree's `.env.loop`, prints the load at start and end, and logs to the worktree's git dir. Run long ones under `caffeinate -i`.
- **`--changed`** runs what the diff needs (committed since the base, staged, unstaged, untracked), in manifest order, with a table; `--base REF` (default `BASE_BRANCH`, else `origin/dev`), `--head REF`, `--list` (show only). **`--suite`** is the lean set. `--timeout <s>`; `--smoke` (core paths only: `step(name, { smoke: true }, fn)`, or a spec test tagged `@smoke`; others print `SKIP`; hand-offs use full mode); `--verbose`; `--dev` (against the dev server).
- **It runs on a check build:** a production build with `VITE_CHECK_BUILD=1` (keeps `window.caretookSync` and `window.caretookModules`), started, swapped in for a dev server, and rebuilt when the app, `public/`, `.env`, a `package.json` or the lockfile is newer. `pnpm prd serve --built` serves one by hand. `NODE_ENV=production`, so Better Auth's rate limits are on (about 3 sign-ins per 10 s per client IP); `cdp.mjs` gives each page its own `x-forwarded-for`, so only repeated sign-ins on one page need spacing.
- **Limits, each a TIMEOUT:** silence (`CARETOOK_BROWSER_SILENCE`, 90 s); the cap (`--timeout`, else the manifest's, else 600 s); and for `--suite`/`--changed` the suite cap (`CARETOOK_BROWSER_SUITE_CAP`), past which the rest are `NOT-RUN`.
- **One automatic retry** when a failure looks like contention (load over 40, a timeout, a 401 or PSYNC_S2101), after waiting up to 5 minutes for the load to drop. A pass on the retry is **FLAKY** (passing, logged in `.loops/.browser-flakes.log`); a FLAKY lean-set step is a bug to file. Anything else is a real failure: debug it, and don't rerun by hand on top.
- **Output is trimmed** to the ▶ and ■ lines, failures with their diagnostics, FLAKY lines and the table; the full log is named on the ■ line.

### Which checks a file needs

`scripts/loops/check-areas.d/` maps files to checks (one file per area, plus `_global`); `check-areas.mjs` resolves them (`node scripts/loops/check-areas.mjs resolve <file>…`).

- A line is a bash-style glob (`*` also matches `/`), then checks as words, or `-` (none), `@suite` (the lean set) or `@self` (the check file itself; `- (deleted)` when deleted). `#` comments. The file a rule sits in, and its order, never matter: put it in the area that owns the path.
- **The most specific rule wins** across all files: the longest literal prefix before the first wildcard, then fewer wildcards, then the longer glob; a remaining tie is an error.
- **Built-ins:** every `*.test.ts`, `*.test.tsx` and `*.test.mjs` needs none; after the rules, a lib module with a sibling `.test.ts` needs none (`- (unit-tested)`) unless it's a `*.sync.ts` or under `lib/sync/`. Anything unmapped runs `sign-in`, `phase2` and `roundtrip` with a warning.
- **Usual shapes:** an area's device queries share `apps/web/app/lib/<area>/*.sync.ts <checks>`; screens with component tests map to none or to the flows they reach; docs, plans, tests and tooling to none; build config, dependencies, sync rules and migrations to the lean set. Each `routes.ts` part has its rule in `check-areas.d/app-shell`.
- **The lint** (`check-areas.mjs lint`, in `pnpm check`) fails when a tracked file maps to nothing, a rule matches nothing, a glob is in two files, or a tie remains. **A slice that adds, moves or deletes a screen, check or shared module changes the rules in the same commit.**

### The manifest and the lean set

- `scripts/loops/checks` lists every check in suite order: usual seconds, cap, never-exits, and `e2e yes` (in the lean set, which is `--suite`). `checks.test.mjs` keeps it and `check-areas.d/` in step, so a new check adds a line to both.
- **The ceiling:** the manifest's `lean-ceiling` caps the sum of the lean set's usual seconds (`checks.test.mjs` fails above it), and may never exceed 300 s (`LEAN_LIMIT`). Usual seconds are the median of recent suite runs, never one run under load. A slice that changes a lean check updates its seconds and lowers the ceiling if the total dropped; only the user raises it.
- **The sync matrix** (`roundtrip` 6b, `sync-matrix.mjs`): a row per device-schema table, written on one device and seen on the other; `sync-matrix.test.mjs` fails when a synced table has none, so a new synced table adds one. Area checks don't assert "a second device sees X".
- **Moving a check's screen steps to component tests:** write the tests, delete each covered step (the hand-off maps step → test), keep only the flows; set it `e2e yes` if a flow is left, else delete it and its `check-areas.d/` rules.

### Writing a check

- **Specs:** import `test` and `expect` from `fixtures.mjs`, never `@playwright/test`. `device(label, opts)` is a context with its own `x-forwarded-for` (420×900, America/Los_Angeles; call twice for two devices); `{ offlineable: true }` routes it through its own proxy, and `d.offline(on)` switches it (`context.setOffline` alone leaves PowerSync connected); `d.errors` fails on console errors and CSP violations; `signIn`, `psql`, `waitFor` (awaits, B-172). One worker, no retries, traces of failures in the git dir; `reporter.mjs` prints the lines `browser.sh` reads; only `Timeout Nms` counts as contention. Map each old step to a test or `test.step`.
- **CDP harness (unported checks):** `cdp.mjs` (`tap()` for real mouse taps; every DevTools command fails after 120 s, `CDP_TIMEOUT_MS`; uncaught errors, rejections, `console.error` and failed loads collect in `page.uncaught`; `waitFor` awaits its expression, and its timeout prints `page.diagnose()`, unless `{ quiet: true }`). `proxy.mjs` for offline (CDP network emulation doesn't cut PowerSync's stream; it tunnels CONNECT and keeps Vite's sockets). Launch Chrome and proxies through them; `psql` on `process.env.PG_CONTAINER`.
- **Order-independent:** tag what the run makes, assert on your own entries (never global state or seed order), move only your own documents' edit times, soft-delete what you made, and exit non-zero on failure. No reset is needed between runs.
- Sign out with `page.signOut()`. `page.signIn` retries once on a 401 from `/api/auth/token`. **member@ has two groups:** `signIn` goes on to Dev Family's timeline (`page.openDevFamily()`; `{ home: true }` stays put); use caretaker@ or viewer@ for a one-group user. psql picks seeded rows by Dev Family's id (`0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001`).
- `layout-offline` and `signout-wipe` don't exit after their result line; `pnpm prd browser` stops them 2 s after it and takes the verdict from `N/M passed` (`ended` for signout-wipe: read its output). Don't wrap them in `timeout`.
- **Patterns:** a 420×900 window; the `@example.com` seeds with `SEED_USER_PASSWORD`; React Aria buttons and menu items need a `pointerdown` before `.click()`; set inputs through the native value setter, then dispatch `input`; collect console errors. The clipboard needs `Emulation.setFocusEmulationEnabled`; pin America/Los_Angeles for layout checks.
- A tab behind another gets no animation frames: `Page.bringToFront` before tapping. After Escape or a close, wait for the closed state and focus together (`ui.mjs`'s `settlesOn`), never a fixed sleep.
- PowerSync's `[PowerSync]: Sync aborted` is a closed page's sync-worker teardown; the checks ignore exactly that warning.

## Gotchas

- The first check after a PowerSync restart can fail on a slow first sync: rerun once before debugging (`pnpm datastore:reset` waits for PowerSync itself).
- On the dev server (`--dev`), a first visit can re-optimize deps and reload mid-check, and a long-running server can serve stale deps after merges ("Invalid hook call"): rerun once, against a fresh server.
- After a merge or sync that changes seeds or migrations, `pnpm datastore:reset`. Two branches' migrations conflict in drizzle's `meta/`: keep the target's, regenerate yours (`pnpm datastore:generate`), recheck its SQL order.
- Docker runs out of networks at about 21 ("all predefined address pools have been fully subnetted"), and several `new.sh` at once can fail at migrate ("Connection terminated unexpectedly"): once there's room, rerun `pnpm datastore:start` in the worktree. Never prune other projects' networks.
- **The dev server on another port:** Better Auth trusts only `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS`, so set both to its URL (`… pnpm --filter @caretook/web dev --port 5176 --strictPort`), and `PS_JWKS_URL` to match.
- After `pnpm build:native`, lint can report `no-unsafe-argument` in `routes/rpc.ts` and `routes/api/auth.ts` (the native typegen overwrote the web route types): run `pnpm typecheck`.
- `/app` has its own `ErrorBoundary` (keeps the frame, avoids the root boundary's "script tag" warning). Route discovery is `initial` (`react-router.config.ts`): lazy discovery asks the server for `/__manifest` first and fails offline.
