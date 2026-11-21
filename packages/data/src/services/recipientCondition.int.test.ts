import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { getDb } from "../db";
import { careRecipientSchema } from "../db/schema";
import { isError } from "../errors";
import { recipientConditionService } from ".";

// The recipient's conditions (conditions slice 1): writers add, edit,
// resolve, reactivate and delete; viewers and outsiders can't; another
// group's recipient is refused; "No known conditions" is cleared by an add
// and refused while conditions are on file. Every test builds its own group
// and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
    staff: await createUser("staff", "admin"),
  };
  const { group, recipient } = await createGroup(u.owner, [
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const names = async (includeDeleted = false) =>
    ok(await recipientConditionService.list(u.viewer.ctx, { groupId: group.id, includeDeleted })).data.map(
      (c) => c.name,
    );
  return { u, group, recipient, names };
};

const noKnownOf = async (recipientId: string) => {
  const [row] = await getDb()
    .select()
    .from(careRecipientSchema)
    .where(eq(careRecipientSchema.id, recipientId));
  return row?.noKnownConditionsAt ?? null;
};

describe("recipientConditionService", () => {
  it("lets writers add, edit, resolve, reactivate and delete a condition", async () => {
    const { u, group, recipient, names } = await setup();

    const condition = ok(
      await recipientConditionService.create(u.caretaker.ctx, {
        groupId: group.id,
        name: " Type 2 diabetes ",
        sinceYear: 2016,
        sinceMonth: 3,
        note: "Diet-controlled",
      }),
    );
    expect(condition).toMatchObject({
      name: "Type 2 diabetes",
      status: "active",
      sinceYear: 2016,
      sinceMonth: 3,
      note: "Diet-controlled",
      recipientId: recipient.id,
      diagnosedById: null,
    });

    // What's left out keeps its value; an empty note clears it.
    expect(
      ok(await recipientConditionService.update(u.owner.ctx, condition!.id, { note: "", sinceMonth: null })),
    ).toMatchObject({ name: "Type 2 diabetes", sinceYear: 2016, sinceMonth: null, note: null });

    expect(ok(await recipientConditionService.resolve(u.caretaker.ctx, condition!.id))?.status).toBe(
      "resolved",
    );
    // A replay is fine.
    expect(ok(await recipientConditionService.resolve(u.caretaker.ctx, condition!.id))?.status).toBe(
      "resolved",
    );
    expect(ok(await recipientConditionService.reactivate(u.owner.ctx, condition!.id))?.status).toBe("active");

    ok(await recipientConditionService.remove(u.caretaker.ctx, condition!.id));
    expect(await names()).toEqual([]);
    expect(await names(true)).toEqual(["Type 2 diabetes"]);
    // A deleted condition can't be edited or resolved.
    expect(codeOf(await recipientConditionService.resolve(u.owner.ctx, condition!.id))).toBe(
      "recipientConditionService:notFound",
    );
    expect(codeOf(await recipientConditionService.remove(u.owner.ctx, condition!.id))).toBe(
      "recipientConditionService:notFound",
    );
  });

  it("validates the name, the since and the note", async () => {
    const { u, group } = await setup();
    const add = (input: Record<string, unknown>) =>
      recipientConditionService.create(u.owner.ctx, { groupId: group.id, name: "Asthma", ...input });

    expect(codeOf(await add({ name: "  " }))).toBe("recipientConditionService:invalid");
    expect(codeOf(await add({ name: "x".repeat(201) }))).toBe("recipientConditionService:invalid");
    expect(codeOf(await add({ note: "x".repeat(301) }))).toBe("recipientConditionService:invalid");
    // A month needs a year.
    const monthOnly = await add({ sinceMonth: 4 });
    expect(codeOf(monthOnly)).toBe("recipientConditionService:invalid");
    expect(isError(monthOnly) && monthOnly.meta).toMatchObject({
      issues: [{ path: "sinceYear", message: "Enter the year too" }],
    });
    expect(codeOf(await add({ sinceYear: 1850 }))).toBe("recipientConditionService:invalid");
    expect(codeOf(await add({ sinceYear: 2015, sinceMonth: 13 }))).toBe("recipientConditionService:invalid");
    expect(codeOf(await add({ status: "cured" }))).toBe("recipientConditionService:invalid");

    const asthma = ok(await add({ sinceYear: 2015, status: "resolved" }));
    expect(asthma).toMatchObject({ status: "resolved", sinceYear: 2015, sinceMonth: null });
    // Clearing the year while a month is set is refused on the merged row.
    ok(await recipientConditionService.update(u.owner.ctx, asthma!.id, { sinceMonth: 6 }));
    expect(codeOf(await recipientConditionService.update(u.owner.ctx, asthma!.id, { sinceYear: null }))).toBe(
      "recipientConditionService:invalid",
    );
    // Content only: the group can't be sent.
    expect(
      codeOf(
        await recipientConditionService.update(u.owner.ctx, asthma!.id, {
          groupId: randomUUID(),
        } as never),
      ),
    ).toBe("recipientConditionService:invalid");
  });

  it("refuses viewers, outsiders and staff, and another group's recipient", async () => {
    const { u, group, names } = await setup();
    const condition = ok(
      await recipientConditionService.create(u.owner.ctx, { groupId: group.id, name: "Glaucoma" }),
    );

    for (const who of [u.viewer, u.outsider, u.staff]) {
      expect(
        codeOf(await recipientConditionService.create(who.ctx, { groupId: group.id, name: "Gout" })),
      ).not.toBe("ok");
      expect(
        codeOf(await recipientConditionService.update(who.ctx, condition!.id, { name: "Gout" })),
      ).not.toBe("ok");
      expect(codeOf(await recipientConditionService.resolve(who.ctx, condition!.id))).not.toBe("ok");
      expect(codeOf(await recipientConditionService.remove(who.ctx, condition!.id))).not.toBe("ok");
    }
    // Outsiders and staff don't see it at all.
    expect(ok(await recipientConditionService.getById(u.outsider.ctx, condition!.id))).toBeNull();
    expect(ok(await recipientConditionService.getById(u.staff.ctx, condition!.id))).toBeNull();
    expect(await names()).toEqual(["Glaucoma"]);

    // A writer of another group can't add to this one, nor name this group's recipient from theirs.
    const other = await createUser("other-owner");
    const { group: otherGroup } = await createGroup(other);
    const { recipient } = await setup();
    expect(
      codeOf(await recipientConditionService.create(other.ctx, { groupId: group.id, name: "Gout" })),
    ).toBe("permissions:unauthorized");
    expect(
      codeOf(
        await recipientConditionService.create(other.ctx, {
          groupId: otherGroup.id,
          recipientId: recipient.id,
          name: "Gout",
        }),
      ),
    ).not.toBe("ok");
  });

  it("upserts by id: creates, updates, keeps a deleted one deleted, and refuses a group change", async () => {
    const { u, group, recipient, names } = await setup();
    const id = randomUUID();
    const input = { id, groupId: group.id, recipientId: recipient.id, name: "Gout" };

    expect(ok(await recipientConditionService.upsert(u.caretaker.ctx, input))?.id).toBe(id);
    expect(
      ok(await recipientConditionService.upsert(u.caretaker.ctx, { ...input, sinceYear: 2020 })),
    ).toMatchObject({ id, sinceYear: 2020 });
    expect(
      codeOf(await recipientConditionService.upsert(u.caretaker.ctx, { ...input, groupId: randomUUID() })),
    ).not.toBe("ok");
    ok(await recipientConditionService.remove(u.caretaker.ctx, id));
    expect(ok(await recipientConditionService.upsert(u.caretaker.ctx, input))?.deletedAt).toBeTruthy();
    expect(await names()).toEqual([]);
    expect(
      codeOf(await recipientConditionService.upsert(u.viewer.ctx, { ...input, id: randomUUID() })),
    ).not.toBe("ok");
  });
});

describe("recipientConditionService.setNoKnownConditions", () => {
  it("lets writers record and clear it, refuses others, and refuses it while conditions are on file", async () => {
    const { u, group, recipient } = await setup();
    const at = "2026-11-18T09:00:00.000Z";

    for (const who of [u.viewer, u.outsider, u.staff])
      expect(
        codeOf(await recipientConditionService.setNoKnownConditions(who.ctx, recipient.id, at)),
      ).not.toBe("ok");
    expect(await noKnownOf(recipient.id)).toBeNull();

    ok(await recipientConditionService.setNoKnownConditions(u.caretaker.ctx, recipient.id, at));
    expect(await noKnownOf(recipient.id)).toMatch(/^2026-11-18/);
    // A replay is fine.
    ok(await recipientConditionService.setNoKnownConditions(u.caretaker.ctx, recipient.id, at));
    expect(
      codeOf(await recipientConditionService.setNoKnownConditions(u.owner.ctx, recipient.id, "soon")),
    ).toBe("recipientConditionService:invalidNoKnown");

    // Adding a condition clears it, in the same transaction.
    const condition = ok(
      await recipientConditionService.create(u.caretaker.ctx, {
        groupId: group.id,
        name: "Pneumonia",
        status: "resolved",
      }),
    );
    expect(await noKnownOf(recipient.id)).toBeNull();
    // A resolved condition is still on file.
    expect(codeOf(await recipientConditionService.setNoKnownConditions(u.owner.ctx, recipient.id, at))).toBe(
      "recipientConditionService:hasConditions",
    );
    // A deleted one isn't.
    ok(await recipientConditionService.remove(u.caretaker.ctx, condition!.id));
    ok(await recipientConditionService.setNoKnownConditions(u.owner.ctx, recipient.id, at));
    expect(await noKnownOf(recipient.id)).toMatch(/^2026-11-18/);
    ok(await recipientConditionService.setNoKnownConditions(u.owner.ctx, recipient.id, null));
    expect(await noKnownOf(recipient.id)).toBeNull();
  });

  it("leaves No known allergies alone", async () => {
    const { u, recipient } = await setup();
    await getDb()
      .update(careRecipientSchema)
      .set({ noKnownAllergiesAt: "2026-11-01T00:00:00.000Z" })
      .where(eq(careRecipientSchema.id, recipient.id));
    ok(
      await recipientConditionService.setNoKnownConditions(u.owner.ctx, recipient.id, "2026-11-18T09:00:00Z"),
    );
    const [row] = await getDb()
      .select()
      .from(careRecipientSchema)
      .where(eq(careRecipientSchema.id, recipient.id));
    expect(row?.noKnownAllergiesAt).toMatch(/^2026-11-01/);
    expect(row?.noKnownConditionsAt).toMatch(/^2026-11-18/);
  });
});
