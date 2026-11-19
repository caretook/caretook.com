-- Server search (searchService). Hand-written: drizzle's schema doesn't
-- declare any of this, so models never select the search columns and the API
-- never returns them. Keep the column expressions in step with
-- `searchDocument.ts` and `searchService.ts`.

-- Accents folded, as the device's FTS5 `remove_diacritics` does. `unaccent`
-- is a trusted extension, so the database owner can create it.
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
-- `unaccent(text)` is only STABLE (it looks its dictionary up through the
-- search path), so it can't go in a generated column or an index. This
-- wrapper names the schema and the dictionary, which makes IMMUTABLE true.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
--> statement-breakpoint
-- An entry's own searchable text, parsed once on write: building it at query
-- time took about 250 ms for 10,000 entries, against a 200 ms budget. Title-
-- like text (the title, a symptom's name) is weight A; body-like text (the
-- body, a dose's note, a change's stop note, the place) is B. What lives in
-- other tables (document text, author, medication, linked providers, vital
-- labels) is joined in at query time. Generated columns aren't replicated
-- (`publish_generated_columns` defaults to none), so PowerSync never sees it.
ALTER TABLE "timeline_entry" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, immutable_unaccent(
    coalesce("title", '') || E'\n' ||
    coalesce(CASE WHEN "kind" = 'symptom' THEN "details"->>'name' END, '')
  )), 'A') ||
  setweight(to_tsvector('english'::regconfig, immutable_unaccent(
    coalesce("body", '') || E'\n' ||
    coalesce("details"->>'note', '') || E'\n' ||
    coalesce("details"->>'stopNote', '') || E'\n' ||
    coalesce("place", '')
  )), 'B')
) STORED;
--> statement-breakpoint
-- A live document's compacted text (an entry's, a provider's or a
-- medication's notes): body-like, weight B.
ALTER TABLE "note_document" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, immutable_unaccent(coalesce("text", ''))), 'B')
) STORED;
