CREATE TABLE "care_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text,
	"place_provider_id" uuid,
	"place_detail" text,
	"started_at" timestamp(3) with time zone NOT NULL,
	"date_only" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "care_period_group_id_id_unique" UNIQUE("group_id","id"),
	CONSTRAINT "care_period_type_check" CHECK ("care_period"."type" IN ('home', 'emergency', 'hospital', 'rehab', 'assistedLiving', 'memoryCare', 'nursingHome', 'hospiceHome', 'hospiceFacility', 'other'))
);
--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_subject_check";--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_owner_check";--> statement-breakpoint
ALTER TABLE "note_document" ADD COLUMN "care_period_id" uuid;--> statement-breakpoint
ALTER TABLE "care_period" ADD CONSTRAINT "care_period_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_period" ADD CONSTRAINT "care_period_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_period" ADD CONSTRAINT "care_period_place_fk" FOREIGN KEY ("group_id","place_provider_id") REFERENCES "public"."provider"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_period_group_started_idx" ON "care_period" USING btree ("group_id","started_at");--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_care_period_fk" FOREIGN KEY ("group_id","care_period_id") REFERENCES "public"."care_period"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_subject_check" CHECK ("note_document"."subject" IN ('entry', 'provider', 'medication', 'carePeriod'));--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_owner_check" CHECK (("note_document"."subject" = 'entry' AND "note_document"."entry_id" = "note_document"."id" AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL)
        OR ("note_document"."subject" = 'provider' AND "note_document"."provider_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL)
        OR ("note_document"."subject" = 'medication' AND "note_document"."medication_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."care_period_id" IS NULL)
        OR ("note_document"."subject" = 'carePeriod' AND "note_document"."care_period_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL));--> statement-breakpoint
-- Hand-written (not generated): care periods sync to the group's members
-- (powersync/sync-config.yaml). note_document is already published whole,
-- so its new column needs nothing here.
ALTER PUBLICATION "powersync" ADD TABLE "care_period";
