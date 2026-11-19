import type { AuthUser, StaffCapability } from "@caretook/data";

import { isError, logError, staffCan } from "@caretook/data";
import { ORPCError, os } from "@orpc/server";

/**
 * Per-request context. The mount point resolves the session (and the
 * caller's IP address, for the public forms' rate limit); procedures never
 * read requests.
 */
export type ApiContext = { authUser: AuthUser | null; clientIp?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The input's `groupId`, when it's an id (input isn't validated yet here). */
const groupIdOf = (input: unknown) => {
  const id = (input as { groupId?: unknown } | null | undefined)?.groupId;
  return typeof id === "string" && UUID.test(id) ? id : undefined;
};

/** A server failure: an ORPCError of 500 or more, or anything thrown that isn't one. */
const isServerFailure = (error: unknown) => !(error instanceof ORPCError) || error.status >= 500;

/**
 * Logs every server failure once, through `logError`: the AppError's code
 * (or the thrown error's class), the procedure, the actor and the group.
 * Never the input, the message or `meta` (security review S-8). 4xx errors
 * are the caller's and aren't logged.
 */
export const logFailures = os.$context<ApiContext>().middleware(async ({ context, path, next }, input) => {
  try {
    return await next();
  } catch (error) {
    if (isServerFailure(error)) {
      const appError = error instanceof ORPCError && isError(error.cause) ? error.cause : error;
      logError("rpc: procedure failed", appError, {
        procedure: path.join("."),
        actorId: context.authUser?.id,
        groupId: groupIdOf(input),
      });
    }
    throw error;
  }
});

export const publicProcedure = os.$context<ApiContext>().use(logFailures);

/** Requires a signed-in user (`context.authUser` is non-null inside). */
export const authedProcedure = publicProcedure.use(({ context, next }) => {
  if (!context.authUser) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { authUser: context.authUser } });
});

/**
 * Caretook staff with `capability` (db/schema/staffRules.ts: admin and
 * support, each with their own powers). Group roles count for nothing here:
 * a group's owner is refused like anyone else (a 403), and so is support on
 * an admin-only capability.
 */
export const staffProcedure = (capability: StaffCapability) =>
  authedProcedure.use(({ context, next }) => {
    if (!staffCan(context.authUser.roleNames, capability)) throw new ORPCError("FORBIDDEN");
    return next({ context });
  });
