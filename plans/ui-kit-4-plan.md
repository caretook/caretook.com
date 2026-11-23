# Plan: UI kit 4 (the kit's guard, and the care-record areas swept onto it)

> Source PRD: [`plans/ui-kit-4-prd.md`](ui-kit-4-prd.md). User-story numbers (US) refer to it. Backlog items B-269, B-398 (first four areas), B-448. Topic `ui-kit-4`. The follow-on topic `ui-kit-5` takes the remaining areas.

## Status

| Slice | Wave | State                    | Merge into `prd/ui-kit-4` (slice commits) |
| ----- | ---- | ------------------------ | ----------------------------------------- |
| 1     | 1    | merged, torn down (opus) | 6814c3dc (7acd4f33)                       |
| 2     | 2    | running (opus)           |                                           |
| 3     | 2    | running (opus)           |                                           |
| 4     | 2    | handed off (opus)        | not merged (9dd63d03, 8de6ee85)           |
| 5     | 3    | not started              |                                           |

**Landing mode:** run everything through (started by the dispatcher, 2026-11-22). Start every ready slice, land each green wave, clean up; questions and reports go through `pnpm prd ask`.

**Now:** wave 1 landed in `dev` as eef72fd8 (PR #89, Codex clean, quick check on the merged tip 61efde0e, no browser checks needed; report a95). Docs folded. Wave 2 started: synced (already up to date), B-398 and B-448 claimed, worktrees `ui-kit-4-2`, `-3`, `-4` made from 77b4ea24, one opus agent spawned per slice. Next: merge their hand-offs in plan order. `backlog doctor`'s two findings (B-548, B-549 inbox titles) aren't this topic's.

**Landing hold (2026-11-22):** the test-gates orchestrator, at the user's request, asked every PRD to hold `pnpm prd land` and any code push to `dev` until test-gates wave 5 lands; it will message this session (`prd-ui-kit-4`), and also check `pnpm log dev`. Slices, merges into this branch, checks, CI runs and the PR carry on. `pnpm backlog` commits are fine. After that landing, `land` needs a CI verdict for a `--tier` (see its landing notice). Wave 1 had already landed when the request arrived, and test-gates was told.

**Slice 4 hand-off (waits for 2 and 3, plan order):** slice check passed on 8de6ee85. Its six profile component test files (`profile`, `profileBands`, `conditions`, `conditionProviders`, `emergency`, `vitalAverages`) were not run: the wave's full check must cover them. To fold at landing, in `docs/domain/profiles.md`: line 19 `**Card and sheets:** ConditionsCard` becomes `**Section and sheets:** ConditionsSection`; line 24 `VitalAveragesCard` becomes `VitalAveragesSection`. Worth noting for slice 5: `ListRow`'s `to` can't carry `state`, `prefetch` or `preventScrollReset`, so condition rows use a raw `li` inside `List`.

**For wave 2 (from slice 1):** the guard's lists are in `scripts/eslint/kit-guard.mjs`. The print routes stay on the not-swept list because each holds an on-screen Print button: slices 2 and 4 sweep them. A listed path that no longer exists fails a test, so slice 4's renames must update their lines.

**Start conditions:** `ui-kit-3` is in `dev` (done). Never beside a running `fixes-ui` wave on the same screens (the hot files enforce it). Sync before each wave.

**Landing:** no migration, no dependency. Each wave lands something usable. Never `--suite` without asking.

**Backlog:** claim a slice's items when it starts. B-269 is done when slice 1 merges, B-448 when slice 4 merges, B-398 when slice 5 merges (the planner filed its remaining areas as `ui-kit-5`'s own item).

Fold into the area docs at landing: the guard and its lists in [components](../docs/domain/components.md) and [ui-kit](../docs/domain/ui-kit.md); the new section names in [profiles](../docs/domain/profiles.md). Those docs are at their budget: trim what you add.

## Architectural decisions

- **Behaviour stays.** Every URL, role check, label, order, loader, query, schema and print layout is unchanged. A slice that finds a real bug files it instead of fixing it.
- **The guard's two lists:** a permanent allowlist (`ui/`, marketing, the gallery and the printed sheets by exact path: the medication and profile print sheets with `PrintAllergies` and `PrintConditions`, the access-codes sheet, `EntryPrintView`; never `WeekPicker` or `PrintMenu`, which are on-screen controls) and a "not swept yet" list, one path per line, grouped by owning slice with a comment between groups so parallel deletions don't conflict. A sweep's last step deletes its group.
- **The kit's "Which to use" list decides** what becomes what, including what is not a `Button`.
- **Append-only shared files:** the `ui` and `ui/plain` indexes, `ui/styles.ts` and the gallery registry take new lines at the end only.
- **Light pages** keep importing from `ui/plain`.
- **Shared folders belong to one slice** (below); others only consume them.

## How to run this plan

- **Wave 1: slice 1.** It creates the lists every sweep edits.
- **Wave 2: slices 2, 3 and 4** together. Slice 2 owns the medication routes and `components/medications`, `components/schedule`. Slice 3 owns the provider and care period routes and `components/providers`, `components/contact`. Slice 4 owns the profile route and only consumes `components/contact`. A shared part keeps its props, since `ui-kit-5`'s areas and `quick-entry-2` import them.
- **Wave 3: slice 5.** It owns the Planner, to-do and search routes and `components/todos`, `components/visitPrep`, `components/repeat`.
- **Checks:** every slice runs `pnpm prd check --quick "slice hand-off"` and `pnpm test:components --changed prd/ui-kit-4`. Slices are stackless; the orchestrator runs `pnpm prd browser --changed` at each wave's gate. `roundtrip` and `marketing` read a few kit classes, so a swept control must keep rendering what they select.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section for the orchestrator to fold.

---

## Slice 1: The kit's guard

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md · Tests: unit

**Items:** B-269. **User stories:** 1, 2, 3, 4.

### What to build

A restricted import that keeps React Aria (`react-aria-components`, `react-aria`, `react-stately`, `@react-aria/*`, `@react-stately/*`; not `@internationalized/date`) inside `ui/`, and a local lint rule on the web app's non-test `.ts` and `.tsx` source. `btn` and any `btn-*`, `badge-*`, `card-*` or `alert-*` token is flagged in any string or template; a bare `card`, `badge` or `alert` only inside a `className` value or a string of several tokens. It has the permanent allowlist and a "not swept yet" list holding every path with hits today, so `pnpm lint` passes on arrival.

### Acceptance criteria

- [ ] Rule tests in the local plugin's test file cover: plain, modifier, template, conditional, constant, object-map and default-parameter hits; `role="alert"`, a data id `"card"` and a word like `discard` not flagged; an allowed path; a not-swept path.
- [ ] An `@internationalized/date` import outside `ui/` still passes.
- [ ] A React Aria import outside `ui/` fails lint; `ui/` itself passes.
- [ ] `pnpm lint` passes on the slice with no inline disables added.

**Blocked by:** none. **Blocks:** 2, 3, 4, 5.

---

## Slice 2: Medications on the kit

Stack: no · Reads: docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/medications.md · Tests: component

**Items:** B-398 (medications). **User stories:** 5, 10, 11, 12.

### What to build

Sweep the medication list, detail, form, passes and shared schedule parts onto the kit, including `PassCard` (its props unchanged) and the form's details expander (`Chevron`, `Collapse`), and the on-screen `WeekPicker` and `PrintMenu`. Printed sheets stay, except that `MedicationSheet`'s local empty line becomes an `EmptyState` with the same printed text. `TodayRow` and `PassLogItem` are in the timeline folder: leave them to `ui-kit-5`. Delete this area's group from the "not swept yet" list.

### Acceptance criteria

- [ ] The guard passes with this area off the list.
- [ ] The existing medication component tests pass, changed only where they read a class instead of a role or name.
- [ ] Component tests cover each moved expander's `aria-expanded` and toggle, where none does yet.

**Blocked by:** 1. **Blocks:** none.

---

## Slice 3: Providers and care periods on the kit

Stack: no · Reads: docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/providers.md, docs/domain/care-periods.md · Tests: component

**Items:** B-398 (providers, care periods). **User stories:** 6, 10, 11, 12.

### What to build

Sweep the provider directory, provider page, care period list and page, and the shared provider and contact parts onto the kit. Delete this area's lines from the list.

### Acceptance criteria

- [ ] The guard passes with this area off the list.
- [ ] The existing provider and care period component tests pass, changed only where they read a class instead of a role or name.
- [ ] Each sheet footer moved to `FormFooter` keeps its Cancel and submit names, covered by an existing or new component test.

**Blocked by:** 1. **Blocks:** none.

---

## Slice 4: The profile on the kit, and its parts renamed

Stack: no · Reads: docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/profiles.md · Tests: component

**Items:** B-398 (profile forms), B-448. **User stories:** 7, 8, 10, 11, 12.

### What to build

First rename the profile's `*Card` parts and files to the `*Section` names in the PRD, as its own commit with no markup change. Then sweep the profile's forms, sheets and sections onto the kit, moving its local sheet buttons to `FormFooter`. Its print sheet stays. Delete this area's lines from the list.

### Acceptance criteria

- [ ] No `ProfileCards`, `DetailsCards`, `ConditionsCard`, `EmergencyCard` or `VitalAveragesCard` name remains in code or docs.
- [ ] The guard passes with this area off the list.
- [ ] `profile`, `profileBands`, `conditions`, `conditionProviders`, `emergency` and `vitalAverages` component tests pass, changed only for names or a class read.

**Blocked by:** 1. **Blocks:** none.

---

## Slice 5: The Planner, to-dos and search on the kit

Stack: no · Reads: docs/domain/ui-kit.md, docs/domain/components.md, docs/domain/todos.md, docs/domain/appointments.md, docs/domain/search.md · Tests: component

**Items:** B-398 (Planner, to-dos, search). **User stories:** 9, 10, 11, 12.

### What to build

Sweep the Planner, to-do list and page, search and their shared to-do, visit prep and repeat parts onto the kit, including `TodoRow`'s assignee chip. Delete this area's lines from the list, leaving only `ui-kit-5`'s areas.

### Acceptance criteria

- [ ] The guard passes with this area off the list.
- [ ] The existing Planner, to-do and search component tests pass, changed only where they read a class instead of a role or name.
- [ ] The to-do tick and its undo keep their names and focus, covered by an existing or new component test.

**Blocked by:** 1. **Blocks:** none.
