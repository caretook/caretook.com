import { beforeAll, describe, expect, it } from "vitest";
import { createWorld, ok } from "../../test/fixtures";
import { getDb } from "../db";
import { assistantActionService, medicationPassService, medicationService } from ".";
import { addDays } from "../domain/core/entryTiming";
import { dayInZone, zonedInstant } from "../domain/core/zonedDay";

// B-986: a sheet's marks and Given all reach every medication in the group,
// not only the first page of a list read (pages stop at 100). A fictional
// group with 101 medications, added 20 days before a clock pinned to noon
// yesterday (Los Angeles, the recipient's zone). All data is fictional.

const LA = "America/Los_Angeles";
const TODAY = addDays(dayInZone(new Date(), LA), -1);
const CLOCK = zonedInstant(TODAY, "12:00", LA);

const world = async () => {
  const { u, group } = await createWorld();
  const morning = ok(await medicationPassService.list(u.owner.ctx, { groupId: group.id })).data.find(
    (p) => p.name === "Morning",
  )!;
  const added = new Date(CLOCK.getTime() - 20 * 24 * 60 * 60_000).toISOString();
  const ids: string[] = [];
  // Named so the list's name order puts "Zz Example 101" last.
  for (let n = 1; n <= 101; n++) {
    const medication = ok(
      await medicationService.create(
        u.owner.ctx,
        {
          groupId: group.id,
          name: `Zz Example ${String(n).padStart(3, "0")}`,
          schedule: { type: "scheduled", slots: [{ passId: morning.id }] },
        },
        { changedAt: added },
      ),
    )!;
    ids.push(medication.id);
  }
  // The row's own time too: the due-dose core gives no slots before the day it was added.
  await getDb().$client.query(`UPDATE medication SET created_at = $1 WHERE group_id = $2`, [added, group.id]);

  return { u, group, morning, ids };
};

describe("assistantActionService: many medications (B-986)", () => {
  let w: Awaited<ReturnType<typeof world>>;
  beforeAll(async () => {
    w = await world();
  }, 60_000);

  it("logPastDoses logs a mark for a medication past the first 100", async () => {
    const res = ok(
      await assistantActionService.logPastDoses(
        w.u.owner.ctx,
        w.group.id,
        [{ medicationId: w.ids.at(-1)!, day: addDays(TODAY, -3), time: w.morning.time, status: "given" }],
        { via: "Test Claude", now: CLOCK },
      ),
    );
    expect(res.results).toEqual([expect.objectContaining({ outcome: "add", passId: w.morning.id })]);
  });

  it("givePass gives every medication in the pass, past the first 100", async () => {
    const occurredAt = zonedInstant(TODAY, w.morning.time, LA).toISOString();
    ok(
      await assistantActionService.run(
        w.u.owner.ctx,
        w.group.id,
        [{ type: "givePass", passId: w.morning.id, occurredAt }],
        { via: "Test Claude", now: CLOCK },
      ),
    );
    const given = await getDb().$client.query<{ medication_id: string }>(
      `SELECT details->>'medicationId' AS medication_id FROM timeline_entry
        WHERE group_id = $1 AND kind = 'dose' AND deleted_at IS NULL AND occurred_at = $2`,
      [w.group.id, occurredAt],
    );
    expect(new Set(given.rows.map((r) => r.medication_id))).toEqual(new Set(w.ids));
  });
});
