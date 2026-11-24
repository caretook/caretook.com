DROP INDEX "symptom_type_group_idx";--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD COLUMN "symptom_type_id" uuid;--> statement-breakpoint
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_symptom_type_fk" FOREIGN KEY ("group_id","symptom_type_id") REFERENCES "public"."symptom_type"("group_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timeline_entry_symptom_type_idx" ON "timeline_entry" USING btree ("group_id","symptom_type_id") WHERE "timeline_entry"."symptom_type_id" IS NOT NULL;