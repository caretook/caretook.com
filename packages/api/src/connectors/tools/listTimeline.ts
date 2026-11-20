import type { TimelineEntryModel } from "@caretook/data";
import type { ToolContext } from "../registry";

import { isError, TIMELINE_ENTRY_KINDS, timelineEntryService } from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso, zonedIsoOrNull } from "../time";
import { asMember, loadGroup, loadMembers } from "./shared";

/** At most this many entries a page. */
export const TIMELINE_PAGE_MAX = 50;
/** With no `from` (and no cursor), entries from this many days back. */
export const TIMELINE_DEFAULT_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
/** How much of a note's text the text rendering shows (the data has all of it). */
const TEXT_PREVIEW = 280;

const instant = z.iso.datetime({ offset: true });

const input = z.object({
  from: instant
    .optional()
    .describe(
      `Earliest time to include (ISO 8601 with an offset). Default: ${TIMELINE_DEFAULT_DAYS} days ago.`,
    ),
  to: instant
    .optional()
    .describe("Include entries before this time (ISO 8601 with an offset). Default: no limit."),
  kinds: z
    .array(z.enum(TIMELINE_ENTRY_KINDS))
    .optional()
    .describe("Only these kinds of entry. Default: every kind."),
  authorId: z
    .uuid()
    .optional()
    .describe("Only entries written by this member (an id from the entries' `author`)."),
  cursor: z
    .string()
    .max(512)
    .optional()
    .describe("`nextCursor` from the previous page, for the next one (with the same filters)."),
  limit: z
    .int()
    .min(1)
    .max(TIMELINE_PAGE_MAX)
    .optional()
    .describe(`How many entries, newest first (at most ${TIMELINE_PAGE_MAX}; the default).`),
});

type Author = { id: string; name: string | null };

/** One entry as the assistant sees it: what happened, when, who wrote it, and a note's or event's text. */
const toEntry = (entry: TimelineEntryModel, timeZone: string, authors: Map<string, Author>) => ({
  id: entry.id,
  kind: entry.kind,
  occurredAt: zonedIso(entry.occurredAt, timeZone),
  allDay: entry.allDay,
  endsAt: zonedIsoOrNull(entry.endsAt, timeZone),
  title: entry.title,
  text: entry.body,
  details: entry.details,
  place: entry.place,
  cancelled: entry.cancelledAt
    ? { at: zonedIso(entry.cancelledAt, timeZone), reason: entry.cancelReason }
    : null,
  author: authors.get(entry.createdBy) ?? { id: entry.createdBy, name: null },
  via: entry.via,
});

const line = (entry: ReturnType<typeof toEntry>) => {
  const text =
    entry.text && entry.text.length > TEXT_PREVIEW ? `${entry.text.slice(0, TEXT_PREVIEW)}…` : entry.text;
  const what = [entry.title, text].filter(Boolean).join(": ");
  const by = entry.author.name ? ` (${entry.author.name})` : "";
  return `- ${entry.occurredAt} ${entry.kind}${what ? ` ${what}` : ""}${by}`;
};

const authorsOf = async (ctx: ToolContext) => {
  const members = await loadMembers(ctx);
  if (isError(members)) return members;
  return new Map(members.map((m) => [m.id, { id: m.id, name: m.name }]));
};

/**
 * The group's timeline, newest first, paged (at most 50): notes, events,
 * symptoms, vitals, doses and medication changes, with notes' and events'
 * text. Defaults to the last 90 days.
 */
export const listTimeline = defineTool({
  name: "list_timeline",
  title: "List timeline entries",
  description: `The care group's timeline, newest first: notes, events (appointments), symptoms, vitals, doses and medication changes, with notes' and events' text and who wrote each. Filter by time range, kinds or author. At most ${TIMELINE_PAGE_MAX} a page; pass nextCursor back for more. Without from, the last ${TIMELINE_DEFAULT_DAYS} days.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const authors = await authorsOf(ctx);
    if (isError(authors)) return authors;

    // The default window holds across pages: pass the same filters with the cursor.
    const from = args.from ?? new Date(ctx.now.getTime() - TIMELINE_DEFAULT_DAYS * DAY_MS).toISOString();
    const page = await timelineEntryService.list(asMember(ctx), {
      groupId: ctx.groupId,
      kinds: args.kinds,
      from,
      to: args.to,
      authorId: args.authorId,
      cursor: args.cursor ?? null,
      limit: args.limit ?? TIMELINE_PAGE_MAX,
    });
    if (isError(page)) return page;

    const entries = page.data.map((entry) => toEntry(entry, loaded.timeZone, authors));
    const text = entries.length
      ? [
          `${entries.length} entr${entries.length === 1 ? "y" : "ies"}, newest first (${loaded.timeZone}):`,
          ...entries.map(line),
          ...(page.nextCursor ? ["More: call again with nextCursor."] : []),
        ].join("\n")
      : "No entries in that range.";
    return { text, structured: { timeZone: loaded.timeZone, entries, nextCursor: page.nextCursor } };
  },
});
