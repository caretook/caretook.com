import type { MedicationChangeDetails, MedicationCreateInput, ProviderCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createGroup, createUser, ok, system, typeParagraph } from "../../test/fixtures";
import { getDb, withTransaction } from "../db";
import { medicationChangeId, medicationSchema, timelineEntrySchema } from "../db/schema";
import { isError, newError } from "../errors";
import { noteDocumentModel, noteUpdateModel } from "../models";
import { medicationService, noteDocumentService, providerService, timelineEntryService } from ".";

// Every test builds its own group and users, so tests never depend on each other.

const WRITERS = ["owner", "admin", "caretaker"] as const;
const NON_WRITERS = ["viewer", "outsider", "staff"] as const;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const issuesOf = (res: unknown) =>
  isError(res)
    ? ((res.meta as { issues?: { path: string }[] } | undefined)?.issues ?? []).map((i) => i.path)
    : [];

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
    staff: await createUser("staff", "admin"),
  };
  const { group, recipient } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const input = (overrides: Partial<MedicationCreateInput> = {}): MedicationCreateInput => ({
    groupId: group.id,
    name: "Lisinopril",
    strength: "10 mg",
    form: "tablet",
    dose: "1 tablet",
    schedule: { type: "scheduled", times: ["08:00"] },
    ...overrides,
  });
  const addMedication = async (overrides: Partial<MedicationCreateInput> = {}) => {
    const medication = ok(await medicationService.create(u.caretaker.ctx, input(overrides)));
    if (!medication) throw new Error("medication not readable");
    return medication;
  };
  const addProvider = async (overrides: Partial<ProviderCreateInput> = {}) => {
    const provider = ok(
      await providerService.create(u.caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Example",
        ...overrides,
      }),
    );
    if (!provider) throw new Error("provider not readable");
    return provider;
  };
  /** The medication's change entries, oldest first, deleted ones included. */
  const changesOf = async (medicationId: string) => {
    const entries = await getDb()
      .select()
      .from(timelineEntrySchema)
      .where(and(eq(timelineEntrySchema.groupId, group.id), eq(timelineEntrySchema.kind, "medicationChange")))
      .orderBy(asc(timelineEntrySchema.occurredAt));
    return entries.filter((e) => (e.details as MedicationChangeDetails).medicationId === medicationId);
  };
  const addDose = (ctx: (typeof u)["owner"]["ctx"], medicationId: string, groupId = group.id) =>
    timelineEntryService.create(ctx, {
      groupId,
      kind: "dose",
      occurredAt: "2026-11-17T16:05:00.000Z",
      timeZone: "America/Los_Angeles",
      details: { medicationId, status: "given", amount: "1 tablet", scheduledFor: "08:00" },
    });
  return { u, group, recipient, input, addMedication, addProvider, changesOf, addDose };
};

describe("medicationService: writing", () => {
  it("lets writers create, update and delete; viewers, outsiders and staff can't", async () => {
    const { u, group, recipient, input, addMedication } = await setup();

    for (const role of WRITERS) {
      const created = ok(await medicationService.create(u[role].ctx, input({ name: `By ${role}` })));
      expect(created).toMatchObject({
        groupId: group.id,
        recipientId: recipient.id,
        name: `By ${role}`,
        status: "current",
        createdBy: u[role].user.id,
      });
      const updated = ok(await medicationService.update(u[role].ctx, created!.id, { refillsLeft: 2 }));
      expect(updated).toMatchObject({ refillsLeft: 2, updatedBy: u[role].user.id });
      ok(await medicationService.remove(u[role].ctx, created!.id));
      expect(await medicationService.getById(u.owner.ctx, created!.id)).toBeNull();
    }

    const medication = await addMedication();
    for (const role of NON_WRITERS) {
      expect(codeOf(await medicationService.create(u[role].ctx, input({ name: "Nope" })))).toBe(
        "permissions:unauthorized",
      );
    }
    expect(codeOf(await medicationService.update(u.viewer.ctx, medication.id, { name: "Nope" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await medicationService.remove(u.viewer.ctx, medication.id))).toBe(
      "permissions:unauthorized",
    );
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await medicationService.update(u[role].ctx, medication.id, { name: "Nope" }))).toBe(
        "medicationService:notFound",
      );
      expect(codeOf(await medicationService.remove(u[role].ctx, medication.id))).toBe(
        "medicationService:notFound",
      );
      expect(await medicationService.getById(u[role].ctx, medication.id)).toBeNull();
    }
    expect(ok(await medicationService.getById(u.viewer.ctx, medication.id))).toMatchObject({
      name: "Lisinopril",
    });
    expect(ok(await medicationService.getById(u.owner.ctx, medication.id))).toMatchObject({
      name: "Lisinopril",
    });
  });

  it("stores the details, sorts the schedule, and validates the merged medication on update", async () => {
    const { u, addMedication } = await setup();
    const medication = await addMedication({
      directions: "With breakfast",
      reason: "Blood pressure",
      schedule: { type: "scheduled", times: ["20:00", "08:00"] },
      startedOn: "2026-10-01",
      lastFilledOn: "2026-11-01",
      quantity: "30 tablets",
      refillsLeft: 3,
      rxNumber: "RX 0104",
    });
    expect(medication).toMatchObject({
      // Written in the old shape (an older build's), stored as slots.
      schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
      startedOn: "2026-10-01",
      lastFilledOn: "2026-11-01",
      quantity: "30 tablets",
      refillsLeft: 3,
      rxNumber: "RX 0104",
      stoppedOn: null,
    });

    for (const bad of [
      { name: "  " },
      { refillsLeft: -1 },
      { startedOn: "soon" },
      { form: "pill" as never },
    ]) {
      expect(codeOf(await medicationService.update(u.caretaker.ctx, medication.id, bad))).toBe(
        "medicationService:invalid",
      );
    }
    expect(
      codeOf(
        await medicationService.update(u.caretaker.ctx, medication.id, {
          schedule: { type: "scheduled", times: ["08:00", "08:00"] },
        }),
      ),
    ).toBe("medicationService:invalid");
    const asNeeded = ok(
      await medicationService.update(u.caretaker.ctx, medication.id, {
        schedule: { type: "asNeeded", maxPerDay: 4 },
        reason: "",
      }),
    );
    expect(asNeeded).toMatchObject({ schedule: { type: "asNeeded", maxPerDay: 4 }, reason: null });
  });

  it("takes a known type or none, refuses another, and the column checks it too", async () => {
    const { u, group, recipient, addMedication, input } = await setup();
    const untyped = await addMedication();
    expect(untyped.type).toBeNull();
    const otc = await addMedication({ name: "Ibuprofen", type: "otc" });
    expect(otc.type).toBe("otc");

    expect(
      ok(await medicationService.update(u.caretaker.ctx, untyped.id, { type: "supplement" })),
    ).toMatchObject({ type: "supplement" });
    expect(ok(await medicationService.update(u.caretaker.ctx, otc.id, { type: null }))).toMatchObject({
      type: null,
    });
    // An edit that doesn't name the type leaves it as it was.
    expect(
      ok(await medicationService.update(u.caretaker.ctx, untyped.id, { dose: "2 tablets" })),
    ).toMatchObject({ type: "supplement" });

    const vitamin = await medicationService.create(u.caretaker.ctx, input({ type: "vitamin" as never }));
    expect(codeOf(vitamin)).toBe("medicationService:invalid");
    expect(issuesOf(vitamin)).toEqual(["type"]);
    expect(
      codeOf(await medicationService.update(u.caretaker.ctx, otc.id, { type: "vitamin" as never })),
    ).toBe("medicationService:invalid");

    // The database refuses one written past the service.
    const direct = (type: string) =>
      getDb()
        .insert(medicationSchema)
        .values({
          groupId: group.id,
          recipientId: recipient.id,
          name: "Mystery",
          schedule: { type: "asNeeded" },
          type: type as never,
          createdBy: u.caretaker.user.id,
          updatedBy: u.caretaker.user.id,
        })
        .returning({ type: medicationSchema.type });
    expect(await direct("other")).toEqual([{ type: "other" }]);
    await expect(direct("vitamin")).rejects.toMatchObject({ cause: { constraint: "medication_type_check" } });
  });

  it("refuses another group's recipient, and a group and recipient never change", async () => {
    const { u, input, addMedication } = await setup();
    const other = await setup();
    expect(
      codeOf(await medicationService.create(u.caretaker.ctx, input({ recipientId: other.recipient.id }))),
    ).toBe("medicationService:recipientNotInGroup");
    const medication = await addMedication();
    expect(
      codeOf(
        await medicationService.update(u.caretaker.ctx, medication.id, { groupId: other.group.id } as never),
      ),
    ).toBe("medicationService:invalid");
    expect(
      codeOf(
        await medicationService.upsert(u.caretaker.ctx, {
          ...input(),
          id: medication.id,
          groupId: other.group.id,
        }),
      ),
    ).toBe("medicationService:immutable");
  });
});

describe("medicationService: status", () => {
  it("needs a stop date to complete, and a reason too to discontinue", async () => {
    const { u, addMedication } = await setup();
    const medication = await addMedication();
    const update = (patch: Parameters<typeof medicationService.update>[2]) =>
      medicationService.update(u.caretaker.ctx, medication.id, patch);

    const noDate = await update({ status: "completed" });
    expect(codeOf(noDate)).toBe("medicationService:invalid");
    expect(issuesOf(noDate)).toEqual(["stoppedOn"]);

    const noReason = await update({ status: "discontinued", stoppedOn: "2026-11-10" });
    expect(codeOf(noReason)).toBe("medicationService:invalid");
    expect(issuesOf(noReason)).toEqual(["stopReason"]);
    expect(ok(await medicationService.getById(u.viewer.ctx, medication.id))).toMatchObject({
      status: "current",
    });

    expect(ok(await update({ status: "completed", stoppedOn: "2026-11-10" }))).toMatchObject({
      status: "completed",
      stoppedOn: "2026-11-10",
      stopReason: null,
    });
    expect(
      ok(
        await update({
          status: "discontinued",
          stoppedOn: "2026-11-12",
          stopReason: "sideEffects",
          stopNote: "Dizzy on standing",
        }),
      ),
    ).toMatchObject({
      status: "discontinued",
      stoppedOn: "2026-11-12",
      stopReason: "sideEffects",
      stopNote: "Dizzy on standing",
    });
  });

  it("clears the stop date, reason and note when it's current again", async () => {
    const { u, addMedication } = await setup();
    const medication = await addMedication({
      status: "discontinued",
      stoppedOn: "2026-11-12",
      stopReason: "ineffective",
      stopNote: "No change after a month",
    });
    expect(medication).toMatchObject({ status: "discontinued", stopReason: "ineffective" });
    expect(
      ok(await medicationService.update(u.caretaker.ctx, medication.id, { status: "current" })),
    ).toMatchObject({
      status: "current",
      stoppedOn: null,
      stopReason: null,
      stopNote: null,
    });
  });

  it("refuses a discontinued medication with no reason on create too", async () => {
    const { u, input } = await setup();
    const res = await medicationService.create(
      u.caretaker.ctx,
      input({ status: "discontinued", stoppedOn: "2026-11-12" }),
    );
    expect(codeOf(res)).toBe("medicationService:invalid");
    expect(issuesOf(res)).toEqual(["stopReason"]);
  });
});

describe("medicationService: prescriber and pharmacy", () => {
  it("takes a clinician or practice as prescriber, and only a pharmacy as pharmacy", async () => {
    const { u, input, addMedication, addProvider } = await setup();
    const clinician = await addProvider();
    const practice = await addProvider({ type: "practice", name: "Westside Clinic" });
    const pharmacy = await addProvider({ type: "pharmacy", name: "Corner Pharmacy" });
    const aide = await addProvider({ type: "other", name: "An aide" });

    const medication = await addMedication({ prescriberId: clinician.id, pharmacyId: pharmacy.id });
    expect(medication).toMatchObject({ prescriberId: clinician.id, pharmacyId: pharmacy.id });
    expect(
      ok(await medicationService.update(u.caretaker.ctx, medication.id, { prescriberId: practice.id })),
    ).toMatchObject({ prescriberId: practice.id });

    for (const prescriberId of [pharmacy.id, aide.id]) {
      const res = await medicationService.create(u.caretaker.ctx, input({ prescriberId }));
      expect(codeOf(res)).toBe("medicationService:badPrescriber");
      expect(issuesOf(res)).toEqual(["prescriberId"]);
    }
    for (const pharmacyId of [clinician.id, practice.id, aide.id]) {
      const res = await medicationService.update(u.caretaker.ctx, medication.id, { pharmacyId });
      expect(codeOf(res)).toBe("medicationService:badPharmacy");
      expect(issuesOf(res)).toEqual(["pharmacyId"]);
    }
    expect(
      ok(
        await medicationService.update(u.caretaker.ctx, medication.id, {
          prescriberId: null,
          pharmacyId: null,
        }),
      ),
    ).toMatchObject({ prescriberId: null, pharmacyId: null });
  });

  it("refuses a provider from another group, an unknown one and a deleted one", async () => {
    const { u, input, addProvider } = await setup();
    const other = await setup();
    const theirs = await other.addProvider();
    const theirPharmacy = await other.addProvider({ type: "pharmacy", name: "Their Pharmacy" });
    const deleted = await addProvider();
    ok(await providerService.remove(u.caretaker.ctx, deleted.id));

    for (const prescriberId of [theirs.id, randomUUID(), deleted.id]) {
      expect(codeOf(await medicationService.create(u.caretaker.ctx, input({ prescriberId })))).toBe(
        "medicationService:badPrescriber",
      );
    }
    expect(
      codeOf(await medicationService.create(u.caretaker.ctx, input({ pharmacyId: theirPharmacy.id }))),
    ).toBe("medicationService:badPharmacy");
  });

  it("keeps a prescriber who is deleted later, and still saves other edits", async () => {
    const { u, addMedication, addProvider } = await setup();
    const clinician = await addProvider();
    const medication = await addMedication({ prescriberId: clinician.id });
    ok(await providerService.remove(u.caretaker.ctx, clinician.id));

    expect(
      ok(await medicationService.update(u.caretaker.ctx, medication.id, { dose: "2 tablets" })),
    ).toMatchObject({
      dose: "2 tablets",
      prescriberId: clinician.id,
    });
  });
});

describe("medicationService: reading and deleting", () => {
  it("lists current medications first, then the rest, each by name, to members only", async () => {
    const { u, group, addMedication } = await setup();
    await addMedication({ name: "Zinc" });
    await addMedication({ name: "Amoxicillin", status: "completed", stoppedOn: "2026-11-01" });
    await addMedication({ name: "Metformin" });
    await addMedication({
      name: "Baclofen",
      status: "discontinued",
      stoppedOn: "2026-11-01",
      stopReason: "other",
    });

    const names = async (ctx: (typeof u)["owner"]["ctx"]) =>
      ok(await medicationService.list(ctx, { groupId: group.id })).data.map((m) => m.name);
    expect(await names(u.viewer.ctx)).toEqual(["Metformin", "Zinc", "Amoxicillin", "Baclofen"]);
    expect(await names(u.outsider.ctx)).toEqual([]);
    expect(await names(u.staff.ctx)).toEqual([]);
  });

  it("soft deletes: gone from lists and reads, kept for those who ask, and not editable", async () => {
    const { u, group, addMedication } = await setup();
    const keep = await addMedication({ name: "Keep" });
    const gone = await addMedication({ name: "Gone" });
    ok(await medicationService.remove(u.caretaker.ctx, gone.id));

    expect(
      ok(await medicationService.list(u.viewer.ctx, { groupId: group.id })).data.map((m) => m.id),
    ).toEqual([keep.id]);
    expect(await medicationService.getById(u.owner.ctx, gone.id)).toBeNull();
    const kept = ok(await medicationService.getById(u.owner.ctx, gone.id, { includeDeleted: true }));
    expect(kept?.deletedAt).not.toBeNull();
    expect(
      ok(await medicationService.list(u.viewer.ctx, { groupId: group.id, includeDeleted: true })).data,
    ).toHaveLength(2);

    expect(codeOf(await medicationService.update(u.caretaker.ctx, gone.id, { name: "Back" }))).toBe(
      "medicationService:notFound",
    );
    expect(codeOf(await medicationService.remove(u.caretaker.ctx, gone.id))).toBe(
      "medicationService:notFound",
    );
  });
});

describe("medicationService: change entries", () => {
  it("writes one 'started' entry on create, with the derived id, as the actor, in the recipient's zone", async () => {
    const { u, group, recipient, input, changesOf } = await setup();
    const changedAt = "2026-11-17T21:45:25.229Z";
    const medication = ok(await medicationService.create(u.caretaker.ctx, input(), { changedAt }))!;

    const changes = await changesOf(medication.id);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      id: medicationChangeId(medication.id, changedAt),
      groupId: group.id,
      recipientId: recipient.id,
      kind: "medicationChange",
      timeZone: "America/Los_Angeles",
      title: null,
      body: null,
      createdBy: u.caretaker.user.id,
      details: {
        medicationId: medication.id,
        change: "started",
        after: { name: "Lisinopril", strength: "10 mg", dose: "1 tablet" },
      },
    });
    expect(new Date(changes[0]!.occurredAt).toISOString()).toBe(changedAt);
    // Every member sees it on the timeline.
    const page = ok(
      await timelineEntryService.list(u.viewer.ctx, { groupId: group.id, kinds: ["medicationChange"] }),
    );
    expect(page.data.map((e) => e.id)).toEqual([changes[0]!.id]);
  });

  it("derives the id from the time of the save when the caller gives none", async () => {
    const { changesOf, addMedication } = await setup();
    const before = Date.now();
    const medication = await addMedication();
    const [started] = await changesOf(medication.id);
    expect(started?.id).toBe(medicationChangeId(medication.id, started!.occurredAt));
    expect(Date.parse(started!.occurredAt)).toBeGreaterThanOrEqual(before - 1000);
  });

  it("writes one 'changed' entry for a dose change, with before and after", async () => {
    const { u, addMedication, changesOf } = await setup();
    const medication = await addMedication();
    const changedAt = "2026-11-18T09:00:00.000Z";
    ok(await medicationService.update(u.admin.ctx, medication.id, { dose: "2 tablets" }, { changedAt }));

    const changes = await changesOf(medication.id);
    expect(changes.map((c) => (c.details as MedicationChangeDetails).change)).toContain("changed");
    expect(changes).toHaveLength(2);
    const changed = changes.find((c) => c.id === medicationChangeId(medication.id, changedAt));
    expect(changed).toMatchObject({
      createdBy: u.admin.user.id,
      details: {
        medicationId: medication.id,
        change: "changed",
        fields: ["dose"],
        before: { dose: "1 tablet" },
        after: { dose: "2 tablets" },
      },
    });
  });

  it("writes one 'stopped' entry on discontinue and one 'resumed' on restart", async () => {
    const { u, addMedication, changesOf } = await setup();
    const medication = await addMedication();
    const stoppedAt = "2026-11-18T09:00:00.000Z";
    const resumedAt = "2026-11-19T09:00:00.000Z";
    ok(
      await medicationService.update(
        u.caretaker.ctx,
        medication.id,
        { status: "discontinued", stoppedOn: "2026-11-18", stopReason: "sideEffects", stopNote: "Cough" },
        { changedAt: stoppedAt },
      ),
    );
    ok(
      await medicationService.update(
        u.caretaker.ctx,
        medication.id,
        { status: "current" },
        { changedAt: resumedAt },
      ),
    );

    const changes = await changesOf(medication.id);
    expect(changes).toHaveLength(3);
    expect(changes.find((c) => c.id === medicationChangeId(medication.id, stoppedAt))?.details).toEqual({
      medicationId: medication.id,
      change: "stopped",
      stopStatus: "discontinued",
      stopReason: "sideEffects",
      stopNote: "Cough",
    });
    expect(changes.find((c) => c.id === medicationChangeId(medication.id, resumedAt))?.details).toEqual({
      medicationId: medication.id,
      change: "resumed",
    });
  });

  it("writes none for a refill, reason, provider or type edit, or a save that changes nothing", async () => {
    const { u, addMedication, addProvider, changesOf } = await setup();
    const medication = await addMedication();
    const clinician = await addProvider();
    const pharmacy = await addProvider({ type: "pharmacy", name: "Corner Pharmacy" });

    for (const patch of [
      { lastFilledOn: "2026-11-01", quantity: "30 tablets", refillsLeft: 2, rxNumber: "RX 1" },
      { prescriberId: clinician.id, pharmacyId: pharmacy.id },
      { reason: "Blood pressure", startedOn: "2026-01-01" },
      { type: "supplement" as const },
      { type: "other" as const },
      { dose: "1 tablet" },
      {},
    ]) {
      ok(await medicationService.update(u.caretaker.ctx, medication.id, patch));
    }
    const changes = await changesOf(medication.id);
    expect(changes.map((c) => (c.details as MedicationChangeDetails).change)).toEqual(["started"]);
  });

  it("writes none when the update fails, and none for a delete", async () => {
    const { u, addMedication, changesOf } = await setup();
    const medication = await addMedication();

    expect(
      codeOf(await medicationService.update(u.caretaker.ctx, medication.id, { status: "discontinued" })),
    ).toBe("medicationService:invalid");
    expect(codeOf(await medicationService.update(u.viewer.ctx, medication.id, { dose: "9 tablets" }))).toBe(
      "permissions:unauthorized",
    );
    expect(
      codeOf(
        await medicationService.update(u.caretaker.ctx, medication.id, {
          dose: "2 tablets",
          pharmacyId: randomUUID(),
        }),
      ),
    ).toBe("medicationService:badPharmacy");
    expect(await changesOf(medication.id)).toHaveLength(1);
    expect(ok(await medicationService.getById(u.viewer.ctx, medication.id))).toMatchObject({
      dose: "1 tablet",
    });

    ok(await medicationService.remove(u.caretaker.ctx, medication.id));
    expect(await changesOf(medication.id)).toHaveLength(1);
  });

  it("saves the medication and its entry in one transaction: both or neither", async () => {
    const { u, input, addMedication, changesOf } = await setup();
    const id = randomUUID();
    const rolledBack = await withTransaction(async (tx) => {
      const created = ok(await medicationService.create({ ...u.caretaker.ctx, tx }, { ...input(), id }));
      // Inside the transaction both rows are there.
      expect(created?.id).toBe(id);
      const entries = await tx
        .select()
        .from(timelineEntrySchema)
        .where(eq(timelineEntrySchema.kind, "medicationChange"));
      expect(entries.some((e) => (e.details as MedicationChangeDetails).medicationId === id)).toBe(true);
      return newError({ code: "error" });
    });
    expect(isError(rolledBack)).toBe(true);
    expect(await medicationService.getById(u.owner.ctx, id, { includeDeleted: true })).toBeNull();
    expect(await changesOf(id)).toHaveLength(0);

    const medication = await addMedication();
    await withTransaction(async (tx) => {
      ok(await medicationService.update({ ...u.caretaker.ctx, tx }, medication.id, { dose: "2 tablets" }));
      return newError({ code: "error" });
    });
    expect(ok(await medicationService.getById(u.owner.ctx, medication.id))).toMatchObject({
      dose: "1 tablet",
    });
    expect(await changesOf(medication.id)).toHaveLength(1);
  });

  it("is idempotent on the derived id: a replayed save adds no second entry", async () => {
    const { u, input, changesOf } = await setup();
    const id = randomUUID();
    const changedAt = "2026-11-17T21:45:25.229Z";
    ok(await medicationService.upsert(u.caretaker.ctx, { ...input(), id }, { changedAt }));
    ok(await medicationService.upsert(u.caretaker.ctx, { ...input(), id }, { changedAt }));
    // A replay stamped later changes nothing, so it records nothing.
    ok(
      await medicationService.upsert(
        u.caretaker.ctx,
        { ...input(), id },
        { changedAt: "2026-11-17T22:00:00.000Z" },
      ),
    );
    expect(await changesOf(id)).toHaveLength(1);

    const edit = { changedAt: "2026-11-18T08:00:00.000000Z" };
    ok(await medicationService.update(u.caretaker.ctx, id, { strength: "20 mg" }, edit));
    ok(await medicationService.update(u.caretaker.ctx, id, { strength: "20 mg" }, edit));
    const changes = await changesOf(id);
    expect(changes).toHaveLength(2);
    expect(changes[1]?.id).toBe(medicationChangeId(id, "2026-11-18T08:00:00.000Z"));
  });

  it("can't be created or edited by hand, but a writer can delete one", async () => {
    const { u, group, addMedication, changesOf } = await setup();
    const medication = await addMedication();
    const [started] = await changesOf(medication.id);

    expect(
      codeOf(
        await timelineEntryService.create(u.owner.ctx, {
          groupId: group.id,
          kind: "medicationChange",
          occurredAt: "2026-11-17T16:05:00.000Z",
          timeZone: "America/Los_Angeles",
          details: { medicationId: medication.id, change: "resumed" },
        }),
      ),
    ).toBe("timelineEntryService:systemWrittenKind");
    expect(
      codeOf(
        await timelineEntryService.update(u.owner.ctx, started!.id, {
          occurredAt: "2026-11-01T00:00:00.000Z",
        }),
      ),
    ).toBe("timelineEntryService:systemWrittenKind");
    // A device's upload of the entry the service already wrote leaves the service's as it is.
    const uploaded = ok(
      await timelineEntryService.upsert(u.caretaker.ctx, {
        id: started!.id,
        groupId: group.id,
        kind: "medicationChange",
        occurredAt: "2026-11-01T00:00:00.000Z",
        timeZone: "UTC",
        details: { medicationId: medication.id, change: "resumed" },
      }),
    );
    expect(uploaded).toMatchObject({
      id: started!.id,
      details: { change: "started" },
      timeZone: "America/Los_Angeles",
    });

    expect(codeOf(await timelineEntryService.remove(u.viewer.ctx, started!.id))).toBe(
      "timelineEntryService:notFound",
    );
    ok(await timelineEntryService.remove(u.caretaker.ctx, started!.id));
    expect((await changesOf(medication.id))[0]?.deletedAt).not.toBeNull();
    expect(ok(await medicationService.getById(u.viewer.ctx, medication.id))).toMatchObject({
      status: "current",
    });
  });
});

describe("timelineEntryService: doses", () => {
  it("lets writers log, edit and delete a dose of the group's medication; viewers can't", async () => {
    const { u, group, addMedication, addDose } = await setup();
    const medication = await addMedication();

    expect(codeOf(await addDose(u.viewer.ctx, medication.id))).toBe("permissions:unauthorized");
    const dose = ok(await addDose(u.caretaker.ctx, medication.id))!;
    expect(dose).toMatchObject({
      kind: "dose",
      groupId: group.id,
      title: null,
      body: null,
      details: { medicationId: medication.id, status: "given", amount: "1 tablet", scheduledFor: "08:00" },
      createdBy: u.caretaker.user.id,
    });

    const edited = ok(
      await timelineEntryService.update(u.admin.ctx, dose.id, {
        details: { medicationId: medication.id, status: "refused", note: "Didn't want it" },
      }),
    );
    expect(edited).toMatchObject({ details: { status: "refused", note: "Didn't want it" } });
    expect(codeOf(await timelineEntryService.update(u.admin.ctx, dose.id, { title: "Lisinopril" }))).toBe(
      "timelineEntryService:invalid",
    );
    expect(codeOf(await timelineEntryService.update(u.admin.ctx, dose.id, { details: null }))).toBe(
      "timelineEntryService:invalid",
    );

    const page = ok(await timelineEntryService.list(u.viewer.ctx, { groupId: group.id, kinds: ["dose"] }));
    expect(page.data.map((e) => e.id)).toEqual([dose.id]);
    ok(await timelineEntryService.remove(u.caretaker.ctx, dose.id));
    expect(
      ok(await timelineEntryService.list(u.viewer.ctx, { groupId: group.id, kinds: ["dose"] })).data,
    ).toEqual([]);
  });

  it("refuses a dose for another group's medication, or one that doesn't exist", async () => {
    const { u, addMedication, addDose } = await setup();
    const other = await setup();
    const mine = await addMedication();
    const theirs = await other.addMedication();

    const res = await addDose(u.caretaker.ctx, theirs.id);
    expect(codeOf(res)).toBe("timelineEntryService:medicationNotInGroup");
    expect(issuesOf(res)).toEqual(["details.medicationId"]);
    expect(codeOf(await addDose(u.caretaker.ctx, randomUUID()))).toBe(
      "timelineEntryService:medicationNotInGroup",
    );
    // Not in their group either: the outsider isn't a member of it.
    expect(codeOf(await addDose(u.caretaker.ctx, theirs.id, other.group.id))).toBe(
      "permissions:unauthorized",
    );

    const dose = ok(await addDose(u.caretaker.ctx, mine.id))!;
    expect(
      codeOf(
        await timelineEntryService.update(u.caretaker.ctx, dose.id, {
          details: { medicationId: theirs.id, status: "given" },
        }),
      ),
    ).toBe("timelineEntryService:medicationNotInGroup");
    expect(
      codeOf(
        await timelineEntryService.upsert(u.caretaker.ctx, {
          id: randomUUID(),
          groupId: dose.groupId,
          kind: "dose",
          occurredAt: "2026-11-17T16:05:00.000Z",
          timeZone: "America/Los_Angeles",
          details: { medicationId: theirs.id, status: "given" },
        }),
      ),
    ).toBe("timelineEntryService:medicationNotInGroup");
  });

  it("keeps a medication's doses and changes when the medication is deleted", async () => {
    const { u, group, addMedication, addDose, changesOf } = await setup();
    const medication = await addMedication();
    const dose = ok(await addDose(u.caretaker.ctx, medication.id))!;
    ok(await medicationService.remove(u.caretaker.ctx, medication.id));

    expect(ok(await timelineEntryService.getById(u.viewer.ctx, dose.id))).toMatchObject({ id: dose.id });
    expect((await changesOf(medication.id)).every((c) => c.deletedAt === null)).toBe(true);
    // A replayed upload of a dose logged before the delete still lands.
    expect(
      ok(
        await timelineEntryService.upsert(u.caretaker.ctx, {
          id: dose.id,
          groupId: group.id,
          kind: "dose",
          occurredAt: "2026-11-17T16:05:00.000Z",
          timeZone: "America/Los_Angeles",
          details: { medicationId: medication.id, status: "skipped" },
        }),
      ),
    ).toMatchObject({ details: { status: "skipped" } });
  });
});

describe("noteDocumentService: medication notes", () => {
  it("creates a medication's document, takes updates, compacts, and cascades with the medication", async () => {
    const { u, group, addMedication } = await setup();
    const medication = await addMedication();
    const create = (ctx: (typeof u)["owner"]["ctx"]) =>
      noteDocumentService.create(ctx, { id: medication.id, groupId: group.id, subject: "medication" });

    expect(codeOf(await create(u.viewer.ctx))).toBe("permissions:unauthorized");
    const doc = ok(await create(u.caretaker.ctx));
    expect(doc).toMatchObject({
      id: medication.id,
      subject: "medication",
      medicationId: medication.id,
      entryId: null,
      providerId: null,
    });
    // Idempotent, and not an entry's or a provider's.
    expect(ok(await create(u.admin.ctx))).toMatchObject({
      id: medication.id,
      createdBy: u.caretaker.user.id,
    });
    expect(
      codeOf(await noteDocumentService.create(u.caretaker.ctx, { id: medication.id, groupId: group.id })),
    ).toBe("noteDocumentService:entryNotFound");
    expect(
      codeOf(
        await noteDocumentService.create(u.caretaker.ctx, {
          id: medication.id,
          groupId: group.id,
          subject: "provider",
        }),
      ),
    ).toBe("noteDocumentService:providerNotFound");

    const ydoc = new Y.Doc();
    for (const [who, text] of [
      [u.caretaker, "Crush into applesauce"],
      [u.admin, "Pharmacy needs 3 days' notice"],
    ] as const) {
      ok(
        await noteDocumentService.appendUpdate(who.ctx, {
          id: randomUUID(),
          groupId: group.id,
          documentId: medication.id,
          data: typeParagraph(ydoc, text),
        }),
      );
    }
    expect(ok(await noteDocumentService.currentText(u.viewer.ctx, medication.id))).toBe(
      "Crush into applesauce\nPharmacy needs 3 days' notice",
    );
    expect(ok(await noteDocumentService.compact(medication.id))).toEqual({ compacted: 2 });
    const compacted = ok(await noteDocumentService.getById(u.viewer.ctx, medication.id));
    expect(compacted.text).toBe("Crush into applesauce\nPharmacy needs 3 days' notice");
    expect(Object.keys(compacted.editors).sort()).toEqual([u.caretaker.user.id, u.admin.user.id].sort());
    expect(codeOf(await noteDocumentService.getById(u.outsider.ctx, medication.id))).toBe(
      "noteDocumentService:notFound",
    );

    // Soft delete hides it; a hard delete removes it and its updates.
    ok(
      await noteDocumentService.appendUpdate(u.caretaker.ctx, {
        id: randomUUID(),
        groupId: group.id,
        documentId: medication.id,
        data: typeParagraph(ydoc, "Pending"),
      }),
    );
    ok(await medicationService.remove(u.caretaker.ctx, medication.id));
    expect(codeOf(await noteDocumentService.getById(u.owner.ctx, medication.id))).toBe(
      "noteDocumentService:notFound",
    );
    expect(codeOf(await create(u.caretaker.ctx))).toBe("noteDocumentService:medicationNotFound");

    await getDb().delete(medicationSchema).where(eq(medicationSchema.id, medication.id));
    expect(await noteDocumentModel.getById(medication.id, system)).toBeNull();
    expect(
      ok(
        await noteUpdateModel.list({
          ...system,
          filter: { documentId: { type: "eq", value: medication.id } },
        }),
      ).count,
    ).toBe(0);
  });

  it("refuses an outsider, another group and an unknown medication", async () => {
    const { u, group, addMedication } = await setup();
    const other = await setup();
    const medication = await addMedication();
    const create = (ctx: (typeof u)["owner"]["ctx"], id: string, groupId: string) =>
      noteDocumentService.create(ctx, { id, groupId, subject: "medication" });

    expect(codeOf(await create(u.outsider.ctx, medication.id, group.id))).toBe(
      "noteDocumentService:medicationNotFound",
    );
    expect(codeOf(await create(u.caretaker.ctx, medication.id, other.group.id))).toBe(
      "noteDocumentService:immutable",
    );
    expect(codeOf(await create(u.caretaker.ctx, randomUUID(), group.id))).toBe(
      "noteDocumentService:medicationNotFound",
    );
  });
});

describe("care recipients: time zone", () => {
  it("keeps the zone a group is created with, and refuses one the runtime doesn't know", async () => {
    const { u, recipient } = await setup();
    expect(recipient.timeZone).toBe("America/Los_Angeles");

    const { careGroupService, careRecipientService } = await import(".");
    const bad = await careGroupService.create(u.outsider.ctx, {
      name: "Broken",
      recipient: { name: "Sam", timeZone: "Mars/Olympus_Mons" },
    });
    expect(codeOf(bad)).toBe("careRecipientService:invalidTimeZone");
    expect(ok(await careGroupService.list(u.outsider.ctx)).count).toBe(0);

    expect(
      codeOf(
        await careRecipientService.update(u.owner.ctx, {
          filter: { id: { type: "eq", value: recipient.id } },
          data: { timeZone: "Nowhere/Nope" },
        }),
      ),
    ).toBe("careRecipientService:invalidTimeZone");
    const moved = ok(
      await careRecipientService.update(u.owner.ctx, {
        filter: { id: { type: "eq", value: recipient.id } },
        data: { timeZone: "America/New_York" },
      }),
    );
    expect(moved[0]?.timeZone).toBe("America/New_York");
  });
});
