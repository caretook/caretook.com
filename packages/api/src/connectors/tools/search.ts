import { isError, searchService, SERVER_SEARCH_ITEM_TYPES, TIMELINE_ENTRY_KINDS } from "@caretook/data";
import { z } from "zod";
import { iso } from "../../dto";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso } from "../time";
import { SEARCH_LIMIT_MAX } from "./readSupport";
import { asMember, loadGroup } from "./shared";

const instant = z.iso.datetime({ offset: true });
const SEARCH_DEFAULT_LIMIT = 10;

const input = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('What to find: words (each matches as a prefix), "exact phrases", and -word to leave one out.'),
  scopes: z
    .array(z.enum(SERVER_SEARCH_ITEM_TYPES))
    .optional()
    .describe("Search only these: entry (timeline), provider, medication. Default: all three."),
  kinds: z.array(z.enum(TIMELINE_ENTRY_KINDS)).optional().describe("Entries only: these kinds."),
  from: instant.optional().describe("Entries only: earliest time (ISO 8601 with an offset)."),
  to: instant.optional().describe("Entries only: before this time (ISO 8601 with an offset)."),
  authorId: z.uuid().optional().describe("Entries only: written by this member."),
  cursor: z
    .string()
    .max(512)
    .optional()
    .describe("`nextCursor` from the previous result, for more entries (with the same query)."),
  limit: z
    .int()
    .min(1)
    .max(SEARCH_LIMIT_MAX)
    .optional()
    .describe(`How many hits of each kind (at most ${SEARCH_LIMIT_MAX}; default ${SEARCH_DEFAULT_LIMIT}).`),
});

/** The care group's entries, providers and medications matching a query, best match first. */
export const search = defineTool({
  name: "search",
  title: "Search the care group",
  description: `Search the care group's timeline entries (including the text of notes and events), providers and medications with the app's query language: words each match as a prefix, "quoted phrases" match in order, -word leaves one out. Best match first, at most ${SEARCH_LIMIT_MAX} of each kind; pass nextCursor back for more entries. Tasks aren't searched: use list_tasks.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const result = await searchService.search(asMember(ctx), {
      groupId: ctx.groupId,
      q: args.q,
      scopes: args.scopes,
      kinds: args.kinds,
      from: args.from,
      to: args.to,
      authorId: args.authorId,
      cursor: args.cursor ?? null,
      limit: args.limit ?? SEARCH_DEFAULT_LIMIT,
    });
    if (isError(result)) return result;

    const zone = loaded.timeZone;
    const hit = (h: (typeof result.entries)[number]) => ({
      id: h.id,
      type: h.type,
      kind: h.kind,
      title: h.title,
      snippet: h.snippet,
      occurredAt: h.occurredAt ? zonedIso(iso(h.occurredAt), zone) : null,
      status: h.status,
    });
    const entries = result.entries.map(hit);
    const providers = result.providers.map(hit);
    const medications = result.medications.map(hit);

    const lines = [
      ...medications.map((h) => `- Medication: ${h.title}${h.status ? ` (${h.status})` : ""}`),
      ...providers.map((h) => `- Provider: ${h.title}${h.status ? ` (${h.status})` : ""}`),
      ...entries.map((h) => `- ${h.occurredAt} ${h.kind}: ${h.title}${h.snippet ? ` — ${h.snippet}` : ""}`),
    ];
    const text = lines.length
      ? [
          `${lines.length} match${lines.length === 1 ? "" : "es"} (${zone}):`,
          ...lines,
          ...(result.nextCursor ? ["More entries: call again with nextCursor."] : []),
        ].join("\n")
      : "Nothing matches.";
    return {
      text,
      structured: { timeZone: zone, entries, providers, medications, nextCursor: result.nextCursor },
    };
  },
});
