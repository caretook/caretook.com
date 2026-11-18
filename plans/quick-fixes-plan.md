# Plan: Quick fixes

> No PRD: each slice is one small fix with its own backlog item. New fixes are appended as new slices (the next number), and an orchestrator runs whichever the user asks for. Topic `quick-fixes`.

## Status

| Slice | Item | State                         | Merge into `prd/quick-fixes` (slice commits) |
| ----- | ---- | ----------------------------- | -------------------------------------------- |
| 1     | B-1  | merged                        | 1e00754 (5ab3b67)                            |
| 2     | B-17 | merged                        | 4629e8c (32355db)                            |
| 3     | B-22 | merged                        | b0325d0 (46ef320)                            |
| 4     | B-28 | merged                        | b15b140 (9911d1b, 8a0bb50)                   |
| 5     | B-29 | merged                        | 8eaf3c3 (3b97174, a31bd85)                   |
| 6     | B-34 | merged                        | 483f768 (7251a69, 10aa140)                   |
| 7     | B-27 | merged                        | 75127be (004abfe)                            |
| 8     | B-35 | merged                        | 6dcc71d (7c0725f)                            |
| 9     | B-36 | merged                        | e6fc148 (cc12901)                            |
| 10    | B-39 | waits for `components` wave 2 |                                              |
| 11    | B-38 | ready                         |                                              |
| 12    | B-41 | ready                         |                                              |
| 13    | B-42 | ready                         |                                              |

Waves 1 (slices 1–3) and 2 (slices 4 and 5, browser check tooling; `937d406`) are in `dev`. Wave 3 (slices 7–9) landed in `dev` as 01d4d6d. Wave 4 (slice 6) landed as 37502ef. Wave 5 is slices 11, 12 and 13.

- Slice 6: `DateTimeField` is a RAC `DatePicker` (typed segments plus a calendar `Popover`), same props and submitted value. `roundtrip.mjs` step 4b and `live-notes.mjs`'s time chip go through the calendar. `components` slice 2 may swap its `Group`/`Popover` for its own primitives.

- Slice 7: the root cause was `proxy.mjs` not tunnelling CONNECT, so a proxied browser's Vite HMR socket never connected and it missed Vite's reload after a re-optimization (two copies of React and Yjs, a blank page). The proxy now tunnels WebSockets and keeps Vite's sockets open offline; `cdp.mjs` collects uncaught errors and `waitFor` prints `page.diagnose()` on a timeout. Still open on B-27: the first sign-in on an empty Vite deps cache (504 Outdated Optimize Dep; maybe `optimizeDeps.entries`), and an empty `/app` after a full reload (`app-shell.mjs`'s last-group steps: no `main`, empty body, no errors, for 20 s). It's not a check race: it failed 4 of the last 5 `app-shell.mjs` runs at load 6–30, at either reload step, so it's an app hang on reload, probably in session or sync startup.
- Slice 8: `providerService:practiceInUse`, on the server and the device. The sheet criterion wasn't run (no browser checks that wave). Open: deleting a practice leaves its clinicians pointing at it.
- Slice 9: `careGroup.int.test.ts` builds its fixtures per test; the other integration files were already independent.

- Slice 4: `pnpm prd browser` (two machine-wide leases, `--timeout`, `--suite`). The never-exiting checks are stopped 2 s after their last line, so they don't hold a lease for 300 s.
- Slice 5: `datastore:reset` ends with `datastore:powersync`, which also empties PowerSync's bucket storage (a restart alone kept stale `note_update`s, the "Former member" cause). Its main-checkout criterion is verified by the orchestrator after landing.
- Open: `phase2.mjs` failed 1/107 once in slice 4's worktree on a `[PowerSync]: Sync aborted` console warning (app, not tooling), at load 26–56.

- Slice 3 measured the first sync at about 120–200 ms after the database opens, so it shortened the wait to 1 s and added a syncing state; with the old code a 12 s sync left home on "You're not in a care group yet" for good.
- Slice 2's offline-reload criterion is checked by leaving the timeline and coming back offline: a full offline reload needs a service worker, which isn't built.
- The sync brought in app-shell slice 1, so `layout-offline.mjs` now signs out through `page.signOut()`.
- `scripts/loops/prompt.sh` now skips `plans/<topic>-prd.md` when a topic has none (as here), and names _Rules across PRDs_ correctly.

## How to run this plan

- **Every slice is independent:** none blocks another, so any of them can run at once. They touch different files (1: `sign-in.tsx`; 2: `lib/me.ts` and the timeline's layout toggle; 3: `lib/sync/index.ts` and the loaders that wait on the first sync). Merge in number order.
- No migrations, no sync-config changes, no seed changes.
- **Slices 4 and 5 are tooling**: `scripts/loops/`, `scripts/browser-checks/`, `package.json` scripts and AGENTS.md's check instructions (the orchestrator writes the AGENTS.md part at landing). They touch no app code, so they don't conflict with `routing`, `providers` or `components`. Land them as soon as they're green: every running loop benefits.
- Each slice ends with `pnpm check` passing, a browser check for its behaviour, and a hand-off (AGENTS.md, _Loop rules_).
- **Slice 6** changes `components/DateTimeField.tsx` only (used by the timeline sheet's `EntryForm` and the entry page's `EntryTimeChip`). `components` slice 6 reshapes `EntryForm` around it, so land slice 6 first, or let `components` rebase onto it.
- **Slice 6 waits for `components` slice 1** to merge into `dev`: that slice moves the shared components (`DateTimeField` included) into feature folders.
- **Slices 7–9 run beside `components` and `marketing`.** They stay out of `components/` and the route folders components is reshaping: 7 is browser checks plus whatever the root cause needs (keep an app fix small and list it in the hand-off), 8 is `providerService` and `lib/sync/providers.ts`, 9 is test files only. Slices 8 and 9 need no browser checks, so only 7 takes a browser lease.
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

---

## Slice 6: A date picker for When (B-34)

**Problem.** The timeline sheet's **When** field (`DateTimeField`, a React Aria `DateField`) only takes typed segments. Picking "last Tuesday" on a phone means stepping through month, day and year one segment at a time, and there's no calendar to see which date is which weekday.

**Build.**

- Turn `components/DateTimeField.tsx` into a React Aria `DatePicker` (`granularity="minute"`): the same typed `DateInput` segments, plus a calendar button at the end of the input that opens a `Popover` with a `Dialog` and a `Calendar` (month heading, previous and next month buttons, a day grid). Picking a day sets the date and keeps the time.
- Keep its props and behavior as they are: `name` submits the same zoned value (`parseDateTimeField` unchanged), `defaultValue` still defaults to now, `onChange` still gets ISO 8601 (UTC), and `isRequired` and `FieldError` stay. Callers don't change.
- Style the calendar with daisyUI (`btn btn-ghost btn-sm` cells, `btn-primary` for the selected day, an outline for today, muted days outside the month), working in light and dark. The button has an accessible name ("Pick a date") and a `lucide-react` `Calendar` icon.
- Future dates stay allowed, as now (no `maxValue`).
- `EntryTimeChip` already shows the field inside a popover: the calendar opens as a nested popover above it, and closing the calendar doesn't close the chip's popover or commit early (the chip commits when its own popover closes).
- No new dependencies (`react-aria-components` has `DatePicker` and `Calendar`).

**Acceptance criteria.**

- [ ] In the timeline's symptom sheet at 420×900, tapping the calendar button opens a calendar on the field's current month; picking a day changes the date, keeps the time, and closes the calendar. Saving stores that date (check the row's day header).
- [ ] Typing in the segments still works, and the calendar opened afterwards shows the typed date.
- [ ] By keyboard: Tab reaches the button, Enter opens the calendar with focus on the selected day, arrow keys move, Enter picks, Escape closes it and returns focus to the button.
- [ ] On the entry page, a writer changes an entry's date through the time chip's calendar; the chip's popover stays open until Done, and the new time is saved once.
- [ ] Edit an existing symptom: the calendar opens on that entry's date, not today's.
- [ ] Light and dark screenshots of the open calendar at 420 and 1280.

**Browser check.** Add steps to `roundtrip.mjs` (pick a date in the add sheet and check the saved day) and to `live-notes.mjs`'s time chip step (pick a date through the calendar). Before hand-off, run those two and `phase2.mjs` once.

**Blocks:** none. **Blocked by:** none.

---

## Slice 7: Group settings renders blank in `routing.mjs` (B-27)

**Problem.** `routing.mjs`'s "group settings opens under the group route" step fails on a quiet machine (load about 13): after the entry step, `c.goto(/app/groups/<id>/settings/members)` renders no `main` and no `window.caretookSync`. The only console line is Vite's "Failed to send error to Vite server: TypeError: Cannot read properties of undefined (reading 'send')", which hides the real error. It doesn't reproduce in a standalone script (sign in, open the same seeded note, then settings), so it depends on the check's earlier state: its proxy browser, or the entry page it just left. Other runs failed "Account's Sign out signs out", "/app/settings then asks to sign in", "caretaker: timed out waiting for `ol > li`" right after the members step, and once a `TypeError: Illegal invocation` on "offline: Quick add → Symptom opens the sheet". The backlog item's notes have each run.

Also from routing's open issues: `app-shell.mjs`'s "goes to the last group after a reload" step reads `window.caretookSync.userId` right after a reload, before it exists, and can throw.

**Build.**

- **Surface the real error first.** Capture uncaught errors and rejections in the page before Vite's overlay swallows them (`Runtime.exceptionThrown` and `Log.entryAdded` in `cdp.mjs`, if it doesn't already collect them), and print them, with the URL and `main`'s HTML, when a step fails. Keep that in `cdp.mjs`, so every check gets it.
- **Reproduce** with `routing.mjs` alone against a freshly started dev server, then narrow it down: run the steps before the failure one at a time, and with and without the proxy browser.
- **Fix the root cause** where it is. If it's in the app (for example the group route's middleware, `setGroup`, the settings frame, or a live query or Yjs doc still open from the entry page), keep the fix small, add a unit test if the cause is in a pure module, and list every app file in the hand-off. If it's in the check, fix the check. Don't fix it by adding waits or retries.
- Look into the "Illegal invocation" and the sign-out failures the same way. If they turn out to have other causes, fix them if they're small, or note them on B-27 for another slice.
- In `app-shell.mjs`, wait for `window.caretookSync` (and its `userId`) after the reload before reading it.

**Acceptance criteria.**

- [ ] The hand-off names the root cause, with the captured error that showed it.
- [ ] `routing.mjs` passes 3 runs in a row on a quiet machine (load under about 40, AGENTS.md's threshold; show `uptime`), against a freshly restarted dev server, and once against a server that has been running other checks for at least 10 minutes.
- [ ] A failing step now prints the page's uncaught errors (show one, for example from a deliberately broken step you then revert).
- [ ] `app-shell.mjs` passes, and its reload step waits for `window.caretookSync`.

**Browser check.** `routing.mjs` and `app-shell.mjs`, through `pnpm prd browser`. Before hand-off, also run the checks for any app area the fix touched (AGENTS.md, _Browser check budget_).

**Blocks:** none. **Blocked by:** none.

---

## Slice 8: A practice's type can't change while clinicians point at it (B-35)

**Problem.** A clinician's `practice_id` must point at a live practice or pharmacy in the same group. That's checked when the clinician is saved, but not when the practice changes: `providerService.update` lets a practice become a clinician or `other` while clinicians still name it, which leaves them pointing at something that isn't a practice. The device's local update (`lib/sync/providers.ts`) allows the same.

**Build.**

- **Refuse it.** `providerService.update`: when the type changes from `practice` or `pharmacy` to a type that isn't a practice type, and any live provider in the group has it as `practiceId`, return a new 400 error `providerService:practiceInUse` with an issue on `type`: "Clinicians are linked to this practice. Move them to another practice first." Changing between `practice` and `pharmacy` stays allowed. Check inside the update's transaction.
- Deleted providers that still point at it don't count.
- **The same rule on the device**: the local update in `lib/sync/providers.ts` refuses the change with the same message and issue, using the `refuse(…)` pattern beside `badPractice`, so the edit sheet shows it as a field error the way it shows other validation errors. Without that, the upload would be rejected and the change would silently revert on the next sync. If the sheet needs a change to show the error on `type`, keep it to that.
- The sync upload already maps service 4xx errors to rejections; no change there.
- Out of scope: what happens to clinicians when a practice is deleted (note it in the hand-off if it looks wrong).

**Acceptance criteria.**

- [ ] Integration test: a practice with a live clinician can't become a clinician or `other` (`providerService:practiceInUse`, issue on `type`); it can become a pharmacy; once the clinician moves to another practice or is deleted, the change goes through.
- [ ] Integration test through `sync.upload`: the same refused PATCH is acknowledged as rejected.
- [ ] Unit or integration test for the device's local update refusing it, if `lib/sync/providers.ts` has a test seam; otherwise the browser criterion below.
- [ ] In the provider sheet, changing the seeded practice's type shows the message on the type field and saves nothing (one manual run with a screenshot, or a step in `providers.mjs` if it's cheap).
- [ ] `pnpm check` passes.

**Check.** Integration tests. No browser check needed beyond the optional `providers.mjs` step.

**Blocks:** none. **Blocked by:** none.

---

## Slice 9: Independent integration tests (B-36)

**Problem.** `packages/data/src/services/careGroup.int.test.ts` builds one group and its users in a top-level `beforeAll`, and its `describe` blocks share and change them (the membership rules change roles; the invites block reads the same group). A test can only pass in file order, a failing test can break the ones after it, and `it.only` or a reorder gives false results. The other integration files already build their own fixtures (`provider.int.test.ts`'s `setup()`), and AGENTS.md's _Next steps_ asks for this before covering every role against every table.

**Build.**

- Replace the shared `beforeAll` state in `careGroup.int.test.ts` with a `setup()` per test (or per `describe` block for read-only blocks), built from `test/fixtures.ts`, as `provider.int.test.ts` does. No module-level `let`.
- Check the other `*.int.test.ts` files for the same pattern (state shared across blocks, or tests that depend on an earlier test's writes) and fix any you find.
- Keep every assertion: the number of tests and what each checks stay the same. If a test only passed because of an earlier test's writes, make its setup explicit.
- If fixtures need a helper (for example a group with one member per role), add it to `test/fixtures.ts`.
- Test files and `test/` only: no app or service code changes. If a test turns out to hide a real bug, note it on B-36 and leave the fix for another slice.

**Acceptance criteria.**

- [ ] No `*.int.test.ts` keeps mutable state across `describe` blocks (show the grep).
- [ ] Each `describe` block in `careGroup.int.test.ts` passes alone (`-t "<block name>"`), and the file passes with its blocks reversed (try it locally, then put the order back).
- [ ] Same test count before and after (show both).
- [ ] `pnpm test:integration` and `pnpm check` pass, and the run time hasn't grown by more than about 20%.

**Check.** The integration suite. No browser checks.

**Blocks:** none. **Blocked by:** none.

---

## Slice 10: Lean browser checks (B-39)

**Problem.** Browser checks are still most of the time a change takes. `5804ae4` cut how many run (`pnpm prd browser --changed`, one retry on contention, four leases), but each check is still long: `phase2.mjs` has 107 steps and `app-shell.mjs` 98, and `routing.mjs`, `providers.mjs` and `live-notes.mjs` are close behind. Many steps assert pure logic that now has unit tests (filter URLs, day labels, `appUrls`, menu models, member sorting, contact links), so a browser runs them again at a minute a check. And after a merge, an orchestrator only needs to know the area still works, not every edge.

**Build.**

- **Move pure-logic assertions to unit tests.** For each of `phase2`, `app-shell`, `routing`, `providers` and `live-notes`: list the steps that check something a pure module decides (the URL a filter link builds, a label's text, an ordering, a role's allowed actions). Where the module's unit test already covers it, delete the step; where it doesn't, add the case to the unit test first, then delete the step. Keep a step when it checks wiring the unit test can't see (that the link is actually on the page, that tapping it navigates).
- **Keep checks to user flows:** sign in, do the thing, see the result, across roles, offline and two devices. Collapse steps that differ only in data (several vitals, several menus) into one representative case, unless the difference exercises different code.
- **A smoke mode.** Each check reads `SMOKE=1` and runs only its core path (target about 20 s: one role, one happy path, no offline, no second device). `pnpm prd browser --changed --smoke` passes it through, and AGENTS.md's after-merge step uses it; hand-offs and landings keep full mode. Mark which steps are smoke with a small helper in `cdp.mjs` (e.g. `step(name, { smoke: true }, fn)`), not by copying flows.
- Don't change what the checks prove at landing: everything removed must be covered by a unit test or another remaining step. List each removed step and where it's now covered in the hand-off.
- Update `scripts/loops/check-areas` if a check is split or renamed, and AGENTS.md's check descriptions (the orchestrator folds them in at landing).

**Acceptance criteria.**

- [ ] For each of the five checks: steps before and after, run time before and after (same machine, quiet), and the list of removed steps with where each is now covered.
- [ ] Every new unit test case passes in `pnpm check`.
- [ ] Each check's full mode passes 2 runs in a row; its smoke mode passes and takes 30 s or less.
- [ ] `pnpm prd browser --changed --smoke` runs smoke mode; without `--smoke` it runs full mode.
- [ ] The full suite's run time drops by at least a third (show both tables).

**Check.** The five checks, full and smoke, through `pnpm prd browser`. `pnpm check` passes.

**Blocks:** none. **Blocked by:** `components` wave 2 in `dev` (it reworks the same screens and checks).

---

## Slice 11: The production build behaves like dev (B-38)

**Problem.** `pnpm prd serve --built` serves a production build of the web target (with `VITE_CHECK_BUILD=1`, which keeps the checks' `window.caretookSync` and `window.caretookModules` hooks). On 2026-11-18, in a throwaway worktree, `sign-in.mjs` and `roundtrip.mjs` passed against it, but:

- `providers.mjs` failed "a deleted provider's URL is the 404, with no names": `main` was missing and the body was empty, a blank page instead of "Not found";
- on its retry it failed "a viewer gets no Add; …/providers/new and …/:id/edit show the list with no form": the viewer stayed on `…/providers/new` instead of being sent to the list;
- `phase2.mjs` failed "no console errors or warnings" on `[viewer console.warning] [PowerSync]: Sync aborted`.

Both checks passed against the dev server minutes later, from the same code. So either the production build has real bugs on these paths (a 404 thrown from a client loader, a guard's redirect, PowerSync teardown), or the checks depend on dev-server timing. Real users get the production build, so find out which. Until this is fixed, checks run on the dev server, and the build mode's benefits (no Vite websocket, no dependency re-optimization reloads, no stale deps, faster pages) are out of reach.

**Build.**

- Reproduce each failure with `pnpm prd serve --built` and the single check (`pnpm prd browser providers`, `pnpm prd browser phase2`), and by hand in a browser against the built server. React's production errors are minified: capture them with `cdp.mjs`'s `page.uncaught`/`diagnose()`, and decode them, or build with source maps (`build.sourcemap`) for this investigation only.
- **Fix the root cause where it is.** If the app behaves differently in production (an error boundary that renders nothing, a redirect thrown in a way the production router handles differently, a missing chunk for a lazy route), fix the app and add a unit test if the cause is in a pure module. If it's the check (a step that relied on dev-server timing or Vite's slower module loading), fix the check to wait on what it means, never with a fixed sleep.
- For "Sync aborted": decide whether it's expected when a page closes or signs out mid-sync. If so, have the checks ignore exactly that warning when the step closes the page (as they ignore other teardown noise); if not, fix the teardown.
- Then run every check in the suite against the built server once (`pnpm prd serve --built`, then `pnpm prd browser --suite`), and fix anything else that differs from dev in the same way.
- **Make the build the default for checks** once the suite passes on it twice in a row: `pnpm prd browser` starts or rebuilds a `--built` server when the worktree's server is the dev server or isn't running (keep `--dev` to opt out), and update AGENTS.md (_Browser check budget_: "Check builds", the landing step's server restart, _Gotchas_ entries the build makes unnecessary such as Vite re-optimization and stale optimized deps). The orchestrator folds the AGENTS.md wording in at landing.

**Acceptance criteria.**

- [ ] The hand-off names the cause of each of the three failures, with the evidence (the decoded error, or the timing the check depended on).
- [ ] Against the built server, `providers.mjs` and `phase2.mjs` pass 3 runs in a row on a quiet machine (load under about 40), and the full suite passes twice in a row.
- [ ] By hand on the built server: a deleted provider's URL shows "Not found" with no names; a viewer opening `…/providers/new` lands on the list.
- [ ] The full suite's run time on the built server versus the dev server, same machine (both tables).
- [ ] Checks run against a built server by default, rebuilt when the source changes; `--dev` still works.

**Check.** The full suite on the built server, through `pnpm prd browser --suite`. `pnpm check` passes.

**Blocks:** none (slice 10 benefits from it). **Blocked by:** none.

---

## Slice 12: `/app` stays blank after a full reload (B-41)

**Problem.** In `app-shell.mjs`'s last-group steps, a full load of `/app` (`A.goto("/app")`, right after the page was on a group's timeline) leaves the page with no `main` and an empty body for 20 s, and no uncaught errors (`page.diagnose()`). It failed 4 of 5 runs during quick-fixes waves 3 and 4, at load 6–30, at either "/app: goes to the last group after a reload" or "/app: a stale remembered group falls back to the list". It isn't a check race: waiting for `GroupMenu`'s `rememberGroup` write before the check overwrites `caretook:lastGroup` didn't change it. An empty body (not even the frame) means the root never rendered or hydration never finished, so suspect what runs before first render on a full load: the /app layout's `clientMiddleware` (`requireSession`, `openSync`), `waitForFirstSync`, `/app`'s loader and its `resolveHomeGroup` redirect, or the previous page's database still holding a lock (OPFS/IndexedDB, a shared worker) when the new page opens it. Seen on the dev server only, so far.

**Build.**

- **Reproduce** with `app-shell.mjs` alone, then narrow it to a small throwaway script: sign in as member@, open Dev Family 2's timeline, full-load `/app`, repeat. Record what's pending when it hangs: the network (requests that never finish), the HTML that was served (is the body empty from the server, or emptied on the client), `Runtime` evaluation of where hydration stopped (`window.__reactRouterContext`, React Router's state), PowerSync's and the database's open state, and the Vite log.
- **Fix the root cause where it is.** If it's the app (a promise the middleware or loader awaits that never settles, a lock, a redirect thrown during hydration), keep the fix small and in the module that owns it, add a unit test if the cause is in a pure module, and list every app file in the hand-off. If it's the check, fix the check to wait on what it means. No added waits, retries or longer timeouts as the fix.
- If the cause is in sync teardown or PowerSync's "Sync aborted" warning, coordinate with slice 11, which owns that warning: note it on B-41 and keep your change to startup.

**Acceptance criteria.**

- [ ] The hand-off names the root cause, with the evidence that showed it.
- [ ] `app-shell.mjs` passes 5 runs in a row on a quiet machine (load under about 40), against a freshly restarted dev server.
- [ ] The throwaway reproduction (sign in, open a group, full-load `/app`, 20 times) never hangs after the fix, and did before (show both counts). Delete it before committing.
- [ ] `pnpm check` passes.

**Check.** `app-shell.mjs` through `pnpm prd browser`, plus the checks for any app area the fix touched (AGENTS.md, _Browser check budget_).

**Blocks:** none. **Blocked by:** none.

---

## Slice 13: The app header uses the brand (B-42)

**Problem.** The marketing site (in `dev` since its slices 1–2) has the draft brand: `LogoMark` (a heart with a check in a rounded square, drawn inline so it follows the theme's `primary`) and `Wordmark` (the mark plus "Caretook"), in a header with a bottom border, a translucent background with a blur, and a 64 px height. The app's header (`routes/app/layout/route.tsx`) still shows "Caretook" as plain text with a shadow, so going from caretook.com to Sign in to `/app` looks like two products. The favicon and touch icons are already shared (`root.tsx` links them for both targets); the header isn't.

**Build.**

- **One copy of the brand.** Move `LogoMark` and `Wordmark` from `routes/marketing/layout/Logo.tsx` to a new `components/brand/` folder with an `index.ts` (two routes now use them: AGENTS.md's rule for `components/`). The index imports nothing else, so the marketing pages and the app shell stay light, and marketing still imports nothing from `routes/app/` or `lib/sync/`. `Wordmark` takes an optional prop to hide the word visually below a breakpoint (the mark stays). The marketing header and footer import from the new folder; nothing about them changes.
- **The app header's `group` region:** the Caretook link shows `Wordmark` instead of plain text. On group routes below `sm` it shows the mark only (the word is screen-reader text), so the mark, `GroupMenu`, the sync indicator and the avatar still fit one row at 420. Outside a group (`/app`, `/app/settings`) and from `sm`, mark and word. The link's accessible name stays "Caretook" (`app-shell.mjs` finds it as the region's first link).
- **The header's look**, as far as it fits the app: a `border-b border-base-300` in place of `shadow-sm`, `bg-base-100/95` with `backdrop-blur`, and the marketing header's 64 px height (`h-16`, `min-h-16` on the daisyUI navbar), with its side padding (`px-4 sm:px-6`). Full width, not the marketing `max-w-5xl` (the app's screens are wider). Light and dark both follow the theme tokens.
- **Not sticky.** The timeline's day headers stick at the top of the page, and a sticky app header would take 64 px of a phone screen on every scroll. Keep the header in the flow, as now.
- **Not carried over:** the marketing nav links, Join the waitlist, and the marketing disclosure menu. The app has its own regions (sections nav, sync status, the account menu), and those stay as they are; `components` slice 6 moves them onto the primitives later.
- Add a `check-areas` rule: `apps/web/app/components/brand/*` → `app-shell marketing`.
- **Hot file:** `routes/app/layout/route.tsx` (the `/app` frame) is also on `components` slice 6's list. Keep this edit to the `group` region's link and the `<header>`'s classes, so that slice merges past it.

**Acceptance criteria.**

- [ ] The app header shows the logo mark and "Caretook" on `/app` and `/app/settings` at 420 and 1280, and on group routes from `sm`; on a group route at 420 it shows the mark only, and the header is one row (`app-shell.mjs`'s 420 step passes).
- [ ] The mark follows the theme: light, dark, and System on a dark device (screenshots of the header at 420 and 1280 in light and dark, next to the marketing header for comparison).
- [ ] The header has the border, translucent background and 64 px height, and isn't sticky (the timeline's sticky day headers still stick at the top: `phase2.mjs` passes).
- [ ] The marketing pages look the same as before (`marketing.mjs` passes; a screenshot of its header).
- [ ] Tapping the logo still goes to `/app` and then the last group (`app-shell.mjs`).
- [ ] The native build (`pnpm build:native`) shows the same header.

**Check.** `pnpm prd browser --changed` (it picks `app-shell`, `marketing` and `phase2` for these files). `pnpm check` passes.

**Blocks:** none. **Blocked by:** none (marketing slices 1–2 are in `dev`).
