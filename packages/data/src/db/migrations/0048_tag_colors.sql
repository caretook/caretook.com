ALTER TABLE "tag" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_color_check" CHECK ("tag"."color" IN ('coral', 'ochre', 'moss', 'fern', 'jade', 'sky', 'blue', 'violet', 'orchid', 'rose'));--> statement-breakpoint
-- Hand-written from here (not generated; keep when regenerating).
--
-- The backfill (tags-2): every tag with no color yet takes one, per group in
-- creation order, cycling through the palette (TAG_COLORS, the avatar
-- colors, in their order), so a group's first ten colorless tags are all
-- different. A tag that has a color keeps it.
UPDATE "tag" AS t
SET "color" = (ARRAY['coral', 'ochre', 'moss', 'fern', 'jade', 'sky', 'blue', 'violet', 'orchid', 'rose'])[((n."rank" - 1) % 10) + 1]
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "group_id" ORDER BY "created_at", "id") AS "rank"
  FROM "tag"
  WHERE "color" IS NULL
) AS n
WHERE t."id" = n."id" AND t."color" IS NULL;
