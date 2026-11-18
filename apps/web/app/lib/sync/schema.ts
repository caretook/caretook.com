import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The device's local copy of the synced tables, as SQLite holds them. These
// mirror the columns powersync/sync-config.yaml selects; a column missing
// here is dropped on the device, and one missing there is always null.
//
// SQLite has no uuid, timestamptz or jsonb: ids are text, timestamps are
// PowerSync's ISO text ("2026-11-17T10:00:00.000000Z", see `toLocalTimestamp`),
// and JSON is text. Every table needs a text `id` primary key.

export const careGroups = sqliteTable("care_group", {
  id: text("id").primaryKey(),
  name: text("name"),
});

export const careGroupMembers = sqliteTable(
  "care_group_member",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    userId: text("user_id"),
    role: text("role"),
  },
  (t) => [index("care_group_member_group").on(t.groupId), index("care_group_member_user").on(t.userId)],
);

export const careRecipients = sqliteTable(
  "care_recipient",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    name: text("name"),
    preferredName: text("preferred_name"),
  },
  (t) => [index("care_recipient_group").on(t.groupId)],
);

export const timelineEntries = sqliteTable(
  "timeline_entry",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    kind: text("kind"),
    occurredAt: text("occurred_at"),
    timeZone: text("time_zone"),
    title: text("title"),
    body: text("body"),
    details: text("details"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("timeline_entry_group_occurred").on(t.groupId, t.occurredAt)],
);

/** A live document on a note or event. `id` is the entry's id. Snapshot and text are the server's. */
export const noteDocuments = sqliteTable(
  "note_document",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    snapshot: text("snapshot"),
    text: text("text"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("note_document_group").on(t.groupId)],
);

/** Yjs updates (base64) not yet compacted into the document's snapshot. Devices only ever insert. */
export const noteUpdates = sqliteTable(
  "note_update",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    documentId: text("document_id"),
    data: text("data"),
    createdAt: text("created_at"),
    createdBy: text("created_by"),
  },
  (t) => [index("note_update_document").on(t.documentId)],
);

/** Co-members' public profiles only (no email): see the `member_profiles` stream. */
export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  image: text("image"),
});

export const drizzleSchema = {
  careGroups,
  careGroupMembers,
  careRecipients,
  timelineEntries,
  noteDocuments,
  noteUpdates,
  users,
};
