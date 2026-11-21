# Notifications (`packages/notifications`)

The notifications area's rules and decisions, moved out of AGENTS.md (whose core rules still apply). An orchestrator folds a landing's lasting decisions for this area in here.

✅ `@caretook/notifications`, server only, usable from the API, Better Auth callbacks and workers. Nothing outside it calls Resend.

- **Built:**
  - `NOTIFICATIONS` (`registry.ts`): `testMessage`, `resetPassword`, `verifyEmail`, … `accessCodeExistingAccount`, `signInEmail` (it replaced `magicLink` and `signInCode`), `appointmentReminder` and `taskDue` ([calendars](calendars.md): generic wording by default, details by consent; keys per recipient, item, lead and start). A definition may add `headers(message, ctx)`, worked out at send time from the row's idempotency key (the outbox stores none) and passed to Resend: the reminders' `List-Unsubscribe` and one-click `List-Unsubscribe-Post`. Templates are `react-email` 6.11.13 components (it replaced the deprecated `@react-email/components`), rendered to HTML and plain text by `@react-email/render` 2.3.1. Data is checked with Zod before rendering; links come only from `APP_URL` and must be app paths (`templates/appPath.ts`).
  - `notify(name, { to, actor?, data, idempotencyKey, tx?, deliver? })` writes a `notification_outbox` row in the caller's transaction (a repeated key queues nothing). **Every email goes through the outbox, auth emails included.** Outside a transaction it starts delivery at once; inside one, call `deliverSoon(id)` after commit. `setBackgroundRunner` is the hook for Vercel's `waitUntil`: `entry.server.tsx` sets it once when `VERCEL` is set, and runners get work that's already caught (failures go to `logError`).
  - Delivery: `deliverDue({ limit ≤ 100 })` claims rows `FOR UPDATE SKIP LOCKED` (and retakes rows stuck in `sending` over 10 min); backoff doubles from 1 min to 6 h, failed after 8 attempts; `purgeSent` drops sent rows after 30 days. The web-only `/api/cron/outbox` runs `sweepOutbox` behind a `CRON_SECRET` bearer (401 without it, 503 when unset); Vercel calls it every minute (`vercel.json` `crons`, region `cle1`), and the deploy smoke check expects its 401. `sweepOutbox` also purges rate-limit rows older than the longest window (`rateLimitService.purge`, `rateLimitsPurged` in its result).
  - Senders by `MAIL_SENDER`: `log` (dev default; writes `dev_mail`), `memory` (tests), `resend` (checks `{ error }`, passes the idempotency key; outside production, **and on staging** (`MailConfig.allowlisted`), only `MAIL_ALLOWLIST` addresses or `@domain`s, others marked `skipped`). Production refuses to start without `RESEND_API_KEY` and `APP_URL`, and refuses `log` or `memory`.
  - **The dev mailbox:** web-only `/dev/mail` (list, `?to=`), `/dev/mail/:id` (HTML in a sandboxed iframe, text, links) and `/dev/mail.json` (`?to=`, `?limit=`, `?id=`; what browser checks read). All 404 in a real production build. **A check build is the one exception** (`isCheckBuild` in `config.ts`): `VITE_CHECK_BUILD=1` baked in at build time and set at run time by `serve.sh --built`, with a `localhost` or `127.0.0.1` `APP_URL`. There the `log` sender and the mailbox work, so `invites.mjs` runs on check builds like every other check.
  - **Env** (documented in `apps/web/.env.example`): `APP_URL`, `MAIL_SENDER`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_ALLOWLIST`, `CRON_SECRET`, `INVITE_LINK_KEY`. `new.sh` sets each worktree's `APP_URL` to its own web port and gives it a random `CRON_SECRET` when the main checkout has none. Without `APP_URL` links default to `http://localhost:5173`, so an older worktree's mail points at the main checkout: add `APP_URL` to its `apps/web/.env`.
- **The calendar cron** (web-only `/api/cron/calendar`, `packages/notifications/src/calendarCron.ts`, behind the same `CRON_SECRET`, every minute in `vercel.json`, so two crons): `CALENDAR_STEPS` run in order, each isolated and bounded; a step's throw or returned error is logged and never stops the next. Steps: `reminders` (`sweepReminders`), `googlePush`, `googlePull`, `seriesTopUp` ([calendars](calendars.md), [appointments](appointments.md)). A new step goes before `seriesTopUp`.
- **Suppression** (hosting slice 4): `email_suppression` (address lower-cased, reason `bounce` | `complaint`, a unique event id, cleared at/by/reason; one active row per address). `deliverDue` checks a batch's recipients once: a suppressed one's row is `skipped` with error `suppressed`, except `SUPPRESSION_EXEMPT` (`signInEmail`, `resetPassword`, `verifyEmail`), which always send; a failed read retries the row. Outbox statuses gain `bounced` and `complained` (purged like sent rows).
- **The Resend webhook** (web-only `POST /api/webhooks/resend`, `handleResendWebhook`): `verifyWebhook` (pure, `node:crypto`) checks Svix's `svix-id`/`-timestamp`/`-signature` (HMAC-SHA256 over `id.timestamp.body` with the base64 secret after `whsec_`, any of several `v1,` signatures, 5-minute tolerance, constant-time) against `RESEND_WEBHOOK_SECRET`. 401 on a bad signature, 503 without the secret, 405 for other methods, 413 over 256 KB. A permanent `email.bounced` or an `email.complained` marks the outbox row (by `providerMessageId`, saved at send) and suppresses the address, in one transaction; anything else, and a repeated Svix id, is a 200 that changes nothing. Never logs the body. Staff clear suppressions in [admin](admin.md).
- **Before launch:** Resend's open and click tracking are settings on the sending domain, so turn them off there; plus SPF, DKIM and DMARC on the sending subdomain, and the webhook endpoint for `email.bounced` and `email.complained` ([`ops/runbook.md`](../../ops/runbook.md)).
- **Design rules:**

- **Typed registry:** `defineNotification({ name, data: zod, email: (data, { recipient }) => ({ subject, react }), push? })` in `NOTIFICATIONS = { … } as const`, sent with `notify(name, { to, actor?, data })`.
  - Never type the registry as `Record<string, …>`: that makes every string a valid name and loses the link between name and data.
  - Validate data before rendering.
  - One function per channel.
- **Links and text:** templates get plain data plus a configured `APP_URL`. **Never build links from the request Host header** (password-reset poisoning). Always send a plain-text version.
- **Senders:** `resend` (production), `log` (dev) and `memory` (tests).
  - Check Resend's `{ error }`; it doesn't throw.
  - Production refuses to start without `RESEND_API_KEY`.
  - Outside production, only allowlisted recipients get real email.
- **Health-app rules:**
  - No health details in subjects or bodies by default (opt-in only, with consent recorded).
  - Resend open and click tracking off.
  - Tokens single-use, short-lived and stored hashed, never raw in the outbox.
  - Don't await auth emails (timing leaks whether an account exists), but don't leave them unawaited on Vercel either: use `waitUntil` or the outbox.
  - Verify the bounce webhooks (Svix).
  - Send from a subdomain with SPF, DKIM and DMARC.
  - `List-Unsubscribe` on optional mail.
  - Times in the recipient's zone.
- **Next:** tracking off and DNS (the runbook). Later: digests, preferences, push through Capacitor, the AWS worker.
