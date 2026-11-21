# PRD: Timeline UX 2 (declutter)

> Topic `timeline-ux-2`. Backlog items B-214, B-218, B-223. Plan: [`timeline-ux-2-plan.md`](timeline-ux-2-plan.md).

## Problem Statement

The app keeps telling caretakers whose care group they're in. The header's group menu names the recipient on every group route. The Providers, Medications, Upcoming and Tasks pages repeat that name under their titles. The timeline opens with a large profile card: avatar, name, group, age and code status. On a phone, that's a screen's worth of header before the first useful thing.

Smaller things add to the clutter:

- The timeline's View options button (the eye) sits alone in the header's corner, far from the search and Filter controls it belongs with, and it's a different size and shape from them.
- The day summary's expand chevron is at the far right of the line, away from where people read and tap.
- The group menu has a care-period line ("Now: In hospital · day 4") that repeats what the day headers show. "New care group" sits at the bottom, under the group's own pages. "Group settings" isn't last.

## Solution

- **Page headers name the page, not the recipient.** Providers, Medications, Upcoming and Tasks show their title and actions only, with no subtitle. The viewer notes ("You can view this list / directory / timeline") go too: the missing Add buttons already show that a page is read-only. Printed sheets keep the recipient's name.
- **The timeline loses its profile card.** It gets a plain "Timeline" heading like the other sections. Age and code status live on the profile (and the emergency sheet). The profile stays one tap away in the group menu.
- **One toolbar.** Search, Filter and View options (the eye) share one row: search and Filter on the left, the eye pushed to the right end. All three are the same outlined icon-only circle. Filter shows how many filters are on as a badge.
- **The day summary's chevron is on the left.** It points right when closed and down when open, and the expanded lines indent to line up with the summary text.
- **The group menu is reordered.** The groups (the current one checked), then "New care group", a separator, "<Name>'s profile", "Care periods", and "Group settings" last. The care-period line is gone. The trigger keeps the current period's type icon.
- The simple view is unchanged: its header is the only place that names the recipient there, since simple mode drops the group menu.

## User Stories

1. As a caretaker on the Providers page, I want the header to show just "Providers" and its actions, so that the list starts higher on my phone.
2. As a caretaker on the Medications page, I want no recipient name under the title, so that I'm not told whose medications these are on every visit.
3. As a caretaker on the Upcoming page, I want the header to show just "Upcoming" and its add buttons, so that the next appointment is closer to the top.
4. As a caretaker on the Tasks page, I want the header to show just "Tasks" and "New task", so that the list has more room.
5. As a viewer, I want the pages to look the same as for writers without the add buttons, so that I don't need a note telling me I can only view.
6. As a caretaker printing a medication list, weekly chart or emergency sheet, I want the recipient's name and details still on the page, so that the paper is useful to a doctor or a sitter.
7. As a caretaker opening the timeline, I want a small "Timeline" heading instead of a large profile card, so that the Today card and the entries come first.
8. As a caretaker who wants the recipient's profile, I want it in the group menu, so that it's one tap away without a card on every timeline visit.
9. As a caretaker who checks the recipient's age or code status, I want them on the profile and the emergency sheet, so that they're where I'd look for them.
10. As a caretaker, I want search, Filter and View options in one row, so that every control over what the timeline shows is in one place.
11. As a caretaker, I want the three controls to be the same size and shape, so that the row looks tidy and each is easy to hit.
12. As a caretaker with filters on, I want Filter's badge to show how many there are, so that I can tell at a glance that the list is filtered.
13. As a screen-reader user, I want Filter to be named with its count ("Filter, 2 on"), so that I hear the same thing the badge shows.
14. As a caretaker searching on a phone, I want the open search field to take the room between the magnifier and the eye, so that I can see what I'm typing.
15. As a caretaker, I want the eye at the right end of the row, so that it stays put whether or not search is open.
16. As a caretaker reading a day header, I want the day summary's chevron on the left, so that it reads like a disclosure and sits under my thumb.
17. As a caretaker, I want the chevron to turn down when the summary is open, so that I can see it's expanded.
18. As a caretaker, I want the expanded summary lines to line up with the summary text, so that the breakdown reads as one block.
19. As a caretaker in several care groups, I want "New care group" right under the list of groups, so that it sits with the groups it adds to.
20. As a caretaker, I want "Group settings" last in the group menu, so that it's in a predictable place at the bottom.
21. As a caretaker during a care period, I want the menu to drop the "Now: …" line, so that the menu is just groups and places to go; the day headers already show the period.
22. As a caretaker during a care period, I want the trigger's period icon kept, so that the header still shows a period is on.
23. As a caretaker in simple mode, I want my simple header unchanged, so that I still see whose timeline this is.

## Implementation Decisions

- **A new `PageHeader` primitive in `components/ui/`**, exported from its index: a page's `h1` title with an optional actions slot (any node the page passes, such as a link, a button group or a menu), laid out as today's headers are: title on the left, actions on the right, aligned to the top, wrapping on narrow screens. Its outer `className` is the only styling hook (the components doc's rule). Providers, Medications, Upcoming (`UpcomingHeader` wraps it) and Tasks use it. The timeline's full view uses it with "Timeline" as the title. Detail headers (provider, medication, task, period, profile, entry) aren't in scope; they can move to it later.
- **No subtitles.** The four pages drop the `group.displayName` line and the viewer notes. Upcoming's filters, below its header, stay where they are.
- **The timeline header.** `RecipientCard` is deleted. `TimelineHeader` becomes the `PageHeader` with "Timeline" and no actions: View options moves to the toolbar. The profile test's check that the card links to the profile moves to the group menu's profile item.
- **The toolbar.** `FilterChips` (shared by the full and simple views) takes an optional trailing node rendered at the right end of its control row (`ml-auto`). The full view passes `TimelineViewMenu` there. The simple view passes nothing, so View options stays out of it as today. The magnifier, Filter and the eye's trigger share one outlined icon-only circle style. Filter becomes icon-only, its count in a small badge on the circle, named "Filter" or "Filter, N on". It keeps `data-filter-button` and `aria-haspopup="dialog"`, and the eye keeps the name "View options", so the browser checks' selectors still match. The open search field grows to fill the room between Filter and the eye.
- **Day summary.** `DaySummaryLine`'s chevron comes before the summary text inside the same disclosure button. It's `ChevronRight` turned 90° when expanded, as now. The expanded list gets a left indent equal to the chevron plus its gap. Nothing else changes: the accessible name, the modes and `summariesOff`.
- **The group menu.** `GroupMenu`'s items, in order: the groups section (selection as now), the "New care group" link (`NEW_GROUP_LINK_STATE`), `SEPARATOR`, "<Name>'s profile" (only with a recipient), "Care periods", "Group settings". The `period-now` item and its imports go. The trigger's period icon and label ("<Name>, <period>: switch care group") stay. `menuNowText` stays where other callers use it, and is deleted if `GroupMenu` was its last caller.
- No schema, sync, API or migration changes. No new dependencies.
- At landing, the [app-shell](../docs/domain/app-shell.md) doc's `GroupMenu` line and the [timeline](../docs/domain/timeline.md) doc's header lines (the recipient card, View options, the day summary's chevron) are updated, and `PageHeader` joins the [components](../docs/domain/components.md) list of `ui/` primitives.

## Testing Decisions

- Good tests check what a person sees and can do (headings, names, order, what a tap opens), never class names or the component tree.
- **Component tests only**, in the touched screens' existing `*.browser.test.tsx` files:
  - Providers, Medications, Upcoming, Tasks: the `h1` is the page's name, and the recipient's name and the viewer note aren't in the header, for a writer and a viewer.
  - `PageHeader`: title and actions render, in `components/ui/inScreens.browser.test.tsx` (as the screens use it).
  - Timeline header: the `h1` is "Timeline"; there's no profile link in `main`; View options is in the filter row after Filter; Filter is named "Filter, N on" with filters on; the simple view's toolbar has no View options.
  - Profile: the group menu's profile item opens the profile (replacing the card test).
  - Day summaries: the chevron comes before the text in the button, and `aria-expanded` and the lines toggle as before.
  - Group menu: the items come in the new order, there's no "Now: …" item during a period, and the trigger still shows the period icon.
- **No unit tests**: no new pure logic. **No e2e changes**: the browser checks select by names and attributes that stay (`View options`, `data-filter-button`), and nothing crosses the server or sync. The orchestrator's landing checks cover `app-shell`, `layout-offline` and `phase2` as usual.
- Prior art: `timelineHeader.browser.test.tsx`, `timelineSummaries.browser.test.tsx`, `groupMenuPeriod.browser.test.tsx`, `frame.browser.test.tsx`, `providers.browser.test.tsx`, `medicationList.browser.test.tsx`, `upcoming.browser.test.tsx`, `tasks.browser.test.tsx`, `profile.browser.test.tsx`.

## Out of Scope

- The simple view's header and its toolbar.
- Detail-page headers (provider, medication, task, period, profile, entry), though they may adopt `PageHeader` later.
- Print sheets (they keep the name and details as they are).
- The header's sections, sync indicator and user menu.
- Moving age or code status anywhere new.

## Further Notes

- The user's choices (2026-11-21): a plain "Timeline" heading; viewer notes dropped; age and code status on the profile only; the eye at the right end; all three controls icon-only circles; the simple view left alone; the menu order above with one separator; the period icon kept; the chevron turning down, with the lines indented; a shared `PageHeader`; component tests only; four slices.
