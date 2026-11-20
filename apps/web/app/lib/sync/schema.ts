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
  // How simple mode picks its tiles (JSON text: `SimpleTiles`; null: learned).
  simpleTiles: text("simple_tiles"),
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
    // Profiles: the member's relationship to the recipient and what they
    // share (`shared_fields`, JSON text), and the emergency list
    // (`is_primary_contact` is 1 or 0).
    relationship: text("relationship"),
    sharedFields: text("shared_fields"),
    emergencyRank: integer("emergency_rank"),
    isPrimaryContact: integer("is_primary_contact"),
    // When they fell off the list by no longer sharing a phone (the managers' note).
    emergencyDroppedAt: text("emergency_dropped_at"),
    // Simple mode: the managers' default for this member and their lock (1 or 0).
    simpleMode: integer("simple_mode"),
    simpleModeLocked: integer("simple_mode_locked"),
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
    // The medical basics and the note for helpers (profiles).
    codeStatus: text("code_status"),
    bloodType: text("blood_type"),
    primaryLanguage: text("primary_language"),
    pronouns: text("pronouns"),
    notes: text("notes"),
    // When "No known allergies" was recorded (cleared when an allergy is added).
    noKnownAllergiesAt: text("no_known_allergies_at"),
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
 * A live document on a note or event, a provider, a medication or a care
 * period. `id` is the owner's id; `subject` says which (`entry` with
 * `entry_id`, `provider` with `provider_id`, `medication` with
 * `medication_id`, or `carePeriod` with `care_period_id`, each equal to `id`). Snapshot, text and `editors` (JSON
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
    carePeriodId: text("care_period_id"),
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

/**
 * What each member shares with the group (profiles): only the values they
 * chose, null for the rest. `phones` is JSON text. Its id is the membership's.
 */
export const memberContactShares = sqliteTable(
  "member_contact_share",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    userId: text("user_id"),
    phones: text("phones"),
    email: text("email"),
    address: text("address"),
    updatedAt: text("updated_at"),
  },
  (t) => [index("member_contact_share_group").on(t.groupId)],
);

/**
 * The recipient's sensitive details (profiles), on owners', admins' and
 * caretakers' devices only (the `care_group_writers` stream). `phones`,
 * `insurance` and `outside_contacts` are JSON text. Its id is the recipient's.
 */
export const careRecipientDetails = sqliteTable(
  "care_recipient_details",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    phones: text("phones"),
    email: text("email"),
    address: text("address"),
    insurance: text("insurance"),
    outsideContacts: text("outside_contacts"),
    updatedAt: text("updated_at"),
  },
  (t) => [index("care_recipient_details_group").on(t.groupId)],
);

/**
 * The group's medication passes (Morning, Evening…): `time` is "HH:MM" in the
 * recipient's zone. Deletes are soft. Schedules name them (`{ passId }` slots).
 */
export const medicationPasses = sqliteTable(
  "medication_pass",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    name: text("name"),
    time: text("time"),
    sortOrder: integer("sort_order"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("medication_pass_group").on(t.groupId)],
);

/** The recipient's allergies. Deletes are soft. */
export const recipientAllergies = sqliteTable(
  "recipient_allergy",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    substance: text("substance"),
    reaction: text("reaction"),
    severity: text("severity"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("recipient_allergy_group").on(t.groupId)],
);

/**
 * The group's care periods (where care happens, over time): one track,
 * stored by start only. `date_only` is 1 or 0. Deletes are soft.
 */
export const carePeriods = sqliteTable(
  "care_period",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    type: text("type"),
    label: text("label"),
    placeProviderId: text("place_provider_id"),
    placeDetail: text("place_detail"),
    startedAt: text("started_at"),
    dateOnly: integer("date_only"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("care_period_group").on(t.groupId)],
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
  memberContactShares,
  careRecipientDetails,
  medicationPasses,
  recipientAllergies,
  carePeriods,
};
