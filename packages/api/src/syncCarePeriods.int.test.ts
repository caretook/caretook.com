import type { AuthUser } from "@caretook/data";

import { carePeriodService, providerService } from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload for care periods: rows as a device's SQLite holds them
// (snake_case, `date_only` as 1/0, PowerSync's timestamps). Each test makes
// its own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  return {
    group,
    recipient,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
    outsider: { ...outsider, api: clientFor(outsider.ctx.authUser) },
  };
};

const STARTED = "2026-11-10T22:20:00.000000Z";

const periodRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  type: "hospital",
  label: "Mercy General",
  place_provider_id: null,
  place_detail: "Room 412",
  started_at: STARTED,
  date_only: 0,
  deleted_at: null,
  created_at: STARTED,
  updated_at: STARTED,
  created_by: "ignored",
  updated_by: "ignored",
  ...overrides,
});

describe("sync.upload: care_period", () => {
  it("applies PUT (idempotent), PATCH and DELETE (soft, replayable)", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "care_period", id, data: periodRow(group.id, recipient.id) };
    const patch = { op: "PATCH" as const, table: "care_period", id, data: { label: "4 West", date_only: 0 } };

    expect((await owner.api.sync.upload({ ops: [put, patch] })).results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    expect(ok(await carePeriodService.getById(owner.ctx, id))).toMatchObject({
      type: "hospital",
      label: "4 West",
      placeDetail: "Room 412",
      dateOnly: false,
      createdBy: owner.user.id,
    });
    // A replay changes nothing.
    expect(
      (await owner.api.sync.upload({ ops: [put, patch] })).results.every((r) => r.status === "applied"),
    ).toBe(true);

    const remove = { op: "PATCH" as const, table: "care_period", id, data: { deleted_at: STARTED } };
    expect((await owner.api.sync.upload({ ops: [remove] })).results).toEqual([{ id, status: "applied" }]);
    expect(await carePeriodService.getById(owner.ctx, id)).toBeNull();
    expect(
      (await owner.api.sync.upload({ ops: [{ op: "DELETE", table: "care_period", id }] })).results,
    ).toEqual([{ id, status: "applied" }]);
  });

  it("takes a date-only start as 1, at midnight in the recipient's zone", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const data = periodRow(group.id, recipient.id, {
      type: "rehab",
      started_at: "2026-11-12T08:00:00.000000Z",
      date_only: 1,
    });
    expect(
      (await owner.api.sync.upload({ ops: [{ op: "PUT", table: "care_period", id, data }] })).results,
    ).toEqual([{ id, status: "applied" }]);
    expect(ok(await carePeriodService.getById(owner.ctx, id))).toMatchObject({ dateOnly: true });
  });

  it("rejects a changed group or recipient, a viewer's write, an outsider's, and a future start", async () => {
    const { group, recipient, owner, viewer, outsider } = await setup();
    const id = randomUUID();
    ok(
      (
        await owner.api.sync.upload({
          ops: [{ op: "PUT", table: "care_period", id, data: periodRow(group.id, recipient.id) }],
        })
      ).results,
    );

    const moved = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "care_period", id, data: { group_id: randomUUID() } }],
    });
    expect(moved.results[0]).toMatchObject({ status: "rejected", code: "carePeriodService:immutable" });

    const viewerEdit = await viewer.api.sync.upload({
      ops: [{ op: "PATCH", table: "care_period", id, data: { label: "Nope" } }],
    });
    expect(viewerEdit.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });
    const viewerPut = await viewer.api.sync.upload({
      ops: [{ op: "PUT", table: "care_period", id: randomUUID(), data: periodRow(group.id, recipient.id) }],
    });
    expect(viewerPut.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });

    const outsiderPut = await outsider.api.sync.upload({
      ops: [
        { op: "PUT", table: "care_period", id, data: periodRow(group.id, recipient.id, { label: "Mine" }) },
      ],
    });
    expect(outsiderPut.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });
    const outsiderDelete = await outsider.api.sync.upload({
      ops: [{ op: "DELETE", table: "care_period", id }],
    });
    expect(outsiderDelete.results[0]).toMatchObject({
      status: "rejected",
      code: "carePeriodService:notFound",
    });

    const future = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const ahead = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "care_period",
          id: randomUUID(),
          data: periodRow(group.id, recipient.id, { started_at: future }),
        },
      ],
    });
    expect(ahead.results[0]).toMatchObject({
      status: "rejected",
      code: "carePeriodService:futureStart",
      issues: [{ path: "startedAt" }],
    });
    expect(ok(await carePeriodService.getById(owner.ctx, id))).toMatchObject({ label: "Mercy General" });
  });

  it("creates a carePeriod notes document", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "care_period", id, data: periodRow(group.id, recipient.id) },
        { op: "PUT", table: "note_document", id, data: { group_id: group.id, subject: "carePeriod" } },
      ],
    });
    expect(res.results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
  });

  it("applies a period with its new place in one batch: the practice first, then the period naming it", async () => {
    const { group, recipient, owner } = await setup();
    const placeId = randomUUID();
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "provider",
          id: placeId,
          data: {
            group_id: group.id,
            type: "practice",
            name: "Lakeview Medical",
            status: "current",
            is_primary: 0,
          },
        },
        {
          op: "PUT",
          table: "care_period",
          id,
          data: periodRow(group.id, recipient.id, { place_provider_id: placeId, place_detail: "Room 7" }),
        },
      ],
    });
    expect(res.results).toEqual([
      { id: placeId, status: "applied" },
      { id, status: "applied" },
    ]);
    expect(ok(await providerService.getById(owner.ctx, placeId))).toMatchObject({
      type: "practice",
      name: "Lakeview Medical",
    });
    expect(ok(await carePeriodService.getById(owner.ctx, id))).toMatchObject({
      type: "hospital",
      placeProviderId: placeId,
      placeDetail: "Room 7",
    });
  });
});
