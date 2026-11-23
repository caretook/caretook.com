# PRD: Dose accuracy

Topic `dose-accuracy`. Backlog items: B-297 (a surplus dose marks the next day's slot as given), B-298 (deterministic dose ids, so two devices logging the same pass converge on one row), B-299 (visit prep's "Missed doses" reads history through today's schedule). Area doc: [medications](../docs/domain/medications.md).

## Decisions

One question was asked (the first row); everything else is assumed. Costliest to change first.

| Decision                                                                                                                                                                                                                                                                                                      | Why                                                                                               | Source                | Cost to change later                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| When two members give different answers for the same slot (one Given, one Skipped or Refused), both stay as two doses on the timeline, and the earlier one decides how the slot reads. So the shared id also includes the answer                                                                              | no member's record is dropped                                                                     | asked: as recommended | medium: ids already written stay                                                 |
| Two members who give the same answer for the same slot share one dose row (its id comes from the medication, the slot and the slot's day). The first upload stands: a later upload of the same id by another member changes nothing, so the row keeps its author, time and note                               | B-298's own words; an upload of a row that exists is a duplicate, not an edit                     | assumed               | medium: ids already written stay, and a different merge rule is a service change |
| Undo removes the shared row, so one member's Undo also removes the other's identical answer. The exception: when the other member's dose reaches the server after the Undo, the server restores the row with that member's dose                                                                               | one row can't hold two taps; a dose someone did log must not vanish silently                      | assumed               | medium: one service rule                                                         |
| A dose that names a slot answers only that slot: the open one with that name within two hours of when it was given (so a 23:30 dose given at 00:10 answers last night), else the one on the recipient's day it was given. A second dose for a slot already answered answers nothing; it stays on the timeline | B-297's fix idea, plus the late-night case the skeptic found                                      | assumed               | low: one pure function                                                           |
| No stored "slot day" on a dose: the day is worked out from the time given and the slot's time                                                                                                                                                                                                                 | no data shape change                                                                              | assumed               | low: an optional details field later                                             |
| Doses already stored keep their ids and are never merged or rewritten; existing duplicates stop answering a second slot and stay on the timeline                                                                                                                                                              | no existing data changes                                                                          | assumed               | low                                                                              |
| A deliberate second dose ("Log anyway") and a dose logged again after an Undo get a fresh id                                                                                                                                                                                                                  | they are extra doses or a new answer, not the same tap twice                                      | assumed               | low                                                                              |
| A round's id (`passLogId`) also comes from the pass and day, for Given all and for single Given taps in a pass, so two members' doses in one pass fold into one timeline item                                                                                                                                 | follows from B-298: one row per dose but two rounds would split the item                          | assumed               | low                                                                              |
| A past day's slots come from the schedule as it stood at the end of that day, and a slot counts only if it was already on the schedule at its own time                                                                                                                                                        | B-299's fix idea, cut to one rule that can never invent a miss or two slots for one pass in a day | assumed               | low: one pure module                                                             |
| A medication stopped and later resumed has no slots on the days it was stopped                                                                                                                                                                                                                                | same phantom-miss cause as B-299                                                                  | assumed               | low                                                                              |
| Schedule history also reads change entries a member deleted from the timeline                                                                                                                                                                                                                                 | deleting the timeline line shouldn't bring phantom misses back                                    | assumed               | low: one query filter                                                            |
| When the history has a gap (no entry explains a change, as after a pass is deleted), the schedule is read as it is now across the gap                                                                                                                                                                         | today's behaviour; never worse than now                                                           | assumed               | low                                                                              |
| Today drops a slot whose time passed before the medication was added or before the slot was put on the schedule (added at 15:00: no overdue 08:00)                                                                                                                                                            | B-299's note                                                                                      | assumed               | low                                                                              |

**Skeptic pass (one fresh agent, 2026-11-21).** Changed: the differing-answers choice moved from assumed to asked; the matching rule gained the two-hour reach back (a 23:30 dose given at 00:10 had flipped to the wrong night); "later upload stands" became "first upload stands" (a later upload would have overwritten a dose the first member had since edited, and left the first member as author of the second's content); single Given taps in a pass get the derived round id too; the device and server halves of the ids became two slices; the last slice now waits for the server slice (both edit the server's pass planner); the hot files of `sync-safety` and `connectors-3` are named. Declined: asking about Undo removing another member's identical answer (it follows from B-298's one row, the restore rule covers the lost-dose case, and one service rule changes it). Known limits kept, in _Notes_: device clocks on change entries (B-295), and a dose edited onto another slot keeping its id.

## Problem

A caregiver trusts three things on the medication screens, and each can be wrong today.

- **Today can say a dose is done when it isn't.** When two caregivers both tap Given for the same pass, the second dose finds its slot taken and answers tomorrow's instead, so tomorrow the dose reads done before anyone gave it. The other way round, an evening dose given early in the morning answers yesterday's missed slot and leaves today's open.
- **The same dose shows up twice.** Each tap makes its own row, so two phones logging one pass (often one of them offline) leave two doses on the timeline and in the counts.
- **Visit prep reports misses that never happened.** "Missed doses" reads the whole stretch since the last visit through today's schedule. Add an evening dose last week and the sheet shows it missed every day back to the last visit; move a pass by three hours and earlier doses stop matching; a medication paused for two weeks counts as missed throughout. A caregiver hands this to a clinician.
- A medication added mid-afternoon shows its morning dose as overdue at once.

## Solution

- A dose answers its own slot on its own day and nothing else. An extra dose is still on the timeline, and the "already given" warning still appears before it is logged, but it never marks another day done.
- Two caregivers giving the same answer for the same slot make one dose, whichever phone uploads first, online or not. When they disagree (Given and Skipped), both stay on the timeline and the earlier one decides how the slot reads. A Given all from both folds into one round on the timeline.
- Visit prep counts each day against the schedule the recipient actually had that day, built from the medication's own change history. Days a medication was stopped don't count.
- Today never shows a slot that was already past when the medication or the slot was added.

## User stories

1. As a caregiver, I want tomorrow's dose to read as not given until someone gives it, even if two of us tapped Given today, so that I never skip a real dose. (B-297)
2. As a caregiver, I want an evening dose I gave early to answer today's evening slot, not yesterday's missed one, so that today reads right. (B-297)
3. As a caregiver, I want a second dose for an answered slot kept on the timeline, so that a real double dose is still on record. (B-297)
4. As a caregiver, I want the "already given" warning to look at the same slot the dose would answer, so that the warning and Today agree. (B-297)
5. As a caregiver, I want my tap and another caregiver's tap on the same dose to become one dose, so that the timeline and counts aren't doubled. (B-298)
6. As a caregiver who was offline, I want my doses to merge with the ones logged meanwhile when I reconnect, so that going offline never duplicates a pass. (B-298)
7. As a caregiver, I want two of us tapping Given all on one pass to show as one round on the timeline. (B-298)
8. As a caregiver, I want a dose I logged to survive another caregiver's Undo when mine reaches the server after it, so that a dose I gave doesn't vanish. (B-298)
9. As a caregiver, I want my Skipped kept beside another caregiver's Given for the same dose when we disagree, so that neither record is lost and we can sort it out. (B-298)
10. As a caregiver, I want to log a dose again after an Undo, and to log a deliberate extra dose, so that the shared id never blocks a real entry. (B-298)
11. As someone using quick entry or a connected AI to log a pass, I want those doses to merge the same way, so that every way of logging agrees. (B-298)
12. As a caregiver preparing for a visit, I want missed doses counted against the schedule of each day, so that a schedule change doesn't show misses that never happened. (B-299)
13. As a caregiver preparing for a visit, I want doses given before a pass was retimed to still count, so that moving a pass doesn't turn given doses into misses. (B-299)
14. As a caregiver preparing for a visit, I want the days a medication was stopped left out, so that a pause isn't reported as misses. (B-299)
15. As a caregiver, I want a medication I add in the afternoon not to show its morning dose as overdue, so that Today starts clean. (B-299)
16. As a caregiver, I want yesterday's missed list on Today to use yesterday's schedule, so that a change I made today doesn't add a miss to yesterday. (B-299)

## Implementation decisions

**What's due (the pure module behind Today, the strip, the Dose sheet, visit prep and the connector tools)**

- **Matching.** A dose naming a pass the medication still has, or a time it still has, is a _named_ dose. It looks at the slot with that name nearest to `occurredAt` within the window (two hours): open, it answers it; already answered, it answers nothing (the user's answer, ask a92: a second 23:30 dose at 00:15 must not mark tonight given). With no such slot in the window, the open slot with that name on the recipient's day of `occurredAt`; else nothing. Named doses are still placed before unnamed ones, in time order, so the earliest keeps the slot. A dose naming a pass or time the medication no longer has, and an unnamed dose, keep today's rule: the nearest open slot within the window.
- **Warnings.** `doseWarnings` looks up the slot the planned dose would answer by the same rule (name and day), so "already given" fires exactly when the dose would be surplus.
- The range function (`doseSlotsBetween`) uses the same matching, so both leaks close in visit prep too.

**Slot identity (pure, beside the due-dose logic)**

- `doseSlotId(medicationId, day, slotKey)`: a UUID v5 (the existing helper and the pattern of `medicationChangeId`), where `slotKey` is the pass id when the dose names a pass, else the named time. The id also covers the dose's status (given, skipped, refused), so only the same answer shares a row. `passRoundId(passKey, day)`: the same for a round.
- **The slot's day** (`doseSlotDay`, pure): from the time given, the slot's time and the recipient's zone, the day of that slot's nearest moment within the window, else the day it was given. The same reach as the matching, so the id and the slot answered agree.
- One helper answers "what id does this dose get": the slot id when the dose names a slot, else none (a random id). Every writer of doses uses it: the device's single dose, its batch (Given all, quick entry's runner), the pass sheet when it adds a dose, and the server's writers (the assistant action service behind quick entry and the connector's `give_pass`).
- **A writer uses the slot id only when no row with that id exists where it writes** (the device's database, or Postgres for server writers), live or deleted; otherwise a random id. So a deliberate extra dose and a dose logged again after an Undo are new rows.
- A dose logged in a pass, by Given all or a single Given, takes the round already started in the pass, else `passRoundId`.

**Converging on the server (the timeline entry service's upsert)**

- An upload (a PUT) of a `dose` whose id exists, is live and was **created by another member** changes nothing and succeeds: the first upload stands. The uploader's device then shows the stored row. Its own later edits are ordinary updates.
- An upload of a `dose` whose id exists and is **deleted by another member** restores the row with the uploaded content. Deleted by the uploader themselves, it stays deleted, as now (a create and delete replayed). No other kind changes, and a member's replay of their own dose behaves as now (B-288, in `sync-safety`, changes that for every kind).
- The sync upload switch is not edited.

**Schedule history (a new pure module)**

- Input: a medication (its current schedule, when it was added), the passes (current times) and the group's `medicationChange` entries from the first day asked about up to now: a medication's entries (`started`, `changed` with `before` and `after` schedules, `stopped`, `resumed`) and pass moves (`passMoved`, with both times). Entries are read whether or not they were deleted from the timeline.
- Interface: the slots a medication has on a day (key, time, amount), and whether it was being taken that day. Behind it: start from the present and undo each later change (a schedule edit back to its `before`, a pass move back to its earlier time, a stop or resume back to the earlier status) until the end of the day asked about.
- **The day rule:** a day's slots are those of the schedule as it stood at the end of that day, at the pass times of the end of that day; a slot counts only if its key was already on the schedule at its own moment (so not before the medication was added, and not a slot added later that day for an earlier time). One slot per key per day, always.
- With no entries for a medication, or a change no entry explains, the present schedule is used: today's behaviour.
- Old-shape schedules in entries go through `normalizeSchedule`.

**Callers**

- `doseSlotsBetween` takes the change entries and expands each day through the schedule history. Visit prep's loader adds a query for the group's change entries from the window's start to now, deleted ones included, and passes them in.
- `dueDoses` takes the same optional entries: yesterday's slots use yesterday's schedule, and both days apply the day rule. `useDueDoses` adds a live query for the entries since yesterday's start; the connector's `todays_doses` and the server's pass planner read them too. Without entries, `dueDoses` behaves as now.

**No schema change, no migration, no new dependency.** No new permission: every write is the writer-only dose write that exists.

## Testing decisions

- **Unit** (the due-dose tests, the model for everything pure here): the two leaks from B-297 as named cases (two Given taps leave tomorrow open; a 20:00 dose at 07:00 answers today); a 23:30 dose given at 00:10 answers last night; a surplus dose answers nothing; warnings agree with matching; a retimed pass still keeps its answered doses; DST days. The id helpers: stable, distinct per medication, day and slot. The schedule history: a slot added mid-range, a slot removed, a pass moved by more than two hours, a stop and resume, a medication added mid-day, a deleted change entry, a history gap, an old-shape schedule.
- **Device tests** (the medications sync tests on the test device): the batch and single writers give the slot id, fall back to a random id when the id is taken or deleted, and Undo then log again works.
- **Integration** (prior art: `syncMedications.int.test.ts`, the service tests): two members upload the same slot's dose and one row remains, the first's; one uploads Given and the other Skipped: two rows, and the earlier decides the slot; Undo by one, then the other's upload: restored; the uploader's own replay stays deleted; a viewer is still refused. The assistant action service and `give_pass` use the slot id.
- **Visit prep** (its unit and sync tests): the lines for a range with a schedule change, a pass move and a pause.
- **Component** (`medicationWorld`): Today shows no overdue morning slot for a medication added in the afternoon, and tomorrow's slot open after a double Given.
- No new browser check. Two devices converging is covered at the service and upload level by the integration tests; the `roundtrip` check is left as it is.

## Out of scope

- A stored slot day on doses, and logging against yesterday's slots.
- Merging or re-keying doses already stored.
- Recording pass deletions in the history (a deleted pass's slots became timed slots at the same times, so the times still read right).
- Showing on the dose who else also answered it.
- Quick entry's negated and counted doses (B-300, B-301: `quick-entry-2`); moving the pure logic to a domain export (B-361: `code-health`).

## Notes

- **Hot files shared with unwritten topics:** `sync-safety` lists `medications.sync.ts` and the services' upserts; its B-288 (a replayed PUT on a live row should be a no-op) is the general form of the first-upload rule here, so its planner builds on this one. `connectors-3` lists the connector tools; the last slice edits `todays_doses` only to pass the history in. `code-health` (B-361) moves this pure logic out of the schema folder later. `fixes-bug` lists `packages/data/src/services/`; the two services edited here are the timeline entry service (the upsert) and the assistant action service (dose ids, the pass planner).
- **Known limits.** Change entries carry the device's clock (B-295, `sync-safety`), so a badly wrong clock can put a schedule change on the wrong day. A dose edited onto another slot or day keeps its id; a member who was offline and logs the original slot then finds their upload a duplicate of that row and their dose is not added. Both are rare and neither invents a miss.
- A pass deletion writes no change entry: its slots became timed slots at the same times, so earlier days read through the present schedule with the same times, and doses naming the deleted pass match by nearness as they do today.
- Nothing is live, so no client is running the old matching against new ids.
