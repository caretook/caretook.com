CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_user_id" uuid,
	"target_group_id" uuid,
	"reason" text,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_log_reason_length" CHECK (char_length("admin_audit_log"."reason") <= 500)
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_role_check";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "disabled_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "disabled_by" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "disabled_reason" text;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_group_id_care_group_id_fk" FOREIGN KEY ("target_group_id") REFERENCES "public"."care_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_idx" ON "admin_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_user_idx" ON "admin_audit_log" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_group_idx" ON "admin_audit_log" USING btree ("target_group_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("user"."role" IN ('admin', 'support', 'member'));