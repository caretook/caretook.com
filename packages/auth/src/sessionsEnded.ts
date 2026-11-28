import { connectorGrantService, isError } from "@caretook/data";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";

// Ending other or all sessions ends every assistant's connection too
// (B-329): an attacker who took the account over may have connected their
// own assistant, whose 30-day tokens no session revocation reaches.
// Better Auth's own paths end them here; staff's sign-out-all and disable
// (raw deletes in accountAdminService) call revokeAllForUser themselves.
// Signing one device out (`/revoke-session`) and signing out leave them.

/** Better Auth's paths that end every other session, or all of them, for the signed-in account. */
const ENDS_SESSIONS_PATHS: ReadonlySet<string> = new Set(["/revoke-sessions", "/revoke-other-sessions"]);

export const endsSessions = (path: string) => ENDS_SESSIONS_PATHS.has(path);

const failed = () =>
  APIError.from("INTERNAL_SERVER_ERROR", { code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" });

/** End every connector grant of `userId`; a failure is the request's (500), never silent. */
export const disconnectAssistants = async (userId: string) => {
  const ended = await connectorGrantService.revokeAllForUser(userId);
  if (isError(ended)) throw failed();
};

/**
 * After every endpoint: once a path that ends sessions has succeeded, the
 * account's assistants go too. The session middleware those paths use left
 * the account on the context. A password reset has no session; it goes
 * through `emailAndPassword.onPasswordReset` (auth.ts), the one place that
 * knows whose password changed once the reset token is consumed.
 */
export const afterHooks = createAuthMiddleware(async (ctx) => {
  if (!endsSessions(ctx.path) || isAPIError(ctx.context.returned)) return;
  const userId = ctx.context.session?.user.id;
  if (userId) await disconnectAssistants(userId);
});
