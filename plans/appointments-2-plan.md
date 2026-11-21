# Plan: Appointments 2

> Source PRD: [`plans/appointments-2-prd.md`](appointments-2-prd.md). User-story numbers (US) refer to it. Backlog items B-60 (series), B-61 (reminders), B-62 (iCal feed), B-63 (Google Calendar). Topic `appointments-2`.

## Status

| Slice | Wave | State           | Merge into `prd/appointments-2` (slice commits) |
| ----- | ---- | --------------- | ----------------------------------------------- |
| 1     | 1    | merged (opus)   | a589f8fa (716e20cd, 2b37171b)                   |
| 2     | 2    | merged (opus)   | 20b816d5 (0b254449, 3990c7ec)                   |
| 3     | 2    | merged (sonnet) | 8b41d9c8 (da53f874, 160c7ee3)                   |
| 4     | 2    | merged (opus)   | 9f79243e (f2073aaa, 537c6236)                   |
| 5     | 3    | merged (sonnet) | 6e343bd8 (6c228c9c)                             |
| 6     | 3    | merged (opus)   | 4d8f9364 (24b03329)                             |
| 7     | 3    | merged (opus)   | ca95085a (b5ea3fef, 91cdc5f2)                   |
| 8     | 4    | merged (sonnet) | edfcedf0 (0f814ca5)                             |
| 9     | 4    | merged (opus)   | 1cf45362 (7284a2d4, db846edf)                   |
| 10    | 4    | merged (opus)   | f1cc1dbc (4bdf82e8)                             |

**Landing mode (2026-11-20): run everything through** (queued with `pnpm prd queue`): start every ready slice, land each green wave, clean up; ask only real questions. Per this plan's _Landing_, landing waits until every slice is merged.

**Log:** 2026-11-20: start condition met (B-169 live, 127670af in `prd/appointments-2`). Backlog ingest: B-188–B-190 (connectors bugs), none for this PRD. Slice 1 worktree made, agent spawned (opus).

Slice 1 merged as a589f8fa; worktree removed. Wave 2 (slices 2, 3, 4) worktrees made, agents spawned.

**Synced** dev into prd/appointments-2 as 230722a0 (TodayCard import conflict resolved in code: the landing check must be full). Was: quick-fixes wave 13 landed in dev (bf0891df): rewrites TimelineFilters, the Today card (TodayCard/TodayRow/todayStatus/useTodayCard*) and phase2.spec.mjs; no migration. `pnpm prd sync` after wave 2 merges; expect a conflict on slice 1's RepeatMark in the Today card (keep it as one added element).

Slices 2 and 3 merged (20b816d5, 8b41d9c8); worktrees removed. Slice 10 is now unblocked: start it after slice 4 merges and the pending sync (it needs `dev`'s harness).

Slice 4 merged (9f79243e); wave 2 done. Next: sync dev, then wave 3 (5, 6, 7) and slice 10.

Wave 3 (5, 6, 7) and slice 10 (ready since slice 2) worktrees made, agents spawned; B-61, B-62, B-63 claimed. Load was 59 at start.

Slice 5 merged (6e343bd8); B-62 done (ready).

**Open issue (not ours):** `packages/api/src/connectors/mcpWrites.int.test.ts` "log vitals, a symptom, a dose and a pass's Given all" fails by time of day: in the evening, its Metformin dose a minute earlier fills the Evening pass, so `give_pass` says "Nothing is left to give in Evening today". No connectors diff on this branch. It will fail `pnpm prd check` in the evening; filed as B-206, a duplicate of B-205; quick-fixes slice 58 fixes it (test-only) and its orchestrator messages us when it lands in dev. Also known on dev: `timelineSimpleTiles.browser.test.tsx` "all four share one row at phone width" fails every run since hotfix/design (76375c07); fixed on prd/quick-fixes (5d1c76b0), lands with its wave 14. Sync both before the landing check, or treat those two as known.

Slice 6 merged (4d8f9364; registry conflicts with slice 5 resolved by keeping both, frozen-list tests pass). Slice 8 now waits only on itself: start it.

Slice 7 merged (ca95085a; 12 additive conflicts with 5 and 6 resolved, incl. `linkToken.ts` = seal.ts + `createHmac` for `linkSubkey`, cron test expects [reminders, googlePush, seriesTopUp], routes.test.ts re-sorted). Wave 3 done. Slice 9 started. Slice 10 handed off; held for plan order (worktree `.loops/appointments-2-10` with a stack).

**All 10 slices merged** (9: 1cf45362, 10: f1cc1dbc); worktrees removed; B-60, B-61, B-62, B-63 done (ready). Next: sync dev, datastore reset, full `pnpm prd check`, serve, browser checks (whole lean set: ask the user before `--suite`), ready, land, fold docs, `pnpm prd rm appointments-2`.

**Carried from slice 9's hand-off:** `interpretGoogleChange` in `packages/data/src/google/pullPlan.ts` takes `now` and `timeZone` too; only times come back from Google (title, place, description ignored); viewers get `overwrite` (a viewer's new event is removed by the next push via a `google:<eventId>` placeholder link); a started series visit gets `overwrite` (`pastVisit`). `calendarPullService` (`pullConnection`, `pullDue` with SKIP LOCKED; `lastPulledAt` now means "last pull started"); overwrite clears `pushedHash` and queues `enqueue(..., "daily")`; a passing failure keeps the sync token; cancel reason "Deleted in Google Calendar". Cron order `[reminders, googlePush, googlePull, seriesTopUp]`. Smoke script `packages/data/scripts/googleSmoke.ts` (`pnpm calendar:google-smoke`, `--keep`, `--disconnect`), not run against Google. Runbook 5a.5, 5a.6 and the Vercel cron sentence done. Docs: calendars.md (pull, rules, overwrite, token, smoke); notifications.md (`googlePull`); layout.md (`packages/data/scripts/googleSmoke.ts`).

**Pending sync:** quick-fixes wave 14 in dev (fa9ad005): fixes B-205/B-206 (mcpWrites) and the stale `timelineSimpleTiles` test; touches DayHeader, SimpleNow/SimpleTimeline, useTimelineData. Sync after wave 4 merges, before the landing check.

Slice 8 merged (edfcedf0); B-61 done.

**Question for the user at landing (product):** "Also remind me" from a member whose reminder emails are off sends nothing (the planner only sends to members with reminders on); the sheet says so and points to Calendar & reminders. PRD doesn't settle it; kept as is unless the user wants extras to send anyway.

**Carried from slice 8's hand-off:** `reminderOverrideService` (`get`, `set` with `default` deleting the row, `mute`, `extra`); errors `reminderOverrideService:notFound` (404), `:invalid` (400); `calendars.overrides.get|set` in `overrideProcedures.ts`; "Remind me" before Print in `entryActionItems` for upcoming, uncancelled, unmoved events and notes, every role; `RemindMeSheet`, `useRemindMe` (`components/entry/`); `lib/calendars/remindMe.ts` (`canRemind`, `remindSummary`; summary lists lead labels, doesn't drop passed ones). The timeline list holds only past or started entries, so its wiring has no component test. Browser check to run at landing: roundtrip. Docs: calendars.md (service, procedures, item, sheet, reminders-off behaviour); api.md (procedures); components.md tests line (`upcoming/upcomingRemind.browser.test.tsx`); data-layer.md (service).

**Question for the user at landing:** the lean budget. Slice 10's series step adds ~0.9–1.4 s to `roundtrip`; the lean set already sums to exactly the 255 s ceiling, so it'd be 256–257 s. `roundtrip` stays 28 in `scripts/loops/checks` until the landing suite's median; raising the ceiling is the user's call.

**Carried from slice 10's hand-off:** the step is in `roundtrip.spec.mjs`, inside step 5's offline window; drives `series.createSeries` and `series.applySeriesEdit` (scope later on the 3rd visit); logs `series: its steps added N ms`. `apps/web/app/lib/sync/index.ts` gains `series` in `caretookModules` (check builds only). Browser checks it ran: roundtrip, live-notes, first-sync pass. Load flakes seen: `entryRepeat.browser.test.tsx` offline series, `medicationList.browser.test.tsx` Discontinued chip (3/3 alone). Docs: appointments.md tests line (roundtrip covers series); loop.md (roundtrip gains "a series and its split"); wherever `caretookModules` is documented.

**Carried from slice 7's hand-off:** migration `0027_worried_typhoid_mary.sql` (drizzle's name; no hand edits): `google_calendar_connection`, `google_event_link`, `calendar_sync_job`, `google_oauth_state` (a 4th table for state + sealed PKCE). `packages/data/src/google/` (`client.ts`, `real.ts`, `fake.ts` with `user.move/delete/create`, `revokeAccess`, `expireSyncTokens`, `failCalls`; `pushPlan.ts`; `getGoogleCalendarClient`). `googleConnectionService`, `calendarSyncService` (`runDue` with SKIP LOCKED and outbox backoff, `sweep` also queues a daily push). `withTransaction` gains `afterCommit`; `utils/seal.ts`. Scope `calendar.app.created` confirmed (2026-11-20). Cancelled appointments stay visible in Google as "Cancelled: …", free. Provider link changes don't queue a push (daily push catches them). Account deletion doesn't revoke at Google (no deletion flow yet). For slice 9: `listChanges` → `{ events, syncToken }` or `{ fullSyncRequired: true }`; our uid and status in `privateProperties` (`caretookUid`, `caretookStatus`); `eventUid(event)` null for Google-made; `connection.syncToken`, `lastPulledAt` unused yet; its cron step goes after `googlePush`. Smoke test not run against Google. Runbook's Vercel step 5 cron sentence still says "series top-up so far": fix at landing. Docs: calendars.md (client seam, scope, tables, services, push rules, card, `?google=` outcomes); data-layer.md (`afterCommit`, `seal.ts`, personal-access exclusions, 0000–0027); care-groups.md (removal disconnects Google, 4 permission rows); api.md (`calendars.google.*`, the two handlers); notifications.md (`googlePush` step); security-headers.md (Connect is a GET link; no CSP change); layout.md (`packages/data/src/google/`, `routes/api/google/`); runbook (done, except the cron sentence); AGENTS.md stack (the two Google packages).

**Carried from slice 6's hand-off:** `planReminders` in `db/schema/calendars/reminderPlan.ts` (honours overrides already; `reminderLeadLabel`, `reminderSendAt`, `TASK_LEADS` for slice 8's summary). **Deviations:** lookahead 48 h, not 25 h (an evening-before send can be ~31 h ahead); members use the recipient's zone (no member zone exists); task reminders need the assignee's reminders on. `sweepReminders` is the cron's first step, one transaction, `calendars.lastReminderRunAt` locked in `app_setting`. Unsubscribe token HMAC under `linkSubkey(purpose)` of `INVITE_LINK_KEY` (sweep returns `noKey` without it); route `api/reminders/unsubscribe/:token`, GET asks, POST acts. Definitions gain optional `headers` (outbox builds them at send; Resend passes them). Browser checks to run at landing: layout-offline, first-sync. Docs: calendars.md (reminders, sweep, `calendarReminderService`, unsubscribe, card, `reminderChoices.ts`); notifications.md (two notifications, `headers`, `List-Unsubscribe`); care-groups.md (`linkSubkey`); layout.md (`routes/api/reminders/unsubscribe.ts`); components.md tests line (`settings/calendarReminders.browser.test.tsx`).

**Carried from slice 5's hand-off:** `ical-generator` 11.1.4 in `packages/api`. `calendarFeedService` (`create` refuses a second feed, 409; `rotate`, `revoke`, `resolve`, `load`); `renderIcs` in `packages/api/src/calendars/renderIcs.ts` with golden files; `GET /api/calendar/:file` (handler `packages/api/src/calendars/feed.ts`, door `.server/calendarFeed.ts`; 404 bodyless, 405, rate limits 60/min/IP and 30/min/token keyed by hash); `calendars.feed.*` in `feedProcedures.ts`; `FeedCard` + `feedActions.ts` (intents `feedCreate`, `feedRotate`, `feedRevoke`); `lib/calendars/feedLinks.ts`. Feed URL from `APP_URL`. Frozen lists `routes.test.ts`, `routerPaths.test.ts` likely conflict with 6 and 7. Docs: calendars.md (service, renderIcs, route, procedures, card); AGENTS.md stack (`ical-generator`); api.md (route, procedures); care-groups.md (removal revokes the feed, tested); security-headers.md (web layout middleware, no CSP change); layout.md (`routes/api/calendar/feed.ts`, `.server/calendarFeed.ts`).

**Carried from slice 4's hand-off:** migration `0026_calendar_settings.sql` (no hand edits). **Deviation:** `care_group.details_outside_allowed` is synced (care_group stream + device schema; `rolesSql.test` refuses a partly synced table) so the owners' switch shows offline and live; PowerSync needs a restart. Settings page `routes/app/groups/settings/calendar/` with card files `RemindersCard`, `FeedCard`, `GoogleCard` (not on native), `DetailsCard`; cards take `CalendarCardProps`, posts go through `CARD_ACTIONS` (`cardActions.ts`) by `intent`; `useCalendarSave`/`CalendarSaveLine` for own settings. Item uids `entry:<id>`/`task:<id>`; notes count as reminders when a series visit or created before due; default lengths 60 min (appointment), 30 (reminder, timed task). Slice 7 enqueues its Google job in `calendarSettingService.update` and `setDetailsAllowed`. Stub `docs/domain/calendars.md` exists (libLayout.test needs it). Docs: calendars.md (replace stub) + Area index; care-groups.md (column, removal clears rows, permission rows); app-shell.md (subpage, owners' card on Details); sync.md (care_group column); data-layer.md (0000–0026, feed hash in personal-access exclusions).

**Carried from slice 2's hand-off:** `@caretook/data/series` now points at `appointments/series.ts` (re-exports `seriesVisits`, `seriesEdit`), so `--changed` names the whole lean set: run `--suite` at landing only after asking the user. "This and later" takes time of day and length only (a day change goes through the rule); not offered on a started visit; the series sheet doesn't edit providers. A split uploads: new series PUT, old series PATCH, entry PATCHes, entry DELETEs, then new visit PUTs (for slice 10). New error `timelineEntryService:pastVisit` (409). `ui/useShowModal` extracted from ConfirmDialog. Docs: appointments.md (`planSeriesEdit` scope rules, `applySeriesEdit`, `updateEntry` `{ detach }`, cancel/reschedule detach, `SeriesScopeDialog`/`useSeriesScope`, `editSeries` item, `SeriesEditSheet`, entry page asks on title/time/place, `ONLY_THIS_VISIT_STATE`); components.md (`ui/useShowModal`); tests line (`upcoming/upcomingSeries.browser.test.tsx`). `timelineSimpleNow` flake seen again (load 57), 3/3 alone.

**Carried from slice 3's hand-off:** steps go in `CALENDAR_STEPS` (`packages/notifications/src/calendarCron.ts`) before `seriesTopUp`; a returned error value counts as a failure. topUp starts at max(topped_up_through + 1, today in zone) and passes over failing series. Browser checks to run at landing: layout-offline, sign-in, first-sync, marketing. Its last fix ran related tests only (load 19), so the landing check must be full. Docs: appointments.md (topUp), notifications.md (`/api/cron/calendar`, `calendarCron.ts`, two crons), api.md (`cron-locked` covers both), layout.md (`routes/api/cron/calendar.ts`). Flake seen: `timelineSimpleNow.browser.test.tsx` "no Upcoming heading", 3/3 alone.

**Carried from slice 1's hand-off:**

- Migration `0025_appointment_series.sql` has two hand edits to keep on regenerate: FK `ON DELETE SET NULL ("series_id")`, and `ALTER PUBLICATION powersync ADD TABLE appointment_series` at the end.
- rrule lives only in `packages/data/src/db/schema/appointments/seriesVisits.ts`, exported as `@caretook/data/series` (not the schema index); `budget.json` forbids rrule in first load.
- The server writes visits only for a series without `toppedUpThrough`; the first visit keeps the draft's id (not v5), so top-up must skip by `(series_id, series_day)`.
- Edits after creation touch one visit only (title, time chip) — slice 2's job.
- Flake seen under load: `layout/staff.browser.test.tsx` (offline cached banner), passed 3/3 alone.
- Docs to fold at landing: appointments.md (table, columns, visit ids, seriesVisits, repeatText, device writes + draft adoption, RepeatField, RepeatMark, seeds, `@caretook/data/series`); sync.md (stream, device schema, op, matrix row); care-groups.md (permission row); data-layer.md (`/series` entry); components.md (`repeat/`, `RepeatMark`); AGENTS.md stack line (rrule 2.8.1).

**Start condition:** `timeline-ux` slice 5 (the Today card, B-169) in `dev`, since slice 1 puts the repeat mark there. Check `pnpm backlog show B-169` says landed. If it isn't, slice 1 may start and leave the Today card's mark to whichever slice runs after it lands (say so in the hand-off).

**Landing:** this PRD adds migrations (slices 1, 4 and 7) and a synced table, so hold landing until every slice is merged, then run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking the user first.

**Backlog:** claim each slice's items when it starts, and run `done` after the last slice that covers each item merges:

- B-60: slices 1, 2, 3, 10 (`done` after the last of them)
- B-62: slice 5
- B-61: slices 6, 8 (`done` after 8)
- B-63: slices 7, 9 (`done` after 9)

**New dependencies (approved by the user, 2026-11-20; pin exactly, nothing else without asking):** `rrule` 2.8.1 (slice 1; client and server), `ical-generator` 11.1.4 (slice 5; server), `@googleapis/calendar` 20.2.0 and `google-auth-library` 11.3.4 (slice 7; server).

Fold into the area docs at each landing (only rules and pointers into AGENTS.md itself):

- **Slice 1:** series in `docs/domain/appointments.md` (the table, the entry columns, visit ids, `seriesVisits`, `repeatText`, the device writes, `RepeatField`, the mark, seeds); `appointment_series` in `sync.md` (stream, device schema, upload op, matrix row); the permission row in `care-groups.md`; `rrule` in AGENTS.md's stack line.
- **Slice 2:** `planSeriesEdit` and `SeriesScopeDialog` in `appointments.md`.
- **Slice 3:** `/api/cron/calendar` and top-up in `appointments.md` and `notifications.md` (the cron list), and `vercel.json` crons in the runbook.
- **Slice 4:** a new `docs/domain/calendars.md` (`calendarItems`, `shareLevel`, `calendarText`, the settings tables, the page, the owner switch, consent) and its _Area index_ entry; the owner switch in `care-groups.md`; the route in `app-shell.md`.
- **Slice 5:** the feed in `calendars.md`; `ical-generator` in AGENTS.md's stack line.
- **Slice 6:** reminders in `calendars.md`; the two notifications in `notifications.md`.
- **Slice 7:** Google (client, connection, push, env) in `calendars.md`; `GOOGLE_*` in the runbook; the two Google packages in AGENTS.md's stack line.
- **Slice 8:** the override in `calendars.md`.
- **Slice 9:** pull, `interpretGoogleChange` and the smoke script in `calendars.md` and the runbook.
- **Slice 10:** the roundtrip step in `docs/agents/loop.md`'s check list, only if the lean set's list of flows changes.

## Architectural decisions

- **Areas:** series are **appointments** (`db/schema/appointments/`, `lib/appointments/`, the appointment and reminder sheets). Calendar items, sharing settings, the feed, reminder planning and Google are a new **`calendars`** area, created by slice 4: schema, errors, permissions, `packages/api/src/calendars/`, `lib/calendars/`, its `check-areas.d` rule. Reminder emails are `@caretook/notifications` templates.
- **`appointment_series`** (synced; slice 1's migration) has these columns:
  - `id`, `group_id`, `recipient_id` (composite FK), `kind` (`event` | `note`);
  - `rule`: RRULE text with FREQ DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY (with an ordinal for monthly), BYMONTHDAY, COUNT or UNTIL;
  - `starts_on` (local date), `start_time` (`HH:MM`, null when all-day), `all_day`, `time_zone`;
  - the template: `title`, `duration_minutes`, `place`, `provider_ids` (jsonb, checked in the group);
  - `topped_up_through` (local date), soft `deleted_at`, timestamps and audits.

  It's in the `care_groups` stream, the device schema, the upload switch and the sync matrix.

- **`timeline_entry` gains `series_id`** (composite FK, `SET NULL` on a hard delete, hand-edited like `rescheduled_to`), **`series_day`** (local date) and **`series_detached`** (bool, default false), with a unique `(series_id, series_day)` among live rows. Only notes and events take them (`entryTiming`'s refusal pattern). These are in the same migration.
- **Visits are ordinary entries** with ids UUID v5 of (series id, series day). The device writes 90 days of visits when a series is made, and the server tops up daily. Past visits are never rewritten. The scopes are only this visit (detach) and this and later (split).
- **One projection:** `calendarItems` → `CalendarItem { uid, kind, start, end | allDay span, status, title, place, providers, series, appUrl }`, with the window from 90 days back to 90 days ahead. The feed, reminders and Google all read it, through `shareLevel` and `calendarText`. **Generic by default:** "Appointment for Pat", "Reminder for Pat" or "Task for Pat" plus the time and a link. Details need the member's recorded consent and the owners' allowance, and live-note content never leaves.
- **Server-only tables (not synced; read and written through `calendars.*` oRPC procedures):**
  - `member_calendar_setting` and `reminder_override` (slice 4's migration), and `care_group.details_outside_allowed` (bool, default true);
  - `google_calendar_connection`, `google_event_link` and `calendar_sync_job` (slice 7's migration).

  Membership removal deletes a member's settings, overrides and feed, and disconnects Google, in its transaction.

- **Routes:**
  - `groups/:groupId/settings/calendar` (`appUrls.calendarSettings`; a shared route with `clientLoader`, online only), with four cards in this order: Reminders, Calendar feed, Google Calendar, Details outside Caretook. Slice 4 makes each card a region, and later slices fill their own.
  - Web only: `GET /api/calendar/:token.ics`, `/api/google/connect`, `/api/google/callback`, and `/api/cron/calendar` (behind `CRON_SECRET`, every minute in `vercel.json`).
- **The calendar cron** (slice 3) runs isolated, bounded steps in a fixed order: reminders (6), Google push (7), Google pull (9), series top-up (3). Each slice appends its step. A step's failure is logged and never stops the next.
- **Idempotency everywhere:** visit ids are deterministic; reminder keys are (recipient, item uid, lead, start); Google pushes diff by a content hash per `google_event_link`; jobs use the outbox's claim and backoff.
- **Secrets:** feed tokens are stored only as SHA-256 hashes. Google refresh tokens are sealed with AES-256-GCM under `GOOGLE_TOKEN_KEY`, with the connection id as associated data (the `linkToken` pattern) and a fixed dev key in dev and tests. Neither is ever logged.
- **Registries take additive entries at the end of their group:** the schema index, `PERMISSIONS`, `sync-config.yaml`, the device schema, the upload switch, the sync matrix, `NOTIFICATIONS`, the `calendars` and appointments `routes.ts` and `urls.ts` parts, the router's area part, and `check-areas.d`.

## How to run this plan

- **Wave 1: slice 1** (the tracer bullet: series end to end; it owns the series migration and every series registry entry).
- **Wave 2: slices 2, 3, 4.**
  - Slice 2 owns series edits and the scope dialog (the entry page's ⋯ and the sheets).
  - Slice 3 owns `/api/cron/calendar` and top-up.
  - Slice 4 owns the `calendars` area, its migration and the settings page.
  - No two of them share a file except additive registry lines.
- **Wave 3: slices 5, 6, 7.**
  - Each fills its own card on the settings page.
  - Slices 6 and 7 each append a step to the cron handler (6 before 7; additive).
  - Slice 7 adds the PRD's last migration.
  - Slice 6 adds two `NOTIFICATIONS` entries.
- **Wave 4: slices 8, 9, 10.**
  - Slice 8 owns the "Remind me" sheet on the ⋯ menus.
  - Slice 9 owns Google pull (and appends its cron step).
  - Slice 10 owns the `roundtrip` step.
- Merge in number order within a wave, with no checks between merges.
- **Migrations:** slices 1, 4 and 7 each add one (say "adds a migration"; it takes the next number when it lands). When a later one merges into `prd/appointments-2`, regenerate it on top of the earlier ones (`pnpm datastore:generate`) and reread the SQL order. Keep the hand-edited `series_id` FK.
- **Stacks:** only slices 1 (seeds on a fresh device, the matrix row) and 10 (`roundtrip`) need one. The others are stackless: integration tests on the shared test Postgres, component tests on the test device. A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing.
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/appointments-2`. Only slice 10 adds an end-to-end step. Every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **The bundle budget** (timeline-ux, B-155): `rrule` must not enter the first-load bundle. Slice 1 loads the series module through a dynamic import from the sheets and the series writes, and the build check proves it.
- **Running beside other PRDs:**
  - `timeline-ux`: hot on the Today card, the row components, `DayHeader` and the timeline route. Only slice 1 touches them (the repeat mark, one line per row component). Sync `dev` before slice 1 and keep the edit to a single added element.
  - `check-migration`: B-129 ports the lean set (`roundtrip` included) to Playwright Test. Slice 10 writes its step in whichever harness `dev` has when it starts; sync first. `check-areas.d` edits are additive.
  - `agent-tooling`: trims `appointments.md`; fold into whatever `dev` has at landing.
  - Others: no overlap.
- **External setup is the user's:** the Google Cloud project, the OAuth consent screen (test users until verified), and the `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_TOKEN_KEY` values on staging and production. Slices 7 and 9 build and test against the fake, and the smoke script needs those values.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: Repeating appointments end to end

Stack: yes · Reads: docs/domain/appointments.md, docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/components.md, docs/domain/timeline.md, docs/domain/care-groups.md, docs/layout.md · Tests: unit, integration, component

**User stories:** 1–9, 18, 19, 21.

**What to build:**

- **The migration:** `appointment_series` and the three `timeline_entry` columns with the unique `(series_id, series_day)`, the hand-edited FK, and the publication. Also `PERMISSIONS.appointmentSeries` (read any member; create, update and delete writers, delete being soft) and the schema exports.
- **Pure, client-safe** (appointments area): `seriesVisits(series, from, to)` over `rrule` 2.8.1, expanded in floating wall-clock time and placed in the zone with the zoned-day helpers; `seriesVisitId(seriesId, day)` (UUID v5); `repeatText(series)`; the series create schema and its cross-field rules (weekly needs weekdays; monthly by date or nth weekday; COUNT or UNTIL, not both; a series only for notes and events). Kinds other than notes and events refuse the entry's series fields.
- **`appointmentSeriesService`** (`upsert`, idempotent on id; `getById`; `list`). Visits are written through `timelineEntryService` in the same transaction, the template's providers and recipient are checked in the group, and the upload op `appointmentSeriesOp` covers PUT, PATCH and soft DELETE, with `immutable` on a changed group, recipient or kind.
- **Sync:** the stream, device schema, upload switch and a `SYNC_MATRIX` row (with its unit test).
- **The device** (`lib/appointments/series.sync.ts`, loaded on demand): `createSeries` writes the series and every visit through today + 90 days in one local transaction, with provider links and empty documents. A `seriesQuery` serves the entry page.
- **Screens:**
  - **The sheets:** `RepeatField` in the appointment and reminder sheets when creating. It offers Doesn't repeat, Daily, Weekly, Monthly and Custom (every N days or weeks, weekdays, monthly by date or nth weekday) and Ends (never, on a date, after N), with a live preview of the repeat text and the next three visits. Saving a repeating item runs `createSeries` and opens the first visit.
  - **The mark and text:** the repeat text shows on a visit's entry page, and a lucide `Repeat` mark sits by the time on rows in Upcoming and the timeline and in the Today card.
  - **Viewers** see both, and get no actions.
- **Seeds** (`seeds/appointmentSeries.ts`, its own ids, by days ahead): a dialysis series for Dev Family (Mon, Wed, Fri 6:00, 4 h, no end, linked to a seeded provider), a 12-visit weekly PT series with one visit detached and moved, and a monthly "Order refills" reminder series on the 2nd Tuesday.
- **`check-areas.d`:** rules for the new modules and screens.

**Acceptance criteria:**

- [ ] Unit (`seriesVisits`): each pattern (daily or every N days, weekly on days or every N weeks, monthly by date and by nth weekday, including the 31st and the 5th weekday), COUNT and UNTIL (inclusive), a DST week in Los Angeles and in Europe/London, and a range starting mid-series.
- [ ] Unit (property): seeded random rules, zones and ranges (no new dependency) agree with rrule's own expansion of the same rule, and hold the invariants: sorted, inside the range, at most one per local day, COUNT respected.
- [ ] Unit: `repeatText` wording; the create schema's refusals; `seriesVisitId` stable.
- [ ] Integration (`appointmentSeriesService`): every role against `appointment_series`; idempotent create; a series and its visits from one upload batch; device-made visit ids accepted and repeated without duplicates; a provider from another group refused.
- [ ] Integration (upload): `appointmentSeriesOp` PUT, PATCH, DELETE, and `immutable`.
- [ ] Component: `RepeatField` and its preview; creating a weekly series offline shows its visits in Upcoming with the mark; a reminder series; the entry page's repeat text; a viewer sees no Repeat field.
- [ ] The build's bundle budget passes with `rrule` outside the first load.
- [ ] `pnpm datastore:reset` seeds the series; Upcoming shows them on a fresh device.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** none (the _Start condition_). **Blocks:** 2, 3, 4, 10.

---

## Slice 2: Editing a series (only this visit, this and later)

Stack: no · Reads: docs/domain/appointments.md, docs/domain/components.md, docs/domain/live-notes.md, docs/domain/tasks.md · Tests: unit, integration, component

**User stories:** 10–17.

**What to build:**

- **`planSeriesEdit({ series, visits, visit, scope, change, now })`** (pure) returns the series and entry writes for edit, cancel, reschedule and delete.
  - **Only this visit** changes the visit and detaches it.
  - **This and later** splits the series: the old one gets UNTIL the day before, and a new series starts at this visit. Each future, non-detached visit is moved in place onto the new series when its day is still in the rule. When its day isn't, it's soft-deleted, unless it has notes, tasks or a cancel, in which case it's detached and kept. Missing days are added.
  - Cancel or delete with "this and later" ends the series, and on the first visit soft-deletes it.
  - Rescheduling only this visit keeps today's rule (the old one cancelled) and detaches the new one.
  - Past visits are never in the writes.
- **The device:** `applySeriesEdit` runs a plan in one local transaction (with the existing cancel and reschedule writes for the single-visit cases).
- **The server:** `appointmentSeriesService.update` and `remove` accept a split's ops in one upload batch, and the service rejects writes to past visits through a series edit.
- **`SeriesScopeDialog`** (native `<dialog>`: Only this visit / This and later visits / Cancel) opens before Edit, Cancel, Reschedule and Delete on a series visit's ⋯, on the entry page, in Upcoming and on the timeline. "This and later" edits open the sheet with `RepeatField` prefilled.

**Acceptance criteria:**

- [ ] Unit (`planSeriesEdit`): both scopes for each action; a time change, a weekday change and a new end; detached and touched (notes, a linked task, cancelled) visits kept; past visits untouched; the first visit deleting the series.
- [ ] Integration: a split from one upload batch leaves the old series ended, the new one live and the moved visits keeping their ids and documents; a series edit touching a past visit is refused.
- [ ] Component: the dialog for each action and both choices; "only this visit" moves one visit and marks it detached; "this and later" changes later visits in Upcoming; cancelling the rest ends the series; viewers see no dialog.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 1. **Blocks:** 9, 10.

---

## Slice 3: The calendar cron and series top-up

Stack: no · Reads: docs/domain/notifications.md, docs/domain/appointments.md, ops/runbook.md · Tests: unit, integration

**User stories:** 20, 59.

**What to build:**

- **`/api/cron/calendar`** (web only, `CRON_SECRET` bearer like the outbox: 401 without it, 503 when unset), every minute in `vercel.json`. Its handler runs a list of named, bounded steps in order, each catching and logging its own failure, and returns each step's result.
- **The first step: series top-up.** `appointmentSeriesService.topUp(now)` covers each live series whose `topped_up_through` is before today + 90 days. It adds visits through that date with deterministic ids, skipping days that already have a live or deleted visit, and advances `topped_up_through`, in batches, idempotently.
- The deploy smoke check expects the new route's 401, and the runbook lists the cron.

**Acceptance criteria:**

- [ ] Integration (`topUp`): adds the missing days, skips existing and deleted ones, converges with device-made ids, a second run writes nothing, stops at UNTIL and COUNT, and ignores deleted series.
- [ ] Integration (handler): 401, 503, and a failing step doesn't stop the next.
- [ ] Unit: the step runner's ordering and isolation.
- [ ] `pnpm check` passes.

**Blocked by:** 1. **Blocks:** 6, 7.

---

## Slice 4: Calendar items, sharing and the settings page

Stack: no · Reads: docs/domain/appointments.md, docs/domain/tasks.md, docs/domain/care-groups.md, docs/domain/app-shell.md, docs/domain/api.md, docs/domain/data-layer.md, docs/domain/components.md, docs/layout.md · Tests: unit, integration, component

**User stories:** 52–54, 56, 57.

**What to build:**

- **The `calendars` area:** schema, errors, permissions, the API part, `lib/calendars/`, and a `check-areas.d` rule.
- **The migration:** `member_calendar_setting` (user, group, `details_consent_at`, `details_consent_version`, `reminders_on`, `reminder_leads`, `feed_token_hash`, `feed_rotated_at`), `reminder_override` (user, group, entry, `mode`, `leads`) and `care_group.details_outside_allowed`. All columns go in now, so slices 5, 6 and 8 add none.
- **Pure** (client-safe): `calendarItems` (the window; cancelled appointments kept; deleted items, done tasks and undated tasks left out; series visits flagged), `shareLevel`, and `calendarText` (generic and detailed wording; never live-note content).
- **Procedures** (`calendars.*`): `settings.get` and `settings.update` (own only; consent recorded with its version on, cleared off); the owners' `group.setDetailsAllowed`. Member removal and leaving delete the member's rows in the same transaction (`careGroupMemberService`).
- **Screens:**
  - **The page:** `groups/:groupId/settings/calendar` (`appUrls.calendarSettings`, linked from group settings for every role), with four card regions in order. Only Details outside Caretook is filled now: a consent switch with its explanation, disabled with a note when the owners forbid it. The other three show "Coming soon" placeholders until their slices.
  - **Group settings:** owners get a "Details outside Caretook" switch.
  - **Offline:** the page says it needs a connection, and a toggle made offline is sent later (the `saveSettings` pattern).

**Acceptance criteria:**

- [ ] Unit: `calendarItems` (each kind, the window edges, cancelled, done and undated tasks, all-day spans, zones); `shareLevel`; `calendarText` (generic text never contains a title, place, provider or note).
- [ ] Integration: settings own-only for every role; consent recorded and cleared; only owners set `details_outside_allowed`; removal and leaving clear the rows.
- [ ] Component: the page for a writer and a viewer; consent on and off; the owners' switch disabling the consent; offline then sent.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 1 (its migration lands on top of slice 1's). **Blocks:** 5, 6, 7.

---

## Slice 5: The iCal feed

Stack: no · Reads: docs/domain/api.md, docs/domain/security-headers.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: unit, integration, component

**User stories:** 34–40.

**What to build:**

- **`calendarFeedService`:**
  - `create` and `rotate` make a 32-byte random token, store its SHA-256 and return the URL once.
  - `revoke` drops it.
  - `resolve(token)` gives the member and group, or nothing for a revoked token or a former member.
- **`renderIcs(items, level, { calendarName })`** over `ical-generator` 11.1.4: timed items in UTC, all-day as DATE values, `STATUS:CANCELLED`, stable UIDs, one VEVENT per visit (no RRULE), and generic or detailed text from `calendarText`.
- **`GET /api/calendar/:token.ics`** (web only): `text/calendar`, `cache-control: private, max-age=300`, and a bodyless 404 for unknown tokens. It's rate-limited per token and IP, and the token never appears in logs.
- **The feed card:** create, Copy, Add to Apple (`webcal://`), Add to Google, Add to Outlook, Regenerate (with a confirm saying the old link stops working) and Revoke.

**Acceptance criteria:**

- [ ] Unit: `renderIcs` golden files (generic and details; all-day; cancelled; a series visit).
- [ ] Integration: tokens stored hashed and never returned again; rotate and revoke; a former member's token gets a 404; the route's headers, its rate limit and the window; consent off gives generic output.
- [ ] Component: the card (create, copy, links, regenerate confirm, revoke) for a writer and a viewer.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 4. **Blocks:** none.

---

## Slice 6: Reminder emails

Stack: no · Reads: docs/domain/notifications.md, docs/domain/tasks.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 22–27, 30–33.

**What to build:**

- **`planReminders({ items, settings, overrides, assignees, now, lastRun })`** (pure) returns the sends due in `(lastRun, now]`.
  - **Leads**, in the recipient's zone: `eveningBefore` (18:00 the day before), `morningOf` (7:00), and 120, 60 or 30 minutes. All-day items take only the first two, and a timed lead falls back to `eveningBefore`.
  - **Tasks** go to their member assignee, the morning of the due day or 1 h before a due time.
  - **Overrides** add extra leads or mute (honoured now, though their sheet is slice 8).
  - **Nothing is sent** for cancelled items, done tasks, sends already past when the item was made, or non-members.
  - **The key** is (recipient, item uid, lead, start).
- **Notifications:** `appointmentReminder` and `taskDue` are appended to `NOTIFICATIONS`. Each has generic or detailed text, the time in the recipient's zone, a link to the item, `List-Unsubscribe`, and a one-click unsubscribe link (a signed token over user and group) whose web-only route turns reminders off. Each names its channel (email) so push can come later.
- **The cron step** (appended before top-up): `sweepReminders(now)` reads now to now + 25 h for groups with reminders on, plans, and `notify`s each send. `last_reminder_run_at` is an app setting, catch-up is capped at 6 h, and older sends are dropped.
- **The Reminders card:** on or off and up to three leads (preset: evening before and 1 h before), with a line saying tasks reach their assignee.

**Acceptance criteria:**

- [ ] Unit (`planReminders`): each lead in two zones and over a DST change; all-day fallback; tasks with and without a time; an extra override and a mute; cancelled, moved (a new key), done; the 6 h cap.
- [ ] Integration (`sweepReminders`, memory sender): sends once over repeated runs; a moved visit sends again; generic text by default and details with consent; a suppressed address skipped; unsubscribe turns reminders off; a former member gets nothing.
- [ ] Unit: both templates render HTML and text with no health details in the generic form.
- [ ] Component: the Reminders card (on, leads, the three-lead cap, viewer).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 3, 4. **Blocks:** 8.

---

## Slice 7: Google Calendar: connect and push

Stack: no · Reads: docs/domain/notifications.md, docs/domain/auth.md, docs/domain/api.md, docs/domain/care-groups.md, docs/domain/security-headers.md, ops/runbook.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 41, 42, 49–51, 55, 58.

**What to build:**

- **`GoogleCalendarClient`** (`exchangeCode`, `refresh`, `revoke`, `createCalendar`, `upsertEvent` with our uid in private extended properties, `deleteEvent`, `listChanges`).
  - The real client is over `@googleapis/calendar` 20.2.0 and `google-auth-library` 11.3.4, with the narrowest scope that lets us create and manage our own calendar and list its changes. Confirm whether `calendar.app.created` does, and record it.
  - `fakeGoogleCalendar()` is in memory and can play a user editing in Google (for slice 9).
- **The migration:** `google_calendar_connection` (user, group, calendar id, sealed refresh token, sync token, last push and pull, last error, `disconnected_at`; one live per user and group), `google_event_link` (connection, item uid, Google id, etag, pushed hash) and `calendar_sync_job`.
- **`googleConnectionService`:**
  - **Connecting:** `start` stores state and PKCE for 10 minutes and returns the consent URL. `complete` seals the token (AES-256-GCM, `GOOGLE_TOKEN_KEY`, the connection id as associated data; production refuses without the key), creates "Caretook: <recipient>" and queues a full push.
  - **`disconnect`** revokes the token and deletes the sealed one, leaving the calendar.
  - **`status`** reports the connection's state and last error.
  - **Removal** and account deletion disconnect.
- **The routes:** `/api/google/connect` and `/api/google/callback` (web only), which redirect back to the settings page with a status. A CSP or redirect allowance only if one is needed.
- **Push:**
  - `timelineEntryService`, `taskService` and `appointmentSeriesService` enqueue a group job in their transaction when a calendar-visible item changes, and consent changes do the same.
  - Jobs are delivered after commit and swept by a cron step (appended after reminders) with the outbox's claim and backoff.
  - A run diffs each connection's `calendarItems` at its share level against `google_event_link` by hash. It upserts changed items, deletes those that left the window or were deleted, and marks cancelled ones cancelled.
  - A revoked or failing token records the error ("Reconnect Google").
- **The Google card** (web target only): Connect, or the calendar's name, last synced, any error, and Disconnect (confirm: "The calendar stays in Google but stops updating").
- **Env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_TOKEN_KEY`, documented in `.env.example` and the runbook (the Google Cloud setup is the user's).

**Acceptance criteria:**

- [ ] Unit: token sealing round trip, and a wrong id or key fails; the push diff (hash unchanged gives no call); state and PKCE expiry.
- [ ] Integration (against the fake): connect creates the calendar and pushes the window; an edited appointment is pushed once; a cancel is marked cancelled; a deleted task is removed; turning consent off rewrites the events to generic; disconnect revokes and stops pushing; a revoked token records the error; removal disconnects; the sealed token never appears in rows returned by the procedures.
- [ ] Integration: the callback's bad or expired state is refused.
- [ ] Component: the Google card (connect, status, error, disconnect confirm), and its absence on the native target.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 3, 4 (its migration lands on top of slice 4's). **Blocks:** 9.

---

## Slice 8: "Remind me" per appointment

Stack: no · Reads: docs/domain/appointments.md, docs/domain/components.md · Tests: integration, component

**User stories:** 28, 29.

**What to build:**

- **Procedures:** `calendars.overrides.get` and `calendars.overrides.set` (own only, for an event or note in the group).
- **The menu item:** "Remind me" in the ⋯ of an appointment or reminder (entry page, Upcoming, timeline; any member, online), placed before Print in `entryActionItems`.
- **The sheet** offers Use my settings, No reminders for this one, and Also remind me (lead choices), and shows what will be sent ("Evening before at 18:00 and 1 h before"). Offline, it says it needs a connection.

**Acceptance criteria:**

- [ ] Integration: own-only for every role; an entry in another group refused; a mute and an extra applied by `sweepReminders`.
- [ ] Component: the sheet for each choice, the summary line, the viewer, offline.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 6. **Blocks:** none.

---

## Slice 9: Google Calendar: pull and the smoke test

Stack: no · Reads: docs/domain/appointments.md, docs/domain/tasks.md, docs/domain/care-groups.md, ops/runbook.md · Tests: unit, integration

**User stories:** 43–48, 60.

**What to build:**

- **`interpretGoogleChange({ change, link, item, role })`** (pure) returns one action:
  - **Ignore** our echo (the etag or hash matches).
  - **An appointment:** a time change updates `occurred_at`, `ends_at` and `all_day` (on a series visit, an "only this visit" detach), and a delete cancels it.
  - **A reminder:** a time change updates its time, and a delete removes it.
  - **A task:** a time change updates its due day and time, and a delete completes it.
  - **A new event without our uid:** creates an appointment (Google's summary as the title, an empty document), then tags it, rewritten to generic when the member's level is generic.
  - **A change the member's role can't make:** overwrite.
- **The cron step** (appended after push): `listChanges` with the sync token every 5 minutes per connection. It re-lists on `fullSyncRequired`, and applies actions through the services as the connecting member (RBAC in SQL). An overwrite queues a push.
- **`pnpm calendar:google-smoke`** is a manual script, never in `pnpm check`. Against a real test account and the `GOOGLE_*` env it connects, pushes a seeded group, moves and deletes an event and creates one through the API, pulls, and checks Caretook. The runbook gets its staging steps.

**Acceptance criteria:**

- [ ] Unit (`interpretGoogleChange`): every action, for each role (owner, caretaker, viewer); echoes ignored; a series visit moved; an all-day change.
- [ ] Integration (against the fake): a move, a delete and a new event come back and are written as the member (audits name them); a viewer's move is overwritten on the next push; a deleted task is completed; a deleted reminder is removed; `fullSyncRequired` recovers; pulls run at most every 5 minutes.
- [ ] The smoke script runs with `--help` without credentials and is documented; the hand-off says it wasn't run against Google (or the user's result if they ran it).
- [ ] `pnpm check` passes.

**Blocked by:** 2, 7. **Blocks:** none.

---

## Slice 10: Series across devices (the roundtrip step)

Stack: yes · Reads: docs/agents/loop.md, docs/domain/sync.md, docs/domain/appointments.md · Tests: e2e:roundtrip

**User stories:** 18, 19.

**What to build:**

- One `roundtrip` step, in whichever harness `dev` has (CDP or Playwright, per check-migration): device A goes offline and creates a weekly series. On reconnect, the server holds the series and its visits, and device B shows them in Upcoming with the mark. Then A makes a "this and later" time change, which reaches B as the split (the old series ended, later visits moved, ids kept). Tagged rows, cleaned up.
- `roundtrip`'s usual seconds are updated, and the lean ceiling holds.

**Acceptance criteria:**

- [ ] `pnpm prd browser roundtrip` passes with the new step; its lines in the hand-off.
- [ ] The lean budget still fits (or the hand-off says by how much it doesn't, for the user).
- [ ] `pnpm check` passes.

**Blocked by:** 2. **Blocks:** none.
