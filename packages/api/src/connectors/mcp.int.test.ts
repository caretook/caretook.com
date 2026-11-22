import type { AuthUser } from "@caretook/data";
import type { Tool } from "./registry";

import { careGroupService, noteDocumentService, timelineEntryService } from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../../data/test/fixtures";
import { createRateLimiter } from "../rateLimit";
import { defineTool, WRITE_ANNOTATIONS } from "./registry";
import {
  connectAssistant,
  enablePasswordSignIn,
  mcpHandler,
  mcpPost,
  rpc,
  TEST_ORIGIN,
  toolRequest,
  toolResultOf,
} from "./testing";
import { CONNECTOR_TOOLS } from "./tools";

// /mcp through its HTTP handler, with tokens from the real OAuth dance.
// Each test makes its own members, group and connection. All data is
// fictional.

/** A stand-in write tool: real ones come with the write slice. */
const addThing = defineTool({
  name: "add_thing",
  title: "Add a thing",
  description: "A stand-in write tool for the scope checks.",
  scope: "readWrite",
  input: z.object({}),
  annotations: WRITE_ANNOTATIONS,
  handler: () => Promise.resolve({ text: "Added", structured: {} }),
});
const TOOLS: Tool[] = [...CONNECTOR_TOOLS, addThing];

const handlerWith = (limit = 60) =>
  mcpHandler({ limiter: createRateLimiter({ limit, windowMs: 60_000 }), tools: TOOLS });

const addNote = async (ctx: { authUser: AuthUser }, groupId: string, text: string, occurredAt: string) => {
  const entry = ok(
    await timelineEntryService.create(ctx, {
      groupId,
      kind: "note",
      title: "Visit",
      occurredAt,
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

const addSymptom = (ctx: { authUser: AuthUser }, groupId: string, occurredAt: string, name = "Cough") =>
  timelineEntryService.create(ctx, {
    groupId,
    kind: "symptom",
    occurredAt,
    timeZone: "America/Los_Angeles",
    details: { name, severity: 2 },
  });

/** A group with Assistants on: an owner, a caretaker and a viewer who can sign in. */
const world = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  for (const who of [owner, caretaker, viewer]) await enablePasswordSignIn(who.user.id);
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
  return { owner, caretaker, viewer, group };
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

describe("/mcp", () => {
  it("answers no token, or a bad one, with 401 and the resource metadata pointer", async () => {
    const handler = handlerWith();
    const none = await mcpPost(handler, null, rpc("ping"));
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${TEST_ORIGIN}/.well-known/oauth-protected-resource/mcp", scope="group:read group:write offline_access"`,
    );
    const bad = await mcpPost(handler, "not-a-real-token", rpc("ping"));
    expect(bad.status).toBe(401);
    expect(bad.headers.get("www-authenticate")).toMatch(/^Bearer error="invalid_token", resource_metadata="/);
  });

  it("answers GET with 405 (no SSE stream) and refuses a browser on another origin", async () => {
    const handler = handlerWith();
    const get = await handler(new Request(`${TEST_ORIGIN}/mcp`));
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
    const w = await world();
    const { tokens } = await connectAssistant({ email: w.owner.user.email, groupId: w.group.id });
    const res = await handler(
      new Request(`${TEST_ORIGIN}/mcp`, {
        method: "POST",
        headers: { authorization: `Bearer ${tokens.access_token}`, origin: "https://evil.example.com" },
        body: JSON.stringify(rpc("ping")),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("initializes, takes notifications and lists tools by scope", async () => {
    const handler = handlerWith();
    const w = await world();
    const writer = await connectAssistant({ email: w.caretaker.user.email, groupId: w.group.id });
    const reader = await connectAssistant({ email: w.viewer.user.email, groupId: w.group.id, scope: "read" });

    const init = (await (
      await mcpPost(
        handler,
        writer.tokens.access_token,
        rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {} }),
      )
    ).json()) as { result: { protocolVersion: string } };
    expect(init.result.protocolVersion).toBe("2025-06-18");
    const notified = await mcpPost(handler, writer.tokens.access_token, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(notified.status).toBe(202);

    const names = async (token: string) =>
      (
        (await (await mcpPost(handler, token, rpc("tools/list"))).json()) as {
          result: { tools: { name: string }[] };
        }
      ).result.tools.map((t) => t.name);
    // Every tool for a writer; the reads only for a reader.
    expect(await names(writer.tokens.access_token)).toEqual(TOOLS.map((t) => t.name));
    expect(await names(reader.tokens.access_token)).toEqual(
      TOOLS.filter((t) => t.scope === "read").map((t) => t.name),
    );
    expect(await names(reader.tokens.access_token)).toEqual(
      expect.arrayContaining(["group_overview", "list_timeline"]),
    );

    const refused = await mcpPost(handler, reader.tokens.access_token, toolRequest("add_thing"));
    expect(refused.status).toBe(403);
    expect(refused.headers.get("www-authenticate")).toMatch(/^Bearer error="insufficient_scope", /);
    expect(
      (await toolResultOf(await mcpPost(handler, writer.tokens.access_token, toolRequest("add_thing"))))
        .content[0]?.text,
    ).toBe("Added");
  });

  it("advertises prompts, lists them by scope and gets one with its arguments", async () => {
    const handler = handlerWith();
    const w = await world();
    const writer = await connectAssistant({ email: w.caretaker.user.email, groupId: w.group.id });
    const reader = await connectAssistant({ email: w.viewer.user.email, groupId: w.group.id, scope: "read" });

    const init = (await (
      await mcpPost(handler, reader.tokens.access_token, rpc("initialize", { protocolVersion: "2025-11-25" }))
    ).json()) as { result: { capabilities: Record<string, unknown> } };
    expect(init.result.capabilities.prompts).toEqual({ listChanged: false });

    const names = async (token: string) =>
      (
        (await (await mcpPost(handler, token, rpc("prompts/list"))).json()) as {
          result: { prompts: { name: string }[] };
        }
      ).result.prompts.map((p) => p.name);
    expect(await names(writer.tokens.access_token)).toEqual([
      "catch_me_up",
      "prepare_for_appointment",
      "weekly_summary",
      "log_what_happened",
    ]);
    expect(await names(reader.tokens.access_token)).toEqual([
      "catch_me_up",
      "prepare_for_appointment",
      "weekly_summary",
    ]);

    const got = await mcpPost(
      handler,
      writer.tokens.access_token,
      rpc("prompts/get", { name: "log_what_happened", arguments: { account: "Walked to the mailbox." } }),
    );
    expect(got.status).toBe(200);
    const body = (await got.json()) as {
      result: { messages: { role: string; content: { text: string } }[] };
    };
    expect(body.result.messages[0]?.role).toBe("user");
    expect(body.result.messages[0]?.content.text).toContain("Walked to the mailbox.");

    const missing = (await (
      await mcpPost(handler, writer.tokens.access_token, rpc("prompts/get", { name: "log_what_happened" }))
    ).json()) as { error: { code: number } };
    expect(missing.error.code).toBe(-32602);
    const readerLog = (await (
      await mcpPost(
        handler,
        reader.tokens.access_token,
        rpc("prompts/get", { name: "log_what_happened", arguments: { account: "Slept well." } }),
      )
    ).json()) as { error: { code: number } };
    expect(readerLog.error.code).toBe(-32602);
  });

  it("group_overview: the group, recipient, zone, the member's scope and members' names and roles", async () => {
    const handler = handlerWith();
    const w = await world();
    const { tokens } = await connectAssistant({
      email: w.viewer.user.email,
      groupId: w.group.id,
      scope: "read",
    });
    const result = await toolResultOf(
      await mcpPost(handler, tokens.access_token, toolRequest("group_overview")),
    );
    expect(result.structuredContent).toEqual({
      group: { name: "Test Family" },
      recipient: { preferredName: "Pat Example" },
      timeZone: "America/Los_Angeles",
      you: { role: "viewer", canAddEntries: false },
      units: { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" },
      members: [
        { name: "owner", role: "owner" },
        { name: "caretaker", role: "caretaker" },
        { name: "viewer", role: "viewer" },
      ],
    });
    expect(result.content[0]?.text).toMatch(/Time zone: America\/Los_Angeles/);
  });

  it("list_timeline: the group's entries in the recipient's zone, with note text, paged at 50", async () => {
    const handler = handlerWith();
    const w = await world();
    const { group: other } = await createGroup(w.owner);
    await addNote(w.owner.ctx, w.group.id, "Ate well and walked to the mailbox", "2026-11-10T03:30:00.000Z");
    // Older than the default window (90 days): only an explicit `from` reaches it.
    ok(await addSymptom(w.owner.ctx, w.group.id, "2026-01-05T18:00:00.000Z", "Long ago"));
    ok(await addSymptom(w.owner.ctx, other.id, hoursAgo(1), "Not this group"));
    for (let i = 0; i < 55; i++) ok(await addSymptom(w.caretaker.ctx, w.group.id, hoursAgo(i + 2)));

    const { tokens } = await connectAssistant({
      email: w.owner.user.email,
      groupId: w.group.id,
      scope: "read",
    });
    const first = await toolResultOf(
      await mcpPost(handler, tokens.access_token, toolRequest("list_timeline")),
    );
    const page = first.structuredContent as {
      entries: {
        kind: string;
        occurredAt: string;
        text: string | null;
        author: { name: string | null };
        details: unknown;
      }[];
      nextCursor: string | null;
    };
    expect(page.entries).toHaveLength(50);
    expect(page.nextCursor).toBeTruthy();
    expect(page.entries[0]).toMatchObject({
      kind: "symptom",
      author: { name: "caretaker" },
      details: { name: "Cough" },
    });
    expect(page.entries[0]?.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[78]:00$/);

    const second = await toolResultOf(
      await mcpPost(handler, tokens.access_token, toolRequest("list_timeline", { cursor: page.nextCursor })),
    );
    const rest = second.structuredContent as typeof page;
    // The other 5 symptoms, then the note (10 days ago, inside the default 90).
    expect(rest.entries.map((e) => e.kind)).toEqual([
      "symptom",
      "symptom",
      "symptom",
      "symptom",
      "symptom",
      "note",
    ]);
    expect(rest.nextCursor).toBeNull();

    // An older range: the note, with its document's text, in Pacific time.
    const notes = await toolResultOf(
      await mcpPost(
        handler,
        tokens.access_token,
        toolRequest("list_timeline", { from: "2026-11-01T00:00:00-08:00", kinds: ["note"] }),
      ),
    );
    expect((notes.structuredContent as typeof page).entries).toEqual([
      expect.objectContaining({
        kind: "note",
        occurredAt: "2026-11-09T19:30:00-08:00",
        text: "Ate well and walked to the mailbox",
      }),
    ]);
    expect(notes.content[0]?.text).toContain("Ate well and walked to the mailbox");

    // By author; and nothing from the other group, ever.
    const byOwner = await toolResultOf(
      await mcpPost(
        handler,
        tokens.access_token,
        toolRequest("list_timeline", { authorId: w.owner.user.id, from: "2026-01-01T00:00:00Z" }),
      ),
    );
    expect((byOwner.structuredContent as typeof page).entries.map((e) => e.kind)).toEqual([
      "note",
      "symptom",
    ]);
    expect(JSON.stringify([first, second])).not.toContain("Long ago");
    expect(JSON.stringify([first, second, notes, byOwner])).not.toContain("Not this group");

    // Bad arguments are the model's to fix.
    const bad = await toolResultOf(
      await mcpPost(handler, tokens.access_token, toolRequest("list_timeline", { limit: 500 })),
    );
    expect(bad).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "mcp:invalidArguments" } },
    });
  });

  it("never returns an email or a phone number", async () => {
    const handler = handlerWith();
    const w = await world();
    await addNote(w.caretaker.ctx, w.group.id, "Called the pharmacy", hoursAgo(3));
    const { tokens } = await connectAssistant({ email: w.caretaker.user.email, groupId: w.group.id });
    const outputs = [
      await (await mcpPost(handler, tokens.access_token, toolRequest("group_overview"))).text(),
      await (await mcpPost(handler, tokens.access_token, toolRequest("list_timeline"))).text(),
      await (await mcpPost(handler, tokens.access_token, rpc("tools/list"))).text(),
    ].join("\n");
    for (const who of [w.owner, w.caretaker, w.viewer]) expect(outputs).not.toContain(who.user.email);
    expect(outputs).not.toMatch(/"(email|phones?|address)"\s*:/i);
    expect(outputs).not.toContain("@example.com");
  });

  it("allows 60 calls a minute per connection, then 429 with Retry-After", async () => {
    const handler = handlerWith(60);
    const w = await world();
    const { tokens } = await connectAssistant({ email: w.owner.user.email, groupId: w.group.id });
    for (let i = 0; i < 60; i++)
      expect((await mcpPost(handler, tokens.access_token, rpc("ping"))).status).toBe(200);
    const over = await mcpPost(handler, tokens.access_token, rpc("ping"));
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).toBe("60");
  });

  it("stops working when the owner turns Assistants off", async () => {
    const handler = handlerWith();
    const w = await world();
    const { tokens } = await connectAssistant({ email: w.caretaker.user.email, groupId: w.group.id });
    expect((await mcpPost(handler, tokens.access_token, rpc("ping"))).status).toBe(200);
    ok(
      await careGroupService.update(w.owner.ctx, {
        filter: { id: { type: "eq", value: w.group.id } },
        data: { connectorsEnabled: false },
      }),
    );
    expect((await mcpPost(handler, tokens.access_token, rpc("ping"))).status).toBe(401);
  });
});
