CREATE TABLE "care_group_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text DEFAULT 'joiner' NOT NULL,
	"consent_version" text NOT NULL,
	"invite_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "care_group_consent_kind_check" CHECK ("care_group_consent"."kind" IN ('joiner'))
);
--> statement-breakpoint
ALTER TABLE "care_group_invite" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD COLUMN "kind" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD COLUMN "max_uses" integer;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD COLUMN "use_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD COLUMN "consent_attested_by" uuid;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD COLUMN "consent_attested_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "care_group_consent" ADD CONSTRAINT "care_group_consent_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_consent" ADD CONSTRAINT "care_group_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_consent" ADD CONSTRAINT "care_group_consent_invite_id_care_group_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."care_group_invite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_group_consent_group_idx" ON "care_group_consent" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "care_group_consent_user_idx" ON "care_group_consent" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "care_group_member" ADD CONSTRAINT "care_group_member_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_consent_attested_by_user_id_fk" FOREIGN KEY ("consent_attested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_kind_check" CHECK ("care_group_invite"."kind" IN ('email', 'link'));--> statement-breakpoint
-- Invites made before attestation existed count as attested when they were made.
UPDATE "care_group_invite" SET "consent_attested_at" = "created_at" WHERE "kind" = 'email' AND "consent_attested_at" IS NULL;--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_email_check" CHECK ("care_group_invite"."kind" <> 'email' OR ("care_group_invite"."email" IS NOT NULL AND "care_group_invite"."consent_attested_at" IS NOT NULL));