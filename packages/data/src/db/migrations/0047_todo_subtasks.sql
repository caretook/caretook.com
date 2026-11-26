ALTER TABLE "todo" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_parent_fk" FOREIGN KEY ("group_id","parent_id") REFERENCES "public"."todo"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_group_parent_idx" ON "todo" USING btree ("group_id","parent_id");