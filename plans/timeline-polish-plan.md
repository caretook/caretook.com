# Plan: Timeline polish

> Source PRD: [`plans/timeline-polish-prd.md`](timeline-polish-prd.md). User-story numbers (US) refer to it. Backlog items B-2, B-3, B-4, B-5, B-6, B-7 and B-10. Topic `timeline-polish`.

## Status

| Slice | Backlog | State           | Merge into `prd/timeline-polish` (slice commits) |
| ----- | ------- | --------------- | ------------------------------------------------ |
| 1     | B-5     | merged (wave 1) | `5d6678a` (`9b23d14`, `4c14096`)                 |
| 2     | B-7     | merged (wave 1) | `cf96edc` (`47a2792`)                            |
| 3     | B-2     | merged (wave 1) | `908d4fa` (`4b1b280`, `cf12f43`)                 |
| 4     | B-6     | ready (wave 2)  |                                                  |
| 5     | B-3     | ready (wave 2)  |                                                  |
| 6     | B-4     | blocked by 4    |                                                  |
| 7     | B-10    | blocked by 4    |                                                  |

Wave 1 (slices 1–3) is merged, synced with `dev` (which now has all of `app-shell`) and green: `pnpm check`, and `phase2.mjs`, `roundtrip.mjs` and `live-notes.mjs` after each merge. Its worktrees are removed. **It landed in `dev` as `644f780`** (2026-11-18), and B-5, B-7 and B-2 are `landed`. Nothing is in flight; wave 2 (slices 4 and 5) starts when the user says so.

For slice 4: `lib/timelineFilters.ts` is complete for both filters (`parseFilters`, `setKind`, `setAuthor`, `clearKind`, `clearAuthor`, `clearFilters`, `hasFilters`); an author must be UUID-shaped and membership isn't checked. For slice 5: the day heading is 40 px tall (44 px from `lg`), and the vitals line shows more readings as the column widens.

Open issues:

- **Phones hide the visible "Latest" label** on the vitals line (screen-reader only below `sm`), because only one seeded reading fits beside it at 420. The PRD asked for the label and two readings; the user has been asked and hasn't decided.
- Under load (ten stacks), `live-notes.mjs` failed once per run on a timing step (PowerSync reconnect, the Live now banner within 2 s) and passed on the rerun each time. Not caused by this wave.
- `phase2.mjs` steps that reload the page can log `[PowerSync]: Sync error` (the old page's connection closing). `kindIconFilters` filters it for its own steps only; the shared noise pattern doesn't cover it yet.

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
- **No schema, migration, sync-config, seed or API change, and no new dependency.** Everything reads what the device already has (`timeline_entry.created_by`, the `member_profiles` stream). The tooltip uses React Aria Components, which is already installed.
- **Filter state lives in the URL:** `?kind=<kind>&author=<userId>`. One pure module owns it: parsing (unknown values are ignored), and the search string for set kind, set author, clear kind, clear author and clear all. Setting a filter that's already on returns the same search. Every filter control (the chips, the row's icon and initials, the author chip) is a `Link` built through it, with `replace` and `preventScrollReset`. `search` will build on this module.
- **Local query:** the entries query takes optional `kind` and `author` (`created_by = ?`) and a limit. Paging stays "the limit grows by 30"; a filter change starts again from the first page.
- **Latest vitals ignores the filters.**
- **Row and card controls:** the kind icon and the author control are links of their own, `relative z-10` above the stretched `EntryOpenTarget`, like the ⋯ button. Names: "Show only <kind plural>" and "Show only <name>'s entries". Viewers get them too.
- **Author display:** names and avatars come from the local members query, through the shared `UserAvatar`. Someone who's no longer a co-member is "Former member".
- **Day labels:** a pure `dayLabel(iso, timeZone, now)`: "Today", "Yesterday", else "Monday, Nov 16", with ", 2025" when the year isn't this one.
- **Layout:** phones don't change beyond the vitals line, the day headers and the new controls. From `lg`, the timeline drops its `max-w-2xl` (16 px gutters stay), entry text is capped at about 75ch, and cards form a grid (two columns, three at `2xl`) inside each day. The `/app` header isn't sticky, so day headers keep sticking to the top of the window.
- **The tab bar** (phones): the layout already leaves a spacer of `--tab-bar-height` below the outlet. Nothing here offsets for it by hand, and nothing is added that's fixed to the bottom.
- **Hot files:** `timeline.tsx` (every slice), `TimelineEntryRow`/`Card` and `KindIcon.tsx` (slices 1, 4, 5, 6), `TimelineFilters` (1, 4), `LatestVitals` (3), `lib/sync/timeline.ts` (4), `lib/format.ts` (2), and `scripts/browser-checks/phase2.mjs` (every slice). Stay away from the layout toggle's handler (`changeView`, `saveSettings`).

## How to run this plan

- **Wave 1: slices 1, 2 and 3 in parallel.** They barely overlap: 1 is the filter module, the chips and the kind icon; 2 is the day heading; 3 is `LatestVitals`.
- **Wave 2: slices 4 and 5 in parallel.** 4 needs 1's filter module. 5 is blocked by nothing, but it restyles the rows, cards and day sections that wave 1 edits, so it's easier to merge once those are in.
- **Wave 3: slices 6 and 7 in parallel.** 6 wraps the author control that 4 makes; 7 changes the paging that 4 re-keys to both filters.
- Merge in number order. Each wave is worth landing in `dev` by itself.
- **`phase2.mjs` is shared by every slice.** Each slice adds its steps as one new function, called at the end of the run, and leaves the header comment alone (the orchestrator updates it at merge). After each merge, run the whole file against a freshly started server, in both views, plus `live-notes.mjs` and `roundtrip.mjs` (they tap rows and use the timeline).
- Every slice ends with `pnpm check` passing, its `phase2.mjs` steps, and a hand-off (AGENTS.md, _Loop rules_). No slice needs `pnpm datastore:reset`.

```
1 ── 4 ──┬── 6
         └── 7
2
3
5 (independent; planned for wave 2)
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

**Backlog:** B-6. **User stories:** US 11–15, 17, 19 (author), 21, 28 (filters), 30 (reset on a filter change). **Blocked by:** 1. **Blocks:** 6, 7.

### What to build

The author half of the filters, end to end. The loader and the live query read `author` from slice 1's module and filter the local query on it, alongside `kind`. In rows, the author's initials become a link named "Show only Alex Rivera's entries"; in cards, the author's name becomes the same control. With an author filter on, an author chip in the filter row shows their avatar and name ("By Alex Rivera ✕", through `UserAvatar`) and clears only the author; the kind chips change only the kind. Paging is keyed on both filters, so any filter change starts from the newest entries. The empty state names what's filtered. An author id that isn't a current co-member still filters, and its chip reads "By Former member".

### Acceptance criteria

- [ ] Tapping caretaker@'s initials on a row shows only their entries, with `?author=<id>` in the URL and the author chip showing their avatar (initials for the seeds) and name.
- [ ] Then tapping a symptom's kind icon shows only that person's symptoms: the URL carries both, and both the kind chip and the author chip are on.
- [ ] The author chip's ✕ clears the author and keeps the kind; "All" clears the kind and keeps the author.
- [ ] Tapping the same author's initials again changes nothing.
- [ ] In cards, the author's name is the same control with the same name.
- [ ] The control is reachable by Tab and activates with Enter; a tap elsewhere on the row still opens the entry.
- [ ] viewer@ can filter by author.
- [ ] After loading older entries and then changing a filter, the list starts again from the newest entry.
- [ ] Offline (through `proxy.mjs`), both filters still work.
- [ ] A filter with no matches says so, naming the filter ("No symptoms by Alex Rivera yet" or similar), and the chips to clear it stay.
- [ ] Latest vitals doesn't change with the author filter.
- [ ] Unit tests for the local query builder: neither filter, kind, author, both (SQL and parameters in the right order). If the query module can't be imported without PowerSync, move the builder somewhere pure rather than skip the test.
- [ ] `phase2.mjs` covers the combined filters, each clear, the re-tap and the keyboard, as writer and viewer in both views.

---

## Slice 5: Full width on large screens

**Backlog:** B-3. **User stories:** US 6–9. **Blocked by:** none (planned for wave 2: it restyles what wave 1 edits). **Blocks:** none.

### What to build

From `lg`, the timeline uses the width it has: no `max-w-2xl`, the 16 px gutters kept, with the heading, vitals line, Live now banner, quick-add bar and filter row spanning it. An entry's title and body are capped at about 75 characters per line, in rows and in cards. In cards view, each day's cards form a grid of two columns at `lg` and three at `2xl`, still under that day's sticky heading. Rows view stays one entry per line. Below `lg`, nothing changes.

### Acceptance criteria

- [ ] At 1280 wide, the timeline spans the window (less the gutters) in both views, and the longest seeded note's lines are no wider than about 75ch.
- [ ] At 1280 wide, cards sit two to a row under their day heading; at 1536 or wider, three. A day with one card doesn't stretch it oddly.
- [ ] In rows at 1280, the time, live dot, author control and ⋯ stay aligned at the row's ends, and "More"/"Less" still works on long text.
- [ ] At 420 wide, a screenshot before and after shows the same layout (compare row and card widths and positions in the check).
- [ ] No horizontal page scroll at 420, 1024, 1280 or 1536.
- [ ] The entry sheet, the Live now banner and the delete confirm look right at 1280.
- [ ] `phase2.mjs` covers the width, the text cap and the grid at 1280, and the unchanged layout at 420.

---

## Slice 6: Author tooltip

**Backlog:** B-4. **User stories:** US 18. **Blocked by:** 4. **Blocks:** none.

### What to build

A React Aria `TooltipTrigger` on the author's initials in rows: hovering or focusing them shows the author's avatar (`UserAvatar`) and full name. It never opens on touch, and it doesn't change what a tap does (slice 4's filter). The plain `title` on the initials goes, so there's one tooltip, not two. Cards already show the name, so they get no tooltip. A former member's tooltip says "Former member".

### Acceptance criteria

- [ ] Hovering a row's initials shows a tooltip with the avatar and the full name; moving away hides it.
- [ ] Focusing the initials by keyboard shows it; Escape or moving focus hides it.
- [ ] A touch tap filters by the author and shows no tooltip.
- [ ] The control's accessible name is still "Show only <name>'s entries", and the tooltip is its description.
- [ ] The tooltip shows above the sticky day headings and isn't clipped by the row list's rounded border.
- [ ] `phase2.mjs` covers hover and focus (real mouse moves over CDP), and that slice 4's filter steps still pass.

---

## Slice 7: Infinite scroll

**Backlog:** B-10. **User stories:** US 25–27, 28 (scrolling), 29, 30. **Blocked by:** 4. **Blocks:** none (the `search` PRD builds on it).

### What to build

Replace "Show older entries" with loading on scroll. A sentinel after the last entry, watched by an `IntersectionObserver` with a margin of about a screen, grows the local query's limit by a page (30) when it comes near. The rows already shown stay while the larger query runs, so the list doesn't jump. A polite live region says "Loading older…" while a page loads and "That's the beginning of the timeline" once the query returns no extra row; that end message is also visible at the bottom of the list. It works with either filter on, and offline. New entries arriving at the top while you're scrolled down must not move your place: check that the browser's scroll anchoring does this, and hold the position by hand if it doesn't. On phones, the sentinel and the last rows clear the tab bar through the layout's spacer.

### Acceptance criteria

- [ ] Scrolling to the end of the seeded timeline (about 180 entries, six pages) loads every page without a tap and ends with "That's the beginning of the timeline". There's no "Show older entries" button.
- [ ] With a filter that has fewer than 30 matches, the end message shows and nothing loads forever. An empty timeline shows its empty state, not the end message.
- [ ] While a page loads, the entries on screen don't move.
- [ ] Each page is announced once ("Loading older…"), and the end once, in a polite live region.
- [ ] Scrolled three pages down, an entry added by another signed-in browser appears at the top without changing what's on screen (the same row stays at the same offset).
- [ ] Adding, editing or deleting an entry while scrolled down keeps the pages already loaded.
- [ ] Changing a filter starts from the newest entry with one page.
- [ ] Offline, scrolling loads every page from the device.
- [ ] At 420 wide, the last entry and the end message are fully visible above the tab bar.
- [ ] The hand-off notes the row count at which scrolling stays smooth (build a long timeline with a throwaway script, not committed, and not in the seeds).
- [ ] `phase2.mjs` covers scrolling to the beginning in both views, the reset on a filter change, and the kept place when an entry arrives.

---

## For the orchestrator

- **Claim** each slice's item when its slice starts (`pnpm backlog claim B-<n>`), and mark it `done` when the slice merges: one item per slice, as in _Backlog map_.
- **Merge conflicts to expect:** `timeline.tsx` and `phase2.mjs` in every merge; the row, card and `KindIcon.tsx` between 1 and 4, and between 5 and anything that runs with it. They're adjacent edits, not redesigns: keep both sides.
- **Other PRDs:** `app-shell` slice 7 touches only Settings and the layout preference, not this plan's files. `search` waits on slices 1, 4 and 7. Tell the user before starting anything else that edits `timeline.tsx` while a wave is out.
- **At landing,** fold into AGENTS.md (_Timeline screen_): the filter module and URL shape, the row controls, the one-line vitals, `dayLabel`, the wide layout and the infinite scroll (replacing "Show older"), and the new `phase2.mjs` coverage.
