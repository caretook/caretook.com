-- PowerSync replicates these tables into its sync buckets (logical
-- replication, wal_level=logical). Which rows reach which device is decided
-- by powersync/sync-config.yaml; this only says what PowerSync may read.
--
-- "user" is limited to public profile columns, so emails, roles and
-- preferences never leave Postgres through replication. Account tables
-- (session, account, verification, jwks) and invites are not published.
--
-- A new synced table needs a migration: ALTER PUBLICATION powersync ADD TABLE …
CREATE PUBLICATION "powersync" FOR TABLE
  "care_group",
  "care_group_member",
  "care_recipient",
  "timeline_entry",
  "user" ("id", "name", "image");
