import type { AuthUser } from "@caretook/data";

import {
  careGroupService,
  medicationService,
  providerService,
  recordTagService,
  tagService,
  timelineEntryService,
  todoService,
} from "@caretook/data";
import { beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { callTool, connectAssistant, enablePasswordSignIn, mcpHandler, textOf } from "./testing";

// The tag reads (connectors-5 slice 1), through /mcp with real tokens:
// list_tags with live counts, tagged_items by name or id, by kind and paged,
// soft-deleted records left out, another group's tags never seen, and a
// viewer's read connection. One world for the file. All data is fictional.

type Ctx = { authUser: AuthUser };
type Item = {
  kind: string;
  id: string;
  title: string;
  when?: string;
  status?: string;
  tags: string[];
  url: string;
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const addTag = async (ctx: Ctx, groupId: string, name: string) =>
  ok(await tagService.create(ctx, { groupId, name }))!;

const tag = async (
  ctx: Ctx,
  groupId: string,
  tagId: string,
  target: { entryId?: string; todoId?: string; providerId?: string; medicationId?: string },
) => ok(await recordTagService.link(ctx, { groupId, tagId, ...target }));

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
  for (const who of [owner, viewer]) await enablePasswordSignIn(who.user.id);
  const { group } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  ok(
    await careGroupService.update(owner.ctx, {
      filter: { id: { type: "eq", value: group.id } },
      data: { connectorsEnabled: true },
    }),
  );
  const g = group.id;
  const w = caretaker.ctx;

  // Tags, made out of order: list_tags sorts them.
  const urgent = await addTag(w, g, "Urgent");
  const cardio = await addTag(w, g, "cardiology prep");
  const errands = await addTag(w, g, "Errands");
  const unused = await addTag(w, g, "Billing");

  // One of each kind carrying Urgent, and a soft-deleted note that keeps its link.
  const event = await addEntry(w, g, { kind: "event", title: "Cardiology visit", occurredAt: hoursAgo(2) });
  const symptom = await addEntry(w, g, {
    kind: "symptom",
    occurredAt: hoursAgo(5),
    details: { name: "Cough", severity: 2 },
  });
  const gone = await addEntry(w, g, { kind: "note", title: "Removed note", occurredAt: hoursAgo(3) });
  const todo = ok(await todoService.create(w, { groupId: g, title: "Bring the med list" }))!;
  const provider = ok(
    await providerService.create(w, { groupId: g, type: "clinician", name: "Dr. Example Heart" }),
  )!;
  const goneProvider = ok(
    await providerService.create(w, { groupId: g, type: "clinician", name: "Dr. Gone Away" }),
  )!;
  const medication = ok(
    await medicationService.create(w, {
      groupId: g,
      name: "Fictolol",
      strength: "5 mg",
      form: "tablet",
      dose: "1 tablet",
      schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
    } as never),
  )!;
  for (const target of [
    { entryId: event.id },
    { entryId: symptom.id },
    { entryId: gone.id },
    { todoId: todo.id },
    { providerId: provider.id },
    { providerId: goneProvider.id },
    { medicationId: medication.id },
  ])
    await tag(w, g, urgent.id, target);
  await tag(w, g, cardio.id, { entryId: event.id });
  await tag(w, g, cardio.id, { providerId: provider.id });
  ok(await timelineEntryService.remove(w, gone.id));
  ok(await providerService.remove(w, goneProvider.id));

  // 52 todos carrying Errands: two pages.
  const errandIds: string[] = [];
  for (let i = 0; i < 52; i++) {
    const t = ok(await todoService.create(w, { groupId: g, title: `Errand ${String(i).padStart(2, "0")}` }))!;
    await tag(w, g, errands.id, { todoId: t.id });
    errandIds.push(t.id);
  }

  // Another group of the owner's, with its own tag on its own record.
  const second = await createGroup(owner);
  const secret = await addTag(owner.ctx, second.group.id, "Secret plan");
  const secretEntry = await addEntry(owner.ctx, second.group.id, { kind: "note", title: "Elsewhere" });
  await tag(owner.ctx, second.group.id, secret.id, { entryId: secretEntry.id });

  const connect = async (who: typeof owner) =>
    (await connectAssistant({ email: who.user.email, groupId: g, scope: "read" })).tokens.access_token;
  return {
    group,
    tags: { urgent, cardio, errands, unused, secret },
    records: { event, symptom, gone, todo, provider, goneProvider, medication, errandIds, secretEntry },
    ownerToken: await connect(owner),
    viewerToken: await connect(viewer),
  };
};

describe("tag reads", { timeout: 120_000 }, () => {
  const handler = mcpHandler();
  let w: Awaited<ReturnType<typeof world>>;
  beforeAll(async () => {
    w = await world();
  }, 120_000);

  it("list_tags: A to Z with live counts only, never another group's", async () => {
    const result = await callTool(handler, w.ownerToken, "list_tags");
    expect(result.isError).toBeFalsy();
    const tags = result.structuredContent.tags as {
      id: string;
      name: string;
      items: number;
      byKind: Record<string, number>;
    }[];
    expect(tags.map((t) => t.name)).toEqual(["Billing", "cardiology prep", "Errands", "Urgent"]);
    // The soft-deleted note and provider keep their links, but aren't counted.
    expect(tags.find((t) => t.name === "Urgent")).toEqual({
      id: w.tags.urgent.id,
      name: "Urgent",
      items: 5,
      byKind: { entry: 2, todo: 1, provider: 1, medication: 1 },
    });
    expect(tags.find((t) => t.name === "Errands")?.items).toBe(52);
    expect(tags.find((t) => t.name === "Billing")).toMatchObject({ items: 0, byKind: { entry: 0 } });
    const text = textOf(result);
    expect(text).toContain("- Urgent (5 items)");
    expect(text).toContain("- Billing (0 items)");
    expect(JSON.stringify(result)).not.toContain("Secret plan");
    expect(JSON.stringify(result)).not.toMatch(/"color"/);
  });

  it("tagged_items: by a name in another case, in kind order, with tags and links", async () => {
    const result = await callTool(handler, w.ownerToken, "tagged_items", { tag: "  URGENT " });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      tagFound: true,
      tag: { id: w.tags.urgent.id, name: "Urgent" },
      nextCursor: null,
    });
    const items = result.structuredContent.items as Item[];
    const r = w.records;
    // Entries newest first, then todos, providers, medications; nothing soft-deleted.
    expect(items.map((i) => i.id)).toEqual([
      r.event.id,
      r.symptom.id,
      r.todo.id,
      r.provider.id,
      r.medication.id,
    ]);
    expect(items.map((i) => i.kind)).toEqual(["entry", "entry", "todo", "provider", "medication"]);
    expect(items[0]).toMatchObject({ title: "Cardiology visit", tags: ["cardiology prep", "Urgent"] });
    expect(items[0]?.when).toMatch(/-0[78]:00$/);
    expect(items[0]?.url).toContain(`/app/groups/${w.group.id}/entries/${r.event.id}`);
    expect(items[1]).toMatchObject({ title: "Cough", tags: ["Urgent"] });
    expect(items[2]).toMatchObject({ title: "Bring the med list", status: "undated" });
    expect(items[2]?.url).toContain(`/todos/${r.todo.id}`);
    expect(items[3]).toMatchObject({ title: "Dr. Example Heart", status: "current" });
    expect(items[3]?.url).toContain(`/providers/${r.provider.id}`);
    expect(items[4]).toMatchObject({ title: "Fictolol 5 mg", status: "current" });
    expect(items[4]?.url).toContain(`/medications/${r.medication.id}`);
    const text = textOf(result);
    expect(text).toContain("5 items tagged Urgent");
    expect(text).not.toContain("Removed note");
    expect(text).not.toContain("Dr. Gone Away");
  });

  it("tagged_items: by id, and narrowed by kinds", async () => {
    const byId = await callTool(handler, w.ownerToken, "tagged_items", {
      tag: w.tags.cardio.id,
      kinds: ["provider", "medication"],
    });
    expect(byId.structuredContent).toMatchObject({ tagFound: true, tag: { name: "cardiology prep" } });
    expect((byId.structuredContent.items as Item[]).map((i) => i.id)).toEqual([w.records.provider.id]);

    const none = await callTool(handler, w.ownerToken, "tagged_items", {
      tag: "Cardiology Prep",
      kinds: ["todo"],
    });
    expect(none.structuredContent).toMatchObject({ tagFound: true, items: [] });
    expect(textOf(none)).toBe("Nothing of those kinds carries cardiology prep.");
  });

  it("tagged_items: pages of 50", async () => {
    const first = await callTool(handler, w.ownerToken, "tagged_items", { tag: "errands" });
    const items = first.structuredContent.items as Item[];
    expect(items).toHaveLength(50);
    expect(first.structuredContent.nextCursor).toBe("50");
    expect(first.structuredContent.total).toBe(52);
    const second = await callTool(handler, w.ownerToken, "tagged_items", { tag: "errands", cursor: "50" });
    const rest = second.structuredContent.items as Item[];
    expect(rest).toHaveLength(2);
    expect(second.structuredContent.nextCursor).toBeNull();
    expect(new Set([...items, ...rest].map((i) => i.id))).toEqual(new Set(w.records.errandIds));
  });

  it("tagged_items: an unknown name, or another group's tag, answers tagFound false", async () => {
    for (const name of ["Nonexistent", "Secret plan", w.tags.secret.id]) {
      const result = await callTool(handler, w.ownerToken, "tagged_items", { tag: name });
      expect(result.isError, name).toBeFalsy();
      expect(result.structuredContent, name).toMatchObject({ tagFound: false, items: [] });
      expect(textOf(result), name).toBe(`No tag named "${name}"; list_tags lists them.`);
      expect(JSON.stringify(result), name).not.toContain(w.records.secretEntry.id);
    }
  });

  it("a viewer's read connection gets both", async () => {
    const tags = await callTool(handler, w.viewerToken, "list_tags");
    expect(tags.isError).toBeFalsy();
    expect((tags.structuredContent.tags as { name: string }[]).map((t) => t.name)).toContain("Urgent");
    const items = await callTool(handler, w.viewerToken, "tagged_items", { tag: "Urgent", kinds: ["entry"] });
    expect(items.isError).toBeFalsy();
    expect((items.structuredContent.items as Item[]).map((i) => i.id)).toEqual([
      w.records.event.id,
      w.records.symptom.id,
    ]);
  });
});
