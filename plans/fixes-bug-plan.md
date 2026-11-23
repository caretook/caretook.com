# Plan: Fixes (bug)

Small bug fixes: wrong behaviour or data. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-bug`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**Hand-off (2026-11-22, after the wave 2 landing; no slices in flight).** Wave 1 landed as 7a205be1 (PR #46). **Wave 2 (slices 13–17, all on opus) landed in dev through PR #52** (dev 4f94740): full check passed on 99023ba (557/557, quiet machine, after 7 earlier runs failed on load flakes only; flakes filed B-489–B-502), Codex clean on 608a759, tooling 47/47, browser `--changed` 8/8; lean `--suite` was skipped (said in the report). Report: ask a39; to-test `to-test/2026-11-22-0812-fixes-bug.md`. Docs folded (todos, search, app-shell, care-groups; all at ~10.2 KB, trim when adding). B-450 stopgap (roles test 60 s timeouts) landed with it; the query fix stays on B-450.

**Wave 3 (slice 18, B-510) landed in dev through PR #57** (2026-11-22). `pnpm prd check` takes no reason (only `--quick` does).

**Wave 4 (this session, 2026-11-23): slices 19–27, all on opus.** Synced with dev at 1cee1cac. Started (worktree made, opus agent spawned): 19, 20, 24, 25, 27. Chains on shared files: 20 → 21 → 22 → 23 (quick entry), 25 → 26 (sheet changes). **Held for a later wave:** B-615 and B-616 (dose-accuracy holds `timelineEntryService.ts` and `assistantActionService.ts`), B-620 (onboarding holds `routes/app/groups/timeline/`; the user approved its fix, see the item's note).

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
| 19    | B-527 | merged | 04f5e825 |
| 20    | B-578 | merged | 5d7cfdcf |
| 21    | B-591 | blocked by 20                              |          |
| 22    | B-580 | blocked by 21                              |          |
| 23    | B-581 | blocked by 22                              |          |
| 24    | B-599 | handed off (ff0d0577), merge in plan order |          |
| 25    | B-601 | handed off (e2c29395), merge in plan order |          |
| 26    | B-602 | blocked by 25                              |          |
| 27    | B-605 | handed off (f42f5557), merge in plan order |          |

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
