# PRD: The UI kit (shared primitives, the pill tab bar, section bands)

Backlog: B-257 (Button), B-258 (form footer), B-259 (messages), B-260 (Card), B-261 (lists), B-262 (empty and loading states), B-263 (page frame), B-264 (DetailHeader), B-265 (Badge), B-266 (check and toggle rows, Field-owned control classes), B-267 (text and icon tokens), B-270 (dev gallery), B-396 (pill tab bar), B-397 (section bands). Topic `ui-kit`. The sweep of every other area, the choice dialog (B-268) and the guard (B-269) are the follow-on topic `ui-kit-2`.

## Decisions

| Decision                                                                                                                                                                                                                                 | Why                                                                                              | Source                                               | Cost to change later                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| This PRD builds the primitives and adopts each in a first place (settings, the shared components, the five detail pages, sign-in); every other area is swept in `ui-kit-2` (B-398), with the choice dialog (B-268) and the guard (B-269) | 16 items and about 270 files don't fit six slices; each slice here still ships something visible | preference (a PRD stays small)                       | low: reorder or merge the topics before they start                               |
| Section bands go on the five detail pages only (profile, medication, provider, care period, to-do); lists, the timeline, settings and admin keep cards on the grey page                                                                  | the user's complaint is long text pages; the smallest place to judge the look                    | assumed (asked; the user said not to ask about this) | medium: a band page drops its cards, so widening or reverting is a per-page edit |
| On a band page the sections alternate `base-200` and `base-100` across the full window width, content held to the page column, and the section cards go (content sits on the band)                                                       | the user's direction on B-397 (bands replace the titled-card base)                               | preference (B-397's note)                            | medium: as above                                                                 |
| No band extras yet: no collapsible sections, sticky section bar, two columns or summary tiles                                                                                                                                            | judge the bands on real pages first; each extra is a small follow-up                             | assumed                                              | low: additive                                                                    |
| One heading scale in `/app`: page title `text-xl`, section and card titles `text-base`, sub-headings `text-sm`, all semibold. Section pages grow from `text-lg`, settings shrink from `text-2xl`, card titles shrink from `text-lg`      | one scale, phone-first; today there are four `h1` sizes and 13 section-heading styles            | assumed                                              | low: three constants                                                             |
| The pill tab bar replaces the `tabs-box` look everywhere `TabNav` is used (medications, Planner) and on sign-in; link form only, no button form                                                                                          | sign-in's two ways in are already links (`?with=`), so nothing switches by state                 | assumed (B-396 allowed either)                       | low: a button form is additive                                                   |
| Two secondary text tones, `text-muted` (today's `/70`) and `text-faint` (the lowest opacity that still clears 4.5:1 on the page in both themes); the other six opacities map onto them                                                   | no rule today for which of eight opacities to use; some fail contrast                            | assumed                                              | low: two utilities                                                               |
| Badges are one size and soft, with six named tones; a status picks its tone from one documented table (current and now: primary; past and stopped: neutral; overdue: danger; due soon: warning; done: success)                           | 25 variants today; the same status has different colours per file                                | assumed                                              | low: one map                                                                     |
| Danger buttons are solid red only in a confirm dialog or a form whose one job is the destructive act; elsewhere a quiet red-text ghost                                                                                                   | today both are used for the same job                                                             | assumed                                              | low: one variant rename                                                          |
| `Field` hands its control the classes (`input w-full`, with the error style); a caller's own `className` still wins, so the 92 existing callers keep working until swept                                                                 | lets the sweep go area by area without a flag day                                                | assumed                                              | low                                                                              |
| The gallery is `/dev/ui`, web only, 404 in production like `/dev/mail`, fictional data, no new dependency                                                                                                                                | B-270                                                                                            | preference (B-270's note)                            | low                                                                              |
| Marketing pages, print sheets and `/admin` keep their own heading sizes and page widths; they adopt Button, messages and Badge only (in `ui-kit-2`). This narrows B-263, which counted admin's titles                                    | different surfaces with their own layouts                                                        | assumed                                              | low                                                                              |
| Seven slices, not six: the profile page gets its own                                                                                                                                                                                     | its folder is bigger than the other four detail pages together                                   | assumed                                              | low                                                                              |

The skeptic pass declined nothing; what it changed is at the end of the plan.

## Problem Statement

Caretook's screens were built area by area, and the same small things are written by hand each time. A review on 2026-11-21 counted 268 button class strings in 81 spellings, 93 hand-written error lines, 24 hand-written cards with four gaps and four title sizes, about 30 lists in six variants, 24 "No … yet." lines in three stylings, 23 page containers, four `h1` sizes, 48 badges in 25 variants, 59 checkboxes and toggles in 15 label wrappers, eight opacities of secondary text and 15 link styles. To a caretaker the app looks slightly different on every screen: a Cancel button moves, an error is a line here and a box there, a "past" badge is grey on one page and outlined on the next.

Two things the user sees directly are also wrong. The tabs (Schedule, List, Passes; the Planner's; sign-in's Password and Email) are a boxed segmented control the user dislikes. And the long detail pages (the profile, a medication, a provider, a care period, a to-do) read as one unbroken block of text.

Nothing shows the kit in one place, so drift is found only by grep.

## Solution

A small kit of primitives in `components/ui/` that own these patterns, each adopted in a first place so it is proven on real screens, plus a dev-only gallery that shows every primitive in both themes.

- **Buttons and form footers** look and sit the same everywhere they're adopted: one Cancel and Save row, one busy label.
- **Messages:** one inline error or status line, one notice box.
- **Cards, lists, empty and loading states, badges, checkbox and toggle rows:** one of each.
- **Tabs become a pill bar:** a fully rounded floating bar; plain text tabs; the current tab a primary-tinted pill, with an optional icon and count. Medications, the Planner and sign-in use it.
- **Pages get a frame:** one page container, one heading scale, the same page header on every section page.
- **Detail pages get bands:** one shared header, then each section as a full-width band with its own background, alternating, so the page reads as parts.

```
┌───────────────────────────────────────────────┐
│  (💊) Metformin 500 mg  [Stopped]    [Edit] ⋯ │  header band
│       Tablet · 1 with breakfast               │
├───────────────────────────────────────────────┤
│  Details                                      │  base-100 band
│  Reason     Type 2 diabetes                   │
│  Prescriber Dr. Okafor                        │
├───────────────────────────────────────────────┤
│  Refills                                      │  base-200 band
│  Next refill 12 Dec                           │
├───────────────────────────────────────────────┤
│  Notes                                        │  base-100 band
│  …                                            │
└───────────────────────────────────────────────┘

   ( Schedule   ( List 12 )   Passes )            the pill tab bar
```

The rest of the app is moved onto the kit area by area in `ui-kit-2`, which ends with a lint guard so it stays that way.

## User Stories

1. As a caretaker, I want buttons of the same kind to look the same on every screen, so that I know what is the main action.
2. As a caretaker, I want a button to show it is working ("Saving…") and not accept a second tap, so that nothing is saved twice.
3. As a caretaker, I want Cancel and Save in the same place and order at the bottom of every form and sheet, so that I don't hunt for them.
4. As a caretaker, I want destructive buttons to look the same wherever they appear, so that I recognise them.
5. As a caretaker, I want an error to appear as the same red line under the thing that failed, so that I know where to look.
6. As a caretaker using a screen reader, I want errors announced at once and "Saved." announced politely, so that I know what happened without looking.
7. As a caretaker, I want important notices (offline, deleted, needs a connection) in the same box with an icon, so that I can tell a notice from ordinary text.
8. As a caretaker, I want cards to have the same title size and spacing, so that screens feel like one product.
9. As a caretaker, I want lists to have the same border, dividers and row height, so that they scan the same way.
10. As a caretaker, I want an empty list to say so in the same quiet line, with a button to add the first one where I'm allowed, so that I know what to do next.
11. As a caretaker, I want a loading placeholder where content is still coming, so that the page doesn't jump.
12. As a caretaker, I want a status badge (Past, Now, Overdue, Stopped) to have the same colour on every page, so that colour means something.
13. As a caretaker, I want every checkbox and switch to have its label beside it, the whole row tappable, and help text under it, so that they're easy to hit on a phone.
14. As a caretaker, I want secondary text to be readable in both themes, so that I can read details in a dim room.
15. As a caretaker, I want links inside text to look the same, so that I can tell what is tappable.
16. As a caretaker, I want the tabs to be a rounded floating bar with the current tab as a tinted pill, so that I can see where I am at a glance.
17. As a caretaker, I want a tab to show a count or an icon where it helps, so that I know what is behind it.
18. As a caretaker on a phone, I want the tab bar to fill the width, and to scroll sideways if the tabs don't fit, so that no tab is cut off.
19. As a caretaker, I want a tapped tab to mark itself at once and work offline, as today.
20. As a keyboard or screen reader user, I want the tab bar to stay a named set of links with the current one announced, as today.
21. As someone signing in, I want Password and Email as the same pill bar, so that sign-in looks like the app.
22. As a caretaker, I want every section page to have its name at the top in the same size, with its actions at the right, so that I know where I am.
23. As a caretaker, I want pages to have the same width and margins, so that moving between them doesn't shift the content.
24. As a caretaker, I want the header of a medication, provider, care period, to-do and the profile to be laid out the same way (icon, name, badges, a details line, actions), so that I find Edit in the same place.
25. As a caretaker, I want a long detail page split into bands with their own background and a heading each, so that I can find a section by scrolling.
26. As a caretaker, I want more space between sections than inside them, so that related lines read together.
27. As a caretaker on a wide screen, I want the bands to span the window while the text stays in a readable column.
28. As a caretaker using dark mode, I want the bands and the pill bar to be as clear as in light mode.
29. As a caretaker printing the medication or emergency sheet, I want it unchanged.
30. As a viewer, I want the same pages with the same sections I can see today; nothing about who sees what changes.
31. As a caretaker offline, I want everything here to work as before; nothing new needs the server.
32. As a settings user, I want the settings pages to keep working exactly as they do, with the kit's buttons, cards, messages and switches.
33. As a developer, I want a Button that takes a variant, a size, a busy state and a link target, so that I never write button classes.
34. As a developer, I want `Field` to style its own control, so that I stop passing `input w-full`.
35. As a developer, I want one page at `/dev/ui` showing every primitive and variant in light and dark, so that I can see drift and pick the right one.
36. As a developer, I want the gallery to be absent from production and the native build.
37. As a developer on a light page (sign-in, marketing), I want the kit's simple primitives without loading React Aria.
38. As a developer, I want named text tones, icon sizes and one inline link style, so that I don't choose an opacity.
39. As a developer, I want the components doc and the layout doc to list the kit and its rules, so that the next slice uses it.

## Implementation Decisions

**The kit.** All new primitives live in `components/ui/`, import nothing from feature folders, take data, labels and callbacks plus at most an outer `className`, and are exported from the `ui` index. Those that use no React Aria (all of the new ones) are also exported from the light entry, so sign-in and the account forms can use them. Styling is daisyUI classes and tokens only.

- **Button:** a variant (primary, default, ghost, danger, quiet danger), a size (medium, small, extra small), full-width, an optional leading icon, a busy state with a busy label (disables the button and swaps the text), and a link form (given a target it renders a look-alike link with the router's options). `IconButton` stays for icon-only buttons and the chip style builds on the same class map.
- **Form footer:** a Cancel (a link or a callback) and a submit Button, right-aligned with one gap and one top padding, plus an optional status slot; a start-aligned form for settings. Settings' `SaveRow` is rebuilt on it and on the message line.
- **Message:** an inline line with a tone (error, success, warning, info). Error is `role="alert"`, the others `role="status"`; it renders nothing visible when empty, so a live region can stay mounted. **Notice:** a box with the same tones, an icon and an optional action.
- **Card:** a surface with an optional title, an optional actions slot and one body gap; with a title it is a `section` named by its heading and keeps the `data-section` hook. `SettingsCard` becomes a thin wrapper.
- **List and row:** one bordered, divided box (`base-300` border and dividers, per the Surfaces rule) and a row with one padding; a row can be a link (the stretched-link pattern the screens use today) and has a trailing slot.
- **Empty state:** a quiet line with an optional action. **Loading:** a skeleton placeholder (a number of lines) and a labelled loading status.
- **Badge:** one size, soft, six tones (neutral, primary, success, warning, danger, info), an optional icon. The status-to-tone table is written in the components doc; features keep their own status labels. `ViaTag` is unchanged.
- **Check and toggle fields:** a native checkbox or switch with its label, optional help and error, the whole row the label, one size. **Field** learns the control's kind (input, select, textarea) and passes the matching classes, with the error style, to its control; a caller's own class still wins.
- **Tokens:** two text utilities (`text-muted`, `text-faint`) in the stylesheet; one inline link style and three icon sizes (small, default, large) as shared constants. The slice measures `text-faint` and records the contrast in the components doc.
- **Page:** the page container (the `main`, one width and padding, a wide variant for the pages that use `max-w-4xl` today) and the heading scale as shared constants. `PageHeader` takes the new page-title size and is used by every section page in `/app`.
- **Bands:** a banded Page variant drops the column from `main`; each **Section** (the page's own part component, not a wrapper, so a part that renders nothing leaves no band) is a full-width band with an inner column, an optional heading (section-title size) and actions, a large gap between bands and a small one inside. Backgrounds alternate from the header down, with a `base-300` rule between bands. No cards inside a band; lists inside keep the List box.
- **Detail header:** icon, tone (primary or muted), title, badges, a details line, and the editors and actions regions, with the regions' `data-region` hooks and each page's existing title hook kept. The five headers become thin callers.
- **Pill tab bar:** `TabNav` keeps its contract (a named `nav` of links, the first claimant gets `aria-current="page"` from the pending navigation, prefetch on render) and gains per-tab `icon`, `count`, `replace` and a `current` override for tabs told apart by a search parameter (sign-in). It is a fully rounded `base-100` bar with a soft shadow (a faint border in dark), evenly spaced medium-weight labels with no boxes, the current tab a primary-tinted pill with primary text, a quiet fill on hover. Full width on phones, fit-to-content from `sm`, sideways scroll when the tabs overflow. Exported from the light entry too.

**First adopters in this PRD** (everything else is `ui-kit-2`):

- Button, form footer, messages, Card, List, the check and toggle fields and Field's control classes: the settings area (account and group settings, `components/settings`), the kit's own internals (the confirm dialog, toast, back link), and sign-in with the account forms' shared card (its error and status messages). The settings frame takes the page container and the heading scale.
- Empty state and Badge: the settings lists (members, invites, devices, assistants).
- Loading: the Google calendar card's "Loading…" text and the first-sync screen.
- Pill tab bar: medications, the Planner, sign-in.
- Page and `PageHeader`: the container and `h1` of the `/app` section and detail pages outside the timeline and entry folders (a mechanical change of the outer element and the title).
- Detail header and bands: the profile, medication, provider, care period and to-do pages.
- Tokens: defined, and used by the kit and the files this PRD already touches. The app-wide replacement of opacities is `ui-kit-2`.

**The gallery.** `/dev/ui`, a web-only route in the dev routes part, refused with a 404 in production by a server check like the dev mailbox's. One section per primitive, each in its own file and listed in a small registry, so slices add a section without editing each other's. Every section shows the variants with fictional data; a control switches the page between light and dark. It also shows the existing primitives (Menu, Sheet, Field, ChipGroup and the rest).

**Docs.** The components doc gains the new primitives, the heading scale, the tones table, the tokens and the band rule (which pages are banded); the layout doc's `ui/` list is brought up to date.

**Unchanged:** every route, URL, loader, permission and who sees what; schema, sync, server and API; print sheets; marketing pages and `/admin` (until `ui-kit-2`); the timeline, entry page and quick entry (until `ui-kit-2`). No migration, no new dependency.

## Testing Decisions

- A good test checks what a user or a caller can observe: roles, names, `aria-current`, `aria-invalid`, disabled-while-busy, focus, that a link goes where it says, that a page still shows its sections. Not class strings, with two exceptions that are the behaviour itself: the alternating band surface and the pill's contrast, checked through computed styles.
- **Primitives:** component tests in a file of its own beside each new primitive, so slices running together don't share one (prior art: the `TabNav`, `Field` and `ConfirmDialog` tests in the kit's primitives test file): Button (busy disables and relabels; the link form is a link; danger variants), form footer (order, Cancel as link and as callback), Message and Notice (roles per tone; empty renders nothing visible), Card (named region with a title), List (a link row), EmptyState (the action), Badge (tones render), check and toggle fields (label click toggles; help and error are described-by), Field's control classes (a caller's class wins), TabNav (the existing tests keep passing; icon, count, `current` override, `replace`; sideways scroll at phone width with many tabs; the current pill's text contrast at least 4.5:1 in both themes), Page and Section (bands alternate in both themes; a heading names the section), DetailHeader (regions; empty regions take no space).
- **Screens:** the existing component tests for settings, sign-in, medications' tabs, the Planner and the five detail pages must keep passing, edited only where markup they select changed. Each detail page gets one test that its sections are named regions in order, for a writer and a viewer.
- **Gallery:** one component test that the route renders a section for every entry in its registry, and one that the production check refuses it (prior art: the dev mailbox).
- **Pure logic** (the Button class map, the tone map): unit tests beside them (prior art: `menuModel`, `filterModel`).
- No integration tests (no services change) and no new browser check; a browser spec that taps a changed tab or button is updated in the slice that changes it.

## Out of Scope

- Sweeping the other areas onto the kit (medications, providers, the Planner and to-dos, the timeline and entries, profile forms, periods, admin, account, connectors, marketing): `ui-kit-2` (B-398). That includes the remaining "No … yet." lines and skeletons, the Cancel and Save footers in sheets, section headings outside the detail pages, home's title, icon sizes and the app-wide text opacities and link styles.
- The three-choice dialog for `SeriesScopeDialog` (B-268) and the lint guard (B-269): `ui-kit-2`.
- Band extras: collapsible sections, a sticky section bar, two columns, summary tiles.
- Bands on lists, the timeline, settings or admin.
- New colours or a theme change beyond the existing surface tokens; a new icon set; any new dependency.
- Translating the kit's strings (the `i18n` PRD; callers pass every label, so the kit holds no text of its own).

## Further Notes

- **Order with other PRDs:** `list-filters` and `planner-2` are in `dev`. Not beside `i18n` (it runs alone and edits every screen's text). `simple-mode` and `quick-fixes` can run beside it: this PRD edits no file in the timeline or entry folders. `test-health` waves 5 to 7 wait for `ui-kit` and `ui-kit-2`.
- **Why first adopters, not a full sweep:** each primitive's contract is proven on real screens (settings covers buttons, cards, lists, switches and messages in ten files) before 200 more files depend on it.
- **Skeptic pass (2026-11-21):** see the plan's _Skeptic pass_ note for what changed.
- **The light entry** gets an import test so it can't pick up React Aria, since this PRD adds most of the kit to it.
