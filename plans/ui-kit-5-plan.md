# Plan: UI kit 5 (the last areas swept onto the kit, and the guard closed)

> Source PRD: [`plans/ui-kit-5-prd.md`](ui-kit-5-prd.md). User-story numbers (US) refer to it. Backlog item B-577. Topic `ui-kit-5`.

## Status

| Slice | Title                                         | Wave | State         | Merge    |
| ----- | --------------------------------------------- | ---- | ------------- | -------- |
| 1     | Timeline list and Today, guard list regrouped | 1    | landed (opus) | 052389e8 |
| 2     | Timeline forms and sheets                     | 2    | landed (opus) | 85bcc859 |
| 3     | Easy view and quick entry                     | 2    | landed (opus) | 0e7f842f |
| 4     | Entries and the notes editor                  | 2    | landed (opus) | 01a9b113 |
| 5     | Admin                                         | 2    | landed (opus) | a9b7f208 |
| 6     | Account, connectors and marketing             | 2    | landed (opus) | 2f650721 |
| 7     | The frame, home, and closing the guard        | 3    | merged (opus) | 9cb93892 |

**Landing mode:** run everything through (start every ready slice, land each green wave, clean up, ask only real questions through `pnpm prd ask`).

**Now:** wave 2 (slices 2 to 6) landed in dev as 5f4ca971 through PR #110: Codex clean on c1cb1c4c, full CI green (run 45162901683), browser checks passed once each on e61861bd (roundtrip, live-notes, sign-in, first-sync, session-end, invites, ui, marketing). One quarantined emergency-sheet test failed in that run after passing on a9fd0459; this wave changed no profile file. Report filed; slice worktrees removed; `ui-kit.md` folded. Wave 3: backlog ingested (nothing new for this topic), branch current with dev, slice 7 handed off (8d597f2e) and merged as 9cb93892; its worktree stays until the wave's verdict is green. Next: quick check, CI tier, changed browser checks, PR, Codex, land. At landing fold into docs: `components.md` drops the `KIT_CLASSES_NOT_SWEPT` sentence; `ui-kit.md` says `Menu`'s trigger always goes through `buttonClass` (default look when none is given), `className` is outer classes only, and adds `navLinkClass`. The frame and home component tests were not run by the slice: the CI tier must cover `frame`, `groupMenuPeriod`, `sectionNavPending`, `staff`, `pendingRequests`, `newGroup`, `notSaved`. `Popover` keeps its bare class string; only `Menu`'s goes in slice 7. Browser checks at gates: the changed ones only (`pnpm prd browser --changed --base dev --list`, one name per call). No Status commit between `pr` and `land`.

**Backlog:** B-577 marked done at slice 7's merge.

## Durable decisions

- **A sweep keeps behaviour:** same URLs, roles, data, labels, order, `data-*` hooks, focus and accessible names. No migration, no dependency, no change to a loader, sync query, service, email or print layout.
- **Use the ui-kit doc's "Which to use"**, including its list of what is not a `Button`. New primitives only for a repeated pattern, at the end of the append-only files.
- **Each sweep covers:** buttons and button-like links; form controls; alert, card, list and badge classes; `text-base-content/…` and hand-written link or dark-contrast text; "No … yet." lines; Cancel and Save footers in real forms; section headings; expanders; icon sizes.
- **A slice's last step deletes its group** from `KIT_CLASSES_NOT_SWEPT`, and lint on its files proves the sweep.
- **Menu triggers:** a slice moves the triggers in its files to `variant`, `size`, `shape`, with outer classes in `className`. The tool circle is `variant="ghost" size="sm" shape="square"` plus `CIRCLE`.
- **Text clamps stay clamps** (`TodayRow`'s Show all, `EntryBody`'s More). `Collapse` is for content that is fully hidden when closed.
- **Leave to `fixes-ui`:** the Today card's expander (B-613), the kind and author filter links and `CIRCLE`'s hover (B-617), the day header's button order (B-618). Keep their changes when a sync brings them.
- **Light pages** (account, `/connect`, marketing) import only from `ui/plain`.
- **`Collapse` never sets `hidden`:** closed, it is `inert` without `data-open`. Put the region's `data-*` hook on the `Collapse`, and move any test reading `.hidden` to `aria-expanded` or `data-open`.
- **Skeletons:** `Skeleton` draws only `h-4` bars and takes no `data-*`. Where a region reserves a taller block, a wrapper keeps the hook and height, so the page doesn't jump.

## How to run this plan

- **Wave 1: slice 1 alone.** It regroups the guard's list by owning slice, so later parallel deletions don't conflict.
- **Wave 2: slices 2, 3, 4, 5 and 6 together.** Each owns the files named in its slice. A shared part keeps its props unless its slice moves every caller.
- **Wave 3: slice 7,** after every other sweep, because it removes `Menu`'s bare-string branch and the list.
- **Gates:** each slice runs its own area's component tests and lint. The orchestrator runs the changed checks at each wave's gate. Sync `dev` before each wave: `onboarding`, `fixes-ui`, `symptom-catalog`, `tags` and `planner-3` share these folders.

## Slice 1: Timeline list and Today, guard list regrouped

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md · Tests: unit, component

**User stories:** US 1, 11, 12, 13.

**Build:**

- First, regroup `KIT_CLASSES_NOT_SWEPT` under one comment per slice, using the groups named in slices 1 to 7.
- Sweep the timeline page: `TimelineEntryList`, `TimelineEntryRow`, `TimelineEntryCard`, `TimelineFilters`, `FilterSheet`, `TimelineHeader`, `TimelineViewMenu`, `DayHeader`, `DaySummaryLine`, `PeriodMarkerItem`, `LiveNowBanner`, `InviteSomeoneCard`, `RemoveLastEntry`, `AddedMedicationToast`.
- Sweep Today: `TodayCard` (its text and loading state; its expander stays with B-613), `TodayRow` (with `TodayRowSkeleton`), `TodayMedicationsRow`, `PassLogItem` (`Collapse`).
- The timeline route's container moves to `Page`, keeping its wide layout.

**Acceptance criteria:**

- [ ] The guard's list is grouped by slice, and this slice's group is deleted: `FilterSheet`, `InviteSomeoneCard`, `LiveNowBanner`, `RemoveLastEntry`, `TimelineEntryList`, `TimelineEntryRow`, `TimelineFilters`, `TodayMedicationsRow`. `scripts/eslint/rules.test.mjs` passes.
- [ ] The timeline's component tests pass, selecting by role and name.
- [ ] A component test covers `PassLogItem`'s `Collapse`: closed rows are out of the tab order and `aria-controls` points at the region. The `.hidden` reads in `timelineStrips` and `passSheet` tests move to `aria-expanded` or `data-open`.

**Blocked by:** none. **Blocks:** 2, 3, 4, 5, 6, 7.

## Slice 2: Timeline forms and sheets

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md · Tests: component

**User stories:** US 2, 11, 13.

**Build:** sweep `EntryForm`, `DoseForm`, `EntryKindPicker`, `FeelingFields`, `SymptomFields`, `VitalField`, `VitalReadingRow`, `VitalReadingsFields`, `VitalTypeMenu` (look props from its two callers), `QuickAddFields`, `QuickAddMenu`, `PassLogForm` and the new, edit, new-dose and pass sheet routes. Real forms take `FormFooter`.

**Acceptance criteria:**

- [ ] This slice's group is deleted from the guard's list: `DoseForm`, `EntryForm`, `EntryKindPicker`, `FeelingFields`, `QuickAddMenu`, `VitalReadingRow`, `VitalReadingsFields`, `pass/PassLogForm`.
- [ ] The timeline's sheet and form component tests pass, including the unsaved-changes guard.
- [ ] A component test covers Cancel and Save through `FormFooter` on an entry sheet, if none does already.

**Blocked by:** 1. **Blocks:** 7.

## Slice 3: Easy view and quick entry

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md, docs/domain/assistant.md · Tests: component

**User stories:** US 3, 4, 11, 12, 13.

**Build:** sweep `EasyTimeline` (to `Page`), `EasyNow`, `EasyNext` (`Chevron` and `Collapse`), `EasyTiles`, `EasyTodos`, `EasyModeToggle`, and quick entry's `QuickEntryBox`, `QuickEntryCard`, `QuickEntrySuggestButton` and `QuickEntrySuggestions`. `EasyNext`'s list mounts on first open and then stays mounted, so closing can animate and its query doesn't run before anyone opens it. Their skeleton blocks keep their heights. Move the class reads in `timelineEasy` and `timelineEasyTodos` tests to role and name, and the `.hidden` reads in `timelineEasyNow` to `aria-expanded` or `data-open`.

**Acceptance criteria:**

- [ ] This slice's group is deleted from the guard's list: `EasyNow`, `EasyTiles`, `QuickEntryBox`, `QuickEntryCard`, `QuickEntrySuggestButton`.
- [ ] The Easy view and quick entry component tests pass.
- [ ] A component test covers `EasyNext`'s `Collapse`, if none does already.

**Blocked by:** 1. **Blocks:** 7.

## Slice 4: Entries and the notes editor

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md, docs/domain/live-notes.md · Tests: component

**User stories:** US 5, 11, 12, 13.

**Build:** sweep the entry route (to `Page`, keeping its print padding), `EntryCancelledBanner`, `EntryRepeat`, `EntryTimeChip`, `EntryVisitPrep`, `EntryWithRow`, `PeriodSuggestionChip`, `ShareButton`, `EntryActions`, `RemindMeSheet`, `EntryBody` (its clamp stays), `EntryHeader`, `EntryPlaceRow`, `OlderEntries`, `MedicationEntryText`, and the notes editor's `LiveNotesEditor`, `MentionChip` and `MentionPopup`. `EntryPrintView` stays, and `KindIcon`'s filter links stay with B-617. The title and place inputs stay ghost inputs that save on blur. `entryMentions`' test that pins `text-base-content/50` moves to the new class.

**Acceptance criteria:**

- [ ] This slice's group is deleted from the guard's list: the eight `routes/app/groups/entry/` paths, `EntryActions`, `RemindMeSheet`, `LiveNotesEditor`.
- [ ] The entry page's component tests pass, and the printed entry is unchanged.

**Blocked by:** 1. **Blocks:** 7.

## Slice 5: Admin

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/admin.md · Tests: component

**User stories:** US 6, 11, 12, 13.

**Build:** sweep every `/admin` page and part onto the kit's controls, keeping its own heading sizes. The access-codes print sheet stays.

**Acceptance criteria:**

- [ ] This slice's group is deleted from the guard's list: the 20 `routes/admin/` paths.
- [ ] The admin component tests pass.

**Blocked by:** 1. **Blocks:** 7.

## Slice 6: Account, connectors and marketing

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/auth.md, docs/domain/connectors.md, docs/domain/marketing.md · Tests: component

**User stories:** US 7, 8, 9, 11, 12, 13.

**Build:**

- Sweep `AuthCard` and the account forms; `ConnectGuide`, `AskOwners`, `ConnectConsent`.
- Marketing, through `ui/plain`: calls to action, the public form's fields and error, the legal draft notice. The header and footer links, the honeypot, the submit's `aria-disabled` and `routes/marketing/`'s allowlist entry stay.

**Acceptance criteria:**

- [ ] This slice's group is deleted from the guard's list: `AuthCard`, `ConnectGuide`, `AskOwners`, `ConnectConsent`.
- [ ] `ui/plain/plain.test.ts` passes, so light pages carry no React Aria.
- [ ] The account, connector and marketing component tests pass.

**Blocked by:** 1. **Blocks:** 7.

## Slice 7: The frame, home, and closing the guard

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/app-shell.md · Tests: unit, component

**User stories:** US 10, 11, 12, 13, 14, 15.

**Build:**

- Sweep the app frame (`GroupMenu`, `SectionNav`, `SyncIndicator`, `UserMenu`, its route); home and its parts; the new group page; the dev mail list.
- Close the kit: move `FilterMenu`, the gallery and the tests to a trigger look, remove `Menu`'s bare-string branch, delete `KIT_CLASSES_NOT_SWEPT` and its checks, and update the ui-kit and components docs.

**Acceptance criteria:**

- [ ] `KIT_CLASSES_NOT_SWEPT` no longer exists, and `scripts/eslint/rules.test.mjs` proves a formerly listed path now fails on a raw class.
- [ ] A `Menu` component test proves a look and an outer `className` combine on the trigger.
- [ ] The frame and home component tests pass.

**Blocked by:** 2, 3, 4, 5, 6. **Blocks:** none.
