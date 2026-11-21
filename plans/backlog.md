# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

Which PRDs exist, what each depends on, and the shared files it touches: orchestrators read this to choose what can run at the same time. At most three PRD orchestrators run at once.

| PRD               | Doc                                                          | Depends on                                           | Hot files                                                                   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `orchestration` | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): **done** (`94e6b80`) | — | none now |
| `live-notes-ux` | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done** | — | none now |
| `quick-fixes`     | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–46 in `dev` (44–46: B-135, B-134, B-157 in `2d57e70`); wave 13 (slices 47–51: B-184 to B-190) in `dev` (`bf0891df`); wave 14 (slices 52–57: B-192, B-198, B-201, B-191, B-174, B-175) in `dev`; waiting for wave 15: B-180, B-182, B-211 (B-207 landed as hotfix `fc373a34`); new fixes append as slice 58 on |  (none) | varies by slice; none now |
| `app-shell` | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done** | — | none now |
| `timeline-polish` | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done** | — | none now |
| `search` | [PRD](search-prd.md), [plan](search-plan.md): **done** (`a5f3d4d`) | — | none now |
| `providers` | [PRD](providers-prd.md), [plan](providers-plan.md): **done** (`7c075d1`) | — | none now |
| `medications` | [PRD](medications-prd.md), [plan](medications-plan.md): **done** (`8ff8354`) | — | none now |
| `medications-2` | [PRD](medications-2-prd.md), [plan](medications-2-plan.md): **done** (`a6738b4`) | — | none now |
| `assistant` | [PRD](assistant-prd.md), [plan](assistant-plan.md): **done** (`7f3ec10`) | — | none now |
| `connectors` | [PRD](connectors-prd.md), [plan](connectors-plan.md): **done** (`a08af6bd`) | — | none now |
| `providers-2` | [PRD](providers-2-prd.md), [plan](providers-2-plan.md): **done** (`df4d0c05`) | — | none now |
| `appointments-2` | [PRD](appointments-2-prd.md), [plan](appointments-2-plan.md): **done** (`f49aa958`) | — | none now |
| `connectors-2` | [PRD](connectors-2-prd.md), [plan](connectors-2-plan.md): **done** (`017a9b29`) | — | none now |
| `medications-3` | [PRD](medications-3-prd.md), [plan](medications-3-plan.md): **done** (`82221a92`) | — | none now |
| `list-filters` | [PRD](list-filters-prd.md), [plan](list-filters-plan.md): 4 slices, waves 1 → (2, 3) → 4: a shared `FilterMenu` (round sliders button, count badge, a dropdown of single-choice sections, removable chips) on the medications list, then the providers directory and the Todos tab, then the Planner (B-249). No migration, no deps, stackless. Replaces `medications-4` (B-213 was resolved by the tab split, B-226). **Ready to start**; slice 4 waits for B-247 | slices 1–3: (none); slice 4: B-247 in `dev` (a `quick-fixes` item) | `components/ui/` (index, `styles.ts`, the new `FilterMenu` and its model), `timeline/TimelineFilters.tsx` and `TimelineViewMenu.tsx` (an import only), `medications/MedicationFilters.tsx` and the list route, `providers/DirectoryFilters.tsx` and its route, `todos/TodoChips.tsx` and its route, the Planner's filter row (`PlannerHeader.tsx`), those screens' component tests |
| `medications-tabs` | [PRD](medications-tabs-prd.md), [plan](medications-tabs-plan.md): **done** (`07a6b59a`, PR #14) | — | none now |
| `conditions` | [PRD](conditions-prd.md), [plan](conditions-plan.md): **done** (`a95acb73`) | — | none now |
| `github-review` | [PRD](github-review-prd.md), [plan](github-review-plan.md): **done** (`63e225fb`, PR #12); follow-ups B-239 to B-242, B-244 | — | none now |
| `routing` | [PRD](routing-prd.md), [plan](routing-plan.md): **done** (`ff25ef2`) | — | none now |
| `components` | [PRD](components-prd.md), [plan](components-plan.md): **done** (`ca39416`) | — | none now |
| `invites` | [PRD](invites-prd.md), [plan](invites-plan.md): **done** (`e6286f4`) | — | none now |
| `marketing` | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user | — | none now |
| `profiles` | [PRD](profiles-prd.md), [plan](profiles-plan.md): **done** (`88890df`) | — | none now |
| `appointments` | [PRD](appointments-prd.md), [plan](appointments-plan.md): **done** | — | none now |
| `care-periods` | [PRD](care-periods-prd.md), [plan](care-periods-plan.md): **done** (`f6c4e92`) | — | none now |
| `data-rights`     | to write (B-52, B-53, B-84)                                  | (none)                                               | `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `ui-kit` | to write (B-257 to B-270): shared UI primitives from the 2026-11-21 component review (Button, form footer, messages, Card, lists, empty and loading states, page frame, DetailHeader, Badge, check and toggle rows, text tokens), then the sweeps, a guard and a dev gallery | `list-filters` and `planner-2` landed first (both edit the list and Planner screens the sweeps touch); `quick-fixes` between waves | `components/ui/` (its `index.ts`, `styles.ts`, `plain/`), `app.css`, `components/settings/SettingsPage.tsx`; the sweeps touch most route folders, so one area per slice and nothing else running in that area |
| `test-health` | [PRD](test-health-prd.md), [plan](test-health-plan.md) (B-271 to B-283): 19 slices in 7 waves, landing wave by wave. Waves 1 to 4: how checks run (the check lease and a load gate, quick check at hand-off, tooling tests in their own project, a database per worker, browser-check bookkeeping), the component harness (clock, one timeout, `getByCss`, lint rules as warnings) and the unit, server and Playwright cuts. Then it pauses; waves 5 to 7 are the component cuts, the area-by-area harness migration and the rules becoming errors | (none) for waves 1 to 4; waves 5 to 7 (slices 14 to 19) after `list-filters`, `planner-2` and `ui-kit` (they edit the same screens' tests); `quick-fixes` between waves | `vitest.config.ts`, `package.json`, `eslint.config.js`, `scripts/loops/` (`prd.sh`, `prompt.sh`, `lease.sh`, `checks`, `check-areas.mjs`, `check-areas.d/`, `test-db.sh`), `apps/web/test/` (`setup.ts`, `found.ts`), `packages/data/test/`, `scripts/browser-checks/` (the specs, `fixtures.mjs`), the frozen-list tests; from wave 5 the `*World.tsx` files and component tests in every area, one area per slice |
| `tasks` | [PRD](tasks-prd.md), [plan](tasks-plan.md): **done** (`1ee7864`) | — | none now |
| `documents`       | to write (B-56)                                              | hosting (B-33, file storage); `profiles` (soft); `encryption` decision | file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS`              |
| `encryption`      | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 | (none); affects `assistant` and `documents` | none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `onboarding`      | to write (B-31)                                              | `invites` (done)                                     | seeds, `careGroupService`, `/app` home                                     |
| `account-security` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) | `invites` (done); B-80 (the Devices page) first (soft) | `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `admin` | [PRD](admin-prd.md), [plan](admin-plan.md): **done** | — | none now |
| `check-migration` | [PRD](check-migration-prd.md), [plan](check-migration-plan.md): **done** (`c7fd1390`) | — | none now |
| `loop-recovery` | [PRD](loop-recovery-prd.md), [plan](loop-recovery-plan.md): **done** | — | none now |
| `hosting` | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent | (none) | none now |
| `app-speed` | [PRD](app-speed-prd.md), [plan](app-speed-plan.md): **folded into `timeline-ux`** (its PRD is the speed half's input) | — | none now |
| `agent-tooling` | [PRD](agent-tooling-prd.md), [plan](agent-tooling-plan.md): **done**, all 6 slices in `dev` (`5d5e1d7`): batched backlog commits, `pnpm log`, the doc budget guard, the core + `docs/agents/` split, the six area docs trimmed | (none) | none now |
| `code-layout` | [PRD](code-layout-prd.md), [plan](code-layout-plan.md): **done** (`18e9cf8`) | — | none now |
| `timeline-ux` | [PRD](timeline-ux-prd.md) (speed half: [app-speed PRD](app-speed-prd.md)), [plan](timeline-ux-plan.md): 10 slices, waves (1, 2, 3) → (4, 5, 6) → (7, 8, 9) → 10: navigation that doesn't wait, tiles that remember (dimmed until fresh), the bundle budget, prefetched tabs, one Today card with status hues, the day header with its summary and rows with the author under the menu and no period places, the service worker, simple mode's order and type scale, quick entry's rotating placeholder, open-after-save and lean recent lines, cheaper `/rpc` auth (B-136–B-140, B-144, B-155, B-156, B-162–B-171). **Done 2026-11-20**: all 10 slices in `dev` (8b3179ab); follow-ups B-174, B-175, B-178, B-179 | wave 1: none; wave 2 on: `code-layout` slice 5 in `dev` (`appUrls`), or coordinate with it | `lib/auth/session.ts`, `lib/auth/sessionRules.ts`, `lib/app-shell/me.ts`, `lib/sync/` (the remembering hook), `recentLines` (at code-layout's paths), `SectionNav`, the `/app` layout (update notice), the timeline route, its strips (replaced by `TodayCard`), `DayHeader`, `DaySummaryLine`, the row components, `PeriodMarkerItem`, `SimpleTimeline`, quick entry, `packages/auth`, `packages/api/src/procedures.ts`, `routes/rpc.ts`, `scripts/loops/prd.sh`, `scripts/loops/check-areas.d/`, new `scripts/build/` |
| `i18n` | [PRD](i18n-prd.md), [plan](i18n-plan.md): 11 slices, waves 1 → 2 → (3, 4, 5, 6) → (7, 8, 9, 10) → 11: a per-user language (English and Spanish, AI-drafted, review before launch) in `user.preferences` with a cookie for server rendering; typed catalogs on `i18next` and `react-i18next`; format helpers, error codes and label maps take the language; the app swept area by area; emails, the invite's language, calendar text and the public site at `/es/`; a lint rule against literal text (`eslint-plugin-i18next`, dev). Quick entry is a plain box for non-English users; search matching, the connector and `/admin` stay English (B-209). Slice 8 adds a migration (one nullable invite column); three dependencies approved 2026-11-21; slice 1 needs a stack. **Ready to start** once its start condition holds | `list-filters` (last item B-249), `planner-2` (last item B-248), the current `quick-fixes` wave and `simple-mode` (last item B-221) in `dev`; **runs alone** (tooling-only work beside it) | every user-facing string: all `/app`, sign-in and marketing routes, `components/`, `lib/core/format.ts` and the other format helpers, the label maps in `packages/data` schema, `userPreferences.ts`, `root.tsx`, the service worker, `packages/notifications` templates and registry, the invite schema and service, `calendarText.ts`, ESLint config, `pnpm-workspace.yaml`, `scripts/build/budget.json` |
| `timeline-ux-2` | [PRD](timeline-ux-2-prd.md), [plan](timeline-ux-2-plan.md): **done** (`f1fc883e`) | — | none now |
| `quick-entry` | [PRD](quick-entry-prd.md), [plan](quick-entry-plan.md): 4 slices, waves 1 → (2, 3, 4): one vocabulary table of kind-picking words (falls, seizures and the like are symptoms; 911, ER and urgent care are notes; visit verbs make events, contact verbs make notes), provider lines as events (titles, places), "the 25th" and month dates, forward for events and back for past-only kinds; notes that @-mention named providers (`addNote.providerIds`, both runners, the connector's `add_note`); a provider event's Save opens a prefilled new-event draft (mixed lines save the rest with Undo); kind chips on the cards (B-220). No migration, no deps, stackless. **Ready to start** once `timeline-ux-2` and `tasks-2` are in `dev` | `timeline-ux-2` in `dev` (last item B-224); `tasks-2` in `dev` (the to-do rename in actions, `actionPreview`, connector tools; last item B-222) | `packages/data` assistant schema (`quickEntry.ts`, `quickEntryTime.ts`, the new `quickEntryVocabulary.ts`, `assistantActions.ts`, `quickEntryPreview.ts`), `noteYjs.ts` (`noteDocFromText`), `assistantActionService`, the connector's `add_note`, `lib/assistant/` (`quickEntry.sync.ts`, `quickEntryDraft.ts`, `openAfterSave`), `components/quick-entry/` (`useQuickEntry`, `quickEntryCards.ts`, the card), the entry page's new-event draft |
| `planner-2` | [PRD](planner-2-prd.md), [plan](planner-2-plan.md): 7 slices, waves (1, 2) → (3, 4, 5, 6, 7): notes become past-only and reminders go (the rule, series are events only, the Planner, Today card and simple Next, the calendar projection's reminder kind, quick entry's future note becomes a todo, the connector's `upcoming` lists appointments and dated todos and `add_note` refuses a future time); todos can repeat (one open todo, the next made on tick; the form only) (B-248). Slice 2 adds a migration (three nullable `todo` columns); no deps; no data migration (staging is reseeded). **Running** (wave 1). Added 2026-11-21 at the user's word, as two wave 2 slices: the Planner's tabs on `TabNav`, the Upcoming \| Past toggle and its Filter menu (B-247, B-251, B-284), then the Planner without due doses and passes (B-246) | `quick-entry` in `dev` (done); slice 3 waits for its own new slice (B-247), no longer for `quick-fixes` | `entryTiming.ts`, `timelineEntryService`, the series service, `timeline.sync.ts`; the `todo` schema, `todoService`, `todos.sync.ts`, `todoOp`; `routes/app/groups/planner/`, `lib/appointments/upcoming*.ts`, the Today card and `SimpleNext`; `db/schema/calendars/` and the calendar services; `lib/assistant/` and the assistant schema; the todo form, list and page; `packages/api/src/connectors/`; seeds |
| `planner-3` | to write (B-245: a note can carry a todo with its own due day and assignee, the replacement for reminders; B-254: quick entry reads a repeating todo) | `planner-2` in `dev` (last item B-248) | the note editor and entry page, `todoService` and the todo schema (a link to its note), the Planner's todo rows, the Today card, the connector's `add_note` and `add_todo`; quick entry (B-254) |
| `connectors-3` | to write (B-252: a connector tool to read the dosing schedule beyond today; B-253: `add_todo` can make a repeating todo) | B-253 after `planner-2` in `dev` (last item B-248); B-252 has none | `packages/api/src/connectors/tools/` (`todaysDoses.ts` or a new schedule tool, `writes.ts`), the server instructions |
| `simple-mode` | [PRD](simple-mode-prd.md), [plan](simple-mode-plan.md): 4 slices, one per wave (1 → 2 → 3 → 4): the lock becomes two member roles, Easy helper (log-only, own entries, own todos) and Easy viewer; "simple" is renamed "easy" everywhere, database included; the role decides the view; the Planner, todo pages and search open for the easy roles (B-221, B-236). Migrations in slices 1, 2 and 3; sync config changes. **Ready to start** once its start condition holds | `list-filters` (last item B-249), `planner-2` (last item B-248) and the current `quick-fixes` wave in `dev` (slice 1 renames files they touch) | slice 1: every `simple*` file (`lib/assistant/simpleMode*`, `SimpleTimeline` and its blocks, quick entry, `TodoTick`, the `/app` layout), `sync-config.yaml`, the device schema; slice 2: `constants/roles.ts`, `permissions/` (blocks, types, timeline, todos, live-notes, connectors), `todoService`, the upload switch, `groupContext.ts`, the role picker; slice 3: group settings Members, `careGroupMemberService`, `useSimpleFrame`; slice 4: the Planner and todo routes, the search route |
| `tasks-2` | [PRD](tasks-2-prd.md), [plan](tasks-2-plan.md): **done** (`2db975a7`) | — | none now |
| `sync-safety` | to write (B-285 to B-296), from the 2026-11-21 code review (findings not re-verified): refused sync changes shown to the user, an upload queue that can't wedge, offline edits that don't revert a co-member's change, replayed PUTs, global client-chosen ids, the sign-out wipe and unsent writes, then the column-agreement test and one generic upload handler | (none); `test-health` shares the upload tests (B-371, B-374) | `packages/api/src/sync.ts`, `lib/sync/client.ts`, `SyncIndicator`, `session.ts`, `sign-out.tsx`, `medications.sync.ts`, `providers.sync.ts`, the services' `upsert`s |
| `dose-accuracy` | to write (B-297 to B-299), from the 2026-11-21 code review: a dose answers only its own day's slot, deterministic dose ids, visit prep's missed doses per schedule epoch | (none) | `db/schema/medications/dueDoses.ts`, `medications.sync.ts` (`logDoses`), `visitPrep.ts` |
| `quick-entry-2` | to write (B-300 to B-303), from the 2026-11-21 code review: negated doses, typed counts, wrong times, the stuck card | `planner-2` in `dev` (it edits quick entry's future note; last item B-248) | `db/schema/assistant/quickEntry.ts`, `quickEntryTime.ts`, `components/quick-entry/` |
| `calendars-2` | to write (B-304 to B-309, B-377), from the 2026-11-21 code review: Google deletes of past items, events beyond 90 days, reminder expiry, deleted providers in pushes, the consent version, reminder time labels, push notifications | `planner-2` in `dev` (it changes the calendar projection's reminder kind; last item B-248) | `packages/data/src/google/`, `calendarPullService`, `calendarSyncService`, `packages/notifications` (outbox, reminders) |
| `code-health` | to write (B-361 to B-369), from the 2026-11-21 code review: a `@caretook/data/domain` export, a soft-delete model factory and shared upsert, one role-capability table, typed device reads, dead exports, exact pins, tooling tests | the role-capability table (B-363) before or inside `simple-mode`; the rest after the running PRDs land (it touches most services and device modules) | `packages/data/src/db/schema/` exports, `models/`, `services/*Service.ts`, `lib/<area>/*.sync.ts`, `package.json`s, `scripts/loops/` |
| `assistant-2` | to write (B-376: assistant chat with voice and questions about the timeline, the part of B-12 that never shipped) | an AI vendor that doesn't retain or train (AGENTS.md, _Compliance_); the Vercel AI SDK needs the user's approval | `lib/assistant/`, a new server route, `packages/api` |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-25 | feature | staging | providers-2 | prd/providers-2 | @-mentions of providers inside live notes and events |
| B-31 | feature | triaged | onboarding |  | Demo group for every new user: a seeded, fictional care group to explore the app |
| B-33 | plan | triaged | hosting |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-48 | feature | staging | providers-2 | prd/providers-2 | Allow import of providers from other care groups that you have access to. |
| B-52 | feature | triaged | data-rights |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-60 | feature | staging | appointments-2 | prd/appointments-2 | Recurring appointments (weekly PT, dialysis three times a week) |
| B-61 | feature | staging | appointments-2 | prd/appointments-2 | Appointment reminders by email and push before the appointment |
| B-62 | feature | staging | appointments-2 | prd/appointments-2 | iCal feed of a care group's upcoming appointments |
| B-63 | feature | staging | appointments-2 | prd/appointments-2 | Google Calendar sync of a care group's appointments |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-145 | question | triaged | encryption |  | Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for… |
| B-174 | bug | staging | quick-fixes | prd/quick-fixes | Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page |
| B-175 | chore | staging | quick-fixes | prd/quick-fixes | Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6 |
| B-180 | bug | staging | quick-fixes | prd/quick-fixes | Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races |
| B-181 | feature | staging | conditions | prd/conditions | A conditions list on the care recipient's profile (diagnoses), so helpers and a connected assistant's recipient_profile can see them |
| B-182 | bug | staging | quick-fixes | prd/quick-fixes | providers.browser.test.tsx 'a practice's name finds its clinicians too; the Clinicians chip keeps the search…' flakes under load: after tapping Clinicians, the 'Current providers' list still has Dr. Samuel Patel when its expect.poll times out |
| B-183 | chore | triaged | hosting |  | Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons) |
| B-191 | bug | staging | quick-fixes | prd/quick-fixes | clicking the next entry in the upcoming section of the simple timeline should expand the section,… |
| B-192 | bug | staging | quick-fixes | prd/quick-fixes | undo when checking off a todo should list all the todos that were checked off, not just the last… |
| B-193 | feature | staging | connectors-2 | prd/connectors-2 | In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states |
| B-194 | feature | staging | connectors-2 | prd/connectors-2 | A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off |
| B-195 | feature | staging | connectors-2 | prd/connectors-2 | Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state |
| B-196 | feature | triaged | connectors-2 |  | List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting |
| B-197 | feature | staging | connectors-2 | prd/connectors-2 | Connector write tool add_condition (and resolve): a connected assistant adds or resolves a care recipient's condition through recipientConditionService |
| B-198 | bug | staging | quick-fixes | prd/quick-fixes | rotating placeholder in the timeline entry box is distracting and confusing. Use a static… |
| B-199 | bug | staging | medications-3 | prd/medications-3 | ability to add a medication quickly from the log a dose screen. |
| B-200 | bug | staging | medications-3 | prd/medications-3 | medications need a type field: rx, otc, supplement, etc. |
| B-201 | bug | staging | quick-fixes | prd/quick-fixes | simple timeline date header should show the care period as well |
| B-203 | feature | staging | github-review | prd/github-review | Now that we are we have github fixed, we should start using it for some of the merge management so… |
| B-204 | feature | staging | connectors-2 | prd/connectors-2 | connector should be able to edit notes and events so it can help you draft questions or add… |
| B-205 | bug | staging | quick-fixes | prd/quick-fixes | mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails at some times of day: give_pass on w.evening returns isError (line 160) |
| B-206 | bug | staging | quick-fixes | prd/quick-fixes | mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails in the evening: its Metformin dose a minute earlier fills the Evening pass, so give_pass says 'Nothing is left to give in Evening today' |
| B-207 | bug | staging | quick-fixes | hotfix/stack-healthcheck | pnpm prd stack up fails at migrate with 'Connection terminated unexpectedly': the compose Postgres healthcheck (pg_isready -U caretook -d caretook) passes against the socket-only init server; use -h 127.0.0.1 (powersync-storage has the same pattern) |
| B-208 | change | staging | simple-mode |  | you should be able to edit all entries, search, and filter in simple mode. |
| B-209 | feature | triaged | i18n |  | react-i18next or some other internationalization library to support multiple languages for all text… |
| B-210 | bug | staging | quick-fixes |  | Browser specs left stale by dev's timeline hotfixes: app-shell ([data-simple-toggle] gone), layout-offline ([aria-label="Cards"] gone) since 76375c07 (one View options menu); invites (first main a[href*=/entries/] is the collapsed Today card's Next link) since 1ff53864 |
| B-211 | change | staging | quick-fixes | prd/quick-fixes | link to group details edit page from the edit profile screen for editing the care recipient's… |
| B-212 | bug | staging | medications-3 | prd/medications-3 | icon order at top of medications page is not great. Add medication button should be a + icon. Print… |
| B-213 | bug | staging | medications-tabs |  | medications today schedule layout is confusing especially on mobile. Plan an improved layout for… |
| B-214 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | don't need patient name on the providers, medications, upcoming, or tasks page page, just need it… |
| B-215 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | move due now and usual around now into a dialog with an icon to toggle it on timeline quick entry… |
| B-216 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | suggestion dropdown for quick entry box should appear above elements instead of pushing elements… |
| B-217 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | If today is empty on the timeline, we need some kind of placeholder/prompt to add an entry. Page… |
| B-218 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | expand icon for day summary on timeline should be at the left of the day summary, not the right. |
| B-219 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | can the tooltip in the quick entry box appear inside the box instead of outside? That icon is also… |
| B-220 | change | staging | quick-entry | prd/quick-entry | Improve quick entry box to be more powerful and flexible. Things like "fell" creates an event,… |
| B-221 | feature | triaged | simple-mode |  | locked simple mode is really confusing. We may want to just add a new user type at this point for… |
| B-222 | feature | staging | tasks-2 | prd/tasks-2 | Tasks and todos are confusing. We should rename tasks "todos" or something similar and move them to… |
| B-223 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | in header care group drop down, we don't need to show the current care period line. New care group… |
| B-224 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | in the add timeline entry dropdown, vitals should be a menu entry with an expandable submenu for… |
| B-225 | bug | staging | quick-fixes | prd/quick-fixes | Component tests fail between midnight and about 5 a.m.: they put entries a few hours before now, which lands on yesterday (entryPrint 'an event's: title, time…' gets 'Yesterday, 10:18 PM' for /^Event · Today/; timelineCarePeriods 'a period at a place…' gets 'day 2'; timelineSimple 'a day header names the care period…' times out) |
| B-226 | change | staging | medications-tabs | prd/medications-tabs | Medications page should be tabbed into Schedule and Medications |
| B-227 | bug | dropped | quick-fixes |  | Component tests fail just after midnight America/Los_Angeles: 'today' fixtures made minutes or hours before now fall on yesterday (timelineSummaries, entryPrint 'an event's', timelineCarePeriods 'places', timelineSimple 'a day header names the care period') |
| B-228 | bug | ready | quick-fixes | prd/quick-fixes | Component tests still read attributes and values synchronously right after render: about 40 expect(X()!.getAttribute\|value\|dataset\|checked\|placeholder\|innerText…) sites (staff, entry, provider, timelineSheetUrls…), outside B-180's sweep |
| B-229 | bug | triaged | quick-fixes |  | on timeline page, header and Today section should be in same column width as the rest of the… |
| B-230 | bug | ready | quick-fixes | prd/quick-fixes | reminders.int.test.ts 'reminds a task's assignee, and skips a suppressed address' times out at 5000 ms under load in a full check (then 'turns reminders off from the email's unsubscribe link' gets Invalid URL); passes alone |
| B-231 | bug | triaged | quick-fixes |  | "Nothing logged today yet." message should be in a border box like a timeline entry box to match… |
| B-232 | bug | ready | quick-fixes | prd/quick-fixes | Google Calendar keeps pushing to a disabled account: calendarSyncService connectionsFor never checks user.disabledAt (the feed and pull paths do), so disabling a member doesn't stop new appointments and todos reaching their calendar |
| B-233 | bug | ready | quick-fixes | prd/quick-fixes | A repeating all-day visit today can't move to a new series: the server's pastVisit check uses occurredAt < now, but the UI and planSeriesEdit use isPastVisit (all-day visits count until the day ends), so the upload rejects today's visit and leaves it on the old series |
| B-234 | bug | ready | quick-fixes | prd/quick-fixes | Editing a 'last Friday' monthly series turns it into '4th Friday' when opened from a month with four Fridays: choiceOfRule keeps monthly.by but drops nth, and choiceRule rebuilds it from the visit's date (BYDAY=-1FR from 2027-02-26 becomes 4FR) |
| B-235 | bug | ready | quick-fixes | prd/quick-fixes | After Back restores the timeline, picking the current filter again in the same minute blanks the medication names (doses show 'Medication'): restored goes undefined, useTimelineMedications' initial becomes NO_ROWS, and useLiveQuery resets its rows without restarting the watch |
| B-236 | bug | triaged | simple-mode |  | In locked simple mode, SimpleNext's 'See all' (Upcoming) and task links look clickable but bounce back to the timeline: lockAllows only permits the timeline and entry routes |
| B-237 | bug | ready | quick-fixes | prd/quick-fixes | An @-mention that adds or imports a provider can overwrite note text: when the write finishes, useMentionPopup inserts into whatever popup is open now (a different @ query), else into the captured range, which isn't mapped through later edits |
| B-238 | bug | ready | quick-fixes | prd/quick-fixes | Log a dose's '+ New medication': switching to an existing medication and back clears the quick-add fields but keeps newDose, so choose() refills Amount with the old dose (a medication saved with no usual dose, logged as the discarded '2 tablets') |
| B-239 | bug | triaged | github-review |  | pnpm prd review: --json mode prints progress lines (asked Codex…, waiting) on stdout, so its output isn't valid JSON |
| B-240 | bug | triaged | github-review |  | pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75 |
| B-241 | bug | triaged | github-review |  | codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean |
| B-242 | bug | triaged | github-review |  | with_backlog_lock: on Linux, BSD 'stat -f %m' succeeds with non-numeric output before GNU stat is tried, breaking the lock-age arithmetic |
| B-243 | bug | staging | hosting |  | don't deploy developer previews to vercel, we don't have a dev db running and it is a waste of… |
| B-244 | chore | triaged | github-review |  | codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false |
| B-245 | plan | triaged | planner-3 |  | Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date |
| B-246 | change | triaged | planner-2 |  | Planner: remove due doses and passes from the Planner tab (they stay on the Today card and the Medications Schedule tab) |
| B-247 | change | in-progress | planner-2 | prd/planner-2 | Planner: Past becomes an 'Upcoming \| Past' toggle inside the Planner tab instead of its own tab |
| B-248 | change | in-progress | planner-2 | prd/planner-2 | Remove reminders: notes can no longer be dated in the future; use todos instead |
| B-249 | change | landed | list-filters | prd/list-filters | Collapse list filters under a shared Filter dropdown (round sliders button, count badge, removable chips): medications list, providers directory, todos, Planner |
| B-250 | bug | staging | quick-fixes |  | lint tests seem to be failing regularly because types haven't been generated. Maybe regression… |
| B-251 | bug | in-progress | planner-2 | prd/planner-2 | convert planner tabs to TabNav component. |
| B-252 | feature | triaged | connectors-3 |  | Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming |
| B-253 | feature | triaged | connectors-3 |  | Connector: add_todo can make a repeating todo (daily, weekly on days, monthly) |
| B-254 | feature | triaged | planner-3 |  | Quick entry: 'bins out every monday' makes a repeating todo |
| B-255 | bug | landed | list-filters | prd/list-filters | default filter on todos should be "everyone" and then reduce the list. |
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
| B-268 | chore | triaged | ui-kit |  | Move SeriesScopeDialog's raw <dialog> into a ui/ choice dialog on useShowModal |
| B-269 | chore | triaged | ui-kit |  | Guard the kit: a lint rule or layout test that keeps react-aria imports in ui/ and flags raw btn, card, badge and alert classes outside ui/ |
| B-270 | feature | triaged | ui-kit |  | Dev-only component gallery (/dev/ui): every primitive and its variants in both themes |
| B-271 | chore | triaged | test-health |  | Checks: slice loops run through the check lease (pnpm prd check, not bare pnpm check), and the lease waits while the machine load is high |
| B-272 | chore | triaged | test-health |  | Checks: quick check at slice hand-off and the full suite only at landing, with prd.sh forcing a full run on migrations, seeds, sync config, lockfile and package.json, plus a short always-run list |
| B-273 | chore | triaged | test-health |  | Checks: move the agent-tooling tests (scripts/loops, scripts/backlog, hooks) into their own Vitest project, run only when tooling changes |
| B-274 | chore | triaged | test-health |  | Component tests: one test clock on a fixed base date, reset per test, with harness deadlines on performance.now(); one shared fixClock |
| B-275 | chore | triaged | test-health |  | Component tests: one waitUntil in test/found.ts with one central timeout; no per-call milliseconds (lint rule) |
| B-276 | chore | triaged | test-health |  | Component tests: a retrying getByCss locator and world helpers that return locators, with lint rules against non-null reads in expect and userEvent calls and against fixed sleeps |
| B-277 | chore | triaged | test-health |  | Browser-check bookkeeping: drop the usual seconds and lean-ceiling test (keep the caps), and give check-areas directory defaults so a new file needs no rule |
| B-278 | chore | triaged | test-health |  | Integration tests: a database per Vitest worker, so files run in parallel |
| B-279 | chore | triaged | test-health |  | Unit tests: delete the frozen lists (schema exports, appUrls keys, procedure paths) and replace the frozen route list with native-build invariants |
| B-280 | chore | triaged | test-health |  | Unit tests: trim change detectors: URL tests that restate a template, marketing copy assertions, exact seed counts and names, label maps |
| B-281 | chore | triaged | test-health |  | Component tests: cut duplicates and brittle layout assertions; frame, harness and primitive tests use a probe route, not the timeline |
| B-282 | chore | triaged | test-health |  | Playwright specs: move one-device and no-browser steps out (marketing first), remove fixed sleeps, merge signout-wipe into session-end |
| B-283 | chore | triaged | test-health |  | Server tests: shared fixtures (createWorld, a sync and MCP test helper) and trim rules re-tested through sync upload and the connector; first move the member matrix and condition refusals down to the data layer |
| B-284 | change | in-progress | planner-2 | prd/planner-2 | Planner: move the All / Events / Todos filter under the shared Filter dropdown (FilterMenu), after B-247's Upcoming \| Past toggle |
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
| B-382 | bug | triaged | planner-2 |  | Repeating todos: an offline Undo's delete of the next occurrence lands unconditionally (todoOp removeTodo), deleting a successor another member edited or completed even though todoService.reopen kept it; tell an Undo's delete from an explicit one and apply it only when the server finds the successor untouched (todos.sync.ts:499) |
| B-383 | bug | triaged | planner-2 |  | Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating |
| B-384 | bug | triaged | planner-2 |  | Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete) |
| B-385 | bug | triaged | planner-2 |  | Repeating todos: nextDueDay uses nextVisits' ~5-year search horizon, so a valid long-interval rule (e.g. FREQ=MONTHLY;INTERVAL=99) reads as ended and the chain stops; search to the rule's next occurrence or cap the accepted interval |
| B-386 | bug | triaged | planner-2 |  | Repeating todos: a successor moved back onto its source's day and ticked gets nextTodoId(repeatId, that next day) = its own id, so insertNext (and the device's planNext) sees the row as the existing next and the chain silently ends; handle ids taken by the source or a done occurrence |
| B-387 | bug | triaged | planner-2 |  | Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin |

## Items

### B-25 · feature · @-mentions of providers inside live notes and events

- status: staging
- prd: providers-2
- owner: prd/providers-2
- commit: 680de235

- 2026-11-18 (Robert Bo Davis): Later, after providers' linking lands. Typing @ in a note's or event's text suggests providers; a mention links the provider like the With row. Needs @tiptap/extension-mention and @tiptap/suggestion (new dependencies: the user's approval). Out of scope for the providers PRD.
- 2026-11-18 (prd/providers): Triaged to providers by its orchestrator: @-mentions need the provider table and links (slices 1 and 5). A follow-up after slice 5, not in the current plan.
- 2026-11-20 (Robert Bo Davis): Moved from providers (done) to a new providers-2 PRD, to write (the user, 2026-11-20): B-48's cross-group permission rules want an interview, and B-25 touches the live-notes editor. Same commit: the PRD table's done rows shortened, rows added for providers-2 and appointments-2. -- backlog agent
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): B-25 is slices 1-2 (mentions; deps approved), B-48 slices 3-5 (import as a copy: writer here, any member there; three entry points; notes not copied). -- backlog agent

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

### B-48 · feature · Allow import of providers from other care groups that you have access to.

- status: staging
- prd: providers-2
- owner: prd/providers-2
- commit: fc0d2e20

- 2026-11-18 (Robert Bo Davis): Proposed as a providers follow-up (the PRD is done, like B-25): copy a provider from another group you belong to into this one (a copy, not a shared row, since providers are per group and synced per group). Needs a small PRD addendum or a quick-fixes slice once scoped.
- 2026-11-20 (Robert Bo Davis): Moved from providers (done) to a new providers-2 PRD, to write (the user, 2026-11-20): B-48's cross-group permission rules want an interview, and B-25 touches the live-notes editor. Same commit: the PRD table's done rows shortened, rows added for providers-2 and appointments-2. -- backlog agent
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): B-25 is slices 1-2 (mentions; deps approved), B-48 slices 3-5 (import as a copy: writer here, any member there; three entry points; notes not copied). -- backlog agent
- 2026-11-21 (prd/providers-2): slice 3 (import sheet) merged into prd/providers-2 as 0de633e1; slices 4, 5 remain

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

### B-60 · feature · Recurring appointments (weekly PT, dialysis three times a week)

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: f1cc1dbc

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-61 · feature · Appointment reminders by email and push before the appointment

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: edfcedf0

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-62 · feature · iCal feed of a care group's upcoming appointments

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: 6e343bd8

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-63 · feature · Google Calendar sync of a care group's appointments

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: f1cc1dbc

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2
- 2026-11-20 (slice/appointments-2/9): Slice 9 (pull + smoke) handed off: calendarPullService (googlePull cron step, 5-min pacing), interpretGoogleChange in google/pullPlan.ts, pnpm calendar:google-smoke (manual; not run against Google).

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

### B-174 · bug · Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 592a29ab

- 2026-11-20 (prd/timeline-ux): Found by timeline-ux slice 6 in the component-test router; check with the real ScrollRestoration before fixing.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-175 · chore · Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 970ff782

- 2026-11-20 (prd/timeline-ux): Slice 6 dropped places from the timeline; left in place to stay clear of slice 5.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-180 · bug · Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-20 (prd/check-migration): Left by slice 24 (B-176's sweep covered the click/fill/hover/type/clear sites). Convert to await expect.poll(...) or found(), keeping what each assertion reads. Proposed for check-migration. -- check-migration orchestrator
- 2026-11-20 (prd/check-migration): Also: two timelineLayout tests now inline the same 'wait until the element stops moving' loop (the author tooltip and the viewer's ⋯, both after the quick-entry chips shift the rows). A shared helper beside found() would fit. -- check-migration orchestrator
- 2026-11-20 (Robert Bo Davis): Moved from check-migration (done, c7fd1390) to quick-fixes (the user, 2026-11-20): the next quick-fixes wave appends them as slices (B-180 is a sweep across component tests; B-182 one test). -- backlog agent
- 2026-11-20 (Robert Bo Davis): Hotfix: the user started hotfix/test-fixes for the reported test issues (B-180, B-182, B-210), 2026-11-20.
- 2026-11-20 (Robert Bo Davis): Not in hotfix/test-fixes after all (user narrowed it to B-210); still for the next quick-fixes wave.

### B-181 · feature · A conditions list on the care recipient's profile (diagnoses), so helpers and a connected assistant's recipient_profile can see them

- status: staging
- prd: conditions
- owner: prd/conditions
- commit: bd045d7d

- 2026-11-20 (prd/connectors): From connectors slice 4 (B-104): story 22 promises the assistant reads the recipient's conditions, but no conditions field exists; recipient_profile returns allergies, code status, blood type and the note for helpers. The user chose (2026-11-20) to drop 'conditions' from the privacy text for now and file this. When built, add it to recipient_profile and the privacy page.
- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20: the user asked for a conditions PRD and plan, planned in this session
- 2026-11-20 (Robert Bo Davis): PRD and plan written 2026-11-20 (plans/conditions-prd.md, conditions-plan.md); the assistant's write tool is B-197

### B-182 · bug · providers.browser.test.tsx 'a practice's name finds its clinicians too; the Clinicians chip keeps the search…' flakes under load: after tapping Clinicians, the 'Current providers' list still has Dr. Samuel Patel when its expect.poll times out

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-20 (prd/connectors): Seen in connectors slices 1, 2 and 5 and in the connectors landing check (2026-11-20, load ~14, 410 s run); passes alone. The connectors PRD changes nothing under providers/. Line 73: expect.poll(listNames('Current providers')).toEqual(['Dr. Elena Alvarez']).
- 2026-11-20 (Robert Bo Davis): Moved from check-migration (done, c7fd1390) to quick-fixes (the user, 2026-11-20): the next quick-fixes wave appends them as slices (B-180 is a sweep across component tests; B-182 one test). -- backlog agent
- 2026-11-20 (Robert Bo Davis): Hotfix: the user started hotfix/test-fixes for the reported test issues (B-180, B-182, B-210), 2026-11-20.
- 2026-11-20 (Robert Bo Davis): Not in hotfix/test-fixes after all (user narrowed it to B-210); still for the next quick-fixes wave.

### B-183 · chore · Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-20 (hotfix/go-live): Repo is public (B-33), so run logs are public for 7 days. Use ::add-mask:: on email/reason inputs in admin-grant.yml, db-access.yml, rotate-jwks.yml; secrets are already masked.
- 2026-11-20 (Robert Bo Davis): Triage: hosting, part of going live (B-33): add ::add-mask:: in admin-grant.yml, db-access.yml, rotate-jwks.yml before production

### B-191 · bug · clicking the next entry in the upcoming section of the simple timeline should expand the section,…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 5a7d7238

- 2026-11-20 (prd/quick-fixes): From the inbox: clicking the next entry in the upcoming section of the simple timeline should expand the section, not take you to the next entry. once expanded, clicking on any item should take you to the full view of that item.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small simple-mode timeline fix (the Upcoming block's next entry expands the block; once open, each item opens its page). A slice in a later wave; the user reviews.

### B-192 · bug · undo when checking off a todo should list all the todos that were checked off, not just the last…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: f9109cad

- 2026-11-20 (prd/quick-fixes): From the inbox: undo when checking off a todo should list all the todos that were checked off, not just the last one that was checked off.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small tasks fix (the undo after checking off names every task checked off since, not just the last). A slice in a later wave; the user reviews.

### B-193 · feature · In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: c691be06

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): today nothing in the app tells a member the URL or where to add it; connectors-2 PRD, to write
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-194 · feature · A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: ea3cbc02

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): connectors-2 PRD, to write; touches notifications
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent
- 2026-11-21 (slice/connectors-2/2): Slice 2 built (90383609, eab9dfe4): assistant_request + migration 0030, assistantsRequested email, connector.requestEnable/myRequest, ask button on Assistants and /connect's empty state.

### B-195 · feature · Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: 0b8c30f7

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): MCP prompts were out of scope in connectors; connectors-2 PRD, to write
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-196 · feature · List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): after the production launch (B-33) and the privacy policy and terms (B-54); vendor review
- 2026-11-20 (Robert Bo Davis): Left out of the connectors-2 PRD (the user, 2026-11-20): after the launch (B-33) and the privacy policy (B-54); the PRD's Out of Scope lists what a listing needs. -- backlog agent

### B-197 · feature · Connector write tool add_condition (and resolve): a connected assistant adds or resolves a care recipient's condition through recipientConditionService

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: ea3cbc02

- 2026-11-20 (plan/conditions): Conditions planning 2026-11-20 (the user): conditions ship read-only to assistants; the writer is a follow-up, after the conditions PRD lands
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-198 · bug · rotating placeholder in the timeline entry box is distracting and confusing. Use a static…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 28d637a9

- 2026-11-20 (prd/conditions): From the inbox: rotating placeholder in the timeline entry box is distracting and confusing. Use a static placeholder that is a prompt to type something. and move to a ? with tooltip to explain the format/power.
- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Undoes timeline-ux's rotating placeholder (B-170ish) for a static prompt plus a ? tooltip on the format; quick entry only.
- 2026-11-20 (Robert Bo Davis): Correction to the note above: the rotating placeholder came from a timeline-ux slice (quick entry); ignore the 'B-170ish' guess.

### B-199 · bug · ability to add a medication quickly from the log a dose screen.

- status: staging
- prd: medications-3
- owner: prd/medications-3
- commit: b44af440

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. A small 'new medication' path from the log-a-dose sheet; reuses the medications form. If it needs B-200's type field, run after it.
- 2026-11-20 (plan/quick-fixes): 2026-11-20 (backlog session, the user): moved to medications-3, out of quick-fixes wave 14. The user's flow: an inline add in the log-a-dose sheet with name, dose and type (B-200's field), a link to add details on the medication's page, and the new medication picked for the dose; also offered in the no-medications empty state. Plan it with B-200.
- 2026-11-20 (plan/medications-3): PRD and plan written (plan/medications-3): 4 slices, 1 then (2, 3, 4). Types prescription/otc/supplement/other, required on new (default Rx), existing unset; Rx fields collapse for other types; list badge and ?type=, print grouped by type, search and list_medications; no change entry. B-199 is slice 4: '+ New medication' in the Dose sheet (name, dose, type; as needed), one local transaction, an 'Add details' toast, also the empty state.

### B-200 · bug · medications need a type field: rx, otc, supplement, etc.

- status: staging
- prd: medications-3
- owner: prd/medications-3
- commit: 26213ec5

- 2026-11-20 (Robert Bo Davis): Triage: medications-3 (to write). A new synced column (migration, sync rules, form, list filter, connector list_medications) with open choices (the type list, required or not, prescriber link); conditions is running and touches medications, so plan it to start after conditions lands.
- 2026-11-20 (plan/medications-3): PRD and plan written (plan/medications-3): 4 slices, 1 then (2, 3, 4). Types prescription/otc/supplement/other, required on new (default Rx), existing unset; Rx fields collapse for other types; list badge and ?type=, print grouped by type, search and list_medications; no change entry. B-199 is slice 4: '+ New medication' in the Dose sheet (name, dose, type; as needed), one local transaction, an 'Add details' toast, also the empty state.

### B-201 · bug · simple timeline date header should show the care period as well

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b1f0a6d0

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Simple mode's day header gains the care period label that the full day header already has.

### B-203 · feature · Now that we are we have github fixed, we should start using it for some of the merge management so…

- status: staging
- prd: github-review
- owner: prd/github-review
- commit: 6ece6441

- 2026-11-20 (Robert Bo Davis): From the inbox: Now that we are we have github fixed, we should start using it for some of the merge management so codex can review PRs. I do NOT want PRDs or plans to be in github, only the code. Instead of merging to dev locally, we need to start pushing working branches to github and creating a PR into dev, then waiting for codex to review, then addressing any comments, then merging to dev.
- 2026-11-20 (Robert Bo Davis): Triage: github-review (to write): pnpm prd land pushes the branch and opens a PR into dev, waits for Codex's review, addresses comments, then merges. Open: plans/ and the PRDs are already on origin/dev and origin/main (public repo), so 'code only on GitHub' means moving plans out of the repo or into an untracked/separate store; the live backlog commits onto dev, which then can't be PR-only.
- 2026-11-20 (Robert Bo Davis): User 2026-11-20: keep plans/ tracked as now; only code branches go through PRs and Codex review; backlog commits stay direct onto dev. Planning session: github-review.
- 2026-11-20 (plan/github-review): Planned in plans/github-review-plan.md (3 slices, waves 1 -> (2, 3)): Codex verdict and pnpm prd review; pnpm prd pr, land's PR path (prd/ always, hotfix --pr/--local asked each time, --no-review on the user's word), dev-sync; ready, prompts, rm. Plans, backlog and small changes stay local; the tooling pushes dev. Wave 1 lands locally, wave 2 through the new path.

### B-204 · feature · connector should be able to edit notes and events so it can help you draft questions or add…

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: c8c655b8

- 2026-11-20 (prd/appointments-2): From the inbox: connector should be able to edit notes and events so it can help you draft questions or add information to the entries.
- 2026-11-20 (Robert Bo Davis): Triage 2026-11-20: connectors-2 (a write tool beside add_note/add_event, like B-197). Notes and events are live Yjs docs, so an edit tool must append a server-side Yjs update (note_update) rather than overwrite, so open editors merge it; likely append-or-section-edit, not full replace. Same via tag and confirm-each-write as the other writes.
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-205 · bug · mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails at some times of day: give_pass on w.evening returns isError (line 160)

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 56b50a96

- 2026-11-20 (prd/conditions): Failed in conditions slice 4's full check (~21:20 EST 2026-11-20) and again alone on prd/conditions without slice 4 at 21:24 EST, load 31. Looks time-of-day dependent (the Evening pass vs now, or the Metformin dose logged a minute earlier covering it). Not caused by conditions.
- 2026-11-20 (prd/quick-fixes): Taken into quick-fixes as slice 58 (wave 14) at conditions' request; blocks evening full checks.
- 2026-11-20 (prd/conditions): Cause (conditions slice 2's agent): the test logs a Metformin dose 1 minute ago; between 20:00 and ~22:00 that dose answers the Evening (20:00) slot, so give_pass returns assistantActionService:nothingLeft ('Nothing is left to give in Evening today').

### B-206 · bug · mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails in the evening: its Metformin dose a minute earlier fills the Evening pass, so give_pass says 'Nothing is left to give in Evening today'

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 56b50a96

- 2026-11-20 (prd/appointments-2): Found by appointments-2 at 21:52 EST, 3/3 alone, on a branch with no connectors diff. Time-of-day dependent: pin the test's clock or log the dose against the morning pass. Fails pnpm check in the evening for every PRD.
- 2026-11-20 (prd/quick-fixes): Duplicate of B-205: quick-fixes slice 58 fixes both; done with it.

### B-207 · bug · pnpm prd stack up fails at migrate with 'Connection terminated unexpectedly': the compose Postgres healthcheck (pg_isready -U caretook -d caretook) passes against the socket-only init server; use -h 127.0.0.1 (powersync-storage has the same pattern)

- status: staging
- prd: quick-fixes
- owner: hotfix/stack-healthcheck
- commit: fc373a34

- 2026-11-20 (prd/quick-fixes): Found by quick-fixes slice 56 (failed 4x at low load; -h 127.0.0.1 locally fixed it). Proposed for a later quick-fixes wave.
- 2026-11-20 (hotfix/pg-healthcheck): Hotfix started and dropped (user's call); back to quick-fixes. Same socket-only race in docker-compose.shared-test.yml:41 (tmpfs, re-inits on every start) and scripts/loops/recover.sh wait_for_pg (docker exec pg_isready, no -h); docker-compose.test.yml inherits via extends. recover.test.mjs:458 matches only the prefix, so adding -h keeps it green.
- 2026-11-20 (prd/medications-3): medications-3 slice 1 (2026-11-20): `pnpm prd slice` failed at the stack's migrate in packages/data; `pnpm prd stack up` succeeded on retry.
- 2026-11-21 (hotfix/stack-healthcheck): Landed via hotfix/stack-healthcheck as fc373a34 (--force, no check, user's call): -h 127.0.0.1 on both docker-compose.yml healthchecks, docker-compose.shared-test.yml and recover.sh wait_for_pg.

### B-208 · change · you should be able to edit all entries, search, and filter in simple mode.

- status: staging
- prd: simple-mode
- owner:
- commit: 4e5e0187

- 2026-11-20 (Robert Bo Davis): Triage: a new small PRD (simple-mode), not a quick fix: simple mode drops the row ⋯ menus, search and filters on purpose, and the lock limits locked members to the timeline and entries/*, so it needs decisions (which edits, whether search/filter are a simple variant or the full ones, whether the lock still allows /search). Hot files: SimpleTimeline.tsx, TimelineEntryList, simpleModeLock.ts.
- 2026-11-20 (plan/simple-mode): Decision (user, 2026-11-20): simple mode reuses the full timeline's controls for now: the row ⋯ menus and edit sheets as on the full timeline, its magnifier/search, Filter button and chips (kind icons and authors as links). No simple variants yet. Done as hotfix/simple-mode, not a PRD.
- 2026-11-20 (hotfix/simple-mode): Landed as hotfix/simple-mode (4e5e0187): simple mode has the full ⋯ menus and sheets (locked too), FilterChips, kept filtered URLs; header search in simple mode unless locked (lock still blocks /search); row kind icons and initials stay plain (user's call).

### B-209 · feature · react-i18next or some other internationalization library to support multiple languages for all text…

- status: triaged
- prd: i18n
- owner:
- commit:

- 2026-11-20 (prd/conditions): From the inbox: react-i18next or some other internationalization library to support multiple languages for all text in the app.
- 2026-11-20 (Robert Bo Davis): Triage: a new big PRD (i18n). It touches every user-facing string (routes, ui/, emails, MCP text, dates and plural rules), so it should run alone or with tooling-only PRDs, ideally after the feature PRDs settle. Needs your approval for a new dependency (react-i18next/i18next, or a lighter alternative such as Lingui or FormatJS). Decide which languages and when it matters before launch.
- 2026-11-21 (Robert Bo Davis): PRD and plan written (plans/i18n-prd.md, i18n-plan.md): English and Spanish (AI-drafted, human review before launch), per-user language, app + emails + public site at /es/; quick entry parsing, search matching, the connector and /admin stay English. Dependencies approved 2026-11-21: i18next, react-i18next, eslint-plugin-i18next (dev). Runs alone, after list-filters, planner-2, the quick-fixes wave and simple-mode.

### B-210 · bug · Browser specs left stale by dev's timeline hotfixes: app-shell ([data-simple-toggle] gone), layout-offline ([aria-label="Cards"] gone) since 76375c07 (one View options menu); invites (first main a[href*=/entries/] is the collapsed Today card's Next link) since 1ff53864

- status: staging
- prd: quick-fixes
- owner:
- commit: 570293a2

- 2026-11-20 (prd/conditions): Found in conditions' landing --suite on prd/conditions (9/12, 2026-11-20 23:15); invites failed alone too at load 6. Not caused by conditions. Logs in .git/worktrees/conditions/caretook-browser/.
- 2026-11-20 (Robert Bo Davis): Hotfix: the user started hotfix/test-fixes for the reported test issues (B-180, B-182, B-210), 2026-11-20.
- 2026-11-20 (prd/conditions): Also test/device.browser.test.tsx:57 'fixtures render on a real route': getByText('Lisinopril 10 mg').first() can pick the collapsed Today card's hidden link (failed once in conditions' quick check at load 5, passed alone 2x): a race to fix, not rerun.
- 2026-11-20 (hotfix/test-fixes): Fixed in hotfix/test-fixes (570293a2): app-shell waits for View options and keeps search in unlocked simple mode (B-208 made the toHaveCount(0) stale too); layout-offline picks the layout from View options; invites looks in main ol > li; device test finds Lisinopril's row by role. Named tests only: the device file 3x, the three specs on a stack, lint, format, typecheck; landed --force on the user's word.

### B-211 · change · link to group details edit page from the edit profile screen for editing the care recipient's…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-20 (Robert Bo Davis): From the inbox: link to group details edit page from the edit profile screen for editing the care recipient's timezone.
- 2026-11-20 (Robert Bo Davis): Triage: one link on the profile edit screen to group settings' details: a quick-fixes slice.

### B-212 · bug · icon order at top of medications page is not great. Add medication button should be a + icon. Print…

- status: staging
- prd: medications-3
- owner: prd/medications-3
- commit: a4308e4a

- 2026-11-21 (prd/medications-3): From the inbox: icon order at top of medications page is not great. Add medication button should be a + icon. Print should just be the printer icon. Passes should be labeled between the two.
- 2026-11-21 (prd/medications-3): Proposed for medications-3 as slice 5 (wave 3, after slice 2: both touch the medications list header). Order the header: + icon (Add medication), the labeled Passes button, then a printer icon only (Print).
- 2026-11-21 (Robert Bo Davis): 2026-11-21: the user approved it as medications-3 slice 5 (wave 3, after slice 2).
- 2026-11-21 (prd/medications-3): medications-3 slice 5 started 2026-11-21. Overlap: timeline-ux-2 slice 1 later wraps this header in PageHeader; keep the order: + Add, labeled Passes, printer-only Print.

### B-213 · bug · medications today schedule layout is confusing especially on mobile. Plan an improved layout for…

- status: staging
- prd: medications-tabs
- owner:
- commit: 07a6b59a

- 2026-11-21 (prd/medications-3): From the inbox: medications today schedule layout is confusing especially on mobile. Plan an improved layout for passes, scheduled, and as needed.
- 2026-11-21 (prd/medications-3): Proposed for a follow-up PRD, medications-4: a redesign of Today's schedule (passes, scheduled, as needed) on mobile needs a PRD and plan, not a slice in medications-3.
- 2026-11-21 (backlog agent): Resolved by the Schedule | Medications tab split (B-226, 07a6b59a): the user, 2026-11-21, finds Today's schedule fine since. No redesign; medications-4 is not needed. The list's filters move under a Filter dropdown in list-filters instead.

### B-214 · bug · don't need patient name on the providers, medications, upcoming, or tasks page page, just need it…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: f58cd4b9

- 2026-11-21 (prd/medications-3): From the inbox: don't need patient name on the providers, medications, upcoming, or tasks page page, just need it in the print version where applicable. it shows in the header all the time. Can also remove entire profile section in top left of the timeline to reduce clutter. Move eyeball icon inline with search and filter icons and size them appropriately.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): timeline-ux-2, a declutter PRD to write: no recipient name in page headers (print only) and no profile corner on the timeline, the eye icon inline with search and filter, the day-summary expand icon on the left, the group dropdown reordered (no care-period line, New care group under the groups, Group settings last).
- 2026-11-21 (plan/timeline-ux-2): Planned (plans/timeline-ux-2-plan.md): slice 1 PageHeader and page headers without the name, Timeline h1 (B-214); slice 2 one toolbar with the eye at the right, icon circles (B-214); slice 3 chevron left (B-218); slice 4 group menu order (B-223). Waves (1, 3, 4) -> 2.

### B-215 · bug · move due now and usual around now into a dialog with an icon to toggle it on timeline quick entry…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (prd/medications-3): From the inbox: move due now and usual around now into a dialog with an icon to toggle it on timeline quick entry box.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 5 (wave 1): the three suggestion rows in a popover behind a Sparkles icon inside the box (dot when a pass is due; simple mode too), the help ? and examples dropped, Matching names as an overlay under the field.

### B-216 · bug · suggestion dropdown for quick entry box should appear above elements instead of pushing elements…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (prd/medications-3): From the inbox: suggestion dropdown for quick entry box should appear above elements instead of pushing elements below down the page.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 5 (wave 1): the three suggestion rows in a popover behind a Sparkles icon inside the box (dot when a pass is due; simple mode too), the help ? and examples dropped, Matching names as an overlay under the field.

### B-217 · bug · If today is empty on the timeline, we need some kind of placeholder/prompt to add an entry. Page…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: f58cd4b9

- 2026-11-21 (prd/medications-3): From the inbox: If today is empty on the timeline, we need some kind of placeholder/prompt to add an entry. Page looks goofy without it.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 6 (wave 2, after slice 5): "Nothing logged today yet." and "Add an entry" (focuses quick entry), writers in the full view with no filter.

### B-218 · bug · expand icon for day summary on timeline should be at the left of the day summary, not the right.

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (Robert Bo Davis): Triage (user's choice): timeline-ux-2, a declutter PRD to write: no recipient name in page headers (print only) and no profile corner on the timeline, the eye icon inline with search and filter, the day-summary expand icon on the left, the group dropdown reordered (no care-period line, New care group under the groups, Group settings last).
- 2026-11-21 (plan/timeline-ux-2): Planned (plans/timeline-ux-2-plan.md): slice 1 PageHeader and page headers without the name, Timeline h1 (B-214); slice 2 one toolbar with the eye at the right, icon circles (B-214); slice 3 chevron left (B-218); slice 4 group menu order (B-223). Waves (1, 3, 4) -> 2.

### B-219 · bug · can the tooltip in the quick entry box appear inside the box instead of outside? That icon is also…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (prd/medications-3): From the inbox: can the tooltip in the quick entry box appear inside the box instead of outside? That icon is also not very good.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 5 (wave 1): the three suggestion rows in a popover behind a Sparkles icon inside the box (dot when a pass is due; simple mode too), the help ? and examples dropped, Matching names as an overlay under the field.

### B-220 · change · Improve quick entry box to be more powerful and flexible. Things like "fell" creates an event,…

- status: staging
- prd: quick-entry
- owner: prd/quick-entry
- commit: b5252045

- 2026-11-21 (prd/medications-3): From the inbox: Improve quick entry box to be more powerful and flexible. Things like "fell" creates an event, providers do suggest like they should, but creates a note instead of an appointment. "Dr. Elena Alvarez on the 25th" creates a note as do most provider auto completes when it should be an event. Need to improve the logic for this.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): its own PRD to write, quick-entry: the parser picks the entry kind ("fell" makes an event, provider autocompletes and dates make appointments, not notes). It runs after quick-fixes' quick-entry slices (B-215, B-216, B-219).
- 2026-11-21 (Robert Bo Davis): 2026-11-21: now waits for timeline-ux-2 (B-215, B-216, B-219 moved there from quick-fixes).
- 2026-11-21 (Robert Bo Davis): Planned: plans/quick-entry-prd.md and -plan.md (4 slices, waves 1 → (2, 3, 4)); starts after timeline-ux-2 and tasks-2 are in dev.

### B-221 · feature · locked simple mode is really confusing. We may want to just add a new user type at this point for…

- status: triaged
- prd: simple-mode
- owner:
- commit:

- 2026-11-21 (prd/medications-3): From the inbox: locked simple mode is really confusing. We may want to just add a new user type at this point for locked simple mode. Or just review and fix all of the nits.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): a simple-mode PRD to write. Its interview decides between a new member type for locked simple mode and fixing the nits (touches roles and permissions).
- 2026-11-21 (Robert Bo Davis): PRD and plan written 2026-11-21 (plans/simple-mode-prd.md, simple-mode-plan.md): the lock becomes two roles, Easy helper and Easy viewer; simple is renamed easy. B-236 is slice 4 (the Planner, todo pages and search open for the easy roles). -- backlog session

### B-222 · feature · Tasks and todos are confusing. We should rename tasks "todos" or something similar and move them to…

- status: staging
- prd: tasks-2
- owner: prd/tasks-2
- commit: 1495e01a

- 2026-11-21 (prd/medications-3): From the inbox: Tasks and todos are confusing. We should rename tasks "todos" or something similar and move them to the Upcoming section... and maybe rename the upcoming page to something that covers both.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): a tasks-2 PRD to write: rename tasks to todos (or similar), fold them into Upcoming, and maybe rename Upcoming to cover both (routes, appUrls, sync, connector tool names).
- 2026-11-21 (plan/tasks-2): Planned (tasks-2, 2026-11-21): tasks become todos down to the table (one-step migration, production not live), Upcoming + Tasks merge into Planner (tabs Planner, Todos, Past; /planner, /planner/past, /todos; no redirects); 4 slices, waves 1 → 2 → (3, 4); starts after timeline-ux-2 is in dev.

### B-223 · bug · in header care group drop down, we don't need to show the current care period line. New care group…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (Robert Bo Davis): From the inbox: in header care group drop down, we don't need to show the current care period line. New care group should be below the care group selector section, not at the bottom of the drop down. group settings should be the last entry in the drop down.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): timeline-ux-2, a declutter PRD to write: no recipient name in page headers (print only) and no profile corner on the timeline, the eye icon inline with search and filter, the day-summary expand icon on the left, the group dropdown reordered (no care-period line, New care group under the groups, Group settings last).
- 2026-11-21 (plan/timeline-ux-2): Planned (plans/timeline-ux-2-plan.md): slice 1 PageHeader and page headers without the name, Timeline h1 (B-214); slice 2 one toolbar with the eye at the right, icon circles (B-214); slice 3 chevron left (B-218); slice 4 group menu order (B-223). Waves (1, 3, 4) -> 2.

### B-224 · bug · in the add timeline entry dropdown, vitals should be a menu entry with an expandable submenu for…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (Robert Bo Davis): From the inbox: in the add timeline entry dropdown, vitals should be a menu entry with an expandable submenu for each vitals type instead of a separate entry for each vitals type.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 7 (wave 1): ui/Menu gains inline expandable groups (no flyout: poor on touch); Vitals is one group in the + menu.

### B-225 · bug · Component tests fail between midnight and about 5 a.m.: they put entries a few hours before now, which lands on yesterday (entryPrint 'an event's: title, time…' gets 'Yesterday, 10:18 PM' for /^Event · Today/; timelineCarePeriods 'a period at a place…' gets 'day 2'; timelineSimple 'a day header names the care period…' times out)

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-21 (prd/connectors-2): Found by connectors-2's landing check at 3:18 a.m. on 2026-11-21; reproduced alone at low load. Fix: a fixed clock, or times anchored to the start of today.
- 2026-11-21 (Robert Bo Davis): Also covers B-227 (dropped as its duplicate): timelineSummaries and the minutesAgo(40) day-summary fixtures fail the same way from 00:00 to ~02:30 LA; fix them in the same pass.
- 2026-11-21 (slice/quick-fixes/61): slice 61: fixed 12:00 test clock in apps/web/test/setup.ts; VITE_TEST_CLOCK overrides

### B-226 · change · Medications page should be tabbed into Schedule and Medications

- status: staging
- prd: medications-tabs
- owner: prd/medications-tabs
- commit: 3f8c4d1c

- 2026-11-21 (Robert Bo Davis): Triaged to medications-4: splitting the page into Schedule and Medications tabs is part of B-213's redesign of the Today schedule, and the two touch the same files.
- 2026-11-21 (Robert Bo Davis): Moved to quick-fixes at the user's word (wave 15), out of medications-4.
- 2026-11-21 (Robert Bo Davis): Its own small PRD, medications-tabs, at the user's word (out of quick-fixes). It shares the medications page with medications-4 (B-213), so the two don't run at once.
- 2026-11-21 (Robert Bo Davis): Planned: plans/medications-tabs-prd.md and -plan.md (2 slices; slice 2 after timeline-ux-2 is in dev).

### B-227 · bug · Component tests fail just after midnight America/Los_Angeles: 'today' fixtures made minutes or hours before now fall on yesterday (timelineSummaries, entryPrint 'an event's', timelineCarePeriods 'places', timelineSimple 'a day header names the care period')

- status: dropped
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/timeline-ux-2): 2026-11-21 (prd/timeline-ux-2): 14 failures in timeline-ux-2's full check at 00:20 PST, e.g. 'Event · Yesterday, 10:17 PM' vs /^Event · Today, /; minutesAgo(40) day-summary fixtures. Fails every pnpm check from 00:00 to ~02:30 LA (03:00-05:30 EST). Fix: pin the clock (fixClock) or build today's fixtures after local midnight.
- 2026-11-21 (Robert Bo Davis): Duplicate of B-225 (same tests, same midnight cause); its cases are noted on B-225. Dropped at the user's word.
- 2026-11-21 (prd/quick-fixes): Same bug as B-225; quick-fixes slice 61 covers it (timelineSummaries added to its brief, 2026-11-21). Marked done with B-225. -- quick-fixes orchestrator

### B-228 · bug · Component tests still read attributes and values synchronously right after render: about 40 expect(X()!.getAttribute|value|dataset|checked|placeholder|innerText…) sites (staff, entry, provider, timelineSheetUrls…), outside B-180's sweep

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 76ad3e78

- 2026-11-21 (prd/quick-fixes): Found by quick-fixes slice 59 (B-180), 2026-11-21: same fix (await expect.poll / found()); proposed for a later quick-fixes wave. -- quick-fixes orchestrator
- 2026-11-21 (prd/quick-fixes): The tasks Undo test's sync reads after undoing were fixed in prd/quick-fixes 71dfbde4 (failed the wave 15 full check under load). -- quick-fixes orchestrator

### B-229 · bug · on timeline page, header and Today section should be in same column width as the rest of the…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/tasks-2): From the inbox: on timeline page, header and Today section should be in same column width as the rest of the timeline on large screens.
- 2026-11-21 (prd/quick-fixes): Proposed for quick-fixes (the user reviews): a small layout fix on the timeline at large widths; one slice in a later wave. -- quick-fixes orchestrator

### B-230 · bug · reminders.int.test.ts 'reminds a task's assignee, and skips a suppressed address' times out at 5000 ms under load in a full check (then 'turns reminders off from the email's unsubscribe link' gets Invalid URL); passes alone

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: d5701923

- 2026-11-21 (prd/quick-fixes): Seen in quick-fixes wave 15's third full check (2026-11-21 05:18, a 1523 s run under contention); 6/6 alone 3x. Likely a longer per-test timeout or less setup per test; the second failure looks like a knock-on. -- quick-fixes orchestrator

### B-231 · bug · "Nothing logged today yet." message should be in a border box like a timeline entry box to match…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/quick-entry): From the inbox: "Nothing logged today yet." message should be in a border box like a timeline entry box to match the rest of the page.
- 2026-11-21 (Robert Bo Davis): Triage: quick-fixes (the user reviews): a small style fix to timeline-ux-2's empty-Today placeholder (TimelineEntryList), one slice alongside B-229 (same timeline route, same wave). Avoid running it while quick-entry touches the empty Today's Add an entry.

### B-232 · bug · Google Calendar keeps pushing to a disabled account: calendarSyncService connectionsFor never checks user.disabledAt (the feed and pull paths do), so disabling a member doesn't stop new appointments and todos reaching their calendar

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 9f47380b

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P1, a data-access gap. accountAdminService.disable keeps the Google connection; calendarFeedService.resolve and calendarPullService.memberContext both refuse disabled users. Fix: join user and skip disabledAt in connectionsFor (or disconnect on disable), with an int test. Proposed first in the next quick-fixes wave, or a hotfix before the staging PR merges.
- 2026-11-21 (Robert Bo Davis): User 2026-11-21: nothing is live, so Codex findings go to follow-ups unless critical and breaking; this one waits for a normal quick-fixes wave, no hotfix.

### B-233 · bug · A repeating all-day visit today can't move to a new series: the server's pastVisit check uses occurredAt < now, but the UI and planSeriesEdit use isPastVisit (all-day visits count until the day ends), so the upload rejects today's visit and leaves it on the old series

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: c29f863a

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2. timelineEntryService update (the 'A series edit never rewrites a started visit' check) should call the shared isPastVisit from packages/data/src/db/schema/appointments/seriesEdit.ts with the group's time zone. One slice with an int test.

### B-234 · bug · Editing a 'last Friday' monthly series turns it into '4th Friday' when opened from a month with four Fridays: choiceOfRule keeps monthly.by but drops nth, and choiceRule rebuilds it from the visit's date (BYDAY=-1FR from 2027-02-26 becomes 4FR)

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: f4c84585

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2, confirmed in apps/web/app/lib/appointments/repeatChoice.ts. Keep the stored ordinal and weekday unless the user changes the repeat; a unit test round-tripping -1FR.

### B-235 · bug · After Back restores the timeline, picking the current filter again in the same minute blanks the medication names (doses show 'Medication'): restored goes undefined, useTimelineMedications' initial becomes NO_ROWS, and useLiveQuery resets its rows without restarting the watch

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 08633433

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2, an edge case. useTimelineData passes restored?.medicationRows with no loader fallback (links fall back to initial.linkRows, and useLiveRows keeps rows on a same-key initial change). Fix: a stable fallback, or have useLiveQuery keep rows when the key is unchanged.

### B-236 · bug · In locked simple mode, SimpleNext's 'See all' (Upcoming) and task links look clickable but bounce back to the timeline: lockAllows only permits the timeline and entry routes

- status: triaged
- prd: simple-mode
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2. Belongs with B-221's rethink of locked simple mode (allow those pages, or hide the links when locked). tasks-2 renames Upcoming to Planner and tasks to todos, so fix it after tasks-2 lands; if simple-mode isn't planned soon, a quick-fixes slice that hides the links when locked.
- 2026-11-21 (Robert Bo Davis): PRD and plan written 2026-11-21 (plans/simple-mode-prd.md, simple-mode-plan.md): the lock becomes two roles, Easy helper and Easy viewer; simple is renamed easy. B-236 is slice 4 (the Planner, todo pages and search open for the easy roles). -- backlog session

### B-237 · bug · An @-mention that adds or imports a provider can overwrite note text: when the write finishes, useMentionPopup inserts into whatever popup is open now (a different @ query), else into the captured range, which isn't mapped through later edits

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 7f84efb1

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 11 (dev → staging, cadadd63), checked against dev 2026-11-21: Codex P2, a follow-up (nothing live). In apps/web/app/components/notes/useMentionPopup.ts pick(): (live.current.open ?? current).insert. Fix: tie the insert to the original suggestion and map its range through the edits since, or drop the insert when that suggestion has closed; a component test with a slow add.

### B-238 · bug · Log a dose's '+ New medication': switching to an existing medication and back clears the quick-add fields but keeps newDose, so choose() refills Amount with the old dose (a medication saved with no usual dose, logged as the discarded '2 tablets')

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 8fd57267

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 11 (dev → staging, cadadd63), checked against dev 2026-11-21: Codex P2, a follow-up (nothing live). In DoseForm.tsx, QuickAddFields remounts on the switch and resets while the parent's newDose stays. Fix: keep the draft across switches, or reset newDose with the fields. DoseForm is in medications-4's hot files (not written yet), so not alongside it.

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

### B-243 · bug · don't deploy developer previews to vercel, we don't have a dev db running and it is a waste of…

- status: staging
- prd: hosting
- owner:
- commit: 8532372b

- 2026-11-21 (Robert Bo Davis): From the inbox: don't deploy developer previews to vercel, we don't have a dev db running and it is a waste of action credits. Only staging (branch: staging) and production (branch: main) should be deployed to vercel.
- 2026-11-21 (Robert Bo Davis): Checked 2026-11-21: already true. deploy.yml runs only on pushes to staging and main; Vercel's Git deploys are off (apps/web/vercel.json); GitHub has only staging and production deployments, no previews. Done inline on dev by the backlog session: workflows.test.mjs now fails if deploy.yml gains another trigger or branch, or another workflow runs on anything but workflow_dispatch.
- 2026-11-21 (Robert Bo Davis): Triaged by the backlog session: hosting (deploys). Already true and guarded by the test in 8532372b, so recorded as done at that commit.

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

### B-246 · change · Planner: remove due doses and passes from the Planner tab (they stay on the Today card and the Medications Schedule tab)

- status: triaged
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, agreed with the user: the Planner is for appointments and todos. Drop withDueDoses, UpcomingDoseRow and the pass rows from the Planner (lib/appointments/upcomingDoses.ts, plannerPasses tests); check whether the connector's upcoming tool lists doses and say so before changing it. UI only.
- 2026-11-21 (plan/planner-tabs): Backlog session 2026-11-21, at the user's word: moved from quick-fixes into planner-2 as new wave 2 slices (B-247, B-251 and B-284 in one slice that reworks the Planner's header and filter row once, before slice 3; B-246 in its own slice), so planner-2's slice 3 no longer waits on another PRD. The planner-2 orchestrator appends the slices to its plan. Upcoming | Past is two link chips; no further design of the filter look.

### B-247 · change · Planner: Past becomes an 'Upcoming | Past' toggle inside the Planner tab instead of its own tab

- status: in-progress
- prd: planner-2
- owner: prd/planner-2
- commit:

- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, agreed with the user: keep the /planner/past route and URL (Back, deep links, sheets closing back), drop Past from PlannerHeader's tab nav, add a two-option control of links in the filter row with the Planner tab active on both; Past stays events only (done todos stay under Todos). UI only.
- 2026-11-21 (Robert Bo Davis): Also, at the user's request (2026-11-21): the Planner tab's filter chips become All, Events, Todos (today All, Appointments, Reminders, with todos hidden under any chip). Events is ?kind=event; Todos is a new todos-only filter (not a timeline kind: upcomingFilters, showsTodos in lib/todos/plannerTodos.ts, useUpcomingData, PlannerFilterChips, the empty text). The Reminders chip goes; until B-248 removes reminders they show only under All. Rework the filter row once, with the Upcoming | Past control.
- 2026-11-21 (plan/planner-tabs): Backlog session 2026-11-21, at the user's word: moved from quick-fixes into planner-2 as new wave 2 slices (B-247, B-251 and B-284 in one slice that reworks the Planner's header and filter row once, before slice 3; B-246 in its own slice), so planner-2's slice 3 no longer waits on another PRD. The planner-2 orchestrator appends the slices to its plan. Upcoming | Past is two link chips; no further design of the filter look.

### B-248 · change · Remove reminders: notes can no longer be dated in the future; use todos instead

- status: in-progress
- prd: planner-2
- owner: prd/planner-2
- commit:

- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, the user's decision: a reminder (a future-dated note) goes away in favour of todos. Notes become past-only on the device and the server; remove Reminder from the Planner's + menu, the Planner rows and kind filter, the Today card and simple mode's next, the calendar projection's reminder kind (feed, Google push and pull, reminder emails, Remind me), quick entry's future-note reading and the connector's upcoming and add_note. No data migration (nothing live): seeds change, existing future notes are not converted. Starts after quick-entry (B-220) is in dev: it rewrites the same date rules. B-245 (attach a todo to a note) is the later follow-up.
- 2026-11-21 (plan/planner-2): Planning session 2026-11-21: PRD and plan written (plans/planner-2-prd.md, planner-2-plan.md), 7 slices in 2 waves. The user's decisions: quick entry's future note becomes a todo due that day; repeating todos are added here (one open todo, the next made on tick, next rule day after today, same repeat choices as appointments, Delete asks skip or stop; form only); the connector's upcoming lists appointments and dated todos and add_note refuses a future time with a pointer to add_todo; no data migration, staging is reseeded after the deploy. Follow-ups filed: B-252 and the two repeat entry points.

### B-249 · change · Collapse list filters under a shared Filter dropdown (round sliders button, count badge, removable chips): medications list, providers directory, todos, Planner

- status: landed
- prd: list-filters
- owner: prd/list-filters
- commit: 534ee5e0

- 2026-11-21 (backlog agent): Backlog session 2026-11-21, the user's request while planning B-213: the medications list's status and type chips collapse under a Filter icon styled like the timeline's round controls; a shared ui/ component; also the providers directory, todos and the Planner (its slice waits for B-247). The search boxes stay visible; the timeline keeps its Filter sheet.
- 2026-11-21 (prd/list-filters): Slices 1–3 (medications, providers, Todos) done; slice 4 (the Planner) split out to B-284 in quick-fixes on the user's word, since B-247 isn't scheduled.

### B-250 · bug · lint tests seem to be failing regularly because types haven't been generated. Maybe regression…

- status: staging
- prd: quick-fixes
- owner:
- commit: 8da818be

- 2026-11-21 (Robert Bo Davis): From the inbox: lint tests seem to be failing regularly because types haven't been generated. Maybe regression introduced by reordering the steps in check?
- 2026-11-21 (Robert Bo Davis): Triage: tooling bug in the check pipeline (lint needs React Router's generated types; suspect the reordered steps in pnpm check). Small and self-contained, so quick-fixes next wave; if it blocks checks now, a hotfix on dev is the faster path.
- 2026-11-21 (Robert Bo Davis): Landed as a hotfix (hotfix/check-typegen, merge caea6779, land --force on the user's word after full lint and format passed): pnpm lint and lint:fix run a new pnpm typegen first.

### B-251 · bug · convert planner tabs to TabNav component.

- status: in-progress
- prd: planner-2
- owner: prd/planner-2
- commit:

- 2026-11-21 (Robert Bo Davis): Triage: small UI change next to the other Planner tab items (B-246, B-247) in quick-fixes; do it with or after B-247, which changes the same tabs.
- 2026-11-21 (plan/planner-tabs): Backlog session 2026-11-21, at the user's word: moved from quick-fixes into planner-2 as new wave 2 slices (B-247, B-251 and B-284 in one slice that reworks the Planner's header and filter row once, before slice 3; B-246 in its own slice), so planner-2's slice 3 no longer waits on another PRD. The planner-2 orchestrator appends the slices to its plan. Upcoming | Past is two link chips; no further design of the filter look.

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

### B-255 · bug · default filter on todos should be "everyone" and then reduce the list.

- status: landed
- prd: list-filters
- owner: prd/list-filters
- commit: 6471195a

- 2026-11-21 (Robert Bo Davis): Triage: the todos filter's default (everyone, then narrow). Proposed for list-filters (B-249 shared Filter dropdown), which is rewriting the todos filter now; in quick-fixes it would collide on the same files. If list-filters lands first, move to quick-fixes.

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

### B-258 · change · Form footer primitive (Cancel and Save row) for sheets and forms; settings' SaveRow builds on it

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 15 Cancel/Save footers in 6 layouts (flex justify-end gap-2 pt-3, pt-2, flex-wrap…, ml-auto); SaveRow (components/settings) is the only shared one and is settings-only. Depends on the Button item.

### B-259 · change · Message primitives: one inline error/status line and one Notice box, replacing 93 role=alert and 54 role=status hand-written lines

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: <p role=alert className='text-error text-sm'> is copied about 80 times (class order and margins drift); success lines are text-success text-sm or alert alert-success alert-soft; 20 alert boxes use 15 class variants (soft or not, text-sm or text-base, py-2). Owns role, tone, icon and empty:hidden.

### B-260 · change · Card primitive in ui/ (titled section card); SettingsCard and the route cards use it; one card title size

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 'card bg-base-100 shadow-sm' + card-body is hand-written 24+ times (19 as <section>), card-body gap is 1/2/3/4 or none, card-title is plain, text-base, text-lg or text-2xl. SettingsCard already wraps the same markup but lives in components/settings.

### B-261 · change · List primitives: one bordered, divided list box and a row, replacing six hand-written variants

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: about 30 lists. 'rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border' x11 plus variants without overflow-hidden or bg, and divide-base-300 ones (x13 plain, x4 boxed, class order differs); rows pad py-2, py-2.5 or py-3, with or without px-3. Dividers should be base-300 per the Surfaces rule; divide-base-200 breaks it.

### B-262 · change · Empty and loading states: an EmptyState line (optional action) and one Skeleton/Loading placeholder

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 24 'No … yet.' messages in three stylings (text-base-content/70 text-sm x15, without text-sm x5, plain text-sm x5); MedicationSheet has its own local Empty. Loading is a skeleton in 4 timeline files, 'Loading…' text in GoogleCard, a spinner in FirstSyncPending, and nothing elsewhere.

### B-263 · change · Page frame: a Page container and one heading scale; every section page uses PageHeader

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: <main className='mx-auto max-w-2xl space-y-4 px-4 py-5'> is copied 13 times with 10 more variants (max-w xl/2xl/3xl/4xl, py-5/6/10, p-4 sm:p-6). 39 files write an h1; only 4 routes use PageHeader, and periods, passes and profile hand-write the same text-lg h1. h1 is text-lg (section pages), text-xl (detail pages), text-2xl (home, settings) and card-title (all of admin). Section h2/h3: 'font-semibold' x17 and 12 other styles. Related: B-229 (timeline header column width).

### B-264 · change · DetailHeader primitive for the provider, care period, todo, medication and profile pages

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: ProviderHeader, PeriodHeader, TodoHeader and MedicationHeader copy the same header line for line: a size-9 icon disc (primary or muted), h1 text-xl with badges, a details line, and the editors and actions regions (data-region). ProfileHeader is a fifth near copy. Callers pass icon, tone, title, badges, details, editors, actions.

### B-265 · change · Badge primitive with named tones and one size

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 48 badges in 34 files, 25 class variants (badge badge-ghost badge-sm vs badge badge-sm badge-ghost, soft and outline mixed, gap-1, shrink-0, whitespace-nowrap added ad hoc). Status meanings (Primary, Past, Now, overdue, stopped) pick tones per file. ViaTag stays as is.

### B-266 · change · Checkbox and toggle rows (CheckField, ToggleField), and Field-owned control classes so callers stop passing 'input w-full'

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: 39 checkboxes and 20 toggles sit in 15 different hand-written <label> wrappers (label text-base-content cursor-pointer gap-2…, flex items-start gap-3…; mt-0.5 nudges; sizes sm or default). Field callers pass the control class themselves: 'input w-full' x65, 'select w-full' x15, 'textarea w-full' x12, plus *-error by hand x17. components.md says every labelled control is a Field; checkboxes and toggles have no primitive.

### B-267 · change · Text and icon tokens: named muted and faint text, inline link style, icon sizes

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: secondary text uses 8 opacities (text-base-content/70 x307, /80 x35, /60 x32, /50 x16, /40, /75, /85, /90) with no rule for which; inline links have 15 class variants (link, link font-medium, link link-primary, link link-hover text-primary…); icons are size-4 mostly, with size-3, 3.5, 5 mixed in like roles. Define the tokens in app.css or ui/styles.ts and sweep.

### B-268 · chore · Move SeriesScopeDialog's raw <dialog> into a ui/ choice dialog on useShowModal

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: components/entry/SeriesScopeDialog.tsx is the only raw <dialog> outside ui/, so it skips ConfirmDialog's wait-for-menu-close and focus rules. A three-choice dialog primitive (or ConfirmDialog with a second action) covers it.

### B-269 · chore · Guard the kit: a lint rule or layout test that keeps react-aria imports in ui/ and flags raw btn, card, badge and alert classes outside ui/

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: no no-restricted-imports or class guard found in the ESLint configs; the rules in components.md are held by review only (react-aria is clean today). Add after the primitives land, with an allowlist for marketing and print sheets.

### B-270 · feature · Dev-only component gallery (/dev/ui): every primitive and its variants in both themes

- status: triaged
- prd: ui-kit
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Review 2026-11-21: nothing shows the kit in one place, so drift is only visible by grep. A web-only dev route beside /dev/mail, fictional data, no new dependency. Also fix docs/layout.md's ui/ list, which is behind components.md (no PageHeader, TabNav, ComboBox, ChipList, Toast, ViaTag, Highlight).

### B-271 · chore · Checks: slice loops run through the check lease (pnpm prd check, not bare pnpm check), and the lease waits while the machine load is high

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). Loops bypass the lease (loop.md:13,37; prompt.sh:183,211); only prd.sh:212,217 takes it; Vitest runs have no load gate (browser.sh:450 gates only the retry). 38 of 53 logged browser flakes were at load above 30; a threshold near 20 is suggested.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-272 · chore · Checks: quick check at slice hand-off and the full suite only at landing, with prd.sh forcing a full run on migrations, seeds, sync config, lockfile and package.json, plus a short always-run list

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). vitest --changed misses files read by path (SQL migrations, sync-config.yaml, sync-matrix.test.mjs, libLayout, securityHeaders, errors tests), deleted files, the check-areas lint and the budgets. A 3-slice wave runs 3 full suites plus 1 to 5 gate checks today.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

### B-273 · chore · Checks: move the agent-tooling tests (scripts/loops, scripts/backlog, hooks) into their own Vitest project, run only when tooling changes

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 240 of 306 scripts:unit tests guard agent workflow; 17 of 27 files spawn processes, lease and browser tests sleep for real. Keep in the default run: sync-matrix, check-areas, deploy/workflows, scripts/build. Also: check-gate.test.mjs rebuilds a git repo per test; prompt.test.mjs asserts prompt phrases.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

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

- status: triaged
- prd: test-health
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): 2026-11-21 test review (static, nothing run; counts are estimates). About 20 files touch global state (app_setting wipes, unscoped sweeps in reminders, outbox, calendarPull, rateLimit, JWKS rotation, todoRename), so parallel files on one database is fragile. Per-worker databases need no test changes (globalSetup, setup, testDatabase.ts:17, test-db.sh, rm.sh, vitest.config.ts:155); estimate 2.5 to 3x wall time with 3 workers.
- 2026-11-21 (plan/test-health): Planned in plans/test-health-plan.md (19 slices, 7 waves; the plan's Backlog table maps items to slices). Waves 1 to 4 start now; the component cuts and harness migrations (slices 14 to 19) wait for list-filters, planner-2 and ui-kit.

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

### B-284 · change · Planner: move the All / Events / Todos filter under the shared Filter dropdown (FilterMenu), after B-247's Upcoming | Past toggle

- status: in-progress
- prd: planner-2
- owner: prd/planner-2
- commit:

- 2026-11-21 (prd/list-filters): From list-filters slice 4 (B-249), split out on the user's word 2026-11-21 because B-247 isn't scheduled. Do after B-247 lands. Spec: plans/list-filters-plan.md, Slice 4 (until that PRD is removed, then git history at prd/list-filters). Keep Upcoming | Past visible; one FilterMenu section 'Show' (All, Events, Todos; default All) at the row's right end with FilterMenuChips beneath; the author filter ('By Ann') passed as an extra chip (not counted); Past shows no button, only the author chip when on. planner.browser.test.tsx's 'the tabs carry what each reads' test already uses the Todos tab's Filter menu. Also overlaps planner-2 (B-248).
- 2026-11-21 (plan/planner-tabs): Backlog session 2026-11-21, at the user's word: moved from quick-fixes into planner-2 as new wave 2 slices (B-247, B-251 and B-284 in one slice that reworks the Planner's header and filter row once, before slice 3; B-246 in its own slice), so planner-2's slice 3 no longer waits on another PRD. The planner-2 orchestrator appends the slices to its plan. Upcoming | Past is two link chips; no further design of the filter look.

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
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P1.

### B-383 · bug · Repeating todos: reopen finds the successor by dueOn > the reopened todo's due day (todoService laterInChain, and the device's), so a successor rescheduled to the same day or earlier is missed and both rows stay open and repeating

- status: triaged
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.

### B-384 · bug · Repeating todos: two concurrent completions of the same todo with doneAt on different recipient days both read doneAt null and each insert a different next occurrence; lock and reread the row (or a conditional transition) so only the winner makes the next (todoService.complete)

- status: triaged
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.

### B-385 · bug · Repeating todos: nextDueDay uses nextVisits' ~5-year search horizon, so a valid long-interval rule (e.g. FREQ=MONTHLY;INTERVAL=99) reads as ended and the chain stops; search to the rule's next occurrence or cap the accepted interval

- status: triaged
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, 2026-11-21); filed as a follow-up. P2.
- 2026-11-21 (prd/planner-2): The repeat sheet's interval input allows up to 99 (RepeatField.tsx max={99}), so this is reachable from the app.

### B-386 · bug · Repeating todos: a successor moved back onto its source's day and ticked gets nextTodoId(repeatId, that next day) = its own id, so insertNext (and the device's planNext) sees the row as the existing next and the chain silently ends; handle ids taken by the source or a done occurrence

- status: triaged
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, round 2, 2026-11-21); filed as a follow-up. P2.

### B-387 · bug · Repeating todos: a stopped chain (successor explicitly deleted) comes back when an offline writer ticks a stale copy of the original: complete leaves it done, but the twin of the next day finds no open row and upsertOccurrence creates it as if from a skip; tell an authorised skip from a stale completion twin

- status: triaged
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (prd/planner-2): Codex finding on PR #22 (planner-2 wave 1, round 2, 2026-11-21); filed as a follow-up. P2.
