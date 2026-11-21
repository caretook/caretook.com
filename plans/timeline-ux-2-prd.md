# PRD: Timeline UX 2 (declutter)

> Topic `timeline-ux-2`. Backlog items B-214, B-218, B-223; added 2026-11-21: B-215, B-216, B-217, B-219, B-224. Plan: [`timeline-ux-2-plan.md`](timeline-ux-2-plan.md).

## Problem Statement

The app keeps telling caretakers whose care group they're in. The header's group menu names the recipient on every group route. The Providers, Medications, Upcoming and Tasks pages repeat that name under their titles. The timeline opens with a large profile card: avatar, name, group, age and code status. On a phone, that's a screen's worth of header before the first useful thing.

Smaller things add to the clutter:

- The timeline's View options button (the eye) sits alone in the header's corner, far from the search and Filter controls it belongs with, and it's a different size and shape from them.
- The day summary's expand chevron is at the far right of the line, away from where people read and tap.
- The group menu has a care-period line ("Now: In hospital · day 4") that repeats what the day headers show. "New care group" sits at the bottom, under the group's own pages. "Group settings" isn't last.

The quick-entry box and the timeline's empty states add more:

- An empty quick-entry box shows up to three rows of chips under it (Due now, Usual around now, Your recent lines). They push the timeline down on every visit, though most visits use none of them.
- While typing, the "Matching names" chips appear under the field in the page flow, so the cards and everything below jump down and back as names match and stop matching.
- The ? beside the box sits outside its border, and its CircleHelp icon reads poorly. Its examples repeat the placeholder's job.
- A Today with nothing logged is a bare heading and a +. The page looks broken, not ready.
- The day heading's + menu lists every vital type as its own item under a "Vitals" heading. That's a long menu (14 items) when most adds are a note, a dose or a symptom.

## Solution

- **Page headers name the page, not the recipient.** Providers, Medications, Upcoming and Tasks show their title and actions only, with no subtitle. The viewer notes ("You can view this list / directory / timeline") go too: the missing Add buttons already show that a page is read-only. Printed sheets keep the recipient's name.
- **The timeline loses its profile card.** It gets a plain "Timeline" heading like the other sections. Age and code status live on the profile (and the emergency sheet). The profile stays one tap away in the group menu.
- **One toolbar.** Search, Filter and View options (the eye) share one row: search and Filter on the left, the eye pushed to the right end. All three are the same outlined icon-only circle. Filter shows how many filters are on as a badge.
- **The day summary's chevron is on the left.** It points right when closed and down when open, and the expanded lines indent to line up with the summary text.
- **The group menu is reordered.** The groups (the current one checked), then "New care group", a separator, "<Name>'s profile", "Care periods", and "Group settings" last. The care-period line is gone. The trigger keeps the current period's type icon.
- The simple view is unchanged: its header is the only place that names the recipient there, since simple mode drops the group menu.
- **Suggestions move into a popover.** The empty box shows nothing under it. A Sparkles icon inside the box, at its right edge, opens a popover with the same three rows: Due now, Usual around now, Your recent lines. A dot on the icon (and its name, "Suggestions, a pass is due") says a pass is due. A chip fills the box (a due pass's chip gives the pass, as now) and closes the popover. The icon shows only while the box is empty and there's something to suggest. Simple mode's large box works the same way, still without pass chips.
- **The help ? goes.** No help icon or examples popover. The placeholder and the screen-reader rules stay.
- **Name completions float.** While typing, "Matching names" appears as an overlay just under the field, over the cards and the timeline, on the menu surface. Nothing below moves. Escape or leaving the field hides it.
- **An empty Today invites an entry.** For a writer in the full view, with no filter or search, a Today with nothing logged shows "Nothing logged today yet." and an "Add an entry" button that scrolls to the quick-entry box and focuses it. On a timeline with no entries at all, this replaces "Nothing on the timeline yet." for that writer.
- **Vitals is one item in the + menu.** "Vitals" with a chevron expands, in place, to the vital types, indented under it. The menu stays open, and choosing a type opens its sheet as now. It starts closed every time the menu opens.

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
24. As a caretaker opening the timeline, I want the empty quick-entry box to have nothing under it, so that the Today card and the entries start right below it.
25. As a caretaker who wants a suggestion, I want one icon inside the box that opens Due now, Usual around now and my recent lines, so that they're a tap away when I want them.
26. As a caretaker, I want the icon to show a dot when a pass is due, so that I don't miss evening meds now that the chips are tucked away.
27. As a screen-reader user, I want the icon named "Suggestions" or "Suggestions, a pass is due", so that I hear what the dot shows.
28. As a caretaker, I want choosing a suggestion to fill the box and close the popover, so that I can check the line and Save as before.
29. As a caretaker, I want a due pass's chip in the popover to give the pass in one tap with Undo, as it does now, so that nothing about giving meds gets slower.
30. As a caretaker in a new group with nothing to suggest, I want no suggestions icon, so that I don't open an empty popover.
31. As a caretaker in simple mode, I want the same suggestions icon in my large box, so that the box looks and works the same in both modes.
32. As a caretaker, I want the help ? gone, so that the box is just the field and its one icon.
33. As a caretaker typing a medication or provider name, I want the matching names to float over the page, so that the cards and timeline don't jump while I type.
34. As a caretaker, I want Escape or leaving the field to hide the matching names, so that they never cover what I want to tap.
35. As a caretaker with nothing logged today, I want a line saying so and an "Add an entry" button, so that the page looks ready instead of broken.
36. As a caretaker, I want "Add an entry" to take me to the quick-entry box with the keyboard up, so that I can type right away.
37. As a viewer, or in simple mode, I want my timeline unchanged, so that I don't see a prompt for something I can't do there.
38. As a caretaker adding from a day's +, I want "Vitals" as one item that expands to its types, so that the menu is short and the common kinds are easy to find.
39. As a caretaker, I want the menu to stay open when I expand Vitals, and choosing a type to open its sheet, so that adding a reading is still two taps from the menu.
40. As a keyboard or screen-reader user, I want Vitals to say whether it's expanded and to toggle with Enter, so that I can reach the types without a pointer.

## Implementation Decisions

- **A new `PageHeader` primitive in `components/ui/`**, exported from its index: a page's `h1` title with an optional actions slot (any node the page passes, such as a link, a button group or a menu), laid out as today's headers are: title on the left, actions on the right, aligned to the top, wrapping on narrow screens. Its outer `className` is the only styling hook (the components doc's rule). Providers, Medications, Upcoming (`UpcomingHeader` wraps it) and Tasks use it. The timeline's full view uses it with "Timeline" as the title. Detail headers (provider, medication, task, period, profile, entry) aren't in scope; they can move to it later.
- **No subtitles.** The four pages drop the `group.displayName` line and the viewer notes. Upcoming's filters, below its header, stay where they are.
- **The timeline header.** `RecipientCard` is deleted. `TimelineHeader` becomes the `PageHeader` with "Timeline" and no actions: View options moves to the toolbar. The profile test's check that the card links to the profile moves to the group menu's profile item.
- **The toolbar.** `FilterChips` (shared by the full and simple views) takes an optional trailing node rendered at the right end of its control row (`ml-auto`). The full view passes `TimelineViewMenu` there. The simple view passes nothing, so View options stays out of it as today. The magnifier, Filter and the eye's trigger share one outlined icon-only circle style. Filter becomes icon-only, its count in a small badge on the circle, named "Filter" or "Filter, N on". It keeps `data-filter-button` and `aria-haspopup="dialog"`, and the eye keeps the name "View options", so the browser checks' selectors still match. The open search field grows to fill the room between Filter and the eye.
- **Day summary.** `DaySummaryLine`'s chevron comes before the summary text inside the same disclosure button. It's `ChevronRight` turned 90° when expanded, as now. The expanded list gets a left indent equal to the chevron plus its gap. Nothing else changes: the accessible name, the modes and `summariesOff`.
- **The group menu.** `GroupMenu`'s items, in order: the groups section (selection as now), the "New care group" link (`NEW_GROUP_LINK_STATE`), `SEPARATOR`, "<Name>'s profile" (only with a recipient), "Care periods", "Group settings". The `period-now` item and its imports go. The trigger's period icon and label ("<Name>, <period>: switch care group") stay. `menuNowText` stays where other callers use it, and is deleted if `GroupMenu` was its last caller.
- **Quick entry's suggestions popover** (`components/quick-entry/`):
  - `QuickEntryHelp` and `QUICK_ENTRY_EXAMPLES` are deleted. `QUICK_ENTRY_PLACEHOLDER` and `QUICK_ENTRY_RULES` (the box's screen-reader description) stay.
  - A new `QuickEntrySuggestButton`: a Sparkles icon button positioned inside the textarea's border at its right edge, top-aligned so it stays put as the box grows. The textarea keeps right padding for it while it shows. It opens a `ui/Popover` (`placement="bottom end"`, its `children` a function of `close`). It's named "Suggestions", or "Suggestions, a pass is due" with a small dot when a due pass is offered (`passChips` on and `duePasses` not empty). It renders only while the box is empty and at least one row has something.
  - `QuickEntrySuggestions` becomes the popover's body: the same rows and the same `data-quick-suggestions` and `data-quick-row` hooks, with each chip's press calling `close` after `onFill` or `onGivePass`. Both sizes (`md`, `lg`) use it. Simple mode keeps `passChips={false}`.
- **Floating completions:** a new `QuickEntryCompletions` holds "Matching names" (`data-quick-completions`, the same `ChipGroup`), absolutely positioned under the field inside a `relative` wrapper (`top-full`, the `ui/styles.ts` surface, above the cards). It shows while the box has text, has matches and the field has focus or the overlay is being pressed. Escape hides it until the text changes. Picking a name completes the line and keeps focus in the field, as now. It never changes layout.
- **The empty Today** (`TimelineEntryList`): when `adding` (a writer, not simple) and no kind, author, vital or search filter is on, and today's section has no entries, it renders under the Today heading a muted "Nothing logged today yet." and an "Add an entry" button (`data-empty-today`). The route passes `onAddEntry`, which scrolls the quick-entry field into view and focuses it, through a `fieldRef` that `QuickEntryBox` takes. With no days at all in that case, the bottom "Nothing on the timeline yet." line is left out. Filtered and search empties are unchanged.
- **Expandable menu groups** (`components/ui/`):
  - `menuModel.ts` gains `MenuGroup` (`{ type: "group", id, label, icon?, items }`). `normalizeMenu` drops an empty group, and separators treat a group as one entry.
  - `Menu` renders a group as an item with a chevron and `aria-expanded`, `shouldCloseOnSelect={false}`, that toggles its items in. The items follow it, indented (`data-menu-group-item`), and are ordinary items that close the menu when chosen. The open groups reset each time the menu opens.
  - `QuickAddMenu`'s Vitals section becomes a group: "Vitals" with `KIND_META.vital.Icon`, its items the `VITAL_TYPES`, each opening its sheet as now. The menu's item count closed is 5.
- No schema, sync, API or migration changes. No new dependencies.
- At landing, the [app-shell](../docs/domain/app-shell.md) doc's `GroupMenu` line and the [timeline](../docs/domain/timeline.md) doc's header lines (the recipient card, View options, the day summary's chevron, the empty Today, the + menu's Vitals) are updated. `PageHeader` joins the [components](../docs/domain/components.md) list of `ui/` primitives, and its `Menu` line gains groups. The [assistant](../docs/domain/assistant.md) doc's _Suggestions_ line (the popover, the floating completions, no ? or examples) is rewritten.

## Testing Decisions

- Good tests check what a person sees and can do (headings, names, order, what a tap opens), never class names or the component tree.
- **Component tests**, in the touched screens' existing `*.browser.test.tsx` files:
  - Providers, Medications, Upcoming, Tasks: the `h1` is the page's name, and the recipient's name and the viewer note aren't in the header, for a writer and a viewer.
  - `PageHeader`: title and actions render, in `components/ui/inScreens.browser.test.tsx` (as the screens use it).
  - Timeline header: the `h1` is "Timeline"; there's no profile link in `main`; View options is in the filter row after Filter; Filter is named "Filter, N on" with filters on; the simple view's toolbar has no View options.
  - Profile: the group menu's profile item opens the profile (replacing the card test).
  - Day summaries: the chevron comes before the text in the button, and `aria-expanded` and the lines toggle as before.
  - Group menu: the items come in the new order, there's no "Now: …" item during a period, and the trigger still shows the period icon.
  - Quick-entry suggestions (`timelineQuickEntrySuggestions.browser.test.tsx`): the empty box shows no chips under it; "Suggestions" opens a dialog with Usual around now and Your recent lines; a chip fills the box and closes it; there's no Suggestions button with nothing to suggest, or while typing; there's no "How quick entry works" button. Matching names: the cards' list doesn't move when names appear (its top is the same before and after); Escape hides them; a name still completes the line.
  - Passes (`timelineQuickEntryPasses.browser.test.tsx`): with a pass due, the button is named "Suggestions, a pass is due", and the Due now chip inside gives the pass with Undo and closes the popover; Due now is the popover's first row.
  - Simple mode (`timelineSimpleNow.browser.test.tsx`): the large box has the Suggestions button and no Due now row.
  - The empty Today (`timelineHeader.browser.test.tsx`): a writer with nothing today sees "Nothing logged today yet." under Today, and "Add an entry" focuses the quick-entry field; a viewer, simple mode and a filter don't show it; an empty timeline doesn't show both lines.
  - The + menu (`components/ui/inScreens.browser.test.tsx`): "Add to Today" has 5 items closed; Vitals is `aria-expanded="false"`, then pressing it keeps the menu open, shows the vital types and sets it to true; choosing Blood pressure opens the vital sheet. `primitives.browser.test.tsx`: a group toggles with Enter and starts closed on reopen.
- **Unit tests** only for `normalizeMenu`'s group rules (`menuModel.test.ts`): an empty group is dropped, separators around a group. **No e2e changes**: the browser checks select by names and attributes that stay (`View options`, `data-filter-button`), and nothing crosses the server or sync. The orchestrator's landing checks cover `app-shell`, `layout-offline` and `phase2` as usual.
- Prior art: `timelineHeader.browser.test.tsx`, `timelineSummaries.browser.test.tsx`, `groupMenuPeriod.browser.test.tsx`, `frame.browser.test.tsx`, `providers.browser.test.tsx`, `medicationList.browser.test.tsx`, `upcoming.browser.test.tsx`, `tasks.browser.test.tsx`, `profile.browser.test.tsx`.

## Out of Scope

- The simple view's header and its toolbar.
- Quick entry's parser and what kind a line makes (B-220, the `quick-entry` PRD, after this one).
- Flyout submenus in `ui/Menu`: on a phone they open beside the parent and overlap it.
- An empty-day prompt for days other than Today.
- Detail-page headers (provider, medication, task, period, profile, entry), though they may adopt `PageHeader` later.
- Print sheets (they keep the name and details as they are).
- The header's sections, sync indicator and user menu.
- Moving age or code status anywhere new.

## Further Notes

- The user's choices (2026-11-21): a plain "Timeline" heading; viewer notes dropped; age and code status on the profile only; the eye at the right end; all three controls icon-only circles; the simple view left alone; the menu order above with one separator; the period icon kept; the chevron turning down, with the lines indented; a shared `PageHeader`; component tests only; four slices.
- Added the same day: all three suggestion rows into a popover behind a Sparkles icon inside the box, with a dot when a pass is due, shown only on an empty box with something to suggest, in simple mode too; the help ? and its examples dropped; the name completions as an overlay under the field; an empty Today with a line and "Add an entry" (focus only), for writers in the full view; Vitals as an inline expandable group (not a flyout: it's poor on touch); component tests plus `menuModel` unit tests; three more slices.
