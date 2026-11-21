# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

The PRD registry: **row order is the priority**. Edit it only with `pnpm backlog prd` (`add`, `set`, `move`); `pnpm backlog prd list` shows each topic's state (to-write, planned, running, idle, hold, done), worked out from git and the items. At most three PRD orchestrators run at once.

`Flags`: `hold` (waits on the user), `done`, `standing` (never finishes; runs while it has waiting items), `alone` (nothing else runs beside it). `After`: the topics it comes after. `Hot files`: repo path prefixes it shares.

| PRD | Flags | After | Hot files | Doc and notes |
| --- | ----- | ----- | --------- | ------------- |
| `orchestration` | done | — | — | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): **done** (`94e6b80`) |
| `live-notes-ux` | done | — | — | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done** |
| `quick-fixes` | standing | — | — | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–46 in `dev` (44–46: B-135, B-134, B-157 in `2d57e70`); wave 13 (slices 47–51: B-184 to B-190) in `dev` (`bf0891df`); wave 14 (slices 52–57: B-192, B-198, B-201, B-191, B-174, B-175) in `dev`; wave 15 (B-180, B-182, B-225, B-211) in `dev` (`2152bbed`; B-207 landed as hotfix `fc373a34`); wave 16 (B-228, B-230, B-232 to B-235, B-237, B-238) in `dev` (`5a47c18f`, PR #20); the next wave is **running**; new fixes append as the next slice · Hot files: varies by slice; none now |
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
| `marketing` | hold | — | — | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user |
| `profiles` | done | — | — | [PRD](profiles-prd.md), [plan](profiles-plan.md): **done** (`88890df`) |
| `appointments` | done | — | — | [PRD](appointments-prd.md), [plan](appointments-plan.md): **done** |
| `care-periods` | done | — | — | [PRD](care-periods-prd.md), [plan](care-periods-plan.md): **done** (`f6c4e92`) |
| `data-rights` | — | — | `packages/api/`, `apps/web/app/lib/sync/client.ts`, `packages/auth/` | to write (B-52, B-53, B-84) · Hot files: `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `ui-kit` | — | — | `apps/web/app/components/ui/`, `apps/web/app/app.css`, `apps/web/app/components/settings/`, `apps/web/app/routes/sign-in.tsx`, `apps/web/app/routes/app/layout/SectionNav.tsx` | [PRD](ui-kit-prd.md), [plan](ui-kit-plan.md) (B-257 to B-267, B-270, B-396, B-397, B-399): 7 slices, waves 1 → (2, 3, 4) → (5, 6) → 7: a dev gallery at `/dev/ui`, Button and the form footer; the pill tab bar (medications, Planner, sign-in) and the phone's floating, icon-only bottom bar; messages, empty and loading states and Badge; text tokens, the page container and one heading scale; Card, lists, check and toggle fields; the detail header and full-width section bands on the medication, provider, care period and to-do pages, then the profile. Each primitive is adopted in settings, sign-in or the detail pages; the rest of the app is `ui-kit-2`. No migration, no deps; stackless but for slice 2 (two browser checks). **Ready to start** · Depends on: (none): `list-filters` and `planner-2` are in `dev`; never beside `i18n`; `quick-fixes` between waves · Hot files: `components/ui/` (its `index.ts`, `styles.ts`, `plain/`, `TabNav`, `PageHeader`, `Field`), `app.css`, `components/settings/`, the settings route folders, `routes/sign-in.tsx` and the account card, the dev routes part, the outer `main` and `h1` of `/app` pages outside the timeline and entry folders, the five detail-page folders, `LinkedTodos`, `AllergiesRegion`; `routes/app/layout/SectionNav.tsx` and the bar's locator in `app-shell.spec.mjs` (`test-health` slice 12 rewrites that spec) and `roundtrip.spec.mjs` |
| `ui-kit-2` | — | `ui-kit` | `eslint.config.js` | to write (B-398, B-268, B-269): every remaining area swept onto the kit, one area per slice (medications; providers, profile forms and care periods; the Planner, to-dos and search; the timeline, entries and quick entry; admin, account, connectors, marketing and the app frame), the three-choice dialog, then the lint guard · Depends on: `ui-kit` in `dev` (last items B-264, B-397); never beside `i18n`; before `test-health` waves 5 to 7 · Hot files: most route and component folders, one area per slice and nothing else running in that area; `eslint.config.js` (the guard) |
| `check-speed` | — | — | `scripts/loops/`, `vitest.config.ts`, `package.json`, `packages/data/test/` | [PRD](check-speed-prd.md), [plan](check-speed-plan.md) (B-271, B-272, B-273, B-278): 4 slices, waves (1, 2) → (3, 4): every check through two check leases and into a check log (`pnpm prd check --times`), tooling tests in their own Vitest project, quick check at hand-off with the full check once per landing, integration tests on three workers with a database each. No load gate. Measured 2026-11-21: a full test run takes about 11 minutes and five PRDs made 39 of them · Hot files: `scripts/loops/` (`prd.sh` `check`, `prompt.sh`, `lease.sh`, `test-db.sh`, `rm.sh`), `vitest.config.ts`, `package.json`, `packages/data/test/`, `testDatabase.ts` |
| `test-health` | — | `check-speed`, `orchestration-2` | `vitest.config.ts`, `package.json`, `eslint.config.js`, `scripts/loops/`, `apps/web/test/`, `packages/data/test/`, `scripts/browser-checks/` | [PRD](test-health-prd.md), [plan](test-health-plan.md) (B-274 to B-277, B-279 to B-283): 15 slices in 7 waves (slices 1, 2, 6 and 7 moved to `check-speed`), landing wave by wave. Waves 1 to 4: browser-check bookkeeping, the component harness (clock, one timeout, `getByCss`, lint rules as warnings) and the unit, server and Playwright cuts. Then it pauses; waves 5 to 7 are the component cuts, the area-by-area harness migration and the rules becoming errors · Depends on: `check-speed` in `dev` before slice 11 (worker databases; last item B-278), and better before any of it (quick hand-off checks); otherwise (none) for waves 1 to 4; waves 5 to 7 (slices 14 to 19) after `list-filters`, `planner-2` and `ui-kit` (they edit the same screens' tests); `quick-fixes` between waves · Hot files: `vitest.config.ts`, `package.json`, `eslint.config.js`, `scripts/loops/` (`prd.sh`, `prompt.sh`, `lease.sh`, `checks`, `check-areas.mjs`, `check-areas.d/`, `test-db.sh`), `apps/web/test/` (`setup.ts`, `found.ts`), `packages/data/test/`, `scripts/browser-checks/` (the specs, `fixtures.mjs`), the frozen-list tests; from wave 5 the `*World.tsx` files and component tests in every area, one area per slice |
| `tasks` | done | — | — | [PRD](tasks-prd.md), [plan](tasks-plan.md): **done** (`1ee7864`) |
| `documents` | hold | `encryption` | — | to write (B-56) · Depends on: hosting (B-33, file storage); `profiles` (soft); `encryption` decision · Hot files: file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS` |
| `encryption` | hold | — | — | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 · Depends on: (none); affects `assistant` and `documents` · Hot files: none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `onboarding` | — | — | — | to write (B-31) · Depends on: `invites` (done) · Hot files: seeds, `careGroupService`, `/app` home |
| `account-security` | — | — | `packages/auth/` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) · Depends on: `invites` (done); B-80 (the Devices page) first (soft) · Hot files: `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `admin` | done | — | — | [PRD](admin-prd.md), [plan](admin-plan.md): **done** |
| `check-migration` | done | — | — | [PRD](check-migration-prd.md), [plan](check-migration-plan.md): **done** (`c7fd1390`) |
| `loop-recovery` | done | — | — | [PRD](loop-recovery-prd.md), [plan](loop-recovery-plan.md): **done** |
| `hosting` | hold | — | — | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent |
| `app-speed` | done | — | — | [PRD](app-speed-prd.md), [plan](app-speed-plan.md): **folded into `timeline-ux`** (its PRD is the speed half's input) |
| `agent-tooling` | done | — | — | [PRD](agent-tooling-prd.md), [plan](agent-tooling-plan.md): **done**, all 6 slices in `dev` (`5d5e1d7`): batched backlog commits, `pnpm log`, the doc budget guard, the core + `docs/agents/` split, the six area docs trimmed |
| `code-layout` | done | — | — | [PRD](code-layout-prd.md), [plan](code-layout-plan.md): **done** (`18e9cf8`) |
| `timeline-ux` | done | — | — | [PRD](timeline-ux-prd.md) (speed half: [app-speed PRD](app-speed-prd.md)), [plan](timeline-ux-plan.md): 10 slices, waves (1, 2, 3) → (4, 5, 6) → (7, 8, 9) → 10: navigation that doesn't wait, tiles that remember (dimmed until fresh), the bundle budget, prefetched tabs, one Today card with status hues, the day header with its summary and rows with the author under the menu and no period places, the service worker, simple mode's order and type scale, quick entry's rotating placeholder, open-after-save and lean recent lines, cheaper `/rpc` auth (B-136–B-140, B-144, B-155, B-156, B-162–B-171). **Done 2026-11-20**: all 10 slices in `dev` (8b3179ab); follow-ups B-174, B-175, B-178, B-179 · Depends on: wave 1: none; wave 2 on: `code-layout` slice 5 in `dev` (`appUrls`), or coordinate with it · Hot files: `lib/auth/session.ts`, `lib/auth/sessionRules.ts`, `lib/app-shell/me.ts`, `lib/sync/` (the remembering hook), `recentLines` (at code-layout's paths), `SectionNav`, the `/app` layout (update notice), the timeline route, its strips (replaced by `TodayCard`), `DayHeader`, `DaySummaryLine`, the row components, `PeriodMarkerItem`, `SimpleTimeline`, quick entry, `packages/auth`, `packages/api/src/procedures.ts`, `routes/rpc.ts`, `scripts/loops/prd.sh`, `scripts/loops/check-areas.d/`, new `scripts/build/` |
| `i18n` | alone | `simple-mode` | `apps/web/app/components/`, `apps/web/app/lib/core/format.ts`, `packages/data/`, `apps/web/app/root.tsx`, `packages/notifications/`, `pnpm-workspace.yaml`, `scripts/build/budget.json` | [PRD](i18n-prd.md), [plan](i18n-plan.md): 11 slices, waves 1 → 2 → (3, 4, 5, 6) → (7, 8, 9, 10) → 11: a per-user language (English and Spanish, AI-drafted, review before launch) in `user.preferences` with a cookie for server rendering; typed catalogs on `i18next` and `react-i18next`; format helpers, error codes and label maps take the language; the app swept area by area; emails, the invite's language, calendar text and the public site at `/es/`; a lint rule against literal text (`eslint-plugin-i18next`, dev). Quick entry is a plain box for non-English users; search matching, the connector and `/admin` stay English (B-209). Slice 8 adds a migration (one nullable invite column); three dependencies approved 2026-11-21; slice 1 needs a stack. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248), the current `quick-fixes` wave and `simple-mode` (last items B-221, B-400) in `dev`; **runs alone** (tooling-only work beside it) · Hot files: every user-facing string: all `/app`, sign-in and marketing routes, `components/`, `lib/core/format.ts` and the other format helpers, the label maps in `packages/data` schema, `userPreferences.ts`, `root.tsx`, the service worker, `packages/notifications` templates and registry, the invite schema and service, `calendarText.ts`, ESLint config, `pnpm-workspace.yaml`, `scripts/build/budget.json` |
| `timeline-ux-2` | done | — | — | [PRD](timeline-ux-2-prd.md), [plan](timeline-ux-2-plan.md): **done** (`f1fc883e`) |
| `quick-entry` | done | — | — | [PRD](quick-entry-prd.md), [plan](quick-entry-plan.md): **done** (`c2ec7447`, PR #15) |
| `planner-2` | done | — | — | [PRD](planner-2-prd.md), [plan](planner-2-plan.md): **done** (`8069cf94`, `5a5c2fd6`); follow-ups B-382 to B-387, B-393 |
| `planner-3` | — | — | — | to write (B-245: a note can carry a todo with its own due day and assignee, the replacement for reminders; B-254: quick entry reads a repeating todo) · Depends on: `planner-2` in `dev` (last item B-248) · Hot files: the note editor and entry page, `todoService` and the todo schema (a link to its note), the Planner's todo rows, the Today card, the connector's `add_note` and `add_todo`; quick entry (B-254) |
| `connectors-3` | — | — | `packages/api/src/connectors/tools/` | to write (B-252: a connector tool to read the dosing schedule beyond today; B-253: `add_todo` can make a repeating todo) · Depends on: B-253 after `planner-2` in `dev` (last item B-248); B-252 has none · Hot files: `packages/api/src/connectors/tools/` (`todaysDoses.ts` or a new schedule tool, `writes.ts`), the server instructions |
| `simple-mode` | — | — | `apps/web/app/lib/assistant/simpleMode`, `packages/data/src/constants/roles.ts`, `packages/data/src/permissions/`, `powersync/sync-config.yaml` | [PRD](simple-mode-prd.md), [plan](simple-mode-plan.md): 5 slices, waves 1 → 2 → 3 → (4, 5): the lock becomes two member roles, Easy helper (log-only, own entries, own todos) and Easy viewer; "simple" is renamed "easy" everywhere, database included; the role decides the view; the Planner, todo pages and search open for the easy roles (B-221, B-236); the Easy mode toggle moves from the View options menu into the full timeline's page header (slice 5, stackless, B-400). Migrations in slices 1, 2 and 3; sync config changes. **Ready to start** once its start condition holds · Depends on: `list-filters` (last item B-249), `planner-2` (last item B-248) and the current `quick-fixes` wave in `dev` (slice 1 renames files they touch) · Hot files: slice 1: every `simple*` file (`lib/assistant/simpleMode*`, `SimpleTimeline` and its blocks, quick entry, `TodoTick`, the `/app` layout), `sync-config.yaml`, the device schema; slice 2: `constants/roles.ts`, `permissions/` (blocks, types, timeline, todos, live-notes, connectors), `todoService`, the upload switch, `groupContext.ts`, the role picker; slice 3: group settings Members, `careGroupMemberService`, `useSimpleFrame`; slice 4: the Planner and todo routes, the search route; slice 5: `TimelineHeader.tsx`, `TimelineViewMenu.tsx`, the toggle button |
| `tasks-2` | done | — | — | [PRD](tasks-2-prd.md), [plan](tasks-2-plan.md): **done** (`2db975a7`) |
| `sync-safety` | — | — | `packages/api/src/sync.ts`, `apps/web/app/lib/sync/client.ts` | to write (B-285 to B-296, B-382 to B-384, B-387: repeating-todo upload bugs Codex found, moved from `planner-2`), from the 2026-11-21 code review (findings not re-verified): refused sync changes shown to the user, an upload queue that can't wedge, offline edits that don't revert a co-member's change, replayed PUTs, global client-chosen ids, the sign-out wipe and unsent writes, then the column-agreement test and one generic upload handler · Depends on: (none); `test-health` shares the upload tests (B-371, B-374) · Hot files: `packages/api/src/sync.ts`, `lib/sync/client.ts`, `SyncIndicator`, `session.ts`, `sign-out.tsx`, `medications.sync.ts`, `providers.sync.ts`, the services' `upsert`s |
| `dose-accuracy` | — | — | `packages/data/src/db/schema/medications/dueDoses.ts` | to write (B-297 to B-299), from the 2026-11-21 code review: a dose answers only its own day's slot, deterministic dose ids, visit prep's missed doses per schedule epoch · Hot files: `db/schema/medications/dueDoses.ts`, `medications.sync.ts` (`logDoses`), `visitPrep.ts` |
| `quick-entry-2` | — | — | `packages/data/src/db/schema/assistant/quickEntry.ts`, `apps/web/app/components/quick-entry/` | to write (B-300 to B-303), from the 2026-11-21 code review: negated doses, typed counts, wrong times, the stuck card · Depends on: `planner-2` in `dev` (it edits quick entry's future note; last item B-248) · Hot files: `db/schema/assistant/quickEntry.ts`, `quickEntryTime.ts`, `components/quick-entry/` |
| `calendars-2` | — | — | `packages/data/src/google/`, `packages/notifications/` | to write (B-304 to B-309, B-377), from the 2026-11-21 code review: Google deletes of past items, events beyond 90 days, reminder expiry, deleted providers in pushes, the consent version, reminder time labels, push notifications · Depends on: `planner-2` in `dev` (it changes the calendar projection's reminder kind; last item B-248) · Hot files: `packages/data/src/google/`, `calendarPullService`, `calendarSyncService`, `packages/notifications` (outbox, reminders) |
| `code-health` | — | `check-speed`, `orchestration-2` | `packages/data/src/db/schema/`, `scripts/loops/`, `package.json` | to write (B-361 to B-369), from the 2026-11-21 code review: a `@caretook/data/domain` export, a soft-delete model factory and shared upsert, one role-capability table, typed device reads, dead exports, exact pins, tooling tests · Depends on: the role-capability table (B-363) before or inside `simple-mode`; the rest after the running PRDs land (it touches most services and device modules) · Hot files: `packages/data/src/db/schema/` exports, `models/`, `services/*Service.ts`, `lib/<area>/*.sync.ts`, `package.json`s, `scripts/loops/` |
| `assistant-2` | hold | — | `apps/web/app/lib/assistant/`, `packages/api/` | to write (B-376: assistant chat with voice and questions about the timeline, the part of B-12 that never shipped) · Depends on: an AI vendor that doesn't retain or train (AGENTS.md, _Compliance_); the Vercel AI SDK needs the user's approval · Hot files: `lib/assistant/`, a new server route, `packages/api` |
| `orchestration-2` | — | `check-speed` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/rm.sh`, `scripts/loops/open-session.`, `scripts/loops/session`, `scripts/backlog/` | [PRD](orchestration-2-prd.md), [plan](orchestration-2-plan.md) (B-389, B-390, B-391, B-395): 6 slices, waves (1, 2, 3) → 4 → 5 → 6: the PRD table as a registry (`pnpm backlog prd`, row order is the priority, states worked out), recorded sessions, an asks queue (`pnpm prd ask`, pushed to the phone by the asking session), drain-then-rotate after each landing (`pnpm prd rotate`), run-through prompts and status, then `quick-fixes` split into five standing topics (`fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`, on hold until the user orders them). Tooling only. **Ready to start** once `check-speed` is in `dev` · Depends on: `check-speed` in `dev` (shared `prd.sh`, `prompt.sh`, `pnpm test:tooling`); before `test-health`, never beside it · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `rm.sh`, `open-session.*`, `scripts/backlog/`, this PRD table |
| `orchestration-3` | — | `orchestration-2` | `scripts/loops/prompt.sh`, `scripts/loops/prd.sh`, `scripts/loops/queue.sh`, `scripts/loops/recover.sh` | to write (B-392, B-404: one command to ship `dev` to staging through the Codex review): the dispatcher (`pnpm prd dispatch`: the pick, unattended planners, `queue` as "move to the front", recovery and status). What is settled and what is open: [orchestration-2 PRD](orchestration-2-prd.md), _Follow-on_ · Depends on: `orchestration-2` in `dev` (last item B-395) · Hot files: `scripts/loops/prompt.sh`, `prd.sh`, `queue.sh`, `recover.sh`, the registry |

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
| B-196 | feature | triaged | connectors-2 |  | List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting |
| B-209 | feature | triaged | i18n |  | react-i18next or some other internationalization library to support multiple languages for all text… |
| B-221 | feature | triaged | simple-mode |  | locked simple mode is really confusing. We may want to just add a new user type at this point for… |
| B-229 | bug | ready | quick-fixes | prd/quick-fixes | on timeline page, header and Today section should be in same column width as the rest of the… |
| B-231 | bug | ready | quick-fixes | prd/quick-fixes | "Nothing logged today yet." message should be in a border box like a timeline entry box to match… |
| B-236 | bug | triaged | simple-mode |  | In locked simple mode, SimpleNext's 'See all' (Upcoming) and task links look clickable but bounce back to the timeline: lockAllows only permits the timeline and entry routes |
| B-239 | bug | triaged | github-review |  | pnpm prd review: --json mode prints progress lines (asked Codex…, waiting) on stdout, so its output isn't valid JSON |
| B-240 | bug | triaged | github-review |  | pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75 |
| B-241 | bug | triaged | github-review |  | codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean |
| B-242 | bug | triaged | github-review |  | with_backlog_lock: on Linux, BSD 'stat -f %m' succeeds with non-numeric output before GNU stat is tried, breaking the lock-age arithmetic |
| B-244 | chore | triaged | github-review |  | codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false |
| B-245 | plan | triaged | planner-3 |  | Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date |
| B-252 | feature | triaged | connectors-3 |  | Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming |
| B-253 | feature | triaged | connectors-3 |  | Connector: add_todo can make a repeating todo (daily, weekly on days, monthly) |
| B-254 | feature | triaged | planner-3 |  | Quick entry: 'bins out every monday' makes a repeating todo |
| B-256 | bug | triaged | quick-fixes |  | call and directions icons on planner schedule should be below the time, not beside the… |
| B-257 | change | triaged | ui-kit |  | Button primitive (ui/Button): variants, sizes, link form and a built-in busy label, replacing hand-written btn class strings |
| B-258 | change | triaged | ui-kit |  | Form footer primitive (Cancel and Save row) for sheets and forms; settings' SaveRow builds on it |
| B-259 | change | triaged | ui-kit |  | Message primitives: one inline error/status line and one Notice box, replacing 93 role=alert and 54 role=status hand-written lines |
| B-260 | change | triaged | ui-kit |  | Card primitive in ui/ (titled section card); SettingsCard and the route cards use it; one card title size |
| B-261 | change | triaged | ui-kit |  | List primitives: one bordered, divided list box and a row, replacing six hand-written variants |
| B-262 | change | triaged | ui-kit |  | Empty and loading states: an EmptyState line (optional action) and one Skeleton/Loading placeholder |
| B-263 | change | triaged | ui-kit |  | Page frame: a Page container and one heading scale; every section page uses PageHeader |
| B-264 | change | triaged | ui-kit |  | DetailHeader primitive for the provider, care period, todo, medication and profile pages |
| B-265 | change | triaged | ui-kit |  | Badge primitive with named tones and one size |
| B-266 | change | triaged | ui-kit |  | Checkbox and toggle rows (CheckField, ToggleField), and Field-owned control classes so callers stop passing 'input w-full' |
| B-267 | change | triaged | ui-kit |  | Text and icon tokens: named muted and faint text, inline link style, icon sizes |
| B-268 | chore | triaged | ui-kit-2 |  | Move SeriesScopeDialog's raw <dialog> into a ui/ choice dialog on useShowModal |
| B-269 | chore | triaged | ui-kit-2 |  | Guard the kit: a lint rule or layout test that keeps react-aria imports in ui/ and flags raw btn, card, badge and alert classes outside ui/ |
| B-270 | feature | triaged | ui-kit |  | Dev-only component gallery (/dev/ui): every primitive and its variants in both themes |
| B-271 | chore | staging | check-speed | prd/check-speed | Checks: slice loops run through the check lease (pnpm prd check, not bare pnpm check), and the lease waits while the machine load is high |
| B-272 | chore | landed | check-speed | prd/check-speed | Checks: quick check at slice hand-off and the full suite only at landing, with prd.sh forcing a full run on migrations, seeds, sync config, lockfile and package.json, plus a short always-run list |
| B-273 | chore | staging | check-speed | prd/check-speed | Checks: move the agent-tooling tests (scripts/loops, scripts/backlog, hooks) into their own Vitest project, run only when tooling changes |
| B-274 | chore | triaged | test-health |  | Component tests: one test clock on a fixed base date, reset per test, with harness deadlines on performance.now(); one shared fixClock |
| B-275 | chore | triaged | test-health |  | Component tests: one waitUntil in test/found.ts with one central timeout; no per-call milliseconds (lint rule) |
| B-276 | chore | triaged | test-health |  | Component tests: a retrying getByCss locator and world helpers that return locators, with lint rules against non-null reads in expect and userEvent calls and against fixed sleeps |
| B-277 | chore | triaged | test-health |  | Browser-check bookkeeping: drop the usual seconds and lean-ceiling test (keep the caps), and give check-areas directory defaults so a new file needs no rule |
| B-278 | chore | landed | check-speed | prd/check-speed | Integration tests: a database per Vitest worker, so files run in parallel |
| B-279 | chore | triaged | test-health |  | Unit tests: delete the frozen lists (schema exports, appUrls keys, procedure paths) and replace the frozen route list with native-build invariants |
| B-280 | chore | triaged | test-health |  | Unit tests: trim change detectors: URL tests that restate a template, marketing copy assertions, exact seed counts and names, label maps |
| B-281 | chore | triaged | test-health |  | Component tests: cut duplicates and brittle layout assertions; frame, harness and primitive tests use a probe route, not the timeline |
| B-282 | chore | triaged | test-health |  | Playwright specs: move one-device and no-browser steps out (marketing first), remove fixed sleeps, merge signout-wipe into session-end |
| B-283 | chore | triaged | test-health |  | Server tests: shared fixtures (createWorld, a sync and MCP test helper) and trim rules re-tested through sync upload and the connector; first move the member matrix and condition refusals down to the data layer |
| B-285 | bug | triaged | sync-safety |  | Server-refused sync changes vanish with only a console.warn: keep refused ops in a local table and show them with the server's reason |
| B-286 | bug | triaged | sync-safety |  | A repeatable 5xx from sync.upload blocks a device's upload queue forever: no retry cap, and the sync indicator never shows uploadError or the queue length |
| B-287 | bug | triaged | sync-safety |  | Offline medication and provider edits re-send unchanged JSON columns (schedule, phones), reverting a co-member's newer change |
| B-288 | bug | triaged | sync-safety |  | A replayed PUT on an existing row is a full update with the insert-time values, reverting newer edits (and for medications writing no change entry) |
| B-289 | bug | triaged | sync-safety |  | Client-chosen ids are global: a member of one group can squat ids in another (note_document by a victim's provider id; series visit ids), wedging a device's queue or making top-up skip days |
| B-290 | bug | triaged | sync-safety |  | Sign-out and a lapsed session wipe the device without checking the upload queue: unsent changes are destroyed with no warning |
| B-291 | bug | triaged | sync-safety |  | sync.upload looks tables up on a plain object: table 'constructor' is acknowledged as applied having done nothing, '__proto__' throws a 500 |
| B-292 | chore | triaged | sync-safety |  | A test that the device schema, sync-config.yaml and the upload column maps in sync.ts agree, minus an explicit ignore list |
| B-293 | change | triaged | sync-safety |  | One generic soft-delete table handler in sync.ts in place of nine copied ones (they have already drifted) |
| B-294 | bug | triaged | sync-safety |  | Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused |
| B-295 | bug | triaged | sync-safety |  | System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable |
| B-296 | bug | triaged | sync-safety |  | A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database |
| B-297 | bug | triaged | dose-accuracy |  | A surplus dose marks the next day's slot as given: two caregivers both tapping Given for one pass makes tomorrow's dose read done |
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
| B-310 | bug | triaged | quick-fixes |  | Deleting a provider that a repeating series names stops that series for good: every top-up rolls back with providerNotFound |
| B-311 | bug | triaged | quick-fixes |  | The series top-up reads every live series every minute and rewrites topped_up_through daily even on ended series (re-syncing them to every device) |
| B-312 | bug | triaged | quick-fixes |  | Server note text is often truncated or empty: compaction runs only inside an upload that adds an update (20 pending or 60 s), so the last updates of a session never fold in |
| B-313 | bug | triaged | quick-fixes |  | Timeline and Planner load and watch every note document in the group (snapshot, text, pending updates) to preview 30 rows, rerunning on each co-member keystroke |
| B-314 | bug | triaged | quick-fixes |  | Sign-in, reset-password and verify-email crash to the root error page when offline (the authClient calls aren't wrapped) |
| B-315 | bug | triaged | quick-fixes |  | A removed member's open screen falls back to the first-loaded membership (write controls can come back), with no 'you no longer have access' state |
| B-316 | change | triaged | quick-fixes |  | No unsaved-changes guard on any sheet or form: a click outside, Escape or Back discards a half-filled medication, emergency or provider form |
| B-317 | bug | triaged | quick-fixes |  | The previous user's typed lines, recent searches and settings stay in localStorage when a different user signs in on the device |
| B-318 | bug | triaged | quick-fixes |  | The app header ignores a simple-mode setting changed on another device until the next navigation |
| B-319 | bug | triaged | quick-fixes |  | Empty states flash before the first watch answer: a provider's linked entries ('No notes or events yet') and linked todos ('Former member') |
| B-320 | bug | triaged | quick-fixes |  | safeRedirect accepts a path with a tab, CR or LF ('/<tab>/evil.com' resolves to another site) |
| B-321 | bug | triaged | quick-fixes |  | A refused delete says nothing: UpcomingList voids removeEntry and useEntryRemoval never reads remover.data |
| B-322 | bug | triaged | quick-fixes |  | The Planner sorts by the entry's zone but groups by the viewer's, so mixed-zone entries can list out of time order |
| B-323 | bug | triaged | quick-fixes |  | A failed local note_update insert loses the rest of the session's typing (pending is cleared before the insert; the catch only logs) |
| B-324 | change | triaged | quick-fixes |  | Health data in page titles and URLs: entry, medication, provider and todo names in document.title and searches in ?q= persist in browser history after the sign-out wipe |
| B-325 | change | triaged | quick-fixes |  | Native readiness: no top safe-area inset on the header or sticky day headers (viewport-fit=cover), and /app is a blank page on cold start for up to about 4 s (HydrateFallback returns null) |
| B-326 | chore | triaged | quick-fixes |  | Docs drift: layout.md omits many folders and calls the Playwright specs 'headless Chrome checks'; five area docs name old *.mjs check files; AGENTS.md marks Playwright and print CSS as proposed; sync-config.yaml cites a pnpm powersync:restart that doesn't exist; .env.example lacks BETTER_AUTH_SECRETS; AGENTS.md omits the /series client-safe export |
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
| B-362 | change | triaged | code-health |  | A soft-delete model factory and a shared upsert helper: nine models are the same file, twelve upserts repeat the exists-as-system, visible-as-actor sequence, 'invalid' is defined 18 times |
| B-363 | change | triaged | code-health |  | One exported role-capability table (canWrite(role), canComplete(role)) used by services, device modules and screens, before any role is added |
| B-364 | change | triaged | code-health |  | Device reads are 164 raw SQL strings with hand-typed row types, 17 files outside *.sync.ts: derive row types from the device schema and make libLayout.test.ts refuse SQL elsewhere |
| B-365 | chore | triaged | code-health |  | Remove unused scaffolding and dead exports: serviceName (45 exports, 0 reads), the services registry, getService, isServiceName, initClient, isUserRoleName, isGroupRoleName, primaryContactName, hasContact, CALENDAR_CARDS, COMING_SOON |
| B-366 | chore | triaged | code-health |  | Pin dependencies exactly: 47 caret ranges remain (react-router, drizzle-orm, zod, vite among them) against AGENTS.md's rule |
| B-367 | chore | triaged | code-health |  | Agent tooling: tests for the merge path (land.sh, pr.sh, ready.sh, review.sh: 465 lines, none), and with_backlog_lock removes a stale lock without re-checking, so two waiters can both take it |
| B-368 | chore | triaged | code-health |  | Comments that point at plans instead of behaviour: 198 'slice N' references in 154 source files and 262 PRD-name parentheticals |
| B-369 | change | triaged | code-health |  | baseModel.list always runs a second COUNT query, and a sync PATCH costs about seven round trips (a 100-op batch about a thousand, serially) |
| B-370 | chore | triaged | test-health |  | Quick check always runs the guards that read source by path (scripts/loops/sync-matrix.test.mjs, rolesSql.test.ts): vitest --changed can't select them |
| B-371 | chore | triaged | test-health |  | Device-to-server round trip per table through the app's own writers, comparing column values on the second device (today: hand-written INSERTs, id only, browser suite only) |
| B-372 | chore | triaged | test-health |  | A second time zone in tests: device, recipient and seed are all America/Los_Angeles in 106 of 113 component test files, while 29 production call sites read the device's zone |
| B-373 | chore | triaged | test-health |  | Role coverage gaps: a removed member writing or reading a care table, staff support on care tables, non-member writes through sync upload on 10 of 15 tables, and a real every-procedure unauthenticated sweep |
| B-374 | chore | triaged | test-health |  | A test for the device's uploadData: a 400 or 500 from sync.upload must not wedge the queue |
| B-375 | chore | triaged | test-health |  | Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports) |
| B-376 | feature | triaged | assistant-2 |  | Assistant chat with voice and questions about the timeline (B-12 is marked done, but only device-side quick entry shipped; no AI SDK is installed) |
| B-377 | feature | triaged | calendars-2 |  | Push notifications for appointment reminders (B-61 shipped email only) |
| B-378 | chore | triaged | i18n |  | File the translations PRD's promised follow-ups: Spanish quick entry, language-aware search, a human review of the Spanish; and note 48 hard-coded 'en-US' formatters and English messages in schemas and the errors catalogue |
| B-379 | chore | triaged | quick-fixes |  | Later contract migrations nobody tracks: dropping the old columns the simple-mode and planner-2 PRDs leave behind, and medications-2's default-passes backfill |
| B-380 | chore | triaged | quick-fixes |  | Backlog hygiene: B-205 and B-206 are the same test failure; B-208 is tagged simple-mode but landed as a hotfix; B-88 is landed with no commit; B-222's title and inbox line disagree; about 150 items read 'live' from one release merge though production hasn't started |
| B-381 | bug | triaged | quick-fixes |  | readTools.int.test.ts 'nothing private leaves' flakes when a random user UUID contains the birth year (e.g. …072194195bed matches '1941'): assert on fields, not a substring of the whole output |
| B-382 | bug | triaged | sync-safety |  | Repeating todos: an offline Undo's delete of the next occurrence lands unconditionally (todoOp removeTodo), deleting a successor another member edited or completed even though todoService.reopen kept it; tell an Undo's delete from an explicit one and apply it only when the server finds the successor untouched (todos.sync.ts:499) |
| B-383 | bug | triaged | sync-safety |  | Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating |
| B-384 | bug | triaged | sync-safety |  | Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete) |
| B-385 | bug | triaged | quick-fixes |  | Repeating todos: nextDueDay uses nextVisits' ~5-year search horizon, so a valid long-interval rule (e.g. FREQ=MONTHLY;INTERVAL=99) reads as ended and the chain stops; search to the rule's next occurrence or cap the accepted interval |
| B-386 | bug | triaged | quick-fixes |  | Repeating todos: a successor moved back onto its source's day and ticked gets nextTodoId(repeatId, that next day) = its own id, so insertNext (and the device's planNext) sees the row as the existing next and the chain silently ends; handle ids taken by the source or a done occurrence |
| B-387 | bug | triaged | sync-safety |  | Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin |
| B-388 | bug | triaged | quick-fixes |  | Integration flakes seen in 2026-11-21 full checks: the connector MCP tests (mcpWrites, mcp, readTools .int.test.ts) failed 14 times with 'Connection terminated' in the transcripts, and todoRename.int.test.ts 4 times; find the cause (dropped connections on the shared test Postgres under load?) and fix it |
| B-389 | change | landed | orchestration-2 | prd/orchestration-2 | A PRD registry: the PRD table gets a state, the topics it comes after and its hot files, kept through pnpm backlog prd; row order is the priority |
| B-390 | change | in-progress | orchestration-2 | prd/orchestration-2 | One orchestrator session per wave: recorded sessions and pnpm prd rotate, so a fresh session opens from Status after each landing |
| B-391 | feature | in-progress | orchestration-2 | prd/orchestration-2 | One asks queue: unattended sessions file questions and landed-wave reports with pnpm prd ask; the user answers in one place |
| B-392 | feature | triaged | orchestration-3 |  | A dispatcher (pnpm prd dispatch) that plans and starts PRDs by registry order, dependencies, hot files and slots, and reopens dead sessions; pnpm prd queue just reorders |
| B-393 | bug | triaged | quick-fixes |  | Repeating todos: reopening Repeat on a 'last Friday' monthly todo whose occurrence falls on a 4th Friday and pressing Done turns BYDAY=-1FR into 4FR (todoFormData initialRepeat → choiceOfRule drops nth); the same shared choiceOfRule/choiceRule bug as B-234 for appointment series: one fix should cover both |
| B-394 | bug | triaged | quick-fixes |  | mcp.int.test.ts 'list_timeline: the group's entries in the recipient's zone, with note text, paged at 50' times out at Vitest's 5 s default under load (full check, 5-min load ~21); passes alone 3x |
| B-395 | change | triaged | orchestration-2 |  | Split quick-fixes into categories that land separately: UI/UX, tooling, optimizations, bugfixes, nits (a plan or topic per category; the dispatcher treats each as a standing topic) |
| B-396 | change | triaged | ui-kit |  | Redesign TabNav as a pill bar: a fully rounded floating container, plain text tabs, and the current tab as a tinted pill with optional icon and count badge |
| B-397 | change | triaged | ui-kit |  | Break long pages into clear vertical sections: a section rhythm for the page frame (spacing scale, titled cards, section headings, dividers) applied to the text-heavy pages |
| B-398 | change | triaged | ui-kit-2 |  | Sweep every remaining area onto the UI kit primitives, one area per slice: medications; providers, profile forms and care periods; the Planner, to-dos and search; the timeline, entries and quick entry; admin, account, connectors, marketing and the app frame |
| B-399 | bug | triaged | ui-kit |  | Bottom menu on mobile need a better deign. I like floating menus. It needs to be a different bg… |
| B-400 | change | triaged | simple-mode |  | Timeline header has room for "Easy Mode" toggle now. move it out of eyeball menu and into the… |
| B-401 | bug | landed | check-speed | prd/check-speed | check-run.sh's load reading can carry a blank line on Linux (sysctl fails under pipefail before the uptime fallback), splitting a check-times.log record across lines; normalise it to one number |
| B-402 | bug | landed | check-speed | prd/check-speed | pnpm test:tooling runs only tooling:unit, so a tooling-only change to checks.mjs, check-areas.mjs, sync-matrix or check-times.mjs passes the docs-and-tooling gate without its own tests (they live in scripts:unit) |
| B-403 | feature | triaged | orchestration-2 |  | A cleanup agent every few hours (pnpm prd tidy): finds finished sessions still open, finished worktrees and branches, and other leftovers; removes the safe ones and reports the rest |
| B-404 | feature | triaged | orchestration-3 |  | One command to ship dev to staging: push dev, open the dev into staging PR, wait for Codex's review, triage its findings into the backlog (verified against the code, duplicates noted on the existing item), merge the PR when nothing is a blocker, and notify the user only when something is |
| B-405 | bug | triaged | test-health |  | Worker database names cut the base to 59 characters, so two worktrees of a long topic (~46+ chars) share their _w<n> copies: concurrent checks DROP each other's databases and rm drops both; keep a short hash of the full base when shortening, and match it in isOwnDatabase and test-db.sh |
| B-406 | feature | triaged | orchestration-3 |  | Set priority in the inbox, not the backlog: the user orders a short 'Next up' list in plans/inbox.md (plain lines, no ids or fields) and the dispatcher reads it as the order to plan and run, keeping the PRD table's row order in step; the user opens the backlog only when an agent asks |

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
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): after the production launch (B-33) and the privacy policy and terms (B-54); vendor review
- 2026-11-20 (Robert Bo Davis): Left out of the connectors-2 PRD (the user, 2026-11-20): after the launch (B-33) and the privacy policy (B-54); the PRD's Out of Scope lists what a listing needs. -- backlog agent

### B-209 · feature · react-i18next or some other internationalization library to support multiple languages for all text…

- status: triaged
- prd: i18n
- owner:
- commit:

- 2026-11-20 (prd/conditions): From the inbox: react-i18next or some other internationalization library to support multiple languages for all text in the app.
- 2026-11-20 (Robert Bo Davis): Triage: a new big PRD (i18n). It touches every user-facing string (routes, ui/, emails, MCP text, dates and plural rules), so it should run alone or with tooling-only PRDs, ideally after the feature PRDs settle. Needs your approval for a new dependency (react-i18next/i18next, or a lighter alternative such as Lingui or FormatJS). Decide which languages and when it matters before launch.
- 2026-11-21 (Robert Bo Davis): PRD and plan written (plans/i18n-prd.md, i18n-plan.md): English and Spanish (AI-drafted, human review before launch), per-user language, app + emails + public site at /es/; quick entry parsing, search matching, the connector and /admin stay English. Dependencies approved 2026-11-21: i18next, react-i18next, eslint-plugin-i18next (dev). Runs alone, after list-filters, planner-2, the quick-fixes wave and simple-mode.

### B-221 · feature · locked simple mode is really confusing. We may want to just add a new user type at this point for…

- status: triaged
- prd: simple-mode
- owner:
- commit:

- 2026-11-21 (prd/medications-3): From the inbox: locked simple mode is really confusing. We may want to just add a new user type at this point for locked simple mode. Or just review and fix all of the nits.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): a simple-mode PRD to write. Its interview decides between a new member type for locked simple mode and fixing the nits (touches roles and permissions).
- 2026-11-21 (Robert Bo Davis): PRD and plan written 2026-11-21 (plans/simple-mode-prd.md, simple-mode-plan.md): the lock becomes two roles, Easy helper and Easy viewer; simple is renamed easy. B-236 is slice 4 (the Planner, todo pages and search open for the easy roles). -- backlog session

### B-229 · bug · on timeline page, header and Today section should be in same column width as the rest of the…

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b6dd71d3

- 2026-11-21 (prd/tasks-2): From the inbox: on timeline page, header and Today section should be in same column width as the rest of the timeline on large screens.
- 2026-11-21 (prd/quick-fixes): Proposed for quick-fixes (the user reviews): a small layout fix on the timeline at large widths; one slice in a later wave. -- quick-fixes orchestrator

### B-231 · bug · "Nothing logged today yet." message should be in a border box like a timeline entry box to match…

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b6dd71d3

- 2026-11-21 (prd/quick-entry): From the inbox: "Nothing logged today yet." message should be in a border box like a timeline entry box to match the rest of the page.
- 2026-11-21 (Robert Bo Davis): Triage: quick-fixes (the user reviews): a small style fix to timeline-ux-2's empty-Today placeholder (TimelineEntryList), one slice alongside B-229 (same timeline route, same wave). Avoid running it while quick-entry touches the empty Today's Add an entry.

### B-236 · bug · In locked simple mode, SimpleNext's 'See all' (Upcoming) and task links look clickable but bounce back to the timeline: lockAllows only permits the timeline and entry routes

- status: triaged
- prd: simple-mode
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2. Belongs with B-221's rethink of locked simple mode (allow those pages, or hide the links when locked). tasks-2 renames Upcoming to Planner and tasks to todos, so fix it after tasks-2 lands; if simple-mode isn't planned soon, a quick-fixes slice that hides the links when locked.
- 2026-11-21 (Robert Bo Davis): PRD and plan written 2026-11-21 (plans/simple-mode-prd.md, simple-mode-plan.md): the lock becomes two roles, Easy helper and Easy viewer; simple is renamed easy. B-236 is slice 4 (the Planner, todo pages and search open for the easy roles). -- backlog session

### B-239 · bug · pnpm prd review: --json mode prints progress lines (asked Codex…, waiting) on stdout, so its output isn't valid JSON

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (review.sh:72), verified. Send progress to stderr when --json.

### B-240 · bug · pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (review.sh:77), verified. Exit 75 when the summary never changes.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.

### B-241 · bug · codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (codex-review.mjs:37), verified. Paginate, or refuse clean when hasNextPage.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.

### B-242 · bug · with_backlog_lock: on Linux, BSD 'stat -f %m' succeeds with non-numeric output before GNU stat is tried, breaking the lock-age arithmetic

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (lib.sh:328), verified. Macs are fine today; check the output is numeric before falling back.
- 2026-11-21 (Robert Bo Davis): Codex raised this again on PR #16 (dev into staging, head 30206f75), P2; still present on dev. Already filed, no new item.

### B-244 · chore · codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): User's decision 2026-11-21. One-line change in openFindings (scripts/loops/codex-review.mjs) plus a test on the outdated.json fixture. Declined, non-outdated threads still need reply + resolve. Update docs/agents/orchestrator.md _Landing a wave_ step 4, docs/orchestration.md and the orchestrator prompt line in prompt.sh (+ prompt.test.mjs): only declined threads need --resolve.

### B-245 · plan · Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date

- status: triaged
- prd: planner-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the backlog session, 2026-11-21, at the user's request: the future replacement for reminders (future-dated notes), which are to be removed from the Planner. Not triaged; no PRD yet.
- 2026-11-21 (Robert Bo Davis): Follows planner-2 (B-248 remove reminders).
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, proposed: its own PRD to write, planner-3 (a note carries a todo with its own due day and assignee), after planner-2 (B-248 remove reminders) is in dev, since it builds on notes being past-only. PRD table row added. For the user to check.

### B-252 · feature · Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming

- status: triaged
- prd: connectors-3
- owner:
- commit:

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21, the user's request: upcoming returns appointments and dated todos only; the dosing schedule gets its own read tool (a new one, or a day parameter on todays_doses). Proposed topic connectors-3, a PRD to write; for the user to check.

### B-253 · feature · Connector: add_todo can make a repeating todo (daily, weekly on days, monthly)

- status: triaged
- prd: connectors-3
- owner:
- commit:

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21: repeating todos are created from the todo form only in planner-2; the connector's add_todo taking a repeat is this follow-up, after planner-2 (B-248 remove reminders) is in dev. Proposed with B-252 in connectors-3; for the user to check.

### B-254 · feature · Quick entry: 'bins out every monday' makes a repeating todo

- status: triaged
- prd: planner-3
- owner:
- commit:

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21: repeating todos are created from the todo form only in planner-2; reading a repeat in quick entry is this follow-up, after planner-2 (B-248 remove reminders) is in dev. Proposed alongside B-245 (attach a todo to a note) in planner-3; for the user to check.

### B-256 · bug · call and directions icons on planner schedule should be below the time, not beside the…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: call and directions icons on planner schedule should be below the time, not beside the title/description to free up space on mobile.
- 2026-11-21 (Robert Bo Davis): Triage: a small layout fix on the Planner schedule rows (call and directions icons under the time), so quick-fixes; the Planner files are hot for planner-2 and list-filters, so pick it up after those land.

### B-257 · change · Button primitive (ui/Button): variants, sizes, link form and a built-in busy label, replacing hand-written btn class strings

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Component review 2026-11-21: 268 btn class strings in 148 files, 81 distinct (btn btn-sm x47, btn btn-ghost btn-sm vs btn btn-sm btn-ghost, danger as btn-error or btn-ghost text-error). About 25 buttons hand-roll {busy ? 'Saving…' : 'Save'}. IconButton stays; chipClass could build on it.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-258 · change · Form footer primitive (Cancel and Save row) for sheets and forms; settings' SaveRow builds on it

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 15 Cancel/Save footers in 6 layouts (flex justify-end gap-2 pt-3, pt-2, flex-wrap…, ml-auto); SaveRow (components/settings) is the only shared one and is settings-only. Depends on the Button item.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-259 · change · Message primitives: one inline error/status line and one Notice box, replacing 93 role=alert and 54 role=status hand-written lines

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: <p role=alert className='text-error text-sm'> is copied about 80 times (class order and margins drift); success lines are text-success text-sm or alert alert-success alert-soft; 20 alert boxes use 15 class variants (soft or not, text-sm or text-base, py-2). Owns role, tone, icon and empty:hidden.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-260 · change · Card primitive in ui/ (titled section card); SettingsCard and the route cards use it; one card title size

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 'card bg-base-100 shadow-sm' + card-body is hand-written 24+ times (19 as <section>), card-body gap is 1/2/3/4 or none, card-title is plain, text-base, text-lg or text-2xl. SettingsCard already wraps the same markup but lives in components/settings.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-261 · change · List primitives: one bordered, divided list box and a row, replacing six hand-written variants

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: about 30 lists. 'rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border' x11 plus variants without overflow-hidden or bg, and divide-base-300 ones (x13 plain, x4 boxed, class order differs); rows pad py-2, py-2.5 or py-3, with or without px-3. Dividers should be base-300 per the Surfaces rule; divide-base-200 breaks it.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-262 · change · Empty and loading states: an EmptyState line (optional action) and one Skeleton/Loading placeholder

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 24 'No … yet.' messages in three stylings (text-base-content/70 text-sm x15, without text-sm x5, plain text-sm x5); MedicationSheet has its own local Empty. Loading is a skeleton in 4 timeline files, 'Loading…' text in GoogleCard, a spinner in FirstSyncPending, and nothing elsewhere.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-263 · change · Page frame: a Page container and one heading scale; every section page uses PageHeader

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: <main className='mx-auto max-w-2xl space-y-4 px-4 py-5'> is copied 13 times with 10 more variants (max-w xl/2xl/3xl/4xl, py-5/6/10, p-4 sm:p-6). 39 files write an h1; only 4 routes use PageHeader, and periods, passes and profile hand-write the same text-lg h1. h1 is text-lg (section pages), text-xl (detail pages), text-2xl (home, settings) and card-title (all of admin). Section h2/h3: 'font-semibold' x17 and 12 other styles. Related: B-229 (timeline header column width).
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-264 · change · DetailHeader primitive for the provider, care period, todo, medication and profile pages

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: ProviderHeader, PeriodHeader, TodoHeader and MedicationHeader copy the same header line for line: a size-9 icon disc (primary or muted), h1 text-xl with badges, a details line, and the editors and actions regions (data-region). ProfileHeader is a fifth near copy. Callers pass icon, tone, title, badges, details, editors, actions.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-265 · change · Badge primitive with named tones and one size

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 48 badges in 34 files, 25 class variants (badge badge-ghost badge-sm vs badge badge-sm badge-ghost, soft and outline mixed, gap-1, shrink-0, whitespace-nowrap added ad hoc). Status meanings (Primary, Past, Now, overdue, stopped) pick tones per file. ViaTag stays as is.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-266 · change · Checkbox and toggle rows (CheckField, ToggleField), and Field-owned control classes so callers stop passing 'input w-full'

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 39 checkboxes and 20 toggles sit in 15 different hand-written <label> wrappers (label text-base-content cursor-pointer gap-2…, flex items-start gap-3…; mt-0.5 nudges; sizes sm or default). Field callers pass the control class themselves: 'input w-full' x65, 'select w-full' x15, 'textarea w-full' x12, plus *-error by hand x17. components.md says every labelled control is a Field; checkboxes and toggles have no primitive.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-267 · change · Text and icon tokens: named muted and faint text, inline link style, icon sizes

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: secondary text uses 8 opacities (text-base-content/70 x307, /80 x35, /60 x32, /50 x16, /40, /75, /85, /90) with no rule for which; inline links have 15 class variants (link, link font-medium, link link-primary, link link-hover text-primary…); icons are size-4 mostly, with size-3, 3.5, 5 mixed in like roles. Define the tokens in app.css or ui/styles.ts and sweep.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-268 · chore · Move SeriesScopeDialog's raw <dialog> into a ui/ choice dialog on useShowModal

- status: triaged
- prd: ui-kit-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: components/entry/SeriesScopeDialog.tsx is the only raw <dialog> outside ui/, so it skips ConfirmDialog's wait-for-menu-close and focus rules. A three-choice dialog primitive (or ConfirmDialog with a second action) covers it.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21): moved to the follow-on ui-kit-2, after the area sweeps (B-398); ui-kit itself is the primitives and their first adopters.

### B-269 · chore · Guard the kit: a lint rule or layout test that keeps react-aria imports in ui/ and flags raw btn, card, badge and alert classes outside ui/

- status: triaged
- prd: ui-kit-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: no no-restricted-imports or class guard found in the ESLint configs; the rules in components.md are held by review only (react-aria is clean today). Add after the primitives land, with an allowlist for marketing and print sheets.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21): moved to the follow-on ui-kit-2, after the area sweeps (B-398); ui-kit itself is the primitives and their first adopters.

### B-270 · feature · Dev-only component gallery (/dev/ui): every primitive and its variants in both themes

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: nothing shows the kit in one place, so drift is only visible by grep. A web-only dev route beside /dev/mail, fictional data, no new dependency. Also fix docs/layout.md's ui/ list, which is behind components.md (no PageHeader, TabNav, ComboBox, ChipList, Toast, ViaTag, Highlight).
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-271 · chore · Checks: slice loops run through the check lease (pnpm prd check, not bare pnpm check), and the lease waits while the machine load is high

- status: staging
- prd: check-speed
- owner: prd/check-speed
- commit: 4d4a760f

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). Loops bypass the lease (loop.md:13,37; prompt.sh:183,211); only prd.sh:212,217 takes it; Vitest runs have no load gate (browser.sh:450 gates only the retry). 38 of 53 logged browser flakes were at load above 30; a threshold near 20 is suggested.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.
- 2026-11-21 (plan/check-speed): Moved from test-health to the small check-speed PRD (2026-11-21) so the check-time fixes run first. B-271 changes: no load gate (the 5-minute load sat at 18 to 23 all afternoon, so a gate at 16 would only add waiting); two check leases and a check log instead.

### B-272 · chore · Checks: quick check at slice hand-off and the full suite only at landing, with prd.sh forcing a full run on migrations, seeds, sync config, lockfile and package.json, plus a short always-run list

- status: landed
- prd: check-speed
- owner: prd/check-speed
- commit: b725c7e4

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). vitest --changed misses files read by path (SQL migrations, sync-config.yaml, sync-matrix.test.mjs, libLayout, securityHeaders, errors tests), deleted files, the check-areas lint and the budgets. A 3-slice wave runs 3 full suites plus 1 to 5 gate checks today.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.
- 2026-11-21 (plan/check-speed): Moved from test-health to the small check-speed PRD (2026-11-21) so the check-time fixes run first. B-271 changes: no load gate (the 5-minute load sat at 18 to 23 all afternoon, so a gate at 16 would only add waiting); two check leases and a check log instead.

### B-273 · chore · Checks: move the agent-tooling tests (scripts/loops, scripts/backlog, hooks) into their own Vitest project, run only when tooling changes

- status: staging
- prd: check-speed
- owner: prd/check-speed
- commit: 4bb31f7f

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 240 of 306 scripts:unit tests guard agent workflow; 17 of 27 files spawn processes, lease and browser tests sleep for real. Keep in the default run: sync-matrix, check-areas, deploy/workflows, scripts/build. Also: check-gate.test.mjs rebuilds a git repo per test; prompt.test.mjs asserts prompt phrases.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.
- 2026-11-21 (plan/check-speed): Moved from test-health to the small check-speed PRD (2026-11-21) so the check-time fixes run first. B-271 changes: no load gate (the 5-minute load sat at 18 to 23 all afternoon, so a gate at 16 would only add waiting); two check leases and a check log instead.

### B-274 · chore · Component tests: one test clock on a fixed base date, reset per test, with harness deadlines on performance.now(); one shared fixClock

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). setup.ts restarts at 12:00 per file and keeps running (minute turns, B-133's retry: 2 still at timelineScroll:163); fixClock exists twice (medicationWorld:359, plannerWorld:43) on a different base. A fully frozen Date breaks found/waitUntil and ids built from updated_at. Wall-clock tolerance asserts: entry:174, timelineHeader:137.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-275 · chore · Component tests: one waitUntil in test/found.ts with one central timeout; no per-call milliseconds (lint rule)

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). Seven copies of waitUntil; 431 of 584 calls pass a number (378 at 4000, below the central 5 s); 43 timeout: literals, 30 redundant. Real exceptions: timelineStrips:175, device.browser.test:277,305.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-276 · chore · Component tests: a retrying getByCss locator and world helpers that return locators, with lint rules against non-null reads in expect and userEvent calls and against fixed sleeps

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). No auto-waiting way to reach a data- hook: $ and $$ are copied in four world files and six tests (338 calls, 30 files). Rules A (userEvent with a non-null argument, about 296 sites), B (non-null inside expect, 200 to 250), C (sleeps, about 45): warn first, migrate area by area. Supersedes sweeping sites as in B-176, B-178, B-180, B-228.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-277 · chore · Browser-check bookkeeping: drop the usual seconds and lean-ceiling test (keep the caps), and give check-areas directory defaults so a new file needs no rule

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). lean-ceiling edited 11 times in two days; browser.sh never reads usual (only columns 3 and 4). check-areas.d touched in 124 non-merge commits. Risk: suite growth (bounded by the suite cap) and a new file silently taking its area's checks.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-278 · chore · Integration tests: a database per Vitest worker, so files run in parallel

- status: landed
- prd: check-speed
- owner: prd/check-speed
- commit: b725c7e4

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 20 files touch global state (app_setting wipes, unscoped sweeps in reminders, outbox, calendarPull, rateLimit, JWKS rotation, todoRename), so parallel files on one database is fragile. Per-worker databases need no test changes (globalSetup, setup, testDatabase.ts:17, test-db.sh, rm.sh, vitest.config.ts:155); estimate 2.5 to 3x wall time with 3 workers.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.
- 2026-11-21 (plan/check-speed): Moved from test-health to the small check-speed PRD (2026-11-21) so the check-time fixes run first. B-271 changes: no load gate (the 5-minute load sat at 18 to 23 all afternoon, so a gate at 16 would only add waiting); two check leases and a check log instead.

### B-279 · chore · Unit tests: delete the frozen lists (schema exports, appUrls keys, procedure paths) and replace the frozen route list with native-build invariants

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). schema/index.test.ts (649 lines, 29 commits), appUrls KEYS (11), routerPaths (9): typecheck catches removals (rpc.ts:18 is a typed client); revisit a path guard when the native app ships. routes.test.ts (19 commits) is the only guard on native exclusion: keep uniqueness, add no /api, /rpc, /admin, /dev, connectors or marketing in native, every native route also in web.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-280 · chore · Unit tests: trim change detectors: URL tests that restate a template, marketing copy assertions, exact seed counts and names, label maps

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 900 lines. Per-file keep-lists are in the review: urls tests keep encoding, fallbacks and param rules (calendars/urls deleted); marketing keeps ids, icons, hrefs, JSON-LD, legal compliance regexes; seeds keep schema validity, ids and references (seed tests change in nearly every seed commit); medicationTypeDisplay to one test. Also merge the two deviceLabel and groupRoleLabel definitions.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-281 · chore · Component tests: cut duplicates and brittle layout assertions; frame, harness and primitive tests use a probe route, not the timeline

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 1,600 to 2,000 lines. Timeline: pixel and class asserts (timelineLayout 173, 303, 323, 425; todayCard 265), Given all and Undo in four files, todayCard and summaries repeating unit tests. Elsewhere: inScreens (12 commits, all following other areas) down to its screen-specific parts, device.browser.test to about 180 lines, section-current and settings-frame copies into one table, print tests repeating unit tests.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-282 · chore · Playwright specs: move one-device and no-browser steps out (marketing first), remove fixed sleeps, merge signout-wipe into session-end

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 880 lines. marketing: 10 of 16 tests need no browser or are unit-covered; five MIN_FORM_MS waits. live-notes: about 11 s of sleeps in one serial test. invites, app-shell, phase2, first-sync, sign-in, layout-offline: one-device steps a component test already covers. ui.spec keeps only production CSS and the CSP. fixtures.mjs:137 sleeps 1 s on every sign-in.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-283 · chore · Server tests: shared fixtures (createWorld, a sync and MCP test helper) and trim rules re-tested through sync upload and the connector; first move the member matrix and condition refusals down to the data layer

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 700 lines plus about 450 from fixtures (world rebuilt in 13 data files, clientFor copied in 34). Keep every entry-point branch: PATCH immutable, readOnlyTable, done_at mapping, mcp:invalidArguments. Move first: member role matrix (router.int 381-567 is its only owner) and conditionDeleted/conditionNotFound (only via mcpWrites 554-690). syncTodos 99-126 stays.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-285 · bug · Server-refused sync changes vanish with only a console.warn: keep refused ops in a local table and show them with the server's reason

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/sync/client.ts:55-58 ignores the code and issues sync.ts returns. Ordinary triggers: a phone clock over an hour fast (vitals and doses), two offline devices adding a pass with the same name (the pass and its medications), a role changed while offline, a todo assigned to someone who left. Four reviewers flagged it. Topic: a new PRD for sync data loss.

### B-286 · bug · A repeatable 5xx from sync.upload blocks a device's upload queue forever: no retry cap, and the sync indicator never shows uploadError or the queue length

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. sync.ts:913-919 throws on every non-4xx; client.ts retries the same batch. Known triggers: a timeline_entry PUT replayed after the uploader was demoted to viewer (nothingUpdated is mapped for PATCH at sync.ts:175, not for PUT), a NUL character in any text column, table __proto__. Fix idea: quarantine an op after N identical failures and show the pending count.

### B-287 · bug · Offline medication and provider edits re-send unchanged JSON columns (schedule, phones), reverting a co-member's newer change

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. medications.sync.ts:457,642-645 and providers.sync.ts:264,347-350 write every column as compact JSON.stringify while the synced copy holds Postgres's jsonb text, so PowerSync's diff sends them in every PATCH. Rests on one assumption: check ps_crud on staging after a refill edit. conditions.sync.ts:545-547 already writes only changed fields. Fixtures seed compact JSON, so tests cannot see it.

### B-288 · bug · A replayed PUT on an existing row is a full update with the insert-time values, reverting newer edits (and for medications writing no change entry)

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Every service upsert turns a PUT on an existing id into an update. Plausible, not traced end to end: a lost ack or a 5xx later in the batch replays the PUT. Fix idea: a PUT on an existing live row is a no-op. medicationService.ts:178-181.

### B-289 · bug · Client-chosen ids are global: a member of one group can squat ids in another (note_document by a victim's provider id; series visit ids), wedging a device's queue or making top-up skip days

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. noteDocumentService.ts:197-201 checks existence only in the actor's scope, so the victim's create hits the primary key and returns a 500; appointmentSeriesService.ts:117-131 visitExists accepts any row with the computed id without checking its group. Fix idea: check existence as the system and return 4xx; compare group and series.

### B-290 · bug · Sign-out and a lapsed session wipe the device without checking the upload queue: unsent changes are destroyed with no warning

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/auth/session.ts:113,164, routes/sign-out.tsx:18. Offline, the wipe runs first and authClient.signOut() then throws: the user lands on the root error page with a still-valid session cookie (UserMenu.tsx:46-52). Fix idea: count queued ops and ask; catch the sign-out failure; keep the database when the same user's session merely expired.

### B-291 · bug · sync.upload looks tables up on a plain object: table 'constructor' is acknowledged as applied having done nothing, '__proto__' throws a 500

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/api/src/sync.ts:928 HANDLERS[op.table]. Use a Map or Object.hasOwn. Low severity (a malformed client only), but '__proto__' is one of the queue-wedging 5xx paths.

### B-292 · chore · A test that the device schema, sync-config.yaml and the upload column maps in sync.ts agree, minus an explicit ignore list

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. A column missing from an X_COLUMNS map is silently dropped on upload and a PATCH of only that column returns applied (sync.ts:172). The three lists agree today (two reviewers diffed them by script); nothing keeps them so. Adding one column to a synced table takes about 12 hand edits, 5 of them untested.

### B-293 · change · One generic soft-delete table handler in sync.ts in place of nine copied ones (they have already drifted)

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/api/src/sync.ts is 937 lines of near-identical column map, contentFrom, remove-with-replay-check and PUT/PATCH/DELETE per table. Drift: only timelineEntryOp maps nothingUpdated to unauthorized; timeline and series removes answer a viewer 404 where the others answer 403. About 400 lines go.

### B-294 · bug · Sync uploads apply each op in its own transaction, so a multi-row device write half-applies when one op is refused

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Example: a series split in lib/appointments/series.sync.ts:433-521. Design finding: upload by device transaction and apply it atomically. Related: removePass rewrites every medication's schedule from the device's possibly stale copy (medicationPasses.sync.ts:283-287).

### B-295 · bug · System-written change entries take the device clock unchecked: a clock a day ahead dates 'Stopped …' tomorrow, at the top of the history, uneditable

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. medicationService.ts:73,185; medicationPassService.ts:119; recipientConditionService.ts:173. Clamp the future side to server time. Low.

### B-296 · bug · A tab left open while another tab switches user keeps the old user id, and its next navigation clears the new user's local database

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/sync/index.ts:28. Traced by reading only. Low.

### B-297 · bug · A surplus dose marks the next day's slot as given: two caregivers both tapping Given for one pass makes tomorrow's dose read done

- status: triaged
- prd: dose-accuracy
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/schema/medications/dueDoses.ts:166-206: named matches have no distance or day bound. Reproduced by the reviewer with a scratch script. Inverse: a 20:00 dose given at 07:00 answers yesterday's missed slot and leaves today's open. doseSlotsBetween has the same leak, so visit prep hides a real miss. Fix idea: a named dose answers only the slot on its own recipient-day; surplus doses answer nothing.

### B-298 · change · Deterministic dose ids per medication, day and slot, so two devices logging the same pass converge on one row

- status: triaged
- prd: dose-accuracy
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. logDoses uses crypto.randomUUID() (lib/medications/medications.sync.ts:825); series visits already use UUID v5. Two reviewers raised it as the root of the duplicate-dose finding.

### B-299 · bug · Visit prep's 'Missed doses' reads history through today's schedule: a schedule change shows phantom misses back to the last visit

- status: triaged
- prd: dose-accuracy
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. dueDoses.ts:289-326 (the comment admits it), lib/appointments/visitPrep.ts:320. Also: a pass moved by more than 2 h unmatches earlier doses logged without passId; a medication added at 15:00 shows its 08:00 slot overdue. Fix idea: expand slots per schedule epoch from the medicationChange entries.

### B-300 · bug · Quick entry logs negated doses as given: 'did not give metoprolol', 'metoprolol not given', 'couldn't give…' all record a given dose at 0.9 confidence

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/schema/assistant/quickEntry.ts:257-279, 931-952. Reproduced with a scratch script. Negation is only recognised before take/have/swallow. Fix idea: any not/never/don't/couldn't near a dose verb makes it skipped or demotes the line to a note.

### B-301 · bug · Quick entry discards a typed count and records the usual dose: 'gave 3 tylenol' records '2 tabs' with '3' in the note; 'gave half a tylenol' too

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. quickEntry.ts:910-924, 981. Reproduced. Related: 'tylenol 2 at 8' becomes a Symptom named Tylenol, severity 2.

### B-302 · bug · Quick entry gives silently wrong times: 'sat up in chair' is last Saturday, '2nd tylenol' is Nov 2, '11/25 at 2pm' is tomorrow, 'dr alvarez at 2' is 2 AM, 'pain 8 a bit better' is 8:00 AM

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/db/schema/assistant/quickEntryTime.ts (lines 84-101, 207-214, 297-342, 362-369, 465-474, 539-556). Reproduced. Also 'this morning' before 08:00 is blocked as future. Fix idea: tighten each rule, parse M/D, clamp period defaults to now for past kinds.

### B-303 · bug · Quick entry gets stuck: remove a card, delete the text, retype the same line: no card, no Save, Enter does nothing

- status: triaged
- prd: quick-entry-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. components/quick-entry/useQuickEntry.ts:98-118,206-216: removed and chosen reset only on Save or Clear, and Clear is hidden when no cards show. Prune both maps to the current part keys.

### B-304 · bug · Deleting an old event in Google Calendar rewrites past Caretook records: soft-deletes a past reminder note, cancels a past appointment, marks a todo done for the group

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/google/pullPlan.ts:196-203, calendarPullService.ts:172-188. Only series visits are guarded by 'started'. Fix idea: ignore deletes of started items; never complete a todo on delete.

### B-305 · bug · Events made in Google more than 90 days out never arrive: ignored as outsideWindow, the sync token advances, nothing revisits them

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. pullPlan.ts:150-154,185; calendarPullService.ts:277-311. Plausible and untested against Google: a recurring Google event becomes about 90 days of one-off appointments, then stops (real.ts:118-121).

### B-306 · bug · A reminder email can arrive after its appointment: about 2 h of retry backoff, no expiry, text rendered at queue time

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/notifications/src/outbox.ts:48-53, 346-355. Add an expiry to the row. Low.

### B-307 · bug · Google Calendar pushes still name soft-deleted providers (reminders filter them)

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. calendarSyncService.ts:200-206. Low.

### B-308 · bug · The details-consent version is stored but never compared, so bumping DETAILS_CONSENT_VERSION re-asks nobody

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Every reader uses !!detailsConsentAt. Design finding.

### B-309 · change · Reminder emails show times in the recipient's zone with no zone label, 24-hour en-GB format; and 'monthly on the 29th–31st' silently skips short months (no 'last day' option)

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Two design findings from the calendars review; the first overlaps the translations PRD (i18n).

### B-310 · bug · Deleting a provider that a repeating series names stops that series for good: every top-up rolls back with providerNotFound

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. appointmentSeriesService.ts:171-177 links every series.providerIds to each new visit; entryProviderService.ts:45-51 refuses a soft-deleted provider; providerService.remove never touches provider_ids. Fix idea: skip deleted providers when linking. High.

### B-311 · bug · The series top-up reads every live series every minute and rewrites topped_up_through daily even on ended series (re-syncing them to every device)

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. appointmentSeriesService.ts:383-401: the horizon filter matches every topped-up series; the cron is every minute, pages of 100, each with a COUNT. Two reviewers.

### B-312 · bug · Server note text is often truncated or empty: compaction runs only inside an upload that adds an update (20 pending or 60 s), so the last updates of a session never fold in

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. sync.ts:900-911, noteDocumentService.ts:283-290. A note typed in under about 20 s keeps text '' until someone edits again. Readers use only text: the connector's list_timeline and upcoming, searchService.ts:217. docs/domain/live-notes.md lists the cron sweep (and a snapshot size cap) as not built. Fix idea: sweep in an existing cron, or fall back to currentText when updates are pending.

### B-313 · bug · Timeline and Planner load and watch every note document in the group (snapshot, text, pending updates) to preview 30 rows, rerunning on each co-member keystroke

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/live-notes/notes.sync.ts:23-28,51-62; timeline/useTimelineData.ts:150-152; planner/loadUpcoming.ts:23. Also unbounded: readingsQuery (timeline.sync.ts:387-393), doseChoicesQuery (medicationTimeline.sync.ts:87-96). Restrict to the window's entry ids. Two reviewers.

### B-314 · bug · Sign-in, reset-password and verify-email crash to the root error page when offline (the authClient calls aren't wrapped)

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/sign-in.tsx:61-92, routes/account/reset-password, verify-email. requestFailure's offline branch (lib/auth/authMessages.ts:34) is unreachable; the invite and join routes do catch TypeError.

### B-315 · bug · A removed member's open screen falls back to the first-loaded membership (write controls can come back), with no 'you no longer have access' state

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/app-shell/group.tsx:69-76: GroupProvider falls back to initial, not the last row as its comment says. Keep the last row and navigate to /app on its loss.

### B-316 · change · No unsaved-changes guard on any sheet or form: a click outside, Escape or Back discards a half-filled medication, emergency or provider form

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. components/ui/Sheet.tsx:47-51 (isDismissable); no useBlocker or dirty check anywhere. May belong with the ui-kit PRD's form primitives.

### B-317 · bug · The previous user's typed lines, recent searches and settings stay in localStorage when a different user signs in on the device

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/sync/client.ts:101-106 clears SQLite only on an owner mismatch; lib/auth/session.ts:173-188 holds the forget list. Run it on mismatch too.

### B-318 · bug · The app header ignores a simple-mode setting changed on another device until the next navigation

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/layout/useSimpleFrame.ts:33-38 reads cachedSettings() with no subscription. Low; will change with the Easy helper and Easy viewer roles PRD (simple-mode).

### B-319 · bug · Empty states flash before the first watch answer: a provider's linked entries ('No notes or events yet') and linked todos ('Former member')

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/groups/provider/LinkedEntries.tsx:21-31, components/todos/useLinkedTodos.ts: seeded with NO_ROWS. Low.

### B-320 · bug · safeRedirect accepts a path with a tab, CR or LF ('/<tab>/evil.com' resolves to another site)

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/core/redirect.ts:4-5. React Router 8.5.1's navigation check appears to block it today; verify-email's <Link to={next}> still renders the href. Reject control characters or compare origins. Two reviewers.

### B-321 · bug · A refused delete says nothing: UpcomingList voids removeEntry and useEntryRemoval never reads remover.data

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/groups/planner/UpcomingList.tsx, timeline/useEntryRemoval.ts. Low.

### B-322 · bug · The Planner sorts by the entry's zone but groups by the viewer's, so mixed-zone entries can list out of time order

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/appointments/upcoming.ts:50-58. Low.

### B-323 · bug · A failed local note_update insert loses the rest of the session's typing (pending is cleared before the insert; the catch only logs)

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. lib/live-notes/notes.sync.ts:160-175. Plausible. Requeue on failure.

### B-324 · change · Health data in page titles and URLs: entry, medication, provider and todo names in document.title and searches in ?q= persist in browser history after the sign-out wipe

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. routes/app/groups/entry/route.tsx:35, medication/route.tsx:45, provider/route.tsx:35, todo/route.tsx:35. Design finding; a decision for the user.

### B-325 · change · Native readiness: no top safe-area inset on the header or sticky day headers (viewport-fit=cover), and /app is a blank page on cold start for up to about 4 s (HydrateFallback returns null)

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. root.tsx:31,58. Only Sheet handles the inset. Belongs with Capacitor work when that starts.

### B-326 · chore · Docs drift: layout.md omits many folders and calls the Playwright specs 'headless Chrome checks'; five area docs name old *.mjs check files; AGENTS.md marks Playwright and print CSS as proposed; sync-config.yaml cites a pnpm powersync:restart that doesn't exist; .env.example lacks BETTER_AUTH_SECRETS; AGENTS.md omits the /series client-safe export

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Markdown and comments only. docs/layout.md is missing scripts/build, scripts/deploy, ops/, routes/connectors, packages/api/src/connectors, lib/calendars, lib/connectors and the planner, medication, profile and search route folders.

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

### B-362 · change · A soft-delete model factory and a shared upsert helper: nine models are the same file, twelve upserts repeat the exists-as-system, visible-as-actor sequence, 'invalid' is defined 18 times

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Device side too: refuse x10, invalid x8, canWrite x7, a FormData text() x9 although core/form.ts has formString, the identical shouldRevalidate in 32 routes.

### B-363 · change · One exported role-capability table (canWrite(role), canComplete(role)) used by services, device modules and screens, before any role is added

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. 'viewer' literals: 38 lines in 27 non-test files; WRITER_ROLES in lib/timeline/timeline.sync.ts:32 duplicates WRITERS in permissions/blocks.ts:75; sync-config.yaml:156 has role != 'viewer'; role checks leaked into packages/api care-groups/invites.ts:69-70 and joinRequests.ts:84-85. Collides with the Easy helper and Easy viewer roles PRD (simple-mode): do it first or inside it.

### B-364 · change · Device reads are 164 raw SQL strings with hand-typed row types, 17 files outside *.sync.ts: derive row types from the device schema and make libLayout.test.ts refuse SQL elsewhere

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. e.g. routes/app/groups/planner/upcomingQueries.ts, timeline/simpleRows.ts.

### B-365 · chore · Remove unused scaffolding and dead exports: serviceName (45 exports, 0 reads), the services registry, getService, isServiceName, initClient, isUserRoleName, isGroupRoleName, primaryContactName, hasContact, CALENDAR_CARDS, COMING_SOON

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Medium confidence, kept 'for later' per api.md: oRPC timeline.create|list|update|remove|latestVitals, careGroup.members, careGroup.recipientDetails, search.query. connectors/testing.ts and mintToken.ts are test helpers living in src.

### B-366 · chore · Pin dependencies exactly: 47 caret ranges remain (react-router, drizzle-orm, zod, vite among them) against AGENTS.md's rule

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Needs the user's word on each bump policy; no version changes, only the range form.

### B-367 · chore · Agent tooling: tests for the merge path (land.sh, pr.sh, ready.sh, review.sh: 465 lines, none), and with_backlog_lock removes a stale lock without re-checking, so two waiters can both take it

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. scripts/loops/lib.sh:329. Also: lease.sh still carries the old .loops/.browser path; 22 of 34 CARETOOK_* knobs are undocumented. Goes with B-239 to B-242.

### B-368 · chore · Comments that point at plans instead of behaviour: 198 'slice N' references in 154 source files and 262 PRD-name parentheticals

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Low; sweep opportunistically.

### B-369 · change · baseModel.list always runs a second COUNT query, and a sync PATCH costs about seven round trips (a 100-op batch about a thousand, serially)

- status: triaged
- prd: code-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. packages/data/src/models/base/baseModel.ts:163-168. Performance design finding.

### B-370 · chore · Quick check always runs the guards that read source by path (scripts/loops/sync-matrix.test.mjs, rolesSql.test.ts): vitest --changed can't select them

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. prd.sh:212. A new synced table or stream column passes a quick check with its guard never run. Overlaps B-272.

### B-371 · chore · Device-to-server round trip per table through the app's own writers, comparing column values on the second device (today: hand-written INSERTs, id only, browser suite only)

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. scripts/browser-checks/roundtrip.spec.mjs:556, sync-matrix.mjs. Component tests have no connector (apps/web/test/device.tsx); queuedWrites is used in two files. Also: seed device fixtures in the JSON shape PowerSync really delivers, validated against the server's Zod schemas (test/database.ts:187, test/fixtures.ts:290,332).

### B-372 · chore · A second time zone in tests: device, recipient and seed are all America/Los_Angeles in 106 of 113 component test files, while 29 production call sites read the device's zone

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Suggest a Vitest browser instance in America/New_York for the timeline, doses and appointments screens; pin TZ in the node projects.

### B-373 · chore · Role coverage gaps: a removed member writing or reading a care table, staff support on care tables, non-member writes through sync upload on 10 of 15 tables, and a real every-procedure unauthenticated sweep

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. router.int.test.ts:56 'rejects every procedure without a user' calls two. One parametrised sync test across HANDLERS covers most. Standing priority 2 (every role against every table) had no item. Overlaps B-283.

### B-374 · chore · A test for the device's uploadData: a 400 or 500 from sync.upload must not wedge the queue

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. apps/web/app/lib/sync/client.ts has no test. Goes with the sync-safety queue item.

### B-375 · chore · Small test fixes: calendars.int.test.ts:286 asserts code toBeTruthy (any error passes); timelineScroll.browser.test.tsx:163 carries retry: 2; check-areas maps packages/data and packages/api to no browser check; the web:unit project lacks the ~/ alias (120 deep relative imports)

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. B-278 and B-279 already cover the shared integration database and the frozen lists.

### B-376 · feature · Assistant chat with voice and questions about the timeline (B-12 is marked done, but only device-side quick entry shipped; no AI SDK is installed)

- status: triaged
- prd: assistant-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. Also B-58's 'AI-written questions come later' for the visit cheat sheet had no follow-up item.

### B-377 · feature · Push notifications for appointment reminders (B-61 shipped email only)

- status: triaged
- prd: calendars-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. No match for pushManager or web-push in the code.

### B-378 · chore · File the translations PRD's promised follow-ups: Spanish quick entry, language-aware search, a human review of the Spanish; and note 48 hard-coded 'en-US' formatters and English messages in schemas and the errors catalogue

- status: triaged
- prd: i18n
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. plans/i18n-prd.md says these are 'filed as follow-up backlog items'; none was. i18n-plan.md:324.

### B-379 · chore · Later contract migrations nobody tracks: dropping the old columns the simple-mode and planner-2 PRDs leave behind, and medications-2's default-passes backfill

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. From the dropped-threads sweep.

### B-380 · chore · Backlog hygiene: B-205 and B-206 are the same test failure; B-208 is tagged simple-mode but landed as a hotfix; B-88 is landed with no commit; B-222's title and inbox line disagree; about 150 items read 'live' from one release merge though production hasn't started

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Code review 2026-11-21, from a reviewer's reading, not re-verified by the backlog session. B-247 (Planner Upcoming | Past toggle) is triaged and unowned yet gates list-filters slice 4 and planner-2 slice 3.

### B-381 · bug · readTools.int.test.ts 'nothing private leaves' flakes when a random user UUID contains the birth year (e.g. …072194195bed matches '1941'): assert on fields, not a substring of the whole output

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Seen by planner-2 slice 1's full check (2026-11-21); passed on rerun.

### B-382 · bug · Repeating todos: an offline Undo's delete of the next occurrence lands unconditionally (todoOp removeTodo), deleting a successor another member edited or completed even though todoService.reopen kept it; tell an Undo's delete from an explicit one and apply it only when the server finds the successor untouched (todos.sync.ts:499)

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P1.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.

### B-383 · bug · Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.

### B-384 · bug · Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete)

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.

### B-385 · bug · Repeating todos: nextDueDay uses nextVisits' ~5-year search horizon, so a valid long-interval rule (e.g. FREQ=MONTHLY;INTERVAL=99) reads as ended and the chain stops; search to the rule's next occurrence or cap the accepted interval

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (prd/planner-2): The repeat sheet's interval input allows up to 99 (RepeatField.tsx max={99}), so this is reachable from the app.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to quick-fixes: a contained repeat-rule fix, one slice each, no sync design needed.

### B-386 · bug · Repeating todos: a successor moved back onto its source's day and ticked gets nextTodoId(repeatId, that next day) = its own id, so insertNext (and the device's planNext) sees the row as the existing next and the chain silently ends; handle ids taken by the source or a done occurrence

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, round 2, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to quick-fixes: a contained repeat-rule fix, one slice each, no sync design needed.

### B-387 · bug · Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin

- status: triaged
- prd: sync-safety
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, round 2, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (Robert Bo Davis): Codex found this again on PR #25 (dev into staging, reviewed at 2427f29c, 2026-11-21): still present, verified against the code. No new item filed.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to sync-safety: an offline, replay or concurrent-upload bug in the todo upload path, the same kind as B-285 to B-296.

### B-388 · bug · Integration flakes seen in 2026-11-21 full checks: the connector MCP tests (mcpWrites, mcp, readTools .int.test.ts) failed 14 times with 'Connection terminated' in the transcripts, and todoRename.int.test.ts 4 times; find the cause (dropped connections on the shared test Postgres under load?) and fix it

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (plan/check-speed): From the check-speed review of session transcripts (planner-2, quick-fixes, quick-entry, list-filters, tasks-2). Not confirmed that the error is what failed them. Triaged to quick-fixes: one contained test fix.

### B-389 · change · A PRD registry: the PRD table gets a state, the topics it comes after and its hot files, kept through pnpm backlog prd; row order is the priority

- status: landed
- prd: orchestration-2
- owner: prd/orchestration-2
- commit: 9cc81379

- 2026-11-21 (plan/orchestration-2): From the 2026-11-21 orchestration review; plan slice 1
- 2026-11-21 (Robert Bo Davis): HAND-OFF to a new planner (2026-11-21): the user wants this topic re-planned or carried on by a fresh planning session. Context: a review of the flow found 3,042 commits on dev in 5 days (1,065 backlog writes, 799 slice merges, 580 feat, ~350 on the orchestration tooling), load 37 on 10 cores with all browser leases held, ten topics waiting for a PRD, and the user accepting ~98% of planning recommendations. So the limits are the user and the machine, not planning quality. Done already on dev (f5965053): the planner decides then reports (What to ask, the Decisions table, the skeptic pass, docs/agents/preferences.md). The user's answers: the dispatcher starts EVERYTHING by PRD-table row order (the recommendation was a run list they order), and green waves land in dev before they try them. New rules from the user for the planner: (1) keep a PRD to a reasonable number of slices (about six is the planner's reading, not the user's number) so the next planner or the user can reprioritise; this plan has 8, so consider cutting it in two, e.g. registry + sessions + asks + rotation first, then the pick, unattended prompts and the dispatcher; (2) quick-fixes splits into categories that land separately (B-394); (3) questions must reach the user's phone. Unproven: that a helper started from a session's own shell outlives that session being ended (plan slice 4). The skeptic's findings and what was declined are in the PRD's Decisions section.
- 2026-11-21 (Robert Bo Davis): Correction to the hand-off note: the quick-fixes category split is B-395, not B-394.
- 2026-11-21 (plan/orchestration-2): Re-planned on plan/orchestration-2 (2026-11-21) as six slices: B-389 slice 1 (registry; the migration is mechanical and keeps row order), B-390 slices 2 and 4 (recorded sessions; rotation runs in the new tab), B-391 slices 3 and 5 (asks; the asking session sends the PushNotification, no push service), B-395 slice 6 (five standing topics fixes-ui, fixes-tooling, fixes-perf, fixes-bug, fixes-nit, added on hold with no order; the split and each item's category are in the plan). The dispatcher (B-392) is orchestration-3.

### B-390 · change · One orchestrator session per wave: recorded sessions and pnpm prd rotate, so a fresh session opens from Status after each landing

- status: in-progress
- prd: orchestration-2
- owner: prd/orchestration-2
- commit:

- 2026-11-21 (plan/orchestration-2): From the 2026-11-21 orchestration review; plan slice 2
- 2026-11-21 (Robert Bo Davis): HAND-OFF to a new planner (2026-11-21): the user wants this topic re-planned or carried on by a fresh planning session. Context: a review of the flow found 3,042 commits on dev in 5 days (1,065 backlog writes, 799 slice merges, 580 feat, ~350 on the orchestration tooling), load 37 on 10 cores with all browser leases held, ten topics waiting for a PRD, and the user accepting ~98% of planning recommendations. So the limits are the user and the machine, not planning quality. Done already on dev (f5965053): the planner decides then reports (What to ask, the Decisions table, the skeptic pass, docs/agents/preferences.md). The user's answers: the dispatcher starts EVERYTHING by PRD-table row order (the recommendation was a run list they order), and green waves land in dev before they try them. New rules from the user for the planner: (1) keep a PRD to a reasonable number of slices (about six is the planner's reading, not the user's number) so the next planner or the user can reprioritise; this plan has 8, so consider cutting it in two, e.g. registry + sessions + asks + rotation first, then the pick, unattended prompts and the dispatcher; (2) quick-fixes splits into categories that land separately (B-394); (3) questions must reach the user's phone. Unproven: that a helper started from a session's own shell outlives that session being ended (plan slice 4). The skeptic's findings and what was declined are in the PRD's Decisions section.
- 2026-11-21 (Robert Bo Davis): Correction to the hand-off note: the quick-fixes category split is B-395, not B-394.
- 2026-11-21 (plan/orchestration-2): Re-planned on plan/orchestration-2 (2026-11-21) as six slices: B-389 slice 1 (registry; the migration is mechanical and keeps row order), B-390 slices 2 and 4 (recorded sessions; rotation runs in the new tab), B-391 slices 3 and 5 (asks; the asking session sends the PushNotification, no push service), B-395 slice 6 (five standing topics fixes-ui, fixes-tooling, fixes-perf, fixes-bug, fixes-nit, added on hold with no order; the split and each item's category are in the plan). The dispatcher (B-392) is orchestration-3.

### B-391 · feature · One asks queue: unattended sessions file questions and landed-wave reports with pnpm prd ask; the user answers in one place

- status: in-progress
- prd: orchestration-2
- owner: prd/orchestration-2
- commit:

- 2026-11-21 (plan/orchestration-2): From the 2026-11-21 orchestration review; plan slices 3 and 5
- 2026-11-21 (Robert Bo Davis): HAND-OFF to a new planner (2026-11-21): the user wants this topic re-planned or carried on by a fresh planning session. Context: a review of the flow found 3,042 commits on dev in 5 days (1,065 backlog writes, 799 slice merges, 580 feat, ~350 on the orchestration tooling), load 37 on 10 cores with all browser leases held, ten topics waiting for a PRD, and the user accepting ~98% of planning recommendations. So the limits are the user and the machine, not planning quality. Done already on dev (f5965053): the planner decides then reports (What to ask, the Decisions table, the skeptic pass, docs/agents/preferences.md). The user's answers: the dispatcher starts EVERYTHING by PRD-table row order (the recommendation was a run list they order), and green waves land in dev before they try them. New rules from the user for the planner: (1) keep a PRD to a reasonable number of slices (about six is the planner's reading, not the user's number) so the next planner or the user can reprioritise; this plan has 8, so consider cutting it in two, e.g. registry + sessions + asks + rotation first, then the pick, unattended prompts and the dispatcher; (2) quick-fixes splits into categories that land separately (B-394); (3) questions must reach the user's phone. Unproven: that a helper started from a session's own shell outlives that session being ended (plan slice 4). The skeptic's findings and what was declined are in the PRD's Decisions section.
- 2026-11-21 (Robert Bo Davis): Phone notifications (the user's rule, 2026-11-21): a question must notify the user's phone. A macOS notification from a script does not. The PushNotification tool pushes to the phone when Remote Control is connected, but only a session can call it, so the asking session sends it right after pnpm prd ask (and for each report worth reading); pnpm prd ask itself can't. The planner should check whether anything a script can call reaches the phone before settling this.
- 2026-11-21 (Robert Bo Davis): Correction to the hand-off note: the quick-fixes category split is B-395, not B-394.
- 2026-11-21 (plan/orchestration-2): Re-planned on plan/orchestration-2 (2026-11-21) as six slices: B-389 slice 1 (registry; the migration is mechanical and keeps row order), B-390 slices 2 and 4 (recorded sessions; rotation runs in the new tab), B-391 slices 3 and 5 (asks; the asking session sends the PushNotification, no push service), B-395 slice 6 (five standing topics fixes-ui, fixes-tooling, fixes-perf, fixes-bug, fixes-nit, added on hold with no order; the split and each item's category are in the plan). The dispatcher (B-392) is orchestration-3.

### B-392 · feature · A dispatcher (pnpm prd dispatch) that plans and starts PRDs by registry order, dependencies, hot files and slots, and reopens dead sessions; pnpm prd queue just reorders

- status: triaged
- prd: orchestration-3
- owner:
- commit:

- 2026-11-21 (plan/orchestration-2): From the 2026-11-21 orchestration review; plan slices 4, 6 and 7
- 2026-11-21 (Robert Bo Davis): HAND-OFF to a new planner (2026-11-21): the user wants this topic re-planned or carried on by a fresh planning session. Context: a review of the flow found 3,042 commits on dev in 5 days (1,065 backlog writes, 799 slice merges, 580 feat, ~350 on the orchestration tooling), load 37 on 10 cores with all browser leases held, ten topics waiting for a PRD, and the user accepting ~98% of planning recommendations. So the limits are the user and the machine, not planning quality. Done already on dev (f5965053): the planner decides then reports (What to ask, the Decisions table, the skeptic pass, docs/agents/preferences.md). The user's answers: the dispatcher starts EVERYTHING by PRD-table row order (the recommendation was a run list they order), and green waves land in dev before they try them. New rules from the user for the planner: (1) keep a PRD to a reasonable number of slices (about six is the planner's reading, not the user's number) so the next planner or the user can reprioritise; this plan has 8, so consider cutting it in two, e.g. registry + sessions + asks + rotation first, then the pick, unattended prompts and the dispatcher; (2) quick-fixes splits into categories that land separately (B-394); (3) questions must reach the user's phone. Unproven: that a helper started from a session's own shell outlives that session being ended (plan slice 4). The skeptic's findings and what was declined are in the PRD's Decisions section.
- 2026-11-21 (Robert Bo Davis): Correction to the hand-off note: the quick-fixes category split is B-395, not B-394.
- 2026-11-21 (plan/orchestration-2): Re-plan (plan/orchestration-2, 2026-11-21): the dispatcher moved to the follow-on topic orchestration-3 so orchestration-2 stays at six slices (the user's rule). Its settled decisions and open questions are in plans/orchestration-2-prd.md, Follow-on; the earlier design is in git show da6db5db:plans/orchestration-2-plan.md (slices 5, 7, 8 and the planner half of 6). Plan it once orchestration-2 is in dev.

### B-393 · bug · Repeating todos: reopening Repeat on a 'last Friday' monthly todo whose occurrence falls on a 4th Friday and pressing Done turns BYDAY=-1FR into 4FR (todoFormData initialRepeat → choiceOfRule drops nth); the same shared choiceOfRule/choiceRule bug as B-234 for appointment series: one fix should cover both

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #23 (planner-2 wave 2, 2026-11-21); filed as a follow-up. P2. Slice 6 reported the same edge.
- 2026-11-21 (prd/quick-fixes): (prd/quick-fixes) Likely closed by quick-fixes slice 67 (B-234, PR #20): choiceOfRule now keeps a monthly BYDAY ordinal as keptWeekday and choiceRule writes it back, and todoFormData's initialRepeat goes through both. Recheck once PR #20 lands in dev; a todo-side test would confirm.
- 2026-11-21 (Robert Bo Davis): Moved from planner-2 (done) to quick-fixes: a contained repeat-rule fix, one slice each, no sync design needed.

### B-394 · bug · mcp.int.test.ts 'list_timeline: the group's entries in the recipient's zone, with note text, paged at 50' times out at Vitest's 5 s default under load (full check, 5-min load ~21); passes alone 3x

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/check-speed): Seen in check-speed's wave 1 full check, 2026-11-21 (only failure of 5338). The test builds a world and pages 50+ entries through /mcp; give it a longer timeout or a smaller world.

### B-395 · change · Split quick-fixes into categories that land separately: UI/UX, tooling, optimizations, bugfixes, nits (a plan or topic per category; the dispatcher treats each as a standing topic)

- status: triaged
- prd: orchestration-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): The user's rule, 2026-11-21. The order of priority between categories is NOT decided: the user will set it later, so don't invent one. Until the split, triage notes name a category (ui, tooling, perf, bug, nit) and the orchestrator groups a wave by category (docs/agents/planner.md, The plan's shape). 24 quick-fixes items were waiting on 2026-11-21 and need a category each.
- 2026-11-21 (plan/orchestration-2): Re-planned on plan/orchestration-2 (2026-11-21) as six slices: B-389 slice 1 (registry; the migration is mechanical and keeps row order), B-390 slices 2 and 4 (recorded sessions; rotation runs in the new tab), B-391 slices 3 and 5 (asks; the asking session sends the PushNotification, no push service), B-395 slice 6 (five standing topics fixes-ui, fixes-tooling, fixes-perf, fixes-bug, fixes-nit, added on hold with no order; the split and each item's category are in the plan). The dispatcher (B-392) is orchestration-3.

### B-396 · change · Redesign TabNav as a pill bar: a fully rounded floating container, plain text tabs, and the current tab as a tinted pill with optional icon and count badge

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the user (2026-11-21), who dislikes the current tabs-box look and gave a reference image: one rounded-full bar on a soft shadow (base-100 on the page in light; a dark raised surface with a faint border in dark); tabs are evenly spaced medium-weight labels with no boxes or dividers; the current tab gets a primary-tinted pill fill with primary text, an optional leading icon and an optional small solid count badge; hover shows a quiet fill. Keep TabNav's contract (a nav of links, aria-current, prefetch) and check contrast in both themes and overflow on phones (scroll or full width). Triage: ui-kit, since TabNav is a ui/ primitive and the gallery (B-270) should show it.
- 2026-11-21 (Robert Bo Davis): User (2026-11-21): the login box should also use this tab component. Sign-in is a light page, so the pill bar must be importable from ui/plain without React Aria, and if the login box switches by state instead of by link the component needs a button form as well as the link form.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).

### B-397 · change · Break long pages into clear vertical sections: a section rhythm for the page frame (spacing scale, titled cards, section headings, dividers) applied to the text-heavy pages

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the user (2026-11-21): pages read as long blocks of text; split the space vertically in a sensible way. Options proposed to the user, to choose from when the PRD is written: (1) each section a titled card on the base-200 page with a fixed gap; (2) small uppercase section labels with an icon and a one-line summary; (3) a two-step spacing scale, large between sections and small inside; (4) definition rows (label left, value right) instead of paragraphs; (5) collapsible secondary sections (details/summary) showing a summary line; (6) a sticky in-page section bar on long detail pages, using the new pill TabNav; (7) two columns on wide screens (main and side cards), one on phones; (8) summary tiles at the top of detail pages. Triage: ui-kit, with Card (B-260), Page frame (B-263) and DetailHeader (B-264), which this builds on.
- 2026-11-21 (Robert Bo Davis): User's direction (2026-11-21): full page-width background blocks for sections, i.e. each section is a band across the whole page width with its own background (alternating surfaces), content held to the column inside it; this replaces the titled-card base I recommended. The user gave no preference on the extras for long detail pages (collapsible sections, sticky section bar, two columns, summary tiles): undecided, ask again when the PRD is written.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): done here when the primitive exists and its first adopters use it (settings, sign-in, the five detail pages); the rest of the app is swept in ui-kit-2 (B-398).
- 2026-11-21 (plan/ui-kit): Planned (2026-11-21): bands on the five detail pages only, no extras yet (collapsible sections, sticky bar, two columns, summary tiles); the user said not to be asked about layout choices, so both are assumed and can be vetoed in the PRD's Decisions table.

### B-398 · change · Sweep every remaining area onto the UI kit primitives, one area per slice: medications; providers, profile forms and care periods; the Planner, to-dos and search; the timeline, entries and quick entry; admin, account, connectors, marketing and the app frame

- status: triaged
- prd: ui-kit-2
- owner:
- commit:

- 2026-11-21 (plan/ui-kit): From the ui-kit plan (2026-11-21): ui-kit builds the primitives and adopts them in settings, sign-in and the five detail pages; this is the rest (about 200 files: btn, alert, card, list, badge, checkbox and toggle class strings, Field control classes, the text opacities and link styles from B-267). Ends with the guard (B-269) so it stays swept.
- 2026-11-21 (plan/ui-kit): Also left for this sweep: the remaining 'No … yet.' lines and MedicationSheet's local Empty, the timeline's four skeleton files, the 15 Cancel and Save footers in sheets, section h2/h3 headings outside the detail pages, home's h1, the timeline and entry pages' containers, and icon sizes. /admin keeps its own heading sizes (a deliberate narrowing of B-263).

### B-399 · bug · Bottom menu on mobile need a better deign. I like floating menus. It needs to be a different bg…

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: Bottom menu on mobile need a better deign. I like floating menus. It needs to be a different bg color than the rest of the page and we can probably move to pure icon buttons instead of text buttons with aria tips
- 2026-11-21 (Robert Bo Davis): Triage: proposed ui-kit. A navigation redesign like B-396 (TabNav as a pill bar): the mobile bottom menu (SectionNav) floating, its own background, icon-only buttons with accessible names. The ui-kit plan is being written now (plan/ui-kit), so its planner takes it or leaves it for ui-kit-2. For the user's review.
- 2026-11-21 (plan/ui-kit): ui-kit plan (2026-11-21, plans/ui-kit-plan.md): taken into slice 2 with the pill tab bar. The bar floats, inset from the edges, on its own surface (neutral in light, base-300 in dark), icon-only links named by aria-label and title; the header's section links keep their text. Slice 2 now has a stack for the app-shell and roundtrip checks.

### B-400 · change · Timeline header has room for "Easy Mode" toggle now. move it out of eyeball menu and into the…

- status: triaged
- prd: simple-mode
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: Timeline header has room for "Easy Mode" toggle now. move it out of eyeball menu and into the header on the full app header to match simple mode.
- 2026-11-21 (Robert Bo Davis): Triage: proposed simple-mode. The Easy Mode toggle moves from the timeline's view (eyeball) menu into the full app header, matching the easy view's header. simple-mode slice 1 renames every simple* file and the role decides the view, so this goes inside or right after that PRD, not beside it. The PRD is written and not run: add it as a slice before starting. For the user's review.
- 2026-11-21 (plan/simple-mode): Planned: simple-mode slice 5 (stackless, wave 4 beside slice 4, after slice 3). An "Easy mode" button on the right of the full timeline's page header, mirroring the easy view's "Full app"; the View options menu loses the item. User chose the page header (not the top app bar), the label "Easy mode" and its own slice, 2026-11-21.

### B-401 · bug · check-run.sh's load reading can carry a blank line on Linux (sysctl fails under pipefail before the uptime fallback), splitting a check-times.log record across lines; normalise it to one number

- status: landed
- prd: check-speed
- owner: prd/check-speed
- commit: 44066ea0

- 2026-11-21 (prd/check-speed): Codex on PR #24 (check-speed wave 1, thread PRRT_kwDOVx-WLM66cJ0Q). macOS (our machine) reads sysctl fine, so no record is broken today. Fix: load5 filters blank lines and keeps one numeric field; a test with a failing sysctl stub.

### B-402 · bug · pnpm test:tooling runs only tooling:unit, so a tooling-only change to checks.mjs, check-areas.mjs, sync-matrix or check-times.mjs passes the docs-and-tooling gate without its own tests (they live in scripts:unit)

- status: landed
- prd: check-speed
- owner: prd/check-speed
- commit: 44066ea0

- 2026-11-21 (prd/check-speed): Codex on PR #24 (check-speed wave 1, thread PRRT_kwDOVx-WLM66cJ0S). Fix: test:tooling runs --project tooling:unit --project scripts:unit (scripts:unit takes ~1 s), or check-plan's tooling join adds it.

### B-403 · feature · A cleanup agent every few hours (pnpm prd tidy): finds finished sessions still open, finished worktrees and branches, and other leftovers; removes the safe ones and reports the rest

- status: triaged
- prd: orchestration-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Asked for by the user 2026-11-21 after a hand sweep by the backlog session. Not covered today: pnpm prd gc only lists merged slice worktrees and stacks stopped over a day, reclaim only disk; neither sees sessions, plan worktrees, branches or stale refs. What the hand sweep checked, as the task list: (1) sessions whose work is done but are still open (an orchestrator or planner whose worktree is gone or whose branch is in dev; idle backlog and stray main-checkout sessions): ask each over cross-session message whether it is done, then report it for closing (slice 2's recorded sessions give the list; closing a tab may need pnpm prd rotate's machinery); (2) worktrees left after the work landed: plan/<topic> worktrees level with dev and with no session, slice worktrees merged into their prd branch; remove with pnpm prd rm; (3) leftovers: local branches with no worktree (report unmerged ones, never delete them unasked), stale remote-tracking refs (git fetch --prune), caretook's dangling Docker volumes, lease and queue tickets whose pid is dead, test databases with no worktree, old .loops/.browser-hangs logs, finished items to archive (pnpm backlog archive) and PRD rows that are done. Rules: never touch a live worktree's build or Vite cache (reclaim --yes would, mid-check), never close a session or delete unmerged work without the user; anything not plainly safe goes to the asks queue (B-391) as one report. Found by hand that day: 4 finished sessions open (one for 5 h), 1 plan worktree, 1 unmerged 2-day-old slice branch, 7 stale remote refs, 6 dangling volumes, 61 items to archive, 4 stale PRD rows. Scheduling: a recurring run every few hours while any PRD runs; fits after slice 2 (sessions) and slice 3 (asks), or as the dispatcher's chore in orchestration-3 (B-392) if the orchestrator finds it too big for this PRD.
- 2026-11-21 (prd/orchestration-2): orchestration-2 slice 7 (wave 5, after slice 6): pnpm prd tidy sorts leftovers into safe (removed with --yes) and ask (one report ask); prompt.sh tidy is the haiku brief, repeated with /loop; the dispatcher's tick in orchestration-3 takes the scheduling over.

### B-404 · feature · One command to ship dev to staging: push dev, open the dev into staging PR, wait for Codex's review, triage its findings into the backlog (verified against the code, duplicates noted on the existing item), merge the PR when nothing is a blocker, and notify the user only when something is

- status: triaged
- prd: orchestration-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Asked for 2026-11-21 after doing it by hand on PR #25. Proposed for orchestration-3 (the dispatcher): same unattended tooling, and it can raise a blocker through orchestration-2's asks queue (pnpm prd ask). To settle in the PRD: what counts as a blocker (today's rule: critical and breaking only, the rest are follow-ups); staging changes only by PR and is deployed by deploy.yml; Codex signals no findings with a thumbs-up reaction and no review, so the wait reads its summary comment's state; a timeout when Codex never answers.

### B-405 · bug · Worker database names cut the base to 59 characters, so two worktrees of a long topic (~46+ chars) share their _w<n> copies: concurrent checks DROP each other's databases and rm drops both; keep a short hash of the full base when shortening, and match it in isOwnDatabase and test-db.sh

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (prd/check-speed): Codex P2 on PR #27 (thread PRRT_kwDOVx-WLM66cict); slice 4 named it too. No topic today is that long, so a follow-up.
- 2026-11-21 (prd/check-speed): check-speed is done (2026-11-21); proposed for test-health, whose slice 11 builds on the worker databases. Not urgent: no topic is long enough today.

### B-406 · feature · Set priority in the inbox, not the backlog: the user orders a short 'Next up' list in plans/inbox.md (plain lines, no ids or fields) and the dispatcher reads it as the order to plan and run, keeping the PRD table's row order in step; the user opens the backlog only when an agent asks

- status: triaged
- prd: orchestration-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Triaged to orchestration-3 (the dispatcher, B-392): it is the thing that picks by registry row order, so the inbox list becomes its input and the row order is derived. Questions reach the user through the asks queue (B-391, orchestration-2). Open for the PRD: what a line names (a topic in plain words, a filed bullet, or both), what happens to topics not listed (keep table order after the listed ones), and how an agent reports a line it cannot match (an ask, never a guess). The inbox stays the user's: agents still only append ids.
