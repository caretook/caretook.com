import type { TodoRow } from "./todos.sync";

import { nextTodoId } from "@caretook/data/series";
import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import {
  at,
  entryTodo,
  fx,
  hoursAgo,
  todo,
  TEST_GROUP,
  TEST_TIME_ZONE,
  TEST_USER,
} from "../../../test/fixtures";
import { readRows } from "../timeline/timeline.sync";
import {
  completeTodo,
  createTodo,
  doneCountQuery,
  reopenTodo,
  skipTodo,
  todoQuery,
  todosQuery,
  todoTreesQuery,
  toTodo,
  updateTodo,
} from "./todos.sync";
import { addDays, localDate, TICK_NEXT_METADATA, UNDO_NEXT_METADATA } from "@caretook/data/domain";

// Repeating todos on the device (planner-2): a tick writes the todo done and
// its next occurrence (the server's twin: the same id, `nextTodoId`) in one
// local transaction; Undo takes an untouched next away again, or keeps an
// edited one and stops the reopened todo repeating; skip deletes this one
// and writes the next; edits move the anchor as todoService does. What the
// server makes of these uploads is syncTodos.int.test.ts's. The sheets'
// note and event links (todo-links): `entryIds` on create; on update only
// the edit sheet's own `addEntryIds` and `removeEntryIds` (B-990).

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
    // The next is flagged as the tick's, so a stale tick's never revives a
    // stopped chain on the server (B-387); the tick itself isn't.
    expect(ops.map((o) => o.metadata)).toEqual([null, TICK_NEXT_METADATA]);
    expect(ops[1]?.data).toMatchObject({
      group_id: TEST_GROUP.id,
      title: "Put the bins out",
      due_on: tomorrow,
      repeat_rule: DAILY,
      repeat_id: BINS_ID,
      created_by: TEST_USER.id,
    });

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

describe("Undo with a linked next (planner-3)", () => {
  test("keeps a next an entry links, and the reopened todo stops repeating", async () => {
    const { db } = await device();
    ok(await completeTodo(db, BINS_ID));
    await db.powersync.execute(
      "INSERT INTO timeline_entry_todo (id, group_id, entry_id, todo_id) VALUES (?, ?, ?, ?)",
      [entryTodo(VISIT.id, NEXT_ID).id, TEST_GROUP.id, VISIT.id, NEXT_ID],
    );
    ok(await reopenTodo(db, BINS_ID));
    expect((await read(db, BINS_ID))?.repeatRule).toBeNull();
    expect((await read(db, NEXT_ID))?.deletedAt).toBeNull();
  });
});

describe("Undo: the successor by when it was made (B-383)", () => {
  const yesterday = addDays(today, -1);
  const dayAfter = addDays(tomorrow, 1);

  test("a next moved by a member to the reopened todo's day, or earlier, is found: it stays, and the reopened one stops repeating", async () => {
    for (const day of [today, yesterday]) {
      const { db, screen } = await device();
      ok(await completeTodo(db, BINS_ID));
      ok(await updateTodo(db, NEXT_ID, { dueOn: day }));
      ok(await reopenTodo(db, BINS_ID));
      expect(await read(db, BINS_ID)).toMatchObject({ doneAt: null, repeatRule: null, repeatId: null });
      expect(await read(db, NEXT_ID)).toMatchObject({ deletedAt: null, dueOn: day, repeatRule: DAILY });
      await screen.unmount();
    }
  });

  test("an untouched next due on the reopened todo's day, or earlier, is taken away", async () => {
    // The reopened todo's own day moved later after its tick, its anchor kept.
    for (const due of [tomorrow, dayAfter]) {
      const doneAt = hoursAgo(2);
      const ticked = bins({ dueOn: due, doneAt, doneBy: TEST_USER.id });
      const next = bins({ id: NEXT_ID, dueOn: tomorrow, eventId: null, createdAt: doneAt });
      const { db, screen } = await device([ticked, next]);
      ok(await reopenTodo(db, BINS_ID));
      expect(await read(db, BINS_ID)).toMatchObject({ doneAt: null, repeatRule: DAILY, repeatId: BINS_ID });
      expect((await read(db, NEXT_ID))?.deletedAt).not.toBeNull();
      await screen.unmount();
    }
  });

  test("an older tick (A, B done, C open) finds B, not C: both stay, A stops repeating", async () => {
    const aDone = hoursAgo(5);
    const bDone = hoursAgo(3);
    const a = bins({ dueOn: yesterday, doneAt: aDone, doneBy: TEST_USER.id });
    // B (today's) moved past C's day after its tick: by due day, C would look like A's untouched next.
    const B_ID = nextTodoId(BINS_ID, today);
    const b = bins({
      id: B_ID,
      dueOn: dayAfter,
      eventId: null,
      createdAt: aDone,
      doneAt: bDone,
      doneBy: SAM_ID,
    });
    const c = bins({ id: NEXT_ID, dueOn: tomorrow, eventId: null, createdAt: bDone });
    const { db } = await device([a, b, c]);
    ok(await reopenTodo(db, BINS_ID));
    expect(await read(db, BINS_ID)).toMatchObject({ doneAt: null, repeatRule: null });
    expect(await read(db, B_ID)).toMatchObject({ deletedAt: null, doneBy: SAM_ID });
    expect(await read(db, NEXT_ID)).toMatchObject({ deletedAt: null, doneAt: null });
  });

  test("after A, B and C ticked offline and synced, reopening C finds D, not B, and takes the untouched D away", async () => {
    // The server made B, C and D at upload time, after the device's tick times.
    const twoDaysAgo = addDays(today, -2);
    const [aDone, bDone, cDone] = [hoursAgo(6), hoursAgo(5), hoursAgo(4)];
    const B_ID = nextTodoId(BINS_ID, yesterday);
    const C_ID = nextTodoId(BINS_ID, today);
    const a = bins({ dueOn: twoDaysAgo, doneAt: aDone, doneBy: TEST_USER.id });
    const made = { eventId: null, doneBy: TEST_USER.id };
    const b = bins({ id: B_ID, dueOn: yesterday, ...made, createdAt: hoursAgo(2), doneAt: bDone });
    const c = bins({ id: C_ID, dueOn: today, ...made, createdAt: hoursAgo(1.5), doneAt: cDone });
    const d = bins({ id: NEXT_ID, dueOn: tomorrow, eventId: null, createdAt: hoursAgo(1) });
    const { db } = await device([a, b, c, d]);
    ok(await reopenTodo(db, C_ID));
    expect(await read(db, C_ID)).toMatchObject({ doneAt: null, repeatRule: DAILY, repeatId: BINS_ID });
    expect((await read(db, NEXT_ID))?.deletedAt).not.toBeNull();
    expect(await read(db, B_ID)).toMatchObject({ deletedAt: null, doneBy: TEST_USER.id, repeatRule: DAILY });
  });

  test("a tick on a clock behind the server's still makes the next after the ticked row", async () => {
    // Synced with the server's `created_at`, a minute ahead of this device's clock.
    const ahead = at(new Date(Date.now() + 60_000));
    const { db } = await device([bins({ createdAt: ahead, updatedAt: ahead })]);
    ok(await completeTodo(db, BINS_ID));
    ok(await reopenTodo(db, BINS_ID));
    expect(await read(db, BINS_ID)).toMatchObject({ doneAt: null, repeatRule: DAILY });
    expect((await read(db, NEXT_ID))?.deletedAt).not.toBeNull();
  });

  test("a next brought back by a second tick is found again on the second reopen", async () => {
    const { db } = await device();
    ok(await completeTodo(db, BINS_ID));
    ok(await reopenTodo(db, BINS_ID));
    ok(await completeTodo(db, BINS_ID));
    expect((await read(db, NEXT_ID))?.deletedAt).toBeNull();
    ok(await reopenTodo(db, BINS_ID));
    expect(await read(db, BINS_ID)).toMatchObject({ doneAt: null, repeatRule: DAILY });
    expect((await read(db, NEXT_ID))?.deletedAt).not.toBeNull();
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
    // A skip's next is unflagged: the server makes it for a writer (B-387).
    expect(ops.map((o) => o.metadata)).toEqual([null, null]);
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

describe("entry links (todo-links)", () => {
  const PLAIN_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb501";
  const plain = todo({ id: PLAIN_ID, title: "Ask about the eye drops" });
  const NOTE = fx.note({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb502", text: "Drops sting" });
  const NEW_NOTE = fx.note({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb503", text: "Drops help now" });
  const GONE_NOTE = fx.note({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb504", deletedAt: hoursAgo(1) });
  const SYMPTOM = fx.symptom({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb505" });
  const linkedWorld = () => [
    plain,
    NOTE,
    NEW_NOTE,
    GONE_NOTE,
    SYMPTOM,
    entryTodo(NOTE.id, PLAIN_ID),
    entryTodo(VISIT.id, PLAIN_ID),
    entryTodo(GONE_NOTE.id, PLAIN_ID),
  ];
  const linksOf = async (db: Db, todoId: string) =>
    (
      await readRows<{ entry_id: string }>(db, {
        sql: "SELECT entry_id FROM timeline_entry_todo WHERE todo_id = ? ORDER BY entry_id",
        params: [todoId],
      })
    ).map((r) => r.entry_id);

  test("updateTodo links the added ones and unlinks the removed ones, with the edit, leaving the rest (B-990)", async () => {
    const { db } = await device(linkedWorld());
    ok(
      await updateTodo(db, PLAIN_ID, {
        title: "Ask about the drops",
        addEntryIds: [NEW_NOTE.id, VISIT.id, SYMPTOM.id, "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb5ff"],
        removeEntryIds: [NOTE.id],
      }),
    );
    // A symptom, an unknown id and one linked already add nothing; the event and the deleted note's link stay.
    expect(await linksOf(db, PLAIN_ID)).toEqual([VISIT.id, NEW_NOTE.id, GONE_NOTE.id].sort());
    const ops = await queued(db);
    expect(ops.map((o) => o.op)).toEqual(["PATCH", "PUT", "DELETE"]);
    expect(oneTransaction(ops)).toBe(true);

    ok(
      await updateTodo(db, PLAIN_ID, {
        title: "Ask about the drops",
        removeEntryIds: [VISIT.id, NEW_NOTE.id],
      }),
    );
    expect(await linksOf(db, PLAIN_ID)).toEqual([GONE_NOTE.id]);
  });

  test("a link another member made after the sheet opened survives a title-only save, and one they removed isn't remade (B-990)", async () => {
    const shown = await device(linkedWorld());
    const { db } = shown;
    // While the sheet is open: someone links the new note and unlinks the event.
    await shown.sync([entryTodo(NEW_NOTE.id, PLAIN_ID)]);
    await shown.unsync([entryTodo(VISIT.id, PLAIN_ID)]);
    await shown.settle();
    // The sheet saves its title only (it changed no links), and an old caller's full list is ignored.
    ok(await updateTodo(db, PLAIN_ID, { title: "Ask about the drops", entryIds: [NOTE.id, VISIT.id] }));
    expect(await linksOf(db, PLAIN_ID)).toEqual([NOTE.id, NEW_NOTE.id, GONE_NOTE.id].sort());
    expect((await queued(db)).map((o) => o.op)).toEqual(["PATCH"]);
  });

  test("without added or removed ones (a title or provider change) the note and event links stay", async () => {
    const { db } = await device(linkedWorld());
    ok(await updateTodo(db, PLAIN_ID, { title: "Ask about the drops" }));
    ok(await updateTodo(db, PLAIN_ID, { providerId: LARK.id }));
    expect(await linksOf(db, PLAIN_ID)).toEqual([NOTE.id, VISIT.id, GONE_NOTE.id].sort());
    expect((await queued(db)).map((o) => o.op)).toEqual(["PATCH", "PATCH"]);
  });

  test("createTodo links each live note or event in entryIds, once, in its transaction", async () => {
    const { db } = await device(linkedWorld());
    const made = await createTodo(db, TEST_GROUP.id, {
      title: "Bring the drops",
      entryIds: [NOTE.id, VISIT.id, NOTE.id, GONE_NOTE.id, SYMPTOM.id],
    });
    if (!made.ok) throw new Error(made.error);
    expect(await linksOf(db, made.id)).toEqual([NOTE.id, VISIT.id].sort());
    const ops = await queued(db);
    expect(ops.map((o) => o.op)).toEqual(["PUT", "PUT", "PUT"]);
    expect(oneTransaction(ops)).toBe(true);
  });
});

describe("the trees' query and the Done list (todo-subtasks-3)", () => {
  const tid = (n: number) => `7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fc${String(n).padStart(3, "0")}`;
  const doneNow = { doneAt: at(new Date(Date.now() - 60_000)), doneBy: TEST_USER.id };
  const TREE = [
    // An open tree: a done child, and three levels with the middle and leaf done.
    todo({ id: tid(1), title: "Get ready for the hospital stay" }),
    todo({ id: tid(2), title: "Print the medication list", parentId: tid(1), ...doneNow }),
    todo({ id: tid(3), title: "Pack the bag", parentId: tid(1), ...doneNow }),
    todo({ id: tid(4), title: "Pack the slippers", parentId: tid(3), ...doneNow }),
    todo({ id: tid(5), title: "Arrange the dog sitter", parentId: tid(1), dueOn: tomorrow }),
    todo({ id: tid(6), title: "Old step", parentId: tid(1), ...doneNow, deletedAt: hoursAgo(1) }),
    // A done tree: its done children list in Done, flat.
    todo({ id: tid(7), title: "Plan the birthday", ...doneNow }),
    todo({ id: tid(8), title: "Order the cake", parentId: tid(7), ...doneNow }),
    todo({ id: tid(9), title: "Book the eye exam", ...doneNow }),
  ];
  const ids = (rows: TodoRow[]) => rows.map((r) => r.id).sort();

  test("the trees' query holds the open todos and the done subtasks of an open tree, at any depth; Done and its count leave those out and keep one whose top-level todo is done", async () => {
    const { db } = await device([TREE]);
    expect(ids(await readRows<TodoRow>(db, todoTreesQuery(TEST_GROUP.id)))).toEqual(
      [tid(1), tid(2), tid(3), tid(4), tid(5)].sort(),
    );

    const done = await readRows<TodoRow>(db, todosQuery(TEST_GROUP.id, { done: true, doneListed: true }));
    expect(ids(done)).toEqual([tid(7), tid(8), tid(9)].sort());
    const [count] = await readRows<{ count: number }>(
      db,
      doneCountQuery(TEST_GROUP.id, { doneListed: true }),
    );
    expect(Number(count?.count)).toBe(3);

    // The rule ANDs with the chip's: Mine of nothing assigned is empty.
    const mine = todosQuery(TEST_GROUP.id, {
      done: true,
      doneListed: true,
      who: "mine",
      userId: TEST_USER.id,
    });
    expect(await readRows<TodoRow>(db, mine)).toEqual([]);
  });

  test("the trees' query goes in siblingOrder: dated first, then by when made", async () => {
    const { db } = await device([TREE]);
    const rows = await readRows<TodoRow>(db, todoTreesQuery(TEST_GROUP.id));
    expect(rows[0]?.id).toBe(tid(5));
  });
});

function ok(result: { ok: boolean }) {
  expect(result.ok).toBe(true);
}
