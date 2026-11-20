import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { getDb } from "../db";
import {
  FUTURE_DATE_MESSAGE,
  noteDocumentSchema,
  taskSchema,
  timelineEntryProviderSchema,
  timelineEntrySchema,
} from "../db/schema";
import { isError } from "../errors";
import {
  assistantActionService,
  medicationPassService,
  medicationService,
  providerService,
  taskService,
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
  const u = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
  };
  const { group, recipient } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const [morning, evening] = ok(await medicationPassService.list(u.owner.ctx, { groupId: group.id })).data;
  if (!morning || !evening) throw new Error("no default passes");
  const addMedication = async (name: string) =>
    ok(
      await medicationService.create(u.caretaker.ctx, {
        groupId: group.id,
        name,
        strength: "500 mg",
        schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
      }),
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
  const tasksOf = async () => getDb().select().from(taskSchema).where(eq(taskSchema.groupId, group.id));
  return { u, group, recipient, morning, evening, addMedication, provider, run, entriesOf, tasksOf };
};

const refusal = (res: unknown) => {
  if (!isError(res)) throw new Error(`expected a refusal, got ${JSON.stringify(res)}`);
  return { code: res.code, index: res.meta.index, issues: res.meta.issues };
};

describe("assistantActionService.run", () => {
  it("writes each action as quick entry would, carrying via", async () => {
    const { u, group, recipient, evening, addMedication, provider, run, entriesOf, tasksOf } = await setup();
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
          type: "addTask",
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
    const [[vital], [symptom], [dose], passDoses, [note], [event], [taskId]] = res.byAction as [
      [string],
      [string],
      [string],
      string[],
      [string],
      [string],
      [string],
    ];
    for (const id of res.ids.filter((id) => id !== taskId)) {
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

    const tasks = await tasksOf();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: taskId,
      title: "Pick up prescription",
      assigneeId: u.caretaker.user.id,
      dueOn: "2026-12-01",
      via: VIA,
      createdBy: u.caretaker.user.id,
    });
  });

  it("refuses a batch with one bad action, writing nothing and naming it", async () => {
    const { u, group, evening, addMedication, run, entriesOf, tasksOf } = await setup();
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
    const task = { type: "addTask", title: "Call the pharmacy" };

    const cases: [unknown, string, unknown?][] = [
      [
        { type: "logDose", medicationId: metformin.id, status: "given", occurredAt: inHours(2) },
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
      [{ type: "addTask", title: "Call", assigneeId: u.outsider.user.id }, "taskService:assigneeNotMember"],
    ];
    for (const [bad, code, issues] of cases) {
      const res = refusal(await run("caretaker", [good, task, bad]));
      expect(res, JSON.stringify(bad)).toMatchObject({ code, index: 2 });
      if (issues) expect(res.issues).toEqual(issues);
    }
    expect((await entriesOf()).length).toBe(before);
    expect(await tasksOf()).toEqual([]);

    // A pass with nothing left: the second Given all in one batch plans from the same state, so
    // it's the next batch that's refused.
    ok(await run("caretaker", [{ type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]));
    expect(
      refusal(
        await run("caretaker", [good, { type: "givePass", passId: evening.id, occurredAt: minutesAgo(0) }]),
      ),
    ).toMatchObject({ code: "assistantActionService:nothingLeft", index: 1 });
  });

  it("lets owners, admins and caretakers run a batch, and refuses viewers and outsiders", async () => {
    const { run, tasksOf } = await setup();
    for (const who of ["owner", "admin", "caretaker"] as const)
      ok(await run(who, [{ type: "addTask", title: `By ${who}` }]));
    expect((await tasksOf()).map((t) => t.title).sort()).toEqual(["By admin", "By caretaker", "By owner"]);

    for (const who of ["viewer", "outsider"] as const)
      expect(refusal(await run(who, [{ type: "addTask", title: "Nope" }]))).toMatchObject({
        code: "permissions:unauthorized",
        index: null,
      });
    expect(await tasksOf()).toHaveLength(3);
  });

  it("keeps via out of reach of edits: a member's update can't set it", async () => {
    const { u, group, run } = await setup();
    const [[taskId]] = ok(await run("caretaker", [{ type: "addTask", title: "Book a ride" }])).byAction as [
      [string],
    ];
    ok(await taskService.update(u.caretaker.ctx, taskId, { title: "Book a taxi" }));
    const task = ok(await taskService.getById(u.viewer.ctx, taskId));
    expect(task).toMatchObject({ title: "Book a taxi", via: VIA, groupId: group.id });
  });
});
