# Plan: Calendars 2: Google sync that leaves the past alone, reminders that expire, and clearer times

> Source PRD: [`plans/calendars-2-prd.md`](calendars-2-prd.md). User-story numbers (US) refer to it. Backlog items B-304 to B-309. Topic `calendars-2`. Push notifications (B-377) are topic `calendars-3`.

## Status

**Where it stands:** waves 1 and 2 are in `dev`. Wave 1 (slices 1, 3, 5, 6; B-304, B-306, B-309) landed as `1f260992` through PR #113. Wave 2 (slices 2, 4; B-307, B-308, and B-305's horizon) landed as `b9b568ca` through PR #114 (2026-11-23), Codex clean after one P2 tracked as B-659, report filed. CI `components` run 45179101466 was `flake` (only the search speed test, not this branch's files, noted on B-619). Browser: `session-end` passed; the lean suite was not run in either wave (skeptic decided, a128 and a131, the user can veto). Slice worktrees 2 and 4 are removed. Wave 2's docs are folded.

**Next:** wave 3, slice 7 alone (the daily catch-up, B-305's rest; adds the second migration, so its check and CI tier are full). **Slice 7 merged as `c3f79b28`** (2026-11-23), B-305 marked done; its worktree stays until the wave's verdict is green. Running now: the quick check, then `pnpm prd ci run full --wait`. A failure goes to a `--continue` agent in `calendars-2-7`. After it lands: fold the docs, `pnpm prd rm calendars-2`, then `cd` to the main checkout and `pnpm prd end`. Shell: start commands with `export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"`, and tell slice agents the same. Pipe a check through `tail` only with `set -o pipefail`. The schema's frozen `index.test.ts` no longer exists (`60f17a4f`). `calendars.md` has about 35 bytes of budget left, so trim at least what wave 3 folds in.

**Open:** hand test against real Google that a deleted upcoming todo's event comes back (`events.update` with `status: "confirmed"`, insert on 404) and that `recurring` maps from a real repeat; only the fake client and a typed fixture ran them. The real `listWindow` has not run against live Google either, and the Google smoke test doesn't call it yet. A reconnect keeps `last_catch_up_at`, so its next catch-up can be up to 24 hours away. A device on an older build shows a last-day rule as plain "Repeats" until it updates. An event moved in Google past 365 days updates in Caretook, its Google event is deleted by the next push, and it is pushed again when it comes back in range. B-659 (a consent queued offline across a wording bump, in `fixes-bug`) should be fixed before the next `DETAILS_CONSENT_VERSION` bump.

**Landing mode:** run everything through (started run-through): start every ready slice, land each green wave, clean up, ask only real questions through `pnpm prd ask`.

| Slice | Wave | Model | State  | Merge into `prd/calendars-2` (slice commits)   |
| ----- | ---- | ----- | ------ | ---------------------------------------------- |
| 1     | 1    | opus  | merged | `26b3d891` (`4d0bbae3`, `f55df54a`)            |
| 2     | 2    | opus  | merged | `1a6ac534` (`8734f860`)                        |
| 3     | 1    | opus  | merged | `d65bacf4` (`ad831a51`; migration 0039)        |
| 4     | 2    | opus  | merged | `c5ed0364` (`22cb2bb9`)                        |
| 5     | 1    | opus  | merged | `4d812bc6` (`c58aee87`)                        |
| 6     | 1    | opus  | merged | `6012a222` (`6914d97b`, `e82f69c0`)            |
| 7     | 3    | opus  | merged | `c3f79b28` (`0121145f`, `08ffe4a7`; mig. 0040) |

**Backlog:** claim a slice's item when it starts; run `pnpm backlog done` on an item when its last slice merges.

| Item                                                   | Slices |
| ------------------------------------------------------ | ------ |
| B-304 Google deletes rewrite past records              | 1      |
| B-305 Google events beyond 90 days never arrive        | 2, 7   |
| B-306 a reminder can arrive after its event            | 3      |
| B-307 pushes name soft-deleted providers               | 2      |
| B-308 the consent version is never compared            | 4      |
| B-309 reminder times (zone, 12-hour); monthly last day | 5, 6   |

## Architectural decisions

Durable decisions every slice follows:

- **Two migrations: slice 3** (`notification_outbox.expires_at`) **and slice 7** (`google_calendar_connection.last_catch_up_at`), both nullable and additive, in different waves. Nothing else adds one. No new dependency, route, table, permission or sync stream.
- **The pull planner stays pure and one function.** Every Google rule is a branch in `interpretGoogleChange` with a row in its test table; the pull service only applies actions. The catch-up reuses it.
- **Two windows, named.** `calendarWindow` (90 days each way) for the feed, the Planner and reminders; `googleWindow` (90 back, 365 ahead) for push, pull and the catch-up. Nothing else widens.
- **The sync token belongs to the change list.** The catch-up never reads, clears or writes it.
- **One consent rule** (`hasDetailsConsent`), read by every place that decides a share level. No reader tests `detailsConsentAt` alone after slice 4.
- **One wording module.** Times outside Caretook come only from `calendarWhen`; no caller formats its own.
- **The repeat rule stays free of `rrule`** in the schema index: the last day is `BYMONTHDAY=-1` in text, expanded only in `@caretook/data/series`.
- **Registries are composed from area parts** ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)): a new export from the calendars schema adds its entry to the schema's frozen `index.test.ts` list, at the end of its group.
- **Wording says "event"** in new labels, messages and tests; existing labels are left alone.
- **All test data is fictional.** Google is the fake client; mail is the memory sender.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing (below).

## How to run this plan

- **Waves:** (1, 3, 5, 6) → (2, 4) → 7. Land each wave when green.
- **Why three waves:** slices 1 and 2 both change the pull planner and its tests. Slice 4 follows slice 5 so the wording in its assertions is settled. Slice 7 builds on slice 2's horizon and `recurring` flag and adds the second migration.
- **Merge order inside a wave is plan order.**
  - Wave 1: slices 3 and 5 both add cases to `reminders.int.test.ts` (3 the expiry, 5 the wording); slice 3 alone edits the sweep's `notify` call.
  - Wave 2: slices 2 and 4 both edit `calendarSyncService`, in different functions (2: the group read's window and provider join; 4: the member read's consent), and both add an export to the schema's frozen `index.test.ts`. Merge 2 first; 4 keeps both entries.
- **Gates:** waves 1 and 3 each carry a migration, so their checks run full. Wave 2 is a quick check where the check plan allows, with the component tests slice 4 names. No browser check is added.
- **The migrations:** when a sync brings another topic's migration, keep `dev`'s and regenerate this topic's pending one on top.
- **After landing wave 1** every connected member's Google events are rewritten once (the time wording changes each event's hash). After wave 2, far events are pushed for the first time. Both are expected; say so in the landing note.
- **Files other topics have hot:**
  - `fixes-bug` (running) and `sync-safety` (planned): `packages/data/src/services/`. This topic changes only `calendarSyncService`, `calendarPullService`, `calendarSettingService`, `calendarFeedService` and `calendarReminderService`. Sync before each wave.
  - `fixes-bug` (running): `apps/web/app/lib/appointments/` and `routes/app/groups/planner/`; `planner-3` (planned): `lib/appointments/`. Slice 6 changes the repeat choice module and adds cases to the Planner's series component test. If a `fixes-bug` slice has either open, tell its orchestrator and sync after its landing.
  - `i18n` (on hold): `packages/notifications/` and the format helpers. It will route `calendarWhen` through its helpers later; nothing to do now.
  - `calendars-3` (to write, after this topic): it builds on slice 3's outbox and the reminder planner's `channel`.
- **Ownership:**
  - Slice 1: the pull planner's delete branches, the pull service's `apply`.
  - Slice 2: `googleWindow`, the planner's new-event and lookup branches, `GoogleEvent.recurring` in the client, real and fake, the sync service's group read (window and provider join).
  - Slice 3: the outbox table, `notify`, delivery, the reminder planner's `expiresAt`, the sweep's pass-through, the staff mail view's reason.
  - Slice 4: `hasDetailsConsent`, its four readers, the settings view and the Details card.
  - Slice 5: `calendarWhen`, `calendarText`, the golden files.
  - Slice 6: the repeat rule, the expander, the repeat choice module, the Repeat sheet.
  - Slice 7: the connection column, `listWindow` in the client, real and fake, the pull service's catch-up.
- **Docs at landing** (the orchestrator): [calendars](../docs/domain/calendars.md) (pull rules, the two windows, the catch-up, the consent rule, the wording), [notifications](../docs/domain/notifications.md) (`expires_at`, the `expired` skip), [appointments](../docs/domain/appointments.md) and [todos](../docs/domain/todos.md) (the last-day rule).

## Slice 1: Google deletes leave the past and todos alone

Stack: no · Reads: docs/domain/calendars.md, docs/domain/data-layer.md · Tests: unit, integration

**User stories:** US 1, 2, 3. **Item:** B-304.

**Build:** In the pull planner, a deleted Google event for an item that has started (an event or a todo, in a repeat or not) is `ignore` with the new reason `started`: nothing changes in Caretook and nothing is pushed back. A deleted event for an upcoming todo is `overwrite` (reason `todoDelete`). Remove the `completeTodo` action from the planner's type and the pull service's `apply`. An upcoming event's delete still cancels it ("Deleted in Google Calendar"); time changes are untouched, a started repeat visit's included (`overwrite: pastVisit`). Update the planner's header comment.

**Acceptance criteria:**

- Unit (`pullPlan.test.ts`): rows for a delete of a started one-off event, a started all-day event on its day, a started repeat visit and an overdue todo (all `ignore: started`); an upcoming one-off event (still `cancelEntry`); an upcoming todo with and without a due time, as a writer and as a viewer (`overwrite`). No row returns `completeTodo`; the type no longer has it.
- Unit: a link whose item is a note gives `ignore: gone` (the note case from the item, already true).
- Integration (the calendar pull tests, fake client): after `user.delete` on a past event's Google event and on an upcoming todo's, a pull leaves the event uncancelled and the todo open; the past event is counted as ignored and stays deleted in Google after the next push; the todo is counted as overwritten and the next push writes its event back.
- Integration: the past event, edited in Caretook afterwards, is written to Google again by the next push.
- `pnpm prd check` passes.

**Blocked by:** nothing. **Blocks:** slice 2 (same planner).

## Slice 2: Events made far ahead arrive, and deleted providers aren't named

Stack: no · Reads: docs/domain/calendars.md, docs/domain/data-layer.md · Tests: unit, integration

**User stories:** US 4, 5, 8. **Items:** B-305 (the horizon), B-307.

**Build:** Add `googleWindow(now)` (90 days back, 365 ahead) beside `calendarWindow`. The sync service's group read takes it, so push and pull both see items up to a year out; the feed and the reminder sweep have their own reads and keep `calendarWindow`. In the same read, the provider join takes only live providers of the same group, as the reminder read does. `GoogleEvent` gains `recurring: boolean`, set by the real client from Google's recurring event id and settable in the fake. In the planner, a new Google event is taken when it starts inside `googleWindow`, or inside `calendarWindow` when `recurring`.

**Acceptance criteria:**

- Unit: `googleWindow` bounds. Planner rows: a new event 200 days out is `createAppointment`; 400 days out is `ignore: outsideWindow`; a recurring instance 200 days out is ignored and one 30 days out is created; a time change to a linked item 200 days out is `updateEntry`.
- Integration (fake client): a pull takes a Google-made event 200 days out as a Caretook event with its link; a later move of it in Google updates the Caretook event; the next push does not delete it. A Caretook event 200 days out is pushed. The feed still stops at 90 days.
- Integration: an event linked to a soft-deleted provider and a live one names only the live one in the pushed Google event at the details level, and in the feed (the feed already passes; the test pins it).
- The real client maps `recurring`, covered where its mapping is tested today, else by a typed fixture.
- `pnpm prd check` passes.

**Blocked by:** slice 1. **Blocks:** slice 7.

## Slice 3: A reminder expires when its event starts

Stack: no · Reads: docs/domain/notifications.md, docs/domain/calendars.md, docs/domain/admin.md, docs/domain/data-layer.md · Tests: unit, integration

**User stories:** US 7. **Item:** B-306.

**Build:** Adds a migration: `notification_outbox.expires_at`, nullable. `notify` takes an optional `expiresAt` and stores it. In delivery, a claimed row past its expiry is marked `skipped` with error `expired` and the sender is never called; a failed send whose next attempt would be after the expiry is marked the same way at once. From there it is an ordinary skipped row (the same redaction and purge). The delivery summary counts `expired`, and the staff mail view names the reason where it names the other skip reasons. The reminder planner's sends carry `expiresAt` from its existing "too late" rule (an event's start; the end of an all-day item's first day; a todo's due time or the end of its due day), and the sweep passes it to `notify`.

**Acceptance criteria:**

- Unit (`reminderPlan` tests): `expiresAt` for a timed event, an all-day event, a timed todo and an all-day todo.
- Integration (`outbox.int.test.ts`, memory sender): a row past its expiry is skipped as `expired` and nothing is sent; a failing send with an expiry sooner than the next backoff is skipped, not retried; a row with no expiry retries as before; the purge removes expired rows like other skipped ones.
- Integration (`reminders.int.test.ts`): a swept reminder's row carries the event's start as its expiry.
- Unit: the staff mail view's reason for an `expired` row (beside its existing cases).
- The migration is additive; `pnpm prd check` passes (full: it adds a migration).

**Blocked by:** nothing. **Blocks:** nothing (`calendars-3` builds on it).

## Slice 4: A changed consent wording asks again

Stack: no · Reads: docs/domain/calendars.md, docs/domain/components.md, docs/domain/data-layer.md · Tests: unit, integration, component

**User stories:** US 9, 10. **Item:** B-308.

**Build:** Add `hasDetailsConsent({ consentAt, consentVersion })` to the calendar rules (true only when both are set and the version is the current one) and use it in the settings view, the feed's resolve, the push's member read and the reminder inputs, so a member who agreed to an older wording is generic everywhere. The settings view gains `detailsConsentStale`; `update` with `detailsConsent: true` on a stale row records a fresh time and the current version and queues the push it queues today. The device's settings copy and its optimistic change carry the flag. The Details card, when stale, shows the switch off and one line: the wording changed since the member agreed on the stored day, and turning it on agrees again.

**Acceptance criteria:**

- Unit: `hasDetailsConsent` (no consent, current, older version, a time with no version).
- Integration: with a member's stored version older than the current one, the settings view is `detailsConsent: false, detailsConsentStale: true`, and the feed, a push and a reminder email for them are generic; after `update({ detailsConsent: true })` the row has the current version and all three carry details. A member with the current version is unchanged.
- Component (`settings/calendarReminders`): the Details card for a stale member shows the switch off and the line; turning it on saves and removes the line. The card for a member who never agreed is unchanged.

- `pnpm prd check` passes.

**Blocked by:** slice 5 (the wording in its assertions settles first). **Blocks:** nothing.

## Slice 5: Times outside Caretook name their zone

Stack: no · Reads: docs/domain/calendars.md, docs/domain/notifications.md · Tests: unit, integration

**User stories:** US 11. **Item:** B-309 (the reminder half).

**Build:** `calendarWhen` writes a US English day ("Thu, Nov 19"), a 12-hour time with AM/PM written once when both ends share it, and the zone's short name for the instant shown after a timed range: "Thu, Nov 19 · 9:00–10:00 AM PST", "Thu, Nov 19 · 11:30 AM–1:00 PM PST", "Thu, Nov 19 · 9:00 AM PST" (a todo), "Thu, Nov 19 10:00 PM – Fri, Nov 20 1:00 AM PST" across midnight, and "Thu, Nov 19 · All day" with no zone. `calendarText` and its callers are unchanged in shape. Regenerate the golden `.ics` files and update the tests that quote the old text.

**Acceptance criteria:**

- Unit (`calendarText` tests): each form above, a July date reading PDT, a zone with no US abbreviation (the `Intl` fallback, such as GMT+1, is accepted and asserted), and a cancelled event's text.
- Unit: the golden `.ics` files match the new descriptions.
- Integration (`reminders.int.test.ts`): a reminder email's subject and body carry the new time with its zone.
- No caller formats a calendar time itself: a search for `en-GB` under the calendars schema and `packages/notifications` finds none.
- `pnpm prd check` passes.

**Blocked by:** nothing. **Blocks:** slice 4.

## Slice 6: Repeat on the last day of the month

Stack: no · Reads: docs/domain/appointments.md, docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**User stories:** US 12, 13. **Item:** B-309 (the repeat half).

**Build:** `MonthlyBy` gains `{ by: "lastDay" }`: `ruleText` writes `BYMONTHDAY=-1`, the parser reads it (other negative days stay unsupported), the expander passes it to `rrule`, and the rule's wording reads "Monthly on the last day". A repeating todo's next day already comes from the expander, so it needs tests only. In the repeat choice module, the monthly choices add "On the last day" when the first day is the last day of its month, and the by-date label for the 29th, 30th or 31st adds "(skips shorter months)". A stored last-day rule keeps its choice when the sheet opens on another day. The Repeat sheet renders the choices it is given; events and todos both use it.

**Acceptance criteria:**

- Unit (`repeatRule.test.ts`): text and parse round-trip for the last day; `BYMONTHDAY=-2` is refused; the wording.
- Unit (`seriesVisits.test.ts`, `todoRepeat.test.ts`): from 31 January, visits and a todo's next days fall on the last day of each month through a leap February and a 30-day month; every 2 months; with a count and with an end date. "On the 31st" still skips shorter months (the existing behaviour, asserted).
- Unit (the repeat choice tests): choices for a first day of the 31st (three), the 30th of a 31-day month (two, with the skip note), 28 February in a common year (last day offered, no skip note), and the 15th (unchanged).
- Component (`plannerSeries`, and the todo repeat component test): picking "On the last day" for an event starting on the last day of a month writes visits on each month's last day in the 90 days written; a todo with the rule shows "Monthly on the last day" and ticking it makes the next one on the next month's last day.
- `pnpm prd check` passes.

**Blocked by:** nothing. **Blocks:** nothing.

## Slice 7: A daily catch-up, so nothing made in Google is lost for good

Stack: no · Reads: docs/domain/calendars.md, docs/domain/data-layer.md · Tests: unit, integration

**User stories:** US 6. **Item:** B-305 (the rest).

**Build:** Adds a migration: `google_calendar_connection.last_catch_up_at`, nullable. The Google client gains `listWindow(calendarId, from, to)`: live events only, repeats expanded, bounded by the two times, paged like the change list, returning an `AppError` as the other methods do; the real client asks Google for exactly that (confirm the parameters against Google's Calendar API reference, not memory), and the fake filters the same way (no cancelled events, inside the bounds, `recurring` set on instances). In the pull, after the change list is applied, a connection with no catch-up in the last 24 hours lists `googleWindow` and runs `interpretGoogleChange` over the events that have no link and none of our uid; linked events are skipped. Created events count in the pull's result. `last_catch_up_at` is set only when the catch-up finishes; a failed catch-up is logged, leaves the pull's own result and sync token as they were, and runs again at the next pull.

**Acceptance criteria:**

- Integration (fake client, a moved clock): an event made 400 days out is ignored by the pull that first sees it; 40 days later a pull's catch-up creates it as a Caretook event with its link; a second pull within 24 hours lists nothing more; a pull 25 hours later creates nothing new (the event is linked).
- Integration: a weekly Google repeat gives events only inside 90 days, and one more arrives after the clock moves a week and a catch-up runs.
- Integration: a catch-up never changes a linked event's Caretook item (a linked event moved in Google is applied once, by the change list) and never writes the sync token; a viewer's unlinked event is overwritten as in a pull.
- Integration: with `failCalls` on the window list, the pull still applies its changes and saves its token, `last_catch_up_at` stays unset, and the next pull retries.
- Unit: the fake's `listWindow` filter (bounds, cancelled, recurring).
- The migration is additive; `pnpm prd check` passes (full: it adds a migration).

**Blocked by:** slice 2. **Blocks:** nothing.
