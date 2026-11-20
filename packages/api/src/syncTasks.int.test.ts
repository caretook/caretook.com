import type { AuthUser } from "@caretook/data";

import { taskService } from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload for tasks: rows as a device's SQLite holds them (snake_case,
// PowerSync's timestamps). Each test makes its own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  const other = await createGroup(owner);
  return {
    group,
    recipient,
    other,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

const AT = "2026-11-10T22:20:00.000000Z";

const taskRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  title: "Call the pharmacy",
  assignee_id: null,
  assignee_name: null,
  due_on: "2026-11-21",
  due_time: null,
  done_at: null,
  done_by: null,
  provider_id: null,
  medication_id: null,
  event_id: null,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
  created_by: "ignored",
  updated_by: "ignored",
  ...overrides,
});

describe("sync.upload: task", () => {
  it("applies PUT (idempotent), an edit PATCH, and DELETE (soft, replayable)", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "task", id, data: taskRow(group.id, recipient.id) };
    const patch = {
      op: "PATCH" as const,
      table: "task",
      id,
      data: { title: "Call Corner Pharmacy", due_time: "17:00" },
    };

    expect((await owner.api.sync.upload({ ops: [put, patch] })).results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    expect(ok(await taskService.getById(owner.ctx, id))).toMatchObject({
      title: "Call Corner Pharmacy",
      dueOn: "2026-11-21",
      dueTime: "17:00",
      createdBy: owner.user.id,
    });
    expect(
      (await owner.api.sync.upload({ ops: [put, patch] })).results.every((r) => r.status === "applied"),
    ).toBe(true);

    expect((await owner.api.sync.upload({ ops: [{ op: "DELETE", table: "task", id }] })).results).toEqual([
      { id, status: "applied" },
    ]);
    expect(await taskService.getById(owner.ctx, id)).toBeNull();
    expect((await owner.api.sync.upload({ ops: [{ op: "DELETE", table: "task", id }] })).results).toEqual([
      { id, status: "applied" },
    ]);
  });

  it("soft-removes on a PATCH of deleted_at", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "task", id, data: taskRow(group.id, recipient.id) };
    const remove = { op: "PATCH" as const, table: "task", id, data: { deleted_at: AT } };
    expect((await owner.api.sync.upload({ ops: [put, remove] })).results.map((r) => r.status)).toEqual([
      "applied",
      "applied",
    ]);
    expect(ok(await taskService.getById(owner.ctx, id, { includeDeleted: true }))!.deletedAt).not.toBeNull();
  });

  it("uploads a viewer's offline tick and reopen on their own task, and refuses their edits", async () => {
    const { group, recipient, owner, viewer } = await setup();
    const id = randomUUID();
    const put = {
      op: "PUT" as const,
      table: "task",
      id,
      data: taskRow(group.id, recipient.id, { assignee_id: viewer.user.id }),
    };
    expect((await owner.api.sync.upload({ ops: [put] })).results).toEqual([{ id, status: "applied" }]);

    const tick = { op: "PATCH" as const, table: "task", id, data: { done_at: AT, done_by: viewer.user.id } };
    expect((await viewer.api.sync.upload({ ops: [tick] })).results).toEqual([{ id, status: "applied" }]);
    expect(ok(await taskService.getById(owner.ctx, id))).toMatchObject({
      doneAt: "2026-11-10 22:20:00+00",
      doneBy: viewer.user.id,
    });

    const reopen = { op: "PATCH" as const, table: "task", id, data: { done_at: null, done_by: null } };
    expect((await viewer.api.sync.upload({ ops: [reopen] })).results).toEqual([{ id, status: "applied" }]);
    expect(ok(await taskService.getById(owner.ctx, id))).toMatchObject({ doneAt: null, doneBy: null });

    const rename = { op: "PATCH" as const, table: "task", id, data: { title: "Mine now" } };
    expect((await viewer.api.sync.upload({ ops: [rename] })).results).toEqual([
      { id, status: "rejected", code: "taskService:viewerCompletionOnly" },
    ]);
    expect(ok(await taskService.getById(owner.ctx, id))).toMatchObject({ title: "Call the pharmacy" });
  });

  it("refuses a changed group or recipient (immutable)", async () => {
    const { group, recipient, other, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "task", id, data: taskRow(group.id, recipient.id) };
    expect((await owner.api.sync.upload({ ops: [put] })).results).toEqual([{ id, status: "applied" }]);

    const moved = { op: "PATCH" as const, table: "task", id, data: { group_id: other.group.id } };
    const movedPut = {
      op: "PUT" as const,
      table: "task",
      id,
      data: taskRow(other.group.id, other.recipient.id),
    };
    expect((await owner.api.sync.upload({ ops: [moved, movedPut] })).results).toEqual([
      { id, status: "rejected", code: "taskService:immutable" },
      { id, status: "rejected", code: "taskService:immutable" },
    ]);
  });
});
