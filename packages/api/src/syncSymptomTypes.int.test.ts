import {
  assistantActionService,
  symptomTypeId,
  symptomTypeService,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, createWorld, ok } from "../../data/test/fixtures";
import { clientFor, deleteOp, outcomes, patchOp, putOp, sqliteTime, upload } from "./testing";

// sync.upload and a symptom's type (symptom-catalog slice 2): the server
// derives `symptom_type_id` from the name on every symptom write, so a
// device's value (missing on an older device, stale, made up, or another
// group's) never decides it, and an unknown name joins the catalog. And a
// device's own catalog row (slice 3): an idempotent PUT, for loggers only.
// Each test makes its own users and group. All data is fictional.

const entryRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  kind: "symptom",
  occurred_at: sqliteTime(-60_000),
  time_zone: "America/Los_Angeles",
  title: null,
  body: null,
  details: JSON.stringify({ name: "Cough", severity: 2 }),
  deleted_at: null,
  ...overrides,
});

const statuses = (results: { status: string }[]) => results.map((r) => r.status);

describe("sync.upload: a symptom's type", () => {
  it("gives an older device's symptom (no pointer) its type", async () => {
    const { u, groupId, recipient } = await createWorld({ members: [] });
    const id = randomUUID();
    const api = clientFor(u.owner.ctx.authUser);
    expect(
      statuses(await upload(api, [putOp("timeline_entry", id, entryRow(groupId, recipient.id))])),
    ).toEqual(["applied"]);
    expect(ok(await timelineEntryService.getById(u.owner.ctx, id))?.symptomTypeId).toBe(
      symptomTypeId(groupId, "Cough"),
    );
  });

  it("stores the derived type whatever id the device sent: stale, missing or another group's", async () => {
    const { u, groupId, recipient } = await createWorld({ members: [] });
    const other = await createGroup(await createUser("other-owner"));
    const api = clientFor(u.owner.ctx.authUser);
    const sent = [symptomTypeId(groupId, "Nausea"), randomUUID(), symptomTypeId(other.group.id, "Cough")];
    const ids = sent.map(() => randomUUID());
    const results = await upload(
      api,
      sent.map((pointer, i) =>
        putOp("timeline_entry", ids[i]!, entryRow(groupId, recipient.id, { symptom_type_id: pointer })),
      ),
    );
    expect(statuses(results)).toEqual(["applied", "applied", "applied"]);
    for (const id of ids)
      expect(ok(await timelineEntryService.getById(u.owner.ctx, id))?.symptomTypeId).toBe(
        symptomTypeId(groupId, "Cough"),
      );
  });

  it("moves the type on a renaming PATCH, and ignores a PATCH of the pointer alone", async () => {
    const { u, groupId, recipient } = await createWorld({ members: ["caretaker"] });
    const id = randomUUID();
    const api = clientFor(u.caretaker.ctx.authUser);
    const results = await upload(api, [
      putOp("timeline_entry", id, entryRow(groupId, recipient.id)),
      patchOp("timeline_entry", id, {
        details: JSON.stringify({ name: "Wheezing", severity: 3 }),
        symptom_type_id: symptomTypeId(groupId, "Cough"),
      }),
      patchOp("timeline_entry", id, { symptom_type_id: randomUUID() }),
    ]);
    expect(statuses(results)).toEqual(["applied", "applied", "applied"]);
    const entry = ok(await timelineEntryService.getById(u.caretaker.ctx, id));
    expect(entry?.details).toMatchObject({ name: "Wheezing" });
    expect(entry?.symptomTypeId).toBe(symptomTypeId(groupId, "wheezing"));
    expect(ok(await symptomTypeService.getByName(u.caretaker.ctx, groupId, "WHEEZING"))?.id).toBe(
      entry?.symptomTypeId,
    );
  });

  it("lets an Easy helper upload an unknown name, adding it to the catalog", async () => {
    const { u, groupId, recipient } = await createWorld({ members: ["easy_helper"] });
    const id = randomUUID();
    const api = clientFor(u.easy_helper.ctx.authUser);
    const row = entryRow(groupId, recipient.id, {
      details: JSON.stringify({ name: "Itchy ankle", severity: 1 }),
    });
    expect(statuses(await upload(api, [putOp("timeline_entry", id, row)]))).toEqual(["applied"]);
    const type = ok(await symptomTypeService.getByName(u.easy_helper.ctx, groupId, "itchy ankle"));
    expect(type?.createdBy).toBe(u.easy_helper.user.id);
    expect(ok(await timelineEntryService.getById(u.easy_helper.ctx, id))?.symptomTypeId).toBe(type?.id);
  });

  it("points a symptom logged through an assistant at its type, adding a new name", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    const { byAction } = ok(
      await assistantActionService.run(
        u.owner.ctx,
        groupId,
        [
          {
            type: "logSymptom",
            name: "Hoarse voice",
            severity: 2,
            occurredAt: new Date(Date.now() - 60_000).toISOString(),
          },
        ],
        { via: "Test Claude" },
      ),
    );
    const [[entryId]] = byAction as [[string]];
    const entry = ok(await timelineEntryService.getById(u.owner.ctx, entryId));
    expect(entry?.symptomTypeId).toBe(symptomTypeId(groupId, "hoarse voice"));
    expect(ok(await symptomTypeService.getByName(u.owner.ctx, groupId, "Hoarse voice"))).not.toBeNull();
  });
});

/** A device's new catalog row, as its local write leaves it. */
const typeOp = (groupId: string, name: string, id = symptomTypeId(groupId, name)) =>
  putOp("symptom_type", id, {
    group_id: groupId,
    name,
    name_key: name.trim().toLowerCase(),
    created_at: sqliteTime(),
    updated_at: sqliteTime(),
  });

describe("sync.upload: a device's new symptom type", () => {
  it("leaves one row when two devices upload the same new name, the first spelling kept", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const first = clientFor(u.owner.ctx.authUser);
    const second = clientFor(u.caretaker.ctx.authUser);
    expect(await outcomes(first, [typeOp(groupId, "Sore wrist")])).toEqual(["applied"]);
    // Another device's spelling, then a replay of the first.
    expect(await outcomes(second, [typeOp(groupId, "sore Wrist")])).toEqual(["applied"]);
    expect(await outcomes(first, [typeOp(groupId, "Sore wrist")])).toEqual(["applied"]);
    const rows = ok(await symptomTypeService.list(u.owner.ctx, { groupId })).data.filter(
      (r) => r.nameKey === "sore wrist",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: symptomTypeId(groupId, "sore wrist"),
      name: "Sore wrist",
      createdBy: u.owner.user.id,
    });
  });

  it("lets owners, admins, caretakers and Easy helpers add a name; viewers and Easy viewers are refused", async () => {
    const { u, groupId } = await createWorld({
      members: ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
    });
    for (const role of ["owner", "admin", "caretaker", "easy_helper"] as const) {
      expect(
        await outcomes(clientFor(u[role].ctx.authUser), [typeOp(groupId, `Sore ${role}`)]),
        role,
      ).toEqual(["applied"]);
      expect(ok(await symptomTypeService.getByName(u.owner.ctx, groupId, `Sore ${role}`))?.createdBy).toBe(
        u[role].user.id,
      );
    }
    for (const role of ["viewer", "easy_viewer"] as const) {
      const api = clientFor(u[role].ctx.authUser);
      // A new name, and one the group already has: refused either way.
      expect(await outcomes(api, [typeOp(groupId, `Sore ${role}`), typeOp(groupId, "Nausea")]), role).toEqual(
        ["permissions:unauthorized", "permissions:unauthorized"],
      );
      expect(ok(await symptomTypeService.getByName(u.owner.ctx, groupId, `Sore ${role}`)), role).toBeNull();
    }
  });

  it("refuses an id that isn't the one derived from the group and name, and any change or removal", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    const api = clientFor(u.owner.ctx.authUser);
    const nausea = symptomTypeId(groupId, "Nausea");
    expect(
      await outcomes(api, [
        typeOp(groupId, "Sore heel", randomUUID()),
        patchOp("symptom_type", nausea, { name: "Queasy" }),
        deleteOp("symptom_type", nausea),
      ]),
    ).toEqual(["symptomTypeService:invalid", "sync:readOnlyTable", "sync:readOnlyTable"]);
    expect(ok(await symptomTypeService.getByName(u.owner.ctx, groupId, "Sore heel"))).toBeNull();
    expect(ok(await symptomTypeService.getById(u.owner.ctx, nausea))?.name).toBe("Nausea");
  });
});
