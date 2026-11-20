import type { SearchHit } from "@caretook/data";

import { SERVER_SEARCH_ITEM_TYPES, searchService, TIMELINE_ENTRY_KINDS } from "@caretook/data";
import { z } from "zod";
import { iso } from "./dto";
import { unwrap } from "./errors";
import { authedProcedure } from "./procedures";

// Server search (search PRD, slice 6): one care group's entries, providers
// and medications, with the app's query language. For the API and the
// assistant; the app searches its device index and never calls this.

const timestamp = z.iso.datetime({ offset: true });

const toSearchHit = (hit: SearchHit) => ({
  id: hit.id,
  type: hit.type,
  kind: hit.kind,
  title: hit.title,
  snippet: hit.snippet,
  occurredAt: hit.occurredAt ? iso(hit.occurredAt) : null,
  status: hit.status,
  rank: hit.rank,
});

export type SearchHitDto = ReturnType<typeof toSearchHit>;

export const search = {
  /**
   * Search a care group the caller belongs to (others get NOT_FOUND).
   * `q` is the app's query language: words (each a prefix), "phrases", and
   * -word or -"phrase" exclusions; only exclusions, or nothing, finds nothing.
   * `kinds`, `from`, `to` and `authorId` narrow the entries. Entries come
   * best match first; pass `nextCursor` back as `cursor` for more (providers
   * and medications come with the first page only). Snippets are plain text.
   */
  query: authedProcedure
    .input(
      z.object({
        groupId: z.uuid(),
        q: z.string().max(1000),
        scopes: z.array(z.enum(SERVER_SEARCH_ITEM_TYPES)).optional(),
        kinds: z.array(z.enum(TIMELINE_ENTRY_KINDS)).optional(),
        from: timestamp.optional(),
        to: timestamp.optional(),
        authorId: z.uuid().optional(),
        limit: z.int().min(1).max(searchService.SEARCH_MAX_LIMIT).optional(),
        cursor: z.string().max(512).nullish(),
      }),
    )
    .handler(async ({ context, input }) => {
      const result = unwrap(await searchService.search(context, input));
      return {
        entries: result.entries.map(toSearchHit),
        nextCursor: result.nextCursor,
        providers: result.providers.map(toSearchHit),
        medications: result.medications.map(toSearchHit),
      };
    }),
};
