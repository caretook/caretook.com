CREATE TABLE "assistant_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"requested_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_request" ADD CONSTRAINT "assistant_request_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_request" ADD CONSTRAINT "assistant_request_member_fk" FOREIGN KEY ("group_id","user_id") REFERENCES "public"."care_group_member"("group_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_request_group_user_idx" ON "assistant_request" USING btree ("group_id","user_id","requested_at");