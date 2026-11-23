# Plan: Jump to a day on the timeline

> Source PRD: [`plans/timeline-jump-prd.md`](timeline-jump-prd.md). User-story numbers (US) refer to it. Backlog item B-557. Topic `timeline-jump`.

## Status

Not started.

| Slice | Wave | State | Merge into `prd/timeline-jump` (slice commits) |
| ----- | ---- | ----- | ---------------------------------------------- |
| 1     | 1    | ready | —                                              |
| 2     | 2    | ready | —                                              |
| 3     | 2    | ready | —                                              |
| 4     | 2    | ready | —                                              |

**Backlog:** claim B-557 when slice 1 starts; run `pnpm backlog done B-557` when the last slice merges.

## Architectural decisions

Durable decisions every slice follows:

- **Route:** `/app/groups/:groupId/timeline?day=YYYY-MM-DD`. The timeline's filter module owns the parameter; every control builds its link through it.
- **One window:** entries, provider links and medication names read through the history window with the same optional upper bound. The only other range read is slice 2's newer-edge query, under the same filters and cutoff.
- **A day is the viewer's calendar day**, as the day headings are.
- **Go to saves nothing:** it isn't an assistant action and never reaches the runner, the connector or recent lines.
- **No migration, sync-config, server, API or dependency change.** A slice that finds it needs one stops and tells the orchestrator.
- **The PRD's _Decisions_ table is the spec.** Loops don't edit docs; the orchestrator folds the rules into [timeline](../docs/domain/timeline.md) and [assistant](../docs/domain/assistant.md) at landing.

## How to run this plan

- **Waves:** (1) → (2, 3, 4). The PRD lands once, after wave 2, so no one meets a jump that can't scroll newer.
- **Gates:** each slice hands off on its own tests and `pnpm prd check --quick`. No browser check is added or edited.
- **Ownership:** slice 1 the day parameter, the bounded window and landing; slice 2 paging newer and the scroll hold; slice 3 the toolbar control; slice 4 the Go to reading and the quick-entry box.

## Slice 1: Open the timeline on a day

Stack: no · Reads: docs/domain/timeline.md, docs/domain/sync.md, docs/domain/components.md · Tests: unit, component

**User stories:** 6, 7, 8, 9, 10

Opening the timeline with `?day=` shows that day first, bounded, with its notice and Back to today.

**Build:**

- The day parameter: read, set, clear; invalid or future reads as none; setting keeps kind, author and vital and ends a search; any filter change clears it.
- The optional upper bound through the history window, its links and medication names, the loader and the live hook. Summaries read up to the bound; markers stay inside it; the Today heading and empty-Today prompt wait for a window that reaches today.
- The landing scroll: only for a navigation carrying a jump marker in its link state, or a fresh load of a `?day=` URL; after the new window's rows are in; clear of the sticky header.
- The notice for an empty day, and for nothing on or before the day. With nothing on or before it, the window is empty until slice 2 loads the oldest day; here the list shows the notice and Back to today.
- Back to today, for full and easy views. Kept paging holds the day, so Back from an entry returns to it.

**Acceptance criteria:**

- [ ] Unit: the day parameter's table (malformed, impossible, future, each filter change) and the day's end across both DST changes.
- [ ] Local query test: the bounded window excludes the next day's first moment, includes the day's last, and entries, links and medications agree.
- [ ] Component test (new timeline jump file): opening on a far day shows it first with no newer rows and no Today heading; an empty day says which day is shown; a kind filter changes which day is nearest; Back to today returns to the newest; Back from an entry restores the day and the scroll position; opening and closing a sheet on `?day=` leaves the scroll where it was.

**Blocked by:** none. **Blocks:** 2, 3, 4.

## Slice 2: Scroll newer from the day

Stack: no · Reads: docs/domain/timeline.md, docs/domain/sync.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 5, 7, 9

From a landed day, scrolling up loads newer days until the window is the ordinary timeline, and the page doesn't move.

**Build:**

- The newer-edge query: the next rows above the bound, oldest first, under the same filters and cutoff.
- The pure rule for the next bound: a whole day's end at least a page newer, the limit grown by the rows added, none once fewer than a page remain.
- A top sentinel beside the existing older one, armed only after the landing scroll, with its status text.
- The scroll hold by measurement, with `overflow-anchor: none` on the list while a bound is on, and days added above drawn before they may skip rendering.
- With nothing on or before the chosen day, the first newer page loads on its own and shows the oldest day under the notice.
- Kept paging stores the moved bound.

**Acceptance criteria:**

- [ ] Unit: the next-bound table (mid-history, a day larger than a page, a pass log at the edge, reaching now).
- [ ] Local query test: the newer-edge query respects the filters and cutoff, and a tie at the bound is neither lost nor repeated.
- [ ] Component test (its own jump paging file): with native anchoring off, scrolling up adds newer days and the row on screen stays within a pixel; reaching today brings the Today heading back; a day before the first entry shows the oldest day; Back from an entry after loading newer restores the window.

**Blocked by:** 1. **Blocks:** none.

## Slice 3: The date picker

Stack: no · Reads: docs/domain/timeline.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**User stories:** 1, 8

A calendar button in the toolbar opens a small popover with a native date input (latest: the viewer's today) and Go.

**Build:**

- The toolbar button and popover, for every role, in full and easy views, opening on the current jump day when there is one.
- Go navigates through the day parameter with the jump marker, without the router's scroll reset, and closes the popover.
- The same date button beside Back to today, so another day is in reach after a jump.

**Acceptance criteria:**

- [ ] Component test (its own picker file): a viewer picks a past day and lands on it; a future day can't be submitted; a kind filter stays on and a search ends; picking the same day again scrolls back to it.

**Blocked by:** 1. **Blocks:** none.

## Slice 4: Go to in quick entry

Stack: no · Reads: docs/domain/assistant.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**User stories:** 2, 3, 4, 10

Typing a whole-line jump phrase shows a Go to card that navigates and saves nothing.

**Build:**

- The pure Go to reading (PRD, _Implementation decisions_), in the viewer's zone, read before the line is split: the words after the verb read as if after "on", an optional four-digit year after a month name, and its own date validation.
- The Go to card in the box: the day, Go in place of Save, Enter goes; a future day is blocked with its message. Going clears the box and records no recent line.

**Acceptance criteria:**

- [ ] Unit table, matching: "go to Nov 3", "Go to 11/3", "go to 11/10", "go to 3 Nov", "go to Nov 3, 2025", "jump to last Tuesday", "show yesterday", "go to today", "go to the 3rd".
- [ ] Unit table, not matching: "go to PT tomorrow", "go to Nov 3 appointment", "show yesterday's bp to Sam", "go to Nov 3, bp 120/80", "go to yesterday 9pm", "show last night", "n: show yesterday", "go to Feb 30".
- [ ] Unit: "go to tomorrow" is a jump marked ahead, and a viewer whose day differs from the recipient's gets their own "yesterday".
- [ ] Component test (in the existing quick-entry file): the card navigates to the day, writes no row and no recent line, and clears the box; a blocked card doesn't navigate; "go to PT tomorrow" still shows its ordinary save cards.

**Blocked by:** 1. **Blocks:** none.
