import type { TimelineEntryCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createGroup, createUser, ok, system, typeParagraph } from "../../test/fixtures";
import { getDb } from "../db";
import {
  buildNoteDoc,
  MENTION_NODE,
  NOTE_FRAGMENT,
  noteText,
  noteUpdateSchema,
  toBase64,
} from "../db/schema";
import { isError } from "../errors";
import { noteDocumentModel, noteUpdateModel, timelineEntryModel } from "../models";
import { COMPACT_AFTER_UPDATES } from "./noteDocumentService";
import { noteDocumentService, timelineEntryService } from ".";

// Every test builds its own group and users, so tests never depend on each other.

const ROLES = ["owner", "admin", "caretaker", "viewer"] as const;
const WRITERS = ["owner", "admin", "caretaker"] as const;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
    staff: await createUser("staff", "admin"),
  };
  const { group } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const addEntry = async (overrides: Partial<TimelineEntryCreateInput> = {}) => {
    const entry = ok(
      await timelineEntryService.create(u.caretaker.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Dr. Lee visit",
        occurredAt: "2026-11-17T12:00:00.000Z",
        timeZone: "America/Los_Angeles",
        ...overrides,
      } as TimelineEntryCreateInput),
    );
    if (!entry) throw new Error("entry not readable");
    return entry;
  };
  const addDocument = async () => {
    const entry = await addEntry();
    const doc = ok(await noteDocumentService.create(u.caretaker.ctx, { id: entry.id, groupId: group.id }));
    if (!doc) throw new Error("document not readable");
    return { entry, doc };
  };
  const append = (ctx: (typeof u)["owner"]["ctx"], documentId: string, data: string) =>
    noteDocumentService.appendUpdate(ctx, { id: randomUUID(), groupId: group.id, documentId, data });
  return { u, group, addEntry, addDocument, append };
};

describe("creating a document", () => {
  it("lets writers add one to a note or an event, not viewers or outsiders", async () => {
    const { u, group, addEntry } = await setup();
    for (const role of WRITERS) {
      const entry = await addEntry();
      const doc = ok(await noteDocumentService.create(u[role].ctx, { id: entry.id, groupId: group.id }));
      expect(doc).toMatchObject({ id: entry.id, groupId: group.id, text: "", snapshot: null });
    }
    const entry = await addEntry({ kind: "note", title: null });
    for (const role of ["viewer", "outsider", "staff"] as const) {
      const res = await noteDocumentService.create(u[role].ctx, { id: entry.id, groupId: group.id });
      expect(codeOf(res)).toMatch(/permissions:unauthorized|noteDocumentService:entryNotFound/);
    }
    ok(await noteDocumentService.create(u.caretaker.ctx, { id: entry.id, groupId: group.id }));
  });

  it("refuses symptoms and vitals", async () => {
    const { u, group, addEntry } = await setup();
    const symptom = await addEntry({ kind: "symptom", title: null, details: { name: "Knee pain" } });
    expect(
      codeOf(await noteDocumentService.create(u.caretaker.ctx, { id: symptom.id, groupId: group.id })),
    ).toBe("noteDocumentService:wrongKind");
  });

  it("is idempotent: a second add (or a replay) returns the same document", async () => {
    const { u, group, addDocument } = await setup();
    const { entry, doc } = await addDocument();
    const again = ok(await noteDocumentService.create(u.admin.ctx, { id: entry.id, groupId: group.id }));
    expect(again).toMatchObject({ id: doc.id, createdBy: u.caretaker.user.id });
  });

  it("refuses an id that isn't an entry, a wrong group, and a deleted entry", async () => {
    const { u, group, addEntry } = await setup();
    const other = await setup();
    const entry = await addEntry();

    expect(
      codeOf(await noteDocumentService.create(u.caretaker.ctx, { id: randomUUID(), groupId: group.id })),
    ).toBe("noteDocumentService:entryNotFound");
    // Their group, our entry: the caretaker can't write there anyway.
    expect(
      codeOf(await noteDocumentService.create(u.caretaker.ctx, { id: entry.id, groupId: other.group.id })),
    ).toBe("noteDocumentService:immutable");

    ok(await timelineEntryService.remove(u.caretaker.ctx, entry.id));
    expect(
      codeOf(await noteDocumentService.create(u.caretaker.ctx, { id: entry.id, groupId: group.id })),
    ).toBe("noteDocumentService:entryNotFound");
  });

  it("can't set the snapshot or text directly", async () => {
    const { u, group, addEntry } = await setup();
    const entry = await addEntry();
    const res = await noteDocumentModel.create({
      ...u.caretaker.ctx,
      data: { id: entry.id, groupId: group.id, text: "forged" },
    });
    expect(codeOf(res)).toBe("permissions:fieldUnauthorized");
  });

  it("can't set editors directly, through the model or the service", async () => {
    const { u, group, addEntry } = await setup();
    const entry = await addEntry();
    const forged = { [u.owner.user.id]: new Date().toISOString() };
    const viaModel = await noteDocumentModel.create({
      ...u.caretaker.ctx,
      data: { id: entry.id, groupId: group.id, editors: forged },
    });
    expect(codeOf(viaModel)).toBe("permissions:fieldUnauthorized");
    const viaService = await noteDocumentService.create(u.caretaker.ctx, {
      id: entry.id,
      groupId: group.id,
      editors: forged,
    } as never);
    expect(codeOf(viaService)).toBe("noteDocumentService:invalid");

    // A real one starts with nobody.
    const doc = ok(await noteDocumentService.create(u.caretaker.ctx, { id: entry.id, groupId: group.id }));
    expect(doc?.editors).toEqual({});
  });
});

describe("reading a document", () => {
  it("shows it to every member and nobody else, and hides it once the entry is deleted", async () => {
    const { u, addDocument } = await setup();
    const { entry, doc } = await addDocument();

    for (const role of ROLES) {
      expect(await noteDocumentService.getById(u[role].ctx, doc.id)).toMatchObject({ id: doc.id });
    }
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await noteDocumentService.getById(u[role].ctx, doc.id))).toBe(
        "noteDocumentService:notFound",
      );
    }

    ok(await timelineEntryService.remove(u.caretaker.ctx, entry.id));
    expect(codeOf(await noteDocumentService.getById(u.owner.ctx, doc.id))).toBe(
      "noteDocumentService:notFound",
    );
  });
});

describe("appending updates", () => {
  it("lets writers append, not viewers or outsiders", async () => {
    const { u, addDocument, append } = await setup();
    const { doc } = await addDocument();
    const ydoc = new Y.Doc();

    for (const role of WRITERS) {
      expect(ok(await append(u[role].ctx, doc.id, typeParagraph(ydoc, `From ${role}`)))).toMatchObject({
        replay: false,
      });
    }
    expect(codeOf(await append(u.viewer.ctx, doc.id, typeParagraph(ydoc, "nope")))).toBe(
      "permissions:unauthorized",
    );
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await append(u[role].ctx, doc.id, typeParagraph(ydoc, "nope")))).toBe(
        "noteDocumentService:notFound",
      );
    }
    expect(codeOf(await noteDocumentService.currentText(u.viewer.ctx, doc.id))).toBe("ok");
    expect(ok(await noteDocumentService.currentText(u.viewer.ctx, doc.id))).toBe(
      "From owner\nFrom admin\nFrom caretaker",
    );
  });

  it("refuses junk, and updates to a deleted entry's document", async () => {
    const { u, addDocument, append } = await setup();
    const { entry, doc } = await addDocument();
    // Valid base64, but not a Yjs update.
    expect(codeOf(await append(u.caretaker.ctx, doc.id, "bm90IGEgeWpzIHVwZGF0ZQ=="))).toBe(
      "noteDocumentService:invalid",
    );

    ok(await timelineEntryService.remove(u.caretaker.ctx, entry.id));
    expect(codeOf(await append(u.caretaker.ctx, doc.id, typeParagraph(new Y.Doc(), "too late")))).toBe(
      "noteDocumentService:notFound",
    );
  });

  it("treats a replayed update as a no-op, and refuses its id on another document", async () => {
    const { u, group, addDocument } = await setup();
    const { doc } = await addDocument();
    const { doc: otherDoc } = await addDocument();
    const input = {
      id: randomUUID(),
      groupId: group.id,
      documentId: doc.id,
      data: typeParagraph(new Y.Doc(), "Hi"),
    };

    ok(await noteDocumentService.appendUpdate(u.caretaker.ctx, input));
    expect(ok(await noteDocumentService.appendUpdate(u.caretaker.ctx, input))).toMatchObject({
      replay: true,
    });
    const rows = ok(
      await noteUpdateModel.list({ ...system, filter: { documentId: { type: "eq", value: doc.id } } }),
    );
    expect(rows.count).toBe(1);

    expect(
      codeOf(await noteDocumentService.appendUpdate(u.caretaker.ctx, { ...input, documentId: otherDoc.id })),
    ).toBe("permissions:unauthorized");
  });
});

describe("compaction", () => {
  it("folds updates into the snapshot, refreshes the text and clears them", async () => {
    const { u, addDocument, append } = await setup();
    const { doc } = await addDocument();
    const a = new Y.Doc();
    const b = new Y.Doc();
    ok(await append(u.caretaker.ctx, doc.id, typeParagraph(a, "BP 128/82")));
    ok(await append(u.admin.ctx, doc.id, typeParagraph(b, "Lower lisinopril")));

    expect(ok(await noteDocumentService.compact(doc.id))).toEqual({ compacted: 2 });
    const compacted = ok(await noteDocumentService.getById(u.viewer.ctx, doc.id));
    expect(compacted.text.split("\n").sort()).toEqual(["BP 128/82", "Lower lisinopril"]);
    expect(compacted.updatedBy).toBe(system.authUser.id);
    expect(
      ok(await noteUpdateModel.list({ ...system, filter: { documentId: { type: "eq", value: doc.id } } }))
        .count,
    ).toBe(0);

    // The snapshot alone rebuilds the document, and later edits stack on top.
    const rebuilt = buildNoteDoc(compacted.snapshot);
    expect(noteText(rebuilt)).toBe(compacted.text);
    ok(await append(u.caretaker.ctx, doc.id, typeParagraph(rebuilt, "Recheck in 2 weeks")));
    ok(await noteDocumentService.compact(doc.id));
    expect(ok(await noteDocumentService.getById(u.owner.ctx, doc.id)).text).toMatch(/Recheck in 2 weeks$/);

    // Nothing pending: nothing to do.
    expect(ok(await noteDocumentService.compact(doc.id))).toEqual({ compacted: 0 });
  });

  it("derives a mention's text as @ and the name it was typed with", async () => {
    const { u, addDocument, append } = await setup();
    const { doc } = await addDocument();
    // As the editor writes one: text, the mention atom (a provider's id and name), text.
    const typed = new Y.Doc();
    let update: Uint8Array | null = null;
    typed.on("update", (bytes: Uint8Array) => (update = bytes));
    typed.transact(() => {
      const p = new Y.XmlElement("paragraph");
      typed.getXmlFragment(NOTE_FRAGMENT).insert(0, [p]);
      const before = new Y.XmlText();
      const mention = new Y.XmlElement(MENTION_NODE);
      const after = new Y.XmlText();
      p.insert(0, [before, mention, after]);
      before.insert(0, "Asked ");
      mention.setAttribute("id", randomUUID());
      mention.setAttribute("label", "Dr. Rosa Lin");
      mention.setAttribute("mentionSuggestionChar", "@");
      after.insert(0, " to halve the dose.");
    });
    if (!update) throw new Error("no update");
    ok(await append(u.caretaker.ctx, doc.id, toBase64(update)));
    ok(await append(u.admin.ctx, doc.id, typeParagraph(typed, "Recheck Friday")));

    expect(ok(await noteDocumentService.currentText(u.viewer.ctx, doc.id))).toBe(
      "Asked @Dr. Rosa Lin to halve the dose.\nRecheck Friday",
    );
    ok(await noteDocumentService.compact(doc.id));
    const compacted = ok(await noteDocumentService.getById(u.viewer.ctx, doc.id));
    expect(compacted.text).toBe("Asked @Dr. Rosa Lin to halve the dose.\nRecheck Friday");
    expect(noteText(buildNoteDoc(compacted.snapshot))).toBe(compacted.text);
  });

  it("only compacts when enough updates are waiting", async () => {
    const { u, addDocument, append } = await setup();
    const { doc } = await addDocument();
    const ydoc = new Y.Doc();
    for (let i = 0; i < COMPACT_AFTER_UPDATES - 1; i++) {
      ok(await append(u.caretaker.ctx, doc.id, typeParagraph(ydoc, `Line ${i}`)));
    }
    expect(ok(await noteDocumentService.compactIfDue(doc.id))).toEqual({ compacted: 0 });
    ok(await append(u.caretaker.ctx, doc.id, typeParagraph(ydoc, "One more")));
    expect(ok(await noteDocumentService.compactIfDue(doc.id))).toEqual({ compacted: COMPACT_AFTER_UPDATES });
  });

  it("is never available to members directly", async () => {
    const { u, addDocument } = await setup();
    const { doc } = await addDocument();
    for (const data of [{ text: "forged" }, { editors: { [u.owner.user.id]: new Date().toISOString() } }]) {
      const res = await noteDocumentModel.update({
        ...u.owner.ctx,
        filter: { id: { type: "eq", value: doc.id } },
        data,
      });
      expect(codeOf(res)).toBe("permissions:unauthorized");
    }
  });

  it("records each update's author in editors, keeping the latest time per user", async () => {
    const { u, addDocument, append } = await setup();
    const { doc } = await addDocument();
    const ydoc = new Y.Doc();
    /** Append as `who`, then pin the update's stored time. */
    const appendAt = async (who: typeof u.caretaker, at: string) => {
      const res = ok(await append(who.ctx, doc.id, typeParagraph(ydoc, at)));
      await getDb().update(noteUpdateSchema).set({ createdAt: at }).where(eq(noteUpdateSchema.id, res.id));
    };

    await appendAt(u.caretaker, "2026-11-17T10:00:00.000Z");
    await appendAt(u.caretaker, "2026-11-17T10:05:00.000Z");
    await appendAt(u.caretaker, "2026-11-17T10:02:00.000Z");
    await appendAt(u.admin, "2026-11-17T10:01:00.000Z");
    ok(await noteDocumentService.compact(doc.id));
    expect(ok(await noteDocumentService.getById(u.viewer.ctx, doc.id)).editors).toEqual({
      [u.caretaker.user.id]: "2026-11-17T10:05:00.000Z",
      [u.admin.user.id]: "2026-11-17T10:01:00.000Z",
    });

    // The next compaction merges into what's there: a later time wins, an earlier one doesn't.
    await appendAt(u.admin, "2026-11-17T10:30:00.000Z");
    await appendAt(u.caretaker, "2026-11-17T09:00:00.000Z");
    await appendAt(u.owner, "2026-11-17T10:20:00.000Z");
    ok(await noteDocumentService.compact(doc.id));
    expect(ok(await noteDocumentService.getById(u.viewer.ctx, doc.id)).editors).toEqual({
      [u.caretaker.user.id]: "2026-11-17T10:05:00.000Z",
      [u.admin.user.id]: "2026-11-17T10:30:00.000Z",
      [u.owner.user.id]: "2026-11-17T10:20:00.000Z",
    });
  });
});

describe("deletion", () => {
  it("cascades when the entry is purged", async () => {
    const { u, addDocument, append } = await setup();
    const { entry, doc } = await addDocument();
    ok(await append(u.caretaker.ctx, doc.id, typeParagraph(new Y.Doc(), "Hi")));

    ok(await timelineEntryModel.purge({ ...system, filter: { id: { type: "eq", value: entry.id } } }));
    expect(await noteDocumentModel.getById(doc.id, system)).toBeNull();
    expect(
      ok(await noteUpdateModel.list({ ...system, filter: { documentId: { type: "eq", value: doc.id } } }))
        .count,
    ).toBe(0);
  });
});
