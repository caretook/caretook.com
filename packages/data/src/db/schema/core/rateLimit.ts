import type { InferSelectModel } from "drizzle-orm";

import { bigint, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id } from "./columns";

// Rate limits shared by every server instance (hosting PRD, slice 3). Both
// tables are the system's only (see PERMISSIONS): nothing reads them through
// a model, nothing syncs, and the outbox cron's sweep purges old rows
// (rateLimitService.purge). Neither stores anything but a key and times; a
// key is an IP address and a path or form, never a person's details.

/**
 * The longest window any limiter may use. The purge keeps rows this long,
 * so no window is cut short; `createRateLimiter` refuses a longer one.
 */
export const RATE_LIMIT_LONGEST_WINDOW_MS = 60 * 60_000;

// One row per counted hit of our limiter (`packages/api/src/rateLimit.ts`'s
// `postgresStore`): a sliding window is the count of a key's rows newer
// than the window's start.
export const rateLimitHitSchema = pgTable(
  "rate_limit_hit",
  {
    id: id(),
    key: text("key").notNull(),
    hitAt: timestamp("hit_at", { precision: 3, mode: "string", withTimezone: true }).notNull(),
  },
  (t) => [
    index("rate_limit_hit_key_hit_at_idx").on(t.key, t.hitAt),
    index("rate_limit_hit_hit_at_idx").on(t.hitAt),
  ],
);

// Better Auth's own limiter (`rateLimit.storage = "database"`): one row per
// IP and path, a count and the last request in epoch milliseconds. Column
// keys are Better Auth's field names (like the tables in auth.ts).
export const rateLimitSchema = pgTable(
  "rate_limit",
  {
    id: id(),
    key: text("key").notNull().unique(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [index("rate_limit_last_request_idx").on(t.lastRequest)],
);

export type RateLimitHit = InferSelectModel<typeof rateLimitHitSchema>;
export type RateLimit = InferSelectModel<typeof rateLimitSchema>;
