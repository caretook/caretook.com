CREATE TABLE "note_document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"snapshot" text,
	"text" text DEFAULT '' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "note_document_group_id_id_unique" UNIQUE("group_id","id")
);
--> statement-breakpoint
CREATE TABLE "note_update" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_group_id_id_unique" UNIQUE("group_id","id");--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_entry_fk" FOREIGN KEY ("group_id","id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_update" ADD CONSTRAINT "note_update_document_fk" FOREIGN KEY ("group_id","document_id") REFERENCES "public"."note_document"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_update_document_idx" ON "note_update" USING btree ("document_id","created_at");--> statement-breakpoint
-- Live documents sync to the group's members (powersync/sync-config.yaml).
ALTER PUBLICATION "powersync" ADD TABLE "note_document", "note_update";
