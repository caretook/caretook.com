# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

Which PRDs exist, what each depends on, and the shared files it touches: orchestrators read this to choose what can run at the same time. At most three PRD orchestrators run at once.

| PRD               | Doc                                                          | Depends on                                           | Hot files                                                                   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `orchestration` | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): **done** (`94e6b80`) | — | none now |
| `live-notes-ux` | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done** | — | none now |
| `quick-fixes`     | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–46 in `dev` (44–46: B-135, B-134, B-157 in `2d57e70`); wave 13 (slices 47–51: B-184 to B-190) in `dev` (`bf0891df`); wave 14 (slices 52–57: B-192, B-198, B-201, B-191, B-174, B-175) planned, to run; new fixes append as slice 58 on |  (none) | varies by slice; none now |
| `app-shell` | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done** | — | none now |
| `timeline-polish` | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done** | — | none now |
| `search` | [PRD](search-prd.md), [plan](search-plan.md): **done** (`a5f3d4d`) | — | none now |
| `providers` | [PRD](providers-prd.md), [plan](providers-plan.md): **done** (`7c075d1`) | — | none now |
| `medications` | [PRD](medications-prd.md), [plan](medications-plan.md): **done** (`8ff8354`) | — | none now |
| `medications-2` | [PRD](medications-2-prd.md), [plan](medications-2-plan.md): **done** (`a6738b4`) | — | none now |
| `assistant` | [PRD](assistant-prd.md), [plan](assistant-plan.md): **done** (`7f3ec10`) | — | none now |
| `connectors`      | [PRD](connectors-prd.md), [plan](connectors-plan.md): 7 slices, waves (1, 2, 7) → (3, 4, 5) → 6: the due-doses core and preview moved to `@caretook/data`, then the tracer bullet (OAuth via `@better-auth/oauth-provider` 1.7.25, `/connect` consent, one-group grants, the owners' switch, a hand-rolled stateless MCP server at `/mcp`, the first read tools), the privacy text, then write tools with the "via" tag, the other read tools, and the Assistants and Devices screens, then a `roundtrip` step (B-104). **Ready to start** | `assistant` (done); B-80 (done); slice 3's tag waits for `timeline-ux`'s row and header slices in `dev` | `packages/auth` (`auth.ts`, the plugin), `db/schema/auth/`, one migration (`care_group`, `timeline_entry`, `task` columns), `sync-config.yaml` and the device schema (`via`), the upload switch, timeline rows and cards, the entry header, the task page, `GROUP_SETTINGS`, Settings → Devices, the legal pages, `roundtrip` |
| `providers-2` | [PRD](providers-2-prd.md), [plan](providers-2-plan.md): 5 slices, waves (1, 3) → (2, 4) → 5: @-mentions of providers in every live document (a chip with the current name; on notes and events it links the provider like the With row; `@Name` in derived text; add-as-provider from the popup; deleting a mention keeps the link), then importing providers from another group you belong to (a copy: new ids, contact details and practice, primary off, notes stay behind, "Already here" skipped) from the Providers list, the provider page and the With and `@` pickers (B-25, B-48). No migration; new deps `@tiptap/extension-mention`, `@tiptap/suggestion` (3.34.0). **Ready to start** | none for waves 1 and 3; slice 4 after `conditions` is in `dev` (the provider page) | `LiveNotesEditor`, `noteText` (`noteYjs.ts`), the entry page and With row (`withProviders.ts`), `providers.sync.ts`, the Providers list header and a new import sheet, the provider page actions, the `live-notes` check (lean ceiling is full) |
| `appointments-2` | [PRD](appointments-2-prd.md), [plan](appointments-2-plan.md): 10 slices, waves 1 → (2, 3, 4) → (5, 6, 7) → (8, 9, 10): repeating appointments and reminders (series, 90-day visits, only this / this and later), the calendar cron and top-up, calendar items with generic-by-default sharing and the Calendar & reminders page, the iCal feed, reminder emails (push later), Google Calendar two-way sync (connect and push, then pull), "Remind me" per appointment, a roundtrip step (B-60–B-63). Three migrations; new deps `rrule`, `ical-generator`, `@googleapis/calendar`, `google-auth-library`. **Ready to start** once `timeline-ux` slice 5 is in `dev` | `timeline-ux` slice 5 (the Today card, B-169) in `dev` | `timeline_entry` (series columns), the appointment and reminder sheets, `entryActionItems`, Upcoming and timeline rows and `TodayCard` (the repeat mark), sync and upload registries, the sync matrix, `NOTIFICATIONS`, `timelineEntryService` and `taskService` (calendar jobs), `careGroupMemberService` (removal), group settings, `vercel.json` crons, a new `calendars` area |
| `connectors-2` | [PRD](connectors-2-prd.md), [plan](connectors-2-plan.md): 5 slices, waves (1, 3, 4) → (2, 5): an in-app connect guide (URL with Copy, short steps and links for Claude and ChatGPT) on Assistants and Devices; members asking owners to turn assistants on (an email, once a week, "Asked on"; also on `/connect`'s empty state); four MCP prompts and a "Connected to <group>" success step; `append_to_entry` and `update_entry` (append and title or time on any live note or event, merged through Yjs); `add_condition`, `update_condition`, `resolve_condition` (B-193, B-194, B-195, B-204, B-197). One migration (`assistant_request`), no new deps. B-196 (directory listings) stays for after launch (B-33, B-54). **Ready to start** | none for wave 1; slice 5 after `conditions` has landed | group settings → Assistants, Settings → Devices, `/connect` (`ConnectConsent.tsx`, `connect.ts`), `protocol.ts` (prompts), `tools/writes.ts` and `tools/index.ts`, `assistantActionService`, `noteYjs.ts` (`appendNoteSection`), `NOTIFICATIONS` (the request email) |
| `medications-3` | [PRD](medications-3-prd.md), [plan](medications-3-plan.md): 4 slices, waves 1 → (2, 3, 4): medication types (prescription, over the counter, supplement, other; required on new, default Rx; Rx fields collapse for other types; the list badge, `?type=`, the printed list grouped by type, search, `list_medications`; no change entry), then adding a medication from the Log a dose sheet ("+ New medication": name, dose, type, as needed; one local transaction; an "Add details" toast; the empty state) (B-200, B-199). One migration, no new deps. **Ready to start** once `conditions` has landed | `conditions` landed (it changes the medication form and page) | `medication` schema and migration, `sync-config.yaml`, the device schema, the upload switch, the sync matrix, `MedicationForm.tsx`, `medicationList.ts` and `MedicationFilters.tsx`, `printSheet`, `medicationSearchDocument`, the Dose sheet (`new-dose/`, `DoseForm.tsx`, `doseFormData.ts`), the connector `list_medications` |
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
| `check-migration` | [PRD](check-migration-prd.md), [plan](check-migration-plan.md): **done** (`c7fd1390`) | — | none now |
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
| B-61 | feature | in-progress | appointments-2 | prd/appointments-2 | Appointment reminders by email and push before the appointment |
| B-62 | feature | ready | appointments-2 | prd/appointments-2 | iCal feed of a care group's upcoming appointments |
| B-63 | feature | in-progress | appointments-2 | prd/appointments-2 | Google Calendar sync of a care group's appointments |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-145 | question | triaged | encryption |  | Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for… |
| B-174 | bug | in-progress | quick-fixes | prd/quick-fixes | Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page |
| B-175 | chore | ready | quick-fixes | prd/quick-fixes | Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6 |
| B-180 | bug | triaged | quick-fixes |  | Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races |
| B-181 | feature | in-progress | conditions | prd/conditions | A conditions list on the care recipient's profile (diagnoses), so helpers and a connected assistant's recipient_profile can see them |
| B-182 | bug | triaged | quick-fixes |  | providers.browser.test.tsx 'a practice's name finds its clinicians too; the Clinicians chip keeps the search…' flakes under load: after tapping Clinicians, the 'Current providers' list still has Dr. Samuel Patel when its expect.poll times out |
| B-183 | chore | triaged | hosting |  | Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons) |
| B-191 | bug | ready | quick-fixes | prd/quick-fixes | clicking the next entry in the upcoming section of the simple timeline should expand the section,… |
| B-192 | bug | ready | quick-fixes | prd/quick-fixes | undo when checking off a todo should list all the todos that were checked off, not just the last… |
| B-193 | feature | triaged | connectors-2 |  | In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states |
| B-194 | feature | triaged | connectors-2 |  | A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off |
| B-195 | feature | triaged | connectors-2 |  | Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state |
| B-196 | feature | triaged | connectors-2 |  | List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting |
| B-197 | feature | triaged | connectors-2 |  | Connector write tool add_condition (and resolve): a connected assistant adds or resolves a care recipient's condition through recipientConditionService |
| B-198 | bug | ready | quick-fixes | prd/quick-fixes | rotating placeholder in the timeline entry box is distracting and confusing. Use a static… |
| B-199 | bug | triaged | medications-3 |  | ability to add a medication quickly from the log a dose screen. |
| B-200 | bug | triaged | medications-3 |  | medications need a type field: rx, otc, supplement, etc. |
| B-201 | bug | ready | quick-fixes | prd/quick-fixes | simple timeline date header should show the care period as well |
| B-203 | feature | triaged | github-review |  | Now that we are we have github fixed, we should start using it for some of the merge management so… |
| B-204 | feature | triaged | connectors-2 |  | connector should be able to edit notes and events so it can help you draft questions or add… |
| B-205 | bug | in-progress | quick-fixes | prd/quick-fixes | mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails at some times of day: give_pass on w.evening returns isError (line 160) |

## Items

### B-25 · feature · @-mentions of providers inside live notes and events

- status: triaged
- prd: providers-2
- owner:
- commit:

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

- status: triaged
- prd: providers-2
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed as a providers follow-up (the PRD is done, like B-25): copy a provider from another group you belong to into this one (a copy, not a shared row, since providers are per group and synced per group). Needs a small PRD addendum or a quick-fixes slice once scoped.
- 2026-11-20 (Robert Bo Davis): Moved from providers (done) to a new providers-2 PRD, to write (the user, 2026-11-20): B-48's cross-group permission rules want an interview, and B-25 touches the live-notes editor. Same commit: the PRD table's done rows shortened, rows added for providers-2 and appointments-2. -- backlog agent
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): B-25 is slices 1-2 (mentions; deps approved), B-48 slices 3-5 (import as a copy: writer here, any member there; three entry points; notes not copied). -- backlog agent

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

- status: in-progress
- prd: appointments-2
- owner: prd/appointments-2
- commit:

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-62 · feature · iCal feed of a care group's upcoming appointments

- status: ready
- prd: appointments-2
- owner: prd/appointments-2
- commit: 6e343bd8

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-63 · feature · Google Calendar sync of a care group's appointments

- status: in-progress
- prd: appointments-2
- owner: prd/appointments-2
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

### B-145 · question · Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for…

- status: triaged
- prd: encryption
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. / Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- 2026-11-20 (backlog agent): Triage: a decision for the encryption review (plans/security-review.md, option A for launch), not a build item yet. It only becomes work with Capacitor (SQLCipher, secure storage); on the web the browser profile is the boundary. Needs the user's answer; no PRD to start.

### B-174 · bug · Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-20 (prd/timeline-ux): Found by timeline-ux slice 6 in the component-test router; check with the real ScrollRestoration before fixing.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-175 · chore · Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 970ff782

- 2026-11-20 (prd/timeline-ux): Slice 6 dropped places from the timeline; left in place to stay clear of slice 5.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-180 · bug · Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (prd/check-migration): Left by slice 24 (B-176's sweep covered the click/fill/hover/type/clear sites). Convert to await expect.poll(...) or found(), keeping what each assertion reads. Proposed for check-migration. -- check-migration orchestrator
- 2026-11-20 (prd/check-migration): Also: two timelineLayout tests now inline the same 'wait until the element stops moving' loop (the author tooltip and the viewer's ⋯, both after the quick-entry chips shift the rows). A shared helper beside found() would fit. -- check-migration orchestrator
- 2026-11-20 (Robert Bo Davis): Moved from check-migration (done, c7fd1390) to quick-fixes (the user, 2026-11-20): the next quick-fixes wave appends them as slices (B-180 is a sweep across component tests; B-182 one test). -- backlog agent

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
- prd: quick-fixes
- owner:
- commit:

- 2026-11-20 (prd/connectors): Seen in connectors slices 1, 2 and 5 and in the connectors landing check (2026-11-20, load ~14, 410 s run); passes alone. The connectors PRD changes nothing under providers/. Line 73: expect.poll(listNames('Current providers')).toEqual(['Dr. Elena Alvarez']).
- 2026-11-20 (Robert Bo Davis): Moved from check-migration (done, c7fd1390) to quick-fixes (the user, 2026-11-20): the next quick-fixes wave appends them as slices (B-180 is a sweep across component tests; B-182 one test). -- backlog agent

### B-183 · chore · Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-20 (hotfix/go-live): Repo is public (B-33), so run logs are public for 7 days. Use ::add-mask:: on email/reason inputs in admin-grant.yml, db-access.yml, rotate-jwks.yml; secrets are already masked.
- 2026-11-20 (Robert Bo Davis): Triage: hosting, part of going live (B-33): add ::add-mask:: in admin-grant.yml, db-access.yml, rotate-jwks.yml before production

### B-191 · bug · clicking the next entry in the upcoming section of the simple timeline should expand the section,…

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 5a7d7238

- 2026-11-20 (prd/quick-fixes): From the inbox: clicking the next entry in the upcoming section of the simple timeline should expand the section, not take you to the next entry. once expanded, clicking on any item should take you to the full view of that item.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small simple-mode timeline fix (the Upcoming block's next entry expands the block; once open, each item opens its page). A slice in a later wave; the user reviews.

### B-192 · bug · undo when checking off a todo should list all the todos that were checked off, not just the last…

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: f9109cad

- 2026-11-20 (prd/quick-fixes): From the inbox: undo when checking off a todo should list all the todos that were checked off, not just the last one that was checked off.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small tasks fix (the undo after checking off names every task checked off since, not just the last). A slice in a later wave; the user reviews.

### B-193 · feature · In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): today nothing in the app tells a member the URL or where to add it; connectors-2 PRD, to write
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-194 · feature · A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): connectors-2 PRD, to write; touches notifications
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-195 · feature · Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state

- status: triaged
- prd: connectors-2
- owner:
- commit:

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

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (plan/conditions): Conditions planning 2026-11-20 (the user): conditions ship read-only to assistants; the writer is a follow-up, after the conditions PRD lands
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-198 · bug · rotating placeholder in the timeline entry box is distracting and confusing. Use a static…

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 28d637a9

- 2026-11-20 (prd/conditions): From the inbox: rotating placeholder in the timeline entry box is distracting and confusing. Use a static placeholder that is a prompt to type something. and move to a ? with tooltip to explain the format/power.
- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Undoes timeline-ux's rotating placeholder (B-170ish) for a static prompt plus a ? tooltip on the format; quick entry only.
- 2026-11-20 (Robert Bo Davis): Correction to the note above: the rotating placeholder came from a timeline-ux slice (quick entry); ignore the 'B-170ish' guess.

### B-199 · bug · ability to add a medication quickly from the log a dose screen.

- status: triaged
- prd: medications-3
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. A small 'new medication' path from the log-a-dose sheet; reuses the medications form. If it needs B-200's type field, run after it.
- 2026-11-20 (plan/quick-fixes): 2026-11-20 (backlog session, the user): moved to medications-3, out of quick-fixes wave 14. The user's flow: an inline add in the log-a-dose sheet with name, dose and type (B-200's field), a link to add details on the medication's page, and the new medication picked for the dose; also offered in the no-medications empty state. Plan it with B-200.
- 2026-11-20 (plan/medications-3): PRD and plan written (plan/medications-3): 4 slices, 1 then (2, 3, 4). Types prescription/otc/supplement/other, required on new (default Rx), existing unset; Rx fields collapse for other types; list badge and ?type=, print grouped by type, search and list_medications; no change entry. B-199 is slice 4: '+ New medication' in the Dose sheet (name, dose, type; as needed), one local transaction, an 'Add details' toast, also the empty state.

### B-200 · bug · medications need a type field: rx, otc, supplement, etc.

- status: triaged
- prd: medications-3
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triage: medications-3 (to write). A new synced column (migration, sync rules, form, list filter, connector list_medications) with open choices (the type list, required or not, prescriber link); conditions is running and touches medications, so plan it to start after conditions lands.
- 2026-11-20 (plan/medications-3): PRD and plan written (plan/medications-3): 4 slices, 1 then (2, 3, 4). Types prescription/otc/supplement/other, required on new (default Rx), existing unset; Rx fields collapse for other types; list badge and ?type=, print grouped by type, search and list_medications; no change entry. B-199 is slice 4: '+ New medication' in the Dose sheet (name, dose, type; as needed), one local transaction, an 'Add details' toast, also the empty state.

### B-201 · bug · simple timeline date header should show the care period as well

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b1f0a6d0

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Simple mode's day header gains the care period label that the full day header already has.

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
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-205 · bug · mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails at some times of day: give_pass on w.evening returns isError (line 160)

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-20 (prd/conditions): Failed in conditions slice 4's full check (~21:20 EST 2026-11-20) and again alone on prd/conditions without slice 4 at 21:24 EST, load 31. Looks time-of-day dependent (the Evening pass vs now, or the Metformin dose logged a minute earlier covering it). Not caused by conditions.
- 2026-11-20 (prd/quick-fixes): Taken into quick-fixes as slice 58 (wave 14) at conditions' request; blocks evening full checks.
- 2026-11-20 (prd/conditions): Cause (conditions slice 2's agent): the test logs a Metformin dose 1 minute ago; between 20:00 and ~22:00 that dose answers the Evening (20:00) slot, so give_pass returns assistantActionService:nothingLeft ('Nothing is left to give in Evening today').
