# PRD: Push notifications: reminders as browser push

Backlog: B-377 (push notifications for event reminders). Topic `push-notifications`, after `calendars-2`.

## Decisions

| Decision                                                                                                                                                                                                                                                      | Why                                                                                                                                                                             | Source                                                                                                                        | Cost to change later                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A push says only the kind and the time ("Caretook reminder", "Event · Thu, Nov 19 · 9:00–10:00 AM PST"): never a name, title, place or provider, whatever the member's details consent                                                                        | It passes through a push service with no contract with us and shows on a lock screen                                                                                            | asked: as recommended                                                                                                         | low to widen; what was shown can't be recalled |
| The privacy policy and the consumer health data policy both name browser push services, before any push is sent, and their summaries stop saying "no one else"                                                                                                | Both list recipients as members, contracted providers and authorities; push services are none of these and see the device address and the timing of care reminders              | asked: as recommended (the answer named the privacy policy; the health data policy gets the same disclosure so it stays true) | low: policy edits and their version dates      |
| Add `web-push` 4.0.0, pinned exactly, server only, used only inside `@caretook/notifications` behind a push sender of its own                                                                                                                                 | Message encryption is where a subtle mistake is invisible to our own round-trip tests                                                                                           | asked: as recommended                                                                                                         | low: one module behind the push sender         |
| Email and push are separate switches sharing one set of lead times and per-event overrides. The email unsubscribe link turns off email only                                                                                                                   | Otherwise unsubscribing from email would silently stop a member's push                                                                                                          | assumed                                                                                                                       | medium: changes who is reminded                |
| A subscription belongs to one session and one group membership. It is live only while the session is unexpired, and it is deleted with the session or the membership. Sign-out and any change of account on the device also remove the browser's subscription | Sign-out, an account switch, a revoked or expired session, a disabled account or leaving the group stops the pushes. A shared device doesn't keep notifying for the last person | assumed                                                                                                                       | medium: a migration                            |
| Push stops once a member's session expires, 7 days after they last used the app on that device, and the Reminders card says so                                                                                                                                | A device nobody has confirmed in a week shouldn't keep receiving care reminders. The cost: a member who relies only on the lock screen loses push until they open the app       | asked: as recommended                                                                                                         | medium: a different liveness rule              |
| Signing in again on a device needs push turned on again                                                                                                                                                                                                       | Follows from the rule above; it is the safe direction on a shared device                                                                                                        | assumed                                                                                                                       | low                                            |
| Subscription secrets are sealed at rest under a key derived from the private push key                                                                                                                                                                         | Rotating that key already invalidates every subscription, so no second secret is needed                                                                                         | assumed                                                                                                                       | medium: reseal or resubscribe                  |
| Push covers events and todos, by the existing reminder plan (todos to their assignee)                                                                                                                                                                         | The answer on content names both, and one plan already decides who gets what                                                                                                    | asked: as recommended                                                                                                         | low                                            |
| Without the push keys the feature is off: no card control, and the delivery step does nothing                                                                                                                                                                 | Merging can't break an environment that has no keys yet                                                                                                                         | assumed                                                                                                                       | low                                            |
| Web only; the native app shows no push control                                                                                                                                                                                                                | Native push is the later Capacitor work                                                                                                                                         | assumed                                                                                                                       | low                                            |
| On iPhone and iPad the control explains that push needs the app on the Home Screen                                                                                                                                                                            | Apple offers web push only to installed apps                                                                                                                                    | assumed                                                                                                                       | low: wording                                   |

## Problem

A caretaker who misses an email misses the visit. Reminders reach only an inbox today, and many caretakers live on their phone's lock screen rather than in their mail.

## Solution

A member turns on push for this device, per care group, on Calendar & reminders. At the same lead times as their email reminders, the device shows a discreet notification with only the kind and the time. Tapping it opens the event or todo in Caretook, where the signed-in member sees the details.

## User stories

1. As a caretaker, I want to turn on push reminders on this device for a care group, so that I hear about visits without checking email.
2. As a caretaker, I want to turn them off again on this device, so that I control what interrupts me.
3. As a caretaker, I want a push at my chosen lead times, so that it arrives when email would.
4. As a caretaker, I want the notification to show no names or details, so that nobody near my phone learns about someone's care.
5. As a caretaker, I want tapping it to open the event or todo, so that I can see the details at once.
6. As a todo's assignee, I want a push when it is due, so that it doesn't slip.
7. As a member, I want to unsubscribe from reminder email and keep push (or the reverse), so that I choose the channel.
8. As a member who mutes one event, I want no push for it either, so that a mute means quiet.
9. As someone signing out of a shared device, I want its pushes to stop, so that the next person doesn't get my reminders.
10. As a member leaving a group, I want its pushes to stop at once, so that I no longer hear about its care.
11. As a member reading the privacy policy, I want it to say that browser push services carry these messages, so that I know who is involved.

## Implementation decisions

- **Push subscription** (new table, system only, never synced): session, user, care group, the sealed subscription (endpoint and keys), audit columns. One per session and group. Cascades from the session and, by a composite foreign key on (group, user), from the `care_group_member` row, so removal from a group deletes it. **Live** means the session is unexpired and the account enabled, checked both when queuing and when delivering (nothing purges expired sessions). A member reads and changes only their own, through `calendars.push.status|subscribe|unsubscribe`. `status` gives the public key (so no build variable is needed), this device's state, and whether the member has any live subscription in the group.
- **The browser's subscription** is one per device and serves every group. Turning off one group removes only its row; the browser unsubscribes when this session's last group turns off. One bounded device helper unsubscribes it, called from `wipeDevice` and from the different-owner branch of the local database's `open`, before the next person can subscribe. The old endpoint then answers 404 or 410 and its row is deleted. The helper uses `getRegistration` (never `serviceWorker.ready`, which doesn't settle without a worker) under a time limit, so it can't hang sign-out.
- **The session id** reaches `calendars.push.*` through a small auth helper that reads the live session (no cookie cache), because `getAuthUser` carries no session id and the cache can serve a revoked session for up to 3 minutes. A revoked session can't subscribe.
- **Push delivery** (new table, system only): one row per subscription and reminder key (unique), cascading from the subscription so a queued retry can't go out after sign-out or removal. It holds the rendered title, body and app path, the status, attempts, next attempt and expiry. It follows the outbox's rules: `FOR UPDATE SKIP LOCKED`, the same backoff, skipped as expired once the item starts, purged after 30 days.
- **Push text** is one pure function of the item's kind and `calendarWhen`. It takes no share level, so it cannot carry details.
- **Push sender**: a small seam of its own beside the email `Sender`, with a real and a memory implementation. Results are sent, gone (404 or 410: delete the subscription) or retry. Its message TTL ends when the item starts.
- **The reminder sweep** queues push rows in its existing transaction, from the same `planReminders` sends. A new `pushDelivery` cron step runs before `seriesTopUp`.
- **Who is reminded:** a member with email on, or with a live subscription in that group, including a member with no settings row (who gets `DEFAULT_REMINDER_LEADS`). Email is queued only when email is on, and only email builds an unsubscribe path; push is queued only for live subscriptions.
- **The service worker** handles `push` (shows the notification) and `notificationclick` (focuses or opens the app path, same origin only), with the parsing in a pure module. No CSP or Permissions-Policy change is needed.
- **The settings page:** the Reminders card gains a per-device push control, and shows the lead times when either channel is on. "Remind me" (`effectiveLeads`, `remindSummary`) counts email or a live subscription on any of the member's devices, and its summary names the channels.
- **Env:** `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`; the VAPID subject is `APP_URL`. Added to the env example and the runbook.

## Testing decisions

- **Unit:** push text (a table proving no name, title, place or provider at either share level), payload parsing, the click target, the sealing round trip, the sender's status mapping.
- **Integration:** subscription RBAC and cascades (revoked session, leaving a group, queued deliveries going with them); an expired session gets nothing; the sweep and delivery with the memory sender (idempotent, expiry, retry, gone); the separate switches, a push-only member with no settings row, and the unsubscribe link.
- **Component or unit:** sign-out and an account switch unsubscribe the browser; a helper that fails or never settles can't hold up sign-out; turning off one group leaves the browser subscribed while another is on; the card states the 7-day rule.
- **Component:** the card's push states (unsupported, needs Home Screen, denied, off, on) and the lead times, beside the existing calendar card tests.
- **No browser check:** a real push service can't run in the checks. A hand test on a real phone goes in the plan's _Open_ notes for after staging has keys.
- Prior art: `reminders.int.test.ts`, `outbox.int.test.ts`, `calendarReminders` component tests, `serviceWorkerRoutes.test.ts`.

## Out of scope

- Native push through Capacitor.
- Push for anything but event and todo reminders.
- Details in a push, with or without consent.
- Per-channel lead times.
- A member's own time zone (the recipient's zone stays, as in email).

## Notes

- Staging and production need the two push keys set by the user before push works there. Merging without them is safe.
- **Held:** two skeptic passes sent this plan back. The user chose to apply all their fixes, keep the 7-day rule and land it with `hold` on (ask a138).
- Not verified: that the browser's `unsubscribe()` works offline on real phones. It is in the plan's hand test.
- The policy edits move each policy's `lastUpdated` and its legal version together. Existing accounts aren't asked to accept again, as with earlier versions (nothing is live).
