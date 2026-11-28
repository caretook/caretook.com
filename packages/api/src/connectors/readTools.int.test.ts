import type { AuthUser } from "@caretook/data";

import {
  careGroupInviteService,
  careGroupService,
  careRecipientDetailsService,
  careRecipientService,
  dueDoses,
  duePasses,
  entryTodoService,
  getDb,
  medicationPassService,
  medicationService,
  memberSharingService,
  noteDocumentService,
  normalizeSchedule,
  providerService,
  recipientAllergyService,
  recipientConditionService,
  recordTagService,
  SYSTEM_USER,
  tagService,
  timelineEntryModel,
  todoService,
  timelineEntryService,
  userContactService,
} from "@caretook/data";
import { medicationChangeId, REMOVED_PASS } from "@caretook/data/schema";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../../data/test/fixtures";
import { callTool, connectAssistant, enablePasswordSignIn, mcpHandler } from "./testing";
import { CONNECTOR_TOOLS } from "./tools";

// The read tools beyond group_overview and list_timeline, through /mcp with
// real tokens: each in its group's scope, never another group's, paged and
// capped, in the recipient's offset. A sweep over every read tool checks that
// nothing private leaves. All data is fictional.

const handlerAt = (now?: Date) => mcpHandler(now ? { now: () => now } : {});

type Who = Awaited<ReturnType<typeof createUser>>;

const world = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  for (const who of [owner, caretaker, viewer]) await enablePasswordSignIn(who.user.id);
  const { group, recipient } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  ok(
    await careGroupService.update(owner.ctx, {
      filter: { id: { type: "eq", value: group.id } },
      data: { connectorsEnabled: true },
    }),
  );
  // A second group of the same owner, with data that must never show in the first.
  const second = await createGroup(owner);
  const connect = async (who: Who, scope: "read" | "readWrite" = "read") =>
    (await connectAssistant({ email: who.user.email, groupId: group.id, scope })).tokens.access_token;
  return { owner, caretaker, viewer, group, recipient, second, connect };
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const hoursAhead = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
const OFFSET = /-0[78]:00$/;

const addEntry = (
  ctx: { authUser: AuthUser },
  groupId: string,
  entry: Record<string, unknown> & { kind: string },
) =>
  timelineEntryService.create(ctx, {
    groupId,
    timeZone: "America/Los_Angeles",
    occurredAt: hoursAgo(1),
    ...entry,
  } as never);

const addMedication = async (
  ctx: { authUser: AuthUser },
  groupId: string,
  overrides: Record<string, unknown> = {},
  opts: { changedAt?: string } = {},
) =>
  ok(
    await medicationService.create(
      ctx,
      {
        groupId,
        name: "Lisinopril",
        strength: "10 mg",
        form: "tablet",
        dose: "1 tablet",
        schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
        ...overrides,
      } as never,
      opts,
    ),
  )!;

describe("read tools", { timeout: 60_000 }, () => {
  it("latest_vitals: the newest reading of each type, in the member's units, never another group's", async () => {
    const handler = handlerAt();
    const w = await world();
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "vital",
        occurredAt: hoursAgo(30),
        details: { readings: [{ type: "bloodPressure", systolic: 150, diastolic: 95 }] },
      }),
    );
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "vital",
        occurredAt: hoursAgo(5),
        details: {
          readings: [
            { type: "bloodPressure", systolic: 128, diastolic: 82 },
            { type: "temperature", value: 37 },
          ],
        },
      }),
    );
    ok(
      await addEntry(w.owner.ctx, w.second.group.id, {
        kind: "vital",
        details: { readings: [{ type: "heartRate", value: 99 }] },
      }),
    );
    const token = await w.connect(w.viewer);
    const result = await callTool(handler, token, "latest_vitals");
    const vitals = result.structuredContent.vitals as { type: string; text: string; takenAt: string }[];
    expect(vitals.map((v) => v.type).sort()).toEqual(["bloodPressure", "temperature"]);
    expect(vitals.find((v) => v.type === "bloodPressure")?.text).toBe("BP 128/82 mmHg");
    expect(vitals.find((v) => v.type === "temperature")?.text).toMatch(/98\.6 °F/);
    for (const v of vitals) expect(v.takenAt).toMatch(OFFSET);
    expect(result.content[0]?.text).toContain("BP 128/82 mmHg");
  });

  it("search: entries, providers and medications in scope, capped at 25, never another group's", async () => {
    const handler = handlerAt();
    const w = await world();
    await addMedication(w.caretaker.ctx, w.group.id, { name: "Zorbitol" });
    await addMedication(w.owner.ctx, w.second.group.id, { name: "Zorbitol Other" });
    ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "clinician",
        name: "Dr. Zorbin",
      }),
    );
    for (let i = 0; i < 30; i++)
      ok(
        await addEntry(w.caretaker.ctx, w.group.id, {
          kind: "symptom",
          occurredAt: hoursAgo(i + 2),
          details: { name: "Zorbing cough", severity: 2 },
        }),
      );
    ok(
      await addEntry(w.owner.ctx, w.second.group.id, {
        kind: "symptom",
        details: { name: "Zorbing elsewhere", severity: 1 },
      }),
    );
    const token = await w.connect(w.viewer);

    const capped = await callTool(handler, token, "search", { q: "zorb", limit: 25 });
    const found = capped.structuredContent as {
      entries: { occurredAt: string; title: string }[];
      providers: { title: string }[];
      medications: { title: string }[];
      nextCursor: string | null;
    };
    expect(found.entries).toHaveLength(25);
    expect(found.nextCursor).toBeTruthy();
    expect(found.entries[0]?.occurredAt).toMatch(OFFSET);
    expect(found.providers.map((p) => p.title)).toEqual(["Dr. Zorbin"]);
    expect(found.medications.map((m) => m.title)).toEqual(["Zorbitol 10 mg"]);
    expect(JSON.stringify(found)).not.toContain("elsewhere");
    expect(JSON.stringify(found)).not.toContain("Other");

    const more = await callTool(handler, token, "search", { q: "zorb", limit: 25, cursor: found.nextCursor });
    expect((more.structuredContent as typeof found).entries).toHaveLength(6); // the 30 symptoms and the medication's "started" entry

    // The cap holds even when asked for more, and the language works.
    const tooMany = await callTool(handler, token, "search", { q: "zorb", limit: 500 });
    expect(tooMany.isError).toBe(true);
    const phrase = await callTool(handler, token, "search", {
      q: '"zorbing cough" -elsewhere',
      scopes: ["entry"],
    });
    expect((phrase.structuredContent as typeof found).entries.length).toBeGreaterThan(0);
    const none = await callTool(handler, token, "search", { q: "-zorb" });
    expect(none.content[0]?.text).toBe("Nothing matches.");
  });

  it("list_medications: current by default, past on request, paged, with the schedule as it reads", async () => {
    const handler = handlerAt();
    const w = await world();
    const pharmacy = ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "pharmacy",
        name: "Corner Pharmacy",
      }),
    )!;
    const passes = ok(await medicationPassService.list(w.owner.ctx, { groupId: w.group.id })).data;
    const morning = passes.find((p) => p.name === "Morning")!;
    await addMedication(w.caretaker.ctx, w.group.id, {
      name: "Aspirin",
      type: "otc",
      schedule: { type: "scheduled", slots: [{ passId: morning.id }] },
      pharmacyId: pharmacy.id,
      reason: "Heart",
    });
    await addMedication(w.caretaker.ctx, w.group.id, {
      name: "Ibuprofen",
      schedule: { type: "asNeeded", maxPerDay: 4 },
    });
    const old = await addMedication(w.caretaker.ctx, w.group.id, { name: "Amoxicillin" });
    ok(
      await medicationService.update(w.caretaker.ctx, old.id, {
        status: "discontinued",
        stoppedOn: "2026-11-01",
        stopReason: "sideEffects",
      } as never),
    );
    await addMedication(w.owner.ctx, w.second.group.id, { name: "Elsewhere" });
    const token = await w.connect(w.viewer);

    const current = await callTool(handler, token, "list_medications");
    const meds = current.structuredContent.medications as {
      title: string;
      schedule: string;
      pharmacy: { name: string } | null;
      maxPerDay: number | null;
      type: string | null;
    }[];
    expect(meds.map((m) => m.title)).toEqual(["Aspirin 10 mg", "Ibuprofen 10 mg"]);
    expect(meds[0]).toMatchObject({ schedule: "Morning", pharmacy: { name: "Corner Pharmacy" } });
    expect(meds[1]).toMatchObject({ schedule: "As needed, up to 4 a day", maxPerDay: 4 });
    // The type: the stored value (null when not set) in the data, its label in the text line.
    expect(meds.map((m) => m.type)).toEqual(["otc", null]);
    const lines = current.content[0]!.text.split("\n");
    expect(lines.find((l: string) => l.includes("Aspirin"))).toContain("Aspirin 10 mg · Over the counter ·");
    expect(lines.find((l: string) => l.includes("Ibuprofen"))).not.toMatch(/Over the counter|Type not set/);

    const all = await callTool(handler, token, "list_medications", { includePast: true, limit: 2 });
    const first = all.structuredContent as { medications: { title: string }[]; nextCursor: string };
    expect(first.medications.map((m) => m.title)).toEqual(["Aspirin 10 mg", "Ibuprofen 10 mg"]);
    const rest = await callTool(handler, token, "list_medications", {
      includePast: true,
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(rest.structuredContent.medications).toEqual([
      expect.objectContaining({
        title: "Amoxicillin 10 mg",
        status: "discontinued",
        stopReason: "sideEffects",
      }),
    ]);
    expect(rest.structuredContent.nextCursor).toBeNull();
    expect(JSON.stringify([current, all, rest])).not.toContain("Elsewhere");
  });

  it("list_medications: a deleted pass, its name scrubbed, reads as Removed med time in an old schedule (B-1049)", async () => {
    const handler = handlerAt();
    const w = await world();
    const passes = ok(await medicationPassService.list(w.owner.ctx, { groupId: w.group.id })).data;
    const morning = passes.find((p) => p.name === "Morning")!;
    const evening = passes.find((p) => p.name === "Evening")!;
    const med = await addMedication(w.caretaker.ctx, w.group.id, {
      name: "Metformin",
      strength: "500 mg",
      schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
    });
    ok(await medicationPassService.remove(w.caretaker.ctx, evening.id));
    const gone = ok(
      await medicationPassService.list(w.owner.ctx, { groupId: w.group.id, includeDeleted: true }),
    ).data.find((p) => p.id === evening.id)!;
    expect(gone.name).toBe("");
    // An old schedule still naming the deleted pass (one stored before deletes
    // moved a pass's slots to times of their own).
    await getDb().$client.query(`UPDATE medication SET schedule = $1 WHERE id = $2`, [
      JSON.stringify({ type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] }),
      med.id,
    ]);
    const token = await w.connect(w.viewer);

    const out = await callTool(handler, token, "list_medications");
    const meds = out.structuredContent.medications as { title: string; schedule: string }[];
    expect(meds).toEqual([
      expect.objectContaining({ title: "Metformin 500 mg", schedule: `Morning and ${REMOVED_PASS}` }),
    ]);
    const line = out.content[0]!.text.split("\n").find((l: string) => l.includes("Metformin"))!;
    expect(line).toContain(`· Morning and ${REMOVED_PASS}`);
    expect(line).not.toMatch(/·\s*·|and\s*(·|$)|,\s*and|\band and\b/);
  });

  it("list_timeline: medication changes read in full (what changed, before and after), and long text isn't cut", async () => {
    const handler = handlerAt();
    const w = await world();
    const med = await addMedication(w.caretaker.ctx, w.group.id, { name: "Metoprolol", strength: "25 mg" });
    ok(
      await medicationService.update(w.caretaker.ctx, med.id, {
        dose: "2 tablets",
        schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
      } as never),
    );
    ok(
      await medicationService.update(w.caretaker.ctx, med.id, {
        status: "discontinued",
        stoppedOn: "2026-11-01",
        stopReason: "sideEffects",
        stopNote: "Dizzy on standing",
      } as never),
    );
    const passes = ok(await medicationPassService.list(w.owner.ctx, { groupId: w.group.id })).data;
    const morning = passes.find((p) => p.name === "Morning")!;
    ok(await medicationPassService.update(w.caretaker.ctx, morning.id, { time: "08:30" }));
    const longNote = `Note start. ${"Slept badly and ate little. ".repeat(20)}Note end.`;
    const longDose = `Dose start. ${"Took it with applesauce. ".repeat(12)}Dose end.`;
    expect(longNote.length).toBeGreaterThan(280);
    const note = ok(await addEntry(w.caretaker.ctx, w.group.id, { kind: "note" }))!;
    ok(await noteDocumentService.create(w.caretaker.ctx, { id: note.id, groupId: w.group.id }));
    ok(
      await noteDocumentService.appendUpdate(w.caretaker.ctx, {
        id: randomUUID(),
        groupId: w.group.id,
        documentId: note.id,
        data: typeParagraph(newYDoc(), longNote),
      }),
    );
    ok(await noteDocumentService.compact(note.id));
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "dose",
        details: { medicationId: med.id, status: "given", amount: "2 tablets", note: longDose },
      }),
    );

    const token = await w.connect(w.viewer);
    const result = await callTool(handler, token, "list_timeline", {
      kinds: ["medicationChange", "note", "dose"],
    });
    const lines = result.content[0]!.text.split("\n");
    const changes = lines.filter((l) => l.includes(" medicationChange "));
    expect(changes.some((l) => /Metoprolol 25 mg: Started/.test(l))).toBe(true);
    expect(changes.some((l) => l.includes("Metoprolol 25 mg: Changed dose 1 tablet → 2 tablets"))).toBe(true);
    expect(changes.some((l) => l.includes("added 20:00"))).toBe(true);
    expect(
      changes.some((l) =>
        l.includes("Metoprolol 25 mg: Discontinued: side effects; note: Dizzy on standing"),
      ),
    ).toBe(true);
    expect(changes.some((l) => l.includes("Morning moved 8:00 → 8:30"))).toBe(true);
    expect(result.content[0]!.text).toContain(longNote);
    expect(result.content[0]!.text).toContain(longDose);
  });

  it("list_timeline: condition changes in full (added, changed, resolved, reactivated)", async () => {
    const handler = handlerAt(new Date());
    const w = await world();
    const c = ok(
      await recipientConditionService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        name: "Asthma",
        sinceYear: 2015,
      }),
    )!;
    ok(
      await recipientConditionService.update(w.caretaker.ctx, c.id, {
        sinceYear: 2014,
        note: "Inhaler as needed",
      }),
    );
    ok(await recipientConditionService.resolve(w.caretaker.ctx, c.id));
    ok(await recipientConditionService.reactivate(w.caretaker.ctx, c.id));
    const token = await w.connect(w.viewer);
    const result = await callTool(handler, token, "list_timeline", { kinds: ["conditionChange"] });
    const lines = result.content[0]!.text.split("\n").filter((l) => l.includes(" conditionChange "));
    expect(lines).toHaveLength(4);
    const has = (s: string) => lines.some((l) => l.includes(s));
    expect(has("Added Asthma: Since 2015")).toBe(true);
    expect(has("Changed Asthma: Since: 2015 → 2014; Note: none → Inhaler as needed")).toBe(true);
    expect(has("Resolved Asthma")).toBe(true);
    expect(has("Reactivated Asthma")).toBe(true);
  });

  it("todays_doses: leaves out the past slot of a medication added today", async () => {
    // 15:00 in Los Angeles, the group's zone, ahead of the rows' real creation time.
    const clock = new Date("2030-06-12T22:00:00.000Z");
    const handler = handlerAt(clock);
    const w = await world();
    const med = await addMedication(
      w.caretaker.ctx,
      w.group.id,
      {
        name: "Aspirin",
        strength: null,
        schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
      },
      { changedAt: "2030-06-12T21:59:00.000Z" },
    );
    // Keyed by the device's 14:59 there, but dated by the service no later than
    // the real clock (B-295), before this one: put it at 14:59 through the model.
    ok(
      await timelineEntryModel.update({
        authUser: SYSTEM_USER,
        filter: { id: { type: "eq", value: medicationChangeId(med.id, "2030-06-12T21:59:00.000Z") } },
        data: { occurredAt: "2030-06-12T21:59:00.000Z" },
      }),
    );
    const token = await w.connect(w.viewer);
    const result = await callTool(handler, token, "todays_doses");
    const out = result.structuredContent as {
      passes: { slots: { medicationId: string; time: string; state: string }[] }[];
    };
    expect(
      out.passes
        .flatMap((p) => p.slots)
        .filter((s) => s.medicationId === med.id)
        .map((s) => [s.time, s.state]),
    ).toEqual([["20:00", "upcoming"]]);
  });

  // On a fixed clock, so the doses written minutes before it are today in the
  // recipient's zone at any hour the suite runs (B-642: on the real clock, a run
  // from 00:00 to 00:10 Los Angeles put the given dose on yesterday). The doses
  // are written through the model, as the service refuses a time ahead of the
  // real clock.
  const agreesWithTheCore = async (now: Date) => {
    const handler = handlerAt(now);
    const w = await world();
    const passes = ok(await medicationPassService.list(w.owner.ctx, { groupId: w.group.id })).data;
    const morning = passes.find((p) => p.name === "Morning")!;
    const evening = passes.find((p) => p.name === "Evening")!;
    // Started days before the clock, so both slots are on its day's schedule.
    const daysBefore = { changedAt: new Date(now.getTime() - 72 * 60 * 60_000).toISOString() };
    const aspirin = await addMedication(
      w.caretaker.ctx,
      w.group.id,
      {
        name: "Aspirin",
        strength: null,
        schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
      },
      daysBefore,
    );
    const pain = await addMedication(
      w.caretaker.ctx,
      w.group.id,
      { name: "Ibuprofen", strength: null, schedule: { type: "asNeeded", maxPerDay: 3 } },
      daysBefore,
    );
    await addMedication(w.owner.ctx, w.second.group.id, { name: "Elsewhere" });
    const addDose = async (minutesBefore: number, details: Record<string, unknown>) =>
      ok(
        await timelineEntryModel.create({
          ...w.caretaker.ctx,
          data: {
            groupId: w.group.id,
            recipientId: w.recipient.id,
            kind: "dose",
            occurredAt: new Date(now.getTime() - minutesBefore * 60_000).toISOString(),
            timeZone: "America/Los_Angeles",
            details: details as never,
          },
        }),
      );
    // Four and two minutes before the clock: today even at 00:05.
    await addDose(4, {
      medicationId: aspirin.id,
      status: "given",
      amount: "1 tablet",
      scheduledFor: "08:00",
      passId: morning.id,
    });
    await addDose(2, { medicationId: pain.id, status: "given", amount: "1 tablet" });
    const token = await w.connect(w.viewer);
    const result = await callTool(handler, token, "todays_doses");
    const out = result.structuredContent as {
      day: string;
      timeZone: string;
      passes: {
        name: string;
        time: string;
        state: string;
        at: string;
        slots: { medicationId: string; state: string }[];
      }[];
      missed: unknown[];
      asNeeded: { medicationId: string; countToday: number; maxPerDay: number; left: number }[];
    };

    // The same core over the same rows, as the device's Today runs it.
    const meds = ok(await medicationService.list(w.owner.ctx, { groupId: w.group.id })).data.map((m) => ({
      ...m,
      schedule: normalizeSchedule(m.schedule)!,
    }));
    const doses = ok(
      await timelineEntryService.list(w.owner.ctx, { groupId: w.group.id, kinds: ["dose"], limit: 50 }),
    ).data.map((e) => ({
      id: e.id,
      occurredAt: e.occurredAt,
      details: e.details as never,
      createdBy: e.createdBy,
    }));
    const allPasses = ok(
      await medicationPassService.list(w.owner.ctx, { groupId: w.group.id, includeDeleted: true }),
    ).data;
    const due = dueDoses({
      medications: meds,
      passes: allPasses,
      doses,
      now,
      timeZone: "America/Los_Angeles",
    });
    const expected = duePasses(due, allPasses);

    expect(out.timeZone).toBe("America/Los_Angeles");
    expect(out.day).toBe(due.day);
    expect(out.passes.map((p) => [p.name, p.time, p.state])).toEqual(
      expected.map((p) => [p.name, p.time, p.state]),
    );
    expect(out.passes.map((p) => p.slots.map((s) => [s.medicationId, s.state]))).toEqual(
      expected.map((p) => p.slots.map((s) => [s.medication.id, s.state])),
    );
    expect(out.passes.flatMap((p) => p.slots).some((s) => s.state === "given")).toBe(true);
    for (const p of out.passes) expect(p.at).toMatch(OFFSET);
    expect(out.asNeeded).toEqual([
      expect.objectContaining({ medicationId: pain.id, countToday: 1, maxPerDay: 3, left: 2 }),
    ]);
    expect(out.missed.length).toBe(due.missed.length);
    expect(JSON.stringify(result)).not.toContain("Elsewhere");
  };

  it("todays_doses: agrees with the app's due-doses core for the same data and now, in the recipient's zone", async () => {
    // 12:00 in Los Angeles.
    await agreesWithTheCore(new Date("2030-06-12T19:00:00.000Z"));
  });

  it("todays_doses: agrees with the core at 00:05 in the recipient's zone, the given dose still today", async () => {
    // 00:05 in Los Angeles: a dose ten minutes before would be yesterday.
    await agreesWithTheCore(new Date("2030-06-12T07:05:00.000Z"));
  });

  it("todays_doses: each med time carries its id, in the result and the text, and give_pass takes it", async () => {
    // The real clock, as give_pass writes now.
    const handler = handlerAt();
    const w = await world();
    const [morning, evening] = ok(
      await medicationPassService.list(w.owner.ctx, { groupId: w.group.id }),
    ).data;
    // Started days ago, so Evening's slot is on today's schedule at any hour the test runs.
    const daysAgo = { changedAt: hoursAgo(72) };
    await addMedication(
      w.caretaker.ctx,
      w.group.id,
      {
        name: "Metformin",
        strength: "500 mg",
        schedule: { type: "scheduled", slots: [{ passId: morning!.id }, { passId: evening!.id }] },
      },
      daysAgo,
    );
    // A time of its own: a pass with no id.
    await addMedication(
      w.caretaker.ctx,
      w.group.id,
      { name: "Aspirin", strength: null, schedule: { type: "scheduled", slots: [{ time: "13:00" }] } },
      daysAgo,
    );
    const token = await w.connect(w.caretaker, "readWrite");
    const result = await callTool(handler, token, "todays_doses");
    const out = result.structuredContent as {
      passes: { passId: string | null; name: string; time: string }[];
    };
    const byName = new Map(out.passes.map((p) => [p.name, p]));
    expect(byName.get("Morning")?.passId).toBe(morning!.id);
    expect(byName.get("Evening")?.passId).toBe(evening!.id);
    expect(out.passes.find((p) => p.time === "13:00")?.passId).toBeNull();
    const text = result.content[0]!.text;
    expect(text).toContain(`Evening (20:00, `);
    expect(text).toContain(`, id ${evening!.id}):`);
    expect(text).toContain(`, id ${morning!.id}):`);

    const pass = await callTool(handler, token, "give_pass", { passId: byName.get("Evening")!.passId });
    expect(pass.isError).toBeUndefined();
    expect(pass.structuredContent.entryIds).toHaveLength(1);
  });

  describe("dose_schedule", () => {
    // 12:00 in Los Angeles (PDT), the group's zone: today is Wednesday 2030-06-12.
    const clock = new Date("2030-06-12T19:00:00.000Z");
    type Schedule = {
      timeZone: string;
      from: string;
      days: {
        day: string;
        weekday: string;
        rounds: {
          name: string;
          time: string;
          at: string;
          medications: { medicationId: string; medication: string; amount: string | null }[];
        }[];
      }[];
      asNeeded: { medicationId: string; medication: string; maxPerDay: number | null }[];
    };
    const scheduleWorld = async () => {
      const w = await world();
      const passes = ok(await medicationPassService.list(w.owner.ctx, { groupId: w.group.id })).data;
      const morning = passes.find((p) => p.name === "Morning")!;
      const evening = passes.find((p) => p.name === "Evening")!;
      const metformin = await addMedication(w.caretaker.ctx, w.group.id, {
        name: "Metformin",
        strength: "500 mg",
        schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
      });
      const vitamin = await addMedication(w.caretaker.ctx, w.group.id, {
        name: "Vitamin D",
        strength: null,
        dose: "1 capsule",
        schedule: { type: "scheduled", slots: [{ time: "13:00" }] },
      });
      const pain = await addMedication(w.caretaker.ctx, w.group.id, {
        name: "Ibuprofen",
        strength: null,
        schedule: { type: "asNeeded", maxPerDay: 3 },
      });
      await addMedication(w.owner.ctx, w.second.group.id, { name: "Elsewhere" });
      return { ...w, metformin, vitamin, pain };
    };

    it("gives 7 days from today with the group's rounds, in the recipient's offset, to a viewer's read grant", async () => {
      const handler = handlerAt(clock);
      const w = await scheduleWorld();
      const token = await w.connect(w.viewer);
      const result = await callTool(handler, token, "dose_schedule");
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as Schedule;
      expect(out.timeZone).toBe("America/Los_Angeles");
      expect(out.from).toBe("2030-06-12");
      expect(out.days.map((d) => d.day)).toEqual([
        "2030-06-12",
        "2030-06-13",
        "2030-06-14",
        "2030-06-15",
        "2030-06-16",
        "2030-06-17",
        "2030-06-18",
      ]);
      expect(out.days[0]!.weekday).toBe("Wednesday");
      for (const d of out.days) {
        expect(d.rounds.map((r) => [r.name, r.time])).toEqual([
          ["Morning", "08:00"],
          ["Vitamin D", "13:00"],
          ["Evening", "20:00"],
        ]);
        expect(d.rounds.map((r) => r.medications.map((m) => m.medicationId))).toEqual([
          [w.metformin.id],
          [w.vitamin.id],
          [w.metformin.id],
        ]);
        for (const r of d.rounds) expect(r.at).toBe(`${d.day}T${r.time}:00-07:00`);
      }
      expect(out.days[0]!.rounds[0]!.medications[0]).toEqual({
        medicationId: w.metformin.id,
        medication: "Metformin 500 mg",
        amount: "1 tablet",
      });
      expect(out.asNeeded).toEqual([{ medicationId: w.pain.id, medication: "Ibuprofen", maxPerDay: 3 }]);
      const text = result.content[0]!.text;
      // The same rounds every day: one range.
      expect(text).toContain("Wednesday 2030-06-12 to Tuesday 2030-06-18:");
      expect(text).toContain("  Morning (08:00): Metformin 500 mg, 1 tablet");
      expect(text).toContain("  Vitamin D (13:00): Vitamin D, 1 capsule");
      expect(text).toContain("As needed: Ibuprofen (at most 3 a day).");
      expect(JSON.stringify(result)).not.toContain("Elsewhere");
    });

    it("from tomorrow for one day gives that day only", async () => {
      const handler = handlerAt(clock);
      const w = await scheduleWorld();
      const token = await w.connect(w.caretaker, "readWrite");
      const result = await callTool(handler, token, "dose_schedule", { from: "2030-06-13", days: 1 });
      const out = result.structuredContent as Schedule;
      expect(out.days.map((d) => [d.day, d.weekday, d.rounds.length])).toEqual([
        ["2030-06-13", "Thursday", 3],
      ]);
      expect(result.content[0]!.text).toContain("Thursday 2030-06-13:");
    });

    it("refuses more than 14 days, and a day before today, naming list_timeline", async () => {
      const handler = handlerAt(clock);
      const w = await scheduleWorld();
      const token = await w.connect(w.viewer);
      expect((await callTool(handler, token, "dose_schedule", { days: 15 })).isError).toBe(true);
      const past = await callTool(handler, token, "dose_schedule", { from: "2030-06-11" });
      expect(past.isError).toBe(true);
      expect(past.structuredContent).toMatchObject({
        error: {
          issues: [
            {
              path: "from",
              message: "The schedule is for today onward. Use list_timeline for doses already logged.",
            },
          ],
        },
      });
      expect(past.content[0]!.text).toContain("Use list_timeline for doses already logged.");
    });

    it("says so for a day with no scheduled doses", async () => {
      const handler = handlerAt(clock);
      const w = await world();
      const token = await w.connect(w.viewer);
      const result = await callTool(handler, token, "dose_schedule", { days: 2 });
      expect((result.structuredContent as Schedule).days.map((d) => d.rounds)).toEqual([[], []]);
      expect(result.content[0]!.text).toContain(
        "Wednesday 2030-06-12 to Thursday 2030-06-13:\n  No scheduled doses",
      );
    });
  });

  describe("past_doses", () => {
    // 12:00 in Los Angeles (PDT), the group's zone: today is Wednesday 2030-06-12.
    const clock = new Date("2030-06-12T19:00:00.000Z");
    type PastRecord = {
      timeZone: string;
      from: string;
      to: string;
      days: {
        day: string;
        weekday: string;
        rounds: {
          passId: string | null;
          name: string;
          time: string;
          slots: {
            medicationId: string;
            medication: string;
            amount: string | null;
            time: string;
            at: string;
            state: string;
            dose: { entryId: string; status: string; loggedAt: string; loggedBy: string | null } | null;
          }[];
        }[];
      }[];
    };
    /** "YYYY-MM-DD" at "HH:MM" Los Angeles (PDT) as an instant. */
    const atLa = (day: string, time: string) => new Date(`${day}T${time}:00-07:00`).toISOString();

    // Medications started ten days before the clock, so every day read has
    // their slots, and doses written through the model (the service refuses a
    // time ahead of the real clock).
    const recordWorld = async () => {
      const w = await world();
      const passes = ok(await medicationPassService.list(w.owner.ctx, { groupId: w.group.id })).data;
      const morning = passes.find((p) => p.name === "Morning")!;
      const evening = passes.find((p) => p.name === "Evening")!;
      const tenDaysBefore = { changedAt: new Date(clock.getTime() - 10 * 24 * 60 * 60_000).toISOString() };
      const metformin = await addMedication(
        w.caretaker.ctx,
        w.group.id,
        {
          name: "Metformin",
          strength: "500 mg",
          schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
        },
        tenDaysBefore,
      );
      const vitamin = await addMedication(
        w.caretaker.ctx,
        w.group.id,
        {
          name: "Vitamin D",
          strength: null,
          dose: "1 capsule",
          schedule: { type: "scheduled", slots: [{ time: "13:00" }] },
        },
        tenDaysBefore,
      );
      await addMedication(w.owner.ctx, w.second.group.id, { name: "Elsewhere" });
      const addDose = async (who: Who, occurredAt: string, details: Record<string, unknown>) =>
        ok(
          await timelineEntryModel.create({
            ...who.ctx,
            data: {
              groupId: w.group.id,
              recipientId: w.recipient.id,
              kind: "dose",
              occurredAt,
              timeZone: "America/Los_Angeles",
              details: details as never,
            },
          }),
        )!;
      const morningDose = (status: string) => ({
        medicationId: metformin.id,
        status,
        amount: "1 tablet",
        scheduledFor: "08:00",
        passId: morning.id,
      });
      const given = await addDose(w.caretaker, atLa("2030-06-10", "08:12"), morningDose("given"));
      const skipped = await addDose(w.owner, atLa("2030-06-11", "08:20"), morningDose("skipped"));
      const today = await addDose(w.caretaker, atLa("2030-06-12", "08:05"), morningDose("given"));
      return { ...w, morning, evening, metformin, vitamin, given, skipped, today };
    };

    it("gives the 7 days ending today with each slot's state and who logged it, to a viewer's read grant", async () => {
      const handler = handlerAt(clock);
      const w = await recordWorld();
      const token = await w.connect(w.viewer);
      const result = await callTool(handler, token, "past_doses");
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as PastRecord;
      expect(out.timeZone).toBe("America/Los_Angeles");
      expect([out.from, out.to]).toEqual(["2030-06-06", "2030-06-12"]);
      expect(out.days.map((d) => d.day)).toEqual([
        "2030-06-06",
        "2030-06-07",
        "2030-06-08",
        "2030-06-09",
        "2030-06-10",
        "2030-06-11",
        "2030-06-12",
      ]);
      expect(out.days.at(-1)!.weekday).toBe("Wednesday");
      const states = (day: string) =>
        out.days
          .find((d) => d.day === day)!
          .rounds.map((r) => [r.name, r.time, r.slots.map((s) => s.state).join(",")]);
      expect(states("2030-06-09")).toEqual([
        ["Morning", "08:00", "missed"],
        ["Vitamin D", "13:00", "missed"],
        ["Evening", "20:00", "missed"],
      ]);
      expect(states("2030-06-10")).toEqual([
        ["Morning", "08:00", "given"],
        ["Vitamin D", "13:00", "missed"],
        ["Evening", "20:00", "missed"],
      ]);
      expect(states("2030-06-11")[0]).toEqual(["Morning", "08:00", "skipped"]);
      // Today at 12:00: the later slots are upcoming, not missed.
      expect(states("2030-06-12")).toEqual([
        ["Morning", "08:00", "given"],
        ["Vitamin D", "13:00", "upcoming"],
        ["Evening", "20:00", "upcoming"],
      ]);

      const round = (day: string) => out.days.find((d) => d.day === day)!.rounds[0]!;
      expect(round("2030-06-10").passId).toBe(w.morning.id);
      expect(round("2030-06-10").slots[0]).toEqual({
        medicationId: w.metformin.id,
        medication: "Metformin 500 mg",
        amount: "1 tablet",
        time: "08:00",
        at: "2030-06-10T08:00:00-07:00",
        state: "given",
        dose: {
          entryId: w.given.id,
          status: "given",
          loggedAt: "2030-06-10T08:12:00-07:00",
          loggedBy: "caretaker",
        },
      });
      expect(round("2030-06-11").slots[0]!.dose).toMatchObject({ entryId: w.skipped.id, loggedBy: "owner" });
      for (const d of out.days)
        for (const r of d.rounds) for (const sl of r.slots) expect(sl.at).toMatch(OFFSET);

      const text = result.content[0]!.text;
      expect(text).toContain("Past doses, 2030-06-06 to 2030-06-12 (America/Los_Angeles):");
      expect(text).toContain(
        "Monday 2030-06-10:\n  Morning (08:00): Metformin 500 mg, 1 tablet: Given by caretaker at 8:12",
      );
      expect(text).toContain("  Morning (08:00): Metformin 500 mg, 1 tablet: Skipped by owner at 8:20");
      expect(text).toContain("  Vitamin D (13:00): Vitamin D, 1 capsule: Missed");
      expect(JSON.stringify(result)).not.toContain("Elsewhere");
    });

    it("from a day for two days gives those two days, and leaves out days after today", async () => {
      const handler = handlerAt(clock);
      const w = await recordWorld();
      const token = await w.connect(w.caretaker, "readWrite");
      const two = await callTool(handler, token, "past_doses", { from: "2030-06-10", days: 2 });
      const out = two.structuredContent as PastRecord;
      expect([out.from, out.to]).toEqual(["2030-06-10", "2030-06-11"]);
      expect(out.days.map((d) => [d.day, d.weekday])).toEqual([
        ["2030-06-10", "Monday"],
        ["2030-06-11", "Tuesday"],
      ]);
      const late = await callTool(handler, token, "past_doses", { from: "2030-06-11", days: 14 });
      expect((late.structuredContent as PastRecord).days.map((d) => d.day)).toEqual([
        "2030-06-11",
        "2030-06-12",
      ]);
    });

    it("says so for a day with no scheduled doses", async () => {
      const handler = handlerAt(clock);
      const w = await world();
      const token = await w.connect(w.viewer);
      const result = await callTool(handler, token, "past_doses", { from: "2030-06-12" });
      expect((result.structuredContent as PastRecord).days).toEqual([
        { day: "2030-06-12", weekday: "Wednesday", rounds: [] },
      ]);
      expect(result.content[0]!.text).toContain("Wednesday 2030-06-12:\n  No scheduled doses");
    });

    it("refuses a day after today, naming dose_schedule, and more than 90 days back", async () => {
      const handler = handlerAt(clock);
      const w = await world();
      const token = await w.connect(w.viewer);
      const ahead = await callTool(handler, token, "past_doses", { from: "2030-06-13" });
      expect(ahead.isError).toBe(true);
      expect(ahead.structuredContent).toMatchObject({
        error: {
          issues: [{ path: "from", message: "Past doses end today. Use dose_schedule for the days ahead." }],
        },
      });
      expect(ahead.content[0]!.text).toContain("dose_schedule");
      // 2030-03-14 is 90 days before; the day before it is too far.
      const far = await callTool(handler, token, "past_doses", { from: "2030-03-13" });
      expect(far.isError).toBe(true);
      expect(far.structuredContent).toMatchObject({
        error: { issues: [{ path: "from", message: "At most 90 days back." }] },
      });
      const edge = await callTool(handler, token, "past_doses", { from: "2030-03-14", days: 1 });
      expect(edge.isError).toBeUndefined();
      expect((await callTool(handler, token, "past_doses", { days: 15 })).isError).toBe(true);
    });
  });

  it("upcoming: events soonest first, in the offset, 30 days by default and 90 at most", async () => {
    const handler = handlerAt();
    const w = await world();
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "Cardiology",
        occurredAt: hoursAhead(50),
        place: "Heart Clinic",
      }),
    );
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "Dentist",
        occurredAt: hoursAhead(30),
      }),
    );
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "Last month",
        occurredAt: hoursAgo(24 * 40),
      }),
    );
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "In 45 days",
        occurredAt: hoursAhead(24 * 45),
      }),
    );
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "In 120 days",
        occurredAt: hoursAhead(24 * 120),
      }),
    );
    ok(
      await addEntry(w.owner.ctx, w.second.group.id, {
        kind: "event",
        title: "Elsewhere",
        occurredAt: hoursAhead(10),
      }),
    );
    const token = await w.connect(w.viewer);

    const month = await callTool(handler, token, "upcoming");
    const items = month.structuredContent.items as {
      title: string;
      kind: string;
      startsAt: string;
      place: string | null;
    }[];
    expect(items.map((i) => i.title)).toEqual(["Dentist", "Cardiology"]);
    expect(items.map((i) => i.kind)).toEqual(["event", "event"]);
    expect(items[1]?.place).toBe("Heart Clinic");
    for (const i of items) expect(i.startsAt).toMatch(OFFSET);

    const quarter = await callTool(handler, token, "upcoming", { days: 90 });
    expect((quarter.structuredContent.items as { title: string }[]).map((i) => i.title)).toEqual([
      "Dentist",
      "Cardiology",
      "In 45 days",
    ]);
    expect((await callTool(handler, token, "upcoming", { days: 91 })).isError).toBe(true);
    expect(JSON.stringify(quarter)).not.toContain("Elsewhere");
  });

  it("upcoming: lists open todos with a due day, overdue first, and no stored future note", async () => {
    const handler = handlerAt();
    const w = await world();
    const day = (offset: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
        new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
      );
    const todo = async (title: string, extra: Record<string, unknown> = {}) =>
      ok(await todoService.create(w.caretaker.ctx, { groupId: w.group.id, title, ...extra }))!;
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "Dentist",
        occurredAt: hoursAhead(30),
      }),
    );
    await todo("Late call", { dueOn: day(-3) });
    await todo("Order supplies", { dueOn: day(5), assigneeId: w.viewer.user.id });
    await todo("Too far", { dueOn: day(60) });
    await todo("No day");
    await todo("Weekly bins", {
      dueOn: day(2),
      dueTime: "19:00",
      repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
    });
    const finished = await todo("Done already", { dueOn: day(1) });
    ok(await todoService.complete(w.caretaker.ctx, finished.id));
    // A note stored ahead, from before notes were past-only, is never listed.
    ok(
      await timelineEntryModel.create({
        authUser: SYSTEM_USER,
        data: {
          groupId: w.group.id,
          recipientId: w.recipient.id,
          kind: "note",
          title: "Old reminder",
          occurredAt: hoursAhead(40),
          timeZone: "America/Los_Angeles",
        },
      }),
    );
    const token = await w.connect(w.viewer);

    const res = await callTool(handler, token, "upcoming");
    const items = res.structuredContent.items as {
      kind: string;
      title: string;
      overdue?: boolean;
      repeats?: string | null;
      dueOn?: string;
      assignee?: { id: string | null; name: string | null } | null;
    }[];
    expect(items.map((i) => i.title)).toEqual(["Late call", "Dentist", "Weekly bins", "Order supplies"]);
    expect(items.map((i) => i.kind)).toEqual(["todo", "event", "todo", "todo"]);
    expect(items[0]).toMatchObject({ overdue: true, dueOn: day(-3) });
    expect(items[2]?.repeats).toMatch(/^Every Mon/);
    expect(items[3]).toMatchObject({ overdue: false, repeats: null, assignee: { id: w.viewer.user.id } });
    const text = res.content.map((c) => c.text).join("\n");
    expect(text).toMatch(/- overdue .* todo: Late call/);
    expect(text).toMatch(/ event: Dentist/);
    expect(text).toMatch(/ todo: Weekly bins \(repeats: Every Mon/);
    for (const hidden of ["Too far", "No day", "Done already", "Old reminder"])
      expect(JSON.stringify(res)).not.toContain(hidden);

    expect(items.every((i) => i.kind !== "todo" || ("partOf" in i && i.partOf === null))).toBe(true);

    const listed = await callTool(handler, token, "list_todos");
    const byTitle = new Map(
      (listed.structuredContent.todos as { title: string; repeats: string | null }[]).map((t) => [
        t.title,
        t,
      ]),
    );
    expect(byTitle.get("Weekly bins")?.repeats).toMatch(/^Every Mon/);
    expect(byTitle.get("Late call")?.repeats).toBeNull();
  });

  it("upcoming: a subtask only when assigned or due before its parent, with its parent's title (todo-subtasks-3)", async () => {
    const handler = handlerAt();
    const w = await world();
    const day = (offset: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
        new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
      );
    const todo = async (title: string, extra: Record<string, unknown> = {}) =>
      ok(await todoService.create(w.caretaker.ctx, { groupId: w.group.id, title, ...extra }))!;
    const move = await todo("Get ready for the move", { dueOn: day(6) });
    await todo("Label the boxes", { parentId: move.id, dueOn: day(6) });
    await todo("Book the van", { parentId: move.id, dueOn: day(6), assigneeId: w.viewer.user.id });
    await todo("Pack the kitchen", { parentId: move.id, dueOn: day(3) });
    const someday = await todo("Sort the attic");
    await todo("Call the charity shop", { parentId: someday.id, dueOn: day(4) });
    const token = await w.connect(w.viewer);

    const res = await callTool(handler, token, "upcoming");
    const items = res.structuredContent.items as {
      title: string;
      partOf: { id: string; title: string } | null;
    }[];
    const listed = items.map((i) => [i.title, i.partOf?.title ?? null]);
    expect(listed.slice(0, 2)).toEqual([
      ["Pack the kitchen", "Get ready for the move"],
      ["Call the charity shop", "Sort the attic"],
    ]);
    // The same day, untimed: their order is by id.
    expect(listed.slice(2).sort()).toEqual([
      ["Book the van", "Get ready for the move"],
      ["Get ready for the move", null],
    ]);
    expect(items[0]?.partOf?.id).toBe(move.id);
    const text = res.content.map((c) => c.text).join("\n");
    expect(text).toMatch(/ todo: Book the van \(part of Get ready for the move\) \(/);
    expect(JSON.stringify(res)).not.toContain("Label the boxes");
  });

  it("list_todos: open by default in the app's order, done on request, paged, mine, never another group's", async () => {
    const handler = handlerAt();
    const w = await world();
    const todo = async (title: string, extra: Record<string, unknown> = {}) =>
      ok(await todoService.create(w.caretaker.ctx, { groupId: w.group.id, title, ...extra }))!;
    await todo("Undated");
    await todo("Overdue", { dueOn: "2020-01-02" });
    await todo("Mine", { assigneeId: w.viewer.user.id, dueOn: "2099-01-01", dueTime: "09:30" });
    await todo("Named", { assigneeName: "Rosa" });
    const finished = await todo("Finished");
    ok(await todoService.complete(w.caretaker.ctx, finished.id));
    ok(await todoService.create(w.owner.ctx, { groupId: w.second.group.id, title: "Elsewhere" }));
    const token = await w.connect(w.viewer);

    const open = await callTool(handler, token, "list_todos");
    const todos = open.structuredContent.todos as {
      title: string;
      state: string;
      assignee: { name: string | null } | null;
    }[];
    expect(todos.map((t) => [t.title, t.state])).toEqual([
      ["Overdue", "overdue"],
      ["Mine", "upcoming"],
      ["Named", "undated"],
      ["Undated", "undated"],
    ]);
    expect(todos[1]?.assignee?.name).toBe("viewer");
    expect(todos[2]?.assignee?.name).toBe("Rosa");

    const done = await callTool(handler, token, "list_todos", { status: "done" });
    expect(done.structuredContent.todos).toEqual([
      expect.objectContaining({ title: "Finished", state: "done", doneBy: "caretaker" }),
    ]);
    expect((done.structuredContent.todos as { doneAt: string }[])[0]?.doneAt).toMatch(OFFSET);
    const mine = await callTool(handler, token, "list_todos", { status: "all", mine: true });
    expect((mine.structuredContent.todos as { title: string }[]).map((t) => t.title)).toEqual(["Mine"]);
    const page = await callTool(handler, token, "list_todos", { status: "all", limit: 2 });
    expect(page.structuredContent.nextCursor).toBe("2");
    const page2 = await callTool(handler, token, "list_todos", { status: "all", limit: 2, cursor: "2" });
    expect(page2.structuredContent.todos).toHaveLength(2);
    expect(page2.structuredContent.nextCursor).toBe("4");
    const page3 = await callTool(handler, token, "list_todos", { status: "all", limit: 2, cursor: "4" });
    expect(page3.structuredContent.todos).toHaveLength(1);
    expect(page3.structuredContent.nextCursor).toBeNull();
    expect(JSON.stringify([open, done, page, page2])).not.toContain("Elsewhere");
  });

  it("list_todos: eventId is the first linked event, linkedEntryIds every live linked entry (planner-3)", async () => {
    const handler = handlerAt();
    const w = await world();
    const entry = async (kind: string, title: string, occurredAt = hoursAgo(1)) =>
      ok(await addEntry(w.caretaker.ctx, w.group.id, { kind, title, occurredAt }))!;
    const note = await entry("note", "Call notes");
    const visit = await entry("event", "Follow-up visit", hoursAhead(48));
    const gone = await entry("event", "Cancelled visit", hoursAhead(72));
    const linked = ok(
      await todoService.create(w.caretaker.ctx, { groupId: w.group.id, title: "Book a ride" }),
    )!;
    const lone = ok(
      await todoService.create(w.caretaker.ctx, { groupId: w.group.id, title: "Fax the form" }),
    )!;
    // The note first, then the event, then an event deleted after linking (its row stays, unread).
    for (const entryId of [note.id, visit.id, gone.id])
      ok(await entryTodoService.link(w.caretaker.ctx, { groupId: w.group.id, entryId, todoId: linked.id }));
    ok(await timelineEntryService.remove(w.caretaker.ctx, gone.id));
    const token = await w.connect(w.viewer);

    const listed = await callTool(handler, token, "list_todos");
    const byTitle = new Map(
      (
        listed.structuredContent.todos as {
          title: string;
          eventId: string | null;
          linkedEntryIds: string[];
        }[]
      ).map((t) => [t.title, t]),
    );
    expect(byTitle.get("Book a ride")).toMatchObject({
      eventId: visit.id,
      linkedEntryIds: [note.id, visit.id],
    });
    expect(byTitle.get(lone.title)).toMatchObject({ eventId: null, linkedEntryIds: [] });
  });

  it("list_todos: each todo has parentId, its parent's id for a subtask, else null (todo-subtasks)", async () => {
    const handler = handlerAt();
    const w = await world();
    const top = ok(
      await todoService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        title: "Get ready for the hospital stay",
      }),
    )!;
    const sub = ok(
      await todoService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        title: "Pack a bag",
        parentId: top.id,
      }),
    )!;
    const token = await w.connect(w.viewer);

    const listed = await callTool(handler, token, "list_todos");
    const byId = new Map(
      (listed.structuredContent.todos as { id: string; parentId: string | null }[]).map((t) => [t.id, t]),
    );
    expect(byId.get(top.id)).toMatchObject({ parentId: null });
    expect(byId.get(sub.id)).toMatchObject({ parentId: top.id });
  });

  it("list_providers: current by default, practice and pharmacy phones kept, an 'other' contact's left out", async () => {
    const handler = handlerAt();
    const w = await world();
    const practice = ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "practice",
        name: "Sunrise Clinic",
        phones: [{ label: "Office", number: "555-0100" }],
        address: "1 Clinic Way",
        email: "front@sunrise.example.com",
        isPrimary: true,
      }),
    )!;
    ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "clinician",
        name: "Dr. Example",
        specialty: "Cardiology",
        practiceId: practice.id,
      }),
    );
    ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "other",
        name: "Neighbor Sam",
        phones: [{ label: "Cell", number: "555-0188" }],
        address: "9 Private Rd",
        email: "sam@example.com",
      }),
    );
    ok(
      await providerService.create(w.owner.ctx, {
        groupId: w.second.group.id,
        type: "clinician",
        name: "Elsewhere",
      }),
    );
    const token = await w.connect(w.viewer);

    const result = await callTool(handler, token, "list_providers");
    const providers = result.structuredContent.providers as {
      name: string;
      practice: string | null;
      phones: { number: string }[];
      address: string | null;
    }[];
    expect(providers.map((p) => p.name)).toEqual(["Sunrise Clinic", "Dr. Example", "Neighbor Sam"]);
    expect(providers[0]).toMatchObject({
      phones: [{ label: "Office", number: "555-0100" }],
      address: "1 Clinic Way",
    });
    expect(providers[1]).toMatchObject({ practice: "Sunrise Clinic" });
    expect(providers[2]).toMatchObject({ phones: [], address: null });
    const text = JSON.stringify(result);
    for (const secret of ["555-0188", "9 Private Rd", "sam@example.com", "front@sunrise", "Elsewhere"])
      expect(text).not.toContain(secret);

    const clinicians = await callTool(handler, token, "list_providers", { type: "clinician", limit: 1 });
    expect(clinicians.structuredContent.providers).toHaveLength(1);
  });

  it("tags on records: each list tool gives a record's tag names A to Z, [] when none, never another group's (connectors-5)", async () => {
    const handler = handlerAt();
    const w = await world();
    const day = (offset: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
        new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
      );
    const tag = async (groupId: string, name: string, by = w.caretaker) =>
      ok(await tagService.create(by.ctx, { groupId, name }))!;
    const zephyr = await tag(w.group.id, "Zephyr");
    const alpha = await tag(w.group.id, "alpha");
    const tagOn = async (
      tagId: string,
      target: Record<string, string>,
      groupId = w.group.id,
      by = w.caretaker,
    ) => ok(await recordTagService.link(by.ctx, { groupId, tagId, ...target }));

    const note = ok(await addEntry(w.caretaker.ctx, w.group.id, { kind: "note", title: "Zeta note" }))!;
    const plainNote = ok(await addEntry(w.caretaker.ctx, w.group.id, { kind: "note", title: "Zeta plain" }))!;
    const visit = ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "Zeta visit",
        occurredAt: hoursAhead(30),
      }),
    )!;
    const todo = ok(
      await todoService.create(w.caretaker.ctx, { groupId: w.group.id, title: "Zeta call", dueOn: day(2) }),
    )!;
    const plainTodo = ok(
      await todoService.create(w.caretaker.ctx, { groupId: w.group.id, title: "Zeta chores", dueOn: day(3) }),
    )!;
    const provider = ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "clinician",
        name: "Dr. Zeta",
      }),
    )!;
    const plainProvider = ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "clinician",
        name: "Dr. Zetaplain",
      }),
    )!;
    const med = await addMedication(w.caretaker.ctx, w.group.id, { name: "Zetamol" });
    const plainMed = await addMedication(w.caretaker.ctx, w.group.id, { name: "Zetaplain" });
    await tagOn(zephyr.id, { entryId: note.id });
    await tagOn(zephyr.id, { entryId: visit.id });
    await tagOn(zephyr.id, { todoId: todo.id });
    await tagOn(zephyr.id, { providerId: provider.id });
    await tagOn(zephyr.id, { medicationId: med.id });
    await tagOn(alpha.id, { medicationId: med.id });
    // Another group's tag on its own medication: never in this group's answers.
    const offgroup = await tag(w.second.group.id, "Offgroup", w.owner);
    const otherMed = await addMedication(w.owner.ctx, w.second.group.id, { name: "Zetaoff" });
    await tagOn(offgroup.id, { medicationId: otherMed.id }, w.second.group.id, w.owner);

    const tagged: Record<string, string[]> = {
      [note.id]: ["Zephyr"],
      [visit.id]: ["Zephyr"],
      [todo.id]: ["Zephyr"],
      [provider.id]: ["Zephyr"],
      [med.id]: ["alpha", "Zephyr"],
    };
    const token = await w.connect(w.viewer);
    type Tagged = { id: string; tags: string[] };
    const expectTags = (tool: string, records: Tagged[], want: string[], plain: string[]) => {
      const byId = new Map(records.map((r) => [r.id, r.tags]));
      for (const id of want) expect(byId.get(id), `${tool}: ${id}`).toEqual(tagged[id]);
      for (const id of plain) expect(byId.get(id), `${tool}: ${id}`).toEqual([]);
      for (const r of records) expect(r.tags, tool).toEqual(tagged[r.id] ?? []);
    };
    const lines = (result: { content: { text: string }[] }) => result.content.map((c) => c.text).join("\n");

    const timeline = await callTool(handler, token, "list_timeline");
    expectTags(
      "list_timeline",
      timeline.structuredContent.entries as Tagged[],
      [note.id, visit.id],
      [plainNote.id],
    );
    expect(lines(timeline)).toMatch(/ note Zeta note \(caretaker\) · tags: Zephyr$/m);
    expect(lines(timeline)).toMatch(/ note Zeta plain \(caretaker\)$/m);

    const todos = await callTool(handler, token, "list_todos");
    expectTags("list_todos", todos.structuredContent.todos as Tagged[], [todo.id], [plainTodo.id]);
    expect(lines(todos)).toMatch(/- Zeta call \[upcoming\] due \S+ · tags: Zephyr$/m);

    const soon = await callTool(handler, token, "upcoming");
    expectTags("upcoming", soon.structuredContent.items as Tagged[], [visit.id, todo.id], [plainTodo.id]);
    expect(lines(soon)).toMatch(/ event: Zeta visit · tags: Zephyr$/m);
    expect(lines(soon)).toMatch(/ todo: Zeta call · tags: Zephyr$/m);
    expect(lines(soon)).toMatch(/ todo: Zeta chores$/m);

    const providers = await callTool(handler, token, "list_providers");
    expectTags(
      "list_providers",
      providers.structuredContent.providers as Tagged[],
      [provider.id],
      [plainProvider.id],
    );
    expect(lines(providers)).toMatch(/- Dr\. Zeta \(clinician\) · tags: Zephyr$/m);

    const meds = await callTool(handler, token, "list_medications");
    expectTags("list_medications", meds.structuredContent.medications as Tagged[], [med.id], [plainMed.id]);
    expect(lines(meds)).toMatch(/- Zetamol 10 mg .* · tags: alpha, Zephyr$/m);

    const found = await callTool(handler, token, "search", { q: "zeta" });
    const hits = found.structuredContent as { entries: Tagged[]; providers: Tagged[]; medications: Tagged[] };
    expectTags("search entries", hits.entries, [note.id, visit.id], [plainNote.id]);
    expectTags("search providers", hits.providers, [provider.id], [plainProvider.id]);
    expectTags("search medications", hits.medications, [med.id], [plainMed.id]);
    expect(lines(found)).toMatch(/- Medication: Zetamol 10 mg.* · tags: alpha, Zephyr$/m);
    expect(lines(found)).toMatch(/- Provider: Dr\. Zeta.* · tags: Zephyr$/m);

    for (const result of [timeline, todos, soon, providers, meds, found])
      expect(JSON.stringify(result)).not.toContain("Offgroup");
  });

  it("recipient_profile: names, age (not the birthday), basics and allergies", async () => {
    const now = new Date();
    const handler = handlerAt(now);
    const w = await world();
    const born = `${now.getUTCFullYear() - 84}-01-15`;
    ok(
      await careRecipientService.updateProfile(w.owner.ctx, w.group.id, {
        preferredName: "Pat",
        dateOfBirth: born,
        pronouns: "she/her",
        bloodType: "O+",
        notes: "Likes the radio on.",
      }),
    );
    for (const [substance, severity] of [
      ["Penicillin", "severe"],
      ["Pollen", "mild"],
    ] as const)
      ok(
        await recipientAllergyService.create(w.owner.ctx, {
          groupId: w.group.id,
          substance,
          severity,
          reaction: "Rash",
        }),
      );
    const token = await w.connect(w.viewer);
    const result = await callTool(handler, token, "recipient_profile");
    expect(result.structuredContent.recipient).toMatchObject({
      name: "Pat Example",
      preferredName: "Pat",
      pronouns: "she/her",
      bloodType: "O+",
      noteForHelpers: "Likes the radio on.",
      allergies: [
        { substance: "Penicillin", severity: "severe", reaction: "Rash" },
        { substance: "Pollen", severity: "mild", reaction: "Rash" },
      ],
    });
    // Birthday on Jan 15: 84 or 83 depending on today's date, never the birthday itself.
    expect([83, 84]).toContain((result.structuredContent.recipient as { age: number }).age);
    expect(JSON.stringify(result)).not.toContain(born);
    expect(JSON.stringify(result)).not.toContain(born.slice(0, 4));
    expect(result.content[0]?.text).toMatch(/Pat \(Pat Example\), age 8[34]/);
  });

  it("recipient_profile: conditions in order with providers' names, the flag, no deleted ones, no contact details", async () => {
    const handler = handlerAt(new Date());
    const w = await world();
    const token = await w.connect(w.viewer);
    const profile = async () => {
      const r = await callTool(handler, token, "recipient_profile");
      return {
        text: r.content[0]!.text,
        recipient: r.structuredContent.recipient as { conditions: unknown[]; noKnownConditions: boolean },
        raw: JSON.stringify(r),
      };
    };

    expect((await profile()).text).toContain("Conditions not recorded.");
    ok(
      await recipientConditionService.setNoKnownConditions(
        w.owner.ctx,
        w.recipient.id,
        new Date().toISOString(),
      ),
    );
    let result = await profile();
    expect(result.recipient).toMatchObject({ conditions: [], noKnownConditions: true });
    expect(result.text).toContain("No known conditions.");

    const lee = ok(
      await providerService.create(w.owner.ctx, {
        groupId: w.group.id,
        type: "clinician",
        name: "Dr. Lee",
        phone: "555-0123",
      } as never),
    )!;
    const gone = ok(
      await providerService.create(w.owner.ctx, { groupId: w.group.id, type: "clinician", name: "Dr. Gone" }),
    )!;
    const add = async (input: Record<string, unknown>) =>
      ok(
        await recipientConditionService.create(w.caretaker.ctx, { groupId: w.group.id, ...input } as never),
      )!;
    const old = await add({ name: "Hip fracture", sinceYear: 2019, sinceMonth: 3 });
    ok(await recipientConditionService.resolve(w.caretaker.ctx, old.id));
    await add({ name: "Asthma", sinceYear: 2001 });
    const diabetes = await add({
      name: "Type 2 diabetes",
      sinceYear: 2015,
      note: "Diet-controlled",
      diagnosedById: gone.id,
    });
    ok(
      await recipientConditionService.setManagers(w.caretaker.ctx, {
        conditionId: diabetes.id,
        providerIds: [lee.id, gone.id],
      }),
    );
    const removed = await add({ name: "Removed entry" });
    ok(await recipientConditionService.remove(w.caretaker.ctx, removed.id));
    ok(await providerService.remove(w.owner.ctx, gone.id));

    result = await profile();
    expect(result.recipient.noKnownConditions).toBe(false);
    expect(result.recipient.conditions).toEqual([
      {
        id: expect.any(String) as string,
        name: "Type 2 diabetes",
        status: "active",
        since: "2015",
        note: "Diet-controlled",
        diagnosedBy: null,
        managedBy: ["Dr. Lee"],
      },
      {
        id: expect.any(String) as string,
        name: "Asthma",
        status: "active",
        since: "2001",
        note: null,
        diagnosedBy: null,
        managedBy: [],
      },
      {
        id: expect.any(String) as string,
        name: "Hip fracture",
        status: "resolved",
        since: "March 2019",
        note: null,
        diagnosedBy: null,
        managedBy: [],
      },
    ]);
    const text = result.text;
    expect(text).toContain(
      "Conditions: Type 2 diabetes (since 2015; Diet-controlled; managed by Dr. Lee); Asthma (since 2001); Hip fracture (resolved; since March 2019).",
    );
    expect(text).not.toContain("Removed entry");
    expect(text).not.toContain("Dr. Gone");
    expect(result.raw).not.toContain("555-0123");
  });
});

// Private values in a tool's answer, field by field: every key and every
// string or number value, with the ids in it masked first, so a random UUID
// that happens to contain the birth year (`…072194195bed`) isn't a leak. A
// secret that is itself a UUID leaks when it is one of the ids.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const BIRTHDAY_FIELD = /dateOfBirth|birthday|^dob$/i;
const leaks = (result: unknown, secrets: string[]) => {
  const found: string[] = [];
  const check = (where: string, value: string) => {
    const ids = (value.match(UUID) ?? []).map((id) => id.toLowerCase());
    const rest = value.replace(UUID, "<id>");
    for (const secret of secrets)
      if (IS_UUID.test(secret) ? ids.includes(secret.toLowerCase()) : rest.includes(secret))
        found.push(`${where}: ${secret}`);
    if (EMAIL.test(rest)) found.push(`${where}: an email address`);
    if (rest.includes("1941")) found.push(`${where}: the birth year`);
    if (BIRTHDAY_FIELD.test(rest)) found.push(`${where}: a birthday field`);
  };
  const walk = (node: unknown, where: string) => {
    if (typeof node === "string" || typeof node === "number") check(where, String(node));
    else if (Array.isArray(node)) node.forEach((item, i) => walk(item, `${where}[${i}]`));
    else if (node && typeof node === "object")
      for (const [key, value] of Object.entries(node)) {
        check(`${where}.${key} (key)`, key);
        walk(value, `${where}.${key}`);
      }
  };
  walk(result, "result");
  return found;
};

describe("read tools: the leak check", () => {
  const secrets = ["1941-03-07", "555-0142", "6f1c2a9e-0d3b-4c1e-9a7f-2b8e4d6c1a05"];
  it("passes a UUID that contains the birth year or a phone's digits", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "Entry 3f2a9c1e-5b7d-4e8a-9c0b-072194195bed by a2c4e6f8-1555-0142-8abc-def012345678",
        },
      ],
      structuredContent: { entryIds: ["3f2a9c1e-5b7d-4e8a-9c0b-072194195bed"], born: "March 7" },
    };
    expect(leaks(result, secrets)).toEqual([]);
  });
  it("fails a leaked value in any field, a UUID secret among the ids, an email or a birthday field", () => {
    expect(leaks({ content: [{ type: "text", text: "Born 1941-03-07" }] }, secrets)).toEqual([
      "result.content[0].text: 1941-03-07",
      "result.content[0].text: the birth year",
    ]);
    expect(leaks({ structuredContent: { phone: "Home 555-0142" } }, secrets)).toEqual([
      "result.structuredContent.phone: 555-0142",
    ]);
    expect(leaks({ structuredContent: { year: 1941 } }, secrets)).toEqual([
      "result.structuredContent.year: the birth year",
    ]);
    expect(leaks({ structuredContent: { token: "6F1C2A9E-0D3B-4C1E-9A7F-2B8E4D6C1A05" } }, secrets)).toEqual([
      "result.structuredContent.token: 6f1c2a9e-0d3b-4c1e-9a7f-2b8e4d6c1a05",
    ]);
    expect(leaks({ content: [{ type: "text", text: "Write to kim@example.com" }] }, [])).toEqual([
      "result.content[0].text: an email address",
    ]);
    expect(leaks({ structuredContent: { dateOfBirth: null } }, [])).toEqual([
      "result.structuredContent.dateOfBirth (key): a birthday field",
    ]);
  });
});

describe("read tools: nothing private leaves", { timeout: 60_000 }, () => {
  it("no email, phone, address, invite data or full birthday in any read tool's answer", async () => {
    const now = new Date();
    const handler = handlerAt(now);
    const w = await world();
    const secrets = {
      born: "1941-03-07",
      recipientPhone: "555-0142",
      recipientEmail: "recipient.private@example.com",
      recipientAddress: "12 Hidden Lane",
      outsidePhone: "555-0177",
      memberPhone: "555-0166",
      memberEmail: "member.private@example.com",
      memberAddress: "34 Quiet Street",
      inviteeEmail: "invitee.private@example.com",
      insurance: "MEMBER-ID-9981",
    };
    ok(await careRecipientService.updateProfile(w.owner.ctx, w.group.id, { dateOfBirth: secrets.born }));
    ok(
      await careRecipientDetailsService.update(w.owner.ctx, w.group.id, {
        phones: [{ label: "Home", number: secrets.recipientPhone }],
        email: secrets.recipientEmail,
        address: secrets.recipientAddress,
        insurance: [{ rank: "primary", insurer: "Fictional Health", memberId: secrets.insurance }],
      } as never),
    );
    ok(
      await careRecipientDetailsService.updateOutsideContacts(w.owner.ctx, w.group.id, [
        { name: "Rosa Outside", relationship: "Neighbor", phone: secrets.outsidePhone },
      ]),
    );
    for (const who of [w.owner, w.caretaker]) {
      ok(
        await userContactService.update(who.ctx, {
          phones: [{ label: "Cell", number: secrets.memberPhone }],
          contactEmail: secrets.memberEmail,
          address: secrets.memberAddress,
        }),
      );
      ok(
        await memberSharingService.update(who.ctx, w.group.id, {
          sharedFields: ["phones", "email", "address"],
          relationship: "Son",
        }),
      );
    }
    const link = ok(
      await careGroupInviteService.createLink(w.owner.ctx, { groupId: w.group.id, role: "viewer" } as never),
    );
    const invite = ok(
      await careGroupInviteService.createEmail(w.owner.ctx, {
        groupId: w.group.id,
        email: secrets.inviteeEmail,
        role: "viewer",
        attested: true,
      }),
    );

    // Something for every tool to say.
    const med = await addMedication(w.caretaker.ctx, w.group.id, { name: "Aspirin" });
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "vital",
        details: { readings: [{ type: "heartRate", value: 70 }] },
      }),
    );
    const sweepEvent = ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "Cardiology",
        occurredAt: hoursAhead(40),
      }),
    )!;
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "symptom",
        details: { name: "Cough", severity: 1 },
      }),
    );
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "dose",
        details: { medicationId: med.id, status: "given", amount: "1" },
      }),
    );
    const sweepTodo = ok(
      await todoService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        title: "Call the clinic",
        assigneeId: w.caretaker.user.id,
      }),
    )!;
    const sweepProvider = ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "clinician",
        name: "Dr. Example",
      }),
    )!;
    ok(
      await recipientAllergyService.create(w.owner.ctx, {
        groupId: w.group.id,
        substance: "Penicillin",
        severity: "severe",
      }),
    );
    ok(
      await recipientConditionService.create(w.owner.ctx, {
        groupId: w.group.id,
        name: "Atrial fibrillation",
        sinceYear: 2018,
      }),
    );
    const sweepTag = ok(await tagService.create(w.caretaker.ctx, { groupId: w.group.id, name: "Sweep" }))!;
    ok(
      await recordTagService.link(w.caretaker.ctx, {
        groupId: w.group.id,
        tagId: sweepTag.id,
        medicationId: med.id,
      }),
    );
    // Tags on every kind the list tools read (connectors-5 slice 4).
    for (const target of [
      { entryId: sweepEvent.id },
      { todoId: sweepTodo.id },
      { providerId: sweepProvider.id },
    ])
      ok(
        await recordTagService.link(w.caretaker.ctx, { groupId: w.group.id, tagId: sweepTag.id, ...target }),
      );

    const reads = CONNECTOR_TOOLS.filter((t) => t.scope === "read");
    expect(reads.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "group_overview",
        "list_timeline",
        "latest_vitals",
        "search",
        "list_medications",
        "todays_doses",
        "dose_schedule",
        "past_doses",
        "upcoming",
        "list_todos",
        "list_providers",
        "recipient_profile",
        "list_tags",
        "tagged_items",
      ]),
    );
    const inputs: Record<string, Record<string, unknown>> = {
      search: { q: "cardio aspirin dr penicillin" },
      list_timeline: { from: hoursAgo(24 * 80) },
      list_todos: { status: "all" },
      list_medications: { includePast: true },
      list_providers: { includePast: true },
      tagged_items: { tag: "sweep" },
    };
    const secretValues = [
      ...Object.values(secrets),
      link.token,
      (invite as { token?: string }).token,
      w.owner.user.email,
      w.caretaker.user.email,
      w.viewer.user.email,
    ].filter((v): v is string => !!v);

    // As the viewer, and as the owner (who sees the most).
    for (const who of [w.viewer, w.owner]) {
      const token = await w.connect(who);
      for (const tool of reads) {
        const result = await callTool(handler, token, tool.name, inputs[tool.name] ?? {});
        expect(result.isError, tool.name).toBeFalsy();
        // Something came back, so a pass isn't an empty answer.
        expect(JSON.stringify(result).length, tool.name).toBeGreaterThan(40);
        expect(leaks(result, secretValues), tool.name).toEqual([]);
      }
    }
  });
});
