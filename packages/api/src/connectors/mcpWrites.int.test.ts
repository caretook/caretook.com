import { validateConnectorToken } from "@caretook/auth";
import {
  careGroupMemberService,
  careGroupService,
  medicationPassService,
  medicationService,
  providerService,
  taskService,
  timelineEntryService,
} from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { createRateLimiter } from "../rateLimit";
import { resourceMetadataUrl } from "./discovery";
import { createMcpHandler } from "./http";
import { connectAssistant, enablePasswordSignIn, TEST_ORIGIN } from "./testing";

// The write tools through /mcp's HTTP handler, with tokens from the real
// OAuth dance: each tool writes through the server runner with "via" the
// client's name, answers in quick entry's words with a link, and a refusal
// is an isError result the model can fix. Each test makes its own members,
// group and connection. All data is fictional.

const CLIENT = "Test Claude";
const handler = createMcpHandler({
  resourceMetadataUrl: resourceMetadataUrl(TEST_ORIGIN),
  validate: validateConnectorToken(),
  limiter: createRateLimiter({ limit: 600, windowMs: 60_000 }),
});

let nextId = 1;
const callTool = (token: string, name: string, args: Record<string, unknown> = {}) =>
  handler(
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

type CallResult = {
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown> & { url?: string | null; entryIds?: string[]; taskId?: string };
  isError?: boolean;
};
const resultOf = async (res: Response) => {
  expect(res.status).toBe(200);
  return ((await res.json()) as { result: CallResult }).result;
};
const textOf = (result: CallResult) => result.content.map((c) => c.text).join("\n");

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** A group with Assistants on, a caretaker connected to read and write, a medication and a provider. */
const world = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  for (const who of [owner, caretaker, viewer]) await enablePasswordSignIn(who.user.id);
  const { group } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  ok(
    await careGroupService.update(owner.ctx, {
      filter: { id: { type: "eq", value: group.id } },
      data: { connectorsEnabled: true },
    }),
  );
  const [morning, evening] = ok(await medicationPassService.list(owner.ctx, { groupId: group.id })).data;
  const metformin = ok(
    await medicationService.create(owner.ctx, {
      groupId: group.id,
      name: "Metformin",
      strength: "500 mg",
      schedule: { type: "scheduled", slots: [{ passId: morning!.id }, { passId: evening!.id }] },
    }),
  )!;
  const provider = ok(
    await providerService.create(owner.ctx, { groupId: group.id, type: "clinician", name: "Dr. Example" }),
  )!;
  const writer = await connectAssistant({
    email: caretaker.user.email,
    groupId: group.id,
    clientName: CLIENT,
  });
  const entry = async (id: string) => ok(await timelineEntryService.getById(owner.ctx, id));
  const groupEntries = async () =>
    ok(await timelineEntryService.list(owner.ctx, { groupId: group.id, limit: 200 })).data;
  return {
    owner,
    caretaker,
    viewer,
    group,
    evening: evening!,
    metformin,
    provider,
    writer,
    entry,
    groupEntries,
  };
};

describe("/mcp write tools", () => {
  it("log vitals, a symptom, a dose and a pass's Given all, each via the client", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const base = `${TEST_ORIGIN}/app/groups/${w.group.id}`;

    const vitals = await resultOf(
      await callTool(token, "log_vitals", {
        readings: [
          { type: "bloodPressure", systolic: 130, diastolic: 85 },
          { type: "temperature", value: 37 },
        ],
        occurredAt: minutesAgo(5),
      }),
    );
    expect(vitals.isError).toBeUndefined();
    const [vitalId] = vitals.structuredContent.entryIds!;
    // Quick entry's words, in the member's units (°F by default), and the entry's edit sheet.
    expect(textOf(vitals)).toContain("BP 130/85 mmHg, Temp 98.6 °F");
    expect(vitals.structuredContent.url).toBe(`${base}/timeline/${vitalId}/edit`);
    expect(textOf(vitals)).toContain(vitals.structuredContent.url);
    expect(await w.entry(vitalId!)).toMatchObject({
      kind: "vital",
      via: CLIENT,
      createdBy: w.caretaker.user.id,
      details: { readings: [{ type: "bloodPressure" }, { type: "temperature", value: 37 }] },
    });

    const symptom = await resultOf(await callTool(token, "log_symptom", { name: "Headache", severity: 4 }));
    expect(textOf(symptom)).toMatch(/^Logged: Headache 4 · Now/);
    expect(await w.entry(symptom.structuredContent.entryIds![0]!)).toMatchObject({
      kind: "symptom",
      via: CLIENT,
    });

    const dose = await resultOf(
      await callTool(token, "log_dose", {
        medicationId: w.metformin.id,
        status: "given",
        amount: "1 tablet",
        occurredAt: minutesAgo(1),
      }),
    );
    expect(textOf(dose)).toContain("Metformin 500 mg · Given 1 tablet");
    expect(await w.entry(dose.structuredContent.entryIds![0]!)).toMatchObject({ kind: "dose", via: CLIENT });

    const pass = await resultOf(await callTool(token, "give_pass", { passId: w.evening.id }));
    expect(pass.isError).toBeUndefined();
    const [passDose] = pass.structuredContent.entryIds!;
    const written = await w.entry(passDose!);
    expect(written).toMatchObject({ kind: "dose", via: CLIENT, details: { passId: w.evening.id } });
    const passLogId = (written!.details as { passLogId: string }).passLogId;
    expect(textOf(pass)).toContain("Evening medications · Given all · 1 medication");
    expect(pass.structuredContent.url).toBe(`${base}/timeline/pass/${passLogId}/edit`);
  });

  it("add a note, an event with its provider, and a task by its assignee's name", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const base = `${TEST_ORIGIN}/app/groups/${w.group.id}`;

    const note = await resultOf(
      await callTool(token, "add_note", { title: "Lunch", text: "Ate most of the soup." }),
    );
    const [noteId] = note.structuredContent.entryIds!;
    expect(textOf(note)).toMatch(/^Logged: Lunch · Ate most of the soup\. · Now/);
    expect(note.structuredContent.url).toBe(`${base}/entries/${noteId}`);
    expect(await w.entry(noteId!)).toMatchObject({ kind: "note", title: "Lunch", via: CLIENT });

    const event = await resultOf(
      await callTool(token, "add_event", {
        title: "Cardiology follow-up",
        occurredAt: "2027-01-12T10:30:00-08:00",
        place: "Clinic B",
        providerIds: [w.provider.id],
      }),
    );
    expect(textOf(event)).toContain("Cardiology follow-up · Clinic B · with Dr. Example");
    expect(await w.entry(event.structuredContent.entryIds![0]!)).toMatchObject({
      kind: "event",
      timeZone: "America/Los_Angeles",
      via: CLIENT,
    });

    const task = await resultOf(
      await callTool(token, "add_task", {
        title: "Pick up prescription",
        assignee: "Caretaker",
        dueOn: "2027-01-10",
      }),
    );
    const taskId = task.structuredContent.taskId!;
    expect(textOf(task)).toMatch(/^Added task: Pick up prescription · caretaker · /);
    expect(task.structuredContent.url).toBe(`${base}/tasks/${taskId}`);
    const row = ok(await taskService.getById(w.owner.ctx, taskId));
    expect(row).toMatchObject({ assigneeId: w.caretaker.user.id, dueOn: "2027-01-10", via: CLIENT });

    const nobody = await resultOf(await callTool(token, "add_task", { title: "Call", assignee: "Nobody" }));
    expect(nobody).toMatchObject({
      isError: true,
      structuredContent: {
        error: { code: "assistantActionService:invalid", issues: [{ path: "assignee" }] },
      },
    });
  });

  it("answers a refusal as an isError result with the code and issues, and writes nothing", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const logged = async () => (await w.groupEntries()).filter((e) => e.kind !== "medicationChange");
    const before = (await logged()).length;

    // Caught by the tool's own input schema (the action's), before the runner.
    const order = await resultOf(
      await callTool(token, "log_vitals", {
        readings: [{ type: "bloodPressure", systolic: 80, diastolic: 120 }],
      }),
    );
    expect(order).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          code: "mcp:invalidArguments",
          issues: [
            { path: "readings.0.diastolic", message: "The bottom number must be lower than the top one." },
          ],
        },
      },
    });
    expect(textOf(order)).toContain("readings.0.diastolic");

    const future = await resultOf(
      await callTool(token, "log_dose", {
        medicationId: w.metformin.id,
        status: "given",
        occurredAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
      }),
    );
    expect(future).toMatchObject({
      isError: true,
      structuredContent: {
        error: { code: "assistantActionService:invalid", issues: [{ path: "occurredAt" }] },
      },
    });

    ok(
      await medicationService.update(w.owner.ctx, w.metformin.id, {
        status: "completed",
        stoppedOn: "2026-11-01",
      }),
    );
    const stopped = await resultOf(
      await callTool(token, "log_dose", { medicationId: w.metformin.id, status: "given" }),
    );
    expect(stopped).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "assistantActionService:medicationStopped" } },
    });
    expect(textOf(stopped)).toContain("Metformin isn't current");
    // Nothing written but the stop's own change entry.
    expect((await logged()).length).toBe(before);
  });

  it("refuses writes on a read-only grant, and from the moment a caretaker becomes a viewer", async () => {
    const w = await world();
    const reader = await connectAssistant({
      email: w.caretaker.user.email,
      groupId: w.group.id,
      scope: "read",
      clientName: "Reader",
    });
    const readOnly = await callTool(reader.tokens.access_token, "add_note", { text: "Hello" });
    expect(readOnly.status).toBe(403);
    expect(readOnly.headers.get("www-authenticate")).toMatch(/^Bearer error="insufficient_scope", /);

    const token = w.writer.tokens.access_token;
    expect((await resultOf(await callTool(token, "add_note", { text: "Before" }))).isError).toBeUndefined();
    const [membership] = ok(
      await careGroupMemberService.list(w.owner.ctx, {
        filter: {
          groupId: { type: "eq", value: w.group.id },
          userId: { type: "eq", value: w.caretaker.user.id },
        },
      }),
    ).data;
    ok(await careGroupMemberService.updateRole(w.owner.ctx, { id: membership!.id, role: "viewer" }));
    expect((await callTool(token, "add_note", { text: "After" })).status).toBe(403);
    const notes = (await w.groupEntries()).filter((e) => e.kind === "note");
    expect(notes).toHaveLength(1);
  });
});
