# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

Which PRDs exist, what each depends on, and the shared files it touches: orchestrators read this to choose what can run at the same time. At most three PRD orchestrators run at once.

| PRD               | Doc                                                          | Depends on                                           | Hot files                                                                   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `orchestration`   | (this tooling; no PRD)                                       | (none)                                               | `AGENTS.md`, `scripts/loops/`, `scripts/backlog/`, `.githooks/`             |
| `live-notes-ux`   | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done**, all 10 slices in `dev` | (none) | none now |
| `quick-fixes`     | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–14 in `dev`; new fixes append as slice 15 on. Triaged and waiting: B-44, B-64, B-65, B-69, B-70, B-71, B-72, B-73 | (none) | varies by slice; B-44 the providers route folder (`ProviderListItem`); B-73 `components/ui/Sheet` (after `medications` slice 3); B-71 `components/ui/date/` |
| `app-shell`       | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done**, all 7 slices in `dev` | (none) | none now |
| `timeline-polish` | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done**, all 7 slices in `dev` | `live-notes-ux`, `app-shell`, `routing`, `components` (all done) | none now |
| `search`          | to write | `timeline-polish` (done); best run after `appointments` finishes (same timeline files) | `lib/sync/schema.ts`, `lib/sync/timeline.ts` (`entryWindow`), `lib/timelineFilters.ts`, the timeline route folder |
| `providers`       | [PRD](providers-prd.md), [plan](providers-plan.md): **done**, all slices in `dev` (`7c075d1`); follow-ups B-25, B-48 | (none) | none now |
| `medications`     | [PRD](medications-prd.md), [plan](medications-plan.md): slices 1, 2, 4 and 6 in `dev`; **slice 3 running** (B-15 claimed); 5 waits for 3. Follow-ups B-26, B-51 | `providers`, `routing`, `components` (all done) | `TIMELINE_ENTRY_KINDS`, `KIND_META`, timeline strips and quick add, `care_recipient`, `note_document`, sync and upload registries, `GROUP_SECTIONS`, `routes.ts`, the Dose sheet |
| `assistant`       | to write (B-12, B-49, B-58) | `search`'s server side; `providers`, `medications`, `care-periods` (soft) | `routes/app/layout/route.tsx`, `packages/api`, a new AI package |
| `routing`         | [PRD](routing-prd.md), [plan](routing-plan.md): **done**, all 5 slices in `dev` (`ff25ef2`) | (none) | none now; new routes go through `routes.ts` and `appUrls` |
| `components`      | [PRD](components-prd.md), [plan](components-plan.md): **done**, all 6 slices in `dev` (landed 2026-11-18, `ca39416`) | `routing` (done) | none now; new UI uses `components/ui/` and the feature folders (AGENTS.md, _Components_) |
| `invites`         | [PRD](invites-prd.md), [plan](invites-plan.md): **done**, all 6 slices in `dev` (landed 2026-11-18, `e6286f4`) | (none) | none now; follow-ups (Withdraw for a join request, the recipient's time zone) and launch work are in AGENTS.md |
| `marketing`       | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**, all 5 slices in `dev`. B-40 and B-54 wait on the user | `invites` (done) | none now |
| `profiles`        | to write (B-45, B-46)                                        | `invites` (done); `medications` slice 1 (synced date of birth, time zone) | `care_recipient`, the `member_profiles` stream and publication columns, group settings Details and Members, the device schema |
| `appointments`    | [PRD](appointments-prd.md), [plan](appointments-plan.md): slices 1–6 in `dev` (slice 5 `9cafb09`); **slice 7 blocked by `medications` slice 5** (B-47 claimed; follow-ups B-60–B-63) | `providers` (done); `medications` slice 5 (reminders) | the timeline route folder, `entryWindow` in `lib/sync/timeline.ts`, `KIND_META`, `EntryTimeChip` |
| `care-periods`    | to write (B-50)                                              | `timeline-polish` (filters, infinite scroll)          | a new table, sync and upload registries, `lib/timelineFilters.ts`, the timeline route folder |
| `data-rights`     | to write (B-52, B-53)                                        | (none)                                               | `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `tasks`           | to write (B-55)                                              | (none); `notifications` for reminders (soft)          | a new table, sync and upload registries, `GROUP_SECTIONS`, `routes.ts`     |
| `documents`       | to write (B-56)                                              | hosting (B-33, file storage); `profiles` (soft); `encryption` decision | file storage, `routes.ts`, `GROUP_SECTIONS`, `PERMISSIONS`              |
| `encryption`      | to write (B-57; a design discussion first)                   | (none); affects `assistant` and `documents`          | everything server side that reads content (`sync.ts`, `noteDocumentService`) |
| `onboarding`      | to write (B-31)                                              | `invites` (done)                                     | seeds, `careGroupService`, `/app` home                                     |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-1 | bug | landed | quick-fixes | prd/quick-fixes | Sign-in can be submitted again while it's loading, and the first load is slow |
| B-2 | change | landed | timeline-polish | prd/timeline-polish | Latest vitals is too busy |
| B-3 | change | landed | timeline-polish | prd/timeline-polish | Wider timeline entries on large screens, still mobile-first |
| B-4 | change | landed | timeline-polish | prd/timeline-polish | Tooltip with the author's name and avatar on an entry's initials |
| B-5 | change | landed | timeline-polish | prd/timeline-polish | Tap an entry's kind icon to filter by that kind |
| B-6 | change | landed | timeline-polish | prd/timeline-polish | Tap an entry's author initials to filter by that author |
| B-7 | change | landed | timeline-polish | prd/timeline-polish | More prominent day headers in the timeline |
| B-8 | feature | landed | app-shell | prd/app-shell | Avatar in the header with a menu for the user's settings and actions |
| B-9 | feature | landed | app-shell | prd/app-shell | Care group menu: switch groups, open the group's settings |
| B-10 | feature | landed | timeline-polish | prd/timeline-polish | Infinite scroll through the whole timeline |
| B-11 | feature | triaged | search |  | Search the timeline |
| B-12 | plan | triaged | assistant |  | Assistant: lightweight chat, with voice, for quick actions and questions about the timeline |
| B-13 | plan | landed | providers | prd/providers | Provider directory with search, linked from events |
| B-14 | plan | landed | providers | prd/providers | Provider links and suggestions while writing events and live notes |
| B-15 | plan | in-progress | medications | prd/medications | Medication list (current, past, discontinued), printable sheet, and tracking in the timeline |
| B-16 | question | live |  |  | How does the timeline's layout (rows or cards) persist? |
| B-17 | bug | landed | quick-fixes | prd/quick-fixes | A timeline layout change made offline is lost |
| B-18 | feature | landed | live-notes-ux | prd/live-notes-ux | Event title suggestions (live notes slice 3) |
| B-19 | feature | landed | live-notes-ux | prd/live-notes-ux | Live dot and the Live now banner (live notes slice 7) |
| B-20 | chore | landed | live-notes-ux | prd/live-notes-ux | Browser check overhaul and documentation (live notes slice 10) |
| B-21 | chore | landed | orchestration | prd/orchestration | Multi-orchestrator tooling: dev/staging/main, prd/ and slice/ branches, the live backlog, hooks |
| B-22 | bug | landed | quick-fixes | prd/quick-fixes | The first screen after sign-in waits up to 10 s for the first sync |
| B-23 | change | landed | routing | prd/routing | Nested routes: a group layout route, sheet URLs, settings subpages, a folder per route |
| B-24 | change | landed | components | prd/components | Well-abstracted components: UI primitives, thin routes, feature folders, no duplicates |
| B-25 | feature | triaged | providers |  | @-mentions of providers inside live notes and events |
| B-26 | feature | triaged | medications |  | Allergies on the care recipient, shown on the medications page and printed sheet |
| B-27 | bug | landed | quick-fixes | prd/quick-fixes | routing.mjs fails: group settings blank after the entry step; account Sign out flaky |
| B-28 | chore | landed | quick-fixes | prd/quick-fixes | Limit browser checks machine-wide: a lock so at most two run at once |
| B-29 | chore | landed | quick-fixes | prd/quick-fixes | Restart PowerSync inside datastore:reset, and fix the flakes it causes |
| B-30 | plan | landed | invites | prd/invites | Sign-up and invites: invite people to a care group by email, accept with consent, verification and password reset |
| B-31 | feature | triaged | onboarding |  | Demo group for every new user: a seeded, fictional care group to explore the app |
| B-32 | plan | landed | marketing | prd/marketing | Landing page and basic marketing pages |
| B-33 | plan | inbox |  |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-34 | change | landed | quick-fixes | prd/quick-fixes | Date picker for the When field: a calendar to pick the date, not only typed segments |
| B-35 | bug | landed | quick-fixes | prd/quick-fixes | A practice's type can change to clinician or other while clinicians still point at it |
| B-36 | chore | landed | quick-fixes | prd/quick-fixes | Independent integration tests: no shared group across describe blocks |
| B-37 | bug | landed | quick-fixes | prd/quick-fixes | Deleting a practice leaves its clinicians linked to it |
| B-38 | bug | landed | quick-fixes | prd/quick-fixes | Production build differs from dev: a deleted provider's 404 renders blank, a viewer's providers/new doesn't redirect |
| B-39 | chore | landed | quick-fixes | prd/quick-fixes | Lean browser checks: move pure-logic steps to unit tests, add a fast smoke mode |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-41 | bug | landed | quick-fixes | prd/quick-fixes | /app stays blank after a full reload (app-shell.mjs last-group steps) |
| B-42 | change | landed | quick-fixes | prd/quick-fixes | App header uses the brand: the logo mark and wordmark, and the marketing header's look |
| B-43 | change | ready | medications | prd/medications | Reorder/group "new" buttons in timeline to "note", "event", "dose", "symptom", "vital" |
| B-44 | change | ready | quick-fixes | prd/quick-fixes | Display phone number, address, email, etc. in provider directory without a click. Use that as link… |
| B-45 | change | triaged | profiles |  | birthdate, contact information, address, and insurance information should optionally be added to… |
| B-46 | change | triaged | profiles |  | optional phone number, address, etc on group members that can be published to the group for… |
| B-47 | feature | in-progress | appointments | prd/appointments | Deal with future event display (appointments) notes can be set to the future date as well. Symptoms… |
| B-48 | feature | triaged | providers |  | Allow import of providers from other care groups that you have access to. |
| B-49 | feature | triaged | assistant |  | Once we have agentic integration, Add ai generated summary to each day on the timeline and the… |
| B-50 | feature | triaged | care-periods |  | Add ability to add timeline groupings, like "at home - start date-end date", "in hospital - start… |
| B-51 | feature | triaged | medications |  | printable medication schedule sheet that can be printed to be checked off with a pen at patient's… |
| B-52 | feature | triaged | data-rights |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-55 | feature | triaged | tasks |  | Todos list with assignment to group members, due dates, and completion status. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-57 | plan | triaged | encryption |  | Discuss options for end to end encryption of data in transit and at rest where owner of the data is… |
| B-58 | plan | triaged | assistant |  | Add ability to use AI to review timeline, explain concerns, and generate a cheat sheet of questions… |
| B-59 | chore | triaged | orchestration |  | Clean up/truncate this file and the backlog periodically. |
| B-60 | feature | triaged | appointments |  | Recurring appointments (weekly PT, dialysis three times a week) |
| B-61 | feature | triaged | appointments |  | Appointment reminders by email and push before the appointment |
| B-62 | feature | triaged | appointments |  | iCal feed of a care group's upcoming appointments |
| B-63 | feature | triaged | appointments |  | Google Calendar sync of a care group's appointments |
| B-64 | feature | triaged | quick-fixes |  | Withdraw a pending join request from the requester's home |
| B-65 | change | triaged | quick-fixes |  | New care groups get the recipient's time zone |
| B-66 | question | inbox |  |  | Access codes are stored as plain text: keep that, or hash them? |
| B-67 | question | inbox |  |  | Access-code sign-up says when an address already has an account |
| B-68 | chore | inbox |  |  | Email sending setup before launch: domain tracking off, SPF/DKIM/DMARC, bounce webhooks, cron schedule, rate-limit storage |
| B-69 | chore | triaged | quick-fixes |  | Move the New care group link state into components/groups |
| B-70 | bug | triaged | quick-fixes |  | ui.mjs flake: the provider add sheet at 1280 dark, Escape then focus check |
| B-71 | bug | ready | quick-fixes | prd/quick-fixes | date picker entry box mobile-friendly. it expands outside of elements on small screens. |
| B-72 | bug | ready | quick-fixes | prd/quick-fixes | suggested provider list is too long on mobile. |
| B-73 | bug | in-progress | quick-fixes | prd/quick-fixes | timeline entry add modal should take up the full screen on mobile, don't leave room for header. |

## Items

### B-1 · bug · Sign-in can be submitted again while it's loading, and the first load is slow

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b0325d0

- 2026-11-17 (dev keeper): Likely cause: `sign-in.tsx` disables the button only while `navigation.state === "submitting"`. After the action redirects, the state is `"loading"` while `/app`'s loaders run `waitForFirstSync` (up to 10 s on a device that hasn't synced), and the button is live again. Fix: stay disabled until the navigation is idle. The slowness is separate: the first sync blocks the first screen. Triage it before choosing a shorter cap, rendering local data straight away with a syncing state, or a smaller first bucket.
- 2026-11-17 (plan/quick-fixes): Narrowed to the double submit; the slow first load is now B-22. Quick-fixes slice 1.
- 2026-11-18 (slice/quick-fixes/1): slice/quick-fixes/1: fixed in sign-in.tsx (busy while navigation !== idle) with browser check sign-in.mjs; ready for review

### B-2 · change · Latest vitals is too busy

- status: landed
- prd: timeline-polish
- owner: prd/timeline-polish
- commit: 908d4fa

- 2026-11-17 (dev keeper): To settle in the PRD: fewer types, one line, or collapsed behind a tap.
- 2026-11-17 (plan/timeline-polish): PRD: plans/timeline-polish-prd.md (plan/timeline-polish). One line (2–3 most recent + 'All vitals ›' to expand); ignores filters.
- 2026-11-18 (Robert Bo Davis): Plan: plans/timeline-polish-plan.md, slice 3. Latest vitals in one line with 'All vitals'. Independent. Wave 1.
- 2026-11-18 (slice/timeline-polish/3): Slice 3 built on slice/timeline-polish/3: one-line strip with All vitals; phones hide the visible Latest label so a second reading fits. pnpm check and phase2.mjs (44/44) pass.

### B-3 · change · Wider timeline entries on large screens, still mobile-first

- status: landed
- prd: timeline-polish
- owner: prd/timeline-polish
- commit: f787e1a

- 2026-11-17 (plan/timeline-polish): PRD: plans/timeline-polish-prd.md (plan/timeline-polish). Full width at lg+, entry text capped ~75ch; cards in a 2–3 column grid.
- 2026-11-18 (Robert Bo Davis): Plan: plans/timeline-polish-plan.md, slice 5. Full width from lg, 75ch text cap, card grid. Independent; planned for wave 2.
- 2026-11-18 (Robert Bo Davis): Paused 2026-11-18 by the user: routing (B-23) and then components (B-24) run before timeline-polish continues. Wave 1 (slices 1-3) is in dev as 644f780. Slice 5; ready. Replan against the new route folders and components when it resumes.
- 2026-11-18 (slice/timeline-polish/5): Slice 5 built on slice/timeline-polish/5: from lg the timeline is full width, entry text capped at 75ch, cards in a 2/3-column grid per day; list has data-view. phase2 85/85, roundtrip, settings-layout, layout-offline and pnpm check pass.

### B-4 · change · Tooltip with the author's name and avatar on an entry's initials

- status: landed
- prd: timeline-polish
- owner: prd/timeline-polish
- commit: 7e44461

- 2026-11-17 (dev keeper): Touch has no hover. If tapping the initials filters by author (B-6), phones need another trigger (long-press, or the name shown in the filter chip).
- 2026-11-17 (plan/timeline-polish): PRD: plans/timeline-polish-prd.md (plan/timeline-polish). Hover/focus tooltip (name + avatar), desktop only; touch uses B-6's author chip.
- 2026-11-18 (Robert Bo Davis): Plan: plans/timeline-polish-plan.md, slice 6. Author tooltip. Blocked by slice 4. Wave 3.
- 2026-11-18 (Robert Bo Davis): Paused 2026-11-18 by the user: routing (B-23) and then components (B-24) run before timeline-polish continues. Wave 1 (slices 1-3) is in dev as 644f780. Slice 6; blocked by slice 4 (B-6).
- 2026-11-18 (slice/timeline-polish/6): slice 6 built on slice/timeline-polish/6 (646ee61, 2461c2c): ui/tooltip primitive, author initials tooltip; hand-off sent to the orchestrator

### B-5 · change · Tap an entry's kind icon to filter by that kind

- status: landed
- prd: timeline-polish
- owner: prd/timeline-polish
- commit: 5d6678a

- 2026-11-17 (dev keeper): The icon sits inside the row's stretched tap target (`EntryOpenTarget`); it becomes its own control above it (`relative z-10`, like ⋯).
- 2026-11-17 (plan/timeline-polish): PRD: plans/timeline-polish-prd.md (plan/timeline-polish). Kind icon becomes its own z-10 control; combines with ?author=; re-tap is a no-op.
- 2026-11-18 (Robert Bo Davis): Plan: plans/timeline-polish-plan.md, slice 1. Filter-state module and the kind icon as a filter. Blocked by nothing; blocks slice 4. Wave 1.
- 2026-11-18 (slice/timeline-polish/1): Slice 1 built on slice/timeline-polish/1: lib/timelineFilters.ts (kind and author), chips and loader moved onto it, kind icon is a 'Show only <kind plural>' link in rows and cards. pnpm check green; phase2 new steps 52/52.

### B-6 · change · Tap an entry's author initials to filter by that author

- status: landed
- prd: timeline-polish
- owner: prd/timeline-polish
- commit: f787e1a

- 2026-11-17 (dev keeper): A new `?author=` filter chip, beside `?kind=`.
- 2026-11-17 (plan/timeline-polish): PRD: plans/timeline-polish-prd.md (plan/timeline-polish). ?author= filter; chip 'By <name> ✕' with avatar; combines with ?kind=.
- 2026-11-18 (Robert Bo Davis): Plan: plans/timeline-polish-plan.md, slice 4. Author filter, author chip. Blocked by slice 1; blocks slices 6 and 7. Wave 2.
- 2026-11-18 (Robert Bo Davis): Paused 2026-11-18 by the user: routing (B-23) and then components (B-24) run before timeline-polish continues. Wave 1 (slices 1-3) is in dev as 644f780. Slice 4; ready, builds on lib/timelineFilters.ts. Replan against the new route folders and components when it resumes.
- 2026-11-18 (slice/timeline-polish/4): Slice 4 built on slice/timeline-polish/4 (8a7595e, fd2a8b0): author filter end to end; pnpm check and phase2, roundtrip, live-notes, app-shell, providers, ui pass. Ready for the orchestrator to merge.

### B-7 · change · More prominent day headers in the timeline

- status: landed
- prd: timeline-polish
- owner: prd/timeline-polish
- commit: cf96edc

- 2026-11-17 (plan/timeline-polish): PRD: plans/timeline-polish-prd.md (plan/timeline-polish). Larger semibold sticky headers: Today, Yesterday, 'Monday, Nov 16' (+year).
- 2026-11-18 (Robert Bo Davis): Plan: plans/timeline-polish-plan.md, slice 2. dayLabel and larger day headers. Independent. Wave 1.

### B-8 · feature · Avatar in the header with a menu for the user's settings and actions

- status: landed
- prd: app-shell
- owner: prd/app-shell
- commit: 9e5f7c2

- 2026-11-17 (dev keeper): Settings, units, timeline layout, sign out.
- 2026-11-17 (plan/app-shell): PRD written: plans/app-shell-prd.md on plan/app-shell. Avatar menu: name/email header, Settings, theme (System/Light/Dark, per device), Sign out.
- 2026-11-17 (plan/app-shell): Plan: plans/app-shell-plan.md (plan/app-shell). Slices 1 (frame + user menu) and 2 (theme); slice 7 (layout in Settings) noted here.
- 2026-11-18 (prd/app-shell): app-shell slice 1 (frame + user menu) merged into prd/app-shell at 697c39b; slice 2 (theme) still to come, so B-8 stays in progress.
- 2026-11-18 (slice/app-shell/7): app-shell slice 7 (timeline layout in Settings) started on slice/app-shell/7
- 2026-11-18 (slice/app-shell/7): app-shell slice 7 (timeline layout in Settings) handed off on slice/app-shell/7: pnpm check and settings-layout.mjs, phase2, layout-offline, app-shell checks pass
- 2026-11-18 (prd/app-shell): Slice 7 (timeline layout in Settings) merged into prd/app-shell at 0795604.

### B-9 · feature · Care group menu: switch groups, open the group's settings

- status: landed
- prd: app-shell
- owner: prd/app-shell
- commit: 812fe18

- 2026-11-17 (dev keeper): To settle: what group settings holds at first (name, recipient profile, members and roles; invites wait for Resend). Recommended: a group nav (Timeline · Medications · Providers · Assistant) with slots that later PRDs fill.
- 2026-11-17 (plan/app-shell): PRD written: plans/app-shell-prd.md on plan/app-shell. Group menu switches groups; /app opens the last-used group; bottom tabs (GROUP_SECTIONS registry); group settings = name, recipient (name, preferred name, DOB), members and roles; online-only clientAction → new oRPC procedures. No migration.
- 2026-11-17 (plan/app-shell): Plan: plans/app-shell-plan.md. Slices 3 (group menu, last group), 4 (sections nav), 5 (settings: details), 6 (settings: members).
- 2026-11-18 (slice/app-shell/4): app-shell slice 4 (sections nav + tab bar) committed on slice/app-shell/4 at d0d5c63; awaiting merge
- 2026-11-18 (slice/app-shell/3): slice 3 (group menu, last group, Dev Family 2 seed) committed on slice/app-shell/3 at 650c0f0; awaiting merge
- 2026-11-18 (prd/app-shell): app-shell slice 3 (group menu, last group, second seed group) merged into prd/app-shell at e3d7119; stays in progress until slice 6.
- 2026-11-18 (prd/app-shell): app-shell slice 4 (GROUP_SECTIONS, SectionNav, TabBar) merged into prd/app-shell at ac4eea3.
- 2026-11-18 (slice/app-shell/5): Slice 5 (group settings: details) is committed on slice/app-shell/5 (01cc17f, 5ede338), ready for review: the page, careGroup.update/recipient/updateRecipient, app-shell.mjs steps. Members is slice 6.
- 2026-11-18 (prd/app-shell): Slice 5 (group settings: details) merged into prd/app-shell; slice 6 (members) started.
- 2026-11-18 (prd/app-shell): Wave 3 landed in dev as ae6f342: slice 5 (group settings: details) and slice 7 (timeline layout in Settings). Slice 6 (members) is running.
- 2026-11-18 (slice/app-shell/6): Slice 6 (group settings: members) is committed on slice/app-shell/6: careGroup.changeRole and removeMember, the Members section (roles, remove, leave), integration tests and app-shell.mjs steps. Ready for the orchestrator's review.
- 2026-11-18 (prd/app-shell): Wave 4 landed in dev as b82a8ce: slice 6 (group settings: members). All seven app-shell slices are in dev; the PRD is done.

### B-10 · feature · Infinite scroll through the whole timeline

- status: landed
- prd: timeline-polish
- owner: prd/timeline-polish
- commit: ced7e14

- 2026-11-17 (dev keeper): Replaces "Show older".
- 2026-11-17 (plan/timeline-polish): PRD: plans/timeline-polish-prd.md (plan/timeline-polish). IntersectionObserver auto-load (limit +30), 'Loading older…' and end-of-timeline message; button removed.
- 2026-11-18 (Robert Bo Davis): Plan: plans/timeline-polish-plan.md, slice 7. Infinite scroll. Blocked by slice 4. Wave 3.
- 2026-11-18 (Robert Bo Davis): Paused 2026-11-18 by the user: routing (B-23) and then components (B-24) run before timeline-polish continues. Wave 1 (slices 1-3) is in dev as 644f780. Slice 7; blocked by slice 4 (B-6). search (B-11) waits on it.
- 2026-11-18 (slice/timeline-polish/7): slice 7 built on slice/timeline-polish/7: infinite scroll (OlderEntries, useLiveRows, timelinePaging). pnpm check green; --changed: roundtrip, app-shell, routing pass; phase2 passes all its own steps, fails only the 8 known wideLayout scrollbar steps (orchestrator fixing on prd). Smooth up to ~300 loaded rows.

### B-11 · feature · Search the timeline

- status: triaged
- prd: search
- owner:
- commit:

- 2026-11-17 (dev keeper): Asked for as Elasticsearch. Recommended instead: SQLite FTS5 on the device (works offline) plus Postgres full-text search on the server (API, AI). Elasticsearch is server only, another service to host, and another copy of health data. Check that PowerSync's web SQLite build has FTS5.
- 2026-11-19 (plan/search): PRD written on plan/search: plans/search-prd.md (interview 2026-11-19). Covers entries, providers, medications and their notes; a timeline ?q= filter plus a group search page (header magnifier); FTS5 on the device (porter stemming, prefix, phrases, -exclusions, indexes unsynced text) and Postgres FTS on the server (searchService, search.query) for the assistant. Run after appointments lands.

### B-12 · plan · Assistant: lightweight chat, with voice, for quick actions and questions about the timeline

- status: triaged
- prd: assistant
- owner:
- commit:

- 2026-11-17 (dev keeper): Quick actions go through the same local write paths as the forms (offline, synced), as a draft the user confirms. Questions need server-side retrieval and an AI vendor that doesn't retain or train on our data.
- 2026-11-18 (plan/assistant): Draft PRD written on plan/assistant: plans/assistant-prd.md. Interview 2026-11-18: actions first then questions; floating button + sheet; server transcription (vendor open); conversations not saved; drafts confirmed; offline queue (text + audio, drafts wait); opt-in per group (owner consents, members acknowledge); read tools over services; Anthropic TS SDK; model chosen by an eval; create + edit recent; Save as note; 'via assistant' marker; daily caps per user. Questions wait on search's server side.

### B-13 · plan · Provider directory with search, linked from events

- status: landed
- prd: providers
- owner: prd/providers
- commit: 30f0d61

- 2026-11-17 (dev keeper): To settle: one table with a type (provider, pharmacy, facility, contact) or several; what an event's link stores.
- 2026-11-18 (Robert Bo Davis): PRD written: plans/providers-prd.md. One provider table (clinician | practice | pharmacy | other), clinician→practice link, phones, primary (any number), past status, live notes via a generalized note_document, soft delete. Plan after components lands.
- 2026-11-18 (Robert Bo Davis): Planned: plans/providers-plan.md. Slices 1–4 (data now; list after routing 1; add/edit after routing 2; provider page). Only linking (B-14, slices 5–7) waits for components 2–4.
- 2026-11-18 (slice/providers/1): slice/providers/1 (09b62bd, 17b861d): data layer done — provider + timeline_entry_provider tables, note_document subject/entry_id/provider_id, services, sync, device module lib/sync/providers.ts, seeds; providers.mjs started
- 2026-11-18 (slice/providers/4): slice 4 (provider page + live notes) committed on slice/providers/4 (e773c21, f76862d); providers.mjs 57/57, live-notes 91/91, routing 55/55
- 2026-11-18 (slice/providers/3): slice 3 (add, edit, delete sheets) committed on slice/providers/3 at 41ee0b6, 280cef2; providers.mjs 63/63

### B-14 · plan · Provider links and suggestions while writing events and live notes

- status: landed
- prd: providers
- owner: prd/providers
- commit: 1b1a039

- 2026-11-17 (dev keeper): Tiptap mentions in the document, a field on the event, or both.
- 2026-11-18 (Robert Bo Davis): PRD written (providers): timeline_entry_provider link table (pair-derived ids), With row on events and notes, picker with inline add, suggestions from title/text matches, title memory and recent links. No @-mentions.
- 2026-11-18 (Robert Bo Davis): Planned: providers slices 5–7 (With row, suggestions, 'with …' on rows), after components slices 2–4 land.
- 2026-11-18 (prd/providers): Providers orchestrator, end of session: slices 1–4 are in dev (slice 1 cc47b01, slices 2–4 5a2c8af); the plan's Status table in dev still says wave 2 is awaiting its go-ahead, but it landed. Slices 5–7 wait for components slices 2–4 in dev; then pnpm prd start providers, sync, and start slice 5. The prd/providers worktree was removed to free a PRD slot.
- 2026-11-18 (slice/providers/5): slice 5 (With row, picker, linked entries) committed on slice/providers/5 (12722a3, 83b6249); providers.mjs 104/104, live-notes 93/93
- 2026-11-18 (slice/providers/7): slice 7: timeline rows and cards show 'with <names>' (2 names, then +N, removed greyed) from one live query beside the entries; seeds: Pharmacy pickup has 2 providers, Primary care visit: Dr. Alvarez has 3
- 2026-11-18 (slice/providers/6): slice 6 (suggestions) committed on slice/providers/6: suggestProviders in lib/providerSuggestions.ts, chips in the With row

### B-15 · plan · Medication list (current, past, discontinued), printable sheet, and tracking in the timeline

- status: in-progress
- prd: medications
- owner: prd/medications
- commit:

- 2026-11-17 (dev keeper): Place "a dose was given" with the kind definitions first (a new kind, not a vital). Prescriber links depend on providers.
- 2026-11-18 (Robert Bo Davis): PRD written: plans/medications-prd.md. New kinds dose and medicationChange (auto-written with the medication), simple schedules in the recipient's zone, missed doses derived, print page with print CSS, date of birth synced. Data layer waits on providers slice 1; screens on routing.
- 2026-11-18 (slice/medications/1): Slice 1 (the data layer) is ready on slice/medications/1 (febd581): medication table, dose and medicationChange kinds, sync, seeds, migration 0011. care_recipient.time_zone is now required: anything that creates a recipient must pass it.
- 2026-11-18 (prd/medications): medications orchestrator: wave 1 (slice 1, data layer) landed in dev as 4bcf119; slices 2 (tab, list, page) and 4 (doses on the timeline, with B-43) started 2026-11-18.
- 2026-11-18 (slice/medications/2): Slice 2 (tab, list, page) committed on slice/medications/2 (3f7e4bd, c051eab): lib/medicationDisplay.ts holds dose/change wording slice 4 may reuse.
- 2026-11-18 (prd/medications): medications orchestrator: slice 2 (tab, list, page) merged into prd/medications as d7977c1; slice 6 (print sheet, provider page's medications) started; slice 4 still running.
- 2026-11-18 (slice/medications/4): Slice 4 (doses and changes on the timeline, Dose sheet) ready for merge on slice/medications/4 (63d73d2, a021378).
- 2026-11-18 (prd/medications): medications orchestrator: slice 4 (doses and changes on the timeline, Dose sheet, B-43) merged as 46c675b; its wording now reuses slice 2's medicationDisplay. Slice 6 still running.
- 2026-11-19 (slice/medications/6): medications slice 6 (print sheet + provider page Medications) committed on slice/medications/6 as 74388c4; phase2's 8 wide-layout failures (15 px off at 1280) reproduce on the base d7977c1 too
- 2026-11-19 (prd/medications): medications orchestrator: wave 2 (slices 2, 4, 6) landed in dev as bc944ae; slice 3 (add, edit, stop, restart, delete) started 2026-11-19, then slice 5.
- 2026-11-19 (prd/medications): medications orchestrator: wave 3 (slice 3: add, edit, stop, restart, delete) landed in dev as c887336; slice 5 (Today, Due now) running.

### B-16 · question · How does the timeline's layout (rows or cards) persist?

- status: live
- prd:
- owner:
- commit:

- 2026-11-17 (dev keeper): Answered: as `user.preferences.timelineView`, saved through `me.updatePreferences`, and cached per user in localStorage (`lib/me.ts`) for offline use. It follows the account across devices. Gap: see B-17.

### B-17 · bug · A timeline layout change made offline is lost

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b0325d0

- 2026-11-17 (dev keeper): `timeline.tsx` drops a failed `updatePreferences`, so the next online load restores the server's copy.
- 2026-11-17 (plan/quick-fixes): Quick-fixes slice 2: queue the change on the device and send it on the next online load.
- 2026-11-18 (slice/quick-fixes/2): slice/quick-fixes/2 32355db: saveSettings/pending records in lib/me.ts, timeline toggle uses it; layout-offline.mjs 12/12

### B-18 · feature · Event title suggestions (live notes slice 3)

- status: landed
- prd: live-notes-ux
- owner: prd/live-notes-ux
- commit: ea0b192

- 2026-11-17 (slice/live-notes-ux/3): slice 3 built on slice/live-notes-ux/3 (af79030): chips in the title region, title-chips.mjs 16/16

### B-19 · feature · Live dot and the Live now banner (live notes slice 7)

- status: landed
- prd: live-notes-ux
- owner: prd/live-notes-ux
- commit: 5cad30f

- 2026-11-17 (slice/live-notes-ux/7): Slice 7 built on slice/live-notes-ux/7 (3f35d8f): Live now banner + live dot on the timeline; check live-now.mjs 21/21.

### B-20 · chore · Browser check overhaul and documentation (live notes slice 10)

- status: landed
- prd: live-notes-ux
- owner: prd/live-notes-ux
- commit: 7f462fe

- 2026-11-17 (dev keeper): Blocked by slices 3 and 7.
- 2026-11-18 (slice/live-notes-ux/10): Slice 10 committed on slice/live-notes-ux/10: consolidated live-notes.mjs (91 checks, order-independent), roundtrip rewritten, phase2 updated, 6 old checks deleted. AGENTS.md changes listed in the hand-off.
- 2026-11-18 (prd/app-shell): From prd/app-shell: live-note.mjs races under load. Step 4 (B.goto(entryPath)) and step 8 (B.goto(timelineUrl)) full-load caretaker right after member@ writes; entry.tsx's clientLoader reads once after waitForFirstSync, so caretaker gets a 404 (or a blank HydrateFallback past 15 s) if the row hasn't streamed yet. ~1 in 3 runs fail with three loops busy; 3/3 pass on a quiet machine. Suggest waiting for the row in B's local db before goto, or navigating in-app.

### B-21 · chore · Multi-orchestrator tooling: dev/staging/main, prd/ and slice/ branches, the live backlog, hooks

- status: landed
- prd: orchestration
- owner: prd/orchestration
- commit: 3096ba3

### B-22 · bug · The first screen after sign-in waits up to 10 s for the first sync

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b0325d0

- 2026-11-17 (plan/quick-fixes): Split from B-1 (the slowness half). home, timeline and entry clientLoaders call waitForFirstSync (10 s cap) before rendering. Quick-fixes slice 3: measure first, then choose.
- 2026-11-18 (slice/quick-fixes/3): slice/quick-fixes/3 46ef320: cap 1 s + FirstSyncPending state; signal = isFirstSyncDone/useFirstSyncDone in lib/sync/index.ts. Before: fresh sign-in ~1.0 s to first row locally, slow sync froze sign-in up to 10 s then home stuck on 'not in a care group'. After: syncing state ~1.0 s after DB open, then the timeline.

### B-23 · change · Nested routes: a group layout route, sheet URLs, settings subpages, a folder per route

- status: landed
- prd: routing
- owner: prd/routing
- commit: ff24df4

- 2026-11-18 (Robert Bo Davis): PRD written: plans/routing-prd.md. Group layout route (middleware context), symptom/vital sheets at timeline/new/:kind and timeline/:id/edit, settings index + subpages, a folder per route. Runs after app-shell and timeline-polish land.
- 2026-11-18 (Robert Bo Davis): Planned: plans/routing-plan.md, 5 slices (1 alone; 2→3 parallel with 4→5).
- 2026-11-18 (Robert Bo Davis): 2026-11-18: the user is running this next. Its dependency is met: app-shell is done and timeline-polish wave 1 is in dev (644f780); timeline-polish slices 4-7 are paused until routing and components land. routing-plan.md and routing-prd.md still say to wait for all of timeline-polish.
- 2026-11-18 (slice/routing/1): slice 1 committed on slice/routing/1 (2a4bfad, 54d28fd): group route via client middleware (works in native SPA), appUrls, folder per route
- 2026-11-18 (slice/routing/3): slice 3 (edit-sheet URL timeline/:entryId/edit) committed on slice/routing/3 (38f0973, 33d4b98); check and all browser checks pass

### B-24 · change · Well-abstracted components: UI primitives, thin routes, feature folders, no duplicates

- status: landed
- prd: components
- owner: prd/components
- commit: 61fe082

- 2026-11-18 (Robert Bo Davis): From the inbox: Prefer well abstracted components over single-file components and refactor existing components to be more abstracted.
- 2026-11-18 (Robert Bo Davis): PRD written: plans/components-prd.md. Four waves: UI primitives, timeline, entry page, then forms/shell/settings. Browser checks + pure unit tests, no new deps. Runs after routing.
- 2026-11-18 (Robert Bo Davis): Planned: plans/components-plan.md, 6 slices (1→2; 3→5 parallel with 4; 6 last).
- 2026-11-18 (Robert Bo Davis): 2026-11-18: runs after routing, and before timeline-polish slices 4-7 (paused by the user).
- 2026-11-18 (prd/providers): From the providers orchestrator: providers wave 2 (slices 2–4, the directory) lands without a full-suite run under the new `pnpm prd browser` harness (quick-fixes B-28/B-29 synced in at the last moment). Its full suite passed on the old harness (only routing.mjs's B-27 step failed). During components' checks, run the full suite with `pnpm prd browser --suite` and confirm providers.mjs (85 steps) passes under the new harness. Also: slice 4 moved LiveNotesEditor, EditorAvatars, ContactActions and ProviderTypeIcon into components/; provider sheets import EntrySheet from routes/app/groups/timeline/ and should get it from components/.
- 2026-11-18 (slice/components/1): components slice 1 committed on slice/components/1 (a071d12, 4c18db3): ui/Menu primitive, feature folders, one EntryActions; ui.mjs added.
- 2026-11-18 (prd/components): Wave 1 (slice 1) landed in dev as 414b0a6: ui/Menu for every menu, shared components in feature folders (ui, entry, forms, notes, providers, settings, shell) imported through each index.ts, one EntryActions menu. Other PRDs: sync dev at your next wave boundary; new UI uses ui/ and the folders (AGENTS.md, Components). Slice 2 (sheets, popovers, dialogs, avatars, chips, fields) is next.
- 2026-11-18 (slice/components/2): slice 2 ready on slice/components/2 (a2c2bd1): sheet, popover, field, chip group, avatar stack, icon button in ui/; DateTimeField in ui/date; forms/ removed
- 2026-11-18 (prd/components): Wave 2 (slice 2) landed in dev as 666ebf9: ui/ primitives Sheet, Popover, ConfirmDialog, Field, ChipGroup, UserAvatar(size), AvatarStack, IconButton; DateTimeField moved to ui/date/ (own index); components/forms/ removed; only ui/ imports react-aria-components. Other PRDs: sync dev at your next wave boundary and build new UI on these. Slices 3 and 4 start now.
- 2026-11-18 (slice/components/4): components slice 4 (03cde5a): entry page split into loadEntry, useLiveEntry, EntryPageHeader, EntryTitleRegion; LiveNotesEditor focus handle; live-notes 93/93, providers 85/85, ui 577/577
- 2026-11-18 (prd/components): Wave 3 (slices 3 and 4) landed in dev as 511cbed: the timeline route only composes (useTimelineData with paging, useTimelineView, useEntryRemoval, TimelineEntryList, shared EntryBody); the entry route only composes (useLiveEntry, loadEntry, EntryPageHeader, EntryTitleRegion); LiveNotesEditor has a focus handle. Slices 5 (entry form) and 6 (settings, header, written rules) remain. Other PRDs: sync dev at your next wave boundary; avoid routes/app/groups/timeline/ EntryForm and the settings routes until components lands 5 and 6.
- 2026-11-18 (prd/components): Wave 4 (slice 5) landed in dev as 2c924db: the entry form is a shell plus per-kind field components (EntryKindPicker, SymptomFields, VitalReadingsFields, VitalReadingRow, VitalField); ui/Field has a warning line; adding a vital type stays spec-only. Slice 6 (settings, header, provider screens on the primitives; the written rules) is running.
- 2026-11-18 (slice/components/6): slice 6 handed off (23812bf, 60830bc, 011bdd2): settings, providers and entry page on the primitives; ChoiceGroup and BackLink added to ui/; ui.mjs covers settings and joins the suite.

### B-25 · feature · @-mentions of providers inside live notes and events

- status: triaged
- prd: providers
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Later, after providers' linking lands. Typing @ in a note's or event's text suggests providers; a mention links the provider like the With row. Needs @tiptap/extension-mention and @tiptap/suggestion (new dependencies: the user's approval). Out of scope for the providers PRD.
- 2026-11-18 (prd/providers): Triaged to providers by its orchestrator: @-mentions need the provider table and links (slices 1 and 5). A follow-up after slice 5, not in the current plan.

### B-26 · feature · Allergies on the care recipient, shown on the medications page and printed sheet

- status: triaged
- prd: medications
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Left out of the medications PRD's v1 (2026-11-18). Likely a synced list of { substance, reaction, severity } on care_recipient; the print sheet gets an allergies line when it lands.

### B-27 · bug · routing.mjs fails: group settings blank after the entry step; account Sign out flaky

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: e6fc148

- 2026-11-18 (prd/providers): Found by the providers orchestrator while landing providers slice 1. routing.mjs fails on dev itself (b869738, routing wave 2): 'group settings opens under the group route' fails every run (54/55): after the entry step, c.goto(/app/groups/<id>/settings) renders no main and no window.caretookSync; the only console error is Vite's 'Failed to send error to Vite server: TypeError: Cannot read properties of undefined (reading send)', which hides the real error. Not reproduced by a standalone script (sign in, open the same seeded note, then settings), so it depends on routing.mjs's earlier state (its proxy browser). One run also failed 'Account's Sign out signs out' and '/app/settings then asks to sign in' (/app/settings/account), possibly load (avg 60-230). Every other check passed on prd/providers.
- 2026-11-18 (prd/providers): Seen again on prd/providers 5dbd62d (providers slice 2 merged): routing.mjs 53/55, failing 'Account's Sign out signs out' and '/app/settings then asks to sign in' at load ~21; the group settings step passed this time. Slice 2's loop saw 55/55.
- 2026-11-18 (Robert Bo Davis): Routing landed in full (ff25ef2) with B-27 still open; prd/routing is closed. In the landing suite routing.mjs passed 80/80 (slice 5 changed the group settings step to open …/settings/members), so this may only be hidden. Slice 3 saw the same blank group settings once, on a long-running server. Next: a quick-fixes slice, or reopen routing, to find the root cause.
- 2026-11-18 (prd/quick-fixes): Seen on prd/quick-fixes ac12b13 (dev ff25ef2 synced in, fresh datastore:reset and dev server): routing.mjs failed 3 runs in a row at load 18-32. Twice 4/5 with 'caretaker: timed out waiting for ol > li' on the timeline right after the settings/members step (Vite 'Failed to send error' again hides the real error); once with dev's own cdp.mjs, 27/29 with 'offline: Quick add → Symptom opens the sheet' and 'TypeError: Illegal invocation'. Every other suite check passed. The pre-sync routing.mjs passed 55/55. Not caused by quick-fixes: its cdp.mjs 401 retry never fired.
- 2026-11-18 (prd/providers): Still failing after routing finished (prd/providers 82eb690, synced with dev 94a0c08): 'group settings opens under the group route' fails at load ~13 (quiet machine), so not contention. Now at /settings/members, same blank page and 'Failed to send error to Vite server'. Rest of routing.mjs 79/80.
- 2026-11-18 (Robert Bo Davis): Moved to quick-fixes slice 7 (routing is closed). Also folds in routing's leftover app-shell.mjs flake (reading window.caretookSync.userId right after a reload).
- 2026-11-18 (slice/quick-fixes/7): Root cause (slice/quick-fixes/7): proxy.mjs didn't handle CONNECT, and Chrome sends WebSockets through a proxy as CONNECT tunnels, so Vite's HMR socket never connected in routing.mjs's proxied caretaker browser ('[vite] failed to connect to websocket'). That page never got 'optimized dependencies changed, reloading', kept its old pre-bundled chunks while newly visited routes imported the new ones, and broke with two copies of React and Yjs ('Yjs was already imported', 'Invalid hook call'): the blank page. Reproduced with the old proxy on a cleared deps cache (79/80, those errors); fixed proxy passes 80/80 through 4 mid-run re-optimizations. Second cause: the offline Quick add step cut the network right after a full load, before React Router had loaded the sheet route modules, so it reloaded the page offline (the Illegal invocation run); the check now waits for those modules. Not fixed: on a server with an empty deps cache, the very first sign-in can still miss Vite's first reload (504 Outdated Optimize Dep on yjs, blank /sign-in; AGENTS.md gotcha). A follow-up could pre-bundle every dep at startup (optimizeDeps.entries over the route modules).
- 2026-11-18 (slice/quick-fixes/7): Two other flakes seen once each on a quiet machine (load 9-12) during slice 7, neither repeated on a rerun and neither through the proxy, so left for another slice: app-shell.mjs 'goes to the last group after a reload' (member@'s /app full load showed an empty body for 20 s with no errors, then reached Grandpa Lou's timeline later, so the next step 'stale remembered group' failed too); routing.mjs 'a reload reopens the edit sheet with the entry's current values' (the reloaded page showed the value from before the server change despite the step's 3 s sleep: the local database's copy not yet saved when the page reloads). Both look like PowerSync's local copy across a full reload. The sign-out failures from earlier runs didn't recur in 8 routing runs; they were probably the same stale-deps breakage.

### B-28 · chore · Limit browser checks machine-wide: a lock so at most two run at once

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 8eaf3c3

- 2026-11-18 (Robert Bo Davis): Browser checks were 63% of tool time (850 runs, ~10 h) and ~30% failed, mostly timeouts and PowerSync 401s under contention, causing reruns. A wrapper (e.g. pnpm prd browser <check>) takes one of two lock dirs under .loops/.browser/, like the slot leases, waits for a free one, runs the check with the worktree's .env.loop, and releases on exit (including timeouts for signout-wipe and layout-offline). See AGENTS.md, Browser check budget.
- 2026-11-18 (Robert Bo Davis): Planned as quick-fixes slice 4 (plans/quick-fixes-plan.md): pnpm prd browser with two machine-wide leases, --timeout, --suite.
- 2026-11-18 (slice/quick-fixes/4): slice/quick-fixes/4: pnpm prd browser built (2 machine-wide leases, --timeout, --suite, leases in pnpm prd status); hand-off has AGENTS.md wording
- 2026-11-18 (prd/providers): From the providers orchestrator: a check killed by `timeout` (or crashing) leaves its Chrome running on its CDP port; the next run of that check reuses the signed-in browser and fails at 'timed out waiting for input[name=email]'. The wrapper should kill the check's Chrome processes on exit (e.g. by --remote-debugging-port), or cdp.mjs should refuse a port already in use.

### B-29 · chore · Restart PowerSync inside datastore:reset, and fix the flakes it causes

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 8eaf3c3

- 2026-11-18 (Robert Bo Davis): PowerSync 401s and PSYNC_S2101 (stale JWKS after a reset) were the most common browser-check failure. datastore:reset should restart the worktree's own powersync container and wait until it accepts a token, so the first check after a reset doesn't fail. Already on AGENTS.md Next steps (live notes follow-ups).
- 2026-11-18 (Robert Bo Davis): Planned as quick-fixes slice 5 (plans/quick-fixes-plan.md): datastore:reset restarts this worktree's PowerSync and waits for the new JWKS; cdp.mjs retries one 401.
- 2026-11-18 (slice/quick-fixes/5): slice/quick-fixes/5: datastore:reset now stops PowerSync, drops its slot, empties bucket storage and restarts it (restart alone kept stale note_updates), then waits for replication + JWKS; cdp.mjs signIn retries once on a token 401. live-notes and app-shell passed first run right after a reset, no S2101 in the PowerSync log.

### B-30 · plan · Sign-up and invites: invite people to a care group by email, accept with consent, verification and password reset

- status: landed
- prd: invites
- owner: prd/invites
- commit: 0ab74df

- 2026-11-18 (Robert Bo Davis): From the Resend plan in AGENTS.md (Planned: notifications). Today sign-up is disabled and nothing sends or accepts invites; it's what blocks real use.
- 2026-11-18 (Robert Bo Davis): PRD and plan written: plans/invites-prd.md, plans/invites-plan.md (5 slices; slice 1, the notifications package and outbox, can start now). New deps approved: resend, @react-email/components, @react-email/render, qrcode.
- 2026-11-18 (slice/marketing/3): invites slice 3: the consent screen must link to /privacy and /health-data-privacy (marketing slice 3)
- 2026-11-18 (slice/invites/1): invites slice 1 on slice/invites/1 (f1f6dc2, fe08cda, 36520d6): @caretook/notifications, outbox + dev_mail (migration 0009), /api/cron/outbox, /dev/mail. Dropped @react-email/components (deprecated on npm); templates use @react-email/render only.
- 2026-11-18 (slice/invites/3): slice 3 (email invites with consent) built on slice/invites/3: migration 0010_email_invites, invite.* oRPC, /invite/:token, Members Invite sheet and Pending list. Not synced: invites and consent are read through oRPC; care_group_member gains synced invited_by and created_at.
- 2026-11-18 (slice/invites/5): invites slice 5 ready on slice/invites/5 (649c1ab, 5eb7b6f): careGroup.create + New care group sheet, Invite someone card, access codes + /join/:code, /admin (codes, print QR, staff group + ownerInvite). Migration 0011_access_codes to regenerate after slice 4.
- 2026-11-18 (slice/invites/4): slice 4 (invite links, join requests) committed on slice/invites/4: a413fd9, cc04093; migration 0011_link_invites
- 2026-11-18 (prd/providers): invites.mjs hung (no output for 8+ min, load ~6) in step 6-7 (existing account joins from the link) during prd/providers' landing suite on 2026-11-18; a rerun passed 67/67. Its waits there have no timeout, so a hang never fails. Needs a timeout on those waits.

### B-31 · feature · Demo group for every new user: a seeded, fictional care group to explore the app

- status: triaged
- prd: onboarding
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): From the invites interview (2026-11-18): out of scope there, noted for later. Each new account gets a private demo group with fictional seed data (timeline, notes, vitals; later meds and providers) it can explore and delete.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'onboarding' (to write): a private fictional demo group for each new account, made from the seeds' data on sign-up (or on demand from /app home), deletable. Builds on invites (done).

### B-32 · plan · Landing page and basic marketing pages

- status: landed
- prd: marketing
- owner: prd/marketing
- commit: df55253

- 2026-11-18 (Robert Bo Davis): Requested 2026-11-18. The public site at caretook.com (web build only).
- 2026-11-18 (Robert Bo Davis): PRD and plan written: plans/marketing-prd.md, plans/marketing-plan.md (5 slices; slice 1, the frame and home page, can start now). No new dependencies; waitlist and contact need invites slice 1, the admin list invites slice 5.
- 2026-11-18 (slice/marketing/4): slice 4 (waitlist, contact) committed on slice/marketing/4 at 583e5d5; migration 0013_waitlist_contact
- 2026-11-18 (slice/marketing/5): marketing slice 5 (admin waitlist, filters, CSV export) committed on slice/marketing/5 at 6a9b7d6; pnpm check, groups, marketing, routing pass

### B-33 · plan · Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Not planned yet; the user will say when. Covers the open questions in AGENTS.md: hosted database (same region as Vercel functions, pooling), how production migrations run, PowerSync Cloud (replication role with column-limited grants, sslmode verify-full, how it reaches the JWKS), rate-limit storage, env and secrets, a real staging environment, and confirming the first Vercel deploy runs pnpm 12. Invites (B-30) and marketing (B-32) need it to go live.
- 2026-11-18 (prd/invites orchestrator): Email sending setup for launch (tracking off, SPF/DKIM/DMARC, bounce webhooks, the outbox cron, rate-limit storage) is filed as B-68.

### B-34 · change · Date picker for the When field: a calendar to pick the date, not only typed segments

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 483f768

- 2026-11-18 (Robert Bo Davis): Requested 2026-11-18. Quick-fixes slice 6. DateTimeField (the timeline sheet's When, and the entry page's time chip) gets a calendar button and popover through React Aria's DatePicker and Calendar (already a dependency); typed segments stay.
- 2026-11-18 (slice/quick-fixes/6): slice/quick-fixes/6: DatePicker with calendar in DateTimeField; roundtrip 29/29, live-notes 93/93, phase2 107/107 (rerun after a known PowerSync 'Sync aborted' warning)

### B-35 · bug · A practice's type can change to clinician or other while clinicians still point at it

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: e6fc148

- 2026-11-18 (Robert Bo Davis): From the providers plan's open issues. Quick-fixes slice 8: providerService refuses the change while live providers name it as their practice, and the device's local write refuses it too.
- 2026-11-18 (slice/quick-fixes/8): slice/quick-fixes/8 7c0725f: server + device refuse practice->clinician/other while live providers name it (providerService:practiceInUse, issue on type). Browser step not run (excluded this wave). Deleting a practice still leaves clinicians pointing at a deleted practice; the sheet shows '(removed practice)'.

### B-36 · chore · Independent integration tests: no shared group across describe blocks

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: e6fc148

- 2026-11-18 (Robert Bo Davis): AGENTS.md Next steps item 3. Quick-fixes slice 9: careGroup.int.test.ts (and any other file sharing fixtures across blocks) builds its own fixtures per test or block, like provider.int.test.ts's setup().
- 2026-11-18 (slice/quick-fixes/9): slice 9: careGroup.int.test.ts now uses setup() per test; the other six int files already did. 169 integration tests before and after; no real bug found.

### B-37 · bug · Deleting a practice leaves its clinicians linked to it

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 9c08e01

- 2026-11-18 (prd/quick-fixes): Found in B-35 (quick-fixes slice 8). A soft-deleted practice stays as its clinicians' practice_id; their edit sheet shows '(removed practice)' and saving keeps it (the practice check runs only when practiceId changes). Decide: refuse the delete while clinicians name it, or clear their links.
- 2026-11-18 (prd/quick-fixes): Decided with the user: refuse the soft delete while live providers name the practice (409 providerService:practiceHasProviders, server and device), mirroring B-35; never clear the clinicians' links. Spec is quick-fixes slice 14 in plans/quick-fixes-plan.md (on prd/quick-fixes).
- 2026-11-18 (slice/quick-fixes/14): slice 14 (cf1f804): delete refused with 409 providerService:practiceHasProviders while live providers name it; device refuses too; edit sheet confirm shows the count with Delete disabled

### B-38 · bug · Production build differs from dev: a deleted provider's 404 renders blank, a viewer's providers/new doesn't redirect

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 94ce803

- 2026-11-18 (Robert Bo Davis): Found 2026-11-18 running checks against pnpm prd serve --built (a check build, VITE_CHECK_BUILD=1) in a throwaway worktree: providers.mjs failed 'a deleted provider's URL is the 404, with no names' (main empty, body '') and on the retry 'a viewer gets no Add; …/providers/new and …/:id/edit show the list with no form' (path stayed …/providers/new); phase2.mjs failed on '[viewer console.warning] [PowerSync]: Sync aborted'. Both passed against the dev server right after. Could be real production bugs (the 404 and redirect paths) or check timing under a faster server. Fix, then make --built the default for checks (AGENTS.md, Browser check budget).
- 2026-11-18 (Robert Bo Davis): Planned as quick-fixes slice 11 (find the cause of each failure, then make the check build the default).
- 2026-11-18 (slice/quick-fixes/11): Root cause (slice 11): the back/forward cache. On a full load the old /app page is frozen in Chrome's bfcache instead of unloaded; PowerSync's shared workers only drop a page when its tab-close-signal Web Locks are released, so they keep waiting on the frozen page's database connection (often mid-transaction) and the next page's openSync never resolves: blank page, router not initialized, no errors. Evidence: hangs happened exactly when the previous page was bfcached (marker survives Back), 0 hangs with --disable-features=BackForwardCache; a probe that holds a write transaction then full-loads hung 1/5, 2/8, 1/8 before and 0/12, 0/20 after the fix. The dev server never shows it: Vite's HMR websocket keeps pages out of bfcache (0/6 cached on dev, about 1/3 on the build). Fix: lib/sync/pageCache.ts releases PowerSync's page-lifetime locks on pagehide(persisted) and reloads on pageshow(persisted). 'Sync aborted' is the shared sync worker's teardown log for a page that closed, broadcast to the next page: expected, now ignored by the checks.
- 2026-11-18 (slice/quick-fixes/11): slice 11 done on slice/quick-fixes/11 (tip 7da2c38): lib/sync/pageCache.ts fix; checks fixed for the build (per-page x-forwarded-for for Better Auth's production rate limits, tap waits for its target to stop moving, Escape waits for menu focus, picker focus return, 'Sync aborted' ignored); pnpm prd browser now defaults to a check build (--dev opts out). Full suite and dev/build timing deferred to the orchestrator's landing run.

### B-39 · chore · Lean browser checks: move pure-logic steps to unit tests, add a fast smoke mode

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 9c08e01

- 2026-11-18 (Robert Bo Davis): Item 5 of the 2026-11-18 testing-churn plan (5804ae4 did items 1-4). phase2.mjs (107 steps) and app-shell.mjs (98) assert pure logic that now has unit tests. Keep checks to user flows, and give each a SMOKE=1 mode (~20 s) for after-merge runs. Run after components wave 2 lands: it reworks the same checks.
- 2026-11-18 (prd/quick-fixes): components slice 5 (the entry form, split) is still pending, so slice 10 leaves roundtrip.mjs's sheet steps as they are apart from the smoke markers; revisit them after components 5 lands.
- 2026-11-18 (slice/quick-fixes/10): Slice 10 committed on slice/quick-fixes/10 (1870973, 9e7d83b): --smoke mode, five checks leaner (full 311 s -> 219 s quiet, smoke 4-7 s each). One full + one smoke run each, per the user's instruction.

### B-40 · chore · Real app screenshots for the marketing site before launch

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-18 (prd/marketing): The marketing site shows SVG placeholders (apps/web/public/screenshots/<name>.svg) to keep the repo small while the app's screens change. Before launch: run scripts/browser-checks/marketing-screenshots.mjs on a freshly reset stack (CARETOOK_BROWSER_SLOTS=4 pnpm prd browser marketing-screenshots --timeout 300), commit the WebP images, and point site/screenshots.ts and the Screenshot component back at them (light and dark sources, srcset).
- 2026-11-18 (Robert Bo Davis): Timing (the user, 2026-11-18): one of the last tasks before launch. Do it after the launch-ready product map and once the screens it shows have stopped changing, alongside the launch work in B-33, so the images match what ships. Not part of any current marketing wave.

### B-41 · bug · /app stays blank after a full reload (app-shell.mjs last-group steps)

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 94ce803

- 2026-11-18 (prd/quick-fixes): Seen in quick-fixes waves 3 and 4: after A.goto('/app') reloads, the page has no main and an empty body for 20 s, with no uncaught errors (page.diagnose()). It failed 4 of the last 5 app-shell.mjs runs at load 6–30, at either the 'goes to the last group after a reload' or the 'stale remembered group' step. It isn't a check race: waiting for GroupMenu's rememberGroup write before overwriting caretook:lastGroup didn't help. Probably session or sync startup on reload (requireSession/openSync, the DB lock from the previous page?). Triaged to quick-fixes as a candidate slice 12.
- 2026-11-18 (slice/quick-fixes/11): slice 11 (B-38): providers.mjs's two build failures are this same hang, on the built server: after a full load (C.goto) of …/providers/<deleted id> or …/providers/new, body '' and no main, router state.initialized false, window.caretookSync unset (openSync never resolved), no Web Locks held or pending, no errors, for 20+ s. Reproduced 1 in 8 full loads in a throwaway loop (viewer: provider page, then full load of a deleted provider). So B-38's blank 404 and missing redirect are B-41's startup hang, not the 404 or guard code; slice 11 leaves the fix to slice 12.
- 2026-11-18 (slice/quick-fixes/11): slice 11 found B-38's blank pages are the back/forward cache freezing the previous page with PowerSync's locks held (see B-38's note); fixed in lib/sync/pageCache.ts on slice/quick-fixes/11. On the dev server pages didn't enter bfcache in my tests (Vite's websocket), so B-41 on dev may be a different cause, but worth retesting app-shell.mjs with slice 11 merged.
- 2026-11-18 (slice/quick-fixes/12): Root cause: every full load put the old page in Chrome's back/forward cache (pagehide persisted, then freeze) with its PowerSync connection open. Frozen mid-query, its DB lease was never returned (worker log: 'Closing connection lease that hasn't been returned' 7-13 s later, on eviction), so the next page's powersync.init() waited and /app stayed blank. Fix in lib/sync/client.ts (startup, not sign-out teardown): close the DB on a persisted pagehide, reload on a persisted pageshow. Also fixed app-shell.mjs's stale-group step racing GroupMenu's remember effect. Slice 11: the frozen page's close can log PowerSync's 'error closing database connection' in the shared worker. 41b5bcb, d75e3ba.

### B-42 · change · App header uses the brand: the logo mark and wordmark, and the marketing header's look

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 94ce803

- 2026-11-18 (Robert Bo Davis): Requested 2026-11-18. Quick-fixes slice 12. The app header's plain 'Caretook' text link becomes the marketing LogoMark + wordmark (mark only on phones in a group, to keep one row at 420), with the marketing header's border, translucent background and height. LogoMark/Wordmark move to components/brand/ so both use one copy. Not the marketing nav, waitlist button or disclosure menu; not sticky.
- 2026-11-18 (Robert Bo Davis): Quick-fixes slice 13 (slice 12 is B-41 on prd/quick-fixes).

### B-43 · change · Reorder/group "new" buttons in timeline to "note", "event", "dose", "symptom", "vital"

- status: ready
- prd: medications
- owner: prd/medications
- commit: 46c675b

- 2026-11-18 (Robert Bo Davis): Proposed for medications: Dose joins quick add in slice 4, so that slice can set the order Note, Event, Dose, Symptom, Vital (grouping free text, then dose, then measures). The plan's slice 4 is not running yet, so it can take this in scope.
- 2026-11-18 (prd/medications): medications orchestrator: fits slice 4, which adds Dose to the quick-add bar; reorder the bar to Note, Event, Dose, Symptom, Vital there rather than in a separate slice.
- 2026-11-18 (prd/medications): medications orchestrator: claimed for slice 4 (started 2026-11-18): the quick-add bar becomes Note, Event, Dose, Symptom, Vital.
- 2026-11-18 (slice/medications/4): Built in slice/medications/4 (63d73d2): quick add is Note, Event, Dose, Symptom, Vitals; Dose for writers only.

### B-44 · change · Display phone number, address, email, etc. in provider directory without a click. Use that as link…

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 2cd7789

- 2026-11-18 (prd/marketing): From the inbox: Display phone number, address, email, etc. in provider directory without a click. Use that as link to call/email/map/etc.
- 2026-11-18 (Robert Bo Davis): Proposed for quick-fixes: the directory rows (ProviderListItem) show the primary phone, email and address as text that is itself the call/email/map link (lib/contactActions), instead of behind a tap. One slice; providers.mjs covers it.
- 2026-11-19 (slice/quick-fixes/17): slice/quick-fixes/17: rows show phones, address, email as links (ContactDetails); check + providers.mjs pass

### B-45 · change · birthdate, contact information, address, and insurance information should optionally be added to…

- status: triaged
- prd: profiles
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: birthdate, contact information, address, and insurance information should optionally be added to the patient profile.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'profiles' (to write): the care recipient's optional contact, address and insurance details. Date of birth already exists (careGroup.recipient, not synced; medications slice 1 makes it synced). Insurance-card photos are B-56 (documents). Decide in the PRD which fields sync and who can read them (viewers?).

### B-46 · change · optional phone number, address, etc on group members that can be published to the group for…

- status: triaged
- prd: profiles
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: optional phone number, address, etc on group members that can be published to the group for contact. Flags for "emergency contacts" and "primary contact" for display later.
- 2026-11-18 (Robert Bo Davis): Proposed for 'profiles' with B-45: members' optional phone and address, shared with the group by choice, plus emergency-contact and primary-contact flags. Today co-members sync only id, name and image; published fields need their own stream columns and an opt-in.

### B-47 · feature · Deal with future event display (appointments) notes can be set to the future date as well. Symptoms…

- status: in-progress
- prd: appointments
- owner: prd/appointments
- commit:

- 2026-11-18 (prd/marketing): From the inbox: Deal with future event display (appointments) notes can be set to the future date as well. Symptoms and vitals cannot. Medication reminders may be a specialized type of future item on the timeline. Display of future events on timeline should be toggled somehow.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'appointments' (to write): future-dated notes and events (appointments, with place and provider, which AGENTS.md defers), never symptoms or vitals; a toggle or section for upcoming items on the timeline. Medication reminders as future items depend on medications slice 5 (Today/due doses).
- 2026-11-18 (plan/appointments): PRD written on plan/appointments: plans/appointments-prd.md (interview 2026-11-18). Follow-ups B-60–B-63.
- 2026-11-19 (slice/appointments/1): slice 1 (data layer and time rules) ready on slice/appointments/1 at e7bafce: migration 0014_appointments, future-date rule (dose not a future kind), lib/upcoming + windows, seeds
- 2026-11-19 (slice/appointments/3): slice 3 (Upcoming section + Past tab) committed on slice/appointments/3 (3f6c48c, 6bbf62c); upcoming.mjs 23/23
- 2026-11-19 (slice/appointments/2): slice 2 (entry page: end time, all day, place, ?when=pick) ready on slice/appointments/2 at d14c8ca
- 2026-11-19 (slice/appointments/4): slice 4 (cancel and undo cancel) ready on slice/appointments/4: 1395252, a00c38b
- 2026-11-19 (slice/appointments/6): slice 6 (timeline: history ends at now, Next strip, Upcoming block) ready on slice/appointments/6 (11b210c, 15f4ec3)

### B-48 · feature · Allow import of providers from other care groups that you have access to.

- status: triaged
- prd: providers
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed as a providers follow-up (the PRD is done, like B-25): copy a provider from another group you belong to into this one (a copy, not a shared row, since providers are per group and synced per group). Needs a small PRD addendum or a quick-fixes slice once scoped.

### B-49 · feature · Once we have agentic integration, Add ai generated summary to each day on the timeline and the…

- status: triaged
- prd: assistant
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: Once we have agentic integration, Add ai generated summary to each day on the timeline and the option to view a condensed summary of days for quick scanning.
- 2026-11-18 (Robert Bo Davis): Proposed for assistant: per-day AI summaries on the timeline and a condensed days view. Needs the assistant's server side first; pairs with care-periods (B-50).

### B-50 · feature · Add ability to add timeline groupings, like "at home - start date-end date", "in hospital - start…

- status: triaged
- prd: care-periods
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: Add ability to add timeline groupings, like "at home - start date-end date", "in hospital - start date-end date", "at home on hospice - start date-end date", etc. These will be useful in the summary and for filtering.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'care-periods' (to write): named date ranges (at home, in hospital, at home on hospice) shown as bands or headers on the timeline and usable as a filter (lib/timelineFilters) and by the assistant's summaries (B-49). After timeline-polish.

### B-51 · feature · printable medication schedule sheet that can be printed to be checked off with a pen at patient's…

- status: triaged
- prd: medications
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: printable medication schedule sheet that can be printed to be checked off with a pen at patient's bedside. (once we have ai, we can allow photo of the sheet to be used to update timeline)
- 2026-11-18 (Robert Bo Davis): Proposed for medications, as a later slice after slice 6 (the printable list): a printable day/week schedule grid with check boxes for pen sign-off at the bedside. The photo-of-the-sheet-to-timeline part belongs to assistant later. B-15 is in progress, so this becomes a new slice, not a change to a running one.
- 2026-11-18 (prd/medications): medications orchestrator: a new slice after 6 (it reuses slice 6's print route, print CSS and the schedule from slice 1; a grid of today's or this week's scheduled slots with check boxes). Proposed as slice 7 in a later wave.

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

### B-54 · feature · privacy policy and terms of service.

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-18 (prd/marketing): Proposed for marketing (orchestrator): draft /privacy, /terms and /health-data-privacy landed with marketing slice 3 (DRAFT banners, [Review: …] notes). What's left is the user's legal review and removing the banners; no slice planned until the user reviews the text.

### B-55 · feature · Todos list with assignment to group members, due dates, and completion status.

- status: triaged
- prd: tasks
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'tasks' (to write): a todo list per group with assignees, due dates and done state, as a group section. Due dates could show with appointments (B-47); reminders would go through notifications.

### B-56 · feature · ability to upload photos of patient drivers license, insurance card, DNR, etc.

- status: triaged
- prd: documents
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'documents' (to write): photos and files (ID, insurance card, DNR) per recipient. Needs file storage, which waits on hosting (B-33), plus encryption and sync decisions (files likely online-first, not in PowerSync). Pairs with profiles (B-45).

### B-57 · plan · Discuss options for end to end encryption of data in transit and at rest where owner of the data is…

- status: triaged
- prd: encryption
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: Discuss options for end to end encryption of data in transit and at rest where owner of the data is the only one who can decrypt it and share decryption keys with others.
- 2026-11-18 (Robert Bo Davis): Proposed as a design discussion 'encryption' (to write, plan only). E2E encryption conflicts with what's built: the server validates and permission-checks every upload (sync.upload through services), compacts Yjs documents, and AI features (assistant) read text server side. The PRD should weigh at-rest encryption, per-field E2E for documents (B-56) and the loss of server features.

### B-58 · plan · Add ability to use AI to review timeline, explain concerns, and generate a cheat sheet of questions…

- status: triaged
- prd: assistant
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: Add ability to use AI to review timeline, explain concerns, and generate a cheat sheet of questions for provider appointments.
- 2026-11-18 (Robert Bo Davis): Proposed for assistant: review the timeline, explain concerns, and a printable cheat sheet of questions for a provider visit (the Product section's 'questions for visits'). Pairs with appointments (B-47) for the visit context.

### B-59 · chore · Clean up/truncate this file and the backlog periodically.

- status: triaged
- prd: orchestration
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for orchestration: a 'pnpm backlog archive' that moves live (or landed) items out of backlog.md into an archive file and prunes their inbox bullets, run by hand or at landing.

### B-60 · feature · Recurring appointments (weekly PT, dialysis three times a week)

- status: triaged
- prd: appointments
- owner:
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.

### B-61 · feature · Appointment reminders by email and push before the appointment

- status: triaged
- prd: appointments
- owner:
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.

### B-62 · feature · iCal feed of a care group's upcoming appointments

- status: triaged
- prd: appointments
- owner:
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.

### B-63 · feature · Google Calendar sync of a care group's appointments

- status: triaged
- prd: appointments
- owner:
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.

### B-64 · feature · Withdraw a pending join request from the requester's home

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): From invites slice 4: joinRequest.withdraw exists in the API and service, but home/PendingRequests.tsx has no Withdraw button. A standalone UI change, so quick-fixes.

### B-65 · change · New care groups get the recipient's time zone

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): From invites slice 5: careGroup.create sets no time zone because care_recipient has no time_zone column yet. Adds a migration (the column, then fill it from the creating device's IANA zone); small and standalone, so quick-fixes.

### B-66 · question · Access codes are stored as plain text: keep that, or hash them?

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): From invites slice 5: access_code.code is stored plain so staff can reprint a code from /admin (print page with QR). Only global admins and system can read it; a code is a sign-up ticket, not health data. Hashing would mean codes can only be printed once, at creation.

### B-67 · question · Access-code sign-up says when an address already has an account

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): From invites slice 5: /join/:code answers ticket:accountExists ('An account with this email already exists. Sign in instead.'), so anyone holding a code can check whether an address is registered. Link-invite sign-up (slice 4) gives the same answer either way; email invites lock the address. Option: answer the same as link sign-up and send the existing user a sign-in email instead.

### B-68 · chore · Email sending setup before launch: domain tracking off, SPF/DKIM/DMARC, bounce webhooks, cron schedule, rate-limit storage

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): From the invites PRD (AGENTS.md, Notifications → Before launch): turn off Resend's open and click tracking on the sending domain (not per message); SPF, DKIM and DMARC on the sending subdomain; verified bounce webhooks (Svix); a host cron for /api/cron/outbox with CRON_SECRET; and Better Auth's rate-limit storage (in-memory per serverless instance today). Part of launch work, related to B-33.

### B-69 · chore · Move the New care group link state into components/groups

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): From invites slice 6: NEW_GROUP_LINK_STATE and openedFromApp stay in routes/app/groups/new/newGroupLink.ts, but three other route folders import them (home/NewGroupLink, account/join, layout/GroupMenu), against the folder-per-route rule. Also drop the unused error code careGroupInviteService:notAllowed. A small refactor, so quick-fixes.

### B-70 · bug · ui.mjs flake: the provider add sheet at 1280 dark, Escape then focus check

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): Flaked in the invites wave 3 suite (2026-11-18 19:46, load 18→27, not auto-retried): '1280 dark provider add sheet: Escape closes only it, and focus returns to the opener (tap)'. The failure detail showed focus on the opener, so likely the sheet's close wasn't finished when the step checked. Passed 625/625 on a rerun; ui.mjs also flaked earlier in providers-5 (timeout). In .loops/.browser-flakes.log. A browser-check fix, so quick-fixes.

### B-71 · bug · date picker entry box mobile-friendly. it expands outside of elements on small screens.

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 2cd7789

- 2026-11-19 (Robert Bo Davis): Triaged to quick-fixes: a layout fix in ui/date's DateTimeField on narrow screens; one slice.
- 2026-11-19 (slice/quick-fixes/15): slice/quick-fixes/15: date field fits at 360–420 (min-w-0 group, wrapping segments, 44 px Pick a date); ui.mjs date-fit steps; ready for review

### B-72 · bug · suggested provider list is too long on mobile.

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 2cd7789

- 2026-11-19 (Robert Bo Davis): Triaged to quick-fixes: cap the suggested-provider chips on phones (entry With row, providerSuggestions); one slice.
- 2026-11-19 (slice/quick-fixes/16): slice/quick-fixes/16 (8316e2c): below sm the suggestions are one sideways-scrolling row (end faded); from sm they wrap, all 5 shown. Ranking unchanged.

### B-73 · bug · timeline entry add modal should take up the full screen on mobile, don't leave room for header.

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-19 (Robert Bo Davis): Triaged to quick-fixes: the shared ui/Sheet goes full screen below sm. Merge after medications slice 3 (its new sheets use Sheet).
