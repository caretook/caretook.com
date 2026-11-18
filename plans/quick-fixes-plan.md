# Plan: Quick fixes

> No PRD: each slice is one small fix with its own backlog item. New fixes are appended as new slices (the next number), and an orchestrator runs whichever the user asks for. Topic `quick-fixes`.

## Status

| Slice | Item | State  | Merge into `prd/quick-fixes` (slice commits) |
| ----- | ---- | ------ | -------------------------------------------- |
| 1     | B-1  | merged | 1e00754 (5ab3b67)                            |
| 2     | B-17 | merged | 4629e8c (32355db)                            |
| 3     | B-22 | merged | b0325d0 (46ef320)                            |
| 4     | B-28 | ready  |                                              |
| 5     | B-29 | ready  |                                              |

Wave 1 (slices 1–3) is in `dev`. Slices 4 and 5 (browser check tooling, from the _Browser check budget_ in AGENTS.md) are ready; they're independent and can run together.

- Slice 3 measured the first sync at about 120–200 ms after the database opens, so it shortened the wait to 1 s and added a syncing state; with the old code a 12 s sync left home on "You're not in a care group yet" for good.
- Slice 2's offline-reload criterion is checked by leaving the timeline and coming back offline: a full offline reload needs a service worker, which isn't built.
- The sync brought in app-shell slice 1, so `layout-offline.mjs` now signs out through `page.signOut()`.
- `scripts/loops/prompt.sh` now skips `plans/<topic>-prd.md` when a topic has none (as here), and names _Rules across PRDs_ correctly.

## How to run this plan

- **Every slice is independent:** none blocks another, so any of them can run at once. They touch different files (1: `sign-in.tsx`; 2: `lib/me.ts` and the timeline's layout toggle; 3: `lib/sync/index.ts` and the loaders that wait on the first sync). Merge in number order.
- No migrations, no sync-config changes, no seed changes.
- **Slices 4 and 5 are tooling**: `scripts/loops/`, `scripts/browser-checks/`, `package.json` scripts and AGENTS.md's check instructions (the orchestrator writes the AGENTS.md part at landing). They touch no app code, so they don't conflict with `routing`, `providers` or `components`. Land them as soon as they're green: every running loop benefits.
- Each slice ends with `pnpm check` passing, a browser check for its behaviour, and a hand-off (AGENTS.md, _Loop rules_).
- Land each slice as soon as it's merged and green: these are small, and `timeline-polish` and `app-shell` will touch the same screens.
- **Overlap with other PRDs:** slice 2 touches the timeline's layout toggle in `timeline.tsx` (hot for `timeline-polish` and `live-notes-ux` slice 7), and `app-shell` adds the same preference to Settings. Keep the timeline edit to the toggle's handler, and put the logic in `lib/me.ts` so Settings can reuse it.

---

## Slice 1: Sign-in can't be submitted twice (B-1)

**Problem.** `sign-in.tsx` disables the button only while `navigation.state === "submitting"`. When the action redirects, the state becomes `"loading"` while `/app`'s loaders run (including up to 10 s of `waitForFirstSync`), and the button is live again. A second tap signs in again and starts another navigation.

**Build.**

- Disable the button, and keep "Signing in…", from submit until the navigation that the sign-in started is idle: `state !== "idle"` with a `formAction` that's the sign-in route (or any non-idle navigation while on this page).
- Keep the same text and `disabled` state when the action returns an error, so the form re-enables then.

**Acceptance criteria.**

- [ ] After a successful submit, the button stays disabled and shows "Signing in…" until `/app` renders.
- [ ] A wrong password re-enables the button with the existing error message.
- [ ] A second click during the redirect doesn't send a second `sign-in/email` request (count requests in the browser check).

**Browser check.** A new `sign-in.mjs`: delay `/app` (throttle PowerSync through `proxy.mjs`, or a freshly cleared device so the first sync waits), click twice, assert one sign-in request and a disabled button; then the wrong-password case.

**Blocks:** none. **Blocked by:** none.

---

## Slice 2: A timeline layout change made offline isn't lost (B-17)

**Problem.** The timeline's toggle sets local state, caches the choice (`cacheSettings`) and calls `rpc.me.updatePreferences`, dropping any failure. Offline, the call fails. On the next online load, `loadSettings` reads the server's old value and overwrites the cache, so the choice is lost.

**Build.**

- In `lib/me.ts`: a per-user **pending** record (`caretook:settings-pending:<userId>`), and a `saveSettings(userId, partial)` that caches it, records it as pending, tries `updatePreferences`, and clears the pending fields only when the call succeeds.
- `loadSettings`, when online: send any pending fields first (one `updatePreferences`), clear them on success, then read `me.get`. If sending fails with a network error, keep them pending and return the cache, with the pending values applied on top.
- The timeline's toggle calls `saveSettings` instead of its inline cache-and-call. `forgetSettings` (sign-out) also clears pending records.
- Last write wins: a pending change from this device overwrites a change made on another device in the meantime. That's acceptable for a display preference; note it in the code.

**Acceptance criteria.**

- [ ] Offline: switch to Cards, reload while still offline, and it's still Cards.
- [ ] Offline: switch to Cards, go back online, reload, and it's still Cards; the server's `preferences.timelineView` is `cards`.
- [ ] Online: a change saves straight away, and nothing is left pending.
- [ ] Sign-out clears pending records.
- [ ] Unit tests (`web:unit`, with a stubbed `localStorage` and rpc) for `saveSettings` and `loadSettings`: success, network failure, flush on the next load, and a non-network error still propagating.

**Browser check.** Extend `phase2.mjs`, or add `layout-offline.mjs` using `proxy.mjs` to cut the connection (CDP network emulation doesn't stop PowerSync's stream, but here it's only the rpc call that matters; use the proxy anyway, for consistency with `roundtrip.mjs`).

**Blocks:** none. **Blocked by:** none.

---

## Slice 3: The first screen after sign-in doesn't wait up to 10 s (B-22)

**Problem.** The `home`, `timeline` and `entry` clientLoaders call `waitForFirstSync` (10 s cap) before rendering. On a device that hasn't synced (every fresh sign-in, since sign-out wipes the database) the user sees nothing for as long as the first sync takes.

**Build, in this order.**

1. **Measure** on your slot's stack, after a fresh sign-in as member@ (about 180 seeded entries): time to the first `hasSynced`, and to first render of the timeline. Record the numbers in the hand-off.
2. **Then fix, choosing by what you measured** (say which, and why, in the hand-off):
   - If the first sync is usually fast (under about 1.5 s), shorten the cap (for example to 3 s) and show a "Syncing…" state when the cap runs out with no rows.
   - Otherwise render straight away from whatever is local, with a syncing state (a skeleton or a "Getting your care groups…" message) until the first sync completes; the live queries fill the screen as rows arrive. `home` must not show "You're not in a care group yet" before the first sync finishes, and must still redirect to the only group once it's known.
3. Keep the behaviour for a device that has already synced: no wait, no flash.

**Acceptance criteria.**

- [ ] The hand-off records before and after timings.
- [ ] After a fresh sign-in, something renders within about 1 s (a syncing state or data), never a blank page for the whole first sync.
- [ ] `home` never claims you have no care groups before the first sync completes; it still goes straight to the timeline when you have one group.
- [ ] A device that has synced opens the timeline with no syncing state.
- [ ] `live-note.mjs`, `phase2.mjs` and `signout-wipe.mjs` still pass (they all start from a fresh sign-in).

**Blocks:** none. **Blocked by:** none.

**Note for `app-shell`:** its `/app` last-group redirect also needs the local groups, so it reuses whatever "first sync is done" signal this slice adds.

---

## Slice 4: At most two browser checks at once, machine-wide (B-28)

**Problem.** Browser checks were 63% of all tool time across the first PRDs (850 runs, about 10 h), and about 30% of runs failed, mostly on timeouts and PowerSync 401s while several loops ran Chrome, Vite and PowerSync at once (load averages of 30–60, once past 500, on 10 cores). Failures caused reruns, which added load. Nothing limits how many checks run at once across worktrees.

**Build.**

- `pnpm prd browser <check> [args…]` (a new `scripts/loops/browser.sh`, dispatched by `prd.sh`): run one check from the current worktree, holding one of **two** machine-wide leases.
  - Leases are directories under the main checkout's `.loops/.browser/<N>` (N = 1, 2), taken with `mkdir` like the slot leases in `lib.sh`, each with a `name` file (worktree, check, pid, start time).
  - If both are taken, wait and poll (every 5 s), printing once who holds them; give up after `CARETOOK_BROWSER_WAIT` (default 20 min) with a clear message and a non-zero exit.
  - A lease whose pid is gone is stale: take it over (and say so).
  - Release on every exit path (`trap` on EXIT, INT and TERM), including a timeout.
  - Run the check with the worktree's `.env.loop` sourced (or the main checkout's defaults when there is none), from `scripts/browser-checks/`, with Node 24 from `.nvmrc`.
  - `--timeout <s>` kills the check after that many seconds. It's the default for the checks that never exit on their own (`signout-wipe.mjs`, `layout-offline.mjs`: 300 s), so callers stop hand-rolling `timeout`.
  - Print the elapsed time and the load average at start and end, so a hand-off shows whether a failure ran under load.
- `pnpm prd browser --suite` runs the full suite (the checks listed in AGENTS.md's _Browser check budget_), one at a time under a lease, and prints a pass/fail table at the end. That's the landing step's one full run.
- `pnpm prd status` (`ls.sh`) shows who holds the browser leases, and any stale lease.
- `CARETOOK_BROWSER_SLOTS` overrides the limit (default 2).

**Acceptance criteria.**

- [ ] Three `pnpm prd browser phase2.mjs` started at once from three worktrees: two run, the third waits and starts when one finishes (show the timestamps).
- [ ] Ctrl-C, a failing check and a `--timeout` all release the lease; a lease left by a killed process (`kill -9`) is taken over as stale.
- [ ] `signout-wipe.mjs` and `layout-offline.mjs` exit through the default timeout and report their result.
- [ ] `--suite` runs every check in order and prints the table; one failure doesn't stop the rest; the exit code is non-zero if any failed.
- [ ] `pnpm prd status` shows the leases.
- [ ] The hand-off includes the AGENTS.md wording for the orchestrator to fold in at landing: _Running loops_ (the command table and the _Browser check budget_ say to run checks through `pnpm prd browser`), _Loop rules_ and _Browser checks_.

**Check.** No browser check of its own: the criteria above, shown with command output. `pnpm check` passes; `shellcheck` on the new script if it's installed.

**Blocks:** none. **Blocked by:** none.

---

## Slice 5: `datastore:reset` leaves PowerSync ready (B-29)

**Problem.** After `pnpm datastore:reset`, PowerSync keeps the old JWKS for minutes ("no key matched the token KID", PSYNC_S2101), so the first sign-in gets a 401 and pages wait on `waitForFirstSync`. Its bucket storage can also still serve recent editors with the old user ids. It was the most common cause of failed browser checks. AGENTS.md works around it by hand (_Gotchas_: "Run `docker compose restart powersync` after a reset"), and agents often forget.

**Build.**

- `pnpm datastore:reset` restarts the worktree's own PowerSync after seeding (its Compose project from the root `.env`, never another worktree's), when the container exists and is running. Skip it, with a note, when it isn't (the test-only stack, CI).
- Then wait until PowerSync is ready: poll until it answers its health/probe endpoint, and until it has fetched the new JWKS (for example, request `/api/auth/token` for a seed user from the running dev server and confirm PowerSync accepts it, or check the service log for the key fetch). Give up after 60 s with a clear warning, not a failure, since the dev server may not be running.
- Clear PowerSync's bucket storage as part of the reset if that's what keeps stale recent editors (confirm first; if a restart alone fixes it, don't).
- Put the logic in a small script beside the other datastore runners (not inline in `package.json`), so `datastore:reset` stays one command and `new.sh` can use it too.
- Update the browser checks' sign-in helper (`cdp.mjs`) to retry once on a 401 from `/api/auth/token`, with a log line, as a last guard.

**Acceptance criteria.**

- [ ] In a loop worktree with its dev server running: `pnpm datastore:reset`, then immediately `live-notes.mjs` and `app-shell.mjs` pass on the first run, with no 401 or PSYNC_S2101 in the PowerSync log (show the log excerpt).
- [ ] The same in the main checkout's stack (default ports).
- [ ] With PowerSync stopped, the reset still succeeds and says it skipped the restart.
- [ ] It only restarts this worktree's container (show `docker ps` for two stacks before and after).
- [ ] After a reset, `live-notes.mjs`'s recent-editor steps show no "Former member".
- [ ] The hand-off includes the AGENTS.md wording for the orchestrator to fold in at landing: remove the "restart PowerSync after a reset" steps and gotchas this makes unnecessary (_Running loops_, _Landing a wave_, _Gotchas_, _Next steps_ item 1), and keep the ones it doesn't.

**Check.** The criteria above, with command output. `pnpm check` passes.

**Blocks:** none. **Blocked by:** none.
