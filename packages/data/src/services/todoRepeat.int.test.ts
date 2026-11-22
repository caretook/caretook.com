import type { TodoCreateInput } from "../db";

import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { SYSTEM_USER } from "../constants";
import { addDays, localDate } from "../db/schema";
import { nextTodoId } from "../db/schema/appointments/series";
import { isError } from "../errors";
import { todoModel } from "../models";
import { medicationService, noteDocumentService, providerService, todoService } from ".";

// Repeating todos (planner-2) through todoService: the repeat columns on
// create and update, the next occurrence on a tick (once), reopen and Undo,
// skip, and an ended rule. Ticks pass the device's tick time (`doneAt`), so
// the day the next one follows is fixed; the group's recipient is in Los
// Angeles. Every test builds its own group and users.

const LA = "America/Los_Angeles";
const WEEKLY_MO = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
// Mon 2026-11-16, 12:00 in Los Angeles.
const MONDAY_NOON = "2026-11-16T20:00:00.000Z";

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
  };
  const { group, recipient } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const addTodo = async (overrides: Partial<TodoCreateInput> = {}) => {
    const todo = ok(
      await todoService.create(u.caretaker.ctx, {
        groupId: group.id,
        title: "Put the bins out",
        dueOn: "2026-11-16",
        dueTime: "19:00",
        repeatRule: WEEKLY_MO,
        ...overrides,
      }),
    );
    if (!todo) throw new Error("todo not readable");
    return todo;
  };
  /** Every row of a chain, deleted ones too, by due day. */
  const chain = async (repeatId: string) =>
    ok(
      await todoModel.list({
        authUser: SYSTEM_USER,
        includeDeleted: true,
        filter: { groupId: { type: "eq", value: group.id }, repeatId: { type: "eq", value: repeatId } },
        orderBy: [{ field: "dueOn", direction: "asc" }],
      }),
    ).data;
  const openIn = async (repeatId: string) => (await chain(repeatId)).filter((t) => !t.doneAt && !t.deletedAt);
  return { u, group, recipient, addTodo, chain, openIn };
};

describe("todoService: repeat columns", () => {
  it("a repeating todo starts its chain on itself, anchored on its due day; a repeat needs a due day", async () => {
    const { u, group, addTodo } = await setup();
    const todo = await addTodo();
    expect(todo).toMatchObject({ repeatRule: WEEKLY_MO, repeatStartsOn: "2026-11-16", repeatId: todo.id });

    const plain = await addTodo({ repeatRule: null });
    expect(plain).toMatchObject({ repeatRule: null, repeatStartsOn: null, repeatId: null });

    const undated = await todoService.create(u.caretaker.ctx, {
      groupId: group.id,
      title: "Bins",
      repeatRule: WEEKLY_MO,
    });
    expect(codeOf(undated)).toBe("todoService:invalid");
    expect(codeOf(await todoService.update(u.caretaker.ctx, todo.id, { dueOn: null }))).toBe(
      "todoService:invalid",
    );
    expect(codeOf(await todoService.update(u.caretaker.ctx, todo.id, { repeatRule: "FREQ=HOURLY" }))).toBe(
      "todoService:invalid",
    );
  });

  it("the database holds all three or none, and a rule only with a due day", async () => {
    const { group, recipient } = await setup();
    const base = { groupId: group.id, recipientId: recipient.id, title: "Bins", dueOn: "2026-11-16" };
    const partial = await todoModel.create({
      authUser: SYSTEM_USER,
      data: { ...base, repeatRule: WEEKLY_MO, repeatStartsOn: "2026-11-16" },
    });
    expect(isError(partial)).toBe(true);
    const undated = await todoModel.create({
      authUser: SYSTEM_USER,
      data: {
        ...base,
        dueOn: null,
        repeatRule: WEEKLY_MO,
        repeatStartsOn: "2026-11-16",
        repeatId: group.id,
      },
    });
    expect(isError(undated)).toBe(true);
  });

  it("editing: a title change keeps the anchor, a new rule or due day moves it, clearing clears all three; viewers can't", async () => {
    const { u, addTodo } = await setup();
    const todo = await addTodo();
    expect(
      ok(await todoService.update(u.caretaker.ctx, todo.id, { title: "Bins and recycling" })),
    ).toMatchObject({
      repeatStartsOn: "2026-11-16",
      repeatId: todo.id,
    });
    expect(ok(await todoService.update(u.caretaker.ctx, todo.id, { dueOn: "2026-11-23" }))).toMatchObject({
      repeatRule: WEEKLY_MO,
      repeatStartsOn: "2026-11-23",
      repeatId: todo.id,
    });
    const fortnightly = "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO";
    expect(ok(await todoService.update(u.caretaker.ctx, todo.id, { repeatRule: fortnightly }))).toMatchObject(
      {
        repeatRule: fortnightly,
        repeatStartsOn: "2026-11-23",
      },
    );
    expect(ok(await todoService.update(u.caretaker.ctx, todo.id, { repeatRule: null }))).toMatchObject({
      repeatRule: null,
      repeatStartsOn: null,
      repeatId: null,
    });
    // Repeating again starts a new chain on it.
    expect(ok(await todoService.update(u.caretaker.ctx, todo.id, { repeatRule: WEEKLY_MO }))).toMatchObject({
      repeatStartsOn: "2026-11-23",
      repeatId: todo.id,
    });

    const viewers = await addTodo({ assigneeId: u.viewer.user.id });
    expect(codeOf(await todoService.update(u.viewer.ctx, viewers.id, { repeatRule: null }))).toBe(
      "todoService:completionOnly",
    );
  });
});

describe("todoService: tick", () => {
  it("complete leaves it done and one open next todo carrying the title, assignee, time, links and repeat; again, or from a second caller, makes no second", async () => {
    const { u, group, addTodo, chain, openIn } = await setup();
    const provider = ok(
      await providerService.create(u.caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Lark",
      }),
    )!;
    const medication = ok(
      await medicationService.create(u.caretaker.ctx, {
        groupId: group.id,
        name: "Latanoprost",
        schedule: { type: "asNeeded" },
      }),
    )!;
    const todo = await addTodo({
      assigneeId: u.admin.user.id,
      providerId: provider.id,
      medicationId: medication.id,
    });

    const done = ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: MONDAY_NOON }));
    expect(done).toMatchObject({ id: todo.id, doneBy: u.caretaker.user.id, repeatRule: WEEKLY_MO });
    const nextId = nextTodoId(todo.id, "2026-11-23");
    expect(ok(await todoService.getById(u.owner.ctx, nextId))).toMatchObject({
      groupId: group.id,
      title: "Put the bins out",
      assigneeId: u.admin.user.id,
      dueOn: "2026-11-23",
      dueTime: "19:00",
      providerId: provider.id,
      medicationId: medication.id,
      eventId: null,
      doneAt: null,
      doneBy: null,
      repeatRule: WEEKLY_MO,
      repeatStartsOn: "2026-11-16",
      repeatId: todo.id,
      // The server is the author of the next occurrence.
      createdBy: SYSTEM_USER.id,
    });

    ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: MONDAY_NOON }));
    ok(await todoService.complete(u.admin.ctx, todo.id));
    expect((await chain(todo.id)).map((t) => t.id)).toEqual([todo.id, nextId]);
    expect((await openIn(todo.id)).map((t) => t.id)).toEqual([nextId]);
  });

  it("a tick three weeks late brings the next one on the next rule day after that day", async () => {
    const { u, addTodo, openIn } = await setup();
    // Due Mon 2026-10-19, ticked Wed 2026-11-11 in Los Angeles.
    const todo = await addTodo({ dueOn: "2026-10-19" });
    ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: "2026-11-11T18:00:00.000Z" }));
    expect((await openIn(todo.id)).map((t) => [t.id, t.dueOn])).toEqual([
      [nextTodoId(todo.id, "2026-11-16"), "2026-11-16"],
    ]);
  });

  it("a viewer completing their own repeating todo gets the next", async () => {
    const { u, addTodo, openIn } = await setup();
    const todo = await addTodo({ assigneeId: u.viewer.user.id });
    expect(ok(await todoService.complete(u.viewer.ctx, todo.id, { doneAt: MONDAY_NOON }))).toMatchObject({
      doneBy: u.viewer.user.id,
    });
    expect(await openIn(todo.id)).toMatchObject([
      { id: nextTodoId(todo.id, "2026-11-23"), assigneeId: u.viewer.user.id, dueOn: "2026-11-23" },
    ]);
  });

  it("a successor moved back onto its source's day and ticked gets a new open successor (B-386)", async () => {
    const { u, addTodo, openIn } = await setup();
    const todo = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: MONDAY_NOON }));
    // Made for Mon 23rd (that day's id), moved back to Mon 16th and ticked
    // then: the 23rd's id is its own, so the next is the 30th.
    const second = nextTodoId(todo.id, "2026-11-23");
    ok(await todoService.update(u.caretaker.ctx, second, { dueOn: "2026-11-16" }));
    ok(await todoService.complete(u.caretaker.ctx, second, { doneAt: MONDAY_NOON }));
    expect((await openIn(todo.id)).map((t) => [t.id, t.dueOn])).toEqual([
      [nextTodoId(todo.id, "2026-11-30"), "2026-11-30"],
    ]);
  });

  it("a day whose id a done occurrence holds is passed over for the following one (B-386)", async () => {
    const { u, addTodo, openIn } = await setup();
    const todo = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: MONDAY_NOON }));
    // The 23rd's occurrence, moved on to the 30th and ticked: done, with the 23rd's id.
    const second = nextTodoId(todo.id, "2026-11-23");
    ok(await todoService.update(u.caretaker.ctx, second, { dueOn: "2026-11-30" }));
    ok(await todoService.complete(u.caretaker.ctx, second, { doneAt: MONDAY_NOON }));
    const third = nextTodoId(todo.id, "2026-12-07");
    expect((await openIn(todo.id)).map((t) => t.id)).toEqual([third]);
    // The next, moved back to the 16th and ticked: the 23rd is taken, so the 30th.
    ok(await todoService.update(u.caretaker.ctx, third, { dueOn: "2026-11-16" }));
    ok(await todoService.complete(u.caretaker.ctx, third, { doneAt: MONDAY_NOON }));
    expect((await openIn(todo.id)).map((t) => [t.id, t.dueOn])).toEqual([
      [nextTodoId(todo.id, "2026-11-30"), "2026-11-30"],
    ]);
  });

  it("an ended rule makes none; a todo that doesn't repeat makes none", async () => {
    const { u, addTodo, chain } = await setup();
    const last = await addTodo({ repeatRule: `${WEEKLY_MO};COUNT=1` });
    ok(await todoService.complete(u.caretaker.ctx, last.id, { doneAt: MONDAY_NOON }));
    expect((await chain(last.id)).map((t) => t.id)).toEqual([last.id]);

    const plain = await addTodo({ repeatRule: null });
    ok(await todoService.complete(u.caretaker.ctx, plain.id, { doneAt: MONDAY_NOON }));
    expect(await todoService.getById(u.owner.ctx, nextTodoId(plain.id, "2026-11-23"))).toBeNull();
  });
});

describe("todoService: reopen and Undo", () => {
  it("reopen removes an untouched next; ticking again brings it back, once", async () => {
    const { u, addTodo, openIn } = await setup();
    const todo = await addTodo({ assigneeId: u.viewer.user.id });
    const nextId = nextTodoId(todo.id, "2026-11-23");
    ok(await todoService.complete(u.viewer.ctx, todo.id, { doneAt: MONDAY_NOON }));

    expect(ok(await todoService.reopen(u.viewer.ctx, todo.id))).toMatchObject({
      doneAt: null,
      repeatRule: WEEKLY_MO,
      repeatId: todo.id,
    });
    expect(await todoService.getById(u.owner.ctx, nextId)).toBeNull();
    expect((await openIn(todo.id)).map((t) => t.id)).toEqual([todo.id]);

    ok(await todoService.complete(u.viewer.ctx, todo.id, { doneAt: MONDAY_NOON }));
    expect((await openIn(todo.id)).map((t) => t.id)).toEqual([nextId]);
  });

  it("keeps an edited next, or one with notes; the reopened todo then stops repeating", async () => {
    const { u, group, addTodo, openIn } = await setup();
    const edited = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, edited.id, { doneAt: MONDAY_NOON }));
    const editedNext = nextTodoId(edited.id, "2026-11-23");
    ok(await todoService.update(u.caretaker.ctx, editedNext, { title: "Bins and recycling" }));
    expect(ok(await todoService.reopen(u.caretaker.ctx, edited.id))).toMatchObject({
      doneAt: null,
      repeatRule: null,
      repeatStartsOn: null,
      repeatId: null,
    });
    expect(ok(await todoService.getById(u.owner.ctx, editedNext))).toMatchObject({
      title: "Bins and recycling",
      repeatRule: WEEKLY_MO,
    });
    expect((await openIn(edited.id)).map((t) => t.id)).toEqual([editedNext]);

    const noted = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, noted.id, { doneAt: MONDAY_NOON }));
    const notedNext = nextTodoId(noted.id, "2026-11-23");
    ok(
      await noteDocumentService.create(u.caretaker.ctx, {
        id: notedNext,
        groupId: group.id,
        subject: "todo",
      }),
    );
    expect(ok(await todoService.reopen(u.caretaker.ctx, noted.id))).toMatchObject({ repeatRule: null });
    expect(ok(await todoService.getById(u.owner.ctx, notedNext))).not.toBeNull();
  });

  it("reopening an older tick whose next was ticked too keeps both; the older one stops repeating", async () => {
    const { u, addTodo, openIn } = await setup();
    const todo = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: MONDAY_NOON }));
    const second = nextTodoId(todo.id, "2026-11-23");
    ok(await todoService.complete(u.caretaker.ctx, second, { doneAt: "2026-11-23T20:00:00.000Z" }));
    const third = nextTodoId(todo.id, "2026-11-30");

    expect(ok(await todoService.reopen(u.caretaker.ctx, todo.id))).toMatchObject({ repeatRule: null });
    expect((await openIn(todo.id)).map((t) => t.id)).toEqual([third]);
  });
});

describe("todoService: skip", () => {
  it("soft-deletes this occurrence and makes the next; refused for a viewer, even on their own", async () => {
    const { u, recipient, addTodo, openIn } = await setup();
    expect(recipient.timeZone).toBe(LA);
    const today = localDate(new Date(), LA);
    // Daily from long ago: the next one is tomorrow.
    const todo = await addTodo({
      dueOn: "2026-01-05",
      repeatRule: "FREQ=DAILY;INTERVAL=1",
      assigneeId: u.viewer.user.id,
    });
    expect(codeOf(await todoService.skip(u.viewer.ctx, todo.id))).toBe("permissions:unauthorized");

    const tomorrow = addDays(today, 1);
    expect(ok(await todoService.skip(u.caretaker.ctx, todo.id))).toEqual({
      nextId: nextTodoId(todo.id, tomorrow),
    });
    expect(await todoService.getById(u.owner.ctx, todo.id)).toBeNull();
    expect(await openIn(todo.id)).toMatchObject([{ id: nextTodoId(todo.id, tomorrow), dueOn: tomorrow }]);
  });

  it("an ended rule, or a todo that doesn't repeat, is just deleted", async () => {
    const { u, addTodo, chain } = await setup();
    const last = await addTodo({ repeatRule: `${WEEKLY_MO};UNTIL=20261116` });
    expect(ok(await todoService.skip(u.caretaker.ctx, last.id))).toEqual({ nextId: null });
    expect((await chain(last.id)).map((t) => [t.id, !!t.deletedAt])).toEqual([[last.id, true]]);

    const plain = await addTodo({ repeatRule: null });
    expect(ok(await todoService.skip(u.caretaker.ctx, plain.id))).toEqual({ nextId: null });
    expect(await todoService.getById(u.owner.ctx, plain.id)).toBeNull();
  });
});
