ALTER TABLE "care_group_invite" DROP CONSTRAINT "care_group_invite_role_check";--> statement-breakpoint
ALTER TABLE "care_group_invite" DROP CONSTRAINT "care_group_invite_link_role_check";--> statement-breakpoint
ALTER TABLE "care_group_join_request" DROP CONSTRAINT "care_group_join_request_role_check";--> statement-breakpoint
ALTER TABLE "care_group_member" DROP CONSTRAINT "care_group_member_role_check";--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_role_check" CHECK ("care_group_invite"."role" IN ('owner', 'admin', 'caretaker', 'viewer', 'easy_helper', 'easy_viewer'));--> statement-breakpoint
ALTER TABLE "care_group_invite" ADD CONSTRAINT "care_group_invite_link_role_check" CHECK ("care_group_invite"."kind" <> 'link' OR "care_group_invite"."role" IN ('caretaker', 'viewer', 'easy_helper', 'easy_viewer'));--> statement-breakpoint
ALTER TABLE "care_group_join_request" ADD CONSTRAINT "care_group_join_request_role_check" CHECK ("care_group_join_request"."role" IN ('caretaker', 'viewer', 'easy_helper', 'easy_viewer'));--> statement-breakpoint
ALTER TABLE "care_group_member" ADD CONSTRAINT "care_group_member_role_check" CHECK ("care_group_member"."role" IN ('owner', 'admin', 'caretaker', 'viewer', 'easy_helper', 'easy_viewer'));