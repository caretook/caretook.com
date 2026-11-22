# Plan: UI kit 3 (a lighter dark theme, text boxes with their own fill, accent colours, overlay motion)

> Source PRD: [`plans/ui-kit-3-prd.md`](ui-kit-3-prd.md). User-story numbers (US) refer to it. Backlog items B-520, B-481, B-521, B-522, B-523, B-524, B-471. Topic `ui-kit-3`. The follow-on topic `ui-kit-4` (B-398 the area sweeps, B-448 the profile renames, B-269 the guard) is to write.

## Status

| Slice | Wave | State         | Merge into `prd/ui-kit-3` (slice commits)         |
| ----- | ---- | ------------- | ------------------------------------------------- |
| 1     | 1    | merged (opus) | de6dd339 (126b3ddd, f1fd42ec, 8be9986a, 9057dae3) |
| 2     | 2    | merged (opus) | 49d983dd (04c5b973, 2545fbe7)                     |
| 3     | 3    | —             | —                                                 |
| 4     | 3    | —             | —                                                 |
| 5     | 1    | merged (opus) | e079afc0 (93cae190)                               |
| 6     | 2    | merged (opus) | 6711b506 (124b5817, 3f1b7ea7)                     |

**Landing mode: run everything through** (started run-through, 2026-11-22): start every ready slice, land each green wave unasked, clean up; questions only through `pnpm prd ask`.

**The test-profiling hold is over for this topic:** the dispatcher restarted ui-kit-3 at 2026-11-22T22:51Z. Notice n6 was still listed then, but it predates wave 1's landing.

**Resume here:** wave 2: slices 2 and 6 are merged (B-521, B-522, B-471 ready, worktrees removed; `app.css` conflict resolved keeping both blocks). Next: `pnpm prd sync`, the full `pnpm prd check` (a conflict was resolved in code), `pnpm prd serve --restart`, browser `roundtrip`, `ui` and `--changed --base dev` (no `--suite` without asking), then PR, review, land, fold docs, rotate. Slice 6's notes: it also changed `ui/Menu.tsx` (`data-menu-trigger`, `data-menu-of`) so a sheet opened from a menu item returns focus to the menu's button, which affects every such sheet; `stacked sheets` failed once, then passed 26 runs, cause unconfirmed; fold that focus rule into ui-kit _Contracts_ too. Slice 2's notes: its slice check passed on 2545fbe7; an accidental full component run passed 1464 of 1465, the one failure being the print menu test that B-552 (flaky Print menu test) tracks, unconfirmed; Timeline and Care periods share the `History` icon, which slice 3 should weigh when it puts chips in headers. Fold at landing: `IconChip`, the accents and `--color-hue-*` (ui-kit); the entry colours, replacing the line saying vitals are pink (timeline); the section map and Easy rule (app-shell). Slice agents run only their own tests; the orchestrator runs `roundtrip` and `ui` at the wave gate. Wave 1 docs are folded. Slice 6 closes at once, with no exit, for `groups/new` (its action redirects) and for a caller that unmounts the sheet directly (`RepeatSheet`'s Done). Fold into ui-kit _Contracts_: `Sheet`'s exit, what holds a navigation, and that a save plays the exit only when the caller navigates afterwards.

**Browser test skip (the user's word via the temp queue session, notice n14; ends when test-gates slice 8 is in `dev`):** slices may leave `scripts/loops/browser.test.mjs` out of their tooling runs, unless they change `scripts/loops/browser.sh`, `lib.sh`, `lease.sh`, `scripts/loops/checks` or `scripts/browser-checks/`. Wave gates may skip it only for tool-only changes, so this topic's app changes take the normal gate. A hand-off says when it was skipped. `pnpm prd check` still runs it when a diff touches tooling; don't edit `check-body.sh` or bypass the gate. Instead of `pnpm test:tooling`: `node scripts/loops/tooling-lint.mjs`, then `files=$(pnpm exec vitest list --filesOnly --project tooling:unit --project scripts:unit | awk '/\.test\.[a-z]+$/ {print $NF}' | sort -u | grep -v 'loops/browser\.test\.mjs$')`, then `pnpm exec vitest run --project tooling:unit --project scripts:unit $files` (`${=files}` in zsh).

**Wave 1 notes:** synced `dev` twice. Gate: three full checks failed on, in turn, test-health's new `no-non-null-in-expect` lint in the tokens test, the timeline layout test reading the fading View options menu (`setView` now waits it out), and the calendarCron load flake (B-479; the user: assume load). A quick gate passed on 58da43d3; after the second sync (dev's seeds) the user said land without the full check. Browser: `ui` passed (only check `--changed` named). Follow-ups filed: B-536 (danger text and DateTimeField placeholder contrast, fixes-ui); B-540 dropped as a duplicate of B-479.

**Start conditions:** `ui-kit-2` is in `dev` (done). Never beside `i18n`. `ui-kit-4` must not start before this lands. `fixes-ui` may touch the same screens, and `quick-entry-2` shares quick entry's cards and reads the entry metadata slice 2 reshapes (`KIND_META`'s class string becomes an accent and a look): sync first, and whoever lands second resolves and moves its readers onto the new shape.

**Landing:** no migration, no dependency. Each wave lands something usable, so land wave by wave. Never `--suite` without asking.

**Backlog:** claim a slice's items when it starts; `done` them when it merges (the slice headings name them). B-471 is done when slice 6 merges; B-521 with slice 2.

Fold into the area docs at landing: each slice's _Docs_ section lists its lines for [ui-kit](../docs/domain/ui-kit.md) and [components](../docs/domain/components.md) (the surfaces line, the motion line: "no animated overlays" goes); slice 2 also the entry colours in [timeline](../docs/domain/timeline.md); slice 2 the section accents in [app-shell](../docs/domain/app-shell.md). ui-kit's line that a bare class string on `Menu`'s trigger works "until `ui-kit-3`" becomes `ui-kit-4`. Those docs are at their budget: trim what you add.

## Architectural decisions

- **Where:** new primitives are in `components/ui/`, import nothing from feature folders, and are exported from the `ui` index and, having no React Aria, from `ui/plain`. Callers pass data, labels and callbacks; never a colour class.
- **Append-only shared files:** the `ui` and `ui/plain` indexes, `ui/styles.ts`, the gallery registry and `app.css` take new lines **at the end only** (slice 1's edit of the dark theme block is the one exception). Conflicts there are resolved by keeping both.
- **Surfaces:** `base-200` the page, `base-100` a card, `base-300` borders and quiet fills, in that order of lightness in dark (about 23%, 30%, 40%; hue 270; chroma at most 0.025). Light's bases don't change. **The field fill** is one token with a light and a dark value, set site-wide on daisyUI's `input`, `select` and `textarea`, white in print; ghost inputs stay transparent.
- **Status tokens stay daisyUI's.** A coloured text that fails 4.5:1 on a dark surface is lifted toward white in the kit's shared class, as `TabNav`'s current tab is.
- **Accents:** indigo, teal, orange, lime, plum, pink. Three CSS variables each per theme (solid with its content colour, tint, text), at the end of `app.css`. One pure kit module maps an accent (or neutral) and a look (`solid`, `soft`, `text`) to classes; nothing else names an accent colour, and no accent uses a status, primary or secondary token.
- **The maps:** entry type to accent and look lives with the timeline's display metadata (`KIND_META` keeps its keys and order; its class string becomes an accent and a look). Section to accent and icon is a pure map of its own in the app shell (Timeline indigo, Medications teal, Planner orange, Providers lime, Care periods plum); `GROUP_SECTIONS` is not changed.
- **`IconChip`** is the one way to draw an icon in a coloured box. **Easy mode is neutral:** a page in Easy mode or for an easy role passes no accent.
- **Motion:** only `--motion-fast`, `--motion`, `--motion-slow` and the one curve; every rule under `prefers-reduced-motion: no-preference`; fades and the sheet's existing slide only. Primitives own it: no caller animates or delays anything.
- **Contrast floors**, measured with `apps/web/test/contrast.ts` in both themes: text 4.5:1, an icon in its chip 3:1.
- **Unchanged:** every URL, loader, permission, schema, sync, the server, emails, print layouts.

## How to run this plan

- **Wave 1: slices 1 and 5** together. Slice 1 owns the dark theme block and the field token in `app.css`, the kit's shared text constants, the tokens test and gallery section. Slice 5 owns `Menu`, `Popover`, the dialogs, `Toast` and its two callers, and new motion rules at the end of `app.css`.
- **Wave 2: slices 2 and 6** together. Slice 2 owns the accent tokens, the accent module, `IconChip`, the timeline's display metadata, the section map, the entry-type icon and quick entry's card. Slice 6 owns `Sheet` and its exit rules; both append to the end of `app.css` (keep both).
- **Wave 3: slices 3 and 4** together. Slice 3 owns `PageHeader`, `TabNav` and the header lines of the five sections' pages. Slice 4 owns `EmptyState` and the empty-list lines of the same sections. They meet in the Care periods page (a header line and an empty line): whoever merges second resolves.
- **Stacks:** slices 5 and 6, whose changes sit under every flow that opens a menu, dialog or sheet: each runs the checks its fields line names, and edits a spec only if it fails on timing the slice changed (wait on the element, never a fixed sleep). The others are stackless: their kit files map to the `ui` check, which the orchestrator runs at each wave's gate with the changed checks.
- **Checks:** every slice runs `pnpm prd check --quick "slice hand-off"` and `pnpm test:components --changed prd/ui-kit-3`, then, with a stack, `pnpm prd browser --changed` once, reporting what it named (never the suite).
- **Tests select by role and name** and measure colours, never a class name. A test that read a closed overlay at once polls instead; reduced motion is emulated from the test's own file. Don't change the shared test harness or the Vitest config.
- **The values in this plan are starting points.** A slice may move a lightness, hue or duration to pass its contrast tests or to look right in the gallery, inside the bounds its item gives, and says what it chose in its hand-off.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: A lighter dark theme and the field fill

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/app-shell.md · Tests: component

**Items:** B-520, B-481. **User stories:** 1, 2, 3, 4, 5, 20.

### What to build

The dark theme's three bases are lifted (page about 23%, cards about 30%, borders about 40%, hue 270, chroma at most 0.025); light's stay. Text boxes get the field fill, a shallow well a little darker than the page in both themes (start: light about 94%, dark about 18%), applied once to every `input`, `select` and `textarea` on the site, and white in print. The rule must not beat daisyUI's own states: a ghost input (the entry header's title and place) stays transparent, a disabled box keeps a look visibly different from an enabled one (restate it), and placeholders, which daisyUI paints at half the text colour, are repainted to keep 4.5:1 on the field.

Then everything that leans on the bases is measured and, where it fails, fixed in the kit: `text-muted` and `text-faint`, the kit's coloured text (`LINK`, the field error and warning lines, `Message`'s tones, `Badge`'s tones, `TabNav`'s current tab), the search `Highlight`, the phone tab bar's dark surface and the timeline's day band (both read the bases, so they should follow; check that they still stand apart from the page). The gallery's tokens section shows the three surfaces and a field in both themes.

Hand-written colour classes outside the kit are not swept here (`ui-kit-4`).

### Acceptance criteria

- [ ] Component test (the tokens file): in dark, the page, card and border are each lighter than the one before by a visible step (card on page and border on card at least 1.2:1), and the hand-off records the computed values; light's three bases are unchanged.
- [ ] Component test: a `Field` of each kind (`input`, `select`, `textarea`) has a background that differs from `base-100` and from `base-200` (at least 1.05:1 each) in both themes; its text is 4.5:1 and its placeholder and `text-faint` at least 4.5:1 on it; a disabled field's background or text differs from the enabled one's.
- [ ] Component test: `text-muted` and `text-faint` keep 4.5:1 on the page and a card in both themes (the existing test, still green).
- [ ] Component tests: `LINK`, the field error and warning lines, each `Message` tone and each `Badge` tone are at least 4.5:1 on a card and on the page in both themes; `TabNav`'s and `Highlight`'s existing contrast tests pass.
- [ ] Component test (the frame): the tab bar in dark stands apart from the page (at least 1.2:1) and its labels are 4.5:1 on it.
- [ ] Component test: a ghost input's background is still transparent in both themes.
- [ ] Component test: under print media a field's background is white.
- [ ] The gallery test still passes; the tokens section shows the surfaces and a field in both themes.

### Docs

The dark values, the field token and where it applies (components _Rules_, the surfaces line); any kit constant whose colour changed (ui-kit _Tokens_).

**Blocked by:** none. **Blocks:** 2 (accent contrast is measured on these surfaces).

---

## Slice 2: Accent colours, and the timeline's entry icons in them

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md, docs/domain/assistant.md, docs/domain/app-shell.md · Tests: unit, component

**Items:** B-521, B-522. **User stories:** 6, 7, 8, 13, 20.

### What to build

The six accents as tokens (solid and its content colour, tint, text; light and dark), the pure accent module, and the `IconChip` primitive with its gallery section (every accent, both looks, both themes). Hues sit apart from the status colours: orange clear of warning's amber and error's red, lime clear of success's green, teal clear of info's blue.

Then the first users, end to end: the timeline's display metadata names an accent and a look for each entry type (note neutral; symptom pink; vitals plum; event orange; dose solid teal; medication change soft teal; condition change soft indigo), and the entry-type icon and quick entry's cards render `IconChip` from it (the to-do card soft orange). Labels and icons don't change. The Today card's urgency tints don't change.

Also here, so slices 3 and 4 only read it: the section map (Timeline indigo, Medications teal, Planner orange, Providers lime, Care periods plum, each with its icon: the section registry's, and Care periods' from the group menu), whose lookup takes the easy state and returns nothing when easy. Nothing uses it yet.

### Acceptance criteria

- [ ] Unit test (the accent module): every accent and neutral gives classes for `solid`, `soft` and `text`; no result contains a status, `primary`, `secondary` or daisyUI `accent` token.
- [ ] Unit test (the entry map): every entry type has an accent (or neutral) and a look; dose and medication change share an accent with different looks.
- [ ] Unit test (the section map): each of the five sections has an accent and an icon; the lookup returns nothing when easy.
- [ ] Component test (accents, both themes): each accent's text is 4.5:1 on its tint, on a card and on the page; an icon is 3:1 on its solid chip and on its soft chip; the hand-off records the measured ratios.
- [ ] Component test (accents): each accent's solid differs from every status colour's solid (not the same computed colour, and at least 20 degrees of hue from warning, error, success and info; the test computes hue from the painted colour).
- [ ] Component test (`IconChip`): decorative by default (hidden from the accessibility tree), named when given a label; each size and shape renders.
- [ ] Component test (a timeline day with one entry of every type): each row's icon has the chip colour its type's accent gives, none is a status colour, and each row still shows its type's icon and accessible label.
- [ ] Component test (quick entry's cards): a card per kind takes its type's accent; the to-do card is soft orange.
- [ ] The gallery lists `IconChip` and the accents; the gallery test passes.

### Docs

The accents, the accent module and `IconChip` (ui-kit: _What's in it_, _Contracts_, _Tokens_); the entry-type colours (timeline); the section map and the Easy rule (app-shell).

**Blocked by:** 1. **Blocks:** 3, 4.

---

## Slice 3: Each section's colour beside its title and on its tabs

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/app-shell.md · Tests: component

**Items:** B-523. **User stories:** 9, 10, 12, 13.

### What to build

`PageHeader` takes `icon` and `accent`: a soft `IconChip` before the title, decorative, aligned with the title on one line, the title still the `h1` and the actions and `+` where they are. `TabNav` takes `accent`: the current tab's pill tint, its text and its count badge in that accent; without it, today's primary look (sign-in). No header wash.

The adopters read slice 2's section map: the Timeline, Providers, Medications, Planner (and Todos) and Care periods pages pass their icon and accent to the header, and Medications and the Planner to their tabs. In Easy mode, and for an easy role on any page, the lookup returns nothing and the page passes none.

### Acceptance criteria

- [ ] Component tests (`PageHeader`): with `icon` and `accent` the chip shows before the title and the `h1`'s accessible name is the title alone; without them the header is as before; the header still wraps at 320 px with actions and a `+`.
- [ ] Component tests (`TabNav`, both themes): with an accent the current tab's text is 4.5:1 on its pill and the count is readable (4.5:1); without one the existing tests pass unchanged.
- [ ] Component tests (screens): the Providers, Medications, Planner, Care periods and Timeline pages show their section's chip; Medications' and the Planner's current tab is in the section's accent.
- [ ] Component test: the timeline in Easy mode, and the Planner for an easy role, show no chip and no accent.
- [ ] The gallery's `PageHeader` and `TabNav` sections show the accented forms.

### Docs

`PageHeader`'s and `TabNav`'s new props (ui-kit _Contracts_).

**Blocked by:** 2. **Blocks:** none.

---

## Slice 4: Empty states with the section's icon

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/timeline.md, docs/domain/providers.md, docs/domain/medications.md, docs/domain/todos.md, docs/domain/care-periods.md · Tests: component

**Items:** B-524. **User stories:** 11, 12, 13.

### What to build

`EmptyState` takes `icon` and `accent`: a soft round `IconChip` above the line (decorative), then the line and the optional action, left-aligned as today. Without them it is today's quiet line, so its existing callers don't change.

The main list of each accented section adopts it with the section's icon and accent: the timeline with no entries at all, Providers, the Medications list and the Passes tab, the Planner's upcoming list and Todos, Care periods. The words don't change. A filtered or searched list that comes back empty, and every other "No … yet." line, stays quiet (the rest move onto `EmptyState` in `ui-kit-4`). In Easy mode the timeline's empty state is neutral.

Icons and accents come from slice 2's section map.

### Acceptance criteria

- [ ] Component tests (`EmptyState`, both themes): with `icon` and `accent` the circle shows above the line, hidden from the accessibility tree, the icon 3:1 on it; without them the output is as before; the action still works as a link and as a button.
- [ ] Component tests (screens, a group with nothing in that section): Providers, the Medications list, Passes, the Planner, Todos, Care periods and the timeline each show the icon circle in their section's accent with their existing words; a writer still gets the add action where there was one.
- [ ] Component test: a filtered-empty list (the timeline with a filter on) shows the quiet line and no circle; the timeline in Easy mode shows no accent.
- [ ] The gallery's `EmptyState` section shows both forms.

### Docs

`EmptyState`'s props and where the coloured form is used (ui-kit _Contracts_, _Which to use_).

**Blocked by:** 2. **Blocks:** none.

---

## Slice 5: Menus, popovers, dialogs and toasts fade

Stack: yes · Reads: docs/domain/components.md, docs/domain/ui-kit.md · Tests: component, e2e:ui

**Items:** B-471 (first part). **User stories:** 14, 15, 16, 18, 19.

### What to build

Fades, in and out, owned by the primitives: `Menu` and `Popover` (React Aria's entering and exiting states), the native modal dialogs and their backdrop, which already fade and grow through daisyUI's `modal` (0.3 s, from 0.95): re-time that onto the kit's variables as a plain fade, in one rule for every modal dialog, so `ConfirmDialog`, `ChoiceDialog` and the hand-written dialogs outside the kit all get it, and `Toast`, which takes `open` and stays mounted through its exit (its two callers, the update notice and the timeline's added-medication toast, pass `open` instead of unmounting it). `--motion-fast` in and out for menus and popovers, `--motion` for dialogs and toasts; everything under `prefers-reduced-motion: no-preference`. Tooltips and `Sheet` are untouched.

A menu's exit must finish well inside the wait `useShowModal` gives a closing menu, so a dialog opened from a menu item still opens and returns focus to the menu's button. Existing tests that read a closed overlay in the same frame poll instead.

### Acceptance criteria

- [ ] Component tests (`Menu`, `Popover`): with motion on, opening shows the content and closing removes it from the DOM after the exit (polled); with reduced motion emulated, it is gone in the next frame and no transition or animation is computed on it.
- [ ] Component test: a confirm opened from a menu item opens after the menu has gone, and on Cancel focus is back on the menu's button (motion on and reduced).
- [ ] Component tests (`ConfirmDialog`, `ChoiceDialog`): `dialog.open` turns true and false as before; Escape closes only the dialog; `onClose` runs once per close; with motion on, the dialog's computed transition uses the kit's duration and no scale; with reduced motion no transition is computed on the dialog or its backdrop.
- [ ] Component tests (`Toast`): `open` true shows a `status`; turning it false removes it after the exit (at once under reduced motion); the update notice and the added-medication toast still appear, act and go.
- [ ] The gallery's Motion section shows a menu, a popover, a dialog and a toast; the gallery test passes.
- [ ] `pnpm prd browser ui` passes, and `--changed` reports what it named.

### Docs

The overlay motion rule replacing "no animated overlays" (components _Rules_); `Toast`'s `open` (ui-kit _Contracts_).

**Blocked by:** none. **Blocks:** 6 (the same motion rules, and `Sheet`'s backdrop).

---

## Slice 6: A sheet closes the way it opened

Stack: yes · Reads: docs/domain/components.md, docs/domain/ui-kit.md · Tests: component, e2e:roundtrip, e2e:ui

**Items:** B-471 (the rest). **User stories:** 17, 18, 19.

### What to build

`Sheet` plays the reverse of its opening (the sheet slides down and fades, the backdrop fades) before it is gone, however it is closed, with no change to any of its callers:

- **Dismissed** (Close, Escape, a tap outside): the exit plays, then the caller's `onOpenChange(false)` runs.
- **Closed by navigating** (a route sheet's Cancel link, the Back button, a link inside it): `Sheet` holds a navigation that leaves while it is open for the exit's length, then lets it go. Start with a short spike test for the router's blocker on a route sheet, since nothing in the app uses one yet. The router takes one blocker at a time and sheets stack (the repeat sheet opens over the new-todo route sheet; the invite sheets mount `Sheet` while closed), so only an open sheet registers, and only the topmost.
- **What is never held:** a form's submission to the sheet's own action, and a navigation that changes only the search or hash under a sheet that stays open (the filter sheet's chips). Hold only a change of path.
- **After a save:** route sheets save through their action and the form then calls the caller's close, which navigates, so a save takes the same hold. An action that redirects by itself would bypass it and close at once; if one exists, the hand-off names it. A save must never be delayed by more than the exit, lost, or run twice.
- **Reduced motion:** nothing is held or delayed; behaviour is exactly today's.

Its entry moves onto the kit's motion variables. Focus still returns to the opener. A second navigation during the exit must not strand the sheet: the latest one wins.

### Acceptance criteria

- [ ] Component tests (`Sheet` in a routes stub, motion on): Close, Escape and a tap outside each call `onOpenChange(false)` once, after the exit and within about the slow duration plus a frame; the sheet is in the DOM during the exit and gone after.
- [ ] Component tests (a real route sheet on the test device, such as adding a pass): Cancel and Back land on the page under the sheet after the exit; focus returns to the opener.
- [ ] Component test (the same sheet): a save lands on the page with the new row, once (one queued upload), whether or not the exit played.
- [ ] Component test: with reduced motion emulated, each way of closing completes in the next frame and no transition or animation is computed on the sheet or its backdrop.
- [ ] Component test (the filter sheet): tapping a filter chip changes the search, is not delayed, and the sheet stays open.
- [ ] Component test (stacked sheets: the repeat sheet over the new-todo sheet): closing the top one plays its exit and leaves the one under it open; closing that one then navigates after its exit; no router warning about a second blocker is logged.
- [ ] Component test: two closes in a row (Escape, then Back during the exit) end on the right page with the sheet gone.
- [ ] `pnpm prd browser roundtrip` and `ui` pass, and `--changed` reports what it named; a spec changes only where it raced the exit.

### Docs

`Sheet`'s exit and what holds a navigation (ui-kit _Contracts_); whether a save plays the exit.

**Blocked by:** 5. **Blocks:** none.
