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
ALTER TABLE "calendar_sync_job" ADD CONSTRAINT "calendar_sync_job_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD CONSTRAINT "calendar_sync_job_connection_id_google_calendar_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."google_calendar_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connection" ADD CONSTRAINT "google_calendar_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connection" ADD CONSTRAINT "google_calendar_connection_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_event_link" ADD CONSTRAINT "google_event_link_connection_id_google_calendar_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."google_calendar_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_oauth_state" ADD CONSTRAINT "google_oauth_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_oauth_state" ADD CONSTRAINT "google_oauth_state_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_job_group_waiting_unique" ON "calendar_sync_job" USING btree ("group_id") WHERE "calendar_sync_job"."claimed_at" IS NULL AND "calendar_sync_job"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_job_connection_waiting_unique" ON "calendar_sync_job" USING btree ("connection_id") WHERE "calendar_sync_job"."claimed_at" IS NULL AND "calendar_sync_job"."connection_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "calendar_sync_job_due_idx" ON "calendar_sync_job" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connection_live_unique" ON "google_calendar_connection" USING btree ("user_id","group_id") WHERE "google_calendar_connection"."disconnected_at" IS NULL;--> statement-breakpoint
CREATE INDEX "google_calendar_connection_group_idx" ON "google_calendar_connection" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "google_event_link_connection_item_unique" ON "google_event_link" USING btree ("connection_id","item_uid");--> statement-breakpoint
CREATE INDEX "google_oauth_state_expires_idx" ON "google_oauth_state" USING btree ("expires_at");