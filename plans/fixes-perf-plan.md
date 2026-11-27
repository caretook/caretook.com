# Plan: Fixes (perf)

Small performance fixes: speed and load. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-perf`.

## Status

**Landing mode: run everything through** (started run-through; land each green wave, clean up, ask only real questions via `pnpm prd ask`).

**History:** earlier hand-offs and landed waves' rows are in [`plans/fixes-perf-history.md`](fixes-perf-history.md) (`pnpm prd status-trim`).

- Gotchas: this Status table's columns must stay exactly Slice | Item | State | Merge; agent shells need `export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"`; `browser --suite` is the user's call (ask first), so landings ran `browser --changed --base dev`; doc budgets: appointments.md and sync.md sit at ~10.24 KB, trim what you add.

**Wave 1** landed acc69573 (PR #253, 2026-11-27, `--no-review`: Codex out of credits; report a309).

**Wave 2 running** (2026-11-27): slices 8-12 (B-956, B-958, B-959, B-960, B-963), all on Opus; dev needed no sync. Slice 11 waits for slice 10 (both measure the first load). B-963 filed this session from the wave 1 hand-over.

- At landing: browser checks `first-sync`, `roundtrip`, `live-notes` (slice 8's sync change); sync.md gets identical answers skipped (B-956), `startSettings` on the _Settings cache_ line (B-958), the WASM prefetch in `openSync` (B-959); slice 10 notes CDP throttling skips SharedWorker requests (measure behind a link shaper: scratchpad m10/ scripts).

| Slice | Item  | State                | Merge    |
| ----- | ----- | -------------------- | -------- |
| 8     | B-956 | merged               | b2d5967b |
| 9     | B-958 | merged               | 6abd6279 |
| 10    | B-959 | merged               | 5fe00bdf |
| 11    | B-960 | agent working (Opus) |          |
| 12    | B-963 | merged               | 847722a6 |

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

## Wave 2

As in wave 1: each item's notes (`pnpm backlog show B-<n>`) carry the file references; **first measure or reproduce**, and if it doesn't reproduce, say so in the hand-off and change no app code. Behaviour never changes: only the work done to produce it.

### Slice 8: live queries skip identical answers (B-956)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/sync.md · Tests: unit

**Problem.** PowerSync watches by table, so the window's note previews rerun on any `note_update` (a co-member typing in a note off screen); the rows come back identical, but `watchLiveQuery`/`useLiveQuery` (`lib/sync/index.ts`, shared per SQL and params since slice 5) set state on each answer, so Timeline and Planner re-render.

**Build.** In the live-query layer, compare each answer with the last one delivered (row count, then a shallow compare of each row's columns) and deliver only a changed one. The first answer is always delivered; a late subscriber of a shared watch still gets the current rows at once.

**Acceptance criteria.**

- [ ] Unit test: an answer identical to the last delivers nothing (no subscriber call, no state set); a changed row, an added or removed row each deliver; the first answer delivers.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.

### Slice 9: the settings fetch starts at sign-in, not after the routes load (B-958)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/app-shell.md, docs/domain/sync.md · Tests: unit

**Problem.** The timeline route's `clientLoader` calls `loadSettings` (`lib/app-shell/me.ts`); with no cache it waits for `rpc.me.get` (up to 3 s), and on a new device it starts only once the group and timeline routes have loaded: one round trip (~100-170 ms) on the critical path.

**Build.** Start the settings fetch earlier (at sign-in, beside the landing preload, or in the `/app` middleware) and have `loadSettings` await that same in-flight request instead of starting a second one. A cached answer still wins; a failed early fetch falls back as today; the native target works (no server loader).

**Acceptance criteria.**

- [ ] Unit test: after the early start, `loadSettings` reuses the in-flight request (one `me.get` call) and resolves with its answer; with no early start it fetches as before; a failure falls back as before.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.

### Slice 10: the sync client and SQLite WASM come before the preloaded route chunks (B-959)

Stack: yes · Reads: plans/fixes-rules.md, docs/domain/sync.md, docs/domain/app-shell.md · Tests: unit

**Problem.** With the landing preload (`lib/app-shell/preloadRoutes.ts`), on a 1.6 Mbps / 150 ms profile the database opens ~1 s later (2.5 s to 3.5 s after the click) because ~200 route chunks share the bandwidth.

**Build.** Measure on the slice's stack with the same throttled profile as slice 7 (B-764's hand-off). Then give the sync client, its worker and WASM the bandwidth first (`fetchpriority="high"` on their preloads and `low` on the route chunks, or preloading the route chunks only once the database's code has arrived), whichever the timings show wins, without slowing the unthrottled case. No new dependency. If neither wins, change no app code and say so with the timings.

**Acceptance criteria.**

- [ ] The hand-off has a before and after timings table (database open and first timeline row, throttled and unthrottled).
- [ ] Unit test of what changes (the priority or the order of the preloads).
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** slice 11. **Blocked by:** none.

### Slice 11: tiny shared chunks are grouped on the first /app load (B-960)

Stack: yes · Reads: plans/fixes-rules.md, docs/domain/app-shell.md · Tests: unit

**Problem.** Sign-in to the first timeline row requests ~205 JS chunks (~560 KB encoded); dozens are 0.7-1.5 KB (lucide icons such as map-pin, clock, pill; small helpers). Over HTTP/1.1 the queue dominated (6.4 s on a 3G profile).

**Build.** Measure first (chunk count and sizes before first paint, `pnpm build:budget`). Then group the tiny shared chunks in `apps/web/vite.config.ts` (Rolldown `advancedChunks` groups, e.g. one for `lucide-react` icons and one for small shared helpers under a size floor), for both build targets, keeping route chunks lazy. Check the budget (`scripts/build/budget.json`) after and update it only to record the new, smaller shape. If the change is bigger than a config group and a test, stop and file the rest with `pnpm backlog add change … --prd fixes-perf --status triaged --note …`.

**Acceptance criteria.**

- [ ] The hand-off has before and after chunk counts and bytes to the first timeline row, and `pnpm build:budget` output.
- [ ] Unit test (beside the build config or the budget script): the icons land in one shared chunk and no route's own chunk is merged into the entry.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** slice 10.

### Slice 12: Easy mode's Upcoming doesn't rerun its query every minute (B-963)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/appointments.md, docs/domain/timeline.md · Tests: unit or component

**Problem.** `routes/app/groups/timeline/useEasyUpcoming.ts` (37-39) builds `upcomingQuery` from now rounded down to the minute, so its local query changes and reruns once a minute. Slice 5 (B-910) made Upcoming/Past compute the split from the rows instead.

**Build.** Do the same here, reusing slice 5's approach: a query that doesn't depend on the tick, with the tick only filtering the rows. What Easy mode shows doesn't change.

**Acceptance criteria.**

- [ ] Unit or component test: a `useNow` tick doesn't rerun the query, and an event that passes still leaves Upcoming.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.
