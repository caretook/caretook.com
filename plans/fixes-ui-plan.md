# Plan: Fixes (ui)

Small UI fixes: look, layout, wording and flow. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-ui`.

## Status

Landing mode: **run everything through** (started run-through, 2026-11-22; resumed run-through 2026-11-24). Start every ready slice, land each green wave, clean up; questions and reports only through `pnpm prd ask`.

Waves 1–3 landed (PR #78, #84, #86); details in the history file.

**Wave 4** (2026-11-24, session 1): slices 18–33 written from the triaged items; base `prd/fixes-ui` = dev 91f30299. Running topic: symptom-catalog (its hot files excluded). Chains: 22→23, 25→26→27→28, 30→31. Models: sonnet for 20, 21, 28; opus for the rest. Merge order: handed-off slices merge in plan order among themselves, without waiting for an earlier slice still running when a chain waits on a later one (20 and 25 merged before 19, 21, 22, 24). At landing fold into docs: care-groups.md (RoleHelp dialog, GROUP_ROLES sees/changes; member rows carry no role description on purpose), providers.md (phone label select with Custom).

Held for later waves, with why: B-325 (Capacitor); B-693, B-697 (wait for the toast system B-669); B-694 (user approves each form live: never in an unattended slice); B-621, B-676, B-762 (quick-entry, symptom-catalog hot); B-617, B-748, B-756 (timeline filters, symptom-catalog hot); B-680 (the user may add preferences: ask before building); B-684, B-695 (app-wide sweeps: a wave of their own); B-698, B-700, B-701, B-606 (medication cards and passes: open questions to ask when built; do together); B-594 then B-672, B-673 (after slice 29's ComboBox option); B-679 (after slice 31); B-583 (connector rename, decided); B-735 (stale client, cause unknown); B-736, B-737 (timeline jump and links, together); B-765 (live note full screen); B-664 (after slice 23, same file); B-613 (motion, broad ui/ change); B-691 then B-692.

**Session 2 (resumed 2026-11-24 after the mid-wave rotation):** merged 18, 20, 21, 24, 25, 30, 32, 33. Respawned with `--continue` (opus): 19 (B-663), 22 (B-683), 26 (B-687), 29 (B-668); each branch had its commit, clean worktree. 31 (B-678): worktree made this session, agent spawned (opus), item claimed. Merged 26 (3c1d55a1, adds `CreateResult` in `lib/core/api.ts`) and 29 (760dca52, ComboBox `opensOn="typing"`, for ui-kit.md at landing); 27 started (opus). Merged 22 (d832219e); 23 started (opus). Merged 19 (28e7247b), 31 (dad4b7b0; MemberItem.tsx split out, own card's "What this group sees" now a folded disclosure: fold into care-groups.md at landing). Then: 23 after 22 merges; 27 after 26; 28 after 27. The wave gate after all 16 merge: the hand dev merge below, then `pnpm prd tier` and `pnpm prd ci run <tier> --wait`. Docs to fold at landing: ui-kit.md (ChoiceGroup `layout="grid"`), care-periods.md (type grid), care-groups.md (RoleHelp, `GROUP_ROLES` sees/changes; member rows show no role description on purpose), providers.md (phone label select with Custom), medications.md (Back origin via `lib/medications/medicationOrigin.ts`). Slice 33 touched 13 files (hook warned): split earlier next time.

**CI hold lifted:** the third components shard landed on dev as 2aff6468. **At the wave boundary (not mid-wave), sync by hand until B-771 lands** (`pnpm prd sync` can miss dev's CI lists): `git fetch origin && git merge origin/dev -m "chore(fixes-ui): merge dev into prd/fixes-ui"`; then `git diff origin/dev -- .github/workflows/ci.yml scripts/` shows only our changes (the merge is also what brings in new loop tooling: `pnpm prd` runs this worktree's `scripts/loops/`), `ci.yml` has `components-3`, `scripts/ci/quarantine.txt` has the B-633, B-653 and B-769 lines; `pnpm install` if the lockfile moved. Tell the user if that merge conflicts. The first components run is components-3's first real test: report anything odd from it.

Notes for every wave:

- Run checks with `NODE_OPTIONS=--max-old-space-size=6144` until B-576 is confirmed fixed.
- Small tidy for a later slice: stale comments in `lib/providers/contactActions.ts` and `components/providers/ContactActions.tsx` still mention directory rows.

| Slice | Item  | State           | Merge    |
| ----- | ----- | --------------- | -------- |
| 1     | B-256 | merged (opus)   | b5373bc9 |
| 2     | B-416 | merged (opus)   | f6f40e4f |
| 3     | B-538 | merged (opus)   | 439b6571 |
| 4     | B-412 | merged (opus)   | 91aced06 |
| 5     | B-519 | merged (opus)   | b2aa214a |
| 6     | B-413 | merged (opus)   | 13ac9f5a |
| 7     | B-422 | merged (opus)   | 8834115b |
| 8     | B-421 | merged (opus)   | fc5dbe18 |
| 9     | B-319 | merged (opus)   | 488e09bf |
| 10    | B-536 | merged (sonnet) | c9c510cf |
| 11    | B-575 | merged (sonnet) | 123f2b24 |
| 12    | B-537 | merged (opus)   | 5566480a |
| 13    | B-535 | merged (opus)   | 1dc972d8 |
| 14    | B-316 | merged (opus)   | 3c7a6607 |
| 15    | B-585 | merged (opus)   | 52d2e14b |
| 16    | B-592 | merged (opus)   | 6af2f056 |
| 17    | B-603 | merged (opus)   | 18180d36 |
| 18    | B-618 | merged (opus)   | 4ecaa3f5 |
| 19    | B-663 | merged (opus)   | 28e7247b |
| 20    | B-702 | merged (sonnet) | a0510b3d |
| 21    | B-682 | merged (sonnet) | 5d3a4404 |
| 22    | B-683 | merged (opus)   | d832219e |
| 23    | B-763 | started (opus)  |          |
| 24    | B-685 | merged (opus)   | 4fee8d5d |
| 25    | B-686 | merged (opus)   | 948eebc8 |
| 26    | B-687 | merged (opus)   | 3c1d55a1 |
| 27    | B-688 | started (opus)  |          |
| 28    | B-674 | waits (sonnet)  |          |
| 29    | B-668 | merged (opus)   | 760dca52 |
| 30    | B-677 | merged (opus)   | 7603ae58 |
| 31    | B-678 | merged (opus)   | dad4b7b0 |
| 32    | B-629 | merged (opus)   | 4cbcd7b2 |
| 33    | B-699 | merged (opus)   | 98a3381c |

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

## Wave 3 (written 2026-11-22 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency, and no edits to the hot files of test-gates or assistant-access (`pnpm backlog prd list`), including `routes/app/groups/settings/assistants/`. Loops don't edit `docs/`. If a fix can't be done within this, stop and say so in the hand-off.

## Slice 15: Stepping the hour past 11 AM reaches 12 PM (B-585)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/appointments.md · Tests: component

**Problem.** In `DateTimeField`, React Aria's 12-hour segment wraps inside AM/PM, so stepping up from 11 AM gives 12 AM the same day, and Ends then shows "Must be after the start".

**Build.** In `components/ui/date/DateTimeField.tsx`, make the hour segment's arrow-key stepping move through the day's 24 hours: 11 AM up is 12 PM, and 12 PM down is 11 AM. The date never changes: 11 PM up wraps to 12 AM on the same day, and 12 AM down to 11 PM, as they do today. Typing into the segment and the AM/PM segment behave as before.

**Acceptance criteria.**

- [ ] Component test: ArrowUp from 11 AM gives 12 PM, and ArrowDown from 12 PM gives 11 AM.
- [ ] Component test: ArrowUp from 11 PM gives 12 AM on the same date.
- [ ] Component test: an event from 10 AM to 11 AM, with Ends stepped up, shows 12 PM and no "Must be after the start".

## Slice 16: Planner event card gets a footer for its actions (B-592)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md, docs/domain/todos.md · Tests: component

**Problem.** On a phone, `UpcomingRow`'s 5.5rem time column wraps the time and stacks call, directions and initials into a tall block.

**Build.** In `routes/app/groups/planner/UpcomingRow.tsx`, drop the time column. The kind icon sits on the left and the ⋯ menu on the right. The time runs on one line above the title, with the repeat mark beside it; then the title, with-line and address at full width, without the address line's duplicate map pin. A footer row holds labelled Call and Directions buttons on the left and the author's initials on the right. A card with no actions has no footer, and its initials end the last line. Keep the whole-row link, filter links, read-only Easy mode and the cancelled state. Compare `PlannerTodoRow.tsx`: match it only if it shares the same column problem, and say in the hand-off which you did.

**Acceptance criteria.**

- [ ] Component test at phone width: the time renders on one line above the title, with the repeat mark beside it.
- [ ] Component test: a card with a contact shows labelled Call and Directions in a footer, with the initials on the right.
- [ ] Component test: a card with no actions has no footer, and its initials still show.
- [ ] Component test: the address line has no map pin of its own.
- [ ] Component test: the whole-row link, filter links, Easy mode's read-only card and the cancelled state still work.

## Slice 17: The remaining sheets guard unsaved changes (B-603)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/care-groups.md, docs/domain/providers.md · Tests: component

**Problem.** Slice 14 left `InviteSheet`, `InviteLinks`, provider import, `RepeatSheet` and `VisitPrepSheet` without the discard prompt.

**Build.** Pass `Sheet`'s existing `guardChanges` in `routes/app/groups/settings/members/InviteSheet.tsx`, `InviteLinks.tsx`, `routes/app/groups/providers/import/route.tsx`, `components/repeat/RepeatSheet.tsx` and `components/visitPrep/VisitPrepSheet.tsx`. Verify each first: one that holds no editable form, or isn't a `Sheet`, stays as it is and the hand-off says why. No change to the guard itself (B-601 and B-602 cover its gaps in fixes-bug). A successful save, send or import never prompts.

**Acceptance criteria.**

- [ ] Component test, for each sheet wired: a changed form asks before closing, and Discard closes it.
- [ ] Component test, for each sheet wired: an unchanged form closes without asking.
- [ ] Component test: a successful invite and a successful import close without asking.

## Wave 4 (written 2026-11-24 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency, and no edits to symptom-catalog's hot files (`pnpm backlog prd list`): the timeline's `FilterSheet.tsx`, `TimelineFilters.tsx`, `SymptomFields.tsx`, `FeelingFields.tsx`, `daySummary*`, `components/quick-entry/`, `lib/timeline/timelineFilters.ts`, `lib/timeline/timeline.sync.ts`, `lib/appointments/visitPrep*`. Loops don't edit `docs/`; the orchestrator folds wording and decisions in at landing. Each slice's backlog item (`pnpm backlog show B-<n>`) holds the user's notes: read them, and where a later note replaces an earlier one, the later wins. If a fix can't be done within this, stop and say so in the hand-off.

## Slice 18: Change care period sits left of the period icon (B-618)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md, docs/domain/care-periods.md · Tests: component

**Problem.** On Today's day header, Change sits after the period text, so Today's period shifts left of the same period on the days below.

**Build.** In `DayPeriod` (`routes/app/groups/timeline/DayHeader.tsx`) the order becomes [Change] [period icon] [text] [+]. Only a button move (the user's last note on B-618): keep the group right-aligned, add no column or fixed width. A long name at phone width and Easy mode still wrap cleanly.

**Acceptance criteria.**

- [ ] Component test: on Today, Change comes directly before the period icon, and + stays last.
- [ ] Component test: a day without Change (a past day, a read-only viewer) renders icon, text and + in the same order.

## Slice 19: Menu section headings get room above them (B-663)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component

**Problem.** In a sectioned menu, a section heading sits so close to the item above that it reads as part of the previous group (Day summaries under Cards in the Timeline view menu).

**Build.** Fix it once in the shared `components/ui/Menu.tsx` section heading: a clear gap above every heading but the first (a divider too if it reads better), so every sectioned menu gets it. `TimelineViewMenu.tsx` only if it overrides the spacing.

**Acceptance criteria.**

- [ ] Component test: a heading after another section sits at least 8px below the last item above it; the first heading keeps its current spacing.

## Slice 20: Medications Print menu text fits its box (B-702)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/medications.md · Tests: component

**Problem.** The Print menu's item text ("Every medication, and who to call") crowds or overflows the 224px menu.

**Build.** Widen `routes/app/groups/medications/PrintMenu.tsx` to `Menu`'s `width="lg"`. Check `GroupMenu` and `TimelineViewMenu`, which share the item layout, and widen only one whose text also crowds; say which in the hand-off.

**Acceptance criteria.**

- [ ] Component test at phone width: every Print menu item's text fits inside the menu (no item's scroll width exceeds its client width) and the menu stays inside the viewport.

## Slice 21: Planner empty lists have no icons (B-682)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md · Tests: component

**Problem.** The icons in the Planner tabs' empty lists look goofy.

**Build.** Stop passing `emptyMark` to `EmptyState` in `routes/app/groups/planner/UpcomingList.tsx` (Upcoming and Past) and `routes/app/groups/todos/TodoSections.tsx` (Todos), so all three show the quiet text line. Other screens keep their icons; keep the prop wherever something still uses it. Update tests that expect the icon.

**Acceptance criteria.**

- [ ] Component test: the empty Upcoming, Past and Todos tabs show their text and no icon.

## Slice 22: The current tab fills its whole section (B-683)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/app-shell.md · Tests: component

**Problem.** The tab selector and the phone bottom menu show each entry as its own rounded button; the user wants the whole section to highlight.

**Build.** `components/ui/TabNav.tsx`: a segmented bar with no inset padding, gap or per-link rounding, so the current and hover fills reach the section edges, clipped by the bar's outer shape. The phone `TabBar` in `routes/app/layout/SectionNav.tsx` likewise: each link an equal `flex-1` full-height section with no rounding, the bar `overflow-hidden`. Desktop `SectionNav` stays as it is. Keep section accents, count badges, sideways scrolling, touch targets of at least 44px, `aria-current`, labels, the safe-area position and spacer, and use an inset focus ring so clipping doesn't hide it. Update the components' comments.

**Acceptance criteria.**

- [ ] Component test: the current TabNav link's box reaches the bar's top and bottom edges, and `TabNav.browser.test.tsx`'s dark contrast test still passes.
- [ ] Component test: TabBar links share the bar's width equally, are at least 44px tall, and the current one is marked `aria-current`.

## Slice 23: Installed iOS app: the bottom bar sits near the screen's bottom (B-763)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md · Tests: component

**Blocked by:** slice 22.

**Problem.** In the installed PWA on iOS the phone bottom bar floats too high above the screen's bottom edge.

**Build.** In `TabBar` (`routes/app/layout/SectionNav.tsx`), find where the bottom offset stacks a fixed gap on top of `env(safe-area-inset-bottom)` (and `viewport-fit` in `root.tsx` if relevant), and change it so the bar sits just above the home indicator: the safe area, plus at most a small gap, not both at full size. The page spacer follows the same value. Browsers without an inset keep today's position. Say in the hand-off what you could not check without an iPhone.

**Acceptance criteria.**

- [ ] Component test: with a simulated bottom inset (a CSS variable or style override), the bar's bottom offset is the inset plus at most 8px; with no inset it is unchanged.

## Slice 24: Care period types in a two-column grid (B-685)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/care-periods.md · Tests: component

**Problem.** Where is care now? shows ten options as a wrapping row of joined buttons, which looks cluttered.

**Build.** Add a grid layout to `components/ui/ChoiceGroup.tsx` (a small option; other ChoiceGroups keep their joined row) and use it in `routes/app/groups/periods/PeriodForm.tsx`: ten plain text options in two equal columns, five rows, at phone and desktop widths, one clear selected state. Keep native radios (name, arrow keys, the radiogroup and its error), the URL prefill, the edit value and Other's Label field. The longest labels fit at phone width without truncating.

**Acceptance criteria.**

- [ ] Component test at phone width: the ten options lay out in two equal columns of five, and none is truncated.
- [ ] Component test: picking Other still shows the Label field, and existing period tests that pick a type as a radio pass.

## Slice 25: Provider phone type is a dropdown with Custom (B-686)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/providers.md · Tests: component

**Problem.** A provider's phone type is a free-text box.

**Build.** Give the shared `components/contact/PhoneFields.tsx` an option for a label select, used only by `ProviderForm` (add and edit); the recipient and user contact forms keep the text input. A native select: blank, Office, Mobile, Front desk, Nurse line, After hours, Refills, Fax, Custom. Custom reveals a text input (phoneLabel limit 40) and moves focus to it. Each row still posts one `phoneLabel`, in order, so `phonesFromForm` and row errors keep working. On edit, a stored label matching an option selects it; any other opens Custom with its text. Check the row at phone width.

**Acceptance criteria.**

- [ ] Component test: choosing Nurse line saves the label "Nurse line"; choosing Custom and typing "Billing" saves "Billing".
- [ ] Component test: editing a provider whose phone is labelled "Billing" shows Custom with "Billing"; a blank label stays blank.
- [ ] Component test: the recipient contact form still has a text label input.

## Slice 26: Saving a new provider opens its page (B-687)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/providers.md, docs/domain/app-shell.md · Tests: component

**Blocked by:** slice 25.

**Problem.** After Add a provider, the sheet returns to the list instead of the new provider.

**Build.** `routes/app/groups/providers/new/route.tsx`: return the id `createProvider` already gives (a route-local result type, or widen `ActionResult` additively), pass it to the new sheet's `onDone`, and navigate to `appUrls` provider page with `replace`. Cancel, Escape and a tap outside still close to where the user was. It stays local and offline. Edit is unchanged; `ProviderForm` stays navigation-free. Shape the id return so slice 27 can reuse it.

**Acceptance criteria.**

- [ ] Component test (`providerSheets.browser.test.tsx`): saving a new provider lands on its page, and Back goes to the directory, not the form.
- [ ] Component test: cancelling the new provider sheet returns to the list.

## Slice 27: Saving a new medication opens its page (B-688)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/medications.md, docs/domain/app-shell.md · Tests: component

**Blocked by:** slice 26.

**Problem.** After Add a medication, the sheet returns to the tab instead of the new medication.

**Build.** Same as slice 26 for `routes/app/groups/medications/new/route.tsx`, reusing its id-return approach: navigate to `appUrls.medication` with `replace`, so Back goes to the tab the sheet opened over. Cancel, Escape and a tap outside still close to that tab. If the conditions step refuses after the medication is written, still land on the new medication's page with the error shown there or said in the hand-off, never inviting a duplicate save. `MedicationForm` stays navigation-free.

**Acceptance criteria.**

- [ ] Component test (`medicationForm.browser.test.tsx`): saving a new medication lands on its page; Back returns to the tab it opened over.
- [ ] Component test: cancelling returns to that tab.

## Slice 28: A new medication starts on As needed (B-674)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/medications.md · Tests: component

**Blocked by:** slice 27.

**Problem.** The full Add medication form starts on At set times; the user wants As needed by default.

**Build.** In `components/medications/ScheduleFields.tsx`, a new medication starts on As needed; an existing one keeps its schedule. Switching to At set times still offers the same starting slots (`scheduleSlots.ts`). The choice stays visible. Update the form tests that assume the old default.

**Acceptance criteria.**

- [ ] Component test: a new medication form shows As needed selected and saves as needed without touching the field.
- [ ] Component test: switching to At set times shows the usual starting slots; editing a scheduled medication still shows At set times.

## Slice 29: Condition names suggest from the first typed letter (B-668)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/profiles.md · Tests: component

**Problem.** Add a condition opens an unfiltered list of names as soon as the field is focused.

**Build.** Add an option to the shared `components/ui/ComboBox.tsx` (for example `menuTrigger="input"` with no list for an empty field), used only by `ConditionNameField`; the other pickers keep browsing on focus. Nothing on focus with an empty field; the first character opens the list filtered by the existing word-prefix match; clearing closes it. If the list also fails to open on the first character, fix that too. Name the option so the allergy and medication name fields (B-672, B-673) can reuse it.

**Acceptance criteria.**

- [ ] Component test: focusing the empty condition name opens no list; typing "d" opens a list of matching names only; clearing the field closes it.
- [ ] Component test: a provider picker still opens its list on focus.

## Slice 30: What can each role do? (B-677)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: component

**Problem.** The role pickers put each role's description only in an option `title`, which phones don't show.

**Build.** The user's decision: a "What can each role do?" link beside the Role label, opening a native `<dialog>` (the kit's dialog if there is one) that lists every role with what it can see and change, in plain words. Use it in `InviteSheet.tsx`, `InviteLinks.tsx` and `MembersList.tsx` (one shared piece beside `RoleOptions.tsx`); the native selects stay. Keep the selected role's short help line in the invite forms and add it where missing. Rewrite the thin `GROUP_ROLES` wording (`packages/data/src/constants/roles.ts`) and check each line against docs/domain/care-groups.md; list the final wording in the hand-off. The dialog opens from inside the invite sheet: check focus return and stacking. Staff `/admin` pickers are out of scope.

**Acceptance criteria.**

- [ ] Component test: the link beside Role opens a dialog naming every role with its description, and closing it returns focus to the link, inside the invite sheet too.
- [ ] Component test: Manage members shows the same link.

## Slice 31: Member cards show full names and details (B-678)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: component

**Blocked by:** slice 30.

**Problem.** On the Members page, names and history lines are truncated ("Robert Bo ...", "Joined Nov...") because the role select and Leave/Remove squeeze them.

**Build.** Redo `MemberItem` (`settings/members/MembersList.tsx`): identity (avatar, full name, relationship, history) on its own line, role and actions below it, or right-aligned only where there is room. Long names wrap rather than cut. Tidy the error line, and fold the nested What this group sees form on your own card behind a disclosure so it doesn't dominate. Keep badges, relationship, contact lines, the offline state and slice 30's link.

**Acceptance criteria.**

- [ ] Component test at phone and desktop widths: a long member name and its history line are not truncated (scroll width equals client width).
- [ ] Component test: role change, Leave and Remove still work, and your own card's sharing form still opens and saves.

## Slice 32: Dismissing the setup card keeps keyboard focus (B-629)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

**Problem.** Dismissing the Getting started card removes the focused button with it, so focus falls to the body.

**Build.** In `routes/app/groups/timeline/GettingStartedCard.tsx` (and `route.tsx` if it owns the state), move focus on dismiss to a sensible next place: the quick entry box if present, else the Timeline heading (with `tabIndex={-1}`). Don't edit `components/quick-entry/`; focusing it from outside through an existing ref or id is fine.

**Acceptance criteria.**

- [ ] Component test: after dismissing the card with the keyboard, `document.activeElement` is the chosen target, not `body`.

## Slice 33: Medication page Back returns to where you came from (B-699)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/medications.md, docs/domain/app-shell.md · Tests: component

**Problem.** The medication page's Back always goes to the Medications list.

**Build.** Pass the origin (URL and label) in link state, as `todo/route.tsx` does with `listSearchFromState`, from the links that open a medication: Schedule, the list, the passes list, a provider, a todo, search, a condition, timeline entries (`MedicationEntryText`). Not a bare `navigate(-1)`: it must survive sheets opened over the page and keep the origin's filters. `medication/route.tsx`'s `BackLink` names the origin (Schedule, Timeline, Search…). A direct load or a link without state falls back to the Medications list. Deleting still goes to the list. Skip any link in a symptom-catalog hot file and say so.

**Acceptance criteria.**

- [ ] Component test: opening a medication from Schedule shows Back "Schedule" and returns there; from search, Back returns to the same search.
- [ ] Component test: a direct load shows Back "Medications" to the list.
