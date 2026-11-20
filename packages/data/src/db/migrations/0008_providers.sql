CREATE TABLE "provider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"specialty" text,
	"practice_id" uuid,
	"phones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email" text,
	"address" text,
	"website" text,
	"status" text DEFAULT 'current' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "provider_group_id_id_unique" UNIQUE("group_id","id"),
	CONSTRAINT "provider_type_check" CHECK ("provider"."type" IN ('clinician', 'practice', 'pharmacy', 'other')),
	CONSTRAINT "provider_status_check" CHECK ("provider"."status" IN ('current', 'past'))
);
--> statement-breakpoint
CREATE TABLE "timeline_entry_provider" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "timeline_entry_provider_entry_provider_unique" UNIQUE("entry_id","provider_id")
);
--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_entry_fk";
--> statement-breakpoint
ALTER TABLE "note_document" ADD COLUMN "subject" text DEFAULT 'entry' NOT NULL;--> statement-breakpoint
ALTER TABLE "note_document" ADD COLUMN "entry_id" uuid;--> statement-breakpoint
ALTER TABLE "note_document" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
-- Every existing document is an entry's (its id is the entry's), so the owner check holds.
UPDATE "note_document" SET "entry_id" = "id";--> statement-breakpoint
ALTER TABLE "provider" ADD CONSTRAINT "provider_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider" ADD CONSTRAINT "provider_practice_fk" FOREIGN KEY ("group_id","practice_id") REFERENCES "public"."provider"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entry_provider" ADD CONSTRAINT "timeline_entry_provider_entry_fk" FOREIGN KEY ("group_id","entry_id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entry_provider" ADD CONSTRAINT "timeline_entry_provider_provider_fk" FOREIGN KEY ("group_id","provider_id") REFERENCES "public"."provider"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_group_name_idx" ON "provider" USING btree ("group_id","name");--> statement-breakpoint
CREATE INDEX "timeline_entry_provider_provider_idx" ON "timeline_entry_provider" USING btree ("provider_id");--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_provider_fk" FOREIGN KEY ("group_id","provider_id") REFERENCES "public"."provider"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_entry_fk" FOREIGN KEY ("group_id","entry_id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_subject_check" CHECK ("note_document"."subject" IN ('entry', 'provider'));--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_owner_check" CHECK (("note_document"."subject" = 'entry' AND "note_document"."entry_id" = "note_document"."id" AND "note_document"."provider_id" IS NULL)
        OR ("note_document"."subject" = 'provider' AND "note_document"."provider_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL));--> statement-breakpoint
-- Providers and their links sync to the group's members (powersync/sync-config.yaml).
ALTER PUBLICATION "powersync" ADD TABLE "provider", "timeline_entry_provider";
