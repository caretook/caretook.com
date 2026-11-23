CREATE TABLE "legal_acceptance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"terms_version" text NOT NULL,
	"privacy_version" text NOT NULL,
	"health_data_privacy_version" text NOT NULL,
	"wording_version" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "legal_acceptance_source_check" CHECK ("legal_acceptance"."source" IN ('access_code', 'invite_signup', 'invite_accept'))
);
--> statement-breakpoint
ALTER TABLE "legal_acceptance" ADD CONSTRAINT "legal_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_acceptance_user_idx" ON "legal_acceptance" USING btree ("user_id");