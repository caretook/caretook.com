# Plan: Fixes (perf)

Small performance fixes: speed and load. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-perf`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge; agent shells need nvm's Node 24 bin first on `PATH`.
- **Wave 1** (2026-11-27): slices 1-7, all Opus. Ready now: 1, 3, 4, 6, 7; 2 waits on 1, 5 on 3.

| Slice | Item  | State           | Merge |
| ----- | ----- | --------------- | ----- |
| 1     | B-311 | starting (Opus) | —     |
| 2     | B-755 | waits on 1      | —     |
| 3     | B-313 | starting (Opus) | —     |
| 4     | B-884 | starting (Opus) | —     |
| 5     | B-910 | waits on 3      | —     |
| 6     | B-798 | starting (Opus) | —     |
| 7     | B-764 | starting (Opus) | —     |

## Wave 1

Each item's backlog notes (`pnpm backlog show B-<n>`) carry the file references; most came from a reading or a profile, so **first measure or reproduce** (a test that counts queries, rows or calls, or a timing in the hand-off). If it doesn't reproduce, say so in the hand-off with what shows it, and change no app code. Behaviour never changes: only the work done to produce it.

### Slice 1: the series top-up skips ended and already-topped-up series (B-311)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/appointments.md, docs/domain/calendars.md · Tests: integration

**Problem.** `appointmentSeriesService.ts` (`topUp`, around 383-444): the every-minute cron's horizon filter matches every topped-up series, pages of 100 each with a `COUNT`, and rewrites `topped_up_through` daily even on ended series, so they re-sync to every device.

**Build.** Select only series whose `topped_up_through` is behind the horizon and that haven't ended (their rule's last visit is before what's written). Never write `topped_up_through` when no visit was added and the value wouldn't change. Drop the per-page `COUNT` if paging can stop on a short page.

**Acceptance criteria.**

- [ ] Integration test: a series already topped up to the horizon, and an ended series, are neither read for writing nor updated (`updated_at` unchanged) by a top-up run; a series behind the horizon still tops up.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** slice 2. **Blocked by:** none.

### Slice 2: series visits are written in batches (B-755)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/appointments.md, docs/domain/data-layer.md · Tests: integration

**Problem.** `writeVisits` in `appointmentSeriesService.ts` writes each visit's entry, document and links in turn (~1.7 s for 39 visits under load); creating a series and every top-up pay it.

**Build.** Insert each table's rows for all the visits in one statement (entries, then documents, then links), inside the same transaction and through the same model/service rules (RBAC, audits, timestamps). The result and the rows written stay the same.

**Acceptance criteria.**

- [ ] Integration test: creating a series writes the same visits, documents and links as before (ids, fields, links), with a bounded number of statements (not one round per visit).
- [ ] The hand-off gives the before and after time of `appointmentSeries.int.test.ts`.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** slice 1.

### Slice 3: Timeline and Planner read only the note documents they show (B-313)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/live-notes.md, docs/domain/timeline.md, docs/domain/sync.md · Tests: unit, component

**Problem.** `lib/live-notes/notes.sync.ts` (23-28, 51-62) loads and watches every note document in the group (snapshot, text, pending updates) to preview 30 rows (`timeline/useTimelineData.ts` 150-152, `planner/loadUpcoming.ts` 23), and reruns on every co-member keystroke. Also unbounded: `readingsQuery` (`lib/timeline/timeline.sync.ts` 387-393) and `doseChoicesQuery` (`lib/medications/medicationTimeline.sync.ts` 87-96).

**Build.** Restrict the note preview query to the window's entry ids (and only the columns the preview needs); bound the two other queries to the window (or the ids shown) the same way. A keystroke in a note not on screen doesn't rerun the timeline's queries.

**Acceptance criteria.**

- [ ] Unit or component test: with notes on entries outside the window, the preview query's parameters and rows cover only the shown entries; previews still show for every visible row.
- [ ] The same for `readingsQuery` and `doseChoicesQuery`: rows outside the window aren't read.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** slice 5. **Blocked by:** none.

### Slice 4: the timeline loader reads tags in its second round (B-884)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/timeline.md, docs/domain/tags.md · Tests: unit

**Problem.** The timeline's loader reads tags in a sequential first round on every navigation (~37 ms, added by tags slice 6, a5b63301), even when `?tag=` isn't set.

**Build.** Without `?tag=`, read tags alongside the second round's reads (in parallel); with `?tag=`, keep what the filter needs first. What the screen shows doesn't change.

**Acceptance criteria.**

- [ ] Unit test: without `?tag=`, the tags read starts with the second round (not before it); with `?tag=`, the filter still resolves before the entries read.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.

### Slice 5: identical live-query watches are shared (B-910)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/sync.md · Tests: unit

**Problem.** After Back the timeline runs 38 watches, 11 exact duplicates (same SQL and params: `medication_pass` x3, members x3…), about 30% more query work after a remount. Upcoming and Past also rerun their local query on every 30 s `useNow` tick.

**Build.** In the live-query layer (`lib/sync/useLiveRows.ts`, `lib/sync/index.ts`), share one watch per identical SQL and params among its subscribers (reference-counted, closed when the last leaves); a late subscriber gets the current rows at once. Make Upcoming/Past's query not depend on the tick (compute the split from the rows instead), unless the hand-off shows why it must.

**Acceptance criteria.**

- [ ] Unit test: two subscribers to the same SQL and params open one watch; both get updates; the watch closes after both leave; different params open two.
- [ ] Unit or component test: a `useNow` tick doesn't rerun Upcoming/Past's query.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** slice 3.

### Slice 6: date formatters are built once per zone (B-798)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/medications.md · Tests: unit

**Problem.** `dayLabel` (`packages/data/src/db/schema/core/`) and `apps/web/app/lib/medications/medicationDisplay.ts` (around 144) build an `Intl.DateTimeFormat` per call; B-793 cached the timeline's (`calendarText.ts` shows the pattern: a `Map` keyed by zone and options).

**Build.** Cache each formatter by its zone (and locale/options) the same way. Output doesn't change.

**Acceptance criteria.**

- [ ] Unit tests: the existing `dayLabel` and medication display cases still pass, and a second call with the same zone reuses the formatter (spy on `Intl.DateTimeFormat`).
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.

### Slice 7: measure the app's first load and fix its biggest cheap cost (B-764)

Stack: yes · Reads: plans/fixes-rules.md, docs/domain/sync.md, docs/domain/app-shell.md · Tests: unit or component

**Problem.** The app's first load feels far too long (the user: speed it up, or make the loading message friendlier with progress). Nothing is measured yet.

**Build.** Measure first, on the slice's stack with a seed account: the time from sign-in to the first timeline rows, split into the bundle (sizes from `pnpm build:budget`, the JS fetched before first paint), the first sync (time and rows per table from PowerSync), and our own loaders. Put the table in the hand-off. Then fix the single biggest cost that a small change can cut (a lazy route chunk, a table synced before it's needed, a sequential wait), within 12 files and with no new dependency; file every other finding with `pnpm backlog add change … --prd fixes-perf --status triaged --note …` (a friendlier loading screen with progress goes to `fixes-ui`). If no small fix is safe, change no app code and say so.

**Acceptance criteria.**

- [ ] The hand-off has the before (and, with a fix, after) timings table.
- [ ] A fix carries a unit or component test of what it changes (a lazy import, the order of waits).
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.
