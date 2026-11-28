import type { AppError, AuthUser, StaffCapability } from "@caretook/data";
import type { UserLimitName, UserLimits } from "./rateLimit";

import { isError, logError, staffCan } from "@caretook/data";
import { ORPCError, os } from "@orpc/server";
import { unwrap } from "./errors";
import { createUserLimits } from "./rateLimit";

/**
 * The mount point's session lookup. `live` reads the session row itself,
 * bypassing Better Auth's 3-minute session cookie cache (docs/domain/auth.md).
 */
export type AuthUserLookup = (opts: { live: boolean }) => Promise<AuthUser | null | AppError>;

/** A request's lazy AuthUser: resolved on first use, once per mode (`lazyAuthUser`). */
export type LazyAuthUser = {
  (opts?: { live?: boolean }): Promise<AuthUser | null | AppError>;
  /** What's been resolved so far, without looking anything up (for logs). */
  resolved: () => AuthUser | null | undefined;
};

/**
 * Memoise `lookup` for one request (B-140). Public procedures don't call
 * it (but `invite.preview` for a used-up link: `optionalAuthUser`); authed ones resolve it once, staff ones once with `live`. A live
 * answer also stands for a cached one.
 */
export const lazyAuthUser = (lookup: AuthUserLookup): LazyAuthUser => {
  let cached: Promise<AuthUser | null | AppError> | undefined;
  let live: Promise<AuthUser | null | AppError> | undefined;
  let settled: AuthUser | null | undefined;
  const remember = (answer: AuthUser | null | AppError) => {
    if (!isError(answer)) settled = answer;
    return answer;
  };
  const get = (opts: { live?: boolean } = {}) => {
    if (opts.live) return (live ??= lookup({ live: true }).then(remember));
    return live ?? (cached ??= lookup({ live: false }).then(remember));
  };
  return Object.assign(get, { resolved: () => settled });
};

/**
 * Per-request context; procedures never read requests. Either `authUser`
 * is given (in-process callers and tests), or the mount point passes
 * `getAuthUser`, which authed and staff procedures resolve in their
 * middleware; public procedures don't look up a session (but `optionalAuthUser`).
 *   - `clientIp`: the caller's address as the mount point trusts it, for
 *     per-IP limits (the public forms, a link's sign-up); never stored.
 *   - `userLimits`: the per-user limits (rateLimit.ts); a test passes its
 *     own, everyone else gets the process's.
 *   - `resHeaders`: the response's headers (`/rpc`'s ResponseHeadersPlugin),
 *     where a 429's `retry-after` goes.
 */
export type ApiContext = {
  authUser?: AuthUser | null;
  getAuthUser?: LazyAuthUser;
  clientIp?: string | null;
  userLimits?: UserLimits;
  resHeaders?: Headers;
};

/** The caller, as `authedProcedure` and `staffProcedure` resolve it (a lookup error is a 500). */
const resolveAuthUser = async (context: ApiContext, live: boolean) =>
  context.authUser !== undefined
    ? context.authUser
    : context.getAuthUser
      ? unwrap(await context.getAuthUser({ live }))
      : null;

/**
 * The caller if signed in, else null, for a public procedure whose answer
 * differs for one person (`invite.preview`). Call it only when needed.
 */
export const optionalAuthUser = (context: ApiContext) => resolveAuthUser(context, false);

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
        actorId: (context.authUser ?? context.getAuthUser?.resolved())?.id,
        groupId: groupIdOf(input),
      });
    }
    throw error;
  }
});

export const publicProcedure = os.$context<ApiContext>().use(logFailures);

let processLimits: UserLimits | undefined;

/**
 * Counts the call against the caller's `name` limit (rateLimit.ts's
 * USER_LIMITS); past it, a 429 with `retry-after`, never a 400: the
 * device's uploader sets aside only bad requests, so a limited upload stays
 * queued and is retried.
 */
const perUser = (name: UserLimitName) =>
  os.$context<ApiContext & { authUser: AuthUser }>().middleware(async ({ context, next }) => {
    const limits = context.userLimits ?? (processLimits ??= createUserLimits());
    const wait = await limits.hit(name, context.authUser.id);
    if (wait !== null) {
      context.resHeaders?.set("retry-after", String(wait));
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many requests. Wait a little and try again.",
        data: { code: "rateLimit:tooMany", retryAfter: wait },
      });
    }
    return next();
  });

/** A signed-in user (`context.authUser` is non-null inside), not yet limited. */
const signedIn = publicProcedure.use(async ({ context, next }) => {
  const authUser = await resolveAuthUser(context, false);
  if (!authUser) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { authUser } });
});

/** Requires a signed-in user (`context.authUser` is non-null inside), within the per-user default limit. */
export const authedProcedure = signedIn.use(perUser("default"));

/**
 * A signed-in procedure under its own per-user limit instead of the
 * default: `sync.upload` and the ones that email other people.
 */
export const limitedProcedure = (name: Exclude<UserLimitName, "default">) => signedIn.use(perUser(name));

/**
 * Caretook staff with `capability` (db/schema/staffRules.ts: admin and
 * support, each with their own powers). Group roles count for nothing here:
 * a group's owner is refused like anyone else (a 403), and so is support on
 * an admin-only capability. The session is read live, never from the
 * cookie cache (B-140), so a revoked staff session is refused at once.
 * Within the per-user default limit, like every signed-in procedure.
 */
export const staffProcedure = (capability: StaffCapability) =>
  publicProcedure
    .use(async ({ context, next }) => {
      const authUser = await resolveAuthUser(context, true);
      if (!authUser) throw new ORPCError("UNAUTHORIZED");
      if (!staffCan(authUser.roleNames, capability)) throw new ORPCError("FORBIDDEN");
      return next({ context: { authUser } });
    })
    .use(perUser("default"));
