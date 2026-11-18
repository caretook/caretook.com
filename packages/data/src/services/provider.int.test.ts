import type { ProviderCreateInput, TimelineEntryCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createGroup, createUser, ok, system, typeParagraph } from "../../test/fixtures";
import { getDb } from "../db";
import { entryProviderId, providerSchema } from "../db/schema";
import { isError } from "../errors";
import { noteDocumentModel, noteUpdateModel, timelineEntryProviderModel } from "../models";
import { entryProviderService, noteDocumentService, providerService, timelineEntryService } from ".";

// Every test builds its own group and users, so tests never depend on each other.

const WRITERS = ["owner", "admin", "caretaker"] as const;
const NON_WRITERS = ["viewer", "outsider", "staff"] as const;

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
  const addProvider = async (overrides: Partial<ProviderCreateInput> = {}) => {
    const provider = ok(
      await providerService.create(u.caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Example",
        specialty: "Cardiology",
        ...overrides,
      }),
    );
    if (!provider) throw new Error("provider not readable");
    return provider;
  };
  const addEntry = async (overrides: Partial<TimelineEntryCreateInput> = {}) => {
    const entry = ok(
      await timelineEntryService.create(u.caretaker.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Cardiology visit",
        occurredAt: "2026-11-17T12:00:00.000Z",
        timeZone: "America/Los_Angeles",
        ...overrides,
      } as TimelineEntryCreateInput),
    );
    if (!entry) throw new Error("entry not readable");
    return entry;
  };
  return { u, group, addProvider, addEntry };
};

describe("providerService: writing", () => {
  it("lets writers create, update and delete; viewers, outsiders and staff can't", async () => {
    const { u, group, addProvider } = await setup();

    for (const role of WRITERS) {
      const created = ok(
        await providerService.create(u[role].ctx, {
          groupId: group.id,
          type: "pharmacy",
          name: `By ${role}`,
        }),
      );
      expect(created).toMatchObject({ groupId: group.id, name: `By ${role}`, createdBy: u[role].user.id });
      const updated = ok(await providerService.update(u[role].ctx, created!.id, { isPrimary: true }));
      expect(updated).toMatchObject({ isPrimary: true, updatedBy: u[role].user.id });
      ok(await providerService.remove(u[role].ctx, created!.id));
      expect(await providerService.getById(u.owner.ctx, created!.id)).toBeNull();
    }

    const provider = await addProvider();
    for (const role of NON_WRITERS) {
      expect(
        codeOf(await providerService.create(u[role].ctx, { groupId: group.id, type: "other", name: "Nope" })),
      ).toBe("permissions:unauthorized");
    }
    expect(codeOf(await providerService.update(u.viewer.ctx, provider.id, { name: "Nope" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await providerService.remove(u.viewer.ctx, provider.id))).toBe("permissions:unauthorized");
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await providerService.update(u[role].ctx, provider.id, { name: "Nope" }))).toBe(
        "providerService:notFound",
      );
      expect(codeOf(await providerService.remove(u[role].ctx, provider.id))).toBe("providerService:notFound");
    }
    expect(ok(await providerService.getById(u.viewer.ctx, provider.id))).toMatchObject({
      name: "Dr. Example",
    });
  });

  it("stores contact details, and validates the merged provider on update", async () => {
    const { u, addProvider } = await setup();
    const phones = [
      { label: "Office", number: "(555) 010-2200" },
      { label: "Fax", number: "(555) 010-2201" },
    ];
    const provider = await addProvider({
      phones,
      email: "dr@clinic.example",
      address: "1 Main St\nSpringfield",
      website: "clinic.example",
    });
    expect(provider).toMatchObject({
      phones,
      website: "clinic.example",
      status: "current",
      isPrimary: false,
    });

    expect(codeOf(await providerService.update(u.caretaker.ctx, provider.id, { name: "  " }))).toBe(
      "providerService:invalid",
    );
    expect(codeOf(await providerService.update(u.caretaker.ctx, provider.id, { email: "nope" }))).toBe(
      "providerService:invalid",
    );
    const past = ok(
      await providerService.update(u.caretaker.ctx, provider.id, { status: "past", email: "" }),
    );
    expect(past).toMatchObject({ status: "past", email: null, phones });
  });

  it("allows at most six phones", async () => {
    const { u, group, addProvider } = await setup();
    const phone = { label: "Line", number: "555 0100" };
    const six = Array.from({ length: 6 }, () => phone);
    const provider = await addProvider({ phones: six });
    expect(provider.phones).toHaveLength(6);

    const seven = [...six, phone];
    const created = await providerService.create(u.caretaker.ctx, {
      groupId: group.id,
      type: "other",
      name: "Too many",
      phones: seven,
    });
    expect(codeOf(created)).toBe("providerService:invalid");
    expect(codeOf(await providerService.update(u.caretaker.ctx, provider.id, { phones: seven }))).toBe(
      "providerService:invalid",
    );
  });

  it("only accepts a practice or pharmacy in the same group that isn't deleted", async () => {
    const { u, group, addProvider } = await setup();
    const other = await setup();
    const practice = await addProvider({ type: "practice", name: "Westside Clinic" });
    const pharmacy = await addProvider({ type: "pharmacy", name: "Corner Pharmacy" });
    const clinician = await addProvider();

    expect(await addProvider({ practiceId: practice.id })).toMatchObject({ practiceId: practice.id });
    expect(await addProvider({ type: "other", practiceId: pharmacy.id })).toMatchObject({
      practiceId: pharmacy.id,
    });

    const create = (practiceId: string, type: "clinician" | "practice" = "clinician") =>
      providerService.create(u.caretaker.ctx, { groupId: group.id, type, name: "Dr. New", practiceId });
    // Not a practice, another group's practice, an unknown id.
    expect(codeOf(await create(clinician.id))).toBe("providerService:badPractice");
    const theirs = await other.addProvider({ type: "practice", name: "Their Clinic" });
    expect(codeOf(await create(theirs.id))).toBe("providerService:badPractice");
    expect(codeOf(await create(randomUUID()))).toBe("providerService:badPractice");
    // A practice can't belong to a practice.
    expect(codeOf(await create(practice.id, "practice"))).toBe("providerService:invalid");
    // Nor be its own.
    expect(
      codeOf(await providerService.update(u.caretaker.ctx, clinician.id, { practiceId: clinician.id })),
    ).toBe("providerService:badPractice");

    ok(await providerService.remove(u.caretaker.ctx, practice.id));
    expect(codeOf(await create(practice.id))).toBe("providerService:badPractice");
    expect(
      codeOf(await providerService.update(u.caretaker.ctx, clinician.id, { practiceId: practice.id })),
    ).toBe("providerService:badPractice");
  });

  it("won't let a practice stop being one while live clinicians name it", async () => {
    const { u, addProvider } = await setup();
    const practice = await addProvider({ type: "practice", name: "Westside Clinic" });
    const other = await addProvider({ type: "practice", name: "Eastside Clinic" });
    const clinician = await addProvider({ practiceId: practice.id });
    const retype = (type: "clinician" | "other" | "pharmacy" | "practice") =>
      providerService.update(u.caretaker.ctx, practice.id, { type });

    for (const type of ["clinician", "other"] as const) {
      const res = await retype(type);
      expect(codeOf(res)).toBe("providerService:practiceInUse");
      expect(isError(res) && res.meta).toMatchObject({
        issues: [
          {
            path: "type",
            message: "Clinicians are linked to this practice. Move them to another practice first.",
          },
        ],
      });
    }
    expect(ok(await providerService.getById(u.owner.ctx, practice.id))?.type).toBe("practice");

    // Practice and pharmacy are both practices.
    expect(ok(await retype("pharmacy"))?.type).toBe("pharmacy");
    expect(ok(await retype("practice"))?.type).toBe("practice");

    // Once the clinician moves, it goes through.
    ok(await providerService.update(u.caretaker.ctx, clinician.id, { practiceId: other.id }));
    expect(ok(await retype("clinician"))?.type).toBe("clinician");

    // A deleted clinician doesn't count.
    const gone = await addProvider({ type: "other", practiceId: other.id });
    expect(codeOf(await providerService.update(u.caretaker.ctx, other.id, { type: "other" }))).toBe(
      "providerService:practiceInUse",
    );
    ok(await providerService.update(u.caretaker.ctx, clinician.id, { practiceId: null }));
    ok(await providerService.remove(u.caretaker.ctx, gone.id));
    expect(ok(await providerService.update(u.caretaker.ctx, other.id, { type: "other" }))?.type).toBe(
      "other",
    );
  });

  it("keeps the group fixed, and needs a group the actor belongs to", async () => {
    const { u, group, addProvider } = await setup();
    const other = await setup();
    const provider = await addProvider();
    expect(
      codeOf(
        await providerService.update(u.caretaker.ctx, provider.id, { groupId: other.group.id } as never),
      ),
    ).toBe("providerService:invalid");
    expect(
      codeOf(
        await providerService.create(u.caretaker.ctx, { groupId: other.group.id, type: "other", name: "x" }),
      ),
    ).toBe("permissions:unauthorized");
    expect(provider.groupId).toBe(group.id);
  });
});

describe("providerService: reading and soft delete", () => {
  it("lists primary first, then current, then past, by name; deleted ones are hidden", async () => {
    const { u, group, addProvider } = await setup();
    const zed = await addProvider({ name: "Zed" });
    const amy = await addProvider({ name: "Amy" });
    const past = await addProvider({ name: "Aaron", status: "past" });
    const primary = await addProvider({ name: "Yvonne", isPrimary: true });
    const gone = await addProvider({ name: "Bea" });
    ok(await providerService.remove(u.caretaker.ctx, gone.id));

    const listed = ok(await providerService.list(u.viewer.ctx, { groupId: group.id }));
    expect(listed.data.map((p) => p.id)).toEqual([primary.id, amy.id, zed.id, past.id]);
    expect(listed.count).toBe(4);

    const all = ok(await providerService.list(u.viewer.ctx, { groupId: group.id, includeDeleted: true }));
    expect(all.data.map((p) => p.id)).toContain(gone.id);
    expect(await providerService.getById(u.viewer.ctx, gone.id)).toBeNull();
    expect(
      ok(await providerService.getById(u.viewer.ctx, gone.id, { includeDeleted: true }))?.deletedAt,
    ).toBeTruthy();

    // A deleted provider can't be edited, and deleting it again is "not found".
    expect(codeOf(await providerService.update(u.caretaker.ctx, gone.id, { name: "Back" }))).toBe(
      "providerService:notFound",
    );
    expect(codeOf(await providerService.remove(u.caretaker.ctx, gone.id))).toBe("providerService:notFound");
  });

  it("keeps each group's providers to its members", async () => {
    const { u, group, addProvider } = await setup();
    const other = await setup();
    await addProvider({ name: "Ours" });
    await other.addProvider({ name: "Theirs" });
    expect(
      ok(await providerService.list(u.owner.ctx, { groupId: group.id })).data.map((p) => p.name),
    ).toEqual(["Ours"]);
    expect(ok(await providerService.list(u.owner.ctx, { groupId: other.group.id })).data).toEqual([]);
    expect(ok(await providerService.list(u.staff.ctx, { groupId: group.id })).data).toEqual([]);
  });
});

describe("providerService.upsert", () => {
  it("creates, replays, and keeps the group and a deletion", async () => {
    const { u, group } = await setup();
    const other = await setup();
    const id = randomUUID();
    const input = { id, groupId: group.id, type: "clinician" as const, name: "Dr. Offline" };

    expect(ok(await providerService.upsert(u.caretaker.ctx, input))).toMatchObject({
      id,
      name: "Dr. Offline",
    });
    expect(
      ok(await providerService.upsert(u.caretaker.ctx, { ...input, name: "Dr. Renamed" })),
    ).toMatchObject({
      id,
      name: "Dr. Renamed",
    });
    expect(codeOf(await providerService.upsert(u.caretaker.ctx, { ...input, groupId: other.group.id }))).toBe(
      "providerService:immutable",
    );
    // Someone who can't see it learns nothing.
    expect(
      codeOf(await providerService.upsert(other.u.caretaker.ctx, { ...input, groupId: other.group.id })),
    ).toBe("permissions:unauthorized");

    ok(await providerService.remove(u.caretaker.ctx, id));
    const late = ok(await providerService.upsert(u.caretaker.ctx, { ...input, name: "Too late" }));
    expect(late).toMatchObject({ name: "Dr. Renamed" });
    expect(late?.deletedAt).toBeTruthy();
  });
});

describe("entryProviderService", () => {
  it("links writers' notes and events to providers, once per pair", async () => {
    const { u, group, addProvider, addEntry } = await setup();
    const provider = await addProvider();
    const event = await addEntry();
    const note = await addEntry({ kind: "note", title: null });

    for (const entry of [event, note]) {
      const link = ok(
        await entryProviderService.link(u.caretaker.ctx, {
          groupId: group.id,
          entryId: entry.id,
          providerId: provider.id,
        }),
      );
      expect(link).toMatchObject({ id: entryProviderId(entry.id, provider.id), entryId: entry.id });
    }

    // Again, by another writer and with the explicit id: the same row.
    const again = ok(
      await entryProviderService.link(u.admin.ctx, {
        id: entryProviderId(event.id, provider.id),
        groupId: group.id,
        entryId: event.id,
        providerId: provider.id,
      }),
    );
    expect(again).toMatchObject({ createdBy: u.caretaker.user.id });
    expect(ok(await entryProviderService.listForEntry(u.viewer.ctx, event.id)).count).toBe(1);
    expect(ok(await entryProviderService.listForProvider(u.viewer.ctx, provider.id)).count).toBe(2);

    // An id that isn't the pair's.
    expect(
      codeOf(
        await entryProviderService.link(u.caretaker.ctx, {
          id: randomUUID(),
          groupId: group.id,
          entryId: event.id,
          providerId: provider.id,
        }),
      ),
    ).toBe("entryProviderService:invalid");
  });

  it("refuses symptoms and vitals, deleted entries and deleted providers", async () => {
    const { u, group, addProvider, addEntry } = await setup();
    const provider = await addProvider();
    const link = (entryId: string, providerId = provider.id) =>
      entryProviderService.link(u.caretaker.ctx, { groupId: group.id, entryId, providerId });

    const symptom = await addEntry({ kind: "symptom", title: null, details: { name: "Knee pain" } });
    expect(codeOf(await link(symptom.id))).toBe("entryProviderService:wrongKind");

    const event = await addEntry();
    ok(await timelineEntryService.remove(u.caretaker.ctx, event.id));
    expect(codeOf(await link(event.id))).toBe("entryProviderService:entryNotFound");
    expect(codeOf(await link(randomUUID()))).toBe("entryProviderService:entryNotFound");

    const live = await addEntry();
    const gone = await addProvider({ name: "Gone" });
    ok(await providerService.remove(u.caretaker.ctx, gone.id));
    expect(codeOf(await link(live.id, gone.id))).toBe("entryProviderService:providerNotFound");
  });

  it("refuses viewers, and another group's entries and providers", async () => {
    const { u, group, addProvider, addEntry } = await setup();
    const other = await setup();
    const provider = await addProvider();
    const entry = await addEntry();
    const theirProvider = await other.addProvider();
    const theirEntry = await other.addEntry();

    expect(
      codeOf(
        await entryProviderService.link(u.viewer.ctx, {
          groupId: group.id,
          entryId: entry.id,
          providerId: provider.id,
        }),
      ),
    ).toBe("permissions:unauthorized");
    for (const [entryId, providerId] of [
      [entry.id, theirProvider.id],
      [theirEntry.id, provider.id],
    ] as const) {
      expect(
        codeOf(await entryProviderService.link(u.caretaker.ctx, { groupId: group.id, entryId, providerId })),
      ).toBe("permissions:unauthorized");
    }
    // An outsider learns nothing either.
    expect(
      codeOf(
        await entryProviderService.link(u.outsider.ctx, {
          groupId: group.id,
          entryId: entry.id,
          providerId: provider.id,
        }),
      ),
    ).toBe("permissions:unauthorized");
    // The pair's group must be the one named.
    expect(
      codeOf(
        await entryProviderService.link(u.owner.ctx, {
          groupId: other.group.id,
          entryId: entry.id,
          providerId: provider.id,
        }),
      ),
    ).toBe("entryProviderService:immutable");
  });

  it("unlinks (a hard delete), idempotently; viewers can't", async () => {
    const { u, group, addProvider, addEntry } = await setup();
    const provider = await addProvider();
    const entry = await addEntry();
    const link = ok(
      await entryProviderService.link(u.caretaker.ctx, {
        groupId: group.id,
        entryId: entry.id,
        providerId: provider.id,
      }),
    );

    expect(codeOf(await entryProviderService.unlink(u.viewer.ctx, link!.id))).toBe(
      "permissions:unauthorized",
    );
    expect(ok(await entryProviderService.unlinkPair(u.admin.ctx, entry.id, provider.id))).toEqual({
      ids: [link!.id],
    });
    expect(await timelineEntryProviderModel.getById(link!.id, system)).toBeNull();
    expect(ok(await entryProviderService.unlink(u.admin.ctx, link!.id))).toEqual({ ids: [] });

    // Linking again writes the same id.
    expect(
      ok(
        await entryProviderService.link(u.caretaker.ctx, {
          groupId: group.id,
          entryId: entry.id,
          providerId: provider.id,
        }),
      ),
    ).toMatchObject({ id: link!.id });
  });

  it("keeps links to a soft-deleted provider, and drops them when either end is purged", async () => {
    const { u, group, addProvider, addEntry } = await setup();
    const provider = await addProvider();
    const entry = await addEntry();
    ok(
      await entryProviderService.link(u.caretaker.ctx, {
        groupId: group.id,
        entryId: entry.id,
        providerId: provider.id,
      }),
    );

    ok(await providerService.remove(u.caretaker.ctx, provider.id));
    expect(ok(await entryProviderService.listForEntry(u.viewer.ctx, entry.id)).count).toBe(1);

    await getDb().delete(providerSchema).where(eq(providerSchema.id, provider.id));
    expect(ok(await entryProviderService.listForEntry(u.viewer.ctx, entry.id)).count).toBe(0);
  });
});

describe("noteDocumentService: provider notes", () => {
  it("creates a provider's document, takes updates, compacts, and cascades with the provider", async () => {
    const { u, group, addProvider } = await setup();
    const provider = await addProvider();
    const create = (ctx: (typeof u)["owner"]["ctx"]) =>
      noteDocumentService.create(ctx, { id: provider.id, groupId: group.id, subject: "provider" });

    expect(codeOf(await create(u.viewer.ctx))).toBe("permissions:unauthorized");
    const doc = ok(await create(u.caretaker.ctx));
    expect(doc).toMatchObject({
      id: provider.id,
      subject: "provider",
      providerId: provider.id,
      entryId: null,
    });
    // Idempotent, and not an entry's.
    expect(ok(await create(u.admin.ctx))).toMatchObject({ id: provider.id, createdBy: u.caretaker.user.id });
    expect(
      codeOf(await noteDocumentService.create(u.caretaker.ctx, { id: provider.id, groupId: group.id })),
    ).toBe("noteDocumentService:entryNotFound");

    const ydoc = new Y.Doc();
    for (const [who, text] of [
      [u.caretaker, "Park on level 2"],
      [u.admin, "Ask for Rosa"],
    ] as const) {
      ok(
        await noteDocumentService.appendUpdate(who.ctx, {
          id: randomUUID(),
          groupId: group.id,
          documentId: provider.id,
          data: typeParagraph(ydoc, text),
        }),
      );
    }
    expect(ok(await noteDocumentService.currentText(u.viewer.ctx, provider.id))).toBe(
      "Park on level 2\nAsk for Rosa",
    );
    expect(ok(await noteDocumentService.compact(provider.id))).toEqual({ compacted: 2 });
    const compacted = ok(await noteDocumentService.getById(u.viewer.ctx, provider.id));
    expect(compacted.text).toBe("Park on level 2\nAsk for Rosa");
    expect(Object.keys(compacted.editors).sort()).toEqual([u.caretaker.user.id, u.admin.user.id].sort());

    // Soft delete hides it; a hard delete removes it and its updates.
    ok(
      await noteDocumentService.appendUpdate(u.caretaker.ctx, {
        id: randomUUID(),
        groupId: group.id,
        documentId: provider.id,
        data: typeParagraph(ydoc, "Pending"),
      }),
    );
    ok(await providerService.remove(u.caretaker.ctx, provider.id));
    expect(codeOf(await noteDocumentService.getById(u.owner.ctx, provider.id))).toBe(
      "noteDocumentService:notFound",
    );
    expect(codeOf(await create(u.caretaker.ctx))).toBe("noteDocumentService:providerNotFound");

    await getDb().delete(providerSchema).where(eq(providerSchema.id, provider.id));
    expect(await noteDocumentModel.getById(provider.id, system)).toBeNull();
    expect(
      ok(
        await noteUpdateModel.list({ ...system, filter: { documentId: { type: "eq", value: provider.id } } }),
      ).count,
    ).toBe(0);
  });

  it("refuses an outsider, another group and an unknown provider", async () => {
    const { u, group, addProvider } = await setup();
    const other = await setup();
    const provider = await addProvider();
    expect(
      codeOf(
        await noteDocumentService.create(u.outsider.ctx, {
          id: provider.id,
          groupId: group.id,
          subject: "provider",
        }),
      ),
    ).toBe("noteDocumentService:providerNotFound");
    expect(
      codeOf(
        await noteDocumentService.create(u.caretaker.ctx, {
          id: provider.id,
          groupId: other.group.id,
          subject: "provider",
        }),
      ),
    ).toBe("noteDocumentService:immutable");
    expect(
      codeOf(
        await noteDocumentService.create(u.caretaker.ctx, {
          id: randomUUID(),
          groupId: group.id,
          subject: "provider",
        }),
      ),
    ).toBe("noteDocumentService:providerNotFound");
  });

  it("gives entry documents their entry as owner", async () => {
    const { u, group, addEntry } = await setup();
    const entry = await addEntry();
    const doc = ok(await noteDocumentService.create(u.caretaker.ctx, { id: entry.id, groupId: group.id }));
    expect(doc).toMatchObject({ subject: "entry", entryId: entry.id, providerId: null });
  });
});
