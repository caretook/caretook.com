import { getDb, recordTagId, tagId, timelineEntryService } from "@caretook/data";
import { TAG_COLORS } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { createWorld, ok } from "../../data/test/fixtures";
import { clientFor, deleteOp, outcomes, patchOp, putOp, sqliteTime } from "./testing";

// sync.upload for tags (tags slices 1 and 3): a device's `tag` PUT adds a
// tag (a replay returns it, even renamed), a name PATCH renames it (the
// server derives `name_key`), an owner's DELETE removes it and its links; a
// `record_tag` PUT links and DELETE unlinks, null targets pass as null so
// none or two are refused; a taken name, a refused rename and a link to a
// deleted tag are rejected (recorded as not saved on the device). A tag's
// color (tags-2) rides its PUT (none: the server picks an unused one) and a
// color PATCH recolors it, under rename's rule. Each test makes its own
// users and group.

const setup = async () => {
  const { u, group } = await createWorld({
    members: ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
  });
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
  const tagPut = (name: string, counter = 0, extra: Record<string, unknown> = {}) =>
    putOp("tag", tagId(group.id, name, counter), {
      group_id: group.id,
      name,
      name_key: name.toLowerCase(),
      ...audits,
      ...extra,
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
  const tagOf = async (id: string) =>
    (
      await getDb().$client.query<{
        name: string;
        name_key: string;
        created_by: string;
        color: string | null;
      }>(`SELECT name, name_key, created_by, color FROM tag WHERE id = $1`, [id])
    ).rows[0] ?? null;
  const rename = (id: string, name: string, extra: Record<string, unknown> = {}) =>
    patchOp("tag", id, { name, name_key: name.toLowerCase(), updated_at: sqliteTime(), ...extra });
  const recolor = (id: string, color: unknown) => patchOp("tag", id, { color, updated_at: sqliteTime() });
  return {
    u,
    group,
    entry,
    tagPut,
    linkPut,
    links,
    tagOf,
    rename,
    recolor,
    owner: clientFor(u.owner.ctx.authUser),
    admin: clientFor(u.admin.ctx.authUser),
    easyHelper: clientFor(u.easy_helper.ctx.authUser),
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

  it("refuses PATCH on record_tag, and a PATCH of a tag's group or an unknown column", async () => {
    const { group, tagPut, linkPut, caretaker } = await setup();
    const tag = tagPut("Urgent");
    const link = linkPut(tag.id);
    expect(await outcomes(caretaker, [tag, link])).toEqual(["applied", "applied"]);
    expect(
      await outcomes(caretaker, [
        patchOp("record_tag", link.id, { updated_at: sqliteTime() }),
        patchOp("tag", tag.id, { group_id: group.id }),
        patchOp("tag", tag.id, { colour: "red" }),
        patchOp("tag", tag.id, { updated_at: sqliteTime() }),
      ]),
    ).toEqual(["sync:readOnlyTable", "tagService:immutable", "sync:unknownColumn", "applied"]);
  });

  it("a name PATCH renames; the device's name_key is ignored, and a replayed create returns the renamed tag", async () => {
    const { tagPut, tagOf, rename, caretaker, admin } = await setup();
    const tag = tagPut("Urgent");
    expect(await outcomes(caretaker, [tag])).toEqual(["applied"]);
    expect(
      await outcomes(admin, [rename(tag.id, "  Very   pressing ", { name_key: "something else" })]),
    ).toEqual(["applied"]);
    expect(await tagOf(tag.id)).toMatchObject({ name: "Very pressing", name_key: "very pressing" });
    // A device that never saw the rename replays its create: the one tag, renamed.
    expect(await outcomes(caretaker, [tag])).toEqual(["applied"]);
    expect(await tagOf(tag.id)).toMatchObject({ name: "Very pressing" });
  });

  it("refuses a rename to a taken name", async () => {
    const { tagPut, tagOf, rename, caretaker } = await setup();
    const tag = tagPut("Urgent");
    expect(await outcomes(caretaker, [tag, tagPut("Knee"), rename(tag.id, "KNEE")])).toEqual([
      "applied",
      "applied",
      "tagService:nameTaken",
    ]);
    expect(await tagOf(tag.id)).toMatchObject({ name: "Urgent" });
  });

  it("two people add one tag offline, the second an Easy helper: their rename is refused, not saved", async () => {
    const { u, tagPut, tagOf, rename, caretaker, easyHelper } = await setup();
    const tag = tagPut("Urgent");
    // The caretaker's upload lands first, so they're its creator; the Easy
    // helper's PUT of the same id is a replay, and their rename is refused in SQL.
    expect(await outcomes(caretaker, [tag])).toEqual(["applied"]);
    const results = await easyHelper.sync.upload({ ops: [tag, rename(tag.id, "Pressing")] });
    expect(results.results.map((r) => [r.status, r.status === "rejected" ? r.code : null])).toEqual([
      ["applied", null],
      ["rejected", "permissions:unauthorized"],
    ]);
    expect(await tagOf(tag.id)).toMatchObject({
      name: "Urgent",
      name_key: "urgent",
      created_by: u.caretaker.user.id,
    });

    // A tag the Easy helper created is theirs to rename.
    const mine = tagPut("Knee");
    expect(await outcomes(easyHelper, [mine, rename(mine.id, "Sore knee")])).toEqual(["applied", "applied"]);
    expect(await tagOf(mine.id)).toMatchObject({ name: "Sore knee", created_by: u.easy_helper.user.id });
  });

  it("a PUT keeps its color, one without gets a color no group tag has, and a color PATCH recolors", async () => {
    const { tagPut, tagOf, rename, recolor, caretaker, admin } = await setup();
    const sky = tagPut("Urgent", 0, { color: "sky" });
    const bare = tagPut("Knee");
    expect(await outcomes(caretaker, [sky, bare])).toEqual(["applied", "applied"]);
    expect(await tagOf(sky.id)).toMatchObject({ color: "sky" });
    const picked = (await tagOf(bare.id))?.color;
    expect(TAG_COLORS).toContain(picked);
    expect(picked).not.toBe("sky");

    // A null color is no color: the server picks one.
    const nulled = tagPut("Care home move", 0, { color: null });
    expect(await outcomes(caretaker, [nulled])).toEqual(["applied"]);
    expect(TAG_COLORS).toContain((await tagOf(nulled.id))?.color);

    expect(
      await outcomes(admin, [
        recolor(sky.id, "rose"),
        patchOp("tag", bare.id, { name: "Sore knee", color: "sky" }),
      ]),
    ).toEqual(["applied", "applied"]);
    expect(await tagOf(sky.id)).toMatchObject({ name: "Urgent", color: "rose" });
    expect(await tagOf(bare.id)).toMatchObject({ name: "Sore knee", color: "sky" });

    // Off the palette: a PUT and a PATCH are refused, and a PATCH of both
    // rolls the rename back with it.
    expect(
      await outcomes(caretaker, [
        tagPut("Lab", 0, { color: "chartreuse" }),
        recolor(sky.id, "chartreuse"),
        rename(bare.id, "Knee pain", { color: "chartreuse" }),
      ]),
    ).toEqual(["tagService:invalid", "tagService:invalid", "tagService:invalid"]);
    expect(await tagOf(bare.id)).toMatchObject({ name: "Sore knee", color: "sky" });
  });

  it("refuses an Easy helper's recolor of someone else's tag, and a viewer's; their own is theirs", async () => {
    const { u, tagPut, tagOf, recolor, caretaker, easyHelper, viewer } = await setup();
    const theirs = tagPut("Urgent", 0, { color: "sky" });
    expect(await outcomes(caretaker, [theirs])).toEqual(["applied"]);
    expect(await outcomes(easyHelper, [recolor(theirs.id, "rose")])).toEqual(["permissions:unauthorized"]);
    expect(await outcomes(viewer, [recolor(theirs.id, "rose")])).toEqual(["permissions:unauthorized"]);
    expect(await tagOf(theirs.id)).toMatchObject({ color: "sky" });

    const mine = tagPut("Knee", 0, { color: "sky" });
    expect(await outcomes(easyHelper, [mine, recolor(mine.id, "rose")])).toEqual(["applied", "applied"]);
    expect(await tagOf(mine.id)).toMatchObject({ color: "rose", created_by: u.easy_helper.user.id });
  });

  it("only an owner's DELETE removes a tag and its links; a replay is fine, and a later link is not saved", async () => {
    const { u, entry, tagPut, linkPut, links, tagOf, owner, admin, caretaker, easyHelper } = await setup();
    const tag = tagPut("Urgent");
    const link = linkPut(tag.id);
    expect(await outcomes(caretaker, [tag, link])).toEqual(["applied", "applied"]);
    for (const api of [admin, caretaker, easyHelper])
      expect(await outcomes(api, [deleteOp("tag", tag.id)])).toEqual(["permissions:unauthorized"]);
    expect(await tagOf(tag.id)).not.toBeNull();

    expect(await outcomes(owner, [deleteOp("tag", tag.id), deleteOp("tag", tag.id)])).toEqual([
      "applied",
      "applied",
    ]);
    expect(await tagOf(tag.id)).toBeNull();
    expect(await links()).toEqual([]);
    expect(ok(await timelineEntryService.getById(u.caretaker.ctx, entry.id))).not.toBeNull();

    // A device that tagged offline before it heard of the delete.
    const late = await caretaker.sync.upload({ ops: [link] });
    expect(late.results.map((r) => [r.status, r.status === "rejected" ? r.code : null])).toEqual([
      ["rejected", "recordTagService:tagNotFound"],
    ]);
  });

  it("refuses a viewer's and an Easy viewer's PUTs and DELETE; only an identical replay of a link is a no-op", async () => {
    const { tagPut, linkPut, links, caretaker, viewer, easyViewer } = await setup();
    const tag = tagPut("Urgent");
    const link = linkPut(tag.id);
    const other = tagPut("Knee");
    const otherLink = linkPut(other.id);
    for (const api of [viewer, easyViewer])
      expect(await outcomes(api, [tagPut("Viewer's tag"), tag, link])).toEqual([
        "permissions:unauthorized",
        "permissions:unauthorized",
        "recordTagService:tagNotFound",
      ]);
    expect(await outcomes(caretaker, [tag, link, other])).toEqual(["applied", "applied", "applied"]);
    const row = async () =>
      (
        await getDb().$client.query<Record<string, unknown>>(`SELECT * FROM record_tag WHERE id = $1`, [
          link.id,
        ])
      ).rows;
    const before = await row();

    // A PUT of a link already there, identical in every column (the id is
    // derived from its tag and record), is a replay: the twin upload of the
    // tags a viewer's tick copies to a repeating todo's next. It writes
    // nothing. Any new link, and any DELETE, is still refused.
    for (const api of [viewer, easyViewer])
      expect(await outcomes(api, [link, otherLink, deleteOp("record_tag", link.id)])).toEqual([
        "applied",
        "permissions:unauthorized",
        "permissions:unauthorized",
      ]);
    expect(await row()).toEqual(before);
    expect(await links()).toHaveLength(1);
  });
});
