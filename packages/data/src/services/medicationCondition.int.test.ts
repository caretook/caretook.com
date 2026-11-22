import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, createWorld, ok } from "../../test/fixtures";
import { medicationConditionId } from "../db/schema";
import { isError } from "../errors";
import { medicationConditionService, medicationService, recipientConditionService } from ".";

// What a medication is for (conditions slice 4): writers link and unlink a
// medication and the recipient's conditions; viewers can't; both ends must
// be live and in the link's group (another group's is `unauthorized`); a
// replay lands on the same row; a deleted condition's links leave every
// list. Every test builds its own groups and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const { u, group } = await createWorld({ members: ["caretaker", "viewer"] });
  const medication = async (name: string, groupId = group.id, ctx = u.caretaker.ctx) =>
    ok(await medicationService.create(ctx, { groupId, name, schedule: { type: "asNeeded" } }))!;
  const condition = async (name: string, groupId = group.id, ctx = u.caretaker.ctx) =>
    ok(await recipientConditionService.create(ctx, { groupId, name }))!;
  const namesFor = async (medicationId: string) => {
    const links = ok(await medicationConditionService.listForMedication(u.viewer.ctx, medicationId)).data;
    const names = await Promise.all(
      links.map(async (l) => ok(await recipientConditionService.getById(u.viewer.ctx, l.conditionId))?.name),
    );
    return names.sort();
  };
  return { u, group, medication, condition, namesFor };
};

describe("medicationConditionService", () => {
  it("lets writers link and unlink, with the pair's id; a replay lands on the same row", async () => {
    const { u, group, medication, condition, namesFor } = await setup();
    const metformin = await medication("Metformin");
    const diabetes = await condition("Type 2 diabetes");

    const link = ok(
      await medicationConditionService.link(u.caretaker.ctx, {
        groupId: group.id,
        medicationId: metformin.id,
        conditionId: diabetes.id,
      }),
    );
    expect(link?.id).toBe(medicationConditionId(metformin.id, diabetes.id));
    // A replay (with the device's id) returns the same link.
    const again = ok(
      await medicationConditionService.link(u.owner.ctx, {
        id: link!.id,
        groupId: group.id,
        medicationId: metformin.id,
        conditionId: diabetes.id,
      }),
    );
    expect(again?.id).toBe(link!.id);
    expect(await namesFor(metformin.id)).toEqual(["Type 2 diabetes"]);
    expect(
      ok(await medicationConditionService.listForCondition(u.viewer.ctx, diabetes.id)).data.map(
        (l) => l.medicationId,
      ),
    ).toEqual([metformin.id]);

    ok(await medicationConditionService.unlink(u.owner.ctx, link!.id));
    expect(await namesFor(metformin.id)).toEqual([]);
    // Unlinking what's gone is a replay: fine.
    expect(codeOf(await medicationConditionService.unlink(u.owner.ctx, link!.id))).toBe("ok");
  });

  it("refuses a link whose id isn't the pair's", async () => {
    const { u, group, medication, condition } = await setup();
    const metformin = await medication("Metformin");
    const diabetes = await condition("Type 2 diabetes");
    expect(
      codeOf(
        await medicationConditionService.link(u.owner.ctx, {
          id: randomUUID(),
          groupId: group.id,
          medicationId: metformin.id,
          conditionId: diabetes.id,
        }),
      ),
    ).toBe("medicationConditionService:invalid");
  });

  it("sets a medication's conditions exactly, and replays", async () => {
    const { u, medication, condition, namesFor } = await setup();
    const lisinopril = await medication("Lisinopril");
    const [bp, kidney, afib] = [
      await condition("High blood pressure"),
      await condition("Chronic kidney disease"),
      await condition("Atrial fibrillation"),
    ];

    const set = (conditionIds: string[]) =>
      medicationConditionService.setMedicationConditions(u.caretaker.ctx, {
        medicationId: lisinopril.id,
        conditionIds,
      });
    expect(ok(await set([bp.id, kidney.id])).data).toHaveLength(2);
    expect(await namesFor(lisinopril.id)).toEqual(["Chronic kidney disease", "High blood pressure"]);
    // One dropped, one added; then the same again changes nothing.
    ok(await set([kidney.id, afib.id]));
    ok(await set([kidney.id, afib.id]));
    expect(await namesFor(lisinopril.id)).toEqual(["Atrial fibrillation", "Chronic kidney disease"]);
    ok(await set([]));
    expect(await namesFor(lisinopril.id)).toEqual([]);
  });

  it("refuses viewers", async () => {
    const { u, group, medication, condition } = await setup();
    const metformin = await medication("Metformin");
    const diabetes = await condition("Type 2 diabetes");
    const input = { groupId: group.id, medicationId: metformin.id, conditionId: diabetes.id };
    expect(codeOf(await medicationConditionService.link(u.viewer.ctx, input))).not.toBe("ok");
    expect(
      codeOf(
        await medicationConditionService.setMedicationConditions(u.viewer.ctx, {
          medicationId: metformin.id,
          conditionIds: [diabetes.id],
        }),
      ),
    ).not.toBe("ok");
    const link = ok(await medicationConditionService.link(u.owner.ctx, input))!;
    expect(codeOf(await medicationConditionService.unlink(u.viewer.ctx, link.id))).toBe(
      "permissions:unauthorized",
    );
    expect(
      codeOf(
        await medicationConditionService.setMedicationConditions(u.viewer.ctx, {
          medicationId: metformin.id,
          conditionIds: [],
        }),
      ),
    ).not.toBe("ok");
    expect(
      ok(await medicationConditionService.listForMedication(u.viewer.ctx, metformin.id)).data,
    ).toHaveLength(1);
  });

  it("links only within one group: another group's medication or condition is unauthorized", async () => {
    const { u, group, medication, condition } = await setup();
    const other = await createUser("other owner");
    const { group: otherGroup } = await createGroup(other);
    const metformin = await medication("Metformin");
    const diabetes = await condition("Type 2 diabetes");
    const theirs = await condition("Asthma", otherGroup.id, other.ctx);
    const theirMedication = await medication("Albuterol", otherGroup.id, other.ctx);

    expect(
      codeOf(
        await medicationConditionService.link(u.owner.ctx, {
          groupId: group.id,
          medicationId: metformin.id,
          conditionId: theirs.id,
        }),
      ),
    ).toBe("permissions:unauthorized");
    expect(
      codeOf(
        await medicationConditionService.link(u.owner.ctx, {
          groupId: group.id,
          medicationId: theirMedication.id,
          conditionId: diabetes.id,
        }),
      ),
    ).toBe("permissions:unauthorized");
    // Nor from the other side.
    expect(
      codeOf(
        await medicationConditionService.link(other.ctx, {
          groupId: otherGroup.id,
          medicationId: theirMedication.id,
          conditionId: diabetes.id,
        }),
      ),
    ).toBe("permissions:unauthorized");
    expect(
      codeOf(
        await medicationConditionService.setMedicationConditions(u.owner.ctx, {
          medicationId: metformin.id,
          conditionIds: [theirs.id],
        }),
      ),
    ).toBe("permissions:unauthorized");
  });

  it("refuses a deleted medication or condition, and hides a deleted condition's links", async () => {
    const { u, group, medication, condition, namesFor } = await setup();
    const metformin = await medication("Metformin");
    const [diabetes, kidney] = [
      await condition("Type 2 diabetes"),
      await condition("Chronic kidney disease"),
    ];
    ok(
      await medicationConditionService.setMedicationConditions(u.owner.ctx, {
        medicationId: metformin.id,
        conditionIds: [diabetes.id, kidney.id],
      }),
    );

    ok(await recipientConditionService.remove(u.owner.ctx, kidney.id));
    expect(await namesFor(metformin.id)).toEqual(["Type 2 diabetes"]);
    expect(ok(await medicationConditionService.listForCondition(u.viewer.ctx, kidney.id)).data).toEqual([]);
    expect(
      codeOf(
        await medicationConditionService.link(u.owner.ctx, {
          groupId: group.id,
          medicationId: metformin.id,
          conditionId: kidney.id,
        }),
      ),
    ).toBe("medicationConditionService:conditionNotFound");
    // Setting the live ones leaves the deleted one's link alone.
    ok(
      await medicationConditionService.setMedicationConditions(u.owner.ctx, {
        medicationId: metformin.id,
        conditionIds: [diabetes.id],
      }),
    );
    expect(await namesFor(metformin.id)).toEqual(["Type 2 diabetes"]);

    ok(await medicationService.remove(u.owner.ctx, metformin.id));
    expect(ok(await medicationConditionService.listForCondition(u.viewer.ctx, diabetes.id)).data).toEqual([]);
    expect(
      codeOf(
        await medicationConditionService.link(u.owner.ctx, {
          groupId: group.id,
          medicationId: metformin.id,
          conditionId: diabetes.id,
        }),
      ),
    ).toBe("medicationConditionService:medicationNotFound");
  });
});
