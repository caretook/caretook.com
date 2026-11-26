import { getDb, recordTagId, tagId, timelineEntryService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createWorld, ok } from "../../data/test/fixtures";
import { clientFor, deleteOp, outcomes, patchOp, putOp, sqliteTime } from "./testing";

// sync.upload for tags (tags slice 1): a device's `tag` PUT adds a tag (a
// replay returns it), a `record_tag` PUT links and DELETE unlinks, null
// targets pass as null so none or two are refused, a taken name refuses the
// tag and its dependent link (both recorded as not saved on the device), and
// PATCH and DELETE on `tag` stay read-only until slice 3. Each test makes its
// own users and group.

const setup = async () => {
  const { u, group } = await createWorld({ members: ["caretaker", "viewer", "easy_viewer"] });
  const entry = ok(
    await timelineEntryService.create(u.caretaker.ctx, {
      groupId: group.id,
      kind: "note",
      title: "Toured Maple House",
      occurredAt: new Date(Date.now() - 3_600_000).toISOString(),
      timeZone: "America/Los_Angeles",
    }),
  )!;
  const now = sqliteTime();
  const audits = { created_at: now, updated_at: now };
  const tagPut = (name: string, counter = 0) =>
    putOp("tag", tagId(group.id, name, counter), {
      group_id: group.id,
      name,
      name_key: name.toLowerCase(),
      ...audits,
    });
  const linkPut = (tag: string, targets: Record<string, string | null> = { entry_id: entry.id }) =>
    putOp("record_tag", recordTagId(tag, entry.id), {
      group_id: group.id,
      tag_id: tag,
      entry_id: null,
      todo_id: null,
      provider_id: null,
      medication_id: null,
      ...targets,
      ...audits,
    });
  const links = async () =>
    (await getDb().$client.query<{ id: string }>(`SELECT id FROM record_tag WHERE entry_id = $1`, [entry.id]))
      .rows;
  return {
    group,
    entry,
    tagPut,
    linkPut,
    links,
    caretaker: clientFor(u.caretaker.ctx.authUser),
    viewer: clientFor(u.viewer.ctx.authUser),
    easyViewer: clientFor(u.easy_viewer.ctx.authUser),
  };
};

describe("sync.upload: tag and record_tag", () => {
  it("PUTs a tag and its link, replays both as one row each, and DELETE unlinks", async () => {
    const { tagPut, linkPut, links, caretaker } = await setup();
    const tag = tagPut("Care home move");
    const link = linkPut(tag.id);
    expect(await outcomes(caretaker, [tag, link, tag, link])).toEqual([
      "applied",
      "applied",
      "applied",
      "applied",
    ]);
    expect(await links()).toEqual([{ id: link.id }]);

    expect(
      await outcomes(caretaker, [deleteOp("record_tag", link.id), deleteOp("record_tag", link.id)]),
    ).toEqual(["applied", "applied"]);
    expect(await links()).toEqual([]);
  });

  it("refuses a link with no target or two", async () => {
    const { entry, tagPut, linkPut, caretaker } = await setup();
    const tag = tagPut("Urgent");
    expect(
      await outcomes(caretaker, [
        tag,
        linkPut(tag.id, { entry_id: null }),
        linkPut(tag.id, { entry_id: entry.id, todo_id: entry.id }),
      ]),
    ).toEqual(["applied", "recordTagService:invalid", "recordTagService:invalid"]);
  });

  it("refuses a taken name's create and the link that depends on it", async () => {
    const { group, tagPut, linkPut, links, caretaker } = await setup();
    expect(await outcomes(caretaker, [tagPut("Urgent")])).toEqual(["applied"]);
    // A rename freed counter 0's name on the server; a device that didn't see
    // it adds "Urgent" again under counter 1, after another device did.
    await getDb().$client.query(`UPDATE tag SET name = 'Pressing', name_key = 'pressing' WHERE id = $1`, [
      tagId(group.id, "urgent"),
    ]);
    expect(await outcomes(caretaker, [tagPut("Urgent", 1)])).toEqual(["applied"]);
    const late = tagPut("urgent", 2);
    const results = await caretaker.sync.upload({ ops: [late, linkPut(late.id)] });
    expect(results.results.map((r) => [r.status, r.status === "rejected" ? r.code : null])).toEqual([
      ["rejected", "tagService:nameTaken"],
      ["rejected", "recordTagService:tagNotFound"],
    ]);
    expect(await links()).toEqual([]);
  });

  it("refuses PATCH on record_tag, and PATCH and DELETE on tag (until rename and delete)", async () => {
    const { tagPut, linkPut, caretaker } = await setup();
    const tag = tagPut("Urgent");
    const link = linkPut(tag.id);
    expect(await outcomes(caretaker, [tag, link])).toEqual(["applied", "applied"]);
    expect(
      await outcomes(caretaker, [
        patchOp("record_tag", link.id, { updated_at: sqliteTime() }),
        patchOp("tag", tag.id, { name: "Pressing" }),
        deleteOp("tag", tag.id),
      ]),
    ).toEqual(["sync:readOnlyTable", "sync:readOnlyTable", "sync:readOnlyTable"]);
  });

  it("refuses a viewer's and an Easy viewer's PUTs and DELETE", async () => {
    const { tagPut, linkPut, links, caretaker, viewer, easyViewer } = await setup();
    const tag = tagPut("Urgent");
    const link = linkPut(tag.id);
    for (const api of [viewer, easyViewer])
      expect(await outcomes(api, [tagPut("Viewer's tag"), tag, link])).toEqual([
        "permissions:unauthorized",
        "permissions:unauthorized",
        "recordTagService:tagNotFound",
      ]);
    expect(await outcomes(caretaker, [tag, link])).toEqual(["applied", "applied"]);
    for (const api of [viewer, easyViewer])
      expect(await outcomes(api, [link, deleteOp("record_tag", link.id)])).toEqual([
        "permissions:unauthorized",
        "permissions:unauthorized",
      ]);
    expect(await links()).toHaveLength(1);
  });
});
