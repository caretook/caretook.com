# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

Which PRDs exist, what each depends on, and the shared files it touches: orchestrators read this to choose what can run at the same time. At most three PRD orchestrators run at once.

| PRD               | Doc                                                          | Depends on                                           | Hot files                                                                   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `orchestration` | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): **done**, all 9 slices in `dev` (`94e6b80`); follow-ups are `check-migration` and `loop-recovery` | (none) | none now |
| `live-notes-ux`   | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done**, all 10 slices in `dev` | (none) | none now |
| `quick-fixes`     | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–46 in `dev` (44–46: B-135, B-134, B-157 in `2d57e70`); new fixes append as slice 47 on |  (none) | varies by slice; none now |
| `app-shell`       | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done**, all 7 slices in `dev` | (none) | none now |
| `timeline-polish` | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done**, all 7 slices in `dev` | `live-notes-ux`, `app-shell`, `routing`, `components` (all done) | none now |
| `search` | [PRD](search-prd.md), [plan](search-plan.md): **done**, all 6 slices in `dev` (`a5f3d4d`) | (none) | none now |
| `providers`       | [PRD](providers-prd.md), [plan](providers-plan.md): **done**, all slices in `dev` (`7c075d1`); follow-ups B-25, B-48 | (none) | none now |
| `medications`     | [PRD](medications-prd.md), [plan](medications-plan.md): **done**, all six slices in `dev` (`8ff8354`; Today and Due now are in, so `appointments` slice 7 is unblocked). Follow-ups B-26, B-51 | `providers`, `routing`, `components` (all done) | `TIMELINE_ENTRY_KINDS`, `KIND_META`, timeline strips and quick add, `care_recipient`, `note_document`, sync and upload registries, `GROUP_SECTIONS`, `routes.ts`, the Dose sheet |
| `medications-2` | [PRD](medications-2-prd.md), [plan](medications-2-plan.md): **done**, all 7 slices in `dev` (`a6738b4`) | (none) | none now |
| `assistant`       | ✅ **done** (2026-11-19): [PRD](assistant-prd.md), [plan](assistant-plan.md): all 7 slices in `dev` (`7f3ec10`): quick entry, suggestions, day summaries, visit prep and Print, simple mode, passes everywhere (B-12, B-49, B-58, B-87). Decisions in `docs/domain/assistant.md` | `medications-2` (done) | none now |
| `connectors`      | to write (B-104): an MCP server so a user's own Claude or ChatGPT reads and writes their group (writes confirmed in chat, labelled), OAuth with group-limited tokens, consent and an owners' switch | `assistant` (its actions layer); B-80 (Devices page, token revocation) | `packages/auth` (OAuth provider), `packages/api` (a new MCP mount), group settings, the privacy pages, `PERMISSIONS` |
| `routing`         | [PRD](routing-prd.md), [plan](routing-plan.md): **done**, all 5 slices in `dev` (`ff25ef2`) | (none) | none now; new routes go through `routes.ts` and `appUrls` |
| `components`      | [PRD](components-prd.md), [plan](components-plan.md): **done**, all 6 slices in `dev` (landed 2026-11-18, `ca39416`) | `routing` (done) | none now; new UI uses `components/ui/` and the feature folders (AGENTS.md, _Components_) |
| `invites`         | [PRD](invites-prd.md), [plan](invites-plan.md): **done**, all 6 slices in `dev` (landed 2026-11-18, `e6286f4`) | (none) | none now; follow-ups (Withdraw for a join request, the recipient's time zone) and launch work are in AGENTS.md |
| `marketing`       | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**, all 5 slices in `dev`. B-40 and B-54 wait on the user | `invites` (done) | none now |
| `profiles`        | [PRD](profiles-prd.md), [plan](profiles-plan.md): **done**, all 6 slices in `dev` (`88890df`) | `invites`, `medications` slice 1 (both done); the sheet reads medications and providers | none now |
| `appointments` | [PRD](appointments-prd.md), [plan](appointments-plan.md): **done**, all 7 slices in `dev` (B-47 landed); follow-ups B-60–B-63, not planned | (none) | none now |
| `care-periods` | [PRD](care-periods-prd.md), [plan](care-periods-plan.md): **done**, all 6 slices in `dev` (`f6c4e92`) | (none) | none now |
| `data-rights`     | to write (B-52, B-53)                                        | (none)                                               | `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `tasks`           | [PRD](tasks-prd.md), [plan](tasks-plan.md): **done**, all 8 slices in `dev` (`1ee7864`, B-55) | (none) | none now |
| `documents`       | to write (B-56)                                              | hosting (B-33, file storage); `profiles` (soft); `encryption` decision | file storage, `routes.ts`, `GROUP_SECTIONS`, `PERMISSIONS`              |
| `encryption`      | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 | (none); affects `assistant` and `documents` | none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `onboarding`      | to write (B-31)                                              | `invites` (done)                                     | seeds, `careGroupService`, `/app` home                                     |
| `account-security` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) | `invites` (done); B-80 (the Devices page) first (soft) | `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `admin` | [PRD](admin-prd.md), [plan](admin-plan.md): **done**, all 6 slices in `dev` (B-91 landed); B-106 moved to quick-fixes, B-113 still open | (none) | none now |
| `check-migration` | [PRD](check-migration-prd.md), [plan](check-migration-plan.md): 23 slices, 10 waves of ≤ 3: steady component tests and a lean-budget ratchet (356 s → ≤ 300), a sync matrix and refused uploads, then each area check moved to component tests (flows folded into lean checks only for a new mechanism), then the lean set ported to Playwright Test and the CDP harness deleted (B-113–B-129, B-131) | `orchestration` (done); slices 11–17 wait for named `assistant` slices in `dev` | `scripts/loops/checks` and `check-areas` (additive), `scripts/browser-checks/`, `browser.sh`, `apps/web/test/` (the test device), test files beside screens, root `package.json` (`@playwright/test`, slice 19) |
| `loop-recovery` | [PRD](loop-recovery-prd.md), [plan](loop-recovery-plan.md): 5 slices, all stackless, waves (1, 2, 3) → 4 → 5: the inventory and `recover --dry-run`, the disk guard and `reclaim`, resume prompts and _Status_ at every step, `down` and `recover`, then the recovery agent with iTerm2 tabs (B-132) | `orchestration` (done): **done**, all 5 slices in `dev` (`503e900`) | none now |
| `hosting` | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent | (none) | none now |
| `app-speed` | [PRD](app-speed-prd.md), [plan](app-speed-plan.md): 6 slices, waves (1, 2, 3, 4) → (5, 6): navigation that waits on neither the session (15 min fresh window, 3 s timeout) nor settings (cache-first), prefetched and instantly highlighted section tabs, `content-visibility` on timeline rows, a bundle budget in `pnpm prd check`, a hand-written service worker with a cached `/app` shell and a reload notice, cheaper `/rpc` auth (lazy AuthUser, one query, 3 min cookie cache) (B-136–B-140, B-144, B-155, B-156) | `hosting` slice 3 in `dev` for slice 6 (B-140); the rest none: **ready to start**; **next after `quick-fixes`** (the user, 2026-11-20) | `lib/session.ts`, `lib/sessionRules.ts`, `lib/me.ts`, `routes/app/layout/SectionNav.tsx`, the `/app` layout (an update-notice region), timeline rows, `packages/auth` (`authUser.ts`, the cookie cache), `packages/api/src/procedures.ts`, `routes/rpc.ts`, `scripts/loops/prd.sh` (`check` runs the budget), `scripts/loops/check-areas` (additive), new `scripts/build/` |
| `agent-tooling` | [PRD](agent-tooling-prd.md), [plan](agent-tooling-plan.md): 6 slices, all stackless, waves (1, 2, 3) → 4 → (5, 6): batched backlog commits (multi-id writes, guarded amend), `pnpm log`, a doc budget guard, then AGENTS.md and `docs/loops.md` split into a core and `docs/agents/` role docs, then the six area docs over 10 KB trimmed to contracts (B-147, B-148, B-154; B-152 and B-153 already on `dev`). **Ready to start** | (none); slice 4 waits until no landing is imminent; slice 6 waits for `tasks` to land | `scripts/backlog/`, `scripts/loops/` (prompt.sh, land.sh, new budget files), root `package.json` (two script lines), AGENTS.md, `docs/loops.md`, new `docs/agents/`, `docs/domain/` (timeline, medications, app-shell, care-groups, components, sync) |
| `code-layout` | [PRD](code-layout-prd.md), [plan](code-layout-plan.md): 5 slices, all stackless, waves 1 → (2, 3, 4) → 5: check-areas as `check-areas.d/<area>` with most-specific-wins and a lint, then errors, permissions and schema by area, the API router by area, `lib/` grouped by domain (device queries as `<name>.sync.ts`), then `routes.ts` and `appUrls` by area. Pure refactor, no migration; one lean `--suite` at the last landing (B-149, B-150) | `tasks` and `hosting` wave 1 in `dev`, and no PRD with unmerged `check-areas` edits (`check-migration`), before slice 1; nothing else touching `lib/` or the registries while it runs | `scripts/loops/check-areas`, `routes.ts`, `appUrls.ts`, `errors/constants.ts`, `db/schema/`, `permissions.ts`, `packages/api/src/`, all of `apps/web/app/lib/` and its importers |
| `timeline-ux` | to write (B-162–B-165, B-167–B-171): simple-mode order and Upcoming heading, the quick-entry tips as a tooltip, a larger day heading, the author chip moved under the menu, the day summary in the sticky header, truncated row titles, one collapsible tile for vitals, upcoming, due and overdue, new notes and events open their page on save, recent lines without notes and with vital keys only | `code-layout` in `dev` (it moves `lib/` and `routes.ts`) | the timeline screen and its header, timeline rows (`EntryHeader`), the simple view, quick entry and its suggestions, the strips |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-25 | feature | triaged | providers |  | @-mentions of providers inside live notes and events |
| B-31 | feature | triaged | onboarding |  | Demo group for every new user: a seeded, fictional care group to explore the app |
| B-33 | plan | triaged | hosting |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-48 | feature | triaged | providers |  | Allow import of providers from other care groups that you have access to. |
| B-52 | feature | triaged | data-rights |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-55 | feature | landed | tasks | prd/tasks | Todos list with assignment to group members, due dates, and completion status. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-60 | feature | triaged | appointments |  | Recurring appointments (weekly PT, dialysis three times a week) |
| B-61 | feature | triaged | appointments |  | Appointment reminders by email and push before the appointment |
| B-62 | feature | triaged | appointments |  | iCal feed of a care group's upcoming appointments |
| B-63 | feature | triaged | appointments |  | Google Calendar sync of a care group's appointments |
| B-68 | chore | landed | hosting | prd/hosting | Email sending setup before launch: domain tracking off, SPF/DKIM/DMARC, bounce webhooks, cron schedule, rate-limit storage |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-104 | plan | triaged | connectors |  | Connectors: let a user's own Claude or ChatGPT read and write their care group through an MCP server |
| B-113 | chore | landed | check-migration |  | Recheck admin.mjs, app-shell.mjs and providers.mjs on the new check suite after the orchestration PRD lands |
| B-116 | chore | landed | check-migration | prd/check-migration | Move providers.mjs to component tests |
| B-117 | chore | landed | check-migration | prd/check-migration | Move groups.mjs to component tests |
| B-118 | chore | landed | check-migration | prd/check-migration | Move medications.mjs to component tests |
| B-119 | chore | landed | check-migration | prd/check-migration | Move upcoming.mjs to component tests |
| B-121 | chore | landed | check-migration | prd/check-migration | Move profiles.mjs to component tests |
| B-122 | chore | ready | check-migration | prd/check-migration | Move profiles-contacts.mjs to component tests |
| B-126 | chore | ready | check-migration | prd/check-migration | Move roundtrip.mjs's sheet steps to component tests |
| B-127 | chore | ready | check-migration | prd/check-migration | Move invites.mjs's screen steps to component tests |
| B-129 | chore | triaged | check-migration |  | Port the lean end-to-end set to Playwright Test |
| B-134 | bug | landed | quick-fixes | prd/quick-fixes | visitPrep component test 'the start can move back' fails on 2026-11-20 (date-dependent) |
| B-135 | change | landed | quick-fixes | prd/quick-fixes | Move the timeline's + add-entry button next to the sticky day heading, and prefill that day's time (now for today, midday for other days) |
| B-136 | change | triaged | timeline-ux |  | Stop blocking every /app navigation on a session request: use the session confirmed in the last few… |
| B-137 | change | triaged | timeline-ux |  | Prefetch the group section tabs, so the first tap on a section doesn't download its route chunk… |
| B-138 | change | triaged | timeline-ux |  | Highlight the tapped section tab at once, from the pending navigation (`useNavigation`), not only… |
| B-139 | change | triaged | app-speed |  | Add `content-visibility: auto` to timeline entries: the list grows by 30 rows with no… |
| B-140 | change | triaged | app-speed |  | Cut the per-request auth cost on /rpc: `getAuthUser` runs a session lookup and two queries on every… |
| B-141 | change | landed | hosting | prd/hosting | Back the rate limits with Postgres before launch (Better Auth's and packages/api/src/rateLimit.ts). |
| B-142 | change | landed | hosting | prd/hosting | Put the Capacitor origins (`capacitor://localhost`, `https://localhost`) behind an env flag until… |
| B-143 | change | landed | hosting | prd/hosting | Take the client IP for rate limits from the host's own header: `clientIpOf` (routes/rpc.ts) trusts… |
| B-144 | feature | triaged | app-speed |  | Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload… |
| B-145 | question | triaged | encryption |  | Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for… |
| B-147 | chore | in-progress | agent-tooling | prd/agent-tooling | Shrink what every agent loads: split AGENTS.md (31 KB, changed 97 times in 30 days) and… |
| B-148 | chore | triaged | agent-tooling |  | Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and… |
| B-149 | chore | in-progress | code-layout | prd/code-layout | Split the shared registries by area, each composed by a thin index, so concurrent PRDs stop… |
| B-150 | chore | in-progress | code-layout | prd/code-layout | Group apps/web/app/lib/ by domain: about 140 flat files named by prefix (`medication*`, `period*`,… |
| B-151 | chore | triaged | check-migration |  | Break up the browser checks by flow: 18,500 lines in all, medications.mjs alone 4,373. |
| B-154 | chore | ready | agent-tooling | prd/agent-tooling | Batch the backlog commits: 714 of the last 30 days' commits are `chore(backlog)`, which buries the… |
| B-155 | chore | triaged | app-speed |  | Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first… |
| B-156 | chore | triaged | app-speed |  | Check whether `loadSettings` in the timeline loader waits on the network before using its cache. |
| B-157 | change | landed | quick-fixes | prd/quick-fixes | Simple mode's timeline has too much plain-text instruction: drop the quick-entry typing tips under… |
| B-158 | change | landed | hosting | prd/hosting | Rotating BETTER_AUTH_SECRET breaks sync: the jwt plugin's private key (jwks table) is encrypted with it, so rows must be deleted by hand; add a rotation tool or use BETTER_AUTH_SECRETS |
| B-159 | change | landed | hosting | prd/hosting | Narrow personal db:access roles: staff_ roles get SELECT on every table, including account (password hashes), session, verification, jwks and sealed invite tokens |
| B-160 | change | landed | hosting | prd/hosting | Rotating SEED_USER_PASSWORD on staging doesn't change seeded accounts (seed uses onConflictDoNothing; @example.com can't get reset mail) |
| B-161 | bug | triaged | check-migration |  | sign-in.mjs flaked once in the lean suite at load 88: 'during the redirect the button is disabled and shows Signing in…' saw /app already ('Getting your care groups…') |
| B-162 | change | triaged | timeline-ux |  | In simple mode, Reorder so that "What happend" is directly above the timeline, basically like the… |
| B-163 | change | triaged | timeline-ux |  | "Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas… |
| B-164 | change | triaged | timeline-ux |  | "day/date" heder for full timeline is too small compared to the + button. Make text larger. |
| B-165 | change | triaged | timeline-ux |  | Move "author" tile below hamburger menu on timeline entries, it takes up valuable text space. |
| B-166 | change | triaged | app-speed |  | Using back to timeline from timeline live-note entry (or any browse action) takes you back to the… |
| B-167 | change | triaged | timeline-ux |  | Make day summary part of sticky header so it is always visible when scrolling up the timeline. |
| B-168 | change | triaged | timeline-ux |  | timeline group titles that are too long wrap to multiple lines on small screens. Truncate the… |
| B-169 | change | triaged | timeline-ux |  | vitals, upcoming, medication due, and todo overdue can be combined into a single tile that is… |
| B-170 | change | triaged | timeline-ux |  | When creating a new timeline entry for a note or event, we should navigate to edit page on save so… |
| B-171 | change | triaged | timeline-ux |  | your recent lines should exclude notes and events. vitals should only show the vital key, not the… |
| B-172 | bug | triaged | check-migration |  | app-shell.mjs's detailsGone and detailsBack checks always pass: cdp waitFor on a promise.then(...) expression is always truthy |

## Items

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

- status: landed
- prd: tasks
- owner: prd/tasks
- commit: 5a5eadf

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'tasks' (to write): a todo list per group with assignees, due dates and done state, as a group section. Due dates could show with appointments (B-47); reminders would go through notifications.
- 2026-11-19 (plan/tasks): PRD and plan written (plans/tasks-prd.md, tasks-plan.md): 8 slices, waves 1 → (2, 4, 8) → (3, 5, 6) → 7. One assignee (member, a typed name, or none); viewers complete their own; links to a provider, appointment and medication; Upcoming, strip, search, simple card, quick entry addTask. Slices 3, 4, 6, 7 wait for assistant in dev; 8 for check-migration slice 2.

### B-56 · feature · ability to upload photos of patient drivers license, insurance card, DNR, etc.

- status: triaged
- prd: documents
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'documents' (to write): photos and files (ID, insurance card, DNR) per recipient. Needs file storage, which waits on hosting (B-33), plus encryption and sync decisions (files likely online-first, not in PowerSync). Pairs with profiles (B-45).
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md): E2E decision (2026-11-19) is option C for files: plan end-to-end encrypted uploads (a group key wrapped per member device, recovery codes) as part of the documents PRD.
- 2026-11-19 (Robert Bo Davis): planning opened on plan/documents (.loops/plan-documents). Building it waits on hosting (file storage) and includes option C from the security review (E2E for files only)

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

- status: landed
- prd: hosting
- owner: prd/hosting
- commit: 05b709f

- 2026-11-18 (prd/invites orchestrator): From the invites PRD (AGENTS.md, Notifications → Before launch): turn off Resend's open and click tracking on the sending domain (not per message); SPF, DKIM and DMARC on the sending subdomain; verified bounce webhooks (Svix); a host cron for /api/cron/outbox with CRON_SECRET; and Better Auth's rate-limit storage (in-memory per serverless instance today). Part of launch work, related to B-33.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-7: shared rate-limit storage is a launch blocker (Better Auth and packages/api/src/rateLimit.ts are per instance).
- 2026-11-19 (Robert Bo Davis): Triaged to hosting with B-33: email domain setup, bounce webhooks, the outbox cron and shared rate-limit storage are part of the same deploy work.
- 2026-11-19 (Robert Bo Davis): In the hosting plan: Postgres rate-limit storage (slice 3), Resend bounce/complaint webhook with suppression (slice 4), the per-minute cron and waitUntil (slice 1), DNS and tracking off in the runbook (slices 6-7).
- 2026-11-20 (slice/hosting/4): Slice 4 committed on slice/hosting/4 (7d0be1d): Svix-verified /api/webhooks/resend, email_suppression (in migration 0022_rate_limits_suppression), notify skips suppressed except sign-in/reset/verify, /admin/suppressions.

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

- status: triaged
- prd: connectors
- owner:
- commit:

- 2026-11-19 (Robert Bo Davis): From the 2026-11-19 planning discussion. A remote MCP server over the assistant PRD's actions layer (Claude connectors and ChatGPT's Apps SDK both speak MCP). Reads and writes; each write is confirmed in the chat, labelled as from an assistant on the timeline, and deletable as usual. Needs OAuth (check Better Auth's OAuth-provider plugins), tokens limited to one group with read and write scopes, revocable on the Devices page (B-80), a per-group consent record, an owners' on/off group setting, and a privacy-page change (data goes to the user's chosen AI vendor). Online only. Siri and Alexa are out for now: dictation only.

### B-113 · chore · Recheck admin.mjs, app-shell.mjs and providers.mjs on the new check suite after the orchestration PRD lands

- status: landed
- prd: check-migration
- owner:
- commit: 0e0ab28

- 2026-11-19 (prd/admin): Admin landed with two suite failures treated as flaky (the user's call): app-shell.mjs failed twice at low load in step 6g (viewer@'s sign-in on a page that signed out stays on /sign-in, no alert, 60 s timeout; slice 3 changed sign-in hooks, so rule that out); providers.mjs failed once at '1280: every suggestion shows' (chip count 1 at 420 vs 5 at 1280, likely a race). Logs: .git/worktrees/admin/caretook-browser/app-shell-20261119-172829.log and providers-20261119-173206.log. Run both on the new suite; if app-shell still fails there, it's a real bug from admin slice 3.
- 2026-11-19 (prd/orchestration): orchestration wave 2 landed (07bc4eb). app-shell.mjs is being shrunk by orchestration slice 7 (wave 3), which was asked to investigate step 6g (sign-in after sign-out on one page); results noted here when wave 3 lands.
- 2026-11-19 (slice/orchestration/7): slice 7 (orchestration): app-shell 6g's stall is a harness race that also shows an app wart. The check signed viewer@ in again on the same page that had just signed out (same x-forwarded-for, after a run of session checks), so Better Auth's limiter could answer the first get-session after sign-in with a 429. requireSession treats 429 as 'unknown'; sign-out wiped the cached user, so with no cached user it returns 'signedOut' and redirects to /sign-in with no message (lib/session.ts resolveUser). Harness fixed in slice 7 (fresh page per sign-in). App: a rate-limited session check right after a successful sign-in silently bounces to /sign-in; worth a message or a retry (not changed in slice 7).
- 2026-11-19 (prd/orchestration): orchestration wave 3 landed. app-shell.mjs (now 13 assertions, 8 s) passed on the new suite at low load; every sign-in is on a fresh page, which removes the step 6g repeat sign-in. Probable app cause (unconfirmed, log gone): a 429 on the first get-session after sign-in counts as unknown, and with no cached user requireSession treats it as signed out and redirects to /sign-in silently (apps/web/app/lib/session.ts resolveUser). providers.mjs and admin.mjs weren't rerun here.
- 2026-11-19 (plan/check-migration): Planned: check-migration slices 7 (admin) and 14 (providers); app-shell was rechecked by orchestration wave 3 (plans/check-migration-plan.md).
- 2026-11-20 (slice/check-migration/7): check-migration slice 7: admin.mjs is deleted (B-125). Its server flows folded into app-shell.mjs step 6 (member@ 404 on /admin, admin@'s audited announcement on /admin/audit, the banner in member@'s /app), every sign-in on a fresh page: app-shell passed 18/18 first run (24 s, load 30-56), no 429. The 429-after-sign-in app wart is handled by B-130 (sign-in.browser.test.tsx: a rate-limited session check goes to sign-in with a message). Admin part closed; providers part waits for slice 14.
- 2026-11-20 (slice/check-migration/14): check-migration slice 14 (cce2ed2): providers.mjs is deleted (B-116). How each check ended: admin.mjs deleted in slice 7 (its server flows folded into app-shell step 6; no 429); app-shell.mjs kept and passing (18/18 in slice 7, every sign-in on a fresh page, the 429 bounce covered by B-130's sign-in.browser.test); providers.mjs deleted here. Its '1280: every suggestion shows' race (1 chip at 420 vs 5 at 1280) is now a component test on fixed fixtures with five chips (entry/entryWithRow.browser.test.tsx), passing. Nothing left open: B-113 can close.

### B-116 · chore · Move providers.mjs to component tests

- status: landed
- prd: check-migration
- owner: prd/check-migration
- commit: 0e0ab28

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the directory (list, search, filters), the sheets, the provider page, the entry page's With row and suggestions to component tests on the test device; keep two-browser notes, offline add and edit then upload, and the viewer's refused writes. Then e2e yes. B-113 asks for a recheck of it too.
- 2026-11-19 (plan/check-migration): Planned: check-migration slice 14, wave 6 (after assistant slice 4) (plans/check-migration-plan.md).
- 2026-11-20 (slice/check-migration/14): slice 14 (cce2ed2): providers.mjs moved to 43 component tests (providers/, provider/, entry/entryWithRow) on providerWorld.tsx, plus one integration test (two members' devices linking the same pair: one link). No fold; check, manifest line and check-areas rules gone.

### B-117 · chore · Move groups.mjs to component tests

- status: landed
- prd: check-migration
- owner: prd/check-migration
- commit: 0e0ab28

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the New care group sheet, the invite card and /join/:code's form states to component tests; keep the server flows (careGroup.create then the new group syncing in, /join sign-up and the refused codes, /admin's 404 for non-staff, the QR). Then e2e yes.
- 2026-11-19 (plan/check-migration): Planned: check-migration slice 15, wave 6 (plans/check-migration-plan.md).
- 2026-11-20 (slice/check-migration/15): slice 15 (3b2a5ad): groups.mjs deleted; screens are component tests (join, new group sheet, invite card, admin access codes/print/new group/waitlist); /join sign-up folded into invites step 13, careGroup.create syncing in into first-sync step 2c.

### B-118 · chore · Move medications.mjs to component tests

- status: landed
- prd: check-migration
- owner: prd/check-migration
- commit: 0e0ab28

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9 (the biggest check, about 163 s). Move the list, search and status, the forms, status actions, Today, the Due now strip, the Dose sheet's states, passes, allergies and the print sheet's layout to component tests; keep a second device seeing a dose, offline then upload, and the service-written change entries. Then e2e yes.
- 2026-11-19 (plan/check-migration): Planned: check-migration slices 9 (wave 4) and 11 (wave 5, after assistant slice 7) (plans/check-migration-plan.md).
- 2026-11-20 (slice/check-migration/9): slice 9 (part A): list, page, notes, forms, status actions, allergies, print sheets, provider region and the device module moved to component tests (medicationWorld.tsx); offline batch upload as an integration test; medications.mjs keeps Today, timeline doses, passes, Given all, strip, pass logs for slice 11.
- 2026-11-20 (prd/check-migration): part A merged into prd/check-migration (35dceff, slice 9); part B is slice 11
- 2026-11-20 (slice/check-migration/11): slice 11: medications.mjs deleted; Today, Dose sheet, strip, passes, pass logs are component tests (af6b87d, f274fd5); no roundtrip fold (6a covers a multi-row upload)

### B-119 · chore · Move upcoming.mjs to component tests

- status: landed
- prd: check-migration
- owner: prd/check-migration
- commit: bc5104e

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9 (about 203 s). Move the section, Past, filters, adding at ?when=pick, cancel and reschedule dialogs, the Next strip and block, and due doses in Upcoming to component tests; keep reschedule's one transaction uploading and reaching another device. Then e2e yes.
- 2026-11-19 (plan/check-migration): Planned: check-migration slice 13, wave 5 (after assistant slice 4) (plans/check-migration-plan.md).
- 2026-11-20 (slice/check-migration/13): slice 13 (0b06086): upcoming.mjs deleted; screens in upcoming/upcoming, upcomingEvents and timeline/timelineUpcoming browser tests on a fixed clock; reschedule's transaction folded into roundtrip 6a

### B-121 · chore · Move profiles.mjs to component tests

- status: landed
- prd: check-migration
- owner: prd/check-migration
- commit: 3bb168a

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move the profile page, its sheets by role, offline states and the print sheet's layout to component tests (oRPC through the test device's api); keep a save syncing back, demotion losing the writers' details on the next sync. Then e2e yes.
- 2026-11-19 (plan/check-migration): Planned: check-migration slice 10, wave 4 (plans/check-migration-plan.md).
- 2026-11-20 (slice/check-migration/10): slice 10: profiles.mjs moved to component tests (profile/*.browser.test.tsx, profileWorld.tsx); demotion losing the details row folded into app-shell step 4; check deleted (f9c1ef9, eef96ac)

### B-122 · chore · Move profiles-contacts.mjs to component tests

- status: ready
- prd: check-migration
- owner: prd/check-migration
- commit: d487b30

- 2026-11-19 (slice/orchestration/9): Out of the lean set since orchestration slice 9. Move account Contact details and the Members page's sharing form to component tests; keep a share reaching a co-member's device. Then e2e yes.
- 2026-11-19 (plan/check-migration): Planned: check-migration slice 16, wave 6 (plans/check-migration-plan.md).

### B-126 · chore · Move roundtrip.mjs's sheet steps to component tests

- status: ready
- prd: check-migration
- owner: prd/check-migration
- commit: d487b30

- 2026-11-19 (slice/orchestration/9): roundtrip.mjs stays in the lean set (devices converging, offline then reconnect, the viewer, the sign-out wipe), but its add and edit sheet steps (validation, When's date picker, edit and delete) are screen behaviour: move them to component tests for the timeline's sheets (new/, edit/, EntryForm) and delete each covered step.
- 2026-11-19 (plan/check-migration): Planned: check-migration slice 12, wave 5 (after assistant slices 1 and 5) (plans/check-migration-plan.md).

### B-127 · chore · Move invites.mjs's screen steps to component tests

- status: ready
- prd: check-migration
- owner: prd/check-migration
- commit: d487b30

- 2026-11-19 (slice/orchestration/9): invites.mjs stays in the lean set (emails through /dev/mail.json, sign-up, consent, join, links and requests). Move its form states (the invite page's views, the wrong-account view, sign-in tabs, the invite sheet and pending list) to component tests and delete each covered step.
- 2026-11-19 (plan/check-migration): Planned: check-migration slice 17, wave 7 (plans/check-migration-plan.md).

### B-129 · chore · Port the lean end-to-end set to Playwright Test

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-19 (slice/orchestration/9): A non-goal of the orchestration PRD, filed as its follow-up: the CDP harness (cdp.mjs, proxy.mjs) could become Playwright Test now that playwright is a dev dependency (component tests). Only the lean set (scripts/loops/checks e2e yes); keep the lease, the watchdog and the check build.
- 2026-11-19 (Robert Bo Davis): Proposed for check-migration, last: port only the lean set to Playwright Test once B-114 to B-128 have shrunk it.
- 2026-11-19 (plan/check-migration): Planned: check-migration slices 19-23, waves 8-10 (@playwright/test 1.65.1 approved by the user) (plans/check-migration-plan.md).

### B-134 · bug · visitPrep component test 'the start can move back' fails on 2026-11-20 (date-dependent)

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 03dfa05

- 2026-11-20 (slice/check-migration/6): Fails on prd/check-migration HEAD 7ddfbb2 without slice 6's changes, alone and in pnpm check: 'timed out waiting for the longer window'. Its last visit is 20 days ago (2026-10-31) and ArrowDown on the month field should take the start before the Cough 25 days ago; probably the 31st not existing in September. Found by check-migration slice 6.
- 2026-11-20 (prd/check-migration): check-migration orchestrator: the test now steps the year back instead of the month (commit on prd/check-migration, lands with wave 3). The app question remains for triage: should a month step back from the 31st clamp to the 30th? React Aria's month segment gave no change in the preview.
- 2026-11-20 (backlog agent): Triage: the test is already fixed on prd/check-migration (1384054). What is left is small: decide whether stepping the month back from the 31st should clamp to the 30th in the visit prep start field. One quick-fixes slice, or drop it if React Aria's behaviour is acceptable.
- 2026-11-20 (slice/quick-fixes/45): slice 45 (f068feb): fixed in ui/date/DateTimeField (React Aria held 31 Sep invalid until blur); month/year steps now clamp the day. Visit prep test steps the month on a fixed clock.

### B-135 · change · Move the timeline's + add-entry button next to the sticky day heading, and prefill that day's time (now for today, midday for other days)

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 03dfa05

- 2026-11-20 (Robert Bo Davis): From the inbox: simple entry box on timeline seems to have replaced the old add entry icons entirely. This is a regression that may block B-98.
- 2026-11-20 (backlog agent): Triage: a regression against B-98 (the + in the timeline header). One quick-fixes slice: find whether the + menu went missing in the normal view or only where the quick entry box shows, and restore it. Touches the timeline header, which tasks slice 4 also changed, so start it after tasks lands.
- 2026-11-20 (Robert Bo Davis): The user (2026-11-20): not a regression. The + is there, but in an awkward spot next to the view-mode switch. Move it beside the day heading in the timeline so it travels with the sticky header. Adding from a day's + sets that day's time: today gives now, any other day gives midday (12:00) that day. Still quick-fixes slice 44; it touches the timeline header and sticky day heading (tasks slice 4 changed the header), so start it after tasks lands.
- 2026-11-20 (slice/quick-fixes/44): slice 44 built at 22bffaa: + on each day heading, ?at= start times; writer's list always has a Today heading (new behaviour, see hand-off)

### B-136 · change · Stop blocking every /app navigation on a session request: use the session confirmed in the last few…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Stop blocking every /app navigation on a session request: use the session confirmed in the last few minutes and recheck in the background. / `requireSession` (apps/web/app/lib/session.ts) awaits `get-session` on each navigation, with no timeout, so every tap waits a round trip and can hang on a weak connection. / Add a timeout of about 3 s that counts as "no answer". The server still checks every upload and sync token.
- 2026-11-20 (backlog agent): Triage: new PRD app-speed (navigation and load speed). This one needs a design decision (how long a confirmed session is trusted, what a timeout means offline), so it is PRD work, not a quick fix. Hot file: lib/session.ts.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 1 (plans/app-speed-plan.md). 15 min fresh window, background recheck at most once a minute, 3 s timeout; the app's check bypasses the cookie cache.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.

### B-137 · change · Prefetch the group section tabs, so the first tap on a section doesn't download its route chunk…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Prefetch the group section tabs, so the first tap on a section doesn't download its route chunk (and works offline). / The links in routes/app/layout/SectionNav.tsx (SectionNav and TabBar) have no `prefetch`; sheets already use `prefetch="render"`.
- 2026-11-20 (backlog agent): Triage: app-speed. Small (prefetch on SectionNav and TabBar links), grouped with B-136 and B-138 because all three change the same navigation path.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 2 (plans/app-speed-plan.md). prefetch=render on SectionNav and TabBar.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.

### B-138 · change · Highlight the tapped section tab at once, from the pending navigation (`useNavigation`), not only…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Highlight the tapped section tab at once, from the pending navigation (`useNavigation`), not only after the loaders finish.
- 2026-11-20 (backlog agent): Triage: app-speed. Small (useNavigation in SectionNav), same file as B-137.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 2 (plans/app-speed-plan.md). Highlight from useNavigation's pending location.
- 2026-11-20 (Robert Bo Davis): Re-triaged from app-speed to timeline-ux (the user, 2026-11-20): app-speed and the timeline UI changes are planned as one PRD, since both wait on code-layout and touch the timeline header and rows. plans/app-speed-prd.md is the speed half's input.

### B-139 · change · Add `content-visibility: auto` to timeline entries: the list grows by 30 rows with no…

- status: triaged
- prd: app-speed
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Add `content-visibility: auto` to timeline entries: the list grows by 30 rows with no virtualization.
- 2026-11-20 (backlog agent): Triage: app-speed. Small CSS change on timeline rows; needs a check that scroll restore and the paging sentinel still work.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 3 (plans/app-speed-plan.md). content-visibility: auto + contain-intrinsic-size; timelineScroll tests guard restore and paging.

### B-140 · change · Cut the per-request auth cost on /rpc: `getAuthUser` runs a session lookup and two queries on every…

- status: triaged
- prd: app-speed
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Cut the per-request auth cost on /rpc: `getAuthUser` runs a session lookup and two queries on every call, public procedures included. / A short cookie cache, or skipping the lookup for public procedures (packages/auth/src/authUser.ts, routes/rpc.ts).
- 2026-11-20 (backlog agent): Triage: app-speed. Touches packages/auth/src/authUser.ts and routes/rpc.ts, which hosting slice 3 also changes (rate limits): run it after hosting wave 1 is in dev.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 6 (plans/app-speed-plan.md). Lazy AuthUser, one query, Better Auth cookie cache 3 min (staff and /token bypass it; tradeoff documented in auth.md and security-review.md). Needs hosting slice 3 in dev.

### B-141 · change · Back the rate limits with Postgres before launch (Better Auth's and packages/api/src/rateLimit.ts).

- status: landed
- prd: hosting
- owner: prd/hosting
- commit: 5d64d38

- 2026-11-20 (Robert Bo Davis): From the inbox: Both are in memory per serverless instance, which matters with 6-digit sign-in codes.
- 2026-11-20 (backlog agent): Triage: already planned as hosting slice 3 (Shared rate limits: Better Auth's database storage and our limiter on a Postgres table, B-68, security review S-7). Hosting's orchestrator can mark this done with slice 3; no new slice needed.
- 2026-11-20 (slice/hosting/3): slice 3 (6179cd8): limiter on rate_limit_hit (sliding, advisory lock), Better Auth storage=database, purge in sweepOutbox; migration 0022_rate_limits

### B-142 · change · Put the Capacitor origins (`capacitor://localhost`, `https://localhost`) behind an env flag until…

- status: landed
- prd: hosting
- owner: prd/hosting
- commit: 05b709f

- 2026-11-20 (Robert Bo Davis): From the inbox: Put the Capacitor origins (`capacitor://localhost`, `https://localhost`) behind an env flag until the native app ships, and define them once. / They are hard-coded as trusted, with credentials, in routes/rpc.ts and packages/auth/src/auth.ts.
- 2026-11-20 (backlog agent): Triage: proposed as a later-wave hosting slice together with B-143 (origin and client-IP hardening before going live). Same files as slice 3 (routes/rpc.ts, packages/auth/src/auth.ts), so it follows wave 1. Hosting's orchestrator decides at its wave boundary.
- 2026-11-20 (prd/hosting): Planned as hosting slice 8 (wave 2, after slices 1 and 3), with B-143.

### B-143 · change · Take the client IP for rate limits from the host's own header: `clientIpOf` (routes/rpc.ts) trusts…

- status: landed
- prd: hosting
- owner: prd/hosting
- commit: 05b709f

- 2026-11-20 (Robert Bo Davis): From the inbox: Take the client IP for rate limits from the host's own header: `clientIpOf` (routes/rpc.ts) trusts the first `x-forwarded-for` entry, which is spoofable off Vercel (the planned AWS side).
- 2026-11-20 (backlog agent): Triage: proposed as a later-wave hosting slice with B-142. Slice 3 owns the limiter; this changes what key it gets (the host's own client-IP header, not the first x-forwarded-for entry).
- 2026-11-20 (prd/hosting): Planned as hosting slice 8 (wave 2, after slices 1 and 3), with B-142.

### B-144 · feature · Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload…

- status: triaged
- prd: app-speed
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload works offline (docs/domain/sync.md already notes the gap).
- 2026-11-20 (backlog agent): Triage: app-speed, its largest slice (a precached shell for the web target only; update flow, CSP worker-src, how it meets PowerSync's own workers). Needs the PRD interview. Likely a new dependency question (hand-written worker or a Vite plugin).
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 5 (plans/app-speed-plan.md). Hand-written worker, web only; cached shell for /app/* documents; 'new version ready: Reload' notice. Blocked by slices 1 and 4.

### B-145 · question · Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for…

- status: triaged
- prd: encryption
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. / Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- 2026-11-20 (backlog agent): Triage: a decision for the encryption review (plans/security-review.md, option A for launch), not a build item yet. It only becomes work with Capacitor (SQLCipher, secure storage); on the web the browser profile is the boundary. Needs the user's answer; no PRD to start.

### B-147 · chore · Shrink what every agent loads: split AGENTS.md (31 KB, changed 97 times in 30 days) and…

- status: in-progress
- prd: agent-tooling
- owner: prd/agent-tooling
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Shrink what every agent loads: split AGENTS.md (31 KB, changed 97 times in 30 days) and docs/loops.md (52 KB, bullets up to 3.4 KB) by reader (loop agent, orchestrator, user), and keep the core to rules only.
- 2026-11-20 (backlog agent): Triage: new PRD agent-tooling (what agents load and how the tooling runs). Docs only, but AGENTS.md and docs/loops.md are edited by every landing, so run it when few PRDs are landing.
- 2026-11-20 (plan/agent-tooling): Planned: agent-tooling slices 3 (doc budget) and 4 (core plus docs/agents/ role docs; gated on no imminent landing).

### B-148 · chore · Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and…

- status: triaged
- prd: agent-tooling
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and carry slice and backlog history that git already holds.
- 2026-11-20 (backlog agent): Triage: agent-tooling. Docs only; timeline.md and medications.md first. Tasks folds into timeline.md at its landing, so trim after tasks lands.
- 2026-11-20 (plan/agent-tooling): Planned: agent-tooling slices 5 (components, sync, care-groups, medications) and 6 (timeline, app-shell, after tasks lands).

### B-149 · chore · Split the shared registries by area, each composed by a thin index, so concurrent PRDs stop…

- status: in-progress
- prd: code-layout
- owner: prd/code-layout
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Split the shared registries by area, each composed by a thin index, so concurrent PRDs stop conflicting on them. / The most-edited files in 30 days: scripts/loops/check-areas (69 commits), routes.ts (46), appUrls.ts (32), errors/constants.ts (28), db/schema/index.ts (26), permissions.ts, router.ts.
- 2026-11-20 (backlog agent): Triage: new PRD code-layout (structure refactors). Every running PRD adds to these registries (tasks and hosting both do now), so this must run alone on those files: after tasks and hosting wave 1 land, and before the next feature PRD starts. Replaces the 'additive edits' rule in AGENTS.md.
- 2026-11-20 (plan/code-layout): Planned (plan/code-layout): slices 1 (check-areas.d, most specific wins), 2 (errors, permissions, schema by area), 3 (API router by area), 5 (routes and appUrls by area). Pure refactor; one lean --suite at the last landing.

### B-150 · chore · Group apps/web/app/lib/ by domain: about 140 flat files named by prefix (`medication*`, `period*`,…

- status: in-progress
- prd: code-layout
- owner: prd/code-layout
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Group apps/web/app/lib/ by domain: about 140 flat files named by prefix (`medication*`, `period*`, `quickEntry*`). Folders let an agent read one area, and check-areas use one rule per folder.
- 2026-11-20 (backlog agent): Triage: code-layout. Moves about 140 files, so it conflicts with any PRD touching lib/: same window as B-149, and check-areas rules change with it (check-migration edits check-areas additively).
- 2026-11-20 (plan/code-layout): Planned (plan/code-layout): slice 4 groups lib/ into area folders + core/, device queries move in as <name>.sync.ts, lib/sync/ keeps plumbing only; direct imports, codemod, no shims; a layout guard test.

### B-151 · chore · Break up the browser checks by flow: 18,500 lines in all, medications.mjs alone 4,373.

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (backlog agent): Triage: check-migration is moving each area check to component tests (medications.mjs is B-118), which removes most of those lines; what stays is the lean set, ported to Playwright Test (B-129). Proposed: fold into that work, re-measure after it lands, and drop if nothing large remains.
- 2026-11-20 (prd/check-migration): check-migration orchestrator: agreed, no slice of its own; re-measure the browser-check lines after slice 23 (the CDP harness deleted) and close or drop it then.

### B-154 · chore · Batch the backlog commits: 714 of the last 30 days' commits are `chore(backlog)`, which buries the…

- status: ready
- prd: agent-tooling
- owner: prd/agent-tooling
- commit: a23e77c

- 2026-11-20 (Robert Bo Davis): From the inbox: Batch the backlog commits: 714 of the last 30 days' commits are `chore(backlog)`, which buries the history agents read.
- 2026-11-20 (backlog agent): Triage: agent-tooling. Changes scripts/backlog (one commit per command batch, or several ids and a note in one write). Stackless.
- 2026-11-20 (plan/agent-tooling): Planned: agent-tooling slices 1 (multi-id writes, guarded amend) and 2 (pnpm log).

### B-155 · chore · Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first…

- status: triaged
- prd: app-speed
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first chunk.
- 2026-11-20 (backlog agent): Triage: app-speed. A budget in the build check that keeps the editor and PowerSync out of the first chunk; it guards the gains of the other slices.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 4 (plans/app-speed-plan.md). pnpm build:budget (manifest reader + pure checker + budget.json), run by pnpm prd check.

### B-156 · chore · Check whether `loadSettings` in the timeline loader waits on the network before using its cache.

- status: triaged
- prd: app-speed
- owner:
- commit:

- 2026-11-20 (backlog agent): Triage: app-speed. An investigation first (does loadSettings wait on the network before using its cache?); a fix only if it does.
- 2026-11-20 (plan/app-speed): Planned: app-speed slice 1 (plans/app-speed-plan.md). Investigated: it does wait (me.get, after pending updatePreferences). Becomes cache-first with a background refresh that updates the open screen.

### B-157 · change · Simple mode's timeline has too much plain-text instruction: drop the quick-entry typing tips under…

- status: landed
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 03dfa05

- 2026-11-20 (Robert Bo Davis): From the inbox: Simple mode's timeline has too much plain-text instruction: drop the quick-entry typing tips under the big box, and the tiles hint ("These follow what's logged most. The group's owners can choose them."). / Tips: `QuickEntrySuggestions` (`data-quick-tips`) could take a `showTips` prop that `QuickEntryBox` turns off for `size="lg"`; the dictation hint stays. / Tiles: in `SimpleTiles.tsx`, show only the "Choose the tiles" link to those who can choose, and nothing to members. Update `timelineSimpleTiles.browser.test.tsx` (the hint text) and docs/domain/timeline.md (the first-run hint).
- 2026-11-20 (Robert Bo Davis): Triage (backlog agent): small copy and prop change in simple mode (QuickEntrySuggestions showTips, SimpleTiles hint), one component test and a timeline.md line. One quick-fixes slice, next to B-135 and B-134 (slice 46). Touches the simple view, which tasks slice 6 changed, so start it after tasks lands.

### B-158 · change · Rotating BETTER_AUTH_SECRET breaks sync: the jwt plugin's private key (jwks table) is encrypted with it, so rows must be deleted by hand; add a rotation tool or use BETTER_AUTH_SECRETS

- status: landed
- prd: hosting
- owner: prd/hosting
- commit: 5a67e22

- 2026-11-20 (prd/hosting): Found by hosting slice 6 (ops/runbook.md marks it a gap with an interim step). Proposed for hosting: needed before the first secret rotation, not for going live.
- 2026-11-20 (prd/hosting): The user chose to fix this before going live (2026-11-20): hosting slice 9.

### B-159 · change · Narrow personal db:access roles: staff_ roles get SELECT on every table, including account (password hashes), session, verification, jwks and sealed invite tokens

- status: landed
- prd: hosting
- owner: prd/hosting
- commit: 5a67e22

- 2026-11-20 (prd/hosting): Found by hosting slice 6; break-glass forbids querying them, but the grant allows it. Proposed for hosting: a small rolesSql/dbAccessService change (exclude the auth tables) before production access is used.
- 2026-11-20 (prd/hosting): The user chose to fix this before going live (2026-11-20): hosting slice 9.

### B-160 · change · Rotating SEED_USER_PASSWORD on staging doesn't change seeded accounts (seed uses onConflictDoNothing; @example.com can't get reset mail)

- status: landed
- prd: hosting
- owner: prd/hosting
- commit: 5a67e22

- 2026-11-20 (prd/hosting): Found by hosting slice 6; for now rotating means recreating staging's database (runbook). Proposed for hosting, low priority: the seed could update the seeded accounts' password on staging.
- 2026-11-20 (prd/hosting): The user chose to fix this before going live (2026-11-20): hosting slice 9.

### B-161 · bug · sign-in.mjs flaked once in the lean suite at load 88: 'during the redirect the button is disabled and shows Signing in…' saw /app already ('Getting your care groups…')

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (prd/check-migration): check-migration wave 4 suite, 2026-11-20 08:54, load 51→88; passed on the automatic retry (.loops/.browser-flakes.log). The redirect outran the assertion under load; slice 19's Playwright port may make the wait robust.
- 2026-11-20 (prd/check-migration): Proposed for check-migration: sign-in is a lean session check that slice 20 ports to Playwright; fix the flaky redirect assertion there. -- check-migration orchestrator

### B-162 · change · In simple mode, Reorder so that "What happend" is directly above the timeline, basically like the…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (prd/hosting): From the inbox: In simple mode, Reorder so that "What happend" is directly above the timeline, basically like the full layout. Replace "Now" heading with "Upcoming". Reduce size of quick action buttons so that they are one row with smaller buttons so they are one row."Tap the microphone on your keyboard to say it instead of typing." should only appear on devices that support voice input via keyboard (ios/andriod?). All text is too large and should be reduced in size. Assume users that can't see well will have there devices set to larger text, or zoom their browsers.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-163 · change · "Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (prd/hosting): From the inbox: "Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas separate entries; start with “n:” for a note." should be a tooltip.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-164 · change · "day/date" heder for full timeline is too small compared to the + button. Make text larger.

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-165 · change · Move "author" tile below hamburger menu on timeline entries, it takes up valuable text space.

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-166 · change · Using back to timeline from timeline live-note entry (or any browse action) takes you back to the…

- status: triaged
- prd: app-speed
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Using back to timeline from timeline live-note entry (or any browse action) takes you back to the timeline, causes all lazy loaded header elements to reload. Can we cache their state with a visual indicator (maybe greyed out) and load in the background so that it doesn't cause page shift? Maybe keep a placeholder in the header so that it doesn't cause a flash on load any time?
- 2026-11-20 (Robert Bo Davis): Triaged to app-speed: header elements reloading on back-navigation is a caching/navigation-speed issue, next to B-136/B-137.

### B-167 · change · Make day summary part of sticky header so it is always visible when scrolling up the timeline.

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-168 · change · timeline group titles that are too long wrap to multiple lines on small screens. Truncate the…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: timeline group titles that are too long wrap to multiple lines on small screens. Truncate the provider on small screens.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-169 · change · vitals, upcoming, medication due, and todo overdue can be combined into a single tile that is…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: vitals, upcoming, medication due, and todo overdue can be combined into a single tile that is collapsible. They should all have a right side link to the full view that is formatted similarly.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-170 · change · When creating a new timeline entry for a note or event, we should navigate to edit page on save so…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: When creating a new timeline entry for a note or event, we should navigate to edit page on save so the user can add more info to the live document immediately without an extra tap.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-171 · change · your recent lines should exclude notes and events. vitals should only show the vital key, not the…

- status: triaged
- prd: timeline-ux
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: your recent lines should exclude notes and events. vitals should only show the vital key, not the value so that the user can log those quickly without deleting the value.
- 2026-11-20 (Robert Bo Davis): Triaged to new timeline-ux PRD (user's choice): timeline and simple-mode UI changes, grouped so one PRD owns the timeline header and rows.

### B-172 · bug · app-shell.mjs's detailsGone and detailsBack checks always pass: cdp waitFor on a promise.then(...) expression is always truthy

- status: triaged
- prd: check-migration
- owner:
- commit:

- 2026-11-20 (prd/check-migration): Found by slice 16 (2026-11-20). Proposed for check-migration: count in node with M.evaluate, as slice 16's member-share fold does; Playwright's port (slice 21/22) can fix it too. Grep other checks for waitFor(`${...}.then(` too. -- check-migration orchestrator
