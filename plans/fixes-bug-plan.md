# Plan: Fixes (bug)

Small bug fixes: wrong behaviour or data. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-bug`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**Hand-off (2026-11-22, after the wave 2 landing; no slices in flight).** Wave 1 landed as 7a205be1 (PR #46). **Wave 2 (slices 13–17, all on opus) landed in dev through PR #52** (dev 4f94740): full check passed on 99023ba (557/557, quiet machine, after 7 earlier runs failed on load flakes only; flakes filed B-489–B-502), Codex clean on 608a759, tooling 47/47, browser `--changed` 8/8; lean `--suite` was skipped (said in the report). Report: ask a39; to-test `to-test/2026-11-22-0812-fixes-bug.md`. Docs folded (todos, search, app-shell, care-groups; all at ~10.2 KB, trim when adding). B-450 stopgap (roles test 60 s timeouts) landed with it; the query fix stays on B-450.

**Wave 3 (slice 18, B-510) landed in dev through PR #57** (2026-11-22). `pnpm prd check` takes no reason (only `--quick` does).

**Wave 4 (slices 19–27, B-527, B-578, B-580, B-581, B-591, B-599, B-601, B-602, B-605, all on opus) landed in dev through PR #100 as b97b5d69** (2026-11-23): `components` CI green on 336578d3 (run 45131667111), Codex clean, browser `roundtrip` and `ui` passed; lean `--suite` not run (the user's standing rule: ask first). To-test: `to-test/2026-11-23-0247-fixes-bug.md`. Docs folded (assistant, ui-kit, todos, connectors; all at the 10 KB line, trim when adding). Slice worktrees removed.

**Wave 5 (slices 28–31, B-628, B-632, B-634, B-635, all on opus) landed in dev through PR #102 as a04034ec** (2026-11-23): `integration` CI green on de1b975c (run 45140076884), quick check on 039ea84f, Codex clean on 039ea84f; `browser --changed` needs none. To-test: `to-test/2026-11-23-0359-fixes-bug.md`. Docs folded (`assistant.md`, exactly at its 10 KB budget: trim when adding). Slice worktrees removed. Known limit left as is: `finished 2nd at the race` reads as a day.

**Wave 6 (slices 32–34, B-644, B-643, B-641, all on opus) landed in dev through PR #105 as a235304c** (2026-11-23): `integration` CI green on d7dab0c5 (run 45147868591), quick check and Codex clean on d7dab0c5; `browser --changed` needs none. To-test: `to-test/2026-11-23-0442-fixes-bug.md`. Docs folded (`assistant.md`, at its 10 KB budget: trim when adding). Slice worktrees removed.

**Wave 7 (slices 35–37, B-648, B-647, B-646, all on opus) landed in dev through PR #108 as bdff2e8** (2026-11-23): `integration` CI on 943a1b2c was `flake` (run 45155090185; only `scripts/loops/lease.test.mjs`, not this branch's, filed as B-654), quick check and Codex clean on 943a1b2c; `browser --changed` needs none. To-test: `to-test/2026-11-23-0529-fixes-bug.md`. Docs folded (`assistant.md`, at its 10 KB budget: trim when adding). Slice worktrees removed.

**Wave 8 (slices 38–39, B-651, B-652, both on opus) landed in dev through PR #109 as c1c5b0bf** (2026-11-23): `integration` CI on 53ab862c was `flake` (run 45159391173; only `scripts/loops/lease.test.mjs`, not this branch's, noted on B-654), quick check on 53ab862c, Codex clean on b29e187; `browser --changed` needs none. To-test: `to-test/2026-11-23-0558-fixes-bug.md`. Docs folded (`assistant.md`, exactly at its 10 KB budget: trim when adding). Slice worktrees removed.

**Wave 9 (slice 40, B-655, on opus) landed in dev through PR #111 as ce672f1a** (2026-11-23): `integration` CI green on 221fc48b (run 45165557565; `lease.test.mjs` quarantined and passed), quick check and Codex clean on 221fc48; `browser --changed` needs none. To-test: `to-test/2026-11-23-0633-fixes-bug.md`. No doc fold: `assistant.md` already states the rule. Slice worktree removed.

**Hand-over (after the wave 9 landing; no slice in flight).** **Next wave:** `pnpm prd sync`, ingest, then plan any new triaged item. **Held:** recheck `pnpm backlog prd list` for B-615 and B-616 (dose-accuracy holds `timelineEntryService.ts`, `assistantActionService.ts`) and B-620 and B-631 (ui-kit-5 holds `routes/app/groups/timeline/`; B-620's fix is user-approved, see its note).

**Waiting (2026-11-23, resumed after an interruption; git matched this Status).** Synced with dev, inbox empty, no slice in flight, no wave 10 yet. All four waiting items are still held: B-615 (`assistantActionService.ts`) and B-616 (`timelineEntryService.ts`) by dose-accuracy, on its wave 4; B-620 (`timeline/DayHeader.tsx`) and B-631 (`timeline/pass/PassLogForm.tsx`) by ui-kit-5, on its wave 3. Both orchestrators were asked to message this session when they land, and a background watch exits when either row leaves `running`. **Next:** when one clears, `pnpm prd sync`, ingest, and write wave 10 from the items it freed. **Order from dose-accuracy's orchestrator:** B-615 can go once its wave 4 lands; B-616 waits for its wave 5 (slice 6, B-614 and B-627), which changes the same dose upsert in `timelineEntryService.ts`. It will message at both landings; its row stays `running` until then, so the watch won't fire for wave 4.

**Wave 10 (slices 41–42, B-620, B-631, both on opus):** ui-kit-5's last wave landed as a5ec12da, which frees the timeline files; synced as 7f2e8685. B-615 and B-616 stay held as above. Slice 41 merged (slice check passed on c957fd24); its worktree stays until the wave is green. At landing, fold into `docs/domain/care-periods.md`: a day header counts to its own viewer-zone date. New item B-656 (a period starting just after midnight in the recipient's zone shows day 1 on two headers for a viewer behind that zone) waits for a later wave. Slice 42 merged (slice check passed on 09f40ff6); its worktree stays until the wave is green. New item B-657 (after a successful Add a medication, Back loses unsaved dose edits without asking) waits for a later wave. Synced as 7ab994fc (brings migrations 0039 and 0040; database reset): quick check passed, `components` CI green (run 45221463090). Slice worktrees removed; `care-periods.md` folded. `browser --changed --base dev` (roundtrip, ui) passed on c617e7f5 (don't rerun). Synced again as c3d6f826 (dose-accuracy wave 4, no migration): quick check passed, `components` CI green (run 45227226270). **PR #124 is open. Rotated here for context (no slice in flight). Next:** `pnpm prd review fixes-bug --wait` in the background, triage, then `pnpm prd land fixes-bug --tier components -m "fix(fixes-bug): day headers never repeat a care period day, Back asks after a refused action (B-620, B-631)"`. No Status commit between the review and the landing: it moves the PR's head. Land's report names Codex's verdict; the report text covers B-620, B-631 and the follow-ups B-656, B-657. The tier command reads files from stdin: `git diff --name-only dev...HEAD | node scripts/loops/check-plan.mjs --propose --repo "$PWD" --base dev --head HEAD`.

**Wave 10 landed in dev through PR #124 as 07529c63** (2026-11-23): `components` CI green on c3d6f826 (run 45227226270). **Codex did not review it** (out of credits, `--no-review`). Report: ask a151. To-test: `to-test/2026-11-23-1235-fixes-bug.md`. Docs already folded (`care-periods.md`). **Next session:** `pnpm prd sync`, ingest, recheck hot files, then write wave 11 from the triaged items: B-615, B-656, B-657, B-659, B-662, B-666, B-675, B-689, B-690.

**After wave 10:** B-616 moved to dose-accuracy slice 6 (recorded in the backlog on the user's word): dropped from this plan. **B-615** goes in wave 11: dose-accuracy's wave 4 landed as 30b6685a, and its orchestrator cleared `assistantActionService.ts` and `timelineEntryService.ts` for it, but asks that no one touch the `timelineEntryService` upsert until its wave 5 lands (it will message). Also waiting for wave 11: B-656 and B-657.

**Wave 11 (slices 43–48, B-656, B-657, B-659, B-662, B-666, B-675, all on opus):** resumed after an interruption; git matched this Status, no slice in flight, already synced with dev (fa432c69). **Held for a later wave:** B-615 (dose-accuracy's wave 5 is still changing the `timelineEntryService` upsert; it will message), B-689 and B-690 (member-avatars holds `routes/app/groups/planner/`). At landing, fold the B-659 consent rule into `calendars.md` and B-656 into `care-periods.md`; `calendars.md` is near its 10 KB budget, so trim when adding.

**Wave 11 progress:** all six slices merged; worktrees stay until the wave's verdict is green. Follow-up B-717 (consent refused on an old bundle). At landing also fold B-662 into `assistant.md` (_Doses_; at its 10 KB budget, trim). Browser: `roundtrip` is named by `carePeriodTrack.ts`; run `browser --changed --base dev`. Slice 44 changed the shared sheet guard: watch other sheets in the `components` run. Hand test for B-666: real password manager on join, link invite and email invite. **CI on 5850c33f (synced with dev; quick check passed): `file`, run 45241794955.** Three `providers.browser.test.tsx` tests (B-603, asking before losing ticks) are the branch's per blame (green on dev, run 45243680483); sent to slice 44's agent as a fix request, in flight: no rotation until it is merged and the wave is green. `pnpm datastore:reset` was refused by the permission classifier: use `pnpm datastore:migrate` (0041 from dev) before the browser checks. Follow-ups filed: B-717, B-718 (quick entry asks an amount on a skipped or refused dose). **Next wave:** B-615 is free (dose-accuracy wave 5 landed as 1b2723a2), but stay off the upsert's duplicate return and `mayRestoreDose` (dose-accuracy slice 7, B-627).

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need `export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"`; fresh stacks may need a PowerSync restart before sign-in/first-sync pass.

| Slice | Item  | State                                      | Merge    |
| ----- | ----- | ------------------------------------------ | -------- |
| 1     | B-310 | landed                                     | 6afc3f58 |
| 2     | B-312 | landed                                     | 233dd07d |
| 3     | B-314 | landed                                     | 8fa65e6f |
| 4     | B-315 | landed (first-sync at landing)             | 3dc2f3cd |
| 5     | B-317 | landed                                     | 7fb498ee |
| 6     | B-320 | landed                                     | a40b9713 |
| 7     | B-321 | landed                                     | c2605057 |
| 8     | B-322 | landed                                     | 59763904 |
| 9     | B-323 | landed (live-notes at landing)             | e7cb1d5e |
| 10    | B-385 | landed (resetStaging flake: B-466)         | 9736353b |
| 11    | B-386 | landed                                     | 1327d9bd |
| 12    | B-393 | landed (test only)                         | f9fb803b |
| 13    | B-318 | landed                                     | 61d7355f |
| 14    | B-382 | landed (todos.md at landing)               | 586cee75 |
| 15    | B-469 | landed (search.md at landing)              | 681f425b |
| 16    | B-470 | landed                                     | 7e65e0ab |
| 17    | B-472 | landed (+B-482; layout-offline at landing) | 3114a864 |
| 18    | B-510 | landed                                     | 5d096ce3 |
| 19    | B-527 | landed                                     | 04f5e825 |
| 20    | B-578 | landed                                     | 5d7cfdcf |
| 21    | B-591 | landed                                     | c177aa58 |
| 22    | B-580 | landed                                     | 330d9639 |
| 23    | B-581 | landed                                     | b0cd6f61 |
| 24    | B-599 | landed                                     | f8c90c02 |
| 25    | B-601 | landed                                     | efb9d552 |
| 26    | B-602 | landed                                     | 43e222d4 |
| 27    | B-605 | landed                                     | 23e69857 |
| 28    | B-628 | landed                                     | 46f779de |
| 29    | B-632 | landed                                     | 82eebf78 |
| 30    | B-634 | landed                                     | c2c53eee |
| 31    | B-635 | landed                                     | b1cf109f |
| 32    | B-644 | landed                                     | a4252709 |
| 33    | B-643 | landed                                     | ce9c55a2 |
| 34    | B-641 | landed                                     | 501a58bf |
| 35    | B-648 | landed                                     | 11820cae |
| 36    | B-647 | landed                                     | 3e6adea0 |
| 37    | B-646 | landed                                     | ce4d22b1 |
| 38    | B-651 | landed                                     | a447334a |
| 39    | B-652 | landed                                     | 7be34f48 |
| 40    | B-655 | landed                                     | 487cb235 |
| 41    | B-620 | landed (care-periods.md folded)            | ab9dcfae |
| 42    | B-631 | landed                                     | 2a479df8 |
| 43    | B-656 | merged (roundtrip at landing)              | a449f67c |
| 44    | B-657 | merged (sheets in components CI)           | 036a9fff |
| 45    | B-659 | merged (calendars.md at landing)           | 0a8ccfcc |
| 46    | B-662 | merged (assistant.md at landing)           | 8c930686 |
| 47    | B-666 | merged (needs a hand test)                 | 288e9cbe |
| 48    | B-675 | merged                                     | 3d8e9cf5 |

## Wave 1

Each item's backlog notes (`pnpm backlog show B-<n>`) carry the reviewer's file references; they came from a reading, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code.

### Slice 1: a deleted provider no longer stops a repeating series (B-310)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/appointments.md, docs/domain/providers.md · Tests: integration

Deleting a provider that a repeating appointment series names makes every top-up roll back with `providerNotFound` (`appointmentSeriesService.ts` links every `series.providerIds` to each new visit; `entryProviderService.ts` refuses a soft-deleted provider).

- Top-ups skip soft-deleted providers when linking a new visit; the series keeps topping up.
- Integration test: a series naming a provider that is then deleted still tops up, and the new visit links only the live providers.

### Slice 2: server note text catches up with the last updates (B-312)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/live-notes.md, docs/domain/sync.md · Tests: integration

Compaction runs only inside an upload that adds an update (20 pending or 60 s), so a note typed in under about 20 s keeps server `text` `''`; the connector's `list_timeline`/`upcoming` and search read only `text`.

- Readers of a note's text on the server get the current text when updates are pending (fall back to the merged current text, or compact on read), without changing the sync upload path (`packages/api/src/sync.ts` is another topic's hot file: leave it alone).
- Integration test: a note with a few pending updates and no compaction yet reads back its full text through the service the connector and search use.

### Slice 3: auth screens show the offline message instead of crashing (B-314)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/auth.md, docs/domain/components.md · Tests: component

Sign-in, reset-password and verify-email call `authClient` unwrapped, so offline they crash to the root error page; `requestFailure`'s offline branch (`lib/auth/authMessages.ts`) is unreachable. The invite and join routes already catch the `TypeError`: follow them.

- Each of the three screens catches a network failure and shows the offline message in place.
- Component tests: for each screen, a rejected `fetch` (`TypeError`) shows the offline message and no error boundary.

### Slice 4: a removed member's open screen loses access cleanly (B-315)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md, docs/domain/care-groups.md · Tests: component

`GroupProvider` (`lib/app-shell/group.tsx`) falls back to the first-loaded membership when the live row disappears, not the last row as its comment says, so write controls can come back.

- Keep the last-seen membership row while it's present; when it goes away (removed from the group), navigate to `/app` with a short "you no longer have access to that group" notice.
- Component test: a membership whose role is lowered then removed never shows the original role's write controls, and the removal lands on `/app` with the notice.

### Slice 5: another user's local leftovers are wiped at sign-in (B-317)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/auth.md, docs/domain/sync.md · Tests: unit

`lib/sync/client.ts` clears SQLite only on an owner mismatch; the forget list in `lib/auth/session.ts` (typed lines, recent searches, settings in `localStorage`) runs only at sign-out.

- On an owner mismatch, also run the forget list, so a different user signing in on the device sees none of the previous user's keys.
- Unit test: with a previous owner's keys in `localStorage`, an owner mismatch removes them; the same owner keeps them.

### Slice 6: safeRedirect refuses control characters (B-320)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/auth.md · Tests: unit

`lib/core/redirect.ts` accepts `'/\t/evil.com'` (and CR/LF), which browsers resolve to another site; verify-email's `<Link to={next}>` renders it.

- `safeRedirect` rejects any ASCII control character (and backslash, if not already), or resolves against a fixed origin and checks the origin stays the same.
- Unit tests: tab, CR, LF and backslash variants fall back to the default; ordinary in-app paths with queries and hashes pass.

### Slice 7: a refused delete tells the user (B-321)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/timeline.md, docs/domain/components.md · Tests: component

`UpcomingList` voids `removeEntry`, and `useEntryRemoval` never reads `remover.data`, so a refused delete (no permission, already gone) says nothing.

- A refused delete shows the error message the app uses elsewhere for a refused write, on the Planner and wherever `useEntryRemoval` is used.
- Component test: a delete the remover refuses shows the message and leaves the entry listed.

### Slice 8: the Planner lists mixed-zone entries in time order (B-322)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/appointments.md · Tests: unit

`lib/appointments/upcoming.ts` sorts by the entry's zone but groups by the viewer's, so entries in different zones can list out of order.

- Sort and group by the same instant/zone, so each day's items are in true time order in the viewer's zone.
- Unit test: two entries in different zones whose local wall times disagree with their instants list in instant order under the right viewer-zone day.

### Slice 9: a failed local note update keeps the typing (B-323)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/live-notes.md · Tests: unit

`lib/live-notes/notes.sync.ts` clears pending updates before the `note_update` insert, and its catch only logs, so a failed insert loses the rest of the session's typing.

- Clear pending only after the insert succeeds; on failure keep (requeue) the updates so the next flush retries them, without duplicating any that did go in.
- Unit test: a first insert that throws, then one that succeeds, writes every update exactly once.

### Slice 10: long-interval repeating todos keep going (B-385)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md · Tests: unit

`nextDueDay` (`packages/data/src/db/schema/appointments/todoRepeat.ts`) uses `nextVisits`' ~5-year horizon, so a valid rule like `FREQ=MONTHLY;INTERVAL=99` (the repeat sheet allows 99) reads as ended.

- `nextDueDay` finds the rule's next occurrence however far off (search with no horizon, `rrule.after`, bounded only by the rule's own end), so the chain continues.
- Unit test: `FREQ=MONTHLY;INTERVAL=99` and `FREQ=YEARLY;INTERVAL=99` give the right next day; a rule with `UNTIL`/`COUNT` still ends.

### Slice 11: a successor moved back onto its source's day doesn't end the chain (B-386)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md, docs/domain/sync.md · Tests: unit, integration

Blocked by slice 10 (same files). A successor moved back onto its source's day and ticked gets `nextTodoId(repeatId, that next day)` equal to its own id, so `insertNext` (server, `todoService.ts`) and the device's `planNext` (`lib/todos/todos.sync.ts`) see the row as the existing next and the chain silently ends.

- When the computed next id is taken by the source itself or a done occurrence, both sides move on to the following occurrence (or another deterministic id the two sides agree on), so device and server still write the same row.
- Unit test for the pure part; integration test (`todoRepeat.int.test.ts`): the moved-back-and-ticked successor gets a new open successor.

### Slice 12: "last Friday" monthly todos keep their ordinal through the Repeat sheet (B-393)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md · Tests: unit

Reopening Repeat on a "last Friday" monthly todo whose occurrence falls on a 4th Friday and pressing Done turns `BYDAY=-1FR` into `4FR` (`todoFormData` `initialRepeat` → `choiceOfRule`). B-234 (quick-fixes, now in dev) changed `choiceOfRule`/`choiceRule` (`lib/appointments/repeatChoice.ts`) to keep the ordinal and may have fixed this already.

- Confirm with a todo-side test through `todoFormData`; fix the path if it still drops the ordinal.
- Unit test: `BYDAY=-1FR` on a 4th-Friday occurrence round-trips unchanged through `initialRepeat` and back to a rule.

## Wave 2

As in wave 1: the items' backlog notes (`pnpm backlog show B-<n>`) carry the file references from a reading, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code.

### Slice 13: the header follows an easy-mode setting changed on another device (B-318)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: component

`routes/app/layout/useEasyFrame.ts` passes `cachedSettings(userId).easyMode` to `useEasyMode` once per render with no subscription, so a setting changed on another device (and synced or refetched into the cache) leaves the header in the old mode until the next navigation. The timeline reads the same input: check whether it has the same gap and fix both through one shared subscription.

- The header (and the timeline, if affected) re-renders when the cached settings change: subscribe to the settings cache (a `useSyncExternalStore` over the store `me.ts` already writes, or the existing change signal if there is one), not a poll.
- Component test: with the header rendered, a settings cache update that flips `easyMode` changes the header without a navigation.

### Slice 14: an offline Undo never deletes a successor another member changed (B-382)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md, docs/domain/sync.md · Tests: unit, integration

Undoing a tick on a repeating todo offline queues a plain `removeTodo` for the next occurrence (`lib/todos/todos.sync.ts`, around the reopen/undo path), and the upload applies it unconditionally, deleting a successor another member edited or completed meanwhile, although `todoService.reopen` on the server keeps an edited successor.

- An Undo's delete of the successor is told apart from an explicit delete (its own op or a flag on the upload), and the server applies it only when the successor is untouched (the same test `todoService.reopen` uses); an explicit delete is unchanged. Keep the upload switch edit additive (a shared registry).
- Integration test: an offline Undo uploaded after another member edited (and, separately, completed) the successor leaves it in place; one uploaded on an untouched successor still removes it.

### Slice 15: Easy search sheets show the row as it is now (B-469)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/search.md, docs/domain/components.md · Tests: component

`routes/app/groups/search/SearchResults.tsx` keeps the whole tapped item in `useState` (`opened`), so `EasyResultSheet` shows the values from the tap and misses edits or deletes (provider, medication, condition) that sync in while it's open.

- Keep only `{ type, id }` as the opened state and read the row from the refreshed search data (or a live query); when the row is gone, close the sheet or say it's gone.
- Component test: a synced edit while the sheet is open shows the new value; a synced delete closes it or shows the gone state.

### Slice 16: an Easy helper can't clear a writer's cancel or reschedule (B-470)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/timeline.md, docs/domain/care-groups.md, docs/domain/data-layer.md · Tests: unit, integration

`timelineEntryService.update`'s `refuseLoggerOnly` calls `canLogEntry` (`packages/data/src/db/schema/timeline/entryRules.ts`), which only checks that the setup fields are null, so an Easy helper sending `{ cancelledAt: null, cancelReason: null, rescheduledTo: null }` on their own event undoes a writer's cancellation or reschedule (update API and sync upload alike).

- On update, a logger-only role may not change any setup field from its existing value (clearing included); setting them stays refused as now. Create is unchanged.
- Unit test for the rule; integration test: the helper's update clearing a cancelled event's fields is refused through the service and through an upload, and an ordinary edit (title, body) still passes.

### Slice 17: an old queued simpleMode settings change upgrades instead of retrying forever (B-472, B-482)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md · Tests: unit

`lib/app-shell/me.ts` `readPending` returns the stored `caretook:settings-pending:<user>` payload as is; a change queued offline before the easy rename still has `simpleMode`, which `me.updatePreferences`' strict schema rejects and `clearPending` no longer removes, so it's resent forever and later queued changes merged into it (units, layout) are refused too.

- `readPending` maps a legacy `simpleMode` to `easyMode` (the same value conversion the rename used, e.g. `simple`→`easy`; drop values with no equivalent) and drops the old key before anything is sent or merged; the rewritten pending is stored back.
- Unit test: a pending payload with `simpleMode` plus another field sends the mapped `easyMode` and the other field, and is cleared after a successful send.

## Wave 3

As before: the item's backlog note (`pnpm backlog show B-<n>`) carries the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code.

### Slice 18: a viewer's Undo delete is refused, not reported as applied (B-510)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md, docs/domain/care-groups.md · Tests: unit, integration

`packages/data/src/services/todoService.ts` `removeUndoneNext` (the flagged Undo delete of a repeating todo's successor, from wave 2's B-382) returns `'applied'` on its `!before?.repeatRule` early return before it checks `canCompleteTodo`, so a viewer's flagged delete reads as applied although nothing changes.

- Check the role first: a role that can't complete todos gets the same refusal as any other refused todo write, whatever the row's state; the untouched-successor logic is unchanged for roles that may.
- Test (integration where the service runs against the test database): a viewer's flagged Undo delete is refused, on a repeating and a non-repeating todo; a member's still applies as before.

## Wave 4

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Running topics hold `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `apps/web/app/routes/app/groups/timeline/` and `apps/web/app/lib/app-shell/me.ts`: no slice here edits them.

### Slice 19: a failed todo Done or Undo tells the user (B-527)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/todos.md, docs/domain/components.md · Tests: component

`TodoUndoStatus.undo` and `useTodoTick`'s `run` void their writes with no catch, so a write that throws is an unhandled rejection and the user sees nothing.

- Catch both writes and show the message the app uses for a refused or failed write. Keep the change inside `components/todos/`, so callers (`EasyTodos` in the timeline folder among them) need no edit.
- Component test: a Done and an Undo whose write throws show the message, raise no unhandled rejection, and leave the todo in its true state.

### Slice 20: quick entry stops reading measurements as dates (B-578)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

`quickEntryTime.ts` reads slash numbers such as `bp 12/8` and `pain 5/5` as dates. Fractions directly before a medication are already amounts (e4fde503).

- A slash number that follows a measurement word (blood pressure, pain and the other vitals and scales quick entry knows) is not a date. A real date (`appt 12/8`, `on 12/8`) still reads as one.
- Unit tests: `bp 12/8` and `pain 5/5` get no date; `gave 1/6 tylenol` stays an amount; `appt 12/8` keeps its date.

### Slice 21: a fraction after the medication is the amount (B-591)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/medications.md · Tests: unit

Blocked by slice 20 (same files). `isFractionAmount` (`quickEntry.ts`) only looks forward for the medication, so with a usual dose of 2 tablets, `gave tylenol 3/8` logs 2 tablets on March 8, while `gave 3/8 tylenol` logs 3/8 tablet now.

- On a dose line, a proper fraction with the same denominators directly after the medication is the amount, and the line gets no date.
- Unit tests: `gave tylenol 3/8` gives 3/8 tablet now; a dose line with a clear date word (`gave tylenol on 3/8`) keeps the date and the usual dose.

### Slice 22: "she sat" is not Saturday (B-580)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

Blocked by slice 21 (same files). The end-of-line rule dates a line ending in `sat` to Saturday, so `she sat` gets a date. The item also notes that `dr lee the 2nd at the clinic` gets no date.

- A trailing `sat` used as a verb (after a pronoun or a person's name) is not a day; `appt sat` and `on sat` still are. Fix the `the 2nd` case if it is the same rule; otherwise say so in the hand-off.
- Unit tests: `she sat` has no date; `appt sat` and `on sat` keep Saturday.

### Slice 23: "in the morning" ahead stays a todo (B-581)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/todos.md · Tests: unit

Blocked by slice 22 (same files). With no day said, the usual hour reads back to yesterday, so `call the pharmacy in the morning` becomes a 7:00 note instead of a todo. `at 12 this morning` resolves to midnight with no test row.

- A line that asks for something to be done, with a part of day and no day said, is a todo for the next such time. A line reporting what happened (`slept badly in the morning`) stays a note.
- Unit tests: both of those lines, plus a row that pins what `at 12 this morning` resolves to.

### Slice 24: Assistants labels follow a read-only change (B-599)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/components.md · Tests: component

On `routes/app/groups/settings/assistants/route.tsx` the toggle and status follow by sync, but row labels come from `connector.listForGroup` and refresh only on the next load, so they go stale when another owner flips read only.

- Row labels follow the synced value while the page is open, by deriving them from it or refetching when it changes.
- Component test: a synced read-only change updates the connection labels with no navigation.

### Slice 25: Back after a failed sheet save still asks (B-601)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md · Tests: component

`components/ui/useSheetChanges.ts`: submit sets `leaving.current` and only a later pointer, key, input or change clears it, so Back right after a failed save skips the discard prompt and loses the edits.

- The bypass holds only for a successful save.
- Component test: Back after a refused save prompts and keeps the edits; Back after a successful save closes with no prompt.

### Slice 26: the discard prompt fires only for the user's own changes (B-602)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/sync.md · Tests: component

Blocked by slice 25 (same files). In `useSheetChanges` and `useSheetExit`: a sync after the first touch reads as a change, a record deleted elsewhere can prompt, Back with an unguarded sheet on top of a changed one doesn't ask, and under reduced motion the discarded flag may not reset on a sheet that stays mounted (read from the code, not reproduced).

- Confirm each of the four with a test and fix those that reproduce; name any that doesn't in the hand-off.
- Component tests: one per confirmed case.

### Slice 27: PageUp and PageDown on the hour cross AM/PM (B-605)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component

`components/ui/date/DateTimeField.tsx`: the arrow keys were fixed in B-585, but PageUp and PageDown on the hour still wrap inside AM/PM, so 11 AM can page to 12 AM.

- PageUp and PageDown move the hour the way the arrow keys now do, crossing AM/PM correctly.
- Component test: paging across 11 AM to 12 PM and 11 PM to 12 AM, in both directions, gives the right time.

## Wave 5

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Running topics hold `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/lib/app-shell/me.ts` and `packages/data/src/db/schema/app-shell/userPreferences.ts`: no slice here edits them.

### Slice 28: two simultaneous preference saves both count (B-628)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md, docs/domain/data-layer.md · Tests: integration

`updatePreferences` (`packages/api/src/app-shell/me.ts`) reads the row and then writes it with no lock, so of two simultaneous requests changing different fields, one can be lost (a setup card dismissal, for one).

- Two simultaneous saves of different preferences both persist: make the read and write atomic (a transaction with a row lock, or a single atomic update), including when the user has no row yet. No migration, and no edit to `userPreferences.ts`; if the fix can't be done without one, stop and say so in the hand-off.
- Integration test: concurrent saves of different fields, on an existing row and on a first save, keep both changes.

### Slice 29: a fraction after a medication reads right in the odd cases (B-632)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/medications.md · Tests: unit

`quickEntry.ts`'s fraction rule (from B-591): an opening `no` counts as negating the dose, `take` counts as given, and a fraction equal to the medication's strength is read as a tablet fraction.

- `no pain gave tylenol 3/8`: the `no` belongs to the pain, so the fraction is the amount, with no date.
- `need to take tylenol 3/8`: not a report of a dose, so it keeps its date.
- `gave lorazepam 1/2` with a 0.5 mg strength: the fraction is the strength, so the usual dose, with no date.
- `gave tylenol 3/8 at 9pm` stays 3/8 tablet today at 9pm: pin it.
- Unit tests: one row for each line above.

### Slice 30: an ordinal before "at a place" is a day (B-634)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

Blocked by slice 29 (same files). `ordinalIsADay` (`quickEntryTime.ts`) doesn't read `dr lee the 2nd at the clinic` as a date.

- An ordinal day followed by `at <place>` is a day; `at <time>` keeps working as it does now. An ordinal that isn't a day (`the 2nd dose`, `2nd floor`) stays undated.
- Unit tests: those lines.

### Slice 31: requests with a part of day stay todos (B-635)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/todos.md · Tests: unit

Blocked by slice 30 (same files). The request rule from B-581 misreads `check bp 120/80 in the morning` (a note dated now, with a todo as the alternative) and `ask about pain in the morning` (a symptom first).

- Both lines read as a todo for the next morning first. A report (`bp 120/80 in the morning`, `pain in the morning`) stays as it is.
- Unchanged: `call dr lee in the morning` stays an event first, like `call dr lee tomorrow`. Request detection stays a word list; don't replace it.
- Unit tests: each line above.

## Wave 6

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Running topics hold `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `apps/web/app/lib/assistant/quickEntry.sync.ts` and `apps/web/app/routes/app/groups/timeline/`: no slice here edits them. All three slices share the quick-entry files in `packages/data/src/db/schema/assistant/`, so they run one after another.

### Slice 32: a counted ordinal before a place stays undated (B-644)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

`ordinalIsADay` (`quickEntryTime.ts`) skips only `the` before the ordinal, so `a` hides `gave`, and `COUNTED_AFTER` lacks `received`.

- `gave a 2nd at the clinic` and `received the 2nd at the clinic` get no day, so they log now.
- `dr lee the 2nd at the clinic` stays a day. `the 2nd dose` and `2nd floor` stay undated.
- Unit tests: one row for each line above.

### Slice 33: a request with a day leads with the todo (B-643)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/todos.md · Tests: unit

Blocked by slice 32 (same files). The cause isn't traced yet. `check bp 120/80 tomorrow` and `ask about pain tomorrow morning` lead with a vital or symptom dated ahead, and the second's todo has no due time.

- Both lines read as a todo first, due that day; `tomorrow morning` also carries the morning's due time.
- A report stays as it is (`bp 120/80 tomorrow`, `pain tomorrow morning`). Request detection stays a word list; don't replace it.
- Unit tests: one row for each line above.

### Slice 34: a fraction with "mg" at the medication's strength is the usual dose (B-641)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/medications.md · Tests: unit

Blocked by slice 33 (same files). `gave lorazepam 1/2 mg` at a 0.5 mg strength may not record the usual dose; the amount it records was never confirmed, so this one may not reproduce.

- If it's wrong: the line records the usual dose, with no date. `gave lorazepam 1/2` keeps working as it does now.
- Unit test: that line at a 0.5 mg strength, kept whichever way the confirmation goes.

## Wave 7

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Running topics hold `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `apps/web/app/components/quick-entry/` and `apps/web/app/routes/app/groups/timeline/`: no slice here edits them. All three slices share the quick-entry files in `packages/data/src/db/schema/assistant/`, so they run one after another.

### Slice 35: a bare fraction at the strength doesn't overstate the dose (B-648)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/medications.md · Tests: unit

`gave lorazepam 1/2` at a 0.5 mg strength takes the usual dose whatever it is, so a usual `2 tablets` records 2 tablets. Slice 34 fixed the same case for `1/2 mg`; use its rule.

- With a usual `2 tablets`, the line keeps the typed amount and has no date.
- With a usual dose of one unit or the same measure (`1 tablet`, `0.5 mg`), the line still records the usual dose.
- Unit tests: one row for each line above.

### Slice 36: a request with a later day is a todo with its part of day (B-647)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/todos.md · Tests: unit

Blocked by slice 35 (same files). The part of day is read only after `tomorrow`, and a bare weekday reads back.

- `pick up walker next friday morning` is a todo due that Friday with the morning's due time, and `morning` leaves the title.
- `check bp 120/80 friday` leads with a todo due the coming Friday.
- A report stays as it is: `bp 120/80 friday` still reads back to the last Friday.
- `call dr lee tomorrow morning` stays an event first at 08:00; pin it.
- Unit tests: one row for each line above.

### Slice 37: a counted ordinal with no place stays undated (B-646)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

Blocked by slice 36 (same files). An ordinal at the line's end returns early as a day, and with no verb before the article nothing marks it as a count.

- `gave a 2nd` and `a 2nd at the clinic` get no day, so they log now.
- `dr lee the 2nd` and `dr lee the 2nd at the clinic` stay a day.
- Unit tests: one row for each line above.

## Wave 8

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Running topics hold `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `apps/web/app/components/quick-entry/` and `apps/web/app/routes/app/groups/timeline/`: no slice here edits them. Both slices share the quick-entry files in `packages/data/src/db/schema/assistant/`, so they run one after the other.

### Slice 38: a decimal at the strength doesn't overstate the dose (B-651)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/medications.md · Tests: unit

`gave lorazepam 0.5` at a 0.5 mg strength takes the usual dose whatever it is, so a usual `2 tablets` records 2 tablets. Slice 35 fixed the same case for a bare fraction (`amountAtStrength` in `quickEntry.ts`); use its rule.

- With a usual `2 tablets`, the line keeps the typed amount and has no date.
- With a usual dose of one unit or the same measure (`1 tablet`, `0.5 mg`), the line still records the usual dose.
- Unit tests: one row for each line above.

### Slice 39: a counted ordinal before a clock time stays undated (B-652)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

Blocked by slice 38 (same files). In `ordinalIsADay` (`quickEntryTime.ts`), a clock time after the ordinal marks a day before the counted-word check runs.

- `gave the 2nd at 2pm` gets no day of the month.
- `a 2nd at 2pm` stays undated.
- `dr lee the 2nd at 2pm` stays the 2nd at 2pm.
- Unit tests: one row for each line above.

## Wave 9

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Running topics hold `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `apps/web/app/components/quick-entry/` and `apps/web/app/routes/app/groups/timeline/`: no slice here edits them.

### Slice 40: a counted ordinal before a part of day stays undated (B-655)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

In `ordinalIsADay` (`quickEntryTime.ts`), the part-of-day branches may run without the counted-word check that slice 39 added for a clock time. This was read from the code and not run.

- `gave the 2nd at night` and `gave the 2nd in the morning` get no day of the month.
- `a 2nd in the morning` stays undated.
- `dr lee the 2nd in the morning` and `dr lee the 2nd at night` stay on the 2nd.
- Unit tests: one row for each line above.

## Wave 10

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. dose-accuracy holds `packages/data/src/services/timelineEntryService.ts` and `assistantActionService.ts`: no slice here edits them. ui-kit-5 changed `Menu`: it always applies a `buttonClass` look, and its `className` is outer classes only.

### Slice 41: consecutive day headers never repeat a care period day (B-620)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/care-periods.md, docs/domain/timeline.md · Tests: unit, component

`DayHeader` splits days in the viewer's zone (`dayKey`), but `DayPeriod` counts `periodDay` in the recipient's zone from a moment (now for Today, the newest row for a past day). Just after midnight Eastern with a Los Angeles recipient, Today and Yesterday both read `At home · day 6`. The user approved this fix: a day header counts from its own date.

- A day header's number is the period's start date in the recipient's zone to the header's `dayKey`, plus 1, minimum 1, so consecutive headers always differ by one.
- The period's page, the periods list and other "current" lines keep `periodDay` in the recipient's zone. Today's header reading one day ahead of them for a few hours around midnight is accepted.
- Check which period a header shows (`periodAt`) for the same offset. Fix it only if a test shows the wrong period; otherwise say what you found in the hand-off.
- Unit tests: the new day count, with the viewer and recipient in different zones, on both sides of midnight, and on the period's first day (never below 1).
- Component test: Today and Yesterday headers show consecutive numbers in the reported case.

### Slice 42: Back asks again after a refused action outside the form (B-631)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component

`useSheetChanges` ends its no-prompt bypass only for errors inside the submitted form. `PassLogForm` shows a refused Add a medication outside that small form, and the confirm path of a refused delete keeps the bypass, so Back can then lose the edits without asking. This was read from the code and not run.

- After a refused Add a medication in the pass log, Back with unsaved edits asks before discarding.
- After a refused delete from its confirm, Back with unsaved edits asks before discarding.
- A successful save, add or delete still leaves without a prompt.
- The 300 ms window in the item's second note is out of scope unless the tests above need it: name anything you find there in the hand-off.
- Component tests: one for each line above, beside `sheetGuard.browser.test.tsx`.

## Wave 11

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Running topics hold `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `apps/web/app/routes/app/groups/planner/`, `timeline/TimelineEntryRow.tsx`, `timeline/PassLogItem.tsx`, `timeline/TimelineFilters.tsx`, `apps/web/app/lib/sync/schema.ts` and `packages/data/src/errors/constants.ts`: no slice here edits them. If a fix can't avoid one, stop and say so in the hand-off.

### Slice 43: a header before a period's first day shows no day number (B-656)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/care-periods.md, docs/domain/timeline.md · Tests: unit, component

With the recipient in New York, a viewer in Los Angeles and a period starting 00:30 Eastern, the viewer's header for the date before the start and the header for the start date both read day 1, because `periodDayOn` has a minimum of 1.

- A header whose `dayKey` is before the period's start date in the recipient's zone shows the period without a day number. The start date stays day 1.
- Other uses of the day count keep their current text.
- Unit tests: the count on the date before the start, on the start date and on the day after.
- Component test: the reported case shows no number on the earlier header and day 1 on the start date.

### Slice 44: Back asks after a successful add that keeps the sheet open (B-657)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component

The add's submit keeps `useSheetChanges`' no-prompt bypass though the sheet stays open, so Back loses unsaved dose edits.

- After a successful Add a medication in the pass log with unsaved dose edits, the sheet stays open and Back asks before discarding.
- A save that closes the sheet still leaves without a prompt.
- A second refusal with the same text is still announced in `PassLogForm`. Name any other sheet with a side action that needs the same remount in the hand-off, and don't change it.
- Component tests: one for each line above, beside `sheetGuard.browser.test.tsx`.

### Slice 45: a consent records the wording the member saw (B-659)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/calendars.md, docs/domain/api.md · Tests: unit, integration, component

`update({ detailsConsent: true })` stamps the server's current `DETAILS_CONSENT_VERSION`, so a consent queued offline before a wording bump records a version the member never saw.

- Turning consent on sends the version the device displayed, in the request and in the persisted pending change.
- The server records consent only when that version is the current one. An outdated or missing version records nothing and returns a typed error from `errors/calendars.ts`.
- A pending change with an outdated or missing version, including one saved before this fix, is dropped on replay. The member sees the current wording and can agree again, and details stay off until then.
- Turning consent off needs no version and always works.
- Integration tests: current, outdated and missing version, and turning off. Unit test: the replay. Component test: the refused replay leaves the switch off with the current wording shown.

### Slice 46: quick entry asks for the amount when a bare number is the strength (B-662)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit, component

The user decided: when a bare number matches the strength and the usual dose is more than one unit, the caretaker chooses the amount instead of a guess. `gave lisinopril 10` at 10 mg with a usual 2 tablets records 2 tablets today.

- That case records no dose until the caretaker chooses. Use the way quick entry already asks for a missing detail; if there is none, open the dose's form with the amount empty and name that in the hand-off.
- A usual dose of one unit still records directly (B-651), and every other row in the B-648 and B-651 tests keeps its result.
- Replace the test named `a whole number at the strength still names it: the usual dose (B-648)`.
- Unit tests: 10 at 10 mg with a usual 2 tablets, with a usual 1 tablet, and with no usual dose. Component test: the caretaker is asked and the chosen amount is what's recorded.

### Slice 47: signing up offers to save the password (B-666)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/auth.md, docs/domain/care-groups.md · Tests: component

The cause isn't confirmed. The suspects are the email field's `autoComplete="email"` and a fetch submit that swaps the step without a navigation. The join and invite sign-ups have the same shape.

- On both forms, the email field is `autoComplete="username"`, the password stays `new-password`, and both are in one `<form>` with a real submit button.
- After a successful sign-up, the page changes in a way password managers detect, using the router's navigation if the step swap can't. Don't change what the member sees next.
- Component tests: the field attributes on both forms and the step after success.
- An agent can't drive a real password manager. Say in the hand-off that this needs a hand test, and name the browser steps.

### Slice 48: a repeated day jump keeps its reset after a sheet opens (B-675)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/timeline.md · Tests: unit, component

In `useTimelineData.ts`, a repeat jump ignores the old paging only while its marker is present and never saves the reset. A sheet link replaces the location state, so the old `before` and `limit` return under the sheet.

- Accepting a new jump persists the reset bound, limit and marker.
- Jump to a day, load newer, jump to the same day again and open an entry's edit sheet: the window and scroll stay put.
- Unit or component test: that sequence. A first jump and plain paging keep their behaviour.
