-- Repeating appointments and reminders (appointments-2, B-60). Two hand
-- edits to keep when regenerating: the timeline_entry_series_fk FK is ON
-- DELETE SET NULL ("series_id") (Drizzle 0.45 can't express a column-list
-- SET NULL; hard-deleting a series keeps its visits), and the ALTER
-- PUBLICATION at the end.
CREATE TABLE "appointment_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"rule" text NOT NULL,
	"starts_on" date NOT NULL,
	"start_time" text,
	"all_day" boolean DEFAULT false NOT NULL,
	"time_zone" text NOT NULL,
	"title" text,
	"duration_minutes" integer,
	"place" text,
	"provider_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topped_up_through" date,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "appointment_series_group_id_id_unique" UNIQUE("group_id","id"),
	CONSTRAINT "appointment_series_kind_check" CHECK ("appointment_series"."kind" IN ('event', 'note')),
	CONSTRAINT "appointment_series_time_check" CHECK (("appointment_series"."all_day") = ("appointment_series"."start_time" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "series_day" date;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "series_detached" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_series_fk" FOREIGN KEY ("group_id","series_id") REFERENCES "public"."appointment_series"("group_id","id") ON DELETE SET NULL ("series_id") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_entry_series_day_unique" ON "timeline_entry" USING btree ("series_id","series_day") WHERE "timeline_entry"."deleted_at" IS NULL AND "timeline_entry"."series_id" IS NOT NULL;--> statement-breakpoint
-- Hand-written (not generated): series sync to the group's members
-- (powersync/sync-config.yaml). timeline_entry is already published whole,
-- so its new columns need nothing here.
ALTER PUBLICATION "powersync" ADD TABLE "appointment_series";
