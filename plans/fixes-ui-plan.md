# Plan: Fixes (ui)

Small UI fixes: look, layout, wording and flow. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-ui`.

## Status

Landing mode: **run everything through** (started run-through, 2026-11-22). Start every ready slice, land each green wave, clean up; questions and reports only through `pnpm prd ask`.

Wave 1: slices 1–9 (opus), **landed in dev as bb1133e0 through PR #78** (2026-11-22). Codex clean on 19a195c; full check passed on 887736df; report filed. No slice is in flight.

Wave 2: slices 10–14, written 2026-11-22 after a clean sync (dev had only wave 1's landing and backlog commits). Running topics are test-gates and quick-entry-2; no slice touches their hot files. Slices 10, 11 and 12 started 2026-11-22 (worktrees made, agents spawned); 13 after 10 is merged; 14 after 13 is merged. Models: sonnet for 10 and 11 (edits spelled out), opus for 12, 13 and 14. `pnpm backlog doctor` reports two old inbox-tag findings (B-548, B-549), neither in this topic.

Left for later: B-325 (native safe area and cold start) waits for the Capacitor work, as its triage says.

Notes for the next wave:

- Until B-576 (local lint runs out of memory) is fixed, run checks and landings with `NODE_OPTIONS=--max-old-space-size=6144`; lint passes Node's 4 GB default even on a quiet machine.
- A print-menu test can fail in a full run and pass alone (B-552, the known race).
- Small tidy for a later slice: stale comments in `lib/providers/contactActions.ts` and `components/providers/ContactActions.tsx` still mention directory rows.

| Slice | Item  | State                        | Merge    |
| ----- | ----- | ---------------------------- | -------- |
| 1     | B-256 | merged (opus)                | b5373bc9 |
| 2     | B-416 | merged (opus)                | f6f40e4f |
| 3     | B-538 | merged (opus)                | 439b6571 |
| 4     | B-412 | merged (opus)                | 91aced06 |
| 5     | B-519 | merged (opus)                | b2aa214a |
| 6     | B-413 | merged (opus)                | 13ac9f5a |
| 7     | B-422 | merged (opus)                | 8834115b |
| 8     | B-421 | merged (opus)                | fc5dbe18 |
| 9     | B-319 | merged (opus)                | 488e09bf |
| 10    | B-536 | in flight (sonnet)           | -        |
| 11    | B-575 | handed off d7eafff5 (sonnet) | -        |
| 12    | B-537 | in flight (opus)             | -        |
| 13    | B-535 | blocked by 10 (opus)         | -        |
| 14    | B-316 | blocked by 13 (opus)         | -        |

## Wave 1 (written 2026-11-22 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency, and no edits under `components/ui/`, `app.css`, `lib/app-shell/`, `lib/timeline/entryDisplay.ts` or `routes/dev/ui/` (ui-kit-3 is running). If a fix can't be done without one, stop and say so in the hand-off.

## Slice 1: Planner call and directions icons sit under the time (B-256)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md · Tests: component

**Problem.** On the Planner schedule, the call and directions icons sit beside the title and description, which takes width on a phone.

**Build.** In `routes/app/groups/planner/UpcomingRow.tsx`, move `ContactActions` under the time, so the title and description get the row's full width.

**Acceptance criteria.**

- [ ] Component test (`planner.browser.test.tsx`): a row with a contact shows its call and directions actions inside the time column.
- [ ] A row with no contact leaves no empty gap under the time.

## Slice 2: Planner owner pill sits under the time (B-416)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/todos.md · Tests: component

**Blocked by:** slice 1.

**Problem.** The owner pill under the title makes Planner and Planner list rows too busy.

**Build.** Move the owner pill below the time/date field on the Planner's rows (`UpcomingRow.tsx`, `PlannerTodoRow.tsx`, whichever show it). Keep its filter behaviour. Stack it with slice 1's actions in the same column.

**Acceptance criteria.**

- [ ] Component test: the owner pill renders in the time column, not under the title, and still filters when it did before.

## Slice 3: Planner tabs become Upcoming, Past, Todos (B-538)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md, docs/domain/todos.md · Tests: component

**Problem.** The Upcoming and Past chips read as filters, and the Planner tab always links back to Upcoming.

**Build.** In `routes/app/groups/planner/PlannerHeader.tsx`, the main pill tabs become Upcoming | Past | Todos, and the chip row goes. The Planner heading names the section. The filter button sits beside the tabs on Upcoming. Routes stay `/planner` and `/planner/past`. Switching to Todos and back returns to Past if Past was the last view.

**Acceptance criteria.**

- [ ] Component test: the three tabs render, each marks itself current on its route, and the old chips are gone.
- [ ] Component test: the filter button shows on Upcoming, beside the tabs.
- [ ] Component test: Past, then Todos, then back lands on Past.

## Slice 4: Timeline day header keeps its actions on the right (B-412)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md, docs/domain/care-periods.md · Tests: component

**Problem.** The day header's plus button isn't at the far right, so its actions are split.

**Build.** In `routes/app/groups/timeline/DayHeader.tsx`, put the plus button at the far right, swapping with the care period. The "change" link that adds a care period becomes an icon button with an accessible name.

**Acceptance criteria.**

- [ ] Component test: the plus button is the header's last action.
- [ ] Component test: the care period control is an icon button, found by its accessible name, and still opens the care period flow.

## Slice 5: Easy mode button lines up with the Timeline title (B-519)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

**Problem.** At phone width, the Easy mode toggle sits lower than the Timeline heading.

**Build.** Align the toggle with the title's row (same vertical center) in `TimelineHeader.tsx` or `EasyModeToggle.tsx`, wherever the offset comes from. Layout only.

**Acceptance criteria.**

- [ ] Component test (`timelineHeader.browser.test.tsx`) at phone width: the toggle's and heading's vertical centers match within 1px.

## Slice 6: Past providers are no longer collapsed (B-413)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/providers.md · Tests: component

**Problem.** Collapsing past providers on the list breaks search, and the list is never long enough to need it.

**Build.** In `routes/app/groups/providers/DirectoryResults.tsx` (and `route.tsx` if it holds the state), always show past providers, keeping their section label. Remove the collapse state.

**Acceptance criteria.**

- [ ] Component test: past providers show with no expand step.
- [ ] Component test: a search matching only a past provider shows that provider.

## Slice 7: Provider contact links move to the details sheet (B-422)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/providers.md · Tests: component

**Blocked by:** slice 6.

**Problem.** Contact links in the provider rows make it hard to know what to click. People usually want the notes open while they make contact.

**Build.** Remove the contact information and links from `ProviderListItem.tsx`, so a row has one click target that opens the details sheet. Make sure the sheet shows each contact as a working link (call, email, directions), adding any that are missing.

**Acceptance criteria.**

- [ ] Component test: a provider row shows no contact details or links.
- [ ] Component test: the details sheet shows working `tel:`, `mailto:` and map links for a provider that has them.

## Slice 8: Medication type pill floats right (B-421)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

**Problem.** The type pill on medication list items doesn't sit at the right of the row.

**Build.** In `routes/app/groups/medications/MedicationListItem.tsx`, align the type pill to the row's right edge. A long name wraps or truncates without pushing it off the row.

**Acceptance criteria.**

- [ ] Component test (`medicationList.browser.test.tsx`) at phone width: the pill's right edge sits at the row content's right edge, with a long name too.

## Slice 9: Linked lists don't flash an empty state while loading (B-319)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/sync.md, docs/domain/providers.md · Tests: component

**Problem.** From a code review, not re-verified: a provider's linked entries show "No notes or events yet", and linked todos show "Former member", before the first watch answers, because the queries start from empty rows (`routes/app/groups/provider/LinkedEntries.tsx`, `components/todos/useLinkedTodos.ts`).

**Build.** Verify each first; say in the hand-off if one is stale. Tell "not answered yet" apart from "answered, empty", and render neither the empty state nor the fallback name until the first answer. Use what `useLiveQuery` already offers if it can; a change to the hook itself is out of scope unless it is under neither hot path and stays additive.

**Acceptance criteria.**

- [ ] Component test: before the first answer, neither "No notes or events yet" nor "Former member" shows.
- [ ] Component test: after an empty answer the empty state shows, and after a real answer the real name shows.

## Wave 2 (written 2026-11-22 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency, and no edits under `components/quick-entry/` or `routes/app/groups/timeline/timelineQuickEntry*` (quick-entry-2 is running) or the test-gates hot files. Loops don't edit `docs/`; the orchestrator folds wording and decisions in at landing. If a fix can't be done within this, stop and say so in the hand-off.

## Slice 10: Danger text meets 4.5:1 in light (B-536)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component

**Problem.** Menu's danger item and `buttonClass`'s `dangerQuiet` use `text-error` (about 2.9:1 in light). `DateTimeField`'s placeholder segments, at 60% opacity, are a little under 4.5:1 on the light field fill.

**Build.** Use `text-error-ink` in `components/ui/Menu.tsx` and `components/ui/buttonClass.ts`. Lift the placeholder segments in `components/ui/date/DateTimeField.tsx` to the `text-faint` tone.

**Acceptance criteria.**

- [ ] Component test: a danger menu item and a `dangerQuiet` button carry `text-error-ink`, not `text-error`.
- [ ] Component test: a `DateTimeField` placeholder segment uses the `text-faint` tone.

## Slice 11: Planner tabs are named for what they hold (B-575)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md · Tests: component

**Problem.** The Planner tabs' nav is still labelled "Planner or todos", but its tabs are Upcoming, Past and Todos.

**Build.** Change the label in `routes/app/groups/planner/PlannerHeader.tsx` to "Upcoming, past or todos". Update every selector that names it: `planner.browser.test.tsx`, `todos.browser.test.tsx`, `sectionAccents.browser.test.tsx`, `easyRolePages.browser.test.tsx` and `scripts/browser-checks/roundtrip.spec.mjs`.

**Acceptance criteria.**

- [ ] Component test: the Planner's tab nav is found by the name "Upcoming, past or todos".
- [ ] No "Planner or todos" remains in the repo outside `plans/` and the backlog.

## Slice 12: One word in the app: Event (B-537)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/appointments.md, docs/domain/todos.md, docs/domain/timeline.md · Tests: component

**Problem.** The Planner says "Appointment" where the Timeline says "Event", for the same thing.

**Build.** Wording only: the stored kind stays `event`; ids, routes, table names, code identifiers and URLs stay as they are. Rename visible text to Event in the Planner Add menu and Show filter (`PlannerHeader.tsx`, `upcomingFilters.ts`), `ProviderVisitPrep.tsx`, `TodoLinkFields.tsx`, `todo/TodoLinks.tsx`, the Today card and its status text, `EasyNow`, `FeedCard.tsx`, `calendarPage.ts`, `reminderChoices.ts`, visit prep copy and the `routes/dev/ui/` samples. Use "Upcoming event" or "Past event" only on the entry page heading (`entryHeading` in `entryPage.ts`), the Today card's next line and the todo form's picker. Leave marketing pages and health-data-privacy text alone. If the calendar's generic "Appointment for …" text is also produced on the server, change it there too and say so in the hand-off.

**Acceptance criteria.**

- [ ] Component test: the Planner Add menu offers "Event" and no "Appointment".
- [ ] Component test: the entry heading reads "Upcoming event" or "Past event" by timing, and the todo picker's placeholder says events.
- [ ] A search of visible strings outside marketing and privacy text finds no "Appointment"; the hand-off lists any kept on purpose.

## Slice 13: Hour-first time picker (B-535)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/medications.md, docs/domain/appointments.md · Tests: component

**Blocked by:** slice 10.

**Problem.** Nearly every time entered is on the hour, but the native time input takes fiddling, and the iPhone wheel ignores `step`.

**Build.** Add a small shared picker in `components/ui/`: an hour select and a 00/15/30/45 minute select, on native `<select>`s so it works on phones. A new value defaults to the current hour at :00. A saved off-grid time such as 08:10 stays intact and shows as an extra minute option. Use it for medication dose times (`medications/ScheduleFields.tsx`), pass time (`passes/PassForm.tsx`), todo due time (`todos/TodoForm.tsx`) and series edit times (`components/repeat/SeriesEditSheet.tsx`). Give event Starts and Ends (`components/schedule/ScheduleFields.tsx`, so scheduling and `RescheduleSheet` too) the same default and 15-minute minutes. The logs (`DoseForm`, `EntryForm`, `PassLogForm`), `PeriodForm` and `VisitPrepSheet` keep the current minute.

**Acceptance criteria.**

- [ ] Component test: a new picker shows the current hour at :00 and offers 00, 15, 30 and 45.
- [ ] Component test: a saved 08:10 shows and submits as 08:10 until changed.
- [ ] Component test: each named form submits the same time format it did before.
- [ ] Component test: a log form still defaults to the current minute.

## Slice 14: Unsaved changes aren't lost by accident (B-316)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md · Tests: component

**Blocked by:** slice 13.

**Problem.** A click outside, Escape or Back silently discards a half-filled sheet, such as a medication, emergency or provider form.

**Build.** Give `components/ui/Sheet.tsx` an opt-in unsaved-changes guard, working with the navigation hold in `useSheetExit.tsx`. When the form differs from its starting values, a click outside, Escape, Close or Back opens the kit's `ConfirmDialog` ("Discard changes?", with Keep editing and Discard). An unchanged form closes as it does today, and a successful save never prompts. Wire it into every sheet that edits data, including medications, passes, allergies, periods, profile sections, conditions, providers, timeline entries, doses and todos. Leave read-only and filter sheets alone. Quick entry stays out of scope.

**Acceptance criteria.**

- [ ] Component test: a changed form asks before closing on Escape, a click outside, Close and Back; Keep editing keeps the values, Discard closes.
- [ ] Component test: an unchanged form closes without asking.
- [ ] Component test: saving a changed form closes without asking.
- [ ] Component test: the sheet's exit motion and focus return still work after Discard.
