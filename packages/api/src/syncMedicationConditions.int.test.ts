import type { AuthUser } from "@caretook/data";

import {
  medicationConditionId,
  medicationConditionService,
  medicationService,
  recipientConditionService,
} from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload for what a medication is for (conditions slice 4): a device's
// medication_condition PUT (after the medication and condition it names, as
// the device queues them) and DELETE, replays, and refusals: a viewer, an id
// that isn't the pair's, a PATCH, a deleted condition. Each test makes its
// own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const SAVED_AT = "2026-11-17T21:45:25.229000Z";

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

const audit = { created_at: SAVED_AT, updated_at: SAVED_AT };

const linkOp = (op: "PUT" | "DELETE", groupId: string, medicationId: string, conditionId: string) => ({
  op,
  table: "medication_condition",
  id: medicationConditionId(medicationId, conditionId),
  data:
    op === "PUT"
      ? { group_id: groupId, medication_id: medicationId, condition_id: conditionId, ...audit }
      : null,
});

describe("sync.upload: medication_condition", () => {
  it("applies a new medication and condition with their link in one batch, then an unlink; replays are safe", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const [medicationId, conditionId] = [randomUUID(), randomUUID()];
    const put = linkOp("PUT", group.id, medicationId, conditionId);
    const res = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "recipient_condition",
          id: conditionId,
          data: {
            group_id: group.id,
            recipient_id: recipient.id,
            name: "Type 2 diabetes",
            status: "active",
            ...audit,
          },
        },
        {
          op: "PUT",
          table: "medication",
          id: medicationId,
          data: {
            group_id: group.id,
            recipient_id: recipient.id,
            name: "Metformin",
            schedule: JSON.stringify({ type: "asNeeded" }),
            status: "current",
            ...audit,
          },
        },
        put,
        put,
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied", "applied"]);
    expect(
      ok(await medicationConditionService.listForMedication(viewer.ctx, medicationId)).data.map(
        (l) => l.conditionId,
      ),
    ).toEqual([conditionId]);

    const del = linkOp("DELETE", group.id, medicationId, conditionId);
    const unlinked = await owner.api.sync.upload({ ops: [del, del] });
    expect(unlinked.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await medicationConditionService.listForMedication(viewer.ctx, medicationId)).data).toEqual([]);
  });

  it("rejects a viewer's link, an id that isn't the pair's, a PATCH and a deleted condition", async () => {
    const { owner, viewer, group } = await setup();
    const medication = ok(
      await medicationService.create(owner.ctx, {
        groupId: group.id,
        name: "Lisinopril",
        schedule: { type: "asNeeded" },
      }),
    )!;
    const [bp, gone] = [
      ok(
        await recipientConditionService.create(owner.ctx, { groupId: group.id, name: "High blood pressure" }),
      )!,
      ok(await recipientConditionService.create(owner.ctx, { groupId: group.id, name: "Gout" }))!,
    ];
    ok(await recipientConditionService.remove(owner.ctx, gone.id));

    const byViewer = await viewer.api.sync.upload({ ops: [linkOp("PUT", group.id, medication.id, bp.id)] });
    expect(byViewer.results[0]?.status).toBe("rejected");

    const res = await owner.api.sync.upload({
      ops: [
        { ...linkOp("PUT", group.id, medication.id, bp.id), id: randomUUID() },
        { ...linkOp("PUT", group.id, medication.id, bp.id), op: "PATCH" as const },
        linkOp("PUT", group.id, medication.id, gone.id),
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "medicationConditionService:invalid",
      "sync:readOnlyTable",
      "medicationConditionService:conditionNotFound",
    ]);
    expect(ok(await medicationConditionService.listForMedication(owner.ctx, medication.id)).data).toEqual([]);
  });
});
