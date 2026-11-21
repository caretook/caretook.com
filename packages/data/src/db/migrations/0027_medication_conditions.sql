CREATE TABLE "medication_condition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"medication_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "medication_condition_medication_condition_unique" UNIQUE("medication_id","condition_id")
);
--> statement-breakpoint
ALTER TABLE "medication_condition" ADD CONSTRAINT "medication_condition_medication_fk" FOREIGN KEY ("group_id","medication_id") REFERENCES "public"."medication"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_condition" ADD CONSTRAINT "medication_condition_condition_fk" FOREIGN KEY ("group_id","condition_id") REFERENCES "public"."recipient_condition"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medication_condition_group_idx" ON "medication_condition" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "medication_condition_condition_idx" ON "medication_condition" USING btree ("condition_id");--> statement-breakpoint
-- Hand-written (not generated): a medication's conditions sync to the
-- group's members (powersync/sync-config.yaml; `pnpm db:roles` sets the
-- column lists).
ALTER PUBLICATION "powersync" ADD TABLE "medication_condition";
