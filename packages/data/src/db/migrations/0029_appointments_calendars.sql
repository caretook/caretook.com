-- appointments-2 (B-60 to B-63): repeating series, calendar settings and
-- Google Calendar, regenerated as one migration on top of conditions' 0025-0028.
-- Two hand edits to keep when regenerating: the timeline_entry_series_fk FK is
-- ON DELETE SET NULL ("series_id") (Drizzle 0.45 can't express a column-list
-- SET NULL; hard-deleting a series keeps its visits), and the ALTER
-- PUBLICATION at the end (series sync to the group's members through
-- powersync/sync-config.yaml; timeline_entry is already published whole).
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
CREATE TABLE "member_calendar_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"details_consent_at" timestamp(3) with time zone,
	"details_consent_version" text,
	"reminders_on" boolean DEFAULT false NOT NULL,
	"reminder_leads" jsonb DEFAULT '["eveningBefore",60]'::jsonb NOT NULL,
	"feed_token_hash" text,
	"feed_rotated_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"leads" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "reminder_override_mode_check" CHECK ("reminder_override"."mode" IN ('mute', 'extra'))
);
--> statement-breakpoint
CREATE TABLE "calendar_sync_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"connection_id" uuid,
	"reason" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp(3) with time zone,
	"last_error" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "calendar_sync_job_reason_check" CHECK ("calendar_sync_job"."reason" IN ('entry', 'task', 'series', 'consent', 'connect', 'daily')),
	CONSTRAINT "calendar_sync_job_target_check" CHECK (num_nonnulls("calendar_sync_job"."group_id", "calendar_sync_job"."connection_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "google_calendar_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"calendar_id" text NOT NULL,
	"calendar_name" text NOT NULL,
	"refresh_token_sealed" text,
	"sync_token" text,
	"last_pushed_at" timestamp(3) with time zone,
	"last_pulled_at" timestamp(3) with time zone,
	"last_error" text,
	"last_error_at" timestamp(3) with time zone,
	"disconnected_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "google_calendar_connection_last_error_check" CHECK ("google_calendar_connection"."last_error" IN ('revoked', 'calendarGone'))
);
--> statement-breakpoint
CREATE TABLE "google_event_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"item_uid" text NOT NULL,
	"google_event_id" text NOT NULL,
	"etag" text,
	"pushed_hash" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_oauth_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"state_hash" text NOT NULL,
	"code_verifier_sealed" text NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "google_oauth_state_state_hash_unique" UNIQUE("state_hash")
);
--> statement-breakpoint
ALTER TABLE "care_group" ADD COLUMN "details_outside_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "series_day" date;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "series_detached" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_calendar_setting" ADD CONSTRAINT "member_calendar_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_calendar_setting" ADD CONSTRAINT "member_calendar_setting_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_override" ADD CONSTRAINT "reminder_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_override" ADD CONSTRAINT "reminder_override_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_override" ADD CONSTRAINT "reminder_override_entry_fk" FOREIGN KEY ("group_id","entry_id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD CONSTRAINT "calendar_sync_job_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD CONSTRAINT "calendar_sync_job_connection_id_google_calendar_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."google_calendar_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connection" ADD CONSTRAINT "google_calendar_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connection" ADD CONSTRAINT "google_calendar_connection_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_event_link" ADD CONSTRAINT "google_event_link_connection_id_google_calendar_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."google_calendar_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_oauth_state" ADD CONSTRAINT "google_oauth_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_oauth_state" ADD CONSTRAINT "google_oauth_state_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_calendar_setting_user_group_unique" ON "member_calendar_setting" USING btree ("user_id","group_id");--> statement-breakpoint
CREATE INDEX "member_calendar_setting_group_idx" ON "member_calendar_setting" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_calendar_setting_feed_unique" ON "member_calendar_setting" USING btree ("feed_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_override_user_entry_unique" ON "reminder_override" USING btree ("user_id","entry_id");--> statement-breakpoint
CREATE INDEX "reminder_override_group_user_idx" ON "reminder_override" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_job_group_waiting_unique" ON "calendar_sync_job" USING btree ("group_id") WHERE "calendar_sync_job"."claimed_at" IS NULL AND "calendar_sync_job"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_job_connection_waiting_unique" ON "calendar_sync_job" USING btree ("connection_id") WHERE "calendar_sync_job"."claimed_at" IS NULL AND "calendar_sync_job"."connection_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "calendar_sync_job_due_idx" ON "calendar_sync_job" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connection_live_unique" ON "google_calendar_connection" USING btree ("user_id","group_id") WHERE "google_calendar_connection"."disconnected_at" IS NULL;--> statement-breakpoint
CREATE INDEX "google_calendar_connection_group_idx" ON "google_calendar_connection" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "google_event_link_connection_item_unique" ON "google_event_link" USING btree ("connection_id","item_uid");--> statement-breakpoint
CREATE INDEX "google_oauth_state_expires_idx" ON "google_oauth_state" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_series_fk" FOREIGN KEY ("group_id","series_id") REFERENCES "public"."appointment_series"("group_id","id") ON DELETE SET NULL ("series_id") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_entry_series_day_unique" ON "timeline_entry" USING btree ("series_id","series_day") WHERE "timeline_entry"."deleted_at" IS NULL AND "timeline_entry"."series_id" IS NOT NULL;
--> statement-breakpoint
ALTER PUBLICATION "powersync" ADD TABLE "appointment_series";
