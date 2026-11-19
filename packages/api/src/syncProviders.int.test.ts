import type { AuthUser } from "@caretook/data";

import {
  entryProviderId,
  entryProviderService,
  noteDocumentService,
  providerService,
  timelineEntryService,
} from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload for the provider directory and entry links: rows as a
// device's SQLite holds them (snake_case, JSON as text, booleans as 1/0).
// Each test makes its own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

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
    expect(
      (await owner.api.sync.upload({ ops: [put, patch] })).results.every((r) => r.status === "applied"),
    ).toBe(true);

    const remove = {
      op: "PATCH" as const,
      table: "provider",
      id,
      data: { deleted_at: "2026-11-17T21:00:00.000000Z" },
    };
    expect((await owner.api.sync.upload({ ops: [remove] })).results).toEqual([{ id, status: "applied" }]);
    expect(await providerService.getById(viewer.ctx, id)).toBeNull();
    // A late edit doesn't bring it back; deleting again is a replay.
    const late = { op: "PATCH" as const, table: "provider", id, data: { name: "Back" } };
    expect((await owner.api.sync.upload({ ops: [late] })).results[0]).toMatchObject({
      status: "rejected",
      code: "providerService:notFound",
    });
    expect((await owner.api.sync.upload({ ops: [{ op: "DELETE", table: "provider", id }] })).results).toEqual(
      [{ id, status: "applied" }],
    );
  });

  it("handles a provider created and deleted before it uploaded", async () => {
    const { owner, group } = await setup();
    const id = randomUUID();
    const data = providerRow(group.id, { deleted_at: "2026-11-17T21:00:00.000000Z" });
    expect(
      (await owner.api.sync.upload({ ops: [{ op: "PUT", table: "provider", id, data }] })).results,
    ).toEqual([{ id, status: "applied" }]);
    expect(
      ok(await providerService.getById(owner.ctx, id, { includeDeleted: true }))?.deletedAt,
    ).toBeTruthy();
  });

  it("refuses a changed group, invalid content, and viewers", async () => {
    const { owner, viewer, group } = await setup();
    const other = await setup();
    const id = randomUUID();
    await owner.api.sync.upload({ ops: [{ op: "PUT", table: "provider", id, data: providerRow(group.id) }] });

    const res = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "provider", id, data: { group_id: other.group.id } },
        { op: "PUT", table: "provider", id, data: providerRow(other.group.id) },
        { op: "PATCH", table: "provider", id, data: { phones: "{" } },
        {
          op: "PUT",
          table: "provider",
          id: randomUUID(),
          data: providerRow(group.id, { type: "practice", practice_id: id }),
        },
      ],
    });
    expect(res.results).toEqual([
      expect.objectContaining({ status: "rejected", code: "providerService:immutable" }),
      expect.objectContaining({ status: "rejected", code: "providerService:immutable" }),
      expect.objectContaining({ status: "rejected", code: "providerService:invalid" }),
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

describe("sync.upload: practice in use", () => {
  it("rejects a PATCH that turns a practice with live clinicians into a clinician", async () => {
    const { owner, group } = await setup();
    const practiceId = randomUUID();
    const clinicianId = randomUUID();
    await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "provider", id: practiceId, data: providerRow(group.id, { type: "practice" }) },
        {
          op: "PUT",
          table: "provider",
          id: clinicianId,
          data: providerRow(group.id, { practice_id: practiceId }),
        },
      ],
    });

    const res = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "provider", id: practiceId, data: { type: "clinician" } }],
    });
    expect(res.results).toEqual([
      expect.objectContaining({ id: practiceId, status: "rejected", code: "providerService:practiceInUse" }),
    ]);
    expect(ok(await providerService.getById(owner.ctx, practiceId))?.type).toBe("practice");
  });
});

describe("sync.upload: practice has providers", () => {
  it("rejects a PATCH setting deleted_at, and a DELETE, on a practice live clinicians name", async () => {
    const { owner, group } = await setup();
    const practiceId = randomUUID();
    const clinicianId = randomUUID();
    await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "provider", id: practiceId, data: providerRow(group.id, { type: "practice" }) },
        {
          op: "PUT",
          table: "provider",
          id: clinicianId,
          data: providerRow(group.id, { practice_id: practiceId }),
        },
      ],
    });

    const res = await owner.api.sync.upload({
      ops: [
        {
          op: "PATCH",
          table: "provider",
          id: practiceId,
          data: { deleted_at: "2026-11-18T08:00:00.000000Z" },
        },
        { op: "DELETE", table: "provider", id: practiceId },
      ],
    });
    const rejected = { id: practiceId, status: "rejected", code: "providerService:practiceHasProviders" };
    expect(res.results).toEqual([expect.objectContaining(rejected), expect.objectContaining(rejected)]);
    expect(ok(await providerService.getById(owner.ctx, practiceId))?.deletedAt).toBeNull();

    // Once the clinician is deleted too, the practice goes.
    const after = await owner.api.sync.upload({
      ops: [
        { op: "DELETE", table: "provider", id: clinicianId },
        { op: "DELETE", table: "provider", id: practiceId },
      ],
    });
    expect(after.results).toEqual([
      { id: clinicianId, status: "applied" },
      { id: practiceId, status: "applied" },
    ]);
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
    expect((await owner.api.sync.upload({ ops })).results.map((r) => r.status)).toEqual([
      "applied",
      "applied",
      "applied",
    ]);
    expect((await owner.api.sync.upload({ ops })).results.map((r) => r.status)).toEqual([
      "applied",
      "applied",
      "applied",
    ]);
    const links = ok(await entryProviderService.listForEntry(viewer.ctx, entryId));
    expect(links.data).toEqual([
      expect.objectContaining({ id: linkId, providerId, createdBy: owner.user.id }),
    ]);
  });

  it("unlinks with a DELETE, refuses a PATCH, a wrong id and a symptom", async () => {
    const { owner, group, recipient } = await setup();
    const entry = ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "note",
        occurredAt: "2026-11-17T12:00:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    );
    const symptom = ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        recipientId: recipient.id,
        kind: "symptom",
        details: { name: "Dizziness" },
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
        { op: "PUT", table: "timeline_entry_provider", id: randomUUID(), data },
        {
          op: "PUT",
          table: "timeline_entry_provider",
          id: entryProviderId(symptom!.id, provider!.id),
          data: { ...data, entry_id: symptom!.id },
        },
        { op: "DELETE", table: "timeline_entry_provider", id: linkId },
        { op: "DELETE", table: "timeline_entry_provider", id: linkId },
      ],
    });
    expect(res.results).toEqual([
      { id: linkId, status: "applied" },
      expect.objectContaining({ status: "rejected", code: "sync:readOnlyTable" }),
      expect.objectContaining({ status: "rejected", code: "entryProviderService:invalid" }),
      expect.objectContaining({ status: "rejected", code: "entryProviderService:wrongKind" }),
      { id: linkId, status: "applied" },
      { id: linkId, status: "applied" },
    ]);
    expect(ok(await entryProviderService.listForEntry(owner.ctx, entry!.id)).count).toBe(0);
  });

  it("refuses viewers' links and another group's provider", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const other = await setup();
    const entryId = randomUUID();
    await owner.api.sync.upload({
      ops: [{ op: "PUT", table: "timeline_entry", id: entryId, data: eventRow(group.id, recipient.id) }],
    });
    const ours = ok(
      await providerService.create(owner.ctx, { groupId: group.id, type: "pharmacy", name: "Rx" }),
    );
    const theirs = ok(
      await providerService.create(other.owner.ctx, {
        groupId: other.group.id,
        type: "pharmacy",
        name: "Rx",
      }),
    );
    const linkOp = (providerId: string) => ({
      op: "PUT" as const,
      table: "timeline_entry_provider",
      id: entryProviderId(entryId, providerId),
      data: { group_id: group.id, entry_id: entryId, provider_id: providerId },
    });
    expect((await viewer.api.sync.upload({ ops: [linkOp(ours!.id)] })).results[0]).toMatchObject({
      status: "rejected",
      code: "permissions:unauthorized",
    });
    expect((await owner.api.sync.upload({ ops: [linkOp(theirs!.id)] })).results[0]).toMatchObject({
      status: "rejected",
      code: "permissions:unauthorized",
    });
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
