import type { RecipientAllergy } from "../../db";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createWorld, ok } from "../../../test/fixtures";
import { getDb } from "../../db";
import { recipientAllergySchema } from "../../db/schema";
import { isError } from "../../errors";
import { softDeleteFunctions } from "./softDeleteModel";

// The soft-delete factory on the recipient allergy table: live reads hide
// deleted rows unless asked, updates touch live rows only, and `remove` sets
// `deletedAt` and `updatedBy` under the table's delete permission.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

// Substance descending, so the default order is told apart from insert order.
const model = softDeleteFunctions({
  schemaName: "recipientAllergySchema",
  dbToModel: (row: RecipientAllergy) => row,
  defaultOrder: [
    { field: "substance", direction: "desc" },
    { field: "id", direction: "asc" },
  ],
});

const setup = async () => {
  const { u, group, recipient } = await createWorld({ members: ["caretaker", "viewer"] });
  const add = async (substance: string) => {
    const row = ok(
      await model.create({
        ...u.caretaker.ctx,
        data: { groupId: group.id, recipientId: recipient.id, substance },
      }),
    );
    if (!row) throw new Error("allergy not readable");
    return row;
  };
  const byGroup = { groupId: { type: "eq", value: group.id } } as const;
  const rawRow = async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(recipientAllergySchema)
      .where(eq(recipientAllergySchema.id, id));
    return row;
  };
  return { u, add, byGroup, rawRow };
};

describe("softDeleteFunctions", () => {
  it("hides a deleted row from live reads and shows it with includeDeleted", async () => {
    const { u, add, byGroup } = await setup();
    const kept = await add("Latex");
    const gone = await add("Peanuts");
    ok(await model.remove({ ...u.caretaker.ctx, filter: { id: { type: "eq", value: gone.id } } }));

    const ctx = u.viewer.ctx;
    expect(ok(await model.getById(gone.id, ctx))).toBeNull();
    expect(ok(await model.get({ ...ctx, filter: { id: { type: "eq", value: gone.id } } }))).toBeNull();
    expect(ok(await model.list({ ...ctx, filter: byGroup })).data.map((r) => r.id)).toEqual([kept.id]);

    expect(ok(await model.getById(gone.id, { ...ctx, includeDeleted: true }))?.id).toBe(gone.id);
    // The deleted row's substance is scrubbed, so it sorts last.
    expect(
      ok(await model.list({ ...ctx, filter: byGroup, includeDeleted: true })).data.map((r) => r.id),
    ).toEqual([kept.id, gone.id]);
  });

  it("uses the default order when none is given, and the caller's when it is", async () => {
    const { u, add, byGroup } = await setup();
    await add("Bee stings");
    await add("Sulfa drugs");
    await add("Latex");

    const ctx = u.viewer.ctx;
    expect(ok(await model.list({ ...ctx, filter: byGroup })).data.map((r) => r.substance)).toEqual([
      "Sulfa drugs",
      "Latex",
      "Bee stings",
    ]);
    expect(
      ok(
        await model.list({ ...ctx, filter: byGroup, orderBy: [{ field: "substance", direction: "asc" }] }),
      ).data.map((r) => r.substance),
    ).toEqual(["Bee stings", "Latex", "Sulfa drugs"]);
  });

  it("updates live rows and leaves a deleted row alone", async () => {
    const { u, add, rawRow } = await setup();
    const live = await add("Penicillin");
    const gone = await add("Shellfish");
    ok(await model.remove({ ...u.caretaker.ctx, filter: { id: { type: "eq", value: gone.id } } }));

    const updated = ok(
      await model.update({
        ...u.caretaker.ctx,
        filter: { id: { type: "eq", value: live.id } },
        data: { reaction: "Hives" },
      }),
    );
    expect(updated.map((r) => r.reaction)).toEqual(["Hives"]);

    expect(
      codeOf(
        await model.update({
          ...u.caretaker.ctx,
          filter: { id: { type: "eq", value: gone.id } },
          data: { reaction: "Swelling of the lips" },
        }),
      ),
    ).toBe("baseModel:update:nothingUpdated");
    expect((await rawRow(gone.id))?.reaction).toBeNull();
  });

  it("removes by setting deletedAt and updatedBy, under the delete permission", async () => {
    const { u, add, rawRow } = await setup();
    const row = await add("Aspirin");
    const byId = { id: { type: "eq", value: row.id } } as const;

    expect(codeOf(await model.remove({ ...u.caretaker.ctx, filter: {} }))).toBe("baseModel:noFilter");
    expect(codeOf(await model.remove({ ...u.caretaker.ctx }))).toBe("baseModel:noFilter");

    // A viewer can read the row but not delete it.
    expect(codeOf(await model.remove({ ...u.viewer.ctx, filter: byId }))).toBe(
      "baseModel:remove:nothingRemoved",
    );
    expect((await rawRow(row.id))?.deletedAt).toBeNull();

    expect(ok(await model.remove({ ...u.owner.ctx, filter: byId }))).toEqual({ ids: [row.id] });
    const removed = await rawRow(row.id);
    expect(removed?.deletedAt).not.toBeNull();
    expect(removed?.updatedBy).toBe(u.owner.user.id);
    expect(removed?.createdBy).toBe(u.caretaker.user.id);

    // A deleted row isn't removed again.
    expect(codeOf(await model.remove({ ...u.owner.ctx, filter: byId }))).toBe(
      "baseModel:remove:nothingRemoved",
    );
  });
});
