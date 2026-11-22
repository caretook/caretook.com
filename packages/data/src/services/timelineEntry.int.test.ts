import type { TimelineEntryCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createWorld, newYDoc, ok, system, typeParagraph } from "../../test/fixtures";
import { isError } from "../errors";
import { noteUpdateModel, timelineEntryModel } from "../models";
import { careGroupService, careRecipientService, noteDocumentService, timelineEntryService } from ".";

// Every test builds its own group and users, so tests never depend on each other.

const ROLES = ["owner", "admin", "caretaker", "viewer"] as const;
const WRITERS = ["owner", "admin", "caretaker"] as const;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const { u, group, recipient } = await createWorld({ extras: ["outsider", "staff"] });
  const note = (overrides: Partial<TimelineEntryCreateInput> = {}) =>
    ({
      groupId: group.id,
      kind: "note",
      title: "Ate lunch",
      occurredAt: "2026-11-17T12:00:00.000Z",
      timeZone: "America/Los_Angeles",
      ...overrides,
    }) as TimelineEntryCreateInput;
  const addNote = async (overrides: Partial<TimelineEntryCreateInput> = {}) => {
    const entry = ok(await timelineEntryService.create(u.caretaker.ctx, note(overrides)));
    if (!entry) throw new Error("entry not readable");
    return entry;
  };
  return { u, group, recipient, note, addNote };
};

describe("reading", () => {
  it("shows entries to every member, and nobody else", async () => {
    const { u, group, addNote } = await setup();
    const entry = await addNote();

    for (const role of ROLES) {
      expect(await timelineEntryService.getById(u[role].ctx, entry.id)).toMatchObject({ id: entry.id });
      const page = ok(await timelineEntryService.list(u[role].ctx, { groupId: group.id }));
      expect(page.data.map((e) => e.id)).toEqual([entry.id]);
    }
    for (const role of ["outsider", "staff"] as const) {
      expect(await timelineEntryService.getById(u[role].ctx, entry.id)).toBeNull();
      expect(ok(await timelineEntryService.list(u[role].ctx, { groupId: group.id })).data).toEqual([]);
    }
  });

  it("reads a note's whole text while its last updates wait for compaction (B-312)", async () => {
    const { u, group, addNote } = await setup();
    const entry = await addNote({ title: null });
    ok(await noteDocumentService.create(u.caretaker.ctx, { id: entry.id, groupId: group.id }));
    const ydoc = newYDoc();
    const append = async (line: string) =>
      ok(
        await noteDocumentService.appendUpdate(u.caretaker.ctx, {
          id: randomUUID(),
          groupId: group.id,
          documentId: entry.id,
          data: typeParagraph(ydoc, line),
        }),
      );
    // One line compacted, then a few typed in a short session that never reached a compaction.
    await append("Ate lunch");
    ok(await noteDocumentService.compact(entry.id));
    for (const line of ["Napped after", "Walked to the park"]) await append(line);
    const pending = ok(
      await noteUpdateModel.list({ ...system, filter: { documentId: { type: "eq", value: entry.id } } }),
    );
    expect(pending.data).toHaveLength(2);

    const text = "Ate lunch\nNapped after\nWalked to the park";
    for (const role of ROLES) {
      const page = ok(await timelineEntryService.list(u[role].ctx, { groupId: group.id }));
      expect(page.data.map((e) => e.body)).toEqual([text]);
      expect(await timelineEntryService.getById(u[role].ctx, entry.id)).toMatchObject({ body: text });
    }
    // Reading changes nothing: the updates still wait for the upload path's compaction.
    const after = ok(
      await noteUpdateModel.list({ ...system, filter: { documentId: { type: "eq", value: entry.id } } }),
    );
    expect(after.data).toHaveLength(2);
  });

  it("rejects unauthenticated callers", async () => {
    const { group } = await setup();
    expect(codeOf(await timelineEntryService.list({ authUser: null }, { groupId: group.id }))).toBe(
      "permissions:unauthenticated",
    );
  });
});

describe("creating", () => {
  it("lets writers add entries, but not viewers or outsiders", async () => {
    const { u, recipient, note } = await setup();
    for (const role of WRITERS) {
      const entry = ok(await timelineEntryService.create(u[role].ctx, note()));
      expect(entry).toMatchObject({ recipientId: recipient.id, createdBy: u[role].user.id, deletedAt: null });
    }
    for (const role of ["viewer", "outsider", "staff"] as const) {
      expect(codeOf(await timelineEntryService.create(u[role].ctx, note()))).toBe("permissions:unauthorized");
    }
    expect(codeOf(await timelineEntryService.create({ authUser: null }, note()))).toBe(
      "permissions:unauthenticated",
    );
  });

  it("keeps a client-supplied id (offline clients generate their own)", async () => {
    const { addNote } = await setup();
    const id = crypto.randomUUID();
    expect((await addNote({ id })).id).toBe(id);
  });

  it("only accepts a recipient from the entry's group", async () => {
    const { u, recipient, note } = await setup();
    const other = await createGroup(u.caretaker);

    expect(
      codeOf(await timelineEntryService.create(u.caretaker.ctx, note({ recipientId: other.recipient.id }))),
    ).toBe("timelineEntryService:recipientNotInGroup");
    expect(
      ok(await timelineEntryService.create(u.caretaker.ctx, note({ recipientId: recipient.id }))),
    ).toMatchObject({ recipientId: recipient.id });
  });

  it("explains when the group has no recipient yet", async () => {
    const { u, note } = await setup();
    const { group } = ok(await careGroupService.create(u.caretaker.ctx, { name: "No recipient" }));
    expect(codeOf(await timelineEntryService.create(u.caretaker.ctx, note({ groupId: group!.id })))).toBe(
      "timelineEntryService:noRecipient",
    );
  });

  it("validates content per kind", async () => {
    const { u, note } = await setup();
    const invalid = [
      note({ body: "Ate lunch" }), // a note's text is its document, not a body
      note({ kind: "event", title: " " }), // an event needs a title
      note({ kind: "symptom", body: "x" }), // a symptom needs details.name
      note({ kind: "symptom", details: { name: "Pain", severity: 11 } }),
      note({ kind: "symptom", details: { name: "Pain", extra: true } as never }),
      note({ details: { name: "Pain" } }), // notes have no details
      note({ timeZone: "Mars/Olympus_Mons" }),
      note({ occurredAt: "yesterday" }),
      note({ kind: "appointment" as never }),
    ];
    for (const input of invalid) {
      expect(codeOf(await timelineEntryService.create(u.caretaker.ctx, input))).toBe(
        "timelineEntryService:invalid",
      );
    }

    expect(
      ok(
        await timelineEntryService.create(
          u.caretaker.ctx,
          note({ kind: "symptom", body: undefined, details: { name: " Knee pain ", severity: 0 } }),
        ),
      ),
    ).toMatchObject({ kind: "symptom", details: { name: "Knee pain", severity: 0 } });
  });

  it("can't create an entry that's already deleted", async () => {
    const { u, recipient, group } = await setup();
    const res = await timelineEntryModel.create({
      ...u.caretaker.ctx,
      data: {
        groupId: group.id,
        recipientId: recipient.id,
        kind: "note",
        body: "x",
        occurredAt: "2026-11-17T12:00:00.000Z",
        timeZone: "UTC",
        deletedAt: "2026-11-17T12:00:00.000Z",
      },
    });
    expect(codeOf(res)).toBe("permissions:fieldUnauthorized");
  });
});

describe("updating", () => {
  it("lets any writer edit any entry, but not viewers or outsiders", async () => {
    const { u, addNote } = await setup();
    const entry = await addNote(); // written by the caretaker

    for (const role of ["owner", "admin"] as const) {
      const updated = ok(
        await timelineEntryService.update(u[role].ctx, entry.id, { title: `Edited by ${role}` }),
      );
      expect(updated).toMatchObject({ title: `Edited by ${role}`, updatedBy: u[role].user.id });
    }
    expect(codeOf(await timelineEntryService.update(u.viewer.ctx, entry.id, { title: "x" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await timelineEntryService.update(u.outsider.ctx, entry.id, { title: "x" }))).toBe(
      "timelineEntryService:notFound",
    );
  });

  it("never changes the group, recipient or kind", async () => {
    const { u, addNote } = await setup();
    const entry = await addNote();
    const other = await createGroup(u.caretaker);

    for (const patch of [
      { kind: "event" },
      { groupId: other.group.id },
      { recipientId: other.recipient.id },
    ]) {
      expect(codeOf(await timelineEntryService.update(u.caretaker.ctx, entry.id, patch as never))).toBe(
        "timelineEntryService:invalid",
      );
    }
    // The model layer refuses too, for callers that skip the service.
    expect(
      codeOf(
        await timelineEntryModel.update({
          ...u.caretaker.ctx,
          filter: { id: { type: "eq", value: entry.id } },
          data: { groupId: other.group.id },
        }),
      ),
    ).toBe("permissions:fieldUnauthorized");
  });

  it("keeps the merged entry valid for its kind", async () => {
    const { u, addNote } = await setup();
    const note = await addNote();
    expect(codeOf(await timelineEntryService.update(u.caretaker.ctx, note.id, { body: "Ate lunch" }))).toBe(
      "timelineEntryService:invalid",
    );
    expect(
      codeOf(await timelineEntryService.update(u.caretaker.ctx, note.id, { details: { name: "Pain" } })),
    ).toBe("timelineEntryService:invalid");

    const symptom = await addNote({
      kind: "symptom",
      body: undefined,
      details: { name: "Pain", severity: 2 },
    });
    expect(
      codeOf(
        await timelineEntryService.update(u.caretaker.ctx, symptom.id, {
          details: { name: "Pain", severity: 11 },
        }),
      ),
    ).toBe("timelineEntryService:invalid");
    expect(
      ok(
        await timelineEntryService.update(u.caretaker.ctx, symptom.id, {
          details: { name: "Pain", severity: 5 },
          occurredAt: "2026-11-16T08:30:00-08:00",
        }),
      ),
    ).toMatchObject({ details: { name: "Pain", severity: 5 } });
  });
});

describe("future dates", () => {
  const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();
  const DAY = 86_400_000;

  it("refuses a note ahead on create, with the message on occurredAt", async () => {
    const { u, note } = await setup();
    const res = await timelineEntryService.create(u.caretaker.ctx, note({ occurredAt: ahead(DAY) }));
    expect(codeOf(res)).toBe("timelineEntryService:invalid");
    expect(JSON.stringify((res as { meta?: unknown }).meta)).toContain("Can't be in the future");
    // Within the server's hour of skew, a note is fine.
    ok(await timelineEntryService.create(u.caretaker.ctx, note({ occurredAt: ahead(30 * 60_000) })));
  });

  it("refuses moving a note's time ahead, and lets an event go ahead", async () => {
    const { u, addNote } = await setup();
    const entry = await addNote();
    expect(
      codeOf(await timelineEntryService.update(u.caretaker.ctx, entry.id, { occurredAt: ahead(DAY) })),
    ).toBe("timelineEntryService:invalid");
    const event = await addNote({ kind: "event", title: "Eye exam", occurredAt: ahead(7 * DAY) });
    ok(await timelineEntryService.update(u.caretaker.ctx, event.id, { occurredAt: ahead(8 * DAY) }));
  });

  it("keeps a stored future note editable while its time doesn't move", async () => {
    const { u, group, recipient } = await setup();
    const occurredAt = ahead(3 * DAY);
    const stored = ok(
      await timelineEntryModel.create({
        ...system,
        data: {
          groupId: group.id,
          recipientId: recipient.id,
          kind: "note",
          title: "Call the pharmacy",
          occurredAt,
          timeZone: "America/Los_Angeles",
        },
      }),
    )!;
    expect(
      ok(await timelineEntryService.update(u.caretaker.ctx, stored.id, { title: "Call the pharmacy today" })),
    ).toMatchObject({ title: "Call the pharmacy today" });
    expect(
      codeOf(await timelineEntryService.update(u.caretaker.ctx, stored.id, { occurredAt: ahead(4 * DAY) })),
    ).toBe("timelineEntryService:invalid");
  });
});

describe("vitals", () => {
  const readings = [
    { type: "bloodPressure", systolic: 128, diastolic: 82 },
    { type: "heartRate", value: 71 },
  ] as const;

  it("stores a sitting's readings, and lets a writer change them", async () => {
    const { u, addNote } = await setup();
    const vital = await addNote({ kind: "vital", body: undefined, details: { readings: [...readings] } });
    expect(vital).toMatchObject({ kind: "vital", details: { readings } });

    const updated = ok(
      await timelineEntryService.update(u.admin.ctx, vital.id, {
        details: { readings: [{ type: "temperature", value: 38.1 }] },
      }),
    );
    expect(updated).toMatchObject({ details: { readings: [{ type: "temperature", value: 38.1 }] } });
  });

  it("rejects impossible values, no readings, or symptom details", async () => {
    const { u, note, addNote } = await setup();
    const bad = (details: unknown) =>
      timelineEntryService.create(
        u.caretaker.ctx,
        note({ kind: "vital", body: undefined, details } as never),
      );
    expect(codeOf(await bad({ readings: [{ type: "heartRate", value: 999 }] }))).toBe(
      "timelineEntryService:invalid",
    );
    expect(codeOf(await bad({ readings: [] }))).toBe("timelineEntryService:invalid");
    expect(codeOf(await bad({ name: "Pain" }))).toBe("timelineEntryService:invalid");

    const vital = await addNote({ kind: "vital", body: undefined, details: { readings: [...readings] } });
    expect(
      codeOf(await timelineEntryService.update(u.caretaker.ctx, vital.id, { details: { name: "Pain" } })),
    ).toBe("timelineEntryService:invalid");
    expect(codeOf(await timelineEntryService.update(u.caretaker.ctx, vital.id, { details: null }))).toBe(
      "timelineEntryService:invalid",
    );
  });

  it("is read-only for viewers", async () => {
    const { u, note } = await setup();
    const input = note({ kind: "vital", body: undefined, details: { readings: [...readings] } } as never);
    expect(codeOf(await timelineEntryService.create(u.viewer.ctx, input))).toBe("permissions:unauthorized");
  });
});

describe("deleting", () => {
  it("soft-deletes for writers: hidden by default, visible on request", async () => {
    const { u, group, addNote } = await setup();
    for (const role of WRITERS) {
      const entry = await addNote();
      expect(ok(await timelineEntryService.remove(u[role].ctx, entry.id))).toEqual({ ids: [entry.id] });

      expect(await timelineEntryService.getById(u.viewer.ctx, entry.id)).toBeNull();
      expect(ok(await timelineEntryService.list(u.viewer.ctx, { groupId: group.id })).data).toEqual([]);

      const deleted = ok(
        await timelineEntryService.getById(u.viewer.ctx, entry.id, { includeDeleted: true }),
      );
      expect(deleted).toMatchObject({ id: entry.id, updatedBy: u[role].user.id });
      expect(deleted?.deletedAt).toBeTruthy();
    }
  });

  it("won't delete for viewers or outsiders, or delete twice", async () => {
    const { u, addNote } = await setup();
    const entry = await addNote();
    // A viewer sees it, so is refused; outsiders learn nothing.
    expect(codeOf(await timelineEntryService.remove(u.viewer.ctx, entry.id))).toBe(
      "permissions:unauthorized",
    );
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await timelineEntryService.remove(u[role].ctx, entry.id))).toBe(
        "timelineEntryService:notFound",
      );
    }
    ok(await timelineEntryService.remove(u.caretaker.ctx, entry.id));
    expect(codeOf(await timelineEntryService.remove(u.caretaker.ctx, entry.id))).toBe(
      "timelineEntryService:notFound",
    );
  });

  it("can't edit a deleted entry", async () => {
    const { u, addNote } = await setup();
    const entry = await addNote();
    ok(await timelineEntryService.remove(u.caretaker.ctx, entry.id));
    expect(codeOf(await timelineEntryService.update(u.caretaker.ctx, entry.id, { title: "x" }))).toBe(
      "timelineEntryService:notFound",
    );
  });

  it("only lets the system purge", async () => {
    const { u, addNote } = await setup();
    const entry = await addNote();
    const byId = { filter: { id: { type: "eq", value: entry.id } } } as const;

    expect(codeOf(await timelineEntryModel.purge({ ...u.owner.ctx, ...byId }))).toBe(
      "permissions:unauthorized",
    );
    expect(ok(await timelineEntryModel.purge({ ...system, ...byId }))).toEqual({ ids: [entry.id] });
    expect(await timelineEntryService.getById(system, entry.id, { includeDeleted: true })).toBeNull();
  });

  it("keeps a recipient with entries from being deleted, but group deletion cascades", async () => {
    const { u, group, recipient, addNote } = await setup();
    const entry = await addNote();

    expect(
      isError(
        await careRecipientService.remove(u.owner.ctx, {
          filter: { id: { type: "eq", value: recipient.id } },
        }),
      ),
    ).toBe(true);

    ok(await careGroupService.remove(u.owner.ctx, { filter: { id: { type: "eq", value: group.id } } }));
    expect(await timelineEntryService.getById(system, entry.id, { includeDeleted: true })).toBeNull();
  });
});

describe("listing", () => {
  const hour = (h: number) => `2026-11-17T${String(h).padStart(2, "0")}:00:00.000Z`;

  it("pages newest first with a stable cursor, ties broken by id", async () => {
    const { u, group, addNote } = await setup();
    // Two entries share 10:00 to exercise the id tiebreak.
    for (const h of [8, 9, 10, 10, 11]) await addNote({ occurredAt: hour(h) });

    const seen: { id: string; occurredAt: string }[] = [];
    let cursor: string | null = null;
    do {
      const page: { data: typeof seen; nextCursor: string | null } = ok(
        await timelineEntryService.list(u.viewer.ctx, { groupId: group.id, limit: 2, cursor }),
      );
      expect(page.data.length).toBeLessThanOrEqual(2);
      seen.push(...page.data);
      cursor = page.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(5);
    expect(new Set(seen.map((e) => e.id)).size).toBe(5);
    const times = seen.map((e) => new Date(e.occurredAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const tied = seen.filter((e) => new Date(e.occurredAt).toISOString() === hour(10)).map((e) => e.id);
    expect(tied).toEqual([...tied].sort().reverse());
  });

  it("doesn't skip older entries added between page loads", async () => {
    const { u, group, addNote } = await setup();
    for (const h of [9, 10, 11]) await addNote({ occurredAt: hour(h) });

    const first = ok(await timelineEntryService.list(u.viewer.ctx, { groupId: group.id, limit: 2 }));
    const late = await addNote({ occurredAt: hour(8) }); // an offline device catches up
    const second = ok(
      await timelineEntryService.list(u.viewer.ctx, {
        groupId: group.id,
        limit: 2,
        cursor: first.nextCursor,
      }),
    );
    expect(second.data.map((e) => e.id)).toContain(late.id);
    expect(second.data).toHaveLength(2);
  });

  it("filters by kind and time range", async () => {
    const { u, group, addNote } = await setup();
    await addNote({ occurredAt: hour(8) });
    const symptom = await addNote({
      occurredAt: hour(9),
      kind: "symptom",
      body: undefined,
      details: { name: "Pain" },
    });
    const event = await addNote({ occurredAt: hour(10), kind: "event", title: "Visit" });

    const ids = async (opts: Parameters<typeof timelineEntryService.list>[1]) =>
      ok(await timelineEntryService.list(u.viewer.ctx, opts)).data.map((e) => e.id);

    expect(await ids({ groupId: group.id, kinds: ["symptom", "event"] })).toEqual([event.id, symptom.id]);
    expect(await ids({ groupId: group.id, from: hour(9), to: hour(10) })).toEqual([symptom.id]);
  });

  it("rejects a malformed cursor", async () => {
    const { u, group } = await setup();
    for (const cursor of ["not-a-cursor", Buffer.from('["x","y"]').toString("base64url")]) {
      expect(codeOf(await timelineEntryService.list(u.viewer.ctx, { groupId: group.id, cursor }))).toBe(
        "timelineEntryModel:badCursor",
      );
    }
  });
});

describe("latest vitals", () => {
  const vital = (occurredAt: string, readings: unknown[]) =>
    ({ kind: "vital", body: undefined, occurredAt, details: { readings } }) as never;

  it("returns the newest reading of each type, skipping deleted entries", async () => {
    const { u, group, addNote } = await setup();
    await addNote(
      vital("2026-11-15T08:00:00.000Z", [
        { type: "heartRate", value: 60 },
        { type: "spo2", value: 97 },
      ]),
    );
    const newer = await addNote(vital("2026-11-16T08:00:00.000Z", [{ type: "heartRate", value: 70 }]));
    const deleted = await addNote(vital("2026-11-17T08:00:00.000Z", [{ type: "heartRate", value: 99 }]));
    await addNote({ kind: "note", title: "Not a vital", occurredAt: "2026-11-17T09:00:00.000Z" });
    ok(await timelineEntryService.remove(u.caretaker.ctx, deleted.id));

    const rows = ok(await timelineEntryService.latestVitals(u.viewer.ctx, { groupId: group.id }));
    const byType = Object.fromEntries(rows.map((r) => [r.reading.type, r]));
    expect(Object.keys(byType).sort()).toEqual(["heartRate", "spo2"]);
    expect(byType.heartRate).toMatchObject({ entryId: newer.id, reading: { value: 70 } });
    expect(byType.spo2).toMatchObject({ reading: { value: 97 } });
    expect(new Date(byType.heartRate!.occurredAt).toISOString()).toBe("2026-11-16T08:00:00.000Z");
  });

  it("shows outsiders and staff nothing", async () => {
    const { u, group, addNote } = await setup();
    await addNote(vital("2026-11-16T08:00:00.000Z", [{ type: "heartRate", value: 70 }]));
    for (const actor of [u.outsider, u.staff]) {
      expect(ok(await timelineEntryService.latestVitals(actor.ctx, { groupId: group.id }))).toEqual([]);
    }
  });
});

describe("upsert (the PowerSync upload path)", () => {
  const upsertInput = (s: Awaited<ReturnType<typeof setup>>, id = randomUUID()) =>
    ({ ...s.note(), id }) as Parameters<typeof timelineEntryService.upsert>[1];

  it("creates an entry with the client's id, and a replay changes nothing", async () => {
    const s = await setup();
    const input = upsertInput(s);

    const first = ok(await timelineEntryService.upsert(s.u.caretaker.ctx, input));
    expect(first).toMatchObject({ id: input.id, title: "Ate lunch", createdBy: s.u.caretaker.user.id });

    const again = ok(await timelineEntryService.upsert(s.u.caretaker.ctx, input));
    expect(again).toMatchObject({ id: input.id, title: "Ate lunch" });
    const page = ok(await timelineEntryService.list(s.u.owner.ctx, { groupId: s.group.id }));
    expect(page.data.map((e) => e.id)).toEqual([input.id]);
  });

  it("updates the content of an existing entry, validated as usual", async () => {
    const s = await setup();
    const input = upsertInput(s);
    ok(await timelineEntryService.upsert(s.u.caretaker.ctx, input));

    const edited = ok(await timelineEntryService.upsert(s.u.admin.ctx, { ...input, title: "Ate half" }));
    expect(edited).toMatchObject({ title: "Ate half", updatedBy: s.u.admin.user.id });

    expect(codeOf(await timelineEntryService.upsert(s.u.admin.ctx, { ...input, body: "" } as never))).toBe(
      "timelineEntryService:invalid",
    );
  });

  it("refuses to change group, kind or recipient", async () => {
    const s = await setup();
    const input = upsertInput(s);
    ok(await timelineEntryService.upsert(s.u.caretaker.ctx, input));
    const other = await createGroup(s.u.caretaker);

    const moved = { ...input, groupId: other.group.id };
    expect(codeOf(await timelineEntryService.upsert(s.u.caretaker.ctx, moved))).toBe(
      "timelineEntryService:immutable",
    );
    const asEvent = { ...input, kind: "event", title: "Lunch" } as typeof input;
    expect(codeOf(await timelineEntryService.upsert(s.u.caretaker.ctx, asEvent))).toBe(
      "timelineEntryService:immutable",
    );
    const recipient = { ...input, recipientId: other.recipient.id };
    expect(codeOf(await timelineEntryService.upsert(s.u.caretaker.ctx, recipient))).toBe(
      "timelineEntryService:immutable",
    );
  });

  it("keeps a deleted entry deleted", async () => {
    const s = await setup();
    const input = upsertInput(s);
    ok(await timelineEntryService.upsert(s.u.caretaker.ctx, input));
    ok(await timelineEntryService.remove(s.u.caretaker.ctx, input.id));

    const late = ok(await timelineEntryService.upsert(s.u.caretaker.ctx, { ...input, title: "Late edit" }));
    expect(late).toMatchObject({ title: "Ate lunch" });
    expect(late?.deletedAt).not.toBeNull();
  });

  it("refuses viewers and outsiders, and doesn't reveal another group's ids", async () => {
    const s = await setup();
    expect(codeOf(await timelineEntryService.upsert(s.u.viewer.ctx, upsertInput(s)))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await timelineEntryService.upsert(s.u.outsider.ctx, upsertInput(s)))).toBe(
      "permissions:unauthorized",
    );

    // An outsider reusing an id that exists in a group they can't see.
    const taken = upsertInput(s);
    ok(await timelineEntryService.upsert(s.u.caretaker.ctx, taken));
    const theirs = await createGroup(s.u.outsider);
    const reused = { ...taken, groupId: theirs.group.id };
    expect(codeOf(await timelineEntryService.upsert(s.u.outsider.ctx, reused))).toBe(
      "permissions:unauthorized",
    );
  });
});
