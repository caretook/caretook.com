CREATE TABLE "timeline_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp(3) with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"title" text,
	"body" text,
	"details" jsonb,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "timeline_entry_kind_check" CHECK ("timeline_entry"."kind" IN ('note', 'symptom', 'event'))
);
--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_recipient" ADD CONSTRAINT "care_recipient_group_id_id_unique" UNIQUE("group_id","id");--> statement-breakpoint
-- Moved above the FK that references it (drizzle-kit emits it last).
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timeline_entry_group_occurred_idx" ON "timeline_entry" USING btree ("group_id","occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);
