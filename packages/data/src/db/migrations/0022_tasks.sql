-- Tasks (B-55). Two hand edits to keep when regenerating: the task_event_fk
-- FK is ON DELETE SET NULL ("event_id") (Drizzle 0.45 can't express a
-- column-list SET NULL; deleting an event only clears the task's link), and
-- the ALTER PUBLICATION at the end.
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"assignee_id" uuid,
	"assignee_name" text,
	"due_on" date,
	"due_time" text,
	"done_at" timestamp(3) with time zone,
	"done_by" uuid,
	"provider_id" uuid,
	"medication_id" uuid,
	"event_id" uuid,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "task_group_id_id_unique" UNIQUE("group_id","id"),
	CONSTRAINT "task_assignee_check" CHECK ("task"."assignee_id" IS NULL OR "task"."assignee_name" IS NULL),
	CONSTRAINT "task_due_time_check" CHECK ("task"."due_time" IS NULL OR "task"."due_on" IS NOT NULL),
	CONSTRAINT "task_done_check" CHECK (("task"."done_at" IS NULL) = ("task"."done_by" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_subject_check";--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_owner_check";--> statement-breakpoint
ALTER TABLE "note_document" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_provider_fk" FOREIGN KEY ("group_id","provider_id") REFERENCES "public"."provider"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_medication_fk" FOREIGN KEY ("group_id","medication_id") REFERENCES "public"."medication"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_event_fk" FOREIGN KEY ("group_id","event_id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE SET NULL ("event_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_group_due_idx" ON "task" USING btree ("group_id","due_on");--> statement-breakpoint
CREATE INDEX "task_group_assignee_idx" ON "task" USING btree ("group_id","assignee_id");--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_task_fk" FOREIGN KEY ("group_id","task_id") REFERENCES "public"."task"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_subject_check" CHECK ("note_document"."subject" IN ('entry', 'provider', 'medication', 'carePeriod', 'task'));--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_owner_check" CHECK (("note_document"."subject" = 'entry' AND "note_document"."entry_id" = "note_document"."id" AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL AND "note_document"."task_id" IS NULL)
        OR ("note_document"."subject" = 'provider' AND "note_document"."provider_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL AND "note_document"."task_id" IS NULL)
        OR ("note_document"."subject" = 'medication' AND "note_document"."medication_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."care_period_id" IS NULL AND "note_document"."task_id" IS NULL)
        OR ("note_document"."subject" = 'carePeriod' AND "note_document"."care_period_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."task_id" IS NULL)
        OR ("note_document"."subject" = 'task' AND "note_document"."task_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL));--> statement-breakpoint
-- Hand-written (not generated): tasks sync to the group's members
-- (powersync/sync-config.yaml). note_document is already published whole,
-- so its new column needs nothing here.
ALTER PUBLICATION "powersync" ADD TABLE "task";
