import type { ServiceContext } from "./types";

import { describe, expect, it } from "vitest";
import { createWorld, ok, system } from "../../test/fixtures";
import { conditionChangeId, medicationChangeId, passMovedId } from "../db/schema";
import { isError } from "../errors";
import {
  medicationPassService,
  medicationService,
  providerService,
  recipientConditionService,
  timelineEntryService,
} from ".";

// A change entry's time (B-295): a device whose clock runs ahead sends a
// `changedAt` in the future. The entry keeps the id of the device's time, so
// a replay and the device's own copy still land on one row, but it is dated
// no later than the server's now. Every test builds its own group and users.

const DAY_MS = 24 * 60 * 60 * 1000;
const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

/** A device time a day ahead, as PowerSync sends it (microseconds). */
const dayAhead = () => new Date(Date.now() + DAY_MS).toISOString().replace("Z", "000Z");

const setup = async () => {
  const { u, group, recipient } = await createWorld({ members: ["caretaker", "viewer"] });
  const entries = async (kind: "medicationChange" | "conditionChange") =>
    ok(await timelineEntryService.list(u.viewer.ctx, { groupId: group.id, kinds: [kind] })).data;
  return { u, group, recipient, entries };
};

/** The entry `id` is there once, dated within this test and no later than now. */
const expectOneDatedNow = (rows: { id: string; occurredAt: string }[], id: string, since: number) => {
  const matching = rows.filter((e) => e.id === id);
  expect(matching).toHaveLength(1);
  const date = new Date(matching[0]!.occurredAt).getTime();
  expect(date).toBeGreaterThanOrEqual(since);
  expect(date).toBeLessThanOrEqual(Date.now());
};

/** The device's own copy of an entry the server wrote, as its PUT would send it. */
const deviceCopy = (
  entry: {
    id: string;
    groupId: string;
    recipientId: string;
    kind: string;
    timeZone: string;
    details: unknown;
  },
  occurredAt: string,
) => ({
  id: entry.id,
  groupId: entry.groupId,
  recipientId: entry.recipientId,
  kind: entry.kind,
  occurredAt,
  timeZone: entry.timeZone,
  title: null,
  body: null,
  details: entry.details,
});

const stopMedication = async (ctx: ServiceContext, groupId: string, changedAt: string) => {
  const medication = ok(
    await medicationService.create(ctx, {
      groupId,
      name: "Metformin",
      strength: "500 mg",
      schedule: { type: "scheduled", slots: [{ time: "09:00" }] },
    }),
  )!;
  const stop = () =>
    medicationService.update(
      ctx,
      medication.id,
      { status: "completed", stoppedOn: "2026-11-01" },
      { changedAt },
    );
  return { medication, stop };
};

describe("change entries' time", () => {
  it("dates a medication stopped a day ahead now, under the id of the device's time, once", async () => {
    const { u, group, entries } = await setup();
    const since = Date.now();
    const at = dayAhead();
    const { medication, stop } = await stopMedication(u.caretaker.ctx, group.id, at);
    ok(await stop());
    ok(await stop());

    const id = medicationChangeId(medication.id, at);
    const rows = await entries("medicationChange");
    expectOneDatedNow(rows, id, since);
    expect(rows.find((e) => e.id === id)?.details).toMatchObject({ change: "stopped" });
  });

  it("dates a pass moved a day ahead now, under the id of the device's time, once", async () => {
    const { u, group, entries } = await setup();
    const passes = ok(await medicationPassService.list(u.viewer.ctx, { groupId: group.id })).data;
    const morning = passes[0]!;
    ok(
      await medicationService.create(u.caretaker.ctx, {
        groupId: group.id,
        name: "Metformin",
        schedule: { type: "scheduled", slots: [{ passId: morning.id }] },
      }),
    );
    const since = Date.now();
    const at = dayAhead();
    const move = () =>
      medicationPassService.update(u.caretaker.ctx, morning.id, { time: "07:30" }, { changedAt: at });
    ok(await move());
    ok(await move());

    expectOneDatedNow(await entries("medicationChange"), passMovedId(morning.id, at), since);
  });

  it("dates a condition changed a day ahead now, under the id of the device's time, once", async () => {
    const { u, group, entries } = await setup();
    const condition = ok(
      await recipientConditionService.create(u.caretaker.ctx, { groupId: group.id, name: "Asthma" }),
    )!;
    const since = Date.now();
    const at = dayAhead();
    const change = () =>
      recipientConditionService.update(u.caretaker.ctx, condition.id, { sinceYear: 2019 }, { changedAt: at });
    ok(await change());
    ok(await change());

    expectOneDatedNow(await entries("conditionChange"), conditionChangeId(condition.id, at), since);
  });

  it("dates a manager unlink a day ahead now, under the id of the device's time", async () => {
    const { u, group, entries } = await setup();
    const condition = ok(
      await recipientConditionService.create(u.caretaker.ctx, { groupId: group.id, name: "Asthma" }),
    )!;
    const provider = ok(
      await providerService.create(u.caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Fern Okafor",
      }),
    )!;
    const link = ok(
      await recipientConditionService.linkManager(u.caretaker.ctx, {
        groupId: group.id,
        conditionId: condition.id,
        providerId: provider.id,
      }),
    )!;
    const since = Date.now();
    const at = dayAhead();
    ok(await recipientConditionService.unlinkManager(u.caretaker.ctx, link.id, { changedAt: at }));

    expectOneDatedNow(await entries("conditionChange"), conditionChangeId(condition.id, at), since);
  });

  it("leaves one entry, dated now, when the device's copy uploads after its save", async () => {
    const { u, group, entries } = await setup();
    const since = Date.now();
    const at = dayAhead();
    const { medication, stop } = await stopMedication(u.caretaker.ctx, group.id, at);
    ok(await stop());
    const id = medicationChangeId(medication.id, at);
    const saved = (await entries("medicationChange")).find((e) => e.id === id)!;

    const copy = ok(await timelineEntryService.upsert(u.caretaker.ctx, deviceCopy(saved, at) as never));
    expect(copy.created).toBe(false);

    expectOneDatedNow(await entries("medicationChange"), id, since);
  });

  it("leaves one entry, dated now, when the device's copy uploads before its save", async () => {
    const { u, group, recipient, entries } = await setup();
    const since = Date.now();
    const at = dayAhead();
    const { medication, stop } = await stopMedication(u.caretaker.ctx, group.id, at);
    const id = medicationChangeId(medication.id, at);
    const copy = deviceCopy(
      {
        id,
        groupId: group.id,
        recipientId: recipient.id,
        kind: "medicationChange",
        timeZone: recipient.timeZone,
        details: {
          medicationId: medication.id,
          change: "stopped",
          stopStatus: "completed",
          stopReason: null,
          stopNote: null,
        },
      },
      at,
    );

    // A member's copy can't create a system entry: refused, and the save writes it.
    expect(codeOf(await timelineEntryService.upsert(u.caretaker.ctx, copy as never))).toBe(
      "timelineEntryService:systemWrittenKind",
    );
    ok(await stop());
    expectOneDatedNow(await entries("medicationChange"), id, since);
  });

  it("dates a change entry a PUT creates no later than now", async () => {
    const { group, recipient, entries } = await setup();
    const since = Date.now();
    const at = dayAhead();
    const conditionId = "5d2c7a10-3e4b-4f6a-9b8c-1a2b3c4d5e6f";
    const id = conditionChangeId(conditionId, at);
    const created = ok(
      await timelineEntryService.upsert(system, {
        id,
        groupId: group.id,
        recipientId: recipient.id,
        kind: "conditionChange",
        occurredAt: at,
        timeZone: recipient.timeZone,
        title: null,
        body: null,
        details: { conditionId, conditionName: "Asthma", change: "resolved" },
      } as never),
    );
    expect(created.created).toBe(true);
    expectOneDatedNow(await entries("conditionChange"), id, since);
  });
});
