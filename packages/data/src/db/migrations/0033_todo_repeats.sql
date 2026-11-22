ALTER TABLE "todo" ADD COLUMN "repeat_rule" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "repeat_starts_on" date;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "repeat_id" uuid;--> statement-breakpoint
CREATE INDEX "todo_group_repeat_idx" ON "todo" USING btree ("group_id","repeat_id");--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_repeat_check" CHECK (("todo"."repeat_rule" IS NULL) = ("todo"."repeat_starts_on" IS NULL) AND ("todo"."repeat_rule" IS NULL) = ("todo"."repeat_id" IS NULL));--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_repeat_due_check" CHECK ("todo"."repeat_rule" IS NULL OR "todo"."due_on" IS NOT NULL);