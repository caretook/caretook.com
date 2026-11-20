# PRD: Orchestration 2 (faster, lighter loops)

**Status: done** (2026-11-19): all nine slices landed in `dev`; see the plan's _Status_.

Topic `orchestration`. Backlog: B-59, B-89, B-107, B-108, B-109, B-110, B-111. Interviewed 2026-11-19.

## Problem Statement

Running PRDs in parallel has become slow, heavy and unreliable, and the cost grows with every PRD:

- **Browser checks dominate the clock.** 24 hand-written CDP scripts (~24k lines, ~1,900 assertions) take about 35 minutes as a full suite on a quiet machine and hours under load. Single checks average 3–5 minutes (`live-notes` 5.2, `ui` 3.6, `app-shell` 3.5, `upcoming` 3.4). About a third of runs used to fail, mostly on contention; 42 automatic FLAKY retries are logged (app-shell 11, phase2 6, ui 4, live-notes 4).
- **Checks hang.** Only the two checks that never exit get a default timeout. On 2026-11-19 `medications-2`'s landing suite held a browser lease for over three hours on one check.
- **CPU load spikes.** Several loops finishing together run `pnpm check`, Vite builds and Chrome at once; loads past 40 are routine and one reached 500, which causes the flakes that cause the reruns.
- **Docker sprawl.** Every stacked worktree runs four containers and two networks; Docker runs out of networks at about 21, and stack setup is slow and sometimes fails on first boot.
- **Agent tokens.** AGENTS.md is ~195 KB (~50k tokens) and loads into every session, loop and orchestrator alike, though a slice needs a fraction of it. `plans/backlog.md` is 133 KB, and its summary shows stale statuses. Checks print every PASS line.
- **Backlog integrity.** A backlog write committed a half-typed inbox bullet with another item's id (`(B-106)`), so the bullet looked filed when it wasn't.

## Solution

Ordered so each landing makes the next wave cheaper, lowest-hanging fruit first:

1. **Smaller context:** AGENTS.md becomes a short core plus area docs under `docs/domain/`; each slice in a plan names the docs it needs, whether it needs a stack and which tests it adds, and the loop prompt passes those on. The backlog archives finished items, keeps its summary fresh, and refuses to mis-tag.
2. **No hangs, quiet output:** every browser check runs under a silence watchdog and a hard cap, and prints only failures and a summary.
3. **Less load and fewer containers:** machine-wide leases cover `pnpm check` as well as browser checks; slices are stackless by default, with one shared test Postgres for integration tests.
4. **Fast, reliable UI tests:** screen behaviour moves from end-to-end CDP scripts to Vitest browser-mode component tests on a local test device (a real, local-only PowerSync database in Chromium, no server, no Docker). End-to-end checks shrink to a lean set of cross-cutting flows that truly need the server and sync.

## User Stories

1. As the dev keeper, I want every session to load a short AGENTS.md, so that loops and orchestrators start faster and spend fewer tokens.
2. As a loop agent, I want my slice to name the area docs I must read, so that I read the medications rules for a medications slice and nothing else.
3. As a loop agent, I want an index of area docs in AGENTS.md, so that I can find a rule my slice didn't anticipate.
4. As an orchestrator, I want to fold a landing's lasting decisions into the matching area doc, so that the core stays short.
5. As a planning agent, I want each slice in a plan to say `Stack`, `Reads` and `Tests`, so that the loop gets the right resources and context.
6. As a loop agent, I want `prompt.sh slice` to print my slice's `Reads` and `Tests`, so that I don't search the plan for them.
7. As the dev keeper, I want `pnpm prd slice` to give a slice a stack only when its plan says `Stack: yes`, so that most slices start without Docker.
8. As anyone running a browser check, I want a check that prints nothing for 90 s to be killed, so that a hang never holds a lease for hours.
9. As anyone running a browser check, I want each check to have a hard cap of about three times its usual time (10 min when unknown), so that slow-but-moving checks still end.
10. As an orchestrator, I want the suite as a whole to have a cap, so that a landing never waits past a known bound.
11. As anyone running checks, I want a watchdog or cap kill to count as a timeout and get the one automatic retry, so that contention still self-heals.
12. As an agent, I want check output trimmed to verdict lines, FAIL lines with diagnostics and the table, so that I read tens of lines, not thousands.
13. As a debugger, I want `--verbose` and the full log file, so that nothing is lost.
14. As the dev keeper, I want one manifest listing every check's usual time, cap and whether it is in the end-to-end set, so that caps and suites live in one place.
15. As the user, I want backlog writes to commit only the change they made, so that my half-typed inbox lines are never committed or tagged by someone else's write.
16. As the user, I want `pnpm backlog doctor` to report inbox tags pointing at an item with a different title, duplicate ids, stale derived statuses and owners whose branch is gone, so that I can trust the backlog.
17. As an orchestrator, I want to run `doctor` at each wave boundary, so that problems surface early.
18. As the user, I want `pnpm backlog archive` to move landed, staging, live and dropped items (and their inbox bullets) to `plans/backlog-archive.md`, so that backlog.md stays short.
19. As anyone, I want `show` and `list --all` to still find archived items, so that history isn't lost.
20. As the user, I want the summary table's derived statuses refreshed from git on every write, so that it never shows a landed item as ready.
21. As the dev keeper, I want `pnpm check` to take a machine-wide lease (three at once by default), so that a wave of loops finishing together doesn't push the load past 100.
22. As a loop agent, I want component tests' Chromium to share the browser lease, so that four worktrees can't each start browsers at once.
23. As anyone, I want `pnpm prd status` to show who holds check and browser leases, so that I know why I'm waiting.
24. As the dev keeper, I want slices to be stackless by default, so that Docker runs a handful of containers instead of dozens.
25. As a loop agent in a stackless worktree, I want `pnpm test:integration` to use my own database on one shared test Postgres, so that data-layer slices need no stack.
26. As a loop agent, I want `pnpm prd stack up` and `stack down`, so that I can add a stack when I find I need one, and drop it when done.
27. As the dev keeper, I want `pnpm prd status` to flag merged slice worktrees and stacks stopped for over a day, and `pnpm prd gc` to remove them after asking, so that leftovers don't pile up.
28. As a loop agent, I want to test a screen by rendering its route on a local test device with fixtures, so that I verify behaviour in seconds without a server.
29. As a loop agent, I want the test device to run the real live queries and local writes, so that a test covers the query, the hook and the markup together.
30. As a loop agent, I want fixture builders for groups, members, entries, providers, medications and periods, so that a test sets up only what it needs.
31. As a loop agent, I want to render as owner, caretaker or viewer, so that role rules are one parameter.
32. As a loop agent, I want component tests in real Chromium, so that React Aria, native dialogs, focus return, widths and dark mode behave as in the app.
33. As a loop agent, I want `vitest --changed` to run only the component tests my diff touches while building, so that the feedback loop is fast.
34. As the dev keeper, I want the whole component project in `pnpm check`, so that hand-offs and landings cover every screen.
35. As the dev keeper, I want app-shell's, ui's, phase2's and live-notes' screen-level steps moved to component tests and deleted from the CDP scripts, so that the biggest flake sources are gone.
36. As the dev keeper, I want a lean end-to-end set (sign-in and session, first sync and sign-out wipe, two devices converging, offline then reconnect, permission-refused uploads, invites and email, CSP and the check build), so that landings run minutes, not hours.
37. As an orchestrator, I want `--changed` and the landing rules to use the lean set plus component tests, so that the browser check budget shrinks.
38. As the dev keeper, I want the steps that still flake in the lean set fixed rather than retried, so that FLAKY lines become rare.
39. As a future PRD's loop agent, I want the docs to say "screens get component tests; cross-cutting flows get end-to-end checks", so that new work follows the new pattern.

## Implementation Decisions

- **Order and landing:** four waves (1–3, 4–6, 7–8, 9), each landed as soon as it's green, run-through mode. This PRD changes tooling every other PRD uses; landings are additive where possible, and other orchestrators pick changes up at their next sync.
- **AGENTS.md split:** a core of at most 30 KB: working rules, the PRD and loop process in brief, stack, architecture rules, components rules, compliance, open questions, and an index table of area docs (area → doc → when to read it). Domain sections (_Care groups_, _Timeline entries_, _Live notes_, _Providers_, _Medications_, _Appointments_, _Care periods_, _Search_, _Care recipient profiles_, _Marketing site_, _Notifications_, the sync and data-layer detail, browser checks) move to `docs/domain/<area>.md`, and the loop handbook (running loops, browser budget, gotchas) to `docs/loops.md`. Content moves verbatim first, then is trimmed only of history. `docs/orchestration.md` stays the human guide. Orchestrators fold landings into the matching doc. **For this PRD only, slices may edit AGENTS.md and `docs/`** (the user agreed); later PRDs keep the rule that loops don't.
- **Plan slice fields:** each slice in a plan carries `Stack: yes|no`, `Reads: <docs>` and `Tests: <component | integration | e2e:<check> | unit>`. A small parser (pure, in `scripts/loops/`) reads them from a plan; `prompt.sh slice` prints them and `new.sh slice` uses `Stack`. Missing fields mean: no stack, read nothing extra, and a warning. `prd-to-plan`'s output shape (in the planning prompt) includes them.
- **Check manifest:** one machine-readable table in `scripts/loops/` with, per check: name, usual seconds, cap seconds, `e2e` membership, and whether it never exits on its own. `browser.sh` reads suites, caps and hang behaviour from it; `check-areas` stays the file → check map and is kept consistent with it by a unit test.
- **Watchdog and caps:** `browser.sh` tracks the time since the check's last output line; 90 s of silence (`CARETOOK_BROWSER_SILENCE`) kills the check and its Chrome as `TIMEOUT (silent)`. The cap is `--timeout`, else the manifest's, else 600 s. The suite cap (`CARETOOK_BROWSER_SUITE_CAP`, default the sum of caps of the selected checks, bounded) stops the remaining checks and reports them as not run. Both kinds of kill match the transient pattern, so the one retry applies.
- **Output:** terminal gets `▶`/`■` lines, FAIL lines with the diagnostics block, FLAKY lines and the table; the full stream goes to the log. `--verbose` restores everything.
- **Leases:** one generic lease library (lock directories, atomic take, takeover of dead holders, release on every exit, wait with a bound), used by `browser.sh` (kind `browser`, 4), `pnpm prd check` and plain `pnpm check` when run under `pnpm prd` (kind `check`, 3, `CARETOOK_CHECK_SLOTS`), and component tests' browser start (kind `browser`). `pnpm prd status` lists holders of both kinds.
- **Stackless by default:** `new.sh slice` makes a stack only for `Stack: yes` (or `--stack`); PRD integration worktrees keep theirs. One shared test Postgres (its own Compose project, a fixed port, created on first use) holds a database per worktree; `.env.test.local` names it; the integration globalSetup clears and migrates only that database and still refuses any non-local host. `rm.sh` drops it. `pnpm prd stack up|down` adds or removes a worktree's dev stack (slot lease, env files, Compose). `pnpm prd gc` lists merged slice worktrees and stacks stopped for over a day and removes them after a yes.
- **Component tests:** a `web:components` Vitest project in browser mode (Playwright provider, headless Chromium), loading apps/web's Vite config so `~/` imports, Tailwind and daisyUI work. Files are `*.browser.test.tsx` beside what they test. **New dev dependencies, approved by the user:** `@vitest/browser-playwright`, `playwright`, `vitest-browser-react`, pinned exactly and older than `minimumReleaseAge`; Chromium is installed explicitly (an `allowBuilds` entry or a `playwright install chromium` step that the slice documents).
- **The test device (deep module):** a test seam in the device sync module lets a test install its own database in place of `openSync`'s; `renderWithDevice({ route | element, url, user, role, fixtures, width?, theme? })` opens a local-only PowerSync database with the device schema (no connector, no upload), inserts fixtures, provides the session and group contexts, renders inside a memory router (React Router's test stub), and returns the screen plus the database for assertions on local writes. Fixture builders produce device rows for groups, members, users, entries (every kind), documents, providers, links, medications, doses and periods, with stable fictional defaults.
- **What moves and what stays:** screen behaviour (layout, menus, filters, sheets, role rules, focus, keyboard, widths, themes, local writes) moves to component tests; a CDP step is deleted once a named component test covers it. The lean end-to-end set keeps flows that need the server, sync or a real build: sign-in and session, first sync and sign-out wipe, two devices converging, offline then reconnect, uploads refused by permissions, invites and email, CSP and the check build. This PRD moves app-shell, ui, phase2 and live-notes; other checks move as their areas are next touched (a backlog item per check).
- **Run rules after the move:** while building, `vitest --project web:components --changed <base>`; at hand-off and landing, `pnpm check` (which includes the component project) plus `pnpm prd browser --changed` over the lean set; the full lean set before the PR to `staging`.
- **Backlog:** writes stage and commit only the paths they changed (ingest may touch the inbox; other commands only backlog.md), using the lock as now; `doctor` checks tag/title agreement (fuzzy: the item's title must come from that bullet), duplicate ids, stale derived statuses, owners whose branch is gone, and items in the summary but not the body; `archive` moves finished items (landed, staging, live, dropped) with their notes into `plans/backlog-archive.md` and their bullets out of the inbox; reads (`show`, `list --all`) include the archive; every write recomputes derived statuses (no fetch) before rendering the summary.

## Testing Decisions

- Good tests check behaviour through a module's interface: what a command prints and writes, what a screen shows and writes, never internal helpers.
- **scripts:unit** (prior art: `scripts/backlog/*.test.mjs` against throwaway git repos): the watchdog and caps with fake checks that go silent, run past their cap or exit cleanly; the retry on a watchdog kill; terse versus verbose output; the lease library (take, wait, takeover, release on kill); the manifest and its agreement with `check-areas`; the plan-field parser; backlog write isolation (a dirty inbox line is neither committed nor tagged by `add`/`set`/`note`), `doctor`'s findings, `archive` and archived reads, and the fresh summary.
- **web:components:** the harness's own tests (fixtures appear, a live query updates after a local write, roles change what renders, widths and themes apply), then the moved app-shell, ui, phase2 and live-notes behaviour. Prior art: the steps being moved (`app-shell.mjs`, `ui.mjs`, `phase2.mjs`, `live-notes.mjs`) define what to assert.
- **integration:** unchanged tests, now against the worktree's database on the shared test Postgres.
- **Browser checks:** the lean set must pass under the watchdog; a slice that deletes CDP steps runs the shrunken check once to show it still passes.

## Out of Scope

- Porting the lean end-to-end set to Playwright Test (a backlog item).
- Moving the other checks (providers, medications, upcoming, search, care-periods, profiles, groups, invites UI, routing…) to component tests: later, area by area.
- Accessibility scanning (axe) and visual snapshots.
- Sharing PowerSync between worktrees (one instance per source database), and CI on GitHub.
- B-88's items (already built on `dev`).

## Further Notes

- Measured 2026-11-19: idle stacks ~250 MB each and near-zero CPU; the cost is concurrent checks, builds and PowerSync under test.
- Slice 1 (the split) touches the file every orchestrator edits at landing: land it promptly and tell running orchestrators to sync before their next AGENTS.md edit.
- Component tests and stackless slices change the advice in AGENTS.md's _Browser check budget_; slice 9 rewrites it for the lean set.
