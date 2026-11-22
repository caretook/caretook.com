import type { MedicationCreateInput, PassMovedDetails } from "../db";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createWorld, ok } from "../../test/fixtures";
import { getDb } from "../db";
import { careRecipientSchema, medicationSchema, passMovedId, timelineEntrySchema } from "../db/schema";
import { isError } from "../errors";
import { medicationPassService, medicationService, recipientAllergyService } from ".";

// Medication passes (medications-2 slice 1): names, the cap, retimes with
// their timeline entry, deletes that turn passes into times, permissions, and
// the recipient's allergies. Every test builds its own group and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const { u, group, recipient } = await createWorld({
    members: ["caretaker", "viewer"],
    extras: ["outsider", "staff"],
  });
  const passes = async (includeDeleted = false) =>
    ok(await medicationPassService.list(u.viewer.ctx, { groupId: group.id, includeDeleted })).data;
  const [morning, evening] = await passes();
  if (!morning || !evening) throw new Error("no default passes");
  const addMedication = async (overrides: Partial<MedicationCreateInput> = {}) => {
    const medication = ok(
      await medicationService.create(u.caretaker.ctx, {
        groupId: group.id,
        name: "Metformin",
        strength: "500 mg",
        schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
        ...overrides,
      }),
    );
    if (!medication) throw new Error("medication not readable");
    return medication;
  };
  const scheduleOf = async (id: string) => {
    const [row] = await getDb().select().from(medicationSchema).where(eq(medicationSchema.id, id));
    return row?.schedule;
  };
  const changeEntries = async () =>
    getDb()
      .select()
      .from(timelineEntrySchema)
      .where(
        and(eq(timelineEntrySchema.groupId, group.id), eq(timelineEntrySchema.kind, "medicationChange")),
      );
  return { u, group, recipient, passes, morning, evening, addMedication, scheduleOf, changeEntries };
};

describe("medicationPassService", () => {
  it("starts every group with Morning and Evening, in order", async () => {
    const { passes } = await setup();
    expect((await passes()).map((p) => [p.name, p.time, p.sortOrder])).toEqual([
      ["Morning", "08:00", 0],
      ["Evening", "20:00", 1],
    ]);
  });

  it("lets writers add a pass at the end, with a free name, up to eight", async () => {
    const { u, group, passes } = await setup();
    const noon = ok(
      await medicationPassService.create(u.caretaker.ctx, { groupId: group.id, name: "Noon", time: "12:00" }),
    );
    expect(noon).toMatchObject({ name: "Noon", time: "12:00", sortOrder: 2, createdBy: u.caretaker.user.id });

    expect(
      codeOf(
        await medicationPassService.create(u.owner.ctx, {
          groupId: group.id,
          name: " MORNING ",
          time: "07:00",
        }),
      ),
    ).toBe("medicationPassService:nameTaken");
    for (const bad of [
      { name: "", time: "07:00" },
      { name: "Early", time: "7am" },
    ])
      expect(codeOf(await medicationPassService.create(u.owner.ctx, { groupId: group.id, ...bad }))).toBe(
        "medicationPassService:invalid",
      );

    for (const i of [1, 2, 3, 4, 5])
      ok(
        await medicationPassService.create(u.owner.ctx, {
          groupId: group.id,
          name: `Extra ${i}`,
          time: "15:00",
        }),
      );
    expect(await passes()).toHaveLength(8);
    expect(
      codeOf(
        await medicationPassService.create(u.owner.ctx, { groupId: group.id, name: "Ninth", time: "23:00" }),
      ),
    ).toBe("medicationPassService:tooMany");

    // A deleted pass frees its name and its place.
    ok(await medicationPassService.remove(u.owner.ctx, noon!.id));
    ok(await medicationPassService.create(u.owner.ctx, { groupId: group.id, name: "noon", time: "12:30" }));
  });

  it("refuses viewers, outsiders and staff", async () => {
    const { u, group, morning } = await setup();
    for (const who of [u.viewer, u.outsider, u.staff]) {
      expect(
        codeOf(
          await medicationPassService.create(who.ctx, { groupId: group.id, name: "Noon", time: "12:00" }),
        ),
      ).not.toBe("ok");
      expect(codeOf(await medicationPassService.update(who.ctx, morning.id, { name: "Breakfast" }))).not.toBe(
        "ok",
      );
      expect(codeOf(await medicationPassService.remove(who.ctx, morning.id))).not.toBe("ok");
    }
    expect(codeOf(await medicationPassService.list(u.outsider.ctx, { groupId: group.id }))).toBe("ok");
    expect(ok(await medicationPassService.list(u.outsider.ctx, { groupId: group.id })).data).toEqual([]);
  });

  it("renames without an entry, and keeps names unique", async () => {
    const { u, morning, changeEntries } = await setup();
    const before = (await changeEntries()).length;
    expect(
      ok(await medicationPassService.update(u.caretaker.ctx, morning.id, { name: "Breakfast" })),
    ).toMatchObject({
      name: "Breakfast",
      time: "08:00",
    });
    expect(codeOf(await medicationPassService.update(u.caretaker.ctx, morning.id, { name: "evening" }))).toBe(
      "medicationPassService:nameTaken",
    );
    expect(await changeEntries()).toHaveLength(before);
  });

  it("retimes a pass with one passMoved entry naming its current medications, once per save", async () => {
    const { u, group, recipient, morning, addMedication, changeEntries } = await setup();
    const metformin = await addMedication();
    const stopped = await addMedication({ name: "Old one" });
    ok(
      await medicationService.update(u.caretaker.ctx, stopped.id, {
        status: "completed",
        stoppedOn: "2026-11-01",
      }),
    );
    await addMedication({ name: "Other", schedule: { type: "scheduled", slots: [{ time: "09:00" }] } });

    const at = "2026-11-18T09:00:00.000000Z";
    const moved = ok(
      await medicationPassService.update(u.caretaker.ctx, morning.id, { time: "08:30" }, { changedAt: at }),
    );
    expect(moved).toMatchObject({ time: "08:30" });
    // Replayed (the same upload again): no second entry.
    ok(await medicationPassService.update(u.caretaker.ctx, morning.id, { time: "08:30" }, { changedAt: at }));

    const entries = (await changeEntries()).filter(
      (e) => (e.details as PassMovedDetails).change === "passMoved",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: passMovedId(morning.id, at),
      groupId: group.id,
      recipientId: recipient.id,
      timeZone: "America/Los_Angeles",
      createdBy: u.caretaker.user.id,
      details: {
        change: "passMoved",
        passId: morning.id,
        passName: "Morning",
        beforeTime: "08:00",
        afterTime: "08:30",
        medicationIds: [metformin.id],
      },
    });
    expect(new Date(entries[0]!.occurredAt).toISOString()).toBe("2026-11-18T09:00:00.000Z");
  });

  it("reorders passes", async () => {
    const { u, morning, evening, passes } = await setup();
    ok(await medicationPassService.update(u.caretaker.ctx, evening.id, { sortOrder: 0 }));
    ok(await medicationPassService.update(u.caretaker.ctx, morning.id, { sortOrder: 1 }));
    expect((await passes()).map((p) => p.name)).toEqual(["Evening", "Morning"]);
  });

  it("deletes a pass, turning it into a time in every schedule (amounts kept), with no change entries", async () => {
    const { u, morning, evening, addMedication, scheduleOf, changeEntries, passes } = await setup();
    const split = await addMedication({
      schedule: {
        type: "scheduled",
        slots: [{ passId: morning.id, amount: "1000 mg" }, { passId: evening.id }],
      },
    });
    const stopped = await addMedication({
      name: "Old one",
      schedule: { type: "scheduled", slots: [{ passId: morning.id }] },
    });
    ok(
      await medicationService.update(u.caretaker.ctx, stopped.id, {
        status: "completed",
        stoppedOn: "2026-11-01",
      }),
    );
    const before = (await changeEntries()).length;

    ok(await medicationPassService.remove(u.caretaker.ctx, morning.id));
    expect((await passes()).map((p) => p.name)).toEqual(["Evening"]);
    expect(await scheduleOf(split.id)).toEqual({
      type: "scheduled",
      slots: [{ passId: evening.id }, { time: "08:00", amount: "1000 mg" }],
    });
    expect(await scheduleOf(stopped.id)).toEqual({ type: "scheduled", slots: [{ time: "08:00" }] });
    expect(await changeEntries()).toHaveLength(before);
    expect(codeOf(await medicationPassService.remove(u.caretaker.ctx, morning.id))).toBe(
      "medicationPassService:notFound",
    );
    expect(codeOf(await medicationPassService.update(u.caretaker.ctx, morning.id, { name: "Back" }))).toBe(
      "medicationPassService:notFound",
    );
  });

  it("upserts a device's pass and refuses another group's id or a moved group", async () => {
    const { u, group, recipient } = await setup();
    const other = await createGroup(u.outsider);
    const id = randomUUID();
    const input = {
      id,
      groupId: group.id,
      recipientId: recipient.id,
      name: "Bedtime",
      time: "21:30",
      sortOrder: 2,
    };
    ok(await medicationPassService.upsert(u.caretaker.ctx, input));
    ok(await medicationPassService.upsert(u.caretaker.ctx, input));
    expect(
      codeOf(await medicationPassService.upsert(u.caretaker.ctx, { ...input, groupId: other.group.id })),
    ).toBe("medicationPassService:immutable");
    const [theirs] = ok(await medicationPassService.list(u.outsider.ctx, { groupId: other.group.id })).data;
    expect(
      codeOf(
        await medicationPassService.upsert(u.caretaker.ctx, { ...input, id: theirs!.id, name: "Mine now" }),
      ),
    ).toBe("permissions:unauthorized");
  });
});

describe("medicationService and passes", () => {
  it("refuses another group's pass, and turns a deleted pass into its time", async () => {
    const { u, group, morning, evening, addMedication } = await setup();
    const other = await createGroup(u.outsider);
    const [theirs] = ok(await medicationPassService.list(u.outsider.ctx, { groupId: other.group.id })).data;
    expect(
      codeOf(
        await medicationService.create(u.caretaker.ctx, {
          groupId: group.id,
          name: "Wrong",
          schedule: { type: "scheduled", slots: [{ passId: theirs!.id }] },
        }),
      ),
    ).toBe("medicationService:badPass");
    expect(
      codeOf(
        await medicationService.create(u.caretaker.ctx, {
          groupId: group.id,
          name: "Unknown",
          schedule: { type: "scheduled", slots: [{ passId: randomUUID() }] },
        }),
      ),
    ).toBe("medicationService:badPass");

    // A device that hadn't seen the delete saves the old pass: it becomes the time.
    const medication = await addMedication({
      schedule: { type: "scheduled", slots: [{ passId: evening.id }] },
    });
    ok(await medicationPassService.remove(u.caretaker.ctx, morning.id));
    const saved = ok(
      await medicationService.update(u.caretaker.ctx, medication.id, {
        schedule: {
          type: "scheduled",
          slots: [{ passId: morning.id, amount: "2 tablets" }, { passId: evening.id }],
        },
      }),
    );
    expect(saved?.schedule).toEqual({
      type: "scheduled",
      slots: [{ passId: evening.id }, { time: "08:00", amount: "2 tablets" }],
    });
  });
});

describe("recipientAllergyService", () => {
  it("lets writers add, edit and remove allergies; adding one clears No known allergies", async () => {
    const { u, group, recipient } = await setup();
    await getDb()
      .update(careRecipientSchema)
      .set({ noKnownAllergiesAt: "2026-11-01T00:00:00.000Z" })
      .where(eq(careRecipientSchema.id, recipient.id));

    const allergy = ok(
      await recipientAllergyService.create(u.caretaker.ctx, {
        groupId: group.id,
        substance: " Penicillin ",
        reaction: "Hives",
        severity: "severe",
      }),
    );
    expect(allergy).toMatchObject({
      substance: "Penicillin",
      reaction: "Hives",
      severity: "severe",
      recipientId: recipient.id,
    });
    const [row] = await getDb().query.careRecipientSchema.findMany({
      where: (t, { eq }) => eq(t.id, recipient.id),
    });
    expect(row?.noKnownAllergiesAt).toBeNull();

    expect(
      ok(await recipientAllergyService.update(u.owner.ctx, allergy!.id, { reaction: "" })),
    ).toMatchObject({
      reaction: null,
      severity: "severe",
    });
    expect(codeOf(await recipientAllergyService.update(u.owner.ctx, allergy!.id, { substance: " " }))).toBe(
      "recipientAllergyService:invalid",
    );
    for (const who of [u.viewer, u.outsider, u.staff]) {
      expect(
        codeOf(await recipientAllergyService.create(who.ctx, { groupId: group.id, substance: "Sulfa" })),
      ).not.toBe("ok");
      expect(codeOf(await recipientAllergyService.remove(who.ctx, allergy!.id))).not.toBe("ok");
    }
    ok(await recipientAllergyService.remove(u.caretaker.ctx, allergy!.id));
    expect(ok(await recipientAllergyService.list(u.viewer.ctx, { groupId: group.id })).data).toEqual([]);
    expect(
      ok(await recipientAllergyService.list(u.viewer.ctx, { groupId: group.id, includeDeleted: true })).data,
    ).toHaveLength(1);
  });
});

describe("recipientAllergyService.setNoKnownAllergies", () => {
  const noKnownOf = async (recipientId: string) => {
    const [row] = await getDb()
      .select()
      .from(careRecipientSchema)
      .where(eq(careRecipientSchema.id, recipientId));
    return row?.noKnownAllergiesAt ?? null;
  };

  it("lets writers record and clear it, refuses others, and refuses it while allergies are on file", async () => {
    const { u, group, recipient } = await setup();
    const at = "2026-11-18T09:00:00.000Z";

    for (const who of [u.viewer, u.outsider, u.staff])
      expect(codeOf(await recipientAllergyService.setNoKnownAllergies(who.ctx, recipient.id, at))).not.toBe(
        "ok",
      );
    expect(await noKnownOf(recipient.id)).toBeNull();

    ok(await recipientAllergyService.setNoKnownAllergies(u.caretaker.ctx, recipient.id, at));
    expect(await noKnownOf(recipient.id)).toMatch(/^2026-11-18/);
    // A replay is fine.
    ok(await recipientAllergyService.setNoKnownAllergies(u.caretaker.ctx, recipient.id, at));
    expect(codeOf(await recipientAllergyService.setNoKnownAllergies(u.owner.ctx, recipient.id, "soon"))).toBe(
      "recipientAllergyService:invalidNoKnown",
    );
    ok(await recipientAllergyService.setNoKnownAllergies(u.owner.ctx, recipient.id, null));
    expect(await noKnownOf(recipient.id)).toBeNull();

    const allergy = ok(
      await recipientAllergyService.create(u.caretaker.ctx, { groupId: group.id, substance: "Sulfa" }),
    );
    expect(codeOf(await recipientAllergyService.setNoKnownAllergies(u.owner.ctx, recipient.id, at))).toBe(
      "recipientAllergyService:hasAllergies",
    );
    // A deleted allergy doesn't count.
    ok(await recipientAllergyService.remove(u.caretaker.ctx, allergy!.id));
    ok(await recipientAllergyService.setNoKnownAllergies(u.owner.ctx, recipient.id, at));
    expect(await noKnownOf(recipient.id)).toMatch(/^2026-11-18/);
  });
});
