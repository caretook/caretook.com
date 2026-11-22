import type { TodoRow } from "./todos.sync";

import { addDays, localDate, UNDO_NEXT_METADATA } from "@caretook/data/schema";
import { nextTodoId } from "@caretook/data/series";
import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { fx, hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../test/fixtures";
import { readRows } from "../timeline/timeline.sync";
import { completeTodo, createTodo, reopenTodo, skipTodo, todoQuery, toTodo, updateTodo } from "./todos.sync";

// Repeating todos on the device (planner-2): a tick writes the todo done and
// its next occurrence (the server's twin: the same id, `nextTodoId`) in one
// local transaction; Undo takes an untouched next away again, or keeps an
// edited one and stops the reopened todo repeating; skip deletes this one
// and writes the next; edits move the anchor as todoService does. What the
// server makes of these uploads is syncTodos.int.test.ts's.

const DAILY = "FREQ=DAILY;INTERVAL=1";
const today = localDate(new Date(), TEST_TIME_ZONE);
const tomorrow = addDays(today, 1);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb002";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const LARK = fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb101", name: "Dr. Mira Lark" });
const METFORMIN = fx.medication({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb301", name: "Metformin" });
const VISIT = fx.event({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb201", title: "Eye exam" });

const BINS_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb401";
/** Daily from long ago, due today: its next is tomorrow. */
const bins = (v: Parameters<typeof todo>[0] = {}) =>
  todo({
    id: BINS_ID,
    title: "Put the bins out",
    dueOn: today,
    dueTime: "19:00",
    assigneeId: SAM_ID,
    providerId: LARK.id,
    medicationId: METFORMIN.id,
    eventId: VISIT.id,
    repeatRule: DAILY,
    repeatStartsOn: "2026-01-05",
    repeatId: BINS_ID,
    ...v,
  });
const NEXT_ID = nextTodoId(BINS_ID, tomorrow);

const device = (
  fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"] = [bins()],
  role: "caretaker" | "viewer" = "caretaker",
) =>
  renderWithDevice({
    element: <p>Device</p>,
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    fixtures: [SAM, LARK, METFORMIN, VISIT, fixtures],
    role,
  });

type Db = Awaited<ReturnType<typeof device>>["db"];
const read = async (db: Db, id: string) => {
  const [row] = await readRows<TodoRow>(db, todoQuery(id));
  return row ? toTodo(row) : null;
};
/** The queued uploads, each with its local transaction. */
const queued = (db: Db) =>
  db.powersync
    .getAll<{ tx_id: number; data: string }>("SELECT tx_id, data FROM ps_crud ORDER BY id")
    .then((rows) =>
      rows.map((r) => {
        const op = JSON.parse(r.data) as {
          op: string;
          id: string;
          data?: Record<string, unknown>;
          metadata?: string;
        };
        return { tx: r.tx_id, op: op.op, id: op.id, data: op.data ?? {}, metadata: op.metadata ?? null };
      }),
    );
const oneTransaction = (ops: { tx: number }[]) => new Set(ops.map((o) => o.tx)).size === 1;

describe("tick", () => {
  test("writes it done and the next one in one transaction, carrying the title, assignee, time, provider and medication links and the repeat; ticking again adds none", async () => {
    const { db } = await device();
    expect(await completeTodo(db, BINS_ID)).toEqual({ ok: true, id: BINS_ID });

    expect((await read(db, BINS_ID))?.doneBy).toBe(TEST_USER.id);
    expect(await read(db, NEXT_ID)).toMatchObject({
      title: "Put the bins out",
      assigneeId: SAM_ID,
      dueOn: tomorrow,
      dueTime: "19:00",
      providerId: LARK.id,
      medicationId: METFORMIN.id,
      eventId: null,
      doneAt: null,
      repeatRule: DAILY,
      repeatStartsOn: "2026-01-05",
      repeatId: BINS_ID,
    });
    const ops = await queued(db);
    expect(ops.map((o) => `${o.op} ${o.id}`)).toEqual([`PATCH ${BINS_ID}`, `PUT ${NEXT_ID}`]);
    // Only the done columns: the upload maps it to complete.
    expect(Object.keys(ops[0]?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);
    expect(oneTransaction(ops)).toBe(true);

    expect(await completeTodo(db, BINS_ID)).toEqual({ ok: true, id: BINS_ID });
    expect(await queued(db)).toHaveLength(2);
  });

  test("a viewer ticking their own repeating todo gets the next", async () => {
    const { db } = await device([bins({ assigneeId: TEST_USER.id })], "viewer");
    expect(await completeTodo(db, BINS_ID)).toEqual({ ok: true, id: BINS_ID });
    expect(await read(db, NEXT_ID)).toMatchObject({ assigneeId: TEST_USER.id, dueOn: tomorrow });
  });

  test("an ended rule, or a todo that doesn't repeat, makes none", async () => {
    const ended = bins({ repeatRule: `${DAILY};UNTIL=${today.replaceAll("-", "")}` });
    const { db } = await device([ended]);
    ok(await completeTodo(db, BINS_ID));
    expect(await read(db, NEXT_ID)).toBeNull();
    expect((await queued(db)).map((o) => o.op)).toEqual(["PATCH"]);
  });
});

describe("tick: an id already taken (B-386)", () => {
  const dayAfter = addDays(tomorrow, 1);
  const LATER_ID = nextTodoId(BINS_ID, dayAfter);

  test("a successor moved back onto its source's day passes over its own id, as the server does", async () => {
    // Made for tomorrow (so it has tomorrow's id), moved back to today.
    const { db } = await device([bins({ id: NEXT_ID })]);
    ok(await completeTodo(db, NEXT_ID));
    expect(await read(db, NEXT_ID)).toMatchObject({ dueOn: today, doneBy: TEST_USER.id });
    expect(await read(db, LATER_ID)).toMatchObject({ dueOn: dayAfter, doneAt: null, repeatId: BINS_ID });
    expect((await queued(db)).map((o) => `${o.op} ${o.id}`)).toEqual([`PATCH ${NEXT_ID}`, `PUT ${LATER_ID}`]);
  });

  test("a done occurrence holding the next day's id is passed over for the following day", async () => {
    // Tomorrow's occurrence, moved to yesterday and ticked: done, with tomorrow's id.
    const moved = bins({
      id: NEXT_ID,
      dueOn: addDays(today, -1),
      doneAt: hoursAgo(20),
      doneBy: TEST_USER.id,
    });
    const { db } = await device([bins(), moved]);
    ok(await completeTodo(db, BINS_ID));
    expect(await read(db, LATER_ID)).toMatchObject({ dueOn: dayAfter, doneAt: null, deletedAt: null });
    expect(await read(db, NEXT_ID)).toMatchObject({ dueOn: addDays(today, -1), doneBy: TEST_USER.id });
    expect((await queued(db)).map((o) => `${o.op} ${o.id}`)).toEqual([`PATCH ${BINS_ID}`, `PUT ${LATER_ID}`]);
  });
});

describe("Undo", () => {
  test("takes an untouched next away in the same transaction as the reopen; ticking again brings it back", async () => {
    const { db } = await device();
    ok(await completeTodo(db, BINS_ID));
    const before = (await queued(db)).length;
    expect(await reopenTodo(db, BINS_ID)).toEqual({ ok: true, id: BINS_ID });

    expect(await read(db, BINS_ID)).toMatchObject({ doneAt: null, repeatRule: DAILY, repeatId: BINS_ID });
    expect((await read(db, NEXT_ID))?.deletedAt).not.toBeNull();
    const undo = (await queued(db)).slice(before);
    expect(undo.map((o) => `${o.op} ${o.id}`)).toEqual([`PATCH ${BINS_ID}`, `PATCH ${NEXT_ID}`]);
    expect(oneTransaction(undo)).toBe(true);
    // The next's delete is flagged as the Undo's, so the server keeps one
    // another member touched meanwhile (B-382); the reopen isn't.
    expect(undo.map((o) => o.metadata)).toEqual([null, UNDO_NEXT_METADATA]);
    expect(undo[1]?.data).toMatchObject({ deleted_at: expect.any(String) as unknown });

    ok(await completeTodo(db, BINS_ID));
    expect(await read(db, NEXT_ID)).toMatchObject({ deletedAt: null, doneAt: null, dueOn: tomorrow });
    // Brought back by a PATCH of `deleted_at` (the server restores it on the tick).
    expect((await queued(db)).at(-1)).toMatchObject({
      op: "PATCH",
      id: NEXT_ID,
      data: { deleted_at: null },
      metadata: null,
    });
  });

  test("keeps an edited next, or one with notes, and the reopened todo stops repeating", async () => {
    const { db } = await device();
    ok(await completeTodo(db, BINS_ID));
    ok(await updateTodo(db, NEXT_ID, { title: "Bins and recycling" }));
    ok(await reopenTodo(db, BINS_ID));
    expect(await read(db, BINS_ID)).toMatchObject({
      doneAt: null,
      repeatRule: null,
      repeatStartsOn: null,
      repeatId: null,
    });
    expect(await read(db, NEXT_ID)).toMatchObject({ deletedAt: null, repeatRule: DAILY });
  });

  test("keeps a next with notes", async () => {
    const { db } = await device();
    ok(await completeTodo(db, BINS_ID));
    await db.powersync.execute(
      "INSERT INTO note_document (id, group_id, subject, todo_id, text) VALUES (?, ?, 'todo', ?, 'Blue bin')",
      [NEXT_ID, TEST_GROUP.id, NEXT_ID],
    );
    ok(await reopenTodo(db, BINS_ID));
    expect((await read(db, BINS_ID))?.repeatRule).toBeNull();
    expect((await read(db, NEXT_ID))?.deletedAt).toBeNull();
  });
});

describe("skip", () => {
  test("deletes this one and writes the next in one transaction; viewers can't", async () => {
    const viewer = await device([bins({ assigneeId: TEST_USER.id })], "viewer");
    expect((await skipTodo(viewer.db, BINS_ID)).ok).toBe(false);
    expect((await read(viewer.db, BINS_ID))?.deletedAt).toBeNull();
    await viewer.screen.unmount();

    const { db } = await device();
    expect(await skipTodo(db, BINS_ID)).toEqual({ ok: true, id: BINS_ID });
    expect((await read(db, BINS_ID))?.deletedAt).not.toBeNull();
    expect(await read(db, NEXT_ID)).toMatchObject({ deletedAt: null, doneAt: null, dueOn: tomorrow });
    const ops = await queued(db);
    expect(ops.map((o) => `${o.op} ${o.id}`)).toEqual([`PATCH ${BINS_ID}`, `PUT ${NEXT_ID}`]);
    expect(oneTransaction(ops)).toBe(true);
  });
});

describe("edit", () => {
  test("a new repeating todo starts its chain on itself; a repeat needs a due day", async () => {
    const { db } = await device([]);
    const made = await createTodo(db, TEST_GROUP.id, {
      title: "Water the plants",
      dueOn: today,
      repeatRule: DAILY,
    });
    if (!made.ok) throw new Error(made.error);
    expect(await read(db, made.id)).toMatchObject({
      repeatRule: DAILY,
      repeatStartsOn: today,
      repeatId: made.id,
    });

    const undated = await createTodo(db, TEST_GROUP.id, { title: "Water the plants", repeatRule: DAILY });
    expect(undated).toMatchObject({ ok: false, issues: [{ path: "repeatRule" }] });
  });

  test("a new rule or due day moves the anchor and keeps the chain; clearing clears all three", async () => {
    const { db } = await device();
    ok(await updateTodo(db, BINS_ID, { title: "Bins out" }));
    expect(await read(db, BINS_ID)).toMatchObject({ repeatStartsOn: "2026-01-05", repeatId: BINS_ID });
    ok(await updateTodo(db, BINS_ID, { dueOn: tomorrow }));
    expect(await read(db, BINS_ID)).toMatchObject({ repeatStartsOn: tomorrow, repeatId: BINS_ID });
    ok(await updateTodo(db, BINS_ID, { repeatRule: null }));
    expect(await read(db, BINS_ID)).toMatchObject({ repeatRule: null, repeatStartsOn: null, repeatId: null });
  });
});

function ok(result: { ok: boolean }) {
  expect(result.ok).toBe(true);
}
