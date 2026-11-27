# Plan: Interval schedules for medications (med-intervals)

> Source PRD: [`plans/med-intervals-prd.md`](med-intervals-prd.md). User-story numbers (US) refer to it. Backlog item B-938. Topic `med-intervals`; interval Med times follow in `med-intervals-2`.

## Status

| Slice | Wave | State   | Merge into `prd/med-intervals` (slice commits) |
| ----- | ---- | ------- | ---------------------------------------------- |
| 1     | 1    | planned |                                                |
| 2     | 2    | planned |                                                |
| 3     | 3    | planned |                                                |
| 4     | 4    | planned |                                                |
| 5     | 4    | planned |                                                |
| 6     | 5    | planned |                                                |
| 7     | 6    | planned |                                                |

**Held** (`hold` flag): two plan skeptics sent it back (s78, s79); reworked as the second asked. The user lifts it: `risa backlog prd set med-intervals flags-=hold`.

## Architectural decisions

- **One rule, one engine:** the interval rule and the pure instances module are written for a medication now and a Med time in `med-intervals-2`; nothing here is medication-only that a Med time would need.
- **No migration:** the interval kind lives in the `schedule` jsonb, validated by the shared Zod schema; every read goes through `normalizeSchedule`.
- **The same slot shape:** interval doses are `DoseSlot`s with a clock time and no pass, so `duePasses`, Given all, Undo and the timeline work unchanged. **Interval ids are keyed by moment:** an interval slot's dose id (`doseSlotIdFor`) and round key (`duePasses`) use its instance's moment, since at every 1 h two instances share a day and clock time at the fall-back hour. Clock slots keep their keys, so no id already written changes.
- **One window:** an interval dose's window (the smaller of 120 minutes and half the interval) is used in matching and passed to `doseSlotIdFor` by every writer, so a dose's id and its instance agree on the day.
- **Pure and zoned:** intervals are elapsed time; all clock text is in the recipient's zone.
- **History is read, never written:** a change of interval is the existing change entry; past days read the rule they had.
- **One source for each rule:** the device, the connector and quick entry reach interval doses through `intervalSlots` and `dueDoses`/`doseSlotsBetween`, never a copy.
- **Readers change with their slice:** once the kind joins the union (slice 2), only typecheck-forced readers change there; the others (if/else and filters on `asNeeded`) change in the slice that already edits their file, before slice 4 lets anyone save the kind. Until then they treat an interval schedule as scheduled with no slots, which nothing can create.
- All seed and test data is fictional.

## How to run this plan

Starts after `connectors-3` lands: it holds `dueDoses.ts`, `packages/data/src/db/schema/medications/index.ts`, `medicationService.ts`, `assistantActionService.ts` and the connector tools, and it creates files this plan changes (`doseRecord.ts`, `pastDoses.ts`, `addMedication.ts`, `logPastDoses.ts`, their tests). Check its row is done, then sync; if a named file moved, follow it (`prd anchors`).

Waves: 1 is slice 1; 2 slice 2; 3 slice 3; 4 slices 4 and 5 (disjoint files); 5 slice 6; 6 slice 7. No migration and no synced column, so the waves land as they go green. Slice 4 is the first that can save the kind; it is blocked by slice 3, so the due engine and the dose writers are in first.

**Hot files:** `packages/data/src/db/schema/medications/`, `apps/web/app/lib/medications/`, `apps/web/app/routes/app/groups/medications/`, `packages/data/src/services/assistantActionService.ts`, `packages/data/src/services/medicationService.ts`, `packages/api/src/connectors/tools/`.

**Not touched:** the medication page `routes/app/groups/medication/route.tsx` (todo-links' hot file): it shows the schedule through `scheduleText`.

**Docs to fold at landing:** medications.md (the interval kind, the instances module, missed vs overdue, the window, the form, the weekly sheet); connectors.md (interval text, `add_medication`'s interval branch, logging onto interval doses).

**Backlog:** claim B-938 when slice 1 starts; leave it in progress at this topic's end (`med-intervals-2` finishes it), with a note of what landed.

## Slice 1: The interval rule and its instances

Stack: no · Reads: docs/domain/medications.md · Tests: unit

**User stories:** US 2, 4, 5 (the engine).

**Build:**

- New `packages/data/src/db/schema/medications/intervalRule.ts`: the rule type (`everyMinutes`, `from` `due | given`, `startsAt`), `intervalRuleZSchema`, its limits (60–1440 minutes), `intervalWindowMinutes` (the smaller of 120 and half the interval) and `intervalText` ("every 4 hours, from when given"). Standalone: not yet in `MedicationSchedule`.
- New pure `packages/data/src/db/schema/medications/intervalSlots.ts` (`intervalSlots`): a rule, the doses that can answer it, the latest answer before the range and a range in; instances out with their answering dose. From-due grid, from-given chain (given, skipped or refused answer), the window, elapsed time across DST, only the next upcoming one, and each instance's missed-or-overdue rule from the PRD's _Decisions_.
- Both exported from `packages/data/src/db/schema/medications/index.ts`.

**Acceptance criteria:**

- Unit (new `intervalRule.test.ts`): bounds (0 h and 25 h refused, 1 h and 24 h accepted), `from`, a bad `startsAt` refused with its path; the window at 1, 2, 4 and 12 hours; `intervalText` for both anchors.
- Unit (new `intervalSlots.test.ts`): from due and from given; a late dose keeps the grid (from due) and moves the chain (from given); skipped and refused answer; a dose outside the window answers nothing; DST spring and fall, with every 1 h across fall-back giving two instances at one clock time, each with its own moment; a start in the future; only one upcoming; from-due missed once the next is due; from-given overdue with no next.

**Blocked by:** none. **Blocks:** 2, 3.

## Slice 2: The interval kind joins the schedule

Stack: no · Reads: docs/domain/medications.md · Tests: unit

**User stories:** US 1 (reading).

**Build:**

- `medication.ts`: `{ type: "interval", ...rule, amount? }` in `MedicationSchedule`, `MedicationScheduleInput` and `medicationScheduleZSchema` (through `intervalRuleZSchema`); `normalizeSchedule` reads it; `sameSchedule` compares interval fields.
- The typecheck-forced readers only: `medicationPass.ts` `slotTimes` (no clock slots), `medicationDisplay.ts` `scheduleText` (through `intervalText`), `apps/web/app/lib/medications/medications.sync.ts`. The rest change in later slices (_Architectural decisions_).

**Acceptance criteria:**

- Unit (`medication.test.ts`): an interval schedule parses and normalizes; a bad one fails with field paths; `sameSchedule` is true for two equal interval schedules and false when `everyMinutes`, `from` or `startsAt` differ.
- Unit (`medicationDisplay.test.ts`): the interval text for both anchors, with an amount.
- `pnpm typecheck` clean; existing tests unchanged.

**Blocked by:** 1. **Blocks:** 3, 5.

## Slice 3: Due interval doses, on the device and the server

Stack: no · Reads: docs/domain/medications.md, docs/domain/assistant.md, docs/domain/connectors.md · Tests: unit, integration

**User stories:** US 2, 4, 5, 10.

**Build:**

- `dueDoses.ts` `dueDoses`: interval medications take their slots from `intervalSlots` instead of `expandSlots`, and are left out of the as-needed filter; an open interval slot from yesterday is in today's `slots`; `DueDosesInput` gains `lastAnswers` (the latest answered dose per interval medication), **required**.
- Every caller supplies it: `apps/web/app/lib/medications/dueDoses.sync.ts` (a query beside the doses since yesterday), `packages/api/src/connectors/tools/todaysDoses.ts`, and `assistantActionService.ts`' two `dueDoses` calls.
- The dose writers: `assistantActionService.ts` `scheduledDose` finds an interval medication's instance (day and clock time), and both it and the device writer in `apps/web/app/lib/medications/medications.sync.ts` key an interval dose's id by its instance's moment (`doseSlotIdFor`, with `intervalWindowMinutes`), and `duePasses` keys an interval slot's round by its moment, so quick entry, `log_dose` and the app answer interval doses without a duplicate.

**Acceptance criteria:**

- Unit (`dueDoses.test.ts`): an interval med beside clock meds keeps both right; from-given overdue through midnight stays on Today; a dose matches its instance within the window; an extra dose warns (`doseWarnings`); the latest answer older than yesterday anchors from given.
- Unit (`duePasses.test.ts`): interval slots roll into time-keyed passes; Given all writes one dose each with distinct slot ids; `doseSlotIdFor` with the interval window gives a 23:30 instance given at 00:20 the instance's id; every 1 h across fall-back, the two 01:30 instances get distinct dose ids and rounds; a clock slot's id is unchanged.
- Unit (`medications.sync.test.ts`): the device's dose write for an interval medication near midnight takes the instance's slot id.
- Integration (`packages/data/src/services/assistantAction.int.test.ts`): a quick-entry dose of an interval medication answers its due instance with the slot id; a second one for the same instance takes a random id.

**Blocked by:** 1, 2. **Blocks:** 4, 5.

## Slice 4: Set and change an interval

Stack: no · Reads: docs/domain/medications.md, docs/domain/components.md · Tests: component, unit, integration

**User stories:** US 1, 2, 3, 4, 6.

**Build:**

- `routes/app/groups/medications/ScheduleFields.tsx`: a third choice, Every few hours, with new `IntervalFields.tsx` (hours 1–24, from due or from given, Next dose at with its default from the PRD's _Decisions_), inline, no overlay.
- `medicationFormData.ts` parses it into the interval kind; `routes/app/groups/medications/edit/route.tsx`'s loader reads the medication's latest answer and due instance for the Next dose at default.
- `MedicationListItem.tsx`: an interval medication gets the scheduled log control.
- `packages/data/src/db/seeds/medications.ts`: append one fictional interval medication.

**Acceptance criteria:**

- Unit (`medicationFormData.test.ts`): the three kinds parse; the Next dose at default for both anchors.
- Component (`medicationForm.browser.test.tsx`): choosing Every few hours and saving; editing 6 h to 4 h saves with the default next dose; the fields show the shared schema's messages.
- Component (`today.browser.test.tsx`): Today shows an interval med's due dose and its next only; Given logs it and the next comes due an interval later (from given).
- Component (`medicationList.browser.test.tsx`): an interval medication's row shows its text and log control.
- Integration (`medication.int.test.ts`): an interval schedule saves through the service and writes one change entry; saving it unchanged writes none.

**Blocked by:** 3. **Blocks:** none.

## Slice 5: History and the days ahead

Stack: no · Reads: docs/domain/medications.md · Tests: unit

**User stories:** US 7.

**Build:**

- `scheduleHistory.ts` `scheduleHistory`: interval before and after a change (old instances stop at the change; the new rule starts at its `startsAt`), and switches between kinds.
- `dueDoses.ts` `doseSlotsBetween` and `missedDoseCounts`: interval doses through `intervalSlots`, so visit prep counts them.
- `doseSchedule.ts` `doseSchedule`: interval medications out of its as-needed filter; from due laid out, from given only the next due one.

**Acceptance criteria:**

- Unit (`scheduleHistory.test.ts`): a 6 h to 4 h change on a day reads both rules; as needed to interval and back.
- Unit (`dueDoses.test.ts`, `doseSlotsBetween` cases): a week with an interval change counts missed doses under each rule.
- Unit (`doseSchedule.test.ts`): interval doses per day for both anchors.

**Blocked by:** 2, 3. **Blocks:** 6, 7.

## Slice 6: Past doses through the connector

Stack: no · Reads: docs/domain/medications.md, docs/domain/connectors.md · Tests: unit, integration

**User stories:** US 9, 10.

**Build:**

- connectors-3's `doseRecord.ts` (`doseRecord`, `sheetDoseOutcomes`): interval doses are in the record, and a mark names one by day and clock time; at the fall-back hour a repeated clock time names the earlier, and an optional `at` on the mark names either.
- `packages/api/src/connectors/tools/pastDoses.ts` and `logPastDoses.ts`: descriptions say interval doses are listed and marked like any other.

**Acceptance criteria:**

- Unit (`doseRecord.test.ts`): interval doses in the record for both anchors; a mark on an interval dose is `add`, one at a time it isn't due is `noSlot`; at the fall-back hour a bare 01:30 mark takes the earlier dose and one with `at` the later.
- Integration (`logPastDoses.int.test.ts`): a mark on a past interval dose logs it at the instance's moment with its slot id; `past_doses` then shows it given.

**Blocked by:** 5. **Blocks:** 7.

## Slice 7: The weekly sheet and adding through the connector

Stack: no · Reads: docs/domain/medications.md, docs/domain/connectors.md, docs/domain/components.md · Tests: unit, component, integration

**User stories:** US 8, 9.

**Build:**

- `print/week/weeklySheet.ts` and `WeeklyChart.tsx`: the "Every few hours" group, a G/S/R line per expected dose a day, times for from due, blank for from given.
- `packages/api/src/connectors/tools/addMedication.ts`: an interval branch in its schedule input (every hours, from, next dose at, default now), mapped to the interval kind and validated by the shared schema; its description.
- `listMedications.ts` (`maxPerDay` null for interval), `todaysDoses.ts` and `doseSchedule.ts` (the tool): descriptions and text mention interval doses.

**Acceptance criteria:**

- Unit (the `weeklySheet` tests): interval rows per day for both anchors.
- Component (`print.browser.test.tsx`): the weekly sheet shows the interval group.
- Integration (`addMedication.int.test.ts`): an every-4-hours medication added through the tool is in `list_medications` with its text and in `todays_doses`; an interval of 0 or 25 hours is an `isError` result that writes nothing.

**Blocked by:** 5, 6. **Blocks:** none.
