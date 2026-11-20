import { RATE_LIMIT_LONGEST_WINDOW_MS } from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRateLimiter, postgresStore } from "./rateLimit";

// The shared limiter (hosting PRD, slice 3) on the real `rate_limit_hit`
// table: two limiters stand for two server instances.

const scope = () => `test.${randomUUID().slice(0, 8)}`;

describe("postgresStore", () => {
  it("lets instances sharing the table allow exactly `limit` hits, even at once", async () => {
    const shared = scope();
    const a = createRateLimiter({ limit: 5, windowMs: 60_000, store: postgresStore(shared) });
    const b = createRateLimiter({ limit: 5, windowMs: 60_000, store: postgresStore(shared) });
    const now = Date.now();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).hit("203.0.113.9", now)),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    // Another key, and another scope with the same key, count on their own.
    expect(await a.hit("203.0.113.10", now)).toBe(true);
    const other = createRateLimiter({ limit: 5, windowMs: 60_000, store: postgresStore(scope()) });
    expect(await other.hit("203.0.113.9", now)).toBe(true);
  });

  it("slides: a hit frees its slot `windowMs` later, and refused hits aren't counted", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, store: postgresStore(scope()) });
    const t0 = Date.now();
    expect(await limiter.hit("a", t0)).toBe(true);
    expect(await limiter.hit("a", t0 + 100)).toBe(true);
    expect(await limiter.hit("a", t0 + 200)).toBe(false);
    expect(await limiter.hit("a", t0 + 999)).toBe(false);
    expect(await limiter.hit("a", t0 + 1001)).toBe(true);
    expect(await limiter.hit("a", t0 + 1050)).toBe(false);
    // The per-call limit (a setting read at call time) overrides the limiter's.
    expect(await limiter.hit("a", t0 + 1050, 3)).toBe(true);
    await limiter.reset();
    expect(await limiter.hit("a", t0 + 1050)).toBe(true);
  });

  it("refuses a window longer than the purge keeps rows", () => {
    expect(() =>
      createRateLimiter({
        limit: 1,
        windowMs: RATE_LIMIT_LONGEST_WINDOW_MS + 1,
        store: postgresStore(scope()),
      }),
    ).toThrow();
  });
});
