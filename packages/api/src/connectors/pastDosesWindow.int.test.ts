import { careGroupService, getDb, medicationService, timelineEntryModel } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { callTool, connectAssistant, enablePasswordSignIn, mcpHandler } from "./testing";

// past_doses reads only its window (B-982): a busy group's recent doses never
// crowd out an old day's, and a window too busy to read whole says so rather
// than showing unread doses as missed. All data is fictional.

// 12:00 in Los Angeles (PDT), the group's zone: today is Wednesday 2030-06-12.
const clock = new Date("2030-06-12T19:00:00.000Z");
const DAY = 24 * 60 * 60_000;

type Slot = { state: string; dose: { entryId: string } | null };
type PastRecord = { days: { day: string; rounds: { name: string; slots: Slot[] }[] }[] };

const world = async () => {
  const caretaker = await createUser("caretaker");
  await enablePasswordSignIn(caretaker.user.id);
  const { group, recipient } = await createGroup(caretaker);
  ok(
    await careGroupService.update(caretaker.ctx, {
      filter: { id: { type: "eq", value: group.id } },
      data: { connectorsEnabled: true },
    }),
  );
  const medication = ok(
    await medicationService.create(
      caretaker.ctx,
      {
        groupId: group.id,
        name: "Lisinopril",
        strength: "10 mg",
        form: "tablet",
        dose: "1 tablet",
        schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
      } as never,
      { changedAt: new Date(clock.getTime() - 100 * DAY).toISOString() },
    ),
  )!;
  const token = (await connectAssistant({ email: caretaker.user.email, groupId: group.id, scope: "read" }))
    .tokens.access_token;
  /** Doses every `step` from `start` to `end` (exclusive), in one insert, as an as-needed log would add. */
  const addDoses = (start: string, end: string, step: string) =>
    getDb().$client.query(
      `INSERT INTO timeline_entry (group_id, recipient_id, kind, occurred_at, time_zone, details, created_by, updated_by)
       SELECT $1, $2, 'dose', at, 'America/Los_Angeles',
              jsonb_build_object('medicationId', $3::text, 'status', 'given', 'amount', '1 tablet'), $4, $4
       FROM generate_series($5::timestamptz, $6::timestamptz - interval '1 millisecond', $7::interval) AS at`,
      [group.id, recipient.id, medication.id, caretaker.user.id, start, end, step],
    );
  const addDose = async (occurredAt: string) =>
    ok(
      await timelineEntryModel.create({
        ...caretaker.ctx,
        data: {
          groupId: group.id,
          recipientId: recipient.id,
          kind: "dose",
          occurredAt,
          timeZone: "America/Los_Angeles",
          details: {
            medicationId: medication.id,
            status: "given",
            amount: "1 tablet",
            scheduledFor: "08:00",
          },
        },
      }),
    )!;
  return { token, addDoses, addDose };
};

describe("past_doses: the read window", { timeout: 120_000 }, () => {
  it("a day 90 days back shows its given dose, however many doses came after it", async () => {
    const handler = mcpHandler({ now: () => clock });
    const w = await world();
    // 2030-03-14 is 90 days before today; its 08:00 dose was given at 08:10.
    const old = await w.addDose("2030-03-14T08:10:00-07:00");
    // Then one an hour, every hour from the next day to now: past 40 pages of 50.
    await w.addDoses("2030-03-15T07:00:00Z", clock.toISOString(), "1 hour");

    const result = await callTool(handler, w.token, "past_doses", { from: "2030-03-14", days: 1 });
    expect(result.isError).toBeUndefined();
    const slot = (result.structuredContent as PastRecord).days[0]!.rounds[0]!.slots[0]!;
    expect(slot.state).toBe("given");
    expect(slot.dose?.entryId).toBe(old.id);
  });

  it("a window too busy to read whole is refused, not shown with doses missed", async () => {
    const handler = mcpHandler({ now: () => clock });
    const w = await world();
    // One every 5 minutes: 288 a day, past 40 pages of 50 in a week.
    await w.addDoses("2030-06-05T07:00:00Z", "2030-06-12T07:00:00Z", "5 minutes");

    const result = await callTool(handler, w.token, "past_doses", { from: "2030-06-05", days: 7 });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { issues: [{ path: "days", message: expect.stringContaining("fewer days") as unknown }] },
    });
    // A single day of it reads whole.
    const one = await callTool(handler, w.token, "past_doses", { from: "2030-06-05", days: 1 });
    expect(one.isError).toBeUndefined();
  });
});
