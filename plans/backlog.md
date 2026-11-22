# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

The PRD registry: **row order is the priority**. Edit it only with `pnpm backlog prd` (`add`, `set`, `move`); `pnpm backlog prd list` shows each topic's state (to-write, planned, running, idle, hold, done), worked out from git and the items. At most three PRD orchestrators run at once.

`Flags`: `hold` (waits on the user), `done`, `standing` (never finishes; runs while it has waiting items), `alone` (nothing else runs beside it). `After`: the topics it comes after. `Hot files`: repo path prefixes it shares.

| PRD | Flags | After | Hot files | Doc and notes |
| --- | ----- | ----- | --------- | ------------- |
| `agent-autonomy` | hold | — | `scripts/loops/ask`, `scripts/loops/notice`, `scripts/loops/flake`, `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/dispatch`, `scripts/loops/status-extra`, `scripts/loops/lease`, `scripts/loops/check-`, `scripts/loops/lib.sh`, `scripts/loops/land`, `scripts/loops/new.sh`, `scripts/loops/browser.sh`, `scripts/loops/load-gate`, `scripts/loops/codex-review`, `scripts/loops/sync-verdict`, `scripts/loops/ready` | [PRD](agent-autonomy-prd.md), [plan](agent-autonomy-plan.md) (B-503 to B-506, B-516 to B-518): 10 slices, waves (1, 2) → 3 → (4, 5) → 6 → 7 → (8, 9, 10): questions that take their recommendation after 30 minutes (planners' too), a notice board, a machine claim for a landing's full check, the flake rule, flakes filed by the check, a Checked: trailer and a full pass that carries over a dev sync, landing on an unsynced tip, landing notices and the hold. Tooling only. Follow-on: agent-autonomy-2. While test-health runs (its word, 2026-11-22): land no change to what quick or full means (check-plan.mjs, lib.sh checked_ok) or what land accepts in the middle of a test-health landing, only between its waves; never touch scripts/eslint/ or eslint.config.js. |
| `agent-autonomy-2` | — | `agent-autonomy` | `scripts/loops/session`, `scripts/loops/context`, `scripts/loops/dispatch`, `scripts/loops/status-extra`, `scripts/loops/prompt.sh`, `scripts/loops/prd.sh` | [PRD](agent-autonomy-2-prd.md), [plan](agent-autonomy-2-plan.md) (B-507, B-508, B-509): 2 slices in 2 waves: a context hook that tells a session past 160k to rotate, sizes in status, the dispatcher's follow-up. Cut from agent-autonomy by its planner. Tooling only |
| `agent-autonomy-3` | — | `agent-autonomy` | `scripts/loops/ask`, `scripts/loops/prompt.sh`, `scripts/loops/land`, `scripts/loops/dispatch`, `scripts/backlog/` | To write. A Fable skeptic before every ask, before risky landings (a forced landing, a flaky pass, a declined Codex finding), and as the final check on Opus planners, with a registry flag that keeps a design topic's planner on Fable (B-511, B-512, B-513). Filed into agent-autonomy after its plan landed; builds on its defaulting asks and flake rule |
| `orchestration` | done | — | — | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): **done** (`94e6b80`) |
| `live-notes-ux` | done | — | — | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done** |
| `quick-fixes` | done | — | — | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–46 in `dev` (44–46: B-135, B-134, B-157 in `2d57e70`); wave 13 (slices 47–51: B-184 to B-190) in `dev` (`bf0891df`); wave 14 (slices 52–57: B-192, B-198, B-201, B-191, B-174, B-175) in `dev`; wave 15 (B-180, B-182, B-225, B-211) in `dev` (`2152bbed`; B-207 landed as hotfix `fc373a34`); wave 16 (B-228, B-230, B-232 to B-235, B-237, B-238) in `dev` (`5a47c18f`, PR #20); the next wave is **running**; new fixes append as the next slice · Hot files: varies by slice; none now |
| `app-shell` | done | — | — | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done** |
| `timeline-polish` | done | — | — | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done** |
| `search` | done | — | — | [PRD](search-prd.md), [plan](search-plan.md): **done** (`a5f3d4d`) |
| `providers` | done | — | — | [PRD](providers-prd.md), [plan](providers-plan.md): **done** (`7c075d1`) |
| `medications` | done | — | — | [PRD](medications-prd.md), [plan](medications-plan.md): **done** (`8ff8354`) |
| `medications-2` | done | — | — | [PRD](medications-2-prd.md), [plan](medications-2-plan.md): **done** (`a6738b4`) |
| `assistant` | done | — | — | [PRD](assistant-prd.md), [plan](assistant-plan.md): **done** (`7f3ec10`) |
| `connectors` | done | — | — | [PRD](connectors-prd.md), [plan](connectors-plan.md): **done** (`a08af6bd`) |
| `providers-2` | done | — | — | [PRD](providers-2-prd.md), [plan](providers-2-plan.md): **done** (`df4d0c05`) |
| `appointments-2` | done | — | — | [PRD](appointments-2-prd.md), [plan](appointments-2-plan.md): **done** (`f49aa958`) |
| `connectors-2` | done | — | — | [PRD](connectors-2-prd.md), [plan](connectors-2-plan.md): **done** (`017a9b29`) |
| `medications-3` | done | — | — | [PRD](medications-3-prd.md), [plan](medications-3-plan.md): **done** (`82221a92`) |
| `list-filters` | done | — | — | [PRD](list-filters-prd.md), [plan](list-filters-plan.md): **done** (`9d6a7439`, PRs #18 and #21); the Planner part (B-284) moved to `planner-2` |
| `medications-tabs` | done | — | — | [PRD](medications-tabs-prd.md), [plan](medications-tabs-plan.md): **done** (`07a6b59a`, PR #14) |
| `conditions` | done | — | — | [PRD](conditions-prd.md), [plan](conditions-plan.md): **done** (`a95acb73`) |
| `github-review` | done | — | — | [PRD](github-review-prd.md), [plan](github-review-plan.md): **done** (`63e225fb`, PR #12); follow-ups B-239 to B-242, B-244 |
| `routing` | done | — | — | [PRD](routing-prd.md), [plan](routing-plan.md): **done** (`ff25ef2`) |
| `components` | done | — | — | [PRD](components-prd.md), [plan](components-plan.md): **done** (`ca39416`) |
| `invites` | done | — | — | [PRD](invites-prd.md), [plan](invites-plan.md): **done** (`e6286f4`) |
| `profiles` | done | — | — | [PRD](profiles-prd.md), [plan](profiles-plan.md): **done** (`88890df`) |
| `appointments` | done | — | — | [PRD](appointments-prd.md), [plan](appointments-plan.md): **done** |
| `care-periods` | done | — | — | [PRD](care-periods-prd.md), [plan](care-periods-plan.md): **done** (`f6c4e92`) |
| `tasks` | done | — | — | [PRD](tasks-prd.md), [plan](tasks-plan.md): **done** (`1ee7864`) |
| `admin` | done | — | — | [PRD](admin-prd.md), [plan](admin-plan.md): **done** |
| `check-migration` | done | — | — | [PRD](check-migration-prd.md), [plan](check-migration-plan.md): **done** (`c7fd1390`) |
| `loop-recovery` | done | — | — | [PRD](loop-recovery-prd.md), [plan](loop-recovery-plan.md): **done** |
| `app-speed` | done | — | — | [PRD](app-speed-prd.md), [plan](app-speed-plan.md): **folded into `timeline-ux`** (its PRD is the speed half's input) |
| `agent-tooling` | done | — | — | [PRD](agent-tooling-prd.md), [plan](agent-tooling-plan.md): **done**, all 6 slices in `dev` (`5d5e1d7`): batched backlog commits, `pnpm log`, the doc budget guard, the core + `docs/agents/` split, the six area docs trimmed |
| `code-layout` | done | — | — | [PRD](code-layout-prd.md), [plan](code-layout-plan.md): **done** (`18e9cf8`) |
| `timeline-ux` | done | — | — | [PRD](timeline-ux-prd.md) (speed half: [app-speed PRD](app-speed-prd.md)), [plan](timeline-ux-plan.md): 10 slices, waves (1, 2, 3) → (4, 5, 6) → (7, 8, 9) → 10: navigation that doesn't wait, tiles that remember (dimmed until fresh), the bundle budget, prefetched tabs, one Today card with status hues, the day header with its summary and rows with the author under the menu and no period places, the service worker, simple mode's order and type scale, quick entry's rotating placeholder, open-after-save and lean recent lines, cheaper `/rpc` auth (B-136–B-140, B-144, B-155, B-156, B-162–B-171). **Done 2026-11-20**: all 10 slices in `dev` (8b3179ab); follow-ups B-174, B-175, B-178, B-179 · Depends on: wave 1: none; wave 2 on: `code-layout` slice 5 in `dev` (`appUrls`), or coordinate with it · Hot files: `lib/auth/session.ts`, `lib/auth/sessionRules.ts`, `lib/app-shell/me.ts`, `lib/sync/` (the remembering hook), `recentLines` (at code-layout's paths), `SectionNav`, the `/app` layout (update notice), the timeline route, its strips (replaced by `TodayCard`), `DayHeader`, `DaySummaryLine`, the row components, `PeriodMarkerItem`, `SimpleTimeline`, quick entry, `packages/auth`, `packages/api/src/procedures.ts`, `routes/rpc.ts`, `scripts/loops/prd.sh`, `scripts/loops/check-areas.d/`, new `scripts/build/` |
| `timeline-ux-2` | done | — | — | [PRD](timeline-ux-2-prd.md), [plan](timeline-ux-2-plan.md): **done** (`f1fc883e`) |
| `quick-entry` | done | — | — | [PRD](quick-entry-prd.md), [plan](quick-entry-plan.md): **done** (`c2ec7447`, PR #15) |
| `planner-2` | done | — | — | [PRD](planner-2-prd.md), [plan](planner-2-plan.md): **done** (`8069cf94`, `5a5c2fd6`); follow-ups B-382 to B-387, B-393 |
| `tasks-2` | done | — | — | [PRD](tasks-2-prd.md), [plan](tasks-2-plan.md): **done** (`2db975a7`) |
| `assistant-2` | done | — | `apps/web/app/lib/assistant/`, `packages/api/` | dropped 2026-11-21 (B-376 assistant chat with voice): not for launch; the user may resurface it |
| `fixes-tooling` | standing | — | — | plan: plans/fixes-tooling-plan.md, rules: plans/fixes-rules.md |
| `fixes-ui` | standing | — | — | plan: plans/fixes-ui-plan.md, rules: plans/fixes-rules.md |
| `fixes-bug` | standing | — | `packages/data/src/services/todoService` | plan: plans/fixes-bug-plan.md, rules: plans/fixes-rules.md |
| `fixes-nit` | standing | — | — | plan: plans/fixes-nit-plan.md, rules: plans/fixes-rules.md |
| `inbox-agent` | — | `orchestration-3` | `scripts/backlog/`, `scripts/loops/lib.sh`, `scripts/loops/prd.sh`, `scripts/loops/prompt.sh`, `scripts/loops/dispatch`, `scripts/loops/tidy`, `scripts/loops/queue` | To write. Priority from a Next up list in the inbox, an inbox agent writing to origin/dev, duplicate checks and automatic archive, asks hygiene (B-406, B-425, B-435, B-429). Cut from orchestration-3 |
| `asks-relay` | hold | `inbox-agent` | `scripts/loops/ask`, `scripts/loops/prompt.sh`, `scripts/loops/dispatch`, `scripts/loops/tidy`, `scripts/loops/session`, `scripts/loops/prd.sh` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** The backlog session as go-between for every agent's questions, and asks queue hygiene. Cut from inbox-agent by its planner (plans/inbox-agent-prd.md, Follow-on topic) |
| `sync-safety` | — | — | `packages/api/src/sync`, `apps/web/app/lib/sync/`, `apps/web/app/lib/auth/session`, `apps/web/app/routes/sign-out.tsx`, `apps/web/app/routes/app/layout/SyncIndicator.tsx`, `apps/web/app/routes/app/layout/UserMenu.tsx`, `packages/data/src/services/`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/providers/providers.sync.ts`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/signout-wipe.spec.mjs`, `scripts/browser-checks/session-end.spec.mjs` | to write (B-285 to B-296, B-382 to B-384, B-387: repeating-todo upload bugs Codex found, moved from `planner-2`), from the 2026-11-21 code review (findings not re-verified): refused sync changes shown to the user, an upload queue that can't wedge, offline edits that don't revert a co-member's change, replayed PUTs, global client-chosen ids, the sign-out wipe and unsent writes, then the column-agreement test and one generic upload handler · Depends on: (none); `test-health` shares the upload tests (B-371, B-374) · Hot files: `packages/api/src/sync.ts`, `lib/sync/client.ts`, `SyncIndicator`, `session.ts`, `sign-out.tsx`, `medications.sync.ts`, `providers.sync.ts`, the services' `upsert`s |
| `sync-safety-2` | hold | `sync-safety` | `packages/api/src/sync`, `apps/web/app/lib/sync/`, `packages/data/src/services/`, `apps/web/app/lib/todos/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-294 to B-296, B-382 to B-384, B-387): cut from sync-safety by its planner, 2026-11-21: device transactions applied atomically, device clocks on change entries, the stale tab, and the repeating-todo races |
| `dose-accuracy` | hold | — | `packages/data/src/db/schema/medications/dueDoses.ts`, `packages/data/src/db/schema/medications/duePasses.ts`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/medications/dueDoses.sync.ts`, `apps/web/app/lib/appointments/visitPrep`, `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `packages/api/src/connectors/tools/todaysDoses.ts` | to write (B-297 to B-299), from the 2026-11-21 code review: a dose answers only its own day's slot, deterministic dose ids, visit prep's missed doses per schedule epoch · Hot files: `db/schema/medications/dueDoses.ts`, `medications.sync.ts` (`logDoses`), `visitPrep.ts` |
| `ui-kit` | done | — | `apps/web/app/components/ui/`, `apps/web/app/app.css`, `apps/web/app/components/settings/`, `apps/web/app/routes/sign-in.tsx`, `apps/web/app/routes/app/layout/SectionNav.tsx` | [PRD](ui-kit-prd.md), [plan](ui-kit-plan.md) (B-257 to B-267, B-270, B-396, B-397, B-399): 7 slices, waves 1 → (2, 3, 4) → (5, 6) → 7: a dev gallery at `/dev/ui`, Button and the form footer; the pill tab bar (medications, Planner, sign-in) and the phone's floating, icon-only bottom bar; messages, empty and loading states and Badge; text tokens, the page container and one heading scale; Card, lists, check and toggle fields; the detail header and full-width section bands on the medication, provider, care period and to-do pages, then the profile. Each primitive is adopted in settings, sign-in or the detail pages; the rest of the app is `ui-kit-2`. No migration, no deps; stackless but for slice 2 (two browser checks). **Ready to start** · Depends on: (none): `list-filters` and `planner-2` are in `dev`; never beside `i18n`; `quick-fixes` between waves · Hot files: `components/ui/` (its `index.ts`, `styles.ts`, `plain/`, `TabNav`, `PageHeader`, `Field`), `app.css`, `components/settings/`, the settings route folders, `routes/sign-in.tsx` and the account card, the dev routes part, the outer `main` and `h1` of `/app` pages outside the timeline and entry folders, the five detail-page folders, `LinkedTodos`, `AllergiesRegion`; `routes/app/layout/SectionNav.tsx` and the bar's locator in `app-shell.spec.mjs` (`test-health` slice 12 rewrites that spec) and `roundtrip.spec.mjs` |
| `ui-kit-2` | done | `ui-kit` | `apps/web/app/components/ui/`, `apps/web/app/app.css`, `apps/web/app/root.tsx`, `apps/web/app/assets/fonts/`, `apps/web/app/routes/dev/ui/`, `scripts/build/manifest`, `scripts/build/service-worker`, `apps/web/app/routes/app/groups/medications/route.tsx`, `apps/web/app/routes/app/groups/medications/routes.ts`, `apps/web/app/routes/app/groups/medications/passes/`, `apps/web/app/lib/medications/urls.ts`, `apps/web/app/lib/medications/medicationSheets`, `apps/web/app/routes/app/groups/providers/route.tsx`, `apps/web/app/routes/app/groups/planner/PlannerHeader.tsx`, `apps/web/app/routes/app/groups/periods/route.tsx`, `apps/web/app/components/entry/SeriesScopeDialog.tsx`, `apps/web/app/routes/app/groups/todo/RepeatDeleteDialog.tsx`, `apps/web/app/routes/app/groups/timeline/DaySummaryLine.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/TodayCard.tsx` | [PRD](ui-kit-2-prd.md), [plan](ui-kit-2-plan.md) (B-423, B-420, B-419, B-424, B-415, B-414, B-268): 6 slices, waves (1, 4, 6) → (2, 5) → 3: one Button with tones, sizes and shapes; a + add button at the top right of every main page header (Providers with an icon-only Import, the Planner, Care periods); Medications with Passes as a third tab and an add menu; the Atkinson Hyperlegible Next typeface, self-hosted; quiet motion for buttons, rows, chevrons and expanding regions; a kit ChoiceDialog for the two three-way questions. No migration, no deps; slices 3, 4 and 6 have a stack. The sweeps, the guard and overlay motion are ui-kit-3 · Depends on: ui-kit in dev; never beside i18n |
| `ui-kit-3` | hold | `ui-kit-2` | `eslint.config.js` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-398, B-269, B-448 and overlay motion): every remaining area swept onto the kit, one area per slice; then the lint guard. Cut from ui-kit-2 to keep it at six slices; starts after ui-kit-2 so the sweeps copy its final Button, header and motion contracts; before test-health waves 5 to 7; never beside i18n. Hot files when planned: most route and component folders, one area per slice |
| `orchestration-2` | done | `check-speed` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/rm.sh`, `scripts/loops/open-session.`, `scripts/loops/session`, `scripts/backlog/` | [PRD](orchestration-2-prd.md), [plan](orchestration-2-plan.md) (B-389, B-390, B-391, B-395): 6 slices, waves (1, 2, 3) → 4 → 5 → 6: the PRD table as a registry (`pnpm backlog prd`, row order is the priority, states worked out), recorded sessions, an asks queue (`pnpm prd ask`, pushed to the phone by the asking session), drain-then-rotate after each landing (`pnpm prd rotate`), run-through prompts and status, then `quick-fixes` split into five standing topics (`fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`, on hold until the user orders them). Tooling only. **Ready to start** once `check-speed` is in `dev` · Depends on: `check-speed` in `dev` (shared `prd.sh`, `prompt.sh`, `pnpm test:tooling`); before `test-health`, never beside it · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `rm.sh`, `open-session.*`, `scripts/backlog/`, this PRD table |
| `orchestration-3` | done | `orchestration-2` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/recover.sh`, `scripts/loops/land.sh`, `scripts/loops/lease`, `scripts/loops/new.sh`, `scripts/loops/session`, `scripts/loops/open-session.`, `scripts/loops/inventory`, `scripts/loops/tidy`, `scripts/loops/dispatch`, `scripts/loops/check-run`, `scripts/backlog/backlog.mjs` | to write (B-392, B-404: one command to ship `dev` to staging through the Codex review): the dispatcher (`pnpm prd dispatch`: the pick, unattended planners, `queue` as "move to the front", recovery and status). What is settled and what is open: [orchestration-2 PRD](orchestration-2-prd.md), _Follow-on_ · Depends on: `orchestration-2` in `dev` (last item B-395) · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `recover.sh`, the registry |
| `staging-ship` | hold | — | `scripts/loops/review.sh`, `scripts/loops/codex-review`, `scripts/loops/prd.sh`, `scripts/loops/land.sh` | To write. Ship dev to staging in one command, Codex findings filed by tool, a staging to-test report (B-404, B-430, B-436). Cut from orchestration-3; doesn't need the dispatcher |
| `worker-watch` | hold | `orchestration-3` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/check-times` | To write. Run metrics in one summary, then stuck workers handled against usual times (B-434, B-408). Cut from orchestration-3 |
| `self-recovery` | hold | `orchestration-3` | `scripts/loops/recover.sh`, `scripts/loops/land.sh`, `scripts/loops/session`, `scripts/loops/dispatch`, `scripts/loops/prd.sh` | To write. launchd recovery, draining before a usage limit, step-in-progress markers, cost records, records for every session kind, headless sessions (B-407, B-433, B-437, B-438). Cut from orchestration-3; its planner cuts headless out if over six slices |
| `fixes-perf` | standing | — | — | plan: plans/fixes-perf-plan.md, rules: plans/fixes-rules.md |
| `check-speed` | done | — | `scripts/loops/`, `vitest.config.ts`, `package.json`, `packages/data/test/` | [PRD](check-speed-prd.md), [plan](check-speed-plan.md) (B-271, B-272, B-273, B-278): 4 slices, waves (1, 2) → (3, 4): every check through two check leases and into a check log (`pnpm prd check --times`), tooling tests in their own Vitest project, quick check at hand-off with the full check once per landing, integration tests on three workers with a database each. No load gate. Measured 2026-11-21: a full test run takes about 11 minutes and five PRDs made 39 of them · Hot files: `scripts/loops/` (`prd.sh` `check`, `prompt.sh`, `lease.sh`, `test-db.sh`, `rm.sh`), `vitest.config.ts`, `package.json`, `packages/data/test/`, `testDatabase.ts` |
| `test-health` | — | `check-speed`, `orchestration-2` | `vitest.config.ts`, `eslint.config.js`, `scripts/eslint/`, `apps/web/test/` | [PRD](test-health-prd.md), [plan](test-health-plan.md) (B-274 to B-277, B-279 to B-283): 15 slices in 7 waves (slices 1, 2, 6 and 7 moved to `check-speed`), landing wave by wave. Waves 1 to 4: browser-check bookkeeping, the component harness (clock, one timeout, `getByCss`, lint rules as warnings) and the unit, server and Playwright cuts. Then it pauses; waves 5 to 7 are the component cuts, the area-by-area harness migration and the rules becoming errors · Depends on: `check-speed` in `dev` before slice 11 (worker databases; last item B-278), and better before any of it (quick hand-off checks); otherwise (none) for waves 1 to 4; waves 5 to 7 (slices 14 to 19) after `list-filters`, `planner-2` and `ui-kit` (they edit the same screens' tests); `quick-fixes` between waves · Hot files: `vitest.config.ts`, `package.json`, `eslint.config.js`, `scripts/loops/` (`prd.sh`, `prompt.sh`, `lease.sh`, `checks`, `check-areas.mjs`, `check-areas.d/`, `test-db.sh`), `apps/web/test/` (`setup.ts`, `found.ts`), `packages/data/test/`, `scripts/browser-checks/` (the specs, `fixtures.mjs`), the frozen-list tests; from wave 5 the `*World.tsx` files and component tests in every area, one area per slice |
| `code-health` | — | `check-speed`, `orchestration-2` | `packages/data/src/db/schema/`, `packages/data/src/domain/`, `packages/data/src/services/`, `packages/data/package.json`, `package.json`, `apps/web/package.json`, `apps/web/app/`, `packages/api/src/`, `scripts/loops/lib.sh`, `scripts/loops/lease.sh`, `scripts/loops/land.test.mjs`, `scripts/loops/check-areas.d/`, `scripts/backlog/backlog.mjs`, `scripts/build/` | [PRD](code-health-prd.md), [plan](code-health-plan.md) (B-361, B-365, B-366, B-367): 6 slices, waves (1, 2, 3, 5) → 4 → 6: exact pins and a test refusing ranges, unused exports removed, the backlog lock held once and a knobs page, tests on pr/ready/review/land, pure logic moved to @caretook/data/domain, then every importer switched (slice 6, alone, after simple-mode lands; it touches import lines across apps/web/app and packages/api). No behaviour change, no migration. Follow-ons: code-health-2, code-health-3 |
| `code-health-2` | hold | `code-health`, `simple-mode`, `sync-safety` | `packages/data/src/models/`, `packages/data/src/services/`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `apps/web/app/lib/core/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-362, B-363), cut from code-health by its planner, 2026-11-21: the role table as what simple-mode leaves (canComplete, role checks in the API's invites and join requests, a test refusing role names outside the role module, isUserRoleName and isGroupRoleName removed), the soft-delete model factory, one upsert helper on sync-safety's create-if-absent shape, one invalid, the device side's refuse, invalid, canWrite, formString and shouldRevalidate |
| `code-health-3` | hold | `code-health-2` | `apps/web/app/lib/`, `apps/web/app/libLayout.test.ts`, `packages/data/src/models/base/`, `packages/api/src/sync` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-364, B-368, B-369), cut from code-health by its planner, 2026-11-21: device row types derived from the device schema and the layout guard refusing SQL outside *.sync.ts (17 files today), the list count only on request and the sync PATCH's round trips (that slice after sync-safety-2), plan-pointing comments (a count that may only fall, then a sweep) |
| `simple-mode` | done | — | `apps/web/app/lib/assistant/simpleMode`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `powersync/sync-config.yaml` | [PRD](simple-mode-prd.md), [plan](simple-mode-plan.md): 5 slices, waves 1 → 2 → 3 → (4, 5): the lock becomes two member roles, Easy helper (log-only, own entries, own todos) and Easy viewer; "simple" is renamed "easy" everywhere, database included; the role decides the view; the Planner, todo pages and search open for the easy roles (B-221, B-236); the Easy mode toggle moves from the View options menu into the full timeline's page header (slice 5, stackless, B-400). Migrations in slices 1, 2 and 3; sync config changes. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248) and the current `quick-fixes` wave in `dev` (slice 1 renames files they touch) · Hot files: slice 1: every `simple*` file (`lib/assistant/simpleMode*`, `SimpleTimeline` and its blocks, quick entry, `TodoTick`, the `/app` layout), `sync-config.yaml`, the device schema; slice 2: `constants/roles.ts`, `permissions/` (blocks, types, timeline, todos, live-notes, connectors), `todoService`, the upload switch, `groupContext.ts`, the role picker; slice 3: group settings Members, `careGroupMemberService`, `useSimpleFrame`; slice 4: the Planner and todo routes, the search route; slice 5: `TimelineHeader.tsx`, `TimelineViewMenu.tsx`, the toggle button |
| `planner-3` | hold | `simple-mode` | `packages/data/src/db/schema/timeline/`, `packages/data/src/db/schema/assistant/`, `packages/data/src/permissions/timeline.ts`, `packages/data/src/services/entryLinkService.ts`, `packages/api/src/sync`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/timeline/entryLinks.sync.ts`, `apps/web/app/lib/todos/urls.ts`, `apps/web/app/components/todos/`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/new/`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `apps/web/app/lib/appointments/`, `packages/api/src/connectors/tools/writes.ts`, `scripts/browser-checks/sync-matrix.mjs` | **On hold 2026-11-21: the landed plan must be revised first to link any timeline entry to todos, many to many (the user’s correction is on B-245; B-477).** to write (B-245: a note can carry a todo with its own due day and assignee, the replacement for reminders; B-254: quick entry reads a repeating todo) · Depends on: `planner-2` in `dev` (last item B-248) · Hot files: the note editor and entry page, `todoService` and the todo schema (a link to its note), the Planner's todo rows, the Today card, the connector's `add_note` and `add_todo`; quick entry (B-254) |
| `quick-entry-2` | — | — | `packages/data/src/db/schema/assistant/quickEntry`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/timeline/timelineQuickEntry` | to write (B-300 to B-303), from the 2026-11-21 code review: negated doses, typed counts, wrong times, the stuck card · Depends on: `planner-2` in `dev` (it edits quick entry's future note; last item B-248) · Hot files: `db/schema/assistant/quickEntry.ts`, `quickEntryTime.ts`, `components/quick-entry/` |
| `calendars-2` | — | — | `packages/data/src/google/`, `packages/data/src/services/calendar`, `packages/data/src/db/schema/calendars/`, `packages/data/src/db/schema/notifications/`, `packages/data/src/db/schema/appointments/repeatRule`, `packages/data/src/db/schema/appointments/seriesVisits`, `packages/notifications/`, `apps/web/app/lib/appointments/repeatChoice`, `apps/web/app/lib/calendars/`, `apps/web/app/components/repeat/`, `apps/web/app/routes/app/groups/settings/calendar/` | [PRD](calendars-2-prd.md), [plan](calendars-2-plan.md) (B-304 to B-309): 7 slices, waves (1, 3, 5, 6) → (2, 4) → 7: Google deletes leave started items and todos alone; Google sync looks a year ahead with a daily catch-up; reminders expire at the event's start; deleted providers leave pushes; a stale consent goes generic and asks again; times name their zone; monthly on the last day. Two additive migrations (waves 1 and 3), no deps, no stack. Push notifications (B-377) are calendars-3 |
| `calendars-3` | — | `calendars-2` | `packages/notifications/`, `apps/web/app/lib/app-shell/serviceWorker`, `scripts/build/service-worker`, `apps/web/app/routes/app/groups/settings/calendar/` | to write (B-377): push notifications for event reminders; cut from calendars-2 to keep it small. Its planner asks about a web-push dependency and the push vendors. Builds on calendars-2 slice 3 (the outbox expiry) |
| `connectors-3` | — | `planner-3` | `packages/api/src/connectors/tools/`, `packages/data/src/db/schema/medications/doseSchedule`, `packages/data/src/db/schema/medications/index.ts`, `packages/api/src/connectors/readTools.int.test.ts`, `packages/api/src/connectors/mcpWrites.int.test.ts` | to write (B-252: a connector tool to read the dosing schedule beyond today; B-253: `add_todo` can make a repeating todo) · Depends on: B-253 after `planner-2` in `dev` (last item B-248); B-252 has none · Hot files: `packages/api/src/connectors/tools/` (`todaysDoses.ts` or a new schedule tool, `writes.ts`), the server instructions |
| `connectors-4` | hold | `hosting`, `marketing` | — | Directory listings (B-196): after the launch (B-33), the privacy policy (B-54) and the staging check with Claude and ChatGPT; needs a logo, short and long descriptions, a test account, the privacy URL |
| `onboarding` | hold | — | — | to write (B-31) · Depends on: `invites` (done) · Hot files: seeds, `careGroupService`, `/app` home |
| `i18n` | alone, hold | `simple-mode` | `apps/web/app/components/`, `apps/web/app/lib/core/format.ts`, `packages/data/`, `apps/web/app/root.tsx`, `packages/notifications/`, `pnpm-workspace.yaml`, `scripts/build/budget.json` | [PRD](i18n-prd.md), [plan](i18n-plan.md): 11 slices, waves 1 → 2 → (3, 4, 5, 6) → (7, 8, 9, 10) → 11: a per-user language (English and Spanish, AI-drafted, review before launch) in `user.preferences` with a cookie for server rendering; typed catalogs on `i18next` and `react-i18next`; format helpers, error codes and label maps take the language; the app swept area by area; emails, the invite's language, calendar text and the public site at `/es/`; a lint rule against literal text (`eslint-plugin-i18next`, dev). Quick entry is a plain box for non-English users; search matching, the connector and `/admin` stay English (B-209). Slice 8 adds a migration (one nullable invite column); three dependencies approved 2026-11-21; slice 1 needs a stack. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248), the current `quick-fixes` wave and `simple-mode` (last items B-221, B-400) in `dev`; **runs alone** (tooling-only work beside it) · Hot files: every user-facing string: all `/app`, sign-in and marketing routes, `components/`, `lib/core/format.ts` and the other format helpers, the label maps in `packages/data` schema, `userPreferences.ts`, `root.tsx`, the service worker, `packages/notifications` templates and registry, the invite schema and service, `calendarText.ts`, ESLint config, `pnpm-workspace.yaml`, `scripts/build/budget.json` |
| `data-rights` | hold | — | `packages/api/`, `apps/web/app/lib/sync/client.ts`, `packages/auth/` | to write (B-52, B-53, B-84) · Hot files: `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `account-security` | hold | — | `packages/auth/` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) · Depends on: `invites` (done); B-80 (the Devices page) first (soft) · Hot files: `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `marketing` | hold | — | — | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user |
| `hosting` | hold | — | — | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent |
| `encryption` | hold | — | — | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 · Depends on: (none); affects `assistant` and `documents` · Hot files: none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `documents` | hold | `encryption` | — | to write (B-56) · Depends on: hosting (B-33, file storage); `profiles` (soft); `encryption` decision · Hot files: file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS` |
| `contract-migrations` | hold | — | — | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** Contract steps tracked from fixes-nit (B-379): B-455, B-456, B-457. Migrations: run alone in its wave. To write. |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-31 | feature | triaged | onboarding |  | Demo group for every new user: a seeded, fictional care group to explore the app |
| B-33 | plan | triaged | hosting |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-52 | feature | triaged | data-rights |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-145 | question | triaged | encryption |  | Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for… |
| B-183 | chore | triaged | hosting |  | Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons) |
| B-196 | feature | triaged | connectors-4 |  | List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting |
| B-209 | feature | triaged | i18n |  | react-i18next or some other internationalization library to support multiple languages for all text… |
| B-239 | bug | triaged | fixes-tooling |  | pnpm prd review: --json mode prints progress lines (asked Codex…, waiting) on stdout, so its output isn't valid JSON |
| B-240 | bug | triaged | fixes-tooling |  | pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75 |
| B-241 | bug | triaged | fixes-tooling |  | codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean |
| B-242 | bug | triaged | fixes-tooling |  | with_backlog_lock: on Linux, BSD 'stat -f %m' succeeds with non-numeric output before GNU stat is tried, breaking the lock-age arithmetic |
| B-244 | chore | triaged | fixes-tooling |  | codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false |
| B-245 | plan | triaged | planner-3 |  | Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date |
| B-252 | feature | triaged | connectors-3 |  | Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming |
| B-253 | feature | triaged | connectors-3 |  | Connector: add_todo can make a repeating todo (daily, weekly on days, monthly) |
| B-254 | feature | triaged | planner-3 |  | Quick entry: 'bins out every monday' makes a repeating todo |
| B-256 | bug | triaged | fixes-ui |  | call and directions icons on planner schedule should be below the time, not beside the… |
| B-268 | chore | landed | ui-kit-2 | prd/ui-kit-2 | Move SeriesScopeDialog's raw <dialog> into a ui/ choice dialog on useShowModal |
| B-269 | chore | triaged | ui-kit-3 |  | Guard the kit: a lint rule or layout test that keeps react-aria imports in ui/ and flags raw btn, card, badge and alert classes outside ui/ |
| B-274 | chore | in-progress | test-health | prd/test-health | Component tests: one test clock on a fixed base date, reset per test, with harness deadlines on performance.now(); one shared fixClock |
| B-275 | chore | in-progress | test-health | prd/test-health | Component tests: one waitUntil in test/found.ts with one central timeout; no per-call milliseconds (lint rule) |
| B-276 | chore | in-progress | test-health | prd/test-health | Component tests: a retrying getByCss locator and world helpers that return locators, with lint rules against non-null reads in expect and userEvent calls and against fixed sleeps |
| B-281 | chore | ready | test-health | prd/test-health | Component tests: cut duplicates and brittle layout assertions; frame, harness and primitive tests use a probe route, not the timeline |
| B-282 | chore | landed | test-health | prd/test-health | Playwright specs: move one-device and no-browser steps out (marketing first), remove fixed sleeps, merge signout-wipe into session-end |
| B-283 | chore | landed | test-health | prd/test-health | Server tests: shared fixtures (createWorld, a sync and MCP test helper) and trim rules re-tested through sync upload and the connector; first move the member matrix and condition refusals down to the data layer |
| B-285 | bug | triaged | sync-safety |  | Server-refused sync changes vanish with only a console.warn: keep refused ops in a local table and show them with the server's reason |
| B-286 | bug | triaged | sync-safety |  | A repeatable 5xx from sync.upload blocks a device's upload queue forever: no retry cap, and the sync indicator never shows uploadError or the queue length |
| B-287 | bug | triaged | sync-safety |  | Offline medication and provider edits re-send unchanged JSON columns (schedule, phones), reverting a co-member's newer change |
| B-288 | bug | triaged | sync-safety |  | A replayed PUT on an existing row is a full update with the insert-time values, reverting newer edits (and for medications writing no change entry) |
| B-289 | bug | triaged | sync-safety |  | Client-chosen ids are global: a member of one group can squat ids in another (note_document by a victim's provider id; series visit ids), wedging a device's queue or making top-up skip days |
| B-290 | bug | triaged | sync-safety |  | Sign-out and a lapsed session wipe the device without checking the upload queue: unsent changes are destroyed with no warning |
| B-291 | bug | triaged | sync-safety |  | sync.upload looks tables up on a plain object: table 'constructor' is acknowledged as applied having done nothing, '__proto__' throws a 500 |
| B-292 | chore | triaged | sync-safety |  | A test that the device schema, sync-config.yaml and the upload column maps in sync.ts agree, minus an explicit ignore list |
| B-293 | change | triaged | sync-safety |  | One generic soft-delete table handler in sync.ts in place of nine copied ones (they have already drifted) |
| B-294 | bug | triaged | sync-safety-2 |  | Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused |
| B-295 | bug | triaged | sync-safety-2 |  | System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable |
| B-296 | bug | triaged | sync-safety-2 |  | A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database |
| B-297 | bug | in-progress | dose-accuracy | prd/dose-accuracy | A surplus dose marks the next day's slot as given: two caregivers both tapping Given for one pass makes tomorrow's dose read done |
| B-298 | change | triaged | dose-accuracy |  | Deterministic dose ids per medication, day and slot, so two devices logging the same pass converge on one row |
| B-299 | bug | triaged | dose-accuracy |  | Visit prep's 'Missed doses' reads history through today's schedule: a schedule change shows phantom misses back to the last visit |
| B-300 | bug | triaged | quick-entry-2 |  | Quick entry logs negated doses as given: 'did not give metoprolol', 'metoprolol not given', 'couldn't give…' all record a given dose at 0.9 confidence |
| B-301 | bug | triaged | quick-entry-2 |  | Quick entry discards a typed count and records the usual dose: 'gave 3 tylenol' records '2 tabs' with '3' in the note; 'gave half a tylenol' too |
| B-302 | bug | triaged | quick-entry-2 |  | Quick entry gives silently wrong times: 'sat up in chair' is last Saturday, '2nd tylenol' is Nov 2, '11/25 at 2pm' is tomorrow, 'dr alvarez at 2' is 2 AM, 'pain 8 a bit better' is 8:00 AM |
| B-303 | bug | triaged | quick-entry-2 |  | Quick entry gets stuck: remove a card, delete the text, retype the same line: no card, no Save, Enter does nothing |
| B-304 | bug | triaged | calendars-2 |  | Deleting an old event in Google Calendar rewrites past Caretook records: soft-deletes a past reminder note, cancels a past appointment, marks a todo done for the group |
| B-305 | bug | triaged | calendars-2 |  | Events made in Google more than 90 days out never arrive: ignored as outsideWindow, the sync token advances, nothing revisits them |
| B-306 | bug | triaged | calendars-2 |  | A reminder email can arrive after its appointment: about 2 h of retry backoff, no expiry, text rendered at queue time |
| B-307 | bug | triaged | calendars-2 |  | Google Calendar pushes still name soft-deleted providers (reminders filter them) |
| B-308 | bug | triaged | calendars-2 |  | The details-consent version is stored but never compared, so bumping DETAILS_CONSENT_VERSION re-asks nobody |
| B-309 | change | triaged | calendars-2 |  | Reminder emails show times in the recipient's zone with no zone label, 24-hour en-GB format; and 'monthly on the 29th–31st' silently skips short months (no 'last day' option) |
| B-311 | bug | triaged | fixes-perf |  | The series top-up reads every live series every minute and rewrites topped_up_through daily even on ended series (re-syncing them to every device) |
| B-313 | bug | triaged | fixes-perf |  | Timeline and Planner load and watch every note document in the group (snapshot, text, pending updates) to preview 30 rows, rerunning on each co-member keystroke |
| B-316 | change | triaged | fixes-ui |  | No unsaved-changes guard on any sheet or form: a click outside, Escape or Back discards a half-filled medication, emergency or provider form |
| B-318 | bug | landed | fixes-bug | prd/fixes-bug | The app header ignores a simple-mode setting changed on another device until the next navigation |
| B-319 | bug | triaged | fixes-ui |  | Empty states flash before the first watch answer: a provider's linked entries ('No notes or events yet') and linked todos ('Former member') |
| B-325 | change | triaged | fixes-ui |  | Native readiness: no top safe-area inset on the header or sticky day headers (viewport-fit=cover), and /app is a blank page on cold start for up to about 4 s (HydrateFallback returns null) |
| B-327 | bug | triaged | account-security |  | A removed or demoted manager's pending invites still work: a removed owner can accept their own owner invite within 7 days and be an owner again |
| B-328 | bug | triaged | account-security |  | The emailed sign-in code has no per-address limit (per IP only): a distributed attacker gets unlimited guesses at any account's 6-digit code |
| B-329 | bug | triaged | account-security |  | Ending sessions never ends a connected assistant: password reset, 'sign out everywhere' and staff 'sign out all' leave the grant and its 30-day rolling refresh token alive |
| B-330 | bug | triaged | account-security |  | Session tokens are stored in plain text and the bearer plugin accepts them unsigned; ops/data-copies.md says they are hashed |
| B-331 | bug | triaged | account-security |  | Staff admin can invite any address as owner of any group: not limited to ownerless groups, existing owners aren't told |
| B-332 | bug | triaged | account-security |  | Staff page-view audit rows are fired without waiting and can be lost on Vercel; user search isn't audited |
| B-333 | bug | triaged | account-security |  | Link sign-up leaks whether an address has an account (timing), has no rate limit, and one link creates unlimited unverified accounts |
| B-334 | bug | triaged | account-security |  | A declined or withdrawn join requester can ask again forever, emailing every owner and admin each time; no signed-in oRPC procedure is rate limited (sync.upload, invite.resend) |
| B-335 | bug | triaged | account-security |  | Better Auth's /update-user is live and unvalidated: a name or image of any length syncs to co-members and into owner emails |
| B-336 | bug | triaged | account-security |  | A role change reads its target unlocked: an admin's demote racing an owner's promotion of the same member can skip the owner-only and last-owner checks |
| B-337 | bug | triaged | account-security |  | /mcp verifies a token (several database reads) before any rate limit, and rate-limit keys fall back to one shared 'unknown' bucket when the IP header is missing |
| B-338 | feature | triaged | account-security |  | Account settings: change name, email and password (today the page is read-only; password only via reset) |
| B-339 | question | triaged | account-security |  | Decide the session cookie cache before launch: ordinary /rpc calls keep working for up to 3 minutes after a session is revoked |
| B-340 | change | triaged | account-security |  | A member in two groups can connect a given assistant to only one (one grant per user and client) |
| B-341 | chore | triaged | hosting |  | CI: a workflow on PRs into dev that runs format, lint, typecheck, unit and integration tests (today no workflow runs any test) |
| B-342 | bug | triaged | hosting |  | The Postgres pool has no error listener: a dropped idle connection crashes the function; 10 clients with a 2 s wait time out under a burst of uploads |
| B-343 | bug | triaged | hosting |  | The break-glass database grant (pnpm db:access grant) very likely fails on Neon: it sends a SCRAM verifier, which the runbook records Neon rejecting |
| B-344 | bug | triaged | hosting |  | The migrator can silently skip a migration whose journal timestamp is older than the last applied one; nothing guards it |
| B-345 | bug | triaged | hosting |  | No lock_timeout, statement_timeout or idle_in_transaction_session_timeout anywhere: a migration queued behind a PowerSync snapshot blocks every query on that table |
| B-346 | bug | triaged | hosting |  | Staging's self-check and mail allowlist fail open when APP_ENV is missing or mistyped in Vercel |
| B-347 | change | triaged | hosting |  | Deploy order: migrate, roles and sync config run before vercel build, so a build failure leaves the database ahead of the code; a smoke failure has no rollback |
| B-348 | chore | triaged | hosting |  | Purge what is never purged: expired session rows (IP, user agent), expired OAuth access and refresh tokens, failed outbox rows, unused oauth_client rows |
| B-349 | bug | triaged | hosting |  | packages/data/scripts/run.ts prints the raw failure cause to public Action logs (query params: staff emails, reasons, seed password hashes) |
| B-350 | chore | triaged | hosting |  | Bind local Postgres and PowerSync to 127.0.0.1 (they listen on all interfaces with repo-known credentials) |
| B-351 | feature | triaged | hosting |  | Monitoring and alerting with no health data: cron failures (the calendar cron returns 200 when a step fails), replication-slot lag, 5xx rate, failed mail, uptime |
| B-352 | chore | triaged | hosting |  | Write and run a restore drill before production (Neon point-in-time restore, then the PowerSync slot and re-snapshot, then devices holding newer rows), and confirm the vendor 'to confirm' cells in ops/data-copies.md |
| B-353 | chore | triaged | hosting |  | Write the breach and incident procedure (FTC Health Breach Notification Rule): ops/break-glass.md and the privacy draft both refer to one that doesn't exist |
| B-354 | question | triaged | hosting |  | The whole user table (emails, roles, disabled reasons) is granted to replication and lands in PowerSync Cloud storage: move the public profile to its own table? |
| B-355 | chore | triaged | hosting |  | Hand checks before launch nothing tracks: the Google smoke test against real Google, Google OAuth app verification, the connector's vendor steps (Claude, ChatGPT) |
| B-356 | feature | triaged | data-rights |  | A staff procedure and tooling for deletion and export requests before self-service ships (the privacy draft promises deletion within 45 days; nothing can delete an account or group) |
| B-357 | question | triaged | data-rights |  | Consent evidence is deleted with the user or group (care_group_consent, connector_grant cascade), and the audit log loses target_user_id: keep them? |
| B-358 | question | triaged | data-rights |  | Should the legal drafts promise only what is built (deletion, 'permanently removed' entries, backups, at-rest encryption), and who fills the placeholders ([Company legal name], [privacy email], [backup retention period])? |
| B-359 | feature | triaged | onboarding |  | Record terms, privacy and 18+ acceptance at sign-up and invite accept (no /terms or /privacy link outside the marketing pages; the terms require 18+) |
| B-360 | change | triaged | onboarding |  | The app isn't installable: site.webmanifest has display 'browser', start_url '/', and is linked only from the marketing layout |
| B-361 | change | triaged | code-health |  | A @caretook/data/domain export for the pure logic now living under db/schema (quick entry parser, due doses, medication display, series edits: about half that folder) |
| B-362 | change | triaged | code-health-2 |  | A soft-delete model factory and a shared upsert helper: nine models are the same file, twelve upserts repeat the exists-as-system, visible-as-actor sequence, 'invalid' is defined 18 times |
| B-363 | change | triaged | code-health-2 |  | One exported role-capability table (canWrite(role), canComplete(role)) used by services, device modules and screens, before any role is added |
| B-364 | change | triaged | code-health-3 |  | Device reads are 164 raw SQL strings with hand-typed row types, 17 files outside *.sync.ts: derive row types from the device schema and make libLayout.test.ts refuse SQL elsewhere |
| B-365 | chore | triaged | code-health |  | Remove unused scaffolding and dead exports: serviceName (45 exports, 0 reads), the services registry, getService, isServiceName, initClient, isUserRoleName, isGroupRoleName, primaryContactName, hasContact, CALENDAR_CARDS, COMING_SOON |
| B-366 | chore | triaged | code-health |  | Pin dependencies exactly: 47 caret ranges remain (react-router, drizzle-orm, zod, vite among them) against AGENTS.md's rule |
| B-367 | chore | triaged | code-health |  | Agent tooling: tests for the merge path (land.sh, pr.sh, ready.sh, review.sh: 465 lines, none), and with_backlog_lock removes a stale lock without re-checking, so two waiters can both take it |
| B-368 | chore | triaged | code-health-3 |  | Comments that point at plans instead of behaviour: 198 'slice N' references in 154 source files and 262 PRD-name parentheticals |
| B-369 | change | triaged | code-health-3 |  | baseModel.list always runs a second COUNT query, and a sync PATCH costs about seven round trips (a 100-op batch about a thousand, serially) |
| B-370 | chore | triaged | test-health |  | Quick check always runs the guards that read source by path (scripts/loops/sync-matrix.test.mjs, rolesSql.test.ts): vitest --changed can't select them |
| B-371 | chore | triaged | test-health |  | Device-to-server round trip per table through the app's own writers, comparing column values on the second device (today: hand-written INSERTs, id only, browser suite only) |
| B-372 | chore | triaged | test-health |  | A second time zone in tests: device, recipient and seed are all America/Los_Angeles in 106 of 113 component test files, while 29 production call sites read the device's zone |
| B-373 | chore | triaged | test-health |  | Role coverage gaps: a removed member writing or reading a care table, staff support on care tables, non-member writes through sync upload on 10 of 15 tables, and a real every-procedure unauthenticated sweep |
| B-374 | chore | triaged | test-health |  | A test for the device's uploadData: a 400 or 500 from sync.upload must not wedge the queue |
| B-375 | chore | triaged | test-health |  | Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports) |
| B-377 | feature | triaged | calendars-3 |  | Push notifications for appointment reminders (B-61 shipped email only) |
| B-378 | chore | triaged | i18n |  | File the translations PRD's promised follow-ups: Spanish quick entry, language-aware search, a human review of the Spanish; and note 48 hard-coded 'en-US' formatters and English messages in schemas and the errors catalogue |
| B-381 | bug | triaged | fixes-tooling |  | readTools.int.test.ts 'nothing private leaves' flakes when a random user UUID contains the birth year (e.g. …072194195bed matches '1941'): assert on fields, not a substring of the whole output |
| B-382 | bug | landed | fixes-bug | prd/fixes-bug | Repeating todos: an offline Undo's delete of the next occurrence lands unconditionally (todoOp removeTodo), deleting a successor another member edited or completed even though todoService.reopen kept it; tell an Undo's delete from an explicit one and apply it only when the server finds the successor untouched (todos.sync.ts:499) |
| B-383 | bug | triaged | sync-safety-2 |  | Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating |
| B-384 | bug | triaged | sync-safety-2 |  | Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete) |
| B-387 | bug | triaged | sync-safety-2 |  | Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin |
| B-388 | bug | triaged | fixes-tooling |  | Integration flakes seen in 2026-11-21 full checks: the connector MCP tests (mcpWrites, mcp, readTools .int.test.ts) failed 14 times with 'Connection terminated' in the transcripts, and todoRename.int.test.ts 4 times; find the cause (dropped connections on the shared test Postgres under load?) and fix it |
| B-394 | bug | triaged | fixes-tooling |  | mcp.int.test.ts 'list_timeline: the group's entries in the recipient's zone, with note text, paged at 50' times out at Vitest's 5 s default under load (full check, 5-min load ~21); passes alone 3x |
| B-398 | change | triaged | ui-kit-3 |  | Sweep every remaining area onto the UI kit primitives, one area per slice: medications; providers, profile forms and care periods; the Planner, to-dos and search; the timeline, entries and quick entry; admin, account, connectors, marketing and the app frame |
| B-404 | feature | triaged | staging-ship |  | One command to ship dev to staging: push dev, open the dev into staging PR, wait for Codex's review, triage its findings into the backlog (verified against the code, duplicates noted on the existing item), merge the PR when nothing is a blocker, and notify the user only when something is |
| B-405 | bug | triaged | test-health |  | Worker database names cut the base to 59 characters, so two worktrees of a long topic (~46+ chars) share their _w<n> copies: concurrent checks DROP each other's databases and rm drops both; keep a short hash of the full base when shortening, and match it in isOwnDatabase and test-db.sh |
| B-406 | feature | triaged | inbox-agent |  | Set priority in the inbox, not the backlog: the user orders a short 'Next up' list in plans/inbox.md (plain lines, no ids or fields) and the dispatcher reads it as the order to plan and run, keeping the PRD table's row order in step; the user opens the backlog only when an agent asks |
| B-407 | feature | triaged | self-recovery |  | Recover by itself and land safely: a launchd job runs pnpm prd recover --wait at login and when work is recorded as running but no session is alive; the dispatcher slows down before a usage limit (starts no slice or planner, drains); a landing or migration cut off halfway leaves a step-in-progress marker so the resumed session finishes or undoes it |
| B-408 | feature | triaged | worker-watch |  | Stuck workers handled by the orchestrator: it tracks how long its commands and slice agents have run against their usual time, stops and restarts a stuck one on its own judgement (once), and for a judgement call asks a fresh skeptic agent first and the user through the asks queue only if that doesn't settle it |
| B-411 | bug | triaged | fixes-tooling |  | A session opened again under the same name while the first still runs gets marked ended when the first exits: session.sh writes ended and exit without checking the record is still its own |
| B-412 | bug | triaged | fixes-ui |  | plus button on timeline day header should be on far right so all actions are on right. Care period… |
| B-413 | bug | triaged | fixes-ui |  | don't collapse past providers on list providers page, it breaks search and isn't needed. This list… |
| B-414 | feature | landed | ui-kit-2 | prd/ui-kit-2 | animations are cool. add some to actions, hovers, etc... be classy about it. For instance the… |
| B-415 | feature | landed | ui-kit-2 | prd/ui-kit-2 | choose a more modern font set. |
| B-416 | bug | triaged | fixes-ui |  | owner pill on planner/planner list should be below time/date field. Too busy under title. |
| B-417 | feature | triaged | marketing |  | We are getting close to feature complete. We need another marketing content pass that updates copy… |
| B-418 | bug | triaged | test-health |  | Flaky tooling test under load: recover.test.mjs '--at a time that has passed waits until tomorrow' fails in the full pnpm test:tooling run and passes alone |
| B-419 | bug | landed | ui-kit-2 | prd/ui-kit-2 | on providers page, import from another group is too wordy. Import icon is fine. It is for power… |
| B-420 | bug | landed | ui-kit-2 | prd/ui-kit-2 | planner add button can just be a plus icon. Maybe wait on button component. every main page header… |
| B-421 | bug | triaged | fixes-ui |  | type pill on medication list items should float right. |
| B-422 | feature | triaged | fixes-ui |  | In providers list page, contact links in rows make it too hard to know what to click. Make those… |
| B-423 | feature | landed | ui-kit-2 | prd/ui-kit-2 | Standardize on single Button design component. Can have options like primary, secondary, danger,… |
| B-424 | feature | landed | ui-kit-2 | prd/ui-kit-2 | medications page should have passes as a tab, not in header. + button should be a dropdown with add… |
| B-425 | feature | triaged | inbox-agent |  | An inbox agent: a session that helps the user add, categorize and prioritize inbox items, and writes them by pushing straight to origin/dev instead of committing in the local dev checkout, so it never steps on the user's working copy |
| B-429 | change | triaged | asks-relay |  | Asks queue hygiene: reports that go stale are re-checked or expire, answered asks are archived, and an ask whose session has died still reaches the user |
| B-430 | feature | triaged | staging-ship |  | Codex findings on a PRD pull request become backlog items by tool: verified against the code, duplicates noted on the existing item, as B-404 does for the staging PR |
| B-431 | chore | triaged | fixes-tooling |  | A finished PRD gets its done flag without rm: set it at the last landing or in pnpm prd tidy (check-speed still reads planned with nothing waiting) |
| B-432 | chore | triaged | fixes-tooling |  | After a landing that changes the lockfile, pnpm prd land runs pnpm install in the main checkout (or files an ask) instead of only printing a reminder |
| B-433 | feature | triaged | self-recovery |  | A usage-limit signal and a cost record: sessions detect an approaching usage limit so the dispatcher can drain (B-407 assumes one), and tokens or cost are recorded per PRD and slice |
| B-434 | feature | triaged | worker-watch |  | Run metrics beyond check times: slice and landing durations, flake rate and how often Codex finds something, in one summary command |
| B-435 | feature | triaged | inbox-agent |  | Filing checks for duplicates (similar open or archived titles shown before an item is added) and finished items are archived without a hand run |
| B-436 | feature | triaged | staging-ship |  | A to-test report for a staging ship, like the landing reports of B-410 |
| B-437 | change | triaged | agent-autonomy-2 |  | Record backlog, hotfix and recovery sessions like orchestrator sessions, so pnpm prd status shows them and they can be reopened |
| B-438 | plan | triaged | self-recovery |  | Headless orchestrator sessions: runs that need no terminal tab, so a helper cannot outlive or die with its window |
| B-440 | bug | triaged | fixes-tooling |  | pnpm prd tidy --yes: a database for a topic ending -w1..-w16 reads as an orphan worker copy and is dropped |
| B-441 | bug | triaged | fixes-tooling |  | pnpm prd tidy: a missing or failing lsof reads as no process in any worktree, so --yes can remove an active one |
| B-442 | bug | triaged | fixes-tooling |  | pnpm prd tidy --yes deletes dead leases from its earlier snapshot without lease.sh's takeover mutex and fresh liveness check |
| B-443 | bug | triaged | fixes-tooling |  | land.sh to-test file lists no items after a local landing: items are already landed, not ready, once dev has the merge |
| B-444 | bug | triaged | fixes-tooling |  | docs_only counts a code file renamed to .md as docs only (git diff --name-only shows only the rename's destination) |
| B-445 | bug | triaged | fixes-tooling |  | Agents wait on checks with `until ! pgrep -f "prd check"`, which never exits: it matches its own shell and every orchestrator whose prompt mentions `pnpm prd check` |
| B-446 | bug | triaged | fixes-tooling |  | browser.test.mjs 'kills a spec at its cap, worker and all, and retries it once' fails under heavy load (load 47), passes alone 3x |
| B-447 | bug | triaged | fixes-tooling |  | to-test file: 'What wasn't checked' repeats the quick-check line, and a tooling-only landing still gets the app's dev URL and seed sign-ins under 'What to try' |
| B-448 | chore | triaged | ui-kit-3 |  | Rename the profile's *Card components and files (ProfileCards.tsx, ConditionsCard, DetailsCards, EmergencyCard, VitalAveragesCard) now that they render bands, not cards |
| B-450 | bug | triaged | fixes-tooling |  | Flaky under load: roles.int.test.ts beforeAll (applyRoles) times out at the 10s hookTimeout in a full check at load ~130; passes alone 3x |
| B-451 | bug | triaged | fixes-tooling |  | Tooling-only landings run no eslint: the check gate's 'none needed' (Markdown, scripts/loops, scripts/backlog, .githooks) lets a lint error into dev, and every synced branch's full check then fails |
| B-452 | bug | triaged | fixes-tooling |  | Dispatcher: a start or plan whose new.sh fails after making the worktree leaves it with no managed record, so later ticks treat it as opened by hand and it holds a slot for good |
| B-453 | bug | triaged | fixes-tooling |  | Dispatcher: a 'hold the topic' answer is consumed and the reopen count cleared even when the backlog write fails, so the same tick reopens the session |
| B-454 | bug | triaged | fixes-tooling |  | Dispatcher lock: two dispatchers starting together over a stale lock can both take it (the takeover unlinks the path from an earlier pid read) |
| B-455 | chore | triaged | contract-migrations |  | Drop the old per-member simple mode columns (simple_mode, simple_mode_locked) once Easy roles replace them |
| B-456 | chore | triaged | contract-migrations |  | Retire the leftover reminder data planner-2 left in place: the note kind on appointment_series and stored future notes and note series |
| B-457 | chore | triaged | contract-migrations |  | Give groups that predate the default medication passes (Morning 08:00 and Evening 20:00) their two passes |
| B-458 | chore | triaged | fixes-tooling |  | Backlog: let set and note change archived items (a fix to an archived item's topic, title, commit or note is refused, so the hygiene fixes for B-206, B-208, B-88, B-222 can't be made) |
| B-459 | chore | triaged | fixes-tooling |  | Backlog: 151 items read 'live' because the dev-into-staging-into-main release merge (cc3e1d8b, B-33) put their commits on origin/main, though production hasn't launched; give live a real meaning (a production marker such as a tag or a recorded deploy) or show main as staging until launch |
| B-460 | bug | triaged | fixes-tooling |  | Flaky under load: tidy-cli.test.mjs beforeAll/hook times out at 10s in pnpm test:tooling at load ~20 (4 tests); passes alone 3x |
| B-461 | bug | triaged | fixes-tooling |  | tidy-cli.test.mjs fails as a whole file under heavy load (load about 30) in pnpm test:tooling, passes alone 3x |
| B-462 | bug | triaged | fixes-tooling |  | pnpm prd recover reopens the dispatcher even when a test-Postgres, stack or server step failed, so it can reopen managed sessions on broken infrastructure |
| B-463 | bug | triaged | fixes-tooling |  | pnpm prd recover after a crash loses the dispatcher's restart intent when its reopen fails: clear-lock deletes the stale lock first, and no record is kept |
| B-464 | bug | triaged | fixes-tooling |  | The backlog prompt's hold line (pnpm backlog prd set <topic> flags=hold) replaces the row's flags, dropping standing or alone |
| B-465 | bug | triaged | fixes-tooling |  | pnpm prd down keeps stopping servers, stacks and the test Postgres when the dispatcher won't stop in time (mid new.sh), racing a start against the shutdown |
| B-466 | bug | triaged | fixes-tooling |  | resetStaging.int.test.ts 'wipes everything but real sign-ins, reseeds' times out at 30 s under load (passes alone in 3-10 s) |
| B-467 | feature | triaged | asks-relay |  | The backlog session is the go-between for every agent's questions: agents file to the asks queue and wait, the backlog session ranks them by how soon an answer blocks real work, asks the user itself and decides which ones ping the phone |
| B-468 | bug | triaged | fixes-tooling |  | open-session.sh fails when iTerm2 has windows but no current window: the dispatcher counts it as a planner death |
| B-469 | bug | landed | fixes-bug | prd/fixes-bug | Easy roles' read-only search sheets (provider, medication, condition) show the values captured when tapped and miss edits or deletes that sync in while open |
| B-470 | bug | landed | fixes-bug | prd/fixes-bug | An Easy helper can undo a writer's cancellation or reschedule of their own event by sending the setup fields as null (update API or sync upload) |
| B-471 | feature | triaged | ui-kit-3 |  | Overlay motion: menus, popovers, dialogs and toasts fade in and out, and a sheet closes with the reverse of its opening |
| B-472 | bug | landed | fixes-bug | prd/fixes-bug | A device's offline-queued simpleMode setting change, left from before the easy rename, is retried forever and takes later queued settings changes down with it |
| B-474 | change | triaged | inbox-agent |  | Inbox agent plan amendments from the user: it never leaves staged or uncommitted changes behind (stash, or commit and push), and someone is named as owning cleanup of completed items |
| B-475 | bug | triaged | fixes-tooling |  | Flaky component test: timelineSimpleTodos 'a viewer… done-only change' leaves an undo timer (useTodoTick → reopenTodo → liveTodo) that fires after the test's database closes: Unhandled Rejection 'Client has already been closed' fails the run |
| B-477 | change | triaged | fixes-tooling |  | PRD registry: a hold carries its reason |
| B-479 | bug | triaged | fixes-tooling |  | calendarCron.int.test.ts 'runs the reminders first, then Google push and pull, and the series top-up last by default' times out at 5 s under load (passes alone) |
| B-480 | bug | triaged | fixes-tooling |  | timelineQuickEntry.browser.test.tsx 'the user's units are used, and an explicit unit wins' misses 'Saved 1 entry' under load (passes alone) |
| B-481 | change | triaged | fixes-ui |  | Text entry boxes and the default page background are the same color, which is confusing: pick a different color for one or the other (no preference which) |
| B-482 | bug | landed | fixes-bug | prd/fixes-bug | Offline settings change queued under the old simpleMode key is retried forever after the easy-mode rename, and blocks later offline settings changes |
| B-484 | bug | triaged | fixes-tooling |  | Flaky under load: staff.browser.test.tsx 'offline, the cached banner shows; it goes at its end time without a reload' sets endsAt to now + 2 s, so a render over 2 s (load ~20) sees the banner already gone |
| B-485 | bug | triaged | fixes-tooling |  | Flaky under load: print.browser.test.tsx 'Next, Previous and This week move it by a week…' reads 2027-06-07 for 2027-05-31 (Matcher did not succeed in time) in a full check; passes alone |
| B-486 | bug | triaged | fixes-tooling |  | Flaky under load: planner.browser.test.tsx 'an item leaves the Planner tab once its end or its start passes' times out at 15 s (it steps 4 h of fake timers); fails alone 3/3 at load ~18, passes 3/3 at ~8 |
| B-488 | bug | triaged | fixes-tooling |  | Flaky under load: passes.browser.test.tsx 'adds a pass, last in the list; a taken name (any case) is refused on its field' fails in about 200-330 ms beside other component files (2 of 3 with four files), passes alone 6x |
| B-489 | bug | triaged | fixes-tooling |  | Flaky under load: Button.browser.test.tsx 'a submit Button submits its form once, however quickly it's tapped' fails in a full check; passes alone |
| B-490 | bug | triaged | fixes-tooling |  | Flaky under load: List.browser.test.tsx 'a row with to is one link covering the row; its trailing control is still clickable' fails in a full check; passes alone |
| B-491 | bug | triaged | fixes-tooling |  | Flaky under load: primitives.browser.test.tsx 'at 1280, dark > Tooltip: hover and keyboard focus show it…; Escape hides it' fails in a full check; passes alone |
| B-492 | bug | triaged | fixes-tooling |  | Flaky under load: search.sync.browser.test.tsx 'about 2,000 entries: the rebuild takes under 2 s, and a query under 50 ms' misses its timing in a full check; passes alone |
| B-493 | bug | triaged | fixes-tooling |  | Flaky under load: entryMentions.browser.test.tsx 'a viewer sees mentions as links to the provider's page… and gets no popup' fails in a full check; passes alone |
| B-494 | bug | triaged | fixes-tooling |  | Flaky under load: plannerSeries.browser.test.tsx 'renaming, this and later: later visits take the new title' (and once 'a viewer's page asks nothing and offers no Edit') fail in a full check; passes alone |
| B-495 | bug | triaged | fixes-tooling |  | Flaky under load: profile.browser.test.tsx Basics, Contact and Insurance sheet tests ('refused on its field… nothing sent') fail in full checks (4 of 7 runs); passes alone |
| B-496 | bug | triaged | fixes-tooling |  | Flaky under load: provider.browser.test.tsx 'Edit opens the directory's sheet, filled in; Cancel goes back to the page' fails in a full check; passes alone |
| B-497 | bug | triaged | fixes-tooling |  | Flaky under load: frame.browser.test.tsx 'a tap on Settings opens /app/settings, which keeps the header and has no group menu' fails in a full check; passes alone |
| B-498 | bug | triaged | fixes-tooling |  | Flaky under load: syncAppointmentSeries.int.test.ts 'takes a series and its visits, documents and links from one batch, and again on a replay' times out in a full check; passes alone |
| B-499 | bug | triaged | fixes-tooling |  | Flaky under load: syncPasses.int.test.ts 'refuses a viewer, a moved group, and another group's pass' times out at 5 s in a full check; passes alone |
| B-500 | bug | triaged | fixes-tooling |  | Flaky under load: appointmentSeries.int.test.ts 'writes visits through today + 90 for a series without them' fails in full checks (2 of 7 runs); passes alone |
| B-501 | bug | triaged | fixes-tooling |  | Flaky under load: recipientCondition.int.test.ts 'refuses viewers, outsiders and staff, and another group's recipient' fails in a full check; passes alone |
| B-502 | bug | triaged | fixes-tooling |  | Flaky under load: search.int.test.ts 'searches a group of 10,000 entries in under 200 ms' reads 210 ms in a full check; passes alone |
| B-503 | feature | triaged | agent-autonomy |  | Default on silence: a question filed with a recommended option takes it by itself after a set wait (about 30 min) unless the user answers; the ask records it was defaulted; never for money, data loss, a live deploy or a destructive step |
| B-504 | feature | triaged | agent-autonomy |  | Quiet-machine landing check: a landing's full check can claim the machine; the dispatcher and other orchestrators hold new slice starts and checks until it ends or a time limit passes; waiting landings take turns |
| B-505 | feature | triaged | agent-autonomy |  | Flake rule replaces asking: when every failing test in a full check passes alone 3/3, rerun only the failed files on a quiet machine; if they pass, land and file each flaky test as a fixes-tooling item, with no question to the user |
| B-506 | feature | triaged | agent-autonomy |  | Shared notice board: a short list in .loops/ every orchestrator reads at each step and writes heads-ups to (landing now, hold full checks until a time; touching a hot file, sync first); entries expire |
| B-507 | feature | triaged | agent-autonomy-2 |  | Context hook: a Claude Code hook on orchestrator and loop sessions reads the transcript's latest context size after each tool call and, over 160k, tells the agent to finish its step, commit Status and pnpm prd rotate |
| B-508 | feature | triaged | agent-autonomy-2 |  | pnpm prd status shows each live session's context size; the dispatcher nudges a session still over the limit after its reminder, then files an ask |
| B-509 | change | triaged | agent-autonomy-2 |  | Orchestrator rule: over 160k context, rotate at the next safe point, mid-wave included, without asking; continue only for a step that can't resume from Status (a landing under way), saying why in Status |
| B-510 | bug | ready | fixes-bug | prd/fixes-bug | Repeating todos: removeUndoneNext returns 'applied' for a viewer's flagged Undo delete before checking the role (the !before?.repeatRule early return precedes canCompleteTodo); nothing changes, but the result misreports |
| B-511 | feature | triaged | agent-autonomy-3 |  | Skeptic before every ask: a session sends its question, options and evidence to a fresh Fable skeptic first; it decides (reversible, within the rules) or confirms the question is the user's; pnpm prd ask records the verdict |
| B-512 | feature | triaged | agent-autonomy-3 |  | Skeptic before risky landings: a Fable skeptic reviews the evidence before land --force, landing on flaky tests (B-505) or declining a Codex finding, and the landing report says what it said |
| B-513 | change | triaged | agent-autonomy-3 |  | Opus planners and backlog sessions with a Fable final check: the skeptic pass runs on Fable and may send a plan back; a registry flag (e.g. design) keeps a heavy design topic's planner on Fable |
| B-514 | feature | triaged | agent-autonomy-2 |  | Hand off from the phone: in a backlog or inbox session, 'hand off' runs pnpm prd rotate --self: a fresh session of the same kind and name opens (Remote Control, so it shows on the phone) and the old one ends; two modes the user picks: with a short brief of the current session passed to the new one, or with nothing handed over |
| B-515 | feature | triaged | agent-autonomy-2 |  | Always-on backlog and inbox sessions: the dispatcher keeps one backlog and one inbox session running and reopens a dead one; they don't count against the three PRD slots, and the context watch (B-507) rotates them too |
| B-516 | feature | triaged | agent-autonomy |  | Landing notices before and after: a landing posts a notice when its full check starts (topic, about when, the areas and hot files it touches) and after it merges (the sha, what it touched); an orchestrator that sees a landing coming holds its own full check, syncs after it, and checks once |
| B-517 | feature | triaged | agent-autonomy |  | A check carries over a dev sync: a passed check stays valid after a merge of dev when every incoming commit landed through a full check, the merge was conflict-free, the sides share no file, and dev brought no migration, seeds, sync-config.yaml, lockfile, package.json or vitest config; the merged tip runs only typecheck, lint and the tests related to both sides' changes (check-plan.mjs); else today's quick |
| B-518 | change | triaged | agent-autonomy |  | Land without re-syncing when dev's changes don't touch the branch: land.sh's drift refusal relaxes when dev's new commits share no file with the branch and bring none of the risky files; land still merges dev and typechecks the result, and the landing report says it landed on an unsynced tip |

## Items

### B-31 · feature · Demo group for every new user: a seeded, fictional care group to explore the app

- status: triaged
- prd: onboarding
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): From the invites interview (2026-11-18): out of scope there, noted for later. Each new account gets a private demo group with fictional seed data (timeline, notes, vitals; later meds and providers) it can explore and delete.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'onboarding' (to write): a private fictional demo group for each new account, made from the seeds' data on sign-up (or on demand from /app home), deletable. Builds on invites (done).

### B-33 · plan · Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Not planned yet; the user will say when. Covers the open questions in AGENTS.md: hosted database (same region as Vercel functions, pooling), how production migrations run, PowerSync Cloud (replication role with column-limited grants, sslmode verify-full, how it reaches the JWKS), rate-limit storage, env and secrets, a real staging environment, and confirming the first Vercel deploy runs pnpm 12. Invites (B-30) and marketing (B-32) need it to go live.
- 2026-11-18 (prd/invites orchestrator): Email sending setup for launch (tracking off, SPF/DKIM/DMARC, bounce webhooks, the outbox cron, rate-limit storage) is filed as B-68.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-4 and S-6 (launch): separate database roles (app, migrations, column-limited replication), named and audited human access, a break-glass procedure; and a register of every data copy (Postgres, backups, PowerSync storage, Resend, logs) with region, encryption at rest, retention, access and breach terms.
- 2026-11-19 (Robert Bo Davis): Triaged to a new hosting PRD: the user picked deployment (Vercel and the other providers) as the next PRD to write, 2026-11-19.
- 2026-11-19 (Robert Bo Davis): PRD and plan written (plans/hosting-prd.md, hosting-plan.md): staging and production, Vercel Pro cle1, Neon aws-us-east-2, PowerSync Cloud US, a GitHub Action deploy, generated least-privilege roles, ops/ runbook, data-copy register and break-glass. Done after slice 7 (going live).
- 2026-11-20 (slice/hosting/2): hosting slice 2: PowerSync 1.28.3 snapshots tables with SELECT * (modules/module-postgres/src/replication/SnapshotQuery.ts), so column-only grants fail its initial snapshot on the 8 partly synced tables (user, care_group, care_group_member, care_recipient, care_recipient_details, member_contact_share, note_update). Needs a decision before slice 7.
- 2026-11-20 (slice/hosting/2): Correction: that's 7 partly synced tables, not 8.
- 2026-11-20 (prd/hosting): Decided with the user: six partly-synced tables get their timestamp/audit columns in the streams; the replication role gets table-level SELECT on user only (PowerSync's snapshot runs SELECT *). Ask PowerSync Cloud at slice 7.
- 2026-11-20 (slice/hosting/5): slice 5 (d9aa875): deploy.yml + admin-grant/seed-staging/db-access Actions, pnpm deploy:smoke, CLIs pinned in .github/cli-versions.env (vercel@65.16.0, powersync@0.10.3), Vercel Git deploys off. Confirm at slice 7: PowerSync Cloud /probes/liveness, Vercel rootDirectory with vercel build from the repo root.
- 2026-11-20 (slice/hosting/6): Slice 6 (24a3f02): ops/runbook.md, ops/data-copies.md, ops/break-glass.md written from the code. Gaps found: BETTER_AUTH_SECRET rotation breaks the jwks private key (no tool to clear it); personal db roles read every table incl. auth tables; SEED_USER_PASSWORD rotation doesn't reset seeded accounts.
- 2026-11-20 (prd/hosting): Hosting waves 1-4 landed in dev (a187dc2, 8b7f683); prd/hosting removed. Slice 7 (going live per ops/runbook.md, staging first) is being run by the user through a hotfix session, which should claim B-33 and mark it done when production is live. To confirm on staging: PowerSync refetches the JWKS after pnpm auth:rotate-jwks; PowerSync Cloud's snapshot uses SELECT *; Vercel runs pnpm 12.
- 2026-11-20 (Robert Bo Davis): Released the stale claim (prd/hosting is gone). Waves 1-4 are in dev; only slice 7 (going live per ops/runbook.md, staging first) remains. The user's going-live session claims B-33 and marks it done when production is live.
- 2026-11-20 (hotfix/go-live): 2026-11-20: staging live (hotfix/go-live): deploy, seed, staff, invite mail and two-device sync checked; JWKS rotation check skipped. Production not started (needs paid Neon and PowerSync plans, B-183 first).

### B-40 · chore · Real app screenshots for the marketing site before launch

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-18 (prd/marketing): The marketing site shows SVG placeholders (apps/web/public/screenshots/<name>.svg) to keep the repo small while the app's screens change. Before launch: run scripts/browser-checks/marketing-screenshots.mjs on a freshly reset stack (CARETOOK_BROWSER_SLOTS=4 pnpm prd browser marketing-screenshots --timeout 300), commit the WebP images, and point site/screenshots.ts and the Screenshot component back at them (light and dark sources, srcset).
- 2026-11-18 (Robert Bo Davis): Timing (the user, 2026-11-18): one of the last tasks before launch. Do it after the launch-ready product map and once the screens it shows have stopped changing, alongside the launch work in B-33, so the images match what ships. Not part of any current marketing wave.

### B-52 · feature · Ability to download all data from the app to a file for backup or transfer to another device.

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'data-rights' (to write): export everything you can see (per group and per account) to a file. Compliance (AGENTS.md) already requires user data deletion; export belongs with it.

### B-53 · feature · Ability to delete ALL data from the app.

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for 'data-rights' with B-52. Needs scoping in the PRD: 'delete ALL data' could mean this device's copy, one group (owners), or the whole account. Ties to the open question about a last owner deleting their account.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-1 is filed as B-84 for data-rights: soft delete scrubs content; plan it with delete-all.

### B-54 · feature · privacy policy and terms of service.

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-18 (prd/marketing): Proposed for marketing (orchestrator): draft /privacy, /terms and /health-data-privacy landed with marketing slice 3 (DRAFT banners, [Review: …] notes). What's left is the user's legal review and removing the banners; no slice planned until the user reviews the text.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-4: the draft pages promise staff see care data only with permission, recorded, and encryption at rest; neither is built yet. Promise only what's built, or build S-4 first (open, 2026-11-19).

### B-56 · feature · ability to upload photos of patient drivers license, insurance card, DNR, etc.

- status: triaged
- prd: documents
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'documents' (to write): photos and files (ID, insurance card, DNR) per recipient. Needs file storage, which waits on hosting (B-33), plus encryption and sync decisions (files likely online-first, not in PowerSync). Pairs with profiles (B-45).
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md): E2E decision (2026-11-19) is option C for files: plan end-to-end encrypted uploads (a group key wrapped per member device, recovery codes) as part of the documents PRD.
- 2026-11-19 (Robert Bo Davis): planning opened on plan/documents (.loops/plan-documents). Building it waits on hosting (file storage) and includes option C from the security review (E2E for files only)

### B-84 · feature · Deleting an entry, provider or medication scrubs its content everywhere

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-19 (plan/encryption): From the security review (plans/security-review.md on plan/encryption), S-1 (launch): soft-deleted rows keep title, body, details and the document, and sync to every member's device. Scrub to a tombstone and purge later. The undo window and retention are open for the data-rights interview (user, 2026-11-19).

### B-85 · feature · Two-factor sign-in, required for owners, admins and staff; breached-password check

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-19 (plan/encryption): From the security review (plans/security-review.md on plan/encryption), S-9 (later): Better Auth's twoFactor and haveIBeenPwned plugins (built in). Required for owners, admins and global staff, optional for others (decided 2026-11-19). The PRD settles group creation, promotion, a grace period for existing owners, and recovery.

### B-145 · question · Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for…

- status: triaged
- prd: encryption
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. / Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- 2026-11-20 (backlog agent): Triage: a decision for the encryption review (plans/security-review.md, option A for launch), not a build item yet. It only becomes work with Capacitor (SQLCipher, secure storage); on the web the browser profile is the boundary. Needs the user's answer; no PRD to start.

### B-183 · chore · Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-20 (hotfix/go-live): Repo is public (B-33), so run logs are public for 7 days. Use ::add-mask:: on email/reason inputs in admin-grant.yml, db-access.yml, rotate-jwks.yml; secrets are already masked.
- 2026-11-20 (Robert Bo Davis): Triage: hosting, part of going live (B-33): add ::add-mask:: in admin-grant.yml, db-access.yml, rotate-jwks.yml before production

### B-196 · feature · List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting

- status: triaged
- prd: connectors-4
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): after the production launch (B-33) and the privacy policy and terms (B-54); vendor review
- 2026-11-20 (Robert Bo Davis): Left out of the connectors-2 PRD (the user, 2026-11-20): after the launch (B-33) and the privacy policy (B-54); the PRD's Out of Scope lists what a listing needs. -- backlog agent
- 2026-11-21 (Robert Bo Davis): Retagged from connectors-2 (done) to connectors-3 so it sits on an open topic; the directory listings follow the staging check with Claude and ChatGPT.
- 2026-11-21 (plan/connectors-3): Moved from connectors-3 to connectors-4 (hold, after hosting and marketing) by the connectors-3 planner, 2026-11-21: the user chose after the launch and the privacy policy; a listing needs a logo, short and long descriptions, a test account and the privacy URL.

### B-209 · feature · react-i18next or some other internationalization library to support multiple languages for all text…

- status: triaged
- prd: i18n
- owner:
- commit:

- 2026-11-20 (prd/conditions): From the inbox: react-i18next or some other internationalization library to support multiple languages for all text in the app.
- 2026-11-20 (Robert Bo Davis): Triage: a new big PRD (i18n). It touches every user-facing string (routes, ui/, emails, MCP text, dates and plural rules), so it should run alone or with tooling-only PRDs, ideally after the feature PRDs settle. Needs your approval for a new dependency (react-i18next/i18next, or a lighter alternative such as Lingui or FormatJS). Decide which languages and when it matters before launch.
- 2026-11-21 (Robert Bo Davis): PRD and plan written (plans/i18n-prd.md, i18n-plan.md): English and Spanish (AI-drafted, human review before launch), per-user language, app + emails + public site at /es/; quick entry parsing, search matching, the connector and /admin stay English. Dependencies approved 2026-11-21: i18next, react-i18next, eslint-plugin-i18next (dev). Runs alone, after list-filters, planner-2, the quick-fixes wave and simple-mode.

### B-239 · bug · pnpm prd review: --json mode prints progress lines (asked Codex…, waiting) on stdout, so its output isn't valid JSON

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (review.sh:72), verified. Send progress to stderr when --json.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.

### B-240 · bug · pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (review.sh:77), verified. Exit 75 when the summary never changes.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.

### B-241 · bug · codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (codex-review.mjs:37), verified. Paginate, or refuse clean when hasNextPage.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.

### B-242 · bug · with_backlog_lock: on Linux, BSD 'stat -f %m' succeeds with non-numeric output before GNU stat is tried, breaking the lock-age arithmetic

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (lib.sh:328), verified. Macs are fine today; check the output is numeric before falling back.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.

### B-244 · chore · codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): User's decision 2026-11-21. One-line change in openFindings (scripts/loops/codex-review.mjs) plus a test on the outdated.json fixture. Declined, non-outdated threads still need reply + resolve. Update docs/agents/orchestrator.md _Landing a wave_ step 4, docs/orchestration.md and the orchestrator prompt line in prompt.sh (+ prompt.test.mjs): only declined threads need --resolve.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.

### B-245 · plan · Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date

- status: triaged
- prd: planner-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the backlog session, 2026-11-21, at the user's request: the future replacement for reminders (future-dated notes), which are to be removed from the Planner. Not triaged; no PRD yet.
- 2026-11-21 (Robert Bo Davis): Follows planner-2 (B-248 remove reminders).
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, proposed: its own PRD to write, planner-3 (a note carries a todo with its own due day and assignee), after planner-2 (B-248 remove reminders) is in dev, since it builds on notes being past-only. PRD table row added. For the user to check.
- 2026-11-21 (plan/planner-3): Planned 2026-11-21 (plans/planner-3-prd.md, slices 1-4). The user's answer to the planner's question: links are many to many, a note links any todos and any events ('there is no such thing as an appointment'). So: a join table timeline_entry_link modelled on timeline_entry_provider (one migration, one sync stream); todo.event_id untouched. Slice 4 (notes link events) is the planner's reading of 'Similarly any event'.
- 2026-11-21 (Robert Bo Davis): User, 2026-11-21 (backlog session), on the landed planner-3 plan: "events and notes are both timeline entries, right? so the relationship is the same either way. We'll follow up with tiptap plugin to link todos (or create todos) while typing. in a note or an event. correct me if i'm wrong... but timeline entries should be many-to-many with todos (we'll hide them on non 'live note' entries, but don't impose any ux based limitation and redo any one to many relationship between event type timeline entries and todos." Checked: notes and events are both timeline_entry rows, so the user is right. Backlog session's reading, not the user's words: the link is timeline_entry to todo, many to many, for any entry type, with no check tying it to notes; the todo's single event link (todo.event_id) is replaced by rows in that table (additive: backfill now, drop the column in a later contract step); the UI shows links only on live notes for now; the note-to-event link (slice 4, linked_entry_id) was not what the user meant and likely goes. A Tiptap plugin to link or create todos while typing is a later follow-up, not this topic. planner-3 is on hold until its plan is revised.

### B-252 · feature · Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming

- status: triaged
- prd: connectors-3
- owner:
- commit:

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21, the user's request: upcoming returns appointments and dated todos only; the dosing schedule gets its own read tool (a new one, or a day parameter on todays_doses). Proposed topic connectors-3, a PRD to write; for the user to check.
- 2026-11-21 (plan/connectors-3): Planned as connectors-3 slice 1: a new read tool dose_schedule (today onward, 7 days by default, 14 at most; the plan only, no state). plans/connectors-3-plan.md

### B-253 · feature · Connector: add_todo can make a repeating todo (daily, weekly on days, monthly)

- status: triaged
- prd: connectors-3
- owner:
- commit:

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21: repeating todos are created from the todo form only in planner-2; the connector's add_todo taking a repeat is this follow-up, after planner-2 (B-248 remove reminders) is in dev. Proposed with B-252 in connectors-3; for the user to check.
- 2026-11-21 (plan/connectors-3): Planned as connectors-3 slice 2: add_todo takes a structured repeat (every day, week on weekdays, or month; interval; no end). Waits for planner-3 (addTodo.repeatRule). plans/connectors-3-plan.md

### B-254 · feature · Quick entry: 'bins out every monday' makes a repeating todo

- status: triaged
- prd: planner-3
- owner:
- commit:

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21: repeating todos are created from the todo form only in planner-2; reading a repeat in quick entry is this follow-up, after planner-2 (B-248 remove reminders) is in dev. Proposed alongside B-245 (attach a todo to a note) in planner-3; for the user to check.
- 2026-11-21 (plan/planner-3): Planned 2026-11-21 (plans/planner-3-prd.md, slices 5-6): a repeat phrase makes the line a repeating todo; addTodo gains repeatRule; the connector's add_todo leaves it out until B-253.

### B-256 · bug · call and directions icons on planner schedule should be below the time, not beside the…

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: call and directions icons on planner schedule should be below the time, not beside the title/description to free up space on mobile.
- 2026-11-21 (Robert Bo Davis): Triage: a small layout fix on the Planner schedule rows (call and directions icons under the time), so quick-fixes; the Planner files are hot for planner-2 and list-filters, so pick it up after those land.
- 2026-11-21 (prd/orchestration-2): category: ui (orchestration-2 split)
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.

### B-268 · chore · Move SeriesScopeDialog's raw <dialog> into a ui/ choice dialog on useShowModal

- status: landed
- prd: ui-kit-2
- owner: prd/ui-kit-2
- commit: 9d02ad16

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: components/entry/SeriesScopeDialog.tsx is the only raw <dialog> outside ui/, so it skips ConfirmDialog's wait-for-menu-close and focus rules. A three-choice dialog primitive (or ConfirmDialog with a second action) covers it.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21): moved to the follow-on ui-kit-2, after the area sweeps (B-398); ui-kit itself is the primitives and their first adopters.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): planned in plans/ui-kit-2-plan.md. Slices: 1 Button (B-423), 2 the header add button (B-420, B-419), 3 medication tabs and add menu (B-424), 4 the typeface (B-415), 5 motion (B-414), 6 the choice dialog (B-268).

### B-269 · chore · Guard the kit: a lint rule or layout test that keeps react-aria imports in ui/ and flags raw btn, card, badge and alert classes outside ui/

- status: triaged
- prd: ui-kit-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: no no-restricted-imports or class guard found in the ESLint configs; the rules in components.md are held by review only (react-aria is clean today). Add after the primitives land, with an allowlist for marketing and print sheets.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21): moved to the follow-on ui-kit-2, after the area sweeps (B-398); ui-kit itself is the primitives and their first adopters.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): moved to the follow-on ui-kit-3 (ui-kit-2 is six slices without them). B-448 belongs in the profile area's sweep slice.

### B-274 · chore · Component tests: one test clock on a fixed base date, reset per test, with harness deadlines on performance.now(); one shared fixClock

- status: in-progress
- prd: test-health
- owner: prd/test-health
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). setup.ts restarts at 12:00 per file and keeps running (minute turns, B-133's retry: 2 still at timelineScroll:163); fixClock exists twice (medicationWorld:359, plannerWorld:43) on a different base. A fully frozen Date breaks found/waitUntil and ids built from updated_at. Wall-clock tolerance asserts: entry:174, timelineHeader:137.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-275 · chore · Component tests: one waitUntil in test/found.ts with one central timeout; no per-call milliseconds (lint rule)

- status: in-progress
- prd: test-health
- owner: prd/test-health
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). Seven copies of waitUntil; 431 of 584 calls pass a number (378 at 4000, below the central 5 s); 43 timeout: literals, 30 redundant. Real exceptions: timelineStrips:175, device.browser.test:277,305.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-276 · chore · Component tests: a retrying getByCss locator and world helpers that return locators, with lint rules against non-null reads in expect and userEvent calls and against fixed sleeps

- status: in-progress
- prd: test-health
- owner: prd/test-health
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). No auto-waiting way to reach a data- hook: $ and $$ are copied in four world files and six tests (338 calls, 30 files). Rules A (userEvent with a non-null argument, about 296 sites), B (non-null inside expect, 200 to 250), C (sleeps, about 45): warn first, migrate area by area. Supersedes sweeping sites as in B-176, B-178, B-180, B-228.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-281 · chore · Component tests: cut duplicates and brittle layout assertions; frame, harness and primitive tests use a probe route, not the timeline

- status: ready
- prd: test-health
- owner: prd/test-health
- commit: a06ce3e9

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 1,600 to 2,000 lines. Timeline: pixel and class asserts (timelineLayout 173, 303, 323, 425; todayCard 265), Given all and Undo in four files, todayCard and summaries repeating unit tests. Elsewhere: inScreens (12 commits, all following other areas) down to its screen-specific parts, device.browser.test to about 180 lines, section-current and settings-frame copies into one table, print tests repeating unit tests.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.
- 2026-11-22 (slice/test-health/14): slice 14 (10af7ad5): probe route apps/web/test/probe.tsx; frame, device, layout and inScreens' generic parts on it; timeline pixel/class asserts, Given all Undo repeats, today/summary/print unit repeats, section-current and settings-frame copies cut (969 deleted, 468 added before print; see hand-off)

### B-282 · chore · Playwright specs: move one-device and no-browser steps out (marketing first), remove fixed sleeps, merge signout-wipe into session-end

- status: landed
- prd: test-health
- owner: prd/test-health
- commit: 856602af

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 880 lines. marketing: 10 of 16 tests need no browser or are unit-covered; five MIN_FORM_MS waits. live-notes: about 11 s of sleeps in one serial test. invites, app-shell, phase2, first-sync, sign-in, layout-offline: one-device steps a component test already covers. ui.spec keeps only production CSS and the CSP. fixtures.mjs:137 sleeps 1 s on every sign-in.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.
- 2026-11-21 (slice/test-health/10): slice 10 (marketing): spec 21 tests -> 11, run 33s -> 9s; one-device steps moved to component tests beside the marketing code (marketingWorld.tsx); MIN_FORM_MS waits replaced by Playwright's page.clock; no fixed sleep left. Commit 15ebe405.
- 2026-11-22 (slice/test-health/12): slice/test-health/12: the rest of the specs. signout-wipe merged into session-end (spec, manifest line, check-areas rules gone, repointed). One-device steps cut from sign-in, ui, first-sync, phase2, layout-offline, app-shell, invites; new component tests for a wrong password, the + sheet's focus return, offline settings pending (units, layout) and the home's join-request Withdraw. Fixed sleeps out of live-notes (10), fixtures.mjs signIn retry, sign-in (2), first-sync (2), phase2, layout-offline; the note said fixtures slept on every sign-in, it was only on the token-401 retry. Commits b72a59e7, f0d7f192.

### B-283 · chore · Server tests: shared fixtures (createWorld, a sync and MCP test helper) and trim rules re-tested through sync upload and the connector; first move the member matrix and condition refusals down to the data layer

- status: landed
- prd: test-health
- owner: prd/test-health
- commit: 1ac187ef

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 700 lines plus about 450 from fixtures (world rebuilt in 13 data files, clientFor copied in 34). Keep every entry-point branch: PATCH immutable, readOnlyTable, done_at mapping, mcp:invalidArguments. Move first: member role matrix (router.int 381-567 is its only owner) and conditionDeleted/conditionNotFound (only via mcpWrites 554-690). syncTodos 99-126 stays.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-285 · bug · Server-refused sync changes vanish with only a console.warn: keep refused ops in a local table and show them with the server's reason

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/sync/client.ts:55-58 ignores the code and issues sync.ts returns. Ordinary triggers: a phone clock over an hour fast (vitals and doses), two offline devices adding a pass with the same name (the pass and its medications), a role changed while offline, a todo assigned to someone who left. Four reviewers flagged it. Topic: a new PRD for sync data loss.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-286 · bug · A repeatable 5xx from sync.upload blocks a device's upload queue forever: no retry cap, and the sync indicator never shows uploadError or the queue length

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. sync.ts:913-919 throws on every non-4xx; client.ts retries the same batch. Known triggers: a timeline_entry PUT replayed after the uploader was demoted to viewer (nothingUpdated is mapped for PATCH at sync.ts:175, not for PUT), a NUL character in any text column, table __proto__. Fix idea: quarantine an op after N identical failures and show the pending count.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-287 · bug · Offline medication and provider edits re-send unchanged JSON columns (schedule, phones), reverting a co-member's newer change

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. medications.sync.ts:457,642-645 and providers.sync.ts:264,347-350 write every column as compact JSON.stringify while the synced copy holds Postgres's jsonb text, so PowerSync's diff sends them in every PATCH. Rests on one assumption: check ps_crud on staging after a refill edit. conditions.sync.ts:545-547 already writes only changed fields. Fixtures seed compact JSON, so tests cannot see it.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-288 · bug · A replayed PUT on an existing row is a full update with the insert-time values, reverting newer edits (and for medications writing no change entry)

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Every service upsert turns a PUT on an existing id into an update. Plausible, not traced end to end: a lost ack or a 5xx later in the batch replays the PUT. Fix idea: a PUT on an existing live row is a no-op. medicationService.ts:178-181.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-289 · bug · Client-chosen ids are global: a member of one group can squat ids in another (note_document by a victim's provider id; series visit ids), wedging a device's queue or making top-up skip days

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. noteDocumentService.ts:197-201 checks existence only in the actor's scope, so the victim's create hits the primary key and returns a 500; appointmentSeriesService.ts:117-131 visitExists accepts any row with the computed id without checking its group. Fix idea: check existence as the system and return 4xx; compare group and series.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-290 · bug · Sign-out and a lapsed session wipe the device without checking the upload queue: unsent changes are destroyed with no warning

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/auth/session.ts:113,164, routes/sign-out.tsx:18. Offline, the wipe runs first and authClient.signOut() then throws: the user lands on the root error page with a still-valid session cookie (UserMenu.tsx:46-52). Fix idea: count queued ops and ask; catch the sign-out failure; keep the database when the same user's session merely expired.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-291 · bug · sync.upload looks tables up on a plain object: table 'constructor' is acknowledged as applied having done nothing, '__proto__' throws a 500

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/api/src/sync.ts:928 HANDLERS[op.table]. Use a Map or Object.hasOwn. Low severity (a malformed client only), but '__proto__' is one of the queue-wedging 5xx paths.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-292 · chore · A test that the device schema, sync-config.yaml and the upload column maps in sync.ts agree, minus an explicit ignore list

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. A column missing from an X_COLUMNS map is silently dropped on upload and a PATCH of only that column returns applied (sync.ts:172). The three lists agree today (two reviewers diffed them by script); nothing keeps them so. Adding one column to a synced table takes about 12 hand edits, 5 of them untested.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-293 · change · One generic soft-delete table handler in sync.ts in place of nine copied ones (they have already drifted)

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/api/src/sync.ts is 937 lines of near-identical column map, contentFrom, remove-with-replay-check and PUT/PATCH/DELETE per table. Drift: only timelineEntryOp maps nothingUpdated to unauthorized; timeline and series removes answer a viewer 404 where the others answer 403. About 400 lines go.
- 2026-11-21 (plan/sync-safety): Planned in plans/sync-safety-plan.md (2026-11-21). Slices: 1 = B-291, B-292, B-293; 2 = B-285; 3 = B-286; 4 = B-290; 5 = B-288, B-289; 6 = B-287.

### B-294 · bug · Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Example: a series split in lib/appointments/series.sync.ts:433-521. Design finding: upload by device transaction and apply it atomically. Related: removePass rewrites every medication's schedule from the device's possibly stale copy (medicationPasses.sync.ts:283-287).
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.

### B-295 · bug · System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. medicationService.ts:73,185; medicationPassService.ts:119; recipientConditionService.ts:173. Clamp the future side to server time. Low.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.

### B-296 · bug · A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/sync/index.ts:28. Traced by reading only. Low.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.

### B-297 · bug · A surplus dose marks the next day's slot as given: two caregivers both tapping Given for one pass makes tomorrow's dose read done

- status: in-progress
- prd: dose-accuracy
- owner: prd/dose-accuracy
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/schema/medications/dueDoses.ts:166-206: named matches have no distance or day bound. Reproduced by the reviewer with a scratch script. Inverse: a 20:00 dose given at 07:00 answers yesterday's missed slot and leaves today's open. doseSlotsBetween has the same leak, so visit prep hides a real miss. Fix idea: a named dose answers only the slot on its own recipient-day; surplus doses answer nothing.
- 2026-11-21 (plan/dose-accuracy): Planned in plans/dose-accuracy-prd.md and -plan.md (2026-11-21): B-297 is slice 1, B-298 slices 2 and 3, B-299 slices 4 and 5.

### B-298 · change · Deterministic dose ids per medication, day and slot, so two devices logging the same pass converge on one row

- status: triaged
- prd: dose-accuracy
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. logDoses uses crypto.randomUUID() (lib/medications/medications.sync.ts:825); series visits already use UUID v5. Two reviewers raised it as the root of the duplicate-dose finding.
- 2026-11-21 (plan/dose-accuracy): Planned in plans/dose-accuracy-prd.md and -plan.md (2026-11-21): B-297 is slice 1, B-298 slices 2 and 3, B-299 slices 4 and 5.

### B-299 · bug · Visit prep's 'Missed doses' reads history through today's schedule: a schedule change shows phantom misses back to the last visit

- status: triaged
- prd: dose-accuracy
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. dueDoses.ts:289-326 (the comment admits it), lib/appointments/visitPrep.ts:320. Also: a pass moved by more than 2 h unmatches earlier doses logged without passId; a medication added at 15:00 shows its 08:00 slot overdue. Fix idea: expand slots per schedule epoch from the medicationChange entries.
- 2026-11-21 (plan/dose-accuracy): Planned in plans/dose-accuracy-prd.md and -plan.md (2026-11-21): B-297 is slice 1, B-298 slices 2 and 3, B-299 slices 4 and 5.

### B-300 · bug · Quick entry logs negated doses as given: 'did not give metoprolol', 'metoprolol not given', 'couldn't give…' all record a given dose at 0.9 confidence

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/schema/assistant/quickEntry.ts:257-279, 931-952. Reproduced with a scratch script. Negation is only recognised before take/have/swallow. Fix idea: any not/never/don't/couldn't near a dose verb makes it skipped or demotes the line to a note.
- 2026-11-21 (plan/quick-entry-2): Planned in plans/quick-entry-2-plan.md (2026-11-21): B-300 slice 1, B-301 slice 2, B-302 slices 3 and 4, B-303 slice 5.

### B-301 · bug · Quick entry discards a typed count and records the usual dose: 'gave 3 tylenol' records '2 tabs' with '3' in the note; 'gave half a tylenol' too

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. quickEntry.ts:910-924, 981. Reproduced. Related: 'tylenol 2 at 8' becomes a Symptom named Tylenol, severity 2.
- 2026-11-21 (plan/quick-entry-2): Planned in plans/quick-entry-2-plan.md (2026-11-21): B-300 slice 1, B-301 slice 2, B-302 slices 3 and 4, B-303 slice 5.

### B-302 · bug · Quick entry gives silently wrong times: 'sat up in chair' is last Saturday, '2nd tylenol' is Nov 2, '11/25 at 2pm' is tomorrow, 'dr alvarez at 2' is 2 AM, 'pain 8 a bit better' is 8:00 AM

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/schema/assistant/quickEntryTime.ts (lines 84-101, 207-214, 297-342, 362-369, 465-474, 539-556). Reproduced. Also 'this morning' before 08:00 is blocked as future. Fix idea: tighten each rule, parse M/D, clamp period defaults to now for past kinds.
- 2026-11-21 (plan/quick-entry-2): Planned in plans/quick-entry-2-plan.md (2026-11-21): B-300 slice 1, B-301 slice 2, B-302 slices 3 and 4, B-303 slice 5.

### B-303 · bug · Quick entry gets stuck: remove a card, delete the text, retype the same line: no card, no Save, Enter does nothing

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. components/quick-entry/useQuickEntry.ts:98-118,206-216: removed and chosen reset only on Save or Clear, and Clear is hidden when no cards show. Prune both maps to the current part keys.
- 2026-11-21 (plan/quick-entry-2): Planned in plans/quick-entry-2-plan.md (2026-11-21): B-300 slice 1, B-301 slice 2, B-302 slices 3 and 4, B-303 slice 5.

### B-304 · bug · Deleting an old event in Google Calendar rewrites past Caretook records: soft-deletes a past reminder note, cancels a past appointment, marks a todo done for the group

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/google/pullPlan.ts:196-203, calendarPullService.ts:172-188. Only series visits are guarded by 'started'. Fix idea: ignore deletes of started items; never complete a todo on delete.
- 2026-11-21 (plan/calendars-2): Planned in calendars-2 (plans/calendars-2-prd.md, 2026-11-21): B-304 slice 1, B-305 slices 2 and 7, B-306 slice 3, B-307 slice 2, B-308 slice 4, B-309 slices 5 and 6. The planner read the code for each.

### B-305 · bug · Events made in Google more than 90 days out never arrive: ignored as outsideWindow, the sync token advances, nothing revisits them

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. pullPlan.ts:150-154,185; calendarPullService.ts:277-311. Plausible and untested against Google: a recurring Google event becomes about 90 days of one-off appointments, then stops (real.ts:118-121).
- 2026-11-21 (plan/calendars-2): Planned in calendars-2 (plans/calendars-2-prd.md, 2026-11-21): B-304 slice 1, B-305 slices 2 and 7, B-306 slice 3, B-307 slice 2, B-308 slice 4, B-309 slices 5 and 6. The planner read the code for each.

### B-306 · bug · A reminder email can arrive after its appointment: about 2 h of retry backoff, no expiry, text rendered at queue time

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/notifications/src/outbox.ts:48-53, 346-355. Add an expiry to the row. Low.
- 2026-11-21 (plan/calendars-2): Planned in calendars-2 (plans/calendars-2-prd.md, 2026-11-21): B-304 slice 1, B-305 slices 2 and 7, B-306 slice 3, B-307 slice 2, B-308 slice 4, B-309 slices 5 and 6. The planner read the code for each.

### B-307 · bug · Google Calendar pushes still name soft-deleted providers (reminders filter them)

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. calendarSyncService.ts:200-206. Low.
- 2026-11-21 (plan/calendars-2): Planned in calendars-2 (plans/calendars-2-prd.md, 2026-11-21): B-304 slice 1, B-305 slices 2 and 7, B-306 slice 3, B-307 slice 2, B-308 slice 4, B-309 slices 5 and 6. The planner read the code for each.

### B-308 · bug · The details-consent version is stored but never compared, so bumping DETAILS_CONSENT_VERSION re-asks nobody

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Every reader uses !!detailsConsentAt. Design finding.
- 2026-11-21 (plan/calendars-2): Planned in calendars-2 (plans/calendars-2-prd.md, 2026-11-21): B-304 slice 1, B-305 slices 2 and 7, B-306 slice 3, B-307 slice 2, B-308 slice 4, B-309 slices 5 and 6. The planner read the code for each.

### B-309 · change · Reminder emails show times in the recipient's zone with no zone label, 24-hour en-GB format; and 'monthly on the 29th–31st' silently skips short months (no 'last day' option)

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Two design findings from the calendars review; the first overlaps the translations PRD (i18n).
- 2026-11-21 (plan/calendars-2): Planned in calendars-2 (plans/calendars-2-prd.md, 2026-11-21): B-304 slice 1, B-305 slices 2 and 7, B-306 slice 3, B-307 slice 2, B-308 slice 4, B-309 slices 5 and 6. The planner read the code for each.

### B-311 · bug · The series top-up reads every live series every minute and rewrites topped_up_through daily even on ended series (re-syncing them to every device)

- status: triaged
- prd: fixes-perf
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. appointmentSeriesService.ts:383-401: the horizon filter matches every topped-up series; the cron is every minute, pages of 100, each with a COUNT. Two reviewers.
- 2026-11-21 (prd/orchestration-2): category: perf (orchestration-2 split)

### B-313 · bug · Timeline and Planner load and watch every note document in the group (snapshot, text, pending updates) to preview 30 rows, rerunning on each co-member keystroke

- status: triaged
- prd: fixes-perf
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/live-notes/notes.sync.ts:23-28,51-62; timeline/useTimelineData.ts:150-152; planner/loadUpcoming.ts:23. Also unbounded: readingsQuery (timeline.sync.ts:387-393), doseChoicesQuery (medicationTimeline.sync.ts:87-96). Restrict to the window's entry ids. Two reviewers.
- 2026-11-21 (prd/orchestration-2): category: perf (orchestration-2 split)

### B-316 · change · No unsaved-changes guard on any sheet or form: a click outside, Escape or Back discards a half-filled medication, emergency or provider form

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. components/ui/Sheet.tsx:47-51 (isDismissable); no useBlocker or dirty check anywhere. May belong with the ui-kit PRD's form primitives.
- 2026-11-21 (prd/orchestration-2): category: ui (orchestration-2 split)
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.

### B-318 · bug · The app header ignores a simple-mode setting changed on another device until the next navigation

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 3114a864

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/layout/useSimpleFrame.ts:33-38 reads cachedSettings() with no subscription. Low; will change with the Easy helper and Easy viewer roles PRD (simple-mode).
- 2026-11-21 (prd/orchestration-2): category: bug (orchestration-2 split)
- 2026-11-21 (prd/fixes-bug): fixes-bug wave 1 (2026-11-21): held back until simple-mode lands; that PRD reworks useSimpleFrame.

### B-319 · bug · Empty states flash before the first watch answer: a provider's linked entries ('No notes or events yet') and linked todos ('Former member')

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/groups/provider/LinkedEntries.tsx:21-31, components/todos/useLinkedTodos.ts: seeded with NO_ROWS. Low.
- 2026-11-21 (prd/orchestration-2): category: ui (orchestration-2 split)
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.

### B-325 · change · Native readiness: no top safe-area inset on the header or sticky day headers (viewport-fit=cover), and /app is a blank page on cold start for up to about 4 s (HydrateFallback returns null)

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. root.tsx:31,58. Only Sheet handles the inset. Belongs with Capacitor work when that starts.
- 2026-11-21 (prd/orchestration-2): category: ui (orchestration-2 split)
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.

### B-327 · bug · A removed or demoted manager's pending invites still work: a removed owner can accept their own owner invite within 7 days and be an owner again

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. careGroupMemberService.ts:66-91,136-171 revokes nothing; careGroupInviteService.ts:438-507 accept never rechecks the inviter. Fix idea: revoke the member's pending invites on removal and demotion. Two reviewers; high.

### B-328 · bug · The emailed sign-in code has no per-address limit (per IP only): a distributed attacker gets unlimited guesses at any account's 6-digit code

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:204-217, emails.ts:107-128: each /sign-in/magic-link call mints a fresh code with 3 attempts. The same loop floods the victim's inbox and keeps replacing their valid code. Cap sign-in emails and failed codes per address per hour.

### B-329 · bug · Ending sessions never ends a connected assistant: password reset, 'sign out everywhere' and staff 'sign out all' leave the grant and its 30-day rolling refresh token alive

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. auth.ts:179, accountAdminService.ts:334, db/schema/auth/oauth.ts:123,158. Staff session deletes are raw SQL, so the plugin's revoke hook never runs. Fix idea: revoke the user's grants on password reset and revoke-all, or prompt.

### B-330 · bug · Session tokens are stored in plain text and the bearer plugin accepts them unsigned; ops/data-copies.md says they are hashed

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:201 bearer() without requireSignature. Anyone who can read the session table can act as that user without BETTER_AUTH_SECRET. There is no native client using bearer yet. Fix: bearer({ requireSignature: true }) and correct the register.

### B-331 · bug · Staff admin can invite any address as owner of any group: not limited to ownerless groups, existing owners aren't told

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. groupAdminService.ts:179-222. With no two-factor (B-85) one staff account opens every group. Fix idea: only for ownerless groups, or email the existing owners.

### B-332 · bug · Staff page-view audit rows are fired without waiting and can be lost on Vercel; user search isn't audited

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. adminAuditService.ts:50-57 recordSoon is a bare void promise with no waitUntil; called from accountAdminService.ts:216 and groupAdminService.ts:73. Also from the database review: caretook_app has UPDATE and DELETE on admin_audit_log.

### B-333 · bug · Link sign-up leaks whether an address has an account (timing), has no rate limit, and one link creates unlimited unverified accounts

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/tickets.ts:67-75 (hash before the lookup); packages/api/src/care-groups/invites.ts:244; joinRequestService.ts:158 counts a use only at the join request.

### B-334 · bug · A declined or withdrawn join requester can ask again forever, emailing every owner and admin each time; no signed-in oRPC procedure is rate limited (sync.upload, invite.resend)

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. joinRequestService.ts:127-160, 306-320. Two reviewers. A cooldown, one counted use per user per link, and limits on authed procedures.

### B-335 · bug · Better Auth's /update-user is live and unvalidated: a name or image of any length syncs to co-members and into owner emails

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:142 (not in disabledPaths). Plausible.

### B-336 · bug · A role change reads its target unlocked: an admin's demote racing an owner's promotion of the same member can skip the owner-only and last-owner checks

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. careGroupMemberService.ts:68-88. Plausible. Lock the row or add the expected role to the UPDATE's filter.

### B-337 · bug · /mcp verifies a token (several database reads) before any rate limit, and rate-limit keys fall back to one shared 'unknown' bucket when the IP header is missing

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/api/src/connectors http.ts:100-108. /oauth2/register is open with per-IP limits only, and oauth_client rows are never purged.

### B-338 · feature · Account settings: change name, email and password (today the page is read-only; password only via reset)

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/settings/account/route.tsx. Staff cannot edit them either. Tracked nowhere before this review.

### B-339 · question · Decide the session cookie cache before launch: ordinary /rpc calls keep working for up to 3 minutes after a session is revoked

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. docs/domain/auth.md says 'Reconsider before launch'; no item tracked it.

### B-340 · change · A member in two groups can connect a given assistant to only one (one grant per user and client)

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Design finding from the connector review.

### B-341 · chore · CI: a workflow on PRs into dev that runs format, lint, typecheck, unit and integration tests (today no workflow runs any test)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. .github/workflows/ has deploy, seed and admin jobs only; deploy.yml migrates and deploys with no test step. Three reviewers. Also: grep the built client for caretookSync in the deploy job, and run build:native somewhere.

### B-342 · bug · The Postgres pool has no error listener: a dropped idle connection crashes the function; 10 clients with a 2 s wait time out under a burst of uploads

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/client.ts:22-27. Fix idea: pool.on('error', logError), attachDatabasePool from @vercel/functions (already a dependency), a longer queue wait. High.

### B-343 · bug · The break-glass database grant (pnpm db:access grant) very likely fails on Neon: it sends a SCRAM verifier, which the runbook records Neon rejecting

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. dbAccessService.ts:105, db/roles/scram.ts, ops/runbook.md:130. The Database access Action has never run. Run grant and revoke once on staging. Also: staff_<slug> role names can collide (a.b@ and a_b@), and VALID UNTIL never ends an open connection.

### B-344 · bug · The migrator can silently skip a migration whose journal timestamp is older than the last applied one; nothing guards it

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. drizzle-orm 0.45 applies by 'when', with no per-file check; parallel PRDs renumber migrations. Fix idea: a unit test that 'when' strictly increases in file order, and a deploy step comparing the journal count with drizzle.__drizzle_migrations. The reviewer could not read the journal, so today's state is unverified. Also: all pending migrations run in one transaction (the runbook says one each).

### B-345 · bug · No lock_timeout, statement_timeout or idle_in_transaction_session_timeout anywhere: a migration queued behind a PowerSync snapshot blocks every query on that table

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. db/client.ts, migrate.ts, roles/rolesSql.ts. ALTER ROLE caretook_app SET … in rolesSql, and SET lock_timeout in the migrate script. Related: enum CHECKs are dropped and re-added validated under ACCESS EXCLUSIVE (use NOT VALID then VALIDATE).

### B-346 · bug · Staging's self-check and mail allowlist fail open when APP_ENV is missing or mistyped in Vercel

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. apps/web/app/.server/deployEnv.ts:251, packages/notifications/src/config.ts:88. Require APP_ENV whenever VERCEL is set. The seed guard also trusts the APP_ENV label, not the database's identity.

### B-347 · change · Deploy order: migrate, roles and sync config run before vercel build, so a build failure leaves the database ahead of the code; a smoke failure has no rollback

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. deploy.yml. Build first, then migrate, then deploy --prebuilt. Also: pnpm dlx vercel and powersync pin the CLI but their transitive dependencies float and run with deploy tokens.

### B-348 · chore · Purge what is never purged: expired session rows (IP, user agent), expired OAuth access and refresh tokens, failed outbox rows, unused oauth_client rows

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Only the outbox, rate-limit and Google OAuth state tables are swept. Add them to sweepOutbox.

### B-349 · bug · packages/data/scripts/run.ts prints the raw failure cause to public Action logs (query params: staff emails, reasons, seed password hashes)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. run.ts:18. Extends B-183.

### B-350 · chore · Bind local Postgres and PowerSync to 127.0.0.1 (they listen on all interfaces with repo-known credentials)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. docker-compose.yml:18,50; powersync/service.yaml:40. Low.

### B-351 · feature · Monitoring and alerting with no health data: cron failures (the calendar cron returns 200 when a step fails), replication-slot lag, 5xx rate, failed mail, uptime

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. The hosting PRD put it out of scope; nothing tracks it. Launch blocker per two reviewers.

### B-352 · chore · Write and run a restore drill before production (Neon point-in-time restore, then the PowerSync slot and re-snapshot, then devices holding newer rows), and confirm the vendor 'to confirm' cells in ops/data-copies.md

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. PITR window, pgaudit, encryption at rest and log retention are unconfirmed; the JWKS-refetch check in auth.md was skipped.

### B-353 · chore · Write the breach and incident procedure (FTC Health Breach Notification Rule): ops/break-glass.md and the privacy draft both refer to one that doesn't exist

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. ops/break-glass.md:61; marketing privacy/content.ts:177 promises 60-day notice.

### B-354 · question · The whole user table (emails, roles, disabled reasons) is granted to replication and lands in PowerSync Cloud storage: move the public profile to its own table?

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Design finding from the database review; the sync rules only send id, name and image to devices.

### B-355 · chore · Hand checks before launch nothing tracks: the Google smoke test against real Google, Google OAuth app verification, the connector's vendor steps (Claude, ChatGPT)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. docs/domain/calendars.md:20, the appointments-2 PRD, docs/domain/connectors.md:63.

### B-356 · feature · A staff procedure and tooling for deletion and export requests before self-service ships (the privacy draft promises deletion within 45 days; nothing can delete an account or group)

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:158 has deleteUser off; userService.remove has no caller; no group deletion exists. A direct row delete cascades memberships past ensureAnotherOwner and leaves the group ownerless, with the Google token unrevoked (AGENTS.md's open question).

### B-357 · question · Consent evidence is deleted with the user or group (care_group_consent, connector_grant cascade), and the audit log loses target_user_id: keep them?

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Design finding from the database review.

### B-358 · question · Should the legal drafts promise only what is built (deletion, 'permanently removed' entries, backups, at-rest encryption), and who fills the placeholders ([Company legal name], [privacy email], [backup retention period])?

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. marketing privacy/content.ts:177-188 and the FAQ. Goes with B-54.

### B-359 · feature · Record terms, privacy and 18+ acceptance at sign-up and invite accept (no /terms or /privacy link outside the marketing pages; the terms require 18+)

- status: triaged
- prd: onboarding
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Tracked nowhere before this review.

### B-360 · change · The app isn't installable: site.webmanifest has display 'browser', start_url '/', and is linked only from the marketing layout

- status: triaged
- prd: onboarding
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Also absent and untracked: an accessibility statement, app-store prerequisites, an ownership-transfer flow (careGroupMemberService.ts:173 says the last owner 'must hand over ownership first').

### B-361 · change · A @caretook/data/domain export for the pure logic now living under db/schema (quick entry parser, due doses, medication display, series edits: about half that folder)

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. 6,862 of 14,058 non-test lines in packages/data/src/db/schema touch neither a table nor Zod; /schema is the only broad client-safe export, so 288 web files import that barrel. Also removes six 'keeps the old import path' shims in apps/web/app/lib.
- 2026-11-21 (plan/code-health): Planned 2026-11-21: plans/code-health-plan.md (B-366 slice 1, B-365 slice 2, B-367 slices 3 and 4, B-361 slices 5 and 6). B-365 leaves isUserRoleName and isGroupRoleName for B-363 (simple-mode is editing that file).

### B-362 · change · A soft-delete model factory and a shared upsert helper: nine models are the same file, twelve upserts repeat the exists-as-system, visible-as-actor sequence, 'invalid' is defined 18 times

- status: triaged
- prd: code-health-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Device side too: refuse x10, invalid x8, canWrite x7, a FormData text() x9 although core/form.ts has formString, the identical shouldRevalidate in 32 routes.
- 2026-11-21 (plan/code-health): Moved to code-health-2 by the code-health planner, 2026-11-21: waits on simple-mode (it builds the role sets and canWrite/canLog) and sync-safety (it rewrites every soft-delete upsert). B-363 also removes isUserRoleName and isGroupRoleName, which B-365 names, if still unread.

### B-363 · change · One exported role-capability table (canWrite(role), canComplete(role)) used by services, device modules and screens, before any role is added

- status: triaged
- prd: code-health-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. 'viewer' literals: 38 lines in 27 non-test files; WRITER_ROLES in lib/timeline/timeline.sync.ts:32 duplicates WRITERS in permissions/blocks.ts:75; sync-config.yaml:156 has role != 'viewer'; role checks leaked into packages/api care-groups/invites.ts:69-70 and joinRequests.ts:84-85. Collides with the Easy helper and Easy viewer roles PRD (simple-mode): do it first or inside it.
- 2026-11-21 (plan/code-health): Moved to code-health-2 by the code-health planner, 2026-11-21: waits on simple-mode (it builds the role sets and canWrite/canLog) and sync-safety (it rewrites every soft-delete upsert). B-363 also removes isUserRoleName and isGroupRoleName, which B-365 names, if still unread.

### B-364 · change · Device reads are 164 raw SQL strings with hand-typed row types, 17 files outside *.sync.ts: derive row types from the device schema and make libLayout.test.ts refuse SQL elsewhere

- status: triaged
- prd: code-health-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. e.g. routes/app/groups/planner/upcomingQueries.ts, timeline/simpleRows.ts.
- 2026-11-21 (plan/code-health): Moved to code-health-3 by the code-health planner, 2026-11-21: cut to keep code-health at six slices. B-369's sync PATCH part waits on sync-safety-2.

### B-365 · chore · Remove unused scaffolding and dead exports: serviceName (45 exports, 0 reads), the services registry, getService, isServiceName, initClient, isUserRoleName, isGroupRoleName, primaryContactName, hasContact, CALENDAR_CARDS, COMING_SOON

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Medium confidence, kept 'for later' per api.md: oRPC timeline.create|list|update|remove|latestVitals, careGroup.members, careGroup.recipientDetails, search.query. connectors/testing.ts and mintToken.ts are test helpers living in src.
- 2026-11-21 (plan/code-health): Planned 2026-11-21: plans/code-health-plan.md (B-366 slice 1, B-365 slice 2, B-367 slices 3 and 4, B-361 slices 5 and 6). B-365 leaves isUserRoleName and isGroupRoleName for B-363 (simple-mode is editing that file).

### B-366 · chore · Pin dependencies exactly: 47 caret ranges remain (react-router, drizzle-orm, zod, vite among them) against AGENTS.md's rule

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Needs the user's word on each bump policy; no version changes, only the range form.
- 2026-11-21 (plan/code-health): Planned 2026-11-21: plans/code-health-plan.md (B-366 slice 1, B-365 slice 2, B-367 slices 3 and 4, B-361 slices 5 and 6). B-365 leaves isUserRoleName and isGroupRoleName for B-363 (simple-mode is editing that file).

### B-367 · chore · Agent tooling: tests for the merge path (land.sh, pr.sh, ready.sh, review.sh: 465 lines, none), and with_backlog_lock removes a stale lock without re-checking, so two waiters can both take it

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. scripts/loops/lib.sh:329. Also: lease.sh still carries the old .loops/.browser path; 22 of 34 CARETOOK_* knobs are undocumented. Goes with B-239 to B-242.
- 2026-11-21 (plan/code-health): Planned 2026-11-21: plans/code-health-plan.md (B-366 slice 1, B-365 slice 2, B-367 slices 3 and 4, B-361 slices 5 and 6). B-365 leaves isUserRoleName and isGroupRoleName for B-363 (simple-mode is editing that file).

### B-368 · chore · Comments that point at plans instead of behaviour: 198 'slice N' references in 154 source files and 262 PRD-name parentheticals

- status: triaged
- prd: code-health-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Low; sweep opportunistically.
- 2026-11-21 (plan/code-health): Moved to code-health-3 by the code-health planner, 2026-11-21: cut to keep code-health at six slices. B-369's sync PATCH part waits on sync-safety-2.

### B-369 · change · baseModel.list always runs a second COUNT query, and a sync PATCH costs about seven round trips (a 100-op batch about a thousand, serially)

- status: triaged
- prd: code-health-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/models/base/baseModel.ts:163-168. Performance design finding.
- 2026-11-21 (plan/code-health): Moved to code-health-3 by the code-health planner, 2026-11-21: cut to keep code-health at six slices. B-369's sync PATCH part waits on sync-safety-2.

### B-370 · chore · Quick check always runs the guards that read source by path (scripts/loops/sync-matrix.test.mjs, rolesSql.test.ts): vitest --changed can't select them

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. prd.sh:212. A new synced table or stream column passes a quick check with its guard never run. Overlaps B-272.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): check-speed's always-run list landed; verify whether sync-matrix.test.mjs and rolesSql.test.ts are in it before working this (may be done or a one-line add).

### B-371 · chore · Device-to-server round trip per table through the app's own writers, comparing column values on the second device (today: hand-written INSERTs, id only, browser suite only)

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. scripts/browser-checks/roundtrip.spec.mjs:556, sync-matrix.mjs. Component tests have no connector (apps/web/test/device.tsx); queuedWrites is used in two files. Also: seed device fixtures in the JSON shape PowerSync really delivers, validated against the server's Zod schemas (test/database.ts:187, test/fixtures.ts:290,332).
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.

### B-372 · chore · A second time zone in tests: device, recipient and seed are all America/Los_Angeles in 106 of 113 component test files, while 29 production call sites read the device's zone

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Suggest a Vitest browser instance in America/New_York for the timeline, doses and appointments screens; pin TZ in the node projects.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.

### B-373 · chore · Role coverage gaps: a removed member writing or reading a care table, staff support on care tables, non-member writes through sync upload on 10 of 15 tables, and a real every-procedure unauthenticated sweep

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. router.int.test.ts:56 'rejects every procedure without a user' calls two. One parametrised sync test across HANDLERS covers most. Standing priority 2 (every role against every table) had no item. Overlaps B-283.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.

### B-374 · chore · A test for the device's uploadData: a 400 or 500 from sync.upload must not wedge the queue

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. apps/web/app/lib/sync/client.ts has no test. Goes with the sync-safety queue item.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.

### B-375 · chore · Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports)

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. B-278 and B-279 already cover the shared integration database and the frozen lists.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): the timelineScroll retry: 2 part is slice 15's; the rest (calendars.int toBeTruthy, check-areas packages/ mapping, web:unit ~/ alias) fits a later test-health wave or fixes-tooling.

### B-377 · feature · Push notifications for appointment reminders (B-61 shipped email only)

- status: triaged
- prd: calendars-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. No match for pushManager or web-push in the code.
- 2026-11-21 (plan/calendars-2): Moved from calendars-2 to calendars-3 by the calendars-2 planner (2026-11-21): three or four slices alone, with a dependency and vendor question for its own planner.

### B-378 · chore · File the translations PRD's promised follow-ups: Spanish quick entry, language-aware search, a human review of the Spanish; and note 48 hard-coded 'en-US' formatters and English messages in schemas and the errors catalogue

- status: triaged
- prd: i18n
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. plans/i18n-prd.md says these are 'filed as follow-up backlog items'; none was. i18n-plan.md:324.

### B-381 · bug · readTools.int.test.ts 'nothing private leaves' flakes when a random user UUID contains the birth year (e.g. …072194195bed matches '1941'): assert on fields, not a substring of the whole output

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Seen by planner-2 slice 1's full check (2026-11-21); passed on rerun.
- 2026-11-21 (prd/orchestration-2): category: tooling (orchestration-2 split)

### B-382 · bug · Repeating todos: an offline Undo's delete of the next occurrence lands unconditionally (todoOp removeTodo), deleting a successor another member edited or completed even though todoService.reopen kept it; tell an Undo's delete from an explicit one and apply it only when the server finds the successor untouched (todos.sync.ts:499)

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 3114a864

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P1.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.
- 2026-11-21 (Robert Bo Davis): Moved from sync-safety-2 to fixes-bug on the user's word (2026-11-21, backlog session, answering ask a15): Codex's P1, to be fixed soonest; fixes-bug is running and owns apps/web/app/lib/todos/.
- 2026-11-22 (slice/fixes-bug/14): slice 14 (73326e56): Undo's successor delete flagged via PowerSync _metadata (todo trackMetadata); server todoService.removeUndoneNext removes it only while untouched

### B-383 · bug · Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.

### B-384 · bug · Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete)

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.

### B-387 · bug · Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, round 2, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.

### B-388 · bug · Integration flakes seen in 2026-11-21 full checks: the connector MCP tests (mcpWrites, mcp, readTools .int.test.ts) failed 14 times with 'Connection terminated' in the transcripts, and todoRename.int.test.ts 4 times; find the cause (dropped connections on the shared test Postgres under load?) and fix it

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (plan/check-speed): From the check-speed review of session transcripts (planner-2, quick-fixes, quick-entry, list-filters, tasks-2). Not confirmed that the error is what failed them. Triaged to quick-fixes: one contained test fix.
- 2026-11-21 (prd/orchestration-2): category: tooling (orchestration-2 split)
- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-394 · bug · mcp.int.test.ts 'list_timeline: the group's entries in the recipient's zone, with note text, paged at 50' times out at Vitest's 5 s default under load (full check, 5-min load ~21); passes alone 3x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/check-speed): Seen in check-speed's wave 1 full check, 2026-11-21 (only failure of 5338). The test builds a world and pages 50+ entries through /mcp; give it a longer timeout or a smaller world.
- 2026-11-21 (prd/orchestration-2): category: tooling (orchestration-2 split)

### B-398 · change · Sweep every remaining area onto the UI kit primitives, one area per slice: medications; providers, profile forms and care periods; the Planner, to-dos and search; the timeline, entries and quick entry; admin, account, connectors, marketing and the app frame

- status: triaged
- prd: ui-kit-3
- owner:
- commit:

- 2026-11-21 (plan/ui-kit): From the ui-kit plan (2026-11-21): ui-kit builds the primitives and adopts them in settings, sign-in and the five detail pages; this is the rest (about 200 files: btn, alert, card, list, badge, checkbox and toggle class strings, Field control classes, the text opacities and link styles from B-267). Ends with the guard (B-269) so it stays swept.
- 2026-11-21 (plan/ui-kit): Also left for this sweep: the remaining 'No … yet.' lines and MedicationSheet's local Empty, the timeline's four skeleton files, the 15 Cancel and Save footers in sheets, section h2/h3 headings outside the detail pages, home's h1, the timeline and entry pages' containers, and icon sizes. /admin keeps its own heading sizes (a deliberate narrowing of B-263).
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): moved to the follow-on ui-kit-3 (ui-kit-2 is six slices without them). B-448 belongs in the profile area's sweep slice.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): this sweep also carries the rest of B-423 (use Button for every remaining button and button-like link; move the menus that still pass btn class strings onto the trigger look), the list of what is not a Button (plans/ui-kit-2-prd.md, Decisions), and Collapse and Chevron for the expanders ui-kit-2 leaves (TodayRow, PassLogItem, SimpleNext, EntryBody, PassCard, the medication form's details).

### B-404 · feature · One command to ship dev to staging: push dev, open the dev into staging PR, wait for Codex's review, triage its findings into the backlog (verified against the code, duplicates noted on the existing item), merge the PR when nothing is a blocker, and notify the user only when something is

- status: triaged
- prd: staging-ship
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Asked for 2026-11-21 after doing it by hand on PR #25. Proposed for orchestration-3 (the dispatcher): same unattended tooling, and it can raise a blocker through orchestration-2's asks queue (pnpm prd ask). To settle in the PRD: what counts as a blocker (today's rule: critical and breaking only, the rest are follow-ups); staging changes only by PR and is deployed by deploy.yml; Codex signals no findings with a thumbs-up reaction and no review, so the wait reads its summary comment's state; a timeout when Codex never answers.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

### B-405 · bug · Worker database names cut the base to 59 characters, so two worktrees of a long topic (~46+ chars) share their _w<n> copies: concurrent checks DROP each other's databases and rm drops both; keep a short hash of the full base when shortening, and match it in isOwnDatabase and test-db.sh

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (prd/check-speed): Codex P2 on PR #27 (thread PRRT_kwDOVx-WLM66cict); slice 4 named it too. No topic today is that long, so a follow-up.
- 2026-11-21 (prd/check-speed): check-speed is done (2026-11-21); proposed for test-health, whose slice 11 builds on the worker databases. Not urgent: no topic is long enough today.
- 2026-11-21 (Robert Bo Davis): Codex on PR #30 (dev into staging, 2026-11-21, P2, verified by reading the code): a second collision with the same fix. Worktree foo's worker 1 is caretook_test_foo_w1, which is also the base database of a worktree named foo-w1 (stack-lib.sh test_db_name), so foo's integration run drops and replaces it and test-db.sh drop foo deletes it. Put worker databases in a namespace no worktree base can produce, and update isOwnDatabase and test-db.sh's matching. No worktree is named *-w<n> today.

### B-406 · feature · Set priority in the inbox, not the backlog: the user orders a short 'Next up' list in plans/inbox.md (plain lines, no ids or fields) and the dispatcher reads it as the order to plan and run, keeping the PRD table's row order in step; the user opens the backlog only when an agent asks

- status: triaged
- prd: inbox-agent
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Triaged to orchestration-3 (the dispatcher, B-392): it is the thing that picks by registry row order, so the inbox list becomes its input and the row order is derived. Questions reach the user through the asks queue (B-391, orchestration-2). Open for the PRD: what a line names (a topic in plain words, a filed bullet, or both), what happens to topics not listed (keep table order after the listed ones), and how an agent reports a line it cannot match (an ask, never a guess). The inbox stays the user's: agents still only append ids.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-21 (plan/inbox-agent): Planned (2026-11-21): plans/inbox-agent-prd.md and plans/inbox-agent-plan.md, six slices in five waves. B-425: slices 1, 3 and 5 (a pickup that never stops on the inbox, inbox lines written to origin/dev, the inbox session). B-435: slices 2 and 3 (look-alikes before filing, archiving by the cleanup run). B-406: slices 4, 5 and 6 (the Next up list, its edit commands and queue, the dispatcher following it).

### B-407 · feature · Recover by itself and land safely: a launchd job runs pnpm prd recover --wait at login and when work is recorded as running but no session is alive; the dispatcher slows down before a usage limit (starts no slice or planner, drains); a landing or migration cut off halfway leaves a step-in-progress marker so the resumed session finishes or undoes it

- status: triaged
- prd: self-recovery
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Asked for by the user 2026-11-21 (crash and usage-limit recovery felt risky). Triaged to orchestration-3: the dispatcher owns recovery ('recovery restarts the dispatcher') and the hot file scripts/loops/recover.sh. No new dependency. Open for the PRD: how the dispatcher learns it is near a usage limit (no known signal today; a probe like recover --wait's claude -p ok only sees the limit once hit), which landing steps need a marker (the merge, the push, backlog done, rm), and that launchd must not start a second recover or dispatcher. Not picked by the user, so not filed: a script-level phone alert with a heartbeat (needs a push service), pushing prd/ and slice/ branches to origin as they go, a recovery drill.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-21 (plan/orchestration-3): From the orchestration-3 planner: the dispatcher there does nothing about a usage limit (the user pauses and resumes it). Detecting one, pausing, and replacing stalled managed sessions when it lifts are this topic's; rotate --mid-wave is the user's word only and refuses an uncommitted Status, so it needs its own path.

### B-408 · feature · Stuck workers handled by the orchestrator: it tracks how long its commands and slice agents have run against their usual time, stops and restarts a stuck one on its own judgement (once), and for a judgement call asks a fresh skeptic agent first and the user through the asks queue only if that doesn't settle it

- status: triaged
- prd: worker-watch
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Asked for by the user 2026-11-21: unsticking workers is manual work they do often. Triaged to orchestration-3 (hot file scripts/loops/prompt.sh; the dispatcher reopens dead sessions, this covers live-but-stuck ones; asks from B-391). Exists today: browser checks have a 90 s silence limit, a cap and one contention retry (loop.md, Limits); pnpm prd check is timed in .loops/.check-times.log; nothing covers a hung pnpm check, a slice agent that has gone quiet, or a helper subagent. Proposed shape: (1) every long command runs with a budget from its usual time (check-times medians, scaled for load) and a silence limit, and a breach is reported with its last output, not just killed; (2) the orchestrator records each slice agent's start and last sign of progress (commit, file change in its worktree, message) and on no progress messages it, then restarts it once with --continue; (3) a second stall, or a stop that could lose work (uncommitted changes, a migration or landing step under way), is a judgement call: a fresh skeptic agent reads the evidence and decides, and files an ask with a recommendation only when it can't or the step is risky; (4) pnpm prd status shows each running command's and agent's age against its usual time. Open for the PRD: the thresholds, and whether the dispatcher's tick does the watching so an orchestrator that is itself stuck is caught. Could be its own small topic if orchestration-3 passes about six slices (it now has B-392, B-404, B-406, B-407 and this).
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

### B-411 · bug · A session opened again under the same name while the first still runs gets marked ended when the first exits: session.sh writes ended and exit without checking the record is still its own

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Codex on PR #30 (dev into staging, 2026-11-21, P2, verified by reading scripts/loops/session.sh: the last line records ended/exit unconditionally, and the start write replaces pid). Effect: sessions.mjs live fails and pnpm prd end <name> says not running for the newer live session. Fix: refuse a start while the recorded pid is alive, or write the end only when the record's pid is still this wrapper's child. Proposed for orchestration-2, which added recorded sessions (slice 2) and is still open as PR #29; needs two overlapping opens of one name, so not urgent.

### B-412 · bug · plus button on timeline day header should be on far right so all actions are on right. Care period…

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): From the inbox: plus button on timeline day header should be on far right so all actions are on right. Care period can swap with it. change link which adds care period can be an icon button.
- 2026-11-21 (Robert Bo Davis): Triage: a small layout fix on one screen, so the standing UI fixes topic (fixes-ui).
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.

### B-413 · bug · don't collapse past providers on list providers page, it breaks search and isn't needed. This list…

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): From the inbox: don't collapse past providers on list providers page, it breaks search and isn't needed. This list will never be THAT long.
- 2026-11-21 (Robert Bo Davis): Triage: a small layout fix on one screen, so the standing UI fixes topic (fixes-ui).
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.

### B-414 · feature · animations are cool. add some to actions, hovers, etc... be classy about it. For instance the…

- status: landed
- prd: ui-kit-2
- owner: prd/ui-kit-2
- commit: 0c776958

- 2026-11-21 (prd/orchestration-2): From the inbox: animations are cool. add some to actions, hovers, etc... be classy about it. For instance the expand carat on the timeline today header animates, the expand on the day summary does not. search toggle should animate, etc...
- 2026-11-21 (Robert Bo Davis): Triage: an app-wide look change (app.css, the ui/ primitives), which ui-kit holds as hot files while it runs; proposed for ui-kit-2, the follow-up written after ui-kit lands. The font choice needs the user's pick when it is planned.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): planned in plans/ui-kit-2-plan.md. Slices: 1 Button (B-423), 2 the header add button (B-420, B-419), 3 medication tabs and add menu (B-424), 4 the typeface (B-415), 5 motion (B-414), 6 the choice dialog (B-268).

### B-415 · feature · choose a more modern font set.

- status: landed
- prd: ui-kit-2
- owner: prd/ui-kit-2
- commit: 7a3fff2f

- 2026-11-21 (Robert Bo Davis): Triage: an app-wide look change (app.css, the ui/ primitives), which ui-kit holds as hot files while it runs; proposed for ui-kit-2, the follow-up written after ui-kit lands. The font choice needs the user's pick when it is planned.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): planned in plans/ui-kit-2-plan.md. Slices: 1 Button (B-423), 2 the header add button (B-420, B-419), 3 medication tabs and add menu (B-424), 4 the typeface (B-415), 5 motion (B-414), 6 the choice dialog (B-268).
- 2026-11-22 (slice/ui-kit-2/4): ui-kit-2 slice 4 (1efa71ca): Atkinson Hyperlegible Next 2.001 vendored in apps/web/app/fonts/ (48 KB upright + 53 KB italic woff2, OFL), --font-sans in app.css, preload in root.tsx, precached by the service worker; no wraps at 320/420.

### B-416 · bug · owner pill on planner/planner list should be below time/date field. Too busy under title.

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Triage: a small layout fix on one screen, so the standing UI fixes topic (fixes-ui).
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.

### B-417 · feature · We are getting close to feature complete. We need another marketing content pass that updates copy…

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: We are getting close to feature complete. We need another marketing content pass that updates copy and layout to reflect the new features. Also improve ui to meet modern design standards. NO SCREENSHOTS yet. No videos.
- 2026-11-21 (Robert Bo Davis): Triage: marketing topic (on hold). A copy and layout pass for the new features plus a design refresh; no screenshots or videos, so it does not wait on B-40.

### B-418 · bug · Flaky tooling test under load: recover.test.mjs '--at a time that has passed waits until tomorrow' fails in the full pnpm test:tooling run and passes alone

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Seen 2026-11-21 about 17:20 PT in a full pnpm test:tooling run on dev (1 of 495 failed) with load averages 19 to 30; the file alone passed 3 of 3 (22 tests each). The assertion output was not captured. Likely a timing or wall-clock dependence (the case compares against the current time); reproduce under load, then fix the race rather than rerun. Proposed for test-health, which holds the flaky-test work.

### B-419 · bug · on providers page, import from another group is too wordy. Import icon is fine. It is for power…

- status: landed
- prd: ui-kit-2
- owner: prd/ui-kit-2
- commit: 0c776958

- 2026-11-21 (Robert Bo Davis): From the inbox: on providers page, import from another group is too wordy. Import icon is fine. It is for power users anyway. Move the add button (just a + icon) and import icons to the right side of the header. Add is primary, import is secondary. and they should be similarly sized/styled.
- 2026-11-21 (Robert Bo Davis): Triage (backlog session): waits on the single Button component (B-423) and the standard header add button (B-420: a + icon top right, secondary buttons to its left), so it is planned with them in ui-kit-2 rather than as a lone fixes-ui slice.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): planned in plans/ui-kit-2-plan.md. Slices: 1 Button (B-423), 2 the header add button (B-420, B-419), 3 medication tabs and add menu (B-424), 4 the typeface (B-415), 5 motion (B-414), 6 the choice dialog (B-268).

### B-420 · bug · planner add button can just be a plus icon. Maybe wait on button component. every main page header…

- status: landed
- prd: ui-kit-2
- owner: prd/ui-kit-2
- commit: 0c776958

- 2026-11-21 (Robert Bo Davis): From the inbox: planner add button can just be a plus icon. Maybe wait on button component. every main page header can have a + icon button in the top right of header to add a new item. other secondary buttons should be to left of the + button.
- 2026-11-21 (Robert Bo Davis): Triage (backlog session): waits on the single Button component (B-423) and the standard header add button (B-420: a + icon top right, secondary buttons to its left), so it is planned with them in ui-kit-2 rather than as a lone fixes-ui slice.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): planned in plans/ui-kit-2-plan.md. Slices: 1 Button (B-423), 2 the header add button (B-420, B-419), 3 medication tabs and add menu (B-424), 4 the typeface (B-415), 5 motion (B-414), 6 the choice dialog (B-268).

### B-421 · bug · type pill on medication list items should float right.

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Triage (backlog session): a small look/flow fix on one screen with no dependency on the Button work: fixes-ui by the category rule.

### B-422 · feature · In providers list page, contact links in rows make it too hard to know what to click. Make those…

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: In providers list page, contact links in rows make it too hard to know what to click. Make those clickable in the details sheet and remove the information from the rows. Most of the time we want notes open during contact anyway.
- 2026-11-21 (Robert Bo Davis): Triage (backlog session): a small look/flow fix on one screen with no dependency on the Button work: fixes-ui by the category rule.

### B-423 · feature · Standardize on single Button design component. Can have options like primary, secondary, danger,…

- status: landed
- prd: ui-kit-2
- owner: prd/ui-kit-2
- commit: a4c2f3c5

- 2026-11-21 (Robert Bo Davis): From the inbox: Standardize on single Button design component. Can have options like primary, secondary, danger, etc. Can have sizes like small, medium, large. Can have variants like icon, text, etc. Can have shape like pill, square, round, etc. use it for every interactive link icon or text button in the app other than header and footer, expand actions, and hamburgers. Ask me if there should be other exceptions.
- 2026-11-21 (Robert Bo Davis): Triage (backlog session): the single Button component is kit work, and ui-kit is mid-run, so it goes to the follow-up kit PRD. The planner asks the user about exceptions beyond header and footer, expand actions and hamburgers.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): planned in plans/ui-kit-2-plan.md. Slices: 1 Button (B-423), 2 the header add button (B-420, B-419), 3 medication tabs and add menu (B-424), 4 the typeface (B-415), 5 motion (B-414), 6 the choice dialog (B-268).

### B-424 · feature · medications page should have passes as a tab, not in header. + button should be a dropdown with add…

- status: landed
- prd: ui-kit-2
- owner: prd/ui-kit-2
- commit: 0c776958

- 2026-11-21 (Robert Bo Davis): From the inbox: medications page should have passes as a tab, not in header. + button should be a dropdown with add selection like other pages. Should probably wait on button component and standardized header add button.
- 2026-11-21 (Robert Bo Davis): Triage (backlog session): waits on the single Button component (B-423) and the standard header add button (B-420: a + icon top right, secondary buttons to its left), so it is planned with them in ui-kit-2 rather than as a lone fixes-ui slice.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): planned in plans/ui-kit-2-plan.md. Slices: 1 Button (B-423), 2 the header add button (B-420, B-419), 3 medication tabs and add menu (B-424), 4 the typeface (B-415), 5 motion (B-414), 6 the choice dialog (B-268).

### B-425 · feature · An inbox agent: a session that helps the user add, categorize and prioritize inbox items, and writes them by pushing straight to origin/dev instead of committing in the local dev checkout, so it never steps on the user's working copy

- status: triaged
- prd: inbox-agent
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21, the user's words: 'when orchestration drops, I'm going to need an inbox agent to help me add, categorize, and prioritize things to the inbox and prevent stepping on local dev checkout by pushing directly to origin.' Proposed orchestration-3: it is a new agent role plus a change to how backlog writes reach dev, beside B-406 (priority set in the inbox) and B-392 (the dispatcher). Agent's reading, unconfirmed: 'pushing directly to origin' means the agent's inbox and backlog writes go to origin/dev without touching the main checkout's files or HEAD; today every pnpm backlog write edits and commits in the main checkout. To settle in planning: how the local checkout picks the changes up, and whether it replaces this backlog session or sits beside it.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-21 (plan/inbox-agent): Planned (2026-11-21): plans/inbox-agent-prd.md and plans/inbox-agent-plan.md, six slices in five waves. B-425: slices 1, 3 and 5 (a pickup that never stops on the inbox, inbox lines written to origin/dev, the inbox session). B-435: slices 2 and 3 (look-alikes before filing, archiving by the cleanup run). B-406: slices 4, 5 and 6 (the Next up list, its edit commands and queue, the dispatcher following it).

### B-429 · change · Asks queue hygiene: reports that go stale are re-checked or expire, answered asks are archived, and an ask whose session has died still reaches the user

- status: triaged
- prd: asks-relay
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Report a3 still says the fixes topics are on hold though the registry disagrees; asks.mjs has --done but no expiry or archive; a push needs a live session (a push service was out of scope for orchestration-2).
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-21 (plan/inbox-agent): Moved out of inbox-agent by its planner (2026-11-21) to keep that PRD at six slices; the new topic asks-relay sits in the row after it. Planner's sketch for the next planner, none of it decided: (1) pnpm prd ask gains how blocking the question is (blocked now, blocked soon, not blocking), stated by the asker; (2) a pure ranking of open asks from the session records, worktrees and registry (is the asker live and waiting, does it hold a slot, is a topic queued behind it), shown by pnpm prd asks; (3) each ask records when it was relayed and when the phone was pushed, and the backlog session marks itself live and the user active, so a push goes out only for a blocked-now question the user hasn't seen; (4) the fallback with no go-between live: after some minutes the waiting command tells its asker to push for itself, and the dispatcher's helper pushes for an asker that has died; (5) every prompt but the backlog and inbox sessions files and waits instead of asking in its tab; (6) hygiene: reports expire after a few days and the go-between re-checks an old one against pnpm prd status before showing it, answered and dismissed asks move to an archive folder after a day with ids never reused and still found by id (the dispatcher reads answers by id), a reopened session lists its topic's answered asks. The two questions B-467's note names for its planner (the fallback, and a question already settled by preferences) are still open: both look cheap to change, so the handbook's list says decide them.

### B-430 · feature · Codex findings on a PRD pull request become backlog items by tool: verified against the code, duplicates noted on the existing item, as B-404 does for the staging PR

- status: triaged
- prd: staging-ship
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Today orchestrator.md step 4 has the orchestrator file them by hand. Could share code with B-404.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

### B-431 · chore · A finished PRD gets its done flag without rm: set it at the last landing or in pnpm prd tidy (check-speed still reads planned with nothing waiting)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. rm.sh sets done only when the worktree is removed; B-403 lists done rows as leftovers but does not say it sets the flag. Small tooling fix.

### B-432 · chore · After a landing that changes the lockfile, pnpm prd land runs pnpm install in the main checkout (or files an ask) instead of only printing a reminder

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. land.sh and ready.sh print the reminder; an unattended landing leaves the main checkout stale. Needs care: the main checkout is the user's. Small tooling fix.

### B-433 · feature · A usage-limit signal and a cost record: sessions detect an approaching usage limit so the dispatcher can drain (B-407 assumes one), and tokens or cost are recorded per PRD and slice

- status: triaged
- prd: self-recovery
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Nothing detects a limit or records cost today; orchestrator.md only documents the model per role.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

### B-434 · feature · Run metrics beyond check times: slice and landing durations, flake rate and how often Codex finds something, in one summary command

- status: triaged
- prd: worker-watch
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Only .loops/.check-times.log and pnpm prd check --times exist; B-408 needs usual times to spot a stuck worker.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

### B-435 · feature · Filing checks for duplicates (similar open or archived titles shown before an item is added) and finished items are archived without a hand run

- status: triaged
- prd: inbox-agent
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. backlog doctor finds duplicate ids only; pnpm backlog archive is manual (B-403 mentions it). Fits the inbox agent B-425.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-21 (plan/inbox-agent): Planned (2026-11-21): plans/inbox-agent-prd.md and plans/inbox-agent-plan.md, six slices in five waves. B-425: slices 1, 3 and 5 (a pickup that never stops on the inbox, inbox lines written to origin/dev, the inbox session). B-435: slices 2 and 3 (look-alikes before filing, archiving by the cleanup run). B-406: slices 4, 5 and 6 (the Next up list, its edit commands and queue, the dispatcher following it).

### B-436 · feature · A to-test report for a staging ship, like the landing reports of B-410

- status: triaged
- prd: staging-ship
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. B-410 left it undecided as a follow-up; belongs with B-404 (ship dev to staging).
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

### B-437 · change · Record backlog, hotfix and recovery sessions like orchestrator sessions, so pnpm prd status shows them and they can be reopened

- status: triaged
- prd: agent-autonomy-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Deferred in the orchestration-2 plan with no item.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-22 (Robert Bo Davis): 2026-11-22: moved from self-recovery (held) to agent-autonomy-2: handing off backlog and inbox sessions needs them recorded like orchestrator sessions.

### B-438 · plan · Headless orchestrator sessions: runs that need no terminal tab, so a helper cannot outlive or die with its window

- status: triaged
- prd: self-recovery
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Deferred in the orchestration-2 PRD with no item; a large idea, may deserve its own topic.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

### B-440 · bug · pnpm prd tidy --yes: a database for a topic ending -w1..-w16 reads as an orphan worker copy and is dropped

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Codex P1 on PR #33 (tidy-cli.mjs:158), verified in code: the worker-copy label from test-db.sh list overrides the known owner. Match names against known worktree bases and their worker names first. No such topic exists today.

### B-441 · bug · pnpm prd tidy: a missing or failing lsof reads as no process in any worktree, so --yes can remove an active one

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Codex P2 on PR #33 (tidy-cli.mjs:52), verified in code: a failed run is an empty list. Treat an unavailable inspection as unknown and keep worktrees. macOS always has lsof.

### B-442 · bug · pnpm prd tidy --yes deletes dead leases from its earlier snapshot without lease.sh's takeover mutex and fresh liveness check

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Codex P2 on PR #33 (tidy-cli.mjs:259), verified: plain rmSync on the lease path; a lease retaken in between is deleted. Use lease_take_over's .takeover protocol.
- 2026-11-21 (Robert Bo Davis): Codex raised this again as a P2 on PR #34 (dev into staging, head f5234c8); checked against dev: the code is unchanged, so this item covers it. No new item filed.

### B-443 · bug · land.sh to-test file lists no items after a local landing: items are already landed, not ready, once dev has the merge

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Codex P2 on PR #33 (land.sh:140): capture the ready items before the merge and reuse them in the report. The PR path is unaffected only if the backlog read precedes dev-sync; check both.
- 2026-11-21 (Robert Bo Davis): Codex raised this again as a P2 on PR #34 (dev into staging, head f5234c8); checked against dev: the code is unchanged, so this item covers it. No new item filed.

### B-444 · bug · docs_only counts a code file renamed to .md as docs only (git diff --name-only shows only the rename's destination)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Codex P2 on PR #33 (lib.sh:137), verified in code: use --no-renames (or --name-status both sides) so a .sh→.md rename keeps the Codex verdict and the to-test file.

### B-445 · bug · Agents wait on checks with `until ! pgrep -f "prd check"`, which never exits: it matches its own shell and every orchestrator whose prompt mentions `pnpm prd check`

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/simple-mode): Found 2026-11-21: a simple-mode slice 1 loop left one spinning 76 min after hand-off (killed); ui-kit and orchestration-2 sessions had similar long-lived shells (not inspected). Fix: loop.md says to wait on the check lease (pnpm prd status, or a prd wait helper), never pgrep -f; optionally a prd command that blocks until a lease frees.

### B-446 · bug · browser.test.mjs 'kills a spec at its cap, worker and all, and retries it once' fails under heavy load (load 47), passes alone 3x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Seen in orchestration-2 wave 5's quick check on b7541467 (2026-11-21): expected false to be true after 9.7 s. Real-time sleeps; make it wait on the event, not the clock.

### B-447 · bug · to-test file: 'What wasn't checked' repeats the quick-check line, and a tooling-only landing still gets the app's dev URL and seed sign-ins under 'What to try'

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Seen on the first real file, to-test/2026-11-21-1838-orchestration-2.md (orchestration-2 wave 5). For a diff that is only scripts/ and docs, name the commands to try instead.

### B-448 · chore · Rename the profile's *Card components and files (ProfileCards.tsx, ConditionsCard, DetailsCards, EmergencyCard, VitalAveragesCard) now that they render bands, not cards

- status: triaged
- prd: ui-kit-3
- owner:
- commit:

- 2026-11-21 (prd/ui-kit): From ui-kit slice 7: kept the names to keep the diff small.
- 2026-11-21 (plan/ui-kit-2): ui-kit-2 plan (2026-11-21): moved to the follow-on ui-kit-3 (ui-kit-2 is six slices without them). B-448 belongs in the profile area's sweep slice.

### B-450 · bug · Flaky under load: roles.int.test.ts beforeAll (applyRoles) times out at the 10s hookTimeout in a full check at load ~130; passes alone 3x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/ui-kit): Seen in ui-kit's wave 4 full check, 2026-11-21. Give the hook a longer timeout or share the generated roles.
- 2026-11-22 (prd/fixes-bug): fixes-bug wave 2 full check (2026-11-22, load ~13): roles.int.test.ts beforeAll hookTimeout again, alone in an otherwise green run (5641 passed).
- 2026-11-22 (prd/fixes-bug): fixes-bug (2026-11-22): now fails alone 3/3 at low load. Cause: rolesSummary (applyRoles.ts) runs a correlated NOT EXISTS between information_schema.column_privileges and role_table_grants, ~2.2 s per role (3 roles, more than once), past the 10 s hookTimeout. Stopgap on prd/fixes-bug: vi.setConfig 60 s hook/test timeouts in roles.int.test.ts (passes alone 3/3). The real fix (query pg_catalog, or drop the correlation) is still open here.
- 2026-11-22 (prd/ui-kit-2): Again in ui-kit-2's wave-1 full check (2026-11-22, load ~11): roles.int.test.ts hook timed out at 10s.

### B-451 · bug · Tooling-only landings run no eslint: the check gate's 'none needed' (Markdown, scripts/loops, scripts/backlog, .githooks) lets a lint error into dev, and every synced branch's full check then fails

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Seen 2026-11-21: orchestration-3 wave 1 (e015a74) brought a no-useless-assignment in scripts/loops/sessions.test.mjs:248 into dev; fixed in PR #39 (12628b9e). Fix idea: 'none needed' still runs eslint + prettier on the changed tooling files (pnpm test:tooling's step, or the gate requires it).

### B-452 · bug · Dispatcher: a start or plan whose new.sh fails after making the worktree leaves it with no managed record, so later ticks treat it as opened by hand and it holds a slot for good

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #39 (dispatch.mjs:408, r4655894803), verified: writeRecord comes after the new.sh break. Fix: write the managed record (setup state) before new.sh, or remove the partial worktree on failure.
- 2026-11-21 (prd/orchestration-3): orchestration-3 ends with wave 3: this Codex follow-up on dispatch.mjs moves to fixes-tooling

### B-453 · bug · Dispatcher: a 'hold the topic' answer is consumed and the reopen count cleared even when the backlog write fails, so the same tick reopens the session

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #39 (dispatch.mjs:353, r4655894808), verified: updateState deletes asked/reopens regardless of r.ok. Fix: only consume the answer and the count after the hold is written; otherwise skip the topic and retry.
- 2026-11-21 (prd/orchestration-3): orchestration-3 ends with wave 3: this Codex follow-up on dispatch.mjs moves to fixes-tooling

### B-454 · bug · Dispatcher lock: two dispatchers starting together over a stale lock can both take it (the takeover unlinks the path from an earlier pid read)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #39 (dispatch.mjs:200, r4655894813), verified: takeLock unlinks unconditionally after reading a dead holder; Codex reproduced 6/30. Fix: atomic takeover (rename a temp lock over it and re-read, or a mkdir lock).
- 2026-11-21 (prd/orchestration-3): orchestration-3 ends with wave 3: this Codex follow-up on dispatch.mjs moves to fixes-tooling

### B-455 · chore · Drop the old per-member simple mode columns (simple_mode, simple_mode_locked) once Easy roles replace them

- status: triaged
- prd: contract-migrations
- owner:
- commit:

- 2026-11-21 (slice/fixes-nit/2): Contract step for simple-mode (plans/simple-mode-plan.md line 121: slice 3 moves locked caretakers to easy_helper, locked viewers to easy_viewer and takes the two columns out of Drizzle reads and writes, sync, device schema and grants, leaving them for a later contract migration). Columns: care_group_member.simple_mode and simple_mode_locked (migration 0021_simple_mode.sql; schema packages/data/src/db/schema/care-groups/careGroupMember.ts:64-65). Today (2026-11-21) still read and written: packages/api/src/care-groups/careGroup.ts:194-223 (setMemberMode), packages/data/src/permissions/care-groups.ts:48-49, careGroupMemberService. Precondition: simple-mode slices 1-3 landed in dev and the conversion has run on staging and production; then a drop migration (expand/contract, adds a migration: run it alone). Also check care_group.simple_tiles stays (still used by group settings) and the user_preferences simpleMode key.
- 2026-11-21 (prd/simple-mode): 2026-11-21 (prd/simple-mode landed, PR #44, bd13f73): the conversion is migration 0036. Retired and now unread everywhere: care_group_member.simple_mode, simple_mode_locked AND care_group.simple_tiles (replaced by easy_tiles, 0034) and the user.preferences.simpleMode key (copied to easyMode). setMemberMode/setMode are deleted. care_group and care_group_member are in REPLICATION_WHOLE_TABLES only because of these retired columns: drop them from that list in the contract migration.

### B-456 · chore · Retire the leftover reminder data planner-2 left in place: the note kind on appointment_series and stored future notes and note series

- status: triaged
- prd: contract-migrations
- owner:
- commit:

- 2026-11-21 (slice/fixes-nit/2): Contract step for planner-2 (plans/planner-2-plan.md line 48: nothing dropped; no data migration; stored future notes and note series left, hidden from upcoming readers and never topped up). Still in schema: appointment_series.kind with check appointment_series_kind_check (packages/data/src/db/schema/appointments/appointmentSeries.ts:43-86; new series are events only via the z.literal at line 177) and note series rows; timeline_entry.all_day and series columns and reminder_override / member_calendar_setting are NOT dead: events and appointment reminders still use them (timelineEntry.ts:121-142, reminderOverrideService in packages/api/src/calendars/overrideProcedures.ts, calendarFeedService), so do not drop those. Decide: delete or convert the stored note series and future-dated notes (a data migration; staging only has test data), then drop the kind column and its check or narrow the check to event. Precondition: planner-2 landed (it is) and no reader of kind=note remains (grep sync.ts, seriesVisits, appointmentSeriesService); migration, run it alone.

### B-457 · chore · Give groups that predate the default medication passes (Morning 08:00 and Evening 20:00) their two passes

- status: triaged
- prd: contract-migrations
- owner:
- commit:

- 2026-11-21 (slice/fixes-nit/2): medications-2 (plans/medications-2-plan.md line 38) creates the default passes for every new group through one helper (careGroupService.create, accessCodeService, staffGroupService) and says: no backfill for existing rows (dev data only). Staging has been live since 2026-11-20, so any group created before that change has no passes and medications moved to passes have no pass. Check staging with a query on medication_pass per care_group; if groups lack them, add a data migration (or one-off script) that inserts the two defaults per group with none, idempotent, and moves medications without a pass onto them. Precondition: confirm count of groups without passes on staging; production has none yet, so only staging needs it.

### B-458 · chore · Backlog: let set and note change archived items (a fix to an archived item's topic, title, commit or note is refused, so the hygiene fixes for B-206, B-208, B-88, B-222 can't be made)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (slice/fixes-nit/3): From B-380 (fixes-nit slice 3), 2026-11-21: the wanted changes are B-206 status=dropped (duplicate of B-205, both fixed by 56b50a96); B-208 prd=quick-fixes owner=hotfix/simple-mode (landed as hotfix 4e5e0187); B-88 commit=59d382f9 (feat(orchestration): queue PRDs for a free slot, landing modes, planning sessions); B-222 title 'Tasks become todos, and Upcoming and Todos merge into the Planner (tabs Planner, Todos, Past)' (built in 2db975a7); plus notes on B-205, B-206, B-208, B-88, B-222. All five are archived, and set and note answer 'is archived; it can't be changed here'. Either an --archived flag on set and note, or an unarchive command. B-247 needs nothing: it landed in 5a5c2fd6 (planner-2 wave 2), so 'triaged and unowned' is stale.

### B-459 · chore · Backlog: 151 items read 'live' because the dev-into-staging-into-main release merge (cc3e1d8b, B-33) put their commits on origin/main, though production hasn't launched; give live a real meaning (a production marker such as a tag or a recorded deploy) or show main as staging until launch

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (slice/fixes-nit/3): From B-380 (fixes-nit slice 3), 2026-11-21: status is derived (scripts/backlog/format.mjs derive: containing origin/main means live) and recomputed on every write, so a hand or bulk set of live items back to staging would be undone, and archived items can't be set at all. Not changed here. Option: derive live from a production tag or deploy record instead of origin/main; the status words in docs/agents/backlog.md follow.

### B-460 · bug · Flaky under load: tidy-cli.test.mjs beforeAll/hook times out at 10s in pnpm test:tooling at load ~20 (4 tests); passes alone 3x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): seen on prd/orchestration-3 at wave 3's landing, 2026-11-21; load 19-21 on 10 cores

### B-461 · bug · tidy-cli.test.mjs fails as a whole file under heavy load (load about 30) in pnpm test:tooling, passes alone 3x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (hotfix/reseed-staging): Seen 2026-11-21 on hotfix/reseed-staging (a8c39d78), which does not touch scripts/loops/: 1 failed file of 45, 638 tests passed, the failure at file level (no test named), with the 1-minute load near 32. Alone it passed three times in 7 to 9 s. Same family as B-446 (browser.test.mjs under load).

### B-462 · bug · pnpm prd recover reopens the dispatcher even when a test-Postgres, stack or server step failed, so it can reopen managed sessions on broken infrastructure

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (recover.sh:220), verified: the dispatch action ignores failed[]; gate it like after_infrastructure and keep the intent for the next run

### B-463 · bug · pnpm prd recover after a crash loses the dispatcher's restart intent when its reopen fails: clear-lock deletes the stale lock first, and no record is kept

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (recover.sh:220), verified: persist the intent before clearing the lock, drop it after a good start

### B-464 · bug · The backlog prompt's hold line (pnpm backlog prd set <topic> flags=hold) replaces the row's flags, dropping standing or alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (prompt.sh:30), verified: setRow replaces the flag list; tell it to keep the current flags, or give prd set an add/remove form

### B-465 · bug · pnpm prd down keeps stopping servers, stacks and the test Postgres when the dispatcher won't stop in time (mid new.sh), racing a start against the shutdown

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (down.sh:50), verified: failed=1 but the loop goes on; stop there and keep the down record for a retry

### B-466 · bug · resetStaging.int.test.ts 'wipes everything but real sign-ins, reseeds' times out at 30 s under load (passes alone in 3-10 s)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/fixes-bug): Seen in fixes-bug slice 10's quick check 2026-11-21, 5-min load ~11-16; passed 3/3 alone. Raise its timeout or lighten the reseed.
- 2026-11-22 (prd/ui-kit-2): Again in ui-kit-2's wave-1 full check (2026-11-22, load ~17): timed out at 30 s.
- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-467 · feature · The backlog session is the go-between for every agent's questions: agents file to the asks queue and wait, the backlog session ranks them by how soon an answer blocks real work, asks the user itself and decides which ones ping the phone

- status: triaged
- prd: asks-relay
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): User, 2026-11-21 (backlog session): the user keeps a backlog session (fable) and an inbox session (opus) running while available, and handles their context and restarts. Agreed shape: the asks queue is the transport, not a broadcast message (a broadcast misses agents started later and is lost over a restart). Prompts change so no agent pushes or asks in its own tab, by-hand 'asks first' sessions included: all file with pnpm prd ask and wait. The asker states how blocking the ask is (blocked now, blocked soon, not blocking); the backlog session checks that against pnpm prd status (is the session waiting, does it hold a slot, is a planner or topic queued behind it). On startup it reads the open questions, ranks them and asks whether the user is free to answer; it watches the queue after that. Phone push only for blocked-now asks when the user hasn't been active in the backlog session; the rest are batched into the next poll, reports as a digest with no push. It relays the question and options verbatim, records the answer with pnpm prd answer and never answers for the user. Planner to ask the user: (1) the fallback when no backlog session is live or a blocking ask goes unanswered (proposed: the ask pushes itself as today, after some minutes); (2) a question already settled by docs/agents/preferences.md or an earlier answer: one-tap confirm (proposed) or answered outright. Sits with B-425 (the inbox agent) and B-429 (asks queue hygiene). Triage: tooling feature on the asks queue and the backlog prompt, the inbox-agent topic's hot files.
- 2026-11-21 (plan/inbox-agent): Moved out of inbox-agent by its planner (2026-11-21) to keep that PRD at six slices; the new topic asks-relay sits in the row after it. Planner's sketch for the next planner, none of it decided: (1) pnpm prd ask gains how blocking the question is (blocked now, blocked soon, not blocking), stated by the asker; (2) a pure ranking of open asks from the session records, worktrees and registry (is the asker live and waiting, does it hold a slot, is a topic queued behind it), shown by pnpm prd asks; (3) each ask records when it was relayed and when the phone was pushed, and the backlog session marks itself live and the user active, so a push goes out only for a blocked-now question the user hasn't seen; (4) the fallback with no go-between live: after some minutes the waiting command tells its asker to push for itself, and the dispatcher's helper pushes for an asker that has died; (5) every prompt but the backlog and inbox sessions files and waits instead of asking in its tab; (6) hygiene: reports expire after a few days and the go-between re-checks an old one against pnpm prd status before showing it, answered and dismissed asks move to an archive folder after a day with ids never reused and still found by id (the dispatcher reads answers by id), a reopened session lists its topic's answered asks. The two questions B-467's note names for its planner (the fallback, and a question already settled by preferences) are still open: both look cheap to change, so the handbook's list says decide them.

### B-468 · bug · open-session.sh fails when iTerm2 has windows but no current window: the dispatcher counts it as a planner death

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Found 2026-11-21 by the backlog session (asks a16, a18). scripts/loops/open-session.sh:79 takes 'current window' when (count of windows) > 0; iTerm2 returns missing value there (app hidden, windows minimized, no key window), so osascript exits 1 with 'Can't get current tab of missing value (-1728)'. Between 02:50Z and 02:56Z this failed six times: plan-inbox-agent and plan-ui-kit-2 never opened, were each counted as died after 2 reopens, and their empty plan worktrees then blocked every other planner; the dispatch push failed the same way. Fix: fall back to the first window or create one when current window is missing value; and have the dispatcher tell 'the tab never opened' from 'the session died' (no reopen count, no blocking worktree). fixes-tooling: scripts.

### B-469 · bug · Easy roles' read-only search sheets (provider, medication, condition) show the values captured when tapped and miss edits or deletes that sync in while open

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 3114a864

- 2026-11-21 (prd/simple-mode): Codex P2 on PR #44 (simple-mode), verified: SearchResults.tsx keeps the whole item in useState (opened); useSearchPage refreshes data but not that copy, and EasyResultSheet watches no row. Fix: store { type, id }, read the row from the refreshed data (or a live query), close or say gone when deleted; component test with a synced edit.

### B-470 · bug · An Easy helper can undo a writer's cancellation or reschedule of their own event by sending the setup fields as null (update API or sync upload)

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 3114a864

- 2026-11-21 (prd/simple-mode): Codex P2 on PR #44 (simple-mode), verified: timelineEntryService.update's refuseLoggerOnly calls canLogEntry (entryRules.ts), which only checks ENTRY_SETUP_FIELDS are null, so { cancelledAt: null, cancelReason: null, rescheduledTo: null } passes and the ownership check passes on their own event. Fix: on update, an Easy helper may not change any setup field from its existing value (clearing included); integration test via the service and an upload.
- 2026-11-22 (Robert Bo Davis): Codex flagged this again on PR #48 (dev→staging, P2, entryRules.ts:39); B-483 was filed as its duplicate and dropped.

### B-471 · feature · Overlay motion: menus, popovers, dialogs and toasts fade in and out, and a sheet closes with the reverse of its opening

- status: triaged
- prd: ui-kit-3
- owner:
- commit:

- 2026-11-21 (plan/ui-kit-2): From the ui-kit-2 plan (2026-11-21), the part of B-414 cut by its skeptic pass: ui-kit-2 slice 5 animates buttons, rows, chevrons and Collapse only. Route sheets close by navigating, so the route unmounts before an exit can play: a sheet's exit needs the navigation delayed. Uses ui-kit-2's motion variables; nothing under reduced motion.

### B-472 · bug · A device's offline-queued simpleMode setting change, left from before the easy rename, is retried forever and takes later queued settings changes down with it

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 3114a864

- 2026-11-21 (prd/simple-mode): Codex P2 on PR #44 (simple-mode), verified: lib/app-shell/me.ts readPending returns the stored caretook:settings-pending: payload as is; me.updatePreferences' strict schema now rejects simpleMode and clearPending no longer removes it. Fix: in readPending, map simpleMode (simple→easy, group→drop) to easyMode or drop it before sending; unit test. Only matters for devices that queued the change offline before the upgrade (none live today).

### B-474 · change · Inbox agent plan amendments from the user: it never leaves staged or uncommitted changes behind (stash, or commit and push), and someone is named as owning cleanup of completed items

- status: triaged
- prd: inbox-agent
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): The user's answers to the inbox-agent planning report (ask a20, 2026-11-21, backlog session). They confirmed the plan (inbox-only pushes to origin/dev with automatic dev-sync; the Next up list; asks-relay after inbox-agent) with two additions, in their words: (1) 'inbox cannot leave staged changes ever. it must either stash or commit/push'; (2) 'inbox agent (or somebody) needs to have responsibility for cleanup of complete items'. For the inbox-agent orchestrator: fold both into the PRD and the slices that own them (B-425 the agent and its pushes; B-406 Next up; B-435 archiving). Backlog session's reading of (2): finished work must not pile up anywhere the user reads, so one named owner removes Next up lines and inbox bullets whose items have landed, as well as archiving tracker items; the plan's cleanup run archives tracker items only. Ask the user if the owner or the scope is unclear.

### B-475 · bug · Flaky component test: timelineSimpleTodos 'a viewer… done-only change' leaves an undo timer (useTodoTick → reopenTodo → liveTodo) that fires after the test's database closes: Unhandled Rejection 'Client has already been closed' fails the run

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/test-health): Seen once in the test-health wave 1 full check (2026-11-22, load 14); the file passes alone 3/3. The undo timeout should be cleared on unmount, or the harness should flush/clear pending timers before closing the database.

### B-477 · change · PRD registry: a hold carries its reason

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): User, 2026-11-21 (backlog session): "we probably need a 'hold reason' field for some of these holds to make them easier to manage in another session that doesn't have this context." Backlog session's sketch, not the user's words: pnpm backlog prd set <topic> flags=hold takes a reason (and a date), prd list, prd status and dispatch --dry-run print it beside 'on hold', and clearing the hold clears it; dispatch --pause already takes a <why>. Reasons for the holds set in this session, to fill in when the field exists: planner-3 (a note can carry a todo) is held because its landed plan must be revised to the user's design first, see the note on B-245; contract-migrations, asks-relay, sync-safety-2, ui-kit-3, code-health-2 and code-health-3 are held only to stop planning from burning model usage (user's pick, 2026-11-21), not for any problem with the topics: release them when the user wants planning to resume.

### B-479 · bug · calendarCron.int.test.ts 'runs the reminders first, then Google push and pull, and the series top-up last by default' times out at 5 s under load (passes alone)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/fixes-bug): fixes-bug landing full check 2026-11-21, 1-min load ~28; passed 3/3 alone. Give it a longer timeout like the other cron tests.
- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-480 · bug · timelineQuickEntry.browser.test.tsx 'the user's units are used, and an explicit unit wins' misses 'Saved 1 entry' under load (passes alone)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/fixes-bug): fixes-bug landing full check 2026-11-21, 1-min load ~28; passed 3/3 alone. Check whether it reads before the save renders (fix the race, not the timeout).

### B-481 · change · Text entry boxes and the default page background are the same color, which is confusing: pick a different color for one or the other (no preference which)

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session on the user's word, 2026-11-21. Triage: fixes-ui (look; a small theme token change). Likely touches apps/web/app/app.css or the ui/ input primitives, which ui-kit-2 lists as hot files: whichever runs second syncs first. The user has no preference for which color changes; the fixer proposes one and checks both themes.

### B-482 · bug · Offline settings change queued under the old simpleMode key is retried forever after the easy-mode rename, and blocks later offline settings changes

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 3114a864

- 2026-11-22 (Robert Bo Davis): Codex P2 on PR #48 (dev→staging), verified: staging's me.ts queues 'simpleMode' under caretook:settings-pending:<user>; dev's strict userPreferencesZSchema rejects it and clearPending no longer removes it, so every refresh resends it and later offline units/layout changes merged in are refused and discarded. Fix: map the pending simpleMode to easyMode (value conversion) or drop it before sending. fixes-bug: wrong behaviour/data. Affects devices upgrading from staging only (nothing live).
- 2026-11-22 (prd/fixes-bug): fixes-bug wave 2: folded into slice 17 with B-472 (same bug).

### B-484 · bug · Flaky under load: staff.browser.test.tsx 'offline, the cached banner shows; it goes at its end time without a reload' sets endsAt to now + 2 s, so a render over 2 s (load ~20) sees the banner already gone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/ui-kit-2): Seen in ui-kit-2 slice 4's quick check (2026-11-22, render 2103 ms at load ~20); passes alone 3x. Fix: a fixed clock or a longer window, not a rerun.

### B-485 · bug · Flaky under load: print.browser.test.tsx 'Next, Previous and This week move it by a week…' reads 2027-06-07 for 2027-05-31 (Matcher did not succeed in time) in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/ui-kit-2): Seen in ui-kit-2's wave-1 full check (2026-11-22, load ~11); passed alone 3x.

### B-486 · bug · Flaky under load: planner.browser.test.tsx 'an item leaves the Planner tab once its end or its start passes' times out at 15 s (it steps 4 h of fake timers); fails alone 3/3 at load ~18, passes 3/3 at ~8

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen by fixes-bug wave 2 full check (2026-11-22). Step the clock in fewer, larger jumps, or raise this test's timeout. Also seen once: search.sync.browser.test.tsx rebuild-under-2-s timing (passes alone 3/3).
- 2026-11-22 (prd/ui-kit-2): Also seen in ui-kit-2's wave-1 full checks (2026-11-22, twice, load ~17); B-487 was its duplicate.
- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-488 · bug · Flaky under load: passes.browser.test.tsx 'adds a pass, last in the list; a taken name (any case) is refused on its field' fails in about 200-330 ms beside other component files (2 of 3 with four files), passes alone 6x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/ui-kit-2): Seen in ui-kit-2's wave-1 gate (2026-11-22, load ~17). Also failing in the same full check, passing alone: provider.browser 'Edit opens the directory's sheet', providers.browser contact rows (B-44 tests), mcp.int 60 calls/min 429.
- 2026-11-22 (slice/ui-kit-2/3): ui-kit-2 slice 3 (71fce0c5): the 'adds a pass' test clicked $('main [data-add-pass]')! once, a read-before-render race (fails in ~200 ms when the button isn't there yet). Rewritten: the add now goes through the header's + menu via found(), and the taken-name message is polled. Likely fixed; watch the next gate.

### B-489 · bug · Flaky under load: Button.browser.test.tsx 'a submit Button submits its form once, however quickly it's tapped' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-490 · bug · Flaky under load: List.browser.test.tsx 'a row with to is one link covering the row; its trailing control is still clickable' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-491 · bug · Flaky under load: primitives.browser.test.tsx 'at 1280, dark > Tooltip: hover and keyboard focus show it…; Escape hides it' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-492 · bug · Flaky under load: search.sync.browser.test.tsx 'about 2,000 entries: the rebuild takes under 2 s, and a query under 50 ms' misses its timing in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-493 · bug · Flaky under load: entryMentions.browser.test.tsx 'a viewer sees mentions as links to the provider's page… and gets no popup' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-494 · bug · Flaky under load: plannerSeries.browser.test.tsx 'renaming, this and later: later visits take the new title' (and once 'a viewer's page asks nothing and offers no Edit') fail in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-495 · bug · Flaky under load: profile.browser.test.tsx Basics, Contact and Insurance sheet tests ('refused on its field… nothing sent') fail in full checks (4 of 7 runs); passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-496 · bug · Flaky under load: provider.browser.test.tsx 'Edit opens the directory's sheet, filled in; Cancel goes back to the page' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-497 · bug · Flaky under load: frame.browser.test.tsx 'a tap on Settings opens /app/settings, which keeps the header and has no group menu' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-498 · bug · Flaky under load: syncAppointmentSeries.int.test.ts 'takes a series and its visits, documents and links from one batch, and again on a replay' times out in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-499 · bug · Flaky under load: syncPasses.int.test.ts 'refuses a viewer, a moved group, and another group's pass' times out at 5 s in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-500 · bug · Flaky under load: appointmentSeries.int.test.ts 'writes visits through today + 90 for a series without them' fails in full checks (2 of 7 runs); passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-501 · bug · Flaky under load: recipientCondition.int.test.ts 'refuses viewers, outsiders and staff, and another group's recipient' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-502 · bug · Flaky under load: search.int.test.ts 'searches a group of 10,000 entries in under 200 ms' reads 210 ms in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.

### B-503 · feature · Default on silence: a question filed with a recommended option takes it by itself after a set wait (about 30 min) unless the user answers; the ask records it was defaulted; never for money, data loss, a live deploy or a destructive step

- status: triaged
- prd: agent-autonomy
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user, after a31 and a33 held test-health and fixes-bug for hours overnight: agents should make their own best choices and coordinate. Overnight a31 (land on passes vs --suite) waited ~6h for the answer it recommended.
- 2026-11-22 (plan/agent-autonomy): Planned in plans/agent-autonomy-prd.md and -plan.md (2026-11-22): B-503 slice 1, B-506 slice 2, B-504 slices 3 and 4, B-505 slices 5 and 6.
- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user, on ask a36's assumption 2: planners' questions default too. A planner's question with a recommendation takes it after 30 minutes of silence like any other; the never-default list still applies. Overrides the plan's 'a planner's questions always wait': the orchestrator updates the PRD and plan.
- 2026-11-22 (plan/agent-autonomy): Amended 2026-11-22 (plan/agent-autonomy): planners' questions default too, in slice 1 (the planner prompt line); the decision row replaced.

### B-504 · feature · Quiet-machine landing check: a landing's full check can claim the machine; the dispatcher and other orchestrators hold new slice starts and checks until it ends or a time limit passes; waiting landings take turns

- status: triaged
- prd: agent-autonomy
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user, after a31 and a33 held test-health and fixes-bug for hours overnight: agents should make their own best choices and coordinate. fixes-bug and ui-kit-2 full checks failed each other on load flakes through the night (load 20+ on 10 cores).
- 2026-11-22 (plan/agent-autonomy): Planned in plans/agent-autonomy-prd.md and -plan.md (2026-11-22): B-503 slice 1, B-506 slice 2, B-504 slices 3 and 4, B-505 slices 5 and 6.

### B-505 · feature · Flake rule replaces asking: when every failing test in a full check passes alone 3/3, rerun only the failed files on a quiet machine; if they pass, land and file each flaky test as a fixes-tooling item, with no question to the user

- status: triaged
- prd: agent-autonomy
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user, after a31 and a33 held test-health and fixes-bug for hours overnight: agents should make their own best choices and coordinate. fixes-bug wave 2 failed 7 full checks on different load flakes, then asked (a33); the user chose land --force, flakes filed. Changes the orchestrator rule 'never --force unless the user says so' for this case only.
- 2026-11-22 (plan/agent-autonomy): Planned in plans/agent-autonomy-prd.md and -plan.md (2026-11-22): B-503 slice 1, B-506 slice 2, B-504 slices 3 and 4, B-505 slices 5 and 6.

### B-506 · feature · Shared notice board: a short list in .loops/ every orchestrator reads at each step and writes heads-ups to (landing now, hold full checks until a time; touching a hot file, sync first); entries expire

- status: triaged
- prd: agent-autonomy
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user, after a31 and a33 held test-health and fixes-bug for hours overnight: agents should make their own best choices and coordinate. For coordination the leases and load gate can't express; no waiting on replies.
- 2026-11-22 (plan/agent-autonomy): Planned in plans/agent-autonomy-prd.md and -plan.md (2026-11-22): B-503 slice 1, B-506 slice 2, B-504 slices 3 and 4, B-505 slices 5 and 6.

### B-507 · feature · Context hook: a Claude Code hook on orchestrator and loop sessions reads the transcript's latest context size after each tool call and, over 160k, tells the agent to finish its step, commit Status and pnpm prd rotate

- status: triaged
- prd: agent-autonomy-2
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: watch agent context and hand off past 160k unless there is a very good reason; fixes-bug's orchestrator was at 208k. Context size is readable from the session transcript (last assistant usage: input + cache read + cache creation).
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-2 by agent-autonomy's planner (2026-11-22): that PRD was already six slices and this work shares no code with it. Planned in plans/agent-autonomy-2-prd.md and -plan.md: B-507 and B-509 slice 1, B-508 slices 1 and 2.

### B-508 · feature · pnpm prd status shows each live session's context size; the dispatcher nudges a session still over the limit after its reminder, then files an ask

- status: triaged
- prd: agent-autonomy-2
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: watch agent context and hand off past 160k unless there is a very good reason; fixes-bug's orchestrator was at 208k. Context size is readable from the session transcript (last assistant usage: input + cache read + cache creation).
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-2 by agent-autonomy's planner (2026-11-22): that PRD was already six slices and this work shares no code with it. Planned in plans/agent-autonomy-2-prd.md and -plan.md: B-507 and B-509 slice 1, B-508 slices 1 and 2.

### B-509 · change · Orchestrator rule: over 160k context, rotate at the next safe point, mid-wave included, without asking; continue only for a step that can't resume from Status (a landing under way), saying why in Status

- status: triaged
- prd: agent-autonomy-2
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: watch agent context and hand off past 160k unless there is a very good reason; fixes-bug's orchestrator was at 208k. Context size is readable from the session transcript (last assistant usage: input + cache read + cache creation). The doc line went onto dev the same day; this item folds it into the hook's wording and tests.
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-2 by agent-autonomy's planner (2026-11-22): that PRD was already six slices and this work shares no code with it. Planned in plans/agent-autonomy-2-prd.md and -plan.md: B-507 and B-509 slice 1, B-508 slices 1 and 2.

### B-510 · bug · Repeating todos: removeUndoneNext returns 'applied' for a viewer's flagged Undo delete before checking the role (the !before?.repeatRule early return precedes canCompleteTodo); nothing changes, but the result misreports

- status: ready
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 5d096ce3

- 2026-11-22 (prd/fixes-bug): From the skeptical review of fixes-bug wave 2 (2026-11-22), verified in packages/data/src/services/todoService.ts removeUndoneNext: move the role check ahead of the early return; unit or integration test with a viewer's flagged delete.

### B-511 · feature · Skeptic before every ask: a session sends its question, options and evidence to a fresh Fable skeptic first; it decides (reversible, within the rules) or confirms the question is the user's; pnpm prd ask records the verdict

- status: triaged
- prd: agent-autonomy-3
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: build the Fable 5.2 skeptic into more of the workflow; Fable reviews in short passes, Opus does the long work. Pairs with B-503 default on silence; a31 and a33 would likely have been decided.
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-3 (to write) by agent-autonomy's planner (2026-11-22): filed after that plan landed with six slices; this builds on its defaulting asks (B-503) and flake rule (B-505).

### B-512 · feature · Skeptic before risky landings: a Fable skeptic reviews the evidence before land --force, landing on flaky tests (B-505) or declining a Codex finding, and the landing report says what it said

- status: triaged
- prd: agent-autonomy-3
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: build the Fable 5.2 skeptic into more of the workflow; Fable reviews in short passes, Opus does the long work.
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-3 (to write) by agent-autonomy's planner (2026-11-22): filed after that plan landed with six slices; this builds on its defaulting asks (B-503) and flake rule (B-505).

### B-513 · change · Opus planners and backlog sessions with a Fable final check: the skeptic pass runs on Fable and may send a plan back; a registry flag (e.g. design) keeps a heavy design topic's planner on Fable

- status: triaged
- prd: agent-autonomy-3
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: build the Fable 5.2 skeptic into more of the workflow; Fable reviews in short passes, Opus does the long work. Last 36h: main-checkout Fable sessions read 428M tokens, Fable planners 148M. The default model moved to Opus on dev the same day; this item adds the flag and the send-back rule.
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-3 (to write) by agent-autonomy's planner (2026-11-22): filed after that plan landed with six slices; this builds on its defaulting asks (B-503) and flake rule (B-505).

### B-514 · feature · Hand off from the phone: in a backlog or inbox session, 'hand off' runs pnpm prd rotate --self: a fresh session of the same kind and name opens (Remote Control, so it shows on the phone) and the old one ends; two modes the user picks: with a short brief of the current session passed to the new one, or with nothing handed over

- status: triaged
- prd: agent-autonomy-2
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: backlog and inbox sessions must hand off to a fresh agent of the same type from the phone, and stay running alongside the dispatcher. The user's words: 'The handoff for both needs two options: share information about current session and no information handoff needed.' No session updates are saved unless the user asks.

### B-515 · feature · Always-on backlog and inbox sessions: the dispatcher keeps one backlog and one inbox session running and reopens a dead one; they don't count against the three PRD slots, and the context watch (B-507) rotates them too

- status: triaged
- prd: agent-autonomy-2
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: backlog and inbox sessions must hand off to a fresh agent of the same type from the phone, and stay running alongside the dispatcher. Needs the inbox agent (B-425, inbox-agent) for the inbox half; until it lands, the backlog session only.

### B-516 · feature · Landing notices before and after: a landing posts a notice when its full check starts (topic, about when, the areas and hot files it touches) and after it merges (the sha, what it touched); an orchestrator that sees a landing coming holds its own full check, syncs after it, and checks once

- status: triaged
- prd: agent-autonomy
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: agents should tell each other before and after merging to dev, and the test gates should loosen by what dev changed, as the Codex verdict carry-over did, to cut the 'dev changed, rerun tests' churn. Added to the planned agent-autonomy on the user's pick: its orchestrator amends the PRD and plan. Builds on the notice board (B-506), which already plans a sync notice after each code landing.
- 2026-11-22 (plan/agent-autonomy): Planned 2026-11-22 in plans/agent-autonomy-plan.md: slice 10 (landing notice at full-check start, landed notice, the hold on an overlapping earlier landing).

### B-517 · feature · A check carries over a dev sync: a passed check stays valid after a merge of dev when every incoming commit landed through a full check, the merge was conflict-free, the sides share no file, and dev brought no migration, seeds, sync-config.yaml, lockfile, package.json or vitest config; the merged tip runs only typecheck, lint and the tests related to both sides' changes (check-plan.mjs); else today's quick

- status: triaged
- prd: agent-autonomy
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: agents should tell each other before and after merging to dev, and the test gates should loosen by what dev changed, as the Codex verdict carry-over did, to cut the 'dev changed, rerun tests' churn. Added to the planned agent-autonomy on the user's pick: its orchestrator amends the PRD and plan. Today land.sh refuses a branch dev has moved past since its last sync, and the new tip's check is stale unless dev brought only Markdown or tooling.
- 2026-11-22 (plan/agent-autonomy): Planned 2026-11-22 in plans/agent-autonomy-plan.md: slice 7 (the verdict module and Checked: trailer), slice 8 (the carried check; tests related to both sides).

### B-518 · change · Land without re-syncing when dev's changes don't touch the branch: land.sh's drift refusal relaxes when dev's new commits share no file with the branch and bring none of the risky files; land still merges dev and typechecks the result, and the landing report says it landed on an unsynced tip

- status: triaged
- prd: agent-autonomy
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: agents should tell each other before and after merging to dev, and the test gates should loosen by what dev changed, as the Codex verdict carry-over did, to cut the 'dev changed, rerun tests' churn. Added to the planned agent-autonomy on the user's pick: its orchestrator amends the PRD and plan. The user chose this too, knowing the risk: changes in different files can still break each other at runtime; typecheck catches some.
- 2026-11-22 (plan/agent-autonomy): Planned 2026-11-22 in plans/agent-autonomy-plan.md: slice 9 (land on an unsynced tip; typegen and typecheck of the merge in a check lease).
