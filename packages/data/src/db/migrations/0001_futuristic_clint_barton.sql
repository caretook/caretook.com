CREATE TABLE "care_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_group_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "care_group_member_group_user_unique" UNIQUE("group_id","user_id"),
	CONSTRAINT "care_group_member_role_check" CHECK ("care_group_member"."role" IN ('owner', 'admin', 'caretaker', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "care_recipient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"preferred_name" text,
	"date_of_birth" date,
	"notes" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "care_recipient_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "care_group_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"accepted_by" uuid,
	"responded_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "care_group_invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "care_group_invite_role_check" CHECK ("care_group_invite"."role" IN ('owner', 'admin', 'caretaker', 'viewer')),
	CONSTRAINT "care_group_invite_status_check" CHECK ("care_group_invite"."status" IN ('pending', 'accepted', 'declined', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "care_group_member" ADD CONSTRAINT "care_group_member_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD CONSTRAINT "care_group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_recipient" ADD CONSTRAINT "care_recipient_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_group_member_user_idx" ON "care_group_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "care_group_invite_pending_unique" ON "care_group_invite" USING btree ("group_id","email") WHERE "care_group_invite"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "care_group_invite_email_idx" ON "care_group_invite" USING btree ("email");