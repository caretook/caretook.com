import { getDb, recordTagId, recordTagService, tagId, tagService, todoService } from "@caretook/data";
import { nextTodoId } from "@caretook/data/series";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, upload } from "./testing";

// A repeating todo's next occurrence keeps the ticked one's tags (tags slice
// 4): the server copies them as the system on the tick, whoever ticks, with
// derived link ids; the device's twin writes the same ids, so its upload of
// them is a replay, even a viewer's, who may never tag. Each test makes its
// own users and group.

const WEEKLY_MO = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
const AT = "2026-11-10T22:20:00.000000Z";
// Mon 2026-11-16, 12:00 in Los Angeles (PowerSync's form).
const MONDAY = "2026-11-16T20:00:00.000000Z";

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  const first = randomUUID();
  ok(
    await todoService.create(owner.ctx, {
      id: first,
      groupId: group.id,
      recipientId: recipient.id,
      title: "Put the bins out",
      assigneeId: viewer.user.id,
      dueOn: "2026-11-16",
      repeatRule: WEEKLY_MO,
    }),
  );
  const tags = [];
  for (const name of ["Care home move", "Urgent"]) {
    const tag = ok(
      await tagService.create(owner.ctx, { id: tagId(group.id, name), groupId: group.id, name }),
    )!;
    ok(await recordTagService.link(owner.ctx, { groupId: group.id, tagId: tag.id, todoId: first }));
    tags.push(tag.id);
  }
  return {
    group,
    recipient,
    owner,
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
    first,
    tags,
  };
};

const linksOf = async (todoId: string) =>
  (
    await getDb().$client.query<{ id: string; tag_id: string }>(
      `SELECT id, tag_id FROM record_tag WHERE todo_id = $1 ORDER BY tag_id`,
      [todoId],
    )
  ).rows;

/** The device's upload of a link on `todoId`, as its twin writes it. */
const linkPut = (groupId: string, tag: string, todoId: string) => ({
  op: "PUT" as const,
  table: "record_tag",
  id: recordTagId(tag, todoId),
  data: {
    group_id: groupId,
    tag_id: tag,
    entry_id: null,
    todo_id: todoId,
    provider_id: null,
    medication_id: null,
    created_at: AT,
    updated_at: AT,
  },
});

const twinPut = (first: string, groupId: string, recipientId: string, assignee: string) => {
  const id = nextTodoId(first, "2026-11-23");
  return {
    op: "PUT" as const,
    table: "todo",
    id,
    data: {
      group_id: groupId,
      recipient_id: recipientId,
      title: "Put the bins out",
      assignee_id: assignee,
      assignee_name: null,
      due_on: "2026-11-23",
      due_time: null,
      done_at: null,
      done_by: null,
      provider_id: null,
      medication_id: null,
      event_id: null,
      deleted_at: null,
      repeat_rule: WEEKLY_MO,
      repeat_starts_on: "2026-11-16",
      repeat_id: first,
      created_at: AT,
      updated_at: AT,
    },
  };
};

const expected = (tags: string[], todoId: string) =>
  tags
    .map((t) => ({ id: recordTagId(t, todoId), tag_id: t }))
    .sort((a, b) => a.tag_id.localeCompare(b.tag_id));

describe("repeating todos keep their tags", () => {
  it("a viewer ticks a tagged repeating todo: the next has the tags, and the twin's upload is a replay", async () => {
    const { group, recipient, viewer, first, tags } = await setup();
    const nextId = nextTodoId(first, "2026-11-23");
    const tick = {
      op: "PATCH" as const,
      table: "todo",
      id: first,
      data: { done_at: MONDAY, done_by: viewer.user.id },
    };
    const ops = [
      tick,
      twinPut(first, group.id, recipient.id, viewer.user.id),
      ...tags.map((t) => linkPut(group.id, t, nextId)),
    ];
    expect((await upload(viewer.api, ops)).map((r) => r.status)).toEqual(ops.map(() => "applied"));
    expect(await linksOf(nextId)).toEqual(expected(tags, nextId));
    // The ticked todo keeps its own.
    expect(await linksOf(first)).toEqual(expected(tags, first));

    // A replay of the whole upload changes nothing.
    expect((await upload(viewer.api, ops)).map((r) => r.status)).toEqual(ops.map(() => "applied"));
    expect(await linksOf(nextId)).toEqual(expected(tags, nextId));
  });

  it("still refuses a viewer's new link", async () => {
    const { group, owner, viewer, first } = await setup();
    const later = ok(
      await tagService.create(owner.ctx, { id: tagId(group.id, "Later"), groupId: group.id, name: "Later" }),
    )!;
    const [result] = await upload(viewer.api, [linkPut(group.id, later.id, first)]);
    expect(result?.status).not.toBe("applied");
    expect(await linksOf(first)).not.toContainEqual(expect.objectContaining({ tag_id: later.id }));
  });

  it("a writer's skip carries the tags to the next too", async () => {
    const { group, owner, first, tags } = await setup();
    ok(await todoService.skip(owner.ctx, first));
    const [next] = ok(await todoService.list(owner.ctx, { groupId: group.id })).data.filter(
      (t) => t.repeatId === first && t.id !== first,
    );
    expect(next).toBeDefined();
    expect(await linksOf(next!.id)).toEqual(expected(tags, next!.id));
  });
});
