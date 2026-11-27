import { getTableName } from "drizzle-orm";
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
  // How easy mode picks its tiles (JSON text: `EasyTiles`; null: learned).
  easyTiles: text("easy_tiles"),
  // The owners' Assistants switch (connectors; 1 or 0): whether members may connect their own AI assistant.
  connectorsEnabled: integer("connectors_enabled"),
  // The owners' "Details outside Caretook" switch (appointments-2; 1 or 0): whether members may opt in to details.
  detailsOutsideAllowed: integer("details_outside_allowed"),
  // The owners' read-only choice for assistants (assistant-access; 1 or 0). Synced, never uploaded.
  connectorsReadOnly: integer("connectors_read_only"),
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
    // When "No known conditions" was recorded (cleared when a condition is added).
    noKnownConditionsAt: text("no_known_conditions_at"),
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
    // Written through a member's AI assistant ("via Claude"; connectors). Only the server sets it.
    via: text("via"),
    // A repeating series' visit (appointments-2): its series, the local day the
    // rule made it for ("YYYY-MM-DD"), and whether it was changed on its own (1 or 0).
    seriesId: text("series_id"),
    seriesDay: text("series_day"),
    seriesDetached: integer("series_detached"),
    // A symptom's catalog row (symptom-catalog): symptomTypeId(group, name),
    // written locally with the entry; the server derives its own copy.
    symptomTypeId: text("symptom_type_id"),
  },
  (t) => [
    index("timeline_entry_group_occurred").on(t.groupId, t.occurredAt),
    index("timeline_entry_series").on(t.seriesId),
    // The symptom-type filter, and the types a group has entries of (symptom-catalog).
    index("timeline_entry_group_symptom_type").on(t.groupId, t.symptomTypeId),
  ],
);

/**
 * A live document on a note or event, a provider, a medication or a care
 * period. `id` is the owner's id; `subject` says which (`entry` with
 * `entry_id`, `provider` with `provider_id`, `medication` with
 * `medication_id`, `carePeriod` with `care_period_id`, or `todo` with `todo_id`, each equal to `id`). Snapshot, text and `editors` (JSON
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
    todoId: text("todo_id"),
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
  avatarColor: text("avatar_color"),
  avatarIcon: text("avatar_icon"),
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
    // Prescription, otc, supplement or other; null when not set (medications-3).
    type: text("type"),
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

/**
 * The group's todos (todos PRD). `due_on` is "YYYY-MM-DD" and `due_time`
 * "HH:MM", wall-clock in the recipient's zone. Done ⇔ `done_at` and
 * `done_by` are set. Deletes are soft.
 */
export const todos = sqliteTable(
  "todo",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    title: text("title"),
    assigneeId: text("assignee_id"),
    assigneeName: text("assignee_name"),
    dueOn: text("due_on"),
    dueTime: text("due_time"),
    doneAt: text("done_at"),
    doneBy: text("done_by"),
    providerId: text("provider_id"),
    medicationId: text("medication_id"),
    eventId: text("event_id"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    // Added through a member's AI assistant (connectors). Only the server sets it.
    via: text("via"),
    // Repeating (planner-2): RRULE text, the anchor day and the chain's id; all or none.
    repeatRule: text("repeat_rule"),
    repeatStartsOn: text("repeat_starts_on"),
    repeatId: text("repeat_id"),
    // A subtask's parent todo (todo-subtasks); set on create only.
    parentId: text("parent_id"),
  },
  (t) => [index("todo_group").on(t.groupId), index("todo_parent").on(t.parentId)],
);

/**
 * The recipient's conditions (conditions PRD). `status` is active or
 * resolved; `since_year` and `since_month` are integers. Deletes are soft.
 */
export const recipientConditions = sqliteTable(
  "recipient_condition",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    name: text("name"),
    status: text("status"),
    sinceYear: integer("since_year"),
    sinceMonth: integer("since_month"),
    note: text("note"),
    diagnosedById: text("diagnosed_by_id"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("recipient_condition_group").on(t.groupId)],
);

/**
 * What a medication is for (conditions slice 4): medication ↔ condition
 * links. The id comes from the pair (`medicationConditionId`); unlinking
 * deletes the row.
 */
export const medicationConditions = sqliteTable(
  "medication_condition",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    medicationId: text("medication_id"),
    conditionId: text("condition_id"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [
    index("medication_condition_medication").on(t.medicationId),
    index("medication_condition_condition").on(t.conditionId),
  ],
);

/**
 * Who manages a condition (conditions slice 3): condition ↔ provider links.
 * The id comes from the pair (`conditionManagerId`); unlinking deletes the
 * row (after a PATCH of its `updated_at`: see `conditions.sync.ts`).
 */
export const conditionManagers = sqliteTable(
  "condition_manager",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    conditionId: text("condition_id"),
    providerId: text("provider_id"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [
    index("condition_manager_condition").on(t.conditionId),
    index("condition_manager_provider").on(t.providerId),
  ],
);

/**
 * Repeating appointments and reminders (appointments-2). `rule` is RRULE
 * text; `starts_on` and `topped_up_through` are "YYYY-MM-DD" and
 * `start_time` "HH:MM" (null when all day), wall-clock in `time_zone`;
 * `provider_ids` is JSON text; `all_day` is 1 or 0. Deletes are soft.
 */
export const appointmentSeries = sqliteTable(
  "appointment_series",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    recipientId: text("recipient_id"),
    kind: text("kind"),
    rule: text("rule"),
    startsOn: text("starts_on"),
    startTime: text("start_time"),
    allDay: integer("all_day"),
    timeZone: text("time_zone"),
    title: text("title"),
    durationMinutes: integer("duration_minutes"),
    place: text("place"),
    providerIds: text("provider_ids"),
    toppedUpThrough: text("topped_up_through"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("appointment_series_group").on(t.groupId)],
);

/**
 * The group's symptom catalog (symptom-catalog): the names the symptom
 * sheet suggests. `name_key` folds case and spaces (`symptomKey`), and the
 * id comes from the group and the key (`symptomTypeId`). Rows are added,
 * never changed or removed.
 */
export const symptomTypes = sqliteTable(
  "symptom_type",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    name: text("name"),
    nameKey: text("name_key"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    // Server-set (symptom-catalog-2): when a writer archived it, and a merged row's replacement.
    archivedAt: text("archived_at"),
    replacedById: text("replaced_by_id"),
  },
  (t) => [index("symptom_type_group").on(t.groupId)],
);

/**
 * Which todos a note or event links (planner-3): entry ↔ todo links, many
 * to many. The id comes from the pair (`entryTodoId`); unlinking deletes the
 * row. Readers join live entries and todos.
 */
export const timelineEntryTodos = sqliteTable(
  "timeline_entry_todo",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    entryId: text("entry_id"),
    todoId: text("todo_id"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [index("timeline_entry_todo_entry").on(t.entryId), index("timeline_entry_todo_todo").on(t.todoId)],
);

/**
 * A care group's shared tags (tags). The id comes from the group, the folded
 * name and a counter (`tagId`); `name_key` is the folded name. Hard deletes.
 */
export const tags = sqliteTable(
  "tag",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    name: text("name"),
    nameKey: text("name_key"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    // A palette id (tags-2, `TAG_COLORS`); null or unknown is the neutral chip.
    color: text("color"),
  },
  (t) => [index("tag_group").on(t.groupId)],
);

/**
 * Which records carry which tags (tags): exactly one of the target columns
 * is set. The id comes from the tag and the record (`recordTagId`);
 * untagging deletes the row. Readers join live records.
 */
export const recordTags = sqliteTable(
  "record_tag",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
    tagId: text("tag_id"),
    entryId: text("entry_id"),
    todoId: text("todo_id"),
    providerId: text("provider_id"),
    medicationId: text("medication_id"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (t) => [
    index("record_tag_tag").on(t.tagId),
    index("record_tag_entry").on(t.entryId),
    index("record_tag_todo").on(t.todoId),
    index("record_tag_provider").on(t.providerId),
    index("record_tag_medication").on(t.medicationId),
  ],
);

/**
 * Local only (never synced, never uploaded; cleared with the local copy): one
 * row per change the server didn't save (sync-safety, B-285). `outcome` is
 * `refused` (a 4xx: the server's `code` and `issues`, JSON text) or
 * `set_aside` (tried too often, slice 3). `data` is the op's data (JSON
 * text), `label` the row's title or name when the device knew it, and
 * `line_key` what the "Changes not saved" page groups by (a note's document
 * and its updates share one). Written by `lib/sync/uploader.ts`.
 */
export const unsavedChanges = sqliteTable(
  "unsaved_change",
  {
    id: text("id").primaryKey(),
    recordedAt: text("recorded_at"),
    tableName: text("table_name"),
    rowId: text("row_id"),
    op: text("op"),
    data: text("data"),
    code: text("code"),
    issues: text("issues"),
    outcome: text("outcome"),
    label: text("label"),
    lineKey: text("line_key"),
  },
  (t) => [index("unsaved_change_line").on(t.lineKey)],
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
  todos,
  recipientConditions,
  medicationConditions,
  conditionManagers,
  appointmentSeries,
  symptomTypes,
  timelineEntryTodos,
  tags,
  recordTags,
  unsavedChanges,
};

/**
 * The tables as PowerSync gets them (`DrizzleAppSchema`): `drizzleSchema`,
 * with per-table options. `todo` tracks metadata, so a write can flag itself
 * for the upload through its `_metadata` column (an Undo's delete of the
 * next occurrence, B-382). Drizzle queries keep `drizzleSchema`.
 * `unsaved_change` is local only: no stream, no upload, no sync-matrix row
 * (`LOCAL_ONLY_TABLES`, which the agreement tests skip).
 */
export const powerSyncSchema = {
  ...drizzleSchema,
  todos: { tableDefinition: todos, options: { trackMetadata: true } },
  unsavedChanges: { tableDefinition: unsavedChanges, options: { localOnly: true } },
};

/** The device tables that never sync (`localOnly`): tests of the synced tables skip them. */
export const LOCAL_ONLY_TABLES: readonly string[] = Object.values(powerSyncSchema).flatMap((entry) =>
  "tableDefinition" in entry && entry.options && "localOnly" in entry.options && entry.options.localOnly
    ? [getTableName(entry.tableDefinition)]
    : [],
);
