CREATE TABLE "care_recipient_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"phones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email" text,
	"address" text,
	"insurance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outside_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "care_recipient_details_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "user_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_email" text,
	"address" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "user_contact_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "member_contact_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"phones" jsonb,
	"email" text,
	"address" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "member_contact_share_group_user_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "relationship" text;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "shared_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "emergency_rank" integer;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "is_primary_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "care_group_member" ADD COLUMN "emergency_dropped_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "care_recipient" ADD COLUMN "code_status" text;--> statement-breakpoint
ALTER TABLE "care_recipient" ADD COLUMN "blood_type" text;--> statement-breakpoint
ALTER TABLE "care_recipient" ADD COLUMN "primary_language" text;--> statement-breakpoint
ALTER TABLE "care_recipient" ADD COLUMN "pronouns" text;--> statement-breakpoint
ALTER TABLE "care_recipient_details" ADD CONSTRAINT "care_recipient_details_group_id_care_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."care_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_recipient_details" ADD CONSTRAINT "care_recipient_details_recipient_fk" FOREIGN KEY ("group_id","recipient_id") REFERENCES "public"."care_recipient"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contact" ADD CONSTRAINT "user_contact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_contact_share" ADD CONSTRAINT "member_contact_share_member_fk" FOREIGN KEY ("group_id","user_id") REFERENCES "public"."care_group_member"("group_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_group_member_primary_contact_unique" ON "care_group_member" USING btree ("group_id") WHERE "care_group_member"."is_primary_contact";--> statement-breakpoint
ALTER TABLE "care_recipient" ADD CONSTRAINT "care_recipient_code_status_check" CHECK ("care_recipient"."code_status" IN ('fullCode', 'dnr', 'dnrPolst'));--> statement-breakpoint
ALTER TABLE "care_recipient" ADD CONSTRAINT "care_recipient_blood_type_check" CHECK ("care_recipient"."blood_type" IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));--> statement-breakpoint
-- Hand-written (not generated): what each member shares syncs to their group
-- (the care_groups stream), and the recipient's details to its writers only
-- (the care_group_writers stream). user_contact is never published.
-- care_recipient and care_group_member are already published whole, so their
-- new columns need nothing here.
ALTER PUBLICATION "powersync" ADD TABLE "member_contact_share", "care_recipient_details";
