import type { CarePeriodCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createWorld, ok } from "../../test/fixtures";
import { toChangeTime } from "../db/schema";
import { isError } from "../errors";
import { carePeriodService, noteDocumentService, providerService } from ".";
import { periodSpans } from "../domain/care-periods/carePeriodTrack";

// Every test builds its own group and users, so tests never depend on each other.

const WRITERS = ["owner", "admin", "caretaker"] as const;
const NON_WRITERS = ["viewer", "outsider", "staff"] as const;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const issuesOf = (res: unknown) =>
  isError(res)
    ? ((res.meta as { issues?: { path: string }[] } | undefined)?.issues ?? []).map((i) => i.path)
    : [];

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

const setup = async () => {
  const { u, group, recipient } = await createWorld({ extras: ["outsider", "staff"] });
  const input = (overrides: Partial<CarePeriodCreateInput> = {}): CarePeriodCreateInput => ({
    groupId: group.id,
    type: "hospital",
    label: "Mercy General",
    startedAt: ago(48),
    ...overrides,
  });
  const addPeriod = async (overrides: Partial<CarePeriodCreateInput> = {}) => {
    const period = ok(await carePeriodService.create(u.caretaker.ctx, input(overrides)));
    if (!period) throw new Error("period not readable");
    return period;
  };
  const addProvider = async (groupId = group.id, ctx = u.caretaker.ctx) => {
    const provider = ok(
      await providerService.create(ctx, { groupId, type: "practice", name: "Mercy General Hospital" }),
    );
    if (!provider) throw new Error("provider not readable");
    return provider;
  };
  return { u, group, recipient, input, addPeriod, addProvider };
};

describe("carePeriodService: writing", () => {
  it("lets writers create, update and delete; viewers, outsiders and staff can't", async () => {
    const { u, group, recipient, input, addPeriod } = await setup();

    for (const role of WRITERS) {
      const created = ok(await carePeriodService.create(u[role].ctx, input({ label: `By ${role}` })));
      expect(created).toMatchObject({
        groupId: group.id,
        recipientId: recipient.id,
        type: "hospital",
        label: `By ${role}`,
        dateOnly: false,
        createdBy: u[role].user.id,
      });
      const updated = ok(await carePeriodService.update(u[role].ctx, created!.id, { placeDetail: "Room 4" }));
      expect(updated).toMatchObject({ placeDetail: "Room 4", updatedBy: u[role].user.id });
      ok(await carePeriodService.remove(u[role].ctx, created!.id));
      expect(await carePeriodService.getById(u.owner.ctx, created!.id)).toBeNull();
    }

    const period = await addPeriod();
    for (const role of NON_WRITERS) {
      expect(codeOf(await carePeriodService.create(u[role].ctx, input()))).toBe("permissions:unauthorized");
    }
    expect(codeOf(await carePeriodService.update(u.viewer.ctx, period.id, { label: "Nope" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await carePeriodService.remove(u.viewer.ctx, period.id))).toBe("permissions:unauthorized");
    for (const role of ["outsider", "staff"] as const) {
      expect(codeOf(await carePeriodService.update(u[role].ctx, period.id, { label: "Nope" }))).toBe(
        "carePeriodService:notFound",
      );
      expect(codeOf(await carePeriodService.remove(u[role].ctx, period.id))).toBe(
        "carePeriodService:notFound",
      );
    }
  });

  it("lets every member read the group's periods, in track order; nobody else", async () => {
    const { u, group, addPeriod } = await setup();
    const later = await addPeriod({ type: "home", startedAt: ago(2) });
    const earlier = await addPeriod({ type: "hospital", startedAt: ago(30) });

    for (const role of [...WRITERS, "viewer"] as const) {
      const page = ok(await carePeriodService.list(u[role].ctx, { groupId: group.id }));
      expect(page.data.map((p) => p.id)).toEqual([earlier.id, later.id]);
    }
    for (const role of ["outsider", "staff"] as const) {
      expect(ok(await carePeriodService.list(u[role].ctx, { groupId: group.id })).data).toEqual([]);
      expect(await carePeriodService.getById(u[role].ctx, earlier.id)).toBeNull();
    }
  });

  it("refuses a start in the future (past the server's hour), on create and on update", async () => {
    const { u, input, addPeriod } = await setup();
    const tomorrow = new Date(Date.now() + 24 * HOUR).toISOString();
    const create = await carePeriodService.create(u.caretaker.ctx, input({ startedAt: tomorrow }));
    expect(codeOf(create)).toBe("carePeriodService:futureStart");
    expect(issuesOf(create)).toEqual(["startedAt"]);

    // A device clock a few minutes fast is fine.
    ok(
      await carePeriodService.create(
        u.caretaker.ctx,
        input({ startedAt: new Date(Date.now() + 10 * 60_000).toISOString() }),
      ),
    );

    const period = await addPeriod();
    expect(codeOf(await carePeriodService.update(u.caretaker.ctx, period.id, { startedAt: tomorrow }))).toBe(
      "carePeriodService:futureStart",
    );
  });

  it("wants a date-only start at the start of its day in the recipient's zone", async () => {
    const { u, input } = await setup();
    // Midnight Nov 15 2026 in Los Angeles, and midnight UTC that day.
    ok(
      await carePeriodService.create(
        u.caretaker.ctx,
        input({ startedAt: "2026-11-15T08:00:00.000Z", dateOnly: true }),
      ),
    );
    const wrong = await carePeriodService.create(
      u.caretaker.ctx,
      input({ startedAt: "2026-11-15T00:00:00.000Z", dateOnly: true }),
    );
    expect(codeOf(wrong)).toBe("carePeriodService:invalid");
    expect(issuesOf(wrong)).toEqual(["startedAt"]);
  });

  it("needs a label for Other, on create and on the merged row", async () => {
    const { u, input, addPeriod } = await setup();
    const res = await carePeriodService.create(u.caretaker.ctx, input({ type: "other", label: null }));
    expect(codeOf(res)).toBe("carePeriodService:invalid");
    expect(issuesOf(res)).toEqual(["label"]);

    const period = await addPeriod({ type: "home", label: null });
    expect(codeOf(await carePeriodService.update(u.caretaker.ctx, period.id, { type: "other" }))).toBe(
      "carePeriodService:invalid",
    );
    ok(
      await carePeriodService.update(u.caretaker.ctx, period.id, {
        type: "other",
        label: "Daughter's house",
      }),
    );
  });

  it("takes a place in the group, refuses another group's or a deleted one, and keeps a place deleted later", async () => {
    const { u, input, addProvider } = await setup();
    const place = await addProvider();
    const period = ok(
      await carePeriodService.create(
        u.caretaker.ctx,
        input({ placeProviderId: place.id, placeDetail: "Room 412" }),
      ),
    );
    expect(period).toMatchObject({ placeProviderId: place.id, placeDetail: "Room 412" });

    const other = await setup();
    const elsewhere = await other.addProvider();
    const foreign = await carePeriodService.create(u.caretaker.ctx, input({ placeProviderId: elsewhere.id }));
    expect(codeOf(foreign)).toBe("carePeriodService:badPlace");
    expect(issuesOf(foreign)).toEqual(["placeProviderId"]);

    const gone = await addProvider();
    ok(await providerService.remove(u.caretaker.ctx, gone.id));
    expect(codeOf(await carePeriodService.create(u.caretaker.ctx, input({ placeProviderId: gone.id })))).toBe(
      "carePeriodService:badPlace",
    );

    // Deleted after it was chosen: the period keeps it, and other edits still save.
    ok(await providerService.remove(u.caretaker.ctx, place.id));
    expect(
      ok(await carePeriodService.update(u.caretaker.ctx, period!.id, { label: "4 West" })),
    ).toMatchObject({
      placeProviderId: place.id,
      label: "4 West",
    });
  });

  it("is soft-deleted: hidden, kept for sync, and the period before runs on", async () => {
    const { u, group, addPeriod } = await setup();
    const home = await addPeriod({ type: "home", startedAt: ago(100) });
    const hospital = await addPeriod({ type: "hospital", startedAt: ago(50) });
    const rehab = await addPeriod({ type: "rehab", startedAt: ago(10) });
    ok(await carePeriodService.remove(u.caretaker.ctx, hospital.id));

    expect(await carePeriodService.getById(u.owner.ctx, hospital.id)).toBeNull();
    const deleted = await carePeriodService.getById(u.owner.ctx, hospital.id, { includeDeleted: true });
    expect(isError(deleted) ? null : deleted?.deletedAt).toBeTruthy();
    const all = ok(
      await carePeriodService.list(u.owner.ctx, { groupId: group.id, includeDeleted: true }),
    ).data;
    const iso = (v: string) => toChangeTime(v) ?? v;
    const spans = periodSpans(
      all.map((p) => ({ ...p, startedAt: iso(p.startedAt), createdAt: iso(p.createdAt) })),
    );
    expect(spans.map((s) => [s.period.id, s.endsAt])).toEqual([
      [home.id, iso(rehab.startedAt)],
      [rehab.id, null],
    ]);
    expect(codeOf(await carePeriodService.update(u.caretaker.ctx, hospital.id, { label: "x" }))).toBe(
      "carePeriodService:notFound",
    );
  });

  it("keeps two periods with the same start", async () => {
    const { u, group, addPeriod } = await setup();
    const at = ago(5);
    const one = await addPeriod({ type: "hospital", startedAt: at });
    const two = await addPeriod({ type: "emergency", startedAt: at });
    const page = ok(await carePeriodService.list(u.viewer.ctx, { groupId: group.id }));
    expect(page.data.map((p) => p.id)).toEqual([one.id, two.id]);
  });

  it("creates idempotently on id (upsert), never moving the group or reviving a deleted one", async () => {
    const { u, group, input, addPeriod } = await setup();
    const id = randomUUID();
    const first = ok(await carePeriodService.upsert(u.caretaker.ctx, { ...input(), id }));
    const again = ok(await carePeriodService.upsert(u.caretaker.ctx, { ...input({ label: "Ward 3" }), id }));
    expect(again).toMatchObject({
      created: false,
      row: { id, label: first.row?.label, createdAt: first.row?.createdAt },
    });

    const other = await setup();
    expect(codeOf(await carePeriodService.upsert(other.u.caretaker.ctx, { ...other.input(), id }))).toBe(
      "permissions:unauthorized",
    );

    const { group: second } = await createGroup(u.caretaker);
    expect(
      codeOf(await carePeriodService.upsert(u.caretaker.ctx, { ...input(), id, groupId: second.id })),
    ).toBe("carePeriodService:immutable");

    const gone = await addPeriod();
    ok(await carePeriodService.remove(u.caretaker.ctx, gone.id));
    const replay = ok(await carePeriodService.upsert(u.caretaker.ctx, { ...input(), id: gone.id }));
    expect(replay.row?.deletedAt).toBeTruthy();
    expect(group.id).toBeTruthy();
  });

  it("gives a live period a carePeriod notes document; not a deleted one, and not for a viewer", async () => {
    const { u, group, addPeriod } = await setup();
    const period = await addPeriod();
    const doc = ok(
      await noteDocumentService.create(u.caretaker.ctx, {
        id: period.id,
        groupId: group.id,
        subject: "carePeriod",
      }),
    );
    expect(doc).toMatchObject({
      id: period.id,
      subject: "carePeriod",
      carePeriodId: period.id,
      entryId: null,
    });
    // Idempotent.
    expect(
      ok(
        await noteDocumentService.create(u.owner.ctx, {
          id: period.id,
          groupId: group.id,
          subject: "carePeriod",
        }),
      )?.id,
    ).toBe(period.id);

    const other = await addPeriod();
    expect(
      codeOf(
        await noteDocumentService.create(u.viewer.ctx, {
          id: other.id,
          groupId: group.id,
          subject: "carePeriod",
        }),
      ),
    ).toBe("permissions:unauthorized");
    ok(await carePeriodService.remove(u.caretaker.ctx, other.id));
    expect(
      codeOf(
        await noteDocumentService.create(u.caretaker.ctx, {
          id: other.id,
          groupId: group.id,
          subject: "carePeriod",
        }),
      ),
    ).toBe("noteDocumentService:carePeriodNotFound");
  });
});
