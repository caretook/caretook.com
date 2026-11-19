CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"caring_for" text,
	"heard_from" text,
	"source" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "waitlist_entry_email_lower" CHECK ("waitlist_entry"."email" = lower("waitlist_entry"."email")),
	CONSTRAINT "waitlist_entry_caring_for_check" CHECK ("waitlist_entry"."caring_for" IN ('parent', 'spouse', 'child', 'sibling', 'friend', 'other')),
	CONSTRAINT "waitlist_entry_heard_from_length" CHECK (char_length("waitlist_entry"."heard_from") <= 200)
);
--> statement-breakpoint
CREATE TABLE "contact_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "contact_message_topic_check" CHECK ("contact_message"."topic" IN ('question', 'help', 'privacy', 'other')),
	CONSTRAINT "contact_message_message_length" CHECK (char_length("contact_message"."message") <= 5000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entry_email_unique" ON "waitlist_entry" USING btree ("email");