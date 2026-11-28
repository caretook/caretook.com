import type { RateLimiter } from "@caretook/data";

import { createRateLimiter, postgresStore } from "@caretook/data";

// Our limiter (`createRateLimiter` and its stores) lives in @caretook/data,
// so @caretook/auth's limits share it; the API's limiters import it from here.
export type { RateLimiter, RateLimitStore } from "@caretook/data";
export { createRateLimiter, defaultStore, memoryStore, postgresStore } from "@caretook/data";

// ---------------------------------------------------------------------------
// Per-user limits on signed-in procedures (account-security slice 6, B-334)
// ---------------------------------------------------------------------------

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Each signed-in procedure counts against one of these, per user (procedures.ts):
 *   - `default`: every procedure without its own. Screens read the local
 *     database, so a person makes a few calls a minute; 300 (5 a second for
 *     a whole minute) is far past any screen and the browser suite, and still
 *     stops a script hammering the API.
 *   - `sync`: `sync.upload`, apart from the default so a long queue never
 *     blocks other calls. After a 400 the device resends a batch one op per
 *     request (up to 100 calls at once), so 600 leaves room for several of
 *     those a minute on top of normal uploads (up to 100 ops each).
 *   - `inviteEmail`: `invite.createEmail` and `invite.resend` together, each
 *     an email to someone else: 30 an hour.
 *   - `joinAsk`: `invite.accept` (with a link it emails the group's owners
 *     and admins): 30 an hour.
 * Past one, the call is a 429 (`TOO_MANY_REQUESTS`) with `retry-after` (the
 * window, in seconds). The device's uploader sets aside only 400s, so a 429
 * keeps the change queued and PowerSync retries it. On only in production
 * (check builds included) unless a test turns them on.
 */
export const USER_LIMITS = {
  default: { limit: 300, windowMs: MINUTE_MS },
  sync: { limit: 600, windowMs: MINUTE_MS },
  inviteEmail: { limit: 30, windowMs: HOUR_MS },
  joinAsk: { limit: 30, windowMs: HOUR_MS },
} as const;

export type UserLimitName = keyof typeof USER_LIMITS;

export type UserLimits = {
  /** Count a call on `name` by `userId`: null when allowed, else the seconds to wait (always null when off). */
  hit: (name: UserLimitName, userId: string) => Promise<number | null>;
};

/**
 * The per-user limits, on (`enabled`) or off; on, they count in Postgres,
 * scope `user.<name>`, so every instance shares one count. `limits` changes
 * some for a test, `now` is the clock.
 */
export const createUserLimits = ({
  enabled = process.env.NODE_ENV === "production",
  limits = {},
  now = Date.now,
}: {
  enabled?: boolean;
  limits?: Partial<Record<UserLimitName, { limit: number; windowMs?: number }>>;
  now?: () => number;
} = {}): UserLimits => {
  if (!enabled) return { hit: () => Promise.resolve(null) };
  const entries = (Object.keys(USER_LIMITS) as UserLimitName[]).map((name) => {
    const windowMs = limits[name]?.windowMs ?? USER_LIMITS[name].windowMs;
    const limiter: RateLimiter = createRateLimiter({
      limit: limits[name]?.limit ?? USER_LIMITS[name].limit,
      windowMs,
      store: postgresStore(`user.${name}`),
    });
    return [name, { limiter, retryAfter: Math.ceil(windowMs / 1000) }] as const;
  });
  const byName = Object.fromEntries(entries) as Record<
    UserLimitName,
    { limiter: RateLimiter; retryAfter: number }
  >;
  return {
    hit: async (name, userId) => {
      const { limiter, retryAfter } = byName[name];
      return (await limiter.hit(userId, now())) ? null : retryAfter;
    },
  };
};
