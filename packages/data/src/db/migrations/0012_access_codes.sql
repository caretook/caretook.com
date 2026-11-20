CREATE TABLE "access_code_redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "access_code_code_format" CHECK ("access_code"."code" ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
	CONSTRAINT "access_code_max_uses_check" CHECK ("access_code"."max_uses" IS NULL OR "access_code"."max_uses" > 0)
);
--> statement-breakpoint
ALTER TABLE "access_code_redemption" ADD CONSTRAINT "access_code_redemption_code_id_access_code_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."access_code"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_code_redemption" ADD CONSTRAINT "access_code_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_code_redemption" ADD CONSTRAINT "access_code_redemption_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_code_redemption_code_idx" ON "access_code_redemption" USING btree ("code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_code_code_unique" ON "access_code" USING btree ("code");