import type { AuthUser } from "@caretook/data";

import {
  DEFAULT_TIMELINE_VIEW,
  DEFAULT_UNITS,
  isError,
  noteDocumentService,
  timelineEntryService,
} from "@caretook/data";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../data/test/fixtures";
import { createRpcHandler, router } from ".";

// Each test makes its own users and group, so tests never depend on each other.

const clientFor = (authUser: AuthUser | null) => createRouterClient(router, { context: { authUser } });

/** An AuthUser as getAuthUser would build it, with the user's group roles. */
const withRoles = (authUser: AuthUser, groupRoles: AuthUser["groupRoles"]) => ({ ...authUser, groupRoles });

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  return {
    group,
    recipient,
    owner: { ...owner, api: clientFor(withRoles(owner.ctx.authUser, { [group.id]: "owner" })) },
    viewer: { ...viewer, api: clientFor(withRoles(viewer.ctx.authUser, { [group.id]: "viewer" })) },
    outsider: { ...outsider, api: clientFor(withRoles(outsider.ctx.authUser, {})) },
  };
};

const note = (groupId: string) => ({
  groupId,
  kind: "note" as const,
  title: "Ate lunch",
  occurredAt: "2026-11-17T12:00:00-08:00",
  timeZone: "America/Los_Angeles",
});

/** The oRPC error a call rejects with. */
const rejection = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ORPCError)) throw new Error(`Expected an ORPCError, got ${String(error)}`);
  return error as ORPCError<string, { code?: string; issues?: { path: string; message: string }[] }>;
};

describe("auth", () => {
  it("rejects every procedure without a user", async () => {
    const api = clientFor(null);
    expect((await rejection(api.me.get())).code).toBe("UNAUTHORIZED");
    expect((await rejection(api.careGroup.listMine())).code).toBe("UNAUTHORIZED");
  });

  it("returns the signed-in user with their group roles", async () => {
    const { owner, group } = await setup();
    expect(await owner.api.me.get()).toEqual({
      id: owner.user.id,
      email: owner.user.email,
      name: "owner",
      image: null,
      groupRoles: { [group.id]: "owner" },
      preferences: {},
      units: DEFAULT_UNITS,
      timelineView: DEFAULT_TIMELINE_VIEW,
    });
  });
});

describe("me.updatePreferences", () => {
  it("merges unit choices into the user's own preferences", async () => {
    const { owner, viewer } = await setup();
    expect(await owner.api.me.updatePreferences({ units: { temperature: "c" } })).toEqual({
      preferences: { units: { temperature: "c" } },
      units: { ...DEFAULT_UNITS, temperature: "c" },
      timelineView: DEFAULT_TIMELINE_VIEW,
    });
    await owner.api.me.updatePreferences({ units: { weight: "kg" } });
    expect((await owner.api.me.get()).units).toEqual({ ...DEFAULT_UNITS, temperature: "c", weight: "kg" });
    // Someone else's settings are untouched.
    expect((await viewer.api.me.get()).units).toEqual(DEFAULT_UNITS);
  });

  it("saves the timeline view without touching units", async () => {
    const { owner } = await setup();
    await owner.api.me.updatePreferences({ units: { temperature: "c" } });
    await owner.api.me.updatePreferences({ timelineView: "cards" });
    const me = await owner.api.me.get();
    expect(me.timelineView).toBe("cards");
    expect(me.units.temperature).toBe("c");
  });

  it("rejects unknown units and unknown settings", async () => {
    const { owner } = await setup();
    const bad = [{ units: { temperature: "k" } }, { theme: "dark" }, { timelineView: "grid" }] as never[];
    for (const input of bad) {
      expect((await rejection(owner.api.me.updatePreferences(input))).code).toBe("BAD_REQUEST");
    }
  });
});

describe("careGroup", () => {
  it("lists only the user's groups, with role and recipient", async () => {
    const { viewer, outsider, group, recipient } = await setup();
    expect(await viewer.api.careGroup.listMine()).toEqual([
      {
        id: group.id,
        name: group.name,
        role: "viewer",
        recipient: { id: recipient.id, displayName: recipient.displayName },
      },
    ]);
    expect(await outsider.api.careGroup.listMine()).toEqual([]);
  });

  it("shows members as public profiles, without email", async () => {
    const { viewer, outsider, group, owner } = await setup();
    const members = await viewer.api.careGroup.members({ groupId: group.id });
    expect(members).toEqual(
      expect.arrayContaining([
        { userId: owner.user.id, role: "owner", name: "owner", image: null },
        { userId: viewer.user.id, role: "viewer", name: "viewer", image: null },
      ]),
    );
    expect(JSON.stringify(members)).not.toContain("@example.com");
    expect(await outsider.api.careGroup.members({ groupId: group.id })).toEqual([]);
  });
});

describe("timeline", () => {
  it("creates, lists, edits and deletes, with ISO timestamps", async () => {
    const { owner, viewer, group, recipient } = await setup();

    const created = await owner.api.timeline.create(note(group.id));
    expect(created).toMatchObject({ recipientId: recipient.id, occurredAt: "2026-11-17T20:00:00.000Z" });
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const page = await viewer.api.timeline.list({ groupId: group.id });
    expect(page).toEqual({ data: [created], nextCursor: null });

    const updated = await owner.api.timeline.update({ id: created.id, data: { title: "Ate all of lunch" } });
    expect(updated.title).toBe("Ate all of lunch");

    expect(await owner.api.timeline.remove({ id: created.id })).toEqual({ id: created.id });
    expect((await viewer.api.timeline.list({ groupId: group.id })).data).toEqual([]);
    const deleted = await viewer.api.timeline.list({ groupId: group.id, includeDeleted: true });
    expect(deleted.data[0]?.deletedAt).toMatch(/Z$/);
  });

  it("maps permission and not-found errors to HTTP-style codes", async () => {
    const { owner, viewer, outsider, group } = await setup();
    expect((await rejection(viewer.api.timeline.create(note(group.id)))).code).toBe("FORBIDDEN");
    expect((await rejection(outsider.api.timeline.create(note(group.id)))).code).toBe("FORBIDDEN");

    const entry = await owner.api.timeline.create(note(group.id));
    const missing = await rejection(outsider.api.timeline.remove({ id: entry.id }));
    expect(missing.code).toBe("NOT_FOUND");
    expect(missing.data).toEqual({ code: "timelineEntryService:notFound" });
  });

  it("returns validation issues as BAD_REQUEST", async () => {
    const { owner, group } = await setup();
    // Caught by the procedure's input schema.
    expect((await rejection(owner.api.timeline.create({ ...note(group.id), body: "" } as never))).code).toBe(
      "BAD_REQUEST",
    );
    // Caught by the service, against the merged entry.
    const entry = await owner.api.timeline.create(note(group.id));
    const error = await rejection(owner.api.timeline.update({ id: entry.id, data: { body: "Ate lunch" } }));
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.data?.code).toBe("timelineEntryService:invalid");
    expect(error.data?.issues?.[0]).toMatchObject({ path: "body" });
  });

  it("pages with an opaque cursor", async () => {
    const { owner, group } = await setup();
    for (const occurredAt of ["2026-11-17T08:00:00Z", "2026-11-17T09:00:00Z", "2026-11-17T10:00:00Z"]) {
      await owner.api.timeline.create({ ...note(group.id), occurredAt });
    }
    const first = await owner.api.timeline.list({ groupId: group.id, limit: 2 });
    const second = await owner.api.timeline.list({ groupId: group.id, limit: 2, cursor: first.nextCursor });
    expect([...first.data, ...second.data]).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
  });
});

describe("timeline: a note's or event's text is its document", () => {
  /** A live document on `entryId` with one paragraph per line, compacted unless `pending`. */
  const writeDocument = async (
    ctx: { authUser: AuthUser },
    groupId: string,
    entryId: string,
    lines: string[],
    { pending = false } = {},
  ) => {
    ok(await noteDocumentService.create(ctx, { id: entryId, groupId }));
    const ydoc = newYDoc();
    for (const line of lines) {
      const data = typeParagraph(ydoc, line);
      ok(
        await noteDocumentService.appendUpdate(ctx, { id: randomUUID(), groupId, documentId: entryId, data }),
      );
    }
    if (!pending) ok(await noteDocumentService.compact(entryId));
  };

  const at = (hour: number) => `2026-11-17T${String(hour).padStart(2, "0")}:00:00Z`;

  it("returns the document text as body for notes and events, and the stored body otherwise", async () => {
    const { owner, viewer, group } = await setup();
    const api = owner.api.timeline;
    const noteEntry = await api.create({ ...note(group.id), occurredAt: at(8) });
    const eventEntry = await api.create({
      ...note(group.id),
      kind: "event",
      title: "Dr. Lee visit",
      occurredAt: at(9),
    });
    const symptom = await api.create({
      ...note(group.id),
      kind: "symptom",
      title: null,
      body: "After lunch",
      details: { name: "Dizziness", severity: 3 },
      occurredAt: at(10),
    });
    const vital = await api.create({
      ...note(group.id),
      kind: "vital",
      title: null,
      body: "Resting",
      details: { readings: [{ type: "heartRate", value: 71 }] },
      occurredAt: at(11),
    });
    await writeDocument(owner.ctx, group.id, noteEntry.id, ["Ate lunch", "Napped after"]);
    await writeDocument(owner.ctx, group.id, eventEntry.id, ["BP looked fine"]);

    const { data } = await viewer.api.timeline.list({ groupId: group.id });
    const bodies = Object.fromEntries(data.map((e) => [e.id, e.body]));
    expect(bodies).toEqual({
      [noteEntry.id]: "Ate lunch\nNapped after",
      [eventEntry.id]: "BP looked fine",
      [symptom.id]: "After lunch",
      [vital.id]: "Resting",
    });

    // Filtered lists and edits return the same text.
    const notes = await viewer.api.timeline.list({ groupId: group.id, kinds: ["note"] });
    expect(notes.data.map((e) => e.body)).toEqual(["Ate lunch\nNapped after"]);
    const renamed = await api.update({ id: eventEntry.id, data: { title: "Dr. Lee follow-up" } });
    expect(renamed).toMatchObject({ title: "Dr. Lee follow-up", body: "BP looked fine" });
  });

  it("returns a null body, without an error, for a note whose document hasn't arrived or compacted", async () => {
    const { owner, viewer, group } = await setup();
    const waiting = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(8) });
    const pending = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(9) });
    // Only compacted text is read: pending updates (still being typed) aren't.
    await writeDocument(owner.ctx, group.id, pending.id, ["Still typing"], { pending: true });

    const { data } = await viewer.api.timeline.list({ groupId: group.id });
    expect(data.map((e) => [e.id, e.body])).toEqual([
      [pending.id, null],
      [waiting.id, null],
    ]);
    expect(await noteDocumentService.currentText(owner.ctx, pending.id)).toBe("Still typing");
  });

  it("never returns a soft-deleted entry's document text", async () => {
    const { owner, viewer, group } = await setup();
    const kept = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(8) });
    const gone = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(9) });
    await writeDocument(owner.ctx, group.id, kept.id, ["Kept"]);
    await writeDocument(owner.ctx, group.id, gone.id, ["Private thought"]);
    await owner.api.timeline.remove({ id: gone.id });

    expect((await viewer.api.timeline.list({ groupId: group.id })).data.map((e) => e.id)).toEqual([kept.id]);
    const all = await viewer.api.timeline.list({ groupId: group.id, includeDeleted: true });
    expect(all.data.map((e) => [e.id, e.body])).toEqual([
      [gone.id, null],
      [kept.id, "Kept"],
    ]);
    expect(all.data[0]?.deletedAt).toMatch(/Z$/);

    // The service's other reads hide it too.
    const entry = await timelineEntryService.getById(viewer.ctx, gone.id, { includeDeleted: true });
    expect(entry).toMatchObject({ id: gone.id, body: null });
    expect(await timelineEntryService.getById(viewer.ctx, gone.id)).toBeNull();
    for (const read of [noteDocumentService.getById, noteDocumentService.currentText]) {
      expect(await read(viewer.ctx, gone.id)).toMatchObject({ code: "noteDocumentService:notFound" });
    }
    expect((await rejection(owner.api.timeline.update({ id: gone.id, data: { title: "x" } }))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("reads documents in the actor's scope", async () => {
    const { owner, outsider, group } = await setup();
    const entry = await owner.api.timeline.create(note(group.id));
    await writeDocument(owner.ctx, group.id, entry.id, ["Members only"]);
    expect((await outsider.api.timeline.list({ groupId: group.id })).data).toEqual([]);
    expect(await timelineEntryService.getById(outsider.ctx, entry.id)).toBeNull();
    expect(await timelineEntryService.getById(owner.ctx, entry.id)).toMatchObject({ body: "Members only" });
  });
});

describe("sync.upload", () => {
  /** A row as a device's SQLite holds it: snake_case, microsecond timestamps, JSON as text. */
  const row = (groupId: string, recipientId: string) => ({
    group_id: groupId,
    recipient_id: recipientId,
    kind: "symptom",
    occurred_at: "2026-11-17T20:00:00.000000Z",
    time_zone: "America/Los_Angeles",
    title: null,
    body: "After lunch",
    details: JSON.stringify({ name: "Dizziness", severity: 3 }),
    created_by: "ignored",
  });

  it("applies a device's inserts, edits and deletes in order", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();

    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id, data: row(group.id, recipient.id) },
        { op: "PATCH", table: "timeline_entry", id, data: { body: "After a big lunch" } },
      ],
    });
    expect(res.results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    const [entry] = (await viewer.api.timeline.list({ groupId: group.id })).data;
    expect(entry).toMatchObject({
      id,
      kind: "symptom",
      body: "After a big lunch",
      occurredAt: "2026-11-17T20:00:00.000Z",
      details: { name: "Dizziness", severity: 3 },
      createdBy: owner.user.id,
    });

    // A soft delete arrives as a PATCH of deleted_at.
    const patch = {
      op: "PATCH" as const,
      table: "timeline_entry",
      id,
      data: { deleted_at: "2026-11-17 21:00:00Z" },
    };
    expect((await owner.api.sync.upload({ ops: [patch] })).results).toEqual([{ id, status: "applied" }]);
    expect((await viewer.api.timeline.list({ groupId: group.id })).data).toEqual([]);
  });

  it("is safe to replay", async () => {
    const { owner, group, recipient } = await setup();
    const id = randomUUID();
    const ops = [
      { op: "PUT" as const, table: "timeline_entry", id, data: row(group.id, recipient.id) },
      { op: "DELETE" as const, table: "timeline_entry", id },
    ];
    await owner.api.sync.upload({ ops });
    const replay = await owner.api.sync.upload({ ops });
    expect(replay.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    const all = await owner.api.timeline.list({ groupId: group.id, includeDeleted: true });
    expect(all.data).toHaveLength(1);
  });

  it("acknowledges refused changes instead of failing the batch", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const good = randomUUID();
    const res = await viewer.api.sync.upload({
      ops: [{ op: "PUT", table: "timeline_entry", id: randomUUID(), data: row(group.id, recipient.id) }],
    });
    expect(res.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });

    const mixed = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "timeline_entry",
          id: randomUUID(),
          data: { ...row(group.id, recipient.id), details: "{" },
        },
        { op: "PUT", table: "care_group", id: group.id, data: { name: "Renamed" } },
        { op: "PUT", table: "timeline_entry", id: good, data: row(group.id, recipient.id) },
        { op: "PATCH", table: "timeline_entry", id: good, data: { kind: "note" } },
      ],
    });
    expect(mixed.results).toEqual([
      expect.objectContaining({ status: "rejected", code: "timelineEntryService:invalid" }),
      expect.objectContaining({ status: "rejected", code: "sync:readOnlyTable" }),
      { id: good, status: "applied" },
      expect.objectContaining({ status: "rejected", code: "timelineEntryService:immutable" }),
    ]);
    expect((await owner.api.careGroup.listMine())[0]?.name).toBe("Test Family");
  });

  it("needs a session", async () => {
    expect((await rejection(clientFor(null).sync.upload({ ops: [] }))).code).toBe("UNAUTHORIZED");
  });

  describe("live documents", () => {
    /** An event made offline, its live document, and `n` edits: one batch, in order. */
    const offlineDocument = (groupId: string, recipientId: string, n: number) => {
      const entryId = randomUUID();
      const ydoc = newYDoc();
      const ops = [
        {
          op: "PUT" as const,
          table: "timeline_entry",
          id: entryId,
          data: { ...row(groupId, recipientId), kind: "event", title: "Dr. Lee visit", details: null },
        },
        { op: "PUT" as const, table: "note_document", id: entryId, data: { group_id: groupId } },
        ...Array.from({ length: n }, (_, i) => ({
          op: "PUT" as const,
          table: "note_update",
          id: randomUUID(),
          data: { group_id: groupId, document_id: entryId, data: typeParagraph(ydoc, `Line ${i + 1}`) },
        })),
      ];
      return { entryId, ops };
    };

    it("creates the document and its edits from one offline batch, and replays safely", async () => {
      const { owner, group, recipient } = await setup();
      const { entryId, ops } = offlineDocument(group.id, recipient.id, 2);
      const res = await owner.api.sync.upload({ ops });
      expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied", "applied"]);
      expect((await owner.api.sync.upload({ ops })).results.every((r) => r.status === "applied")).toBe(true);

      const text = await noteDocumentService.currentText(owner.ctx, entryId);
      expect(text).toBe("Line 1\nLine 2");
    });

    /** A note as a device saves it: no body (its text is the document), then its document and an edit. */
    const offlineNote = (groupId: string, recipientId: string) => {
      const entryId = randomUUID();
      const entry = {
        op: "PUT" as const,
        table: "timeline_entry",
        id: entryId,
        data: { ...row(groupId, recipientId), kind: "note", body: null, details: null },
      };
      const document = {
        op: "PUT" as const,
        table: "note_document",
        id: entryId,
        data: { group_id: groupId },
      };
      const edit = {
        op: "PUT" as const,
        table: "note_update",
        id: randomUUID(),
        data: { group_id: groupId, document_id: entryId, data: typeParagraph(newYDoc(), "Ate lunch") },
      };
      return { entryId, entry, document, edit };
    };

    it("accepts a note with no body and its document, in one batch", async () => {
      const { owner, viewer, group, recipient } = await setup();
      const { entryId, entry, document, edit } = offlineNote(group.id, recipient.id);
      const res = await owner.api.sync.upload({ ops: [entry, document, edit] });
      expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);

      const [stored] = (await viewer.api.timeline.list({ groupId: group.id })).data;
      expect(stored).toMatchObject({ id: entryId, kind: "note", body: null, createdBy: owner.user.id });
      expect(await noteDocumentService.currentText(owner.ctx, entryId)).toBe("Ate lunch");
    });

    it("accepts a note and its document split across two batches", async () => {
      const { owner, group, recipient } = await setup();
      const { entryId, entry, document, edit } = offlineNote(group.id, recipient.id);
      expect((await owner.api.sync.upload({ ops: [entry] })).results).toEqual([
        { id: entryId, status: "applied" },
      ]);
      const second = await owner.api.sync.upload({ ops: [document, edit] });
      expect(second.results.map((r) => r.status)).toEqual(["applied", "applied"]);
      expect(await noteDocumentService.currentText(owner.ctx, entryId)).toBe("Ate lunch");
    });

    it("rejects a note with a body", async () => {
      const { owner, group, recipient } = await setup();
      const { entryId, entry } = offlineNote(group.id, recipient.id);
      const res = await owner.api.sync.upload({
        ops: [{ ...entry, data: { ...entry.data, body: "Ate lunch" } }],
      });
      expect(res.results[0]).toMatchObject({
        id: entryId,
        status: "rejected",
        code: "timelineEntryService:invalid",
        issues: [expect.objectContaining({ path: "body" })],
      });
      // And once stored, a PATCH can't add one either.
      await owner.api.sync.upload({ ops: [entry] });
      const patch = { op: "PATCH" as const, table: "timeline_entry", id: entryId, data: { body: "x" } };
      expect((await owner.api.sync.upload({ ops: [patch] })).results[0]).toMatchObject({
        status: "rejected",
        code: "timelineEntryService:invalid",
      });
    });

    it("compacts once enough edits arrive", async () => {
      const { owner, group, recipient } = await setup();
      const n = noteDocumentService.COMPACT_AFTER_UPDATES;
      const { entryId, ops } = offlineDocument(group.id, recipient.id, n);
      await owner.api.sync.upload({ ops });

      const doc = await noteDocumentService.getById(owner.ctx, entryId);
      if (isError(doc)) throw doc;
      // Compacted during the upload: the text is the server's, and nothing is pending.
      expect(doc.text.split("\n")).toEqual(Array.from({ length: n }, (_, i) => `Line ${i + 1}`));
      expect(doc.snapshot).not.toBeNull();
    });

    it("refuses viewers' edits, and any change but adding", async () => {
      const { owner, viewer, group, recipient } = await setup();
      const { entryId, ops } = offlineDocument(group.id, recipient.id, 1);
      await owner.api.sync.upload({ ops });

      const edit = {
        op: "PUT" as const,
        table: "note_update",
        id: randomUUID(),
        data: { group_id: group.id, document_id: entryId, data: typeParagraph(newYDoc(), "Hi") },
      };
      expect((await viewer.api.sync.upload({ ops: [edit] })).results[0]).toMatchObject({
        status: "rejected",
        code: "permissions:unauthorized",
      });

      const res = await owner.api.sync.upload({
        ops: [
          { op: "PATCH", table: "note_document", id: entryId, data: { text: "forged" } },
          { op: "DELETE", table: "note_document", id: entryId },
          { op: "PATCH", table: "note_update", id: ops[2]!.id, data: { data: "x" } },
          { op: "DELETE", table: "note_update", id: ops[2]!.id },
        ],
      });
      expect(res.results.map((r) => r.status === "rejected" && r.code)).toEqual(
        Array(4).fill("sync:readOnlyTable"),
      );
    });
  });
});

describe("HTTP handler", () => {
  const handle = createRpcHandler({ prefix: "/rpc", allowedOrigins: ["capacitor://localhost"] });

  const call = (path: string, init: RequestInit = {}) =>
    new Request(`http://localhost/rpc/${path}`, {
      method: "POST",
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
      body: init.body ?? JSON.stringify({ json: {} }),
    });

  it("serves procedures to calls with the CSRF header", async () => {
    const { owner } = await setup();
    const res = await handle(call("me/get", { headers: { "x-csrf-token": "orpc" } }), owner.ctx.authUser);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(owner.user.id);
  });

  it("refuses calls without the CSRF header", async () => {
    const { owner } = await setup();
    const res = await handle(call("me/get"), owner.ctx.authUser);
    expect(res.status).toBe(403);
  });

  it("returns 401 without a user, and 404 for unknown paths", async () => {
    const headers = { "x-csrf-token": "orpc" };
    expect((await handle(call("me/get", { headers }), null)).status).toBe(401);
    expect((await handle(call("nope/nothing", { headers }), null)).status).toBe(404);
  });

  it("allows CORS only for listed origins", async () => {
    const preflight = (origin: string) =>
      handle(
        new Request("http://localhost/rpc/me/get", {
          method: "OPTIONS",
          headers: { origin, "access-control-request-method": "POST" },
        }),
        null,
      );
    expect((await preflight("capacitor://localhost")).headers.get("access-control-allow-origin")).toBe(
      "capacitor://localhost",
    );
    expect((await preflight("https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();
  });
});
