# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

The PRD registry: **row order is the priority**. Edit it only with `pnpm backlog prd` (`add`, `set`, `move`); `pnpm backlog prd list` shows each topic's state (to-write, planned, running, idle, hold, done), worked out from git and the items. At most three PRD orchestrators run at once.

`Flags`: `hold` (waits on the user), `done`, `standing` (never finishes; runs while it has waiting items), `alone` (nothing else runs beside it). `After`: the topics it comes after. `Hot files`: repo path prefixes it shares.

| PRD | Flags | After | Hot files | Doc and notes |
| --- | ----- | ----- | --------- | ------------- |
| `connectors-3` | done | `planner-3` | `packages/api/src/connectors/tools/`, `packages/api/src/connectors/links`, `packages/api/src/connectors/readTools.int.test.ts`, `packages/api/src/connectors/mcp.int.test.ts`, `packages/api/src/connectors/protocol.test.ts`, `packages/data/src/db/schema/medications/doseRecord`, `packages/data/src/db/schema/medications/dueDoses.ts`, `packages/data/src/db/schema/medications/index.ts`, `packages/data/src/services/assistantActionService.ts`, `packages/data/src/services/medicationService.ts`, `packages/data/src/db/schema/assistant/quickEntryNewItem.ts`, `apps/web/app/components/quick-entry/quickEntryCards.ts` | to write (B-252: a connector tool to read the dosing schedule beyond today; B-253: `add_todo` can make a repeating todo) · Depends on: B-253 after `planner-2` in `dev` (last item B-248); B-252 has none · Hot files: `packages/api/src/connectors/tools/` (`todaysDoses.ts` or a new schedule tool, `writes.ts`), the server instructions |
| `orchestration-split-4` | done | `orchestration-split-3` | `scripts/loops/`, `scripts/ci/`, `scripts/project/project-data.test.mjs`, `vitest.config.ts`, `docs/agents/project-config.md` | Stage 1d of B-543, before the Risa move: the core's tests stand alone in a copy holding only the core files |
| `orchestration-split-3` | done | `orchestration-split-2` | `scripts/loops/`, `scripts/backlog/`, `scripts/ci/`, `scripts/project/`, `scripts/deploy/workflows`, `.githooks/`, `package.json`, `vitest.config.ts`, `.github/workflows/`, `docs/`, `apps/web/test/`, `risa.json` | — |
| `fixes-ui` | standing | — | — | plan: plans/fixes-ui-plan.md, rules: plans/fixes-rules.md |
| `todo-subtasks-2` | done | `todo-subtasks` | `apps/web/app/lib/todos/todoList.ts`, `apps/web/app/lib/todos/plannerTodos.ts`, `apps/web/app/lib/todos/todoStrip.ts`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/timeline/` | — |
| `fixes-nit` | standing | — | — | plan: plans/fixes-nit-plan.md, rules: plans/fixes-rules.md |
| `test-time-gates` | done | `orchestration-split-2` | `scripts/loops/check-`, `scripts/loops/metrics`, `scripts/loops/land.test.mjs`, `scripts/loops/recover.test.mjs`, `scripts/loops/rotate.test.mjs`, `scripts/loops/dispatch.test.mjs`, `scripts/project/check-body`, `scripts/ci/`, `.github/workflows/ci.yml`, `vitest.config.ts`, `risa.json` | to write (B-837): time limit gates for component tests, unit tests and the local quick check (aim 5 min, warn past 5, fail past 6, slowest files on a breach), with B-772 (trim slow component tests), B-781 (check time apart from waits) and B-370 (guards the quick check always runs). Cut from fixes-tooling by the user 2026-11-26 to run first |
| `test-time-gates-2` | hold | `test-time-gates` | `.github/workflows/ci.yml`, `scripts/ci/tiers`, `scripts/ci/component-durations.json`, `scripts/ci/ci.test.mjs`, `scripts/ci/shards.test.mjs`, `scripts/ci/verdict.test.mjs`, `scripts/ci/browser-job.test.mjs`, `scripts/deploy/workflows.test.mjs`, `scripts/loops/time-gate`, `scripts/loops/recover.test`, `scripts/loops/recover-`, `scripts/loops/rotate.test`, `scripts/loops/rotate-` | — |
| `tags` | done | `symptom-catalog` | `packages/data/src/db/schema/tags/`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/tags/`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/routes/app/groups/timeline/FilterSheet.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/providers/`, `apps/web/app/routes/app/groups/medications/`, `apps/web/app/routes/app/groups/search/`, `scripts/browser-checks/sync-matrix.mjs` | to write (B-548): group-wide tags on every record, filterable on each list and in search; adds a migration |
| `todo-subtasks` | done | `planner-3`, `tags` | `packages/data/src/db/schema/todos/`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `packages/api/src/connectors/tools/listTodos.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/todos/`, `apps/web/app/lib/app-shell/unsavedChanges.ts`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `scripts/browser-checks/sync-matrix.mjs` | **On hold 2026-11-24: planning paused by the user to save credits while away (nothing wrong with the topic).** to write (B-550): nested todos, 3 levels in code, parent auto-completes |
| `tags-2` | done | `todo-subtasks` | `packages/data/src/db/schema/tags/`, `packages/data/src/services/tagService.ts`, `packages/data/src/db/seeds/tags`, `packages/api/src/syncRegistry.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/tags/`, `apps/web/app/components/tags/`, `apps/web/app/components/ui/tagLook`, `apps/web/app/routes/app/groups/entry/EntryPageHeader.tsx`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/edit/`, `apps/web/app/routes/app/groups/provider/`, `apps/web/app/routes/app/groups/providers/edit/`, `apps/web/app/routes/app/groups/medication/MedicationHeader.tsx`, `apps/web/app/routes/app/groups/medications/MedicationTags.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineEntry`, `apps/web/app/routes/app/groups/timeline/edit/` | — |
| `todo-subtasks-3` | done | `todo-subtasks-2` | `packages/data/src/db/schema/todos/`, `packages/data/src/services/todoService.ts`, `packages/data/src/services/calendarFeedService.ts`, `packages/data/src/services/calendarSyncService.ts`, `packages/api/src/connectors/tools/upcoming.ts`, `apps/web/app/lib/todos/`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/planner/` | Subtask rework: nested view on the Todos page and the todo's page, + quick add at any level, due-date rules (B-941, B-942, B-943). Held 2026-11-27: the user approves a summary of its plan before it starts; plan by hand (pnpm prd plan), then release. |
| `todo-links` | — | `todo-subtasks-3` | `apps/web/app/lib/todos/`, `apps/web/app/components/todos/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/entry/EntryTodos.tsx`, `apps/web/app/routes/app/groups/entry/route.tsx`, `apps/web/app/routes/app/groups/provider/route.tsx`, `apps/web/app/routes/app/groups/medication/route.tsx`, `apps/web/app/lib/core/recentlyViewed.ts`, `apps/web/app/lib/auth/forgetUserData.ts`, `apps/web/app/lib/search/search.sync.ts`, `apps/web/app/lib/search/searchTables.sync.ts`, `packages/data/src/db/schema/search/searchDocument.ts` | Todo link picker on site search (one box, type chips and typed type, richer matching, smart empty state) and quick add todos/subtasks from linkable pages; reuses B-942's quick add |
| `fixes-bug` | standing | — | `packages/data/src/services/assistantActionService.ts`, `packages/data/test/` | plan: plans/fixes-bug-plan.md, rules: plans/fixes-rules.md |
| `fixes-tooling` | standing, hold | `test-gates` | — | plan: plans/fixes-tooling-plan.md, rules: plans/fixes-rules.md. **On hold 2026-11-24: paused by the user after wave 6 so UI fixes can run (only one fixes topic at a time).** Its tool items moved to Risa with B-543 (2026-11-27); it keeps Caretook's own tests, flakes and check rules. |
| `fixes-perf` | standing | — | — | plan: plans/fixes-perf-plan.md, rules: plans/fixes-rules.md |
| `sync-safety-2` | hold | `sync-safety` | `packages/data/src/services/medicationService.ts`, `packages/data/src/services/medicationPassService.ts`, `packages/data/src/services/recipientConditionService.ts`, `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/todoService.ts`, `packages/data/src/models/todo`, `packages/data/src/db/schema/medications/medication.ts`, `packages/api/src/syncRegistry.ts`, `apps/web/app/lib/todos/`, `apps/web/app/lib/auth/`, `apps/web/app/routes/sign-in.tsx`, `apps/web/app/lib/sync/index.ts` | planned 2026-11-25 (B-295, B-296, B-383, B-384, B-387, B-730; B-805 answered): change-entry times, repeating-todo races, sign-ins and tabs; held after two skeptic send-backs (the user split B-294 off to sync-safety-3); lift with flags=- once the assumed rows are read |
| `data-rights` | hold | — | `packages/data/src/db/schema/core/scrub`, `packages/data/src/db/migrations/`, `packages/data/src/services/careGroupService`, `packages/data/src/services/careGroupInviteService`, `packages/data/src/services/joinRequestService`, `packages/data/src/services/todoService.ts`, `packages/data/src/db/schema/care-groups/careGroupConsent`, `packages/data/src/db/schema/auth/legalAcceptance`, `packages/data/src/db/schema/admin/adminAudit`, `packages/api/src/care-groups/`, `apps/web/app/lib/providers/`, `apps/web/app/lib/medications/`, `apps/web/app/lib/profiles/`, `apps/web/app/lib/todos/`, `apps/web/app/lib/timeline/entryDisplay`, `apps/web/app/lib/appointments/visitPrep`, `apps/web/app/components/entry/`, `apps/web/app/components/providers/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/periods/`, `apps/web/app/routes/app/groups/provider/`, `apps/web/app/routes/app/groups/medication/`, `apps/web/app/routes/app/groups/profile/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/timeline/pass/`, `apps/web/app/routes/app/groups/settings/details/`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/app-shell.spec.mjs` | plans/data-rights-prd.md; held after two plan send-backs (s49, s51), user chose the carve-out (a243) |
| `data-rights-2` | hold | `data-rights` | — | Follow-on of data-rights: ownership hand-over and account deletion (B-565, B-53's account half; the user answered a239: block a last owner until hand-over or group delete), export, staff tooling, legal text and change notice, inactive-group scrub, retention sweep, Google calendar removal on delete |
| `account-security` | hold | — | `packages/auth/`, `packages/api/src/rateLimit.ts`, `packages/api/src/procedures.ts`, `packages/api/src/connectors/http.ts`, `packages/api/src/calendars/feed.ts`, `packages/api/src/marketing/publicForms.ts`, `packages/data/src/services/careGroupMemberService.ts`, `packages/data/src/services/careGroupInviteService.ts`, `packages/data/src/services/joinRequestService.ts`, `packages/data/src/services/connectorGrantService.ts`, `packages/data/src/services/groupAdminService.ts`, `packages/data/src/services/accountAdminService.ts`, `packages/data/src/services/adminAuditService.ts`, `packages/data/src/db/roles/`, `packages/notifications/`, `scripts/browser-checks/session-end.spec.mjs`, `scripts/browser-checks/roundtrip.spec.mjs` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) · Depends on: `invites` (done); B-80 (the Devices page) first (soft) · Hot files: `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `account-security-2` | hold | `account-security` | `packages/auth/` | — |
| `tags-3` | done | `tags-2` | `apps/web/app/components/tags/`, `apps/web/app/components/todos/TodoRow.tsx`, `apps/web/app/routes/app/groups/planner/UpcomingList.tsx`, `apps/web/app/routes/app/groups/providers/ProviderListItem.tsx`, `apps/web/app/routes/app/groups/medications/MedicationListItem.tsx`, `apps/web/app/components/entry/EntryActions.tsx`, `apps/web/app/lib/care-groups/urls.ts`, `apps/web/app/routes/app/groups/settings/`, `apps/web/app/routes/app/settings/account/AvatarCard.tsx`, `apps/web/app/lib/tags/`, `apps/web/app/lib/search/search.sync.ts`, `apps/web/app/routes/app/groups/search/` | — |
| `symptom-catalog-2` | done | `tags-3` | `packages/data/src/db/schema/timeline/symptomType.ts`, `packages/data/src/models/symptomType/`, `packages/data/src/services/symptomTypeService.ts`, `packages/api/src/timeline/`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/timeline/symptomTypes.sync.ts`, `apps/web/app/lib/timeline/symptomCatalogPage.sync.ts`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/routes/app/groups/settings/`, `apps/web/app/lib/care-groups/urls.ts` | — |
| `symptom-catalog-3` | — | `symptom-catalog-2` | `packages/data/src/db/schema/timeline/symptomCatalog.ts`, `packages/data/src/services/symptomTypeService.ts`, `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `packages/api/src/timeline/`, `apps/web/app/lib/timeline/symptomTypes.sync.ts`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/lib/assistant/quickEntry.sync.ts`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/routes/app/groups/settings/symptoms/` | — |
| `onboarding-2` | hold | — | `apps/web/app/routes/app/groups/setup/`, `apps/web/app/lib/app-shell/groupSetup`, `apps/web/app/lib/app-shell/setupNudges`, `apps/web/app/lib/app-shell/gettingStarted`, `apps/web/app/lib/app-shell/me.ts`, `apps/web/app/routes/app/groups/layout/`, `apps/web/app/components/ui/toastQueue.ts`, `apps/web/app/routes/app/groups/timeline/GettingStartedCard.tsx`, `apps/web/app/routes/app/groups/timeline/WelcomeCard.tsx`, `apps/web/test/device.tsx`, `packages/data/src/db/schema/app-shell/userPreferences.ts`, `packages/data/src/services/userService.ts`, `packages/data/src/db/seeds/setupDismissed`, `packages/api/src/app-shell/me.ts`, `scripts/browser-checks/first-sync.spec.mjs`, `scripts/browser-checks/invites.spec.mjs` | — |
| `push-notifications` | hold | `calendars-2` | `packages/notifications/`, `apps/web/app/lib/app-shell/serviceWorker`, `scripts/build/service-worker`, `apps/web/app/routes/app/groups/settings/calendar/`, `apps/web/app/lib/calendars/`, `apps/web/app/lib/auth/session`, `apps/web/app/lib/sync/client`, `apps/web/app/routes/marketing/privacy/`, `apps/web/app/routes/marketing/health-data-privacy/`, `packages/data/src/db/schema/auth/legalRules`, `packages/data/src/db/schema/calendars/`, `packages/data/src/db/schema/notifications/`, `packages/data/src/services/calendar`, `packages/api/src/calendars/`, `packages/auth/src/authUser`, `ops/runbook.md` | to write (B-377): push notifications for event reminders; cut from calendars-2 to keep it small. Its planner asks about a web-push dependency and the push vendors. Builds on calendars-2 slice 3 (the outbox expiry) |
| `code-health` | — | `check-speed`, `orchestration-2` | `packages/data/src/db/schema/`, `packages/data/src/domain/`, `packages/data/src/services/`, `packages/data/package.json`, `package.json`, `apps/web/package.json`, `apps/web/app/`, `packages/api/src/`, `scripts/loops/lib.sh`, `scripts/loops/lease.sh`, `scripts/loops/land.test.mjs`, `scripts/loops/check-areas.d/`, `scripts/backlog/backlog.mjs`, `scripts/build/` | [PRD](code-health-prd.md), [plan](code-health-plan.md) (B-361, B-365, B-366, B-367): 6 slices, waves (1, 2, 3, 5) → 4 → 6: exact pins and a test refusing ranges, unused exports removed, the backlog lock held once and a knobs page, tests on pr/ready/review/land, pure logic moved to @caretook/data/domain, then every importer switched (slice 6, alone, after simple-mode lands; it touches import lines across apps/web/app and packages/api). No behaviour change, no migration. Follow-ons: code-health-2, code-health-3 |
| `code-health-2` | hold | `code-health`, `simple-mode`, `sync-safety` | `packages/data/src/models/`, `packages/data/src/services/`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `apps/web/app/lib/core/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-362, B-363), cut from code-health by its planner, 2026-11-21: the role table as what simple-mode leaves (canComplete, role checks in the API's invites and join requests, a test refusing role names outside the role module, isUserRoleName and isGroupRoleName removed), the soft-delete model factory, one upsert helper on sync-safety's create-if-absent shape, one invalid, the device side's refuse, invalid, canWrite, formString and shouldRevalidate |
| `code-health-3` | hold | `code-health-2` | `apps/web/app/lib/`, `apps/web/app/libLayout.test.ts`, `packages/data/src/models/base/`, `packages/api/src/sync` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-364, B-368, B-369), cut from code-health by its planner, 2026-11-21: device row types derived from the device schema and the layout guard refusing SQL outside *.sync.ts (17 files today), the list count only on request and the sync PATCH's round trips (that slice after sync-safety-2), plan-pointing comments (a count that may only fall, then a sweep) |
| `contract-migrations` | hold | — | — | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** Contract steps tracked from fixes-nit (B-379): B-455, B-456, B-457. Migrations: run alone in its wave. To write. |
| `i18n` | alone | `simple-mode` | `apps/web/app/components/`, `apps/web/app/lib/core/format.ts`, `packages/data/`, `apps/web/app/root.tsx`, `packages/notifications/`, `pnpm-workspace.yaml`, `scripts/build/budget.json` | [PRD](i18n-prd.md), [plan](i18n-plan.md): 11 slices, waves 1 → 2 → (3, 4, 5, 6) → (7, 8, 9, 10) → 11: a per-user language (English and Spanish, AI-drafted, review before launch) in `user.preferences` with a cookie for server rendering; typed catalogs on `i18next` and `react-i18next`; format helpers, error codes and label maps take the language; the app swept area by area; emails, the invite's language, calendar text and the public site at `/es/`; a lint rule against literal text (`eslint-plugin-i18next`, dev). Quick entry is a plain box for non-English users; search matching, the connector and `/admin` stay English (B-209). Slice 8 adds a migration (one nullable invite column); three dependencies approved 2026-11-21; slice 1 needs a stack. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248), the current `quick-fixes` wave and `simple-mode` (last items B-221, B-400) in `dev`; **runs alone** (tooling-only work beside it) · Hot files: every user-facing string: all `/app`, sign-in and marketing routes, `components/`, `lib/core/format.ts` and the other format helpers, the label maps in `packages/data` schema, `userPreferences.ts`, `root.tsx`, the service worker, `packages/notifications` templates and registry, the invite schema and service, `calendarText.ts`, ESLint config, `pnpm-workspace.yaml`, `scripts/build/budget.json` |
| `marketing-2` | done | — | `apps/web/app/routes/marketing/`, `apps/web/public/og-default.png` | Light copy wave before sharing the link (B-417) |
| `planner-3` | done | `simple-mode` | `packages/data/src/db/schema/todos/`, `packages/data/src/db/schema/assistant/`, `packages/data/src/permissions/todos.ts`, `packages/data/src/services/entryTodoService.ts`, `packages/data/src/services/todoService.ts`, `packages/api/src/syncRegistry.ts`, `packages/api/src/connectors/tools/listTodos.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/todos/`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/lib/appointments/`, `apps/web/app/lib/assistant/quickEntry.sync.ts`, `apps/web/app/components/todos/`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `scripts/browser-checks/sync-matrix.mjs` | Replanned 2026-11-23: entries and todos many to many (B-245) and quick entry repeats (B-254). |
| `inbox-agent` | done | `orchestration-3` | `scripts/backlog/`, `scripts/loops/lib.sh`, `scripts/loops/prd.sh`, `scripts/loops/prompt.sh`, `scripts/loops/tidy`, `scripts/loops/queue`, `scripts/loops/session.sh`, `scripts/loops/sessions.mjs`, `scripts/loops/rotate`, `scripts/loops/bye`, `scripts/loops/dispatch`, `scripts/loops/session`, `scripts/loops/keep-alive`, `scripts/loops/open-session` | Replanned 2026-11-23 (16d3b807): inbox agent on fast Opus, origin/dev writes, duplicate checks, auto archive, always-on session, bye for every role (B-425, B-435, B-474, B-515, B-551). Next up (B-406) dropped; priority stays with the backlog session. |
| `test-gates` | done | — | `.github/workflows/`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `vitest.config.ts`, `scripts/loops/land`, `scripts/loops/check-plan`, `scripts/loops/lib.sh`, `scripts/loops/dispatch`, `scripts/loops/prd.sh`, `scripts/loops/status-extra`, `scripts/backlog/registry` | CI test tiers 0-2, dev red, quarantine, rapid gate, modes (plans/test-gates-prd.md) |
| `agent-autonomy` | done | `test-gates` | `scripts/loops/land`, `scripts/loops/lib.sh`, `scripts/loops/check-`, `scripts/loops/prompt.sh`, `scripts/loops/prd.sh` | [PRD](agent-autonomy-prd.md), [plan](agent-autonomy-plan.md) (B-503 to B-506, B-516 to B-518): 10 slices, waves (1, 2) → 3 → (4, 5) → 6 → 7 → (8, 9, 10): questions that take their recommendation after 30 minutes (planners' too), a notice board, a machine claim for a landing's full check, the flake rule, flakes filed by the check, a Checked: trailer and a full pass that carries over a dev sync, landing on an unsynced tip, landing notices and the hold. Tooling only. Follow-on: agent-autonomy-2. While test-health runs (its word, 2026-11-22): land no change to what quick or full means (check-plan.mjs, lib.sh checked_ok) or what land accepts in the middle of a test-health landing, only between its waves; never touch scripts/eslint/ or eslint.config.js. |
| `agent-autonomy-2` | done | — | `scripts/loops/session`, `scripts/loops/context`, `scripts/loops/prompt.sh`, `scripts/loops/rotate`, `scripts/loops/open-session`, `scripts/loops/recover`, `scripts/loops/tidy`, `scripts/loops/end-session`, `scripts/loops/request` | [PRD](agent-autonomy-2-prd.md), [plan](agent-autonomy-2-plan.md) (B-507, B-508, B-509): 2 slices in 2 waves: a context hook that tells a session past 160k to rotate, sizes in status, the dispatcher's follow-up. Cut from agent-autonomy by its planner. Tooling only |
| `test-gates-2` | done | `test-gates` | `.github/workflows/ci.yml`, `.github/actions/`, `scripts/ci/`, `scripts/deploy/workflows`, `scripts/loops/browser.sh`, `scripts/loops/serve.sh`, `scripts/loops/check-plan`, `scripts/loops/check-areas.d/`, `scripts/loops/prd.sh`, `vitest.config.ts`, `ops/runbook.md` | CI tiers 3-4: staging candidate, CI browser suites, staging to main gate, required checks (plans/test-gates-prd.md) |
| `test-health-2` | done | `test-gates`, `test-gates-2`, `sync-safety` | `apps/web/app/lib/sync/uploader`, `apps/web/test/fixtures.ts`, `apps/web/test/database.ts`, `apps/web/app/lib/sync/index.ts`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/sync-matrix.mjs`, `scripts/loops/sync-matrix.test.mjs`, `packages/api/src/router.int.test.ts`, `vitest.config.ts` | Test coverage follow-ups: device-to-server round trip per table, a second time zone, role gaps, an uploadData error test (B-371, B-372, B-373, B-374) |
| `worker-watch` | done | `test-gates`, `agent-autonomy-2`, `agent-autonomy-3` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/check-times`, `scripts/loops/check-run`, `scripts/loops/check-body`, `scripts/loops/land.sh`, `scripts/loops/review.sh`, `scripts/loops/browser.sh`, `scripts/loops/new.sh`, `scripts/loops/rm.sh`, `scripts/loops/status-extra`, `scripts/loops/dispatch`, `scripts/loops/context`, `scripts/loops/skeptic`, `scripts/loops/ask` | To write. Run metrics in one summary, then stuck workers handled against usual times (B-434, B-408). Cut from orchestration-3 |
| `agent-autonomy-3` | done | `agent-autonomy`, `agent-autonomy-2` | `scripts/loops/ask`, `scripts/loops/skeptic`, `scripts/loops/prompt.sh`, `scripts/loops/land`, `scripts/loops/prd.sh`, `scripts/loops/dispatch`, `scripts/loops/open-session`, `scripts/backlog/registry` | To write. A Fable skeptic before every ask, before risky landings (a forced landing, a flaky pass, a declined Codex finding), and as the final check on Opus planners, with a registry flag that keeps a design topic's planner on Fable (B-511, B-512, B-513). Filed into agent-autonomy after its plan landed; builds on its defaulting asks and flake rule |
| `self-recovery` | done | `test-gates`, `agent-autonomy`, `agent-autonomy-2` | `scripts/loops/recover`, `scripts/loops/land.sh`, `scripts/loops/lib.sh`, `scripts/loops/session`, `scripts/loops/open-session`, `scripts/loops/dispatch`, `scripts/loops/prd.sh`, `scripts/loops/inventory`, `scripts/loops/down.sh`, `scripts/loops/new.sh`, `scripts/loops/status-extra`, `scripts/loops/prompt.sh` | To write. launchd recovery, draining before a usage limit, step-in-progress markers, cost records, records for every session kind, headless sessions (B-407, B-433, B-437, B-438). Cut from orchestration-3; its planner cuts headless out if over six slices |
| `ui-kit-3` | done | `ui-kit-2` | `apps/web/app/app.css`, `apps/web/app/components/ui/`, `apps/web/app/routes/dev/ui/`, `apps/web/app/lib/timeline/entryDisplay.ts`, `apps/web/app/components/entry/KindIcon.tsx`, `apps/web/app/components/quick-entry/QuickEntryCard.tsx`, `apps/web/app/lib/app-shell/` | **On hold 2026-11-21: planning was burning too much Fable usage (nothing wrong with the topic; B-477).** to write (B-398, B-269, B-448 and overlay motion): every remaining area swept onto the kit, one area per slice; then the lint guard. Cut from ui-kit-2 to keep it at six slices; starts after ui-kit-2 so the sweeps copy its final Button, header and motion contracts; before test-health waves 5 to 7; never beside i18n. Hot files when planned: most route and component folders, one area per slice |
| `ui-kit-4` | done | `ui-kit-3` | `eslint.config.js`, `scripts/eslint/`, `apps/web/app/routes/app/groups/medication/`, `apps/web/app/routes/app/groups/medications/`, `apps/web/app/routes/app/groups/provider/`, `apps/web/app/routes/app/groups/providers/`, `apps/web/app/routes/app/groups/profile/`, `apps/web/app/routes/app/groups/period/`, `apps/web/app/routes/app/groups/periods/`, `apps/web/app/routes/app/groups/planner/`, `apps/web/app/routes/app/groups/todo/`, `apps/web/app/routes/app/groups/todos/`, `apps/web/app/routes/app/groups/search/`, `apps/web/app/components/medications/`, `apps/web/app/components/schedule/`, `apps/web/app/components/providers/`, `apps/web/app/components/contact/`, `apps/web/app/components/todos/`, `apps/web/app/components/visitPrep/`, `apps/web/app/components/repeat/` | — |
| `ui-kit-5` | done | `ui-kit-4`, `quick-entry-2` | `scripts/eslint/`, `apps/web/app/components/ui/Menu.tsx`, `apps/web/app/components/ui/FilterMenu.tsx`, `apps/web/app/components/ui/overlayMotion.browser.test.tsx`, `apps/web/app/routes/dev/ui/sections/MenuSection.tsx`, `apps/web/app/routes/dev/mail/`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/routes/app/groups/entry/`, `apps/web/app/routes/app/groups/new/`, `apps/web/app/components/entry/`, `apps/web/app/components/notes/`, `apps/web/app/components/quick-entry/`, `apps/web/app/components/connectors/`, `apps/web/app/routes/admin/`, `apps/web/app/routes/account/`, `apps/web/app/routes/connectors/`, `apps/web/app/routes/marketing/`, `apps/web/app/routes/app/layout/`, `apps/web/app/routes/app/home/` | — |
| `quick-entry-2` | done | — | `packages/data/src/db/schema/assistant/quickEntry`, `apps/web/app/components/quick-entry/`, `apps/web/app/routes/app/groups/timeline/timelineQuickEntry` | to write (B-300 to B-303), from the 2026-11-21 code review: negated doses, typed counts, wrong times, the stuck card · Depends on: `planner-2` in `dev` (it edits quick entry's future note; last item B-248) · Hot files: `db/schema/assistant/quickEntry.ts`, `quickEntryTime.ts`, `components/quick-entry/` |
| `dose-accuracy` | done | — | `packages/data/src/db/schema/medications/dueDoses.ts`, `packages/data/src/db/schema/medications/duePasses.ts`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/medications/dueDoses.sync.ts`, `apps/web/app/lib/appointments/visitPrep`, `packages/data/src/services/timelineEntryService.ts`, `packages/data/src/services/assistantActionService.ts`, `packages/api/src/connectors/tools/todaysDoses.ts` | to write (B-297 to B-299), from the 2026-11-21 code review: a dose answers only its own day's slot, deterministic dose ids, visit prep's missed doses per schedule epoch · Hot files: `db/schema/medications/dueDoses.ts`, `medications.sync.ts` (`logDoses`), `visitPrep.ts` |
| `symptom-catalog` | done | `quick-entry-2`, `dose-accuracy` | `packages/data/src/db/schema/timeline/`, `packages/data/src/services/timelineEntryService.ts`, `packages/api/src/syncRegistry.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/routes/app/groups/timeline/SymptomFields.tsx`, `apps/web/app/routes/app/groups/timeline/FeelingFields.tsx`, `apps/web/app/routes/app/groups/timeline/FilterSheet.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/daySummary`, `apps/web/app/lib/appointments/visitPrep`, `apps/web/app/lib/assistant/quickEntryPredictions`, `apps/web/app/components/quick-entry/` | to write (B-549): symptoms as a catalog type with a default set, quick add with a similar-name check, a multi-symptom filter; adds a migration |
| `onboarding` | done | — | `apps/web/app/routes/account/join/`, `apps/web/app/routes/account/invite/`, `packages/auth/src/tickets.ts`, `packages/api/src/care-groups/`, `packages/data/src/services/careGroupInviteService.ts`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/root.tsx`, `apps/web/public/site.webmanifest`, `apps/web/app/routes/marketing/layout/`, `packages/data/src/db/schema/app-shell/userPreferences.ts`, `apps/web/app/lib/app-shell/me.ts`, `scripts/browser-checks/invites.spec.mjs` | to write (B-31): guided onboarding for new users, the real requirement; a demo group is one idea to refine; may point at the connect guide · Depends on: invites (done) · Hot files: seeds, careGroupService, /app home |
| `assistant-access` | done | — | `packages/data/src/db/schema/care-groups/careGroup.ts`, `packages/data/src/db/schema/connectors/connectorRules`, `packages/data/src/services/connectorGrantService.ts`, `packages/data/src/services/careGroupService.ts`, `packages/api/src/care-groups/careGroup.ts`, `packages/api/src/connectors/protocol.ts`, `packages/api/src/connectors/connect.ts`, `packages/api/src/connectors/connector.ts`, `packages/api/src/connectors/tools/groupOverview.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/care-groups/assistantsSwitch.sync.ts`, `apps/web/app/routes/app/groups/settings/assistants/`, `apps/web/app/routes/connectors/connect/`, `apps/web/app/routes/app/settings/devices/ConnectedAssistants.tsx` | Owner chooses read/write or read only for a group's assistants (B-558) |
| `sync-safety` | done | — | `packages/api/src/sync`, `apps/web/app/lib/sync/`, `apps/web/app/lib/auth/session`, `apps/web/app/routes/sign-out.tsx`, `apps/web/app/routes/app/layout/SyncIndicator.tsx`, `apps/web/app/routes/app/layout/UserMenu.tsx`, `packages/data/src/services/`, `apps/web/app/lib/medications/medications.sync.ts`, `apps/web/app/lib/providers/providers.sync.ts`, `scripts/browser-checks/roundtrip.spec.mjs`, `scripts/browser-checks/signout-wipe.spec.mjs`, `scripts/browser-checks/session-end.spec.mjs` | to write (B-285 to B-296, B-382 to B-384, B-387: repeating-todo upload bugs Codex found, moved from `planner-2`), from the 2026-11-21 code review (findings not re-verified): refused sync changes shown to the user, an upload queue that can't wedge, offline edits that don't revert a co-member's change, replayed PUTs, global client-chosen ids, the sign-out wipe and unsent writes, then the column-agreement test and one generic upload handler · Depends on: (none); `test-health` shares the upload tests (B-371, B-374) · Hot files: `packages/api/src/sync.ts`, `lib/sync/client.ts`, `SyncIndicator`, `session.ts`, `sign-out.tsx`, `medications.sync.ts`, `providers.sync.ts`, the services' `upsert`s |
| `demo-site` | hold | — | — | Shared demo site with generic logins and nightly reset; separate environment |
| `calendars-2` | done | — | `packages/data/src/google/`, `packages/data/src/services/calendar`, `packages/data/src/db/schema/calendars/`, `packages/data/src/db/schema/notifications/`, `packages/data/src/db/schema/appointments/repeatRule`, `packages/data/src/db/schema/appointments/seriesVisits`, `packages/notifications/`, `apps/web/app/lib/appointments/repeatChoice`, `apps/web/app/lib/calendars/`, `apps/web/app/components/repeat/`, `apps/web/app/routes/app/groups/settings/calendar/` | [PRD](calendars-2-prd.md), [plan](calendars-2-plan.md) (B-304 to B-309): 7 slices, waves (1, 3, 5, 6) → (2, 4) → 7: Google deletes leave started items and todos alone; Google sync looks a year ahead with a daily catch-up; reminders expire at the event's start; deleted providers leave pushes; a stale consent goes generic and asks again; times name their zone; monthly on the last day. Two additive migrations (waves 1 and 3), no deps, no stack. Push notifications (B-377) are calendars-3 |
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
| `simple-mode` | done | — | `apps/web/app/lib/assistant/simpleMode`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `powersync/sync-config.yaml` | [PRD](simple-mode-prd.md), [plan](simple-mode-plan.md): 5 slices, waves 1 → 2 → 3 → (4, 5): the lock becomes two member roles, Easy helper (log-only, own entries, own todos) and Easy viewer; "simple" is renamed "easy" everywhere, database included; the role decides the view; the Planner, todo pages and search open for the easy roles (B-221, B-236); the Easy mode toggle moves from the View options menu into the full timeline's page header (slice 5, stackless, B-400). Migrations in slices 1, 2 and 3; sync config changes. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248) and the current `quick-fixes` wave in `dev` (slice 1 renames files they touch) · Hot files: slice 1: every `simple*` file (`lib/assistant/simpleMode*`, `SimpleTimeline` and its blocks, quick entry, `TodoTick`, the `/app` layout), `sync-config.yaml`, the device schema; slice 2: `constants/roles.ts`, `permissions/` (blocks, types, timeline, todos, live-notes, connectors), `todoService`, the upload switch, `groupContext.ts`, the role picker; slice 3: group settings Members, `careGroupMemberService`, `useSimpleFrame`; slice 4: the Planner and todo routes, the search route; slice 5: `TimelineHeader.tsx`, `TimelineViewMenu.tsx`, the toggle button |
| `connectors-4` | hold | `hosting`, `marketing` | — | Directory listings (B-196): after the launch (B-33), the privacy policy (B-54) and the staging check with Claude and ChatGPT; needs a logo, short and long descriptions, a test account, the privacy URL |
| `connectors-5` | hold | `tags` | — | Connector tags (B-861): list tags, filter by a tag, tag records, only for groups sharing medical information with connectors; after tags lands; to write |
| `marketing` | hold | — | — | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user |
| `hosting` | hold | — | — | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent |
| `encryption` | hold | — | — | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 · Depends on: (none); affects `assistant` and `documents` · Hot files: none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `documents` | hold | `encryption` | — | to write (B-56) · Depends on: hosting (B-33, file storage); `profiles` (soft); `encryption` decision · Hot files: file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS` |
| `timeline-jump` | done | `quick-entry-2` | `apps/web/app/lib/timeline/timeline.sync.ts`, `apps/web/app/lib/timeline/timelineFilters.ts`, `apps/web/app/lib/providers/providers.sync.ts`, `apps/web/app/lib/medications/medicationTimeline.sync.ts`, `apps/web/app/lib/care-periods/periodMarkers.ts`, `apps/web/app/routes/app/groups/timeline/useTimelineData.ts`, `apps/web/app/routes/app/groups/timeline/timelineRows.ts`, `apps/web/app/routes/app/groups/timeline/timelinePaging.ts`, `apps/web/app/routes/app/groups/timeline/daySummaryRows.ts`, `apps/web/app/routes/app/groups/timeline/TimelineEntryList.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/timeline/route.tsx`, `apps/web/app/components/quick-entry/`, `packages/data/src/db/schema/assistant/quickEntryTime` | Jump to a date on the timeline, by picker and quick entry (B-557) |
| `orchestration-split` | done | — | `scripts/loops/`, `scripts/backlog/`, `scripts/ci/`, `.githooks/`, `scripts/project/`, `package.json`, `vitest.config.ts`, `.github/workflows/`, `AGENTS.md`, `risa.json` | Held until after launch by the user (B-543): extract the orchestration tooling or replace it with a prebuilt one |
| `member-avatars` | done | `onboarding`, `ui-kit-5` | `packages/data/src/db/schema/auth/user.ts`, `packages/data/src/models/user/userModel.ts`, `packages/data/src/permissions/blocks.ts`, `packages/api/src/app-shell/me.ts`, `powersync/sync-config.yaml`, `apps/web/app/lib/sync/schema.ts`, `apps/web/app/lib/app-shell/me.ts`, `apps/web/app/components/ui/UserAvatar.tsx`, `apps/web/app/components/ui/AvatarStack.tsx`, `apps/web/app/components/notes/EditorAvatars.tsx`, `apps/web/app/components/entry/KindIcon.tsx`, `apps/web/app/routes/app/settings/account/`, `apps/web/app/routes/app/layout/UserMenu.tsx`, `apps/web/app/routes/app/groups/settings/members/`, `apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx`, `apps/web/app/routes/app/groups/timeline/PassLogItem.tsx`, `apps/web/app/routes/app/groups/timeline/TimelineFilters.tsx`, `apps/web/app/routes/app/groups/planner/`, `scripts/browser-checks/roundtrip.spec.mjs` | Released 2026-11-23 by the user. Members choose an avatar color and icon; no photos or image storage. |
| `orchestration-split-2` | done | `orchestration-split` | `scripts/loops/`, `scripts/project/`, `packages/data/test/`, `apps/web/test/`, `docs/agents/`, `docs/orchestration.md`, `AGENTS.md`, `risa.json` | — |
| `sync-safety-3` | hold | `sync-safety-2` | — | to write (B-294): atomic device writes, cut from sync-safety-2 2026-11-25; start from plans/sync-safety-3-notes.md (thread the context's transaction through the services first) |
| `onboarding-3` | hold | `onboarding-2` | — | — |
| `care-booklet` | hold | — | — | Printed care booklet (B-918, B-919). Held by the user 2026-11-26 until released. |
| `med-intervals` | hold | `connectors-3` | `packages/data/src/db/schema/medications/`, `apps/web/app/lib/medications/`, `apps/web/app/routes/app/groups/medications/`, `packages/data/src/services/assistantActionService.ts`, `packages/data/src/services/medicationService.ts`, `packages/api/src/connectors/tools/` | Every-N-hours schedules for medications and Med times (B-938). |
| `med-intervals-2` | — | `med-intervals` | — | Interval Med times and as-needed Med times; part 2 of B-938 (B-981) |
| `tags-4` | hold | `tags-3` | — | — |
| `shared-displays` | hold | `todo-subtasks-3`, `tags-3` | — | — |
| `todo-links-2` | — | `todo-links` | — | — |

## Summary

<!-- Generated by `risa backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-33 | plan | triaged | hosting |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-52 | feature | triaged | data-rights-2 |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security-2 |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-145 | question | triaged | encryption |  | Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for… |
| B-183 | chore | triaged | hosting |  | Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons) |
| B-196 | feature | triaged | connectors-4 |  | List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting |
| B-209 | feature | triaged | i18n |  | react-i18next or some other internationalization library to support multiple languages for all text… |
| B-252 | feature | landed | connectors-3 | prd/connectors-3 | Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming |
| B-253 | feature | landed | connectors-3 | prd/connectors-3 | Connector: add_todo can make a repeating todo (daily, weekly on days, monthly) |
| B-294 | bug | triaged | sync-safety-3 |  | Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused |
| B-295 | bug | triaged | sync-safety-2 |  | System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable |
| B-296 | bug | triaged | sync-safety-2 |  | A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database |
| B-325 | change | triaged | hosting |  | Native readiness: no top safe-area inset on the header or sticky day headers (viewport-fit=cover), and /app is a blank page on cold start for up to about 4 s (HydrateFallback returns null) |
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
| B-338 | feature | triaged | account-security-2 |  | Account settings: change name, email and password (today the page is read-only; password only via reset) |
| B-339 | question | triaged | account-security |  | Decide the session cookie cache before launch: ordinary /rpc calls keep working for up to 3 minutes after a session is revoked |
| B-340 | change | triaged | account-security-2 |  | A member in two groups can connect a given assistant to only one (one grant per user and client) |
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
| B-356 | feature | triaged | data-rights-2 |  | A staff procedure and tooling for deletion and export requests before self-service ships (the privacy draft promises deletion within 45 days; nothing can delete an account or group) |
| B-357 | question | triaged | data-rights |  | Consent evidence is deleted with the user or group (care_group_consent, connector_grant cascade), and the audit log loses target_user_id: keep them? |
| B-358 | question | triaged | data-rights-2 |  | Should the legal drafts promise only what is built (deletion, 'permanently removed' entries, backups, at-rest encryption), and who fills the placeholders ([Company legal name], [privacy email], [backup retention period])? |
| B-361 | change | triaged | code-health |  | A @caretook/data/domain export for the pure logic now living under db/schema (quick entry parser, due doses, medication display, series edits: about half that folder) |
| B-362 | change | triaged | code-health-2 |  | A soft-delete model factory and a shared upsert helper: nine models are the same file, twelve upserts repeat the exists-as-system, visible-as-actor sequence, 'invalid' is defined 18 times |
| B-363 | change | triaged | code-health-2 |  | One exported role-capability table (canWrite(role), canComplete(role)) used by services, device modules and screens, before any role is added |
| B-364 | change | triaged | code-health-3 |  | Device reads are 164 raw SQL strings with hand-typed row types, 17 files outside *.sync.ts: derive row types from the device schema and make libLayout.test.ts refuse SQL elsewhere |
| B-365 | chore | triaged | code-health |  | Remove unused scaffolding and dead exports: serviceName (45 exports, 0 reads), the services registry, getService, isServiceName, initClient, isUserRoleName, isGroupRoleName, primaryContactName, hasContact, CALENDAR_CARDS, COMING_SOON |
| B-366 | chore | triaged | code-health |  | Pin dependencies exactly: 47 caret ranges remain (react-router, drizzle-orm, zod, vite among them) against AGENTS.md's rule |
| B-368 | chore | triaged | code-health-3 |  | Comments that point at plans instead of behaviour: 198 'slice N' references in 154 source files and 262 PRD-name parentheticals |
| B-369 | change | triaged | code-health-3 |  | baseModel.list always runs a second COUNT query, and a sync PATCH costs about seven round trips (a 100-op batch about a thousand, serially) |
| B-375 | chore | triaged | fixes-tooling |  | Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports) |
| B-377 | feature | in-progress | push-notifications | prd/push-notifications | Push notifications for appointment reminders (B-61 shipped email only) |
| B-378 | chore | triaged | i18n |  | File the translations PRD's promised follow-ups: Spanish quick entry, language-aware search, a human review of the Spanish; and note 48 hard-coded 'en-US' formatters and English messages in schemas and the errors catalogue |
| B-383 | bug | triaged | sync-safety-2 |  | Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating |
| B-384 | bug | triaged | sync-safety-2 |  | Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete) |
| B-387 | bug | triaged | sync-safety-2 |  | Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin |
| B-455 | chore | triaged | contract-migrations |  | Drop the old per-member simple mode columns (simple_mode, simple_mode_locked) once Easy roles replace them |
| B-456 | chore | triaged | contract-migrations |  | Retire the leftover reminder data planner-2 left in place: the note kind on appointment_series and stored future notes and note series |
| B-457 | chore | triaged | contract-migrations |  | Give groups that predate the default medication passes (Morning 08:00 and Evening 20:00) their two passes |
| B-561 | feature | triaged | demo-site |  | Shared demo site: demo.caretook.com with a fictional care group, generic logins and a nightly reset, to link from invites |
| B-562 | change | triaged | data-rights-2 |  | Notice before a material change to the legal pages: the privacy policy promises notice and consent where required, and nothing does this yet |
| B-563 | feature | triaged | marketing |  | Accessibility statement page |
| B-564 | change | triaged | hosting |  | App-store prerequisites for the Capacitor apps |
| B-565 | feature | triaged | data-rights-2 |  | Ownership transfer: a last owner can hand a care group to another member |
| B-619 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/lib/search/search.sync.browser.test.tsx: about 2,000 entries the rebuild takes under 2 s, and a … |
| B-625 | chore | triaged | contract-migrations |  | Drop todo.event_id and its old-client mirror once no device writes it |
| B-665 | change | triaged | onboarding-3 |  | Remove the standalone Invite someone notice from the Timeline; inviting lives in the onboarding setup steps |
| B-667 | chore | triaged | fixes-tooling |  | Resettable seeded onboarding test user, so the new-member setup flow can be retried without a new address each time |
| B-670 | feature | triaged | onboarding-2 |  | Onboarding on its own pages with inline forms, providers first, a care period step, a Later exit and a Want help onboarding? toast |
| B-730 | bug | triaged | sync-safety-2 |  | A magic-link or invite sign-in that lands while an offline sign-out is still pending has its new session ended by the next /app check (sign-in page guards it, other sign-in paths don't) |
| B-749 | chore | triaged | fixes-tooling |  | check-areas: the *.sync.ts writers roundtrip now calls (todos, allergies, conditions, medicationConditions, notes) don't map to roundtrip |
| B-750 | bug | triaged | fixes-bug |  | Second-zone failures past the filing cap: test files that fail in America/New_York beyond the release tier's 10 filings |
| B-752 | bug | triaged | fixes-bug | prd/fixes-bug | timelineJump.browser.test.tsx can hang a components shard in CI |
| B-757 | chore | triaged | fixes-tooling |  | Slice check runs a slice's own component files only in Los Angeles: add web:components:ny for files in its include list |
| B-759 | feature | triaged | onboarding-3 |  | Install-the-app tip on mobile browsers: a step in onboarding, then a dismissable tip at sign-in until installed or 'never show again' |
| B-760 | feature | landed | connectors-3 | prd/connectors-3 | Connector: add_provider, so a member's own AI can add a provider (name, specialty or practice, phone, address) |
| B-761 | feature | landed | connectors-3 | prd/connectors-3 | Connector: add_medication, so a member's own AI can add a medication with its type and schedule |
| B-772 | chore | triaged | test-time-gates-2 |  | Lighten the components tier: trim the New York zone run and slow component tests |
| B-776 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/planner/planner.browser.test.tsx: the header the tabs carry what each reads: U… |
| B-778 | bug | triaged | fixes-tooling |  | CI flake: packages/data/src/services/accountAdmin.int.test.ts: accountAdminService.setRole makes an account support, ad… |
| B-782 | bug | triaged | fixes-tooling |  | CI flake: packages/api/src/admin/usersAdmin.int.test.ts: admin.users.get shows the account, its sessions, groups and ma… |
| B-785 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/timeline/timelineJumpPaging.browser.test.tsx: scrolling newer from a day Back … |
| B-790 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/timeline/timelineScroll.browser.test.tsx: infinite scroll three pages down, an… |
| B-791 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/profile/emergency.browser.test.tsx: the owner's sheet builds the list: a membe… |
| B-795 | chore | triaged |  |  | Clean Caretook's history of the orchestration tooling and its bloat |
| B-802 | bug | triaged | fixes-tooling |  | CI flake: invites.spec.mjs '3. reset a password by email › the new password signs in' failed once, passed on rerun |
| B-808 | bug | triaged | fixes-tooling |  | Browser check ui.spec: the add sheet's surface can measure 0 by 0 under load |
| B-829 | question | triaged | marketing |  | Research: compare Care Book to Caring Village |
| B-831 | feature | triaged | data-rights-2 |  | Inactive group scrub: a care group with no member sign-in for X days gets a cycle of reminder emails, then its data is scrubbed automatically |
| B-836 | feature | triaged | marketing |  | Marketing site visual refresh to modern design standards (split from B-417; no screenshots or videos) |
| B-837 | change | triaged | test-time-gates-2 |  | Time limit gates for component tests, unit tests and the local quick check |
| B-839 | bug | triaged | fixes-tooling |  | Search rebuild timing test flaked on CI (2,000 entries under 2 s) |
| B-851 | chore | triaged | fixes-tooling |  | Check plan: a rule for scripts/build/ (hand-run build scripts such as share-image.mjs), so a new one doesn't push the proposed tier to full |
| B-852 | bug | triaged | fixes-tooling |  | Marketing banned-phrase test misses competitor names and the contact, header and footer strings |
| B-853 | chore | triaged | marketing |  | Connect ChatGPT (Developer mode) and Claude to a care group by hand on staging before the marketing link is shared |
| B-854 | chore | triaged | marketing |  | Confirm Google OAuth verification before the marketing link is shared (Google Calendar connect works only for test users until then) |
| B-855 | change | triaged | marketing |  | Home hero: cut the remaining marketing speak (follow-up to the full-logo hero hotfix) |
| B-858 | feature | triaged | onboarding-3 |  | Connect your AI assistant setup nudge: the last onboarding toast, opening group settings Assistants |
| B-859 | change | triaged | test-time-gates-2 |  | Test time limits, part 2: component shard fallback, quick check under 5 minutes, arm the components and quick gates |
| B-861 | feature | triaged | connectors-5 |  | Connector: tags and tagging (list tags, filter by a tag, add and remove tags on records) for groups… |
| B-863 | chore | triaged | fixes-tooling |  | CI's unit shards balance by file count: widen shards.mjs's SHARD_JOB to the unit-N jobs and refresh component-durations.json from a unit run (predicted 344/288 s of file time against 316/316 balanced) |
| B-887 | change | triaged | marketing |  | Features page "Type it the way you'd say it" section should highlight more that users can just say… |
| B-888 | change | triaged | marketing |  | Features page should highlight easy mode |
| B-890 | feature | landed | symptom-catalog-2 | prd/symptom-catalog-2 | Manage the group's symptom catalog under group settings: archive or delete; delete makes you pick a replacement symptom |
| B-891 | feature | landed | tags-3 | prd/tags-3 | Tags management page under group settings: list, rename, delete (and merge?) the group's tags |
| B-895 | feature | landed | tags-3 | prd/tags-3 | Search: tags as a filter you can see and tap (not a dropdown), and typed text that matches a tag's name finds the items carrying it |
| B-896 | feature | triaged | onboarding-3 |  | Quick entry cheat sheet and vocabulary pages, linked from quick entry (and onboarding), so people learn everything it understands without guessing; just before launch |
| B-898 | change | landed | symptom-catalog-2 | prd/symptom-catalog-2 | Quick entry should use the similar symptom by default on Enter, with an option to add new instead,… |
| B-901 | plan | triaged | onboarding-3 |  | Onboarding plan for invited users, based on their user type (we already have one for care group… |
| B-907 | change | triaged | fixes-tooling |  | Tests: drop assertions that pin fixed UI copy word for word |
| B-917 | feature | landed | connectors-3 | prd/connectors-3 | Connector: a member's AI reads a photo of a hand-filled weekly medication sheet and logs its doses, adding only what isn't already logged |
| B-918 | feature | triaged | care-booklet |  | Printed care booklet: the profile (allergies, conditions) as the front page, then the medication list, weekly sheet and other sheets; print all of it or only the pages that changed |
| B-919 | feature | triaged | care-booklet |  | Printed medication guide page for each medication, as booklet pages |
| B-920 | feature | triaged | symptom-catalog-3 |  | Delete a symptom on the Symptoms page by picking a replacement: entries move to it, and the deleted name keeps pointing there (B-890's delete half) |
| B-921 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/routes/app/groups/timeline/timelineTags.browser.test.tsx: tagging an entry a writer applies, rem… |
| B-922 | bug | triaged | fixes-tooling |  | Browser check ui.spec: 420 add sheet measures the sheet before it lays out (0×0), a read-before-render race |
| B-938 | feature | triaged | med-intervals |  | Interval schedules for medications and Med times: every N hours, changed often (hospice: PRN, then every 6 h, 4 h, 3 h), each next dose due from the last due time or from when it was given |
| B-941 | feature | landed | todo-subtasks-3 | prd/todo-subtasks-3 | Todos page shows each parent with all its nested todos under it, at every level |
| B-942 | feature | landed | todo-subtasks-3 | prd/todo-subtasks-3 | Quick add a subtask at any level from the Todos list: a + on the row, type a title, Enter |
| B-943 | feature | landed | todo-subtasks-3 | prd/todo-subtasks-3 | Subtask due dates: a child inherits its parent's due date by default and can't be due after it; children list by due date, then by when they were made |
| B-944 | feature | in-progress | todo-links | prd/todo-links | One 'Link to…' box replaces the todo's separate provider, event, medication and note pickers: backed by site search limited to linkable types; each result shows its type icon and a second line (event date, provider specialty, med dose) |
| B-945 | feature | in-progress | todo-links | prd/todo-links | Link picker type filter: tappable type chips above the box (All, Providers, Events, Meds, Notes, like B-895's tag filter); a typed type word ('provider lee', 'med', 'appt') turns its chip on and keeps filtering on the rest |
| B-946 | feature | in-progress | todo-links | prd/todo-links | Link picker matches more than names: provider practice, specialty, phone; med brand names (B-939) and conditions; event place and provider; note text; tags; ranked like site search |
| B-947 | feature | in-progress | todo-links | prd/todo-links | Link picker empty state: before typing, suggest likely picks (upcoming events, recently viewed, the entry or provider you came from) |
| B-948 | feature | landed | todo-links | prd/todo-links | Quick add a todo or subtask from a timeline entry and any other linkable page (provider, medication, event) without leaving it, linked automatically; reuse B-942's quick add part |
| B-949 | bug | triaged | fixes-tooling |  | CI flake: apps/web/app/components/ui/sheetExit.browser.test.tsx: closed by navigating with reduced motion Back complete… |
| B-950 | change | triaged | fixes-nit |  | Move TimelineEntryRow (and useOpenTodoCounts) out of routes/app/groups/timeline into components/entry, so the provider page's LinkedEntries and QuickEntryCard stop importing another route's folder |
| B-954 | bug | triaged | fixes-tooling |  | Browser checks and prd serve run on a stack whose applied migrations are behind the repo's, so a missing column fails a check far from its cause |
| B-955 | change | landed | tags-3 | prd/tags-3 | One tag control everywhere tags show: icon-only tag-plus Add button, × right beside the name, more room before Add, Undo toast on remove; list rows (Todos, Planner, providers, medications) get it too |
| B-961 | change | triaged | shared-displays |  | Shared displays audit: each record kind (timeline entry, medication, provider, todo, event) shows through one shared display on rows, cards, pages and sheets; list today's variants and merge them, exceptions written down |
| B-964 | feature | triaged | todo-links-2 |  | View option to split todo trees into individual due todos (trees stay the default) |
| B-965 | change | triaged | fixes-perf |  | Group the tiny shared app helper chunks on the first /app load |
| B-966 | change | triaged | fixes-perf |  | Marketing and sign-in pages load the whole shared icons chunk (~5-10.5 KB gz) since slice 11 grouped lucide icons |
| B-967 | bug | triaged | fixes-tooling |  | Browser check layout-offline fails at 'offline: a row's edit link opens its edit sheet': the row's tag chips cover the Edit link's centre |
| B-968 | bug | staging | fixes-bug | prd/fixes-bug | …: apps/web/app/routes/app/groups/settings/calendarGoogle.browser.test.tsx fails in America/New_York |
| B-969 | bug | staging | fixes-bug | prd/fixes-bug | CI: apps/web/app/routes/app/groups/settings/groupSettings.browser.test.tsx fails in America/New_York |
| B-970 | bug | staging | fixes-bug | prd/fixes-bug | CI: scripts/browser-checks/layout-offline.spec.mjs fails in America/New_York |
| B-971 | bug | staging | fixes-bug | prd/fixes-bug | CI: scripts/browser-checks/roundtrip.spec.mjs fails in America/New_York |
| B-972 | feature | triaged | tags-4 |  | Tags tab on the planner: a unified view listing all tags and the items tagged with each |
| B-974 | bug | landed | todo-subtasks-3 | prd/todo-subtasks-3 | Planner day trees: under a tag or text filter, a matching step and its unmatched parent due the same day rank at the parent's time (todoDayTrees' same-day lead can be a context row) |
| B-975 | change | triaged | fixes-ui |  | Marketing home: AI providers 'will not' keep your data or train on it, not 'may not' (apps/web/app/routes/marketing/home/content.ts, the AI answer) |
| B-976 | bug | landed | fixes-bug | prd/fixes-bug | Quick entry vitals in any order: '140/78 74bpm 97 o2' drops the O2 (only 'o2 97' works); HR/bpm the same, label before the number works, after doesn't. Very common entries: accept label before or after each number |
| B-977 | feature | triaged | fixes-tooling |  | Human deploy path run from GitHub: a workflow_dispatch 'Deploy to staging' (cut a release candidate from dev, run the candidate tier, promote on green) and 'Deploy to production' (staging to main PR, release gate, merge), today only the local risa ci candidate cut / promote and pnpm prd ci release |
| B-978 | bug | landed | fixes-bug | prd/fixes-bug | Installed PWA shows no update notice until it's closed and reopened |
| B-979 | bug | landed | fixes-bug | prd/fixes-bug | Search results' tag chips keep a matching tag's old name or color after another device renames or recolors it (useSearchPage's refresh keys miss tag metadata) |
| B-980 | bug | triaged | fixes-ui |  | Subtask add button in the nested todo tree sits under the title; put it right-aligned on the title's line |
| B-981 | feature | triaged | med-intervals-2 |  | Interval Med times: a Med time every N hours (from due or given) so a group's frequency changes in one edit, and as-needed Med times (B-938 part 2) |
| B-982 | bug | landed | fixes-bug | prd/fixes-bug | past_doses reads doses with no upper bound, so a busy group's old days can show given doses as missed |
| B-983 | bug | triaged | fixes-tooling |  | Browser-check flake: ui.spec.mjs 'add sheet: the full screen' measured the Symptom sheet's surface at height 0 (expected 900) at 420px light and dark under load; passed alone |
| B-984 | bug | landed | fixes-bug | prd/fixes-bug | Two dose writes with different statuses for one slot at once can both be added (log_past_doses and log_dose lock a status-dependent id) |
| B-985 | bug | landed | fixes-bug | prd/fixes-bug | log_past_doses writes today's usual dose on past days when the medication's dose changed in the range |
| B-986 | bug | landed | fixes-bug | prd/fixes-bug | log_past_doses sees only the first 100 medications, so marks for others come back noSlot |
| B-987 | bug | in-progress | fixes-bug | prd/fixes-bug | log_dose's pass read (slotDose, assistantActionService.ts ~405) pages at 100 with includeDeleted, so a group with over 100 passes ever made can miss a pass |
| B-988 | bug | in-progress | todo-links | prd/todo-links | Link to box: many matching doses, vitals, symptoms or cancelled events crowd out matching notes and events (entry hits are capped before the linkable-kind filter) |
| B-989 | bug | in-progress | todo-links | prd/todo-links | Link to box doesn't refresh an open tag-name search when a tag is renamed or a record is tagged or untagged |

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
- prd: data-rights-2
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'data-rights' (to write): export everything you can see (per group and per account) to a file. Compliance (AGENTS.md) already requires user data deletion; export belongs with it.
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): moved to the follow-on data-rights-2 to keep data-rights at six slices; data-rights builds scrub-on-delete, hand-over, group and account deletion and kept consent evidence (plans/data-rights-prd.md, Out of scope). data-rights-2 also adds the retention sweep and removing Caretook's Google calendar on delete.

### B-53 · feature · Ability to delete ALL data from the app.

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for 'data-rights' with B-52. Needs scoping in the PRD: 'delete ALL data' could mean this device's copy, one group (owners), or the whole account. Ties to the open question about a last owner deleting their account.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-1 is filed as B-84 for data-rights: soft delete scrubs content; plan it with delete-all.
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): planned in plans/data-rights-plan.md. User answered (a238-a240, as recommended): scrub at once, names too, already-deleted rows included; a last owner hands over or deletes first; consent evidence kept with bare ids until a retention period.
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25, after skeptic s49): data-rights builds the group half (owners delete a care group). The account half goes to data-rights-2 (its planner takes this item over when data-rights lands): blocked while a last owner of a shared group (a239), sole-member groups deleted with it, reuses careGroupService.remove's inner step. Open for that planner, ask as compliance: do a deleted account's entries stay with the group as 'Former member' (privacy draft line 189 is unconfirmed)? Also scrub the account's address from invites addressed to it and from outbox rows.

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
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): planned in plans/data-rights-plan.md. User answered (a238-a240, as recommended): scrub at once, names too, already-deleted rows included; a last owner hands over or deletes first; consent evidence kept with bare ids until a retention period.

### B-85 · feature · Two-factor sign-in, required for owners, admins and staff; breached-password check

- status: triaged
- prd: account-security-2
- owner:
- commit:

- 2026-11-19 (plan/encryption): From the security review (plans/security-review.md on plan/encryption), S-9 (later): Better Auth's twoFactor and haveIBeenPwned plugins (built in). Required for owners, admins and global staff, optional for others (decided 2026-11-19). The PRD settles group creation, promotion, a grace period for existing owners, and recovery.
- 2026-11-25 (plan/account-security): Cut from account-security by its planner (2026-11-25) to keep that PRD at seven slices: two-factor and the breached-password check, editable account settings, one assistant in several groups go to account-security-2 (to write, after account-security). Note for its planner: Better Auth's twoFactor gates only password sign-in, so the email link and code need the second factor too.

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

### B-252 · feature · Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming

- status: landed
- prd: connectors-3
- owner: prd/connectors-3
- commit: 6e026ab18

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21, the user's request: upcoming returns appointments and dated todos only; the dosing schedule gets its own read tool (a new one, or a day parameter on todays_doses). Proposed topic connectors-3, a PRD to write; for the user to check.
- 2026-11-21 (plan/connectors-3): Planned as connectors-3 slice 1: a new read tool dose_schedule (today onward, 7 days by default, 14 at most; the plan only, no state). plans/connectors-3-plan.md

### B-253 · feature · Connector: add_todo can make a repeating todo (daily, weekly on days, monthly)

- status: landed
- prd: connectors-3
- owner: prd/connectors-3
- commit: 6e026ab18

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21: repeating todos are created from the todo form only in planner-2; the connector's add_todo taking a repeat is this follow-up, after planner-2 (B-248 remove reminders) is in dev. Proposed with B-252 in connectors-3; for the user to check.
- 2026-11-21 (plan/connectors-3): Planned as connectors-3 slice 2: add_todo takes a structured repeat (every day, week on weekdays, or month; interval; no end). Waits for planner-3 (addTodo.repeatRule). plans/connectors-3-plan.md
- 2026-11-25 (prd/planner-3): planner-3 landed (8c1fa06, PR #182): addTodo.repeatRule now exists in the assistant action runners; add_todo can pass it through instead of building its own rule.
- 2026-11-25 (prd/planner-3): planner-3 landed (8c1fa06b, PR #182): addTodo.repeatRule exists in the assistant action runners and the todo service; connectors-3 can build add_todo's repeat on it.
- 2026-11-25 (prd/planner-3): planner-3 landed in dev (8c1fa06, PR #182): the assistant's addTodo action now takes repeatRule (B-254), so add_todo can pass it through
- 2026-11-25 (prd/planner-3): planner-3 landed (8c1fa06): the quick-entry addTodo action now takes repeatRule (B-254); add_todo can reuse it rather than add its own repeat shape.

### B-294 · bug · Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused

- status: triaged
- prd: sync-safety-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Example: a series split in lib/appointments/series.sync.ts:433-521. Design finding: upload by device transaction and apply it atomically. Related: removePass rewrites every medication's schedule from the device's possibly stale copy (medicationPasses.sync.ts:283-287).
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.
- 2026-11-25 (plan/sync-safety-2): Moved from sync-safety-2 to sync-safety-3 on the user's word (ask a237, 2026-11-25): the 12 services the upload calls open their own transactions (~62 withTransaction calls with no tx), so they must first join a shared one. Design and skeptic findings: plans/sync-safety-3-notes.md.

### B-295 · bug · System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. medicationService.ts:73,185; medicationPassService.ts:119; recipientConditionService.ts:173. Clamp the future side to server time. Low.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.
- 2026-11-25 (plan/sync-safety-2): Planned in plans/sync-safety-2-plan.md (2026-11-25): slice 1 B-295, slice 2 B-383/B-384, slice 3 B-387, slice 4 B-296/B-730.

### B-296 · bug · A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/sync/index.ts:28. Traced by reading only. Low.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.
- 2026-11-25 (plan/sync-safety-2): Planned in plans/sync-safety-2-plan.md (2026-11-25): slice 1 B-295, slice 2 B-383/B-384, slice 3 B-387, slice 4 B-296/B-730.

### B-325 · change · Native readiness: no top safe-area inset on the header or sticky day headers (viewport-fit=cover), and /app is a blank page on cold start for up to about 4 s (HydrateFallback returns null)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. root.tsx:31,58. Only Sheet handles the inset. Belongs with Capacitor work when that starts.
- 2026-11-21 (prd/orchestration-2): category: ui (orchestration-2 split)
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21: checked against dev, still present and not yet fixed.
- 2026-11-24 (prd/fixes-ui): fixes-ui wave 12 (dev ea38277): the blank cold start is covered by B-806 (root HydrateFallback is now brand/AppLoading). Left: the top safe-area inset (viewport-fit=cover) on the header and sticky day headers, with Capacitor.
- 2026-11-27 (Robert Bo Davis): Backlog session 2026-11-27: moved from fixes-ui to hosting (held, with the Capacitor prerequisites B-564). As fixes-ui's only waiting item it made the dispatcher restart an idle fixes-ui in a loop.

### B-327 · bug · A removed or demoted manager's pending invites still work: a removed owner can accept their own owner invite within 7 days and be an owner again

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. careGroupMemberService.ts:66-91,136-171 revokes nothing; careGroupInviteService.ts:438-507 accept never rechecks the inviter. Fix idea: revoke the member's pending invites on removal and demotion. Two reviewers; high.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-328 · bug · The emailed sign-in code has no per-address limit (per IP only): a distributed attacker gets unlimited guesses at any account's 6-digit code

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:204-217, emails.ts:107-128: each /sign-in/magic-link call mints a fresh code with 3 attempts. The same loop floods the victim's inbox and keeps replacing their valid code. Cap sign-in emails and failed codes per address per hour.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-329 · bug · Ending sessions never ends a connected assistant: password reset, 'sign out everywhere' and staff 'sign out all' leave the grant and its 30-day rolling refresh token alive

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. auth.ts:179, accountAdminService.ts:334, db/schema/auth/oauth.ts:123,158. Staff session deletes are raw SQL, so the plugin's revoke hook never runs. Fix idea: revoke the user's grants on password reset and revoke-all, or prompt.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-330 · bug · Session tokens are stored in plain text and the bearer plugin accepts them unsigned; ops/data-copies.md says they are hashed

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:201 bearer() without requireSignature. Anyone who can read the session table can act as that user without BETTER_AUTH_SECRET. There is no native client using bearer yet. Fix: bearer({ requireSignature: true }) and correct the register.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-331 · bug · Staff admin can invite any address as owner of any group: not limited to ownerless groups, existing owners aren't told

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. groupAdminService.ts:179-222. With no two-factor (B-85) one staff account opens every group. Fix idea: only for ownerless groups, or email the existing owners.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-332 · bug · Staff page-view audit rows are fired without waiting and can be lost on Vercel; user search isn't audited

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. adminAuditService.ts:50-57 recordSoon is a bare void promise with no waitUntil; called from accountAdminService.ts:216 and groupAdminService.ts:73. Also from the database review: caretook_app has UPDATE and DELETE on admin_audit_log.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-333 · bug · Link sign-up leaks whether an address has an account (timing), has no rate limit, and one link creates unlimited unverified accounts

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/tickets.ts:67-75 (hash before the lookup); packages/api/src/care-groups/invites.ts:244; joinRequestService.ts:158 counts a use only at the join request.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-334 · bug · A declined or withdrawn join requester can ask again forever, emailing every owner and admin each time; no signed-in oRPC procedure is rate limited (sync.upload, invite.resend)

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. joinRequestService.ts:127-160, 306-320. Two reviewers. A cooldown, one counted use per user per link, and limits on authed procedures.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-335 · bug · Better Auth's /update-user is live and unvalidated: a name or image of any length syncs to co-members and into owner emails

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:142 (not in disabledPaths). Plausible.
- 2026-11-23 (plan/member-avatars): member-avatars skeptic, 2026-11-23: confirmed in the code. /update-user accepts image from any signed-in user, it syncs to co-members, and UserAvatar renders it as an img. The web CSP blocks external images, but a native build gets no such header, so a member could learn co-members' IPs. No app code calls it. Land before any native build ships; account-security is on hold.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-336 · bug · A role change reads its target unlocked: an admin's demote racing an owner's promotion of the same member can skip the owner-only and last-owner checks

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. careGroupMemberService.ts:68-88. Plausible. Lock the row or add the expected role to the UPDATE's filter.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-337 · bug · /mcp verifies a token (several database reads) before any rate limit, and rate-limit keys fall back to one shared 'unknown' bucket when the IP header is missing

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/api/src/connectors http.ts:100-108. /oauth2/register is open with per-IP limits only, and oauth_client rows are never purged.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.
- 2026-11-25 (plan/account-security): account-security planner: the oauth_client purge is left out (it deletes existing rows, and a client that cached its id may break); a later question for the user.

### B-338 · feature · Account settings: change name, email and password (today the page is read-only; password only via reset)

- status: triaged
- prd: account-security-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/settings/account/route.tsx. Staff cannot edit them either. Tracked nowhere before this review.
- 2026-11-25 (plan/account-security): Cut from account-security by its planner (2026-11-25) to keep that PRD at seven slices: two-factor and the breached-password check, editable account settings, one assistant in several groups go to account-security-2 (to write, after account-security). Note for its planner: Better Auth's twoFactor gates only password sign-in, so the email link and code need the second factor too.

### B-339 · question · Decide the session cookie cache before launch: ordinary /rpc calls keep working for up to 3 minutes after a session is revoked

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. docs/domain/auth.md says 'Reconsider before launch'; no item tracked it.
- 2026-11-25 (plan/account-security): Planned in plans/account-security-plan.md (plan/account-security, 2026-11-25): slices 1 B-327/B-336, 2 B-328/B-333/B-335, 3 B-331, 4 B-332, 5 B-329/B-330/B-339, 6 B-334, 7 B-337.

### B-340 · change · A member in two groups can connect a given assistant to only one (one grant per user and client)

- status: triaged
- prd: account-security-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Design finding from the connector review.
- 2026-11-25 (plan/account-security): Cut from account-security by its planner (2026-11-25) to keep that PRD at seven slices: two-factor and the breached-password check, editable account settings, one assistant in several groups go to account-security-2 (to write, after account-security). Note for its planner: Better Auth's twoFactor gates only password sign-in, so the email link and code need the second factor too.

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
- prd: data-rights-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/auth/src/auth.ts:158 has deleteUser off; userService.remove has no caller; no group deletion exists. A direct row delete cascades memberships past ensureAnotherOwner and leaves the group ownerless, with the Google token unrevoked (AGENTS.md's open question).
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): moved to the follow-on data-rights-2 to keep data-rights at six slices; data-rights builds scrub-on-delete, hand-over, group and account deletion and kept consent evidence (plans/data-rights-prd.md, Out of scope). data-rights-2 also adds the retention sweep and removing Caretook's Google calendar on delete.

### B-357 · question · Consent evidence is deleted with the user or group (care_group_consent, connector_grant cascade), and the audit log loses target_user_id: keep them?

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Design finding from the database review.
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): planned in plans/data-rights-plan.md. User answered (a238-a240, as recommended): scrub at once, names too, already-deleted rows included; a last owner hands over or deletes first; consent evidence kept with bare ids until a retention period.

### B-358 · question · Should the legal drafts promise only what is built (deletion, 'permanently removed' entries, backups, at-rest encryption), and who fills the placeholders ([Company legal name], [privacy email], [backup retention period])?

- status: triaged
- prd: data-rights-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. marketing privacy/content.ts:177-188 and the FAQ. Goes with B-54.
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): moved to the follow-on data-rights-2 to keep data-rights at six slices; data-rights builds scrub-on-delete, hand-over, group and account deletion and kept consent evidence (plans/data-rights-prd.md, Out of scope). data-rights-2 also adds the retention sweep and removing Caretook's Google calendar on delete.

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

- status: in-progress
- prd: push-notifications
- owner: prd/push-notifications
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. No match for pushManager or web-push in the code.
- 2026-11-21 (plan/calendars-2): Moved from calendars-2 to calendars-3 by the calendars-2 planner (2026-11-21): three or four slices alone, with a dependency and vendor question for its own planner.
- 2026-11-23 (plan/calendars-3): calendars-3 planned (2026-11-23): four slices, held after two skeptic send-backs; the user approved web-push 4.0.0, time-only push text, and landing it held (asks a136, a137, a138).
- 2026-11-26 (prd/calendars-3): 2026-11-26: held by the user: do Capacitor first, then push for web and mobile in one go; not needed for launch. calendars-3 is web push only. Saved work: slice/calendars-3/1 WIP 752efdde (unchecked), slice/calendars-3/4 fa23c912 (policy text, checked, unmerged).

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
- 2026-11-25 (plan/sync-safety-2): Planned in plans/sync-safety-2-plan.md (2026-11-25): slice 1 B-295, slice 2 B-383/B-384, slice 3 B-387, slice 4 B-296/B-730.

### B-384 · bug · Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete)

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.
- 2026-11-25 (plan/sync-safety-2): Planned in plans/sync-safety-2-plan.md (2026-11-25): slice 1 B-295, slice 2 B-383/B-384, slice 3 B-387, slice 4 B-296/B-730.

### B-387 · bug · Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, round 2, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.
- 2026-11-21 (plan/sync-safety): Cut from sync-safety to the follow-on sync-safety-2 by its planner (2026-11-21): six slices at most, and these are the lowest severity or build on sync-safety's upload registry and per-op results. See plans/sync-safety-prd.md, Out of Scope.
- 2026-11-25 (plan/sync-safety-2): Planned in plans/sync-safety-2-plan.md (2026-11-25): slice 1 B-295, slice 2 B-383/B-384, slice 3 B-387, slice 4 B-296/B-730.

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

### B-561 · feature · Shared demo site: demo.caretook.com with a fictional care group, generic logins and a nightly reset, to link from invites

- status: triaged
- prd: demo-site
- owner:
- commit:

- 2026-11-22 (Robert Bo Davis): User's design 2026-11-22. Separate environment (own Vercel, Neon, PowerSync, secrets); never in production because the seed guard forbids fictional data beside real data. One shared non-owner caretaker login, optional viewer login; no public sign-up; password rotatable. Permanent banner: everyone sees entries, no real information, erased nightly. Server-side blocks: email, invites, Google Calendar, connectors, calendar feeds, export, and changes to the demo login's password, email, sessions or account. Own reset, not resetStaging: that keeps non-example accounts and makes them owners of every seeded group. Nightly and manual reset, dates relative to today, noindex, test a device returning with offline edits after a reset. Mail needs a hard off switch, not an empty allowlist. Later if public: a throwaway group per visitor.

### B-562 · change · Notice before a material change to the legal pages: the privacy policy promises notice and consent where required, and nothing does this yet

- status: triaged
- prd: data-rights-2
- owner:
- commit:

- 2026-11-22 (plan/onboarding): From the onboarding skeptic (2026-11-22). onboarding records versions but builds no re-ask, by the user's answer on existing accounts; this needs a decision before the legal text changes materially.
- 2026-11-22 (Robert Bo Davis): Triage: data-rights, beside B-358 (what the legal drafts may promise); it is a consent and notice duty to users. Needs a decision before the legal text changes materially.
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): moved to the follow-on data-rights-2 to keep data-rights at six slices; data-rights builds scrub-on-delete, hand-over, group and account deletion and kept consent evidence (plans/data-rights-prd.md, Out of scope). data-rights-2 also adds the retention sweep and removing Caretook's Google calendar on delete.

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
- prd: data-rights-2
- owner:
- commit:

- 2026-11-22 (plan/onboarding): Split from B-360's review note (2026-11-22): careGroupMemberService says the last owner must hand over ownership first, and no flow does. Related to the open question on a last owner deleting their account.
- 2026-11-22 (Robert Bo Davis): Triage: data-rights, because it decides what account deletion does for a last owner (the open question in AGENTS.md).
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): planned in plans/data-rights-plan.md. User answered (a238-a240, as recommended): scrub at once, names too, already-deleted rows included; a last owner hands over or deletes first; consent evidence kept with bare ids until a retention period.
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): moved to data-rights-2 with account deletion, after the plan skeptic (s49) found data-rights too big; the user's answer (a239) needs it: a last owner hands over or deletes the group before deleting their account.

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
- 2026-11-25 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/test-time-gates.
- 2026-11-26 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/fixes-tooling. First failure: AssertionError: {"knee":12.200000000011642,"short of breath":14.5,"\"short of breath\"":12,"walk -cane":6.7999999999883585,"pres":12.5,"the":60}: expected 60 to be less than 50 at http://127.0.0.1:45791/home/runner/work/caretook.com/caretook.com/apps/web/app/lib/search/search.sync.browser.test.tsx?import&browserv=1812567600000:257:68 at async http://127.0.0.1:45791/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce3393e3/deps/plugins.DPQHVT0p-BV8Vq--D.js?v=97064129:5247:20
- 2026-11-26 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/todo-subtasks-2. First failure: AssertionError: {"knee":24.5,"short of breath":20.600000000034925,"\"short of breath\"":16.29999999998836,"walk -cane":7.100000000034925,"pres":5.2000000000116415,"the":53.600000000034925}: expected 53.600000000034925 to be less than 50 at http://127.0.0.1:41497/home/runner/work/caretook.com/caretook.com/apps/web/app/lib/search/search.sync.browser.test.tsx?import&browserv=1812567600000:257:68 at async http://127.0.0.1:41497/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce339…
- 2026-11-26 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/orchestration-split-3. First failure: AssertionError: {"knee":11.599999999976717,"short of breath":20,"\"short of breath\"":21.399999999965075,"walk -cane":5.899999999965075,"pres":5.100000000034925,"the":85.79999999998836}: expected 85.79999999998836 to be less than 50 at http://127.0.0.1:37765/home/runner/work/caretook.com/caretook.com/apps/web/app/lib/search/search.sync.browser.test.tsx?import&browserv=1812567600000:257:68 at async http://127.0.0.1:37765/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce3393e3/…
- 2026-11-26 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/tags-2. First failure: AssertionError: {"knee":11.20000000006985,"short of breath":14.5,"\"short of breath\"":7.5,"walk -cane":4.5,"pres":3.800000000046566,"the":51.39999999990687}: expected 51.39999999990687 to be less than 50 at http://127.0.0.1:42235/home/runner/work/caretook.com/caretook.com/apps/web/app/lib/search/search.sync.browser.test.tsx?import&browserv=1812567600000:257:68 at async http://127.0.0.1:42235/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce3393e3/deps/plugins.DPQHVT0p-BV8Vq-…
- 2026-11-27 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/fixes-ui. First failure: AssertionError: {"knee":19.100000000034925,"short of breath":22.900000000023283,"\"short of breath\"":19.899999999965075,"walk -cane":6.2000000000116415,"pres":5.600000000034925,"the":51.90000000002328}: expected 51.90000000002328 to be less than 50 at http://127.0.0.1:34249/home/runner/work/caretook.com/caretook.com/apps/web/app/lib/search/search.sync.browser.test.tsx?import&browserv=1812567600000:257:68 at async http://127.0.0.1:34249/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bf…
- 2026-11-27 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/fixes-bug. First failure: AssertionError: {"knee":26,"short of breath":18.099999999976717,"\"short of breath\"":20.79999999998836,"walk -cane":7.400000000023283,"pres":4.7999999999883585,"the":63.5}: expected 63.5 to be less than 50 at http://127.0.0.1:44531/home/runner/work/caretook.com/caretook.com/apps/web/app/lib/search/search.sync.browser.test.tsx?import&browserv=1812567600000:257:68 at async http://127.0.0.1:44531/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce3393e3/deps/plugins.DPQHVT0p-BV8V…
- 2026-11-27 (Robert Bo Davis): Flaked (passed on its rerun); on the brake list, so not quarantined; found by prd/todo-subtasks-3. First failure: AssertionError: {"knee":17.399999999965075,"short of breath":18.70000000001164,"\"short of breath\"":11.899999999965075,"walk -cane":5,"pres":5.2000000000116415,"the":56.20000000001164}: expected 56.20000000001164 to be less than 50 at http://127.0.0.1:34089/home/runner/work/caretook.com/caretook.com/apps/web/app/lib/search/search.sync.browser.test.tsx?import&browserv=1812567600000:257:68 at async http://127.0.0.1:34089/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce3393e3/…

### B-625 · chore · Drop todo.event_id and its old-client mirror once no device writes it

- status: triaged
- prd: contract-migrations
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From planner-3 (B-245): link rows in timeline_entry_todo replace the column. Contract step: remove the column, the todoService mirror, the releaseEvent and unlink clears, and eventId on old upload paths.

### B-665 · change · Remove the standalone Invite someone notice from the Timeline; inviting lives in the onboarding setup steps

- status: triaged
- prd: onboarding-3
- owner:
- commit:

- 2026-11-23 (Robert Bo Davis): From the user, 2026-11-23: the 'invite someone' notice at the top of the Timeline should move out of the page and into the onboarding flow. Today the setup card (GettingStartedCard.tsx) already has an 'Invite someone to help' step for owners and admins, but line 137-138 falls back to InviteSomeoneCard after setup is dismissed or its 14 days end, so the notice comes back. Fix: drop the fallback and delete InviteSomeoneCard. Update what relies on data-invite-card: newGroup.browser.test.tsx, gettingStarted.browser.test.tsx, scripts/browser-checks/first-sync.spec.mjs, invites.spec.mjs. Note: the setup card itself still shows on the Timeline; moving it elsewhere would be a separate decision.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23 (testing on dev): replaces the fix above. Don't just delete the notice: move the Invite someone prompt into a toast, so no card sits on the Timeline. It belongs in the second onboarding PRD the user is about to triage; prd stays fixes-ui until that topic exists. Reuse the ui Toast (AddedMedicationToast.tsx is the pattern: timed, clears on navigation, one action). Same audience as today: an owner or admin who is the group's only member, after the setup card is dismissed or its 14 days end. Still open: what triggers the toast and how often it may return, so it doesn't appear on every Timeline visit. InviteSomeoneCard and the data-invite-card tests still need updating.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23: folded into B-670 (onboarding pages). Delete InviteSomeoneCard and its Timeline fallback; inviting becomes a step in the flow and the one 'Want help onboarding?' toast covers it. No separate invite toast. This replaces the earlier toast note.
- 2026-11-23 (Robert Bo Davis): User decision, 2026-11-23: replaces the earlier fold-in note. Delete InviteSomeoneCard and its Timeline fallback, and make inviting a toast nudge for the group's creator, not a page step in B-670. Its action opens group settings, members. Stops once the group has another member. Timing is decided in B-670.
- 2026-11-23 (Robert Bo Davis): User report 2026-11-23, no separate bug because the new onboarding replaces it: the current Invite someone onboarding item takes the user to their profile but does not open the invite-by-email form. When B-665 builds the invite toast nudge, its action must land on the invite form already open, not just the page.
- 2026-11-25 (plan/onboarding-2): Planned in onboarding-2 (2026-11-25): the invite nudge (slice 4) opens Members with ?invite=1, which opens the invite sheet (slice 3); InviteSomeoneCard and the setup card leave the Timeline in slice 6.
- 2026-11-25 (plan/onboarding-2): Moved to onboarding-3 (2026-11-25, the user's answer a245: keep onboarding-2 at six slices, invite nudge to onboarding-3). All of B-665 goes: the invite nudge (appended to onboarding-2's nudge scheduler), Members ?invite=1 opening the invite sheet, and deleting InviteSomeoneCard. Until then onboarding-2 keeps InviteSomeoneCard for a lone manager.

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
- 2026-11-25 (plan/onboarding-2): Planned in onboarding-2 (2026-11-25): setup pages, Later, the first-open redirect, and the help, first-entry and invite nudges. The connect-assistant nudge is split out as B-858 (onboarding-3). The setter is the group's earliest member while an owner (care_group.created_by is the system user for /join groups); state is user.preferences.groupSetup.
- 2026-11-25 (plan/onboarding-2): Update 2026-11-25: the invite nudge moved to onboarding-3 with B-665 (user's answer a245); onboarding-2 builds the pages, redirect, and the help and first-entry nudges.

### B-730 · bug · A magic-link or invite sign-in that lands while an offline sign-out is still pending has its new session ended by the next /app check (sign-in page guards it, other sign-in paths don't)

- status: triaged
- prd: sync-safety-2
- owner:
- commit:

- 2026-11-24 (prd/sync-safety): Found in sync-safety slice 4's hand-off (B-290): the caretook:sign-out-pending marker is finished by resolveUser, which signs out the new session too. Guard the magic-link and invite landings like sign-in.tsx's loader.
- 2026-11-25 (plan/sync-safety-2): Planned in plans/sync-safety-2-plan.md (2026-11-25): slice 1 B-295, slice 2 B-383/B-384, slice 3 B-387, slice 4 B-296/B-730.

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

### B-752 · bug · timelineJump.browser.test.tsx can hang a components shard in CI

- status: triaged
- prd: fixes-bug
- owner: prd/fixes-bug
- commit:

- 2026-11-24 (Robert Bo Davis): CI full run 45407562750 (prd/symptom-catalog, cbb5b074): components-2 printed its last line from this file at 13:55:18 (test 3, 'a fresh load of the URL scrolls...'), every other file in the shard finished by 13:58:05, then nothing until the job was cancelled at 14:10. It's the only one of the 187 component test files that never reported. No test timeout fired, so suspect a step that leaves the runner's page: the later tests use Back and history (tests 8-10). The rerun on the same commit (45411480362) passed. Fix the hang, don't rerun past it.
- 2026-11-24 (Robert Bo Davis): Triage: kept in fixes-bug (a CI hang in the timeline jump browser test).
- 2026-11-25 (slice/fixes-bug/68): Slice 68 (fixes-bug): no cause found in the file, no change made. CI log of job 138492364178: each test logs PowerSync's 'Multiple tab support' warning as its database opens; test 3 opened at 13:55:18.21, test 4 never did, so the stop is in test 3 or its afterEach, not the Back/history tests 8-10. Every await in test 3 and in openTimeline/settle/closeDevices is under Vitest's browser-side test or hook timer (15 s / its hook timeout), and the harness routes through createRoutesStub (a memory router), so Back never touches the runner's history and nothing in the file or the timeline screen navigates the frame (no location.* in the screen; entry.client's staleChunk isn't loaded). A timer that never fires means the tab's main thread stopped (a sync or microtask-only loop, or wa-sqlite on the main thread, useWebWorker:false) or the tester frame was lost; Chrome answers Vitest 5's websocket heartbeat from the network stack, so neither is detected. Not reproduced: 8 repeats of the whole file in both zone projects and 15 of test 3 alone all passed. No in-page timeout can catch this; the node-side watchdog of B-753 is what would fail it with its name. Only hang of its kind in the last 200 CI runs (the other two cancelled components runs were cancelled by hand at 6 min).
- 2026-11-25 (prd/fixes-bug): fixes-bug slice 68 (2026-11-25): no fix; the hang is in test 3 or its teardown (not the Back tests), not reproducible (file x8 both zones, test 3 x15). An in-page timeout can't catch a frozen page; wait for B-753's Node-side watchdog to name it if it recurs. Kept open, back to triaged.

### B-757 · chore · Slice check runs a slice's own component files only in Los Angeles: add web:components:ny for files in its include list

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (prd/test-health-2): From test-health-2 slice 6: scripts/loops/check-body.sh passes only --project web:components, so a slice touching timeline/medications/planner tests never sees New York until CI.

### B-759 · feature · Install-the-app tip on mobile browsers: a step in onboarding, then a dismissable tip at sign-in until installed or 'never show again'

- status: triaged
- prd: onboarding-3
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): From the user (2026-11-24). Show only in a mobile browser that isn't already running the installed app (display-mode: standalone / navigator.standalone). (1) Onboarding: when the setup flow runs on a mobile device, one step explains installing Caretook to the home screen. (2) Sign-in: each time the user signs in from a mobile browser that isn't the installed app, a dismissable tip. Dismiss means it comes back at the next sign-in; 'Never show me again' stops it for good (store it per user, e.g. in user preferences, so it holds across devices). Android: the button triggers the browser's install prompt (beforeinstallprompt). iOS can't be triggered: show the Share, Add to Home Screen steps. Why: the app is already installable (B-360: site.webmanifest, standalone, service worker) but nothing tells people; installing also protects the offline copy from iOS clearing storage of sites unused for about a week. Toast/tip may use B-669 the shared toast system.
- 2026-11-25 (plan/onboarding-2): Moved to onboarding-3 by the onboarding-2 planner (2026-11-25): onboarding-2 is at six slices. Its install step joins onboarding-2's setup pages (routes/app/groups/setup/) and the sign-in tip can use the two-action toast slice 4 adds.

### B-760 · feature · Connector: add_provider, so a member's own AI can add a provider (name, specialty or practice, phone, address)

- status: landed
- prd: connectors-3
- owner: prd/connectors-3
- commit: b73368af5

- 2026-11-24 (Robert Bo Davis): From the user (2026-11-24). Today the connector only lists providers (list_providers). Same fields and checks as the Add provider sheet; writer roles only; preview wording shared with quick entry like the other write tools. Small: provider fields are simple.

### B-761 · feature · Connector: add_medication, so a member's own AI can add a medication with its type and schedule

- status: landed
- prd: connectors-3
- owner: prd/connectors-3
- commit: 350cbf8a5

- 2026-11-24 (Robert Bo Davis): From the user (2026-11-24). Today the connector only lists medications (list_medications). Heavier than add_provider: type is required, a scheduled one needs times and a round (pass); the AI can ask the member for them, but the server validates through the same medication schemas and service as the Add medication sheet (medicationCreateZSchema). Writer roles only (no Easy helper). Consider prescriber/pharmacy by existing provider.

### B-772 · chore · Lighten the components tier: trim the New York zone run and slow component tests

- status: triaged
- prd: test-time-gates-2
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): 2026-11-24, follow-up to hotfix/components-shard-3 (third shard). Since test-health-2 (B-372) web:components:ny reruns 53 timeline/medications/planner files in every components run: shards went 471/474s -> 704/877s. Options: narrow NY_INCLUDE to the zone-sensitive files every run and leave the rest to the release tier's zone-components jobs; profile the slowest component files (timeline, planner) for shared world setup or waits. Keep the second zone's daily value for its screens.
- 2026-11-25 (Robert Bo Davis): 2026-11-25: components-2 now runs 10-12 min (others 6-9). Two causes: (1) Vitest shards by file count, so shard 2 holds most of the 30-60 s timeline/planner browser files, in both zones; (2) runner speed varies ~30% (fixes-bug cb856531 vs 1752fb85: same 92 files, 733 s vs 551 s, every file slower evenly). Add, on the user's word: a custom Vitest sequencer whose shard() balances files by past durations from the ci-results/components-*.json CI already writes (fallback: by count). Together with narrowing NY_INCLUDE this should put each shard near 6-7 min.
- 2026-11-25 (Robert Bo Davis): Moved to test-time-gates (user, 2026-11-26): the test runtime gate runs first, before the other fixes
- 2026-11-25 (plan/test-time-gates): Planned 2026-11-25 in plans/test-time-gates-prd.md and -plan.md (6 slices). B-781, B-370: slices 2-3. B-837: gates in slices 1, 2, 4, unit armed in 6. B-772: balanced shards in slice 5. B-837 and B-772 stay open for test-time-gates-2 (component fallback, quick check trim, arming components and quick).
- 2026-11-26 (prd/test-time-gates): test-time-gates slice 5 (e9244444): shards by durations, NY_INCLUDE narrowed to 6 files. Shards 314/320/375 s then 309 s on components-1 in the gate run; all over 300, so -2 needs a fourth shard or trims (timelineHeader 57 s, timelineSearch 41 s, medicationForm 31 s).
- 2026-11-26 (plan/test-time-gates-2): Planned 2026-11-26 in plans/test-time-gates-2-prd.md and -plan.md (3 slices): 1 four component shards; 2 the quiet rule judged on start load (user, a255), recover split, quick measured in a quiet window and armed; 3 durations refreshed, components armed. Each armed at <=275 s. Topic held after two skeptic send-backs (s55, s56).

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
- 2026-11-27 (prd/fixes-bug): Seen again 2026-11-27, fixes-bug wave 17 components run 45989155987 (afeee38c), quarantined (failed). The wave changed entry Back (B-936) but not the timeline opener this test uses.

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

### B-795 · chore · Clean Caretook's history of the orchestration tooling and its bloat

- status: triaged
- prd:
- owner:
- commit:

- 2026-11-24 (plan/orchestration-split): Filed 2026-11-24 from the orchestration-split planning: after the move (plans/orchestration-split-move.md). Rewrites a public repo's history and force-pushes dev, staging and main: only on the user's word, after Risa holds the history (git filter-repo).
- 2026-11-27 (Robert Bo Davis): risa-next moved to Risa with B-543 (2026-11-27); this item is Caretook's, so it waits with no topic until the user picks one.

### B-802 · bug · CI flake: invites.spec.mjs '3. reset a password by email › the new password signs in' failed once, passed on rerun

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-24 (Robert Bo Davis): Filed 2026-11-24 by the backlog session on the user's word. Candidate rc/20261125-0251 (abb7965d, from dev e7798575), CI run 45535937950 (PR #178): browser verdict flake; invites.spec.mjs:477 expect(...).toBe(...) failed, then passed on the job's one rerun. The candidate was promoted (staging 534f96af). Not reproduced; check whether it's a read-before-render race (fix it, don't rerun).

### B-808 · bug · Browser check ui.spec: the add sheet's surface can measure 0 by 0 under load

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (prd/planner-3): planner-3's lean browser suite (2026-11-25, load ~10 on 10 cores): ui.spec.mjs:83, '420 dark › add sheet: the full screen', the Symptom add sheet's surface measured width 0, height 0. Passed alone on a rerun (6s), same tip. Looks like a read-before-render race: the evaluate walks up to the first element with a background and measures it once its animations finish, without waiting for a non-zero box. Fix the wait (e.g. expect.poll on the box), not a retry. No planner-3 file touches the add sheet or ui.spec.
- 2026-11-25 (prd/fixes-ui): Seen again 2026-11-25 in fixes-ui wave 13's lean suite (420 dark, add sheet measured 0 by 0; load 14-22); the wave didn't touch the add sheet.
- 2026-11-26 (prd/tags): Seen again 2026-11-26 on prd/tags (no UI change), load ~10: 420 dark, height 0 vs 900; 2 of 4 runs failed.

### B-829 · question · Research: compare Care Book to Caring Village

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): From the inbox: Review feature sets and identify overlap, places where we can surpass them, and places where we already do.
- 2026-11-25 (Robert Bo Davis): Triage: competitor research (Care Book vs Caring Village) to feed positioning

### B-831 · feature · Inactive group scrub: a care group with no member sign-in for X days gets a cycle of reminder emails, then its data is scrubbed automatically

- status: triaged
- prd: data-rights-2
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User request 2026-11-25: a group none of whose members has signed in for the last X days starts a cycle of reminder emails, then an automatic data scrub of that group. Joins the data rights PRD (user's choice); plan after the Sat 2026-11-28 reset. Open for planning: X and the reminder schedule; who is emailed (owners, all members); what counts as activity (sign-in only, or sync and connector use); what a sign-in or reply does to the cycle; what is scrubbed (the group's rows, files, live notes, sync buckets, backups) and whether the group shell or accounts remain; audit trail; the cron (calendars' sweep pattern); staff override; and the promise in the privacy policy (B-358).
- 2026-11-25 (plan/data-rights): plan/data-rights (2026-11-25): moved to the follow-on data-rights-2 to keep data-rights at six slices; data-rights builds scrub-on-delete, hand-over, group and account deletion and kept consent evidence (plans/data-rights-prd.md, Out of scope). data-rights-2 also adds the retention sweep and removing Caretook's Google calendar on delete.

### B-836 · feature · Marketing site visual refresh to modern design standards (split from B-417; no screenshots or videos)

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-25 (plan/marketing-2): Split from B-417 when marketing-2 took its copy part (2026-11-25): the visual refresh B-417 also asked for, left for a later marketing topic.

### B-837 · change · Time limit gates for component tests, unit tests and the local quick check

- status: triaged
- prd: test-time-gates-2
- owner:
- commit:

- 2026-11-25 (prd/orchestration-split): From the inbox: 5 minute goal, 6 minute hard cutoff.
- 2026-11-25 (Robert Bo Davis): Widened 2026-11-25 (user): the local quick check now takes over 8 minutes on a low-load machine. Add a gate for it too: aim 5 minutes, warn past 5, fail past 6 (same as the component tests' 5-minute goal and 6-minute cutoff). Measure on a quiet machine, not under load (the load gate already holds slow runs back); report the slowest files on a breach so the fix is obvious. Related: B-772 (trims slow component tests, the likely first fix), B-781 (keeps check time apart from waits in --times/metrics), B-370 (guards the quick check always runs).
- 2026-11-25 (Robert Bo Davis): Widened again 2026-11-25 (user): the unit tests alone are over 6 minutes too. Gate each of the three (component tests, unit tests, the quick check) on its own with the same 5-minute goal and 6-minute cutoff, so a breach names which one grew.
- 2026-11-25 (Robert Bo Davis): Moved to test-time-gates (user, 2026-11-26): the test runtime gate runs first, before the other fixes
- 2026-11-25 (plan/test-time-gates): Planned 2026-11-25 in plans/test-time-gates-prd.md and -plan.md (6 slices). B-781, B-370: slices 2-3. B-837: gates in slices 1, 2, 4, unit armed in 6. B-772: balanced shards in slice 5. B-837 and B-772 stay open for test-time-gates-2 (component fallback, quick check trim, arming components and quick).
- 2026-11-26 (prd/test-time-gates): test-time-gates landed e9244444 (2026-11-26): unit armed (CI unit-1 138 s, unit-2 123 s); components and quick still unarmed, for test-time-gates-2.
- 2026-11-26 (plan/test-time-gates-2): Planned 2026-11-26 in plans/test-time-gates-2-prd.md and -plan.md (3 slices): 1 four component shards; 2 the quiet rule judged on start load (user, a255), recover split, quick measured in a quiet window and armed; 3 durations refreshed, components armed. Each armed at <=275 s. Topic held after two skeptic send-backs (s55, s56).

### B-839 · bug · Search rebuild timing test flaked on CI (2,000 entries under 2 s)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): search.sync.browser.test.tsx's timing case failed once in components-2 on candidate run 45672578898 (77d9d75a) and passed on rerun; on the brake list (*.sync.browser.test.tsx), so it refused promote. A rerun on the same tip was green (45675167795). Triage: fixes-tooling (a CI-load timing bound, not a sync bug); loosen or move the bound off the brake path.

### B-851 · chore · Check plan: a rule for scripts/build/ (hand-run build scripts such as share-image.mjs), so a new one doesn't push the proposed tier to full

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): from marketing-2's landing, 2026-11-25: tier proposed full only for scripts/build/share-image.mjs

### B-852 · bug · Marketing banned-phrase test misses competitor names and the contact, header and footer strings

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-25 (prd/marketing-2): From the marketing-2 land skeptic (2026-11-25): apps/web/app/routes/marketing/site/claims.test.ts has no competitor-name pattern though the PRD bans them, and contact/content.ts plus the header and footer strings are outside SOURCES (clean today). Also ProseContent.placeholder and the 'To be written' badge are now unused.

### B-853 · chore · Connect ChatGPT (Developer mode) and Claude to a care group by hand on staging before the marketing link is shared

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-25 (prd/marketing-2): From the marketing-2 landing (2026-11-25, the user's word): features and the FAQ say you can connect your own Claude or ChatGPT; docs/domain/connectors.md and ops/runbook.md still list the by-hand connect as not done, and connectGuide.ts says ChatGPT needs Developer mode under Advanced settings on the web. Check on staging; narrow the ChatGPT wording if it doesn't hold.

### B-854 · chore · Confirm Google OAuth verification before the marketing link is shared (Google Calendar connect works only for test users until then)

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-25 (prd/marketing-2): From the marketing-2 landing (2026-11-25, the user's word): /features says 'or connect Google Calendar'; ops/runbook.md says until Google verifies the app, only added test users can connect. Check the production OAuth app's status on staging and production; drop the mention if it isn't verified when the link goes out.

### B-855 · change · Home hero: cut the remaining marketing speak (follow-up to the full-logo hero hotfix)

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User 2026-11-26: 'way too much marketing speak in that hero'; the hotfix removes the 'Keep track of someone's care, together.' heading, the rest of the trim is this item

### B-858 · feature · Connect your AI assistant setup nudge: the last onboarding toast, opening group settings Assistants

- status: triaged
- prd: onboarding-3
- owner:
- commit:

- 2026-11-25 (plan/onboarding-2): Split from B-670 by the onboarding-2 planner (2026-11-25) to keep onboarding-2 at six slices. From B-670: the last nudge after help, first entry and invite; same rules (one at a time, login plus hourly, Don't ask again moves on after the small wait); action opens appUrls.groupSettings(id, 'assistants'); only points there (switch off by default, /connect consent unchanged). Done = this member has a live grant for the group; connector_grant isn't synced, so read it online (connector.listMine exists) and skip the nudge when unknown (offline). Show only while the creator is still owner. Builds on onboarding-2's nudge scheduler (append to its list) and two-action toast.

### B-859 · change · Test time limits, part 2: component shard fallback, quick check under 5 minutes, arm the components and quick gates

- status: triaged
- prd: test-time-gates-2
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): User 2026-11-25: queue right after test-time-gates, faster tests speed up everything. Scope moved out of test-time-gates (plans/test-time-gates-prd.md, Out of scope): a 4th component shard or trims of the slowest timeline/planner files if balancing leaves one over 5 min; trim the quick check from the step times test-time-gates records (tooling step split, integration beside unit); then arm components and quick. Continues B-837 and B-772.
- 2026-11-25 (Robert Bo Davis): Filed by the backlog session; queued right after test-time-gates
- 2026-11-26 (plan/test-time-gates-2): Planned 2026-11-26 in plans/test-time-gates-2-prd.md and -plan.md (3 slices): 1 four component shards; 2 the quiet rule judged on start load (user, a255), recover split, quick measured in a quiet window and armed; 3 durations refreshed, components armed. Each armed at <=275 s. Topic held after two skeptic send-backs (s55, s56).

### B-861 · feature · Connector: tags and tagging (list tags, filter by a tag, add and remove tags on records) for groups…

- status: triaged
- prd: connectors-5
- owner:
- commit:

- 2026-11-25 (Robert Bo Davis): From the inbox: Connector: tags and tagging (list tags, filter by a tag, add and remove tags on records) for groups that have turned on sharing medical information with connectors / The user's word 2026-11-25: connectors DO need tags when the group shares medical information; the tags PRD (B-548) keeps them out, so this follows it.
- 2026-11-25 (Robert Bo Davis): Connector tag tools follow in connectors-5 (B-861), gated on the group's medical-information sharing (the user, 2026-11-25)

### B-863 · chore · CI's unit shards balance by file count: widen shards.mjs's SHARD_JOB to the unit-N jobs and refresh component-durations.json from a unit run (predicted 344/288 s of file time against 316/316 balanced)

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-26 (prd/test-time-gates): From test-time-gates slice 6's fix (run 45760087788: unit-1 138 s, unit-2 123 s).
- 2026-11-26 (Robert Bo Davis): Risa tooling: held with fixes-tooling for the work account (the user, 2026-11-26)

### B-887 · change · Features page "Type it the way you'd say it" section should highlight more that users can just say…

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): From the inbox: Features page "Type it the way you'd say it" section should highlight more that users can just say it with their phone's built-in dictation / Move this section so it's the first item after the timeline on the features page.
- 2026-11-26 (Robert Bo Davis): Triage: Features page copy; marketing topic (held), beside the visual refresh B-836.

### B-888 · change · Features page should highlight easy mode

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): Triage: Features page copy; marketing topic (held), beside the visual refresh B-836.

### B-890 · feature · Manage the group's symptom catalog under group settings: archive or delete; delete makes you pick a replacement symptom

- status: landed
- prd: symptom-catalog-2
- owner: prd/symptom-catalog-2
- commit: 1b74a52ea

- 2026-11-26 (Robert Bo Davis): User's word 2026-11-26: a management screen under group settings for the symptom catalog (symptom_type). Archive: hidden from pickers and new-name matching, history kept. Delete: must pick a replacement symptom; existing entries move to it (symptom_type_id and name, synced, audited). Today only list/ensure/add/backfill exist (symptomTypeService). Open for the planner: who may manage (owners only or writers), defaults deletable, archived names in filters and summaries, unarchive. New topic symptom-catalog (timeline area).
- 2026-11-26 (Robert Bo Davis): Moved to symptom-catalog-2: symptom-catalog (which built the catalog) is done.
- 2026-11-26 (plan/symptom-catalog-2): Planned in symptom-catalog-2 (plans/symptom-catalog-2-prd.md): archive, unarchive and the Symptoms page here; the delete-with-replacement half split off as B-920 (symptom-catalog-3).

### B-891 · feature · Tags management page under group settings: list, rename, delete (and merge?) the group's tags

- status: landed
- prd: tags-3
- owner: prd/tags-3
- commit: 964cfbcf2

- 2026-11-26 (Robert Bo Davis): User's word 2026-11-26: a tags page in group settings. Today rename and delete live only inside the tag picker (TagEditor, owners delete with a count); no page lists the group's tags. Planner: who sees the page (rename per canRenameTag, delete owners), uses per tag, whether to add merge (tags.md Limits: no merge today).
- 2026-11-26 (plan/tags-2): Planned in plans/tags-3-plan.md, the follow-on of tags-2 (cut to keep each topic about six slices): copy link into ⋯, the Tags page, merge, search by tag

### B-895 · feature · Search: tags as a filter you can see and tap (not a dropdown), and typed text that matches a tag's name finds the items carrying it

- status: landed
- prd: tags-3
- owner: prd/tags-3
- commit: 4138c986e

- 2026-11-26 (Robert Bo Davis): User's word 2026-11-26: the search page's tag filter (TagField.tsx, a native select, 'Any tag') isn't great. Ideas: list the group's tags as tappable chips (filter box when many), with colors from B-893. And plain search text matching a tag name (tagKey fold, maybe prefix) returns that tag's items with no tag picked; today tags never reach the index (search.sync.ts, a record_tag subquery only under ?tag=). Planner: rank tag matches with text matches, show the matched tag on results.
- 2026-11-26 (plan/tags-2): Planned in plans/tags-3-plan.md, the follow-on of tags-2 (cut to keep each topic about six slices): copy link into ⋯, the Tags page, merge, search by tag

### B-896 · feature · Quick entry cheat sheet and vocabulary pages, linked from quick entry (and onboarding), so people learn everything it understands without guessing; just before launch

- status: triaged
- prd: onboarding-3
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): User's word 2026-11-26: two pages, an 'ez entry cheatsheet' (examples by kind: vitals, symptoms, doses, notes, events, passes, todos; times, units, several at once) and an 'ez entry vocabulary' (the words and units it knows). Link from quick entry itself and somewhere sensible (help, onboarding). Build from the parser's own tables (schema/quickEntry.ts) or test them against it, so the pages can't drift. Timing: just before launch, once the parser settles. Triage: onboarding-3 (held), with the other learn-the-app nudges.

### B-898 · change · Quick entry should use the similar symptom by default on Enter, with an option to add new instead,…

- status: landed
- prd: symptom-catalog-2
- owner: prd/symptom-catalog-2
- commit: 284076ebd

- 2026-11-26 (Robert Bo Davis): From the inbox: Quick entry should use the similar symptom by default on Enter, with an option to add new instead, rather than waiting for a button click to confirm
- 2026-11-26 (Robert Bo Davis): Triage: symptom matching in quick entry belongs with the symptom catalog follow-up
- 2026-11-26 (plan/symptom-catalog-2): Planned in symptom-catalog-2 slice 2: Enter saves the closest similar name, the card offers the others and 'Add as new'.

### B-901 · plan · Onboarding plan for invited users, based on their user type (we already have one for care group…

- status: triaged
- prd: onboarding-3
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): From the inbox: Onboarding plan for invited users, based on their user type (we already have one for care group creators)
- 2026-11-26 (Robert Bo Davis): Triage: onboarding for invited members by user type; beside the other onboarding-3 items (held)

### B-907 · change · Tests: drop assertions that pin fixed UI copy word for word

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): About 50 app test files assert exact wording. Keep the ones testing text the code builds (dose counts, repeat labels, dates) and legally versioned text (waitlist consent). Replace plain fixed-label pins with role/structure checks. User's word 2026-11-26: copy changes shouldn't mean editing tests.
- 2026-11-27 (Robert Bo Davis): Triaged 2026-11-27: test-only change, fixes-tooling (the no-word-for-word-copy rule; legal consent text excepted)

### B-917 · feature · Connector: a member's AI reads a photo of a hand-filled weekly medication sheet and logs its doses, adding only what isn't already logged

- status: landed
- prd: connectors-3
- owner: prd/connectors-3
- commit: 350cbf8a5

- 2026-11-26 (Robert Bo Davis): The client AI does the vision; we need tools for it: read a past range's dose slots with their states (doseSlotsBetween; cf. B-252), and log doses for past slots in one batch (log_dose takes today's slot ids today), reporting per slot: added, already logged, or conflicts (paper says refused, app says given) to ask the member about. Needs the printed sheet's skip/refuse marks; the sheet could carry the week start and pass names so slots map cleanly.
- 2026-11-27 (prd/connectors-3): Slice 4 (past_doses) merged as 701a96e62; slice 6 (log_past_doses) still to come

### B-918 · feature · Printed care booklet: the profile (allergies, conditions) as the front page, then the medication list, weekly sheet and other sheets; print all of it or only the pages that changed

- status: triaged
- prd: care-booklet
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): User 2026-11-26: likely direction for printing. Front page from the profile carries allergies and conditions (so they leave the weekly sheet, B-916). Print the whole booklet or single updated pages. Not yet a registry row: no PRD until the user asks.

### B-919 · feature · Printed medication guide page for each medication, as booklet pages

- status: triaged
- prd: care-booklet
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): User 2026-11-26: WAY off; after the care booklet. Needs a source for guide content (vendor or member-written) and a look at what we may print.

### B-920 · feature · Delete a symptom on the Symptoms page by picking a replacement: entries move to it, and the deleted name keeps pointing there (B-890's delete half)

- status: triaged
- prd: symptom-catalog-3
- owner:
- commit:

- 2026-11-26 (plan/symptom-catalog-2): Split from B-890 by the symptom-catalog-2 planner (2026-11-26): B-890's archive half and the page are symptom-catalog-2; the delete half is symptom-catalog-3 so each topic stays about six slices. PRD: plans/symptom-catalog-2-prd.md; plan: plans/symptom-catalog-3-plan.md.

### B-921 · bug · CI flake: apps/web/app/routes/app/groups/timeline/timelineTags.browser.test.tsx: tagging an entry a writer applies, rem…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): [ci-key 6efb926e1a4d] Flaked (passed on its rerun); found by prd/orchestration-split-3. First failure: AssertionError: expected '+1' to be null at http://127.0.0.1:36287/home/runner/work/caretook.com/caretook.com/apps/web/app/routes/app/groups/timeline/timelineTags.browser.test.tsx?import&browserv=1812567600000:129:25 at async http://127.0.0.1:36287/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce3393e3/deps/plugins.DPQHVT0p-BV8Vq--D.js?v=b6978a4e:5247:20
- 2026-11-27 (prd/tags-2): tags-2 slice 6 (e314f75b) renamed the quarantined test and made every '+N' check poll; passed alone with CARETOOK_QUARANTINE=run. Candidate to close once quarantine runs show it steady.

### B-922 · bug · Browser check ui.spec: 420 add sheet measures the sheet before it lays out (0×0), a read-before-render race

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-26 (prd/fixes-ui): fixes-ui wave 16 landing, 2026-11-26: ui.spec.mjs:83 '420 dark › add sheet: the full screen' got {top 0, left 0, width 0, height 0} (vw 0) under load ~20 on prd/fixes-ui 47084b66; passed alone twice right after. The walk up to the first non-transparent ancestor runs before the sheet has size; wait for a non-zero rect (expect.poll) before measuring. Log: .git/worktrees/fixes-ui/caretook-browser/ui-20261126-141150.log

### B-938 · feature · Interval schedules for medications and Med times: every N hours, changed often (hospice: PRN, then every 6 h, 4 h, 3 h), each next dose due from the last due time or from when it was given

- status: triaged
- prd: med-intervals
- owner:
- commit:

- 2026-11-26 (Robert Bo Davis): From the user 2026-11-26: on hospice, Med time groups and their frequency change quickly and often (PRN -> every 6 h -> every 4 h -> every 3 h), while some single meds stay every 12 h. Like a repeating todo, each next one is made when the last is due or given (the user picks which when setting the timing), not laid out ahead. Today (docs/domain/medications.md): a schedule is fixed daily clock slots (1-8, or a Med time) or as needed; Med times are named clock times; dueDoses computes due slots from scheduleHistory (nothing is pre-created), and schedule edits already write change entries. Gap: no every-N-hours rule, no anchor to the last given dose, no interval on a Med time; changing frequency must be a quick one-step edit with history kept. Planner questions: interval on the Med time vs on each med, the first dose's anchor, overdue and the weekly print sheet for interval meds, the Today card and Given all, the connector's add_medication (B-761). New topic med-intervals.
- 2026-11-27 (plan/med-intervals): Planned in plans/med-intervals-prd.md and -plan.md (7 slices: per-medication interval schedules). Interval Med times and as-needed Med times split to med-intervals-2 (B-981). Topic held after two plan send-backs (s78, s79), pending the user (ask a335).
- 2026-11-27 (plan/med-intervals): User (ask a335): keep the plan out until they have read it. Unlanded on branch plan/med-intervals (worktree .loops/plan-med-intervals), topic flagged hold.

### B-941 · feature · Todos page shows each parent with all its nested todos under it, at every level

- status: landed
- prd: todo-subtasks-3
- owner: prd/todo-subtasks-3
- commit: f0257bbd2

- 2026-11-27 (Robert Bo Davis): From the user 2026-11-27 ('it is rough': subtasks must be MUCH easier to add and see on the main Todos page). Today (docs/domain/todos.md, Subtasks): subtasks are added and seen only in the todo page's Subtasks band; lists show a parent with a progress mark and dated or assigned children on their own with 'Part of'; depth max 3; no repeat on a tree. This item: the main Todos list renders the tree (children under the parent, indented, every level), instead of only a progress mark and Part-of rows. Planner: collapse or not, how filters (mine, overdue, tags) treat a parent whose children match, the Planner and Today card.
- 2026-11-27 (Robert Bo Davis): From the user 2026-11-27: the same nested view goes on the todo's own page too, starting one level down (its children, their children), with the same + quick add at each level; it replaces the Subtasks band (TodoSubtasks) as the way to add subtasks.
- 2026-11-27 (Robert Bo Davis): The user 2026-11-27: the current nested todo management is almost unusable; treat this as a replacement of the subtask flow (todo page and list), not a polish.
- 2026-11-27 (plan/todo-subtasks-3): Planned 2026-11-27 in plans/todo-subtasks-3-plan.md (7 slices, 4 waves); no subtasks on calendars or the feed (user's word); reminders unchanged.
- 2026-11-27 (plan/todo-subtasks-3): Revised at the user's approval: trees everywhere (Todos page, todo page, Planner, Easy view), the Today card names the due step; 9 slices, 5 waves; split view later (B-964).

### B-942 · feature · Quick add a subtask at any level from the Todos list: a + on the row, type a title, Enter

- status: landed
- prd: todo-subtasks-3
- owner: prd/todo-subtasks-3
- commit: f0257bbd2

- 2026-11-27 (Robert Bo Davis): From the user 2026-11-27 ('it is rough': subtasks must be MUCH easier to add and see on the main Todos page). Today (docs/domain/todos.md, Subtasks): subtasks are added and seen only in the todo page's Subtasks band; lists show a parent with a progress mark and dated or assigned children on their own with 'Part of'; depth max 3; no repeat on a tree. This item: a + on each row (writers, not at max depth, not on a repeating todo) opens an inline title field; Enter adds it as a child and keeps the field for the next; everything else defaults (due date from B-943's rule).
- 2026-11-27 (Robert Bo Davis): From the user 2026-11-27: the same nested view goes on the todo's own page too, starting one level down (its children, their children), with the same + quick add at each level; it replaces the Subtasks band (TodoSubtasks) as the way to add subtasks.
- 2026-11-27 (Robert Bo Davis): The user 2026-11-27: the current nested todo management is almost unusable; treat this as a replacement of the subtask flow (todo page and list), not a polish.
- 2026-11-27 (Robert Bo Davis): User's word 2026-11-27 (shared UX rule, as for tags in B-955): quick add for todos and subtasks is ONE shared component everywhere it appears (the Todos list rows at any depth, the todo's own page, and B-948's entries and other linkable pages), same look and behavior, slightly tweaked per place (e.g. a row's compact form); an exception needs a good reason, written in the plan. Same idea as tags: an icon-only add button whose icon says what it adds, enough room from neighbors to avoid misclicks, controls only for whoever may add.
- 2026-11-27 (plan/todo-subtasks-3): Planned 2026-11-27 in plans/todo-subtasks-3-plan.md (7 slices, 4 waves); no subtasks on calendars or the feed (user's word); reminders unchanged.
- 2026-11-27 (plan/todo-subtasks-3): Revised at the user's approval: trees everywhere (Todos page, todo page, Planner, Easy view), the Today card names the due step; 9 slices, 5 waves; split view later (B-964).

### B-943 · feature · Subtask due dates: a child inherits its parent's due date by default and can't be due after it; children list by due date, then by when they were made

- status: landed
- prd: todo-subtasks-3
- owner: prd/todo-subtasks-3
- commit: f0257bbd2

- 2026-11-27 (Robert Bo Davis): From the user 2026-11-27 ('it is rough': subtasks must be MUCH easier to add and see on the main Todos page). Today (docs/domain/todos.md, Subtasks): subtasks are added and seen only in the todo page's Subtasks band; lists show a parent with a progress mark and dated or assigned children on their own with 'Part of'; depth max 3; no repeat on a tree. This item: a new child takes the parent's due date; a child's due date must not be after the parent's (enforce in the service and on the device; decide on-the-day vs strictly before, and what happens to children when the parent's date moves earlier); siblings sort by due date ascending, undated ones by created ascending (planner: dated first or undated first).
- 2026-11-27 (Robert Bo Davis): The user 2026-11-27: the current nested todo management is almost unusable; treat this as a replacement of the subtask flow (todo page and list), not a polish.
- 2026-11-27 (plan/todo-subtasks-3): Planned 2026-11-27 in plans/todo-subtasks-3-plan.md (7 slices, 4 waves); no subtasks on calendars or the feed (user's word); reminders unchanged.
- 2026-11-27 (plan/todo-subtasks-3): Revised at the user's approval: trees everywhere (Todos page, todo page, Planner, Easy view), the Today card names the due step; 9 slices, 5 waves; split view later (B-964).

### B-944 · feature · One 'Link to…' box replaces the todo's separate provider, event, medication and note pickers: backed by site search limited to linkable types; each result shows its type icon and a second line (event date, provider specialty, med dose)

- status: in-progress
- prd: todo-links
- owner: prd/todo-links
- commit:

- 2026-11-27 (Robert Bo Davis): User 2026-11-27: todo-to-entry linking is rough; filed from the backlog session
- 2026-11-27 (plan/todo-links): Planned 2026-11-27 in plans/todo-links-plan.md (6 slices, 3 waves): one Link to… box on site search, chips and type words, phone and linked conditions indexed, suggestions, quick add on linkable pages; one provider/medication slot kept (ask a330, decided).

### B-945 · feature · Link picker type filter: tappable type chips above the box (All, Providers, Events, Meds, Notes, like B-895's tag filter); a typed type word ('provider lee', 'med', 'appt') turns its chip on and keeps filtering on the rest

- status: in-progress
- prd: todo-links
- owner: prd/todo-links
- commit:

- 2026-11-27 (Robert Bo Davis): User 2026-11-27: todo-to-entry linking is rough; filed from the backlog session
- 2026-11-27 (plan/todo-links): Planned 2026-11-27 in plans/todo-links-plan.md (6 slices, 3 waves): one Link to… box on site search, chips and type words, phone and linked conditions indexed, suggestions, quick add on linkable pages; one provider/medication slot kept (ask a330, decided).

### B-946 · feature · Link picker matches more than names: provider practice, specialty, phone; med brand names (B-939) and conditions; event place and provider; note text; tags; ranked like site search

- status: in-progress
- prd: todo-links
- owner: prd/todo-links
- commit:

- 2026-11-27 (Robert Bo Davis): User 2026-11-27: todo-to-entry linking is rough; filed from the backlog session
- 2026-11-27 (plan/todo-links): Planned 2026-11-27 in plans/todo-links-plan.md (6 slices, 3 waves): one Link to… box on site search, chips and type words, phone and linked conditions indexed, suggestions, quick add on linkable pages; one provider/medication slot kept (ask a330, decided).

### B-947 · feature · Link picker empty state: before typing, suggest likely picks (upcoming events, recently viewed, the entry or provider you came from)

- status: in-progress
- prd: todo-links
- owner: prd/todo-links
- commit:

- 2026-11-27 (Robert Bo Davis): User 2026-11-27: todo-to-entry linking is rough; filed from the backlog session
- 2026-11-27 (plan/todo-links): Planned 2026-11-27 in plans/todo-links-plan.md (6 slices, 3 waves): one Link to… box on site search, chips and type words, phone and linked conditions indexed, suggestions, quick add on linkable pages; one provider/medication slot kept (ask a330, decided).

### B-948 · feature · Quick add a todo or subtask from a timeline entry and any other linkable page (provider, medication, event) without leaving it, linked automatically; reuse B-942's quick add part

- status: landed
- prd: todo-links
- owner: prd/todo-links
- commit: b7fb8d218

- 2026-11-27 (Robert Bo Davis): User 2026-11-27: todo-to-entry linking is rough; filed from the backlog session
- 2026-11-27 (Robert Bo Davis): User's word 2026-11-27 (shared UX rule, as for tags in B-955): quick add for todos and subtasks is ONE shared component everywhere it appears (the Todos list rows at any depth, the todo's own page, and B-948's entries and other linkable pages), same look and behavior, slightly tweaked per place (e.g. a row's compact form); an exception needs a good reason, written in the plan. Same idea as tags: an icon-only add button whose icon says what it adds, enough room from neighbors to avoid misclicks, controls only for whoever may add.
- 2026-11-27 (plan/todo-links): Planned 2026-11-27 in plans/todo-links-plan.md (6 slices, 3 waves): one Link to… box on site search, chips and type words, phone and linked conditions indexed, suggestions, quick add on linkable pages; one provider/medication slot kept (ask a330, decided).

### B-949 · bug · CI flake: apps/web/app/components/ui/sheetExit.browser.test.tsx: closed by navigating with reduced motion Back complete…

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-27 (Robert Bo Davis): [ci-key fd7fd0937a02] Flaked (passed on its rerun); found by prd/tags-2. First failure: AssertionError: expected '/sheet' to be '/' // Object.is equality at http://127.0.0.1:41401/home/runner/work/caretook.com/caretook.com/apps/web/app/components/ui/sheetExit.browser.test.tsx?import&browserv=1812567600000:336:22 at async http://127.0.0.1:41401/node_modules/.vite/vitest/58cf8ec96f1f9266cf3c45bffb8a3488ce3393e3/deps/plugins.DPQHVT0p-BV8Vq--D.js?v=affb89f5:5247:20

### B-950 · change · Move TimelineEntryRow (and useOpenTodoCounts) out of routes/app/groups/timeline into components/entry, so the provider page's LinkedEntries and QuickEntryCard stop importing another route's folder

- status: triaged
- prd: fixes-nit
- owner:
- commit:

- 2026-11-27 (prd/fixes-ui): From fixes-ui slice 103 (B-937): LinkedEntries now imports ../timeline/TimelineEntryRow and ../timeline/useOpenTodoCounts, against components.md's rule that a route never imports another route's folder; QuickEntryCard already did. Nothing enforces it.

### B-954 · bug · Browser checks and prd serve run on a stack whose applied migrations are behind the repo's, so a missing column fails a check far from its cause

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-27 (prd/fixes-bug): From fixes-bug slice 75 (B-951), 2026-11-27: the roundtrip tags failure was a stack without migration 0048 (tag.color) after a dev sync with no datastore:reset; every tag upload failed sync:failed and the server held 0:0. Wanted: pnpm prd browser (and prd serve) refuse, or warn, when the stack's applied migrations are behind packages/data's, naming pnpm datastore:reset.
- 2026-11-27 (prd/fixes-bug): Hit again 2026-11-27 on fixes-bug's own stack (loop1) at wave 17's browser checks: roundtrip failed with uploads waiting:2 on both devices; pnpm datastore:reset made it pass.

### B-955 · change · One tag control everywhere tags show: icon-only tag-plus Add button, × right beside the name, more room before Add, Undo toast on remove; list rows (Todos, Planner, providers, medications) get it too

- status: landed
- prd: tags-3
- owner: prd/tags-3
- commit: 4138c986e

- 2026-11-27 (Robert Bo Davis): User's word 2026-11-27: unified display everywhere tags are seen or added. Today: QuickTags compact (icon Plus, timeline rows only) is closest; pages and edit sheets show '+ Add tag' text; TodoRow, Planner UpcomingList, ProviderListItem, MedicationListItem render read-only TagChips (no add/remove even for writers; Planner keeps ⋯ Tags). Wanted: QuickTags with lucide TagPlus (already a dependency) as an icon-only button everywhere (name and tooltip stay 'Add tag'), rows max 2 + '+N', pages all; editing controls only for canTagRecord, chips alone otherwise (as now). × sits closer to the name in the pill (TagChips' pr-1/size-4 button); wider gap between the chip list and Add (gap-1 today) to avoid misclicks. Remove guard: untag at once, then the existing toast with undo ('Removed <name>' · Undo re-tags with the same derived link id); user chose undo over a confirm dialog or a two-tap. Drop Planner rows' ⋯ Tags once rows carry it. Filed as a new first slice of tags-3 (before its Tags page and search chips, which reuse it).

### B-961 · change · Shared displays audit: each record kind (timeline entry, medication, provider, todo, event) shows through one shared display on rows, cards, pages and sheets; list today's variants and merge them, exceptions written down

- status: triaged
- prd: shared-displays
- owner:
- commit:

- 2026-11-27 (Robert Bo Davis): User's word 2026-11-27: one look and one way per thing everywhere (docs/domain/components.md _Rules_, dev 90b1ecdb). Today timeline rows/cards, Planner rows, Todos rows, provider and medication list items and their pages each render their own way. First step: an inventory of the variants per record kind and the shared parts they could take (B-955 does tags; B-942/B-948 quick add todos). Needs a topic: likely its own PRD (touches most list and page screens), after tags-3 and todo-subtasks-3.

### B-964 · feature · View option to split todo trees into individual due todos (trees stay the default)

- status: triaged
- prd: todo-links-2
- owner:
- commit:

- 2026-11-27 (Robert Bo Davis): From the todo-subtasks-3 approval (2026-11-27): the user wants trees everywhere for now; this toggle comes later, after todo-subtasks-3.
- 2026-11-27 (Robert Bo Davis): Backlog session 2026-11-27: triaged to todo-links, the next todos topic, which runs after todo-subtasks-3 as the note asks.
- 2026-11-27 (plan/todo-links): Moved from todo-links to the follow-on topic todo-links-2 (2026-11-27 planner): unrelated to links, keeps todo-links at six slices (preference: cut into follow-on topics).

### B-965 · change · Group the tiny shared app helper chunks on the first /app load

- status: triaged
- prd: fixes-perf
- owner:
- commit:

- 2026-11-27 (slice/fixes-perf/11): From fixes-perf slice 11 (B-960): after the icons group, the first /app load still fetches ~74 shared app chunks under 2 KB (lib/, components/, packages/data schema helpers) plus ~22 tiny React Router route-chunk stubs. A plain codeSplitting group over app code doesn't work: a group takes its modules' dependencies (includeDependenciesRecursively), so an entriesAware group with a merge threshold dragged rrule and yjs into the /app shell and blew the entry to 209 KB gz. includeDependenciesRecursively: false needs preserveEntrySignatures 'allow-extension' or false, which React Router's client build overrides to 'exports-only' (INVALID_OPTION). Options: a Vite plugin hook setting preserveEntrySignatures for the client build (check React Router's route exports still hold) with strictExecutionOrder, or Rolldown's experimentalInlineCommonChunks (experimental). Measure with the slice-11 bench (HTTP/1.1 is where it pays).

### B-966 · change · Marketing and sign-in pages load the whole shared icons chunk (~5-10.5 KB gz) since slice 11 grouped lucide icons

- status: triaged
- prd: fixes-perf
- owner:
- commit:

- 2026-11-27 (prd/fixes-perf): From fixes-perf slice 11 (B-960, merge c81f220e): the client build's codeSplitting 'icons' group (apps/web/vite.config.ts) puts every lucide-react icon in one chunk (40 KB raw, 13.2 KB gz). Sign-in and marketing pages that use one or two icons now fetch it: ~10.5 KB gz more on sign-in and marketing, ~5 KB on home/faq/about/features. The user: every KB there counts for Lighthouse and SEO. Fix: keep the icons group to /app routes only (e.g. a group test scoped to modules reached from app/routes/app/, or inline icons on public pages), then check Lighthouse on / and /sign-in and the budget (scripts/build/budget.json); budget's together: [lucide-react] rule may need scoping to the app group.

### B-967 · bug · Browser check layout-offline fails at 'offline: a row's edit link opens its edit sheet': the row's tag chips cover the Edit link's centre

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-27 (prd/fixes-perf): Found at the fixes-perf wave 2 landing (2026-11-27): fails 4/4 on prd/fixes-perf and also on the wave 1 tip (5fe538b8) with no wave 2 change, so it predates wave 2. scripts/browser-checks/layout-offline.spec.mjs ~166 clicks main ol a[aria-label^="Edit "] (an absolute inset-0 overlay); in the Full layout its centre lands on the row's tag-chip strip (div.flex.flex-wrap.items-center.gap-1 in div.min-w-0.flex-1.space-y-0.5) and the sticky [data-day-header], which intercept the click. Logs: .git/worktrees/fixes-perf-9/caretook-browser/layout-offline-20261127-083228.log and -083346.log. Fix: click the link clear of the chips (position), or check whether chips should pass clicks through to the row link (if users can't open a row by tapping its middle, it's a fixes-ui item instead).

### B-968 · bug · …: apps/web/app/routes/app/groups/settings/calendarGoogle.browser.test.tsx fails in America/New_York

- status: staging
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: d8ce4a4eb

- 2026-11-27 (Robert Bo Davis): [ci-key 05eeb40b7f34] [ci-zone 39b4beaf] Fails in America/New_York on 39b4beaf; reported, not blocking.

### B-969 · bug · CI: apps/web/app/routes/app/groups/settings/groupSettings.browser.test.tsx fails in America/New_York

- status: staging
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 641ecbb54

- 2026-11-27 (Robert Bo Davis): [ci-key 30b8d207bcc4] [ci-zone 39b4beaf] Fails in America/New_York on 39b4beaf; reported, not blocking.

### B-970 · bug · CI: scripts/browser-checks/layout-offline.spec.mjs fails in America/New_York

- status: staging
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 2375e2995

- 2026-11-27 (Robert Bo Davis): [ci-key 8b719e2e0ba0] [ci-zone 39b4beaf] Fails in America/New_York on 39b4beaf; reported, not blocking.
- 2026-11-27 (slice/fixes-bug/78): Not a zone bug: failed in LA too (same seeded dose row). QuickTags' full-width relative z-10 line covered the row's open target, so a tap beside the chips did nothing; now w-fit (slice 78, f18fdec55), proved by components/tags/quickTagsRow.browser.test.tsx.

### B-971 · bug · CI: scripts/browser-checks/roundtrip.spec.mjs fails in America/New_York

- status: staging
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 2375e2995

- 2026-11-27 (Robert Bo Davis): [ci-key 2f974a423a03] [ci-zone 39b4beaf] Fails in America/New_York on 39b4beaf; reported, not blocking.

### B-972 · feature · Tags tab on the planner: a unified view listing all tags and the items tagged with each

- status: triaged
- prd: tags-4
- owner:
- commit:

- 2026-11-27 (prd/fixes-ui): From the inbox: Has the common search/filter bar. Where possible, uses the shared component to display items in the list. Has condensed and full views, defaulting to condensed.

### B-974 · bug · Planner day trees: under a tag or text filter, a matching step and its unmatched parent due the same day rank at the parent's time (todoDayTrees' same-day lead can be a context row)

- status: landed
- prd: todo-subtasks-3
- owner: prd/todo-subtasks-3
- commit: f0257bbd2

- 2026-11-27 (prd/todo-subtasks-3): Codex on PR #263 (r4722833221): todoTreeView.ts todoDayTrees line ~125 returns lead: tree.todo when the top row is due that day even if it is a context row; plannerDayTrees ranks by it, so a child at 01:00 under a 23:00 parent ranks at 23:00, and across viewer/recipient zones can sit under the wrong day. Fix: pick the lead only from non-context todos due in that day view. Fold into slice 9 or a fixes slice.
- 2026-11-27 (prd/todo-subtasks-3): Proposed (wave 5 boundary): rides with slice 9 as an extra; it already edits lib/todos. Fix: lead only from non-context todos due that day.

### B-975 · change · Marketing home: AI providers 'will not' keep your data or train on it, not 'may not' (apps/web/app/routes/marketing/home/content.ts, the AI answer)

- status: triaged
- prd: fixes-ui
- owner:
- commit:

### B-976 · bug · Quick entry vitals in any order: '140/78 74bpm 97 o2' drops the O2 (only 'o2 97' works); HR/bpm the same, label before the number works, after doesn't. Very common entries: accept label before or after each number

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: d268a0ca5

### B-977 · feature · Human deploy path run from GitHub: a workflow_dispatch 'Deploy to staging' (cut a release candidate from dev, run the candidate tier, promote on green) and 'Deploy to production' (staging to main PR, release gate, merge), today only the local risa ci candidate cut / promote and pnpm prd ci release

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

### B-978 · bug · Installed PWA shows no update notice until it's closed and reopened

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: e524785a8

- 2026-11-27 (Robert Bo Davis): User report. Likely cause: serviceWorkerRegister.ts registers /sw.js once at load and relies on the browser's navigation-time update check; an installed PWA resumed from the background never navigates, so no updatefound fires and UpdateNotice stays hidden. Fix idea: call registration.update() when the page becomes visible (visibilitychange) and on a slow interval (e.g. hourly), throttled; test with the fake container in serviceWorkerRegister.test.ts. fixes-bug: wrong behaviour.

### B-979 · bug · Search results' tag chips keep a matching tag's old name or color after another device renames or recolors it (useSearchPage's refresh keys miss tag metadata)

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 336733f55

- 2026-11-27 (prd/tags-3): Codex on PR #271 (tags-3), verified: useSearchPage.ts reruns loadSearch on watched tag ids, linkKey and index changes, but not on a named tag's name or color; tags aren't an index change source, so result chips (data.namedTags) go stale while the filter chips update. Fix: add the matching tags' names and colors to the effect's deps (or read result chips from the live group tags by id).

### B-980 · bug · Subtask add button in the nested todo tree sits under the title; put it right-aligned on the title's line

- status: triaged
- prd: fixes-ui
- owner:
- commit:

- 2026-11-27 (Robert Bo Davis): User report. TodoRow.tsx renders the addSubtask slot (TodoTree's per-row compact TodoQuickAdd) under the row's text (lines ~159, 205, 245). Move it to the end of the title line, right-aligned, keeping its tap target room. TodoRow.tsx is a tags-3 hot file: small edit, sync dev first. fixes-ui: layout.

### B-981 · feature · Interval Med times: a Med time every N hours (from due or given) so a group's frequency changes in one edit, and as-needed Med times (B-938 part 2)

- status: triaged
- prd: med-intervals-2
- owner:
- commit:

- 2026-11-27 (plan/med-intervals): Split from B-938 by the med-intervals planner (2026-11-27): med-intervals builds the shared interval rule, intervalSlots engine and per-medication intervals; this adds the rule to medication_pass (a migration, a synced column, the device schema and sync-config), a passTimingChanged change entry, round anchoring for from-given Med times (round ids per instance), the Med time form, and as-needed Med times (skeptic a334 deferred them here). Plan it after med-intervals lands.

### B-982 · bug · past_doses reads doses with no upper bound, so a busy group's old days can show given doses as missed

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 2f63948f8

- 2026-11-27 (prd/connectors-3): Codex on PR #276 (pastDoses.ts:126): entriesBetween is called with only from (from-1 day), newest first, capped at 40 pages of 50; a group logging ~24 doses a day asking for a day 90 days back can exhaust it before reaching the window, and the missing doses read as missed. Fix: pass to = the start of the day after the range plus one (entriesBetween already takes to), and treat a full last page as incomplete (an isError or a note) rather than a complete record.

### B-983 · bug · Browser-check flake: ui.spec.mjs 'add sheet: the full screen' measured the Symptom sheet's surface at height 0 (expected 900) at 420px light and dark under load; passed alone

- status: triaged
- prd: fixes-tooling
- owner:
- commit:

- 2026-11-27 (prd/symptom-catalog-2): symptom-catalog-2 landing, 2026-11-27, load 15-19: ui.spec.mjs:83 read the box before the sheet's open animation laid it out (read-before-render race). Passed alone at once.

### B-984 · bug · Two dose writes with different statuses for one slot at once can both be added (log_past_doses and log_dose lock a status-dependent id)

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 52fc5653d

- 2026-11-27 (prd/connectors-3): Codex on PR #278 (assistantActionService.ts:974): logPastDoses locks doseSlotIdFor's id, which includes the status, so a concurrent given and refused for the same slot both insert. The plan accepted this (log_dose has the same exposure). Fix: lock a status-free medication/day/slot key before reading doses, in both paths.
- 2026-11-27 (prd/fixes-bug): Slice 84: fixed in log_past_doses (status-free advisory lock lockDoseSlot). log_dose left as is: a different answer for an answered slot is its own row by design (mcpWrites test), so concurrent log_dose given+refused giving two rows matches sequential. give_pass still locks only the given id, unsorted; same as sequential.

### B-985 · bug · log_past_doses writes today's usual dose on past days when the medication's dose changed in the range

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 05735fc88

- 2026-11-27 (prd/connectors-3): Codex on PR #278 (assistantActionService.ts:1031): slot.amount comes from slotAmount, which falls back to the current medication's dose; scheduleHistory rebuilds the schedule but not the usual dose. Changing 1 tablet to 2 today and logging yesterday's box records 2. Fix: resolve the usual dose at the slot's time (from the medication-change entries) before writing; past_doses shows the same amount.
- 2026-11-27 (prd/fixes-bug): Slice 85: ScheduleHistory.doseAt; the fallback amount follows the slot's own moment, so Today shows an earlier same-day slot with the old dose too. weeklySheet.ts still uses today's dose (out of scope).

### B-986 · bug · log_past_doses sees only the first 100 medications, so marks for others come back noSlot

- status: landed
- prd: fixes-bug
- owner: prd/fixes-bug
- commit: 05735fc88

- 2026-11-27 (prd/connectors-3): Codex on PR #278 (assistantActionService.ts:936): medicationModel.list's paginate is clamped to MAX_PAGE_SIZE 100 (asked 500), and passes to 100, while past_doses (medicationService.list) reads all. Fix: load every page, or the medications the marks name.

### B-987 · bug · log_dose's pass read (slotDose, assistantActionService.ts ~405) pages at 100 with includeDeleted, so a group with over 100 passes ever made can miss a pass

- status: in-progress
- prd: fixes-bug
- owner: prd/fixes-bug
- commit:

- 2026-11-27 (prd/fixes-bug): From slice 86 (B-986) hand-off: medicationPassModel.list with includeDeleted and paginate limit 100 in slotDose; deleted passes are unbounded. Fix as B-986 did: drop paginate.

### B-988 · bug · Link to box: many matching doses, vitals, symptoms or cancelled events crowd out matching notes and events (entry hits are capped before the linkable-kind filter)

- status: in-progress
- prd: todo-links
- owner: prd/todo-links
- commit:

- 2026-11-27 (prd/todo-links): Codex P2 on PR #280 (linkSearch.sync.ts:127): searchGroup truncates the entry section before searchLinkables drops non-linkable kinds; the 5x overfetch can't guarantee results. Filter by kind before truncation or fetch until enough. Fits slice 3 (it extends searchLinkables) or a later slice.
- 2026-11-27 (prd/todo-links): fold into slice 3 (linkSearch.sync.ts)

### B-989 · bug · Link to box doesn't refresh an open tag-name search when a tag is renamed or a record is tagged or untagged

- status: in-progress
- prd: todo-links
- owner: prd/todo-links
- commit:

- 2026-11-27 (prd/todo-links): Codex P2 on PR #280 (useLinkSearch.ts:33): the hook reruns only on search index changes; tag and record_tag aren't index sources. Observe the group's tags and tag assignments as useSearchPage does. Fits slice 3 or a later slice.
- 2026-11-27 (prd/todo-links): fold into slice 3 (useLinkSearch.ts)
