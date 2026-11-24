import type { World } from "../../test/fixtures";
import type { AppError } from "../errors";
import type { ServiceContext, Upserted } from "./types";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createWorld, ok } from "../../test/fixtures";
import { getDb } from "../db";
import { timelineEntrySchema } from "../db/schema";
import { isError } from "../errors";
import {
  appointmentSeriesService,
  careGroupMemberService,
  carePeriodService,
  medicationPassService,
  medicationService,
  providerService,
  recipientAllergyService,
  recipientConditionService,
  timelineEntryService,
  todoService,
} from ".";

// A PowerSync PUT is a create, replayed at most (B-288): every soft-delete
// service's `upsert` creates the row when there is none and otherwise
// changes nothing, so a resent create never reverts a newer edit. One case
// per service, the same three checks each.

type Row = { id: string } & Record<string, unknown>;

type Case = {
  name: string;
  /** The device's create, with `value` in the content field. */
  input: (w: World, id: string, value: string) => Record<string, unknown>;
  /** The content field a replay tries to change. */
  field: string;
  upsert: (ctx: ServiceContext, input: Record<string, unknown>) => Promise<AppError | Upserted<unknown>>;
  update: (ctx: ServiceContext, id: string, patch: Record<string, unknown>) => Promise<unknown>;
  getById: (ctx: ServiceContext, id: string) => Promise<unknown>;
};

const group = (w: World) => ({ groupId: w.group.id, recipientId: w.recipient.id });
const AT = "2026-11-17T12:00:00.000Z";

/** Each service with its own input types, seen through one shape. */
const loose = <S>(service: S) => service as unknown as Pick<Case, "upsert" | "update" | "getById">;

const CASES: Case[] = [
  {
    name: "timelineEntryService",
    ...loose(timelineEntryService),
    field: "title",
    input: (w, id, title) => ({
      ...group(w),
      id,
      kind: "note",
      title,
      occurredAt: AT,
      timeZone: "America/Los_Angeles",
    }),
  },
  {
    name: "providerService",
    ...loose(providerService),
    field: "name",
    input: (w, id, name) => ({ groupId: w.group.id, id, type: "clinician", name }),
  },
  {
    name: "medicationService",
    ...loose(medicationService),
    field: "strength",
    input: (w, id, strength) => ({
      ...group(w),
      id,
      name: "Lisinopril",
      strength,
      schedule: { type: "scheduled", times: ["08:00"] },
    }),
  },
  {
    name: "medicationPassService",
    ...loose(medicationPassService),
    field: "name",
    input: (w, id, name) => ({ ...group(w), id, name, time: "21:30", sortOrder: 9 }),
  },
  {
    name: "recipientAllergyService",
    ...loose(recipientAllergyService),
    field: "reaction",
    input: (w, id, reaction) => ({ ...group(w), id, substance: "Penicillin", reaction }),
  },
  {
    name: "recipientConditionService",
    ...loose(recipientConditionService),
    field: "note",
    input: (w, id, note) => ({ ...group(w), id, name: "Gout", note }),
  },
  {
    name: "carePeriodService",
    ...loose(carePeriodService),
    field: "label",
    input: (w, id, label) => ({ ...group(w), id, type: "hospital", label, startedAt: AT }),
  },
  {
    name: "todoService",
    ...loose(todoService),
    field: "title",
    input: (w, id, title) => ({ ...group(w), id, title, dueOn: "2026-11-21" }),
  },
  {
    name: "appointmentSeriesService",
    ...loose(appointmentSeriesService),
    field: "title",
    input: (w, id, title) => ({
      ...group(w),
      id,
      kind: "event",
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      startsOn: "2026-11-23",
      startTime: "06:00",
      timeZone: "America/Los_Angeles",
      title,
      durationMinutes: 60,
      toppedUpThrough: "2027-02-22",
    }),
  },
];

describe.each(CASES)("$name.upsert: a replay changes nothing (B-288)", (c) => {
  const stored = async (w: World, id: string) => ok(await c.getById(w.u.owner.ctx, id)) as Row | null;

  it("keeps the first content when the same id comes again with other content", async () => {
    const w = await createWorld();
    const id = randomUUID();
    expect(ok(await c.upsert(w.u.caretaker.ctx, c.input(w, id, "First")))).toMatchObject({
      created: true,
      row: { id, [c.field]: "First" },
    });
    expect(ok(await c.upsert(w.u.caretaker.ctx, c.input(w, id, "Second")))).toMatchObject({
      created: false,
      row: { id, [c.field]: "First" },
    });
    expect((await stored(w, id))?.[c.field]).toBe("First");
  });

  it("leaves another member's later edit in place", async () => {
    const w = await createWorld();
    const id = randomUUID();
    ok(await c.upsert(w.u.caretaker.ctx, c.input(w, id, "Original")));
    const edit = await c.update(w.u.admin.ctx, id, { [c.field]: "Edited" });
    expect(isError(edit) ? edit.code : "ok").toBe("ok");

    ok(await c.upsert(w.u.caretaker.ctx, c.input(w, id, "Original")));
    expect(await stored(w, id)).toMatchObject({ [c.field]: "Edited", updatedBy: w.u.admin.user.id });
  });

  it("refuses a changed group, and changes nothing for a member since made a viewer", async () => {
    const w = await createWorld();
    const id = randomUUID();
    ok(await c.upsert(w.u.caretaker.ctx, c.input(w, id, "Original")));

    const { group: other } = await createGroup(w.u.caretaker);
    const moved = await c.upsert(w.u.caretaker.ctx, { ...c.input(w, id, "Original"), groupId: other.id });
    expect(isError(moved) ? moved.code : "ok").toBe(`${c.name}:immutable`);

    const membership = await w.membershipOf(w.u.caretaker);
    ok(await careGroupMemberService.updateRole(w.u.owner.ctx, { id: membership.id, role: "viewer" }));
    expect(ok(await c.upsert(w.u.caretaker.ctx, c.input(w, id, "Replayed")))).toMatchObject({
      created: false,
    });
    expect((await stored(w, id))?.[c.field]).toBe("Original");
  });
});

describe("medicationService.upsert: change entries", () => {
  it("writes no second change entry on a replay, and leaves the first as it was", async () => {
    const w = await createWorld();
    const id = randomUUID();
    const input = CASES.find((c) => c.name === "medicationService")!.input;
    const changes = () =>
      getDb()
        .select()
        .from(timelineEntrySchema)
        .where(
          and(eq(timelineEntrySchema.groupId, w.group.id), eq(timelineEntrySchema.kind, "medicationChange")),
        );

    ok(
      await medicationService.upsert(w.u.caretaker.ctx, input(w, id, "10 mg") as never, {
        changedAt: "2026-11-17T21:45:25.229000Z",
      }),
    );
    const [first, ...rest] = await changes();
    expect(rest).toEqual([]);

    ok(
      await medicationService.upsert(w.u.caretaker.ctx, input(w, id, "20 mg") as never, {
        changedAt: "2026-11-18T08:00:00.000000Z",
      }),
    );
    expect(await changes()).toEqual([first]);
  });
});
