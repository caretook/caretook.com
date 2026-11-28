import { RATE_LIMIT_LONGEST_WINDOW_MS } from "../db/schema";
import { isError } from "../errors";
import { logError } from "../logging";
import * as rateLimitService from "./rateLimitService";

// A per-key limit on how often something may happen: at most `limit` hits in
// any `windowMs` (a sliding window over the hits' times). Where the hits are
// counted is the store's business:
//   - `memoryStore`: this process only (unit tests and dev);
//   - `postgresStore`: the `rate_limit_hit` table, shared by every server
//     instance (production and check builds), so spreading requests across
//     serverless instances doesn't multiply the limit.
// `defaultStore` picks by NODE_ENV. Old rows are purged by the outbox cron.
// It lives here, not in @caretook/api, so @caretook/auth's limits (sign-in
// emails and codes, link sign-up) use it too; the API re-exports it.

export type RateLimitStore = {
  /** Count a hit for `key` at `now` unless it already has `limit` in the window. True when counted. */
  hit: (key: string, now: number, windowMs: number, limit: number) => Promise<boolean>;
  /** Forget every key (tests). */
  reset: () => Promise<void>;
};

export type RateLimiter = {
  /**
   * Count a hit for `key`. False when `key` is over its limit (the hit isn't
   * counted). `limit` overrides the limiter's own for this hit (a setting
   * read at call time).
   */
  hit: (key: string, now?: number, limit?: number) => Promise<boolean>;
  reset: () => Promise<void>;
};

/** Forget keys that have gone quiet once the map grows past this many. */
const PRUNE_AT = 10_000;

/** Hits in this process's memory: each instance counts on its own. */
export const memoryStore = (): RateLimitStore => {
  const hits = new Map<string, number[]>();

  const prune = (now: number, windowMs: number) => {
    for (const [key, times] of hits) {
      if (!times.some((t) => t > now - windowMs)) hits.delete(key);
    }
  };

  return {
    hit: (key, now, windowMs, max) => {
      if (hits.size > PRUNE_AT) prune(now, windowMs);
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return Promise.resolve(false);
      }
      recent.push(now);
      hits.set(key, recent);
      return Promise.resolve(true);
    },
    reset: () => {
      hits.clear();
      return Promise.resolve();
    },
  };
};

/**
 * Hits in Postgres, shared by every instance. `scope` names the limiter
 * (keys are stored as `<scope>:<key>`), so limiters keyed alike, such as
 * two forms keyed by IP, don't count each other's hits. A database failure
 * throws: the request fails rather than passing unlimited.
 */
export const postgresStore = (scope: string): RateLimitStore => {
  const prefix = `${scope}:`;
  return {
    hit: async (key, now, windowMs, limit) => {
      const counted = await rateLimitService.hit({ key: prefix + key, now, windowMs, limit });
      if (isError(counted)) {
        logError("rate limit: couldn't count a hit", counted);
        throw counted;
      }
      return counted;
    },
    reset: async () => {
      const cleared = await rateLimitService.clear(prefix);
      if (isError(cleared)) throw cleared;
    },
  };
};

/** Postgres in production (check builds included), memory otherwise. */
export const defaultStore = (scope: string): RateLimitStore =>
  process.env.NODE_ENV === "production" ? postgresStore(scope) : memoryStore();

export const createRateLimiter = ({
  limit,
  windowMs,
  store = memoryStore(),
}: {
  limit: number;
  windowMs: number;
  store?: RateLimitStore;
}): RateLimiter => {
  // The purge keeps rows only this long; a longer window would be cut short.
  if (windowMs > RATE_LIMIT_LONGEST_WINDOW_MS) {
    throw new Error(`A rate-limit window can't be longer than ${RATE_LIMIT_LONGEST_WINDOW_MS} ms`);
  }
  return {
    hit: (key, now = Date.now(), max = limit) => store.hit(key, now, windowMs, max),
    reset: () => store.reset(),
  };
};
