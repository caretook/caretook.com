import type { AppError, AuthUser, GroupRoleName } from "@caretook/data";

import { careGroupMemberModel, isError, SYSTEM_USER, userModel } from "@caretook/data";
import { getAuth } from "./auth";

/**
 * Resolve a request's session (cookie or bearer token) to the AuthUser that
 * services expect: global role plus a role per care group. Returns null when
 * there's no valid session.
 *
 * `groupRoles` is for UI checks only; the model layer re-checks membership
 * in SQL on every query.
 */
export const getAuthUser = async (headers: Headers): Promise<AuthUser | null | AppError> => {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;

  const user = await userModel.getById(session.user.id, { authUser: SYSTEM_USER });
  if (isError(user)) return user;
  if (!user) return null;

  const memberships = await careGroupMemberModel.list({
    authUser: SYSTEM_USER,
    filter: { userId: { type: "eq", value: user.id } },
  });
  if (isError(memberships)) return memberships;

  const groupRoles: Record<string, GroupRoleName> = {};
  for (const m of memberships.data) groupRoles[m.groupId] = m.role;

  return { id: user.id, roleNames: user.roleNames, groupRoles };
};
