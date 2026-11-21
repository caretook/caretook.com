# Plan: The UI kit (shared primitives, the pill tab bar, section bands)

> Source PRD: [`plans/ui-kit-prd.md`](ui-kit-prd.md). User-story numbers (US) refer to it. Backlog items B-257 to B-267, B-270, B-396, B-397. Topic `ui-kit`. The follow-on topic `ui-kit-2` (B-398 the area sweeps, B-268 the choice dialog, B-269 the guard) is to write.

## Status

| Slice | Wave | State | Merge into `prd/ui-kit` (slice commits) |
| ----- | ---- | ----- | --------------------------------------- |
| 1     | 1    |       |                                         |
| 2     | 2    |       |                                         |
| 3     | 2    |       |                                         |
| 4     | 2    |       |                                         |
| 5     | 3    |       |                                         |
| 6     | 3    |       |                                         |
| 7     | 4    |       |                                         |

**Start conditions:** none outstanding (`list-filters` and `planner-2` are in `dev`). Never beside `i18n` (it runs alone). `quick-fixes` and `simple-mode` may run beside it; sync between waves.

**Landing:** no migration, no dependencies, stackless. Each wave lands something usable, so land wave by wave. The landing mode is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking.

**Backlog:** claim a slice's items when it starts; `done` them when it merges (the slice headings name them).

Fold into the area docs at landing ([components](../docs/domain/components.md) unless named): each slice's _Docs_ section lists its primitives' lines for the `ui/` list and the contracts; slice 1 also fixes the `ui/` list in [layout](../docs/layout.md); slice 4 the heading scale and tokens; slices 6 and 7 the band rule and which pages are banded, with a line in [profiles](../docs/domain/profiles.md) (slice 7), [medications](../docs/domain/medications.md), [providers](../docs/domain/providers.md), [care-periods](../docs/domain/care-periods.md) and [todos](../docs/domain/todos.md) only where they describe the page's header or cards.

## Architectural decisions

- **Where:** every new primitive is in `components/ui/`, imports nothing from feature folders, and is exported from the `ui` index and, having no React Aria, from `ui/plain` too. Callers pass data, labels and callbacks and at most an outer `className`; a primitive holds no user-facing text of its own (labels and busy labels are props), so `i18n` finds every string in the callers.
- **Append-only shared files:** the `ui` index, `ui/plain`'s index, `ui/styles.ts` and the gallery registry take one line (or one block) per slice, **added at the end**; nobody reorders or reformats them. Conflicts there are resolved by keeping both.
- **Tests per primitive:** each new primitive has its own `*.browser.test.tsx` beside it (rendered with `renderInRouter`), not a new block in `primitives.browser.test.tsx`, so slices in one wave don't share a test file. `TabNav`'s existing tests stay where they are.
- **The gallery:** `/dev/ui`, in the dev routes part, web only, a server `loader` that 404s in production the way the dev mailbox's does. Its routes are their own part beside the mailbox's in the dev routes file (the components area: add its line to `check-areas.d/components`), and its gate is a small server module of its own with a unit test and a throwing stub in `apps/web/test/server/`. One file per section, listed in a registry (`{ id, title, Section }`), with a light and dark switch on the page. **Every slice adds a gallery section for each primitive it builds.**
- **Button:** variants `primary`, `default`, `ghost`, `danger`, `dangerQuiet`; sizes `md` (default), `sm`, `xs`; `block`; `icon`; `busy` with `busyLabel` (disabled, text swapped); with `to` it renders a router link that looks the same (and takes `replace`, `state`, `prefetch`). The class map is a pure function with a unit test. Solid `danger` only in a confirm dialog or a form whose one job is the destructive act.
- **Message tones:** `error` (`role="alert"`), `success`, `warning`, `info` (`role="status"`); the inline `Message` shows nothing when empty; `Notice` is the box (daisyUI soft alert, an icon, an optional action).
- **Badge:** one size, soft; tones `neutral`, `primary`, `success`, `warning`, `danger`, `info`. Status tones: current and now `primary`; past and stopped `neutral`; overdue `danger`; due soon `warning`; done `success`.
- **Surfaces:** unchanged (`base-200` page, `base-100` card, `base-300` border and divider). List dividers are `base-300`.
- **Heading scale** (constants in `ui/styles.ts`): page title `text-xl font-semibold`, section and card title `text-base font-semibold`, sub-heading `text-sm font-semibold`. `/app` only: marketing, print and `/admin` keep theirs.
- **Tokens:** `text-muted` (70% of `base-content` to start) and `text-faint` (the lowest step that clears 4.5:1, measured in slice 4; if nothing below muted passes on dark `base-100`, the two are one tone and the slice says so) as Tailwind utilities in `app.css`; `LINK` (the one inline link style) and `ICON_SM`, `ICON`, `ICON_LG` (`size-3.5`, `size-4`, `size-5`) in `ui/styles.ts`.
- **Contrast values are starting points.** The token steps and the pill's `bg-primary/15 text-primary` may be raised until they pass; the slice records what it chose. Measure with the contrast helper in the timeline search component test (move it to `apps/web/test/`), compositing translucent fills over their surface.
- **The light entry stays light:** a unit test (slice 1) walks `ui/plain`'s import graph and fails on any `react-aria*` import; every slice that adds to `ui/plain` keeps it green.
- **Page:** `Page` is the `main` (`mx-auto max-w-2xl space-y-4 px-4 py-5`; `width="wide"` is `max-w-4xl`); it passes `data-*` and `className` through. `Page bands` has no column; its children are `Section`s: full-width bands, each with an inner `max-w-2xl px-4` column, alternating `base-200` and `base-100` from the first, a `base-300` rule between, `py-6` per band and `space-y-2` inside; a `Section` with a `title` is a `section` named by its heading and takes `id` (`data-section`) and `actions`. **A page's part components become the `Section` themselves** (they already render their own named `section` and return nothing when empty or hidden by role), never a wrapper around them; alternation is by rendered position in CSS, so an absent part leaves no band and the rest still alternate.
- **Banded pages:** the profile, medication, provider, care period and to-do pages only. No cards inside a band. A part shared with an unbanded page (`LinkedTodos`, also on the entry page; `AllergiesRegion`, also on the medications list) takes a `band` opt-in and looks as today without it.
- **TabNav:** the contract in the components doc stays (a `nav` of links, first claimant current, pending navigation, prefetch on render). New per-tab fields: `icon`, `count`, `replace`, `current` (overrides the path match). Look: `rounded-full bg-base-100 shadow-sm` (a `base-300` border in dark), tabs `font-medium` without boxes, the current tab `bg-primary/15 text-primary` rounded-full, hover a quiet `base-200` fill, the count a small solid `primary` badge. `w-full` with equal tabs on phones, `sm:w-fit`; `overflow-x-auto` when the tabs don't fit.
- **Unchanged:** routes, URLs, loaders, permissions, schema, sync, server; print sheets; the timeline, entry page and quick entry (their files aren't edited; their headers already use `PageHeader`, so their titles take the new size); marketing and `/admin`.

## How to run this plan

- **Wave 1: slice 1** alone. It sets the gallery, its registry and the append-only pattern the others follow.
- **Wave 2: slices 2, 3 and 4** together. Slice 2 owns `TabNav` and sign-in's tab row; slice 3 owns the settings area's files (`components/settings/`, `routes/app/settings/`, `routes/app/groups/settings/`), the account forms' shared card and `components/shell/FirstSyncPending.tsx`; slice 4 owns `app.css`, `PageHeader` and the outer `main` and `h1` of the other `/app` pages it lists. Slice 4 doesn't touch the settings folders, the timeline or entry folders (`simple-mode` renames files there) or `FirstSyncPending`, and edits nothing inside a page but its container and title.
- **Wave 3: slices 5 and 6** together. Slice 5 owns the settings area again (cards, lists, switches, the settings frame's container and titles); slice 6 the medication, provider, care period and to-do page folders, `LinkedTodos` and `AllergiesRegion`.
- **Wave 4: slice 7**, the profile (its folder alone is about 3,300 lines, more than the other four pages together).
- **Stacks:** all stackless (component tests on the test device, unit tests).
- **Checks:** every slice runs `pnpm check` and `pnpm test:components --changed prd/ui-kit`, and `pnpm prd browser --changed` once before hand-off, reporting what it named. A browser spec that selects markup a slice changed is updated in that slice.
- **Tests select by role and name**, so most screen tests shouldn't change; where one selected a class or tag that moved, fix the selector, not the behaviour.
- **Beside other PRDs:** `quick-fixes` items that sweep component tests (B-180, B-228) may touch the same test files: whoever lands second resolves. `simple-mode` works in the timeline, which this plan leaves alone.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: The gallery, Button and the form footer

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/layout.md · Tests: unit, component

**Items:** B-270, B-257, B-258. **User stories:** 1–4, 33, 35–37.

### What to build

The `/dev/ui` gallery as the decisions describe, with sections for the primitives that exist today (Menu, FilterMenu, Sheet, Popover, ConfirmDialog, Field, ChoiceGroup, ChipGroup, ChipList, IconButton, BackLink, PageHeader, TabNav, UserAvatar, AvatarStack, ComboBox, Toast, ViaTag, Highlight; the date field and tooltip from their own entries), all with fictional data.

`Button` and `FormFooter` (Cancel as a link or a callback, then the submit Button; right-aligned, or start-aligned with a status slot), exported from both entries, each with a gallery section. Adopt them in: the kit's own files (ConfirmDialog, Toast, BackLink, ChoiceGroup, ChipList, the date field and any other `btn` string in `ui/` except `IconButton`, the chip style and the tool circle, which build on the class map where that is a straight swap); sign-in and the account forms (their buttons). The settings area's buttons are slice 3's. Add the `ui/plain` import-graph test.

### Acceptance criteria

- [ ] Unit test for the Button class map: every variant and size, `block`, and that `dangerQuiet` carries no solid fill.
- [ ] Component tests (`Button`'s own file): `busy` disables the button and shows `busyLabel`; with `to` it is a link with that `href`; a `type="submit"` Button submits its form once.
- [ ] Component tests (`FormFooter`'s own file): Cancel comes before the submit button in the DOM; Cancel as a link navigates, as a callback calls it; the status slot renders.
- [ ] Component tests for the gallery (rendered with `loaderData`, since its loader is the server gate): `/dev/ui` renders one named section per registry entry, and the theme switch sets the theme on the page.
- [ ] A unit test on the gate module: it refuses in production and allows in development (prior art: the notifications server test).
- [ ] A unit test walks `ui/plain`'s imports and fails on `react-aria*`.
- [ ] The sign-in and account component tests pass, edited only where a selector moved.
- [ ] No `btn` class string is left in sign-in, the account forms or `ui/` (outside the class map, `IconButton`, the chip style and the tool circle); the hand-off lists the count before and after.
- [ ] The gallery isn't in the native build's routes (the frozen route list test gains `/dev/ui` for web only).
- [ ] _Docs_: the Button and FormFooter lines, the gallery, the rewritten light-pages line (what `ui/plain` exports, and its test), and the corrected `ui/` list for `docs/layout.md`.

**Blocked by:** nothing. **Blocks:** 2, 3, 4, 5, 6 (the gallery registry and the Button).

---

## Slice 2: The pill tab bar

Stack: no · Reads: docs/domain/components.md, docs/domain/auth.md · Tests: component

**Item:** B-396. **User stories:** 16–21, 28.

### What to build

Restyle `TabNav` as the pill bar in the decisions and add the per-tab `icon`, `count`, `replace` and `current`. Export it from `ui/plain`. Sign-in's "Ways to sign in" row becomes a `TabNav` (two tabs told apart by `?with=`, so each passes `current` and `replace`). Medications and the Planner get the new look without a caller change. Update the gallery's TabNav section: plain, with icons, with a count, many tabs at phone width, both themes.

### Acceptance criteria

- [ ] `TabNav`'s existing component tests pass unchanged in behaviour (a named `nav` of links, `aria-current="page"` on the first claimant, taken from the pending navigation, prefetch).
- [ ] New component tests: a tab's icon is hidden from the accessible name and its count is part of it ("List, 12"); `current` overrides the path match; `replace` doesn't add a history step; at 420 px with eight tabs the bar scrolls sideways and the page doesn't; the current tab is scrolled into view.
- [ ] A component test reads the current pill's computed text and fill colours in light and dark and asserts a contrast of at least 4.5:1 (and 3:1 for the bar against the page), recording the numbers in _Docs_.
- [ ] Sign-in's component tests pass: both ways in are reachable by the tab row, the current one is announced, and switching keeps `redirectTo`.
- [ ] The medications tabs and Planner component tests pass.
- [ ] The `ui/plain` import-graph test (slice 1) passes with `TabNav` exported.
- [ ] _Docs_: the `TabNav` contract line (new fields, the look, overflow), replacing "`tabs-box`".

**Blocked by:** 1. **Blocks:** nothing.

---

## Slice 3: Messages, empty and loading states, Badge, and settings' buttons

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/domain/auth.md · Tests: unit, component

**Items:** B-259, B-262, B-265. **User stories:** 5–7, 10–12, 32.

### What to build

`Message`, `Notice`, `EmptyState`, `Skeleton` with `Loading`, and `Badge` (its tone map pure), exported from both entries, each with a gallery section showing every tone in both themes. Adopt them, with slice 1's `Button` and `FormFooter`, in the settings area (13 files): every `btn` string and hand-written busy label, `SaveRow` rebuilt on `FormFooter` and `Message` (keeping its props), every `role="alert"` and `role="status"` line and every alert box (`SettingsPage`'s offline notice among them), every "No … yet." line and every badge, mapped to the tones table. Secondary text inside the new primitives stays `text-base-content/70` for now (slice 5 swaps the kit to the tokens). The account forms' shared card's `ErrorMessage` and `StatusMessage` become thin callers of `Message` and `Notice`. `Loading` replaces the Google calendar card's "Loading…" text and the first-sync screen's spinner label.

### Acceptance criteria

- [ ] Unit test for the Badge tone map.
- [ ] Component tests (one file per primitive): `Message` error is `role="alert"`, the others `role="status"`; an empty `Message` stays mounted and takes no space; `Notice` shows its icon and action; `EmptyState`'s action is a link or a button as given; `Loading` is a status named by its label; `Skeleton` is hidden from assistive tech.
- [ ] The settings, sign-in, account, calendar settings and first-sync component tests pass, edited only where a selector moved; an error and a "Saved." in a settings form are still announced with the same roles.
- [ ] No hand-written `btn`, `role="alert"`, `role="status"`, `alert` or `badge` class is left in the settings area or the account card; the hand-off lists the counts.
- [ ] _Docs_: the five primitives' lines and the status tones table.

**Blocked by:** 1. **Blocks:** 5 (the settings files), 6 and 7 (Badge, Message).

---

## Slice 4: Tokens, the page container and the heading scale

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md · Tests: component

**Items:** B-267, B-263. **User stories:** 14, 15, 22, 23, 38.

### What to build

The `text-muted` and `text-faint` utilities, `LINK` and the icon sizes, and the heading-scale constants. `Page` (the plain and wide forms; the banded form is slice 6's), with a gallery section for it, the scale and the tokens. `PageHeader` takes the page-title size.

Then the mechanical pass over `/app` outside the settings, timeline and entry folders: each page's hand-written `main` becomes `Page` (keeping its `data-*` hooks and print classes), and the hand-written section `h1`s become `PageHeader`: the periods list, the passes tab, search, home and the profile's no-recipient state. The detail pages' `h1`s stay for slices 6 and 7. Left as they are: the timeline and entry folders (the `ui-kit-2` sweep), the print sheets' `h1`s and containers, the `/app` error screen, the first-sync screen. Pages whose width differs for a reason (the Planner's wide layout) keep it through `width`; list each in the hand-off. Inside pages, change nothing else. `PageHeader`'s new size also reaches the timeline, entry and Planner headers, which already use it: check them by eye in the hand-off.

### Acceptance criteria

- [ ] The steps are chosen by measuring (raise them until they pass): a component test asserts `text-muted` and `text-faint` on `base-200` and on `base-100` are at least 4.5:1 in both themes; the numbers go in _Docs_.
- [ ] Component tests (`Page`'s own file): it is the page's one `main`, passes `data-*` through, and `width="wide"` is wider than the default at 1280 px.
- [ ] A component test per section (providers, medications, Planner, periods, search) asserts the page has exactly one `h1` with the section's name.
- [ ] Every `/app` component test passes, edited only where a selector moved; print tests (the medication and emergency sheets) pass unchanged.
- [ ] No hand-written `<main className="mx-auto …">` is left under `routes/app/` outside the settings, timeline and entry folders and the listed exceptions.
- [ ] _Docs_: the heading scale, the tokens and their contrast, `Page`, and "every section page uses `PageHeader`".

**Blocked by:** 1. **Blocks:** 5 (the scale, the tokens), 6 and 7 (`Page`, the scale).

---

## Slice 5: Card, lists, and check and toggle fields

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/domain/care-groups.md · Tests: component

**Items:** B-260, B-261, B-266. **User stories:** 8, 9, 13, 32, 34.

### What to build

`Card` (title at the section-title size, actions, one body gap; a named `section` with `data-section` when titled), `List` with `ListRow` (a plain row, a link row, a trailing slot), `CheckField` and `ToggleField`, exported from both entries, each with a gallery section. `Field` takes the control's kind and passes the classes and the error style to its control; a caller's own `className` still wins.

Adopt them in the settings area: `SettingsCard` becomes a wrapper over `Card`; the members, invites, requests, devices and assistants lists use `List`; every checkbox and switch (the invite attestation, the owners' details switch, calendar and reminder switches, simple mode's) uses the new fields; settings `Field` callers drop `input w-full` and their hand-written error class. The settings frame moves onto the page frame: `SettingsFrame`'s `main` becomes `Page width="wide"`, and its and `SettingsPage`'s titles take the page-title size. The kit's own files swap `text-base-content/70` for `text-muted`.

### Acceptance criteria

- [ ] Component tests (one file per primitive): a titled `Card` is a region named by its title; a `ListRow` with `to` is one link covering the row and its trailing control is still clickable; clicking a `CheckField`'s or `ToggleField`'s label toggles it, its help and error are its description, and an error sets `aria-invalid`; a `ToggleField` is a native checkbox with the switch role.
- [ ] Component tests for `Field`: an input, a select and a textarea each get their classes; with an error the control gets the error style; a caller's `className` replaces the default.
- [ ] Every existing `Field` caller outside settings renders as before (the kit's `inScreens` tests and the screen tests pass unedited).
- [ ] The settings component tests pass, edited only where a selector moved; `data-section` hooks are unchanged.
- [ ] No hand-written `card`, list-box, `checkbox`, `toggle`, `input w-full`, `select w-full` or `textarea w-full` class is left in the settings area; the hand-off lists the counts.
- [ ] The settings frame test passes: one `main`, one `h1` per subpage, the side nav from `md` as today.
- [ ] _Docs_: the four primitives' lines; the rule line rewritten (`Field` owns its control's classes; only `ChoiceGroup` callers style a control); "checkboxes and switches are `CheckField` and `ToggleField`".

**Blocked by:** 1, 3, 4. **Blocks:** nothing.

---

## Slice 6: The detail header and section bands on four pages

Stack: no · Reads: docs/domain/components.md, docs/domain/medications.md, docs/domain/providers.md, docs/domain/care-periods.md, docs/domain/todos.md · Tests: component

**Items:** B-264, B-397 (both finish with slice 7). **User stories:** 24–30.

### What to build

`DetailHeader` (icon, tone, title at the page-title size, badges, details, editors, actions; the `data-region` hooks; a pass-through for each page's title hook) and the banded `Page` with `Section`, each with a gallery section in both themes.

On the medication, provider, care period and to-do pages: the header becomes a thin caller of `DetailHeader`, its badges `Badge`s by the tones table, and the page becomes banded. The header is the first band; each part component the page renders today (details, providers, refills, linked to-dos, notes, history and the like) becomes a `Section` itself, in today's order and with today's heading (or a plain one where it had none). These pages have list boxes, not cards, and the list boxes stay. `LinkedTodos` and `AllergiesRegion` get the `band` opt-in. Nothing is added, removed, reordered or hidden; each part keeps its role checks, its "nothing when empty" and its `data-*` hooks. Sheets opened over a page are unchanged.

### Acceptance criteria

- [ ] Component tests (`DetailHeader`'s own file): the title is the page's `h1`; badges, details, editors and actions land in their regions; an empty region renders nothing; the muted tone differs from the primary.
- [ ] Component tests (`Section`'s own file): in a banded `Page`, consecutive bands' computed backgrounds alternate between the two surfaces in light and dark, and still do when a middle section renders nothing; a band spans the window at 1280 px while its content column doesn't; a titled `Section` is a region named by its heading.
- [ ] One component test per page (medication, provider, care period, to-do): its sections are named regions in the expected order for a writer, a viewer sees the same sections they see today and no others, and an empty part leaves no band.
- [ ] The entry page and the medications list look as before (their component tests pass unedited; `LinkedTodos` and `AllergiesRegion` without `band` render today's markup).
- [ ] The four pages' existing component tests pass, edited only where a selector moved; the medication print sheet's tests pass unchanged.
- [ ] At 420 px no band causes sideways scroll (a component test on the medication page).
- [ ] _Docs_: `DetailHeader`, `Section` and the band rule (which pages; parts are the sections; no cards in a band), and the four area docs' lines where they describe these pages.

**Blocked by:** 1, 3, 4. **Blocks:** 7.

---

## Slice 7: The profile in bands

Stack: no · Reads: docs/domain/components.md, docs/domain/profiles.md, docs/domain/care-groups.md · Tests: component

**Items:** B-264, B-397. **User stories:** 24–30.

### What to build

The profile page on slice 6's primitives: `ProfileHeader` becomes a caller of `DetailHeader`, and each card (basics, conditions, the note, vital averages, contact, insurance, emergency contacts) becomes a `Section`, giving up its card surface and keeping its title, Edit action, role checks and `data-*` hooks. The viewer's "more details" line and the no-recipient state stay. The edit sheets and the emergency print sheet are unchanged.

### Acceptance criteria

- [ ] A component test: the profile's sections are named regions in today's order for an owner; a viewer sees only the sections they see today, with the "more details" line; bands alternate with the details sections absent.
- [ ] The profile's existing component tests (profile, conditions, condition providers, emergency, vital averages) pass, edited only where a selector moved; each section's Edit still opens its sheet and returns focus.
- [ ] The emergency print sheet's tests pass unchanged.
- [ ] No `card` class is left on the profile page.
- [ ] _Docs_: the profile page's line in [profiles](../docs/domain/profiles.md).

**Blocked by:** 6. **Blocks:** nothing.

---

## Skeptic pass

One fresh agent read the PRD, the plan and the items cold (2026-11-21). Acted on:

- Slice 4 no longer edits the timeline or entry folders (the PRD calls them unchanged, and `simple-mode` renames a file there); its files are named.
- Slice 3 no longer needs slice 4's constants: the settings frame's container and titles moved to slice 5, now blocked by 4.
- The old slice 6 was too big: the profile is its own slice 7 in a fourth wave.
- Bands: the pages' part components become the sections (no wrappers, CSS alternation, no empty bands), with an opt-in for the two parts shared with unbanded pages.
- The `build:budget` criterion checked nothing for sign-in; replaced by an import-graph test on `ui/plain`.
- Slice 1 was too big: settings' buttons and `SaveRow` moved to slice 3, which owns those files.
- The gallery's gate, routes part, area rule and test shape are spelled out.
- Contrast values are starting points to be raised until they pass.
- B-398's note now lists everything this PRD leaves behind.

Declined: nothing. Seven slices rather than six, because the profile is the page the bands are for and doesn't fit beside the other four.
