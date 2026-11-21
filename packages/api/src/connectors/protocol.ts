import type { AppError } from "@caretook/data";
import type { Prompt } from "./prompts";
import type { Tool, ToolContext } from "./registry";

import { ERRORS, isError } from "@caretook/data";
import { CONNECTOR_OAUTH_SCOPES } from "@caretook/data/schema";
import { CONNECTOR_PROMPTS, describePrompt, promptAllowed } from "./prompts";
import { describeTool, toolAllowed } from "./registry";

// The Model Context Protocol's server side, as much as connectors need:
// JSON-RPC 2.0 over one POST per message, stateless (no sessions, no SSE).
// `initialize` (version negotiation; the `tools` and `prompts`
// capabilities), `notifications/initialized`, `ping`, `tools/list` and
// `prompts/list` (filtered by the grant's scope), `tools/call` and
// `prompts/get`. A tool's own failure (a refusal, a not-found) is
// a result with `isError: true`, so the model can correct itself; only
// protocol faults are JSON-RPC errors. Pure apart from the tools' handlers.

/** Newest first: `initialize` answers with the client's version when it's here, else the first. */
export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const MCP_SERVER_INFO = { name: "caretook", title: "Caretook", version: "1.0.0" } as const;

const INSTRUCTIONS =
  "Caretook is a shared care log for one care group. Every tool works on the one group this connection was granted; start with group_overview for its time zone and your scope. Times are ISO 8601 in the care recipient's time zone. Notes are for what has happened; for something to do later, add a todo with a due day, and an appointment ahead is an event. Its prompts are ready-made starting points: catch me up, prepare for an appointment, a weekly summary and, when you may write, log what happened.";

/** JSON-RPC 2.0's error codes. */
export const JSON_RPC = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

type Id = string | number | null;

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: Id; result: unknown }
  | { jsonrpc: "2.0"; id: Id; error: { code: number; message: string; data?: unknown } };

/**
 * What the HTTP layer sends back:
 *   - `response`: a JSON-RPC response (200);
 *   - `accepted`: a notification or a response from the client (202, no body);
 *   - `insufficientScope`: a call to a tool the grant's scope doesn't allow (403 with the challenge).
 */
export type McpReply =
  | { kind: "response"; body: JsonRpcResponse }
  | { kind: "accepted" }
  | { kind: "insufficientScope"; scope: string; body: JsonRpcResponse };

const result = (id: Id, value: unknown): McpReply => ({
  kind: "response",
  body: { jsonrpc: "2.0", id, result: value },
});

const failure = (id: Id, code: number, message: string, data?: unknown): McpReply => ({
  kind: "response",
  body: { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } },
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isId = (value: unknown): value is string | number =>
  typeof value === "string" || (typeof value === "number" && Number.isFinite(value));

/** The issues of a Zod error or an AppError's meta, as `{ path, message }`. */
const issuesOf = (raw: unknown) =>
  Array.isArray(raw)
    ? raw.filter(isObject).map((issue) => ({
        path: Array.isArray(issue.path)
          ? issue.path.join(".")
          : typeof issue.path === "string"
            ? issue.path
            : "",
        message: typeof issue.message === "string" ? issue.message : "Invalid",
      }))
    : undefined;

/** A tool failure the model can read and correct: the code, a plain message and the issues. */
export const toolError = (code: string, message: string, issues?: { path: string; message: string }[]) => ({
  content: [
    {
      type: "text",
      text: issues?.length
        ? `${message}\n${issues.map((i) => `- ${i.path || "input"}: ${i.message}`).join("\n")}`
        : message,
    },
  ],
  structuredContent: { error: { code, message, ...(issues?.length ? { issues } : {}) } },
  isError: true,
});

/** An AppError as a tool failure. Server faults (no 4xx status) say only that something went wrong. */
const appErrorResult = (error: AppError) => {
  const status = (ERRORS[error.code] as { statusCode?: number }).statusCode;
  if (!status || status >= 500) return null;
  return toolError(
    error.code,
    error.message,
    issuesOf((error.meta as { issues?: unknown } | undefined)?.issues),
  );
};

const initialize = (id: Id, params: Record<string, unknown>) => {
  const asked = params.protocolVersion;
  const protocolVersion = MCP_PROTOCOL_VERSIONS.find((v) => v === asked) ?? MCP_PROTOCOL_VERSIONS[0];
  return result(id, {
    protocolVersion,
    capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
    serverInfo: MCP_SERVER_INFO,
    instructions: INSTRUCTIONS,
  });
};

const callTool = async (
  id: Id,
  params: Record<string, unknown>,
  ctx: ToolContext,
  registry: readonly Tool[],
): Promise<McpReply> => {
  const { name } = params;
  if (typeof name !== "string")
    return failure(id, JSON_RPC.invalidParams, "params.name must be a tool's name");
  const args = params.arguments ?? {};
  if (!isObject(args)) return failure(id, JSON_RPC.invalidParams, "params.arguments must be an object");

  const tool = registry.find((t) => t.name === name);
  if (!tool) return failure(id, JSON_RPC.invalidParams, `Unknown tool: ${name}`);
  if (!toolAllowed(tool, ctx.scope)) {
    return {
      kind: "insufficientScope",
      scope: CONNECTOR_OAUTH_SCOPES.write,
      body: {
        jsonrpc: "2.0",
        id,
        error: {
          code: JSON_RPC.invalidRequest,
          message: "This connection can only read. Reconnect to add entries.",
        },
      },
    };
  }

  const parsed = tool.input.safeParse(args);
  if (!parsed.success) {
    return result(
      id,
      toolError("mcp:invalidArguments", "The tool's arguments are invalid", issuesOf(parsed.error.issues)),
    );
  }
  const output = await tool.handler(parsed.data, ctx);
  if (isError(output)) {
    const refused = appErrorResult(output);
    if (!refused) throw output;
    return result(id, refused);
  }
  return result(id, {
    content: [{ type: "text", text: output.text }],
    structuredContent: output.structured,
  });
};

/** `prompts/get`: the prompt's user message, its arguments checked (a bad one is invalid params). */
const getPrompt = (id: Id, params: Record<string, unknown>, ctx: ToolContext, prompts: readonly Prompt[]) => {
  const { name } = params;
  if (typeof name !== "string")
    return failure(id, JSON_RPC.invalidParams, "params.name must be a prompt's name");
  const args = params.arguments ?? {};
  if (!isObject(args)) return failure(id, JSON_RPC.invalidParams, "params.arguments must be an object");
  // A prompt the grant can't use is as unknown as one that doesn't exist: it isn't listed.
  const prompt = prompts.find((p) => p.name === name && promptAllowed(p, ctx.scope));
  if (!prompt) return failure(id, JSON_RPC.invalidParams, `Unknown prompt: ${name}`);

  const parsed = prompt.args.safeParse(args);
  if (!parsed.success) {
    return failure(id, JSON_RPC.invalidParams, "The prompt's arguments are invalid", {
      issues: issuesOf(parsed.error.issues),
    });
  }
  return result(id, {
    description: prompt.description,
    messages: [{ role: "user", content: { type: "text", text: prompt.render(parsed.data) } }],
  });
};

/**
 * Answer one JSON-RPC message (already parsed from the body) for a verified
 * connection. Throws only what the tools throw (a server fault), which the
 * HTTP layer logs and answers as a 500.
 */
export const handleMcp = async (
  message: unknown,
  ctx: ToolContext,
  registry: readonly Tool[],
  prompts: readonly Prompt[] = CONNECTOR_PROMPTS,
): Promise<McpReply> => {
  // JSON-RPC batches went in MCP 2025-06-18; we answer one message per POST.
  if (Array.isArray(message))
    return failure(null, JSON_RPC.invalidRequest, "Batches aren't supported: send one message per request");
  if (!isObject(message) || message.jsonrpc !== "2.0") {
    return failure(
      isObject(message) && isId(message.id) ? message.id : null,
      JSON_RPC.invalidRequest,
      "Not a JSON-RPC 2.0 message",
    );
  }

  const hasId = "id" in message;
  // A response (to a request we never send) or a notification: nothing to answer.
  if (!("method" in message))
    return hasId ? { kind: "accepted" } : failure(null, JSON_RPC.invalidRequest, "No method");
  const { method } = message;
  if (typeof method !== "string") return failure(null, JSON_RPC.invalidRequest, "method must be a string");
  if (!hasId) return { kind: "accepted" };
  if (!isId(message.id)) return failure(null, JSON_RPC.invalidRequest, "id must be a string or a number");
  const { id } = message;

  const params = message.params ?? {};
  if (!isObject(params)) return failure(id, JSON_RPC.invalidParams, "params must be an object");

  switch (method) {
    case "initialize":
      return initialize(id, params);
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: registry.filter((tool) => toolAllowed(tool, ctx.scope)).map(describeTool) });
    case "tools/call":
      return callTool(id, params, ctx, registry);
    case "prompts/list":
      return result(id, {
        prompts: prompts.filter((prompt) => promptAllowed(prompt, ctx.scope)).map(describePrompt),
      });
    case "prompts/get":
      return getPrompt(id, params, ctx, prompts);
    default:
      return failure(id, JSON_RPC.methodNotFound, `Method not found: ${method}`);
  }
};
