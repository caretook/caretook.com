# Plan: Dose accuracy

> Source PRD: [`plans/dose-accuracy-prd.md`](dose-accuracy-prd.md). User-story numbers (US) refer to it. Backlog items B-297 (a surplus dose marks the next day's slot as given), B-298 (deterministic dose ids), B-299 (visit prep's missed doses read through today's schedule). Topic `dose-accuracy`.

## Status

| Slice | Wave | State                           | Merge into `prd/dose-accuracy` (slice commits) |
| ----- | ---- | ------------------------------- | ---------------------------------------------- |
| 1     | 1    | landed in dev 82a5d3ac (PR #88) | e851c83d (597f6f1f, d3fb1182)                  |
| 2     | 2    | landed in dev b91c9d56 (PR #91) | b84b2269 (1dedf2c6)                            |
| 3     | 3    | merged (opus), wave gate next   | 5f927b61 (51e60708)                            |
| 4     | 2    | landed in dev b91c9d56 (PR #91) | 154e2a0a (bd3101ee)                            |
| 5     | 4    | —                               | —                                              |

**Landing mode:** run everything through (started by the dispatcher, 2026-11-22). Start every ready slice, land each green wave, clean up; ask only real questions through `pnpm prd ask`.

**Now:** wave 2 landed in dev as b91c9d56 (PR #91, Codex clean on 977480c6, CI `components` green), its decisions folded into the medications doc (committed on this branch, they land with the next wave), landing report filed. B-298 and B-299 stay in progress until slices 3 and 5 merge. **Wave 3: slice 3 merged as 5f927b61** (worktree `dose-accuracy-3` kept until the wave is green; B-298 marked ready). Quick check passed on 77853311; CI `integration` there read flake (run 45118751172, only `resetStaging.int.test.ts`, a file this branch doesn't touch). Synced dev (aee25c0c, test-gates' harness change); no browser check is needed for this diff. Next: quick check and CI `integration` on the synced tip, PR, Codex, land. Slice 3's choices, accepted: the first-upload and restore rules run before the update permission; a restored dose becomes the uploader's row; the author's own replay (same `occurredAt`) stays deleted, while the same author at another time counts as their other device and restores; a dose naming a slot its medication no longer has keeps its slot id, so two devices don't split one tap. Fold these into medications, and one line into sync. **Follow-ups filed from its hand-off:** B-614 (an offline log-then-Undo can delete another member's dose), triaged here and in no slice yet, decide at the wave 4 boundary; B-615 (connector `log_dose` never merges) and B-616 (two simultaneous first uploads: a 500 for the loser) in `fixes-bug`. **B-611** (a schedule change across midnight drops a dose's slot name) is placed in slice 5; claim it when slice 5 starts. **Dev must not go to staging until slice 3 lands** (the report says so): until then a member's offline dose can be lost on a shared id after another member's Undo, or refused for an Easy helper. Two quarantined tests failed in wave 2's CI: the print weekly chart (doesn't use this logic, passed 3 of 3 alone) and the provider page with no links (not rerun). **Codex findings, all answered and resolved:** both upload cases are on B-298 for slice 3; the midnight schedule-change case is B-611 (a schedule change across midnight drops a dose's slot name), triaged to this PRD and not yet in a slice. **Slice 3 must also:** run its first-upload and restore rules before the update permission check, for every logger (Easy helpers included), without widening update, still refuse viewers, with integration tests for a helper on both paths. **For slice 5 (from slice 4):** reuse `scheduleHistory` and `ScheduleChange` from `@caretook/data/schema` and `scheduleChangesQuery` from `visitPrep.sync.ts`; pass rows through `toTimelineEntries` (`toMedicationEntries` rejects `passMoved`). Slice 4's choices, accepted: changes read from 3 days before the window with no upper bound; the same time counts as on the schedule (a deleted pass leaves a timed slot); a time-named dose resolves at the moment given (`doseName`); `stoppedOn` also caps a recorded stop (the backdated case has no test); the `createdAt` floor applies only with history but no `started` entry. Known limit: a time-named dose on a day its timed slot was hand-edited by more than two hours still reads the new slot as missed. **For slice 3:** call `doseSlotIdFor`; decide whether a dose naming a slot its medication no longer has should keep a slot id (the helper doesn't read the schedule, while matching treats that dose as unnamed, so two such doses on one day from two devices would share a row). Known limits from slice 2: a device that hasn't synced a pass move can derive a different day near midnight; `SLOT_REACH_MINUTES` in `duePasses.ts` copies `dueDoses`'s default of 120. Ask a92 was answered "Answer nothing" (a second 23:30 dose after midnight answers no slot and stays on the timeline). B-606 (highlight a double dose on a next-dose-due notification) is filed outside this PRD because no such notification exists. For slices 2, 4 and 5: `doseSlotDay` uses the same reach as `slotAt`; keep the days either side when replacing the expansion, and answer doses before trimming to the range. `pnpm backlog doctor` reports two old inbox-line findings (B-548, B-549), unrelated to this topic.

**Backlog:** claim B-297 when slice 1 starts and `done` it when slice 1 merges; B-298 when slice 2 starts, `done` after slice 3 merges; B-299 when slice 4 starts, `done` after slice 5 merges.

Fold into [medications](../docs/domain/medications.md) at landing: the matching rule (_What's due_, _By pass_), the slot and round ids and the "id taken: random" rule, the first-upload and restore rules for a dose (also a line in [sync](../docs/domain/sync.md)), the schedule history module and the day rule (_Doses over a range_).

## Architectural decisions

- **Matching:** a dose naming a pass or time its medication still has looks at the slot with that name nearest within the window (two hours): open, it answers it; already answered, it answers nothing. With no such slot in the window, it answers the open one on the recipient's day of its `occurredAt`; else nothing. Named doses first, in time order. Unnamed doses, and ones naming something the schedule no longer has, keep the nearest-open-slot-in-the-window rule. `doseWarnings` uses the same lookup.
- **Ids:** `doseSlotId(medicationId, day, slotKey)` and `passRoundId(passKey, day)` are UUID v5 through the existing helper; `slotKey` is the pass id, else the named time; the id also covers the dose's status, so only the same answer shares a row; `day` comes from `doseSlotDay` (the slot's nearest moment within the window, else the recipient's day it was given). Pure, exported with the due-dose logic from `@caretook/data/schema`.
- **Every dose writer** asks one helper for the id and uses the slot id **only when no row with it exists where it writes, live or deleted**; else a random id. A dose in a pass joins the pass's started round, else `passRoundId`.
- **Server:** in `timelineEntryService.upsert`, a `dose` uploaded onto a live row another member created changes nothing; onto a row another member deleted, it restores the row with the uploaded content. Everything else as now. `packages/api/src/sync.ts` is not edited (it is `sync-safety`'s hot file).
- **Schedule history:** a pure module beside the due-dose logic. From a medication, the passes and `medicationChange` entries (deleted ones included) it gives a day's slots and whether the medication was taken that day, by undoing later changes from the present. **Day rule:** the schedule at the end of the day, and a slot counts only if its key was on the schedule at its own moment. No entries or a gap: the present schedule.
- **`dueDoses` and `doseSlotsBetween`** take the change entries as an optional input; without them they behave as before the PRD.
- **No migration, no schema change, no dependency, no new permission, no new route.** All test data fictional.

## How to run this plan

- **Wave 1: slice 1.** It owns the matching and warnings in the due-dose module and its tests.
- **Wave 2: slices 2 and 4, side by side.** Slice 2 owns the id helpers (in the passes half of the due logic, with `givenAllWrites`) and the device's dose writers. Slice 4 owns the new schedule history module, `doseSlotsBetween` and visit prep. Slice 2 adds nothing to the due-dose module's file.
- **Wave 3: slice 3.** It owns the server's dose writes (the assistant action service) and the upsert rules.
- **Wave 4: slice 5.** It owns `dueDoses`'s use of the history, `useDueDoses`, the connector's `todays_doses` and the server's pass planner (which slice 3 edited, hence the order).
- **Stacks:** none. Integration tests run in stackless worktrees.
- **Checks:** each slice runs `pnpm test:components --changed prd/dose-accuracy` while building, `pnpm prd check --quick "slice hand-off"` and `pnpm prd browser --changed` once before hand-off. No browser check is edited.
- **Beside other PRDs:** `fixes-bug` lists `packages/data/src/services/` as hot; slices 3 and 5 edit only `timelineEntryService` (the upsert) and `assistantActionService` there, so the orchestrator checks the open fixes for those two files before wave 3. `sync-safety` (unwritten) lists `medications.sync.ts` and the services' upserts: if it is running, don't start slices 2 or 3 beside a slice of its that touches them. `connectors-3` (unwritten) lists the connector tools: slice 5 edits `todays_doses` only to pass the history in. `quick-entry-2` (B-300, B-301) changes how quick entry reads a dose, not how it is written; slice 2 keeps its edit in the quick-entry runner to the id. `code-health` (B-361) moves these pure files later.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)) and a _Docs_ section for the orchestrator.

---

## Slice 1: A dose answers only its own slot on its own day

Stack: no · Reads: docs/domain/medications.md · Tests: unit, component

**User stories:** 1–4.

### What to build

Change the matching inside the due-dose module so a named dose (a pass or time its medication still has) answers the slot with that name nearest within the window if it is open and nothing if it is answered; with none in the window, the open one on the recipient's day of its `occurredAt`, else nothing. Keep the order (named first, by time) and the unnamed rule. Make `doseWarnings` find "already given" through the same lookup. Both `dueDoses` and `doseSlotsBetween` pick it up, since they share the matcher. Update the module's doc comment and any test that pinned the old spill-over.

### Acceptance criteria

- [ ] Unit (the due-dose tests): two Given doses for today's Morning slot leave tomorrow's Morning open when evaluated tomorrow; the earlier dose holds the slot and the later answers nothing.
- [ ] Unit: a dose naming the 20:00 slot, given at 07:00 today, answers today's 20:00 slot and yesterday's stays missed.
- [ ] Unit: a dose naming the 23:30 slot, given at 00:10, answers last night's slot while it is open, and nothing when last night's is already answered (tonight's stays open; the user's answer, ask a92).
- [ ] Unit: the same cases through `doseSlotsBetween`; `missedDoseCounts` counts the real miss.
- [ ] Unit: a retimed pass still keeps its answered doses; a dose naming a pass or time the medication no longer has is matched as unnamed; an unnamed dose near midnight still answers the nearest open slot across the day line; a DST day.
- [ ] Unit: `doseWarnings` gives `alreadyGiven` exactly when the planned dose would answer nothing because its slot is given, for a pass and for a time.
- [ ] Component (`medicationWorld`, the Schedule tab's tests): with two Given doses on yesterday's Morning slot, today's Morning shows as due, not given.
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** nothing. **Blocks:** 2, 4.

---

## Slice 2: One id per slot on the device

Stack: no · Reads: docs/domain/medications.md, docs/domain/sync.md, docs/domain/assistant.md · Tests: unit, component

**User stories:** 5–7, 9, 10 (the device's half).

### What to build

Add `doseSlotDay`, `doseSlotId` and `passRoundId` (pure, UUID v5) and one helper that gives a dose its id: the slot id when it names a pass or time, else none. Use it in every device writer of doses, each checking that no row with that id is on the device (live or deleted) and falling back to a random id when one is: the single dose and the batch (so Given, Given all, the Dose sheet with a slot and quick entry's runner) and the pass sheet when it adds a dose. A dose logged in a pass takes the pass's started round, else `passRoundId`: Given all (`givenAllWrites`) and the pass card's single Given, which makes a random round today. Undo is unchanged (it removes by id). Editing a dose never changes its id.

### Acceptance criteria

- [ ] Unit: `doseSlotId` and `passRoundId` are stable and differ by medication, day, pass and time and status; `doseSlotDay` gives last night for a 23:30 slot at 00:10 and today for a 20:00 slot at 07:00, on a DST day too; the helper gives no slot id to an unnamed dose; `givenAllWrites` reuses a started round and otherwise gives the same round id on two calls.
- [ ] Device tests (the medications sync tests): `logDose` and `logDoses` write the slot id; with that id already on the device (live: "Log anyway"; deleted: after Undo) they write a random id; Given all, Undo, Given all leaves one live dose per slot; the pass sheet's added dose and quick entry's runner write slot ids.
- [ ] Component (the Schedule tab's tests): two single Given taps on different medications in one pass share one round id; Given all, Undo, then Given on one slot shows that slot given once.
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** 1. **Blocks:** 3.

---

## Slice 3: The server converges on one row

Stack: no · Reads: docs/domain/medications.md, docs/domain/sync.md, docs/domain/data-layer.md, docs/domain/connectors.md, docs/domain/assistant.md · Tests: integration

**User stories:** 5, 6, 8, 9, 11.

### What to build

In the timeline entry service's upsert, for the `dose` kind only: an upload onto a live row another member created changes nothing and succeeds; an upload onto a row another member deleted restores it with the uploaded content; a row the uploader deleted stays deleted. The server's own dose writers (the assistant action service, behind quick entry's server path and the connector's `give_pass`) use slice 2's helper, checking Postgres for the id and falling back to a random one, with the derived round id.

### Acceptance criteria

- [ ] Integration (`syncMedications.int.test.ts`): two members upload a dose for the same medication, day and slot: one row, with the first upload's author, time and note; one uploads Given and the other Skipped: two rows, and what's due reads the slot by the earlier.
- [ ] Integration (the timeline entry service's tests): a dose deleted by member A and uploaded again by member B is live with B's content; uploaded again by A it stays deleted; a non-dose entry deleted by another member stays deleted, and one live from another member is updated as before; a viewer's upload is refused as before; another group's member can't touch the id.
- [ ] Integration (the assistant action and connector tests): `give_pass` and quick entry's server path write slot ids and one round id, and running one twice doesn't double a slot.
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** 2. **Blocks:** 5.

---

## Slice 4: Visit prep counts each day against that day's schedule

Stack: no · Reads: docs/domain/medications.md, docs/domain/appointments.md · Tests: unit, component

**User stories:** 12–14.

### What to build

The schedule history module (PRD, _Schedule history_): from a medication, the passes and the change entries, the slots of any day and whether the medication was taken that day, under the day rule. `doseSlotsBetween` takes the entries and expands each day through it, replacing its "as it is now" reading and its single stop date (a stop and a resume both come from the history; `stoppedOn` stays the fallback when no entry says). Visit prep's loader queries the group's `medicationChange` entries from the window's start to now, deleted ones included, and passes them through to the missed-doses lines. Without entries the function behaves as before.

### Acceptance criteria

- [ ] Unit (the new module): a slot added mid-range exists only from its day (and not on that day when its time had passed); a removed slot exists until the day before the edit took it away; a pass moved by more than two hours gives the old time on earlier days and one slot on the day it moved; a stop then resume leaves no slots between; a medication added at 15:00 has no 08:00 slot that day; a deleted change entry still counts; a medication with no entries, and one with a gap, read as the present schedule; an old-shape schedule in an entry.
- [ ] Unit (the due-dose tests): `doseSlotsBetween` over a range with a schedule change gives no misses for days before the change when those days' doses were given; doses logged without a pass before a three-hour pass move still answer their slots.
- [ ] Unit (visit prep's tests): the "Missed doses" lines and their "(of n)" totals for a range with a schedule change, a pass move and a pause.
- [ ] Device test (visit prep's sync test): the loader returns change entries from the window's start to now, a deleted one included.
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** 1. **Blocks:** 5.

---

## Slice 5: Today uses the history too

Stack: no · Reads: docs/domain/medications.md, docs/domain/connectors.md, docs/domain/assistant.md · Tests: unit, component, integration

**User stories:** 15, 16.

### What to build

`dueDoses` takes the change entries: yesterday's slots come from yesterday's schedule, and both days apply the day rule, so a slot whose time passed before the medication was added, or before it was put on the schedule, isn't shown. `useDueDoses` adds one live query for the group's change entries since yesterday's start (deleted ones included), so Today, the strip, the Dose sheet, the Planner and quick entry's pass list all get it through the hook. The connector's `todays_doses` and the server's pass planner (behind `give_pass` and quick entry) read the same entries. `ready` still waits for every query. Also fix B-611 (a schedule change across midnight drops a dose's slot name): a 23:30 dose given at 00:10, with the schedule changed to 00:30 in between, keeps answering last night's slot.

### Acceptance criteria

- [ ] Unit (B-611): in visit prep's range, that dose answers last night's 23:30 slot, last night doesn't read missed, and today's new 00:30 slot stays open.
- [ ] Unit (the due-dose tests): a medication added at 15:00 has no 08:00 slot today and its 20:00 slot is upcoming; a slot added today for a time already past isn't shown, and is shown tomorrow; yesterday's missed list ignores a slot added today; a pass moved today shows one slot for that pass, at the new time, still answered by a dose given before the move; without entries the result equals the old one.
- [ ] Component (the Schedule tab's tests on `medicationWorld`): a medication added in the afternoon shows no overdue morning dose; the pass card's counts leave it out.
- [ ] Integration (`readTools.int.test.ts` and the assistant action tests): `todays_doses` omits the past slot of a medication added today; `give_pass` doesn't log it.
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** 3, 4. **Blocks:** nothing.
