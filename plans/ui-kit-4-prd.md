# PRD: UI kit 4 (the kit's guard, and the care-record areas swept onto it)

Topic `ui-kit-4`. Backlog items B-269, B-398 (its first four areas), B-448. It follows `ui-kit-3` (in `dev`). The rest of B-398 moves to the follow-on topic `ui-kit-5`.

## Decisions

| Decision                                                                                                                                                                                                                                            | Why                                                                                                                                                         | Source                         | Cost to change later                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| B-398's sweep is cut in two: this topic takes medications; providers and care periods; the profile; the Planner, to-dos and search. `ui-kit-5` takes the timeline, entries and quick entry; admin, account, connectors, marketing and the app frame | about 300 files need changes, too many for six slices; the timeline and quick entry are the largest area and `quick-entry-2` is running there               | preference (a PRD stays small) | medium: moving an area between topics before it starts is a docs edit |
| The guard comes first, with a list of areas not swept yet; each sweep deletes its own line, and `ui-kit-5` empties the list                                                                                                                         | every sweep is then proved by lint and can't regress once done. The earlier note put the guard last, which would leave swept areas unguarded for two topics | assumed                        | medium: the rule stays either way, only its order changes             |
| The guard is a local ESLint rule plus a restricted import, not a layout test                                                                                                                                                                        | the repo already has a local rule plugin with tests, and lint reports the exact line; no dependency                                                         | assumed                        | low: one rule                                                         |
| Permanently allowed raw classes: `ui/`, marketing, the printed sheets (named exactly, so on-screen controls beside them such as the week picker and print menu stay guarded) and the `/dev/ui` gallery                                              | B-269's note names marketing and print; the gallery shows raw looks on purpose                                                                              | assumed                        | low: one list                                                         |
| The guard flags `btn`, `card`, `badge` and `alert` classes wherever a class string can sit (maps and defaults too), but a lone word such as `role="alert"` or an id `"card"` only inside a `className`                                              | B-269's words: real class strings live in object maps, and data must not false-alarm                                                                        | assumed                        | low: one rule                                                         |
| The sweep keeps what a screen does: same URLs, roles, data, labels and order. Only the markup's source moves to the kit, plus the small look changes the kit brings                                                                                 | a sweep that also redesigns can't be reviewed                                                                                                               | assumed                        | low: per area                                                         |
| Profile names become `*Section`: `BasicsSection`, `NoteSection`, `ConditionsSection`, `VitalAveragesSection`, `ContactSection`, `InsuranceSection`, `EmergencySection`, in `ProfileSections` and `DetailsSections`                                  | they render a `Section` band, the kit's word                                                                                                                | assumed                        | low: a rename                                                         |
| `Menu`'s bare class-string trigger stays until `ui-kit-5`                                                                                                                                                                                           | callers in unswept areas still use it; each sweep moves its own                                                                                             | assumed                        | low                                                                   |

Nothing was asked: no item needs a decision on scope, permissions, data, compliance or a dependency.

**The skeptic pass changed:** the guard's matching and print paths; `TodayRow`, `PassLogItem`, `EasyNext` (once `SimpleNext`) and `EntryBody` moved to `ui-kit-5`, whose folders hold them; `PassCard` keeps its interface for its timeline and quick-entry consumers; the "not swept yet" list is grouped by slice to avoid merge conflicts; the hot row narrowed to this topic's folders; `ui-kit-5` gets its own backlog item. Nothing was declined.

## Problem

The kit exists, but most care screens still hand-write its looks. A caretaker sees small differences between the same control on different pages, some quiet text is harder to read in dark mode, and a fix to a kit control doesn't reach those screens. Nothing stops new code from drifting again, because the kit's rules are held by review alone.

## Solution

Add a lint guard that keeps React Aria inside the kit and flags hand-written kit classes, with a shrinking list of areas not swept yet. Then move medications, providers, care periods, the profile, the Planner, to-dos and search onto the kit, one area per slice. Each screen keeps its behaviour and gains the kit's buttons, fields, messages, empty lines, expanders and readable text.

## User stories

1. As a developer, I want a React Aria import outside the kit to fail lint, so that the kit stays the only place that owns it.
2. As a developer, I want a hand-written `btn`, `card`, `badge` or `alert` class in a swept area to fail lint at its line, so that the area stays swept.
3. As a developer, I want marketing, print sheets and the gallery allowed, so that the guard only flags real drift.
4. As an orchestrator, I want one visible list of areas not swept yet, so that the remaining work is plain and each sweep proves itself.
5. As a caretaker, I want medication screens to use the same buttons, fields, badges and messages as the rest of the app, so that they behave and read alike.
6. As a caretaker, I want provider and care period screens to use the kit too, so that lists, forms and empty lines look the same.
7. As a caretaker, I want the profile's forms and sections to use the kit, so that editing a profile feels like editing anything else.
8. As a developer, I want the profile's `*Card` parts named for what they render, so that the code doesn't describe cards that no longer exist.
9. As a caretaker, I want the Planner, to-dos and search to use the kit, so that the daily screens are consistent.
10. As a caretaker using dark mode, I want quiet text and links in these areas on the kit's text classes, so that they stay readable.
11. As a caretaker, I want every "No … yet." line in these areas to be the same empty state, so that an empty list reads the same everywhere.
12. As a caretaker using a keyboard or screen reader, I want swept buttons, expanders and form footers to keep their names and focus, so that nothing gets harder to use.

## Implementation decisions

- **The guard** is a new rule in the local ESLint plugin and a restricted-import rule, on the web app's non-test source. It matches whole class tokens. `btn` and any `btn-*`, `badge-*`, `card-*` or `alert-*` modifier is flagged in any string or template, which covers object maps, constants and default parameters. A bare `card`, `badge` or `alert` is flagged only inside a `className` value or a string of several tokens, so `role="alert"` and a data id `"card"` pass. The restricted import covers `react-aria-components`, `react-aria`, `react-stately`, `@react-aria/*` and `@react-stately/*`, not `@internationalized/date`, which app code uses directly. Its permanent allowlist and its "not swept yet" list are kept apart; the second has one path per line, grouped by owning slice, so parallel sweeps delete lines without conflicting.
- **The kit is the target, not the subject.** A sweep uses `Button`, `Field`, `CheckField`, `ToggleField`, `Card`, `List`, `Badge`, `Message`, `Notice`, `EmptyState`, `Loading`, `FormFooter`, `BackLink`, `Chevron`, `Collapse`, `Menu`'s trigger look, the heading constants and the text tokens, by the "Which to use" list in the ui-kit doc, including its list of what is not a `Button`. A slice adds a primitive only for a pattern repeated across areas, at the end of the append-only files.
- **Each sweep covers:** button and button-like link classes; form control classes; alert, card, list and badge classes; `text-base-content/…` and hand-written link or dark-contrast text; "No … yet." lines; Cancel and Save footers in sheets; section headings; expanders; icon sizes.
- **Expanders named by B-398:** `PassCard` and the medication form's details move to `Chevron` and `Collapse` here. `TodayRow`, `PassLogItem`, `EasyNext` and `EntryBody` live in the timeline and entry folders, so they are `ui-kit-5`'s.
- **Printed sheets stay,** with one exception B-398 names: `MedicationSheet`'s local empty line becomes an `EmptyState`, with its printed text unchanged.
- **Shared parts** are swept by the area that owns their folder; other areas only consume them, and a shared part keeps its props. `PassCard` is used by the timeline and quick entry, and `components/contact` by the profile.
- **Unchanged:** every URL, loader, permission, schema, sync query, service, email and print layout. No migration, no dependency.

## Testing decisions

- **The guard** gets rule tests beside the existing local rules: flagged and allowed snippets, modifiers, conditionals, constants, `role="alert"`, the allowlist and the remaining list.
- **Sweeps** rely on the area's existing component tests, which select by role and name. A test that reads a class it no longer finds moves to role and name. A sweep adds a component test only where a control's behaviour changes shape (an expander moved to `Collapse`, a footer moved to `FormFooter`) and no test covers it.
- **No new browser check.** The orchestrator runs the changed checks at each wave's gate.

## Out of scope

- The timeline, entries, quick entry, admin, account, connectors, marketing and the app frame (`ui-kit-5`).
- Removing `Menu`'s bare class string and emptying the guard's list (`ui-kit-5`).
- New looks, new primitives without a repeated pattern, print layouts.

## Notes

- `fixes-ui` holds hot files in the Planner, providers and one medication row, so the dispatcher won't start this topic beside a running `fixes-ui` topic. `tags`, `calendars-2` and `planner-3` also share swept folders. Sync before each wave.
- ESLint has run out of memory on this repo (B-576). The new rule is syntactic and needs no type information.
