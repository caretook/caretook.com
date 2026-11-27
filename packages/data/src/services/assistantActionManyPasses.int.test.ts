import { describe, expect, it } from "vitest";
import { addDays, dayInZone, zonedInstant } from "../db/schema";
import { createWorld, ok } from "../../test/fixtures";
import { getDb } from "../db";
import { assistantActionService, medicationPassService, medicationService } from ".";

// B-987: log_dose finds its slot among every pass the group has made, not only
// the first page of a list read (pages stop at 100; deleted passes count). A
// fictional group makes and deletes 100 passes, then makes one live pass last,
// late in the day so the list's time order puts it after all of them. The
// clock is pinned to late yesterday (Los Angeles, the recipient's zone). All
// data is fictional.

const LA = "America/Los_Angeles";
const DAY = addDays(dayInZone(new Date(), LA), -1);
const CLOCK = zonedInstant(DAY, "23:30", LA);

describe("assistantActionService: many passes (B-987)", () => {
  it("logDose against the last pass's slot logs it in that pass", async () => {
    const { u, group } = await createWorld();
    for (let n = 1; n <= 100; n++) {
      const pass = ok(
        await medicationPassService.create(u.owner.ctx, {
          groupId: group.id,
          name: `Example Round ${String(n).padStart(3, "0")}`,
          time: "05:00",
        }),
      )!;
      ok(await medicationPassService.remove(u.owner.ctx, pass.id));
    }
    const late = ok(
      await medicationPassService.create(u.owner.ctx, { groupId: group.id, name: "Late", time: "22:00" }),
    )!;
    const added = new Date(CLOCK.getTime() - 20 * 24 * 60 * 60_000).toISOString();
    const medication = ok(
      await medicationService.create(
        u.owner.ctx,
        {
          groupId: group.id,
          name: "Examplex",
          schedule: { type: "scheduled", slots: [{ passId: late.id }] },
        },
        { changedAt: added },
      ),
    )!;
    // The row's own time too: the due-dose core gives no slots before the day it was added.
    await getDb().$client.query(`UPDATE medication SET created_at = $1 WHERE id = $2`, [
      added,
      medication.id,
    ]);

    const occurredAt = zonedInstant(DAY, "22:05", LA).toISOString();
    ok(
      await assistantActionService.run(
        u.owner.ctx,
        group.id,
        [{ type: "logDose", medicationId: medication.id, status: "given", occurredAt }],
        { via: "Test Claude", now: CLOCK },
      ),
    );
    const doses = await getDb().$client.query<{ details: Record<string, unknown> }>(
      `SELECT details FROM timeline_entry WHERE group_id = $1 AND kind = 'dose' AND deleted_at IS NULL`,
      [group.id],
    );
    expect(doses.rows.map((r) => r.details)).toEqual([
      expect.objectContaining({ medicationId: medication.id, passId: late.id, scheduledFor: "22:00" }),
    ]);
  }, 60_000);
});
