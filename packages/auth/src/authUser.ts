import type { AppError, AuthUser } from "@caretook/data";

import { isError, userModel } from "@caretook/data";
import { getAuth } from "./auth";

export type AuthUserOptions = {
  /**
   * Read the live session row, bypassing Better Auth's session cookie cache
   * (auth.ts, `cookieCache`): staff work and anything else that must see a
   * revocation at once. Without it, a session revoked in the last 3 minutes
   * can still resolve (docs/domain/auth.md).
   */
  live?: boolean;
};

/**
 * Resolve a request's session (cookie or bearer token) to the AuthUser that
 * services expect: global role plus a role per care group. Returns null when
 * there's no valid session, or the account is disabled (admin PRD: its
 * sessions are revoked when it's disabled; this covers one already in use,
 * and a session still in the cookie cache, since the account is read live).
 *
 * The account and its memberships load in one query (B-140).
 *
 * `groupRoles` is for UI checks only; the model layer re-checks membership
 * in SQL on every query.
 */
export const getAuthUser = async (
  headers: Headers,
  { live = false }: AuthUserOptions = {},
): Promise<AuthUser | null | AppError> => {
  const session = await getAuth().api.getSession({
    headers,
    ...(live ? { query: { disableCookieCache: true } } : {}),
  });
  if (!session) return null;

  const facts = await userModel.getAuthFacts(session.user.id);
  if (isError(facts)) return facts;
  if (!facts || facts.disabledAt) return null;

  return { id: facts.id, roleNames: facts.roleNames, groupRoles: facts.groupRoles };
};
