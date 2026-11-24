import {
  assistantActionService,
  symptomTypeId,
  symptomTypeService,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, createWorld, ok } from "../../data/test/fixtures";
import { clientFor, patchOp, putOp, sqliteTime, upload } from "./testing";

// sync.upload and a symptom's type (symptom-catalog slice 2): the server
// derives `symptom_type_id` from the name on every symptom write, so a
// device's value (missing on an older device, stale, made up, or another
// group's) never decides it, and an unknown name joins the catalog. Each
// test makes its own users and group. All data is fictional.

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
