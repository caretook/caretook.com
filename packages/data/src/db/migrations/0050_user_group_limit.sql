ALTER TABLE "user" ADD COLUMN "group_limit" integer;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_group_limit_check" CHECK ("user"."group_limit" BETWEEN 1 AND 1000);