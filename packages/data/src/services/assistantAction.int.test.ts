import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { addDays, buildNoteDoc, dayInZone, doseSlotIdFor, passRoundId, zonedInstant } from "../db/schema";
import { createGroup, createUser, createWorld, ok, typeParagraph } from "../../test/fixtures";
import { getDb } from "../db";
import {
  FUTURE_DATE_MESSAGE,
  noteDocumentSchema,
  noteUpdateSchema,
  medicationSchema,
  todoSchema,
  timelineEntryProviderSchema,
  timelineEntrySchema,
} from "../db/schema";
import { isError } from "../errors";
import {
  assistantActionService,
  medicationPassService,
  medicationService,
  noteDocumentService,
  providerService,
  recipientConditionService,
  todoService,
  timelineEntryService,
} from ".";

// The server's assistant runner (connectors PRD): each action writes what
// quick entry's device runner writes, a refused action writes nothing and
// names its index, only writers may run a batch, and `via` is stored. Every
// test builds its own group and users. All data is fictional.

const VIA = "Test Claude";
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60_000).toISOString();

const setup = async () => {
  const { u, group, recipient } = await createWorld({ extras: ["outsider"] });
  const [morning, evening] = ok(await medicationPassService.list(u.owner.ctx, { groupId: group.id })).data;
  if (!morning || !evening) throw new Error("no default passes");
  // Started days ago, so both passes' slots are on today's schedule at any hour the tests run.
  const addMedication = async (name: string, changedAt = minutesAgo(3 * 24 * 60)) =>
    ok(
      await medicationService.create(
        u.caretaker.ctx,
        {
          groupId: group.id,
          name,
          strength: "500 mg",
          schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
        },
        { changedAt },
      ),
    )!;
  const provider = ok(
    await providerService.create(u.caretaker.ctx, {
      groupId: group.id,
      type: "clinician",
      name: "Dr. Example",
    }),
  )!;
  const run = (who: keyof typeof u, actions: unknown[]) =>
    assistantActionService.run(u[who].ctx, group.id, actions, { via: VIA });
  const entriesOf = async () =>
    getDb().select().from(timelineEntrySchema).where(eq(timelineEntrySchema.groupId, group.id));
  const todosOf = async () => getDb().select().from(todoSchema).where(eq(todoSchema.groupId, group.id));
  return { u, group, recipient, morning, evening, addMedication, provider, run, entriesOf, todosOf };
};

const refusal = (res: unknown) => {
  if (!isError(res)) throw new Error(`expected a refusal, got ${JSON.stringify(res)}`);
  return { code: res.code, index: res.meta.index, issues: res.meta.issues };
};

describe("assistantActionService.run", () => {
  it("givePass leaves out a medication added after the pass's time that day", async () => {
    const { recipient, morning, addMedication, run, entriesOf } = await setup();
    const zone = recipient.timeZone ?? "UTC";
    const day = addDays(dayInZone(new Date(), zone), -5);
    const addedAt = zonedInstant(day, "14:59", zone);
    const earlier = await addMedication(
      "Metformin",
      zonedInstant(addDays(day, -5), "07:00", zone).toISOString(),
    );
    const late = await addMedication("Lisinopril", addedAt.toISOString());
    const stamp = async (id: string, createdAt: Date) =>
      getDb()
        .update(medicationSchema)
        .set({ createdAt: createdAt.toISOString() })
        .where(eq(medicationSchema.id, id));
    await stamp(earlier.id, zonedInstant(addDays(day, -5), "07:00", zone));
    await stamp(late.id, addedAt);

    ok(
      await run("caretaker", [
        { type: "givePass", passId: morning.id, occurredAt: zonedInstant(day, "15:00", zone).toISOString() },
      ]),
    );
    const given = (await entriesOf()).filter((e) => e.kind === "dose" && !e.deletedAt);
    expect(given.map((e) => (e.details as { medicationId: string }).medicationId)).toEqual([earlier.id]);
  });

  it("writes each action as quick entry would, carrying via", async () => {
    const { u, group, recipient, evening, addMedication, provider, run, entriesOf, todosOf } = await setup();
    const metformin = await addMedication("Metformin");
    const lisinopril = await addMedication("Lisinopril");
    const before = (await entriesOf()).length;

    const res = ok(
      await run("caretaker", [
        {
          type: "logVital",
          readings: [{ type: "bloodPressure", systolic: 130, diastolic: 85 }],
          occurredAt: minutesAgo(5),
        },
        {
          type: "logSymptom",
          name: "Headache",
          severity: 4,
          note: "After lunch",
          occurredAt: minutesAgo(10),
        },
        {
          type: "logDose",
          medicationId: metformin.id,
          status: "given",
          amount: "1 tablet",
          occurredAt: minutesAgo(1),
        },
        { type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) },
        {
          type: "addNote",
          title: "Walk",
          text: "A short walk around the block.",
          occurredAt: minutesAgo(30),
        },
        {
          type: "addEvent",
          title: "Cardiology follow-up",
          occurredAt: inHours(48),
          place: "Clinic B",
          providerIds: [provider.id],
          timeZone: "America/Los_Angeles",
        },
        {
          type: "addTodo",
          title: "Pick up prescription",
          assigneeId: u.caretaker.user.id,
          dueOn: "2026-12-01",
        },
      ]),
    );
    expect(res.byAction.map((ids) => ids.length)).toEqual([1, 1, 1, 2, 1, 1, 1]);
    expect(res.ids).toEqual(res.byAction.flat());

    const entries = await entriesOf();
    expect(entries.length - before).toBe(7);
    const byId = new Map(entries.map((e) => [e.id, e]));
    const [[vital], [symptom], [dose], passDoses, [note], [event], [todoId]] = res.byAction as [
      [string],
      [string],
      [string],
      string[],
      [string],
      [string],
      [string],
    ];
    for (const id of res.ids.filter((id) => id !== todoId)) {
      expect(byId.get(id)).toMatchObject({
        via: VIA,
        createdBy: u.caretaker.user.id,
        recipientId: recipient.id,
        deletedAt: null,
      });
    }
    expect(byId.get(vital)).toMatchObject({
      kind: "vital",
      timeZone: "America/Los_Angeles",
      details: { readings: [{ type: "bloodPressure", systolic: 130, diastolic: 85 }] },
    });
    expect(byId.get(symptom)).toMatchObject({
      kind: "symptom",
      body: "After lunch",
      details: { name: "Headache", severity: 4 },
    });
    expect(byId.get(dose)).toMatchObject({
      kind: "dose",
      details: { medicationId: metformin.id, status: "given", amount: "1 tablet" },
    });

    // Given all: one dose per open slot of the pass, in one round.
    const given = passDoses.map((id) => byId.get(id)!);
    expect(given.map((d) => (d.details as { medicationId: string }).medicationId).sort()).toEqual(
      [metformin.id, lisinopril.id].sort(),
    );
    const rounds = new Set(given.map((d) => (d.details as { passLogId: string }).passLogId));
    expect(rounds.size).toBe(1);
    for (const d of given)
      expect(d.details).toMatchObject({ status: "given", passId: evening.id, scheduledFor: evening.time });

    // A note's text is its (compacted) document; an event gets a document and its providers.
    expect(byId.get(note)).toMatchObject({ kind: "note", title: "Walk" });
    expect(ok(await timelineEntryService.getById(u.viewer.ctx, note))?.body).toBe(
      "A short walk around the block.",
    );
    const docs = await getDb()
      .select()
      .from(noteDocumentSchema)
      .where(eq(noteDocumentSchema.groupId, group.id));
    expect(docs.map((d) => d.id).sort()).toEqual([note, event].sort());
    expect(byId.get(event)).toMatchObject({
      kind: "event",
      title: "Cardiology follow-up",
      place: "Clinic B",
    });
    const links = await getDb()
      .select()
      .from(timelineEntryProviderSchema)
      .where(eq(timelineEntryProviderSchema.entryId, event));
    expect(links.map((l) => l.providerId)).toEqual([provider.id]);

    const todos = await todosOf();
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({
      id: todoId,
      title: "Pick up prescription",
      assigneeId: u.caretaker.user.id,
      dueOn: "2026-12-01",
      via: VIA,
      createdBy: u.caretaker.user.id,
    });
  });

  it("refuses a batch with one bad action, writing nothing and naming it", async () => {
    const { u, group, evening, addMedication, run, entriesOf, todosOf } = await setup();
    const metformin = await addMedication("Metformin");
    const stopped = await addMedication("Atenolol");
    ok(
      await medicationService.update(u.caretaker.ctx, stopped.id, {
        status: "completed",
        stoppedOn: "2026-11-01",
      }),
    );
    const noon = ok(
      await medicationPassService.create(u.owner.ctx, { groupId: group.id, name: "Noon", time: "12:00" }),
    )!;
    const before = (await entriesOf()).length;
    const good = { type: "addNote", text: "Fine", occurredAt: minutesAgo(1) };
    const todo = { type: "addTodo", title: "Call the pharmacy" };

    const cases: [unknown, string, unknown?][] = [
      [
        { type: "logDose", medicationId: metformin.id, status: "given", occurredAt: inHours(2) },
        "assistantActionService:invalid",
        [{ path: "occurredAt", message: FUTURE_DATE_MESSAGE }],
      ],
      // Notes are past-only (planner-2): a note ahead is refused through the service rule.
      [
        { type: "addNote", text: "Call the pharmacy", occurredAt: inHours(2) },
        "assistantActionService:invalid",
        [{ path: "occurredAt", message: FUTURE_DATE_MESSAGE }],
      ],
      [
        { type: "logDose", medicationId: stopped.id, status: "given", occurredAt: minutesAgo(1) },
        "assistantActionService:medicationStopped",
      ],
      [
        { type: "logDose", medicationId: randomUUID(), status: "given", occurredAt: minutesAgo(1) },
        "assistantActionService:medicationGone",
      ],
      [
        {
          type: "addEvent",
          title: "Visit",
          occurredAt: inHours(24),
          providerIds: [randomUUID()],
          timeZone: "America/Los_Angeles",
        },
        "assistantActionService:providerGone",
      ],
      [
        { type: "addNote", text: "Called", occurredAt: minutesAgo(1), providerIds: [randomUUID()] },
        "assistantActionService:providerGone",
      ],
      [
        {
          type: "logVital",
          readings: [{ type: "bloodPressure", systolic: 80, diastolic: 120 }],
          occurredAt: minutesAgo(1),
        },
        "assistantActionService:invalid",
        [expect.objectContaining({ path: "readings.0.diastolic" })],
      ],
      [
        { type: "givePass", passId: randomUUID(), occurredAt: minutesAgo(1) },
        "assistantActionService:passGone",
      ],
      [{ type: "givePass", passId: noon.id, occurredAt: minutesAgo(1) }, "assistantActionService:passEmpty"],
      [{ type: "addTodo", title: "Call", assigneeId: u.outsider.user.id }, "todoService:assigneeNotMember"],
    ];
    for (const [bad, code, issues] of cases) {
      const res = refusal(await run("caretaker", [good, todo, bad]));
      expect(res, JSON.stringify(bad)).toMatchObject({ code, index: 2 });
      if (issues) expect(res.issues).toEqual(issues);
    }
    expect((await entriesOf()).length).toBe(before);
    expect(await todosOf()).toEqual([]);

    // A pass with nothing left: the second Given all in one batch plans from the same state, so
    // it's the next batch that's refused.
    ok(await run("caretaker", [{ type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]));
    expect(
      refusal(
        await run("caretaker", [good, { type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]),
      ),
    ).toMatchObject({ code: "assistantActionService:nothingLeft", index: 1 });
  });

  it("refuses a deleted condition, another group's and an unknown one, writing nothing", async () => {
    const { u, group, run, entriesOf } = await setup();
    const condition = async (ctx: typeof u.owner.ctx, groupId: string, name: string) =>
      ok(await recipientConditionService.create(ctx, { groupId, name }))!;
    const live = await condition(u.owner.ctx, group.id, "Asthma");
    const deleted = await condition(u.owner.ctx, group.id, "Old");
    ok(await recipientConditionService.remove(u.owner.ctx, deleted.id));
    const elsewhere = await createUser("elsewhere");
    const { group: other } = await createGroup(elsewhere);
    const foreign = await condition(elsewhere.ctx, other.id, "Foreign");
    const before = await entriesOf();
    const good = { type: "resolveCondition", conditionId: live.id };

    const cases: [unknown, string][] = [
      [
        { type: "updateCondition", conditionId: deleted.id, name: "Back" },
        "assistantActionService:conditionDeleted",
      ],
      [{ type: "resolveCondition", conditionId: deleted.id }, "assistantActionService:conditionDeleted"],
      [
        { type: "updateCondition", conditionId: foreign.id, name: "Mine" },
        "assistantActionService:conditionNotFound",
      ],
      [{ type: "resolveCondition", conditionId: foreign.id }, "assistantActionService:conditionNotFound"],
      [{ type: "resolveCondition", conditionId: randomUUID() }, "assistantActionService:conditionNotFound"],
    ];
    for (const [bad, code] of cases) {
      expect(refusal(await run("caretaker", [good, bad])), JSON.stringify(bad)).toMatchObject({
        code,
        index: 1,
      });
    }

    // Nothing written: every condition as it was, no change entries.
    expect(ok(await recipientConditionService.getById(u.owner.ctx, live.id))).toMatchObject({
      status: "active",
    });
    expect(ok(await recipientConditionService.getById(u.owner.ctx, deleted.id))).toBeNull();
    expect(ok(await recipientConditionService.getById(elsewhere.ctx, foreign.id))).toMatchObject({
      name: "Foreign",
      status: "active",
    });
    expect(await entriesOf()).toEqual(before);
  });

  it("lets owners, admins and caretakers run a batch, and refuses viewers and outsiders", async () => {
    const { run, todosOf } = await setup();
    for (const who of ["owner", "admin", "caretaker"] as const)
      ok(await run(who, [{ type: "addTodo", title: `By ${who}` }]));
    expect((await todosOf()).map((t) => t.title).sort()).toEqual(["By admin", "By caretaker", "By owner"]);

    for (const who of ["viewer", "outsider"] as const)
      expect(refusal(await run(who, [{ type: "addTodo", title: "Nope" }]))).toMatchObject({
        code: "permissions:unauthorized",
        index: null,
      });
    expect(await todosOf()).toHaveLength(3);
  });

  it("keeps via out of reach of edits: a member's update can't set it", async () => {
    const { u, group, run } = await setup();
    const [[todoId]] = ok(await run("caretaker", [{ type: "addTodo", title: "Book a ride" }])).byAction as [
      [string],
    ];
    ok(await todoService.update(u.caretaker.ctx, todoId, { title: "Book a taxi" }));
    const todo = ok(await todoService.getById(u.viewer.ctx, todoId));
    expect(todo).toMatchObject({ title: "Book a taxi", via: VIA, groupId: group.id });
  });
});

describe("assistantActionService.run: dose ids", () => {
  const doseRows = async (entriesOf: () => Promise<(typeof timelineEntrySchema.$inferSelect)[]>) =>
    (await entriesOf()).filter((e) => e.kind === "dose");
  const detailsOf = (row: { details: unknown }) =>
    row.details as { medicationId: string; status: "given"; passId: string; passLogId: string };

  it("gives a pass's doses their slot ids and one derived round", async () => {
    const { recipient, evening, addMedication, run, entriesOf } = await setup();
    await addMedication("Metformin");
    await addMedication("Lisinopril");
    const occurredAt = minutesAgo(0);

    ok(await run("caretaker", [{ type: "givePass", passId: evening.id, occurredAt }]));

    const rows = await doseRows(entriesOf);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const details = detailsOf(row);
      expect(row.id).toBe(
        doseSlotIdFor(
          { ...details, scheduledFor: evening.time, occurredAt },
          { timeZone: recipient.timeZone, passTime: evening.time },
        ),
      );
    }
    const rounds = new Set(rows.map((row) => detailsOf(row).passLogId));
    expect(rounds.size).toBe(1);
    const today = dayInZone(new Date(occurredAt), recipient.timeZone);
    expect(
      [addDays(today, -1), today, addDays(today, 1)].map((d) => passRoundId(`pass:${evening.id}`, d)),
    ).toContain([...rounds][0]);
  });

  it("doesn't double a slot when a pass is given twice", async () => {
    const { evening, addMedication, run, entriesOf } = await setup();
    await addMedication("Metformin");
    ok(await run("caretaker", [{ type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]));

    const again = await run("admin", [{ type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]);

    expect(refusal(again).code).toBe("assistantActionService:nothingLeft");
    expect(await doseRows(entriesOf)).toHaveLength(1);
  });

  it("logs a pass once when two runs race, the loser told nothing is left", async () => {
    const { evening, addMedication, run, entriesOf } = await setup();
    await addMedication("Metformin");
    const occurredAt = minutesAgo(0);

    const results = await Promise.all([
      run("caretaker", [{ type: "givePass", passId: evening.id, occurredAt }]),
      run("admin", [{ type: "givePass", passId: evening.id, occurredAt }]),
    ]);

    const refused = results.flatMap((res) => (isError(res) ? [res.code] : []));
    expect(refused.length).toBeLessThanOrEqual(1);
    for (const code of refused) expect(code).toBe("assistantActionService:nothingLeft");
    expect((await doseRows(entriesOf)).filter((row) => !row.deletedAt)).toHaveLength(1);
  });

  it("takes a random id when the slot's id is on a deleted row", async () => {
    const { u, evening, addMedication, run, entriesOf } = await setup();
    await addMedication("Metformin");
    const first = ok(
      await run("caretaker", [{ type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]),
    );
    ok(await timelineEntryService.remove(u.caretaker.ctx, first.ids[0]!));

    const second = ok(
      await run("caretaker", [{ type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]),
    );

    expect(second.ids[0]).not.toBe(first.ids[0]);
    const rows = await doseRows(entriesOf);
    expect(rows.filter((row) => !row.deletedAt).map((row) => row.id)).toEqual(second.ids);
  });

  it("gives two passes of one batch separate rows", async () => {
    const { evening, addMedication, run, entriesOf } = await setup();
    await addMedication("Metformin");
    const occurredAt = minutesAgo(0);

    const res = ok(
      await run("caretaker", [
        { type: "givePass", passId: evening.id, occurredAt },
        { type: "givePass", passId: evening.id, occurredAt },
      ]),
    );

    expect(new Set(res.ids).size).toBe(2);
    expect(await doseRows(entriesOf)).toHaveLength(2);
  });

  it("leaves a dose naming no slot on a random id", async () => {
    const { addMedication, run, entriesOf, recipient } = await setup();
    const metformin = await addMedication("Metformin");
    const occurredAt = minutesAgo(1);
    const res = ok(
      await run("caretaker", [{ type: "logDose", medicationId: metformin.id, status: "given", occurredAt }]),
    );
    const [row] = await doseRows(entriesOf);
    expect(row!.id).toBe(res.ids[0]);
    expect(
      doseSlotIdFor({ ...detailsOf(row!), passId: null, occurredAt }, { timeZone: recipient.timeZone }),
    ).toBeNull();
  });
});

describe("assistantActionService.run: edits (connectors-2)", () => {
  // A fixed clock (the series of B-205/B-206): edits never depend on the time of day.
  const NOW = new Date("2026-11-18T19:00:00.000Z");
  const at = (iso: string) => new Date(iso).toISOString();

  const editSetup = async () => {
    const s = await setup();
    const runAt = (who: keyof typeof s.u, actions: unknown[]) =>
      assistantActionService.run(s.u[who].ctx, s.group.id, actions, { via: VIA, now: NOW });
    const make = async (action: Record<string, unknown>) => {
      const [[id]] = ok(await runAt("owner", [action])).byAction as [[string]];
      return id;
    };
    const pendingOf = async (id: string) =>
      getDb().select().from(noteUpdateSchema).where(eq(noteUpdateSchema.documentId, id));
    const docOf = async (id: string) =>
      (await getDb().select().from(noteDocumentSchema).where(eq(noteDocumentSchema.id, id)))[0];
    return { ...s, runAt, make, pendingOf, docOf };
  };

  it("appends lines at the end of a note, merging pending updates, the member in editors", async () => {
    const { u, group, runAt, make, pendingOf, docOf } = await editSetup();
    const noteId = await make({
      type: "addNote",
      title: "Visit prep",
      text: "Bring the pill box",
      occurredAt: at("2026-11-18T17:00:00Z"),
    });
    // The owner's device has typed a line that isn't compacted yet.
    const ydoc = ok(await noteDocumentService.currentDoc(u.owner.ctx, noteId));
    ok(
      await noteDocumentService.appendUpdate(u.owner.ctx, {
        id: randomUUID(),
        groupId: group.id,
        documentId: noteId,
        data: typeParagraph(ydoc, "Ask about the cough"),
      }),
    );
    ydoc.destroy();
    expect(await pendingOf(noteId)).toHaveLength(1);

    const res = ok(
      await runAt("caretaker", [
        {
          type: "appendToEntry",
          entryId: noteId,
          lines: [
            { text: "Questions for Dr. Lee" },
            { text: "Can the evening dose move earlier?", style: "bullet" },
            { text: "Is the dizziness from the new tablet?", style: "bullet" },
          ],
        },
      ]),
    );
    expect(res.byAction).toEqual([[noteId]]);

    // Compacted at once: both updates folded into the text, in order, nothing pending.
    expect(await pendingOf(noteId)).toEqual([]);
    const doc = (await docOf(noteId))!;
    expect(doc.text).toBe(
      [
        "Bring the pill box",
        "Ask about the cough",
        "Questions for Dr. Lee",
        "• Can the evening dose move earlier?",
        "• Is the dizziness from the new tablet?",
      ].join("\n"),
    );
    expect(Object.keys(doc.editors as Record<string, string>)).toEqual(
      expect.arrayContaining([u.owner.user.id, u.caretaker.user.id]),
    );
    expect(ok(await timelineEntryService.getById(u.viewer.ctx, noteId))?.body).toBe(doc.text);
    // The entry stays the owner's: an edit changes only its text.
    expect(ok(await timelineEntryService.getById(u.viewer.ctx, noteId))).toMatchObject({
      title: "Visit prep",
      createdBy: u.owner.user.id,
    });
  });

  it("makes an event's document when it has none", async () => {
    const { u, group, runAt, docOf } = await editSetup();
    // An event made in the app without notes yet: no document.
    const event = ok(
      await timelineEntryService.create(u.owner.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Cardiology follow-up",
        occurredAt: at("2026-11-24T18:00:00Z"),
        timeZone: "America/Los_Angeles",
      }),
    )!;
    expect(await docOf(event.id)).toBeUndefined();

    ok(
      await runAt("caretaker", [
        { type: "appendToEntry", entryId: event.id, lines: [{ text: "Bring the list" }] },
      ]),
    );
    const doc = (await docOf(event.id))!;
    expect(doc).toMatchObject({ subject: "entry", entryId: event.id, text: "Bring the list" });
    expect(Object.keys(doc.editors as Record<string, string>)).toEqual([u.caretaker.user.id]);
    expect(buildNoteDoc(doc.snapshot).getXmlFragment("default").length).toBe(1);
  });

  it("changes a title and a time, moving an event's end with its start", async () => {
    const { u, group, runAt, make } = await editSetup();
    const noteId = await make({
      type: "addNote",
      text: "Slept well",
      occurredAt: at("2026-11-18T15:00:00Z"),
    });
    const event = ok(
      await timelineEntryService.create(u.owner.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Dentist",
        occurredAt: at("2026-11-25T17:00:00Z"),
        endsAt: at("2026-11-25T18:00:00Z"),
        timeZone: "America/Los_Angeles",
      }),
    )!;

    const res = ok(
      await runAt("caretaker", [
        { type: "updateEntry", entryId: noteId, title: "Night" },
        {
          type: "updateEntry",
          entryId: event.id,
          title: "Dentist: cleaning",
          occurredAt: "2026-11-26T10:30:00-08:00",
        },
      ]),
    );
    expect(res.byAction).toEqual([[noteId], [event.id]]);
    expect(ok(await timelineEntryService.getById(u.viewer.ctx, noteId))).toMatchObject({
      title: "Night",
      body: "Slept well",
      updatedBy: u.caretaker.user.id,
    });
    const moved = ok(await timelineEntryService.getById(u.viewer.ctx, event.id))!;
    expect(moved.title).toBe("Dentist: cleaning");
    expect(new Date(moved.occurredAt).toISOString()).toBe("2026-11-26T18:30:00.000Z");
    expect(new Date(moved.endsAt!).toISOString()).toBe("2026-11-26T19:30:00.000Z");
    expect(moved.via).toBeNull();
  });

  it("refuses too much text, viewers, deleted entries, symptoms and other groups' ids", async () => {
    const { u, runAt, make, entriesOf, docOf } = await editSetup();
    const noteId = await make({ type: "addNote", text: "Original", occurredAt: at("2026-11-18T15:00:00Z") });
    const symptomId = await make({
      type: "logSymptom",
      name: "Headache",
      occurredAt: at("2026-11-18T15:00:00Z"),
    });
    const goneId = await make({ type: "addNote", text: "Gone", occurredAt: at("2026-11-18T15:00:00Z") });
    ok(await timelineEntryService.remove(u.owner.ctx, goneId));
    const elsewhere = await createUser("elsewhere");
    const { group: other } = await createGroup(elsewhere);
    const [[otherNote]] = ok(
      await assistantActionService.run(
        elsewhere.ctx,
        other.id,
        [{ type: "addNote", text: "Not yours", occurredAt: at("2026-11-18T15:00:00Z") }],
        { via: VIA, now: NOW },
      ),
    ).byAction as [[string]];
    const before = await entriesOf();
    const append = (entryId: string, lines: unknown[] = [{ text: "More" }]) => ({
      type: "appendToEntry",
      entryId,
      lines,
    });

    const cases: [unknown, string, unknown?][] = [
      [
        append(
          noteId,
          Array.from({ length: 51 }, (_, i) => ({ text: `Line ${i}` })),
        ),
        "assistantActionService:invalid",
        [expect.objectContaining({ path: "lines" })],
      ],
      [
        append(noteId, [{ text: "x".repeat(3_000) }, { text: "y".repeat(2_500) }]),
        "assistantActionService:invalid",
        [{ path: "lines", message: "At most 5,000 characters at a time" }],
      ],
      [{ type: "updateEntry", entryId: noteId }, "assistantActionService:invalid"],
      [append(goneId), "assistantActionService:entryDeleted"],
      [{ type: "updateEntry", entryId: goneId, title: "Back" }, "assistantActionService:entryDeleted"],
      [append(symptomId), "assistantActionService:notEditable"],
      [{ type: "updateEntry", entryId: symptomId, title: "Migraine" }, "assistantActionService:notEditable"],
      [append(otherNote), "assistantActionService:entryNotFound"],
      [{ type: "updateEntry", entryId: otherNote, title: "Mine" }, "assistantActionService:entryNotFound"],
      [append(randomUUID()), "assistantActionService:entryNotFound"],
    ];
    for (const [bad, code, issues] of cases) {
      const res = refusal(await runAt("caretaker", [append(noteId, [{ text: "Fine" }]), bad]));
      expect(res, JSON.stringify(bad).slice(0, 200)).toMatchObject({ code, index: 1 });
      if (issues) expect(res.issues).toEqual(issues);
    }
    expect(refusal(await runAt("viewer", [append(noteId)]))).toMatchObject({
      code: "permissions:unauthorized",
      index: null,
    });

    // Nothing written: the note's text and every entry as they were.
    expect((await docOf(noteId))?.text).toBe("Original");
    expect(await entriesOf()).toEqual(before);
    expect((await docOf(otherNote))?.text).toBe("Not yours");
  });
});
