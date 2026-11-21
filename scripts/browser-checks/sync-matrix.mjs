// The sync matrix (roundtrip.mjs): one row per synced table on the device
// (apps/web/app/lib/sync/schema.ts), so that "a row reaches a second device"
// is proven once, here, and never by an area check.
//
// - `device` tables are the upload switch's (packages/api/src/sync.ts
//   HANDLERS): device A writes a row to its local SQLite, it uploads through
//   `sync.upload` and the services, and device B must hold it.
// - `server` tables are written only by the services (or the seeds): a
//   seeded row must be on both devices.
//
// A new synced table adds a row here; scripts/loops/sync-matrix.test.mjs
// fails until it does. `care_recipient` is uploadable for one column only
// (`no_known_allergies_at`), so roundtrip patches it in its own step
// (`RECIPIENT_PATCH`) rather than inserting a row.
//
// Every row the matrix writes carries the run's tag, and `cleanupSql` removes
// them (soft deletes where the table has them), so it passes run after run.
import { createHash, randomUUID } from "node:crypto";

/** PowerSync's timestamp text, as the device writes it (`toLocalTimestamp`). */
export const localTimestamp = (date = new Date()) => date.toISOString().replace(/Z$/, "000Z");

/** The version 5 UUID of `name` in `namespace` (packages/data's `uuidV5`). */
export const uuidV5 = (name, namespace) => {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest().subarray(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/** packages/data's ENTRY_PROVIDER_NAMESPACE: a link's id comes from its entry and provider. */
export const ENTRY_PROVIDER_NAMESPACE = "7c0e4f2a-9a51-4d5e-8b3f-2f6d1c9e4a10";
export const entryProviderId = (entryId, providerId) =>
  uuidV5(`${entryId.toLowerCase()}:${providerId.toLowerCase()}`, ENTRY_PROVIDER_NAMESPACE);

/** packages/data's MEDICATION_CONDITION_NAMESPACE: a link's id comes from its medication and condition. */
export const MEDICATION_CONDITION_NAMESPACE = "3d6b8f1e-2c47-4a9d-b5e0-8f7a1c2d9e43";
export const medicationConditionId = (medicationId, conditionId) =>
  uuidV5(`${medicationId.toLowerCase()}:${conditionId.toLowerCase()}`, MEDICATION_CONDITION_NAMESPACE);

/** packages/data's CONDITION_MANAGER_NAMESPACE: a link's id comes from its condition and provider. */
export const CONDITION_MANAGER_NAMESPACE = "8a2e4c71-5b9d-4f06-a3c8-1e7d9b4f2a65";
export const conditionManagerId = (conditionId, providerId) =>
  uuidV5(`${conditionId.toLowerCase()}:${providerId.toLowerCase()}`, CONDITION_MANAGER_NAMESPACE);

/** An empty Yjs update (base64): the smallest valid `note_update`. */
const EMPTY_YJS_UPDATE = "AAA=";

/**
 * Everything a run's rows need: the group, its recipient, the writer (device
 * A's user), the tag and the ids, made up front so each row can name the
 * ones before it.
 */
export const matrixContext = ({ tag, groupId, recipientId, userId }) => {
  const entry = randomUUID();
  const provider = randomUUID();
  const medication = randomUUID();
  const condition = randomUUID();
  return {
    tag,
    groupId,
    recipientId,
    userId,
    now: localTimestamp(),
    ids: {
      entry,
      provider,
      link: entryProviderId(entry, provider),
      medication,
      pass: randomUUID(),
      allergy: randomUUID(),
      period: randomUUID(),
      update: randomUUID(),
      todo: randomUUID(),
      condition,
      medicationCondition: medicationConditionId(medication, condition),
      conditionManager: conditionManagerId(condition, provider),
      series: randomUUID(),
    },
  };
};

/** A local INSERT of `row` into `table` (the device's column names). */
const insert = (table, row) => {
  const columns = Object.keys(row);
  return {
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    params: Object.values(row),
  };
};

const audit = (ctx) => ({
  created_at: ctx.now,
  updated_at: ctx.now,
  created_by: ctx.userId,
  updated_by: ctx.userId,
});

/** A device-written table: `id` is the row device B must hold, `write` A's local statements. */
const device = (table, id, write) => ({ table, by: "device", id, write });
/** A server-written table: `id` is a psql query for a seeded row in the group. */
const server = (table, idSql) => ({ table, by: "server", idSql });

/** Rows in upload order: each one's parents come before it. */
export const SYNC_MATRIX = [
  // A note (links and documents need a note or an event).
  device(
    "timeline_entry",
    (ctx) => ctx.ids.entry,
    (ctx) =>
      insert("timeline_entry", {
        id: ctx.ids.entry,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        kind: "note",
        occurred_at: ctx.now,
        time_zone: "America/Los_Angeles",
        title: `${ctx.tag} matrix note`,
        body: null,
        details: null,
        deleted_at: null,
        all_day: 0,
        ...audit(ctx),
      }),
  ),
  device(
    "provider",
    (ctx) => ctx.ids.provider,
    (ctx) =>
      insert("provider", {
        id: ctx.ids.provider,
        group_id: ctx.groupId,
        type: "other",
        name: `${ctx.tag} matrix provider`,
        phones: "[]",
        status: "current",
        is_primary: 0,
        deleted_at: null,
        ...audit(ctx),
      }),
  ),
  device(
    "timeline_entry_provider",
    (ctx) => ctx.ids.link,
    (ctx) =>
      insert("timeline_entry_provider", {
        id: ctx.ids.link,
        group_id: ctx.groupId,
        entry_id: ctx.ids.entry,
        provider_id: ctx.ids.provider,
        ...audit(ctx),
      }),
  ),
  // The provider's live document (its id is the provider's), then one update to it.
  device(
    "note_document",
    (ctx) => ctx.ids.provider,
    (ctx) =>
      insert("note_document", {
        id: ctx.ids.provider,
        group_id: ctx.groupId,
        subject: "provider",
        provider_id: ctx.ids.provider,
        snapshot: null,
        text: "",
        ...audit(ctx),
      }),
  ),
  device(
    "note_update",
    (ctx) => ctx.ids.update,
    (ctx) =>
      insert("note_update", {
        id: ctx.ids.update,
        group_id: ctx.groupId,
        document_id: ctx.ids.provider,
        data: EMPTY_YJS_UPDATE,
        created_at: ctx.now,
        created_by: ctx.userId,
      }),
  ),
  device(
    "medication",
    (ctx) => ctx.ids.medication,
    (ctx) =>
      insert("medication", {
        id: ctx.ids.medication,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        name: `${ctx.tag} matrix medication`,
        schedule: JSON.stringify({ type: "asNeeded" }),
        status: "current",
        deleted_at: null,
        // The type column (medications-3) uploads and syncs with the rest.
        type: "supplement",
        ...audit(ctx),
      }),
  ),
  device(
    "medication_pass",
    (ctx) => ctx.ids.pass,
    (ctx) =>
      insert("medication_pass", {
        id: ctx.ids.pass,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        name: `${ctx.tag} pass`,
        time: "13:37",
        sort_order: 999,
        deleted_at: null,
        ...audit(ctx),
      }),
  ),
  device(
    "recipient_allergy",
    (ctx) => ctx.ids.allergy,
    (ctx) =>
      insert("recipient_allergy", {
        id: ctx.ids.allergy,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        substance: `${ctx.tag} matrix allergy`,
        severity: "unknown",
        deleted_at: null,
        ...audit(ctx),
      }),
  ),
  // Long ago, so the current period on the track doesn't change.
  device(
    "care_period",
    (ctx) => ctx.ids.period,
    (ctx) =>
      insert("care_period", {
        id: ctx.ids.period,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        type: "other",
        label: `${ctx.tag} matrix period`,
        started_at: "2000-01-01T08:00:00.000000Z",
        date_only: 0,
        deleted_at: null,
        ...audit(ctx),
      }),
  ),
  // Unassigned and undated, so it sits at the end of the open list.
  device(
    "todo",
    (ctx) => ctx.ids.todo,
    (ctx) =>
      insert("todo", {
        id: ctx.ids.todo,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        title: `${ctx.tag} matrix todo`,
        assignee_id: null,
        assignee_name: null,
        due_on: null,
        due_time: null,
        done_at: null,
        done_by: null,
        deleted_at: null,
        ...audit(ctx),
      }),
  ),
  // A resolved one, so the profile's active list doesn't change.
  device(
    "recipient_condition",
    (ctx) => ctx.ids.condition,
    (ctx) =>
      insert("recipient_condition", {
        id: ctx.ids.condition,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        name: `${ctx.tag} matrix condition`,
        status: "resolved",
        since_year: 2001,
        since_month: null,
        note: null,
        diagnosed_by_id: null,
        deleted_at: null,
        ...audit(ctx),
      }),
  ),
  // The matrix medication is for the matrix condition (both written above).
  device(
    "medication_condition",
    (ctx) => ctx.ids.medicationCondition,
    (ctx) =>
      insert("medication_condition", {
        id: ctx.ids.medicationCondition,
        group_id: ctx.groupId,
        medication_id: ctx.ids.medication,
        condition_id: ctx.ids.condition,
        ...audit(ctx),
      }),
  ),
  // The matrix provider manages the matrix condition (both written above).
  device(
    "condition_manager",
    (ctx) => ctx.ids.conditionManager,
    (ctx) =>
      insert("condition_manager", {
        id: ctx.ids.conditionManager,
        group_id: ctx.groupId,
        condition_id: ctx.ids.condition,
        provider_id: ctx.ids.provider,
        ...audit(ctx),
      }),
  ),
  // A reminder series (appointments-2) long ago, with one visit and
  // `topped_up_through` set, so the server writes no visits of its own and
  // nothing shows in Upcoming.
  device(
    "appointment_series",
    (ctx) => ctx.ids.series,
    (ctx) =>
      insert("appointment_series", {
        id: ctx.ids.series,
        group_id: ctx.groupId,
        recipient_id: ctx.recipientId,
        kind: "event",
        rule: "FREQ=DAILY;INTERVAL=1;COUNT=1",
        starts_on: "2000-01-01",
        start_time: null,
        all_day: 1,
        time_zone: "America/Los_Angeles",
        title: `${ctx.tag} matrix series`,
        duration_minutes: null,
        place: null,
        provider_ids: "[]",
        topped_up_through: "2000-01-01",
        deleted_at: null,
        ...audit(ctx),
      }),
  ),
  // Patched, not inserted: see RECIPIENT_PATCH.
  { table: "care_recipient", by: "patch" },
  server("care_group", (ctx) => `SELECT '${ctx.groupId}'`),
  server(
    "care_group_member",
    (ctx) => `SELECT id FROM care_group_member WHERE group_id = '${ctx.groupId}' ORDER BY id LIMIT 1`,
  ),
  server(
    "user",
    (ctx) =>
      `SELECT user_id FROM care_group_member WHERE group_id = '${ctx.groupId}' ORDER BY user_id LIMIT 1`,
  ),
  server(
    "member_contact_share",
    (ctx) => `SELECT id FROM member_contact_share WHERE group_id = '${ctx.groupId}' ORDER BY id LIMIT 1`,
  ),
  // Writers' devices only: both matrix devices are writers.
  server(
    "care_recipient_details",
    (ctx) => `SELECT id FROM care_recipient_details WHERE group_id = '${ctx.groupId}' ORDER BY id LIMIT 1`,
  ),
];

/**
 * care_recipient's one uploadable column: device A records "No known
 * allergies" (or clears it, if it's recorded), and device B must see the
 * change. Before the allergy row, which clears it on the server.
 */
export const RECIPIENT_PATCH = {
  table: "care_recipient",
  write: (ctx, recorded) => ({
    sql: "UPDATE care_recipient SET no_known_allergies_at = ? WHERE id = ?",
    params: [recorded ? null : ctx.now, ctx.recipientId],
  }),
  /** Device B's view: whether it's recorded now. */
  read: (ctx) => ({
    sql: "SELECT no_known_allergies_at IS NOT NULL AS recorded FROM care_recipient WHERE id = ?",
    params: [ctx.recipientId],
  }),
};

/** Removes the run's rows from Postgres, and puts the recipient's "No known allergies" back. */
export const cleanupSql = (ctx, recordedAt) =>
  [
    `DELETE FROM timeline_entry_provider WHERE id = '${ctx.ids.link}'`,
    `DELETE FROM medication_condition WHERE id = '${ctx.ids.medicationCondition}'`,
    `DELETE FROM condition_manager WHERE id = '${ctx.ids.conditionManager}'`,
    `DELETE FROM note_update WHERE document_id = '${ctx.ids.provider}'`,
    `DELETE FROM note_document WHERE id = '${ctx.ids.provider}'`,
    // The note, and the medication's "started" entry the service wrote with it.
    `UPDATE timeline_entry SET deleted_at = now() WHERE deleted_at IS NULL AND (id = '${ctx.ids.entry}' OR details->>'medicationId' = '${ctx.ids.medication}' OR details->>'conditionId' = '${ctx.ids.condition}')`,
    ...[
      "provider",
      "medication",
      "medication_pass",
      "recipient_allergy",
      "care_period",
      "todo",
      "appointment_series",
    ].map(
      (t) =>
        `UPDATE ${t} SET deleted_at = now() WHERE deleted_at IS NULL AND id IN ('${ctx.ids.provider}', '${ctx.ids.medication}', '${ctx.ids.pass}', '${ctx.ids.allergy}', '${ctx.ids.period}', '${ctx.ids.todo}', '${ctx.ids.series}')`,
    ),
    `UPDATE recipient_condition SET deleted_at = now() WHERE deleted_at IS NULL AND id = '${ctx.ids.condition}'`,
    `UPDATE care_recipient SET no_known_allergies_at = ${recordedAt ? `'${recordedAt}'` : "NULL"} WHERE id = '${ctx.recipientId}' AND no_known_allergies_at IS DISTINCT FROM ${recordedAt ? `'${recordedAt}'::timestamptz` : "NULL"}`,
  ].join(";\n");
