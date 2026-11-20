import type { AuthUser } from "@caretook/data";

import { assistantActionService, taskService, timelineEntryService } from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload and `via` (connectors PRD): only the server's assistant runner
// sets it. A device's PUT or PATCH carrying `via` neither sets it on a new
// row nor changes it on one an assistant wrote. Each test makes its own
// users and group. All data is fictional.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

/** A time `ms` from now, as PowerSync's SQLite text. */
const local = (ms: number) => new Date(Date.now() + ms).toISOString().replace(/Z$/, "000Z");

const setup = async () => {
  const owner = await createUser("owner");
  const { group, recipient } = await createGroup(owner);
  const entryRow = (overrides: Record<string, unknown> = {}) => ({
    group_id: group.id,
    recipient_id: recipient.id,
    kind: "symptom",
    occurred_at: local(-60_000),
    time_zone: "America/Los_Angeles",
    title: null,
    body: null,
    details: JSON.stringify({ name: "Cough", severity: 2 }),
    deleted_at: null,
    ...overrides,
  });
  const taskRow = (overrides: Record<string, unknown> = {}) => ({
    group_id: group.id,
    recipient_id: recipient.id,
    title: "Call the pharmacy",
    due_on: null,
    due_time: null,
    done_at: null,
    deleted_at: null,
    ...overrides,
  });
  return { owner, group, entryRow, taskRow, api: clientFor(owner.ctx.authUser) };
};

describe("sync.upload: via", () => {
  it("never sets via from a device's PUT", async () => {
    const { owner, entryRow, taskRow, api } = await setup();
    const entryId = randomUUID();
    const taskId = randomUUID();
    const res = await api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id: entryId, data: entryRow({ via: "Forged" }) },
        { op: "PUT", table: "task", id: taskId, data: taskRow({ via: "Forged" }) },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await timelineEntryService.getById(owner.ctx, entryId))).toMatchObject({ via: null });
    expect(ok(await taskService.getById(owner.ctx, taskId))).toMatchObject({ via: null });
  });

  it("keeps an assistant's via through a device's PUT replay and PATCH", async () => {
    const { owner, group, entryRow, taskRow, api } = await setup();
    const { byAction } = ok(
      await assistantActionService.run(
        owner.ctx,
        group.id,
        [
          {
            type: "logSymptom",
            name: "Cough",
            severity: 2,
            occurredAt: new Date(Date.now() - 60_000).toISOString(),
          },
          { type: "addTask", title: "Call the pharmacy" },
        ],
        { via: "Test Claude" },
      ),
    );
    const [[entryId], [taskId]] = byAction as [[string], [string]];
    const res = await api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id: entryId, data: entryRow({ via: "Forged" }) },
        { op: "PATCH", table: "timeline_entry", id: entryId, data: { via: null, body: "Worse at night" } },
        { op: "PATCH", table: "timeline_entry", id: entryId, data: { via: "Forged" } },
        { op: "PUT", table: "task", id: taskId, data: taskRow({ via: null }) },
        { op: "PATCH", table: "task", id: taskId, data: { via: "Forged", title: "Call Corner Pharmacy" } },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied", "applied", "applied"]);
    expect(ok(await timelineEntryService.getById(owner.ctx, entryId))).toMatchObject({
      body: "Worse at night",
      via: "Test Claude",
    });
    expect(ok(await taskService.getById(owner.ctx, taskId))).toMatchObject({
      title: "Call Corner Pharmacy",
      via: "Test Claude",
    });
  });
});
