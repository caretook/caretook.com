import type { TodoCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createWorld, ok } from "../../test/fixtures";
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
