import type { TagTarget } from "../db";

import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWorld, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import { TAG_TARGET_FIELDS, recordTagId, recordTagSchema, tagId } from "../db/schema";
import { isError } from "../errors";
import {
  medicationService,
  providerService,
  recordTagService,
  tagService,
  timelineEntryService,
  todoService,
} from ".";

// Tags and their links (tags slices 1 and 3): tagService.create (idempotent
// on the derived id, a taken name refused), rename and remove (who may, in
// SQL; a taken name; cascades) and recordTagService (every role on every
// target, refusals, one row per pair, cascades). Every test builds its own
// group and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const LA = "America/Los_Angeles";

const setup = async () => {
  const world = await createWorld({
    members: ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
    extras: ["outsider"],
  });
  const { u, group } = world;
  const entryBy = async (who: keyof typeof u, groupId = group.id) =>
    ok(
      await timelineEntryService.create(u[who].ctx, {
        groupId,
        kind: "note",
        title: "Called the home care agency",
        occurredAt: new Date(Date.now() - 3_600_000).toISOString(),
        timeZone: LA,
      }),
    )!;
  const records = async (groupId = group.id, by: keyof typeof u = "caretaker") => ({
    entry: (await entryBy(by, groupId)).id,
    todo: ok(await todoService.create(u[by].ctx, { groupId, title: "Book a follow-up" }))!.id,
    provider: ok(
      await providerService.create(u[by].ctx, { groupId, type: "practice", name: "Maple Clinic" }),
    )!.id,
    medication: ok(
      await medicationService.create(u[by].ctx, {
        groupId,
        name: "Lisinopril",
        strength: "10 mg",
        form: "tablet",
        dose: "1 tablet",
        schedule: { type: "scheduled", times: ["08:00"] },
      }),
    )!.id,
  });
  const newTag = async (name = "Care home move", who: keyof typeof u = "caretaker") =>
    ok(await tagService.create(u[who].ctx, { id: tagId(group.id, name), groupId: group.id, name }))!;
  const link = (who: keyof typeof u, tag: string, target: TagTarget, recordId: string) =>
    recordTagService.link(u[who].ctx, {
      groupId: group.id,
      tagId: tag,
      [TAG_TARGET_FIELDS[target]]: recordId,
    });
  const linksOf = async (tag: string) =>
    getDb().select({ id: recordTagSchema.id }).from(recordTagSchema).where(eq(recordTagSchema.tagId, tag));
  return { ...world, entryBy, records, newTag, link, linksOf };
};

const TARGETS = ["entry", "todo", "provider", "medication"] as const;

describe("tagService.create", () => {
  it("adds a tag under its derived id, and a replay returns it", async () => {
    const { u, group, newTag } = await setup();
    const tag = await newTag("  Care   home move ");
    expect(tag).toMatchObject({ id: tagId(group.id, "care home move"), name: "Care home move" });
    expect(tag.nameKey).toBe("care home move");
    expect(tag.createdBy).toBe(u.caretaker.user.id);

    const again = ok(
      await tagService.create(u.admin.ctx, { id: tag.id, groupId: group.id, name: "CARE HOME MOVE" }),
    );
    expect(again).toMatchObject({ id: tag.id, name: "Care home move", createdBy: u.caretaker.user.id });
  });

  it("returns a tag replayed after a rename, by its id", async () => {
    const { u, group, newTag } = await setup();
    const tag = await newTag("Urgent");
    ok(await tagService.rename(u.admin.ctx, tag.id, "Pressing"));
    const again = ok(
      await tagService.create(u.caretaker.ctx, { id: tag.id, groupId: group.id, name: "Urgent" }),
    );
    expect(again).toMatchObject({ id: tag.id, name: "Pressing" });
  });

  it("refuses a name another tag holds (nameTaken), and takes the next counter without an id", async () => {
    const { u, group, newTag } = await setup();
    const tag = await newTag("Urgent");
    await getDb().execute(sql`UPDATE tag SET name = 'Pressing', name_key = 'pressing' WHERE id = ${tag.id}`);
    const fresh = ok(await tagService.create(u.caretaker.ctx, { groupId: group.id, name: "Urgent" }))!;
    expect(fresh.id).toBe(tagId(group.id, "urgent", 1));

    // A device that saw neither: counter 2 for a name counter 1 holds.
    const taken = await tagService.create(u.caretaker.ctx, {
      id: tagId(group.id, "urgent", 2),
      groupId: group.id,
      name: "urgent",
    });
    expect(codeOf(taken)).toBe("tagService:nameTaken");
  });

  it("refuses an id not derived from the group and name, and a bad name", async () => {
    const { u, group } = await setup();
    const res = await tagService.create(u.caretaker.ctx, {
      id: randomUUID(),
      groupId: group.id,
      name: "Urgent",
    });
    expect(codeOf(res)).toBe("tagService:invalid");
    expect(
      codeOf(await tagService.create(u.caretaker.ctx, { groupId: group.id, name: "x".repeat(41) })),
    ).toBe("tagService:invalid");
  });

  it("lets loggers create (an Easy helper too), and refuses viewers, Easy viewers and non-members", async () => {
    const { u, group, newTag } = await setup();
    for (const who of ["owner", "admin", "caretaker", "easy_helper"] as const)
      expect((await newTag(`By ${who}`, who)).createdBy).toBe(u[who].user.id);
    const existing = await newTag("Urgent");
    for (const who of ["viewer", "easy_viewer", "outsider"] as const) {
      const name = `By ${who}`;
      expect(
        codeOf(await tagService.create(u[who].ctx, { id: tagId(group.id, name), groupId: group.id, name })),
      ).toBe("permissions:unauthorized");
      // Even a replay of a tag that exists.
      expect(
        codeOf(await tagService.create(u[who].ctx, { id: existing.id, groupId: group.id, name: "Urgent" })),
      ).toBe("permissions:unauthorized");
    }
  });

  it("every member reads the list; a non-member reads nothing", async () => {
    const { u, group, newTag } = await setup();
    await newTag("Urgent");
    for (const who of ["viewer", "easy_viewer"] as const)
      expect(ok(await tagService.list(u[who].ctx, { groupId: group.id })).data.map((t) => t.name)).toEqual([
        "Urgent",
      ]);
    expect(ok(await tagService.list(u.outsider.ctx, { groupId: group.id })).data).toEqual([]);
  });
});

describe("tagService.rename", () => {
  const nameOf = async (id: string) => ok(await tagService.getById(system, id));

  it("a writer renames any tag: the key follows the name, the id and links stay", async () => {
    const { u, group, records, newTag, link, linksOf } = await setup();
    const ids = await records();
    const tag = await newTag("Urgent", "easy_helper");
    ok(await link("caretaker", tag.id, "todo", ids.todo));
    for (const [who, name] of [
      ["owner", "Pressing"],
      ["admin", "  Very   pressing "],
      ["caretaker", "Follow up"],
    ] as const) {
      const renamed = ok(await tagService.rename(u[who].ctx, tag.id, name));
      expect(renamed).toMatchObject({ id: tag.id, groupId: group.id, updatedBy: u[who].user.id });
    }
    expect(await nameOf(tag.id)).toMatchObject({ name: "Follow up", nameKey: "follow up" });
    expect(await linksOf(tag.id)).toHaveLength(1);
    // A new spelling of its own name is no clash.
    expect(ok(await tagService.rename(u.caretaker.ctx, tag.id, "FOLLOW UP"))).toMatchObject({
      name: "FOLLOW UP",
      nameKey: "follow up",
    });
  });

  it("an Easy helper renames only a tag they created; the SQL refuses theirs, and the name stays", async () => {
    const { u, newTag } = await setup();
    const mine = await newTag("Knee", "easy_helper");
    const theirs = await newTag("Urgent", "caretaker");
    ok(await tagService.rename(u.easy_helper.ctx, mine.id, "Sore knee"));
    expect(await nameOf(mine.id)).toMatchObject({ name: "Sore knee", nameKey: "sore knee" });

    expect(codeOf(await tagService.rename(u.easy_helper.ctx, theirs.id, "Pressing"))).toBe(
      "permissions:unauthorized",
    );
    expect(await nameOf(theirs.id)).toMatchObject({ name: "Urgent", nameKey: "urgent" });
  });

  it("refuses viewers, Easy viewers and non-members; a missing tag is notFound", async () => {
    const { u, newTag } = await setup();
    const tag = await newTag("Urgent");
    for (const who of ["viewer", "easy_viewer", "outsider"] as const)
      expect(codeOf(await tagService.rename(u[who].ctx, tag.id, "Pressing"))).toBe(
        "permissions:unauthorized",
      );
    expect(await nameOf(tag.id)).toMatchObject({ name: "Urgent" });
    expect(codeOf(await tagService.rename(u.owner.ctx, randomUUID(), "Pressing"))).toBe(
      "tagService:notFound",
    );
  });

  it("refuses a name another tag holds (nameTaken) and a bad name", async () => {
    const { u, newTag } = await setup();
    const tag = await newTag("Urgent");
    const other = await newTag("Knee");
    expect(codeOf(await tagService.rename(u.owner.ctx, tag.id, "  KNEE "))).toBe("tagService:nameTaken");
    expect(codeOf(await tagService.rename(u.owner.ctx, tag.id, "   "))).toBe("tagService:invalid");
    expect(codeOf(await tagService.rename(u.owner.ctx, tag.id, "x".repeat(41)))).toBe("tagService:invalid");
    expect(await nameOf(tag.id)).toMatchObject({ name: "Urgent" });
    expect(await nameOf(other.id)).toMatchObject({ name: "Knee" });
  });
});

describe("tagService.remove", () => {
  it("only owners delete; admins, caretakers, Easy helpers and the rest are refused", async () => {
    const { u, newTag } = await setup();
    const tag = await newTag("Urgent", "easy_helper");
    for (const who of ["admin", "caretaker", "easy_helper", "viewer", "easy_viewer", "outsider"] as const)
      expect(codeOf(await tagService.remove(u[who].ctx, tag.id))).toBe("permissions:unauthorized");
    expect(ok(await tagService.getById(system, tag.id))).not.toBeNull();
    ok(await tagService.remove(u.owner.ctx, tag.id));
    expect(ok(await tagService.getById(system, tag.id))).toBeNull();
    expect(codeOf(await tagService.remove(u.owner.ctx, tag.id))).toBe("tagService:notFound");
  });

  it("takes the tag off every record; the records stay, and a later link is refused", async () => {
    const { u, records, newTag, link, linksOf } = await setup();
    const ids = await records();
    const tag = await newTag();
    for (const target of TARGETS) ok(await link("caretaker", tag.id, target, ids[target]));
    ok(await tagService.remove(u.owner.ctx, tag.id));
    expect(await linksOf(tag.id)).toEqual([]);
    expect(ok(await timelineEntryService.getById(system, ids.entry))).not.toBeNull();
    expect(ok(await todoService.getById(system, ids.todo))).not.toBeNull();
    expect(ok(await providerService.getById(system, ids.provider))).not.toBeNull();
    expect(ok(await medicationService.getById(system, ids.medication))).not.toBeNull();
    expect(codeOf(await link("caretaker", tag.id, "entry", ids.entry))).toBe("recordTagService:tagNotFound");
  });
});

describe("recordTagService", () => {
  it("a writer tags each target type; tagging twice leaves one row; untagging removes it", async () => {
    const { group, records, newTag, link, linksOf, u } = await setup();
    const ids = await records();
    const tag = await newTag();
    for (const who of ["owner", "admin", "caretaker"] as const)
      for (const target of TARGETS) {
        const first = ok(await link(who, tag.id, target, ids[target]));
        expect(first).toMatchObject({ id: recordTagId(tag.id, ids[target]), groupId: group.id });
        expect(ok(await link(who, tag.id, target, ids[target]))?.id).toBe(first?.id);
      }
    expect(await linksOf(tag.id)).toHaveLength(4);
    const listed = ok(await recordTagService.listForRecord(u.viewer.ctx, "todo", ids.todo));
    expect(listed.data.map((l) => l.tagId)).toEqual([tag.id]);

    for (const target of TARGETS) {
      expect(codeOf(await recordTagService.unlinkPair(u.caretaker.ctx, tag.id, ids[target]))).toBe("ok");
      // A replay of the unlink is fine.
      expect(codeOf(await recordTagService.unlinkPair(u.caretaker.ctx, tag.id, ids[target]))).toBe("ok");
    }
    expect(await linksOf(tag.id)).toEqual([]);
  });

  it("refuses a link with no target or two", async () => {
    const { u, group, records, newTag } = await setup();
    const ids = await records();
    const tag = await newTag();
    expect(codeOf(await recordTagService.link(u.caretaker.ctx, { groupId: group.id, tagId: tag.id }))).toBe(
      "recordTagService:invalid",
    );
    expect(
      codeOf(
        await recordTagService.link(u.caretaker.ctx, {
          groupId: group.id,
          tagId: tag.id,
          entryId: ids.entry,
          todoId: ids.todo,
        }),
      ),
    ).toBe("recordTagService:invalid");
  });

  it("an Easy helper tags and untags their own entry, whoever added the tag, and nothing else", async () => {
    const { u, entryBy, records, newTag, link, linksOf } = await setup();
    const own = await entryBy("easy_helper");
    const ids = await records();
    const theirs = await newTag("Added by the caretaker");
    const mine = await newTag("Added by the helper", "easy_helper");

    for (const tag of [theirs, mine]) {
      expect(codeOf(await link("easy_helper", tag.id, "entry", own.id))).toBe("ok");
      expect(await linksOf(tag.id)).toHaveLength(1);
      expect(codeOf(await recordTagService.unlinkPair(u.easy_helper.ctx, tag.id, own.id))).toBe("ok");
      expect(await linksOf(tag.id)).toEqual([]);
    }

    for (const target of TARGETS)
      expect(codeOf(await link("easy_helper", mine.id, target, ids[target]))).toBe(
        "permissions:unauthorized",
      );
    // Nor untag another's entry the caretaker tagged.
    ok(await link("caretaker", mine.id, "entry", ids.entry));
    expect(codeOf(await recordTagService.unlinkPair(u.easy_helper.ctx, mine.id, ids.entry))).toBe(
      "permissions:unauthorized",
    );
    expect(await linksOf(mine.id)).toHaveLength(1);
  });

  it("refuses viewers and Easy viewers every write, a todo included; a non-member reads nothing", async () => {
    const { u, group, entryBy, records, newTag, link, linksOf } = await setup();
    const ids = await records();
    const helperEntry = await entryBy("easy_helper");
    const tag = await newTag();
    for (const who of ["viewer", "easy_viewer", "outsider"] as const) {
      for (const target of TARGETS)
        expect(codeOf(await link(who, tag.id, target, ids[target]))).toBe("permissions:unauthorized");
      expect(codeOf(await link(who, tag.id, "entry", helperEntry.id))).toBe("permissions:unauthorized");
    }
    ok(await link("caretaker", tag.id, "todo", ids.todo));
    for (const who of ["viewer", "easy_viewer", "outsider"] as const)
      expect(codeOf(await recordTagService.unlinkPair(u[who].ctx, tag.id, ids.todo))).toBe(
        "permissions:unauthorized",
      );
    expect(await linksOf(tag.id)).toHaveLength(1);
    expect(ok(await recordTagService.listForGroup(u.outsider.ctx, group.id)).data).toEqual([]);
    expect(ok(await recordTagService.listForGroup(u.easy_viewer.ctx, group.id)).data).toHaveLength(1);
  });

  it("refuses a cross-group tag or target", async () => {
    const { u, group, records, newTag } = await setup();
    const other = await createWorld({ members: [] });
    // The caretaker joins the other group too, so both ends are visible to them.
    ok(
      await getDb().execute(
        sql`INSERT INTO care_group_member (group_id, user_id, role, created_by, updated_by)
            VALUES (${other.group.id}, ${u.caretaker.user.id}, 'caretaker', ${u.caretaker.user.id}, ${u.caretaker.user.id})`,
      ),
    );
    const here = await records();
    const there = await records(other.group.id);
    const tag = await newTag();
    const elsewhere = ok(
      await tagService.create(u.caretaker.ctx, { groupId: other.group.id, name: "Care home move" }),
    )!;

    // This group's tag on the other group's record, and the other way.
    expect(
      codeOf(
        await recordTagService.link(u.caretaker.ctx, {
          groupId: group.id,
          tagId: tag.id,
          todoId: there.todo,
        }),
      ),
    ).toBe("recordTagService:immutable");
    expect(
      codeOf(
        await recordTagService.link(u.caretaker.ctx, {
          groupId: group.id,
          tagId: elsewhere.id,
          todoId: here.todo,
        }),
      ),
    ).toBe("recordTagService:immutable");
    // An owner of only this group can't even see the other group's tag.
    expect(
      codeOf(
        await recordTagService.link(u.owner.ctx, {
          groupId: group.id,
          tagId: elsewhere.id,
          todoId: here.todo,
        }),
      ),
    ).toBe("permissions:unauthorized");
  });

  it("refuses a deleted record or a missing tag", async () => {
    const { u, records, newTag, link } = await setup();
    const ids = await records();
    const tag = await newTag();
    ok(await todoService.remove(u.caretaker.ctx, ids.todo));
    expect(codeOf(await link("caretaker", tag.id, "todo", ids.todo))).toBe("recordTagService:recordNotFound");
    expect(codeOf(await link("caretaker", randomUUID(), "entry", ids.entry))).toBe(
      "recordTagService:tagNotFound",
    );
  });

  it("a soft-deleted record keeps its links; hard-deleting a record or the tag removes them", async () => {
    const { u, records, newTag, link, linksOf } = await setup();
    const ids = await records();
    const tag = await newTag();
    for (const target of TARGETS) ok(await link("caretaker", tag.id, target, ids[target]));
    ok(await timelineEntryService.remove(u.caretaker.ctx, ids.entry));
    expect(await linksOf(tag.id)).toHaveLength(4);

    await getDb().execute(sql`DELETE FROM timeline_entry WHERE id = ${ids.entry}`);
    await getDb().execute(sql`DELETE FROM provider WHERE id = ${ids.provider}`);
    expect(await linksOf(tag.id)).toHaveLength(2);
    await getDb().execute(sql`DELETE FROM tag WHERE id = ${tag.id}`);
    expect(await linksOf(tag.id)).toEqual([]);
    expect(ok(await todoService.getById(system, ids.todo))).not.toBeNull();
  });
});
