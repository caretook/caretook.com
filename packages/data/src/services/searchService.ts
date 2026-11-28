import type { ServerSearchItemType, TimelineEntryKind } from "../db";
import type { Filter } from "../models";
import type { ServiceContext } from "./types";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { dbMayFail, txOrDb } from "../db";
import {
  medicationSchema,
  parseSearch,
  providerSchema,
  SERVER_SEARCH_ITEM_TYPES,
  timelineEntrySchema,
  toTsQuery,
  VITALS,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupModel } from "../models";
import { generateQueryWhere } from "../models/base/queryHelpers";
import { compactPending } from "./noteDocumentService";

// Server search over one care group's entries, providers and medications,
// for the API and the assistant (the app searches its device index).
//
// - The query language is the shared parser's (`parseSearch`, `toTsQuery`):
//   the same words, prefixes, phrases and exclusions as on the device.
// - The searchable text has the same fields as `searchDocument.ts` (keep the
//   two in step): a title-like part weighted A and a body-like part weighted
//   B, folded by `immutable_unaccent` and stemmed by Postgres's `english`.
//   An entry's own columns and every document's compacted `text` are parsed
//   on write, into the generated `search_vector` columns (migration
//   "search"; drizzle's schema leaves them out, so no model returns them).
//   Names from other tables (medications, linked providers, authors) and
//   vital labels are parsed at query time, once per name. Note text is the
//   stored, compacted text: recent typing arrives at the next compaction.
// - Every read is ANDed with the actor's list scope, like the models; a
//   group the actor can't see is `searchService:notFound`.
// - Soft-deleted rows never match. Past providers and stopped medications
//   do, with their `status`.

export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;

export type SearchOptions = {
  groupId: string;
  q: string;
  /** What to search (default: all three; todos are searched on the device only). */
  scopes?: ServerSearchItemType[];
  /** Entries only: these kinds. */
  kinds?: TimelineEntryKind[];
  /** Entries only: inclusive lower bound on `occurredAt` (ISO 8601). */
  from?: string;
  /** Entries only: exclusive upper bound on `occurredAt` (ISO 8601). */
  to?: string;
  /** Entries only: written by this user. */
  authorId?: string;
  /** Most entries per page, and most providers and medications (1–50, default 20). */
  limit?: number;
  /**
   * The previous result's `nextCursor`: the next page of entries. Providers
   * and medications come with the first page only.
   */
  cursor?: string | null;
};

export type SearchHit = {
  id: string;
  type: ServerSearchItemType;
  /** An entry's kind; null for providers and medications. */
  kind: string | null;
  title: string;
  /** A short passage around the match, plain text (no markup). */
  snippet: string;
  /** Entries only: when it happened (Postgres text; the API makes it ISO 8601). */
  occurredAt: string | null;
  /** A provider's (`current | past`) or a medication's (`current | completed | discontinued`) status. */
  status: string | null;
  /** Higher is better; title matches weigh more than body matches. */
  rank: number;
};

export type SearchResult = {
  entries: SearchHit[];
  nextCursor: string | null;
  providers: SearchHit[];
  medications: SearchHit[];
};

const EMPTY: SearchResult = { entries: [], nextCursor: null, providers: [], medications: [] };

/** What an entry is called when it has no title, symptom, vitals or medication. */
const KIND_TITLES: Record<string, string> = {
  note: "Note",
  symptom: "Symptom",
  event: "Event",
  vital: "Vitals",
  dose: "Dose",
  medicationChange: "Medication change",
  conditionChange: "Condition change",
};

/** A vital reading type → its label ("bloodPressure" → "Blood pressure"), as the device indexes it. */
const VITAL_LABELS = JSON.stringify(Object.fromEntries(Object.entries(VITALS).map(([k, v]) => [k, v.label])));

/** One passage of about 20 words around the best match, with no highlight markup. */
const HEADLINE_OPTIONS = 'MaxWords=24, MinWords=10, ShortWord=2, MaxFragments=1, StartSel="", StopSel=""';

// ---------------------------------------------------------------------------
// Cursor: the last entry's (rank, occurredAt, id), rank as Postgres text so it
// compares exactly.
// ---------------------------------------------------------------------------

type SearchCursor = { rank: string; occurredAt: string; id: string };

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$/;
const cursorZSchema = z.tuple([
  z.string().regex(/^-?\d+(\.\d+)?(e-?\d+)?$/),
  z.string().regex(TIMESTAMP_RE),
  z.uuid(),
]);

const encodeCursor = ({ rank, occurredAt, id }: SearchCursor) =>
  Buffer.from(JSON.stringify([rank, occurredAt, id])).toString("base64url");

const decodeCursor = (cursor: string) => {
  try {
    const parsed = cursorZSchema.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (parsed.success) return { rank: parsed.data[0], occurredAt: parsed.data[1], id: parsed.data[2] };
  } catch {
    // Falls through to the error below.
  }
  return newError({ code: "searchService:badCursor" });
};

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

type HitRow = {
  id: string;
  kind: string | null;
  title: string | null;
  snippet: string | null;
  occurredAt: string | null;
  status: string | null;
  rank: number;
  rankText: string;
};

const toHit = (type: ServerSearchItemType, row: HitRow): SearchHit => ({
  id: row.id,
  type,
  kind: row.kind,
  title: row.title?.trim() || (row.kind ? (KIND_TITLES[row.kind] ?? row.kind) : ""),
  snippet: row.snippet?.replace(/\s+/g, " ").trim() ?? "",
  occurredAt: row.occurredAt,
  status: row.status,
  rank: Number(row.rank),
});

const searchEntries = async (
  ctx: ServiceContext,
  query: string,
  { groupId, kinds, from, to, authorId }: SearchOptions,
  limit: number,
  cursor: SearchCursor | null,
) => {
  const range = [
    ...(from ? [{ type: "gte" as const, value: from }] : []),
    ...(to ? [{ type: "lt" as const, value: to }] : []),
  ];
  const filter: Filter<"timelineEntrySchema"> = {
    groupId: { type: "eq", value: groupId },
    deletedAt: { type: "isNull" },
    ...(kinds?.length ? { kind: { type: "inArray", value: kinds } } : {}),
    ...(range.length ? { occurredAt: { type: "and", value: range } } : {}),
    ...(authorId ? { createdBy: { type: "eq", value: authorId } } : {}),
  };
  const where = generateQueryWhere("timelineEntrySchema", "list", { ...ctx, filter });
  if (isError(where)) return where;

  const t = timelineEntrySchema;
  const details = sql`${t.details}`;
  const vitalNames = sql`(SELECT string_agg(${VITAL_LABELS}::jsonb ->> (r.value->>'type'), E'\n')
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${details}->'readings') = 'array'
        THEN ${details}->'readings' END) AS r(value))`;
  const after = cursor
    ? sql`WHERE (h.rank, h.occurred_at, h.id) < (${cursor.rank}::real, ${cursor.occurredAt}::timestamptz, ${cursor.id}::uuid)`
    : sql``;

  // The entry's own text and its document's are parsed on write (the
  // `search_vector` columns, migration "search"); the rest is parsed here, once
  // per medication, linked entry, author and vital entry, never per text row.
  const res = await dbMayFail(
    () =>
      txOrDb(ctx.tx).execute<HitRow>(sql`
        WITH q AS (SELECT to_tsquery('english', ${query}) AS query),
        med AS (
          SELECT m.id::text AS id, nullif(concat_ws(' ', m.name, m.strength), '') AS name,
            setweight(to_tsvector('english', immutable_unaccent(concat_ws(' ', m.name, m.strength))), 'A') AS v
          FROM medication m WHERE m.group_id = ${groupId}
        ),
        linked AS (
          SELECT l.entry_id,
            setweight(to_tsvector('english', immutable_unaccent(string_agg(p.name, E'\n'))), 'A') AS v
          FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id
          WHERE l.group_id = ${groupId} GROUP BY l.entry_id
        ),
        author AS (
          SELECT u.id, setweight(to_tsvector('english', immutable_unaccent(coalesce(u.name, ''))), 'B') AS v
          FROM "user" u
          WHERE u.id IN (SELECT DISTINCT created_by FROM timeline_entry WHERE group_id = ${groupId})
        ),
        h AS (
          SELECT ${t.id} AS id, ${t.kind} AS kind, ${t.occurredAt} AS occurred_at, ${t.title} AS title,
            ${details} AS details, ${t.body} AS body, ${t.place} AS place, d.text AS doc_text,
            med.name AS medication, ts_rank(v.doc, q.query) AS rank
          FROM ${t}
          LEFT JOIN note_document d ON d.id = ${t.id}
          LEFT JOIN med ON ${t.kind} IN ('dose', 'medicationChange') AND med.id = ${details}->>'medicationId'
          LEFT JOIN linked ON linked.entry_id = ${t.id}
          LEFT JOIN author ON author.id = ${t.createdBy}
          CROSS JOIN q
          CROSS JOIN LATERAL (SELECT
            "timeline_entry"."search_vector"
            || coalesce(d.search_vector, ''::tsvector)
            || coalesce(med.v, ''::tsvector)
            || coalesce(linked.v, ''::tsvector)
            || coalesce(author.v, ''::tsvector)
            || CASE WHEN ${t.kind} = 'vital'
                 THEN setweight(to_tsvector('english', coalesce(${vitalNames}, '')), 'A')
                 ELSE ''::tsvector END
            || CASE WHEN ${t.kind} = 'conditionChange'
                 THEN setweight(to_tsvector('english', immutable_unaccent(concat_ws(E'\n',
                   ${details}->>'conditionName', ${details}->'before'->>'name'))), 'A')
                 ELSE ''::tsvector END AS doc) v
          WHERE ${where ?? sql`true`} AND v.doc @@ q.query
        ),
        page AS (
          SELECT h.* FROM h ${after}
          ORDER BY h.rank DESC, h.occurred_at DESC, h.id DESC
          LIMIT ${limit + 1}
        ),
        shown AS (
          SELECT page.*,
            CASE WHEN page.kind = 'symptom' THEN page.details->>'name' END AS symptom,
            CASE WHEN page.kind = 'conditionChange' THEN page.details->>'conditionName' END AS condition,
            (SELECT string_agg(${VITAL_LABELS}::jsonb ->> (r.value->>'type'), ', ')
              FROM jsonb_array_elements(CASE WHEN jsonb_typeof(page.details->'readings') = 'array'
                THEN page.details->'readings' END) AS r(value)) AS vitals,
            concat_ws(E'\n', page.body, page.doc_text, page.details->>'note', page.details->>'stopNote', page.place)
              AS text
          FROM page
        )
        SELECT shown.id, shown.kind,
          coalesce(nullif(btrim(shown.title), ''), shown.symptom, shown.vitals, shown.medication, shown.condition)
            AS title,
          shown.occurred_at::text AS "occurredAt", NULL::text AS status,
          shown.rank::float8 AS rank, shown.rank::text AS "rankText",
          ts_headline('english',
            CASE WHEN btrim(shown.text) <> '' THEN shown.text
              ELSE concat_ws(E'\n', shown.title, shown.symptom, shown.vitals, shown.medication, shown.condition) END,
            q.query, ${HEADLINE_OPTIONS}) AS snippet
        FROM shown CROSS JOIN q
        ORDER BY shown.rank DESC, shown.occurred_at DESC, shown.id DESC`),
    "searchService:query",
  );
  if (isError(res)) return res;

  const rows = res.rows.slice(0, limit);
  const last = rows.at(-1);
  return {
    entries: rows.map((row) => toHit("entry", row)),
    nextCursor:
      res.rows.length > limit && last?.occurredAt
        ? encodeCursor({ rank: last.rankText, occurredAt: last.occurredAt, id: last.id })
        : null,
  };
};

const searchProviders = async (ctx: ServiceContext, query: string, groupId: string, limit: number) => {
  const where = generateQueryWhere("providerSchema", "list", {
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId }, deletedAt: { type: "isNull" } },
  });
  if (isError(where)) return where;

  const p = providerSchema;
  const title = sql`concat_ws(E'\n', ${p.name}, ${p.specialty})`;
  const body = sql`concat_ws(E'\n', pr.name, d.text)`;
  const vector = sql`setweight(to_tsvector('english', immutable_unaccent(${title})), 'A')
    || setweight(to_tsvector('english', immutable_unaccent(coalesce(pr.name, ''))), 'B')
    || coalesce(d.search_vector, ''::tsvector)`;
  const res = await dbMayFail(
    () =>
      txOrDb(ctx.tx).execute<HitRow>(sql`
        WITH q AS (SELECT to_tsquery('english', ${query}) AS query),
        h AS (
          SELECT ${p.id} AS id, ${p.name} AS name, ${p.status} AS status, ${title} AS title_text,
            ${body} AS body_text, ts_rank(v.doc, q.query) AS rank
          FROM ${p}
          LEFT JOIN provider pr ON pr.id = ${p.practiceId} AND pr.group_id = ${p.groupId}
          LEFT JOIN note_document d ON d.id = ${p.id}
          CROSS JOIN q
          CROSS JOIN LATERAL (SELECT ${vector} AS doc) v
          WHERE ${where ?? sql`true`} AND v.doc @@ q.query
          ORDER BY rank DESC, ${p.name}, ${p.id}
          LIMIT ${limit}
        )
        SELECT h.id, NULL::text AS kind, h.name AS title, NULL::text AS "occurredAt", h.status,
          h.rank::float8 AS rank, h.rank::text AS "rankText",
          ts_headline('english', CASE WHEN btrim(h.body_text) <> '' THEN h.body_text ELSE h.title_text END,
            q.query, ${HEADLINE_OPTIONS}) AS snippet
        FROM h CROSS JOIN q
        ORDER BY h.rank DESC, h.name, h.id`),
    "searchService:query",
  );
  return isError(res) ? res : res.rows.map((row) => toHit("provider", row));
};

const searchMedications = async (ctx: ServiceContext, query: string, groupId: string, limit: number) => {
  const where = generateQueryWhere("medicationSchema", "list", {
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId }, deletedAt: { type: "isNull" } },
  });
  if (isError(where)) return where;

  const m = medicationSchema;
  const title = sql`concat_ws(E'\n', ${m.name}, ${m.strength})`;
  const body = sql`concat_ws(E'\n', ${m.reason}, ${m.directions}, d.text)`;
  const vector = sql`setweight(to_tsvector('english', immutable_unaccent(${title})), 'A')
    || setweight(to_tsvector('english', immutable_unaccent(concat_ws(E'\n', ${m.reason}, ${m.directions}))), 'B')
    || coalesce(d.search_vector, ''::tsvector)`;
  const res = await dbMayFail(
    () =>
      txOrDb(ctx.tx).execute<HitRow>(sql`
        WITH q AS (SELECT to_tsquery('english', ${query}) AS query),
        h AS (
          SELECT ${m.id} AS id, concat_ws(' ', ${m.name}, ${m.strength}) AS name, ${m.status} AS status,
            ${title} AS title_text, ${body} AS body_text, ts_rank(v.doc, q.query) AS rank
          FROM ${m}
          LEFT JOIN note_document d ON d.id = ${m.id}
          CROSS JOIN q
          CROSS JOIN LATERAL (SELECT ${vector} AS doc) v
          WHERE ${where ?? sql`true`} AND v.doc @@ q.query
          ORDER BY rank DESC, ${m.name}, ${m.id}
          LIMIT ${limit}
        )
        SELECT h.id, NULL::text AS kind, h.name AS title, NULL::text AS "occurredAt", h.status,
          h.rank::float8 AS rank, h.rank::text AS "rankText",
          ts_headline('english', CASE WHEN btrim(h.body_text) <> '' THEN h.body_text ELSE h.title_text END,
            q.query, ${HEADLINE_OPTIONS}) AS snippet
        FROM h CROSS JOIN q
        ORDER BY h.rank DESC, h.name, h.id`),
    "searchService:query",
  );
  return isError(res) ? res : res.rows.map((row) => toHit("medication", row));
};

// ---------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------

/**
 * Search one care group. An empty search (no words, or only exclusions)
 * matches nothing. Entries come best match first (then newest), keyset-paged
 * through `nextCursor`; providers and medications come best match first, up
 * to `limit` each, with the first page only.
 */
export const search = async (ctx: ServiceContext, options: SearchOptions) => {
  // Visible to the actor, or not found: a non-member learns nothing.
  const group = await careGroupModel.getById(options.groupId, ctx);
  if (isError(group)) return group;
  if (!group) return newError({ code: "searchService:notFound" });

  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  if (isError(cursor)) return cursor;

  // Null for an empty search: nothing to look for.
  const query = toTsQuery(parseSearch(options.q));
  if (!query) return { ...EMPTY };

  // Documents' text is matched in SQL, so fold in updates still waiting for
  // compaction first: a short typing session never reaches one (B-312).
  const compacted = await compactPending(options.groupId, { tx: ctx.tx });
  if (isError(compacted)) return compacted;

  const limit = Math.min(
    Math.max(Math.trunc(options.limit ?? SEARCH_DEFAULT_LIMIT) || 1, 1),
    SEARCH_MAX_LIMIT,
  );
  const scopes = new Set(options.scopes?.length ? options.scopes : SERVER_SEARCH_ITEM_TYPES);

  const result: SearchResult = { ...EMPTY };
  if (scopes.has("entry")) {
    const entries = await searchEntries(ctx, query, options, limit, cursor);
    if (isError(entries)) return entries;
    Object.assign(result, entries);
  }
  if (cursor) return result;
  if (scopes.has("provider")) {
    const providers = await searchProviders(ctx, query, options.groupId, limit);
    if (isError(providers)) return providers;
    result.providers = providers;
  }
  if (scopes.has("medication")) {
    const medications = await searchMedications(ctx, query, options.groupId, limit);
    if (isError(medications)) return medications;
    result.medications = medications;
  }
  return result;
};
