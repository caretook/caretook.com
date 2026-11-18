# PRD: Invites (accounts by invitation, group invites, sign-in by email, the notifications outbox)

Status: 🟡 planned in [`invites-plan.md`](invites-plan.md) (5 slices; slice 1 can start now). Backlog item: B-30. Topic `invites`. Mostly server work (a new notifications package, auth, the API, new tables) plus a few new screens; it barely touches the screens `routing` and `components` are rewriting, so it can run beside them. Its group settings screens use `routing`'s Members subpage.

## Problem Statement

Nobody can join Caretook today. Sign-up is turned off, there's no way to create a care group, and although the database can hold an invite, nothing sends one or lets anyone accept it. Every account and group comes from seed data. Caretakers can't bring in a sibling, a home aide or a neighbour, and new families can't start at all.

Signing in is also harder than it needs to be. Many caretakers are older, sign in rarely, and won't remember a 12-character password, and nobody can reset one, because the app can't send email.

Sharing a person's health information with a new member also needs care: the person invited should understand what they'll see, and the inviter should confirm the recipient agreed to share it, with both recorded.

## Solution

**Caretook is invitation-only.** An account is always created through an invitation, of one of three kinds:

- **Group invite by email.** An owner or admin enters someone's email and a role, and confirms the recipient agreed to share with them. Caretook emails a link. The person signs in or creates an account **with that address**, reviews what the group shares, agrees, and joins with that role. Their email is verified by the act of accepting.
- **Group invite link.** An owner or admin creates a link (role caretaker or viewer only, an expiry, and an optional number of uses) and shares it however they like: a text, WhatsApp, or the share sheet. Anyone with the link can create an account or sign in, but they don't join yet: they **ask to join**. Owners and admins get an email, and approve or decline from the Members page. Until approved, the requester sees nothing of the group.
- **Access code.** Staff create codes for people starting a new group (multi-use, with a label, an expiry and a maximum number of uses), and print them as a QR code with the link. A code lets someone create an account and **create their own care group** as its owner. How codes are handed out (flyers, clinics) is decided later.

**Once in, anyone can create another care group** (who they care for, the group's name). Staff can also create a group with an owner invite from an admin page.

**Signing in** works three ways: email and password, a **magic link** by email, or a **6-digit code** by email (better inside the future native app). Email verification is required. A forgotten password is reset by an emailed link.

**Email** goes through a typed notifications package with an outbox, so a send is never lost and never sent twice. In development, mail goes to a local mailbox page that developers and browser checks read.

## User Stories

1. As an owner, I want to invite someone by email with a role, so that they can join our care group.
2. As an owner, I want to confirm that the care recipient (or their representative) agreed to share with this person before I send an invite, so that we respect their privacy.
3. As an invited person, I want an email with a clear link that names the group and who invited me, without health details, so that I know it's genuine.
4. As an invited person without an account, I want the link to let me create one with my email already filled in, so that joining takes one form.
5. As an invited person with an account, I want the link to sign me in and take me to the invite, so that I don't hunt for it.
6. As an invited person, I want to see what the group shares (the recipient's timeline, notes, vitals, medications and providers) and agree before joining, so that I know what I'm taking on.
7. As an invited person, I want to decline an invite, so that the inviter knows.
8. As an invited person signed in with a different email, I want to be told the invite is for another address and offered to sign out, so that I'm not confused.
9. As an owner, I want an invite link to work only for the invited email, so that a forwarded email can't be used by someone else.
10. As an owner, I want invites to expire after 7 days, so that old links stop working.
11. As an owner or admin, I want to see pending invites with their role, sender and expiry, so that I know who hasn't joined.
12. As an owner or admin, I want to resend or revoke a pending invite, so that I can fix a typo or change my mind.
13. As an owner or admin, I want to create an invite link with a role, an expiry and a maximum number of uses, so that I can share it by text.
14. As an owner, I want link invites limited to caretaker or viewer, so that a leaked link can never make someone an owner or admin.
15. As an owner or admin, I want people who use a link to wait for my approval, so that a stranger with the link sees nothing.
16. As an owner or admin, I want an email when someone asks to join, so that I can respond quickly.
17. As an owner or admin, I want to approve or decline join requests from the Members page, seeing their name and email, so that I know who they are.
18. As someone who asked to join, I want to see that my request is pending, and be told when it's approved or declined, so that I'm not left guessing.
19. As an owner or admin, I want to copy, share and revoke active links, and see how many times each was used, so that I stay in control.
20. As an owner, I want only owners to invite owners by email, as the service already enforces, so that ownership stays deliberate.
21. As a new family, I want to scan a printed QR code, create an account and set up my care group, so that I can start without knowing anyone already using Caretook.
22. As a person with an access code, I want a short form (my name, email, password or email sign-in, who I care for), so that setup is quick.
23. As staff, I want to create access codes with a label, expiry and maximum uses, so that we can track where people came from.
24. As staff, I want a printable page with a code's QR and URL, so that we can put it on flyers.
25. As staff, I want to see how many people redeemed each code, and revoke it, so that we control access.
26. As staff, I want to create a care group with its recipient and send an owner invite, so that we can onboard a family by hand.
27. As staff, I want no access to care data through these admin pages, so that the health-data rules hold.
28. As a signed-in user, I want to create another care group, so that I can coordinate care for a second person.
29. As a signed-in user creating a group, I want to give the recipient's name and preferred name, and get a default group name, so that it's fast.
30. As a new owner, I want to land on the empty timeline with a prompt to invite people, so that I know what to do next.
31. As a user, I want to sign in with a link sent to my email, so that I don't need a password.
32. As a user, I want to sign in with a 6-digit code sent to my email, so that I can sign in inside the app without switching to my mail app.
33. As a user, I want to reset a forgotten password by email, so that I'm never locked out.
34. As a user, I want my email verified before I can use the app, so that invites and resets reach me.
35. As a user who just accepted an email invite, I want that to count as verifying my email, so that I'm not asked twice.
36. As a user, I want sign-in errors that don't reveal whether an email has an account, so that my membership stays private.
37. As a user, I want emails to arrive even if the email service has a hiccup, so that I'm not stuck waiting.
38. As a user, I want each email exactly once, so that I'm not confused by duplicates.
39. As a user, I want every email to have a plain-text version, so that it's readable anywhere.
40. As a developer, I want a typed list of notifications, where sending one checks its data, so that templates never get the wrong fields.
41. As a developer, I want a local mailbox page in development, so that I can click links and read codes without a real inbox.
42. As a developer, I want real email sent only to an allowlist outside production, so that tests never mail strangers.
43. As a developer, I want sends recorded in an outbox in the same transaction as the change, so that an invite and its email can't disagree.
44. As an operator, I want the outbox swept on a schedule with backoff, so that failed sends retry.
45. As an operator, I want sent outbox rows purged after a while, so that the table stays small.
46. As a privacy-conscious group, I want consent recorded (who agreed, when, for which group, and the text they saw), so that we can show it later.
47. As a member, I want the Members page to show who invited whom and when someone joined, so that the group's history is clear.
48. As a non-member, I want an expired, revoked or used invite to say so plainly without naming the group's recipient, so that nothing leaks.

## Implementation Decisions

- **Depends on:** nothing to start (data, auth and the notifications package). The Members page work uses `routing` slice 5's Members subpage once it's in `dev`; the user-facing screens use `components`' primitives where landed. `care_recipient.time_zone` (planned by `medications`) is added by whichever PRD lands first, the other reusing it.
- **New package `@caretook/notifications`** (server only):
  - `defineNotification({ name, data: zod, email: (data, { recipient }) => ({ subject, react }) })` in a typed `NOTIFICATIONS` object (never `Record<string, …>`).
  - `notify(name, { to, actor?, data, idempotencyKey, tx? })` validates the data, renders HTML and plain text (React Email), and writes an outbox row in the caller's transaction.
  - Senders: `resend` (production; refuses to start without `RESEND_API_KEY`; checks `{ error }`), `log` (dev: stores mail for the dev mailbox), `memory` (tests). Outside production, only allowlisted addresses (`MAIL_ALLOWLIST`) get real email.
  - Links are built from a configured `APP_URL`, never the request's Host header.
  - Templates carry no health details. Resend open and click tracking are off.
- **Outbox:** a `notification_outbox` table: name, recipient, rendered subject, HTML and text, a unique `idempotency_key` (also passed to Resend), status `pending | sending | sent | failed`, attempts, `next_attempt_at`, last error, timestamps; system-only permissions.
  - Delivery: right after the transaction commits, through `waitUntil` on Vercel and fire-and-forget in dev. Plus a sweep at `/api/cron/outbox` (`CRON_SECRET`): batches of up to 100 claimed with `FOR UPDATE SKIP LOCKED`, exponential backoff, failed after 8 attempts, sent rows purged after 30 days.
  - **Auth emails** (verification, reset, magic link, OTP) also go through the outbox, so a request never awaits a send (no timing leak) and Vercel never drops one.
- **Notifications in v1:** `groupInvite`, `joinRequested` (to owners and admins), `joinApproved`, `joinDeclined`, `verifyEmail`, `resetPassword`, `magicLink`, `signInCode`, `ownerInvite` (staff-created group).
- **Schema (one migration):**
  - **`care_group_invite`** gains `kind` (`email | link`); `email` becomes nullable (required for email invites, null for links); `max_uses` (nullable) and `use_count`; `consent_attested_by` and `consent_attested_at` (required for email invites); `consent_version`. Link invites don't use the one-pending-per-email rule. **The token is stored hashed and shown once.** A link invite's URL can be copied again only while it's active, so a link invite keeps its token **encrypted** (with `INVITE_LINK_KEY`) so owners and admins can copy it again. Email invites keep only the hash.
  - **`care_group_join_request`:** `group_id`, `user_id`, `invite_id`, `role`, status `pending | approved | declined | withdrawn`, `decided_by`, `decided_at`, timestamps, audits; one pending request per group and user.
  - **`care_group_consent`:** `group_id`, `user_id`, `kind` (`joiner`), `consent_version`, `invite_id`, `created_at`. Append-only and system-written. The inviter's attestation lives on the invite.
  - **`access_code`:** `code` (human-friendly, e.g. `CARE-7K3M-Q9TD`, unique, case-insensitive), `label`, `expires_at`, `max_uses`, `use_count`, `revoked_at`, timestamps, audits. Staff-only (global `admin`) permissions. **`access_code_redemption`:** `code_id`, `user_id`, `group_id`, `created_at`.
  - **`user.email_verified`** is Better Auth's existing column; nothing new.
- **Permissions:** invites (both kinds) are created, revoked and listed by owners and admins (owners only for owner email invites; links cap at caretaker and viewer). Join requests are read and decided by owners and admins, and the requester reads their own. Consent rows are readable by the group's owners and admins and by the member themselves. Access codes and redemptions are admin-only. Everything is created through services, with acceptance and redemption running as `system`.
- **Pure rules module (`inviteRules`):**
  - `canInvite({ actorRole, targetRole, kind })`;
  - `linkRoleAllowed(role)`;
  - `inviteState({ invite, now })` → usable, expired, revoked, used up or accepted;
  - `emailMatches(invite, user)` (case-insensitive, trimmed);
  - `codeState`;
  - `CONSENT_TEXT` with its version, one source for the screen and the record.
- **Services:**
  - `careGroupInviteService` gains `createLink`, `resend` (rotates the token and requeues the email), `accept(token)` and `decline(token)`.
  - `accept`, for an email invite: the signed-in user's verified email must match. It creates the membership and the consent row, marks the email verified, and sets the invite accepted (idempotent).
  - `accept`, for a link: it checks state and uses, creates a pending join request (or returns the existing one), bumps `use_count`, records consent, and notifies owners and admins.
  - `joinRequestService.approve | decline | withdraw`: approve creates the membership with the request's role.
  - `accessCodeService.create | revoke | redeem` (redeem is in the same transaction as sign-up: it creates the account's group and recipient, makes them owner, and records the redemption).
  - `careGroupService.create` (exists) gains the recipient in the same transaction.
- **Auth (Better Auth):**
  - **Sign-up is allowed only with a ticket.** `disableSignUp` stays on for public sign-up. A server-only `signUpWithTicket({ ticket, name, email, password? })` checks an invite token or access code first and then creates the user. For an email invite, the email must equal the invite's, and the account is created verified.
  - `requireEmailVerification: true`.
  - The `magicLink` and `emailOTP` plugins, with `disableSignUp: true`, so they sign in existing users only.
  - `sendResetPassword`, `sendVerificationEmail`, `sendMagicLink` and `sendVerificationOTP` call `notify`.
  - Responses never reveal whether an email has an account (the same message and timing).
  - Rate limits stay as they are (in-memory); production storage is still open.
- **API (oRPC):**
  - `invite.listForGroup`, `invite.createEmail`, `invite.createLink`, `invite.resend`, `invite.revoke`, `invite.copyLink`;
  - `invite.preview(token)` (public: the group's display name, the inviter's name, the role and state; no recipient details beyond the display name, and nothing for an unusable token);
  - `invite.accept` and `invite.decline`;
  - `joinRequest.list`, `joinRequest.approve`, `joinRequest.decline` and `joinRequest.mine`;
  - `careGroup.create`;
  - `accessCode.preview(code)` (public: usable or not).

  Admin procedures are `adminProcedure` (global `admin`): `admin.accessCode.list | create | revoke` and `admin.careGroup.createWithOwnerInvite`. Public profiles only, as before.

- **Screens:**
  - **`/invite/:token`** (shared, client-only; works in both builds). It shows the preview, then:
    - signed out: create an account (email prefilled and locked for email invites) or sign in;
    - signed in with the wrong email: a message offering to sign out;
    - signed in: the consent screen (what the group shares, a checkbox with `CONSENT_TEXT`), then Join (email invite) or Ask to join (link), or Decline.
  - **`/join/:code`** (access codes): an account form, then "Who do you care for?" (name, preferred name, a group name defaulting to "<preferred or first name>'s care"), then the new group's timeline with an invite prompt.
  - **Sign-in** gains tabs or links for "Email me a link" and "Email me a code" (a 6-digit input), and "Forgot password?", plus **`/reset-password`** and **`/verify-email`**.
  - **Pending join requests** (the requester): `/app` home lists "Waiting for approval: <group>", which updates live once approved (the membership syncs).
  - **Create a group:** "New care group" in the group menu and on `/app` home opens a sheet with the same "Who do you care for?" form.
  - **Members (group settings):**
    - an **Invite** button (owners and admins) with two choices: by email (email, role, the attestation checkbox) or create a link (role caretaker or viewer, expiry 1–90 days defaulting to 7, optional maximum uses);
    - a **Pending** list: email invites (resend, revoke) and active links (copy, share, revoke, uses);
    - a **Requests** list: approve or decline, with the requester's name and email.

    Online only, like other group settings writes.

  - **Empty timeline prompt:** for a new group with no other members, an "Invite someone" card on the timeline for owners and admins.
  - **Admin** (web only, server loaders allowed, global `admin`): `/admin` with **Access codes** (list with redemptions, create, revoke, a print page with an SVG QR via `qrcode` and the URL in large type) and **New group** (group name, recipient name, owner email → an `ownerInvite`). Staff see counts and names they entered, never timeline, medication or provider data. Admin actions are audited (`created_by`).
- **Dev mailbox:** the `log` sender stores mail in a dev-only table, `dev_mail`, created by the migration and used only when `NODE_ENV !== "production"`. `/dev/mail` is a web-only route that returns 404 in production. It lists messages newest first and shows each one's HTML and text, links and codes, and has a JSON endpoint the browser checks read. `datastore:reset` clears it.
- **Seeds:** append-only. One pending email invite and one active link for Dev Family, one pending join request from a new seed user (`joiner@example.com`), and one access code (`CARE-DEMO-0001`). Fictional names and `@example.com` only.
- **New dependencies (approved, pinned exactly):** `resend`, `@react-email/components` and `@react-email/render`, `qrcode` (with its types). Better Auth's `magicLink` and `emailOTP` are built in.
- **Env:** `APP_URL`, `RESEND_API_KEY`, `MAIL_FROM` (a subdomain address), `MAIL_ALLOWLIST`, `CRON_SECRET`, `INVITE_LINK_KEY`. Worktree stacks copy them like the other secrets.
- **Hot files:** Better Auth's config, `PERMISSIONS`, `db/schema/index.ts`, the router, `routes.ts` (new top-level routes, appended), group settings' Members subpage, the group menu, `/app` home, `sign-in.tsx`, and `.env` examples plus `scripts/loops/lib.sh` (for the new env vars). Keep one pending migration for the PRD.

## Testing Decisions

- A good test checks behavior a user or caller sees (who becomes a member, which email is queued, what a token reveals), not internals.
- **Unit:**
  - `inviteRules`: every actor role × target role × kind; the link role cap; expiry, revoked, used up and accepted states; email matching (case, whitespace); code states.
  - The notifications registry: data validation refuses bad data; every template renders a subject and a non-empty plain text; no template output contains the recipient's health fields (a rendering test with sentinel values); links use `APP_URL`.
  - Prior art: `groupSettings` tests and `liveNow.test.ts`.
- **Integration** (test Postgres, `memory` sender):
  - The outbox: enqueued in the caller's transaction (rolled back with it); delivery marks sent; one failure backs off; two sweepers never send one row twice (`SKIP LOCKED`); the idempotency key is passed; purge.
  - Email invite acceptance: a matching email joins with the role and records consent; a different email is refused; it's idempotent; expired and revoked invites are refused; only owners invite owners; resend rotates the token.
  - Links: they cap the role; accepting creates one pending request per user and counts uses; max uses is enforced; approve creates the membership, decline doesn't; a requester sees no group data before approval; owners and admins are notified.
  - Access codes: redeem creates the account, group, recipient and owner membership in one transaction; expired, revoked and used-up codes are refused; only admins manage codes.
  - `signUpWithTicket`: refused without a valid ticket; public sign-up stays refused; magic link and OTP don't create accounts.
  - Prior art: `careGroup.int.test.ts`, `auth.int.test.ts`, `router.int.test.ts`.
- **Browser check `invites.mjs`** (reads `/dev/mail`):
  1. An owner invites a new email; the mail arrives; the invitee signs up (email locked), consents and lands in the group with the role.
  2. A wrong-account case.
  3. A link invite: a new user asks to join, the owner gets the mail and approves, and the requester's home updates live.
  4. Decline.
  5. Revoke and expired states.
  6. Sign in by magic link and by 6-digit code.
  7. Reset a password.
  8. An unverified account is held at verification.
  9. An access code: sign up and create a group.
  10. Create a second group from the group menu.
  11. The admin page creates a code and its print page shows a QR.
  12. A viewer and a caretaker see no invite controls.

  It's order-independent and self-cleaning: it tags its emails (`+inv<run>@example.com`) and removes what it created. It respects Better Auth's sign-in rate limit (pauses between sign-ins). `app-shell.mjs` and `sign-in.mjs` must still pass.

## Out of Scope

- **How access codes are distributed** (flyers, clinics, partners) and any marketing site changes.
- **A demo group for new users** (filed as B-31).
- Google and Apple sign-in, passkeys, two-factor.
- Push and in-app notifications, digests, notification preferences and unsubscribe (no optional mail exists yet), bounce webhooks (Svix), and the SPF, DKIM and DMARC setup itself (an operations task before launch; noted in the hand-off).
- Transferring ownership, and what happens when a group's last owner deletes their account (still an open question).
- QR codes for group invite links (the dependency is in, but links are shared by text in v1).
- Production rate-limit storage, hosting, and the PowerSync Cloud setup.
- Native deep links for magic links (the 6-digit code covers the app until Capacitor ships).

## Further Notes

- Source: AGENTS.md's _Planned: notifications (Resend iteration)_ and its open questions (invites, consent, email delivery), filed as B-30.
- Interview decisions (2026-11-18):
  - **Invite-only.** Accounts come from email invites, link invites or staff access codes.
  - **Codes:** access codes are for starting a new group. How they're handed out is decided later.
  - **New groups:** both staff and any signed-in user can create one.
  - **Sign-in:** password plus magic link plus email code.
  - **Email matching:** email invites must match the address; links accept any account.
  - **Link safeguards:** a role cap, owner/admin approval, expiry and maximum uses, and an email to owners and admins on each request.
  - **Consent:** both the inviter's attestation and the joiner's acknowledgement are recorded.
  - **Admin pages:** in the web app.
  - **The Members page:** Invite, plus the pending list.
  - **Verification:** required, with reset by email.
  - **Delivery:** through the outbox from the start.
  - **Dev mail:** the log sender plus a dev mailbox page.
  - **Creating a group:** recipient plus group name.
  - **Dependencies:** `resend`, React Email and `qrcode` approved.
  - **Tests:** unit, integration and the browser check.
- When this lands, AGENTS.md's _Planned: notifications_ section becomes a built section, and the open questions about invites and consent close.
- Health-data rules apply throughout: no health details in any email, consent recorded, staff without care-data access.
