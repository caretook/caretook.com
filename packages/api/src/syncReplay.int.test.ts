import { careGroupMemberService, timelineEntryService, todoModel, todoService } from "@caretook/data";
import { nextTodoId } from "@caretook/data/series";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWorld, ok, system } from "../../data/test/fixtures";
import { clientFor, outcomes, putOp, sqliteTime } from "./testing";

// sync.upload: a PUT is a create, replayed at most (B-288). A replay changes
// nothing, whatever the uploader's role now, and the follow-ups a PUT carries
// (a delete, a todo's tick) run only with the create.

const world = async () => {
  const w = await createWorld();
  const api = (who: keyof typeof w.u) => clientFor(w.u[who].ctx.authUser);
  return { ...w, api };
};

const AT = "2026-11-16T20:00:00.000000Z";
const WEEKLY_MO = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";

const todoRow = (w: Awaited<ReturnType<typeof world>>, overrides: Record<string, unknown> = {}) => ({
  group_id: w.group.id,
  recipient_id: w.recipient.id,
  title: "Call the pharmacy",
  due_on: "2026-11-16",
  done_at: null,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
  ...overrides,
});

const stored = async (id: string) => ok(await todoService.getById(system, id, { includeDeleted: true }));

describe("sync.upload: a replayed PUT (B-288)", () => {
  it("timeline_entry: replayed after its uploader became a viewer, it applies and changes nothing", async () => {
    const w = await world();
    const id = randomUUID();
    const note = (title: string) =>
      putOp("timeline_entry", id, {
        group_id: w.group.id,
        recipient_id: w.recipient.id,
        kind: "note",
        title,
        occurred_at: sqliteTime(-60_000),
        time_zone: "America/Los_Angeles",
        deleted_at: null,
      });
    expect(await outcomes(w.api("caretaker"), [note("Slept well")])).toEqual(["applied"]);
    ok(await timelineEntryService.update(w.u.admin.ctx, id, { title: "Slept well, woke at 6" }));

    const membership = await w.membershipOf(w.u.caretaker);
    ok(await careGroupMemberService.updateRole(w.u.owner.ctx, { id: membership.id, role: "viewer" }));
    expect(await outcomes(w.api("caretaker"), [note("Slept well")])).toEqual(["applied"]);
    expect(ok(await timelineEntryService.getById(w.u.owner.ctx, id))).toMatchObject({
      title: "Slept well, woke at 6",
      updatedBy: w.u.admin.user.id,
    });
  });

  it("todo: a first PUT carrying done_at creates it done", async () => {
    const w = await world();
    const id = randomUUID();
    const put = putOp("todo", id, todoRow(w, { done_at: AT, done_by: w.u.caretaker.user.id }));
    expect(await outcomes(w.api("caretaker"), [put])).toEqual(["applied"]);
    expect(await stored(id)).toMatchObject({ doneBy: w.u.caretaker.user.id, deletedAt: null });
    expect((await stored(id))?.doneAt).not.toBeNull();
  });

  it("todo: a PUT carrying done_at, replayed after a co-member reopened it, leaves it open and makes no next", async () => {
    const w = await world();
    const id = randomUUID();
    const put = putOp(
      "todo",
      id,
      todoRow(w, { done_at: AT, repeat_rule: WEEKLY_MO, repeat_starts_on: "2026-11-16", repeat_id: id }),
    );
    expect(await outcomes(w.api("caretaker"), [put])).toEqual(["applied"]);
    const next = nextTodoId(id, "2026-11-23");
    expect(await stored(next)).toMatchObject({ repeatId: id, doneAt: null });

    ok(await todoService.reopen(w.u.admin.ctx, id));
    const chain = async () =>
      ok(await todoService.list(system, { groupId: w.group.id, includeDeleted: true }))
        .data.filter((t) => t.repeatId === id)
        .map((t) => [t.id, t.doneAt, t.deletedAt]);
    const before = await chain();

    expect(await outcomes(w.api("caretaker"), [put])).toEqual(["applied"]);
    expect((await stored(id))?.doneAt).toBeNull();
    expect(await chain()).toEqual(before);
  });

  it("todo: a first PUT carrying deleted_at creates it deleted; a replay leaves a row edited or restored since", async () => {
    const w = await world();
    const gone = randomUUID();
    expect(await outcomes(w.api("caretaker"), [putOp("todo", gone, todoRow(w, { deleted_at: AT }))])).toEqual(
      ["applied"],
    );
    expect((await stored(gone))?.deletedAt).not.toBeNull();
    // Restored since (an Undo elsewhere), then the create replayed: it stays.
    ok(await todoModel.restore(gone, {}));
    const replay = putOp("todo", gone, todoRow(w, { deleted_at: AT }));
    expect(await outcomes(w.api("caretaker"), [replay])).toEqual(["applied"]);
    expect((await stored(gone))?.deletedAt).toBeNull();

    // Created live, edited by a co-member; a replay that carries a delete leaves it.
    const id = randomUUID();
    expect(await outcomes(w.api("caretaker"), [putOp("todo", id, todoRow(w))])).toEqual(["applied"]);
    ok(await todoService.update(w.u.admin.ctx, id, { title: "Call Corner Pharmacy" }));
    const late = putOp("todo", id, todoRow(w, { deleted_at: AT }));
    expect(await outcomes(w.api("caretaker"), [late])).toEqual(["applied"]);
    expect(await stored(id)).toMatchObject({ title: "Call Corner Pharmacy", deletedAt: null });
  });
});
