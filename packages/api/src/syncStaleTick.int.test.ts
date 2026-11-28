import type { AuthUser } from "@caretook/data";
import type { Api } from "./testing";

import { todoService } from "@caretook/data";
import { TICK_NEXT_METADATA } from "@caretook/data/domain";
import { nextTodoId } from "@caretook/data/series";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, upload } from "./testing";

// A stale tick never revives a stopped chain (B-387): the device's twin of a
// tick's next carries `TICK_NEXT_METADATA`, and the server never creates one
// from it (the tick makes its own); a skip's twin is unflagged and still a
// writer's create. Rows as a device's SQLite holds them; each test makes its
// own users and group.

const DAILY = "FREQ=DAILY;INTERVAL=1";
const AT = "2026-11-10T22:20:00.000000Z";
// Mon 2026-11-16 and Tue 2026-11-17, 12:00 in Los Angeles (PowerSync's form).
const MONDAY = "2026-11-16T20:00:00.000000Z";
const TUESDAY = "2026-11-17T20:00:00.000000Z";

const setup = async () => {
  const ownerUser = await createUser("owner");
  const caretakerB = await createUser("caretaker");
  const caretakerC = await createUser("caretaker");
  const viewerUser = await createUser("viewer");
  const { group, recipient } = await createGroup(ownerUser, [
    { user: caretakerB.user, role: "caretaker" },
    { user: caretakerC.user, role: "caretaker" },
    { user: viewerUser.user, role: "viewer" },
  ]);
  const withApi = <T extends { ctx: { authUser: AuthUser } }>(u: T) => ({
    ...u,
    api: clientFor(u.ctx.authUser),
  });
  return {
    group,
    recipient,
    a: withApi(ownerUser),
    b: withApi(caretakerB),
    c: withApi(caretakerC),
    viewer: withApi(viewerUser),
  };
};
type World = Awaited<ReturnType<typeof setup>>;

/** A daily todo due Monday, its chain on itself. */
const repeating = (world: World, first: string, overrides: Record<string, unknown> = {}) => ({
  group_id: world.group.id,
  recipient_id: world.recipient.id,
  title: "Check the blood pressure cuff",
  assignee_id: null,
  assignee_name: null,
  due_on: "2026-11-16",
  due_time: null,
  done_at: null,
  done_by: null,
  provider_id: null,
  medication_id: null,
  event_id: null,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
  created_by: "ignored",
  updated_by: "ignored",
  repeat_rule: DAILY,
  repeat_starts_on: "2026-11-16",
  repeat_id: first,
  ...overrides,
});

const made = async (world: World, overrides: Record<string, unknown> = {}) => {
  const id = randomUUID();
  const put = { op: "PUT" as const, table: "todo", id, data: repeating(world, id, overrides) };
  expect(await upload(world.a.api, [put])).toEqual([{ id, status: "applied" }]);
  return id;
};

const tick = (id: string, at: string, by: string) => ({
  op: "PATCH" as const,
  table: "todo",
  id,
  data: { done_at: at, done_by: by },
});

/** The device's twin of the next occurrence on `day`: a tick's is flagged. */
const twin = (
  world: World,
  first: string,
  day: string,
  { fromTick, ...overrides }: { fromTick: boolean } & Record<string, unknown>,
) => ({
  op: "PUT" as const,
  table: "todo",
  id: nextTodoId(first, day),
  data: repeating(world, first, { due_on: day, ...overrides }),
  metadata: fromTick ? TICK_NEXT_METADATA : null,
});

const openIn = async (world: World, repeatId: string) =>
  ok(await todoService.list(world.a.ctx, { groupId: world.group.id }))
    .data.filter((t) => t.repeatId === repeatId && !t.doneAt)
    .map((t) => [t.id, t.dueOn]);

const statuses = async (api: Api, ops: Parameters<typeof upload>[1]) =>
  (await upload(api, ops)).map((r) => r.status);

describe("sync.upload: a stale tick and a stopped chain (B-387)", () => {
  it("A ticks online, B stops repeating, C's stale offline tick and its twin upload: the chain stays stopped", async () => {
    const world = await setup();
    const { a, b, c } = world;
    const id = await made(world);

    // A ticks it Monday, online: the server makes Tuesday's.
    const first = [tick(id, MONDAY, a.user.id), twin(world, id, "2026-11-17", { fromTick: true })];
    expect(await statuses(a.api, first)).toEqual(["applied", "applied"]);
    const tuesday = nextTodoId(id, "2026-11-17");
    expect(await openIn(world, id)).toEqual([[tuesday, "2026-11-17"]]);

    // B deletes it: "Delete and stop repeating".
    expect(await upload(b.api, [{ op: "DELETE", table: "todo", id: tuesday }])).toEqual([
      { id: tuesday, status: "applied" },
    ]);
    expect(await openIn(world, id)).toEqual([]);

    // C ticked the original offline on Tuesday (its next: Wednesday) and comes online now.
    const stale = [tick(id, TUESDAY, c.user.id), twin(world, id, "2026-11-18", { fromTick: true })];
    expect(await upload(c.api, stale)).toEqual([
      { id, status: "applied" },
      { id: nextTodoId(id, "2026-11-18"), status: "applied" },
    ]);
    expect(await openIn(world, id)).toEqual([]);
    expect(
      await todoService.getById(a.ctx, nextTodoId(id, "2026-11-18"), { includeDeleted: true }),
    ).toBeNull();
    expect(ok(await todoService.getById(a.ctx, id))).toMatchObject({ doneBy: a.user.id });

    // A stale tick on A's own day finds the deleted row: it stays deleted.
    const sameDay = [tick(id, MONDAY, c.user.id), twin(world, id, "2026-11-17", { fromTick: true })];
    expect(await statuses(c.api, sameDay)).toEqual(["applied", "applied"]);
    expect(await todoService.getById(a.ctx, tuesday)).toBeNull();
    expect(await openIn(world, id)).toEqual([]);
  });

  it("a skip's unflagged occurrence, with no open row in the chain, still creates it", async () => {
    const world = await setup();
    const { b } = world;
    const id = await made(world);
    const skip = [
      { op: "PATCH" as const, table: "todo", id, data: { deleted_at: MONDAY } },
      twin(world, id, "2026-11-17", { fromTick: false }),
    ];
    expect(await statuses(b.api, skip)).toEqual(["applied", "applied"]);
    expect(await todoService.getById(b.ctx, id)).toBeNull();
    expect(await openIn(world, id)).toEqual([[nextTodoId(id, "2026-11-17"), "2026-11-17"]]);
  });

  it("a flagged twin whose row the server's tick made is applied and changes nothing", async () => {
    const world = await setup();
    const { a } = world;
    const id = await made(world);
    // The device's copy differs (its own edit raced the tick): the server's row stands.
    const next = twin(world, id, "2026-11-17", { fromTick: true, title: "Not the server's title" });
    expect(await statuses(a.api, [tick(id, MONDAY, a.user.id), next])).toEqual(["applied", "applied"]);
    expect(ok(await todoService.getById(a.ctx, next.id))).toMatchObject({
      title: "Check the blood pressure cuff",
      dueOn: "2026-11-17",
      repeatId: id,
      doneAt: null,
    });
    expect(await openIn(world, id)).toEqual([[next.id, "2026-11-17"]]);
  });

  it("a viewer's own tick with its twin is applied for both", async () => {
    const world = await setup();
    const { viewer } = world;
    const id = await made(world, { assignee_id: viewer.user.id });
    const next = twin(world, id, "2026-11-17", { fromTick: true, assignee_id: viewer.user.id });
    expect(await upload(viewer.api, [tick(id, MONDAY, viewer.user.id), next])).toEqual([
      { id, status: "applied" },
      { id: next.id, status: "applied" },
    ]);
    expect(await openIn(world, id)).toEqual([[next.id, "2026-11-17"]]);
    expect(ok(await todoService.getById(viewer.ctx, id))).toMatchObject({ doneBy: viewer.user.id });
  });
});
