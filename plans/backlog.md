# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

The PRD registry: **row order is the priority**. Edit it only with `pnpm backlog prd` (`add`, `set`, `move`); `pnpm backlog prd list` shows each topic's state (to-write, planned, running, idle, hold, done), worked out from git and the items. At most three PRD orchestrators run at once.

`Flags`: `hold` (waits on the user), `done`, `standing` (never finishes; runs while it has waiting items), `alone` (nothing else runs beside it). `After`: the topics it comes after. `Hot files`: repo path prefixes it shares.

| PRD | Flags | After | Hot files | Doc and notes |
| --- | ----- | ----- | --------- | ------------- |
| `marketing-2` | — | — | `apps/web/app/routes/marketing/`, `apps/web/public/og-default.png` | Light copy wave before sharing the link (B-417) |
| `fixes-ui` | standing, hold | — | — | plan: plans/fixes-ui-plan.md, rules: plans/fixes-rules.md |
| `planner-3` | done | `simple-mode` | `packages/data/src/db/schema/todos/`, `packages/data/src/db/schema/assistant/`, `packages/data/src/permissions/todos.ts`, `packages/data/src/services/entryTodoService.ts`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `packages/api/src/connectors/tools/listTodos.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/todos/`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/lib/appointments/`, `apps/web/app/lib/assistant/quickEntry.sync.ts`, `apps/web/app/components/todos/`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `scripts/browser-checks/sync-matrix.mjs` | Replanned 2026-11-23: entries and todos many to many (B-245) and quick entry repeats (B-254). |
| `fixes-bug` | standing, hold | — | — | plan: plans/fixes-bug-plan.md, rules: plans/fixes-rules.md |
| `inbox-agent` | done | `orchestration-3` | `scripts/backlog/`, `scripts/loops/lib.sh`, `scripts/loops/prd.sh`, `scripts/loops/prompt.sh`, `scripts/loops/tidy`, `scripts/loops/queue`, `scripts/loops/session.sh`, `scripts/loops/sessions.mjs`, `scripts/loops/rotate`, `scripts/loops/bye`, `scripts/loops/dispatch`, `scripts/loops/session`, `scripts/loops/keep-alive`, `scripts/loops/open-session` | Replanned 2026-11-23 (16d3b807): inbox agent on fast Opus, origin/dev writes, duplicate checks, auto archive, always-on session, bye for every role (B-425, B-435, B-474, B-515, B-551). Next up (B-406) dropped; priority stays with the backlog session. |
| `test-gates` | done | — | `.github/workflows/`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `vitest.config.ts`, `scripts/loops/land`, `scripts/loops/check-plan`, `scripts/loops/lib.sh`, `scripts/loops/dispatch`, `scripts/loops/prd.sh`, `scripts/loops/status-extra`, `scripts/backlog/registry` | CI test tiers 0-2, dev red, quarantine, rapid gate, modes (plans/test-gates-prd.md) |
| `fixes-tooling` | standing, hold | `test-gates` | — | plan: plans/fixes-tooling-plan.md, rules: plans/fixes-rules.md. **On hold 2026-11-24: paused by the user after wave 6 so UI fixes can run (only one fixes topic at a time).** |
| `agent-autonomy` | done | `test-gates` | `scripts/loops/land`, `scripts/loops/lib.sh`, `scripts/loops/check-`, `scripts/loops/prompt.sh`, `scripts/loops/prd.sh` | [PRD](agent-autonomy-prd.md), [plan](agent-autonomy-plan.md) (B-503 to B-506, B-516 to B-518): 10 slices, waves (1, 2) → 3 → (4, 5) → 6 → 7 → (8, 9, 10): questions that take their recommendation after 30 minutes (planners' too), a notice board, a machine claim for a landing's full check, the flake rule, flakes filed by the check, a Checked: trailer and a full pass that carries over a dev sync, landing on an unsynced tip, landing notices and the hold. Tooling only. Follow-on: agent-autonomy-2. While test-health runs (its word, 2026-11-22): land no change to what quick or full means (check-plan.mjs, lib.sh checked_ok) or what land accepts in the middle of a test-health landing, only between its waves; never touch scripts/eslint/ or eslint.config.js. |
| `agent-autonomy-2` | done | — | `scripts/loops/session`, `scripts/loops/context`, `scripts/loops/prompt.sh`, `scripts/loops/rotate`, `scripts/loops/open-session`, `scripts/loops/recover`, `scripts/loops/tidy`, `scripts/loops/end-session`, `scripts/loops/request` | [PRD](agent-autonomy-2-prd.md), [plan](agent-autonomy-2-plan.md) (B-507, B-508, B-509): 2 slices in 2 waves: a context hook that tells a session past 160k to rotate, sizes in status, the dispatcher's follow-up. Cut from agent-autonomy by its planner. Tooling only |
| `test-gates-2` | done | `test-gates` | `.github/workflows/ci.yml`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `scripts/loops/browser.sh`, `scripts/loops/serve.sh`, `scripts/loops/check-plan`, `scripts/loops/check-areas.d/`, `scripts/loops/prd.sh`, `vitest.config.ts`, `ops/runbook.md` | CI tiers 3-4: staging candidate, CI browser suites, staging to main gate, required checks (plans/test-gates-prd.md) |
| `test-health-2` | done | `test-gates`, `test-gates-2`, `sync-safety` | `apps/web/app/lib/sync/uploader`, `apps/web/test/fixtures.ts`, `apps/web/test/database.ts`, `apps/web/app/lib/sync/index.ts`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/sync-matrix.mjs`, `scripts/loops/sync-matrix.test.mjs`, `packages/api/src/router.int.test.ts`, `vitest.config.ts` | Test coverage follow-ups: device-to-server round trip per table, a second time zone, role gaps, an uploadData error test (B-371, B-372, B-373, B-374) |
| `worker-watch` | done | `test-gates`, `agent-autonomy-2`, `agent-autonomy-3` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/check-times`, `scripts/loops/check-run`, `scripts/loops/check-body`, `scripts/loops/land.sh`, `scripts/loops/review.sh`, `scripts/loops/browser.sh`, `scripts/loops/new.sh`, `scripts/loops/rm.sh`, `scripts/loops/status-extra`, `scripts/loops/dispatch`, `scripts/loops/context`, `scripts/loops/skeptic`, `scripts/loops/ask` | To write. Run metrics in one summary, then stuck workers handled against usual times (B-434, B-408). Cut from orchestration-3 |
| `agent-autonomy-3` | done | `agent-autonomy`, `agent-autonomy-2` | `scripts/loops/ask`, `scripts/loops/skeptic`, `scripts/loops/prompt.sh`, `scripts/loops/land`, `scripts/loops/prd.sh`, `scripts/loops/dispatch`, `scripts/loops/open-session`, `scripts/backlog/registry` | To write. A Fable skeptic before every ask, before risky landings (a forced landing, a flaky pass, a declined Codex finding), and as the final check on Opus planners, with a registry flag that keeps a design topic's planner on Fable (B-511, B-512, B-513). Filed into agent-autonomy after its plan landed; builds on its defaulting asks and flake rule |
| `self-recovery` | done | `test-gates`, `agent-autonomy`, `agent-autonomy-2` | `scripts/loops/recover`, `scripts/loops/land.sh`, `scripts/loops/lib.sh`, `scripts/loops/session`, `scripts/loops/open-session`, `scripts/loops/dispatch`, `scripts/loops/prd.sh`, `scripts/loops/inventory`, `scripts/loops/down.sh`, `scripts/loops/new.sh`, `scripts/loops/status-extra`, `scripts/loops/prompt.sh` | To write. launchd recovery, draining before a usage limit, step-in-progress markers, cost records, records for every session kind, headless sessions (B-407, B-433, B-437, B-438). Cut from orchestration-3; its planner cuts headless out if over six slices |
| `self-recovery-2` | hold | `self-recovery` | `scripts/loops/session`, `scripts/loops/open-session`, `scripts/loops/dispatch`, `scripts/loops/prd.sh` | **On hold 2026-11-24: planning paused by the user to save credits while away (nothing wrong with the topic).** Cost record and headless sessions, cut from self-recovery to keep it at six slices |
| `staging-ship` | hold | `test-gates-2`, `inbox-agent` | `scripts/loops/review.sh`, `scripts/loops/codex-review`, `scripts/loops/prd.sh`, `scripts/loops/land.sh`, `scripts/loops/lib.sh`, `scripts/loops/prompt.sh`, `scripts/loops/dispatch`, `scripts/loops/ask`, `scripts/ci/candidate`, `scripts/ci/promote` | To write. Ship dev to staging in one command, Codex findings filed by tool, a staging to-test report (B-404, B-430, B-436). Cut from orchestration-3; doesn't need the dispatcher |
| `ui-kit-3` | done | `ui-kit-2` | `apps/web/app/app.css`, `apps/web/app/components/ui/`, `apps/web/app/routes/dev/ui/`, `apps/web/app/lib/timeline/entryDisplay.ts`, `apps/web/app/components/entry/KindIcon.tsx`, `apps/web/app/components/quick-entry/QuickEntryCard.tsx`, `apps/web/app/lib/app-shell/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-398, B-269, B-448 and overlay motion): every remaining area swept onto the kit, one area per slice; then the lint guard. Cut from ui-kit-2 to keep it at six slices; starts after ui-kit-2 so the sweeps copy its final Button, header and motion contracts; before test-health waves 5 to 7; never beside i18n. Hot files when planned: most route and component folders, one area per slice |
| `ui-kit-4` | done | `ui-kit-3` | `eslint.config.js`, `scripts/eslint/`, `apps/web/app/routes/app/groups/medication/`, `apps/web/app/routes/app/groups/medications/`, `apps/web/app/routes/app/groups/provider/`, `apps/web/app/routes/app/groups/providers/`, `apps/web/app/routes/app/groups/profile/`, `apps/web/app/routes/app/groups/period/`, `apps/web/app/routes/app/groups/periods/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/search/`, `apps/web/app/components/medications/`, `apps/web/app/components/schedule/`, `apps/web/app/components/providers/`, `apps/web/app/components/contact/`, `apps/web/app/components/todos/`, `apps/web/app/components/visitPrep/`, `apps/web/app/components/repeat/` | — |
| `ui-kit-5` | done | `ui-kit-4`, `quick-entry-2` | `scripts/eslint/`, `apps/web/app/components/ui/Menu.tsx`, `apps/web/app/components/ui/FilterMenu.tsx`, `apps/web/app/components/ui/overlayMotion.browser.test.tsx`, `apps/web/app/routes/dev/ui/sections/MenuSection.tsx`, `apps/web/app/routes/dev/mail/`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/new/`, `apps/web/app/components/entry/`, `apps/web/app/components/notes/`, `apps/web/app/components/quick-entry/`, `apps/web/app/components/connectors/`, `apps/web/app/routes/admin/`, `apps/web/app/routes/account/`, `apps/web/app/routes/connectors/`, `apps/web/app/routes/marketing/`, `apps/web/app/routes/app/layout/`, `apps/web/app/routes/app/home/` | — |
| `quick-entry-2` | done | — | `packages/data/src/db/schema/assistant/quickEntry`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/timeline/timelineQuickEntry` | to write (B-300 to B-303), from the 2026-11-21 code review: negated doses, typed counts, wrong times, the stuck card · Depends on: `planner-2` in `dev` (it edits quick entry's future note; last item B-248) · Hot files: `db/schema/assistant/quickEntry.ts`, `quickEntryTime.ts`, `components/quick-entry/` |
| `dose-accuracy` | done | — | `packages/data/src/db/schema/medications/dueDoses.ts`, `packages/data/src/db/schema/medications/duePasses.ts`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/medications/dueDoses.sync.ts`, `apps/web/app/lib/appointments/visitPrep`, `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `packages/api/src/connectors/tools/todaysDoses.ts` | to write (B-297 to B-299), from the 2026-11-21 code review: a dose answers only its own day's slot, deterministic dose ids, visit prep's missed doses per schedule epoch · Hot files: `db/schema/medications/dueDoses.ts`, `medications.sync.ts` (`logDoses`), `visitPrep.ts` |
| `symptom-catalog` | done | `quick-entry-2`, `dose-accuracy` | `packages/data/src/db/schema/timeline/`, `packages/data/src/services/timelineEntryService.ts`, `packages/api/src/syncRegistry.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/routes/app/groups/timeline/SymptomFields.tsx`, `apps/web/app/routes/app/groups/timeline/FeelingFields.tsx`, `apps/web/app/routes/app/groups/timeline/FilterSheet.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/daySummary`, `apps/web/app/lib/appointments/visitPrep`, `apps/web/app/lib/assistant/quickEntryPredictions`, `apps/web/app/components/quick-entry/` | to write (B-549): symptoms as a catalog type with a default set, quick add with a similar-name check, a multi-symptom filter; adds a migration |
| `tags` | hold | `symptom-catalog` | `packages/data/src/db/schema/tags/`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/tags/`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/routes/app/groups/timeline/FilterSheet.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/providers/`, `apps/web/app/routes/app/groups/medications/`, `apps/web/app/routes/app/groups/search/`, `scripts/browser-checks/sync-matrix.mjs` | to write (B-548): group-wide tags on every record, filterable on each list and in search; adds a migration |
| `onboarding` | done | — | `apps/web/app/routes/account/join/`, `apps/web/app/routes/account/invite/`, `packages/auth/src/tickets.ts`, `packages/api/src/care-groups/`, `packages/data/src/services/careGroupInviteService.ts`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/root.tsx`, `apps/web/public/site.webmanifest`, `apps/web/app/routes/marketing/layout/`, `packages/data/src/db/schema/app-shell/userPreferences.ts`, `apps/web/app/lib/app-shell/me.ts`, `scripts/browser-checks/invites.spec.mjs` | to write (B-31): guided onboarding for new users, the real requirement; a demo group is one idea to refine; may point at the connect guide · Depends on: invites (done) · Hot files: seeds, careGroupService, /app home |
| `assistant-access` | done | — | `packages/data/src/db/schema/care-groups/careGroup.ts`, `packages/data/src/db/schema/connectors/connectorRules`, `packages/data/src/services/connectorGrantService.ts`, `packages/data/src/services/careGroupService.ts`, `packages/api/src/care-groups/careGroup.ts`, `packages/api/src/connectors/protocol.ts`, `packages/api/src/connectors/connect.ts`, `packages/api/src/connectors/connector.ts`, `packages/api/src/connectors/tools/groupOverview.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/care-groups/assistantsSwitch.sync.ts`, `apps/web/app/routes/app/groups/settings/assistants/`, `apps/web/app/routes/connectors/connect/`, `apps/web/app/routes/app/settings/devices/ConnectedAssistants.tsx` | Owner chooses read/write or read only for a group's assistants (B-558) |
| `code-health` | hold | `check-speed`, `orchestration-2` | `packages/data/src/db/schema/`, `packages/data/src/domain/`, `packages/data/src/services/`, `packages/data/package.json`, `package.json`, `apps/web/package.json`, `apps/web/app/`, `packages/api/src/`, `scripts/loops/lib.sh`, `scripts/loops/lease.sh`, `scripts/loops/land.test.mjs`, `scripts/loops/check-areas.d/`, `scripts/backlog/backlog.mjs`, `scripts/build/` | [PRD](code-health-prd.md), [plan](code-health-plan.md) (B-361, B-365, B-366, B-367): 6 slices, waves (1, 2, 3, 5) → 4 → 6: exact pins and a test refusing ranges, unused exports removed, the backlog lock held once and a knobs page, tests on pr/ready/review/land, pure logic moved to @caretook/data/domain, then every importer switched (slice 6, alone, after simple-mode lands; it touches import lines across apps/web/app and packages/api). No behaviour change, no migration. Follow-ons: code-health-2, code-health-3 |
| `sync-safety` | done | — | `packages/api/src/sync`, `apps/web/app/lib/sync/`, `apps/web/app/lib/auth/session`, `apps/web/app/routes/sign-out.tsx`, `apps/web/app/routes/app/layout/SyncIndicator.tsx`, `apps/web/app/routes/app/layout/UserMenu.tsx`, `packages/data/src/services/`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/providers/providers.sync.ts`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/signout-wipe.spec.mjs`, `scripts/browser-checks/session-end.spec.mjs` | to write (B-285 to B-296, B-382 to B-384, B-387: repeating-todo upload bugs Codex found, moved from `planner-2`), from the 2026-11-21 code review (findings not re-verified): refused sync changes shown to the user, an upload queue that can't wedge, offline edits that don't revert a co-member's change, replayed PUTs, global client-chosen ids, the sign-out wipe and unsent writes, then the column-agreement test and one generic upload handler · Depends on: (none); `test-health` shares the upload tests (B-371, B-374) · Hot files: `packages/api/src/sync.ts`, `lib/sync/client.ts`, `SyncIndicator`, `session.ts`, `sign-out.tsx`, `medications.sync.ts`, `providers.sync.ts`, the services' `upsert`s |
| `demo-site` | hold | — | — | Shared demo site with generic logins and nightly reset; separate environment |
| `todo-subtasks` | hold | `planner-3`, `tags` | `packages/data/src/db/schema/todos/`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `packages/api/src/connectors/tools/listTodos.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/todos/`, `apps/web/app/lib/app-shell/unsavedChanges.ts`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `scripts/browser-checks/sync-matrix.mjs` | **On hold 2026-11-24: planning paused by the user to save credits while away (nothing wrong with the topic).** to write (B-550): nested todos, 3 levels in code, parent auto-completes |
| `calendars-2` | done | — | `packages/data/src/google/`, `packages/data/src/services/calendar`, `packages/data/src/db/schema/calendars/`, `packages/data/src/db/schema/notifications/`, `packages/data/src/db/schema/appointments/repeatRule`, `packages/data/src/db/schema/appointments/seriesVisits`, `packages/notifications/`, `apps/web/app/lib/appointments/repeatChoice`, `apps/web/app/lib/calendars/`, `apps/web/app/components/repeat/`, `apps/web/app/routes/app/groups/settings/calendar/` | [PRD](calendars-2-prd.md), [plan](calendars-2-plan.md) (B-304 to B-309): 7 slices, waves (1, 3, 5, 6) → (2, 4) → 7: Google deletes leave started items and todos alone; Google sync looks a year ahead with a daily catch-up; reminders expire at the event's start; deleted providers leave pushes; a stale consent goes generic and asks again; times name their zone; monthly on the last day. Two additive migrations (waves 1 and 3), no deps, no stack. Push notifications (B-377) are calendars-3 |
| `fixes-perf` | standing, hold | — | — | plan: plans/fixes-perf-plan.md, rules: plans/fixes-rules.md |
| `fixes-nit` | standing, hold | — | — | plan: plans/fixes-nit-plan.md, rules: plans/fixes-rules.md |
| `sync-safety-2` | hold | `sync-safety` | `packages/api/src/sync`, `apps/web/app/lib/sync/`, `packages/data/src/services/`, `apps/web/app/lib/todos/` | **On hold 2026-11-24: planning paused by the user to save credits while away (nothing wrong with the topic).** Its planner was stopped mid-plan: uncommitted drafts plans/sync-safety-2-prd.md and -plan.md are in .loops/plan-sync-safety-2. Released 2026-11-23 by the user. to write (B-294 to B-296, B-382 to B-384, B-387): cut from sync-safety by its planner, 2026-11-21: device transactions applied atomically, device clocks on change entries, the stale tab, and the repeating-todo races |
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
| `ui-kit` | done | — | `apps/web/app/components/ui/`, `apps/web/app/app.css`, `apps/web/app/components/settings/`, `apps/web/app/routes/sign-in.tsx`, `apps/web/app/routes/app/layout/SectionNav.tsx` | [PRD](ui-kit-prd.md), [plan](ui-kit-plan.md) (B-257 to B-267, B-270, B-396, B-397, B-399): 7 slices, waves 1 → (2, 3, 4) → (5, 6) → 7: a dev gallery at `/dev/ui`, Button and the form footer; the pill tab bar (medications, Planner, sign-in) and the phone's floating, icon-only bottom bar; messages, empty and loading states and Badge; text tokens, the page container and one heading scale; Card, lists, check and toggle fields; the detail header and full-width section bands on the medication, provider, care period and to-do pages, then the profile. Each primitive is adopted in settings, sign-in or the detail pages; the rest of the app is `ui-kit-2`. No migration, no deps; stackless but for slice 2 (two browser checks). **Ready to start** · Depends on: (none): `list-filters` and `planner-2` are in `dev`; never beside `i18n`; `quick-fixes` between waves · Hot files: `components/ui/` (its `index.ts`, `styles.ts`, `plain/`, `TabNav`, `PageHeader`, `Field`), `app.css`, `components/settings/`, the settings route folders, `routes/sign-in.tsx` and the account card, the dev routes part, the outer `main` and `h1` of `/app` pages outside the timeline and entry folders, the five detail-page folders, `LinkedTodos`, `AllergiesRegion`; `routes/app/layout/SectionNav.tsx` and the bar's locator in `app-shell.spec.mjs` (`test-health` slice 12 rewrites that spec) and `roundtrip.spec.mjs` |
| `ui-kit-2` | done | `ui-kit` | `apps/web/app/components/ui/`, `apps/web/app/app.css`, `apps/web/app/root.tsx`, `apps/web/app/assets/fonts/`, `apps/web/app/routes/dev/ui/`, `scripts/build/manifest`, `scripts/build/service-worker`, `apps/web/app/routes/app/groups/medications/route.tsx`, `apps/web/app/routes/app/groups/medications/routes.ts`, `apps/web/app/routes/app/groups/medications/passes/`, `apps/web/app/lib/medications/urls.ts`, `apps/web/app/lib/medications/medicationSheets`, `apps/web/app/routes/app/groups/providers/route.tsx`, `apps/web/app/routes/app/groups/planner/PlannerHeader.tsx`, `apps/web/app/routes/app/groups/periods/route.tsx`, `apps/web/app/components/entry/SeriesScopeDialog.tsx`, `apps/web/app/routes/app/groups/todo/RepeatDeleteDialog.tsx`, `apps/web/app/routes/app/groups/timeline/DaySummaryLine.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/TodayCard.tsx` | [PRD](ui-kit-2-prd.md), [plan](ui-kit-2-plan.md) (B-423, B-420, B-419, B-424, B-415, B-414, B-268): 6 slices, waves (1, 4, 6) → (2, 5) → 3: one Button with tones, sizes and shapes; a + add button at the top right of every main page header (Providers with an icon-only Import, the Planner, Care periods); Medications with Passes as a third tab and an add menu; the Atkinson Hyperlegible Next typeface, self-hosted; quiet motion for buttons, rows, chevrons and expanding regions; a kit ChoiceDialog for the two three-way questions. No migration, no deps; slices 3, 4 and 6 have a stack. The sweeps, the guard and overlay motion are ui-kit-3 · Depends on: ui-kit in dev; never beside i18n |
| `orchestration-2` | done | `check-speed` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/rm.sh`, `scripts/loops/open-session.`, `scripts/loops/session`, `scripts/backlog/` | [PRD](orchestration-2-prd.md), [plan](orchestration-2-plan.md) (B-389, B-390, B-391, B-395): 6 slices, waves (1, 2, 3) → 4 → 5 → 6: the PRD table as a registry (`pnpm backlog prd`, row order is the priority, states worked out), recorded sessions, an asks queue (`pnpm prd ask`, pushed to the phone by the asking session), drain-then-rotate after each landing (`pnpm prd rotate`), run-through prompts and status, then `quick-fixes` split into five standing topics (`fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`, on hold until the user orders them). Tooling only. **Ready to start** once `check-speed` is in `dev` · Depends on: `check-speed` in `dev` (shared `prd.sh`, `prompt.sh`, `pnpm test:tooling`); before `test-health`, never beside it · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `rm.sh`, `open-session.*`, `scripts/backlog/`, this PRD table |
| `orchestration-3` | done | `orchestration-2` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/recover.sh`, `scripts/loops/land.sh`, `scripts/loops/lease`, `scripts/loops/new.sh`, `scripts/loops/session`, `scripts/loops/open-session.`, `scripts/loops/inventory`, `scripts/loops/tidy`, `scripts/loops/dispatch`, `scripts/loops/check-run`, `scripts/backlog/backlog.mjs` | to write (B-392, B-404: one command to ship `dev` to staging through the Codex review): the dispatcher (`pnpm prd dispatch`: the pick, unattended planners, `queue` as "move to the front", recovery and status). What is settled and what is open: [orchestration-2 PRD](orchestration-2-prd.md), _Follow-on_ · Depends on: `orchestration-2` in `dev` (last item B-395) · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `recover.sh`, the registry |
| `check-speed` | done | — | `scripts/loops/`, `vitest.config.ts`, `package.json`, `packages/data/test/` | [PRD](check-speed-prd.md), [plan](check-speed-plan.md) (B-271, B-272, B-273, B-278): 4 slices, waves (1, 2) → (3, 4): every check through two check leases and into a check log (`pnpm prd check --times`), tooling tests in their own Vitest project, quick check at hand-off with the full check once per landing, integration tests on three workers with a database each. No load gate. Measured 2026-11-21: a full test run takes about 11 minutes and five PRDs made 39 of them · Hot files: `scripts/loops/` (`prd.sh` `check`, `prompt.sh`, `lease.sh`, `test-db.sh`, `rm.sh`), `vitest.config.ts`, `package.json`, `packages/data/test/`, `testDatabase.ts` |
| `test-health` | done | `check-speed`, `orchestration-2` | `vitest.config.ts`, `eslint.config.js`, `scripts/eslint/`, `apps/web/test/` | [PRD](test-health-prd.md), [plan](test-health-plan.md) (B-274 to B-277, B-279 to B-283): 15 slices in 7 waves (slices 1, 2, 6 and 7 moved to `check-speed`), landing wave by wave. Waves 1 to 4: browser-check bookkeeping, the component harness (clock, one timeout, `getByCss`, lint rules as warnings) and the unit, server and Playwright cuts. Then it pauses; waves 5 to 7 are the component cuts, the area-by-area harness migration and the rules becoming errors · Depends on: `check-speed` in `dev` before slice 11 (worker databases; last item B-278), and better before any of it (quick hand-off checks); otherwise (none) for waves 1 to 4; waves 5 to 7 (slices 14 to 19) after `list-filters`, `planner-2` and `ui-kit` (they edit the same screens' tests); `quick-fixes` between waves · Hot files: `vitest.config.ts`, `package.json`, `eslint.config.js`, `scripts/loops/` (`prd.sh`, `prompt.sh`, `lease.sh`, `checks`, `check-areas.mjs`, `check-areas.d/`, `test-db.sh`), `apps/web/test/` (`setup.ts`, `found.ts`), `packages/data/test/`, `scripts/browser-checks/` (the specs, `fixtures.mjs`), the frozen-list tests; from wave 5 the `*World.tsx` files and component tests in every area, one area per slice |
| `code-health-2` | hold | `code-health`, `simple-mode`, `sync-safety` | `packages/data/src/models/`, `packages/data/src/services/`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `apps/web/app/lib/core/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-362, B-363), cut from code-health by its planner, 2026-11-21: the role table as what simple-mode leaves (canComplete, role checks in the API's invites and join requests, a test refusing role names outside the role module, isUserRoleName and isGroupRoleName removed), the soft-delete model factory, one upsert helper on sync-safety's create-if-absent shape, one invalid, the device side's refuse, invalid, canWrite, formString and shouldRevalidate |
| `code-health-3` | hold | `code-health-2` | `apps/web/app/lib/`, `apps/web/app/libLayout.test.ts`, `packages/data/src/models/base/`, `packages/api/src/sync` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-364, B-368, B-369), cut from code-health by its planner, 2026-11-21: device row types derived from the device schema and the layout guard refusing SQL outside *.sync.ts (17 files today), the list count only on request and the sync PATCH's round trips (that slice after sync-safety-2), plan-pointing comments (a count that may only fall, then a sweep) |
| `simple-mode` | done | — | `apps/web/app/lib/assistant/simpleMode`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `powersync/sync-config.yaml` | [PRD](simple-mode-prd.md), [plan](simple-mode-plan.md): 5 slices, waves 1 → 2 → 3 → (4, 5): the lock becomes two member roles, Easy helper (log-only, own entries, own todos) and Easy viewer; "simple" is renamed "easy" everywhere, database included; the role decides the view; the Planner, todo pages and search open for the easy roles (B-221, B-236); the Easy mode toggle moves from the View options menu into the full timeline's page header (slice 5, stackless, B-400). Migrations in slices 1, 2 and 3; sync config changes. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248) and the current `quick-fixes` wave in `dev` (slice 1 renames files they touch) · Hot files: slice 1: every `simple*` file (`lib/assistant/simpleMode*`, `SimpleTimeline` and its blocks, quick entry, `TodoTick`, the `/app` layout), `sync-config.yaml`, the device schema; slice 2: `constants/roles.ts`, `permissions/` (blocks, types, timeline, todos, live-notes, connectors), `todoService`, the upload switch, `groupContext.ts`, the role picker; slice 3: group settings Members, `careGroupMemberService`, `useSimpleFrame`; slice 4: the Planner and todo routes, the search route; slice 5: `TimelineHeader.tsx`, `TimelineViewMenu.tsx`, the toggle button |
| `calendars-3` | hold | `calendars-2` | `packages/notifications/`, `apps/web/app/lib/app-shell/serviceWorker`, `scripts/build/service-worker`, `apps/web/app/routes/app/groups/settings/calendar/`, `apps/web/app/lib/calendars/`, `apps/web/app/lib/auth/session`, `apps/web/app/lib/sync/client`, `apps/web/app/routes/marketing/privacy/`, `apps/web/app/routes/marketing/health-data-privacy/`, `packages/data/src/db/schema/auth/legalRules`, `packages/data/src/db/schema/calendars/`, `packages/data/src/db/schema/notifications/`, `packages/data/src/services/calendar`, `packages/api/src/calendars/`, `packages/auth/src/authUser`, `ops/runbook.md` | to write (B-377): push notifications for event reminders; cut from calendars-2 to keep it small. Its planner asks about a web-push dependency and the push vendors. Builds on calendars-2 slice 3 (the outbox expiry) |
| `connectors-3` | hold | `planner-3` | `packages/api/src/connectors/tools/`, `packages/data/src/db/schema/medications/doseSchedule`, `packages/data/src/db/schema/medications/index.ts`, `packages/api/src/connectors/readTools.int.test.ts`, `packages/api/src/connectors/mcpWrites.int.test.ts` | to write (B-252: a connector tool to read the dosing schedule beyond today; B-253: `add_todo` can make a repeating todo) · Depends on: B-253 after `planner-2` in `dev` (last item B-248); B-252 has none · Hot files: `packages/api/src/connectors/tools/` (`todaysDoses.ts` or a new schedule tool, `writes.ts`), the server instructions |
| `connectors-4` | hold | `hosting`, `marketing` | — | Directory listings (B-196): after the launch (B-33), the privacy policy (B-54) and the staging check with Claude and ChatGPT; needs a logo, short and long descriptions, a test account, the privacy URL |
| `i18n` | alone, hold | `simple-mode` | `apps/web/app/components/`, `apps/web/app/lib/core/format.ts`, `packages/data/`, `apps/web/app/root.tsx`, `packages/notifications/`, `pnpm-workspace.yaml`, `scripts/build/budget.json` | [PRD](i18n-prd.md), [plan](i18n-plan.md): 11 slices, waves 1 → 2 → (3, 4, 5, 6) → (7, 8, 9, 10) → 11: a per-user language (English and Spanish, AI-drafted, review before launch) in `user.preferences` with a cookie for server rendering; typed catalogs on `i18next` and `react-i18next`; format helpers, error codes and label maps take the language; the app swept area by area; emails, the invite's language, calendar text and the public site at `/es/`; a lint rule against literal text (`eslint-plugin-i18next`, dev). Quick entry is a plain box for non-English users; search matching, the connector and `/admin` stay English (B-209). Slice 8 adds a migration (one nullable invite column); three dependencies approved 2026-11-21; slice 1 needs a stack. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248), the current `quick-fixes` wave and `simple-mode` (last items B-221, B-400) in `dev`; **runs alone** (tooling-only work beside it) · Hot files: every user-facing string: all `/app`, sign-in and marketing routes, `components/`, `lib/core/format.ts` and the other format helpers, the label maps in `packages/data` schema, `userPreferences.ts`, `root.tsx`, the service worker, `packages/notifications` templates and registry, the invite schema and service, `calendarText.ts`, ESLint config, `pnpm-workspace.yaml`, `scripts/build/budget.json` |
| `data-rights` | hold | — | `packages/api/`, `apps/web/app/lib/sync/client.ts`, `packages/auth/` | to write (B-52, B-53, B-84) · Hot files: `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `account-security` | hold | — | `packages/auth/` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) · Depends on: `invites` (done); B-80 (the Devices page) first (soft) · Hot files: `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `marketing` | hold | — | — | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user |
| `hosting` | hold | — | — | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent |
| `encryption` | hold | — | — | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 · Depends on: (none); affects `assistant` and `documents` · Hot files: none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `documents` | hold | `encryption` | — | to write (B-56) · Depends on: hosting (B-33, file storage); `profiles` (soft); `encryption` decision · Hot files: file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS` |
| `contract-migrations` | hold | — | — | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** Contract steps tracked from fixes-nit (B-379): B-455, B-456, B-457. Migrations: run alone in its wave. To write. |
| `timeline-jump` | done | `quick-entry-2` | `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/providers/providers.sync.ts`, `apps/web/app/lib/medications/medicationTimeline.sync.ts`, `apps/web/app/lib/care-periods/periodMarkers.ts`, `apps/web/app/routes/app/groups/timeline/useTimelineData.ts`, `apps/web/app/routes/app/groups/timeline/timelineRows.ts`, `apps/web/app/routes/app/groups/timeline/timelinePaging.ts`, `apps/web/app/routes/app/groups/timeline/daySummaryRows.ts`, `apps/web/app/routes/app/groups/timeline/TimelineEntryList.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/route.tsx`, `apps/web/app/components/quick-entry/`, `packages/data/src/db/schema/assistant/quickEntryTime` | Jump to a date on the timeline, by picker and quick entry (B-557) |
| `orchestration-split` | hold | — | `scripts/loops/`, `scripts/backlog/`, `scripts/ci/`, `.githooks/`, `scripts/project/`, `package.json`, `vitest.config.ts`, `.github/workflows/`, `AGENTS.md`, `risa.json` | Held until after launch by the user (B-543): extract the orchestration tooling or replace it with a prebuilt one |
| `member-avatars` | done | `onboarding`, `ui-kit-5` | `packages/data/src/db/schema/auth/user.ts`, `packages/data/src/models/user/userModel.ts`, `packages/data/src/permissions/blocks.ts`, `packages/api/src/app-shell/me.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/app-shell/me.ts`, `apps/web/app/components/ui/UserAvatar.tsx`, `apps/web/app/components/ui/AvatarStack.tsx`, `apps/web/app/components/notes/EditorAvatars.tsx`, `apps/web/app/components/entry/KindIcon.tsx`, `apps/web/app/routes/app/settings/account/`, `apps/web/app/routes/app/layout/UserMenu.tsx`, `apps/web/app/routes/app/groups/settings/members/`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `apps/web/app/routes/app/groups/timeline/PassLogItem.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/planner/`, `scripts/browser-checks/roundtrip.spec.mjs` | Released 2026-11-23 by the user. Members choose an avatar color and icon; no photos or image storage. |
| `onboarding-2` | hold | — | — | — |
| `asks-relay` | hold | `inbox-agent` | `scripts/loops/ask`, `scripts/loops/prompt.sh`, `scripts/loops/dispatch`, `scripts/loops/tidy`, `scripts/loops/session`, `scripts/loops/prd.sh` | **On hold 2026-11-24: planning paused by the user to save credits while away (nothing wrong with the topic).** Also moved to the bottom of the queue by the user 2026-11-24. Released 2026-11-23 by the user. The backlog session as go-between for every agent's questions, and asks queue hygiene. Cut from inbox-agent by its planner (plans/inbox-agent-prd.md, Follow-on topic) |
| `orchestration-split-2` | hold | `orchestration-split` | `scripts/loops/`, `scripts/project/`, `packages/data/test/`, `apps/web/test/`, `docs/agents/`, `docs/orchestration.md`, `AGENTS.md`, `risa.json` | — |
| `orchestration-split-3` | hold | `orchestration-split-2` | `scripts/loops/`, `scripts/backlog/`, `scripts/ci/`, `scripts/project/`, `scripts/deploy/workflows`, `.githooks/`, `package.json`, `vitest.config.ts`, `.github/workflows/`, `docs/`, `apps/web/test/`, `risa.json` | — |
| `risa-next` | hold | `orchestration-split-3` | — | — |
| `usage-aware-drain` | hold | `orchestration-split-3` | — | Plan-aware drain line, after the orchestrator split |
| `todo-subtasks-2` | hold | `todo-subtasks` | `apps/web/app/lib/todos/todoList.ts`, `apps/web/app/lib/todos/plannerTodos.ts`, `apps/web/app/lib/todos/todoStrip.ts`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/timeline/` | — |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
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
| B-241 | bug | triaged | staging-ship |  | codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean |
| B-244 | chore | triaged | fixes-tooling |  | codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false |
| B-252 | feature | triaged | connectors-3 |  | Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming |
| B-253 | feature | triaged | connectors-3 |  | Connector: add_todo can make a repeating todo (daily, weekly on days, monthly) |
| B-294 | bug | triaged | sync-safety-2 |  | Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused |
| B-295 | bug | triaged | sync-safety-2 |  | System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable |
| B-296 | bug | triaged | sync-safety-2 |  | A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database |
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
| B-342 | bug | landed | fixes-ui | prd/fixes-ui | The Postgres pool has no error listener: a dropped idle connection crashes the function; 10 clients with a 2 s wait time out under a burst of uploads |
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
| B-375 | chore | triaged | fixes-tooling |  | Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports) |
| B-377 | feature | triaged | calendars-3 |  | Push notifications for appointment reminders (B-61 shipped email only) |
| B-378 | chore | triaged | i18n |  | File the translations PRD's promised follow-ups: Spanish quick entry, language-aware search, a human review of the Spanish; and note 48 hard-coded 'en-US' formatters and English messages in schemas and the errors catalogue |
| B-383 | bug | triaged | sync-safety-2 |  | Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating |
| B-384 | bug | triaged | sync-safety-2 |  | Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete) |
| B-387 | bug | triaged | sync-safety-2 |  | Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin |
| B-404 | feature | triaged | staging-ship |  | One command to ship dev to staging: push dev, open the dev into staging PR, wait for Codex's review, triage its findings into the backlog (verified against the code, duplicates noted on the existing item), merge the PR when nothing is a blocker, and notify the user only when something is |
| B-417 | feature | triaged | marketing-2 |  | We are getting close to feature complete. We need another marketing content pass that updates copy… |
| B-429 | change | triaged | asks-relay |  | Asks queue hygiene: reports that go stale are re-checked or expire, answered asks are archived, and an ask whose session has died still reaches the user |
| B-430 | feature | triaged | staging-ship |  | Codex findings on a PRD pull request become backlog items by tool: verified against the code, duplicates noted on the existing item, as B-404 does for the staging PR |
| B-431 | chore | triaged | fixes-tooling |  | A finished PRD gets its done flag without rm: set it at the last landing or in pnpm prd tidy (check-speed still reads planned with nothing waiting) |
| B-432 | chore | triaged | fixes-tooling |  | After a landing that changes the lockfile, pnpm prd land runs pnpm install in the main checkout (or files an ask) instead of only printing a reminder |
| B-436 | feature | triaged | staging-ship |  | A to-test report for a staging ship, like the landing reports of B-410 |
| B-438 | plan | triaged | self-recovery-2 |  | Headless orchestrator sessions: runs that need no terminal tab, so a helper cannot outlive or die with its window |
| B-442 | bug | triaged | fixes-tooling |  | pnpm prd tidy --yes deletes dead leases from its earlier snapshot without lease.sh's takeover mutex and fresh liveness check |
| B-443 | bug | triaged | fixes-tooling |  | land.sh to-test file lists no items after a local landing: items are already landed, not ready, once dev has the merge |
| B-447 | bug | triaged | fixes-tooling |  | to-test file: 'What wasn't checked' repeats the quick-check line, and a tooling-only landing still gets the app's dev URL and seed sign-ins under 'What to try' |
| B-455 | chore | triaged | contract-migrations |  | Drop the old per-member simple mode columns (simple_mode, simple_mode_locked) once Easy roles replace them |
| B-456 | chore | triaged | contract-migrations |  | Retire the leftover reminder data planner-2 left in place: the note kind on appointment_series and stored future notes and note series |
| B-457 | chore | triaged | contract-migrations |  | Give groups that predate the default medication passes (Morning 08:00 and Evening 20:00) their two passes |
| B-459 | chore | triaged | fixes-tooling |  | Backlog: 151 items read 'live' because the dev-into-staging-into-main release merge (cc3e1d8b, B-33) put their commits on origin/main, though production hasn't launched; give live a real meaning (a production marker such as a tag or a recorded deploy) or show main as staging until launch |
| B-465 | bug | triaged | fixes-tooling |  | pnpm prd down keeps stopping servers, stacks and the test Postgres when the dispatcher won't stop in time (mid new.sh), racing a start against the shutdown |
| B-467 | feature | triaged | asks-relay |  | The backlog session is the go-between for every agent's questions: agents file to the asks queue and wait, the backlog session ranks them by how soon an answer blocks real work, asks the user itself and decides which ones ping the phone |
| B-477 | change | triaged | fixes-tooling |  | PRD registry: a hold carries its reason |
| B-542 | chore | triaged | fixes-tooling |  | Unit-test projects run at Vitest's default workers (cores - 1, 9 here): two overlapping checks run ~18 test processes on 10 cores, the load behind the under-load timeouts; cap the unit group at about 4 (or half the cores) and time it against check-times |
| B-543 | question | in-progress | orchestration-split | prd/orchestration-split | Split the orchestration tooling into its own multi-project tool, or replace it with a prebuilt one |
| B-544 | chore | triaged | fixes-nit |  | vitest.config.ts:196 comment still names worker databases <name>_w<VITEST_POOL_ID>; they're caretook_tw_<stem>_<hash>_w<n> since B-405 |
| B-545 | chore | triaged | fixes-tooling |  | rm.sh reads pnpm backlog prd list --json twice (lines ~57 and ~71); reuse $rows to save a node start per rm |
| B-548 | feature | triaged | tags |  | Group-wide tags on every record (entries, todos, providers, medications, events), filterable |
| B-550 | feature | triaged | todo-subtasks |  | Nested todos: subtasks up to 3 levels deep, a parent completes when its last subtask is done |
| B-560 | feature | triaged | self-recovery-2 |  | A cost record: tokens by model per PRD and slice, from session and subagent transcripts, in pnpm prd cost |
| B-561 | feature | triaged | demo-site |  | Shared demo site: demo.caretook.com with a fictional care group, generic logins and a nightly reset, to link from invites |
| B-562 | change | triaged | data-rights |  | Notice before a material change to the legal pages: the privacy policy promises notice and consent where required, and nothing does this yet |
| B-563 | feature | triaged | marketing |  | Accessibility statement page |
| B-564 | change | triaged | hosting |  | App-store prerequisites for the Capacitor apps |
| B-565 | feature | triaged | data-rights |  | Ownership transfer: a last owner can hand a care group to another member |
| B-584 | chore | triaged | staging-ship |  | Backlog prompt: "deploy staging" trigger that promotes dev and notifies my phone |
| B-608 | chore | triaged | fixes-tooling |  | Format before the slice check: prettier --write on a slice's changed files, and --cache on the whole-repo check |
| B-609 | chore | triaged | fixes-tooling |  | Stale check-gate text after test-gates: prd.sh help (ci run exits, quick escalation), the hotfix prompt, the PR body and ready's local check line, and dead checked_ok in lib.sh |
| B-619 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/lib/search/search.sync.browser.test.tsx: about 2,000 entries the rebuild takes under 2 s, and a … |
| B-623 | bug | triaged | fixes-tooling |  | Check rerun never runs for tooling: check-body's 'unhandled error' grep matches a passing test's title |
| B-625 | chore | triaged | contract-migrations |  | Drop todo.event_id and its old-client mirror once no device writes it |
| B-630 | chore | triaged | fixes-nit |  | Two helpers build the legal page links (lib/auth/legalLinks.ts and settings account/legalLinks.ts): fold them into one |
| B-633 | bug | triaged | fixes-tooling | prd/fixes-tooling | CI flake: apps/web/app/routes/app/groups/timeline/timelineBack.browser.test.tsx: back from the entry page three pages d… |
| B-637 | chore | triaged | fixes-nit |  | About 20 settings and provider files still use text-base-content opacity classes instead of the UI kit |
| B-639 | bug | triaged | fixes-tooling |  | Unsynced landing can miss a brake on a newer origin/dev: land reads the verdict for local dev's tip |
| B-649 | bug | triaged | fixes-tooling |  | A skeptic's --force treats an unreadable GitHub as no known dev brake; it could fail closed |
| B-653 | bug | triaged | fixes-tooling | prd/fixes-tooling | CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the list an item leaves the Planner tab once… |
| B-660 | chore | triaged | fixes-tooling |  | CI verdicts keep each failed test's failure message, so a one-off flake shows which limit or timeout broke |
| B-665 | change | triaged | onboarding-2 |  | Remove the standalone Invite someone notice from the Timeline; inviting lives in the onboarding setup steps |
| B-667 | chore | triaged | fixes-tooling |  | Resettable seeded onboarding test user, so the new-member setup flow can be retried without a new address each time |
| B-670 | feature | triaged | onboarding-2 |  | Onboarding on its own pages with inline forms, providers first, a care period step, a Later exit and a Want help onboarding? toast |
| B-681 | bug | triaged | fixes-tooling |  | Promotion prints a passing flake's tests but doesn't file them in the backlog |
| B-694 | change | triaged | fixes-ui |  | Long create forms: core fields on the first tab, the rest on other tabs |
| B-720 | chore | triaged | fixes-tooling |  | Confirm dev syncs that share no files with a branch no longer trigger a second CI run |
| B-721 | bug | triaged | fixes-tooling |  | Second-zone filing opens a new item when a zone item was landed or dropped but staging still lacks the fix |
| B-722 | bug | triaged | fixes-tooling |  | A release run after a recorded override replaces the override's release-gate status, so a failing run blocks main again |
| B-730 | bug | triaged | sync-safety-2 |  | A magic-link or invite sign-in that lands while an offline sign-out is still pending has its new session ended by the next /app check (sign-in page guards it, other sign-in paths don't) |
| B-738 | bug | triaged | fixes-tooling |  | Land gate reuses a failing CI verdict from an ancestor when only tooling changed since, so a tooling fix commit is refused on the old failure without a new run |
| B-749 | chore | triaged | fixes-tooling |  | check-areas: the *.sync.ts writers roundtrip now calls (todos, allergies, conditions, medicationConditions, notes) don't map to roundtrip |
| B-750 | bug | triaged | fixes-bug |  | Second-zone failures past the filing cap: test files that fail in America/New_York beyond the release tier's 10 filings |
| B-751 | chore | triaged | fixes-tooling |  | A quarantine entry whose test was renamed or deleted is skipped silently and stays: flag quarantine names that match no test |
| B-752 | bug | triaged | fixes-bug | prd/fixes-bug | timelineJump.browser.test.tsx can hang a components shard in CI |
| B-753 | bug | triaged | fixes-tooling |  | CI doesn't name the file a hung shard is stuck on |
| B-754 | bug | triaged | fixes-tooling |  | backlog.test.mjs beforeAll errors under load (slice checks at load ~30-44) |
| B-755 | change | triaged | fixes-perf |  | Series visits are written one at a time (writeVisits), ~1.7 s for 39 visits under load |
| B-757 | chore | triaged | fixes-tooling |  | Slice check runs a slice's own component files only in Los Angeles: add web:components:ny for files in its include list |
| B-759 | feature | triaged | onboarding-2 |  | Install-the-app tip on mobile browsers: a step in onboarding, then a dismissable tip at sign-in until installed or 'never show again' |
| B-760 | feature | triaged | connectors-3 |  | Connector: add_provider, so a member's own AI can add a provider (name, specialty or practice, phone, address) |
| B-761 | feature | triaged | connectors-3 |  | Connector: add_medication, so a member's own AI can add a medication with its type and schedule |
| B-764 | change | triaged | fixes-perf |  | App first load is way too long. |
| B-766 | bug | triaged | fixes-tooling |  | pnpm prd help prints 'design: command not found': backticks in prd.sh's unquoted help heredoc run as commands |
| B-767 | bug | triaged | fixes-tooling |  | A backlog amend repeats the Backlog-Tool trailer in the commit message |
| B-768 | bug | triaged | fixes-tooling |  | slice-fields.mjs warns on a slice fields line that carries Blocked by |
| B-769 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/new/newGroup.browser.test.tsx: the New care group sheet the group menu's New c… |
| B-772 | chore | triaged | fixes-tooling |  | Lighten the components tier: trim the New York zone run and slow component tests |
| B-776 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the header the tabs carry what each reads: U… |
| B-778 | bug | triaged | fixes-tooling |  | CI flake: packages/data/src/services/accountAdmin.int.test.ts: accountAdminService.setRole makes an account support, ad… |
| B-779 | bug | staging | fixes-bug | prd/fixes-bug | Timeline: a direct ?day= load with no entries today lands the day's heading about 160px below the top |
| B-780 | change | triaged | fixes-tooling |  | CI warns when a branch's quarantine or brake list trails dev's (follow-up of B-771 sync brings dev's CI lists) |
| B-781 | chore | triaged | fixes-tooling |  | Count check budget and silence stops apart in pnpm prd check --times and pnpm prd metrics |
| B-782 | bug | triaged | fixes-tooling |  | CI flake: packages/api/src/admin/usersAdmin.int.test.ts: admin.users.get shows the account, its sessions, groups and ma… |
| B-785 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/timeline/timelineJumpPaging.browser.test.tsx: scrolling newer from a day Back … |
| B-787 | bug | staging | fixes-bug | prd/fixes-bug | Service worker install is all-or-nothing over ~530 files (addAll): one failed fetch on a flaky mobile network leaves the device with no offline worker until the next try |
| B-789 | change | triaged | self-recovery-2 |  | A landing journal (even one whose pid is dead) holds a session's resume after a usage limit with only a waits line each tick; file one report so the user runs pnpm prd land --resume |
| B-790 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/timeline/timelineScroll.browser.test.tsx: infinite scroll three pages down, an… |
| B-791 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/profile/emergency.browser.test.tsx: the owner's sheet builds the list: a membe… |
| B-792 | bug | staging | fixes-bug | prd/fixes-bug | Connectors: todays_doses doesn't return a med time's id, so a member's AI can't find the passId give_pass needs |
| B-794 | plan | triaged | risa-next |  | Risa: a central agent that gathers from several repos and prioritises across them |
| B-795 | chore | triaged | risa-next |  | Clean Caretook's history of the orchestration tooling and its bloat |
| B-796 | chore | triaged | risa-next |  | Risa: split the project config into a folder and tidy the test rules and gates |
| B-797 | plan | triaged | risa-next |  | Risa: prove it on a second repo with tests, then make it usable by others |
| B-798 | change | triaged | fixes-perf |  | Build Intl date formatters once per zone in dayLabel (@caretook/data/schema) and medicationDisplay.ts:144, as B-793 did for the timeline |
| B-799 | change | inbox |  |  | Include captain name and backlog agent name so other agents can find it. |
| B-802 | bug | triaged | fixes-tooling |  | CI flake: invites.spec.mjs '3. reset a password by email › the new password signs in' failed once, passed on rerun |
| B-805 | question | triaged | sync-safety-2 |  | Can the PWA sync in the background after offline work, or does the user have to open it to sync? |
| B-807 | bug | triaged | fixes-tooling |  | CI: scripts/loops/fixes-plans.test.mjs: fix topics fixes-ui has a plan with a parsing Status table fails on dev |
| B-808 | bug | triaged | fixes-tooling |  | Browser check ui.spec: the add sheet's surface can measure 0 by 0 under load |
| B-809 | bug | triaged | fixes-tooling |  | The dispatcher keeps running the code it started with: started 2026-11-24 08:07, before the usage drain landed (B-407, 17:55), it started fixes-bug and a todo-subtasks planner at 85% weekly usage while dispatch --dry-run said draining |
| B-810 | bug | triaged | fixes-tooling |  | pnpm prd end <name> ends the pid in the session record, not the live session: ending prd-planner-3 killed pid 46403 while the dispatcher-reopened session (pid 77478, session.sh pid 76171) kept running |
| B-811 | change | triaged | self-recovery-2 |  | Automatic cleanup finishes a landed PRD left half-done: worktree and slot still held, registry not done, an idle orchestrator session with nothing to do, a branch with only post-landing docs commits |
| B-812 | bug | triaged | fixes-tooling |  | An orchestrator's finishing step runs pnpm prd rm from inside its own worktree, so the next step (cd to the main checkout && pnpm prd end) never runs: the harness refuses a command whose cwd was deleted, and the session stays open |
| B-813 | feature | triaged | fixes-tooling |  | Per-task usage override: a topic the user names may start or plan between the drain line (95%) and the 98% stop, e.g. pnpm prd dispatch --allow <topic>; everything still ends at the stop |
| B-814 | feature | triaged | usage-aware-drain |  | Orchestrator picks the usage drain line from the current Claude plan (e.g. ultra vs smaller plans) instead of one fixed percent |
| B-815 | change | triaged | risa-next |  | Orchestrator summary for backlog handoff should include the ability to pass on directives from the… |
| B-816 | question | triaged | risa-next |  | Should the orchestrator PRDQ be slice-based instead of PRD-based? |
| B-817 | bug | landed | fixes-ui | prd/fixes-ui | Mobile bottom nav renders dark in light mode |
| B-818 | bug | triaged | fixes-tooling |  | watchdog.test.mjs 'reads the limit as the drain does' fails when the shell has CARETOOK_USAGE_WATCH=off: it passes process.env to readDrain (expected 'normal' to be 'limited') |
| B-819 | change | triaged | fixes-ui |  | Picking a care group on the no-group page gives no feedback while the group loads, and the buttons can be tapped again: show a loading state at once (a loading page, or disable the buttons and show loading in the one tapped) |
| B-820 | feature | triaged | risa-next |  | Risa: cross-repo topics: a Risa topic can change a configured subproject's code (Caretook), each side passing its own repo's checks |
| B-821 | change | in-progress | orchestration-split | prd/orchestration-split | Risa's lookup reads a moved B-n as RISA-n (a former-prefix key in the config): the PRD decision has no builder yet |
| B-822 | chore | in-progress | orchestration-split | prd/orchestration-split | Backlog id prefix leftovers from slice 2: the look-alike sort's id.slice(2), the item type vs idPrefix, and a raw stack when risa.json is broken |
| B-823 | chore | in-progress | orchestration-split | prd/orchestration-split | Branch prefixes from the config are honoured only in lib.sh: ready.sh, rm.sh and others still hardcode prd/, and is_protected has no caller |
| B-824 | bug | triaged | fixes-tooling |  | CI flake: scripts/loops/lease.test.mjs: pnpm prd check's check lease makes the runs beyond the default limit of two wai… |
| B-825 | chore | triaged | orchestration-split |  | doc-budget.mjs in scripts/project keeps its own copy of the registry table header: a column added by the core makes warn mode print 'plan status: skipped', and no test ties the two |
| B-826 | chore | triaged | orchestration-split |  | run_project in lib.sh evals a config command in the caller's shell: a command with cd or exit would change new.sh; run it in a subshell |
| B-827 | chore | triaged | orchestration-split |  | No slice owns two leftovers of the split's seams: fixes-plans.test.mjs imports the core's status-trim.mjs (pnpm test:project fails without the core), and the 'what to try' text and migration, seed and powersync notes in land.sh and ready.sh are Caretook facts in core files |
| B-828 | bug | landed | fixes-ui | prd/fixes-ui | Switching between submenus and group settings sometimes loads slowly with no feedback |
| B-829 | question | inbox |  |  | Research: compare Care Book to Caring Village |
| B-830 | bug | triaged | fixes-bug |  | Staging's seeded invite link shows 'Couldn't load this link': the Seed and Reset staging Actions seal it without INVITE_LINK_KEY |
| B-831 | feature | triaged | data-rights |  | Inactive group scrub: a care group with no member sign-in for X days gets a cycle of reminder emails, then its data is scrubbed automatically |
| B-832 | chore | triaged | orchestration-split |  | Wave 4 skeptic's code follow-ups for the split: unquoted role_doc fallback in five prompts, tier data read at check-plan import, a TypeError on a newline in a file name, the sample repo copying all of scripts/loops |
| B-833 | change | triaged | fixes-ui |  | Quick entry tips' examples should use the group's own provider and medication |
| B-834 | chore | triaged | orchestration-split |  | Wave 5 skeptic's code follow-ups for the split: the check plan's under() matches a path equal to a folder name (a symlink or gitlink replacing scripts/loops would propose none), prd.sh's check case carries on with an empty mode when check-plan.mjs throws, and a bad tier file fails CI commands with a bare stack |
| B-835 | chore | triaged | orchestration-split |  | Wave 6 skeptic's follow-ups for the split: land.sh reads any docBudget hook failure as a budget breach and a mistyped hooks key skips the budget silently, no test joins a built release verdict to releasePasses at tier release, the core hardcodes prd fixes-bug in release.mjs and blame.mjs, vitest.config.ts keeps a stale loops/check-body entry and check-plan.mjs:11 a stale comment, check-tooling.mjs passes on an unset testProjects.tooling while tooling-tests.mjs throws |
| B-836 | feature | triaged | marketing |  | Marketing site visual refresh to modern design standards (split from B-417; no screenshots or videos) |
| B-837 | change | inbox |  |  | Time limit gate for component tests to keep them from growing too long |

## Items

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
- prd: staging-ship
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (codex-review.mjs:37), verified. Paginate, or refuse clean when hasNextPage.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.
- 2026-11-24 (plan/staging-ship): plan/staging-ship (2026-11-24): planned in plans/staging-ship-plan.md (7 slices, held until the user lifts it, a160). B-584 and B-241 moved in from fixes-tooling: B-584 is this feature's trigger and stays open after slice 7 until a real push reaches the phone (B-586); B-241 could make a release PR read as clean.

### B-244 · chore · codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/github-review): User's decision 2026-11-21. One-line change in openFindings (scripts/loops/codex-review.mjs) plus a test on the outdated.json fixture. Declined, non-outdated threads still need reply + resolve. Update docs/agents/orchestrator.md _Landing a wave_ step 4, docs/orchestration.md and the orchestrator prompt line in prompt.sh (+ prompt.test.mjs): only declined threads need --resolve.
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: moved from github-review (done) to the standing tooling fixes topic; each is a small fix to the review tooling.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

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
- 2026-11-25 (prd/planner-3): planner-3 landed (8c1fa06, PR #182): addTodo.repeatRule now exists in the assistant action runners; add_todo can pass it through instead of building its own rule.
- 2026-11-25 (prd/planner-3): planner-3 landed (8c1fa06b, PR #182): addTodo.repeatRule exists in the assistant action runners and the todo service; connectors-3 can build add_todo's repeat on it.
- 2026-11-25 (prd/planner-3): planner-3 landed in dev (8c1fa06, PR #182): the assistant's addTodo action now takes repeatRule (B-254), so add_todo can pass it through
- 2026-11-25 (prd/planner-3): planner-3 landed (8c1fa06): the quick-entry addTodo action now takes repeatRule (B-254); add_todo can reuse it rather than add its own repeat shape.

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
- 2026-11-24 (prd/fixes-ui): fixes-ui wave 12 (dev ea38277): the blank cold start is covered by B-806 (root HydrateFallback is now brand/AppLoading). Left: the top safe-area inset (viewport-fit=cover) on the header and sticky day headers, with Capacitor.

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

- status: landed
- prd: fixes-ui
- owner: prd/fixes-ui
- commit: dc2e5fc4

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/client.ts:22-27. Fix idea: pool.on('error', logError), attachDatabasePool from @vercel/functions (already a dependency), a longer queue wait. High.
- 2026-11-25 (Robert Bo Davis): Moved from hosting to fixes-bug (backlog session, 2026-11-25): a small fix testers would hit as random errors on staging; wanted before the user's live alpha-tester call on 2026-11-26.
- 2026-11-25 (Robert Bo Davis): Moved from hosting to fixes-bug (backlog session, 2026-11-25): a small fix testers would hit as random errors on staging; wanted before the user's live alpha-tester call on 2026-11-26.
- 2026-11-25 (Robert Bo Davis): Pre-call run 2026-11-25 (the user's choice): one fixes-ui wave of only B-342, B-817, B-828; B-342 moved from fixes-bug for it. Must land and remove its worktree before orchestration-split wave 6 lands (about 2 to 2.5 h).

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
- 2026-11-23 (Robert Bo Davis): 2026-11-23 backlog session: do the real-Google check before merging staging PR #115. calendars-2 (B-304 to B-309) never ran against real Google, and its first push rewrites every connected member's Google events once and writes events up to a year ahead for the first time. Steps: to-test/2026-11-23-0742-calendars-2.md, 0812, 0841. The Google smoke test does not call the new window list yet.
- 2026-11-23 (Robert Bo Davis): 2026-11-23 correction, replaces the earlier note today: the real-Google check does NOT block staging PR #115. Run it on staging AFTER the merge (#115 stays held only for test-gates-2). Localhost can't run it fully: pulls and the catch-up run from Vercel cron, on deployed sites only; pnpm calendar:google-smoke runs locally but doesn't call listWindow. Order: (1) set up Google for staging if needed (runbook 5a: OAuth client, redirect https://staging.caretook.com/api/google/callback, test user, three GOOGLE_* values in Vercel; GitHub's staging secrets have none, Vercel not checked); (2) merge #115 after test-gates-2; (3) connect a test member on staging and run to-test/2026-11-23-0742, 0812 and 0841-calendars-2.md.

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
- 2026-11-23 (plan/calendars-3): calendars-3 planned (2026-11-23): four slices, held after two skeptic send-backs; the user approved web-push 4.0.0, time-only push text, and landing it held (asks a136, a137, a138).

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
- 2026-11-24 (plan/staging-ship): plan/staging-ship (2026-11-24): planned in plans/staging-ship-plan.md (7 slices, held until the user lifts it, a160). B-584 and B-241 moved in from fixes-tooling: B-584 is this feature's trigger and stays open after slice 7 until a real push reaches the phone (B-586); B-241 could make a release PR read as clean.

### B-417 · feature · We are getting close to feature complete. We need another marketing content pass that updates copy…

- status: triaged
- prd: marketing-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: We are getting close to feature complete. We need another marketing content pass that updates copy and layout to reflect the new features. Also improve ui to meet modern design standards. NO SCREENSHOTS yet. No videos.
- 2026-11-21 (Robert Bo Davis): Triage: marketing topic (on hold). A copy and layout pass for the new features plus a design refresh; no screenshots or videos, so it does not wait on B-40.
- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): before launch, the marketing language should cover connecting your own Claude or ChatGPT (the connectors / MCP connect guide under Settings → Devices and Group settings → Assistants).
- 2026-11-25 (Robert Bo Davis): From the user (backlog session, 2026-11-25): the content pass follows plans/marketing-prd.md, Messaging update (2026-11-25): the 'Care, taken.' lockup in the hero; 'Free for families' with the essentials free, always, and early families grandfathered; a founder story on About once the user gives the facts; claims discipline; stays caretook.com.
- 2026-11-25 (plan/marketing-2): Planned 2026-11-25 as marketing-2 (copy part only: the new language, today's features, the approved founder story). The visual refresh is a separate item under marketing.

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
- 2026-11-24 (plan/staging-ship): plan/staging-ship (2026-11-24): planned in plans/staging-ship-plan.md (7 slices, held until the user lifts it, a160). B-584 and B-241 moved in from fixes-tooling: B-584 is this feature's trigger and stays open after slice 7 until a real push reaches the phone (B-586); B-241 could make a release PR read as clean.

### B-431 · chore · A finished PRD gets its done flag without rm: set it at the last landing or in pnpm prd tidy (check-speed still reads planned with nothing waiting)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. rm.sh sets done only when the worktree is removed; B-403 lists done rows as leftovers but does not say it sets the flag. Small tooling fix.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.
- 2026-11-25 (Robert Bo Davis): Hit 2026-11-25: planner-3 landed 06:34 (8c1fa06) with its row still planned; the dispatcher logged 'start planner-3: planned, and nothing stops it' 8 times 06:35-06:43 (.loops/.dispatch.log ~62905-63142), each opening a new prd-planner-3 tab, then reopened it at 06:45. Each tab said it was done and ending, but the worktree, slot and one live session (pid 77478) stayed until the backlog session ran pnpm prd rm by hand ~11:45, blocking the one lane for 5 h. Raise priority: a landed topic must never be started or reopened.
- 2026-11-25 (Robert Bo Davis): Cause found: after landing, the orchestrator committed 'docs(planner-3): landed' (07d9fc14) on prd/planner-3, so the branch was no longer merged into dev; pnpm prd rm then removes the worktree but keeps the branch and does NOT set done ('kept prd/planner-3: it isn't merged'). The row stays planned, the dispatcher starts the topic again (re-creating the worktree), and each fresh orchestrator finds 'landed and done' and repeats. Fix: write the landed status before the final land (or land the tail), and have rm/land set done when the topic's items are all landed.

### B-432 · chore · After a landing that changes the lockfile, pnpm prd land runs pnpm install in the main checkout (or files an ask) instead of only printing a reminder

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. land.sh and ready.sh print the reminder; an unattended landing leaves the main checkout stale. Needs care: the main checkout is the user's. Small tooling fix.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

### B-436 · feature · A to-test report for a staging ship, like the landing reports of B-410

- status: triaged
- prd: staging-ship
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Filed from the backlog session 2026-11-21 after a gap review of the upcoming orchestration runs; the user chose to file it. B-410 left it undecided as a follow-up; belongs with B-404 (ship dev to staging).
- 2026-11-21 (plan/orchestration-3): Moved out of orchestration-3 by its planner (2026-11-21) to keep that PRD at six slices: orchestration-3 is the dispatcher core (B-392, B-426, B-427, B-428, B-439). The grouping and the row order of the four follow-on topics are the planner's; plans/orchestration-3-prd.md, Follow-on topics.
- 2026-11-24 (plan/staging-ship): plan/staging-ship (2026-11-24): planned in plans/staging-ship-plan.md (7 slices, held until the user lifts it, a160). B-584 and B-241 moved in from fixes-tooling: B-584 is this feature's trigger and stays open after slice 7 until a real push reaches the phone (B-586); B-241 could make a release PR read as clean.

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

### B-447 · bug · to-test file: 'What wasn't checked' repeats the quick-check line, and a tooling-only landing still gets the app's dev URL and seed sign-ins under 'What to try'

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (prd/orchestration-2): Seen on the first real file, to-test/2026-11-21-1838-orchestration-2.md (orchestration-2 wave 5). For a diff that is only scripts/ and docs, name the commands to try instead.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 7 (landing, Codex, cleanup). After agent-autonomy, which holds the landing scripts.

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

### B-477 · change · PRD registry: a hold carries its reason

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): User, 2026-11-21 (backlog session): "we probably need a 'hold reason' field for some of these holds to make them easier to manage in another session that doesn't have this context." Backlog session's sketch, not the user's words: pnpm backlog prd set <topic> flags=hold takes a reason (and a date), prd list, prd status and dispatch --dry-run print it beside 'on hold', and clearing the hold clears it; dispatch --pause already takes a <why>. Reasons for the holds set in this session, to fill in when the field exists: planner-3 (a note can carry a todo) is held because its landed plan must be revised to the user's design first, see the note on B-245; contract-migrations, asks-relay, sync-safety-2, ui-kit-3, code-health-2 and code-health-3 are held only to stop planning from burning model usage (user's pick, 2026-11-21), not for any problem with the topics: release them when the user wants planning to resume.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 3 (context, dispatcher, sessions). B-600 goes first. Avoids agent-autonomy's hot files.

### B-542 · chore · Unit-test projects run at Vitest's default workers (cores - 1, 9 here): two overlapping checks run ~18 test processes on 10 cores, the load behind the under-load timeouts; cap the unit group at about 4 (or half the cores) and time it against check-times

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): Filed from the backlog session 2026-11-22 at the user's request. Component tests (2), integration (3), Playwright (1), check slots (2) are already capped; only the unit group isn't. fixes-tooling: a check-speed and flake fix.
- 2026-11-22 (Robert Bo Davis): Decided by the user 2026-11-22: fixes-tooling wave 1, after test-gates lands. Wave 1 is the test worker cap (B-542) first, then the dispatcher, ask and notice races (B-452, B-454, B-525, B-526). Keep it small: these files are shared with agent-autonomy, self-recovery and worker-watch.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.
- 2026-11-24 (prd/fixes-tooling): Wave 7 (fixes-tooling wave 6 planning, 2026-11-24): the unit worker cap lives in vitest.config.ts, test-health-2's hot file; the user said not to run wave 7 before the pause.

### B-543 · question · Split the orchestration tooling into its own multi-project tool, or replace it with a prebuilt one

- status: in-progress
- prd: orchestration-split
- owner: prd/orchestration-split
- commit:

- 2026-11-22 (Robert Bo Davis): User 2026-11-22: tooling is robust enough to manage work across all projects on this machine; keep handrolling vs adopt a prebuilt option. Size: ~23k lines in scripts/loops, scripts/backlog, .githooks (~11k tests), 105 files tied to caretook. The top four registry rows (test-gates, agent-autonomy 1-3) are all orchestration. Decide before planning: freeze, extract, or replace.
- 2026-11-22 (Robert Bo Davis): Deferred to after launch (user, 2026-11-22): the only other active project is a legacy BigCommerce Stencil site with no tests, a poor fit for this process, so no multi-project need yet. Revisit after launch.
- 2026-11-23 (Robert Bo Davis): Sizing 2026-11-23 (estimate from measuring the code, no trial extraction): medium lift, about 2-3 PRDs to a separate tool proven on a second project. Size: ~34k lines in scripts/loops, scripts/backlog, .githooks (~17k code, ~16k tests) plus ~700 lines of role docs. Easier: no runtime package deps (only vitest in tests); app code calls it only from two test helpers (apps/web/test/browserLease.ts, packages/data/test/globalSetup.ts); most 'caretook' mentions are mechanical renames (CARETOOK_* env vars). Hard: (1) stack knowledge needs a per-project adapter (stack-lib.sh, browser.sh, test-db.sh, check-areas.d); (2) assumed paths and pnpm commands across ~40 files become config; (3) cutover: drain worktrees, pause the dispatcher, pin a tool version. Phases: (a) separate it, Caretook only, no behavior change, 1 PRD; (b) prove it on a small new repo with tests (Stencil is a poor fit), 1 PRD; (c) usable by others (install, docs, versioning, macOS/iTerm independence), open-ended, skip unless releasing. Recommendation: still after launch, once the tooling stops changing quickly.
- 2026-11-24 (plan/orchestration-split): Planned 2026-11-24 with the user (big choices approved one at a time): Risa, an external tool at ~/git/risa that runs Claude in configured repos; Caretook becomes config, plans and its own scripts, no dependency on Risa. Stage 1 in place: orchestration-split (seams) and orchestration-split-2 (Caretook's parts, renames), both held; stage 2 a hand runbook (plans/orchestration-split-move.md); later items B-794..B-797 under risa-next (held).
- 2026-11-24 (Robert Bo Davis): Landed 1297ec9c (2026-11-24): three held stage-1 topics (orchestration-split, -2, -3), the move runbook plans/orchestration-split-move.md, later items B-794..B-797 under risa-next (held). Three skeptics (two Opus, one Fable) sent it back; all fixed; their big choices went to the user.

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

### B-550 · feature · Nested todos: subtasks up to 3 levels deep, a parent completes when its last subtask is done

- status: triaged
- prd: todo-subtasks
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user (backlog session, 2026-11-22): any depth in the model, limited to 3 levels in code; the parent auto-completes when its last subtask is done. Triage: new topic todo-subtasks (a parent_id on todo, sync, the Planner and todo screens). Depends on planner-3 (held, revising todo links), which owns todos/ and the todo schema; run it after.
- 2026-11-25 (plan/todo-subtasks): Planned (todo-subtasks planner, 2026-11-25): PRD and plan in plans/todo-subtasks-{prd,plan}.md, six slices; runs after tags. Held after two skeptic send-backs (slice size), reworked; question a219.
- 2026-11-25 (plan/todo-subtasks): User (a219, 2026-11-25): split smaller and keep it held. Now todo-subtasks (6 slices: server, device, todo page) and todo-subtasks-2 (2 slices: the lists); both rows held.

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

### B-584 · chore · Backlog prompt: "deploy staging" trigger that promotes dev and notifies my phone

- status: triaged
- prd: staging-ship
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): From the user, 2026-11-22. Add a "deploy staging" trigger to the backlog session prompt (scripts/loops/prompt.sh). Workflow: find or open the dev to staging PR; wait for Codex and triage its findings (verified non-blockers become backlog follow-ups); check what changed since the reviewed commit; if no blockers, merge pinned to the checked head with a Conventional subject; watch deploy.yml in the background; when it ends, success or failure, call the PushNotification tool so the result reaches the phone. A blocker stops the merge and is pushed as well. Triaged to fixes-tooling: prompt tooling.
- 2026-11-22 (Robert Bo Davis): The phone step depends on B-586 (pushes from the backlog session do not arrive): fix or replace that route first.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 8 (planning and prompts). After agent-autonomy, which holds prompt.sh.
- 2026-11-24 (plan/staging-ship): plan/staging-ship (2026-11-24): planned in plans/staging-ship-plan.md (7 slices, held until the user lifts it, a160). B-584 and B-241 moved in from fixes-tooling: B-584 is this feature's trigger and stays open after slice 7 until a real push reaches the phone (B-586); B-241 could make a release PR read as clean.

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
- 2026-11-23 (Robert Bo Davis): 2026-11-23, stress run, no fix made (the user's call): 24 of 24 runs passed at 5-minute load about 18 to 25 on the Mac. Slowest query 18.7 ms (limit 50), slowest rebuild 132 ms (limit 2,000), lock wait at most 2 ms. Not reproduced, and CI run 45117253571 kept no failing number, so the limits stay. Next failure: read the number from the CI verdict once it keeps failure messages (see the new item), then decide.
- 2026-11-23 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/calendars-2.
- 2026-11-23 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/timeline-jump.
- 2026-11-23 (Robert Bo Davis): Merged from B-492 (2026-11-23): flaky under load in full checks (7 runs at load 11-20), passes alone 3/3. The user's earlier call stands: re-measure after the test worker cap (B-542) and quarantine, fix only what still flakes.

### B-623 · bug · Check rerun never runs for tooling: check-body's 'unhandled error' grep matches a passing test's title

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/test-gates): scripts/loops/check-body.sh:69 greps the verbose output for 'unhandled error', and browser/check-body tests include the passing title "doesn't rerun after an unhandled error". So any tooling failure prints 'an unhandled error, so no rerun' and skips its one rerun. Seen on prd/test-gates 518a041f, 2026-11-23.
- 2026-11-23 (Robert Bo Davis): fixes-tooling wave order (the user, 2026-11-23: keep one topic, organize waves by kind of work; replaces the plan Status list of wave 3 candidates). Order: 3 context, dispatcher, sessions; 4 known flakes by cause; 5 re-measure test flakes; 6 check flow; 7 landing, Codex, cleanup; 8 planning and prompts. This item: wave 6 (check flow). After agent-autonomy, which holds the check scripts. Confirm B-574 and B-576 still happen before fixing them: test-gates wave 4 gave lint 6 GB.
- 2026-11-24 (prd/fixes-tooling): 2026-11-24: every fixes-tooling wave 4 slice check (25, 28, 29, 30) ended 'tooling: an unhandled error, so no rerun' on plain test timeouts, so load flakes in stack.test (B-740), tidy-cli and ask.test were never retried.

### B-625 · chore · Drop todo.event_id and its old-client mirror once no device writes it

- status: triaged
- prd: contract-migrations
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From planner-3 (B-245): link rows in timeline_entry_todo replace the column. Contract step: remove the column, the todoService mirror, the releaseEvent and unlink clears, and eventId on old upload paths.

### B-630 · chore · Two helpers build the legal page links (lib/auth/legalLinks.ts and settings account/legalLinks.ts): fold them into one

- status: triaged
- prd: fixes-nit
- owner:
- commit:

- 2026-11-23 (prd/onboarding): From onboarding slices 1 and 2; both use VITE_API_ORIGIN on native.

### B-633 · bug · CI flake: apps/web/app/routes/app/groups/timeline/timelineBack.browser.test.tsx: back from the entry page three pages d…

- status: triaged
- prd: fixes-tooling
- owner: prd/fixes-tooling
- commit: fe811b8e

- 2026-11-23 (Robert Bo Davis): [ci-key 33d04fe2a0f3] Flaked (passed on its rerun); found by prd/onboarding.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 5 (re-measure test flakes).
- 2026-11-24 (prd/fixes-tooling): Re-measured 2026-11-24 by fixes-tooling slice 31 (after B-607), at 1-min load 18-103 beside the other checks: no failure in 10 runs (quarantined ones with CARETOOK_QUARANTINE=run). Proposed: close.
- 2026-11-24 (prd/symptom-catalog): Still flaking after landing: symptom-catalog run 45433991590 (components-2, 60112aa4, 2026-11-24): settle timeout after Back with care_period/care_group_member/medication_pass/document queries pending, both web:components and :ny, first run and retry; 3/3 alone. Also hit the B-235 test in the same file.
- 2026-11-24 (Robert Bo Davis): Reopened 2026-11-24 (user): closed by ask a184 but failing again in CI since dev's quarantine tidy 326c611d (symptom-catalog runs 45433991590, 45440714729). Also tracks the sibling timelineBack test 'Back, then the filter that's on picked again' (was under B-568) [ci-key d923e28bf2a5].
- 2026-11-24 (Robert Bo Davis): Reopened 2026-11-24 (user): closed by ask a184 but failing again in CI since dev's quarantine tidy 326c611d (symptom-catalog runs 45433991590, 45440714729). Also tracks the sibling timelineBack test 'Back, then the filter that is on picked again' (was under B-568) [ci-key d923e28bf2a5].
- 2026-11-24 (Robert Bo Davis): Flaked (passed on its rerun); found by prd/symptom-catalog.
- 2026-11-24 (Robert Bo Davis): Flaked (passed on its rerun); found by prd/symptom-catalog.
- 2026-11-24 (Robert Bo Davis): Flaked (passed on its rerun); found by prd/fixes-tooling.
- 2026-11-24 (Robert Bo Davis): Flaked (passed on its rerun); found by prd/fixes-tooling.

### B-637 · chore · About 20 settings and provider files still use text-base-content opacity classes instead of the UI kit

- status: triaged
- prd: fixes-nit
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From ui-kit-5's plan report (a104): left out because B-577 does not name them and the lint guard does not flag them. A small tidy, so fixes-nit.

### B-639 · bug · Unsynced landing can miss a brake on a newer origin/dev: land reads the verdict for local dev's tip

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/agent-autonomy): From agent-autonomy slice 4 (B-518). unsynced_dev_brake reads the tip of drift_ref, normally local dev. If local dev is behind origin/dev, a brake verdict on origin's newer tip is seen only through a live dev-brake notice. Fix: read origin/dev's tip too, or fetch before judging.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 7 (landing, Codex, cleanup).

### B-649 · bug · A skeptic's --force treats an unreadable GitHub as no known dev brake; it could fail closed

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/agent-autonomy-3): From agent-autonomy-3 slice 3. Matches unsynced_dev_brake today; a go could refuse when the brake state can't be read.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 7 (landing, Codex, cleanup).

### B-653 · bug · CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the list an item leaves the Planner tab once…

- status: triaged
- prd: fixes-tooling
- owner: prd/fixes-tooling
- commit: fe811b8e

- 2026-11-23 (Robert Bo Davis): [ci-key 490c60a6d926] Flaked (passed on its rerun); found by prd/ui-kit-5.
- 2026-11-23 (Robert Bo Davis): Merged from B-486 (2026-11-23): times out at 15 s stepping 4 h of fake timers; fails alone 3/3 at load ~18, passes 3/3 at ~8. Fix: step the clock in fewer, larger jumps, or raise this test's timeout. This item owns the quarantine entry.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 5 (re-measure test flakes).
- 2026-11-24 (prd/fixes-tooling): Re-measured 2026-11-24 by fixes-tooling slice 31 (after B-607), at 1-min load 18-103 beside the other checks: no failure in 10 runs (quarantined ones with CARETOOK_QUARANTINE=run). Proposed: close.
- 2026-11-24 (prd/symptom-catalog): Still flaking after landing: symptom-catalog runs 45427105181 and 45433991590 (2026-11-24), 15 s test timeout under load; 3/3 alone at load ~73.
- 2026-11-24 (Robert Bo Davis): Reopened 2026-11-24 (user): closed by ask a184 but failing again in CI since dev's quarantine tidy 326c611d (symptom-catalog runs 45433991590, 45440714729); a184's light-load re-measure missed it.
- 2026-11-24 (Robert Bo Davis): Flaked (passed on its rerun); found by prd/symptom-catalog.
- 2026-11-24 (Robert Bo Davis): Flaked (passed on its rerun); found by prd/fixes-tooling.

### B-660 · chore · CI verdicts keep each failed test's failure message, so a one-off flake shows which limit or timeout broke

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From the search speed flake (B-619, B-492): the verdict artifact names the failing test only, so run 45117253571 left no number to diagnose. The search test's assertion already carries its timings in the message. Likely in scripts/ci/test-job.mjs and verdict.mjs.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 6 (check flow).

### B-665 · change · Remove the standalone Invite someone notice from the Timeline; inviting lives in the onboarding setup steps

- status: triaged
- prd: onboarding-2
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From the user, 2026-11-23: the 'invite someone' notice at the top of the Timeline should move out of the page and into the onboarding flow. Today the setup card (GettingStartedCard.tsx) already has an 'Invite someone to help' step for owners and admins, but line 137-138 falls back to InviteSomeoneCard after setup is dismissed or its 14 days end, so the notice comes back. Fix: drop the fallback and delete InviteSomeoneCard. Update what relies on data-invite-card: newGroup.browser.test.tsx, gettingStarted.browser.test.tsx, scripts/browser-checks/first-sync.spec.mjs, invites.spec.mjs. Note: the setup card itself still shows on the Timeline; moving it elsewhere would be a separate decision.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23 (testing on dev): replaces the fix above. Don't just delete the notice: move the Invite someone prompt into a toast, so no card sits on the Timeline. It belongs in the second onboarding PRD the user is about to triage; prd stays fixes-ui until that topic exists. Reuse the ui Toast (AddedMedicationToast.tsx is the pattern: timed, clears on navigation, one action). Same audience as today: an owner or admin who is the group's only member, after the setup card is dismissed or its 14 days end. Still open: what triggers the toast and how often it may return, so it doesn't appear on every Timeline visit. InviteSomeoneCard and the data-invite-card tests still need updating.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23: folded into B-670 (onboarding pages). Delete InviteSomeoneCard and its Timeline fallback; inviting becomes a step in the flow and the one 'Want help onboarding?' toast covers it. No separate invite toast. This replaces the earlier toast note.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23: replaces the earlier fold-in note. Delete InviteSomeoneCard and its Timeline fallback, and make inviting a toast nudge for the group's creator, not a page step in B-670. Its action opens group settings, members. Stops once the group has another member. Timing is decided in B-670.
- 2026-11-23 (Robert Bo Davis): User report 2026-11-23, no separate bug because the new onboarding replaces it: the current Invite someone onboarding item takes the user to their profile but does not open the invite-by-email form. When B-665 builds the invite toast nudge, its action must land on the invite form already open, not just the page.

### B-667 · chore · Resettable seeded onboarding test user, so the new-member setup flow can be retried without a new address each time

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From the user, 2026-11-23. Today no seeded account sees onboarding: seeds/setupDismissed.ts dismisses setup for every member of seeded groups, and the workaround is /join/CARE-DEMO-0001 with a new fictional address. Wants a fictional @example.com account (dev and staging, never production) that starts in the setup state and can be reset, exempt from the seeded dismissal. Decide at build time how the reset works and whether it covers owner and invited roles.
- 2026-11-23 (Robert Bo Davis): 2026-11-23: under B-670 only group creators get onboarding, so this test user must be a group creator with nothing set up, resettable to before first login.
- 2026-11-23 (Robert Bo Davis): Correction, 2026-11-23: /join/CARE-DEMO-0001 already makes a group creator, but needs a new address each time. This item is still what makes the flow repeatable: a creator with nothing set up, resettable to before first login.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 5 (re-measure test flakes; test fixtures).

### B-670 · feature · Onboarding on its own pages with inline forms, providers first, a care period step, a Later exit and a Want help onboarding? toast

- status: triaged
- prd: onboarding-2
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From the user, 2026-11-23. Move onboarding off the Timeline card onto its own pages, with forms to do each action inline. Dismissable with 'Later, take me to caretook!'. If items are still missing, the user gets a 'Want help onboarding?' toast on login, and periodically while their attention is on the app. First step is providers, because the other items link to them. Code read: providers are linked from medications (prescriber_id), condition managers, entries (entry_provider), notes, todos, care periods (place_provider_id) and event series (provider_ids). Today's steps are profile, medication, entry, invite (managers), plus a connect pointer (gettingStarted.ts); there is no provider step or hasProvider fact, so both are new. ProviderForm and MedicationForm take onDone/onCancel and look reusable inline; confirm. Routes must be shared-route safe (clientLoader, local database, no server loader) and work offline. Nothing in the app tracks page visibility or focus yet, so the attention check is new. Depends on B-669 (shared toast system). Replaces GettingStartedCard on both timelines, including Easy view; update its tests and app-shell.md, timeline.md.
- 2026-11-23 (Robert Bo Davis): From the user, 2026-11-23: first login takes them directly to the onboarding forms flow page, not the Timeline. The redirect must work offline and on the native target (clientLoader or client navigation, no server redirect), and must happen only once, so 'Later' is never undone by the next login.
- 2026-11-23 (Robert Bo Davis): User decisions, 2026-11-23. Who: group creators only get the flow, the first-login redirect and the toast. Invited members land on the Timeline with a short welcome and no steps. Toast: on login, then hourly while the app has attention, with no end date, until setup is finished or they choose 'Don't ask again' (a stored, per-user-per-group choice that must follow them across devices). This drops the 14-day window for creators. Invite is a step in the flow (B-665 folded in). Testing: /join/CARE-DEMO-0001 makes an invited member, so it will no longer show onboarding; B-667 (resettable test user) must become a group creator.
- 2026-11-23 (Robert Bo Davis): Correction, 2026-11-23: /join/CARE-DEMO-0001 is a staff access code. One call creates the account and a new care group with that person as owner, so it IS the group-creator path and will show the new onboarding: use it to test. Ignore the earlier line saying it makes an invited member. Invited members come through the invite link (routes/account/invite). A /join sign-up already has its group when the email is confirmed and /app opens, so the first-login redirect fits there. Still open: whether a signed-in user who creates a group at /app/groups/new also enters the flow.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23: this is GROUP onboarding, not new-user onboarding. It runs every time a new group is created, for that group's creator, through /join and /app/groups/new alike, including someone who already has other groups. So the trigger is the creator's first open of a new group (for /join, after the email is confirmed), once per group, replacing the earlier 'first login' wording. All state is per group: steps done, Later, Don't ask again. The toast is about the group being viewed, and only for a group this person created and hasn't finished. Still open: the step order after providers (proposed: profile basics, medications, first entry, invite).
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23: the page flow has three steps, in order: providers, profile basics (conditions and allergies), medications. First entry and invite are NOT pages: they are toast nudges. 'Want help onboarding?' covers only the three page steps. This replaces the earlier 'invite is a step in the flow'. Open: when the two nudges show and how often (proposed: one at a time, first entry then invite, each with its own Don't ask again, on the same login-plus-hourly rhythm, starting once the page flow is finished or left with Later).
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23, settles the nudge timing. The nudges start once the creator finishes the page flow or picks Later. One toast at a time, at most one per hour on login-plus-hourly while the app has attention, in this order: Want help onboarding?, first entry, invite. 'Don't ask again' retires that toast for this group and moves to the next one after a small wait, rather than at the next hourly slot (default 30 seconds, a named constant; the user said only 'a small wait'). Once all three are finished or retired, no more onboarding toasts for the group.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23: connect an AI assistant is the final toast nudge. Order is now: Want help onboarding?, first entry, invite, connect assistant. Same rules: one at a time, login plus hourly, Don't ask again moves on after the small wait. Its action opens group settings, Assistants (appUrls.groupSettings(id, 'assistants')). It only points there: the switch stays off by default and the /connect consent stays as is, because connecting shares health data with an outside AI. Finished needs new work: today's connect step is never ticked, and connector_grant is not in the PowerSync sync config, so the device can't see a live grant. The planner should choose how to tell (an online oRPC read of this member's grants for the group, or a synced fact); when it can't be known, as offline, skip the nudge rather than ask someone already connected. Show it only if the creator can still reach the switch (still owner).
- 2026-11-23 (Robert Bo Davis): 2026-11-23: if B-594 (manage allergies on the Profile page) isn't done when this PRD starts, pull it into onboarding-2 ahead of the pages. The profile basics step should reuse that section, so the allergy form isn't moved twice.
- 2026-11-23 (Robert Bo Davis): User, 2026-11-23: the care period must be part of the onboarding flow, before the first entry nudge. Default placement, stated to the user: a fourth page step after medications, so the page flow is providers, profile basics, medications, care period, and it comes after providers because a period's place can link to one. 'Want help onboarding?' now covers these four page steps; the nudge order is unchanged and first entry still starts only after the page flow is finished or left with Later. Code read: a new group has no care period (only the period form and seeds create one), so this needs a new hasCarePeriod fact in gettingStarted.ts; care_period is already synced, so it works offline. PeriodForm takes onDone/onCancel but submits through a fetcher to the periods/new route action: confirm it can run inline, including 'Add as a new place'. Start dates can't be in the future. Open for the planner or user: whether the step preselects Home.

### B-681 · bug · Promotion prints a passing flake's tests but doesn't file them in the backlog

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/test-gates-2): From slice 4's hand-off: pnpm prd ci promote merges on a passing flake and only prints the flaky tests, while the PRD says browser flakes are filed. The plan assigned the filing to no slice. Proposed for a later wave of test-gates-2; the user reviews.
- 2026-11-23 (prd/test-gates-2): Moved from test-gates-2 when its last wave landed (2026-11-23); that topic is closing.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 7 (landing, Codex, cleanup).

### B-694 · change · Long create forms: core fields on the first tab, the rest on other tabs

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): User, hand-testing on dev: new-item forms that are complex should show a core set of required and key optional fields, with the rest in an Advanced options dropdown, so first entry is less confusing. No shared disclosure exists in the app yet (no <details> in app forms): add one to ui/, native <details> first. Default scope, for the user's review: MedicationForm (core: name, type, strength, dose, schedule; advanced: form, directions, why it's taken, started on, refills, Rx number), ProviderForm (core: type, name, phone; advanced: practice, email, address, website, status), ConditionForm (core: name, status; advanced: since, note, diagnosed by, managed by). Short forms stay as they are: todo, care period, timeline entry, allergy. Rules: creating starts collapsed; editing opens the section when any advanced field has a value, so saved data is never hidden; a validation error inside it opens it and focuses the field; values survive collapsing; the discard prompt still counts them. Coordinate with B-684 required asterisks and B-686 provider phone type, same forms.
- 2026-11-23 (Robert Bo Davis): USER APPROVAL REQUIRED, do not build unattended: the user wants this done in live sessions and approves each form's breakdown (which fields are core, which go under Advanced options) before that form is changed. The split in the first note is only a starting proposal. Go one form at a time: show the proposed split, get the user's approval, then build. A dispatcher or fixes-ui loop must leave this item out of its slices.
- 2026-11-23 (Robert Bo Davis): 2026-11-23, user decision: use tabs instead of an expandable Advanced options section, to be more mobile friendly on long forms. This replaces the collapsible design in the first note; the live-session approval rule still stands, and each form's tabs and field split are approved by the user. Existing TabNav is route links, not a tablist, so this needs a new form-tabs primitive in ui/ (React Aria Tabs is allowed there). Rules: the first tab holds every required field, so a new item can be saved from it; Save stays visible on every tab; all panels stay mounted so values submit and survive switching; a validation error on another tab switches to it and focuses the field, and the tab shows an error marker; the discard prompt counts every tab; editing opens on the first tab, and tabs holding saved values show that they have content; labels fit a 320px phone without horizontal scrolling. Match the tab styling from B-683 (current tab highlights its whole section).
- 2026-11-23 (Robert Bo Davis): 2026-11-23, user decision: form tabs must look the same as the page tabs, ideally one reusable tabs component. Replaces 'a new form-tabs primitive' in the previous note. Build one shared tabs component in ui/ that owns the look (bar, spacing, current state, icon, count, phone width), with two behaviors: page tabs stay real links in a nav (TabNav's current semantics, URLs and aria-current unchanged), and form tabs are a tablist with panels that switch in place, because form tabs must not navigate or unmount fields. Refactor TabNav onto it rather than copying its classes, keep its existing browser tests passing, and add the shared component to the /dev/ui page. Do B-683 (tab selector highlights its whole section) first or in the same slice, so both variants get that styling once.

### B-720 · chore · Confirm dev syncs that share no files with a branch no longer trigger a second CI run

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): Before fix 58e7df2c (2026-11-23), four syncs (member-avatars 835c4e85, test-gates-2 e011122e, dose-accuracy ecb6d2f9, fixes-bug 5850c33f) shared no files with dev and still needed a new CI run; member-avatars ran full three times for one slice. After the next few landings, compare ci/* runs per PRD tip: a no-overlap sync should land unsynced with a typecheck. A sync that shares files should still rerun. Close if clean, otherwise file the cause.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 7 (landing, Codex, cleanup).
- 2026-11-24 (Robert Bo Davis): 2026-11-24 evidence: not clean. Single-slice and small waves still ran twice: test-health-2 slice 5 full x3 (83cadbcf, ec1c138e, e4effb6a), slice 6 full x2 (841ce494, 24218d92); sync-safety slice 3 components x2 (4a3a9550, b004ec55); symptom-catalog components 2a821ccc, 6a246c1e, f47cc0a2; fixes-bug 9d3f2e2c, 82a3cf1b. Most syncs brought risky files (migrations, scripts/ci, package.json, workflow, apps/), so unsynced_safe rightly refused. The waste has other causes, filed separately: the recheck runs the wave's tier when dev brought only tooling (fixes-bug 82a3cf1b, 9m components); the PRD's own plan file counts as a shared file (plans/fixes-bug-plan.md was the only overlap); the wave runs before the sync, so every synced wave pays twice.

### B-721 · bug · Second-zone filing opens a new item when a zone item was landed or dropped but staging still lacks the fix

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/test-gates-2): From test-gates-2 slice 6: zone-file matches open items only, so the next release run refiles that file.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 7 (landing, Codex, cleanup).

### B-722 · bug · A release run after a recorded override replaces the override's release-gate status, so a failing run blocks main again

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-23 (prd/test-gates-2): From test-gates-2 slice 6: decide whether a run should keep an OVERRIDE on the same commit.
- 2026-11-24 (prd/fixes-tooling): Proposed by the fixes-tooling orchestrator 2026-11-24. This item: wave 7 (landing, Codex, cleanup).

### B-730 · bug · A magic-link or invite sign-in that lands while an offline sign-out is still pending has its new session ended by the next /app check (sign-in page guards it, other sign-in paths don't)

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-24 (prd/sync-safety): Found in sync-safety slice 4's hand-off (B-290): the caretook:sign-out-pending marker is finished by resolveUser, which signs out the new session too. Guard the magic-link and invite landings like sign-in.tsx's loader.

### B-738 · bug · Land gate reuses a failing CI verdict from an ancestor when only tooling changed since, so a tooling fix commit is refused on the old failure without a new run

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): Seen 2026-11-24 on hotfix/lane-cap: run 45394082593 failed prompt.test.mjs on f0107a07; the fix 16a1f0ad (scripts/loops/prompt.sh only) was refused on that same run. The carry-over rule (orchestrator.md, The check gate: an ancestor with only docs or tooling changed since) should keep only green verdicts, or request a fresh run when the carried one failed. Workaround: pnpm prd ci run <tier> --ref <branch>.

### B-749 · chore · check-areas: the *.sync.ts writers roundtrip now calls (todos, allergies, conditions, medicationConditions, notes) don't map to roundtrip

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/test-health-2): From test-health-2 slice 5 (B-371, landed 2724ace): sync-writers.mjs calls these through the module hook, so a change to one should run roundtrip.

### B-750 · bug · Second-zone failures past the filing cap: test files that fail in America/New_York beyond the release tier's 10 filings

- status: triaged
- prd: fixes-bug
- owner:
- commit:

- 2026-11-24 (prd/test-health-2): Standing umbrella for release.mjs ZONE_OVERFLOW_ITEM (moved off B-372 by test-health-2 slice 6). Each overflow note lists the extra files; split each into its own fixes-bug item when triaged.

### B-751 · chore · A quarantine entry whose test was renamed or deleted is skipped silently and stays: flag quarantine names that match no test

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/fixes-tooling): Found by fixes-tooling slice 31 (2026-11-24): two providers.browser 'contact details on each row (B-44)' lines under B-568 name tests that no longer exist. A check (in pnpm prd ci or a tooling test) should flag a quarantine name matching no test.

### B-752 · bug · timelineJump.browser.test.tsx can hang a components shard in CI

- status: triaged
- prd: fixes-bug
- owner: prd/fixes-bug
- commit:

- 2026-11-24 (Robert Bo Davis): CI full run 45407562750 (prd/symptom-catalog, cbb5b074): components-2 printed its last line from this file at 13:55:18 (test 3, 'a fresh load of the URL scrolls...'), every other file in the shard finished by 13:58:05, then nothing until the job was cancelled at 14:10. It's the only one of the 187 component test files that never reported. No test timeout fired, so suspect a step that leaves the runner's page: the later tests use Back and history (tests 8-10). The rerun on the same commit (45411480362) passed. Fix the hang, don't rerun past it.
- 2026-11-24 (Robert Bo Davis): Triage: kept in fixes-bug (a CI hang in the timeline jump browser test).
- 2026-11-25 (slice/fixes-bug/68): Slice 68 (fixes-bug): no cause found in the file, no change made. CI log of job 138492364178: each test logs PowerSync's 'Multiple tab support' warning as its database opens; test 3 opened at 13:55:18.21, test 4 never did, so the stop is in test 3 or its afterEach, not the Back/history tests 8-10. Every await in test 3 and in openTimeline/settle/closeDevices is under Vitest's browser-side test or hook timer (15 s / its hook timeout), and the harness routes through createRoutesStub (a memory router), so Back never touches the runner's history and nothing in the file or the timeline screen navigates the frame (no location.* in the screen; entry.client's staleChunk isn't loaded). A timer that never fires means the tab's main thread stopped (a sync or microtask-only loop, or wa-sqlite on the main thread, useWebWorker:false) or the tester frame was lost; Chrome answers Vitest 5's websocket heartbeat from the network stack, so neither is detected. Not reproduced: 8 repeats of the whole file in both zone projects and 15 of test 3 alone all passed. No in-page timeout can catch this; the node-side watchdog of B-753 is what would fail it with its name. Only hang of its kind in the last 200 CI runs (the other two cancelled components runs were cancelled by hand at 6 min).
- 2026-11-25 (prd/fixes-bug): fixes-bug slice 68 (2026-11-25): no fix; the hang is in test 3 or its teardown (not the Back tests), not reproducible (file x8 both zones, test 3 x15). An in-page timeout can't catch a frozen page; wait for B-753's Node-side watchdog to name it if it recurs. Kept open, back to triaged.

### B-753 · bug · CI doesn't name the file a hung shard is stuck on

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): CI full run 45407562750: components-2 hung in timelineJump.browser.test.tsx (B-752) and was cancelled after 20 minutes. The verdict said only 'blame: unknown', and naming the file took a manual diff of every file the shards reported against the full list. Wanted: a hung file fails on its own with its name, either through a per-file watchdog or by having test-job.mjs list the started-but-unfinished files when the job hits its limit, so the verdict blames it and the filer files it like any flake.

### B-754 · bug · backlog.test.mjs beforeAll errors under load (slice checks at load ~30-44)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/fixes-tooling): Seen 2026-11-24 in fixes-tooling slice 32 and 33 quick checks (14:31Z, 5-min load 43-44, .loops/.check-times.log), beside tidy-cli's beforeAll (B-461). Error text not kept. Likely the same kind as B-461 (a slow fixture setup); measure and cut it. Not in wave 5.

### B-755 · change · Series visits are written one at a time (writeVisits), ~1.7 s for 39 visits under load

- status: triaged
- prd: fixes-perf
- owner:
- commit:

- 2026-11-24 (prd/fixes-tooling): Found by fixes-tooling slice 40 (B-500), 2026-11-24: appointmentSeriesService.ts writeVisits writes each visit's entry, document and links in turn; creating a series on the server without toppedUpThrough pays it too. Batching would speed the product and appointmentSeries.int.test.ts.

### B-757 · chore · Slice check runs a slice's own component files only in Los Angeles: add web:components:ny for files in its include list

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/test-health-2): From test-health-2 slice 6: scripts/loops/check-body.sh passes only --project web:components, so a slice touching timeline/medications/planner tests never sees New York until CI.

### B-759 · feature · Install-the-app tip on mobile browsers: a step in onboarding, then a dismissable tip at sign-in until installed or 'never show again'

- status: triaged
- prd: onboarding-2
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): From the user (2026-11-24). Show only in a mobile browser that isn't already running the installed app (display-mode: standalone / navigator.standalone). (1) Onboarding: when the setup flow runs on a mobile device, one step explains installing Caretook to the home screen. (2) Sign-in: each time the user signs in from a mobile browser that isn't the installed app, a dismissable tip. Dismiss means it comes back at the next sign-in; 'Never show me again' stops it for good (store it per user, e.g. in user preferences, so it holds across devices). Android: the button triggers the browser's install prompt (beforeinstallprompt). iOS can't be triggered: show the Share, Add to Home Screen steps. Why: the app is already installable (B-360: site.webmanifest, standalone, service worker) but nothing tells people; installing also protects the offline copy from iOS clearing storage of sites unused for about a week. Toast/tip may use B-669 the shared toast system.

### B-760 · feature · Connector: add_provider, so a member's own AI can add a provider (name, specialty or practice, phone, address)

- status: triaged
- prd: connectors-3
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): From the user (2026-11-24). Today the connector only lists providers (list_providers). Same fields and checks as the Add provider sheet; writer roles only; preview wording shared with quick entry like the other write tools. Small: provider fields are simple.

### B-761 · feature · Connector: add_medication, so a member's own AI can add a medication with its type and schedule

- status: triaged
- prd: connectors-3
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): From the user (2026-11-24). Today the connector only lists medications (list_medications). Heavier than add_provider: type is required, a scheduled one needs times and a round (pass); the AI can ask the member for them, but the server validates through the same medication schemas and service as the Add medication sheet (medicationCreateZSchema). Writer roles only (no Easy helper). Consider prescriber/pharmacy by existing provider.

### B-764 · change · App first load is way too long.

- status: triaged
- prd: fixes-perf
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): From the inbox: We need to either speed it up or make the loading message more friendly with a progress bar.
- 2026-11-24 (Robert Bo Davis): Triage: measure the first load (bundle, first sync) before fixing; may grow into its own topic.

### B-766 · bug · pnpm prd help prints 'design: command not found': backticks in prd.sh's unquoted help heredoc run as commands

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/fixes-tooling): Seen after slice 44 (B-598) in wave 6: scripts/loops/prd.sh line 17. Quote the heredoc delimiter or escape the backticks.

### B-767 · bug · A backlog amend repeats the Backlog-Tool trailer in the commit message

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/fixes-tooling): Seen in slice 46 (B-464) of wave 6: amending a pnpm backlog commit appends a second Backlog-Tool trailer instead of keeping one.

### B-768 · bug · slice-fields.mjs warns on a slice fields line that carries Blocked by

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/fixes-tooling): Seen in wave 6 (slice-brief work, B-595): a valid 'Blocked by' on a slice's fields line draws a warning; it should be a known field.

### B-769 · bug · CI flake: apps/web/app/routes/app/groups/new/newGroup.browser.test.tsx: the New care group sheet the group menu's New c…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): [ci-key 02b5c8552f3e] Flaked (passed on its rerun); found by prd/symptom-catalog.

### B-772 · chore · Lighten the components tier: trim the New York zone run and slow component tests

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): 2026-11-24, follow-up to hotfix/components-shard-3 (third shard). Since test-health-2 (B-372) web:components:ny reruns 53 timeline/medications/planner files in every components run: shards went 471/474s -> 704/877s. Options: narrow NY_INCLUDE to the zone-sensitive files every run and leave the rest to the release tier's zone-components jobs; profile the slowest component files (timeline, planner) for shared world setup or waits. Keep the second zone's daily value for its screens.
- 2026-11-25 (Robert Bo Davis): 2026-11-25: components-2 now runs 10-12 min (others 6-9). Two causes: (1) Vitest shards by file count, so shard 2 holds most of the 30-60 s timeline/planner browser files, in both zones; (2) runner speed varies ~30% (fixes-bug cb856531 vs 1752fb85: same 92 files, 733 s vs 551 s, every file slower evenly). Add, on the user's word: a custom Vitest sequencer whose shard() balances files by past durations from the ci-results/components-*.json CI already writes (fallback: by count). Together with narrowing NY_INCLUDE this should put each shard near 6-7 min.

### B-776 · bug · CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the header the tabs carry what each reads: U…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): [ci-key e2d38cbde9e2] Flaked (passed on its rerun); found by prd/symptom-catalog.

### B-778 · bug · CI flake: packages/data/src/services/accountAdmin.int.test.ts: accountAdminService.setRole makes an account support, ad…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): [ci-key 31dfbabdc436] Flaked (passed on its rerun); found by prd/fixes-ui.

### B-779 · bug · Timeline: a direct ?day= load with no entries today lands the day's heading about 160px below the top

- status: staging
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 9f675672

- 2026-11-24 (prd/fixes-ui): From fixes-ui slice 47 (b154ba6f, B-736): in a test world with no entries for today, a direct ?day= load ends with the heading ~160px down instead of under 40px; something above the list (likely the setup or Today card) grows after the landing scroll. With today's entries it lands correctly. Proposed by the fixes-ui orchestrator, for user review.
- 2026-11-25 (slice/fixes-bug/69): Fixed in slice/fixes-bug/69 (6bf0cecd): the late card was InviteSomeoneCard (no other member in the world), not today's entries; the landing now holds its target by measurement (ResizeObserver) until the reader scrolls/taps/types.

### B-780 · change · CI warns when a branch's quarantine or brake list trails dev's (follow-up of B-771 sync brings dev's CI lists)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): Left out of hotfix sync-shared (PR #162) on the user's word; filed at landing 2026-11-24

### B-781 · chore · Count check budget and silence stops apart in pnpm prd check --times and pnpm prd metrics

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/worker-watch): From worker-watch slice 2 (5310ab85): check-run.sh logs a 16th field (budget|silence) and exits 124 on a breach; --times and metrics still count these as plain failures. Proposed by the worker-watch orchestrator; user reviews.

### B-782 · bug · CI flake: packages/api/src/admin/usersAdmin.int.test.ts: admin.users.get shows the account, its sessions, groups and ma…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): [ci-key 81e93b941241] Flaked (passed on its rerun); found by prd/fixes-ui.

### B-785 · bug · CI flake: apps/web/app/routes/app/groups/timeline/timelineJumpPaging.browser.test.tsx: scrolling newer from a day Back …

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): [ci-key 6f358488771f] Flaked (passed on its rerun); found by prd/fixes-ui.
- 2026-11-24 (prd/fixes-ui): Flaked (passed on its rerun); found by prd/fixes-ui.

### B-787 · bug · Service worker install is all-or-nothing over ~530 files (addAll): one failed fetch on a flaky mobile network leaves the device with no offline worker until the next try

- status: staging
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 9f675672

- 2026-11-24 (prd/fixes-ui): Found in fixes-ui slice 59 (B-777). Consider caching in batches or retrying failed entries.

### B-789 · change · A landing journal (even one whose pid is dead) holds a session's resume after a usage limit with only a waits line each tick; file one report so the user runs pnpm prd land --resume

- status: triaged
- prd: self-recovery-2
- owner:
- commit:

- 2026-11-24 (prd/self-recovery): From self-recovery slice 6 hand-off (resume.mjs waits on any landing journal for the branch).

### B-790 · bug · CI flake: apps/web/app/routes/app/groups/timeline/timelineScroll.browser.test.tsx: infinite scroll three pages down, an…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): [ci-key 43621eb66fd1] Flaked (passed on its rerun); found by prd/fixes-ui.

### B-791 · bug · CI flake: apps/web/app/routes/app/groups/profile/emergency.browser.test.tsx: the owner's sheet builds the list: a membe…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): [ci-key c4d6cc19d31a] Flaked (passed on its rerun); found by 65529f69 in https://github.com/caretook/caretook.com/actions/runs/45501768335.
- 2026-11-24 (prd/fixes-ui): fixes-ui orchestrator 2026-11-24: in quarantine it passed on CI run 45539558339 (14363355) and failed on 45542165290 (b951e50b), both after fixes-ui slice 71 (B-801) renamed EmergencyForm's labels (an outside contact's Name and Phone now required, label text 'Name*'). Check the failure isn't that rename before calling it the old flake.

### B-792 · bug · Connectors: todays_doses doesn't return a med time's id, so a member's AI can't find the passId give_pass needs

- status: staging
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 9f675672

- 2026-11-24 (prd/fixes-ui): Found in fixes-ui slice 65 (B-695): give_pass's description says to use a med time's id from today's doses, but each todays_doses passes entry (name, time, at, state, slots) has no id.

### B-794 · plan · Risa: a central agent that gathers from several repos and prioritises across them

- status: triaged
- prd: risa-next
- owner:
- commit:

- 2026-11-24 (plan/orchestration-split): Filed 2026-11-24 from the orchestration-split planning: after the move (plans/orchestration-split-move.md). How Risa reads each configured repo's backlog and registry and orders work across projects; where tool state lives (today each repo's .loops/).
- 2026-11-25 (Robert Bo Davis): Decided by the user 2026-11-25: each project's plans stay in its own repo; Risa keeps its own plans plus the lighter cross-project prioritization plans in Risa's repo.

### B-795 · chore · Clean Caretook's history of the orchestration tooling and its bloat

- status: triaged
- prd: risa-next
- owner:
- commit:

- 2026-11-24 (plan/orchestration-split): Filed 2026-11-24 from the orchestration-split planning: after the move (plans/orchestration-split-move.md). Rewrites a public repo's history and force-pushes dev, staging and main: only on the user's word, after Risa holds the history (git filter-repo).

### B-796 · chore · Risa: split the project config into a folder and tidy the test rules and gates

- status: triaged
- prd: risa-next
- owner:
- commit:

- 2026-11-24 (plan/orchestration-split): Filed 2026-11-24 from the orchestration-split planning: after the move (plans/orchestration-split-move.md). The user: the config may become a folder of files; the test rules and gates (tiers, brake list, quarantine, check plan) move cleanly after the split.

### B-797 · plan · Risa: prove it on a second repo with tests, then make it usable by others

- status: triaged
- prd: risa-next
- owner:
- commit:

- 2026-11-24 (plan/orchestration-split): Filed 2026-11-24 from the orchestration-split planning: after the move (plans/orchestration-split-move.md). Second project first (Stencil is a poor fit); then release: install, docs, versioning, other hosts than macOS and iTerm2.

### B-798 · change · Build Intl date formatters once per zone in dayLabel (@caretook/data/schema) and medicationDisplay.ts:144, as B-793 did for the timeline

- status: triaged
- prd: fixes-perf
- owner:
- commit:

- 2026-11-24 (prd/fixes-ui): From fixes-ui slice 69 (B-793): both still build a formatter per call; minor in the profile, same pattern.

### B-799 · change · Include captain name and backlog agent name so other agents can find it.

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-24 (prd/fixes-ui): From the inbox: The backlog agents are named after Star Trek captains for the user, but not their internal names, so other agents can't find them by captain name.

### B-802 · bug · CI flake: invites.spec.mjs '3. reset a password by email › the new password signs in' failed once, passed on rerun

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): Filed 2026-11-24 by the backlog session on the user's word. Candidate rc/20261125-0251 (abb7965d, from dev e7798575), CI run 45535937950 (PR #178): browser verdict flake; invites.spec.mjs:477 expect(...).toBe(...) failed, then passed on the job's one rerun. The candidate was promoted (staging 534f96af). Not reproduced; check whether it's a read-before-render race (fix it, don't rerun).

### B-805 · question · Can the PWA sync in the background after offline work, or does the user have to open it to sync?

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): Likely answer: iOS installed PWAs have no Background Sync (WebKit), so pending uploads wait until the app is opened. Chrome/Android has the Background Sync API, but PowerSync's upload queue runs in the page, so today it waits too. Options: sync on open/focus (now), a service-worker sync on Android only, or native (Capacitor) background tasks later.

### B-807 · bug · CI: scripts/loops/fixes-plans.test.mjs: fix topics fixes-ui has a plan with a parsing Status table fails on dev

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (prd/planner-3): [ci-key 8f5760aaa54d] Fails on dev too; found by prd/planner-3 in https://github.com/caretook/caretook.com/actions/runs/45553217886.
- 2026-11-25 (Robert Bo Davis): Fails on dev too; found by prd/planner-3 in https://github.com/caretook/caretook.com/actions/runs/45558728409.
- 2026-11-25 (Robert Bo Davis): Symptom fixed on dev in a563f62f (empty Status table restored). Left open for the cause: fixes-ui's idle hand-over (92177808) dropped the Slice | Item | State | Merge header; make the hand-over or pnpm prd status-trim keep it, or let the test accept an idle plan. Moved from fixes-bug: it is tooling.

### B-808 · bug · Browser check ui.spec: the add sheet's surface can measure 0 by 0 under load

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (prd/planner-3): planner-3's lean browser suite (2026-11-25, load ~10 on 10 cores): ui.spec.mjs:83, '420 dark › add sheet: the full screen', the Symptom add sheet's surface measured width 0, height 0. Passed alone on a rerun (6s), same tip. Looks like a read-before-render race: the evaluate walks up to the first element with a background and measures it once its animations finish, without waiting for a non-zero box. Fix the wait (e.g. expect.poll on the box), not a retry. No planner-3 file touches the add sheet or ui.spec.
- 2026-11-25 (prd/fixes-ui): Seen again 2026-11-25 in fixes-ui wave 13's lean suite (420 dark, add sheet measured 0 by 0; load 14-22); the wave didn't touch the add sheet.

### B-809 · bug · The dispatcher keeps running the code it started with: started 2026-11-24 08:07, before the usage drain landed (B-407, 17:55), it started fixes-bug and a todo-subtasks planner at 85% weekly usage while dispatch --dry-run said draining

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): Restart or re-exec the dispatcher when scripts/loops/ changes on dev (or check its code hash each tick and say so in pnpm prd status).

### B-810 · bug · pnpm prd end <name> ends the pid in the session record, not the live session: ending prd-planner-3 killed pid 46403 while the dispatcher-reopened session (pid 77478, session.sh pid 76171) kept running

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): Found 2026-11-25. A reopen should rewrite the record's pid, and end should check that the pid it kills is the session named.

### B-811 · change · Automatic cleanup finishes a landed PRD left half-done: worktree and slot still held, registry not done, an idle orchestrator session with nothing to do, a branch with only post-landing docs commits

- status: triaged
- prd: self-recovery-2
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): From the planner-3 incident 2026-11-25 (B-431). Detect it in tidy or the watchdog and, unattended: land or fold the docs-only tail, rm the worktree, set done, end its sessions, report. Planner-3's sessions said 'removing worktree and ending' several times without doing it; find out why from their transcripts.
- 2026-11-25 (Robert Bo Davis): Causes so far: B-431 (a post-landing docs commit stops rm from setting done), the new rm-deletes-own-cwd bug, B-810 (end kills a stale pid). Cleanup should also spot several sessions of one topic (planner-3-35, -88 and others were live at once).

### B-812 · bug · An orchestrator's finishing step runs pnpm prd rm from inside its own worktree, so the next step (cd to the main checkout && pnpm prd end) never runs: the harness refuses a command whose cwd was deleted, and the session stays open

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): Found 2026-11-25 (planner-3-35's transcript, B-431 incident). Have rm print the cd, or have rm end the calling session itself when it is the topic's orchestrator; docs/agents/orchestrator.md's last-landing order needs the same fix.

### B-813 · feature · Per-task usage override: a topic the user names may start or plan between the drain line (95%) and the 98% stop, e.g. pnpm prd dispatch --allow <topic>; everything still ends at the stop

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User 2026-11-25: drain default raised 85→95 on dev; wants an override for chosen tasks in the 95–98% window. Today only CARETOOK_USAGE_WATCH=off passes the drain, and it turns the whole watch off. Read per tick like .loops/.prd-cap, so no restart (see B-809).

### B-814 · feature · Orchestrator picks the usage drain line from the current Claude plan (e.g. ultra vs smaller plans) instead of one fixed percent

- status: triaged
- prd: usage-aware-drain
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User 2026-11-25: on hold; for a future iteration after the orchestrator split (Risa). Today's line is a fixed 95% (CARETOOK_USAGE_DRAIN) whatever the plan.

### B-815 · change · Orchestrator summary for backlog handoff should include the ability to pass on directives from the…

- status: triaged
- prd: risa-next
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): From the inbox: Orchestrator summary for backlog handoff should include the ability to pass on directives from the user more clearly and directly.
- 2026-11-25 (Robert Bo Davis): Triage: risa-next, orchestration tooling (hand-off briefs, the PRD queue) that the split moves into Risa.

### B-816 · question · Should the orchestrator PRDQ be slice-based instead of PRD-based?

- status: triaged
- prd: risa-next
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): Triage: risa-next, orchestration tooling (hand-off briefs, the PRD queue) that the split moves into Risa.

### B-817 · bug · Mobile bottom nav renders dark in light mode

- status: landed
- prd: fixes-ui
- owner: prd/fixes-ui
- commit: ee6117ca

- 2026-11-25 (Robert Bo Davis): User report 2026-11-25. Bottom-nav siblings already shipped: B-763 (floats too high on iOS PWA), B-664 (rides up with keyboard). Triage: fixes-ui, a theme/look fix.
- 2026-11-25 (Robert Bo Davis): The user's call (2026-11-25): a light, slightly translucent bar matching the page in light mode; dark mode unchanged. Today's near-black light-mode surface is deliberate (--tab-bar-surface in apps/web/app/app.css). Idea, not scheduled (decide later): sit the bar about 0.75rem into the iPhone bottom safe area (calc(var(--tab-bar-inset) - 0.75rem), ~22px from the edge vs ~38px now, after B-763); other phones unchanged. Tradeoff: Apple asks controls to stay out of the home-indicator strip.
- 2026-11-25 (Robert Bo Davis): Also (the user, 2026-11-25): the bar's glass isn't transparent enough in dark mode. Today --tab-bar-glass mixes the surface at 85% in both themes (app.css); lower it in dark (text keeps 4.5:1 over busy content).
- 2026-11-25 (Robert Bo Davis): Wanted before the user's live alpha-tester call on 2026-11-26 (backlog session, 2026-11-25), with B-342 in fixes-bug. Starts only if the user opens a lane; fixes-ui stays on hold until then.
- 2026-11-25 (Robert Bo Davis): Pre-call run 2026-11-25 (the user's choice): one fixes-ui wave of only B-342, B-817, B-828; B-342 moved from fixes-bug for it. Must land and remove its worktree before orchestration-split wave 6 lands (about 2 to 2.5 h).

### B-818 · bug · watchdog.test.mjs 'reads the limit as the drain does' fails when the shell has CARETOOK_USAGE_WATCH=off: it passes process.env to readDrain (expected 'normal' to be 'limited')

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): From orchestration-split slice 1 (2026-11-25): agent shells inherit CARETOOK_USAGE_WATCH=off from the orchestrator session, so the slice check failed twice on this test until the variable was unset. The test should clear the variable (or pass its own env).

### B-819 · change · Picking a care group on the no-group page gives no feedback while the group loads, and the buttons can be tapped again: show a loading state at once (a loading page, or disable the buttons and show loading in the one tapped)

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User report 2026-11-25: the first load after picking can be slow and feels like nothing happens. Either option is fine with them: a loading page right away, or block re-taps and show a loading message in the tapped button. Triage: fixes-ui, flow feedback; no data change.

### B-820 · feature · Risa: cross-repo topics: a Risa topic can change a configured subproject's code (Caretook), each side passing its own repo's checks

- status: triaged
- prd: risa-next
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User, 2026-11-25 (backlog session): a Risa topic opens a worktree in Risa and in each subproject it touches; each runs its own risa.json checks, and the topic lands only when all pass. Risa lands and releases first, then the subproject lands with its expected Risa version bumped. One direction only: a subproject topic that needs a Risa change files a Risa item. Stage 1 keeps the door open (per-repo worktree and lease names) and adds no slices.
- 2026-11-25 (Robert Bo Davis): Orchestrator check (2026-11-25): stage 1 doesn't block this; its slice 3 puts repo and .loops lookup in one lib.sh function. Still for this item's design: (1) leases sit in each repo's .loops/, so two repos each allow 2 checks and 2 browsers, and only the load gate is machine-wide; (2) topic and session names are unique per repo, not across repos.

### B-821 · change · Risa's lookup reads a moved B-n as RISA-n (a former-prefix key in the config): the PRD decision has no builder yet

- status: in-progress
- prd: orchestration-split
- owner: prd/orchestration-split
- commit:

- 2026-11-25 (prd/orchestration-split): Wave 2 Fable skeptic: normalize('B-772') under prefix RISA says no item; backlog.test.mjs asserts B-2 is note text under RISA. Additive; needs an owner before the move (runbook step 3).

### B-822 · chore · Backlog id prefix leftovers from slice 2: the look-alike sort's id.slice(2), the item type vs idPrefix, and a raw stack when risa.json is broken

- status: in-progress
- prd: orchestration-split
- owner: prd/orchestration-split
- commit:

- 2026-11-25 (prd/orchestration-split): Wave 2 Fable skeptic: format.mjs:486 Number(a.id.slice(2)) is NaN for RISA- (use IDS.num); config.mjs:62 item type [A-Z]+-\d+ rejects a digit prefix idPrefix allows and isn't checked against idPrefix; format.mjs:19 throws a Node stack at import, not a backlog: line. None change B- today.

### B-823 · chore · Branch prefixes from the config are honoured only in lib.sh: ready.sh, rm.sh and others still hardcode prd/, and is_protected has no caller

- status: in-progress
- prd: orchestration-split
- owner: prd/orchestration-split
- commit:

- 2026-11-25 (prd/orchestration-split): Wave 2 Fable skeptic: a changed prefix would split behaviour, so slice 4's sample project can't vary it. Slice 3 owns ready.sh; rm.sh and the rest have no slice yet.
- 2026-11-25 (prd/orchestration-split): Wave 3: slice 3 takes the prefixes in the six files it owns (lib.sh, prd.sh, unsynced.sh, land.sh, new.sh, ready.sh); rm.sh and the rest stay open.

### B-824 · bug · CI flake: scripts/loops/lease.test.mjs: pnpm prd check's check lease makes the runs beyond the default limit of two wai…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): [ci-key 5f15601fb275] Flaked (passed on its rerun); found by prd/orchestration-split.

### B-825 · chore · doc-budget.mjs in scripts/project keeps its own copy of the registry table header: a column added by the core makes warn mode print 'plan status: skipped', and no test ties the two

- status: triaged
- prd: orchestration-split
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): Wave 3 Fable skeptic (2026-11-25), not a blocker. scripts/project/doc-budget.mjs:102.

### B-826 · chore · run_project in lib.sh evals a config command in the caller's shell: a command with cd or exit would change new.sh; run it in a subshell

- status: triaged
- prd: orchestration-split
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): Wave 3 Fable skeptic (2026-11-25), not a blocker. lib.sh:70-75; today's values are harmless.

### B-827 · chore · No slice owns two leftovers of the split's seams: fixes-plans.test.mjs imports the core's status-trim.mjs (pnpm test:project fails without the core), and the 'what to try' text and migration, seed and powersync notes in land.sh and ready.sh are Caretook facts in core files

- status: triaged
- prd: orchestration-split
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): Wave 3 Fable skeptic (2026-11-25), not a blocker. From slices 3 and 9's hand-offs; also the stale comment at scripts/browser-checks/sync-matrix.mjs:11 naming the old sync-matrix test path. Needs a slice before the move.

### B-828 · bug · Switching between submenus and group settings sometimes loads slowly with no feedback

- status: landed
- prd: fixes-ui
- owner: prd/fixes-ui
- commit: ee6117ca

- 2026-11-25 (prd/orchestration-split): From the inbox: It looks like nothing is happening. We need a quick jump with a loader or some other way to show users their click registered.
- 2026-11-25 (Robert Bo Davis): Triage: fixes-ui (flow feedback: show a pending state on navigation). Also worth having before alpha testers.
- 2026-11-25 (Robert Bo Davis): Wanted before the user's live alpha-tester call on 2026-11-26 (backlog session, 2026-11-25), with B-342 in fixes-bug. Starts only if the user opens a lane; fixes-ui stays on hold until then.
- 2026-11-25 (Robert Bo Davis): Pre-call run 2026-11-25 (the user's choice): one fixes-ui wave of only B-342, B-817, B-828; B-342 moved from fixes-bug for it. Must land and remove its worktree before orchestration-split wave 6 lands (about 2 to 2.5 h).

### B-829 · question · Research: compare Care Book to Caring Village

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): From the inbox: Review feature sets and identify overlap, places where we can surpass them, and places where we already do.

### B-830 · bug · Staging's seeded invite link shows 'Couldn't load this link': the Seed and Reset staging Actions seal it without INVITE_LINK_KEY

- status: triaged
- prd: fixes-bug
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User report 2026-11-25 with screenshot: Members page, Invite links, the seeded Viewer link (made by Dev Member) shows 'Couldn't load this link. Reload the page to try again.', Copy and Share disabled. Cause: seed-staging.yml (and reset-staging.yml's seed step) pass only APP_ENV, DATABASE_URL and SEED_USER_PASSWORD, so seeds/invites.ts sealLinkToken uses linkToken.ts's DEV_KEY; the staging server opens with the real INVITE_LINK_KEY, so careGroupInviteService.copyLink returns linkKeyMissing. Fix: pass INVITE_LINK_KEY from the staging environment's secrets to both Actions' seed step, then reseed or reset staging. Consider making the seed refuse to seal with the dev key when APP_ENV is staging, so a missing key fails loudly. Links made by hand on staging are not affected (inferred from code, not checked).

### B-831 · feature · Inactive group scrub: a care group with no member sign-in for X days gets a cycle of reminder emails, then its data is scrubbed automatically

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User request 2026-11-25: a group none of whose members has signed in for the last X days starts a cycle of reminder emails, then an automatic data scrub of that group. Joins the data rights PRD (user's choice); plan after the Sat 2026-11-28 reset. Open for planning: X and the reminder schedule; who is emailed (owners, all members); what counts as activity (sign-in only, or sync and connector use); what a sign-in or reply does to the cycle; what is scrubbed (the group's rows, files, live notes, sync buckets, backups) and whether the group shell or accounts remain; audit trail; the cron (calendars' sweep pattern); staff override; and the promise in the privacy policy (B-358).

### B-832 · chore · Wave 4 skeptic's code follow-ups for the split: unquoted role_doc fallback in five prompts, tier data read at check-plan import, a TypeError on a newline in a file name, the sample repo copying all of scripts/loops

- status: triaged
- prd: orchestration-split
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): Fable skeptic on wave 4 (2026-11-25), none blocking. (1) $(bye_line $(role_doc <role>)) is unquoted at prompts/orchestrator.sh:38, hotfix.sh:16, backlog.sh:59, recover.sh:17, plan.sh:38: shared.sh's fallback 'the <role> role's doc' word-splits, so bye_line prints 'the checks the names under _Bye_'; no test covers the fallback (every role is set today). (2) check-plan.mjs:73 reads risa.json and tiers.json at import: a broken tiers.json fails every importer at load (tooling-lint, gate, ci-gate, dev-brought) with a TierDataError. (3) scripts/ci/tier-data.mjs:150 groupOf throws a TypeError for a file name with a newline, where the old code answered unit. (4) sample-project/repo.mjs:31 copies all of scripts/loops, tests and goldens included, twice per golden test run: time only.

### B-833 · change · Quick entry tips' examples should use the group's own provider and medication

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): Triage: fixes-ui (wording in the quick entry tips: the example names one of the group's own providers, falling back to a fictional one). Say 'event', not 'appointment' (B-537).
- 2026-11-25 (Robert Bo Davis): Widened (the user, 2026-11-25): the medication example too. In quickEntryCopy.ts's QUICK_ENTRY_EXAMPLES, 'appt Dr Lee Friday 2pm' names one of the group's providers and 'gave metformin' one of the group's medications, each falling back to the fictional default when the group has none. The box's accessible description (QUICK_ENTRY_RULES) reads the same lines. Say 'event', not 'appt' (B-537).

### B-834 · chore · Wave 5 skeptic's code follow-ups for the split: the check plan's under() matches a path equal to a folder name (a symlink or gitlink replacing scripts/loops would propose none), prd.sh's check case carries on with an empty mode when check-plan.mjs throws, and a bad tier file fails CI commands with a bare stack

- status: triaged
- prd: orchestration-split
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): From the Fable skeptic on wave 5 (go, 2026-11-25). 1: check-plan.mjs under() should refuse or tier-up an exact match on a folder path (old regexes needed a trailing slash). 2: prd.sh:473 should die when the mode read from check-plan.mjs is empty. 3: PROPOSED_TIERS/tierRank read the tier data at import (check-plan.mjs:357); give the error a clear line (see B-832). Also for the move runbook: re-home scripts/project/check-plan-rules.test.mjs to run through the risa CLI instead of dropping it, and decide in slice 11 whether tooling-tests.mjs throwing on an unset testProjects.tooling is right.

### B-835 · chore · Wave 6 skeptic's follow-ups for the split: land.sh reads any docBudget hook failure as a budget breach and a mistyped hooks key skips the budget silently, no test joins a built release verdict to releasePasses at tier release, the core hardcodes prd fixes-bug in release.mjs and blame.mjs, vitest.config.ts keeps a stale loops/check-body entry and check-plan.mjs:11 a stale comment, check-tooling.mjs passes on an unset testProjects.tooling while tooling-tests.mjs throws

- status: triaged
- prd: orchestration-split
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): From the Fable skeptic on wave 6 (2026-11-25, go) and slices 8 and 11's hand-offs. For the late follow-up slice with B-821 to B-834. Also: the check's body still names core:unit and the !tooling:* exclusions (pnpm test's set, until the move), so the hook contract's 'runs no tooling test of the tool's' is not yet true for Caretook.

### B-836 · feature · Marketing site visual refresh to modern design standards (split from B-417; no screenshots or videos)

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-25 (plan/marketing-2): Split from B-417 when marketing-2 took its copy part (2026-11-25): the visual refresh B-417 also asked for, left for a later marketing topic.

### B-837 · change · Time limit gate for component tests to keep them from growing too long

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): From the inbox: 5 minute goal, 6 minute hard cutoff.
