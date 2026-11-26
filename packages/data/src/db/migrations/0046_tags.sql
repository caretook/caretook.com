CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "tag_group_id_name_key_unique" UNIQUE("group_id","name_key"),
	CONSTRAINT "tag_group_id_id_unique" UNIQUE("group_id","id")
);
--> statement-breakpoint
CREATE TABLE "record_tag" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"entry_id" uuid,
	"todo_id" uuid,
	"provider_id" uuid,
	"medication_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "record_tag_tag_entry_unique" UNIQUE("tag_id","entry_id"),
	CONSTRAINT "record_tag_tag_todo_unique" UNIQUE("tag_id","todo_id"),
	CONSTRAINT "record_tag_tag_provider_unique" UNIQUE("tag_id","provider_id"),
	CONSTRAINT "record_tag_tag_medication_unique" UNIQUE("tag_id","medication_id"),
	CONSTRAINT "record_tag_one_target" CHECK (num_nonnulls("record_tag"."entry_id", "record_tag"."todo_id", "record_tag"."provider_id", "record_tag"."medication_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_tag_fk" FOREIGN KEY ("group_id","tag_id") REFERENCES "public"."tag"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_entry_fk" FOREIGN KEY ("group_id","entry_id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_todo_fk" FOREIGN KEY ("group_id","todo_id") REFERENCES "public"."todo"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_provider_fk" FOREIGN KEY ("group_id","provider_id") REFERENCES "public"."provider"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_medication_fk" FOREIGN KEY ("group_id","medication_id") REFERENCES "public"."medication"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_tag_entry_idx" ON "record_tag" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "record_tag_todo_idx" ON "record_tag" USING btree ("todo_id");--> statement-breakpoint
CREATE INDEX "record_tag_provider_idx" ON "record_tag" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "record_tag_medication_idx" ON "record_tag" USING btree ("medication_id");--> statement-breakpoint
-- Tags and their links sync to every member of their group
-- (powersync/sync-config.yaml; `pnpm db:roles` sets the column lists).
ALTER PUBLICATION "powersync" ADD TABLE "tag", "record_tag";
