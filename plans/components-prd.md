# PRD: Components (UI primitives, thin routes, feature folders, no duplicates)

Status: 🟡 planned in [`components-plan.md`](components-plan.md) (6 slices). Backlog item: B-24. Topic `components`. Runs after `routing` lands.

## Problem Statement

The web app's UI is written as a few large files and a flat folder. The timeline and entry routes are about 350 lines each: data loading, live queries, local state, sheet and dialog control, and markup all in one component. `EntryForm` and `VitalReadingsFields` are 200+ lines each. Every React Aria menu, modal and popover wires itself up from scratch with its own daisyUI class strings (the user menu, group menu, entry ⋯ menus, vital type menu, time chip, entry sheet), so they drift apart in look and behavior, and a fix in one doesn't reach the others. Some pieces are written twice: the entry page's `EntryMenu` repeats part of the timeline's `EntryActions`, and rows and cards repeat their body. The components folder holds 29 files with no grouping, so it's hard to tell which are shared building blocks and which belong to one screen.

That makes changes slow and risky: each PRD edits the same big files (they're on every hot-file list), and new screens (Medications, Providers, Assistant) would copy the patterns again.

## Solution

Small, well-named components with simple interfaces, arranged by what they're for:

- **UI primitives** wrap each repeated daisyUI + React Aria pair once: a menu (button, items, sections, separators, radio sections), a sheet (bottom sheet on phones, modal on wide screens), a popover, a confirm dialog, an avatar and avatar stack, a chip and chip group, a field (label, help, error), and an icon button. Feature components use them instead of raw RAC and class strings.
- **Thin routes.** A route module loads data and composes. State and live data move into named hooks (the timeline's data, the entry draft and its saving, the sheet), and markup moves into components with one job each (the timeline header, the day list, the entry list, the entry page header and body).
- **Feature folders.** Shared components are grouped: `ui/` (primitives), `entry/` (anything about one timeline entry, used on more than one screen), `timeline/`, `shell/` (frame, menus, nav), `settings/`, `forms/`. Anything only one route uses lives in that route's folder (from `routing`).
- **No duplicates.** One entry actions menu, used by rows, cards and the entry page. One entry body for rows and cards. One list-of-entries component.
- **Written rules** in AGENTS.md: what a primitive is, when a component moves to a shared folder, how big a route or component should get, and that new UI uses the primitives.

Users see no change. Every screen should look and behave the same, except that menus, sheets and popovers become consistent with each other where they differ today.

## User Stories

1. As a user, I want every menu in the app to open, move by keyboard and close the same way, so that I learn it once.
2. As a user, I want every sheet and dialog to trap focus, close on Escape and return focus the same way, so that nothing feels broken in one place only.
3. As a screen reader user, I want every menu, sheet and popover named and announced consistently, so that I can find my way around.
4. As a user, I want the entry ⋯ menu on the entry page and on the timeline to have the same items in the same order, so that Delete is always where I expect it.
5. As a user, I want rows and cards to show an entry's content the same way, so that switching layouts doesn't change what I read.
6. As a user on a phone, I want sheets to stay bottom sheets and stay out of the tab bar's way, so that nothing moves during the refactor.
7. As a user in dark mode, I want every primitive themed by daisyUI tokens, so that no screen has a stray light-mode color.
8. As a user, I want the app no slower than today, so that the refactor costs me nothing (the editor chunk still loads only on its route).
9. As a developer, I want a menu primitive that takes items and sections, so that a new menu is a few lines and not a page of RAC wiring.
10. As a developer, I want a sheet primitive that handles open state, phone vs. wide layout and focus, so that a new form is just its fields.
11. As a developer, I want a field primitive with label, help and error, so that every form shows validation the same way.
12. As a developer, I want an avatar stack primitive, so that editor avatars and future member lists share one look.
13. As a developer, I want a chip group primitive, so that filter chips and title suggestion chips behave the same.
14. As a developer, I want the timeline route to read as a short composition, so that I can see its structure at a glance.
15. As a developer, I want the timeline's live data in one hook, so that infinite scroll, filters and search change one place.
16. As a developer, I want the entry page's draft and saving logic in one hook with a small interface, so that I can change saving without touching markup.
17. As a developer, I want pure logic out of components and unit-tested, so that rules like day grouping and title handling are checked without a browser.
18. As a developer, I want `EntryForm` split by kind (symptom fields, vital fields) around one form shell, so that adding a kind or vital type doesn't grow one file.
19. As a developer, I want shared components grouped by feature, so that I know where to look and where to put a new one.
20. As a developer, I want each folder to export its public components from one place, so that imports don't reach into another feature's internals.
21. As a developer of a later PRD, I want the primitives in place before I build Medications or Providers, so that new screens start consistent.
22. As an orchestrator, I want big shared files split into smaller ones, so that parallel PRDs conflict less.
23. As a developer, I want AGENTS.md to state the component rules, so that new code follows them without a review catching it.
24. As a developer, I want every browser check to pass unchanged after each wave, so that I know nothing a user does broke.

## Implementation Decisions

- **Waves, each landing on its own:**
  1. **Primitives.** Build `ui/` and move the existing users onto it: `UserMenu`, `GroupMenu`, `VitalTypeMenu`, `EntryActions`/`EntryMenu` (merged into one entry actions menu), `EntrySheet`, `EntryTimeChip`'s popover, `ConfirmDialog`, `UserAvatar`/`EditorAvatars`, filter and title chips. Feature folders are created here.
  2. **Timeline.** The timeline route becomes a composition of a header (title, view toggle), latest vitals, the live now banner, quick add, filters and an entry list grouped by day. Hooks: timeline data (group, entries with paging, members, readings, previews, live documents), and the view setting. One entry body shared by row and card; row and card keep only their frame.
  3. **Entry page.** Hooks: the live entry draft (draft fields, `ensureSaved`, `commitTitle`, `changeTime`, delete, save error) with a small return value; the page becomes header, notices and editor. The `LiveNotesEditor` gets a focus handle (an AGENTS.md follow-up), so title chips stop querying the DOM.
  4. **Forms, shell and settings.** `EntryForm` becomes a form shell plus per-kind field components; `VitalReadingsFields` is split per reading row on the field primitive. Shell and settings components move onto the primitives and the settings registry from `routing`.
- **Primitive interfaces** are small and stable: callers pass items, labels and callbacks, never RAC render props or class strings, except an optional `className` on the outer element. Primitives own ARIA names' plumbing, the `pointerdown`-safe press handling and z-index layers (sheet/modal `z-50`, tab bar `z-40`, sticky headers `z-10`). Menu supports `selectionMode="single"` sections (the theme and group lists need `menuitemradio`).
- **Hooks own state; components own markup.** Hooks don't return JSX. Live queries stay in hooks over `useLiveQuery`; components don't call `getSync()` directly.
- **Pure logic** that's inside components today (day grouping, the sheet title, the entry's open target, labels) moves into plain modules next to their feature and gets unit tests.
- **Where things live:** route-only pieces in the route's folder (from `routing`); shared ones in `components/<feature>/` with one index file per folder. Primitives never import from feature folders.
- **Size guideline** (in AGENTS.md, not enforced by lint): a route module about 100 lines, a component about 150; past that, split by job.
- **Behavior and markup stay the same** where checks and screen readers depend on them: accessible names, roles, `aria-current`, `aria-live` regions and the stretched open target. Visual differences are allowed only where they make one primitive consistent, and each one is listed in the slice's hand-off.
- **No new dependencies**, no schema, sync, API or seed changes. The editor's chunk stays lazy and route-only.
- **Hot files:** almost every file under `components/` and the route folders. It runs alone among UI PRDs (only one wave at a time, and no other PRD touching the timeline or entry page at once). Each wave lands before the next starts, so other PRDs can sync in between.
- **AGENTS.md** gets the rules and the folder map at the first landing (by the orchestrator), and the layout section is updated as each wave lands.

## Testing Decisions

- A good test checks what a user sees or a function returns, never a component's internals, hook call order or class names.
- **No component test framework** (no new dependency). The safety net is the browser checks: every existing check (`app-shell.mjs`, `phase2.mjs`, `roundtrip.mjs`, `live-notes.mjs`, `routing.mjs`, `first-sync.mjs`, `sign-in.mjs`, the offline and sign-out checks) passes unchanged after every merge. Selector changes are allowed only where a check depended on markup that no user sees, and are listed in the hand-off.
- **Unit (`web:unit`)** for every pure module pulled out of components: day grouping, sheet titles, open targets, label and initials helpers, any primitive's pure logic (such as how a menu's items and sections are normalized). Prior art: `liveNow.test.ts`, `titleSuggestions.test.ts`, `groupSections.test.ts`.
- **A primitives check** (`ui.mjs`): every menu, sheet, popover and dialog in the app opened by keyboard and by tap at 420 and 1280, checked for its name, role, focus on open, Escape, focus return and theme (light and dark). Screenshots of each for the hand-off.
- `pnpm build:native` and the bundle size of the timeline and entry routes are compared before and after each wave (no growth beyond noise).

## Out of Scope

- New features or visual redesigns (anything beyond making primitives consistent).
- A component test framework (Testing Library, jsdom), Storybook, or a design-token system beyond daisyUI.
- Routing changes (the `routing` PRD) and data-layer or sync refactors.
- Lint rules that enforce sizes or imports (could follow once the rules settle).
- `packages/*` refactors.

## Further Notes

- Source: the inbox line "Prefer well abstracted components over single-file components and refactor existing components to be more abstracted" (B-24).
- Interview decisions (2026-11-18): all four parts (split big routes, shared UI primitives, feature folders, dedupe); everything, in waves (primitives, timeline, entry page, then forms, shell and settings); browser checks plus pure unit tests, no new test dependencies; a separate PRD that runs after `routing`.
- Folds in two AGENTS.md follow-ups from live notes: merge `EntryMenu` into `EntryActions`, and give `LiveNotesEditor` a focus handle.
- If `providers` or `medications` start before wave 1 lands, they build on today's components and wave 4 moves them onto the primitives.
