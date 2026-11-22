# Plan: UI kit 2 (one Button, the header's add button, medication tabs, a typeface, motion, the choice dialog)

> Source PRD: [`plans/ui-kit-2-prd.md`](ui-kit-2-prd.md). User-story numbers (US) refer to it. Backlog items B-423, B-420, B-419, B-424, B-415, B-414, B-268. Topic `ui-kit-2`. The follow-on topic `ui-kit-3` (B-398 the area sweeps, B-269 the guard, B-448 the profile renames) is to write.

## Status

| Slice | Wave | State                                                                                                                                                                    | Merge into `prd/ui-kit-2` (slice commits)                                                  |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1     | 1    | landed (wave 1, dev 4f58d177, PR #51); merged (opus; quick check passed on c13f688c)                                                                                     | a4c2f3c5 (c13f688c)                                                                        |
| 2     | 2    | merged (opus; quick check passed on 05248130); wave 2, not landed                                                                                                        | 3f42a62c (05248130); `ui` index conflict kept both                                         |
| 3     | 3    | ready (slice 2 merged); not started: the next session starts it                                                                                                          | —                                                                                          |
| 4     | 1    | landed (wave 1, dev 4f58d177, PR #51); merged (opus; quick check on 1efa71ca exit 1 only on the B-484 banner flake, passes alone 3x; layout-offline, marketing pass)     | 7a3fff2f (1efa71ca)                                                                        |
| 5     | 2    | merged (opus; quick check on 9c0d45f9 exit 1 on 3 load click timeouts, pass alone 3x; suspect the `.btn:active` 0.97 scale first if clicks time out); wave 2, not landed | b9ed4d37 (9c0d45f9); index, plain index, registry conflicts kept both; app.css auto-merged |
| 6     | 1    | landed (wave 1, dev 4f58d177, PR #51); merged (opus; quick check passed on 8d21b5d0; roundtrip, ui pass)                                                                 | 9d02ad16 (999c234b, 8d21b5d0); index and registry conflicts kept both                      |

**Landing mode:** run everything through (started run-through; land each green wave, PR + Codex; `--no-review` unasked only when Codex is out of credits).

**Now (hand-over, 2026-11-22):** wave 1 (slices 1, 4, 6; B-423, B-415, B-268) **landed** in dev 4f58d177 through PR #51 (Codex clean on c7734fb, carried over a backlog-only dev sync; full check on 3839ce5; lean `--suite` 12/12); its docs folded (c7734fb8); report filed (ask a34; to-test/2026-11-22-0732-ui-kit-2.md). Wave 2's slices 2 and 5 (B-420, B-419, B-414) are **merged** into prd/ui-kit-2 (3f42a62c, b9ed4d37) and their items `ready`; nothing in flight. Next session: backlog boundary (ingest, list), start slice 3 (B-424, Stack: yes, opus; it needs slice 2's `add`), and when it merges run wave 2+3's gate together (sync, full check, `--suite` if screens changed, PR, Codex, land), or land 2 and 5 first if slice 3 stalls. Fold slice 2's and 5's docs (below) at that landing. Full checks: take turns with fixes-bug (agreed 2026-11-22: start only when no other full check holds a lease); confirm a failure alone 3x; read-once test races get fixed. Flakes filed this wave: B-484, B-485, B-488 (B-487 dropped as B-486's duplicate); noted B-450, B-466.

**Docs to fold (from hand-offs):**

- Slices 1, 4, 6: folded into ui-kit, app-shell, security-headers, appointments, todos (wave 1).
- Slice 2 → ui-kit _Contracts_: `PageHeader` `add`: a `label` and a link (`to`, `state`, `prefetch`, `preventScrollReset`), `onPress`, or `items` (`menuLabel`); the primary `sm` icon-only square `+`, the header's last control, `actions` to its left; `data-*` (string values) on the control. `Button`'s `to` form takes `preventScrollReset`. components _Rules_: "A main page's add control is the header's `+` (`PageHeader` `add`, writers only); other actions sit to its left." providers: writers get the `+` ("Add provider"); Import is an icon-only `secondary` button just before it.
- Slice 5 → ui-kit _What's in it_: `Chevron`, `Collapse` (also `ui/plain`). _Contracts_: motion is three durations (`--motion-fast` 120, `--motion` 180, `--motion-slow` 240) and one ease-out curve at the end of `app.css`; every animating rule under `prefers-reduced-motion: no-preference`, and reduce turns off `.btn`'s daisyUI transition; buttons fade on hover and press to 0.97, link rows fade their fill. `Chevron` (`open`, `closed` right|down; aria-hidden). `Collapse` (`open`, `id`, `axis` block|inline; closed is inert and hidden but stays mounted; the toggle keeps `aria-expanded`/`aria-controls`). _Which to use_: expanders use `Chevron` and `Collapse`. components (tests): emulate reduced motion from the test file via `cdp()` `Emulation.setEmulatedMedia`, reset after. Later (ui-kit-3): `EasyNext`, Today card rows, `TabNav`'s ungated `transition-colors`.

**Start conditions:** `ui-kit` is in `dev` (done). Never beside `i18n`. Its hot files (the PRD table) overlap `fixes-bug` while a wave of it holds the Planner or timeline folders, and `ui-kit-3` must not start before this lands.

**Landing:** no migration, no dependency. Slices 3, 4 and 6 have a stack for their browser checks. Each wave lands something usable, so land wave by wave. Never `--suite` without asking.

**Backlog:** claim a slice's items when it starts; `done` them when it merges (the slice headings name them).

Fold into the area docs at landing: each slice's _Docs_ section lists its lines for [ui-kit](../docs/domain/ui-kit.md) (the `ui/` list, _Which to use_, _Contracts_); slice 3 also the tabs line in [medications](../docs/domain/medications.md); slice 4 the font's lines in [app-shell](../docs/domain/app-shell.md) (the service worker's list) and one in [security-headers](../docs/domain/security-headers.md) (fonts are same-origin, no CSP change); slice 2 the header rule in [components](../docs/domain/components.md). Those docs are at their budget: trim what you add.

## Architectural decisions

- **Where:** every new primitive is in `components/ui/`, imports nothing from feature folders, and is exported from the `ui` index and, having no React Aria, from `ui/plain` too. Callers pass data, labels and callbacks; a primitive holds no user-facing text of its own.
- **Append-only shared files:** the `ui` and `ui/plain` indexes, `ui/styles.ts`, the gallery registry and `app.css` take new lines **at the end only**. Conflicts there are resolved by keeping both.
- **Tests per primitive:** a new primitive has its own `*.browser.test.tsx` beside it; a changed one adds to its own file. Every new or changed primitive has its gallery section (`/dev/ui`) in both themes.
- **Button:** `variant` `primary`, `secondary` (the default; the old name `default` goes), `ghost`, `danger`, `dangerQuiet`; `size` `lg`, `md`, `sm`, `xs`; `shape` `rounded` (the default), `pill`, `square`, `round`; `block`; `icon`; `busy` with `busyLabel`; `to`, `href`. Icon only is `icon` with a required `label` and no children (`label` is the name and tooltip; `square` unless `round`), and takes `pressed`, `expanded`, `controls`, `ref`. `IconButton` renders `Button` and keeps its props. The pure `buttonClass` stays the one class map.
- **Menu triggers** take a look (`variant`, `size`, `shape`) built by `buttonClass`; a class string still works until `ui-kit-3`.
- **The header's add:** `PageHeader`'s `add` is a label plus a link (`to`, `state`, `data-*`), a callback, or menu items. It renders a `primary`, `sm`, icon-only `+`, the last control at the top right; `actions` sit to its left. Pages pass it for writers only and keep their `data-*` hooks.
- **Not a Button** (the PRD's list): header and bottom-bar navigation, marketing's header and footer links, expand toggles, inline links, tabs, chips, whole-row links, menu items, form controls and ticks, the date picker's insides, avatars.
- **Type:** one `--font-sans` in the theme: Atkinson Hyperlegible Next, then today's system stack. Files are vendored `woff2` in the web app's source with the OFL licence and the release's version beside them, referenced from CSS so the build hashes them; `@font-face` with `font-display: swap`; no package, no CDN, no CSP change.
- **Motion:** `--motion-fast` (120 ms), `--motion` (180 ms), `--motion-slow` (240 ms) and one ease-out curve in `app.css`. Every rule that animates is under `prefers-reduced-motion: no-preference`. No bounce, no scale above 1. Overlays (menus, popovers, dialogs, toasts, a sheet's close) are not animated in this topic.
- **`Collapse`:** closed content is out of the accessibility tree and can't take focus; `aria-expanded` and `aria-controls` stay on the caller's toggle. **`Chevron`:** `open`, and which way it points closed.
- **`ChoiceDialog`:** built on `useShowModal`, the same rules as `ConfirmDialog`; up to three choices and Cancel, each choice a `Button` in one of its tones (no outline look is added); in `ui/plain` too.
- **Unchanged:** every existing URL, loaders, permissions, schema, sync, the server, emails, print layouts.

## How to run this plan

- **Wave 1: slices 1, 4 and 6** together. Slice 1 owns `Button`, `IconButton`, `buttonClass`, `Menu`'s trigger and their tests and gallery sections. Slice 4 owns `app.css`'s theme block, the document `head` in the root, the font files, the service worker's install list and a new gallery section. Slice 6 owns the new `ChoiceDialog`, the series question in `components/entry/` and the repeating todo's delete dialog in the todo page's folder. Slice 6 uses `Button` without naming a variant for the secondary look, so slice 1's rename doesn't touch it. Slice 1 also changes the one `default` in the kit's chip style to `secondary` (an edit in place in the append-only styles file, the one exception).
- **Wave 2: slices 2 and 5** together. Slice 2 owns `PageHeader` and the headers of Providers, the Planner and Care periods. Slice 5 owns the motion rules at the end of `app.css`, the new `Collapse` and `Chevron`, the hover and press styling of `ListRow` and `buttonClass`, the chevron inside `Menu`'s groups, and three timeline files (the day summary, the filter row's search toggle, the Today header's chevron). Slice 5 changes no primitive's props, so slice 2 and it don't meet.
- **Wave 3: slice 3**, Medications (it needs slice 2's `add`).
- **Stacks:** slices 3, 4 and 6, whose files map to end-to-end checks (`first-sync` and `layout-offline`; the root document and the build's worker list; `roundtrip`): each runs the checks its fields line names and edits a spec only if it fails on markup the slice changed. Slices 1, 2 and 5 are stackless: their kit files map only to the `ui` check, which the orchestrator runs at each wave's gate, as in `ui-kit`. No spec names the header hooks that change.
- **Checks:** every slice runs `pnpm prd check --quick "slice hand-off"` and `pnpm test:components --changed prd/ui-kit-2`, then, with a stack, `pnpm prd browser --changed` once, reporting what it named (never the suite: slice 4's files name it, and it runs only `layout-offline` and `marketing`; the suite is the gate's, on the user's word).
- **Tests select by role and name.** Where one selected a class or tag that moved, fix the selector, not the behaviour. Don't change the shared test harness or the Vitest config (`test-health`'s): a test that read a closed region at once polls instead, and slice 5 emulates reduced motion from its own test files.
- **Beside other PRDs:** `fixes-bug` works in the Planner and timeline folders; slices 2 and 5 touch one header file and three timeline files there, so sync first and whoever lands second resolves. `test-health` edits component tests area by area: the same rule.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: One Button

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md · Tests: unit, component

**Items:** B-423. **User stories:** 1, 2, 3, 4, 5, 24.

### What to build

`Button` becomes the one button component: the `lg` size, the `shape` prop, the icon-only form with its required `label`, and the toggle and disclosure props `IconButton` has. The variant `default` is renamed `secondary` and stays the default. `IconButton` becomes a short wrapper that renders `Button`; its props, and so its callers, don't change. `buttonClass` gains the new size and shapes. `Menu`'s trigger takes a look and builds its classes through `buttonClass`, still accepting a class string. The gallery's Button section shows every tone, size and shape, the icon-only form and a menu trigger, in both themes.

No screen is swept here: the hand-written buttons elsewhere are `ui-kit-3`'s (B-398 carries that part of B-423).

### Acceptance criteria

- [ ] Unit test (`buttonClass`): every variant, size (with `lg`) and shape gives its classes; `secondary` is the default; no entry named `default` is left (the kit's chip style, its one user, names `secondary`).
- [ ] Component tests (`Button`'s file): an icon-only button has its `label` as accessible name and `title`; `pressed` sets `aria-pressed`; `expanded` and `controls` set `aria-expanded` and `aria-controls`; the `to` and `href` forms look the same as the button form (same classes); `busy` still disables and swaps the text.
- [ ] Component test: an `IconButton` and an icon-only `Button` with the same props render the same element, name and classes.
- [ ] Component test (`Menu`): a trigger given a look carries the classes `buttonClass` gives for it; a trigger given a class string is unchanged.
- [ ] Every existing component test passes unedited (no caller changes).
- [ ] The light entry's import test still passes.
- [ ] _Docs_: the `Button` contract, "`IconButton` is the icon-only `Button`", the menu trigger's look, and the list of what is not a `Button`.

**Blocked by:** none. **Blocks:** 2 (the menu trigger's look, the icon-only form), 5 (the press and hover rules build on the final class map).

---

## Slice 2: The header's add button

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/providers.md · Tests: component

**Items:** B-420, B-419. **User stories:** 6, 7, 8, 9, 10, 11, 24.

### What to build

`PageHeader` takes `add` (a link, a callback or menu items, with a label) and renders the primary, icon-only `+` last at the top right, with `actions` to its left. Three pages adopt it:

- **Providers:** the `+` is "Add provider" (the same sheet link, state and prefetch as today). Import is an icon-only `secondary` button of the same size to its left, named "Import from another group", shown under the same condition as today.
- **The Planner and Todos** (one shared header): the `+` is a menu named "Add" with Appointment and Todo, the same targets as today.
- **Care periods:** the `+` is "Add period".

Each keeps its `data-*` hook. Viewers get no `+`. The gallery's PageHeader section shows the three forms.

### Acceptance criteria

- [ ] Component tests (`PageHeader`, its own new file): with `add` the `+` is the header's last control, is named by its label and has it as `title`; `actions` come before it; the link form goes to its target, the callback form calls back, the menu form lists its items; without `add` the header is as before.
- [ ] Component test (Providers): a writer sees a button named "Add provider" that opens the add sheet and, with a second group, one named "Import from another group" before it that opens the import sheet; neither shows its text; a viewer sees neither.
- [ ] Component test (the Planner, and the Todos tab): the `+` opens a menu with Appointment and Todo that go where they went; a viewer sees none.
- [ ] Component test (Care periods): the `+` named "Add period" opens the add sheet; a viewer sees none.
- [ ] The existing tests of those pages pass, edited only where they selected the old button by its visible text.
- [ ] _Docs_: `PageHeader`'s `add`, and the rule "a main page's add control is the header's `+`; other actions sit to its left".

**Blocked by:** 1. **Blocks:** 3.

---

## Slice 3: Medications: Passes as a tab, the add menu

Stack: yes · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/medications.md · Tests: unit, component, e2e:first-sync, e2e:layout-offline

**Items:** B-424. **User stories:** 12, 13, 14.

### What to build

Passes becomes the third tab of the Medications page (Schedule, Medications, Passes) at the URL it has today: the passes route moves under the Medications frame in the medications routes part, and the frame's tab helper learns `passes`. The passes page drops its back link, its own title and its "Add pass" button; its one-line description (with the time-zone note and the viewer note) stays at the top of the tab. The header's Passes link goes.

The add-pass sheet becomes a sheet route under the Passes tab (its URL added to the medications URLs part and the frozen lists), opened by link; editing a pass stays as it is. Opened directly by a viewer, or when the group already has 8 passes, the sheet's route sends the visitor to the Passes tab (the add-medication sheet's guard is the prior art). The frame reads the group's live pass count to build its menu.

The header's `+` (slice 2's `add`) is a menu named "Add": Medication (the add sheet over the current tab; from the Passes tab, over the list) and Pass (the add-pass sheet; left out when the group has 8 passes). Print stays, to its left. Viewers get Print only.

Links elsewhere that go to the passes page (the medication form, the schedule fields) keep working unchanged.

### Acceptance criteria

- [ ] Unit tests: the tab helper returns `passes` for the passes URL and its sheet; the frozen route and URL lists show the passes route under the Medications frame and include the pass sheet.
- [ ] Component test (the guard): a viewer, and a writer in a group with 8 passes, opening the pass sheet's URL land on the Passes tab with no sheet.
- [ ] Component test (the tabs): three tabs in order; opening the passes URL shows the Medications header with Passes current, one `h1` ("Medications"), no back link.
- [ ] Component test (the `+`): a writer's menu lists Medication and Pass; Medication opens the add sheet over the current tab, and from Passes over the list; Pass opens the add-pass sheet on the Passes tab from each of the three tabs; with 8 passes the menu has no Pass; a viewer has no `+`.
- [ ] Component test (Passes): adding a pass through the sheet shows it in the list and closes back to the tab; editing still works; the description line and the viewer note show.
- [ ] The existing passes, tabs and schedule component tests pass, edited only for the moved header.
- [ ] `first-sync` and `layout-offline` pass (no new steps; a spec is edited only if it selected markup that moved).
- [ ] _Docs_: the medications doc's tabs line (three tabs, the `+` menu, the pass sheet's route).

**Blocked by:** 2. **Blocks:** none.

---

## Slice 4: The typeface

Stack: yes · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/app-shell.md, docs/domain/security-headers.md · Tests: unit, component, e2e:layout-offline, e2e:marketing

**Items:** B-415. **User stories:** 15, 16, 17, 24.

### What to build

Atkinson Hyperlegible Next as the site's one sans family: the variable `woff2` files (upright and italic, Latin), taken from the family's official release and vendored in the web app's source with the SIL OFL licence and the release's version beside them; `@font-face` rules that reference them from CSS (so the build gives them hashed names) with `font-display: swap`; `--font-sans` in the theme naming it before today's system stack; the upright file preloaded on the document by its built URL. Code keeps `ui-monospace`. No package and no request to another origin.

The build's worker list keeps only scripts and styles today: it also takes the font files, so the offline shell has them and a changed font makes a new worker version.

A gallery section, Type: the heading scale, body and small text, the weights in use, numerals, and the look-alike pairs (`I l 1`, `O 0`, `rn m`) in both themes.

Then check for wrapping: the page headers, the pill tab bars, the bottom bar and the app header at 320 and 420 px. Fix a wrap with the kit's existing truncation or by nothing wider than a one-step spacing change in the primitive; list each in the hand-off.

### Acceptance criteria

- [ ] Component test: on an `/app` page the computed `font-family` of the body and of a button starts with the new family, and after `document.fonts.load(…)` for it the family is loaded (its file was found); a `code` element keeps the monospace stack.
- [ ] Component test: at 320 px the Medications and Planner tab bars and a page header with a title and two actions don't scroll the page sideways.
- [ ] Unit test (the build's worker list): it includes the hashed font files, and still nothing but scripts, styles and fonts.
- [ ] `layout-offline` and `marketing` pass (no new steps): the offline shell and the public pages load with no console or CSP error.
- [ ] The security-headers unit test passes unchanged (`font-src` is still `'self' data:`).
- [ ] The existing contrast and component tests pass; a test that measured a width or position is updated, never a behaviour.
- [ ] `pnpm build:budget` passes (fonts are not script chunks; say what the files weigh in the hand-off).
- [ ] _Docs_: the family, where the files and licence live, the one variable to change, the service worker's list.

**Blocked by:** none. **Blocks:** none.

---

## Slice 5: Motion

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md · Tests: component

**Items:** B-414. **User stories:** 18, 19, 20, 21, 24.

### What to build

The motion variables and their rules at the end of `app.css`, all under `prefers-reduced-motion: no-preference`. Buttons take them on hover, with a small press; list rows on hover.

Two new primitives: `Chevron` (one turning chevron) and `Collapse` (a region that slides open and closed, its closed content out of the accessibility tree and unfocusable). `Menu`'s groups use `Chevron`.

On the timeline: the day summary's chevron and list use `Chevron` and `Collapse`; the filter row's search box opens and closes with `Collapse`; the Today header's chevron becomes `Chevron`. No other expander is touched (`ui-kit-3`), and no overlay (menus, popovers, dialogs, toasts, sheets).

A gallery section, Motion: buttons, a list row, `Chevron` and `Collapse`.

### Acceptance criteria

- [ ] Component tests (`Collapse`, its own file): open, its content is visible and focusable; closed, it isn't in the accessibility tree and Tab skips it; with motion, the region has a transition of the kit's duration; with reduced motion the change is immediate and no transition is set. Reduced motion is emulated from the test file itself (the browser's CDP session, reset after the test), not by a new shared command.
- [ ] Component test (`Chevron`): `open` turns it; it is hidden from the accessibility tree.
- [ ] Component test (the timeline): the day summary toggles its lines with `aria-expanded` as before; the search toggle opens the box, focuses it and closes it as before.
- [ ] With reduced motion, a component test finds no `transition` or `animation` longer than 0 s on a button, a list row and a `Collapse`.
- [ ] The existing timeline, menu and button component tests pass; one that read a closed region at once polls instead. No test's timeout is raised and no shared harness file changes.
- [ ] _Docs_: the three durations, the reduced-motion rule, `Collapse`, `Chevron`, and "expanders use them".

**Blocked by:** 1. **Blocks:** none.

---

## Slice 6: The choice dialog

Stack: yes · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/appointments.md, docs/domain/todos.md · Tests: component, e2e:roundtrip

**Items:** B-268. **User stories:** 22, 23, 24.

### What to build

`ChoiceDialog` in the kit (and `ui/plain`): a title, a message, up to three stacked full-width choices (each an id, a label, one of `Button`'s tones and `data-*`; the first solid primary or danger, the rest `secondary` or `dangerQuiet`, so no outline look is added) and Cancel, on `useShowModal` with `ConfirmDialog`'s rules. A gallery section in both themes.

Two callers move onto it and keep their props, words and `data-*` hooks: the series question before a change to a repeating visit, and the repeating todo's delete question. After this no `<dialog>` element is written outside `components/ui/`.

### Acceptance criteria

- [ ] Component tests (`ChoiceDialog`, its own file): it is a modal dialog named by its title and described by its message; each choice calls `onChoose` with its id; Cancel and Escape call `onClose` and close only the dialog; opened from a `Menu` item it shows after the menu has closed, and focus returns to the menu's trigger when it closes.
- [ ] Component test (the series question, through a Planner or timeline screen that has one): Only this visit and This and later visits each do what they did; a delete shows the danger tone.
- [ ] Component test (the repeating todo): Skip this one and Delete and stop repeating each do what they did.
- [ ] The existing series and todo-repeat component tests pass, edited only where they selected dialog markup.
- [ ] A search of the app's source finds `<dialog` only in the kit.
- [ ] `roundtrip` passes (no new steps; the spec is edited only if it selected the dialog's markup).
- [ ] _Docs_: `ChoiceDialog`'s contract, and "a question with two or three answers is a `ChoiceDialog`".

**Blocked by:** none. **Blocks:** none.
