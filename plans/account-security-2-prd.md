# PRD: Account security follow-ups (account-security-2)

Items: B-1011, B-1017, B-1018, B-1019, B-1020 (the five follow-ups from `account-security`, moved here on the user's word, ask a397). Account settings (B-338), two-factor sign-in with the breached-password check (B-85) and one assistant in several groups (B-340) are cut to follow-on topics (see _Out of scope_).

## Decisions

| Decision                                                                                                                                                                                                                                                                                                                                     | Why                                                                                                       | Source                         | Cost to change later   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------- |
| Editable account settings (B-338) go to `account-security-3`, two-factor and the breached-password check (B-85) to `account-security-4` (after it: enrollment lives on the settings page, and the check covers its password change), one assistant in several groups (B-340) to `connectors-6`                                               | The five follow-ups fill six slices; the user chose to put them here (a397)                               | preference (a PRD stays small) | low: reorder the rows  |
| Approving a waiting join request rechecks its link and the link's maker, as accepting does: a revoked link, or a maker no longer allowed to make it, refuses the approval with the answer a revoked invite gets. Declining still works. No stored request changes                                                                            | B-1017; the same rule as accept, B-327's                                                                  | assumed                        | low: one service check |
| A re-ask within the 7-day cooldown answers "requested" with no request attached, so no caller holds an id that doesn't behave as a waiting request. Home keeps listing only waiting requests                                                                                                                                                 | B-1018 offers this or a fake waiting request; this one keeps `mine` and `withdraw` true and leaks nothing | assumed                        | low                    |
| Every membership lock takes its rows in id order (`lockForChange`'s order); `lockGroupMembers` changes from creation order                                                                                                                                                                                                                   | B-1020; one order can't deadlock                                                                          | assumed                        | low                    |
| Staff Change role and Remove lock the membership before reading the role they report                                                                                                                                                                                                                                                         | B-1019                                                                                                    | assumed                        | low                    |
| Account emails that Better Auth sends (password reset, email verification, including the one a password sign-in of an unverified account sends) are limited to 5 an hour per address; past it the answer is unchanged and nothing is sent                                                                                                    | B-1011; the sign-in email's rule (B-328), so an inbox can't be flooded from many IPs                      | assumed                        | low: a constant        |
| Every Better Auth request that carries a session (sessions, token, sign-out) counts per session (the session token, hashed): 300 a minute; their per-IP limits stay Better Auth's                                                                                                                                                            | B-1011 asks per user; the session stands for the user without a lookup before the endpoint runs           | assumed                        | low                    |
| Every public oRPC procedure has a per-IP limit (default 120 a minute; the forms and sign-ups keep their tighter ones). Every signed-in `/rpc` call also counts toward a per-IP ceiling of 6,000 a minute (twenty people's default and sync together). In-process callers don't count; in production a `/rpc` call with no client IP is a 400 | B-1011; one household or care team shares an address, so the ceiling is loose                             | assumed                        | low: constants         |
| The audit is a manifest in code (every call, its kind and its limits), a sweep test that fails when a procedure or Better Auth endpoint is missing from it or isn't limited, and a table in the api doc that mirrors it                                                                                                                      | B-1011's output; a new call can't ship unlimited                                                          | assumed                        | low                    |
| No migration, no new dependency                                                                                                                                                                                                                                                                                                              |                                                                                                           | assumed                        |                        |

Skeptic s96 (send-back) fixed: slice 5's per-IP wiring (signed-in and staff calls no longer count the public limit), slice 3's second hot file (`careGroupInviteService`), its import cycle and its cooldown answer, the per-session row against slice 4 (sign-out counts), and slice 1 names `lockOwners`. Skeptic s97 (go): `requestId` stays on waiting and new requests' answers (existing tests approve through it), and the old cooldown test is rewritten. Nothing declined.

## Problem

The `account-security` run closed the gaps the 2026-11-21 review found, and its reviews found five more. A join request through a link whose maker was removed can still be approved. A re-ask inside the cooldown hands back a declined request's id, which then behaves like nothing at all. Two membership lock orders can deadlock a role change against an emergency-contact save. Staff role changes read the member's role before locking, so the owners' email can name the wrong previous role or miss a demoted owner. And nobody has listed every call with its limit: password-reset and verification emails have no per-address limit, public procedures have no per-IP limit beyond the forms, and a new procedure can ship without one.

## Solution

Each rule holds on locked rows and rechecks what accept already rechecks. Every call the service answers (public, signed-in, sync, connector, email-sending) has a written limit per person, per IP or per address, kept in one manifest that a test holds against the router and Better Auth, and shown as a table in the api doc.

## User stories

1. As an owner, I want a request that came through a link whose maker lost their role to be refused if someone approves it, so that the maker's lost power doesn't live on in waiting requests. (B-1017)
2. As someone who asked to join again within the cooldown, I want the answer not to hand me a request that isn't waiting, so that nothing on my screen breaks when I act on it. (B-1018)
3. As an owner, I want a role change and an emergency-contact save at the same moment both to finish, so that neither is lost to a deadlock. (B-1020)
4. As an owner, I want staff's email about a membership change to name the role the member really had, so that I can trust it. (B-1019)
5. As a member, I want my inbox safe from floods of password-reset and verification emails, so that nobody can spam me through Caretook. (B-1011)
6. As the operator, I want every public procedure limited per IP and every signed-in call capped per IP and per person, so that no one caller can overload the service. (B-1011)
7. As the operator, I want a table of every call and its limit, kept true by a test, so that a new call can't ship unlimited. (B-1011)

## Implementation decisions

### Memberships and staff changes

- `careGroupMemberModel.lockGroupMembers` and `lockOwners` order by id, as `lockForChange` does; one comment in the model states the rule.
- `groupAdminService.changeRole` and `removeMember` take `careGroupMemberModel.lockForChange` on the target membership before `membershipOf` reads it, so the staff notice (`staffGroupChange`) names the committed role and includes a just-demoted owner correctly.

### Join requests

- `joinRequestService.approve` rechecks the request's link (`inviteId`): not revoked, and its maker still allowed to make it (the same check `careGroupInviteService.accept` and `askWithLink` use; `system` exempt). A failed recheck returns the error a revoked invite returns, inside the transaction, before any membership is made. `decline` is unchanged.
- `requestWithLink` within `REASK_COOLDOWN_DAYS` of a declined or withdrawn request returns no request (`request: null`, `created: false`). `careGroupInviteService.askWithLink` answers "requested" for it (group and role from the invite), and `AcceptResult.requestId` is left out on that answer only; `invite.accept`'s oRPC answer already carries no id.
- The maker check (`makerMayStill`) moves out of `careGroupInviteService` into its own small module, so both services use it without an import cycle.

### Account email limits (packages/auth)

- `AUTH_LIMITS` gains per-address scopes for the reset email and the verification email (5 an hour each, address hashed with `addressKey`). They're counted where the email is queued (`emails.ts`'s senders), so every path that sends one counts: `/request-password-reset`, `/send-verification-email`, and sign-in's resend. Past a limit nothing is queued and the endpoint's answer is unchanged.
- A per-session scope (300 a minute, keyed on the hash of the session token from the cookie or bearer header) counts Better Auth's signed-in endpoints in the before hook. Past it, a 429 with `retry-after`.

### Per-IP limits on `/rpc` (packages/api)

- `IP_LIMITS` beside `USER_LIMITS` in `rateLimit.ts`: `public` (120 a minute) and `signedInCeiling` (6,000 a minute), scope `ip.<name>`, keyed through `clientIpKey`. `publicProcedure` counts `public`; the signed-in builders and `staffProcedure` build on a shared base without it and count `signedInCeiling` before their per-user limit. Only `/rpc` calls count (the mount passes `getAuthUser` and `clientIp`); in-process callers (`authUser` given) don't. In production a `/rpc` call with no client IP is a 400, as `/mcp` does.
- Procedures with their own tighter limits (the public forms, link sign-up) keep them on top.

### The manifest and its sweep

- A pure manifest in packages/api lists every call: oRPC procedures by path, Better Auth endpoints by path, and the HTTP routes outside both (`/mcp`, `/connect`, `/.well-known/*`, the calendar feed, Google connect and callback, the reminder unsubscribe, the crons), each with its kind (public, signed-in, sync, connector, email-sending, cron) and its limits (per user, per IP, per address, per grant or per link, or "secret" for crons).
- The sweep test walks the router (as `procedureSweep.int.test.ts` does) and Better Auth's served endpoints (minus `disabledPaths` and server-only ones): each must be in the manifest with at least one limit, and each oRPC procedure, called with every limit at zero, must answer 429.
- The api doc's _Limits_ table is written from the manifest.

## Testing decisions

- Integration tests for every service and procedure change, in the existing files: `careGroupMember.int.test.ts` (lock order), `groupsAdmin.int.test.ts` (staff notice), `joinRequest.int.test.ts` (approve recheck, cooldown answer), `auth.int.test.ts` (email and session limits), `rateLimit.int.test.ts` (per-IP limits); and one new sweep, `callLimits.int.test.ts`. Prior art: `procedureSweep.int.test.ts` (router walk), `rateLimit.int.test.ts` (limits turned on with low counts), account-security slice 1's racing tests (two transactions at once).
- No component tests or browser checks: no screen changes.

## Out of scope

- **`account-security-3`** (to write, after this): account settings to change name, email and password (B-338).
- **`account-security-4`** (to write, after `account-security-3`): two-factor sign-in required for owners, admins and staff, and the breached-password check (B-85).
- **`connectors-6`** (to write, after this): one assistant connected to several groups (B-340).
- Staff editing a member's name or email (B-338's note): for `account-security-3`'s planner.

## Notes

- Source: the items' notes (Codex on PR #327, account-security slices 1 and 6, the inbox line for B-1011).
- `joinRequestService` is a hot file of the running `data-rights`; so is `careGroupInviteService`; slice 3 runs in wave 2 and waits while `data-rights` holds either.
- For the follow-on planners (from this planner's reading of Better Auth 1.7.25): `/change-password` needs the current password and takes `revokeOtherSessions`; `/change-email` has a confirmation step at the old address (`sendChangeEmailConfirmation`) and answers the same for an address that has an account; `twoFactor` gates only `/sign-in/email` (not the email link, code or verification's auto sign-in); `haveIBeenPwned` checks only the paths it lists, so ticket sign-up (`internalAdapter`) needs `isPasswordCompromised` called directly, and it fails closed when the service is down.
