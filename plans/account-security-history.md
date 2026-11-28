## Doc folds pending (from wave 2 hand-offs, for its landing)

- Slice 5 (1a43a0197):
  - `ops/data-copies.md`, Postgres row: not "hashed tokens"; tokens are stored plain, usable only signed with `BETTER_AUTH_SECRET` (bearer refuses unsigned, B-330).
  - `docs/domain/auth.md`: `bearer({ requireSignature: true })` (only the signed `set-auth-token` works); `getAuthFacts(userId, sessionId)` joins the live session row; the cookie cache section drops the ⚠ tradeoff: `getAuthUser` joins the session row every call (B-339), so a revoked session is refused on the next `/rpc` call; staff procedures, `/token` and the app's session check still bypass the cache. `/reset-password` revokes grants in `onPasswordReset` (the after hook can't see whose password changed).
  - `docs/domain/connectors.md`, Grants: `revokeAllForUser` ends every grant; called after `/revoke-sessions` and `/revoke-other-sessions` (`sessionsEnded.ts`), from `onPasswordReset`, in staff sign-out-all and disable. `/revoke-session` ends no grant; the OAuth plugin ends that session's access token, the `offline_access` refresh token keeps the connection.
  - `docs/domain/admin.md`: sign-out-all and disable also disconnect every assistant, in the same transaction.
- Slice 4 (273ba77a0): admin.md: views and `user.search` (`changes.query`) recorded with an awaited `record`; a bare listing unaudited; roles SQL revokes UPDATE/DELETE on the audit table (`APP_APPEND_ONLY_TABLES`).
- Slice 6 (1e5f23269): api.md: `userLimits`, `resHeaders`, `limitedProcedure`, 429 with `retry-after`; numbers default 300/min, sync 600/min, inviteEmail 30/h, joinAsk 30/h (assistant asks have no oRPC procedure); care-groups.md: 7-day re-ask cooldown.
