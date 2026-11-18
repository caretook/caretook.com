# Plan: Invites

> Source PRD: [`plans/invites-prd.md`](invites-prd.md). User-story numbers (US) refer to it. Backlog item B-30 (B-31, the demo group, is a later item). Topic `invites`.

## Status

| Slice | State                                                                   | Merge into `prd/invites` (slice commits) |
| ----- | ----------------------------------------------------------------------- | ---------------------------------------- |
| 1     | merged                                                                  | `e199ef1` (f1f6dc2, fe08cda, 36520d6)    |
| 2     | ready (waits for the user's go-ahead)                                   |                                          |
| 3     | blocked by 2 (and uses `routing` slice 5's Members subpage if in `dev`) |                                          |
| 4     | blocked by 3                                                            |                                          |
| 5     | blocked by 3                                                            |                                          |

Backlog: B-30 is claimed by `prd/invites`; mark it `done` after the last slice merges. Wave 1 = slices 1 and 2, landed together.

Notes from slice 1 for later slices:

- `@react-email/components` is deprecated on npm (React Email 6 moved its components into `react-email`), so slice 1 didn't add it: its templates use plain JSX in `packages/notifications/src/templates/layout.tsx`, rendered by `@react-email/render` 2.3.1. `resend` is 6.38.1. **The user has since approved `react-email` in its place (2026-11-18): slice 2 adds it and moves `layout.tsx` and `testMessage` onto its components.**
- Inside a transaction, `notify` only writes the outbox row. The caller calls `deliverSoon(id)` after commit. `setBackgroundRunner` is the hook for `waitUntil`.
- Browser checks read mail from `/dev/mail.json?to=…` (`links` included). It's a 404 under `NODE_ENV=production`, and `getMailConfig()` refuses `log` there, so `invites.mjs` needs the dev server, not `pnpm prd serve --built`.
- Resend open and click tracking are settings on the sending domain, not per message: a pre-launch setup step.
- `new.sh` (not `lib.sh`) writes `APP_URL` per worktree and a random `CRON_SECRET` when the main checkout has none. The main checkout's `apps/web/.env` has no `CRON_SECRET` yet, so `/api/cron/outbox` answers 503 there.

## Architectural decisions

Durable decisions every slice follows:

- **Package:** `@caretook/notifications` (server only): `NOTIFICATIONS` (a typed object of `defineNotification(...)`), `notify(name, { to, actor?, data, idempotencyKey, tx? })`, and the senders `resend | log | memory`, chosen by env (`MAIL_SENDER`, default `log` outside production and `resend` in production). Nothing outside it calls Resend.
- **Every email goes through the outbox**, written in the caller's transaction, auth emails included. Delivery happens after commit (`waitUntil` on Vercel, fire-and-forget in dev) and in the `/api/cron/outbox` sweep (`CRON_SECRET`).
- **No health details in any email**, links built from `APP_URL` only, a plain-text version always, and Resend tracking off.
- **Sign-up only with a ticket** (an invite token or an access code) through the server-only `signUpWithTicket`. Public sign-up, magic link and OTP never create accounts.
- **Acceptance, redemption and approval write as `system`** inside services. Screens call oRPC (these writes are online only), never local writes.
- **Shared routes stay client-only** (`/invite/:token`, `/join/:code`, `/reset-password`, `/verify-email`, sign-in). `/admin/*`, `/dev/mail` and `/api/cron/outbox` are web only. `/dev/mail` returns 404 in production.
- **Schema:** each landing wave has at most one migration for this PRD. Slices in one wave regenerate that wave's migration on top of each other (4 and 5: the orchestrator merges 4 first and has 5 regenerate). Registries are appended to, never reordered: `db/schema/index.ts`, `PERMISSIONS`, the router, `routes.ts`, `NOTIFICATIONS`.
- **New dependencies (approved; pin exactly):** `resend`, `react-email` (the components; it replaced the deprecated `@react-email/components`, approved 2026-11-18), `@react-email/render`, `qrcode` (+ `@types/qrcode`). Add each in the slice that first needs it (1: resend and `@react-email/render`; 2: `react-email`; 5: qrcode). Pin the `react-email` version that matches `@react-email/render` 2.3.1 (or move both together). `pnpm-workspace.yaml`'s `minimumReleaseAge` stays; pick versions old enough.
- **Env** (new, gitignored values in `.env` and documented in the `.env.example` files): `APP_URL`, `MAIL_SENDER`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_ALLOWLIST`, `CRON_SECRET`, `INVITE_LINK_KEY`. `scripts/loops/lib.sh` copies the secrets into new worktrees and sets `APP_URL` to the worktree's web port.
- **Seeds stay verified:** every `@example.com` seed user has `email_verified = true`, so existing browser checks keep signing in.
- **UI building blocks:** screens use `components`' primitives where landed; group settings' Members work goes into `routing` slice 5's Members subpage when it's in `dev` (otherwise today's group settings page, which `routing` then moves).

## How to run this plan

- **Slice 1 starts now**, beside `routing`, `providers` and `components`: it touches only a new package, the outbox and dev-mail tables, two web-only routes and env wiring.
- **2 after 1. 3 after 2.** Before 3, check whether `routing` slice 5 (group settings subpages) is in `dev`, and sync.
- **4 and 5 after 3, in parallel.** Merge 4 first; 5 regenerates the wave's migration on top.
- Merge in number order. After each merge, run `invites.mjs` plus the budget's checks for the areas touched: `sign-in.mjs` and `app-shell.mjs` (slices 2, 3, 4, 5: sign-in and group settings), `first-sync.mjs` (slices 4 and 5: home's new states). The full suite runs once per landing.
- **Land in waves:** 1 and 2 together (better sign-in, verification and reset); then 3 (email invites, enough to bring family in); then 4 and 5.
- Every slice ends with `pnpm check`, `pnpm build:native`, its checks and a hand-off (AGENTS.md, _Loop rules_).

```
1 ── 2 ── 3 ──┬── 4
              └── 5
routing 5 (Members subpage) → 3, soft
```

---

## Slice 1: The notifications package and the outbox

**User stories:** US 37–45. **Blocked by:** none. **Blocks:** 2.

### What to build

`@caretook/notifications`: `defineNotification`, the typed `NOTIFICATIONS` (one entry for now, `testMessage`, used by tests and the dev mailbox), React Email rendering to HTML and plain text, Zod validation of data, links from `APP_URL`, and the allowlist outside production. Senders: `memory` (tests), `log` (writes `dev_mail` rows), `resend` (checks `{ error }`; refuses to start without `RESEND_API_KEY` in production; tracking off; passes the idempotency key). The `notification_outbox` table (system-only) and `notify(...)` writing to it in the caller's transaction. Delivery after commit plus `deliverDue({ limit: 100 })` claiming rows with `FOR UPDATE SKIP LOCKED`, exponential backoff, failure after 8 attempts, and a 30-day purge of sent rows. The web-only `/api/cron/outbox` (`CRON_SECRET` bearer) and `/dev/mail` (list, view HTML and text, a JSON endpoint; 404 in production). `datastore:reset` clears `dev_mail`. Env vars documented and copied into worktrees.

### Acceptance criteria

- [ ] Unit: bad data is refused before rendering; every template renders a subject and non-empty text; links use `APP_URL`; a non-allowlisted address isn't sent outside production.
- [ ] Integration: a `notify` inside a rolled-back transaction leaves no row; delivery marks sent; a failing sender backs off and retries; two concurrent sweeps never send one row twice; purge removes old sent rows.
- [ ] `/api/cron/outbox` refuses a missing or wrong secret, and delivers due rows with the right one.
- [ ] In a loop worktree, a `testMessage` sent from a script shows up at `/dev/mail` with its HTML, text and links; `/dev/mail` is a 404 with `NODE_ENV=production` (`pnpm build` then start).
- [ ] `pnpm build:native` succeeds (nothing from the package reaches the native bundle).
- [ ] `pnpm check` passes; `sign-in.mjs` and `app-shell.mjs` pass unchanged.

---

## Slice 2: Account emails

**User stories:** US 31–36, 39. **Blocked by:** 1. **Blocks:** 3.

### What to build

First, add `react-email` (pinned) and move slice 1's `layout.tsx` and `testMessage` onto its components, keeping the HTML and plain-text output tests green. Then notifications `verifyEmail`, `resetPassword`, `magicLink` and `signInCode`, wired into Better Auth's callbacks through `notify` (never awaited in the request). `requireEmailVerification: true` (seed users stay verified). The `magicLink` and `emailOTP` plugins with `disableSignUp: true`. The sign-in page gains "Email me a link", "Email me a code" (a 6-digit input) and "Forgot password?". New shared, client-only routes `/reset-password` (from the emailed link) and `/verify-email` (the landing page, plus a "Resend" for an unverified account that tries to sign in). Every message about an email address is the same whether or not an account exists. Start `invites.mjs`, reading mail from `/dev/mail`.

### Acceptance criteria

- [ ] Magic link: the emailed link signs an existing user in and lands on `/app`; for an unknown email the page says the same thing and no account is created.
- [ ] Code: the emailed 6-digit code signs in; a wrong or expired code is refused; unknown emails get the same message.
- [ ] Reset: the emailed link sets a new password; the old one stops working; the link works once.
- [ ] An unverified account can't reach `/app`; it gets the verify page and can resend; clicking the emailed link verifies it.
- [ ] Sign-in's double-submit protection (B-1) still holds for every method.
- [ ] `invites.mjs` covers the above; `sign-in.mjs`, `app-shell.mjs` and `first-sync.mjs` pass.

---

## Slice 3: Email invites

**User stories:** US 1–12, 20, 46–48. **Blocked by:** 2. **Blocks:** 4, 5.

### What to build

The migration for `care_group_invite` (`kind`, nullable `email`, `max_uses`, `use_count`, the attestation fields, `consent_version`) and `care_group_consent`. The pure `inviteRules` (`canInvite`, `linkRoleAllowed`, `inviteState`, `emailMatches`, `CONSENT_TEXT` with its version). `signUpWithTicket` for invite tokens (the invite's email, created verified). `careGroupInviteService`: email create with the attestation, `resend` (rotates the token), `accept` (matching verified email → membership plus a consent row, idempotent) and `decline`. Notification `groupInvite`. oRPC `invite.*` for email invites and the public `invite.preview`. The `/invite/:token` route (preview → sign up or sign in → consent → Join, or Decline; the wrong-email state; plain messages for expired, revoked and accepted invites). On the Members page: an **Invite** button (owners and admins) with email, role and the attestation checkbox, and a **Pending** list (role, sender, expiry, resend, revoke). Members shows who invited whom and when someone joined.

### Acceptance criteria

- [ ] An owner invites a new address; the mail at `/dev/mail` names the group and inviter with no health details; the invitee signs up with the email locked, sees the consent text, joins as the invited role, and the group's timeline syncs.
- [ ] An existing user invited by email signs in from the link and joins; signed in as someone else, they're told the invite is for another address.
- [ ] Decline marks the invite declined; expired, revoked and accepted links say so without the recipient's details.
- [ ] Only owners can invite owners; caretakers and viewers see no Invite button and their API calls are refused.
- [ ] Resend sends a new link and the old one stops working; revoke stops it at once.
- [ ] Consent is recorded with the version, and the attestation is on the invite.
- [ ] Unit tests for `inviteRules`; integration tests for create, accept, decline, resend, revoke and `signUpWithTicket`.
- [ ] `invites.mjs` covers the above; `app-shell.mjs` passes.

---

## Slice 4: Link invites and join requests

**User stories:** US 13–19. **Blocked by:** 3. **Blocks:** none.

### What to build

Link invites: `createLink` (role caretaker or viewer, expiry 1–90 days defaulting to 7, optional maximum uses), the token kept encrypted with `INVITE_LINK_KEY` so `invite.copyLink` can return it while it's active, and `use_count`. `care_group_join_request` (in this wave's migration) and `joinRequestService` (`approve`, `decline`, `withdraw`). Accepting a link creates (or returns) a pending request, records consent and notifies owners and admins (`joinRequested`); approval and decline notify the requester (`joinApproved`, `joinDeclined`). The `/invite/:token` page's link variant ("Ask to join"). On the Members page: "Create a link" in Invite, active links in Pending (copy, share through the Web Share API or clipboard as Share does, uses, revoke), and a **Requests** list (name, email, role, approve, decline). On `/app` home: "Waiting for approval: <group>" for the requester, which turns into the group once the membership syncs.

### Acceptance criteria

- [ ] An admin creates a viewer link; a new user signs up through it, consents and sees "Waiting for approval" with no group data on the device.
- [ ] Owners and admins get the `joinRequested` mail; approving makes the requester a member and their home shows the group without a reload; declining tells them.
- [ ] A link can't grant owner or admin (UI and API); maximum uses and expiry are enforced; revoke stops it.
- [ ] The same user using a link twice has one request.
- [ ] Copying an active link works on a second device; an email invite's token can't be read back.
- [ ] Integration tests for links, requests and notifications.
- [ ] `invites.mjs` covers the above; `app-shell.mjs` and `first-sync.mjs` pass.

---

## Slice 5: Creating groups and access codes

**User stories:** US 21–30. **Blocked by:** 3. **Blocks:** none.

### What to build

`careGroup.create` (the group and its recipient in one transaction, the creator as owner; the recipient's time zone if `care_recipient.time_zone` exists by then). The **New care group** sheet (from the group menu and `/app` home): who you care for (name, preferred name), a group name defaulting to "<preferred or first name>'s care", then the new group's timeline. An **Invite someone** card on the timeline for owners and admins of a group with no other members. `access_code` and `access_code_redemption` (in this wave's migration), `accessCodeService` (create, revoke, redeem in the sign-up transaction) and the public `accessCode.preview`. The `/join/:code` route (account form, then the same "who do you care for" form). Web-only `/admin` (global `admin`, server loaders allowed): **Access codes** (list with redemptions, create with label, expiry and maximum uses, revoke, and a print page with an SVG QR from `qrcode` plus the URL and code in large type) and **New group** (group name, recipient name, owner email → `ownerInvite`). Admin screens show no care data. Seed one access code.

### Acceptance criteria

- [ ] A signed-in user creates a second group and lands on its empty timeline with the invite card; the group menu lists it.
- [ ] Scanning (opening) a code's URL as a new person: sign up, create a group, land as its owner; the redemption is recorded.
- [ ] Expired, revoked and used-up codes are refused with a plain message.
- [ ] `/admin` is refused for non-admins (including group owners); admin@ can create a code, print it (the QR decodes to the URL; check it with a screenshot), and create a group with an owner invite whose mail arrives.
- [ ] Integration tests for `careGroup.create`, redeem (one transaction), and admin-only access.
- [ ] `invites.mjs` covers the above; `app-shell.mjs` and `first-sync.mjs` pass.

---

## For the orchestrator

- **Claim:** B-30 when slice 1 starts. Mark it `done` after the last slice merges.
- **Before slice 3,** check whether `routing` slice 5 is in `dev`; if not, build on today's group settings page and tell `routing`'s orchestrator what moved.
- **Secrets:** the loops need `CRON_SECRET` and `INVITE_LINK_KEY` (any random values locally). Real Resend sending isn't needed for any slice; ask the user before using a real key, and only send to `MAIL_ALLOWLIST`.
- **AGENTS.md at landing:** turn _Planned: notifications_ into a built section (the package, the outbox, dev mail, env), update _Auth_ (sign-in methods, verification, tickets), the invite rows in the permissions table, the API procedure list, the Members page, and close the open questions this settles (invites, consent, email delivery). Add `invites.mjs` to the browser check list and the budget table.
- **Before production** (not this plan, but say so in the last hand-off): the sending subdomain's SPF, DKIM and DMARC, bounce webhooks, rate-limit storage, and the cron schedule on the host.
