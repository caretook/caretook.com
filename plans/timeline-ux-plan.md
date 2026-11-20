# Plan: Timeline UX

> Source PRD: [`plans/timeline-ux-prd.md`](timeline-ux-prd.md), whose speed half is [`plans/app-speed-prd.md`](app-speed-prd.md). User stories 1–40 are app-speed's and 41–62 timeline-ux's. This plan supersedes `app-speed-plan.md`: slices 1, 3, 4, 7 and 10 are its slices 1, 4, 2, 5 and 6, and its slice 3 (B-139) is folded into slice 6. Backlog items B-136–B-140, B-144, B-155, B-156, B-162–B-171. Topic `timeline-ux`.

## Status

| Slice | Wave | State                 | Merge into `prd/timeline-ux` (slice commits) |
| ----- | ---- | --------------------- | -------------------------------------------- |
| 1     | 1    | landed                | 9e3a3ad (28991ac, 940af0a)                   |
| 2     | 1    | landed                | de5ccf9 (67f6e34)                            |
| 3     | 1    | landed                | 448be6e (11efa88)                            |
| 4     | 2    | landed                | ddf36b0 (2110676)                            |
| 5     | 2    | landed                | fd9b79f4 (174eb84)                           |
| 6     | 2    | landed                | 127670af (8c4450e)                           |
| 7     | 3    | started               |                                              |
| 8     | 3    | merged                | 3f342072 (5aa523ac)                          |
| 9     | 3    | handed off (b838735e) |                                              |
| 10    | 4    | blocked by 1          |                                              |

**Start condition:** `code-layout` in `dev` (it moves `apps/web/app/lib/`, `routes.ts` and `appUrls`). Check `pnpm backlog show B-150` says landed. Every path below that names `lib/…` means its new home after code-layout: find it with `git grep` and don't recreate the old file.

**Landing mode: run everything through** (queued with `pnpm prd queue timeline-ux`; 2026-11-20). Start every ready slice, land each green wave without asking, clean up; ask only real questions. The lean-set `--suite` before landing waves 1, 3 and 4 still needs the user's yes (standing rule).

**Models:** slice 1 opus, slice 2 opus, slice 3 sonnet (tooling spelled out).

**Progress log:**

- 2026-11-20: wave 1 started: worktrees timeline-ux-1 (stack, slot 6), -2, -3 made; agents spawned (1 opus, 2 opus, 3 sonnet). B-136, B-156, B-166, B-155 claimed.
- Slice 3 handed off (11efa88): `pnpm build:budget` (entry/root/app gzip ceilings, forbidden editor/PowerSync modules); `pnpm prd check` now also runs it. Edits `apps/web/vite.config.ts` (manifest + chunk-modules plugin), `scripts/loops/prd.sh`, `.gitignore`.
- Slice 1 merged (9e3a3ad), B-136/B-156 done, worktree removed. Its `pnpm check` failed only `medicationList.browser.test.tsx` under load (passed alone 3/3): watch it at the landing check. Fold-ins for sync.md: freshness 15 min, recheck after 1 min, 3 s answer budget; the first check per page load and after sign-in (`sessionEpoch.ts`) always waits; cache-first settings and the `useMySettings` store. session-end usual seconds unchanged (lean set is at its 286 ceiling).
- Slices 2 (de5ccf9) and 3 (448be6e) merged, B-166/B-155 done, worktrees removed. Slice 2 fold-ins: the tile cache (`lib/sync/remembered.ts`, `useRememberedQuery`; in memory, keyed by user/group/name; dimmed `data-stale` + `STALE`; `STRIP_SKELETON` on a first visit; cleared in `closeSync`) → sync.md and timeline.md; quick entry's passes gate on `fresh`. Slice 5 uses `ready`/`fresh`/`STALE`/`STRIP_SKELETON` from the strip hooks. Wave 1 landing next: sync, check, ask the user about `--suite`.
- Wave 1 landing: `pnpm prd sync` merged dev (code-layout wave 3: routes and URLs by area; one common file, `check-areas.d/app-shell`, no conflicts); full `pnpm prd check` running (a big refactor came in). Lean `--suite`: the user chose to land wave 1 on the check alone (2026-11-20).
- Wave 2 started from the synced branch: worktrees timeline-ux-4, -5, -6 (no stacks); agents spawned (4 sonnet, 5 opus, 6 opus). B-137, B-138, B-169, B-164, B-167, B-165, B-168, B-139 claimed.
- agent-tooling's doc split landed in dev (81529fa): the handbook is now `docs/agents/` (loop, orchestrator, backlog…), AGENTS.md an 8 KB core; the land guard enforces budgets (docs/domain 10 KB; timeline.md and app-shell.md already over, so trim at least what we fold). Sync again before landing wave 1. Told agent-tooling-29 our remaining folds into timeline.md (waves 1–3) and app-shell.md (waves 2–3) and suggested they trim first.
- agent-tooling is trimming components, care-groups, sync, medications, timeline and app-shell to ~9 KB; fold onto whatever is in dev; message agent-tooling-29 after each landing that touches sync/timeline/app-shell/medications.
- Wave 1 check: two load flakes (`medicationList`, `profile` component tests; both pass alone 2/2 at load 25). Synced dev again (docs/tooling only). Folded wave 1 into sync.md, timeline.md, docs/agents/orchestrator.md and AGENTS.md (no doc grew past dev's size); rerunning the full check.
- Slice 4 handed off (2110676; its subject wrongly cites B-168: the items are B-137, B-138). Its pnpm check had 2 unnamed load flakes and the plan's Prettier warning (since fixed). Merge after wave 1 lands.
- **Wave 1 landed in dev as 5689e47** (full check passed on 2bb2425; then a dev sync of agent-tooling's area-doc trims, docs only: took dev's trimmed sync.md/timeline.md and re-added wave 1's rules tersely; sync.md is 10223 B of 10240, so trim at least what waves 3–4 add). The user chose to land wave 1 without `--suite`.
- Slice 4 merged (ddf36b0), B-137/B-138 done, worktree removed. Slices 5 and 6 running.
- **Promises to other orchestrators:** message connectors-4a when B-164/B-165 (slice 6) land in dev, and when slice 10 (B-140, packages/auth) starts and before it lands (their slice 2 adds an oauth-provider plugin in `packages/auth/src/auth.ts`).
- Slice 6 handed off (8c4450e; subject cites only B-139, it covers B-164/B-165/B-167/B-168 too). Merge after 5. Fold-ins: timeline.md, date heading `text-lg lg:text-xl`; the summary in `DayHeader`'s `summary` region; ⋯ over the author chip in `[data-entry-aside]` (`ASIDE_CLASS`); `offscreenRows.ts` (`content-visibility` on rows of days before the newest page, `contain-intrinsic-size: auto 70px`/100px cards; relayout at 300 rows 2.9 → 1.3 ms). care-periods.md: no place on the day line or marker. Follow-ups to file: pages lost on Back (paging is `useState`); dead `placeNamesQuery`/`placeRows`. Filed as B-174 and B-175.
- Slices 5 (fd9b79f4) and 6 (127670af; one doc-comment conflict in `TimelineEntryList.tsx`, resolved) merged; B-169, B-164, B-167, B-165, B-168, B-139 done; worktrees removed. Slice 5 notes: the tasks row keeps due-today tasks but neutral (no amber hue in `todayStatus`); `marketing-screenshots.mjs` selector updated, not run (no screenshots until the launch map). Synced dev (connectors PRD docs). Folded wave 2 into timeline, care-periods, medications, tasks and app-shell docs (all under 10 KB). Full check next (a code conflict was resolved); wave 2 lands on it without `--suite` (plan).
- Wave 2 check: only `medicationList` failed (load flake, passes alone; filed B-178). The rerun failed `timelineSimpleTasks` (2 of 3 alone): a race from slice 2's tiles skeleton; the orchestrator fixed the test (waits for the tiles; 4/4). Quick check passed on 2ce46450; landing.
- Wave 3 started from d3d62eeb while the wave 2 check runs: timeline-ux-7 (stack, slot 3), -8, -9; agents 7 opus, 8 sonnet, 9 sonnet. B-144, B-162, B-163, B-170, B-171 claimed.
- Slice 8 handed off (5aa523ac): order, "Upcoming", one-row tiles, no zoom, `canDictate` + `DICTATION_HINT` under the box in `SimpleTimeline`; box now `size="md"`, which turns on a due-pass chip that duplicates Given all: asked slice 9 to add a prop that hides it in simple mode (pass it in `SimpleTimeline` at merge). Fold-ins: timeline.md simple-view lines; assistant.md (the box size, dictation hint, pass chip).
- **Wave 2 landed in dev as 60260949** (quick check on 2ce46450, then a docs-only dev sync). Told connectors-4a B-164/B-165 landed.
- Slice 8 merged (3f342072; took slice 8's side of the `timelineSimpleTasks` test conflict, which already had the tiles wait), B-162 done, worktree removed. Slices 7 and 9 running.
- Slice 9 handed off (b838735e). At merge: pass `passChips={false}` from `SimpleTimeline`. Its `--changed` named `session-end` (recentLines → sign-out wipe) and failed for lack of a stack: covered by the wave 3 lean set, or run it by name at landing. Undo after a lone note/event is effectively gone (the page opens). Fold-ins for assistant.md: no tips line, rotating placeholder + sr-only rules, open-after-save, reduced recent lines (`recentLineFor`, filtered on read), `passChips`.
- Slice 7: gate passed (the server's /app document, cached with its headers, boots any /app/* under the CSP); told it not to run the lean set (the user's yes, once at landing).

**Backlog:** claim each slice's items when it starts, and run `done` after its merge:

- slice 1: B-136, B-156
- slice 2: B-166
- slice 3: B-155
- slice 4: B-137, B-138
- slice 5: B-169
- slice 6: B-164, B-167, B-165, B-168, B-139
- slice 7: B-144
- slice 8: B-162
- slice 9: B-163, B-170, B-171
- slice 10: B-140

**Fold into the area docs at each landing:**

- **Slices 1, 3, 4, 7, 10:** as `app-speed-plan.md` said for its slices 1, 4, 2, 5, 6: `docs/domain/sync.md` (session freshness, cache-first settings, the service worker), `docs/domain/app-shell.md` (prefetched tabs), `docs/loops.md` and the AGENTS.md commands table (`pnpm build:budget`), `docs/domain/security-headers.md` (the worker), `docs/domain/api.md` (lazy AuthUser), and **the cookie cache tradeoff** as a ⚠ section in `docs/domain/auth.md` and an entry in `plans/security-review.md`.
- **Slice 2:** the tile cache (in memory, remembered values dimmed, skeletons on a first visit, cleared at sign-out) goes in `docs/domain/sync.md` (device queries) and `docs/domain/timeline.md`.
- **Slice 5:** the Today card replaces the strips' rules in `docs/domain/timeline.md` (its rows, hues, links, collapse). `medications.md`, `tasks.md` and `appointments.md` point to it where they describe their strip.
- **Slice 6:** the day header (date size, summary inside it), the author chip's place, no care-period places on the timeline and `content-visibility`: `docs/domain/timeline.md`; `docs/domain/care-periods.md` for the places.
- **Slice 8:** simple mode's order, type scale, tiles and the mic-tip rule: `docs/domain/timeline.md` (its simple-mode lines) and `docs/domain/assistant.md` (simple mode).
- **Slice 9:** the rotating placeholder, open-after-save and the recent-line rules: `docs/domain/assistant.md`.

## Architectural decisions

Durable decisions every slice follows:

- **The speed half's decisions** are `app-speed-plan.md`'s _Architectural decisions_, unchanged: the device answers first; one 3 s timeout (`NETWORK_ANSWER_MS`); fresh, stale and none sessions; the app's own session check and staff procedures and `/token` bypass the 3-minute cookie cache; the hand-written, web-only, production-only service worker that never takes over by itself; one build-manifest reader in `scripts/build/`.
- **Tiles never pop in.** Every header tile on the timeline (the Today card's rows; simple mode's Upcoming, tasks and tiles) reads through slice 2's remembering hook, which returns `{ value, fresh }`. A remembered value renders dimmed with `data-stale`. With nothing remembered, the tile renders a skeleton of its usual height. The cache lives in memory only, never `localStorage`, and is cleared at sign-out. The clientLoader doesn't take on these queries.
- **Status is a pure function.** `todayStatus` decides each Today row's hue: `error` overdue, `warning` due now (and vitals older than a day), `info` an appointment today or within 2 hours, otherwise neutral. Always an icon as well as a colour.
- **Device-only conveniences** (the Today card's collapsed state) go in `localStorage` behind try/catch, with no health data in them.
- **Quick entry rules are pure:** `openAfterSave(savedEntries)`, `recentLineFor(line, parsed)` and `canDictate(nav)` are unit-tested functions; components call them.
- **No migrations, no seeds, no new dependencies.**
- **Hot files and who owns them:**
  - `lib/session.ts`, `lib/sessionRules.ts` and `lib/me.ts`: slice 1.
  - `SectionNav`/`TabBar`: slice 4.
  - The timeline route's header region and the strips: slice 5.
  - `DayHeader`, `DaySummaryLine`, `TimelineEntryList`, the row components and `PeriodMarkerItem`: slice 6.
  - `SimpleTimeline`, `SimpleNow` and `SimpleTiles`: slices 2 (reads only) and 8.
  - `QuickEntryBox`, `QuickEntrySuggestions`, `useQuickEntry` and `recentLines`: slice 9. Slice 8 changes only the size prop `SimpleTimeline` passes.
  - `packages/auth` and `routes/rpc.ts`: slice 10.
  - The `/app` layout frame: slice 7 (the update notice, a region added at the end).
- **New modules and screens** add their rules to `scripts/loops/check-areas.d/<area>`.

## How to run this plan

- **Wave 1: slices 1, 2 and 3.** 1 owns the session and settings files and has the only stack. 2 adds the remembering hook and moves the medication strip, task strip and simple-mode blocks onto it. 3 owns `scripts/build/`. Their files don't overlap. Merge in number order.
- **Wave 2: slices 4, 5 and 6.** 5 builds the Today card on 2's hook. 6 owns the day header and the rows. 5 and 6 both touch `timeline/route.tsx`, 5 in the header region and 6 in the list, so expect adjacent hunks. Merge 4, 5, 6.
- **Wave 3: slices 7, 8 and 9.** 7 needs 1 and 3. 8 needs 2. 9 is free, but waits so the waves stay at three. 8 and 9 meet at `QuickEntryBox`'s size prop only.
- **Wave 4: slice 10.**
- **Browser checks:** screens get component tests. End-to-end runs only for slices 1, 7 and 10 (session-end, layout-offline, sign-in), as app-speed planned. If `check-migration` has ported the lean set to Playwright by then, those steps go in the ported checks.
- **Lean set at landing:** waves 1, 3 and 4 touch the session flow or the build, so each runs the lean set once (`pnpm prd browser --suite`) **after asking the user** (the user's standing rule). Wave 2 lands on `pnpm prd check` and its component tests.
- `pnpm prd check` runs the bundle budget from the landing after slice 3 merges.

---

## Slice 1: Navigation doesn't wait

Stack: yes · Reads: docs/domain/sync.md, docs/domain/auth.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component, e2e:session-end

**User stories** (app-speed PRD): 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 40.

**What to build:**

- **`sessionRules`** gains:
  - `sessionFreshness(lastConfirmed, now)`: `fresh` | `stale` | `none`. `FRESH_MS` is 15 minutes, and a clock moved back counts as no time passed.
  - `shouldRecheck(lastConfirmed, now)`: older than a minute.
  - `withTimeout(promise, ms, onTimeout)`: resolves `unknown` after `NETWORK_ANSWER_MS` (3 s), and ignores the late answer.
  - `askSession` runs under the timeout. The retry after a 429 stays inside the same budget.
- **`requireSession`:**
  - **fresh:** returns the cached user and their database at once, and starts a background recheck when `shouldRecheck` says so. The recheck is shared with any check in flight, as `inflight` is today.
  - **stale or none:** waits for the check, as today, under the timeout.
  - **A background answer:**
    - ok: confirms.
    - signed out: `wipeDevice()`, then a full navigation to sign-in.
    - unverified: goes to verify-email.
    - rate limited or unknown: does nothing.
  - **Bypass the cookie cache:** the session request asks Better Auth not to use it (`disableCookieCache`), so it stays correct once slice 6 turns the cache on.
- **`loadSettings`:**
  - **With a cache:** returns the cache, with pending changes on top, at once. A background refresh then sends any pending change, reads `me.get`, writes the cache and publishes the new settings.
  - **With no cache:** waits under the timeout, then falls back to defaults.
  - **A settings store** (`subscribeSettings` / `useMySettings(userId, initial)`) lets the timeline and the settings pages re-render when the refresh brings different values.
  - **A pure `settingsPlan`** decides cache-or-wait and what to send.
- **The timeline route** reads its settings through the hook, seeded from the loader's value.

**Acceptance criteria:**

- [ ] Unit tests (`sessionRules.test.ts`) cover:
  - `sessionFreshness` at the edges: 15 min exactly, a clock moved back, no record, NaN;
  - `shouldRecheck`;
  - `withTimeout` resolving `unknown` at 3 s, with fake timers, and ignoring a late answer;
  - `askSession` with a 429 retry inside the budget.
- [ ] Unit tests for `settingsPlan`: each case of cache or no cache, and pending or not.
- [ ] A component test: the timeline renders new units when the settings store publishes them.
- [ ] `session-end` gains a step: a device whose session is fresh has its session revoked on the server, then navigates. It lands on sign-in after the background recheck, and the device is wiped. Its usual seconds are updated in `scripts/loops/checks`.
- [ ] `sign-in`, `session-end`, `first-sync` and `signout-wipe` pass (`pnpm prd browser --changed`).
- [ ] By hand, with the server stopped: a navigation inside a fresh session doesn't wait, and a stale one gives up within about 3 s and carries on. Noted in the hand-off.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 7.

---

## Slice 2: Tiles paint at once

Stack: no · Reads: docs/domain/sync.md, docs/domain/timeline.md, docs/domain/medications.md, docs/domain/tasks.md, docs/domain/components.md · Tests: unit, component

**User stories:** 41, 42, 43.

**What to build:**

- **A remembering live query** in `lib/sync/` (at code-layout's path): a pure in-memory store keyed by user, group and a query key, plus a hook `useRememberedQuery(key, query)` that wraps `useLiveQuery`. It returns `{ value, fresh }`: the remembered value (`fresh: false`) until the live query's first answer, then the live value (`fresh: true`). Every answer is remembered. With nothing remembered it returns `{ value: undefined, fresh: false }`.
- **Cleared at sign-out**, with the device's other state (where `recentLines` and the caches are cleared today).
- **Moved onto it:** `useDueDoses` (the medication strip), `useDueTasks` (the task strip), and simple mode's Now block, tasks card and tiles (`useSimpleTiles`). Their `ready` gates no longer return null.
- **Rendering:**
  - A remembered value renders at once with `data-stale` and reduced opacity (a shared `stale` class in `T/layout.ts` beside `STRIP_CLASS`).
  - Nothing remembered renders a skeleton at the tile's usual height, never null.
  - After the first live answer, a tile with nothing to show collapses (once).
- The clientLoader is unchanged: these queries never block navigation.

**Acceptance criteria:**

- [ ] Unit tests for the store: remember and read by key; keys for two users or groups don't mix; `clear()` empties it.
- [ ] Component tests:
  - a strip mounted a second time in the same session paints the remembered value at once with `data-stale`, then drops it when the live query answers (including when the answer differs);
  - a first mount shows a skeleton of fixed height and no layout shift: the list's top doesn't move between first paint and the answer, measured with `getBoundingClientRect`;
  - an empty answer collapses the tile.
- [ ] Sign-out clears the store (a unit test on the sign-out cleanup).
- [ ] The existing medication strip, task strip and `timelineSimple*` tests pass, updated only where they waited on the strip to appear.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` names no end-to-end check, or the ones it names pass.

**Blocked by:** none. **Blocks:** 5, 8.

---

## Slice 3: Bundle budget

Stack: no · Reads: docs/loops.md · Tests: unit

**User stories** (app-speed PRD): 35, 36, 37.

**What to build:**

- **`scripts/build/manifest.mjs`:** from the web build's client manifest (Vite's `.vite/manifest.json`; turn it on with `build.manifest` for the web client build if it's off) and React Router's route manifest, list each route's initial chunks (entry, root, the `/app` layout) and each chunk's source modules.
- **`scripts/build/budget.mjs`**, pure: `checkBudget(listing, budget)` returns violations naming the chunk and the module.
- **`scripts/build/budget.json`:**
  - forbidden patterns in the entry and the `/app` shell's initial chunks: `@tiptap/`, `yjs`, `y-`, `prosemirror-`, `@powersync/`;
  - gzip ceilings, set from today's build plus 10%.
- **`pnpm build:budget`** builds the web target, then checks it, printing a table of chunk, size and limit.
- **`pnpm prd check`** runs it after `pnpm check`, under the same check lease.

**Acceptance criteria:**

- [ ] Unit tests (`scripts:unit`) against fixture manifests: a forbidden module in the entry is reported with its chunk; a chunk over its ceiling is reported; a clean listing passes.
- [ ] `pnpm build:budget` passes on today's build. The hand-off shows its table.
- [ ] Temporarily importing Tiptap into the `/app` layout makes it fail and name the module. Shown in the hand-off, and not committed.
- [ ] `scripts/loops/check-areas.d/` maps `scripts/build/` to none.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 7.

---

## Slice 4: Section tabs respond at once

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/components.md · Tests: component

**User stories** (app-speed PRD): 12, 13, 14, 15, 16.

**What to build:**

- `SectionNav` and `TabBar` links get `prefetch="render"`.
- **The current section** comes from `useNavigation().location?.pathname ?? pathname`, through the existing `sectionCurrent` rule. `aria-current` and the active style follow it, and it falls back to the current pathname once the navigation is cancelled or fails.

**Acceptance criteria:**

- [ ] Component tests:
  - both link sets render with prefetch (the prefetch `<link>`s appear, or the prop is asserted through the rendered markup);
  - with a target loader that never resolves, tapping a tab moves `aria-current` to it at once, on phone and wide widths;
  - cancelling the navigation moves it back.
- [ ] `pnpm test:components --changed` and `pnpm check` pass. `pnpm prd browser --changed` names none (component tests), or `app-shell`, which passes.

**Blocked by:** none. **Blocks:** none.

---

## Slice 5: The Today card

Stack: no · Reads: docs/domain/timeline.md, docs/domain/medications.md, docs/domain/tasks.md, docs/domain/appointments.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: unit, component

**User stories:** 44, 45, 46, 47, 48.

**What to build:**

- **`TodayCard`** in the full timeline's header, replacing `LatestVitals`, `NextStrip`, `MedicationStrip` and `TaskStrip`. Simple mode is untouched.
- **Rows**, each hidden when it has nothing, each read through slice 2's hook:
  - vitals: the latest readings and their time;
  - the next appointment;
  - medications due, with "Given all" when the viewer can write;
  - overdue tasks.
- **`todayStatus(row, now)`**, pure: `error` for an overdue dose or task, `warning` for a dose due now or vitals older than a day, `info` for an appointment today or within 2 hours, otherwise `neutral`. Rows show a tinted background in the theme's colour plus a status icon, and the status in text for screen readers.
- **"See all ›"** at the right of every row, one shared style: vitals → the timeline filtered to vitals (the existing kind filter), appointment → Upcoming, medications → the medications section, tasks → the tasks section, all through `appUrls`. `?upcoming=1` and the "All vitals" expander are removed with their strips, and any links to them are updated.
- **Collapse:** the card's header button toggles a one-line summary ("BP 130/85 · 1 appt · 2 due · 1 overdue"). The choice is remembered per device in `localStorage`, behind try/catch.
- Shown at every width.
- Delete the four strip components and their now-dead tests. Move their still-relevant assertions to `TodayCard`'s tests.

**Acceptance criteria:**

- [ ] Unit tests for `todayStatus`: each status at its edges (a dose due exactly now, overdue by a minute, an appointment at 2 h and 2 h 1 min, vitals at 24 h).
- [ ] Component tests (`todayCard.browser.test.tsx`):
  - rows appear only with data;
  - each hue has its icon and screen-reader text;
  - every "See all ›" link goes to its view;
  - "Given all" shows only for writers and records the doses as the old strip did;
  - collapse shows the summary line and is remembered across a remount;
  - remembered values are dimmed (slice 2).
- [ ] The timeline's layout tests pass, updated for the card.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` names no end-to-end check, or the ones it names pass.

**Blocked by:** 2. **Blocks:** none.

---

## Slice 6: Day header and rows

Stack: no · Reads: docs/domain/timeline.md, docs/domain/care-periods.md, docs/domain/assistant.md, docs/domain/components.md · Tests: component

**User stories:** 49, 50, 51, 52, and app-speed's 17, 18, 19, 20.

**What to build:**

- **The date heading** in `DayHeader` grows to balance the `btn-sm` + button (start from `text-lg lg:text-xl`).
- **The day summary moves inside the sticky header:** each day's `DaySummaryLine` renders in that day's `DayHeader`, as one truncated line under the date. Tapping expands it as now, filters still hide it, and simple mode's 1.25× zoom is left for slice 8 to remove.
- **The author chip** (`AuthorFilterLink`, and simple mode's plain tile) moves into a right-hand column under the ⋯ `EntryActions`, at the same size, still linking to `?author=` with its tooltip. The text gets the width back, in both rows and cards where it applies.
- **No care-period places on the timeline:** the day header's period line and `PeriodMarkerItem` drop the place name and detail. The period's page keeps them.
- **Off-screen rows (B-139),** from `app-speed-plan.md`'s slice 3: `content-visibility: auto` with `contain-intrinsic-size: auto <estimate>` on rows or day groups (say which measured better). The paging sentinel and scroll anchor stay uncontained. Rows stay in the DOM and the accessibility tree.

**Acceptance criteria:**

- [ ] Component tests:
  - the day summary sits inside `[data-day-header]` and stays visible (sticky) while the test scrolls through that day;
  - a row's author chip comes after the ⋯ menu in the right column, and the text column is wider than before (or the chip isn't in the text's row);
  - a period line and a period marker with a place render no place text;
  - the date heading carries the larger size classes (assert the classes, not pixels).
- [ ] `timelineScroll.browser.test.tsx` passes unchanged, plus a test that rows carry `content-visibility`, and that after three pages and a navigation away and back the scroll position and the next page still work.
- [ ] The hand-off reports a before and after for scrolling 90 rows (Chrome's rendering time or the layout count, by hand).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` names no end-to-end check, or the ones it names pass.

**Blocked by:** none. **Blocks:** none.

---

## Slice 7: Service worker

Stack: yes · Reads: docs/domain/sync.md, docs/domain/security-headers.md, docs/domain/app-shell.md, docs/domain/components.md, docs/loops.md · Tests: unit, component, e2e:layout-offline

**User stories** (app-speed PRD): 27, 28, 29, 30, 31, 32, 33, 34, 38, 39.

**What to build:**

- **Prove the shell first** (and record it in the hand-off): a document that boots the client router on any `/app/*` URL with no route-specific server data, under the CSP. Either the web build emits one (as `ssr: false` does for native), or a prerendered `/app` document works whatever the URL. If neither works, stop and report before building the rest.
- **The precache list** comes from slice 3's manifest reader: the shell, every client asset and the CSS. The worker is written to the web client build as `/sw.js`, holding the list and a build version. It's a build step after `react-router build` for the web target only.
- **The worker:**
  - pure request routing (`routeRequest(url, mode)` → `shell` | `cache` | `network`), unit-tested;
  - install precaches;
  - activate deletes other versions' caches;
  - on a `skip-waiting` message, `skipWaiting()`;
  - `/app/*` navigations get the shell;
  - precached assets come cache-first;
  - everything else, including `/api`, `/rpc`, PowerSync, marketing and sign-in, goes to the network.
- **Registration** happens in the client entry, only when `import.meta.env.PROD`, the web target, and not native.
- **The update notice** is a small `ui/` banner or toast in the frame, in its own region at the end: "A new version is ready" with Reload. Reload posts `skip-waiting`, waits for `controllerchange`, then reloads.
- The CSP needs no change (`worker-src 'self' blob:`); confirm that the cached shell's CSP `<meta>` and the headers its response keeps are consistent.
- `pageCache.ts`'s bfcache reload works offline now; update its comment.
- `scripts/loops/check-areas.d/` rules for the worker and the build step.

**Acceptance criteria:**

- [ ] Unit tests:
  - `routeRequest` for each class of URL;
  - the precache list from a fixture manifest;
  - cache naming and cleanup against a fake `CacheStorage`.
- [ ] A component test of the update notice: hidden with no waiting worker; shown with one; Reload posts `skip-waiting`.
- [ ] `layout-offline` gains a step: after a first load (worker installed), go offline, reload an `/app/groups/<id>/timeline` URL and a provider page, and see each screen from local data. Its usual seconds are updated.
- [ ] The lean set passes once with the worker on (`pnpm prd browser --changed`, which names the lean set for a build change). Note any check that needed a change because of the worker.
- [ ] The dev server and `pnpm build:native` register no worker. Shown in the hand-off.
- [ ] `pnpm build:budget` and `pnpm check` pass.

**Blocked by:** 1, 3. **Blocks:** none.

---

## Slice 8: Simple mode

Stack: no · Reads: docs/domain/timeline.md, docs/domain/assistant.md, docs/domain/components.md · Tests: unit, component

**User stories:** 58, 59, 60, 61, 62.

**What to build:**

- **Order** in `SimpleTimeline`: header, Upcoming, tasks, the tiles with Remove last, then the quick-entry box directly above the timeline.
- **"Now" becomes "Upcoming"** in `SimpleNow`; its content is unchanged.
- **The tiles fit one row:** smaller buttons, still 44 px tap targets, scrolling sideways if a phone can't fit them all.
- **The full timeline's type scale:** no `text-2xl` headings, no 1.25× zoom on the day summary, and `QuickEntryBox` at the normal size (the size prop only; the box's internals belong to slice 9).
- **The mic tip** shows only when `canDictate(navigator)` is true: a coarse pointer and an iOS or Android user agent. It's a pure function, unit-tested.

**Acceptance criteria:**

- [ ] Unit tests for `canDictate`: an iPhone, an iPad (including the desktop-class iPadOS user agent with touch), an Android phone, desktop Chrome, and a touch Windows laptop (false).
- [ ] Component tests (`timelineSimple*.browser.test.tsx`, updated):
  - the box comes directly before the timeline list in DOM order;
  - the heading reads "Upcoming";
  - the tiles sit in one row at phone width (all tiles share one `offsetTop`) and each is at least 44 px tall;
  - no element in simple mode uses `text-2xl` or the summary zoom;
  - the mic tip shows only with `canDictate` stubbed true.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` names no end-to-end check, or the ones it names pass.

**Blocked by:** 2. **Blocks:** none.

---

## Slice 9: Quick entry

Stack: no · Reads: docs/domain/assistant.md, docs/domain/live-notes.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**User stories:** 53, 54, 55, 56, 57.

**What to build:**

- **The tips paragraph** (`data-quick-tips` in `QuickEntrySuggestions`) goes. The box's placeholder rotates through examples ("bp 130/85 hr 72", "gave metformin", "pain 4 left knee", "appt Dr Lee Friday 2pm", "n: slept well") every few seconds, only while the box is empty and unfocused. Under `prefers-reduced-motion` it shows the first example and stays. An accessible description on the box keeps the full rules (commas separate entries, "n:" for a note). It applies in both modes.
- **Open after save:** `openAfterSave(saved)`, pure, returns the entry to open when a line saved exactly one entry and it's a note or an event, otherwise nothing. `useQuickEntry.save` navigates to `appUrls` for that entry's page, replacing nothing in history (Back returns to the timeline).
- **Recent lines:** `recentLineFor(line, parsed)`, pure, returns what to remember: nothing for a note or an event; a vital line's keys only, in order ("bp hr "); otherwise the line. `recordLine` stores that. Lines already stored are filtered the same way when read, so old notes and full vital values disappear without a migration of `localStorage`.

**Acceptance criteria:**

- [ ] Unit tests:
  - `openAfterSave` for a lone note, a lone event, a note plus a vital, two notes, and a lone dose;
  - `recentLineFor` for "n: …", an appointment, "bp 130/85 hr 72" → "bp hr ", "pain 4 left knee" (kept), and a mixed line (vitals reduced, notes dropped).
- [ ] Component tests (`timelineQuickEntry*.browser.test.tsx`, updated):
  - no tips paragraph; the placeholder changes over time with fake timers and stays still under reduced motion; the description holds the rules;
  - saving "n: slept well" navigates to the new entry's page with its editor; saving "bp 120/80, n: tired" stays on the timeline;
  - a recent vital chip fills "bp " and the cursor sits at the end; notes don't appear among recent lines.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` names no end-to-end check, or the ones it names pass.

**Blocked by:** none. **Blocks:** none.

---

## Slice 10: Cheaper `/rpc` auth

Stack: yes · Reads: docs/domain/auth.md, docs/domain/api.md, docs/domain/admin.md, docs/domain/sync.md · Tests: integration, e2e:sign-in

**User stories** (app-speed PRD): 21, 22, 23, 24, 25, 26.

**What to build:**

- Hosting slice 3 is in `dev` (it changed `rpc.ts` and Better Auth's rate-limit config); start from it.
- **A lazy AuthUser:** `getAuthUser` becomes a memoised `() => Promise<AuthUser | null | AppError>` passed in the API context. `authedProcedure` and `staffProcedure` resolve it in their middleware; `publicProcedure` never does. A lookup error is still a 500, logged as today.
- **One query:** the user (roles and disabled-at) with their memberships, through the data layer's models (joined, or one query with an aggregate), returning the same AuthUser.
- **The cookie cache:** Better Auth `session.cookieCache` is enabled with `maxAge: 180`.
  - **Staff procedures** read the session with the cache disabled.
  - **The `/token` endpoint** (PowerSync's JWT) refuses to use it, enforced on the server (a `before` hook, or the plugin's option), whatever the client sends.
  - Sign-out clears the cache cookie (check that Better Auth's sign-out does).
  - A comment at the setting names the tradeoff and points to `docs/domain/auth.md`.

**Acceptance criteria:**

- [ ] Integration tests:
  - a public procedure (the announcement, the waitlist) makes no session lookup (spy on `getSession`, or count queries);
  - an authed procedure resolves the AuthUser once per request;
  - the one-query lookup returns the same AuthUser as before for a member of two groups, and null for a disabled account;
  - with the cookie cache on, a session revoked in the database: an ordinary procedure still succeeds within 3 minutes (the tradeoff, pinned), but a staff procedure and `/api/auth/token` are refused at once;
  - after sign-out, the cookie no longer authorizes.
- [ ] `sign-in`, `session-end`, `signout-wipe` and `invites` pass (`pnpm prd browser --changed`). `session-end` still detects revocation within its usual time, because slice 1's check bypasses the cache.
- [ ] The hand-off has the wording of the ⚠ tradeoff for the orchestrator to fold into `docs/domain/auth.md` and `plans/security-review.md`.
- [ ] `pnpm check` passes.

**Blocked by:** 1 (its session check bypasses the cookie cache; it merges in wave 1). Hosting slice 3 is already in `dev`. **Blocks:** none.
