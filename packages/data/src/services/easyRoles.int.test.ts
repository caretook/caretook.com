import type { TimelineEntryCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createUser, createWorld, newYDoc, ok, system, typeParagraph } from "../../test/fixtures";
import { userService } from ".";
import { isError } from "../errors";
import { careGroupMemberModel, timelineEntryModel } from "../models";
import {
  careGroupInviteService,
  careGroupMemberService,
  carePeriodService,
  joinRequestService,
  medicationPassService,
  medicationService,
  noteDocumentService,
  providerService,
  recipientAllergyService,
  timelineEntryService,
  todoService,
} from ".";

// The easy roles (easy roles PRD, slice 2): an Easy helper logs care and
// changes only their own entries; an Easy viewer reads and ticks their own
// todos. Every role against every care table, in SQL through the services.
// Each test builds its own group and users.

const ROLES = ["owner", "admin", "caretaker", "viewer", "easy_helper", "easy_viewer"] as const;
type Role = (typeof ROLES)[number];
const WRITERS: readonly Role[] = ["owner", "admin", "caretaker"];
const LOGGERS: readonly Role[] = [...WRITERS, "easy_helper"];

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const AT = "2026-11-17T12:00:00.000Z";
const ZONE = "America/Los_Angeles";

const setup = async () => {
  const { u, group, recipient } = await createWorld({
    members: ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
    names: { easy_helper: "easy-helper", easy_viewer: "easy-viewer" },
  });
  const note = (overrides: Partial<TimelineEntryCreateInput> = {}) =>
    ({
      groupId: group.id,
      kind: "note",
      title: "Ate lunch",
      occurredAt: AT,
      timeZone: ZONE,
      ...overrides,
    }) as TimelineEntryCreateInput;
  const addNote = async (by: Role = "caretaker", overrides: Partial<TimelineEntryCreateInput> = {}) => {
    const entry = ok(await timelineEntryService.create(u[by].ctx, note(overrides)));
    if (!entry) throw new Error("entry not readable");
    return entry;
  };
  const medication = ok(
    await medicationService.create(u.owner.ctx, {
      groupId: group.id,
      name: "Lisinopril",
      dose: "1 tablet",
      type: "prescription",
      schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
    }),
  );
  if (!medication) throw new Error("medication not readable");
  return { u, group, recipient, note, addNote, medication };
};

type World = Awaited<ReturnType<typeof setup>>;

/** One care table's create, update and delete, each as `role`, on fresh rows made by the owner. */
type TableProbe = {
  create: (w: World, role: Role) => Promise<unknown>;
  update: (w: World, role: Role) => Promise<unknown>;
  remove: (w: World, role: Role) => Promise<unknown>;
  read: (w: World, role: Role) => Promise<unknown>;
};

const made = <T>(row: T | null | undefined) => {
  if (!row) throw new Error("not readable");
  return row;
};

const PROBES: Record<string, TableProbe> = {
  medication: {
    create: (w, role) =>
      medicationService.create(w.u[role].ctx, {
        groupId: w.group.id,
        name: `By ${role}`,
        type: "otc",
        schedule: { type: "asNeeded" },
      }),
    update: async (w, role) =>
      medicationService.update(w.u[role].ctx, w.medication.id, { dose: "2 tablets" }),
    remove: async (w, role) => {
      const m = made(
        ok(
          await medicationService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            name: "Gone",
            type: "otc",
            schedule: { type: "asNeeded" },
          }),
        ),
      );
      return medicationService.remove(w.u[role].ctx, m.id);
    },
    read: (w, role) => medicationService.getById(w.u[role].ctx, w.medication.id),
  },
  provider: {
    create: (w, role) =>
      providerService.create(w.u[role].ctx, { groupId: w.group.id, type: "clinician", name: `Dr. ${role}` }),
    update: async (w, role) => {
      const p = made(
        ok(
          await providerService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            type: "clinician",
            name: "Dr. A",
          }),
        ),
      );
      return providerService.update(w.u[role].ctx, p.id, { name: "Dr. B" });
    },
    remove: async (w, role) => {
      const p = made(
        ok(
          await providerService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            type: "clinician",
            name: "Dr. C",
          }),
        ),
      );
      return providerService.remove(w.u[role].ctx, p.id);
    },
    read: async (w, role) => {
      const p = made(
        ok(
          await providerService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            type: "clinician",
            name: "Dr. D",
          }),
        ),
      );
      return providerService.getById(w.u[role].ctx, p.id);
    },
  },
  care_period: {
    create: (w, role) =>
      carePeriodService.create(w.u[role].ctx, {
        groupId: w.group.id,
        type: "hospital",
        label: `By ${role}`,
        startedAt: "2026-11-15T08:00:00.000Z",
      }),
    update: async (w, role) => {
      const p = made(
        ok(
          await carePeriodService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            type: "hospital",
            label: "Mercy General",
            startedAt: "2026-11-15T08:00:00.000Z",
          }),
        ),
      );
      return carePeriodService.update(w.u[role].ctx, p.id, { label: "Elsewhere" });
    },
    remove: async (w, role) => {
      const p = made(
        ok(
          await carePeriodService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            type: "hospital",
            label: "Mercy General",
            startedAt: "2026-11-15T08:00:00.000Z",
          }),
        ),
      );
      return carePeriodService.remove(w.u[role].ctx, p.id);
    },
    read: async (w, role) => {
      const p = made(
        ok(
          await carePeriodService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            type: "rehab",
            label: "Sunrise",
            startedAt: "2026-11-15T08:00:00.000Z",
          }),
        ),
      );
      return carePeriodService.getById(w.u[role].ctx, p.id);
    },
  },
  recipient_allergy: {
    create: (w, role) =>
      recipientAllergyService.create(w.u[role].ctx, { groupId: w.group.id, substance: `Sulfa ${role}` }),
    update: async (w, role) => {
      const a = made(
        ok(await recipientAllergyService.create(w.u.owner.ctx, { groupId: w.group.id, substance: "Latex" })),
      );
      return recipientAllergyService.update(w.u[role].ctx, a.id, { reaction: "Rash" });
    },
    remove: async (w, role) => {
      const a = made(
        ok(await recipientAllergyService.create(w.u.owner.ctx, { groupId: w.group.id, substance: "Pollen" })),
      );
      return recipientAllergyService.remove(w.u[role].ctx, a.id);
    },
    read: async (w, role) => {
      const a = made(
        ok(
          await recipientAllergyService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            substance: `Dust ${role}`,
          }),
        ),
      );
      return recipientAllergyService.getById(w.u[role].ctx, a.id);
    },
  },
  medication_pass: {
    create: (w, role) =>
      medicationPassService.create(w.u[role].ctx, {
        groupId: w.group.id,
        name: `Noon ${role}`,
        time: "12:00",
      }),
    update: async (w, role) => {
      const [morning] = ok(await medicationPassService.list(w.u.owner.ctx, { groupId: w.group.id })).data;
      return medicationPassService.update(w.u[role].ctx, made(morning).id, { time: "08:30" });
    },
    remove: async (w, role) => {
      const [, evening] = ok(await medicationPassService.list(w.u.owner.ctx, { groupId: w.group.id })).data;
      return medicationPassService.remove(w.u[role].ctx, made(evening).id);
    },
    read: async (w, role) =>
      ok(await medicationPassService.list(w.u[role].ctx, { groupId: w.group.id })).data[0] ?? null,
  },
  todo: {
    create: (w, role) => todoService.create(w.u[role].ctx, { groupId: w.group.id, title: `By ${role}` }),
    update: async (w, role) => {
      // Assigned to them, so only the content change is refused.
      const t = made(
        ok(
          await todoService.create(w.u.owner.ctx, {
            groupId: w.group.id,
            title: "Call",
            assigneeId: w.u[role].user.id,
          }),
        ),
      );
      return todoService.update(w.u[role].ctx, t.id, { title: "Called" });
    },
    remove: async (w, role) => {
      const t = made(ok(await todoService.create(w.u.owner.ctx, { groupId: w.group.id, title: "Bins" })));
      return todoService.remove(w.u[role].ctx, t.id);
    },
    read: async (w, role) => {
      const t = made(ok(await todoService.create(w.u.owner.ctx, { groupId: w.group.id, title: "Read me" })));
      return todoService.getById(w.u[role].ctx, t.id);
    },
  },
  timeline_entry: {
    create: (w, role) => timelineEntryService.create(w.u[role].ctx, w.note({ title: `By ${role}` })),
    // Someone else's entry (the owner's): writers only.
    update: async (w, role) => {
      const e = await w.addNote("owner");
      return timelineEntryService.update(w.u[role].ctx, e.id, { title: "Edited" });
    },
    remove: async (w, role) => {
      const e = await w.addNote("owner");
      return timelineEntryService.remove(w.u[role].ctx, e.id);
    },
    read: async (w, role) => timelineEntryService.getById(w.u[role].ctx, (await w.addNote("owner")).id),
  },
};

describe("the role matrix: every role against every care table", () => {
  for (const [table, probe] of Object.entries(PROBES))
    it(`${table}: everyone reads; writers write${table === "timeline_entry" ? " (an Easy helper adds)" : ""}`, async () => {
      const w = await setup();
      const creaters = table === "timeline_entry" ? LOGGERS : WRITERS;
      for (const role of ROLES) {
        const read = await probe.read(w, role);
        expect({ role, read: !isError(read) && read !== null }).toEqual({ role, read: true });
        expect({ role, create: codeOf(await probe.create(w, role)) === "ok" }).toEqual({
          role,
          create: creaters.includes(role),
        });
        expect({ role, update: codeOf(await probe.update(w, role)) === "ok" }).toEqual({
          role,
          update: WRITERS.includes(role),
        });
        expect({ role, remove: codeOf(await probe.remove(w, role)) === "ok" }).toEqual({
          role,
          remove: WRITERS.includes(role),
        });
      }
    });
});

describe("an Easy helper's own entries", () => {
  it("edits and deletes their own entry, and is refused on another member's", async () => {
    const w = await setup();
    const mine = await w.addNote("easy_helper");
    const theirs = await w.addNote("caretaker");
    const helper = w.u.easy_helper.ctx;

    expect(
      ok(await timelineEntryService.update(helper, mine.id, { title: "Ate a late lunch" })),
    ).toMatchObject({
      title: "Ate a late lunch",
    });
    expect(codeOf(await timelineEntryService.update(helper, theirs.id, { title: "No" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await timelineEntryService.remove(helper, theirs.id))).toBe("permissions:unauthorized");
    ok(await timelineEntryService.remove(helper, mine.id));
    expect(await timelineEntryService.getById(helper, mine.id)).toBeNull();
    expect(await timelineEntryService.getById(helper, theirs.id)).toMatchObject({ title: "Ate lunch" });
  });

  it("is limited in SQL: the model's own update and delete scope leaves another member's row alone", async () => {
    const w = await setup();
    const mine = await w.addNote("easy_helper");
    const theirs = await w.addNote("caretaker");
    const args = { authUser: w.u.easy_helper.ctx.authUser };
    const byId = (id: string) => ({ id: { type: "eq" as const, value: id } });

    expect(
      codeOf(await timelineEntryModel.update({ ...args, filter: byId(theirs.id), data: { title: "x" } })),
    ).toBe("baseModel:update:nothingUpdated");
    expect(codeOf(await timelineEntryModel.remove({ ...args, filter: byId(theirs.id) }))).toBe(
      "baseModel:remove:nothingRemoved",
    );
    ok(await timelineEntryModel.update({ ...args, filter: byId(mine.id), data: { title: "Mine" } }));
    expect(await timelineEntryModel.mayChange(mine.id, "delete", args)).toBe(true);
    expect(await timelineEntryModel.mayChange(theirs.id, "delete", args)).toBe(false);
    // An Easy viewer changes nothing, not even an entry with their id on it.
    expect(
      await timelineEntryModel.mayChange(mine.id, "update", { authUser: w.u.easy_viewer.ctx.authUser }),
    ).toBe(false);
  });

  it("logs notes, events, symptoms and vitals, but no system-written kind or appointment setup", async () => {
    const w = await setup();
    const helper = w.u.easy_helper.ctx;
    for (const input of [
      w.note(),
      w.note({ kind: "event", title: "Walked to the park" }),
      w.note({ kind: "symptom", title: null, details: { name: "Pain", severity: 3 } }),
      w.note({ kind: "vital", title: null, details: { readings: [{ type: "heartRate", value: 72 }] } }),
    ])
      expect(codeOf(await timelineEntryService.create(helper, input))).toBe("ok");

    expect(
      codeOf(
        await timelineEntryService.create(
          helper,
          w.note({ kind: "event", title: "Dentist", cancelledAt: AT }),
        ),
      ),
    ).toBe("timelineEntryService:loggerOnly");
    const event = ok(await timelineEntryService.create(helper, w.note({ kind: "event", title: "Visit" })));
    expect(codeOf(await timelineEntryService.update(helper, event!.id, { cancelledAt: AT }))).toBe(
      "timelineEntryService:loggerOnly",
    );
  });

  it("can't clear a writer's cancellation or reschedule of their own event, but still edits it", async () => {
    const w = await setup();
    const helper = w.u.easy_helper.ctx;
    const event = ok(await timelineEntryService.create(helper, w.note({ kind: "event", title: "Dentist" })))!;
    const later = await w.addNote("caretaker", { kind: "event", title: "Dentist, again" });
    ok(
      await timelineEntryService.update(w.u.caretaker.ctx, event.id, {
        cancelledAt: AT,
        cancelReason: "Office closed",
        rescheduledTo: later.id,
      }),
    );

    for (const patch of [
      { cancelledAt: null, cancelReason: null, rescheduledTo: null },
      { rescheduledTo: null },
      { cancelReason: null },
    ])
      expect(codeOf(await timelineEntryService.update(helper, event.id, patch))).toBe(
        "timelineEntryService:loggerOnly",
      );
    ok(
      await timelineEntryService.update(helper, event.id, {
        title: "Dentist visit",
        place: "Main St clinic",
      }),
    );
    const after = ok(await timelineEntryService.getById(helper, event.id))!;
    expect(new Date(String(after.cancelledAt)).toISOString()).toBe(AT);
    expect(after).toMatchObject({
      title: "Dentist visit",
      place: "Main St clinic",
      cancelReason: "Office closed",
      rescheduledTo: later.id,
    });
  });

  it("logs a dose and a pass (Given all), and undoes them", async () => {
    const w = await setup();
    const helper = w.u.easy_helper.ctx;
    const [morning] = ok(await medicationPassService.list(helper, { groupId: w.group.id })).data;
    const passLogId = randomUUID();
    const dose = (details: Record<string, unknown>) =>
      timelineEntryService.create(
        helper,
        w.note({
          kind: "dose",
          title: null,
          details: { medicationId: w.medication.id, status: "given", ...details },
        }),
      );
    const single = made(ok(await dose({ amount: "1 tablet" })));
    const pass = made(ok(await dose({ passId: made(morning).id, passLogId, scheduledFor: "08:00" })));
    expect(pass).toMatchObject({ kind: "dose", createdBy: w.u.easy_helper.user.id });

    ok(await timelineEntryService.remove(helper, single.id));
    ok(await timelineEntryService.remove(helper, pass.id));
    expect(await timelineEntryService.getById(helper, pass.id)).toBeNull();
  });

  it("writes the live notes of their own entries only, never another's or a provider's", async () => {
    const w = await setup();
    const helper = w.u.easy_helper.ctx;
    const mine = await w.addNote("easy_helper");
    const theirs = await w.addNote("caretaker");
    const doc = { groupId: w.group.id, subject: "entry" as const };

    ok(await noteDocumentService.create(helper, { ...doc, id: mine.id }));
    const update = (documentId: string) =>
      noteDocumentService.appendUpdate(helper, {
        id: randomUUID(),
        groupId: w.group.id,
        documentId,
        data: typeParagraph(newYDoc(), "Slept well"),
      });
    expect(codeOf(await update(mine.id))).toBe("ok");

    expect(codeOf(await noteDocumentService.create(helper, { ...doc, id: theirs.id }))).toBe(
      "permissions:unauthorized",
    );
    ok(await noteDocumentService.create(w.u.caretaker.ctx, { ...doc, id: theirs.id }));
    expect(codeOf(await update(theirs.id))).toBe("permissions:unauthorized");

    const provider = made(
      ok(
        await providerService.create(w.u.owner.ctx, {
          groupId: w.group.id,
          type: "clinician",
          name: "Dr. E",
        }),
      ),
    );
    expect(
      codeOf(
        await noteDocumentService.create(helper, {
          id: provider.id,
          groupId: w.group.id,
          subject: "provider",
        }),
      ),
    ).toBe("permissions:unauthorized");

    // An Easy viewer writes no notes at all.
    expect(
      codeOf(
        await noteDocumentService.appendUpdate(w.u.easy_viewer.ctx, {
          id: randomUUID(),
          groupId: w.group.id,
          documentId: mine.id,
          data: typeParagraph(newYDoc(), "No"),
        }),
      ),
    ).toBe("permissions:unauthorized");
  });
});

describe("todo completion by role", () => {
  const todoFor = async (w: World, assignee: Role | null) =>
    made(
      ok(
        await todoService.create(w.u.owner.ctx, {
          groupId: w.group.id,
          title: `For ${assignee ?? "nobody"}`,
          ...(assignee ? { assigneeId: w.u[assignee].user.id } : {}),
        }),
      ),
    );

  for (const role of ["easy_helper", "easy_viewer"] as const)
    it(`lets an ${role} tick and untick only a todo assigned to them, and edit none`, async () => {
      const w = await setup();
      const ctx = w.u[role].ctx;
      const own = await todoFor(w, role);
      expect(ok(await todoService.complete(ctx, own.id))).toMatchObject({ doneBy: w.u[role].user.id });
      expect(ok(await todoService.reopen(ctx, own.id))).toMatchObject({ doneAt: null });

      for (const other of [await todoFor(w, "caretaker"), await todoFor(w, null)]) {
        expect(codeOf(await todoService.complete(ctx, other.id))).toBe("todoService:completionOnly");
        expect(codeOf(await todoService.reopen(ctx, other.id))).toBe("todoService:completionOnly");
      }
      expect(codeOf(await todoService.update(ctx, own.id, { title: "Mine now" }))).toBe(
        "todoService:completionOnly",
      );
      expect(codeOf(await todoService.create(ctx, { groupId: w.group.id, title: "New" }))).toBe(
        "permissions:unauthorized",
      );
    });

  it("keeps a viewer's rule: their own todo, with the viewer's error otherwise", async () => {
    const w = await setup();
    const own = await todoFor(w, "viewer");
    ok(await todoService.complete(w.u.viewer.ctx, own.id));
    expect(codeOf(await todoService.complete(w.u.viewer.ctx, (await todoFor(w, "caretaker")).id))).toBe(
      "todoService:completionOnly",
    );
  });
});

describe("an Easy viewer", () => {
  it("is refused every write but ticking their own todo", async () => {
    const w = await setup();
    const ctx = w.u.easy_viewer.ctx;
    expect(codeOf(await timelineEntryService.create(ctx, w.note()))).toBe("permissions:unauthorized");
    const mine = await w.addNote("caretaker");
    expect(codeOf(await timelineEntryService.update(ctx, mine.id, { title: "x" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await timelineEntryService.remove(ctx, mine.id))).toBe("permissions:unauthorized");
  });
});

describe("assigning the easy roles", () => {
  const membershipOf = async (groupId: string, userId: string) =>
    made(
      ok(
        await careGroupMemberModel.get({
          ...system,
          filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
        }),
      ),
    );

  it("takes them on email invites, links and join approvals, from managers only", async () => {
    const w = await setup();
    for (const role of ["easy_helper", "easy_viewer"] as const) {
      const email = `${role}-${randomUUID().slice(0, 8)}@example.com`;
      const { token } = ok(
        await careGroupInviteService.createEmail(w.u.admin.ctx, {
          groupId: w.group.id,
          email,
          role,
          attested: true,
        }),
      );
      const joiner = made(ok(await userService.create(system, { email, name: "Joiner" })));
      ok(
        await careGroupInviteService.accept(
          { authUser: { id: joiner.id, roleNames: joiner.roleNames } },
          { token, consent: true, legal: true },
        ),
      );
      expect(await careGroupMemberModel.getRole(w.group.id, joiner.id)).toBe(role);

      const link = ok(
        await careGroupInviteService.createLink(w.u.owner.ctx, {
          groupId: w.group.id,
          role,
          expiresInDays: 7,
        }),
      );
      const asker = await createUser("asker");
      const asked = ok(
        await careGroupInviteService.accept(asker.ctx, { token: link.token, consent: true, legal: true }),
      );
      if (asked.status !== "requested") throw new Error("expected a request");
      ok(await joinRequestService.approve(w.u.admin.ctx, asked.requestId));
      expect(await careGroupMemberModel.getRole(w.group.id, asker.user.id)).toBe(role);
    }
    for (const role of ["caretaker", "easy_helper"] as const)
      expect(
        codeOf(
          await careGroupInviteService.createEmail(w.u[role].ctx, {
            groupId: w.group.id,
            email: `nope-${randomUUID().slice(0, 8)}@example.com`,
            role: "easy_viewer",
            attested: true,
          }),
        ),
      ).not.toBe("ok");
  });

  it("lets managers change a member to an easy role and back; only owners touch an owner", async () => {
    const w = await setup();
    const caretaker = await membershipOf(w.group.id, w.u.caretaker.user.id);
    ok(await careGroupMemberService.updateRole(w.u.admin.ctx, { id: caretaker.id, role: "easy_helper" }));
    expect(await careGroupMemberModel.getRole(w.group.id, w.u.caretaker.user.id)).toBe("easy_helper");
    ok(await careGroupMemberService.updateRole(w.u.owner.ctx, { id: caretaker.id, role: "caretaker" }));

    const viewer = await membershipOf(w.group.id, w.u.viewer.user.id);
    for (const role of ["caretaker", "easy_helper", "easy_viewer"] as const)
      expect(
        codeOf(
          await careGroupMemberService.updateRole(w.u[role].ctx, { id: viewer.id, role: "easy_viewer" }),
        ),
      ).not.toBe("ok");

    const owner = await membershipOf(w.group.id, w.u.owner.user.id);
    expect(
      codeOf(
        await careGroupMemberService.updateRole(w.u.admin.ctx, {
          id: owner.id,
          role: "easy_helper",
        }),
      ),
    ).not.toBe("ok");
  });
});
