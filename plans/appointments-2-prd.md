# Appointments 2 PRD (B-60, B-61, B-62, B-63)

Status: done (2026-11-20): all ten slices landed in `dev`; decisions in [`docs/domain/appointments.md`](../docs/domain/appointments.md) and [`docs/domain/calendars.md`](../docs/domain/calendars.md). Plan: [`appointments-2-plan.md`](appointments-2-plan.md). Follows the [appointments PRD](appointments-prd.md) (B-47, done), whose rules stay: a future event is an appointment, a future note a reminder, and "upcoming" is worked out, never stored.

## Problem Statement

Care runs on repeats and on remembering. Dialysis is Monday, Wednesday and Friday at 6:00; PT is every Tuesday; the infusion is every four weeks; refills are ordered every 28 days. Today a caretaker types each one in by hand, one at a time, and next month does it again. Then nobody gets told: an appointment sits in Caretook until someone opens the app, so the 7:00 fasting lab is missed by the sibling who was driving, and the assignee forgets the task due today. Caretakers also live in their own calendars (Google, Apple, Outlook) at work, where Caretook's appointments don't appear. So they copy them by hand, the copies drift when a visit moves, and a change made in their calendar never reaches the rest of the group.

## Solution

Four pieces built on one shared projection of a group's calendar:

- **Repeating appointments and reminders (series).** "Repeat" in the appointment and reminder sheets: daily or every N days, weekly on chosen days or every N weeks, monthly on a date or the nth weekday; ending on a date, after N visits, or never. Each visit is a real, ordinary appointment (its own live notes, providers, cancel, reschedule and tasks), written 90 days ahead and topped up daily. Editing, cancelling, rescheduling or deleting a visit asks **Only this visit** or **This and later visits**. Past visits are never rewritten.
- **Reminder emails.** Each member can turn on reminders per group and pick up to three lead times: the evening before at 18:00, the morning of at 7:00, or 2 h, 1 h or 30 min before. The preset is the evening before and 1 h before. They cover appointments and reminders. A task's assignee gets one the morning of its due day, or 1 h before its due time. On any appointment a member can say "Remind me … for this one" or "No reminders for this one", for themself only. Push waits for Capacitor: the planner names its channel, so push slots in later.
- **An iCal feed.** Each member gets a secret, revocable feed URL per group, with Add to Apple, Google and Outlook links. It covers appointments, reminders and open tasks with a due day, from 90 days back to 90 days ahead, with cancelled appointments marked cancelled.
- **Google Calendar two-way sync.** A member connects their Google account per group. Caretook creates a **"Caretook: Pat"** calendar there and keeps it current with the same items as the feed.
  - **What comes back:** time changes made in Google (appointments, reminders and tasks); deleting an event (it cancels an appointment, deletes a reminder, marks a task done); and new events made in that calendar (they become appointments, with the title imported once).
  - Changes are pulled every 5 minutes and pushed right after each save.
  - Disconnecting revokes access and leaves the calendar in Google, frozen.

**Privacy.** Everything that leaves Caretook (emails, the feed, Google) is generic by default: "Appointment for Pat · 9:00–10:00" with a link back, and no title, place or provider. A member can opt in, per group and with recorded consent, to titles, places and providers. A group's owners can forbid details outside Caretook for everyone.

## User Stories

### Series

1. As a caretaker, I want to make an appointment repeat weekly on chosen days, so that dialysis on Monday, Wednesday and Friday is entered once.
2. As a caretaker, I want a repeat every N weeks, so that an infusion every four weeks or PT every other Tuesday is easy.
3. As a caretaker, I want a monthly repeat on a date or on the nth weekday ("second Tuesday"), so that monthly check-ins fit.
4. As a caretaker, I want a daily or every-N-days repeat, so that home health visits or wound care are covered.
5. As a caretaker, I want a series to end on a date, after a number of visits, or never, so that "12 PT sessions" and "dialysis, ongoing" both work.
6. As a caretaker, I want each visit to be an ordinary appointment with its own notes, providers and place, so that what happened at each visit is recorded on that visit.
7. As a caretaker, I want the repeat shown in words ("Every Mon, Wed, Fri at 6:00 · until 31 Jan"), so that I can check I set it right.
8. As a caretaker, I want a repeat mark on series visits in Upcoming, the timeline and the entry page, so that I can tell a repeat from a one-off.
9. As a caretaker, I want reminders (future notes) to repeat too, so that "Order refills every 4 weeks" and "Fill the pill organizer, Sundays" don't need retyping.
10. As a caretaker, I want to change one visit's time without touching the rest, so that a one-off move doesn't break the series.
11. As a caretaker, I want to change the time, day or details for this and later visits, so that a new dialysis schedule from next month applies from then on.
12. As a caretaker, I want to cancel only one visit (with a reason), so that a holiday closure is recorded.
13. As a caretaker, I want to cancel this and later visits (the series ends), so that finished PT stops showing up.
14. As a caretaker, I want to reschedule one visit, keeping the old one as cancelled, so that the reschedule works as it does today.
15. As a caretaker, I want to delete one visit or this and later visits, so that a series entered wrongly can be removed.
16. As a caretaker, I want past visits never to change when I edit a series, so that the history stays what happened.
17. As a caretaker, I want a visit I changed on its own (a moved time, notes, linked tasks) to stay as I left it when I later edit the series, so that my one-off fixes aren't lost.
18. As a caretaker, I want to set up a series offline, so that I can enter it in the waiting room with no signal.
19. As another caretaker, I want a series someone else set up to show on my device with every visit, so that we all see the same schedule.
20. As a caretaker, I want a series to keep going on its own without anyone opening the app, so that visits are always there 90 days ahead.
21. As a viewer, I want to see series visits and their repeat text, so that I know the routine, without being able to change it.

### Reminder emails

22. As a member, I want to turn on reminder emails for a group, so that I'm told before appointments without opening the app.
23. As a member, I want to choose up to three lead times (evening before, morning of, 2 h, 1 h, 30 min), so that reminders fit my day.
24. As a member, I want reminders timed in my own time zone, so that "the evening before" means my evening.
25. As a member, I want reminders for all-day items the evening before or the morning of, so that "sometime Thursday" still gets a nudge.
26. As a member, I want reminders for reminders (future notes), so that "Call the pharmacy" actually reminds me.
27. As an assignee, I want an email the morning a task is due, or 1 h before its due time, so that my errands don't slip.
28. As a member, I want to add an extra reminder for one appointment ("2 h before this one"), so that a fasting lab gets an earlier nudge.
29. As a member, I want to mute reminders for one appointment, so that one I'm not involved in doesn't email me.
30. As a member, I want no reminder for a cancelled appointment, and a fresh one when a visit moves, so that reminders are never wrong.
31. As a member, I want reminder emails to say nothing about health by default ("Appointment for Pat tomorrow at 9:00"), so that my inbox doesn't leak details.
32. As a member, I want a one-click unsubscribe in every reminder, so that I can stop them from my phone's mail app.
33. As a member who left a group, I want reminders to stop, so that I'm not emailed about a group I'm no longer in.

### iCal feed

34. As a member, I want a calendar feed URL for a group, so that Caretook's appointments show in my Apple, Google or Outlook calendar.
35. As a member, I want Add to Apple, Google and Outlook buttons and a copy button, so that subscribing is one tap.
36. As a member, I want the feed to include reminders and tasks with due days, so that my calendar has the whole plan.
37. As a member, I want cancelled appointments to show as cancelled, and recent past ones to stay, so that my calendar matches what happened.
38. As a member, I want to revoke or regenerate my feed URL, so that a leaked link stops working.
39. As a viewer, I want a feed too, so that I can follow along in my own calendar.
40. As a member, I want the feed to stop working when I leave the group, so that a former member's calendar stops updating.

### Google Calendar

41. As a member, I want to connect Google Calendar for a group, so that its appointments appear there and stay current within minutes.
42. As a member, I want Caretook to use a calendar of its own ("Caretook: Pat"), so that my personal calendars are never read or changed.
43. As a caretaker, I want to move an appointment in Google and have the group see the new time, so that I can manage visits from my work calendar.
44. As a caretaker, I want deleting an appointment in Google to cancel it in Caretook, so that a cancellation I record at work reaches everyone (and can be undone in Caretook).
45. As a caretaker, I want an event I add to the Caretook calendar in Google to become an appointment, so that I can book from Google.
46. As a caretaker, I want moving a reminder or task in Google to change its time or due day, so that I can replan from my calendar.
47. As a caretaker, I want deleting a reminder in Google to delete it, and deleting a task to mark it done, so that Google works as a to-do surface too.
48. As a viewer, I want my Google calendar kept current even though I can't change appointments, so that changes I can't make there are put back rather than half-applied.
49. As a member, I want to disconnect Google, so that Caretook stops reading or writing my account (the calendar stays as it was).
50. As a member, I want to see when Google last synced and any error ("Reconnect Google"), so that I know it's working.
51. As a caretaker, I want each series visit to be its own Google event, so that moving one visit in Google moves just that one.

### Privacy and control

52. As a member, I want details (titles, places, providers) outside Caretook to be off until I opt in, so that nothing health-related leaves by accident.
53. As a member, I want to opt in to details per group, with a clear note on where they go (my inbox, my calendar provider), so that I consent knowingly.
54. As an owner, I want to forbid details outside Caretook for the whole group, so that a privacy-minded family keeps everything generic.
55. As a member, I want turning details off to rewrite what's already in my Google calendar and feed, so that turning it off really removes them.
56. As a member, I want reminder, feed and Google settings on one page per group, so that I find them in one place.
57. As a member on a slow connection, I want these settings to say they need a connection, and to save when I'm back, so that I'm not confused offline.

### Operators

58. As the operator, I want Google tokens sealed at rest and never logged, so that a database leak doesn't hand out calendar access.
59. As the operator, I want reminders, Google push and pull and series top-up to run from the existing cron, safely repeatable, so that a retry or a late run never sends twice or duplicates visits.
60. As the operator, I want a manual smoke test against a real Google account, so that I can confirm the integration on staging before launch.

## Implementation Decisions

### Areas

- **Series** belong to the **appointments** area (schema, services, device writes, sheets).
- **Calendar items, sharing settings, the feed, reminder planning and Google** are a new **`calendars`** area: its own schema, errors, permissions, API and `check-areas.d` parts, and a new `docs/domain/calendars.md` with an _Area index_ entry when it lands.
- The reminder emails are templates in `@caretook/notifications`.

### Dependencies (approved by the user, 2026-11-20, pinned exactly)

- **`rrule` 2.8.1** is the only one on both sides. Every repeat expansion uses it: rules are expanded in floating wall-clock time and turned into instants with the existing zoned-day helpers, so DST behaves like dose slots. It must stay out of the first-load bundle (timeline-ux's bundle budget): the device loads the series module only from the sheets and series writes.
- **`ical-generator` 11.1.4** (server only) renders the feed.
- **`@googleapis/calendar` 20.2.0** and **`google-auth-library` 11.3.4** (server only) are used only inside the real Google client.

### Series (B-60)

- **A new synced table, `appointment_series`.** Its columns:
  - `id`, `group_id`, `recipient_id` (composite FK), `kind` (`event` | `note`);
  - `rule`: the RRULE text (FREQ DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY with optional ordinal, BYMONTHDAY, COUNT or UNTIL), plus `starts_on` (local date), `start_time` (`HH:MM`) or all-day, and `time_zone` (the recipient's at creation);
  - the template: `title`, `duration_minutes` (events, nullable), `all_day`, `place`, and the provider ids (a jsonb array of ids checked in the group);
  - `topped_up_through` (a local date), soft `deleted_at`, timestamps and audits.

  Adds a migration. The table is in the `care_groups` stream, the device schema and the upload switch (`appointmentSeriesOp`).

- **On `timeline_entry`:** `series_id` (a composite FK, set null on a hard delete), `series_day` (the local date the rule produced) and `series_detached` (bool). A unique `(series_id, series_day)` among live rows. Other kinds refuse these fields (the `entryTiming` pattern).
- **Visit ids** are UUID v5 of (series id, series day), so the device and the server writing the same visit converge on one row (the `passMovedId` pattern). Provider links per visit are copied from the template.
- **`seriesVisits(series, from, to)`** (pure, client-safe, over rrule) gives the local days and instants in a range. A skipped DST time moves forward and a repeated one takes the first (as `zonedDay`). COUNT counts from the series start, and UNTIL is inclusive.
- **`repeatText(series)`** (pure) gives the wording: "Every Mon, Wed, Fri at 6:00", "Every 4 weeks on Tue", "Monthly on the 2nd Tuesday", "Every 3 days", plus "· until 31 Jan" or "· 12 visits".
- **`planSeriesEdit({ series, visits, visit, scope, change, now })`** (pure) returns the writes.
  - **Only this visit:** the visit changes and `series_detached` is set.
  - **This and later:** the series is split. The old series gets UNTIL the day before, and a new series starts at this visit with the change. Each future, non-detached visit of the old series is moved in place onto the new series when its day is still in the rule (it keeps its id, notes and tasks). It's soft-deleted when its day isn't, unless it has notes, tasks or a cancel, in which case it's detached and kept. Missing days are added.
  - **Past visits** (before `now`) are never written.
  - Cancel, reschedule and delete use the same two scopes. Cancelling or deleting "this and later" ends the series (UNTIL the day before); deleting the first visit with "this and later" soft-deletes the series.
  - Rescheduling "only this visit" keeps the old one as cancelled (today's rule) and detaches the new one.
- **The device** (`lib/appointments/series.sync.ts`):
  - `createSeries` writes the series and every visit through 90 days in one local transaction, with each visit's provider links and an empty document.
  - `applySeriesEdit` runs a plan in one local transaction.
  - The device never tops up.
- **The server:**
  - `appointmentSeriesService` (`upsert`, `update`, `remove`, `topUp(now)`) writes through `timelineEntryService` for visits, in the same transaction.
  - `topUp` is idempotent: it adds visits from `topped_up_through` to today + 90 days with deterministic ids, skipping days that already have a live or deleted visit.
  - The upload of a split is an ordinary series op plus entry ops. The service checks a series' providers and recipient are in the group.
- **Screens:**
  - **Sheets:** a `RepeatField` in the appointment and reminder sheets (only when creating, or from a visit's "Edit series" path). It offers Doesn't repeat / Daily / Weekly / Monthly / Custom (interval, weekdays, monthly by date or nth weekday) and Ends (never, on date, after N), and previews the repeat text and the next three visits.
  - **Entry page and rows:** the entry page shows the repeat text, and a lucide `Repeat` mark sits beside the time on rows in Upcoming, the timeline and the Today card.
  - **`SeriesScopeDialog`** (a native `<dialog>`: Only this visit / This and later visits / Cancel) opens before edit, cancel, reschedule and delete on a series visit.
  - Viewers see the text and the mark, and no actions.
- **Seeds:** a weekly dialysis series (Mon, Wed, Fri, no end) and a 12-visit PT series for Dev Family, with one visit detached and moved, and a monthly refill reminder.

### Calendar items and sharing (shared by the feed, reminders and Google)

- **`calendarItems({ entries, tasks, recipient, from, to })`** (pure, in `@caretook/data`'s client-safe schema part) projects appointments, reminders and open tasks with a due day onto a neutral `CalendarItem`. Its fields:
  - `uid`: a stable id per entry or task;
  - `kind`, `start` and `end` (instants, or a date span for all-day), and `status` (`confirmed` | `cancelled`);
  - `title`, `place`, `providers`, `series`, and `appUrl` (from `APP_URL`).

  The window runs from 90 days back to 90 days ahead. Cancelled appointments are kept, deleted items and done tasks are left out, and an undated task is left out.

- **`shareLevel({ memberConsent, groupAllowsDetails })`** gives `generic` | `details`.
- **`calendarText(item, level)`** gives the wording. Generic is "Appointment for Pat", "Reminder for Pat" or "Task for Pat" with the time, a link back and no place or description. Details add the title, place and provider names. No live-note content ever leaves.
- **Tables** (adds a migration; one pending migration for the PRD where possible, so later slices regenerate it on top):
  - **`member_calendar_setting`**, one row per user and group: `details_consent_at`, `details_consent_version`, `reminders_on`, `reminder_leads` (up to three of `eveningBefore | morningOf | 120 | 60 | 30`), `feed_token_hash` (SHA-256), `feed_rotated_at`.
  - **`reminder_override`**: user, group, entry, `mode` (`mute` | `extra`), `leads`.
  - **`care_group.details_outside_allowed`**: bool, default true.

  These aren't synced. They're read and written through oRPC (`calendars.*` procedures), and the settings page saves like `saveSettings`: pending offline, sent later.

- **Permissions:**
  - Any member reads and writes their own setting and overrides.
  - Only owners change `details_outside_allowed`.
  - Leaving a group or being removed deletes the member's setting and overrides and revokes the feed, in the removal's transaction (`careGroupMemberService`).
  - Turning details on records the consent (when and which version), and turning it off clears it.

### iCal feed (B-62)

- **`calendarFeedService`** (`create`, `rotate`, `revoke`, `resolve(token)`) uses 32-byte random tokens, stores only the hash and never returns a stored token. `create` and `rotate` return the URL once.
- **The route:** `GET /api/calendar/<token>.ics`, web only.
  - It answers `text/calendar` with `cache-control: private, max-age=300`. An unknown or revoked token, or a former member, gets a 404 with no body.
  - It's rate-limited per token and IP (`rateLimit.ts`) and never logs the token.
- **Rendering:** `renderIcs(items, level, { calendarName })` (ical-generator).
  - Timed items are in UTC and all-day items are DATE values.
  - Cancelled items carry `STATUS:CANCELLED`, and the UID is the item uid at our domain.
  - Series visits are separate VEVENTs (no RRULE): the same one-per-visit rule as Google.
- **Settings:** the page shows Copy, Add to Apple (`webcal://`), Add to Google (`calendar.google.com/calendar/render?cid=…`), Add to Outlook (`outlook.live.com/calendar/0/addfromweb?url=…`), Regenerate and Revoke.

### Reminders (B-61)

- **`planReminders({ items, settings, overrides, assignees, now, lastRun })`** (pure) returns the sends due in `(lastRun, now]`. Each send has a recipient, item, lead and the item's start.
  - Appointments and reminders go to members with reminders on (their leads plus any extra override, minus a mute).
  - A task goes to its assignee (a member) only, the morning of its due day at 7:00, or 1 h before its due time.
  - Leads are worked out in the recipient's zone: `eveningBefore` is 18:00 the day before and `morningOf` is 7:00.
  - All-day items take only `eveningBefore` and `morningOf`, and a timed lead on an all-day item falls back to `eveningBefore`.
  - Cancelled items, done tasks, items whose send time is already past when they're created, and former members send nothing.
  - **The idempotency key** is (recipient, item uid, lead, start instant), so a moved visit sends again and a repeat run sends nothing.
- **Notifications:** `appointmentReminder` and `taskDue` are appended to `NOTIFICATIONS`. Each has a generic or detailed subject and body from `calendarText`, the time in the recipient's zone, a link to the item, `List-Unsubscribe` and a one-click unsubscribe link (a signed token over user and group, `unsubscribeReminders`). Each declares its channel, so push can be added later.
- **The sweep:** `sweepReminders(now)` reads the window (now to now + 25 h) per group with reminders on, plans, and `notify`s each send in one transaction. It keeps `last_reminder_run_at` (an app setting) so a late run catches up within 6 h, and drops older sends.
- **The override:** "Remind me" in an appointment's or reminder's ⋯ (any member, online). It opens a small sheet (Use my settings / No reminders for this one / Also remind me: lead choices).

### Google Calendar (B-63)

- **`GoogleCalendarClient`** is the interface: `exchangeCode`, `refresh`, `revoke`, `createCalendar`, `upsertEvent` (with our uid in `extendedProperties.private`), `deleteEvent`, and `listChanges(calendarId, syncToken)` (returns changes and a new token, or `fullSyncRequired`).
  - The real client sits over `@googleapis/calendar` and `google-auth-library`, with the narrowest scope that covers creating and managing our own calendar (`calendar.app.created` if it does, else `calendar`). Check this in the slice and record it.
  - `fakeGoogleCalendar()` is in memory, for tests. It can act as a user editing in Google.
- **Env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (sealing, like `INVITE_LINK_KEY`; a fixed dev key in dev and tests; production refuses to connect without it). Documented in `.env.example` and the runbook (the Google Cloud project, OAuth consent screen and verification are the user's).
- **`googleConnectionService`:**
  - **Connecting:** `start(user, group)` returns the consent URL with state and PKCE stored for 10 min. `complete(code, state)` seals the refresh token (AES-256-GCM, the connection id as associated data), creates the "Caretook: <recipient>" calendar and queues a full push.
  - **`disconnect`** revokes the token, deletes the sealed token and stops syncing, and leaves the calendar in Google.
  - **Status** (connected, last push and pull, last error) feeds the settings page.
  - One connection per user and group. Leaving the group or deleting the account disconnects.
  - Tables: `google_calendar_connection` (user, group, calendar id, sealed token, sync token, last push and pull, error, `disconnected_at`) and `google_event_link` (connection, item uid, Google event id, etag, last pushed hash).
- **Push:** `calendar_sync_job` (connection or group, reason, attempts, next attempt).
  - `timelineEntryService`, `taskService` and `appointmentSeriesService` enqueue a group job in their transaction when an item that can appear in calendars changes, and details-consent changes do the same.
  - It's delivered after commit (`deliverSoon` style) and swept each minute with the outbox's backoff.
  - A run diffs each connection's `calendarItems` (at its share level) against `google_event_link` by hash. It upserts changed items, deletes those that left the window or were deleted, and marks cancelled appointments cancelled in Google.
- **Pull:** every 5 minutes per connection, `listChanges` with the sync token. A `fullSyncRequired` re-lists the calendar.
  - **`interpretGoogleChange({ change, link, item, role })`** (pure) returns one action:
    - **Our echo** (its etag or hash matches): ignore.
    - **An appointment:** a time change becomes an update of `occurred_at`, `ends_at` and `all_day`, and a delete becomes a cancel.
    - **A reminder:** a time change updates its time, and a delete removes it.
    - **A task:** a time change updates its due day and time, and a delete completes it.
    - **A new event without our uid:** creates an appointment with Google's summary as the title, its time, and an empty document. The event is then tagged, and rewritten to generic when the member's level is generic.
    - **A change the member's role can't make** (a viewer, or a series visit edited as "only this visit"): `overwrite`, and the next push puts our version back.
  - Moving a series visit in Google is "only this visit". Writes go through the services as that member (RBAC in SQL), so the timeline records who changed what.
- **The cron:** one web-only `/api/cron/calendar` behind `CRON_SECRET`, every minute (`vercel.json`). Each run does the reminder sweep, then the push sweep, then the pulls that are due (5 min per connection), then the series top-up (once a day per series via `topped_up_through`). Each step is bounded and catches its own errors.
- **Smoke:** `pnpm calendar:google-smoke` is a manual script, never in `pnpm check`. Against a real test account and `GOOGLE_*` env it connects, pushes a seeded group, edits an event through the API, pulls, and checks the change. The runbook documents it for staging.

### Screens and routes

- **Calendar & reminders** (`groups/:groupId/settings/calendar`, `appUrls.calendarSettings`, linked from group settings for every member, viewers included) has four cards:
  - **Reminders:** on or off, up to three lead choices, and a note on tasks.
  - **Calendar feed:** create, copy, the Add to … links, regenerate and revoke.
  - **Google Calendar:** Connect, or the status with Disconnect (shown only on the web target).
  - **Details outside Caretook:** a consent switch with its explanation, disabled with "Your group's owners keep details private" when the owners forbid it.

  Online only, through oRPC (loaders are `clientLoader`). It's a shared route, with no server loader.

- **Group settings** (owners) gets a "Details outside Caretook" switch.
- **The OAuth start and callback** are web-only server routes (`/api/google/connect`, `/api/google/callback`) that redirect back to the settings page with a status.

## Testing Decisions

Good tests check behaviour through a module's public interface: the visits a rule gives, the writes a plan returns, the emails a sweep queues, what a fake Google calendar holds after a push. They don't check internals. Time is always fixed (the appointments area's Wed 2026-11-18 10:00 Los Angeles clock), and zones and DST weeks are named in the tests.

- **Unit (pure):**
  - `seriesVisits`: each pattern, COUNT and UNTIL, DST weeks in two zones, and month ends (the 31st, the 5th weekday).
  - **Property tests:** seeded random rules, zones and ranges checked against rrule's own expansion and against invariants (sorted, inside the range, the count respected, one per local day). They're hand-rolled with a seeded generator, so no new dependency.
  - `repeatText`.
  - `planSeriesEdit`: both scopes for edit, cancel, reschedule and delete; past visits untouched; detached and touched visits kept.
  - `calendarItems`, `shareLevel` and `calendarText` (generic text never contains a title, place or provider).
  - `renderIcs` (a golden file).
  - `planReminders`: leads, zones, all-day fallback, overrides, cancelled and moved items, tasks, the idempotency key.
  - `interpretGoogleChange`: every action and role.
- **Integration (`*.int.test.ts`):**
  - `appointmentSeriesService`: every role against `appointment_series`; create and split in one upload batch; `topUp` idempotent and converging with device-made ids.
  - The upload switch for series ops (`syncAppointments.int.test.ts` is the prior art).
  - `calendarFeedService` and the feed route: tokens hashed, revoke and rotate, a former member gets a 404, the rate limit, generic versus details.
  - The settings procedures and the owner switch, and member removal clearing settings.
  - `sweepReminders` with the memory sender: sends once, catch-up, unsubscribe, suppression (the `outbox.int.test.ts` prior art).
  - `googleConnectionService` and push and pull against `fakeGoogleCalendar`: a full push; a time change, delete and new event coming back; a viewer's change overwritten; echoes ignored; details off rewriting events; disconnect.
  - The cron handler's 401, 503 and step isolation.
- **Component (`*.browser.test.tsx`, beside the screens; prior art `upcoming/upcomingWorld.tsx`):** `RepeatField` and its preview; creating a series offline (visits in Upcoming); `SeriesScopeDialog` for each action; the repeat mark and text; the Calendar & reminders page (each card; viewer; owner forbade details; offline "needs a connection"); the owner switch; the "Remind me" sheet.
- **End to end:** one step added to `roundtrip` (the lean check that owns cross-device flows). A series created offline on one device reaches the server and the other device with its visits, and a "this and later" edit arrives as a split. No new browser check.
- **Manual:** `pnpm calendar:google-smoke` on staging.

## Out of Scope

- Push notifications (Web Push and Capacitor). The reminder planner is channel-ready.
- Recurring tasks (they could reuse `seriesVisits` later).
- Syncing title, place or description edits back from Google, and Google's own recurring events (RRULE) or attendees.
- Google push notifications (watch channels). Polling only.
- Other calendar APIs (Outlook, iCloud CalDAV). They use the feed.
- Digests, quiet hours, SMS.
- Live-note content in any outside channel.
- An "All visits" scope that rewrites past visits.

## Further Notes

- **Start condition:** timeline-ux's Today card (its slice 5, wave 2) must be in `dev`, since series visits get the repeat mark there.
- **Compliance:** Google and calendar apps receiving items is sharing. That's why details are opt-in with recorded consent and an owner veto, and generic is the default. The privacy pages (B-54) should mention the feed and Google.
- **Google's app verification** for calendar scopes is the user's work in the Google Cloud console. Until it's verified, only test users can connect, which is fine for staging.
- **Open:** whether `calendar.app.created` covers `listChanges` on our calendar. The Google slice confirms this and records it in the calendars doc.
