# Plan: Fixes (bug)

Small bug fixes: wrong behaviour or data. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-bug`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**Hand-off (2026-11-22, after the wave 1 landing; no slices in flight).** Wave 1 (slices 1–12, all on opus) **landed** in dev as 7a205be1 through PR #46 with `--no-review` on the user's word (Codex out of credits); full check passed on 505d9eee; browser suite 12/12; docs folded (live-notes, auth, app-shell, appointments). Report filed as ask a29; to-test file `to-test/2026-11-22-0004-fixes-bug.md`. Load flakes filed: B-466, B-479, B-480.

**Next session: wave 2.** `pnpm backlog ingest`, `list`; candidates (triaged, prd=fixes-bug): B-318 (header ignores a simple-mode change from another device), B-382 (an offline Undo deletes an edited successor), B-469 (Easy search sheets go stale), B-470 (an Easy helper can undo a writer's cancel or reschedule), B-472 (an old queued simpleMode setting retries forever); check `pnpm backlog prd list` hot files first, append the slices under _Wave 2_, set hot files, claim. Codex may still be out of credits: if `review --wait` stalls or times out (75), ask the user before `--no-review`.

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge (`fixes-plans.test.mjs`); agent shells need `export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"`; fresh stacks may need a PowerSync restart before sign-in/first-sync pass.

| Slice | Item  | State                              | Merge    |
| ----- | ----- | ---------------------------------- | -------- |
| 1     | B-310 | landed                             | 6afc3f58 |
| 2     | B-312 | landed                             | 233dd07d |
| 3     | B-314 | landed                             | 8fa65e6f |
| 4     | B-315 | landed (first-sync at landing)     | 3dc2f3cd |
| 5     | B-317 | landed                             | 7fb498ee |
| 6     | B-320 | landed                             | a40b9713 |
| 7     | B-321 | landed                             | c2605057 |
| 8     | B-322 | landed                             | 59763904 |
| 9     | B-323 | landed (live-notes at landing)     | e7cb1d5e |
| 10    | B-385 | landed (resetStaging flake: B-466) | 9736353b |
| 11    | B-386 | landed                             | 1327d9bd |
| 12    | B-393 | landed (test only)                 | f9fb803b |

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
