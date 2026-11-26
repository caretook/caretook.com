# Plan: Fixes (ui)

Small UI fixes: look, layout, wording and flow. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-ui`.

## Status

**History:** earlier hand-offs and landed waves' rows are in [`plans/fixes-ui-history.md`](fixes-ui-history.md) (`pnpm prd status-trim`).

Landing mode: **run everything through** (started run-through, 2026-11-22; resumed run-through 2026-11-24). Start every ready slice, land each green wave, clean up; questions and reports only through `pnpm prd ask`.

Waves 1–4 landed (PR #78, #84, #86, #158); details in the history file. Wave 4 landed 2026-11-24 as dev 536d157, `--no-review` (Codex out of credits), CI components green (run 45459634923) then flake after the sync (B-778, not ours); report a195; to-test/2026-11-24-1401-fixes-ui.md.

**Syncing (from the backlog session, 2026-11-24):** B-771, B-773, B-774 are in dev (origin/dev e19c42ab): `pnpm prd sync` now brings dev's CI lists, so no hand sync. At the wave boundary (not mid-wave): `git fetch origin`, check local `dev` is origin's, then `pnpm prd sync`. This first sync may rerun our tier once (B-773 touches `scripts/ci`); if a later sync sharing no files triggers a second run, tell the backlog session (B-720).

Notes for every wave:

- Run checks with `NODE_OPTIONS=--max-old-space-size=6144` until B-576 is confirmed fixed.
- Small tidy for a later slice: stale comments in `lib/providers/contactActions.ts` and `components/providers/ContactActions.tsx` still mention directory rows.

**Previous hand-over:** wave 14 landed 2026-11-25 as dev 51e9466 through PR #201, `--no-review` (Codex out of credits), CI components green (run 45749161182, 2cb10cc5); to-test/2026-11-25-2238-fixes-ui.md. Slices 79–84 (B-819, B-833, B-843, B-848, B-849 sonnet, B-850; others opus); details in the history file. Lesson: a label rename slice also greps `scripts/browser-checks/` (83 missed layout-offline.spec). `browser --suite` blocked by the permission classifier; `--changed --base dev` 6/6 after the fix. Docs folded into app-shell.md, live-notes.md; slice worktrees removed.

**Previous hand-over:** wave 15 landed 2026-11-25 as dev 2584a81 through PR #203, `--no-review` (Codex out of credits), CI integration green (run 45750856542, de32eac7), landed on an unsynced tip (dev shared no file); to-test/2026-11-25-2254-fixes-ui.md. Slice 85 (B-857, quick entry previews say Event; sonnet). Docs folded into assistant.md (trimmed to stay under budget). Slice worktree removed.

**Wave 16 (2026-11-26, this session; run-through):** slices 86–94 written from the triaged items (B-885, B-897+B-900, B-902, B-904, B-905, B-906, B-908, B-909, B-916). 90 waits for 89. Models: 86 sonnet, the rest opus. Still held: B-694, B-325.

To fold at landing: ui-kit.md and app-shell.md (PageLoading for a full-page wait in /app; brand/LoadingMark shared with AppLoading; 92). medications.md line 10 (PrintAllergies tops only the list print; the weekly sheet has G/S/R marks; 94). providers.md: Condensed rows (default, `providersView`) carry one main contact action, overriding B-422's "rows carry no contact details", which now holds for Full (93). 91 kept B-618's order and tightened the Change button's gap (14 to 8 px): say so in the report. Browser checks the wave needs: ui, marketing, first-sync.

| Slice | Item         | State               | Merge |
| ----- | ------------ | ------------------- | ----- |
| 86    | B-885        | agent working       |       |
| 87    | B-897, B-900 | agent working       |       |
| 88    | B-902        | agent working       |       |
| 89    | B-904        | agent working       |       |
| 90    | B-905        | waits for 89        |       |
| 91    | B-906        | handed off 57191444 |       |
| 92    | B-908        | handed off 9d47a87d |       |
| 93    | B-909        | handed off d248bb11 |       |
| 94    | B-916        | handed off a891d472 |       |

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

## Wave 5 (written 2026-11-24 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency. Only worker-watch (tooling) runs beside us, so no app hot files are taken. Where a backlog note says "check on a phone", name it in the hand-off as a hand test; the agent can't do it.

## Slice 34: Manage allergies on the Profile page (B-594)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/profiles.md, docs/domain/medications.md · Tests: component

**Problem.** Allergies are managed under Medications, but an allergy is a fact about the care recipient.

**Build.** Add an Allergies section to the Profile page beside Conditions (`routes/app/groups/profile/`, modelled on `ConditionsSection.tsx`), with add, edit, remove and No known allergies, for the same roles as today, reusing `medications/allergies/AllergyForm.tsx` and `allergyActions.ts` (move them under `profile/allergies/` if that reads better). It must work offline as Conditions does. The Medications list and each medication page keep a read-only allergy summary (`components/medications/AllergiesRegion.tsx`) with a Manage link to Profile; severe allergies stay prominent. The old allergy URLs redirect to the Profile section (or keep working). Printed sheets, the emergency sheet and the connector view don't change. No migration: `recipient_allergy` already syncs.

**Acceptance criteria.**

- [ ] Component test: the Profile page lists allergies and can add, edit and remove one, and set No known allergies, offline from the local database.
- [ ] Component test: the Medications summary is read-only, keeps a severe allergy prominent, and its Manage link goes to Profile.
- [ ] Component test: a viewer sees allergies on Profile with no edit controls.
- [ ] The old allergies URL lands on the Profile section.

## Slice 35: Allergy fields suggest as you type (B-672)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/profiles.md · Tests: component, unit

**Blocked by:** slice 34 (moves the form), slice 36 (the shared matcher).

**Problem.** "Allergic to" and "Reaction" are plain text inputs; conditions suggest as you type.

**Build.** Both fields use the ComboBox `opensOn="typing"` option (slice 29) like `ConditionNameField.tsx`: nothing on focus with an empty field, the first character opens the filtered list, clearing closes it, free text always allowed. Substances: the group's own first, then a curated list of common drug, food and environmental allergens worded as a family would. Reactions: the group's own first, then common reactions (hives, rash, swelling, trouble breathing, nausea…). Use slice 36's shared matcher (word-prefix, accent- and case-insensitive, de-duplicated). Keep within `ALLERGY_LIMITS`.

**Acceptance criteria.**

- [ ] Unit test: substance and reaction suggestions put the group's own first, match word prefixes ignoring case and accents, and de-duplicate.
- [ ] Component test: focusing an empty field shows no list; typing one letter shows filtered suggestions; picking one fills the field; free text still saves.

## Slice 36: Medication names suggest as you type (B-673)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component, unit

**Problem.** `components/medications/NameField.tsx` (MedicationForm and the Dose sheet's quick add in `QuickAddFields.tsx`) shows only "Used before" chips, with no curated list.

**Build.** First generalise the matcher in `lib/profiles/conditionSuggestions.ts` into a shared one (keep conditions' behaviour and tests) for slices 35 and 36. Then `NameField` uses the ComboBox `opensOn="typing"` option: the group's names first, then a bundled curated list of common medications (offline, no dependency), replacing the chips. Keep the non-blocking allergy-match warning on the typed or picked name. Look-alike names are a real risk (hydroxyzine, hydralazine): a pick shows the full name, never autofills on a partial match, and fills only the name, never a dose or strength.

**Acceptance criteria.**

- [ ] Unit test: the shared matcher keeps condition suggestions as before, and medication suggestions put the group's names first.
- [ ] Component test: no list on focus; one letter shows filtered names; picking fills only the name; typing a partial name never autofills.
- [ ] Component test: the allergy warning still shows for a matching name, in the form and the Dose sheet's quick add.

## Slice 37: Members show email confirmation status (B-679)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-groups.md, docs/domain/api.md, docs/domain/profiles.md · Tests: integration, component

**Problem.** Owners and admins can't see whether an invited member has confirmed their email.

**Build.** A manager-only oRPC read (in the care-groups area of `packages/api/`, RBAC in SQL through the model) returns, per member, `emailVerified` and, only if it comes from existing session rows with no migration or sign-in hook, the latest session time. Never the email. Don't add these to the synced member row. `settings/members/MemberItem.tsx` shows "Email not confirmed" (or confirmed) to owners and admins only, online only; offline shows nothing. Last sign-in shows nothing (not "never") when no session remains; leave it out entirely if it isn't easy.

**Acceptance criteria.**

- [ ] Integration test: an owner or admin gets the statuses for the group's members; a member or viewer is refused; no email is returned.
- [ ] Component test: an owner sees the status on an unconfirmed member's card; a member sees none; offline shows none.

## Slice 38: The phone bottom bar hides while the keyboard is open (B-664)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component

**Problem.** Focusing a text field on a phone lifts the fixed tab bar (`routes/app/layout/SectionNav.tsx`) above the keyboard, covering content.

**Build.** A small hook (in `lib/app-shell/`) that says the on-screen keyboard is open: a text-entry element has focus on a coarse pointer and `visualViewport` height has shrunk well below the layout height (fall back to focus alone where `visualViewport` is missing). `SectionNav` hides (off-screen, `aria-hidden`/`inert`) while it's open and returns on close. Desktop is unchanged. Name the iPhone, Android and Capacitor checks as hand tests.

**Acceptance criteria.**

- [ ] Unit or component test: the hook reports open for a focused input with a shrunk viewport, and closed after blur or the viewport restores.
- [ ] Component test: the bar is hidden while it's open and shown again after.

## Slice 39: Planner todo rows match the event cards (B-636)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/todos.md · Tests: component

**Problem.** Event cards moved the time above the title (B-592); `routes/app/groups/planner/PlannerTodoRow.tsx` keeps the old time column, so the list aligns two ways.

**Build.** Lay todo rows out like `UpcomingRow.tsx`: due time above the title, the same left edge and spacing, the owner pill and actions where event cards put them. Keep the checkbox and its behaviour.

**Acceptance criteria.**

- [ ] Component test: a todo row's due time renders above its title, not in a side column, and the checkbox still completes it.

## Slice 40: Quick entry tips panel on the first focuses (B-621)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/assistant.md · Tests: component

**Problem.** Quick entry looks like a plain box; users don't learn it does more.

**Build.** In the shared `components/quick-entry/QuickEntryBox.tsx` (timeline and Easy mode), a panel below the box on a user's first 3 real focuses, while it's focused: "Why don't you try", then the four examples (bp 130/85 hr 72; gave metformin; pain 4 left knee; appt Dr Lee Friday 2pm, one shared list with `quickEntryCopy.ts`), then only two shorthands, n: for a note and e: for an event, and that commas log several at once. A labelled kit IconButton X ends it for good. Pressing the panel or the X must not blur the box first; focus on the X counts as in the box. It goes on blur, stays while typing, and gives way to a preview card or name completions (never covers them or the Suggestions popover). Count only real user focuses (not autofocus, the refocus after Save, closing a sheet or returning from Suggestions). Store the count and the dismissal per user per device in localStorage with try/catch, cleared with the other per-user keys at sign-out; if storage fails, show nothing. It floats, pushing nothing; at phone width it fits or scrolls inside itself; the kit's existing overlay fade, none under reduced motion. Screen readers don't hear it twice with the box's description. In Easy mode, check it against the dictation hint.

**Acceptance criteria.**

- [ ] Component test: the panel shows on the first three focuses and not the fourth; the X hides it for good; it hides on blur.
- [ ] Component test: autofocus and the refocus after Save don't count; storage throwing shows nothing.
- [ ] Component test: name completions or a preview card replace it; clicking the X keeps focus in the box.

## Slice 41: The quick entry result card is a button that adds it (B-676)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/assistant.md · Tests: component

**Problem.** The suggested result card (`components/quick-entry/QuickEntryCard.tsx`) can't be clicked; only Enter adds it.

**Build.** Make the card's main reading (icon, kind, when, title, detail) a native button that does exactly what Enter does (with several cards, that's Save all, matching Enter), styled as the primary choice beside the "Make it a note" and alternative chips (which only switch the reading), with hover, focus and an accessible name saying what it adds. Don't wrap the whole card: Remove, Edit and the chips stay separate, unnested buttons. Disabled when `canSave` is false (blocked card or busy save). Enter behaviour is unchanged; the Matching names list is out of scope.

**Acceptance criteria.**

- [ ] Component test: clicking the main reading saves the entry as Enter does, and its accessible name names what it adds.
- [ ] Component test: a blocked card's button is disabled; Remove, Edit and the chips are not inside it and still work.

## Slice 42: Quick entry "new med" and "new provider" open the Add sheet filled in (B-762)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/assistant.md, docs/domain/medications.md, docs/domain/providers.md · Tests: unit, component

**Blocked by:** slice 41 (the same card).

**Problem.** There's no way to start a new medication or provider from quick entry.

**Build.** Vocabulary rows ("new med", "started", "add medication", "new provider", "add provider") plus parser test rows make a medication or provider card. Its Save opens the existing Add medication or Add provider sheet prefilled (name, strength, form, directions; provider name, specialty or practice, phone, address); the sheet saves as today. The new-item words win over the loose match to an existing medication ("new med lisinopril" isn't the current Lisinopril 5 mg). Writer roles only. No new assistant action, no server or connector change.

**Acceptance criteria.**

- [ ] Unit test: "new med lisinopril 10 mg tablet" parses to a new-medication card with name, strength and form, not the existing medication; "add provider Dr Kim cardiology 555-0100" to a provider card.
- [ ] Component test: Save on each opens its Add sheet with the fields filled in; a viewer gets no such card.

## Slice 43: List tool buttons and entry filter links show hover (B-617)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md · Tests: component

**Problem.** Timeline's search, filter and view buttons and every list's Filter show no hover; the kind and author filter links on entries have no button feel.

**Build.** Likely cause: `CIRCLE` in `components/ui/styles.ts` sets `bg-base-100`/`border-base-300`, which beat daisyUI's layered btn hover. Fix it once in the shared style: outlined circle at rest, visible hover and press at the kit's 120 ms, none under reduced motion, light and dark. Check every `FilterMenu` (Providers, Planner, Medications, Todos) and unselected `chipClass` chips. Move Timeline's hand-written Filter button (`TimelineFilters.tsx`) to the kit's IconButton, keeping its count badge. Give `KindFilterLink` and `AuthorFilterLink` (`components/entry/KindIcon.tsx`) the kit's button feel in every form (type icon, initials circle, name link) while staying real links, keeping accent colours and the row's stretched-link layering (z-10).

**Acceptance criteria.**

- [ ] Component test: a circle tool button's background changes on hover (computed style differs from rest) in light and dark.
- [ ] Component test: Timeline's Filter is the kit IconButton and keeps its count badge.
- [ ] Component test: a kind filter link on a row filters the timeline without opening the entry, and has the transition class.

## Slice 44: Timeline symptom filter's empty state names the chosen types (B-756)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

**Problem.** With `?symptom=` chosen and nothing matching, the timeline says "No symptoms on the timeline yet.", as if the group had none.

**Build.** When a symptom filter is set, the empty state names the chosen symptom types ("No pain or nausea on the timeline yet.", wording to match the other filtered empty states) with a way to clear the filter. The unfiltered empty state is unchanged.

**Acceptance criteria.**

- [ ] Component test: with a symptom filter and no matches, the empty state names the chosen types and offers clearing it; without one, the old text shows.

## Slice 45: The event time picker's calendar sits inside its panel (B-691)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/appointments.md · Tests: component

**Problem.** In `routes/app/groups/entry/EntryTimeChip.tsx`'s w-72 popover, `components/ui/date/DateTimeField.tsx` opens its calendar as a second, nested popover, wider than the panel and spilling past it.

**Build.** An explicit prop (or context) on `DateTimeField` renders the calendar inline below the field when it's inside another popover; fields in sheets and forms keep their own popover. The calendar fits the panel's content width with day cells as close to 44 px as the width allows. Keep `calendarOpen` on arrival (Add event's pickDay), the first picked day starting at 9:00, the calendar toggle, Esc closing the calendar before the panel, and a tap in the calendar not counting as outside. With Starts and Ends, one calendar open at a time. The taller panel stays on screen at phone width and short heights, scrolling inside, with Done reachable.

**Acceptance criteria.**

- [ ] Component test: inside the entry time chip, the calendar renders within the panel's bounds (no second popover); in a form, it still opens its own popover.
- [ ] Component test: Esc closes the calendar first, then the panel; opening Ends' calendar closes Starts'.
- [ ] The existing DateTimeField and entry time chip tests are updated and pass.

## Slice 46: A new event's first day pick moves focus to the title (B-692)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/appointments.md · Tests: component

**Blocked by:** slice 45 (the same popover).

**Problem.** After picking a date on a new event, it isn't clear that a title saves it.

**Build.** Only on the first day pick of a pickDay draft (`useLiveEntry.ts`, `EntryTimeChip.tsx`): close the calendar and time popover, commit the schedule, and focus the title input, overriding the popover's focus return; focus within the tap's gesture where possible (iOS keyboard). Later openings, and typing in the date field, behave as now. On an unsaved new event the title placeholder reads "Enter a title to save"; its accessible name stays Title; saved unnamed events keep theirs. Suggested title chips still save on tap.

**Acceptance criteria.**

- [ ] Component test: on Add event, picking a day closes the popover and focuses the title, whose placeholder is "Enter a title to save".
- [ ] Component test: reopening the time chip and picking another day keeps focus in the popover; a saved event's placeholder is unchanged.

## Slice 47: Scrolling after a jump to a day stays where you scroll (B-736)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

**Problem.** After jumping to a day (`?day=`), scrolling always pulls back to that day.

**Build.** Find why the jump re-applies (likely the `?day=` effect re-running on paging or a re-render) and make the jump happen once per navigation: the scroll to the day runs once, then the user's scroll wins as rows load above and below. Keep `?day=` as a shareable deep link (slice 48 uses it) and Back to today (`BackToToday.tsx`). If the cleanest fix is to drop the query after the jump with `replace`, make sure Back and a reload still behave.

**Acceptance criteria.**

- [ ] Component test: after a jump to a day, scrolling away and loading more rows doesn't scroll back to that day.
- [ ] Component test: a direct load with `?day=` still lands on that day.

## Slice 48: A copy-link button on timeline day headers and entries (B-737)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md, docs/domain/app-shell.md · Tests: component

**Blocked by:** slice 47.

**Problem.** There's no easy way to send someone a link to a day or an entry on the timeline.

**Build.** A small kit IconButton with a link icon and an accessible name ("Copy link to <day>", "Copy link to <entry>") on each day header (`DayHeader.tsx`) and in each entry's actions (where the row's other actions are; never inside its stretched link). It copies an absolute URL built with `appUrls` (the day: the timeline `?day=` link; an entry: its page) to the clipboard and confirms inline ("Link copied", announced politely); if the clipboard fails, it shows the link to copy. Opening the link must not stop scrolling later (slice 47).

**Acceptance criteria.**

- [ ] Component test: the day header's button copies that day's absolute link and announces it; an entry's copies the entry's link.
- [ ] Component test: a clipboard failure shows the link instead.

## Wave 6 (written 2026-11-24 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency. Only worker-watch (tooling) runs beside us, so no app hot files are taken; dose-accuracy is done, so the medication items it held are open. Where a backlog note says "check on a phone" or "check by eye", name it in the hand-off as a hand test; the agent can't do it. Decided by skeptics, the user may veto (asks a199–a201): B-698's Log opens the Dose sheet; B-700 follows Schedule's Given all rule and its card opens nothing; B-680 builds from its scope notes. Chains: 54→55, 53+55→56, 57→58. Held to later waves: B-684 and B-695 (app-wide sweeps, each a wave of its own, after this one's medication and form changes), B-693, B-697 (toast system B-669), B-694 (never unattended), B-325 (Capacitor).

## Slice 49: Connectors say Event, not appointment (B-583)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/connectors.md, docs/domain/appointments.md · Tests: integration

**Problem.** The app says Event everywhere (B-537), but the connector tools still say appointment.

**Build.** The user's call (2026-11-23, B-583's notes): rename `prepare_for_appointment` (`packages/api/src/connectors/prompts.ts`) to `prepare_for_event` and the `kind: "appointment"` output (`tools/upcoming.ts`, and any other tool output) to `kind: "event"`, with **no alias** for the old names. Tool and prompt text (`prompts.ts`, `upcoming.ts`, `listTimeline.ts`, `writes.ts`, `protocol.ts`) say Event and still understand both words where the assistant reads them ("events (appointments)"). **Leave the consent text in `packages/data/src/db/schema/connectors/connectorRules.ts` exactly as it is** (it lists "appointments"): changing consent needs a version bump and is the user's call; say in the hand-off that it was left and quote the line. Update the connector tests and `docs/domain/connectors.md` is the orchestrator's (say what changed).

**Acceptance criteria.**

- [ ] Integration test: the prompts list names `prepare_for_event` and not `prepare_for_appointment`.
- [ ] Integration test: an upcoming event comes back with `kind: "event"`.
- [ ] The consent text and its version are unchanged.

## Slice 50: Motion tuning: Today card slides, sheets fade, overlays at 240 ms (B-613)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md · Tests: component

**Problem.** The Timeline Today card's rows pop open while its chevron turns, sheets slide and fade, and overlay timings differ (menus and popovers 120 ms, others 180 ms).

**Build.** As B-613's notes say: (1) `TodayCard.tsx` wraps its rows in the kit's `Collapse`, matching `DaySummaryLine` (same slide, duration and Chevron); `aria-controls` points at the collapsing region, closed rows leave the tab order, and the collapsed summary line doesn't jump. (2) Sheets only fade, in and out (drop the 1.5rem panel slide). (3) 240 ms for sheets, menus, popovers, native dialogs and toasts; button, row and hover feedback stays 120 ms. Reduced motion stays instant. Update the timings pinned in `sheetExit.browser.test.tsx` (and `overlayMotion.browser.test.tsx` if it pins them), the motion notes in `app.css` and the `/dev/ui` motion section; `docs/domain/components.md` is the orchestrator's (say what changed). Hand tests: the Today card and a day summary side by side; a toast by eye.

**Acceptance criteria.**

- [ ] Component test: the Today card's rows collapse through `Collapse`, closed rows aren't focusable, and `aria-controls` names the region.
- [ ] Component test: a sheet's panel has no translate in or out, and overlays use 240 ms (reduced motion: none).

## Slice 51: A live note opens full screen (B-765)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/live-notes.md · Tests: component

**Problem.** A live note can only be edited inside its entry page, which is cramped for a long note.

**Build.** A kit IconButton (expand icon, "Open full screen" / "Exit full screen") on the live note editor (`components/notes/LiveNotesEditor.tsx`, where the entry page shows it) that shows the same editor instance full screen over the page (a native `<dialog>` with `showModal`, or the kit's full-height sheet if one fits better: read ui-kit first), keeping the Yjs document, cursor, mentions and editor avatars; Escape and the button return to the page with the text intact. No new route and no data change. Works offline. On a phone it fills the screen above the keyboard.

**Acceptance criteria.**

- [ ] Component test: the button opens the note full screen with the same content, typing there shows on return, and Escape closes it with focus back on the button.
- [ ] Component test: viewers who can't edit can still open it full screen to read.

## Slice 52: Header navigation works after a long idle tab and a deploy (B-735)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md, docs/domain/sync.md · Tests: unit

**Problem.** After a tab sat idle through a staging deploy, clicking the main header nav did nothing until a reload.

**Build.** Find the cause first; the likely one is a stale client: the new deploy removed the old hashed route chunks, so React Router's lazy route import fails (`vite:preloadError` or a failed dynamic import) and navigation silently stops. Check how `serviceWorkerRegister.ts`, `useUpdateNotice.ts` and `UpdateNotice.tsx` handle a new build, and what happens on a failed chunk load. Fix it so a failed route chunk load after a deploy reloads to the target URL once (guarded so it can't loop: a session-storage marker or similar), and never on the native build where chunks are bundled. If the cause turns out to be something else, fix that and say what you found. Hand test (name it): leave a tab open across a deploy, then click the nav.

**Acceptance criteria.**

- [ ] Unit test: a chunk-load failure on navigation triggers one reload to the target URL; a second failure within the guard doesn't loop.
- [ ] Unit test: the native target doesn't reload.

## Slice 53: Med times always sort by time; Move up and Move down go (B-701)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md, docs/domain/data-layer.md · Tests: integration, component

**Problem.** The manual pass order can list Evening above Morning on the Passes tab, quick entry, the print sheet and schedule summaries, while due times don't change.

**Build.** As B-701's note says: always order passes by time, then name. Change `sortPasses` (`packages/data/src/db/schema/medications/medicationPass.ts`), `passesQuery`'s ORDER BY (`medicationPasses.sync.ts`), the model's sort (`medicationPassModel.ts`) and `duePasses`' tie-break; remove the move intent, `movePass`, its menu items in `PassList.tsx` and their tests. **No migration**: keep the `sort_order` column and keep writing a valid value on create. Existing custom orders simply stop applying.

**Acceptance criteria.**

- [ ] Unit or integration test: passes with sort orders against their times come back by time, then name, from the model and the device query.
- [ ] Component test: the Passes tab menu has no Move up or Move down.

## Slice 54: A double dose is highlighted on the medication and Today screens (B-606)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

**Problem.** When a medication has been given twice for one dose (an extra dose, defined by dose-accuracy's B-297), nothing on screen calls it out before the next dose.

**Build.** The user's call (2026-11-23, B-606): in-app only; no notification, email or push. Read how dose-accuracy defines an extra dose (`dueDoses.ts`, `duePasses.ts`, `medications.sync.ts`, `docs/domain/medications.md`) and use that, not a new rule. Where a medication's dose for a slot (or an as-needed day past its maximum) has an extra dose, show a warning-toned badge and plain text ("Given twice: 8:00 and 8:20") on the Schedule tab's Today rows and pass cards, and on the medication's page, with the warning color meeting contrast in light and dark and the text readable without color. Viewers see it too. Don't change how doses are logged.

**Acceptance criteria.**

- [ ] Component test: a slot with an extra dose shows the double-dose warning with both times on Today and on the medication page.
- [ ] Component test: a normal single dose shows no warning.

## Slice 55: One medication card for Schedule and the Medications list (B-698)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/medications.md · Tests: component

**Blocked by:** slice 54 (same rows).

**Problem.** Three separate rows (`MedicationListItem` on the list, `DoseSlotRow` and `AsNeededRow` on Schedule) look and behave differently, and on Schedule only the name opens the medication.

**Build.** One shared card in `components/medications/`, used by all three: the whole card opens the medication (the stretched-link pattern: `ui/ListRow` `to` plus trailing actions at `z-10`), so Given, Log and the menu never open the page. Keep every safety behaviour: AsNeededRow's over-maximum confirm, Skipped/Refused through `MarkDoseDialog`, `canWrite` gating, inline errors, and slice 54's double-dose warning. **Decided (a199):** on the list tab, Log on a scheduled medication opens the Dose sheet; an as-needed one logs as today (with its confirm); stopped medications show no Log. Viewers see no logging controls. The logging toast waits for B-697; the wording stays "pass" until B-695.

**Acceptance criteria.**

- [ ] Component test: clicking the card body opens the medication; Given, Log and the menu don't.
- [ ] Component test: on the list tab, Log on a scheduled medication opens the Dose sheet; a stopped one has no Log; a viewer sees none.
- [ ] Component test: the as-needed over-maximum confirm still shows.

## Slice 56: Quick log a med time from the Passes tab (B-700)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

**Blocked by:** slices 53 and 55.

**Problem.** The Passes tab (`medications/passes/PassList.tsx`) only lists each pass; logging it means going to Schedule.

**Build.** Each pass card matches slice 55's card style and shows today's state from `useDueDoses`'s `DuePass`. **Decided (a200):** writers get Given all whenever any open medication in it is unlogged today (Schedule's `PassCard` rule: no due-time gate), reusing `usePassLog.givenAll` and `PassUndoStatus` scoped by place, then Undo; a done pass shows its state instead. The card opens nothing; the management menu (Edit, Delete) stays for writers. Viewers see no log action.

**Acceptance criteria.**

- [ ] Component test: a writer's Given all on the Passes tab logs every open medication in that pass and offers Undo there.
- [ ] Component test: a done pass shows its state; a viewer sees no Given all.

## Slice 57: One search and filter bar on every list page (B-680)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/todos.md, docs/domain/search.md · Tests: component

**Problem.** List pages keep their search and filter controls in different places and styles (`MedicationFilters.tsx`, `DirectoryFilters.tsx`, `PlannerHeader.tsx`'s FilterMenu on Upcoming only, `todos/TodoFilters.tsx`), and the Planner's Past tab has none.

**Build.** **Decided (a201), scope exactly as B-680's notes:** only the search box and filters. One shared bar (built on `ui/FilterMenu.tsx` and `filterModel.ts`) that the medications, providers, Planner and Todos lists use, looking and sitting the same; the timeline keeps its own controls; care periods stays as is; no change to headers, tabs or cards. On the Planner the bar sits below the tabs and acts only on the open tab, each tab supplying its own filter sections; Past gets at least an author filter, and all three tabs get the quick text input. Past is paged (`loadPast`): its text filter runs in the local SQL query, not only over the loaded page. Match with `foldSearchText` (case and accents), offline; a filtered empty state names the filter. Typed text doesn't carry across tabs. Easy-roles Planner stays without filters. Placeholder: "Type to search". Hand test: on a phone the row doesn't crowd the tabs.

**Acceptance criteria.**

- [ ] Component test: the same bar renders on medications, providers, Planner and Todos.
- [ ] Component test: Past's text filter finds an entry older than the loaded page, and its author filter works.
- [ ] Component test: switching Planner tabs clears the text; an empty filtered result shows the filtered empty state.

## Slice 58: The timeline search reads "Type to search" (B-748)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

**Blocked by:** slice 57 (same wording).

**Problem.** The timeline's search placeholder (and its bar's label) don't match the list pages' "Type to search".

**Build.** Set the timeline search input's placeholder to "Type to search", keeping its accessible name (a label, not the placeholder). Update tests that find it by the old placeholder.

**Acceptance criteria.**

- [ ] Component test: the timeline search shows "Type to search" and keeps its accessible name.

## Wave 7 (written 2026-11-24 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency. Only self-recovery (tooling) runs beside us; calendars-3 (held) names `lib/app-shell/serviceWorker`, but it isn't running. The user wants B-777 in this wave. The three slices touch separate files and run at once. Held to later waves: B-684 and B-695 (app-wide sweeps, a wave each), B-693, B-697 (toast system B-669), B-694 (the user approves each form live), B-325 (Capacitor).

## Slice 59: Offline /app shows the app, not a blank screen (B-777)

Stack: yes · Reads: plans/fixes-rules.md, docs/domain/app-shell.md, docs/domain/sync.md, docs/domain/security-headers.md · Tests: unit, browser

**Problem.** When the connection drops, the browser and the installed PWA show only a blank screen. Offline is a hard requirement. The service worker exists (`lib/app-shell/serviceWorker*.ts`, bundled to `/sw.js` by `scripts/build/service-worker.mjs`), so something on the offline `/app` path fails.

**Build.** Find the cause first, on a production web build (`pnpm build`, then serve it; the worker is web production only): load `/app` and a group screen online, go offline (Playwright `context.setOffline(true)`), then reload and navigate. Candidates from B-777's notes: the shell document isn't cached or isn't served for that URL, a route chunk or asset is missing from the precache, a request the page needs at boot (session, `/rpc`, PowerSync) throws instead of falling back, or the cached shell's CSP blocks something. Fix the cause where it lives (the worker, its routes or caches, the build script, or the boot path); a failure that must stay an error shows a readable offline message, never a blank page. Write the cause and the fix in the hand-off, plus what `docs/domain/app-shell.md` should say (the orchestrator's). Hand test: the installed PWA on a phone, airplane mode, cold start.

**Acceptance criteria.**

- [ ] Unit test (`serviceWorkerRoutes.test.ts`, `serviceWorkerCaches.test.ts` or `scripts/build/service-worker.test.mjs`, whichever holds the cause) pins the fix.
- [ ] Browser check (`scripts/browser-checks/layout-offline.spec.mjs` or a new spec beside it) on a production build: signed in, a group's timeline loaded once, then offline: a reload of that page and a navigation to another `/app` screen render the app (the header and the local data), not a blank page.

## Slice 60: Medications list Log closes back onto the list (B-783)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

**Problem.** On the Medications list, Log on a scheduled medication opens the Dose sheet over the timeline (`appUrls.newDose`, `MedicationListItem.tsx`), so closing or saving it lands on the timeline instead of the list.

**Build.** Log from the list opens the Dose sheet over the Medications list, and closing or saving returns to the list, as Schedule's Log does (follow whichever pattern Schedule or the medication page uses; don't add a new route if a return target on the existing one does it). The timeline's own Dose sheet keeps its behaviour.

**Acceptance criteria.**

- [ ] Component test (`medicationList.browser.test.tsx`): Log on a scheduled medication opens the Dose sheet, and closing it leaves the Medications list showing.
- [ ] Component test: saving a dose from it returns to the list too.

## Slice 61: Passes tab cards warn of a double dose (B-784)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

**Problem.** Today and the medication page call out a double dose (`ExtraDoseWarning`, B-606), but the Passes tab's cards don't.

**Build.** The Passes tab cards (`routes/app/groups/medications/passes/PassList.tsx` and the card it uses) show `ExtraDoseWarning` for a slot given twice today, with the same text and badge as Today. Viewers see it too; a single dose shows nothing.

**Acceptance criteria.**

- [ ] Component test (`passes.browser.test.tsx`, or `doubleDose.browser.test.tsx` if it covers the tabs): a pass with a medication given twice shows the double-dose badge and text; a single dose shows none.

## Wave 8 (written 2026-11-24 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no dependency. No other PRD is running. B-788 plus the Med times rename (B-695), split in three by area so each stays under about 12 files; the four slices touch separate files and run at once. B-695 changes visible text only: keep code names, the `medication_pass` table, stored data, the `/passes` URL and the `give_pass` connector tool name; sweep strings by hand (about 670 matches, most identifiers), never find-and-replace. A single slot goes by its name (Morning, Evening); the generic singular is "med time", the plural "Med times" in titles and the tab. Words quick entry already accepts keep working. Held to later waves: B-684 (required-field asterisks, a wave), B-693, B-697 (toast system B-669), B-694 (the user approves each form live), B-325 (Capacitor).

## Slice 62: Offline loads of / and /sign-in get a fallback page (B-788)

Stack: yes · Reads: plans/fixes-rules.md, docs/domain/app-shell.md, docs/domain/security-headers.md, docs/domain/marketing.md · Tests: unit, browser

**Problem.** Offline, a direct load of `/` or `/sign-in` shows the browser's own offline page. `/app` works offline since slice 59 (B-777); in-app redirects to sign-in are client-side and fine.

**Build.** The service worker (`lib/app-shell/serviceWorker*.ts`, bundled by `scripts/build/service-worker.mjs`) answers a failed navigation outside `/app` with a small precached offline page: Caretook's name, "You're offline", a line that the app works offline once you've signed in on this device, and a link to `/app`. It is static, styled inline or with the app CSS already precached, passes the CSP (docs/domain/security-headers.md), and never replaces an online answer (network first; the fallback only when the network fails). Don't cache marketing pages themselves.

**Acceptance criteria.**

- [ ] Unit test (`serviceWorkerRoutes.test.ts` or `serviceWorkerCaches.test.ts`): a navigation to `/` or `/sign-in` that fails gets the offline page; one that succeeds gets the network's answer; `/app` navigations keep the shell as before.
- [ ] Browser check (`scripts/browser-checks/layout-offline.spec.mjs`) on a production build: after one online visit, offline loads of `/` and `/sign-in` show the offline page with its `/app` link.

## Slice 63: Med times on the Medications screens (B-695, part 1)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

**Problem.** "Pass" is nursing jargon; family caretakers can read it as skipping a dose. The user chose "Med times" (see the wave note).

**Build.** Visible text and aria labels only, in: `routes/app/groups/medications/**` (the Passes tab becomes Med times, PassForm, PassList, ScheduleFields, TodaySection, MedicationForm, MedicationList, the + menu's "Add a med time" in `useAddMenu.ts`, the print and weekly print sheets), `routes/app/groups/medication/**` (MedicationDetails, MedicationHistory), `components/medications/**` (PassCard, DoseSlotRow, ExtraDoseWarning), and the refusal messages in `lib/medications/medicationPasses.sync.ts` and `medications.sync.ts`. Update these files' component tests. Leave the timeline, Today, search, quick entry and connectors to slices 64 and 65. In the hand-off, list every string changed.

**Acceptance criteria.**

- [ ] Component tests (the medications and passes `*.browser.test.tsx` beside these files): the tab, page title, + menu item and form read Med times / med time; no visible "pass" left on those screens.
- [ ] `grep -rniE "['\">][^'\"<]*\bpass(es)?\b"` over these folders finds only identifiers, URLs and comments.

## Slice 64: Med times on the timeline, Today and search (B-695, part 2)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md, docs/domain/timeline.md · Tests: component

**Problem.** As slice 63, for the timeline side.

**Build.** Visible text and aria labels only, in `routes/app/groups/timeline/**` (EasyNow, EasyTimeline, TodayMedicationsRow, PassLogItem, `pass/PassLogForm.tsx`, `new-dose/`, dayItems, useTodayCard, useMedicationStrip), `lib/medications/medicationStrip.ts`, `dueDoses.sync.ts`, `passLogs.ts`, `lib/timeline/timelineNewer.ts`, and `routes/app/groups/search/**` (ResultItems, SearchResults, EasyResultSheet). Leave the Medications screens (slice 63) and quick entry and connectors (slice 65). Update these files' component tests; a browser check under `scripts/browser-checks/` that asserts the old words gets its text updated. In the hand-off, list every string changed.

**Acceptance criteria.**

- [ ] Component tests beside these files: the Today card, a logged slot on the timeline and its log form, and a search result read med time / the slot's name; no visible "pass".
- [ ] The same grep as slice 63 over these files finds only identifiers, URLs and comments.

## Slice 65: Med times in quick entry and connectors; the docs (B-695, part 3)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/connectors.md, docs/domain/medications.md · Tests: unit, component

**Problem.** As slice 63, for quick entry and the connector text.

**Build.** Visible text only in `components/quick-entry/**` (for example "Suggestions, a pass is due", "That pass is gone") and `lib/assistant/quickEntry.sync.ts`, `quickEntryCompletion.ts`; quick entry keeps accepting every word it accepts today (pass, passes) and also accepts "med time". Connector tool descriptions and prompt text in `packages/api/src/connectors/**` say med time; the `give_pass` tool name and output keys stay. `docs/domain/medications.md` says the visible name is Med times (code keeps pass). In the hand-off, list every string changed.

**Acceptance criteria.**

- [ ] Unit test (quick entry parsing): "pass" and "med time" both still match a slot.
- [ ] Component tests beside the quick-entry files: the due suggestion and the gone message read med time.
- [ ] Connector tests that pin description text are updated; tool names unchanged.

## Wave 9 (written 2026-11-24 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no new dependency. No other PRD is running. B-669 (the shared toast system, moved into fixes-ui by the user 2026-11-24) is slice 66 alone; slices 67 and 68 are blocked by it and start once it is merged into prd/fixes-ui; they touch separate files and run at once. Read each item's backlog note (`pnpm backlog show B-<n>`). Held to later waves: B-684 (required-field asterisks, a wave of its own), B-694 (the user approves each form live), B-325 (Capacitor).

## Slice 66: Shared toast system on React Aria, behind ui/Toast (B-669)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/app-shell.md · Tests: unit, component

**Problem.** `components/ui/Toast.tsx` is one fixed message per caller: two toasts overlap, there's no dismiss, no Undo, no timing. The user wants heavy use of toasts (B-693, B-697, onboarding-2's B-665 build on this).

**Build.** A shared toast queue inside `components/ui/` on react-aria-components 1.22.1's `UNSTABLE_ToastRegion`, `UNSTABLE_ToastList`, `UNSTABLE_Toast` and `UNSTABLE_ToastQueue` (already a dependency; nothing new). The `UNSTABLE_` names are imported only inside `ui/`; screens call our own API (for example `toast({ message, action?, undo?, timeout? })` returning an id, plus `dismissToast(id)`), exported from `ui/index.ts`. One region mounted once in the `/app` layout (`routes/app/layout/route.tsx`), above the tab bar (`--tab-bar-height`, none from `sm`) and above the on-screen keyboard (B-664 hides the bar while typing), print hidden. It needs: a queue so toasts never overlap (newest shown, the rest wait or stack, your choice, say which), an optional action, a dismiss button, Undo as an action, caller-set timeout (none for an action-only toast such as Reload), toasts surviving a route change, never taking focus from what the user is typing, the region a live region for screen readers, and fade motion on `--motion` under `prefers-reduced-motion: no-preference` (instant under reduce). daisyUI styling, as today's toast. Migrate `routes/app/layout/UpdateNotice.tsx` and `routes/app/groups/timeline/AddedMedicationToast.tsx` to it and drop the old one-off `Toast` if nothing else uses it (update `routes/dev/ui/sections/ToastSection.tsx` and `MotionSection.tsx`). If React Aria's toast falls short on a phone (above the bar, keyboard open), extend our own component rather than add a library, and say so in the hand-off. Add the usage rules to `docs/domain/components.md` (toasts for finished actions, Undo, background news, one-time nudges; not for errors to fix, medically important information, the only path to an action, or the only signal of unsynced changes; don't sweep inline `Message` uses) and the API to `docs/domain/ui-kit.md`.

**Acceptance criteria.**

- [ ] Component test (`ui/Toast.browser.test.tsx`): two toasts queued never overlap; dismiss removes one; an action runs once and closes it; a timeout closes it; a toast without a timeout stays; reduced motion shows and hides at once.
- [ ] Component test: a toast shown, then a route change, is still shown; focus stays in a text field while a toast appears.
- [ ] The update notice and the added-medication notice still work through the new API (their existing tests updated).
- [ ] `grep -rn "UNSTABLE_Toast" apps/web/app` finds only files under `components/ui/`.

## Slice 67: New events and notes: the first save shows a saved toast (B-693)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md, docs/domain/live-notes.md · Tests: component · Blocked by: slice 66

**The toast API (slice 66, merged e2f1d254).** `toast({ message, action?, undo?, timeout?, data? })` from `~/components/ui` returns an id; `dismissToast(id)`; default timeout 6 s (`timeout: null` stays), paused on hover or focus; one shown at a time, newest first. Messages are plain strings. In tests a toast is `getByRole("alertdialog", { name })` and its message `role="alert"`; `renderWithDevice` shows toasts, `renderInRouter` tests mount `<ToastRegion />` themselves; keep the pointer off the toast (hover pauses its timer); `clearToasts()` runs after each test.

**Problem.** A new event or note saves silently on its first save; the user wants a toast.

**Build.** In `routes/app/groups/entry/useLiveEntry.ts`'s `save()` (the one-off and repeating paths, each followed by a replace navigation from `entries/new` to `entries/:id`), show the slice 66 toast "Event saved" or "Note saved" by kind, once, only on a draft's first successful save, whatever triggered it (title, chip, notes, place, provider); never on later autosaves or a failed save. It's a local write: the wording must not imply it has synced, and it works offline. It goes through the shared queue so it survives the navigation, and it never takes focus or interrupts typing (a note's first save is usually its first typed text).

**Acceptance criteria.**

- [ ] Component test (beside the entry route's tests): a new event's first save shows "Event saved" once; a second change to it shows no toast; a new note's first typed text shows "Note saved" and focus stays in the editor.
- [ ] A failed first save shows no toast (its error stays inline).

## Slice 68: Medications Schedule: logging a dose shows a toast (B-697)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/medications.md · Tests: unit, component · Blocked by: slice 66

**The toast API (slice 66, merged e2f1d254).** `toast({ message, action?, undo?, timeout?, data? })` from `~/components/ui` returns an id; `dismissToast(id)`; default timeout 6 s (`timeout: null` stays), paused on hover or focus; one shown at a time, newest first. Messages are plain strings. In tests a toast is `getByRole("alertdialog", { name })` and its message `role="alert"`; `renderWithDevice` shows toasts, `renderInRouter` tests mount `<ToastRegion />` themselves; keep the pointer off the toast (hover pauses its timer); `clearToasts()` runs after each test.

**Problem.** Logging from the Medications Schedule tab shows no toast; only Given all shows an inline "Morning logged · Undo" line.

**Build.** Decided for the user (ask a211, the user can veto): every log from the Schedule tab gets a slice 66 toast with Undo for about 10 s (`UNDO_MS`), through the existing Undo path in `lib/medications/passUndo.ts` (`offerUndo`, `clearUndo`: it deletes exactly the doses it wrote). Wording: one dose Given "Tylenol logged · Undo"; Skipped and Refused "Tylenol marked skipped · Undo" / "Tylenol marked refused · Undo"; Given all "Morning logged · Undo". Cover each path that logs from this tab: the one-tap Given (`DoseSlotRow` via `usePassLog.logSlot`), Skipped and Refused (`MarkDoseDialog`), the as-needed Log (the Schedule route's clientAction and `TodaySection`), and Given all. On the Schedule tab the toast replaces the inline `PassUndoStatus` line (`TodaySection.tsx`), so it never shows both; the other screens' `PassUndoStatus` lines (timeline, Today, the Dose sheet, quick entry, the Med times tab) stay as they are. Toast only after the local write succeeds; errors stay inline. Mind dose-accuracy's landed Undo fixes (B-614, B-627): Undo goes through the same service path.

**Acceptance criteria.**

- [ ] Component test (`routes/app/groups/medications/today.browser.test.tsx` or beside it): a one-tap Given shows "<name> logged · Undo" and Undo removes that dose; Skipped and Refused show their toast; an as-needed Log shows its toast; Given all shows "Morning logged · Undo" as a toast and no inline line.
- [ ] A failed log shows no toast, its error inline.
- [ ] Unit test if `passUndo.ts` gains single-dose rounds.

## Wave 10 (written 2026-11-24 by the orchestrator; B-793 moved into fixes-ui on the user's word, via the backlog session)

Every slice: no migration, no new dependency. **Staging promotion is blocked until slice 69 lands**: start it first, at once, and land it as its own wave; the backlog session recuts the candidate after and wants a message when it lands in dev. Held: B-684 (asterisks, a wave of its own), B-694 (the user approves each form live), B-325 (Capacitor).

## Slice 69: Roundtrip's "add: shows on this device at once" fits its 2 s budget again (B-793)

Stack: yes · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/sync.md, docs/domain/timeline.md · Tests: browser

**Problem.** Staging candidate rc/20261125-0057 (ff861fe2, from dev 608754a5) braked in CI run 45522160639 (PR #175): `scripts/browser-checks/roundtrip.spec.mjs:249` (`localMs < 2000`) took 2007 ms, then 2069 ms on rerun, at load 5. The previous candidate (65529f69, run 45501768335) passed. Suspect: B-613 (87a6235c: overlays fade at 240 ms, not 120, and `useSheetExit` waits for the overlay too). Against it: `new/route.tsx`'s clientAction writes locally before `onDone` closes the sheet, so the row shouldn't wait for the exit. Not reproduced locally. Wave 9's toast region (slice 66) and the saved toast (slice 67) are also new in the /app layout.

**Build.** First measure, then fix. Find whether the app got slower or the step was already at its budget's edge: time `addSymptom`'s phases (submit, local write, sheet close, row visible) on 65529f69's app and on the current tip (a production build, as CI runs it), several runs each, and print `localMs` on pass too. If a change made the row appear later (for example the row waits behind the sheet's exit fade, or a toast or layout change delays the render), fix the app so the new row shows without waiting for the overlay animation. Only if the app's time is unchanged and the step was already at the edge, say so with the numbers and propose (don't just raise) a budget the user approves: never widen it on your own. In the hand-off, give the before and after timings.

**Acceptance criteria.**

- [ ] The hand-off has timings for 65529f69 and the tip, phase by phase, and names the cause.
- [ ] `roundtrip.spec.mjs` prints `localMs` whether it passes or fails.
- [ ] With the fix, roundtrip passes on a production build at least 5 times in a row, `localMs` well under 2000 ms (say the margin).

## Wave 11 (written 2026-11-24 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no new dependency. No other PRD is running. B-684 (required asterisks) split in three, as its backlog notes plan: slice 70 adds the shared `required` prop and asterisk in `ui/`; slices 71 and 72 (B-801, B-800) apply it to the forms and are blocked by slice 70 (start them once it is merged into prd/fixes-ui); they touch separate files and run at once. For every form, derive which fields are required from its Zod schema and service rules, never by guessing, including conditional ones (an Other care period needs a label). Still held: B-694 (the user approves each form live; it coordinates with these asterisks), B-325 (Capacitor).

## Slice 70: A required prop puts a colored asterisk on required fields (B-684)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**Problem.** The user wants a colored asterisk (`*`, the character, not an icon) after the label of each required field, and no "(optional)" labels. `ui/Field.tsx` has no `required` prop and no field marks itself required today.

**Build.** Add one `required` prop to `Field` and to the `ui/` controls that render their own label or legend (`ChoiceGroup`, `CheckField` where it can be required, `date/DateTimeField`, `ComboBox` if it renders a label), so the asterisk lives in one place: `*` after the label text, `aria-hidden`, in the theme's error color, meeting contrast in light and dark. The control gets `aria-required="true"`, not the native `required` attribute (so browser popups don't replace our inline errors), unless the form sets `noValidate`. Show it on the `/dev/ui` page (Field's section). Document the rule in docs/domain/ui-kit.md: required fields pass `required`, labels never say "(optional)", help text only saying "Optional" goes. Don't change any app form here (slices 71 and 72 do).

**Acceptance criteria.**

- [ ] Component test (`Field.browser.test.tsx`): a `required` field shows an `aria-hidden` `*` after its label and its control has `aria-required="true"` and no `required` attribute; without the prop, neither.
- [ ] Component test: the same for each group control given `required` (the legend gets the asterisk; the group or its inputs carry `aria-required`).
- [ ] The asterisk's color meets 4.5:1 contrast on the form background in light and dark (say the ratios in the hand-off).

## Slice 71: Medication, provider, profile and care period forms mark required fields (B-801)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/medications.md, docs/domain/providers.md, docs/domain/profiles.md, docs/domain/care-periods.md · Tests: component

**Blocked by:** slice 70.

**Problem.** These forms label optional fields "(optional)" and mark nothing required.

**Build.** With slice 70's `required` prop, mark the required fields and drop "(optional)" from labels, and reword help text that only says "Optional" (keep any useful hint), in `routes/app/groups/medications/` (`MedicationForm`, `ScheduleFields`, `ConditionsField`, `ProviderPickerField`, `passes/PassForm`), `routes/app/groups/providers/ProviderForm`, `routes/app/groups/profile/` (`EmergencyForm`, `allergies/AllergyForm`, `conditions/ConditionForm`, `ConditionNameField`), `routes/app/groups/periods/` (`PeriodForm`, `PlacePickerField`), `components/medications/` (`NameField`, `MarkDoseDialog`, `MedicationStatusActions`) and `components/providers/` (`ProviderPickerField`, `ProvidersPickerField`; the picker label their callers pass) and `components/schedule/ScheduleFields`. Slice 70 made `DateTimeField` required only when given `required` (it was always `isRequired` before): pass it wherever a date or time is required in your files. Required fields come from each form's Zod schema and service rules; a conditionally required field shows the asterisk only while it is required. Update the tests that find these fields by their "(optional)" names. Stay out of the timeline, todo, entry, group, admin and marketing forms (slice 72).

**Acceptance criteria.**

- [ ] Component tests beside the forms: the medication, provider, allergy, condition, emergency and care period forms show the asterisk on exactly their required fields, and the care period label field gets it only for Other.
- [ ] No label in these files says "(optional)" (`grep` in the hand-off); existing tests pass with the new names.

## Slice 72: Timeline, todo, event and the remaining forms mark required fields (B-800)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md, docs/domain/todos.md, docs/domain/appointments.md · Tests: component

**Blocked by:** slice 70.

**Problem.** The rest of the app's forms label optional fields "(optional)" and mark nothing required.

**Build.** As slice 71, for `routes/app/groups/timeline/` (`EntryForm`, `DoseForm`, `FeelingFields`, `QuickAddFields`, `VitalField`, `pass/PassLogForm`), `routes/app/groups/todos/` (`TodoForm`, `TodoLinkFields`, `LinkPickerField`, `AssigneeField`), `routes/app/groups/entry/`, `components/entry/CancelEventDialog`, `components/repeat/SeriesEditSheet`, `components/groups/NewGroupFields`, the sign-in, account and join forms, `routes/admin/settings/SettingCard` and `routes/marketing/sections/PublicForm`, and `components/visitPrep/VisitPrepSheet`. Slice 70 made `DateTimeField` required only when given `required`: pass it wherever a date or time is required in your files (`EntryForm`, `DoseForm`, `PassLogForm`, `VisitPrepSheet`). Leave slice 71's files alone. Update the tests that find fields by "(optional)" names (`timelineEasyTiles`, `timelineQuickEntry`, `timelineQuickEntryTodos`, `todos`, `todoRepeat`, `periods` only where its fields are yours, `ui/sheetExit`).

**Acceptance criteria.**

- [ ] Component tests beside the forms: a new event, a note entry, a todo and a new group show the asterisk on exactly their required fields.
- [ ] No user-visible label or help text under `apps/web/app` says "(optional)" or only "Optional" once slices 71 and 72 are both in (`grep` in the hand-off, naming any code-only hits left); existing tests pass with the new names.

## Wave 12 (written 2026-11-25 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no new dependency. No other PRD is running. Slices 73 and 74 both mount in the `/app` layout (`routes/app/layout/`): 73 owns `SectionNav.tsx` and the tab bar's CSS in `app.css`, 74 adds its own component and only a mount line in `layout/route.tsx`; the orchestrator resolves any merge conflict. Slice 75 owns `root.tsx`'s `HydrateFallback` and the layout's loading state. Still held: B-694 (the user approves each form live), B-325 (Capacitor; slice 75 takes only its blank cold start).

## Slice 73: The phone tab bar is thinner and translucent, its current section a full-height pill (B-803)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component (browser)

**Problem.** The phone bottom tab bar (`nav[data-tab-bar]`, `routes/app/layout/SectionNav.tsx`, styles in `app.css`) is tall and opaque, and its current section is a small rounded button.

**Build.** Make the bar thinner vertically (keep 44 px touch targets and the iOS home-indicator inset, `env(safe-area-inset-bottom)`, from B-763), slightly translucent with a backdrop blur over the content behind it (a solid fallback where `backdrop-filter` isn't supported; text keeps 4.5:1 in light and dark). The current section shows as a horizontal oval with the bar's own radius, filling its slot's height, and moves to the new section with a short motion (transform, about 200 ms) that `prefers-reduced-motion` turns off. Keep B-664's hide-while-typing and the end-of-page clearance (`frame.browser.test.tsx`): if the bar's height changes, the page padding that clears it changes with it.

**Acceptance criteria.**

- [ ] Browser component test at 420: the bar is shorter than before, has a `backdrop-filter`, and the current section's indicator spans its slot's height; with reduced motion there is no transition.
- [ ] `frame.browser.test.tsx`, `tabBarKeyboard.browser.test.tsx` and `sectionNavPending.browser.test.tsx` pass (the end of a long page still clears the bar; a sheet is still over it).

## Slice 74: A clear banner while offline (B-804)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md, docs/domain/sync.md · Tests: component (browser)

**Problem.** Offline, only the header's small `SyncIndicator` says so; users miss it.

**Build.** An `OfflineBanner` in `routes/app/layout/` shown on every `/app` page while the device is offline, from the same connection state `SyncIndicator` reads (`lib/sync`), never a second source: "You're offline. Changes save on this device and sync when you reconnect." (`role="status"`, so it's announced once, not on every render). It isn't dismissable while offline and goes when the connection is back. It sits under the header, out of the content's way, and clear of the phone tab bar (slice 73) and open sheets; add only a mount line in `layout/route.tsx`. Easy mode keeps it too.

**Acceptance criteria.**

- [ ] Browser component test: offline shows the banner with its status role; back online hides it; at 420 it doesn't overlap the tab bar or the header.
- [ ] `SyncIndicator`'s existing tests pass unchanged.

## Slice 75: A loading screen instead of a blank page while the app starts (B-806)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md, docs/domain/sync.md · Tests: component (browser)

**Problem.** Starting the app, offline above all, shows a blank page: `root.tsx`'s `HydrateFallback` returns `null`, and the `/app` layout shows nothing while it opens the session and the local database (B-325 measured up to about 4 s).

**Build.** One `AppLoading` screen (the Caretook mark and "Loading…", in daisyUI's loading style, centred, theme-aware with no flash: it renders before the theme script settles, so use the `:root` tokens) returned by `root.tsx`'s `HydrateFallback` (the only one, AGENTS.md) and by the `/app` layout while it waits on the session or the local database. It comes up only after about 300 ms so a fast start doesn't flicker (reduced motion: no spinner animation). Offline it says nothing alarming: the B-804 banner (slice 74) tells the user they're offline once the app is up. Don't touch the safe-area half of B-325.

**Acceptance criteria.**

- [ ] Browser component test: `HydrateFallback` renders the loading screen (`role="status"`, "Loading"); the layout shows it while the database open is pending and the page once it resolves; under 300 ms nothing shows.
- [ ] `frame.browser.test.tsx` passes.

## Wave 13 (written 2026-11-25 by the orchestrator: the user's pre-call wave, only B-342, B-817, B-828)

Every slice: no migration and no new dependency. Land and remove the worktree within about 2 to 2.5 hours (before orchestration-split's wave 6).

## Slice 76: A dropped idle Postgres connection no longer crashes the function (B-342)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/data-layer.md, ops/runbook.md · Tests: unit

**Problem.** `packages/data/src/db/client.ts` creates a `pg.Pool` with no `error` listener, so an idle client dropped by Neon emits an unhandled `error` and crashes the serverless function. The pool's 10 clients with a 2 s connect wait (`config.ts`) time out under a burst of uploads.

**Build.** In `createPool`, attach `pool.on("error", …)` that logs the error (no secrets, no row data) and keeps the process alive. Raise the default `connectTimeoutMs` (for example to 10 s) so a burst queues instead of failing; keep both env overrides. `@vercel/functions` is only a dependency of `apps/web`: if `attachDatabasePool` fits, call it from the web server side (not from `packages/data`, which may not gain the dependency); otherwise skip it and say so in the hand-off.

**Acceptance criteria.**

- [ ] Unit test: the created pool has an `error` listener, and emitting `error` on it doesn't throw.
- [ ] Unit test: the default connect timeout is the new value and `DATABASE_CONNECT_TIMEOUT_MS` still overrides it.

## Slice 77: The phone tab bar is light in light mode; more glass in dark (B-817)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component (browser)

**Problem.** The phone bottom tab bar (`nav[data-tab-bar]`) is near-black in light mode (`--tab-bar-surface` in `apps/web/app/app.css`), and in dark mode its glass (`--tab-bar-glass`, 85% surface) isn't translucent enough.

**Build.** The user's call: in light mode a light, slightly translucent bar matching the page (a `base` surface, its content `base-content`, the current-section pill still clearly marked); dark mode keeps its surface but its glass mixes less of it (lower than 85%) where backdrop blur is supported, keeping 4.5:1 text contrast. Update the comment block above the tokens. Don't move the bar's position (the safe-area idea is not scheduled).

**Acceptance criteria.**

- [ ] Component test: in light theme the tab bar's computed background is light (not the neutral near-black), and its label text meets 4.5:1 against it.
- [ ] Component test: in dark theme the bar's glass is more translucent than before (its alpha below 0.85 where blur applies).

## Slice 78: Switching settings pages and submenus shows that the tap registered (B-828)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component (browser)

**Problem.** Moving between group settings pages (`routes/app/groups/settings/`) and other submenus (user settings `routes/app/settings/`, the group menu) sometimes takes a moment with no feedback, so it looks like nothing happened. The section tab bar already shows a pending state (`sectionNavPending.browser.test.tsx`); these links don't.

**Build.** Find the links that navigate without feedback (the settings index lists, the settings layouts' page links, the group menu's items) and give them an immediate pending state, reusing the pattern `SectionNav`/`TabNav` use with `useNavigation` (the tapped link marked pending with a small spinner, or a thin progress bar in the settings layout while `navigation.state !== "idle"`). No edits under `components/ui/` unless the shared pattern belongs there; say so in the hand-off if it does.

**Acceptance criteria.**

- [ ] Component test: tapping a group settings page link while its loader is pending shows the pending state at once, and it clears when the page renders.
- [ ] Component test: the same for a user settings page link.

## Wave 14 (written 2026-11-25 by the orchestrator, from the triaged fixes-ui items)

Every slice: no migration, no new dependency, no edits under `apps/web/test/` (orchestration-split-2 is running). Still held: B-694 (the user approves each form live) and B-325 (Capacitor). Slices 79–84 touch different files and run at once.

## Slice 79: Picking a care group on the no-group page shows it's loading (B-819)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md, docs/domain/care-groups.md · Tests: component (browser)

**Problem.** On the no-group page (`routes/app/home/route.tsx`), picking a care group gives no feedback while the group loads (the first load can be slow), and the buttons can be tapped again.

**Build.** The user is fine with either: show a loading state at once. Prefer marking the tapped choice pending (a small spinner and "Opening…" in it) and disabling the other choices while `useNavigation().state !== "idle"`, the way `SectionNav` shows its pending state (`sectionNavPending.browser.test.tsx`). If the route's own `brand/AppLoading` screen fits better, use it and say why in the hand-off. No data change.

**Acceptance criteria.**

- [ ] Component test: tapping a group marks that choice pending (accessible: `aria-busy` or its "Opening…" text) before the navigation finishes.
- [ ] Component test: while one is pending, the group choices can't start a second navigation.

## Slice 80: Quick entry tips use the group's own provider and medication (B-833)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/assistant.md · Tests: component (browser)

**Problem.** The quick entry tips' examples (`QUICK_ENTRY_EXAMPLES` in `components/quick-entry/quickEntryCopy.ts`) name a made-up "Dr Lee" and "metformin" even when the group has its own.

**Build.** The example "appt Dr Lee Friday 2pm" names one of the group's providers and "gave metformin" one of the group's medications (read from the local database, the way the quick entry screens already read them), each falling back to the fictional default when the group has none. Say "event", not "appt" (B-537: "Event" app-wide); keep the example something the parser understands. The box's accessible description (`QUICK_ENTRY_RULES`) reads the same lines. `QuickEntryTips.tsx` takes the names as props or reads them itself, whichever matches its callers.

**Acceptance criteria.**

- [ ] Component test (`timelineQuickEntryTips.browser.test.tsx`): with a group provider and medication, the tips name them; with none, the fictional defaults show.
- [ ] Component test: the tips say "event", not "appt".
- [ ] Unit or component test: each example still parses as the kind it shows.

## Slice 81: Members invite cards fit a phone (B-843)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: component (browser)

**Problem.** In group settings Members, on a phone: the invite links card (`routes/app/groups/settings/members/InviteLinks.tsx`) squeezes its details to one word per line ("Used / 1 / of / 10 / times …") and "Expires Dec" runs under Copy and Share; the pending invitations card (`PendingInvites.tsx`) cuts the email to "sam.invited@e…" and wraps the meta over five lines beside Resend and Revoke.

**Build.** At narrow widths put each card's actions on their own row under the details (or in a menu if a row doesn't fit), let the details run the card's full width, and let the email wrap (`break-all`/`overflow-wrap:anywhere`) or show in full. Wider screens keep today's side-by-side layout if it fits. The "Couldn't load this link" error is B-830, not this.

**Acceptance criteria.**

- [ ] Component test at 375px: the invite link's details don't sit beside its Copy and Share buttons (the buttons start below the details), and no text overlaps them.
- [ ] Component test at 375px: a pending invite shows its full email, and Resend and Revoke sit below it.

## Slice 82: The header's right links don't overlap the recipient selector at medium widths (B-848)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component (browser)

**Problem.** On medium-sized screens the header's right nav links overlap the recipient (care group) selector and the header menu (`routes/app/layout/`: `route.tsx`, `SectionNav.tsx`, `GroupMenu.tsx`, `UserMenu.tsx`).

**Build.** Find the widths where they collide and fix the layout so nothing overlaps at any width from phone to desktop: let the selector truncate its name, move the breakpoint where the section links join the header, or let the links shrink, whichever keeps every link reachable. Keep the phone tab bar and desktop header as they are where they fit. Frame tests pin the header's regions (`frame.browser.test.tsx`, `staff.browser.test.tsx`): keep their order or update them in this slice.

**Acceptance criteria.**

- [ ] Component test at several widths across the medium range (for example 640, 768, 900 and 1024px): the section links' boxes don't intersect the group selector's or the header menu's.
- [ ] The existing frame tests still pass.

## Slice 83: Timeline View menu says Condensed and Full (B-849)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component (browser)

**Problem.** The timeline View menu's layout choices read "Rows" and "Cards".

**Build.** In `routes/app/groups/timeline/TimelineViewMenu.tsx`, the labels become "Condensed" (was Rows) and "Full" (was Cards); the ids (`rows`, `cards`) and saved preference stay, so no one's choice changes. Update the comment, the test helper `setView` in `timelineWorld.tsx` and any test or doc that finds the options by their old names.

**Acceptance criteria.**

- [ ] Component test: the View menu offers "Condensed" and "Full", and picking each still switches the layout.
- [ ] No test or screen still names the layout "Rows" or "Cards".

## Slice 84: Timeline Full view shows live notes' rich text (B-850)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/timeline.md, docs/domain/live-notes.md · Tests: component (browser)

**Problem.** In the timeline's Full (cards) view, a live note shows as plain text, losing its headings, lists and bold.

**Build.** Find what the timeline has for a live note's body (a stored snapshot or the Yjs doc) and render its formatting in `TimelineEntryCard`/`components/entry/EntryBody.tsx` in Full view only (Condensed keeps its two-line plain clamp), read-only, with mentions shown as in the editor. Reuse the Tiptap setup in `components/notes/` (a non-editable editor or its schema's HTML output); search highlighting may stay plain-text if it can't mark rich text, say so. **Stop and say so in the hand-off** if it needs a schema or sync change, loading every note's Yjs doc per card, or makes the timeline visibly slower: then it outgrows a fix.

**Acceptance criteria.**

- [ ] Component test: in Full view a live note with a heading, a list and bold text renders them as `h`, `li` and `strong` elements, not editable.
- [ ] Component test: in Condensed view the same note still shows its plain two-line clamp.

## Wave 15 (written 2026-11-25 by the orchestrator, from the triaged fixes-ui items)

## Slice 85: Quick entry previews title events with Event, not Appointment (B-857)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/appointments.md · Tests: unit (`packages/data`)

**Problem.** Quick entry's parser still titles an event line "Appointment with <provider>", "<words> appointment" or "Appointment" (`packages/data/src/db/schema/assistant/quickEntry.ts`, the `title` for a keyword line, near line 1728). B-537 made Event the one word app-wide.

**Build.** The titles become "Event with <provider>", the typed words alone, capitalized ("Dental cleaning", not "Dental cleaning event"), and "Event". The parser still recognizes "appointment", "appt" and "visit" as keywords: only its output wording changes. Update `quickEntry.test.ts`, `quickEntryPreview.test.ts` and any other test, browser check (`scripts/browser-checks/`) or connector text that asserts the old titles (grep for "Appointment with" and `appointment"`).

**Acceptance criteria.**

- [ ] Unit test: "appointment with Dr. Lee tomorrow 3pm" previews the title "Event with <provider>"; "dental cleaning appt friday" previews "Dental cleaning"; a bare "appointment tomorrow" previews "Event".
- [ ] No test, browser check or screen still expects an "Appointment" title from quick entry.

## Wave 16 (written 2026-11-26 by the orchestrator, from the triaged fixes-ui items)

Slices 86–94. Slice 90 is blocked by 89 (same file, `OfflineBanner.tsx`); the others are independent. Still held: B-694, B-325.

## Slice 86: The front page's hero buttons sit side by side on a phone (B-885)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/marketing.md · Tests: component

**Problem.** On a phone the front page hero's two call-to-action buttons wrap onto two lines (`apps/web/app/routes/marketing/home/`, `routes/marketing/sections/Sections.tsx`).

**Build.** The two buttons fit side by side at 360 px wide and up (shorter padding or size on small screens, `flex-nowrap`, no text wrapping inside a button); the wider layout is unchanged. Don't change the copy.

**Acceptance criteria.**

- [ ] Component test at a 360 px viewport: the hero's two buttons share one row (same top) and neither label wraps.

## Slice 87: Quick entry's suggestion popovers don't overlap; Tab completes one suggestion (B-897, B-900)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md, docs/domain/components.md · Tests: component

**Problem.** In quick entry (`components/quick-entry/`: `QuickEntryBox.tsx`, `QuickEntryCompletions.tsx`, `QuickEntrySuggestions.tsx`), the medication autocomplete popover covers the event suggestion box (B-897). Tab does nothing useful in the autocomplete (B-900).

**Build.** The autocomplete opens **above** the input and the suggestion box stays **below**, so neither covers the other (keep it on screen near the top edge: flip below only when there's no room above, and then the suggestion box still isn't covered). Tab: with exactly one autocomplete suggestion, Tab completes it and keeps focus in the input; with several, Tab moves focus into the suggestion list (the first item) so arrows and Enter pick one; with none, Tab moves on as usual. Escape still closes the list.

**Acceptance criteria.**

- [ ] Component test: typing a medication name with the event suggestion showing, the autocomplete's box sits above the input and doesn't intersect the suggestion box.
- [ ] Component test: one suggestion, Tab completes it and focus stays in the input; several, Tab focuses the first suggestion; none, Tab leaves the input.

## Slice 88: Quick entry reads type words without a colon and 'add' as a cue (B-902)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/assistant.md · Tests: unit (`packages/data`)

**Problem.** The parser (`packages/data/src/db/schema/assistant/quickEntry.ts`) only takes a kind from prefixes like `t:`, `task:`, `todo`, `to-do:`, `to do:`. "to-do call the pharmacy", "add todo …", "add note …", "add event …" don't pick their kind.

**Build.** A leading type word picks its kind with or without a colon (`todo`, `to-do`, `to do`, `task`, `note`, `event`, and whichever other kind words the parser already knows). A leading `add` followed by a type word is a cue: both words are dropped and the kind is set. `add` not followed by a type word stays part of the text ("add salt to diet" is not a kind cue and keeps its words). Don't misread a type word that is the start of ordinary text when the existing rules already treat it as text (keep every existing test green; if one conflicts with this item, follow the item and note it in the hand-off). Update the prefixes list in `docs/domain/assistant.md`'s wording only through the hand-off (loops don't edit docs: say what changed).

**Acceptance criteria.**

- [ ] Unit tests: "to-do call the pharmacy", "todo call the pharmacy", "add todo call the pharmacy", "add to-do call the pharmacy" each parse as a to-do titled "Call the pharmacy" (or the parser's usual casing); "add note slept well" is a note; "add event dentist friday 3pm" is an event; "add salt to diet" keeps "add" in its text and isn't given a kind by the cue.

## Slice 89: The offline banner no longer shows at random while online (B-904)

Stack: yes · Reads: plans/fixes-rules.md, docs/domain/sync.md, docs/domain/app-shell.md · Tests: component

**Problem.** After B-840's 10 s grace (`routes/app/layout/OfflineBanner.tsx`), the banner still appears at random while online, mostly on local dev.

**Build.** Find the cause first, on the dev stack: log what flips the status the banner reads (PowerSync `connected`, `navigator.onLine`, or whatever it uses) with timestamps and reasons. Leads: a cold dev load (Vite unbundled modules, the PowerSync worker and WASM) taking over 10 s to connect; dev server restarts or HMR reloads; the local PowerSync container closing streams, or the 5-minute token refresh (`auth.ts`) leaving `connected` false longer than a retry. Fix the cause. If it is dev-only and not reachable in production, widen the grace on dev only (by `import.meta.env.DEV`), and say so. The banner should mean "you're offline", so prefer `navigator.onLine` plus a failed reconnect over a single PowerSync disconnect if that's the cause. Remove the logging before hand-off (or leave it behind a dev-only flag). The hand-off names the cause found.

**Acceptance criteria.**

- [ ] Component test (beside `offlineBanner.browser.test.tsx`) covering the cause found: e.g. a stream that drops and reconnects within the grace, or a token refresh, never shows the banner; a real offline still shows it after the grace.

## Slice 90: The offline banner is a kit banner and doesn't shift the page (B-905)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component · Blocked by: slice 89

**Problem.** `OfflineBanner.tsx` is a hand-rolled `<p>` in the page flow under the header, so it pushes the page down when it opens.

**Build.** Build it from the kit: `ui/Notice` if it fits, else a banner variant added to `ui/` (and to the `/dev/ui` gallery), per ui-kit.md. Show it without moving content: overlaid just under the header (absolutely or fixed positioned within the frame), never covering the header, the tab bar or an open sheet. Keep its live region (`role="status"` or what it has), `print:hidden`, and slice 89's timing.

**Acceptance criteria.**

- [ ] Component test: the banner renders through the kit component; showing it doesn't change the main content's top offset (measure before and after); it doesn't overlap the header.

## Slice 91: Today's add-care-period button sits next to the care period (B-906)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/timeline.md, docs/domain/care-periods.md · Tests: component

**Problem.** On the timeline's Today header (`routes/app/groups/timeline/DayHeader.tsx`), the add-a-care-period icon sits far from the care period display.

**Build.** Put the button right beside the care period display (a small gap, one group), at every width; nothing else on the header moves. Keep its label and hit size.

**Acceptance criteria.**

- [ ] Component test (beside `timelineCarePeriods.browser.test.tsx`): the button's left edge is within a few pixels (say 16 px) of the care period display's right edge, at phone and desktop widths.

## Slice 92: One standard full-page loader inside the app frame (B-908)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component

**Problem.** In-app full-page loads use `ui/Loading`'s small inline spinner (`components/shell/FirstSyncPending.tsx`: "Getting your care groups…"), not the app loader's look (`brand/AppLoading.tsx`).

**Build.** A `ui/` page loader with AppLoading's look (the mark, spinner and message, centred in the content area), shown inside the `/app` frame under the header, with a custom message. Optional, configurable "Go back" button to cancel a load, and a watcher that after a configurable threshold (default about 10 s) shows a "this is taking a while" prompt with Go back. Go back uses history when there is any, else the groups list (`appUrls`). Reuse AppLoading's styles (share them, don't copy); AppLoading itself stays root's script-free HydrateFallback. Add it to the `/dev/ui` gallery. Move FirstSyncPending onto it. The other `ui/Loading` uses (home route, RemindMeSheet, VisitPrepSheet, GoogleCard) are inline or in sheets: move only the home route if it's a full-page load, leave the rest.

**Acceptance criteria.**

- [ ] Component test: the loader shows its message; the slow prompt appears only after the threshold (fake timers); Go back navigates back, or to the groups list with no history. No exact-wording asserts.
- [ ] FirstSyncPending renders through the new loader (its test updated).

## Slice 93: Providers list: Condensed and Full layouts, sharing the timeline's control (B-909)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/providers.md, docs/domain/timeline.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: unit, component

**Problem.** The timeline has a Condensed/Full layout choice (the Layout section of `routes/app/groups/timeline/TimelineViewMenu.tsx`, saved as `userPreferences.timelineView` through `useTimelineView` and `saveSettings`); the providers list has none.

**Build.** Lift the layout items and their icons (lucide `List` for Condensed, `LayoutList` for Full) into one shared piece in `components/` (or `ui/` if it's generic) used by both the timeline's menu and the providers list. Add a separate optional `providersView` key to `userPreferencesZSchema` (`packages/data/src/db/schema/app-shell/userPreferences.ts`; jsonb, no migration; same values as `TIMELINE_VIEWS`, default Condensed), with a resolver like `resolveTimelineView`, and a hook like `useTimelineView`. The providers list (`routes/app/groups/providers/`: `ProviderListItem.tsx`, `DirectoryResults.tsx`) gets a dense one-line row for Condensed (name, specialty, the main contact action) and today's fuller item for Full. The timeline's behaviour is unchanged. The user's choice (2026-11-26): separate settings. If this runs past 12 files, hand off what's done and say so.

**Acceptance criteria.**

- [ ] Unit test: `providersView` parses, and resolves to Condensed when unset; the timeline's key is unaffected.
- [ ] Component test: the providers list shows Condensed rows by default; choosing Full switches to the fuller items and saves `providersView`; the timeline's menu still shows its layout choice through the shared piece.

## Slice 94: The printed weekly sheet marks a dose given, skipped or refused (B-916)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/medications.md · Tests: unit, component

**Problem.** The weekly medication sheet (`routes/app/groups/medications/print/week/`: `weeklySheet.ts`, `WeeklyChart.tsx`, `route.tsx`) only leaves room to mark a dose given.

**Build.** Each slot gets three small marks to circle or tick: G (given), S (skipped), R (refused), with a legend on the sheet saying what each means, so the paper matches the app's dose states and an AI can read a photo of it (clear, separate boxes). Drop PrintAllergies and PrintConditions from the weekly sheet (they stay on the medication list print) and use the room for the marks. Keep it on one page at the sizes it fits today.

**Acceptance criteria.**

- [ ] Unit test (`weeklySheet.test.ts`) or component test: each slot has the three marks; the legend is present; the weekly sheet no longer renders allergies or conditions, and the medication list print still does (`print.browser.test.tsx`).
