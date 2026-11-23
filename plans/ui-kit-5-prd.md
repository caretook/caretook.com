# PRD: UI kit 5 (the last areas swept onto the kit, and the guard closed)

Topic `ui-kit-5`. Backlog item B-577 (finish the UI kit sweep), cut from B-398 by `ui-kit-4`. It follows `ui-kit-4` and `quick-entry-2`, both in `dev`.

## Decisions

| Decision                                                                                                                                                                                                                                                                                       | Why                                                                                                                                               | Source                        | Cost to change later             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------- |
| The sweep keeps what a screen does: same URLs, roles, data, labels and order. Only the markup's source moves to the kit, plus the small look changes the kit brings                                                                                                                            | a sweep that also redesigns can't be reviewed; `ui-kit-4` held the same line                                                                      | assumed                       | low: per area                    |
| Marketing is swept where the kit has the control (calls to action, the public form's fields, its error and the legal draft notice), through the light `ui/plain` entry. Its header and footer links, sizes and headings stay, and `routes/marketing/` stays on the guard's permanent allowlist | B-577 names marketing, but the kit doc says its header and footer links are not `Button`s and that marketing keeps its own page and heading scale | assumed                       | low: one slice's files           |
| `/admin` moves to the kit's controls and keeps its own heading sizes                                                                                                                                                                                                                           | B-398's note: a deliberate narrowing                                                                                                              | preference (carried by B-398) | low                              |
| Text that clamps (`TodayRow`'s Show all, `EntryBody`'s More) keeps its clamp and only takes the kit's text look. `PassLogItem` and `EasyNext` move to `Collapse` and `Chevron`                                                                                                                 | `Collapse` hides its content when closed, which would remove the preview a clamp shows                                                            | assumed                       | low: two components              |
| The Today card's own expander, the kind and author filter links and the day header's button order stay with `fixes-ui` (B-613, B-617, B-618)                                                                                                                                                   | those items already carry the user's specific words for them; doing them here would race or undo them                                             | assumed                       | low: a later slice can take them |
| `Menu`'s `className` becomes outer classes only, and every trigger takes a look. The tool circle is `variant="ghost" size="sm" shape="square"` plus `CIRCLE`, so its classes don't change                                                                                                      | no new prop is needed, and the kit already exports both                                                                                           | assumed                       | low: one component               |
| The guard's not-swept list is deleted, not left empty                                                                                                                                                                                                                                          | an empty list and its checks are dead code once no sweep remains                                                                                  | assumed                       | low: one constant                |
| Slice 1 regroups the not-swept list by owning slice before the others start                                                                                                                                                                                                                    | the list is alphabetical, so parallel slices would delete adjacent lines and conflict                                                             | assumed                       | low: one file                    |
| Easy view's page moves to `Page`'s normal spacing                                                                                                                                                                                                                                              | one container for every `/app` page, the item's "containers"                                                                                      | assumed                       | low: one class                   |

| Seven slices, one over the usual six | account, connectors and marketing were too much to share the closing slice; a follow-on topic would leave the guard's list open after the sweep | assumed | low: slice 7 can become its own topic |

Nothing was asked: no item needs a decision on scope, permissions, data, compliance or a dependency.

**The skeptic pass changed:** the last slice split in two; eight files with raw classes gained an owner; tests that read `.hidden` or a removed class are assigned; `EasyNext` mounts on first open so `Collapse` can animate; the skeleton instruction fits what `Skeleton` can draw; `TodayCard`'s quiet text is swept, leaving only its expander to B-613; the hot row is complete. Nothing was declined.

## Problem

The last screens caretakers use most, the timeline, entries and quick entry, still hand-write the kit's looks, as do admin, account, connectors and the app frame. Controls differ slightly from the rest of the app, some quiet text is harder to read in dark mode, and a fix to a kit control doesn't reach them. The lint guard can't protect these files while they sit on its not-swept list.

## Solution

Move the remaining areas onto the kit, one area per slice, each keeping its behaviour. Then remove `Menu`'s bare class-string trigger and the guard's not-swept list, so every screen outside the permanent allowlist is held to the kit by lint.

## User stories

1. As a caretaker, I want the timeline's list, filters, banners and Today rows to use the kit, so that they look and behave like every other screen.
2. As a caretaker, I want the timeline's add and edit sheets to use the same fields and Cancel and Save footer as other forms, so that logging feels the same everywhere.
3. As a caretaker using Easy view, I want its tiles, next steps and expanders to use the kit, so that the simple screen stays clear and consistent.
4. As a caretaker, I want quick entry's box, cards and suggestions to use the kit, so that they match the page around them.
5. As a caretaker, I want the entry page, its actions and the notes editor's controls to use the kit, so that reading and changing an entry feels familiar.
6. As a staff member, I want the admin pages to use the kit's buttons, fields, badges and messages, so that they are consistent and readable.
7. As a person signing in or joining, I want the account forms to use the kit without a heavier page, so that they stay quick to load.
8. As a member connecting an AI assistant, I want the connector screens to use the kit, so that a consent decision reads clearly.
9. As a visitor, I want the public site's calls to action, form and notices to use the kit's controls, so that they work and read like the app.
10. As a caretaker, I want the app frame, home and new group pages to use the kit, so that the frame around every page is consistent.
11. As a caretaker using dark mode, I want quiet text and links in these areas on the kit's text classes, so that they stay readable.
12. As a caretaker, I want loading and "No … yet." states in these areas to be the kit's, so that waiting and empty screens read the same everywhere.
13. As a caretaker using a keyboard or screen reader, I want swept buttons, menus, expanders and footers to keep their names and focus, so that nothing gets harder to use.
14. As a developer, I want every menu trigger to take a button look, so that no caller writes a class string for one.
15. As a developer, I want the guard to have no not-swept list, so that a hand-written kit class fails lint anywhere outside the permanent allowlist.

## Implementation decisions

- **The kit is the target, not the subject.** A sweep uses the primitives by the "Which to use" list in the ui-kit doc, including what is not a `Button`. A slice adds a primitive only for a pattern repeated across areas, at the end of the append-only files.
- **Each sweep covers:** button and button-like link classes; form control classes; alert, card, list and badge classes; `text-base-content/…` and hand-written link or dark-contrast text; "No … yet." lines; Cancel and Save footers in real forms; section headings; expanders; icon sizes.
- **Containers:** the timeline, Easy view and entry pages move to `Page`, keeping the timeline's wide layout and the entry page's print padding through `className`.
- **Skeletons:** the Today and Easy view loading states use `Loading` or `Skeleton`. `Skeleton` draws only short bars and takes no `data-*`, so a wrapper keeps each region's hook and reserved height.
- **`Collapse`** never sets `hidden`, so its region carries the data hook and tests read `aria-expanded` or `data-open`. `EasyNext`'s list mounts on first open and stays mounted.
- **Light pages:** account, `/connect` and marketing import only from `ui/plain`. If a control they need isn't there, the slice uses the plain equivalent rather than bringing React Aria into their chunk.
- **The public form** keeps its honeypot as a raw hidden input and its submit button's existing `aria-disabled` behaviour.
- **`Menu`:** `className` is always outer classes, and the trigger always goes through `buttonClass`. Each slice moves its own callers to a look; `VitalTypeMenu` takes look props from its two callers. The last slice moves `FilterMenu`, the gallery and the tests, then removes the bare-string branch.
- **The guard:** the last slice deletes `KIT_CLASSES_NOT_SWEPT` and its checks. The rule test that used its first entry as an allowed path uses a permanent allowlist path.
- **Unchanged:** every URL, loader, permission, schema, sync query, service, email and print layout. No migration, no dependency.

## Testing decisions

- **Sweeps** rely on each area's existing component tests, which select by role and name. A test that reads a class it no longer finds moves to role and name. A sweep adds a component test only where a control's behaviour changes shape (an expander moved to `Collapse`, a footer moved to `FormFooter`) and no test covers it.
- **`Menu`** gets a component test that a look and an outer `className` combine on the trigger. The guard's rule tests cover a formerly listed path now failing.
- **Light pages** stay proved by the existing `ui/plain` test.
- **No new browser check.** The specs' class selectors stay valid: the confirm dialog's `.btn-error` and marketing's `header a.btn-primary` are not changed. The orchestrator runs the changed checks at each wave's gate.

## Out of scope

- New looks, print layouts, and new primitives without a repeated pattern.
- B-613, B-617 and B-618, which stay in `fixes-ui`.
- The roughly 20 settings and provider files that still use `text-base-content/…`. B-577 doesn't name them and they carry no kit class, so the guard doesn't flag them.

## Notes

- `onboarding` is running and changes the timeline route, account join and marketing layout. This topic's hot row keeps the dispatcher from starting it beside that work.
- `symptom-catalog`, `tags` and `planner-3` share timeline and entry folders. Sync before each wave.
- `fixes-ui` has no hot row, so its Today card, filter link and day header items can land during this topic. Sync before each wave and keep their changes.
- ESLint has run out of memory on this repo (B-576). This topic adds no type-aware rule.
