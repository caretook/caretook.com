# Plan: Orchestration 2 (faster, lighter loops)

> Source PRD: [`plans/orchestration-prd.md`](orchestration-prd.md). User-story numbers (US) refer to it. Backlog items B-59, B-89, B-107, B-108, B-109, B-110, B-111. Topic `orchestration`.

## Status

**Landing mode: run it through** (the user, 2026-11-19): start every ready slice, land each green wave without asking, clean up, ask only real questions.

| Slice | Wave | State                              | Merge into `prd/orchestration` (slice commits)                |
| ----- | ---- | ---------------------------------- | ------------------------------------------------------------- |
| 1     | 1    | landed (27f5eb2)                   | db65cca (a6ac71a, 3cf23d0)                                    |
| 2     | 1    | landed (27f5eb2)                   | 4982bd0 (66e02bd); doc fold 5c0989c                           |
| 3     | 1    | landed (27f5eb2)                   | 399fb18 (8af746c); doc fold 7a144a0                           |
| 4     | 2    | landed (07bc4eb)                   | 35e384f (679e4c6)                                             |
| 5     | 2    | landed (07bc4eb)                   | b0076a1 (2b59955)                                             |
| 6     | 2    | landed (07bc4eb)                   | 56ee562 (f808af4, 9d8c353); lease wiring and doc fold d9bf270 |
| 7     | 3    | landed (dbbd6bb)                   | b725e70 (818ac6e)                                             |
| 8     | 3    | landed (dbbd6bb)                   | 99ff656 (463361b, e1eed79)                                    |
| 9     | 4    | running (2026-11-19, stack slot 1) |                                                               |

Wave 1 landed in `dev` as 27f5eb2 (not pushed; the user pushes). The sync before it brought medications-2's landing; its AGENTS.md additions were moved into `docs/domain/` (f7581b4). After landing, `pnpm backlog doctor --fix` and `archive` ran on the real backlog (cad38ca, 831792c: 80 items to `plans/backlog-archive.md`). `doctor` still reports B-104's inbox tag (a "PRD tooling needs a way to recover after system restarts" bullet tagged with the Connectors item): the user's to fix. The admin orchestrator was told about the split; medications-2's wasn't reachable (done).

Wave 2 landed in `dev` as 07bc4eb (the user chose no browser checks for it; `pnpm prd check` passed on fe0aa02). Fixes made at that landing: the medication fixture's schedule `slots` (08ec2e8; medications-2's shape), the archive leaving the inbox formatted and `plans/backlog-archive.md` in `.prettierignore` (ad hoc commit before the sync; admin made the same ignore fix on dev), and `vite.config.ts` loading server env only outside Vitest (3bd2e1d), without which `web:components` leaked the dev `DATABASE_URL` into the integration project. Synced admin's landing (fe0aa02; its `docs/domain/admin.md` row kept).

Wave 3 landed in `dev` as dbbd6bb: `pnpm prd check` on 37c0403, and phase2, live-notes, app-shell and ui passed once (1m17s together; about 15 min before). At merge: the fixture's document group (`groupId: entry.groupId`), the browser port as `test.api` with a free port per run (0c767db; two worktrees clashed on 23315), and entry appointment tests waiting for the screen after a stored write (they raced under `pnpm check`'s load). B-113 noted with app-shell's result and the probable 429 cause in `lib/session.ts`.

Backlog: B-109, B-108, B-111, B-59 and B-89 landed. B-107 (slices 6, 9) and B-110 (slices 7, 8) are claimed by `prd/orchestration`; mark them `done` after slice 9. B-113 (admin's item: recheck app-shell, providers and admin on the new suite) was passed to slice 7 for app-shell step 6g; note its result on B-113 at the wave 3 landing.

Slices 7 and 8 got stacks (they run shrunken e2e checks); the others are stackless (`new.sh --no-stack`) and run `typecheck`, `lint`, `format:check` and the unit projects. Merged slices 4 and 6 before 5 (no dependency between them). Slice 4's follow-up for slice 9: move the browser kind to `.loops/.lease/browser` and drop the `lease.sh(browser.sh)` re-exec. Slice 2 made `marketing` part of `--suite` (its manifest `e2e` is yes).

## Architectural decisions

Durable decisions every slice follows:

- **This PRD may edit AGENTS.md and `docs/`** (the user agreed): its subject is the process those files describe. After slice 1 lands, a slice edits the doc that owns its topic (`docs/loops.md`, `docs/domain/…`) and keeps the AGENTS.md core to rules and pointers.
- **Every slice in this plan carries `Stack`, `Reads` and `Tests` fields**, the format slice 1 introduces. Until slice 1 is merged, the orchestrator passes them in the loop's prompt by hand.
- **Tooling is bash plus Node `.mjs`** as now (`scripts/loops/`, `scripts/backlog/`), with logic worth testing in pure `.mjs` modules covered by `scripts:unit` against throwaway repos and fake checks. No new dependencies except the three approved for component tests (slice 6).
- **One manifest, one map:** `scripts/loops/checks` (slice 2) lists each check (usual seconds, cap, never-exits, `e2e`); `check-areas` stays the file → check map. A unit test keeps every check named in `check-areas` present in the manifest.
- **Leases** (slice 4) are one library for every machine-wide limit: lock directories under the main checkout's `.loops/.lease/<kind>/<N>`, atomic take, takeover of a dead holder, release on every exit, bounded wait. The browser leases move under it without changing their count or env names.
- **Stacks** (slice 5): slices are stackless unless `Stack: yes`; PRD integration worktrees keep a full stack. Integration tests in any worktree use that worktree's own database on one shared test Postgres (its own Compose project and fixed port), created on first use and dropped by `rm.sh`.
- **Component tests** (slice 6): Vitest project `web:components`, browser mode with the Playwright provider and headless Chromium, apps/web's Vite config, files `*.browser.test.tsx` beside their subject; the test device (`renderWithDevice`) and fixture builders are the only way tests get data. All fixtures fictional.
- **A CDP step is deleted only when a named component test covers it**, and the hand-off lists step → test.
- **Running PRDs keep working throughout:** command names, env names and defaults stay compatible; anything renamed keeps an alias until slice 9.

## How to run this plan

- **Wave 1: slices 1, 2 and 3 at once** (all stackless). 1 owns AGENTS.md, `docs/` and `prompt.sh`; 2 owns `browser.sh` and the manifest; 3 owns `scripts/backlog/`. 2 and 3 write their doc changes as a short section at the end of their hand-off (not into AGENTS.md); **merge 1 first**, then 2 and 3, folding their doc text into the new layout.
- **Land wave 1 at once**, then message the running orchestrators (ListAgents, SendMessage) that AGENTS.md was split and they should `pnpm prd sync` before their next AGENTS.md edit.
- **Wave 2: 4, 5 and 6** (6 can start during wave 1). 4 owns `lease.sh` and `prd.sh check`; 5 owns `new.sh`, `rm.sh`, `ls.sh`, Compose for the shared test database, and the integration globalSetup; 6 owns the dependencies, `vitest.config.ts`'s new project, the sync seam and `apps/web/test/`. 4 and 6 meet at the lease call for Chromium: 6 leaves a hook, 4 (or whichever merges second) wires it.
- **Wave 3: 7 and 8** in parallel; each owns its two checks and their component tests.
- **Wave 4: 9.**
- Checks for this PRD: every slice runs `pnpm check`. Tooling slices need no browser checks (`--changed` says none). Slices 7, 8 and 9 run the checks they shrink, once, through `pnpm prd browser <check>`. The landing for waves 3 and 4 runs the lean set once.
- Every slice ends with a hand-off (AGENTS.md, _Loop rules_).

---

## Slice 1: Split AGENTS.md, and per-slice fields

Stack: no · Reads: AGENTS.md (all of it, once) · Tests: unit

**User stories:** US 1–7.

**What to build:**

- Move AGENTS.md's domain sections verbatim into `docs/domain/<area>.md` (care-groups, timeline, live-notes, providers, medications, appointments, care-periods, search, profiles, marketing, notifications, sync, data-layer, auth, api, security-headers, components) and the loop handbook (_Running loops_, _Browser check budget_, its table, _Gotchas_, _Browser checks_, the active PRD list) into `docs/loops.md`. Trim only history ("built by slice N", "landed …") and repetition.
- The core keeps: working rules, branches and roles, the backlog rules, the PRD flow in brief, the orchestrator and loop rules, rules across PRDs, product, stack, the architecture rules (targets, data-layer layers, sync principles), compliance, open questions, commands and an **area index** (area → doc → read it when your slice touches …). Target ≤ 30 KB.
- A pure parser for the slice fields (`Stack: yes|no · Reads: … · Tests: …` on the line under a slice heading). `prompt.sh slice` prints them (a missing field → a warning and the defaults); `new.sh slice` takes its stack choice from `Stack` (wired to stackless in slice 5; until then it only reports it). `prompt.sh plan` tells planning agents to write the fields.
- `docs/orchestration.md` (the human guide) gets a short note about the split.

**Acceptance criteria:**

- [ ] AGENTS.md ≤ 30 KB, and every rule in the old file is in the core or one doc (a hand-off checklist maps old headings → new homes).
- [ ] The area index lists every doc with when to read it.
- [ ] `prompt.sh slice orchestration 2` prints slice 2's `Stack`, `Reads` and `Tests` from this plan.
- [ ] Parser unit tests: fields present, absent, malformed.
- [ ] `pnpm check` passes.

## Slice 2: Watchdog, caps and trimmed output

Stack: no · Reads: docs/loops.md if slice 1 has landed, else AGENTS.md _Browser check budget_ · Tests: unit

**User stories:** US 8–14.

**What to build:**

- The manifest `scripts/loops/checks`: every check with usual seconds (from the logs: e.g. live-notes 313, ui 216, app-shell 208, upcoming 203, phase2 166, medications 163), cap (≈3× usual, rounded), never-exits flag, and `e2e` (all yes for now; slice 9 narrows it). `browser.sh` reads the suite order, caps and hang behaviour from it instead of its hard-coded lists.
- A silence watchdog: no output line for `CARETOOK_BROWSER_SILENCE` s (default 90) kills the check and its Chrome as `TIMEOUT (silent)`. The cap: `--timeout`, else the manifest's, else 600 s. A suite cap (`CARETOOK_BROWSER_SUITE_CAP`, default the selected caps' sum) stops the rest and lists them as not run. Kills match the transient pattern, so the one retry applies.
- Trimmed output: the terminal shows `▶`/`■`, FAIL lines with their diagnostics block, FLAKY lines and the table; the full stream goes to the log; `--verbose` prints everything.

**Acceptance criteria:**

- [ ] Fake checks in `scripts:unit`: a silent one is killed at the silence limit, a busy one at its cap, a clean one passes; a killed one is retried once; a suite over its cap stops and reports not-run checks.
- [ ] A unit test: every check in `check-areas` is in the manifest and vice versa.
- [ ] A real `pnpm prd browser sign-in` prints at most the verdict, the table and any FAIL lines.
- [ ] `pnpm check` passes.

## Slice 3: Backlog write safety, doctor, archive, fresh summary

Stack: no · Reads: AGENTS.md _The live backlog_ · Tests: unit

**User stories:** US 15–20.

**What to build:**

- Writes stage and commit only the paths they changed: `ingest` the inbox and tracker; every other write the tracker only, leaving the user's uncommitted inbox edits alone. `pnpm backlog commit` stays the way to commit hand edits.
- `pnpm backlog doctor`: inbox tags whose item title didn't come from that bullet, duplicate ids, items whose derived status differs from the stored one, owners whose branch is gone, summary rows without a body item (and the reverse). Exit non-zero on findings; `--fix` only for the safe ones (stale statuses, summary).
- `pnpm backlog archive`: moves landed, staging, live and dropped items with their notes to `plans/backlog-archive.md` (same format), and their bullets out of the inbox; `show` and `list --all` read the archive too.
- Every write recomputes derived statuses from local refs (no fetch) before rendering the summary.

**Acceptance criteria:**

- [ ] Throwaway-repo tests: an `add` with a dirty, untagged inbox line commits only backlog.md and leaves the line untouched; `doctor` reports a mis-tagged bullet like the B-106 case; `archive` moves items and bullets, and `show B-n` still finds one.
- [ ] Run once on the real backlog (through the tool, as a backlog commit): backlog.md shrinks to the open items.
- [ ] `pnpm check` passes.

## Slice 4: Machine leases and a load-aware `pnpm check`

Stack: no · Reads: docs/loops.md · Tests: unit

**User stories:** US 21–23. **Blocked by:** 2.

**What to build:**

- `scripts/loops/lease.sh` (plus a small Node entry for Vitest): `lease take <kind> [--wait S]`, `release`, `holders`, with atomic lock directories, dead-holder takeover and release on exit. `browser.sh` moves onto it with the same count (`CARETOOK_BROWSER_SLOTS`, 4).
- `pnpm prd check` takes a `check` lease (`CARETOOK_CHECK_SLOTS`, default 3) around `pnpm check`.
- A hook for component tests: their Chromium start takes a `browser` lease (wired here or by slice 6, whichever merges second).
- `pnpm prd status` lists the holders of both kinds.

**Acceptance criteria:**

- [ ] Unit tests: four takers of a three-slot kind (the fourth waits, then gets one), takeover after a killed holder, release on SIGTERM.
- [ ] Two `pnpm prd check` runs beyond the limit wait, and `status` shows who holds what.
- [ ] `pnpm check` passes.

## Slice 5: Stackless by default, a shared test Postgres, `stack up|down`, `gc`

Stack: no · Reads: docs/loops.md, docs/domain/data-layer.md · Tests: unit, integration

**User stories:** US 7, 24–27. **Blocked by:** 1.

**What to build:**

- A shared test Postgres: its own Compose project (`caretook-shared-test`) on a fixed port, started on first use; each worktree gets its own database (named for the worktree), written into `.env.test.local`. The integration globalSetup clears and migrates only that database and still refuses any non-local host. The main checkout keeps its :5435 database.
- `new.sh slice` creates a stack only for `Stack: yes` (from the plan, via slice 1's parser) or `--stack`; a stackless slice still gets env files and its test database.
- `pnpm prd stack up|down [name]`: add or remove a worktree's dev stack (slot lease, env files, Compose, migrate, seed).
- `rm.sh` drops the worktree's test database. `pnpm prd status` flags merged slice worktrees and stacks stopped for over a day; `pnpm prd gc` lists them and removes them after a yes.

**Acceptance criteria:**

- [ ] A new stackless slice worktree runs `pnpm test:integration` against its own database with no containers of its own.
- [ ] `stack up` then `stack down` leaves no containers, networks or slot lease behind.
- [ ] Two worktrees run integration tests at once without touching each other's database.
- [ ] `gc` lists and removes a merged slice worktree after confirmation.
- [ ] `pnpm check` passes.

## Slice 6: Component test harness (test device)

Stack: no · Reads: AGENTS.md _Stack_ and _Components_, docs/domain/sync.md · Tests: component

**User stories:** US 28–34.

**What to build:**

- Add `@vitest/browser-playwright`, `playwright` and `vitest-browser-react` (approved; pinned exactly, past `minimumReleaseAge`); install Chromium explicitly and document how (`allowBuilds` or a script).
- A `web:components` Vitest project: browser mode, headless Chromium, apps/web's Vite config (`~/`, Tailwind, daisyUI, the yjs and React dedupe), `*.browser.test.tsx`. It runs in `pnpm check`; `pnpm test:components -- --changed <base>` while building.
- A test seam in the device sync module to install a database in place of `openSync`'s (test builds only).
- The test device: `renderWithDevice({ route | element, url, user, role, fixtures, width?, theme? })` opens a local-only PowerSync database with the device schema (no connector, no upload), inserts fixtures, provides the session and group contexts, renders inside React Router's test stub, and returns the screen and the database. Fixture builders for users, groups, members, entries of every kind, documents, providers, links, medications, doses and periods.
- First example: the `ui/` primitives' behaviour now in `ui.mjs` (menus by tap and keyboard, sheet focus return, confirm dialog, field wiring, chips) at 420 and 1280, light and dark.

**Acceptance criteria:**

- [ ] Harness tests: fixtures render; a local write updates a live query on screen; a viewer and a writer see different controls; width and theme apply.
- [ ] The primitive tests pass; the project runs in well under a minute on a quiet machine.
- [ ] `pnpm check` passes with the new project.

## Slice 7: app-shell and ui to component tests

Stack: no · Reads: docs/domain/components.md, the app-shell and settings docs · Tests: component, e2e:app-shell, e2e:ui

**User stories:** US 35. **Blocked by:** 4, 6.

**What to build:**

- Component tests for app-shell's screen behaviour (header at 420, user and group menus, theme, last group, tab bar and section nav, group settings by role and offline, members' controls and refusals shown) and ui's remaining settings behaviour.
- Delete each covered CDP step; keep only flows that need the server or sync (sign out, a removed member's rows leaving another device, role changes reaching a second device).
- Fix the remaining FLAKY steps of what stays (from `.browser-flakes.log`).

**Acceptance criteria:**

- [ ] The hand-off maps every deleted step to its test.
- [ ] Shrunken `app-shell.mjs` and `ui.mjs` pass once each, together well under their old 7 minutes.
- [ ] `pnpm check` passes.

## Slice 8: phase2 and live-notes to component tests

Stack: no · Reads: docs/domain/timeline.md, docs/domain/live-notes.md · Tests: component, e2e:phase2, e2e:live-notes

**User stories:** US 35. **Blocked by:** 4, 6.

**What to build:**

- Component tests for the timeline screen (rows and cards, filters by kind and author, day headers, the strips, the wide layout, row taps by role, infinite scroll windows) and the entry page (drafts, one-tap note and event, title chips, time chip, Delete, Share, 404s, viewer read-only).
- Delete each covered CDP step; keep two-device convergence, Live now from another device, offline then reconnect.
- Fix the remaining FLAKY steps of what stays.

**Acceptance criteria:**

- [ ] The hand-off maps every deleted step to its test.
- [ ] Shrunken `phase2.mjs` and `live-notes.mjs` pass once each, together well under their old 8 minutes.
- [ ] `pnpm check` passes.

## Slice 9: The lean end-to-end set and the new rules

Stack: yes · Reads: docs/loops.md · Tests: e2e (the lean set), unit

**User stories:** US 36–39. **Blocked by:** 7, 8.

**What to build:**

- Narrow the manifest's `e2e` set to the cross-cutting flows (sign-in and session, first sync, sign-out wipe, two devices converging, offline then reconnect, refused uploads, invites and email, CSP and the check build) plus the shrunken checks; the others stay runnable but leave the suite until their areas move.
- `--changed` maps screen files to component tests (already in `pnpm check`) and to the lean set only where a flow is touched; `check-areas` updated.
- Rewrite `docs/loops.md`'s browser budget and landing steps: component tests while building, `pnpm check` plus `--changed` at hand-off, the lean set once at landing and before the PR to `staging`. Add the rule "screens get component tests; cross-cutting flows get end-to-end checks". File one backlog item per check still to move.
- Drop aliases kept for compatibility.

**Acceptance criteria:**

- [ ] The lean set passes once, with a table, in a few minutes on a quiet machine.
- [ ] `--list` shows a timeline-only change selecting no end-to-end check.
- [ ] Backlog items exist for each remaining check to move.
- [ ] `pnpm check` passes.
