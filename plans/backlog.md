# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

The PRD registry: **row order is the priority**. Edit it only with `pnpm backlog prd` (`add`, `set`, `move`); `pnpm backlog prd list` shows each topic's state (to-write, planned, running, idle, hold, done), worked out from git and the items. At most three PRD orchestrators run at once.

`Flags`: `hold` (waits on the user), `done`, `standing` (never finishes; runs while it has waiting items), `alone` (nothing else runs beside it). `After`: the topics it comes after. `Hot files`: repo path prefixes it shares.

| PRD | Flags | After | Hot files | Doc and notes |
| --- | ----- | ----- | --------- | ------------- |
| `test-gates` | done | — | `.github/workflows/`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `vitest.config.ts`, `scripts/loops/land`, `scripts/loops/check-plan`, `scripts/loops/lib.sh`, `scripts/loops/dispatch`, `scripts/loops/prd.sh`, `scripts/loops/status-extra`, `scripts/backlog/registry` | CI test tiers 0-2, dev red, quarantine, rapid gate, modes (plans/test-gates-prd.md) |
| `fixes-tooling` | standing | `test-gates` | — | plan: plans/fixes-tooling-plan.md, rules: plans/fixes-rules.md |
| `agent-autonomy` | done | `test-gates` | `scripts/loops/land`, `scripts/loops/lib.sh`, `scripts/loops/check-`, `scripts/loops/prompt.sh`, `scripts/loops/prd.sh` | [PRD](agent-autonomy-prd.md), [plan](agent-autonomy-plan.md) (B-503 to B-506, B-516 to B-518): 10 slices, waves (1, 2) → 3 → (4, 5) → 6 → 7 → (8, 9, 10): questions that take their recommendation after 30 minutes (planners' too), a notice board, a machine claim for a landing's full check, the flake rule, flakes filed by the check, a Checked: trailer and a full pass that carries over a dev sync, landing on an unsynced tip, landing notices and the hold. Tooling only. Follow-on: agent-autonomy-2. While test-health runs (its word, 2026-11-22): land no change to what quick or full means (check-plan.mjs, lib.sh checked_ok) or what land accepts in the middle of a test-health landing, only between its waves; never touch scripts/eslint/ or eslint.config.js. |
| `agent-autonomy-2` | done | — | `scripts/loops/session`, `scripts/loops/context`, `scripts/loops/prompt.sh`, `scripts/loops/rotate`, `scripts/loops/open-session`, `scripts/loops/recover`, `scripts/loops/tidy`, `scripts/loops/end-session`, `scripts/loops/request` | [PRD](agent-autonomy-2-prd.md), [plan](agent-autonomy-2-plan.md) (B-507, B-508, B-509): 2 slices in 2 waves: a context hook that tells a session past 160k to rotate, sizes in status, the dispatcher's follow-up. Cut from agent-autonomy by its planner. Tooling only |
| `test-gates-2` | — | `test-gates` | `.github/workflows/ci.yml`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `scripts/browser-checks/`, `scripts/loops/browser.sh`, `scripts/loops/serve.sh`, `scripts/loops/check-plan`, `scripts/loops/check-areas.d/`, `scripts/loops/prd.sh`, `vitest.config.ts`, `ops/runbook.md` | CI tiers 3-4: staging candidate, CI browser suites, staging to main gate, required checks (plans/test-gates-prd.md) |
| `test-health-2` | — | `test-gates`, `test-gates-2`, `sync-safety` | `apps/web/app/lib/sync/uploader`, `apps/web/test/fixtures.ts`, `apps/web/test/database.ts`, `apps/web/app/lib/sync/index.ts`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/sync-matrix.mjs`, `scripts/loops/sync-matrix.test.mjs`, `packages/api/src/router.int.test.ts`, `vitest.config.ts` | Test coverage follow-ups: device-to-server round trip per table, a second time zone, role gaps, an uploadData error test (B-371, B-372, B-373, B-374) |
| `worker-watch` | — | `test-gates`, `agent-autonomy-2`, `agent-autonomy-3` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/check-times`, `scripts/loops/check-run`, `scripts/loops/check-body`, `scripts/loops/land.sh`, `scripts/loops/review.sh`, `scripts/loops/browser.sh`, `scripts/loops/new.sh`, `scripts/loops/rm.sh`, `scripts/loops/status-extra`, `scripts/loops/dispatch`, `scripts/loops/context`, `scripts/loops/skeptic`, `scripts/loops/ask` | To write. Run metrics in one summary, then stuck workers handled against usual times (B-434, B-408). Cut from orchestration-3 |
| `agent-autonomy-3` | done | `agent-autonomy`, `agent-autonomy-2` | `scripts/loops/ask`, `scripts/loops/skeptic`, `scripts/loops/prompt.sh`, `scripts/loops/land`, `scripts/loops/prd.sh`, `scripts/loops/dispatch`, `scripts/loops/open-session`, `scripts/backlog/registry` | To write. A Fable skeptic before every ask, before risky landings (a forced landing, a flaky pass, a declined Codex finding), and as the final check on Opus planners, with a registry flag that keeps a design topic's planner on Fable (B-511, B-512, B-513). Filed into agent-autonomy after its plan landed; builds on its defaulting asks and flake rule |
| `self-recovery` | — | `test-gates`, `agent-autonomy`, `agent-autonomy-2` | `scripts/loops/recover`, `scripts/loops/land.sh`, `scripts/loops/lib.sh`, `scripts/loops/session`, `scripts/loops/open-session`, `scripts/loops/dispatch`, `scripts/loops/prd.sh`, `scripts/loops/inventory`, `scripts/loops/down.sh`, `scripts/loops/new.sh`, `scripts/loops/status-extra`, `scripts/loops/prompt.sh` | To write. launchd recovery, draining before a usage limit, step-in-progress markers, cost records, records for every session kind, headless sessions (B-407, B-433, B-437, B-438). Cut from orchestration-3; its planner cuts headless out if over six slices |
| `self-recovery-2` | — | `self-recovery` | `scripts/loops/session`, `scripts/loops/open-session`, `scripts/loops/dispatch`, `scripts/loops/prd.sh` | Cost record and headless sessions, cut from self-recovery to keep it at six slices |
| `staging-ship` | — | `test-gates-2` | `scripts/loops/review.sh`, `scripts/loops/codex-review`, `scripts/loops/prd.sh`, `scripts/loops/land.sh` | To write. Ship dev to staging in one command, Codex findings filed by tool, a staging to-test report (B-404, B-430, B-436). Cut from orchestration-3; doesn't need the dispatcher |
| `ui-kit-3` | done | `ui-kit-2` | `apps/web/app/app.css`, `apps/web/app/components/ui/`, `apps/web/app/routes/dev/ui/`, `apps/web/app/lib/timeline/entryDisplay.ts`, `apps/web/app/components/entry/KindIcon.tsx`, `apps/web/app/components/quick-entry/QuickEntryCard.tsx`, `apps/web/app/lib/app-shell/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-398, B-269, B-448 and overlay motion): every remaining area swept onto the kit, one area per slice; then the lint guard. Cut from ui-kit-2 to keep it at six slices; starts after ui-kit-2 so the sweeps copy its final Button, header and motion contracts; before test-health waves 5 to 7; never beside i18n. Hot files when planned: most route and component folders, one area per slice |
| `ui-kit-4` | done | `ui-kit-3` | `eslint.config.js`, `scripts/eslint/`, `apps/web/app/routes/app/groups/medication/`, `apps/web/app/routes/app/groups/medications/`, `apps/web/app/routes/app/groups/provider/`, `apps/web/app/routes/app/groups/providers/`, `apps/web/app/routes/app/groups/profile/`, `apps/web/app/routes/app/groups/period/`, `apps/web/app/routes/app/groups/periods/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/search/`, `apps/web/app/components/medications/`, `apps/web/app/components/schedule/`, `apps/web/app/components/providers/`, `apps/web/app/components/contact/`, `apps/web/app/components/todos/`, `apps/web/app/components/visitPrep/`, `apps/web/app/components/repeat/` | — |
| `ui-kit-5` | done | `ui-kit-4`, `quick-entry-2` | `scripts/eslint/`, `apps/web/app/components/ui/Menu.tsx`, `apps/web/app/components/ui/FilterMenu.tsx`, `apps/web/app/components/ui/overlayMotion.browser.test.tsx`, `apps/web/app/routes/dev/ui/sections/MenuSection.tsx`, `apps/web/app/routes/dev/mail/`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/new/`, `apps/web/app/components/entry/`, `apps/web/app/components/notes/`, `apps/web/app/components/quick-entry/`, `apps/web/app/components/connectors/`, `apps/web/app/routes/admin/`, `apps/web/app/routes/account/`, `apps/web/app/routes/connectors/`, `apps/web/app/routes/marketing/`, `apps/web/app/routes/app/layout/`, `apps/web/app/routes/app/home/` | — |
| `quick-entry-2` | done | — | `packages/data/src/db/schema/assistant/quickEntry`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/timeline/timelineQuickEntry` | to write (B-300 to B-303), from the 2026-11-21 code review: negated doses, typed counts, wrong times, the stuck card · Depends on: `planner-2` in `dev` (it edits quick entry's future note; last item B-248) · Hot files: `db/schema/assistant/quickEntry.ts`, `quickEntryTime.ts`, `components/quick-entry/` |
| `dose-accuracy` | — | — | `packages/data/src/db/schema/medications/dueDoses.ts`, `packages/data/src/db/schema/medications/duePasses.ts`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/medications/dueDoses.sync.ts`, `apps/web/app/lib/appointments/visitPrep`, `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `packages/api/src/connectors/tools/todaysDoses.ts` | to write (B-297 to B-299), from the 2026-11-21 code review: a dose answers only its own day's slot, deterministic dose ids, visit prep's missed doses per schedule epoch · Hot files: `db/schema/medications/dueDoses.ts`, `medications.sync.ts` (`logDoses`), `visitPrep.ts` |
| `symptom-catalog` | — | `quick-entry-2`, `dose-accuracy` | `packages/data/src/db/schema/timeline/`, `packages/data/src/services/timelineEntryService.ts`, `packages/api/src/syncRegistry.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/routes/app/groups/timeline/SymptomFields.tsx`, `apps/web/app/routes/app/groups/timeline/FeelingFields.tsx`, `apps/web/app/routes/app/groups/timeline/FilterSheet.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/daySummary`, `apps/web/app/lib/appointments/visitPrep`, `apps/web/app/lib/assistant/quickEntryPredictions`, `apps/web/app/components/quick-entry/` | to write (B-549): symptoms as a catalog type with a default set, quick add with a similar-name check, a multi-symptom filter; adds a migration |
| `tags` | — | `symptom-catalog` | `packages/data/src/db/schema/tags/`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/tags/`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/routes/app/groups/timeline/FilterSheet.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/providers/`, `apps/web/app/routes/app/groups/medications/`, `apps/web/app/routes/app/groups/search/`, `scripts/browser-checks/sync-matrix.mjs` | to write (B-548): group-wide tags on every record, filterable on each list and in search; adds a migration |
| `onboarding` | done | — | `apps/web/app/routes/account/join/`, `apps/web/app/routes/account/invite/`, `packages/auth/src/tickets.ts`, `packages/api/src/care-groups/`, `packages/data/src/services/careGroupInviteService.ts`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/root.tsx`, `apps/web/public/site.webmanifest`, `apps/web/app/routes/marketing/layout/`, `packages/data/src/db/schema/app-shell/userPreferences.ts`, `apps/web/app/lib/app-shell/me.ts`, `scripts/browser-checks/invites.spec.mjs` | to write (B-31): guided onboarding for new users, the real requirement; a demo group is one idea to refine; may point at the connect guide · Depends on: invites (done) · Hot files: seeds, careGroupService, /app home |
| `assistant-access` | done | — | `packages/data/src/db/schema/care-groups/careGroup.ts`, `packages/data/src/db/schema/connectors/connectorRules`, `packages/data/src/services/connectorGrantService.ts`, `packages/data/src/services/careGroupService.ts`, `packages/api/src/care-groups/careGroup.ts`, `packages/api/src/connectors/protocol.ts`, `packages/api/src/connectors/connect.ts`, `packages/api/src/connectors/connector.ts`, `packages/api/src/connectors/tools/groupOverview.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/care-groups/assistantsSwitch.sync.ts`, `apps/web/app/routes/app/groups/settings/assistants/`, `apps/web/app/routes/connectors/connect/`, `apps/web/app/routes/app/settings/devices/ConnectedAssistants.tsx` | Owner chooses read/write or read only for a group's assistants (B-558) |
| `code-health` | — | `check-speed`, `orchestration-2` | `packages/data/src/db/schema/`, `packages/data/src/domain/`, `packages/data/src/services/`, `packages/data/package.json`, `package.json`, `apps/web/package.json`, `apps/web/app/`, `packages/api/src/`, `scripts/loops/lib.sh`, `scripts/loops/lease.sh`, `scripts/loops/land.test.mjs`, `scripts/loops/check-areas.d/`, `scripts/backlog/backlog.mjs`, `scripts/build/` | [PRD](code-health-prd.md), [plan](code-health-plan.md) (B-361, B-365, B-366, B-367): 6 slices, waves (1, 2, 3, 5) → 4 → 6: exact pins and a test refusing ranges, unused exports removed, the backlog lock held once and a knobs page, tests on pr/ready/review/land, pure logic moved to @caretook/data/domain, then every importer switched (slice 6, alone, after simple-mode lands; it touches import lines across apps/web/app and packages/api). No behaviour change, no migration. Follow-ons: code-health-2, code-health-3 |
| `fixes-bug` | standing | — | `apps/web/app/routes/app/groups/timeline/DayHeader`, `packages/data/src/db/schema/care-periods/carePeriodTrack`, `apps/web/app/components/ui/useSheetChanges`, `apps/web/app/components/ui/Sheet`, `apps/web/app/components/ui/sheetGuard`, `apps/web/app/routes/app/groups/timeline/pass/` | plan: plans/fixes-bug-plan.md, rules: plans/fixes-rules.md |
| `fixes-ui` | standing | — | — | plan: plans/fixes-ui-plan.md, rules: plans/fixes-rules.md |
| `sync-safety` | — | — | `packages/api/src/sync`, `apps/web/app/lib/sync/`, `apps/web/app/lib/auth/session`, `apps/web/app/routes/sign-out.tsx`, `apps/web/app/routes/app/layout/SyncIndicator.tsx`, `apps/web/app/routes/app/layout/UserMenu.tsx`, `packages/data/src/services/`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/providers/providers.sync.ts`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/signout-wipe.spec.mjs`, `scripts/browser-checks/session-end.spec.mjs` | to write (B-285 to B-296, B-382 to B-384, B-387: repeating-todo upload bugs Codex found, moved from `planner-2`), from the 2026-11-21 code review (findings not re-verified): refused sync changes shown to the user, an upload queue that can't wedge, offline edits that don't revert a co-member's change, replayed PUTs, global client-chosen ids, the sign-out wipe and unsent writes, then the column-agreement test and one generic upload handler · Depends on: (none); `test-health` shares the upload tests (B-371, B-374) · Hot files: `packages/api/src/sync.ts`, `lib/sync/client.ts`, `SyncIndicator`, `session.ts`, `sign-out.tsx`, `medications.sync.ts`, `providers.sync.ts`, the services' `upsert`s |
| `demo-site` | hold | — | — | Shared demo site with generic logins and nightly reset; separate environment |
| `planner-3` | — | `simple-mode` | `packages/data/src/db/schema/todos/`, `packages/data/src/db/schema/assistant/`, `packages/data/src/permissions/todos.ts`, `packages/data/src/services/entryTodoService.ts`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `packages/api/src/connectors/tools/listTodos.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/todos/`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/lib/appointments/`, `apps/web/app/lib/assistant/quickEntry.sync.ts`, `apps/web/app/components/todos/`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `scripts/browser-checks/sync-matrix.mjs` | Replanned 2026-11-23: entries and todos many to many (B-245) and quick entry repeats (B-254). |
| `todo-subtasks` | — | `planner-3` | — | to write (B-550): nested todos, 3 levels in code, parent auto-completes |
| `calendars-2` | — | — | `packages/data/src/google/`, `packages/data/src/services/calendar`, `packages/data/src/db/schema/calendars/`, `packages/data/src/db/schema/notifications/`, `packages/data/src/db/schema/appointments/repeatRule`, `packages/data/src/db/schema/appointments/seriesVisits`, `packages/notifications/`, `apps/web/app/lib/appointments/repeatChoice`, `apps/web/app/lib/calendars/`, `apps/web/app/components/repeat/`, `apps/web/app/routes/app/groups/settings/calendar/` | [PRD](calendars-2-prd.md), [plan](calendars-2-plan.md) (B-304 to B-309): 7 slices, waves (1, 3, 5, 6) → (2, 4) → 7: Google deletes leave started items and todos alone; Google sync looks a year ahead with a daily catch-up; reminders expire at the event's start; deleted providers leave pushes; a stale consent goes generic and asks again; times name their zone; monthly on the last day. Two additive migrations (waves 1 and 3), no deps, no stack. Push notifications (B-377) are calendars-3 |
| `fixes-perf` | standing | — | — | plan: plans/fixes-perf-plan.md, rules: plans/fixes-rules.md |
| `fixes-nit` | standing | — | — | plan: plans/fixes-nit-plan.md, rules: plans/fixes-rules.md |
| `sync-safety-2` | — | `sync-safety` | `packages/api/src/sync`, `apps/web/app/lib/sync/`, `packages/data/src/services/`, `apps/web/app/lib/todos/` | Released 2026-11-23 by the user. to write (B-294 to B-296, B-382 to B-384, B-387): cut from sync-safety by its planner, 2026-11-21: device transactions applied atomically, device clocks on change entries, the stale tab, and the repeating-todo races |
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
| `inbox-agent` | — | `orchestration-3` | `scripts/backlog/`, `scripts/loops/lib.sh`, `scripts/loops/prd.sh`, `scripts/loops/prompt.sh`, `scripts/loops/dispatch`, `scripts/loops/tidy`, `scripts/loops/queue`, `scripts/loops/session`, `scripts/loops/rotate` | To write. Priority from a Next up list in the inbox, an inbox agent writing to origin/dev, duplicate checks and automatic archive, asks hygiene (B-406, B-425, B-435, B-429). Cut from orchestration-3 |
| `asks-relay` | — | `inbox-agent` | `scripts/loops/ask`, `scripts/loops/prompt.sh`, `scripts/loops/dispatch`, `scripts/loops/tidy`, `scripts/loops/session`, `scripts/loops/prd.sh` | Released 2026-11-23 by the user. The backlog session as go-between for every agent's questions, and asks queue hygiene. Cut from inbox-agent by its planner (plans/inbox-agent-prd.md, Follow-on topic) |
| `ui-kit` | done | — | `apps/web/app/components/ui/`, `apps/web/app/app.css`, `apps/web/app/components/settings/`, `apps/web/app/routes/sign-in.tsx`, `apps/web/app/routes/app/layout/SectionNav.tsx` | [PRD](ui-kit-prd.md), [plan](ui-kit-plan.md) (B-257 to B-267, B-270, B-396, B-397, B-399): 7 slices, waves 1 → (2, 3, 4) → (5, 6) → 7: a dev gallery at `/dev/ui`, Button and the form footer; the pill tab bar (medications, Planner, sign-in) and the phone's floating, icon-only bottom bar; messages, empty and loading states and Badge; text tokens, the page container and one heading scale; Card, lists, check and toggle fields; the detail header and full-width section bands on the medication, provider, care period and to-do pages, then the profile. Each primitive is adopted in settings, sign-in or the detail pages; the rest of the app is `ui-kit-2`. No migration, no deps; stackless but for slice 2 (two browser checks). **Ready to start** · Depends on: (none): `list-filters` and `planner-2` are in `dev`; never beside `i18n`; `quick-fixes` between waves · Hot files: `components/ui/` (its `index.ts`, `styles.ts`, `plain/`, `TabNav`, `PageHeader`, `Field`), `app.css`, `components/settings/`, the settings route folders, `routes/sign-in.tsx` and the account card, the dev routes part, the outer `main` and `h1` of `/app` pages outside the timeline and entry folders, the five detail-page folders, `LinkedTodos`, `AllergiesRegion`; `routes/app/layout/SectionNav.tsx` and the bar's locator in `app-shell.spec.mjs` (`test-health` slice 12 rewrites that spec) and `roundtrip.spec.mjs` |
| `ui-kit-2` | done | `ui-kit` | `apps/web/app/components/ui/`, `apps/web/app/app.css`, `apps/web/app/root.tsx`, `apps/web/app/assets/fonts/`, `apps/web/app/routes/dev/ui/`, `scripts/build/manifest`, `scripts/build/service-worker`, `apps/web/app/routes/app/groups/medications/route.tsx`, `apps/web/app/routes/app/groups/medications/routes.ts`, `apps/web/app/routes/app/groups/medications/passes/`, `apps/web/app/lib/medications/urls.ts`, `apps/web/app/lib/medications/medicationSheets`, `apps/web/app/routes/app/groups/providers/route.tsx`, `apps/web/app/routes/app/groups/planner/PlannerHeader.tsx`, `apps/web/app/routes/app/groups/periods/route.tsx`, `apps/web/app/components/entry/SeriesScopeDialog.tsx`, `apps/web/app/routes/app/groups/todo/RepeatDeleteDialog.tsx`, `apps/web/app/routes/app/groups/timeline/DaySummaryLine.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/TodayCard.tsx` | [PRD](ui-kit-2-prd.md), [plan](ui-kit-2-plan.md) (B-423, B-420, B-419, B-424, B-415, B-414, B-268): 6 slices, waves (1, 4, 6) → (2, 5) → 3: one Button with tones, sizes and shapes; a + add button at the top right of every main page header (Providers with an icon-only Import, the Planner, Care periods); Medications with Passes as a third tab and an add menu; the Atkinson Hyperlegible Next typeface, self-hosted; quiet motion for buttons, rows, chevrons and expanding regions; a kit ChoiceDialog for the two three-way questions. No migration, no deps; slices 3, 4 and 6 have a stack. The sweeps, the guard and overlay motion are ui-kit-3 · Depends on: ui-kit in dev; never beside i18n |
| `orchestration-2` | done | `check-speed` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/rm.sh`, `scripts/loops/open-session.`, `scripts/loops/session`, `scripts/backlog/` | [PRD](orchestration-2-prd.md), [plan](orchestration-2-plan.md) (B-389, B-390, B-391, B-395): 6 slices, waves (1, 2, 3) → 4 → 5 → 6: the PRD table as a registry (`pnpm backlog prd`, row order is the priority, states worked out), recorded sessions, an asks queue (`pnpm prd ask`, pushed to the phone by the asking session), drain-then-rotate after each landing (`pnpm prd rotate`), run-through prompts and status, then `quick-fixes` split into five standing topics (`fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`, on hold until the user orders them). Tooling only. **Ready to start** once `check-speed` is in `dev` · Depends on: `check-speed` in `dev` (shared `prd.sh`, `prompt.sh`, `pnpm test:tooling`); before `test-health`, never beside it · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `rm.sh`, `open-session.*`, `scripts/backlog/`, this PRD table |
| `orchestration-3` | done | `orchestration-2` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/recover.sh`, `scripts/loops/land.sh`, `scripts/loops/lease`, `scripts/loops/new.sh`, `scripts/loops/session`, `scripts/loops/open-session.`, `scripts/loops/inventory`, `scripts/loops/tidy`, `scripts/loops/dispatch`, `scripts/loops/check-run`, `scripts/backlog/backlog.mjs` | to write (B-392, B-404: one command to ship `dev` to staging through the Codex review): the dispatcher (`pnpm prd dispatch`: the pick, unattended planners, `queue` as "move to the front", recovery and status). What is settled and what is open: [orchestration-2 PRD](orchestration-2-prd.md), _Follow-on_ · Depends on: `orchestration-2` in `dev` (last item B-395) · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `recover.sh`, the registry |
| `check-speed` | done | — | `scripts/loops/`, `vitest.config.ts`, `package.json`, `packages/data/test/` | [PRD](check-speed-prd.md), [plan](check-speed-plan.md) (B-271, B-272, B-273, B-278): 4 slices, waves (1, 2) → (3, 4): every check through two check leases and into a check log (`pnpm prd check --times`), tooling tests in their own Vitest project, quick check at hand-off with the full check once per landing, integration tests on three workers with a database each. No load gate. Measured 2026-11-21: a full test run takes about 11 minutes and five PRDs made 39 of them · Hot files: `scripts/loops/` (`prd.sh` `check`, `prompt.sh`, `lease.sh`, `test-db.sh`, `rm.sh`), `vitest.config.ts`, `package.json`, `packages/data/test/`, `testDatabase.ts` |
| `test-health` | done | `check-speed`, `orchestration-2` | `vitest.config.ts`, `eslint.config.js`, `scripts/eslint/`, `apps/web/test/` | [PRD](test-health-prd.md), [plan](test-health-plan.md) (B-274 to B-277, B-279 to B-283): 15 slices in 7 waves (slices 1, 2, 6 and 7 moved to `check-speed`), landing wave by wave. Waves 1 to 4: browser-check bookkeeping, the component harness (clock, one timeout, `getByCss`, lint rules as warnings) and the unit, server and Playwright cuts. Then it pauses; waves 5 to 7 are the component cuts, the area-by-area harness migration and the rules becoming errors · Depends on: `check-speed` in `dev` before slice 11 (worker databases; last item B-278), and better before any of it (quick hand-off checks); otherwise (none) for waves 1 to 4; waves 5 to 7 (slices 14 to 19) after `list-filters`, `planner-2` and `ui-kit` (they edit the same screens' tests); `quick-fixes` between waves · Hot files: `vitest.config.ts`, `package.json`, `eslint.config.js`, `scripts/loops/` (`prd.sh`, `prompt.sh`, `lease.sh`, `checks`, `check-areas.mjs`, `check-areas.d/`, `test-db.sh`), `apps/web/test/` (`setup.ts`, `found.ts`), `packages/data/test/`, `scripts/browser-checks/` (the specs, `fixtures.mjs`), the frozen-list tests; from wave 5 the `*World.tsx` files and component tests in every area, one area per slice |
| `code-health-2` | hold | `code-health`, `simple-mode`, `sync-safety` | `packages/data/src/models/`, `packages/data/src/services/`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `apps/web/app/lib/core/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-362, B-363), cut from code-health by its planner, 2026-11-21: the role table as what simple-mode leaves (canComplete, role checks in the API's invites and join requests, a test refusing role names outside the role module, isUserRoleName and isGroupRoleName removed), the soft-delete model factory, one upsert helper on sync-safety's create-if-absent shape, one invalid, the device side's refuse, invalid, canWrite, formString and shouldRevalidate |
| `code-health-3` | hold | `code-health-2` | `apps/web/app/lib/`, `apps/web/app/libLayout.test.ts`, `packages/data/src/models/base/`, `packages/api/src/sync` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-364, B-368, B-369), cut from code-health by its planner, 2026-11-21: device row types derived from the device schema and the layout guard refusing SQL outside *.sync.ts (17 files today), the list count only on request and the sync PATCH's round trips (that slice after sync-safety-2), plan-pointing comments (a count that may only fall, then a sweep) |
| `simple-mode` | done | — | `apps/web/app/lib/assistant/simpleMode`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `powersync/sync-config.yaml` | [PRD](simple-mode-prd.md), [plan](simple-mode-plan.md): 5 slices, waves 1 → 2 → 3 → (4, 5): the lock becomes two member roles, Easy helper (log-only, own entries, own todos) and Easy viewer; "simple" is renamed "easy" everywhere, database included; the role decides the view; the Planner, todo pages and search open for the easy roles (B-221, B-236); the Easy mode toggle moves from the View options menu into the full timeline's page header (slice 5, stackless, B-400). Migrations in slices 1, 2 and 3; sync config changes. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248) and the current `quick-fixes` wave in `dev` (slice 1 renames files they touch) · Hot files: slice 1: every `simple*` file (`lib/assistant/simpleMode*`, `SimpleTimeline` and its blocks, quick entry, `TodoTick`, the `/app` layout), `sync-config.yaml`, the device schema; slice 2: `constants/roles.ts`, `permissions/` (blocks, types, timeline, todos, live-notes, connectors), `todoService`, the upload switch, `groupContext.ts`, the role picker; slice 3: group settings Members, `careGroupMemberService`, `useSimpleFrame`; slice 4: the Planner and todo routes, the search route; slice 5: `TimelineHeader.tsx`, `TimelineViewMenu.tsx`, the toggle button |
| `calendars-3` | — | `calendars-2` | `packages/notifications/`, `apps/web/app/lib/app-shell/serviceWorker`, `scripts/build/service-worker`, `apps/web/app/routes/app/groups/settings/calendar/` | to write (B-377): push notifications for event reminders; cut from calendars-2 to keep it small. Its planner asks about a web-push dependency and the push vendors. Builds on calendars-2 slice 3 (the outbox expiry) |
| `connectors-3` | — | `planner-3` | `packages/api/src/connectors/tools/`, `packages/data/src/db/schema/medications/doseSchedule`, `packages/data/src/db/schema/medications/index.ts`, `packages/api/src/connectors/readTools.int.test.ts`, `packages/api/src/connectors/mcpWrites.int.test.ts` | to write (B-252: a connector tool to read the dosing schedule beyond today; B-253: `add_todo` can make a repeating todo) · Depends on: B-253 after `planner-2` in `dev` (last item B-248); B-252 has none · Hot files: `packages/api/src/connectors/tools/` (`todaysDoses.ts` or a new schedule tool, `writes.ts`), the server instructions |
| `connectors-4` | hold | `hosting`, `marketing` | — | Directory listings (B-196): after the launch (B-33), the privacy policy (B-54) and the staging check with Claude and ChatGPT; needs a logo, short and long descriptions, a test account, the privacy URL |
| `i18n` | alone, hold | `simple-mode` | `apps/web/app/components/`, `apps/web/app/lib/core/format.ts`, `packages/data/`, `apps/web/app/root.tsx`, `packages/notifications/`, `pnpm-workspace.yaml`, `scripts/build/budget.json` | [PRD](i18n-prd.md), [plan](i18n-plan.md): 11 slices, waves 1 → 2 → (3, 4, 5, 6) → (7, 8, 9, 10) → 11: a per-user language (English and Spanish, AI-drafted, review before launch) in `user.preferences` with a cookie for server rendering; typed catalogs on `i18next` and `react-i18next`; format helpers, error codes and label maps take the language; the app swept area by area; emails, the invite's language, calendar text and the public site at `/es/`; a lint rule against literal text (`eslint-plugin-i18next`, dev). Quick entry is a plain box for non-English users; search matching, the connector and `/admin` stay English (B-209). Slice 8 adds a migration (one nullable invite column); three dependencies approved 2026-11-21; slice 1 needs a stack. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248), the current `quick-fixes` wave and `simple-mode` (last items B-221, B-400) in `dev`; **runs alone** (tooling-only work beside it) · Hot files: every user-facing string: all `/app`, sign-in and marketing routes, `components/`, `lib/core/format.ts` and the other format helpers, the label maps in `packages/data` schema, `userPreferences.ts`, `root.tsx`, the service worker, `packages/notifications` templates and registry, the invite schema and service, `calendarText.ts`, ESLint config, `pnpm-workspace.yaml`, `scripts/build/budget.json` |
| `data-rights` | hold | — | `packages/api/`, `apps/web/app/lib/sync/client.ts`, `packages/auth/` | to write (B-52, B-53, B-84) · Hot files: `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `account-security` | hold | — | `packages/auth/` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) · Depends on: `invites` (done); B-80 (the Devices page) first (soft) · Hot files: `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `marketing` | hold | — | — | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user |
| `hosting` | hold | — | — | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent |
| `encryption` | hold | — | — | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 · Depends on: (none); affects `assistant` and `documents` · Hot files: none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `documents` | hold | `encryption` | — | to write (B-56) · Depends on: hosting (B-33, file storage); `profiles` (soft); `encryption` decision · Hot files: file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS` |
| `contract-migrations` | hold | — | — | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** Contract steps tracked from fixes-nit (B-379): B-455, B-456, B-457. Migrations: run alone in its wave. To write. |
| `timeline-jump` | — | `quick-entry-2` | `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/providers/providers.sync.ts`, `apps/web/app/lib/medications/medicationTimeline.sync.ts`, `apps/web/app/lib/care-periods/periodMarkers.ts`, `apps/web/app/routes/app/groups/timeline/useTimelineData.ts`, `apps/web/app/routes/app/groups/timeline/timelineRows.ts`, `apps/web/app/routes/app/groups/timeline/timelinePaging.ts`, `apps/web/app/routes/app/groups/timeline/daySummaryRows.ts`, `apps/web/app/routes/app/groups/timeline/TimelineEntryList.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/route.tsx`, `apps/web/app/components/quick-entry/`, `packages/data/src/db/schema/assistant/quickEntryTime` | Jump to a date on the timeline, by picker and quick entry (B-557) |
| `orchestration-split` | hold | — | — | Held until after launch by the user (B-543): extract the orchestration tooling or replace it with a prebuilt one |
| `member-avatars` | — | `onboarding`, `ui-kit-5` | `packages/data/src/db/schema/auth/user.ts`, `packages/data/src/models/user/userModel.ts`, `packages/data/src/permissions/blocks.ts`, `packages/api/src/app-shell/me.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/app-shell/me.ts`, `apps/web/app/components/ui/UserAvatar.tsx`, `apps/web/app/components/ui/AvatarStack.tsx`, `apps/web/app/components/notes/EditorAvatars.tsx`, `apps/web/app/components/entry/KindIcon.tsx`, `apps/web/app/routes/app/settings/account/`, `apps/web/app/routes/app/layout/UserMenu.tsx`, `apps/web/app/routes/app/groups/settings/members/`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `apps/web/app/routes/app/groups/timeline/PassLogItem.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/planner/`, `scripts/browser-checks/roundtrip.spec.mjs` | Released 2026-11-23 by the user. Members choose an avatar color and icon; no photos or image storage. |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-31 | feature | landed | onboarding | prd/onboarding | Guided onboarding for new users: a first-run flow that walks a new member through setting up and using the app (the real requirement; details to refine) |
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
| B-244 | chore | triaged | fixes-tooling |  | codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false |
| B-245 | plan | triaged | planner-3 |  | Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date |
| B-252 | feature | triaged | connectors-3 |  | Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming |
| B-253 | feature | triaged | connectors-3 |  | Connector: add_todo can make a repeating todo (daily, weekly on days, monthly) |
| B-254 | feature | triaged | planner-3 |  | Quick entry: 'bins out every monday' makes a repeating todo |
| B-286 | bug | triaged | sync-safety |  | A repeatable 5xx from sync.upload blocks a device's upload queue forever: no retry cap, and the sync indicator never shows uploadError or the queue length |
| B-288 | bug | triaged | sync-safety |  | A replayed PUT on an existing row is a full update with the insert-time values, reverting newer edits (and for medications writing no change entry) |
| B-289 | bug | triaged | sync-safety |  | Client-chosen ids are global: a member of one group can squat ids in another (note_document by a victim's provider id; series visit ids), wedging a device's queue or making top-up skip days |
| B-290 | bug | triaged | sync-safety |  | Sign-out and a lapsed session wipe the device without checking the upload queue: unsent changes are destroyed with no warning |
| B-294 | bug | triaged | sync-safety-2 |  | Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused |
| B-295 | bug | triaged | sync-safety-2 |  | System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable |
| B-296 | bug | triaged | sync-safety-2 |  | A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database |
| B-299 | bug | ready | dose-accuracy | prd/dose-accuracy | Visit prep's 'Missed doses' reads history through today's schedule: a schedule change shows phantom misses back to the last visit |
| B-304 | bug | landed | calendars-2 | prd/calendars-2 | Deleting an old event in Google Calendar rewrites past Caretook records: soft-deletes a past reminder note, cancels a past appointment, marks a todo done for the group |
| B-305 | bug | triaged | calendars-2 |  | Events made in Google more than 90 days out never arrive: ignored as outsideWindow, the sync token advances, nothing revisits them |
| B-306 | bug | landed | calendars-2 | prd/calendars-2 | A reminder email can arrive after its appointment: about 2 h of retry backoff, no expiry, text rendered at queue time |
| B-307 | bug | triaged | calendars-2 |  | Google Calendar pushes still name soft-deleted providers (reminders filter them) |
| B-308 | bug | triaged | calendars-2 |  | The details-consent version is stored but never compared, so bumping DETAILS_CONSENT_VERSION re-asks nobody |
| B-309 | change | landed | calendars-2 | prd/calendars-2 | Reminder emails show times in the recipient's zone with no zone label, 24-hour en-GB format; and 'monthly on the 29th–31st' silently skips short months (no 'last day' option) |
| B-311 | bug | triaged | fixes-perf |  | The series top-up reads every live series every minute and rewrites topped_up_through daily even on ended series (re-syncing them to every device) |
| B-313 | bug | triaged | fixes-perf |  | Timeline and Planner load and watch every note document in the group (snapshot, text, pending updates) to preview 30 rows, rerunning on each co-member keystroke |
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
| B-359 | feature | landed | onboarding | prd/onboarding | Record terms, privacy and 18+ acceptance at sign-up and invite accept (no /terms or /privacy link outside the marketing pages; the terms require 18+) |
| B-361 | change | triaged | code-health |  | A @caretook/data/domain export for the pure logic now living under db/schema (quick entry parser, due doses, medication display, series edits: about half that folder) |
| B-362 | change | triaged | code-health-2 |  | A soft-delete model factory and a shared upsert helper: nine models are the same file, twelve upserts repeat the exists-as-system, visible-as-actor sequence, 'invalid' is defined 18 times |
| B-363 | change | triaged | code-health-2 |  | One exported role-capability table (canWrite(role), canComplete(role)) used by services, device modules and screens, before any role is added |
| B-364 | change | triaged | code-health-3 |  | Device reads are 164 raw SQL strings with hand-typed row types, 17 files outside *.sync.ts: derive row types from the device schema and make libLayout.test.ts refuse SQL elsewhere |
| B-365 | chore | triaged | code-health |  | Remove unused scaffolding and dead exports: serviceName (45 exports, 0 reads), the services registry, getService, isServiceName, initClient, isUserRoleName, isGroupRoleName, primaryContactName, hasContact, CALENDAR_CARDS, COMING_SOON |
| B-366 | chore | triaged | code-health |  | Pin dependencies exactly: 47 caret ranges remain (react-router, drizzle-orm, zod, vite among them) against AGENTS.md's rule |
| B-367 | chore | triaged | code-health |  | Agent tooling: tests for the merge path (land.sh, pr.sh, ready.sh, review.sh: 465 lines, none), and with_backlog_lock removes a stale lock without re-checking, so two waiters can both take it |
| B-368 | chore | triaged | code-health-3 |  | Comments that point at plans instead of behaviour: 198 'slice N' references in 154 source files and 262 PRD-name parentheticals |
| B-369 | change | triaged | code-health-3 |  | baseModel.list always runs a second COUNT query, and a sync PATCH costs about seven round trips (a 100-op batch about a thousand, serially) |
| B-370 | chore | triaged | fixes-tooling |  | Quick check always runs the guards that read source by path (scripts/loops/sync-matrix.test.mjs, rolesSql.test.ts): vitest --changed can't select them |
| B-371 | chore | triaged | test-health-2 |  | Device-to-server round trip per table through the app's own writers, comparing column values on the second device (today: hand-written INSERTs, id only, browser suite only) |
| B-372 | chore | triaged | test-health-2 |  | A second time zone in tests: device, recipient and seed are all America/Los_Angeles in 106 of 113 component test files, while 29 production call sites read the device's zone |
| B-373 | chore | triaged | test-health-2 |  | Role coverage gaps: a removed member writing or reading a care table, staff support on care tables, non-member writes through sync upload on 10 of 15 tables, and a real every-procedure unauthenticated sweep |
| B-374 | chore | triaged | test-health-2 |  | A test for the device's uploadData: a 400 or 500 from sync.upload must not wedge the queue |
| B-375 | chore | triaged | fixes-tooling |  | Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports) |
| B-377 | feature | triaged | calendars-3 |  | Push notifications for appointment reminders (B-61 shipped email only) |
| B-378 | chore | triaged | i18n |  | File the translations PRD's promised follow-ups: Spanish quick entry, language-aware search, a human review of the Spanish; and note 48 hard-coded 'en-US' formatters and English messages in schemas and the errors catalogue |
| B-383 | bug | triaged | sync-safety-2 |  | Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating |
| B-384 | bug | triaged | sync-safety-2 |  | Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete) |
| B-387 | bug | triaged | sync-safety-2 |  | Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin |
| B-404 | feature | triaged | staging-ship |  | One command to ship dev to staging: push dev, open the dev into staging PR, wait for Codex's review, triage its findings into the backlog (verified against the code, duplicates noted on the existing item), merge the PR when nothing is a blocker, and notify the user only when something is |
| B-406 | feature | triaged | inbox-agent |  | Set priority in the inbox, not the backlog: the user orders a short 'Next up' list in plans/inbox.md (plain lines, no ids or fields) and the dispatcher reads it as the order to plan and run, keeping the PRD table's row order in step; the user opens the backlog only when an agent asks |
| B-407 | feature | triaged | self-recovery |  | Recover by itself and land safely: a launchd job runs pnpm prd recover --wait at login and when work is recorded as running but no session is alive; the dispatcher slows down before a usage limit (starts no slice or planner, drains); a landing or migration cut off halfway leaves a step-in-progress marker so the resumed session finishes or undoes it |
| B-408 | feature | triaged | worker-watch |  | Stuck workers handled by the orchestrator: it tracks how long its commands and slice agents have run against their usual time, stops and restarts a stuck one on its own judgement (once), and for a judgement call asks a fresh skeptic agent first and the user through the asks queue only if that doesn't settle it |
| B-417 | feature | triaged | marketing |  | We are getting close to feature complete. We need another marketing content pass that updates copy… |
| B-418 | bug | triaged | fixes-tooling |  | Flaky tooling test under load: recover.test.mjs '--at a time that has passed waits until tomorrow' fails in the full pnpm test:tooling run and passes alone |
| B-425 | feature | triaged | inbox-agent |  | An inbox agent: a session that helps the user add, categorize and prioritize inbox items, and writes them by pushing straight to origin/dev instead of committing in the local dev checkout, so it never steps on the user's working copy |
| B-429 | change | triaged | asks-relay |  | Asks queue hygiene: reports that go stale are re-checked or expire, answered asks are archived, and an ask whose session has died still reaches the user |
| B-430 | feature | triaged | staging-ship |  | Codex findings on a PRD pull request become backlog items by tool: verified against the code, duplicates noted on the existing item, as B-404 does for the staging PR |
| B-431 | chore | triaged | fixes-tooling |  | A finished PRD gets its done flag without rm: set it at the last landing or in pnpm prd tidy (check-speed still reads planned with nothing waiting) |
| B-432 | chore | triaged | fixes-tooling |  | After a landing that changes the lockfile, pnpm prd land runs pnpm install in the main checkout (or files an ask) instead of only printing a reminder |
| B-433 | feature | triaged | self-recovery |  | A usage-limit signal and a cost record: sessions detect an approaching usage limit so the dispatcher can drain (B-407 assumes one), and tokens or cost are recorded per PRD and slice |
| B-434 | feature | triaged | worker-watch |  | Run metrics beyond check times: slice and landing durations, flake rate and how often Codex finds something, in one summary command |
| B-435 | feature | triaged | inbox-agent |  | Filing checks for duplicates (similar open or archived titles shown before an item is added) and finished items are archived without a hand run |
| B-436 | feature | triaged | staging-ship |  | A to-test report for a staging ship, like the landing reports of B-410 |
| B-438 | plan | triaged | self-recovery-2 |  | Headless orchestrator sessions: runs that need no terminal tab, so a helper cannot outlive or die with its window |
| B-442 | bug | triaged | fixes-tooling |  | pnpm prd tidy --yes deletes dead leases from its earlier snapshot without lease.sh's takeover mutex and fresh liveness check |
| B-443 | bug | triaged | fixes-tooling |  | land.sh to-test file lists no items after a local landing: items are already landed, not ready, once dev has the merge |
| B-446 | bug | triaged | fixes-tooling |  | browser.test.mjs 'kills a spec at its cap, worker and all, and retries it once' fails under heavy load (load 47), passes alone 3x |
| B-447 | bug | triaged | fixes-tooling |  | to-test file: 'What wasn't checked' repeats the quick-check line, and a tooling-only landing still gets the app's dev URL and seed sign-ins under 'What to try' |
| B-452 | bug | triaged | fixes-tooling |  | Dispatcher: a start or plan whose new.sh fails after making the worktree leaves it with no managed record, so later ticks treat it as opened by hand and it holds a slot for good |
| B-453 | bug | triaged | fixes-tooling |  | Dispatcher: a 'hold the topic' answer is consumed and the reopen count cleared even when the backlog write fails, so the same tick reopens the session |
| B-454 | bug | triaged | fixes-tooling |  | Dispatcher lock: two dispatchers starting together over a stale lock can both take it (the takeover unlinks the path from an earlier pid read) |
| B-455 | chore | triaged | contract-migrations |  | Drop the old per-member simple mode columns (simple_mode, simple_mode_locked) once Easy roles replace them |
| B-456 | chore | triaged | contract-migrations |  | Retire the leftover reminder data planner-2 left in place: the note kind on appointment_series and stored future notes and note series |
| B-457 | chore | triaged | contract-migrations |  | Give groups that predate the default medication passes (Morning 08:00 and Evening 20:00) their two passes |
| B-459 | chore | triaged | fixes-tooling |  | Backlog: 151 items read 'live' because the dev-into-staging-into-main release merge (cc3e1d8b, B-33) put their commits on origin/main, though production hasn't launched; give live a real meaning (a production marker such as a tag or a recorded deploy) or show main as staging until launch |
| B-461 | bug | triaged | fixes-tooling |  | tidy-cli.test.mjs fails as a whole file under heavy load (load about 30) in pnpm test:tooling, passes alone 3x |
| B-462 | bug | triaged | self-recovery |  | pnpm prd recover reopens the dispatcher even when a test-Postgres, stack or server step failed, so it can reopen managed sessions on broken infrastructure |
| B-463 | bug | triaged | self-recovery |  | pnpm prd recover after a crash loses the dispatcher's restart intent when its reopen fails: clear-lock deletes the stale lock first, and no record is kept |
| B-464 | bug | triaged | fixes-tooling |  | The backlog prompt's hold line (pnpm backlog prd set <topic> flags=hold) replaces the row's flags, dropping standing or alone |
| B-465 | bug | triaged | fixes-tooling |  | pnpm prd down keeps stopping servers, stacks and the test Postgres when the dispatcher won't stop in time (mid new.sh), racing a start against the shutdown |
| B-467 | feature | triaged | asks-relay |  | The backlog session is the go-between for every agent's questions: agents file to the asks queue and wait, the backlog session ranks them by how soon an answer blocks real work, asks the user itself and decides which ones ping the phone |
| B-468 | bug | triaged | fixes-tooling |  | open-session.sh fails when iTerm2 has windows but no current window: the dispatcher counts it as a planner death |
| B-474 | change | triaged | inbox-agent |  | Inbox agent plan amendments from the user: it never leaves staged or uncommitted changes behind (stash, or commit and push), and someone is named as owning cleanup of completed items |
| B-477 | change | triaged | fixes-tooling |  | PRD registry: a hold carries its reason |
| B-479 | bug | triaged | fixes-tooling |  | calendarCron.int.test.ts 'runs the reminders first, then Google push and pull, and the series top-up last by default' times out at 5 s under load (passes alone) |
| B-480 | bug | triaged | fixes-tooling |  | timelineQuickEntry.browser.test.tsx 'the user's units are used, and an explicit unit wins' misses 'Saved 1 entry' under load (passes alone) |
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
| B-511 | feature | landed | agent-autonomy-3 | prd/agent-autonomy-3 | Skeptic before every ask: a session sends its question, options and evidence to a fresh Fable skeptic first; it decides (reversible, within the rules) or confirms the question is the user's; pnpm prd ask records the verdict |
| B-512 | feature | landed | agent-autonomy-3 | prd/agent-autonomy-3 | Skeptic before risky landings: a Fable skeptic reviews the evidence before land --force, landing on flaky tests (B-505) or declining a Codex finding, and the landing report says what it said |
| B-513 | change | landed | agent-autonomy-3 | prd/agent-autonomy-3 | Opus planners and backlog sessions with a Fable final check: the skeptic pass runs on Fable and may send a plan back; a registry flag (e.g. design) keeps a heavy design topic's planner on Fable |
| B-515 | feature | triaged | inbox-agent |  | Always-on backlog and inbox sessions: the dispatcher keeps one backlog and one inbox session running and reopens a dead one; they don't count against the three PRD slots, and the context watch (B-507) rotates them too |
| B-518 | change | landed | agent-autonomy | prd/agent-autonomy | Land without re-syncing when dev's changes don't touch the branch: land.sh's drift refusal relaxes when dev's new commits share no file with the branch and bring none of the risky files; land still merges dev and typechecks the result, and the landing report says it landed on an unsynced tip |
| B-525 | bug | triaged | fixes-tooling |  | Asks: two processes taking over a dead holder's ask lock can both remove it, so one deletes the other's fresh lock and an answer and a default overlap (asks.mjs withAskLock) |
| B-526 | bug | triaged | fixes-tooling |  | Notices: two concurrent posts can lower the .seq high-water mark (check-then-rename), so after both expire a notice id is reused and a late notices --done withdraws a newer notice (notices.mjs createNotice) |
| B-527 | bug | landed | fixes-bug | prd/fixes-bug | Todo Undo and Done writes are voided with no catch (TodoUndoStatus.undo, useTodoTick's run via void complete(...)): a write that throws becomes an unhandled rejection, with nothing shown to the user |
| B-532 | chore | in-progress | test-gates-2 | prd/test-gates-2 | Staging candidate: cut a release candidate branch from a green dev commit and open the PR into staging from it; CI runs the lean browser suite on the Docker stack against that fixed commit; only fixes go onto it |
| B-533 | chore | in-progress | test-gates-2 | prd/test-gates-2 | staging to main gate: CI runs the full browser suite, a second time zone and repeated runs to catch flakes; a required status check on main always, on staging only in pre-deployment mode |
| B-542 | chore | triaged | fixes-tooling |  | Unit-test projects run at Vitest's default workers (cores - 1, 9 here): two overlapping checks run ~18 test processes on 10 cores, the load behind the under-load timeouts; cap the unit group at about 4 (or half the cores) and time it against check-times |
| B-543 | question | triaged | orchestration-split |  | Split the orchestration tooling into its own multi-project tool, or replace it with a prebuilt one |
| B-544 | chore | triaged | fixes-nit |  | vitest.config.ts:196 comment still names worker databases <name>_w<VITEST_POOL_ID>; they're caretook_tw_<stem>_<hash>_w<n> since B-405 |
| B-545 | chore | triaged | fixes-tooling |  | rm.sh reads pnpm backlog prd list --json twice (lines ~57 and ~71); reuse $rows to save a node start per rm |
| B-548 | feature | triaged | tags |  | Group-wide tags on every record (entries, todos, providers, medications, events), filterable |
| B-549 | feature | triaged | symptom-catalog |  | Symptoms become a catalog type: a default set for every group, writers add new ones quickly with a similar-name check; filter the timeline by several symptoms at once |
| B-550 | feature | triaged | todo-subtasks |  | Nested todos: subtasks up to 3 levels deep, a parent completes when its last subtask is done |
| B-551 | feature | triaged | inbox-agent |  | 'bye' for every agent role: a message of just 'bye' runs a handover check; nothing left means the session closes itself, otherwise it asks the user what to do with what's left |
| B-557 | feature | triaged | timeline-jump |  | quick date jump on timeline via date picker AND quick entry |
| B-560 | feature | triaged | self-recovery-2 |  | A cost record: tokens by model per PRD and slice, from session and subagent transcripts, in pnpm prd cost |
| B-561 | feature | triaged | demo-site |  | Shared demo site: demo.caretook.com with a fictional care group, generic logins and a nightly reset, to link from invites |
| B-562 | change | triaged | data-rights |  | Notice before a material change to the legal pages: the privacy policy promises notice and consent where required, and nothing does this yet |
| B-563 | feature | triaged | marketing |  | Accessibility statement page |
| B-564 | change | triaged | hosting |  | App-store prerequisites for the Capacitor apps |
| B-565 | feature | triaged | data-rights |  | Ownership transfer: a last owner can hand a care group to another member |
| B-568 | bug | triaged | fixes-tooling | prd/test-gates | Component tests that failed once on CI's Linux runners: providers rows, provider empty links, emergency sheet, search speed, timeline Back, weekly print chart |
| B-570 | bug | triaged | fixes-tooling |  | Session request notices can exceed the notice board's 200 characters and get dropped |
| B-573 | bug | triaged | fixes-tooling |  | Browser harness 'one spec' test fails now and then in a busy check: it gets a third output line where it expects two, and the check's rerun skips it as an unhandled error |
| B-574 | bug | triaged | fixes-tooling |  | ESLint aborts with exit 134 in the lint step of a check, seen in two worktrees within a second |
| B-576 | bug | triaged | fixes-tooling |  | Local pnpm lint runs out of memory at Node's default 4 GB heap: CI sets 6 GB, local checks don't |
| B-577 | change | landed | ui-kit-5 | prd/ui-kit-5 | Finish the UI kit sweep: timeline, entries and quick entry (TodayRow, PassLogItem, EasyNext, EntryBody, the four skeleton files, containers); admin, account, connectors, marketing and the app frame (home's h1); then empty the guard's not-swept list and drop Menu's bare class-string trigger |
| B-578 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry reads other slash numbers as dates: 'gave 1/6 tylenol', 'bp 12/8', 'pain 5/5' |
| B-580 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry dates a line ending in 'sat' to Saturday: 'she sat' |
| B-581 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry keeps 'call the pharmacy in the morning' at 7:00 as a note, not a todo |
| B-582 | bug | triaged | fixes-tooling |  | MCP rate-limit integration test times out at 5 s under machine load |
| B-583 | change | triaged | fixes-ui |  | Connector wording still says appointment: tool and prompt text, its kind: appointment output and the consent text; decide whether they move to Event (a consent change may need a version bump) |
| B-584 | chore | triaged | fixes-tooling |  | Backlog prompt: "deploy staging" trigger that promotes dev and notifies my phone |
| B-586 | bug | triaged | fixes-tooling |  | Phone notifications from the backlog session never arrive |
| B-591 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry reads a fraction after the medication as a date: 'gave tylenol 3/8' logs the usual dose on March 8 |
| B-593 | feature | triaged | member-avatars |  | Choose your avatar: a color and icon instead of plain initials |
| B-594 | change | triaged | fixes-ui |  | Manage allergies on the Profile page; Medications keeps a read-only summary |
| B-595 | chore | triaged | fixes-tooling |  | Slice agents read only their slice's section and the PRD decisions it cites, not the whole plan and PRD |
| B-596 | chore | triaged | fixes-tooling |  | Cap slice size at planning: split a slice touching more than about 8 files or several hot files |
| B-597 | chore | triaged | fixes-tooling |  | Split scripts/ci/ci.mjs and scripts/loops/prompt.sh so an agent reads only the part it needs |
| B-598 | chore | triaged | fixes-tooling |  | Keep a plan's Status short by moving finished-wave history out of it |
| B-599 | bug | landed | fixes-bug | prd/fixes-bug | Assistants settings: connection labels stay stale when another owner flips read only while the page is open |
| B-600 | change | triaged | fixes-tooling |  | Context watch: a soft limit where the agent decides and a hard limit where it hands off, set per agent type |
| B-601 | bug | landed | fixes-bug | prd/fixes-bug | Back right after a failed sheet save skips the discard prompt and loses the edits: the leaving flag stays set until the next touch |
| B-602 | bug | landed | fixes-bug | prd/fixes-bug | Discard prompt misfires or is missed: a sync after the first touch reads as a change, a record deleted elsewhere can prompt, and Back with an unguarded sheet on top of a changed one does not ask |
| B-604 | chore | triaged | fixes-tooling |  | Test Discard under reduced motion in the sheet guard |
| B-605 | bug | landed | fixes-bug | prd/fixes-bug | PageUp and PageDown on a date field's hour still wrap inside AM/PM, so 11 AM can page to 12 AM |
| B-606 | feature | triaged | fixes-ui |  | Highlight a double dose on a next-dose-due notification |
| B-608 | chore | triaged | fixes-tooling |  | Format before the slice check: prettier --write on a slice's changed files, and --cache on the whole-repo check |
| B-609 | chore | triaged | fixes-tooling |  | Stale check-gate text after test-gates: prd.sh help (ci run exits, quick escalation), the hotfix prompt, the PR body and ready's local check line, and dead checked_ok in lib.sh |
| B-611 | bug | ready | dose-accuracy | prd/dose-accuracy | A schedule change across midnight drops a dose's slot name in visit prep: a 23:30 dose given at 00:10 answers today's new 00:30 slot, and last night reads missed |
| B-613 | change | triaged | fixes-ui |  | Motion tuning: Today card slides open and shut, sheets fade only, overlays at 240 ms |
| B-614 | bug | triaged | dose-accuracy |  | An offline log-then-Undo can delete another member's dose: the PUT is a no-op on their row, then the PATCH of deleted_at removes it (a PUT already carrying deleted_at does the same) |
| B-615 | bug | triaged | fixes-bug |  | Connector log_dose names no slot, so two log_dose calls for one pass never merge into one dose; only give_pass converges |
| B-616 | bug | triaged | fixes-bug |  | Two simultaneous first uploads of one dose id: the loser hits the primary key and gets a 500; a device retries into the no-op, but a connector run fails and must be retried |
| B-617 | bug | triaged | fixes-ui |  | List tool buttons show no hover: search, filter and view on Timeline, filter on Providers and Planner |
| B-618 | change | triaged | fixes-ui |  | Timeline day header: move Change care period to the left of the period text |
| B-619 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/lib/search/search.sync.browser.test.tsx: about 2,000 entries the rebuild takes under 2 s, and a … |
| B-620 | bug | ready | fixes-bug | prd/fixes-bug | Timeline day headers repeat a care period day number when the viewer and recipient are in different time zones |
| B-621 | feature | triaged | fixes-ui |  | Quick entry: a tips panel under the box on a user's first 3 focuses, with examples, two shorthand codes and an X |
| B-623 | bug | triaged | fixes-tooling |  | Check rerun never runs for tooling: check-body's 'unhandled error' grep matches a passing test's title |
| B-624 | bug | triaged | fixes-tooling |  | browser.test.mjs 'passes a clean spec' fails under load: it expects exactly two output lines |
| B-625 | chore | triaged | contract-migrations |  | Drop todo.event_id and its old-client mirror once no device writes it |
| B-626 | feature | triaged | planner-3 |  | Decide whether a rescheduled event's todos follow it to the new event |
| B-627 | bug | triaged | dose-accuracy |  | A retried dose upload can undo a later Undo: B's accepted duplicate of A's dose, replayed after A deletes it, restores the dose as B's and marks the slot given again |
| B-628 | bug | landed | fixes-bug | prd/fixes-bug | Saving preferences reads then writes without a lock, so two simultaneous requests can lose a change such as a setup card dismissal |
| B-629 | bug | triaged | fixes-ui |  | Dismissing the setup card leaves keyboard focus nowhere, because the button disappears with the card |
| B-630 | chore | triaged | fixes-nit |  | Two helpers build the legal page links (lib/auth/legalLinks.ts and settings account/legalLinks.ts): fold them into one |
| B-631 | bug | ready | fixes-bug | prd/fixes-bug | Back can still skip the discard prompt after a refused action outside the submitted form: Add a medication in the pass log, or a refused delete |
| B-632 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry's fraction after a medication misreads a few lines: 'no pain gave tylenol 3/8', 'need to take tylenol 3/8', 'gave lorazepam 1/2' at 0.5 mg |
| B-633 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/timeline/timelineBack.browser.test.tsx: back from the entry page three pages d… |
| B-634 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry gives 'dr lee the 2nd at the clinic' no date: an ordinal before 'at <place>' is not read as a day |
| B-635 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry's request rule misreads a few lines with a part of day: 'check bp 120/80 in the morning' gets a note dated now and a todo alternative, 'ask about pain in the morning' reads as a symptom first |
| B-636 | change | triaged | fixes-ui |  | Planner todo rows keep the old time column, so they align differently from event cards in the same list |
| B-637 | chore | triaged | fixes-nit |  | About 20 settings and provider files still use text-base-content opacity classes instead of the UI kit |
| B-638 | chore | triaged | fixes-tooling |  | No test pins that a waiting join request from an account with no current legal acceptance isn't asked again |
| B-639 | bug | triaged | fixes-tooling |  | Unsynced landing can miss a brake on a newer origin/dev: land reads the verdict for local dev's tip |
| B-640 | bug | dropped | fixes-bug |  | Close Better Auth's update-user path so a member can't set an external avatar image |
| B-641 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry: 'gave lorazepam 1/2 mg' at a 0.5 mg strength may not record the usual dose |
| B-642 | bug | triaged | fixes-tooling |  | Connector todays_doses test fails from midnight to 00:10 Los Angeles: its given dose, placed 10 minutes before now, lands on yesterday |
| B-643 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry: a request with a day still leads with a vital or symptom dated ahead: 'check bp 120/80 tomorrow', 'ask about pain tomorrow morning' |
| B-644 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry dates a counted ordinal before a place: 'gave a 2nd at the clinic', 'received the 2nd at the clinic' log on the 2nd instead of now |
| B-645 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the header the tabs carry what each reads: U… |
| B-646 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry may still date a counted ordinal with no place: 'gave a 2nd' at the end of a line, or 'a 2nd at the clinic' with no verb |
| B-647 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry: a request with a later day misses its part of day or leads with a vital: 'pick up walker next friday morning', 'check bp 120/80 friday' |
| B-648 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry: 'gave lorazepam 1/2' at a 0.5 mg strength with a usual '2 tablets' records 2 tablets, overstating what was typed |
| B-649 | bug | triaged | fixes-tooling |  | A skeptic's --force treats an unreadable GitHub as no known dev brake; it could fail closed |
| B-650 | bug | triaged | fixes-tooling |  | Unattended planner report's veto line sets flags=hold, dropping a row's design or standing flag |
| B-651 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry: a decimal at the strength overstates the dose: 'gave lorazepam 0.5' at 0.5 mg with a usual '2 tablets' records 2 tablets |
| B-652 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry: a counted ordinal before a clock time still takes a day: 'gave the 2nd at 2pm' reads as the 2nd of the month at 2pm |
| B-653 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the list an item leaves the Planner tab once… |
| B-654 | bug | triaged | fixes-tooling |  | CI flake: scripts/loops/lease.test.mjs: pnpm prd check's check lease makes the runs beyond the default limit of two wai… |
| B-655 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry: a counted ordinal before a part of day may still take a day: 'gave the 2nd at night', 'gave the 2nd in the morning' |
| B-656 | bug | triaged | fixes-bug |  | Timeline: a period starting just after midnight in the recipient's zone shows day 1 on two headers for a viewer behind that zone |
| B-657 | bug | triaged | fixes-bug |  | Pass log: after a successful Add a medication with unsaved dose edits, the sheet stays open and Back leaves without asking, losing the edits |
| B-658 | bug | triaged | fixes-tooling |  | CI flake: packages/api/src/admin/usersAdmin.int.test.ts: admin.users.get shows the account, its sessions, groups and ma… |

## Items

### B-31 · feature · Guided onboarding for new users: a first-run flow that walks a new member through setting up and using the app (the real requirement; details to refine)

- status: landed
- prd: onboarding
- owner: prd/onboarding
- commit: ab7d3d15

- 2026-11-18 (Robert Bo Davis): From the invites interview (2026-11-18): out of scope there, noted for later. Each new account gets a private demo group with fictional seed data (timeline, notes, vitals; later meds and providers) it can explore and delete.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'onboarding' (to write): a private fictional demo group for each new account, made from the seeds' data on sign-up (or on demand from /app home), deletable. Builds on invites (done).
- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): before launch, onboarding flows may point new members at the connect guide (Settings → Devices, Group settings → Assistants), which nothing links to outside settings today. For alpha, the user points testers at it by hand.
- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): B-31 is now a general guided onboarding requirement. The seeded, fictional demo group (the old title: 'Demo group for every new user: a seeded, fictional care group to explore the app') is one idea under it, not the requirement, and needs refining. The onboarding PRD's planner should interview the user on the flow first.
- 2026-11-22 (plan/onboarding): Planned in onboarding (2026-11-22): guided setup in the person's real care group. The demo is no longer part of this item: it is the separate demo-site topic, by the user's word.
- 2026-11-23 (prd/onboarding): Slice 3's setup card is on the full timeline only, so an owner in Easy mode doesn't see it; check this when slice 5 adds the Easy welcome.

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
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-240 · bug · pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (review.sh:77), verified. Exit 75 when the summary never changes.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-241 · bug · codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (codex-review.mjs:37), verified. Paginate, or refuse clean when hasNextPage.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-244 · chore · codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): User's decision 2026-11-21. One-line change in openFindings (scripts/loops/codex-review.mjs) plus a test on the outdated.json fixture. Declined, non-outdated threads still need reply + resolve. Update docs/agents/orchestrator.md _Landing a wave_ step 4, docs/orchestration.md and the orchestrator prompt line in prompt.sh (+ prompt.test.mjs): only declined threads need --resolve.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

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

### B-286 · bug · A repeatable 5xx from sync.upload blocks a device's upload queue forever: no retry cap, and the sync indicator never shows uploadError or the queue length

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. sync.ts:913-919 throws on every non-4xx; client.ts retries the same batch. Known triggers: a timeline_entry PUT replayed after the uploader was demoted to viewer (nothingUpdated is mapped for PATCH at sync.ts:175, not for PUT), a NUL character in any text column, table __proto__. Fix idea: quarantine an op after N identical failures and show the pending count.
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

### B-299 · bug · Visit prep's 'Missed doses' reads history through today's schedule: a schedule change shows phantom misses back to the last visit

- status: ready
- prd: dose-accuracy
- owner: prd/dose-accuracy
- commit: 788a5315

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. dueDoses.ts:289-326 (the comment admits it), lib/appointments/visitPrep.ts:320. Also: a pass moved by more than 2 h unmatches earlier doses logged without passId; a medication added at 15:00 shows its 08:00 slot overdue. Fix idea: expand slots per schedule epoch from the medicationChange entries.
- 2026-11-21 (plan/dose-accuracy): Planned in plans/dose-accuracy-prd.md and -plan.md (2026-11-21): B-297 is slice 1, B-298 slices 2 and 3, B-299 slices 4 and 5.

### B-304 · bug · Deleting an old event in Google Calendar rewrites past Caretook records: soft-deletes a past reminder note, cancels a past appointment, marks a todo done for the group

- status: landed
- prd: calendars-2
- owner: prd/calendars-2
- commit: 4ccc9653

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

- status: landed
- prd: calendars-2
- owner: prd/calendars-2
- commit: 4ccc9653

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

- status: landed
- prd: calendars-2
- owner: prd/calendars-2
- commit: 4ccc9653

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
- 2026-11-23 (plan/member-avatars): member-avatars skeptic, 2026-11-23: confirmed in the code. /update-user accepts image from any signed-in user, it syncs to co-members, and UserAvatar renders it as an img. The web CSP blocks external images, but a native build gets no such header, so a member could learn co-members' IPs. No app code calls it. Land before any native build ships; account-security is on hold.

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

- status: landed
- prd: onboarding
- owner: prd/onboarding
- commit: 9f383ea2

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Tracked nowhere before this review.
- 2026-11-22 (plan/onboarding): Planned in onboarding (2026-11-22): new sign-ups and invite accepts only, existing accounts are not asked (the user's answer). Also links and records the Consumer Health Data Privacy Policy (the user's answer).

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
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. prd.sh:212. A new synced table or stream column passes a quick check with its guard never run. Overlaps B-272.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): check-speed's always-run list landed; verify whether sync-matrix.test.mjs and rolesSql.test.ts are in it before working this (may be done or a one-line add).
- 2026-11-22 (prd/test-health): test-health ended 2026-11-22 (landed 2e526422) without slicing this; proposed for fixes-tooling
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.

### B-371 · chore · Device-to-server round trip per table through the app's own writers, comparing column values on the second device (today: hand-written INSERTs, id only, browser suite only)

- status: triaged
- prd: test-health-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. scripts/browser-checks/roundtrip.spec.mjs:556, sync-matrix.mjs. Component tests have no connector (apps/web/test/device.tsx); queuedWrites is used in two files. Also: seed device fixtures in the JSON shape PowerSync really delivers, validated against the server's Zod schemas (test/database.ts:187, test/fixtures.ts:290,332).
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-22 (prd/test-health): test-health ended 2026-11-22 (landed 2e526422); new coverage out of its scope, proposed for a follow-up PRD test-health-2
- 2026-11-23 (plan/test-health-2): Planned 2026-11-23 in plans/test-health-2-plan.md (six slices; runs after test-gates-2 and sync-safety). B-374: a whole-batch 400 is resent one change at a time (the user's answer, a103).

### B-372 · chore · A second time zone in tests: device, recipient and seed are all America/Los_Angeles in 106 of 113 component test files, while 29 production call sites read the device's zone

- status: triaged
- prd: test-health-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Suggest a Vitest browser instance in America/New_York for the timeline, doses and appointments screens; pin TZ in the node projects.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-22 (prd/test-health): test-health ended 2026-11-22 (landed 2e526422); new coverage out of its scope, proposed for a follow-up PRD test-health-2
- 2026-11-23 (plan/test-health-2): Planned 2026-11-23 in plans/test-health-2-plan.md (six slices; runs after test-gates-2 and sync-safety). B-374: a whole-batch 400 is resent one change at a time (the user's answer, a103).

### B-373 · chore · Role coverage gaps: a removed member writing or reading a care table, staff support on care tables, non-member writes through sync upload on 10 of 15 tables, and a real every-procedure unauthenticated sweep

- status: triaged
- prd: test-health-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. router.int.test.ts:56 'rejects every procedure without a user' calls two. One parametrised sync test across HANDLERS covers most. Standing priority 2 (every role against every table) had no item. Overlaps B-283.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-22 (prd/test-health): test-health ended 2026-11-22 (landed 2e526422); new coverage out of its scope, proposed for a follow-up PRD test-health-2
- 2026-11-23 (plan/test-health-2): Planned 2026-11-23 in plans/test-health-2-plan.md (six slices; runs after test-gates-2 and sync-safety). B-374: a whole-batch 400 is resent one change at a time (the user's answer, a103).

### B-374 · chore · A test for the device's uploadData: a 400 or 500 from sync.upload must not wedge the queue

- status: triaged
- prd: test-health-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. apps/web/app/lib/sync/client.ts has no test. Goes with the sync-safety queue item.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): new coverage, which the test-health PRD lists as out of scope; not in any slice. Proposed: a follow-up PRD (test-coverage) rather than this one.
- 2026-11-22 (prd/test-health): test-health ended 2026-11-22 (landed 2e526422); new coverage out of its scope, proposed for a follow-up PRD test-health-2
- 2026-11-23 (plan/test-health-2): Planned 2026-11-23 in plans/test-health-2-plan.md (six slices; runs after test-gates-2 and sync-safety). B-374: a whole-batch 400 is resent one change at a time (the user's answer, a103).

### B-375 · chore · Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. B-278 and B-279 already cover the shared integration database and the frozen lists.
- 2026-11-21 (prd/test-health): test-health orchestrator (2026-11-22): the timelineScroll retry: 2 part is slice 15's; the rest (calendars.int toBeTruthy, check-areas packages/ mapping, web:unit ~/ alias) fits a later test-health wave or fixes-tooling.
- 2026-11-22 (prd/test-health): test-health ended 2026-11-22 (landed 2e526422) without slicing this; proposed for fixes-tooling
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

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

### B-404 · feature · One command to ship dev to staging: push dev, open the dev into staging PR, wait for Codex's review, triage its findings into the backlog (verified against the code, duplicates noted on the existing item), merge the PR when nothing is a blocker, and notify the user only when something is

- status: triaged
- prd: staging-ship
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Asked for 2026-11-21 after doing it by hand on PR #25. Proposed for orchestration-3 (the dispatcher): same unattended tooling, and it can raise a blocker through orchestration-2's asks queue (pnpm prd ask). To settle in the PRD: what counts as a blocker (today's rule: critical and breaking only, the rest are follow-ups); staging changes only by PR and is deployed by deploy.yml; Codex signals no findings with a thumbs-up reaction and no review, so the wait reads its summary comment's state; a timeout when Codex never answers.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.

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
- 2026-11-22 (plan/self-recovery): Planned in plans/self-recovery-prd.md (slices 1, 2, 4, 5, 6). B-462 and B-463 moved from fixes-tooling because an unattended recover runs that path.

### B-408 · feature · Stuck workers handled by the orchestrator: it tracks how long its commands and slice agents have run against their usual time, stops and restarts a stuck one on its own judgement (once), and for a judgement call asks a fresh skeptic agent first and the user through the asks queue only if that doesn't settle it

- status: triaged
- prd: worker-watch
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Asked for by the user 2026-11-21: unsticking workers is manual work they do often. Triaged to orchestration-3 (hot file scripts/loops/prompt.sh; the dispatcher reopens dead sessions, this covers live-but-stuck ones; asks from B-391). Exists today: browser checks have a 90 s silence limit, a cap and one contention retry (loop.md, Limits); pnpm prd check is timed in .loops/.check-times.log; nothing covers a hung pnpm check, a slice agent that has gone quiet, or a helper subagent. Proposed shape: (1) every long command runs with a budget from its usual time (check-times medians, scaled for load) and a silence limit, and a breach is reported with its last output, not just killed; (2) the orchestrator records each slice agent's start and last sign of progress (commit, file change in its worktree, message) and on no progress messages it, then restarts it once with --continue; (3) a second stall, or a stop that could lose work (uncommitted changes, a migration or landing step under way), is a judgement call: a fresh skeptic agent reads the evidence and decides, and files an ask with a recommendation only when it can't or the step is risky; (4) pnpm prd status shows each running command's and agent's age against its usual time. Open for the PRD: the thresholds, and whether the dispatcher's tick does the watching so an orchestrator that is itself stuck is caught. Could be its own small topic if orchestration-3 passes about six slices (it now has B-392, B-404, B-406, B-407 and this).
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-22 (plan/worker-watch): Planned in plans/worker-watch-prd.md: B-434 is slice 1; B-408 is slices 2 to 6 (check budget, heartbeat and status, the watch, orchestrator response, dispatcher).

### B-417 · feature · We are getting close to feature complete. We need another marketing content pass that updates copy…

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: We are getting close to feature complete. We need another marketing content pass that updates copy and layout to reflect the new features. Also improve ui to meet modern design standards. NO SCREENSHOTS yet. No videos.
- 2026-11-21 (Robert Bo Davis): Triage: marketing topic (on hold). A copy and layout pass for the new features plus a design refresh; no screenshots or videos, so it does not wait on B-40.
- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): before launch, the marketing language should cover connecting your own Claude or ChatGPT (the connectors / MCP connect guide under Settings → Devices and Group settings → Assistants).

### B-418 · bug · Flaky tooling test under load: recover.test.mjs '--at a time that has passed waits until tomorrow' fails in the full pnpm test:tooling run and passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Seen 2026-11-21 about 17:20 PT in a full pnpm test:tooling run on dev (1 of 495 failed) with load averages 19 to 30; the file alone passed 3 of 3 (22 tests each). The assertion output was not captured. Likely a timing or wall-clock dependence (the case compares against the current time); reproduce under load, then fix the race rather than rerun. Proposed for test-health, which holds the flaky-test work.
- 2026-11-22 (prd/test-health): test-health ended 2026-11-22 (landed 2e526422) without slicing this; proposed for fixes-tooling
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.

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
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-432 · chore · After a landing that changes the lockfile, pnpm prd land runs pnpm install in the main checkout (or files an ask) instead of only printing a reminder

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. land.sh and ready.sh print the reminder; an unattended landing leaves the main checkout stale. Needs care: the main checkout is the user's. Small tooling fix.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-433 · feature · A usage-limit signal and a cost record: sessions detect an approaching usage limit so the dispatcher can drain (B-407 assumes one), and tokens or cost are recorded per PRD and slice

- status: triaged
- prd: self-recovery
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Nothing detects a limit or records cost today; orchestrator.md only documents the model per role.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-22 (plan/self-recovery): Planned in plans/self-recovery-prd.md: the usage signal is slice 3. Its cost record is split into its own item under self-recovery-2.

### B-434 · feature · Run metrics beyond check times: slice and landing durations, flake rate and how often Codex finds something, in one summary command

- status: triaged
- prd: worker-watch
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Only .loops/.check-times.log and pnpm prd check --times exist; B-408 needs usual times to spot a stuck worker.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-22 (plan/worker-watch): Planned in plans/worker-watch-prd.md: B-434 is slice 1; B-408 is slices 2 to 6 (check budget, heartbeat and status, the watch, orchestrator response, dispatcher).

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

### B-438 · plan · Headless orchestrator sessions: runs that need no terminal tab, so a helper cannot outlive or die with its window

- status: triaged
- prd: self-recovery-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. Deferred in the orchestration-2 PRD with no item; a large idea, may deserve its own topic.
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-22 (plan/self-recovery): Moved to self-recovery-2 by the self-recovery planner to keep that PRD at six slices. A headless session has no status line, so it needs another source for the usage reading.

### B-442 · bug · pnpm prd tidy --yes deletes dead leases from its earlier snapshot without lease.sh's takeover mutex and fresh liveness check

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Codex P2 on PR #33 (tidy-cli.mjs:259), verified: plain rmSync on the lease path; a lease retaken in between is deleted. Use lease_take_over's .takeover protocol.
- 2026-11-21 (Robert Bo Davis): Codex raised this again as a P2 on PR #34 (dev into staging, head f5234c8); checked against dev: the code is unchanged, so this item covers it. No new item filed.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-443 · bug · land.sh to-test file lists no items after a local landing: items are already landed, not ready, once dev has the merge

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Codex P2 on PR #33 (land.sh:140): capture the ready items before the merge and reuse them in the report. The PR path is unaffected only if the backlog read precedes dev-sync; check both.
- 2026-11-21 (Robert Bo Davis): Codex raised this again as a P2 on PR #34 (dev into staging, head f5234c8); checked against dev: the code is unchanged, so this item covers it. No new item filed.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-446 · bug · browser.test.mjs 'kills a spec at its cap, worker and all, and retries it once' fails under heavy load (load 47), passes alone 3x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Seen in orchestration-2 wave 5's quick check on b7541467 (2026-11-21): expected false to be true after 9.7 s. Real-time sleeps; make it wait on the event, not the clock.
- 2026-11-22 (prd/fixes-tooling): 2026-11-22 (fixes-tooling wave 1, slice 6's test:tooling, 5-min load ~50): browser.test.mjs failed with 3 output lines where 2 were expected (not a timeout); passed alone.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: browser.test.mjs failing under load, and B-573 and B-624 are the same extra output line. Fix together.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.

### B-447 · bug · to-test file: 'What wasn't checked' repeats the quick-check line, and a tooling-only landing still gets the app's dev URL and seed sign-ins under 'What to try'

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Seen on the first real file, to-test/2026-11-21-1838-orchestration-2.md (orchestration-2 wave 5). For a diff that is only scripts/ and docs, name the commands to try instead.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-452 · bug · Dispatcher: a start or plan whose new.sh fails after making the worktree leaves it with no managed record, so later ticks treat it as opened by hand and it holds a slot for good

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #39 (dispatch.mjs:408, r4655894803), verified: writeRecord comes after the new.sh break. Fix: write the managed record (setup state) before new.sh, or remove the partial worktree on failure.
- 2026-11-21 (prd/orchestration-3): orchestration-3 ends with wave 3: this Codex follow-up on dispatch.mjs moves to fixes-tooling
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: fixes-tooling wave 1, after test-gates lands. Wave 1 is the test worker cap (B-542) first, then the dispatcher, ask and notice races (B-452, B-454, B-525, B-526). Keep it small: these files are shared with agent-autonomy, self-recovery and worker-watch.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-453 · bug · Dispatcher: a 'hold the topic' answer is consumed and the reopen count cleared even when the backlog write fails, so the same tick reopens the session

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #39 (dispatch.mjs:353, r4655894808), verified: updateState deletes asked/reopens regardless of r.ok. Fix: only consume the answer and the count after the hold is written; otherwise skip the topic and retry.
- 2026-11-21 (prd/orchestration-3): orchestration-3 ends with wave 3: this Codex follow-up on dispatch.mjs moves to fixes-tooling
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-454 · bug · Dispatcher lock: two dispatchers starting together over a stale lock can both take it (the takeover unlinks the path from an earlier pid read)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #39 (dispatch.mjs:200, r4655894813), verified: takeLock unlinks unconditionally after reading a dead holder; Codex reproduced 6/30. Fix: atomic takeover (rename a temp lock over it and re-read, or a mkdir lock).
- 2026-11-21 (prd/orchestration-3): orchestration-3 ends with wave 3: this Codex follow-up on dispatch.mjs moves to fixes-tooling
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: fixes-tooling wave 1, after test-gates lands. Wave 1 is the test worker cap (B-542) first, then the dispatcher, ask and notice races (B-452, B-454, B-525, B-526). Keep it small: these files are shared with agent-autonomy, self-recovery and worker-watch.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

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

### B-459 · chore · Backlog: 151 items read 'live' because the dev-into-staging-into-main release merge (cc3e1d8b, B-33) put their commits on origin/main, though production hasn't launched; give live a real meaning (a production marker such as a tag or a recorded deploy) or show main as staging until launch

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (slice/fixes-nit/3): From B-380 (fixes-nit slice 3), 2026-11-21: status is derived (scripts/backlog/format.mjs derive: containing origin/main means live) and recomputed on every write, so a hand or bulk set of live items back to staging would be undone, and archived items can't be set at all. Not changed here. Option: derive live from a production tag or deploy record instead of origin/main; the status words in docs/agents/backlog.md follow.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-461 · bug · tidy-cli.test.mjs fails as a whole file under heavy load (load about 30) in pnpm test:tooling, passes alone 3x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (hotfix/reseed-staging): Seen 2026-11-21 on hotfix/reseed-staging (a8c39d78), which does not touch scripts/loops/: 1 failed file of 45, 638 tests passed, the failure at file level (no test named), with the 1-minute load near 32. Alone it passed three times in 7 to 9 s. Same family as B-446 (browser.test.mjs under load).
- 2026-11-22 (prd/agent-autonomy): 2026-11-22 (prd/agent-autonomy): failed as a whole file again in pnpm test:tooling at 5-min load ~19; passed alone and in a full rerun
- 2026-11-22 (prd/fixes-tooling): Likely the same cause as B-460 (tidy-cli.test.mjs setup waited on new.sh's load gate), fixed by 4dc59ddd in fixes-tooling wave 1; confirm under load before closing.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.

### B-462 · bug · pnpm prd recover reopens the dispatcher even when a test-Postgres, stack or server step failed, so it can reopen managed sessions on broken infrastructure

- status: triaged
- prd: self-recovery
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (recover.sh:220), verified: the dispatch action ignores failed[]; gate it like after_infrastructure and keep the intent for the next run
- 2026-11-22 (plan/self-recovery): Planned in plans/self-recovery-prd.md (slices 1, 2, 4, 5, 6). B-462 and B-463 moved from fixes-tooling because an unattended recover runs that path.

### B-463 · bug · pnpm prd recover after a crash loses the dispatcher's restart intent when its reopen fails: clear-lock deletes the stale lock first, and no record is kept

- status: triaged
- prd: self-recovery
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (recover.sh:220), verified: persist the intent before clearing the lock, drop it after a good start
- 2026-11-22 (plan/self-recovery): Planned in plans/self-recovery-prd.md (slices 1, 2, 4, 5, 6). B-462 and B-463 moved from fixes-tooling because an unattended recover runs that path.

### B-464 · bug · The backlog prompt's hold line (pnpm backlog prd set <topic> flags=hold) replaces the row's flags, dropping standing or alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (prompt.sh:30), verified: setRow replaces the flag list; tell it to keep the current flags, or give prd set an add/remove form
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 8 (planning and prompts). After agent-autonomy, which holds prompt.sh.

### B-465 · bug · pnpm prd down keeps stopping servers, stacks and the test Postgres when the dispatcher won't stop in time (mid new.sh), racing a start against the shutdown

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-3): Codex P2 on PR #41 (down.sh:50), verified: failed=1 but the loop goes on; stop there and keep the down record for a retry
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

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
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-474 · change · Inbox agent plan amendments from the user: it never leaves staged or uncommitted changes behind (stash, or commit and push), and someone is named as owning cleanup of completed items

- status: triaged
- prd: inbox-agent
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): The user's answers to the inbox-agent planning report (ask a20, 2026-11-21, backlog session). They confirmed the plan (inbox-only pushes to origin/dev with automatic dev-sync; the Next up list; asks-relay after inbox-agent) with two additions, in their words: (1) 'inbox cannot leave staged changes ever. it must either stash or commit/push'; (2) 'inbox agent (or somebody) needs to have responsibility for cleanup of complete items'. For the inbox-agent orchestrator: fold both into the PRD and the slices that own them (B-425 the agent and its pushes; B-406 Next up; B-435 archiving). Backlog session's reading of (2): finished work must not pile up anywhere the user reads, so one named owner removes Next up lines and inbox bullets whose items have landed, as well as archiving tracker items; the plan's cleanup run archives tracker items only. Ask the user if the owner or the scope is unclear.

### B-477 · change · PRD registry: a hold carries its reason

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): User, 2026-11-21 (backlog session): "we probably need a 'hold reason' field for some of these holds to make them easier to manage in another session that doesn't have this context." Backlog session's sketch, not the user's words: pnpm backlog prd set <topic> flags=hold takes a reason (and a date), prd list, prd status and dispatch --dry-run print it beside 'on hold', and clearing the hold clears it; dispatch --pause already takes a <why>. Reasons for the holds set in this session, to fill in when the field exists: planner-3 (a note can carry a todo) is held because its landed plan must be revised to the user's design first, see the note on B-245; contract-migrations, asks-relay, sync-safety-2, ui-kit-3, code-health-2 and code-health-3 are held only to stop planning from burning model usage (user's pick, 2026-11-21), not for any problem with the topics: release them when the user wants planning to resume.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-479 · bug · calendarCron.int.test.ts 'runs the reminders first, then Google push and pull, and the series top-up last by default' times out at 5 s under load (passes alone)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/fixes-bug): fixes-bug landing full check 2026-11-21, 1-min load ~28; passed 3/3 alone. Give it a longer timeout like the other cron tests.
- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (prd/ui-kit-3): Seen again in ui-kit-3 wave 1's full check, 2026-11-22 (a282700a), load ~42; passed alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-480 · bug · timelineQuickEntry.browser.test.tsx 'the user's units are used, and an explicit unit wins' misses 'Saved 1 entry' under load (passes alone)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/fixes-bug): fixes-bug landing full check 2026-11-21, 1-min load ~28; passed 3/3 alone. Check whether it reads before the save renders (fix the race, not the timeout).
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-485 · bug · Flaky under load: print.browser.test.tsx 'Next, Previous and This week move it by a week…' reads 2027-06-07 for 2027-05-31 (Matcher did not succeed in time) in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/ui-kit-2): Seen in ui-kit-2's wave-1 full check (2026-11-22, load ~11); passed alone 3x.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-486 · bug · Flaky under load: planner.browser.test.tsx 'an item leaves the Planner tab once its end or its start passes' times out at 15 s (it steps 4 h of fake timers); fails alone 3/3 at load ~18, passes 3/3 at ~8

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen by fixes-bug wave 2 full check (2026-11-22). Step the clock in fewer, larger jumps, or raise this test's timeout. Also seen once: search.sync.browser.test.tsx rebuild-under-2-s timing (passes alone 3/3).
- 2026-11-22 (prd/ui-kit-2): Also seen in ui-kit-2's wave-1 full checks (2026-11-22, twice, load ~17); B-487 was its duplicate.
- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-488 · bug · Flaky under load: passes.browser.test.tsx 'adds a pass, last in the list; a taken name (any case) is refused on its field' fails in about 200-330 ms beside other component files (2 of 3 with four files), passes alone 6x

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/ui-kit-2): Seen in ui-kit-2's wave-1 gate (2026-11-22, load ~17). Also failing in the same full check, passing alone: provider.browser 'Edit opens the directory's sheet', providers.browser contact rows (B-44 tests), mcp.int 60 calls/min 429.
- 2026-11-22 (slice/ui-kit-2/3): ui-kit-2 slice 3 (71fce0c5): the 'adds a pass' test clicked $('main [data-add-pass]')! once, a read-before-render race (fails in ~200 ms when the button isn't there yet). Rewritten: the add now goes through the header's + menu via found(), and the taken-name message is polled. Likely fixed; watch the next gate.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-489 · bug · Flaky under load: Button.browser.test.tsx 'a submit Button submits its form once, however quickly it's tapped' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-490 · bug · Flaky under load: List.browser.test.tsx 'a row with to is one link covering the row; its trailing control is still clickable' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-491 · bug · Flaky under load: primitives.browser.test.tsx 'at 1280, dark > Tooltip: hover and keyboard focus show it…; Escape hides it' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-492 · bug · Flaky under load: search.sync.browser.test.tsx 'about 2,000 entries: the rebuild takes under 2 s, and a query under 50 ms' misses its timing in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: the same search speed test. Fix once and close both.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.

### B-493 · bug · Flaky under load: entryMentions.browser.test.tsx 'a viewer sees mentions as links to the provider's page… and gets no popup' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-494 · bug · Flaky under load: plannerSeries.browser.test.tsx 'renaming, this and later: later visits take the new title' (and once 'a viewer's page asks nothing and offers no Edit') fail in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-495 · bug · Flaky under load: profile.browser.test.tsx Basics, Contact and Insurance sheet tests ('refused on its field… nothing sent') fail in full checks (4 of 7 runs); passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-496 · bug · Flaky under load: provider.browser.test.tsx 'Edit opens the directory's sheet, filled in; Cancel goes back to the page' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-497 · bug · Flaky under load: frame.browser.test.tsx 'a tap on Settings opens /app/settings, which keeps the header and has no group menu' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: component flake filed before the harness fix B-607 (d0fe52d8). Re-measure before fixing, and close if it no longer fails.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-498 · bug · Flaky under load: syncAppointmentSeries.int.test.ts 'takes a series and its visits, documents and links from one batch, and again on a replay' times out in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-499 · bug · Flaky under load: syncPasses.int.test.ts 'refuses a viewer, a moved group, and another group's pass' times out at 5 s in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-500 · bug · Flaky under load: appointmentSeries.int.test.ts 'writes visits through today + 90 for a series without them' fails in full checks (2 of 7 runs); passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-501 · bug · Flaky under load: recipientCondition.int.test.ts 'refuses viewers, outsiders and staff, and another group's recipient' fails in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-502 · bug · Flaky under load: search.int.test.ts 'searches a group of 10,000 entries in under 200 ms' reads 210 ms in a full check; passes alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-bug): Seen in fixes-bug wave 2 full checks (2026-11-22, 7 runs at load 11-20, overlapping ui-kit-2's); passes alone 3/3.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-511 · feature · Skeptic before every ask: a session sends its question, options and evidence to a fresh Fable skeptic first; it decides (reversible, within the rules) or confirms the question is the user's; pnpm prd ask records the verdict

- status: landed
- prd: agent-autonomy-3
- owner: prd/agent-autonomy-3
- commit: 46b69b38

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: build the Fable 5.2 skeptic into more of the workflow; Fable reviews in short passes, Opus does the long work. Pairs with B-503 default on silence; a31 and a33 would likely have been decided.
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-3 (to write) by agent-autonomy's planner (2026-11-22): filed after that plan landed with six slices; this builds on its defaulting asks (B-503) and flake rule (B-505).
- 2026-11-22 (plan/agent-autonomy-3): 2026-11-22 planned in agent-autonomy-3 (skeptic's go is enough for --force/--no-review, the user's pick)
- 2026-11-22 (Robert Bo Davis): Skeptic models changed 2026-11-22 (eb41417e): asks and plan checks run on Opus, risky landings stay on Fable. The PRD and plan are updated; where this item's title says Fable, this note wins. The design flag's planner stays on Fable.

### B-512 · feature · Skeptic before risky landings: a Fable skeptic reviews the evidence before land --force, landing on flaky tests (B-505) or declining a Codex finding, and the landing report says what it said

- status: landed
- prd: agent-autonomy-3
- owner: prd/agent-autonomy-3
- commit: 30befe2f

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: build the Fable 5.2 skeptic into more of the workflow; Fable reviews in short passes, Opus does the long work.
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-3 (to write) by agent-autonomy's planner (2026-11-22): filed after that plan landed with six slices; this builds on its defaulting asks (B-503) and flake rule (B-505).
- 2026-11-22 (plan/agent-autonomy): 2026-11-22: B-505 (landing on flaky tests) was dropped; the flaky case to guard is now test-gates' quarantine (B-530) and a brake/--fixes landing
- 2026-11-22 (plan/agent-autonomy-3): 2026-11-22 planned in agent-autonomy-3 (skeptic's go is enough for --force/--no-review, the user's pick)
- 2026-11-22 (Robert Bo Davis): Skeptic models changed 2026-11-22 (eb41417e): asks and plan checks run on Opus, risky landings stay on Fable. The PRD and plan are updated; where this item's title says Fable, this note wins. The design flag's planner stays on Fable.

### B-513 · change · Opus planners and backlog sessions with a Fable final check: the skeptic pass runs on Fable and may send a plan back; a registry flag (e.g. design) keeps a heavy design topic's planner on Fable

- status: landed
- prd: agent-autonomy-3
- owner: prd/agent-autonomy-3
- commit: 7b6491b2

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: build the Fable 5.2 skeptic into more of the workflow; Fable reviews in short passes, Opus does the long work. Last 36h: main-checkout Fable sessions read 428M tokens, Fable planners 148M. The default model moved to Opus on dev the same day; this item adds the flag and the send-back rule.
- 2026-11-22 (plan/agent-autonomy): Moved to agent-autonomy-3 (to write) by agent-autonomy's planner (2026-11-22): filed after that plan landed with six slices; this builds on its defaulting asks (B-503) and flake rule (B-505).
- 2026-11-22 (plan/agent-autonomy-3): 2026-11-22 planned in agent-autonomy-3 (skeptic's go is enough for --force/--no-review, the user's pick)
- 2026-11-22 (Robert Bo Davis): Skeptic models changed 2026-11-22 (eb41417e): asks and plan checks run on Opus, risky landings stay on Fable. The PRD and plan are updated; where this item's title says Fable, this note wins. The design flag's planner stays on Fable.

### B-515 · feature · Always-on backlog and inbox sessions: the dispatcher keeps one backlog and one inbox session running and reopens a dead one; they don't count against the three PRD slots, and the context watch (B-507) rotates them too

- status: triaged
- prd: inbox-agent
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: backlog and inbox sessions must hand off to a fresh agent of the same type from the phone, and stay running alongside the dispatcher. Needs the inbox agent (B-425, inbox-agent) for the inbox half; until it lands, the backlog session only.
- 2026-11-22 (plan/agent-autonomy-2): 2026-11-22 planned: agent-autonomy-2 slices 5-6 keep the backlog session alive; the inbox half lands with whichever of agent-autonomy-2 and inbox-agent comes second (it then sets this landed)
- 2026-11-22 (prd/agent-autonomy-2): Slice 5 (db78a219) keeps the backlog session alive; stays open until inbox joins the kept-alive kinds.
- 2026-11-22 (prd/agent-autonomy-2): Slice 6 merged (0b028f59): the context watch rotates backlog sessions. Stays open until inbox is in the kept-alive kinds.
- 2026-11-22 (prd/agent-autonomy-2): Backlog half landed in agent-autonomy-2 (783d596d). Left for inbox-agent slice 5: add inbox to KEPT_KINDS in scripts/loops/keep-alive.mjs, to rotate.sh, rotate-into.sh and session.sh, and the hand-off paragraph to the inbox prompt; that closes this item.

### B-518 · change · Land without re-syncing when dev's changes don't touch the branch: land.sh's drift refusal relaxes when dev's new commits share no file with the branch and bring none of the risky files; land still merges dev and typechecks the result, and the landing report says it landed on an unsynced tip

- status: landed
- prd: agent-autonomy
- owner: prd/agent-autonomy
- commit: 8080fb0c

- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user: agents should tell each other before and after merging to dev, and the test gates should loosen by what dev changed, as the Codex verdict carry-over did, to cut the 'dev changed, rerun tests' churn. Added to the planned agent-autonomy on the user's pick: its orchestrator amends the PRD and plan. The user chose this too, knowing the risk: changes in different files can still break each other at runtime; typecheck catches some.
- 2026-11-22 (plan/agent-autonomy): Planned 2026-11-22 in plans/agent-autonomy-plan.md: slice 9 (land on an unsynced tip; typegen and typecheck of the merge in a check lease).
- 2026-11-22 (Robert Bo Davis): 2026-11-22: agent-autonomy held after wave 1 by the user; test-gates moves the long checks to CI, so rescope this against the test-gates plan before it runs.

### B-525 · bug · Asks: two processes taking over a dead holder's ask lock can both remove it, so one deletes the other's fresh lock and an answer and a default overlap (asks.mjs withAskLock)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/agent-autonomy): 2026-11-22 (prd/agent-autonomy): Codex P2 on PR #58 (asks.mjs:227), verified in code: lockIsStale then rmSync with no takeover mutex. Use lease.sh's .takeover protocol or rename-then-verify.
- 2026-11-22 (Robert Bo Davis): Codex re-flagged this on PR #63 (dev into staging, b36300cf, P2, scripts/loops/asks.mjs:227); verified still present on dev.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: fixes-tooling wave 1, after test-gates lands. Wave 1 is the test worker cap (B-542) first, then the dispatcher, ask and notice races (B-452, B-454, B-525, B-526). Keep it small: these files are shared with agent-autonomy, self-recovery and worker-watch.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-526 · bug · Notices: two concurrent posts can lower the .seq high-water mark (check-then-rename), so after both expire a notice id is reused and a late notices --done withdraws a newer notice (notices.mjs createNotice)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/agent-autonomy): 2026-11-22 (prd/agent-autonomy): Codex P2 on PR #58 (notices.mjs:152), verified in code: readSeq < n then rename isn't atomic. Serialise the seq update (a lock) or derive ids so they can't go back.
- 2026-11-22 (Robert Bo Davis): Codex re-flagged this on PR #63 (dev into staging, b36300cf, P2, scripts/loops/notices.mjs:152; it reproduced the n1/n2 interleaving); verified still present on dev.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: fixes-tooling wave 1, after test-gates lands. Wave 1 is the test worker cap (B-542) first, then the dispatcher, ask and notice races (B-452, B-454, B-525, B-526). Keep it small: these files are shared with agent-autonomy, self-recovery and worker-watch.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-527 · bug · Todo Undo and Done writes are voided with no catch (TodoUndoStatus.undo, useTodoTick's run via void complete(...)): a write that throws becomes an unhandled rejection, with nothing shown to the user

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 8eea8805

- 2026-11-22 (prd/fixes-tooling): Found by fixes-tooling slice 7 (B-475), 2026-11-22, reading the code: no .catch on the voided writes. Show the error (or a toast) and catch it.

### B-532 · chore · Staging candidate: cut a release candidate branch from a green dev commit and open the PR into staging from it; CI runs the lean browser suite on the Docker stack against that fixed commit; only fixes go onto it

- status: in-progress
- prd: test-gates-2
- owner: prd/test-gates-2
- commit:

- 2026-11-22 (Robert Bo Davis): From the 2026-11-22 backlog session: the user's test-gate tiers and modes; being planned inline. User chose a candidate branch over freezing dev.
- 2026-11-22 (plan/test-gates): Follow-on topic test-gates-2 (cut from test-gates on 2026-11-22; see plans/test-gates-prd.md, Solution tiers 3-4).
- 2026-11-22 (plan/test-gates-2): Planned 2026-11-22 in plans/test-gates-2-plan.md (slices 1-4). Candidate branch with a merge -s ours of staging; the tool gates promotion and a hand merge is the user's override.

### B-533 · chore · staging to main gate: CI runs the full browser suite, a second time zone and repeated runs to catch flakes; a required status check on main always, on staging only in pre-deployment mode

- status: in-progress
- prd: test-gates-2
- owner: prd/test-gates-2
- commit:

- 2026-11-22 (Robert Bo Davis): From the 2026-11-22 backlog session: the user's test-gate tiers and modes; being planned inline. User chose main always, staging by mode. Relates to B-372 (a second time zone in tests).
- 2026-11-22 (plan/test-gates): Follow-on topic test-gates-2 (cut from test-gates on 2026-11-22; see plans/test-gates-prd.md, Solution tiers 3-4).
- 2026-11-22 (Robert Bo Davis): The modes (B-531) are dropped: decide the required check on staging without a pre-deployment mode when test-gates-2 is planned. With no automatic run on dev, the staging gate is the only check of dev as a whole.
- 2026-11-22 (plan/test-gates-2): Planned 2026-11-22 in plans/test-gates-2-plan.md (slices 2, 5, 6). Required release-gate check on main with a recorded user override; second time zone reports first; the user adds the check to the ruleset after a first green status.

### B-542 · chore · Unit-test projects run at Vitest's default workers (cores - 1, 9 here): two overlapping checks run ~18 test processes on 10 cores, the load behind the under-load timeouts; cap the unit group at about 4 (or half the cores) and time it against check-times

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): Filed from the backlog session 2026-11-22 at the user's request. Component tests (2), integration (3), Playwright (1), check slots (2) are already capped; only the unit group isn't. fixes-tooling: a check-speed and flake fix.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: fixes-tooling wave 1, after test-gates lands. Wave 1 is the test worker cap (B-542) first, then the dispatcher, ask and notice races (B-452, B-454, B-525, B-526). Keep it small: these files are shared with agent-autonomy, self-recovery and worker-watch.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.

### B-543 · question · Split the orchestration tooling into its own multi-project tool, or replace it with a prebuilt one

- status: triaged
- prd: orchestration-split
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): User 2026-11-22: tooling is robust enough to manage work across all projects on this machine; keep handrolling vs adopt a prebuilt option. Size: ~23k lines in scripts/loops, scripts/backlog, .githooks (~11k tests), 105 files tied to caretook. The top four registry rows (test-gates, agent-autonomy 1-3) are all orchestration. Decide before planning: freeze, extract, or replace.
- 2026-11-22 (Robert Bo Davis): Deferred to after launch (user, 2026-11-22): the only other active project is a legacy BigCommerce Stencil site with no tests, a poor fit for this process, so no multi-project need yet. Revisit after launch.

### B-544 · chore · vitest.config.ts:196 comment still names worker databases <name>_w<VITEST_POOL_ID>; they're caretook_tw_<stem>_<hash>_w<n> since B-405

- status: triaged
- prd: fixes-nit
- owner:
- commit:

- 2026-11-22 (prd/fixes-tooling): Left by fixes-tooling wave 2 (slice 13): editing vitest.config.ts forces a full check, so not folded at landing.

### B-545 · chore · rm.sh reads pnpm backlog prd list --json twice (lines ~57 and ~71); reuse $rows to save a node start per rm

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-tooling): Found by fixes-tooling wave 2 slice 11 while timing rotate.test.mjs (2026-11-22).
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-548 · feature · Group-wide tags on every record (entries, todos, providers, medications, events), filterable

- status: triaged
- prd: tags
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): first version is one shared tag list per care group, on all records (timeline entries, todos, providers, medications, events), with a tag filter on each list and in search. Triage: new topic tags (a new table and join rows, sync streams, every list's filter); big, wants a PRD. Overlaps planner-3's todo schema and search.
- 2026-11-22 (Robert Bo Davis): User 2026-11-22, corrects the answer to a69: Easy helpers can rename only tags they created. Owners, admins and caretakers can rename any tag. Only owners can delete a tag.
- 2026-11-22 (plan/tags): Planned 2026-11-22: plans/tags-prd.md and -plan.md, six slices. The user chose: owners, admins and caretakers tag and rename anything; Easy helpers create tags, tag their own entries and rename only tags they created; only owners delete a tag. Runs after symptom-catalog.

### B-549 · feature · Symptoms become a catalog type: a default set for every group, writers add new ones quickly with a similar-name check; filter the timeline by several symptoms at once

- status: triaged
- prd: symptom-catalog
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): the symptom's free-text name should not be free text; it becomes its own type in the database. A base default set that all groups have from the start; writers add new symptoms easily and quickly; gate on similar or matching symptoms during add. The original bullet also asked for a multi-value filter (several symptoms at once). Triage: new topic symptom-catalog: a migration (catalog table, entries point at it, backfill from today's names, additive), quick entry's symptom parsing, visit prep and day summaries group by it. Overlaps quick-entry-2 and the timeline filters.
- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): the symptom's free-text name should not be free text; it becomes its own type in the database. A base default set that all groups have from the start; writers add new symptoms easily and quickly; gate on similar or matching symptoms during add. The original bullet also asked for a multi-value filter (several symptoms at once). Triage: new topic symptom-catalog: a migration (catalog table, entries point at it, backfill from today's names, additive), quick entry's symptom parsing, visit prep and day summaries group by it. Overlaps quick-entry-2 and the timeline filters.
- 2026-11-22 (plan/symptom-catalog): Planned 2026-11-22: plans/symptom-catalog-prd.md and -plan.md, six slices. The user chose that everyone who can log may add a symptom. Runs after quick-entry-2 and dose-accuracy.

### B-550 · feature · Nested todos: subtasks up to 3 levels deep, a parent completes when its last subtask is done

- status: triaged
- prd: todo-subtasks
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): any depth in the model, limited to 3 levels in code; the parent auto-completes when its last subtask is done. Triage: new topic todo-subtasks (a parent_id on todo, sync, the Planner and todo screens). Depends on planner-3 (held, revising todo links), which owns todos/ and the todo schema; run it after.

### B-551 · feature · 'bye' for every agent role: a message of just 'bye' runs a handover check; nothing left means the session closes itself, otherwise it asks the user what to do with what's left

- status: triaged
- prd: inbox-agent
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): every agent type needs this; details are the agent's. Proposed shape: one shared command (e.g. pnpm prd bye, or a step every role doc points at) that checks the handover state for the session's role: uncommitted or unpushed work, a worktree or branch still out, leases and dev servers held, running background jobs or subagents, open asks it filed, peers waiting on a promised reply, notices to act on, memory to update. Clean: write the hand-off line (what was done, what waits), release leases, run pnpm prd end (or the role's end), and close the session. Not clean: one AskUserQuestion per open thing (finish it, hand it off, drop it), then check again. Each role doc (loop, orchestrator, planner, backlog, hotfix, recovery) names its own extra checks. Fits agent-autonomy-2's session work (recorded sessions B-437, rotate --self B-514); that plan is written, so its orchestrator adds a slice or its planner folds it in.
- 2026-11-22 (Robert Bo Davis): Moved to inbox-agent by the user (2026-11-22): agent-autonomy-2 is done and inbox-agent owns session handling. Its plan has no slice for this yet.

### B-557 · feature · quick date jump on timeline via date picker AND quick entry

- status: triaged
- prd: timeline-jump
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): Decided with the user 2026-11-22: jumping scrolls the continuous timeline to that day, with a Back to today control. An empty day lands on the nearest earlier day with entries and says so. Quick entry jumps only on an explicit phrase (go to Nov 3, jump to last Tuesday, show yesterday), giving a Go to card that navigates and saves nothing. The picker allows past dates through today. Note: the timeline loads by growing a limit on scroll, so a far jump needs a plan for loading that day.
- 2026-11-22 (Robert Bo Davis): Triaged to timeline-jump: a timeline feature with its own loading question; after quick-entry-2 because both change the quick entry parser.
- 2026-11-22 (plan/timeline-jump): Planned in plans/timeline-jump-prd.md: a bounded ?day= window with paging both ways, a toolbar picker, and a whole-line Go to card in quick entry; four slices.

### B-560 · feature · A cost record: tokens by model per PRD and slice, from session and subagent transcripts, in pnpm prd cost

- status: triaged
- prd: self-recovery-2
- owner:
- commit:

- 2026-11-22 (plan/self-recovery): Split from B-433 by the self-recovery planner. Needs a SubagentStop hook for per-slice totals, no double counting across --continue, and reconciling at rm because a session end can be missed. Unattended runs never spend extra usage, so tokens remain the measure.

### B-561 · feature · Shared demo site: demo.caretook.com with a fictional care group, generic logins and a nightly reset, to link from invites

- status: triaged
- prd: demo-site
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): User's design 2026-11-22. Separate environment (own Vercel, Neon, PowerSync, secrets); never in production because the seed guard forbids fictional data beside real data. One shared non-owner caretaker login, optional viewer login; no public sign-up; password rotatable. Permanent banner: everyone sees entries, no real information, erased nightly. Server-side blocks: email, invites, Google Calendar, connectors, calendar feeds, export, and changes to the demo login's password, email, sessions or account. Own reset, not resetStaging: that keeps non-example accounts and makes them owners of every seeded group. Nightly and manual reset, dates relative to today, noindex, test a device returning with offline edits after a reset. Mail needs a hard off switch, not an empty allowlist. Later if public: a throwaway group per visitor.

### B-562 · change · Notice before a material change to the legal pages: the privacy policy promises notice and consent where required, and nothing does this yet

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-22 (plan/onboarding): From the onboarding skeptic (2026-11-22). onboarding records versions but builds no re-ask, by the user's answer on existing accounts; this needs a decision before the legal text changes materially.
- 2026-11-22 (Robert Bo Davis): Triage: data-rights, beside B-358 (what the legal drafts may promise); it is a consent and notice duty to users. Needs a decision before the legal text changes materially.

### B-563 · feature · Accessibility statement page

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-22 (plan/onboarding): Split from B-360's review note (2026-11-22); out of scope for onboarding.
- 2026-11-22 (Robert Bo Davis): Triage: marketing, a public page beside the privacy policy and terms (B-54).

### B-564 · change · App-store prerequisites for the Capacitor apps

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-22 (plan/onboarding): Split from B-360's review note (2026-11-22); out of scope for onboarding.
- 2026-11-22 (Robert Bo Davis): Triage: hosting, the nearest launch topic. No Capacitor topic exists yet; move it there when one does.

### B-565 · feature · Ownership transfer: a last owner can hand a care group to another member

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-22 (plan/onboarding): Split from B-360's review note (2026-11-22): careGroupMemberService says the last owner must hand over ownership first, and no flow does. Related to the open question on a last owner deleting their account.
- 2026-11-22 (Robert Bo Davis): Triage: data-rights, because it decides what account deletion does for a last owner (the open question in AGENTS.md).

### B-568 · bug · Component tests that failed once on CI's Linux runners: providers rows, provider empty links, emergency sheet, search speed, timeline Back, weekly print chart

- status: triaged
- prd: fixes-tooling
- owner: prd/test-gates
- commit:

- 2026-11-22 (slice/test-gates/3): Found by test-gates slice 3; each differs between runs of the same code, causes not investigated. providers.browser (rowLinks, two different tests: https://github.com/caretook/caretook.com/actions/runs/45076033356 https://github.com/caretook/caretook.com/actions/runs/45077489750); provider.browser 'with no links' and emergency.browser 'builds the list' (https://github.com/caretook/caretook.com/actions/runs/45076033356); search.sync.browser 2,000-entry speed, timelineBack.browser B-235 and medications print.browser weekly chart (https://github.com/caretook/caretook.com/actions/runs/45076033291).
- 2026-11-22 (Robert Bo Davis): Moved to test-gates by the user (2026-11-22): these keep the components CI tier from going green. B-568's intermittent failures go through the flake quarantine (B-530).
- 2026-11-22 (slice/test-gates/9): Slice 9 quarantined six tests (print weekly chart, emergency builds the list, provider with no links, both providers rowLinks tests, timelineBack B-235). Not quarantined: search.sync.browser's 2,000-entry speed test, which is on the brake list. In run https://github.com/caretook/caretook.com/actions/runs/45088030543 the provider and both providers tests failed again in the quarantine step, reading rows before the first render (rowLinks: undefined.querySelectorAll), so they look like read-before-render races rather than load flakes.
- 2026-11-22 (prd/test-gates): test-gates slice 9 quarantined six of these (scripts/ci/quarantine.txt names this item); keep it open, since closing it removes the entries. Moved to fixes-tooling because the PRD leaves fixing the flakes there. The search speed test is on the brake list, so it is not quarantined. In CI run 45088030543 the three provider tests failed again in the quarantine step: they read a row before it renders (undefined.querySelectorAll in rowLinks), so they look like read-before-render races to fix; cause not confirmed.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-570 · bug · Session request notices can exceed the notice board's 200 characters and get dropped

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/agent-autonomy-2): Codex P3 on PR #72, verified: requestNotice in scripts/loops/session-requests.mjs has no length bound. With 40-character names a refusal reaches 201 characters (longer opener errors too); createNotice rejects it, requestStep logs and ignores that, so the request settles but the requester hears nothing. Fix: truncate the text to MAX_TEXT, keeping the id and outcome.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-573 · bug · Browser harness 'one spec' test fails now and then in a busy check: it gets a third output line where it expects two, and the check's rerun skips it as an unhandled error

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/test-gates): test-gates wave 2 gate on 6e805ecd (2026-11-22, load about 15): browser.test.mjs:182 got 3 lines, not 2; the check printed 'an unhandled error, so no rerun'. Passed 3/3 alone straight after at load 17. The extra line's content was not captured, so the cause is unknown.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: not in fixes-tooling wave 1. Re-measure after the test worker cap (B-542) and test-gates' quarantine land; fix only what still flakes, in a later wave.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: browser.test.mjs failing under load, and B-573 and B-624 are the same extra output line. Fix together.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.

### B-574 · bug · ESLint aborts with exit 134 in the lint step of a check, seen in two worktrees within a second

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/test-gates): Found by test-gates slice 10 on 2026-11-22: its first slice check died in lint with exit 134, ui-kit-3-6 hit the same exit within a second and again on its next run, and slice 10's rerun passed unchanged. The top of the crash output wasn't captured, so the cause is unknown.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: test-gates wave 4 (2991461a) gave local lint 6 GB, the likely fix for both. Confirm no recurrence, then close.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.

### B-576 · bug · Local pnpm lint runs out of memory at Node's default 4 GB heap: CI sets 6 GB, local checks don't

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-ui): Seen 2026-11-22 on prd/fixes-ui (7c90a0e4): eslint exit 134 at about 3.98 GB with 5-minute load 12, so not load. check --times shows 12 lint failures. ci.yml already sets NODE_OPTIONS=--max-old-space-size=6144; the local lint script sets nothing. Fix: give local lint the same heap, or cut type-aware ESLint's memory.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: test-gates wave 4 (2991461a) gave local lint 6 GB, the likely fix for both. Confirm no recurrence, then close.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.

### B-577 · change · Finish the UI kit sweep: timeline, entries and quick entry (TodayRow, PassLogItem, EasyNext, EntryBody, the four skeleton files, containers); admin, account, connectors, marketing and the app frame (home's h1); then empty the guard's not-swept list and drop Menu's bare class-string trigger

- status: landed
- prd: ui-kit-5
- owner: prd/ui-kit-5
- commit: 06b21030

- 2026-11-22 (plan/ui-kit-4): Cut from B-398 by the ui-kit-4 plan (2026-11-22): about 300 files is too many for one topic, and quick-entry-2 is running in quick entry. Carries B-398's notes for these areas, including the remaining Cancel and Save footers, No-yet lines, dark-contrast text and icon sizes.
- 2026-11-23 (plan/ui-kit-5): ui-kit-5 plan (2026-11-23): seven slices in three waves: timeline list and Today; timeline forms; Easy view and quick entry; entries and notes; admin; account, connectors and marketing; then the frame, home and closing the guard. B-613, B-617 and B-618 keep their parts in fixes-ui.

### B-578 · bug · Quick entry reads other slash numbers as dates: 'gave 1/6 tylenol', 'bp 12/8', 'pain 5/5'

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 8a0f495b

- 2026-11-22 (prd/quick-entry-2): From quick-entry-2 hand-offs, 2026-11-22. Only the common fractions, n/10 and a number before a unit are excluded. AMOUNT_UNIT_WORDS in quickEntryTime.ts is kept in step with AMOUNT_UNITS by hand.
- 2026-11-22 (prd/quick-entry-2): 2026-11-22 (quick-entry-2): a proper fraction with denominator 2, 3, 4, 5, 6 or 8 directly before a medication on a dose line is now the amount (e4fde503). Still open: 'bp 12/8', 'pain 5/5' and other slash numbers read as dates.

### B-580 · bug · Quick entry dates a line ending in 'sat' to Saturday: 'she sat'

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 330d9639

- 2026-11-22 (prd/quick-entry-2): From quick-entry-2 hand-offs, 2026-11-22. Follows the PRD's end-of-line rule. Related: 'dr lee the 2nd at the clinic' gets no date.
- 2026-11-23 (slice/fixes-bug/22): Slice 22: trailing 'sat' after a pronoun, family word or member name is no longer Saturday. 'dr lee the 2nd at the clinic' still gets no date: that is ordinalIsADay (an ordinal before 'at <place>'), a different rule, not fixed here.

### B-581 · bug · Quick entry keeps 'call the pharmacy in the morning' at 7:00 as a note, not a todo

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: b0cd6f61

- 2026-11-22 (prd/quick-entry-2): From quick-entry-2 hand-offs, 2026-11-22. With no day said the usual hour reads back to yesterday. Also: 'at 12 this morning' resolves to midnight with no test row.

### B-582 · bug · MCP rate-limit integration test times out at 5 s under machine load

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/quick-entry-2): mcp.int.test.ts 'allows 60 calls a minute per connection': timed out in the quick-entry-2 full check (load about 20), passed when rerun alone. Needs a longer timeout or a cheaper world, as the list_timeline test got in B-394.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.

### B-583 · change · Connector wording still says appointment: tool and prompt text, its kind: appointment output and the consent text; decide whether they move to Event (a consent change may need a version bump)

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-22 (prd/fixes-ui): Found by fixes-ui slice 12 (B-537), which kept these on purpose: packages/api/src/connectors/ is API-facing and tests pin it; connectorRules.ts is consent text. Needs the user's call before any slice.
- 2026-11-22 (Robert Bo Davis): 2026-11-22, the user's call: connectors should respond the same to 'event' and 'appointment'. Keep both words working in tool and prompt text (prompts.ts, upcoming.ts, listTimeline.ts, writes.ts are static strings the assistant reads, so naming both is the change). Not decided: renaming prepare_for_appointment or the kind: appointment output; no consent text change or version bump is called for by this.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user's call: rename to Event. The prepare_for_appointment tool and the kind: appointment output both move to Event, with no alias for the old names (the user was told connected assistants may rely on them). Connectors still understand both words in tool and prompt text. Check at build time whether connectorRules.ts consent text is affected: a consent change may need a version bump.

### B-584 · chore · Backlog prompt: "deploy staging" trigger that promotes dev and notifies my phone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user, 2026-11-22. Add a "deploy staging" trigger to the backlog session prompt (scripts/loops/prompt.sh). Workflow: find or open the dev to staging PR; wait for Codex and triage its findings (verified non-blockers become backlog follow-ups); check what changed since the reviewed commit; if no blockers, merge pinned to the checked head with a Conventional subject; watch deploy.yml in the background; when it ends, success or failure, call the PushNotification tool so the result reaches the phone. A blocker stops the merge and is pushed as well. Triaged to fixes-tooling: prompt tooling.
- 2026-11-22 (Robert Bo Davis): The phone step depends on B-586 (pushes from the backlog session do not arrive): fix or replace that route first.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 8 (planning and prompts). After agent-autonomy, which holds prompt.sh.

### B-586 · bug · Phone notifications from the backlog session never arrive

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user, 2026-11-22. PLANNER: test this with the user on the real phone before planning a fix or calling it fixed; do not rely on the tool result. Seen: 4 PushNotification calls from the backlog session all returned "Terminal notification sent. Mobile push requested." and none arrived, including one filed with pnpm prd ask (a81) and one with the phone locked and the app closed, so an open app is ruled out for that last one. Setup: session started with --remote-control backlog, agentPushNotifEnabled true, inputNeededNotifEnabled false, CARETOOK_ASK_NOTIFY unset. Cause unknown. To compare: whether a push from a managed prd- session or the dispatcher helper reaches the phone, phone OS and Claude app notification settings, and whether CARETOOK_ASK_NOTIFY should provide a separate route. Blocks the phone step of B-584. Triaged to fixes-tooling: notification tooling.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-591 · bug · Quick entry reads a fraction after the medication as a date: 'gave tylenol 3/8' logs the usual dose on March 8

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: c177aa58

- 2026-11-22 (Robert Bo Davis): Codex on PR #82 (quickEntry.ts:1907), reproduced on db91f582: with a usual dose of 2 tablets, 'gave tylenol 3/8' gives amount 2 tablets dated 2026-03-08, while 'gave 3/8 tylenol' gives 3/8 tablet now. isFractionAmount only looks forward for the medication. Sibling of B-578.

### B-593 · feature · Choose your avatar: a color and icon instead of plain initials

- status: triaged
- prd: member-avatars
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): User decision 2026-11-22: no Gravatar (a third party would see viewer IPs and email hashes) and no photo upload for now. Each member picks a color and an icon from a fixed set in their account settings, and everyone in their care groups sees it wherever UserAvatar, AvatarStack and author initials appear (Timeline, Planner, members, live-note editors, the header). Members who have not chosen keep initials. Open for the planner: whether initials can sit on the chosen color, a default color per member, and contrast in both themes. Colors must not be confused with section or status colors. Needs an additive migration, sync to co-members, and validated values on the server. Stored choices are ids from the fixed set, never free text or URLs. Works offline with no external requests, so the image CSP stays as is. Photo upload is not part of this.
- 2026-11-22 (Robert Bo Davis): User decision 2026-11-22: a member who has not chosen defaults to a color different from everyone else in the group. This settles the earlier open question on a default color. For the planner: one person can be in several groups, so the default is per group, and every device must agree on it offline (for example, worked out from a stable order such as join order, skipping colors members chose). A member's default should not change when someone else joins or leaves if that can be avoided. When a group has more members than colors, colors repeat, and the initials or icon still tell members apart.
- 2026-11-23 (plan/member-avatars): Planned 2026-11-23: plans/member-avatars-prd.md and -plan.md, four slices. Default colors are derived on each device; the choice is two user columns synced to co-members.

### B-594 · change · Manage allergies on the Profile page; Medications keeps a read-only summary

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): User decision 2026-11-22. An allergy is a fact about the care recipient, so Profile becomes the one place to manage it. (1) Add an Allergies section to the Profile page next to Conditions, with add, edit, remove and No known allergies, for the same roles as today. (2) The Medications list and each medication page keep a read-only allergy summary with a Manage link to Profile, and severe allergies stay prominent: the safety check must stay where medications are given and added. (3) Printed sheets, the emergency sheet and the connector view do not change. Must work offline as Conditions does, although most of the Profile page does not sync. No migration expected: recipient_allergy already belongs to the recipient and syncs. Old allergy URLs should redirect or keep working. Triage: fixes-ui (flow change on existing data). Sequencing: ui-kit-4 sweeps the medications and profile folders, so take this after those slices land or coordinate through hot files; if it proves too large for a fixes slice, move it to its own topic.

### B-595 · chore · Slice agents read only their slice's section and the PRD decisions it cites, not the whole plan and PRD

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): Highest payoff. Startup docs are about 110 KB (30k tokens), while slice 6's own section is 2.9 KB. Change prompt.sh. Wait until test-gates wave 5 lands: it is editing prompt.sh. Evidence: test-gates slice 6 (B-528) took three Opus agents (174k, about 165k, 87k tokens); they stopped on the project's 160k context watch in scripts/loops/context.mjs, not proven model limits. Sizes are estimates from files; transcripts not broken down. Filed at the test-gates orchestrator's request; awaiting the user's review.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 8 (planning and prompts). After agent-autonomy, which holds prompt.sh.

### B-596 · chore · Cap slice size at planning: split a slice touching more than about 8 files or several hot files

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): Slice 6 touched 15 files (about 990 lines added, 330 removed) and should have been three: proposal and gate logic, ci gate, then land and pr wiring. Evidence: test-gates slice 6 (B-528) took three Opus agents (174k, about 165k, 87k tokens); they stopped on the project's 160k context watch in scripts/loops/context.mjs, not proven model limits. Sizes are estimates from files; transcripts not broken down. Filed at the test-gates orchestrator's request; awaiting the user's review.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 8 (planning and prompts). After agent-autonomy, which holds prompt.sh.

### B-597 · chore · Split scripts/ci/ci.mjs and scripts/loops/prompt.sh so an agent reads only the part it needs

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): Both are about 40 KB, within about 195 KB (55k tokens) of code slice 6 had to understand. Wait until test-gates wave 5 lands: it is editing both. Evidence: test-gates slice 6 (B-528) took three Opus agents (174k, about 165k, 87k tokens); they stopped on the project's 160k context watch in scripts/loops/context.mjs, not proven model limits. Sizes are estimates from files; transcripts not broken down. Filed at the test-gates orchestrator's request; awaiting the user's review.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 8 (planning and prompts). After agent-autonomy, which holds prompt.sh.

### B-598 · chore · Keep a plan's Status short by moving finished-wave history out of it

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): test-gates' Status is 8.9 KB of a 37 KB plan. Could be a rule in the orchestrator handbook. The test-gates orchestrator can trim its own Status itself. Evidence: test-gates slice 6 (B-528) took three Opus agents (174k, about 165k, 87k tokens); they stopped on the project's 160k context watch in scripts/loops/context.mjs, not proven model limits. Sizes are estimates from files; transcripts not broken down. Filed at the test-gates orchestrator's request; awaiting the user's review.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 8 (planning and prompts). After agent-autonomy, which holds prompt.sh.

### B-599 · bug · Assistants settings: connection labels stay stale when another owner flips read only while the page is open

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 850e5403

- 2026-11-22 (prd/assistant-access): From assistant-access slice 2: the toggle and status follow by sync, but row labels come from connector.listForGroup and refresh only on the next load.

### B-600 · change · Context watch: a soft limit where the agent decides and a hard limit where it hands off, set per agent type

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): The user: complex coding runs on Opus, so agents have a 1M window. Opus 5.5 is listed at 1M, and a recent session's cache read reached 235k, past any 200k cap. Today limitOf in scripts/loops/context.mjs gives every session and subagent one 160k limit, about 16% of the window, so slice agents hand off far too early (B-528 slice 6 needed three). Proposed start: 300k for slice agents, tuned from real runs. Update docs/agents/loop.md and machinery.md, which state 160k. Pairs with B-595 and B-596. Runs after test-gates with the rest of fixes-tooling. Exact number awaits the user's review.
- 2026-11-22 (Robert Bo Davis): Replaces the single raised limit (user, 2026-11-22: soft and hard limits, the agent decides whether the work is worth continuing; numbers left to us). Slice agents: soft 175k, hard 300k. Orchestrators and backlog sessions: soft 160k, hard 225k. Soft: one reminder asking the agent to judge: continue if it is mid-change or holds understanding a fresh agent would pay to rebuild, hand off at a natural boundary, and say which in its hand-off. Repeat only every further 25k, not every 10 minutes. Hard: commit and hand off now; repeats on every tool call and --keep cannot silence it. Still never blocks a tool call, so uncommitted work is not stranded. The dispatcher's nudge, question and rotation start at the hard limit, not the soft one. --keep is refused on slice branches today, so a slice's decision needs no command. Touches context.mjs, dispatch-context.mjs, their tests, loop.md and machinery.md.
- 2026-11-22 (Robert Bo Davis): User chose a hotfix in its own session for the slice-agent part only (soft 175k, hard 300k): session backlog - slice-context-limits. Orchestrator limits and the dispatcher stay here, after test-gates.
- 2026-11-22 (Robert Bo Davis): Slice-agent part landed in dev as 86447987 (local hotfix): every orchestrator subagent now has soft 175k (judge, repeats every further 25k) and hard 300k (hand off on every tool call), as constants. Worktree-launched orchestrators get it at their next pnpm prd sync on the prd/ branch; sessions launched from the main checkout get it at once. Remains here, after test-gates: orchestrator and backlog soft 160k and hard 225k, and moving the dispatcher to the hard limit. Known hole, not fixed: pnpm prd context --keep from a subagent outside a slice/ branch mutes its orchestrator for 30 minutes.
- 2026-11-23 (Robert Bo Davis): The user, 2026-11-23: a backlog session's context limit must be soft and never a forced close. Past the limit it notifies the user and lets them choose (hand off or keep going). No answer means keep going. Today backlogReminder tells the session to hand off without asking, and the dispatcher's question defaults to rotating (context.mjs, dispatch-context.mjs). Do this first in fixes-tooling.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-601 · bug · Back right after a failed sheet save skips the discard prompt and loses the edits: the leaving flag stays set until the next touch

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: ef127ef8

- 2026-11-22 (prd/fixes-ui): Codex P2 on PR #84, verified in useSheetChanges.ts: submit sets leaving.current and only a later pointer, key, input or change clears it; focusin on the invalid field does not. Tie the bypass to a successful save.

### B-602 · bug · Discard prompt misfires or is missed: a sync after the first touch reads as a change, a record deleted elsewhere can prompt, and Back with an unguarded sheet on top of a changed one does not ask

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 43e222d4

- 2026-11-22 (prd/fixes-ui): Known gaps from slice 14 (B-316).
- 2026-11-22 (prd/fixes-ui): Also from fixes-ui slice 17 (B-603), read from useSheetExit and not reproduced: under reduced motion the discarded flag is not reset on a sheet that stays mounted, so a reopened guarded sheet may stop asking. Slice 17's invite sheets avoid it by rendering only while open.

### B-604 · chore · Test Discard under reduced motion in the sheet guard

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/fixes-ui): Gap from slice 14 (B-316).
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 5 (re-measure test flakes). The first slice re-measures after the harness fix B-607 and proposes closing what no longer fails. Only what still fails gets a fix slice.

### B-605 · bug · PageUp and PageDown on a date field's hour still wrap inside AM/PM, so 11 AM can page to 12 AM

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: c9d830ff

- 2026-11-22 (prd/fixes-ui): Found by fixes-ui slice 15 (B-585), which fixed the arrow keys only.

### B-606 · feature · Highlight a double dose on a next-dose-due notification

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-22 (prd/dose-accuracy): From the user's answer to dose-accuracy ask a92 (their words 'next dose tube notification', read as 'next dose due'). No such notification exists today: notifications are email only and none is about doses, push is a later plan. Needs a decision on what the notification is before this can be built.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user's call: in-app only for now. Show the double-dose warning on the medication and Today screens; no notification, email or push. A real next-dose-due reminder is a separate later decision. Triaged to fixes-ui because it is a display change; build it after dose-accuracy lands, since that topic defines extra doses (B-297) and is still changing the shared dose id (B-298).

### B-608 · chore · Format before the slice check: prettier --write on a slice's changed files, and --cache on the whole-repo check

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): User asked for this 2026-11-22. Today nothing auto-formats: the slice check runs prettier --check . and failed on format twice in fixes-ui. Add to the slice prompt: prettier --write --ignore-unknown on the slice's changed files and commit, before pnpm prd check (it refuses a dirty tree). Add --cache to the prettier --check in check-body.sh, using each worktree's default cache location. Measured on dev at load 34 with Prettier 3.10.1: no cache 26.3s, cold cache 23.9s, warm 2.5s. One cache file shared across worktrees did not help (20.5s in another worktree), so a fresh worktree's first run stays cold. CI gets no benefit unless the cache is restored between runs.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.

### B-609 · chore · Stale check-gate text after test-gates: prd.sh help (ci run exits, quick escalation), the hotfix prompt, the PR body and ready's local check line, and dead checked_ok in lib.sh

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (prd/test-gates): Found folding test-gates wave 5 docs. ci run --wait exits by kind (0-5, 75), planCheck no longer escalates to full, prompt.sh's hotfix prompt names no CI tier, pr.sh and ready.sh still print checked_how, checked_ok is used only by tests.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.

### B-611 · bug · A schedule change across midnight drops a dose's slot name in visit prep: a 23:30 dose given at 00:10 answers today's new 00:30 slot, and last night reads missed

- status: ready
- prd: dose-accuracy
- owner: prd/dose-accuracy
- commit: 788a5315

- 2026-11-22 (prd/dose-accuracy): Codex on PR #91 (P2), verified by reading scheduleHistory.doseName: it checks only the schedule of the day given, so a name valid for yesterday's slot within the two-hour window becomes unnamed. Fix: keep the name when it identifies a historical slot within the window.

### B-613 · change · Motion tuning: Today card slides open and shut, sheets fade only, overlays at 240 ms

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user's call after reviewing the motion from ui-kit-3 (B-471). (1) The Timeline Today card's expansion was missed: its chevron turns but the contents pop; use the kit's Collapse (TodayCard.tsx). (2) Sheets only fade: drop the 1.5rem panel slide, in and out. (3) 240 ms is the default for sheets, menus, popovers, native dialogs and toasts (menus and popovers are 120 ms today, the others 180 ms). Button, row and hover feedback stays at 120 ms. The user has not seen a toast yet, so check one by eye. Update the timings pinned in sheetExit.browser.test.tsx and the motion notes in app.css, components.md and the /dev/ui motion section. Reduced motion stays instant. The chevron's own speed was not discussed: keep it matched to the Collapse if it looks off, and say so.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user: the Today card and the day summary must match in speed and animation. Today's rows are a plain ul toggled with hidden, so they pop while its Chevron turns; the day summary (DaySummaryLine) uses Collapse at 240 ms with the same Chevron. Give TodayCard the same Collapse around its rows, so both have one slide, one duration and one chevron. Keep aria-controls pointing at the collapsing region, closed rows out of the tab order, and check the collapsed summary line in the header doesn't jump as it appears. Compare the two side by side in a browser.

### B-614 · bug · An offline log-then-Undo can delete another member's dose: the PUT is a no-op on their row, then the PATCH of deleted_at removes it (a PUT already carrying deleted_at does the same)

- status: triaged
- prd: dose-accuracy
- owner:
- commit:

- 2026-11-23 (prd/dose-accuracy): From slice 3's hand-off, read from the code, no test yet. timelineEntryService upsert first-upload rule plus the delete path in syncRegistry.ts. An offline edit by a writer also lands on the other member's row; an Easy helper's PATCH is refused and shows in Changes not saved.

### B-615 · bug · Connector log_dose names no slot, so two log_dose calls for one pass never merge into one dose; only give_pass converges

- status: triaged
- prd: fixes-bug
- owner:
- commit:

- 2026-11-23 (prd/dose-accuracy): From dose-accuracy slice 3's hand-off. log_dose always gets a random id.

### B-616 · bug · Two simultaneous first uploads of one dose id: the loser hits the primary key and gets a 500; a device retries into the no-op, but a connector run fails and must be retried

- status: triaged
- prd: fixes-bug
- owner:
- commit:

- 2026-11-23 (prd/dose-accuracy): From dose-accuracy slice 3's hand-off. timelineEntryService upsert, dose kind.
- 2026-11-23 (prd/dose-accuracy): Codex on PR #96 (P2, verified by reading assistantActionService slotDoseId): two concurrent give_pass runs can both read the slot id as free; the loser's create hits the primary key and rolls back its whole action batch, unrelated entries included. A rerun doesn't double the slot. Fix: claim or insert the id atomically and treat an existing dose as already logged.

### B-617 · bug · List tool buttons show no hover: search, filter and view on Timeline, filter on Providers and Planner

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): 2026-11-23, reported by the user: Timeline's search, filter and view mode buttons don't animate; the Filter on Providers and Planner doesn't change under the cursor. Likely cause, read from the code and not yet confirmed in a browser: CIRCLE in components/ui/styles.ts sets bg-base-100 and border-base-300, and those utilities beat daisyUI's layered btn hover colours, so all circle tools lose hover. Fix it once in the shared style, keeping the outlined circle at rest and giving it a visible hover and press at the kit's 120 ms. Check every list's Filter (FilterMenu), including Medications and Todos. chipClass uses the same bg-base-100 on unselected chips, so check those too. Also: Timeline's Filter is a hand-written button with btn classes in TimelineFilters.tsx; move it to the kit's IconButton (it needs its count badge kept). Verify hover by eye or a browser test in light and dark.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user: the author and type filter controls on timeline entries should also be buttons with a hover change and animation. KindFilterLink and AuthorFilterLink (components/entry/KindIcon.tsx) are hand-styled links: type has only hover:brightness-95 with no transition, author initials and name have no kit motion. Give them the kit's button feel (visible hover and press at 120 ms, none under reduced motion) in every form: type icon, initials circle and name link, on Timeline rows, cards and pass log items, and on the Planner, which shares them. They navigate to a filtered URL, so keep them real links with their names, using the kit's link-styled Button or look. Keep the accent colours and the row's stretched-link layering (z-10), so tapping one filters and doesn't open the entry.

### B-618 · change · Timeline day header: move Change care period to the left of the period text

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user: move Change care period on the Today timeline header to the left of the period text, so the page flows in a column. In DayPeriod (timeline/DayHeader.tsx) the order becomes the Change button, the period's type icon, then the text. Line the button's icon up with the column's left edge (the ghost button's padding must not indent it), and keep the text aligned when a viewer without write access sees no button or a past day has none. Check Easy mode, a long period name wrapping at phone width, and the sticky header.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user's correction, replacing the placement in the first note: Change sits directly left of the care period icon, within the right-hand group, not at the page's left edge. The goal: the care period icons line up down the page as the user scrolls past day headers. Order: [Change] [period icon] [text] [+]. Moving the button is not enough on its own: the group is right-aligned (ms-auto in DayHeader), so each icon's position depends on its text length ('day 9' vs 'day 10', or a different period name). Give the icon and text a shared column so the icon starts at the same x on every day header, with the text left-aligned after it; Today's Change hangs to the left of that column and must not shift it. Days without Change or without + (read-only viewers) must keep the same icon position where possible. Handle long names at phone width (wrap inside the column, no overflow), and check Easy mode, which has larger type and no Change. Verify by scrolling several days with different periods in a browser.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user's screenshot settles the scope, replacing the shared column in the previous note: this is only a button move. Today shows [icon] At home · day 6 [Change] [+], so Change pushes Today's period left of the same period on the day below. Move Change directly left of the period icon: [Change] [icon] [text] [+]. Keep the group right-aligned and add no column or fixed width; the text then ends at the same spot on every day, and the icons line up whenever the text is the same length. Check that Easy mode and a long name at phone width still wrap cleanly.

### B-619 · bug · CI flake: apps/web/app/lib/search/search.sync.browser.test.tsx: about 2,000 entries the rebuild takes under 2 s, and a …

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): [ci-key c6539843d37a] Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/test-gates.
- 2026-11-23 (prd/test-gates): Same test as B-492 (search.sync, about 2,000 entries, flaky under load), now seen on the CI Linux runner in run 45117253571: likely a duplicate, for fixes-tooling to merge.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: the same search speed test. Fix once and close both.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.
- 2026-11-23 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/onboarding.

### B-620 · bug · Timeline day headers repeat a care period day number when the viewer and recipient are in different time zones

- status: ready
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: ab9dcfae

- 2026-11-23 (Robert Bo Davis): 2026-11-23, reported by the user with a screenshot: just after midnight Eastern, Today and Yesterday both read 'At home · day 6'. Cause from the code: DayHeader splits days in the viewer's zone (dayKey), but DayPeriod counts periodDay in the recipient's zone from a moment (now for Today, the day's newest row for past days). At 00:34 EST it is still the previous evening in a Los Angeles recipient's zone, so both headers land on one recipient date. The recipient's zone on the user's group was not checked, and this was not reproduced in a test. Proposed fix: in a day header, derive the number from the header's own date, so consecutive headers always differ by one: the period's start date in the recipient's zone to dayKey, plus 1, minimum 1. Keep the period's page and other 'current' lines in the recipient's zone; during the offset hours Today's header can then read one day ahead of the period page, which the user should accept or overrule when reviewing. Which period a header shows (periodAt) should be checked for the same offset. Test with a viewer and recipient in different zones, both sides of midnight (see B-372, a second time zone in tests).
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user approved the proposed fix: each day header counts from its own date, so consecutive headers always differ by one. Accepted: for a few hours around midnight, Today's header can read one day ahead of the period's page, which stays in the recipient's zone ('nobody will do the math; the display bug will be noticeable'). No further decision needed.

### B-621 · feature · Quick entry: a tips panel under the box on a user's first 3 focuses, with examples, two shorthand codes and an X

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user: when a user clicks into the quick entry box, the first 3 times, a tooltip comes up below it with an advanced suggestion, to show it does more than it appears. No icon, no button, no dismiss control: just a line like: Why don't you try “bp 130/85 hr 72”? Use the examples removed with the rotating placeholder in 189bf74b (B-198), one per focus in order: bp 130/85 hr 72; gave metformin; pain 4 left knee; appt Dr Lee Friday 2pm. They still live in QUICK_ENTRY_RULES (quickEntryCopy.ts); share one list. Behaviour, proposed where the user did not say: shows only while the box is focused and empty; goes on typing or blur; floats over the page and pushes nothing (B-216), and takes no taps (pointer-events none); uses the kit's overlay fade at the motion default from B-613, nothing under reduced motion. Count real user focuses only: not autofocus, the refocus after Save, closing a sheet or returning from the Suggestions popover. Store the count per user per device in localStorage with try/catch, cleared with the app's other per-user keys at sign-out; if storage fails, show nothing. The box's accessible description already carries the rules, so screen readers should not hear the tip twice. Applies to the shared QuickEntryBox in both the full timeline and Easy mode: B-157 removed permanent typing tips from Easy mode, but this one is brief and the user named the easy entry box; in Easy mode check it against the dictation hint under the box. Must not cover name completions or the suggestions popover.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user's update, replacing the first note where they differ: the tip can be rather large and also shows the shorthand create codes. It is a panel below the box with: Why don't you try, then all four examples (bp 130/85 hr 72; gave metformin; pain 4 left knee; appt Dr Lee Friday 2pm, so none is dropped), then the codes the parser really takes: n: note, e: event, s: symptom, v: vital, d: dose, t: todo, and commas to log several at once. Read the codes from one shared list so the panel can't drift from the parser (PREFIXES and TODO_PREFIX in quickEntry.ts). It disappears when focus leaves the box. It shows on the first 3 focuses, and an X ends it for good on that first press (stored with the count). The X replaces the earlier no-button and no-taps rules: the panel takes taps, pressing the X or the panel must not blur the box first, and the X is a real labelled kit IconButton reachable by keyboard, with focus on it counting as still in the box. Proposed where the user did not say: it stays while typing a code, so the reference is there when needed, and gets out of the way when a preview card or name completions appear, since it must not cover them. At phone width with the keyboard up it must fit or scroll inside itself. The panel's text should not be read twice with the box's accessible description.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, the user: list only a couple of the shorthands: n: for a note and e: for an event. This replaces the full code list in the previous note: don't show s:, v:, d: or t:, and no shared list of codes is needed for the panel. The parser keeps accepting all of them. The four examples and the comma tip are unchanged.

### B-623 · bug · Check rerun never runs for tooling: check-body's 'unhandled error' grep matches a passing test's title

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/test-gates): scripts/loops/check-body.sh:69 greps the verbose output for 'unhandled error', and browser/check-body tests include the passing title "doesn't rerun after an unhandled error". So any tooling failure prints 'an unhandled error, so no rerun' and skips its one rerun. Seen on prd/test-gates 518a041f, 2026-11-23.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.

### B-624 · bug · browser.test.mjs 'passes a clean spec' fails under load: it expects exactly two output lines

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/test-gates): Failed in the quick check on prd/test-gates 518a041f (load about 32): 3 lines, not 2. Passed alone 3 of 3. Likely the load-wait line from browser.sh's load_gate_wait; not confirmed. Related: B-446.
- 2026-11-23 (Robert Bo Davis): Triage 2026-11-23: browser.test.mjs failing under load, and B-573 and B-624 are the same extra output line. Fix together.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 4 (known flakes by cause). One fix per shared cause: B-610 with B-571, B-619 with B-492, and B-624 with B-446 and B-573.

### B-625 · chore · Drop todo.event_id and its old-client mirror once no device writes it

- status: triaged
- prd: contract-migrations
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From planner-3 (B-245): link rows in timeline_entry_todo replace the column. Contract step: remove the column, the todoService mirror, the releaseEvent and unlink clears, and eventId on old upload paths.

### B-626 · feature · Decide whether a rescheduled event's todos follow it to the new event

- status: triaged
- prd: planner-3
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From planner-3 (B-245): today they stay on the old cancelled event while notes and providers are copied. planner-3 keeps that and pins it with a test. Needs the user's call before building.
- 2026-11-23 (Robert Bo Davis): The user, 2026-11-23: todos follow the rescheduled event. Planned in planner-3 slice 2: links move to the new event.

### B-627 · bug · A retried dose upload can undo a later Undo: B's accepted duplicate of A's dose, replayed after A deletes it, restores the dose as B's and marks the slot given again

- status: triaged
- prd: dose-accuracy
- owner:
- commit:

- 2026-11-23 (prd/dose-accuracy): Codex on PR #96 (P2, verified by reading timelineEntryService mayRestoreDose): the restore rule can't tell a retry of an already-accepted upload from a new log. sync.upload retries a whole batch when a later op fails, or a response can be lost. Needs upload identity or history before restoring. Decide with B-614 at the wave 4 boundary.

### B-628 · bug · Saving preferences reads then writes without a lock, so two simultaneous requests can lose a change such as a setup card dismissal

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 82eebf78

- 2026-11-23 (prd/onboarding): From onboarding slice 3: packages/api/src/app-shell/me.ts updatePreferences.

### B-629 · bug · Dismissing the setup card leaves keyboard focus nowhere, because the button disappears with the card

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-23 (prd/onboarding): From onboarding slice 3: GettingStartedCard.

### B-630 · chore · Two helpers build the legal page links (lib/auth/legalLinks.ts and settings account/legalLinks.ts): fold them into one

- status: triaged
- prd: fixes-nit
- owner:
- commit:

- 2026-11-23 (prd/onboarding): From onboarding slices 1 and 2; both use VITE_API_ORIGIN on native.

### B-631 · bug · Back can still skip the discard prompt after a refused action outside the submitted form: Add a medication in the pass log, or a refused delete

- status: ready
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 2a479df8

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 25 (B-601) hand-off, read from the code and not reproduced: only errors inside the submitted form end the no-prompt bypass in useSheetChanges. PassLogForm shows a refused Add a medication outside that small form, and the confirm path of a refused delete keeps the bypass.
- 2026-11-23 (prd/fixes-bug): Also from fixes-bug slice 26 (B-602): useSheetChanges counts a new value as the person's only within 300 ms of their press, key or edit. A picker that awaits longer would read as a sync and Back would not ask, losing the edit; a sync inside the window can still prompt. No such picker was found, but each one was not audited. The guardChanges={!gone} edits on the medication and todo edit routes have no test of their own.
- 2026-11-23 (slice/fixes-bug/42): From slice 42: refused Add and refused delete now ask on Back. Still open, reproduced with a throwaway component test: after a SUCCESSFUL Add a medication with unsaved dose edits, the sheet stays open and Back leaves without asking, losing the edits (the add's submit keeps the no-prompt bypass). Left as is because the slice's criterion says a successful add leaves without a prompt; needs a decision.

### B-632 · bug · Quick entry's fraction after a medication misreads a few lines: 'no pain gave tylenol 3/8', 'need to take tylenol 3/8', 'gave lorazepam 1/2' at 0.5 mg

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 82eebf78

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 21 (B-591) hand-off, read from the code and not tested: an opening 'no' counts as negating the dose so the first stays March 8; 'take' counts as given so the second loses its date; a fraction equal to the medication's strength should read as the strength (usual dose, no date). Also decide 'gave tylenol 3/8 at 9pm', now 3/8 tablet today at 9pm.

### B-633 · bug · CI flake: apps/web/app/routes/app/groups/timeline/timelineBack.browser.test.tsx: back from the entry page three pages d…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): [ci-key 33d04fe2a0f3] Flaked (passed on its rerun); found by prd/onboarding.

### B-634 · bug · Quick entry gives 'dr lee the 2nd at the clinic' no date: an ordinal before 'at <place>' is not read as a day

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: c2c53eee

- 2026-11-23 (prd/fixes-bug): Found in slice 22 (B-580). The cause is ordinalIsADay in quickEntryTime.ts, a different rule from the trailing 'sat' fix.

### B-635 · bug · Quick entry's request rule misreads a few lines with a part of day: 'check bp 120/80 in the morning' gets a note dated now and a todo alternative, 'ask about pain in the morning' reads as a symptom first

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: b1cf109f

- 2026-11-23 (prd/fixes-bug): From slice 23 (B-581) hand-off. Also: 'call dr lee in the morning' reads as an event first, the same as 'call dr lee tomorrow'; request detection is a word list, so an unlisted opening verb still reads back as a note.

### B-636 · change · Planner todo rows keep the old time column, so they align differently from event cards in the same list

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From fixes-ui wave 3's report (a93): event cards moved the time above the title (B-592), todo rows did not. Look and layout, so fixes-ui.

### B-637 · chore · About 20 settings and provider files still use text-base-content opacity classes instead of the UI kit

- status: triaged
- prd: fixes-nit
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From ui-kit-5's plan report (a104): left out because B-577 does not name them and the lint guard does not flag them. A small tidy, so fixes-nit.

### B-638 · chore · No test pins that a waiting join request from an account with no current legal acceptance isn't asked again

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/onboarding): From onboarding slice 4. The code returns the waiting request before the legal check (askWithLink in careGroupInviteService), but the test 'a waiting request isn't asked again' sends legal: true with a current row, so it doesn't prove this path.

### B-639 · bug · Unsynced landing can miss a brake on a newer origin/dev: land reads the verdict for local dev's tip

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/agent-autonomy): From agent-autonomy slice 4 (B-518). unsynced_dev_brake reads the tip of drift_ref, normally local dev. If local dev is behind origin/dev, a brake verdict on origin's newer tip is seen only through a live dev-brake notice. Fix: read origin/dev's tip too, or fetch before judging.

### B-640 · bug · Close Better Auth's update-user path so a member can't set an external avatar image

- status: dropped
- prd: fixes-bug
- owner:
- commit:

- 2026-11-23 (plan/member-avatars): Found by the member-avatars skeptic, 2026-11-23. /update-user accepts image from any signed-in user, it syncs to co-members, and UserAvatar renders it as an img. The web CSP blocks external images, but a native build gets no such header, so a member could learn co-members' IPs. No app code calls it. Add it to disabledPaths with a test; land before any native build ships.
- 2026-11-23 (plan/member-avatars): Duplicate of B-335 (filed by the member-avatars planner before it saw that item); dropped.

### B-641 · bug · Quick entry: 'gave lorazepam 1/2 mg' at a 0.5 mg strength may not record the usual dose

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 501a58bf

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 29 (B-632) hand-off. A test row for this line did not get the usual dose; the row was dropped as outside the plan and the amount it records was not confirmed. Confirm with a test first.

### B-642 · bug · Connector todays_doses test fails from midnight to 00:10 Los Angeles: its given dose, placed 10 minutes before now, lands on yesterday

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/fixes-bug): Found by the fixes-bug wave 5 quick check at 00:04 PST on 2026-11-23, failing twice. packages/api/src/connectors/readTools.int.test.ts:372 uses now minus 10 minutes (and :385 minus 5), so the assertion at :438 finds no given slot today. Not touched by fixes-bug. Fix: a fixed clock for handlerAt and the entries.

### B-643 · bug · Quick entry: a request with a day still leads with a vital or symptom dated ahead: 'check bp 120/80 tomorrow', 'ask about pain tomorrow morning'

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: ce9c55a2

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 31 (B-635) hand-off, cause not traced. 'ask about pain tomorrow morning' also gets a todo with no due time, so 'morning' isn't read as a part of day there.

### B-644 · bug · Quick entry dates a counted ordinal before a place: 'gave a 2nd at the clinic', 'received the 2nd at the clinic' log on the 2nd instead of now

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: a4252709

- 2026-11-23 (prd/fixes-bug): Codex P2 on PR #102 (https://github.com/caretook/caretook.com/pull/102#discussion_r4663493513). Confirmed by running findTime: both lines return day {date: 2}; before slice 30 (B-634) they returned no time. Cause: ordinalIsADay in packages/data/src/db/schema/assistant/quickEntryTime.ts skips only 'the' before the ordinal, so 'a' hides 'gave', and COUNTED_AFTER lacks 'received'. Fix: skip articles and widen the report words; keep 'dr lee the 2nd at the clinic' a day.

### B-645 · bug · CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the header the tabs carry what each reads: U…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): [ci-key e2d38cbde9e2] Flaked (passed on its rerun); found by prd/onboarding.

### B-646 · bug · Quick entry may still date a counted ordinal with no place: 'gave a 2nd' at the end of a line, or 'a 2nd at the clinic' with no verb

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: ce4d22b1

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 32 (B-644) hand-off, read from the code and not run: an ordinal at the line's end returns early as a day, and with no verb before the article nothing marks it as a count. Confirm with a test first.

### B-647 · bug · Quick entry: a request with a later day misses its part of day or leads with a vital: 'pick up walker next friday morning', 'check bp 120/80 friday'

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 3e6adea0

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 33 (B-643) hand-off: the part of day is read only after 'tomorrow', so 'next friday morning' keeps 'morning' in the title with no due time; a bare weekday reads back, so 'check bp 120/80 friday' isn't ahead and leads with the vital. Also unpinned: 'call dr lee tomorrow morning' stays an event first but is now dated 08:00 rather than all day.

### B-648 · bug · Quick entry: 'gave lorazepam 1/2' at a 0.5 mg strength with a usual '2 tablets' records 2 tablets, overstating what was typed

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 11820cae

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 34 (B-641) hand-off, read from the code: the bare fraction equal to the strength takes the usual dose whatever it is. The 'mg' form now keeps the typed amount unless the usual dose is one unit or the same measure; the bare form was left as the plan said. Confirm with a test first.

### B-649 · bug · A skeptic's --force treats an unreadable GitHub as no known dev brake; it could fail closed

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/agent-autonomy-3): From agent-autonomy-3 slice 3. Matches unsynced_dev_brake today; a go could refuse when the brake state can't be read.

### B-650 · bug · Unattended planner report's veto line sets flags=hold, dropping a row's design or standing flag

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/agent-autonomy-3): From agent-autonomy-3 slice 4. The line in prompt.sh should keep the row's other flags.

### B-651 · bug · Quick entry: a decimal at the strength overstates the dose: 'gave lorazepam 0.5' at 0.5 mg with a usual '2 tablets' records 2 tablets

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: a447334a

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 35 (B-648) hand-off, read from the code and not run: the bare-fraction rule (amountAtStrength in quickEntry.ts) covers only a fraction, so a decimal equal to the strength still takes the usual dose. Confirm with a test first.

### B-652 · bug · Quick entry: a counted ordinal before a clock time still takes a day: 'gave the 2nd at 2pm' reads as the 2nd of the month at 2pm

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 7be34f48

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 37 (B-646) hand-off: in ordinalIsADay (quickEntryTime.ts) a clock time after the ordinal marks a day before the counted-word check runs. 'a 2nd at 2pm' is already undated. Confirm with a test first.

### B-653 · bug · CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the list an item leaves the Planner tab once…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): [ci-key 490c60a6d926] Flaked (passed on its rerun); found by prd/ui-kit-5.

### B-654 · bug · CI flake: scripts/loops/lease.test.mjs: pnpm prd check's check lease makes the runs beyond the default limit of two wai…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): [ci-key ab40db666b8d] Flaked (passed on its rerun); found by prd/fixes-bug.
- 2026-11-23 (Robert Bo Davis): Flaked (passed on its rerun); found by prd/fixes-bug.

### B-655 · bug · Quick entry: a counted ordinal before a part of day may still take a day: 'gave the 2nd at night', 'gave the 2nd in the morning'

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 487cb235

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 39 (B-652) hand-off, read from ordinalIsADay in quickEntryTime.ts and not run: the part-of-day branches run without the counted-word check. Confirm with a test first.

### B-656 · bug · Timeline: a period starting just after midnight in the recipient's zone shows day 1 on two headers for a viewer behind that zone

- status: triaged
- prd: fixes-bug
- owner:
- commit:

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 41 (B-620) hand-off. Recipient in New York, viewer in Los Angeles, period starting 00:30 Eastern: the viewer's header for the previous date and the start date both read day 1, because periodDayOn has a minimum of 1. Affects only the period's first day.

### B-657 · bug · Pass log: after a successful Add a medication with unsaved dose edits, the sheet stays open and Back leaves without asking, losing the edits

- status: triaged
- prd: fixes-bug
- owner:
- commit:

- 2026-11-23 (prd/fixes-bug): From fixes-bug slice 42 (B-631) hand-off, reproduced with a throwaway component test. The add's submit keeps useSheetChanges' no-prompt bypass though the sheet stays open. Likely fix: end the bypass when a submit succeeds and the sheet stays open. Also: a refusal arriving while an identical alert is on screen is seen only if that alert remounts; PassLogForm now does, other sheets with a side action would need the same.

### B-658 · bug · CI flake: packages/api/src/admin/usersAdmin.int.test.ts: admin.users.get shows the account, its sessions, groups and ma…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): [ci-key 81e93b941241] Flaked (passed on its rerun); found by prd/calendars-2.
