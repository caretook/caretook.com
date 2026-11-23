# PRD: Jump to a day on the timeline

Topic `timeline-jump`. Backlog item B-557 (quick date jump on the timeline, by date picker and quick entry).

## Decisions

Costliest to change first. Nothing was asked: the user settled the product behaviour on B-557 on 2026-11-22, and this plan adds no table, migration, permission, dependency, vendor or change to stored data. Everyone who can read the timeline can already scroll to any day.

| Decision                                                                                                                                                                                        | Why                                                                                                                                                                                                            | Source                                     | Cost to change later                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| A jump loads a **bounded window**: the history query gains an optional upper bound (the end of the chosen day), and scrolling up loads newer days a page at a time                              | growing the limit to reach a far day would draw every row between today and that day, thousands after a year of use; one added condition keeps entries, provider links and medication names on the same window | assumed                                    | medium: the paging hook and its queries |
| The jump lives in the URL as `?day=YYYY-MM-DD`, owned by the timeline's filter module                                                                                                           | Back, reload and sheets keep it, as every other timeline view state does                                                                                                                                       | assumed                                    | low: one parameter                      |
| "A day" is the **viewer's** calendar day, for both the picker and quick entry's phrases                                                                                                         | the timeline's day headings are the viewer's; quick entry's logging reads in the recipient's zone, which would land "yesterday" on the wrong heading for a viewer elsewhere                                    | assumed                                    | low: one zone argument                  |
| Go to is a **separate whole-line reading**, not an assistant action                                                                                                                             | it saves nothing, so it must never reach the runner or the connector's shared action shapes                                                                                                                    | assumed                                    | low: one pure function                  |
| Quick entry jumps only when the **whole line** is a verb (go to, jump to, show) plus a day. "go to PT tomorrow", "show yesterday's bp to Sam" and "go to Nov 3, bp 120/80" log as they do today | the item's "only on an explicit phrase"; a health log must not lose a line to a navigation guess                                                                                                               | preference: B-557, narrowed by assumption  | low: one parser rule                    |
| A phrase with a time of day ("go to yesterday 9pm", "show last night") isn't a jump                                                                                                             | the jump's unit is a day; those lines keep today's reading                                                                                                                                                     | assumed                                    | low                                     |
| A future day in a Go to phrase shows a blocked Go to card ("The timeline ends today") and saves nothing                                                                                         | the picker's rule is past dates through today; falling through would save "go to tomorrow" as a todo                                                                                                           | assumed                                    | low                                     |
| A jump keeps the kind, author and vital filters and ends a search; changing any filter afterwards returns to the newest entries                                                                 | filters narrowing a day are useful; a search has its own period control; a new filter already starts from the newest                                                                                           | assumed                                    | low                                     |
| An empty day lands on the nearest earlier day with entries **under the filters on**, and says so. With nothing on or before the day, it says that and shows the oldest day                      | the item's rule, extended to the one case it doesn't reach                                                                                                                                                     | preference: B-557, the second half assumed | low                                     |
| The picker is a calendar button in the timeline's toolbar, for every role and both views, opening a small popover with a native date input and Go                                               | native elements first, and it keeps the 40 KB calendar chunk off the timeline's first load                                                                                                                     | assumed                                    | low: one component                      |
| Back to today is a floating control shown while `?day=` is on, with the date button beside it                                                                                                   | the item names the control; it has to stay in reach far down the list                                                                                                                                          | assumed                                    | low                                     |

**Skeptic pass:** it moved no decision to "ask". Taken: the landing scroll fires only on a jump, Go to has its own date rules, the newer-edge query is named and tested, each parallel slice has its own test file, the scroll hold is tested with native anchoring off, the hot files are declared, and the date button stays in reach after a jump. Declined: moving kept paging out of slice 1 (Back to a day is part of opening one) and a regions slice (the edits to the shared files are small and additive, and the declared hot files keep overlapping topics apart).

## Problem

A caretaker preparing for a visit, or checking what happened on a given day, has to scroll back page by page. The timeline loads 30 entries at a time, so reaching last month is slow and reaching last year is impractical.

## Solution

From the timeline's toolbar, or by typing "go to Nov 3" in quick entry, the caretaker lands on that day in the same continuous timeline. They can scroll either way from there, and Back to today returns them to the top. If nothing was logged that day, they land on the nearest earlier day and are told so. It all works offline, from the device's copy.

## User stories

1. As a caretaker, I want to pick a date from the timeline, so that I reach that day without scrolling.
2. As a caretaker, I want to type "go to Nov 3", "jump to last Tuesday" or "show yesterday" in quick entry, so that I can get there from the box I already use.
3. As a caretaker, I want a Go to card that shows the day before I go, and saves nothing, so that a navigation never becomes a log entry.
4. As a caretaker, I want ordinary lines that mention going somewhere to keep logging as they do, so that "go to PT tomorrow" is never mistaken for a jump.
5. As a caretaker, I want to scroll both older and newer from the day I landed on, so that it's still one continuous timeline.
6. As a caretaker, I want a Back to today control, so that I can return at once.
7. As a caretaker, I want to be told when the day I chose has no entries and which day I'm seeing instead, so that I don't misread it as that day's record.
8. As a viewer or Easy helper, I want the date jump too, so that anyone who can read the timeline can find a day.
9. As a caretaker, I want the jump to survive opening an entry and coming Back, and a reload, so that I don't lose my place.
10. As a caretaker offline, I want jumping to work, so that I can find a day at an appointment with no signal.

## Implementation decisions

- **The day parameter** (the timeline's filter module, pure): reads and writes `?day=`. A malformed or impossible date reads as no jump, and so does a day after the viewer's today. Setting a day keeps kind, author and vital and clears the search and its period. Changing any filter clears the day.
- **The history window** gains an optional exclusive upper bound. Entries, provider links and medication names all read through the one window, so they stay in step. The bound is the start of the day after the chosen one in the viewer's zone, DST-safe. The existing cutoff rule still applies. No new index: `(group_id, occurred_at)` serves it.
- **Landing needs no lookup.** The window's first row is the nearest entry on or before the chosen day. If its day differs, the list says so. A row synced later onto the chosen day simply appears.
- **Paging both ways** (a pure module plus the timeline's data hook): the state is the upper bound and the limit. Loading newer moves the bound up to a **whole day's** end, at least a page further, and grows the limit by the rows added, so a day or a pass log is never split at the top edge. One small **newer-edge query** (the next rows above the bound, oldest first, under the same filters and cutoff) supplies this. When fewer than a page remain, the bound clears and the window is the ordinary history. Kept paging for Back stores the bound with the limit and treats the day as part of its key.
- **What else follows the window:** day summaries read only up to the bound (today they read from the oldest loaded day to now, which a far jump would make huge). Care period markers stay inside the bound. The Today heading and the empty-Today prompt show only once the window reaches today.
- **Landing scroll:** runs only for a navigation carrying a jump marker in its link state, and on a fresh load of a `?day=` URL. A repeat jump to the same day scrolls again. Opening or closing a sheet never scrolls, and Back leaves the position to scroll restoration. It waits until the new window has replaced the old rows, and places the day's heading clear of the sticky header.
- **Scrolling up** holds the viewport by measurement, because iOS Safari has no reliable scroll anchoring. The list sets `overflow-anchor: none` while a bound is on, so browsers with native anchoring don't correct the position twice. Days added above are drawn before they may skip rendering, so an estimated height never moves the page.
- **The Go to reading** (a pure function beside the quick-entry parser): takes the whole line, the clock and the viewer's zone; returns nothing, or the day and whether it's ahead of today. It reuses the time-phrase finder, reading the words after the verb as if they followed "on" (so "11/10" and "3 Nov" are dates here, though not in a log line), and requires every one to be used, with a day and no clock or period. It accepts a four-digit year after a month name, which the finder doesn't, and validates the date itself, since the finder accepts "Feb 30". It runs before the line is split, so "go to Nov 3, 2025" stays whole. `n:` and other prefixes keep their meaning.
- **The box:** with a Go to reading, it shows one Go to card instead of the save cards. Enter or Go navigates, clears the box and records no recent line. Nothing reaches the runner.
- **No server, API, sync-config, schema or connector change.**

## Testing decisions

- **Unit:** the day parameter (with every existing filter function's interaction), the two-way paging rules, the day bounds across DST, and a table of Go to phrases and the neighbours that must not match, following `quickEntryTime.test.ts`.
- **Local query tests:** the bounded window, summaries and newer-edge query, following `timelineWindows.sync.test.ts`, including that the three window queries agree.
- **Component tests** on `timelineWorld`, one file per parallel slice: a jump file (landing, notices, Back to today, sheets and Back keeping the scroll), a jump paging file (scrolling up with the position held), a picker file, and the existing quick-entry file (the Go to card saving nothing).
- **No browser check:** the feature is a local read with no server or sync path.

## Out of scope

- Jumping to a future day or to upcoming events (the Planner has those).
- A time of day as a jump target.
- Jump phrases in the connector tools.
- The Planner, search page and other lists.
- Calendar marks showing which days have entries.

## Notes

- B-313 (the timeline loads every note document) is a separate performance item; this plan neither fixes nor worsens it.
- Other topics share files with this one: `symptom-catalog` and `tags` (the timeline's filters and queries, and for `symptom-catalog` quick entry), `sync-safety` (provider links and `lib/sync/`), `onboarding` and `ui-kit-5` (the timeline folder). The topic's row declares its hot files so the dispatcher can keep them apart.
