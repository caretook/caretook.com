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
    error?: { code: number; message: string };
  };
};

describe("handleMcp", () => {
  it("initializes with the client's version when it's one we speak", async () => {
    const body = await bodyOf(request(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {} }));
    expect(body).toMatchObject({
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "caretook" },
      },
    });
    expect(Object.keys(body.result!.capabilities as object)).toEqual(["tools"]);
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
