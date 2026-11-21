# Plan: Timeline UX 2 (declutter)

> Source PRD: [`plans/timeline-ux-2-prd.md`](timeline-ux-2-prd.md). User-story numbers (US) refer to it. Backlog items B-214, B-218, B-223. Topic `timeline-ux-2`.

## Status

| Slice | Backlog | Wave | State   | Merge into `prd/timeline-ux-2` (slice commits) |
| ----- | ------- | ---- | ------- | ---------------------------------------------- |
| 1     | B-214   | 1    | planned |                                                |
| 2     | B-214   | 2    | planned |                                                |
| 3     | B-218   | 1    | planned |                                                |
| 4     | B-223   | 1    | planned |                                                |

## Backlog map

| Item  | What it asks for                                                                                         | Slices |
| ----- | -------------------------------------------------------------------------------------------------------- | ------ |
| B-214 | No recipient name in page headers (print only), no timeline profile corner, the eye by search and filter | 1, 2   |
| B-218 | The day summary's expand icon on the left                                                                | 3      |
| B-223 | The group menu: no care-period line, New care group under the groups, Group settings last                | 4      |

B-214 spans two slices: slice 1 claims it, and the orchestrator marks it `done` when slice 2 merges.

## Architectural decisions

Durable decisions every slice follows:

- **UI only.** No schema, sync, API or migration changes; no new dependencies. Every slice is stackless.
- **`PageHeader`** is a `components/ui/` primitive (exported from the index): an `h1` title and an optional actions node, laid out like today's headers (title left, actions right, top-aligned, wrapping). Callers pass a title and a node, plus at most an outer `className`. It imports nothing from feature folders.
- **Section pages carry no subtitle.** No recipient or group name, and no viewer note, under a section's title. Printed sheets keep the name and details.
- **The simple view is unchanged**: its header and its toolbar (no View options).
- **Selectors the browser checks use stay**: the "View options" name, `data-filter-button` with `aria-haspopup="dialog"`, and the menu's item names. No browser check changes.
- **Tests are component tests** in the touched screens' existing `*.browser.test.tsx` files ([components](../docs/domain/components.md#component-tests)). No unit tests (no new pure logic) and no e2e steps.

## How to run this plan

- **Waves:** (1, 3, 4) → 2. Slices 1, 3 and 4 touch disjoint files and run at once. Slice 2 builds on slice 1's `TimelineHeader` and `PageHeader`.
- **Gates:** each slice's `pnpm check` green, then a quick check at each wave's merge (`pnpm prd check --quick`). Browser checks at landing only: `app-shell`, `layout-offline`, `phase2` (`pnpm prd browser --changed --base dev`).
- **Ownership:**
  - Slice 1: `PageHeader`, the Providers, Medications, Upcoming (`UpcomingHeader`) and Tasks headers, `TimelineHeader`'s heading, `RecipientCard` (deleted), the profile test's card check.
  - Slice 2: `FilterChips` (the toolbar row), `TimelineViewMenu`'s trigger, `TimelineHeader` (View options out), the timeline route's wiring.
  - Slice 3: `DaySummaryLine`.
  - Slice 4: `GroupMenu` (and `menuNowText` if it's left unused).
- **At landing:** update the [app-shell](../docs/domain/app-shell.md) doc's `GroupMenu` line, the [timeline](../docs/domain/timeline.md) doc's header, View options and day-summary lines, and add `PageHeader` to the [components](../docs/domain/components.md) list of `ui/` primitives.

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
