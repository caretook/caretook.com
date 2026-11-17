ALTER TABLE "timeline_entry" DROP CONSTRAINT "timeline_entry_kind_check";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_kind_check" CHECK ("timeline_entry"."kind" IN ('note', 'symptom', 'event', 'vital'));