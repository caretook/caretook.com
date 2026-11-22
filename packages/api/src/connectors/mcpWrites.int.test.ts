import { validateConnectorToken } from "@caretook/auth";
import {
  careGroupMemberService,
  careGroupService,
  careRecipientService,
  entryProviderService,
  medicationPassService,
  medicationService,
  noteDocumentService,
  providerService,
  recipientConditionService,
  SYSTEM_USER,
  timelineEntryModel,
  todoService,
  timelineEntryService,
} from "@caretook/data";
import { fromBase64, MENTION_NODE } from "@caretook/data/schema";
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
  structuredContent: Record<string, unknown> & { url?: string | null; entryIds?: string[]; todoId?: string };
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
  // As needed, so its dose never answers a pass's slot (a dose without a time
  // answers the nearest open slot within two hours, Evening's from 18:00).
  const ibuprofen = ok(
    await medicationService.create(owner.ctx, {
      groupId: group.id,
      name: "Ibuprofen",
      strength: "200 mg",
      schedule: { type: "asNeeded" },
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
    ibuprofen,
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
        medicationId: w.ibuprofen.id,
        status: "given",
        amount: "1 tablet",
        occurredAt: minutesAgo(1),
      }),
    );
    expect(textOf(dose)).toContain("Ibuprofen 200 mg · Given 1 tablet");
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

  it("add a note, an event with its provider, and a todo by its assignee's name", async () => {
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

    const todo = await resultOf(
      await callTool(token, "add_todo", {
        title: "Pick up prescription",
        assignee: "Caretaker",
        dueOn: "2027-01-10",
      }),
    );
    const todoId = todo.structuredContent.todoId!;
    expect(textOf(todo)).toMatch(/^Added todo: Pick up prescription · caretaker · /);
    expect(todo.structuredContent.url).toBe(`${base}/todos/${todoId}`);
    const row = ok(await todoService.getById(w.owner.ctx, todoId));
    expect(row).toMatchObject({ assigneeId: w.caretaker.user.id, dueOn: "2027-01-10", via: CLIENT });

    // The old name is an unknown tool.
    const old = await callTool(token, "add_task", { title: "Call" });
    expect(((await old.json()) as { error: { code: number; message: string } }).error).toMatchObject({
      code: -32602,
      message: "Unknown tool: add_task",
    });

    const nobody = await resultOf(await callTool(token, "add_todo", { title: "Call", assignee: "Nobody" }));
    expect(nobody).toMatchObject({
      isError: true,
      structuredContent: {
        error: { code: "assistantActionService:invalid", issues: [{ path: "assignee" }] },
      },
    });
  });

  it("add a note that mentions its providers and links them; another group's provider is refused", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;

    const note = await resultOf(
      await callTool(token, "add_note", {
        text: "Called @Dr. Example about the refill.",
        providerIds: [w.provider.id],
      }),
    );
    expect(note.isError).toBeUndefined();
    expect(textOf(note)).toMatch(
      /^Logged: Called @Dr\. Example about the refill\. · with Dr\. Example · Now/,
    );
    const [noteId] = note.structuredContent.entryIds!;
    // The mention sits where the text names the provider, and the link is the entry's With row.
    expect(ok(await noteDocumentService.currentText(w.owner.ctx, noteId!))).toBe(
      "Called @Dr. Example about the refill.",
    );
    // The compacted snapshot holds a mention node carrying the provider's id (Yjs stores names as UTF-8).
    const stored = ok(await noteDocumentService.getById(w.owner.ctx, noteId!));
    const bytes = new TextDecoder().decode(fromBase64(stored.snapshot!));
    expect(bytes).toContain(MENTION_NODE);
    expect(bytes).toContain(w.provider.id);
    const links = ok(await entryProviderService.listForEntry(w.owner.ctx, noteId!)).data;
    expect(links.map((l) => l.providerId)).toEqual([w.provider.id]);

    // A provider the text doesn't name is mentioned at the end.
    const plain = await resultOf(
      await callTool(token, "add_note", { text: "Refill sorted.", providerIds: [w.provider.id] }),
    );
    expect(
      ok(await noteDocumentService.currentText(w.owner.ctx, plain.structuredContent.entryIds![0]!)),
    ).toBe("Refill sorted. @Dr. Example");

    // Another group's provider: refused, and nothing written.
    const elsewhere = await createUser("elsewhere");
    const { group: other } = await createGroup(elsewhere);
    const far = ok(
      await providerService.create(elsewhere.ctx, { groupId: other.id, type: "clinician", name: "Dr. Far" }),
    )!;
    const before = (await w.groupEntries()).length;
    const refused = await resultOf(
      await callTool(token, "add_note", { text: "Called @Dr. Far", providerIds: [far.id] }),
    );
    expect(refused).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "assistantActionService:providerGone" } },
    });
    expect((await w.groupEntries()).length).toBe(before);
    expect(ok(await entryProviderService.listForProvider(elsewhere.ctx, far.id)).count).toBe(0);
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

describe("/mcp edit tools (connectors-2)", () => {
  // A fixed clock, so answers' wording never depends on the time of day (B-205, B-206).
  const NOW = new Date("2026-11-18T19:00:00.000Z");
  const pinned = createMcpHandler({
    resourceMetadataUrl: resourceMetadataUrl(TEST_ORIGIN),
    validate: validateConnectorToken(),
    limiter: createRateLimiter({ limit: 600, windowMs: 60_000 }),
    now: () => NOW,
  });
  const call = (token: string, name: string, args: Record<string, unknown> = {}) =>
    pinned(
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

  it("append to a note and to an event with no notes yet, and change a title and time", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const base = `${TEST_ORIGIN}/app/groups/${w.group.id}`;

    const note = await resultOf(
      await call(token, "add_note", { title: "Visit prep", text: "Bring the pill box" }),
    );
    const [noteId] = note.structuredContent.entryIds!;
    // Reads give the ids the edits take.
    const listed = await resultOf(await call(token, "list_timeline", { kinds: ["note"] }));
    expect(JSON.stringify(listed.structuredContent)).toContain(noteId);

    const added = await resultOf(
      await call(token, "append_to_entry", {
        entryId: noteId,
        lines: [
          { text: "Questions for Dr. Lee" },
          { text: "Can the evening dose move earlier?", style: "bullet" },
        ],
      }),
    );
    expect(added.isError).toBeUndefined();
    expect(textOf(added)).toMatch(/^Added to: Visit prep · 2 lines · Now\n/);
    expect(added.structuredContent).toMatchObject({ entryIds: [noteId], url: `${base}/entries/${noteId}` });
    expect(textOf(added)).toContain(added.structuredContent.url);
    expect((await w.entry(noteId!))?.body).toBe(
      "Bring the pill box\nQuestions for Dr. Lee\n• Can the evening dose move earlier?",
    );

    const event = ok(
      await timelineEntryService.create(w.owner.ctx, {
        groupId: w.group.id,
        kind: "event",
        title: "Dentist",
        occurredAt: "2026-11-25T09:00:00-08:00",
        endsAt: "2026-11-25T10:00:00-08:00",
        timeZone: "America/Los_Angeles",
      }),
    )!;
    const toEvent = await resultOf(
      await call(token, "append_to_entry", { entryId: event.id, lines: [{ text: "Ask about the crown" }] }),
    );
    expect(textOf(toEvent)).toMatch(/^Added to: Dentist · 1 line · /);
    expect((await w.entry(event.id))?.body).toBe("Ask about the crown");

    const updated = await resultOf(
      await call(token, "update_entry", {
        entryId: event.id,
        title: "Dentist: crown",
        occurredAt: "2026-11-26T10:30:00-08:00",
      }),
    );
    expect(updated.isError).toBeUndefined();
    const updatedText = textOf(updated);
    expect(updatedText).toMatch(
      /^Updated: Dentist: crown · Renamed from Dentist, moved from .*9:00 AM · .*10:30 AM\n/,
    );
    expect(updated.structuredContent.url).toBe(`${base}/entries/${event.id}`);
    const moved = (await w.entry(event.id))!;
    expect(moved).toMatchObject({ title: "Dentist: crown", via: null, updatedBy: w.caretaker.user.id });
    expect(new Date(moved.occurredAt).toISOString()).toBe("2026-11-26T18:30:00.000Z");
    expect(new Date(moved.endsAt!).toISOString()).toBe("2026-11-26T19:30:00.000Z");
  });

  it("refuses viewers, too many lines, deleted entries, symptoms and other groups' ids", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const noteId = (await resultOf(await call(token, "add_note", { text: "Original" }))).structuredContent
      .entryIds![0]!;
    const symptomId = (await resultOf(await call(token, "log_symptom", { name: "Headache" })))
      .structuredContent.entryIds![0]!;
    const goneId = (await resultOf(await call(token, "add_note", { text: "Gone" }))).structuredContent
      .entryIds![0]!;
    ok(await timelineEntryService.remove(w.owner.ctx, goneId));
    const elsewhere = await createUser("elsewhere");
    const { group: other } = await createGroup(elsewhere);
    const otherNote = ok(
      await timelineEntryService.create(elsewhere.ctx, {
        groupId: other.id,
        kind: "note",
        occurredAt: "2026-11-18T10:00:00-08:00",
        timeZone: "America/Los_Angeles",
      }),
    )!;

    // A viewer can only connect to read: the edit tools aren't theirs.
    const viewer = await connectAssistant({
      email: w.viewer.user.email,
      groupId: w.group.id,
      scope: "read",
      clientName: "Viewer's Claude",
    });
    const refused = await call(viewer.tokens.access_token, "append_to_entry", {
      entryId: noteId,
      lines: [{ text: "Hello" }],
    });
    expect(refused.status).toBe(403);

    const tooMany = await resultOf(
      await call(token, "append_to_entry", {
        entryId: noteId,
        lines: Array.from({ length: 51 }, (_, i) => ({ text: `Line ${i}` })),
      }),
    );
    expect(tooMany).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "mcp:invalidArguments", issues: [{ path: "lines" }] } },
    });

    const cases: [string, Record<string, unknown>, string][] = [
      [
        "append_to_entry",
        { entryId: goneId, lines: [{ text: "More" }] },
        "assistantActionService:entryDeleted",
      ],
      ["update_entry", { entryId: goneId, title: "Back" }, "assistantActionService:entryDeleted"],
      [
        "append_to_entry",
        { entryId: symptomId, lines: [{ text: "More" }] },
        "assistantActionService:notEditable",
      ],
      ["update_entry", { entryId: symptomId, title: "Migraine" }, "assistantActionService:notEditable"],
      [
        "append_to_entry",
        { entryId: otherNote.id, lines: [{ text: "Mine" }] },
        "assistantActionService:entryNotFound",
      ],
      ["update_entry", { entryId: otherNote.id, title: "Mine" }, "assistantActionService:entryNotFound"],
      ["update_entry", { entryId: noteId }, "assistantActionService:invalid"],
    ];
    for (const [tool, args, code] of cases) {
      const result = await resultOf(await call(token, tool, args));
      expect(result, `${tool} ${JSON.stringify(args)}`).toMatchObject({
        isError: true,
        structuredContent: { error: { code } },
      });
    }
    // The other group's note reads as missing: nothing says it exists.
    const missing = await resultOf(
      await call(token, "update_entry", { entryId: otherNote.id, title: "Mine" }),
    );
    expect(textOf(missing)).toContain("wasn't found in this care group");

    expect((await w.entry(noteId))?.body).toBe("Original");
    expect(ok(await timelineEntryService.getById(elsewhere.ctx, otherNote.id))?.title).toBeNull();
  });
  it("add, update and resolve a condition, each with its change entry via the client", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const base = `${TEST_ORIGIN}/app/groups/${w.group.id}`;

    const added = await resultOf(
      await call(token, "add_condition", {
        name: "Type 2 diabetes",
        sinceYear: 2015,
        sinceMonth: 3,
        note: "Diet-controlled",
        diagnosedById: w.provider.id,
      }),
    );
    expect(added.isError).toBeUndefined();
    expect(textOf(added)).toMatch(
      /^Added condition: Type 2 diabetes · Active, since March 2015, Diet-controlled, diagnosed by Dr\. Example\n/,
    );
    const conditionId = added.structuredContent.conditionId as string;
    expect(added.structuredContent).toMatchObject({ url: `${base}/profile`, via: CLIENT });

    // recipient_profile gives the id the other two take.
    const profile = await resultOf(await call(token, "recipient_profile"));
    expect(JSON.stringify(profile.structuredContent)).toContain(conditionId);

    const updated = await resultOf(
      await call(token, "update_condition", { conditionId, name: "Type 2 diabetes mellitus", note: null }),
    );
    expect(updated.isError).toBeUndefined();
    expect(textOf(updated)).toMatch(
      /^Updated condition: Type 2 diabetes mellitus · Active, since March 2015/,
    );
    expect(textOf(updated)).not.toContain("Diet-controlled");

    const resolved = await resultOf(await call(token, "resolve_condition", { conditionId }));
    expect(textOf(resolved)).toMatch(/^Resolved condition: Type 2 diabetes mellitus · Resolved, since/);
    expect(ok(await recipientConditionService.getById(w.owner.ctx, conditionId))).toMatchObject({
      status: "resolved",
      name: "Type 2 diabetes mellitus",
      note: null,
    });

    // One change entry each, written as the member and tagged with the client.
    const entries = (await w.groupEntries()).filter((e) => e.kind === "conditionChange");
    expect(entries.map((e) => (e.details as { change: string }).change).sort()).toEqual([
      "added",
      "changed",
      "resolved",
    ]);
    for (const e of entries) expect(e).toMatchObject({ via: CLIENT, createdBy: w.caretaker.user.id });

    // Active again by an update (a recurrence).
    const back = await resultOf(await call(token, "update_condition", { conditionId, status: "active" }));
    expect(textOf(back)).toMatch(/^Updated condition: Type 2 diabetes mellitus · Active/);
  });

  it("refuses bad content, viewers, deleted conditions and other groups' ids as tool errors", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const deleted = ok(
      await recipientConditionService.create(w.owner.ctx, { groupId: w.group.id, name: "Old" }),
    )!;
    ok(await recipientConditionService.remove(w.owner.ctx, deleted.id));
    const live = ok(
      await recipientConditionService.create(w.owner.ctx, { groupId: w.group.id, name: "Asthma" }),
    )!;
    const elsewhere = await createUser("elsewhere");
    const { group: other } = await createGroup(elsewhere);
    const foreignProvider = ok(
      await providerService.create(elsewhere.ctx, { groupId: other.id, type: "clinician", name: "Dr. Far" }),
    )!;
    const goneProvider = ok(
      await providerService.create(w.owner.ctx, { groupId: w.group.id, type: "clinician", name: "Dr. Gone" }),
    )!;
    ok(await providerService.remove(w.owner.ctx, goneProvider.id));
    const foreign = ok(
      await recipientConditionService.create(elsewhere.ctx, { groupId: other.id, name: "Foreign" }),
    )!;

    const viewer = await connectAssistant({
      email: w.viewer.user.email,
      groupId: w.group.id,
      scope: "read",
      clientName: "Viewer's Claude",
    });
    expect((await call(viewer.tokens.access_token, "add_condition", { name: "Nope" })).status).toBe(403);

    const cases: [string, Record<string, unknown>, string][] = [
      ["add_condition", { name: "Asthma", sinceMonth: 3 }, "recipientConditionService:invalid"],
      ["add_condition", { name: "Asthma", diagnosedById: foreignProvider.id }, "permissions:unauthorized"],
      [
        "add_condition",
        { name: "Asthma", diagnosedById: goneProvider.id },
        "recipientConditionService:providerNotFound",
      ],
      ["update_condition", { conditionId: live.id }, "assistantActionService:invalid"],
      ["update_condition", { conditionId: live.id, sinceMonth: 13 }, "recipientConditionService:invalid"],
      // The condition refusals pass through (each case of them: assistantAction.int.test.ts).
      [
        "update_condition",
        { conditionId: deleted.id, name: "Back" },
        "assistantActionService:conditionDeleted",
      ],
      ["resolve_condition", { conditionId: foreign.id }, "assistantActionService:conditionNotFound"],
    ];
    for (const [tool, args, code] of cases) {
      const result = await resultOf(await call(token, tool, args));
      expect(result, `${tool} ${JSON.stringify(args)}`).toMatchObject({
        isError: true,
        structuredContent: { error: { code } },
      });
    }
    expect(
      textOf(await resultOf(await call(token, "resolve_condition", { conditionId: foreign.id }))),
    ).toContain("wasn't found in this care group");

    // Nothing was written: the live condition is untouched, the other group's too, no change entries.
    expect(ok(await recipientConditionService.getById(w.owner.ctx, live.id))).toMatchObject({
      name: "Asthma",
      status: "active",
    });
    expect(ok(await recipientConditionService.getById(elsewhere.ctx, foreign.id))).toMatchObject({
      status: "active",
      name: "Foreign",
    });
    expect((await w.groupEntries()).filter((e) => e.kind === "conditionChange")).toHaveLength(2);
  });

  it("refuse a note ahead and point at add_todo, writing nothing", async () => {
    const w = await world();
    const token = w.writer.tokens.access_token;
    const refusal = "A note can't be in the future. Use add_todo with a due day for something to do later.";
    const ahead = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString();
    const before = (await w.groupEntries()).length;

    const added = await resultOf(
      await callTool(token, "add_note", { text: "Call later", occurredAt: ahead }),
    );
    expect(added.isError).toBe(true);
    expect(textOf(added)).toContain(refusal);
    expect((await w.groupEntries()).length).toBe(before);

    // Moving a note's time ahead is refused the same way.
    const note = await resultOf(await callTool(token, "add_note", { text: "Happened", title: "Visit" }));
    const [noteId] = note.structuredContent.entryIds!;
    const moved = await resultOf(
      await callTool(token, "update_entry", { entryId: noteId, occurredAt: ahead }),
    );
    expect(moved.isError).toBe(true);
    expect(textOf(moved)).toContain(refusal);
    expect(new Date((await w.entry(noteId!))!.occurredAt).getTime()).toBeLessThan(Date.now());

    // A note stored ahead (before notes became past-only) takes no more lines.
    const recipient = ok(
      await careRecipientService.list(w.owner.ctx, {
        filter: { groupId: { type: "eq", value: w.group.id } },
      }),
    ).data[0]!;
    const stored = ok(
      await timelineEntryModel.create({
        authUser: SYSTEM_USER,
        data: {
          groupId: w.group.id,
          recipientId: recipient.id,
          kind: "note",
          title: "Old reminder",
          occurredAt: ahead,
          timeZone: "America/Los_Angeles",
        },
      }),
    )!;
    const appended = await resultOf(
      await callTool(token, "append_to_entry", { entryId: stored.id, lines: [{ text: "More" }] }),
    );
    expect(appended.isError).toBe(true);
    expect(textOf(appended)).toContain(refusal);
    expect((await w.entry(stored.id))?.body ?? null).toBeNull();

    // An event ahead and a todo with a due day still work.
    const event = await resultOf(await callTool(token, "add_event", { title: "Dentist", occurredAt: ahead }));
    expect(event.isError).toBeUndefined();
    const todo = await resultOf(
      await callTool(token, "add_todo", { title: "Call later", dueOn: "2027-01-10" }),
    );
    expect(todo.isError).toBeUndefined();
  });
});
