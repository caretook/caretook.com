import { entryTodoId, getDb, timelineEntryService, todoService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createWorld, ok } from "../../data/test/fixtures";
import { clientFor, outcomes } from "./testing";

// sync.upload for entry ↔ todo links (planner-3 slice 1): a device's
// timeline_entry_todo PUT links and DELETE unlinks, a repeated PUT is
// accepted (one row), and a PATCH or a viewer's PUT is refused. Each test
// makes its own users and group.

const SAVED_AT = "2026-11-17T21:45:25.229000Z";

const setup = async () => {
  const { u, group } = await createWorld({ members: ["caretaker", "viewer"] });
  const note = ok(
    await timelineEntryService.create(u.caretaker.ctx, {
      groupId: group.id,
      kind: "note",
      title: "Dr. Alvarez said to book a follow-up",
      occurredAt: new Date(Date.now() - 3_600_000).toISOString(),
      timeZone: "America/Los_Angeles",
    }),
  )!;
  const todo = ok(
    await todoService.create(u.caretaker.ctx, { groupId: group.id, title: "Book a follow-up" }),
  )!;
  const id = entryTodoId(note.id, todo.id);
  const op = (kind: "PUT" | "PATCH" | "DELETE") => ({
    op: kind,
    table: "timeline_entry_todo",
    id,
    data:
      kind === "DELETE"
        ? null
        : {
            group_id: group.id,
            entry_id: note.id,
            todo_id: todo.id,
            created_at: SAVED_AT,
            updated_at: SAVED_AT,
          },
  });
  const rows = async () =>
    (await getDb().$client.query(`SELECT id FROM timeline_entry_todo WHERE id = $1`, [id])).rows;
  return {
    id,
    op,
    rows,
    caretaker: clientFor(u.caretaker.ctx.authUser),
    viewer: clientFor(u.viewer.ctx.authUser),
  };
};

describe("sync.upload: timeline_entry_todo", () => {
  it("PUT links and a repeated PUT is accepted as one row; DELETE unlinks", async () => {
    const { id, op, rows, caretaker } = await setup();
    const put = await caretaker.sync.upload({ ops: [op("PUT"), op("PUT")] });
    expect(put.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await rows()).toEqual([{ id }]);

    const del = await caretaker.sync.upload({ ops: [op("DELETE"), op("DELETE")] });
    expect(del.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await rows()).toEqual([]);
  });

  it("refuses a PATCH, and a viewer's PUT and DELETE", async () => {
    const { op, rows, caretaker, viewer } = await setup();
    expect(await outcomes(caretaker, [op("PATCH")])).toEqual(["sync:readOnlyTable"]);
    expect(await outcomes(viewer, [op("PUT")])).toEqual(["permissions:unauthorized"]);
    expect(await rows()).toEqual([]);

    expect(await outcomes(caretaker, [op("PUT")])).toEqual(["applied"]);
    expect(await outcomes(viewer, [op("DELETE")])).toEqual(["permissions:unauthorized"]);
    expect(await rows()).toHaveLength(1);
  });
});
