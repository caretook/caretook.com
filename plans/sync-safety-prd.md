# PRD: Sync safety: no change is lost without a word

Backlog: B-285 (refused sync changes vanish), B-286 (a failing change blocks the upload queue forever), B-287 (offline edits re-send unchanged JSON columns), B-288 (a replayed PUT reverts newer edits), B-289 (client-chosen ids can be squatted across groups), B-290 (sign-out and a lapsed session wipe unsent changes), B-291 (the upload's table lookup accepts `constructor` and `__proto__`), B-292 (a test that the device schema, the sync config and the upload column maps agree), B-293 (one generic soft-delete upload handler). Topic `sync-safety`. Areas: [sync](../docs/domain/sync.md), [auth](../docs/domain/auth.md), [app-shell](../docs/domain/app-shell.md), [medications](../docs/domain/medications.md), [providers](../docs/domain/providers.md), [live-notes](../docs/domain/live-notes.md), [appointments](../docs/domain/appointments.md).

Cut to the follow-on topic `sync-safety-2`: B-294 (a device's multi-row write applied as one transaction), B-295 (change entries take the device clock unchecked), B-296 (a stale tab clears the new user's local database) and the four repeating-todo races B-382, B-383, B-384, B-387.

## Decisions

The costliest to change first. The user vetoes by reading this table.

| Decision                                                                                                                                                                                                                                                                             | Why                                                                                                                        | Source                         | Cost to change later                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| A session the server ended (not an explicit Sign out) keeps the device's local copy only when it holds unsent changes: nothing is shown until the same person signs in, then they upload; anyone else signing in wipes it. With nothing unsent it is wiped as today                  | unsent care notes are the costlier loss; the copy stays behind sign-in                                                     | asked: as recommended (a11)    | medium: one rule and its tests, but it decides what stays on a shared device           |
| A kept copy is wiped 30 days after the session ended, the next time the app opens on that device                                                                                                                                                                                     | retention of health data on a device nobody can reach (a lost phone, a deleted account)                                    | asked: as recommended (a12)    | low: one constant                                                                      |
| Seven items go to a follow-on topic `sync-safety-2`: B-294 (atomic device transactions), B-295 (device clocks on change entries), B-296 (the stale tab) and the repeating-todo races B-382, B-383, B-384, B-387                                                                      | six slices at most, each small enough for one agent; these are the lowest severity or build on this topic's upload changes | preference (a PRD stays small) | low: move the items back                                                               |
| A change the server fails on (a 5xx for that one change) is set aside after 5 failed tries spread over at least 2 minutes: it leaves the queue, is kept on the device with its data, and is listed as not saved with a "Try again". A server or network outage never counts as a try | one bad change must not hold every later change on the device hostage; nothing is deleted                                  | assumed                        | medium: the numbers are constants; undoing "set aside" means the queue can wedge again |
| A PUT for a row that already exists changes nothing (it is a replay of a create), and its follow-ups (a tick, a delete) run only with the create; only PATCHes change existing rows                                                                                                  | a replayed create carries insert-time values and reverts newer edits                                                       | assumed (the item's fix idea)  | medium: every service's `upsert`                                                       |
| A refused change is listed, not retried (the person redoes it by hand). A set-aside change has "Try again", which resends that one kept change                                                                                                                                       | a refusal is rarely fixed by resending; a server fault often is                                                            | assumed                        | low                                                                                    |
| An explicit Sign out with unsent changes asks first ("N changes haven't reached the server. Sign out and lose them?"), then wipes either way                                                                                                                                         | a shared device must be clearable; the person decides knowingly                                                            | assumed                        | low: one dialog                                                                        |
| Signing out offline wipes the device at once and finishes the server's sign-out the next time the app reaches it, before anything else loads                                                                                                                                         | today it wipes, then fails on an error page with the session still valid                                                   | assumed                        | low                                                                                    |
| The list lives at Settings → "Changes not saved"; the header's sync indicator shows "N not saved" linking there, and the count of changes still waiting when offline or failing                                                                                                      | the smallest surface on existing screens                                                                                   | assumed (UI)                   | low                                                                                    |
| Not-saved changes stay listed until dismissed (one by one or all), and are wiped with the device at sign-out                                                                                                                                                                         | they hold care data, so they follow the local copy's rules                                                                 | assumed                        | low                                                                                    |
| A squatted live-note id is refused with a 4xx (the victim sees "not saved" instead of a wedged queue); the keys are not rescoped per group                                                                                                                                           | the item's fix; rescoping the primary keys is a migration across every synced table                                        | assumed                        | high to go further (a migration), low to keep                                          |

**The skeptic pass** changed: the retention question (a12) was asked; B-295 and B-296 moved to `sync-safety-2` to shrink two oversized slices; the replay fix now covers a PUT's follow-ups (a replayed create carrying a tick no longer re-ticks a reopened todo) and moved to wave 2, since it needs the upload handler; a set-aside change gained "Try again" (a bad deploy could otherwise set changes aside for good); the try count survives a reload; wave 1 no longer has two slices in one file (the uploader and the handler each get their own module first); todos keep their own viewer answers; the hot-file row and the wave gates were completed, and the lean ceiling is flagged. Declined: nothing.

## Problem Statement

Caretook promises that what a caretaker writes offline reaches the group. A code review on 2026-11-21 found ways it silently doesn't:

- **A change the server refuses just disappears.** A phone clock an hour fast, two people adding a pass with the same name, a role changed while offline: the device's copy quietly snaps back to the server's, and the person never learns their note or dose wasn't saved.
- **One bad change can block a device for good.** If the server fails on a change every time, the device resends it forever and nothing after it ever uploads. The header says nothing about it.
- **Signing out, or a session ending, destroys unsent changes without warning.** Offline, sign-out even ends on an error page with the session still valid.
- **Stale values overwrite newer ones.** An offline refill edit resends the whole schedule as it was on that phone, undoing a co-member's newer change; a resent "create" does the same with every column.
- **Ids chosen on a device can collide with another group's rows**, jamming someone else's queue or making a repeating appointment skip days; a table named `constructor` is acknowledged as saved.
- **Nothing keeps the three column lists in step** (the device's tables, the sync config, the upload's maps): a column missing from one is silently dropped. The upload code is nine near-copies that have already drifted apart.

None of this was re-verified by the backlog session: each slice first reproduces its bug in a failing test.

## Solution

- **Changes that didn't save are kept and shown.** The device records every change the server refuses, with the server's reason, and lists them under Settings → "Changes not saved". The header shows how many.
- **A failing change can't block the queue.** The server answers per change; changes before a failing one are acknowledged, the failing one is retried a few times and then set aside into the same list (with "Try again"), and the rest carry on. The header shows when uploads are failing and how many changes are waiting.
- **Unsent changes are protected at sign-out.** Sign out asks before discarding them and works offline. A session that ends on its own keeps unsent changes for the same person's next sign-in.
- **Replays and stale copies change nothing.** A resent create is a no-op; offline edits send only the fields the person changed.
- **The server checks ids** that come from a device.
- **One upload registry**, with a test that fails when a synced column is missing from any of the three lists.

## User Stories

1. As a caretaker, I want to be told when a change I made didn't save and why, so that I can enter it again instead of believing it's recorded. (B-285)
2. As a caretaker, I want the unsaved change's own content kept (what it was, when), so that I can redo it without remembering it. (B-285)
3. As a caretaker, I want to dismiss an unsaved change once I've dealt with it, so that the list shows only what still needs me. (B-285)
4. As a caretaker, I want one change the server can't process not to stop my other changes from uploading, so that a single bad row never strands a day's notes. (B-286)
5. As a caretaker, I want the header to tell me when uploads are failing and how many changes are waiting, so that I know my notes aren't with the group yet. (B-286)
6. As a caretaker, I want a server or network outage never to throw my changes away, so that they upload when it recovers. (B-286)
7. As a caretaker, I want to send a set-aside change again once the server is well, so that a server fault doesn't make me retype it. (B-286)
8. As a caretaker, I want Sign out to warn me when changes haven't reached the server, so that I don't destroy them by accident. (B-290)
9. As a caretaker on a shared device, I want Sign out to work offline and really end my session, so that the next person isn't signed in as me. (B-290)
10. As a caretaker whose session expired, I want my unsent changes to upload when I sign in again, so that an expiry costs me nothing. (B-290)
11. As a caretaker on a shared device, I want someone else signing in to wipe my copy, and a copy nobody returns to not to stay forever, so that my group's data doesn't linger. (B-290)
12. As a caretaker, I want my offline refill edit to change only the refill fields, so that a co-member's newer schedule stays. (B-287)
13. As a caretaker, I want my offline provider edit to leave the phone numbers a co-member just corrected, so that their fix stays. (B-287)
14. As a caretaker, I want a change the app resends after a dropped connection not to undo edits made since, so that retries are harmless. (B-288)
15. As a member of a group, I want nobody outside it to be able to block my notes or my repeating appointments by reusing ids, so that another group can't disrupt mine. (B-289)
16. As a caretaker, I want a malformed upload to be refused cleanly, never acknowledged as saved or crashing the server. (B-291)
17. As a developer adding a column to a synced table, I want a test to fail until the device schema, the sync config and the upload map all list it, so that a column is never silently dropped. (B-292)
18. As a developer, I want one generic handler for soft-delete tables, so that a rule fixed once holds for every table. (B-293)
19. As a viewer, I want a refused change answered the same way on every table (not allowed), so that the reason I'm shown is right. (B-293)

## Implementation Decisions

### The upload registry (the `sync.upload` procedure)

- **One table registry** replaces the per-table copies, in a module of its own apart from the procedure's loop. A soft-delete table is a spec: its column map (device column → service field and a value mapper), its fixed columns (group, recipient, kind), its service (`upsert`, `update`, `remove`, `getById`), and whether it passes the device's `updated_at` as `changedAt`. One generic handler turns a spec into PUT, PATCH and DELETE. `todo` and `timeline_entry` keep their extra rules as hooks on the same handler; link tables, the live-note tables and `care_recipient` stay small handlers of their own in the same registry.
- **One answer per situation on every table**, unless the service gives a more specific reason (a todo's `viewerCompletionOnly`, and a viewer's own tick, stay as they are): a member who can read but not write is `permissions:unauthorized` (403) on PUT, PATCH and DELETE; a missing row is the table's `notFound`; a changed fixed column is its `immutable`; a delete of an already deleted row is `applied`. Where a service answers a viewer's delete 404 today, the handler tells a viewer from a missing row with one more read; the services aren't changed for this.
- **Lookup by own key only:** the registry is a `Map`. Any other table name, `constructor` and `__proto__` included, is rejected as `sync:readOnlyTable`.
- **The registry exports its column maps**, so the agreement test reads them.
- **Per-op results:** `applied`, `rejected` (a 4xx: the device records it and moves on) and, new, `failed` (the server couldn't process this change). On a `failed` op the server stops, returns the results so far, and answers 200. Before calling an op `failed` it probes the database; if the probe fails too, the whole request is a 5xx (an outage, nobody's fault). A NUL character anywhere in an op's data (text, JSON, a note update) is rejected up front as invalid (a 4xx), not left to fail in Postgres.

### The device's upload and the "not saved" list

- **A local-only device table** (never synced, never uploaded, cleared with the local copy) holds one row per change that didn't save: when, the table and row id, the op, the op's data, the server's code and issues, whether it was refused or set aside, and a plain label of what it was (the title or name, read from the op's data or the local row before the server's copy replaces it; none when neither has it, as for a delete).
- **The uploader** moves out of the device client into a module of its own that tests can drive with a stubbed server. It records each `rejected` result before acknowledging the batch. On a `failed` result it acknowledges only the ops before it (a second, shorter batch read from the queue and completed on its own; none when the first op failed), counts the try against that op, and throws so PowerSync reports the upload error and retries. After 5 failed tries of the same op spread over at least 2 minutes it records the op as set aside, acknowledges it and carries on. The count is kept on the device across reloads. A request that fails as a whole (offline, a 5xx, a 401) counts for nothing.
- **"Try again"** on a set-aside change sends that one kept op to `sync.upload` directly: applied removes it from the list, anything else leaves it there with the new reason.
- **A pure module** turns (table, op, code, issues, label) into a sentence a caretaker can read ("Your change to the medication "Lisinopril" wasn't saved: you can't edit in this group any more"), with a fallback that names only the kind of thing and shows the server's issue messages. The page shows one line per row: several changes to one row, and a note's document and its updates, are one line with a count.
- **`useSyncState`** gains the count of changes waiting to upload, the count not saved, and whether the last upload failed (PowerSync's upload error).
- **The screens:** Settings → "Changes not saved" (a list, newest first, each with Dismiss, and Dismiss all; an empty state); the header's sync indicator shows "N not saved" as a link to it, and the waiting count beside "Offline" and a new "Can't sync, retrying" state.

### Replays and stale columns

- **Every service's `upsert` is create-if-absent** and says whether it created. For an id that exists and the actor can see: a changed group, recipient or kind is `immutable`, anything else returns the row untouched, whatever the actor's role (a member since demoted to viewer replaying a create gets `applied`). An id the actor can't see stays refused without saying whether it exists.
- **A PUT's follow-ups belong to the create.** A PUT that carries `deleted_at` or a todo's `done_at` (created, then deleted or ticked, before upload) applies them only when this PUT created the row, in the same transaction as the create, so a replay never re-ticks or re-deletes what someone changed since.
- **Device writes send only what changed.** The medication and provider edit paths compare each field with the stored row by value (JSON columns parsed, not compared as text) and write only the differing columns, as the conditions path already does. Device tests seed JSON columns in the text form Postgres sends down (spaces after `:` and `,`), so they can see the bug.

### Ids from a device

- **Live notes:** creating a document checks for its id across all groups (as the system). One that exists outside the actor's sight is refused with a 4xx, never a primary-key 500.
- **Series visits:** "this day already has its visit" counts only a row of the same group and series. If the computed visit id is taken by any other row, the server writes the day's visit under a second id derived from the series, the day and a fixed salt, so the day is never skipped.

### Sign-out and a session's end

- **One pure rule** (beside the session rules) decides what happens to the local copy: given why (explicit sign-out, the server ended the session, another user signing in), how many changes are waiting and how long a kept copy has waited, it answers wipe, ask first, or keep for the owner.
- **Explicit Sign out:** with changes waiting, a native `<dialog>` asks first. Then the device is wiped and the server's sign-out is called; if the server can't be reached, a "sign-out pending" marker is left and the app finishes the sign-out the next time it reaches the server, before any session check, and lands on sign-in either way.
- **A session the server ended** (the user's answer to a11): with nothing waiting, wipe as today. With changes waiting, close the local database without clearing it, keep its owner mark, the time it was kept and that user's pending settings changes, forget everything else cached (the user, settings, groups, searches), and go to sign-in. The same user's next sign-in reopens it and uploads; a different user's wipes it first (the existing owner check).
- **A kept copy expires** (the user's answer to a12): 30 days after the session ended, the next time the app opens on that device (the sign-in page included) the copy is wiped.

### No schema change on the server

No migration, no sync-config change, no new dependency. The device gains one local-only table.

## Testing Decisions

Good tests here assert what the server ends up holding and what the device ends up showing, never which function ran. Each bug is reproduced by a failing test first, since the review's findings weren't re-verified.

- **The upload registry:** the existing per-table integration tests (`sync*.int.test.ts` in the API package) are the safety net and must pass unchanged in behaviour, except where this PRD changes an answer on purpose (a viewer's 403, a replayed PUT). New integration cases: an unknown table, `constructor`, `__proto__`; a viewer's PUT, PATCH and DELETE on every soft-delete table (one table-driven test); a `failed` op mid-batch (earlier results returned, later ops untouched); a NUL character.
- **The agreement test:** a unit test (no database) over the device schema, `sync-config.yaml` (through the existing sync-config parser) and the registry's exported maps, with an explicit ignore list and a rule that skips local-only device tables. Prior art: the sync matrix's `sync-matrix.test.mjs`, `rolesSql.test.ts`.
- **Services:** integration tests beside each service (`*.int.test.ts` in the data package): `upsert` on an existing row for every soft-delete service, the squatted document id, the squatted visit id.
- **Device modules:** unit tests for the pure parts (the wipe rule, the sentences, the try counter); device tests on the local test database (`apps/web/test/device.tsx`) driving the uploader with stubbed answers and reading the upload queue after an edit.
- **Screens:** component tests for the list, the indicator's states and the sign-out dialog ([components](../docs/domain/components.md#component-tests)).
- **End to end**, added to the checks that own the flows, no new check, and as few seconds as possible (the lean set is one second under its ceiling): `roundtrip` (its refused-upload step also finds the refusal listed, and its last step finds nothing else listed), `signout-wipe` (offline sign-out), `session-end` (unsent changes survive a session ended elsewhere).

## Out of Scope

- `sync-safety-2`: applying a device's multi-row write as one transaction (B-294), clamping device clocks on change entries (B-295), the stale tab (B-296), and the repeating-todo races (B-382, B-383, B-384, B-387).
- Retrying a refused change.
- Scoping primary keys per group, or any other key change.
- Field-level merge for JSON columns (two people editing the same schedule still last-write-wins per column).
- Conflict history or an "edited by someone else" notice.
- Encrypting the local copy, or changing the 3-day offline limit (a device offline too long still keeps its copy with no limit, as today).

## Notes

- **Nothing is live**, so there is no data migration and no compatibility with older devices to keep: the device and the server change together.
- **B-287 rests on one assumption** (that the synced copy's JSON text differs from the device's compact form, so PowerSync's diff resends it): its slice checks the real upload queue on a running stack before fixing.
- **Residual after B-289:** someone who learns a row's id (a former member) can still take the matching live-note id from another group; the owner's notes on that one row are then refused and listed (as one line) instead of jamming their device. Closing it fully needs per-group keys.
- **Setting a change aside can leave later changes that built on it refused** (a row whose create was set aside, then its edits): they are listed too. `sync-safety-2`'s device transactions make the unit the whole write.
- **A fault that outlasts the tries** (a bad deploy failing one kind of change for hours) sets those changes aside on every device that is online; they are kept, and "Try again" sends them once the server is fixed.
- **Hot files shared with other topics:** the service layer and `lib/auth/` are `fixes-bug`'s; the browser checks are `test-health`'s; `data-rights` (on hold) lists the device client. The PRD table's hot files say so, and the dispatcher keeps them apart. This topic rewrites the upload procedure's file wholesale (the rules across PRDs otherwise allow only additive edits there), so no other topic may have an unlanded change to it when slice 1 starts.
