// The sync matrix's app writers (test-health-2, B-371): each uploadable
// table's matrix row is written by the app's own local writer, the code a
// user's device runs, not by a hand-written INSERT, so a writer that drops or
// mangles a column fails roundtrip's column comparison (sync-matrix.mjs).
//
// `SYNC_WRITERS` maps each uploadable table to its writer, in upload order
// (each one's parents first). A writer is called in device A's page through
// the dev and check-build module hook (`window.caretookModules()`,
// lib/sync/index.ts), which a production build drops. A table with no writer
// of its own (a link written with its parent) names the table whose writer
// produces it (`by`), and its row's id (`id`). `care_recipient` is the
// recipient's one uploadable column, written in its own step first.
//
// `run(m, db, ctx)` is evaluated in the page from its source, so it uses only
// its arguments: `m` the module hook's modules, `db` window.caretookSync, and
// `ctx` the run's context (`writerContext`), with `ids` holding each table's
// row written so far. It returns the writer's result plus the row's `id`.
// sync-matrix.test.mjs fails an uploadable table with no entry.
import { conditionManagerId, entryProviderId, medicationConditionId } from "./sync-matrix.mjs";

/** A table written by its own writer: `writer` names it for the report. */
const own = (writer, run, id) => ({ writer, run, ...(id && { id }) });
/** A table written by another table's writer (`by`), with its row's id. */
const producedBy = (by, writer, id) => ({ by, writer, id });

export const SYNC_WRITERS = {
  // The recipient's "No known allergies", toggled (`ctx.recorded`: as the run
  // found it); before the allergy, whose writer clears it.
  care_recipient: own("allergies.setNoKnownAllergies", async (m, db, ctx) => ({
    ...(await m.allergies.setNoKnownAllergies(db, ctx.groupId, !ctx.recorded)),
    id: ctx.recipientId,
  })),
  // A note and its live document, as a draft's first change saves them.
  timeline_entry: own("liveEntry.materializeLiveEntry", async (m, db, ctx) => {
    const id = crypto.randomUUID();
    const r = await m.liveEntry.materializeLiveEntry(db, {
      id,
      groupId: ctx.groupId,
      kind: "note",
      title: `${ctx.tag} matrix note`,
      occurredAt: new Date().toISOString(),
      timeZone: "America/Los_Angeles",
    });
    return { ...r, id };
  }),
  provider: own("providers.createProvider", (m, db, ctx) =>
    m.providers.createProvider(db, ctx.groupId, {
      type: "other",
      name: `${ctx.tag} matrix provider`,
      phones: [{ label: "Office", number: "555-0100" }],
    }),
  ),
  timeline_entry_provider: own(
    "providers.linkProvider",
    (m, db, ctx) => m.providers.linkProvider(db, ctx.ids.timeline_entry, ctx.ids.provider),
    (ids) => entryProviderId(ids.timeline_entry, ids.provider),
  ),
  // The provider's live document (its id is the provider's).
  note_document: own(
    "providers.createProviderDocument",
    (m, db, ctx) => m.providers.createProviderDocument(db, ctx.ids.provider),
    (ids) => ids.provider,
  ),
  // One burst of typing in the provider's notes, flushed as the editor's binding does.
  note_update: own("notes.bindNoteDoc", async (m, db, ctx) => {
    const doc = m.notes.createNoteDoc({ snapshot: null, updates: [] });
    const bound = m.notes.bindNoteDoc(doc, {
      db,
      documentId: ctx.ids.provider,
      groupId: ctx.groupId,
      canWrite: true,
    });
    doc.getText("matrix").insert(0, `${ctx.tag} matrix notes`);
    await bound.flush();
    bound.unbind();
    doc.destroy();
    const [row] = await db.powersync.getAll("SELECT id FROM note_update WHERE document_id = ?", [
      ctx.ids.provider,
    ]);
    return row ? { ok: true, id: row.id } : { ok: false, error: "no note_update written" };
  }),
  // With its "started" entry on the timeline.
  medication: own("medications.createMedication", (m, db, ctx) =>
    m.medications.createMedication(db, ctx.groupId, {
      name: `${ctx.tag} matrix medication`,
      dose: "1 tablet",
      schedule: { type: "asNeeded" },
      status: "current",
      type: "supplement",
    }),
  ),
  medication_pass: own("medicationPasses.createPass", (m, db, ctx) =>
    m.medicationPasses.createPass(db, ctx.groupId, { name: `${ctx.tag} pass`, time: "13:37" }),
  ),
  recipient_allergy: own("allergies.addAllergy", (m, db, ctx) =>
    m.allergies.addAllergy(db, ctx.groupId, {
      substance: `${ctx.tag} matrix allergy`,
      reaction: "Hives",
      severity: "mild",
    }),
  ),
  // Long ago, so the current period on the track doesn't change.
  care_period: own("carePeriods.createCarePeriod", (m, db, ctx) =>
    m.carePeriods.createCarePeriod(db, ctx.groupId, {
      type: "other",
      label: `${ctx.tag} matrix period`,
      startedAt: "2000-01-01T16:00:00.000Z",
      dateOnly: false,
    }),
  ),
  // Unassigned and undated, so it sits at the end of the open list.
  todo: own("todos.createTodo", (m, db, ctx) =>
    m.todos.createTodo(db, ctx.groupId, { title: `${ctx.tag} matrix todo`, providerId: ctx.ids.provider }),
  ),
  // A resolved one, so the profile's active list doesn't change; the matrix
  // provider manages it (condition_manager, below), and it writes its "added" entry.
  recipient_condition: own("conditions.addCondition", (m, db, ctx) =>
    m.conditions.addCondition(
      db,
      ctx.groupId,
      { name: `${ctx.tag} matrix condition`, status: "resolved", sinceYear: 2001, note: "Fictional" },
      { managerIds: [ctx.ids.provider] },
    ),
  ),
  medication_condition: own(
    "medicationConditions.setMedicationConditions",
    (m, db, ctx) =>
      m.medicationConditions.setMedicationConditions(db, ctx.ids.medication, [ctx.ids.recipient_condition]),
    (ids) => medicationConditionId(ids.medication, ids.recipient_condition),
  ),
  condition_manager: producedBy("recipient_condition", "conditions.addCondition (managerIds)", (ids) =>
    conditionManagerId(ids.recipient_condition, ids.provider),
  ),
  // One all-day event long ago (COUNT=1): one visit, nothing in Upcoming.
  // Its title is the run's series cleanup's (`<tag> series…`).
  appointment_series: own("series.createSeries", async (m, db, ctx) => {
    const r = await m.series.createSeries(db, {
      groupId: ctx.groupId,
      kind: "event",
      rule: "FREQ=DAILY;INTERVAL=1;COUNT=1",
      startsOn: "2000-01-01",
      startTime: null,
      allDay: true,
      timeZone: "America/Los_Angeles",
      title: `${ctx.tag} series matrix`,
      durationMinutes: null,
      place: null,
      providerIds: [],
    });
    return r.ok ? { ...r, id: r.seriesId } : r;
  }),
};

/** What every writer's `ctx` starts from. */
export const writerContext = ({ tag, groupId, recipientId, userId, recorded }) => ({
  tag,
  groupId,
  recipientId,
  userId,
  recorded,
  ids: {},
});

/**
 * A page expression calling `table`'s writer on device A: resolves to its
 * result, `{ ok, id, … }` or a refusal.
 */
export const writerCall = (table, ctx) => {
  const w = SYNC_WRITERS[table];
  if (!w?.run) throw new Error(`${table}: no writer of its own`);
  return `(async () => {
    const m = await window.caretookModules();
    const run = ${w.run.toString()};
    return run(m, window.caretookSync, ${JSON.stringify(ctx)});
  })()`;
};

/** A row's id once its writer has run: the writer's own answer, or `id(ids)` where it gives one. */
export const writtenId = (table, ids, result) => {
  const w = SYNC_WRITERS[table];
  return w.id ? w.id(ids) : result?.id;
};

/** The writers' ids under sync-matrix.mjs's names (`matrixContext`'s `ids`), for `cleanupSql` and later steps. */
export const matrixIds = (ids) => ({
  entry: ids.timeline_entry,
  provider: ids.provider,
  link: ids.timeline_entry_provider,
  medication: ids.medication,
  pass: ids.medication_pass,
  allergy: ids.recipient_allergy,
  period: ids.care_period,
  update: ids.note_update,
  todo: ids.todo,
  condition: ids.recipient_condition,
  medicationCondition: ids.medication_condition,
  conditionManager: ids.condition_manager,
  series: ids.appointment_series,
});

/** What `cleanupSql` doesn't remove: the note's own live document (materializeLiveEntry writes it). */
export const writerCleanupSql = (ids) =>
  ids.timeline_entry
    ? [
        `DELETE FROM note_update WHERE document_id = '${ids.timeline_entry}'`,
        `DELETE FROM note_document WHERE id = '${ids.timeline_entry}'`,
      ].join(";\n")
    : "SELECT 1";
