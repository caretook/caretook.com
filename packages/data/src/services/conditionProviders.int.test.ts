import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { conditionChangeId, conditionManagerId } from "../db/schema";
import { isError } from "../errors";
import { providerService, recipientConditionService, timelineEntryService } from ".";

// Who diagnosed a condition and who manages it (conditions slice 3): both
// must be live providers in the condition's group (another group's is
// `unauthorized`, a deleted one refused), manager links replay, viewers are
// refused, and every save is one change entry with the providers by name,
// however many links it makes. Every test builds its own group and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const at = (minute: number) => `2026-11-17T11:${String(minute).padStart(2, "0")}:00.000Z`;

const setup = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  const { group } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  const provider = async (name: string, groupId = group.id, ctx = owner.ctx) =>
    ok(await providerService.create(ctx, { groupId, type: "clinician", name }))!;
  const [lee, moss, park] = [
    await provider("Dr. Lee"),
    await provider("Dr. Ada Moss"),
    await provider("Park Clinic"),
  ];
  const condition = ok(
    await recipientConditionService.create(
      caretaker.ctx,
      { groupId: group.id, name: "Atrial fibrillation" },
      { changedAt: at(0) },
    ),
  )!;
  const changes = async () =>
    ok(
      await timelineEntryService.list(viewer.ctx, { groupId: group.id, kinds: ["conditionChange"] }),
    ).data.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const managers = async () =>
    ok(await recipientConditionService.listManagers(viewer.ctx, condition.id)).data.map((l) => l.providerId);
  return { owner, caretaker, viewer, group, lee, moss, park, condition, provider, changes, managers };
};

describe("recipientConditionService: diagnosed by", () => {
  it("records a live provider in the group, on create and edit, as a change by name", async () => {
    const { caretaker, group, lee, moss, condition, changes } = await setup();
    const made = ok(
      await recipientConditionService.create(
        caretaker.ctx,
        { groupId: group.id, name: "Type 2 diabetes", diagnosedById: lee.id },
        { changedAt: at(1) },
      ),
    )!;
    expect(made.diagnosedById).toBe(lee.id);
    ok(
      await recipientConditionService.update(
        caretaker.ctx,
        condition.id,
        { diagnosedById: moss.id },
        { changedAt: at(2) },
      ),
    );
    ok(
      await recipientConditionService.update(
        caretaker.ctx,
        condition.id,
        { diagnosedById: null },
        { changedAt: at(3) },
      ),
    );

    const entries = await changes();
    expect(entries.find((e) => e.id === conditionChangeId(made.id, at(1)))?.details).toMatchObject({
      change: "added",
      after: { diagnosedBy: "Dr. Lee" },
    });
    expect(
      entries.filter((e) => [at(2), at(3)].some((t) => e.id === conditionChangeId(condition.id, t))),
    ).toMatchObject([
      {
        details: {
          fields: ["diagnosedBy"],
          before: { diagnosedBy: null },
          after: { diagnosedBy: "Dr. Ada Moss" },
        },
      },
      {
        details: {
          fields: ["diagnosedBy"],
          before: { diagnosedBy: "Dr. Ada Moss" },
          after: { diagnosedBy: null },
        },
      },
    ]);
  });

  it("refuses another group's provider (unauthorized), a deleted one, and a viewer", async () => {
    const { owner, caretaker, viewer, group, lee, condition, provider } = await setup();
    const stranger = await createUser("stranger");
    const { group: other } = await createGroup(stranger);
    const theirs = await provider("Dr. Elsewhere", other.id, stranger.ctx);
    // Another of the actor's own groups: not this condition's.
    const { group: second } = await createGroup(owner);
    const mine = await provider("Dr. Second", second.id);
    const gone = await provider("Dr. Gone");
    ok(await providerService.remove(owner.ctx, gone.id));

    const set = (diagnosedById: string) =>
      recipientConditionService.update(caretaker.ctx, condition.id, { diagnosedById });
    expect(codeOf(await set(theirs.id))).toBe("permissions:unauthorized");
    expect(codeOf(await set(gone.id))).toBe("recipientConditionService:providerNotFound");
    expect(
      codeOf(await recipientConditionService.update(owner.ctx, condition.id, { diagnosedById: mine.id })),
    ).toBe("recipientConditionService:badProvider");
    expect(
      codeOf(
        await recipientConditionService.create(caretaker.ctx, {
          groupId: group.id,
          name: "Gout",
          diagnosedById: gone.id,
        }),
      ),
    ).toBe("recipientConditionService:providerNotFound");
    expect(
      codeOf(await recipientConditionService.update(viewer.ctx, condition.id, { diagnosedById: lee.id })),
    ).toBe("permissions:unauthorized");
  });

  it("keeps a provider deleted after it was chosen: other edits still save", async () => {
    const { owner, caretaker, lee, condition } = await setup();
    ok(await recipientConditionService.update(caretaker.ctx, condition.id, { diagnosedById: lee.id }));
    ok(await providerService.remove(owner.ctx, lee.id));
    const edited = ok(
      await recipientConditionService.update(caretaker.ctx, condition.id, { note: "Rate-controlled" }),
    )!;
    expect(edited.diagnosedById).toBe(lee.id);
  });
});

describe("recipientConditionService: managed by", () => {
  it("setManagers links and unlinks in one change entry, by name, and replays safely", async () => {
    const { caretaker, lee, moss, park, condition, changes, managers } = await setup();
    ok(
      await recipientConditionService.setManagers(
        caretaker.ctx,
        { conditionId: condition.id, providerIds: [lee.id, moss.id] },
        { changedAt: at(1) },
      ),
    );
    ok(
      await recipientConditionService.setManagers(
        caretaker.ctx,
        { conditionId: condition.id, providerIds: [moss.id, park.id] },
        { changedAt: at(2) },
      ),
    );
    // A replay: nothing to change, nothing recorded.
    ok(
      await recipientConditionService.setManagers(
        caretaker.ctx,
        { conditionId: condition.id, providerIds: [park.id, moss.id] },
        { changedAt: at(3) },
      ),
    );
    expect((await managers()).sort()).toEqual([moss.id, park.id].sort());

    const entries = await changes();
    expect(entries.map((e) => e.id)).toEqual(
      [at(0), at(1), at(2)].map((t) => conditionChangeId(condition.id, t)),
    );
    expect(entries.slice(1).map((e) => e.details)).toEqual([
      {
        conditionId: condition.id,
        conditionName: "Atrial fibrillation",
        change: "changed",
        fields: ["managedBy"],
        before: { managedBy: [] },
        after: { managedBy: ["Dr. Ada Moss", "Dr. Lee"] },
      },
      {
        conditionId: condition.id,
        conditionName: "Atrial fibrillation",
        change: "changed",
        fields: ["managedBy"],
        before: { managedBy: ["Dr. Ada Moss", "Dr. Lee"] },
        after: { managedBy: ["Dr. Ada Moss", "Park Clinic"] },
      },
    ]);
  });

  it("links replay: the same pair twice is one link with the pair's id; unlinking a missing link succeeds", async () => {
    const { caretaker, group, lee, condition, managers } = await setup();
    const input = { groupId: group.id, conditionId: condition.id, providerId: lee.id };
    const first = ok(await recipientConditionService.linkManager(caretaker.ctx, input))!;
    const again = ok(await recipientConditionService.linkManager(caretaker.ctx, input))!;
    expect(first.id).toBe(conditionManagerId(condition.id, lee.id));
    expect(again.id).toBe(first.id);
    expect(await managers()).toEqual([lee.id]);
    ok(await recipientConditionService.unlinkManager(caretaker.ctx, first.id));
    ok(await recipientConditionService.unlinkManager(caretaker.ctx, first.id));
    expect(await managers()).toEqual([]);
  });

  it("folds a save's links into its edit's entry when they share its time", async () => {
    const { caretaker, group, lee, moss, condition, changes } = await setup();
    ok(
      await recipientConditionService.update(
        caretaker.ctx,
        condition.id,
        { note: "Rate-controlled" },
        { changedAt: at(5) },
      ),
    );
    for (const providerId of [lee.id, moss.id])
      ok(
        await recipientConditionService.linkManager(
          caretaker.ctx,
          { groupId: group.id, conditionId: condition.id, providerId },
          { changedAt: at(5) },
        ),
      );
    const entries = await changes();
    expect(entries).toHaveLength(2);
    expect(entries[1]?.details).toMatchObject({
      change: "changed",
      fields: ["note", "managedBy"],
      before: { note: null, managedBy: [] },
      after: { note: "Rate-controlled", managedBy: ["Dr. Ada Moss", "Dr. Lee"] },
    });
  });

  it("refuses another group's provider (unauthorized), a deleted provider or condition, and a viewer", async () => {
    const { owner, caretaker, viewer, group, lee, condition, provider } = await setup();
    const stranger = await createUser("stranger");
    const { group: other } = await createGroup(stranger);
    const theirs = await provider("Dr. Elsewhere", other.id, stranger.ctx);
    const gone = await provider("Dr. Gone");
    ok(await providerService.remove(owner.ctx, gone.id));
    const link = (providerId: string, ctx = caretaker.ctx, conditionId = condition.id) =>
      recipientConditionService.linkManager(ctx, { groupId: group.id, conditionId, providerId });

    expect(codeOf(await link(theirs.id))).toBe("permissions:unauthorized");
    expect(codeOf(await link(gone.id))).toBe("recipientConditionService:providerNotFound");
    expect(codeOf(await link(lee.id, viewer.ctx))).toBe("permissions:unauthorized");
    expect(
      codeOf(
        await recipientConditionService.setManagers(caretaker.ctx, {
          conditionId: condition.id,
          providerIds: [lee.id, gone.id],
        }),
      ),
    ).toBe("recipientConditionService:providerNotFound");
    // The refused set left nothing behind.
    expect(ok(await recipientConditionService.listManagers(viewer.ctx, condition.id)).data).toEqual([]);

    const made = ok(await link(lee.id))!;
    expect(codeOf(await recipientConditionService.unlinkManager(viewer.ctx, made.id))).toBe(
      "permissions:unauthorized",
    );
    ok(await recipientConditionService.remove(caretaker.ctx, condition.id));
    expect(codeOf(await link(lee.id))).toBe("recipientConditionService:notFound");
  });

  it("a provider deleted after linking keeps its link (screens grey it)", async () => {
    const { owner, caretaker, group, lee, condition, managers } = await setup();
    ok(
      await recipientConditionService.linkManager(caretaker.ctx, {
        groupId: group.id,
        conditionId: condition.id,
        providerId: lee.id,
      }),
    );
    ok(await providerService.remove(owner.ctx, lee.id));
    expect(await managers()).toEqual([lee.id]);
  });
});
