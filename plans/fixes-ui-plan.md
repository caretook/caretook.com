# Plan: Fixes (ui)

Small UI fixes: look, layout, wording and flow. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-ui`.

## Status

Landing mode: **run everything through** (started run-through, 2026-11-22). Start every ready slice, land each green wave, clean up; questions and reports only through `pnpm prd ask`.

Wave 1: slices 1–9, written 2026-11-22. Models: opus for all. Slice 2 waits for 1, slice 7 for 6 (same files); the rest start at once. Slice 1 is merged. Slices 2, 3, 4, 5, 6, 8 and 9 have worktrees and agents; 7 is not started. Slice 2 stacks the owner pill in `[data-when-column]` after `ContactActions`, with `relative z-10` so it stays tappable.

Left for a later wave: B-316 (unsaved-changes guard), B-535 (hour-first time picker), B-536 (danger text contrast) and B-537 (Event wording) touch ui-kit-3's hot files (`components/ui/`, `lib/timeline/entryDisplay.ts`, `lib/app-shell/`, `routes/dev/ui/`). B-325 (native safe area and cold start) waits for the Capacitor work, as its triage says.

| Slice | Item  | State          | Merge    |
| ----- | ----- | -------------- | -------- |
| 1     | B-256 | merged (opus)  | b5373bc9 |
| 2     | B-416 | started (opus) | —        |
| 3     | B-538 | started (opus) | —        |
| 4     | B-412 | started (opus) | —        |
| 5     | B-519 | started (opus) | —        |
| 6     | B-413 | started (opus) | —        |
| 7     | B-422 | written        | —        |
| 8     | B-421 | started (opus) | —        |
| 9     | B-319 | started (opus) | —        |

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

Blocked by: slice 1 · Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/todos.md · Tests: component

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

Blocked by: slice 6 · Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md, docs/domain/providers.md · Tests: component

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
