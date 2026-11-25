import type { TodoCreateInput } from "../db";

import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createWorld, ok } from "../../test/fixtures";
import { SYSTEM_USER } from "../constants";
import { getDb } from "../db";
import { entryTodoId, timelineEntrySchema, timelineEntryTodoSchema, todoSchema } from "../db/schema";
import { nextTodoId } from "../db/schema/appointments/series";
import { isError } from "../errors";
import { timelineEntryTodoModel, todoModel } from "../models";
import { entryTodoService, timelineEntryService, todoService } from ".";

// Entry ↔ todo links (planner-3 slice 1): the migration's backfill from
// `todo.event_id`, entryTodoService (roles, refusals, one row per pair, a
// hard delete cascading), the mirror of an old client's `eventId` in
// todoService, and reopening a repeating todo whose next has a link. Every
// test builds its own group and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const LA = "America/Los_Angeles";

const setup = async () => {
  const world = await createWorld({
    members: ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
    extras: ["outsider"],
  });
  const { u, group } = world;
  const entry = async (
    kind: "note" | "event",
    title = kind === "event" ? "Cardiology follow-up" : "Pharmacy call",
  ) =>
    ok(
      await timelineEntryService.create(u.caretaker.ctx, {
        groupId: group.id,
        kind,
        title,
        occurredAt: new Date(Date.now() - 3_600_000).toISOString(),
        timeZone: LA,
      }),
    )!;
  const addTodo = async (overrides: Partial<TodoCreateInput> = {}) =>
    ok(
      await todoService.create(u.caretaker.ctx, {
        groupId: group.id,
        title: "Book a follow-up",
        ...overrides,
      }),
    )!;
  /** The group's link rows for a todo, as Postgres holds them. */
  const linksOf = async (todoId: string) =>
    getDb()
      .select({ id: timelineEntryTodoSchema.id, entryId: timelineEntryTodoSchema.entryId })
      .from(timelineEntryTodoSchema)
      .where(eq(timelineEntryTodoSchema.todoId, todoId));
  const columnOf = async (todoId: string) =>
    ok(await todoModel.getById(todoId, { authUser: SYSTEM_USER, includeDeleted: true }))?.eventId;
  return { ...world, entry, addTodo, linksOf, columnOf };
};

describe("the migration's backfill", () => {
  /** The hand-written statements of the migration that makes the table: the functions, the backfill, the drops. */
  const backfillStatements = () => {
    const dir = new URL("../db/migrations/", import.meta.url);
    const file = readdirSync(dir).find(
      (f) => f.endsWith(".sql") && readFileSync(new URL(f, dir), "utf8").includes('"planner3_sha1"'),
    );
    if (!file) throw new Error("no migration makes timeline_entry_todo");
    return readFileSync(new URL(file, dir), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => /planner3_|INSERT INTO "timeline_entry_todo"/.test(s));
  };

  it("leaves no helper function behind", async () => {
    const { rows } = await getDb().execute(sql`SELECT proname FROM pg_proc WHERE proname LIKE 'planner3_%'`);
    expect(rows).toEqual([]);
  });

  it("makes one row per todo with an event, with the id entryTodoId gives, and none for a todo without", async () => {
    const { u, group, recipient, entry } = await setup();
    const event = await entry("event");
    // Stored as an old build left them: the column set, no link row.
    const [linked, unlinked] = [randomUUID().toUpperCase(), randomUUID()];
    for (const [id, eventId] of [
      [linked, event.id],
      [unlinked, null],
    ] as const)
      await getDb().insert(todoSchema).values({
        id,
        groupId: group.id,
        recipientId: recipient.id,
        title: "Bring the insurance card",
        eventId,
        createdBy: u.caretaker.user.id,
        updatedBy: u.caretaker.user.id,
      });

    const client = await getDb().$client.connect();
    try {
      await client.query("BEGIN");
      for (const statement of backfillStatements()) await client.query(statement);
      const { rows } = await client.query<{
        id: string;
        todo_id: string;
        entry_id: string;
        created_by: string;
      }>(`SELECT id, todo_id, entry_id, created_by FROM timeline_entry_todo WHERE group_id = $1`, [group.id]);
      expect(rows).toEqual([
        {
          id: entryTodoId(event.id, linked),
          todo_id: linked.toLowerCase(),
          entry_id: event.id,
          created_by: u.caretaker.user.id,
        },
      ]);
      const { rows: helpers } = await client.query(
        `SELECT proname FROM pg_proc WHERE proname LIKE 'planner3_%'`,
      );
      expect(helpers).toEqual([]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});

describe("entryTodoService", () => {
  it("lets writers link and unlink on a note and an event; linking twice is one row", async () => {
    const { u, group, entry, addTodo, linksOf } = await setup();
    const todo = await addTodo();
    for (const [who, kind] of [
      ["owner", "note"],
      ["admin", "event"],
    ] as const) {
      const e = await entry(kind);
      const link = { groupId: group.id, entryId: e.id, todoId: todo.id };
      expect(ok(await entryTodoService.link(u[who].ctx, link))).toMatchObject({
        id: entryTodoId(e.id, todo.id),
      });
      expect(
        ok(await entryTodoService.link(u.caretaker.ctx, { ...link, id: entryTodoId(e.id, todo.id) })),
      ).toMatchObject({ id: entryTodoId(e.id, todo.id), createdBy: u[who].user.id });
      expect((await linksOf(todo.id)).filter((l) => l.entryId === e.id)).toHaveLength(1);
      ok(await entryTodoService.unlinkPair(u.caretaker.ctx, e.id, todo.id));
      // Unlinking what's gone is a replay.
      expect(ok(await entryTodoService.unlinkPair(u.caretaker.ctx, e.id, todo.id))).toEqual({ ids: [] });
    }
    expect(await linksOf(todo.id)).toEqual([]);
  });

  it("refuses a viewer, both easy roles and a non-member; another group reads nothing", async () => {
    const { u, group, entry, addTodo, linksOf } = await setup();
    const [note, todo] = [await entry("note"), await addTodo()];
    const link = { groupId: group.id, entryId: note.id, todoId: todo.id };
    for (const who of ["viewer", "easy_helper", "easy_viewer", "outsider"] as const)
      expect(codeOf(await entryTodoService.link(u[who].ctx, link)), who).toBe("permissions:unauthorized");
    expect(await linksOf(todo.id)).toEqual([]);

    ok(await entryTodoService.link(u.caretaker.ctx, link));
    for (const who of ["viewer", "easy_helper", "easy_viewer"] as const) {
      expect(ok(await entryTodoService.listForEntry(u[who].ctx, note.id)).data, who).toHaveLength(1);
      expect(codeOf(await entryTodoService.unlinkPair(u[who].ctx, note.id, todo.id)), who).toBe(
        "permissions:unauthorized",
      );
    }
    expect(ok(await entryTodoService.listForTodo(u.outsider.ctx, todo.id)).data).toEqual([]);
    expect(codeOf(await entryTodoService.unlinkPair(u.outsider.ctx, note.id, todo.id))).toBe(
      "permissions:unauthorized",
    );
    expect(await linksOf(todo.id)).toHaveLength(1);
  });

  it("refuses a deleted entry or todo, an id that isn't the pair's, and ends in two groups", async () => {
    const { u, group, entry, addTodo } = await setup();
    const other = await createWorld({ members: [] });
    const elsewhere = ok(
      await todoService.create(other.u.owner.ctx, { groupId: other.group.id, title: "Water the plants" }),
    )!;
    const [note, todo] = [await entry("note"), await addTodo()];
    const link = { groupId: group.id, entryId: note.id, todoId: todo.id };
    expect(codeOf(await entryTodoService.link(u.caretaker.ctx, { ...link, id: randomUUID() }))).toBe(
      "entryTodoService:invalid",
    );
    expect(codeOf(await entryTodoService.link(u.caretaker.ctx, { ...link, todoId: elsewhere.id }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await entryTodoService.link(other.u.owner.ctx, { ...link, groupId: other.group.id }))).toBe(
      "permissions:unauthorized",
    );

    const gone = await addTodo({ title: "Gone" });
    ok(await todoService.remove(u.caretaker.ctx, gone.id));
    expect(codeOf(await entryTodoService.link(u.caretaker.ctx, { ...link, todoId: gone.id }))).toBe(
      "entryTodoService:todoNotFound",
    );
    ok(await timelineEntryService.remove(u.caretaker.ctx, note.id));
    expect(codeOf(await entryTodoService.link(u.caretaker.ctx, link))).toBe("entryTodoService:entryNotFound");
  });

  it("goes with a hard delete of either end (the keys cascade)", async () => {
    const { u, group, entry, addTodo, linksOf } = await setup();
    const [note, event, todo] = [await entry("note"), await entry("event"), await addTodo()];
    ok(
      await entryTodoService.link(u.caretaker.ctx, { groupId: group.id, entryId: note.id, todoId: todo.id }),
    );
    ok(
      await entryTodoService.link(u.caretaker.ctx, { groupId: group.id, entryId: event.id, todoId: todo.id }),
    );
    await getDb().delete(timelineEntrySchema).where(eq(timelineEntrySchema.id, note.id));
    expect((await linksOf(todo.id)).map((l) => l.entryId)).toEqual([event.id]);
    await getDb().delete(todoSchema).where(eq(todoSchema.id, todo.id));
    expect(await linksOf(todo.id)).toEqual([]);
  });
});

describe("the mirror of an old client's eventId", () => {
  it("links on create, swaps the pair on a change, removes it when cleared, and relinks nothing when unchanged", async () => {
    const { u, entry, addTodo, linksOf } = await setup();
    const [first, second] = [await entry("event"), await entry("event", "Dentist")];
    const todo = await addTodo({ eventId: first.id });
    expect(await linksOf(todo.id)).toEqual([{ id: entryTodoId(first.id, todo.id), entryId: first.id }]);

    ok(await todoService.update(u.caretaker.ctx, todo.id, { eventId: second.id }));
    expect(await linksOf(todo.id)).toEqual([{ id: entryTodoId(second.id, todo.id), entryId: second.id }]);

    // An unchanged eventId (the edit form's save on an old build) leaves the links alone.
    ok(await entryTodoService.unlinkPair(u.caretaker.ctx, second.id, todo.id));
    ok(
      await entryTodoService.link(u.caretaker.ctx, {
        groupId: todo.groupId,
        entryId: second.id,
        todoId: todo.id,
      }),
    );
    const note = await entry("note");
    ok(
      await entryTodoService.link(u.caretaker.ctx, {
        groupId: todo.groupId,
        entryId: note.id,
        todoId: todo.id,
      }),
    );
    ok(await todoService.update(u.caretaker.ctx, todo.id, { title: "Book the follow-up", eventId: null }));
    expect(await linksOf(todo.id)).toHaveLength(2);
    ok(await todoService.update(u.caretaker.ctx, todo.id, { eventId: second.id }));
    ok(await todoService.update(u.caretaker.ctx, todo.id, { title: "Book it", eventId: second.id }));
    expect((await linksOf(todo.id)).map((l) => l.entryId).sort()).toEqual([note.id, second.id].sort());

    ok(await todoService.update(u.caretaker.ctx, todo.id, { eventId: null }));
    expect((await linksOf(todo.id)).map((l) => l.entryId)).toEqual([note.id]);
  });

  it("keeps a soft-deleted event's rows (releaseEvent clears only the column)", async () => {
    const { u, entry, addTodo, linksOf, columnOf } = await setup();
    const event = await entry("event");
    const todo = await addTodo({ eventId: event.id });
    ok(await timelineEntryService.remove(u.caretaker.ctx, event.id));
    expect(await columnOf(todo.id)).toBeNull();
    expect(await linksOf(todo.id)).toEqual([{ id: entryTodoId(event.id, todo.id), entryId: event.id }]);
  });

  it("unlinking clears the column when it names that entry, and only then", async () => {
    const { u, entry, addTodo, columnOf } = await setup();
    const [event, note] = [await entry("event"), await entry("note")];
    const todo = await addTodo({ eventId: event.id });
    ok(
      await entryTodoService.link(u.caretaker.ctx, {
        groupId: todo.groupId,
        entryId: note.id,
        todoId: todo.id,
      }),
    );
    ok(await entryTodoService.unlinkPair(u.caretaker.ctx, note.id, todo.id));
    expect(await columnOf(todo.id)).toBe(event.id);
    ok(await entryTodoService.unlinkPair(u.caretaker.ctx, event.id, todo.id));
    expect(await columnOf(todo.id)).toBeNull();
  });
});

describe("reopening a repeating todo", () => {
  it("keeps a next occurrence that an entry links, and the reopened todo stops repeating", async () => {
    const { u, group, entry, addTodo } = await setup();
    const todo = await addTodo({
      title: "Put the bins out",
      dueOn: "2026-11-16",
      repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
    });
    ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: "2026-11-16T20:00:00.000Z" }));
    const nextId = nextTodoId(todo.id, "2026-11-23");
    const note = await entry("note");
    ok(await entryTodoService.link(u.caretaker.ctx, { groupId: group.id, entryId: note.id, todoId: nextId }));

    expect(ok(await todoService.reopen(u.caretaker.ctx, todo.id))).toMatchObject({
      doneAt: null,
      repeatRule: null,
    });
    expect(ok(await todoService.getById(u.owner.ctx, nextId))).toMatchObject({
      doneAt: null,
      deletedAt: null,
    });
    expect(
      ok(await timelineEntryTodoModel.getById(entryTodoId(note.id, nextId), { authUser: SYSTEM_USER })),
    ).toBeTruthy();
  });
});
