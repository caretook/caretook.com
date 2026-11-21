# Plan: List filters under one Filter dropdown

> Source PRD: [`plans/list-filters-prd.md`](list-filters-prd.md). User-story numbers (US) refer to it. Backlog item B-249 (collapse list filters under a shared Filter dropdown: medications list, providers directory, todos, Planner). Topic `list-filters`.

## Status

| Slice | Wave | State                                   | Merge into `prd/list-filters` (slice commits) |
| ----- | ---- | --------------------------------------- | --------------------------------------------- |
| 1     | 1    | merged (opus)                           | 69676563 (61b69c42, 898efdcc)                 |     |
| 2     | 2    | started (sonnet, 2026-11-21)            |                                               |
| 3     | 2    | started (opus, 2026-11-21; takes B-255) |                                               |
| 4     | 3    | not started                             |                                               |

**Landing mode: run everything through** (queued with `pnpm prd queue list-filters`): start every ready slice, land each green wave through the Codex-reviewed PR, clean up; ask only real questions. B-249 claimed 2026-11-21.

**Wave 1:** slice 1 merged; synced with `dev` (quick-entry, B-220, c2ec744; conflict-free, no shared files). Landing wave 1 through its PR while wave 2 runs (slice 1's docs folded into components and medications; `check --quick` passed on 80d0b207; `browser --changed --base dev`: `ui` passed; PR opened, Codex review running; no Status commits until it lands); wave 2 merges wait until wave 1 has landed. Docs to fold for slice 1: see its _Fold_ line plus the `Menu` changes (`menuLabel` now names the menu; the trigger takes `title` and `data-*`).

**Open:** B-247 isn't scheduled: the quick-fixes orchestrator says the user held it (and B-246) back for a later wave; it will message us if it's scheduled and when it lands. A background check watches `dev` too. Once slices 1–3 are merged, ask the user: wait for it, or land the three and file slice 4 as a `quick-fixes` item.

**Start conditions:** slices 1 to 3 can start at once (no dependency). **Slice 4 waits for B-247 in `dev`** (Planner: Past becomes an Upcoming | Past toggle, with the All / Events / Todos filter row; a `quick-fixes` item); `pnpm prd sync` before it.

**Landing:** no migration, no dependencies, stackless. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. If slices 1 to 3 are merged and B-247 still isn't in `dev`, ask the user: wait, or land the three and file slice 4 as a `quick-fixes` item. Never `--suite` without asking.

**Backlog:** claim B-249 when slice 1 starts; `done B-249` after the last slice merges.

Fold into the area docs at landing:

- **Slice 1:** `FilterMenu` and its model in [components](../docs/domain/components.md) (the `ui/` list; a line: every list's filters are `FilterMenu`, callers pass sections and search strings, a section on its default counts for nothing; the tool circle in `ui/styles`). The list tab's line in [medications](../docs/domain/medications.md) (search, the Filter menu, the list).
- **Slice 2:** the directory's filter line in [providers](../docs/domain/providers.md).
- **Slice 3:** the Todos tab's filter line in [todos](../docs/domain/todos.md).
- **Slice 4:** the Planner's filter row in [appointments](../docs/domain/appointments.md) or wherever B-247 put it.

## Architectural decisions

- **`FilterMenu`** (`components/ui/`, exported from the index, nothing from feature folders). Input: `label` ("Filter medications"), `sections`, `clear` (the search string with every section on its default), optional `chips` (extra removable chips, e.g. the Planner's author), optional outer `className`. A section: `{ id, title, options: [{ id, label, search }], current, defaultId, chipLabel? }` (`chipLabel` when the chip should read differently from the option).
- **Two parts, one state:** the button (with the dropdown) and the chips row are exported as parts of the one component (a screen puts the button at the end of its search row and the chips row beneath). Both read the same pure model, so neither holds state: the URL is the state.
- **The filter model** (`ui/`, pure, beside `menuModel`): sections in; out come the count of sections off their default, the active chips (`LinkChip`s: label, name "<label>: clear this filter", `to` the default option's search, a trailing ✕) and the `Menu` entries (a titled single-selection section per filter; then, when the count is above zero, `SEPARATOR` and "Clear filters").
- **Built on `Menu`:** selection sections (`menuitemradio`), `width="md"`, `placement="bottom end"`. A choice calls the router with the option's search, `replace: true` and `preventScrollReset: true`; so do Clear filters and the chips (`ChipGroup` links with `replace` and `preventScrollReset`, label "Filters on"). No new React Aria part.
- **The button:** `SlidersHorizontal`, the tool circle, the count badge as the timeline draws it (`badge-neutral badge-xs`, top right), named "Filter" or "Filter, N on" (`aria-label` and `title`), `data-filter-button`, `data-filter-count`.
- **The tool circle** (`TOOL_CIRCLE` and its `CIRCLE` part) moves from `timeline/TimelineFilters.tsx` to `ui/styles.ts`; the timeline's files import it. No other timeline change.
- **Screens pass data only.** Each keeps its pure URL helpers and its list logic; search text (`?q=`) is never counted, chipped or cleared. Empty-state wording is unchanged.
- **Unchanged:** every filter's parameter and meaning; the timeline's Filter sheet; schema, sync, server.

## How to run this plan

- **Wave 1: slice 1** (the primitive, its model, the circle's move, the medications list).
- **Wave 2: slices 2 and 3** together (providers; todos). They share no file: slice 2 owns `routes/app/groups/providers/` filter files, slice 3 `routes/app/groups/todos/`.
- **Wave 3: slice 4**, once B-247 is in `dev` and synced; it may join wave 2 if B-247 is already there. It owns the Planner's filter row.
- **Stacks:** all stackless (component tests on the test device, unit tests).
- **Checks:** every slice runs `pnpm check` and `pnpm test:components --changed prd/list-filters`, and `pnpm prd browser --changed` once before hand-off, reporting what it named. A browser spec that taps one of these screens' filter chips is updated in that screen's slice.
- **Running beside other PRDs:** `quick-fixes` (B-228 sweeps component tests for synchronous reads, the providers' among them; B-247 and B-246 change the Planner): expect test-file conflicts at sync, resolved by whichever lands second. `planner-2` (B-248, to write) changes the Planner's rows and filter: not alongside slice 4. `quick-entry` touches none of these files.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: `FilterMenu` and the medications list

Stack: no · Reads: docs/domain/components.md, docs/domain/medications.md · Tests: unit, component

**User stories:** 1–13, 21–26.

### What to build

The filter model and `FilterMenu` in `components/ui/` as the decisions describe, exported from the index. Move the tool circle to `ui/styles.ts` and point the timeline at it. On the medications list tab: one row with the search box (filling it) and the Filter button; under it the chips row; sections Status (All, Current, Completed, Discontinued; default All) and Type (All types and the four types; default All types), from `medicationList`'s helpers. Remove `StatusFilter` and `TypeFilter`'s chip rows.

### Acceptance criteria

- [ ] Unit tests for the model: the count; a chip per section off its default, clearing to that section's default search; no chip and no count for a section on its default; "Clear filters" only when the count is above zero; extra chips appended.
- [ ] A component test in the primitives' browser tests: the button is named "Filter", then "Filter, 2 on" with a badge of 2; Enter opens the menu, arrows move, Escape closes with focus back on the button; the current option of each section is checked; a choice changes the URL without a new history entry and closes the menu; a chip's ✕ clears only its section; Clear filters keeps other parameters (`?q=`); extra chips show.
- [ ] `medicationList.browser.test.tsx` (and any other test that tapped the status or type chips) filters through the menu: choosing Current and OTC narrows the list, shows both chips and the count; ✕ on one keeps the other; the search text survives Clear filters; the empty text still names the filters; no chip rows remain above the list.
- [ ] The timeline's filter row looks and tests as before (the circle only moved).
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** slices 2, 3, 4.

---

## Slice 2: The providers directory

Stack: no · Reads: docs/domain/components.md, docs/domain/providers.md · Tests: component

**User stories:** 14, 15, 22–25.

### What to build

On the providers directory: the search box and the Filter button in one row, the chips row beneath; one section, Type (All and each provider type, labels from `PROVIDER_TYPE_META`; default All). The options' and the chip's searches carry the box's live text (as `TypeFilter` does today), so a type picked right after typing keeps the search. Remove the type chip row. The import list's own chips are not part of this.

### Acceptance criteria

- [ ] `providers.browser.test.tsx` filters through the menu: choosing a type narrows the directory, shows its chip and "Filter, 1 on"; ✕ returns to All; a type chosen straight after typing keeps the typed text in the box and the list; the "practice's name finds its clinicians" case still passes through the menu.
- [ ] No type chip row above the directory; the empty text is unchanged.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1. **Blocks:** none.

---

## Slice 3: The Todos tab

Stack: no · Reads: docs/domain/components.md, docs/domain/todos.md · Tests: component

**User stories:** 16, 22–25; B-255 replaces 17–18.

### What to build

On the Todos tab: a row under the tabs with the Filter button at its right end, the chips row beneath; one section, "Assigned to" (Everyone, Mine, Unassigned, from `TODO_WHO` and `WHO_LABELS`; **default Everyone**). Remove `TodoChips`' row.

**B-255 (added at the wave 1 boundary):** the list with no `?who=` is Everyone, always: `defaultWho`'s "Mine when I have open todos, else Everyone" goes, so the whole list shows first and Mine or Unassigned narrow it. Everyone shows no count and no chip; Mine and Unassigned show "Mine ✕" / "Unassigned ✕" and "Filter, 1 on". This replaces US 17–18's Mine default. Anything else that leans on `defaultWho` (the Planner header's tab links, the todo strip, `?who=mine` links from elsewhere) keeps working: an explicit `?who=` still wins. The Planner header's tab links keep carrying `?who=` as they do.

### Acceptance criteria

- [ ] `todos.browser.test.tsx` (and `todoLinks` if it taps the chips) filters through the menu: with no `?who=` the list is everyone's todos (even when I have open todos of my own), with no count and no chip; choosing Mine narrows it to mine, shows "Mine ✕" and "Filter, 1 on"; its ✕ returns to Everyone; the choice survives a reload (`?who=`) and the add sheet opening and closing.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1. **Blocks:** none.

---

## Slice 4: The Planner

Stack: no · Reads: docs/domain/components.md, docs/domain/appointments.md, docs/domain/todos.md · Tests: component

**User stories:** 19, 20, 22–25.

### What to build

After B-247 is in `dev`: in the Planner's filter row, keep the Upcoming | Past control visible and replace the All / Events / Todos chips with the Filter button at the row's right end; one section, "Show" (All, Events, Todos; default All), from B-247's filter helpers. The author filter ("By Ann") is passed as an extra chip. On Past (events only) there are no sections: no button, only the author chip when it is on.

### Acceptance criteria

- [ ] The Planner's component tests filter through the menu: choosing Events or Todos narrows the list, shows its chip and "Filter, 1 on"; ✕ returns to All; the Upcoming | Past control still switches and keeps the author filter.
- [ ] With `?author=` on, "By <name>" shows as a chip with ✕ on both views and clears only the author; with it on and no kind chosen, the button reads "Filter" (the author chip is extra, not counted) unless B-247's row counts it otherwise, which the slice then follows and says in its hand-off.
- [ ] Past shows no Filter button.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1; B-247 in `dev`. **Blocks:** none.
