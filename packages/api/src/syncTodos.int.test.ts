import type { AuthUser } from "@caretook/data";

import { todoService } from "@caretook/data";
import { nextTodoId } from "@caretook/data/series";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, upload } from "./testing";

// sync.upload for todos: rows as a device's SQLite holds them (snake_case,
// PowerSync's timestamps). Each test makes its own users and group.

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

const todoRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
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

describe("sync.upload: todo", () => {
  it("applies PUT (idempotent), an edit PATCH, and DELETE (soft, replayable)", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "todo", id, data: todoRow(group.id, recipient.id) };
    const patch = {
      op: "PATCH" as const,
      table: "todo",
      id,
      data: { title: "Call Corner Pharmacy", due_time: "17:00" },
    };

    expect(await upload(owner.api, [put, patch])).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    expect(ok(await todoService.getById(owner.ctx, id))).toMatchObject({
      title: "Call Corner Pharmacy",
      dueOn: "2026-11-21",
      dueTime: "17:00",
      createdBy: owner.user.id,
    });
    expect((await upload(owner.api, [put, patch])).every((r) => r.status === "applied")).toBe(true);

    expect(await upload(owner.api, [{ op: "DELETE", table: "todo", id }])).toEqual([
      { id, status: "applied" },
    ]);
    expect(await todoService.getById(owner.ctx, id)).toBeNull();
    expect(await upload(owner.api, [{ op: "DELETE", table: "todo", id }])).toEqual([
      { id, status: "applied" },
    ]);
  });

  it("soft-removes on a PATCH of deleted_at", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "todo", id, data: todoRow(group.id, recipient.id) };
    const remove = { op: "PATCH" as const, table: "todo", id, data: { deleted_at: AT } };
    expect((await upload(owner.api, [put, remove])).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await todoService.getById(owner.ctx, id, { includeDeleted: true }))!.deletedAt).not.toBeNull();
  });

  it("uploads a viewer's offline tick and reopen on their own todo, and refuses their edits", async () => {
    const { group, recipient, owner, viewer } = await setup();
    const id = randomUUID();
    const put = {
      op: "PUT" as const,
      table: "todo",
      id,
      data: todoRow(group.id, recipient.id, { assignee_id: viewer.user.id }),
    };
    expect(await upload(owner.api, [put])).toEqual([{ id, status: "applied" }]);

    const tick = { op: "PATCH" as const, table: "todo", id, data: { done_at: AT, done_by: viewer.user.id } };
    expect(await upload(viewer.api, [tick])).toEqual([{ id, status: "applied" }]);
    expect(ok(await todoService.getById(owner.ctx, id))).toMatchObject({
      doneAt: "2026-11-10 22:20:00+00",
      doneBy: viewer.user.id,
    });

    const reopen = { op: "PATCH" as const, table: "todo", id, data: { done_at: null, done_by: null } };
    expect(await upload(viewer.api, [reopen])).toEqual([{ id, status: "applied" }]);
    expect(ok(await todoService.getById(owner.ctx, id))).toMatchObject({ doneAt: null, doneBy: null });

    const rename = { op: "PATCH" as const, table: "todo", id, data: { title: "Mine now" } };
    expect(await upload(viewer.api, [rename])).toEqual([
      { id, status: "rejected", code: "todoService:completionOnly" },
    ]);
    expect(ok(await todoService.getById(owner.ctx, id))).toMatchObject({ title: "Call the pharmacy" });
  });

  it("refuses a changed group or recipient (immutable)", async () => {
    const { group, recipient, other, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "todo", id, data: todoRow(group.id, recipient.id) };
    expect(await upload(owner.api, [put])).toEqual([{ id, status: "applied" }]);

    const moved = { op: "PATCH" as const, table: "todo", id, data: { group_id: other.group.id } };
    const movedPut = {
      op: "PUT" as const,
      table: "todo",
      id,
      data: todoRow(other.group.id, other.recipient.id),
    };
    expect(await upload(owner.api, [moved, movedPut])).toEqual([
      { id, status: "rejected", code: "todoService:immutable" },
      { id, status: "rejected", code: "todoService:immutable" },
    ]);
  });

  it("refuses the old table name, task, like any table it doesn't know", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const ops = [
      { op: "PUT" as const, table: "task", id, data: todoRow(group.id, recipient.id) },
      { op: "PATCH" as const, table: "task", id, data: { done_at: AT, done_by: owner.user.id } },
      { op: "DELETE" as const, table: "task", id },
    ];
    const rejected = { id, status: "rejected", code: "sync:readOnlyTable" };
    expect(await upload(owner.api, ops)).toEqual([rejected, rejected, rejected]);
    expect(ok(await todoService.getById(owner.ctx, id))).toBeNull();
  });
});

// Repeating todos (planner-2): a device's tick writes the todo done and its
// next occurrence (a twin of the one todoService makes, the same id) in one
// local transaction, so it uploads a done PATCH, then the twin's PUT.
describe("sync.upload: repeating todos", () => {
  const WEEKLY_MO = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
  const DAILY = "FREQ=DAILY;INTERVAL=1";
  // Mon 2026-11-16 and Tue 2026-11-17, 12:00 in Los Angeles (PowerSync's form).
  const MONDAY = "2026-11-16T20:00:00.000000Z";
  const TUESDAY = "2026-11-17T20:00:00.000000Z";

  const repeating = (
    id: string,
    groupId: string,
    recipientId: string,
    overrides: Record<string, unknown> = {},
  ) =>
    todoRow(groupId, recipientId, {
      due_on: "2026-11-16",
      repeat_rule: WEEKLY_MO,
      repeat_starts_on: "2026-11-16",
      repeat_id: id,
      ...overrides,
    });
  /** The device's twin of the next occurrence on `day`. */
  const twin = (first: string, groupId: string, recipientId: string, day: string, rule = WEEKLY_MO) => ({
    op: "PUT" as const,
    table: "todo",
    id: nextTodoId(first, day),
    data: repeating(first, groupId, recipientId, { due_on: day, repeat_rule: rule }),
  });
  const tick = (id: string, at: string, by: string) => ({
    op: "PATCH" as const,
    table: "todo",
    id,
    data: { done_at: at, done_by: by },
  });
  const openIn = async (ctx: { authUser: AuthUser }, groupId: string, repeatId: string) =>
    ok(await todoService.list(ctx, { groupId }))
      .data.filter((t) => t.repeatId === repeatId && !t.doneAt)
      .map((t) => [t.id, t.dueOn]);

  it("a writer's new repeating todo starts its chain; its tick and twin upload cleanly, leaving one next todo", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "todo", id, data: repeating(id, group.id, recipient.id) };
    const ops = [put, tick(id, MONDAY, owner.user.id), twin(id, group.id, recipient.id, "2026-11-23")];
    expect((await upload(owner.api, ops)).map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    expect(ok(await todoService.getById(owner.ctx, id))).toMatchObject({
      repeatRule: WEEKLY_MO,
      repeatStartsOn: "2026-11-16",
      repeatId: id,
    });
    expect(await openIn(owner.ctx, group.id, id)).toEqual([[nextTodoId(id, "2026-11-23"), "2026-11-23"]]);
    // A replay changes nothing.
    expect((await upload(owner.api, ops)).every((r) => r.status === "applied")).toBe(true);
    expect(await openIn(owner.ctx, group.id, id)).toEqual([[nextTodoId(id, "2026-11-23"), "2026-11-23"]]);
  });

  it("a viewer's tick on their own repeating todo and its twin upload cleanly", async () => {
    const { group, recipient, owner, viewer } = await setup();
    const id = randomUUID();
    const put = {
      op: "PUT" as const,
      table: "todo",
      id,
      data: repeating(id, group.id, recipient.id, { assignee_id: viewer.user.id }),
    };
    expect(await upload(owner.api, [put])).toEqual([{ id, status: "applied" }]);

    const twinOp = twin(id, group.id, recipient.id, "2026-11-23");
    const next = { ...twinOp, data: { ...twinOp.data, assignee_id: viewer.user.id } };
    expect(await upload(viewer.api, [tick(id, MONDAY, viewer.user.id), next])).toEqual([
      { id, status: "applied" },
      { id: next.id, status: "applied" },
    ]);
    expect(await openIn(owner.ctx, group.id, id)).toEqual([[next.id, "2026-11-23"]]);
  });

  it("two devices ticking the same todo on different days end with one next todo", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = {
      op: "PUT" as const,
      table: "todo",
      id,
      data: repeating(id, group.id, recipient.id, { repeat_rule: DAILY }),
    };
    expect(await upload(owner.api, [put])).toEqual([{ id, status: "applied" }]);

    // One device ticked it Monday (next: Tuesday), another, offline, Tuesday (next: Wednesday).
    const first = [tick(id, MONDAY, owner.user.id), twin(id, group.id, recipient.id, "2026-11-17", DAILY)];
    const second = [tick(id, TUESDAY, owner.user.id), twin(id, group.id, recipient.id, "2026-11-18", DAILY)];
    expect((await upload(owner.api, first)).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect((await upload(owner.api, second)).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await openIn(owner.ctx, group.id, id)).toEqual([[nextTodoId(id, "2026-11-17"), "2026-11-17"]]);
    expect(
      await todoService.getById(owner.ctx, nextTodoId(id, "2026-11-18"), { includeDeleted: true }),
    ).toBeNull();
  });

  it("a device's Undo removes the untouched next; a skip deletes this one and makes the next", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "todo", id, data: repeating(id, group.id, recipient.id) };
    const next = twin(id, group.id, recipient.id, "2026-11-23");
    ok(await owner.api.sync.upload({ ops: [put, tick(id, MONDAY, owner.user.id), next] }));

    // Undo: the reopen, then the next one's soft delete.
    const undo = [
      { op: "PATCH" as const, table: "todo", id, data: { done_at: null, done_by: null } },
      { op: "PATCH" as const, table: "todo", id: next.id, data: { deleted_at: MONDAY } },
    ];
    expect((await upload(owner.api, undo)).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await openIn(owner.ctx, group.id, id)).toEqual([[id, "2026-11-16"]]);

    // Skip: this one's soft delete, then the next one brought back (the
    // device has the Undo's deleted copy, so it's a PATCH, not a PUT).
    const skip = [
      { op: "PATCH" as const, table: "todo", id, data: { deleted_at: MONDAY } },
      { op: "PATCH" as const, table: "todo", id: next.id, data: { deleted_at: null } },
    ];
    expect((await upload(owner.api, skip)).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await todoService.getById(owner.ctx, id)).toBeNull();
    expect(await openIn(owner.ctx, group.id, id)).toEqual([[next.id, "2026-11-23"]]);

    // A first skip, where the device never had the next: its PUT is a writer's create.
    const other = randomUUID();
    const otherPut = {
      op: "PUT" as const,
      table: "todo",
      id: other,
      data: repeating(other, group.id, recipient.id),
    };
    const otherNext = twin(other, group.id, recipient.id, "2026-11-23");
    const firstSkip = [
      otherPut,
      { op: "PATCH" as const, table: "todo", id: other, data: { deleted_at: MONDAY } },
      otherNext,
    ];
    expect((await upload(owner.api, firstSkip)).map((r) => r.status)).toEqual([
      "applied",
      "applied",
      "applied",
    ]);
    expect(await openIn(owner.ctx, group.id, other)).toEqual([[otherNext.id, "2026-11-23"]]);
  });

  it("refuses a twin whose id isn't its chain's for that day, and a viewer's skip", async () => {
    const { group, recipient, owner, viewer } = await setup();
    const id = randomUUID();
    const put = {
      op: "PUT" as const,
      table: "todo",
      id,
      data: repeating(id, group.id, recipient.id, { assignee_id: viewer.user.id }),
    };
    ok(await owner.api.sync.upload({ ops: [put] }));
    const forged = { ...twin(id, group.id, recipient.id, "2026-11-23"), id: randomUUID() };
    expect(await upload(owner.api, [forged])).toEqual([
      { id: forged.id, status: "rejected", code: "todoService:notAnOccurrence" },
    ]);

    const next = twin(id, group.id, recipient.id, "2026-11-23");
    const skip = [{ op: "PATCH" as const, table: "todo", id, data: { deleted_at: MONDAY } }, next];
    // The delete is refused; with this one still open, the twin is stale: nothing is written.
    expect((await upload(viewer.api, skip)).map((r) => r.status)).toEqual(["rejected", "applied"]);
    expect(await todoService.getById(owner.ctx, next.id, { includeDeleted: true })).toBeNull();
    expect(await openIn(owner.ctx, group.id, id)).toEqual([[id, "2026-11-16"]]);
  });
});
