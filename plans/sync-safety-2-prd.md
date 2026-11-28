# PRD: Sync safety 2: stale clocks, copies and tabs change nothing

Backlog: B-295 (system change entries take the device clock unchecked), B-296 (a stale tab clears the new user's local database), B-383 (reopen misses a successor rescheduled to the same day or earlier), B-384 (two concurrent completions each make a next occurrence), B-387 (a stopped chain comes back from a stale offline tick), B-730 (a magic-link or invite sign-in during a pending offline sign-out is ended by the next /app check), B-805 (can the app sync in the background after offline work?). Topic `sync-safety-2`, the follow-on of `sync-safety` (done). Areas: [sync](../docs/domain/sync.md), [auth](../docs/domain/auth.md), [todos](../docs/domain/todos.md), [medications](../docs/domain/medications.md), [data-layer](../docs/domain/data-layer.md).

B-382 (an offline Undo's delete of the next occurrence), cut here with the others from `sync-safety`, has since been fixed in `fixes-bug` (3114a864) and is not part of this topic.

**B-294 (a multi-row device write half-applies when one op is refused) moved to `sync-safety-3`**, on the user's word after two skeptic send-backs: the services the upload calls each open their own transaction, so atomic writes first need every one of them changed to join a shared one. The design so far and the skeptics' findings are in [`sync-safety-3-notes.md`](sync-safety-3-notes.md).

## Decisions

The costliest to change first. The user vetoes by reading this table.

| Decision                                                                                                                                                                                                                                                                                                                                                                                          | Why                                                                                                                                        | Source                                                           | Cost to change later                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| A system change entry ("Stopped …", "Moved to …", a condition's change) is dated no later than the server's clock when it is saved; the entry's id still comes from the device's time, so a replay and the device's own copy still land on one row                                                                                                                                                | a phone clock a day ahead put the entry tomorrow, at the top of the history, uneditable; changing the id would duplicate entries on replay | assumed (the item's fix: "clamp the future side to server time") | low                                             |
| A repeating todo's successor (what reopening it may take away) is the chain row made after it was ticked, found by when it was made, whatever its due day now                                                                                                                                                                                                                                     | a successor moved to the same day or earlier was missed, and both rows stayed open and repeating                                           | assumed                                                          | low                                             |
| Two members ticking the same todo at once: the first tick wins, and the second is a replay (it keeps who finished first, and makes no second next occurrence)                                                                                                                                                                                                                                     | the same rule as a replayed tick today; the row is locked while it changes                                                                 | assumed                                                          | low                                             |
| A next occurrence a device uploads as part of its **tick** never creates a row on the server (the server's own tick makes it); one uploaded as part of a **skip** still does                                                                                                                                                                                                                      | a stale offline tick brought back a chain someone had stopped                                                                              | assumed                                                          | low                                             |
| A sign-out made offline is finished only for the session it ended: a newer session (a magic link, an invite, any sign-in path) is kept and the marker dropped                                                                                                                                                                                                                                     | guarding each landing page misses the next path someone adds; one rule covers them all                                                     | assumed                                                          | low                                             |
| A tab that finds another user signed in (another tab switched user) closes its own handle without wiping; the device's owner rule decides, so the new user's copy stays                                                                                                                                                                                                                           | today the stale tab's next navigation clears the new user's database                                                                       | assumed                                                          | low                                             |
| **B-805 is answered, not built:** uploads run while the app is open (on open, and when the network comes back while it's open); an installed app has no background upload. iOS has no Background Sync, and PowerSync's queue lives in the page, so an Android-only service-worker sync isn't built; native background tasks come with Capacitor. The answer goes into the sync doc with this plan | the item is a question; building a background path is new work no item asks for                                                            | assumed                                                          | low: a later topic can add it with no migration |

**The skeptic pass:** the first skeptic sent the plan back (s43): the atomic write (B-294) was too big for one slice, and the wave-1 overlaps, hot files and start conditions were incomplete. A reworked plan went to a second skeptic, which sent it back too (s44): the services the upload registry calls never join the context's transaction (about 62 `withTransaction` calls in 12 services), so the atomic write was built on a false premise. Asked (a237: recommended split, the user chose split), B-294 moved to `sync-safety-3`. Also from the second pass: slice 1 clamps the device's change-entry copy in the timeline entry service, not the registry; slice 2's successor rule records its reliance on `complete`'s clamp; the hot files name the auth, medications schema and todo model paths. No other decision moved to "ask".

## Problem Statement

`sync-safety` made sure a change the server refuses or fails on is kept and shown. Three gaps remain, found in code review and Codex review:

- **A phone with its clock ahead dates the group's history wrong.** When a medication is stopped or a pass moved on that phone, the "Stopped …" entry is dated by its clock: a day ahead, it sits at the top of the history, tomorrow, and nobody can edit it.
- **Repeating todos go wrong under offline and concurrent use.** Reopening a todo whose next occurrence was moved to an earlier day leaves both open and repeating; two members ticking at once make two next occurrences; and a stale offline tick brings back a chain someone deliberately stopped.
- **Sign-ins and tabs can undo each other.** After an offline sign-out, signing in by a magic link or an invite is signed out again by the next page; and a tab left open while another tab switches user wipes the new user's data on its next navigation.

None of it was re-verified by the backlog session beyond what its notes say: each slice first reproduces its bug in a failing test.

## Solution

- **Change entries never sit in the future:** the server dates them no later than its own clock.
- **Repeating todos keep one open occurrence per chain:** reopen finds the real successor, concurrent ticks make one next occurrence, and a stale tick never revives a stopped chain.
- **A sign-in is never undone by an older sign-out, and a stale tab never wipes someone else's data.**

## User Stories

1. As a caretaker whose phone clock is wrong, I want "Stopped …" and other change entries dated no later than now, so that the history stays in order. (B-295)
2. As a caretaker, I want a change I make offline and the copy the server makes to stay one entry, so that history shows no duplicates. (B-295)
3. As a caretaker, I want reopening a repeating todo to take back its next occurrence even if someone moved it to an earlier day, so that the chain doesn't run twice. (B-383)
4. As a caretaker, I want two of us ticking the same todo at the same moment to make one next occurrence, so that it doesn't run twice. (B-384)
5. As a caretaker who stopped a repeating todo, I want it to stay stopped when a co-member's phone comes online with an old tick, so that my decision holds. (B-387)
6. As a caretaker who signed out offline, I want signing in again from a magic link or an invite to keep me signed in, so that I'm not thrown out on the next page. (B-730)
7. As a caretaker sharing a computer, I want a tab someone else left open not to wipe my data when I use the app in another tab, so that my local copy and its unsent changes stay. (B-296)
8. As a caretaker who worked offline, I want to know whether my changes send themselves or wait for me to open the app, so that I open it when they must reach the others. (B-805)

## Implementation Decisions

### Change entries' time (the medication, pass and condition services)

- **One rule for a change's time**, beside the existing `toChangeTime`: from the device's `changedAt` it gives the **key** (the device's time, unchanged: the entry's derived id) and the **date** (the earlier of the device's time and the server's now: the entry's `occurredAt`). With no `changedAt`, both are now.
- The medication, medication pass and condition services (their change entries, and a condition manager unlink dated at the save's time) take both from it. A device's own copy of a change entry, uploaded as a timeline entry PUT, is satisfied by the server's row (create-if-absent) whatever order it arrives in; if it arrives first and creates the row, its `occurredAt` is clamped the same way.
- The device keeps writing its own clock locally; the server's copy replaces it at the next sync.

### Repeating todos (`todoService`, the device's todo module)

- **The todo row is locked** (`select … for update`, as other models already do) at the start of `complete`, `reopen`, `skip`, `removeUndoneNext` and `restoreOccurrence`, and the checks read the locked row. A second concurrent completion then sees it done and is a replay.
- **The successor is found by when it was made:** the live row of the same chain, other than this one, made at or after this todo was ticked, the earliest first; its due day plays no part. The server's `reopen` and the device's `reopenTodo` use the same rule, so both decide alike.
- **A tick's next occurrence is flagged on the upload** (the row's `_metadata`, as an Undo's delete already is): the device's tick writes its twin with the flag. The server's occurrence upload, flagged, never creates: it is satisfied by the row the server's tick made, or by nothing when the tick was a replay or the chain was stopped. Unflagged (a skip's), it keeps today's rule. The flag joins the device's other metadata constants in the todo rules.

### Sessions and tabs (`lib/auth`, `lib/sync`)

- **A pending sign-out remembers its session.** Each confirmed session check records the session's id on the device beside the confirmation it already records; an offline sign-out writes that id into the `caretook:sign-out-pending` marker. Finishing the sign-out first asks the server whose session the cookie holds: the same session is signed out (as today); a different one is a newer sign-in, so the marker is dropped and the session kept; none drops the marker. Offline it stays pending, as today. A marker with no id (no confirmed check on record) behaves as today. The sign-in page's own guard uses the same function.
- **A stale tab hands over instead of wiping.** When the tab's open database belongs to another user than the session now says, it closes its own handle without clearing (and forgets its in-memory caches, as `closeSync` does), then opens for the new user; the device's owner rule in `open` decides whether the file is wiped (another tab that already switched users has made the new user its owner, so nothing is wiped).

## Testing Decisions

- **The change-time rule's unit tests** (pure: ahead, behind, equal, unreadable) and **integration tests** in the data package (prior art `conditionChange.int.test.ts`, `upsertReplay.int.test.ts`): a medication stopped with a `changedAt` a day ahead gets an entry dated now and the id of the device's time; replaying it writes no second entry; the same for a pass moved and a condition changed.
- **Todo integration tests** (prior art `syncTodos.int.test.ts` and the todo service's tests): a successor rescheduled to the same day and to an earlier day is taken away on reopen when untouched, and kept (with the reopened one stopping) when touched; two completions run concurrently on two connections with different `doneAt` days make exactly one next occurrence; a stopped chain (successor deleted) stays stopped when a stale tick and its flagged twin upload, while a skip's unflagged occurrence still creates. **Device tests** for `reopenTodo`'s successor rule and the twin's flag.
- **Session unit or device tests** (prior art `session.test.ts`, `sessionRules.test.ts`): a pending marker with the same session signs out; with a different session keeps it and drops the marker; offline stays pending; no id behaves as before. A device test (prior art `index.test.ts`) for the stale-tab handover: another user's session closes without clearing, and a file already owned by the new user isn't wiped.
- **Stale-tick tests** land the tick and its flagged twin as separate ops (each its own write today); that's enough, since the flag alone decides.
- **No new browser check.** The browser checks the changed files map to run once per wave as usual (`roundtrip`, `session-end`, `sign-in` and the like); this topic adds no step to them, since the lean set has no room (see Notes).

## Out of Scope

- Atomic device writes (B-294): `sync-safety-3`. With them, `removePass`'s resending of every medication's schedule (B-294's related note).
- A field-level merge, conflict history or an "edited by someone else" notice.
- Per-group primary keys.
- A tab that stays on screen with the old user's data until its next navigation (it shows nothing new; its next navigation hands over).

## Notes

- **Nothing is live**, so there is no data migration and no compatibility with older devices to keep: the device and the server change together. No migration, no sync-config change, no new dependency, no seed change, no device schema change.
- **The lean browser set has no headroom** (`sync-safety` left it at its ceiling), which is why the acceptance criteria use integration and device tests. Only the user raises the ceiling.
- **B-805's answer** is a line in the sync doc's _Device_ part, written on this plan branch: nothing to build.
- **Hot files shared with other topics:** the upload registry's todo hook and `todoService` are shared with `tags` and `todo-subtasks` (planned), which also hold the device's todo module; `push-notifications` (held) holds the session module. `sync-safety-3` comes after this topic. The plan's _Start conditions_ say how each is handled. Edits to the shared registries stay additive (the rules across PRDs); the PRD table's hot files say what this topic holds, and whichever lands second syncs first.
