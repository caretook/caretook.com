import { getDb, recipientConditionService, timelineEntryService } from "@caretook/data";
import { conditionChangeId } from "@caretook/data/schema";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, upload } from "./testing";

// sync.upload for the recipient's conditions (conditions slice 1): rows as a
// device's SQLite holds them (integers for the since, the device's columns
// only), an edit, a resolve and a reactivate as PATCHes, a soft delete,
// "No known conditions" as the recipient's one-column PATCH, and refusals.
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

const SAVED_AT = "2026-11-17T21:45:25.229000Z";
const LATER = "2026-11-18T09:00:00.000000Z";

const conditionRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  name: "Type 2 diabetes",
  status: "active",
  since_year: 2016,
  since_month: 3,
  note: "Diet-controlled",
  diagnosed_by_id: null,
  deleted_at: null,
  created_at: SAVED_AT,
  updated_at: SAVED_AT,
  ...overrides,
});

const noKnownOf = async (recipientId: string) => {
  const { rows } = await getDb().$client.query<{ at: string | null }>(
    "SELECT no_known_conditions_at::text AS at FROM care_recipient WHERE id = $1",
    [recipientId],
  );
  return rows[0]?.at ?? null;
};

describe("sync.upload: recipient_condition", () => {
  it("applies a device's condition, edit, resolve, reactivate and soft delete, and replays safely", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();
    const put = {
      op: "PUT" as const,
      table: "recipient_condition",
      id,
      data: conditionRow(group.id, recipient.id),
    };
    const res = await owner.api.sync.upload({
      ops: [
        put,
        {
          op: "PATCH",
          table: "recipient_condition",
          id,
          data: { since_month: null, note: "", updated_at: LATER },
        },
        // A replay of the PUT changes nothing it shouldn't.
        put,
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    expect(ok(await recipientConditionService.getById(viewer.ctx, id))).toMatchObject({
      name: "Type 2 diabetes",
      status: "active",
      sinceYear: 2016,
      createdBy: owner.user.id,
    });

    // Integers may arrive as text.
    const status = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "recipient_condition", id, data: { status: "resolved", since_year: "2015" } },
      ],
    });
    expect(status.results).toEqual([{ id, status: "applied" }]);
    expect(ok(await recipientConditionService.getById(viewer.ctx, id))).toMatchObject({
      status: "resolved",
      sinceYear: 2015,
    });
    await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "recipient_condition", id, data: { status: "active" } }],
    });
    expect(ok(await recipientConditionService.getById(viewer.ctx, id))?.status).toBe("active");

    const removed = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "recipient_condition", id, data: { deleted_at: LATER } }],
    });
    expect(removed.results).toEqual([{ id, status: "applied" }]);
    expect(ok(await recipientConditionService.getById(viewer.ctx, id))).toBeNull();
    // A replayed delete is fine.
    expect(await upload(owner.api, [{ op: "DELETE", table: "recipient_condition", id }])).toEqual([
      { id, status: "applied" },
    ]);
  });

  it("refuses a viewer, a changed group, a month without a year and a stranger's group", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();
    ok(
      await owner.api.sync.upload({
        ops: [{ op: "PUT", table: "recipient_condition", id, data: conditionRow(group.id, recipient.id) }],
      }),
    );

    const refused = await viewer.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "recipient_condition",
          id: randomUUID(),
          data: conditionRow(group.id, recipient.id),
        },
        { op: "PATCH", table: "recipient_condition", id, data: { status: "resolved" } },
        { op: "PATCH", table: "recipient_condition", id, data: { deleted_at: LATER } },
      ],
    });
    expect(refused.results.map((r) => r.status)).toEqual(["rejected", "rejected", "rejected"]);

    const bad = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "recipient_condition", id, data: { group_id: randomUUID() } },
        {
          op: "PUT",
          table: "recipient_condition",
          id: randomUUID(),
          data: conditionRow(group.id, recipient.id, { since_year: null, since_month: 4 }),
        },
      ],
    });
    expect(bad.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "recipientConditionService:immutable",
      "recipientConditionService:invalid",
    ]);

    const stranger = await createUser("stranger");
    const theirs = await clientFor(stranger.ctx.authUser).sync.upload({
      ops: [
        {
          op: "PUT",
          table: "recipient_condition",
          id: randomUUID(),
          data: conditionRow(group.id, recipient.id),
        },
      ],
    });
    expect(theirs.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });
    expect(ok(await recipientConditionService.getById(viewer.ctx, id))?.status).toBe("active");
  });
});

describe("sync.upload: care_recipient's No known conditions", () => {
  it("records and clears it for a writer, refuses a viewer, and refuses it with conditions on file", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const patch = (at: string | null) => ({
      op: "PATCH" as const,
      table: "care_recipient",
      id: recipient.id,
      data: { no_known_conditions_at: at },
    });

    expect((await upload(viewer.api, [patch(LATER)]))[0]?.status).toBe("rejected");
    expect(await noKnownOf(recipient.id)).toBeNull();

    expect(await upload(owner.api, [patch(LATER)])).toEqual([{ id: recipient.id, status: "applied" }]);
    expect(await noKnownOf(recipient.id)).toMatch(/^2026-11-18/);

    // Adding a condition clears it; recording it again is refused.
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "recipient_condition", id, data: conditionRow(group.id, recipient.id) },
        patch(LATER),
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "applied",
      "recipientConditionService:hasConditions",
    ]);
    expect(await noKnownOf(recipient.id)).toBeNull();

    // Another column alongside it is still refused, as before.
    const mixed = await owner.api.sync.upload({
      ops: [{ ...patch(null), data: { no_known_conditions_at: null, name: "Someone else" } }],
    });
    expect(mixed.results[0]).toMatchObject({ status: "rejected", code: "sync:readOnlyTable" });
  });
});

// Conditions slice 2: the device writes each change's entry beside the
// condition, under the id the service derives from the condition and its
// `updated_at`; the condition's op records it, so the entry's own PUT, next
// in the batch, lands on the same row.
describe("sync.upload: a condition's change entries", () => {
  const entryPut = (
    id: string,
    groupId: string,
    recipientId: string,
    occurredAt: string,
    details: Record<string, unknown>,
  ) => ({
    op: "PUT" as const,
    table: "timeline_entry",
    id,
    data: {
      group_id: groupId,
      recipient_id: recipientId,
      kind: "conditionChange",
      occurred_at: occurredAt,
      time_zone: "America/Los_Angeles",
      title: null,
      body: null,
      details: JSON.stringify(details),
    },
  });

  it("accepts the device's entries for an add and a resolve, with the derived ids, once each", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();
    const added = conditionChangeId(id, SAVED_AT);
    const resolved = conditionChangeId(id, LATER);
    const ops = [
      { op: "PUT" as const, table: "recipient_condition", id, data: conditionRow(group.id, recipient.id) },
      entryPut(added, group.id, recipient.id, SAVED_AT, {
        conditionId: id,
        conditionName: "Type 2 diabetes",
        change: "added",
        after: {
          name: "Type 2 diabetes",
          status: "active",
          sinceYear: 2016,
          sinceMonth: 3,
          note: "Diet-controlled",
        },
      }),
      {
        op: "PATCH" as const,
        table: "recipient_condition",
        id,
        data: { status: "resolved", updated_at: LATER },
      },
      entryPut(resolved, group.id, recipient.id, LATER, {
        conditionId: id,
        conditionName: "Type 2 diabetes",
        change: "resolved",
      }),
    ];
    const statuses = async () => (await upload(owner.api, ops)).map((r) => r.status);
    expect(await statuses()).toEqual(["applied", "applied", "applied", "applied"]);
    // Replayed: the same two entries.
    expect(await statuses()).toEqual(["applied", "applied", "applied", "applied"]);

    const page = ok(
      await timelineEntryService.list(viewer.ctx, { groupId: group.id, kinds: ["conditionChange"] }),
    );
    expect(page.data.map((e) => e.id).sort()).toEqual([added, resolved].sort());
    expect(ok(await timelineEntryService.getById(viewer.ctx, resolved))).toMatchObject({
      kind: "conditionChange",
      createdBy: owner.user.id,
      details: { conditionId: id, conditionName: "Type 2 diabetes", change: "resolved" },
    });
  });

  it("refuses a condition change entry that no condition write made", async () => {
    const { owner, group, recipient } = await setup();
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        entryPut(randomUUID(), group.id, recipient.id, SAVED_AT, {
          conditionId: id,
          conditionName: "Made up",
          change: "added",
        }),
      ],
    });
    expect(res.results[0]).toMatchObject({
      status: "rejected",
      code: "timelineEntryService:systemWrittenKind",
    });
  });
});
