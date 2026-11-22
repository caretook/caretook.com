import { providerService, recipientConditionService, timelineEntryService } from "@caretook/data";
import { conditionChangeId, conditionManagerId } from "@caretook/data/schema";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor } from "./testing";

// sync.upload for who diagnosed a condition and who manages it (conditions
// slice 3), as a device queues one save: a provider added from the picker,
// the condition's diagnosed_by_id, each removed manager as a PATCH of the
// link's updated_at then its DELETE, each new one as a PUT, then the
// device's own change entry. The server records the save as one entry;
// replays, a viewer, a PATCH of anything else and another group's provider
// are refused or harmless. Each test makes its own users and group.

const CREATED = "2026-11-17T21:45:25.229000Z";
const SAVED_AT = "2026-11-18T09:00:00.000000Z";

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  const provider = async (name: string) =>
    ok(await providerService.create(owner.ctx, { groupId: group.id, type: "clinician", name }))!;
  const condition = ok(
    await recipientConditionService.create(
      owner.ctx,
      { groupId: group.id, name: "Atrial fibrillation" },
      { changedAt: CREATED },
    ),
  )!;
  const changes = async () =>
    ok(await timelineEntryService.list(viewer.ctx, { groupId: group.id, kinds: ["conditionChange"] })).data;
  const managers = async () =>
    ok(await recipientConditionService.listManagers(viewer.ctx, condition.id))
      .data.map((l) => l.providerId)
      .sort();
  return {
    group,
    recipient,
    condition,
    provider,
    changes,
    managers,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

const linkPut = (groupId: string, conditionId: string, providerId: string, at = SAVED_AT) => ({
  op: "PUT" as const,
  table: "condition_manager",
  id: conditionManagerId(conditionId, providerId),
  data: {
    group_id: groupId,
    condition_id: conditionId,
    provider_id: providerId,
    created_at: at,
    updated_at: at,
  },
});
/** An unlink as the device queues it: the stamp of the save's time, then the delete. */
const unlinkOps = (conditionId: string, providerId: string, at = SAVED_AT) => {
  const id = conditionManagerId(conditionId, providerId);
  return [
    { op: "PATCH" as const, table: "condition_manager", id, data: { updated_at: at } },
    { op: "DELETE" as const, table: "condition_manager", id, data: null },
  ];
};

describe("sync.upload: who diagnosed and who manages a condition", () => {
  it("applies one save (a new provider, diagnosed by, an unlink, two links) as one change entry; replays are safe", async () => {
    const { owner, group, condition, provider, changes, managers } = await setup();
    const lee = await provider("Dr. Lee");
    ok(
      await recipientConditionService.linkManager(
        owner.ctx,
        { groupId: group.id, conditionId: condition.id, providerId: lee.id },
        { changedAt: "2026-11-17T22:00:00.000Z" },
      ),
    );
    const mossId = randomUUID();
    const park = await provider("Park Clinic");
    const ops = [
      {
        op: "PUT" as const,
        table: "provider",
        id: mossId,
        data: {
          group_id: group.id,
          type: "clinician",
          name: "Dr. Ada Moss",
          phones: "[]",
          status: "current",
          is_primary: 0,
          created_at: SAVED_AT,
          updated_at: SAVED_AT,
        },
      },
      {
        op: "PATCH" as const,
        table: "recipient_condition",
        id: condition.id,
        data: { diagnosed_by_id: mossId, updated_at: SAVED_AT },
      },
      ...unlinkOps(condition.id, lee.id),
      linkPut(group.id, condition.id, mossId),
      linkPut(group.id, condition.id, park.id),
    ];
    const res = await owner.api.sync.upload({ ops });
    expect(res.results.map((r) => r.status)).toEqual(ops.map(() => "applied"));
    expect(await managers()).toEqual([mossId, park.id].sort());
    expect(ok(await recipientConditionService.getById(owner.ctx, condition.id))?.diagnosedById).toBe(mossId);

    const saved = (await changes()).filter((e) => e.id === conditionChangeId(condition.id, SAVED_AT));
    expect(saved.map((e) => e.details)).toEqual([
      {
        conditionId: condition.id,
        conditionName: "Atrial fibrillation",
        change: "changed",
        fields: ["diagnosedBy", "managedBy"],
        before: { diagnosedBy: null, managedBy: ["Dr. Lee"] },
        after: { diagnosedBy: "Dr. Ada Moss", managedBy: ["Dr. Ada Moss", "Park Clinic"] },
      },
    ]);

    // The whole batch again: nothing changes, no second entry.
    const count = (await changes()).length;
    const again = await owner.api.sync.upload({ ops });
    expect(again.results.map((r) => r.status)).toEqual(ops.map(() => "applied"));
    expect(await managers()).toEqual([mossId, park.id].sort());
    expect((await changes()).length).toBe(count);
  });

  it("a new condition's links fold into its added entry", async () => {
    const { owner, group, recipient, provider, changes } = await setup();
    const lee = await provider("Dr. Lee");
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "recipient_condition",
          id,
          data: {
            group_id: group.id,
            recipient_id: recipient.id,
            name: "Type 2 diabetes",
            status: "active",
            since_year: null,
            since_month: null,
            note: null,
            diagnosed_by_id: lee.id,
            deleted_at: null,
            created_at: SAVED_AT,
            updated_at: SAVED_AT,
          },
        },
        linkPut(group.id, id, lee.id),
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    const [added] = (await changes()).filter((e) => e.id === conditionChangeId(id, SAVED_AT));
    expect(added?.details).toMatchObject({
      change: "added",
      after: { name: "Type 2 diabetes", diagnosedBy: "Dr. Lee", managedBy: ["Dr. Lee"] },
    });
  });

  it("refuses a viewer, a PATCH of anything but the stamp, an id that isn't the pair's, and another group's provider", async () => {
    const { owner, viewer, group, condition, provider, managers } = await setup();
    const lee = await provider("Dr. Lee");
    const stranger = await createUser("stranger");
    const { group: other } = await createGroup(stranger);
    const theirs = ok(
      await providerService.create(stranger.ctx, { groupId: other.id, type: "clinician", name: "Dr. Far" }),
    )!;

    const byViewer = await viewer.api.sync.upload({ ops: [linkPut(group.id, condition.id, lee.id)] });
    expect(byViewer.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });

    const res = await owner.api.sync.upload({
      ops: [
        { ...linkPut(group.id, condition.id, lee.id), id: randomUUID() },
        linkPut(group.id, condition.id, theirs.id),
        {
          op: "PATCH",
          table: "condition_manager",
          id: conditionManagerId(condition.id, lee.id),
          data: { provider_id: theirs.id },
        },
      ],
    });
    expect(res.results).toMatchObject([
      { status: "rejected", code: "recipientConditionService:invalid" },
      { status: "rejected", code: "permissions:unauthorized" },
      { status: "rejected", code: "sync:readOnlyTable" },
    ]);

    const diagnosed = await owner.api.sync.upload({
      ops: [
        {
          op: "PATCH",
          table: "recipient_condition",
          id: condition.id,
          data: { diagnosed_by_id: theirs.id, updated_at: SAVED_AT },
        },
      ],
    });
    expect(diagnosed.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });

    // A viewer's unlink of a real link is refused too.
    ok(await owner.api.sync.upload({ ops: [linkPut(group.id, condition.id, lee.id)] }));
    const unlink = await viewer.api.sync.upload({ ops: unlinkOps(condition.id, lee.id) });
    expect(unlink.results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(await managers()).toEqual([lee.id]);
  });
});
