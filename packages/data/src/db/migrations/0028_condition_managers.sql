CREATE TABLE "condition_manager" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "condition_manager_condition_provider_unique" UNIQUE("condition_id","provider_id")
);
--> statement-breakpoint
ALTER TABLE "condition_manager" ADD CONSTRAINT "condition_manager_condition_fk" FOREIGN KEY ("group_id","condition_id") REFERENCES "public"."recipient_condition"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_manager" ADD CONSTRAINT "condition_manager_provider_fk" FOREIGN KEY ("group_id","provider_id") REFERENCES "public"."provider"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "condition_manager_group_idx" ON "condition_manager" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "condition_manager_provider_idx" ON "condition_manager" USING btree ("provider_id");--> statement-breakpoint
-- Hand-written (not generated): who manages a condition syncs to the
-- group's members (powersync/sync-config.yaml; `pnpm db:roles` sets the
-- column lists).
ALTER PUBLICATION "powersync" ADD TABLE "condition_manager";
