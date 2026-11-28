import { careGroupService, providerService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import {
  callTool,
  connectAssistant,
  enablePasswordSignIn,
  mcpHandler,
  mcpPost,
  textOf,
  TEST_ORIGIN,
  toolRequest,
} from "./testing";

// add_provider through /mcp with tokens from the real OAuth dance: the Add
// provider sheet's fields and checks, quick entry's words with a link, no
// second copy of a provider already there, and the grant's and the group's
// limits. All data is fictional.

const handler = mcpHandler();
const byId = (id: string) => ({ id: { type: "eq" as const, value: id } });

const world = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  for (const who of [owner, caretaker]) await enablePasswordSignIn(who.user.id);
  const { group } = await createGroup(owner, [{ user: caretaker.user, role: "caretaker" }]);
  ok(await careGroupService.update(owner.ctx, { filter: byId(group.id), data: { connectorsEnabled: true } }));
  const practice = ok(
    await providerService.create(owner.ctx, {
      groupId: group.id,
      type: "practice",
      name: "Maple Grove Clinic",
    }),
  )!;
  const clinician = ok(
    await providerService.create(owner.ctx, {
      groupId: group.id,
      type: "clinician",
      name: "Dr. Example Fern",
    }),
  )!;
  const connect = async (scope: "read" | "readWrite" = "readWrite") =>
    (await connectAssistant({ email: caretaker.user.email, groupId: group.id, scope })).tokens.access_token;
  const providers = async () => ok(await providerService.list(owner.ctx, { groupId: group.id })).data;
  return { owner, group, practice, clinician, connect, providers };
};

describe("add_provider", () => {
  it("adds a clinician at a practice, answers with its link, and list_providers has it", async () => {
    const w = await world();
    const token = await w.connect();
    const added = await callTool(handler, token, "add_provider", {
      name: "Dr. Imani Testwell",
      specialty: "Cardiology",
      practiceId: w.practice.id,
      phones: [{ number: "555-0142", label: "Office" }],
      email: "ignored@example.com",
      primary: true,
    });
    expect(added.isError).toBeFalsy();
    const providerId = added.structuredContent.providerId as string;
    const url = `${TEST_ORIGIN}/app/groups/${w.group.id}/providers/${providerId}`;
    expect(textOf(added)).toBe(
      `Added provider: Dr. Imani Testwell · Cardiology · Maple Grove Clinic · 555-0142\n${url}`,
    );
    expect(added.structuredContent).toMatchObject({
      providerId,
      url,
      preview: { title: "Dr. Imani Testwell", detail: "Cardiology · Maple Grove Clinic · 555-0142" },
    });

    const stored = (await w.providers()).find((p) => p.id === providerId);
    expect(stored).toMatchObject({
      type: "clinician",
      email: null,
      isPrimary: false,
      status: "current",
      phones: [{ number: "555-0142", label: "Office" }],
    });

    const listed = await callTool(handler, token, "list_providers");
    const providers = listed.structuredContent.providers as { id: string; practice: string | null }[];
    expect(providers.find((p) => p.id === providerId)).toMatchObject({ practice: "Maple Grove Clinic" });
  });

  it("refuses a bad phone number and a clinician as a practice, writing nothing", async () => {
    const w = await world();
    const token = await w.connect();
    const before = (await w.providers()).length;

    const badPhone = await callTool(handler, token, "add_provider", {
      name: "Dr. Bad Phone",
      phones: [{ number: "call me" }],
    });
    expect(badPhone.isError).toBe(true);
    expect(badPhone.structuredContent).toMatchObject({ error: { issues: [{ path: "phones.0.number" }] } });

    const badPractice = await callTool(handler, token, "add_provider", {
      name: "Dr. Wrong Practice",
      practiceId: w.clinician.id,
    });
    expect(badPractice.isError).toBe(true);
    expect(badPractice.structuredContent).toMatchObject({
      error: { code: "providerService:badPractice", issues: [{ path: "practiceId" }] },
    });

    expect(await w.providers()).toHaveLength(before);
  });

  it("adds nothing for the same type and name again, answering with the first one", async () => {
    const w = await world();
    const token = await w.connect();
    const first = await callTool(handler, token, "add_provider", { name: "Dr. Rowan Sample" });
    const firstId = first.structuredContent.providerId as string;
    const count = (await w.providers()).length;

    const again = await callTool(handler, token, "add_provider", { name: "  dr.   ROWAN  sample " });
    expect(again.isError).toBeFalsy();
    expect(again.structuredContent).toMatchObject({ providerId: firstId, alreadyThere: true });
    expect(textOf(again)).toBe(
      `Already in the directory, nothing added: Dr. Rowan Sample\n${TEST_ORIGIN}/app/groups/${w.group.id}/providers/${firstId}`,
    );
    expect(await w.providers()).toHaveLength(count);

    // Another type of the same name is someone else.
    const practice = await callTool(handler, token, "add_provider", {
      type: "practice",
      name: "Dr. Rowan Sample",
    });
    expect(practice.structuredContent.alreadyThere).toBeUndefined();
    expect(await w.providers()).toHaveLength(count + 1);
  });

  it("isn't for a read grant, nor while the group is set to read only", async () => {
    const w = await world();
    const reader = await w.connect("read");
    const refused = await mcpPost(handler, reader, toolRequest("add_provider", { name: "Dr. No Scope" }));
    expect(refused.status).toBe(403);
    expect(refused.headers.get("www-authenticate")).toContain("insufficient_scope");

    const writer = await w.connect();
    ok(
      await careGroupService.update(w.owner.ctx, {
        filter: byId(w.group.id),
        data: { connectorsReadOnly: true },
      }),
    );
    const blocked = await callTool(handler, writer, "add_provider", { name: "Dr. Read Only" });
    expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent).toMatchObject({ error: { code: "mcp:groupReadOnly" } });
    expect((await w.providers()).map((p) => p.name)).not.toContain("Dr. Read Only");
  });
});
