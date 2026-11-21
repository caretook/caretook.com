import type { AuthUser } from "@caretook/data";

import { validateConnectorToken } from "@caretook/auth";
import {
  careGroupInviteService,
  careGroupService,
  careRecipientDetailsService,
  careRecipientService,
  dueDoses,
  duePasses,
  medicationPassService,
  medicationService,
  memberSharingService,
  noteDocumentService,
  normalizeSchedule,
  providerService,
  recipientAllergyService,
  taskService,
  timelineEntryService,
  userContactService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../../data/test/fixtures";
import { createRateLimiter } from "../rateLimit";
import { resourceMetadataUrl } from "./discovery";
import { createMcpHandler } from "./http";
import { connectAssistant, enablePasswordSignIn, TEST_ORIGIN } from "./testing";
import { CONNECTOR_TOOLS } from "./tools";

// The read tools beyond group_overview and list_timeline, through /mcp with
// real tokens: each in its group's scope, never another group's, paged and
// capped, in the recipient's offset. A sweep over every read tool checks that
// nothing private leaves. All data is fictional.

const handlerAt = (now?: Date) =>
  createMcpHandler({
    resourceMetadataUrl: resourceMetadataUrl(TEST_ORIGIN),
    validate: validateConnectorToken(),
    limiter: createRateLimiter({ limit: 10_000, windowMs: 60_000 }),
    tools: CONNECTOR_TOOLS,
    ...(now ? { now: () => now } : {}),
  });

let nextId = 1;
type CallResult = {
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};
const callTool = async (
  handler: ReturnType<typeof handlerAt>,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
) => {
  const res = await handler(
    new Request(`${TEST_ORIGIN}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId++,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { result: CallResult }).result;
};

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
) =>
  ok(
    await medicationService.create(ctx, {
      groupId,
      name: "Lisinopril",
      strength: "10 mg",
      form: "tablet",
      dose: "1 tablet",
      schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
      ...overrides,
    } as never),
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
    }[];
    expect(meds.map((m) => m.title)).toEqual(["Aspirin 10 mg", "Ibuprofen 10 mg"]);
    expect(meds[0]).toMatchObject({ schedule: "Morning", pharmacy: { name: "Corner Pharmacy" } });
    expect(meds[1]).toMatchObject({ schedule: "As needed, up to 4 a day", maxPerDay: 4 });

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

  it("todays_doses: agrees with the app's due-doses core for the same data and now, in the recipient's zone", async () => {
    const now = new Date();
    const handler = handlerAt(now);
    const w = await world();
    const passes = ok(await medicationPassService.list(w.owner.ctx, { groupId: w.group.id })).data;
    const morning = passes.find((p) => p.name === "Morning")!;
    const evening = passes.find((p) => p.name === "Evening")!;
    const aspirin = await addMedication(w.caretaker.ctx, w.group.id, {
      name: "Aspirin",
      strength: null,
      schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
    });
    const pain = await addMedication(w.caretaker.ctx, w.group.id, {
      name: "Ibuprofen",
      strength: null,
      schedule: { type: "asNeeded", maxPerDay: 3 },
    });
    await addMedication(w.owner.ctx, w.second.group.id, { name: "Elsewhere" });
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "dose",
        occurredAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
        details: {
          medicationId: aspirin.id,
          status: "given",
          amount: "1 tablet",
          scheduledFor: "08:00",
          passId: morning.id,
        },
      }),
    );
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "dose",
        occurredAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
        details: { medicationId: pain.id, status: "given", amount: "1 tablet" },
      }),
    );
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
  });

  it("upcoming: appointments and reminders soonest first, in the offset, 30 days by default and 90 at most", async () => {
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
        kind: "note",
        title: "Refill reminder",
        occurredAt: hoursAhead(100),
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
    expect(items.map((i) => i.title)).toEqual(["Dentist", "Cardiology", "Refill reminder"]);
    expect(items.map((i) => i.kind)).toEqual(["appointment", "appointment", "reminder"]);
    expect(items[1]?.place).toBe("Heart Clinic");
    for (const i of items) expect(i.startsAt).toMatch(OFFSET);

    const quarter = await callTool(handler, token, "upcoming", { days: 90 });
    expect((quarter.structuredContent.items as { title: string }[]).map((i) => i.title)).toEqual([
      "Dentist",
      "Cardiology",
      "Refill reminder",
      "In 45 days",
    ]);
    expect((await callTool(handler, token, "upcoming", { days: 91 })).isError).toBe(true);
    expect(JSON.stringify(quarter)).not.toContain("Elsewhere");
  });

  it("list_tasks: open by default in the app's order, done on request, paged, mine, never another group's", async () => {
    const handler = handlerAt();
    const w = await world();
    const task = async (title: string, extra: Record<string, unknown> = {}) =>
      ok(await taskService.create(w.caretaker.ctx, { groupId: w.group.id, title, ...extra }))!;
    await task("Undated");
    await task("Overdue", { dueOn: "2020-01-02" });
    await task("Mine", { assigneeId: w.viewer.user.id, dueOn: "2099-01-01", dueTime: "09:30" });
    await task("Named", { assigneeName: "Rosa" });
    const finished = await task("Finished");
    ok(await taskService.complete(w.caretaker.ctx, finished.id));
    ok(await taskService.create(w.owner.ctx, { groupId: w.second.group.id, title: "Elsewhere" }));
    const token = await w.connect(w.viewer);

    const open = await callTool(handler, token, "list_tasks");
    const tasks = open.structuredContent.tasks as {
      title: string;
      state: string;
      assignee: { name: string | null } | null;
    }[];
    expect(tasks.map((t) => [t.title, t.state])).toEqual([
      ["Overdue", "overdue"],
      ["Mine", "upcoming"],
      ["Named", "undated"],
      ["Undated", "undated"],
    ]);
    expect(tasks[1]?.assignee?.name).toBe("viewer");
    expect(tasks[2]?.assignee?.name).toBe("Rosa");

    const done = await callTool(handler, token, "list_tasks", { status: "done" });
    expect(done.structuredContent.tasks).toEqual([
      expect.objectContaining({ title: "Finished", state: "done", doneBy: "caretaker" }),
    ]);
    expect((done.structuredContent.tasks as { doneAt: string }[])[0]?.doneAt).toMatch(OFFSET);
    const mine = await callTool(handler, token, "list_tasks", { status: "all", mine: true });
    expect((mine.structuredContent.tasks as { title: string }[]).map((t) => t.title)).toEqual(["Mine"]);
    const page = await callTool(handler, token, "list_tasks", { status: "all", limit: 2 });
    expect(page.structuredContent.nextCursor).toBe("2");
    const page2 = await callTool(handler, token, "list_tasks", { status: "all", limit: 2, cursor: "2" });
    expect(page2.structuredContent.tasks).toHaveLength(2);
    expect(page2.structuredContent.nextCursor).toBe("4");
    const page3 = await callTool(handler, token, "list_tasks", { status: "all", limit: 2, cursor: "4" });
    expect(page3.structuredContent.tasks).toHaveLength(1);
    expect(page3.structuredContent.nextCursor).toBeNull();
    expect(JSON.stringify([open, done, page, page2])).not.toContain("Elsewhere");
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
    ok(
      await addEntry(w.caretaker.ctx, w.group.id, {
        kind: "event",
        title: "Cardiology",
        occurredAt: hoursAhead(40),
      }),
    );
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
    ok(
      await taskService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        title: "Call the clinic",
        assigneeId: w.caretaker.user.id,
      }),
    );
    ok(
      await providerService.create(w.caretaker.ctx, {
        groupId: w.group.id,
        type: "clinician",
        name: "Dr. Example",
      }),
    );
    ok(
      await recipientAllergyService.create(w.owner.ctx, {
        groupId: w.group.id,
        substance: "Penicillin",
        severity: "severe",
      }),
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
        "upcoming",
        "list_tasks",
        "list_providers",
        "recipient_profile",
      ]),
    );
    const inputs: Record<string, Record<string, unknown>> = {
      search: { q: "cardio aspirin dr penicillin" },
      list_timeline: { from: hoursAgo(24 * 80) },
      list_tasks: { status: "all" },
      list_medications: { includePast: true },
      list_providers: { includePast: true },
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
        const text = JSON.stringify(result);
        // Something came back, so a pass isn't an empty answer.
        expect(text.length, tool.name).toBeGreaterThan(40);
        for (const secret of secretValues)
          expect(text, `${tool.name} leaked ${secret}`).not.toContain(secret);
        expect(text, `${tool.name}: an email address`).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        expect(text, `${tool.name}: the birth year`).not.toContain("1941");
        expect(text, `${tool.name}: a birthday field`).not.toMatch(/dateOfBirth|birthday|"dob"/i);
      }
    }
  });
});
