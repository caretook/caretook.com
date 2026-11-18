import type { AuthUser } from "@caretook/data";

import { ORPCError, os } from "@orpc/server";

/** Per-request context. The mount point resolves the session; procedures never read requests. */
export type ApiContext = { authUser: AuthUser | null };

export const publicProcedure = os.$context<ApiContext>();

/** Requires a signed-in user (`context.authUser` is non-null inside). */
export const authedProcedure = publicProcedure.use(({ context, next }) => {
  if (!context.authUser) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { authUser: context.authUser } });
});
