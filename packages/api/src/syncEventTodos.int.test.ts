import { entryTodoId, getDb, timelineEntryService, todoService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createWorld, ok } from "../../data/test/fixtures";
import { clientFor } from "./testing";

// sync.upload for a reschedule that keeps the old event cancelled (planner-3
// slice 2): the device moves the old event's todo links to the new event,
// a DELETE of each old link and a PUT of its `entryTodoId(newId, todoId)`.
// The server ends with one link per todo, on the new event, and clears an
// old client's `todo.event_id` that named the old event (`unlink`). The
// device side is eventTodos.browser.test.tsx's.

const SAVED_AT = "2026-11-17T21:45:25.229000Z";
const DAY = 86_400_000;

const event = (groupId: string, title: string, days: number) => ({
  groupId,
  kind: "event" as const,
  title,
  occurredAt: new Date(Date.now() + days * DAY).toISOString(),
  timeZone: "America/Los_Angeles",
});

describe("sync.upload: a reschedule's moved todo links", () => {
  it("the old links' DELETE and the new ones' PUT leave one link on the new event, and clear a matching `event_id`", async () => {
    const { u, group } = await createWorld({ members: ["caretaker"] });
    const ctx = u.caretaker.ctx;
    const old = ok(await timelineEntryService.create(ctx, event(group.id, "Cardiology follow-up", 2)))!;
    const moved = ok(await timelineEntryService.create(ctx, event(group.id, "Cardiology follow-up", 5)))!;
    // An old client's todo (its `event_id`, mirrored into a link row) and one linked by a row alone, done.
    const legacy = ok(
      await todoService.create(ctx, { groupId: group.id, title: "Bring the BP log", eventId: old.id }),
    )!;
    expect(legacy.eventId).toBe(old.id);
    const linked = ok(await todoService.create(ctx, { groupId: group.id, title: "Book the ride" }))!;
    ok(await todoService.complete(ctx, linked.id));
    const caretaker = clientFor(ctx.authUser);
    const link = (op: "PUT" | "DELETE", entryId: string, todoId: string) => ({
      op,
      table: "timeline_entry_todo",
      id: entryTodoId(entryId, todoId),
      data:
        op === "DELETE"
          ? null
          : {
              group_id: group.id,
              entry_id: entryId,
              todo_id: todoId,
              created_at: SAVED_AT,
              updated_at: SAVED_AT,
            },
    });
    const put = await caretaker.sync.upload({ ops: [link("PUT", old.id, linked.id)] });
    expect(put.results.map((r) => r.status)).toEqual(["applied"]);

    const res = await caretaker.sync.upload({
      ops: [
        link("DELETE", old.id, legacy.id),
        link("PUT", moved.id, legacy.id),
        link("DELETE", old.id, linked.id),
        link("PUT", moved.id, linked.id),
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied", "applied"]);

    const { rows } = await getDb().$client.query<{ entry_id: string; todo_id: string }>(
      "SELECT entry_id, todo_id FROM timeline_entry_todo WHERE todo_id = ANY($1) ORDER BY todo_id",
      [[legacy.id, linked.id]],
    );
    expect(rows).toEqual(
      [
        { entry_id: moved.id, todo_id: legacy.id },
        { entry_id: moved.id, todo_id: linked.id },
      ].sort((a, b) => a.todo_id.localeCompare(b.todo_id)),
    );
    const todos = await getDb().$client.query<{ id: string; event_id: string | null }>(
      "SELECT id, event_id FROM todo WHERE id = ANY($1)",
      [[legacy.id, linked.id]],
    );
    expect(todos.rows.map((t) => t.event_id)).toEqual([null, null]);
  });
});
