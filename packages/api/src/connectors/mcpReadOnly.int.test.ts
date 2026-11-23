import { careGroupService, connectorGrantService, timelineEntryService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { clientFor, codesOf } from "../testing";
import {
  callTool,
  connectAssistant,
  enablePasswordSignIn,
  mcpHandler,
  mcpPost,
  rpc,
  toolRequest,
} from "./testing";

// An owner's read-only choice through /mcp, with tokens from the real OAuth
// dance (assistant-access): connections stay, write tools go, a write is a
// plain tool refusal, and switching back restores what was approved. All
// data is fictional.

const handler = mcpHandler();
const byId = (id: string) => ({ id: { type: "eq" as const, value: id } });
const WRITE_ARGS = { text: "Walked to the mailbox and back." };

const world = async () => {
  const owner = await createUser("owner");
  const admin = await createUser("admin");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  for (const who of [owner, admin, caretaker, viewer, outsider]) await enablePasswordSignIn(who.user.id);
  const { group } = await createGroup(owner, [
    { user: admin.user, role: "admin" },
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  ok(
    await careGroupService.update(owner.ctx, {
      filter: byId(group.id),
      data: { connectorsEnabled: true },
    }),
  );
  const setReadOnly = (on: boolean) =>
    careGroupService.update(owner.ctx, { filter: byId(group.id), data: { connectorsReadOnly: on } });
  return { owner, admin, caretaker, viewer, outsider, group, setReadOnly };
};

const connected = async (
  who: Awaited<ReturnType<typeof createUser>>,
  groupId: string,
  scope: "read" | "readWrite" = "readWrite",
) => (await connectAssistant({ email: who.user.email, groupId, scope })).tokens.access_token;

const toolNames = async (token: string) => {
  const res = await mcpPost(handler, token, rpc("tools/list"));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { result: { tools: { name: string }[] } };
  return body.result.tools.map((t) => t.name);
};

const notesIn = async (who: Awaited<ReturnType<typeof createUser>>, groupId: string) =>
  ok(await timelineEntryService.list(who.ctx, { groupId, kinds: ["note"] })).data.length;

describe("a group set to read only", () => {
  it("keeps the connection, drops write tools, refuses a write as a tool result, and still reads", async () => {
    const w = await world();
    const accessToken = await connected(w.caretaker, w.group.id);
    expect(await toolNames(accessToken)).toContain("add_note");

    ok(await w.setReadOnly(true));
    const names = await toolNames(accessToken);
    expect(names).toContain("group_overview");
    expect(names).not.toContain("add_note");
    expect(names).not.toContain("log_vitals");

    const refused = await mcpPost(handler, accessToken, toolRequest("add_note", WRITE_ARGS));
    expect(refused.status).toBe(200);
    expect(refused.headers.get("www-authenticate")).toBeNull();
    const body = (await refused.json()) as {
      result: { isError: boolean; structuredContent: { error: { code: string; message: string } } };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error.code).toBe("mcp:groupReadOnly");
    expect(body.result.structuredContent.error.message).toMatch(/^Read only, set by the group owner/);
    expect(await notesIn(w.owner, w.group.id)).toBe(0);

    const overview = await callTool(handler, accessToken, "group_overview");
    expect(overview.structuredContent).toMatchObject({
      you: { canAddEntries: false, groupReadOnly: true },
    });
  });

  it("restores writing on the same token when switched back", async () => {
    const w = await world();
    const accessToken = await connected(w.caretaker, w.group.id);
    ok(await w.setReadOnly(true));
    ok(await w.setReadOnly(false));

    expect(await toolNames(accessToken)).toContain("add_note");
    const written = await callTool(handler, accessToken, "add_note", WRITE_ARGS);
    expect(written.isError).toBeFalsy();
    expect(await notesIn(w.owner, w.group.id)).toBe(1);
    const overview = await callTool(handler, accessToken, "group_overview");
    expect(overview.structuredContent).toMatchObject({
      you: { canAddEntries: true, groupReadOnly: false },
    });
  });

  it("leaves a read grant made during read only reading after switching back, with the 403", async () => {
    const w = await world();
    ok(await w.setReadOnly(true));
    const accessToken = await connected(w.caretaker, w.group.id, "read");
    ok(await w.setReadOnly(false));

    expect(await toolNames(accessToken)).not.toContain("add_note");
    const res = await mcpPost(handler, accessToken, toolRequest("add_note", WRITE_ARGS));
    expect(res.status).toBe(403);
    expect(res.headers.get("www-authenticate")).toContain("insufficient_scope");
  });

  it("refuses connecting to read and write", async () => {
    const w = await world();
    ok(await w.setReadOnly(true));
    await expect(
      connectAssistant({ email: w.caretaker.user.email, groupId: w.group.id, scope: "readWrite" }),
    ).rejects.toThrow(/Read only, set by the group owner/);
    expect(ok(await connectorGrantService.listForGroup(w.owner.ctx, w.group.id))).toEqual([]);
  });

  it("keeps the 403 for a read grant in a read-and-write group", async () => {
    const w = await world();
    const accessToken = await connected(w.caretaker, w.group.id, "read");
    const res = await mcpPost(handler, accessToken, toolRequest("add_note", WRITE_ARGS));
    expect(res.status).toBe(403);
    expect(res.headers.get("www-authenticate")).toContain("insufficient_scope");
  });

  it("never blames the owner for a demoted caretaker: false, and the 403", async () => {
    const w = await world();
    const accessToken = await connected(w.caretaker, w.group.id);
    await clientFor(w.owner.ctx.authUser).careGroup.changeRole({
      groupId: w.group.id,
      userId: w.caretaker.user.id,
      role: "viewer",
    });
    ok(await w.setReadOnly(true));

    const [listed] = await clientFor(w.caretaker.ctx.authUser).connector.listMine();
    expect(listed?.readOnlyByOwner).toBe(false);
    const res = await mcpPost(handler, accessToken, toolRequest("add_note", WRITE_ARGS));
    expect(res.status).toBe(403);
    const overview = await callTool(handler, accessToken, "group_overview");
    expect(overview.structuredContent).toMatchObject({
      you: { canAddEntries: false, groupReadOnly: false },
    });
  });

  it("marks only connections that could write, in both lists", async () => {
    const w = await world();
    await connectAssistant({ email: w.caretaker.user.email, groupId: w.group.id, clientName: "Writer" });
    await connectAssistant({
      email: w.admin.user.email,
      groupId: w.group.id,
      scope: "read",
      clientName: "Reader",
    });
    const flags = async () =>
      Object.fromEntries(
        (await clientFor(w.owner.ctx.authUser).connector.listForGroup({ groupId: w.group.id })).map((c) => [
          c.clientName,
          c.readOnlyByOwner,
        ]),
      );
    expect(await flags()).toEqual({ Writer: false, Reader: false });

    ok(await w.setReadOnly(true));
    expect(await flags()).toEqual({ Writer: true, Reader: false });
    const [mine] = await clientFor(w.caretaker.ctx.authUser).connector.listMine();
    expect(mine?.readOnlyByOwner).toBe(true);
  });
});

describe("careGroup.update's connectorsReadOnly", () => {
  it("reads as read and write for an existing group", async () => {
    const w = await world();
    expect(ok(await careGroupService.getById(w.owner.ctx, w.group.id))?.connectorsReadOnly).toBe(false);
  });

  it("is an owner's, and changing it revokes nothing", async () => {
    const w = await world();
    await connectAssistant({ email: w.caretaker.user.email, groupId: w.group.id });

    await clientFor(w.owner.ctx.authUser).careGroup.update({ groupId: w.group.id, connectorsReadOnly: true });
    expect(ok(await careGroupService.getById(w.owner.ctx, w.group.id))?.connectorsReadOnly).toBe(true);
    expect(ok(await connectorGrantService.listForGroup(w.owner.ctx, w.group.id))).toHaveLength(1);

    await clientFor(w.owner.ctx.authUser).careGroup.update({
      groupId: w.group.id,
      connectorsReadOnly: false,
    });
    expect(ok(await connectorGrantService.listForGroup(w.owner.ctx, w.group.id))).toHaveLength(1);
  });

  it("refuses an admin, caretaker and viewer, and hides the group from a non-member", async () => {
    const w = await world();
    const attempt = (who: typeof w.admin) =>
      clientFor(who.ctx.authUser).careGroup.update({ groupId: w.group.id, connectorsReadOnly: true });
    for (const who of [w.admin, w.caretaker, w.viewer]) {
      expect(await codesOf(attempt(who))).toBe("FORBIDDEN:careGroupService:connectorsOwnerOnly");
    }
    expect((await codesOf(attempt(w.outsider))).startsWith("NOT_FOUND")).toBe(true);
    expect(ok(await careGroupService.getById(w.owner.ctx, w.group.id))?.connectorsReadOnly).toBe(false);
  });

  it("refuses a filter that isn't one group", async () => {
    const w = await world();
    const res = await careGroupService.update(w.owner.ctx, {
      filter: { name: { type: "eq", value: w.group.name } },
      data: { connectorsReadOnly: true },
    });
    expect(res).toMatchObject({ code: "careGroupService:connectorsOwnerOnly" });
  });
});
