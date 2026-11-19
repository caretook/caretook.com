CREATE TABLE "medication_pass" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"time" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "medication_pass_group_id_id_unique" UNIQUE("group_id","id")
);
--> statement-breakpoint
CREATE TABLE "recipient_allergy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"substance" text NOT NULL,
	"reaction" text,
	"severity" text DEFAULT 'unknown' NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "recipient_allergy_group_id_id_unique" UNIQUE("group_id","id"),
	CONSTRAINT "recipient_allergy_severity_check" CHECK ("recipient_allergy"."severity" IN ('mild', 'moderate', 'severe', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "care_recipient" ADD COLUMN "no_known_allergies_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "medication_pass" ADD CONSTRAINT "medication_pass_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_pass" ADD CONSTRAINT "medication_pass_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_allergy" ADD CONSTRAINT "recipient_allergy_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_allergy" ADD CONSTRAINT "recipient_allergy_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "medication_pass_group_name_live_unique" ON "medication_pass" USING btree ("group_id",lower("name")) WHERE "medication_pass"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "recipient_allergy_group_idx" ON "recipient_allergy" USING btree ("group_id");--> statement-breakpoint
-- Hand-written (not generated): passes and allergies sync to the group's
-- members (powersync/sync-config.yaml). care_recipient is already published
-- whole, so its new column needs nothing here.
ALTER PUBLICATION "powersync" ADD TABLE "medication_pass", "recipient_allergy";
