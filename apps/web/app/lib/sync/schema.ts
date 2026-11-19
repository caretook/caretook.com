import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    invitedBy: text("invited_by"),
    createdAt: text("created_at"),
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
    // The recipient's IANA zone (schedule times are in it) and "YYYY-MM-DD" date of birth.
    timeZone: text("time_zone"),
    dateOfBirth: text("date_of_birth"),
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
    // Appointments and reminders. `all_day` is 1 or 0.
    endsAt: text("ends_at"),
    allDay: integer("all_day"),
    place: text("place"),
    cancelledAt: text("cancelled_at"),
    cancelledBy: text("cancelled_by"),
    cancelReason: text("cancel_reason"),
    rescheduledTo: text("rescheduled_to"),
  },
  (t) => [index("timeline_entry_group_occurred").on(t.groupId, t.occurredAt)],
);

/**
 * A live document on a note or event, a provider or a medication. `id` is the
 * owner's id; `subject` says which (`entry` with `entry_id`, `provider` with
 * `provider_id`, or `medication` with `medication_id`, each equal to `id`). Snapshot, text and `editors` (JSON
 * `{ [userId]: lastEditAt }`) are the server's.
 */
export const noteDocuments = sqliteTable(
  "note_document",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    snapshot: text("snapshot"),
    text: text("text"),
    editors: text("editors"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    subject: text("subject"),
    entryId: text("entry_id"),
    providerId: text("provider_id"),
    medicationId: text("medication_id"),
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

/** The group's provider directory. `phones` is JSON text; `is_primary` is 1 or 0. Deletes are soft. */
export const providers = sqliteTable(
  "provider",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    type: text("type"),
    name: text("name"),
    specialty: text("specialty"),
    practiceId: text("practice_id"),
    phones: text("phones"),
    email: text("email"),
    address: text("address"),
    website: text("website"),
    status: text("status"),
    isPrimary: integer("is_primary"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("provider_group").on(t.groupId)],
);

/** Which providers an event or note was with. The id comes from the pair (`entryProviderId`). */
export const timelineEntryProviders = sqliteTable(
  "timeline_entry_provider",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    entryId: text("entry_id"),
    providerId: text("provider_id"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [
    index("timeline_entry_provider_entry").on(t.entryId),
    index("timeline_entry_provider_provider").on(t.providerId),
  ],
);

/**
 * The group's medication list. `schedule` is JSON text; the dates are
 * "YYYY-MM-DD". Deletes are soft. Doses and changes are timeline entries.
 */
export const medications = sqliteTable(
  "medication",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    name: text("name"),
    strength: text("strength"),
    form: text("form"),
    dose: text("dose"),
    directions: text("directions"),
    reason: text("reason"),
    schedule: text("schedule"),
    status: text("status"),
    startedOn: text("started_on"),
    stoppedOn: text("stopped_on"),
    stopReason: text("stop_reason"),
    stopNote: text("stop_note"),
    prescriberId: text("prescriber_id"),
    pharmacyId: text("pharmacy_id"),
    lastFilledOn: text("last_filled_on"),
    quantity: text("quantity"),
    refillsLeft: integer("refills_left"),
    rxNumber: text("rx_number"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("medication_group").on(t.groupId)],
);

export const drizzleSchema = {
  careGroups,
  careGroupMembers,
  careRecipients,
  timelineEntries,
  noteDocuments,
  noteUpdates,
  users,
  providers,
  timelineEntryProviders,
  medications,
};
