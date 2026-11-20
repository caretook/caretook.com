# PRD: App speed

> Backlog: B-136, B-137, B-138, B-139, B-140, B-144, B-155 and B-156. Topic `app-speed`. Written 2026-11-20 from an interview with the user.

## Problem Statement

The app keeps its data on the device, but it still feels like a website on a slow connection:

- **Every tap inside a care group waits on the network twice.**
  - The `/app` layout's middleware awaits a `get-session` request on every navigation, with no timeout. Each tap waits a round trip, and on a weak connection (a hospital corridor, a parking garage) it can hang with nothing on screen changing.
  - The timeline's loader then awaits the settings (`me.get`, after sending any pending change) before it uses its cache. Only an outright network error falls back. That's a second blocking round trip on every timeline load, also with no timeout. (B-156 asked whether it waits: it does.)
- **The first tap on a section downloads its code.** The section tabs (header links on wide screens, the phone tab bar) aren't prefetched, so the first visit to Providers or Medications fetches its route chunk. Offline, that first tap fails.
- **The tapped tab doesn't respond.** It only highlights once every loader has finished, so a slow tap looks like a missed one, and people tap again.
- **The timeline gets heavier as you scroll.** It grows by 30 rows at a time with no virtualization, and the browser lays out and paints every row, including those far off screen.
- **Every API call pays for auth.** `/rpc` looks up the session and runs two more queries (the user, then their memberships) on every call, public ones included. A screen that makes several calls pays several times.
- **Every full load starts from scratch.** There's no service worker. A repeat visit downloads and parses the shell again, and a reload while offline shows the browser's error page. So does going Back to a page the browser froze, since `pageCache.ts` reloads it. Offline works only within a session that's already loaded.
- **Nothing guards the first download.** The editor (Tiptap, Yjs, ProseMirror) and PowerSync are loaded lazily today, but nothing stops a future import from pulling them into the first chunk.

## Solution

Make the device the default and the network something that catches up in the background, without loosening what the server enforces.

- **Navigation doesn't wait for a recent session.** A session the server confirmed within the last **15 minutes** counts as fresh: navigation goes ahead at once, and a background recheck (at most once a minute) refreshes it. Past 15 minutes, navigation waits for the check, but never more than **3 seconds**. No answer by then counts as "unknown", and the existing 3-day offline rule applies. If a background recheck finds the session has ended, the device is wiped and the user goes to sign-in, as today.
- **Settings come from the cache.** With settings cached, the timeline uses them at once. Pending changes are sent and the server's copy is read in the background, and the open screen updates if they differ. Only a device with no cached settings waits, and then for at most 3 seconds.
- **Section tabs are instant.** Both sets of tab links prefetch their routes, so the first tap needs no download (and works offline), and the tapped tab highlights the moment it's tapped, from the pending navigation.
- **Off-screen timeline rows cost little.** Rows use `content-visibility: auto` with a size estimate, so the browser skips laying out and painting rows that are far off screen. Scroll restore and paging still work.
- **`/rpc` auth is cheaper.**
  - Public procedures never look up a session.
  - Other procedures look it up only when they need it, and load the user and memberships in one query.
  - Better Auth's signed session cookie cache stands in for the session table for up to **3 minutes**.
  - Staff procedures, minting a sync token and the app's own session check always read the live session.
  - **Security tradeoff (documented prominently, for future consideration):** for up to 3 minutes after a session is revoked, ended on another device or its account disabled, ordinary `/rpc` calls carrying that cookie still succeed. Uploads are still checked against memberships in SQL (never cached), and staff actions and new sync connections are refused at once.
- **The web app has a service worker.** It's hand-written, with no new dependency, and is for the web target only.
  - It precaches the app shell and its hashed assets. Every `/app/*` page load is served the cached shell at once (an SPA-style document, as the native build ships), so a repeat load is near-instant and a reload offline works.
  - When a new deploy is ready, the app shows a small "A new version is ready: Reload" notice. It never reloads on its own.
- **A bundle budget guards the first download.** `pnpm build:budget` builds the web target and fails if the entry chunk or the `/app` shell's initial chunks contain editor or PowerSync code, or grow past a size ceiling. `pnpm prd check` runs it, so every landing is checked.

## User Stories

1. As a caretaker, I want tapping between screens in a care group to respond at once, so that the app feels like an app and not a slow website.
2. As a caretaker on a weak connection, I want navigation never to hang waiting for the server, so that I can keep working in a hospital corridor or a car park.
3. As a caretaker, I want the app to recheck my session quietly in the background, so that I never wait for it while I'm actively using the app.
4. As a caretaker who signed out on another device, I want this device to notice within minutes and go to sign-in, so that an ended session doesn't linger.
5. As a caretaker whose session check gets no answer, I want the app to give up after about 3 seconds and carry on with my local data, so that a dead network doesn't freeze the screen.
6. As a caretaker offline for more than 3 days, I want the existing "You've been offline for 3 days" sign-in, so that the offline limit still holds.
7. As a caretaker whose session check returns "signed out", I want the device wiped and sign-in shown, exactly as today, so that the wipe rules don't change.
8. As a caretaker, I want the timeline to open with my unit and view settings straight away, so that it doesn't wait on the server for display preferences.
9. As a caretaker who changed a setting on another device, I want this device to pick it up within the same visit, so that the screen corrects itself without a reload.
10. As a caretaker who changed a setting offline, I want the change sent when I'm back online without blocking the screen, so that pending changes still reach the server.
11. As a caretaker on a new device with no cached settings, I want the timeline to wait briefly for my settings (at most 3 seconds) and then fall back to defaults, so that a first load shows the right units when it can.
12. As a caretaker, I want the first tap on Providers, Medications or any other section to open without a download, so that it's as fast as the second tap.
13. As a caretaker who went offline after opening the timeline, I want the section tabs to still open, so that I can reach the medication list without a connection.
14. As a caretaker on a phone, I want the tab I tap in the bottom bar to highlight at once, so that I know the tap registered.
15. As a caretaker on a wide screen, I want the header's section link to highlight at once, so that I know the tap registered.
16. As a caretaker, I want the highlight to go back to the current section if the navigation is cancelled or fails, so that the tabs never lie about where I am.
17. As a caretaker scrolling a long timeline, I want scrolling to stay smooth after several pages, so that months of history don't slow the screen down.
18. As a caretaker returning to the timeline, I want it to restore my scroll position, so that `content-visibility` doesn't throw me back to the top.
19. As a caretaker scrolling to the end of what's loaded, I want the next page to load as it does today, so that paging still works.
20. As a caretaker using find-in-page or a screen reader, I want off-screen rows to stay in the page, so that search and assistive technology still reach them.
21. As a caretaker, I want each screen's server calls to answer faster, so that saving, searching and loading staff banners feel quick.
22. As a visitor submitting the public waitlist or contact form, I want the server not to look up a session I don't have, so that public calls stay cheap.
23. As a staff member, I want staff actions always checked against my live session, so that a revoked or disabled staff account can't act on a cached cookie.
24. As a caretaker whose account was disabled, I want new sync connections refused at once, so that a disabled account can't open a fresh sync.
25. As the product owner, I want the 3-minute cookie cache's tradeoff written down prominently, so that it's reconsidered before launch and whenever the threat model changes.
26. As a caretaker who signs out on this device, I want the cached session cookie cleared at once, so that sign-out here isn't delayed by the cache.
27. As a caretaker, I want a repeat visit to the app to load near-instantly, so that opening it from my home screen feels native.
28. As a caretaker offline, I want reloading the app to work, so that an accidental pull-to-refresh doesn't lock me out of my local data.
29. As a caretaker going Back to a page the browser froze, I want it to load offline too, so that the bfcache reload no longer fails without a network.
30. As a caretaker opening any `/app` link (a note, a provider, a sheet URL) offline, I want the app to open on that screen, so that saved links work offline.
31. As a caretaker, I want to be told when a new version is ready, with a Reload button, so that I choose when the app refreshes and never lose an unsaved form.
32. As a caretaker who ignores the notice, I want my current session to keep working, so that the old version's lazy screens still load.
33. As a caretaker, I want the marketing site and sign-in to behave as they do today, so that the worker only touches the app.
34. As a caretaker using the native app, I want nothing to change, so that Capacitor's build stays as it is.
35. As a developer, I want a budget that fails the landing when the editor or PowerSync slips into the first chunk, so that the speed gains don't erode unnoticed.
36. As a developer, I want the budget's report to name the offending chunk and module, so that I can fix a regression quickly.
37. As a developer, I want the budget's limits in one file that changes only on purpose, so that raising a limit is a visible decision.
38. As a developer, I want the worker's precache list generated from the build, so that it never goes stale or misses a hashed asset.
39. As a developer, I want the worker off in the dev server, so that Vite's hot reload isn't fought by a cache.
40. As a developer, I want the session, settings and worker rules as pure, unit-tested modules, so that their timing rules are testable without a browser.

## Implementation Decisions

**Session freshness (B-136).**

- The pure session rules gain a freshness rule. From the last confirmed check and now, a session is **fresh** (confirmed within 15 minutes), **stale** (older, but within the 3-day offline limit) or **none** (never confirmed on this device, or storage unavailable). A clock that moved back counts as no time passed.
- They also gain a timeout wrapper: a session request that hasn't answered in 3 seconds resolves as `unknown`, and its late answer is ignored. The retry after a 429 stays inside the same 3-second budget.
- The session check, per navigation:
  - **fresh:** the cached user and their database are returned at once. If the last confirmation is more than a minute old, a background recheck starts, shared with any check already in flight.
  - **stale or none:** it awaits the check under the timeout, as today.
- **A background recheck's answer:**
  - ok: confirms, which renews freshness.
  - signed out: runs the existing wipe and sends the user to sign-in (a full navigation to sign-in from wherever they are).
  - unverified: goes to the verify-email page.
  - rate limited or unknown: does nothing. The next navigation tries again.
- **The app's own session check always bypasses the cookie cache**, so revocation detection is unchanged by B-140.
- `sessionContext`, the `requireSession` signature and the wipe path don't change for callers.

**Settings cache-first (B-156).**

- `loadSettings` returns the cache, with pending changes on top, at once whenever a cache exists. With no cache, it awaits the server under the same 3-second timeout, then falls back to defaults.
- **The background refresh** sends any pending change, then reads `me.get`. It writes the cache and publishes a change that the open screen subscribes to (a small settings store with a hook), so the timeline re-renders when the server's copy differs. A refused pending change is dropped as today. A signed-out answer is left to the session check.
- A pure "settings plan" decides, from cache present or absent and pending present or absent, whether to answer from the cache or wait, and what the refresh must send.

**Section tabs (B-137, B-138).**

- Both the header's `SectionNav` and the phone `TabBar` use `prefetch="render"` (as sheets already do), so route modules load once the frame renders.
- **The highlight** comes from the pending navigation's location when there is one, else the current location, through the existing section-matching rule. A cancelled or failed navigation falls back to the current section.

**Timeline rows (B-139).**

- Timeline entry rows (and day groups, if that's the better unit) get `content-visibility: auto` with a `contain-intrinsic-size` estimate (`auto <estimate>`, so the browser remembers real sizes).
- The paging sentinel and the scroll-restore anchor keep real layout: either they stay outside the contained elements, or the restore uses the row's remembered size.

**`/rpc` auth (B-140).**

- **Lazy resolution.** The handler gets a lazy AuthUser: a memoised function that resolves it once on first use. Public procedures never call it; authed and staff procedures resolve it in their middleware.
- **One query.** The user (with roles and disabled-at) and their memberships load in a single query.
- **The cookie cache.** Better Auth's session cookie cache is on, with a max age of **3 minutes**.
  - Staff procedures and the sync token endpoint (`/api/auth/token`) bypass it on the server, so the live session table is read whatever the client sends.
  - Sign-out clears the cache cookie.
- **The tradeoff is written up prominently** at landing: a ⚠ section in `docs/domain/auth.md`, and an entry in `plans/security-review.md`. A code comment at the cache setting points to both.
- This runs after hosting wave 1 is in `dev` (hosting slice 3 changes the same files for rate limits).

**Service worker (B-144).**

- **Hand-written, web target only.** A build step writes the worker with its precache list from React Router's build manifest (hashed client assets, the shell document, the CSS) and a build version.
- **Registration:** only from a production web build (check builds included). Never in the dev server, under Vitest, or in the native build.
- **The worker's scope is `/`, but it only handles some requests:**
  - `/app/*` documents: the precached shell.
  - Precached assets: from the cache.
  - Everything else goes to the network: the marketing pages, `/sign-in`, `/api/*`, `/rpc/*`, PowerSync, the worker scripts PowerSync loads.
- **The shell** is a document that boots the client router on any `/app/*` URL with no route-specific server data, like the native build's `index.html`. The slice first proves the shell's form: either the web build emits one, or the worker uses a prerendered `/app` document whose hydration works on any `/app/*` URL. It records which in its hand-off. The shell carries the CSP `<meta>` as every document does. A cached response keeps its own headers, so its nonce stays consistent.
- **Updates.** The new worker installs and waits; there's no `skipWaiting` on install. The page listens for a waiting worker and shows a "A new version is ready: Reload" notice (a `ui/` toast or banner in the frame). Reload tells the worker to take over, then reloads. Old caches are deleted on activate, keyed by build version.
- **Old chunks stay reachable.** A tab left on the old version keeps working: its lazy chunks are still in the old cache until the new worker activates.
- **Fit:** the CSP's `worker-src 'self' blob:` already allows it. PowerSync's shared and dedicated workers are never intercepted (their requests go to the network or are already cached by the browser). `pageCache.ts`'s bfcache reload now succeeds offline.

**Bundle budget (B-155).**

- **A build-manifest reader** (shared with the service worker's precache step) lists each route's initial chunks and each chunk's modules, from the Vite and React Router manifests.
- **A pure budget checker** takes that listing and a budget file (forbidden module patterns for the entry and the `/app` shell's initial chunks: `@tiptap/`, `yjs`, `prosemirror-`, `@powersync/`; plus gzip size ceilings). It returns violations naming the chunk and module.
- `pnpm build:budget` builds the web target and runs it. `pnpm prd check` runs it after `pnpm check`. `pnpm check` itself doesn't build.

## Testing Decisions

- **Good tests check behaviour at a module's boundary:** what a navigation waits for, what a screen shows, what a request returns. They don't check internal calls or timings. Timers and clocks are injected, never real sleeps.
- **Unit tests** (`web:unit`, `scripts:unit`):
  - session freshness and the timeout wrapper, beside the existing `sessionRules` tests;
  - the settings plan;
  - the worker's request routing (which requests it answers, from what) and its cache naming and cleanup, against a fake cache;
  - the precache list and the build-manifest reader, against a fixture manifest;
  - the budget checker, against fixture listings.
- **Component tests** (`web:components`; `docs/domain/components.md`):
  - SectionNav and TabBar: the link prefetches, and the tapped tab highlights during a pending navigation (a loader that never resolves), then falls back on cancel;
  - the timeline scroll tests (`timelineScroll`): the restore and the sentinel still work with `content-visibility` on;
  - the timeline re-renders when the settings store publishes new settings;
  - the update notice: shown when a worker is waiting; Reload posts the takeover message.
- **Integration tests** (`integration`):
  - the lazy AuthUser: a public procedure makes no session lookup, and an authed one resolves once per request;
  - the one-query lookup returns the same AuthUser as today, and still refuses disabled accounts;
  - with the cookie cache on, a revoked session can't call a staff procedure or mint a sync token, while an ordinary procedure keeps working within the cache age (the tradeoff, pinned by a test).
- **End-to-end, in the lean checks that own the flows** (no new checks):
  - `session-end`: a session ended on the server while the device is fresh goes to sign-in after the background recheck, and the device is wiped.
  - `sign-in`: still passes. The fresh path doesn't skip the first check after sign-in.
  - `layout-offline`: with the worker installed, an offline reload of an `/app` URL opens the screen from local data.
- **Prior art:** `sessionRules.test.ts`, `timelineScroll.browser.test.tsx`, `packages/api`'s integration tests with `packages/data/test/fixtures.ts`, `scripts/loops/*.test.mjs` for tooling tests.

## Out of Scope

- Virtualizing the timeline. `content-visibility` comes first; virtualization only if it isn't enough.
- Background sync, push notifications or a web app manifest and install prompt.
- Caching API responses (`/rpc`) in the worker: reads come from the local database.
- Any change to the 3-day offline limit, the wipe rules or what PowerSync and the upload path check.
- Speed work on the native (Capacitor) build, beyond leaving it unchanged.
- Performance dashboards or real-user monitoring (no analytics that can see health data).
- Server-side caching of memberships or users between requests.

## Further Notes

- **Hot files:** `lib/session.ts` and `lib/me.ts` (slice 1); `packages/auth/src/authUser.ts`, `packages/auth/src/auth.ts` and `routes/rpc.ts` (B-140, shared with hosting slice 3).
- **The cookie cache tradeoff** must be revisited before launch, and whenever the threat model changes (shared devices, staff access, a breach response). The plan's fold-in list makes the orchestrator put it in `docs/domain/auth.md` and `plans/security-review.md`.
- The worker changes what a reload means in the browser checks. Check browsers start from a fresh profile, so each run installs the current build's worker. The slice confirms that no lean check is served a stale shell across a rebuild.
