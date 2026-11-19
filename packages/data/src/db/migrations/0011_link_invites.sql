CREATE TABLE "care_group_join_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invite_id" uuid,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "care_group_join_request_role_check" CHECK ("care_group_join_request"."role" IN ('caretaker', 'viewer')),
	CONSTRAINT "care_group_join_request_status_check" CHECK ("care_group_join_request"."status" IN ('pending', 'approved', 'declined', 'withdrawn'))
);
--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD COLUMN "token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "care_group_join_request" ADD CONSTRAINT "care_group_join_request_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_join_request" ADD CONSTRAINT "care_group_join_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_join_request" ADD CONSTRAINT "care_group_join_request_invite_id_care_group_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."care_group_invite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_join_request" ADD CONSTRAINT "care_group_join_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_group_join_request_pending_unique" ON "care_group_join_request" USING btree ("group_id","user_id") WHERE "care_group_join_request"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "care_group_join_request_user_idx" ON "care_group_join_request" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_link_role_check" CHECK ("care_group_invite"."kind" <> 'link' OR "care_group_invite"."role" IN ('caretaker', 'viewer'));