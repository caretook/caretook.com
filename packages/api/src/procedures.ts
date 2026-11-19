import type { AuthUser } from "@caretook/data";

import { ORPCError, os } from "@orpc/server";

/**
 * Per-request context. The mount point resolves the session (and the
 * caller's IP address, for the public forms' rate limit); procedures never
 * read requests.
 */
export type ApiContext = { authUser: AuthUser | null; clientIp?: string | null };

export const publicProcedure = os.$context<ApiContext>();

/** Requires a signed-in user (`context.authUser` is non-null inside). */
export const authedProcedure = publicProcedure.use(({ context, next }) => {
  if (!context.authUser) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { authUser: context.authUser } });
});

/**
 * Caretook staff only (the global `admin` role). Group roles count for
 * nothing here: a group's owner is refused like anyone else (a 403).
 */
export const adminProcedure = authedProcedure.use(({ context, next }) => {
  if (!context.authUser.roleNames.includes("admin")) throw new ORPCError("FORBIDDEN");
  return next({ context });
});
