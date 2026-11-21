# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

Which PRDs exist, what each depends on, and the shared files it touches: orchestrators read this to choose what can run at the same time. At most three PRD orchestrators run at once.

| PRD               | Doc                                                          | Depends on                                           | Hot files                                                                   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `orchestration` | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): **done** (`94e6b80`) | — | none now |
| `live-notes-ux` | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done** | — | none now |
| `quick-fixes`     | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–46 in `dev` (44–46: B-135, B-134, B-157 in `2d57e70`); wave 13 (slices 47–51: B-184 to B-190) planned, to run; new fixes append as slice 52 on |  (none) | varies by slice; none now |
| `app-shell` | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done** | — | none now |
| `timeline-polish` | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done** | — | none now |
| `search` | [PRD](search-prd.md), [plan](search-plan.md): **done** (`a5f3d4d`) | — | none now |
| `providers` | [PRD](providers-prd.md), [plan](providers-plan.md): **done** (`7c075d1`) | — | none now |
| `medications` | [PRD](medications-prd.md), [plan](medications-plan.md): **done** (`8ff8354`) | — | none now |
| `medications-2` | [PRD](medications-2-prd.md), [plan](medications-2-plan.md): **done** (`a6738b4`) | — | none now |
| `assistant` | [PRD](assistant-prd.md), [plan](assistant-plan.md): **done** (`7f3ec10`) | — | none now |
| `connectors`      | [PRD](connectors-prd.md), [plan](connectors-plan.md): 7 slices, waves (1, 2, 7) → (3, 4, 5) → 6: the due-doses core and preview moved to `@caretook/data`, then the tracer bullet (OAuth via `@better-auth/oauth-provider` 1.7.25, `/connect` consent, one-group grants, the owners' switch, a hand-rolled stateless MCP server at `/mcp`, the first read tools), the privacy text, then write tools with the "via" tag, the other read tools, and the Assistants and Devices screens, then a `roundtrip` step (B-104). **Ready to start** | `assistant` (done); B-80 (done); slice 3's tag waits for `timeline-ux`'s row and header slices in `dev` | `packages/auth` (`auth.ts`, the plugin), `db/schema/auth/`, one migration (`care_group`, `timeline_entry`, `task` columns), `sync-config.yaml` and the device schema (`via`), the upload switch, timeline rows and cards, the entry header, the task page, `GROUP_SETTINGS`, Settings → Devices, the legal pages, `roundtrip` |
| `providers-2` | to write (B-25, B-48): @-mentions of providers in notes and events, and importing providers from another group you belong to (its cross-group permission rules) | `providers` (done) | live-notes editor (mentions), `providerService`, its area's `permissions/` part |
| `appointments-2` | [PRD](appointments-2-prd.md), [plan](appointments-2-plan.md): 10 slices, waves 1 → (2, 3, 4) → (5, 6, 7) → (8, 9, 10): repeating appointments and reminders (series, 90-day visits, only this / this and later), the calendar cron and top-up, calendar items with generic-by-default sharing and the Calendar & reminders page, the iCal feed, reminder emails (push later), Google Calendar two-way sync (connect and push, then pull), "Remind me" per appointment, a roundtrip step (B-60–B-63). Three migrations; new deps `rrule`, `ical-generator`, `@googleapis/calendar`, `google-auth-library`. **Ready to start** once `timeline-ux` slice 5 is in `dev` | `timeline-ux` slice 5 (the Today card, B-169) in `dev` | `timeline_entry` (series columns), the appointment and reminder sheets, `entryActionItems`, Upcoming and timeline rows and `TodayCard` (the repeat mark), sync and upload registries, the sync matrix, `NOTIFICATIONS`, `timelineEntryService` and `taskService` (calendar jobs), `careGroupMemberService` (removal), group settings, `vercel.json` crons, a new `calendars` area |
| `connectors-2` | to write (B-193–B-196): make connecting easier: an in-app connect guide (URL, steps for Claude and ChatGPT), members asking owners to turn assistants on, starter prompts (MCP instructions and prompts, a success state), then directory listings after launch | `connectors` (done); quick-fixes slices 47–48 (B-188–B-190) first (soft); B-196 waits on B-33 and B-54 | group settings → Assistants, Settings → Devices, `/connect` (`ConnectConsent.tsx`, `packages/api/src/connectors/connect.ts`), `packages/api/src/connectors/protocol.ts`, `NOTIFICATIONS` (the request) |
| `conditions` | [PRD](conditions-prd.md), [plan](conditions-plan.md): 6 slices, waves 1 → (2, 4, 5) → 3 → 6: a conditions list on the recipient's profile (status, since, note, suggestions, no known conditions; synced, edited offline), condition changes on the timeline and in search, diagnosed by and managed by providers (the provider page), medications for a condition, the printed sheets, the connector (read only; the writer is B-197). Four migrations, no new deps. **Ready to start** (B-181) | none for slice 1; quick-fixes slice 51 (B-187) before slice 2, slice 48 (B-189) before slice 6 | the profile's card and sheets, `sync-config.yaml`, the device schema, the upload switch, the sync matrix, `TIMELINE_ENTRY_KINDS` and the kind check, `KIND_META`, `TimelineFilters.tsx`, `SEARCH_ITEM_TYPES`, the medication form and page, the provider page, the print sheets, `recipientProfile.ts`, `listTimeline.ts` |
| `github-review` | [PRD](github-review-prd.md), [plan](github-review-plan.md): 3 slices, waves 1 → (2, 3): Codex's verdict and `pnpm prd review`; `pnpm prd pr`, land's PR path into `dev` (prd/ always, hotfixes `--pr`/`--local`, `--no-review` on the user's word) and dev-sync after a GitHub merge; `ready`, prompts and `rm`. Tooling only, no deps, no migration (B-203). **Ready to start** | none (wave 1 lands locally; wave 2 is the new path's first run) | `scripts/loops/` `land.sh`, `prd.sh`, `lib.sh`, `ready.sh`, `prompt.sh`, `rm.sh`; at landing orchestrator.md, hotfix.md, orchestration.md, `ops/runbook.md`, AGENTS.md |
| `routing` | [PRD](routing-prd.md), [plan](routing-plan.md): **done** (`ff25ef2`) | — | none now |
| `components` | [PRD](components-prd.md), [plan](components-plan.md): **done** (`ca39416`) | — | none now |
| `invites` | [PRD](invites-prd.md), [plan](invites-plan.md): **done** (`e6286f4`) | — | none now |
| `marketing` | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user | — | none now |
| `profiles` | [PRD](profiles-prd.md), [plan](profiles-plan.md): **done** (`88890df`) | — | none now |
| `appointments` | [PRD](appointments-prd.md), [plan](appointments-plan.md): **done** | — | none now |
| `care-periods` | [PRD](care-periods-prd.md), [plan](care-periods-plan.md): **done** (`f6c4e92`) | — | none now |
| `data-rights`     | to write (B-52, B-53, B-84)                                  | (none)                                               | `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `tasks` | [PRD](tasks-prd.md), [plan](tasks-plan.md): **done** (`1ee7864`) | — | none now |
| `documents`       | to write (B-56)                                              | hosting (B-33, file storage); `profiles` (soft); `encryption` decision | file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS`              |
| `encryption`      | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 | (none); affects `assistant` and `documents` | none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `onboarding`      | to write (B-31)                                              | `invites` (done)                                     | seeds, `careGroupService`, `/app` home                                     |
| `account-security` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) | `invites` (done); B-80 (the Devices page) first (soft) | `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `admin` | [PRD](admin-prd.md), [plan](admin-plan.md): **done** | — | none now |
| `check-migration` | [PRD](check-migration-prd.md), [plan](check-migration-plan.md): 23 slices, 10 waves of ≤ 3: steady component tests and a lean-budget ratchet (356 s → ≤ 300), a sync matrix and refused uploads, then each area check moved to component tests (flows folded into lean checks only for a new mechanism), then the lean set ported to Playwright Test and the CDP harness deleted (B-113–B-129, B-131) | `orchestration` (done); slices 11–17 wait for named `assistant` slices in `dev` | `scripts/loops/checks` and `check-areas` (additive), `scripts/browser-checks/`, `browser.sh`, `apps/web/test/` (the test device), test files beside screens, root `package.json` (`@playwright/test`, slice 19) |
| `loop-recovery` | [PRD](loop-recovery-prd.md), [plan](loop-recovery-plan.md): **done** | — | none now |
| `hosting` | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent | (none) | none now |
| `app-speed` | [PRD](app-speed-prd.md), [plan](app-speed-plan.md): **folded into `timeline-ux`** (its PRD is the speed half's input) | — | none now |
| `agent-tooling` | [PRD](agent-tooling-prd.md), [plan](agent-tooling-plan.md): **done**, all 6 slices in `dev` (`5d5e1d7`): batched backlog commits, `pnpm log`, the doc budget guard, the core + `docs/agents/` split, the six area docs trimmed | (none) | none now |
| `code-layout` | [PRD](code-layout-prd.md), [plan](code-layout-plan.md): **done** (`18e9cf8`) | — | none now |
| `timeline-ux` | [PRD](timeline-ux-prd.md) (speed half: [app-speed PRD](app-speed-prd.md)), [plan](timeline-ux-plan.md): 10 slices, waves (1, 2, 3) → (4, 5, 6) → (7, 8, 9) → 10: navigation that doesn't wait, tiles that remember (dimmed until fresh), the bundle budget, prefetched tabs, one Today card with status hues, the day header with its summary and rows with the author under the menu and no period places, the service worker, simple mode's order and type scale, quick entry's rotating placeholder, open-after-save and lean recent lines, cheaper `/rpc` auth (B-136–B-140, B-144, B-155, B-156, B-162–B-171). **Done 2026-11-20**: all 10 slices in `dev` (8b3179ab); follow-ups B-174, B-175, B-178, B-179 | wave 1: none; wave 2 on: `code-layout` slice 5 in `dev` (`appUrls`), or coordinate with it | `lib/auth/session.ts`, `lib/auth/sessionRules.ts`, `lib/app-shell/me.ts`, `lib/sync/` (the remembering hook), `recentLines` (at code-layout's paths), `SectionNav`, the `/app` layout (update notice), the timeline route, its strips (replaced by `TodayCard`), `DayHeader`, `DaySummaryLine`, the row components, `PeriodMarkerItem`, `SimpleTimeline`, quick entry, `packages/auth`, `packages/api/src/procedures.ts`, `routes/rpc.ts`, `scripts/loops/prd.sh`, `scripts/loops/check-areas.d/`, new `scripts/build/` |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-25 | feature | triaged | providers-2 |  | @-mentions of providers inside live notes and events |
| B-31 | feature | triaged | onboarding |  | Demo group for every new user: a seeded, fictional care group to explore the app |
| B-33 | plan | triaged | hosting |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-48 | feature | triaged | providers-2 |  | Allow import of providers from other care groups that you have access to. |
| B-52 | feature | triaged | data-rights |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-60 | feature | in-progress | appointments-2 | prd/appointments-2 | Recurring appointments (weekly PT, dialysis three times a week) |
| B-61 | feature | triaged | appointments-2 |  | Appointment reminders by email and push before the appointment |
| B-62 | feature | triaged | appointments-2 |  | iCal feed of a care group's upcoming appointments |
| B-63 | feature | triaged | appointments-2 |  | Google Calendar sync of a care group's appointments |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-104 | plan | staging | connectors | prd/connectors | Connectors: let a user's own Claude or ChatGPT read and write their care group through an MCP server |
| B-129 | chore | staging | check-migration | prd/check-migration | Port the lean end-to-end set to Playwright Test |
| B-136 | change | live | timeline-ux | prd/timeline-ux | Stop blocking every /app navigation on a session request: use the session confirmed in the last few… |
| B-137 | change | live | timeline-ux | prd/timeline-ux | Prefetch the group section tabs, so the first tap on a section doesn't download its route chunk… |
| B-138 | change | live | timeline-ux | prd/timeline-ux | Highlight the tapped section tab at once, from the pending navigation (`useNavigation`), not only… |
| B-139 | change | live | timeline-ux | prd/timeline-ux | Add `content-visibility: auto` to timeline entries: the list grows by 30 rows with no… |
| B-140 | change | live | timeline-ux | prd/timeline-ux | Cut the per-request auth cost on /rpc: `getAuthUser` runs a session lookup and two queries on every… |
| B-144 | feature | live | timeline-ux | prd/timeline-ux | Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload… |
| B-145 | question | triaged | encryption |  | Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for… |
| B-148 | chore | live | agent-tooling | prd/agent-tooling | Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and… |
| B-151 | chore | dropped | check-migration |  | Break up the browser checks by flow: 18,500 lines in all, medications.mjs alone 4,373. |
| B-155 | chore | live | timeline-ux | prd/timeline-ux | Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first… |
| B-156 | chore | live | timeline-ux | prd/timeline-ux | Check whether `loadSettings` in the timeline loader waits on the network before using its cache. |
| B-161 | bug | live | check-migration | prd/check-migration | sign-in.mjs flaked once in the lean suite at load 88: 'during the redirect the button is disabled and shows Signing in…' saw /app already ('Getting your care groups…') |
| B-162 | change | live | timeline-ux | prd/timeline-ux | In simple mode, Reorder so that "What happend" is directly above the timeline, basically like the… |
| B-163 | change | live | timeline-ux | prd/timeline-ux | "Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas… |
| B-164 | change | live | timeline-ux | prd/timeline-ux | "day/date" heder for full timeline is too small compared to the + button. Make text larger. |
| B-165 | change | live | timeline-ux | prd/timeline-ux | Move "author" tile below hamburger menu on timeline entries, it takes up valuable text space. |
| B-166 | change | live | timeline-ux | prd/timeline-ux | Using back to timeline from timeline live-note entry (or any browse action) takes you back to the… |
| B-167 | change | live | timeline-ux | prd/timeline-ux | Make day summary part of sticky header so it is always visible when scrolling up the timeline. |
| B-168 | change | live | timeline-ux | prd/timeline-ux | timeline group titles that are too long wrap to multiple lines on small screens. Truncate the… |
| B-169 | change | live | timeline-ux | prd/timeline-ux | vitals, upcoming, medication due, and todo overdue can be combined into a single tile that is… |
| B-170 | change | live | timeline-ux | prd/timeline-ux | When creating a new timeline entry for a note or event, we should navigate to edit page on save so… |
| B-171 | change | live | timeline-ux | prd/timeline-ux | your recent lines should exclude notes and events. vitals should only show the vital key, not the… |
| B-173 | bug | live | check-migration | prd/check-migration | app-shell.mjs step 'a member's shared details reach the owner's device (the member-share stream)' failed once in the lean suite at load 20 and passed alone (33 s): its 30 s poll for a SQL-inserted member_contact_share row reaching the owner's device timed out |
| B-174 | bug | triaged | quick-fixes |  | Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page |
| B-175 | chore | triaged | quick-fixes |  | Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6 |
| B-176 | bug | live | check-migration | prd/check-migration | Component tests click or fill a synchronous DOM query right after render (userEvent.click(X()!)), which is null when the screen renders late under load: 24 files |
| B-177 | bug | triaged | check-migration |  | rateLimit.int.test.ts 'counts get-session across instances' failed once in a full check at load 26 with a failed rate_limit query (its 101 concurrent get-sessions); passes alone |
| B-178 | bug | live | check-migration | prd/check-migration | medicationList.browser.test.tsx flakes under load: a test sees an empty list ('expected []') or a null element in full pnpm check runs at load ~20+, passes alone |
| B-179 | bug | dropped | check-migration |  | app-shell.mjs member-share step flakes under load: a psql insert doesn't reach an already-connected device within 30 s (PowerSync replication), no auto-retry |
| B-180 | bug | triaged | check-migration |  | Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races |
| B-181 | feature | in-progress | conditions | prd/conditions | A conditions list on the care recipient's profile (diagnoses), so helpers and a connected assistant's recipient_profile can see them |
| B-182 | bug | triaged | check-migration |  | providers.browser.test.tsx 'a practice's name finds its clinicians too; the Clinicians chip keeps the search…' flakes under load: after tapping Clinicians, the 'Current providers' list still has Dr. Samuel Patel when its expect.poll times out |
| B-183 | chore | triaged | hosting |  | Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons) |
| B-184 | bug | landed | quick-fixes | prd/quick-fixes | When viewing the member page as an owner, the simple mode and locked buttons make the data too wide… |
| B-185 | bug | landed | quick-fixes | prd/quick-fixes | The today bar on timeline should always be collapsed unless there is something overdue or upcoming. |
| B-186 | bug | landed | quick-fixes | prd/quick-fixes | vitals section in today block doesn't expand when you click see all, it filters the data instead.… |
| B-187 | bug | landed | quick-fixes | prd/quick-fixes | timeline filter interface is overwhelming on mobile and confusing on desktop, especially the vitals… |
| B-188 | bug | landed | quick-fixes | prd/quick-fixes | when signing up mcp connector, the oauth request just returns json, not the accept flow |
| B-189 | bug | landed | quick-fixes | prd/quick-fixes | mcp connector for medication change records on the timeline, it isn't providing information about… |
| B-190 | bug | landed | quick-fixes | prd/quick-fixes | mcp connector returning truncated notes on doses, and maybe other things |
| B-191 | bug | triaged | quick-fixes |  | clicking the next entry in the upcoming section of the simple timeline should expand the section,… |
| B-192 | bug | triaged | quick-fixes |  | undo when checking off a todo should list all the todos that were checked off, not just the last… |
| B-193 | feature | triaged | connectors-2 |  | In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states |
| B-194 | feature | triaged | connectors-2 |  | A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off |
| B-195 | feature | triaged | connectors-2 |  | Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state |
| B-196 | feature | triaged | connectors-2 |  | List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting |
| B-197 | feature | triaged | connectors-2 |  | Connector write tool add_condition (and resolve): a connected assistant adds or resolves a care recipient's condition through recipientConditionService |
| B-198 | bug | triaged | quick-fixes |  | rotating placeholder in the timeline entry box is distracting and confusing. Use a static… |
| B-199 | bug | triaged | quick-fixes |  | ability to add a medication quickly from the log a dose screen. |
| B-200 | bug | triaged | medications-3 |  | medications need a type field: rx, otc, supplement, etc. |
| B-201 | bug | triaged | quick-fixes |  | simple timeline date header should show the care period as well |
| B-202 | bug | landed | agent-tooling |  | lint before typecheck in check command. Do the fast thing first, then the slow thing. |
| B-203 | feature | triaged | github-review |  | Now that we are we have github fixed, we should start using it for some of the merge management so… |
| B-204 | feature | triaged | connectors-2 |  | connector should be able to edit notes and events so it can help you draft questions or add… |

## Items

### B-25 · feature · @-mentions of providers inside live notes and events

- status: triaged
- prd: providers-2
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Later, after providers' linking lands. Typing @ in a note's or event's text suggests providers; a mention links the provider like the With row. Needs @tiptap/extension-mention and @tiptap/suggestion (new dependencies: the user's approval). Out of scope for the providers PRD.
- 2026-11-18 (prd/providers): Triaged to providers by its orchestrator: @-mentions need the provider table and links (slices 1 and 5). A follow-up after slice 5, not in the current plan.
- 2026-11-20 (Robert Bo Davis): Moved from providers (done) to a new providers-2 PRD, to write (the user, 2026-11-20): B-48's cross-group permission rules want an interview, and B-25 touches the live-notes editor. Same commit: the PRD table's done rows shortened, rows added for providers-2 and appointments-2. -- backlog agent

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

- status: triaged
- prd: providers-2
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed as a providers follow-up (the PRD is done, like B-25): copy a provider from another group you belong to into this one (a copy, not a shared row, since providers are per group and synced per group). Needs a small PRD addendum or a quick-fixes slice once scoped.
- 2026-11-20 (Robert Bo Davis): Moved from providers (done) to a new providers-2 PRD, to write (the user, 2026-11-20): B-48's cross-group permission rules want an interview, and B-25 touches the live-notes editor. Same commit: the PRD table's done rows shortened, rows added for providers-2 and appointments-2. -- backlog agent

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

- status: in-progress
- prd: appointments-2
- owner: prd/appointments-2
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-61 · feature · Appointment reminders by email and push before the appointment

- status: triaged
- prd: appointments-2
- owner:
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-62 · feature · iCal feed of a care group's upcoming appointments

- status: triaged
- prd: appointments-2
- owner:
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-63 · feature · Google Calendar sync of a care group's appointments

- status: triaged
- prd: appointments-2
- owner:
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

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

### B-104 · plan · Connectors: let a user's own Claude or ChatGPT read and write their care group through an MCP server

- status: staging
- prd: connectors
- owner: prd/connectors
- commit: d77c5884

- 2026-11-19 (Robert Bo Davis): From the 2026-11-19 planning discussion. A remote MCP server over the assistant PRD's actions layer (Claude connectors and ChatGPT's Apps SDK both speak MCP). Reads and writes; each write is confirmed in the chat, labelled as from an assistant on the timeline, and deletable as usual. Needs OAuth (check Better Auth's OAuth-provider plugins), tokens limited to one group with read and write scopes, revocable on the Devices page (B-80), a per-group consent record, an owners' on/off group setting, and a privacy-page change (data goes to the user's chosen AI vendor). Online only. Siri and Alexa are out for now: dictation only.
- 2026-11-20 (plan/connectors): PRD and plan written (plans/connectors-prd.md, connectors-plan.md; user approved 2026-11-20): 7 slices, waves (1, 2, 7) → (3, 4, 5) → 6. New dependency approved: @better-auth/oauth-provider 1.7.25; MCP hand-rolled, no SDK. Owners' switch default off; one group per grant; scope by role; via tag; slice 3's tag waits for timeline-ux's row/header slices.

### B-129 · chore · Port the lean end-to-end set to Playwright Test

- status: staging
- prd: check-migration
- owner: prd/check-migration
- commit: f7eceabb

- 2026-11-19 (slice/orchestration/9): A non-goal of the orchestration PRD, filed as its follow-up: the CDP harness (cdp.mjs, proxy.mjs) could become Playwright Test now that playwright is a dev dependency (component tests). Only the lean set (scripts/loops/checks e2e yes); keep the lease, the watchdog and the check build.
- 2026-11-19 (Robert Bo Davis): Proposed for check-migration, last: port only the lean set to Playwright Test once B-114 to B-128 have shrunk it.
- 2026-11-19 (plan/check-migration): Planned: check-migration slices 19-23, waves 8-10 (@playwright/test 1.65.1 approved by the user) (plans/check-migration-plan.md).
- 2026-11-20 (slice/check-migration/19): slice 19: app-shell's member-share step ('a member's shared details reach the owner's device') failed again in --changed at load 14 (13:38, check-migration-19; slice 18 saw it at load 5.9). Not contention, so not retried; the row was inserted (ON CONFLICT DO NOTHING) but never reached the owner's device in 30 s. Unported .mjs, untouched by slice 19; slice 22 ports it.

### B-136 · change · Stop blocking every /app navigation on a session request: use the session confirmed in the last few…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 9e3a3ad

- 2026-11-20 (Robert Bo Davis): From the inbox: Stop blocking every /app navigation on a session request: use the session confirmed in the last few minutes and recheck in the background. / `requireSession` (apps/web/app/lib/session.ts) awaits `get-session` on each navigation, with no timeout, so every tap waits a round trip and can hang on a weak connection. / Add a timeout of about 3 s that counts as "no answer". The server still checks every upload and sync token.
- 2026-11-20 (backlog agent): Triage: new PRD app-speed (navigation and load speed). This one needs a design decision (how long a confirmed session is trusted, what a timeout means offline), so it is PRD work, not a quick fix. Hot file: lib/session.ts.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 1 (plans/app-speed-plan.md). 15 min fresh window, background recheck at most once a minute, 3 s timeout; the app's check bypasses the cookie cache.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).
- 2026-11-20 (Robert Bo Davis): Start now (the user, 2026-11-20): timeline-ux runs as a 4th PRD (CARETOOK_MAX_PRDS=4) without waiting for code-layout slice 5. This overrides the plan's start condition, which wrongly names B-150; B-149 is code-layout's last item. Wave 1 (slices 1-3) touches none of slice 5's files (routes.ts, appUrls). Before wave 2: pnpm prd sync; if code-layout hasn't landed yet, slices 5, 6, 8, 9 import appUrls, so message the code-layout orchestrator or hold wave 2 until it lands.
- 2026-11-20 (slice/timeline-ux/1): slice 1: fresh session (15 min) skips the wait, background recheck after 1 min, 3 s NETWORK_ANSWER_MS; commit 28991ac on slice/timeline-ux/1

### B-137 · change · Prefetch the group section tabs, so the first tap on a section doesn't download its route chunk…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: ddf36b0

- 2026-11-20 (Robert Bo Davis): From the inbox: Prefetch the group section tabs, so the first tap on a section doesn't download its route chunk (and works offline). / The links in routes/app/layout/SectionNav.tsx (SectionNav and TabBar) have no `prefetch`; sheets already use `prefetch="render"`.
- 2026-11-20 (backlog agent): Triage: app-speed. Small (prefetch on SectionNav and TabBar links), grouped with B-136 and B-138 because all three change the same navigation path.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 2 (plans/app-speed-plan.md). prefetch=render on SectionNav and TabBar.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-138 · change · Highlight the tapped section tab at once, from the pending navigation (`useNavigation`), not only…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: ddf36b0

- 2026-11-20 (Robert Bo Davis): From the inbox: Highlight the tapped section tab at once, from the pending navigation (`useNavigation`), not only after the loaders finish.
- 2026-11-20 (backlog agent): Triage: app-speed. Small (useNavigation in SectionNav), same file as B-137.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 2 (plans/app-speed-plan.md). Highlight from useNavigation's pending location.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-139 · change · Add `content-visibility: auto` to timeline entries: the list grows by 30 rows with no…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 127670af

- 2026-11-20 (Robert Bo Davis): From the inbox: Add `content-visibility: auto` to timeline entries: the list grows by 30 rows with no virtualization.
- 2026-11-20 (backlog agent): Triage: app-speed. Small CSS change on timeline rows; needs a check that scroll restore and the paging sentinel still work.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 3 (plans/app-speed-plan.md). content-visibility: auto + contain-intrinsic-size; timelineScroll tests guard restore and paging.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-140 · change · Cut the per-request auth cost on /rpc: `getAuthUser` runs a session lookup and two queries on every…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 75f87df2

- 2026-11-20 (Robert Bo Davis): From the inbox: Cut the per-request auth cost on /rpc: `getAuthUser` runs a session lookup and two queries on every call, public procedures included. / A short cookie cache, or skipping the lookup for public procedures (packages/auth/src/authUser.ts, routes/rpc.ts).
- 2026-11-20 (backlog agent): Triage: app-speed. Touches packages/auth/src/authUser.ts and routes/rpc.ts, which hosting slice 3 also changes (rate limits): run it after hosting wave 1 is in dev.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 6 (plans/app-speed-plan.md). Lazy AuthUser, one query, Better Auth cookie cache 3 min (staff and /token bypass it; tradeoff documented in auth.md and security-review.md). Needs hosting slice 3 in dev.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-144 · feature · Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 858936e7

- 2026-11-20 (Robert Bo Davis): From the inbox: Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload works offline (docs/domain/sync.md already notes the gap).
- 2026-11-20 (backlog agent): Triage: app-speed, its largest slice (a precached shell for the web target only; update flow, CSP worker-src, how it meets PowerSync's own workers). Needs the PRD interview. Likely a new dependency question (hand-written worker or a Vite plugin).
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 5 (plans/app-speed-plan.md). Hand-written worker, web only; cached shell for /app/* documents; 'new version ready: Reload' notice. Blocked by slices 1 and 4.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-145 · question · Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for…

- status: triaged
- prd: encryption
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. / Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- 2026-11-20 (backlog agent): Triage: a decision for the encryption review (plans/security-review.md, option A for launch), not a build item yet. It only becomes work with Capacitor (SQLCipher, secure storage); on the web the browser profile is the boundary. Needs the user's answer; no PRD to start.

### B-148 · chore · Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and…

- status: live
- prd: agent-tooling
- owner: prd/agent-tooling
- commit: 2de3177

- 2026-11-20 (Robert Bo Davis): From the inbox: Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and carry slice and backlog history that git already holds.
- 2026-11-20 (backlog agent): Triage: agent-tooling. Docs only; timeline.md and medications.md first. Tasks folds into timeline.md at its landing, so trim after tasks lands.
- 2026-11-20 (plan/agent-tooling): Planned: agent-tooling slices 5 (components, sync, care-groups, medications) and 6 (timeline, app-shell, after tasks lands).

### B-151 · chore · Break up the browser checks by flow: 18,500 lines in all, medications.mjs alone 4,373.

- status: dropped
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (backlog agent): Triage: check-migration is moving each area check to component tests (medications.mjs is B-118), which removes most of those lines; what stays is the lean set, ported to Playwright Test (B-129). Proposed: fold into that work, re-measure after it lands, and drop if nothing large remains.
- 2026-11-20 (prd/check-migration): check-migration orchestrator: agreed, no slice of its own; re-measure the browser-check lines after slice 23 (the CDP harness deleted) and close or drop it then.
- 2026-11-20 (prd/check-migration): Moot: check-migration moved every area check to component tests and ported the lean set to Playwright specs (one spec per check); medications.mjs and the other big .mjs files are deleted. -- check-migration orchestrator

### B-155 · chore · Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 448be6e

- 2026-11-20 (Robert Bo Davis): From the inbox: Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first chunk.
- 2026-11-20 (backlog agent): Triage: app-speed. A budget in the build check that keeps the editor and PowerSync out of the first chunk; it guards the gains of the other slices.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 4 (plans/app-speed-plan.md). pnpm build:budget (manifest reader + pure checker + budget.json), run by pnpm prd check.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).
- 2026-11-20 (Robert Bo Davis): Start now (the user, 2026-11-20): timeline-ux runs as a 4th PRD (CARETOOK_MAX_PRDS=4) without waiting for code-layout slice 5. This overrides the plan's start condition, which wrongly names B-150; B-149 is code-layout's last item. Wave 1 (slices 1-3) touches none of slice 5's files (routes.ts, appUrls). Before wave 2: pnpm prd sync; if code-layout hasn't landed yet, slices 5, 6, 8, 9 import appUrls, so message the code-layout orchestrator or hold wave 2 until it lands.

### B-156 · chore · Check whether `loadSettings` in the timeline loader waits on the network before using its cache.

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 9e3a3ad

- 2026-11-20 (backlog agent): Triage: app-speed. An investigation first (does loadSettings wait on the network before using its cache?); a fix only if it does.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 1 (plans/app-speed-plan.md). Investigated: it does wait (me.get, after pending updatePreferences). Becomes cache-first with a background refresh that updates the open screen.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).
- 2026-11-20 (Robert Bo Davis): Start now (the user, 2026-11-20): timeline-ux runs as a 4th PRD (CARETOOK_MAX_PRDS=4) without waiting for code-layout slice 5. This overrides the plan's start condition, which wrongly names B-150; B-149 is code-layout's last item. Wave 1 (slices 1-3) touches none of slice 5's files (routes.ts, appUrls). Before wave 2: pnpm prd sync; if code-layout hasn't landed yet, slices 5, 6, 8, 9 import appUrls, so message the code-layout orchestrator or hold wave 2 until it lands.
- 2026-11-20 (slice/timeline-ux/1): slice 1: loadSettings cache-first with background refresh and settings store (useMySettings); commit 940af0a on slice/timeline-ux/1

### B-161 · bug · sign-in.mjs flaked once in the lean suite at load 88: 'during the redirect the button is disabled and shows Signing in…' saw /app already ('Getting your care groups…')

- status: live
- prd: check-migration
- owner: prd/check-migration
- commit: d0c4496

- 2026-11-20 (prd/check-migration): check-migration wave 4 suite, 2026-11-20 08:54, load 51→88; passed on the automatic retry (.loops/.browser-flakes.log). The redirect outran the assertion under load; slice 19's Playwright port may make the wait robust.
- 2026-11-20 (prd/check-migration): Proposed for check-migration: sign-in is a lean session check that slice 20 ports to Playwright; fix the flaky redirect assertion there. -- check-migration orchestrator
- 2026-11-20 (prd/check-migration): User approved for check-migration (2026-11-20): slice 19 fixes it while porting sign-in. -- check-migration orchestrator

### B-162 · change · In simple mode, Reorder so that "What happend" is directly above the timeline, basically like the…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 3f342072

- 2026-11-20 (prd/hosting): From the inbox: In simple mode, Reorder so that "What happend" is directly above the timeline, basically like the full layout. Replace "Now" heading with "Upcoming". Reduce size of quick action buttons so that they are one row with smaller buttons so they are one row."Tap the microphone on your keyboard to say it instead of typing." should only appear on devices that support voice input via keyboard (ios/andriod?). All text is too large and should be reduced in size. Assume users that can't see well will have there devices set to larger text, or zoom their browsers.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-163 · change · "Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 858936e7

- 2026-11-20 (prd/hosting): From the inbox: "Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas separate entries; start with “n:” for a note." should be a tooltip.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-164 · change · "day/date" heder for full timeline is too small compared to the + button. Make text larger.

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 127670af

- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-165 · change · Move "author" tile below hamburger menu on timeline entries, it takes up valuable text space.

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 127670af

- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-166 · change · Using back to timeline from timeline live-note entry (or any browse action) takes you back to the…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 448be6e

- 2026-11-20 (Robert Bo Davis): From the inbox: Using back to timeline from timeline live-note entry (or any browse action) takes you back to the timeline, causes all lazy loaded header elements to reload. Can we cache their state with a visual indicator (maybe greyed out) and load in the background so that it doesn't cause page shift? Maybe keep a placeholder in the header so that it doesn't cause a flash on load any time?
- 2026-11-20 (Robert Bo Davis): Triaged to app-speed: header elements reloading on back-navigation is a caching/navigation-speed issue, next to B-136/B-137.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).
- 2026-11-20 (Robert Bo Davis): Start now (the user, 2026-11-20): timeline-ux runs as a 4th PRD (CARETOOK_MAX_PRDS=4) without waiting for code-layout slice 5. This overrides the plan's start condition, which wrongly names B-150; B-149 is code-layout's last item. Wave 1 (slices 1-3) touches none of slice 5's files (routes.ts, appUrls). Before wave 2: pnpm prd sync; if code-layout hasn't landed yet, slices 5, 6, 8, 9 import appUrls, so message the code-layout orchestrator or hold wave 2 until it lands.
- 2026-11-20 (slice/timeline-ux/2): slice 2 built on slice/timeline-ux/2 (67f6e34): tile cache + useRememberedQuery; strips and simple blocks dimmed when remembered, skeletons on first visit

### B-167 · change · Make day summary part of sticky header so it is always visible when scrolling up the timeline.

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 127670af

- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-168 · change · timeline group titles that are too long wrap to multiple lines on small screens. Truncate the…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 127670af

- 2026-11-20 (Robert Bo Davis): From the inbox: timeline group titles that are too long wrap to multiple lines on small screens. Truncate the provider on small screens.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-169 · change · vitals, upcoming, medication due, and todo overdue can be combined into a single tile that is…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 127670af

- 2026-11-20 (Robert Bo Davis): From the inbox: vitals, upcoming, medication due, and todo overdue can be combined into a single tile that is collapsible. They should all have a right side link to the full view that is formatted similarly.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-170 · change · When creating a new timeline entry for a note or event, we should navigate to edit page on save so…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 858936e7

- 2026-11-20 (Robert Bo Davis): From the inbox: When creating a new timeline entry for a note or event, we should navigate to edit page on save so the user can add more info to the live document immediately without an extra tap.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-171 · change · your recent lines should exclude notes and events. vitals should only show the vital key, not the…

- status: live
- prd: timeline-ux
- owner: prd/timeline-ux
- commit: 858936e7

- 2026-11-20 (Robert Bo Davis): From the inbox: your recent lines should exclude notes and events. vitals should only show the vital key, not the value so that the user can log those quickly without deleting the value.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.
- 2026-11-20 (Robert Bo Davis): Planned in plans/timeline-ux-plan.md (10 slices, 4 waves; starts once code-layout is in dev). Slice map: 1 B-136/B-156, 2 B-166, 3 B-155, 4 B-137/B-138, 5 B-169, 6 B-164/B-165/B-167/B-168/B-139, 7 B-144, 8 B-162, 9 B-163/B-170/B-171, 10 B-140. B-168 turned out to be care-period places: dropped from the timeline (the user).

### B-173 · bug · app-shell.mjs step 'a member's shared details reach the owner's device (the member-share stream)' failed once in the lean suite at load 20 and passed alone (33 s): its 30 s poll for a SQL-inserted member_contact_share row reaching the owner's device timed out

- status: live
- prd: check-migration
- owner: prd/check-migration
- commit: 6502603

- 2026-11-20 (prd/code-layout): Found at code-layout's final landing (2026-11-20, suite log app-shell-20261120-131200.log in code-layout's git dir). The step came in with check-migration slice 16 (the profiles-contacts fold). Proposed for check-migration: it owns the step. code-layout changes no stream, schema or sync code.
- 2026-11-20 (prd/check-migration): Proposed for check-migration slice 22, which ports app-shell. It also failed once in slice 18's runs, at load 5.9, so it isn't only load: find why the row is slow to arrive before raising the timeout. -- check-migration orchestrator

### B-174 · bug · Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (prd/timeline-ux): Found by timeline-ux slice 6 in the component-test router; check with the real ScrollRestoration before fixing.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-175 · chore · Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (prd/timeline-ux): Slice 6 dropped places from the timeline; left in place to stay clear of slice 5.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-176 · bug · Component tests click or fill a synchronous DOM query right after render (userEvent.click(X()!)), which is null when the screen renders late under load: 24 files

- status: live
- prd: check-migration
- owner: prd/check-migration
- commit: a8043f42

- 2026-11-20 (prd/check-migration): Found at wave 8's landing (2026-11-20). medicationList's search and periods' Add each failed one full check this way and passed alone; both fixed (e4b332b and the periods commit). Proposed for check-migration: sweep the 24 files with grep -rlE 'await userEvent\.(click|fill|hover)\([A-Z_]+\(\)!', and use a waiting query (page.getByRole or a until-present helper beside settle) in renderWithDevice's tests. -- check-migration orchestrator
- 2026-11-20 (prd/check-migration): User chose 2026-11-20: check-migration sweeps it now, as slice 24 alongside wave 9 (with B-178). -- check-migration orchestrator

### B-177 · bug · rateLimit.int.test.ts 'counts get-session across instances' failed once in a full check at load 26 with a failed rate_limit query (its 101 concurrent get-sessions); passes alone

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (prd/check-migration): Seen at check-migration's wave 8 landing (2026-11-20): 'Failed query: select … from rate_limit where key = $1', from Better Auth's rate limiter, likely the integration test's Postgres pool under load. Passed alone 2/2. From hosting slice 3 (B-141); not check-migration's. -- check-migration orchestrator
- 2026-11-20 (Robert Bo Davis): Triage: check-migration, a load flake like B-180/B-182; confirm alone 3x, then fix the race

### B-178 · bug · medicationList.browser.test.tsx flakes under load: a test sees an empty list ('expected []') or a null element in full pnpm check runs at load ~20+, passes alone

- status: live
- prd: check-migration
- owner: prd/check-migration
- commit: a8043f42

- 2026-11-20 (prd/timeline-ux): Seen 2026-11-20 in timeline-ux slices 1, 2 and two landing checks (different test each time); fails before any timeline-ux change too. Probably waits on a fixed render instead of the live query's answer.
- 2026-11-20 (prd/check-migration): Proposed for check-migration with B-176, the same race (a DOM read before the live query answers). Its search test was fixed in e4b332b; the other tests in the file are left for the B-176 sweep. -- check-migration orchestrator

### B-179 · bug · app-shell.mjs member-share step flakes under load: a psql insert doesn't reach an already-connected device within 30 s (PowerSync replication), no auto-retry

- status: dropped
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (prd/timeline-ux): Seen 2026-11-20 by timeline-ux slice 10 at load 18-34; passed on a rerun at load 44-65. Not related to /rpc auth.
- 2026-11-20 (prd/check-migration): Duplicate of B-173, fixed in 6502603 (in dev since e640ba50). The cause wasn't replication: the seeds give caretaker@ a share row, so the step's ON CONFLICT DO NOTHING never wrote its marker. The step is an upsert now, and app-shell is a spec since wave 9. -- check-migration orchestrator

### B-180 · bug · Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (prd/check-migration): Left by slice 24 (B-176's sweep covered the click/fill/hover/type/clear sites). Convert to await expect.poll(...) or found(), keeping what each assertion reads. Proposed for check-migration. -- check-migration orchestrator
- 2026-11-20 (prd/check-migration): Also: two timelineLayout tests now inline the same 'wait until the element stops moving' loop (the author tooltip and the viewer's ⋯, both after the quick-entry chips shift the rows). A shared helper beside found() would fit. -- check-migration orchestrator

### B-181 · feature · A conditions list on the care recipient's profile (diagnoses), so helpers and a connected assistant's recipient_profile can see them

- status: in-progress
- prd: conditions
- owner: prd/conditions
- commit:

- 2026-11-20 (prd/connectors): From connectors slice 4 (B-104): story 22 promises the assistant reads the recipient's conditions, but no conditions field exists; recipient_profile returns allergies, code status, blood type and the note for helpers. The user chose (2026-11-20) to drop 'conditions' from the privacy text for now and file this. When built, add it to recipient_profile and the privacy page.
- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20: the user asked for a conditions PRD and plan, planned in this session
- 2026-11-20 (Robert Bo Davis): PRD and plan written 2026-11-20 (plans/conditions-prd.md, conditions-plan.md); the assistant's write tool is B-197

### B-182 · bug · providers.browser.test.tsx 'a practice's name finds its clinicians too; the Clinicians chip keeps the search…' flakes under load: after tapping Clinicians, the 'Current providers' list still has Dr. Samuel Patel when its expect.poll times out

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (prd/connectors): Seen in connectors slices 1, 2 and 5 and in the connectors landing check (2026-11-20, load ~14, 410 s run); passes alone. The connectors PRD changes nothing under providers/. Line 73: expect.poll(listNames('Current providers')).toEqual(['Dr. Elena Alvarez']).

### B-183 · chore · Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-20 (hotfix/go-live): Repo is public (B-33), so run logs are public for 7 days. Use ::add-mask:: on email/reason inputs in admin-grant.yml, db-access.yml, rotate-jwks.yml; secrets are already masked.
- 2026-11-20 (Robert Bo Davis): Triage: hosting, part of going live (B-33): add ::add-mask:: in admin-grant.yml, db-access.yml, rotate-jwks.yml before production

### B-184 · bug · When viewing the member page as an owner, the simple mode and locked buttons make the data too wide…

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 14aa977f

- 2026-11-20 (Robert Bo Davis): From the inbox: When viewing the member page as an owner, the simple mode and locked buttons make the data too wide for the container. Stack those radios on top of each other
- 2026-11-20 (Robert Bo Davis): Triage: small UI follow-ups (member page; timeline-ux slice 5's Today card), app-shell and timeline-ux are done, so quick-fixes slices

### B-185 · bug · The today bar on timeline should always be collapsed unless there is something overdue or upcoming.

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 0cace532

- 2026-11-20 (Robert Bo Davis): Triage: small UI follow-ups (member page; timeline-ux slice 5's Today card), app-shell and timeline-ux are done, so quick-fixes slices

### B-186 · bug · vitals section in today block doesn't expand when you click see all, it filters the data instead.…

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 0cace532

- 2026-11-20 (Robert Bo Davis): From the inbox: vitals section in today block doesn't expand when you click see all, it filters the data instead. It should expand the number of rowsto show all the vitals if there are more than fit, and shouldn't appear if they fit in the container.
- 2026-11-20 (Robert Bo Davis): Triage: small UI follow-ups (member page; timeline-ux slice 5's Today card), app-shell and timeline-ux are done, so quick-fixes slices

### B-187 · bug · timeline filter interface is overwhelming on mobile and confusing on desktop, especially the vitals…

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 7bc05133

- 2026-11-20 (Robert Bo Davis): From the inbox: timeline filter interface is overwhelming on mobile and confusing on desktop, especially the vitals subfilters. Maybe move into a "filter" button that opens a modal with the filters.
- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, one slice: a Filter button opening a sheet/dialog with the vitals subfilters inside; promote to its own topic if the design grows

### B-188 · bug · when signing up mcp connector, the oauth request just returns json, not the accept flow

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: c505b681

- 2026-11-20 (Robert Bo Davis): Triage: connectors is done, so quick-fixes slices; B-188 breaks connecting on the live site, first
- 2026-11-20 (slice/quick-fixes/47): Slice 47: not reproduced. claude.ai's request shape (DCR to https://claude.ai/api/mcp/auth_callback, PKCE S256, scope incl. offline_access, prompt=consent, resource) 302s to /connect locally (dev and check build) and on staging (signed out); no authorize variant gives JSON for a navigation except the 429 rate limit (30/min/IP). Unknown client/bad redirect now render an HTML page; staging: remove + re-add the connector, then report the JSON body if it recurs.
- 2026-11-20 (prd/quick-fixes): Slice 47 (orchestrator): not reproduced. claude.ai's shape (DCR with the auth_callback, PKCE, resource, prompt=consent, offline_access) 302s to /connect signed in and out, locally and on staging; error cases redirect. The only navigation JSON found is the plugin's authorize rate limit (30/60 s per IP, 429). Built: a browser navigation's dead ends at authorize now show an HTML page (invalid link, or too many tries). If it recurs on staging, reopen with the JSON body and URL.

### B-189 · bug · mcp connector for medication change records on the timeline, it isn't providing information about…

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 68a3cc50

- 2026-11-20 (prd/appointments-2): From the inbox: mcp connector for medication change records on the timeline, it isn't providing information about what what kind of change it was (started, stopped, or a new dose), and there are no before-and-after values.
- 2026-11-20 (Robert Bo Davis): Triage: connectors is done, so quick-fixes slices; B-188 breaks connecting on the live site, first

### B-190 · bug · mcp connector returning truncated notes on doses, and maybe other things

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 68a3cc50

- 2026-11-20 (Robert Bo Davis): Triage: connectors is done, so quick-fixes slices; B-188 breaks connecting on the live site, first

### B-191 · bug · clicking the next entry in the upcoming section of the simple timeline should expand the section,…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (prd/quick-fixes): From the inbox: clicking the next entry in the upcoming section of the simple timeline should expand the section, not take you to the next entry. once expanded, clicking on any item should take you to the full view of that item.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small simple-mode timeline fix (the Upcoming block's next entry expands the block; once open, each item opens its page). A slice in a later wave; the user reviews.

### B-192 · bug · undo when checking off a todo should list all the todos that were checked off, not just the last…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (prd/quick-fixes): From the inbox: undo when checking off a todo should list all the todos that were checked off, not just the last one that was checked off.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small tasks fix (the undo after checking off names every task checked off since, not just the last). A slice in a later wave; the user reviews.

### B-193 · feature · In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): today nothing in the app tells a member the URL or where to add it; connectors-2 PRD, to write

### B-194 · feature · A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): connectors-2 PRD, to write; touches notifications

### B-195 · feature · Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): MCP prompts were out of scope in connectors; connectors-2 PRD, to write

### B-196 · feature · List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): after the production launch (B-33) and the privacy policy and terms (B-54); vendor review

### B-197 · feature · Connector write tool add_condition (and resolve): a connected assistant adds or resolves a care recipient's condition through recipientConditionService

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (plan/conditions): Conditions planning 2026-11-20 (the user): conditions ship read-only to assistants; the writer is a follow-up, after the conditions PRD lands

### B-198 · bug · rotating placeholder in the timeline entry box is distracting and confusing. Use a static…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (prd/conditions): From the inbox: rotating placeholder in the timeline entry box is distracting and confusing. Use a static placeholder that is a prompt to type something. and move to a ? with tooltip to explain the format/power.
- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Undoes timeline-ux's rotating placeholder (B-170ish) for a static prompt plus a ? tooltip on the format; quick entry only.
- 2026-11-20 (Robert Bo Davis): Correction to the note above: the rotating placeholder came from a timeline-ux slice (quick entry); ignore the 'B-170ish' guess.

### B-199 · bug · ability to add a medication quickly from the log a dose screen.

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. A small 'new medication' path from the log-a-dose sheet; reuses the medications form. If it needs B-200's type field, run after it.

### B-200 · bug · medications need a type field: rx, otc, supplement, etc.

- status: triaged
- prd: medications-3
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triage: medications-3 (to write). A new synced column (migration, sync rules, form, list filter, connector list_medications) with open choices (the type list, required or not, prescriber link); conditions is running and touches medications, so plan it to start after conditions lands.

### B-201 · bug · simple timeline date header should show the care period as well

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Simple mode's day header gains the care period label that the full day header already has.

### B-202 · bug · lint before typecheck in check command. Do the fast thing first, then the slow thing.

- status: landed
- prd: agent-tooling
- owner:
- commit: ba84d886

- 2026-11-20 (Robert Bo Davis): Triage: a small change straight on dev (package.json check order). Caveat: format:check is the fastest; type-aware ESLint may be slower than tsc, so time both before reordering.

### B-203 · feature · Now that we are we have github fixed, we should start using it for some of the merge management so…

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Now that we are we have github fixed, we should start using it for some of the merge management so codex can review PRs. I do NOT want PRDs or plans to be in github, only the code. Instead of merging to dev locally, we need to start pushing working branches to github and creating a PR into dev, then waiting for codex to review, then addressing any comments, then merging to dev.
- 2026-11-20 (Robert Bo Davis): Triage: github-review (to write): pnpm prd land pushes the branch and opens a PR into dev, waits for Codex's review, addresses comments, then merges. Open: plans/ and the PRDs are already on origin/dev and origin/main (public repo), so 'code only on GitHub' means moving plans out of the repo or into an untracked/separate store; the live backlog commits onto dev, which then can't be PR-only.
- 2026-11-20 (Robert Bo Davis): User 2026-11-20: keep plans/ tracked as now; only code branches go through PRs and Codex review; backlog commits stay direct onto dev. Planning session: github-review.
- 2026-11-20 (plan/github-review): Planned in plans/github-review-plan.md (3 slices, waves 1 -> (2, 3)): Codex verdict and pnpm prd review; pnpm prd pr, land's PR path (prd/ always, hotfix --pr/--local asked each time, --no-review on the user's word), dev-sync; ready, prompts, rm. Plans, backlog and small changes stay local; the tooling pushes dev. Wave 1 lands locally, wave 2 through the new path.

### B-204 · feature · connector should be able to edit notes and events so it can help you draft questions or add…

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (prd/appointments-2): From the inbox: connector should be able to edit notes and events so it can help you draft questions or add information to the entries.
- 2026-11-20 (Robert Bo Davis): Triage 2026-11-20: connectors-2 (a write tool beside add_note/add_event, like B-197). Notes and events are live Yjs docs, so an edit tool must append a server-side Yjs update (note_update) rather than overwrite, so open editors merge it; likely append-or-section-edit, not full replace. Same via tag and confirm-each-write as the other writes.
