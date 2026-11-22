import type { AuthUser } from "@caretook/data";

import { noteDocumentService, providerService, timelineEntryService } from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../../data/test/fixtures";
import { clientFor, rejection } from "../testing";

// Each test makes its own users and groups. All names and text are fictional.

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  const { group } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  const { group: otherGroup } = await createGroup(outsider);

  const addNote = async (ctx: { authUser: AuthUser }, groupId: string, text: string, title?: string) => {
    const entry = ok(
      await timelineEntryService.create(ctx, {
        groupId,
        kind: "note",
        title,
        occurredAt: "2026-11-10T18:30:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    )!;
    ok(await noteDocumentService.create(ctx, { id: entry.id, groupId }));
    ok(
      await noteDocumentService.appendUpdate(ctx, {
        id: randomUUID(),
        groupId,
        documentId: entry.id,
        data: typeParagraph(newYDoc(), text),
      }),
    );
    ok(await noteDocumentService.compact(entry.id));
    return entry;
  };

  return {
    group,
    otherGroup,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
    outsider: { ...outsider, api: clientFor(outsider.ctx.authUser) },
    addNote,
  };
};

describe("search.query", () => {
  it("returns ids, types, titles, snippets and dates, and nothing outside the group", async () => {
    const s = await setup();
    const note = await s.addNote(s.owner.ctx, s.group.id, "The tortoise ate all the dandelions", "Garden");
    await s.addNote(s.outsider.ctx, s.otherGroup.id, "Another tortoise somewhere else");
    const provider = ok(
      await providerService.create(s.owner.ctx, {
        groupId: s.group.id,
        type: "other",
        name: "Tortoise Rescue Line",
        status: "past",
      }),
    )!;

    const result = await s.viewer.api.search.query({ groupId: s.group.id, q: "tortoise" });
    expect(result).toEqual({
      entries: [
        {
          id: note.id,
          type: "entry",
          kind: "note",
          title: "Garden",
          snippet: "The tortoise ate all the dandelions",
          occurredAt: "2026-11-10T18:30:00.000Z",
          status: null,
          rank: expect.any(Number) as number,
        },
      ],
      nextCursor: null,
      providers: [
        {
          id: provider.id,
          type: "provider",
          kind: null,
          title: "Tortoise Rescue Line",
          snippet: "Tortoise Rescue Line",
          occurredAt: null,
          status: "past",
          rank: expect.any(Number) as number,
        },
      ],
      medications: [],
    });
  });

  it("filters and pages", async () => {
    const s = await setup();
    for (let i = 0; i < 3; i++) await s.addNote(s.owner.ctx, s.group.id, `Otter number ${i}`);
    const first = await s.owner.api.search.query({
      groupId: s.group.id,
      q: "otter",
      limit: 2,
      kinds: ["note"],
    });
    expect(first.entries).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await s.owner.api.search.query({
      groupId: s.group.id,
      q: "otter",
      limit: 2,
      kinds: ["note"],
      cursor: first.nextCursor,
    });
    expect(second.entries).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.entries, ...second.entries].map((h) => h.id)).size).toBe(3);

    expect(
      (await s.owner.api.search.query({ groupId: s.group.id, q: "otter", kinds: ["symptom"] })).entries,
    ).toEqual([]);
    expect(
      (await s.owner.api.search.query({ groupId: s.group.id, q: "otter", to: "2026-01-01T00:00:00Z" }))
        .entries,
    ).toEqual([]);
  });

  it("gives a non-member NOT_FOUND, and refuses a bad cursor and bad input", async () => {
    const s = await setup();
    const notFound = await rejection(s.outsider.api.search.query({ groupId: s.group.id, q: "anything" }));
    expect(notFound.code).toBe("NOT_FOUND");
    expect(notFound.data?.code).toBe("searchService:notFound");

    const badCursor = await rejection(
      s.owner.api.search.query({ groupId: s.group.id, q: "x", cursor: "nope" }),
    );
    expect(badCursor.code).toBe("BAD_REQUEST");
    expect((await rejection(s.owner.api.search.query({ groupId: s.group.id, q: "x", limit: 51 }))).code).toBe(
      "BAD_REQUEST",
    );
  });
});
