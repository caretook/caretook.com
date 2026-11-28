import type { TodoCreateInput, Tx } from "../db";

import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createWorld, ok } from "../../test/fixtures";
import { SYSTEM_USER } from "../constants";
import { getDb, withTransaction } from "../db";
import { nextTodoId } from "../db/schema/appointments/series";
import { isError } from "../errors";
import { todoModel } from "../models";
import { todoService } from ".";

// A repeating todo's tick and reopen under races (sync-safety-2 slice 2):
// the todo row is locked before a tick, reopen, skip, Undo or restore reads
// it, so two ticks at once make one next occurrence (B-384); reopen finds
// the successor by when it was made, not by its due day (B-383). The
// recipient is in Los Angeles; fictional groups and todos throughout.

const WEEKLY_MO = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
// Mon 2026-11-16, 12:00 in Los Angeles.
const MONDAY_NOON = "2026-11-16T20:00:00.000Z";
// Tue 2026-11-24, 12:00 in Los Angeles: another recipient day, with another next.
const TUESDAY_NOON = "2026-11-24T20:00:00.000Z";

const setup = async () => {
  const { u, group } = await createWorld();
  const addTodo = async (overrides: Partial<TodoCreateInput> = {}) => {
    const todo = ok(
      await todoService.create(u.caretaker.ctx, {
        groupId: group.id,
        title: "Water the ferns",
        dueOn: "2026-11-16",
        dueTime: "09:00",
        repeatRule: WEEKLY_MO,
        ...overrides,
      }),
    );
    if (!todo) throw new Error("todo not readable");
    return todo;
  };
  /** Every row of a chain, deleted ones too. */
  const chain = async (repeatId: string) =>
    ok(
      await todoModel.list({
        authUser: SYSTEM_USER,
        includeDeleted: true,
        filter: { groupId: { type: "eq", value: group.id }, repeatId: { type: "eq", value: repeatId } },
      }),
    ).data;
  const openIn = async (repeatId: string) =>
    (await chain(repeatId)).filter((t) => !t.doneAt && !t.deletedAt).map((t) => t.id);
  const row = async (id: string) =>
    ok(await todoModel.getById(id, { authUser: SYSTEM_USER, includeDeleted: true }));
  return { u, addTodo, chain, openIn, row };
};

/** Sessions in this test database waiting on a lock (a row another transaction holds). */
const lockWaiters = async () => {
  const res = await getDb().execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
  );
  return res.rows[0]?.n ?? 0;
};

/**
 * The interleaving: `first` runs in a transaction held open; `second` starts
 * on another connection then, and once it waits on a lock, the first
 * commits and the second finishes after it.
 */
const racing = async <A, B>(first: (tx: Tx) => Promise<A>, second: () => Promise<B>) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let ran = () => {};
  const firstRan = new Promise<void>((resolve) => (ran = resolve));
  const committed = withTransaction(async (tx) => {
    const res = await first(tx);
    ran();
    if (!isError(res)) await held;
    return res;
  });
  try {
    await firstRan;
    const later = second();
    await vi.waitFor(async () => expect(await lockWaiters()).toBeGreaterThan(0), {
      timeout: 10_000,
      interval: 10,
    });
    release();
    return { first: await committed, second: await later };
  } finally {
    release();
  }
};

describe("two ticks at once (B-384)", () => {
  it("make exactly one next occurrence, and done_by is the first's", async () => {
    const { u, addTodo, chain, openIn, row } = await setup();
    const todo = await addTodo();

    const { first, second } = await racing(
      (tx) => todoService.complete({ ...u.owner.ctx, tx }, todo.id, { doneAt: MONDAY_NOON }),
      () => todoService.complete(u.caretaker.ctx, todo.id, { doneAt: TUESDAY_NOON }),
    );
    ok(first);
    // The second waited for the first, then found it done: a replay.
    expect(ok(second)).toMatchObject({ id: todo.id, doneBy: u.owner.user.id });

    expect(await row(todo.id)).toMatchObject({
      doneBy: u.owner.user.id,
      doneAt: expect.stringContaining("2026-11-16") as unknown,
    });
    expect(await openIn(todo.id)).toEqual([nextTodoId(todo.id, "2026-11-23")]);
    expect(await chain(todo.id)).toHaveLength(2);
  });

  it("a reopen racing a tick decides from the committed tick", async () => {
    const { u, addTodo, openIn } = await setup();
    const todo = await addTodo();

    const { second } = await racing(
      (tx) => todoService.complete({ ...u.owner.ctx, tx }, todo.id, { doneAt: MONDAY_NOON }),
      () => todoService.reopen(u.caretaker.ctx, todo.id),
    );
    // It saw the tick, so it took the untouched next away again.
    expect(ok(second)).toMatchObject({ doneAt: null, repeatRule: WEEKLY_MO });
    expect(await openIn(todo.id)).toEqual([todo.id]);
  });
});

describe("reopen finds the successor by when it was made (B-383)", () => {
  it("a successor moved by a member to the reopened todo's day, or earlier, is found: it stays, and the reopened one stops repeating", async () => {
    const { u, addTodo, openIn } = await setup();
    for (const day of ["2026-11-16", "2026-11-09"]) {
      const todo = await addTodo();
      ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: MONDAY_NOON }));
      const next = nextTodoId(todo.id, "2026-11-23");
      ok(await todoService.update(u.caretaker.ctx, next, { dueOn: day }));

      expect(ok(await todoService.reopen(u.caretaker.ctx, todo.id))).toMatchObject({
        doneAt: null,
        repeatRule: null,
        repeatId: null,
      });
      // One repeating row left, not two.
      expect(await openIn(todo.id)).toEqual([next]);
    }
  });

  it("an untouched successor due on the reopened todo's day, or earlier, is taken away", async () => {
    const { u, addTodo, openIn, row } = await setup();
    // The reopened todo's own day moved later after its tick (as the system,
    // its anchor kept): its untouched successor is then due on its day, or before it.
    for (const day of ["2026-11-23", "2026-11-30"]) {
      const todo = await addTodo();
      ok(await todoService.complete(u.caretaker.ctx, todo.id, { doneAt: MONDAY_NOON }));
      const next = nextTodoId(todo.id, "2026-11-23");
      ok(
        await todoModel.update({
          authUser: SYSTEM_USER,
          filter: { id: { type: "eq", value: todo.id } },
          data: { dueOn: day },
        }),
      );

      expect(ok(await todoService.reopen(u.caretaker.ctx, todo.id))).toMatchObject({
        doneAt: null,
        repeatRule: WEEKLY_MO,
        repeatId: todo.id,
      });
      expect((await row(next))?.deletedAt).not.toBeNull();
      expect(await openIn(todo.id)).toEqual([todo.id]);
    }
  });

  it("an older tick (A, B done, C open) finds B, not C: both stay, A stops repeating", async () => {
    const { u, addTodo, openIn, row } = await setup();
    const a = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, a.id, { doneAt: MONDAY_NOON }));
    const b = nextTodoId(a.id, "2026-11-23");
    ok(await todoService.complete(u.caretaker.ctx, b, { doneAt: "2026-11-23T20:00:00.000Z" }));
    const c = nextTodoId(a.id, "2026-11-30");
    // B's day moved past C's after its tick: by due day, C would look like A's
    // untouched successor.
    ok(await todoService.update(u.caretaker.ctx, b, { dueOn: "2026-12-07" }));

    expect(ok(await todoService.reopen(u.caretaker.ctx, a.id))).toMatchObject({ repeatRule: null });
    expect(await row(a.id)).toMatchObject({ doneAt: null, repeatId: null });
    // C is the chain's one open row (A left it).
    expect(await openIn(a.id)).toEqual([c]);
  });

  it("a next brought back by a second tick is found again on the second reopen", async () => {
    const { u, addTodo, openIn } = await setup();
    // Ticked now (no device time), so the second tick is after the next was first made.
    const todo = await addTodo({ dueOn: "2026-01-05" });
    ok(await todoService.complete(u.caretaker.ctx, todo.id));
    const [next] = (await openIn(todo.id)) as [string];
    ok(await todoService.reopen(u.caretaker.ctx, todo.id));
    ok(await todoService.complete(u.caretaker.ctx, todo.id));
    expect(await openIn(todo.id)).toEqual([next]);

    expect(ok(await todoService.reopen(u.caretaker.ctx, todo.id))).toMatchObject({ repeatRule: WEEKLY_MO });
    expect(await openIn(todo.id)).toEqual([todo.id]);
  });
});

describe("reopen after several offline ticks (B-383)", () => {
  it("ticks of A, B and C uploaded together: reopening C finds D, not B, and takes the untouched D away", async () => {
    const { u, addTodo, openIn, row } = await setup();
    // Ticked offline on the device on these Mondays, uploaded later: the
    // server makes B, C and D at upload time, after every tick's device time.
    const a = await addTodo({ dueOn: "2026-10-05" });
    ok(await todoService.complete(u.caretaker.ctx, a.id, { doneAt: "2026-10-05T19:00:00.000Z" }));
    const b = nextTodoId(a.id, "2026-10-12");
    ok(await todoService.complete(u.caretaker.ctx, b, { doneAt: "2026-10-12T19:00:00.000Z" }));
    const c = nextTodoId(a.id, "2026-10-19");
    ok(await todoService.complete(u.caretaker.ctx, c, { doneAt: "2026-10-19T19:00:00.000Z" }));
    const d = nextTodoId(a.id, "2026-10-26");
    expect(await openIn(a.id)).toEqual([d]);

    expect(ok(await todoService.reopen(u.caretaker.ctx, c))).toMatchObject({
      doneAt: null,
      repeatRule: WEEKLY_MO,
      repeatId: a.id,
    });
    expect((await row(d))?.deletedAt).not.toBeNull();
    expect(await row(b)).toMatchObject({ deletedAt: null, repeatRule: WEEKLY_MO });
    expect(await openIn(a.id)).toEqual([c]);
  });
});

describe("reopen of a tick made before B-383 (B-1002)", () => {
  /**
   * A tick as the server wrote it before B-383: `done_at` from the app's
   * clock, taken after the transaction's `now()` that the successor's
   * `created_at` is, so the successor looks made a few ms before the tick.
   */
  const tickedBeforeB383 = async (todoId: string, nextId: string) => {
    await getDb().execute(
      sql`UPDATE todo SET done_at = (SELECT created_at FROM todo WHERE id = ${nextId}) + interval '4 milliseconds'
          WHERE id = ${todoId}`,
    );
  };

  it("an untouched successor made a few ms before the tick is still found and taken away", async () => {
    const { u, addTodo, openIn, row } = await setup();
    const todo = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, todo.id));
    const [next] = (await openIn(todo.id)) as [string];
    await tickedBeforeB383(todo.id, next);

    expect(ok(await todoService.reopen(u.caretaker.ctx, todo.id))).toMatchObject({
      doneAt: null,
      repeatRule: WEEKLY_MO,
      repeatId: todo.id,
    });
    expect((await row(next))?.deletedAt).not.toBeNull();
    // One open row, still repeating (not two).
    expect(await openIn(todo.id)).toEqual([todo.id]);
  });

  it("an edited successor made a few ms before the tick stays, and the reopened one stops repeating", async () => {
    const { u, addTodo, openIn } = await setup();
    const todo = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, todo.id));
    const [next] = (await openIn(todo.id)) as [string];
    ok(await todoService.update(u.caretaker.ctx, next, { title: "Water and mist the ferns" }));
    await tickedBeforeB383(todo.id, next);

    expect(ok(await todoService.reopen(u.caretaker.ctx, todo.id))).toMatchObject({
      doneAt: null,
      repeatRule: null,
      repeatId: null,
    });
    expect(await openIn(todo.id)).toEqual([next]);
  });

  it("the fallback never takes a row made before the reopened one (its predecessor) for its successor", async () => {
    const { u, addTodo, openIn, row } = await setup();
    // A (Mon 16th) ticked makes B (Mon 23rd); B moved back before A's day and
    // ticked makes C; C is deleted. Reopening B finds no successor: A, due
    // after B now but made before it, isn't one.
    const a = await addTodo();
    ok(await todoService.complete(u.caretaker.ctx, a.id, { doneAt: MONDAY_NOON }));
    const b = nextTodoId(a.id, "2026-11-23");
    ok(await todoService.update(u.caretaker.ctx, b, { dueOn: "2026-11-09" }));
    ok(await todoService.complete(u.caretaker.ctx, b, { doneAt: TUESDAY_NOON }));
    const [c] = (await openIn(a.id)) as [string];
    ok(await todoService.remove(u.caretaker.ctx, c));

    expect(ok(await todoService.reopen(u.caretaker.ctx, b))).toMatchObject({
      doneAt: null,
      repeatRule: WEEKLY_MO,
      repeatId: a.id,
    });
    expect(await row(a.id)).toMatchObject({ deletedAt: null, doneAt: expect.anything() as unknown });
    expect(await openIn(a.id)).toEqual([b]);
  });
});
