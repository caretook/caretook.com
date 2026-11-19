# Plan: Timeline polish

> Source PRD: [`plans/timeline-polish-prd.md`](timeline-polish-prd.md). User-story numbers (US) refer to it. Backlog items B-2, B-3, B-4, B-5, B-6, B-7 and B-10. Topic `timeline-polish`.

## Status

| Slice | Backlog | State                            | Merge into `prd/timeline-polish` (slice commits) |
| ----- | ------- | -------------------------------- | ------------------------------------------------ |
| 1     | B-5     | landed in `dev` (`644f780`)      | `5d6678a` (`9b23d14`, `4c14096`)                 |
| 2     | B-7     | landed in `dev` (`644f780`)      | `cf96edc` (`47a2792`)                            |
| 3     | B-2     | landed in `dev` (`644f780`)      | `908d4fa` (`4b1b280`, `cf12f43`)                 |
| 4     | B-6     | replanned, ready (wave 2)        |                                                  |
| 5     | B-3     | replanned, ready (wave 2)        |                                                  |
| 6     | B-4     | replanned, blocked by 4 (wave 3) |                                                  |
| 7     | B-10    | replanned, blocked by 4 (wave 3) |                                                  |

Wave 1 (slices 1–3) landed in `dev` as `644f780` (2026-11-18).

**Restarted 2026-11-18** from `dev` at `85144b4`, after `routing` (B-23), `components` (B-24) and `providers` (B-14) had all landed. **Slices 4–7 below are rewritten against that code**; _What the replan changed_ lists the differences. Nothing is claimed or in flight yet.

Open issues:

- **Phones hide the visible "Latest" label** on the vitals line (screen-reader only below `sm`), because only one seeded reading fits beside it at 420. The PRD asked for the label and two readings. Still waiting for the user's decision; no slice depends on it.
- `phase2.mjs` steps that reload the page can log `[PowerSync]: Sync error` (the old page's connection closing). `kindIconFilters` filters it for its own steps only; the shared noise pattern doesn't cover it. A slice that adds a reload step (4, 7) adds it to the shared pattern.
- **`invites` (unlanded) adds `<InviteSomeoneCard />` under `TimelineHeader` in the timeline's `route.tsx`**, two lines from the `<main>` class slice 5 changes. Expect an adjacent-line conflict at whichever sync comes second; keep both.
- Closed: the `live-notes.mjs` timing failures under load are now handled by `pnpm prd browser`'s one automatic retry (recorded as FLAKY).

## What the replan changed

- **Files.** `timeline.tsx` is now `routes/app/groups/timeline/route.tsx`, which only composes. The data, the paging and the names are in `useTimelineData`; the first screenful is `timelineRows.ts`; the list, day sections, empty state and "Show older" are `TimelineEntryList`; what an entry says is `EntryBody`, shared by `TimelineEntryRow` and `TimelineEntryCard`. `AuthorInitials` and `KindFilterLink` are in `components/entry/KindIcon.tsx`.
- **Slice 4** also changes `timelineLinksQuery` (`lib/sync/providers.ts`), which `providers` added: it windows the "with …" lines over the same entries as `entriesQuery`, so both take the author, from one shared condition. The author chip is a `ChipGroup` link chip, which needs two optional fields on `LinkChip`.
- **Slice 5** must stop three checks from detecting the cards view by its `space-y-2` class, which the grid removes. The 75ch cap goes in `EntryBody`, once, for rows and cards.
- **Slice 6** adds a `Tooltip` primitive to `components/ui/` (the app has none, and `Popover` opens on a press and takes focus, which is wrong for a hover hint). Only `ui/` imports React Aria.
- **Slice 7** replaces "Show older" inside `useTimelineData` and `TimelineEntryList`, not the route, and updates the two other checks that press the button (`app-shell.mjs`, `routing.mjs`).
- **Checks** follow the new budget: rules that are pure logic get unit tests, `phase2.mjs` keeps the wiring, each new step function has one smoke block, and nothing runs between merges.
- **Unchanged:** every slice's backlog item, user stories, and blocks / blocked-by. The waves are as planned: 4 and 5, then 6 and 7.

## Backlog map

One item per slice, so each is claimed with its slice and marked `done` when that slice merges.

| Item | What it asks for                                | Slice |
| ---- | ----------------------------------------------- | ----- |
| B-2  | Latest vitals is too busy                       | 3     |
| B-3  | Wider timeline entries on large screens         | 5     |
| B-4  | Tooltip with the author's name and avatar       | 6     |
| B-5  | Tap an entry's kind icon to filter by that kind | 1     |
| B-6  | Tap an entry's author initials to filter        | 4     |
| B-7  | More prominent day headers                      | 2     |
| B-10 | Infinite scroll through the whole timeline      | 7     |

## Architectural decisions

Durable decisions every slice follows:

- **Routes:** no new routes. Everything is on `/app/groups/:groupId/timeline`, a shared route: no server loader or action, reads from the local database.
- **No schema, migration, sync-config, seed or API change, and no new dependency.** Everything reads what the device already has (`timeline_entry.created_by`, the `member_profiles` stream). The tooltip uses React Aria Components, which is already installed, through a new primitive in `components/ui/` (only `ui/` imports it).
- **Filter state lives in the URL:** `?kind=<kind>&author=<userId>`. One pure module owns it: parsing (unknown values are ignored), and the search string for set kind, set author, clear kind, clear author and clear all. Setting a filter that's already on returns the same search. Every filter control (the chips, the row's icon and initials, the author chip) is a `Link` built through it, with `replace` and `preventScrollReset`. `search` will build on this module.
- **Local query:** `entriesQuery` and `timelineLinksQuery` take the filters (`kind`, and `author` as `created_by = ?`) and a limit, built from one shared condition so their windows match. Paging stays "the limit grows by 30" (`PAGE_SIZE`), in `useTimelineData`; a filter change starts again from the first page.
- **Latest vitals ignores the filters.**
- **Row and card controls:** the kind icon and the author control are links of their own, `relative z-10` above the stretched `EntryOpenTarget`, like the ⋯ button. Names: "Show only <kind plural>" and "Show only <name>'s entries". Viewers get them too.
- **Author display:** names and avatars come from the local members query, through the shared `UserAvatar`. Someone who's no longer a co-member is "Former member".
- **Day labels:** a pure `dayLabel(iso, timeZone, now)`: "Today", "Yesterday", else "Monday, Nov 16", with ", 2025" when the year isn't this one.
- **Layout:** phones don't change beyond the vitals line, the day headers and the new controls. From `lg`, the timeline drops its `max-w-2xl` (16 px gutters stay), entry text is capped at about 75ch, and cards form a grid (two columns, three at `2xl`) inside each day. The `/app` header isn't sticky, so day headers keep sticking to the top of the window.
- **The tab bar** (phones): the layout already leaves a spacer of `--tab-bar-height` below the outlet. Nothing here offsets for it by hand, and nothing is added that's fixed to the bottom.
- **Hot files** (all in `routes/app/groups/timeline/` unless a path is given): `route.tsx` (4, 5), `useTimelineData.ts` (4, 7), `TimelineEntryList.tsx` (4, 5, 7), `TimelineEntryRow.tsx` and `TimelineEntryCard.tsx` (4, 5), `EntryBody.tsx` (5), `TimelineFilters.tsx` (4), `timelineRows.ts` (4), `components/entry/KindIcon.tsx` (4, 6), `components/ui/` (4: `chips.ts`, `ChipGroup`; 6: `Tooltip`), `lib/sync/timeline.ts` and `lib/sync/providers.ts` (4), and `scripts/browser-checks/phase2.mjs` (every slice). Stay away from the layout toggle's handler (`useTimelineView`, `saveSettings`), the entry form and the sheets.
- **Components rules** (AGENTS.md, _Components_) apply: import feature folders through their index, hooks return data and callbacks and never JSX, pure logic goes in a plain module with a `web:unit` test, and a route never imports another route's folder.

## How to run this plan

- **Wave 1 (done): slices 1, 2 and 3.**
- **Wave 2: slices 4 and 5 in parallel.** 4 is the data path and the author controls; 5 is class names and the card grid. They share `route.tsx`, `TimelineEntryList`, the row and the card, in different lines.
- **Wave 3: slices 6 and 7 in parallel.** 6 wraps the author control that 4 makes (`KindIcon.tsx`, `components/ui/`); 7 changes the paging that 4 re-keys to both filters (`useTimelineData`, `TimelineEntryList`). They share only `phase2.mjs`.
- Merge in number order. Each wave is worth landing in `dev` by itself.
- **Checks follow AGENTS.md, _Browser check budget_.** While building, a loop runs `pnpm prd browser phase2` (`--smoke` for a quick look); before hand-off, `pnpm prd browser --changed` once. The orchestrator runs nothing between merges, and the full suite once before landing.
- **`phase2.mjs` is shared by every slice.** Each slice adds its steps as one new function, called at the end of the run through `step(name, fn)`, with its core path in one `step(name, { smoke: true }, fn)` block, and leaves the header comment alone (the orchestrator updates it at merge). A rule that's pure logic (a filter URL, a label, a query's SQL) gets a named unit test, not a browser step; the check keeps the wiring: the control is on the page, and using it does the thing.
- Every slice ends with `pnpm check` passing, its checks, the timeline route's gzipped size against its base (no growth beyond noise, or the reason), and a hand-off (AGENTS.md, _Loop rules_). No slice needs `pnpm datastore:reset`.

```
1 ── 4 ──┬── 6
         └── 7
2
3
5 (independent; wave 2)
```

---

## Slice 1: Filter state and the kind icon

**Backlog:** B-5. **User stories:** US 10, 16, 17, 19 (kind), 20, 21. **Blocked by:** none. **Blocks:** 4.

### What to build

The pure filter-state module from _Architectural decisions_, complete for both `kind` and `author` (parsing and every transition), so that slice 4 only wires the author side. Move the loader's kind parsing and the existing kind chips onto it; they look and behave as today. Then make each entry's kind icon, in rows and in cards, a link that sets that kind: the same result as tapping the chip. It's a focusable control of its own named "Show only symptoms" (the kind's plural), above the row's open target, so a tap anywhere else on the row still opens the entry. Tapping the icon of the kind that's already showing changes nothing.

### Acceptance criteria

- [ ] Tapping a symptom's icon shows only symptoms, the URL is `?kind=symptom`, and the Symptoms chip is marked current. Reload and Back keep it.
- [ ] Tapping the same icon again leaves the URL and the list as they are.
- [ ] A tap elsewhere on the row still opens the entry (notes and events) or its edit sheet (symptoms and vitals, writers).
- [ ] The icon is reachable by Tab and activates with Enter, in rows and in cards. Its name is "Show only <kind plural>".
- [ ] viewer@ can filter by icon too.
- [ ] The chips still work as before, built through the module; "All" clears the kind.
- [ ] An unknown `?kind=` or `?author=` value is ignored (the module's parse; the author isn't applied to the list yet).
- [ ] Unit tests for the module: parse, every transition, the no-op re-tap, unknown values, and that changing one filter keeps the other.
- [ ] `phase2.mjs` covers the icon tap, the re-tap, the row tap and the keyboard, as writer and viewer in both views.

---

## Slice 2: Day headers

**Backlog:** B-7. **User stories:** US 22–24. **Blocked by:** none. **Blocks:** none.

### What to build

The pure `dayLabel(iso, timeZone, now)`, replacing the timeline's current day label: "Today", "Yesterday", then "Monday, Nov 16", with the year added when it isn't the current one. It works in the viewer's zone, the same zone the day grouping uses. Restyle the sticky day heading: normal case, larger (`text-base`, `lg` on wide screens), semibold, full contrast, on the same blurred background. It stays sticky and stays under the rows' open ⋯ menus as it does today.

### Acceptance criteria

- [ ] The seeds' newest days read "Today" and "Yesterday"; older days read like "Monday, Nov 16".
- [ ] A day in another year reads like "Monday, Nov 16, 2025".
- [ ] The heading is visibly larger and full contrast in the light and dark themes, and still sticks while scrolling in rows and in cards.
- [ ] A row's controls never show above a stuck heading.
- [ ] Unit tests for `dayLabel`: today, yesterday, this year, last year, either side of midnight in a zone other than UTC, and across a DST change.
- [ ] `phase2.mjs` (pinned to America/Los_Angeles) checks the "Today" and "Yesterday" labels and that the heading sticks.

---

## Slice 3: Latest vitals in one line

**Backlog:** B-2. **User stories:** US 1–5. **Blocked by:** none. **Blocks:** none.

### What to build

`LatestVitals` as one line of the same height on every screen: a "Latest" label, the most recent readings first, as many as fit without wrapping (two on a phone, three or more on a wide screen; CSS overflow with a fade, no measuring), and an "All vitals ›" disclosure button with `aria-expanded`. Expanded, it shows every type's latest reading as chips, as today; a second tap collapses it. The expanded state isn't remembered. The strip keeps ignoring the timeline's filters, and still isn't shown when there are no vitals.

### Acceptance criteria

- [ ] At 420 and at 1280 wide, the collapsed strip is one line of the same height, with the most recent readings first and "All vitals ›" always visible (never clipped by the readings).
- [ ] "All vitals ›" expands every type's latest reading; tapping it again collapses to one line.
- [ ] The button reports `aria-expanded` and names what it controls, and works from the keyboard.
- [ ] With `?kind=note` set, the strip shows the same readings.
- [ ] A reload starts collapsed.
- [ ] `phase2.mjs` covers the one-line height at both widths, and expand and collapse.

---

## Slice 4: Filter by author

**Backlog:** B-6. **User stories:** US 11–15, 17, 19 (author), 21, 28 (filters), 30 (reset on a filter change). **Blocked by:** 1 (landed). **Blocks:** 6, 7.

### What to build

The author half of the filters, end to end. `lib/timelineFilters.ts` already parses and builds everything (`parseFilters`, `setAuthor`, `clearAuthor`, `hasFilters`); this slice wires it.

- **Data path.** The route's loader passes both filters (not only `kind`) to `loadTimelineRows` and `useTimelineData`. `entriesQuery` (`lib/sync/timeline.ts`) and `timelineLinksQuery` (`lib/sync/providers.ts`) take the author too, from one shared, pure condition builder, so the "with …" lines always cover the same entries as the list. `useTimelineData` keys its paging on both filters, so any filter change starts from one page. `readingsQuery` is untouched: latest vitals ignores the filters.
- **Row.** `AuthorInitials` (`components/entry/KindIcon.tsx`) becomes a link beside `KindFilterLink`, built with `setAuthor`, with `replace` and `preventScrollReset`, `relative z-10` above `EntryOpenTarget`, named "Show only Alex Rivera's entries". Keep its `title` for now (slice 6 replaces it). Export it through the `components/entry` index.
- **Card.** The author's name in the card's footer becomes the same link with the same name.
- **Author chip.** With an author filter on, the filter row shows a `ChipGroup` link chip, current, that goes to `clearAuthor(search)`: the author's `UserAvatar`, "By Alex Rivera" and a ✕. `LinkChip` (`components/ui/chips.ts`) has only a text label today, so add two optional fields (a leading node for the avatar, and an accessible name such as "By Alex Rivera: clear this filter"); the kind chips don't change. The kind chips change only the kind, as now.
- **Empty state.** `emptyTimelineText` (`entryLabels.ts`, pure, tested) takes the filters and the author's name.
- An author id that isn't a current co-member still filters; `nameOf` already answers "Former member".

### Acceptance criteria

- [ ] Tapping caretaker@'s initials on a row shows only their entries, with `?author=<id>` in the URL and the author chip showing their avatar (initials for the seeds) and name.
- [ ] Then tapping a symptom's kind icon shows only that person's symptoms: the URL carries both, and both the kind chip and the author chip are on.
- [ ] The author chip clears the author and keeps the kind; "All" clears the kind and keeps the author.
- [ ] Tapping the same author's initials again changes nothing.
- [ ] In cards, the author's name is the same control with the same name.
- [ ] The control is reachable by Tab and activates with Enter; a tap elsewhere on the row still opens the entry.
- [ ] viewer@ can filter by author.
- [ ] After "Show older entries" and then a filter change, the list starts again from the newest entry with one page.
- [ ] With an author filter on, a note's "with …" line still shows (the links query follows the same filters).
- [ ] Offline (through `proxy.mjs`), both filters still work.
- [ ] A filter with no matches says so, naming the filter ("No symptoms by Alex Rivera yet" or similar), and the chips to clear it stay.
- [ ] Latest vitals doesn't change with the author filter.
- [ ] Unit tests: the shared condition builder with neither filter, kind, author and both (SQL and parameters in order, for both queries); `emptyTimelineText` for each combination. If a query module can't be imported without PowerSync, the builder lives in a pure module.
- [ ] `phase2.mjs` (one new function; the first three criteria are its smoke block) covers the combined filters, each clear, the re-tap and the keyboard, as writer and viewer in both views. `ui.mjs` covers the chip's new fields if it lists `ChipGroup`'s variants.

---

## Slice 5: Full width on large screens

**Backlog:** B-3. **User stories:** US 6–9. **Blocked by:** none. **Blocks:** none.

### What to build

From `lg`, the timeline uses the width it has. Below `lg`, nothing changes.

- **Width.** `route.tsx`'s `<main>` drops its `max-w-2xl` from `lg` (the 16 px gutters stay), so `TimelineHeader`, `LatestVitals`, `LiveNowBanner`, `QuickAddBar`, the filter row and the list span it.
- **Text cap.** `EntryBody` caps the heading, the "with …" line and the text at about 75ch, once, for rows and cards. In rows, the time, live dot, author control and ⋯ stay at the row's ends.
- **Card grid.** In `TimelineEntryList`, the cards list (`LIST_CLASS.cards`) becomes a grid inside each day: one column below `lg`, two from `lg`, three from `2xl`, with cards top-aligned. Rows view stays one entry per line.
- **The view marker.** `phase2.mjs`, `settings-layout.mjs` and `layout-offline.mjs` detect the cards view by the list's `space-y-2` class, which the grid removes. Give the list a `data-view` attribute and switch all three to it.

### Acceptance criteria

- [ ] At 1280 wide, the timeline spans the window (less the gutters) in both views, and the longest seeded note's lines are no wider than about 75ch.
- [ ] At 1280 wide, cards sit two to a row under their day heading; at 1536 or wider, three. A day with one card doesn't stretch it oddly, and a short card beside a tall one keeps its own height.
- [ ] In rows at 1280, the time, live dot, author control and ⋯ stay aligned at the row's ends, and "More"/"Less" still works on long text.
- [ ] At 420 wide, row and card widths and positions are the same before and after (compared in the check).
- [ ] No horizontal page scroll at 420, 1024, 1280 or 1536.
- [ ] The sticky day heading still spans the list and sticks, in both views at 1280.
- [ ] The entry sheet, the Live now banner and the delete confirm look right at 1280 (screenshots in the hand-off).
- [ ] `settings-layout.mjs` and `layout-offline.mjs` pass on `data-view`.
- [ ] `phase2.mjs` (one new function; the 1280 width and grid are its smoke block) covers the width, the text cap and the grid at 1280 and 1536, and the unchanged layout at 420.

---

## Slice 6: Author tooltip

**Backlog:** B-4. **User stories:** US 18. **Blocked by:** 4. **Blocks:** none.

### What to build

A `Tooltip` primitive in `components/ui/` (React Aria's tooltip, wrapped once; exported from the `ui` index), and its first use on the row's author control from slice 4.

- **The primitive.** Callers pass the content and one focusable child; no React Aria parts leave `ui/`. It opens on hover and on keyboard focus, never on touch, closes on Escape or when the pointer or focus leaves, and is the trigger's description (`aria-describedby`), never its name. It uses the shared surface class and sits above the sticky day headings. The trigger stays slice 4's React Router link, so check how the installed React Aria (1.22.1) lets a non-Aria element be a tooltip trigger before choosing the wrapper.
- **The use.** Hovering or focusing a row's initials shows the author's `UserAvatar` and full name. The plain `title` on the initials goes, so there's one tooltip, not two. A tap still filters. Cards already show the name, so they get no tooltip. A former member's tooltip says "Former member".
- **Size.** The `ui` index is in every `/app` page's chunk. Report what the tooltip adds; if it's more than about 1 KB gzipped, give it its own index as `ui/date/` has.

### Acceptance criteria

- [ ] Hovering a row's initials shows a tooltip with the avatar and the full name; moving away hides it.
- [ ] Focusing the initials by keyboard shows it; Escape or moving focus hides it.
- [ ] A touch tap filters by the author and shows no tooltip.
- [ ] The control's accessible name is still "Show only <name>'s entries", and the tooltip is its description. The initials have no `title`.
- [ ] The tooltip shows above the sticky day headings and isn't clipped by the row list's rounded border (`overflow-hidden`).
- [ ] No file outside `components/ui/` imports `react-aria-components`.
- [ ] `ui.mjs` covers the primitive (hover and focus, at 420 and 1280, light and dark). `phase2.mjs` (one new function; hover on one row is its smoke block) covers hover and focus on a row with real mouse moves over CDP, and that slice 4's filter steps still pass.

---

## Slice 7: Infinite scroll

**Backlog:** B-10. **User stories:** US 25–27, 28 (scrolling), 29, 30. **Blocked by:** 4. **Blocks:** none (the `search` PRD builds on it).

### What to build

Replace "Show older entries" with loading on scroll. The route doesn't change beyond a comment.

- **The hook.** `useTimelineData` keeps the paging (the limit grows by `PAGE_SIZE`, keyed on both filters by slice 4) and returns what the list needs in place of `showOlder`: `loadOlder`, `hasOlder`, and whether a page is loading. Both windowed queries (`entriesQuery`, `timelineLinksQuery`) grow together. Check that `useLiveQuery` keeps the rows it has while the larger query runs; if it doesn't, hold the previous rows in the hook, so the list never empties or jumps.
- **The list.** `TimelineEntryList` renders a sentinel after the last day in place of the button, as a small component of its own. An `IntersectionObserver` with a margin of about a screen calls `loadOlder` when it comes near. A polite live region says "Loading older…" while a page loads and "That's the beginning of the timeline" once there's nothing older; the end message is also visible at the bottom of the list. It works with either filter on, in rows and in the card grid, and offline.
- **Keeping your place.** New entries arriving at the top while you're scrolled down must not move what's on screen: check that the browser's scroll anchoring does this, and hold the position by hand if it doesn't.
- **The tab bar.** On phones, the sentinel and the last rows clear it through the layout's spacer; nothing offsets by hand.
- **Other checks.** `app-shell.mjs` (the end of the page clears the tab bar) and `routing.mjs` (the loaded pages survive opening and closing a sheet) press "Show older entries"; move both to scrolling.

### Acceptance criteria

- [ ] Scrolling to the end of the seeded timeline (about 180 entries, six pages) loads every page without a tap and ends with "That's the beginning of the timeline". There's no "Show older entries" button.
- [ ] With a filter that has fewer than 30 matches, the end message shows and nothing loads forever. An empty timeline shows its empty state, not the end message.
- [ ] While a page loads, the entries on screen don't move, and their "with …" lines don't flicker.
- [ ] Each page is announced once ("Loading older…"), and the end once, in a polite live region.
- [ ] Scrolled three pages down, an entry added by another signed-in browser appears at the top without changing what's on screen (the same row stays at the same offset).
- [ ] Adding, editing or deleting an entry while scrolled down keeps the pages already loaded, and so does opening and closing a sheet.
- [ ] Changing a filter starts from the newest entry with one page.
- [ ] Offline, scrolling loads every page from the device.
- [ ] At 420 wide, the last entry and the end message are fully visible above the tab bar.
- [ ] The hand-off notes the row count at which scrolling stays smooth (build a long timeline with a throwaway script, not committed, and not in the seeds).
- [ ] Unit tests for any pure paging rule (the next limit, when the end is reached, the announcement text).
- [ ] `phase2.mjs` (one new function; scrolling to the beginning in rows is its smoke block) covers scrolling to the beginning in both views, the reset on a filter change, and the kept place when an entry arrives. `app-shell.mjs` and `routing.mjs` pass without the button.

---

## For the orchestrator

- **Claim** each slice's item when its slice starts (`pnpm backlog claim B-<n>`), and mark it `done` when the slice merges: one item per slice, as in _Backlog map_.
- **Merge conflicts to expect:** `phase2.mjs` in every merge (each slice appends a function and a call: keep both). In wave 2, `route.tsx`, `TimelineEntryList`, the row and the card between 4 and 5. In wave 3, only `phase2.mjs` and the `ui` index. They're adjacent edits, not redesigns: keep both sides.
- **Other PRDs:** `invites` adds `InviteSomeoneCard` to the timeline's `route.tsx` (see _Status_). `search` waits on slices 1, 4 and 7. Tell the user before starting anything else that edits the timeline route folder while a wave is out.
- **At landing,** fold into AGENTS.md (_Timeline screen_, _Components_): the author filter and its controls, the shared query condition, the wide layout and `data-view`, the `Tooltip` primitive, and the infinite scroll (replacing "Show older"), with the new `phase2.mjs` coverage. Update the _Active PRDs_ line.
