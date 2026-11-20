# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

Which PRDs exist, what each depends on, and the shared files it touches: orchestrators read this to choose what can run at the same time. At most three PRD orchestrators run at once.

| PRD               | Doc                                                          | Depends on                                           | Hot files                                                                   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `orchestration`   | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): 9 slices, waves (1, 2, 3) → (4, 5, 6) → (7, 8) → 9, run-through landing: AGENTS.md split, check watchdog and caps, backlog safety and archive, leases, stackless slices with a shared test Postgres, component tests on a local test device, the lean end-to-end set (B-59, B-89, B-107–B-111) | (none); can run beside any PRD | `AGENTS.md` and `docs/` (slice 1: land between other PRDs' landings), `scripts/loops/`, `scripts/backlog/`, `scripts/browser-checks/` (slices 7–9), `vitest.config.ts`, root and apps/web `package.json` (new dev deps), `lib/sync/index.ts` (a test seam), `packages/data/test/` globalSetup |
| `live-notes-ux`   | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done**, all 10 slices in `dev` | (none) | none now |
| `quick-fixes`     | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–14 in `dev`; new fixes append as slice 15 on. Triaged and waiting: B-64, B-69, B-70, B-78, and from the security review B-79 to B-83 |  (none) | varies by slice; B-44 the providers route folder (`ProviderListItem`); B-73 `components/ui/Sheet` (after `medications` slice 3); B-71 `components/ui/date/` |
| `app-shell`       | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done**, all 7 slices in `dev` | (none) | none now |
| `timeline-polish` | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done**, all 7 slices in `dev` | `live-notes-ux`, `app-shell`, `routing`, `components` (all done) | none now |
| `search`          | [PRD](search-prd.md), [plan](search-plan.md): 6 slices, in `dev` (`56e6cd6`). Waves 1 → (2, 3, 6) → (4, 5); slice 1 can start when a PRD slot frees | `timeline-polish` (done); slice 2 waits for `appointments` to land | `lib/sync/timeline.ts` (the timeline windows), `lib/timelineFilters.ts`, the timeline route folder (slices 2, 4), the `/app` header and `routes.ts` (slice 3), one migration (slice 6) |
| `providers`       | [PRD](providers-prd.md), [plan](providers-plan.md): **done**, all slices in `dev` (`7c075d1`); follow-ups B-25, B-48 | (none) | none now |
| `medications`     | [PRD](medications-prd.md), [plan](medications-plan.md): **done**, all six slices in `dev` (`8ff8354`; Today and Due now are in, so `appointments` slice 7 is unblocked). Follow-ups B-26, B-51 | `providers`, `routing`, `components` (all done) | `TIMELINE_ENTRY_KINDS`, `KIND_META`, timeline strips and quick add, `care_recipient`, `note_document`, sync and upload registries, `GROUP_SECTIONS`, `routes.ts`, the Dose sheet |
| `medications-2`   | [PRD](medications-2-prd.md), [plan](medications-2-plan.md): 7 slices, in `dev` (`0de6699`). Waves 1 → (2, 3) → (4, 7) → (5, 6); slice 1 can start when a PRD slot frees: passes (named medication rounds), Given all with Undo, the always-on medication strip, pass rows on the timeline, a weekly bedside sheet, allergies (B-76, B-86, B-51, B-26) | `medications`, `appointments` (done); start after B-78 (quick-fixes) lands | two new synced tables and one `care_recipient` column (one migration), `lib/dueDoses.ts` and its callers (Today, Due now, the Dose sheet, Upcoming), the timeline header strip and `TimelineEntryList` grouping (also `care-periods`), `ScheduleFields`, sync and upload registries, `routes.ts`, `appUrls` |
| `assistant`       | [PRD](assistant-prd.md), [plan](assistant-plan.md): 7 slices, in `dev` (`613a15c`). Waves (1, 3, 4) → (2, 5) → 6 → 7; land per wave (migration timing doesn't matter, the user said): quick entry, suggestions, day summaries, visit prep and Print, simple mode (basics, complete), passes everywhere (B-12, B-49, B-58, B-87). No remote AI | `medications-2` (slice 7 waits for it in `dev`); B-98/B-99 sync first if landed | the timeline route folder (box above entries; day sections), `routes/app/layout/route.tsx` (reduced header), entry page and `entryActionItems` (Print), provider page, Upcoming rows, group settings Details and Members, one migration (`care_group_member`, `care_group`), `PERMISSIONS`, stream and device schema, `userPreferences`, `routes.ts`, `appUrls` |
| `connectors`      | to write (B-104): an MCP server so a user's own Claude or ChatGPT reads and writes their group (writes confirmed in chat, labelled), OAuth with group-limited tokens, consent and an owners' switch | `assistant` (its actions layer); B-80 (Devices page, token revocation) | `packages/auth` (OAuth provider), `packages/api` (a new MCP mount), group settings, the privacy pages, `PERMISSIONS` |
| `routing`         | [PRD](routing-prd.md), [plan](routing-plan.md): **done**, all 5 slices in `dev` (`ff25ef2`) | (none) | none now; new routes go through `routes.ts` and `appUrls` |
| `components`      | [PRD](components-prd.md), [plan](components-plan.md): **done**, all 6 slices in `dev` (landed 2026-11-18, `ca39416`) | `routing` (done) | none now; new UI uses `components/ui/` and the feature folders (AGENTS.md, _Components_) |
| `invites`         | [PRD](invites-prd.md), [plan](invites-plan.md): **done**, all 6 slices in `dev` (landed 2026-11-18, `e6286f4`) | (none) | none now; follow-ups (Withdraw for a join request, the recipient's time zone) and launch work are in AGENTS.md |
| `marketing`       | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**, all 5 slices in `dev`. B-40 and B-54 wait on the user | `invites` (done) | none now |
| `profiles`        | [PRD](profiles-prd.md), [plan](profiles-plan.md): **done**, all 6 slices in `dev` (`88890df`) | `invites`, `medications` slice 1 (both done); the sheet reads medications and providers | none now |
| `appointments`    | [PRD](appointments-prd.md), [plan](appointments-plan.md): slices 1–6 in `dev` (slice 5 `9cafb09`); **slice 7 blocked by `medications` slice 5** (B-47 claimed; follow-ups B-60–B-63) | `providers` (done); `medications` slice 5 (reminders) | the timeline route folder, `entryWindow` in `lib/sync/timeline.ts`, `KIND_META`, `EntryTimeChip` |
| `care-periods`    | [PRD](care-periods-prd.md), [plan](care-periods-plan.md): 6 slices, in `dev` (`cb652c8`); 1 → (2, 3, 4, 5) → 6: one track of contiguous periods, markers, current-period line, period pages with notes, event suggestions, a search filter | `timeline-polish`, `providers`, `appointments` (done); its search slice waits for `search` slices 2 and 3; B-78 before or with its timeline slice | a new table, `note_document` subject, sync and upload registries, one migration, the timeline header area and `TimelineEntryList`, `GroupMenu`, the entry page header, `routes.ts`, `appUrls`, `timelineFilters` (search slice) |
| `data-rights`     | to write (B-52, B-53)                                        | (none)                                               | `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `tasks`           | to write (B-55)                                              | (none); `notifications` for reminders (soft)          | a new table, sync and upload registries, `GROUP_SECTIONS`, `routes.ts`     |
| `documents`       | to write (B-56)                                              | hosting (B-33, file storage); `profiles` (soft); `encryption` decision | file storage, `routes.ts`, `GROUP_SECTIONS`, `PERMISSIONS`              |
| `encryption`      | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 | (none); affects `assistant` and `documents` | none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `onboarding`      | to write (B-31)                                              | `invites` (done)                                     | seeds, `careGroupService`, `/app` home                                     |
| `account-security` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) | `invites` (done); B-80 (the Devices page) first (soft) | `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `admin`           | [PRD](admin-prd.md), [plan](admin-plan.md): 6 slices, waves 1 → (2, 4, 5) → (3, 6): staff roles (admin, support), audit log, users, disable, care groups, settings, announcement banner (B-91) | `invites`, `marketing` (done); start after `profiles` lands; `account-security` (staff 2FA) comes after | one migration (`user` role and disable columns, `admin_audit_log`, `app_setting`), `USER_ROLE_NAMES`, `PERMISSIONS`, `db/schema/index.ts`, `packages/auth` config, the API router (`adminProcedure` → `staffProcedure`), `routes.ts`, the account menu, one region in the `/app` layout (slice 6), the invite and access-code services (settings switches) |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-12 | plan | triaged | assistant |  | Assistant: lightweight chat, with voice, for quick actions and questions about the timeline |
| B-25 | feature | triaged | providers |  | @-mentions of providers inside live notes and events |
| B-31 | feature | triaged | onboarding |  | Demo group for every new user: a seeded, fictional care group to explore the app |
| B-33 | plan | inbox |  |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-48 | feature | triaged | providers |  | Allow import of providers from other care groups that you have access to. |
| B-49 | feature | triaged | assistant |  | Once we have agentic integration, Add ai generated summary to each day on the timeline and the… |
| B-52 | feature | triaged | data-rights |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-55 | feature | triaged | tasks |  | Todos list with assignment to group members, due dates, and completion status. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-58 | plan | triaged | assistant |  | Add ability to use AI to review timeline, explain concerns, and generate a cheat sheet of questions… |
| B-60 | feature | triaged | appointments |  | Recurring appointments (weekly PT, dialysis three times a week) |
| B-61 | feature | triaged | appointments |  | Appointment reminders by email and push before the appointment |
| B-62 | feature | triaged | appointments |  | iCal feed of a care group's upcoming appointments |
| B-63 | feature | triaged | appointments |  | Google Calendar sync of a care group's appointments |
| B-68 | chore | inbox |  |  | Email sending setup before launch: domain tracking off, SPF/DKIM/DMARC, bounce webhooks, cron schedule, rate-limit storage |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-87 | plan | triaged | assistant |  | "simple mode" for the timeline page. We need a way for less tech savvy users to easily add items to… |
| B-89 | feature | landed | orchestration | prd/orchestration | PRD tooling streamlining. We are using way too many resources for full docker stacks and browser… |
| B-91 | feature | landed | admin | prd/admin | Need an Admin panel for caretook global administrators to manage users, care groups, and settings. |
| B-98 | change | triaged | quick-fixes |  | Hide add to timeline buttons behind a + icon in the timeline header. |
| B-99 | change | triaged | quick-fixes |  | Don't display recent vitals in the timeline header in mobile, |
| B-100 | change | triaged | quick-fixes |  | Add "recent vita averages" to the profile page. |
| B-104 | plan | triaged | connectors |  | Connectors: let a user's own Claude or ChatGPT read and write their care group through an MCP server |
| B-105 | change | triaged | quick-fixes |  | Care period display on timeline should be a part of the sticky header that includes date instead of… |
| B-106 | bug | triaged | quick-fixes |  | Turning email invites off also blocks staff owner invites from /admin |
| B-107 | feature | in-progress | orchestration | prd/orchestration | Is there an alternative to the hard coded browser tests? Or a way to add prioritized browser tests… |
| B-110 | bug | in-progress | orchestration | prd/orchestration | Fix the flakiest browser-check steps from .browser-flakes.log (app-shell, phase2, ui, live-notes) |
| B-112 | change | triaged | quick-fixes |  | Show the recipient's allergies on the profile's printable emergency sheet |
| B-113 | chore | triaged | admin |  | Recheck admin.mjs, app-shell.mjs and providers.mjs on the new check suite after the orchestration PRD lands |
| B-114 | chore | triaged | check-migration |  | Move routing.mjs to component tests |
| B-115 | chore | triaged | check-migration |  | Move settings-layout.mjs to component tests |
| B-116 | chore | triaged | check-migration |  | Move providers.mjs to component tests |
| B-117 | chore | triaged | check-migration |  | Move groups.mjs to component tests |
| B-118 | chore | triaged | check-migration |  | Move medications.mjs to component tests |
| B-119 | chore | triaged | check-migration |  | Move upcoming.mjs to component tests |
| B-120 | chore | triaged | check-migration |  | Move search.mjs to component tests |
| B-121 | chore | triaged | check-migration |  | Move profiles.mjs to component tests |
| B-122 | chore | triaged | check-migration |  | Move profiles-contacts.mjs to component tests |
| B-123 | chore | inbox |  |  | Move care-periods.mjs to component tests |
| B-124 | chore | inbox |  |  | Move devices.mjs to component tests |
| B-125 | chore | inbox |  |  | Move admin.mjs to component tests |
| B-126 | chore | inbox |  |  | Move roundtrip.mjs's sheet steps to component tests |
| B-127 | chore | inbox |  |  | Move invites.mjs's screen steps to component tests |
| B-128 | chore | inbox |  |  | Add a lean end-to-end step for an upload refused by permissions |
| B-129 | chore | inbox |  |  | Port the lean end-to-end set to Playwright Test |

## Items

### B-12 · plan · Assistant: lightweight chat, with voice, for quick actions and questions about the timeline

- status: triaged
- prd: assistant
- owner:
- commit:

- 2026-11-17 (dev keeper): Quick actions go through the same local write paths as the forms (offline, synced), as a draft the user confirms. Questions need server-side retrieval and an AI vendor that doesn't retain or train on our data.
- 2026-11-18 (plan/assistant): Draft PRD written on plan/assistant: plans/assistant-prd.md. Interview 2026-11-18: actions first then questions; floating button + sheet; server transcription (vendor open); conversations not saved; drafts confirmed; offline queue (text + audio, drafts wait); opt-in per group (owner consents, members acknowledge); read tools over services; Anthropic TS SDK; model chosen by an eval; create + edit recent; Save as note; 'via assistant' marker; daily caps per user. Questions wait on search's server side.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-12: the assistant PRD must set AI vendor rules: zero retention in writing, least data per request, no health data in logs, per-group owner opt-in, on-device where possible.
- 2026-11-19 (Robert Bo Davis): User 2026-11-19: the first assistant PRD uses no remote AI: an actions layer (log vital, symptom, dose or pass, note, appointment; what's due; summarize since a date), a quick-entry grammar parsed on the device with a preview, one-tap predictions, simple mode (B-87), templated daily summaries (B-49) and a 'since the last visit' sheet (B-58). Voice is keyboard dictation. On-device models and remote AI calls come later; outside AI goes through the connectors PRD.
- 2026-11-19 (Robert Bo Davis): Quick entry, user 2026-11-19: a pure device parser (lib/quickEntry.ts) → ranked readings; always one best-guess preview with alternatives as chips, nothing saved until Save, Edit opens the full sheet. One line may make several entries (split on commas and 'and'), one preview card each, Save saves all. Order: vitals (keyword + number, bare 120/80; all readings in one entry; user's units, explicit unit wins) → doses (gave/skipped/refused + medication or pass; 'gave all') → symptom with 0-10 → appointment (future time or appt) → note. Time words on any line; past-only kinds refuse future times. Shortcuts: kind prefixes (n: e: s: v: d:), name autocomplete (medications, passes, providers), recent lines as one-tap repeats, a tips line. Placement: simple mode's main input, and always visible on the timeline above the entries (B-98's + menu keeps the per-kind buttons).

### B-25 · feature · @-mentions of providers inside live notes and events

- status: triaged
- prd: providers
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Later, after providers' linking lands. Typing @ in a note's or event's text suggests providers; a mention links the provider like the With row. Needs @tiptap/extension-mention and @tiptap/suggestion (new dependencies: the user's approval). Out of scope for the providers PRD.
- 2026-11-18 (prd/providers): Triaged to providers by its orchestrator: @-mentions need the provider table and links (slices 1 and 5). A follow-up after slice 5, not in the current plan.

### B-31 · feature · Demo group for every new user: a seeded, fictional care group to explore the app

- status: triaged
- prd: onboarding
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): From the invites interview (2026-11-18): out of scope there, noted for later. Each new account gets a private demo group with fictional seed data (timeline, notes, vitals; later meds and providers) it can explore and delete.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'onboarding' (to write): a private fictional demo group for each new account, made from the seeds' data on sign-up (or on demand from /app home), deletable. Builds on invites (done).

### B-33 · plan · Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Not planned yet; the user will say when. Covers the open questions in AGENTS.md: hosted database (same region as Vercel functions, pooling), how production migrations run, PowerSync Cloud (replication role with column-limited grants, sslmode verify-full, how it reaches the JWKS), rate-limit storage, env and secrets, a real staging environment, and confirming the first Vercel deploy runs pnpm 12. Invites (B-30) and marketing (B-32) need it to go live.
- 2026-11-18 (prd/invites orchestrator): Email sending setup for launch (tracking off, SPF/DKIM/DMARC, bounce webhooks, the outbox cron, rate-limit storage) is filed as B-68.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-4 and S-6 (launch): separate database roles (app, migrations, column-limited replication), named and audited human access, a break-glass procedure; and a register of every data copy (Postgres, backups, PowerSync storage, Resend, logs) with region, encryption at rest, retention, access and breach terms.

### B-40 · chore · Real app screenshots for the marketing site before launch

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-18 (prd/marketing): The marketing site shows SVG placeholders (apps/web/public/screenshots/<name>.svg) to keep the repo small while the app's screens change. Before launch: run scripts/browser-checks/marketing-screenshots.mjs on a freshly reset stack (CARETOOK_BROWSER_SLOTS=4 pnpm prd browser marketing-screenshots --timeout 300), commit the WebP images, and point site/screenshots.ts and the Screenshot component back at them (light and dark sources, srcset).
- 2026-11-18 (Robert Bo Davis): Timing (the user, 2026-11-18): one of the last tasks before launch. Do it after the launch-ready product map and once the screens it shows have stopped changing, alongside the launch work in B-33, so the images match what ships. Not part of any current marketing wave.

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
- 2026-11-19 (Robert Bo Davis): User 2026-11-19: first as templated summaries from the data (counts, changes, trends), no model, in the assistant PRD.

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
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md): E2E decision (2026-11-19) is option C for files: plan end-to-end encrypted uploads (a group key wrapped per member device, recovery codes) as part of the documents PRD.

### B-58 · plan · Add ability to use AI to review timeline, explain concerns, and generate a cheat sheet of questions…

- status: triaged
- prd: assistant
- owner:
- commit:

- 2026-11-18 (prd/marketing): From the inbox: Add ability to use AI to review timeline, explain concerns, and generate a cheat sheet of questions for provider appointments.
- 2026-11-18 (Robert Bo Davis): Proposed for assistant: review the timeline, explain concerns, and a printable cheat sheet of questions for a provider visit (the Product section's 'questions for visits'). Pairs with appointments (B-47) for the visit context.
- 2026-11-19 (Robert Bo Davis): User 2026-11-19: first as a deterministic 'since the last visit with <provider>' sheet (new symptoms, medication changes, vital trends, missed doses), printable, in the assistant PRD. AI-written questions come later, possibly through connectors.

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

### B-68 · chore · Email sending setup before launch: domain tracking off, SPF/DKIM/DMARC, bounce webhooks, cron schedule, rate-limit storage

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-18 (prd/invites orchestrator): From the invites PRD (AGENTS.md, Notifications → Before launch): turn off Resend's open and click tracking on the sending domain (not per message); SPF, DKIM and DMARC on the sending subdomain; verified bounce webhooks (Svix); a host cron for /api/cron/outbox with CRON_SECRET; and Better Auth's rate-limit storage (in-memory per serverless instance today). Part of launch work, related to B-33.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-7: shared rate-limit storage is a launch blocker (Better Auth and packages/api/src/rateLimit.ts are per instance).

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

### B-87 · plan · "simple mode" for the timeline page. We need a way for less tech savvy users to easily add items to…

- status: triaged
- prd: assistant
- owner:
- commit:

- 2026-11-19 (Robert Bo Davis): From the inbox: "simple mode" for the timeline page. We need a way for less tech savvy users to easily add items to and view the timeline without having to learn the full interface. This is a pre-launch feature once other features are in place.
- 2026-11-19 (backlog planner): Proposed as its own PRD (simple-mode), pre-launch, written once the feature set settles (after care-periods and the medication follow-ups). Touches the timeline route folder, quick add, the entry sheets and a per-user setting in user.preferences (no migration). Related: B-31 (demo group) and onboarding.
- 2026-11-19 (Robert Bo Davis): User 2026-11-19: simple mode is part of the assistant PRD; quick entry is what makes it simple. Rely on the keyboard's dictation for voice (no Siri or Alexa for now).
- 2026-11-19 (Robert Bo Davis): Simple mode, user 2026-11-19: one column, large type, 56 px targets: header with recipient + Today and a Full app link; the big quick-entry box (dictation hint); a Now block (due passes via Given all with Undo, next appointment); four big tiles; then the normal timeline rows, bigger, with no ⋯ menus. Hides filters, search, the vitals strip, the sections nav, group menus, settings and provider and medication management; add and undo-your-last only. Switch: both a default (owners and admins per member, plus each user's own) and a quick toggle on the timeline. Tiles: a group setting choosing fixed (Note, Medicine, How she feels, Blood pressure), owner-picked, or learned from use; default learned from use, with an onboarding step showing that owners can set them. Timing: write now, queue for the next free PRD slot (care-periods'); dose and pass actions go in late slices after medications-2.

### B-89 · feature · PRD tooling streamlining. We are using way too many resources for full docker stacks and browser…

- status: landed
- prd: orchestration
- owner: prd/orchestration
- commit: b0076a1

- 2026-11-19 (backlog planner): From the inbox: PRD tooling streamlining. We are using way too many resources for full docker stacks and browser tests. We should discuss options for reducing the overhead.
- 2026-11-19 (backlog planner): Proposed for orchestration as a discussion first (no PRD yet): options include shared stacks (one Postgres with a database per worktree, one PowerSync), stackless slices for pure-module work, fewer browser checks per landing, and a lower browser lease count. Needs an interview before any change.
- 2026-11-19 (plan/orchestration): Planned in plans/orchestration-plan.md (2026-11-19).
- 2026-11-19 (slice/orchestration/5): slice 5 built on slice/orchestration/5 (2b59955): stackless slices by default, shared test Postgres (caretook-shared-test, :5436, db per worktree), pnpm prd stack up|down, gc, test-db; awaiting merge

### B-91 · feature · Need an Admin panel for caretook global administrators to manage users, care groups, and settings.

- status: landed
- prd: admin
- owner: prd/admin
- commit: 27c83fc

- 2026-11-19 (Robert Bo Davis): Proposed for a new PRD 'admin' (to write): extends the existing web-only /admin (access codes, new group, waitlist) with users (find, verify, disable, sign out everywhere, reset), care groups (list, members and roles, owner recovery) and settings. Staff still see no care data (AGENTS.md: support access only as an explicit, audited grant), so it needs an audit log. Soft dependency on account-security (B-85: 2FA required for staff) first.
- 2026-11-19 (plan/admin): PRD and plan written (interview 2026-11-19): plans/admin-prd.md, plans/admin-plan.md. Six slices, waves 1 → (2, 4, 5) → (3, 6): staff foundation (support role, staff rules, audit log, Admin menu item, admin:grant), users, disable and staff roles, care groups, settings, announcement banner. Staff never see care data; no group delete (data-rights); 2FA later (account-security). Start after profiles lands.
- 2026-11-19 (slice/admin/1): admin slice 1 (staff foundation) committed on slice/admin/1 at 2b4825f: support role, audit log, staffProcedure, Audit page, Admin menu item, admin:grant
- 2026-11-19 (slice/admin/3): slice 3 (disable and staff roles) ready on slice/admin/3 at 39719c6: auth refuses disabled accounts; admin.users.disable|enable|setRole; Access card on the user page

### B-98 · change · Hide add to timeline buttons behind a + icon in the timeline header.

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-19 (prd/quick-fixes): Proposed for quick-fixes: one contained change to the timeline's QuickAddBar (a + menu in the header); not yet a slice in the plan.
- 2026-11-19 (Robert Bo Davis): User 2026-11-19: one quick-fixes slice with B-99, after care-periods and medications-2 land.

### B-99 · change · Don't display recent vitals in the timeline header in mobile,

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-19 (Robert Bo Davis): quick-fixes: small change to LatestVitals visibility below sm. Touches the timeline header strips, hot for medications-2 (medication strip) and care-periods (period line): start it after both land, ideally in one slice with B-98 (+ button), since both reshape the phone header. If simple-mode (B-87) gets a PRD first, fold both into it.
- 2026-11-19 (Robert Bo Davis): User 2026-11-19: one quick-fixes slice with B-98, after care-periods and medications-2 land.

### B-100 · change · Add "recent vita averages" to the profile page.

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-19 (Robert Bo Davis): quick-fixes: a read-only region on the profile page (not a hot file now that profiles is done), from local vitals via json_each. Needs a decision on the window (7 or 30 days?) and which types; the slice agent should ask. Could move to a vitals-trends PRD if charts come up.

### B-104 · plan · Connectors: let a user's own Claude or ChatGPT read and write their care group through an MCP server

- status: triaged
- prd: connectors
- owner:
- commit:

- 2026-11-19 (Robert Bo Davis): From the 2026-11-19 planning discussion. A remote MCP server over the assistant PRD's actions layer (Claude connectors and ChatGPT's Apps SDK both speak MCP). Reads and writes; each write is confirmed in the chat, labelled as from an assistant on the timeline, and deletable as usual. Needs OAuth (check Better Auth's OAuth-provider plugins), tokens limited to one group with read and write scopes, revocable on the Devices page (B-80), a per-group consent record, an owners' on/off group setting, and a privacy-page change (data goes to the user's chosen AI vendor). Online only. Siri and Alexa are out for now: dictation only.

### B-105 · change · Care period display on timeline should be a part of the sticky header that includes date instead of…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-19 (prd/admin): From the inbox: Care period display on timeline should be a part of the sticky header that includes date instead of part of the main timeline header.
- 2026-11-19 (Robert Bo Davis): Proposed for quick-fixes: moves CurrentPeriodLine into the sticky day header. Same timeline-header area as B-98/B-99 (hot for medications-2's strip): fold into that one slice after medications-2 lands.

### B-106 · bug · Turning email invites off also blocks staff owner invites from /admin

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-19 (prd/admin): From the user while admin slice 5 merged: not the intended behaviour. careGroupInviteService.createEmail refuses with settings:signupClosed when signup.emailInvites is off, and groupAdminService.inviteOwner and staffGroupService.createWithOwnerInvite go through it, so staff can't invite an owner. Staff owner invites should bypass the switch. Not addressed in the admin PRD's current slices; fix later.
- 2026-11-19 (Robert Bo Davis): Inbox bullet 'Browser testing without a timeout…' had been mis-tagged (B-106) by an add commit; untagged and re-filed as B-108.
- 2026-11-19 (Robert Bo Davis): Moved from admin (done, landed) to quick-fixes: a contained service fix (staff owner invites bypass signup.emailInvites).

### B-107 · feature · Is there an alternative to the hard coded browser tests? Or a way to add prioritized browser tests…

- status: in-progress
- prd: orchestration
- owner: prd/orchestration
- commit:

- 2026-11-19 (Robert Bo Davis): From the inbox: Is there an alternative to the hard coded browser tests? Or a way to add prioritized browser tests (blocker, major, minor, etc.) an only run the blocker/major tests? The test suite takes too long to run and is not very reliable.
- 2026-11-19 (Robert Bo Davis): Proposed for orchestration with B-89 and B-108: check priorities (blocker/major/minor tags on steps or checks, --changed running only blocker+major, full tiers before staging). Needs an interview; the smoke mode (B-39) is a partial version already.
- 2026-11-19 (plan/orchestration): Planned in plans/orchestration-plan.md (2026-11-19).
- 2026-11-19 (slice/orchestration/6): Slice 6 handed off (9d8c353): web:components project, test device (renderWithDevice, fx builders), ui primitive tests; 53 tests in ~16 s.
- 2026-11-19 (slice/orchestration/9): Slice 9 (47f03a0 on slice/orchestration/9): the lean end-to-end set is the manifest's e2e set (12 checks, 12/12 in 4m31s); screens with component tests need no browser check in --changed; browser leases moved to .loops/.lease/browser. Remaining checks to move: B-114 to B-127; refused-upload step B-128; Playwright port B-129.

### B-110 · bug · Fix the flakiest browser-check steps from .browser-flakes.log (app-shell, phase2, ui, live-notes)

- status: in-progress
- prd: orchestration
- owner: prd/orchestration
- commit:

- 2026-11-19 (backlog planner): User 2026-11-19: in the orchestration PRD. 42 FLAKY retries logged: app-shell 11, phase2 6, ui 4, live-notes 4, medications 3, first-sync 3.
- 2026-11-19 (plan/orchestration): Planned in plans/orchestration-plan.md (2026-11-19).
- 2026-11-19 (slice/orchestration/8): slice 8: phase2.mjs (130 steps, ~166 s) and live-notes.mjs (118, ~313 s) shrunk to 8 and 41 steps (9 s, 51-56 s); the rest moved to component tests (timeline/*.browser.test.tsx, entry/entry.browser.test.tsx). Their flaky steps (infinite-scroll announce/move under load, live-notes timeouts, Live now and avatar latency) are now component tests or kept with 15 s waits and a 6 s latency bound; the viewer's avatar order waited on the member's proxied upload, now it waits for ps_crud to empty. Vitest browser mode's fixed port (23315) clashes between worktrees running component tests at once.
- 2026-11-19 (slice/orchestration/7): slice 7: app-shell.mjs and ui.mjs shrunk to their server/sync/real-build flows (13 and 7 assertions, about 8 s and 5 s, from 208 s and 216 s); their screen steps are component tests. The logged FLAKY steps (timeouts under load, and 6g's viewer sign-in on a page that just signed out) went with the moved steps or were fixed: every e2e sign-in now uses a fresh page.
- 2026-11-19 (slice/orchestration/9): Slice 9: live-notes 'the viewer's row shows the document as its body, and the title' failed once in the lean suite (the text arrived before the title); the step now waits for both. Passed on the next suite run.

### B-112 · change · Show the recipient's allergies on the profile's printable emergency sheet

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-19 (prd/medications-2): The emergency sheet (profiles) passes allergies: null, waiting for B-26. medications-2 built allergies (lib/sync/allergies.ts: allergiesQuery, loadAllergies; PrintAllergies), so the sheet can show them now. profiles.mjs's sheet step would need to expect them.
- 2026-11-19 (Robert Bo Davis): Proposed for quick-fixes: one small change to the emergency sheet (pass loadAllergies instead of null) plus profiles.mjs's sheet expectation; medications-2 has landed, so nothing blocks it.

### B-113 · chore · Recheck admin.mjs, app-shell.mjs and providers.mjs on the new check suite after the orchestration PRD lands

- status: triaged
- prd: admin
- owner:
- commit:

- 2026-11-19 (prd/admin): Admin landed with two suite failures treated as flaky (the user's call): app-shell.mjs failed twice at low load in step 6g (viewer@'s sign-in on a page that signed out stays on /sign-in, no alert, 60 s timeout; slice 3 changed sign-in hooks, so rule that out); providers.mjs failed once at '1280: every suggestion shows' (chip count 1 at 420 vs 5 at 1280, likely a race). Logs: .git/worktrees/admin/caretook-browser/app-shell-20261119-172829.log and providers-20261119-173206.log. Run both on the new suite; if app-shell still fails there, it's a real bug from admin slice 3.
- 2026-11-19 (prd/orchestration): orchestration wave 2 landed (07bc4eb). app-shell.mjs is being shrunk by orchestration slice 7 (wave 3), which was asked to investigate step 6g (sign-in after sign-out on one page); results noted here when wave 3 lands.
- 2026-11-19 (slice/orchestration/7): slice 7 (orchestration): app-shell 6g's stall is a harness race that also shows an app wart. The check signed viewer@ in again on the same page that had just signed out (same x-forwarded-for, after a run of session checks), so Better Auth's limiter could answer the first get-session after sign-in with a 429. requireSession treats 429 as 'unknown'; sign-out wiped the cached user, so with no cached user it returns 'signedOut' and redirects to /sign-in with no message (lib/session.ts resolveUser). Harness fixed in slice 7 (fresh page per sign-in). App: a rate-limited session check right after a successful sign-in silently bounces to /sign-in; worth a message or a retry (not changed in slice 7).
- 2026-11-19 (prd/orchestration): orchestration wave 3 landed. app-shell.mjs (now 13 assertions, 8 s) passed on the new suite at low load; every sign-in is on a fresh page, which removes the step 6g repeat sign-in. Probable app cause (unconfirmed, log gone): a 429 on the first get-session after sign-in counts as unknown, and with no cached user requireSession treats it as signed out and redirects to /sign-in silently (apps/web/app/lib/session.ts resolveUser). providers.mjs and admin.mjs weren't rerun here.

### B-114 · chore · Move routing.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set (e2e no) since orchestration slice 9. Move its screen steps (appUrls links, sheet URLs open and close, settings subpages, the group route's redirects and 404s) to *.browser.test.tsx beside the routes, delete each covered step (map step -> test in the hand-off), keep only what needs a real page load (route discovery offline, a deep link after a full load); then e2e yes or delete it. Rules: docs/loops.md, Browser check budget.

### B-115 · chore · Move settings-layout.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. The Settings <-> timeline toggle on one device is a component test (settings.browser.test.tsx); keep only the choice following the account to a second browser, ideally folded into layout-offline.mjs; then delete settings-layout or set it e2e yes.

### B-116 · chore · Move providers.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the directory (list, search, filters), the sheets, the provider page, the entry page's With row and suggestions to component tests on the test device; keep two-browser notes, offline add and edit then upload, and the viewer's refused writes. Then e2e yes. B-113 asks for a recheck of it too.

### B-117 · chore · Move groups.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the New care group sheet, the invite card and /join/:code's form states to component tests; keep the server flows (careGroup.create then the new group syncing in, /join sign-up and the refused codes, /admin's 404 for non-staff, the QR). Then e2e yes.

### B-118 · chore · Move medications.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9 (the biggest check, about 163 s). Move the list, search and status, the forms, status actions, Today, the Due now strip, the Dose sheet's states, passes, allergies and the print sheet's layout to component tests; keep a second device seeing a dose, offline then upload, and the service-written change entries. Then e2e yes.

### B-119 · chore · Move upcoming.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9 (about 203 s). Move the section, Past, filters, adding at ?when=pick, cancel and reschedule dialogs, the Next strip and block, and due doses in Upcoming to component tests; keep reschedule's one transaction uploading and reaching another device. Then e2e yes.

### B-120 · chore · Move search.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the timeline's search field and chip, the search page, highlights, snippets and recent searches to component tests (the FTS index runs on the test device's SQLite); keep the index dropped at sign-out and server search if a screen ever calls it. Then e2e yes or delete it.

### B-121 · chore · Move profiles.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the profile page, its sheets by role, offline states and the print sheet's layout to component tests (oRPC through the test device's api); keep a save syncing back, demotion losing the writers' details on the next sync. Then e2e yes.

### B-122 · chore · Move profiles-contacts.mjs to component tests

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move account Contact details and the Members page's sharing form to component tests; keep a share reaching a co-member's device. Then e2e yes.

### B-123 · chore · Move care-periods.mjs to component tests

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the periods list, sheets, period page, timeline line and markers, group menu and suggestions to component tests; keep a second device, offline then upload, and ties. Then e2e yes.

### B-124 · chore · Move devices.mjs to component tests

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the Devices page's list, labels and offline notice to component tests; keep signing another device out (its next session check goes to sign-in) as a lean flow, possibly folded into session-end.mjs. Then e2e yes.

### B-125 · chore · Move admin.mjs to component tests

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. admin pages are web-only server loaders, so component tests need loader data: move what renders from data (users, groups, audit, settings, the banner) there; keep staff-only access, the audit log written by real actions and the announcement reaching /app. Then e2e yes.

### B-126 · chore · Move roundtrip.mjs's sheet steps to component tests

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): roundtrip.mjs stays in the lean set (devices converging, offline then reconnect, the viewer, the sign-out wipe), but its add and edit sheet steps (validation, When's date picker, edit and delete) are screen behaviour: move them to component tests for the timeline's sheets (new/, edit/, EntryForm) and delete each covered step.

### B-127 · chore · Move invites.mjs's screen steps to component tests

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): invites.mjs stays in the lean set (emails through /dev/mail.json, sign-up, consent, join, links and requests). Move its form states (the invite page's views, the wrong-account view, sign-in tabs, the invite sheet and pending list) to component tests and delete each covered step.

### B-128 · chore · Add a lean end-to-end step for an upload refused by permissions

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): The lean set (orchestration slice 9) is meant to cover uploads refused by permissions, but no check asserts one: a device whose role was lowered on the server writes locally, the upload is rejected (4xx acknowledged), and the next sync restores the server's copy. Add it to roundtrip.mjs or app-shell.mjs's demotion step.

### B-129 · chore · Port the lean end-to-end set to Playwright Test

- status: inbox
- prd:
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): A non-goal of the orchestration PRD, filed as its follow-up: the CDP harness (cdp.mjs, proxy.mjs) could become Playwright Test now that playwright is a dev dependency (component tests). Only the lean set (scripts/loops/checks e2e yes); keep the lease, the watchdog and the check build.
