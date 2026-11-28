# Plan: Account security follow-ups (account-security-2)

> Source PRD: [`plans/account-security-2-prd.md`](account-security-2-prd.md). User-story numbers (US) refer to it. Backlog items B-1011, B-1017, B-1018, B-1019, B-1020.

## Status

**Where it stands:** planned (2026-11-28), not started.

**Items:** slice 1 B-1020 · slice 2 B-1019 · slice 3 B-1017, B-1018 · slices 4, 5 and 6 B-1011 (run `risa backlog done B-1011` after slice 6).

| Slice | Wave | State       | Merge into `prd/account-security-2` (slice commits) |
| ----- | ---- | ----------- | --------------------------------------------------- |
| 1     | 1    | not started |                                                     |
| 2     | 1    | not started |                                                     |
| 4     | 1    | not started |                                                     |
| 5     | 1    | not started |                                                     |
| 3     | 2    | not started |                                                     |
| 6     | 2    | not started |                                                     |

## Architectural decisions

- **Refusals look innocent:** a limit or refusal about another person's address answers as an unknown address or a revoked invite would.
- **Limits use our limiter** (`createRateLimiter`, the Postgres store in production), keyed per address (hashed), per user, per session (hashed), per IP (through `clientIpKey` only) or per link. Off outside production unless a test turns them on.
- **Membership rows are locked in id order**, and read after the lock.
- **No migration, no new dependency, no screen change.**
- **Loops don't edit docs** except slice 6's _Limits_ table in `docs/domain/api.md` (the item's output). At landing the orchestrator folds the rest into [auth](../docs/domain/auth.md), [api](../docs/domain/api.md) and [care-groups](../docs/domain/care-groups.md).
- All test data is fictional (`@example.com`).

## How to run this plan

- **Wave 1:** slices 1, 2, 4 and 5, independent. Slice 1 owns `careGroupMemberModel`'s lock helpers; slice 2 only calls `lockForChange`. Slice 4 owns `packages/auth/`; slice 5 owns `packages/api/src/procedures.ts` and `rateLimit.ts`.
- **Wave 2:** slice 3 (`joinRequestService`, a hot file of the running `data-rights`: start it only once `data-rights` no longer lists it, else hold it for a later wave) and slice 6 (after slices 4 and 5: the manifest names their limits).
- **Gates:** each slice hands off on `pnpm prd check --quick "slice hand-off"`. No browser check: nothing crosses the server and sync.

**Hot files:** `packages/data/src/models/careGroupMember/`, `packages/data/src/services/groupAdminService.ts`, `packages/data/src/services/joinRequestService.ts`, `packages/auth/src/limits.ts`, `packages/auth/src/emails.ts`, `packages/auth/src/auth.ts`, `packages/api/src/procedures.ts`, `packages/api/src/rateLimit.ts`, `packages/api/src/callLimits`, `docs/domain/api.md`.

## Slice 1: One membership lock order

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/data-layer.md · Tests: integration · Blocked by: none · Check: packages/data/src/services/careGroupMember.int.test.ts

**User stories:** US 3.

**Build:** _Memberships and staff changes_ (PRD, _Implementation decisions_), its first point.

- `packages/data/src/models/careGroupMember/careGroupMemberModel.ts` `lockGroupMembers`: order by `id`, not `createdAt` (callers that need creation order sort the returned rows themselves: check `emergencyContactService`'s three callers).
- Search `packages/data/src/models/` and `services/` for other `FOR UPDATE` reads of `care_group_member` and give each the same order. One comment above `lockForChange` states the rule.

**Acceptance criteria:**

- Integration (`careGroupMember.int.test.ts`): a role change and an emergency-contact save on the same group, started at once and repeated several times, all finish (no deadlock error); each helper's SQL orders by id (`toSQL()`).
- Emergency-contact ranks and the primary contact read as before (the existing tests stay green).

**Blocks:** nothing.

## Slice 2: Staff changes read the locked role

Stack: no · Reads: docs/domain/admin.md, docs/domain/care-groups.md, docs/domain/notifications.md · Tests: integration · Blocked by: none · Check: packages/api/src/admin/groupsAdmin.int.test.ts

**User stories:** US 4.

**Build:** _Memberships and staff changes_ (PRD), its second point.

- `packages/data/src/services/groupAdminService.ts` `changeRole` (and `promoteOwner`, which shares it) and `removeMember`: find the membership's id, `careGroupMemberModel.lockForChange(id, tx)`, then `membershipOf`, then the checks and the `staffGroupChange` notice from that locked read.

**Acceptance criteria:**

- Integration (`groupsAdmin.int.test.ts`): staff Change role racing an owner's demotion of the same member (two transactions, the owner's first): the notice names the role after the owner's change, and an owner demoted in that race is among the notice's recipients only if still an owner. The same for Remove.
- Existing staff tests stay green.

**Blocks:** nothing.

## Slice 3: Join requests recheck the link

Stack: no · Reads: docs/domain/care-groups.md · Tests: integration · Blocked by: none · Check: packages/data/src/services/joinRequest.int.test.ts

**User stories:** US 1, 2.

**Build:** _Join requests_ (PRD).

- `packages/data/src/services/joinRequestService.ts` `approve`: after `lockForManager`, load the request's invite and run the maker check `careGroupInviteService.accept` uses (reuse it: move it to a shared helper in the service that owns it if it's private), plus "not revoked". A failure returns the revoked-invite error before any membership is created.
- `requestWithLink`: the cooldown branch returns `{ request: null, created: false, queued: [] }`; fix the callers' types (`careGroupInviteService.accept` reads only `status`).

**Acceptance criteria:**

- Integration (`joinRequest.int.test.ts`):
  - a waiting request whose link's maker was removed (set up directly, as one waiting today) can't be approved: the revoked-invite error, no membership; it can still be declined;
  - a waiting request whose link was revoked can't be approved;
  - a request through a `system` link still approves;
  - a re-ask within the cooldown returns no request and creates nothing; `mine` lists nothing for it.

**Blocks:** nothing. Starts only when `data-rights` no longer lists `joinRequestService` among its hot files.

## Slice 4: Account email and session limits

Stack: no · Reads: docs/domain/auth.md, docs/domain/notifications.md · Tests: integration · Blocked by: none · Check: packages/auth/src/auth.int.test.ts

**User stories:** US 5, 6.

**Build:** _Account email limits_ (PRD).

- `packages/auth/src/limits.ts` `AUTH_LIMITS`: `resetEmail` and `verificationEmail` (5 an hour, per `addressKey`), `session` (300 a minute, per session-token hash).
- `packages/auth/src/emails.ts` `sendResetPassword`, `sendVerificationEmail`: take the limits (as `sendSignInEmail` takes its code maker) and queue nothing past the limit.
- `packages/auth/src/auth.ts`: pass the limits to the senders; in `beforeHooks`, count `session` for signed-in Better Auth paths (those with a session cookie or bearer header, except sign-in and sign-out), past it a 429 with `retry-after`.

**Acceptance criteria:**

- Integration (`auth.int.test.ts`, limits on with low counts): the sixth reset request for one address in an hour answers as the first and queues no email (from different IPs too); the same for verification, including the resend on a password sign-in of an unverified account; a session past its count gets 429 on `/list-sessions` while another session of the same user doesn't.

**Blocks:** slice 6.

## Slice 5: Per-IP limits on /rpc

Stack: no · Reads: docs/domain/api.md, docs/domain/auth.md · Tests: integration · Blocked by: none · Check: packages/api/src/rateLimit.int.test.ts

**User stories:** US 6.

**Build:** _Per-IP limits on `/rpc`_ (PRD).

- `packages/api/src/rateLimit.ts`: new `IP_LIMITS` and new `createIpLimits`: `public` 120 a minute, `signedInCeiling` 6,000 a minute,, shaped like `createUserLimits` (scope `ip.<name>`).
- `packages/api/src/procedures.ts`: a `perIp(name)` middleware keyed through `clientIpKey`; `publicProcedure` uses `perIp("public")`, `signedIn` uses `perIp("signedInCeiling")` before `perUser`. It counts only `/rpc` calls (no `authUser` given), and in production a `/rpc` call with no client IP is a 400. Context gains `ipLimits` (tests pass their own).

**Acceptance criteria:**

- Integration (`rateLimit.int.test.ts`): a public procedure past its per-IP count answers 429 with `retry-after`, another IP doesn't; a signed-in call past the ceiling answers 429 even for a user under their own limit; an in-process call (`authUser` given) never counts; no client IP with the production setting is a 400.
- `procedureSweep.int.test.ts` stays green.

**Blocks:** slice 6.

## Slice 6: The limits manifest and its sweep

Stack: no · Reads: docs/domain/api.md, docs/domain/auth.md, docs/domain/connectors.md, docs/domain/calendars.md · Tests: integration · Blocked by: 4, 5 · Check: packages/api/src/callLimits.int.test.ts (new)

**User stories:** US 7.

**Build:** _The manifest and its sweep_ (PRD).

- `packages/api/src/callLimits.ts` (new, pure): `CALL_LIMITS`, one entry per call: oRPC procedures by dotted path, Better Auth endpoints by path, and the HTTP routes outside both (by hand), each with `kind` and its limits by name (`USER_LIMITS`, `IP_LIMITS`, `AUTH_LIMITS`, `CONNECTOR_IP_LIMIT`, the per-grant `/mcp` limit, the forms' and link sign-up's, Better Auth's own rules, or `secret` for crons).
- `packages/api/src/callLimits.int.test.ts` (new): walks `router` (as `procedureSweep.int.test.ts` does) and `getAuth()`'s served endpoints (minus `disabledPaths` and the `SERVER_ONLY` connector endpoints); each must be in `CALL_LIMITS` with at least one limit, and nothing in it may be stale. Each oRPC procedure called with every limit at zero answers 429.
- `docs/domain/api.md`: a _Limits_ section with the table (call, kind, per user, per IP, per address or other), written from `CALL_LIMITS`, and one line: a new call adds its entry.

**Acceptance criteria:**

- Integration (the new `callLimits.int.test.ts`): green on the current router and auth; removing an entry, or adding a procedure without one, fails it (shown in the hand-off).
- The api doc's table lists every `CALL_LIMITS` entry.

**Blocks:** nothing.
