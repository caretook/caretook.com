# Plan: App speed

> **Superseded** (2026-11-20): folded into `timeline-ux`. Its slices are in [`timeline-ux-plan.md`](timeline-ux-plan.md) (1, 4, 2, 5, 6 became 1, 3, 4, 7, 10; slice 3 joined slice 6). Kept for reference only.

> Source PRD: [`plans/app-speed-prd.md`](app-speed-prd.md). User-story numbers (US) refer to it. Backlog items B-136, B-137, B-138, B-139, B-140, B-144, B-155 and B-156. Topic `app-speed`.

## Status

| Slice | Wave | State                           | Merge into `prd/app-speed` (slice commits) |
| ----- | ---- | ------------------------------- | ------------------------------------------ |
| 1     | 1    | not started                     |                                            |
| 2     | 1    | not started                     |                                            |
| 3     | 1    | not started                     |                                            |
| 4     | 1    | not started                     |                                            |
| 5     | 2    | blocked by 1, 4                 |                                            |
| 6     | 1–2  | blocked by hosting wave 1 (dev) |                                            |

**Landing:** land each wave as soon as it's green. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here.

**Backlog:** claim each slice's items when it starts, and run `done` after its merge:

- slice 1: B-136 and B-156;
- slice 2: B-137 and B-138;
- slice 3: B-139;
- slice 4: B-155;
- slice 5: B-144;
- slice 6: B-140.

**Fold into the area docs at each landing:**

- **Slice 1:** session freshness, the 3 s timeout and the background recheck go in `docs/domain/sync.md` (the `lib/session.ts` bullet). Cache-first settings and the settings store go there too (the `lib/me.ts` bullet).
- **Slice 2:** prefetched section links and the pending highlight go in `docs/domain/app-shell.md`.
- **Slice 3:** `content-visibility` on timeline rows goes in `docs/domain/timeline.md`.
- **Slice 4:** `pnpm build:budget`, the budget file and `pnpm prd check` running it go in `docs/loops.md` (_Landing a wave_) and the AGENTS.md commands table.
- **Slice 5:** the service worker goes in `docs/domain/sync.md`, replacing the "Offline web reload needs a service worker" gap and the `pageCache.ts` caveat. Also its routing, the shell, the update notice, and that it's off in dev and native. The worker goes in `docs/domain/security-headers.md`.
- **Slice 6:** lazy AuthUser and the one-query lookup go in `docs/domain/api.md`. **The cookie cache tradeoff** goes in `docs/domain/auth.md` as a prominent ⚠ section (what lags for up to 3 minutes, what bypasses it, and when to revisit it), and as an entry in `plans/security-review.md`.

## Architectural decisions

Durable decisions every slice follows:

- **The device answers first; the network catches up.** No `/app` navigation waits on the network for something the device already has: a fresh session, cached settings or a prefetched route.
- **One timeout:** 3 s (`NETWORK_ANSWER_MS`, in the session rules), for any request a navigation must wait for. No answer counts as `unknown`, never as signed out.
- **Session freshness:**
  - **fresh:** confirmed within 15 minutes. Navigate at once; start a background recheck if the last confirmation is more than a minute old.
  - **stale:** older, but within the 3-day limit. Wait for the check, under the timeout.
  - **none:** wait for the check, under the timeout.
  - The 3-day offline rule, the wipe on a definite "signed out" and the B-130 rate-limit message are unchanged.
- **The app's own session check bypasses Better Auth's cookie cache**, as do staff procedures and the sync token endpoint. Only ordinary `/rpc` procedures use it.
- **The cookie cache max age is 3 minutes.** Its tradeoff (revocation, another device's sign-out and disabling lag by up to 3 minutes for ordinary `/rpc` calls) is pinned by an integration test and written up at landing (see above).
- **The service worker is hand-written, web target only, production builds only** (check builds included; never the dev server, Vitest or native).
  - `/app/*` documents get the precached shell.
  - Precached assets come from the cache.
  - Everything else goes to the network.
  - It never takes over on its own: a waiting worker means the "A new version is ready: Reload" notice.
- **One build-manifest reader** (`scripts/build/`) is shared by the budget (slice 4) and the precache list (slice 5).
- **No new dependencies.**
- **No migrations.**
- **No seed changes.**
- **Shared files:** `lib/session.ts` and `lib/me.ts` belong to slice 1. `packages/auth` and `routes/rpc.ts` belong to slice 6, after hosting slice 3. The `/app` layout route (the frame) gets the update notice in slice 5, in its own region, added at the end. New screens, modules and checks add their rules to `scripts/loops/check-areas`.

## How to run this plan

- **Wave 1: slices 1, 2, 3 and 4 at once** (plus 6 if hosting wave 1 is already in `dev`).
  - 1 owns `lib/session.ts`, `lib/sessionRules.ts` and `lib/me.ts`. It's the only one with a stack.
  - 2 owns `routes/app/layout/SectionNav.tsx`.
  - 3 owns the timeline rows' CSS and `timelineScroll` tests.
  - 4 owns `scripts/build/` and the budget, plus a one-line change to `pnpm prd check` in `scripts/loops/prd.sh`.
  - None of their files overlap. Merge in number order.
- **Wave 2: slice 5** (it needs 1's session path for an offline boot, and 4's manifest reader). **Slice 6 too, if it didn't run in wave 1.**
  - Before starting 6, check that `dev` contains hosting slice 3 (`git log dev --oneline --grep 'hosting'`, or `pnpm backlog show B-68`). If it doesn't, hold 6 for a later wave.
- **Browser checks at landing:**
  - Wave 1 touches the session flow, so: the lean set once, `pnpm prd browser --suite`.
  - Wave 2 touches the session flow (6) and the build (5), so the lean set once again.
- `pnpm prd check` runs the budget from the landing after slice 4 merges.

---

## Slice 1: Navigation doesn't wait

Stack: yes · Reads: docs/domain/sync.md, docs/domain/auth.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component, e2e:session-end

**User stories:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 40.

**What to build:**

- **`sessionRules`** gains:
  - `sessionFreshness(lastConfirmed, now)`: `fresh` | `stale` | `none`. `FRESH_MS` is 15 minutes, and a clock moved back counts as no time passed.
  - `shouldRecheck(lastConfirmed, now)`: older than a minute.
  - `withTimeout(promise, ms, onTimeout)`: resolves `unknown` after `NETWORK_ANSWER_MS` (3 s), and ignores the late answer.
  - `askSession` runs under the timeout. The retry after a 429 stays inside the same budget.
- **`requireSession`:**
  - **fresh:** returns the cached user and their database at once, and starts a background recheck when `shouldRecheck` says so. The recheck is shared with any check in flight, as `inflight` is today.
  - **stale or none:** waits for the check, as today, under the timeout.
  - **A background answer:**
    - ok: confirms.
    - signed out: `wipeDevice()`, then a full navigation to sign-in.
    - unverified: goes to verify-email.
    - rate limited or unknown: does nothing.
  - **Bypass the cookie cache:** the session request asks Better Auth not to use it (`disableCookieCache`), so it stays correct once slice 6 turns the cache on.
- **`loadSettings`:**
  - **With a cache:** returns the cache, with pending changes on top, at once. A background refresh then sends any pending change, reads `me.get`, writes the cache and publishes the new settings.
  - **With no cache:** waits under the timeout, then falls back to defaults.
  - **A settings store** (`subscribeSettings` / `useMySettings(userId, initial)`) lets the timeline and the settings pages re-render when the refresh brings different values.
  - **A pure `settingsPlan`** decides cache-or-wait and what to send.
- **The timeline route** reads its settings through the hook, seeded from the loader's value.

**Acceptance criteria:**

- [ ] Unit tests (`sessionRules.test.ts`) cover:
  - `sessionFreshness` at the edges: 15 min exactly, a clock moved back, no record, NaN;
  - `shouldRecheck`;
  - `withTimeout` resolving `unknown` at 3 s, with fake timers, and ignoring a late answer;
  - `askSession` with a 429 retry inside the budget.
- [ ] Unit tests for `settingsPlan`: each case of cache or no cache, and pending or not.
- [ ] A component test: the timeline renders new units when the settings store publishes them.
- [ ] `session-end` gains a step: a device whose session is fresh has its session revoked on the server, then navigates. It lands on sign-in after the background recheck, and the device is wiped. Its usual seconds are updated in `scripts/loops/checks`.
- [ ] `sign-in`, `session-end`, `first-sync` and `signout-wipe` pass (`pnpm prd browser --changed`).
- [ ] By hand, with the server stopped: a navigation inside a fresh session doesn't wait, and a stale one gives up within about 3 s and carries on. Noted in the hand-off.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 5.

---

## Slice 2: Section tabs respond at once

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/components.md · Tests: component

**User stories:** 12, 13, 14, 15, 16.

**What to build:**

- `SectionNav` and `TabBar` links get `prefetch="render"`.
- **The current section** comes from `useNavigation().location?.pathname ?? pathname`, through the existing `sectionCurrent` rule. `aria-current` and the active style follow it, and it falls back to the current pathname once the navigation is cancelled or fails.

**Acceptance criteria:**

- [ ] Component tests:
  - both link sets render with prefetch (the prefetch `<link>`s appear, or the prop is asserted through the rendered markup);
  - with a target loader that never resolves, tapping a tab moves `aria-current` to it at once, on phone and wide widths;
  - cancelling the navigation moves it back.
- [ ] `pnpm test:components --changed` and `pnpm check` pass. `pnpm prd browser --changed` names none (component tests), or `app-shell`, which passes.

**Blocked by:** none. **Blocks:** none.

---

## Slice 3: Off-screen timeline rows cost little

Stack: no · Reads: docs/domain/timeline.md, docs/domain/components.md · Tests: component

**User stories:** 17, 18, 19, 20.

**What to build:**

- `content-visibility: auto` with `contain-intrinsic-size: auto <estimate>` on timeline entry rows, or on day groups if that measures better (say which in the hand-off).
- The paging sentinel and the scroll-restore anchor are left uncontained, or the restore is shown to work with remembered sizes.
- Off-screen rows stay in the DOM and the accessibility tree.

**Acceptance criteria:**

- [ ] `timelineScroll.browser.test.tsx` passes unchanged, and gains a test that the rows carry `content-visibility`.
- [ ] A test that, after three pages and a navigation away and back, the scroll position and the next page's load still work.
- [ ] The hand-off reports a before and after for a long timeline: Chrome's rendering time for a scroll through 90 rows, or the layout count, measured by hand.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** none.

---

## Slice 4: Bundle budget

Stack: no · Reads: docs/loops.md · Tests: unit

**User stories:** 35, 36, 37.

**What to build:**

- **`scripts/build/manifest.mjs`:** from the web build's client manifest (Vite's `.vite/manifest.json`; turn it on with `build.manifest` for the web client build if it's off) and React Router's route manifest, list each route's initial chunks (entry, root, the `/app` layout) and each chunk's source modules.
- **`scripts/build/budget.mjs`**, pure: `checkBudget(listing, budget)` returns violations naming the chunk and the module.
- **`scripts/build/budget.json`:**
  - forbidden patterns in the entry and the `/app` shell's initial chunks: `@tiptap/`, `yjs`, `y-`, `prosemirror-`, `@powersync/`;
  - gzip ceilings, set from today's build plus 10%.
- **`pnpm build:budget`** builds the web target, then checks it, printing a table of chunk, size and limit.
- **`pnpm prd check`** runs it after `pnpm check`, under the same check lease.

**Acceptance criteria:**

- [ ] Unit tests (`scripts:unit`) against fixture manifests: a forbidden module in the entry is reported with its chunk; a chunk over its ceiling is reported; a clean listing passes.
- [ ] `pnpm build:budget` passes on today's build. The hand-off shows its table.
- [ ] Temporarily importing Tiptap into the `/app` layout makes it fail and name the module. Shown in the hand-off, and not committed.
- [ ] `scripts/loops/check-areas` maps `scripts/build/` to none.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 5.

---

## Slice 5: Service worker

Stack: yes · Reads: docs/domain/sync.md, docs/domain/security-headers.md, docs/domain/app-shell.md, docs/domain/components.md, docs/loops.md · Tests: unit, component, e2e:layout-offline

**User stories:** 27, 28, 29, 30, 31, 32, 33, 34, 38, 39.

**What to build:**

- **Prove the shell first** (and record it in the hand-off): a document that boots the client router on any `/app/*` URL with no route-specific server data, under the CSP. Either the web build emits one (as `ssr: false` does for native), or a prerendered `/app` document works whatever the URL. If neither works, stop and report before building the rest.
- **The precache list** comes from slice 4's manifest reader: the shell, every client asset and the CSS. The worker is written to the web client build as `/sw.js`, holding the list and a build version. It's a build step after `react-router build` for the web target only.
- **The worker:**
  - pure request routing (`routeRequest(url, mode)` → `shell` | `cache` | `network`), unit-tested;
  - install precaches;
  - activate deletes other versions' caches;
  - on a `skip-waiting` message, `skipWaiting()`;
  - `/app/*` navigations get the shell;
  - precached assets come cache-first;
  - everything else, including `/api`, `/rpc`, PowerSync, marketing and sign-in, goes to the network.
- **Registration** happens in the client entry, only when `import.meta.env.PROD`, the web target, and not native.
- **The update notice** is a small `ui/` banner or toast in the frame, in its own region at the end: "A new version is ready" with Reload. Reload posts `skip-waiting`, waits for `controllerchange`, then reloads.
- The CSP needs no change (`worker-src 'self' blob:`); confirm that the cached shell's CSP `<meta>` and the headers its response keeps are consistent.
- `pageCache.ts`'s bfcache reload works offline now; update its comment.
- `scripts/loops/check-areas` rules for the worker and the build step.

**Acceptance criteria:**

- [ ] Unit tests:
  - `routeRequest` for each class of URL;
  - the precache list from a fixture manifest;
  - cache naming and cleanup against a fake `CacheStorage`.
- [ ] A component test of the update notice: hidden with no waiting worker; shown with one; Reload posts `skip-waiting`.
- [ ] `layout-offline` gains a step: after a first load (worker installed), go offline, reload an `/app/groups/<id>/timeline` URL and a provider page, and see each screen from local data. Its usual seconds are updated.
- [ ] The lean set passes once with the worker on (`pnpm prd browser --changed`, which names the lean set for a build change). Note any check that needed a change because of the worker.
- [ ] The dev server and `pnpm build:native` register no worker. Shown in the hand-off.
- [ ] `pnpm build:budget` and `pnpm check` pass.

**Blocked by:** 1, 4. **Blocks:** none.

---

## Slice 6: Cheaper `/rpc` auth

Stack: yes · Reads: docs/domain/auth.md, docs/domain/api.md, docs/domain/admin.md, docs/domain/sync.md · Tests: integration, e2e:sign-in

**User stories:** 21, 22, 23, 24, 25, 26.

**What to build:**

- **Start from `dev` with hosting slice 3 in it** (it changes `rpc.ts` and Better Auth's rate-limit config).
- **A lazy AuthUser:** `getAuthUser` becomes a memoised `() => Promise<AuthUser | null | AppError>` passed in the API context. `authedProcedure` and `staffProcedure` resolve it in their middleware; `publicProcedure` never does. A lookup error is still a 500, logged as today.
- **One query:** the user (roles and disabled-at) with their memberships, through the data layer's models (joined, or one query with an aggregate), returning the same AuthUser.
- **The cookie cache:** Better Auth `session.cookieCache` is enabled with `maxAge: 180`.
  - **Staff procedures** read the session with the cache disabled.
  - **The `/token` endpoint** (PowerSync's JWT) refuses to use it, enforced on the server (a `before` hook, or the plugin's option), whatever the client sends.
  - Sign-out clears the cache cookie (check that Better Auth's sign-out does).
  - A comment at the setting names the tradeoff and points to `docs/domain/auth.md`.

**Acceptance criteria:**

- [ ] Integration tests:
  - a public procedure (the announcement, the waitlist) makes no session lookup (spy on `getSession`, or count queries);
  - an authed procedure resolves the AuthUser once per request;
  - the one-query lookup returns the same AuthUser as before for a member of two groups, and null for a disabled account;
  - with the cookie cache on, a session revoked in the database: an ordinary procedure still succeeds within 3 minutes (the tradeoff, pinned), but a staff procedure and `/api/auth/token` are refused at once;
  - after sign-out, the cookie no longer authorizes.
- [ ] `sign-in`, `session-end`, `signout-wipe` and `invites` pass (`pnpm prd browser --changed`). `session-end` still detects revocation within its usual time, because slice 1's check bypasses the cache.
- [ ] The hand-off has the wording of the ⚠ tradeoff for the orchestrator to fold into `docs/domain/auth.md` and `plans/security-review.md`.
- [ ] `pnpm check` passes.

**Blocked by:** hosting wave 1 (slice 3) in `dev`; slice 1 for the session check's cache bypass, if 6 runs in wave 1. In that case merge 1 first, and 6 also confirms the bypass. **Blocks:** none.
