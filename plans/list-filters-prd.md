# PRD: List filters under one Filter dropdown

**Done** (2026-11-21): the medications list, providers directory and Todos tab (with B-255, Everyone by default). The Planner part is B-284, with B-247, in planner-2. Decisions live in the components, medications, providers and todos docs.

Backlog: B-249 (collapse list filters under a shared Filter dropdown: medications list, providers directory, todos, Planner). Topic `list-filters`. It replaces the planned `medications-4`: B-213 (the Schedule's layout) was resolved by the tab split (B-226).

## Problem Statement

The medications list opens with a search box and two rows of always-visible chips (four statuses, five types) before the first medication. On a phone the chips wrap to three or four lines and push the list down. The providers directory, the Todos tab and the Planner each have their own chip row too. The timeline already hides its filters behind one round Filter button, so the app has two looks for the same job.

## Solution

One **Filter** button, the same round sliders icon as the timeline's, on every list. A tap opens a dropdown with a section per filter (one choice each, the current one checked) and "Clear filters". The button shows how many filters are on, and each filter that is on appears under the row as a chip with ✕, so a short list is never a mystery. The search boxes stay visible, with the Filter button at their right end.

```
[🔍 Search by name or reason      ] (⚙ 2)
                         ┌────────────────┐
 [Current ✕] [OTC ✕]     │ STATUS         │
                         │   All          │
 Metformin 500 mg        │ ✓ Current      │
 Lisinopril 10 mg        │   Completed    │
                         │   Discontinued │
                         │ TYPE           │
                         │   All types    │
                         │ ✓ OTC          │
                         │   …            │
                         │ Clear filters  │
                         └────────────────┘
```

The button, dropdown and chip row are one shared component, so the four screens only describe their filters.

## User Stories

1. As a caretaker on a phone, I want the medications list to start right under the search box, so that I see medications without scrolling past chips.
2. As a caretaker, I want one Filter button beside the search box, so that I know where every filter lives.
3. As a caretaker, I want the Filter button to look like the timeline's round controls, so that the app feels like one product.
4. As a caretaker, I want the dropdown to list Status and Type as sections with the current choice checked, so that I can see and change both in one place.
5. As a caretaker, I want a choice to apply at once and the dropdown to close, so that filtering is one tap after opening.
6. As a caretaker, I want the button to show the number of filters on, so that I know the list is filtered before I open anything.
7. As a caretaker, I want each filter that is on shown as a chip under the row, so that I can read what the list is limited to.
8. As a caretaker, I want to tap a chip's ✕ to remove only that filter, so that the others stay.
9. As a caretaker, I want "Clear filters" in the dropdown when any filter is on, so that I can reset in one tap.
10. As a caretaker, I want clearing the filters to keep my search text, so that I don't retype it.
11. As a caretaker, I want the search box to stay visible and full width, so that searching stays the first tool.
12. As a caretaker, I want my filters kept in the page's address, so that Back and a reload keep them, as today.
13. As a caretaker, I want a filter change to keep my scroll position and not add a Back step, as today.
14. As a caretaker, I want the providers directory's type filter (clinicians, practices, pharmacies and the rest) under the same Filter button, so that the directory starts with providers.
15. As a caretaker typing a provider search, I want a type picked right after typing to keep what I typed, as today.
16. As a caretaker, I want the Todos tab's Mine, Unassigned and Everyone under the same Filter button, so that the tab starts with todos.
17. As a caretaker, I want Todos to show no count and no chip while it's on its usual Mine, so that the default doesn't read as a filter.
18. As a caretaker, I want a chip (Unassigned ✕, Everyone ✕) when Todos isn't on Mine, so that I can see it and go back to Mine in one tap.
19. As a caretaker, I want the Planner's All, Events and Todos under the same Filter button, with the Upcoming | Past switch still visible, so that the Planner starts with what's coming.
20. As a caretaker who followed a "By Ann" link, I want that author filter to show as a chip with ✕ on the Planner, as today.
21. As a caretaker, I want the list's empty text ("No current medications match…") to keep naming the filters on, as today.
22. As a caretaker using a screen reader, I want the button named "Filter" or "Filter, 2 on", and each choice announced as checked or not, so that I can filter without seeing.
23. As a keyboard user, I want to open the dropdown, move with the arrow keys, choose with Enter and close with Escape, with focus back on the button.
24. As a viewer, I want the same filters as writers, since they change nothing.
25. As a caretaker offline, I want filtering to work, since it reads the device's copy.
26. As a developer, I want one filter component that takes data only, so that the next list gets the same button, count and chips for free.

## Implementation Decisions

- **`FilterMenu`, a `components/ui/` primitive** (exported from the index; imports nothing from feature folders). Callers pass an accessible label ("Filter medications"), a list of **sections** and optional extra chips. A section has an id, a title, its options (id, label, and the search string that option leads to), the current option and the default option. Callers pass no React Aria parts and no classes beyond an outer `className`.
- **What it draws:** the round button (the sliders icon, the timeline's circle shape and size, a count badge when filters are on, named "Filter" or "Filter, N on"); the dropdown, built on the existing `Menu` with one single-selection section per filter and, while any filter is on, a "Clear filters" item after a separator; and the chips row ("Filters on"), one removable chip per section that isn't on its default, then the extra chips. The button and the chips row are separate parts of the one component so a screen can place the button at the end of its search row and the chips beneath.
- **A pure filter model** beside it (like `menuModel`): from the sections it works out the count, the active chips (label, accessible name "…: clear this filter", the search that restores that section's default) and the menu's entries. A section on its default counts for nothing. Unit-tested.
- **Navigation:** a choice, a chip's ✕ and Clear all navigate to a search string with `replace` and `preventScrollReset`, as the chips do today. Each screen keeps its own pure URL helpers (`setStatus`, `clearType`, `setWho`…) and passes the resulting strings; the component never builds a URL. "Clear filters" goes to the search with every section on its default, which the model composes by asking the caller for one `clear` search string. Search text (`?q=`) is not a filter here: it is neither counted nor cleared.
- **The round tool circle** style moves from the timeline's filter file into `ui/styles`; the timeline imports it from there. The timeline's Filter button, its sheet, its magnifier and View options are otherwise unchanged.
- **Medications list:** the search box and the Filter button share one row (the box fills it); sections Status (All, Current, Completed, Discontinued; default All) and Type (All types, Prescription, OTC, Supplement, Other; default All types). The two chip rows go.
- **Providers directory:** the same row; one section, Type (All and each provider type; default All). Its option links keep carrying the box's live text, not the URL's `?q=`.
- **Todos tab:** no search box, so the Filter button sits at the right end of a row under the tabs; one section, "Assigned to" (Mine, Unassigned, Everyone; default Mine).
- **Planner:** after B-247 has reworked its filter row (the Upcoming | Past control; All, Events, Todos). The Filter button sits at the right end of that row; one section, "Show" (All, Events, Todos; default All). The author filter stays a removable chip, passed as an extra chip. The Past view has no sections, so it shows no button, only the author chip when on.
- **Unchanged:** every filter's meaning, URL parameter and list logic (`medicationList`, `providerDirectory`, `todoList`, `upcomingFilters`); the empty-state wording; the timeline. No schema, sync, server or dependency change; no migration.

## Testing Decisions

- Tests check what a person sees and does (the button's name and count, the checked choice, the list after a choice, the chips, the URL), not component internals.
- **The filter model:** unit tests, in the style of `menuModel.test.ts`: the count, which sections make chips, a chip's clear target, no Clear entry with nothing on, a section on its default.
- **`FilterMenu`:** a component test in the primitives' browser tests (`renderInRouter`, as `TabNav`'s): the button's name with and without filters, the badge, opening with the keyboard, the checked option, a choice changing the URL (replacing the entry) and closing the menu, a chip's ✕ clearing only its section, Clear filters keeping other parameters, extra chips shown.
- **Each screen:** its existing component tests move from tapping chips to opening the Filter menu (`medicationList.browser.test.tsx`, `providers.browser.test.tsx`, `todos.browser.test.tsx`, the Planner's), plus cases for the count, the chips row and the default showing no chip. Read after render with polling, per the component-test rules.
- No new end-to-end steps: the flow crosses no server or sync boundary. Browser checks that tap a filter chip on these screens are updated in the slice that changes the screen.

## Out of Scope

- The timeline: its Filter sheet stays a sheet, and its button and chips are not rebuilt on `FilterMenu` (only the circle's style is shared).
- Collapsing search boxes into a magnifier.
- Multi-select filters, new filters, sorting, or remembering filters between visits.
- The Medications Schedule tab (B-213 is closed: the tab split resolved it).
- The Planner's Upcoming | Past control and its All / Events / Todos filter themselves (B-247, in quick fixes).

## Further Notes

- The Planner slice waits for B-247 in `dev`. `planner-2` (B-248, removing reminders) changes the Planner too; whichever comes second syncs first.
- If the timeline later moves to a dropdown, `FilterMenu` is ready for it; that is its own item.
