# Plan: Quick fixes

> No PRD: each slice is one small fix with its own backlog item. New fixes are appended as new slices (the next number), and an orchestrator runs whichever the user asks for. Topic `quick-fixes`.

## Status

| Slice | Item | State  | Merge into `prd/quick-fixes` (slice commits) |
| ----- | ---- | ------ | -------------------------------------------- |
| 1     | B-1  | merged | 1e00754 (5ab3b67)                            |
| 2     | B-17 | merged | 4629e8c (32355db)                            |
| 3     | B-22 | merged | b0325d0 (46ef320)                            |

Wave 1 (slices 1–3) is in `dev`. Nothing is in flight; new fixes are appended as slice 4 onward.

- Slice 3 measured the first sync at about 120–200 ms after the database opens, so it shortened the wait to 1 s and added a syncing state; with the old code a 12 s sync left home on "You're not in a care group yet" for good.
- Slice 2's offline-reload criterion is checked by leaving the timeline and coming back offline: a full offline reload needs a service worker, which isn't built.
- The sync brought in app-shell slice 1, so `layout-offline.mjs` now signs out through `page.signOut()`.
- `scripts/loops/prompt.sh` now skips `plans/<topic>-prd.md` when a topic has none (as here), and names _Rules across PRDs_ correctly.

## How to run this plan

- **Every slice is independent:** none blocks another, so any of them can run at once. They touch different files (1: `sign-in.tsx`; 2: `lib/me.ts` and the timeline's layout toggle; 3: `lib/sync/index.ts` and the loaders that wait on the first sync). Merge in number order.
- No migrations, no sync-config changes, no seed changes.
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
