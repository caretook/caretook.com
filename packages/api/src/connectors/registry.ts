import type { AppError, AuthUser, ConnectorScope, GroupRoleName } from "@caretook/data";

import { z } from "zod";

// The connector tools (connectors PRD): each one a name, a description the
// model reads, the scope it needs, its input as a Zod schema (sent to the
// client as JSON Schema), MCP's annotations, and a handler over the
// services. `groupId` always comes from the grant (the context), never from
// a tool's input.

/** Whom a call acts for and where: from connectorGrantService.verify. */
export type ToolContext = {
  authUser: AuthUser;
  groupId: string;
  role: GroupRoleName;
  scope: ConnectorScope;
  clientName: string;
  /** The server's clock, for defaults such as "the last 90 days". */
  now: Date;
  /** Our public origin ("https://caretook.com"), for links to what a write made. */
  origin?: string;
};

/** A tool's answer: a short text rendering for the model, and the same as data. */
export type ToolOutput = { text: string; structured: Record<string, unknown> };

/** MCP's tool annotations (hints for the client: Claude and ChatGPT ask before a call that isn't read-only). */
export type ToolAnnotations = {
  title?: string;
  readOnlyHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type Tool<I extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  /** `read` tools are listed for every grant; `readWrite` ones only for a grant that may write. */
  scope: ConnectorScope;
  input: I;
  annotations: ToolAnnotations;
  handler: (input: z.output<I>, ctx: ToolContext) => Promise<ToolOutput | AppError>;
};

/** Reads: never change anything, and the client may call them without asking. */
export const READ_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: false,
} as const satisfies ToolAnnotations;

/** Writes: add an entry (never edit or delete), so the client asks the member first. */
export const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const satisfies ToolAnnotations;

/** Keeps a tool's input type through to its handler. */
export const defineTool = <I extends z.ZodType>(tool: Tool<I>): Tool => tool;

/** Whether a grant of `scope` may see and call `tool`. */
export const toolAllowed = (tool: Pick<Tool, "scope">, scope: ConnectorScope) =>
  tool.scope === "read" || scope === "readWrite";

/** A tool's input as the JSON Schema `tools/list` sends (what the caller may send: defaults are optional). */
export const inputJsonSchema = (input: z.ZodType) => {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(input, { io: "input", unrepresentable: "any" });
  return schema;
};

/** `tools/list`'s entry for a tool. */
export const describeTool = (tool: Tool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: inputJsonSchema(tool.input),
  annotations: { title: tool.title, ...tool.annotations },
});
