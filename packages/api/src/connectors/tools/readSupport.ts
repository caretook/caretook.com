import type { TimelineEntryModel, TimelineEntryKind } from "@caretook/data";
import type { ToolContext } from "../registry";

import { isError, timelineEntryService } from "@caretook/data";
import { z } from "zod";
import { asMember } from "./shared";
import { dayInZone } from "@caretook/data/domain";

// What the read tools beyond the first two share: windows, paging a list the
// services return whole, and a few small readers. Everything here works on
// what a service already returned in the actor's scope.

export const DAY_MS = 24 * 60 * 60 * 1000;
/** At most this many items a page of a list read. */
export const LIST_PAGE_MAX = 50;
/** At most this many search hits. */
export const SEARCH_LIMIT_MAX = 25;
/** With no `from`, reads reach this many days back. */
export const DEFAULT_DAYS_BACK = 90;
/** `upcoming` looks this many days ahead by default, and at most MAX. */
export const UPCOMING_DEFAULT_DAYS = 30;
export const UPCOMING_MAX_DAYS = 90;

/** A list read's page size and cursor (the offset into the list, as the cursor reads back). */
export const pagingInput = {
  cursor: z
    .string()
    .regex(/^\d{1,6}$/, "Pass nextCursor exactly as it was given")
    .optional()
    .describe("`nextCursor` from the previous page, for the next one (with the same filters)."),
  limit: z
    .int()
    .min(1)
    .max(LIST_PAGE_MAX)
    .optional()
    .describe(`How many items (at most ${LIST_PAGE_MAX}; the default).`),
};

/** One page of an already ordered list. */
export const pageOf = <T>(items: readonly T[], args: { cursor?: string; limit?: number }) => {
  const start = args.cursor ? Number(args.cursor) : 0;
  const limit = args.limit ?? LIST_PAGE_MAX;
  const end = start + limit;
  return {
    items: items.slice(start, end),
    nextCursor: end < items.length ? String(end) : null,
  };
};

/** The moment `days` days before `now`. */
export const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

/**
 * Every entry of `kinds` from `from` (inclusive) to `to` (exclusive), paging
 * through the service; at most `maxPages` pages so a huge range stays bounded.
 */
export const entriesBetween = async (
  ctx: ToolContext,
  args: { kinds: TimelineEntryKind[]; from: string; to?: string },
  maxPages = 10,
) => {
  const all: TimelineEntryModel[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const res = await timelineEntryService.list(asMember(ctx), {
      groupId: ctx.groupId,
      ...args,
      cursor,
      limit: LIST_PAGE_MAX,
    });
    if (isError(res)) return res;
    all.push(...res.data);
    cursor = res.nextCursor;
    if (!cursor) break;
  }
  return all;
};

/** Whole years on `day`, for a "YYYY-MM-DD" birthday; null for a bad date or one in the future. */
export const ageOn = (dateOfBirth: string, day: string): number | null => {
  const born = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  const today = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!born || !today) return null;
  const [, by, bm, bd] = born.map(Number);
  const [, ty, tm, td] = today.map(Number);
  let age = ty! - by!;
  if (tm! < bm! || (tm === bm && td! < bd!)) age -= 1;
  return age >= 0 ? age : null;
};

/** The recipient's age today (their zone), never the birthday itself. */
export const recipientAge = (dateOfBirth: string | null | undefined, now: Date, timeZone: string) =>
  dateOfBirth ? ageOn(dateOfBirth, dayInZone(now, timeZone)) : null;
