import type { TaskCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { SYSTEM_USER } from "../constants";
import { isError } from "../errors";
import { timelineEntryModel } from "../models";
import {
  careGroupMemberService,
  medicationService,
  noteDocumentService,
  providerService,
  taskService,
  timelineEntryService,
} from ".";

// Every test builds its own group and users, so tests never depend on each other.

const WRITERS = ["owner", "admin", "caretaker"] as const;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const issuesOf = (res: unknown) =>
  isError(res)
    ? ((res.meta as { issues?: { path: string }[] } | undefined)?.issues ?? []).map((i) => i.path)
    : [];

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
    staff: await createUser("staff", "admin"),
  };
  const { group, recipient } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const input = (overrides: Partial<TaskCreateInput> = {}): TaskCreateInput => ({
    groupId: group.id,
    title: "Call the pharmacy",
    ...overrides,
  });
  const addTask = async (overrides: Partial<TaskCreateInput> = {}) => {
    const task = ok(await taskService.create(u.caretaker.ctx, input(overrides)));
    if (!task) throw new Error("task not readable");
    return task;
  };
  return { u, group, recipient, input, addTask };
};

describe("taskService: roles", () => {
  it("lets writers create, update, complete, reopen and delete; outsiders and staff see nothing", async () => {
    const { u, group, recipient, input, addTask } = await setup();

    for (const role of WRITERS) {
      const created = ok(await taskService.create(u[role].ctx, input({ title: `By ${role}` })));
      expect(created).toMatchObject({
        groupId: group.id,
        recipientId: recipient.id,
        title: `By ${role}`,
        assigneeId: null,
        doneAt: null,
        createdBy: u[role].user.id,
      });
      const updated = ok(await taskService.update(u[role].ctx, created!.id, { dueOn: "2026-12-01" }));
      expect(updated).toMatchObject({ dueOn: "2026-12-01", updatedBy: u[role].user.id });
      const done = ok(await taskService.complete(u[role].ctx, created!.id));
      expect(done).toMatchObject({ doneBy: u[role].user.id });
      expect(done!.doneAt).not.toBeNull();
      expect(ok(await taskService.reopen(u[role].ctx, created!.id))).toMatchObject({
        doneAt: null,
        doneBy: null,
      });
      ok(await taskService.remove(u[role].ctx, created!.id));
      expect(await taskService.getById(u.owner.ctx, created!.id)).toBeNull();
    }

    const task = await addTask();
    expect(codeOf(await taskService.create(u.viewer.ctx, input()))).toBe("permissions:unauthorized");
    expect(codeOf(await taskService.remove(u.viewer.ctx, task.id))).toBe("permissions:unauthorized");
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await taskService.create(u[role].ctx, input()))).toBe("permissions:unauthorized");
      expect(await taskService.getById(u[role].ctx, task.id)).toBeNull();
      expect(ok(await taskService.list(u[role].ctx, { groupId: group.id })).data).toEqual([]);
      expect(codeOf(await taskService.update(u[role].ctx, task.id, { title: "Nope" }))).toBe(
        "taskService:notFound",
      );
      expect(codeOf(await taskService.complete(u[role].ctx, task.id))).toBe("taskService:notFound");
      expect(codeOf(await taskService.remove(u[role].ctx, task.id))).toBe("taskService:notFound");
    }
  });

  it("lets every member read the group's tasks", async () => {
    const { u, group, addTask } = await setup();
    const task = await addTask();
    for (const role of [...WRITERS, "viewer"] as const) {
      const page = ok(await taskService.list(u[role].ctx, { groupId: group.id }));
      expect(page.data.map((t) => t.id)).toEqual([task.id]);
      expect(ok(await taskService.getById(u[role].ctx, task.id))).toMatchObject({ id: task.id });
    }
  });
});

describe("taskService: viewers complete only their own tasks", () => {
  it("lets a viewer complete and reopen a task assigned to them", async () => {
    const { u, addTask } = await setup();
    const task = await addTask({ assigneeId: u.viewer.user.id });
    const done = ok(await taskService.complete(u.viewer.ctx, task.id));
    expect(done).toMatchObject({ doneBy: u.viewer.user.id });
    // Completing again keeps who finished it first.
    expect(ok(await taskService.complete(u.owner.ctx, task.id))).toMatchObject({ doneBy: u.viewer.user.id });
    expect(ok(await taskService.reopen(u.viewer.ctx, task.id))).toMatchObject({ doneAt: null, doneBy: null });
  });

  it("refuses a viewer on someone else's task, an unassigned one, a typed name's, and any edit", async () => {
    const { u, addTask } = await setup();
    const others = await addTask({ assigneeId: u.caretaker.user.id });
    const unassigned = await addTask();
    const typed = await addTask({ assigneeName: "Aunt May" });
    const own = await addTask({ assigneeId: u.viewer.user.id });

    for (const task of [others, unassigned, typed]) {
      expect(codeOf(await taskService.complete(u.viewer.ctx, task.id))).toBe(
        "taskService:viewerCompletionOnly",
      );
      expect(codeOf(await taskService.reopen(u.viewer.ctx, task.id))).toBe(
        "taskService:viewerCompletionOnly",
      );
    }
    expect(codeOf(await taskService.update(u.viewer.ctx, own.id, { title: "Mine now" }))).toBe(
      "taskService:viewerCompletionOnly",
    );
    expect(codeOf(await taskService.update(u.viewer.ctx, own.id, { assigneeId: null }))).toBe(
      "taskService:viewerCompletionOnly",
    );
    expect(ok(await taskService.getById(u.owner.ctx, own.id))).toMatchObject({
      title: "Call the pharmacy",
      assigneeId: u.viewer.user.id,
    });
    // A writer completes a typed name's task.
    expect(ok(await taskService.complete(u.caretaker.ctx, typed.id))).toMatchObject({
      doneBy: u.caretaker.user.id,
    });
  });
});

describe("taskService: content", () => {
  it("takes a member or a typed name, never both, and the member must be in the group", async () => {
    const { u, input, addTask } = await setup();
    const both = await taskService.create(
      u.caretaker.ctx,
      input({ assigneeId: u.viewer.user.id, assigneeName: "Aunt May" }),
    );
    expect(codeOf(both)).toBe("taskService:invalid");
    expect(issuesOf(both)).toEqual(["assigneeName"]);

    const outsider = await taskService.create(u.caretaker.ctx, input({ assigneeId: u.outsider.user.id }));
    expect(codeOf(outsider)).toBe("taskService:assigneeNotMember");
    expect(issuesOf(outsider)).toEqual(["assigneeId"]);

    const typed = await addTask({ assigneeName: "  Aunt May  " });
    expect(typed).toMatchObject({ assigneeName: "Aunt May", assigneeId: null });
    // Switching to a member clears the typed name only when the patch says so.
    expect(
      codeOf(await taskService.update(u.caretaker.ctx, typed.id, { assigneeId: u.viewer.user.id })),
    ).toBe("taskService:invalid");
    expect(
      ok(
        await taskService.update(u.caretaker.ctx, typed.id, {
          assigneeId: u.viewer.user.id,
          assigneeName: null,
        }),
      ),
    ).toMatchObject({ assigneeId: u.viewer.user.id, assigneeName: null });
    expect(
      codeOf(await taskService.update(u.caretaker.ctx, typed.id, { assigneeId: u.outsider.user.id })),
    ).toBe("taskService:assigneeNotMember");
  });

  it("needs a title, and a day for a time", async () => {
    const { u, input, addTask } = await setup();
    expect(issuesOf(await taskService.create(u.caretaker.ctx, input({ title: "   " })))).toEqual(["title"]);
    expect(issuesOf(await taskService.create(u.caretaker.ctx, input({ dueTime: "17:00" })))).toEqual([
      "dueTime",
    ]);
    expect(
      issuesOf(await taskService.create(u.caretaker.ctx, input({ dueOn: "2026-12-01", dueTime: "5pm" }))),
    ).toEqual(["dueTime"]);
    const task = await addTask({ dueOn: "2026-12-01", dueTime: "17:00" });
    expect(task).toMatchObject({ dueOn: "2026-12-01", dueTime: "17:00" });
    // Clearing the day keeps the time: refused against the merged task.
    expect(issuesOf(await taskService.update(u.caretaker.ctx, task.id, { dueOn: null }))).toEqual([
      "dueTime",
    ]);
  });

  it("is idempotent on create with a device's id", async () => {
    const { u, input } = await setup();
    const id = randomUUID();
    const first = ok(await taskService.create(u.caretaker.ctx, input({ id })));
    const again = ok(await taskService.create(u.caretaker.ctx, input({ id, title: "Different" })));
    expect(again).toMatchObject({ id: first!.id, title: "Call the pharmacy" });
  });

  it("soft-deletes: hidden from reads, kept for sync, not editable", async () => {
    const { u, group, addTask } = await setup();
    const task = await addTask();
    ok(await taskService.remove(u.caretaker.ctx, task.id));
    expect(await taskService.getById(u.owner.ctx, task.id)).toBeNull();
    expect(
      ok(await taskService.getById(u.owner.ctx, task.id, { includeDeleted: true }))!.deletedAt,
    ).not.toBeNull();
    expect(ok(await taskService.list(u.owner.ctx, { groupId: group.id })).data).toEqual([]);
    expect(codeOf(await taskService.update(u.caretaker.ctx, task.id, { title: "Back" }))).toBe(
      "taskService:notFound",
    );
    expect(codeOf(await taskService.remove(u.caretaker.ctx, task.id))).toBe("taskService:notFound");
  });

  it("checks links: live, in the group, and the event an event", async () => {
    const { u, group, input, addTask } = await setup();
    const provider = ok(
      await providerService.create(u.caretaker.ctx, {
        groupId: group.id,
        type: "pharmacy",
        name: "Corner Pharmacy",
      }),
    )!;
    const event = ok(
      await timelineEntryService.create(u.caretaker.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Neurology",
        occurredAt: new Date(Date.now() + 86_400_000).toISOString(),
        timeZone: "America/Los_Angeles",
      }),
    )!;
    const note = ok(
      await timelineEntryService.create(u.caretaker.ctx, {
        groupId: group.id,
        kind: "symptom",
        details: { name: "Headache" },
        occurredAt: new Date().toISOString(),
        timeZone: "America/Los_Angeles",
      }),
    )!;
    const linked = await addTask({ providerId: provider.id, eventId: event.id });
    expect(linked).toMatchObject({ providerId: provider.id, eventId: event.id });

    expect(issuesOf(await taskService.create(u.caretaker.ctx, input({ eventId: note.id })))).toEqual([
      "eventId",
    ]);
    expect(
      issuesOf(await taskService.create(u.caretaker.ctx, input({ medicationId: randomUUID() }))),
    ).toEqual(["medicationId"]);

    // A provider deleted later stays linked; a new link to it is refused.
    ok(await providerService.remove(u.caretaker.ctx, provider.id));
    expect(ok(await taskService.update(u.caretaker.ctx, linked.id, { title: "Call them" }))).toMatchObject({
      providerId: provider.id,
    });
    expect(issuesOf(await taskService.create(u.caretaker.ctx, input({ providerId: provider.id })))).toEqual([
      "providerId",
    ]);

    // Another group's medication.
    const other = await setup();
    const med = ok(
      await medicationService.create(other.u.caretaker.ctx, {
        groupId: other.group.id,
        name: "Metformin",
        schedule: { type: "asNeeded" },
      }),
    )!;
    expect(issuesOf(await taskService.update(u.caretaker.ctx, linked.id, { medicationId: med.id }))).toEqual([
      "medicationId",
    ]);
  });
});

describe("taskService: links over time (tasks slice 3)", () => {
  const eventIn = async (ctx: Parameters<typeof timelineEntryService.create>[0], groupId: string) =>
    ok(
      await timelineEntryService.create(ctx, {
        groupId,
        kind: "event",
        title: "Cardiology follow-up",
        occurredAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        timeZone: "America/Los_Angeles",
      }),
    )!;

  it("keeps a deleted provider's and medication's link readable, and refuses a new link to a deleted event", async () => {
    const { u, group, input, addTask } = await setup();
    const provider = ok(
      await providerService.create(u.caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Lark",
      }),
    )!;
    const medication = ok(
      await medicationService.create(u.caretaker.ctx, {
        groupId: group.id,
        name: "Latanoprost",
        schedule: { type: "asNeeded" },
      }),
    )!;
    const linked = await addTask({ providerId: provider.id, medicationId: medication.id });
    ok(await providerService.remove(u.caretaker.ctx, provider.id));
    ok(await medicationService.remove(u.caretaker.ctx, medication.id));

    // Every member still reads the links; an edit that leaves them alone is fine.
    expect(ok(await taskService.getById(u.viewer.ctx, linked.id))).toMatchObject({
      providerId: provider.id,
      medicationId: medication.id,
    });
    expect(
      ok(await taskService.update(u.caretaker.ctx, linked.id, { title: "Refill at the new pharmacy" })),
    ).toMatchObject({ providerId: provider.id, medicationId: medication.id });
    // Clearing a removed link is fine too.
    expect(ok(await taskService.update(u.caretaker.ctx, linked.id, { providerId: null }))).toMatchObject({
      providerId: null,
      medicationId: medication.id,
    });

    const event = await eventIn(u.caretaker.ctx, group.id);
    ok(await timelineEntryService.remove(u.caretaker.ctx, event.id));
    expect(issuesOf(await taskService.create(u.caretaker.ctx, input({ eventId: event.id })))).toEqual([
      "eventId",
    ]);
  });

  it("drops the link when its event is deleted, open and done tasks alike, and leaves other events' tasks", async () => {
    const { u, group, addTask } = await setup();
    const event = await eventIn(u.caretaker.ctx, group.id);
    const other = await eventIn(u.caretaker.ctx, group.id);
    const open = await addTask({ title: "Bring the insurance card", eventId: event.id });
    const done = await addTask({ title: "Print the BP log", eventId: event.id });
    ok(await taskService.complete(u.caretaker.ctx, done.id));
    const elsewhere = await addTask({ title: "Ask about the stress test", eventId: other.id });

    // A viewer can't delete the event, so nothing changes.
    expect(codeOf(await timelineEntryService.remove(u.viewer.ctx, event.id))).not.toBe("ok");
    expect(ok(await taskService.getById(u.owner.ctx, open.id))).toMatchObject({ eventId: event.id });

    ok(await timelineEntryService.remove(u.caretaker.ctx, event.id));
    expect(ok(await taskService.getById(u.owner.ctx, open.id))).toMatchObject({
      eventId: null,
      title: "Bring the insurance card",
      doneAt: null,
    });
    const after = ok(await taskService.getById(u.owner.ctx, done.id));
    expect(after).toMatchObject({ eventId: null, doneBy: u.caretaker.user.id });
    expect(ok(await taskService.getById(u.owner.ctx, elsewhere.id))).toMatchObject({ eventId: other.id });
  });

  it("drops the link when the event row itself goes (the FK's ON DELETE SET NULL)", async () => {
    const { u, group, addTask } = await setup();
    const event = await eventIn(u.caretaker.ctx, group.id);
    const task = await addTask({ eventId: event.id });
    ok(
      await timelineEntryModel.purge({
        authUser: SYSTEM_USER,
        filter: { id: { type: "eq", value: event.id } },
      }),
    );
    expect(ok(await taskService.getById(u.owner.ctx, task.id))).toMatchObject({ eventId: null });
  });
});

describe("taskService: a member who goes", () => {
  it("turns their open tasks into a typed name and leaves done tasks alone", async () => {
    const { u, group, addTask } = await setup();
    const open = await addTask({ assigneeId: u.caretaker.user.id });
    const done = await addTask({ assigneeId: u.caretaker.user.id });
    ok(await taskService.complete(u.caretaker.ctx, done.id));
    const viewers = await addTask({ assigneeId: u.viewer.user.id });

    // Leaving.
    ok(await careGroupMemberService.leave(u.caretaker.ctx, group.id));
    expect(ok(await taskService.getById(u.owner.ctx, open.id))).toMatchObject({
      assigneeId: null,
      assigneeName: "caretaker",
    });
    expect(ok(await taskService.getById(u.owner.ctx, done.id))).toMatchObject({
      assigneeId: u.caretaker.user.id,
      assigneeName: null,
      doneBy: u.caretaker.user.id,
    });

    // Removed by the owner.
    const membership = ok(
      await careGroupMemberService.get(u.owner.ctx, {
        filter: { groupId: { type: "eq", value: group.id }, userId: { type: "eq", value: u.viewer.user.id } },
      }),
    )!;
    ok(await careGroupMemberService.remove(u.owner.ctx, membership.id));
    expect(ok(await taskService.getById(u.owner.ctx, viewers.id))).toMatchObject({
      assigneeId: null,
      assigneeName: "viewer",
    });
  });
});

describe("taskService: live notes", () => {
  it("makes a task's document for a live task in the group, and refuses deleted and other groups' tasks", async () => {
    const { u, group, addTask } = await setup();
    const task = await addTask();
    const doc = (id: string, groupId = group.id) => ({ id, groupId, subject: "task" as const });

    const created = ok(await noteDocumentService.create(u.caretaker.ctx, doc(task.id)));
    expect(created).toMatchObject({ id: task.id, groupId: group.id, subject: "task", taskId: task.id });
    expect(created).toMatchObject({
      entryId: null,
      providerId: null,
      medicationId: null,
      carePeriodId: null,
    });
    // Idempotent, and readable through the service.
    expect(ok(await noteDocumentService.create(u.owner.ctx, doc(task.id)))?.id).toBe(task.id);
    expect(ok(await noteDocumentService.getById(u.viewer.ctx, task.id))?.id).toBe(task.id);

    // Viewers read the notes but can't make them, even on their own task.
    const viewers = await addTask({ assigneeId: u.viewer.user.id });
    expect(codeOf(await noteDocumentService.create(u.viewer.ctx, doc(viewers.id)))).toBe(
      "permissions:unauthorized",
    );

    // A deleted task: none, and its document is hidden.
    const gone = await addTask();
    ok(await taskService.remove(u.caretaker.ctx, gone.id));
    expect(codeOf(await noteDocumentService.create(u.caretaker.ctx, doc(gone.id)))).toBe(
      "noteDocumentService:taskNotFound",
    );
    ok(await taskService.remove(u.caretaker.ctx, task.id));
    expect(codeOf(await noteDocumentService.getById(u.caretaker.ctx, task.id))).toBe(
      "noteDocumentService:notFound",
    );

    // Another group's task: unseen from here, and refused under either group.
    const other = await setup();
    const theirs = await other.addTask();
    expect(codeOf(await noteDocumentService.create(u.caretaker.ctx, doc(theirs.id)))).toBe(
      "noteDocumentService:taskNotFound",
    );
    expect(codeOf(await noteDocumentService.create(other.u.caretaker.ctx, doc(theirs.id)))).toBe(
      "noteDocumentService:immutable",
    );
  });
});
