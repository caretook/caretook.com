import {
  assistantActionService,
  symptomTypeId,
  symptomTypeService,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDb } from "../../data/src/db/client";
import { symptomTypeRow, symptomTypeSchema } from "../../data/src/db/schema";
import { SYNC_CONFIG_PATH } from "../../data/src/db/roles/applyRoles";
import { parseYaml } from "../../data/src/db/roles/syncConfig";
import { createGroup, createUser, createWorld, ok } from "../../data/test/fixtures";
import { clientFor, codesOf, deleteOp, outcomes, patchOp, putOp, sqliteTime, upload } from "./testing";

// sync.upload and a symptom's type (symptom-catalog slice 2): the server
// derives `symptom_type_id` from the name on every symptom write, so a
// device's value (missing on an older device, stale, made up, or another
// group's) never decides it, and an unknown name joins the catalog. And a
// device's own catalog row (slice 3): an idempotent PUT, for loggers only.
// And archiving (symptom-catalog-2 slice 3): online only, its columns
// streamed to every role and never taken from an upload.
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

describe("sync.upload: a deleted symptom (symptom-catalog-3)", () => {
  /** "Nauseous" deleted into "Nausea": its tombstone written straight to the table. */
  const tombstone = (groupId: string, actorId: string) =>
    getDb()
      .insert(symptomTypeSchema)
      .values({
        ...symptomTypeRow(groupId, "Nauseous"),
        archivedAt: "2026-11-21T10:00:00.000Z",
        replacedById: symptomTypeId(groupId, "Nausea"),
        createdBy: actorId,
        updatedBy: actorId,
      });

  it("lands an offline device's entry naming the deleted symptom on the replacement", async () => {
    const { u, groupId, recipient } = await createWorld({ members: ["caretaker"] });
    await tombstone(groupId, u.owner.user.id);
    const api = clientFor(u.caretaker.ctx.authUser);
    const [made, renamed] = [randomUUID(), randomUUID()];
    // As a device that hasn't synced the tombstone writes them: the old name, its derived id.
    const old = { details: JSON.stringify({ name: "nauseous", severity: 4 }) };
    const results = await upload(api, [
      putOp(
        "timeline_entry",
        made,
        entryRow(groupId, recipient.id, { ...old, symptom_type_id: symptomTypeId(groupId, "Nauseous") }),
      ),
      putOp("timeline_entry", renamed, entryRow(groupId, recipient.id)),
      patchOp("timeline_entry", renamed, { ...old, symptom_type_id: symptomTypeId(groupId, "Nauseous") }),
    ]);
    expect(statuses(results)).toEqual(["applied", "applied", "applied"]);
    for (const id of [made, renamed]) {
      const entry = ok(await timelineEntryService.getById(u.caretaker.ctx, id));
      expect(entry?.symptomTypeId).toBe(symptomTypeId(groupId, "Nausea"));
      expect(entry?.details).toMatchObject({ name: "Nausea", severity: 4 });
    }
  });

  it("adds nothing for a PUT of the deleted name's catalog row", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    await tombstone(groupId, u.owner.user.id);
    const before = ok(await symptomTypeService.list(u.owner.ctx, { groupId })).data;
    const api = clientFor(u.caretaker.ctx.authUser);
    expect(await outcomes(api, [typeOp(groupId, "Nauseous"), typeOp(groupId, "NAUSEOUS")])).toEqual([
      "applied",
      "applied",
    ]);
    expect(ok(await symptomTypeService.list(u.owner.ctx, { groupId })).data).toEqual(before);
    expect(
      ok(await symptomTypeService.getById(u.owner.ctx, symptomTypeId(groupId, "Nauseous"))),
    ).toMatchObject({
      name: "Nauseous",
      replacedById: symptomTypeId(groupId, "Nausea"),
      updatedBy: u.owner.user.id,
    });
  });
});

type Stream = { with: Record<string, string>; queries: string[] };

/**
 * The `symptom_type` rows the `care_groups` stream gives `userId`: its query
 * from the real sync-config.yaml, run on the test database with the member
 * as `auth.user_id()` (a fixture's UUID, so safe to inline).
 */
const streamedTypes = async (userId: string) => {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("not a UUID");
  const root = parseYaml(readFileSync(SYNC_CONFIG_PATH, "utf8")) as { streams: Record<string, Stream> };
  const stream = root.streams.care_groups!;
  const query = stream.queries.find((q) => /\bFROM symptom_type\b/.test(q));
  if (!query) throw new Error("no symptom_type query in the care_groups stream");
  const myGroups = stream.with.my_groups!.replace("auth.user_id()", `'${userId}'`);
  const run = query.replace(/\bmy_groups\b/, `(${myGroups})`);
  if (run.includes("auth.")) throw new Error("unexpected auth parameter in the symptom_type query");
  return (await getDb().$client.query<Record<string, unknown>>(run)).rows;
};

describe("archiving a symptom type", () => {
  it("answers a caretaker's archive with the archived row, and streams it to every role", async () => {
    const roles = ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"] as const;
    const { u, groupId } = await createWorld({ members: [...roles] });
    const nausea = symptomTypeId(groupId, "Nausea");
    const archived = await clientFor(u.caretaker.ctx.authUser).timeline.symptomTypes.archive({
      groupId,
      id: nausea,
    });
    expect(archived).toMatchObject({ id: nausea, name: "Nausea", replacedById: null });
    expect(archived.archivedAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    expect(archived.updatedBy).toBe(u.caretaker.user.id);

    for (const role of ["owner", ...roles] as const) {
      const row = (await streamedTypes(u[role].user.id)).find((r) => r.id === nausea);
      expect(row, role).toMatchObject({ archived_at: expect.anything() as unknown, replaced_by_id: null });
    }

    const back = await clientFor(u.owner.ctx.authUser).timeline.symptomTypes.unarchive({
      groupId,
      id: nausea,
    });
    expect(back.archivedAt).toBeNull();
    expect((await streamedTypes(u.viewer.user.id)).find((r) => r.id === nausea)?.archived_at).toBeNull();
  });

  it("refuses viewers and the easy roles (403), and another group's row (404)", async () => {
    const { u, groupId } = await createWorld({ members: ["viewer", "easy_helper", "easy_viewer"] });
    const other = await createGroup(await createUser("other-owner"));
    const nausea = symptomTypeId(groupId, "Nausea");
    for (const role of ["viewer", "easy_helper", "easy_viewer"] as const)
      expect(
        await codesOf(clientFor(u[role].ctx.authUser).timeline.symptomTypes.archive({ groupId, id: nausea })),
        role,
      ).toBe("FORBIDDEN:permissions:unauthorized");
    const api = clientFor(u.owner.ctx.authUser);
    expect(
      await codesOf(
        api.timeline.symptomTypes.archive({ groupId, id: symptomTypeId(other.group.id, "Nausea") }),
      ),
    ).toBe("NOT_FOUND:symptomTypeService:notFound");
    expect(ok(await symptomTypeService.getById(u.owner.ctx, nausea))?.archivedAt).toBeNull();
  });

  it("takes neither column from a device: a PUT's are ignored, a PATCH or DELETE is refused", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    const api = clientFor(u.owner.ctx.authUser);
    const nausea = symptomTypeId(groupId, "Nausea");
    const cough = symptomTypeId(groupId, "Cough");
    await api.timeline.symptomTypes.archive({ groupId, id: nausea });

    const withColumns = (name: string, columns: Record<string, unknown>) => {
      const op = typeOp(groupId, name);
      return { ...op, data: { ...op.data, ...columns } };
    };
    expect(
      await outcomes(api, [
        // A new name sent archived, pointing at another row: stored active, no replacement.
        withColumns("Sore elbow", { archived_at: sqliteTime(), replaced_by_id: cough }),
        // The archived row sent active: still archived.
        withColumns("Nausea", { archived_at: null }),
        patchOp("symptom_type", nausea, { archived_at: null }),
        patchOp("symptom_type", cough, { archived_at: sqliteTime(), replaced_by_id: nausea }),
        deleteOp("symptom_type", cough),
      ]),
    ).toEqual(["applied", "applied", "sync:readOnlyTable", "sync:readOnlyTable", "sync:readOnlyTable"]);

    expect(ok(await symptomTypeService.getByName(u.owner.ctx, groupId, "Sore elbow"))).toMatchObject({
      archivedAt: null,
      replacedById: null,
    });
    expect(ok(await symptomTypeService.getById(u.owner.ctx, nausea))?.archivedAt).not.toBeNull();
    expect(ok(await symptomTypeService.getById(u.owner.ctx, cough))).toMatchObject({
      archivedAt: null,
      replacedById: null,
    });
  });
});
