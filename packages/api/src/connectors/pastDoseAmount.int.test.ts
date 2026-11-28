import {
  careGroupService,
  getDb,
  medicationPassService,
  medicationService,
  SYSTEM_USER,
  timelineEntryModel,
} from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { callTool, connectAssistant, enablePasswordSignIn, mcpHandler } from "./testing";
import { addDays, dayInZone, zonedInstant } from "@caretook/data/domain";

// The usual dose a past slot had (B-985): a fictional Metformin went from
// 1 tablet to 2 this morning, so yesterday's slots are 1 tablet in both
// past_doses and what log_past_doses writes, and today's are 2. The clock is
// pinned to noon yesterday (Los Angeles, the recipient's zone), so every
// write is in the real past. All data is fictional.

const LA = "America/Los_Angeles";
const TODAY = addDays(dayInZone(new Date(), LA), -1);
const YESTERDAY = addDays(TODAY, -1);
const CLOCK = zonedInstant(TODAY, "12:00", LA);
const handler = mcpHandler({ now: () => CLOCK });

type Slot = { medicationId: string; time: string; amount: string | null };
type Days = { days: { day: string; rounds: { slots: Slot[] }[] }[] };

describe("a past slot's usual dose", { timeout: 60_000 }, () => {
  it("is the dose the medication had then, in log_past_doses and past_doses", async () => {
    const owner = await createUser("owner");
    await enablePasswordSignIn(owner.user.id);
    const { group } = await createGroup(owner, []);
    ok(
      await careGroupService.update(owner.ctx, {
        filter: { id: { type: "eq", value: group.id } },
        data: { connectorsEnabled: true },
      }),
    );
    const passes = ok(await medicationPassService.list(owner.ctx, { groupId: group.id })).data;
    const morning = passes.find((p) => p.name === "Morning")!;
    const evening = passes.find((p) => p.name === "Evening")!;
    const added = zonedInstant(addDays(TODAY, -10), "09:00", LA).toISOString();
    const metformin = ok(
      await medicationService.create(
        owner.ctx,
        {
          groupId: group.id,
          name: "Metformin",
          strength: "500 mg",
          dose: "1 tablet",
          schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
        } as never,
        { changedAt: added },
      ),
    )!;
    await getDb().$client.query(`UPDATE medication SET created_at = $1 WHERE id = $2`, [added, metformin.id]);
    // 1 tablet to 2 at 07:00 today, before today's first slot.
    ok(
      await medicationService.update(
        owner.ctx,
        metformin.id,
        { dose: "2 tablets" },
        {
          changedAt: zonedInstant(TODAY, "07:00", LA).toISOString(),
        },
      ),
    );

    const token = (
      await connectAssistant({
        email: owner.user.email,
        groupId: group.id,
        scope: "readWrite",
        clientName: "Test Claude",
      })
    ).tokens.access_token;

    const logged = await callTool(handler, token, "log_past_doses", {
      marks: [{ medicationId: metformin.id, day: YESTERDAY, time: "08:00", status: "given" }],
    });
    expect(logged.isError).toBeUndefined();
    const entryId = (logged.structuredContent as { results: { outcome: string; entryId: string }[] })
      .results[0]!;
    expect(entryId.outcome).toBe("add");
    const dose = ok(
      await timelineEntryModel.getById(entryId.entryId, { authUser: SYSTEM_USER, includeDeleted: true }),
    )!;
    expect(dose.details).toMatchObject({ medicationId: metformin.id, amount: "1 tablet" });

    const record = await callTool(handler, token, "past_doses", { from: YESTERDAY, days: 2 });
    expect(record.isError).toBeUndefined();
    const amounts = (record.structuredContent as unknown as Days).days.map(({ day, rounds }) => [
      day,
      rounds.flatMap((r) => r.slots).map((s) => [s.time, s.amount]),
    ]);
    expect(amounts).toEqual([
      [
        YESTERDAY,
        [
          ["08:00", "1 tablet"],
          ["20:00", "1 tablet"],
        ],
      ],
      [
        TODAY,
        [
          ["08:00", "2 tablets"],
          ["20:00", "2 tablets"],
        ],
      ],
    ]);
  });
});
