# Plan: Connectors 3 (the dose schedule ahead, repeating todos, adding providers and medications, and a dose sheet)

> Source PRD: [`plans/connectors-3-prd.md`](connectors-3-prd.md). User-story numbers (US) refer to it. Wave 1: B-252, B-253 (B-196 moved to `connectors-4`, held). Wave 2: B-760, B-761, B-917. Topic `connectors-3`.

## Status

**Where it stands (brief for the fresh session):** wave 1 landed (PR #272), **wave 2a** through PR #276 and **wave 2b** through PR #278 (2026-11-27, session connectors-3-23; tier integration, CI green run 46068679493 on 9ed058ad2, Codex clean on fc673f0; unsynced tip; report filed; to-test `to-test/2026-11-27-1620-connectors-3.md`). Every slice is landed and all slice worktrees are removed; B-760, B-761, B-917 landed. 2b's docs folded (connectors, medications) and landed docs-only through PR #279. **Open:** Codex's follow-ups, triaged under connectors-3: B-982 (past_doses reads doses with no upper bound, so a busy group's old days can show given doses as missed), B-984 (two dose writes with different statuses for one slot at once can both be added), B-985 (log_past_doses writes today's usual dose on past days when the dose changed in the range), B-986 (log_past_doses sees only the first 100 medications). The backlog session (`caretook-com-cc`) was asked whether they move to fixes-bug (recommended) or become a connectors-3 wave 3. **Restart (session connectors-3-ae):** reconciled, nothing in flight; that reply was lost, re-asked 2026-11-27. **Next:** on its reply, either `risa rm connectors-3` (once they're re-homed) or wait for the wave 3 plan, then `risa sync` and run it.

**Landing mode:** run everything through (dispatcher start): start every ready slice, land each green wave, ask only real questions through `risa ask`.

**Models:** slices 1 to 6 opus (real logic); the docs fold on sonnet.

**Notes for the landing fold:** slice 1 added error code `connectorTool:invalid` (400) for a read tool's zone-dependent input check; the frozen export list no longer exists (test-health removed it), so nothing to add. Slice 2: connectors doc's "drops a `repeatRule` (B-253)" becomes the structured `repeat`; planner-3's `firstDayOf` could be exported to drop the tool's copy (a nit).

**Wave 2 (the user's pick, via the backlog session, 2026-11-27):** keep connectors-3 open and plan a wave 2 for B-760 (`add_provider`), B-761 (`add_medication`) and B-917 (log doses from a photo of the weekly sheet). Don't re-home them; no `risa rm` after wave 1 lands. PR #272 landed; wave 2 planning handed to the backlog session.

**Wave 2 planned** (2026-11-27, `plan/connectors-3`, the dispatcher's planner): slices 3 to 6 below, in two waves (2a: 3 and 4; 2b: 5 and 6). B-917 stays open until slice 6 merges.

| Slice | Wave | State            | Merge into `prd/connectors-3` (slice commits) |
| ----- | ---- | ---------------- | --------------------------------------------- |
| 1     | 1    | merged           | a2383ef8b (ad3342564, c6147c2f9)              |
| 2     | 1    | merged           | 6e026ab18 (f0f00891c, f2edd4a62)              |
| 3     | 2a   | landed (PR #276) | b73368af5 (b959e601d, a700add6e)              |
| 4     | 2a   | landed (PR #276) | 701a96e62 (f169395d6)                         |
| 5     | 2b   | landed (PR #278) | 77a9e74b9 (2c9673ddb)                         |
| 6     | 2b   | landed (PR #278) | 350cbf8a5 (b383e3e08)                         |

**Backlog:** claim a slice's item when it starts; run `pnpm backlog done` on it when the slice merges.

| Item                                    | Slice |
| --------------------------------------- | ----- |
| B-252 the dosing schedule beyond today  | 1     |
| B-253 `add_todo` makes a repeating todo | 2     |
| B-760 `add_provider`                    | 3     |
| B-761 `add_medication`                  | 5     |
| B-917 logging a weekly dose sheet       | 4, 6  |

## Architectural decisions

Durable decisions every slice follows:

- **No migration, no new dependency, no new route, no screen change, no consent or scope change.** Both slices are server-side tool work on `/mcp`.
- **One source for each rule.** The schedule ahead comes from the due-dose core's slot expansion, never a second copy; a repeat's rule text comes from the shared rule builder (`ruleText`) and is checked by `parseRule`; the todo is written through `assistantActionService.run` like every connector write.
- **`dose_schedule` is the plan; `todays_doses` is the state.** The new tool never reads dose entries and never reports given, due, overdue or missed.
- **RRULE text is never a tool input.** `add_todo` takes the structured `repeat` and builds the rule; a raw `repeatRule` stays ignored.
- **Tools follow the registry's pattern** (`defineTool`, Zod input, failures as `isError` results with issues, times through `zonedIso`, the group from the grant). A new read tool joins the never-returned sweep and the frozen tool lists.
- **Nothing here edits `todays_doses`' handler or the due-dose core** (`dose-accuracy`'s files): slice 1 adds a file beside the core, appends to the schema's index and frozen export list and, in `todays_doses`, one sentence of description.

## How to run this plan

- **One wave, both slices at once.** They share no file: slice 1 owns the new pure module, the new tool's file, the tools list, the two descriptions and the read-tool tests; slice 2 owns `add_todo` in the writes module and the write tests.
- **Start condition:** `planner-3` in `dev` (the registry's `After`). Slice 1 doesn't need it; if the user wants the schedule sooner, slice 1 can start alone on their word.
- **Beside other PRDs:** `dose-accuracy` edits `todays_doses`' handler and the due-dose core; if it lands while this runs, sync at the wave boundary (both append to the medications schema index and the frozen export list: keep both). After its day rule, today's plan here can list a slot `todays_doses` hides for a medication added today; that is meant (the PRD's _Notes_). `code-health` moves the pure schema files; whichever lands second follows the move.
- **Checks:** stackless slices hand off on `pnpm prd check --quick`. The landing runs the full check once and `pnpm prd browser --changed --base dev` (no screens or flows change, so no suite).
- **Docs at landing:** fold into [connectors](../docs/domain/connectors.md) (_Tools_: `dose_schedule`; `add_todo`'s `repeat`; drop "takes no repeat (B-253)"; the doc is near its budget, so trim what you add) and [medications](../docs/domain/medications.md) (_What's due_: `doseSchedule`).
- **When it's done:** `pnpm prd rm connectors-3` sets the row done. `connectors-4` (B-196, the directory listings) stays held until the launch.

## Wave 2 architectural decisions

Durable decisions slices 3 to 6 follow (the PRD's _Wave 2 decisions_ and _Wave 2 implementation decisions_):

- **No migration, no new dependency, no new route, no screen change, no consent, scope or prompt change.** The one web edit is an import (slice 3).
- **Writes go through the services the app's own writes use.** `add_provider` and `add_medication` call `providerService.create` and `medicationService.create` as the member (their schemas are the sheets'; writers checked in SQL); `log_past_doses` runs `assistantActionService.logPastDoses`, the runner's sibling in the same module, sharing its helpers (`dosesSince`, the dose id lock, `writeEntry`). The group always comes from the grant.
- **One source for each rule.** Past slots and their states come from `doseSlotsBetween` with the change entries (through `doseRecord`), never a copy of the matching; its only change is an optional `now` to settle states at (slice 4), additive, so its callers and tests don't change; a mark's outcome comes only from `sheetDoseOutcomes`; dose ids from `doseSlotIdFor`, rounds from `passRoundId`; the new-item wording from `newItemPreview`.
- **A sheet batch never changes or removes a recorded dose.** It writes open slots and reports the rest.
- **Each new write tool gets its own integration test file** (`addProvider.int.test.ts`, `addMedication.int.test.ts`, `logPastDoses.int.test.ts`); `mcpWrites.int.test.ts` is not edited. `past_doses`' tests go in `readTools.int.test.ts` with the other reads, including the never-returned sweep.
- **The tool lists** (`tools/index.ts`, `mcp.int.test.ts`, `protocol.test.ts`): `past_doses` after `dose_schedule`; `log_past_doses` after `give_pass`; `add_provider` then `add_medication` at the end of the writes. Each slice adds its own lines and its own position test as a new `it` (slices 3, 5 and 6 at the end of the lists' describe block; slice 4 right after the `dose_schedule` one, so the parallel slices don't collide), nothing else. Slice 4 rewords `tools/index.ts`' comment ("a new tool adds one line at the end of its group") to "in its place in its group", since `past_doses` and `log_past_doses` sit beside their neighbours.

## How to run wave 2

- **Two waves.** 2a: slices 3 (`add_provider`) and 4 (`past_doses`) at once; they share only the tool lists, each in its own place. 2b: slice 5 (`add_medication`, after 3: it uses the moved wording and `medicationPath`) and slice 6 (`log_past_doses`, after 4: it extends `doseRecord`) at once, again sharing only the tool lists.
- **What each owns:** 3 the new-item wording's move, the provider and medication links, `addProvider.ts`; 4 `doseSlotsBetween`'s `now`, `doseRecord.ts` (the record), `pastDoses.ts`, `readTools.int.test.ts`; 5 `medicationService.create`'s `via`, `addMedication.ts`; 6 `doseRecord.ts` (the marks and outcomes), `assistantActionService.logPastDoses`, `logPastDoses.ts`.
- **Start condition:** none beyond this topic's row (wave 1 is in `dev`).
- **Beside other PRDs:** `tags-3` (running) owns the provider and medication rows and tag screens; nothing here touches them. The quick entry cards module (slice 3) is no running topic's hot file.
- **Checks:** stackless slices hand off on `pnpm prd check --quick`. The landing runs the full check once and `pnpm prd browser --changed --base dev` (no screens or flows change, so no suite).
- **Docs at landing:** the PRD's _Wave 2 notes_ (connectors, medications, providers, assistant).

---

## Slice 1: The dose schedule ahead (`dose_schedule`)

Stack: no · Reads: docs/domain/connectors.md, docs/domain/medications.md, docs/domain/data-layer.md · Tests: unit, integration

**Backlog:** B-252. **User stories:** 1 to 9.

**What to build**

A member's assistant can ask for the medication plan from today on and get each day's rounds, end to end: a pure schedule module, the tool, its place in the list, and the pointers between the dose tools.

- **`doseSchedule`** (pure, in the data package's medications schema, exported with its neighbours and added to the schema's frozen export list): `doseSchedule({ medications, passes, from, days, timeZone })` → `{ days: [{ day, rounds: [{ passId, name, time, at, medications: [{ medication, amount }] }] }], asNeeded: [{ medication, max }] }`. Built on `doseSlotsBetween` with `doses: []`, from the first day's start to the last day's end (exclusive: a 00:00 slot of the next day stays out), given current, live medications only (the range reader would otherwise keep stopped ones), with each slot's `state` dropped; no edit to `dueDoses.ts`. Each day's slots are grouped as `duePasses` groups them: a pass's medications in one round, a medication's own time as its own round, ordered by time, a pass's name from the passes, so a day has the same rounds `todays_doses` shows. Each medication appears from the day it starts or was added.
- **The tool `dose_schedule`** (read scope, read-only annotations), after `todays_doses` in the tools list:
  - Input: `from` (`YYYY-MM-DD`, default today in the recipient's zone), `days` (integer 1 to 14, default 7).
  - `from` before today: an invalid result (path `from`): "The schedule is for today onward. Use list_timeline for doses already logged."
  - Loads medications and passes as the member, as `todays_doses` does (through `normalizeSchedule`), and no entries.
  - Structured: `timeZone`, `from`, `days` (`day`, `weekday`, `rounds`: `name`, `time`, `at` in the recipient's offset, `medications`: `medicationId`, `medication`, `amount`), `asNeeded` (`medicationId`, `medication`, `maxPerDay`).
  - Text: a line per round with its medications; consecutive days with the same rounds written once as a range; "No scheduled doses" for an empty day or range; a last line for as-needed medications.
  - Description: the plan for today onward (rounds, times, medications, amounts), not what was given; for today's given, due and missed doses use `todays_doses`.
- **Pointers:** `upcoming`'s description ends "Doses are not here: use todays_doses for today and dose_schedule for the days ahead."; `todays_doses`' description gains "For the days ahead, use dose_schedule." Nothing else in `todays_doses` changes.

**Acceptance criteria**

- [ ] Unit (`doseSchedule.test.ts`, on the due-dose tests' fixtures): three days give three days of rounds; a pass round and a time of its own, ordered by time, grouped as `duePasses` groups the same day; a 00:00 slot belongs to its own day only; a medication with a pass slot and its own slot at the same time appears once; a medication starting on day 2 is absent on day 1; as-needed medications are only in `asNeeded`, with their maximum; a completed, discontinued or deleted medication is absent; a DST change day keeps wall-clock times; no medications gives days with no rounds.
- [ ] Integration (`readTools.int.test.ts`): `dose_schedule` with no input gives 7 days from today for the seeded group, each with the seeded rounds, in the recipient's offset; `from` tomorrow and `days: 1` gives one day; `days: 15` and a `from` before today are `isError` results, the second naming `list_timeline`; a viewer's read grant can call it; the never-returned sweep covers it.
- [ ] Integration and unit (the tool lists in `mcp.int.test.ts` and `protocol.test.ts`): `dose_schedule` is listed for read and write grants, after `todays_doses`.
- [ ] The schema's frozen export list names the new exports.
- [ ] `todays_doses`' structured result and text are unchanged (its existing tests pass untouched).
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** nothing. **Blocks:** nothing.

---

## Slice 2: `add_todo` makes a repeating todo

Stack: no · Reads: docs/domain/connectors.md, docs/domain/todos.md, docs/domain/assistant.md · Tests: unit, integration

**Backlog:** B-253. **User stories:** 10 to 16.

**What to build**

A member's assistant can add a todo that repeats daily, weekly on chosen days or monthly, and the todo behaves like one made in the app's form.

- **Input:** `add_todo` gains optional `repeat`: `{ every: "day" | "week" | "month", interval?: 1..SERIES_LIMITS.interval (default 1), weekdays?: ("MO" … "SU")[] }`, each field described for the assistant. The raw `repeatRule` stays out of the input, as `assigneeId` does.
- **`todoRepeatInput`** (pure, in the writes module): `(repeat, dueOn, today)` → `{ repeatRule, dueOn }` or an issue.
  - `day`: every `interval` days. `week`: on `weekdays`, or the due day's weekday (today's without a due day). `month`: on the due day's day of the month (today's without one); a 29th to 31st gives the rule planner-3's `readRepeat` gives for "every month on the 31st". No end.
  - No `dueOn`: today, or for a week with `weekdays` the next listed day, today included. `today` is the recipient's day at `ctx.now`.
  - `dueOn` not on one of `weekdays`: an issue at path `repeat`, "The due day isn't one of the repeat's days. The next one is <YYYY-MM-DD>."
  - `weekdays` with `day` or `month`: an issue at path `repeat`.
  - The rule is built with `ruleText`; reuse planner-3's first-day arithmetic if it is exported, else the same small date arithmetic (no `rrule` import in the tool).
- **The handler** loads the group (`loadGroup`) for the recipient's zone and today, and passes `repeatRule` and the worked-out `dueOn` in the `addTodo` action to `assistantActionService.run`, with `via` as now. A `dueTime` with a worked-out day is kept.
- **The answer:** "Added todo: …" with the repeat in `todoRepeatText`'s words ("Every Mon"; if the action preview from planner-3 already says it, don't say it twice); the structured result gains `repeats` (that text) and `dueOn`.
- **Description:** adds how to repeat ("to repeat it, pass repeat: every day, week (optionally on weekdays) or month, optionally every N; without a due day it starts on the first matching day; a member stops a repeat in the app").

**Acceptance criteria**

- [ ] Unit (`writes.test.ts`, a table over `todoRepeatInput`): every day; every 2 days; every week from a due day (that weekday); weekdays MO, WE, FR with no due day on a Tuesday starts Wednesday, on a Monday starts today; a due day on a listed weekday is kept; a due day off the list is the issue naming the next listed day; every month from the 15th, and from the 31st (planner-3's short-month behaviour); `interval` beyond the limit and `weekdays` with `day` are refused; each rule passes `parseRule`.
- [ ] Integration (`mcpWrites.int.test.ts`): `add_todo` with `repeat: { every: "week", weekdays: ["MO"] }` and no due day makes a todo due the next Monday with `repeat_rule`, `repeat_starts_on` and `repeat_id` set and `via` the client's name; its answer says the repeat and `list_todos` returns it with `repeats`; completing it through `todoService.complete` makes the next occurrence; the mismatch refusal is an `isError` result with the issue and makes nothing; a raw `repeatRule` without `repeat` still makes a todo that doesn't repeat; a read grant can't call `add_todo`.
- [ ] `add_todo` without `repeat` behaves as before (its existing tests pass untouched).
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** nothing in this plan; `planner-3`'s slices 5 and 6 in `dev` (the action's `repeatRule`, and the preview's wording). **Blocks:** nothing.

---

## Slice 3: `add_provider`

Stack: no · Reads: docs/domain/connectors.md, docs/domain/providers.md, docs/domain/assistant.md · Tests: unit, integration · Blocked by: none

**Backlog:** B-760. **User stories:** 18 to 21, 34. **PRD:** _Adding a provider_.

**What to build**

A member's assistant can add a provider to the group's directory with the Add provider sheet's fields and checks, answered in quick entry's words with a link.

- **The shared wording:** move `newItemPreview` from `apps/web/app/components/quick-entry/quickEntryCards.ts` into `packages/data/src/db/schema/assistant/quickEntryNewItem.ts` (it uses the data package's `FORM_LABELS`); `quickEntryCards.ts` imports it from `@caretook/data/schema` and re-exports it, so `useQuickEntry.ts` and `quickEntryCards.test.ts` stay as they are.
- **Links** (`packages/api/src/connectors/links.ts`): `providerPath(groupId, providerId)` and `medicationPath(groupId, medicationId)`, equal to `appUrls`' provider and medication pages; `links.test.ts` checks both against `appUrls`.
- **`add_provider`** (new `packages/api/src/connectors/tools/addProvider.ts`, `addProvider`): write scope, `WRITE_ANNOTATIONS`.
  - Input from the provider schema's fields and limits: `type` (default `clinician`), `name`, `specialty`, `practiceId`, `phones` (`number`, optional `label`), `address`, `website`, each described for the assistant. No email, primary or status.
  - Duplicate: a live provider in the group (`providerService.list` as the member) of the same type whose name folds the same (`foldSearchText`, spaces collapsed) answers "Already in the directory, nothing added: <name>" with its link, structured `providerId`, `alreadyThere: true`.
  - Else `providerService.create(asMember(ctx), { groupId: ctx.groupId, ... })`; a refusal returns as the tools' usual `isError` result with issues.
  - Answer: "Added provider: <title> · <detail>" (`newItemPreview` on a provider draft from the input, the practice's name looked up), then the link; structured `providerId`, `preview`, `url`.
  - Description: adds a clinician, practice, pharmacy or other contact; a clinician's practice and the ids come from `list_providers`; ask the member before calling.
- **The lists:** `addProvider` at the end of the writes in `tools/index.ts`.

**Acceptance criteria**

- [ ] Unit (`links.test.ts`): `providerPath` and `medicationPath` equal `appUrls`' provider and medication pages.
- [ ] Unit (`quickEntryCards.test.ts`, untouched): its `newItemPreview` cases pass through the re-export.
- [ ] Integration (new `packages/api/src/connectors/addProvider.int.test.ts`, through `connectAssistant` and `callTool`): a clinician with a specialty, a phone and a seeded practice's id is created and `list_providers` returns it with the practice's name; the answer names it with its link; a bad phone number and a `practiceId` of a clinician are `isError` results with paths `phones.0.number` and `practiceId`, and write nothing; the same name and type again (different case and spacing) adds nothing and returns the first id; a read grant can't call it (403 `insufficient_scope`); with the group set read only it's refused (`mcp:groupReadOnly`).
- [ ] Integration and unit (the tool lists in `mcp.int.test.ts` and `protocol.test.ts`): `add_provider` is listed for write grants only, at the end of the writes.
- [ ] `pnpm prd check --quick` passes.

**Blocks:** slice 5.

---

## Slice 4: Past doses with their states (`past_doses`)

Stack: no · Reads: docs/domain/connectors.md, docs/domain/medications.md · Tests: unit, integration · Blocked by: none

**Backlog:** B-917 (the read). **User stories:** 27, 28, 33. **PRD:** _The dose record (past slots)_.

**What to build**

A member's assistant can read the past days' dose slots with their states and who logged them, in the shape of the printed weekly sheet, so it can compare a photo of the sheet with the app.

- **The range reader's `now`** (`packages/data/src/db/schema/medications/dueDoses.ts` `doseSlotsBetween`, `DoseSlotsBetweenInput`): an optional `now`; when given, `settle` runs at `now` with today as `now`'s day (in the zone) instead of at `to`, while slots are still kept up to `to`. Without it nothing changes (visit prep, `doseSchedule`, the existing `dueDoses.test.ts` cases).
- **`doseRecord`** (new `packages/data/src/db/schema/medications/doseRecord.ts`, exported from the medications schema index after `doseSchedule`): `doseRecord({ medications, passes, doses, changes, from, days, now, timeZone })` → `{ days: [{ day, rounds: [{ passId, name, time, slots: DoseSlot[] }] }] }`. Built on `doseSlotsBetween` with the doses and changes, from `from`'s start to the last day's end (exclusive of the next day's 00:00, as `doseSchedule` does), settled at `now`; the slots filtered to the range's days and grouped per day with `duePasses`, states kept. So today's later slots are `upcoming`, today's passed open ones `due` or `overdue`, earlier days' open ones `missed`. The caller never asks for a day after `now`'s. Medications as given (current and stopped, not deleted). No edit to `doseSchedule.ts`.
- **`past_doses`** (new `packages/api/src/connectors/tools/pastDoses.ts`, `pastDoses`): read scope, `READ_ANNOTATIONS`, after `doseSchedule` in `tools/index.ts`.
  - Input: `from` (`YYYY-MM-DD`, default 6 days before today in the recipient's zone), `days` (1 to 14, default 7). Days after today are dropped. A `from` after today: `connectorTool:invalid` at path `from`, "Past doses end today. Use dose_schedule for the days ahead."; more than 90 days back: the same code, "At most 90 days back."
  - Loads as `todays_doses` does (medications not deleted, through `normalizeSchedule`; passes with deleted ones; dose entries from the day before `from` through now via `entriesBetween`; `scheduleChanges` from two days before `from`; members for `loggedBy`), each slot in `todays_doses`' slot shape (written in the new module: `todaysDoses.ts` isn't edited).
  - Structured: `timeZone`, `from`, `to`, `days` (`day`, `weekday`, `rounds`: `passId`, `name`, `time`, `slots`: `medicationId`, `medication`, `amount`, `time`, `at`, `state`, `dose`: `entryId`, `status`, `loggedAt`, `loggedBy`, or null).
  - Text: a heading per day, a line per round and its slots with their state ("given by Sam at 08:12", "missed"); an empty day says "No scheduled doses".
  - Description: past days' doses with their states, for checking a week or a paper sheet against the app; `log_past_doses` names a slot by `medicationId`, `day` and `time` as listed here; today's live state is `todays_doses`'.

**Acceptance criteria**

- [ ] Unit (new `doseRecord.test.ts`, on fixtures copied from or shared with the due-dose tests; `dueDoses.test.ts`' own cases untouched): three past days with a given, a skipped and an unanswered slot give given, skipped and missed; today's slot after `now` is upcoming (present, not dropped) and one before it with no dose is due or overdue; a medication discontinued on day 2 has slots on day 1 only; a change entry that moved a slot on day 2 gives day 1 the old time and day 2 the new; a pass's slots are one round, a medication's own time its own, ordered as `duePasses` orders them; a DST day keeps wall-clock times.
- [ ] Integration (`readTools.int.test.ts`; medications created with a backdated `changedAt`, as the file's `daysBefore` does, so earlier days have slots): with seeded doses over the last days, `past_doses` with no input gives 7 days ending today with the seeded states and `loggedBy`; `from` and `days: 2` gives two days; `from` tomorrow and 91 days back are `isError` results (the first naming `dose_schedule`); a viewer's read grant calls it; the never-returned sweep covers it.
- [ ] Integration and unit (the tool lists in `mcp.int.test.ts` and `protocol.test.ts`): `past_doses` is listed for read and write grants, right after `dose_schedule`.
- [ ] `todays_doses`' output is unchanged (its tests pass untouched).
- [ ] `pnpm prd check --quick` passes.

**Blocks:** slice 6.

---

## Slice 5: `add_medication`

Stack: no · Reads: docs/domain/connectors.md, docs/domain/medications.md, docs/domain/data-layer.md · Tests: integration · Blocked by: 3

**Backlog:** B-761. **User stories:** 22 to 26, 34. **PRD:** _Adding a medication_.

**What to build**

A member's assistant can add a current medication with its type and schedule, in the group's med times by name or at times of its own, with a prescriber and pharmacy from the directory, through the Add medication sheet's schemas and service; its "started" entry shows "via" the assistant.

- **`medicationService.create`** (`packages/data/src/services/medicationService.ts`): `MedicationWriteOptions` gains server-only `via`; `writeChange` puts it on the change entry it creates (as `timelineEntryService.create` does with `opts.via`). `update` and `upsert` don't take it. No schema change: `medicationCreateZSchema` still has no `via`.
- **`add_medication`** (new `packages/api/src/connectors/tools/addMedication.ts`, `addMedication`): write scope, at the end of the writes after `addProvider` in `tools/index.ts`.
  - Input: `name`, `type` (`medicationTypeZSchema`, required), `strength`, `form`, `dose`, `directions`, `reason`, `startedOn`, `prescriberId`, `pharmacyId`, and `schedule` (required): `{ type: "asNeeded", maxPerDay? }` or `{ type: "scheduled", slots: [{ medTime?, time?, amount? }] }` with exactly one of `medTime` (a med time's name) and `time` (`HH:MM`). Each field described for the assistant.
  - Med times: the group's live passes (`medicationPassService.list` as the member) matched by name in any case; an unknown one is an issue at `schedule.slots.<n>.medTime`: "No med time called <name>. Med times: Morning (08:00), Evening (20:00)." Matched slots become `{ passId, amount }`.
  - Duplicate: a current, live medication whose name and strength fold the same (`foldSearchText`; both empty is the same) answers "Already on the medication list, nothing added: <title>" with its link, structured `medicationId`, `alreadyThere: true`.
  - Else `medicationService.create(asMember(ctx), { groupId, status: "current", ... }, { via: ctx.clientName })`; its prescriber, pharmacy and pass refusals return as `isError` results with their issues.
  - Answer: "Added medication: <title> · <detail>" (`newItemPreview` on a medication draft), "Schedule: <scheduleText>", the link (`medicationPath`), `Shown as "via <client>" on its started entry.`; structured `medicationId`, `preview`, `schedule`, `url`, `via`.
  - Description: type and schedule are required (ask the member for them); med times by name as `todays_doses` and `dose_schedule` name them; prescriber and pharmacy ids from `list_providers`; ask before calling.

**Acceptance criteria**

- [ ] Integration (`packages/data/src/services/medication.int.test.ts`): `create` with `{ via: "Claude" }` writes the started entry with `via` "Claude"; without it, `via` is null.
- [ ] Integration (new `packages/api/src/connectors/addMedication.int.test.ts`): a prescription in "morning" (any case) and at 14:00 with a seeded clinician as prescriber and a seeded pharmacy is in `list_medications` with its schedule text and in `dose_schedule` from today, and its started entry on `list_timeline` carries the client's `via`; an as-needed one with a maximum of 4; no `type`, an unknown med time (the message lists the seeded med times), a slot with both `medTime` and `time`, and a pharmacy id that is a clinician are `isError` results that write nothing; the same name and strength again adds nothing and returns the first id; a read grant can't call it.
- [ ] Integration and unit (the tool lists in `mcp.int.test.ts` and `protocol.test.ts`): `add_medication` is listed for write grants only, right after `add_provider`.
- [ ] `pnpm prd check --quick` passes.

**Blocks:** nothing.

---

## Slice 6: Logging a dose sheet (`log_past_doses`)

Stack: no · Reads: docs/domain/connectors.md, docs/domain/medications.md, docs/domain/data-layer.md, docs/domain/assistant.md · Tests: unit, integration · Blocked by: 4

**Backlog:** B-917 (the write; done when this merges). **User stories:** 27 to 32, 34. **PRD:** _Logging a dose sheet_.

**What to build**

A member's assistant can log a photographed week of the paper sheet in one call: open slots are added at their scheduled times in their rounds, and every mark is reported as added, already logged, a conflict to ask about, or refused with its reason.

- **Marks and outcomes** (`packages/data/src/db/schema/medications/doseRecord.ts`): `sheetDoseMarkZSchema` (`medicationId`, `day`, `time` `HH:MM`, `status` given, skipped or refused, optional `note` within the dose note's limit) and `SHEET_DOSE_MARKS_MAX` (200); pure `sheetDoseOutcomes({ record, marks, now, earliestDay })` → one outcome per mark in order: `add` (with the slot), `alreadyLogged` (the slot's dose has the mark's status), `conflict` (another status; with the dose), `noSlot`, `notYet` (the slot's moment is after `now`), `tooOld` (its day before `earliestDay`), `repeated` (an earlier mark named the slot). `tooOld` is decided by day before any slot lookup.
- **`assistantActionService.logPastDoses(ctx, groupId, marks, { via, now })`** (`packages/data/src/services/assistantActionService.ts`; exported with `run`): in one transaction, the writer check and recipient as `run` (factor the shared opening into one helper; `run`'s behaviour unchanged); marks parsed (`assistantActionService:invalid` for a malformed batch, nothing written); medications (not deleted), passes (deleted too) and `scheduleChanges` loaded once for the marks' days with a day either side; each mark's slot found in a dose-free `doseRecord` settled at `now` (so a slot later today is there, as `upcoming`) and its `doseSlotIdFor` id locked (`timelineEntryModel.lockId`) in sorted order; then `dosesSince` for the range, the record rebuilt with the doses, `sheetDoseOutcomes` (earliest day: 13 days before today, the recipient's day); each `add` written through `writeEntry` with `via` as a dose at the slot's `at`, the slot's amount, `passId`, `scheduledFor` and the mark's note, on the slot id (built as `scheduledDose` builds it: `doseSlotIdFor({ medicationId, status, occurredAt: slot.at, passId, scheduledFor: slot.time }, { timeZone, passTime: the live pass's time })`, so the id written is the one locked and the one `log_dose` would give; random if taken), and `passLogId` per pass and day: a round a dose there already has, else `passRoundId`; a slot at a medication's own time gets none. Returns `{ results: [{ outcome, entryId?, recorded? }] }`. No new error code or export beyond `logPastDoses`, `sheetDoseMarkZSchema`, `SHEET_DOSE_MARKS_MAX` and `sheetDoseOutcomes` (the last three through the medications index line slice 4 added). Known and accepted: `doseSlotIdFor` includes the status, so a simultaneous write of another status for the same slot isn't serialized by this lock; `log_dose` has the same exposure.
- **`log_past_doses`** (new `packages/api/src/connectors/tools/logPastDoses.ts`, `logPastDoses`): write scope, after `givePass` in `tools/index.ts`; input `marks` (1 to 200); runs `logPastDoses` with `via: ctx.clientName`, `now: ctx.now`.
  - Answer: the counts ("Added 18 doses, 4 already logged, 1 to check, 2 not logged"), a line per conflict ("Tue Nov 24 Evening, Metformin 500 mg: the sheet says refused, the app says given (logged by Sam). Ask the member; it can be changed in the app."), a line per refused mark with its reason, and the timeline link; `Shown as "via <client>".` when anything was added. Structured `results` (each `outcome`, the mark, `entryId`, `recorded: { status, loggedBy }` for a conflict), `added`, `via`.
  - Description: logs many past scheduled doses at once, such as a paper sheet; read `past_doses` first and name each slot by its `medicationId`, `day` and `time`; only given, skipped or refused marks (leave blank boxes out); as-needed doses: `log_dose` with their time; conflicts are never changed; ask the member before calling.

**Acceptance criteria**

- [ ] Unit (`doseRecord.test.ts`, a table over `sheetDoseOutcomes`): each outcome; a repeated mark after an `add` and after an `alreadyLogged`; a 00:00 slot on its own day; a slot due earlier today is `add`, one later today `notYet`; a mark on a DST day.
- [ ] Integration (new `packages/api/src/connectors/logPastDoses.int.test.ts`, a fictional week seeded through the services, medications created with `changedAt` at least 16 days back so every day has its slots): a batch of marks adds the open slots, as doses at their slot times with the slots' amounts, one round (`passLogId`) per med time and day and `via` the client's name; reports `alreadyLogged` for a slot given in the app and `conflict` for one the app has as given and the mark as refused, leaving that dose unchanged; reports `noSlot` for a medication at a time it isn't taken, `notYet` for a slot later today and `tooOld` for 15 days back; the same batch again adds nothing (all `alreadyLogged`); two identical batches at once add each dose once; `past_doses` then shows the added slots with their marks' states; 201 marks and a mark with a bad status are refused whole and write nothing; a read grant can't call it; a viewer's grant can't either.
- [ ] Integration and unit (the tool lists in `mcp.int.test.ts` and `protocol.test.ts`): `log_past_doses` is listed for write grants only, right after `give_pass`.
- [ ] `run`'s and `log_dose`'s existing tests pass untouched.
- [ ] `pnpm prd check --quick` passes.

**Blocks:** nothing.
