# Plan: Fixes (bug)

Small bug fixes: wrong behaviour or data. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-bug`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**History:** earlier hand-offs and landed waves' rows are in [`plans/fixes-bug-history.md`](fixes-bug-history.md) (`pnpm prd status-trim`).

- Gotchas: after a dev sync that changes `powersync/sync-config.yaml`, restart the stack's PowerSync (`docker restart caretook-loop3-powersync-1`) before the browser checks; this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need `export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"`; fresh stacks may need a PowerSync restart before sign-in/first-sync pass.

| Slice | Item  | State  | Merge    |
| ----- | ----- | ------ | -------- |
| 72    | B-830 | merged | ab6da878 |
| 73    | B-840 | merged | 9dd61dda |

**Wave 16 merged; CI full run out** (tier full: the staging workflows). Landing notes: staging needs a Seed staging run after landing (user's step; the GitHub `staging` environment must hold `INVITE_LINK_KEY`); fold into docs/domain/care-groups.md (staging refuses the dev key, `db:seed:linkKey`, reseed reseals), ops/runbook.md (both Actions need the key), docs/domain/app-shell.md (banner grace 10 s, PowerSync's 5 s retry). (2026-11-26, resumed run-through after dev sync bringing the orchestration split). B-750 standing (no files named); B-752 waits for B-753's watchdog. Standing topic: never `pnpm prd rm fixes-bug`.

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

## Wave 12

As before: the item's backlog notes (`pnpm backlog show B-<n>`) carry the file references, so **first confirm the bug with a failing test**. If it doesn't reproduce, say so in the hand-off with the test that shows it, and change no app code. Stay out of `routes/app/groups/planner/` and member-avatars' other hot files (`pnpm backlog prd list`), and out of `vitest.config.ts` and `scripts/ci/` (test-gates-2).

**The zone slices (53–61)** each own one test file. Run it in both zones: `CARETOOK_TEST_ZONE=America/New_York TZ=America/New_York pnpm exec vitest run --project web:components <file>`, then the same with `America/Los_Angeles`. Find out why each failure happens before changing anything:

- **The test assumes Los Angeles:** make it state its zone or compute its expectation, without weakening what it asserts. Don't change the runner's zone or skip the test.
- **The app is wrong for a viewer in New York** (a wrong day, time or due state): fix the app in that slice if the fix is small and inside the slice's area, with the test proving it. Otherwise leave the test failing, file a `fixes-bug` item, and say so in the hand-off.

### Slice 49: two connector log_dose calls for one pass merge into one dose (B-615)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/medications.md · Tests: integration

`log_dose` in `packages/api/src/connectors/tools/writes.ts` always takes a random id, so two calls for one scheduled dose make two doses, while `give_pass` converges.

- A `log_dose` that resolves to one scheduled slot uses that slot's identity, as `give_pass` does; a repeat for that slot makes no second dose.
- A dose with no scheduled slot (as needed, or off schedule) keeps today's behaviour.
- Don't change the upsert's duplicate return or `mayRestoreDose` (slice 52 owns them).
- Integration test: two calls for one slot leave one dose; two as-needed doses stay two.

### Slice 50: an outdated calendar consent tells the member to reload (B-717)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/calendars.md · Tests: unit, component

A device on an older bundle sends its old consent version and gets `consentOutdated` on every try, while the message suggests agreeing again.

- On this error the settings screen says the wording has changed and offers a reload; agreeing again on the old bundle is no longer the suggested step.
- The server still refuses an old version and records nothing.
- Component test in `settings/calendar.browser.test.tsx`: the refusal shows the reload path.

### Slice 51: a skipped or refused dose doesn't ask for an amount (B-718)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit

In `quickEntry.ts`, the `asksAmount` branch ignores the inherited status, so a dose that wasn't given is blocked until an amount is chosen.

- `asksAmount` applies only to a given dose. `skipped lisinopril 10` and a refused dose record without choosing, and record no guessed amount.
- `gave lisinopril 10` at 10 mg with a usual 2 tablets still asks (B-662).
- Unit test in `quickEntry.test.ts`: given, skipped and refused.

### Slice 52: a retried upload can't bring back an undone dose (B-719)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/sync.md, docs/domain/medications.md · Tests: integration

A restore changes `created_by` and only duplicates are recorded in `dose_duplicate_upload`, so A's retried first upload, or B's restoring upload after a time edit, matches no record and restores a dose someone has since undone.

- A restore records the displaced author and the restoring upload, so a retry of either is recognised and leaves an undone dose undone.
- A genuine new log of that dose still works as it does today.
- If this needs a migration, keep it additive.
- Integration test: A's upload loses its response, B restores, someone deletes, A retries: the dose stays deleted. The same for B's retry after a time edit.

### Slice 53: join test passes in New York (B-706)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md · Tests: component

`apps/web/app/routes/account/join/join.browser.test.tsx`, 1 failure: the signUp payload differs. Follow _The zone slices_.

### Slice 54: staff new-group test passes in New York (B-707)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/admin.md · Tests: component

`apps/web/app/routes/admin/new-group/newGroup.browser.test.tsx`, 1 failure: the posted payload differs. Follow _The zone slices_.

### Slice 55: an event draft keeps its day in New York (B-708)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md · Tests: component

`apps/web/app/routes/app/groups/entry/entryDraft.browser.test.tsx`, 3 failures: an all-day draft shows Jul 24 where the test expects the 25th, and two writes never reach the entry URL. Follow _The zone slices_, and establish first whether the all-day day is really wrong for this viewer.

### Slice 56: repeat preview test passes in New York (B-709)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md · Tests: component

`apps/web/app/routes/app/groups/entry/entryRepeat.browser.test.tsx`, 1 failure: the preview shows 1:00 PM where the test expects 10:00 AM. Follow _The zone slices_.

### Slice 57: medication schedule says whose times they are in New York (B-710)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

`apps/web/app/routes/app/groups/medication/medication.browser.test.tsx`, 2 failures on the "Times are … time" label. Follow _The zone slices_.

### Slice 58: Today's slot states are right in New York (B-711)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

`apps/web/app/routes/app/groups/medications/today.browser.test.tsx`, 10 failures: slots read `upcoming` where the test expects `due`. Follow _The zone slices_.

### Slice 59: new-group test passes in New York (B-712)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: component

`apps/web/app/routes/app/groups/new/newGroup.browser.test.tsx`, 1 failure: the create payload differs. Follow _The zone slices_.

### Slice 60: care period page test passes in New York (B-713)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-periods.md · Tests: component

`apps/web/app/routes/app/groups/period/period.browser.test.tsx`, 3 failures on displayed times (00:15 for 03:15). Follow _The zone slices_.

### Slice 61: care periods list test passes in New York (B-714)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-periods.md · Tests: component

`apps/web/app/routes/app/groups/periods/periods.browser.test.tsx`, 3 failures: displayed times, a date-only prefill's instant, and an "until" day. Follow _The zone slices_, and establish first whether the date-only prefill and the "until" day are really wrong for this viewer.

### Slice 62: two members' doses for one slot stay two rows again (B-729)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/sync.md, docs/domain/medications.md · Tests: integration

A brake on `dev` (54a43bf1) and on this branch: `packages/api/src/syncMedications.int.test.ts`, "sync.upload: two members' doses for one slot keeps Given and Skipped as two rows, and the earlier reads the slot", fails with `expected undefined to be '<uuid>'` (dev's narrowed run 45259937817; this branch's `components` run 45258699609). The test last changed in 46aa519c (dose-accuracy, B-614, B-616); since then `dev` took fixes-bug wave 11 and member-avatars slice 3, and this branch adds slice 52 (B-719, `timelineEntryService.ts`).

- Find which change broke it first (`git log` on the test and on `timelineEntryService.ts`, and run the test on each candidate): the app or the test.
- If the app is wrong, fix it so two members' doses for one slot keep both rows and the earlier reads the slot, without undoing B-719's retry rule or B-614/B-616's "an upload leaves another member's dose alone".
- If the test is stale, correct its expectation without weakening what it asserts.
- The test passes, and `timelineEntry.int.test.ts` still passes.

## Wave 13

As before: **first confirm the bug with a failing test**; if it doesn't reproduce, say so in the hand-off with the test that shows it and change no app code. Stay out of `routes/app/groups/planner/` and member-avatars' other hot files (`pnpm backlog prd list`), and out of `vitest.config.ts` and `scripts/ci/`.

### Slice 63: a retried dose upload after a time edit can't bring back an undone dose (B-726)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/sync.md, docs/domain/medications.md · Tests: integration

Slice 52 (B-719) records a restore's displaced author and restoring upload in `dose_duplicate_upload`, but two gaps remain (read from the code, no test yet): (1) another member edits the dose's time before the restore, so the displaced row's `occurred_at` no longer matches A's original upload and A's retry isn't recognised; (2) with no restore at all, A's upload loses its response, the time is edited, someone deletes the dose, and A's retry reads as a new tap and brings it back.

- A retry of an accepted dose upload is recognised whatever happened to the row since (a time edit, a restore, a delete), and leaves an undone dose undone. Recording every accepted dose upload is the likely shape; if so, keep any migration additive.
- A genuine new log of that dose still works as it does today, and B-719's, B-614's and B-616's rules still hold (an upload leaves another member's dose alone; two members' doses for one slot stay two rows).
- Integration tests in `packages/api/src/syncMedications.int.test.ts` (or beside it): both scenarios above end with the dose still deleted; a fresh log after a delete still records.

### Slice 64: the repeat preview reads each visit in the viewer's zone (B-728)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md · Tests: component

`visitLabel` in `apps/web/app/components/repeat/RepeatField.tsx` formats the series day (the recipient's zone) as the day and the visit's start instant in the viewer's zone as the time, so a Wed 10:00 PM Los Angeles visit reads "Wed, 1:00 AM" in New York. Decided (skeptic s20, ask a168, the user can veto): a timed visit's line shows its day and time both in the viewer's zone, as the Planner and the entry page do.

- A timed visit's line is the start instant's day and time in the viewer's zone ("Thu, 1:00 AM" for that viewer).
- An all-day visit keeps its series day (no zone shift).
- Leave `SeriesEditSheet`'s start and end pickers as they are (they use the series' zone; a separate item if anything).
- Component test in `entryRepeat.browser.test.tsx`: a late-evening Los Angeles visit read in New York shows the next day; it passes under both `TZ=America/New_York` and `TZ=America/Los_Angeles` (with `CARETOOK_TEST_ZONE` set to match).

## Wave 14

As before: **first confirm the bug with a failing test**; if it doesn't reproduce, say so in the hand-off with the test that shows it and change no app code. member-avatars has landed (7d69b3ba), so the Planner folder is free; its author circles there are now `MemberAvatar`/`AuthorCircle` from `components/entry/KindIcon.tsx`: leave them as they are. Stay out of `vitest.config.ts`, `scripts/ci/` and inbox-agent's hot files (`pnpm backlog prd list`). The three slices run at once and all touch the Planner: keep each change to its own item, and put new tests in the slice's own test file (named below) rather than in `planner.browser.test.tsx`, except slice 65, which owns that file.

### Slice 65: the Planner component test passes in New York (B-715)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md · Tests: component

`apps/web/app/routes/app/groups/planner/planner.browser.test.tsx` fails under `TZ=America/New_York` (CI zone runs on ef58007e and f57458d5). Wave 12's other zone files (B-706 to B-714) were all test-only: hard-coded Los Angeles times. Decide from evidence: run it in both zones (`TZ=America/New_York` and `TZ=America/Los_Angeles`, with `CARETOOK_TEST_ZONE` set to match), and for each failure say whether the test or the app is wrong.

- The file passes in both zones. A test-only fix builds its times from the group's zone instead of the machine's; an app bug found here gets fixed with a test that shows it.
- Only this file and what it tests; no change to other zone files.

### Slice 66: adding a todo from the Planner lands on Todos (B-689)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/todos.md, docs/domain/app-shell.md · Tests: component

The backlog item's note has the code read: `useCloseTodoSheet` (`routes/app/groups/todos/todoSheet.ts`) goes back (`navigate(-1)`) when `TODO_SHEET_STATE` is set, which the Planner's Add menu sets (`PlannerHeader.tsx`), and lands on the Todos list only without it, so the Todos landing is the fallback, not the design.

- A successful save from the Planner's Add > Todo (from Upcoming or from Past) always lands on `appUrls.todos(groupId, listSearch(search))` with `replace`, so Back doesn't reopen the form. Mark the intent in the link state (its own field).
- Cancel, Escape and a tap outside still return to the opener tab.
- Other openers of the sheet keep returning where they were: quick entry's Edit on the timeline, `LinkedTodos`, a todo's page.
- A kept Todos filter (Mine, Unassigned) doesn't hide the new todo right after landing; if it would, say how you handled it.
- In `PlannerHeader.tsx` change only the Todo menu item (slice 67 changes the Event one).
- Component tests in a new `planner/plannerAddTodo.browser.test.tsx`: save from Upcoming and from Past lands on Todos; cancel returns to the tab.

### Slice 67: Planner events return to the Planner (B-690)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md, docs/domain/timeline.md · Tests: component

The backlog item's two notes are the spec (code read and the user's decision). Add > Event (`PlannerHeader.tsx`) opens `entries/new?kind=event&when=pick` with no link state; the entry page autosaves and its only exit is a BackLink to the Timeline (`routes/app/groups/entry/route.tsx`); the first save's `navigate(…, { replace: true })` in `useLiveEntry.ts` (one-off and repeating) drops history state.

- **A new event from the Planner:** mark the Planner as the opener in link state and carry it over the first save's replace. While it's set, the back link reads Planner and goes to `appUrls.plannerPast` when the event is past, else `appUrls.planner`, decided on leaving (a time edited on the page counts), by the Planner's own rule (`isUpcoming`/`entryTiming` in `lib/appointments/upcoming.ts`: in progress and today's all-day count as Upcoming). An abandoned unsaved draft returns to the tab it was opened from.
- **An existing event opened from a Planner row** (Upcoming or Past): the row link passes the opener's full URL (path and search) in history state; the back link reads Planner and returns to that exact URL, filters kept, even after a time edit moves it to the other tab; scroll restored where the router allows.
- Deleting either kind of event opened from the Planner returns to the Planner (the new one by its time, the existing one to its opener), not the Timeline.
- A reload keeps the return path if history state survives; a direct link or bookmark keeps the Timeline link, and so does every other way in.
- In `PlannerHeader.tsx` change only the Event menu item (slice 66 changes the Todo one).
- Component tests in a new `planner/plannerEventReturn.browser.test.tsx` (or beside the entry page's tests): new past, future and in-progress events, a time changed before leaving, opening from Upcoming and from Past with a filter set, Back after a time edit, delete.

## Wave 15

Four fixes, independent, run at once. B-750 (the second-zone overflow umbrella) stays a standing item: it gets slices only once its notes name files.

### Slice 68: the timeline jump browser test can't hang a CI shard (B-752)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

The backlog item's note is the evidence: in CI run 45407562750, `routes/app/groups/timeline/timelineJump.browser.test.tsx` stopped reporting after test 3 ("a fresh load of the URL scrolls…") and never finished, with no test timeout firing; the rerun passed. Suspect a step that leaves the runner's page (the later tests use Back and history, tests 8–10) or an await that never settles.

- Find the cause from the code (history steps that can navigate the runner's top page, an unbounded wait for scroll or a frame, a missing cleanup between tests); say in the hand-off what it was and how you know.
- Fix it so a stuck step fails that test within its timeout instead of hanging the file. Keep every test's assertion; don't skip or loosen one.
- Apply the same fix to `timelineJumpPaging.browser.test.tsx` only if it shares the pattern.
- No app change unless the cause is in the app (then a component test shows it).

### Slice 69: a direct `?day=` load with no entries today lands its heading at the top (B-779)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

From fixes-ui slice 47 (B-736): with no entries for today, a direct `?day=` load ends with the day's heading about 160px down instead of under 40px; something above the list (likely the setup or Today card) grows after the landing scroll (`routes/app/groups/timeline/useJumpLanding.ts`). With today's entries it lands right.

- Find what grows after the landing and make the landing hold through it (land after that content settles, or keep the heading pinned while the layout above changes), without a fixed delay.
- A user scroll after landing still wins: nothing yanks the page back.
- Component test beside the jump tests: a world with no entries today, a direct `?day=` load, the heading ends under 40px from the top; the existing case with today's entries still passes.

### Slice 70: the service worker installs over a flaky network (B-787)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md · Tests: unit

`precache` (`lib/app-shell/serviceWorkerCaches.ts`) calls `cache.addAll` over ~530 paths: one failed fetch rejects the whole install, so a device on a flaky mobile network gets no offline worker until the browser's next try.

- Precache in bounded batches and retry each failed path a few times with a short backoff, so one dropped request no longer fails the install.
- The install still fails (and the old worker keeps serving) if a path stays failed after its retries: a worker that installs without its shell (`SHELL_PATH`), the offline page or any precached asset must not take over. Keep the shell fetched past the HTTP cache.
- Stored answers only when whole and good (status 200), as `addAll` did.
- Unit tests in `serviceWorkerCaches.test.ts` (its fake cache): one path failing once then succeeding installs; a path failing every try fails the install; the shell request keeps `cache: "reload"`; batches never exceed the bound.

### Slice 71: `todays_doses` gives each med time's id for `give_pass` (B-792)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/medications.md · Tests: integration

`give_pass`'s description says to use a med time's id from today's doses, but each `todays_doses` pass (`packages/api/src/connectors/tools/todaysDoses.ts`: name, time, at, state, slots) has no id.

- Add the med time's id to each pass in the structured result (`passId`, the same name `give_pass` takes), and to the text so an AI reading only the text finds it too.
- Keep the other fields and the text's shape otherwise unchanged.
- Integration test in `readTools.int.test.ts`: each pass carries its id, and that id works as `give_pass`'s `passId` (an existing `mcpWrites.int.test.ts` case may cover the write; reuse its setup).
- Update `connectors.md` only if it lists the result's fields (the orchestrator folds docs at landing; note what changed in the hand-off).

## Wave 16

Two fixes, independent, run at once. B-750 (the second-zone overflow umbrella) stays standing until its notes name files; B-752 (the timeline jump hang) waits for B-753's watchdog.

### Slice 72: staging's seeded invite links open (B-830)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/care-groups.md, ops/runbook.md · Tests: unit

The seeded Viewer invite link on staging shows "Couldn't load this link": `.github/workflows/seed-staging.yml` and `reset-staging.yml`'s seed step pass only `APP_ENV`, `DATABASE_URL` and `SEED_USER_PASSWORD`, so `seeds/invites.ts` seals with `utils/linkToken.ts`'s dev key while the staging server opens with the real `INVITE_LINK_KEY` (`careGroupInviteService.copyLink` returns `linkKeyMissing`).

- Pass `INVITE_LINK_KEY` from the staging environment's secrets to both Actions' seed step.
- Make sealing refuse the dev key when `APP_ENV` is `staging` (as production does), so a seed run without the key fails loudly instead of writing links staging can't open. Local dev and tests keep the dev key.
- Unit test beside `linkToken`: staging without the key can't seal; staging with it seals and opens; dev without it still uses the dev key.
- Don't run either Action or touch staging: reseeding is the user's step. Say in the hand-off that staging needs a reseed (or reset) once this lands, and that the secret must exist in the staging environment.

### Slice 73: the offline banner waits out a brief drop (B-840)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md, docs/domain/sync.md · Tests: component

The offline banner (`routes/app/layout/OfflineBanner.tsx`) flashes while the connection is actually up.

- Find what drives it (`navigator.onLine`, PowerSync's connected status from `lib/sync/`, or both) and say in the hand-off which flips while online, and why.
- Show the banner only after the offline state has held for a short grace period (a few seconds, one named constant); hide it as soon as the connection is back. Don't change what counts as offline elsewhere (uploads, page cache).
- Component tests with fake timers: a drop shorter than the grace never shows the banner; one longer shows it; reconnecting hides it at once.
