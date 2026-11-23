CREATE TABLE "dose_duplicate_upload" (
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dose_duplicate_upload_entry_id_user_id_occurred_at_pk" PRIMARY KEY("entry_id","user_id","occurred_at")
);
--> statement-breakpoint
ALTER TABLE "dose_duplicate_upload" ADD CONSTRAINT "dose_duplicate_upload_entry_id_timeline_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."timeline_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dose_duplicate_upload" ADD CONSTRAINT "dose_duplicate_upload_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dose_duplicate_upload_user_id_idx" ON "dose_duplicate_upload" USING btree ("user_id");