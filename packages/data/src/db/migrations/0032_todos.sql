-- Tasks become todos (tasks-2, B-222), in one step: an agreed exception to
-- "migrations stay additive" (production isn't live). Hand-edited from the
-- generated SQL, which dropped and re-added every constraint and index under
-- its new name: renaming keeps them as they are, so todo_event_fk keeps
-- 0022's ON DELETE SET NULL ("event_id"), and the renamed table stays in the
-- powersync publication (membership follows the table, not its name). The
-- stored values that name the old word are rewritten between dropping and
-- re-adding their checks: the notes subject, the calendar job reason, and
-- every calendar uid `task:<id>` (Google links, so events update in place,
-- and reminder sends' idempotency keys, so none goes out twice).
ALTER TABLE "task" RENAME TO "todo";--> statement-breakpoint
ALTER TABLE "note_document" RENAME COLUMN "task_id" TO "todo_id";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_pkey" TO "todo_pkey";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_group_id_id_unique" TO "todo_group_id_id_unique";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_assignee_check" TO "todo_assignee_check";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_due_time_check" TO "todo_due_time_check";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_done_check" TO "todo_done_check";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_group_id_care_group_id_fk" TO "todo_group_id_care_group_id_fk";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_assignee_id_user_id_fk" TO "todo_assignee_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_recipient_fk" TO "todo_recipient_fk";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_provider_fk" TO "todo_provider_fk";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_medication_fk" TO "todo_medication_fk";--> statement-breakpoint
ALTER TABLE "todo" RENAME CONSTRAINT "task_event_fk" TO "todo_event_fk";--> statement-breakpoint
ALTER INDEX "task_group_due_idx" RENAME TO "todo_group_due_idx";--> statement-breakpoint
ALTER INDEX "task_group_assignee_idx" RENAME TO "todo_group_assignee_idx";--> statement-breakpoint
ALTER TABLE "note_document" RENAME CONSTRAINT "note_document_task_fk" TO "note_document_todo_fk";--> statement-breakpoint
-- Postgres 18 names its NOT NULL constraints too (task_title_not_null, …);
-- older servers have none, so this renames whatever is left.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = '"todo"'::regclass AND conname LIKE 'task\_%' LOOP
    EXECUTE format('ALTER TABLE "todo" RENAME CONSTRAINT %I TO %I', c.conname, 'todo' || substr(c.conname, 5));
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" DROP CONSTRAINT "calendar_sync_job_reason_check";--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_subject_check";--> statement-breakpoint
ALTER TABLE "note_document" DROP CONSTRAINT "note_document_owner_check";--> statement-breakpoint
UPDATE "note_document" SET "subject" = 'todo' WHERE "subject" = 'task';--> statement-breakpoint
UPDATE "calendar_sync_job" SET "reason" = 'todo' WHERE "reason" = 'task';--> statement-breakpoint
UPDATE "google_event_link" SET "item_uid" = 'todo:' || substr("item_uid", 6) WHERE "item_uid" LIKE 'task:%';--> statement-breakpoint
-- A reminder's key is reminder:<user>:<group>:<item uid>:<lead>:<start>.
UPDATE "notification_outbox" SET "idempotency_key" = regexp_replace("idempotency_key", '^(reminder:[^:]+:[^:]+:)task:', '\1todo:') WHERE "idempotency_key" LIKE 'reminder:%:task:%';--> statement-breakpoint
UPDATE "notification_outbox" SET "name" = 'todoDue' WHERE "name" = 'taskDue';--> statement-breakpoint
UPDATE "dev_mail" SET "name" = 'todoDue' WHERE "name" = 'taskDue';--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD CONSTRAINT "calendar_sync_job_reason_check" CHECK ("calendar_sync_job"."reason" IN ('entry', 'todo', 'series', 'consent', 'connect', 'daily'));--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_subject_check" CHECK ("note_document"."subject" IN ('entry', 'provider', 'medication', 'carePeriod', 'todo'));--> statement-breakpoint
ALTER TABLE "note_document" ADD CONSTRAINT "note_document_owner_check" CHECK (("note_document"."subject" = 'entry' AND "note_document"."entry_id" = "note_document"."id" AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL AND "note_document"."todo_id" IS NULL)
        OR ("note_document"."subject" = 'provider' AND "note_document"."provider_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL AND "note_document"."todo_id" IS NULL)
        OR ("note_document"."subject" = 'medication' AND "note_document"."medication_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."care_period_id" IS NULL AND "note_document"."todo_id" IS NULL)
        OR ("note_document"."subject" = 'carePeriod' AND "note_document"."care_period_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."todo_id" IS NULL)
        OR ("note_document"."subject" = 'todo' AND "note_document"."todo_id" = "note_document"."id" AND "note_document"."entry_id" IS NULL AND "note_document"."provider_id" IS NULL AND "note_document"."medication_id" IS NULL AND "note_document"."care_period_id" IS NULL));
