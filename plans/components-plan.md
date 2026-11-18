# Plan: Components

> Source PRD: [`plans/components-prd.md`](components-prd.md). User-story numbers (US) refer to it. Backlog item B-24. Topic `components`.

## Status

| Slice | State                                             | Merge into `prd/components` (slice commits) |
| ----- | ------------------------------------------------- | ------------------------------------------- |
| 1     | blocked: `routing` must fully land in `dev` first |                                             |
| 2     | blocked by 1                                      |                                             |
| 3     | blocked by 2                                      |                                             |
| 4     | blocked by 2                                      |                                             |
| 5     | blocked by 3                                      |                                             |
| 6     | blocked by 3, 4 and 5                             |                                             |

Backlog: B-24 is `triaged`. Claim it when slice 1 starts; mark it `done` after slice 6 merges.

## Architectural decisions

Durable decisions every slice follows:

- **Folders:**
  - `components/ui/`: primitives (menu, sheet, popover, confirm dialog, avatar and avatar stack, chip and chip group, field, icon button). They import nothing from feature folders.
  - `components/entry/`, `components/timeline/`, `components/shell/`, `components/settings/`, `components/forms/`: shared feature components.
  - Anything only one route uses lives in that route's folder (from `routing`).
  - Each folder has one index file that exports its public components; nothing imports another feature's internals.
- **Primitive interfaces:** callers pass items, labels and callbacks, never React Aria render props or class strings (an optional `className` on the outer element only). Primitives own ARIA naming, the `pointerdown`-safe press handling, single-selection sections (`menuitemradio`), focus on open and return on close, and the z-index layers (sheets and modals `z-50`, tab bar `z-40`, sticky headers `z-10`). Styling uses daisyUI classes and tokens only.
- **Hooks own state; components own markup.** Hooks return data and callbacks, never JSX. Live data comes through hooks over `useLiveQuery`; components don't call `getSync()`.
- **Pure logic** found in components moves into plain modules beside its feature, with `web:unit` tests.
- **Size guideline** (written into AGENTS.md by slice 6, not enforced by lint): a route module about 100 lines, a component about 150.
- **What must not change:** accessible names, roles, `aria-current`, live regions, the stretched open target on rows and cards, URLs, and every browser check's behavior. A visual difference is allowed only where it makes one primitive consistent, and each one is listed in the hand-off with before and after screenshots.
- **No new dependencies; no schema, sync, API or seed change.** The editor's chunk stays lazy and loads only on the entry route.
- **Hot files:** nearly every file under `components/` and the route folders. This PRD runs alone among UI PRDs.

## How to run this plan

- **Don't start until `routing` has fully landed in `dev`.** It moves the files this plan splits.
- **Slice 1 runs alone** (it creates the folders and the menu primitive everything else follows). **2 after 1.**
- Then **3 and 4 run in parallel** (the timeline vs. the entry page). **5 after 3** (the timeline hosts the form's sheet route). **6 last.**
- Merge in number order. After each merge, run `ui.mjs` plus the checks for the areas the merge touched (AGENTS.md, _Browser check budget_); this PRD touches many areas, so expect most of them. The full suite (`app-shell`, `phase2`, `roundtrip`, `live-notes`, `routing`, `first-sync`, `sign-in`, `signout-wipe` and `layout-offline`, the last two with a timeout) runs once per landing.
- Every slice ends with `pnpm check`, `pnpm build:native`, its browser checks, a bundle-size comparison of the timeline and entry routes against its base (no growth beyond noise), and a hand-off (AGENTS.md, _Loop rules_).
- **Land after each wave** (1; 2; 3 and 4; 5; 6), so other PRDs can sync in between and their conflicts stay small.

```
1 ── 2 ──┬── 3 ── 5 ──┐
         └── 4 ───────┴── 6
```

---

## Slice 1: The menu primitive, feature folders and one entry menu

**User stories:** US 1, 3, 4, 9, 19, 20. **Blocked by:** `routing` landed in `dev`. **Blocks:** 2.

### What to build

Create the feature folders with their index files, and move today's shared components into them (no behavior change). Build the menu primitive (a trigger, items, links, sections, separators, a non-interactive header, single-selection sections) and move every menu onto it: the user menu (with its theme radio section), the group menu (with its group radio list), the vital type menu, and the entry actions. Merge the entry page's `EntryMenu` into the timeline's `EntryActions`, so rows, cards and the entry page share one entry actions menu with the same items in the same order. Start `ui.mjs`.

### Acceptance criteria

- [ ] Every menu opens by tap and by keyboard (Enter, arrows, Escape), returns focus to its trigger, and keeps its accessible name; the theme and group items are `menuitemradio` with the current one checked.
- [ ] One entry actions menu remains; the entry page and the timeline show the same items in the same order for the same kind and role.
- [ ] No feature file imports `react-aria-components` for a menu.
- [ ] Shared components are in their feature folders and imported through each folder's index file.
- [ ] Unit tests for any pure logic in the primitive (such as normalizing items and sections).
- [ ] `ui.mjs` covers every menu at 420 and 1280, in light and dark, with screenshots; `app-shell.mjs`, `phase2.mjs` and `live-notes.mjs` pass.

---

## Slice 2: Sheets, popovers, dialogs, avatars, chips and fields

**User stories:** US 2, 3, 6, 7, 10–13. **Blocked by:** 1. **Blocks:** 3, 4.

### What to build

The remaining primitives, each with its current users moved onto it:

- **Sheet:** a bottom sheet on phones, a modal on wide screens, with a title, focus trap, Escape and focus return. Used by the add and edit sheets.
- **Popover:** used by the time chip.
- **Confirm dialog:** the existing one, moved into `ui/` on the same interface.
- **Avatar and avatar stack** (up to N, then "+N"): used by the user menu and editor avatars.
- **Chip and chip group:** used by the timeline filters and the event title suggestions.
- **Field** (label, help, error, wired to the input's description): used by the add and edit form's existing fields, and by the entry title.
- **Icon button:** an accessible name is required.

### Acceptance criteria

- [ ] Every sheet, popover and dialog traps focus, closes on Escape, and returns focus to what opened it; sheets stay bottom sheets at 420 and clear of the tab bar.
- [ ] Editor avatars and the user menu's avatar render through the avatar primitives with the same initials and names as before.
- [ ] Filter chips and title chips share the chip group; filter chips keep their links and `aria-current`/pressed state, and title chips still name an event in one tap.
- [ ] Form errors show through the field primitive and are announced as before (`roundtrip.mjs` validation steps pass).
- [ ] No feature file imports `react-aria-components` directly except through `ui/`.
- [ ] `ui.mjs` covers every sheet, popover, dialog and chip group at 420 and 1280, in light and dark; every browser check passes.

---

## Slice 3: The timeline, split

**User stories:** US 5, 14, 15, 17, 22. **Blocked by:** 2. **Blocks:** 5, 6.

### What to build

The timeline route becomes a short composition: a header (title, view toggle), latest vitals, the Live now banner, quick add, filters, and an entry list grouped by day, with infinite scroll. Its data (the group's entries with paging, members, readings, previews and live documents) comes from one timeline data hook, and the view setting from its own hook. Rows and cards share one entry body; each keeps only its frame. Day grouping, open-target rules and labels move into pure modules with tests.

### Acceptance criteria

- [ ] The timeline route module is about 100 lines and contains no live queries, `useState` for data, or markup beyond composition.
- [ ] Rows and cards render the same body for the same entry (title, text preview, vitals readings, author, time, live dot).
- [ ] Infinite scroll, filters, the Live now banner, the live dot and the sheet routes behave as before.
- [ ] Unit tests for day grouping, the open-target rule (kind × role) and the entry labels.
- [ ] `phase2.mjs`, `roundtrip.mjs`, `routing.mjs` and `live-notes.mjs` pass; the timeline route's bundle doesn't grow.

---

## Slice 4: The entry page, split

**User stories:** US 16, 17. **Blocked by:** 2. **Blocks:** 6.

### What to build

The entry page's draft and saving logic moves into one live-entry hook with a small interface: the current entry (live or draft), `canWrite`, `deleted`, `ensureSaved`, `commitTitle`, `changeTime`, `remove` and `saveError`. The page becomes a composition: the back link, the header (title, time, editors, actions), notices, and the editor. `LiveNotesEditor` gets a focus handle, and title chips use it instead of querying the DOM. Pure pieces (heading, title field state, whether to show chips) move into modules with tests.

### Acceptance criteria

- [ ] The entry route module is about 100 lines; the hook returns no JSX.
- [ ] Drafts still save on the first real change, replace the URL, and keep the editor mounted; a time picked on a draft is the saved time.
- [ ] Choosing a title chip focuses the editor through its handle (no `querySelector` for `contenteditable`).
- [ ] Unit tests for the heading, the title field state and the chip rule.
- [ ] `live-notes.mjs` passes in full (tap counts unchanged: Note 1, Event 1, named event 2, Join 1); the editor's chunk still loads only on this route.

---

## Slice 5: The entry form, split

**User stories:** US 11, 18. **Blocked by:** 3. **Blocks:** 6.

### What to build

`EntryForm` becomes a form shell (when, submit, cancel, errors) plus per-kind field components (symptom fields, vital fields). `VitalReadingsFields` becomes one reading-row component per vital type spec on the field primitive, driven by the vitals spec as today. Adding a vital type stays a spec-only change. Form parsing and validation helpers stay pure and gain tests where they're missing.

### Acceptance criteria

- [ ] No form file is over about 150 lines; the symptom and vital fields are separate components.
- [ ] Adding a vital type still needs only the spec entries (show it with a throwaway type in the hand-off, not committed).
- [ ] Unusual-value warnings, hard-limit errors and unit conversion behave as before.
- [ ] `roundtrip.mjs` passes in full (add, edit, validation, offline, viewer); `ui.mjs`'s sheet steps pass.

---

## Slice 6: Settings and the header on the primitives, and the written rules

**User stories:** US 19–21, 23, 24. **Blocked by:** 3, 4, 5. **Blocks:** none.

### What to build

Move what's left onto the primitives: the account and group settings pages and their lists (from `routing`), the sync indicator, section nav, tab bar, any `providers` screens built before the primitives landed (its slices 2–4), and anything else still wiring RAC or repeating daisyUI class strings by hand. Write the component rules into AGENTS.md (the folders, the primitive rules, hooks vs. components, the size guideline, when a component moves to a shared folder) and update its layout section. Remove anything left unused.

### Acceptance criteria

- [ ] No file outside `ui/` imports `react-aria-components`.
- [ ] Settings forms use the field primitive; their saves behave as before (`layout-offline.mjs` passes).
- [ ] AGENTS.md describes the folders and rules, and its layout section matches the tree (an orchestrator edit, at landing).
- [ ] No unused component or export remains (lint and typecheck clean).
- [ ] Every browser check passes; `ui.mjs` covers settings at 420 and 1280.

---

## For the orchestrator

- **Claim:** B-24 when slice 1 starts. Mark it `done` after slice 6 merges.
- **Land after each wave**, and tell other running PRDs when slices 1 and 2 land: new UI uses `ui/` primitives and the feature folders.
- **Visual differences** are allowed only for consistency; review each hand-off's before and after screenshots before merging.
- **`timeline-polish` is paused for this PRD.** Its wave 1 is in `dev` (the `timelineFilters` module and kind icon links, the day headers, the one-line vitals), and slice 3 here must keep all of it as it is (`phase2.mjs` covers it). Slices 4–7 of `timeline-polish` (author filter, full width, author tooltip, infinite scroll) are replanned once this PRD has fully landed: tell the user then, so they can start that replan.
