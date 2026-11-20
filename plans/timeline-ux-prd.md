# PRD: Timeline UX

**✅ Done (2026-11-20):** all 10 slices are in `dev` (last landing 8b3179ab); the lasting decisions are in the area docs (timeline, sync, app-shell, assistant, auth, api, care-periods, medications, security-headers).

Topic `timeline-ux`. Backlog items B-136, B-137, B-138, B-139, B-140, B-144, B-155, B-156 (the speed half, from `app-speed`), B-166, and B-162, B-163, B-164, B-165, B-167, B-168, B-169, B-170, B-171 (the timeline and simple mode). Interviewed 2026-11-20.

**This PRD absorbs `app-speed`.** [`app-speed-prd.md`](app-speed-prd.md) stays as written and is this PRD's speed half: its problem statement, user stories 1–40 and decisions carry over unchanged (the user, 2026-11-20). Its plan, `app-speed-plan.md`, is superseded by [`timeline-ux-plan.md`](timeline-ux-plan.md). Why one PRD: both halves wait on `code-layout` (it moves `lib/` and `routes.ts`), and both touch the timeline route, its header and its rows, so one plan orders those edits instead of splitting the screen into regions first.

## Problem statement

The speed half's problem is in `app-speed-prd.md`. On the screen itself, caretakers using the timeline every day hit these:

- **The header jumps.** Going Back to the timeline from an entry page (or any browse) remounts the route. The medication and task strips (and simple mode's tiles) render nothing until their live queries answer, then pop in and push the page down (B-166).
- **Four strips, four styles.** Latest vitals, the next appointment, medications due and overdue tasks are separate strips, each with a different right-side control: "All vitals" expands in place, "Show upcoming" toggles a list, "Given all" is an action, and tasks have none. Nothing says at a glance what needs attention (B-169).
- **The day heading is small** next to its + button (B-164), and **the day summary scrolls away** under the sticky heading (B-167).
- **Rows waste width.** The author's initials chip sits between the text and the ⋯ menu (B-165). Care-period lines show the place, which makes long titles wrap on phones and adds little (B-168).
- **Quick entry:**
  - The tips paragraph ("Try “bp 130/85 hr 72”, …") takes room on every visit (B-163).
  - A note or event typed in the box saves and stays on the timeline, so adding detail to its live document takes an extra tap (B-170).
  - "Your recent lines" repeat whole notes, and a recent vital comes back with its old value, which has to be deleted before typing the new one (B-171).
- **Simple mode** puts the Now block and the action tiles between the box and the timeline. The tiles wrap onto two rows, all text is oversized (people who need large text set it on the device or browser), and the "Tap the microphone on your keyboard" tip shows on desktops that have no such key (B-162).

## Solution

- **The speed half** as `app-speed-prd.md` decides: navigation that doesn't wait, prefetched and instantly highlighted section tabs, cheap off-screen rows, a bundle budget, a service worker, and cheaper `/rpc` auth.
- **Tiles paint at once.** Each header tile keeps its last results in memory for the session. On a return they paint immediately, slightly dimmed, and brighten when the live query confirms. A first visit after a reload shows a fixed-height skeleton, so nothing shifts.
- **One Today card** on the full timeline replaces the four strips: a row each for vitals, the next appointment, medications due and overdue tasks, each with status highlighting and the same "See all ›" link on its right. It collapses to a one-line summary, remembered per device.
- **The day header** carries a larger date and that day's summary line, so both stick while the day scrolls.
- **Rows:** the author chip moves under the ⋯ menu; the timeline no longer shows care-period places.
- **Quick entry:** the tips become a rotating placeholder; a line that saves a lone note or event opens its page; recent lines drop notes and events, and a vital comes back as its key only.
- **Simple mode:** the box sits directly above the timeline, "Now" is renamed "Upcoming", the action tiles fit one row of smaller buttons, the text uses the full timeline's scale, and the mic tip shows only on phones and tablets.

## User stories

1–40 are `app-speed-prd.md`'s, unchanged.

41. As a caretaker coming Back to the timeline from an entry, I want the header tiles to be there at once, so the page doesn't jump while I'm reaching for something.
42. As a caretaker, I want a tile showing remembered results to look slightly dimmed until it's confirmed, so I know it may be about to change.
43. As a caretaker opening the app fresh, I want the tiles' space reserved, so the timeline doesn't shift down when they arrive.
44. As a caretaker, I want vitals, the next appointment, medications due and overdue tasks in one card, so I see what needs attention in one place.
45. As a caretaker, I want overdue items in red, due-now items in amber and appointments soon in blue, each with an icon, so urgency stands out without reading every row (and without relying on colour alone).
46. As a caretaker, I want each row of the card to end in the same "See all ›" link to its full view, so I always know where to go for more.
47. As a caretaker, I want to collapse the card to a one-line summary, and have it stay collapsed on this device, so it doesn't take my screen on days I don't need it.
48. As a caretaker, I want "Given all" to stay on the medications row, so I don't lose the quick action.
49. As a caretaker reading the timeline, I want the date heading large enough to read next to its + button.
50. As a caretaker scrolling back through a day, I want its summary to stay pinned with its date, so I keep the context.
51. As a caretaker on a phone, I want the author chip out of the text's way, so entries use the width.
52. As a caretaker, I want care-period lines on the timeline without the place, so they fit on one line; the period's page still shows it.
53. As a caretaker typing in the box, I want example lines to rotate through its placeholder, so I learn the syntax without a paragraph in the way.
54. As a caretaker typing "n: …" or an appointment in the box, I want its page to open after saving, so I can keep writing in its live document.
55. As a caretaker typing several entries in one line, I want to stay on the timeline, since there's no single page to open.
56. As a caretaker, I want my recent lines to leave out notes and events, which are rarely repeated.
57. As a caretaker logging a vital again, I want its recent chip to fill only the key ("bp "), so I type the new value without deleting the old one.
58. As a simple-mode user, I want the box directly above the timeline, as in the full layout.
59. As a simple-mode user, I want the block of what's next headed "Upcoming", which says what it is.
60. As a simple-mode user, I want the quick action buttons in one row, so they take less room.
61. As a simple-mode user, I want normal text sizes, because I set large text on my device if I need it.
62. As a simple-mode user on a desktop, I don't want a tip about a keyboard microphone I don't have.

## Implementation decisions

The speed half's decisions are `app-speed-prd.md`'s (15-minute fresh session, the 3 s `NETWORK_ANSWER_MS`, cache-first settings, the 3-minute cookie cache and its written-up tradeoff, the hand-written web-only service worker with the "A new version is ready: Reload" notice, the bundle budget at today's build + 10%), unchanged. File paths follow `code-layout`'s new `lib/` layout, which lands first.

**Tiles that remember (B-166):**

- A small device-side cache of last results, keyed by user, group and query, held in memory for the session (never `localStorage`: health data). A hook wraps `useLiveQuery` with it, returning `{ value, fresh }`.
- Remembered values render with a `data-stale` attribute and reduced opacity until the live query's first answer; the answer replaces them, whatever it says.
- With nothing remembered, the tile renders a skeleton of its usual height (not null), so the layout is fixed from the first paint. A tile that turns out empty collapses once, after its first answer.
- Used by the Today card's rows, simple mode's Upcoming block, its tasks card and its tiles. Cleared at sign-out with the rest of the device's state.
- This is not the clientLoader: the loader doesn't take on these queries, so navigation doesn't wait for them (B-136).

**The Today card (B-169), full timeline only:**

- Replaces `LatestVitals`, `NextStrip`, `MedicationStrip` and `TaskStrip` in the full timeline's header. Simple mode keeps its own blocks.
- Rows, each hidden when it has nothing: vitals (latest readings and time), next appointment, medications due (with "Given all" when writable), overdue tasks.
- **Status hues** (daisyUI theme colours as a tinted row background plus an icon, never colour alone): an overdue dose or task is `error`, a dose due now is `warning`, an appointment today or within 2 hours is `info`, vitals are neutral and turn `warning` once the latest reading is more than a day old. A pure `todayStatus` function decides each row's status.
- **"See all ›"** on every row, styled alike: vitals → the timeline filtered to vitals, appointment → Upcoming, medications → the medications section, tasks → the tasks section. The upcoming list toggle (`?upcoming=1`) and the "All vitals" expander go; their full views are the links.
- **Collapse:** the card header toggles it to a one-line summary ("BP 130/85 · 1 appt · 2 due · 1 overdue"); the choice is a per-device preference in `localStorage` (a convenience, no health data stored).
- Shown at every width (the vitals strip is hidden below `sm` today).

**Day header and rows (B-164, B-167, B-165, B-168):**

- The date heading grows to balance the `btn-sm` + button (`text-lg`, `lg:text-xl` as a starting point; tuned against the button in the component test's screenshot).
- Each day's `DaySummaryLine` moves inside that day's sticky `DayHeader`, as one truncated line under the date; tapping still expands it. Filters still hide it.
- The author chip moves into a right-hand column under the ⋯ menu, same size, still linking to `?author=` with its tooltip. Simple mode's plain tile moves the same way.
- The timeline stops showing care-period places: the day header's period line and the period marker rows drop the place name and detail. The period's page still shows them.
- Off-screen rows get `content-visibility` here (the speed half's B-139), so the rows are edited once.

**Quick entry (B-163, B-170, B-171):**

- The tips paragraph goes. The box's placeholder rotates through examples ("bp 130/85 hr 72", "gave metformin", "pain 4 left knee", "appt Dr Lee Friday 2pm", "n: slept well"), one every few seconds while the box is empty and unfocused, and stops under `prefers-reduced-motion` (showing the first). The accessible description keeps the full rules (commas separate entries, "n:" for a note), so screen readers still get them.
- After a successful save, if the line produced exactly one entry and it is a note or an event, navigate to its entry page; otherwise stay as now. A pure rule decides it from the saved entries.
- `recordLine` stores a reduced line: notes and events are not recorded; a vital line is stored as its keys only ("bp hr "), so the chip fills the keys and the user types the values. Lines already stored are filtered the same way on read.

**Simple mode (B-162):**

- Order: header, Upcoming (the renamed Now), tasks, tiles with Remove last, then the box directly above the timeline.
- The tiles shrink to one row of smaller buttons (still 44 px tap targets), scrolling sideways if a phone can't fit them.
- Text uses the full timeline's type scale: no `text-2xl` headings, no 1.25× day-summary zoom, the box at the normal size.
- The mic tip shows only on phones and tablets: a coarse pointer plus an iOS or Android user agent, in a pure `canDictate(navigator)` rule.

**Shared and hot files:** the timeline route and `SimpleTimeline` (slices 5, 6, 8), `DayHeader` and `TimelineEntryList` (6), the row components (6), `QuickEntryBox` and its suggestions (9; 8 changes only the box's size prop). Additive `check-areas.d/` rules for new modules. No migration, no seeds, no new dependencies.

## Testing decisions

- Test external behaviour, as the screen or the function's caller sees it.
- **Pure modules get unit tests:** the speed half's (`sessionRules`, `settingsPlan`, the budget, `routeRequest`), plus the tile cache, `todayStatus`, the open-after-save rule, the recent-line reducer and `canDictate`.
- **Screens get component tests** (`docs/domain/components.md`): the Today card (rows, hues, links, collapse remembered), remembered tiles dimmed then fresh and skeletons on a first visit, the day header with its summary, rows with the chip under the menu and no place, simple mode's order and sizes, the rotating placeholder, and quick entry opening the page. Existing `timeline*.browser.test.tsx` files are updated where they assert the old strips, order or tips.
- **End-to-end only where the speed half already said so** (`session-end`, `layout-offline`, `sign-in`), extending those checks. If `check-migration` has ported the lean set to Playwright by then, the same steps go in the ported checks.
- Prior art: `timelineScroll.browser.test.tsx`, `timelineSimple*.browser.test.tsx`, `timelineQuickEntry*.browser.test.tsx`, `sessionRules.test.ts`.

## Out of scope

- The speed half's out-of-scope list (virtualization, background sync, push, caching `/rpc` in the worker, native speed, RUM, server-side caching).
- The combined card in simple mode (simple mode keeps its blocks, renamed).
- Truncating entry titles or provider names (B-168 turned out to be care-period places).
- A tips popover or tooltip.
- Persisting the tile cache across reloads.
