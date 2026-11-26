import type { TodoCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createWorld, ok } from "../../test/fixtures";
import { withTransaction } from "../db";
import { isError } from "../errors";
import { todoService } from ".";

// Subtasks on the server (todo-subtasks slice 1): the parent on create and
// upsert, the depth limit, and no repeats in a tree. Every test builds its
// own world.

const WEEKLY_MO = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const issuesOf = (res: unknown) =>
  isError(res)
    ? ((res.meta as { issues?: { path: string }[] } | undefined)?.issues ?? []).map((i) => i.path)
    : [];

const setup = async () => {
  const world = await createWorld({ extras: ["outsider", "staff"] });
  const { u, group } = world;
  const input = (overrides: Partial<TodoCreateInput> = {}): TodoCreateInput => ({
    groupId: group.id,
    title: "Get ready for the hospital stay",
    ...overrides,
  });
  const addTodo = async (overrides: Partial<TodoCreateInput> = {}) => {
    const todo = ok(await todoService.create(u.caretaker.ctx, input(overrides)));
    if (!todo) throw new Error("todo not readable");
    return todo;
  };
  return { ...world, input, addTodo };
};

describe("todoService: subtasks", () => {
  it("lets a writer add a subtask and a sub-subtask, and refuses a fourth level", async () => {
    const { u, input, addTodo } = await setup();
    const top = await addTodo();
    const sub = ok(await todoService.create(u.owner.ctx, input({ title: "Pack a bag", parentId: top.id })));
    expect(sub).toMatchObject({ parentId: top.id, createdBy: u.owner.user.id });
    const subSub = ok(
      await todoService.create(u.admin.ctx, input({ title: "Find the charger", parentId: sub!.id })),
    );
    expect(subSub).toMatchObject({ parentId: sub!.id });
    expect(ok(await todoService.getById(u.viewer.ctx, subSub!.id))).toMatchObject({ parentId: sub!.id });

    const tooDeep = await todoService.create(
      u.caretaker.ctx,
      input({ title: "Too deep", parentId: subSub!.id }),
    );
    expect(codeOf(tooDeep)).toBe("todoService:badParent");
    expect(issuesOf(tooDeep)).toEqual(["parentId"]);
  });

  it("refuses a parent in another group, a deleted one, a missing one and a repeating one", async () => {
    const { u, input, addTodo } = await setup();
    // The caretaker's own second group: a parent they can see, elsewhere.
    const { group: other } = await createGroup(u.caretaker);
    const elsewhere = ok(
      await todoService.create(u.caretaker.ctx, { groupId: other.id, title: "Elsewhere" }),
    );
    const deleted = await addTodo({ title: "Deleted" });
    ok(await todoService.remove(u.caretaker.ctx, deleted.id));
    const repeating = await addTodo({ title: "Bins", dueOn: "2026-11-16", repeatRule: WEEKLY_MO });

    for (const parentId of [elsewhere!.id, deleted.id, randomUUID(), repeating.id]) {
      const res = await todoService.create(u.caretaker.ctx, input({ title: "Sub", parentId }));
      expect(codeOf(res)).toBe("todoService:badParent");
      expect(issuesOf(res)).toEqual(["parentId"]);
    }
  });

  it("takes the parent on upsert, checked the same way; a replay keeps the parent it has", async () => {
    const { u, group, addTodo } = await setup();
    const top = await addTodo();
    const id = randomUUID();
    const created = ok(
      await todoService.upsert(u.caretaker.ctx, { id, groupId: group.id, title: "Sub", parentId: top.id }),
    );
    expect(created).toMatchObject({ created: true, row: { id, parentId: top.id } });

    const other = await addTodo({ title: "Other" });
    const replay = ok(
      await todoService.upsert(u.caretaker.ctx, { id, groupId: group.id, title: "Sub", parentId: other.id }),
    );
    expect(replay).toMatchObject({ created: false, row: { parentId: top.id } });

    const deleted = await addTodo({ title: "Deleted" });
    ok(await todoService.remove(u.caretaker.ctx, deleted.id));
    const refused = await todoService.upsert(u.caretaker.ctx, {
      id: randomUUID(),
      groupId: group.id,
      title: "Sub",
      parentId: deleted.id,
    });
    expect(codeOf(refused)).toBe("todoService:badParent");
  });

  it("never changes the parent on update", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo();
    const sub = await addTodo({ title: "Sub", parentId: top.id });
    const res = await todoService.update(u.caretaker.ctx, sub.id, { parentId: null } as never);
    expect(codeOf(res)).toBe("todoService:invalid");
    expect(ok(await todoService.getById(u.caretaker.ctx, sub.id))).toMatchObject({ parentId: top.id });
  });

  it("refuses a repeat on a subtask and on a todo with live subtasks, both on create and on update", async () => {
    const { u, input, addTodo } = await setup();
    const top = await addTodo({ dueOn: "2026-11-16" });

    const repeatingSub = await todoService.create(
      u.caretaker.ctx,
      input({ title: "Sub", parentId: top.id, dueOn: "2026-11-16", repeatRule: WEEKLY_MO }),
    );
    expect(codeOf(repeatingSub)).toBe("todoService:repeatWithSubtasks");
    expect(issuesOf(repeatingSub)).toEqual(["repeatRule"]);

    const sub = await addTodo({ title: "Sub", parentId: top.id, dueOn: "2026-11-16" });
    for (const id of [sub.id, top.id]) {
      const res = await todoService.update(u.caretaker.ctx, id, { repeatRule: WEEKLY_MO });
      expect(codeOf(res)).toBe("todoService:repeatWithSubtasks");
      expect(issuesOf(res)).toEqual(["repeatRule"]);
    }
    // Other edits still go through, and once its only subtask is gone the parent may repeat.
    ok(await todoService.update(u.caretaker.ctx, top.id, { title: "Hospital stay" }));
    ok(await todoService.remove(u.caretaker.ctx, sub.id));
    expect(ok(await todoService.update(u.caretaker.ctx, top.id, { repeatRule: WEEKLY_MO }))).toMatchObject({
      repeatRule: WEEKLY_MO,
    });
  });

  it("refuses a viewer's subtask; a non-member reads and writes nothing", async () => {
    const { u, group, input, addTodo } = await setup();
    const top = await addTodo();
    const sub = await addTodo({ title: "Sub", parentId: top.id });

    expect(codeOf(await todoService.create(u.viewer.ctx, input({ title: "Sub", parentId: top.id })))).toBe(
      "permissions:unauthorized",
    );
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await todoService.create(u[role].ctx, input({ title: "Sub", parentId: top.id })))).toBe(
        "permissions:unauthorized",
      );
      expect(
        codeOf(
          await todoService.upsert(u[role].ctx, {
            id: randomUUID(),
            groupId: group.id,
            title: "Sub",
            parentId: top.id,
          }),
        ),
      ).toBe("permissions:unauthorized");
      expect(await todoService.getById(u[role].ctx, sub.id)).toBeNull();
      expect(ok(await todoService.list(u[role].ctx, { groupId: group.id })).data).toEqual([]);
    }
    const page = ok(await todoService.list(u.owner.ctx, { groupId: group.id }));
    expect(page.data.map((t) => t.title)).toEqual([top.title, "Sub"]);
  });
});

// Slice 2: the rollup (a parent follows its live children, up to the top, as
// the system with the actor as `done_by`), `openSubtasks`, and the cascading
// delete.
describe("todoService: the rollup and the cascading delete", () => {
  const stateOf = async (ctx: Parameters<typeof todoService.getById>[0], id: string) => {
    const todo = ok(await todoService.getById(ctx, id, { includeDeleted: true }));
    if (!todo) throw new Error("todo not readable");
    return { done: !!todo.doneAt, doneBy: todo.doneBy, deleted: !!todo.deletedAt };
  };

  it("ticking the last open sub-subtask completes its parent and grandparent; reopening it reopens both", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo();
    const sub = await addTodo({ title: "Pack a bag", parentId: top.id });
    const sibling = await addTodo({ title: "Print the medication list", parentId: top.id });
    const first = await addTodo({ title: "Find the charger", parentId: sub.id });
    const last = await addTodo({ title: "Fold the pajamas", parentId: sub.id });
    ok(await todoService.complete(u.caretaker.ctx, sibling.id));
    ok(await todoService.complete(u.caretaker.ctx, first.id));
    expect(await stateOf(u.owner.ctx, sub.id)).toMatchObject({ done: false });

    ok(await todoService.complete(u.admin.ctx, last.id));
    for (const id of [sub.id, top.id])
      expect(await stateOf(u.owner.ctx, id)).toEqual({ done: true, doneBy: u.admin.user.id, deleted: false });
    // Written as the system, not the actor.
    const parent = ok(await todoService.getById(u.owner.ctx, top.id))!;
    expect(parent.updatedBy).not.toBe(u.admin.user.id);

    ok(await todoService.reopen(u.caretaker.ctx, last.id));
    for (const id of [sub.id, top.id])
      expect(await stateOf(u.owner.ctx, id)).toEqual({ done: false, doneBy: null, deleted: false });
    // The other children are as they were.
    for (const id of [sibling.id, first.id])
      expect(await stateOf(u.owner.ctx, id)).toMatchObject({ done: true });
  });

  it("adding an open subtask reopens a done parent, up the chain", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo();
    const sub = await addTodo({ title: "Pack a bag", parentId: top.id });
    ok(await todoService.complete(u.caretaker.ctx, sub.id));
    expect(await stateOf(u.owner.ctx, top.id)).toMatchObject({ done: true });

    // A done parent at the middle level takes a new open subtask: both above reopen.
    await addTodo({ title: "Find the charger", parentId: sub.id });
    for (const id of [sub.id, top.id]) expect(await stateOf(u.owner.ctx, id)).toMatchObject({ done: false });
  });

  it("deleting the last open subtask with done siblings completes the parent; deleting the only one leaves it", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo();
    const done = await addTodo({ title: "Pack a bag", parentId: top.id });
    const open = await addTodo({ title: "Call the dog sitter", parentId: top.id });
    ok(await todoService.complete(u.caretaker.ctx, done.id));
    ok(await todoService.remove(u.owner.ctx, open.id));
    expect(await stateOf(u.caretaker.ctx, top.id)).toEqual({
      done: true,
      doneBy: u.owner.user.id,
      deleted: false,
    });

    const lone = await addTodo({ title: "Lone parent" });
    const only = await addTodo({ title: "Only step", parentId: lone.id });
    ok(await todoService.remove(u.owner.ctx, only.id));
    expect(await stateOf(u.caretaker.ctx, lone.id)).toMatchObject({ done: false });
  });

  it("a viewer's tick of their own last subtask completes a parent assigned to someone else", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo({ assigneeId: u.caretaker.user.id });
    const theirs = await addTodo({ title: "Pack a bag", parentId: top.id });
    const mine = await addTodo({ title: "Walk the dog", parentId: top.id, assigneeId: u.viewer.user.id });
    ok(await todoService.complete(u.caretaker.ctx, theirs.id));

    ok(await todoService.complete(u.viewer.ctx, mine.id));
    expect(await stateOf(u.owner.ctx, top.id)).toEqual({
      done: true,
      doneBy: u.viewer.user.id,
      deleted: false,
    });
    // The viewer still can't tick the parent by hand.
    expect(codeOf(await todoService.reopen(u.viewer.ctx, top.id))).toBe("todoService:completionOnly");
  });

  it("refuses completing a parent with open live subtasks (openSubtasks), for a viewer and a writer", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo({ assigneeId: u.viewer.user.id });
    const open = await addTodo({ title: "Pack a bag", parentId: top.id });
    const gone = await addTodo({ title: "Gone", parentId: top.id });
    ok(await todoService.remove(u.caretaker.ctx, gone.id));

    for (const who of [u.viewer, u.caretaker])
      expect(codeOf(await todoService.complete(who.ctx, top.id))).toBe("todoService:openSubtasks");
    expect(await stateOf(u.owner.ctx, top.id)).toMatchObject({ done: false });

    // Its subtasks done, ticking it is the rollup's; reopening by hand reopens only the parent.
    ok(await todoService.complete(u.caretaker.ctx, open.id));
    expect(await stateOf(u.owner.ctx, top.id)).toMatchObject({ done: true });
    ok(await todoService.reopen(u.viewer.ctx, top.id));
    expect(await stateOf(u.owner.ctx, top.id)).toMatchObject({ done: false });
    expect(await stateOf(u.owner.ctx, open.id)).toMatchObject({ done: true });
    // A replayed tick of the done subtask changes nothing; a hand tick now goes through.
    ok(await todoService.complete(u.caretaker.ctx, open.id));
    expect(await stateOf(u.owner.ctx, top.id)).toMatchObject({ done: false });
    ok(await todoService.complete(u.viewer.ctx, top.id));
    expect(await stateOf(u.owner.ctx, top.id)).toMatchObject({ done: true, doneBy: u.viewer.user.id });
  });

  it("deleting a parent soft-deletes every live descendant in one transaction; a viewer deletes nothing", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo();
    const sub = await addTodo({ title: "Pack a bag", parentId: top.id });
    const subSub = await addTodo({ title: "Find the charger", parentId: sub.id });
    const sibling = await addTodo({ title: "Print the medication list", parentId: top.id });
    const unrelated = await addTodo({ title: "Unrelated" });

    expect(codeOf(await todoService.remove(u.viewer.ctx, top.id))).toBe("permissions:unauthorized");
    for (const id of [top.id, sub.id, subSub.id, sibling.id])
      expect(await stateOf(u.owner.ctx, id)).toMatchObject({ deleted: false });

    const removed = ok(await todoService.remove(u.caretaker.ctx, top.id));
    expect(new Set((removed as { ids: string[] }).ids)).toEqual(
      new Set([top.id, sub.id, subSub.id, sibling.id]),
    );
    const rows = await Promise.all(
      [top.id, sub.id, subSub.id, sibling.id].map((id) =>
        todoService.getById(u.owner.ctx, id, { includeDeleted: true }),
      ),
    );
    const deletedAt = rows.map((r) => ok(r)?.deletedAt);
    expect(deletedAt.every(Boolean)).toBe(true);
    // One statement in one transaction: the same instant for all of them.
    expect(new Set(deletedAt.map(String)).size).toBe(1);
    expect(await stateOf(u.owner.ctx, unrelated.id)).toMatchObject({ deleted: false });
    expect(codeOf(await todoService.remove(u.caretaker.ctx, top.id))).toBe("todoService:notFound");
  });

  it("rollUp is idempotent: run again on settled rows, it changes nothing", async () => {
    const { u, addTodo } = await setup();
    const top = await addTodo();
    const sub = await addTodo({ title: "Pack a bag", parentId: top.id });
    ok(await todoService.complete(u.caretaker.ctx, sub.id));
    const before = ok(await todoService.getById(u.owner.ctx, top.id))!;
    expect(await withTransaction((tx) => todoService.rollUp(tx, top.id, u.owner.user.id))).toBeNull();
    const after = ok(await todoService.getById(u.owner.ctx, top.id))!;
    expect(after).toMatchObject({ doneAt: before.doneAt, doneBy: u.caretaker.user.id });
  });
});
