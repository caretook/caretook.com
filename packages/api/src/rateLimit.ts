// A per-key limit on how often something may happen: at most `limit` hits in
// any `windowMs` (a sliding window over the hits' times). In memory, so on a
// serverless host each instance counts on its own: the same storage question
// as Better Auth's rate limits, open until launch.

export type RateLimiter = {
  /**
   * Count a hit for `key`. False when `key` is over its limit (the hit isn't
   * counted). `limit` overrides the limiter's own for this hit (a setting
   * read at call time).
   */
  hit: (key: string, now?: number, limit?: number) => boolean;
  reset: () => void;
};

/** Forget keys that have gone quiet once the map grows past this many. */
const PRUNE_AT = 10_000;

export const createRateLimiter = ({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter => {
  const hits = new Map<string, number[]>();

  const prune = (now: number) => {
    for (const [key, times] of hits) {
      if (!times.some((t) => t > now - windowMs)) hits.delete(key);
    }
  };

  return {
    hit: (key, now = Date.now(), max = limit) => {
      if (hits.size > PRUNE_AT) prune(now);
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    reset: () => hits.clear(),
  };
};
