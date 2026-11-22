import {
  entryProviderId,
  entryProviderService,
  noteDocumentService,
  providerService,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../data/test/fixtures";
import { clientFor, outcomes, putOp, upload } from "./testing";

// sync.upload for the provider directory and entry links: rows as a
// device's SQLite holds them (snake_case, JSON as text, booleans as 1/0).
// Each test makes its own users and group.

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  return {
    group,
    recipient,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

const providerRow = (groupId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  type: "clinician",
  name: "Dr. Offline",
  specialty: "Cardiology",
  practice_id: null,
  phones: JSON.stringify([{ label: "Office", number: "(555) 010-3300" }]),
  email: null,
  address: null,
  website: "heart.example",
  status: "current",
  is_primary: 0,
  deleted_at: null,
  created_by: "ignored",
  ...overrides,
});

const eventRow = (groupId: string, recipientId: string) => ({
  group_id: groupId,
  recipient_id: recipientId,
  kind: "event",
  occurred_at: "2026-11-17T20:00:00.000000Z",
  time_zone: "America/Los_Angeles",
  title: "Cardiology visit",
  body: null,
  details: null,
});

describe("sync.upload: provider", () => {
  it("applies a device's insert, edits and soft delete, and replays safely", async () => {
    const { owner, viewer, group } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "provider", id, data: providerRow(group.id) };
    const patch = { op: "PATCH" as const, table: "provider", id, data: { is_primary: 1, status: "past" } };

    const res = await owner.api.sync.upload({ ops: [put, patch] });
    expect(res.results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    expect(ok(await providerService.getById(viewer.ctx, id))).toMatchObject({
      name: "Dr. Offline",
      phones: [{ label: "Office", number: "(555) 010-3300" }],
      isPrimary: true,
      status: "past",
      createdBy: owner.user.id,
    });
    expect((await upload(owner.api, [put, patch])).every((r) => r.status === "applied")).toBe(true);

    const remove = {
      op: "PATCH" as const,
      table: "provider",
      id,
      data: { deleted_at: "2026-11-17T21:00:00.000000Z" },
    };
    expect(await upload(owner.api, [remove])).toEqual([{ id, status: "applied" }]);
    expect(await providerService.getById(viewer.ctx, id)).toBeNull();
    // A late edit doesn't bring it back; deleting again is a replay.
    const late = { op: "PATCH" as const, table: "provider", id, data: { name: "Back" } };
    expect((await upload(owner.api, [late]))[0]).toMatchObject({
      status: "rejected",
      code: "providerService:notFound",
    });
    expect(await upload(owner.api, [{ op: "DELETE", table: "provider", id }])).toEqual([
      { id, status: "applied" },
    ]);
  });

  it("handles a provider created and deleted before it uploaded", async () => {
    const { owner, group } = await setup();
    const id = randomUUID();
    const data = providerRow(group.id, { deleted_at: "2026-11-17T21:00:00.000000Z" });
    expect(await upload(owner.api, [{ op: "PUT", table: "provider", id, data }])).toEqual([
      { id, status: "applied" },
    ]);
    expect(
      ok(await providerService.getById(owner.ctx, id, { includeDeleted: true }))?.deletedAt,
    ).toBeTruthy();
  });

  it("refuses a changed group, JSON that isn't, and viewers", async () => {
    const { owner, viewer, group } = await setup();
    const other = await setup();
    const id = randomUUID();
    await owner.api.sync.upload({ ops: [{ op: "PUT", table: "provider", id, data: providerRow(group.id) }] });

    const res = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "provider", id, data: { group_id: other.group.id } },
        { op: "PUT", table: "provider", id, data: providerRow(other.group.id) },
        { op: "PATCH", table: "provider", id, data: { phones: "{" } },
      ],
    });
    expect(res.results).toEqual([
      expect.objectContaining({ status: "rejected", code: "providerService:immutable" }),
      expect.objectContaining({ status: "rejected", code: "providerService:immutable" }),
      expect.objectContaining({ status: "rejected", code: "providerService:invalid" }),
    ]);

    const byViewer = await viewer.api.sync.upload({
      ops: [
        { op: "PUT", table: "provider", id: randomUUID(), data: providerRow(group.id) },
        { op: "PATCH", table: "provider", id, data: { name: "Nope" } },
        { op: "DELETE", table: "provider", id },
      ],
    });
    expect(byViewer.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "permissions:unauthorized",
      "permissions:unauthorized",
      "permissions:unauthorized",
    ]);
    expect(ok(await providerService.getById(owner.ctx, id))).toMatchObject({
      name: "Dr. Offline",
      groupId: group.id,
    });
  });
});

describe("sync.upload: timeline_entry_provider", () => {
  it("links offline: an event, a new provider and the link in one batch, replayed safely", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const entryId = randomUUID();
    const providerId = randomUUID();
    const linkId = entryProviderId(entryId, providerId);
    const ops = [
      { op: "PUT" as const, table: "timeline_entry", id: entryId, data: eventRow(group.id, recipient.id) },
      { op: "PUT" as const, table: "provider", id: providerId, data: providerRow(group.id) },
      {
        op: "PUT" as const,
        table: "timeline_entry_provider",
        id: linkId,
        data: { group_id: group.id, entry_id: entryId, provider_id: providerId },
      },
    ];
    expect((await upload(owner.api, ops)).map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    expect((await upload(owner.api, ops)).map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    const links = ok(await entryProviderService.listForEntry(viewer.ctx, entryId));
    expect(links.data).toEqual([
      expect.objectContaining({ id: linkId, providerId, createdBy: owner.user.id }),
    ]);
  });

  it("unlinks with a DELETE, replayable, and refuses a PATCH", async () => {
    const { owner, group } = await setup();
    const entry = ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "note",
        occurredAt: "2026-11-17T12:00:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    );
    const provider = ok(
      await providerService.create(owner.ctx, { groupId: group.id, type: "pharmacy", name: "Rx" }),
    );
    const linkId = entryProviderId(entry!.id, provider!.id);
    const data = { group_id: group.id, entry_id: entry!.id, provider_id: provider!.id };

    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry_provider", id: linkId, data },
        { op: "PATCH", table: "timeline_entry_provider", id: linkId, data: { provider_id: randomUUID() } },
        { op: "DELETE", table: "timeline_entry_provider", id: linkId },
        { op: "DELETE", table: "timeline_entry_provider", id: linkId },
      ],
    });
    expect(res.results).toEqual([
      { id: linkId, status: "applied" },
      expect.objectContaining({ status: "rejected", code: "sync:readOnlyTable" }),
      { id: linkId, status: "applied" },
      { id: linkId, status: "applied" },
    ]);
    expect(ok(await entryProviderService.listForEntry(owner.ctx, entry!.id)).count).toBe(0);
  });

  it("refuses viewers' links", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const entryId = randomUUID();
    await upload(owner.api, [putOp("timeline_entry", entryId, eventRow(group.id, recipient.id))]);
    const provider = ok(
      await providerService.create(owner.ctx, { groupId: group.id, type: "pharmacy", name: "Rx" }),
    )!;
    const link = putOp("timeline_entry_provider", entryProviderId(entryId, provider.id), {
      group_id: group.id,
      entry_id: entryId,
      provider_id: provider.id,
    });
    expect(await outcomes(viewer.api, [link])).toEqual(["permissions:unauthorized"]);
  });

  it("makes one link when two members' devices link the same pair (one offline): the first upload's", async () => {
    const owner = await createUser("owner");
    const caretaker = await createUser("caretaker");
    const { group } = await createGroup(owner, [{ user: caretaker.user, role: "caretaker" }]);
    const ownerApi = clientFor(owner.ctx.authUser);
    const caretakerApi = clientFor(caretaker.ctx.authUser);
    const entry = ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Clinic visit",
        occurredAt: "2026-11-17T12:00:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    );
    const provider = ok(
      await providerService.create(owner.ctx, { groupId: group.id, type: "practice", name: "Clinic" }),
    );
    // Each device derives the same id from the pair; the offline one uploads second.
    const linkOp = {
      op: "PUT" as const,
      table: "timeline_entry_provider",
      id: entryProviderId(entry!.id, provider!.id),
      data: { group_id: group.id, entry_id: entry!.id, provider_id: provider!.id },
    };
    expect((await upload(ownerApi, [linkOp]))[0]?.status).toBe("applied");
    expect((await upload(caretakerApi, [linkOp]))[0]?.status).toBe("applied");
    const links = ok(await entryProviderService.listForEntry(owner.ctx, entry!.id));
    expect(links.data).toEqual([
      expect.objectContaining({ id: linkOp.id, providerId: provider!.id, createdBy: owner.user.id }),
    ]);
  });
});

describe("sync.upload: provider notes", () => {
  it("creates a provider's live document from a device, with its edits", async () => {
    const { owner, viewer, group } = await setup();
    const providerId = randomUUID();
    const ydoc = newYDoc();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "provider", id: providerId, data: providerRow(group.id) },
        {
          op: "PUT",
          table: "note_document",
          id: providerId,
          data: { group_id: group.id, subject: "provider", provider_id: providerId, entry_id: null },
        },
        {
          op: "PUT",
          table: "note_update",
          id: randomUUID(),
          data: { group_id: group.id, document_id: providerId, data: typeParagraph(ydoc, "Ask for Rosa") },
        },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    expect(ok(await noteDocumentService.getById(viewer.ctx, providerId))).toMatchObject({
      subject: "provider",
      providerId,
    });
    expect(ok(await noteDocumentService.currentText(viewer.ctx, providerId))).toBe("Ask for Rosa");
  });

  it("refuses a subject that isn't one", async () => {
    const { owner, group } = await setup();
    const res = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "note_document",
          id: randomUUID(),
          data: { group_id: group.id, subject: "user" },
        },
      ],
    });
    expect(res.results[0]).toMatchObject({ status: "rejected", code: "noteDocumentService:invalid" });
  });
});

describe("sync.upload: an import from another group (B-48)", () => {
  // A device's import writes ordinary provider creates in the target group,
  // a copied practice before its clinician, and nothing in the source. The
  // importer is a caretaker in the target and only a viewer in the source.
  const importSetup = async () => {
    const importer = await createUser("importer");
    const sourceOwner = await createUser("source-owner");
    const targetOwner = await createUser("target-owner");
    const source = await createGroup(sourceOwner, [{ user: importer.user, role: "viewer" }]);
    const target = await createGroup(targetOwner, [{ user: importer.user, role: "caretaker" }]);
    return { importer: { ...importer, api: clientFor(importer.ctx.authUser) }, source, target };
  };

  /** A copied practice and its clinician, as `importProviders` queues them. */
  const importOps = (groupId: string) => {
    const practiceId = randomUUID();
    const clinicianId = randomUUID();
    return {
      practiceId,
      clinicianId,
      ops: [
        {
          op: "PUT" as const,
          table: "provider",
          id: practiceId,
          data: providerRow(groupId, { type: "practice", name: "Harbor Clinic", specialty: "Geriatrics" }),
        },
        {
          op: "PUT" as const,
          table: "provider",
          id: clinicianId,
          data: providerRow(groupId, { name: "Dr. Nia Okafor", practice_id: practiceId }),
        },
      ],
    };
  };

  it("uploads an offline import of a clinician and its copied practice in one batch, and replays safely", async () => {
    const { importer, source, target } = await importSetup();
    const { practiceId, clinicianId, ops } = importOps(target.group.id);

    const res = await importer.api.sync.upload({ ops });
    expect(res.results).toEqual([
      { id: practiceId, status: "applied" },
      { id: clinicianId, status: "applied" },
    ]);
    expect(ok(await providerService.getById(importer.ctx, clinicianId))).toMatchObject({
      groupId: target.group.id,
      name: "Dr. Nia Okafor",
      practiceId,
      isPrimary: false,
      createdBy: importer.user.id,
    });
    expect(ok(await providerService.getById(importer.ctx, practiceId))).toMatchObject({
      type: "practice",
      name: "Harbor Clinic",
    });
    expect((await upload(importer.api, ops)).every((r) => r.status === "applied")).toBe(true);
    // Nothing in the source group changed.
    expect(ok(await providerService.list(importer.ctx, { groupId: source.group.id }))).toMatchObject({
      count: 0,
    });
  });

  it("refuses an import into a group where the uploader is a viewer", async () => {
    const { importer, source } = await importSetup();
    const { practiceId, clinicianId, ops } = importOps(source.group.id);

    const res = await importer.api.sync.upload({ ops });
    // The practice is refused; its clinician then names a practice that isn't there.
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "permissions:unauthorized",
      "providerService:badPractice",
    ]);
    expect(await providerService.getById(importer.ctx, practiceId)).toBeNull();
    expect(await providerService.getById(importer.ctx, clinicianId)).toBeNull();
  });
});
