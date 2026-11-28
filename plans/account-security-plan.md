# Plan: Account security hardening (account-security)

> Source PRD: [`plans/account-security-prd.md`](account-security-prd.md). User-story numbers (US) refer to it. Backlog items B-327 to B-337 and B-339.

## Status

**From the user:** none yet.

**Landing mode:** run everything through (started run-through by the dispatcher, 2026-11-28): start every ready slice, land each green wave, ask only real questions via `risa ask`.

**Now (2026-11-28, hand-over brief):**

- **Wave 1 landed** in dev through PR #327 as 01e4921df (tier integration, run 46153406894 green, Codex clean after one fix round). Report filed. Its docs folded into care-groups.md, auth.md, admin.md, notifications.md. Worktrees 1, 2, 3 removed.
- **Wave 2 merged** into `prd/account-security`, not yet gated: slice 4 as 515224cc9, slice 5 as fcf8a50d3, slice 6 as e75ed6950 (items marked done). Slice 6's merge conflicted with dev's sync-safety-3 in `sync.ts` (kept dev's upload input with `limitedProcedure("sync")`), `invites.ts` (imports both `limitedProcedure` and `optionalAuthUser`) and the `ApiContext` comment in `procedures.ts`; `@caretook/api` typechecks, eslint clean. Worktrees 4, 5, 6 kept until wave 2 is green; their agents ended with this session, so a failure goes to a fresh opus fix agent in that slice's worktree.
- **Rotate was refused** (worktrees 4, 5, 6 exist and stay until wave 2 is green), so this session ran wave 2's gate: integration green (run 46154288491 on 1ee4989c), lean browser suite 11/11, Codex clean on PR #329; wave 2 docs folded (auth, connectors, admin, api, care-groups, ops/data-copies). Landing wave 2. Rotate after wave 2 lands and its worktrees are removed.
- **Next session:** `risa backlog ingest`/`list`; wave 2's gate (`risa tier`, then `risa ci run <tier> --wait`); `risa sync`; `risa serve --restart`; the lean browser suite once (`caffeinate -i risa browser --suite`: slice 6's per-user limits are on in check builds and must clear it) plus `--changed`; `risa pr`, `risa review --wait`; land; then slice 7 (wave 3, B-337; ready once wave 2 is merged, it is). Slice 7 should replace slice 2's raw-`clientIp` link sign-up key (skipped when missing) with `clientIpKey`.
- **Open follow-ups (account-security, triaged):** B-1017 approve doesn't recheck a revoked link; B-1018 re-ask answer carries the old request id; B-1019 staff notice reads role unlocked; B-1020 two membership lock orders can deadlock; B-1011 rate-limit audit (not in this plan: a planned wave 4 after slice 7, or account-security-2; the user to confirm).
- Slice models: every slice and fix on opus; the doc fold on sonnet.

**Items:** slice 1 B-327, B-336 · slice 2 B-328, B-333, B-335 · slice 3 B-331 · slice 4 B-332 · slice 5 B-329, B-330, B-339 · slice 6 B-334 · slice 7 B-337.

| Slice | Wave | State   | Merge into `prd/account-security` (slice commits)          |
| ----- | ---- | ------- | ---------------------------------------------------------- |
| 1     | 1    | landed  | 7dc6937a2 (d9a59529a)                                      |
| 2     | 1    | landed  | 3ba59077b, fix 648aa0227 (aff560477, 68308a310, 1eff99e42) |
| 3     | 1    | landed  | 25ab484aa, fix 555acc466 (28faf5d5e, 089a77ddd)            |
| 4     | 2    | merged  | 515224cc9 (273ba77a0)                                      |
| 5     | 2    | merged  | fcf8a50d3 (1a43a0197)                                      |
| 6     | 2    | merged  | e75ed6950 (1e5f23269)                                      |
| 7     | 3    | planned | —                                                          |

## Architectural decisions

- **Refusals look innocent:** every limit or refusal that concerns another person's address answers exactly as an unknown address, a wrong code or a revoked invite would, in the same time.
- **Limits use our limiter** (`createRateLimiter`, the Postgres store in production), per address (hashed), per user, per IP or per link. They're off outside production unless a test turns them on. Every IP key comes from one helper; nothing pools requests in an "unknown" bucket.
- **Ending other or all sessions revokes connector grants**, through `connectorGrantService.revokeAllForUser`: an after hook on Better Auth's paths, and a direct call in staff's raw deletes.
- **Membership checks run on locked rows**, in the service, as the rest of `careGroupMemberService` does.
- **No migration and no new dependency.** The audit table's privileges change in the roles SQL, never in a migration (`pnpm db:roles` re-grants after every migration).
- All test data is fictional (`@example.com`).

## How to run this plan

- **Wave 1:** slices 1, 2 and 3, independent. Slices 1 and 2 both touch `careGroupInviteService`: slice 1 owns `accept` and the link path, and slice 2 owns `ticketFor` and the use count.
- **Wave 2:** slices 4, 5 and 6. Slice 4 follows slice 3 (`groupAdminService`). Slice 5 follows slice 2 (`packages/auth/src/auth.ts`). Slice 6 follows slices 1 and 2 (the invite and join-request paths, the limiter scopes).
- **Wave 3:** slice 7, after slices 2, 5 and 6 (`packages/auth/`, connectors, `rateLimit.ts`). Slice 6 owns `packages/api/src/procedures.ts` and `joinRequestService`. Slice 7 owns `packages/api/src/connectors/http.ts`, `packages/auth/src/host.ts` and the IP helper in `packages/api/src/rateLimit.ts`. Slice 6 only adds scopes there, at the end.
- Slice 4 and slice 5 both touch `accountAdminService`: slice 4 the page view and search, slice 5 sign-out-all and disable.

**Hot files:** `packages/auth/`, `packages/api/src/rateLimit.ts`, `packages/api/src/procedures.ts`, `packages/api/src/connectors/http.ts`, `packages/api/src/calendars/feed.ts`, `packages/api/src/marketing/publicForms.ts`, `packages/data/src/services/careGroupMemberService.ts`, `careGroupInviteService.ts`, `joinRequestService.ts`, `connectorGrantService.ts`, `groupAdminService.ts`, `accountAdminService.ts`, `adminAuditService.ts`, `packages/data/src/db/roles/`, `packages/notifications/`, `scripts/browser-checks/session-end.spec.mjs`, `scripts/browser-checks/roundtrip.spec.mjs`.

Slice 3 follows ask a241 (defaulted to _Ownerless groups only_).

## Slice 1: A manager's power ends with their role

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/data-layer.md · Tests: integration

**User stories:** US 1, 2.

**Build:** _Memberships and invites_ (PRD, _Implementation decisions_).

- `careGroupMemberService.updateRole` and `remove` lock the target row first.
- Leaving, removal and a demotion below manager revoke the member's waiting email invites and active links. Owner invites go when the member stops being an owner.
- `careGroupInviteService.accept` and the link path recheck the maker's current role. `system` invites are exempt.

**Acceptance criteria:**

- Integration (`careGroupMember.int.test.ts`): an admin's demote and an owner's promotion of the same member, run at once, end with the owner-only and last-owner rules held.
- Integration (`careGroupInvite.int.test.ts`):
  - a removed owner can't accept their own owner invite;
  - a demoted admin's link stops working;
  - an invite whose maker has since been removed (set up directly, as one waiting today) is refused at accept like a revoked one;
  - a staff (`system`) owner invite still works.
- `pnpm prd check --quick` green.

**Blocked by:** none. **Blocks:** slice 6.

## Slice 2: Sign-in, sign-up and profile input limits

Stack: no · Reads: docs/domain/auth.md, docs/domain/care-groups.md · Tests: unit, integration

**User stories:** US 3, 4, 12.

**Build:** _Sign-in and sign-up limits (packages/auth)_.

- Per-address scopes on our limiter: sign-in emails (5 an hour) and wrong codes (10 an hour). Past them the answers don't change.
- Link sign-up hashes before the account lookup, is limited per IP and per link, and counts toward `max_uses`, with no double count at the join request.
- `/update-user` goes into `disabledPaths`.

**Acceptance criteria:**

- Integration (`auth.int.test.ts`, limits on):
  - the sixth sign-in email for one address in an hour answers as the first did and queues nothing;
  - the eleventh wrong code across fresh codes is refused even with the right code;
  - another address is unaffected.
- Integration (`auth.int.test.ts`, the ticket path):
  - link sign-up for an existing and a new address returns the same shape, and both hash (a spy counts the hash);
  - past the per-link limit it's refused;
  - a link at `max_uses` refuses sign-up, and that person's later join request doesn't add a second use.
- Integration: `POST /api/auth/update-user` is 404.
- Unit: the address key normalizes case and spaces and is hashed.
- `pnpm prd check --quick` green.

**Blocked by:** none. **Blocks:** slices 5, 6 and 7.

## Slice 3: Staff owner invites and the owners' email

Stack: no · Reads: docs/domain/admin.md, docs/domain/notifications.md, docs/domain/care-groups.md · Tests: integration

**User stories:** US 10.

**Build:** the first two bullets of _Staff_, per ask a241.

- `groupAdminService.inviteOwner` refuses a group with an owner (`groupAdminService:hasOwner`, worded in the admin refusal messages).
- Every staff membership change (invite an owner, Make owner, Change role, Remove) queues a `staffGroupChange` email, a new template in `packages/notifications`, to the group's owners in its transaction.

**Acceptance criteria:**

- Integration (`groupsAdmin`):
  - inviting an owner into a group with an owner is refused and writes no invite, email or audit row;
  - into an ownerless group it works;
  - Make owner, Change role and Remove each queue one `staffGroupChange` per current owner, with no health details and no staff name.
- `pnpm prd check --quick` green.

**Blocked by:** none. **Blocks:** slice 4.

## Slice 4: Staff views are always audited

Stack: no · Reads: docs/domain/admin.md, docs/domain/data-layer.md, ops/runbook.md · Tests: integration

**User stories:** US 11.

**Build:** the third bullet of _Staff_.

- Page views (`user.view`, `group.view`) are recorded awaited, so the row exists before the answer. `recordSoon` goes.
- User search records `user.search` with its text.
- `rolesSql.ts` revokes UPDATE and DELETE on `admin_audit_log` from the app role after its grant-all.

**Acceptance criteria:**

- Integration (`usersAdmin`, `groupsAdmin`, `auditAdmin`): a page view's audit row exists when the call returns; a search writes `user.search` with its text.
- Integration (the roles SQL test): after `db:roles`, the app role's UPDATE and DELETE on `admin_audit_log` fail and its INSERT and SELECT work; deleting an audited user still works.
- `pnpm prd check --quick` green.

**Blocked by:** slice 3 (`groupAdminService`). **Blocks:** none.

## Slice 5: Ending sessions ends everything

Stack: yes · Reads: docs/domain/auth.md, docs/domain/connectors.md, docs/domain/admin.md, docs/agents/loop.md · Tests: integration, e2e:session-end

**User stories:** US 7, 8, 9.

**Build:** _Ending sessions_.

- `connectorGrantService.revokeAllForUser`.
- An after hook in `packages/auth` on `/reset-password`, `/revoke-other-sessions` and `/revoke-sessions`.
- Staff sign-out-all and disable call it in their transactions.
- `bearer({ requireSignature: true })`.
- `getAuthFacts` joins the live session row by id.
- `scripts/browser-checks/session-end.spec.mjs`'s `otherDevice()` uses the signed `set-auth-token` header as its bearer, not the body's raw token (as `auth.int.test.ts` and `disabled.int.test.ts` already do).
- The hand-off gives the corrections for `ops/data-copies.md` and the auth doc's cookie-cache section (loops don't edit `docs/`).

About 9 files: the auth config and hook, `authUser`, `userModel`, `connectorGrantService`, `accountAdminService`, the session-end check, and three test files.

**Acceptance criteria:**

- Integration (`packages/api/src/connectors/mcp.int.test.ts` with `connectAssistant`): after a password reset, the Devices page's sign-out-everywhere, staff sign-out-all or disable, the assistant's access and refresh tokens are refused at `/mcp` and `/oauth2/token`. Signing out one device leaves them working.
- Integration (`rpcAuth.int.test.ts`): a session revoked elsewhere is refused on the next ordinary `/rpc` call, even with a fresh `session_data` cookie. The existing live-path pins still pass.
- Integration (`auth.int.test.ts`): an unsigned bearer token (the raw stored token) is refused, and the signed one works.
- Integration (`connectorGrant.int.test.ts`): `revokeAllForUser` ends every live grant of the account and no one else's.
- e2e (`session-end`): the other-device path still passes with the signed token.
- `pnpm prd check --quick` green.

**Blocked by:** slice 2 (`packages/auth/src/auth.ts`). **Blocks:** slice 7.

## Slice 6: Join-request and signed-in limits

Stack: no · Reads: docs/domain/api.md, docs/domain/sync.md, docs/domain/care-groups.md · Tests: integration

**User stories:** US 5, 6.

**Build:** the join-request and oRPC bullets of _Signed-in and connector limits_.

- A 7-day cooldown after a declined or withdrawn request.
- A per-user limit middleware on signed-in procedures, with tight named limits on the email-sending ones (invite create and resend, link requests, assistant asks) and its own limit for `sync.upload`. Limits are on in check builds too (`NODE_ENV=production`), so the default must clear the whole browser suite (sync-matrix, roundtrip), counting the uploader's one-op-per-request retry after a 400 (up to 100 calls). The slice states its numbers and why.
- A 429 is `TOO_MANY_REQUESTS` with `retry-after`, never `BAD_REQUEST`. The device's uploader sets aside only bad requests, so it keeps the change queued and retries. No device code changes.

**Acceptance criteria:**

- Integration (`joinRequest.int.test.ts`): a declined or withdrawn requester asking again within 7 days gets "requested", with no new row and no email. After 7 days a new request works.
- Integration (`router.int.test.ts` or `rateLimit.int.test.ts`, limits on):
  - the call past the per-user limit gets 429 with `retry-after`, and another user is unaffected;
  - `invite.resend` hits its tighter limit;
  - `sync.upload` past its limit answers `TOO_MANY_REQUESTS`, and the change is saved after the wait.
- `pnpm prd check --quick` green.

**Blocked by:** slice 1 (the invite and link paths), slice 2 (the limiter scopes). **Blocks:** slice 7.

## Slice 7: Connector and client-IP limits

Stack: yes · Reads: docs/domain/connectors.md, docs/domain/auth.md, docs/domain/calendars.md, docs/agents/loop.md · Tests: unit, integration, e2e:roundtrip

**User stories:** US 13.

**Build:** the `/mcp` and client-IP bullets of _Signed-in and connector limits_.

- A per-IP limit on `/mcp` before token verification, and on `/oauth2/register`.
- `clientIpKey` for every IP limiter (`/mcp`, `/oauth2/register`, the calendar feed, public forms). In production a missing client IP is refused (400) and logged. `checkDeployEnv` already requires `CLIENT_IP_HEADER`, so keep it. Check builds run as production, so the rule applies there too: `scripts/browser-checks/roundtrip.spec.mjs`'s `/mcp` request sends `x-forwarded-for: randomIp()`.

**Acceptance criteria:**

- Integration (`packages/api/src/connectors/mcp.int.test.ts`):
  - `/mcp` past the per-IP limit gets 429 before `verify` runs (a spy);
  - `/oauth2/register` past it gets 429;
  - the per-grant limit is unchanged.
- Unit (`rateLimit` and `host.test.ts`):
  - with no client IP, production refuses and dev keys on the fixed dev key;
  - the feed and public forms use the helper, with no `"unknown"` key left (a grep test or the existing tests).
- e2e (`roundtrip`): the connector step passes with its client IP.
- `pnpm prd check --quick` green.

**Blocked by:** slice 2 (`packages/auth/`), slice 5 (`packages/auth/`, connectors tests), slice 6 (`rateLimit.ts`). **Blocks:** none.
