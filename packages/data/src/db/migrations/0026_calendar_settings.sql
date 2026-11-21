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
ALTER TABLE "care_group" ADD COLUMN "details_outside_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "member_calendar_setting" ADD CONSTRAINT "member_calendar_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_calendar_setting" ADD CONSTRAINT "member_calendar_setting_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_override" ADD CONSTRAINT "reminder_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_override" ADD CONSTRAINT "reminder_override_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_override" ADD CONSTRAINT "reminder_override_entry_fk" FOREIGN KEY ("group_id","entry_id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_calendar_setting_user_group_unique" ON "member_calendar_setting" USING btree ("user_id","group_id");--> statement-breakpoint
CREATE INDEX "member_calendar_setting_group_idx" ON "member_calendar_setting" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_calendar_setting_feed_unique" ON "member_calendar_setting" USING btree ("feed_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_override_user_entry_unique" ON "reminder_override" USING btree ("user_id","entry_id");--> statement-breakpoint
CREATE INDEX "reminder_override_group_user_idx" ON "reminder_override" USING btree ("group_id","user_id");