# PRD: UI kit 2 (one Button, the header's add button, medication tabs, a typeface, motion, the choice dialog)

Topic `ui-kit-2`. Backlog items B-423, B-420, B-419, B-424, B-415, B-414, B-268. It follows `ui-kit` (in `dev`). The area sweeps (B-398), the guard (B-269) and the profile renames (B-448) move to the follow-on topic `ui-kit-3`.

## Decisions

Nothing was asked: every choice below is look, layout or module shape, which the planner handbook and the standing preferences say to decide and list. The costliest to change come first.

| Decision                                                                                                                                                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                                                | Source                         | Cost to change later                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| The sweep of the remaining areas (B-398), the guard (B-269) and the profile `*Card` renames (B-448) move to `ui-kit-3`, after this topic                                                                                                                                                                                                                                                               | six slices here already; the sweep should copy the final `Button`, header and motion contracts once, not twice                                                                                                                     | preference (a PRD stays small) | low: a row and three items move back                                                                 |
| The typeface is **Atkinson Hyperlegible Next** (variable, SIL OFL), one family for the whole site (app, marketing, `/admin`, print), over the system stack; code keeps `ui-monospace`                                                                                                                                                                                                                  | made for telling letters and numbers apart (`I`, `l`, `1`; `O`, `0`), which matters for medication names and doses, and a current design; the system font on Apple devices already looks like Inter, so Inter would change nothing | assumed                        | low: one `--font-sans` line and the files in one folder; the gallery's Type section shows the result |
| The font files are vendored `woff2` files served from our own origin (with the licence beside them), not an npm package and not a font CDN                                                                                                                                                                                                                                                             | no new dependency, no third party sees a request, the CSP (`font-src 'self'`) needs no change                                                                                                                                      | assumed                        | low: swap the files for a package later                                                              |
| `Button` is the one button component. Tones `primary`, `secondary`, `ghost`, `danger`, `dangerQuiet`; sizes `lg`, `md`, `sm`, `xs`; shapes `rounded` (the default), `pill`, `square`, `round`; content text, icon and text, or icon only                                                                                                                                                               | B-423's own list (tone, size, variant, shape); `lg` and the shapes are new, `secondary` renames `default` (only the kit's own chip style names it)                                                                                 | assumed                        | low: props on one component                                                                          |
| `IconButton` stays as a short name for the icon-only `Button` (it renders `Button`); its callers don't change                                                                                                                                                                                                                                                                                          | "one design component" is one implementation and one look; renaming 13 callers adds churn the sweep would repeat                                                                                                                   | assumed                        | low: a codemod                                                                                       |
| **What is not a `Button`:** the app header's and the bottom bar's navigation; marketing's header and footer links; expand and collapse toggles; hamburger and ⋯ menu triggers (they take the same look through `Menu`); inline text links; tabs; chips; whole-row links in lists; menu items; form controls (checkboxes, switches, radios, the todo and dose tick); the date picker's insides; avatars | B-423 names the first four and asks for other exceptions; these are the controls that are not buttons in any design system                                                                                                         | assumed                        | low: per control, in the sweep                                                                       |
| Every main page's add control is one primary, icon-only `+` at the top right of its header (`PageHeader`'s `add`), named by its label ("Add provider") as tooltip and accessible name; other header actions sit to its left                                                                                                                                                                            | B-420's words                                                                                                                                                                                                                      | assumed                        | low: one prop                                                                                        |
| The `+` is on Providers, the Planner and Todos (a menu: Appointment, Todo), Care periods and Medications. The timeline keeps its per-day `+` (it adds on that day); Search, home and settings have nothing to add                                                                                                                                                                                      | the pages that have an add today                                                                                                                                                                                                   | assumed                        | low                                                                                                  |
| Providers: Import becomes an icon-only `secondary` button left of the `+`, the same size, named "Import from another group"                                                                                                                                                                                                                                                                            | B-419's words                                                                                                                                                                                                                      | assumed                        | low                                                                                                  |
| Medications: Passes is a third tab (Schedule, Medications, Passes) at the same URL; the header's Passes link, the passes page's back link, title and "Add pass" button go; its one-line description stays at the top of the tab                                                                                                                                                                        | B-424's words; the URL stays so links and bookmarks keep working                                                                                                                                                                   | assumed                        | low: tab order or labels are one array                                                               |
| Medications: the `+` is a menu with Medication and Pass. Pass opens the add-pass sheet on the Passes tab; it is left out once the group has its 8 passes (as the button is today). Print stays, left of the `+`                                                                                                                                                                                        | B-424: "a dropdown with add selection like other pages"                                                                                                                                                                            | assumed                        | low                                                                                                  |
| Motion is short and quiet: 120 to 240 ms, ease-out, fades and small slides only, no bounce, and none at all under "reduce motion"                                                                                                                                                                                                                                                                      | "be classy about it"                                                                                                                                                                                                               | assumed                        | low: three variables in `app.css`                                                                    |
| What moves here: buttons and list rows on hover and press; every expand chevron; expanding regions, which open and close with a height slide (`Collapse`). Menus, popovers, dialogs, toasts and a sheet's close are B-471, in `ui-kit-3`                                                                                                                                                               | B-414's own examples (actions, hovers, the chevrons, the search toggle); overlays aren't among them, and a sheet closes by navigating away, so its exit is real work                                                               | assumed                        | low: per primitive                                                                                   |
| In this topic `Collapse` and the chevron are adopted where B-414 points: the timeline's day summary and its search toggle (the Today header is the reference). The other expanders adopt them in the `ui-kit-3` sweep of their areas                                                                                                                                                                   | keeps this topic's files few; the timeline is busy with other work                                                                                                                                                                 | assumed                        | low                                                                                                  |
| The three-choice dialog is a kit primitive, `ChoiceDialog`: a title, a message, up to three stacked choices and Cancel; each choice in one of `Button`'s tones (the first solid primary or danger, the others `secondary` or `dangerQuiet`)                                                                                                                                                            | B-268; close to the two dialogs it replaces, with no button look the kit lacks                                                                                                                                                     | assumed                        | low                                                                                                  |
| `ChoiceDialog` also replaces the repeating todo's delete dialog (`RepeatDeleteDialog`), the second raw `<dialog>` found outside the kit                                                                                                                                                                                                                                                                | same pattern, same missing rules; B-268's note thought there was one                                                                                                                                                               | assumed                        | low                                                                                                  |

**The skeptic pass** (one fresh agent, before landing) found nothing that needed asking. It changed: slices 3, 4 and 6 get a stack and name their browser checks; overlay motion and the sheet's exit left this topic (slice 5 was too big, and sheets close by navigating); the font files are referenced from CSS so the build hashes them, and the service worker's list learns the file type; the pass sheet's URL gets guards for viewers and a full group; reduced motion is emulated from the test's own file; B-398 now carries the adoption of `Button` across the app. Declined: giving slices 1, 2 and 5 a stack for the `ui` check (as in `ui-kit`, the orchestrator runs it at the wave gate).

## Problem

The kit has a `Button`, but a caretaker still sees several button looks: text buttons from the kit, hand-written ones, a separate icon button. Each main page puts its add control somewhere different and words it differently: "Add provider" as a text button, a square `+` on Medications, an "Add" menu on the Planner, and a wordy "Import from another group" beside it. Medications hides its passes behind a header link that only shows on one tab. The app uses whatever font the device has, so it looks generic. Some things animate (the Today header's chevron) and their neighbours don't (the day summary, the search toggle), which reads as unfinished. And two dialogs that ask a three-way question are built by hand, so they skip the kit's rules for focus and for opening after a menu closes.

## Solution

One `Button` for every button and button-like link, with named tones, sizes and shapes. Every main page has the same add control in the same place: a `+` at the top right, with the page's other actions to its left. Medications gets Passes as a tab beside Schedule and Medications. The whole site takes one modern, highly legible typeface, served from our own origin. Motion is added once, in the kit, so buttons, rows, chevrons and expanding regions all move the same quiet way, and not at all for people who ask for reduced motion. Three-way questions use one kit dialog.

The rest of the app is moved onto the kit in `ui-kit-3`, which ends with a guard so it stays that way.

## User stories

1. As a caretaker, I want every button to look and behave the same way, so that I know what is pressable and what is the main action.
2. As a caretaker, I want destructive buttons to look destructive everywhere, so that I don't press one by mistake.
3. As a caretaker using a keyboard or a screen reader, I want an icon-only button to have a name and a tooltip, so that I know what it does.
4. As a developer, I want one `Button` with tone, size, shape and icon options, so that I never write button classes by hand.
5. As a developer, I want a menu's trigger to take the same look options, so that a menu button matches the buttons beside it.
6. As a caretaker, I want the add control in the same place on every main page (a `+` at the top right), so that I don't hunt for it.
7. As a caretaker, I want a page's other actions to sit left of the `+`, so that the main action is always last and easiest to reach.
8. As a caretaker on the Providers page, I want Import to be a small icon button beside the `+`, so that a rarely used action doesn't crowd the header.
9. As a caretaker on the Planner, I want the `+` to offer Appointment and Todo, as today.
10. As a caretaker on Care periods, I want the same `+` to add a period.
11. As a viewer (no write access), I want no add control, as today.
12. As a caretaker, I want Passes as a tab on Medications, so that I can find and edit the rounds without leaving the page or knowing which tab shows the link.
13. As a caretaker on Medications, I want the `+` to offer Medication and Pass, so that adding either starts in the same place.
14. As a caretaker with links or bookmarks to the passes page, I want them to keep working.
15. As a caretaker, I want the app in a clear, modern typeface in which similar letters and numbers look different, so that medication names and doses are easy to read.
16. As a caretaker offline, I want the same typeface, so that the app doesn't change its look when the connection drops.
17. As a caretaker, I want no font request to leave Caretook's own servers, so that no third party learns I use the app.
18. As a caretaker, I want buttons and rows to respond to hover and press with a small, quick change, so that the app feels responsive.
19. As a caretaker, I want every expanding region to open and close the same way, with its chevron turning, so that nothing jumps.
20. As a caretaker, I want the timeline's day summary and its search box to animate like the Today header does.
21. As a caretaker who has asked the device to reduce motion, I want no animation at all.
22. As a caretaker changing or deleting a repeating visit or todo, I want the question to behave like every other dialog (it opens after the menu closes, Escape cancels, focus returns to where I was).
23. As a developer, I want a kit dialog for a question with two or three answers, so that I don't write a `<dialog>` by hand.
24. As a developer, I want each new or changed primitive in the gallery (`/dev/ui`) in both themes, so that I can see it without finding a screen that uses it.

## Implementation decisions

### Button

- **One component.** `Button`'s props: `variant` (`primary`, `secondary`, `ghost`, `danger`, `dangerQuiet`; `secondary` is the default and replaces the name `default`), `size` (`lg`, `md`, `sm`, `xs`), `shape` (`rounded`, `pill`, `square`, `round`), `block`, `icon`, `busy` with `busyLabel`, and the link forms `to` and `href` it has today.
- **Icon only:** an `icon`, a required `label` and no children. `label` is the accessible name and the tooltip; the box is `square` unless `round` is asked for. It also takes what `IconButton` takes today: `pressed` (a toggle), `expanded` and `controls` (a disclosure), `ref`.
- `IconButton` stays exported and renders `Button`; its props and callers don't change.
- The class map stays the pure `buttonClass`, with `lg`, `pill` and `rounded` added; chips, the tool circle and the date field keep building on it.
- **`Menu`'s trigger** takes a look (`variant`, `size`, `shape`) and builds its classes through `buttonClass`; passing a class string still works until `ui-kit-3` has moved the remaining menus.
- The rule on solid `danger` (only in a confirm or a form whose one job is the destructive act) stays.

### The header's add button

- `PageHeader` takes `add`: a label and one of a link (`to`, with `state` and `data-*`), a callback, or menu items (the kit's menu model). It renders the primary, icon-only `+` (`sm`) as the last control at the top right; `actions` render to its left. The label is the name and the tooltip.
- The page decides whether to pass `add` (writers only), as it decides its actions today.
- Each page keeps its `data-*` hook on the control (`data-add-provider`, `data-import-providers`, `data-add-period`, `data-add-medication`), so tests and checks keep selecting it.

### Medications

- The passes page becomes the third tab of the Medications frame at the same URL; the frame's tab helper learns `passes`. The frame's header (title, Print, `+`) is shared by the three tabs.
- The add-pass sheet becomes a sheet route under the Passes tab, like the other tabs' sheets, so the header's menu can open it from any tab. Opened directly by a viewer, or when the group has 8 passes, it goes back to the tab (as the add-medication sheet guards itself). The frame reads the live pass count for its menu. Editing a pass stays as it is.
- The `+` menu: Medication (the add sheet over the current tab; from the Passes tab, over the list) and Pass (only while the group has fewer than 8 passes).
- No change to passes themselves: schema, service, sync and permissions are untouched.

### The typeface

- One family, loaded with `@font-face` from files kept in the web app's source and referenced from its CSS, so the build gives them hashed names; `font-display: swap`; the upright file preloaded on the document by its built URL. The files come from the family's official release (the Braille Institute's, on Google Fonts' GitHub), with the version noted beside them. `--font-sans` in the theme names it first, then the system stack that is there today.
- The service worker's install list (today scripts and styles only) also takes the font files, so the offline shell has them and a changed font makes a new worker version; the native build bundles them like any asset.
- The SIL OFL licence file sits beside the font files.
- Emails, the logo and the marketing screenshots are untouched.

### Motion

- Three durations and one easing as CSS variables in `app.css`; every rule that uses them sits under `prefers-reduced-motion: no-preference`.
- The kit's primitives take them: `Button` (hover, press) and `ListRow` (hover). Overlays (`Menu`, `Popover`, the dialogs, `Toast`, a `Sheet`'s close) are not in this topic.
- Two new primitives: `Chevron` (the one turning chevron, open or closed) and `Collapse` (a region that slides open and closed; closed content is out of the accessibility tree and not focusable). `Menu`'s groups use `Chevron`.
- Adopted in the timeline's day summary and search toggle; the Today header moves to `Chevron` so the three match.

### The choice dialog

- `ChoiceDialog`: `open`, `title`, `message`, up to three `choices` (an id, a label, a tone, `data-*`), `cancelLabel`, `onChoose(id)`, `onClose`. It is built on `useShowModal` like `ConfirmDialog` and follows its rules: it waits for an open menu to close, Escape closes only the dialog, focus returns to the opener. No React Aria, so it is in `ui/plain` too.
- The series question (appointments) and the repeating todo's delete question become callers that pass their words and choices; their own `data-*` hooks stay.

### Unchanged

Routes other than the passes tab and its sheet; URLs that exist today; loaders, permissions, schema, sync, the server; print sheets' layout; emails.

## Testing decisions

- A good test here reads what a caretaker gets: a role, a name, a state, a link's target. It doesn't assert class strings, except in the one pure class map.
- **Unit:** `buttonClass` (the new size and shapes; prior art `buttonClass.test.ts`); the service worker's install list includes the font files (prior art `service-worker.test.mjs` and the manifest's test); the medications tab helper; the frozen route and URL lists gain the pass sheet.
- **Component** (Vitest browser mode; prior art `Button.browser.test.tsx`, `tabs.browser.test.tsx`, `providers.browser.test.tsx`, `planner.browser.test.tsx`, `periods.browser.test.tsx`): each new or changed primitive in its own file beside it; each page's header (the `+` is last, named, and opens what it should; viewers get none); the three medication tabs and the `+` menu; the two dialogs through their screens; the computed `font-family` on an app page; `Collapse` open, closed and with reduced motion.
- **No new end-to-end steps:** nothing here adds a flow across the server or sync, and no browser check selects the controls that change. Three slices run the checks their files map to: `first-sync` and `layout-offline` (the medications routes, the font in the offline shell) and `roundtrip` (the series question).

## Out of scope

- Moving the rest of the app onto the kit, which includes using `Button` for every remaining button (B-398 carries that part of B-423), the lint guard (B-269) and the profile renames (B-448): `ui-kit-3`.
- Motion for menus, popovers, dialogs and toasts, and a sheet's closing animation: B-471, in `ui-kit-3`.
- The timeline's per-day `+` and quick entry.
- New colours, a new theme, new icons, a new spacing scale.
- Page transitions between routes, skeleton shimmer, drag and drop.
- A font picker or a text-size setting.

## Notes

- **Order:** `ui-kit-3` (the sweeps) starts after this topic, so the sweeps copy the final contracts. It still runs before `test-health`'s waves 5 to 7, which edit the same screens' tests.
- **The font's risk** is width: a wider face can wrap a header or a tab. Slice 4 checks the tab bars, the bottom bar and the page headers at 320 and 420 px.
