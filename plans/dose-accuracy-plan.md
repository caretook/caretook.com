# Plan: Dose accuracy

> Source PRD: [`plans/dose-accuracy-prd.md`](dose-accuracy-prd.md). User-story numbers (US) refer to it. Backlog items B-297 (a surplus dose marks the next day's slot as given), B-298 (deterministic dose ids), B-299 (visit prep's missed doses read through today's schedule). Topic `dose-accuracy`.

## Status

| Slice | Wave | State                            | Merge into `prd/dose-accuracy` (slice commits) |
| ----- | ---- | -------------------------------- | ---------------------------------------------- |
| 1     | 1    | landed in dev 82a5d3ac (PR #88)  | e851c83d (597f6f1f, d3fb1182)                  |
| 2     | 2    | landed in dev b91c9d56 (PR #91)  | b84b2269 (1dedf2c6)                            |
| 3     | 3    | landed in dev ae9433dc (PR #96)  | 5f927b61 (51e60708)                            |
| 4     | 2    | landed in dev b91c9d56 (PR #91)  | 154e2a0a (bd3101ee)                            |
| 5     | 4    | landed in dev 30b6685a (PR #123) | 1aa31357 (c851e600, 940c1353)                  |
| 6     | 5    | landed in dev 1b2723a2 (PR #126) | c22fd80f (46aa519c, 807605d0, fc062675)        |
| 7     | 6    | landed in dev b017417d (PR #129) | a77eac46 (0c6ee94d, 5334fbbc)                  |

**Landing mode:** run everything through (started by the dispatcher, 2026-11-22). Start every ready slice, land each green wave, clean up; ask only real questions through `pnpm prd ask`.

**Done: all six waves landed. Wave 6 landed in dev as b017417d (PR #129, `--no-review` because Codex is out of credits, CI `full` green on 551e1acf).** Open follow-ups: B-719 (a retry of an upload displaced by a restore can bring back an undone dose) in `fixes-bug`, B-723 (the `context.test.mjs` flake) in `fixes-tooling`. **Wave 6 (resumed after an interruption 2026-11-23; git matched this Status).** No veto on ask a150. Synced dev as cfc1c755 (brings migration 0041, database reset). Slice 7 (opus) merged as a77eac46 with migration 0042 (`dose_duplicate_upload`, additive, server-only); slice check passed on 5334fbbc; B-627 marked ready. Worktree `dose-accuracy-7` stays until the wave is green. Quick check on 551e1acf failed one tooling test outside this diff (`context.test.mjs`, passed 3 of 3 alone, filed as B-723). **CI `full` is green on 551e1acf** (run 45243594833; one quarantined failure, a Planner test outside this diff). Worktree `dose-accuracy-7` removed. Lean browser set 11 of 11 passed. Docs folded (medications, data-layer). **Next: PR, Codex, land `--tier full`; no Status commit between the PR and the landing.** A dev sync that brings a migration means regenerating 0042. This is the last wave: after landing, `pnpm prd rm dose-accuracy`, then `pnpm prd end` from the main checkout. **B-719** (a retry of an upload displaced by a restore can bring back an undone dose) is the follow-up from slice 7's hand-off, moved to `fixes-bug` because no slice of this PRD remains. Fold at landing: the duplicate record and retry rule (medications, a line in sync, data-layer's system-only tables); data-layer still says migrations run to 0036. **Before this:** wave 5 landed in dev as 1b2723a2 (PR #126, `--no-review` because Codex is out of credits, CI `components` green on ecb6d2f9, run 45237036870; report filed; docs folded and landed). The fixes-bug session (now `fixes-bug-2d`) told, including that slice 7 edits the upsert's duplicate return and restore rule. Next: wave 6.** Run `pnpm backlog ingest` and `list`, sync, then start slice 7 on opus (B-627 is already claimed). It adds this PRD's one migration, so its landing tier is `full`. Check ask a150 for a veto before starting it. Wave 5's history follows. **Wave 5 (resumed after an interruption 2026-11-23; git matched this Status).** Slice 6 (opus) merged as c22fd80f with B-614 and B-616 (both marked ready); quick check passed there. Worktree `dose-accuracy-6` stays until the wave is green. Synced dev (5a62445d); quick check passed there and **CI `components` is green** (run 45231641099; one quarantined failure, the emergency contacts sheet, outside this diff). Worktree `dose-accuracy-6` removed. Browser checks: `roundtrip` flaky (failed on a symptom entry at load 53–60, passed on retry; the new handler matches the generic one for non-doses), `live-notes` hit its 38 s suite cap, then passed alone. Docs folded (own-copy flag, per-id lock). **The user's rule (2026-11-23): after a dev sync, rerun checks only for conflicts or incoming code that requires it.** **B-627 stays open for slice 7 (wave 6):** slice 6 showed a retry and a first upload arrive identical, so the skeptic decided a small additive table (ask a150, skeptic s14, the user can veto; a veto is cheapest before slice 7 lands). Slice 6's choices, accepted: the device flags a dose PATCH as its own copy when the local row's `created_by` equals `updated_by` (every Undo and edit stamps the acting member, so a deliberate Undo of another's synced dose is unflagged and still removes it); an Easy helper's flagged PATCH onto another member's dose is now a silent no-op rather than a refusal (B-614's intent; told to the user). No upload-level test covers a flagged PATCH from a viewer or helper. Fold at landing: the own-copy flag and the per-id lock (medications, a line in sync). Wave 4 landed in dev as 30b6685a (PR #123, `--no-review` because Codex is out of credits, CI `components` green on a7e001ea, browser check `phase2` passed, report filed); its docs are folded into medications (committed here, they land with wave 5). Wave 4's history follows.

**Wave 4 (resumed after an interruption 2026-11-23):** git matched this Status. Synced dev (cd94bd7e, brings migration 0038; database reset). Slice 5 merged as 1aa31357 (slice check passed on 940c1353; worktree `dose-accuracy-5` kept until the wave is green). Watch the wave's run for a screen test that adds a medication and expects a slot already past: it is now dropped. Slice 5's choices, accepted: the changes query starts two days back, because matching reaches that far; `give_pass` on a pass whose only medication was added after its time says the pass has no medications. Fold at landing: medications (_What's due_: `changes` through `scheduleHistory`; _Doses over a range_: a dropped time keeps naming its historical slot within the window), connectors and assistant (`todays_doses` and the pass planners read the same entries). B-299 and B-611 are marked ready. Quick check passed on 788a5315. Synced dev (a7e001ea, migrations 0039 and 0040, database reset). Quick check passed there and **CI `components` is green on a7e001ea** (run 45221343704; one quarantined failure, the emergency contacts sheet, outside this diff). Slice 5's worktree is removed. **Next: browser check `phase2` (the only one the diff names), PR, Codex, land `--tier components`; no Status commit between the PR and the landing.** **Tell `fixes-bug-d0` when wave 4 lands;** it was told to start B-615 now. **B-614, B-616 and B-627 are slice 6, wave 5** (B-616 moved here from `fixes-bug` on the user's word). Ask a108 returned "Keep A's dose". **Tier lookup:** never call `check-plan.mjs` without piping the changed files in; it hung this session for about nine hours (reported to the backlog session).

**Before that:** wave 3 landed in dev as ae9433dc (PR #96, Codex clean, CI `integration` green on 16cfd88e, run 45127804986; no browser check needed). Its decisions are folded into the medications and sync docs (committed on this branch, they land with the next wave). **Next: wave 4.** At the boundary run `pnpm backlog ingest` and `list`, sync, claim B-611, then start slice 5 on opus. **Decide first where B-614 and B-627 go:** both are upload-versus-Undo bugs in `timelineEntryService` (an offline log-then-Undo can delete another member's dose; a retried upload can undo a later Undo). Proposal: a new slice 6 after slice 5, since a running slice never changes scope and slice 5 also edits the server's pass planner. Wave 2's history follows. B-299 stays in progress until slice 5 merges. **Wave 3: slice 3 merged as 5f927b61** (worktree `dose-accuracy-3` kept until the wave is green; B-298 marked ready). Quick check passed on 77853311; CI `integration` there read flake (run 45118751172, only `resetStaging.int.test.ts`, a file this branch doesn't touch). Synced dev (aee25c0c, test-gates' harness change); no browser check is needed for this diff. CI on e2721886 read flake too (run 45121356866: `resetStaging` and the tooling `lease.test.mjs`, neither touched here). Synced dev again (176d4338, ui-kit-4's last wave). The `resetStaging` flake is B-610, which the user put first in `fixes-tooling`. Quick check passed and **CI `integration` is green on 38b861bc** (run 45122860385). Slice 3's worktree is removed. Next: PR, Codex, land; no Status commit between the PR and the landing. Slice 3's choices, accepted: the first-upload and restore rules run before the update permission; a restored dose becomes the uploader's row; the author's own replay (same `occurredAt`) stays deleted, while the same author at another time counts as their other device and restores; a dose naming a slot its medication no longer has keeps its slot id, so two devices don't split one tap. Fold these into medications, and one line into sync. **Follow-ups filed from its hand-off:** B-614 (an offline log-then-Undo can delete another member's dose), triaged here and in no slice yet, decide at the wave 4 boundary; B-615 (connector `log_dose` never merges) and B-616 (two simultaneous first uploads: a 500 for the loser) in `fixes-bug`. **B-611** (a schedule change across midnight drops a dose's slot name) is placed in slice 5; claim it when slice 5 starts. Slice 3 lifted the staging hold from wave 2's report; B-614 and B-627 are the remaining dose-loss and dose-return cases. Two quarantined tests failed in wave 2's CI: the print weekly chart (doesn't use this logic, passed 3 of 3 alone) and the provider page with no links (not rerun). **Codex findings, all answered and resolved:** both upload cases are on B-298 for slice 3; the midnight schedule-change case is B-611 (a schedule change across midnight drops a dose's slot name), triaged to this PRD and not yet in a slice. **Slice 3 must also:** run its first-upload and restore rules before the update permission check, for every logger (Easy helpers included), without widening update, still refuse viewers, with integration tests for a helper on both paths. **For slice 5 (from slice 4):** reuse `scheduleHistory` and `ScheduleChange` from `@caretook/data/schema` and `scheduleChangesQuery` from `visitPrep.sync.ts`; pass rows through `toTimelineEntries` (`toMedicationEntries` rejects `passMoved`). Slice 4's choices, accepted: changes read from 3 days before the window with no upper bound; the same time counts as on the schedule (a deleted pass leaves a timed slot); a time-named dose resolves at the moment given (`doseName`); `stoppedOn` also caps a recorded stop (the backdated case has no test); the `createdAt` floor applies only with history but no `started` entry. Known limit: a time-named dose on a day its timed slot was hand-edited by more than two hours still reads the new slot as missed. **For slice 3:** call `doseSlotIdFor`; decide whether a dose naming a slot its medication no longer has should keep a slot id (the helper doesn't read the schedule, while matching treats that dose as unnamed, so two such doses on one day from two devices would share a row). Known limits from slice 2: a device that hasn't synced a pass move can derive a different day near midnight; `SLOT_REACH_MINUTES` in `duePasses.ts` copies `dueDoses`'s default of 120. Ask a92 was answered "Answer nothing" (a second 23:30 dose after midnight answers no slot and stays on the timeline). B-606 (highlight a double dose on a next-dose-due notification) is filed outside this PRD because no such notification exists. For slices 2, 4 and 5: `doseSlotDay` uses the same reach as `slotAt`; keep the days either side when replacing the expansion, and answer doses before trimming to the range. `pnpm backlog doctor` reports two old inbox-line findings (B-548, B-549), unrelated to this topic.

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
- **Wave 5: slice 6.** It owns the dose rules in the upsert and the delete path for uploads (B-614, B-616).
- **Wave 6: slice 7.** It owns the record of accepted duplicates and the restore rule's use of it (B-627), and adds this PRD's one migration.
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

**Blocked by:** 3, 4. **Blocks:** 6.

---

## Slice 6: An upload never removes or brings back a dose by accident

Stack: no · Reads: docs/domain/medications.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: integration

**User stories:** 6, 8. Backlog: B-614, B-616, B-627.

### What to build

Two gaps in slice 3's upload rules for a `dose`. **B-614 (the user's answer, ask a108: keep A's dose):** when member B logs a dose offline and undoes it before reconnecting while member A already holds that row, B's upload leaves A's dose live, whether B's device sends a PUT then a PATCH of `deleted_at`, or one PUT already carrying `deleted_at`. B's offline edit of a dose whose PUT was a duplicate doesn't change A's row either. **B-627:** a retried upload of a dose the server already accepted as a duplicate, replayed after A deleted the row, doesn't restore it; a genuinely new log by B still restores it (US 8). A deliberate Undo of a dose a member can see on their device still removes the shared row. **B-616:** when two first uploads of one dose id race, the loser gets the same no-op success as a later duplicate, not a 500 from the primary key. Prefer no schema change; if telling a retry from a new log can't be done without one, stop and ask.

### Acceptance criteria

- [ ] Integration: B's offline log then Undo, as PUT plus PATCH and as one PUT with `deleted_at`, leaves A's dose live and unchanged.
- [ ] Integration: B's offline edit after a duplicate PUT leaves A's row unchanged.
- [ ] Integration: B's accepted duplicate, replayed after A's Undo, leaves the dose deleted; a new log by B after A's Undo restores it.
- [ ] Integration: two simultaneous first uploads of one dose id both succeed and leave one row, the winner's.
- [ ] Integration: a member's Undo of a shared dose synced to their device still removes it; a viewer is still refused; an Easy helper's paths behave as slice 3 set them.
- [ ] `pnpm prd check --quick` passes.

B-627's criterion (a replayed duplicate leaves the dose deleted) moved to slice 7.

**Blocked by:** 5. **Blocks:** 7.

---

## Slice 7: A retried upload can't bring back an undone dose

Stack: no · Reads: docs/domain/medications.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: integration

**User stories:** 6, 8. Backlog: B-627. Decided in ask a150 (skeptic s14; the user can veto), which reverses this PRD's "no schema change" assumption for this one table.

### What to build

A small additive, server-only table recording each accepted duplicate of a dose: the member, the dose id and the upload's `occurredAt`. Write it in the upsert's transaction at the duplicate return, so it commits exactly when the duplicate was accepted (a lost response leaves a record, a failed request leaves none). The restore rule reads it: an upload matching a record is a retry and leaves a deleted dose deleted; the same member's upload at another `occurredAt` is a new log and restores it (US 8). The table never syncs to devices, and its rows are removed with the user, the group and the entry (AGENTS.md, _Compliance_: check the account deletion path).

### Acceptance criteria

- [ ] Integration: B's accepted duplicate, replayed after A's Undo, leaves the dose deleted.
- [ ] Integration: a new log by B at another `occurredAt` after A's Undo restores it; B's first upload arriving after A's Undo, with no earlier duplicate, restores it.
- [ ] Integration: a failed upload leaves no record, so its retry still counts as a first upload.
- [ ] Integration: the records go when the user, the group or the entry is deleted; the table is not in the sync config.
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** 6. **Blocks:** nothing.
