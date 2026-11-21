CREATE TABLE "recipient_condition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"since_year" integer,
	"since_month" integer,
	"note" text,
	"diagnosed_by_id" uuid,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "recipient_condition_group_id_id_unique" UNIQUE("group_id","id"),
	CONSTRAINT "recipient_condition_status_check" CHECK ("recipient_condition"."status" IN ('active', 'resolved')),
	CONSTRAINT "recipient_condition_since_year_check" CHECK ("recipient_condition"."since_year" IS NULL OR "recipient_condition"."since_year" BETWEEN 1900 AND 2100),
	CONSTRAINT "recipient_condition_since_month_check" CHECK ("recipient_condition"."since_month" IS NULL OR ("recipient_condition"."since_year" IS NOT NULL AND "recipient_condition"."since_month" BETWEEN 1 AND 12))
);
--> statement-breakpoint
ALTER TABLE "care_recipient" ADD COLUMN "no_known_conditions_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "recipient_condition" ADD CONSTRAINT "recipient_condition_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_condition" ADD CONSTRAINT "recipient_condition_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_condition" ADD CONSTRAINT "recipient_condition_diagnosed_by_fk" FOREIGN KEY ("group_id","diagnosed_by_id") REFERENCES "public"."provider"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipient_condition_group_idx" ON "recipient_condition" USING btree ("group_id");--> statement-breakpoint
-- Hand-written (not generated): conditions sync to the group's members
-- (powersync/sync-config.yaml). care_recipient is already published, so its
-- new column needs nothing here (`pnpm db:roles` sets the column lists).
ALTER PUBLICATION "powersync" ADD TABLE "recipient_condition";
