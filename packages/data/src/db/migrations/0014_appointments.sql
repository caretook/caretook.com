-- Appointments and reminders: a future event or note (no new kind). The
-- rescheduled_to FK is edited by hand to SET NULL (rescheduled_to): deleting the
-- new event clears the link, never the group_id. Keep that when regenerating.
ALTER TABLE "timeline_entry" ADD COLUMN "ends_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "cancelled_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "rescheduled_to" uuid;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_rescheduled_to_fk" FOREIGN KEY ("group_id","rescheduled_to") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE SET NULL ("rescheduled_to") ON UPDATE no action;
