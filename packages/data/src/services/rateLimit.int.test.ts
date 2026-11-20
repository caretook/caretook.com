import { inArray, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "../db";
import { RATE_LIMIT_LONGEST_WINDOW_MS, rateLimitHitSchema, rateLimitSchema } from "../db/schema";
import { isError } from "../errors";
import * as rateLimitService from "./rateLimitService";

// The rate-limit purge (hosting PRD, slice 3), run by the outbox cron's
// sweep. The limiter itself is tested in packages/api (rateLimit.int.test.ts).

const scope = () => `test.${randomUUID().slice(0, 8)}`;

describe("rateLimitService.purge", () => {
  it("deletes only rows older than the longest window, ours and Better Auth's", async () => {
    const tag = scope();
    const now = Date.now();
    const old = now - RATE_LIMIT_LONGEST_WINDOW_MS - 1000;
    const recent = now - 60_000;
    await getDb()
      .insert(rateLimitHitSchema)
      .values([
        { key: `${tag}:old`, hitAt: new Date(old).toISOString() },
        { key: `${tag}:recent`, hitAt: new Date(recent).toISOString() },
      ]);
    await getDb()
      .insert(rateLimitSchema)
      .values([
        { key: `${tag}|old`, count: 3, lastRequest: old },
        { key: `${tag}|recent`, count: 3, lastRequest: recent },
      ]);

    const purged = await rateLimitService.purge({ now });
    if (isError(purged)) throw purged;
    expect(purged.hits).toBeGreaterThanOrEqual(1);
    expect(purged.authCounters).toBeGreaterThanOrEqual(1);

    const hits = await getDb()
      .select({ key: rateLimitHitSchema.key })
      .from(rateLimitHitSchema)
      .where(like(rateLimitHitSchema.key, `${tag}:%`));
    expect(hits.map((h) => h.key)).toEqual([`${tag}:recent`]);
    const counters = await getDb()
      .select({ key: rateLimitSchema.key })
      .from(rateLimitSchema)
      .where(inArray(rateLimitSchema.key, [`${tag}|old`, `${tag}|recent`]));
    expect(counters.map((c) => c.key)).toEqual([`${tag}|recent`]);
  });
});
