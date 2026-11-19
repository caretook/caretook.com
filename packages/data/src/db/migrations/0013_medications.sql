CREATE TABLE "medication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"strength" text,
	"form" text,
	"dose" text,
	"directions" text,
	"reason" text,
	"schedule" jsonb NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"started_on" date,
	"stopped_on" date,
	"stop_reason" text,
	"stop_note" text,
	"prescriber_id" uuid,
	"pharmacy_id" uuid,
	"last_filled_on" date,
	"quantity" text,
	"refills_left" integer,
	"rx_number" text,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "medication_group_id_id_unique" UNIQUE("group_id","id"),
	CONSTRAINT "medication_form_check" CHECK ("medication"."form" IN ('tablet', 'capsule', 'liquid', 'injection', 'patch', 'inhaler', 'drops', 'cream', 'other')),
	CONSTRAINT "medication_status_check" CHECK ("medication"."status" IN ('current', 'completed', 'discontinued')),
	CONSTRAINT "medication_stop_reason_check" CHECK ("medication"."stop_reason" IN ('sideEffects', 'ineffective', 'prescriberStopped', 'other'))
);
--> statement-breakpoint
ALTER TABLE "timeline_entry" DROP CONSTRAINT "timeline_entry_kind_check";--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_subject_check";--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_owner_check";--> statement-breakpoint
ALTER TABLE "care_recipient" ADD COLUMN "time_zone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "note_document" ADD COLUMN "medication_id" uuid;--> statement-breakpoint
ALTER TABLE "medication" ADD CONSTRAINT "medication_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication" ADD CONSTRAINT "medication_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication" ADD CONSTRAINT "medication_prescriber_fk" FOREIGN KEY ("group_id","prescriber_id") REFERENCES "public"."provider"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication" ADD CONSTRAINT "medication_pharmacy_fk" FOREIGN KEY ("group_id","pharmacy_id") REFERENCES "public"."provider"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medication_group_name_idx" ON "medication" USING btree ("group_id","name");--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_medication_fk" FOREIGN KEY ("group_id","medication_id") REFERENCES "public"."medication"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_kind_check" CHECK ("timeline_entry"."kind" IN ('note', 'symptom', 'event', 'vital', 'dose', 'medicationChange'));--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_subject_check" CHECK ("note_document"."subject" IN ('entry', 'provider', 'medication'));--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_owner_check" CHECK (("note_document"."subject" = 'entry' AND "note_document"."entry_id" = "note_document"."id" AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL)
        OR ("note_document"."subject" = 'provider' AND "note_document"."provider_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."medication_id" IS NULL)
        OR ("note_document"."subject" = 'medication' AND "note_document"."medication_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL));--> statement-breakpoint
-- Hand-written (not generated): medications sync to the group's members
-- (powersync/sync-config.yaml). care_recipient and note_document are already
-- published whole, so their new columns need nothing here.
ALTER PUBLICATION "powersync" ADD TABLE "medication";
