import type { Tool, ToolContext } from "./registry";

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { newError } from "@caretook/data";
import { handleMcp, JSON_RPC, MCP_PROTOCOL_VERSIONS } from "./protocol";
import { defineTool, READ_ANNOTATIONS, WRITE_ANNOTATIONS } from "./registry";

// The MCP module at its edge: a JSON-RPC message in, a reply out. The tools
// here are stand-ins; the real ones run against the database in
// mcp.int.test.ts.

const echo = defineTool({
  name: "echo",
  title: "Echo",
  description: "Says it back.",
  scope: "read",
  input: z.object({ words: z.string().min(1) }),
  annotations: READ_ANNOTATIONS,
  handler: (input) => Promise.resolve({ text: input.words, structured: { words: input.words } }),
});

const refuse = defineTool({
  name: "refuse",
  title: "Refuse",
  description: "Always refused, as a service would.",
  scope: "read",
  input: z.object({}),
  annotations: READ_ANNOTATIONS,
  handler: () => Promise.resolve(newError({ code: "connectorGrantService:notFound" })),
});

const broken = defineTool({
  name: "broken",
  title: "Broken",
  description: "A server fault.",
  scope: "read",
  input: z.object({}),
  annotations: READ_ANNOTATIONS,
  handler: () => Promise.resolve(newError({ code: "connectorGrantModel:getLive" })),
});

const add = defineTool({
  name: "add",
  title: "Add",
  description: "Writes.",
  scope: "readWrite",
  input: z.object({}),
  annotations: WRITE_ANNOTATIONS,
  handler: () => Promise.resolve({ text: "Added", structured: {} }),
});

const TOOLS: Tool[] = [echo, refuse, broken, add];

const ctx = (scope: ToolContext["scope"] = "readWrite"): ToolContext => ({
  authUser: { id: "00000000-0000-4000-8000-000000000001", roleNames: ["member"] },
  groupId: "00000000-0000-4000-8000-000000000002",
  role: scope === "readWrite" ? "caretaker" : "viewer",
  scope,
  clientName: "Test assistant",
  now: new Date("2026-11-20T12:00:00Z"),
});

const send = (message: unknown, scope?: ToolContext["scope"]) => handleMcp(message, ctx(scope), TOOLS);
const request = (id: number | string, method: string, params?: unknown) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params === undefined ? {} : { params }),
});

const bodyOf = async (message: unknown, scope?: ToolContext["scope"]) => {
  const reply = await send(message, scope);
  if (reply.kind !== "response") throw new Error(`expected a response, got ${reply.kind}`);
  return reply.body as {
    id: unknown;
    result?: Record<string, unknown>;
    error?: { code: number; message: string; data?: unknown };
  };
};

describe("handleMcp", () => {
  it("initializes with the client's version when it's one we speak", async () => {
    const body = await bodyOf(request(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {} }));
    expect(body).toMatchObject({
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "caretook" },
      },
    });
    expect(Object.keys(body.result!.capabilities as object)).toEqual(["tools", "prompts"]);
    expect(body.result?.instructions).toMatch(/prompts/);
  });

  it("answers an unknown version with our newest", async () => {
    const body = await bodyOf(request(1, "initialize", { protocolVersion: "1999-01-01" }));
    expect(body.result?.protocolVersion).toBe(MCP_PROTOCOL_VERSIONS[0]);
  });

  it("accepts notifications without a reply, notifications/initialized included", async () => {
    expect(await send({ jsonrpc: "2.0", method: "notifications/initialized" })).toEqual({ kind: "accepted" });
    expect(await send({ jsonrpc: "2.0", method: "notifications/whatever", params: {} })).toEqual({
      kind: "accepted",
    });
  });

  it("accepts a client's response without a reply", async () => {
    expect(await send({ jsonrpc: "2.0", id: 7, result: {} })).toEqual({ kind: "accepted" });
  });

  it("answers ping with an empty result", async () => {
    expect(await bodyOf(request("p", "ping"))).toEqual({ jsonrpc: "2.0", id: "p", result: {} });
  });

  it("lists every tool for a read-and-write grant, with JSON Schema inputs and annotations", async () => {
    const body = await bodyOf(request(2, "tools/list"));
    const tools = body.result?.tools as { name: string; inputSchema: unknown; annotations: unknown }[];
    expect(tools.map((t) => t.name)).toEqual(["echo", "refuse", "broken", "add"]);
    expect(tools[0]).toMatchObject({
      inputSchema: {
        type: "object",
        properties: { words: { type: "string", minLength: 1 } },
        required: ["words"],
      },
      annotations: { readOnlyHint: true },
    });
    expect(tools[3]?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
  });

  it("leaves write tools out of a read-only grant's list", async () => {
    const body = await bodyOf(request(2, "tools/list"), "read");
    expect((body.result?.tools as { name: string }[]).map((t) => t.name)).toEqual([
      "echo",
      "refuse",
      "broken",
    ]);
  });

  it("calls a tool: its text as content, its data as structuredContent", async () => {
    const body = await bodyOf(request(3, "tools/call", { name: "echo", arguments: { words: "hello" } }));
    expect(body.result).toEqual({
      content: [{ type: "text", text: "hello" }],
      structuredContent: { words: "hello" },
    });
  });

  it("answers invalid arguments with an isError result carrying the issues", async () => {
    const body = await bodyOf(request(3, "tools/call", { name: "echo", arguments: { words: "" } }));
    expect(body.result).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "mcp:invalidArguments", issues: [{ path: "words" }] } },
    });
  });

  it("answers a refusal with an isError result: the code and a plain message", async () => {
    const body = await bodyOf(request(4, "tools/call", { name: "refuse" }));
    expect(body.result).toEqual({
      content: [{ type: "text", text: "Connection not found" }],
      structuredContent: {
        error: { code: "connectorGrantService:notFound", message: "Connection not found" },
      },
      isError: true,
    });
  });

  it("throws a server fault for the HTTP layer to log, never showing it", async () => {
    await expect(send(request(5, "tools/call", { name: "broken" }))).rejects.toMatchObject({
      code: "connectorGrantModel:getLive",
    });
  });

  it("refuses a write tool on a read-only grant as insufficient scope", async () => {
    const reply = await send(request(6, "tools/call", { name: "add" }), "read");
    expect(reply).toMatchObject({ kind: "insufficientScope", scope: "group:write" });
  });

  it("answers an unknown tool and bad params as invalid params", async () => {
    for (const params of [{ name: "nope" }, {}, { name: "echo", arguments: "words" }]) {
      const body = await bodyOf(request(7, "tools/call", params));
      expect(body.error?.code).toBe(JSON_RPC.invalidParams);
    }
    expect((await bodyOf(request(7, "tools/list", "all"))).error?.code).toBe(JSON_RPC.invalidParams);
  });

  it("answers an unknown method as method not found", async () => {
    const body = await bodyOf(request(8, "resources/list"));
    expect(body).toMatchObject({ id: 8, error: { code: JSON_RPC.methodNotFound } });
  });

  it("refuses a batch (MCP 2025-06-18 dropped them) and anything that isn't JSON-RPC 2.0", async () => {
    const batch = await bodyOf([request(1, "ping"), request(2, "ping")]);
    expect(batch).toMatchObject({ id: null, error: { code: JSON_RPC.invalidRequest } });
    for (const message of [
      null,
      "ping",
      { id: 1, method: "ping" },
      { jsonrpc: "2.0", id: {}, method: "ping" },
    ]) {
      expect((await bodyOf(message)).error?.code).toBe(JSON_RPC.invalidRequest);
    }
  });
});

describe("handleMcp's prompts (the real ones)", () => {
  type PromptReply = {
    description: string;
    messages: { role: string; content: { type: string; text: string } }[];
  };
  const get = async (name: string, args?: Record<string, unknown>, scope?: ToolContext["scope"]) =>
    bodyOf(request(9, "prompts/get", { name, ...(args ? { arguments: args } : {}) }), scope);
  const textOf = async (name: string, args?: Record<string, unknown>) => {
    const body = await get(name, args);
    const reply = body.result as PromptReply;
    expect(reply.messages).toHaveLength(1);
    expect(reply.messages[0]).toMatchObject({ role: "user", content: { type: "text" } });
    return reply.messages[0]!.content.text;
  };

  it("lists the four for a read-and-write grant, with MCP arguments", async () => {
    const body = await bodyOf(request(2, "prompts/list"));
    const prompts = body.result?.prompts as {
      name: string;
      title: string;
      arguments: { name: string; description?: string; required: boolean }[];
    }[];
    expect(prompts.map((p) => p.name)).toEqual([
      "catch_me_up",
      "prepare_for_appointment",
      "weekly_summary",
      "log_what_happened",
    ]);
    expect(prompts[0]).toMatchObject({
      title: "Catch me up",
      arguments: [{ name: "since", required: false }],
    });
    expect(prompts[0]?.arguments[0]?.description).toMatch(/start of today/);
    expect(prompts[1]?.arguments).toMatchObject([{ name: "appointment", required: false }]);
    expect(prompts[2]?.arguments).toEqual([]);
    expect(prompts[3]?.arguments).toMatchObject([{ name: "account", required: true }]);
  });

  it("say todos, never tasks: the list, every prompt's text and the server instructions", async () => {
    const init = await bodyOf(request(1, "initialize", { protocolVersion: "2025-11-25" }));
    expect(init.result?.instructions).not.toMatch(/task/i);
    const listed = await bodyOf(request(2, "prompts/list"));
    expect(JSON.stringify(listed.result)).not.toMatch(/task/i);
    for (const name of ["catch_me_up", "prepare_for_appointment", "weekly_summary"]) {
      expect(await textOf(name)).not.toMatch(/task/i);
    }
    const logging = await textOf("log_what_happened", { account: "Called the pharmacy." });
    expect(logging).not.toMatch(/task/i);
    expect(logging).toContain("add_todo");
  });

  it("leaves logging out of a read-only grant's list, and won't get it", async () => {
    const body = await bodyOf(request(2, "prompts/list"), "read");
    expect((body.result?.prompts as { name: string }[]).map((p) => p.name)).toEqual([
      "catch_me_up",
      "prepare_for_appointment",
      "weekly_summary",
    ]);
    const refused = await get("log_what_happened", { account: "Slept well" }, "read");
    expect(refused.error?.code).toBe(JSON_RPC.invalidParams);
  });

  it("catch_me_up: since the start of today by default, or the time given; names the tools", async () => {
    const plain = await textOf("catch_me_up");
    expect(plain).toContain("since the start of today");
    for (const tool of ["group_overview", "list_timeline", "todays_doses", "upcoming"])
      expect(plain).toContain(tool);
    expect(await textOf("catch_me_up", { since: "yesterday at 6pm" })).toContain('since "yesterday at 6pm"');
    expect(await textOf("catch_me_up", { since: "  " })).toContain("since the start of today");
  });

  it("prepare_for_appointment: the next one by default, or the one named", async () => {
    const next = await textOf("prepare_for_appointment");
    expect(next).toContain("the next appointment");
    for (const tool of ["upcoming", "list_timeline", "latest_vitals", "list_medications"])
      expect(next).toContain(tool);
    expect(await textOf("prepare_for_appointment", { appointment: "Dr. Lark on Tuesday" })).toContain(
      'the appointment "Dr. Lark on Tuesday"',
    );
  });

  it("weekly_summary: the last 7 days, no arguments needed", async () => {
    const text = await textOf("weekly_summary");
    expect(text).toContain("last 7 days");
    expect(text).toContain("list_timeline");
  });

  it("log_what_happened: the account, the write tools, and one call per entry to confirm", async () => {
    const text = await textOf("log_what_happened", { account: "BP 128/82 at 9am, gave her morning pills." });
    expect(text).toContain("BP 128/82 at 9am, gave her morning pills.");
    for (const tool of ["log_vitals", "log_dose", "log_symptom", "add_note"]) expect(text).toContain(tool);
    expect(text).toMatch(/confirm each/);
  });

  it("answers a missing or invalid argument, an unknown prompt and bad params as invalid params", async () => {
    for (const args of [undefined, {}, { account: "" }, { account: 42 }, { account: "x".repeat(5001) }]) {
      expect((await get("log_what_happened", args)).error?.code).toBe(JSON_RPC.invalidParams);
    }
    const missing = await get("log_what_happened");
    expect(missing.error).toMatchObject({ data: { issues: [{ path: "account" }] } });
    expect((await get("catch_me_up", { since: "x".repeat(101) })).error?.code).toBe(JSON_RPC.invalidParams);
    expect((await get("nope")).error?.code).toBe(JSON_RPC.invalidParams);
    expect((await bodyOf(request(9, "prompts/get", {}))).error?.code).toBe(JSON_RPC.invalidParams);
    expect(
      (await bodyOf(request(9, "prompts/get", { name: "weekly_summary", arguments: "all" }))).error?.code,
    ).toBe(JSON_RPC.invalidParams);
  });
});
