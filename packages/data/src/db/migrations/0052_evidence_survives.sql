ALTER TABLE "admin_audit_log" DROP CONSTRAINT "admin_audit_log_target_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "admin_audit_log" DROP CONSTRAINT "admin_audit_log_target_group_id_care_group_id_fk";
--> statement-breakpoint
ALTER TABLE "legal_acceptance" DROP CONSTRAINT "legal_acceptance_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "care_group_consent" DROP CONSTRAINT "care_group_consent_group_id_care_group_id_fk";
--> statement-breakpoint
ALTER TABLE "care_group_consent" DROP CONSTRAINT "care_group_consent_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "care_group_consent" ADD COLUMN "consent_attested_by" uuid;--> statement-breakpoint
ALTER TABLE "care_group_consent" ADD COLUMN "consent_attested_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "care_group_consent" ADD COLUMN "consent_attested_version" text;--> statement-breakpoint
-- Backfill: each consent row takes its invite's attestation (data-rights PRD,
-- "Evidence survives deletion"). A link without one leaves the columns null.
UPDATE "care_group_consent" AS c
SET "consent_attested_by" = i."consent_attested_by",
  "consent_attested_at" = i."consent_attested_at",
  "consent_attested_version" = i."consent_version"
FROM "care_group_invite" AS i
WHERE c."invite_id" = i."id"
  AND c."consent_attested_at" IS NULL
  AND i."consent_attested_at" IS NOT NULL;
