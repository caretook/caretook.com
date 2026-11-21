import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { conditionChangeId } from "../db/schema";
import { isError } from "../errors";
import { recipientConditionService, timelineEntryService } from ".";

// A condition's history on the timeline (conditions slice 2): each service
// write that changes a condition records one `conditionChange` entry with
// it, under the id derived from the condition and the save's time; an edit
// that changes nothing and a delete record none; a refused write records
// none; nobody can create or edit one by hand. Every test builds its own
// group and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  const changes = async () =>
    ok(
      await timelineEntryService.list(viewer.ctx, { groupId: group.id, kinds: ["conditionChange"] }),
    ).data.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return { owner, caretaker, viewer, group, recipient, changes };
};

const at = (minute: number) => `2026-11-17T10:${String(minute).padStart(2, "0")}:00.000Z`;

describe("recipientConditionService: condition changes", () => {
  it("records added, changed, resolved and reactivated, one entry per write, with the derived id", async () => {
    const { caretaker, group, recipient, changes } = await setup();
    const condition = ok(
      await recipientConditionService.create(
        caretaker.ctx,
        { groupId: group.id, name: "Type 2 diabetes", sinceYear: 2015, note: "Diet-controlled" },
        { changedAt: at(1) },
      ),
    )!;
    ok(
      await recipientConditionService.update(
        caretaker.ctx,
        condition.id,
        { sinceYear: 2014 },
        { changedAt: at(2) },
      ),
    );
    ok(await recipientConditionService.resolve(caretaker.ctx, condition.id, { changedAt: at(3) }));
    ok(await recipientConditionService.reactivate(caretaker.ctx, condition.id, { changedAt: at(4) }));

    const entries = await changes();
    expect(entries.map((e) => e.id)).toEqual([1, 2, 3, 4].map((m) => conditionChangeId(condition.id, at(m))));
    expect(entries.map((e) => [e.kind, e.recipientId, e.timeZone, e.title, e.body, e.createdBy])).toEqual(
      Array(4).fill(["conditionChange", recipient.id, recipient.timeZone, null, null, caretaker.user.id]),
    );
    expect(entries.map((e) => e.details)).toEqual([
      {
        conditionId: condition.id,
        conditionName: "Type 2 diabetes",
        change: "added",
        after: {
          name: "Type 2 diabetes",
          status: "active",
          sinceYear: 2015,
          sinceMonth: null,
          note: "Diet-controlled",
        },
      },
      {
        conditionId: condition.id,
        conditionName: "Type 2 diabetes",
        change: "changed",
        fields: ["since"],
        before: { sinceYear: 2015, sinceMonth: null },
        after: { sinceYear: 2014, sinceMonth: null },
      },
      { conditionId: condition.id, conditionName: "Type 2 diabetes", change: "resolved" },
      { conditionId: condition.id, conditionName: "Type 2 diabetes", change: "reactivated" },
    ]);
    expect(new Date(entries[0]!.occurredAt).toISOString()).toBe(at(1));
  });

  it("records nothing for an edit that changes nothing, a replay, a delete or a refused write", async () => {
    const { caretaker, viewer, group, changes } = await setup();
    const condition = ok(
      await recipientConditionService.create(
        caretaker.ctx,
        { groupId: group.id, name: "Asthma" },
        {
          changedAt: at(1),
        },
      ),
    )!;
    expect(await changes()).toHaveLength(1);

    ok(
      await recipientConditionService.update(
        caretaker.ctx,
        condition.id,
        { name: "Asthma" },
        { changedAt: at(2) },
      ),
    );
    // The same save replayed lands on the same entry.
    ok(await recipientConditionService.resolve(caretaker.ctx, condition.id, { changedAt: at(3) }));
    ok(
      await recipientConditionService.update(
        caretaker.ctx,
        condition.id,
        { note: "Mild" },
        { changedAt: at(4) },
      ),
    );
    ok(
      await recipientConditionService.update(
        caretaker.ctx,
        condition.id,
        { note: "Mild" },
        { changedAt: at(4) },
      ),
    );
    expect(
      codeOf(await recipientConditionService.update(viewer.ctx, condition.id, { note: "Severe" })),
    ).not.toBe("ok");
    ok(await recipientConditionService.remove(caretaker.ctx, condition.id));

    expect((await changes()).map((e) => (e.details as { change: string }).change)).toEqual([
      "added",
      "resolved",
      "changed",
    ]);
  });

  it("writes the entry in the condition's transaction: a refused create leaves neither", async () => {
    const { viewer, owner, group, changes } = await setup();
    expect(
      codeOf(await recipientConditionService.create(viewer.ctx, { groupId: group.id, name: "Gout" })),
    ).not.toBe("ok");
    expect(await changes()).toEqual([]);
    expect(ok(await recipientConditionService.list(owner.ctx, { groupId: group.id })).data).toEqual([]);
  });

  it("upserts like a device: a new id is added, a replay records nothing more", async () => {
    const { owner, group, recipient, changes } = await setup();
    const id = crypto.randomUUID();
    const input = { id, groupId: group.id, recipientId: recipient.id, name: "Glaucoma" };
    ok(
      await recipientConditionService.upsert(owner.ctx, input, { changedAt: "2026-11-17 10:01:00.000000Z" }),
    );
    ok(await recipientConditionService.upsert(owner.ctx, input, { changedAt: at(5) }));
    expect((await changes()).map((e) => e.id)).toEqual([conditionChangeId(id, at(1))]);
  });

  it("refuses a condition change made by hand, and an edit of one", async () => {
    const { owner, caretaker, group, changes } = await setup();
    const condition = ok(
      await recipientConditionService.create(owner.ctx, { groupId: group.id, name: "Anemia" }),
    )!;
    const details = { conditionId: condition.id, conditionName: "Anemia", change: "resolved" as const };
    expect(
      codeOf(
        await timelineEntryService.create(caretaker.ctx, {
          groupId: group.id,
          kind: "conditionChange",
          occurredAt: at(9),
          timeZone: "America/Los_Angeles",
          details,
        }),
      ),
    ).toBe("timelineEntryService:systemWrittenKind");
    const [entry] = await changes();
    expect(codeOf(await timelineEntryService.update(owner.ctx, entry!.id, { occurredAt: at(9) }))).toBe(
      "timelineEntryService:systemWrittenKind",
    );
    // A writer may still delete one, as a correction.
    expect(codeOf(await timelineEntryService.remove(owner.ctx, entry!.id))).toBe("ok");
  });
});
