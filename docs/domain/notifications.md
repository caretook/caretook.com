# Notifications (`packages/notifications`)

The notifications area's rules and decisions, moved out of AGENTS.md (whose core rules still apply). An orchestrator folds a landing's lasting decisions for this area in here.

✅ `@caretook/notifications`, server only, usable from the API, Better Auth callbacks and workers. Nothing outside it calls Resend.

- **Built:**
  - `NOTIFICATIONS` (`registry.ts`): `testMessage`, `resetPassword`, `verifyEmail`, … `accessCodeExistingAccount`, `signInEmail` (appended last; it replaced `magicLink` and `signInCode`). Templates are `react-email` 6.11.13 components (it replaced the deprecated `@react-email/components`), rendered to HTML and plain text by `@react-email/render` 2.3.1. Data is checked with Zod before rendering; links come only from `APP_URL` and must be app paths (`templates/appPath.ts`).
  - `notify(name, { to, actor?, data, idempotencyKey, tx?, deliver? })` writes a `notification_outbox` row in the caller's transaction (a repeated key queues nothing). **Every email goes through the outbox, auth emails included.** Outside a transaction it starts delivery at once; inside one, call `deliverSoon(id)` after commit. `setBackgroundRunner` is the hook for Vercel's `waitUntil`.
  - Delivery: `deliverDue({ limit ≤ 100 })` claims rows `FOR UPDATE SKIP LOCKED` (and retakes rows stuck in `sending` over 10 min); backoff doubles from 1 min to 6 h, failed after 8 attempts; `purgeSent` drops sent rows after 30 days. The web-only `/api/cron/outbox` runs `sweepOutbox` behind a `CRON_SECRET` bearer (401 without it, 503 when unset).
  - Senders by `MAIL_SENDER`: `log` (dev default; writes `dev_mail`), `memory` (tests), `resend` (checks `{ error }`, passes the idempotency key; outside production only `MAIL_ALLOWLIST` addresses or `@domain`s, others marked `skipped`). Production refuses to start without `RESEND_API_KEY` and `APP_URL`, and refuses `log` or `memory`.
  - **The dev mailbox:** web-only `/dev/mail` (list, `?to=`), `/dev/mail/:id` (HTML in a sandboxed iframe, text, links) and `/dev/mail.json` (`?to=`, `?limit=`, `?id=`; what browser checks read). All 404 in a real production build. **A check build is the one exception** (`isCheckBuild` in `config.ts`): `VITE_CHECK_BUILD=1` baked in at build time and set at run time by `serve.sh --built`, with a `localhost` or `127.0.0.1` `APP_URL`. There the `log` sender and the mailbox work, so `invites.mjs` runs on check builds like every other check.
  - **Env** (documented in `apps/web/.env.example`): `APP_URL`, `MAIL_SENDER`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_ALLOWLIST`, `CRON_SECRET`, `INVITE_LINK_KEY`. `new.sh` sets each worktree's `APP_URL` to its own web port and gives it a random `CRON_SECRET` when the main checkout has none. Without `APP_URL` links default to `http://localhost:5173`, so an older worktree's mail points at the main checkout: add `APP_URL` to its `apps/web/.env`.
- **Before launch:** Resend's open and click tracking are settings on the sending domain, not per message, so turn them off there; plus SPF, DKIM and DMARC on the sending subdomain, the bounce webhooks, and the cron schedule on the host.
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
- **Next:** tracking off, bounces and DNS. Later: digests, preferences, push through Capacitor, the AWS worker.
