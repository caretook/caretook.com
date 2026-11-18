# PRD: Timeline polish

Status: 🟡 planned in [`timeline-polish-plan.md`](timeline-polish-plan.md), not started. Backlog items: B-2, B-3, B-4, B-5, B-6, B-7, B-10. Topic `timeline-polish`.

## Problem Statement

The timeline is the screen caretakers live in, and it has rough edges:

- The **latest vitals** strip wraps into several lines of chips and pushes the entries down (B-2).
- On a laptop the timeline is a narrow column in the middle of a wide screen (B-3).
- Entries show the author only as initials, with no way to see the full name, and no way to see one person's entries (B-4, B-6).
- The kind icon on every entry looks tappable but does nothing; filtering by kind means scrolling back up to the chips (B-5).
- Day headers are small, muted uppercase text, so it's hard to see where one day ends while scrolling (B-7).
- Reading back through weeks means pressing "Show older entries" again and again (B-10).

## Solution

- **Latest vitals in one line:** the two or three most recent readings and "All vitals ›", which expands the full set. It has the same height on every screen.
- **Full width on large screens, with readable lines:** the timeline uses the width it has. Text inside an entry is capped at about 75 characters per line. In cards view, cards flow two or three to a row on wide screens, still under their day headers. Phones are unchanged.
- **Author:** tapping an entry's initials filters the timeline to that person's entries. An "author chip" with their avatar and name ("By Alex Rivera ✕") shows the filter and clears it. On a desktop, hovering or focusing the initials shows a tooltip with the name and avatar.
- **Kind:** tapping an entry's kind icon filters by that kind, the same as the existing chips.
- **Filters combine:** kind and author are independent (`?kind=symptom&author=<id>`), each clears on its own, and tapping a filter that's already on changes nothing.
- **Day headers:** larger, semibold and full contrast, reading "Today", "Yesterday", then "Monday, Nov 16" (with the year when it isn't this year). Still sticky.
- **Infinite scroll:** older entries load as the end of the list comes into view, with "Loading older…" while they load and "That's the beginning of the timeline" at the very end. The "Show older entries" button goes away.

## User Stories

1. As a caretaker, I want latest vitals to take one line, so that entries start near the top of the screen.
2. As a caretaker, I want the one line to show the most recent readings first, so that what changed lately is what I see.
3. As a caretaker, I want "All vitals ›" to expand every type's latest reading, so that I can still check one I don't see.
4. As a caretaker, I want the expanded vitals to collapse again, so that I can get back to the timeline.
5. As a screen reader user, I want the vitals toggle to say whether it's expanded, so that I know what it does.
6. As a caretaker on a laptop, I want the timeline to use the screen's width, so that I see more at once.
7. As a caretaker on a laptop, I want long text kept to a readable line length, so that I don't read 200-character lines.
8. As a caretaker using cards on a laptop, I want cards in a grid, so that the wide screen isn't mostly empty.
9. As a caretaker on a phone, I want the timeline to look as it does today, so that nothing I'm used to moves.
10. As a caretaker, I want to tap an entry's kind icon to see only that kind, so that I don't scroll up to the chips.
11. As a caretaker, I want to tap an entry's author initials to see only their entries, so that I can catch up on what one person logged.
12. As a caretaker, I want the author filter shown as a chip with their avatar and name, so that I know whose entries I'm seeing.
13. As a caretaker, I want to clear the author filter from its chip, so that I can get back to everything.
14. As a caretaker, I want kind and author filters to combine, so that I can see "symptoms logged by Alex".
15. As a caretaker, I want each filter to clear without clearing the other, so that I can widen one step at a time.
16. As a caretaker, I want filters in the URL, so that they survive reloads, Back, and a shared link.
17. As a caretaker, I want tapping a filter that's already on to change nothing, so that taps are predictable.
18. As a desktop user, I want hovering or focusing an entry's initials to show the author's name and avatar, so that I know who wrote it without filtering.
19. As a keyboard user, I want the kind icon and initials to be their own focusable buttons with clear names ("Show only symptoms", "Show only Alex Rivera's entries"), so that I can filter without a mouse.
20. As a caretaker, I want tapping elsewhere on the row to still open the entry, so that the new buttons don't get in the way.
21. As a viewer, I want the new filters too, since filtering changes nothing, so that I can read the timeline the same way.
22. As a caretaker, I want day headers I can see while scrolling fast, so that I know which day I'm in.
23. As a caretaker, I want "Today" and "Yesterday" as day names, so that recent days read naturally.
24. As a caretaker, I want older days to show the weekday and date (and the year when it's not this year), so that I can place them.
25. As a caretaker, I want older entries to load as I scroll, so that I can read back through weeks without pressing a button.
26. As a caretaker, I want to see that more is loading, and when I've reached the first entry, so that I know whether there's more.
27. As a caretaker, I want new entries (mine or others') to appear at the top while I'm scrolled down, without jumping my place, so that reading back isn't interrupted.
28. As a caretaker offline, I want scrolling and filters to work from the device's copy, so that they work anywhere.
29. As a screen reader user, I want "Loading older…" and the end of the timeline announced, so that I know what auto-loading did.
30. As a caretaker, I want changing a filter to start the list from the newest entry, so that I'm not left deep in a different list.

## Implementation Decisions

**Filter state**

- One pure module owns the timeline's URL filter state: parse `?kind=` and `?author=` (unknown values are ignored), build the search string for "set kind", "set author", "clear kind", "clear author", "clear all", and a no-op when the filter is already set. The chips, the row's icon and initials, and the author chip all build links through it.
- Filter changes are `Link`s with `replace` and `preventScrollReset` (as the chips are today). A changed filter resets paging.
- The local query takes an optional `author` (`created_by = ?`) alongside `kind`. Both filters work offline.
- **The latest vitals strip ignores filters.** It's the recipient's current state, not a view of the list.
- The author chip's name and avatar come from the local member profiles (`member_profiles` stream). A filtered author who's no longer a co-member shows "Former member".

**Row and card controls**

- The kind icon and author initials become buttons (links) of their own, `relative z-10` above the row's stretched `EntryOpenTarget`, like the ⋯ button. Their names are "Show only <kind plural>" and "Show only <name>'s entries".
- The tooltip is a React Aria `TooltipTrigger` on the initials: it shows on hover and focus only, never on touch, with the author's avatar and name. It uses the shared avatar component from `app-shell` if it has landed, else the initials badge.
- Cards show the author's name (as today), and it becomes the same filter control.

**Latest vitals**

- `LatestVitals` becomes a single line: a "Latest" label, the most recent readings that fit (two on phones, three or more on wide screens, chosen by what fits without wrapping: CSS overflow with a fade, not measuring), and an "All vitals ›" disclosure button (`aria-expanded`). Expanded, it shows the current full set as chips; collapsed again on a second tap. The expanded state isn't remembered.

**Layout**

- The timeline's `main` loses its `max-w-2xl` at `lg` and up, keeping the 16 px gutters. Entry text (title and body) is capped at about 75ch. The filter row and vitals line span the width.
- Cards view: at `lg`, a CSS grid of two columns (three at `2xl`) inside each day's section. Rows view stays one entry per line.
- Day headers stay sticky. With `app-shell`'s frame, they stick below the header.

**Day headers**

- A pure `dayLabel(iso, timeZone, now)`: "Today", "Yesterday", else "Monday, Nov 16", with ", 2025" when the year differs. It works in the viewer's zone, as the grouping already does.
- Style: normal case, `text-base`/`lg`, semibold, full contrast, on the same blurred background.

**Infinite scroll**

- Keep the current approach (the local query's `LIMIT` grows by the page size, 30), triggered by an `IntersectionObserver` on a sentinel near the end of the list (a margin of about a screen) instead of the button. The live query keeps the rows already shown while the bigger one runs, so the list doesn't jump.
- A polite live region says "Loading older…" and then "That's the beginning of the timeline" when the query returns fewer rows than asked.
- New entries at the top while scrolled down: the list grows above, and the browser's scroll anchoring keeps your place. Check that it does; if not, keep the scroll position by hand.
- Paging resets on a filter change. Very long timelines (thousands of entries) are fine for now; virtualising the list is out of scope, but note the row count at which scrolling stays smooth in the hand-off.

## Testing Decisions

- Test behaviour, not structure: what the filter module returns for a URL, what `dayLabel` returns for a date, what the user can see and tap.
- **Unit** (`web:unit`): the filter-state module (parse, every transition, no-op re-tap, unknown values), the local query builder with kind and author, and `dayLabel` (today, yesterday, this year, last year, around midnight in a zone other than UTC, a DST change).
- **Browser checks:** extend `phase2.mjs` (it already covers the timeline in rows and cards, writer and viewer, pinned to America/Los_Angeles):
  - Tap a kind icon, then an author's initials: both filters apply, the URL carries both, each chip clears its own, and a re-tap changes nothing.
  - A tap elsewhere on the row still opens the entry.
  - The vitals line is one line at 420 and 1280 wide, and it expands and collapses.
  - At 1280 wide: rows span the width with capped text; cards are in a grid.
  - Day headers read "Today" and "Yesterday" for the seeds.
  - Scrolling to the end loads older entries until the beginning message appears (the seeds have about 180 entries over eight weeks, six pages).
  - The tooltip appears on hover and focus.
- Keyboard: tab to an icon and to initials and activate them.

## Out of Scope

- Search (the `search` PRD), and filtering by date range or severity.
- Choosing which vitals appear in the line, or charts of vitals over time.
- Virtualised lists for very long timelines.
- Changing the phone layout beyond the vitals line, the day headers and the new controls.
- The live dot and "Live now" banner (`live-notes-ux` slice 7), which this PRD has to make room for.

## Further Notes

- **Depends on `live-notes-ux` slices 3 and 7.** Slice 7 adds a live dot to rows, and both touch the row components and `timeline.tsx`. Build after they land in `dev`.
- **Interacts with `app-shell`:** its slice 1 shrinks the timeline's heading and wraps the screen in the frame, and its slice 4 adds a bottom tab bar on phones. The infinite scroll's sentinel and the last rows must clear the tab bar. Prefer to start after `app-shell` slice 1 has landed.
- **Quick-fixes slice 2** edits the timeline's layout toggle handler. Keep away from it.
- **Hot files:** `timeline.tsx`, `TimelineEntryRow`/`Card`, `TimelineFilters`, `LatestVitals`, `lib/sync/timeline.ts`, `lib/format.ts`. `search` builds on this PRD's filter module and infinite scroll.
