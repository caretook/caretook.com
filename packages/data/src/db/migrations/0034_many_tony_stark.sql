ALTER TABLE "care_group" ADD COLUMN "easy_tiles" jsonb;--> statement-breakpoint
UPDATE "care_group" SET "easy_tiles" = "simple_tiles" WHERE "simple_tiles" IS NOT NULL;--> statement-breakpoint
UPDATE "user" SET "preferences" = "preferences" || jsonb_build_object('easyMode', CASE WHEN "preferences" ->> 'simpleMode' = 'simple' THEN 'easy' ELSE "preferences" ->> 'simpleMode' END) WHERE "preferences" ->> 'simpleMode' IS NOT NULL;
