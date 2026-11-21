# Plan: Timeline UX 2 (declutter)

> Source PRD: [`plans/timeline-ux-2-prd.md`](timeline-ux-2-prd.md). User-story numbers (US) refer to it. Backlog items B-214, B-218, B-223, B-215, B-216, B-217, B-219, B-224. Topic `timeline-ux-2`.

## Status

**Landing mode: run everything through** (queued with `pnpm prd queue`, 2026-11-21): start every ready slice, land each green wave, clean up; ask only real questions.

| Slice | Backlog             | Wave | Model  | State                   | Merge into `prd/timeline-ux-2` (slice commits) |
| ----- | ------------------- | ---- | ------ | ----------------------- | ---------------------------------------------- |
| 1     | B-214               | 1    | opus   | merged                  | 2f2635f0 (891c7be7)                            |
| 2     | B-214               | 2    | opus   | started (agent spawned) |                                                |
| 3     | B-218               | 1    | sonnet | merged                  | 5aa9e137 (1e05be90)                            |
| 4     | B-223               | 1    | sonnet | merged                  | 0b327447 (ce9cfeaa)                            |
| 5     | B-215, B-216, B-219 | 1    | opus   | merged                  | c8fbb4f7 (e09d8a3c)                            |
| 6     | B-217               | 2    | opus   | handed off (13093950)   |                                                |
| 7     | B-224               | 1    | opus   | merged                  | 95ac03f3 (d28a7b10)                            |

- 2026-11-21: wave 1 started; worktrees `.loops/timeline-ux-2-{1,3,4,5,7}` (stackless). B-214, B-215, B-216, B-218, B-219, B-223, B-224 claimed by `prd/timeline-ux-2`; B-217 claimed when slice 6 starts. No new backlog items for this topic at the wave boundary.
- Slice 7 also changed `scripts/browser-checks/fixtures.mjs` (`addToTimeline` takes `{ group }`) and `layout-offline.spec.mjs` (Temperature under Vitals): run `layout-offline` at landing.
- Slice 3's `pnpm check` failed in unrelated files under load and overlapping runs (`router.int`, `appointmentSeries.int` topUp, `loops/browser.test.mjs`): confirm alone when load < 16 before landing.
- providers-2 landed in dev (df4d0c05): `pnpm prd sync` at wave 1's boundary (new deps → `pnpm install`; touches `ui/ComboBox`, `ConfirmDialog`; no migration). Its lockfile change means a full check at landing.
- Slice 5 exports `SURFACE` from `ui/` (one index line); its diff needs the `ui` browser check at landing.
- Slice 1 edited `scripts/browser-checks/app-shell.spec.mjs` (the rename step reads the group menu's checked item); it passed on slice 1's stack. `docs/domain/profiles.md` mentions `RecipientCard`: fix at landing.
- Wave 1 merged (no conflicts); B-215, B-216, B-218, B-219, B-223, B-224 done (ready); B-214 waits for slice 2. Slice worktrees removed.
- `pnpm prd sync` 9fd694a8 (providers-2): resolved a code conflict in `providers/route.tsx` (PageHeader + dev's Import action); providers test 15/15. Lockfile changed → full `pnpm prd check` for wave 1's landing.
- Wave 2 started from 9fd694a8: `.loops/timeline-ux-2-{2,6}`; B-217 claimed. Wave 1 lands while wave 2 runs.
- Docs folded for wave 1 (eed9341f).
- Full check #1 on eed9341f failed 14 tests (`timelineSummaries`, `entryPrint`, `timelineCarePeriods`, `timelineSimple` period header): run at 00:20 America/Los_Angeles, the tests' zone, where `minutesAgo(40)` fixtures fall on yesterday. Clock-window failures, not this wave. Rerunning after 01:05 LA.
- connectors-2 landed in dev (017a9b29, migration 0031, no pending migration here): sync before the 01:05 rerun, then `pnpm datastore:reset`.
- tasks-2 (`tasks-2-20`) waits on wave 1 (PageHeader, the Upcoming and Tasks headers): message it at each landing.
- Wave 1 landing (user, 2026-11-21): `--force` on the full run whose only failures were the 14 midnight-window tests (B-227, quick-fixes). Synced connectors-2; typecheck, lint, format clean; browser `layout-offline` and `app-shell` pass (the user chose only the edited specs).
- **Wave 1 landed in dev as f1fc883e** (2026-11-21, `--force`, user's word). Told tasks-2 and quick-fixes to sync. Wave 2: slice 6 handed off, slice 2 running; merge 2 then 6.
- Open issues: B-227 (quick-fixes) for the midnight-window tests; until it lands, run full checks outside 00:00–02:30 LA.

## Backlog map

| Item  | What it asks for                                                                                         | Slices |
| ----- | -------------------------------------------------------------------------------------------------------- | ------ |
| B-214 | No recipient name in page headers (print only), no timeline profile corner, the eye by search and filter | 1, 2   |
| B-218 | The day summary's expand icon on the left                                                                | 3      |
| B-223 | The group menu: no care-period line, New care group under the groups, Group settings last                | 4      |
| B-215 | Due now and Usual around now in a dialog behind an icon on the quick-entry box                           | 5      |
| B-216 | The name suggestions float over the page instead of pushing it down                                      | 5      |
| B-219 | The help icon inside the box, and a better one (decided: the ? goes; the Sparkles icon sits inside)      | 5      |
| B-217 | An empty Today gets a prompt to add an entry                                                             | 6      |
| B-224 | Vitals in the + menu as one item that expands to its types                                               | 7      |

B-214 spans two slices: slice 1 claims it, and the orchestrator marks it `done` when slice 2 merges. Slice 5 claims B-215, B-216 and B-219 together and marks all three `done`.

## Architectural decisions

Durable decisions every slice follows:

- **UI only.** No schema, sync, API or migration changes; no new dependencies. Every slice is stackless.
- **`PageHeader`** is a `components/ui/` primitive (exported from the index): an `h1` title and an optional actions node, laid out like today's headers (title left, actions right, top-aligned, wrapping). Callers pass a title and a node, plus at most an outer `className`. It imports nothing from feature folders.
- **Section pages carry no subtitle.** No recipient or group name, and no viewer note, under a section's title. Printed sheets keep the name and details.
- **The simple view is unchanged**: its header and its toolbar (no View options).
- **Selectors the browser checks use stay**: the "View options" name, `data-filter-button` with `aria-haspopup="dialog"`, and the menu's item names. No browser check changes.
- **Quick entry:** nothing shows under an empty box. The suggestions live in one popover behind a Sparkles icon inside the box, and the name completions are an overlay that never moves the layout. The help ? and its examples are gone. Simple mode's box works the same way, still without pass chips. The `data-quick-suggestions`, `data-quick-row` and `data-quick-completions` hooks stay on the moved rows.
- **`ui/Menu` groups expand in place** (no flyout submenus). A group is a toggling item with `aria-expanded` that keeps the menu open, its items indented after it, closed again on each open.
- **Tests are component tests** in the touched screens' existing `*.browser.test.tsx` files ([components](../docs/domain/components.md#component-tests)), plus unit tests for `normalizeMenu`'s group rules. No e2e steps: no browser check selects the moved or changed controls.

## How to run this plan

- **Waves:** (1, 3, 4, 5, 7) → (2, 6). Slices 1, 3, 4, 5 and 7 touch disjoint files and run at once. Slice 2 builds on slice 1's `TimelineHeader` and `PageHeader`. Slice 6 builds on slice 5's `QuickEntryBox`. Slice 7 edits `ui/Menu` and `menuModel.ts` while slice 4's `GroupMenu` only uses them, and slice 1 adds `PageHeader` to the `ui/` index (merge both index lines if they meet).
- **Gates:** each slice's `pnpm check` green, then a quick check at each wave's merge (`pnpm prd check --quick`). Browser checks at landing only: `app-shell`, `layout-offline`, `phase2` (`pnpm prd browser --changed --base dev`).
- **Ownership:**
  - Slice 1: `PageHeader`, the Providers, Medications, Upcoming (`UpcomingHeader`) and Tasks headers, `TimelineHeader`'s heading, `RecipientCard` (deleted), the profile test's card check.
  - Slice 2: `FilterChips` (the toolbar row), `TimelineViewMenu`'s trigger, `TimelineHeader` (View options out), the timeline route's wiring.
  - Slice 3: `DaySummaryLine`.
  - Slice 4: `GroupMenu` (and `menuNowText` if it's left unused).
  - Slice 5: `components/quick-entry/` (`QuickEntryBox`, `QuickEntrySuggestions`, `QuickEntryHelp` deleted, `quickEntryCopy.ts`, new `QuickEntrySuggestButton` and `QuickEntryCompletions`), the quick-entry tests.
  - Slice 6: `TimelineEntryList` (the empty Today), the timeline route's wiring (`onAddEntry`), `QuickEntryBox`'s `fieldRef`.
  - Slice 7: `components/ui/menuModel.ts`, `Menu.tsx`, `QuickAddMenu`.
- **At landing:** update the [app-shell](../docs/domain/app-shell.md) doc's `GroupMenu` line; the [timeline](../docs/domain/timeline.md) doc's header, View options, day-summary, empty Today and + menu lines; the [components](../docs/domain/components.md) list of `ui/` primitives (`PageHeader`) and its `Menu` line (groups); and the [assistant](../docs/domain/assistant.md) doc's suggestions line (the popover, the floating completions, no ? or examples).

---

## Slice 1: Page headers without the recipient

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/domain/timeline.md · Tests: component

**User stories:** 1–9, 23.

### What to build

A `PageHeader` primitive in `components/ui/`, used by Providers, Medications, Upcoming and Tasks in place of their hand-built headers. Each keeps its title and its actions (Add buttons, the print menu, passes link and so on) and drops the subtitle: no recipient or group name, no "You can view this list / directory" note.

On the full timeline, `RecipientCard` is deleted. `TimelineHeader` renders `PageHeader` with "Timeline" as the title and View options as its actions (slice 2 moves the eye to the toolbar). Age and code status are no longer shown on the timeline. The profile test that pressed the card's link presses the group menu's "<Name>'s profile" item instead. The simple view's header is untouched.

### Acceptance criteria

- [ ] `PageHeader` renders its title as an `h1` and the actions node beside it (`components/ui/inScreens.browser.test.tsx`).
- [ ] Providers, Medications, Upcoming and Tasks: the `h1` is the page's name, the recipient's name is nowhere in the header, and a viewer sees no "You can view…" note (each page's existing browser test: `providers`, `medicationList`, `upcoming`, `tasks`).
- [ ] The full timeline's `h1` is "Timeline", there's no profile link or recipient card in `main`, and View options still opens (`timelineHeader.browser.test.tsx`).
- [ ] The group menu's profile item opens the profile (`profile.browser.test.tsx`, replacing the card check).
- [ ] The simple view's header still shows the recipient's name (`timelineSimple.browser.test.tsx`).
- [ ] Printed sheets still show the recipient's name (their existing tests pass unchanged).

**Blocked by:** none. **Blocks:** slice 2.

---

## Slice 2: One toolbar: search, Filter and View options

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md · Tests: component

**User stories:** 10–15.

### What to build

`FilterChips` takes an optional trailing node for the right end of its control row. The full timeline passes `TimelineViewMenu` there, and `TimelineHeader` loses its actions. The simple view passes nothing. The magnifier, Filter and the eye's trigger share one outlined, icon-only circle of one size. Filter becomes icon-only, with the count of active filters in a small badge on the circle. It's named "Filter", or "Filter, N on" when filters are on, and keeps `data-filter-button` and `aria-haspopup="dialog"`. With search open, the field fills the space between Filter and the eye, and the eye stays at the right end.

### Acceptance criteria

- [ ] View options is in the filter row, after Filter, and not in the page header (`timelineHeader.browser.test.tsx`).
- [ ] Filter is named "Filter" with nothing on and "Filter, 2 on" with a kind and an author filter, and opens the filter sheet (`timelineFilters.browser.test.tsx`).
- [ ] With search open, the field, Filter and View options are all present and usable (`timelineSearch.browser.test.tsx`).
- [ ] The simple view's toolbar has no View options (`timelineSimple.browser.test.tsx`).

**Blocked by:** slice 1. **Blocks:** none.

---

## Slice 3: The day summary's chevron on the left

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md · Tests: component

**User stories:** 16–18.

### What to build

In `DaySummaryLine`, the chevron comes before the summary text inside the same disclosure button. It points right when closed and turns down when open. The expanded lines get a left indent equal to the chevron and its gap, so they line up with the summary text. The accessible name, the modes and `summariesOff` don't change.

### Acceptance criteria

- [ ] The chevron is the button's first child, before the summary text, and `aria-expanded` and the lines still toggle on tap and on Enter (`timelineSummaries.browser.test.tsx`).

**Blocked by:** none. **Blocks:** none.

---

## Slice 4: The group menu's order

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md · Tests: component

**User stories:** 19–22.

### What to build

`GroupMenu`'s items, in order: the groups section (current checked, choosing one opens its timeline), "New care group" (with `NEW_GROUP_LINK_STATE`), a separator, "<Name>'s profile" (only with a recipient), "Care periods", "Group settings". The "Now: …" period item is removed. The trigger keeps the period's type icon and its label. If `GroupMenu` was `menuNowText`'s last caller, delete it and its tests.

### Acceptance criteria

- [ ] The menu's items come in the order above, during a period too, with no "Now: …" item (`groupMenuPeriod.browser.test.tsx`).
- [ ] During a period, the trigger still shows the period icon and is named "<Name>, <period>: switch care group" (`groupMenuPeriod.browser.test.tsx`).
- [ ] "New care group" opens the sheet and closing it comes back (`newGroup.browser.test.tsx` passes unchanged, or is updated for the item's new place).

**Blocked by:** none. **Blocks:** none.

---

## Slice 5: Quick entry's suggestions popover and floating completions

Stack: no · Reads: docs/domain/components.md, docs/domain/assistant.md, docs/domain/timeline.md · Tests: component

**User stories:** 24–34.

### What to build

The empty quick-entry box shows nothing under it. A Sparkles icon button sits inside the textarea's border at its right edge, top-aligned, and the textarea keeps room for it. It opens a `ui/Popover` with today's rows: Due now (when `passChips` is on), Usual around now, Your recent lines. A chip fills the box, or gives the pass with Undo as now, and closes the popover. The button is named "Suggestions", or "Suggestions, a pass is due" with a small dot when a due pass is offered. It shows only while the box is empty and some row has something. Simple mode's large box gets the same button and popover, still with no Due now row.

`QuickEntryHelp`, its ? and `QUICK_ENTRY_EXAMPLES` are deleted. The placeholder and `QUICK_ENTRY_RULES` (the screen-reader description) stay.

While typing, "Matching names" (`QuickEntryCompletions`) is an overlay just under the field, absolutely positioned over the cards and the timeline on the shared menu surface. The cards and everything below never move. It shows while the field has focus and there are matches. Escape hides it until the text changes, and picking a name completes the line with focus kept in the field. The `data-quick-*` hooks stay on the moved rows.

### Acceptance criteria

- [ ] An empty box has no chips under it. "Suggestions" opens a dialog with Usual around now and Your recent lines, and a chip fills the box and closes the dialog (`timelineQuickEntrySuggestions.browser.test.tsx`).
- [ ] There's no Suggestions button with nothing to suggest, or while the box has text, and no "How quick entry works" button (`timelineQuickEntrySuggestions.browser.test.tsx`).
- [ ] With names matching, the cards' list top doesn't move, Escape hides the names, and a name still completes the line (`timelineQuickEntrySuggestions.browser.test.tsx`).
- [ ] With a pass due, the button is named "Suggestions, a pass is due", Due now is the dialog's first row, and its chip gives the pass with Undo and closes the dialog (`timelineQuickEntryPasses.browser.test.tsx`).
- [ ] Simple mode's large box has the Suggestions button and no Due now row (`timelineSimpleNow.browser.test.tsx`).

**Blocked by:** none. **Blocks:** slice 6.

---

## Slice 6: An empty Today's prompt

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md, docs/domain/assistant.md · Tests: component

**User stories:** 35–37.

### What to build

In `TimelineEntryList`, a writer in the full view with no kind, author, vital or search filter, and nothing logged today, sees under the Today heading a muted "Nothing logged today yet." and an "Add an entry" button (`data-empty-today`). The route passes `onAddEntry`, which scrolls the quick-entry field into view and focuses it (on a phone that brings the keyboard up), through a `fieldRef` that `QuickEntryBox` takes. It doesn't open the suggestions. With no entries at all in that case, the bottom "Nothing on the timeline yet." line is left out. Viewers, simple mode, and filtered or search empties are unchanged.

### Acceptance criteria

- [ ] A writer with nothing today sees "Nothing logged today yet." under Today, with older days still below, and "Add an entry" focuses the quick-entry field (`timelineHeader.browser.test.tsx`).
- [ ] A viewer, simple mode and a kind filter show no empty-Today prompt (`timelineHeader.browser.test.tsx`).
- [ ] A writer's empty timeline shows the Today prompt and not "Nothing on the timeline yet." (`timelineHeader.browser.test.tsx`).

**Blocked by:** slice 5. **Blocks:** none.

---

## Slice 7: Vitals as an expandable group in the + menu

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md · Tests: unit, component

**User stories:** 38–40.

### What to build

`menuModel.ts` gains a `MenuGroup` entry (`{ type: "group", id, label, icon?, items }`). `normalizeMenu` drops an empty group, and separators treat a group as one entry. `Menu` renders a group as an item with a chevron, `aria-expanded` and `shouldCloseOnSelect={false}`. Pressing it, or Enter, toggles its items in after it, indented (`data-menu-group-item`), and those items act and close the menu as usual. Groups start closed every time the menu opens. No flyout submenus.

`QuickAddMenu`'s Vitals section becomes a group: "Vitals" with the vital kind's icon, its items the `VITAL_TYPES`, each opening its sheet with `?type=` and the day's `at` as now.

### Acceptance criteria

- [ ] `normalizeMenu` keeps a group with items, drops an empty one, and places separators around a group as around an item (`menuModel.test.ts`).
- [ ] A group toggles with a press and with Enter, keeps the menu open, sets `aria-expanded`, and starts closed when the menu reopens (`primitives.browser.test.tsx`).
- [ ] "Add to Today" has 5 items closed. Expanding Vitals shows the vital types, and Blood pressure opens the vital sheet for that type (`components/ui/inScreens.browser.test.tsx`, its count updated from 14).

**Blocked by:** none. **Blocks:** none.
