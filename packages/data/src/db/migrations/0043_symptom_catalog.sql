CREATE TABLE "symptom_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "symptom_type_group_id_name_key_unique" UNIQUE("group_id","name_key"),
	CONSTRAINT "symptom_type_group_id_id_unique" UNIQUE("group_id","id")
);
--> statement-breakpoint
ALTER TABLE "symptom_type" ADD CONSTRAINT "symptom_type_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "symptom_type_group_idx" ON "symptom_type" USING btree ("group_id");--> statement-breakpoint
-- Hand-written (not generated): the catalog syncs to every member of its
-- group (powersync/sync-config.yaml; `pnpm db:roles` sets the column lists).
ALTER PUBLICATION "powersync" ADD TABLE "symptom_type";
