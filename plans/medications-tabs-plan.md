# Plan: Medications tabs

> Source PRD: [`plans/medications-tabs-prd.md`](medications-tabs-prd.md). User-story numbers (US) refer to it. Backlog item B-226 (the Medications page split into Schedule and Medications tabs). Topic `medications-tabs`.

## Status

| Slice | Wave | State                                                                                     | Merge into `prd/medications-tabs` (slice commits) |
| ----- | ---- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1     | 1    | merged (opus)                                                                             | 412e3bbe (a7cb2735)                               |
| 2     | 2    | merged (opus); synced with `dev` (72e65cc6: 3 test conflicts resolved, so the full check) | 3f8c4d1c (6a02c767)                               |

**Landing mode: run everything through** (queued with `pnpm prd queue`; land each green wave without asking, clean up, ask only real questions).

**timeline-ux-2 is in `dev`** (f1fc883e, f34eeeec) and in this branch, so slice 2 waits only for slice 1. B-226 claimed 2026-11-21.

**Slice 1 notes:** its `pnpm check` never passed in one run under load up to 35 (integration, tooling and `timelineSheetUrls` tests timed out; each passed alone); the landing check covers it. `TabNav`'s default claims the tab's path and below; `match` replaces it, so the list tab's `match` must claim `/list…` and `/medications/:medicationId`.

**Sync before landing:** quick-fixes wave 15 landed in `dev` (2152bbed, docs 51742670): `test/setup.ts` pins component tests to today 12:00 (`VITE_TEST_CLOCK`), `test/found.ts` adds `stopsMoving()`, about 30 component tests now poll (medications `today`, `medicationForm` among them). Also tasks-2 (B-222, 2db975a7): migration 0032_todos and sync-config changes (so `pnpm datastore:reset` after sync, and the **full** check), `LinkedTasks` → `LinkedTodos` (`components/todos/`), `appUrls.newTask` → `newTodo`, `GROUP_SECTIONS` now Timeline, Providers, Medications, Planner. Expect conflicts in slice 2's test edits at `pnpm prd sync`; resolving them in code means a full check.

**Overlap seen before slice 2 (2026-11-21):** tasks-2 replaces the Upcoming and Tasks `GROUP_SECTIONS` entries with Planner (next to, not on, the Medications entry; a merge may need both kept). quick-fixes adds `expect.poll` to lines in `today`, `medicationForm` and `allergies` browser tests; whichever lands second resolves at sync.

**Start conditions:** slice 1 can start at once. **Slice 2 waits for `timeline-ux-2` in `dev`** (its slice 1 rewrites the Medications header with `PageHeader`); `pnpm prd sync` before it. Not alongside `medications-4` (B-213: the Today schedule's mobile redesign), which changes the same page and comes after this PRD.

**Landing:** no migration, no dependencies, no browser check visits these screens. Land when both slices are merged; run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking.

**Backlog:** claim B-226 when slice 1 starts; `done B-226` after slice 2 merges.

Fold into the area docs at landing:

- **Slice 1:** `TabNav` in [components](../docs/domain/components.md) (the `ui/` list and a line on tabs: links with `aria-current`, the pending-navigation highlight, `match`).
- **Slice 2:** the Medications screens line in [medications](../docs/domain/medications.md) (the two tab routes, what each shows, sheets over either tab, the shared header, no plain `/medications`); the Medications section's link in [app-shell](../docs/domain/app-shell.md) if it names the path.

## Architectural decisions

- **`TabNav`** (`components/ui/`, exported from the index, nothing from feature folders): `{ label, tabs: [{ label, to, match? }], className? }`. A `nav` named by `label`, each tab a `Link` with `prefetch="render"`; the current one has `aria-current="page"`, taken from the pending navigation (`useNavigation().location`, back to the pathname if cancelled), as `SectionNav` and `TabBar` do. `match(pathname)` claims nested paths (a sheet over the tab); without it, the tab is current when the path starts with `to`'s path. Not an ARIA `tablist`: these tabs change the URL. Look: daisyUI `tabs tabs-box`, equal widths, full width below `sm`. Every later page with tabs uses it.
- **Routes:** `medications` is a layout route (header, `TabNav`, outlet). Children: `schedule` and `list`, each with its own `clientLoader` and live queries, and each with the sheets (`new`, `:medicationId/edit`, `allergies`) as children. Plain `/medications` has no index and no redirect. The static `schedule` and `list` segments rank above `medications/:medicationId`.
- **Tabs' content:** Schedule shows `TodaySection` and the `clientAction` for its doses. The list shows `AllergiesRegion`, search, the status and type chips and `MedicationList`, with `?q=`, `?status=`, `?type=` on its URL.
- **The header** (in the layout): the title, Add (writers; opens over the current tab) and `PrintMenu` (both sheets), plus Passes on Schedule only. Through `PageHeader` (from timeline-ux-2).
- **URLs** (`lib/medications/urls.ts`): `medicationSchedule(groupId)`, `medicationList(groupId, search?)`; the add, edit and allergies helpers take the tab underneath (`"schedule" | "list"`). The Medications `GROUP_SECTIONS` entry links to Schedule and still matches `/medications/*`. The timeline's `TodayMedicationsRow` links to Schedule; Back on passes and the weekly sheet to Schedule; on the list print and a medication's page to the list. A medication page's Edit opens over the list.
- **Revalidation:** `onlyMedicationSheetChanged` covers sheets over either tab, so opening or closing one reloads nothing; a tab switch runs the new tab's loader.
- **Unchanged:** `dueDoses`, `medicationList` filtering, Today's behaviour, the medication page, passes, print. No schema, sync or server change.

## How to run this plan

- **Wave 1: slice 1** (`components/ui/TabNav.tsx`, the `ui/` index line, the primitives' browser tests). `timeline-ux-2` slice 1 also adds a line to the `ui/` index (`PageHeader`): merge both lines if they meet.
- **Wave 2: slice 2**, after `timeline-ux-2` is in `dev` and synced. It owns the medications routes, `routes.ts` for medications, `lib/medications/urls.ts`, `medicationSheets.ts`, the Medications `GROUP_SECTIONS` entry and the back links named above.
- **Stacks:** both stackless (component tests on the test device, unit tests).
- **Checks:** every slice runs `pnpm check` and `pnpm test:components --changed prd/medications-tabs`, and `pnpm prd browser --changed` once before hand-off, reporting what it named.
- **Running beside other PRDs:** `tasks-2` (running): check its open slices for `GROUP_SECTIONS` or `appUrls` edits before slice 2 (additive lines are fine). `quick-fixes` wave 15: B-211 touches profile and group settings, not these files.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: The `TabNav` primitive

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md · Tests: component

**User stories:** 3–8, 20.

### What to build

`TabNav` in `components/ui/` as the decisions above describe, exported from the index. No caller yet beyond its tests.

### Acceptance criteria

- [ ] A component test in the primitives' browser tests (`renderInRouter`, two or three tabs on routes): the current tab has `aria-current="page"` and the others none; a tap changes the URL and the marked tab; Back returns to the previous tab; the `nav` has its label; Tab reaches each link and Enter follows it; `match` keeps a tab current on a nested path.
- [ ] The highlight follows a pending navigation (a tab whose route's loader is held marks at once).
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** slice 2.

---

## Slice 2: The Medications page in two tabs

Stack: no · Reads: docs/domain/medications.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: unit, component

**User stories:** 1, 2, 9–19.

### What to build

Split the Medications route into the layout and the `schedule` and `list` tab routes, with the sheets under both. Move the header up into the layout (Passes on Schedule only). Add the URL helpers and point every link at the new paths, as the decisions above list. Update `onlyMedicationSheetChanged` and both tabs' `shouldRevalidate`.

### Acceptance criteria

- [ ] Unit: `urls.test.ts` covers the schedule and list paths and the sheet helpers for each tab; `groupSections.test.ts` the Medications link (Schedule) and its match on both tabs, a sheet and a medication's page; the `medicationSheets` tests opening and closing each sheet over either tab as sheet-only changes.
- [ ] Component: the existing tests on `medicationWorld.tsx` (`today.browser.test.tsx`, `medicationList.browser.test.tsx` and the rest) pass on the new URLs.
- [ ] Component, new: Schedule shows Today and Passes, not the allergies, search, chips or list; the list tab shows those and not Today; the header (title, Add for writers, Print) is on both; a viewer sees neither Add nor dose buttons; the add sheet opens over each tab and closing returns to that tab with its search kept; the tabs switch with `aria-current` following.
- [ ] The timeline's Today medications row, and Back on the passes, weekly sheet, list print and medication pages, go where the decisions say (covered by their existing tests, updated).
- [ ] `pnpm check` passes.

**Blocked by:** slice 1; `timeline-ux-2` in `dev`. **Blocks:** none.
