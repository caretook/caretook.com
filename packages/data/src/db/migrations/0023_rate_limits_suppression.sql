CREATE TABLE "rate_limit_hit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"hit_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "email_suppression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"reason" text NOT NULL,
	"event_id" text NOT NULL,
	"cleared_at" timestamp(3) with time zone,
	"cleared_by" uuid,
	"clear_reason" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "email_suppression_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "email_suppression_reason_check" CHECK ("email_suppression"."reason" IN ('bounce', 'complaint')),
	CONSTRAINT "email_suppression_address_check" CHECK ("email_suppression"."address" = lower(btrim("email_suppression"."address")))
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" DROP CONSTRAINT "notification_outbox_status_check";--> statement-breakpoint
CREATE INDEX "rate_limit_hit_key_hit_at_idx" ON "rate_limit_hit" USING btree ("key","hit_at");--> statement-breakpoint
CREATE INDEX "rate_limit_hit_hit_at_idx" ON "rate_limit_hit" USING btree ("hit_at");--> statement-breakpoint
CREATE INDEX "rate_limit_last_request_idx" ON "rate_limit" USING btree ("last_request");--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppression_active_address_idx" ON "email_suppression" USING btree ("address") WHERE "email_suppression"."cleared_at" IS NULL;--> statement-breakpoint
CREATE INDEX "email_suppression_created_at_idx" ON "email_suppression" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_provider_message_id_idx" ON "notification_outbox" USING btree ("provider_message_id");--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_status_check" CHECK ("notification_outbox"."status" IN ('pending', 'sending', 'sent', 'skipped', 'failed', 'bounced', 'complained'));