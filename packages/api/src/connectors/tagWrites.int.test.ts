import type { AuthUser, TagTarget } from "@caretook/data";

import {
  careGroupService,
  medicationService,
  providerService,
  recordTagId,
  recordTagService,
  tagId,
  tagService,
  timelineEntryService,
  todoService,
} from "@caretook/data";
import { beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import {
  callTool,
  connectAssistant,
  enablePasswordSignIn,
  mcpHandler,
  mcpPost,
  textOf,
  toolRequest,
} from "./testing";

// tag_record and untag_record (connectors-5 slice 3), through /mcp with real
// tokens: each kind tagged with an existing and a new name, a repeat, untags,
// names not carried or not in the group, refusals that leave nothing behind
// (a viewer's read connection, a read-only group, another group's record, a
// soft-deleted one), and the derived ids devices sync. One world for the
// file. All data is fictional.

type Ctx = { authUser: AuthUser };

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const addEntry = async (ctx: Ctx, groupId: string, entry: Record<string, unknown> & { kind: string }) =>
  ok(
    await timelineEntryService.create(ctx, {
      groupId,
      timeZone: "America/Los_Angeles",
      occurredAt: hoursAgo(1),
      ...entry,
    } as never),
  )!;

const world = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  for (const who of [owner, caretaker, viewer]) await enablePasswordSignIn(who.user.id);
  const { group } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  const byId = { id: { type: "eq" as const, value: group.id } };
  ok(await careGroupService.update(owner.ctx, { filter: byId, data: { connectorsEnabled: true } }));
  const g = group.id;
  const o = owner.ctx;

  const urgent = ok(await tagService.create(o, { groupId: g, name: "Urgent" }))!;
  const records = {
    entry: await addEntry(o, g, { kind: "event", title: "Cardiology visit" }),
    todo: ok(await todoService.create(o, { groupId: g, title: "Pick up the prescription" }))!,
    provider: ok(
      await providerService.create(o, { groupId: g, type: "clinician", name: "Dr. Sample Nguyen" }),
    )!,
    medication: ok(
      await medicationService.create(o, {
        groupId: g,
        name: "Fictolol",
        strength: "5 mg",
        form: "tablet",
        dose: "1 tablet",
        schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
      } as never),
    )!,
  } satisfies Record<TagTarget, { id: string }>;
  const gone = await addEntry(o, g, { kind: "note", title: "Removed note" });
  ok(await timelineEntryService.remove(o, gone.id));

  // Another group of the owner's (the owner can see its record; the grant's group can't take it).
  const second = await createGroup(owner);
  const elsewhere = await addEntry(o, second.group.id, { kind: "note", title: "Elsewhere" });

  return {
    owner,
    group,
    urgent,
    records,
    gone,
    elsewhere,
    setReadOnly: (on: boolean) =>
      careGroupService.update(o, { filter: byId, data: { connectorsReadOnly: on } }),
    caretakerToken: (await connectAssistant({ email: caretaker.user.email, groupId: g })).tokens.access_token,
    viewerToken: (await connectAssistant({ email: viewer.user.email, groupId: g, scope: "read" })).tokens
      .access_token,
  };
};

describe("tag writes", { timeout: 120_000 }, () => {
  const handler = mcpHandler();
  let w: Awaited<ReturnType<typeof world>>;
  beforeAll(async () => {
    w = await world();
  }, 120_000);

  const tagNames = async () =>
    ok(await tagService.list(w.owner.ctx, { groupId: w.group.id }))
      .data.map((t) => t.name)
      .sort();
  const linksOf = async (target: TagTarget, recordId: string) =>
    ok(await recordTagService.listForRecord(w.owner.ctx, target, recordId)).data;
  const groupLinks = async () => ok(await recordTagService.listForGroup(w.owner.ctx, w.group.id)).data.length;

  it("tags each kind with an existing tag and a new one, in any case, with the record's link", async () => {
    const paths: Record<TagTarget, string> = {
      entry: `/entries/${w.records.entry.id}`,
      todo: `/todos/${w.records.todo.id}`,
      provider: `/providers/${w.records.provider.id}`,
      medication: `/medications/${w.records.medication.id}`,
    };
    for (const target of ["entry", "todo", "provider", "medication"] as const) {
      const recordId = w.records[target].id;
      const result = await callTool(handler, w.caretakerToken, "tag_record", {
        target,
        recordId,
        tags: ["  urgent ", "Follow up"],
      });
      expect(result.isError, target).toBeFalsy();
      const first = target === "entry";
      expect(result.structuredContent, target).toMatchObject({
        target,
        recordId,
        added: ["Follow up", "Urgent"],
        newTags: first ? ["Follow up"] : [],
        alreadyHad: [],
      });
      expect(result.structuredContent.url, target).toContain(`/app/groups/${w.group.id}${paths[target]}`);
      const text = textOf(result);
      expect(text, target).toContain("with Follow up, Urgent");
      if (first) expect(text).toContain("(new tag: Follow up)");
      expect(text).not.toContain("color");
    }
    expect(await tagNames()).toEqual(["Follow up", "Urgent"]);
    expect(
      textOf(
        await callTool(handler, w.caretakerToken, "tag_record", {
          target: "medication",
          recordId: w.records.medication.id,
          tags: ["Morning"],
        }),
      ),
    ).toMatch(/^Tagged Fictolol 5 mg with Morning \(new tag: Morning\)\./);
  });

  it("writes the derived ids devices sync", async () => {
    const follow = ok(await tagService.getByName(w.owner.ctx, w.group.id, "follow up"))!;
    expect(follow.id).toBe(tagId(w.group.id, "Follow up"));
    for (const target of ["entry", "todo", "provider", "medication"] as const) {
      const recordId = w.records[target].id;
      const ids = (await linksOf(target, recordId)).map((l) => l.id).sort();
      expect(ids, target).toEqual(
        expect.arrayContaining([recordTagId(follow.id, recordId), recordTagId(w.urgent.id, recordId)]),
      );
    }
  });

  it("adds nothing on a repeat, and says the record already had it", async () => {
    const before = await groupLinks();
    const result = await callTool(handler, w.caretakerToken, "tag_record", {
      target: "todo",
      recordId: w.records.todo.id,
      tags: ["URGENT", "urgent"],
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ added: [], newTags: [], alreadyHad: ["Urgent"] });
    expect(textOf(result)).toContain("It already had Urgent.");
    expect(await groupLinks()).toBe(before);
  });

  it("untags, naming a tag not carried and one the group lacks, and never deletes a tag", async () => {
    const recordId = w.records.provider.id;
    const result = await callTool(handler, w.caretakerToken, "untag_record", {
      target: "provider",
      recordId,
      tags: ["follow UP", "Morning", "Billing"],
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      removed: ["Follow up"],
      notCarried: ["Morning"],
      notFound: ["Billing"],
    });
    const text = textOf(result);
    expect(text).toContain("Took Follow up off Dr. Sample Nguyen.");
    expect(text).toContain("It didn't carry Morning.");
    expect(text).toContain("no tag named Billing");
    expect((await linksOf("provider", recordId)).map((l) => l.tagId)).toEqual([w.urgent.id]);
    expect(await tagNames()).toEqual(["Follow up", "Morning", "Urgent"]);

    const again = await callTool(handler, w.caretakerToken, "untag_record", {
      target: "provider",
      recordId,
      tags: ["Follow up"],
    });
    expect(again.structuredContent).toMatchObject({ removed: [], notCarried: ["Follow up"] });
  });

  it("refuses a viewer's read connection, with nothing written", async () => {
    const before = await groupLinks();
    for (const name of ["tag_record", "untag_record"]) {
      const res = await mcpPost(
        handler,
        w.viewerToken,
        toolRequest(name, { target: "todo", recordId: w.records.todo.id, tags: ["Viewer tag"] }),
      );
      expect(res.status, name).toBe(403);
    }
    expect(await groupLinks()).toBe(before);
    expect(await tagNames()).not.toContain("Viewer tag");
  });

  it("refuses a read-only group as mcp:groupReadOnly, with nothing written", async () => {
    const before = await groupLinks();
    ok(await w.setReadOnly(true));
    try {
      for (const name of ["tag_record", "untag_record"]) {
        const result = await callTool(handler, w.caretakerToken, name, {
          target: "todo",
          recordId: w.records.todo.id,
          tags: ["Read only", "Urgent"],
        });
        expect(result.isError, name).toBe(true);
        expect((result.structuredContent.error as { code: string }).code, name).toBe("mcp:groupReadOnly");
      }
    } finally {
      ok(await w.setReadOnly(false));
    }
    expect(await groupLinks()).toBe(before);
    expect(await tagNames()).not.toContain("Read only");
  });

  it("refuses another group's record and a soft-deleted one before any write", async () => {
    for (const [label, recordId] of [
      ["another group", w.elsewhere.id],
      ["soft-deleted", w.gone.id],
      ["unknown", "00000000-0000-4000-8000-000000000000"],
    ] as const) {
      for (const name of ["tag_record", "untag_record"]) {
        const result = await callTool(handler, w.caretakerToken, name, {
          target: "entry",
          recordId,
          tags: ["Brand new"],
        });
        expect(result.isError, `${label} ${name}`).toBe(true);
        expect((result.structuredContent.error as { code: string }).code, label).toBe(
          "recordTagService:recordNotFound",
        );
      }
    }
    expect(await tagNames()).not.toContain("Brand new");
    expect(await linksOf("entry", w.elsewhere.id)).toEqual([]);
    expect(ok(await tagService.getByName(w.owner.ctx, w.group.id, "Brand new"))).toBeNull();
  });
});
