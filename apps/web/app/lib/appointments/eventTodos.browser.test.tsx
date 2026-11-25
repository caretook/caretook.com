import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { entryTodo, fx, series, todo, TEST_GROUP, TEST_USER } from "../../../test/fixtures";
import { fixClock } from "../../../test/found";
import { laTime, NOW } from "../../routes/app/groups/planner/plannerWorld";
import { entryTodosQuery } from "../todos/entryTodos.sync";
import { readRows } from "../timeline/timeline.sync";
import { rescheduleEvent } from "./appointments.sync";
import { applySeriesEdit } from "./series.sync";

// An event's todos are link rows (planner-3), on the device: a reschedule
// that keeps the old event cancelled moves its live todos' links, open and
// done, to the new event in its local transaction (a series visit moved on
// its own too), while a plain time change keeps them; a series edit keeps a
// visit a todo links. What the server makes of the moved links' DELETE and
// PUT is syncEventTodos.int.test.ts's. The clock: Wed 2026-11-18, 10:00 AM
// in Los Angeles.

const VISIT = fx.event({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fc201",
  title: "Cardiology follow-up",
  occurredAt: laTime(2, 9),
  endsAt: laTime(2, 10),
});
// Backfilled (its `event_id` and the migration's link row), linked by a row alone, done, and deleted.
const OPEN = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fc401",
  title: "Bring the BP log",
  eventId: VISIT.id,
});
const NEW = todo({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fc402", title: "Ask about the stress test" });
const DONE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fc403",
  title: "Book the ride",
  doneAt: laTime(-1, 9),
  doneBy: TEST_USER.id,
});
const GONE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fc404",
  title: "Deleted one",
  deletedAt: laTime(-1, 9),
});
const LINKS = [OPEN, NEW, DONE, GONE].map((t) => entryTodo(VISIT.id, t.id));

const device = (fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"]) =>
  renderWithDevice({
    element: <p>Device</p>,
    url: `/app/groups/${TEST_GROUP.id}/planner`,
    fixtures,
  });
type Db = Awaited<ReturnType<typeof device>>["db"];

/** An entry's live linked todos' titles. */
const todosOf = async (db: Db, entryId: string) =>
  (await readRows<{ title: string }>(db, entryTodosQuery(entryId))).map((t) => t.title).sort();

/** The queued uploads as "OP table", each with its local transaction. */
const queued = (db: Db) =>
  db.powersync
    .getAll<{ tx_id: number; data: string }>("SELECT tx_id, data FROM ps_crud ORDER BY id")
    .then((rows) =>
      rows.map((r) => {
        const op = JSON.parse(r.data) as { op: string; type: string; id: string };
        return { tx: r.tx_id, op: `${op.op} ${op.type}`, id: op.id };
      }),
    );

/** The same wall-clock time as ISO 8601, as a schedule takes it. */
const iso = (days: number, hour: number) => new Date(Date.UTC(2026, 10, 18 + days, hour + 8)).toISOString();

const MOVED = ["Ask about the stress test", "Book the ride", "Bring the BP log"];

beforeEach(() => fixClock(NOW));
afterEach(() => vi.useRealTimers());

describe("rescheduling keeps the old event cancelled", () => {
  test("its open and done todos move to the new event in the same transaction, offline; the cancelled one lists none", async () => {
    // The device never connects in these tests: every write here is offline.
    const { db } = await device([VISIT, OPEN, NEW, DONE, GONE, LINKS]);
    const res = await rescheduleEvent(db, VISIT.id, {
      occurredAt: iso(5, 9),
      endsAt: iso(5, 10),
      allDay: false,
      keepOldAsCancelled: true,
    });
    if (!res.ok) throw new Error(res.error);
    expect(res.id).not.toBe(VISIT.id);

    expect(await todosOf(db, res.id)).toEqual(MOVED);
    expect(await todosOf(db, VISIT.id)).toEqual([]);
    // The deleted todo's link stays where it was (its todo is gone, so nothing shows it).
    const rows = await db.powersync.getAll<{ entry_id: string; todo_id: string }>(
      "SELECT entry_id, todo_id FROM timeline_entry_todo ORDER BY todo_id",
    );
    expect(rows).toEqual([
      { entry_id: res.id, todo_id: OPEN.id },
      { entry_id: res.id, todo_id: NEW.id },
      { entry_id: res.id, todo_id: DONE.id },
      { entry_id: VISIT.id, todo_id: GONE.id },
    ]);

    const ops = await queued(db);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
    // The new event before its links; no todo is written (an old client's `event_id` is the server's to clear).
    const at = (op: string) => ops.findIndex((o) => o.op === op);
    expect(at("PUT timeline_entry")).toBeLessThan(at("PUT timeline_entry_todo"));
    expect(ops.filter((o) => o.op === "DELETE timeline_entry_todo")).toHaveLength(3);
    expect(ops.filter((o) => o.op === "PUT timeline_entry_todo")).toHaveLength(3);
    expect(ops.some((o) => o.op.endsWith(" todo"))).toBe(false);
  });

  test("a plain time change keeps the event and its links", async () => {
    const { db } = await device([VISIT, OPEN, NEW, DONE, LINKS.slice(0, 3)]);
    const res = await rescheduleEvent(db, VISIT.id, {
      occurredAt: iso(3, 9),
      endsAt: iso(3, 10),
      allDay: false,
      keepOldAsCancelled: false,
    });
    expect(res).toEqual({ ok: true, id: VISIT.id });
    expect(await todosOf(db, VISIT.id)).toEqual(MOVED);
    expect((await queued(db)).map((o) => o.op)).toEqual(["PATCH timeline_entry"]);
  });
});

/** Dialysis, Mon Wed Fri 6:00 for 4 h, since Mon 16 Nov, with visits Fri 20, Mon 23 and Wed 25. */
const DIALYSIS = series({ startsOn: "2026-11-16", title: "Dialysis" });
const visit = (n: number, days: number, day: string) =>
  fx.event({
    id: `7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fc5${String(n).padStart(2, "0")}`,
    title: "Dialysis",
    occurredAt: laTime(days, 6),
    endsAt: laTime(days, 10),
    seriesId: DIALYSIS.id,
    seriesDay: day,
    text: "",
  });
const FRI_20 = visit(1, 2, "2026-11-20");
const MON_23 = visit(2, 5, "2026-11-23");
const WED_25 = visit(3, 7, "2026-11-25");
const SERIES = [DIALYSIS, FRI_20, MON_23, WED_25];

describe("a series", () => {
  test("deleting this and later keeps a visit a todo links (by a link row alone), detached", async () => {
    const { db } = await device([SERIES, NEW, entryTodo(MON_23.id, NEW.id)]);
    const res = await applySeriesEdit(db, {
      visitId: FRI_20.id,
      scope: "later",
      change: { action: "delete" },
      now: NOW,
    });
    if (!res.ok) throw new Error(res.error);
    const rows = await db.powersync.getAll<{
      id: string;
      deleted_at: string | null;
      series_detached: number;
    }>("SELECT id, deleted_at, series_detached FROM timeline_entry WHERE series_id = ? ORDER BY series_day", [
      DIALYSIS.id,
    ]);
    expect(rows.map((r) => [r.id, !!r.deleted_at])).toEqual([
      [FRI_20.id, true],
      [MON_23.id, false],
      [WED_25.id, true],
    ]);
    expect(rows[1]?.series_detached).toBe(1);
    expect(await todosOf(db, MON_23.id)).toEqual(["Ask about the stress test"]);
    expect((await queued(db)).some((o) => o.op.endsWith(" todo"))).toBe(false);
  });

  test("a visit moved on its own, keeping the old one, takes its todos with it", async () => {
    const { db } = await device([
      SERIES,
      NEW,
      DONE,
      entryTodo(MON_23.id, NEW.id),
      entryTodo(MON_23.id, DONE.id),
    ]);
    const res = await applySeriesEdit(db, {
      visitId: MON_23.id,
      scope: "only",
      change: {
        action: "reschedule",
        occurredAt: iso(6, 9),
        endsAt: iso(6, 13),
        allDay: false,
        keepOld: true,
      },
      now: NOW,
    });
    if (!res.ok) throw new Error(res.error);
    expect(res.visitId).not.toBe(MON_23.id);
    expect(await todosOf(db, res.visitId)).toEqual(["Ask about the stress test", "Book the ride"]);
    expect(await todosOf(db, MON_23.id)).toEqual([]);
  });
});
