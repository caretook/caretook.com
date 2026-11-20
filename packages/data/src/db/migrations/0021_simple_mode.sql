ALTER TABLE "care_group" ADD COLUMN "simple_tiles" jsonb;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "simple_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "simple_mode_locked" boolean DEFAULT false NOT NULL;