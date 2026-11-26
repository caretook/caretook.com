import type { SubtaskProgressRow, TodoRow } from "./todos.sync";

import { addDays, localDate, ROLLUP_METADATA } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../test/fixtures";
import { readRows } from "../timeline/timeline.sync";
import {
  completeTodo,
  createTodo,
  progressByParent,
  removeTodo,
  reopenTodo,
  subtasksQuery,
  subtaskProgressQuery,
  todoQuery,
  toTodo,
  toTodos,
  updateTodo,
} from "./todos.sync";

// Subtasks on the device (todo-subtasks): `createTodo` checks the tree rules
// against the local copy, so an upload the server would refuse is never
// queued; `removeTodo` takes the descendants in its transaction; one group
// query counts every parent's progress. What the server makes of the
// uploads is syncTodos.int.test.ts's.

const today = localDate(new Date(), TEST_TIME_ZONE);
const id = (n: number) => `5a0c7e21-9d3b-4c6f-8e12-7b4d3c2a${String(n).padStart(4, "0")}`;
const TOP = id(1);
const SUB = id(2);
const SUB_SUB = id(3);

/** "Get ready for the hospital stay", its step and the step's step: as deep as it goes. */
const tree = [
  todo({ id: TOP, title: "Get ready for the hospital stay" }),
  todo({ id: SUB, title: "Pack a bag", parentId: TOP, createdAt: hoursAgo(30) }),
  todo({ id: SUB_SUB, title: "Find the charger", parentId: SUB }),
];

const device = (fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"] = tree) =>
  renderWithDevice({
    element: <p>Device</p>,
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    fixtures,
    role: "caretaker",
  });

type Db = Awaited<ReturnType<typeof device>>["db"];
const read = async (db: Db, todoId: string) => {
  const [row] = await readRows<TodoRow>(db, todoQuery(todoId));
  return row ? toTodo(row) : null;
};
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

describe("createTodo with a parent", () => {
  test("writes the subtask with its parent, queued as one PUT carrying parent_id", async () => {
    const { db } = await device();
    const made = await createTodo(db, TEST_GROUP.id, { title: "Print the medication list", parentId: TOP });
    if (!made.ok) throw new Error(made.error);
    expect(await read(db, made.id)).toMatchObject({ parentId: TOP, title: "Print the medication list" });
    expect(await queued(db)).toMatchObject([{ op: "PUT", id: made.id, data: { parent_id: TOP } }]);
    expect(toTodos(await readRows<TodoRow>(db, subtasksQuery(TOP))).map((t) => t.id)).toEqual([SUB, made.id]);
  });

  test("refuses one past the depth limit, under a repeating, deleted or missing parent, and a repeating subtask, queuing nothing", async () => {
    const REPEATING = id(10);
    const GONE = id(11);
    const { db } = await device([
      ...tree,
      todo({ id: REPEATING, title: "Put the bins out", dueOn: today, repeatRule: "FREQ=WEEKLY;BYDAY=MO" }),
      todo({ id: GONE, title: "Call the dog sitter", deletedAt: hoursAgo(1) }),
    ]);
    for (const parentId of [SUB_SUB, REPEATING, GONE, id(99)]) {
      expect(await createTodo(db, TEST_GROUP.id, { title: "One more step", parentId })).toMatchObject({
        ok: false,
        issues: [{ path: "parentId" }],
      });
    }
    expect(
      await createTodo(db, TEST_GROUP.id, {
        title: "Water the plants",
        parentId: TOP,
        dueOn: today,
        repeatRule: "FREQ=DAILY;INTERVAL=1",
      }),
    ).toMatchObject({ ok: false, issues: [{ path: "repeatRule" }] });
    expect(await queued(db)).toEqual([]);
  });

  test("a new repeat on a subtask or on a todo with subtasks is refused; on a plain todo it's fine", async () => {
    const PLAIN = id(20);
    const { db } = await device([...tree, todo({ id: PLAIN, title: "Water the plants" })]);
    const weekly = { dueOn: addDays(today, 1), repeatRule: "FREQ=WEEKLY;BYDAY=MO" };
    for (const todoId of [TOP, SUB]) {
      expect(await updateTodo(db, todoId, weekly)).toMatchObject({
        ok: false,
        issues: [{ path: "repeatRule" }],
      });
    }
    expect(await updateTodo(db, PLAIN, weekly)).toEqual({ ok: true, id: PLAIN });
  });
});

describe("removeTodo", () => {
  test("soft-deletes the todo and its live descendants in one transaction, the todo first; others stay", async () => {
    const SIBLING = id(30);
    const DONE_STEP = id(31);
    const OTHER = id(32);
    const { db } = await device([
      ...tree,
      todo({ id: SIBLING, title: "Print the medication list", parentId: TOP }),
      todo({
        id: DONE_STEP,
        title: "Fold the pajamas",
        parentId: SUB,
        doneAt: hoursAgo(2),
        doneBy: TEST_USER.id,
      }),
      todo({ id: OTHER, title: "Call the pharmacy" }),
    ]);
    expect(await removeTodo(db, SUB)).toEqual({ ok: true });

    for (const gone of [SUB, SUB_SUB, DONE_STEP]) expect((await read(db, gone))?.deletedAt).not.toBeNull();
    for (const kept of [TOP, SIBLING, OTHER]) expect((await read(db, kept))?.deletedAt).toBeNull();
    const ops = await queued(db);
    expect(ops[0]).toMatchObject({ op: "PATCH", id: SUB });
    expect(ops.map((o) => o.id).sort()).toEqual([SUB, SUB_SUB, DONE_STEP].sort());
    expect(ops.every((o) => o.op === "PATCH" && typeof o.data.deleted_at === "string")).toBe(true);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
  });
});

describe("subtaskProgressQuery", () => {
  test("counts each parent's live subtasks and the done ones, in one query", async () => {
    const OTHER_PARENT = id(40);
    const { db } = await device([
      ...tree,
      todo({
        id: id(41),
        title: "Print the medication list",
        parentId: TOP,
        doneAt: hoursAgo(3),
        doneBy: TEST_USER.id,
      }),
      todo({ id: id(42), title: "Gone step", parentId: TOP, deletedAt: hoursAgo(1) }),
      todo({ id: OTHER_PARENT, title: "Plan the birthday" }),
      todo({ id: id(43), title: "Order the cake", parentId: OTHER_PARENT }),
    ]);
    const progress = progressByParent(
      await readRows<SubtaskProgressRow>(db, subtaskProgressQuery(TEST_GROUP.id)),
    );
    expect(Object.fromEntries(progress)).toEqual({
      [TOP]: { done: 1, total: 2 },
      [SUB]: { done: 0, total: 1 },
      [OTHER_PARENT]: { done: 0, total: 1 },
    });
  });
});

describe("the rollup on the device", () => {
  const ok = <T extends { ok: boolean }>(res: T) => {
    if (!res.ok) throw new Error(JSON.stringify(res));
    return res;
  };
  const doneOf = async (db: Db, todoId: string) => {
    const t = await read(db, todoId);
    return { doneAt: t?.doneAt ?? null, doneBy: t?.doneBy ?? null };
  };

  test("ticking the last open subtask marks the chain done in one local transaction, each parent flagged; reopening it reopens them", async () => {
    const { db } = await device();
    ok(await completeTodo(db, SUB_SUB));
    const done = await doneOf(db, SUB_SUB);
    expect(done.doneAt).not.toBeNull();
    for (const parent of [SUB, TOP]) expect(await doneOf(db, parent)).toEqual(done);
    const ticked = await queued(db);
    expect(ticked.map((o) => `${o.op} ${o.id} ${o.metadata}`)).toEqual([
      `PATCH ${SUB_SUB} null`,
      `PATCH ${SUB} ${ROLLUP_METADATA}`,
      `PATCH ${TOP} ${ROLLUP_METADATA}`,
    ]);
    expect(new Set(ticked.map((o) => o.tx)).size).toBe(1);
    expect(ticked[2]?.data).toMatchObject({ done_by: TEST_USER.id });

    ok(await reopenTodo(db, SUB_SUB));
    for (const todoId of [SUB_SUB, SUB, TOP])
      expect(await doneOf(db, todoId)).toEqual({ doneAt: null, doneBy: null });
    const reopened = (await queued(db)).slice(ticked.length);
    expect(reopened.map((o) => `${o.id} ${o.metadata}`)).toEqual([
      `${SUB_SUB} null`,
      `${SUB} ${ROLLUP_METADATA}`,
      `${TOP} ${ROLLUP_METADATA}`,
    ]);
    expect(new Set(reopened.map((o) => o.tx)).size).toBe(1);
  });

  test("a step with an open sibling leaves the parent open; a parent reopened by hand leaves its subtasks done", async () => {
    const SIBLING = id(50);
    const { db } = await device([
      ...tree,
      todo({ id: SIBLING, title: "Print the medication list", parentId: TOP }),
    ]);
    ok(await completeTodo(db, SUB_SUB));
    expect((await doneOf(db, SUB)).doneAt).not.toBeNull();
    expect((await doneOf(db, TOP)).doneAt).toBeNull();
    expect((await queued(db)).map((o) => o.id)).toEqual([SUB_SUB, SUB]);

    ok(await reopenTodo(db, SUB));
    expect((await doneOf(db, SUB)).doneAt).toBeNull();
    expect((await doneOf(db, SUB_SUB)).doneAt).not.toBeNull();
  });

  test("a new subtask reopens a done parent; deleting the last open one finishes it", async () => {
    const at = hoursAgo(2);
    const { db } = await device([
      todo({ id: TOP, title: "Get ready for the hospital stay", doneAt: at, doneBy: TEST_USER.id }),
      todo({ id: SUB, title: "Pack a bag", parentId: TOP, doneAt: at, doneBy: TEST_USER.id }),
    ]);
    const made = ok(
      await createTodo(db, TEST_GROUP.id, { title: "Print the medication list", parentId: TOP }),
    );
    if (!made.ok) throw new Error("not made");
    expect(await doneOf(db, TOP)).toEqual({ doneAt: null, doneBy: null });
    const added = await queued(db);
    expect(added.map((o) => `${o.op} ${o.id} ${o.metadata}`)).toEqual([
      `PUT ${made.id} null`,
      `PATCH ${TOP} ${ROLLUP_METADATA}`,
    ]);
    expect(new Set(added.map((o) => o.tx)).size).toBe(1);

    expect(await removeTodo(db, made.id)).toEqual({ ok: true });
    expect((await doneOf(db, TOP)).doneAt).not.toBeNull();
    expect((await queued(db)).slice(added.length).map((o) => `${o.id} ${o.metadata}`)).toEqual([
      `${made.id} null`,
      `${TOP} ${ROLLUP_METADATA}`,
    ]);
  });
});
