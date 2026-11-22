import { timelineEntryService } from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, sqliteTime } from "./testing";

// sync.upload as an Easy helper (easy roles PRD): their own entry's ops
// land, and another member's are refused (acknowledged, never retried),
// through sync's own PATCH and DELETE paths. The role matrix itself is the
// data layer's (easyRoles.int.test.ts). Each test makes its own users and
// group. Fictional data.

const setup = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const helper = await createUser("easy-helper");
  const { group, recipient } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: helper.user, role: "easy_helper" },
  ]);
  const entryRow = (overrides: Record<string, unknown> = {}) => ({
    group_id: group.id,
    recipient_id: recipient.id,
    kind: "symptom",
    occurred_at: sqliteTime(-60_000),
    time_zone: "America/Los_Angeles",
    title: null,
    body: null,
    details: JSON.stringify({ name: "Cough", severity: 2 }),
    deleted_at: null,
    ...overrides,
  });
  return {
    owner,
    caretaker,
    group,
    recipient,
    entryRow,
    helper: { ...helper, api: clientFor(helper.ctx.authUser) },
  };
};

const statuses = (res: { results: { status: string }[] }) => res.results.map((r) => r.status);

describe("sync.upload as an Easy helper", () => {
  it("lands their own entry, its edit and its delete", async () => {
    const { helper, owner, entryRow } = await setup();
    const id = randomUUID();
    const res = await helper.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id, data: entryRow() },
        {
          op: "PATCH",
          table: "timeline_entry",
          id,
          data: { details: JSON.stringify({ name: "Cough", severity: 4 }) },
        },
      ],
    });
    expect(statuses(res)).toEqual(["applied", "applied"]);
    expect(ok(await timelineEntryService.getById(owner.ctx, id))).toMatchObject({
      createdBy: helper.user.id,
      details: { name: "Cough", severity: 4 },
    });
    expect(
      statuses(
        await helper.api.sync.upload({
          ops: [{ op: "PATCH", table: "timeline_entry", id, data: { deleted_at: sqliteTime(0) } }],
        }),
      ),
    ).toEqual(["applied"]);
    expect(await timelineEntryService.getById(owner.ctx, id)).toBeNull();
  });

  it("refuses another member's entry, edit or delete, and leaves it as it was", async () => {
    const { helper, caretaker, group, entryRow } = await setup();
    const theirs = ok(
      await timelineEntryService.create(caretaker.ctx, {
        groupId: group.id,
        kind: "note",
        title: "Slept well",
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        timeZone: "America/Los_Angeles",
      }),
    )!;
    const res = await helper.api.sync.upload({
      ops: [
        { op: "PATCH", table: "timeline_entry", id: theirs.id, data: { title: "Slept badly" } },
        {
          op: "PUT",
          table: "timeline_entry",
          id: theirs.id,
          data: entryRow({ kind: "note", title: "Mine now", details: null }),
        },
        { op: "PATCH", table: "timeline_entry", id: theirs.id, data: { deleted_at: sqliteTime(0) } },
        { op: "DELETE", table: "timeline_entry", id: theirs.id },
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual(
      Array<string>(4).fill("permissions:unauthorized"),
    );
    expect(ok(await timelineEntryService.getById(caretaker.ctx, theirs.id))).toMatchObject({
      title: "Slept well",
      deletedAt: null,
    });
  });
});
