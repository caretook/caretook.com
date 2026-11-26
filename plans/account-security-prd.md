# PRD: Account security hardening (account-security)

Items: B-327, B-328, B-329, B-330, B-331, B-332, B-333, B-334, B-335, B-336, B-337, B-339. Two-factor sign-in with the breached-password check (B-85), account settings for name, email and password (B-338) and one assistant in several groups (B-340) are cut to the follow-on topic `account-security-2` (see _Out of scope_).

## Decisions

| Decision                                                                                                                                                                                                                                                        | Why                                                                                                                 | Source                                                    | Cost to change later                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| Two-factor and the breached-password check (B-85), editable account settings (B-338) and one assistant in several groups (B-340) move to `account-security-2`                                                                                                   | 15 items is more than six slices; the hardening fixes are smaller, older and block a native build, so they go first | preference (a PRD stays small)                            | low: reorder the rows                     |
| Staff owner invites: ownerless groups only; the owners are emailed on every staff membership change                                                                                                                                                             | B-331; one staff account opens any group until two-factor lands                                                     | asked (a241): as recommended (defaulted after 30 minutes) | medium: one service rule and an email     |
| Ending an account's other sessions or all of them (password reset, the Devices page's "sign out everywhere", which keeps this device, staff "sign out all", disable) also revokes every connector grant; signing out one device doesn't                         | B-329: a reset or sign-out-everywhere is how someone takes an account back, and a stolen grant survives it today    | assumed                                                   | medium: members reconnect their assistant |
| The session cookie cache stays at 3 minutes, but the one account query on each call also checks the session row still exists, so every revocation is live on the next call                                                                                      | B-339 closes the gap at no extra round trip; keeps B-140's speed                                                    | assumed                                                   | low: one query                            |
| Bearer tokens must be signed; stored session tokens stay as Better Auth keeps them, and the data-copies register is corrected                                                                                                                                   | B-330: with signing, reading the session table no longer lets anyone act as a user; no native client exists yet     | assumed                                                   | low                                       |
| A removed or demoted manager's waiting invites are revoked at that moment, and accepting any invite rechecks its maker is still allowed to make it                                                                                                              | B-327; the accept-time check covers invites already waiting today without changing stored rows                      | assumed                                                   | low                                       |
| A declined or withdrawn requester can ask the same group again only after 7 days; a link counts one use per person                                                                                                                                              | B-334; 7 days matches the assistant ask's window                                                                    | assumed                                                   | low: a constant                           |
| Per-address limits: at most 5 sign-in emails and 10 wrong codes per address per hour; past them the answer reads the same and no email goes                                                                                                                     | B-328; the same answer keeps addresses private                                                                      | assumed                                                   | low: constants                            |
| Every signed-in procedure has a per-user limit (generous); email-sending procedures have tight ones; a sync upload past its limit is retried, never dropped                                                                                                     | B-334; offline catch-up must still upload                                                                           | assumed                                                   | low: constants                            |
| `/mcp` and `/oauth2/register` limit per client IP before any database read; in production and check builds a request with no client IP is refused (400) everywhere our limiter keys on IP (`/mcp`, the calendar feed, public forms), never pooled in one bucket | B-337; a shared bucket lets one caller lock out everyone; `checkDeployEnv` already requires `CLIENT_IP_HEADER`      | assumed                                                   | low                                       |
| `/update-user` is turned off; name and image change only through our validated procedures                                                                                                                                                                       | B-335; no app code calls it; editable settings arrive with `account-security-2`                                     | assumed                                                   | low                                       |
| Link sign-up takes the same time whether or not the address has an account, is limited per IP and per link, and counts toward a link's use limit                                                                                                                | B-333                                                                                                               | assumed                                                   | low                                       |
| Staff page views are audited inside the request (awaited); user search is audited with its search text; the app role loses UPDATE and DELETE on the audit table, in the roles SQL `pnpm db:roles` applies after every migration (no migration)                  | B-332; the admin doc already says rows can't be changed; a migration's revoke would be re-granted by the roles step | assumed                                                   | low                                       |
| A role change locks the target membership before its checks                                                                                                                                                                                                     | B-336                                                                                                               | assumed                                                   | low                                       |

## Problem

A code review on 2026-11-21 found ways the account and group rules can be got around. A removed owner can come back through their own pending invite. A role change can race past the last-owner check. Anyone can guess at a sign-in code from many addresses, or flood a victim's inbox. A password reset leaves a connected assistant working for 30 more days. Session tokens can be replayed without the secret. Staff can invite an outsider as owner of any family's group without the owners knowing, and their page views may not be audited. Sign-up by link shows who has an account. Join requests and signed-in procedures can be used to spam owners. `/mcp` does database work before it limits anyone.

## Solution

Close each gap where the rule lives, with the same answers whatever the attacker tries, so nothing about another person's account leaks. Ending sessions ends everything the account handed out. Managers' power ends the moment their role does. Every way of sending email or guessing a secret has a limit per address, per person and per IP. Staff power over a group is limited to owner recovery, and the owners always hear about it.

## User stories

1. As an owner, I want a removed or demoted manager's pending invites to stop working, so that they can't come back on their own. (B-327)
2. As an owner, I want two managers' simultaneous role changes to still respect "only owners change owners" and "a group keeps an owner", so that a race can't strip the group. (B-336)
3. As a member, I want my sign-in code to stop being guessable from many machines and my inbox not to flood, so that no one signs in as me. (B-328)
4. As someone with an invite link, I want sign-up to give the same answer and take the same time whether or not I already have an account, so that the link can't be used to find out who's a member, and a link can't mint unlimited accounts. (B-333)
5. As an owner or admin, I want a declined or withdrawn person to stop re-asking forever, so that my inbox isn't spammed. (B-334)
6. As the operator, I want signed-in procedures (sync uploads, invite resends) to be rate limited per person, so that one account can't overload the service or send unlimited email. (B-334)
7. As a member whose account was taken over, I want resetting my password or signing out everywhere to also disconnect every assistant, so that the attacker's access ends too. (B-329)
8. As a member, I want a stolen copy of the session table not to let anyone act as me, so that a database leak isn't an account takeover. (B-330)
9. As a member, I want a session I revoke to stop working at once, not after 3 minutes. (B-339)
10. As an owner, I want staff to be unable to add an owner to my group, and to be told whenever staff change my group's members, so that one staff account can't open my family's records. (B-331)
11. As the operator, I want every staff page view and user search recorded, and the audit log unchangeable by the app, so that staff access can be reviewed. (B-332)
12. As a co-member, I want names and images to be checked before they reach me and the owners' emails, so that a member can't push oversized or tracking content. (B-335)
13. As the operator, I want `/mcp` and client registration limited before any database work, and no shared "unknown" bucket anywhere, so that one caller can't overload or lock out others. (B-337)

## Implementation decisions

### Memberships and invites

- `careGroupMemberService.updateRole` and `remove` lock the target membership row (`FOR UPDATE`) before reading its role, then run the owner-only and last-owner checks on the locked row.
- When a member leaves, is removed, or drops below manager (owner or admin), their waiting email invites and active links are revoked in the same transaction. Owner invites they made are revoked when they stop being an owner.
- `careGroupInviteService.accept` (and link `askWithLink`) recheck that the invite's maker is still a member whose role may make that invite (an owner invite needs an owner; others a manager). An invite made by `system` (staff and the system) is exempt. A failed recheck reads as a revoked invite.

### Sign-in and sign-up limits (packages/auth)

- Our limiter (`createRateLimiter`, the Postgres store) gets per-address scopes: sign-in emails (5 an hour) and wrong codes (10 an hour), keyed on the normalized address, hashed. Past a limit, the sign-in email answer is unchanged and nothing is sent or minted; code sign-in answers as a wrong code.
- Link sign-up always hashes the password before the account lookup, so both paths cost the same. It's limited per client IP and per link (both in our limiter), and a link's sign-up counts toward its `max_uses` (`joinRequestService` then doesn't count that person's use twice).
- `/update-user` joins `disabledPaths`. Name and image are written only through our procedures, which validate them (name length as the profile schema, image only our own avatar values).

### Ending sessions

- A new `connectorGrantService.revokeAllForUser(userId, tx?)` ends every live grant of the account (tokens and consent rows), as `revoke` does for one.
- Better Auth's own paths call it from an after hook in `packages/auth` once they succeed: `/reset-password` (whose `revokeSessionsOnPasswordReset` ends the sessions), `/revoke-other-sessions` (the Devices page's "sign out everywhere", which keeps the current session) and `/revoke-sessions`. The Devices page keeps calling Better Auth; nothing on it changes.
- Staff "sign out all" and disable (`accountAdminService`, raw session deletes that skip Better Auth's hooks) call it inside their own transactions.
- `/revoke-session` (one device) revokes no grant.
- `bearer({ requireSignature: true })`. The data-copies register says session tokens are stored plain, and need the secret to use.
- `getAuthUser` passes the session id to `userModel.getAuthFacts`, which joins the session row (not expired) in its one query. A missing session reads as signed out. `live: true` stays for the paths that need Better Auth's own read.

### Signed-in and connector limits

- `joinRequestService.requestWithLink` refuses a new request for a group where the same person was declined or withdrew within 7 days. It returns the same answer as a waiting request, so the screen shows "requested" and no email is sent.
- An oRPC middleware limits every signed-in procedure per user (a generous default), with tighter named limits on email-sending procedures (invite create and resend, link requests, assistant asks). A 429 carries `retry-after`. `sync.upload` has its own limit; the device's uploader treats a 429 as retry-later and keeps its queue.
- `/mcp` hits a per-IP limiter before verifying the token, then the per-grant one as today. `/oauth2/register` gets the same per-IP limit.
- One helper, `clientIpKey(clientIp)`, makes every IP limiter's key (`/mcp`, `/oauth2/register`, the calendar feed, public forms). With `NODE_ENV=production`, no client IP is refused (400) and logged. Elsewhere it keys on a fixed dev key. `checkDeployEnv` keeps requiring `CLIENT_IP_HEADER`.

### Staff

- `groupAdminService.inviteOwner` refuses a group that has an owner (`groupAdminService:hasOwner`).
- Every staff membership change (invite an owner, Make owner, Change role, Remove) queues a `staffGroupChange` email to the group's current owners in the same transaction: names, no health details, no staff name, and a support contact.
- `adminAuditService.recordSoon` becomes an awaited `record` outside a transaction for page views, and user search records `user.search` with its text. The roles SQL (`rolesSql.ts`, run by `pnpm db:roles` after every migration) revokes UPDATE and DELETE on `admin_audit_log` from `caretook_app` after its grant-all. The foreign keys' `ON DELETE SET NULL` runs as the table owner, so account and group deletion still work.

## Testing decisions

- **Integration** (services and auth, the prior art is `careGroupMember.int.test.ts`, `careGroupInvite.int.test.ts`, `joinRequest.int.test.ts`, `packages/auth/src/auth.int.test.ts`, `disabled.int.test.ts`, `rpcAuth.int.test.ts`, `connectorGrant.int.test.ts`, `accountAdmin.int.test.ts`, `groupsAdmin`, the roles SQL test): each fix gets the attack as a test, and each test asserts the refusal looks like the innocent answer.
- **Unit:** the limiter keys and the IP rule (`rateLimit` tests, `host.test.ts`).
- **Component:** none: no screen changes.
- **End to end:** none new. Two existing checks change: `session-end` uses the signed bearer token, and `roundtrip`'s `/mcp` call sends a client IP. Limits are on in check builds (`NODE_ENV=production`), so the per-user defaults must clear the browser suite. Integration tests turn limits on explicitly, as `createAuth({ rateLimitEnabled })` does.

## Out of scope

- **`account-security-2`** (to write, after this): two-factor sign-in (TOTP and backup codes) required for owners, admins and staff, the breached-password check (B-85), and account settings to change name, email and password (B-338), and one assistant connected to several groups (B-340: the grant's live-unique index becomes user, client and group; adds a migration). Its planner settles group creation, promotion, the grace period, recovery, and that the email link and code sign-ins must ask for the second factor too (Better Auth's `twoFactor` gates only password sign-in), and names the Pwned Passwords call on the privacy page.
- Purging unverified accounts that never confirmed (a data-deletion question for `data-rights`).
- Native token storage (still open in AGENTS.md).
- Purging old `oauth_client` registrations (B-337's note): it deletes existing rows, and a client that cached its id may break; left for a later question (noted on B-337).

## Notes

- Source: the 2026-11-21 code review (items' notes, not re-verified line by line); `plans/security-review.md` S-9 for B-85.
- `packages/auth` is shared with `data-rights` (to write). This PRD lands first by row order.
- No migration and no new dependency.
- Skeptic s50 sent the first plan back: the audit revoke moved from a migration to the roles SQL; the staff slice split in two; the `oauth_client` purge was cut (never-list: existing data); the IP fallback now covers the calendar feed and public forms; the sign-out paths are named one by one; wave 2's limiter slices are ordered. B-340 moved to `account-security-2` to keep seven slices. The second skeptic (go) added the `session-end` and `roundtrip` check edits, the check-build limits and the right test files.
