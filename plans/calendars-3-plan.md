# Plan: Calendars 3: reminders as browser push

> Source PRD: [`plans/calendars-3-prd.md`](calendars-3-prd.md). User-story numbers (US) refer to it. Backlog item B-377. Topic `calendars-3`.

## Status

**Where it stands:** planned and **held** (flag `hold`): two skeptic passes sent it back, and the user chose to apply their fixes and land it held (ask a138). No slice started. To lift it: `pnpm backlog prd set calendars-3 flags=—`.

**Open:** after landing, the user sets the two push keys on staging, then hand-tests on a real Android phone and an installed iPhone app: a push arrives, shows no name, a tap opens the item, and signing out while offline stops later pushes (`unsubscribe()` offline is unverified on real browsers).

| Slice | Wave | Model | State   | Merge into `prd/calendars-3` |
| ----- | ---- | ----- | ------- | ---------------------------- |
| 1     | 1    | opus  | planned |                              |
| 2     | 2    | opus  | planned |                              |
| 3     | 3    | opus  | planned |                              |
| 4     | 1    | opus  | planned |                              |

**Backlog:** claim B-377 (push notifications for event reminders) when slice 1 starts; run `pnpm backlog done` when slice 3 merges.

## Architectural decisions

- **Two migrations, both additive:** slice 1 adds the push subscription table, slice 2 the push delivery table, in different waves.
- **The content rule is structural.** Push text is one pure function of kind and `calendarWhen`. It takes no share level and no item title, so no caller can add details.
- **A subscription is one session and one membership,** cascading from the session and (composite key) from `care_group_member`. **Live** means an unexpired session and an enabled account, checked when queuing and when delivering. One bounded helper unsubscribes the browser on sign-out and on any change of account. Deliveries cascade from their subscription.
- **The 7-day rule:** push ends when the session expires (7 days after last use on that device), and the Reminders card says so.
- **Push tables are system only and never synced.** Secrets are sealed; no endpoint or key is ever logged.
- **Email's outbox and `Sender` stay as they are.** Push has its own delivery table and sender seam, following the same retry and expiry rules.
- **No keys, no feature:** every path checks for the push keys and does nothing without them.
- **No CSP change, no new sync stream, no build variable.**

## How to run this plan

- **Wave 1:** slices 1 and 4 (independent). **Wave 2:** slice 2. **Wave 3:** slice 3.
- The policy (slice 4) lands before anything can send (slice 2).
- Slice 1 touches `lib/auth/session` and `lib/sync/client`, hot files of `sync-safety`: don't run it beside that topic.
- Slice 3 edits `ops/runbook.md`, a hot file of `test-gates-2`: it waits until that topic has landed.
- Slice 1 owns the subscription and the card's control; slice 2 the sender, delivery, cron step and worker handlers; slice 3 the switch between channels; slice 4 the policy.

## Slice 1: Turn on push for this device

Stack: no · Reads: docs/domain/calendars.md, docs/domain/notifications.md, docs/domain/app-shell.md, docs/domain/data-layer.md, docs/domain/api.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** US 1, 2, 9, 10. **Item:** B-377.

**Build:** Adds a migration: the push subscription table (session, user, group, sealed subscription), system only, with cascades from the session and from `care_group_member (group_id, user_id)`. A service and `calendars.push.status|subscribe|unsubscribe`, a member's own only; `status` also says whether the member has any live subscription in the group. The browser's one subscription serves every group: turning off a group removes its row, and the browser unsubscribes only when this session's last group is off. One device helper unsubscribes it, called from `wipeDevice` and from the different-owner branch of the local database's `open`, before the next person can subscribe; it uses `getRegistration` under a time limit, never `serviceWorker.ready`. A small auth helper gives `calendars.push.*` the live session id (no cookie cache). The card states that push stops 7 days after the app was last used on this device. Sealing under a key derived from `PUSH_VAPID_PRIVATE_KEY`, with a fixed dev key in dev and tests, as Google's token does. The env example entries (the runbook is slice 3's). The Reminders card's per-device control, asking for browser permission only on the member's tap, with the unsupported, needs-Home-Screen, denied, off and on states. Hidden on native and without keys.

**Acceptance criteria:**

- Unit: the sealing round trip; a sealed value doesn't open on another row.
- Integration: subscribe, status and unsubscribe for one's own session; another member can't read or remove it; deleting the session, removing the member from the group, or disabling the account removes the row; an expired session's row doesn't count as live in `status`; without keys `status` reports off and `subscribe` refuses.
- Unit: sign-out and a change of account unsubscribe the browser; a helper that fails or never settles (no worker registered) doesn't stop sign-out.
- Integration: a revoked session can't subscribe, even inside the cookie cache's 3 minutes.
- Component test: each card state, including the 7-day line; permission is requested only after the tap; turning off one group leaves the browser subscribed while another is on.
- `pnpm prd check` passes.

**Blocked by:** none. **Blocks:** slice 2.

## Slice 2: A reminder arrives as a push

Stack: no · Reads: docs/domain/calendars.md, docs/domain/notifications.md, docs/domain/app-shell.md, docs/domain/security-headers.md · Tests: unit, integration

**User stories:** US 3, 4, 5, 6, 8. **Item:** B-377.

**Build:** Adds a migration: the push delivery table. The push text function. The push sender seam, with real and memory implementations (the real one over `web-push` 4.0.0, pinned exactly in `@caretook/notifications`, the user's approval recorded in the PRD). The sweep queues a row per live subscription for members with email reminders on, in its transaction, honouring mutes and extras. The `pushDelivery` cron step before `seriesTopUp`: bounded, `SKIP LOCKED`, the outbox's backoff, rechecks that the subscription is live, expired at the item's start, 404 or 410 deletes the subscription, purge after 30 days. Delivery rows cascade from their subscription. The service worker's `push` and `notificationclick` handlers, with parsing and the click target in a pure module added to the worker's source list.

**Acceptance criteria:**

- Unit: a table proves the push text holds no name, title, place or provider at either share level; payload parsing refuses bad input; the click target accepts only same-origin app paths; the sender maps statuses to sent, gone and retry.
- Integration (memory sender): one send per subscription and reminder; a repeat sweep queues nothing; a mute sends nothing; a todo goes only to its assignee; a retry past the start is skipped as expired; a 410 removes the subscription; a session that expires after queuing gets nothing; removing a member deletes their queued rows; old rows purge; without keys the step does nothing.
- `service-worker.test.mjs` still passes with the new module in the version hash.
- `pnpm prd check` passes.

**Blocked by:** slices 1, 4. **Blocks:** slice 3.

## Slice 3: Email and push are separate choices

Stack: no · Reads: docs/domain/calendars.md, docs/domain/notifications.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** US 7, 8. **Item:** B-377.

**Build:** The sweep reads members with email on or a live subscription in the group, including a member with no settings row (`DEFAULT_REMINDER_LEADS`), and queues email only when email is on. Only an email send builds an unsubscribe path, so a missing key can't stop a push-only run. The unsubscribe link and its page keep to email. The Reminders card shows the lead times when either channel is on. "Remind me" (`effectiveLeads`, `remindSummary` and the sheet's note) counts email or a live subscription on any of the member's devices and names the channels. Adds the push keys to the runbook's secrets and rotation tables and `pushDelivery` to its cron step list. Folds the topic's lasting decisions into the calendars and notifications docs at landing.

**Acceptance criteria:**

- Unit: `remindMe` leads and summaries for email only, push only (on another device), both and neither.
- Integration: push only gets a push and no email, with and without a settings row (default leads); email only gets email and no push; the unsubscribe link stops email and leaves push; neither gets nothing; a push-only run works without the unsubscribe key.
- Component test: the lead times show with push on and email off.
- `pnpm prd check` passes.

**Blocked by:** slice 2. **Blocks:** none.

## Slice 4: The privacy policies name push services

Stack: no · Reads: docs/domain/marketing.md, docs/domain/auth.md · Tests: unit

**User stories:** US 11. **Item:** B-377.

**Build:** A passage in the privacy policy and a recipient entry in the consumer health data policy ("Who we share it with"): if a member turns on push, an encrypted message goes through their browser maker's push service (such as Google, Apple or Mozilla), which can see the device address, the timing and the size but not the content; the notification shows only the kind and time; it is off unless turned on. Neither may fall under the "written contracts" or "processors" wording. Both summaries stop implying no one else is involved (the privacy summary's "and no one else unless the law requires it"). Moves `lastUpdated` and `LEGAL_VERSIONS.privacy` and `.healthDataPrivacy` together.

**Acceptance criteria:**

- `legalVersions.test.ts` passes with both new dates.
- Unit: both policies name browser push services, and the privacy summary no longer says "no one else", in the existing legal page test or beside it.
- `pnpm prd check` passes.

**Blocked by:** none. **Blocks:** slice 2.
